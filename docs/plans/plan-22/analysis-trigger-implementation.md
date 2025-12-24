# Plan 22: Análise de Implementação de Triggers

## Status: ANÁLISE

Data: 2024-12-24

---

## 1. Estado Atual do Sistema

### 1.1 Workflow Ivy Atual

```python
# Estrutura atual (ast/src/seeds/__init__.py)
{
    "id": "wf_ivy",
    "name": "Ivy",
    "flowData": {
        "nodes": [
            {
                "id": "agent-1",
                "type": "agent",
                "config": {
                    "prompt": { "system": "..." },
                    "llm": { "model": "gemini-3-flash-preview" },
                    "memory": { "tokenLimit": 16000 }
                }
            }
        ],
        "edges": []  # Sem edges - workflow linear
    }
}
```

**Características:**
- Single node (apenas agent)
- Sem triggers explícitos
- Sem edges (linear)
- Sem node de "fim" ou "output"

### 1.2 Fluxo de Execução Atual

```
┌─────────────────────────────────────────────────────────────────────┐
│                      FLUXO ATUAL (Streaming)                        │
└─────────────────────────────────────────────────────────────────────┘

[React Client]
    │ WebSocket connect
    ▼
[PartyKit Server] ─────── mantém state in-memory (messages[])
    │ HTTP POST /workflows/wf_ivy/stream
    ▼
[AST workflow_router.py]
    │ agent.astream_events()
    ▼
[workflow_agent.py]
    │ model.ainvoke() + checkpointing
    ▼
[LLM Provider] (Gemini)
    │ streaming tokens
    ▼
[workflow_agent.py]
    │ SSE events (token, complete, done)
    ▼
[PartyKit Server]
    │ WebSocket broadcast
    ▼
[React Client] ─────── exibe tokens em tempo real
```

**Importante:**
- **NÃO é fire-and-forget** - aguarda resposta completa
- **Retorno é a resposta do agent** - não há "node de output" separado

### 1.3 Como o Frontend Invoca

```typescript
// tRPC ivy.send (síncrono)
const response = await ast.invoke(workflowId, { message, threadId });
return { response: response.message.content };

// API route /api/ivy/stream (streaming)
const stream = await ast.stream(workflowId, { message, threadId });
// Transforma SSE em Response
```

**O retorno sempre é a resposta do último node executado.**

---

## 2. Problemas Identificados

### 2.1 Eventos de Conexão vs Mensagem

| Evento | Tem instanceId? | Tem sender? | Tem mensagem? |
|--------|-----------------|-------------|---------------|
| `connection.connected` | Sim (via lookup) | Não | Não |
| `message.received` | Sim | Sim | Sim |

**Problema:** Um trigger configurável único não faz sentido para ambos os eventos porque têm payloads completamente diferentes.

### 2.2 Diferença de Fluxo

**Chat Ivy (atual):**
```
Input: mensagem do user
Output: resposta do agent (retornada ao frontend)
```

**Trigger WhatsApp (novo):**
```
Input: evento do WuzAPI (conexão ou mensagem)
Output: ??? (precisa ENVIAR mensagem, não retornar)
```

### 2.3 O Problema do "Output"

No fluxo atual, o resultado do workflow é **retornado** para quem chamou:
```python
return entrypoint.final(
    value={"messages": [response]},  # ← Retorna para o caller
    save={"messages": all_messages}
)
```

No fluxo com trigger, o resultado precisa ser **enviado** para algum lugar:
```
Agent responde → Node "Send WhatsApp" → WuzAPI → WhatsApp
                        ↓
                 Não há "retorno" para o caller
```

---

## 3. Análise: Tipos de Trigger

### 3.1 Opção A: Um Node Trigger Configurável

```
┌─────────────────────────────────────────────┐
│  WhatsApp Trigger                           │
│                                             │
│  Eventos: [ ] connected  [x] message        │
│  Instâncias: [Ivy]                          │
│  Filtros: isFromMe=false                    │
└─────────────────────────────────────────────┘
```

**Problemas:**
- Eventos têm payloads diferentes
- Filtros de mensagem não aplicam para conexão
- Confuso para o usuário

**Veredito:** ❌ Não recomendado

### 3.2 Opção B: Triggers Separados por Tipo

```
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│  WhatsApp           │  │  WhatsApp           │  │  Manual             │
│  Connection Trigger │  │  Message Trigger    │  │  Trigger            │
│                     │  │                     │  │                     │
│  Eventos:           │  │  Instâncias: [...]  │  │  (para testes/UI)   │
│  ○ connected        │  │  isFromMe: [...]    │  │                     │
│  ○ disconnected     │  │  isGroup: [...]     │  │                     │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘
```

**Vantagens:**
- Cada trigger tem config específica
- Mais claro para o usuário
- Validações específicas por tipo

**Veredito:** ✅ Recomendado

### 3.3 Lista de Triggers Propostos

| Trigger | Escopo | Configuração |
|---------|--------|--------------|
| `manual_trigger` | Qualquer | Nenhuma (botão de teste) |
| `whatsapp_connection_trigger` | Global (admin) | eventos: connected/disconnected |
| `whatsapp_message_trigger` | Org/Global | instanceIds, isFromMe, isGroup |
| `schedule_trigger` | Org | cron expression |
| `webhook_trigger` | Org | path, method, headers |

---

## 4. Análise: Fluxo de Output

### 4.1 Problema Central

**Hoje:**
```
invoke() → workflow executa → RETORNA resposta
```

**Com trigger:**
```
trigger dispara → workflow executa → ???
                                     ↳ Retorna para quem? (não há caller)
                                     ↳ Precisa ENVIAR mensagem
```

### 4.2 Opção A: Node "Send" como Último Node

```
[Trigger] → [Agent] → [Send WhatsApp]
                            ↓
                      POST /api/v1/messages/send
                            ↓
                      WuzAPI → WhatsApp
```

**Problema:** E se quiser TAMBÉM retornar para o frontend (chat UI)?

### 4.3 Opção B: Node "Output" Genérico

```
[Trigger] → [Agent] → [Output]
                         │
                    ┌────┴────┐
                    │ config  │
                    │         │
                    │ type:   │
                    │ "return"│ ← Para frontend
                    │ "send"  │ ← Para WhatsApp
                    │ "both"  │ ← Ambos
                    └─────────┘
```

**Vantagens:**
- Flexível
- Um workflow pode ter múltiplos outputs

### 4.4 Opção C: Router/Condition Node

```
[Trigger] → [Agent] → [Condition]
                          │
              ┌───────────┼───────────┐
              │           │           │
              ▼           ▼           ▼
         [Return]   [Send WA]    [Both]
```

**Vantagens:**
- Pode ter lógica condicional
- Mais explícito

### 4.5 Opção D: Múltiplos Outputs Paralelos

```
[Trigger] → [Agent] ─┬─→ [Send WhatsApp]
                     │
                     └─→ [Return/End]
```

**No LangGraph:**
```python
# Edges podem ter múltiplos targets
edges = [
    {"source": "agent-1", "target": "send-whatsapp"},
    {"source": "agent-1", "target": "output"}
]
```

**Vantagens:**
- Pattern suportado pelo LangGraph
- Execução paralela

---

## 5. Análise: Compatibilidade com Fluxo Atual

### 5.1 Ivy Chat (Frontend) - Deve Continuar Funcionando

```
┌─────────────────────────────────────────────────────────────────────┐
│  WORKFLOW: wf_ivy (com triggers)                                    │
│                                                                     │
│  ┌──────────────┐                                                   │
│  │ Manual       │───┐                                               │
│  │ Trigger      │   │                                               │
│  └──────────────┘   │                                               │
│                     │      ┌──────────────┐      ┌──────────────┐   │
│  ┌──────────────┐   ├─────▶│ Ivy Agent    │─────▶│ Output       │   │
│  │ WA Message   │───┘      │              │      │ (return)     │   │
│  │ Trigger      │          └──────────────┘      └──────────────┘   │
│  └──────────────┘                                                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Para o frontend:**
- Usa `invoke()` ou `stream()` como hoje
- Internamente é como se fosse "manual trigger"
- Output node retorna a resposta

### 5.2 Ivy Onboarding (Trigger) - Novo

```
┌─────────────────────────────────────────────────────────────────────┐
│  WORKFLOW: wf_ivy_onboarding                                        │
│                                                                     │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐       │
│  │ WA Connected │─────▶│ Ivy Agent    │─────▶│ Send WA      │       │
│  │ Trigger      │      │              │      │ (ivy inst)   │       │
│  └──────────────┘      └──────────────┘      └──────────────┘       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Fluxo:**
1. WuzAPI emite `Connected`
2. LivChat roteia para AST
3. AST executa workflow
4. Node "Send WA" envia mensagem
5. Não há retorno (fire-and-forget do ponto de vista do LivChat)

### 5.3 Ivy Chat via WhatsApp (Novo) - Responde Mensagens

```
┌─────────────────────────────────────────────────────────────────────┐
│  WORKFLOW: wf_ivy_whatsapp                                          │
│                                                                     │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐       │
│  │ WA Message   │─────▶│ Ivy Agent    │─────▶│ Send WA      │       │
│  │ Trigger      │      │              │      │ (reply)      │       │
│  │ inst: ivy    │      │              │      │              │       │
│  └──────────────┘      └──────────────┘      └──────────────┘       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. Proposta de Schema

### 6.1 Trigger Nodes

```typescript
// Manual Trigger
{
    "id": "trigger-manual",
    "type": "manual_trigger",
    "name": "Manual Trigger",
    "config": {}  // Sem config
}

// WhatsApp Connection Trigger
{
    "id": "trigger-wa-conn",
    "type": "whatsapp_connection_trigger",
    "name": "WhatsApp Conectado",
    "config": {
        "events": ["connected"],  // ou ["disconnected"] ou ambos
        "scope": "global"  // ou "organization"
    }
}

// WhatsApp Message Trigger
{
    "id": "trigger-wa-msg",
    "type": "whatsapp_message_trigger",
    "name": "Mensagem Recebida",
    "config": {
        "instanceIds": ["inst_ivy"],  // ou null para todas
        "filters": {
            "isFromMe": false,
            "isGroup": false
        }
    }
}
```

### 6.2 Output Nodes

```typescript
// Return (para frontend)
{
    "id": "output-return",
    "type": "output_return",
    "name": "Retornar Resposta",
    "config": {}
}

// Send WhatsApp
{
    "id": "output-send-wa",
    "type": "output_send_whatsapp",
    "name": "Enviar WhatsApp",
    "config": {
        "instanceId": "{{env.IVY_INSTANCE_ID}}",  // ou específico
        "to": "{{trigger.sender}}",  // variável do trigger
        "message": "{{agent.response}}"  // variável do agent
    }
}
```

### 6.3 Variáveis de Template

| Variável | Disponível em | Descrição |
|----------|---------------|-----------|
| `{{trigger.event}}` | Após trigger | Tipo do evento |
| `{{trigger.instanceId}}` | Após trigger | ID da instância |
| `{{trigger.sender}}` | Após WA message | JID do remetente |
| `{{trigger.message}}` | Após WA message | Texto da mensagem |
| `{{agent.response}}` | Após agent | Resposta do agent |
| `{{env.IVY_INSTANCE_ID}}` | Qualquer | Variável de ambiente |

---

## 7. Diferença: invoke/stream vs trigger

### 7.1 Tabela Comparativa

| Aspecto | invoke/stream | trigger |
|---------|---------------|---------|
| **Iniciador** | Frontend/API | Evento externo |
| **Aguarda resposta** | Sim | Não (fire-and-forget) |
| **Retorno** | Resposta do agent | Nenhum (envia para output) |
| **Thread** | Passado pelo caller | Gerado automaticamente |
| **Uso** | Chat UI | Automações |

### 7.2 Implementação no AST

```python
# workflow_router.py

@router.post("/{workflow_id}/invoke")
async def invoke_workflow(workflow_id: str, input_data: InvokeInput):
    """Execução síncrona - aguarda e retorna resposta."""
    result = await execute_workflow(workflow_id, input_data, mode="sync")
    return {"message": result.messages[-1].content}

@router.post("/{workflow_id}/stream")
async def stream_workflow(workflow_id: str, input_data: StreamInput):
    """Execução streaming - retorna SSE."""
    return StreamingResponse(
        execute_workflow_stream(workflow_id, input_data),
        media_type="text/event-stream"
    )

@router.post("/{workflow_id}/trigger")
async def trigger_workflow(workflow_id: str, input_data: TriggerInput):
    """Execução fire-and-forget - retorna imediatamente."""
    background_tasks.add_task(
        execute_workflow, workflow_id, input_data, mode="async"
    )
    return {"status": "triggered", "workflow_id": workflow_id}
```

### 7.3 Diferença na Execução

```python
# workflow_agent.py

async def execute_workflow(workflow_id, input_data, mode):
    # ... executa nodes ...

    # Processa output nodes
    for output_node in output_nodes:
        if output_node.type == "output_return":
            # Só executa se mode == "sync"
            if mode == "sync":
                return response

        elif output_node.type == "output_send_whatsapp":
            # Sempre executa
            await send_whatsapp_message(
                instance_id=output_node.config.instanceId,
                to=output_node.config.to,
                message=agent_response
            )

    # Se mode == "async", não retorna nada
    if mode == "async":
        return None
```

---

## 8. Workflow Unificado vs Separados

### 8.1 Opção A: Um Workflow Ivy com Múltiplos Triggers

```
┌─────────────────────────────────────────────────────────────────────┐
│  WORKFLOW: wf_ivy (unificado)                                       │
│                                                                     │
│  ┌──────────────┐                                                   │
│  │ Manual       │───┐                                               │
│  │ Trigger      │   │                                               │
│  └──────────────┘   │                                               │
│                     │                                               │
│  ┌──────────────┐   │      ┌──────────────┐                         │
│  │ WA Message   │───┼─────▶│ Ivy Agent    │──┬──▶ [Return]          │
│  │ Trigger      │   │      │              │  │                      │
│  └──────────────┘   │      └──────────────┘  └──▶ [Send WA]         │
│                     │                                               │
│  ┌──────────────┐   │                                               │
│  │ WA Connected │───┘                                               │
│  │ Trigger      │                                                   │
│  └──────────────┘                                                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Problemas:**
- Prompt da Ivy precisa ser diferente para cada trigger
- "Responda a mensagem" vs "Dê boas-vindas"
- Output também é diferente (return vs send)

### 8.2 Opção B: Workflows Separados (Recomendado)

```
┌───────────────────────────────┐
│  wf_ivy_chat                  │   ← Para frontend (chat UI)
│                               │
│  [Manual] → [Ivy Agent] → [Return]
└───────────────────────────────┘

┌───────────────────────────────┐
│  wf_ivy_onboarding            │   ← Quando user conecta
│                               │
│  [WA Connected] → [Ivy Onboarding Agent] → [Send WA]
└───────────────────────────────┘

┌───────────────────────────────┐
│  wf_ivy_whatsapp              │   ← Quando user manda msg para Ivy
│                               │
│  [WA Message] → [Ivy Chat Agent] → [Send WA]
└───────────────────────────────┘
```

**Vantagens:**
- Cada workflow tem propósito claro
- Prompts específicos
- Outputs específicos
- Mais fácil de debugar

---

## 9. Questão: Quem Dispara os Triggers?

### 9.1 Manual Trigger

```
Frontend → invoke()/stream() → AST
```
- Disparado pelo frontend via HTTP
- AST recebe e executa

### 9.2 WhatsApp Triggers

```
WuzAPI → LivChat → AST
```
- WuzAPI envia webhook para LivChat
- LivChat roteia para AST via `/trigger`

**Quem decide qual workflow acionar?**

**Opção A: LivChat decide (Recomendado)**
```
LivChat tem tabela workflow_triggers
LivChat faz match: evento → workflows
LivChat dispara cada workflow via /trigger
```

**Opção B: AST decide**
```
LivChat envia evento genérico para AST
AST busca workflows que escutam esse evento
AST executa cada um
```

**Por que Opção A:**
- LivChat já tem contexto (org, user, permissions)
- Mais fácil fazer rate limit
- Auditoria centralizada

---

## 10. Resumo das Decisões Pendentes

| # | Questão | Opções | Recomendação |
|---|---------|--------|--------------|
| 1 | Trigger único ou separados? | A: Um node / B: Separados | **B: Separados** |
| 2 | Output único ou separados? | A: Um node / B: Separados | **B: Separados** |
| 3 | Workflow único ou separados? | A: Um / B: Vários | **B: Vários** |
| 4 | Quem roteia triggers? | A: LivChat / B: AST | **A: LivChat** |
| 5 | Fire-and-forget? | A: Sim / B: Aguarda | **A: Sim (para triggers)** |

---

## 11. Próximos Passos

Após validar as decisões acima:

1. **Definir schema final** dos nodes de trigger e output
2. **Implementar no AST:**
   - Endpoint `/trigger`
   - Novos tipos de nodes
   - Execução condicional baseada em mode
3. **Implementar no LivChat:**
   - Tabela `workflow_triggers`
   - Routing no webhook handler
4. **Criar workflows:**
   - `wf_ivy_chat` (migrar do atual)
   - `wf_ivy_onboarding`
   - `wf_ivy_whatsapp`
5. **Testar integração completa**

---

## Changelog

| Data | Mudança |
|------|---------|
| 2024-12-24 | Documento inicial de análise |
