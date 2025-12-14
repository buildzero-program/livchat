# AST Workflow Architecture for LivChat

> Documento de arquitetura para integração do Agent-Service-Toolkit (AST) como microsserviço de AI/Workflows para o LivChat.

**Data:** 2024-12-13
**Atualizado:** 2024-12-13
**Status:** Arquitetura Consolidada
**Autor:** Discussão Claude + Pedro

---

## Patterns de Referência (Investigação)

Padrões extraídos de projetos de referência que influenciam esta arquitetura:

| Projeto | Pattern Adotado | Como Aplicamos |
|---------|-----------------|----------------|
| **Flowise** | `flowData` JSON em coluna text + `workspaceId` multi-tenant | Workflows como JSON, orgId em todas tabelas |
| **n8n** | Two-Table (Execution + ExecutionData) + soft-delete | Separar metadata leve de payload pesado |
| **buildzero-flow** | ExecutionLog por nó + Item Provenance | Log granular com rastreamento de origem |
| **AST** | AsyncPostgresSaver (LangGraph) + SSE streaming | Base direta do projeto |
| **LivChat** | events table + API keys auto-claim | Reusar sistema existente de eventos |
| **WuzAPI** | `Authorization: {token}` header + HMAC | Tool send_whatsapp |

---

## 1. Visão Geral

### O Problema

O LivChat App está hospedado na **Vercel**, que tem limitações:
- Timeout de requisições (10-60 segundos)
- Custos altos para long-running functions
- Não ideal para processamento de AI que pode levar tempo

### A Solução

Usar o **Agent-Service-Toolkit (AST)** como microsserviço independente no **Fly.io**:
- Sem limite de tempo
- Processa AI/workflows de forma assíncrona
- Chama de volta o LivChat via HTTP quando precisa enviar mensagens

### Inversão de Controle

```
ARQUITETURA TRADICIONAL (problemática):
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  LivChat    │────▶│     AST     │────▶│  Resposta   │
│  (Vercel)   │wait │  (Fly.io)   │wait │             │
└─────────────┘     └─────────────┘     └─────────────┘
       ❌ Timeout da Vercel

ARQUITETURA PROPOSTA (fire-and-forget):
┌─────────────┐ fire  ┌─────────────┐
│  LivChat    │──────▶│     AST     │
│  (Vercel)   │forget │  (Fly.io)   │
└─────────────┘       └──────┬──────┘
       ▲                     │
       │    HTTP callback    │
       └─────────────────────┘
       ✅ Sem timeout, AST controla
```

---

## 2. Stack de Tecnologias

| Componente | Tecnologia | Hospedagem | Função |
|------------|------------|------------|--------|
| **LivChat App** | Next.js + tRPC | Vercel | Frontend, API, Webhooks |
| **WuzAPI** | Go (whatsmeow) | Fly.io | Conexão WhatsApp |
| **AST Service** | FastAPI + LangGraph | Fly.io | AI Agents, Workflows |
| **Banco LivChat** | PostgreSQL | Neon | Instâncias, eventos |
| **Banco AST** | PostgreSQL | Fly.io/Neon | Workflows, execuções |
| **Cache** | Redis | Upstash/Fly.io | Acumulador, rate limit |

---

## 3. Fluxo de Mensagens

### 3.1 Recebimento de Mensagem (Inbound)

```
1. WhatsApp
   │  User envia mensagem
   ▼
2. WuzAPI (Fly.io)
   │  Recebe via WebSocket
   │  POST webhook
   ▼
3. LivChat App (/api/webhooks/wuzapi) - Vercel
   │  • Valida HMAC
   │  • Identifica instância
   │  • Log evento (async)
   │  • Fire-and-forget para AST
   │  • Retorna 200 OK imediatamente
   ▼
4. AST Service (Fly.io)
   │  • Recebe trigger
   │  • Acumula mensagens (se configurado)
   │  • Executa workflow/agent
   │  • Chama tool "send_whatsapp"
   ▼
5. LivChat API (/api/v1/messages/send) - Vercel
   │  • Recebe request do AST
   │  • Valida API key
   │  • Encaminha para WuzAPI
   ▼
6. WuzAPI → WhatsApp
   │  Mensagem enviada!
   ▼
7. User recebe resposta
```

### 3.2 Diagrama de Sequência

```
User        WhatsApp      WuzAPI       LivChat       AST         LivChat API
  │            │            │            │            │              │
  │──message──▶│            │            │            │              │
  │            │──webhook──▶│            │            │              │
  │            │            │──POST─────▶│            │              │
  │            │            │            │──trigger──▶│              │
  │            │            │            │◀──200 OK───│              │
  │            │            │◀──200 OK───│            │              │
  │            │            │            │            │              │
  │            │            │            │     [Processa AI]         │
  │            │            │            │     [Acumula msgs]        │
  │            │            │            │     [Executa agent]       │
  │            │            │            │            │              │
  │            │            │            │            │──send_msg───▶│
  │            │            │            │            │              │──POST──▶WuzAPI
  │            │            │◀───────────│────────────│──────────────│
  │◀──message──│            │            │            │              │
  │            │            │            │            │              │
```

---

## 4. AST Service API

### 4.1 Endpoints Principais

```
BASE URL: https://ast.fly.dev/api/v1
AUTH: Bearer token (API key por organização)

═══════════════════════════════════════════════════════════════
WORKFLOWS
═══════════════════════════════════════════════════════════════

POST   /workflows              Criar workflow
GET    /workflows              Listar workflows
GET    /workflows/:id          Obter workflow
PUT    /workflows/:id          Atualizar workflow
DELETE /workflows/:id          Deletar workflow

═══════════════════════════════════════════════════════════════
EXECUÇÃO
═══════════════════════════════════════════════════════════════

POST   /workflows/:id/trigger  Disparar workflow (async, fire-and-forget)
POST   /workflows/:id/execute  Executar workflow (sync, aguarda resposta)
GET    /executions             Listar execuções
GET    /executions/:id         Obter detalhes de execução

═══════════════════════════════════════════════════════════════
THREADS (Memory)
═══════════════════════════════════════════════════════════════

POST   /threads                Criar thread
GET    /threads/:id            Obter thread
GET    /threads/:id/messages   Histórico de mensagens
DELETE /threads/:id            Deletar thread

═══════════════════════════════════════════════════════════════
STREAMING
═══════════════════════════════════════════════════════════════

POST   /workflows/:id/stream   SSE streaming (para UI em tempo real)
```

### 4.2 Schema: Trigger Workflow

```typescript
// POST /workflows/:id/trigger
// Request:
{
  "threadId": "5511999999999",      // Identificador único da conversa
  "input": {
    "messages": [
      { "content": "oi", "timestamp": "2024-12-13T10:00:00Z" },
      { "content": "preciso de ajuda", "timestamp": "2024-12-13T10:00:02Z" }
    ],
    "aggregatedInput": "oi\n\npreciso de ajuda",
    "sender": {
      "phone": "5511999999999",
      "name": "João"
    }
  },
  "context": {                      // Dados para tools usarem
    "instanceId": "inst-uuid",
    "organizationId": "org-uuid",
    "livchatApiKey": "lc_live_xxx"  // Para tool send_whatsapp
  }
}

// Response (imediato):
{
  "status": "triggered",
  "executionId": "exec-uuid"
}
```

### 4.3 Schema: Workflow

```typescript
{
  "id": "wf-uuid",
  "name": "Suporte WhatsApp LivChat",
  "description": "Responde mensagens automaticamente",

  // Configuração do trigger
  "trigger": {
    "type": "webhook",
    "accumulator": {
      "enabled": true,
      "timeoutSeconds": 5,        // Espera 5s por mais mensagens
      "maxMessages": 10,
      "separator": "\n\n",
      "resetOnNewMessage": true   // Reinicia timer a cada msg
    }
  },

  // Configuração do agent
  "agent": {
    "model": "gpt-4o",
    "temperature": 0.7,
    "systemPrompt": "Você é um assistente do LivChat...",
    "maxTokens": 2048,
    "tools": ["send_whatsapp", "search_docs", "check_status"]
  },

  // Memory
  "memory": {
    "enabled": true,
    "maxMessages": 20,
    "ttlHours": 24
  },

  "isActive": true,
  "createdAt": "2024-12-13T10:00:00Z",
  "updatedAt": "2024-12-13T10:00:00Z"
}
```

---

## 5. Tools do AST

### 5.1 Tool: send_whatsapp

O AST chama o LivChat como microsserviço para enviar mensagens.

```python
# src/agents/livchat_tools.py

from langchain_core.tools import tool
import httpx
from core import settings

@tool
def send_whatsapp(phone: str, message: str) -> str:
    """Envia mensagem WhatsApp via LivChat API.

    Use este tool quando precisar enviar uma resposta ao usuário.

    Args:
        phone: Número do telefone (formato: 5511999999999)
        message: Conteúdo da mensagem a enviar

    Returns:
        str: Confirmação de envio ou erro
    """
    # Obtém credenciais do contexto da execução
    api_url = settings.LIVCHAT_API_URL
    api_key = settings.LIVCHAT_API_KEY.get_secret_value()

    try:
        response = httpx.post(
            f"{api_url}/api/v1/messages/send",
            json={
                "phone": phone,
                "message": message
            },
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            timeout=30.0
        )
        response.raise_for_status()
        data = response.json()
        return f"Mensagem enviada com sucesso. ID: {data.get('messageId')}"
    except httpx.HTTPError as e:
        return f"Erro ao enviar mensagem: {str(e)}"
```

### 5.2 Tool: search_docs

```python
@tool
def search_docs(query: str) -> str:
    """Busca na documentação do LivChat.

    Use quando o usuário perguntar sobre funcionalidades,
    integração, API, etc.

    Args:
        query: Termo de busca

    Returns:
        str: Documentos relevantes encontrados
    """
    # Implementação com ChromaDB ou similar
    pass
```

### 5.3 Tool: check_instance_status

```python
@tool
def check_instance_status(instance_id: str) -> str:
    """Verifica status de uma instância WhatsApp.

    Args:
        instance_id: ID da instância

    Returns:
        str: Status da instância (conectado, desconectado, etc)
    """
    # Chama LivChat API
    pass
```

### 5.4 Tool: human_escalation

```python
@tool
def human_escalation(reason: str, context: str) -> str:
    """Escala conversa para atendimento humano.

    Use quando não conseguir resolver o problema do usuário
    ou quando ele pedir para falar com um humano.

    Args:
        reason: Motivo da escalação
        context: Resumo da conversa

    Returns:
        str: Confirmação da escalação
    """
    # Notifica via Slack, email, etc
    pass
```

---

## 6. Acumulador de Mensagens

### 6.1 O Problema

Usuários de WhatsApp frequentemente enviam múltiplas mensagens seguidas:

```
10:00:00 - "oi"
10:00:02 - "preciso de ajuda"
10:00:04 - "com a integração da API"
```

Sem acumulador: 3 execuções de workflow separadas.
Com acumulador: 1 execução com contexto completo.

### 6.2 Implementação (Redis)

```python
# src/accumulator/message_accumulator.py

import asyncio
import json
from datetime import datetime
import redis.asyncio as redis

class MessageAccumulator:
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        self._timers: dict[str, asyncio.Task] = {}

    async def add_message(
        self,
        workflow_id: str,
        thread_id: str,
        message: dict,
        timeout_seconds: int,
        on_timeout: callable
    ):
        """
        Adiciona mensagem ao acumulador.
        Reinicia timer a cada nova mensagem.
        Quando timer expira, chama on_timeout com todas as mensagens.
        """
        key = f"acc:{workflow_id}:{thread_id}"
        timer_key = f"{workflow_id}:{thread_id}"

        # Adicionar mensagem à lista
        await self.redis.rpush(key, json.dumps({
            **message,
            "timestamp": datetime.utcnow().isoformat()
        }))

        # Cancelar timer anterior
        if timer_key in self._timers:
            self._timers[timer_key].cancel()

        # Criar novo timer
        async def timeout_handler():
            await asyncio.sleep(timeout_seconds)

            # Coletar todas as mensagens
            messages_raw = await self.redis.lrange(key, 0, -1)
            messages = [json.loads(m) for m in messages_raw]

            # Limpar Redis
            await self.redis.delete(key)
            del self._timers[timer_key]

            # Callback
            await on_timeout(messages)

        self._timers[timer_key] = asyncio.create_task(timeout_handler())
```

### 6.3 Fluxo do Acumulador

```
Mensagem 1 chega (t=0s)
├─ Adiciona ao Redis list
├─ Inicia timer (5s)
└─ Retorna 200 OK

Mensagem 2 chega (t=2s)
├─ Adiciona ao Redis list
├─ CANCELA timer anterior
├─ Inicia NOVO timer (5s)
└─ Retorna 200 OK

Mensagem 3 chega (t=3s)
├─ Adiciona ao Redis list
├─ CANCELA timer anterior
├─ Inicia NOVO timer (5s)
└─ Retorna 200 OK

Timer expira (t=8s)
├─ Coleta mensagens: ["msg1", "msg2", "msg3"]
├─ Concatena: "msg1\n\nmsg2\n\nmsg3"
├─ Executa workflow com input agregado
└─ Limpa Redis
```

---

## 7. Integrações no LivChat

### 7.1 Novo Endpoint: /api/v1/messages/send

```typescript
// src/app/api/v1/messages/send/route.ts

import { validateApiKey } from "@/server/lib/api-key";
import { WuzAPIClient } from "@/server/lib/wuzapi";
import { logEvent } from "@/server/lib/events";

export async function POST(req: Request) {
  // 1. Validar API key
  const authHeader = req.headers.get("Authorization");
  const apiKey = await validateApiKey(authHeader);

  if (!apiKey) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse body
  const { phone, message, instanceId } = await req.json();

  // 3. Buscar instância
  const instance = instanceId
    ? await db.query.instances.findFirst({ where: eq(instances.id, instanceId) })
    : await db.query.instances.findFirst({ where: eq(instances.id, apiKey.instanceId) });

  if (!instance || instance.status !== "connected") {
    return Response.json({ error: "Instance not connected" }, { status: 400 });
  }

  // 4. Enviar via WuzAPI
  const wuzapi = new WuzAPIClient(env.WUZAPI_URL, instance.providerToken);
  const result = await wuzapi.sendText(phone, message);

  // 5. Log evento
  await logEvent({
    name: "message.sent",
    instanceId: instance.id,
    organizationId: instance.organizationId,
    metadata: {
      messageId: result.Id,
      to: phone,
      source: "ast"  // Identifica que veio do AST
    }
  });

  // 6. Resposta
  return Response.json({
    success: true,
    messageId: result.Id,
    timestamp: result.Timestamp
  });
}
```

### 7.2 Modificar Webhook Handler

```typescript
// src/app/api/webhooks/wuzapi/route.ts
// Adicionar disparo para AST

// ... código existente ...

// NOVO: Disparar AST workflow (fire-and-forget)
if (mappedType === "MESSAGE_RECEIVED" && instance.organizationId) {
  // Buscar workflow ativo
  const workflow = await getActiveWorkflow(instance.organizationId, instance.id);

  if (workflow) {
    // Fire-and-forget (não aguarda resposta)
    fetch(`${env.AST_SERVICE_URL}/api/v1/workflows/${workflow.astWorkflowId}/trigger`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${workflow.astApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        threadId: messageData.chat,
        input: {
          messages: [{
            content: messageData.body,
            type: messageData.messageType
          }],
          sender: {
            phone: messageData.sender.replace("@s.whatsapp.net", ""),
            name: messageData.senderName
          }
        },
        context: {
          instanceId: instance.id,
          organizationId: instance.organizationId,
          livchatApiKey: workflow.livchatApiKey
        }
      })
    }).catch(err => {
      console.error("[AST] Trigger failed:", err);
    });
  }
}

// Retorna imediatamente
return new Response("OK", { status: 200 });
```

### 7.3 Nova Tabela: workflow_configs

```typescript
// Drizzle schema
export const workflowConfigs = pgTable("workflow_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),

  // Referência ao AST
  astWorkflowId: text("ast_workflow_id").notNull(),
  astApiKey: text("ast_api_key").notNull(),  // Encriptado

  // API key do LivChat para o AST usar
  livchatApiKey: text("livchat_api_key").notNull(),  // Referência a apiKeys.token

  // Filtros
  instanceIds: uuid("instance_ids").array(),  // NULL = todas
  triggerType: text("trigger_type").default("message.received"),
  filterContains: text("filter_contains"),  // Filtro opcional

  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

---

## 8. Memory e Threads

### 8.1 Conceito

- **Thread ID** = número do telefone do contato
- **Memory** = histórico de mensagens da conversa
- **Persistência** = PostgreSQL via checkpointer do LangGraph

### 8.2 Fluxo

```
Mensagem de 5511999999999
        ↓
threadId = "5511999999999"
        ↓
AST carrega histórico do PostgreSQL
        ↓
[msg antiga 1, msg antiga 2, ..., msg nova]
        ↓
Agent processa com contexto completo
        ↓
Salva nova mensagem + resposta no histórico
```

### 8.3 Limpeza Automática

```python
# Cleanup de threads antigas (cron job)
async def cleanup_old_threads():
    """Remove threads com mais de 24h de inatividade."""
    await db.execute("""
        DELETE FROM checkpoints
        WHERE updated_at < NOW() - INTERVAL '24 hours'
    """)
```

---

## 9. Nodes do Workflow (Futuro)

### 9.1 Visão

Embora inicialmente o AST use agents simples (LLM + tools), futuramente pode suportar workflows visuais com nodes:

### 9.2 Tipos de Nodes Possíveis

```
TRIGGERS
├─ Message Received (WhatsApp)
├─ Scheduled (cron)
├─ Webhook (externo)
└─ Manual (API call)

PROCESSING
├─ AI Agent (LLM + tools)
├─ Condition (if/else)
├─ Parallel (múltiplos branches)
├─ Merge (combinar branches)
├─ Delay (esperar X segundos)
└─ Transform (manipular dados)

ACTIONS
├─ Send WhatsApp (via LivChat)
├─ HTTP Request (qualquer API)
├─ Store (salvar dados)
├─ Human Escalation
└─ Webhook (notificar sistema externo)
```

### 9.3 Exemplo de Workflow Visual

```
┌─────────────────┐
│ Message Trigger │
│ ────────────────│
│ Acumulador: 5s  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   AI Agent      │
│ ────────────────│
│ GPT-4o          │
│ Tools: search,  │
│        send_wa  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│   Condition     │─NO─▶│ Human Escalation│
│ ────────────────│     │ ────────────────│
│ confidence > 0.7│     │ Slack notify    │
└────────┬────────┘     └─────────────────┘
         │ YES
         ▼
┌─────────────────┐
│ Send WhatsApp   │
│ ────────────────│
│ Auto response   │
└─────────────────┘
```

---

## 10. Configuração de Ambiente

### 10.1 LivChat App (.env)

```env
# AST Service
AST_SERVICE_URL=https://ast.fly.dev
AST_DEFAULT_API_KEY=ast_xxx  # Para criar workflows

# Existing
WUZAPI_URL=https://wuzapi.fly.dev
WUZAPI_ADMIN_TOKEN=xxx
DATABASE_URL=postgresql://...
```

### 10.2 AST Service (.env)

```env
# LivChat Integration
LIVCHAT_API_URL=https://livchat.ai
LIVCHAT_API_KEY=lc_live_xxx  # Default, pode ser override por workflow

# LLM Providers
OPENAI_API_KEY=sk-xxx
ANTHROPIC_API_KEY=sk-ant-xxx

# Database
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# Server
HOST=0.0.0.0
PORT=8080
```

---

## 11. Benefícios da Arquitetura

### Para o LivChat:
- **Sem timeout**: Vercel só faz fire-and-forget
- **Custos baixos**: Requests rápidas na Vercel
- **Desacoplado**: AST pode cair sem afetar o LivChat core

### Para o AST:
- **Genérico**: Pode servir outros projetos
- **Controle total**: Processa pelo tempo que precisar
- **Escalável**: Fly.io escala automaticamente

### Para o Usuário:
- **Resposta inteligente**: AI com contexto completo
- **Mensagens agrupadas**: Acumulador evita respostas fragmentadas
- **Memória**: Conversas com continuidade

---

## 12. Schemas de Banco Consolidados

### 12.1 AST Database (Neon PostgreSQL)

```sql
-- Workflows (inspirado Flowise - JSON em coluna text)
CREATE TABLE workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    agent_config JSONB NOT NULL,            -- {model, systemPrompt, tools, memory}
    trigger_config JSONB,                   -- {type, accumulator: {enabled, timeout}}
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);
CREATE INDEX idx_workflows_org ON workflows(organization_id);

-- Executions (inspirado n8n two-table - metadata leve)
CREATE TABLE executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID REFERENCES workflows ON DELETE SET NULL,
    thread_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running',  -- running | completed | error
    started_at TIMESTAMP DEFAULT now(),
    finished_at TIMESTAMP,
    deleted_at TIMESTAMP,                    -- soft-delete
    metadata JSONB
);
CREATE INDEX idx_executions_workflow ON executions(workflow_id);
CREATE INDEX idx_executions_thread ON executions(thread_id);
CREATE INDEX idx_executions_status ON executions(status);

-- ExecutionLogs (inspirado buildzero-flow - log por step)
CREATE TABLE execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID REFERENCES executions ON DELETE CASCADE,
    step_name TEXT NOT NULL,                 -- 'accumulator' | 'agent' | 'tool:send_whatsapp'
    input JSONB,
    output JSONB,
    error TEXT,
    status TEXT DEFAULT 'running',
    duration_ms INTEGER,
    started_at TIMESTAMP DEFAULT now(),
    finished_at TIMESTAMP
);
CREATE INDEX idx_exec_logs_execution ON execution_logs(execution_id);

-- Checkpoints (LangGraph automático - criados pelo AsyncPostgresSaver)
-- Tabelas: checkpoints, checkpoint_blobs, writes
```

### 12.2 LivChat App - Nova Tabela (Drizzle)

```typescript
// src/server/db/schema.ts - ADICIONAR

export const workflowConfigs = pgTable("workflow_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),

  // Referência ao AST
  astWorkflowId: text("ast_workflow_id").notNull(),
  astApiKey: text("ast_api_key").notNull(),

  // API key do LivChat para o AST usar na tool send_whatsapp
  livchatApiKey: text("livchat_api_key").notNull(),

  // Filtros de trigger
  triggerType: text("trigger_type").default("message.received"),
  instanceIds: uuid("instance_ids").array(),  // NULL = todas instâncias
  filterType: text("filter_type"),            // 'all' | 'contains' | 'regex'
  filterValue: text("filter_value"),

  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_workflow_configs_org").on(table.organizationId),
  index("idx_workflow_configs_active").on(table.organizationId, table.isActive),
]);

export const workflowConfigsRelations = relations(workflowConfigs, ({ one }) => ({
  organization: one(organizations, {
    fields: [workflowConfigs.organizationId],
    references: [organizations.id],
  }),
}));
```

---

## 13. Arquitetura Completa

### 13.1 Diagrama de Componentes

```
                                    INTERNET
                                        │
    ┌───────────────────────────────────┼───────────────────────────────────┐
    │                                   │                                   │
    ▼                                   ▼                                   ▼
┌─────────────┐              ┌─────────────────┐              ┌─────────────────┐
│ LivChat App │              │    PartyKit     │              │   AST Service   │
│  (Vercel)   │◀─WebSocket──▶│    (Fly.io)     │◀───SSE──────▶│    (Fly.io)     │
├─────────────┤              ├─────────────────┤              ├─────────────────┤
│             │              │                 │              │                 │
│ • Dashboard │              │ • Ivy Chat WS   │              │ • POST /stream  │
│ • Ivy UI    │              │ • Token relay   │              │ • POST /invoke  │
│ • tRPC API  │              │ • No timeout    │              │ • POST /trigger │
│             │              │                 │              │                 │
│ Webhooks:   │              └─────────────────┘              │ Agents:         │
│ /wuzapi ────│──fire-and-forget──────────────────────────────▶ • Ivy (chat)   │
│ /ast    ◀───│────────────callback───────────────────────────│ • WhatsApp AI  │
│             │                                               │                 │
│ REST API:   │                                               │ Tools:          │
│ /v1/send ◀──│───────────────HTTP───────────────────────────▶ • send_whatsapp │
│             │                                               │ • search_docs  │
└──────┬──────┘                                               └────────┬────────┘
       │                                                               │
       │           ┌─────────────────┐                                 │
       └──────────▶│     WuzAPI      │◀────────────────────────────────┘
                   │    (Fly.io)     │      (via LivChat /v1/send)
                   ├─────────────────┤
                   │ • WhatsApp conn │
                   │ • Send/Receive  │
                   └─────────────────┘

                            DATABASES
    ┌─────────────────────────────────────────────────────────────────┐
    │                                                                 │
    │  ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐   │
    │  │ Neon (LivChat)│   │ Neon (AST)   │   │ Upstash Redis    │   │
    │  ├──────────────┤   ├──────────────┤   ├──────────────────┤   │
    │  │ • instances  │   │ • workflows  │   │ • accumulator    │   │
    │  │ • apiKeys    │   │ • executions │   │ • rate limit     │   │
    │  │ • webhooks   │   │ • exec_logs  │   │                  │   │
    │  │ • events     │   │ • checkpoints│   │                  │   │
    │  │ • workflow   │   │              │   │                  │   │
    │  │   _configs   │   │              │   │                  │   │
    │  └──────────────┘   └──────────────┘   └──────────────────┘   │
    │                                                                 │
    └─────────────────────────────────────────────────────────────────┘
```

### 13.2 Fluxo: Ivy no Dashboard (Streaming)

```
User digita no Dashboard
        │
        ▼
Ivy UI (React) ─── sendMessage() ───▶ WebSocket
        │                                 │
        │                                 ▼
        │                          PartyKit Server
        │                                 │
        │                                 │ HTTP POST /stream
        │                                 ▼
        │                          AST Service
        │                                 │
        │                                 │ LangGraph Agent
        │                                 │ (Ivy config)
        │                                 │
        │                                 ▼
        │                          SSE: data: {"type":"token","content":"..."}
        │                                 │
        │                          broadcast()
        │                                 │
        │◀────── WebSocket ◀──────────────┘
        │
        ▼
streamingContent → UI re-renders token by token
```

### 13.3 Fluxo: WhatsApp Auto-Response (Async)

```
WhatsApp User envia: "oi" ... "ajuda" ... "api"
        │
        ▼
WuzAPI (Fly.io) ─── webhook ───▶ LivChat /api/webhooks/wuzapi
                                        │
                                        │ fire-and-forget
                                        ▼
                                 AST /trigger
                                        │
                                        │ Accumulator (Redis)
                                        │ LPUSH + timer 5s
                                        │
                                 [5 segundos passam]
                                        │
                                        │ Coleta: ["oi", "ajuda", "api"]
                                        │ Input: "oi\n\najuda\n\napi"
                                        │
                                        ▼
                                 LangGraph Agent executa
                                        │
                                        │ Tool: send_whatsapp(phone, response)
                                        ▼
                                 LivChat /api/v1/messages/send
                                        │
                                        │ WuzAPIClient.sendText()
                                        ▼
                                 WuzAPI → WhatsApp
                                        │
                                        ▼
                                 User recebe resposta
```

---

## 14. Comparação com Alternativas

| Aspecto | n8n | Flowise | AST (proposta) |
|---------|-----|---------|----------------|
| Acumulador de msgs | Não | Não | **Sim** |
| Fire-and-forget | Sim | Não | **Sim** |
| Hospedagem | Self-hosted | Self-hosted | **Fly.io** |
| Vendor lock-in | Baixo | Baixo | **Zero** |
| Foco | Genérico | LLM visual | **WhatsApp/Chat** |
| Complexidade | Alta | Média | **Baixa** |

---

## 13. Próximos Passos

### Fase 1: MVP
1. [ ] Criar endpoint `/api/v1/messages/send` no LivChat
2. [ ] Criar tool `send_whatsapp` no AST
3. [ ] Implementar acumulador básico (Redis)
4. [ ] Criar workflow simples (LLM + send_whatsapp)
5. [ ] Testar fluxo completo

### Fase 2: Produção
1. [ ] Tabela `workflow_configs` no LivChat
2. [ ] UI para configurar workflows
3. [ ] Múltiplas tools (search_docs, check_status)
4. [ ] Memory/threads persistente
5. [ ] Monitoramento e logs

### Fase 3: Avançado
1. [ ] Editor visual de workflows
2. [ ] Nodes customizados
3. [ ] Processamento paralelo
4. [ ] Human-in-the-loop
5. [ ] A/B testing de prompts

---

## 14. Referências

- [Agent-Service-Toolkit](https://github.com/JoshuaC215/agent-service-toolkit)
- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)
- [n8n AI Agents](https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.agent/)
- [Flowise](https://github.com/FlowiseAI/Flowise)

---

## Anexo: Arquitetura de Referência

```
                              INTERNET
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   LivChat App   │    │     WuzAPI      │    │   AST Service   │
│    (Vercel)     │    │    (Fly.io)     │    │    (Fly.io)     │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│                 │    │                 │    │                 │
│ • Frontend      │    │ • WhatsApp conn │    │ • Workflows API │
│ • tRPC API      │◀──▶│ • Send/Receive  │    │ • AI Agents     │
│ • Webhooks      │    │ • Webhooks      │    │ • Acumulador    │
│                 │    │                 │    │ • Memory        │
│ Fire-and-forget │───▶│                 │◀───│ • Tools         │
│ para AST        │    │                 │    │   - send_wa     │
│                 │◀───│                 │    │   - search      │
│ /messages/send  │────│─────────────────│────│   - etc         │
│                 │    │                 │    │                 │
└────────┬────────┘    └─────────────────┘    └────────┬────────┘
         │                                             │
         │              ┌─────────────────┐            │
         └──────────────│    PostgreSQL   │────────────┘
                        │     (Neon)      │
                        ├─────────────────┤
                        │ • instances     │
                        │ • events        │
                        │ • workflows     │
                        │ • checkpoints   │
                        └─────────────────┘
```

---

*Este documento será atualizado conforme a implementação avança.*
