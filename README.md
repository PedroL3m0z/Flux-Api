<p align="center">
  <img src="./docs/assets/logo.png" alt="Flux API Gateway" width="360" />
</p>

# Flux API

[![CI](https://github.com/PedroL3m0z/Flux-Api/actions/workflows/ci.yml/badge.svg)](https://github.com/PedroL3m0z/Flux-Api/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
[![NestJS](https://img.shields.io/badge/NestJS-11-e0234e.svg)](https://nestjs.com)
[![Prisma](https://img.shields.io/badge/Prisma-7-2d3748.svg)](https://www.prisma.io)

Gateway HTTP para Telegram em NestJS 11 com Prisma 7 (PostgreSQL), Redis, healthchecks (Terminus), segurança (Helmet, CORS, Rate Limiting, API Key, JWT), autenticação multi-método e dashboard Vue para gerenciar instâncias Telegram, chats e mensagens em tempo real.

## Funcionalidades

### Autenticação & Autorização
- **Registro/Login**: Usuário + senha com hash Argon2id
- **JWT**: Bearer token com refresh automático
- **API Key**: `x-api-key` para acesso programático
- **Multi-usuário**: Isolamento de dados por usuário (instâncias, diretório de usuários)

### Integração Telegram (GramJS)
- **Gerenciamento de instâncias**: Criar, listar, deletar instâncias Telegram por usuário
- **Login QR**: Escanear código QR com Telegram (live streaming via SSE)
- **2FA**: Suporte a dois fatores (senha via formulário durante QR)
- **Reautenticação automática**: Reconexão ao iniciar com sessão persistida
- **Credenciais globais + por-instância**: `api_id`/`api_hash` definidos em Configurações (com fallback por-instância)

### Sync de Chats & Mensagens
- **Backfill**: Popula diálogos (chats) e contatos ao autorizar instância
- **Histórico on-demand**: REST para listar mensagens antigas (paginado)
- **Realtime**: Webhook SSE para novas mensagens conforme chegam
- **Envio**: POST para enviar mensagens via instância
- **Relações**: Chats ↔ Mensagens ↔ Contatos com integridade referencial (Postgres)

### Dashboard SPA (Vue 3 + TypeScript)
- **Overview**: Uptime do sistema, contagem e saúde de instâncias
- **Instâncias**: Criar, conectar via QR, gerenciar (label, engine, status)
- **Chats**: Listar dialógos, ler histórico, enviar mensagens, realtime
- **Usuários**: Admin CRUD de contas do dashboard
- **Configurações**: Definir `api_id`/`api_hash`, testar `x-api-key`
- **Ajuda**: Guia passo-a-passo de uso
- **Localização**: English + Português (BR)

### Segurança & Observabilidade
- **Rate Limiting**: Throttling global por IP
- **CORS**: Configurável (padrão: localhost)
- **Helmet**: Headers de segurança (CSP, X-Frame-Options, etc.)
- **Healthcheck**: Status Postgres + Redis + memória em `/health`
- **Criptografia**: `api_hash` cifrado em repouso (AES-256-GCM)
- **BigInt**: IDs Telegram (int64) serializados como string na API

## Stack

| Recurso        | Lib                                                     |
| -------------- | ------------------------------------------------------- |
| **Runtime**    | Node.js 22 + TypeScript                                |
| **Framework**  | NestJS 11 (inverso de controle, decoradores)           |
| **ORM**        | Prisma 7 + PostgreSQL 17 (schema-first)                |
| **Cache**      | Redis 7 (sessão Telegram, cache)                       |
| **Auth**       | `@nestjs/passport` (local, jwt, api-key) + `@nestjs/jwt` + `argon2` |
| **API Docs**   | OpenAPI + Scalar UI                                    |
| **Frontend**   | Vue 3 + TypeScript + Tailwind CSS + Shadcn Vue         |
| **Realtime**   | Server-Sent Events (SSE)                               |
| **Telegram**   | GramJS (MTProto client library)                        |
| **Healthcheck**| `@nestjs/terminus` (liveness, readiness)              |
| **Throttle**   | `@nestjs/throttler`                                    |
| **CI/CD**      | GitHub Actions (build, lint, test, e2e)               |

## Modelos de Dados

```
User
├── instances[] (Instances owned by user)
├── (implicit: all chats/contacts/messages via instance)

Setting
├── key (string, PK) → telegram.apiId, telegram.apiHash

Instance (per-user Telegram account)
├── id (uuid, PK)
├── ownerId (FK User, onDelete: Cascade)
├── label (human-readable name)
├── engine ('gramjs')
├── status (new, connecting, awaiting_qr, password_required, authorized, disconnected, error)
├── apiId (optional override)
├── apiHashEnc (encrypted, never returned)
├── tgUserId (Telegram int64, nullable until authorized)
├── username, phone (metadata)
├── chats[]
├── contacts[]
├── messages[]

Chat (dialog/conversation)
├── id (uuid, PK)
├── instanceId (FK Instance)
├── tgPeerId (Telegram int64)
├── type (user, group, channel)
├── accessHash (Telegram peer reference)
├── title, username (metadata)
├── lastMessageAt (for sorting)
├── messages[]

Contact (Telegram user/participant)
├── id (uuid, PK)
├── instanceId (FK Instance)
├── tgUserId (Telegram int64)
├── accessHash (needed for peer resolution)
├── firstName, lastName, username, phone (metadata)
├── isContact (starred/saved)
├── messages[] (sent by this contact)

Message (chat message)
├── id (uuid, PK)
├── instanceId, chatId (FK Instance, Chat)
├── tgMessageId (Telegram int64)
├── senderId (FK Contact, nullable if system/anonymous)
├── outgoing (boolean)
├── text, mediaType, mediaRef (content)
├── date, editedAt (timestamps)
├── replyToTgId (quote/reply)
```

## API Endpoints

### Autenticação
| Rota                      | Método | Auth        | Descrição                          |
| ------------------------- | ------ | ----------- | ---------------------------------- |
| `/auth/register`          | POST   | pública     | Cria usuário (email, senha)        |
| `/auth/login`             | POST   | pública     | JWT para user + senha              |
| `/auth/me`                | GET    | Bearer JWT  | Usuário autenticado atual          |
| `/auth/api-key-check`     | GET    | `x-api-key` | Valida API key (exemplo protegido) |

### Sistema
| Rota                      | Método | Auth        | Descrição                          |
| ------------------------- | ------ | ----------- | ---------------------------------- |
| `/`                       | GET    | pública     | Hello                              |
| `/health`                 | GET    | pública     | Status postgres + redis + memória  |
| `/docs`                   | GET    | pública     | Scalar API Reference (OpenAPI)     |
| `/dashboard`              | GET    | pública     | SPA Vue                            |

### Telegram: Settings
| Rota                      | Método | Auth        | Descrição                                      |
| ------------------------- | ------ | ----------- | ---------------------------------------------- |
| `/telegram/settings`      | GET    | Bearer JWT  | Lê `api_id`/`hasApiHash` (api_hash nunca sai)  |
| `/telegram/settings`      | PUT    | Bearer JWT  | Define global `api_id`/`api_hash`              |
| `/telegram/stats`         | GET    | Bearer JWT  | Uptime + total/authorized/connected instances  |

### Telegram: Instâncias
| Rota                              | Método | Auth        | Descrição                                 |
| --------------------------------- | ------ | ----------- | ----------------------------------------- |
| `/telegram/instances`             | GET    | Bearer JWT  | Lista instâncias do usuário               |
| `/telegram/instances`             | POST   | Bearer JWT  | Cria instância (label, engine)            |
| `/telegram/instances/:id`         | GET    | Bearer JWT  | Instância específica                      |
| `/telegram/instances/:id`         | DELETE | Bearer JWT  | Deleta instância + sessão                 |
| `/telegram/instances/:id/login/qr` | SSE   | Bearer JWT  | Stream QR: `qr` → `password_required` → `authorized` |
| `/telegram/instances/:id/login/password` | POST | Bearer JWT | Submit 2FA password during QR |

### Telegram: Chats & Mensagens
| Rota                                    | Método | Auth        | Descrição                                    |
| --------------------------------------- | ------ | ----------- | -------------------------------------------- |
| `/telegram/instances/:id/chats`         | GET    | Bearer JWT  | Lista chats (ordenado por atividade recente) |
| `/telegram/instances/:id/chats/:chatId/messages` | GET | Bearer JWT | Lista mensagens (cursor-paginado, newest first) |
| `/telegram/instances/:id/chats/:chatId/messages` | POST | Bearer JWT | Envia mensagem (body: `{text}`) |
| `/telegram/instances/:id/messages/stream` | SSE | Bearer JWT | Realtime: novas mensagens e edições         |

### Usuários (Admin)
| Rota                      | Método | Auth        | Descrição                          |
| ------------------------- | ------ | ----------- | ---------------------------------- |
| `/users`                  | GET    | Bearer JWT  | Lista usuários                     |
| `/users`                  | POST   | Bearer JWT  | Cria usuário (admin)               |
| `/users/:id`              | GET    | Bearer JWT  | Usuário específico                 |
| `/users/:id`              | PATCH  | Bearer JWT  | Atualiza usuário                   |
| `/users/:id`              | DELETE | Bearer JWT  | Deleta usuário                     |

> **Autenticação**: Todos os endpoints Telegram/Usuários requerem `Authorization: Bearer <JWT>`.
> Alternativa: `x-api-key: <key>` (configurado em `API_KEY`).

## Setup

### Pré-requisitos
- Node.js 22+
- Docker + Docker Compose (para Postgres + Redis)
- Git

### Instalação

```bash
# Clone
git clone https://github.com/PedroL3m0z/Flux-Api.git
cd flux-api

# Env
cp .env.example .env
# Edite: JWT_SECRET, API_KEY (gere com `openssl rand -hex 32`)

# Dependências
yarn install

# Prisma client
yarn prisma:generate
```

### Rodar com Docker (recomendado)

```bash
docker compose up -d
# API: http://localhost:3000
# Dashboard: http://localhost:3000/dashboard
# Postgres: localhost:5433 (user: flux, password: flux)
# Redis: localhost:6379
```

### Rodar Local (infra no Docker, app no host)

```bash
# Inicie banco de dados
docker compose up -d postgres redis

# Sincronize schema
yarn prisma db push --schema=src/core/prisma/schema.prisma

# Dev com hot-reload
yarn start:dev
```

### Build para Produção

```bash
# Build backend + frontend
yarn build:all

# Roda app compilada
node dist/main.js
```

## Desenvolvimento

### Scripts

```bash
# Backend
yarn start           # prod
yarn start:dev       # dev com hot-reload
yarn build           # compile TypeScript
yarn lint            # eslint
yarn test            # unit tests
yarn test:e2e        # e2e tests
yarn test:cov        # coverage

# Frontend
cd client
npm run dev          # Vite dev server (http://localhost:5173, proxy /auth, /health)
npm run build        # build to dist/
npm run preview      # preview build

# Prisma
yarn prisma:generate      # gera client (src/core/prisma/generated)
yarn prisma:migrate       # `prisma migrate dev` com migrations)
yarn prisma:studio       # UI Prisma Studio (http://localhost:5555)
```

### Testes

```bash
# Unit: services, guards, resolvers
yarn test

# E2E: fluxo completo (auth, health, seed)
yarn test:e2e

# Cobertura
yarn test:cov
```

### Estrutura

```
flux-api/
├── src/
│   ├── common/              # decoradores, guards, interceptadores
│   ├── core/
│   │   ├── prisma/          # schema, migrations, service
│   │   ├── redis/           # service, tipos
│   │   └── telegram/
│   │       ├── engines/     # abstração: InstanceEngine, GramJsEngine
│   │       ├── services/    # instances, chats, contacts, messages, settings, sync
│   │       ├── telegram.manager.ts    # orquestração lifecycle
│   │       ├── telegram-session.store.ts # persistência sessão Redis
│   │       └── telegram.module.ts     # providers, exports
│   ├── modules/
│   │   ├── auth/            # login, JWT, API key
│   │   ├── users/           # CRUD usuários
│   │   └── telegram/        # controller, DTOs, messaging service
│   ├── app.module.ts        # root
│   └── main.ts              # bootstrap, BigInt shim
├── client/
│   ├── src/
│   │   ├── pages/           # Overview, Instances, Chats, Users, Settings, Help
│   │   ├── components/      # Shadcn Vue
│   │   ├── layouts/         # DashboardLayout (sidebar + header fixos)
│   │   ├── lib/             # API client, utils
│   │   ├── stores/          # Pinia (auth)
│   │   └── router/          # rutas SPA
│   └── vite.config.ts       # base: /dashboard/
├── docker-compose.yml       # postgres:5433, redis:6379, api:3000
├── Dockerfile               # build multistage (client + backend)
├── prisma.config.ts         # Prisma 7 config
└── README.md
```

## Segurança

- **Senhas**: Hash Argon2id, nunca plaintext
- **JWT**: RS256 (HS256 em dev se não configurado)
- **API Key**: Verificado via guard `@ApiBearerAuth()`/`@UseGuards(ApiKeyAuthGuard)`
- **Telegram api_hash**: Cifrado em repouso (AES-256-GCM)
- **Rate Limiting**: Global 100 req/min por IP (skip com `@SkipThrottle()`)
- **CORS**: Whitelist de origins em `.env` (`CORS_ORIGIN`)
- **Helmet**: CSP, X-Frame-Options, X-Content-Type-Options, etc.

## Deployment

### Docker Compose (desenvolvimento/staging)
```bash
docker compose up -d
```

### Docker Hub / Container Registry (produção)
```bash
# Build
docker build -t username/flux-api:v0.1.5 .

# Push
docker push username/flux-api:v0.1.5

# Deploy
docker run -d \
  -e DATABASE_URL="postgresql://user:pass@host:5432/flux" \
  -e REDIS_URL="redis://host:6379" \
  -e JWT_SECRET="..." \
  -e API_KEY="..." \
  -p 3000:3000 \
  username/flux-api:v0.1.5
```

## Documentação

- **API OpenAPI**: `/docs` (Scalar UI)
- **Guia Dashboard**: Seção "Ajuda" no dashboard
- **Contribuição**: [CONTRIBUTING.md](./.github/CONTRIBUTING.md)
- **Código de Conduta**: [CODE_OF_CONDUCT.md](./.github/CODE_OF_CONDUCT.md)
- **Segurança**: [SECURITY.md](./.github/SECURITY.md)
- **Manutenção/Releases**: [docs/MAINTAINING.md](./docs/MAINTAINING.md)

## Roadmap

- [ ] Histórico on-demand (GET `/messages` com paginação reversa)
- [ ] Engine Telegraf (bot API)
- [ ] Participantes de grupo (N↔N)
- [ ] Busca em chats/mensagens
- [ ] Webhooks para eventos Telegram
- [ ] Autenticação OAuth2 (GitHub, Google)
- [ ] Multi-language para dados (Telegram username em diferentes idiomas)

## Contribuindo

Abra issues para bugs e feature requests. PRs bem-vindas. Veja [CONTRIBUTING.md](./.github/CONTRIBUTING.md).

## Licença

[Apache License 2.0](./LICENSE) © Pedro Lemos

---

**Construído com ❤️ em NestJS + Vue + Telegram**
