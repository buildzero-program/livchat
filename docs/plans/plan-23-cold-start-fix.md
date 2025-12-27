# Plan 23: Fix Cold Start - Async-Safe Model Cache

## Status: IN PROGRESS

Data: 2025-12-26

---

## Problema

A primeira chamada ao Gemini está demorando **~20 segundos** quando deveria demorar **~3-4 segundos**.

### Root Cause (Identificado)

1. **Blocking I/O na autenticação** - `ChatGoogleGenerativeAI` faz disk I/O bloqueante quando instanciado dentro de função
2. **`@cache` não é thread-safe para async** - `functools.cache` pode causar múltiplas inicializações concorrentes
3. **SDK desatualizado** - Usando `langchain-google-genai>=3.0.0`, disponível `4.1.2`

### Fontes
- [LangChain Support: ChatGoogleGenerativeAI Blocking Errors](https://support.langchain.com/articles/8574277609)
- [Issue #402: Slow ChatVertexAI initialization](https://github.com/langchain-ai/langchain-google/issues/402)
- [langchain-google-genai PyPI](https://pypi.org/project/langchain-google-genai/)

---

## Solução

### 1. Atualizar Dependências

```toml
# pyproject.toml
"langchain-google-genai >=4.1.0",  # Era >=3.0.0
"google-genai[aiohttp]",            # Novo - async performance
```

### 2. Refatorar llm.py

Substituir `@cache` síncrono por cache async-safe com lock:

```python
# ANTES
@cache
def get_model(model_name, provider):
    return ChatGoogleGenerativeAI(...)  # Blocking I/O

# DEPOIS
_MODEL_CACHE: dict[str, ModelT] = {}
_MODEL_CACHE_LOCK = asyncio.Lock()

async def get_model_async(model_name, provider) -> ModelT:
    cache_key = f"{provider}:{model_name}"

    if cache_key in _MODEL_CACHE:
        return _MODEL_CACHE[cache_key]

    async with _MODEL_CACHE_LOCK:
        if cache_key in _MODEL_CACHE:
            return _MODEL_CACHE[cache_key]

        model = _create_model_sync(model_name, provider)
        _MODEL_CACHE[cache_key] = model
        return model
```

### 3. Manter Compatibilidade

- `get_model()` síncrono continua funcionando (para código legado)
- `get_model_async()` é a nova API recomendada
- `workflow_agent.py` usa `get_model_async()`

---

## Implementação TDD

### Fase 1: Testes (RED)

```python
# tests/core/test_llm_async.py

@pytest.mark.asyncio
async def test_get_model_async_returns_model():
    model = await get_model_async("gemini-2.0-flash", provider="google")
    assert model is not None

@pytest.mark.asyncio
async def test_get_model_async_caches_result():
    model1 = await get_model_async("gpt-4o-mini", provider="openai")
    model2 = await get_model_async("gpt-4o-mini", provider="openai")
    assert model1 is model2  # Mesma instância

@pytest.mark.asyncio
async def test_get_model_async_concurrent_calls():
    # Múltiplas chamadas concorrentes devem retornar mesma instância
    results = await asyncio.gather(*[
        get_model_async("gemini-2.0-flash", provider="google")
        for _ in range(10)
    ])
    assert all(r is results[0] for r in results)

@pytest.mark.asyncio
async def test_get_model_async_different_models():
    model1 = await get_model_async("gpt-4o-mini", provider="openai")
    model2 = await get_model_async("gemini-2.0-flash", provider="google")
    assert model1 is not model2
```

### Fase 2: Implementação (GREEN)

1. Atualizar `pyproject.toml`
2. Criar `get_model_async()` em `llm.py`
3. Atualizar `workflow_agent.py` para usar `get_model_async()`

### Fase 3: Refactor

1. Adicionar logging de performance
2. Documentar nova API
3. Atualizar CHANGELOG

---

## Checklist

- [ ] Atualizar `pyproject.toml` com novas versões
- [ ] Escrever testes em `tests/core/test_llm_async.py`
- [ ] Implementar `get_model_async()` em `src/core/llm.py`
- [ ] Atualizar `src/agents/workflow_agent.py`
- [ ] Rodar testes
- [ ] Rebuild Docker
- [ ] Testar performance (cold start < 5s)
- [ ] Atualizar CHANGELOG

---

## Impacto Esperado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Cold start | ~20s | ~3-4s |
| Requests seguintes | ~2-3s | ~2-3s |
| Concorrência | Problemas | Seguro |

---

## Riscos

1. **Breaking change no SDK 4.x** - Testar thoroughly
2. **Compatibilidade com outros providers** - Manter `get_model()` sync
3. **Regressão de performance** - Alguns reportaram REST mais lento que gRPC

---

## Changelog

| Data | Mudança |
|------|---------|
| 2025-12-26 | Plano criado |
