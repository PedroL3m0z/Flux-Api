#!/bin/sh
set -e

# DATA_DIR holds the persisted secrets file (and anything else the app writes).
# Some hosts mount a fresh, root-owned volume over it, which masks the
# build-time `chown node:node /data` and leaves the unprivileged runtime user
# unable to write (EACCES on secrets.json -> crash loop). When started as root,
# take ownership of DATA_DIR, then drop to `node` and re-exec this same script.
DATA_DIR="${DATA_DIR:-/data}"
if [ "$(id -u)" = "0" ]; then
  mkdir -p "$DATA_DIR"
  chown -R node:node "$DATA_DIR"
  exec su-exec node "$0" "$@"
fi

# Apply pending database migrations before the app starts. Idempotent:
# `migrate deploy` only runs migrations that haven't been applied yet.
echo "Running prisma migrate deploy..."
yarn prisma migrate deploy --schema=src/core/prisma/schema.prisma

echo "Starting API..."
exec node dist/main.js
