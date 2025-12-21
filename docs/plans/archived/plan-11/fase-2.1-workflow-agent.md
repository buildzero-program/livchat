# Fase 2.1 - Workflow Agent

## Status: COMPLETA (24 testes passando)

## Objetivo

Implementar agent dinâmico que carrega configuração do workflow do banco de dados e executa com base nessa configuração.

---

## Exploração Realizada

### 1. Padrão @entrypoint() no AST

**Arquivo referência:** `src/agents/chatbot.py`

```python
@entrypoint()
async def chatbot(
    inputs: dict[str, list[BaseMessage]],
    *,
    previous: dict[str, list[BaseMessage]],
    config: RunnableConfig,
):
    messages = inputs["messages"]
    if previous:
        messages = previous["messages"] + messages

    model = get_model(config["configurable"].get("model", settings.DEFAULT_MODEL))
    response = await model.ainvoke(messages)
    return entrypoint.final(
        value={"messages": [response]},
        save={"messages": messages + [response]}
    )
```

**Parâmetros:**
- `inputs`: Nova mensagem de entrada `{"messages": [HumanMessage(...)]}`
- `previous`: Histórico anterior (do checkpointer)
- `config`: RunnableConfig com `configurable` dict

**Retorno:**
- `entrypoint.final(value={...}, save={...})`
  - `value`: Retornado ao cliente
  - `save`: Persistido no checkpointer

### 2. Acesso ao Store

**Padrão em StateGraph nodes:** `src/agents/interrupt_agent.py:77-79`

```python
async def determine_birthdate(
    state: AgentState,
    config: RunnableConfig,
    store: BaseStore  # Injetado pelo LangGraph
) -> AgentState:
```

**Para @entrypoint():** O store é configurado via `agent.store = store` no lifespan (`service.py:95`). O LangGraph injeta automaticamente se declarado como parâmetro.

### 3. get_model() Function

**Arquivo:** `src/core/llm.py`

- Retorna modelo com `streaming=True` e `temperature=0.5`
- Usa `@cache` decorator (singleton por modelo)
- Aceita enum de modelo, não string

**Problema:** O workflow armazena model name como string (e.g., "gpt-4o-mini"), mas `get_model()` aceita enum.

**Solução:** Criar mapper de string para enum ou modificar `get_model()`.

### 4. Memory/Trimming

**Não existe implementação no AST.** Preciso implementar:

```python
def count_tokens_approx(messages: list[BaseMessage]) -> int:
    """Aproximação: ~4 chars por token"""
    total_chars = sum(len(str(m.content)) for m in messages)
    return total_chars // 4

def trim_messages(
    messages: list[BaseMessage],
    max_tokens: int | None = 16000,
) -> list[BaseMessage]:
    """Mantém mensagens mais recentes dentro do limite"""
    if max_tokens is None or not messages:
        return messages

    result = []
    current_tokens = 0

    for msg in reversed(messages):
        msg_tokens = count_tokens_approx([msg])
        if current_tokens + msg_tokens <= max_tokens:
            result.insert(0, msg)
            current_tokens += msg_tokens
        else:
            break

    return result
```

### 5. Streaming

O streaming funciona automaticamente porque:
- `get_model()` retorna modelos com `streaming=True`
- O service usa `agent.astream(stream_mode=["updates", "messages", "custom"])`

### 6. Estrutura de Mensagens

**Input:** `{"messages": [HumanMessage(content="...")]}`
**Output:** `{"messages": [AIMessage(content="...")]}`

---

## Decisões Técnicas

### 1. Model Name Mapping

Para mapear string → enum, vou usar o pattern existente em `core/llm.py`:

```python
def get_model_from_name(model_name: str) -> ModelT:
    """Get model by string name instead of enum."""
    # Tentar encontrar enum correspondente
    for enum_cls in [OpenAIModelEnum, AnthropicModelEnum, ...]:
        for member in enum_cls:
            if member.value == model_name or member.name == model_name:
                return get_model(member)

    # Fallback para default
    return get_model(settings.DEFAULT_MODEL)
```

### 2. Store Access Pattern

O `@entrypoint()` pode receber `store` como parâmetro injetado:

```python
@entrypoint()
async def workflow_agent(
    inputs: dict[str, list[BaseMessage]],
    *,
    previous: dict[str, list[BaseMessage]],
    config: RunnableConfig,
    store: BaseStore,  # Injetado automaticamente
):
```

### 3. Workflow ID Source

O `workflow_id` vem do `config["configurable"]`:

```python
workflow_id = config["configurable"].get("workflow_id")
```

O cliente passa via `agent_config`:
```json
{
  "message": "Hello",
  "thread_id": "...",
  "agent_config": {"workflow_id": "wf_xxx"}
}
```

---

## Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `src/agents/workflow_agent.py` | Implementação do agent |
| `tests/workflows/test_workflow_agent.py` | Testes unitários |

---

## TDD - Casos de Teste

### Testes para count_tokens_approx

1. `test_count_tokens_approx_empty` - Lista vazia retorna 0
2. `test_count_tokens_approx_single_message` - Cálculo básico
3. `test_count_tokens_approx_multiple_messages` - Soma de múltiplas

### Testes para trim_messages

4. `test_trim_messages_empty` - Lista vazia retorna vazia
5. `test_trim_messages_under_limit` - Abaixo do limite retorna tudo
6. `test_trim_messages_over_limit` - Acima do limite corta antigas
7. `test_trim_messages_none_limit` - Limite None retorna tudo
8. `test_trim_messages_keeps_recent` - Mantém mensagens mais recentes

### Testes para workflow_agent

9. `test_workflow_agent_missing_workflow_id` - Erro se workflow_id ausente
10. `test_workflow_agent_workflow_not_found` - Erro se workflow não existe
11. `test_workflow_agent_empty_nodes` - Erro se workflow sem nodes
12. `test_workflow_agent_processes_template` - Template processado corretamente
13. `test_workflow_agent_merges_messages` - Histórico + nova mensagem
14. `test_workflow_agent_applies_memory_limit` - Trimming aplicado
15. `test_workflow_agent_returns_response` - Retorna resposta do modelo

---

## Próximos Passos

1. [ ] Criar testes em `tests/workflows/test_workflow_agent.py`
2. [ ] Rodar testes (RED)
3. [ ] Implementar `src/agents/workflow_agent.py`
4. [ ] Rodar testes (GREEN)
5. [ ] Registrar agent em `src/agents/agents.py`
