<p align="center">
  <img src="./docs/assets/logo.png" alt="Flux API Gateway" width="360" />
</p>

# Flux API

[![CI](https://github.com/PedroL3m0z/Flux-Api/actions/workflows/ci.yml/badge.svg)](https://github.com/PedroL3m0z/Flux-Api/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
[![NestJS](https://img.shields.io/badge/NestJS-11-e0234e.svg)](https://nestjs.com)
[![Prisma](https://img.shields.io/badge/Prisma-7-2d3748.svg)](https://www.prisma.io)

**Gateway HTTP para Telegram.** Roda contas do Telegram como **instâncias** e as expõe por uma API REST limpa, um stream **realtime (SSE)** e **webhooks** de saída assinados. Construído em NestJS 11 + Prisma 7 (PostgreSQL) + Redis, com dashboard Vue 3 para gerenciar tudo visualmente.

---

## Índice

- [O que é o Flux](#o-que-é-o-flux)
- [Como a aplicação funciona (ponta a ponta)](#como-a-aplicação-funciona-ponta-a-ponta)
- [Arquitetura](#arquitetura)
- [Engines (camada Telegram)](#engines-camada-telegram)
- [Sistema de eventos](#sistema-de-eventos)
- [Webhooks](#webhooks)
- [Autenticação & segurança](#autenticação--segurança)
- [Permissões & acesso](#permissões--acesso)
- [Modelo de dados](#modelo-de-dados)
- [Tipos & contratos da API](#tipos--contratos-da-api)
- [Endpoints](#endpoints)
- [Dashboard (SPA Vue)](#dashboard-spa-vue)
- [Stack](#stack)
- [Setup](#setup)
- [Desenvolvimento](#desenvolvimento)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Deployment](#deployment)
- [Roadmap](#roadmap)

---

## O que é o Flux

O Flux conecta uma ou mais contas do Telegram (via MTProto) e transforma cada uma numa **instância** gerenciável por HTTP. Com ele você consegue:

- Conectar contas por **QR code + 2FA**, com a sessão persistida e reconexão automática.
- **Ler chats e histórico**, **enviar mensagens e mídia**, e baixar avatares/anexos.
- Receber **eventos em tempo real** (mensagens novas/editadas/apagadas, recibos de leitura, reações, status da sessão) por SSE **e** por **webhooks** duráveis e assinados.
- Operar tudo por um **dashboard** ou direto pela **API** (com OpenAPI/Scalar em `/docs`).

---

## Como a aplicação funciona (ponta a ponta)

O caminho de uma mensagem, do Telegram até o seu sistema:

```
                  ┌─────────────────────────────────────────────────────────┐
   Telegram       │                        Flux API                          │
  (MTProto)       │                                                          │
      │           │   ┌──────────┐   onEvent   ┌──────────────────┐         │
      │  updates   │   │  Engine  │ ──────────► │ TelegramSync     │         │
      ├───────────►│   │ (GramJS) │             │ Service          │         │
      │           │   └──────────┘             │  • persiste msg  │         │
      │           │                            │  • publica evento│         │
      │           │                            └────────┬─────────┘         │
      │           │                                     │ DomainEvent       │
      │           │                            ┌────────▼─────────┐         │
      │           │   session.status ─────────►│ TelegramEventBus │         │
      │           │   (TelegramManager)        │   (RxJS Subject) │         │
      │           │                            └───┬──────────┬───┘         │
      │           │                                │          │             │
      │           │              ┌─────────────────▼──┐   ┌───▼───────────┐ │
      │           │              │ SSE stream         │   │ Webhook        │ │
      │           │              │ (/messages/stream) │   │ Dispatcher     │ │
      │           │              └────────────────────┘   └───┬───────────┘ │
      │           │                                           │ cria        │
      │           │                                  ┌────────▼─────────┐   │
      │           │                                  │ WebhookDelivery  │   │
      │           │                                  │ (outbox Postgres)│   │
      │           │                                  └────────┬─────────┘   │
      │           │                                  ┌────────▼─────────┐   │
      │           │                                  │ Delivery Worker  │   │
      │           │                                  │ (POST + HMAC +   │───┼──► seu endpoint
      │           │                                  │  retry/backoff)  │   │
      │           │                                  └──────────────────┘   │
      └───────────┘                                                          │
                  └─────────────────────────────────────────────────────────┘
```

1. **Conexão** — O `TelegramManager` resolve a **engine** da instância (ex.: GramJS), conecta usando a sessão salva no Redis e, se necessário, conduz o login por QR/2FA.
2. **Captura** — A engine assina os updates do Telegram e os normaliza num `NormalizedEvent` engine-agnóstico, entregue via `onEvent`.
3. **Sync** — O `TelegramSyncService` persiste mensagens novas/editadas no Postgres e publica um `DomainEvent` no barramento. O `TelegramManager` publica `session.status` nas transições de ciclo de vida.
4. **Fan-out** — O `TelegramEventBus` (RxJS) distribui o evento para dois consumidores: o **stream SSE** (entrega ao dashboard/cliente) e o **WebhookDispatcher**.
5. **Entrega durável** — O dispatcher cria uma linha `WebhookDelivery` (outbox) por webhook que casa (instância vinculada ∩ tipo assinado ∩ ativo). Um **worker** drena a fila, assina o corpo com HMAC e faz o POST, com retry/backoff e log persistido.

---

## Arquitetura

O código separa **core** (domínio/infra reutilizável) de **modules** (superfície HTTP).

```
src/
├── core/                       # domínio + infraestrutura (sem rota HTTP)
│   ├── prisma/                 # schema, migrations, PrismaService
│   ├── redis/                  # cliente Redis (sessões)
│   ├── telegram/               # engines, manager, sync, event bus, views
│   └── webhooks/               # service, dispatcher, worker, assinatura
└── modules/                    # controllers + DTOs + entities (OpenAPI)
    ├── auth/                   # login, JWT, API key
    ├── users/                  # usuários do dashboard
    ├── telegram/               # instâncias, chats, mensagens, mídia, SSE
    ├── webhooks/               # CRUD de webhooks, links, entregas
    ├── health/                 # healthchecks (Terminus)
    └── dashboard/              # redirect / → /dashboard
```

Princípios:

- **Core não conhece HTTP.** Controllers nos `modules` injetam serviços do `core`.
- **Pub/sub in-process.** Eventos trafegam por um `Subject` RxJS (`TelegramEventBus`) — o Redis fica só para sessões; nenhuma fila externa (BullMQ) é necessária.
- **Outbox em Postgres.** A durabilidade dos webhooks vem da tabela `WebhookDelivery` (fila + log de auditoria), drenada por um worker em intervalo.
- **Fronteira tipada.** IDs int64 do Telegram (BigInt) viram **string**; datas são **ISO-8601**. Views (`*View`) são as formas expostas ao cliente; os models Prisma nunca vazam segredos.

---

## Engines (camada Telegram)

Uma **engine** é um adaptador plugável que sabe conectar e operar uma conta numa biblioteca específica do Telegram. O `TelegramManager` permanece agnóstico e delega à engine resolvida pelo campo `engine` da instância.

### Contrato

```ts
interface InstanceEngine {
  readonly key: EngineKey;                 // 'gramjs' | 'telegraf'
  readonly capabilities: EngineCapabilities;
  isAvailable(): boolean;                  // engine implementada e usável
  requiredConfig(): string[];              // chaves de config exigidas
  connect(session: string, config: EngineConfig): Promise<EngineClient>;
}

interface EngineCapabilities {
  qrLogin: boolean;   // login QR via MTProto (contas de usuário)
  botToken: boolean;  // login por bot token (Bot API)
  messaging: boolean; // listar diálogos / ler histórico / enviar / receber updates
}
```

O `EngineClient` é o handle vivo de uma conexão: `isAuthorized`, `disconnect`, `getMe`, `saveSession`, e — quando a capability existe — `qrLogin`, `listDialogs`, `getHistory`, `sendMessage`, `sendMedia`, `downloadAvatar`, `downloadMessageMedia` e o **`onEvent(handler)`** que entrega eventos normalizados e devolve uma função de unsubscribe.

### Engines disponíveis

| Engine     | `key`      | Status        | Capabilities                          | Login          |
| ---------- | ---------- | ------------- | ------------------------------------- | -------------- |
| **GramJS** | `gramjs`   | ✅ implementada | `qrLogin`, `messaging`                | QR + 2FA       |
| Telegraf   | `telegraf` | 🔜 reservada   | `botToken` (planejado)                | Bot token      |

> A engine padrão é `gramjs`. Adicionar uma nova engine = implementar `InstanceEngine` e registrá-la no provider `TELEGRAM_ENGINES` — nada no manager precisa mudar.

### Normalização

Cada engine converte os tipos nativos para formas engine-agnósticas: `NormalizedChat`, `NormalizedContact`, `NormalizedMessage`, `NormalizedMedia`, `NormalizedReaction` e o evento discriminado `NormalizedEvent`. Isso garante que sync, SSE e webhooks funcionem igual independentemente da engine.

---

## Sistema de eventos

Instâncias emitem eventos normalizados, distribuídos in-process pelo `TelegramEventBus`. Um `DomainEvent` tem a forma:

```ts
interface DomainEvent {
  instanceId: string;
  type: EventType;
  at: string;                      // ISO timestamp
  payload: Record<string, unknown>;
}
```

### Tipos de evento

| Tipo                | Quando dispara                                              | Payload (resumo)                                  |
| ------------------- | ---------------------------------------------------------- | ------------------------------------------------- |
| `session.status`    | Transição de ciclo de vida da instância                    | `{ status, username?, phone? }`                   |
| `message.new`       | Nova mensagem recebida/enviada (também persiste e vai p/ SSE) | `MessageView`                                   |
| `message.edited`    | Mensagem editada (persiste)                                | `MessageView`                                      |
| `message.deleted`   | Mensagem(ns) apagada(s)                                    | `{ chat?, tgMessageIds[] }`                        |
| `message.read`      | Recibo de leitura ("visualizada")                          | `{ chat, maxId, direction: 'inbound'\|'outbound' }` |
| `message.reaction`  | Reação adicionada/removida                                 | `{ chat, tgMessageId, reactions[] }`              |

> Em `message.read`, `direction: 'outbound'` = o destinatário leu **a sua** mensagem (o clássico "visto"); `'inbound'` = você leu as mensagens dele.

Há dois jeitos de consumir eventos: **SSE** (`GET /telegram/instances/:id/messages/stream`, foco em `message.new`) e **webhooks** (qualquer subconjunto de tipos, entrega durável).

---

## Webhooks

Um **webhook** assina um subconjunto de tipos de evento e é vinculado a uma ou mais instâncias (relação **M2M**). Quando um evento casa (`instância vinculada ∩ tipo assinado ∩ webhook ativo`), uma entrega é enfileirada e enviada por POST.

### Garantias de entrega

- **Durável** — cada tentativa é uma linha `WebhookDelivery` no Postgres (sobrevive a restart).
- **Retry com backoff** — `10s → 1m → 5m → 30m → 2h`; após **6 tentativas** a entrega vira `dead`.
- **Assinada** — corpo assinado com HMAC-SHA256; verifique antes de confiar.
- **Auditável** — status, código HTTP, nº de tentativas e último erro ficam consultáveis (`GET /webhooks/:id/deliveries`), com reenvio manual.

### Corpo do POST

```json
{
  "event": "message.new",
  "instanceId": "ckinst0001",
  "at": "2026-06-19T12:00:00.000Z",
  "data": { "...": "payload do evento (ex.: MessageView)" }
}
```

### Cabeçalhos

| Header             | Conteúdo                                                       |
| ------------------ | ------------------------------------------------------------- |
| `Content-Type`     | `application/json`                                             |
| `User-Agent`       | `Flux-Webhooks/1.0`                                            |
| `X-Flux-Event`     | tipo do evento (ex.: `message.new`)                           |
| `X-Flux-Delivery`  | id da entrega (idempotência)                                  |
| `X-Flux-Instance`  | id da instância de origem (quando aplicável)                  |
| `X-Flux-Signature` | `sha256=<hmac-hex>` do corpo bruto, com o `secret` do webhook |

### Verificação da assinatura

O `secret` (prefixo `whsec_`) é retornado **uma única vez** ao criar/rotacionar o webhook. Assine o corpo **bruto** e compare em tempo constante:

```ts
import { createHmac, timingSafeEqual } from 'node:crypto';

function verify(rawBody: string, header: string, secret: string): boolean {
  const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(header);
  return a.length === b.length && timingSafeEqual(a, b);
}
```

---

## Autenticação & segurança

Duas camadas protegem a API:

- **JWT** — identifica o usuário do dashboard. Obtido em `POST /auth/login` (cookie `httpOnly` **e** bearer). `GET /auth/me` aceita JWT sem exigir API key (`@NoApiKey()`).
- **API key** — header `x-api-key`, chave estática do gateway exigida na maioria das rotas (auth e health são isentas).

Demais proteções:

- **Senhas**: hash **Argon2id** (nunca em texto puro).
- **`api_hash` do Telegram**: cifrado em repouso (**AES-256-GCM**), nunca retornado.
- **Rate limiting**: throttling global por IP (`@nestjs/throttler`; `@SkipThrottle()` onde apropriado).
- **Helmet**: CSP estrito na API; CSP relaxado só em `/docs` (Scalar) e `/dashboard` (SPA).
- **CORS**: origins por whitelist via `CORS_ORIGIN`.
- **BigInt seguro**: IDs int64 serializados como string (shim global em `main.ts`).

---

## Permissões & acesso

Dois eixos de autorização: um **papel global** por usuário e um **papel por instância**.

### Papel global (`User.role`)
- **`admin`** — superusuário: enxerga e opera **todas** as instâncias, gerencia usuários e papéis. O usuário semeado (`SEED_*`) é promovido a admin no boot.
- **`member`** — usuário comum: acesso definido pelos papéis por instância.

### Papel por instância (`InstanceMember`)
Todo usuário autenticado tem o baseline **`viewer`** em qualquer instância (visibilidade é aberta). Uma associação explícita eleva para **`operator`** ou **`owner`**. O criador da instância vira `owner`.

| Permissão                            | viewer | operator | owner | admin |
| ------------------------------------ | :----: | :------: | :---: | :---: |
| Ver instância / chats / mensagens    |   ✅   |    ✅    |  ✅   |  ✅   |
| Enviar mensagem / mídia              |   —    |    ✅    |  ✅   |  ✅   |
| Iniciar / parar / login (lifecycle)  |   —    |    ✅    |  ✅   |  ✅   |
| Gerenciar webhooks da instância      |   —    |    ✅    |  ✅   |  ✅   |
| Ver / gerenciar membros              |   —    | ver only |  ✅   |  ✅   |
| Atualizar / excluir instância        |   —    |    —     |  ✅   |  ✅   |
| Gerenciar usuários e papéis (global) |   —    |    —     |  —    |  ✅   |

Resolução: `admin` → tudo; senão `InstanceMember` (`owner`/`operator`); senão `viewer`. O último `owner` de uma instância não pode ser removido nem rebaixado.

**Enforcement:** rotas por instância usam `@RequireInstancePermission(...)` + `InstanceAccessGuard`; rotas globais usam `@Roles('admin')` + `RolesGuard`. Respostas `GET` de instância incluem `myRole` (papel efetivo do solicitante) para a UI esconder ações não permitidas. Vincular um webhook a uma instância exige `webhook:manage` nela.

---

## Modelo de dados

Prisma 7 + PostgreSQL. Cascade a partir de `User` / `Instance` / `Webhook`.

```
User ─┬─ instances[]            (contas Telegram criadas pelo usuário)
      ├─ webhooks[]             (webhooks do usuário)
      └─ memberships[]          (acesso por instância — M2M)
   id, email, username, role(Role: admin|member), createdAt

Setting                         key (PK) → telegram.apiId, telegram.apiHash (cifrado)

Instance ─┬─ chats[]
          ├─ contacts[]
          ├─ messages[]
          ├─ members[]          (M2M com User via InstanceMember)
          └─ webhookLinks[]     (M2M com Webhook)
   id, ownerId, label, engine, status, apiId?, apiHashEnc?, tgUserId?, username?, phone?, createdAt

InstanceMember   @@id([instanceId, userId])     (join M2M de acesso)
   role(InstanceRole: owner|operator|viewer), createdAt

enum Role          { admin  member }
enum InstanceRole  { owner  operator  viewer }

Chat        id, instanceId, tgPeerId, type(user|group|channel), title?, username?, lastMessageAt?
Contact     id, instanceId, tgUserId, firstName?, lastName?, username?, phone?, isContact
Message     id, instanceId, chatId, tgMessageId, senderId?, outgoing, text?, media*, date, editedAt?, replyToTgId?

Webhook ─┬─ instanceLinks[]     (M2M com Instance)
         └─ deliveries[]
   id, ownerId, name, url, secret, active, events String[], createdAt, updatedAt

WebhookInstance   @@id([webhookId, instanceId])     (join M2M)

WebhookDelivery   id, webhookId, instanceId?, event, status(WebhookStatus),
                  attempts, statusCode?, lastError?, payload(Json),
                  nextAttemptAt, createdAt, deliveredAt?
                  @@index([status, nextAttemptAt])

enum WebhookStatus { pending  success  failed  dead }
```

---

## Tipos & contratos da API

As formas expostas ao cliente (ISO em datas, int64 como string). Todas têm schema completo em `/docs`.

```ts
// Telegram
interface InstanceView   { id; label; engine; status; firstName?; username?; phone?; apiId?; createdAt }
interface ChatView       { id; tgPeerId; type; title?; username?; hasPhoto; lastMessageAt? }
interface MessageView    { id; chatId; tgMessageId; text?; outgoing; date; senderId?; sender?; media? }
interface MediaView      { type; mimeType?; fileName?; width?; height?; duration? }
type     InstanceStatus  = 'new'|'connecting'|'awaiting_qr'|'password_required'|'authorized'|'disconnected'|'error'

// Auth & acesso
interface UserEntity      { id; email; username; role: 'admin'|'member' }  // nunca expõe o hash
interface LoginResponse   { accessToken }                          // JWT também vai no cookie httpOnly
interface InstanceMember  { userId; username; email; role: 'owner'|'operator'|'viewer'; createdAt }
// InstanceView ganha `myRole?: 'admin'|'owner'|'operator'|'viewer'` (papel do solicitante)

// Webhooks
interface WebhookView           { id; name; url; active; events[]; instanceIds[]; createdAt; updatedAt }
interface WebhookWithSecret     extends WebhookView { secret }    // só no create / regenerate-secret
interface WebhookDeliveryView   { id; webhookId; instanceId?; event; status; attempts; statusCode?; lastError?; createdAt; deliveredAt? }
```

---

## Endpoints

> A maioria das rotas exige **JWT (Bearer)** + **`x-api-key`**. `auth` e `health` têm exceções (ver coluna Auth). Documentação interativa em **`/docs`**.

### Auth (`auth`)

| Rota                   | Método | Auth         | Descrição                                            |
| ---------------------- | ------ | ------------ | ---------------------------------------------------- |
| `/auth/register`       | POST   | Bearer JWT   | Cria um usuário (o usuário semeado cria os demais)   |
| `/auth/login`          | POST   | pública      | Login; define cookie JWT httpOnly e retorna o token  |
| `/auth/logout`         | POST   | pública      | Limpa o cookie de auth                               |
| `/auth/me`             | GET    | Bearer JWT   | Usuário atual (não exige API key)                    |
| `/auth/api-key-check`  | GET    | `x-api-key`  | Valida a API key estática                            |

### Telegram — settings & stats (`telegram`)

| Rota                   | Método | Descrição                                              |
| ---------------------- | ------ | ------------------------------------------------------ |
| `/telegram/settings`   | GET    | Lê `api_id` / `hasApiHash` (api_hash nunca sai)        |
| `/telegram/settings`   | PUT    | Define `api_id` / `api_hash` globais                   |
| `/telegram/stats`      | GET    | Uptime + total/authorized/connected de instâncias      |

### Telegram — instâncias & login

| Rota                                         | Método | Descrição                                                |
| -------------------------------------------- | ------ | -------------------------------------------------------- |
| `/telegram/instances`                        | POST   | Cria instância (label, engine?, api_id?, api_hash?)       |
| `/telegram/instances`                        | GET    | Lista instâncias                                          |
| `/telegram/instances/:id`                    | GET    | Detalhes de uma instância                                |
| `/telegram/instances/:id`                    | DELETE | Remove instância (e a sessão)                            |
| `/telegram/instances/:id/info`               | GET    | Detalhes + estado de conexão ao vivo + uptime           |
| `/telegram/instances/:id/start`              | POST   | Conecta a partir da sessão salva                         |
| `/telegram/instances/:id/stop`               | POST   | Desconecta (mantém a sessão)                             |
| `/telegram/instances/:id/login/qr`           | SSE    | Stream do login: `qr` → `password_required` → `authorized` |
| `/telegram/instances/:id/login/password`     | POST   | Envia a senha 2FA de um login QR pendente               |

### Telegram — chats, mensagens & mídia

| Rota                                                             | Método | Descrição                                       |
| --------------------------------------------------------------- | ------ | ----------------------------------------------- |
| `/telegram/instances/:id/chats`                                 | GET    | Lista chats (mais recentes primeiro)            |
| `/telegram/instances/:id/chats/:chatId/messages`                | GET    | Lista mensagens (cursor-paginado)               |
| `/telegram/instances/:id/chats/:chatId/messages`                | POST   | Envia mensagem de texto                         |
| `/telegram/instances/:id/chats/:chatId/media`                   | POST   | Envia foto/vídeo/documento (multipart, ≤ 50 MB) |
| `/telegram/instances/:id/messages/stream`                       | SSE    | Stream de novas mensagens                        |
| `/telegram/instances/:id/chats/:chatId/photo`                   | GET    | Avatar do chat/grupo (bytes)                     |
| `/telegram/instances/:id/contacts/:contactId/photo`             | GET    | Avatar do contato (bytes)                        |
| `/telegram/instances/:id/chats/:chatId/messages/:messageId/media` | GET  | Anexo da mensagem (bytes, download lazy)        |

### Telegram — membros (acesso por instância)

| Rota                                          | Método | Permissão       | Descrição                               |
| --------------------------------------------- | ------ | --------------- | --------------------------------------- |
| `/telegram/instances/:id/members`             | GET    | `member:read`   | Lista usuários com acesso à instância   |
| `/telegram/instances/:id/members`             | POST   | `member:manage` | Concede acesso `{userId, role}`         |
| `/telegram/instances/:id/members/:userId`     | PATCH  | `member:manage` | Altera o papel de um membro `{role}`    |
| `/telegram/instances/:id/members/:userId`     | DELETE | `member:manage` | Revoga o acesso de um usuário           |

### Webhooks (`webhooks`)

| Rota                                          | Método | Descrição                                          |
| --------------------------------------------- | ------ | -------------------------------------------------- |
| `/webhooks/event-types`                       | GET    | Lista os tipos de evento assináveis                |
| `/webhooks`                                   | POST   | Cria webhook (retorna o `secret` uma vez)          |
| `/webhooks`                                   | GET    | Lista seus webhooks                                |
| `/webhooks/:id`                               | GET    | Detalhes de um webhook                             |
| `/webhooks/:id`                               | PATCH  | Atualiza (nome, url, ativo, eventos)               |
| `/webhooks/:id`                               | DELETE | Remove o webhook e suas entregas                   |
| `/webhooks/:id/regenerate-secret`             | POST   | Rotaciona o secret de assinatura (retorna uma vez) |
| `/webhooks/:id/instances/:instanceId`         | POST   | Vincula uma instância (M2M; exige `webhook:manage` na instância) |
| `/webhooks/:id/instances/:instanceId`         | DELETE | Desvincula uma instância                           |
| `/webhooks/:id/deliveries`                    | GET    | Log de entregas (`?limit=`, default 50)            |
| `/webhooks/deliveries/:deliveryId/resend`     | POST   | Re-enfileira uma entrega para reenvio imediato     |

**Corpos úteis**

- **POST `/webhooks`** — `{ name, url, events[], instanceIds? }`
- **PATCH `/webhooks/:id`** — `{ name?, url?, active?, events? }`

### Usuários & sistema

| Rota              | Método | Auth                  | Descrição                                                    |
| ----------------- | ------ | --------------------- | ----------------------------------------------------------- |
| `/users`          | GET    | Bearer JWT + API key  | Lista os usuários cadastrados                               |
| `/users/:id/role` | PATCH  | Bearer JWT + API key  | Altera o papel global `{role: 'admin'\|'member'}` (só `admin`) |
| `/`               | GET    | pública               | Redireciona para `/dashboard`                              |
| `/health`         | GET    | pública               | Postgres + Redis + Telegram + heap                         |
| `/docs`           | GET    | pública               | Scalar API Reference (OpenAPI)                             |
| `/dashboard`      | GET    | pública               | SPA Vue                                                    |

---

## Dashboard (SPA Vue)

Vue 3 + TypeScript + Tailwind, servido em `/dashboard`.

- **Overview** — uptime, contagem e saúde das instâncias, total de webhooks.
- **Instâncias** — criar, conectar via QR, iniciar/parar, detalhes, abrir chats.
- **Chats** — listar diálogos, ler histórico paginado, enviar texto e mídia, realtime.
- **Webhooks** — criar/editar (eventos + instâncias), ativar/desativar, ver entregas (status/código/tentativas) e reenviar, rotacionar secret.
- **Usuários** — listar contas do dashboard.
- **Configurações** — definir `api_id`/`api_hash`, testar `x-api-key`.
- **Ajuda** — guia passo a passo. **i18n**: Inglês + Português (BR).

---

## Stack

| Recurso         | Lib                                                                 |
| --------------- | ------------------------------------------------------------------- |
| **Runtime**     | Node.js 22 + TypeScript                                             |
| **Framework**   | NestJS 11 (DI, decoradores, módulos)                               |
| **ORM**         | Prisma 7 + PostgreSQL 17                                            |
| **Cache**       | Redis 7 (sessões Telegram)                                         |
| **Auth**        | `@nestjs/passport` (local, jwt, api-key) + `@nestjs/jwt` + `argon2` |
| **API Docs**    | OpenAPI (`@nestjs/swagger`) + **Scalar** UI em `/docs`            |
| **Telegram**    | GramJS (cliente MTProto)                                           |
| **Realtime**    | Server-Sent Events (SSE) + RxJS                                    |
| **Webhooks**    | Outbox Postgres + worker + HMAC-SHA256 (crypto nativo)            |
| **Frontend**    | Vue 3 + TypeScript + Tailwind + vue-i18n + Pinia + vue-sonner     |
| **Healthcheck** | `@nestjs/terminus`                                                 |
| **Throttle**    | `@nestjs/throttler`                                                |
| **CI/CD**       | GitHub Actions (build, lint, test, e2e)                           |

---

## Setup

### Pré-requisitos

- Node.js 22+
- Docker + Docker Compose (Postgres + Redis)
- Git

### Instalação

```bash
git clone https://github.com/PedroL3m0z/Flux-Api.git
cd flux-api

cp .env.example .env
# Edite: JWT_SECRET, API_KEY (gere com `openssl rand -hex 32`),
#        TELEGRAM_SESSION_SECRET (para cifrar sessões)

yarn install
yarn prisma:generate
```

### Rodar com Docker (recomendado)

```bash
docker compose up -d
# API:       http://localhost:3000
# Dashboard: http://localhost:3000/dashboard
# Docs:      http://localhost:3000/docs
# Postgres:  localhost:5433 (user: flux / pass: flux)
# Redis:     localhost:6379
```

### Rodar local (infra no Docker, app no host)

```bash
docker compose up -d postgres redis
yarn prisma migrate dev --schema=src/core/prisma/schema.prisma
yarn start:dev
```

### Build de produção

```bash
yarn build:all      # backend + frontend
node dist/main.js
```

---

## Desenvolvimento

```bash
# Backend
yarn start:dev       # dev com hot-reload
yarn build           # compila TypeScript (nest build)
yarn lint            # eslint --fix
yarn test            # testes unitários (Jest)
yarn test:e2e        # testes e2e
yarn test:cov        # cobertura

# Frontend
yarn build:client    # build do dashboard
cd client && npm run dev   # Vite dev server (proxy p/ a API)

# Prisma
yarn prisma:generate       # gera o client
yarn prisma:migrate        # migrate dev
yarn prisma:studio         # Prisma Studio
```

---

## Estrutura de pastas

```
flux-api/
├── src/
│   ├── common/                 # decoradores, guards, interceptors
│   ├── config/                 # CORS, etc.
│   ├── core/
│   │   ├── prisma/             # schema, migrations, PrismaService
│   │   ├── redis/              # cliente Redis
│   │   ├── telegram/
│   │   │   ├── engines/        # InstanceEngine, GramJsEngine, tipos normalizados
│   │   │   ├── services/       # sync, settings, event bus, instances...
│   │   │   ├── views.ts        # ChatView, MessageView, MediaView...
│   │   │   ├── telegram.manager.ts   # orquestra ciclo de vida + session.status
│   │   │   └── telegram.module.ts
│   │   └── webhooks/           # service, dispatcher, worker, assinatura, tipos
│   ├── modules/
│   │   ├── auth/               # controller, DTOs, entities, guards
│   │   ├── users/
│   │   ├── telegram/           # controller, DTOs, entities, messaging service
│   │   ├── webhooks/           # controller, DTOs, entities
│   │   ├── health/
│   │   └── dashboard/
│   ├── app.module.ts
│   └── main.ts                 # bootstrap, OpenAPI/Scalar, BigInt shim
├── client/                     # SPA Vue 3 (base /dashboard/)
├── docker-compose.yml
├── Dockerfile                  # multistage (client + backend)
├── prisma.config.ts
└── README.md
```

---

## Variáveis de ambiente

| Variável                  | Obrigatória | Descrição                                                  |
| ------------------------- | ----------- | ---------------------------------------------------------- |
| `DATABASE_URL`            | sim         | URL do PostgreSQL                                          |
| `REDIS_URL`               | sim         | URL do Redis (sessões)                                     |
| `JWT_SECRET`              | sim         | Segredo de assinatura do JWT                               |
| `JWT_EXPIRES_IN`          | não         | Validade do token (default `3600s`)                       |
| `API_KEY`                 | sim         | Chave estática do header `x-api-key`                      |
| `TELEGRAM_API_ID`         | não\*       | api_id default do GramJS (\*ou por instância / settings)   |
| `TELEGRAM_API_HASH`       | não\*       | api_hash default do GramJS                                |
| `TELEGRAM_SESSION_SECRET` | recomendada | Cifra as sessões salvas (sem ela, ficam em texto puro)    |
| `CORS_ORIGIN`             | não         | Whitelist de origins (default `*`)                        |
| `COOKIE_SECURE`           | não         | `true` para cookie `Secure` (atrás de TLS)               |
| `PORT`                    | não         | Porta HTTP (default `3000`)                               |
| `NODE_ENV`                | não         | `development` / `production`                              |

---

## Deployment

### Docker Compose (dev/staging)

```bash
docker compose up -d
```

### Imagem standalone (produção)

```bash
docker build -t flux-api:latest .

docker run -d \
  -e DATABASE_URL="postgresql://user:pass@host:5432/flux" \
  -e REDIS_URL="redis://host:6379" \
  -e JWT_SECRET="..." \
  -e API_KEY="..." \
  -e TELEGRAM_SESSION_SECRET="..." \
  -p 3000:3000 \
  flux-api:latest
```

---

## Roadmap

- [x] Histórico on-demand (mensagens com paginação por cursor)
- [x] Envio e download de mídia (foto/vídeo/documento, avatares)
- [x] Sistema de eventos (status, mensagens, leitura, reações)
- [x] Webhooks para eventos do Telegram (M2M, HMAC, retry, log)
- [ ] Engine Telegraf (Bot API)
- [ ] Participantes de grupo (N↔N)
- [ ] Busca em chats/mensagens
- [ ] Autenticação OAuth2 (GitHub, Google)

---

## Documentação

- **API (OpenAPI)**: `/docs` — Scalar UI
- **Guia do dashboard**: seção "Ajuda" no app
- **Contribuição**: [CONTRIBUTING.md](./.github/CONTRIBUTING.md)
- **Código de Conduta**: [CODE_OF_CONDUCT.md](./.github/CODE_OF_CONDUCT.md)
- **Segurança**: [SECURITY.md](./.github/SECURITY.md)
- **Manutenção/Releases**: [docs/MAINTAINING.md](./docs/MAINTAINING.md)

## Licença

[Apache License 2.0](./LICENSE) © Pedro Lemos

---

**Construído com ❤️ em NestJS + Vue + Telegram**
