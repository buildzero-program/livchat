# Plan 10 - AST Service MVP: Ivy AI + WhatsApp Auto-Response

> **Baseado em:** docs/ast-workflow-architecture.md
> **Dependências:** Nenhuma (greenfield)
> **Estimativa:** 3-4 sessões
> **Status:** 🔄 Em Progresso

---

## Objetivo

Implementar o **Agent-Service-Toolkit (AST)** como microsserviço de AI para o LivChat, habilitando:

1. **Ivy AI**: Assistente inteligente no dashboard com streaming de respostas
2. **WhatsApp Auto-Response**: Respostas automáticas para mensagens recebidas

O AST será hospedado no Fly.io como serviço independente, usando PostgreSQL (Neon) para persistência de conversas e LangGraph para orquestração de agents.

---

## Decisões Técnicas

### 1. Base do Projeto: Fork do agent-service-toolkit

**Decisão:** Copiar o AST para `/home/pedro/dev/sandbox/livchat/ast` e adaptar

| Opção | Prós | Contras |
|-------|------|---------|
| **Fork AST (escolhido)** | 80% pronto, LangGraph integrado, testado | Código Python (vs TypeScript do LivChat) |
| Criar do zero em TS | Consistência com stack | Muito trabalho, reinventar roda |
| Usar Flowise | UI visual | Overhead, não code-first |

**Justificativa:** O AST já tem FastAPI, LangGraph, checkpointer PostgreSQL e SSE streaming. Adaptar é muito mais rápido.

---

### 2. Streaming: PartyKit como relay (não Vercel Edge)

**Decisão:** PartyKit no Fly.io como intermediário WebSocket → SSE

| Opção | Prós | Contras |
|-------|------|---------|
| **PartyKit (escolhido)** | Sem timeout, WebSocket nativo | +1 serviço |
| Vercel Edge | Menos infra | Timeout 30s (free), 60s (pro) |
| SSE direto | Simples | CORS, sem WebSocket |

**Justificativa:** Respostas de AI com tools podem demorar >60s. PartyKit elimina problema de timeout.

---

### 3. Database: Neon PostgreSQL separado

**Decisão:** Database Neon dedicado para o AST

| Opção | Prós | Contras |
|-------|------|---------|
| **Neon separado (escolhido)** | Isolamento, migrations independentes | +1 database |
| Mesmo Neon do LivChat | Menos infra | Acoplamento, conflitos de schema |
| SQLite | Zero config | Perde dados em redeploy |

**Justificativa:** Microsserviços devem ter databases isolados. Neon free tier (0.5GB) suficiente para MVP.

---

### 4. Tool send_whatsapp: Via LivChat API

**Decisão:** AST chama `/api/v1/messages/send` do LivChat, não WuzAPI direto

| Opção | Prós | Contras |
|-------|------|---------|
| **Via LivChat (escolhido)** | Logging centralizado, quota tracking | +1 hop de rede |
| Direto WuzAPI | Menor latência | Duplica lógica, sem eventos |

**Justificativa:** LivChat já tem validação, logging de eventos e quota. Não faz sentido duplicar.

---

## Escopo MVP

### Inclui
- [x] AST Service no Fly.io com FastAPI
- [x] Ivy Agent com streaming
- [x] PartyKit server para WebSocket relay
- [x] WhatsApp Agent básico (recebe → processa → responde)
- [x] Tool `send_whatsapp`
- [x] Checkpointer PostgreSQL (memória de conversas)
- [x] Endpoint `/api/v1/messages/send` no LivChat
- [x] Trigger de AST no webhook handler
- [x] Integração da Ivy UI com PartyKit

### Não Inclui (futuro)
- [ ] Acumulador de mensagens (Redis)
- [ ] UI para criar/editar workflows
- [ ] Múltiplas tools (search_docs, check_status)
- [ ] Dashboard de execuções
- [ ] Human escalation

---

## Arquitetura

```
┌─────────────┐              ┌─────────────────┐              ┌─────────────────┐
│ LivChat App │              │    PartyKit     │              │   AST Service   │
│  (Vercel)   │◀─WebSocket──▶│    (Fly.io)     │◀───SSE──────▶│    (Fly.io)     │
├─────────────┤              ├─────────────────┤              ├─────────────────┤
│             │              │                 │              │                 │
│ • Dashboard │              │ • Ivy Chat WS   │              │ • POST /stream  │
│ • Ivy UI    │              │ • Token relay   │              │ • POST /invoke  │
│             │              │                 │              │                 │
│ Webhooks:   │              └─────────────────┘              │ Agents:         │
│ /wuzapi ────│──fire-and-forget────────────────────────────▶│ • ivy           │
│             │                                               │ • whatsapp      │
│ REST API:   │                                               │                 │
│ /v1/send ◀──│───────────────HTTP───────────────────────────│ Tool:           │
│             │                                               │ • send_whatsapp │
└──────┬──────┘                                               └────────┬────────┘
       │                                                               │
       │           ┌─────────────────┐                                 │
       └──────────▶│     WuzAPI      │◀────────────────────────────────┘
                   │    (Fly.io)     │
                   └─────────────────┘

                   ┌──────────────┐   ┌──────────────┐
                   │ Neon LivChat │   │  Neon AST    │
                   ├──────────────┤   ├──────────────┤
                   │ • instances  │   │ • checkpoints│
                   │ • apiKeys    │   │ (LangGraph)  │
                   │ • events     │   │              │
                   │ • workflow   │   │              │
                   │   _configs   │   │              │
                   └──────────────┘   └──────────────┘
```

---

## Estrutura de Arquivos

```
/home/pedro/dev/sandbox/livchat/
├── app/                              # LivChat App (existente)
│   └── src/
│       ├── app/api/
│       │   ├── v1/messages/send/     # NOVO: REST API
│       │   │   └── route.ts
│       │   └── webhooks/wuzapi/      # MODIFICAR: trigger AST
│       │       └── route.ts
│       ├── components/ai-chat/       # MODIFICAR: conectar PartyKit
│       │   └── ai-chat-provider.tsx
│       └── server/db/
│           └── schema.ts             # ADICIONAR: workflowConfigs
│
├── ast/                              # NOVO: AST Service
│   ├── src/
│   │   ├── agents/
│   │   │   ├── agents.py             # MODIFICAR: registrar agents
│   │   │   ├── ivy_agent.py          # NOVO
│   │   │   └── whatsapp_agent.py     # NOVO
│   │   ├── tools/
│   │   │   └── livchat_tools.py      # NOVO
│   │   ├── core/
│   │   │   └── settings.py           # MODIFICAR: adicionar configs
│   │   └── service/
│   │       └── service.py            # BASE (manter)
│   ├── .env
│   ├── fly.toml                      # NOVO
│   └── pyproject.toml
│
└── partykit/                         # NOVO: PartyKit server
    ├── src/
    │   └── ivy-chat.ts
    ├── package.json
    ├── partykit.json
    └── tsconfig.json
```

---

## Fases

### Fase 1: Setup do AST Service

#### Task 1.1: Copiar e configurar AST

**Ações:**
```bash
cd /home/pedro/dev/sandbox/livchat
cp -r /home/pedro/dev/sandbox/buildzero/references/agent-service-toolkit ast
cd ast
rm -rf .git
```

**Arquivos a modificar:**

`pyproject.toml`:
```toml
[project]
name = "livchat-ast"
version = "0.1.0"
```

`fly.toml`:
```toml
app = "livchat-ast"
primary_region = "gru"

[build]
  dockerfile = "Dockerfile"

[env]
  HOST = "0.0.0.0"
  PORT = "8080"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1

[[vm]]
  memory = "512mb"
  cpu_kind = "shared"
  cpus = 1
```

**Critério de aceite:**
- [ ] `cd ast && uv sync` instala dependências
- [ ] `uv run uvicorn src.service:app --port 8080` roda sem erros
- [ ] `curl http://localhost:8080/info` retorna lista de agents

---

#### Task 1.2: Criar database Neon para AST

**Ações:**
1. Acessar console.neon.tech
2. Criar projeto "livchat-ast"
3. Copiar connection string

**Arquivo:** `ast/.env`
```env
# Database
DATABASE_TYPE=postgres
POSTGRES_USER=neondb_owner
POSTGRES_PASSWORD=xxxxx
POSTGRES_HOST=ep-xxx.us-east-2.aws.neon.tech
POSTGRES_PORT=5432
POSTGRES_DB=neondb

# LLM
OPENAI_API_KEY=sk-xxx
DEFAULT_MODEL=gpt-4o-mini

# Auth
AUTH_SECRET=ast_secret_livchat_xxx

# LivChat Integration
LIVCHAT_API_URL=https://livchat.ai
LIVCHAT_API_KEY=lc_live_xxx
```

**Critério de aceite:**
- [ ] `uv run uvicorn src.service:app` inicia com DATABASE_TYPE=postgres
- [ ] `curl -X POST http://localhost:8080/invoke -d '{"message":"oi"}'` persiste checkpoint
- [ ] Tabelas `checkpoints`, `checkpoint_blobs` criadas no Neon

---

### Fase 2: Agents e Tools

#### Task 2.1: Criar Ivy Agent

**Arquivo:** `ast/src/agents/ivy_agent.py`

```python
from langchain_core.messages import BaseMessage, SystemMessage
from langchain_core.runnables import RunnableConfig
from langgraph.func import entrypoint

from core import get_model, settings

IVY_SYSTEM_PROMPT = """Você é a Ivy, assistente AI do LivChat.

## Sobre o LivChat
- Plataforma de WhatsApp API para desenvolvedores
- Conecta múltiplas instâncias WhatsApp
- API REST para enviar/receber mensagens
- Webhooks para eventos em tempo real

## Seu Papel
Ajude usuários com:
- Dúvidas sobre a API e integração
- Configuração de instâncias e webhooks
- Troubleshooting de problemas
- Explicação de features e limites

## Estilo
- Seja concisa e técnica
- Use exemplos de código quando relevante
- Sugira próximos passos
- Se não souber, admita e sugira documentação

## Contexto do Usuário
- Plano: {plan}
- Instâncias: {instances_count}
"""


@entrypoint()
async def ivy_agent(
    inputs: dict[str, list[BaseMessage]],
    *,
    previous: dict[str, list[BaseMessage]],
    config: RunnableConfig,
):
    """Ivy - Assistente AI do LivChat."""
    messages = inputs["messages"]
    if previous:
        messages = previous["messages"] + messages

    # Contexto do usuário via config
    user_ctx = config["configurable"].get("user_context", {})
    system = IVY_SYSTEM_PROMPT.format(
        plan=user_ctx.get("plan", "free"),
        instances_count=user_ctx.get("instances_count", 0),
    )

    full_messages = [SystemMessage(content=system)] + messages

    model_name = config["configurable"].get("model", settings.DEFAULT_MODEL)
    model = get_model(model_name)

    response = await model.ainvoke(full_messages)

    return entrypoint.final(
        value={"messages": [response]},
        save={"messages": messages + [response]}
    )
```

**Critério de aceite:**
- [ ] `curl -X POST /ivy/invoke -d '{"message":"o que é o livchat?"}'` retorna resposta
- [ ] `curl -X POST /ivy/stream` retorna tokens SSE

---

#### Task 2.2: Criar Tool send_whatsapp

**Arquivo:** `ast/src/tools/livchat_tools.py`

```python
from langchain_core.tools import tool
import httpx

from core import settings


@tool
async def send_whatsapp(phone: str, message: str) -> str:
    """Envia mensagem WhatsApp via LivChat API.

    Use para enviar respostas ao usuário via WhatsApp.

    Args:
        phone: Número do telefone (formato: 5511999999999)
        message: Conteúdo da mensagem

    Returns:
        str: Confirmação de envio ou erro
    """
    api_url = settings.LIVCHAT_API_URL
    api_key = settings.LIVCHAT_API_KEY.get_secret_value()

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{api_url}/api/v1/messages/send",
                json={"phone": phone, "message": message},
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                timeout=30.0
            )
            response.raise_for_status()
            data = response.json()
            return f"Mensagem enviada. ID: {data.get('messageId', 'ok')}"
    except httpx.HTTPError as e:
        return f"Erro ao enviar: {str(e)}"
```

**Adicionar em `ast/src/core/settings.py`:**

```python
# LivChat Integration
LIVCHAT_API_URL: str = "https://livchat.ai"
LIVCHAT_API_KEY: SecretStr | None = None
```

**Critério de aceite:**
- [ ] Tool importa sem erros
- [ ] Docstring aparece corretamente no schema do agent

---

#### Task 2.3: Criar WhatsApp Agent

**Arquivo:** `ast/src/agents/whatsapp_agent.py`

```python
from typing import Literal

from langchain_core.messages import SystemMessage
from langgraph.graph import END, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode

from core import get_model, settings
from tools.livchat_tools import send_whatsapp

SYSTEM_PROMPT = """Você é um assistente de suporte do LivChat via WhatsApp.

O usuário está conversando via WhatsApp. Você deve:
- Responder de forma clara e concisa
- Usar linguagem informal mas profissional
- Enviar a resposta usando o tool send_whatsapp

Informações do Usuário:
- Telefone: {phone}
- Nome: {name}

IMPORTANTE: Sempre use send_whatsapp para enviar sua resposta.
"""

tools = [send_whatsapp]


async def call_model(state: MessagesState, config):
    model = get_model(config["configurable"].get("model", "gpt-4o-mini"))
    bound = model.bind_tools(tools)

    sender = config["configurable"].get("sender", {})
    system = SYSTEM_PROMPT.format(
        phone=sender.get("phone", "unknown"),
        name=sender.get("name", "Usuário"),
    )

    messages = [SystemMessage(content=system)] + state["messages"]
    response = await bound.ainvoke(messages)
    return {"messages": [response]}


def should_continue(state: MessagesState) -> Literal["tools", "end"]:
    last = state["messages"][-1]
    if hasattr(last, "tool_calls") and last.tool_calls:
        return "tools"
    return "end"


# Graph
graph = StateGraph(MessagesState)
graph.add_node("model", call_model)
graph.add_node("tools", ToolNode(tools))
graph.set_entry_point("model")
graph.add_conditional_edges("model", should_continue, {"tools": "tools", "end": END})
graph.add_edge("tools", "model")

whatsapp_agent = graph.compile()
```

**Critério de aceite:**
- [ ] Agent executa e chama tool send_whatsapp
- [ ] Response inclui resultado da tool

---

#### Task 2.4: Registrar Agents

**Arquivo:** `ast/src/agents/agents.py` (modificar)

```python
from agents.ivy_agent import ivy_agent
from agents.whatsapp_agent import whatsapp_agent

agents: dict[str, Agent] = {
    # ... agents existentes ...

    "ivy": Agent(
        description="Ivy - Assistente AI do LivChat. Ajuda com API, integração e troubleshooting.",
        graph_like=ivy_agent,
    ),
    "whatsapp": Agent(
        description="WhatsApp Agent - Responde mensagens e envia via send_whatsapp tool.",
        graph_like=whatsapp_agent,
    ),
}
```

**Critério de aceite:**
- [ ] `curl /info` lista agents ivy e whatsapp
- [ ] `curl /ivy/stream` funciona
- [ ] `curl /whatsapp/invoke` executa e chama tool

---

### Fase 3: PartyKit Server

#### Task 3.1: Criar projeto PartyKit

**Estrutura:**
```
partykit/
├── src/
│   └── ivy-chat.ts
├── package.json
├── partykit.json
└── tsconfig.json
```

**Arquivo:** `partykit/package.json`
```json
{
  "name": "livchat-partykit",
  "version": "0.1.0",
  "scripts": {
    "dev": "partykit dev",
    "deploy": "partykit deploy"
  },
  "dependencies": {
    "partykit": "^0.0.111"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

**Arquivo:** `partykit/partykit.json`
```json
{
  "name": "livchat-ivy",
  "main": "src/ivy-chat.ts",
  "compatibilityDate": "2024-12-01"
}
```

**Arquivo:** `partykit/tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

**Critério de aceite:**
- [ ] `cd partykit && npm install` instala
- [ ] Estrutura de arquivos criada

---

#### Task 3.2: Implementar Ivy Chat Server

**Arquivo:** `partykit/src/ivy-chat.ts`

```typescript
import type * as Party from "partykit/server";

interface ClientMessage {
  type: "message";
  content: string;
  threadId?: string;
  userContext?: Record<string, unknown>;
}

interface ServerMessage {
  type: "token" | "done" | "error" | "streaming" | "message";
  content?: string;
  role?: "user" | "assistant";
  isStreaming?: boolean;
}

export default class IvyChatServer implements Party.Server {
  private isStreaming = false;

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection) {
    conn.send(JSON.stringify({ type: "streaming", isStreaming: this.isStreaming }));
  }

  async onMessage(msg: string, sender: Party.Connection) {
    const data = JSON.parse(msg) as ClientMessage;

    if (data.type === "message" && data.content) {
      await this.handleMessage(data.content, data.threadId, data.userContext);
    }
  }

  private async handleMessage(
    content: string,
    threadId?: string,
    userContext?: Record<string, unknown>
  ) {
    if (this.isStreaming) {
      this.broadcast({ type: "error", content: "Already processing" });
      return;
    }

    // User message
    this.broadcast({ type: "message", role: "user", content });

    // Start streaming
    this.isStreaming = true;
    this.broadcast({ type: "streaming", isStreaming: true });

    try {
      await this.streamFromAST(content, threadId, userContext);
    } catch (err) {
      this.broadcast({
        type: "error",
        content: err instanceof Error ? err.message : "Unknown error"
      });
    } finally {
      this.isStreaming = false;
      this.broadcast({ type: "streaming", isStreaming: false });
    }
  }

  private async streamFromAST(
    message: string,
    threadId?: string,
    userContext?: Record<string, unknown>
  ) {
    const astUrl = this.room.env.AST_SERVICE_URL as string;
    const astToken = this.room.env.AST_SERVICE_TOKEN as string;

    const response = await fetch(`${astUrl}/ivy/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${astToken}`,
      },
      body: JSON.stringify({
        message,
        thread_id: threadId || `ivy_${this.room.id}`,
        stream_tokens: true,
        agent_config: { user_context: userContext },
      }),
    });

    if (!response.ok) {
      throw new Error(`AST error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";
    let fullContent = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;

        try {
          const event = JSON.parse(data);
          if (event.type === "token" && event.content) {
            fullContent += event.content;
            this.broadcast({ type: "token", content: event.content });
          }
        } catch {
          // Ignore parse errors
        }
      }
    }

    this.broadcast({ type: "done", content: fullContent });
  }

  private broadcast(msg: ServerMessage) {
    this.room.broadcast(JSON.stringify(msg));
  }
}
```

**Critério de aceite:**
- [ ] `npm run dev` inicia PartyKit local
- [ ] WebSocket conecta em `ws://localhost:1999/party/test`
- [ ] Mensagem enviada retorna tokens

---

### Fase 4: Integração LivChat App

#### Task 4.1: Endpoint /api/v1/messages/send

**Arquivo:** `app/src/app/api/v1/messages/send/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { instances } from "@/server/db/schema";
import { validateAndResolveInstance } from "@/server/lib/api-key";
import { WuzAPIClient } from "@/server/lib/wuzapi";
import { logEvent } from "@/server/lib/events";
import { eq } from "drizzle-orm";
import { env } from "@/env";

export async function POST(req: NextRequest) {
  try {
    // 1. Validar API key
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing authorization" }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const apiKey = await validateAndResolveInstance(token);
    if (!apiKey) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }

    // 2. Parse body
    const body = await req.json();
    const { phone, message, instanceId } = body;

    if (!phone || !message) {
      return NextResponse.json({ error: "Missing phone or message" }, { status: 400 });
    }

    // 3. Resolver instância
    const targetId = instanceId || apiKey.instanceId;
    const instance = await db.query.instances.findFirst({
      where: eq(instances.id, targetId),
    });

    if (!instance || instance.status !== "connected") {
      return NextResponse.json({ error: "Instance not connected" }, { status: 400 });
    }

    // 4. Enviar via WuzAPI
    const wuzapi = new WuzAPIClient(env.WUZAPI_URL, instance.providerToken);
    const result = await wuzapi.sendText(phone, message);

    // 5. Log evento (fire-and-forget)
    logEvent({
      name: "message.sent",
      instanceId: instance.id,
      organizationId: instance.organizationId,
      apiKeyId: apiKey.keyId,
      metadata: { messageId: result.Id, to: phone, source: "ast" },
    }).catch(console.error);

    return NextResponse.json({
      success: true,
      messageId: result.Id,
      timestamp: result.Timestamp,
    });
  } catch (error) {
    console.error("[/api/v1/messages/send]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Critério de aceite:**
- [ ] `curl -X POST /api/v1/messages/send -H "Authorization: Bearer lc_live_xxx"` envia mensagem
- [ ] Evento `message.sent` logado com `source: "ast"`

---

#### Task 4.2: Tabela workflow_configs

**Arquivo:** `app/src/server/db/schema.ts` (adicionar)

```typescript
export const workflowConfigs = pgTable("workflow_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),

  astWorkflowId: text("ast_workflow_id").notNull(),
  astApiKey: text("ast_api_key").notNull(),
  livchatApiKey: text("livchat_api_key").notNull(),

  triggerType: text("trigger_type").default("message.received"),
  instanceIds: uuid("instance_ids").array(),
  filterType: text("filter_type"),
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

**Critério de aceite:**
- [ ] `bun run db:push` cria tabela
- [ ] Schema aparece no Neon

---

#### Task 4.3: Trigger AST no webhook

**Arquivo:** `app/src/app/api/webhooks/wuzapi/route.ts` (modificar)

Adicionar após logging do evento:

```typescript
// Trigger AST workflow (fire-and-forget)
if (mappedType === "MESSAGE_RECEIVED" && instance.organizationId) {
  triggerASTWorkflow(instance, messageData).catch((err) => {
    console.error("[AST Trigger]", err);
  });
}

// Nova função no mesmo arquivo
async function triggerASTWorkflow(
  instance: typeof instances.$inferSelect,
  data: { body: string; sender: string; senderName: string; chat: string }
) {
  const config = await db.query.workflowConfigs.findFirst({
    where: and(
      eq(workflowConfigs.organizationId, instance.organizationId!),
      eq(workflowConfigs.isActive, true),
    ),
  });

  if (!config) return;

  fetch(`${env.AST_SERVICE_URL}/whatsapp/invoke`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.astApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: data.body,
      thread_id: data.chat,
      agent_config: {
        sender: {
          phone: data.sender.replace("@s.whatsapp.net", ""),
          name: data.senderName,
        },
      },
    }),
  });
}
```

**Adicionar imports:**
```typescript
import { workflowConfigs } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";
```

**Critério de aceite:**
- [ ] Mensagem recebida dispara call para AST
- [ ] Logs mostram trigger sendo feito

---

#### Task 4.4: Conectar Ivy UI ao PartyKit

**Arquivo:** `app/src/components/ai-chat/ai-chat-provider.tsx` (modificar)

```typescript
"use client";

import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react";
import PartySocket from "partysocket";

// ... tipos existentes ...

export function AiChatProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState<string | null>(null);

  const socketRef = useRef<PartySocket | null>(null);
  const threadIdRef = useRef<string>(`ivy_${Date.now()}`);

  useEffect(() => {
    const host = process.env.NEXT_PUBLIC_PARTYKIT_HOST;
    if (!host) return;

    const socket = new PartySocket({
      host,
      room: threadIdRef.current,
    });

    socket.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);

      switch (msg.type) {
        case "token":
          setStreamingContent((prev) => (prev || "") + msg.content);
          break;
        case "done":
          setMessages((prev) => [
            ...prev,
            { id: crypto.randomUUID(), role: "assistant", content: msg.content, timestamp: new Date() },
          ]);
          setStreamingContent(null);
          setIsLoading(false);
          break;
        case "streaming":
          setIsLoading(msg.isStreaming);
          if (!msg.isStreaming) setStreamingContent(null);
          break;
        case "error":
          console.error("[Ivy]", msg.content);
          setIsLoading(false);
          setStreamingContent(null);
          break;
      }
    });

    socketRef.current = socket;
    return () => socket.close();
  }, []);

  const sendMessage = async (content: string) => {
    if (!socketRef.current || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setStreamingContent("");

    socketRef.current.send(JSON.stringify({
      type: "message",
      content,
      threadId: threadIdRef.current,
      userContext: {
        plan: "free", // TODO: get from user context
        instances_count: 0,
      },
    }));
  };

  // ... resto do provider ...
}
```

**Adicionar dependência:**
```bash
cd app && bun add partysocket
```

**Adicionar env:**
```env
NEXT_PUBLIC_PARTYKIT_HOST=localhost:1999
```

**Critério de aceite:**
- [ ] Ivy UI conecta ao PartyKit
- [ ] Mensagem enviada retorna streaming
- [ ] Tokens aparecem um a um

---

### Fase 5: Deploy

#### Task 5.1: Deploy AST no Fly.io

```bash
cd /home/pedro/dev/sandbox/livchat/ast
fly launch --name livchat-ast --region gru
fly secrets set \
  DATABASE_TYPE=postgres \
  POSTGRES_USER=xxx \
  POSTGRES_PASSWORD=xxx \
  POSTGRES_HOST=xxx \
  POSTGRES_PORT=5432 \
  POSTGRES_DB=neondb \
  OPENAI_API_KEY=sk-xxx \
  AUTH_SECRET=ast_secret_xxx \
  LIVCHAT_API_URL=https://livchat.ai \
  LIVCHAT_API_KEY=lc_live_xxx
fly deploy
```

**Critério de aceite:**
- [ ] `curl https://livchat-ast.fly.dev/info` retorna agents
- [ ] `curl https://livchat-ast.fly.dev/ivy/stream` funciona

---

#### Task 5.2: Deploy PartyKit

```bash
cd /home/pedro/dev/sandbox/livchat/partykit
npx partykit deploy
```

Ou via Fly.io se preferir.

**Critério de aceite:**
- [ ] WebSocket conecta em produção
- [ ] Streaming funciona end-to-end

---

## Critérios de Conclusão

### Funcional
- [ ] Ivy responde no dashboard com streaming
- [ ] WhatsApp Agent responde mensagens automaticamente
- [ ] Tool send_whatsapp envia mensagens via LivChat API
- [ ] Memória de conversas persistida (checkpoints)

### Build & Testes
- [ ] `cd ast && uv run pytest` passa
- [ ] `cd app && bun test` passa
- [ ] `cd app && bun run build` sem erros

### Performance
- [ ] Ivy responde em < 3s (primeiro token)
- [ ] WhatsApp auto-response em < 10s

### Segurança
- [ ] AST autenticado via AUTH_SECRET
- [ ] API keys validadas no /api/v1/messages/send
- [ ] Sem credenciais expostas

---

## Variáveis de Ambiente

### LivChat App (.env)
```env
# AST
AST_SERVICE_URL=https://livchat-ast.fly.dev
AST_SERVICE_TOKEN=ast_secret_xxx

# PartyKit
NEXT_PUBLIC_PARTYKIT_HOST=livchat-ivy.partykit.dev
```

### AST Service (.env)
```env
# Server
HOST=0.0.0.0
PORT=8080
AUTH_SECRET=ast_secret_xxx

# Database
DATABASE_TYPE=postgres
POSTGRES_USER=xxx
POSTGRES_PASSWORD=xxx
POSTGRES_HOST=xxx
POSTGRES_PORT=5432
POSTGRES_DB=neondb

# LLM
OPENAI_API_KEY=sk-xxx
DEFAULT_MODEL=gpt-4o-mini

# LivChat
LIVCHAT_API_URL=https://livchat.ai
LIVCHAT_API_KEY=lc_live_xxx
```

### PartyKit (partykit.json vars)
```json
{
  "vars": {
    "AST_SERVICE_URL": "https://livchat-ast.fly.dev",
    "AST_SERVICE_TOKEN": "ast_secret_xxx"
  }
}
```

---

## Checklist Final

- [ ] AST Service rodando no Fly.io
- [ ] Database Neon criado e conectado
- [ ] Agents ivy e whatsapp funcionando
- [ ] Tool send_whatsapp integrada
- [ ] PartyKit deployado
- [ ] Ivy UI conectada com streaming
- [ ] Endpoint /api/v1/messages/send funcionando
- [ ] Tabela workflow_configs criada
- [ ] Webhook trigger implementado
- [ ] Testes passando

---

## Próximos Passos (Plan 11)

- [ ] Acumulador de mensagens (Redis)
- [ ] Dashboard de execuções
- [ ] Múltiplas tools (search_docs, check_status)
- [ ] UI para configurar workflows
- [ ] Human escalation
