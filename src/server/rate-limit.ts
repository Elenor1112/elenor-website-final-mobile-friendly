import 'server-only';
import { lt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { rateLimits } from '@/db/schema';
import type { RateLimitResult } from '@/server/ai/chat/rate-limit';

/**
 * Fixed-window rate limiter backed by Postgres, so the limit holds across
 * every serverless instance (the in-memory limiter in ai/chat/rate-limit.ts
 * only sees one). Each hit is a single atomic upsert, which is race-free on
 * the Neon HTTP driver without a transaction.
 */
export async function hitRateLimit(
  key: string,
  options: { limit: number; windowMs: number },
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / options.windowMs) * options.windowMs);

  const [row] = await db
    .insert(rateLimits)
    .values({ key, windowStart })
    .onConflictDoUpdate({
      target: [rateLimits.key, rateLimits.windowStart],
      set: { count: sql`${rateLimits.count} + 1` },
    })
    .returning({ count: rateLimits.count });

  // Prune expired windows now and then rather than on every request.
  if (Math.random() < 0.01) {
    await db
      .delete(rateLimits)
      .where(lt(rateLimits.windowStart, new Date(now - 24 * 60 * 60 * 1000)))
      .catch(() => undefined);
  }

  const count = row?.count ?? 1;
  const remaining = options.limit - count;
  if (remaining < 0) {
    const resetAt = windowStart.getTime() + options.windowMs;
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
    };
  }
  return { allowed: true, remaining, retryAfterSeconds: 0 };
}

/** Client IP as reported by the platform proxy (Vercel overwrites
 *  x-forwarded-for, so the first entry is the real client). */
export function clientIp(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  );
}
