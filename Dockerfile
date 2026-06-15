# ---- Build stage ----
FROM node:26-alpine AS builder

WORKDIR /app

# argon2 is a native module; build toolchain needed during install
RUN apk add --no-cache python3 make g++

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .

# Generate Prisma client (schema lives in src/prisma) + compile TypeScript
RUN yarn prisma generate
RUN yarn build

# ---- Production stage ----
FROM node:26-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache python3 make g++

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production && yarn cache clean

# Compiled app (includes the generated Prisma client under dist/prisma/generated).
COPY --from=builder /app/dist ./dist
# Schema + prisma config kept for `prisma migrate deploy` at release time.
COPY --from=builder /app/src/core/prisma ./src/core/prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

EXPOSE 3000

CMD ["node", "dist/main.js"]
