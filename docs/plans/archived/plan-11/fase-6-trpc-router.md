# Fase 6 - tRPC Router (Ivy)

## Status: COMPLETA

## Objetivo

Implementar tRPC router para conversas com a Ivy.

---

## Exploração Realizada

### 1. Padrão de tRPC

**Procedures disponíveis:**
- `publicProcedure` - Sem auth
- `protectedProcedure` - Requer Clerk
- `hybridProcedure` - User OU Device

**Context:**
- `ctx.db` - Drizzle ORM
- `ctx.device` - DeviceInfo
- `ctx.user` - SyncedUser (se auth)
- `ctx.log` - Logger com contexto

### 2. Endpoints do Ivy Router

| Procedure | Tipo | Auth | Descrição |
|-----------|------|------|-----------|
| getThread | query | hybrid | Busca thread ativo |
| listThreads | query | hybrid | Lista threads do usuário/device |
| newConversation | mutation | hybrid | Cria novo thread |
| send | mutation | hybrid | Envia mensagem (sync) |
| archiveThread | mutation | hybrid | Arquiva thread |

### 3. Streaming

Para streaming, opções:
1. `observable` pattern tRPC (experimental)
2. API route Next.js separada com SSE

**Decisão:** Usar API route para streaming (mais robusto)

---

## Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `src/server/api/routers/ivy.ts` | tRPC router |
| `src/server/api/root.ts` | Registrar router |
| `src/app/api/ivy/stream/route.ts` | API route para SSE |

---

## Passos

1. [ ] Criar ivy.ts com procedures básicas
2. [ ] Registrar no root.ts
3. [ ] Criar API route para streaming
4. [ ] Verificar TypeScript
