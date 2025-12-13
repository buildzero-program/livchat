# Plan 09 - Sistema de Votos do Roadmap Público

> **Baseado em:** `docs/system-design.md`, Plan 06 (Event Log), Plan 08 (Webhooks)
> **Referência:** Canny.io, ProductBoard

## Status: 🚧 Em Progresso

**Dependências:**
- ✅ Plan 06: Event Log (tabela `events` funcionando)
- ✅ Frontend: Roadmap page com cards e drag (localStorage apenas)

**Progresso:**
- [ ] Fase 1: tRPC Router (backend)
- [ ] Fase 2: Integração Frontend
- [ ] Fase 3: Rate Limiting (Redis)
- [ ] Fase 4: Testes

---

## Objetivo

Implementar sistema de votos persistente para o roadmap público, permitindo que usuários (anônimos ou autenticados) votem em features desejadas.

**Fluxo atual:**
```
[Usuário vota] → localStorage → FIM (dados perdidos ao limpar browser)
```

**Fluxo após Plan 09:**
```
[Usuário vota] → tRPC mutation → events table → Agregação → Contador real
                      ↓
                Redis (rate limit + cache)
```

**Funcionalidades:**
- Votar em itens do roadmap (upvote)
- Remover voto (toggle)
- Contagem agregada de votos
- Deduplicação: 1 voto por device/user por item
- Rate limiting via Redis (com fallback)
- Sync entre localStorage e backend

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FLUXO DE VOTOS                                  │
└─────────────────────────────────────────────────────────────────────────────┘

  [roadmap-card.tsx]
       │
       ├──► localStorage (optimistic UI imediato)
       │
       └──► tRPC: roadmap.vote({ itemId })
                 │
                 ▼
            ┌─────────────────────────────────────────┐
            │  hybridProcedure (anônimo + auth)       │
            │  ctx.device.id (sempre disponível)      │
            │  ctx.user?.id (se autenticado)          │
            └─────────────────────────────────────────┘
                 │
                 ▼
            ┌─────────────────────────────────────────┐
            │  1. Rate Limit Check (Redis)            │
            │     key: vote:{deviceId}:{itemId}       │
            │     fallback: query events table        │
            └─────────────────────────────────────────┘
                 │
                 ▼
            ┌─────────────────────────────────────────┐
            │  2. Log Event                           │
            │     name: "roadmap.vote"                │
            │     deviceId: ctx.device.id             │
            │     userId: ctx.user?.id                │
            │     metadata: { itemId, action }        │
            └─────────────────────────────────────────┘
                 │
                 ▼
            ┌─────────────────────────────────────────┐
            │  3. Invalidate Cache (Redis)            │
            │     key: votes:count:{itemId}           │
            └─────────────────────────────────────────┘
                 │
                 ▼
            Return { success, voteCount }


┌─────────────────────────────────────────────────────────────────────────────┐
│                           QUERY DE LISTAGEM                                  │
└─────────────────────────────────────────────────────────────────────────────┘

  [roadmap.list query]
       │
       ▼
  ┌─────────────────────────────────────────┐
  │  1. Buscar items hardcoded              │
  │     import { ROADMAP_ITEMS }            │
  └─────────────────────────────────────────┘
       │
       ▼
  ┌─────────────────────────────────────────┐
  │  2. Agregar votos por item              │
  │     SELECT metadata->>'itemId', COUNT(*)│
  │     FROM events                         │
  │     WHERE name = 'roadmap.vote'         │
  │     AND metadata->>'action' = 'upvote'  │
  │     GROUP BY metadata->>'itemId'        │
  └─────────────────────────────────────────┘
       │
       ▼
  ┌─────────────────────────────────────────┐
  │  3. Verificar votos do usuário          │
  │     SELECT metadata->>'itemId'          │
  │     FROM events                         │
  │     WHERE deviceId = ctx.device.id      │
  │     AND name = 'roadmap.vote'           │
  │     AND metadata->>'action' = 'upvote'  │
  └─────────────────────────────────────────┘
       │
       ▼
  Return items com { votes, hasVoted }
```

---

## Decisões Técnicas

### 1. Reutilizar tabela `events` (sem migração)

**Event type:** `roadmap.vote`

```typescript
// Estrutura do evento
{
  id: uuid,
  name: "roadmap.vote",
  deviceId: uuid,           // sempre presente (tracking)
  organizationId: null,     // roadmap é público
  instanceId: null,
  apiKeyId: null,
  value: 1,                 // sempre 1 (contagem)
  metadata: {
    itemId: string,         // "graphql-api"
    action: "upvote" | "remove",
    userAgent?: string,
    source: "web"
  },
  createdAt: timestamp
}
```

**Vantagens:**
- Zero migração de schema
- Audit trail completo
- Integra com analytics existente
- Pattern já estabelecido no projeto

### 2. Roadmap Items: Hardcoded

```typescript
// src/lib/roadmap-data.ts (manter atual)
export const ROADMAP_ITEMS: RoadmapItem[] = [...]

// Votos vêm do banco, items são estáticos
// Futuro: migrar para tabela se precisar admin dashboard
```

### 3. Rate Limiting

```typescript
// Redis key pattern
const key = `vote:${deviceId}:${itemId}`;

// Check: se existe, já votou
// Set: TTL de 365 dias (ou sem TTL)

// Fallback sem Redis:
const existingVote = await db.query.events.findFirst({
  where: and(
    eq(events.name, "roadmap.vote"),
    eq(events.deviceId, deviceId),
    sql`metadata->>'itemId' = ${itemId}`,
    sql`metadata->>'action' = 'upvote'`
  )
});
```

### 4. Cache de Contagem (Opcional)

```typescript
// Redis key: votes:count:{itemId}
// Value: número de votos
// TTL: 5 minutos (ou invalidar no vote)

// Se Redis indisponível: query direto no banco
```

---

## Estrutura de Arquivos

```
src/server/api/routers/
└── roadmap.ts              # NOVO - router de votos

src/lib/
└── roadmap-data.ts         # EXISTENTE - items hardcoded (sem mudança)

src/components/roadmap/
└── roadmap-card.tsx        # MODIFICAR - integrar tRPC

src/server/lib/
└── events.ts               # EXISTENTE - adicionar ROADMAP_VOTE type
```

---

## Fase 1: tRPC Router (Backend)

### 1.1 Adicionar event type

```typescript
// src/server/lib/events.ts
export const EventTypes = {
  // ... existentes
  ROADMAP_VOTE: "roadmap.vote",
} as const;
```

### 1.2 Criar router

```typescript
// src/server/api/routers/roadmap.ts
import { z } from "zod";
import { createTRPCRouter, hybridProcedure } from "../trpc";
import { db } from "~/server/db";
import { events } from "~/server/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { ROADMAP_ITEMS } from "~/lib/roadmap-data";
import { logEvent, EventTypes } from "~/server/lib/events";
import { redis } from "~/server/lib/redis";

export const roadmapRouter = createTRPCRouter({
  // Lista items com votos agregados
  list: hybridProcedure.query(async ({ ctx }) => {
    // 1. Agregar votos por item
    const voteCounts = await db
      .select({
        itemId: sql<string>`metadata->>'itemId'`,
        count: sql<number>`count(*)::int`,
      })
      .from(events)
      .where(
        and(
          eq(events.name, EventTypes.ROADMAP_VOTE),
          sql`metadata->>'action' = 'upvote'`
        )
      )
      .groupBy(sql`metadata->>'itemId'`);

    // 2. Buscar votos do usuário atual
    const userVotes = await db
      .select({
        itemId: sql<string>`metadata->>'itemId'`,
      })
      .from(events)
      .where(
        and(
          eq(events.name, EventTypes.ROADMAP_VOTE),
          eq(events.deviceId, ctx.device.id),
          sql`metadata->>'action' = 'upvote'`
        )
      );

    const userVotedItems = new Set(userVotes.map((v) => v.itemId));
    const voteCountMap = new Map(voteCounts.map((v) => [v.itemId, v.count]));

    // 3. Merge com items hardcoded
    return ROADMAP_ITEMS.map((item) => ({
      ...item,
      votes: voteCountMap.get(item.id) ?? 0,
      hasVoted: userVotedItems.has(item.id),
    }));
  }),

  // Votar em um item
  vote: hybridProcedure
    .input(z.object({ itemId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { itemId } = input;
      const deviceId = ctx.device.id;

      // Validar item existe
      const item = ROADMAP_ITEMS.find((i) => i.id === itemId);
      if (!item) {
        throw new Error("Item não encontrado");
      }

      // Check se já votou (Redis primeiro, fallback DB)
      const voteKey = `vote:${deviceId}:${itemId}`;

      let hasVoted = false;
      if (redis) {
        hasVoted = (await redis.exists(voteKey)) === 1;
      }

      if (!hasVoted) {
        // Fallback: check no banco
        const existing = await db.query.events.findFirst({
          where: and(
            eq(events.name, EventTypes.ROADMAP_VOTE),
            eq(events.deviceId, deviceId),
            sql`metadata->>'itemId' = ${itemId}`,
            sql`metadata->>'action' = 'upvote'`
          ),
        });
        hasVoted = !!existing;
      }

      if (hasVoted) {
        throw new Error("Você já votou neste item");
      }

      // Registrar voto
      await logEvent({
        name: EventTypes.ROADMAP_VOTE,
        deviceId,
        userId: ctx.user?.id,
        metadata: {
          itemId,
          action: "upvote",
          source: "web",
        },
      });

      // Marcar no Redis (sem TTL = permanente)
      if (redis) {
        await redis.set(voteKey, "1");
      }

      // Retornar nova contagem
      const [result] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(events)
        .where(
          and(
            eq(events.name, EventTypes.ROADMAP_VOTE),
            sql`metadata->>'itemId' = ${itemId}`,
            sql`metadata->>'action' = 'upvote'`
          )
        );

      return { success: true, votes: result?.count ?? 1 };
    }),

  // Remover voto
  unvote: hybridProcedure
    .input(z.object({ itemId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { itemId } = input;
      const deviceId = ctx.device.id;

      // Registrar remoção (não deleta, adiciona evento de remove)
      await logEvent({
        name: EventTypes.ROADMAP_VOTE,
        deviceId,
        userId: ctx.user?.id,
        metadata: {
          itemId,
          action: "remove",
          source: "web",
        },
      });

      // Remover do Redis
      if (redis) {
        await redis.del(`vote:${deviceId}:${itemId}`);
      }

      // Retornar nova contagem
      const [result] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(events)
        .where(
          and(
            eq(events.name, EventTypes.ROADMAP_VOTE),
            sql`metadata->>'itemId' = ${itemId}`,
            sql`metadata->>'action' = 'upvote'`
          )
        );

      return { success: true, votes: result?.count ?? 0 };
    }),
});
```

### 1.3 Registrar router

```typescript
// src/server/api/root.ts
import { roadmapRouter } from "./routers/roadmap";

export const appRouter = createTRPCRouter({
  // ... existentes
  roadmap: roadmapRouter,
});
```

---

## Fase 2: Integração Frontend

### 2.1 Atualizar roadmap-card.tsx

```typescript
// Usar tRPC ao invés de localStorage
const utils = api.useUtils();

const voteMutation = api.roadmap.vote.useMutation({
  onSuccess: () => {
    utils.roadmap.list.invalidate();
  },
});

const unvoteMutation = api.roadmap.unvote.useMutation({
  onSuccess: () => {
    utils.roadmap.list.invalidate();
  },
});

const handleVote = () => {
  if (hasVoted) {
    unvoteMutation.mutate({ itemId: item.id });
  } else {
    voteMutation.mutate({ itemId: item.id });
  }
};
```

### 2.2 Atualizar roadmap page

```typescript
// src/app/roadmap/page.tsx
const { data: items, isLoading } = api.roadmap.list.useQuery();

// Usar items do query ao invés de getItemsByStatus()
```

---

## Fase 3: Rate Limiting (Redis)

### 3.1 Estrutura de keys

```
vote:{deviceId}:{itemId}     → "1" (existe = já votou)
votes:count:{itemId}         → número (cache de contagem, opcional)
```

### 3.2 Graceful degradation

```typescript
// Se Redis indisponível:
// 1. Check no banco (mais lento mas funciona)
// 2. Log warning
// 3. Continua operação normal
```

---

## Fase 4: Testes

### 4.1 Testes unitários

```typescript
// __tests__/roadmap.test.ts
describe("roadmap router", () => {
  describe("list", () => {
    it("returns all items with vote counts");
    it("returns hasVoted=true for user's votes");
    it("returns hasVoted=false for items not voted");
  });

  describe("vote", () => {
    it("creates vote event");
    it("prevents duplicate votes");
    it("returns updated count");
  });

  describe("unvote", () => {
    it("creates remove event");
    it("returns updated count");
  });
});
```

### 4.2 Testes de integração

```typescript
// E2E: votar, verificar contagem, remover voto
```

---

## Checklist de Implementação

### Fase 1: Backend
- [ ] Adicionar `ROADMAP_VOTE` em events.ts
- [ ] Criar `src/server/api/routers/roadmap.ts`
- [ ] Registrar router em `root.ts`
- [ ] Testar mutations no playground

### Fase 2: Frontend
- [ ] Atualizar roadmap-card.tsx com tRPC
- [ ] Atualizar page.tsx para usar query
- [ ] Manter localStorage como fallback/optimistic
- [ ] Testar UI

### Fase 3: Rate Limiting
- [ ] Implementar check Redis
- [ ] Implementar fallback DB
- [ ] Testar com Redis down

### Fase 4: Testes
- [ ] Escrever testes unitários
- [ ] Testar edge cases
- [ ] Testar com usuário anônimo e autenticado

---

## Considerações Futuras

1. **Admin Dashboard:** Migrar items para tabela se precisar CRUD
2. **Analytics:** Dashboard de votos por período
3. **Notificações:** Email quando feature votada for lançada
4. **Comentários:** Sistema de discussão por item

---

## Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Spam de votos | Rate limit por device + IP |
| Redis down | Fallback para query no banco |
| Muitos votos = query lenta | Cache de contagem no Redis |
| Usuário limpa cookies | Voto fica órfão (aceitável) |
