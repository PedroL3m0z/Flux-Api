import type { CookieOptions } from 'express';

/** Name of the httpOnly cookie that carries the JWT. */
export const ACCESS_TOKEN_COOKIE = 'access_token';

/**
 * Cookie options for the access token. httpOnly keeps it out of JS (XSS-safe);
 * sameSite=lax is enough for a same-origin SPA; secure only in production.
 */
export function accessTokenCookieOptions(
  maxAgeMs: number,
  secure: boolean,
): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: maxAgeMs,
  };
}

/** Parse a JWT-style expiry ("3600s", "15m", "2h", "7d") into milliseconds. */
export function expiresInToMs(value: string, fallbackMs = 3_600_000): number {
  const match = /^(\d+)\s*([smhd])?$/.exec(value.trim());
  if (!match) {
    return fallbackMs;
  }
  const amount = Number(match[1]);
  const unit = match[2] ?? 's';
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return amount * multipliers[unit];
}
