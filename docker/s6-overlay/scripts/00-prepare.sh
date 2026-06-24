#!/command/with-contenv sh
# One-time data-dir prep: create + own the persisted dirs and, on a fresh
# volume, initialize the Postgres cluster (trust auth on loopback only — the
# database is unreachable outside this container).
set -e

mkdir -p "$PGDATA" /data/redis "$DATA_DIR"
chown -R postgres:postgres "$PGDATA"
chown -R redis:redis /data/redis
chown -R node:node "$DATA_DIR"

if [ ! -s "$PGDATA/PG_VERSION" ]; then
  echo "[prepare] initializing postgres cluster at $PGDATA"
  su-exec postgres initdb -D "$PGDATA" \
    --username=flux --auth=trust --encoding=UTF8 >/dev/null
  printf "listen_addresses = '127.0.0.1'\nunix_socket_directories = '/tmp'\n" \
    >> "$PGDATA/postgresql.conf"
  echo "host all all 127.0.0.1/32 trust" >> "$PGDATA/pg_hba.conf"
fi
