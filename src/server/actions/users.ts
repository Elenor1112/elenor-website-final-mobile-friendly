'use server';

import { and, asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { users } from '@/db/schema';
import { requireUser } from '@/server/auth/rbac';
import { hashPassword } from '@/server/auth/password';
import { revokeUserSessions } from '@/server/auth/session';
import { logAudit } from './audit';

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: 'SUPER_ADMIN' | 'EDITOR';
  isActive: boolean;
  createdAt: string;
};

export async function listUsers(): Promise<AdminUser[]> {
  await requireUser('users:write');
  const rows = await db.select().from(users).orderBy(asc(users.createdAt));
  return rows.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    isActive: u.isActive,
    createdAt: u.createdAt.toISOString(),
  }));
}

const userSchema = z.object({
  id: z.string().uuid().optional(),
  email: z.string().trim().toLowerCase().email(),
  name: z.string().min(1).max(200),
  role: z.enum(['SUPER_ADMIN', 'EDITOR']),
  // Optional so an update that omits it keeps the user's current state.
  isActive: z.boolean().optional(),
  password: z.string().min(8).max(200).optional().or(z.literal('')),
});

const LAST_ADMIN_ERROR = 'There must always be at least one active Super Admin.';

/** WHERE guard: another active Super Admin besides `id` exists. The inner
 *  FOR UPDATE locks those rows, so when two admins demote each other at the
 *  same moment the second statement waits, re-checks against the committed
 *  result and matches nothing — check and write happen in one statement. */
function anotherActiveSuperAdmin(id: string) {
  return sql`(select count(*) from (select ${users.id} from ${users} where ${users.role} = 'SUPER_ADMIN' and ${users.isActive} = true and ${users.id} <> ${id} for update) others) >= 1`;
}

/** Concurrent guarded writes can deadlock; Postgres aborts one of them. */
function isDeadlock(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === '40P01';
}

export async function saveUser(input: z.input<typeof userSchema>) {
  const actor = await requireUser('users:write');
  const parsed = userSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const { id, password, isActive: requestedActive, ...rest } = parsed.data;

  if (id) {
    const existing = await db.query.users.findFirst({ where: eq(users.id, id) });
    if (!existing) return { ok: false as const, error: 'User not found' };
    const data = { ...rest, isActive: requestedActive ?? existing.isActive };

    // Admins can't lock themselves out by demoting or deactivating their own account.
    if (actor.id === id && (data.role !== actor.role || !data.isActive)) {
      return { ok: false as const, error: 'You cannot change your own role or deactivate yourself.' };
    }

    // Never orphan the system: keep at least one active SUPER_ADMIN.
    const losingSuperAdmin =
      existing.role === 'SUPER_ADMIN' &&
      existing.isActive &&
      (data.role !== 'SUPER_ADMIN' || !data.isActive);

    const update: Record<string, unknown> = { ...data, updatedAt: new Date() };
    if (password) update.passwordHash = await hashPassword(password);
    try {
      const updated = await db
        .update(users)
        .set(update)
        .where(losingSuperAdmin ? and(eq(users.id, id), anotherActiveSuperAdmin(id)) : eq(users.id, id))
        .returning({ id: users.id });
      if (updated.length === 0) {
        return { ok: false as const, error: losingSuperAdmin ? LAST_ADMIN_ERROR : 'User not found' };
      }
    } catch (error) {
      if (isDeadlock(error)) return { ok: false as const, error: 'Another change was saved at the same time. Please try again.' };
      throw error;
    }
    if (password || !data.isActive) await revokeUserSessions(id);
    await logAudit(actor.id, 'update', 'user', id, data.email);
    return { ok: true as const, id };
  }

  if (!password) return { ok: false as const, error: 'A password is required for new users.' };
  const data = { ...rest, isActive: requestedActive ?? true };
  const dupe = await db.query.users.findFirst({ where: eq(users.email, data.email) });
  if (dupe) return { ok: false as const, error: 'A user with this email already exists.' };

  const [row] = await db
    .insert(users)
    .values({ ...data, passwordHash: await hashPassword(password) })
    .returning({ id: users.id });
  await logAudit(actor.id, 'create', 'user', row.id, data.email);
  return { ok: true as const, id: row.id };
}

export async function deleteUser(id: string) {
  const actor = await requireUser('users:write');
  if (actor.id === id) return { ok: false as const, error: 'You cannot delete your own account.' };
  const existing = await db.query.users.findFirst({ where: eq(users.id, z.string().uuid().parse(id)) });
  if (!existing) return { ok: false as const, error: 'User not found' };
  const guarded = existing.role === 'SUPER_ADMIN' && existing.isActive;
  try {
    const deleted = await db
      .delete(users)
      .where(guarded ? and(eq(users.id, id), anotherActiveSuperAdmin(id)) : eq(users.id, id))
      .returning({ id: users.id });
    if (deleted.length === 0) {
      return { ok: false as const, error: guarded ? LAST_ADMIN_ERROR : 'User not found' };
    }
  } catch (error) {
    if (isDeadlock(error)) return { ok: false as const, error: 'Another change was saved at the same time. Please try again.' };
    throw error;
  }
  await logAudit(actor.id, 'delete', 'user', id, existing.email);
  return { ok: true as const };
}

export async function signOutUserEverywhere(id: string) {
  const actor = await requireUser('users:write');
  await revokeUserSessions(z.string().uuid().parse(id));
  await logAudit(actor.id, 'update', 'user_sessions', id, 'revoked all sessions');
  return { ok: true as const };
}
