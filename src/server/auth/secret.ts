import 'server-only';
import { createHash, timingSafeEqual } from 'crypto';

/** Constant-time string comparison. Hashing first equalises lengths, so the
 *  comparison leaks neither content nor length. */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** True only when `expected` is configured and `provided` matches it. */
export function secretMatches(provided: string | null | undefined, expected: string | undefined): boolean {
  return Boolean(expected) && typeof provided === 'string' && safeEqual(provided, expected!);
}
