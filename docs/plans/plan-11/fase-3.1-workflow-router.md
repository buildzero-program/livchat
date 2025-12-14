# Fase 3.1 - Workflow Router

## Status: COMPLETA (17 testes passando)

## Objetivo

Implementar endpoints FastAPI para CRUD e execução de workflows.

---

## Exploração Realizada

### 1. Padrão de Routers no AST

**Arquivo:** `src/service/service.py`

```python
app = FastAPI(lifespan=lifespan)
router = APIRouter(dependencies=[Depends(verify_bearer)])

@router.post("/{agent_id}/invoke")
@router.post("/invoke")
async def invoke(...):
    ...

app.include_router(router)
```

### 2. Autenticação

**Função:** `verify_bearer` em `service.py:52-62`

- Usa `HTTPBearer` do FastAPI
- Valida `Authorization: Bearer <token>` contra `AUTH_SECRET`
- Se `AUTH_SECRET` não configurado, permite requisições sem auth

### 3. Acesso ao Store

O store é injetado nos agents no lifespan:
```python
agent.store = store
```

Para acessar nos endpoints:
```python
agent = get_agent("workflow-agent")
store = agent.store
```

### 4. Streaming (SSE)

**Formato:**
```
data: {"type": "message", "content": {...}}\n\n
data: {"type": "token", "content": "..."}\n\n
data: [DONE]\n\n
```

**Implementação:**
```python
@router.post("/stream", response_class=StreamingResponse)
async def stream(...):
    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
    )
```

### 5. Error Handling

```python
raise HTTPException(status_code=404, detail="Not found")
raise HTTPException(status_code=422, detail="Invalid input")
raise HTTPException(status_code=500, detail="Internal error")
```

---

## Decisões Técnicas

### 1. Estrutura de Endpoints

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/workflows` | POST | Criar workflow |
| `/workflows` | GET | Listar workflows |
| `/workflows/{id}` | GET | Obter workflow |
| `/workflows/{id}` | PATCH | Atualizar workflow |
| `/workflows/{id}` | DELETE | Deletar workflow |
| `/workflows/{id}/invoke` | POST | Executar workflow |
| `/workflows/{id}/stream` | POST | Streaming workflow |

### 2. Acesso ao Store

Usar `get_agent("workflow-agent").store` para acessar o store.

**Requisito:** Registrar workflow_agent em `agents.py` primeiro.

### 3. Thread ID

Para invoke/stream, gerar novo `thread_id` se não fornecido, ou usar o fornecido para continuar conversa.

---

## Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `src/service/workflow_router.py` | Router com endpoints |
| `src/agents/agents.py` | Registrar workflow_agent |
| `tests/workflows/test_workflow_router.py` | Testes unitários |

---

## TDD - Casos de Teste

### CRUD

1. `test_create_workflow_success` - Criar workflow retorna 200
2. `test_create_workflow_invalid_name` - Nome vazio retorna 422
3. `test_get_workflow_found` - GET retorna workflow
4. `test_get_workflow_not_found` - GET 404 se não existe
5. `test_list_workflows_empty` - Lista vazia retorna []
6. `test_list_workflows_with_items` - Lista retorna items
7. `test_update_workflow_success` - PATCH atualiza
8. `test_update_workflow_not_found` - PATCH 404
9. `test_delete_workflow_success` - DELETE 204
10. `test_delete_workflow_not_found` - DELETE 404

### Invoke/Stream

11. `test_invoke_workflow_success` - Retorna resposta
12. `test_invoke_workflow_not_found` - 404 se workflow não existe
13. `test_stream_workflow_returns_sse` - Retorna text/event-stream

### Auth

14. `test_endpoints_require_auth` - 401 sem Bearer token

---

## Próximos Passos

1. [ ] Registrar workflow_agent em agents.py
2. [ ] Criar testes
3. [ ] Implementar workflow_router.py
4. [ ] Registrar router em service.py
