# Plan 11 - AST Workflows System

## Objetivo

Implementar sistema de workflows no AST para suportar a Ivy e futuros agentes AI, com integração no LivChat.

## Contexto

### Arquitetura Definida

```
┌─────────────────────────────────────────────────────────┐
│                     LIVCHAT APP                         │
│                                                         │
│  ┌─────────────────┐  ┌─────────────────┐              │
│  │    workflows    │  │     threads     │              │
│  │  ────────────   │  │  ────────────   │              │
│  │  providerId ────│──│→ workflowId     │              │
│  │  organizationId │  │  providerThreadId│              │
│  │  name (cache)   │  │  deviceId/userId │              │
│  └─────────────────┘  └─────────────────┘              │
│                                                         │
│  Ivy = workflow especial (organizationId = NULL)       │
└────────────────────────┬────────────────────────────────┘
                         │ AST_INTERNAL_SECRET
                         ▼
┌─────────────────────────────────────────────────────────┐
│                        AST                              │
│                                                         │
│  ┌─────────────────┐  ┌─────────────────┐              │
│  │    workflows    │  │   checkpoints   │              │
│  │  ────────────   │  │  (LangGraph)    │              │
│  │  id (wf_xxx)    │  │  thread_id      │              │
│  │  flow_data      │  │  state          │              │
│  │  name           │  │  messages       │              │
│  └─────────────────┘  └─────────────────┘              │
│                                                         │
│  AUTH_SECRET = "ast_internal_xxx"                      │
└─────────────────────────────────────────────────────────┘
```

### Estrutura JSON do Workflow

```json
{
  "id": "wf_abc123",
  "name": "Ivy Assistant",
  "description": "Assistente virtual do LivChat",
  "version": 1,

  "nodes": [
    {
      "id": "agent_1",
      "type": "agent",
      "name": "Ivy",
      "position": { "x": 300, "y": 200 },

      "config": {
        "prompt": {
          "system": "Você é a Ivy...\n\nHoje é @current_datetime.",
          "variables": ["current_datetime"]
        },

        "llm": {
          "provider": "openai",
          "model": "gpt-4o-mini",
          "temperature": 0.7
        },

        "memory": {
          "type": "buffer",
          "tokenLimit": 16000,
          "messageLimit": null
        },

        "tools": []
      }
    }
  ],

  "edges": [],

  "metadata": {
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T10:00:00Z"
  }
}
```

---

## Fases de Implementação

### Fase 1: AST - Infraestrutura de Workflows

#### 1.1 Schemas Pydantic

**Arquivo:** `src/schema/workflow_schema.py`

```python
from pydantic import BaseModel, Field
from typing import Any
from datetime import datetime

class PromptConfig(BaseModel):
    system: str
    variables: list[str] = []

class LLMConfig(BaseModel):
    provider: str = "openai"
    model: str = "gpt-4o-mini"
    temperature: float = 0.7

class MemoryConfig(BaseModel):
    type: str = "buffer"
    tokenLimit: int | None = 16000
    messageLimit: int | None = None

class AgentNodeConfig(BaseModel):
    prompt: PromptConfig
    llm: LLMConfig
    memory: MemoryConfig = MemoryConfig()
    tools: list[str] = []

class WorkflowNode(BaseModel):
    id: str
    type: str = "agent"
    name: str
    position: dict[str, float] = {"x": 0, "y": 0}
    config: AgentNodeConfig

class WorkflowEdge(BaseModel):
    source: str
    target: str
    sourceHandle: str | None = None
    targetHandle: str | None = None

class FlowData(BaseModel):
    nodes: list[WorkflowNode]
    edges: list[WorkflowEdge] = []

class WorkflowCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    description: str | None = None
    flowData: FlowData

class WorkflowUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    flowData: FlowData | None = None
    isActive: bool | None = None

class WorkflowResponse(BaseModel):
    id: str
    name: str
    description: str | None
    flowData: FlowData
    isActive: bool
    createdAt: datetime
    updatedAt: datetime | None

class WorkflowInvokeInput(BaseModel):
    message: str = Field(..., min_length=1)
    threadId: str = Field(..., description="UUID do thread")

class WorkflowStreamInput(WorkflowInvokeInput):
    pass
```

**Testes:** `tests/workflows/test_workflow_schema.py`

```python
import pytest
from schema.workflow_schema import (
    WorkflowCreate, WorkflowNode, FlowData,
    AgentNodeConfig, PromptConfig, LLMConfig
)

def test_workflow_create_valid():
    workflow = WorkflowCreate(
        name="Test Workflow",
        description="A test",
        flowData=FlowData(
            nodes=[
                WorkflowNode(
                    id="agent_1",
                    type="agent",
                    name="Test Agent",
                    config=AgentNodeConfig(
                        prompt=PromptConfig(system="You are helpful"),
                        llm=LLMConfig(model="gpt-4o-mini"),
                    )
                )
            ]
        )
    )
    assert workflow.name == "Test Workflow"
    assert len(workflow.flowData.nodes) == 1

def test_workflow_create_empty_name_fails():
    with pytest.raises(ValueError):
        WorkflowCreate(
            name="",
            flowData=FlowData(nodes=[])
        )

def test_memory_config_defaults():
    config = MemoryConfig()
    assert config.tokenLimit == 16000
    assert config.messageLimit is None
```

#### 1.2 Storage Layer (PostgresStore)

**Arquivo:** `src/workflows/storage.py`

```python
from langgraph.store.postgres import AsyncPostgresStore
from typing import Any
import json
from datetime import datetime
import uuid

WORKFLOWS_NAMESPACE = ("workflows",)

def generate_workflow_id() -> str:
    return f"wf_{uuid.uuid4().hex[:12]}"

async def create_workflow(
    store: AsyncPostgresStore,
    name: str,
    flow_data: dict,
    description: str | None = None,
) -> dict:
    workflow_id = generate_workflow_id()
    now = datetime.utcnow().isoformat()

    workflow = {
        "id": workflow_id,
        "name": name,
        "description": description,
        "flowData": flow_data,
        "isActive": True,
        "createdAt": now,
        "updatedAt": now,
    }

    await store.aput(
        namespace=WORKFLOWS_NAMESPACE,
        key=workflow_id,
        value=workflow,
    )

    return workflow

async def get_workflow(
    store: AsyncPostgresStore,
    workflow_id: str,
) -> dict | None:
    result = await store.aget(
        namespace=WORKFLOWS_NAMESPACE,
        key=workflow_id,
    )
    return result.value if result else None

async def list_workflows(
    store: AsyncPostgresStore,
    limit: int = 100,
) -> list[dict]:
    results = await store.asearch(
        namespace_prefix=WORKFLOWS_NAMESPACE,
        limit=limit,
    )
    return [item.value for item in results]

async def update_workflow(
    store: AsyncPostgresStore,
    workflow_id: str,
    updates: dict,
) -> dict | None:
    existing = await get_workflow(store, workflow_id)
    if not existing:
        return None

    updated = {
        **existing,
        **{k: v for k, v in updates.items() if v is not None},
        "updatedAt": datetime.utcnow().isoformat(),
    }

    await store.aput(
        namespace=WORKFLOWS_NAMESPACE,
        key=workflow_id,
        value=updated,
    )

    return updated

async def delete_workflow(
    store: AsyncPostgresStore,
    workflow_id: str,
) -> bool:
    existing = await get_workflow(store, workflow_id)
    if not existing:
        return False

    await store.adelete(
        namespace=WORKFLOWS_NAMESPACE,
        key=workflow_id,
    )
    return True
```

**Testes:** `tests/workflows/test_workflow_storage.py`

```python
import pytest
from unittest.mock import AsyncMock, MagicMock
from workflows.storage import (
    create_workflow, get_workflow, list_workflows,
    update_workflow, delete_workflow, generate_workflow_id
)

@pytest.fixture
def mock_store():
    store = AsyncMock()
    store.aput = AsyncMock()
    store.aget = AsyncMock()
    store.asearch = AsyncMock()
    store.adelete = AsyncMock()
    return store

def test_generate_workflow_id():
    wf_id = generate_workflow_id()
    assert wf_id.startswith("wf_")
    assert len(wf_id) == 15  # wf_ + 12 chars

@pytest.mark.asyncio
async def test_create_workflow(mock_store):
    result = await create_workflow(
        store=mock_store,
        name="Test",
        flow_data={"nodes": [], "edges": []},
    )

    assert result["name"] == "Test"
    assert result["id"].startswith("wf_")
    assert result["isActive"] is True
    mock_store.aput.assert_called_once()

@pytest.mark.asyncio
async def test_get_workflow_found(mock_store):
    mock_store.aget.return_value = MagicMock(value={"id": "wf_123", "name": "Test"})

    result = await get_workflow(mock_store, "wf_123")

    assert result["id"] == "wf_123"

@pytest.mark.asyncio
async def test_get_workflow_not_found(mock_store):
    mock_store.aget.return_value = None

    result = await get_workflow(mock_store, "wf_notfound")

    assert result is None

@pytest.mark.asyncio
async def test_update_workflow(mock_store):
    mock_store.aget.return_value = MagicMock(value={
        "id": "wf_123",
        "name": "Old Name",
        "isActive": True,
    })

    result = await update_workflow(
        mock_store, "wf_123", {"name": "New Name"}
    )

    assert result["name"] == "New Name"
    mock_store.aput.assert_called_once()

@pytest.mark.asyncio
async def test_delete_workflow(mock_store):
    mock_store.aget.return_value = MagicMock(value={"id": "wf_123"})

    result = await delete_workflow(mock_store, "wf_123")

    assert result is True
    mock_store.adelete.assert_called_once()
```

#### 1.3 Template Processor

**Arquivo:** `src/workflows/template_processor.py`

```python
import re
from datetime import datetime

WEEKDAYS_PT = [
    "segunda-feira", "terça-feira", "quarta-feira",
    "quinta-feira", "sexta-feira", "sábado", "domingo"
]

MONTHS_PT = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
]

def resolve_datetime(variation: str | None, now: datetime) -> str:
    if variation is None or variation == "":
        # Default: "sexta-feira, 13 de dezembro de 2024 às 14:30"
        weekday = WEEKDAYS_PT[now.weekday()]
        month = MONTHS_PT[now.month - 1]
        return f"{weekday}, {now.day} de {month} de {now.year} às {now.strftime('%H:%M')}"

    match variation:
        case "iso":
            return now.isoformat()
        case "date":
            return now.strftime("%d/%m/%Y")
        case "date.iso":
            return now.strftime("%Y-%m-%d")
        case "time":
            return now.strftime("%H:%M")
        case "weekday":
            return WEEKDAYS_PT[now.weekday()]
        case "month":
            return MONTHS_PT[now.month - 1]
        case "year":
            return str(now.year)
        case "day":
            return str(now.day)
        case _:
            return now.isoformat()

def process_template(
    template: str,
    model_name: str | None = None,
    thread_id: str | None = None,
    now: datetime | None = None,
) -> str:
    if now is None:
        now = datetime.now()

    # Pattern: @variable or @variable.variation
    pattern = r"@(\w+)(?:\.(\w+(?:\.\w+)*))?(?=\s|$|[.,!?;:\)\]\}])"

    def replace_variable(match: re.Match) -> str:
        var_name = match.group(1)
        variation = match.group(2)

        match var_name:
            case "current_datetime":
                return resolve_datetime(variation, now)
            case "model_name":
                return model_name or "unknown"
            case "thread_id":
                return thread_id or "unknown"
            case _:
                # Unknown variable, keep as-is
                return match.group(0)

    return re.sub(pattern, replace_variable, template)
```

**Testes:** `tests/workflows/test_template_processor.py`

```python
import pytest
from datetime import datetime
from workflows.template_processor import process_template, resolve_datetime

@pytest.fixture
def fixed_now():
    return datetime(2024, 12, 13, 14, 30, 0)

def test_current_datetime_default(fixed_now):
    result = process_template("Hoje é @current_datetime.", now=fixed_now)
    assert "sexta-feira" in result
    assert "13 de dezembro de 2024" in result
    assert "14:30" in result

def test_current_datetime_iso(fixed_now):
    result = process_template("Data: @current_datetime.iso", now=fixed_now)
    assert "2024-12-13T14:30:00" in result

def test_current_datetime_date(fixed_now):
    result = process_template("Data: @current_datetime.date", now=fixed_now)
    assert "13/12/2024" in result

def test_current_datetime_weekday(fixed_now):
    result = process_template("Dia: @current_datetime.weekday", now=fixed_now)
    assert "sexta-feira" in result

def test_model_name():
    result = process_template(
        "Modelo: @model_name",
        model_name="gpt-4o-mini"
    )
    assert "gpt-4o-mini" in result

def test_thread_id():
    result = process_template(
        "Thread: @thread_id",
        thread_id="abc-123"
    )
    assert "abc-123" in result

def test_unknown_variable_preserved():
    result = process_template("Olá @unknown_var!")
    assert "@unknown_var" in result

def test_multiple_variables(fixed_now):
    result = process_template(
        "Hoje é @current_datetime.weekday. Modelo: @model_name.",
        model_name="gpt-4o",
        now=fixed_now
    )
    assert "sexta-feira" in result
    assert "gpt-4o" in result
```

---

### Fase 2: AST - Workflow Agent

#### 2.1 Workflow Agent

**Arquivo:** `src/agents/workflow_agent.py`

```python
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, BaseMessage
from langchain_core.runnables import RunnableConfig
from langgraph.func import entrypoint
from langgraph.types import Checkpointer

from core.llm import get_model
from workflows.template_processor import process_template
from workflows.storage import get_workflow

# Token approximation: ~4 chars per token
def count_tokens_approx(messages: list[BaseMessage]) -> int:
    total_chars = sum(len(str(m.content)) for m in messages)
    return total_chars // 4

def trim_messages(
    messages: list[BaseMessage],
    max_tokens: int | None = 16000,
) -> list[BaseMessage]:
    if max_tokens is None or not messages:
        return messages

    # Always keep the first message if it's from user
    result = []
    current_tokens = 0

    # Process from newest to oldest
    for msg in reversed(messages):
        msg_tokens = count_tokens_approx([msg])
        if current_tokens + msg_tokens <= max_tokens:
            result.insert(0, msg)
            current_tokens += msg_tokens
        else:
            break

    return result

@entrypoint()
async def workflow_agent(
    inputs: dict,
    *,
    previous: dict,
    config: RunnableConfig,
    store,
):
    """
    Dynamic workflow agent that loads configuration from database.
    """
    # Get workflow config from RunnableConfig
    workflow_id = config["configurable"].get("workflow_id")
    thread_id = config["configurable"].get("thread_id")

    if not workflow_id:
        raise ValueError("workflow_id is required in config")

    # Load workflow from store
    workflow = await get_workflow(store, workflow_id)
    if not workflow:
        raise ValueError(f"Workflow {workflow_id} not found")

    flow_data = workflow.get("flowData", {})
    nodes = flow_data.get("nodes", [])

    if not nodes:
        raise ValueError(f"Workflow {workflow_id} has no nodes")

    # Get first agent node (MVP: single agent)
    agent_node = nodes[0]
    agent_config = agent_node.get("config", {})

    # Extract configuration
    prompt_config = agent_config.get("prompt", {})
    llm_config = agent_config.get("llm", {})
    memory_config = agent_config.get("memory", {})

    system_prompt = prompt_config.get("system", "You are a helpful assistant.")
    model_name = llm_config.get("model", "gpt-4o-mini")
    temperature = llm_config.get("temperature", 0.7)
    token_limit = memory_config.get("tokenLimit", 16000)

    # Process template variables
    processed_prompt = process_template(
        system_prompt,
        model_name=model_name,
        thread_id=thread_id,
    )

    # Merge messages
    prev_messages = previous.get("messages", [])
    new_messages = inputs.get("messages", [])
    all_messages = prev_messages + new_messages

    # Apply memory limits
    trimmed_messages = trim_messages(all_messages, max_tokens=token_limit)

    # Build messages with system prompt
    messages_for_llm = [
        SystemMessage(content=processed_prompt),
        *trimmed_messages,
    ]

    # Get model and invoke
    model = get_model(model_name)
    response = await model.ainvoke(messages_for_llm)

    # Return full history (not trimmed) for checkpointing
    return {
        "messages": all_messages + [response],
    }
```

**Testes:** `tests/workflows/test_workflow_agent.py`

```python
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from langchain_core.messages import HumanMessage, AIMessage
from agents.workflow_agent import workflow_agent, trim_messages, count_tokens_approx

def test_count_tokens_approx():
    messages = [HumanMessage(content="Hello world")]  # 11 chars
    tokens = count_tokens_approx(messages)
    assert tokens == 2  # 11 // 4 = 2

def test_trim_messages_under_limit():
    messages = [
        HumanMessage(content="Hi"),
        AIMessage(content="Hello"),
    ]
    result = trim_messages(messages, max_tokens=1000)
    assert len(result) == 2

def test_trim_messages_over_limit():
    messages = [
        HumanMessage(content="A" * 100),  # ~25 tokens
        AIMessage(content="B" * 100),      # ~25 tokens
        HumanMessage(content="C" * 100),  # ~25 tokens
    ]
    result = trim_messages(messages, max_tokens=30)
    # Should keep only the most recent that fits
    assert len(result) < 3

def test_trim_messages_none_limit():
    messages = [HumanMessage(content="A" * 10000)]
    result = trim_messages(messages, max_tokens=None)
    assert len(result) == 1
```

---

### Fase 3: AST - API Endpoints

#### 3.1 Workflow Router

**Arquivo:** `src/service/workflow_router.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from typing import AsyncGenerator
import json

from schema.workflow_schema import (
    WorkflowCreate, WorkflowUpdate, WorkflowResponse,
    WorkflowInvokeInput, WorkflowStreamInput,
)
from workflows.storage import (
    create_workflow, get_workflow, list_workflows,
    update_workflow, delete_workflow,
)
from service.auth import verify_bearer
from agents.workflow_agent import workflow_agent

router = APIRouter(prefix="/workflows", tags=["workflows"])

# CRUD Endpoints

@router.post("", response_model=WorkflowResponse)
async def create_workflow_endpoint(
    data: WorkflowCreate,
    store=Depends(get_store),
    _=Depends(verify_bearer),
):
    workflow = await create_workflow(
        store=store,
        name=data.name,
        description=data.description,
        flow_data=data.flowData.model_dump(),
    )
    return WorkflowResponse(**workflow)

@router.get("", response_model=list[WorkflowResponse])
async def list_workflows_endpoint(
    store=Depends(get_store),
    _=Depends(verify_bearer),
):
    workflows = await list_workflows(store)
    return [WorkflowResponse(**w) for w in workflows]

@router.get("/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow_endpoint(
    workflow_id: str,
    store=Depends(get_store),
    _=Depends(verify_bearer),
):
    workflow = await get_workflow(store, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return WorkflowResponse(**workflow)

@router.patch("/{workflow_id}", response_model=WorkflowResponse)
async def update_workflow_endpoint(
    workflow_id: str,
    data: WorkflowUpdate,
    store=Depends(get_store),
    _=Depends(verify_bearer),
):
    updates = data.model_dump(exclude_unset=True)
    if "flowData" in updates and updates["flowData"]:
        updates["flowData"] = updates["flowData"]

    workflow = await update_workflow(store, workflow_id, updates)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return WorkflowResponse(**workflow)

@router.delete("/{workflow_id}")
async def delete_workflow_endpoint(
    workflow_id: str,
    store=Depends(get_store),
    _=Depends(verify_bearer),
):
    success = await delete_workflow(store, workflow_id)
    if not success:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return {"status": "deleted"}

# Execution Endpoints

@router.post("/{workflow_id}/invoke")
async def invoke_workflow(
    workflow_id: str,
    data: WorkflowInvokeInput,
    store=Depends(get_store),
    checkpointer=Depends(get_checkpointer),
    _=Depends(verify_bearer),
):
    workflow = await get_workflow(store, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    config = {
        "configurable": {
            "thread_id": data.threadId,
            "workflow_id": workflow_id,
        }
    }

    # Set checkpointer and store on agent
    workflow_agent.checkpointer = checkpointer
    workflow_agent.store = store

    result = await workflow_agent.ainvoke(
        {"messages": [HumanMessage(content=data.message)]},
        config=config,
    )

    # Get last AI message
    messages = result.get("messages", [])
    last_message = messages[-1] if messages else None

    return {
        "message": last_message.content if last_message else "",
        "threadId": data.threadId,
    }

@router.post("/{workflow_id}/stream")
async def stream_workflow(
    workflow_id: str,
    data: WorkflowStreamInput,
    store=Depends(get_store),
    checkpointer=Depends(get_checkpointer),
    _=Depends(verify_bearer),
):
    workflow = await get_workflow(store, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    async def generate_stream() -> AsyncGenerator[str, None]:
        config = {
            "configurable": {
                "thread_id": data.threadId,
                "workflow_id": workflow_id,
            }
        }

        workflow_agent.checkpointer = checkpointer
        workflow_agent.store = store

        async for event in workflow_agent.astream(
            {"messages": [HumanMessage(content=data.message)]},
            config=config,
            stream_mode="messages",
        ):
            if hasattr(event, "content") and event.content:
                yield f"data: {json.dumps({'type': 'token', 'content': event.content})}\n\n"

        yield f"data: {json.dumps({'type': 'done', 'threadId': data.threadId})}\n\n"

    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
    )
```

#### 3.2 Registrar Router

**Modificar:** `src/service/service.py`

```python
# Adicionar import
from service.workflow_router import router as workflow_router

# Adicionar no app
app.include_router(workflow_router)
```

**Testes:** `tests/workflows/test_workflow_router.py`

```python
import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch, MagicMock

@pytest.fixture
def test_client():
    from service.service import app
    return TestClient(app)

@pytest.fixture
def mock_store():
    store = AsyncMock()
    return store

@pytest.fixture
def auth_header():
    return {"Authorization": "Bearer test-secret"}

def test_create_workflow(test_client, mock_store, auth_header):
    with patch("service.workflow_router.get_store", return_value=mock_store):
        with patch("service.workflow_router.create_workflow") as mock_create:
            mock_create.return_value = {
                "id": "wf_123",
                "name": "Test",
                "description": None,
                "flowData": {"nodes": [], "edges": []},
                "isActive": True,
                "createdAt": "2024-01-01T00:00:00",
                "updatedAt": "2024-01-01T00:00:00",
            }

            response = test_client.post(
                "/workflows",
                json={
                    "name": "Test",
                    "flowData": {
                        "nodes": [{
                            "id": "agent_1",
                            "type": "agent",
                            "name": "Test",
                            "config": {
                                "prompt": {"system": "Hello"},
                                "llm": {"model": "gpt-4o-mini"},
                            }
                        }],
                        "edges": [],
                    }
                },
                headers=auth_header,
            )

            assert response.status_code == 200
            assert response.json()["id"] == "wf_123"

def test_get_workflow_not_found(test_client, mock_store, auth_header):
    with patch("service.workflow_router.get_store", return_value=mock_store):
        with patch("service.workflow_router.get_workflow", return_value=None):
            response = test_client.get(
                "/workflows/wf_notfound",
                headers=auth_header,
            )

            assert response.status_code == 404

def test_list_workflows(test_client, mock_store, auth_header):
    with patch("service.workflow_router.get_store", return_value=mock_store):
        with patch("service.workflow_router.list_workflows") as mock_list:
            mock_list.return_value = [
                {
                    "id": "wf_1",
                    "name": "Workflow 1",
                    "description": None,
                    "flowData": {"nodes": [], "edges": []},
                    "isActive": True,
                    "createdAt": "2024-01-01T00:00:00",
                    "updatedAt": None,
                }
            ]

            response = test_client.get("/workflows", headers=auth_header)

            assert response.status_code == 200
            assert len(response.json()) == 1
```

---

### Fase 4: LivChat - Database Schema

#### 4.1 Tabelas Drizzle

**Modificar:** `src/server/db/schema.ts`

```typescript
// === WORKFLOWS (AST Integration) ===

export const workflows = pgTable(
  "workflows",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Ownership (NULL = sistema, como Ivy)
    organizationId: uuid("organization_id").references(
      () => organizations.id,
      { onDelete: "cascade" }
    ),

    // AST Provider
    providerId: text("provider_id").notNull(), // AST workflow ID (wf_xxx)

    // Cache do AST
    name: text("name").notNull(),
    description: text("description"),

    // Status
    isActive: boolean("is_active").notNull().default(true),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_workflows_org").on(t.organizationId),
    index("idx_workflows_provider").on(t.providerId),
  ]
);

export const threads = pgTable(
  "threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Relationships
    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => workflows.id, { onDelete: "cascade" }),

    // Ownership (quem criou o thread)
    organizationId: uuid("organization_id").references(
      () => organizations.id,
      { onDelete: "cascade" }
    ),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    deviceId: uuid("device_id").references(() => devices.id, { onDelete: "set null" }),

    // AST Provider
    providerThreadId: text("provider_thread_id").notNull(), // UUID enviado pro AST

    // Metadata
    title: text("title"),
    messageCount: integer("message_count").notNull().default(0),

    // Status
    status: text("status").notNull().default("active"), // active, archived

    // Timestamps
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_threads_workflow").on(t.workflowId),
    index("idx_threads_user").on(t.userId),
    index("idx_threads_device").on(t.deviceId),
    index("idx_threads_status").on(t.status),
    index("idx_threads_provider").on(t.providerThreadId),
  ]
);

// Relations
export const workflowsRelations = relations(workflows, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [workflows.organizationId],
    references: [organizations.id],
  }),
  threads: many(threads),
}));

export const threadsRelations = relations(threads, ({ one }) => ({
  workflow: one(workflows, {
    fields: [threads.workflowId],
    references: [workflows.id],
  }),
  organization: one(organizations, {
    fields: [threads.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [threads.userId],
    references: [users.id],
  }),
  device: one(devices, {
    fields: [threads.deviceId],
    references: [devices.id],
  }),
}));
```

#### 4.2 Migration

**Arquivo:** `drizzle/0004_add_workflows_threads.sql`

```sql
-- Migration: Add workflows and threads tables
-- Feature: AST Integration for Ivy and future workflows
-- Plan: Plan-11 - AST Workflows
-- Date: 2024-12-14

-- Workflows table (references to AST workflows)
CREATE TABLE IF NOT EXISTS "workflows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid REFERENCES "organizations"("id") ON DELETE CASCADE,
  "provider_id" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_workflows_org" ON "workflows" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_workflows_provider" ON "workflows" ("provider_id");

-- Threads table (conversation sessions)
CREATE TABLE IF NOT EXISTS "threads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workflow_id" uuid NOT NULL REFERENCES "workflows"("id") ON DELETE CASCADE,
  "organization_id" uuid REFERENCES "organizations"("id") ON DELETE CASCADE,
  "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "device_id" uuid REFERENCES "devices"("id") ON DELETE SET NULL,
  "provider_thread_id" text NOT NULL,
  "title" text,
  "message_count" integer NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'active',
  "last_message_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_threads_workflow" ON "threads" ("workflow_id");
CREATE INDEX IF NOT EXISTS "idx_threads_user" ON "threads" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_threads_device" ON "threads" ("device_id");
CREATE INDEX IF NOT EXISTS "idx_threads_status" ON "threads" ("status");
CREATE INDEX IF NOT EXISTS "idx_threads_provider" ON "threads" ("provider_thread_id");
```

---

### Fase 5: LivChat - Service Layer

#### 5.1 AST Client

**Arquivo:** `src/server/lib/ast.ts`

```typescript
import { env } from "~/env";

const AST_URL = env.AST_URL;
const AST_SECRET = env.AST_INTERNAL_SECRET;

interface WorkflowInvokeResponse {
  message: string;
  threadId: string;
}

class ASTClient {
  private baseUrl: string;
  private secret: string;

  constructor() {
    this.baseUrl = AST_URL;
    this.secret = AST_SECRET;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.secret}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`AST Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async invokeWorkflow(
    workflowId: string,
    message: string,
    threadId: string
  ): Promise<WorkflowInvokeResponse> {
    return this.request(`/workflows/${workflowId}/invoke`, {
      method: "POST",
      body: JSON.stringify({ message, threadId }),
    });
  }

  async streamWorkflow(
    workflowId: string,
    message: string,
    threadId: string
  ): Promise<Response> {
    const response = await fetch(`${this.baseUrl}/workflows/${workflowId}/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.secret}`,
      },
      body: JSON.stringify({ message, threadId }),
    });

    if (!response.ok) {
      throw new Error(`AST Error: ${response.status}`);
    }

    return response;
  }
}

export const astClient = new ASTClient();
```

#### 5.2 Thread Service

**Arquivo:** `src/server/lib/thread.ts`

```typescript
import { db } from "~/server/db";
import { threads, workflows } from "~/server/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

interface CreateThreadParams {
  workflowId: string;
  organizationId?: string | null;
  userId?: string | null;
  deviceId?: string | null;
  title?: string;
}

export async function createThread(params: CreateThreadParams) {
  const providerThreadId = uuidv4();

  const [thread] = await db
    .insert(threads)
    .values({
      workflowId: params.workflowId,
      organizationId: params.organizationId,
      userId: params.userId,
      deviceId: params.deviceId,
      providerThreadId,
      title: params.title ?? "Nova conversa",
    })
    .returning();

  return thread;
}

export async function getActiveThread(params: {
  workflowId: string;
  userId?: string | null;
  deviceId?: string | null;
}) {
  const conditions = [
    eq(threads.workflowId, params.workflowId),
    eq(threads.status, "active"),
  ];

  if (params.userId) {
    conditions.push(eq(threads.userId, params.userId));
  } else if (params.deviceId) {
    conditions.push(eq(threads.deviceId, params.deviceId));
  }

  return db.query.threads.findFirst({
    where: and(...conditions),
    orderBy: [desc(threads.lastMessageAt)],
  });
}

export async function archiveThread(threadId: string) {
  const [updated] = await db
    .update(threads)
    .set({
      status: "archived",
      updatedAt: new Date(),
    })
    .where(eq(threads.id, threadId))
    .returning();

  return updated;
}

export async function incrementMessageCount(threadId: string) {
  await db
    .update(threads)
    .set({
      messageCount: sql`${threads.messageCount} + 1`,
      lastMessageAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(threads.id, threadId));
}
```

---

### Fase 6: LivChat - tRPC Router

#### 6.1 Ivy Router

**Arquivo:** `src/server/api/routers/ivy.ts`

```typescript
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import {
  createTRPCRouter,
  protectedProcedure,
  hybridProcedure,
} from "~/server/api/trpc";
import { db } from "~/server/db";
import { workflows, threads } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { astClient } from "~/server/lib/ast";
import {
  createThread,
  getActiveThread,
  archiveThread,
  incrementMessageCount,
} from "~/server/lib/thread";
import { env } from "~/env";

// Ivy workflow ID (sistema)
const IVY_WORKFLOW_ID = env.IVY_WORKFLOW_ID;

export const ivyRouter = createTRPCRouter({
  // Get or create active thread for Ivy
  getThread: hybridProcedure.query(async ({ ctx }) => {
    const { user, device } = ctx;

    // Get Ivy workflow
    const ivyWorkflow = await db.query.workflows.findFirst({
      where: eq(workflows.providerId, IVY_WORKFLOW_ID),
    });

    if (!ivyWorkflow) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Ivy workflow not configured",
      });
    }

    // Try to get active thread
    let thread = await getActiveThread({
      workflowId: ivyWorkflow.id,
      userId: user?.id,
      deviceId: device?.id,
    });

    // Create new thread if none exists
    if (!thread) {
      thread = await createThread({
        workflowId: ivyWorkflow.id,
        organizationId: user?.organizationId,
        userId: user?.id,
        deviceId: device?.id,
      });
    }

    return {
      threadId: thread.id,
      providerThreadId: thread.providerThreadId,
      title: thread.title,
      messageCount: thread.messageCount,
    };
  }),

  // Create new conversation (archive current, create new)
  newConversation: hybridProcedure.mutation(async ({ ctx }) => {
    const { user, device } = ctx;

    const ivyWorkflow = await db.query.workflows.findFirst({
      where: eq(workflows.providerId, IVY_WORKFLOW_ID),
    });

    if (!ivyWorkflow) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Ivy workflow not configured",
      });
    }

    // Archive current active thread
    const currentThread = await getActiveThread({
      workflowId: ivyWorkflow.id,
      userId: user?.id,
      deviceId: device?.id,
    });

    if (currentThread) {
      await archiveThread(currentThread.id);
    }

    // Create new thread
    const newThread = await createThread({
      workflowId: ivyWorkflow.id,
      organizationId: user?.organizationId,
      userId: user?.id,
      deviceId: device?.id,
    });

    return {
      threadId: newThread.id,
      providerThreadId: newThread.providerThreadId,
    };
  }),

  // Send message (non-streaming)
  send: hybridProcedure
    .input(
      z.object({
        message: z.string().min(1),
        threadId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { log } = ctx;

      // Get thread
      const thread = await db.query.threads.findFirst({
        where: eq(threads.id, input.threadId),
        with: { workflow: true },
      });

      if (!thread) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Thread not found",
        });
      }

      // Increment message count
      await incrementMessageCount(thread.id);

      // Call AST
      try {
        const response = await astClient.invokeWorkflow(
          thread.workflow.providerId,
          input.message,
          thread.providerThreadId
        );

        // Increment for AI response
        await incrementMessageCount(thread.id);

        return {
          message: response.message,
          threadId: thread.id,
        };
      } catch (error) {
        log.error("AST invoke error", { error });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get response from AI",
        });
      }
    }),

  // Stream message (SSE)
  stream: hybridProcedure
    .input(
      z.object({
        message: z.string().min(1),
        threadId: z.string().uuid(),
      })
    )
    .subscription(async function* ({ ctx, input }) {
      const { log } = ctx;

      // Get thread
      const thread = await db.query.threads.findFirst({
        where: eq(threads.id, input.threadId),
        with: { workflow: true },
      });

      if (!thread) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Thread not found",
        });
      }

      // Increment message count for user message
      await incrementMessageCount(thread.id);

      try {
        const response = await astClient.streamWorkflow(
          thread.workflow.providerId,
          input.message,
          thread.providerThreadId
        );

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = JSON.parse(line.slice(6));

              if (data.type === "token") {
                yield { type: "token" as const, content: data.content };
              } else if (data.type === "done") {
                // Increment for AI response
                await incrementMessageCount(thread.id);
                yield { type: "done" as const, threadId: thread.id };
              }
            }
          }
        }
      } catch (error) {
        log.error("AST stream error", { error });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to stream response from AI",
        });
      }
    }),

  // List conversation history (threads)
  listThreads: hybridProcedure.query(async ({ ctx }) => {
    const { user, device } = ctx;

    const conditions = [];

    if (user?.id) {
      conditions.push(eq(threads.userId, user.id));
    } else if (device?.id) {
      conditions.push(eq(threads.deviceId, device.id));
    }

    if (conditions.length === 0) {
      return [];
    }

    const userThreads = await db.query.threads.findMany({
      where: and(...conditions),
      orderBy: [desc(threads.lastMessageAt)],
      limit: 50,
    });

    return userThreads.map((t) => ({
      id: t.id,
      title: t.title,
      messageCount: t.messageCount,
      status: t.status,
      lastMessageAt: t.lastMessageAt,
      createdAt: t.createdAt,
    }));
  }),
});
```

#### 6.2 Registrar Router

**Modificar:** `src/server/api/root.ts`

```typescript
import { ivyRouter } from "~/server/api/routers/ivy";

export const appRouter = createTRPCRouter({
  whatsapp: whatsappRouter,
  apiKeys: apiKeysRouter,
  webhooks: webhooksRouter,
  roadmap: roadmapRouter,
  ivy: ivyRouter, // Adicionar
});
```

---

### Fase 7: LivChat - Ivy UI Integration

#### 7.1 Atualizar Provider

**Modificar:** `src/components/ai-chat/ai-chat-provider.tsx`

```typescript
import { api } from "~/trpc/react";

export function AiChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);

  // Get or create thread on mount
  const { data: threadData } = api.ivy.getThread.useQuery(undefined, {
    onSuccess: (data) => {
      setThreadId(data.threadId);
    },
  });

  // New conversation mutation
  const newConversation = api.ivy.newConversation.useMutation({
    onSuccess: (data) => {
      setThreadId(data.threadId);
      setMessages([]);
      setStreamingContent(null);
    },
  });

  // Stream subscription
  const streamMutation = api.ivy.stream.useMutation();

  const sendMessage = useCallback(
    async (content: string) => {
      if (!threadId) return;

      // Add user message immediately
      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      setStreamingContent("");

      try {
        // Use subscription for streaming
        const response = await streamMutation.mutateAsync({
          message: content,
          threadId,
        });

        // Process stream events
        for await (const event of response) {
          if (event.type === "token") {
            setStreamingContent((prev) => (prev ?? "") + event.content);
          } else if (event.type === "done") {
            // Finalize message
            const aiMessage: Message = {
              id: crypto.randomUUID(),
              role: "assistant",
              content: streamingContent ?? "",
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, aiMessage]);
            setStreamingContent(null);
          }
        }
      } catch (error) {
        console.error("Stream error:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [threadId, streamMutation]
  );

  const clearMessages = useCallback(() => {
    newConversation.mutate();
  }, [newConversation]);

  return (
    <AiChatContext.Provider
      value={{
        isOpen,
        messages,
        isLoading,
        streamingContent,
        toggle,
        sendMessage,
        clearMessages,
      }}
    >
      {children}
    </AiChatContext.Provider>
  );
}
```

---

### Fase 8: Setup e Deploy

#### 8.1 Environment Variables

**AST `.env`:**
```bash
# Gerar um secret seguro
AUTH_SECRET=ast_internal_$(openssl rand -hex 32)
```

**LivChat `.env`:**
```bash
# AST Integration
AST_URL=http://localhost:9000
AST_INTERNAL_SECRET=ast_internal_xxx  # Mesmo do AST
IVY_WORKFLOW_ID=wf_ivy  # ID do workflow Ivy no AST
```

#### 8.2 Seed da Ivy no AST

**Script:** `scripts/seed-ivy.py`

```python
import asyncio
import httpx

AST_URL = "http://localhost:9000"
AST_SECRET = "ast_internal_xxx"

IVY_WORKFLOW = {
    "name": "Ivy",
    "description": "Assistente virtual do LivChat",
    "flowData": {
        "nodes": [
            {
                "id": "ivy_agent",
                "type": "agent",
                "name": "Ivy",
                "position": {"x": 300, "y": 200},
                "config": {
                    "prompt": {
                        "system": """Você é a Ivy, assistente virtual inteligente do LivChat.

Data atual: @current_datetime

Você ajuda desenvolvedores e empresas a integrar o WhatsApp em suas aplicações usando a API do LivChat.

Seja útil, amigável e concisa. Responda em português brasileiro.""",
                        "variables": ["current_datetime"]
                    },
                    "llm": {
                        "provider": "openai",
                        "model": "gpt-4o-mini",
                        "temperature": 0.7
                    },
                    "memory": {
                        "type": "buffer",
                        "tokenLimit": 16000,
                        "messageLimit": None
                    },
                    "tools": []
                }
            }
        ],
        "edges": []
    }
}

async def seed_ivy():
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{AST_URL}/workflows",
            json=IVY_WORKFLOW,
            headers={"Authorization": f"Bearer {AST_SECRET}"},
        )
        print(f"Created Ivy workflow: {response.json()}")

if __name__ == "__main__":
    asyncio.run(seed_ivy())
```

#### 8.3 Seed da Ivy no LivChat

**Script:** `scripts/seed-ivy-livchat.ts`

```typescript
import { db } from "~/server/db";
import { workflows } from "~/server/db/schema";

const IVY_PROVIDER_ID = "wf_ivy"; // ID retornado pelo seed do AST

async function seedIvy() {
  const existing = await db.query.workflows.findFirst({
    where: eq(workflows.providerId, IVY_PROVIDER_ID),
  });

  if (existing) {
    console.log("Ivy workflow already exists:", existing.id);
    return;
  }

  const [ivy] = await db
    .insert(workflows)
    .values({
      organizationId: null, // Sistema (sem dono)
      providerId: IVY_PROVIDER_ID,
      name: "Ivy",
      description: "Assistente virtual do LivChat",
    })
    .returning();

  console.log("Created Ivy workflow reference:", ivy.id);
}

seedIvy();
```

---

## Comandos de Execução

### AST (pytest)

```bash
cd /home/pedro/dev/sandbox/livchat/ast

# Rodar todos os testes
pytest

# Rodar testes de workflows
pytest tests/workflows/ -v

# Rodar com coverage
pytest --cov=src tests/
```

### LivChat (bun test)

```bash
cd /home/pedro/dev/sandbox/livchat/app

# Rodar todos os testes
bun test

# Rodar testes específicos
bun test tests/unit/server/api/routers/ivy.test.ts

# Watch mode
bun test --watch
```

### Migrations

```bash
cd /home/pedro/dev/sandbox/livchat/app

# Gerar migration
bun run db:generate

# Aplicar migrations
bun run db:migrate

# Push direto (dev)
bun run db:push
```

---

## Ordem de Implementação (TDD)

### Semana 1: AST Core

1. **Dia 1-2**: Schemas + Tests
   - [ ] Criar `workflow_schema.py`
   - [ ] Criar `test_workflow_schema.py`
   - [ ] Rodar testes: `pytest tests/workflows/test_workflow_schema.py`

2. **Dia 3-4**: Storage + Tests
   - [ ] Criar `workflows/storage.py`
   - [ ] Criar `test_workflow_storage.py`
   - [ ] Rodar testes

3. **Dia 5**: Template Processor + Tests
   - [ ] Criar `workflows/template_processor.py`
   - [ ] Criar `test_template_processor.py`
   - [ ] Rodar testes

### Semana 2: AST Agent + API

4. **Dia 1-2**: Workflow Agent + Tests
   - [ ] Criar `agents/workflow_agent.py`
   - [ ] Criar `test_workflow_agent.py`
   - [ ] Rodar testes

5. **Dia 3-4**: API Router + Tests
   - [ ] Criar `service/workflow_router.py`
   - [ ] Criar `test_workflow_router.py`
   - [ ] Rodar testes

6. **Dia 5**: Integration Tests
   - [ ] Testar CRUD completo
   - [ ] Testar invoke/stream
   - [ ] Configurar AUTH_SECRET

### Semana 3: LivChat

7. **Dia 1**: Database
   - [ ] Adicionar tabelas em `schema.ts`
   - [ ] Criar migration
   - [ ] Aplicar migration

8. **Dia 2-3**: Service Layer + Tests
   - [ ] Criar `lib/ast.ts`
   - [ ] Criar `lib/thread.ts`
   - [ ] Criar testes

9. **Dia 4-5**: tRPC Router + Tests
   - [ ] Criar `routers/ivy.ts`
   - [ ] Registrar em `root.ts`
   - [ ] Criar testes

### Semana 4: Integration + UI

10. **Dia 1-2**: Ivy UI
    - [ ] Atualizar `ai-chat-provider.tsx`
    - [ ] Testar streaming

11. **Dia 3**: Seeds
    - [ ] Criar workflow Ivy no AST
    - [ ] Criar referência no LivChat

12. **Dia 4-5**: E2E Testing
    - [ ] Testar fluxo completo
    - [ ] Ajustes finais

---

## Checklist Final

- [ ] AST: AUTH_SECRET configurado
- [ ] AST: Workflow Ivy criado
- [ ] AST: Testes passando
- [ ] LivChat: Migrations aplicadas
- [ ] LivChat: ENV vars configuradas
- [ ] LivChat: Referência Ivy criada
- [ ] LivChat: Ivy UI funcionando
- [ ] LivChat: Streaming funcionando
- [ ] LivChat: "Nova conversa" funcionando
