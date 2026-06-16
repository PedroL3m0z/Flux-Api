# ---- Build stage ----
FROM node:26-alpine AS builder

WORKDIR /app

# argon2 is a native module; build toolchain needed during install
RUN apk add --no-cache python3 make g++

# node:26-alpine ships neither yarn nor corepack; install yarn classic
RUN npm install -g yarn

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .

# Generate Prisma client (schema lives in src/prisma) + compile TypeScript.
# prisma.config.ts resolves DATABASE_URL eagerly; generate needs no real DB,
# so a build-time placeholder is enough.
RUN DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" yarn prisma generate
RUN yarn build

# Build the Vue client (served by the backend under /dashboard).
RUN npm --prefix client ci && npm --prefix client run build

# ---- Production stage ----
FROM node:26-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache python3 make g++

# node:26-alpine ships neither yarn nor corepack; install yarn classic
RUN npm install -g yarn

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production && yarn cache clean

# Compiled app (includes the generated Prisma client under dist/prisma/generated).
COPY --from=builder /app/dist ./dist
# Built Vue client served at /dashboard via @nestjs/serve-static.
COPY --from=builder /app/client/dist ./client/dist
# Schema + prisma config kept for `prisma migrate deploy` at release time.
COPY --from=builder /app/src/core/prisma ./src/core/prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

EXPOSE 3000

CMD ["node", "dist/main.js"]
