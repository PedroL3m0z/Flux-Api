import { timingSafeEqual } from 'node:crypto';

/**
 * Constant-time string comparison for secrets (API keys, tokens). A plain `===`
 * short-circuits on the first differing byte, leaking — through response time —
 * how much of a guessed value is correct. This compares in time independent of
 * the contents. A length mismatch returns early: the length of a secret is not
 * itself sensitive, and `timingSafeEqual` requires equal-length buffers.
 */
export function safeEqual(
  a: string | undefined,
  b: string | undefined,
): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) {
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}
