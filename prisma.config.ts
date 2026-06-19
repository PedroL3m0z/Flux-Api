import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';
import { deriveDatabaseUrl } from './src/config/runtime-config';

// Prisma 7: connection URL lives here (no longer in schema.prisma).
// The runtime PrismaClient uses the PrismaPg driver adapter (see PrismaService);
// the CLI (migrate/studio) uses the datasource.url below.

// Mirror the app's behavior: when DATABASE_URL is absent, derive it from the
// POSTGRES_* parts (or the bundled defaults) so CLI commands work zero-config.
if (!process.env.DATABASE_URL?.trim()) {
  process.env.DATABASE_URL = deriveDatabaseUrl();
}

export default defineConfig({
  schema: 'src/core/prisma/schema.prisma',
  migrations: {
    path: 'src/core/prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
