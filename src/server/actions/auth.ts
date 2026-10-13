'use server';

import { and, eq, gte, sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { z } from 'zod';
import { db } from '@/db';
import { auditLogs, users } from '@/db/schema';
import { verifyPassword } from '@/server/auth/password';
import { createSession, destroySession } from '@/server/auth/session';
import { safeInternalPath } from '@/lib/validation/url';

export type LoginState = { ok: boolean; message: string };

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
  next: z.string().optional(),
});

const GENERIC_ERROR = 'Invalid email or password.';
const THROTTLED_ERROR = 'Too many failed sign-in attempts. Please wait 15 minutes and try again.';

// Brute-force throttle, stored in audit_logs so it holds across serverless
// instances. Applied identically to known and unknown emails, so it reveals
// nothing about which accounts exist. Each attempt is recorded *before* the
// count (and removed again on success), so parallel requests see each other
// and a burst cannot slip extra guesses past the limit.
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES_PER_EMAIL = 5;
const MAX_FAILURES_PER_IP = 20;

async function isThrottled(email: string, ip: string | null): Promise<boolean> {
  const [row] = await db
    .select({
      byEmail: sql<number>`count(*) filter (where ${auditLogs.entityLabel} = ${email})`,
      byIp: ip ? sql<number>`count(*) filter (where ${auditLogs.entityId} = ${ip})` : sql<number>`0`,
    })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.action, 'login_failed'),
        gte(auditLogs.createdAt, new Date(Date.now() - FAILURE_WINDOW_MS)),
      ),
    );
  return (
    Number(row?.byEmail ?? 0) > MAX_FAILURES_PER_EMAIL || Number(row?.byIp ?? 0) > MAX_FAILURES_PER_IP
  );
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    next: formData.get('next') ?? undefined,
  });
  if (!parsed.success) {
    await sleep(200);
    return { ok: false, message: GENERIC_ERROR };
  }

  const { email, password } = parsed.data;
  const h = headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || null;

  const user = await db.query.users.findFirst({ where: eq(users.email, email) });

  const [attempt] = await db
    .insert(auditLogs)
    .values({
      userId: user?.id ?? null,
      action: 'login_failed',
      entityType: 'session',
      entityId: ip ?? '',
      entityLabel: email,
    })
    .returning({ id: auditLogs.id });

  if (await isThrottled(email, ip)) {
    await sleep(200);
    return { ok: false, message: THROTTLED_ERROR };
  }

  const valid = await verifyPassword(password, user?.passwordHash ?? null);
  if (!user || !user.isActive || !valid) {
    await sleep(200);
    return { ok: false, message: GENERIC_ERROR };
  }

  await db.delete(auditLogs).where(eq(auditLogs.id, attempt.id));

  await createSession(user.id, {
    ip,
    userAgent: h.get('user-agent'),
  });

  await db.insert(auditLogs).values({
    userId: user.id,
    action: 'login',
    entityType: 'session',
    entityLabel: user.email,
  });

  // Only allow internal admin destinations — never an open redirect.
  const next = safeInternalPath(parsed.data.next, '/admin');
  redirect(next.startsWith('/admin') ? next : '/admin');
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect('/admin/login');
}
