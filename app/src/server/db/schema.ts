import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  uniqueIndex,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";

// ═══════════════════════════════════════════════════════════════════════════
// DEVICES (Browser/Cookie tracking)
// ═══════════════════════════════════════════════════════════════════════════

export const devices = pgTable(
  "devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Identificação
    token: text("token").notNull().unique(), // Cookie value (UUID)
    fingerprint: text("fingerprint"), // ThumbmarkJS (futuro)
    ipAddress: text("ip_address").notNull(),
    userAgent: text("user_agent"),

    // Lifecycle
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("idx_device_token").on(t.token),
    index("idx_device_expires").on(t.expiresAt),
  ]
);

// ═══════════════════════════════════════════════════════════════════════════
// USERS (Desacoplado do Clerk)
// ═══════════════════════════════════════════════════════════════════════════

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Auth provider (desacoplado)
    externalId: text("external_id").unique(), // Clerk user_id
    externalProvider: text("external_provider").default("clerk"),

    // Profile (nosso, sync do Clerk)
    email: text("email").notNull().unique(),
    name: text("name"),
    avatarUrl: text("avatar_url"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("idx_user_external").on(t.externalId),
    uniqueIndex("idx_user_email").on(t.email),
  ]
);

// ═══════════════════════════════════════════════════════════════════════════
// ORGANIZATIONS (1:1 com user no MVP, multi-tenant futuro)
// ═══════════════════════════════════════════════════════════════════════════

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Ownership
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Identity
    name: text("name").notNull(),
    slug: text("slug").unique(),

    // Plan & Limits
    plan: text("plan").notNull().default("free"), // 'free' | 'pro' | 'enterprise'
    maxInstances: integer("max_instances").notNull().default(1),
    maxMessagesPerDay: integer("max_messages_per_day").notNull().default(50),

    // Billing (AbacatePay - desacoplado)
    billingCustomerId: text("billing_customer_id"),
    billingSubscriptionId: text("billing_subscription_id"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_org_owner").on(t.ownerId),
    uniqueIndex("idx_org_slug").on(t.slug),
  ]
);

// ═══════════════════════════════════════════════════════════════════════════
// INSTANCES (WhatsApp connections - desacoplado do WuzAPI)
// ═══════════════════════════════════════════════════════════════════════════

export const instances = pgTable(
  "instances",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Ownership (exclusivo: ou org OU device para acesso)
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    createdByDeviceId: uuid("created_by_device_id").references(
      () => devices.id,
      { onDelete: "set null" }
    ),

    // Identity
    name: text("name").notNull().default("WhatsApp"),

    // WhatsApp Provider (desacoplado)
    providerId: text("provider_id").notNull(), // wuzapi user id
    providerToken: text("provider_token").notNull(), // wuzapi token
    providerType: text("provider_type").notNull().default("wuzapi"),

    // WhatsApp Info (preenchido após conexão)
    whatsappJid: text("whatsapp_jid"),
    whatsappName: text("whatsapp_name"),
    whatsappPictureUrl: text("whatsapp_picture_url"),
    avatarSyncedAt: timestamp("avatar_synced_at", { withTimezone: true }),

    // Status
    status: text("status").notNull().default("disconnected"),
    lastConnectedAt: timestamp("last_connected_at", { withTimezone: true }),

    // Usage tracking (quota managed in Redis)
    // messagesUsedToday and lastMessageResetAt REMOVED - now tracked in Redis
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),

    // Claim tracking
    claimedAt: timestamp("claimed_at", { withTimezone: true }),

    // Activity tracking (para reutilização de órfãs)
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    reuseCount: integer("reuse_count").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_instance_org").on(t.organizationId),
    index("idx_instance_device").on(t.createdByDeviceId),
    uniqueIndex("idx_instance_provider").on(t.providerId),
    // Índice para busca de órfãs virgens (reutilização)
    index("idx_instance_orphan_virgin").on(
      t.organizationId,
      t.whatsappJid,
      t.createdAt
    ),
  ]
);

// ═══════════════════════════════════════════════════════════════════════════
// API KEYS (REST API authentication)
// Modelo: Device-Based + Claiming (mesmo ciclo de vida das Instances)
// ═══════════════════════════════════════════════════════════════════════════

export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // ═══════════════════════════════════════════════════════════════
    // OWNERSHIP (Sistema de Claiming - espelha instances)
    // ═══════════════════════════════════════════════════════════════

    // NULL = órfã (anônimo), SET = claimed (pertence a org)
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),

    // Qual device criou esta key (para claim)
    createdByDeviceId: uuid("created_by_device_id").references(
      () => devices.id,
      { onDelete: "set null" }
    ),

    // Instance que gerou esta key (CASCADE = deleta junto)
    instanceId: uuid("instance_id")
      .notNull()
      .references(() => instances.id, { onDelete: "cascade" }),

    // ═══════════════════════════════════════════════════════════════
    // IDENTIFICAÇÃO
    // ═══════════════════════════════════════════════════════════════

    name: text("name").notNull().default("Default"),

    // Token (plaintext - Chatwoot approach)
    // Format: lc_live_Xk9m2nP8qR4sT6uV8wX0yZ1a2b3c (40 chars)
    // UNIQUE index for O(1) lookup
    token: text("token").notNull().unique(),

    // ═══════════════════════════════════════════════════════════════
    // PERMISSÕES
    // ═══════════════════════════════════════════════════════════════

    scopes: text("scopes")
      .array()
      .notNull()
      .default(sql`ARRAY['whatsapp:*']::text[]`),
    rateLimitRequests: integer("rate_limit_requests").notNull().default(100),
    rateLimitWindowSeconds: integer("rate_limit_window_seconds")
      .notNull()
      .default(60),

    // ═══════════════════════════════════════════════════════════════
    // STATUS
    // ═══════════════════════════════════════════════════════════════

    isActive: boolean("is_active").notNull().default(true),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),

    // ═══════════════════════════════════════════════════════════════
    // TIMESTAMPS
    // ═══════════════════════════════════════════════════════════════

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_api_key_org").on(t.organizationId),
    index("idx_api_key_device").on(t.createdByDeviceId),
    index("idx_api_key_instance").on(t.instanceId),
  ]
);

// ═══════════════════════════════════════════════════════════════════════════
// WEBHOOKS (User-configured webhook endpoints)
// ═══════════════════════════════════════════════════════════════════════════

export const webhooks = pgTable(
  "webhooks",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Ownership
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    // Identificação
    name: text("name").notNull().default("Webhook"),
    url: text("url").notNull(), // Deve ser HTTPS em produção

    // Segurança (opcionais)
    signingSecret: text("signing_secret"), // min 32 chars se fornecido
    headers: jsonb("headers").$type<Record<string, string>>(), // {"X-Custom": "value"}

    // Filtros (NULL = todos, '*')
    instanceIds: uuid("instance_ids").array(), // NULL = todas instâncias
    subscriptions: text("subscriptions").array(), // NULL = todos eventos

    // Status
    isActive: boolean("is_active").notNull().default(true),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_webhooks_org_active").on(t.organizationId, t.isActive),
    index("idx_webhooks_org").on(t.organizationId),
  ]
);

// ═══════════════════════════════════════════════════════════════════════════
// EVENTS (Event Log para tracking de uso - Chatwoot-inspired)
// ═══════════════════════════════════════════════════════════════════════════

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Tipo do evento (dot notation: 'message.sent', 'api.call', etc)
    name: text("name").notNull(),

    // Contexto (foreign keys - todas opcionais para flexibilidade)
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    instanceId: uuid("instance_id").references(() => instances.id, {
      onDelete: "cascade",
    }),
    apiKeyId: uuid("api_key_id").references(() => apiKeys.id, {
      onDelete: "set null",
    }),
    deviceId: uuid("device_id").references(() => devices.id, {
      onDelete: "set null",
    }),

    // Valor numérico (para métricas: 1 = default, pode ser usado para batch)
    value: integer("value").notNull().default(1),

    // Metadata opcional (JSON para dados extras do evento)
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),

    // Timestamp (apenas createdAt - eventos são imutáveis)
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    // Índice composto CRÍTICO para queries de agregação por org
    index("idx_events_org_name_created").on(
      t.organizationId,
      t.name,
      t.createdAt
    ),
    // Índice para queries por instance + período
    index("idx_events_instance_created").on(t.instanceId, t.createdAt),
    // Índice para filtrar por tipo de evento
    index("idx_events_name").on(t.name),
  ]
);

// ═══════════════════════════════════════════════════════════════════════════
// RELATIONS (Drizzle)
// ═══════════════════════════════════════════════════════════════════════════

export const usersRelations = relations(users, ({ many }) => ({
  organizations: many(organizations),
}));

export const organizationsRelations = relations(
  organizations,
  ({ one, many }) => ({
    owner: one(users, {
      fields: [organizations.ownerId],
      references: [users.id],
    }),
    instances: many(instances),
    apiKeys: many(apiKeys),
    webhooks: many(webhooks),
  })
);

export const instancesRelations = relations(instances, ({ one }) => ({
  organization: one(organizations, {
    fields: [instances.organizationId],
    references: [organizations.id],
  }),
  createdByDevice: one(devices, {
    fields: [instances.createdByDeviceId],
    references: [devices.id],
  }),
}));

export const devicesRelations = relations(devices, ({ many }) => ({
  instances: many(instances),
  apiKeys: many(apiKeys),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  organization: one(organizations, {
    fields: [apiKeys.organizationId],
    references: [organizations.id],
  }),
  createdByDevice: one(devices, {
    fields: [apiKeys.createdByDeviceId],
    references: [devices.id],
  }),
  instance: one(instances, {
    fields: [apiKeys.instanceId],
    references: [instances.id],
  }),
}));

export const webhooksRelations = relations(webhooks, ({ one }) => ({
  organization: one(organizations, {
    fields: [webhooks.organizationId],
    references: [organizations.id],
  }),
}));

export const eventsRelations = relations(events, ({ one }) => ({
  organization: one(organizations, {
    fields: [events.organizationId],
    references: [organizations.id],
  }),
  instance: one(instances, {
    fields: [events.instanceId],
    references: [instances.id],
  }),
  apiKey: one(apiKeys, {
    fields: [events.apiKeyId],
    references: [apiKeys.id],
  }),
  device: one(devices, {
    fields: [events.deviceId],
    references: [devices.id],
  }),
}));
