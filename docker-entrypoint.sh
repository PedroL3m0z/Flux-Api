#!/bin/sh
set -e

# Apply pending database migrations before the app starts. Idempotent:
# `migrate deploy` only runs migrations that haven't been applied yet.
echo "Running prisma migrate deploy..."
yarn prisma migrate deploy --schema=src/core/prisma/schema.prisma

echo "Starting API..."
exec node dist/main.js
