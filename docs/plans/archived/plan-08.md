# Plan 08 - Webhooks do Usuário: Configuração e Event Logs

> **Baseado em:** `docs/system-design.md`, Plan 06 (Event Log), Plan 07 (API Consolidation)
> **Referência:** Chatwoot webhook system, WuzAPI API.md

## Status: ✅ Concluído

**Dependências:**
- ✅ Plan 06: Event Log + Webhooks WuzAPI (receiver funcionando)
- ✅ Plan 07: API Consolidation (api.livchat.ai com HMAC)

**Progresso:**
- [x] Fase 1: Frontend mockado (validação UX)
- [x] Fase 2: Backend (schema + routers + forwarder)
- [x] Fase 3: Integração front + back
- [x] Fase 4: Testes e documentação

---

## Objetivo

Permitir que usuários configurem seus próprios webhooks para receber eventos do WhatsApp em tempo real.

**Fluxo atual:**
```
WuzAPI → api.livchat.ai/webhooks/wuzapi → logEvent() → FIM
```

**Fluxo após Plan 08:**
```
WuzAPI → api.livchat.ai/webhooks/wuzapi → logEvent() → forwardToUserWebhooks() → User endpoints
```

**Funcionalidades:**
- Cadastrar múltiplos webhooks por organização
- Filtrar por instâncias e tipos de eventos
- Signing secret (HMAC-SHA256) opcional
- HTTP headers customizados
- Event logs com histórico de entregas
- Resend de eventos falhos
- Teste de webhook

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FLUXO DE EVENTOS                                │
└─────────────────────────────────────────────────────────────────────────────┘

  WuzAPI (Fly.io)
       │
       ▼
  api.livchat.ai/webhooks/wuzapi (Cloudflare Worker)
       │
       ▼
  /api/webhooks/wuzapi (Vercel)
       │
       ├──► logEvent("message.received", ...) ──► events table
       │
       └──► forwardToUserWebhooks(orgId, eventType, payload)
                 │
                 ▼
            ┌─────────────────────────────────────────┐
            │  SELECT * FROM webhooks                 │
            │  WHERE organizationId = ?               │
            │    AND isActive = true                  │
            │    AND (instanceIds IS NULL             │
            │         OR ? = ANY(instanceIds))        │
            │    AND (subscriptions IS NULL           │
            │         OR ? = ANY(subscriptions))      │
            └─────────────────────────────────────────┘
                 │
                 ▼ (para cada webhook)
            ┌─────────────────────────────────────────┐
            │  1. Montar payload JSON                 │
            │  2. Gerar x-livchat-signature (HMAC)    │
            │  3. Adicionar headers customizados      │
            │  4. POST com timeout 5s                 │
            │  5. logEvent("webhook.delivered/failed")│
            └─────────────────────────────────────────┘
                 │
                 ▼
            User endpoints (n8n, Make, custom backend)
```

---

## Decisões Técnicas

### 1. Schema

```sql
-- Nova tabela: webhooks
CREATE TABLE webhooks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Identificação
  name            TEXT NOT NULL DEFAULT 'Webhook',  -- editável inline
  url             TEXT NOT NULL,                     -- validar URL https

  -- Segurança (opcionais)
  signing_secret  TEXT,                              -- min 32 chars se fornecido
  headers         JSONB,                             -- {"X-Custom": "value"}

  -- Filtros (NULL = todos, '*')
  instance_ids    UUID[],                            -- NULL = todas instâncias
  subscriptions   TEXT[],                            -- NULL = todos eventos

  -- Status
  is_active       BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_webhooks_org_active ON webhooks(organization_id, is_active);
```

### 2. Reutilizar tabela `events` para delivery logs

**Novos event types:**
```typescript
WEBHOOK_DELIVERED: "webhook.delivered"
WEBHOOK_FAILED: "webhook.failed"
WEBHOOK_RETRIED: "webhook.retried"
```

**Metadata para webhook events:**
```typescript
{
  webhookId: string,           // FK para webhooks
  sourceEventId: string,       // evento original que disparou
  sourceEventType: string,     // "message.received", etc
  statusCode: number,          // HTTP response code
  latencyMs: number,           // tempo de resposta
  attempt: number,             // tentativa (1, 2, 3...)
  error: string | null,        // mensagem de erro se falhou
  requestPayload: object,      // payload enviado (para resend)
  responseBody: string | null  // resposta truncada (max 1KB)
}
```

### 3. Payload enviado ao usuário

```json
{
  "event": "message.received",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "webhookId": "uuid",
  "instance": {
    "id": "uuid",
    "phone": "5511999999999",
    "name": "Minha Instância"
  },
  "data": {
    "messageId": "ABC123DEF456",
    "from": "5511888888888",
    "to": "5511999999999",
    "chat": "5511888888888@s.whatsapp.net",
    "type": "text",
    "body": "Olá, tudo bem?",
    "isGroup": false,
    "isFromMe": false,
    "timestamp": 1705312200
  }
}
```

**Header de assinatura (se signing_secret configurado):**
```
x-livchat-signature: sha256=<hmac_hex>
x-livchat-timestamp: 1705312200
```

### 4. UI - Lista de Webhooks (estilo clean/lista)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Webhooks                                                    [+ Adicionar]   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ━━● Webhook                                            [📋] [⋮]     │   │
│  │     ↑ click to edit                                                  │   │
│  │                                                                      │   │
│  │ https://api.meuapp.com/webhook                                       │   │
│  │                                                                      │   │
│  │ [+ Instâncias: Todas]  [+ Eventos: Todos]                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ○── n8n Integration                                    [📋] [⋮]     │   │
│  │                                                                      │   │
│  │ https://n8n.meusite.com/webhook/abc123                               │   │
│  │                                                                      │   │
│  │ [+ Instâncias: 2 selecionadas]  [+ Eventos: message.received]       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ─── ou se vazio ───                                                        │
│                                                                             │
│       🔗 Nenhum webhook configurado                                         │
│       Configure webhooks para receber eventos em tempo real                 │
│                                                                             │
│       [+ Adicionar Webhook]                                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Legenda:**
- `━━●` = Switch ativo (verde)
- `○──` = Switch inativo (cinza)
- `[📋]` = Botão Event Logs
- `[⋮]` = Menu dropdown (Editar, Deletar)
- `[+ Instâncias]` = Dropdown multi-select
- `[+ Eventos]` = Dropdown multi-select

### 5. UI - Event Logs Sheet

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Event Logs                                                              [X] │
│ Webhook                                                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ [Todos]  [Sucesso]  [Falha]                            Últimas 24h ▼       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ 🟢 message.received                    há 2 min           [↻]  [▼]   │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ 🟢 message.sent                        há 5 min           [↻]  [▼]   │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ 🔴 message.received                    há 8 min           [↻]  [▼]   │ │
│  │                                                                       │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │ │
│  │  │ Status: 500  │  Latência: 2340ms  │  Tentativa: 3/3            │ │ │
│  │  ├─────────────────────────────────────────────────────────────────┤ │ │
│  │  │ Payload                                                         │ │ │
│  │  │ ┌─────────────────────────────────────────────────────────────┐ │ │ │
│  │  │ │ {                                                           │ │ │ │
│  │  │ │   "event": "message.received",                              │ │ │ │
│  │  │ │   "data": { "from": "5511888888888", ... }                  │ │ │ │
│  │  │ │ }                                                           │ │ │ │
│  │  │ └─────────────────────────────────────────────────────────────┘ │ │ │
│  │  │                                                                 │ │ │
│  │  │ Erro: Connection timeout after 5000ms                          │ │ │
│  │  └─────────────────────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ─── ou se vazio ───                                                        │
│                                                                             │
│       📭 Nenhum evento registrado                                           │
│       Aguardando primeiro evento ou envie um teste                          │
│                                                                             │
│       [🚀 Enviar evento de teste]                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Legenda:**
- `🟢` = Sucesso (status 2xx)
- `🔴` = Falha (status 4xx/5xx ou timeout)
- `🟡` = Pending (ainda não tentou)
- `[↻]` = Resend (reenvia mesmo payload)
- `[▼]` = Expandir/recolher detalhes

### 6. UI - Dialog Adicionar/Editar

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Adicionar Webhook                                                       [X] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ URL *                                                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ https://                                                                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│ A URL deve usar HTTPS                                                       │
│                                                                             │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ [+] Signing Secret                                                      │ │
│ │                                                                         │ │
│ │     ┌─────────────────────────────────────────────────────────────────┐ │ │
│ │     │ ········································                        │ │ │
│ │     └─────────────────────────────────────────────────────────────────┘ │ │
│ │     Mínimo 32 caracteres. Usado para validar autenticidade.            │ │
│ │                                                           [Gerar]      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ [+] HTTP Headers                                                        │ │
│ │                                                                         │ │
│ │     ┌────────────────────┐  ┌────────────────────────────────┐  [🗑️]   │ │
│ │     │ X-Custom-Header    │  │ valor                          │         │ │
│ │     └────────────────────┘  └────────────────────────────────┘         │ │
│ │                                                                         │ │
│ │     [+ Adicionar header]                                                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                [Cancelar]  [Salvar]         │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Nota:** Instâncias e Eventos são configurados diretamente no card (não no dialog).

---

## Fase 1: Frontend Mockado

### Objetivo
Validar UX antes de implementar backend. Todos os dados são mock/estáticos.

### 1.1 Criar página de webhooks

**Arquivo:** `src/app/(app)/webhooks/page.tsx`

```typescript
// Estrutura básica
export default function WebhooksPage() {
  return (
    <div className="container py-6">
      <WebhooksHeader />
      <WebhooksList />
    </div>
  );
}
```

### 1.2 Criar componente WebhooksList

**Arquivo:** `src/components/dashboard/webhooks-list.tsx`

- Lista de webhooks em formato de cards/rows
- Dados mockados estáticos
- Switch de ativo/inativo (visual only)
- Botões de Event Logs e Menu

### 1.3 Criar componente WebhookCard

**Arquivo:** `src/components/dashboard/webhook-card.tsx`

- Nome editável inline (igual instâncias)
- URL readonly no card
- Switch toggle
- Dropdowns de Instâncias e Eventos
- Botão Event Logs
- Menu com Editar/Deletar

### 1.4 Criar componente WebhookLogsSheet

**Arquivo:** `src/components/dashboard/webhook-logs-sheet.tsx`

- Sheet lateral (usar Sheet do shadcn)
- Lista de eventos com ScrollArea
- Tabs para filtrar (Todos/Sucesso/Falha)
- Item expandível com detalhes
- Botão Resend
- Empty state com botão "Enviar teste"

### 1.5 Criar componente WebhookFormDialog

**Arquivo:** `src/components/dashboard/webhook-form-dialog.tsx`

- Dialog para criar/editar
- Campo URL com validação visual
- Seção expansível Signing Secret
- Seção expansível HTTP Headers
- Botão Gerar secret aleatório

### 1.6 Adicionar rota no sidebar

**Arquivo:** `src/components/layout/app-sidebar.tsx`

```typescript
const platformItems = [
  { title: "Dashboard", href: "/app", icon: LayoutDashboard },
  { title: "Instâncias", href: "/app/instances", icon: Smartphone },
  { title: "Webhooks", href: "/app/webhooks", icon: Webhook },  // NOVO
  // ...
];
```

### Tarefas Fase 1

- [x] 1.1 Criar `src/app/(app)/webhooks/page.tsx`
- [x] 1.2 Criar `src/components/dashboard/webhooks-list.tsx` com dados mock
- [x] 1.3 Criar `src/components/dashboard/webhook-card.tsx` com EditableName
- [x] 1.4 Criar `src/components/dashboard/webhook-logs-dialog.tsx` (Dialog em vez de Sheet)
- [x] 1.5 Criar `src/components/dashboard/webhook-form-dialog.tsx`
- [x] 1.6 Adicionar "Webhooks" no sidebar
- [x] 1.7 Validar UX com usuário

---

## Fase 2: Backend

### 2.1 Criar schema do banco

**Arquivo:** `src/server/db/schema.ts`

```typescript
export const webhooks = pgTable("webhooks", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),

  name: text("name").notNull().default("Webhook"),
  url: text("url").notNull(),

  signingSecret: text("signing_secret"),
  headers: jsonb("headers").$type<Record<string, string>>(),

  instanceIds: uuid("instance_ids").array(),
  subscriptions: text("subscriptions").array(),

  isActive: boolean("is_active").notNull().default(true),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations
export const webhooksRelations = relations(webhooks, ({ one }) => ({
  organization: one(organizations, {
    fields: [webhooks.organizationId],
    references: [organizations.id],
  }),
}));
```

### 2.2 Adicionar event types

**Arquivo:** `src/lib/events.ts`

```typescript
export const EventTypes = {
  // ... existentes ...

  // Webhook delivery
  WEBHOOK_DELIVERED: "webhook.delivered",
  WEBHOOK_FAILED: "webhook.failed",
  WEBHOOK_RETRIED: "webhook.retried",
} as const;
```

### 2.3 Criar webhook forwarder

**Arquivo:** `src/server/lib/webhook-forwarder.ts`

```typescript
export async function forwardToUserWebhooks(
  organizationId: string,
  instanceId: string,
  eventType: string,
  eventData: unknown,
  sourceEventId?: string
): Promise<void>
```

**Responsabilidades:**
- Query webhooks ativos da org
- Filtrar por instanceIds e subscriptions
- Para cada webhook: POST com timeout 5s
- Gerar HMAC se signing_secret
- Adicionar headers customizados
- Log evento de delivery (sucesso ou falha)

### 2.4 Criar tRPC router

**Arquivo:** `src/server/api/routers/webhooks.ts`

```typescript
export const webhooksRouter = createTRPCRouter({
  // CRUD
  list: protectedProcedure.query(...)      // Lista webhooks da org
  create: protectedProcedure.mutation(...) // Criar webhook
  update: protectedProcedure.mutation(...) // Atualizar webhook
  delete: protectedProcedure.mutation(...) // Deletar webhook

  // Actions
  toggle: protectedProcedure.mutation(...) // Toggle ativo/inativo
  test: protectedProcedure.mutation(...)   // Enviar evento de teste
  resend: protectedProcedure.mutation(...) // Reenviar evento específico

  // Logs
  logs: protectedProcedure.query(...)      // Listar event logs do webhook
});
```

### 2.5 Integrar no webhook handler

**Arquivo:** `src/app/api/webhooks/wuzapi/route.ts`

```typescript
// Após logEvent():
void forwardToUserWebhooks(
  instance.organizationId,
  instance.id,
  internalEventType,
  eventData,
  loggedEventId
);
```

### 2.6 Criar migration

```bash
cd app
bun db:generate  # Gerar migration
bun db:push      # Aplicar no banco
```

### Tarefas Fase 2

- [x] 2.1 Adicionar `webhooks` table em `schema.ts`
- [x] 2.2 Adicionar event types em `events.ts`
- [x] 2.3 Criar `src/server/lib/webhook-forwarder.ts`
- [x] 2.4 Criar `src/server/api/routers/webhooks.ts`
- [x] 2.5 Registrar router em `src/server/api/root.ts`
- [x] 2.6 Integrar forwarder no webhook handler
- [x] 2.7 Gerar e aplicar migration (`drizzle/0003_add_webhooks_table.sql`)
- [x] 2.8 Testes unitários do forwarder
- [x] 2.9 Testes do router

---

## Fase 3: Integração Front + Back

### 3.1 Conectar lista ao tRPC

**Arquivo:** `src/components/dashboard/webhooks-list.tsx`

```typescript
const { data: webhooks, isLoading } = api.webhooks.list.useQuery();
```

### 3.2 Conectar form ao tRPC

**Arquivo:** `src/components/dashboard/webhook-form-dialog.tsx`

```typescript
const createMutation = api.webhooks.create.useMutation({
  onSuccess: () => {
    void refetch();
    onClose();
  },
});
```

### 3.3 Conectar toggle ao tRPC

**Arquivo:** `src/components/dashboard/webhook-card.tsx`

```typescript
const toggleMutation = api.webhooks.toggle.useMutation({
  onSuccess: () => void refetch(),
});
```

### 3.4 Conectar logs ao tRPC

**Arquivo:** `src/components/dashboard/webhook-logs-sheet.tsx`

```typescript
const { data: logs } = api.webhooks.logs.useQuery({
  webhookId,
  status: filter,  // "all" | "success" | "failed"
  limit: 50,
});
```

### 3.5 Conectar resend ao tRPC

```typescript
const resendMutation = api.webhooks.resend.useMutation();

<Button onClick={() => resendMutation.mutate({ eventId })}>
  <RotateCw className="h-3.5 w-3.5" />
</Button>
```

### 3.6 Conectar test ao tRPC

```typescript
const testMutation = api.webhooks.test.useMutation();

<Button onClick={() => testMutation.mutate({ webhookId })}>
  Enviar evento de teste
</Button>
```

### Tarefas Fase 3

- [x] 3.1 Substituir dados mock por `api.webhooks.list`
- [x] 3.2 Conectar WebhookFormDialog com `create`/`update`
- [x] 3.3 Conectar Switch com `toggle`
- [x] 3.4 Conectar WebhookLogsDialog com `logs`
- [x] 3.5 Conectar botão Resend com `resend`
- [x] 3.6 Conectar botão Test com `test`
- [x] 3.7 Adicionar loading states (skeleton, LoadingState component)
- [x] 3.8 Adicionar error handling (WebhooksListError component)
- [x] 3.9 Testar fluxo completo

---

## Fase 4: Testes e Documentação

### 4.1 Testes unitários

**Arquivo:** `tests/unit/webhook-forwarder.test.ts`

- Forwarding para webhook ativo
- Skip webhook inativo
- Filtro por instanceIds
- Filtro por subscriptions
- HMAC signature generation
- Custom headers
- Timeout handling
- Error logging

### 4.2 Testes de integração

**Arquivo:** `tests/integration/webhooks.test.ts`

- CRUD completo
- Toggle ativo/inativo
- Event logs query
- Resend functionality
- Test webhook

### 4.3 Atualizar documentação

**Arquivo:** `api-docs/api-reference/webhooks/configure.mdx`

- Como configurar webhook
- Payload format
- HMAC validation
- Best practices

### Tarefas Fase 4

- [x] 4.1 Testes unitários do forwarder (`tests/unit/webhook-forwarder.test.ts`)
- [x] 4.2 Testes do router
- [x] 4.3 Testes de integração
- [x] 4.4 Documentação da API (payload format, HMAC validation em plan)
- [x] 4.5 `bun test` todos passando (228 testes)
- [x] 4.6 `bun build` sem erros

---

## Critérios de Sucesso

### Funcional
- [x] Usuário pode criar webhook com URL
- [x] Usuário pode adicionar signing secret (opcional)
- [x] Usuário pode adicionar headers customizados (opcional)
- [x] Usuário pode filtrar por instâncias
- [x] Usuário pode filtrar por tipos de evento
- [x] Usuário pode ativar/desativar webhook
- [x] Usuário pode ver histórico de entregas
- [x] Usuário pode reenviar evento
- [x] Usuário pode enviar evento de teste

### Performance
- [x] Forwarding não bloqueia resposta ao WuzAPI (fire-and-forget)
- [x] Timeout de 5s por webhook
- [x] Event logs carregam rapidamente

### Segurança
- [x] HMAC-SHA256 para signing (x-livchat-signature header)
- [x] Signing secret não exposto na API (masked com "********")
- [x] Validação de URL (HTTPS validado no router)

### UX
- [x] Nome editável inline (padrão "Webhook")
- [x] Switch visual de ativo/inativo
- [x] Multi-select para filtros de instâncias e eventos
- [x] Dialog para logs (com scroll, payload expandível)
- [x] Empty states informativos

---

## Arquivos a Criar/Modificar

### Novos
| Arquivo | Descrição |
|---------|-----------|
| `src/app/(app)/webhooks/page.tsx` | Página de webhooks |
| `src/components/dashboard/webhooks-list.tsx` | Lista de webhooks |
| `src/components/dashboard/webhook-card.tsx` | Card individual |
| `src/components/dashboard/webhook-logs-sheet.tsx` | Sheet de logs |
| `src/components/dashboard/webhook-form-dialog.tsx` | Dialog criar/editar |
| `src/server/api/routers/webhooks.ts` | tRPC router |
| `src/server/lib/webhook-forwarder.ts` | Lógica de forwarding |

### Modificados
| Arquivo | Mudança |
|---------|---------|
| `src/server/db/schema.ts` | + tabela webhooks |
| `src/lib/events.ts` | + event types |
| `src/server/api/root.ts` | + webhooksRouter |
| `src/app/api/webhooks/wuzapi/route.ts` | + forwardToUserWebhooks |
| `src/components/layout/app-sidebar.tsx` | + link Webhooks |

---

## Rollback Plan

Se algo der errado:

1. **Desabilitar forwarding:**
   ```typescript
   // Em webhook-forwarder.ts
   export async function forwardToUserWebhooks(...) {
     return; // Disable temporarily
   }
   ```

2. **Reverter migration (se necessário):**
   ```bash
   bun db:drop webhooks
   ```

3. **Esconder página:**
   - Remover link do sidebar
   - Página continua acessível mas sem dados

---

## Próximos Passos (após Plan 08)

- **Plan 09:** Billing com AbacatePay
- **Plan 10:** Dashboard de métricas/analytics
- **Plan 11:** SDK JavaScript/TypeScript oficial

---

## Changelog

| Data | Mudança |
|------|---------|
| 2025-12-11 | Criação do plano |
| 2025-12-12 | Fase 1: Frontend mockado completo |
| 2025-12-12 | Fase 2: Backend completo (schema, router, forwarder) |
| 2025-12-12 | Fase 3: Integração front+back completa |
| 2025-12-12 | Fase 4: Testes e build passando |
| 2025-12-12 | **Plan 08 concluído** ✅ |
