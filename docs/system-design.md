# LivChat.ai - System Design

## 1. Visão Geral

**Produto:** LivChat.ai - WhatsApp API para desenvolvedores e martech
**Domínio:** livchat.ai (registrado)
**Tagline:** "Envie fácil. Escale rápido."

### Proposta de Valor
- Zero friction: conecte WhatsApp antes de criar conta
- Pricing por instância, não por mensagem
- Integração em minutos, não semanas
- Feito para devs, martech e AI agents

---

## 2. Arquitetura Geral

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USUÁRIOS                                        │
│                    (Devs, Martech, AI Agents)                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CLOUDFLARE (DNS + CDN)                               │
│                           livchat.ai                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
┌───────────────────────────────┐   ┌───────────────────────────────────────┐
│         VERCEL                │   │              FLY.IO                    │
│     (Frontend + API)          │   │         (WhatsApp Backend)             │
│                               │   │                                        │
│  ┌─────────────────────────┐  │   │  ┌──────────────────────────────────┐ │
│  │     Next.js 14          │  │   │  │         WuzAPI (Go)              │ │
│  │     App Router          │  │   │  │                                  │ │
│  │     + tRPC              │  │   │  │  • WhatsApp WebSocket            │ │
│  │     + Bun runtime       │  │   │  │  • Session management            │ │
│  │                         │  │   │  │  • Message routing               │ │
│  │  Routes:                │  │   │  │  • Media handling                │ │
│  │  • / (Landing Page)     │  │   │  │                                  │ │
│  │  • /dashboard/*         │  │   │  └──────────────────────────────────┘ │
│  │  • /api/trpc/*          │  │   │                                        │
│  │  • /api/public/*        │  │   │  Múltiplas instâncias (auto-scale)    │
│  │                         │  │   │                                        │
│  └─────────────────────────┘  │   └───────────────────────────────────────┘
│                               │                       │
└───────────────────────────────┘                       │
            │                                           │
            │                                           │
            ▼                                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATABASES & SERVICES                            │
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │    NEON     │  │  CLOUDAMQP  │  │ CLOUDFLARE  │  │       CLERK         │ │
│  │  (Postgres) │  │ (RabbitMQ)  │  │    R2       │  │   (Auth + Users)    │ │
│  │             │  │             │  │  (Storage)  │  │                     │ │
│  │  • Users    │  │  • Events   │  │             │  │  • Google OAuth     │ │
│  │  • Sessions │  │  • Webhooks │  │  • Media    │  │  • GitHub OAuth     │ │
│  │  • Billing  │  │  • Jobs     │  │  • Files    │  │  • Session mgmt     │ │
│  │  • Usage    │  │             │  │             │  │                     │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────────────┐  │
│  │   BREVO     │  │ ABACATE PAY │  │         MONITORAMENTO               │  │
│  │  (Emails)   │  │ (Payments)  │  │          (A definir)                │  │
│  │             │  │             │  │                                     │  │
│  │• Transac.   │  │  • Checkout │  │  Opções:                           │  │
│  │• Welcome    │  │  • Webhooks │  │  • Sentry (errors)                 │  │
│  │• Alerts     │  │  • Invoices │  │  • LogSnag (events)                │  │
│  └─────────────┘  └─────────────┘  │  • Upstash (metrics)               │  │
│                                     └─────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Stack Tecnológica

### Frontend + API (Vercel)

| Camada | Tecnologia | Versão | Motivo |
|--------|------------|--------|--------|
| **Runtime** | Bun | latest | Performance, DX, compatível com Vercel |
| **Framework** | Next.js | 14+ | App Router, Server Components, Edge |
| **API** | tRPC | 11+ | Type-safe, integração Next.js |
| **ORM** | Drizzle | latest | Type-safe, edge-compatible, Neon |
| **Styling** | Tailwind CSS | 3.4+ | Utility-first, design system |
| **Components** | shadcn/ui | latest | Composable, customizável |
| **Animations** | Framer Motion | 12+ | Declarative, performant |
| **Icons** | Lucide React | latest | Consistente, tree-shakeable |
| **Auth** | Clerk | latest | Zero-config, Google/GitHub |
| **Forms** | React Hook Form + Zod | latest | Validação type-safe |

### Backend WhatsApp (Fly.io)

| Camada | Tecnologia | Motivo |
|--------|------------|--------|
| **Runtime** | Go | Performance, whatsmeow lib |
| **API** | WuzAPI | Fork do asternic/wuzapi |
| **Protocol** | whatsmeow | WebSocket direto ao WhatsApp |
| **Database** | SQLite/Postgres | Sessions do WhatsApp |

### Infraestrutura

| Serviço | Provider | Tier | Motivo |
|---------|----------|------|--------|
| **Database** | Neon | Free → Pro | Serverless Postgres, branching |
| **Queue** | CloudAMQP | Free → Paid | RabbitMQ gerenciado, wuzapi nativo |
| **Storage** | Cloudflare R2 | Free tier | S3-compatible, sem egress fees |
| **Auth** | Clerk | Free → Pro | Google/GitHub, session mgmt |
| **Email** | Brevo | Free tier | Transactional, templates |
| **Payments** | Abacate Pay | Por transação | BR-focused, PIX, simples |
| **DNS/CDN** | Cloudflare | Free | Performance, DDoS, caching |
| **Monitoring** | A definir | - | Sentry, LogSnag, ou Upstash |

---

## 4. Estrutura do Projeto (T3 + Bun)

```
livchat/
├── app/                          # Next.js App Router
│   ├── (marketing)/              # Grupo: páginas públicas
│   │   ├── page.tsx              # Landing Page principal
│   │   ├── pricing/page.tsx      # Página de preços
│   │   ├── docs/                 # Documentação
│   │   └── layout.tsx
│   │
│   ├── (auth)/                   # Grupo: autenticação (Clerk)
│   │   ├── sign-in/[[...sign-in]]/page.tsx
│   │   ├── sign-up/[[...sign-up]]/page.tsx
│   │   └── layout.tsx
│   │
│   ├── (dashboard)/              # Grupo: área logada (A definir)
│   │   ├── layout.tsx            # Com Clerk protection
│   │   ├── page.tsx              # Dashboard home
│   │   ├── instances/            # Gerenciar instâncias
│   │   ├── webhooks/             # Configurar webhooks
│   │   ├── analytics/            # Métricas de uso
│   │   ├── settings/             # Configurações
│   │   └── billing/              # Faturamento
│   │
│   ├── api/
│   │   ├── trpc/[trpc]/route.ts  # tRPC handler
│   │   ├── public/               # APIs públicas (anonymous)
│   │   │   ├── session/route.ts  # Criar sessão anônima
│   │   │   ├── connect/route.ts  # Iniciar conexão WhatsApp
│   │   │   ├── status/route.ts   # Status da conexão
│   │   │   ├── qr/route.ts       # Obter QR code
│   │   │   ├── pairphone/route.ts # Pairing code
│   │   │   └── message/route.ts  # Enviar msg teste
│   │   ├── webhooks/
│   │   │   ├── clerk/route.ts    # Clerk webhooks
│   │   │   ├── abacate/route.ts  # Abacate Pay webhooks
│   │   │   └── wuzapi/route.ts   # WuzAPI event webhooks
│   │   └── cron/                 # Cron jobs (Vercel)
│   │
│   ├── layout.tsx                # Root layout
│   └── globals.css               # Tailwind imports
│
├── components/
│   ├── ui/                       # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── card.tsx
│   │   └── ...
│   ├── marketing/                # Componentes da LP
│   │   ├── hero.tsx
│   │   ├── features.tsx
│   │   ├── pricing.tsx
│   │   ├── test-panel.tsx
│   │   ├── qr-scanner.tsx
│   │   └── ...
│   ├── dashboard/                # Componentes do dashboard
│   │   └── ...
│   └── common/                   # Componentes compartilhados
│       ├── navbar.tsx
│       ├── footer.tsx
│       └── ...
│
├── server/
│   ├── api/
│   │   ├── root.ts               # tRPC root router
│   │   └── routers/
│   │       ├── session.ts        # Session procedures
│   │       ├── instance.ts       # Instance management
│   │       ├── message.ts        # Message sending
│   │       ├── webhook.ts        # Webhook config
│   │       ├── billing.ts        # Billing/subscription
│   │       └── user.ts           # User settings
│   ├── db/
│   │   ├── index.ts              # Drizzle client
│   │   ├── schema.ts             # Database schema
│   │   └── migrations/           # Drizzle migrations
│   └── services/
│       ├── wuzapi.ts             # WuzAPI client
│       ├── clerk.ts              # Clerk helpers
│       ├── abacate.ts            # Abacate Pay client
│       ├── brevo.ts              # Email service
│       ├── r2.ts                 # Cloudflare R2 client
│       └── rabbitmq.ts           # CloudAMQP client
│
├── lib/
│   ├── utils.ts                  # Utility functions
│   ├── constants.ts              # App constants
│   ├── validations.ts            # Zod schemas
│   └── trpc.ts                   # tRPC client setup
│
├── hooks/
│   ├── use-session.ts            # Anonymous session hook
│   ├── use-connection.ts         # WhatsApp connection hook
│   └── use-messaging.ts          # Message sending hook
│
├── types/
│   ├── index.ts                  # Shared types
│   ├── wuzapi.ts                 # WuzAPI response types
│   └── api.ts                    # API types
│
├── public/
│   ├── favicon.ico
│   └── ...
│
├── .env.local                    # Environment variables
├── .env.example                  # Example env file
├── bun.lockb                     # Bun lockfile
├── package.json
├── tailwind.config.ts
├── drizzle.config.ts
├── tsconfig.json
└── next.config.ts
```

---

## 5. Database Schema (Drizzle + Neon)

```typescript
// server/db/schema.ts

import { pgTable, text, timestamp, integer, boolean, jsonb, uuid } from 'drizzle-orm/pg-core';

// ============================================
// USERS & AUTH (synced with Clerk)
// ============================================

export const users = pgTable('users', {
  id: text('id').primaryKey(), // Clerk user ID
  email: text('email').notNull().unique(),
  name: text('name'),
  avatarUrl: text('avatar_url'),

  // Plan & Billing
  plan: text('plan').default('free'), // 'free' | 'starter' | 'scale'
  stripeCustomerId: text('stripe_customer_id'), // ou abacate
  abacateCustomerId: text('abacate_customer_id'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================
// ANONYMOUS SESSIONS (pre-login)
// ============================================

export const anonymousSessions = pgTable('anonymous_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Identification
  anonymousToken: text('anonymous_token').notNull().unique(),
  ipAddress: text('ip_address').notNull(),
  userAgent: text('user_agent'),

  // WhatsApp connection
  wuzapiToken: text('wuzapi_token'), // Token no WuzAPI
  whatsappJid: text('whatsapp_jid'), // Número conectado
  isConnected: boolean('is_connected').default(false),

  // Usage tracking
  messagesUsedToday: integer('messages_used_today').default(0),
  lastMessageAt: timestamp('last_message_at'),

  // Migration
  migratedToUserId: text('migrated_to_user_id').references(() => users.id),
  migratedAt: timestamp('migrated_at'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at'), // 30 dias de inatividade
});

// ============================================
// INSTANCES (WhatsApp connections)
// ============================================

export const instances = pgTable('instances', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => users.id),

  // WuzAPI reference
  wuzapiUserId: text('wuzapi_user_id').notNull(),
  wuzapiToken: text('wuzapi_token').notNull(),

  // WhatsApp info
  whatsappJid: text('whatsapp_jid'),
  whatsappName: text('whatsapp_name'),
  whatsappPictureUrl: text('whatsapp_picture_url'),

  // Status
  status: text('status').default('disconnected'), // 'disconnected' | 'connecting' | 'connected'
  lastConnectedAt: timestamp('last_connected_at'),

  // Configuration
  webhookUrl: text('webhook_url'),
  webhookEvents: jsonb('webhook_events').$type<string[]>(),
  hmacKey: text('hmac_key'),

  // S3/R2 config
  s3Enabled: boolean('s3_enabled').default(false),
  s3Config: jsonb('s3_config'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================
// USAGE TRACKING
// ============================================

export const usageDaily = pgTable('usage_daily', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => users.id),
  instanceId: uuid('instance_id').references(() => instances.id),

  date: timestamp('date').notNull(), // Data (sem hora)

  // Counters
  messagesSent: integer('messages_sent').default(0),
  messagesReceived: integer('messages_received').default(0),
  mediaUploaded: integer('media_uploaded').default(0), // bytes
  webhooksCalled: integer('webhooks_called').default(0),

  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================
// SUBSCRIPTIONS & BILLING
// ============================================

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => users.id),

  // Plan details
  plan: text('plan').notNull(), // 'starter' | 'scale'
  instancesIncluded: integer('instances_included').notNull(),
  instancesExtra: integer('instances_extra').default(0),

  // Abacate Pay
  abacateSubscriptionId: text('abacate_subscription_id'),

  // Status
  status: text('status').default('active'), // 'active' | 'cancelled' | 'past_due'
  currentPeriodStart: timestamp('current_period_start'),
  currentPeriodEnd: timestamp('current_period_end'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================
// WEBHOOK LOGS (para debugging)
// ============================================

export const webhookLogs = pgTable('webhook_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  instanceId: uuid('instance_id').references(() => instances.id),

  // Request
  eventType: text('event_type').notNull(),
  payload: jsonb('payload'),

  // Delivery
  deliveryStatus: text('delivery_status'), // 'pending' | 'delivered' | 'failed'
  deliveryAttempts: integer('delivery_attempts').default(0),
  lastAttemptAt: timestamp('last_attempt_at'),
  responseStatus: integer('response_status'),
  responseBody: text('response_body'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

---

## 6. APIs e Rotas

### APIs Públicas (sem auth)

```typescript
// Rate limits por IP
const PUBLIC_RATE_LIMITS = {
  session: '10/hour',      // Criar sessão anônima
  connect: '5/hour',       // Iniciar conexão
  qr: '60/minute',         // Polling QR code
  message: '50/day',       // Enviar mensagem teste
};

// POST /api/public/session
// Cria sessão anônima
{
  response: {
    anonymousId: string,
    anonymousToken: string,
    expiresAt: string
  }
}

// POST /api/public/connect
// Headers: X-Anonymous-Token
// Inicia conexão WhatsApp
{
  response: {
    status: 'connecting' | 'connected',
    qrAvailable: boolean
  }
}

// GET /api/public/qr
// Headers: X-Anonymous-Token
// Retorna QR code
{
  response: {
    qrCode: string, // base64 PNG
    expiresIn: number // segundos
  }
}

// POST /api/public/pairphone
// Headers: X-Anonymous-Token
// Body: { phone: string }
// Retorna pairing code
{
  response: {
    pairingCode: string,
    expiresIn: number
  }
}

// GET /api/public/status
// Headers: X-Anonymous-Token
// Status da conexão
{
  response: {
    connected: boolean,
    loggedIn: boolean,
    whatsappJid?: string,
    messagesRemaining: number
  }
}

// POST /api/public/message
// Headers: X-Anonymous-Token
// Body: { to: string, message: string }
// Envia mensagem teste
{
  response: {
    success: boolean,
    messageId: string,
    timestamp: string
  }
}
```

### tRPC Routers (autenticado via Clerk)

```typescript
// server/api/routers/instance.ts
export const instanceRouter = createTRPCRouter({
  list: protectedProcedure.query(/* lista instâncias do usuário */),
  get: protectedProcedure.input(z.object({ id: z.string() })).query(/* detalhes */),
  create: protectedProcedure.mutation(/* cria nova instância */),
  delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(/* remove */),
  connect: protectedProcedure.input(z.object({ id: z.string() })).mutation(/* conecta */),
  disconnect: protectedProcedure.input(z.object({ id: z.string() })).mutation(/* desconecta */),
  getQr: protectedProcedure.input(z.object({ id: z.string() })).query(/* QR code */),
});

// server/api/routers/message.ts
export const messageRouter = createTRPCRouter({
  send: protectedProcedure.input(sendMessageSchema).mutation(/* envia msg */),
  sendMedia: protectedProcedure.input(sendMediaSchema).mutation(/* envia mídia */),
});

// server/api/routers/webhook.ts
export const webhookRouter = createTRPCRouter({
  get: protectedProcedure.input(z.object({ instanceId: z.string() })).query(/* config */),
  set: protectedProcedure.input(webhookConfigSchema).mutation(/* configura */),
  delete: protectedProcedure.input(z.object({ instanceId: z.string() })).mutation(/* remove */),
  logs: protectedProcedure.input(z.object({ instanceId: z.string() })).query(/* logs */),
});

// server/api/routers/billing.ts
export const billingRouter = createTRPCRouter({
  getSubscription: protectedProcedure.query(/* subscription atual */),
  getUsage: protectedProcedure.query(/* uso do período */),
  createCheckout: protectedProcedure.input(checkoutSchema).mutation(/* Abacate Pay */),
  cancelSubscription: protectedProcedure.mutation(/* cancela */),
});

// server/api/routers/session.ts
export const sessionRouter = createTRPCRouter({
  migrate: protectedProcedure
    .input(z.object({ anonymousId: z.string() }))
    .mutation(/* migra sessão anônima para conta */),
});
```

---

## 7. Fluxos Principais

### 7.1 Fluxo Zero-Friction (Anonymous → Logged In)

```
┌─────────────────────────────────────────────────────────────────┐
│                    VISITANTE CHEGA NA LP                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. Frontend verifica localStorage                               │
│     - Tem anonymous_token? → Usa existente                      │
│     - Não tem? → POST /api/public/session                       │
│                                                                  │
│  2. Backend cria sessão anônima                                 │
│     - Gera anonymous_id + anonymous_token                       │
│     - Verifica limite por IP (1 sessão ativa)                   │
│     - Cria user temporário no WuzAPI                            │
│     - Salva em anonymous_sessions                               │
│                                                                  │
│  3. Frontend armazena em localStorage                           │
│     { anonymous_id, anonymous_token }                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. Usuário escaneia QR code                                    │
│     - POST /api/public/connect                                  │
│     - Polling GET /api/public/status (2s interval)              │
│     - GET /api/public/qr para obter imagem                      │
│                                                                  │
│  5. WhatsApp conectado!                                         │
│     - Status: connected + loggedIn                              │
│     - Mostra Painel de Teste                                    │
│     - Pode enviar até 50 msgs/dia                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  6. Usuário clica "Acessar conta"                               │
│     - Clerk modal abre (Google/GitHub)                          │
│     - Usuário autentica                                         │
│                                                                  │
│  7. Clerk webhook → cria user em users table                    │
│                                                                  │
│  8. Frontend detecta login + tem anonymous_token                │
│     - POST /api/trpc/session.migrate                            │
│                                                                  │
│  9. Backend migra sessão                                        │
│     - Vincula instance ao user_id                               │
│     - Marca anonymous_session como migrada                      │
│     - Gera novo token para a instância                          │
│                                                                  │
│  10. Frontend limpa localStorage, usa sessão autenticada        │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Fluxo de Mensagem

```
┌─────────────────────────────────────────────────────────────────┐
│  Usuario/Sistema envia mensagem                                  │
│                                                                  │
│  POST /api/public/message (anônimo)                             │
│  ou                                                              │
│  tRPC message.send (autenticado)                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Backend (Next.js)                                               │
│                                                                  │
│  1. Valida request (Zod)                                        │
│  2. Verifica limites:                                           │
│     - Anônimo: 50 msgs/dia                                      │
│     - Free: 50 msgs/dia                                         │
│     - Pago: rate limit 10/seg                                   │
│  3. Incrementa contador em usage_daily                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  WuzAPI (Fly.io)                                                 │
│                                                                  │
│  POST /chat/send/text                                           │
│  Headers: Authorization: {instance_token}                       │
│  Body: { Phone, Body }                                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  WhatsApp                                                        │
│                                                                  │
│  Mensagem entregue → Webhook de confirmação                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Webhook para o usuário (se configurado)                        │
│                                                                  │
│  POST {user_webhook_url}                                        │
│  Headers: x-hmac-signature (se HMAC configurado)                │
│  Body: { event, messageId, status, ... }                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. Limites e Rate Limiting

### Por Estado do Usuário

| Estado | Instâncias | Msgs/dia | Rate Limit | Webhooks | Dashboard |
|--------|------------|----------|------------|----------|-----------|
| **Anônimo** | 1 | 50 | 1/seg | ❌ | ❌ |
| **Free (logado)** | 1 | 50 | 1/seg | ✅ básico | ✅ básico |
| **Starter** | 5 | Ilimitado | 10/seg | ✅ retry | ✅ completo |
| **Scale** | 20+ | Ilimitado | Custom | ✅ priority | ✅ + SLA |

### Rate Limits de API

```typescript
const RATE_LIMITS = {
  // APIs públicas (por IP)
  public: {
    session: { requests: 10, window: '1h' },
    connect: { requests: 5, window: '1h' },
    qr: { requests: 60, window: '1m' },
    status: { requests: 120, window: '1m' },
    message: { requests: 50, window: '1d' },
  },

  // APIs autenticadas (por user)
  authenticated: {
    free: {
      message: { requests: 50, window: '1d' },
      api: { requests: 100, window: '1m' },
    },
    starter: {
      message: { requests: 10, window: '1s' }, // por instância
      api: { requests: 1000, window: '1m' },
    },
    scale: {
      message: { requests: 50, window: '1s' }, // por instância
      api: { requests: 5000, window: '1m' },
    },
  },
};
```

---

## 9. Pricing

### Planos

| Plano | Preço | Instâncias | Features |
|-------|-------|------------|----------|
| **Free** | R$ 0/mês | 1 | 50 msgs/dia, webhook básico, sem SLA |
| **Starter** | R$ 445/mês | 5 incluídas | Ilimitado*, webhook retry, dashboard |
| **Scale** | Sob consulta | 20+ | Ilimitado, SLA, suporte priority |

- Instância adicional: **R$ 89/mês**
- *Ilimitado dentro do rate limit (10 msgs/seg por instância)

### Cálculo

```typescript
function calculatePrice(instances: number): number {
  if (instances <= 0) return 0;
  if (instances <= 5) return 445; // Starter mínimo
  return 445 + (instances - 5) * 89; // Adicional
}

// Exemplos:
// 5 instâncias = R$ 445
// 10 instâncias = R$ 445 + (5 × R$ 89) = R$ 890
// 20 instâncias = R$ 445 + (15 × R$ 89) = R$ 1.780
```

---

## 10. Integrações Externas

### WuzAPI (Fly.io)

```typescript
// server/services/wuzapi.ts

const WUZAPI_URL = process.env.WUZAPI_URL; // https://wuzapi.fly.dev
const WUZAPI_ADMIN_TOKEN = process.env.WUZAPI_ADMIN_TOKEN;

export const wuzapi = {
  // Admin operations
  async createUser(name: string) {
    const token = generateToken();
    const res = await fetch(`${WUZAPI_URL}/admin/users`, {
      method: 'POST',
      headers: {
        'Authorization': WUZAPI_ADMIN_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, token }),
    });
    return { userId: (await res.json()).id, token };
  },

  // Session operations
  async connect(token: string, events: string[] = ['Message']) {
    return fetch(`${WUZAPI_URL}/session/connect`, {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ Subscribe: events, Immediate: false }),
    });
  },

  async getQr(token: string) {
    const res = await fetch(`${WUZAPI_URL}/session/qr`, {
      headers: { 'Authorization': token },
    });
    return res.json();
  },

  async getStatus(token: string) {
    const res = await fetch(`${WUZAPI_URL}/session/status`, {
      headers: { 'Authorization': token },
    });
    return res.json();
  },

  async sendMessage(token: string, phone: string, body: string) {
    return fetch(`${WUZAPI_URL}/chat/send/text`, {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ Phone: phone, Body: body }),
    });
  },

  // ... mais métodos
};
```

### Clerk

```typescript
// server/services/clerk.ts
import { clerkClient } from '@clerk/nextjs/server';

export async function syncUserFromClerk(clerkUserId: string) {
  const clerkUser = await clerkClient.users.getUser(clerkUserId);

  return {
    id: clerkUser.id,
    email: clerkUser.emailAddresses[0]?.emailAddress,
    name: clerkUser.firstName + ' ' + clerkUser.lastName,
    avatarUrl: clerkUser.imageUrl,
  };
}
```

### Cloudflare R2

```typescript
// server/services/r2.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function uploadMedia(
  key: string,
  body: Buffer,
  contentType: string
) {
  await r2.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));

  return `${process.env.R2_PUBLIC_URL}/${key}`;
}
```

### Brevo (Email)

```typescript
// server/services/brevo.ts
import * as brevo from '@getbrevo/brevo';

const apiInstance = new brevo.TransactionalEmailsApi();
apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY!);

export async function sendWelcomeEmail(to: string, name: string) {
  return apiInstance.sendTransacEmail({
    to: [{ email: to, name }],
    templateId: 1, // Template ID no Brevo
    params: { name },
  });
}

export async function sendUsageLimitWarning(to: string, usage: number, limit: number) {
  return apiInstance.sendTransacEmail({
    to: [{ email: to }],
    templateId: 2,
    params: { usage, limit, percentage: Math.round((usage / limit) * 100) },
  });
}
```

---

## 11. Environment Variables

```bash
# .env.example

# App
NEXT_PUBLIC_APP_URL=https://livchat.ai
NODE_ENV=production

# Database (Neon)
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require

# Auth (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxx
CLERK_SECRET_KEY=sk_live_xxx
CLERK_WEBHOOK_SECRET=whsec_xxx

# WuzAPI (Fly.io)
WUZAPI_URL=https://wuzapi.livchat.ai
WUZAPI_ADMIN_TOKEN=xxx

# Queue (CloudAMQP)
CLOUDAMQP_URL=amqps://user:pass@host/vhost

# Storage (Cloudflare R2)
R2_ENDPOINT=https://xxx.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET=livchat-media
R2_PUBLIC_URL=https://media.livchat.ai

# Email (Brevo)
BREVO_API_KEY=xkeysib-xxx

# Payments (Abacate Pay) - A investigar
ABACATE_API_KEY=xxx
ABACATE_WEBHOOK_SECRET=xxx

# Monitoring - A definir
# SENTRY_DSN=xxx
# LOGSNAG_TOKEN=xxx
```

---

## 12. Deployment

### Vercel (Frontend + API)

```json
// vercel.json
{
  "buildCommand": "bun run build",
  "installCommand": "bun install",
  "framework": "nextjs",
  "regions": ["gru1"], // São Paulo
  "env": {
    "NEXT_RUNTIME": "nodejs" // ou "edge" para algumas routes
  }
}
```

### Fly.io (WuzAPI)

```toml
# fly.toml
app = "wuzapi-livchat"
primary_region = "gru" # São Paulo

[build]
  image = "asternic/wuzapi:latest"

[env]
  WUZAPI_ADMIN_TOKEN = "xxx"
  PORT = "8080"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = false # Manter sempre on
  auto_start_machines = true
  min_machines_running = 1

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 512
```

---

## 13. A Definir

### Dashboard (páginas e features)
- [ ] Quais páginas além do básico?
- [ ] Nível de analytics
- [ ] Configurações disponíveis

### Abacate Pay
- [ ] Investigar API e fluxo de webhook
- [ ] Definir integração (checkout, subscription)
- [ ] Testar sandbox

### Monitoramento
- [ ] Escolher entre Sentry, LogSnag, ou outro
- [ ] Definir métricas a trackear
- [ ] Alertas e thresholds

### Backblaze B2 vs Cloudflare R2
- [ ] Comparar free tiers
- [ ] Decidir qual usar
- [ ] Configurar CDN se necessário

---

## 14. Próximos Passos

1. **Setup inicial do projeto T3 com Bun**
2. **Configurar Neon + Drizzle + Schema**
3. **Integrar Clerk (auth)**
4. **Criar APIs públicas (anonymous session)**
5. **Deploy WuzAPI no Fly.io**
6. **Integrar WuzAPI com o frontend**
7. **Implementar Landing Page (migrar do front-google)**
8. **Implementar Painel de Teste**
9. **Testes end-to-end do fluxo zero-friction**
10. **Dashboard básico**
11. **Integrar pagamentos (Abacate Pay)**
12. **Monitoramento e alertas**
13. **Documentação da API**
14. **Beta launch**
