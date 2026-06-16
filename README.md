# Flux API

[![CI](https://github.com/PedroL3m0z/Flux-Api/actions/workflows/ci.yml/badge.svg)](https://github.com/PedroL3m0z/Flux-Api/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
[![NestJS](https://img.shields.io/badge/NestJS-11-e0234e.svg)](https://nestjs.com)
[![Prisma](https://img.shields.io/badge/Prisma-7-2d3748.svg)](https://www.prisma.io)

Gateway HTTP para Telegram em NestJS 11 com Prisma 7 (PostgreSQL), Redis,
healthchecks (Terminus), segurança (Helmet, CORS, Rate Limiting, API Key,
JWT/usuário+senha, Argon2) e documentação OpenAPI via Scalar.

## Stack

| Recurso        | Lib                                                     |
| -------------- | ------------------------------------------------------- |
| ORM            | `prisma` / `@prisma/client` 7 + `@prisma/adapter-pg`    |
| Cache/Redis    | `ioredis`                                               |
| Healthcheck    | `@nestjs/terminus` (postgres, redis, memory)            |
| Rate limiting  | `@nestjs/throttler`                                     |
| Headers        | `helmet`                                                |
| Auth           | `@nestjs/passport` (local, jwt, api-key) + `@nestjs/jwt`|
| Hash de senha  | `argon2` (argon2id)                                     |
| Docs           | OpenAPI (`@nestjs/swagger`) + UI `@scalar/nestjs-api-reference` |

## Setup

```bash
cp .env.example .env        # ajuste segredos (JWT_SECRET, API_KEY)
yarn install
yarn prisma:generate        # gera o client em src/prisma/generated
```

## Rodar com Docker (Postgres + Redis + API)

```bash
docker compose up -d        # postgres:5432, redis:6379, api:3000
```

## Rodar local (infra no Docker, app no host)

```bash
docker compose up -d postgres redis
yarn prisma db push --schema=src/core/prisma/schema.prisma   # ou: yarn prisma:migrate
yarn start:dev
```

## Endpoints

| Rota                      | Auth        | Descrição                          |
| ------------------------- | ----------- | ---------------------------------- |
| `GET /`                   | pública     | Hello                              |
| `GET /health`             | pública     | Status postgres + redis + memória  |
| `POST /auth/register`     | pública     | Cria usuário (senha via Argon2)    |
| `POST /auth/login`        | user/senha  | Retorna JWT                        |
| `GET /auth/me`            | Bearer JWT  | Usuário atual                      |
| `GET /auth/api-key-check` | `x-api-key` | Exemplo protegido por API key      |
| `GET /docs`               | pública     | Scalar API Reference (OpenAPI)     |

> Todas as rotas são protegidas por JWT global por padrão; use `@Public()`
> para liberar e `@SkipThrottle()` para ignorar o rate limit.

## Prisma

- Schema: `src/core/prisma/schema.prisma`
- Client gerado: `src/core/prisma/generated` (gitignored)
- Connection URL fica em `prisma.config.ts` (Prisma 7), não no schema.
- Em runtime o `PrismaService` usa o driver adapter `PrismaPg`.

## Testes

```bash
yarn test       # unit
yarn test:e2e   # e2e
yarn test:cov   # cobertura
```

## Contribuindo

Veja [CONTRIBUTING.md](./.github/CONTRIBUTING.md) e o
[CODE_OF_CONDUCT.md](./.github/CODE_OF_CONDUCT.md). Vulnerabilidades:
[SECURITY.md](./.github/SECURITY.md). Manutenção/releases:
[docs/MAINTAINING.md](./docs/MAINTAINING.md).

## Licença

[Apache License 2.0](./LICENSE) © Pedro Lemos
