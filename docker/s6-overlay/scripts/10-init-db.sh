#!/command/with-contenv sh
# Wait for Postgres to accept connections, then create the app database once.
# The 'flux' role is the initdb superuser (there is no 'postgres' role), so
# every client connects with -U flux.
set -e

echo "[init-db] waiting for postgres..."
i=0
until su-exec postgres pg_isready -h 127.0.0.1 -U flux -q; do
  i=$((i + 1))
  if [ "$i" -gt 60 ]; then
    echo "[init-db] postgres did not become ready in time" >&2
    exit 1
  fi
  sleep 1
done

if ! su-exec postgres psql -h 127.0.0.1 -U flux -d postgres -tAc \
  "SELECT 1 FROM pg_database WHERE datname='flux'" | grep -q 1; then
  echo "[init-db] creating database 'flux'"
  su-exec postgres createdb -h 127.0.0.1 -U flux -O flux flux
fi
