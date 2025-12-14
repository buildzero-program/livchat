# Fase 5 - LivChat Service Layer

## Status: COMPLETA

## Objetivo

Implementar AST Client e Thread Service para integração com o AST.

---

## Exploração Realizada

### 1. Padrão de HTTP Client

**Referência:** `src/server/lib/wuzapi.ts`

- Classe com `config` no construtor
- Método privado `request<T>()` com fetch + error handling
- Factory function para criar instâncias
- Interfaces para request/response

### 2. Padrão de Service

**Referência:** `src/server/lib/api-key.ts`

- Imports: `db`, tabelas, `drizzle-orm`, `logger`
- Types/interfaces exportadas
- Pure functions (sem DB)
- DB functions com tratamento de erro
- Logging com `LogActions`

### 3. Env Vars

**Adicionar em `env.js`:**
```typescript
AST_URL: z.string().url().default("http://localhost:9000"),
AST_API_KEY: z.string().min(1).optional(),
```

---

## Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `src/env.js` | Adicionar AST_URL, AST_API_KEY |
| `src/server/lib/ast.ts` | AST HTTP Client |
| `src/server/lib/thread.ts` | Thread Service (DB operations) |

---

## Passos

1. [ ] Adicionar env vars
2. [ ] Criar AST Client
3. [ ] Criar Thread Service
4. [ ] Verificar TypeScript
