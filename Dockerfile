# The Flux Docker image.
#
#   docker build -t flux-api .
#
# A single self-contained image: the API, PostgreSQL and Redis run together in
# one container, supervised by s6-overlay. Bring nothing else — just mount a
# volume at /data to persist the database and generated secrets.

# ---- Build stage ----
FROM node:26-alpine AS builder

WORKDIR /app

# argon2 is a native module; build toolchain needed during install
RUN apk add --no-cache python3 make g++

# node:26-alpine ships neither yarn nor corepack; install yarn classic
RUN npm install -g yarn

# Workspaces: root + client manifests so a single install resolves both.
COPY package.json yarn.lock ./
COPY client/package.json ./client/
RUN yarn install --frozen-lockfile

COPY . .

# Generate Prisma client (schema lives in src/prisma) + compile TypeScript.
# prisma.config.ts resolves DATABASE_URL eagerly; generate needs no real DB,
# so a build-time placeholder is enough.
RUN DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" yarn prisma generate
RUN yarn build

# Build the Vue client (served by the backend under /dashboard).
RUN yarn build:client

# ---- Runtime image (API + PostgreSQL + Redis, supervised by s6-overlay) ----
# Everything talks over loopback inside the single container; a restart cycles
# every process. s6-overlay runs as PID 1 (root) and drops privileges per
# service via su-exec.
FROM node:26-alpine AS runtime

WORKDIR /app

# JWT_SECRET/API_KEY are auto-generated and persisted under DATA_DIR on first
# boot (zero-config).
ENV NODE_ENV=production \
    PORT=3000 \
    PGDATA=/data/postgres \
    DATA_DIR=/data/app \
    DATABASE_URL=postgresql://flux@127.0.0.1:5432/flux?schema=public \
    REDIS_HOST=127.0.0.1 \
    REDIS_PORT=6379 \
    CORS_ORIGIN=http://localhost:3000 \
    S6_BEHAVIOUR_IF_STAGE2_FAILS=2 \
    S6_CMD_WAIT_FOR_SERVICES_MAXTIME=0

# Bundled services + helpers. su-exec drops privileges per service; xz extracts
# the s6-overlay tarballs.
RUN apk add --no-cache postgresql17 postgresql17-client redis su-exec xz

RUN npm install -g yarn

# --- s6-overlay: real PID 1 that supervises the three processes (amd64 only) ---
ARG S6_OVERLAY_VERSION=3.2.0.2
ADD https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-noarch.tar.xz /tmp/s6-noarch.tar.xz
ADD https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-x86_64.tar.xz /tmp/s6-x86_64.tar.xz
RUN tar -C / -Jxpf /tmp/s6-noarch.tar.xz \
  && tar -C / -Jxpf /tmp/s6-x86_64.tar.xz \
  && rm -f /tmp/s6-*.tar.xz

# --- Production node deps (argon2 toolchain installed then dropped) ---
COPY package.json yarn.lock ./
COPY client/package.json ./client/
RUN apk add --no-cache --virtual .build-deps python3 make g++ \
  && yarn install --frozen-lockfile --production \
  && yarn cache clean \
  && apk del .build-deps

# --- App artifacts ---
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/src/core/prisma ./src/core/prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/src/config ./src/config

# --- s6 service tree (merges onto the s6-overlay base under /etc/s6-overlay) ---
COPY docker/s6-overlay /etc/s6-overlay
RUN chmod -R +x /etc/s6-overlay/scripts \
  && chmod +x /etc/s6-overlay/s6-rc.d/postgres/run \
              /etc/s6-overlay/s6-rc.d/redis/run \
              /etc/s6-overlay/s6-rc.d/api/run

EXPOSE 3000
VOLUME ["/data"]

# s6-overlay runs as PID 1 (root) and drops privileges per service via su-exec.
ENTRYPOINT ["/init"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1
