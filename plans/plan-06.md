# Plan 06: Event Log + Sistema de Limites + Contador Global

## Status: 🟡 EM PROGRESSO (Fase 1 e 2 completas + Fly.io configurado)

**Dependências:**
- ✅ Plan 01: Landing Page
- ✅ Plan 02: WuzAPI Integration
- ✅ Plan 04.1: Database & Instances
- 🟡 Plan 05: API Gateway + API Keys

**Baseado em:**
- `docs/system-design.md`
- Referência: Chatwoot `reporting_events`
- WuzAPI Webhooks (`/home/pedro/dev/sandbox/buildzero/wuzapi/API.md`)

---

## Objetivo

Implementar um **sistema de Event Log** desacoplado do WuzAPI para:

1. **Contabilizar uso** - Mensagens transacionadas, chamadas de API
2. **Aplicar limites** - Herança de limites Org → Instance → API Key
3. **Exibir métricas** - Contador global na landing page (Fase 2)
4. **Auditoria** - Histórico de eventos para billing e compliance

---

## Princípios de Design

### Desacoplamento do WuzAPI

O WuzAPI já persiste (NÃO duplicar):
- `message_history` - Conteúdo completo das mensagens
- `users` - Configuração de webhooks e eventos
- Chaves de criptografia (whatsmeow)

O LivChat persiste (complementar):
- **Event Log** - Apenas metadados (QUANDO aconteceu, não O QUE)
- **Contadores agregados** - Para queries rápidas
- **Limites de uso** - Por org/instance/key

### Eventos a Registrar

| Evento | Source | Valor | Conta para Billing |
|--------|--------|-------|-------------------|
| `message.received` | Webhook WuzAPI | 1 | ✅ Sim |
| `message.sent` | API call bem-sucedida | 1 | ✅ Sim |
| `api.call` | Qualquer chamada REST | 1 | ✅ Sim (rate limit) |
| `api.validation` | Validação de número | 1 | ✅ Sim |
| `connection.connected` | Webhook WuzAPI | 0 | ❌ Não |
| `connection.disconnected` | Webhook WuzAPI | 0 | ❌ Não |

**Regra:** Apenas "ações reais" contam - não conta criação de instância, conexão, etc.

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EVENT LOG ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────┐        ┌─────────────────┐                            │
│   │    WuzAPI       │        │   LivChat API   │                            │
│   │  (WhatsApp)     │        │   (tRPC/REST)   │                            │
│   └────────┬────────┘        └────────┬────────┘                            │
│            │                          │                                      │
│            │ Webhook POST             │ API call                             │
│            │ (Message, etc)           │ (send, validate)                     │
│            ▼                          ▼                                      │
│   ┌─────────────────────────────────────────────────────────────────┐       │
│   │              /api/webhooks/wuzapi/route.ts                       │       │
│   │              server/api/routers/whatsapp.ts                      │       │
│   │                                                                  │       │
│   │  1. Processar evento/chamada                                     │       │
│   │  2. Registrar em `events` table                                  │       │
│   │  3. Incrementar contador da instance                             │       │
│   │  4. Verificar limite (org.maxMessagesPerDay)                     │       │
│   └─────────────────────────────────────────────────────────────────┘       │
│                              │                                               │
│                              ▼                                               │
│   ┌─────────────────────────────────────────────────────────────────┐       │
│   │                      PostgreSQL                                  │       │
│   │                                                                  │       │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │       │
│   │  │   events    │  │  instances  │  │organizations│              │       │
│   │  │             │  │             │  │             │              │       │
│   │  │ - name      │  │ - messages  │  │ - maxMsgs   │              │       │
│   │  │ - orgId     │  │   UsedToday │  │   PerDay    │              │       │
│   │  │ - created   │  │ - lastReset │  │ - plan      │              │       │
│   │  └─────────────┘  └─────────────┘  └─────────────┘              │       │
│   │                                                                  │       │
│   │  INDEX: (organizationId, name, createdAt)                       │       │
│   └─────────────────────────────────────────────────────────────────┘       │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────┐       │
│   │                    FASE 2: Contador Global                       │       │
│   │                                                                  │       │
│   │  Landing Page ──► /api/stats/counter ──► Odometer.js            │       │
│   │                                                                  │       │
│   │  { baseValue: 1234567, ratePerSecond: 2.3, calculatedAt: ts }   │       │
│   └─────────────────────────────────────────────────────────────────┘       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Fase 1: Schema Event Log

### 1.1 Criar tabela `events`

**Arquivo:** `server/db/schema.ts`

```typescript
export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Tipo do evento
  name: text("name").notNull(),
  // 'message.sent', 'message.received', 'api.call', 'api.validation'

  // Contexto (foreign keys - opcionais para flexibilidade)
  organizationId: uuid("organization_id")
    .references(() => organizations.id, { onDelete: "cascade" }),
  instanceId: uuid("instance_id")
    .references(() => instances.id, { onDelete: "cascade" }),
  apiKeyId: uuid("api_key_id")
    .references(() => apiKeys.id, { onDelete: "set null" }),
  deviceId: uuid("device_id")
    .references(() => devices.id, { onDelete: "set null" }),

  // Valor (para métricas numéricas)
  value: integer("value").notNull().default(1),

  // Metadata opcional (JSON para dados extras)
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),

  // Timestamps
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (table) => ({
  // Índice composto CRÍTICO para queries de agregação
  idxOrgNameCreated: index("idx_events_org_name_created")
    .on(table.organizationId, table.name, table.createdAt),
  idxInstanceCreated: index("idx_events_instance_created")
    .on(table.instanceId, table.createdAt),
  idxName: index("idx_events_name")
    .on(table.name),
}));
```

### 1.2 Criar tipos de eventos

**Arquivo:** `lib/events.ts`

```typescript
export const EventTypes = {
  // Mensagens (contam para billing)
  MESSAGE_SENT: "message.sent",
  MESSAGE_RECEIVED: "message.received",

  // API (contam para rate limit)
  API_CALL: "api.call",
  API_VALIDATION: "api.validation",

  // Conexão (não contam, apenas auditoria)
  CONNECTION_CONNECTED: "connection.connected",
  CONNECTION_DISCONNECTED: "connection.disconnected",
  CONNECTION_QR_SCANNED: "connection.qr_scanned",
} as const;

export type EventType = typeof EventTypes[keyof typeof EventTypes];

// Eventos que contam para limite de mensagens
export const BILLABLE_MESSAGE_EVENTS = [
  EventTypes.MESSAGE_SENT,
  EventTypes.MESSAGE_RECEIVED,
] as const;

// Eventos que contam para rate limit de API
export const RATE_LIMITED_EVENTS = [
  EventTypes.API_CALL,
  EventTypes.API_VALIDATION,
] as const;
```

### 1.3 Criar função de registro

**Arquivo:** `server/lib/events.ts`

```typescript
import { db } from "~/server/db";
import { events } from "~/server/db/schema";
import type { EventType } from "~/lib/events";

interface LogEventParams {
  name: EventType;
  organizationId?: string | null;
  instanceId?: string | null;
  apiKeyId?: string | null;
  deviceId?: string | null;
  value?: number;
  metadata?: Record<string, unknown>;
}

export async function logEvent(params: LogEventParams): Promise<void> {
  await db.insert(events).values({
    name: params.name,
    organizationId: params.organizationId ?? null,
    instanceId: params.instanceId ?? null,
    apiKeyId: params.apiKeyId ?? null,
    deviceId: params.deviceId ?? null,
    value: params.value ?? 1,
    metadata: params.metadata ?? null,
  });
}

// Query para contar eventos por período
export async function countEvents(
  organizationId: string,
  eventName: EventType,
  since: Date
): Promise<number> {
  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(events)
    .where(and(
      eq(events.organizationId, organizationId),
      eq(events.name, eventName),
      gte(events.createdAt, since)
    ));

  return result[0]?.count ?? 0;
}

// Query para stats globais (landing page)
export async function getGlobalStats(): Promise<{
  totalMessages: number;
  ratePerSecond: number;
}> {
  // Total de mensagens (sent + received)
  const [{ total }] = await db
    .select({ total: sql<number>`COUNT(*)` })
    .from(events)
    .where(inArray(events.name, BILLABLE_MESSAGE_EVENTS));

  // Taxa dos últimos 5 minutos
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const [{ recent }] = await db
    .select({ recent: sql<number>`COUNT(*)` })
    .from(events)
    .where(and(
      inArray(events.name, BILLABLE_MESSAGE_EVENTS),
      gte(events.createdAt, fiveMinAgo)
    ));

  return {
    totalMessages: total ?? 0,
    ratePerSecond: (recent ?? 0) / 300,
  };
}
```

### 1.4 Migration

**Arquivo:** `drizzle/migrations/XXXX_add_events_table.sql`

```sql
CREATE TABLE IF NOT EXISTS "events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "organization_id" uuid REFERENCES "organizations"("id") ON DELETE CASCADE,
  "instance_id" uuid REFERENCES "instances"("id") ON DELETE CASCADE,
  "api_key_id" uuid REFERENCES "api_keys"("id") ON DELETE SET NULL,
  "device_id" uuid REFERENCES "devices"("id") ON DELETE SET NULL,
  "value" integer NOT NULL DEFAULT 1,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Índices críticos para performance
CREATE INDEX IF NOT EXISTS "idx_events_org_name_created"
  ON "events" ("organization_id", "name", "created_at");
CREATE INDEX IF NOT EXISTS "idx_events_instance_created"
  ON "events" ("instance_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_events_name"
  ON "events" ("name");
```

---

## Fase 2: Webhook Receiver (WuzAPI)

### 2.1 Criar endpoint de webhook

**Arquivo:** `app/api/webhooks/wuzapi/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "~/server/db";
import { instances } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { logEvent } from "~/server/lib/events";
import { EventTypes } from "~/lib/events";
import { incrementMessageCount } from "~/server/lib/instance";

// Tipos de eventos do WuzAPI que nos interessam
const WUZAPI_EVENT_MAP: Record<string, typeof EventTypes[keyof typeof EventTypes] | null> = {
  "Message": EventTypes.MESSAGE_RECEIVED,
  "ReadReceipt": null, // Não registramos
  "Connected": EventTypes.CONNECTION_CONNECTED,
  "Disconnected": EventTypes.CONNECTION_DISCONNECTED,
  "LoggedOut": EventTypes.CONNECTION_DISCONNECTED,
};

export async function POST(request: NextRequest) {
  try {
    // Parse do body (WuzAPI envia como form ou json)
    const contentType = request.headers.get("content-type") ?? "";
    let payload: Record<string, unknown>;

    if (contentType.includes("application/json")) {
      payload = await request.json();
    } else {
      const formData = await request.formData();
      const jsonData = formData.get("jsonData");
      payload = jsonData ? JSON.parse(jsonData as string) : {};
    }

    // Extrair token do WuzAPI (identifica a instância)
    const token = payload.token as string;
    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    // Buscar instância pelo providerToken
    const instance = await db.query.instances.findFirst({
      where: eq(instances.providerToken, token),
      with: { organization: true },
    });

    if (!instance) {
      return NextResponse.json({ error: "Instance not found" }, { status: 404 });
    }

    // Determinar tipo de evento
    const eventType = payload.type as string;
    const mappedEvent = WUZAPI_EVENT_MAP[eventType];

    if (mappedEvent) {
      // Registrar evento
      await logEvent({
        name: mappedEvent,
        organizationId: instance.organizationId,
        instanceId: instance.id,
        metadata: {
          wuzapiType: eventType,
          timestamp: payload.timestamp,
        },
      });

      // Se for mensagem recebida, incrementar contador
      if (mappedEvent === EventTypes.MESSAGE_RECEIVED) {
        await incrementMessageCount(instance.id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
```

### 2.2 Atualizar middleware para permitir webhook

**Arquivo:** `middleware.ts` (já configurado)

```typescript
// Já existe:
"/api/webhooks(.*)",    // Webhooks externos
```

### 2.3 Configurar webhook no WuzAPI ao conectar

**Arquivo:** `server/lib/wuzapi.ts` - Adicionar método

```typescript
async setWebhook(webhookUrl: string): Promise<WuzAPIResponse<{ webhook: string }>> {
  return this.request("/webhook", {
    method: "POST",
    body: JSON.stringify({ webhookURL: webhookUrl }),
  });
}
```

**Arquivo:** `server/api/routers/whatsapp.ts` - Após conexão bem-sucedida

```typescript
// Dentro de syncInstanceStatus() ou após connect
if (status.loggedIn && status.jid) {
  const webhookUrl = `${env.NEXT_PUBLIC_APP_URL}/api/webhooks/wuzapi`;
  await client.setWebhook(webhookUrl);
}
```

---

## Fase 3: Integração nos Endpoints Existentes

### 3.1 Atualizar `whatsapp.send`

**Arquivo:** `server/api/routers/whatsapp.ts`

```typescript
// Após enviar mensagem com sucesso
await logEvent({
  name: EventTypes.MESSAGE_SENT,
  organizationId: instance.organizationId,
  instanceId: instance.id,
  apiKeyId: ctx.apiKey?.id, // Se chamado via API
  deviceId: ctx.device?.id,
});

// incrementMessageCount já existe
const newUsage = await incrementMessageCount(instance.id);
```

### 3.2 Atualizar validação de número

**Arquivo:** `server/api/routers/whatsapp.ts` - Em `whatsapp.validate`

```typescript
// Após validar número
await logEvent({
  name: EventTypes.API_VALIDATION,
  organizationId: instance.organizationId,
  instanceId: instance.id,
  deviceId: ctx.device?.id,
  metadata: { phone: input.phone, isValid: result.isValid },
});
```

### 3.3 Registrar chamadas de API (Gateway)

**No Cloudflare Worker** (api.livchat.ai):

```typescript
// Após validar key e antes de proxy
await fetch(`${VERCEL_URL}/api/internal/log-event`, {
  method: "POST",
  headers: { "X-Internal-Secret": INTERNAL_SECRET },
  body: JSON.stringify({
    name: "api.call",
    organizationId: validatedKey.organizationId,
    instanceId: validatedKey.instanceId,
    apiKeyId: validatedKey.id,
    metadata: { endpoint: request.url, method: request.method },
  }),
});
```

---

## Fase 4: Sistema de Limites Aprimorado

### 4.1 Herança de limites

```
Organization
  └─ maxMessagesPerDay: 50 (free) | 5000 (pro) | -1 (enterprise/unlimited)
       ↓
Instance
  └─ messagesUsedToday (contador com lazy reset)
       ↓
API Key
  └─ rateLimitRequests (100/min default, herda de org se não definido)
```

### 4.2 Atualizar `canSendMessage` para considerar Event Log

**Arquivo:** `server/lib/instance.ts`

```typescript
export async function canSendMessage(instanceId: string): Promise<{
  canSend: boolean;
  used: number;
  limit: number;
  remaining: number;
  source: "counter" | "eventlog";
}> {
  const instance = await db.query.instances.findFirst({
    where: eq(instances.id, instanceId),
    with: { organization: true },
  });

  if (!instance) {
    return { canSend: false, used: 0, limit: 0, remaining: 0, source: "counter" };
  }

  // Limite vem da org (ou default para órfã)
  const limit = instance.organization?.maxMessagesPerDay ?? DEMO_MESSAGE_LIMIT;

  // -1 significa ilimitado
  if (limit === -1) {
    return { canSend: true, used: 0, limit: -1, remaining: -1, source: "counter" };
  }

  // Usar contador existente (lazy reset)
  const { currentCount } = checkAndResetMessageCount(instance);

  return {
    canSend: currentCount < limit,
    used: currentCount,
    limit,
    remaining: Math.max(0, limit - currentCount),
    source: "counter",
  };
}
```

### 4.3 Adicionar campos de limite na Organization

**Arquivo:** `server/db/schema.ts` - Já existe, verificar:

```typescript
// organizations table
maxMessagesPerDay: integer("max_messages_per_day").notNull().default(50),
rateLimitRequests: integer("rate_limit_requests").notNull().default(100),
rateLimitWindowSeconds: integer("rate_limit_window_seconds").notNull().default(60),
```

### 4.4 Herança de rate limit para API Keys

**Arquivo:** `server/lib/api-key.ts`

```typescript
export async function getEffectiveLimits(apiKey: ApiKey): Promise<{
  rateLimitRequests: number;
  rateLimitWindowSeconds: number;
}> {
  // Se key tem limites próprios, usa eles
  if (apiKey.rateLimitRequests !== null) {
    return {
      rateLimitRequests: apiKey.rateLimitRequests,
      rateLimitWindowSeconds: apiKey.rateLimitWindowSeconds ?? 60,
    };
  }

  // Senão, herda da organização
  if (apiKey.organizationId) {
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, apiKey.organizationId),
    });

    if (org) {
      return {
        rateLimitRequests: org.rateLimitRequests,
        rateLimitWindowSeconds: org.rateLimitWindowSeconds,
      };
    }
  }

  // Default
  return { rateLimitRequests: 100, rateLimitWindowSeconds: 60 };
}
```

---

## Fase 5: Contador Global na Landing (FASE 2 - Futuro)

### 5.1 Endpoint de stats

**Arquivo:** `app/api/stats/counter/route.ts`

```typescript
import { NextResponse } from "next/server";
import { getGlobalStats } from "~/server/lib/events";

// Cache de 5 minutos
let cache: { data: unknown; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

export async function GET() {
  // Verificar cache
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  const stats = await getGlobalStats();

  const response = {
    baseValue: stats.totalMessages,
    ratePerSecond: stats.ratePerSecond,
    calculatedAt: Date.now(),
  };

  // Atualizar cache
  cache = { data: response, timestamp: Date.now() };

  return NextResponse.json(response);
}
```

### 5.2 Componente LiveCounter

**Arquivo:** `components/marketing/live-counter.tsx`

```typescript
"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const Odometer = dynamic(() => import("react-odometerjs"), { ssr: false });
import "odometer/themes/odometer-theme-digital.css";

interface CounterData {
  baseValue: number;
  ratePerSecond: number;
  calculatedAt: number;
}

export function LiveCounter() {
  const [value, setValue] = useState(0);
  const [data, setData] = useState<CounterData | null>(null);

  // Buscar dados do backend a cada 5 min
  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch("/api/stats/counter");
      const json = await res.json();
      setData(json);
    };

    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Interpolar valor a cada 100ms (efeito odômetro)
  useEffect(() => {
    if (!data) return;

    const tick = () => {
      const elapsed = (Date.now() - data.calculatedAt) / 1000;
      const interpolated = Math.floor(data.baseValue + elapsed * data.ratePerSecond);
      setValue(interpolated);
    };

    tick();
    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
  }, [data]);

  return (
    <div className="text-center">
      <div className="text-6xl font-bold text-primary">
        <Odometer value={value} format="(,ddd)" theme="digital" duration={150} />
      </div>
      <p className="text-muted-foreground mt-2">
        Mensagens transacionadas
      </p>
    </div>
  );
}
```

### 5.3 Integrar na seção Metrics existente

**Arquivo:** `components/marketing/metrics.tsx` - Adicionar como primeiro item

```typescript
// Primeiro metric pode ser o contador em tempo real
// Os outros 3 continuam estáticos
```

---

## Tarefas por Fase

### Fase 1: Schema Event Log
- [x] 1.1 Criar schema `events` em `schema.ts`
- [x] 1.2 Criar tipos de eventos em `lib/events.ts`
- [x] 1.3 Criar funções de log em `server/lib/events.ts`
- [x] 1.4 Gerar e rodar migration
- [x] 1.5 Testes unitários para `logEvent` e `countEvents`

### Fase 2: Webhook Receiver
- [x] 2.1 Criar `app/api/webhooks/wuzapi/route.ts`
- [ ] 2.2 Adicionar método `setWebhook` no client WuzAPI
- [x] 2.3 Configurar webhook URL via env (WUZAPI_GLOBAL_WEBHOOK)
- [x] 2.4 Testes de integração com WuzAPI
- [x] 2.5 Configurar Fly.io: webhook URL + remover RabbitMQ

### Fase 3: Integração Endpoints
- [ ] 3.1 Registrar evento em `whatsapp.send`
- [ ] 3.2 Registrar evento em `whatsapp.validate`
- [ ] 3.3 Criar endpoint interno para log do Gateway

### Fase 4: Sistema de Limites
- [ ] 4.1 Adicionar campos de rate limit em `organizations`
- [ ] 4.2 Implementar `getEffectiveLimits` para herança
- [ ] 4.3 Atualizar `validateAndResolveInstance` para incluir limites herdados
- [ ] 4.4 Testes de herança de limites

### Fase 5: Contador Global (FASE 2)
- [ ] 5.1 Criar endpoint `/api/stats/counter`
- [ ] 5.2 Instalar `react-odometerjs`
- [ ] 5.3 Criar componente `LiveCounter`
- [ ] 5.4 Integrar na seção Metrics
- [ ] 5.5 Escolher dados a exibir (mensagens, API calls, etc)

---

## Critérios de Sucesso

### Fase 1 (Event Log)
- [ ] Tabela `events` criada com índices corretos
- [ ] `logEvent()` funciona e não bloqueia requests
- [ ] Queries de agregação executam em < 100ms

### Fase 2 (Webhook)
- [ ] Endpoint recebe POSTs do WuzAPI
- [ ] Eventos `Message` incrementam contador
- [ ] Logs aparecem no banco

### Fase 3 (Integração)
- [ ] `whatsapp.send` registra evento
- [ ] Limite de 50 msgs/dia continua funcionando
- [ ] Event log reflete uso real

### Fase 4 (Limites)
- [ ] Org define limite, Instance herda
- [ ] API Key herda rate limit da Org
- [ ] Plano PRO tem limite maior

### Fase 5 (Contador)
- [ ] Contador aparece na landing
- [ ] Atualiza suavemente (odômetro)
- [ ] Número cresce mesmo sem refresh

---

## Próximos Passos

1. **Implementar Fase 1** - Schema básico
2. **Implementar Fase 2** - Webhook receiver
3. **Validar fluxo** - Enviar msg, ver log
4. **Fase 3-4** - Integração completa
5. **Fase 5** - Enriquecer landing page

---

## Changelog

| Data | Mudança |
|------|---------|
| 2025-12-10 | Criação do plano |
| 2025-12-10 | Fase 1 implementada: schema `events`, tipos em `lib/events.ts`, funções `logEvent`/`countEvents` |
| 2025-12-10 | Fase 2 implementada: webhook receiver `/api/webhooks/wuzapi`, configuração global via env |
| 2025-12-10 | RabbitMQ desabilitado no WuzAPI local (25k+ eventos acumulados sem consumidor) |
| 2025-12-10 | 33 testes unitários adicionados para eventos e webhook |
| 2025-12-10 | Fly.io: RabbitMQ removido, WUZAPI_GLOBAL_WEBHOOK configurado para `https://livchat.ai/api/webhooks/wuzapi` |
