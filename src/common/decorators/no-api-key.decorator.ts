import { SetMetadata } from '@nestjs/common';

export const NO_API_KEY = 'noApiKey';

/**
 * Exempts a route from the global API-key requirement. Used for the auth
 * bootstrap endpoints (e.g. /auth/me) that must be reachable after login but
 * before the user has supplied the API key.
 */
export const NoApiKey = () => SetMetadata(NO_API_KEY, true);
