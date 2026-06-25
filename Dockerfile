# Multi-target image.
#
#   docker build -t flux-api .                      # default -> all-in-one
#   docker build --target allinone -t flux-api .    # all-in-one (explicit)
#   docker build --target production -t flux-api .  # API only (compose/k8s)
#
# - production : just the NestJS API (Postgres + Redis run as separate services,
#                see docker-compose.yml). Use this for scalable deployments.
# - allinone   : API + PostgreSQL + Redis in one container, supervised by
#                s6-overlay. For self-hosted distribution / easy download.

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

# ---- Production stage (API only) ----
FROM node:26-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# tini: real PID 1 so SIGTERM is forwarded for a clean, fast shutdown.
# su-exec: drop from root to `node` in the entrypoint after fixing volume perms.
RUN apk add --no-cache tini su-exec

# node:26-alpine ships neither yarn nor corepack; install yarn classic
RUN npm install -g yarn

COPY package.json yarn.lock ./
COPY client/package.json ./client/
# argon2 is a native module: the build toolchain is needed only to compile it
# during install. Install it as a virtual package and drop it afterwards so the
# compiler (~150 MB) never lands in the final image.
RUN apk add --no-cache --virtual .build-deps python3 make g++ \
  && yarn install --frozen-lockfile --production \
  && yarn cache clean \
  && apk del .build-deps

# Compiled app (includes the generated Prisma client under dist/prisma/generated).
COPY --from=builder --chown=node:node /app/dist ./dist
# Built Vue client served at /dashboard via @nestjs/serve-static.
COPY --from=builder --chown=node:node /app/client/dist ./client/dist
# Schema + migrations + prisma config for `prisma migrate deploy` at startup.
COPY --from=builder --chown=node:node /app/src/core/prisma ./src/core/prisma
COPY --from=builder --chown=node:node /app/prisma.config.ts ./prisma.config.ts
# prisma.config.ts imports the zero-config DATABASE_URL derivation from here.
COPY --from=builder --chown=node:node /app/src/config ./src/config

# Entrypoint runs migrations, then starts the app.
COPY --chown=node:node docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Persisted secrets / data dir (DATA_DIR=/data), owned by the runtime user so a
# fresh named-volume mount inherits writable permissions for the non-root user.
RUN mkdir -p /data && chown node:node /data

# NOTE: the container starts as root so the entrypoint can chown DATA_DIR when a
# host mounts a root-owned volume over it (build-time ownership is masked by the
# mount). docker-entrypoint.sh immediately drops to the unprivileged `node` user
# via su-exec, so the app itself never runs as root.

EXPOSE 3000

# tini reaps zombies and forwards signals to the entrypoint shell.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["./docker-entrypoint.sh"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

# ---- All-in-one stage (API + PostgreSQL + Redis, default target) ----
# Single-container appliance for self-hosted distribution. NOT for scalable
# production — no service isolation, a restart cycles every process. For scale
# use --target production + docker-compose.yml.
FROM node:26-alpine AS allinone

WORKDIR /app

# Everything talks over loopback inside the single container. JWT_SECRET/API_KEY
# are auto-generated and persisted under DATA_DIR on first boot (zero-config).
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

# --- s6-overlay: real PID 1 that supervises the three processes ---
ARG S6_OVERLAY_VERSION=3.2.0.2
ARG TARGETARCH=amd64
ADD https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-noarch.tar.xz /tmp/s6-noarch.tar.xz
RUN tar -C / -Jxpf /tmp/s6-noarch.tar.xz
RUN set -e; \
    case "$TARGETARCH" in \
      amd64) S6_ARCH=x86_64 ;; \
      arm64) S6_ARCH=aarch64 ;; \
      arm)   S6_ARCH=armhf ;; \
      *)     S6_ARCH=x86_64 ;; \
    esac; \
    wget -qO /tmp/s6-arch.tar.xz "https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-${S6_ARCH}.tar.xz"; \
    tar -C / -Jxpf /tmp/s6-arch.tar.xz; \
    rm -f /tmp/s6-*.tar.xz

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
