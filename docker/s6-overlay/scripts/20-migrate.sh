#!/command/with-contenv sh
# Apply pending Prisma migrations before the API starts. Idempotent.
set -e

cd /app
echo "[migrate] prisma migrate deploy..."
su-exec node yarn prisma migrate deploy --schema=src/core/prisma/schema.prisma
