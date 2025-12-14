# Plan 04.1: Database & Individual Instances

> **Status:** PRONTO PARA IMPLEMENTAR
> **Dependências:** plan-01 ✅, plan-02 ✅, plan-03 ✅
> **Objetivo:** Migrar de instância compartilhada para instâncias individuais por device/user
> **Metodologia:** Incremental, sem quebrar o que funciona

---

## 1. Situação Atual

### 1.1 O que existe hoje

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ARQUITETURA ATUAL (Problemática)                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Browser A ──┐                                                              │
│  Browser B ──┼──► demo.status() ──► INSTÂNCIA COMPARTILHADA ──► WuzAPI     │
│  Browser C ──┘         │                    │                               │
│                        │                    │                               │
│                        ▼                    ▼                               │
│                   Em memória           Mesmo QR code                        │
│                  (perde no restart)    (todos veem tudo)                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Problemas:**
- Todos visitantes compartilham mesma sessão WhatsApp
- Estado perdido quando servidor reinicia
- Impossível medir uso por pessoa
- Sem caminho para monetização

### 1.2 Código atual relevante

**Demo Router** (`src/server/api/routers/demo.ts`):
```typescript
// Instância global em memória
let currentInstanceToken: string | null = null;
let instanceClient: WuzAPIClient | null = null;

// Todos usam o mesmo client
async function getClient() {
  if (!instanceClient) {
    await ensureInstanceExists(); // Cria "shared" via admin API
    instanceClient = new WuzAPIClient({ baseUrl, token: currentInstanceToken });
  }
  return instanceClient;
}
```

**WuzAPI Client** (`src/server/lib/wuzapi.ts`):
```typescript
// Já existe e funciona bem
export class WuzAPIClient { ... }
export async function createWuzAPIInstance(baseUrl, adminToken, name, token, events)
export async function listWuzAPIInstances(baseUrl, adminToken)
```

**Schema** (`src/server/db/schema.ts`):
```typescript
// Só tem tabela de exemplo
export const posts = createTable("post", ...);
```

---

## 2. Arquitetura Nova

### 2.1 Visão Geral

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ARQUITETURA NOVA (Individual)                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Browser A ──► Cookie A ──► Device A ──► Instance A ──► WuzAPI User A      │
│  Browser B ──► Cookie B ──► Device B ──► Instance B ──► WuzAPI User B      │
│  Browser C ──► Cookie C ──► Device C ──► Instance C ──► WuzAPI User C      │
│                                                                             │
│                     │                        │                              │
│                     ▼                        ▼                              │
│               PostgreSQL              Instâncias isoladas                   │
│               (persistente)           (cada um vê só o seu)                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Modelo de Dados

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│    devices ──────────┐                                                      │
│    (cookie)          │ createdByDeviceId                                    │
│         │            ▼                                                      │
│         │        instances ◄──────── organizations ◄──────── users         │
│         │        (WhatsApp)  organizationId    ownerId        (auth)       │
│         │                                                                   │
│         │                                                                   │
│    Anônimo: device.token ──► instance (org_id = NULL)                      │
│    Logado:  user ──► org ──► instance (org_id != NULL)                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Regra de Ownership

| organizationId | Quem acessa | Estado |
|----------------|-------------|--------|
| `NULL` | Device que criou (via cookie) | Anônimo |
| `uuid` | Usuários da organização | Claimed |

**Claim** = Transferência de ownership quando user cria conta

---

## 3. Schema Completo

```typescript
// src/server/db/schema.ts

import { index, pgTable, text, timestamp, uuid, integer, uniqueIndex, boolean } from "drizzle-orm/pg-core";

// ═══════════════════════════════════════════════════════════════════════════
// DEVICES (Browser/Cookie tracking)
// ═══════════════════════════════════════════════════════════════════════════

export const devices = pgTable("device", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Identificação
  token: text("token").notNull().unique(),        // Cookie value (UUID)
  fingerprint: text("fingerprint"),                // ThumbmarkJS (futuro)
  ipAddress: text("ip_address").notNull(),
  userAgent: text("user_agent"),

  // Lifecycle
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("idx_device_token").on(t.token),
  index("idx_device_expires").on(t.expiresAt),
]);

// ═══════════════════════════════════════════════════════════════════════════
// USERS (Desacoplado do Clerk)
// ═══════════════════════════════════════════════════════════════════════════

export const users = pgTable("user", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Auth provider (desacoplado)
  externalId: text("external_id").unique(),        // Clerk user_id
  externalProvider: text("external_provider").default("clerk"),

  // Profile (nosso, sync do Clerk)
  email: text("email").notNull().unique(),
  name: text("name"),
  avatarUrl: text("avatar_url"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("idx_user_external").on(t.externalId),
  uniqueIndex("idx_user_email").on(t.email),
]);

// ═══════════════════════════════════════════════════════════════════════════
// ORGANIZATIONS (1:1 com user no MVP, multi-tenant futuro)
// ═══════════════════════════════════════════════════════════════════════════

export const organizations = pgTable("organization", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Ownership
  ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),

  // Identity
  name: text("name").notNull(),
  slug: text("slug").unique(),

  // Plan & Limits
  plan: text("plan").notNull().default("free"),   // 'free' | 'pro' | 'enterprise'
  maxInstances: integer("max_instances").notNull().default(1),
  maxMessagesPerDay: integer("max_messages_per_day").notNull().default(50),

  // Billing (AbacatePay - desacoplado)
  billingCustomerId: text("billing_customer_id"),
  billingSubscriptionId: text("billing_subscription_id"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("idx_org_owner").on(t.ownerId),
  uniqueIndex("idx_org_slug").on(t.slug),
]);

// ═══════════════════════════════════════════════════════════════════════════
// INSTANCES (WhatsApp connections - desacoplado do WuzAPI)
// ═══════════════════════════════════════════════════════════════════════════

export const instances = pgTable("instance", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Ownership (exclusivo: ou org OU device para acesso)
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  createdByDeviceId: uuid("created_by_device_id").references(() => devices.id, { onDelete: "set null" }),

  // Identity
  name: text("name").notNull().default("WhatsApp"),

  // WhatsApp Provider (desacoplado)
  providerId: text("provider_id").notNull(),      // wuzapi user id
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
  lastMessageResetAt: timestamp("last_message_reset_at", { withTimezone: true }).defaultNow(),

  // Claim tracking
  claimedAt: timestamp("claimed_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("idx_instance_org").on(t.organizationId),
  index("idx_instance_device").on(t.createdByDeviceId),
  uniqueIndex("idx_instance_provider").on(t.providerId),
]);

// ═══════════════════════════════════════════════════════════════════════════
// RELATIONS (Drizzle)
// ═══════════════════════════════════════════════════════════════════════════

import { relations } from "drizzle-orm";

export const usersRelations = relations(users, ({ many }) => ({
  organizations: many(organizations),
}));

export const organizationsRelations = relations(organizations, ({ one, many }) => ({
  owner: one(users, {
    fields: [organizations.ownerId],
    references: [users.id],
  }),
  instances: many(instances),
}));

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
```

---

## 4. Implementação Fase a Fase

### Fase 1: Schema & Migrations

**Objetivo:** Criar tabelas sem quebrar nada

**Arquivos a criar/modificar:**
- `src/server/db/schema.ts` - Substituir conteúdo completo

**Comandos:**
```bash
cd /home/pedro/dev/sandbox/livchat/app
bun db:push    # Aplica schema no Neon
bun db:studio  # Verifica tabelas criadas
```

**Critério de sucesso:** 4 tabelas criadas no banco

---

### Fase 2: Device Tracking

**Objetivo:** Todo visitante recebe cookie único

**Arquivos a criar:**

#### 2.1 Constantes (`src/lib/constants.ts`)

```typescript
// Adicionar
export const DEVICE_COOKIE_NAME = "livchat_device";
export const DEVICE_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 dias em segundos
export const DEMO_MESSAGE_LIMIT = 50;
```

#### 2.2 Device Service (`src/server/lib/device.ts`)

```typescript
import { db } from "~/server/db";
import { devices } from "~/server/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { DEVICE_COOKIE_MAX_AGE } from "~/lib/constants";

export interface DeviceInfo {
  id: string;
  token: string;
  isNew: boolean;
}

/**
 * Busca device pelo token ou cria novo
 */
export async function getOrCreateDevice(
  token: string | undefined,
  ipAddress: string,
  userAgent: string | undefined
): Promise<DeviceInfo> {
  // Se tem token, tenta encontrar device válido (não expirado)
  if (token) {
    const existing = await db.query.devices.findFirst({
      where: and(
        eq(devices.token, token),
        gt(devices.expiresAt, new Date())
      ),
    });

    if (existing) {
      // Atualiza lastSeenAt
      await db.update(devices)
        .set({ lastSeenAt: new Date() })
        .where(eq(devices.id, existing.id));

      return {
        id: existing.id,
        token: existing.token,
        isNew: false,
      };
    }
  }

  // Criar novo device
  const newToken = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + DEVICE_COOKIE_MAX_AGE);

  const [newDevice] = await db.insert(devices).values({
    token: newToken,
    ipAddress,
    userAgent,
    expiresAt,
  }).returning();

  return {
    id: newDevice.id,
    token: newDevice.token,
    isNew: true,
  };
}

/**
 * Busca device pelo token
 */
export async function getDeviceByToken(token: string) {
  return db.query.devices.findFirst({
    where: and(
      eq(devices.token, token),
      gt(devices.expiresAt, new Date())
    ),
  });
}
```

#### 2.3 tRPC Context Update (`src/server/api/trpc.ts`)

```typescript
// Adicionar ao createTRPCContext
import { cookies } from "next/headers";
import { getOrCreateDevice } from "~/server/lib/device";
import { DEVICE_COOKIE_NAME, DEVICE_COOKIE_MAX_AGE } from "~/lib/constants";

export const createTRPCContext = async (opts: { headers: Headers }) => {
  const cookieStore = await cookies();
  const existingToken = cookieStore.get(DEVICE_COOKIE_NAME)?.value;

  // Extrair IP e User-Agent
  const ipAddress = opts.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? opts.headers.get("x-real-ip")
    ?? "unknown";
  const userAgent = opts.headers.get("user-agent") ?? undefined;

  // Buscar ou criar device
  const deviceInfo = await getOrCreateDevice(existingToken, ipAddress, userAgent);

  // Se novo device, setar cookie (será aplicado na response)
  // Nota: Em tRPC precisamos de outra abordagem para setar cookies
  // Vamos passar deviceInfo no contexto e tratar no cliente

  return {
    db,
    device: deviceInfo,
    headers: opts.headers,
    ...opts,
  };
};
```

#### 2.4 Device Hook Frontend (`src/hooks/useDevice.ts`)

```typescript
import { useEffect, useState } from "react";
import { DEVICE_COOKIE_NAME, DEVICE_COOKIE_MAX_AGE } from "~/lib/constants";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(";").shift() ?? null;
  }
  return null;
}

function setCookie(name: string, value: string, maxAgeSeconds: number) {
  document.cookie = `${name}=${value}; path=/; max-age=${maxAgeSeconds}; samesite=lax`;
}

export function useDevice() {
  const [deviceToken, setDeviceToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Tentar ler cookie existente
    const existing = getCookie(DEVICE_COOKIE_NAME);

    if (existing) {
      setDeviceToken(existing);
      setIsLoading(false);
    } else {
      // Gerar novo token no cliente (será sincronizado com backend na primeira request)
      const newToken = crypto.randomUUID();
      setCookie(DEVICE_COOKIE_NAME, newToken, DEVICE_COOKIE_MAX_AGE);
      setDeviceToken(newToken);
      setIsLoading(false);
    }
  }, []);

  return { deviceToken, isLoading };
}
```

**Critério de sucesso:**
- Cookie criado no primeiro acesso
- Device salvo no banco
- Mesmo cookie retorna mesmo device

---

### Fase 3: Instance Service

**Objetivo:** Criar/gerenciar instances individuais no banco

#### 3.1 Instance Service (`src/server/lib/instance.ts`)

```typescript
import { db } from "~/server/db";
import { instances, devices, organizations } from "~/server/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { WuzAPIClient, createWuzAPIInstance } from "./wuzapi";
import { env } from "~/env";

const WUZAPI_BASE_URL = env.WUZAPI_URL;
const WUZAPI_ADMIN_TOKEN = env.WUZAPI_ADMIN_TOKEN!;

export interface InstanceWithClient {
  instance: typeof instances.$inferSelect;
  client: WuzAPIClient;
}

/**
 * Gera token único para WuzAPI
 */
function generateProviderToken(): string {
  return `lc_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
}

/**
 * Gera ID único para user no WuzAPI
 */
function generateProviderId(): string {
  return `livchat_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

/**
 * Busca instance existente do device (não claimed)
 */
export async function getDeviceInstance(deviceId: string): Promise<InstanceWithClient | null> {
  const instance = await db.query.instances.findFirst({
    where: and(
      eq(instances.createdByDeviceId, deviceId),
      isNull(instances.organizationId) // Não claimed
    ),
  });

  if (!instance) return null;

  const client = new WuzAPIClient({
    baseUrl: WUZAPI_BASE_URL,
    token: instance.providerToken,
  });

  return { instance, client };
}

/**
 * Busca instance por ID com verificação de acesso
 */
export async function getInstanceWithAccess(
  instanceId: string,
  context: { deviceId?: string; organizationId?: string }
): Promise<InstanceWithClient | null> {
  const instance = await db.query.instances.findFirst({
    where: eq(instances.id, instanceId),
  });

  if (!instance) return null;

  // Verificar acesso
  const hasAccess =
    // Anônimo: device que criou + não claimed
    (instance.organizationId === null && instance.createdByDeviceId === context.deviceId) ||
    // Logado: pertence à org do user
    (instance.organizationId !== null && instance.organizationId === context.organizationId);

  if (!hasAccess) return null;

  const client = new WuzAPIClient({
    baseUrl: WUZAPI_BASE_URL,
    token: instance.providerToken,
  });

  return { instance, client };
}

/**
 * Cria nova instance para device (anônima)
 */
export async function createInstanceForDevice(deviceId: string): Promise<InstanceWithClient> {
  const providerId = generateProviderId();
  const providerToken = generateProviderToken();

  // Criar user no WuzAPI
  await createWuzAPIInstance(
    WUZAPI_BASE_URL,
    WUZAPI_ADMIN_TOKEN,
    providerId,       // name no WuzAPI
    providerToken,    // token no WuzAPI
    "Message"         // events
  );

  // Criar instance no nosso banco
  const [instance] = await db.insert(instances).values({
    createdByDeviceId: deviceId,
    organizationId: null, // Anônima
    name: "WhatsApp Demo",
    providerId,
    providerToken,
    providerType: "wuzapi",
    status: "disconnected",
  }).returning();

  const client = new WuzAPIClient({
    baseUrl: WUZAPI_BASE_URL,
    token: providerToken,
  });

  return { instance, client };
}

/**
 * Atualiza status da instance baseado no WuzAPI
 */
export async function syncInstanceStatus(instanceId: string, status: {
  connected?: boolean;
  loggedIn?: boolean;
  jid?: string;
}): Promise<void> {
  const updates: Partial<typeof instances.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (status.loggedIn !== undefined) {
    updates.status = status.loggedIn ? "connected" : "disconnected";
    if (status.loggedIn) {
      updates.lastConnectedAt = new Date();
    }
  }

  if (status.jid) {
    updates.whatsappJid = status.jid;
  }

  await db.update(instances)
    .set(updates)
    .where(eq(instances.id, instanceId));
}

/**
 * Incrementa contador de mensagens (com lazy reset)
 */
export async function incrementMessageCount(instanceId: string): Promise<{
  used: number;
  limit: number;
  remaining: number;
}> {
  const instance = await db.query.instances.findFirst({
    where: eq(instances.id, instanceId),
    with: { organization: true },
  });

  if (!instance) throw new Error("Instance not found");

  // Lazy reset: se último reset foi antes de hoje, resetar
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastReset = instance.lastMessageResetAt;
  const needsReset = !lastReset || lastReset < today;

  const currentCount = needsReset ? 0 : instance.messagesUsedToday;
  const newCount = currentCount + 1;

  // Limite: org (se claimed) ou default (50)
  const limit = instance.organization?.maxMessagesPerDay ?? 50;

  await db.update(instances)
    .set({
      messagesUsedToday: newCount,
      lastMessageAt: new Date(),
      lastMessageResetAt: needsReset ? new Date() : instance.lastMessageResetAt,
      updatedAt: new Date(),
    })
    .where(eq(instances.id, instanceId));

  return {
    used: newCount,
    limit,
    remaining: Math.max(0, limit - newCount),
  };
}

/**
 * Claim instances de um device para uma organization
 */
export async function claimDeviceInstances(
  deviceId: string,
  organizationId: string
): Promise<number> {
  const result = await db.update(instances)
    .set({
      organizationId,
      claimedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(
      eq(instances.createdByDeviceId, deviceId),
      isNull(instances.organizationId)
    ))
    .returning();

  return result.length;
}
```

**Critério de sucesso:**
- Instance criada no banco com providerId/providerToken
- WuzAPI user criado automaticamente
- Acesso controlado por device ou org

---

### Fase 4: Demo Router Refatorado

**Objetivo:** Substituir instância compartilhada por individual

#### 4.1 Novo Demo Router (`src/server/api/routers/demo.ts`)

```typescript
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import {
  getDeviceInstance,
  createInstanceForDevice,
  syncInstanceStatus,
  incrementMessageCount,
} from "~/server/lib/instance";
import { DEMO_MESSAGE_LIMIT } from "~/lib/constants";

export const demoRouter = createTRPCRouter({
  /**
   * Obter status da instância (cria se não existe)
   */
  status: publicProcedure.query(async ({ ctx }) => {
    const { device } = ctx;

    if (!device) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Device não identificado",
      });
    }

    // Buscar ou criar instance para este device
    let instanceData = await getDeviceInstance(device.id);

    if (!instanceData) {
      // Criar nova instance
      instanceData = await createInstanceForDevice(device.id);
    }

    const { instance, client } = instanceData;

    // Buscar status no WuzAPI
    try {
      const statusResponse = await client.getStatus();

      if (!statusResponse.success) {
        // Tentar conectar se não está connected
        await client.connect(["Message"]);
        const retryStatus = await client.getStatus();

        // Sync status no banco
        await syncInstanceStatus(instance.id, {
          connected: retryStatus.data?.connected,
          loggedIn: retryStatus.data?.loggedIn,
          jid: retryStatus.data?.jid,
        });

        // Buscar QR se não logado
        let qrCode: string | undefined;
        if (!retryStatus.data?.loggedIn) {
          const qrResponse = await client.getQR();
          qrCode = qrResponse.data?.qrcode;
        }

        return {
          connected: retryStatus.data?.connected ?? false,
          loggedIn: retryStatus.data?.loggedIn ?? false,
          qrCode,
          jid: retryStatus.data?.jid,
          instanceId: instance.id,
          messagesUsed: instance.messagesUsedToday,
          messagesLimit: DEMO_MESSAGE_LIMIT,
        };
      }

      // Sync status no banco
      await syncInstanceStatus(instance.id, {
        connected: statusResponse.data?.connected,
        loggedIn: statusResponse.data?.loggedIn,
        jid: statusResponse.data?.jid,
      });

      // Buscar QR se não logado
      let qrCode: string | undefined;
      if (!statusResponse.data?.loggedIn) {
        const qrResponse = await client.getQR();
        qrCode = qrResponse.data?.qrcode;
      }

      return {
        connected: statusResponse.data?.connected ?? false,
        loggedIn: statusResponse.data?.loggedIn ?? false,
        qrCode,
        jid: statusResponse.data?.jid,
        instanceId: instance.id,
        messagesUsed: instance.messagesUsedToday,
        messagesLimit: DEMO_MESSAGE_LIMIT,
      };
    } catch (error) {
      console.error("WuzAPI status error:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Erro ao obter status do WhatsApp",
      });
    }
  }),

  /**
   * Gerar pairing code
   */
  pairing: publicProcedure
    .input(z.object({
      phone: z.string().regex(/^\d{10,15}$/, "Telefone inválido"),
    }))
    .mutation(async ({ ctx, input }) => {
      const { device } = ctx;

      if (!device) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Device não identificado",
        });
      }

      const instanceData = await getDeviceInstance(device.id);

      if (!instanceData) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Instância não encontrada. Recarregue a página.",
        });
      }

      const { client } = instanceData;

      try {
        const response = await client.getPairingCode(input.phone);

        if (!response.success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Erro ao gerar código de pareamento",
          });
        }

        return {
          success: true,
          pairingCode: response.data?.pairingCode ?? "",
        };
      } catch (error) {
        console.error("Pairing error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao gerar código de pareamento",
        });
      }
    }),

  /**
   * Validar número de telefone
   */
  validate: publicProcedure
    .input(z.object({
      phone: z.string().min(10).max(15),
    }))
    .mutation(async ({ ctx, input }) => {
      const { device } = ctx;

      if (!device) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Device não identificado",
        });
      }

      const instanceData = await getDeviceInstance(device.id);

      if (!instanceData) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Instância não encontrada",
        });
      }

      const { client } = instanceData;

      try {
        // Verificar número exato primeiro
        const response = await client.checkNumbers([input.phone]);

        if (!response.success || !response.data?.users?.length) {
          return { status: "invalid" as const, phone: input.phone };
        }

        const user = response.data.users[0];

        if (user.IsInWhatsapp) {
          return {
            status: "valid" as const,
            phone: user.JID.replace("@s.whatsapp.net", ""),
            verifiedName: user.VerifiedName || undefined,
          };
        }

        // Se brasileiro, tentar variante com/sem 9
        if (input.phone.startsWith("55") && input.phone.length >= 12) {
          const variant = input.phone.length === 13
            ? input.phone.slice(0, 4) + input.phone.slice(5) // Remove 9
            : input.phone.slice(0, 4) + "9" + input.phone.slice(4); // Adiciona 9

          const variantResponse = await client.checkNumbers([variant]);
          const variantUser = variantResponse.data?.users?.[0];

          if (variantUser?.IsInWhatsapp) {
            return {
              status: "valid_variant" as const,
              phone: variantUser.JID.replace("@s.whatsapp.net", ""),
              originalPhone: input.phone,
              verifiedName: variantUser.VerifiedName || undefined,
            };
          }
        }

        return { status: "invalid" as const, phone: input.phone };
      } catch (error) {
        console.error("Validate error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao validar número",
        });
      }
    }),

  /**
   * Enviar mensagem
   */
  send: publicProcedure
    .input(z.object({
      phone: z.string().min(10).max(15),
      message: z.string().min(1).max(4096),
    }))
    .mutation(async ({ ctx, input }) => {
      const { device } = ctx;

      if (!device) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Device não identificado",
        });
      }

      const instanceData = await getDeviceInstance(device.id);

      if (!instanceData) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Instância não encontrada",
        });
      }

      const { instance, client } = instanceData;

      // Verificar limite de mensagens ANTES de enviar
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const lastReset = instance.lastMessageResetAt;
      const needsReset = !lastReset || lastReset < today;
      const currentCount = needsReset ? 0 : instance.messagesUsedToday;

      if (currentCount >= DEMO_MESSAGE_LIMIT) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Limite de ${DEMO_MESSAGE_LIMIT} mensagens/dia atingido. Crie uma conta para continuar!`,
        });
      }

      try {
        // Verificar se está logado
        const status = await client.getStatus();
        if (!status.data?.loggedIn) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "WhatsApp não está conectado",
          });
        }

        // Enviar mensagem
        const response = await client.sendText(input.phone, input.message);

        if (!response.success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Erro ao enviar mensagem",
          });
        }

        // Incrementar contador
        const usage = await incrementMessageCount(instance.id);

        return {
          success: true,
          messageId: response.data?.id,
          timestamp: response.data?.timestamp,
          usage,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("Send error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao enviar mensagem",
        });
      }
    }),

  /**
   * Desconectar
   */
  disconnect: publicProcedure.mutation(async ({ ctx }) => {
    const { device } = ctx;

    if (!device) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Device não identificado",
      });
    }

    const instanceData = await getDeviceInstance(device.id);

    if (!instanceData) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Instância não encontrada",
      });
    }

    const { instance, client } = instanceData;

    try {
      await client.logout();

      // Atualizar status no banco
      await syncInstanceStatus(instance.id, {
        connected: false,
        loggedIn: false,
      });

      return { success: true };
    } catch (error) {
      console.error("Disconnect error:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Erro ao desconectar",
      });
    }
  }),
});
```

**Critério de sucesso:**
- Cada device tem sua própria instance
- QR code único por visitante
- Limite de mensagens por instance

---

### Fase 5: Auth & Claim

**Objetivo:** Quando user loga, claim instances do device

#### 5.1 User Service (`src/server/lib/user.ts`)

```typescript
import { db } from "~/server/db";
import { users, organizations } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { claimDeviceInstances } from "./instance";
import { clerkClient } from "@clerk/nextjs/server";

export interface SyncedUser {
  id: string;
  email: string;
  name: string | null;
  organizationId: string;
}

/**
 * Sync user do Clerk para nosso banco (on-demand)
 * Cria user + org se não existe
 * Claim instances do device se fornecido
 */
export async function syncUserFromClerk(
  clerkUserId: string,
  deviceId?: string
): Promise<SyncedUser> {
  // Buscar dados do Clerk
  const clerk = await clerkClient();
  const clerkUser = await clerk.users.getUser(clerkUserId);

  const email = clerkUser.emailAddresses[0]?.emailAddress;
  if (!email) {
    throw new Error("User sem email no Clerk");
  }

  const name = [clerkUser.firstName, clerkUser.lastName]
    .filter(Boolean)
    .join(" ") || null;
  const avatarUrl = clerkUser.imageUrl || null;

  // Buscar user existente
  let user = await db.query.users.findFirst({
    where: eq(users.externalId, clerkUserId),
  });

  let organization = user
    ? await db.query.organizations.findFirst({
        where: eq(organizations.ownerId, user.id),
      })
    : null;

  if (!user) {
    // Criar user + org em transaction
    const result = await db.transaction(async (tx) => {
      const [newUser] = await tx.insert(users).values({
        externalId: clerkUserId,
        externalProvider: "clerk",
        email,
        name,
        avatarUrl,
      }).returning();

      const [newOrg] = await tx.insert(organizations).values({
        ownerId: newUser.id,
        name: `Organização de ${name || email.split("@")[0]}`,
        plan: "free",
        maxInstances: 1,
        maxMessagesPerDay: 50,
      }).returning();

      return { user: newUser, organization: newOrg };
    });

    user = result.user;
    organization = result.organization;

    // Claim instances do device (se fornecido)
    if (deviceId && organization) {
      const claimed = await claimDeviceInstances(deviceId, organization.id);
      console.log(`Claimed ${claimed} instances for new user ${user.id}`);
    }
  } else {
    // User existe, verificar se precisa sync
    const needsSync =
      user.email !== email ||
      user.name !== name ||
      user.avatarUrl !== avatarUrl;

    if (needsSync) {
      [user] = await db.update(users)
        .set({
          email,
          name,
          avatarUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id))
        .returning();
    }

    // Tentar claim instances (caso tenha instance órfã do device)
    if (deviceId && organization) {
      await claimDeviceInstances(deviceId, organization.id);
    }
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    organizationId: organization!.id,
  };
}
```

#### 5.2 Protected Procedure (`src/server/api/trpc.ts`)

```typescript
import { auth } from "@clerk/nextjs/server";
import { syncUserFromClerk } from "~/server/lib/user";
import { TRPCError } from "@trpc/server";

// Adicionar após publicProcedure
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  // Sync user on-demand (cria se não existe, claim instances)
  const user = await syncUserFromClerk(clerkUserId, ctx.device?.id);

  return next({
    ctx: {
      ...ctx,
      user,
      clerkUserId,
    },
  });
});
```

**Critério de sucesso:**
- User criado automaticamente no primeiro login
- Org criada junto com user
- Instances do device claimed para org

---

### Fase 6: Frontend Updates

**Objetivo:** Garantir cookie enviado nas requests

#### 6.1 Provider Update (`src/trpc/react.tsx`)

```typescript
// Garantir que cookies são enviados
const [queryClient] = useState(() => makeQueryClient());
const [trpcClient] = useState(() =>
  api.createClient({
    links: [
      // ... existing links
      httpBatchLink({
        url: getBaseUrl() + "/api/trpc",
        transformer: SuperJSON,
        headers() {
          const headers = new Headers();
          headers.set("x-trpc-source", "nextjs-react");
          return headers;
        },
        // Importante: enviar cookies
        fetch(url, options) {
          return fetch(url, {
            ...options,
            credentials: "include", // Envia cookies
          });
        },
      }),
    ],
  })
);
```

#### 6.2 Hook useDemo Update (`src/hooks/useDemo.ts`)

```typescript
// Adicionar retorno de usage info
return {
  // ... existing
  messagesUsed: statusQuery.data?.messagesUsed ?? 0,
  messagesLimit: statusQuery.data?.messagesLimit ?? 50,
  messagesRemaining: (statusQuery.data?.messagesLimit ?? 50) - (statusQuery.data?.messagesUsed ?? 0),
};
```

**Critério de sucesso:**
- Cookie enviado automaticamente
- UI mostra uso de mensagens

---

## 5. Ordem de Execução

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  FASE 1: Schema                                                             │
│  └── Criar tabelas (devices, users, organizations, instances)               │
│      └── bun db:push                                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  FASE 2: Device Tracking                                                    │
│  └── Middleware de cookie                                                   │
│  └── Device service                                                         │
│  └── Testar: cookie criado + device no banco                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  FASE 3: Instance Service                                                   │
│  └── CRUD de instances                                                      │
│  └── Integração WuzAPI (criar user)                                         │
│  └── Testar: instance criada no banco + WuzAPI                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  FASE 4: Demo Router                                                        │
│  └── Refatorar para usar instance service                                   │
│  └── Remover singleton em memória                                           │
│  └── Testar: QR único por visitante                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  FASE 5: Auth & Claim                                                       │
│  └── User service (sync Clerk)                                              │
│  └── Protected procedure                                                    │
│  └── Testar: login → user criado → instance claimed                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  FASE 6: Frontend                                                           │
│  └── Garantir cookies enviados                                              │
│  └── Mostrar uso de mensagens                                               │
│  └── Testar: fluxo completo                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Checklist de Validação

### Funcional

- [ ] Visitante A vê QR code A
- [ ] Visitante B vê QR code B (diferente de A)
- [ ] Visitante A recarrega página → mesmo QR code
- [ ] Visitante A escaneia → conectado
- [ ] Visitante A envia mensagem → contador incrementa
- [ ] Visitante A atinge 50 msgs → bloqueado
- [ ] Visitante A cria conta → instance vinculada
- [ ] Visitante A loga em outro device → vê instance (via org)
- [ ] Visitante B no mesmo device de A → não vê instance de A

### Técnico

- [ ] `bun db:push` sem erros
- [ ] `bun build` sem erros
- [ ] Cookie criado no primeiro acesso
- [ ] Device salvo no banco
- [ ] Instance criada no banco
- [ ] WuzAPI user criado
- [ ] Status sync funcionando

---

## 7. Rollback Plan

Se algo der errado:

1. **Schema**: Não afeta código antigo (tabelas novas)
2. **Demo Router**: Manter arquivo antigo como `demo.old.ts`
3. **WuzAPI**: Instances órfãs podem ser deletadas via admin API

```bash
# Listar instances no WuzAPI
curl -H "Authorization: $WUZAPI_ADMIN_TOKEN" $WUZAPI_URL/admin/users

# Deletar instance específica
curl -X DELETE -H "Authorization: $WUZAPI_ADMIN_TOKEN" $WUZAPI_URL/admin/users/{id}
```

---

## 8. Futuro (Não neste plano)

| Feature | Quando |
|---------|--------|
| Rate limiting Redis | Plan 04.2 |
| Fingerprinting | Plan 04.2 |
| Billing (AbacatePay) | Plan 05 |
| Multi-tenancy (agency) | Plan 06 |
| Cleanup automático | Plan 04.2 |

---

## Changelog

- **2024-12-05**: Plano completamente reescrito
  - Arquitetura device → instance → organization
  - Conceito de "claim" para transferência de ownership
  - Código real baseado na análise do codebase atual
  - Fases incrementais sem quebrar funcionalidade existente
