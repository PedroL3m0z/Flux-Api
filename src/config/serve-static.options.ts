import { join } from 'node:path';
import type { ServeStaticModuleOptions } from '@nestjs/serve-static';

/**
 * Serve the built Vue client (client/dist) under /dashboard.
 * serveRoot scopes it so it never shadows the API routes (/auth, /health),
 * and static files are served by middleware so they bypass the global JWT guard.
 *
 * Shared with the e2e test so both use the exact same config.
 */
export const dashboardStaticOptions: ServeStaticModuleOptions = {
  rootPath: join(process.cwd(), 'client', 'dist'),
  serveRoot: '/dashboard',
};
