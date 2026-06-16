/**
 * Resolves the CORS `origin` option from config.
 *
 * Fails fast on an insecure production setup: a wildcard origin combined with
 * `credentials: true` reflects any caller's origin, which must never happen in
 * production. In non-production it stays permissive for convenience.
 */
export function resolveCorsOrigin(
  nodeEnv: string | undefined,
  corsOrigin: string,
): boolean | string[] {
  if (corsOrigin === '*') {
    if (nodeEnv === 'production') {
      throw new Error(
        'Refusing to start: set CORS_ORIGIN to explicit origins in production; ' +
          'wildcard "*" with credentials enabled is insecure.',
      );
    }
    return true;
  }
  return corsOrigin.split(',').map((o) => o.trim());
}
