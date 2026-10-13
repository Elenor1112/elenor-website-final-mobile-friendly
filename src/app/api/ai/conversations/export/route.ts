import { and, asc, desc, eq, ilike, or, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import { chatConversations, chatMessages } from '@/db/schema';
import { can, getCurrentUser } from '@/server/auth/rbac';
import { csvCell } from '@/lib/csv';

// One row per message so transcripts stay readable in a spreadsheet.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !can(user, 'messages:write')) {
    return new Response('Unauthorized', { status: 401 });
  }

  const q = new URL(request.url).searchParams.get('q');
  const conditions: SQL[] = [];
  if (q) {
    const like = `%${q}%`;
    conditions.push(
      or(
        ilike(chatConversations.title, like),
        ilike(chatMessages.content, like),
      )!,
    );
  }

  const rows = await db
    .select({
      conversationId: chatConversations.id,
      title: chatConversations.title,
      startedAt: chatConversations.createdAt,
      role: chatMessages.role,
      content: chatMessages.content,
      createdAt: chatMessages.createdAt,
      unanswered: chatMessages.wasUnanswered,
    })
    .from(chatConversations)
    .innerJoin(chatMessages, eq(chatMessages.conversationId, chatConversations.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(chatConversations.lastMessageAt), asc(chatMessages.createdAt));

  const header = ['Conversation', 'Title', 'Started', 'Timestamp', 'Role', 'Message', 'Unanswered'];
  const lines = [
    header.join(','),
    ...rows.map((row) =>
      [
        row.conversationId,
        row.title,
        row.startedAt.toISOString(),
        row.createdAt.toISOString(),
        row.role,
        row.content,
        row.unanswered ? 'yes' : 'no',
      ]
        .map((value) => csvCell(String(value ?? '')))
        .join(','),
    ),
  ];

  return new Response('﻿' + lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="elenor-ai-conversations-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
