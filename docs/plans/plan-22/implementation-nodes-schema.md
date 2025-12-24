# Plan 22: Schema de Nodes para Workflow Triggers

## Status: DRAFT

Data: 2024-12-24

---

## 1. Arquitetura de Nodes

### 1.1 Tipos de Nodes

| Tipo | Group | Inputs | Outputs | Descrição |
|------|-------|--------|---------|-----------|
| `manual_trigger` | trigger | 0 | 1 | Trigger via invoke/stream |
| `whatsapp_message_trigger` | trigger | 0 | 1 | Mensagem recebida no WA |
| `whatsapp_connection_trigger` | trigger | 0 | 1 | Instância conectou/desconectou |
| `agent` | action | 1 | 1 | Executa LLM com prompt |
| `router` | logic | 1 | N | Direciona fluxo baseado em condição |
| `respond_webhook` | action | 1 | 1 | Responde ao HTTP request |
| `send_whatsapp` | action | 1 | 1 | Envia mensagem via WA |
| `end` | terminal | 1 | 0 | Finaliza branch do workflow |

### 1.2 Fluxo de Dados

```
Trigger → Agent → Router → [Response/Action] → End
                     │
                     └─→ [Response/Action] → End
```

---

## 2. Schemas Detalhados

### 2.1 Trigger: Manual

```typescript
{
  "id": "trigger-manual",
  "type": "manual_trigger",
  "name": "Manual Trigger",
  "position": { "x": 100, "y": 100 },
  "config": {}
}
```

**Comportamento:**
- Acionado via `POST /workflows/{id}/invoke` ou `/stream`
- Input vem do body da request: `{ message: "..." }`
- Gera state: `{ messages: [HumanMessage(content=message)], source: "manual" }`

### 2.2 Trigger: WhatsApp Message

```typescript
{
  "id": "trigger-wa-message",
  "type": "whatsapp_message_trigger",
  "name": "Mensagem WhatsApp",
  "position": { "x": 100, "y": 200 },
  "config": {
    "instanceIds": ["inst_ivy"],  // null = todas
    "filters": {
      "isFromMe": false,
      "isGroup": false
    }
  }
}
```

**Comportamento:**
- Acionado via `POST /workflows/{id}/trigger`
- Input vem do LivChat: `{ event: "message.received", data: {...} }`
- Gera state:
```python
{
  "messages": [HumanMessage(content=message_text)],
  "source": "whatsapp",
  "trigger_data": {
    "event": "message.received",
    "instanceId": "inst_xxx",
    "sender": "5511999999999",
    "isGroup": false
  }
}
```

### 2.3 Trigger: WhatsApp Connection

```typescript
{
  "id": "trigger-wa-connection",
  "type": "whatsapp_connection_trigger",
  "name": "WhatsApp Conectado",
  "position": { "x": 100, "y": 300 },
  "config": {
    "events": ["connected"]  // ou ["disconnected"] ou ambos
  }
}
```

**Comportamento:**
- Acionado via `POST /workflows/{id}/trigger`
- Input vem do LivChat: `{ event: "connection.connected", data: {...} }`
- Gera state:
```python
{
  "messages": [SystemMessage(content="O usuário João (5511...) conectou a instância 'Minha Loja'")],
  "source": "whatsapp",
  "trigger_data": {
    "event": "connection.connected",
    "instanceId": "inst_xxx",
    "instanceName": "Minha Loja",
    "phone": "5511999999999"
  }
}
```

**Nota:** A mensagem SystemMessage é gerada automaticamente baseada no template configurado.

### 2.4 Agent Node

```typescript
{
  "id": "agent-ivy",
  "type": "agent",
  "name": "Ivy Agent",
  "position": { "x": 300, "y": 200 },
  "config": {
    "prompt": {
      "system": "Você é a Ivy, assistente virtual do LivChat...",
      "variables": ["current_datetime"]
    },
    "llm": {
      "model": "gemini-2.0-flash",
      "provider": "google",
      "temperature": 0.7
    },
    "memory": {
      "type": "buffer",
      "tokenLimit": 16000
    }
  }
}
```

**Comportamento:**
- Recebe state com messages
- Invoca LLM com prompt + history
- Retorna state atualizado:
```python
{
  "messages": [..., AIMessage(content=response)],
  "agent_response": response  # Convenience field
}
```

### 2.5 Router Node (Switch)

```typescript
{
  "id": "router-source",
  "type": "router",
  "name": "Direcionar por Origem",
  "position": { "x": 500, "y": 200 },
  "config": {
    "mode": "expression",  // ou "rules"
    "expression": "state.source",  // Avalia para "manual" ou "whatsapp"
    "outputs": [
      { "key": "manual", "label": "Chat UI" },
      { "key": "whatsapp", "label": "WhatsApp" }
    ],
    "defaultOutput": "manual"
  }
}
```

**Alternativa com Rules (estilo n8n):**

```typescript
{
  "id": "router-source",
  "type": "router",
  "name": "Direcionar por Origem",
  "position": { "x": 500, "y": 200 },
  "config": {
    "mode": "rules",
    "rules": [
      {
        "output": "chat_ui",
        "conditions": {
          "field": "source",
          "operator": "equals",
          "value": "manual"
        }
      },
      {
        "output": "whatsapp",
        "conditions": {
          "field": "source",
          "operator": "equals",
          "value": "whatsapp"
        }
      }
    ],
    "fallbackOutput": "chat_ui"
  }
}
```

**Comportamento:**
- Avalia expressão/regras contra o state
- Retorna `Command(goto=output_key)` (LangGraph pattern)
- Não modifica state

### 2.6 Respond Webhook Node

```typescript
{
  "id": "respond-webhook",
  "type": "respond_webhook",
  "name": "Responder Request",
  "position": { "x": 700, "y": 100 },
  "config": {
    "responseField": "agent_response",  // Campo do state a retornar
    "format": "text"  // ou "json"
  }
}
```

**Comportamento:**
- Marca o state para retorno via HTTP
- Usado quando workflow foi invocado via `invoke` ou `stream`
- Sinaliza: "este é o valor a retornar para o caller"

```python
{
  "messages": [...],
  "_response": {
    "type": "http",
    "body": agent_response,
    "status": 200
  }
}
```

### 2.7 Send WhatsApp Node

```typescript
{
  "id": "send-whatsapp",
  "type": "send_whatsapp",
  "name": "Enviar WhatsApp",
  "position": { "x": 700, "y": 300 },
  "config": {
    "instanceId": "{{env.IVY_INSTANCE_ID}}",  // ou específico
    "to": "{{trigger_data.sender}}",
    "message": "{{agent_response}}"
  }
}
```

**Comportamento:**
- Faz HTTP POST para LivChat API Gateway
- `POST /api/v1/messages/send`
- Template variables são resolvidas do state

```python
# Execução
await http_client.post(
    f"{LIVCHAT_API_URL}/api/v1/messages/send",
    json={
        "instanceId": "inst_internal_ivy",
        "to": "5511999999999",
        "text": "Olá! Bem-vindo ao LivChat..."
    },
    headers={"Authorization": f"Bearer {LIVCHAT_API_KEY}"}
)
```

### 2.8 End Node

```typescript
{
  "id": "end-1",
  "type": "end",
  "name": "Fim",
  "position": { "x": 900, "y": 200 },
  "config": {}
}
```

**Comportamento:**
- Node terminal (sem outputs)
- Sinaliza fim de uma branch
- No LangGraph: `builder.add_edge(node_id, END)`

---

## 3. Edges/Connections

### 3.1 Schema

```typescript
interface WorkflowEdge {
  id: string;
  source: string;       // Node ID de origem
  target: string;       // Node ID de destino
  sourceHandle?: string; // Output específico (para router)
  targetHandle?: string; // Input específico (geralmente null)
}
```

### 3.2 Exemplo Completo

```typescript
{
  "edges": [
    // Triggers → Agent
    { "id": "e1", "source": "trigger-manual", "target": "agent-ivy" },
    { "id": "e2", "source": "trigger-wa-message", "target": "agent-ivy" },
    { "id": "e3", "source": "trigger-wa-connection", "target": "agent-ivy" },

    // Agent → Router
    { "id": "e4", "source": "agent-ivy", "target": "router-source" },

    // Router → Outputs (sourceHandle especifica qual saída)
    { "id": "e5", "source": "router-source", "target": "respond-webhook", "sourceHandle": "manual" },
    { "id": "e6", "source": "router-source", "target": "send-whatsapp", "sourceHandle": "whatsapp" },

    // Outputs → End
    { "id": "e7", "source": "respond-webhook", "target": "end-1" },
    { "id": "e8", "source": "send-whatsapp", "target": "end-2" }
  ]
}
```

---

## 4. State Schema

### 4.1 Workflow State (AST)

```python
from typing import TypedDict, Literal
from langchain_core.messages import BaseMessage

class WorkflowState(TypedDict, total=False):
    """State que flui pelo workflow."""

    # Core
    messages: list[BaseMessage]  # Histórico de mensagens

    # Source tracking
    source: Literal["manual", "whatsapp", "webhook", "schedule"]

    # Trigger data (populated by trigger nodes)
    trigger_data: dict  # Event-specific data

    # Agent output (convenience)
    agent_response: str

    # Response markers (for respond_webhook)
    _response: dict | None  # { type, body, status }
```

### 4.2 Exemplo de Flow

```
1. Trigger WA Message ativa
   state = {
     "messages": [HumanMessage("Oi Ivy")],
     "source": "whatsapp",
     "trigger_data": { "sender": "5511...", "instanceId": "inst_xxx" }
   }

2. Agent processa
   state = {
     "messages": [HumanMessage("Oi Ivy"), AIMessage("Olá! Como posso ajudar?")],
     "source": "whatsapp",
     "trigger_data": { ... },
     "agent_response": "Olá! Como posso ajudar?"
   }

3. Router avalia source == "whatsapp"
   → goto "send-whatsapp"

4. Send WhatsApp executa
   POST /api/v1/messages/send
   state = { ... }  # Não modifica

5. End
   Workflow completo
```

---

## 5. Implementação no AST

### 5.1 Estrutura de Arquivos

```
ast/src/
├── nodes/                      # 🆕 Node implementations
│   ├── __init__.py
│   ├── base.py                 # Base classes
│   ├── triggers/
│   │   ├── __init__.py
│   │   ├── manual_trigger.py
│   │   ├── whatsapp_message_trigger.py
│   │   └── whatsapp_connection_trigger.py
│   ├── actions/
│   │   ├── __init__.py
│   │   ├── agent_node.py
│   │   ├── respond_webhook.py
│   │   └── send_whatsapp.py
│   └── logic/
│       ├── __init__.py
│       ├── router_node.py
│       └── end_node.py
├── workflows/
│   ├── executor.py             # 🆕 StateGraph builder
│   └── ...
└── schema/
    └── workflow_schema.py      # Atualizar com novos node types
```

### 5.2 Base Node Class

```python
# ast/src/nodes/base.py
from abc import ABC, abstractmethod
from typing import Any
from langgraph.types import Command
from langchain_core.runnables import RunnableConfig

class BaseNode(ABC):
    """Base class for all workflow nodes."""

    node_type: str

    def __init__(self, node_id: str, config: dict[str, Any]):
        self.node_id = node_id
        self.config = config

    @abstractmethod
    async def execute(
        self,
        state: dict[str, Any],
        config: RunnableConfig
    ) -> dict[str, Any] | Command:
        """
        Execute the node.

        Returns:
            dict: State update to merge
            Command: For routing nodes (goto + optional update)
        """
        pass
```

### 5.3 Router Node Implementation

```python
# ast/src/nodes/logic/router_node.py
from typing import Literal
from langgraph.types import Command
from ..base import BaseNode

class RouterNode(BaseNode):
    """Routes workflow execution based on conditions."""

    node_type = "router"

    async def execute(
        self,
        state: dict,
        config: RunnableConfig
    ) -> Command:
        mode = self.config.get("mode", "expression")

        if mode == "expression":
            # Simple expression like "state.source"
            expr = self.config["expression"]
            value = self._evaluate_expression(expr, state)
            goto = self._match_output(value)

        elif mode == "rules":
            # n8n-style rules
            goto = self._evaluate_rules(state)

        return Command(update={}, goto=goto)

    def _evaluate_expression(self, expr: str, state: dict) -> Any:
        """Evaluate expression against state."""
        # Simple implementation: "state.field" → state["field"]
        if expr.startswith("state."):
            field = expr[6:]  # Remove "state."
            return state.get(field)
        return None

    def _match_output(self, value: Any) -> str:
        """Match value to output key."""
        outputs = self.config.get("outputs", [])
        for output in outputs:
            if output["key"] == value:
                return output["key"]
        return self.config.get("defaultOutput", outputs[0]["key"])

    def _evaluate_rules(self, state: dict) -> str:
        """Evaluate rules and return matching output."""
        rules = self.config.get("rules", [])
        for rule in rules:
            if self._check_condition(rule["conditions"], state):
                return rule["output"]
        return self.config.get("fallbackOutput")

    def _check_condition(self, condition: dict, state: dict) -> bool:
        """Check if condition matches state."""
        field = condition["field"]
        operator = condition["operator"]
        expected = condition["value"]
        actual = state.get(field)

        if operator == "equals":
            return actual == expected
        elif operator == "not_equals":
            return actual != expected
        elif operator == "contains":
            return expected in (actual or "")
        # ... more operators

        return False
```

### 5.4 Workflow Executor (StateGraph Builder)

```python
# ast/src/workflows/executor.py
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from ..nodes import get_node_executor
from ..schema.workflow_schema import WorkflowState

async def build_workflow_graph(
    workflow: dict,
    checkpointer: AsyncPostgresSaver
) -> CompiledStateGraph:
    """
    Build a LangGraph StateGraph from workflow configuration.

    Args:
        workflow: Workflow data with nodes and edges
        checkpointer: For conversation memory

    Returns:
        Compiled LangGraph ready for execution
    """
    flow_data = workflow["flowData"]
    nodes = flow_data["nodes"]
    edges = flow_data["edges"]

    # 1. Create StateGraph
    builder = StateGraph(WorkflowState)

    # 2. Add nodes
    for node in nodes:
        node_id = node["id"]
        node_type = node["type"]
        node_config = node.get("config", {})

        if node_type == "end":
            # End nodes don't need executors
            continue

        # Get node executor based on type
        executor = get_node_executor(node_type, node_id, node_config)
        builder.add_node(node_id, executor.execute)

    # 3. Add edges
    for edge in edges:
        source = edge["source"]
        target = edge["target"]
        source_handle = edge.get("sourceHandle")

        # Check if target is "end" node
        target_node = next((n for n in nodes if n["id"] == target), None)
        if target_node and target_node["type"] == "end":
            target = END

        # Check if source is a router (conditional edges)
        source_node = next((n for n in nodes if n["id"] == source), None)
        if source_node and source_node["type"] == "router":
            # Conditional edge - handled by Command pattern
            # Router returns Command(goto=handle)
            # We need to define the mapping
            if source_handle:
                # This edge only applies for this handle
                # LangGraph handles this via the Command return
                builder.add_edge(source, target)
        else:
            # Static edge
            builder.add_edge(source, target)

    # 4. Set entry point (find trigger nodes)
    trigger_nodes = [n for n in nodes if n["type"].endswith("_trigger")]
    if trigger_nodes:
        # Multiple triggers converge to same flow
        # Entry point is determined at runtime by trigger type
        builder.set_entry_point(trigger_nodes[0]["id"])

    # 5. Compile with checkpointer
    return builder.compile(checkpointer=checkpointer)
```

---

## 6. Integração com LivChat

### 6.1 Webhook Handler Modificado

```typescript
// app/src/app/api/webhooks/wuzapi/route.ts

// Após processar o evento normalmente...

// 🆕 Trigger workflows
await triggerWorkflows(event, instanceId);

async function triggerWorkflows(event: WuzAPIEvent, instanceId: string) {
  // 1. Buscar workflows ativos com triggers para este evento
  const triggers = await db.query.workflowTriggers.findMany({
    where: and(
      eq(workflowTriggers.isActive, true),
      eq(workflowTriggers.source, "wuzapi"),
      arrayContains(workflowTriggers.eventTypes, [event.type])
    )
  });

  // 2. Filtrar por instanceId se aplicável
  const matchingTriggers = triggers.filter(t =>
    !t.instanceIds || t.instanceIds.includes(instanceId)
  );

  // 3. Disparar workflows (fire-and-forget)
  for (const trigger of matchingTriggers) {
    // Não aguarda resposta
    fetch(`${AST_URL}/workflows/${trigger.workflowId}/trigger`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: event.type,
        data: {
          instanceId,
          ...event.event  // Payload específico do evento
        }
      })
    }).catch(err => console.error("Trigger failed:", err));
  }
}
```

### 6.2 Novo Endpoint no AST

```python
# ast/src/service/workflow_router.py

@router.post("/{workflow_id}/trigger")
async def trigger_workflow(
    workflow_id: str,
    input_data: TriggerInput,
    background_tasks: BackgroundTasks,
) -> TriggerResponse:
    """
    Fire-and-forget workflow trigger.

    Args:
        workflow_id: Workflow to trigger
        input_data: Event type and data

    Returns:
        Immediate response with execution ID
    """
    execution_id = str(uuid.uuid4())

    # Execute in background
    background_tasks.add_task(
        execute_triggered_workflow,
        workflow_id,
        input_data,
        execution_id,
    )

    return TriggerResponse(
        status="triggered",
        executionId=execution_id,
        workflowId=workflow_id,
    )
```

---

## 7. Workflow Ivy Completo

```json
{
  "id": "wf_ivy",
  "name": "Ivy Assistant",
  "description": "Assistente virtual unificado",
  "isActive": true,

  "flowData": {
    "nodes": [
      {
        "id": "trigger-manual",
        "type": "manual_trigger",
        "name": "Chat UI",
        "position": { "x": 100, "y": 100 },
        "config": {}
      },
      {
        "id": "trigger-wa-message",
        "type": "whatsapp_message_trigger",
        "name": "Mensagem WA",
        "position": { "x": 100, "y": 200 },
        "config": {
          "instanceIds": ["inst_ivy"],
          "filters": { "isFromMe": false }
        }
      },
      {
        "id": "trigger-wa-connection",
        "type": "whatsapp_connection_trigger",
        "name": "WA Conectado",
        "position": { "x": 100, "y": 300 },
        "config": {
          "events": ["connected"]
        }
      },
      {
        "id": "agent-ivy",
        "type": "agent",
        "name": "Ivy Agent",
        "position": { "x": 300, "y": 200 },
        "config": {
          "prompt": {
            "system": "Você é a Ivy, assistente virtual do LivChat...",
            "variables": ["current_datetime"]
          },
          "llm": {
            "model": "gemini-2.0-flash",
            "provider": "google",
            "temperature": 0.7
          },
          "memory": {
            "type": "buffer",
            "tokenLimit": 16000
          }
        }
      },
      {
        "id": "router-source",
        "type": "router",
        "name": "Direcionar",
        "position": { "x": 500, "y": 200 },
        "config": {
          "mode": "expression",
          "expression": "state.source",
          "outputs": [
            { "key": "manual", "label": "Chat UI" },
            { "key": "whatsapp", "label": "WhatsApp" }
          ],
          "defaultOutput": "manual"
        }
      },
      {
        "id": "respond-http",
        "type": "respond_webhook",
        "name": "Responder HTTP",
        "position": { "x": 700, "y": 100 },
        "config": {
          "responseField": "agent_response"
        }
      },
      {
        "id": "send-whatsapp",
        "type": "send_whatsapp",
        "name": "Enviar WA",
        "position": { "x": 700, "y": 300 },
        "config": {
          "instanceId": "{{env.IVY_INSTANCE_ID}}",
          "to": "{{trigger_data.sender}}",
          "message": "{{agent_response}}"
        }
      },
      {
        "id": "end-http",
        "type": "end",
        "name": "Fim HTTP",
        "position": { "x": 900, "y": 100 },
        "config": {}
      },
      {
        "id": "end-wa",
        "type": "end",
        "name": "Fim WA",
        "position": { "x": 900, "y": 300 },
        "config": {}
      }
    ],

    "edges": [
      { "id": "e1", "source": "trigger-manual", "target": "agent-ivy" },
      { "id": "e2", "source": "trigger-wa-message", "target": "agent-ivy" },
      { "id": "e3", "source": "trigger-wa-connection", "target": "agent-ivy" },
      { "id": "e4", "source": "agent-ivy", "target": "router-source" },
      { "id": "e5", "source": "router-source", "target": "respond-http", "sourceHandle": "manual" },
      { "id": "e6", "source": "router-source", "target": "send-whatsapp", "sourceHandle": "whatsapp" },
      { "id": "e7", "source": "respond-http", "target": "end-http" },
      { "id": "e8", "source": "send-whatsapp", "target": "end-wa" }
    ]
  }
}
```

---

## 8. Próximos Passos

### Fase 1: Foundation (AST)
1. [ ] Criar estrutura `ast/src/nodes/`
2. [ ] Implementar `BaseNode` class
3. [ ] Implementar `RouterNode`
4. [ ] Implementar `AgentNode` (refactor do atual)
5. [ ] Implementar `EndNode`

### Fase 2: Actions (AST)
6. [ ] Implementar `RespondWebhookNode`
7. [ ] Implementar `SendWhatsAppNode`
8. [ ] Atualizar `WorkflowState` schema

### Fase 3: Triggers (AST)
9. [ ] Implementar `ManualTrigger`
10. [ ] Implementar `WhatsAppMessageTrigger`
11. [ ] Implementar `WhatsAppConnectionTrigger`

### Fase 4: Executor (AST)
12. [ ] Criar `build_workflow_graph()` function
13. [ ] Adicionar endpoint `POST /workflows/{id}/trigger`
14. [ ] Suporte a múltiplos triggers convergindo

### Fase 5: Integration (LivChat)
15. [ ] Criar tabela `workflow_triggers`
16. [ ] Modificar webhook handler para trigger workflows
17. [ ] Criar seed do wf_ivy atualizado

### Fase 6: Testing
18. [ ] Testes unitários dos nodes
19. [ ] Teste end-to-end: Manual → Agent → Respond
20. [ ] Teste end-to-end: WA Message → Agent → Send WA

---

## Changelog

| Data | Mudança |
|------|---------|
| 2024-12-24 | Documento inicial de schema |
