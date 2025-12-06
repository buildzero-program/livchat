import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  uniqueIndex,
} from "drizzle-orm/pg-core";
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

    // Status
    status: text("status").notNull().default("disconnected"),
    lastConnectedAt: timestamp("last_connected_at", { withTimezone: true }),

    // Usage (lazy reset diário)
    messagesUsedToday: integer("messages_used_today").notNull().default(0),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    lastMessageResetAt: timestamp("last_message_reset_at", {
      withTimezone: true,
    }).defaultNow(),

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
}));
