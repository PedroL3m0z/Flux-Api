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

# ---- Production stage ----
FROM node:26-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache python3 make g++

# node:26-alpine ships neither yarn nor corepack; install yarn classic
RUN npm install -g yarn

COPY package.json yarn.lock ./
COPY client/package.json ./client/
RUN yarn install --frozen-lockfile --production && yarn cache clean

# Compiled app (includes the generated Prisma client under dist/prisma/generated).
COPY --from=builder /app/dist ./dist
# Built Vue client served at /dashboard via @nestjs/serve-static.
COPY --from=builder /app/client/dist ./client/dist
# Schema + migrations + prisma config for `prisma migrate deploy` at startup.
COPY --from=builder /app/src/core/prisma ./src/core/prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Entrypoint runs migrations, then starts the app.
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000

CMD ["./docker-entrypoint.sh"]
