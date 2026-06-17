import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { DashboardController } from './dashboard.controller';

/**
 * Serves the built Vue client (client/dist) as a static SPA under /dashboard.
 *
 * serveRoot scopes it so it never shadows the API routes (/auth, /health), and
 * the files are served by middleware so they bypass the global JWT guard (the
 * dashboard is public). The client must be built first (`yarn build:client`).
 */
@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'client', 'dist'),
      serveRoot: '/dashboard',
    }),
  ],
  controllers: [DashboardController],
})
export class DashboardModule {}
