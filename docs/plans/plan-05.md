# Plan 05: API Gateway + API Keys + Documentação

## Status: 🟡 EM PROGRESSO

**Dependências:**
- ✅ Plan 01: Landing Page
- ✅ Plan 02: WuzAPI Integration
- ✅ Plan 03: App Layout & Auth
- ✅ Plan 04.1: Database & Instances
- ✅ Hybrid Procedure (whatsapp.status)

**Progresso:**
- ✅ Fase 2: Cloudflare Workers (api.livchat.ai)
- 🔄 Fase 1: API Keys (REFATORANDO - Device-Based + Claiming)
- 🔄 Fase 3: Vercel Integration (ATUALIZAR para novo modelo)
- 🔲 Fase 4: Dashboard UI
- 🔲 Fase 5: Mintlify Docs

**Refatoração em andamento:**
> O modelo de API Keys está sendo refatorado para seguir o mesmo ciclo de vida
> das Instances (claiming system). Keys são criadas automaticamente quando
> WhatsApp conecta e claimed junto com instances no login.

---

## Objetivo

Criar uma **REST API pública** para desenvolvedores externos integrarem com o LivChat, usando:

1. **Sistema de API Keys** - Abstração sobre os tokens do WuzAPI
2. **Cloudflare Workers** - API Gateway no edge (auth, rate limit, proxy)
3. **Mintlify** - Documentação profissional da API

---

## Arquitetura Final

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ARQUITETURA                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Developer                                                                  │
│      │                                                                       │
│      │ Authorization: Bearer lc_live_Xk9m2nP8qR4sT6uV8wX0y                  │
│      ▼                                                                       │
│   ┌─────────────────────────────────────────────────────────┐               │
│   │              api.livchat.ai (Cloudflare Workers)         │               │
│   │                                                          │               │
│   │  1. Extrai API Key do header                            │               │
│   │  2. Valida key (KV cache ou DB)                         │               │
│   │  3. Verifica rate limit (Durable Objects)               │               │
│   │  4. Injeta X-Organization-ID, X-Instance-ID             │               │
│   │  5. Proxy para destino                                  │               │
│   │                                                          │               │
│   └─────────────────┬───────────────────────────────────────┘               │
│                     │                                                        │
│          ┌──────────┴──────────┐                                            │
│          ▼                     ▼                                            │
│   ┌─────────────┐       ┌─────────────┐                                     │
│   │   Vercel    │       │  WuzAPI     │                                     │
│   │ (Dashboard) │       │ (WhatsApp)  │                                     │
│   │             │       │             │                                     │
│   │ - tRPC      │       │ - /chat/*   │                                     │
│   │ - Auth UI   │       │ - /user/*   │                                     │
│   │ - Billing   │       │ - /group/*  │                                     │
│   └─────────────┘       └─────────────┘                                     │
│                                                                              │
│   app.livchat.ai        wuz.livchat.ai                                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Domínios

| Domínio | Serviço | Função |
|---------|---------|--------|
| `app.livchat.ai` | Vercel | Dashboard, Landing Page, tRPC |
| `api.livchat.ai` | Cloudflare Workers | API Gateway (REST público) |
| `wuz.livchat.ai` | Fly.io | WuzAPI backend |
| `docs.livchat.ai` | Mintlify | Documentação da API |

---

## Fase 1: Sistema de API Keys (Device-Based + Claiming)

> **IMPORTANTE**: API Keys seguem o MESMO ciclo de vida das Instances.
> - Criadas quando WhatsApp conecta (não antes)
> - Órfãs até usuário fazer login
> - Claimed junto com instance
> - Deletadas junto com instance (cleanup)
> - Após claim: TODAS keys da org acessam TODAS instances (mesmo nível)

### 1.0 Ciclo de Vida Unificado (Instance + API Key)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CICLO DE VIDA: INSTANCE + API KEY                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ FASE 1: ANÔNIMO ACESSA LP                                           │    │
│  │ ─────────────────────────────────────────────────────────────────── │    │
│  │ • Instance criada (órfã, createdByDeviceId = device)                │    │
│  │ • API Key NÃO EXISTE ainda                                          │    │
│  │ • whatsappJid = NULL (virgem)                                       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ FASE 2: QR CODE ESCANEADO (WhatsApp conecta)                        │    │
│  │ ─────────────────────────────────────────────────────────────────── │    │
│  │ • whatsappJid = "5511999999999@s.whatsapp.net"                      │    │
│  │ • API Key CRIADA automaticamente:                                   │    │
│  │   {                                                                 │    │
│  │     organizationId: NULL,        // órfã                            │    │
│  │     instanceId: this_instance,   // vinculada                       │    │
│  │     createdByDeviceId: device,   // para claim                      │    │
│  │     token: "lc_live_xxx"         // mostrado na LP                  │    │
│  │   }                                                                 │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                 ┌──────────────────┴──────────────────┐                     │
│                 ▼                                     ▼                     │
│  ┌──────────────────────────────┐  ┌──────────────────────────────┐        │
│  │ FASE 3A: LOGIN (NOVA CONTA)  │  │ FASE 3B: LOGIN (CONTA EXISTE)│        │
│  │ ─────────────────────────── │  │ ─────────────────────────── │        │
│  │ • Org criada                 │  │ • Org já tem outras keys     │        │
│  │ • Instance claimed           │  │ • Instance claimed           │        │
│  │ • API Key claimed:           │  │ • API Key claimed:           │        │
│  │   organizationId = new_org   │  │   organizationId = org       │        │
│  │                              │  │                              │        │
│  │ Key funciona para TODAS      │  │ Todas keys da org agora      │        │
│  │ instances futuras da org     │  │ acessam esta instance também │        │
│  └──────────────────────────────┘  └──────────────────────────────┘        │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ ALTERNATIVA: INSTANCE FICA ÓRFÃ (user nunca faz login)              │    │
│  │ ─────────────────────────────────────────────────────────────────── │    │
│  │ • Após 8h sem atividade + whatsappJid != NULL → "abusada"           │    │
│  │ • cleanupAbusedOrphans() deleta Instance                            │    │
│  │ • API Key deletada junto (CASCADE)                                  │    │
│  │ • Token para de funcionar                                           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.1 Modelo de Permissões (Opção B: Mesmo Nível)

```
┌─────────────────────────────────────────────────────────────────┐
│                      ORGANIZAÇÃO                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Todas as keys têm o MESMO poder após claim                    │
│                                                                  │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐                        │
│   │  Key A  │  │  Key B  │  │  Key C  │                        │
│   │ (token) │  │ (token) │  │ (token) │                        │
│   └────┬────┘  └────┬────┘  └────┬────┘                        │
│        │            │            │                              │
│        └────────────┼────────────┘                              │
│                     │                                            │
│                     ▼                                            │
│        ┌────────────────────────┐                               │
│        │   QUALQUER INSTANCE    │                               │
│        │   da organização       │                               │
│        └────────────────────────┘                               │
│                     │                                            │
│        ┌────────────┼────────────┐                              │
│        ▼            ▼            ▼                              │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐                        │
│   │ Inst. X │  │ Inst. Y │  │ Inst. Z │                        │
│   │ +55 11  │  │ +55 21  │  │ +55 31  │                        │
│   └─────────┘  └─────────┘  └─────────┘                        │
│                                                                  │
│   Key A pode usar X, Y ou Z                                     │
│   Key B pode usar X, Y ou Z                                     │
│   Key C pode usar X, Y ou Z                                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Schema: Tabela `api_keys` (ATUALIZADO)

```typescript
// src/server/db/schema.ts

export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // ═══════════════════════════════════════════════════════════════
    // OWNERSHIP (Sistema de Claiming - espelha instances)
    // ═══════════════════════════════════════════════════════════════

    // NULL = órfã (anônimo), SET = claimed (pertence a org)
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" }),

    // Qual device criou esta key (para claim)
    createdByDeviceId: uuid("created_by_device_id")
      .references(() => devices.id, { onDelete: "set null" }),

    // Instance que gerou esta key (CASCADE = deleta junto)
    instanceId: uuid("instance_id")
      .notNull()
      .references(() => instances.id, { onDelete: "cascade" }),

    // ═══════════════════════════════════════════════════════════════
    // IDENTIFICAÇÃO
    // ═══════════════════════════════════════════════════════════════

    name: text("name").notNull().default("Default"),

    // Token completo (plaintext) - lookup O(1) via UNIQUE
    // Formato: lc_live_Xk9m2nP8qR4sT6uV8wX0yZ1a2b3c (40 chars)
    token: text("token").notNull().unique(),

    // ═══════════════════════════════════════════════════════════════
    // PERMISSÕES (herdadas da org após claim)
    // ═══════════════════════════════════════════════════════════════

    scopes: text("scopes").array().notNull().default(sql`ARRAY['whatsapp:*']`),
    rateLimitRequests: integer("rate_limit_requests").notNull().default(100),
    rateLimitWindowSeconds: integer("rate_limit_window_seconds").notNull().default(60),

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

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_api_key_org").on(table.organizationId),
    index("idx_api_key_device").on(table.createdByDeviceId),
    index("idx_api_key_instance").on(table.instanceId),
  ]
);

// Relações
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
```

### 1.3 Diferenças do Schema Anterior

| Campo | Antes | Depois | Motivo |
|-------|-------|--------|--------|
| `organizationId` | NOT NULL | NULLABLE | Permite keys órfãs (anônimos) |
| `createdByUserId` | NOT NULL | REMOVIDO | Anônimos não têm user |
| `createdByDeviceId` | não existia | ADICIONADO | Para claim automático |
| `instanceId` | NULLABLE | NOT NULL + CASCADE | Key morre com instance |
| `claimedAt` | não existia | ADICIONADO | Tracking de quando foi claimed |

### 1.4 Funções de API Key (NOVO MODELO)

```typescript
// src/server/lib/api-key.ts

import { db } from "~/server/db";
import { apiKeys, instances } from "~/server/db/schema";
import { eq, and, isNull } from "drizzle-orm";

// ═══════════════════════════════════════════════════════════════════════════
// GERAÇÃO DE TOKEN
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Gera token seguro para API Key
 * Formato: lc_{env}_{32 chars} = 40 chars total
 */
export function generateApiKeyToken(env: "live" | "test" = "live"): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let random = "";
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  for (let i = 0; i < 32; i++) {
    random += chars[array[i]! % chars.length];
  }
  return `lc_${env}_${random}`;
}

/**
 * Mascara token para exibição
 * lc_live_Xk9m2nP8... → lc_live_****************************Xk9m
 */
export function maskApiKeyToken(token: string): string {
  const prefixMatch = token.match(/^(lc_\w+_)/);
  const prefix = prefixMatch?.[1] ?? "";
  const suffix = token.slice(-4);
  const maskedLength = token.length - prefix.length - 4;
  return prefix + "*".repeat(maskedLength) + suffix;
}

// ═══════════════════════════════════════════════════════════════════════════
// CRIAÇÃO AUTOMÁTICA (chamada quando instance conecta)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Cria API Key automaticamente quando instance conecta ao WhatsApp
 * Chamada em syncInstanceStatus() quando loggedIn passa a true
 */
export async function createApiKeyForInstance(
  instanceId: string,
  deviceId: string | null
): Promise<{ id: string; token: string }> {
  // Verificar se já existe key para esta instance
  const existing = await db.query.apiKeys.findFirst({
    where: eq(apiKeys.instanceId, instanceId),
  });

  if (existing) {
    return { id: existing.id, token: existing.token };
  }

  // Gerar nova key
  const token = generateApiKeyToken("live");

  const [created] = await db
    .insert(apiKeys)
    .values({
      instanceId,
      createdByDeviceId: deviceId,
      organizationId: null, // Órfã até claim
      token,
      name: "Default",
      scopes: ["whatsapp:*"],
    })
    .returning();

  return { id: created!.id, token: created!.token };
}

// ═══════════════════════════════════════════════════════════════════════════
// CLAIM (chamada junto com claimDeviceInstances)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Claim API Keys órfãs do device para a organização
 * Espelha o comportamento de claimDeviceInstances()
 */
export async function claimDeviceApiKeys(
  deviceId: string,
  organizationId: string
): Promise<number> {
  const result = await db
    .update(apiKeys)
    .set({
      organizationId,
      claimedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(apiKeys.createdByDeviceId, deviceId),
        isNull(apiKeys.organizationId)
      )
    )
    .returning();

  return result.length;
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDAÇÃO E RESOLUÇÃO DE INSTANCE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Valida API Key e resolve qual instance usar
 *
 * REGRAS (Opção B - Mesmo Nível):
 * - Key órfã (org = NULL): só pode usar sua instance específica
 * - Key claimed (org = SET): pode usar QUALQUER instance da org
 */
export async function validateAndResolveInstance(token: string): Promise<{
  keyId: string;
  organizationId: string | null;
  instanceId: string;
  providerToken: string;
  scopes: string[];
  rateLimitRequests: number;
  rateLimitWindowSeconds: number;
} | null> {
  // Verificar formato
  if (!token.startsWith("lc_") || token.length < 20) {
    return null;
  }

  // Buscar key
  const key = await db.query.apiKeys.findFirst({
    where: and(
      eq(apiKeys.token, token),
      eq(apiKeys.isActive, true)
    ),
  });

  if (!key) return null;

  // Verificar expiração
  if (key.expiresAt && key.expiresAt < new Date()) {
    return null;
  }

  // Resolver instance
  let instance;

  if (key.organizationId) {
    // ═══ KEY CLAIMED: pode usar qualquer instance da org ═══
    // Prioridade: primeira conectada
    instance = await db.query.instances.findFirst({
      where: and(
        eq(instances.organizationId, key.organizationId),
        eq(instances.status, "connected")
      ),
      orderBy: (i, { desc }) => [desc(i.lastConnectedAt)],
    });

    // Fallback: qualquer instance da org
    if (!instance) {
      instance = await db.query.instances.findFirst({
        where: eq(instances.organizationId, key.organizationId),
      });
    }
  } else {
    // ═══ KEY ÓRFÃ: só pode usar sua instance específica ═══
    instance = await db.query.instances.findFirst({
      where: eq(instances.id, key.instanceId),
    });
  }

  if (!instance) return null;

  // Atualizar lastUsedAt (fire-and-forget)
  db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, key.id))
    .catch(() => {});

  return {
    keyId: key.id,
    organizationId: key.organizationId,
    instanceId: instance.id,
    providerToken: instance.providerToken,
    scopes: key.scopes,
    rateLimitRequests: key.rateLimitRequests,
    rateLimitWindowSeconds: key.rateLimitWindowSeconds,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNÇÕES AUXILIARES
// ═══════════════════════════════════════════════════════════════════════════

/** Busca API Key de uma instance (para exibir na LP) */
export async function getApiKeyForInstance(instanceId: string) {
  return db.query.apiKeys.findFirst({
    where: eq(apiKeys.instanceId, instanceId),
  });
}

/** Lista API Keys da organização (para dashboard) */
export async function listApiKeys(organizationId: string) {
  const keys = await db.query.apiKeys.findMany({
    where: eq(apiKeys.organizationId, organizationId),
    orderBy: (k, { desc }) => [desc(k.createdAt)],
  });

  return keys.map((k) => ({
    id: k.id,
    name: k.name,
    maskedToken: maskApiKeyToken(k.token),
    instanceId: k.instanceId,
    scopes: k.scopes,
    isActive: k.isActive,
    lastUsedAt: k.lastUsedAt,
    createdAt: k.createdAt,
  }));
}

/** Revoga API Key */
export async function revokeApiKey(keyId: string): Promise<boolean> {
  const result = await db
    .update(apiKeys)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(apiKeys.id, keyId))
    .returning();
  return result.length > 0;
}
```

### 1.5 Integração com Instance (syncInstanceStatus)

```typescript
// Em src/server/lib/instance.ts, modificar syncInstanceStatus:

export async function syncInstanceStatus(
  instanceId: string,
  status: { connected: boolean; loggedIn: boolean; jid?: string; name?: string },
  deviceId?: string // NOVO: passar deviceId para criar API key
) {
  const updates: Partial<Instance> = { ... };

  // ═══ NOVO: Criar API Key automaticamente quando conecta ═══
  const wasLoggedIn = /* buscar estado anterior */;
  const isNowLoggedIn = status.loggedIn;

  if (!wasLoggedIn && isNowLoggedIn && status.jid) {
    // Primeira vez que conectou - criar API key
    await createApiKeyForInstance(instanceId, deviceId ?? null);
  }

  await db.update(instances).set(updates).where(eq(instances.id, instanceId));
}
```

### 1.6 Integração com User (syncUserFromClerk)

```typescript
// Em src/server/lib/user.ts, adicionar claim de API keys:

import { claimDeviceApiKeys } from "./api-key";

export async function syncUserFromClerk(clerkUserId: string, deviceId?: string) {
  // ... código existente de criar user/org ...

  // Claim instances do device
  if (deviceId && organization) {
    const claimedInstances = await claimDeviceInstances(deviceId, organization.id);

    // ═══ NOVO: Claim API keys junto ═══
    const claimedKeys = await claimDeviceApiKeys(deviceId, organization.id);

    if (claimedInstances > 0 || claimedKeys > 0) {
      logger.info(LogActions.USER_CLAIM, "Resources claimed", {
        instances: claimedInstances,
        apiKeys: claimedKeys,
      });
    }
  }
}
```

### 1.7 Exibir API Key na LP (test-panel)

```typescript
// Em src/components/marketing/test-panel.tsx

// Antes: mostrava instance.providerToken (interno)
// Agora: mostrar apiKey.token (público)

// O hook useWhatsApp deve retornar:
// - apiKey: string | undefined (token da API key, não providerToken)

// Em whatsapp.status, buscar API key da instance:
const apiKeyData = await getApiKeyForInstance(instance.id);
return {
  ...
  apiKey: statusRes.data.loggedIn ? apiKeyData?.token : undefined,
};
```

---

## Fase 2: Cloudflare Workers (API Gateway)

> **Status: ✅ IMPLEMENTADO**
> - Worker deployado: `https://livchat-api-gateway.pedrohnas0.workers.dev`
> - Domínio configurado: `https://api.livchat.ai`
> - KV Namespace: `ae654944e72c40b091a57051aaa3d13e`
> - Durable Objects: RateLimiter (SQLite)

### 2.1 Estrutura do Projeto (Implementado)

```
/home/pedro/dev/sandbox/livchat/
├── app/                    # Next.js (Vercel)
├── wuzapi/                 # WuzAPI (Fly.io)
├── workers/                # Cloudflare Workers ✅
│   └── api-gateway/
│       ├── src/
│       │   ├── index.ts           # Entry point + CORS + health
│       │   ├── auth.ts            # API Key validation (KV cache)
│       │   ├── rate-limit.ts      # Rate limiting (SQLite DO)
│       │   ├── router.ts          # Route mapping + proxy
│       │   └── types.ts           # TypeScript types
│       ├── wrangler.jsonc         # Cloudflare config
│       ├── package.json
│       └── tsconfig.json
└── docs/                   # Mintlify docs (pendente)
```

### 2.2 Cloudflare Worker: Entry Point

```typescript
// workers/api-gateway/src/index.ts

import { validateApiKey, ApiKeyData } from "./auth";
import { checkRateLimit } from "./rate-limit";
import { routeRequest } from "./router";

export interface Env {
  // KV Namespace para cache de API keys
  API_KEYS_CACHE: KVNamespace;

  // Durable Object para rate limiting
  RATE_LIMITER: DurableObjectNamespace;

  // Secrets
  DATABASE_URL: string;
  WUZAPI_URL: string;
  VERCEL_URL: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // ============ CORS Preflight ============
    if (request.method === "OPTIONS") {
      return handleCORS();
    }

    // ============ Health Check ============
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // ============ Extrair API Key ============
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse(401, "Missing or invalid Authorization header");
    }

    const apiKey = authHeader.slice(7); // Remove "Bearer "

    // ============ Validar API Key ============
    let keyData: ApiKeyData | null;
    try {
      keyData = await validateApiKey(apiKey, env);
    } catch (error) {
      console.error("Auth error:", error);
      return errorResponse(500, "Authentication service error");
    }

    if (!keyData) {
      return errorResponse(401, "Invalid API key");
    }

    if (!keyData.isActive) {
      return errorResponse(401, "API key has been revoked");
    }

    // ============ Rate Limiting ============
    const rateLimitResult = await checkRateLimit(
      keyData.id,
      keyData.rateLimitRequests,
      keyData.rateLimitWindowSeconds,
      env
    );

    if (!rateLimitResult.allowed) {
      return errorResponse(429, "Rate limit exceeded", {
        "X-RateLimit-Limit": String(keyData.rateLimitRequests),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(rateLimitResult.resetAt),
        "Retry-After": String(Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)),
      });
    }

    // ============ Route Request ============
    try {
      const response = await routeRequest(request, keyData, env);

      // Adicionar headers de rate limit
      response.headers.set("X-RateLimit-Limit", String(keyData.rateLimitRequests));
      response.headers.set("X-RateLimit-Remaining", String(rateLimitResult.remaining));
      response.headers.set("X-RateLimit-Reset", String(rateLimitResult.resetAt));

      // Log usage (fire-and-forget)
      ctx.waitUntil(logUsage(keyData, url.pathname, request.method, response.status, env));

      return addCORSHeaders(response);
    } catch (error) {
      console.error("Proxy error:", error);
      return errorResponse(502, "Upstream service error");
    }
  },
};

// ============ Helpers ============

function handleCORS(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}

function addCORSHeaders(response: Response): Response {
  const newHeaders = new Headers(response.headers);
  newHeaders.set("Access-Control-Allow-Origin", "*");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

function errorResponse(
  status: number,
  message: string,
  headers: Record<string, string> = {}
): Response {
  return new Response(
    JSON.stringify({
      error: {
        code: status,
        message,
      },
    }),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        ...headers,
      },
    }
  );
}

async function logUsage(
  keyData: ApiKeyData,
  endpoint: string,
  method: string,
  statusCode: number,
  env: Env
): Promise<void> {
  // TODO: Enviar para Vercel endpoint de logging
  // ou diretamente para banco via API
}
```

### 2.3 Cloudflare Worker: Auth

```typescript
// workers/api-gateway/src/auth.ts

import { Env } from "./index";

export interface ApiKeyData {
  id: string;
  organizationId: string;
  instanceId: string | null;
  providerToken: string;  // Token do WuzAPI
  scopes: string[];
  rateLimitRequests: number;
  rateLimitWindowSeconds: number;
  isActive: boolean;
}

const CACHE_TTL_SECONDS = 300; // 5 minutos

/**
 * Valida API Key
 * 1. Tenta cache (KV)
 * 2. Se não encontrar, busca no banco via Vercel
 * 3. Armazena em cache
 */
export async function validateApiKey(
  key: string,
  env: Env
): Promise<ApiKeyData | null> {
  // Verificar formato básico
  if (!key.startsWith("lc_") || key.length < 20) {
    return null;
  }

  // Tentar cache primeiro
  const cacheKey = `apikey:${hashKey(key)}`;
  const cached = await env.API_KEYS_CACHE.get(cacheKey, "json");

  if (cached) {
    return cached as ApiKeyData;
  }

  // Buscar no banco via Vercel API
  const response = await fetch(`${env.VERCEL_URL}/api/internal/validate-key`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Secret": env.INTERNAL_SECRET,
    },
    body: JSON.stringify({ key }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      return null; // Key inválida
    }
    throw new Error(`Validation failed: ${response.status}`);
  }

  const data = await response.json() as ApiKeyData;

  // Armazenar em cache
  await env.API_KEYS_CACHE.put(cacheKey, JSON.stringify(data), {
    expirationTtl: CACHE_TTL_SECONDS,
  });

  return data;
}

function hashKey(key: string): string {
  // Usamos apenas prefixo para o cache key (evita expor key completa)
  return key.slice(0, 16);
}
```

### 2.4 Cloudflare Worker: Rate Limiting

```typescript
// workers/api-gateway/src/rate-limit.ts

import { Env } from "./index";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Rate limiting usando Durable Objects
 * Contador por API key com janela deslizante
 */
export async function checkRateLimit(
  keyId: string,
  maxRequests: number,
  windowSeconds: number,
  env: Env
): Promise<RateLimitResult> {
  // Obter Durable Object para esta key
  const id = env.RATE_LIMITER.idFromName(keyId);
  const limiter = env.RATE_LIMITER.get(id);

  // Chamar o Durable Object
  const response = await limiter.fetch("http://internal/check", {
    method: "POST",
    body: JSON.stringify({ maxRequests, windowSeconds }),
  });

  return response.json();
}

// ============ Durable Object ============

export class RateLimiter implements DurableObject {
  private requests: number[] = [];

  constructor(private state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const { maxRequests, windowSeconds } = await request.json() as {
      maxRequests: number;
      windowSeconds: number;
    };

    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const windowStart = now - windowMs;

    // Limpar requests antigas
    this.requests = this.requests.filter((t) => t > windowStart);

    // Verificar limite
    if (this.requests.length >= maxRequests) {
      const resetAt = this.requests[0]! + windowMs;
      return Response.json({
        allowed: false,
        remaining: 0,
        resetAt,
      });
    }

    // Adicionar request atual
    this.requests.push(now);

    return Response.json({
      allowed: true,
      remaining: maxRequests - this.requests.length,
      resetAt: now + windowMs,
    });
  }
}
```

### 2.5 Cloudflare Worker: Router

```typescript
// workers/api-gateway/src/router.ts

import { Env } from "./index";
import { ApiKeyData } from "./auth";

/**
 * Mapeia rotas da API pública para backends
 */
const ROUTE_MAP: Record<string, {
  backend: "wuzapi" | "vercel";
  path: string;
  methods: string[];
}> = {
  // ============ Mensagens ============
  "/v1/messages/send": {
    backend: "wuzapi",
    path: "/chat/send/text",
    methods: ["POST"],
  },
  "/v1/messages/send/image": {
    backend: "wuzapi",
    path: "/chat/send/image",
    methods: ["POST"],
  },
  "/v1/messages/send/document": {
    backend: "wuzapi",
    path: "/chat/send/document",
    methods: ["POST"],
  },
  "/v1/messages/send/audio": {
    backend: "wuzapi",
    path: "/chat/send/audio",
    methods: ["POST"],
  },
  "/v1/messages/send/video": {
    backend: "wuzapi",
    path: "/chat/send/video",
    methods: ["POST"],
  },
  "/v1/messages/send/location": {
    backend: "wuzapi",
    path: "/chat/send/location",
    methods: ["POST"],
  },
  "/v1/messages/send/contact": {
    backend: "wuzapi",
    path: "/chat/send/contact",
    methods: ["POST"],
  },
  "/v1/messages/send/sticker": {
    backend: "wuzapi",
    path: "/chat/send/sticker",
    methods: ["POST"],
  },
  "/v1/messages/react": {
    backend: "wuzapi",
    path: "/chat/react",
    methods: ["POST"],
  },
  "/v1/messages/read": {
    backend: "wuzapi",
    path: "/chat/markread",
    methods: ["POST"],
  },

  // ============ Contatos ============
  "/v1/contacts/check": {
    backend: "wuzapi",
    path: "/user/check",
    methods: ["POST"],
  },
  "/v1/contacts/info": {
    backend: "wuzapi",
    path: "/user/info",
    methods: ["POST"],
  },
  "/v1/contacts/avatar": {
    backend: "wuzapi",
    path: "/user/avatar",
    methods: ["GET"],
  },
  "/v1/contacts/list": {
    backend: "wuzapi",
    path: "/user/contacts",
    methods: ["GET"],
  },

  // ============ Sessão ============
  "/v1/session/status": {
    backend: "wuzapi",
    path: "/session/status",
    methods: ["GET"],
  },
  "/v1/session/qr": {
    backend: "wuzapi",
    path: "/session/qr",
    methods: ["GET"],
  },
  "/v1/session/connect": {
    backend: "wuzapi",
    path: "/session/connect",
    methods: ["POST"],
  },
  "/v1/session/disconnect": {
    backend: "wuzapi",
    path: "/session/disconnect",
    methods: ["POST"],
  },
  "/v1/session/logout": {
    backend: "wuzapi",
    path: "/session/logout",
    methods: ["POST"],
  },

  // ============ Webhook ============
  "/v1/webhook": {
    backend: "wuzapi",
    path: "/webhook",
    methods: ["GET", "POST"],
  },

  // ============ Grupos ============
  "/v1/groups/list": {
    backend: "wuzapi",
    path: "/group/list",
    methods: ["GET"],
  },
  "/v1/groups/info": {
    backend: "wuzapi",
    path: "/group/info",
    methods: ["GET"],
  },
  "/v1/groups/create": {
    backend: "wuzapi",
    path: "/group/create",
    methods: ["POST"],
  },
  "/v1/groups/invite-link": {
    backend: "wuzapi",
    path: "/group/invitelink",
    methods: ["GET"],
  },
};

export async function routeRequest(
  request: Request,
  keyData: ApiKeyData,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const route = ROUTE_MAP[url.pathname];

  if (!route) {
    return new Response(
      JSON.stringify({
        error: {
          code: 404,
          message: `Endpoint not found: ${url.pathname}`,
          docs: "https://docs.livchat.ai",
        },
      }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!route.methods.includes(request.method)) {
    return new Response(
      JSON.stringify({
        error: {
          code: 405,
          message: `Method ${request.method} not allowed for ${url.pathname}`,
        },
      }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    );
  }

  // Verificar scope
  const requiredScope = `whatsapp:${url.pathname.split("/")[2]}`; // ex: whatsapp:messages
  if (!hasScope(keyData.scopes, requiredScope)) {
    return new Response(
      JSON.stringify({
        error: {
          code: 403,
          message: `API key does not have required scope: ${requiredScope}`,
        },
      }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  // Determinar backend
  const backendUrl = route.backend === "wuzapi" ? env.WUZAPI_URL : env.VERCEL_URL;
  const targetUrl = `${backendUrl}${route.path}${url.search}`;

  // Criar nova request
  const headers = new Headers(request.headers);

  // Remover Authorization original, adicionar token do WuzAPI
  headers.delete("Authorization");
  if (route.backend === "wuzapi") {
    headers.set("Token", keyData.providerToken);
  }

  // Adicionar metadata
  headers.set("X-API-Key-ID", keyData.id);
  headers.set("X-Organization-ID", keyData.organizationId);
  if (keyData.instanceId) {
    headers.set("X-Instance-ID", keyData.instanceId);
  }

  // Fazer proxy
  return fetch(targetUrl, {
    method: request.method,
    headers,
    body: request.body,
  });
}

function hasScope(scopes: string[], required: string): boolean {
  // Wildcard: whatsapp:* permite tudo
  if (scopes.includes("whatsapp:*") || scopes.includes("*")) {
    return true;
  }

  return scopes.includes(required);
}
```

### 2.6 Cloudflare: wrangler.toml

```toml
# workers/api-gateway/wrangler.toml

name = "livchat-api-gateway"
main = "src/index.ts"
compatibility_date = "2024-01-01"

# ============ Bindings ============

# KV para cache de API keys
[[kv_namespaces]]
binding = "API_KEYS_CACHE"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
preview_id = "yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy"

# Durable Objects para rate limiting
[[durable_objects.bindings]]
name = "RATE_LIMITER"
class_name = "RateLimiter"

[[migrations]]
tag = "v1"
new_classes = ["RateLimiter"]

# ============ Environment Variables ============

[vars]
VERCEL_URL = "https://app.livchat.ai"
WUZAPI_URL = "https://wuz.livchat.ai"

# Secrets (configurar via wrangler secret put)
# - DATABASE_URL
# - INTERNAL_SECRET

# ============ Routes ============

routes = [
  { pattern = "api.livchat.ai/*", zone_name = "livchat.ai" }
]

# ============ Build ============

[build]
command = "npm run build"

[build.upload]
format = "modules"
main = "./dist/index.js"
```

---

## Fase 3: Endpoint Interno de Validação (Vercel)

> **ATUALIZADO**: Agora usa `validateAndResolveInstance` que implementa a
> lógica de Opção B (key órfã = só sua instance, key claimed = qualquer instance da org)

### 3.1 Route Handler

```typescript
// app/src/app/api/internal/validate-key/route.ts

import { NextRequest, NextResponse } from "next/server";
import { validateAndResolveInstance } from "~/server/lib/api-key";
import { env } from "~/env";

export async function POST(request: NextRequest) {
  // Verificar secret interno
  const secret = request.headers.get("X-Internal-Secret");
  if (secret !== env.INTERNAL_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { key } = await request.json();

  if (!key) {
    return NextResponse.json({ error: "Missing key" }, { status: 400 });
  }

  // Validar key E resolver instance (lógica unificada)
  const result = await validateAndResolveInstance(key);

  if (!result) {
    return NextResponse.json({ error: "Invalid key" }, { status: 401 });
  }

  // validateAndResolveInstance já garante que existe instance com providerToken
  return NextResponse.json({
    id: result.keyId,
    organizationId: result.organizationId,
    instanceId: result.instanceId,
    providerToken: result.providerToken,
    scopes: result.scopes,
    rateLimitRequests: result.rateLimitRequests,
    rateLimitWindowSeconds: result.rateLimitWindowSeconds,
    isActive: true,
  });
}
```

---

## Fase 4: Dashboard UI para API Keys

### 4.1 Componente de Gerenciamento

```typescript
// src/components/dashboard/api-keys.tsx

"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Copy, RefreshCw, Trash2, Eye, EyeOff, Plus } from "lucide-react";
import { toast } from "sonner";

export function ApiKeysManager() {
  const [showNewKey, setShowNewKey] = useState<string | null>(null);

  const { data: keys, refetch } = api.apiKeys.list.useQuery();
  const createKey = api.apiKeys.create.useMutation({
    onSuccess: (data) => {
      setShowNewKey(data.key);
      refetch();
      toast.success("API Key criada com sucesso!");
    },
  });
  const revokeKey = api.apiKeys.revoke.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("API Key revogada");
    },
  });
  const regenerateKey = api.apiKeys.regenerate.useMutation({
    onSuccess: (data) => {
      setShowNewKey(data.key);
      refetch();
      toast.success("API Key regenerada!");
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">API Keys</h2>
          <p className="text-muted-foreground">
            Gerencie suas chaves de acesso à API
          </p>
        </div>
        <Button
          onClick={() => createKey.mutate({ name: "Nova Key" })}
          disabled={createKey.isPending}
        >
          <Plus className="h-4 w-4 mr-2" />
          Nova API Key
        </Button>
      </div>

      {/* Mostrar nova key (uma vez) */}
      {showNewKey && (
        <Card className="p-4 bg-green-500/10 border-green-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-500">
                Nova API Key gerada!
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Copie agora. Esta chave não será exibida novamente.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowNewKey(null)}
            >
              Entendi
            </Button>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 bg-background p-2 rounded text-sm font-mono">
              {showNewKey}
            </code>
            <Button
              variant="outline"
              size="icon"
              onClick={() => copyToClipboard(showNewKey)}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* Lista de keys */}
      <div className="space-y-3">
        {keys?.map((key) => (
          <Card key={key.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{key.name}</span>
                  {!key.isActive && (
                    <span className="text-xs bg-red-500/10 text-red-500 px-2 py-0.5 rounded">
                      Revogada
                    </span>
                  )}
                </div>
                <code className="text-sm text-muted-foreground font-mono">
                  {key.maskedKey}
                </code>
                <p className="text-xs text-muted-foreground">
                  Criada em {new Date(key.createdAt).toLocaleDateString()}
                  {key.lastUsedAt && (
                    <> · Último uso: {new Date(key.lastUsedAt).toLocaleDateString()}</>
                  )}
                </p>
              </div>

              {key.isActive && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => regenerateKey.mutate({ keyId: key.id })}
                    disabled={regenerateKey.isPending}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Regenerar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (confirm("Revogar esta API Key?")) {
                        revokeKey.mutate({ keyId: key.id });
                      }
                    }}
                    disabled={revokeKey.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </Card>
        ))}

        {keys?.length === 0 && (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">
              Nenhuma API Key criada ainda.
            </p>
          </Card>
        )}
      </div>

      {/* Documentação */}
      <Card className="p-4 bg-muted/50">
        <h3 className="font-medium mb-2">Como usar</h3>
        <pre className="text-sm bg-background p-3 rounded overflow-x-auto">
{`curl -X POST https://api.livchat.ai/v1/messages/send \\
  -H "Authorization: Bearer lc_live_sua_key_aqui" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "5511999999999",
    "message": "Olá!"
  }'`}
        </pre>
        <p className="text-xs text-muted-foreground mt-2">
          <a href="https://docs.livchat.ai" className="text-primary hover:underline">
            Ver documentação completa →
          </a>
        </p>
      </Card>
    </div>
  );
}
```

---

## Fase 5: Mintlify Docs

### 5.1 Estrutura

```
/home/pedro/dev/sandbox/livchat/docs/
├── mint.json                 # Config Mintlify
├── introduction.mdx          # Página inicial
├── quickstart.mdx            # Getting started
├── authentication.mdx        # API Keys
├── rate-limits.mdx           # Limites
├── webhooks.mdx              # Configurar webhooks
├── api-reference/
│   ├── overview.mdx          # Visão geral
│   ├── messages/
│   │   ├── send-text.mdx
│   │   ├── send-image.mdx
│   │   ├── send-document.mdx
│   │   └── ...
│   ├── contacts/
│   │   ├── check.mdx
│   │   ├── info.mdx
│   │   └── ...
│   ├── session/
│   │   ├── status.mdx
│   │   ├── connect.mdx
│   │   └── ...
│   └── groups/
│       ├── list.mdx
│       ├── create.mdx
│       └── ...
├── sdks/
│   ├── javascript.mdx
│   ├── python.mdx
│   └── php.mdx
└── changelog.mdx
```

### 5.2 mint.json

```json
{
  "$schema": "https://mintlify.com/schema.json",
  "name": "LivChat.ai",
  "logo": {
    "dark": "/logo/dark.svg",
    "light": "/logo/light.svg"
  },
  "favicon": "/favicon.svg",
  "colors": {
    "primary": "#8B5CF6",
    "light": "#A78BFA",
    "dark": "#7C3AED",
    "anchors": {
      "from": "#8B5CF6",
      "to": "#6366F1"
    }
  },
  "topbarLinks": [
    {
      "name": "Dashboard",
      "url": "https://app.livchat.ai"
    }
  ],
  "topbarCtaButton": {
    "name": "Começar Grátis",
    "url": "https://app.livchat.ai"
  },
  "tabs": [
    {
      "name": "API Reference",
      "url": "api-reference"
    },
    {
      "name": "SDKs",
      "url": "sdks"
    }
  ],
  "anchors": [
    {
      "name": "GitHub",
      "icon": "github",
      "url": "https://github.com/livchat"
    },
    {
      "name": "Discord",
      "icon": "discord",
      "url": "https://discord.gg/livchat"
    }
  ],
  "navigation": [
    {
      "group": "Começar",
      "pages": [
        "introduction",
        "quickstart",
        "authentication",
        "rate-limits",
        "webhooks"
      ]
    },
    {
      "group": "API Reference",
      "pages": [
        "api-reference/overview",
        {
          "group": "Mensagens",
          "pages": [
            "api-reference/messages/send-text",
            "api-reference/messages/send-image",
            "api-reference/messages/send-document",
            "api-reference/messages/send-audio",
            "api-reference/messages/send-video",
            "api-reference/messages/send-location",
            "api-reference/messages/send-contact",
            "api-reference/messages/send-sticker",
            "api-reference/messages/react",
            "api-reference/messages/read"
          ]
        },
        {
          "group": "Contatos",
          "pages": [
            "api-reference/contacts/check",
            "api-reference/contacts/info",
            "api-reference/contacts/avatar",
            "api-reference/contacts/list"
          ]
        },
        {
          "group": "Sessão",
          "pages": [
            "api-reference/session/status",
            "api-reference/session/qr",
            "api-reference/session/connect",
            "api-reference/session/disconnect",
            "api-reference/session/logout"
          ]
        },
        {
          "group": "Grupos",
          "pages": [
            "api-reference/groups/list",
            "api-reference/groups/info",
            "api-reference/groups/create",
            "api-reference/groups/invite-link"
          ]
        }
      ]
    },
    {
      "group": "SDKs",
      "pages": [
        "sdks/javascript",
        "sdks/python",
        "sdks/php"
      ]
    }
  ],
  "footerSocials": {
    "twitter": "https://twitter.com/livchat",
    "github": "https://github.com/livchat"
  },
  "api": {
    "baseUrl": "https://api.livchat.ai",
    "auth": {
      "method": "bearer"
    }
  }
}
```

### 5.3 Exemplo de Página: Send Text

```mdx
---
title: "Enviar Mensagem de Texto"
api: "POST /v1/messages/send"
description: "Envia uma mensagem de texto para um número de WhatsApp"
---

## Request

<ParamField body="phone" type="string" required>
  Número de telefone no formato internacional (apenas dígitos).
  Exemplo: `5511999999999`
</ParamField>

<ParamField body="message" type="string" required>
  Conteúdo da mensagem. Máximo de 4096 caracteres.
</ParamField>

<ParamField body="linkPreview" type="boolean" default="false">
  Se `true`, gera preview para links na mensagem.
</ParamField>

## Response

<ResponseField name="success" type="boolean">
  Indica se a mensagem foi enviada.
</ResponseField>

<ResponseField name="messageId" type="string">
  ID único da mensagem enviada.
</ResponseField>

<ResponseField name="timestamp" type="number">
  Timestamp Unix do envio.
</ResponseField>

<RequestExample>
```bash
curl -X POST https://api.livchat.ai/v1/messages/send \
  -H "Authorization: Bearer lc_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "5511999999999",
    "message": "Olá! Teste de integração 🚀"
  }'
```
</RequestExample>

<ResponseExample>
```json
{
  "success": true,
  "messageId": "3EB06F9067F80BAB89FF",
  "timestamp": 1702234567
}
```
</ResponseExample>

## Erros Comuns

| Código | Mensagem | Solução |
|--------|----------|---------|
| 401 | Invalid API key | Verifique sua API key |
| 429 | Rate limit exceeded | Aguarde antes de tentar novamente |
| 404 | No connected instance | Conecte o WhatsApp no dashboard |
```

---

## Checklist de Implementação

### Fase 1: API Keys - Schema Refactoring 🔲 PENDENTE
> Atualizar schema existente para suportar Device-Based + Claiming

- [ ] **Migration**: Alterar tabela `api_keys`
  - [ ] Tornar `organizationId` NULLABLE (órfãs até claim)
  - [ ] Adicionar `createdByDeviceId` (FK → devices, ON DELETE SET NULL)
  - [ ] Tornar `instanceId` NOT NULL + CASCADE (key morre com instance)
  - [ ] Adicionar `claimedAt` timestamp
  - [ ] Remover `createdByUserId` (não existe mais)
  - [ ] Adicionar índices: `idx_api_key_device`, `idx_api_key_instance`
- [ ] **Schema**: Atualizar `src/server/db/schema.ts`
- [ ] **Relações**: Atualizar `apiKeysRelations`

### Fase 1.1: API Keys - Novas Funções 🔲 PENDENTE
> Implementar funções do novo modelo (Device-Based + Claiming)

- [ ] `createApiKeyForInstance(instanceId, deviceId)` - cria key quando instance conecta
- [ ] `claimDeviceApiKeys(deviceId, organizationId)` - claim keys órfãs no login
- [ ] `validateAndResolveInstance(token)` - validação unificada (Opção B)
- [ ] `getApiKeyForInstance(instanceId)` - busca key para exibir na LP
- [ ] Atualizar `listApiKeys()` - incluir instanceId
- [ ] Manter `revokeApiKey()`, `maskApiKeyToken()`, `generateApiKeyToken()`
- [ ] Testes unitários para novas funções

### Fase 1.2: Integração com Instance 🔲 PENDENTE
> Criar API Key automaticamente quando WhatsApp conecta

- [ ] Modificar `syncInstanceStatus()` em `src/server/lib/instance.ts`
  - [ ] Detectar quando `loggedIn` passa de false → true
  - [ ] Chamar `createApiKeyForInstance(instanceId, deviceId)`
- [ ] Modificar `whatsapp.status` para retornar `apiKey` (não mais `providerToken`)

### Fase 1.3: Integração com User (Claiming) 🔲 PENDENTE
> Claim API Keys junto com Instances no login

- [ ] Modificar `syncUserFromClerk()` em `src/server/lib/user.ts`
  - [ ] Após `claimDeviceInstances()`, chamar `claimDeviceApiKeys()`
  - [ ] Logar quantidade de keys claimed

### Fase 1.4: Landing Page Integration 🔲 PENDENTE
> Exibir API Key real na LP (test-panel)

- [ ] Atualizar `useWhatsApp` hook para usar novo campo `apiKey`
- [ ] Atualizar `test-panel.tsx` para exibir `apiKey` quando conectado
- [ ] Garantir que key só aparece após `loggedIn = true`

### Fase 2: Cloudflare Workers ✅ COMPLETO
- [x] Criar projeto workers/api-gateway
- [x] Implementar entry point (index.ts)
- [x] Implementar auth.ts (validação via Vercel)
- [x] Implementar rate-limit.ts (Durable Objects SQLite)
- [x] Implementar router.ts (mapeamento de rotas)
- [x] Configurar wrangler.jsonc
- [x] Criar KV namespace para cache
- [x] Configurar INTERNAL_SECRET
- [x] Deploy para Cloudflare
- [x] Configurar DNS (api.livchat.ai)

### Fase 3: Vercel Integration 🔄 ATUALIZAR
> Endpoint já existe, mas precisa usar nova função

- [x] Criar endpoint `/api/internal/validate-key`
- [x] Adicionar INTERNAL_SECRET no schema de env
- [ ] **ATUALIZAR**: Usar `validateAndResolveInstance()` em vez da lógica antiga
- [ ] Adicionar INTERNAL_SECRET no .env da Vercel (deploy)
- [ ] Testar comunicação Worker ↔ Vercel (após deploy)

### Fase 4: Dashboard UI 🔲 PENDENTE
- [ ] Criar componente ApiKeysManager
- [ ] Criar página /app/settings/api-keys
- [ ] UI para listar, revogar (NÃO criar - keys são automáticas)
- [ ] Mostrar qual instance cada key está vinculada
- [ ] Exemplo de uso com cURL

### Fase 5: Documentação (Mintlify) 🔲 PENDENTE
- [ ] Configurar projeto docs/
- [ ] Criar mint.json
- [ ] Escrever introdução e quickstart
- [ ] Documentar autenticação
- [ ] Documentar cada endpoint
- [ ] Configurar deploy
- [ ] Configurar DNS (docs.livchat.ai)

### Fase 6: Testes E2E 🔲 PENDENTE
- [ ] Testar fluxo anônimo: LP → QR → connect → API key criada
- [ ] Testar claim: login → keys claimed → todas acessam todas instances
- [ ] Testar key órfã: só acessa sua instance
- [ ] Testar cleanup: instance deletada → key deletada (CASCADE)
- [ ] Testar rate limiting
- [ ] Testar revogação de key

---

## Environment Variables Adicionais

```env
# Vercel (.env)
INTERNAL_SECRET="random_secret_for_worker_communication"

# Cloudflare Workers (wrangler secret put)
DATABASE_URL="..."           # Para validação direta (opcional)
INTERNAL_SECRET="..."        # Para comunicação com Vercel
WUZAPI_URL="https://wuz.livchat.ai"
VERCEL_URL="https://app.livchat.ai"
```

---

## Critérios de Sucesso

1. **Funcional**: Developer consegue criar API key e fazer request
2. **Seguro**: Tokens com UNIQUE index, rate limiting no edge, scopes validados
3. **Rápido**: <100ms de latência adicionada pelo gateway (cache KV + edge computing)
4. **Documentado**: Todos os endpoints documentados no Mintlify
5. **Monitorado**: Logs de uso via Cloudflare observability

---

## Estimativa de Complexidade

| Fase | Arquivos | Complexidade |
|------|----------|--------------|
| 1. API Keys | 4-5 | Média |
| 2. Cloudflare Workers | 6-8 | Alta |
| 3. Vercel Integration | 1-2 | Baixa |
| 4. Dashboard UI | 2-3 | Média |
| 5. Mintlify Docs | 15-20 | Média |
| 6. Testes | 3-5 | Média |

**Total**: ~35 arquivos novos/modificados
