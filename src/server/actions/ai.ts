'use server';

import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { chatConversations, chatLeads } from '@/db/schema';
import { requireUser } from '@/server/auth/rbac';
import { reindexKnowledgeBase } from '@/server/ai/indexing/indexer';
import { logAudit } from './audit';

/**
 * Admin actions for the AI section. Every mutation goes through `requireUser`
 * with an explicit permission, matching the rest of the CMS.
 */

export type AiActionResult = { ok: true; message: string } | { ok: false; error: string };

/**
 * Full rebuild triggered from the knowledge dashboard.
 *
 * Awaited (unlike the CMS auto-sync) because the admin explicitly asked for it
 * and wants the result reported back.
 */
export async function rebuildKnowledgeIndex(force = true): Promise<AiActionResult> {
  // A forced rebuild re-embeds everything on a paid API, so it is admin-only.
  const user = await requireUser('settings:write');
  try {
    const result = await reindexKnowledgeBase({ force });
    if (result.skippedNoProvider) {
      return {
        ok: false,
        error:
          'No embedding provider is configured. Set AI_EMBEDDING_PROVIDER and its API key, then try again.',
      };
    }

    await logAudit(user.id, 'update', 'ai-knowledge', 'index', 'Rebuilt knowledge index');

    const parts = [
      `${result.indexed} document${result.indexed === 1 ? '' : 's'} indexed`,
      `${result.chunks} chunk${result.chunks === 1 ? '' : 's'}`,
    ];
    if (result.skipped > 0) parts.push(`${result.skipped} unchanged`);
    if (result.removed > 0) parts.push(`${result.removed} removed`);
    if (result.errors.length > 0) parts.push(`${result.errors.length} failed`);

    return { ok: true, message: parts.join(' · ') };
  } catch (error) {
    console.error('[elenor-ai] Manual rebuild failed:', error);
    return {
      ok: false,
      error: 'The rebuild failed. Check the server logs.',
    };
  }
}

export async function setConversationNote(id: string, note: string): Promise<AiActionResult> {
  await requireUser('messages:write');
  const parsed = z.object({ id: z.string().uuid(), note: z.string().max(5000) }).safeParse({ id, note });
  if (!parsed.success) return { ok: false, error: 'Invalid input.' };

  await db
    .update(chatConversations)
    .set({ internalNote: parsed.data.note, updatedAt: new Date() })
    .where(eq(chatConversations.id, parsed.data.id));
  return { ok: true, message: 'Note saved.' };
}

export async function toggleConversationFlag(id: string): Promise<AiActionResult> {
  await requireUser('messages:write');
  const conversation = await db.query.chatConversations.findFirst({
    where: eq(chatConversations.id, z.string().uuid().parse(id)),
    columns: { isFlagged: true },
  });
  if (!conversation) return { ok: false, error: 'Conversation not found.' };

  await db
    .update(chatConversations)
    .set({ isFlagged: !conversation.isFlagged, updatedAt: new Date() })
    .where(eq(chatConversations.id, id));
  return { ok: true, message: conversation.isFlagged ? 'Flag removed.' : 'Conversation flagged.' };
}

const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'won', 'lost'] as const;

export async function setLeadStatus(id: string, status: string): Promise<AiActionResult> {
  const user = await requireUser('messages:write');
  const parsed = z
    .object({ id: z.string().uuid(), status: z.enum(LEAD_STATUSES) })
    .safeParse({ id, status });
  if (!parsed.success) return { ok: false, error: 'Invalid lead status.' };

  await db
    .update(chatLeads)
    .set({ status: parsed.data.status, updatedAt: new Date() })
    .where(eq(chatLeads.id, parsed.data.id));

  await logAudit(user.id, 'update', 'ai-lead', parsed.data.id, `Status → ${parsed.data.status}`);
  return { ok: true, message: `Lead marked as ${parsed.data.status}.` };
}

export async function setLeadNote(id: string, note: string): Promise<AiActionResult> {
  await requireUser('messages:write');
  const parsed = z.object({ id: z.string().uuid(), note: z.string().max(5000) }).safeParse({ id, note });
  if (!parsed.success) return { ok: false, error: 'Invalid input.' };

  await db
    .update(chatLeads)
    .set({ internalNote: parsed.data.note, updatedAt: new Date() })
    .where(eq(chatLeads.id, parsed.data.id));
  return { ok: true, message: 'Note saved.' };
}

export async function deleteConversation(id: string): Promise<AiActionResult> {
  const user = await requireUser('messages:write');
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false, error: 'Invalid conversation id.' };

  // Messages, leads and analytics cascade via their foreign keys.
  await db.delete(chatConversations).where(eq(chatConversations.id, parsed.data));
  await logAudit(user.id, 'delete', 'ai-conversation', parsed.data, 'Deleted conversation');
  return { ok: true, message: 'Conversation deleted.' };
}
