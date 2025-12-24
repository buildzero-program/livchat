# Plan 22: Workflow Triggers - Design de Arquitetura

## Status: DESIGN

Data: 2024-12-24

---

## 1. Visão Geral

Este documento define a arquitetura para implementar **workflow triggers** no LivChat, permitindo que workflows sejam acionados automaticamente por eventos (ex: WhatsApp conectado, mensagem recebida).

### Objetivo Final

Quando um usuário conectar o WhatsApp, a Ivy (assistente virtual) envia automaticamente uma mensagem de boas-vindas usando uma instância interna.

### Inspiração

A arquitetura é inspirada no **n8n**, adaptada para os 3 serviços independentes do LivChat.

---

## 2. Arquitetura dos 3 Serviços

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        LivChat System                                   │
│                                                                         │
│   ┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐   │
│   │    WuzAPI    │     │     LivChat      │     │       AST        │   │
│   │     (Go)     │     │    (Next.js)     │     │    (Python)      │   │
│   │   :8080      │     │     :3000        │     │     :9000        │   │
│   └──────────────┘     └──────────────────┘     └──────────────────┘   │
│                                                                         │
│   Protocol Adapter      Gateway/Router         Workflow Engine          │
│   WhatsApp ↔ HTTP       Auth, DB, Routing      AI, Agents, Tools       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Responsabilidades

| Serviço | Responsabilidade | Conhece |
|---------|------------------|---------|
| **WuzAPI** | Protocol adapter (WhatsApp ↔ HTTP) | Nada sobre workflows |
| **LivChat** | Gateway + Router (Auth, DB, Routing) | Quais workflows existem, regras de trigger |
| **AST** | Workflow Engine (execução) | Nada sobre WuzAPI, apenas executa nodes |

### Princípio: Baixo Acoplamento

- **WuzAPI** não sabe que AST existe
- **AST** não sabe que WuzAPI existe
- **LivChat** é a ponte inteligente entre eles

---

## 3. Padrão n8n: Abstração Visual vs Implementação

### Descoberta-chave

No n8n, todos os triggers são **webhooks HTTP** por baixo. A diferença está apenas na **metadata e UI**:

```
┌─────────────────────────────────────────────────────────────────────┐
│                            UI (Visual)                              │
│                                                                     │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │
│   │  WhatsApp   │  │   Slack     │  │  Webhook    │                │
│   │  Trigger    │  │  Trigger    │  │  Genérico   │  ← Diferentes  │
│   └─────────────┘  └─────────────┘  └─────────────┘                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                           (metadata)
                                 │
┌─────────────────────────────────────────────────────────────────────┐
│                          ENGINE (Real)                              │
│                                                                     │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │                    TUDO É WEBHOOK HTTP                       │  │
│   │                                                              │  │
│   │  WhatsApp → webhook() com validação WuzAPI                   │  │
│   │  Slack    → webhook() com validação Slack                    │  │
│   │  Genérico → webhook() sem validação                          │  │
│   └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Actions: Tudo é HTTP Request

Da mesma forma, nodes de ação (Send Message, etc) são abstrações sobre HTTP:

```typescript
// Na UI: "Send WhatsApp Message" com formulário bonito
// No Engine: POST para WuzAPI/LivChat API
```

---

## 4. Fluxo de Eventos Proposto

### 4.1 Trigger: WhatsApp Conectado

```
┌──────────┐                                           ┌──────────┐
│  WuzAPI  │                                           │   AST    │
│  :8080   │                                           │  :9000   │
└────┬─────┘                                           └────┬─────┘
     │                                                      │
     │ 1. WhatsApp conecta                                  │
     │                                                      │
     │ 2. POST /api/webhooks/wuzapi                         │
     │    { type: "Connected", ... }                        │
     │                                                      │
     ▼                                                      │
┌─────────────────────────────────────────────────────────────────┐
│                      LivChat App :3000                          │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Webhook Handler (/api/webhooks/wuzapi)                  │   │
│  │                                                          │   │
│  │  1. Validar HMAC                                         │   │
│  │  2. Identificar instance                                 │   │
│  │  3. Mapear evento → EventType                            │   │
│  │  4. Logar no DB (events table)                           │   │
│  │  5. Forward para user webhooks                           │   │
│  │  6. 🆕 Rotear para AST workflows                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                            │                                    │
│                   ┌────────▼────────┐                           │
│                   │ Workflow Router │                           │
│                   │                 │                           │
│                   │ 1. Query DB:    │                           │
│                   │    workflow_    │                           │
│                   │    triggers     │                           │
│                   │                 │                           │
│                   │ 2. Match rules: │                           │
│                   │    - event type │                           │
│                   │    - instanceId │                           │
│                   │    - filters    │                           │
│                   │                 │                           │
│                   │ 3. Dispatch     │                           │
│                   │    (async)      │                           │
│                   └────────┬────────┘                           │
│                            │                                    │
└────────────────────────────┼────────────────────────────────────┘
                             │
                             │ 3. POST /workflows/{id}/trigger
                             │    { event: "connection.connected", ... }
                             │
                             ▼
                      ┌──────────────┐
                      │     AST      │
                      │    :9000     │
                      │              │
                      │ 4. Execute   │
                      │    workflow  │
                      │    (Ivy)     │
                      │              │
                      │ 5. Node:     │
                      │    "Send     │
                      │    Message"  │
                      │    ↓         │
                      │    HTTP POST │
                      └──────┬───────┘
                             │
                             │ 6. POST /api/v1/messages/send
                             │    (via LivChat API Gateway)
                             │
                             ▼
                      ┌──────────────┐
                      │   WuzAPI     │
                      │   :8080      │
                      │              │
                      │ 7. Envia msg │
                      │    WhatsApp  │
                      └──────────────┘
```

### 4.2 Fluxo Resumido

```
WuzAPI → LivChat (webhook) → AST (trigger) → LivChat API → WuzAPI
         ↑                                      ↓
         └── Gateway inteligente ───────────────┘
```

---

## 5. Schema do Workflow com Triggers

### 5.1 Estrutura do Workflow

```json
{
  "id": "wf_ivy_onboarding",
  "name": "Ivy Onboarding",
  "organizationId": "org_xxx",
  "isActive": true,

  "nodes": [
    {
      "id": "trigger-1",
      "type": "livchat_trigger",
      "displayName": "WhatsApp Conectado",
      "group": "trigger",
      "position": { "x": 100, "y": 100 },
      "config": {
        "source": "wuzapi",
        "events": ["connection.connected"],
        "instanceIds": null
      }
    },
    {
      "id": "agent-1",
      "type": "agent",
      "displayName": "Ivy Agent",
      "group": "action",
      "position": { "x": 300, "y": 100 },
      "config": {
        "prompt": {
          "system": "Você é a Ivy. Dê boas-vindas ao usuário que acabou de conectar."
        },
        "llm": {
          "model": "gemini-2.0-flash"
        }
      }
    },
    {
      "id": "send-1",
      "type": "send_whatsapp",
      "displayName": "Enviar Mensagem",
      "group": "action",
      "position": { "x": 500, "y": 100 },
      "config": {
        "instanceId": "inst_internal_ivy",
        "to": "{{trigger.phone}}",
        "message": "{{agent.response}}"
      }
    }
  ],

  "edges": [
    { "source": "trigger-1", "target": "agent-1" },
    { "source": "agent-1", "target": "send-1" }
  ]
}
```

### 5.2 Tipos de Nodes

| Tipo | Group | Descrição |
|------|-------|-----------|
| `livchat_trigger` | trigger | Eventos do WuzAPI (WhatsApp) |
| `webhook_trigger` | trigger | Webhook HTTP genérico |
| `schedule_trigger` | trigger | Cron/agendamento |
| `agent` | action | LLM/AI processing |
| `send_whatsapp` | action | Enviar mensagem WhatsApp |
| `http_request` | action | Request HTTP genérico |
| `condition` | logic | Ramificação condicional |

### 5.3 Propriedade `group`

Define como a UI renderiza o node:

- `trigger`: Aparece na seção "Triggers", sem inputs, ícone especial
- `action`: Aparece na seção "Actions", tem inputs/outputs
- `logic`: Aparece na seção "Logic", múltiplos outputs

---

## 6. Camadas de Abstração

### 6.1 Camada 1: UI (Next.js)

```
┌─────────────────────────────────────────────────────────────────┐
│  Renderiza nodes baseado em metadata                            │
│                                                                 │
│  NodeDefinition → Formulário dinâmico                           │
│  group: "trigger" → Seção Triggers                              │
│  group: "action" → Seção Actions                                │
│                                                                 │
│  Tudo visual: ícones, cores, labels                             │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Camada 2: LivChat (Gateway)

```
┌─────────────────────────────────────────────────────────────────┐
│  Recebe TODOS os webhooks                                       │
│  Roteia para AST baseado em workflow_triggers                   │
│                                                                 │
│  • Auth (quem pode acionar qual workflow)                       │
│  • Routing (evento → workflow)                                  │
│  • Audit (logar tudo)                                           │
│  • Rate limit (não sobrecarregar AST)                          │
│  • Transform (normalizar payload)                               │
└─────────────────────────────────────────────────────────────────┘
```

### 6.3 Camada 3: AST (Engine)

```
┌─────────────────────────────────────────────────────────────────┐
│  Executa workflows                                              │
│  Não sabe de WuzAPI, Slack, etc                                 │
│                                                                 │
│  Recebe: { event, data, context }                               │
│  Executa: nodes em sequência/paralelo                           │
│  Retorna: resultado                                             │
│                                                                 │
│  Para enviar mensagem:                                          │
│  - HTTP POST para LivChat API                                   │
│  - LivChat roteia para WuzAPI                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Database Schema

### 7.1 Nova Tabela: workflow_triggers

```sql
CREATE TABLE workflow_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workflow_id TEXT NOT NULL,  -- ID no AST (wf_xxx)

  -- Trigger config
  source TEXT NOT NULL,       -- "wuzapi", "webhook", "schedule"
  event_types TEXT[],         -- ["connection.connected", "message.received"]
  instance_ids UUID[],        -- NULL = todas instances

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Constraints
  CONSTRAINT unique_workflow_trigger UNIQUE (organization_id, workflow_id, source)
);

-- Indexes
CREATE INDEX idx_workflow_triggers_org ON workflow_triggers(organization_id);
CREATE INDEX idx_workflow_triggers_active ON workflow_triggers(organization_id, is_active)
  WHERE is_active = true;
CREATE INDEX idx_workflow_triggers_source ON workflow_triggers(source, is_active)
  WHERE is_active = true;
```

### 7.2 Relacionamento com AST

```
LivChat DB (PostgreSQL)          AST Store (PostgreSQL)
┌───────────────────────┐        ┌───────────────────────┐
│ workflow_triggers     │        │ workflows (store)     │
│                       │        │                       │
│ workflow_id: wf_xxx ──│───────▶│ id: wf_xxx            │
│ organization_id       │        │ flowData: { nodes }   │
│ source: wuzapi        │        │ isActive: true        │
│ event_types: [...]    │        │                       │
└───────────────────────┘        └───────────────────────┘
```

**Por que separado?**
- LivChat gerencia: quem pode acionar, filtros, audit
- AST gerencia: como executar, nodes, AI

---

## 8. Comunicação Entre Serviços

### 8.1 LivChat → AST

```typescript
// POST /workflows/{id}/trigger
{
  "threadId": "trigger_evt_xxx",
  "input": {
    "event": "connection.connected",
    "data": {
      "instanceId": "inst_xxx",
      "instanceName": "Minha Instância",
      "phone": "5511999999999",
      "timestamp": "2024-12-24T10:00:00Z"
    }
  }
}
```

### 8.2 AST → LivChat (para enviar mensagem)

```typescript
// POST /api/v1/messages/send
// Via API Gateway (workers/api-gateway)
{
  "instanceId": "inst_internal_ivy",
  "to": "5511999999999",
  "text": "Olá! Bem-vindo ao LivChat..."
}
```

### 8.3 Não Há Conexão Permanente

Toda comunicação é via HTTP request/response. Não há:
- WebSocket entre serviços
- Polling
- Message queue (para MVP)

---

## 9. Endpoint do AST: /trigger vs /invoke

### Diferença

| Endpoint | Uso | Comportamento |
|----------|-----|---------------|
| `/invoke` | Execução síncrona | Espera resposta completa |
| `/stream` | Execução com SSE | Stream de tokens |
| `/trigger` | Fire-and-forget | Retorna imediato, executa em background |

### Por que `/trigger`?

Para automações, não queremos bloquear o webhook handler esperando a execução completa:

```python
# AST: workflow_router.py
@router.post("/{workflow_id}/trigger")
async def trigger_workflow(
    workflow_id: str,
    input: TriggerInput,
    background_tasks: BackgroundTasks
) -> TriggerResponse:
    """Fire-and-forget - retorna imediatamente"""
    background_tasks.add_task(execute_workflow, workflow_id, input)
    return {"status": "triggered", "workflow_id": workflow_id}
```

---

## 10. Trade-offs da Arquitetura

### Vantagens

| Vantagem | Descrição |
|----------|-----------|
| **Baixo acoplamento** | Serviços independentes, podem evoluir separadamente |
| **AST agnóstico** | Não conhece WuzAPI, pode processar eventos de qualquer fonte |
| **Auditoria centralizada** | LivChat loga todos os triggers |
| **Escalabilidade** | AST pode escalar independente do LivChat |
| **Reutilizável** | Mesmo pattern para Telegram, SMS, Email no futuro |

### Desvantagens

| Desvantagem | Mitigação |
|-------------|-----------|
| **Latência extra** | Fire-and-forget, não bloqueia |
| **Ponto único de falha** | Vercel/Fly tem alta disponibilidade |
| **Mais código no LivChat** | Módulo isolado (workflow-router) |

---

## 11. Instância Interna da Ivy

Para a Ivy enviar mensagens, precisamos de uma instância "interna":

### Configuração

```typescript
// env.ts
IVY_INSTANCE_ID: "inst_internal_ivy"
IVY_INSTANCE_PHONE: "5511999999999"
```

### Fluxo

1. Ivy workflow executa
2. Node "Send WhatsApp" usa `IVY_INSTANCE_ID`
3. AST faz POST para LivChat API
4. LivChat roteia para WuzAPI
5. WuzAPI envia via WhatsApp

### Considerações

- Instância deve estar sempre conectada
- Não conta contra quota do usuário
- Logs separados (Ivy vs User)

---

## 12. Arquivos Principais

### LivChat (Next.js)

```
app/src/
├── app/api/webhooks/wuzapi/
│   └── route.ts                    # Webhook handler (modificar)
├── server/lib/
│   ├── workflow-router.ts          # 🆕 Routing logic
│   └── ast.ts                      # Client AST (adicionar trigger())
└── server/db/schema.ts             # 🆕 workflow_triggers table
```

### AST (Python)

```
ast/src/
├── service/
│   └── workflow_router.py          # 🆕 POST /trigger endpoint
├── nodes/                          # 🆕 Node definitions
│   ├── triggers/
│   │   └── base_trigger.py
│   └── actions/
│       └── send_whatsapp.py
└── schema/
    └── workflow_schema.py          # Atualizar com triggers
```

---

## 13. Referências

### Código n8n Analisado

- `/packages/nodes-base/nodes/Webhook/Webhook.node.ts` - Webhook trigger
- `/packages/nodes-base/nodes/Slack/SlackTrigger.node.ts` - App trigger
- `/packages/cli/src/active-workflow-manager.ts` - Activation logic
- `/packages/cli/src/webhooks/webhook.service.ts` - Webhook routing

### Docs Relacionados

- `docs/system-design.md` - Arquitetura geral do LivChat
- `docs/plans/archived/plan-11/` - AST MVP
- `ast/CHANGELOG.md` - Histórico de mudanças do AST

---

## 14. Próximos Passos

Este documento define o **design**. O plano de implementação será criado em documento separado.

### Fases Previstas

1. **Database**: Criar tabela `workflow_triggers`
2. **AST**: Adicionar endpoint `/trigger`
3. **LivChat**: Criar `workflow-router.ts`
4. **Integração**: Conectar webhook handler ao router
5. **UI**: Tela para configurar triggers (futuro)
6. **Ivy Onboarding**: Implementar caso de uso completo

---

## Changelog

| Data | Mudança |
|------|---------|
| 2024-12-24 | Documento inicial de design |
