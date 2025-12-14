# Plan 04: Database Schema & Foundation

> **Status:** DRAFT - Em discussão
> **Dependências:** plan-01 ✅, plan-02 ✅, plan-03 🟡, plan-03-b 🟡
> **Objetivo:** Implementar o banco de dados completo com suporte a multi-tenancy, métricas e preparação para modo agência

---

## 1. Visão Geral

Este plano implementa a fundação de dados do LivChat, incluindo:

- Schema completo no Neon (PostgreSQL) via Drizzle ORM
- Multi-tenancy com hierarquia (Platform → Agency → Client)
- Sistema de métricas inspirado no Chatwoot (`events` table)
- Sessões anônimas com anti-abuse (Fingerprint + IP + Cookie)
- Webhook handler para processar eventos do WuzAPI
- Integração com AbacatePay para pagamentos (PIX + Cartão)
- Preparação para modo agência (white-label futuro)

---

## 2. Decisões Arquiteturais

### 2.1 Decisões Tomadas ✅

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| **ORM** | Drizzle | Type-safe, edge-compatible, já configurado |
| **Database** | Neon PostgreSQL | Serverless, branching, free tier generoso |
| **Multi-tenancy** | Shared DB, Shared Schema | Simples, `organization_id` em todas tabelas |
| **Hierarquia** | Platform → Agency → Client | `organizations.parentId` para hierarquia |
| **Métricas** | Single `events` table | Inspirado no Chatwoot `reporting_events` |
| **Agregação** | On-demand (não pré-calculada) | Índices compostos, queries simples |
| **Auth provider** | Clerk (desacoplado) | `users.externalId` + `externalProvider` |
| **Anti-abuse anônimo** | Cookie + Fingerprint + IP | ThumbmarkJS (MIT), 4 camadas de proteção |
| **Webhooks** | Global nosso + roteia para cliente | Garante métricas, retry independente |
| **Background jobs** | QStash (Upstash) | HTTP-based, serverless-friendly, já configurado |
| **Cleanup sessões** | 30 dias inatividade | Cron job via QStash |
| **Pagamentos** | AbacatePay | PIX nativo, taxas BR competitivas, SDK simples |
| **API subdomain** | `api.livchat.ai` | Padrão da indústria, mesmo projeto Vercel |
| **Soft delete** | Seletivo por tabela | Críticos: soft, efêmeros: hard |
| **Error tracking** | Sentry | Padrão indústria, integração Vercel |
| **Feature flags** | Statsig | Integração nativa Vercel, Edge Config |
| **Cache/Rate limit** | Upstash Redis | Serverless, REST API, já configurado |

### 2.2 Soft Delete vs Hard Delete

| Tabela | Tipo | Justificativa |
|--------|------|---------------|
| `organizations` | Soft delete (`deletedAt`) | Histórico de billing, pode reativar |
| `users` | Soft delete (`deletedAt`) | Pode reativar conta, compliance |
| `instances` | Soft delete (`deletedAt`) | Reconectar WhatsApp, histórico |
| `memberships` | Hard delete | Sem necessidade de histórico |
| `anonymous_sessions` | Hard delete | Cleanup automático 30 dias |
| `events` | Hard delete + retenção | Cleanup após 90 dias |
| `subscriptions` | Append-only (nunca deleta) | Histórico de pagamentos |
| `webhook_logs` | Hard delete + retenção | Cleanup após 30 dias |

### 2.3 Pontos em Discussão 🟡

| Ponto | Opções | Status |
|-------|--------|--------|
| Row-Level Security | RLS Postgres vs application-level | Application-level por ora |
| Business hours | Coluna `valueInBusinessHours` | Futuro |
| LiveChat real-time | Schema para chat de atendimento | Futuro (não Plan 04) |
| Partitioning events | Particionar por data | Avaliar quando > 1M rows |

---

## 3. Stack de Integrações

### 3.1 Configuradas ✅

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  INTEGRAÇÕES CONFIGURADAS                                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Database        │ Neon PostgreSQL (Drizzle ORM)                           │
│  Auth            │ Clerk (webhook sync, desacoplado)                       │
│  Payments        │ AbacatePay (PIX + Cartão, testado ✅)                   │
│  Cache           │ Upstash Redis (rate limiting, sessions)                 │
│  Queue           │ Upstash QStash (background jobs, cron)                  │
│  Error Tracking  │ Sentry (pacote instalado)                               │
│  Feature Flags   │ Statsig (pacote instalado)                              │
│  WhatsApp        │ WuzAPI (self-hosted, Fly.io)                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Environment Variables

```bash
# Database (Neon)
DATABASE_URL=
DATABASE_URL_UNPOOLED=

# Auth (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# WhatsApp (WuzAPI)
WUZAPI_URL=
WUZAPI_ADMIN_TOKEN=
WUZAPI_INTERNAL_TOKEN=

# Error Tracking (Sentry)
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_AUTH_TOKEN=
SENTRY_ORG=
SENTRY_PROJECT=

# Feature Flags (Statsig)
NEXT_PUBLIC_STATSIG_CLIENT_KEY=
STATSIG_SERVER_API_KEY=

# Cache (Upstash Redis)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Queue (Upstash QStash)
QSTASH_URL=
QSTASH_TOKEN=
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=

# Payments (AbacatePay)
ABACATEPAY_API_KEY=
ABACATEPAY_WEBHOOK_SECRET=
```

---

## 4. Hierarquia Multi-Tenant

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PLATFORM (type: 'platform')                                                │
│  └── LivChat Platform (id: fixo, parentId: null)                           │
│                                                                             │
│      ├── AGENCY: LivChat Direct (type: 'agency', isDefault: true)          │
│      │   └── Clientes que compram direto no livchat.ai                     │
│      │       ├── Cliente Direto 1 (type: 'client')                         │
│      │       ├── Cliente Direto 2                                          │
│      │       └── ...                                                        │
│      │                                                                      │
│      ├── AGENCY: Agência Acme (type: 'agency', white-label)                │
│      │   └── Clientes da Acme (app.acmewhatsapp.com)                       │
│      │       ├── Cliente Acme 1 (type: 'client')                           │
│      │       └── ...                                                        │
│      │                                                                      │
│      └── AGENCY: Agência XYZ (type: 'agency', white-label)                 │
│          └── ...                                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Regras:**
- Todo `client` TEM um `parentId` apontando para uma `agency`
- Clientes diretos vão para "LivChat Direct" (agência default)
- Agências pagam à plataforma, clientes pagam às agências
- Platform owner vê tudo, agency vê seus clients, client vê só seus dados

---

## 5. Sistema Anti-Abuse (Sessões Anônimas)

### 5.1 Arquitetura de 4 Camadas

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CAMADA 1: Cookie + Fingerprint (Identificação)                             │
│  • ThumbmarkJS gera fingerprint no browser                                  │
│  • Hash salvo em cookie httpOnly (30 dias)                                  │
│  • Header X-Device-Id enviado nas requests                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  CAMADA 2: Rate Limit por Device (Upstash Redis)                            │
│  • Key: anon:device:{deviceId}:{date}                                       │
│  • Limite: 3 sessões por device por dia                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  CAMADA 3: Rate Limit por IP (Fallback)                                     │
│  • Key: anon:ip:{ip}:{date}                                                 │
│  • Limite: 10 sessões por IP por dia (mais alto, escritórios)               │
├─────────────────────────────────────────────────────────────────────────────┤
│  CAMADA 4: Limite Global do Sistema                                         │
│  • Máximo: 500 sessões anônimas ativas                                      │
│  • Cleanup: Sessões inativas há 30 dias são deletadas                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Fluxo de Sessão Anônima

```
1. Visitante acessa LP
2. Frontend gera fingerprint (ThumbmarkJS)
3. POST /api/public/session com X-Device-Id header
4. Backend valida camadas 1-4
5. Cria user no WuzAPI (individual, não compartilhado)
6. Salva em `anonymous_sessions`
7. Retorna token para o frontend
8. Visitante pode escanear QR e testar (50 msgs/dia)
9. Ao criar conta, sessão migra para conta real
```

---

## 6. Sistema de Métricas (Inspirado no Chatwoot)

### 6.1 Filosofia

**Uma única tabela `events`** para todos os tipos de métricas:
- Flexível: novo tipo de evento = novo `name`, sem migration
- Simples: agregação on-demand com bons índices
- Performático: índice composto `(organization_id, name, created_at)`

### 6.2 Event Names

| name | value | direction | Descrição |
|------|-------|-----------|-----------|
| `message_sent` | 1 | outbound | Mensagem enviada |
| `message_received` | 1 | inbound | Mensagem recebida |
| `media_sent` | bytes | outbound | Mídia enviada |
| `media_received` | bytes | inbound | Mídia recebida |
| `instance_connected` | null | null | Instância conectou |
| `instance_disconnected` | null | null | Instância desconectou |
| `webhook_triggered` | 1 | outbound | Webhook do cliente chamado |
| `webhook_failed` | 1 | outbound | Webhook falhou |
| `api_call` | 1 | inbound | Chamada de API |
| `billing_paid` | amount | null | Pagamento confirmado |
| `billing_failed` | amount | null | Pagamento falhou |

### 6.3 Queries Comuns

```sql
-- Mensagens hoje (dashboard)
SELECT
  COUNT(*) FILTER (WHERE name = 'message_sent') as sent,
  COUNT(*) FILTER (WHERE name = 'message_received') as received
FROM events
WHERE organization_id = ?
  AND created_at >= CURRENT_DATE
  AND name IN ('message_sent', 'message_received');

-- Sparkline 7 dias
SELECT DATE(created_at) as date, COUNT(*) as total
FROM events
WHERE organization_id = ?
  AND name IN ('message_sent', 'message_received')
  AND created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date;

-- Quota do mês
SELECT COUNT(*) as used
FROM events
WHERE organization_id = ?
  AND name IN ('message_sent', 'message_received')
  AND created_at >= DATE_TRUNC('month', CURRENT_DATE);

-- Activity feed (últimos 10)
SELECT * FROM events
WHERE organization_id = ?
  AND name IN ('message_sent', 'message_received')
ORDER BY created_at DESC
LIMIT 10;
```

---

## 7. Webhook Architecture

### 7.1 Fluxo WuzAPI → LivChat → Cliente

```
┌─────────────┐     ┌──────────────────────────────────────────────────────┐
│   WuzAPI    │────►│  POST api.livchat.ai/webhooks/wuzapi                 │
│  (Fly.io)   │     │                                                      │
└─────────────┘     │  1. Validar HMAC (segurança)                         │
                    │  2. Identificar instância pelo token                 │
                    │  3. Salvar evento em `events` table                  │
                    │  4. Atualizar status da instância (se necessário)    │
                    │  5. Enqueue roteamento via QStash (async)            │
                    │  6. Retornar 200 OK                                  │
                    └──────────────────────────────────────────────────────┘
                                         │
                                         ▼
                    ┌──────────────────────────────────────────────────────┐
                    │  QStash → POST api.livchat.ai/webhooks/deliver       │
                    │                                                      │
                    │  1. Buscar webhook_url do cliente                    │
                    │  2. Assinar payload com HMAC do cliente              │
                    │  3. POST para webhook do cliente                     │
                    │  4. Salvar resultado em `webhook_logs`               │
                    │  5. Retry automático se falhar (QStash built-in)     │
                    └──────────────────────────────────────────────────────┘
```

### 7.2 Fluxo AbacatePay → LivChat

```
┌─────────────┐     ┌──────────────────────────────────────────────────────┐
│ AbacatePay  │────►│  POST api.livchat.ai/webhooks/abacatepay             │
│             │     │                                                      │
└─────────────┘     │  1. Validar secret (query param ou HMAC)             │
                    │  2. Identificar billing pelo ID                      │
                    │  3. Atualizar subscription status                    │
                    │  4. Registrar evento billing_paid/failed             │
                    │  5. Liberar/bloquear features                        │
                    │  6. Retornar 200 OK                                  │
                    └──────────────────────────────────────────────────────┘
```

---

## 8. Database Schema (Drizzle)

### 8.1 Estrutura de Arquivos

```
src/server/db/
├── index.ts           # Client Drizzle
├── schema.ts          # Re-export de todos schemas
└── schemas/
    ├── organizations.ts
    ├── users.ts
    ├── memberships.ts
    ├── instances.ts
    ├── anonymous-sessions.ts
    ├── events.ts
    ├── subscriptions.ts
    ├── webhook-logs.ts
    └── index.ts
```

### 8.2 Schema Completo

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// ENUMS
// ═══════════════════════════════════════════════════════════════════════════

export const organizationTypeEnum = pgEnum('organization_type', [
  'platform',
  'agency',
  'client'
]);

export const organizationStatusEnum = pgEnum('organization_status', [
  'active',
  'suspended',
  'cancelled'
]);

export const membershipRoleEnum = pgEnum('membership_role', [
  'owner',
  'admin',
  'member',
  'viewer'
]);

export const instanceStatusEnum = pgEnum('instance_status', [
  'disconnected',
  'connecting',
  'connected'
]);

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'trialing',
  'active',
  'past_due',
  'cancelled'
]);

// ═══════════════════════════════════════════════════════════════════════════
// ORGANIZATIONS (Multi-tenant hierarchy)
// ═══════════════════════════════════════════════════════════════════════════

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Hierarchy
  parentId: uuid('parent_id').references(() => organizations.id),
  type: organizationTypeEnum('type').notNull(),
  isDefault: boolean('is_default').default(false), // LivChat Direct

  // Identity
  name: text('name').notNull(),
  slug: text('slug').unique(),

  // White-label (agencies only)
  customDomain: text('custom_domain'),
  brandingLogo: text('branding_logo'),
  brandingPrimaryColor: text('branding_primary_color'),

  // Billing (AbacatePay)
  abacateCustomerId: text('abacate_customer_id'),
  billingEmail: text('billing_email'),

  // Limits (can be overridden per org)
  maxInstances: integer('max_instances'),
  maxUsers: integer('max_users'),
  maxMessagesPerMonth: integer('max_messages_per_month'),

  // Settings (flexible)
  settings: jsonb('settings').$type<{
    timezone?: string;
    locale?: string;
    [key: string]: unknown;
  }>(),

  // Status
  status: organizationStatusEnum('status').default('active'),

  // Soft delete
  deletedAt: timestamp('deleted_at'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  parentIdx: index('idx_org_parent').on(table.parentId),
  typeIdx: index('idx_org_type').on(table.type),
  slugIdx: uniqueIndex('idx_org_slug').on(table.slug),
}));

// ═══════════════════════════════════════════════════════════════════════════
// USERS (Clerk-synced, can belong to multiple orgs)
// ═══════════════════════════════════════════════════════════════════════════

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),

  // External auth (Clerk, but decoupled)
  externalId: text('external_id').unique(),
  externalProvider: text('external_provider').default('clerk'),

  // Profile
  email: text('email').notNull().unique(),
  name: text('name'),
  avatarUrl: text('avatar_url'),

  // Platform-level (super admin only)
  platformRole: text('platform_role'), // 'super_admin' | 'admin' | 'support'

  // Soft delete
  deletedAt: timestamp('deleted_at'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ═══════════════════════════════════════════════════════════════════════════
// MEMBERSHIPS (User ↔ Organization, many-to-many)
// ═══════════════════════════════════════════════════════════════════════════

export const memberships = pgTable('memberships', {
  id: uuid('id').primaryKey().defaultRandom(),

  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),

  // Role in this organization
  role: membershipRoleEnum('role').notNull().default('member'),

  // Granular permissions (optional override)
  permissions: jsonb('permissions').$type<{
    canManageInstances?: boolean;
    canManageUsers?: boolean;
    canManageBilling?: boolean;
    canViewReports?: boolean;
    instanceIds?: string[]; // Restrict to specific instances
  }>(),

  // Status
  status: text('status').default('active'), // 'active' | 'invited' | 'suspended'
  invitedAt: timestamp('invited_at'),
  joinedAt: timestamp('joined_at'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userOrgIdx: uniqueIndex('idx_membership_user_org').on(table.userId, table.organizationId),
  orgIdx: index('idx_membership_org').on(table.organizationId),
}));

// ═══════════════════════════════════════════════════════════════════════════
// INSTANCES (WhatsApp connections, owned by client orgs)
// ═══════════════════════════════════════════════════════════════════════════

export const instances = pgTable('instances', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Owner (always a 'client' organization)
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),

  // Friendly name
  name: text('name').notNull(),

  // WuzAPI reference
  wuzapiUserId: text('wuzapi_user_id').notNull(),
  wuzapiToken: text('wuzapi_token').notNull(),

  // WhatsApp info (populated after connection)
  whatsappJid: text('whatsapp_jid'),
  whatsappName: text('whatsapp_name'),
  whatsappPictureUrl: text('whatsapp_picture_url'),

  // Status
  status: instanceStatusEnum('status').default('disconnected'),
  lastConnectedAt: timestamp('last_connected_at'),
  lastDisconnectedAt: timestamp('last_disconnected_at'),

  // Client's webhook (we route to this)
  webhookUrl: text('webhook_url'),
  webhookEvents: jsonb('webhook_events').$type<string[]>(),
  webhookHmacKey: text('webhook_hmac_key'),

  // Soft delete
  deletedAt: timestamp('deleted_at'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('idx_instance_org').on(table.organizationId),
  wuzapiUserIdx: uniqueIndex('idx_instance_wuzapi_user').on(table.wuzapiUserId),
}));

// ═══════════════════════════════════════════════════════════════════════════
// ANONYMOUS SESSIONS (Pre-login, for LP demo) - HARD DELETE
// ═══════════════════════════════════════════════════════════════════════════

export const anonymousSessions = pgTable('anonymous_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Identification
  anonymousToken: text('anonymous_token').notNull().unique(),
  deviceFingerprint: text('device_fingerprint'), // ThumbmarkJS hash
  ipAddress: text('ip_address').notNull(),
  userAgent: text('user_agent'),

  // WuzAPI reference (individual instance per session)
  wuzapiUserId: text('wuzapi_user_id'),
  wuzapiToken: text('wuzapi_token'),

  // WhatsApp state
  whatsappJid: text('whatsapp_jid'),
  isConnected: boolean('is_connected').default(false),

  // Usage limits
  messagesUsedToday: integer('messages_used_today').default(0),
  lastMessageAt: timestamp('last_message_at'),
  lastMessageResetAt: timestamp('last_message_reset_at'),

  // Activity tracking
  lastSeenAt: timestamp('last_seen_at').defaultNow(),

  // Migration to real account
  migratedToUserId: uuid('migrated_to_user_id').references(() => users.id),
  migratedToOrgId: uuid('migrated_to_org_id').references(() => organizations.id),
  migratedAt: timestamp('migrated_at'),

  // Lifecycle (hard delete after 30 days)
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at'),
}, (table) => ({
  tokenIdx: uniqueIndex('idx_anon_token').on(table.anonymousToken),
  deviceIdx: index('idx_anon_device').on(table.deviceFingerprint),
  ipIdx: index('idx_anon_ip').on(table.ipAddress),
  expiresIdx: index('idx_anon_expires').on(table.expiresAt),
}));

// ═══════════════════════════════════════════════════════════════════════════
// EVENTS (Metrics & Activity) - HARD DELETE após 90 dias
// ═══════════════════════════════════════════════════════════════════════════

export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Scoping
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  instanceId: uuid('instance_id').references(() => instances.id, { onDelete: 'set null' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),

  // Event identification
  name: text('name').notNull(),

  // Values
  value: real('value'),
  valueInBusinessHours: real('value_in_business_hours'),

  // Context
  direction: text('direction'), // 'inbound' | 'outbound'
  contactJid: text('contact_jid'),
  contactName: text('contact_name'),
  messageId: text('message_id'),
  mediaType: text('media_type'),

  // Flexible metadata
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),

  // Timestamps
  eventAt: timestamp('event_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  orgNameCreatedIdx: index('idx_events_org_name_created').on(
    table.organizationId,
    table.name,
    table.createdAt
  ),
  orgCreatedIdx: index('idx_events_org_created').on(
    table.organizationId,
    table.createdAt
  ),
  messageIdIdx: index('idx_events_message_id').on(table.messageId),
  instanceIdx: index('idx_events_instance').on(table.instanceId),
}));

// ═══════════════════════════════════════════════════════════════════════════
// SUBSCRIPTIONS (Billing - AbacatePay) - NUNCA DELETA
// ═══════════════════════════════════════════════════════════════════════════

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),

  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),

  // Plan
  plan: text('plan').notNull(), // 'free', 'starter', 'pro', 'scale', 'agency'

  // Pricing
  priceMonthly: integer('price_monthly'), // In centavos (R$ 99,00 = 9900)
  currency: text('currency').default('BRL'),

  // AbacatePay
  abacateBillingId: text('abacate_billing_id'),
  abacateCustomerId: text('abacate_customer_id'),

  // Status
  status: subscriptionStatusEnum('status').default('trialing'),
  currentPeriodStart: timestamp('current_period_start'),
  currentPeriodEnd: timestamp('current_period_end'),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('idx_subscription_org').on(table.organizationId),
  abacateIdx: index('idx_subscription_abacate').on(table.abacateBillingId),
}));

// ═══════════════════════════════════════════════════════════════════════════
// WEBHOOK LOGS (Debug) - HARD DELETE após 30 dias
// ═══════════════════════════════════════════════════════════════════════════

export const webhookLogs = pgTable('webhook_logs', {
  id: uuid('id').primaryKey().defaultRandom(),

  instanceId: uuid('instance_id').references(() => instances.id, { onDelete: 'cascade' }),

  // Request
  eventType: text('event_type').notNull(),
  payload: jsonb('payload'),

  // Delivery
  deliveryStatus: text('delivery_status'), // 'pending', 'delivered', 'failed'
  deliveryAttempts: integer('delivery_attempts').default(0),
  lastAttemptAt: timestamp('last_attempt_at'),

  // Response
  responseStatus: integer('response_status'),
  responseBody: text('response_body'),
  responseTimeMs: integer('response_time_ms'),

  // Error
  errorMessage: text('error_message'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  instanceIdx: index('idx_webhook_log_instance').on(table.instanceId),
  createdIdx: index('idx_webhook_log_created').on(table.createdAt),
}));
```

---

## 9. Endpoints a Implementar

### 9.1 Public API (Anônimo)

| Method | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `api.livchat.ai/public/session` | Criar sessão anônima |
| GET | `api.livchat.ai/public/status` | Status da conexão |
| POST | `api.livchat.ai/public/connect` | Iniciar conexão WhatsApp |
| GET | `api.livchat.ai/public/qr` | Obter QR code |
| POST | `api.livchat.ai/public/pairing` | Gerar pairing code |
| POST | `api.livchat.ai/public/send` | Enviar mensagem teste |
| POST | `api.livchat.ai/public/disconnect` | Desconectar |

### 9.2 Webhook Handlers

| Method | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `api.livchat.ai/webhooks/wuzapi` | Receber eventos do WuzAPI |
| POST | `api.livchat.ai/webhooks/clerk` | Sync de usuários Clerk |
| POST | `api.livchat.ai/webhooks/abacatepay` | Eventos de pagamento |
| POST | `api.livchat.ai/webhooks/deliver` | Roteamento para cliente (via QStash) |

### 9.3 tRPC Routers (Autenticado)

| Router | Procedures |
|--------|------------|
| `organizations` | list, get, update, delete |
| `instances` | list, get, create, delete, connect, disconnect, getQr |
| `metrics` | today, week, month, sparkline, activity |
| `users` | me, update, listMembers, inviteMember |
| `billing` | getSubscription, getUsage, createCheckout, cancelSubscription |
| `webhooks` | get, set, delete, logs |

---

## 10. Seed Data

```typescript
// Executado no setup inicial

// Platform organization
const platformOrg = await db.insert(organizations).values({
  type: 'platform',
  name: 'LivChat Platform',
  slug: 'platform',
  parentId: null,
}).returning();

// Default agency (LivChat Direct)
const defaultAgency = await db.insert(organizations).values({
  type: 'agency',
  name: 'LivChat Direct',
  slug: 'direct',
  parentId: platformOrg[0].id,
  isDefault: true,
}).returning();
```

---

## 11. Background Jobs (QStash)

### 11.1 Cron Jobs

| Job | Schedule | Endpoint | Descrição |
|-----|----------|----------|-----------|
| Cleanup sessions | `0 3 * * *` (3am daily) | `/api/cron/cleanup-sessions` | Delete sessões > 30 dias |
| Reset message counters | `0 0 * * *` (meia-noite) | `/api/cron/reset-counters` | Reset `messagesUsedToday` |
| Cleanup events | `0 4 * * 0` (domingo 4am) | `/api/cron/cleanup-events` | Delete eventos > 90 dias |
| Cleanup webhook logs | `0 4 * * 0` (domingo 4am) | `/api/cron/cleanup-logs` | Delete logs > 30 dias |

### 11.2 Async Jobs

| Job | Trigger | Descrição |
|-----|---------|-----------|
| Deliver webhook | Evento WuzAPI | Rotear para webhook do cliente |
| Send welcome email | User created | Email de boas-vindas |
| Process payment | billing.paid | Atualizar subscription |

---

## 12. Tarefas de Implementação

### Fase 1: Schema Base
- [ ] Criar arquivos de schema em `src/server/db/schemas/`
- [ ] Configurar exports em `src/server/db/schema.ts`
- [ ] Gerar migrations
- [ ] Aplicar migrations no Neon
- [ ] Criar seed data (platform + default agency)

### Fase 2: Sessões Anônimas
- [ ] Implementar `lib/fingerprint.ts` (ThumbmarkJS)
- [ ] Criar hook `useDeviceId`
- [ ] Implementar `/api/public/session`
- [ ] Configurar Redis para rate limiting (Upstash)
- [ ] Migrar demo router para usar sessions individuais

### Fase 3: Webhook Handlers
- [ ] Criar `/api/webhooks/wuzapi`
- [ ] Criar `/api/webhooks/abacatepay`
- [ ] Criar `/api/webhooks/clerk`
- [ ] Implementar processamento de eventos
- [ ] Salvar em `events` table
- [ ] Implementar roteamento via QStash

### Fase 4: Métricas tRPC
- [ ] Criar router `metrics`
- [ ] Implementar queries (today, sparkline, activity)
- [ ] Conectar dashboard widgets aos dados reais
- [ ] Remover mock data

### Fase 5: Billing
- [ ] Criar router `billing`
- [ ] Implementar `createCheckout` (AbacatePay)
- [ ] Processar webhook `billing.paid`
- [ ] Liberar features por plano

### Fase 6: Background Jobs
- [ ] Configurar QStash cron jobs
- [ ] Implementar cleanup endpoints
- [ ] Implementar reset de contadores

---

## 13. Dependências a Adicionar

```bash
# Fingerprinting
bun add @aspect/thumbmark

# Já instalados
# @upstash/redis
# @upstash/qstash
# abacatepay-nodejs-sdk
# @sentry/nextjs
# statsig-node
# @statsig/react-bindings
```

---

## 14. Referências

- **Chatwoot**: `reporting_events` pattern para métricas
- **BuildZero Core-Agent**: Multi-tenancy com organizations + memberships
- **Jina.ai**: Modelo de tokens anônimos com rate limiting
- **GoHighLevel**: Hierarquia agency → client para white-label
- **ThumbmarkJS**: Fingerprinting open-source (MIT)
- **AbacatePay**: SDK Node.js para pagamentos

---

## Changelog

- **2024-12-04**: Draft inicial
- **2024-12-04**: Atualizado com AbacatePay, QStash, soft delete, api subdomain
