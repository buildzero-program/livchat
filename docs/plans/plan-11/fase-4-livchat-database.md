# Fase 4 - LivChat Database Schema

## Status: COMPLETA

## Objetivo

Criar tabelas `workflows` e `threads` no LivChat para integração com AST.

---

## Exploração Realizada

### 1. Padrões do Schema Existente

**Arquivo:** `src/server/db/schema.ts`

- UUIDs como primary key com `.defaultRandom()`
- Timestamps com `{ withTimezone: true }`
- Índices no callback `(t) => [...]`
- Relations definidas após tabelas
- Nomes: snake_case no banco, camelCase no TypeScript

### 2. Tabelas Existentes

| Tabela | Relacionamentos |
|--------|-----------------|
| users | - |
| organizations | → users (owner) |
| devices | - |
| instances | → organizations, devices |
| api_keys | → organizations, devices, instances |
| webhooks | → organizations |
| events | → organizations, instances, api_keys, devices |

### 3. Migrations

- Diretório: `/drizzle/`
- Formato: `0000_name.sql`, `0001_name.sql`, etc.
- Comandos: `bun run db:generate`, `bun run db:push`

---

## Estrutura das Tabelas

### workflows

| Campo | Tipo | Nullable | Default | Descrição |
|-------|------|----------|---------|-----------|
| id | uuid | N | random | PK |
| organizationId | uuid | S | - | FK → organizations (NULL = sistema) |
| providerId | text | N | - | AST workflow ID (wf_xxx) |
| name | text | N | - | Cache do nome |
| description | text | S | - | Cache da descrição |
| isActive | boolean | N | true | Status |
| createdAt | timestamp | N | now() | - |
| updatedAt | timestamp | N | now() | - |

**Índices:**
- `idx_workflows_org` (organizationId)
- `idx_workflows_provider` (providerId)

### threads

| Campo | Tipo | Nullable | Default | Descrição |
|-------|------|----------|---------|-----------|
| id | uuid | N | random | PK |
| workflowId | uuid | N | - | FK → workflows |
| organizationId | uuid | S | - | FK → organizations |
| userId | uuid | S | - | FK → users |
| deviceId | uuid | S | - | FK → devices |
| providerThreadId | text | N | - | UUID para o AST |
| title | text | S | - | Título da conversa |
| messageCount | integer | N | 0 | Contador |
| status | text | N | "active" | active, archived |
| lastMessageAt | timestamp | S | - | Última mensagem |
| createdAt | timestamp | N | now() | - |
| updatedAt | timestamp | N | now() | - |

**Índices:**
- `idx_threads_workflow` (workflowId)
- `idx_threads_user` (userId)
- `idx_threads_device` (deviceId)
- `idx_threads_status` (status)
- `idx_threads_provider` (providerThreadId)

---

## Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `src/server/db/schema.ts` | Adicionar tabelas e relations |
| `drizzle/0004_add_workflows_threads.sql` | Migration SQL |

---

## Passos

1. [ ] Adicionar tabelas em schema.ts
2. [ ] Adicionar relations em schema.ts
3. [ ] Criar migration SQL manualmente
4. [ ] Testar com db:push
