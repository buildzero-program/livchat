# Plan 22: Workflow Triggers - Implementação MVP

## Status: IN PROGRESS

Data: 2024-12-24

---

## Objetivo

Implementar sistema de triggers para workflows no AST, permitindo que a Ivy seja acionada automaticamente por eventos (conexão WhatsApp, mensagens).

**Regra n8n**: Workflows sem trigger não podem ser ativados.

---

## Abordagem

- **MVP Incremental**: Cada fase entrega valor funcional
- **TDD**: Testes primeiro, implementação depois
- **Validação Manual**: Testar via terminal antes de avançar
- **Workflow Unificado**: Um workflow Ivy com múltiplos triggers

---

## Fases de Implementação

### Fase 1: Manual Trigger + Agent (Foundation)

**Objetivo**: Refatorar Ivy atual para usar StateGraph ao invés de @entrypoint, adicionando node manual_trigger.

**Por que primeiro**: É o comportamento atual funcionando, apenas refatorado para a nova arquitetura.

#### 1.1 Definir WorkflowState

```python
# ast/src/schema/workflow_state.py

from typing import TypedDict, Literal
from langchain_core.messages import BaseMessage

class WorkflowState(TypedDict, total=False):
    """State que flui pelo workflow."""

    # Core
    messages: list[BaseMessage]

    # Source tracking (populated by trigger)
    source: Literal["manual", "whatsapp"]

    # Trigger data
    trigger_data: dict

    # Agent output (convenience)
    agent_response: str
```

#### 1.2 Criar estrutura de nodes

```
ast/src/nodes/
├── __init__.py
├── base.py              # BaseNode class
├── registry.py          # Node type registry
├── triggers/
│   ├── __init__.py
│   └── manual_trigger.py
└── actions/
    ├── __init__.py
    └── agent_node.py
```

#### 1.3 Implementar ManualTrigger

```python
# ast/src/nodes/triggers/manual_trigger.py

class ManualTriggerNode(BaseNode):
    """Entry point for invoke/stream calls."""

    node_type = "manual_trigger"

    async def execute(self, state: WorkflowState, config: RunnableConfig) -> WorkflowState:
        # Manual trigger just sets source
        return {
            "source": "manual",
            "trigger_data": {},
        }
```

#### 1.4 Refatorar AgentNode

```python
# ast/src/nodes/actions/agent_node.py

class AgentNode(BaseNode):
    """Executes LLM with prompt config."""

    node_type = "agent"

    async def execute(self, state: WorkflowState, config: RunnableConfig) -> WorkflowState:
        # Load config from node
        prompt_config = self.config.get("prompt", {})
        llm_config = self.config.get("llm", {})

        # Process template
        system_prompt = process_template(prompt_config.get("system", ""))

        # Get model
        model = await get_model_from_name(llm_config.get("model"))

        # Build messages
        messages = [SystemMessage(content=system_prompt), *state["messages"]]

        # Invoke
        response = await model.ainvoke(messages)

        return {
            "messages": [response],
            "agent_response": response.content,
        }
```

#### 1.5 Criar WorkflowExecutor (StateGraph builder)

```python
# ast/src/workflows/executor.py

async def build_workflow_graph(workflow: dict) -> CompiledStateGraph:
    """Build StateGraph from workflow config."""

    nodes = workflow["flowData"]["nodes"]
    edges = workflow["flowData"]["edges"]

    builder = StateGraph(WorkflowState)

    # Add nodes
    for node in nodes:
        executor = get_node_executor(node["type"], node["id"], node.get("config", {}))
        builder.add_node(node["id"], executor.execute)

    # Add edges
    for edge in edges:
        source = edge["source"]
        target = edge["target"]
        builder.add_edge(source, target)

    # Find entry (trigger node)
    trigger_node = next((n for n in nodes if n["type"].endswith("_trigger")), None)
    if trigger_node:
        builder.set_entry_point(trigger_node["id"])

    return builder.compile()
```

#### 1.6 Atualizar workflow Ivy

```python
# Novo workflow com trigger
{
    "id": "wf_ivy",
    "name": "Ivy",
    "flowData": {
        "nodes": [
            {
                "id": "trigger-manual",
                "type": "manual_trigger",
                "name": "Manual Trigger",
                "config": {}
            },
            {
                "id": "agent-ivy",
                "type": "agent",
                "name": "Ivy Agent",
                "config": {
                    "prompt": { "system": "...", "variables": ["current_datetime"] },
                    "llm": { "model": "gemini-2.0-flash" },
                    "memory": { "tokenLimit": 16000 }
                }
            }
        ],
        "edges": [
            { "source": "trigger-manual", "target": "agent-ivy" }
        ]
    },
    "isActive": true
}
```

#### 1.7 Testes

```python
# tests/nodes/test_manual_trigger.py

@pytest.mark.asyncio
async def test_manual_trigger_sets_source():
    node = ManualTriggerNode("trigger-1", {})
    state = {"messages": [HumanMessage(content="Oi")]}

    result = await node.execute(state, {})

    assert result["source"] == "manual"

# tests/nodes/test_agent_node.py

@pytest.mark.asyncio
async def test_agent_node_invokes_llm():
    config = {
        "prompt": {"system": "You are helpful."},
        "llm": {"model": "gpt-4o-mini"}
    }
    node = AgentNode("agent-1", config)
    state = {"messages": [HumanMessage(content="Hello")], "source": "manual"}

    with patch("nodes.actions.agent_node.get_model_from_name") as mock:
        mock_model = AsyncMock()
        mock_model.ainvoke.return_value = AIMessage(content="Hi!")
        mock.return_value = mock_model

        result = await node.execute(state, {})

        assert result["agent_response"] == "Hi!"

# tests/workflows/test_executor.py

@pytest.mark.asyncio
async def test_build_workflow_graph_with_manual_trigger():
    workflow = {
        "flowData": {
            "nodes": [
                {"id": "trigger", "type": "manual_trigger", "config": {}},
                {"id": "agent", "type": "agent", "config": {...}}
            ],
            "edges": [{"source": "trigger", "target": "agent"}]
        }
    }

    graph = await build_workflow_graph(workflow)

    assert graph is not None
    # Test execution
    result = await graph.ainvoke({"messages": [HumanMessage("Hi")]})
    assert "agent_response" in result
```

#### 1.8 Validação Manual

```bash
# 1. Rodar testes
cd /home/pedro/dev/sandbox/livchat/ast
uv run pytest tests/nodes/ -v
uv run pytest tests/workflows/test_executor.py -v

# 2. Subir serviço
docker compose up -d

# 3. Testar via curl
curl -X POST http://localhost:9000/workflows/wf_ivy/invoke \
  -H "Content-Type: application/json" \
  -d '{"message": "Oi Ivy!", "threadId": "test-123"}'

# Esperado: resposta da Ivy normalmente
```

#### Checklist Fase 1

- [ ] Criar `ast/src/schema/workflow_state.py`
- [ ] Criar `ast/src/nodes/__init__.py`
- [ ] Criar `ast/src/nodes/base.py`
- [ ] Criar `ast/src/nodes/registry.py`
- [ ] Criar `ast/src/nodes/triggers/__init__.py`
- [ ] Criar `ast/src/nodes/triggers/manual_trigger.py`
- [ ] Criar `ast/src/nodes/actions/__init__.py`
- [ ] Criar `ast/src/nodes/actions/agent_node.py`
- [ ] Criar `ast/src/workflows/executor.py`
- [ ] Atualizar `ast/src/seeds/__init__.py` (novo workflow format)
- [ ] Atualizar `ast/src/service/workflow_router.py` (usar executor)
- [ ] Escrever testes
- [ ] Validar via terminal

---

### Fase 2: End Node + Respond Webhook

**Objetivo**: Adicionar node End e Respond Webhook para completar o fluxo do Chat UI.

#### 2.1 Implementar EndNode

```python
# ast/src/nodes/terminal/end_node.py

class EndNode(BaseNode):
    """Terminal node - marks end of workflow branch."""

    node_type = "end"

    async def execute(self, state: WorkflowState, config: RunnableConfig) -> WorkflowState:
        # No-op, just passes through
        return {}
```

#### 2.2 Implementar RespondWebhookNode

```python
# ast/src/nodes/actions/respond_webhook.py

class RespondWebhookNode(BaseNode):
    """Marks response to return to HTTP caller."""

    node_type = "respond_webhook"

    async def execute(self, state: WorkflowState, config: RunnableConfig) -> WorkflowState:
        response_field = self.config.get("responseField", "agent_response")
        response_value = state.get(response_field, "")

        return {
            "_response": {
                "type": "http",
                "body": response_value,
                "status": 200,
            }
        }
```

#### 2.3 Atualizar workflow

```python
{
    "flowData": {
        "nodes": [
            {"id": "trigger-manual", "type": "manual_trigger", ...},
            {"id": "agent-ivy", "type": "agent", ...},
            {"id": "respond", "type": "respond_webhook", "config": {"responseField": "agent_response"}},
            {"id": "end", "type": "end", "config": {}}
        ],
        "edges": [
            {"source": "trigger-manual", "target": "agent-ivy"},
            {"source": "agent-ivy", "target": "respond"},
            {"source": "respond", "target": "end"}
        ]
    }
}
```

#### 2.4 Validação Manual

```bash
# Mesmo teste da Fase 1 - deve continuar funcionando
curl -X POST http://localhost:9000/workflows/wf_ivy/invoke \
  -H "Content-Type: application/json" \
  -d '{"message": "Oi!", "threadId": "test-456"}'
```

#### Checklist Fase 2

- [ ] Criar `ast/src/nodes/terminal/__init__.py`
- [ ] Criar `ast/src/nodes/terminal/end_node.py`
- [ ] Criar `ast/src/nodes/actions/respond_webhook.py`
- [ ] Atualizar workflow seed
- [ ] Escrever testes
- [ ] Validar via terminal

---

### Fase 3: Router Node (Uma Condição)

**Objetivo**: Adicionar Router que avalia `source` e direciona para diferentes outputs.

#### 3.1 Implementar RouterNode

```python
# ast/src/nodes/logic/router_node.py

from langgraph.types import Command

class RouterNode(BaseNode):
    """Routes execution based on condition."""

    node_type = "router"

    async def execute(self, state: WorkflowState, config: RunnableConfig) -> Command:
        expression = self.config.get("expression", "source")
        outputs = self.config.get("outputs", [])
        default = self.config.get("defaultOutput")

        # Evaluate expression
        value = self._evaluate(expression, state)

        # Find matching output
        goto = default
        for output in outputs:
            if output["key"] == value:
                goto = output["key"]
                break

        return Command(update={}, goto=goto)

    def _evaluate(self, expr: str, state: dict) -> str:
        """Simple expression evaluation: 'source' -> state['source']"""
        return state.get(expr, "")
```

#### 3.2 Atualizar executor para suportar Command

```python
# ast/src/workflows/executor.py

# O LangGraph já suporta Command nativamente
# Apenas precisamos garantir que edges condicionais funcionem

def build_workflow_graph(workflow: dict) -> CompiledStateGraph:
    # ...

    for edge in edges:
        source = edge["source"]
        target = edge["target"]
        source_handle = edge.get("sourceHandle")

        source_node = get_node_by_id(nodes, source)

        if source_node["type"] == "router":
            # Router uses Command pattern - edges are defined by sourceHandle
            # LangGraph routes based on Command.goto value
            pass  # Edges are implicit via Command
        else:
            builder.add_edge(source, target)
```

#### 3.3 Atualizar workflow (preparar para 2 paths)

```python
{
    "flowData": {
        "nodes": [
            {"id": "trigger-manual", "type": "manual_trigger", ...},
            {"id": "agent-ivy", "type": "agent", ...},
            {"id": "router", "type": "router", "config": {
                "expression": "source",
                "outputs": [
                    {"key": "manual", "label": "Chat UI"},
                    {"key": "whatsapp", "label": "WhatsApp"}
                ],
                "defaultOutput": "manual"
            }},
            {"id": "respond", "type": "respond_webhook", ...},
            {"id": "end-http", "type": "end", ...}
        ],
        "edges": [
            {"source": "trigger-manual", "target": "agent-ivy"},
            {"source": "agent-ivy", "target": "router"},
            {"source": "router", "target": "respond", "sourceHandle": "manual"},
            {"source": "respond", "target": "end-http"}
        ]
    }
}
```

**Nota**: Por enquanto só temos o path `manual`. O path `whatsapp` será adicionado na Fase 5.

#### 3.4 Testes

```python
@pytest.mark.asyncio
async def test_router_routes_by_source():
    config = {
        "expression": "source",
        "outputs": [{"key": "manual"}, {"key": "whatsapp"}],
        "defaultOutput": "manual"
    }
    node = RouterNode("router-1", config)

    # Test manual source
    state = {"source": "manual", "messages": [...]}
    result = await node.execute(state, {})
    assert result.goto == "manual"

    # Test whatsapp source
    state = {"source": "whatsapp", "messages": [...]}
    result = await node.execute(state, {})
    assert result.goto == "whatsapp"
```

#### 3.5 Validação Manual

```bash
# Deve funcionar igual - router direciona para "manual" path
curl -X POST http://localhost:9000/workflows/wf_ivy/invoke \
  -H "Content-Type: application/json" \
  -d '{"message": "Teste router", "threadId": "test-789"}'
```

#### Checklist Fase 3

- [ ] Criar `ast/src/nodes/logic/__init__.py`
- [ ] Criar `ast/src/nodes/logic/router_node.py`
- [ ] Atualizar executor para Command pattern
- [ ] Atualizar workflow seed
- [ ] Escrever testes
- [ ] Validar via terminal

---

### Fase 4: Send WhatsApp Node

**Objetivo**: Adicionar node que envia mensagem via WhatsApp API.

#### 4.1 Implementar SendWhatsAppNode

```python
# ast/src/nodes/actions/send_whatsapp.py

import httpx
from ..base import BaseNode

class SendWhatsAppNode(BaseNode):
    """Sends message via LivChat API."""

    node_type = "send_whatsapp"

    async def execute(self, state: WorkflowState, config: RunnableConfig) -> WorkflowState:
        # Resolve template variables
        instance_id = self._resolve(self.config.get("instanceId"), state)
        to = self._resolve(self.config.get("to"), state)
        message = self._resolve(self.config.get("message"), state)

        # Call LivChat API
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{settings.LIVCHAT_API_URL}/api/v1/messages/send",
                json={
                    "instanceId": instance_id,
                    "to": to,
                    "text": message,
                },
                headers={
                    "Authorization": f"Bearer {settings.LIVCHAT_API_KEY}",
                },
            )
            response.raise_for_status()

        return {"_whatsapp_sent": True}

    def _resolve(self, template: str, state: dict) -> str:
        """Resolve {{variable}} from state."""
        if not template:
            return ""

        # Simple resolution: {{trigger_data.sender}} -> state["trigger_data"]["sender"]
        import re
        pattern = r"\{\{(\w+(?:\.\w+)*)\}\}"

        def replace(match):
            path = match.group(1).split(".")
            value = state
            for key in path:
                value = value.get(key, "")
                if not isinstance(value, dict):
                    break
            return str(value)

        return re.sub(pattern, replace, template)
```

#### 4.2 Atualizar workflow com path WhatsApp

```python
{
    "flowData": {
        "nodes": [
            {"id": "trigger-manual", "type": "manual_trigger", ...},
            {"id": "agent-ivy", "type": "agent", ...},
            {"id": "router", "type": "router", ...},
            {"id": "respond", "type": "respond_webhook", ...},
            {"id": "send-wa", "type": "send_whatsapp", "config": {
                "instanceId": "{{env.IVY_INSTANCE_ID}}",
                "to": "{{trigger_data.sender}}",
                "message": "{{agent_response}}"
            }},
            {"id": "end-http", "type": "end", ...},
            {"id": "end-wa", "type": "end", ...}
        ],
        "edges": [
            {"source": "trigger-manual", "target": "agent-ivy"},
            {"source": "agent-ivy", "target": "router"},
            {"source": "router", "target": "respond", "sourceHandle": "manual"},
            {"source": "router", "target": "send-wa", "sourceHandle": "whatsapp"},
            {"source": "respond", "target": "end-http"},
            {"source": "send-wa", "target": "end-wa"}
        ]
    }
}
```

#### 4.3 Testes

```python
@pytest.mark.asyncio
async def test_send_whatsapp_resolves_templates():
    config = {
        "instanceId": "inst_123",
        "to": "{{trigger_data.sender}}",
        "message": "{{agent_response}}"
    }
    node = SendWhatsAppNode("send-1", config)
    state = {
        "trigger_data": {"sender": "5511999999999"},
        "agent_response": "Olá!"
    }

    with patch("httpx.AsyncClient.post") as mock:
        mock.return_value = AsyncMock(status_code=200)
        await node.execute(state, {})

        mock.assert_called_once()
        call_args = mock.call_args
        assert call_args.kwargs["json"]["to"] == "5511999999999"
        assert call_args.kwargs["json"]["text"] == "Olá!"
```

#### 4.4 Validação Manual

```bash
# Por enquanto não dá pra testar via manual trigger
# Pois source="manual" vai pro respond, não pro send_wa
# Vamos testar na próxima fase com o trigger de conexão
```

#### Checklist Fase 4

- [ ] Criar `ast/src/nodes/actions/send_whatsapp.py`
- [ ] Adicionar settings: `LIVCHAT_API_URL`, `LIVCHAT_API_KEY`
- [ ] Atualizar workflow seed
- [ ] Escrever testes
- [ ] (Validação será na Fase 5)

---

### Fase 5: WhatsApp Connection Trigger

**Objetivo**: Adicionar trigger que é acionado quando instância conecta.

#### 5.1 Adicionar endpoint /trigger no AST

```python
# ast/src/service/workflow_router.py

class TriggerInput(BaseModel):
    event: str
    data: dict[str, Any]
    context: dict[str, Any] | None = None

@router.post("/{workflow_id}/trigger")
async def trigger_workflow(
    workflow_id: str,
    input_data: TriggerInput,
    background_tasks: BackgroundTasks,
) -> dict:
    """Fire-and-forget workflow trigger."""

    execution_id = str(uuid.uuid4())

    background_tasks.add_task(
        execute_triggered_workflow,
        workflow_id,
        input_data,
        execution_id,
    )

    return {
        "status": "triggered",
        "executionId": execution_id,
        "workflowId": workflow_id,
    }

async def execute_triggered_workflow(
    workflow_id: str,
    input_data: TriggerInput,
    execution_id: str,
):
    """Background task to execute triggered workflow."""
    try:
        # Build initial state from trigger
        initial_state = {
            "messages": [],  # Will be populated by trigger node
            "source": "whatsapp",
            "trigger_data": input_data.data,
        }

        # Load and execute workflow
        workflow = await get_workflow(store, workflow_id)
        graph = await build_workflow_graph(workflow)

        await graph.ainvoke(initial_state)

    except Exception as e:
        logger.error(f"Trigger execution failed: {e}")
```

#### 5.2 Implementar WhatsAppConnectionTrigger

```python
# ast/src/nodes/triggers/whatsapp_connection_trigger.py

class WhatsAppConnectionTriggerNode(BaseNode):
    """Trigger for WhatsApp connection events."""

    node_type = "whatsapp_connection_trigger"

    async def execute(self, state: WorkflowState, config: RunnableConfig) -> WorkflowState:
        trigger_data = state.get("trigger_data", {})

        # Build system message about the connection
        instance_name = trigger_data.get("instanceName", "Unknown")
        phone = trigger_data.get("phone", "Unknown")

        system_message = SystemMessage(
            content=f"[SISTEMA] O usuário conectou a instância '{instance_name}' com o número {phone}. Dê boas-vindas e explique brevemente o LivChat."
        )

        return {
            "source": "whatsapp",
            "messages": [system_message],
            "trigger_data": trigger_data,
        }
```

#### 5.3 Atualizar workflow

```python
{
    "flowData": {
        "nodes": [
            {"id": "trigger-manual", "type": "manual_trigger", ...},
            {"id": "trigger-wa-conn", "type": "whatsapp_connection_trigger", "config": {
                "events": ["connected"]
            }},
            {"id": "agent-ivy", "type": "agent", ...},
            {"id": "router", "type": "router", ...},
            {"id": "respond", "type": "respond_webhook", ...},
            {"id": "send-wa", "type": "send_whatsapp", ...},
            {"id": "end-http", "type": "end", ...},
            {"id": "end-wa", "type": "end", ...}
        ],
        "edges": [
            {"source": "trigger-manual", "target": "agent-ivy"},
            {"source": "trigger-wa-conn", "target": "agent-ivy"},
            {"source": "agent-ivy", "target": "router"},
            {"source": "router", "target": "respond", "sourceHandle": "manual"},
            {"source": "router", "target": "send-wa", "sourceHandle": "whatsapp"},
            {"source": "respond", "target": "end-http"},
            {"source": "send-wa", "target": "end-wa"}
        ]
    }
}
```

#### 5.4 Integrar com LivChat (tabela + webhook handler)

##### 5.4.1 Criar tabela workflow_triggers

```sql
-- app/drizzle/0003_add_workflow_triggers.sql

CREATE TABLE workflow_triggers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    workflow_id TEXT NOT NULL,
    source TEXT NOT NULL,
    event_types TEXT[],
    instance_ids UUID[],
    filters JSONB,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_workflow_triggers_org ON workflow_triggers(organization_id);
CREATE INDEX idx_workflow_triggers_active ON workflow_triggers(organization_id, is_active) WHERE is_active = true;
```

##### 5.4.2 Adicionar trigger() ao AST client

```typescript
// app/src/server/lib/ast.ts

async trigger(
  workflowId: string,
  input: { event: string; data: Record<string, unknown> }
): Promise<{ status: string; executionId: string }> {
  return this.request(`/workflows/${workflowId}/trigger`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
```

##### 5.4.3 Criar workflow-router.ts

```typescript
// app/src/server/lib/workflow-router.ts

export async function routeToWorkflowTriggers(params: {
  organizationId: string;
  instanceId: string;
  eventType: string;
  eventData: Record<string, unknown>;
}): Promise<void> {
  try {
    // Query active triggers
    const triggers = await db.query.workflowTriggers.findMany({
      where: and(
        eq(workflowTriggers.organizationId, params.organizationId),
        eq(workflowTriggers.isActive, true),
      ),
    });

    // Filter matching triggers
    const matching = triggers.filter(t =>
      t.eventTypes?.includes(params.eventType)
    );

    // Dispatch to AST
    const ast = createASTClient();
    for (const trigger of matching) {
      void ast.trigger(trigger.workflowId, {
        event: params.eventType,
        data: params.eventData,
      });
    }
  } catch (error) {
    console.error("[workflow-router] Error:", error);
  }
}
```

##### 5.4.4 Modificar webhook handler

```typescript
// app/src/app/api/webhooks/wuzapi/route.ts

// Após forwardToUserWebhooks (linha ~247)
import { routeToWorkflowTriggers } from "~/server/lib/workflow-router";

void routeToWorkflowTriggers({
  organizationId: instance.organizationId!,
  instanceId: instance.id,
  eventType: internalEventType,
  eventData: {
    instanceId: instance.id,
    instanceName: instance.name,
    phone: instance.phone,
    ...metadata,
  },
});
```

#### 5.5 Validação Manual

```bash
# 1. Criar trigger no banco (temporário, via SQL)
INSERT INTO workflow_triggers (organization_id, workflow_id, source, event_types, is_active)
VALUES ('org-id-here', 'wf_ivy', 'wuzapi', ARRAY['connection.connected'], true);

# 2. Conectar uma instância WhatsApp no dashboard

# 3. Verificar logs do AST
docker compose logs -f agent_service | grep trigger

# Esperado:
# - Log de trigger recebido
# - Log de workflow executado
# - Mensagem enviada no WhatsApp

# 4. Guardar o payload recebido para testes futuros
# (Copiar do log e salvar em fixtures/)
```

#### Checklist Fase 5

- [ ] Adicionar endpoint POST /workflows/{id}/trigger no AST
- [ ] Criar `ast/src/nodes/triggers/whatsapp_connection_trigger.py`
- [ ] Atualizar workflow seed
- [ ] Criar migração `0003_add_workflow_triggers.sql`
- [ ] Adicionar `workflowTriggers` ao schema.ts
- [ ] Adicionar `trigger()` ao AST client
- [ ] Criar `workflow-router.ts`
- [ ] Modificar webhook handler
- [ ] Seed trigger para Ivy
- [ ] Testar conectando WhatsApp real
- [ ] Guardar payload para fixtures

---

### Fase 6: WhatsApp Message Trigger

**Objetivo**: Adicionar trigger para mensagens recebidas no WhatsApp.

#### 6.1 Implementar WhatsAppMessageTrigger

```python
# ast/src/nodes/triggers/whatsapp_message_trigger.py

class WhatsAppMessageTriggerNode(BaseNode):
    """Trigger for WhatsApp message events."""

    node_type = "whatsapp_message_trigger"

    async def execute(self, state: WorkflowState, config: RunnableConfig) -> WorkflowState:
        trigger_data = state.get("trigger_data", {})

        # Extract message text
        raw_event = trigger_data.get("rawEvent", {})
        message_text = self._extract_message_text(raw_event)

        # Build user message
        user_message = HumanMessage(content=message_text)

        return {
            "source": "whatsapp",
            "messages": [user_message],
            "trigger_data": {
                **trigger_data,
                "message_text": message_text,
            },
        }

    def _extract_message_text(self, event: dict) -> str:
        """Extract text from WuzAPI message event."""
        message = event.get("Message", {})

        # Text message
        if conversation := message.get("conversation"):
            return conversation

        # Extended text
        if ext_text := message.get("extendedTextMessage", {}).get("text"):
            return ext_text

        return "[Mensagem não textual]"
```

#### 6.2 Atualizar workflow (adicionar trigger)

```python
{
    "flowData": {
        "nodes": [
            {"id": "trigger-manual", "type": "manual_trigger", ...},
            {"id": "trigger-wa-conn", "type": "whatsapp_connection_trigger", ...},
            {"id": "trigger-wa-msg", "type": "whatsapp_message_trigger", "config": {
                "instanceIds": ["inst_ivy"],  # Só da instância Ivy
                "filters": {"isFromMe": false}
            }},
            {"id": "agent-ivy", "type": "agent", ...},
            # ... resto igual
        ],
        "edges": [
            {"source": "trigger-manual", "target": "agent-ivy"},
            {"source": "trigger-wa-conn", "target": "agent-ivy"},
            {"source": "trigger-wa-msg", "target": "agent-ivy"},
            # ... resto igual
        ]
    }
}
```

#### 6.3 Adicionar trigger no banco

```sql
INSERT INTO workflow_triggers (organization_id, workflow_id, source, event_types, instance_ids, filters, is_active)
VALUES (
  'org-id-here',
  'wf_ivy',
  'wuzapi',
  ARRAY['message.received'],
  ARRAY['inst_ivy_id']::uuid[],
  '{"isFromMe": false}'::jsonb,
  true
);
```

#### 6.4 Validação Manual

```bash
# 1. Enviar mensagem para o número da Ivy

# 2. Verificar logs
docker compose logs -f agent_service

# 3. Verificar se Ivy respondeu no WhatsApp
```

#### Checklist Fase 6

- [ ] Criar `ast/src/nodes/triggers/whatsapp_message_trigger.py`
- [ ] Atualizar workflow seed
- [ ] Adicionar trigger no banco
- [ ] Testar enviando mensagem real
- [ ] Guardar payload para fixtures

---

## Cronograma Estimado

| Fase | Descrição | Complexidade | Estimativa |
|------|-----------|--------------|------------|
| 1 | Manual Trigger + Agent | Alta | 4-6h |
| 2 | End + Respond Webhook | Baixa | 1-2h |
| 3 | Router Node | Média | 2-3h |
| 4 | Send WhatsApp Node | Média | 2-3h |
| 5 | WA Connection Trigger | Alta | 4-6h |
| 6 | WA Message Trigger | Média | 2-3h |

**Total estimado**: 15-23h (2-3 dias de trabalho focado)

---

## Fixtures para Testes

Após Fase 5, guardar payloads em:

```
ast/tests/fixtures/
├── wuzapi_connected_event.json
├── wuzapi_message_event.json
└── wuzapi_disconnected_event.json
```

Isso permite rodar testes sem depender de eventos reais.

---

## Documentação Relacionada

- `plan-22/design-workflow-triggers.md` - Arquitetura geral
- `plan-22/analysis-trigger-implementation.md` - Análise de opções
- `plan-22/implementation-nodes-schema.md` - Schema dos nodes

---

## Changelog

| Data | Mudança |
|------|---------|
| 2024-12-24 | Plano inicial criado |
