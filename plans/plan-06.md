# Plan 06: Event Log + Sistema de Limites + Contador Global

## Status: ✅ COMPLETO (Todas as Fases)

### Implementado em 2024-12-10:
- ✅ **Fase 1:** Setup Redis (Upstash) - `@upstash/redis`, `redis.ts`, `quota.ts`
- ✅ **Fase 2:** Refatorar Limite - INCR-first, BUG corrigido (webhook não incrementa)
- ✅ **Fase 3:** Event Logging - `logEvent(MESSAGE_SENT)` no whatsapp.send
- ✅ **Fase 4:** Migration - Campos removidos do schema
- ✅ **Fase 5:** Contador Global na Landing - Hook custom `useAnimatedCounter`, `LiveCounter` component

**Dependências:**
- ✅ Plan 01: Landing Page
- ✅ Plan 02: WuzAPI Integration
- ✅ Plan 04.1: Database & Instances
- ✅ Plan 05: API Gateway + API Keys
- ✅ Plan 07: API Consolidation

**Baseado em:**
- `docs/system-design.md`
- Referência: Chatwoot `reporting_events`
- Padrões de mercado: Stripe, Twilio, AWS (quotas com Redis)

---

## Objetivo

Implementar um **sistema de Event Log + Quotas** elegante e performático:

1. **Redis para Quotas** - Controle de limite em tempo real (~1ms)
2. **Events para Audit** - Source of truth para billing/analytics
3. **Contador Global** - Landing page com odômetro animado
4. **Experiência Generosa** - Usuário não é bloqueado "de surpresa"

---

## Arquitetura Nova: Redis + Events

### Princípio: Separação de Responsabilidades

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    NOVA ARQUITETURA: REDIS + EVENTS                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────┐                                                       │
│   │  Upstash Redis  │  ◄── Quota em tempo real                             │
│   │  (TTL auto)     │      • checkQuota() → GET ~1ms                       │
│   └────────┬────────┘      • incrementQuota() → INCR após envio            │
│            │               • Reset automático via TTL (meia-noite SP)       │
│            │                                                                │
│   ┌────────▼────────┐                                                       │
│   │   PostgreSQL    │  ◄── Audit log para billing                          │
│   │   (events)      │      • logEvent() → INSERT async                     │
│   └─────────────────┘      • getGlobalStats() → COUNT para landing         │
│                                                                             │
│   REMOVIDO do schema:                                                       │
│   ├── instances.messagesUsedToday     (Redis cuida)                        │
│   └── instances.lastMessageResetAt    (TTL cuida)                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Fluxo de Envio de Mensagem

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FLUXO: whatsapp.send                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Request chega                                                           │
│         │                                                                   │
│         ▼                                                                   │
│  2. checkQuota(instanceId) → Redis GET (~1ms)                              │
│         │                                                                   │
│         ├── used < limit?  → ✅ PERMITE, continua                          │
│         └── used >= limit? → ❌ BLOQUEIA, retorna erro                     │
│                                                                             │
│  3. Envia mensagem pro WhatsApp (WuzAPI)                                   │
│         │                                                                   │
│         ▼                                                                   │
│  4. incrementQuota(instanceId) → Redis INCR (fire-and-forget)              │
│         │                                                                   │
│         ▼                                                                   │
│  5. logEvent(MESSAGE_SENT) → Postgres INSERT (async)                       │
│         │                                                                   │
│         ▼                                                                   │
│  6. Retorna sucesso + usage atualizado                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Eventos a Registrar

| Evento | Source | Conta p/ Limite | Conta p/ Billing |
|--------|--------|-----------------|------------------|
| `message.sent` | whatsapp.send | ✅ Sim (Redis) | ✅ Sim (Events) |
| `message.received` | Webhook WuzAPI | ❌ Não | ✅ Sim (Events) |
| `api.validation` | whatsapp.validate | ❌ Não | ✅ Sim (Events) |
| `connection.*` | Webhook WuzAPI | ❌ Não | ❌ Não (só audit) |

**IMPORTANTE:** Limite de 50 msg/dia conta apenas mensagens ENVIADAS, não recebidas!

---

## Fase 1: Setup Redis (Upstash) ✅ JÁ COMPLETO (parcial)

### 1.1 Instalar dependência

```bash
cd app && bun add @upstash/redis
```

### 1.2 Configurar env.js

**Arquivo:** `src/env.js`

```typescript
server: {
  // ... existentes ...
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
},
runtimeEnv: {
  // ... existentes ...
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
},
```

### 1.3 Criar cliente Redis

**Arquivo:** `server/lib/redis.ts`

```typescript
import { Redis } from "@upstash/redis";
import { env } from "~/env";

export const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});
```

### 1.4 Criar sistema de quota (INCR-first approach)

**Arquivo:** `server/lib/quota.ts`

```typescript
import { redis } from "~/server/lib/redis";

interface QuotaResult {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
}

/**
 * INCR-first: Incrementa E verifica em uma operação
 * - Mais performático (1 operação vs 2)
 * - Aceita pequeno overage (1-2 msgs) - UX melhor
 * - Usado por: Stripe, Twilio, AWS
 */
export async function useQuota(
  instanceId: string,
  limit: number
): Promise<QuotaResult> {
  const key = `quota:${instanceId}:${today()}`;

  // INCR atômico - retorna novo valor
  const used = await redis.incr(key);

  // Seta TTL na primeira msg do dia
  if (used === 1) {
    await redis.expireat(key, getMidnightSaoPaulo());
  }

  return {
    allowed: used <= limit,  // 50 ou menos = OK
    used,
    limit,
    remaining: Math.max(0, limit - used),
  };
}

/**
 * Busca uso atual (para dashboard, sem incrementar)
 */
export async function getQuotaUsage(instanceId: string): Promise<number> {
  const key = `quota:${instanceId}:${today()}`;
  const value = await redis.get<number>(key);
  return value ?? 0;
}

// Helpers
function today(): string {
  // Formato: "2024-12-10" no timezone de São Paulo
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function getMidnightSaoPaulo(): number {
  const now = new Date();
  // Próxima meia-noite em São Paulo (+ 1h margem)
  const sp = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  sp.setDate(sp.getDate() + 1);
  sp.setHours(1, 0, 0, 0);
  return Math.floor(sp.getTime() / 1000);
}
```

### Fluxo INCR-first

```
┌─────────────────────────────────────────────────────────────────┐
│                    INCR-FIRST APPROACH                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Msg 1:  INCR → count=1  → allowed=true  → ✅ Envia            │
│  Msg 2:  INCR → count=2  → allowed=true  → ✅ Envia            │
│  ...                                                            │
│  Msg 49: INCR → count=49 → allowed=true  → ✅ Envia            │
│  Msg 50: INCR → count=50 → allowed=true  → ✅ Envia (última!)  │
│  Msg 51: INCR → count=51 → allowed=false → ❌ Bloqueia         │
│                                                                 │
│  Vantagens:                                                     │
│  • 1 operação Redis (vs 2 com GET+INCR)                        │
│  • Atômico, sem race conditions                                 │
│  • Aceita 0-1 overage no pior caso (UX melhor)                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Fase 2: Refatorar Limite de Mensagens

### 2.1 Refatorar `canSendMessage` para usar Redis

**Arquivo:** `server/lib/instance.ts`

```typescript
import { checkQuota, getQuotaUsage } from "~/server/lib/quota";

// REMOVER: checkAndResetMessageCount (não precisa mais)
// REMOVER: incrementMessageCount (usar incrementQuota)

export async function canSendMessage(instanceId: string): Promise<{
  canSend: boolean;
  used: number;
  limit: number;
  remaining: number;
}> {
  const instance = await db.query.instances.findFirst({
    where: eq(instances.id, instanceId),
    with: { organization: true },
  });

  if (!instance) {
    return { canSend: false, used: 0, limit: 0, remaining: 0 };
  }

  // Limite vem da org (ou default para órfã)
  const limit = instance.organization?.maxMessagesPerDay ?? DEMO_MESSAGE_LIMIT;

  // -1 significa ilimitado
  if (limit === -1) {
    return { canSend: true, used: 0, limit: -1, remaining: -1 };
  }

  // Usar Redis para verificar quota (~1ms)
  return checkQuota(instanceId, limit);
}
```

### 2.2 Atualizar `whatsapp.send` para nova arquitetura (INCR-first)

**Arquivo:** `server/api/routers/whatsapp.ts`

```typescript
import { useQuota } from "~/server/lib/quota";
import { logEvent } from "~/server/lib/events";
import { EventTypes } from "~/lib/events";

// No mutation send:

// 1. INCR-first: Incrementa E verifica em 1 operação
const quota = await useQuota(instance.id, limit);
if (!quota.allowed) {
  throw new TRPCError({
    code: "FORBIDDEN",
    message: `Limite de ${quota.limit} mensagens/dia atingido.`,
  });
}

// 2. Envia mensagem (WuzAPI) - só chega aqui se quota.allowed=true
const res = await client.sendText(input.to, input.message);

// 3. Log event para audit/billing (Postgres INSERT async)
void logEvent({
  name: EventTypes.MESSAGE_SENT,
  organizationId: instance.organizationId,
  instanceId: instance.id,
  metadata: { messageId: res.data.Id },
});

return {
  success: true,
  messageId: res.data.Id,
  usage: quota,  // { used, limit, remaining, allowed }
};
```

**Nota:** Com INCR-first, o contador já foi incrementado ANTES de enviar. Se a mensagem falhar no WuzAPI, o contador fica "adiantado" em 1. Isso é aceitável porque:
- É raro falhar após passar na quota
- Reseta à meia-noite de qualquer forma
- UX é melhor (não bloqueia no meio)

### 2.3 Remover incrementMessageCount do webhook

**Arquivo:** `app/api/webhooks/wuzapi/route.ts`

```typescript
// REMOVER estas linhas:
// import { incrementMessageCount } from "~/server/lib/instance";
// if (internalEventType === EventTypes.MESSAGE_RECEIVED) {
//   await incrementMessageCount(instance.id);
// }

// MANTER apenas o logEvent para audit:
await logEvent({
  name: internalEventType,
  organizationId: instance.organizationId,
  instanceId: instance.id,
  metadata,
});
```

### 2.4 Atualizar UI para buscar quota do Redis

**Arquivo:** `server/api/routers/whatsapp.ts` - Em `whatsapp.status`

```typescript
import { getQuotaUsage } from "~/server/lib/quota";

// Substituir:
// const usage = await canSendMessage(instance.id);
// Por:
const used = await getQuotaUsage(instance.id);
const limit = instance.organization?.maxMessagesPerDay ?? DEMO_MESSAGE_LIMIT;

return {
  // ...
  messagesUsed: used,
  messagesLimit: limit,
  messagesRemaining: Math.max(0, limit - used),
};
```

---

## Fase 3: Adicionar Event Logging

### 3.1 Adicionar logEvent em `whatsapp.send`

**Arquivo:** `server/api/routers/whatsapp.ts`

```typescript
// Após enviar mensagem com sucesso (já mostrado acima)
void logEvent({
  name: EventTypes.MESSAGE_SENT,
  organizationId: instance.organizationId,
  instanceId: instance.id,
  metadata: { messageId: res.data.Id },
});
```

### 3.2 Adicionar logEvent em `whatsapp.validate`

**Arquivo:** `server/api/routers/whatsapp.ts`

```typescript
// Após validar número
void logEvent({
  name: EventTypes.API_VALIDATION,
  organizationId: instance.organizationId,
  instanceId: instance.id,
  metadata: {
    phone: input.phone,
    isValid: result.OnWhatsapp,
  },
});
```

---

## Fase 4: Migration - Remover Campos Obsoletos

### 4.1 Remover campos do schema

**Arquivo:** `server/db/schema.ts`

```typescript
// REMOVER da tabela instances:
// messagesUsedToday: integer("messages_used_today").notNull().default(0),
// lastMessageResetAt: timestamp("last_message_reset_at", { withTimezone: true }).defaultNow(),

// MANTER:
// lastMessageAt: timestamp (útil para analytics)
```

### 4.2 Migration SQL

```sql
-- Migration: remove_message_counter_fields
ALTER TABLE instances DROP COLUMN IF EXISTS messages_used_today;
ALTER TABLE instances DROP COLUMN IF EXISTS last_message_reset_at;
```

### 4.3 Atualizar código que usa esses campos

Arquivos a atualizar:
- `server/lib/instance.ts` - Remover funções obsoletas
- `server/api/routers/whatsapp.ts` - Remover referências diretas
- `tests/unit/server/lib/instance.test.ts` - Atualizar mocks

---

## Fase 5: Contador Global na Landing ✅

### 5.1 Endpoint de stats ✅ JÁ IMPLEMENTADO

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

### 5.2 Hook useAnimatedCounter (Custom - Zero Dependências)

**Arquivo:** `hooks/use-animated-counter.ts`

```typescript
"use client";

import { useState, useEffect, useRef } from "react";

// Easing function for smooth animation
function easeOutQuart(x: number): number {
  return 1 - Math.pow(1 - x, 4);
}

/**
 * Hook para animar um contador de forma suave
 * @param target - Valor alvo para o contador
 * @param duration - Duração da animação em ms (default: 1000)
 * @returns Valor atual animado
 */
export function useAnimatedCounter(target: number, duration = 1000): number {
  const [value, setValue] = useState(0);
  const previousTarget = useRef(0);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const start = previousTarget.current;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutQuart(progress);

      const current = Math.floor(start + (target - start) * easedProgress);
      setValue(current);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        previousTarget.current = target;
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [target, duration]);

  return value;
}
```

**Vantagens da abordagem custom:**
- Zero dependências externas
- SSR-friendly (renderiza 0, anima no client)
- Controle total do easing
- Performático com requestAnimationFrame
- Sem problemas de CSS/temas do Odometer

### 5.3 Componente LiveCounter

**Arquivo:** `components/marketing/live-counter.tsx`

```typescript
"use client";

import { useEffect, useState } from "react";
import { useAnimatedCounter } from "~/hooks/use-animated-counter";

interface CounterData {
  baseValue: number;
  ratePerSecond: number;
  calculatedAt: number;
}

export function LiveCounter() {
  const [data, setData] = useState<CounterData | null>(null);
  const [interpolatedTarget, setInterpolatedTarget] = useState(0);

  // Valor animado com easing suave
  const displayValue = useAnimatedCounter(interpolatedTarget, 500);

  // Buscar dados do backend a cada 5 min
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/stats/counter");
        const json = await res.json();
        setData(json);
      } catch (error) {
        console.error("Failed to fetch counter data:", error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Interpolar valor a cada segundo baseado no rate
  useEffect(() => {
    if (!data) return;

    const tick = () => {
      const elapsed = (Date.now() - data.calculatedAt) / 1000;
      const interpolated = Math.floor(data.baseValue + elapsed * data.ratePerSecond);
      setInterpolatedTarget(interpolated);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [data]);

  // Formatar número com separadores de milhar
  const formattedValue = displayValue.toLocaleString("pt-BR");

  return (
    <div className="text-center">
      <div className="text-5xl md:text-6xl font-bold text-primary tabular-nums">
        {formattedValue}
      </div>
      <p className="text-muted-foreground mt-2">
        Mensagens transacionadas
      </p>
    </div>
  );
}
```

### 5.4 Integrar na seção Metrics existente

**Arquivo:** `components/marketing/metrics.tsx` - Adicionar como primeiro item

O LiveCounter substitui o primeiro metric estático ou é adicionado como destaque.

---

## Tarefas por Fase

### Fase 1: Setup Redis (Upstash)
- [ ] 1.1 Instalar `@upstash/redis`
- [ ] 1.2 Configurar env.js com variáveis Upstash
- [ ] 1.3 Criar `server/lib/redis.ts`
- [ ] 1.4 Criar `server/lib/quota.ts` (checkQuota, incrementQuota, getQuotaUsage)
- [ ] 1.5 Testes unitários para quota

### Fase 2: Refatorar Limite de Mensagens
- [ ] 2.1 Refatorar `canSendMessage` para usar Redis
- [ ] 2.2 Atualizar `whatsapp.send` para nova arquitetura
- [ ] 2.3 Remover `incrementMessageCount` do webhook
- [ ] 2.4 Atualizar UI para buscar quota do Redis
- [ ] 2.5 Testes de integração

### Fase 3: Adicionar Event Logging
- [ ] 3.1 Adicionar `logEvent(MESSAGE_SENT)` em `whatsapp.send`
- [ ] 3.2 Adicionar `logEvent(API_VALIDATION)` em `whatsapp.validate`

### Fase 4: Migration - Remover Campos Obsoletos
- [ ] 4.1 Remover `messagesUsedToday` do schema
- [ ] 4.2 Remover `lastMessageResetAt` do schema
- [ ] 4.3 Gerar e aplicar migration
- [ ] 4.4 Atualizar código dependente

### Fase 5: Contador Global na Landing
- [x] 5.1 Criar endpoint `/api/stats/counter` ✅ JÁ EXISTE
- [x] 5.2 Criar hook `useAnimatedCounter` (custom, zero deps)
- [x] 5.3 Criar componente `LiveCounter`
- [x] 5.4 Integrar na seção Metrics

---

## Critérios de Sucesso

### Fase 1 (Redis)
- [ ] Redis conecta e responde em < 5ms
- [ ] checkQuota retorna corretamente
- [ ] TTL expira à meia-noite de São Paulo

### Fase 2 (Refatoração)
- [ ] Limite de 50 msgs/dia funciona via Redis
- [ ] Mensagens RECEBIDAS NÃO contam para o limite
- [ ] Dashboard mostra uso correto

### Fase 3 (Event Logging)
- [ ] `message.sent` aparece na tabela events
- [ ] `api.validation` aparece na tabela events

### Fase 4 (Migration)
- [ ] Campos removidos do banco sem erros
- [ ] Aplicação funciona sem os campos

### Fase 5 (Contador)
- [ ] Contador aparece na landing
- [ ] Atualiza suavemente (odômetro)
- [ ] Conta sent + received corretamente

---

## Changelog

| Data | Mudança |
|------|---------|
| 2025-12-10 | Criação do plano |
| 2025-12-10 | Schema `events` implementado |
| 2025-12-10 | Webhook receiver `/api/webhooks/wuzapi` implementado |
| 2025-12-10 | Fly.io: RabbitMQ removido, webhook configurado |
| 2025-12-10 | Plan 07 completo: API consolidada em api.livchat.ai |
| 2025-12-10 | **REFATORAÇÃO**: Plano atualizado para usar Redis + Events |
| 2025-12-10 | BUG identificado: limite contava sent + received, deveria ser só sent |
| 2025-12-10 | Nova arquitetura: Redis para quota em tempo real, Events para audit |
