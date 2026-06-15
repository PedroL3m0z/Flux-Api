import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// Prisma 7: connection URL lives here (no longer in schema.prisma).
// The runtime PrismaClient uses the PrismaPg driver adapter (see PrismaService);
// the CLI (migrate/studio) uses the datasource.url below.
export default defineConfig({
  schema: 'src/core/prisma/schema.prisma',
  migrations: {
    path: 'src/core/prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
