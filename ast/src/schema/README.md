# Schema - Decisões de Arquitetura

## Model Registry vs Enums Hardcoded (2025-12-18)

### Decisão

Substituímos os enums hardcoded de modelos (`OpenAIModelName`, `GoogleModelName`, etc.)
pelo **Model Registry dinâmico** (`src/core/model_registry.py`).

### Motivo

1. **Manutenção**: Novos modelos são descobertos automaticamente via SDK
2. **Redundância**: Model Registry já tem fallback estático próprio
3. **Bug**: Enums desatualizados causavam fallback silencioso para modelo errado
   - Ex: `gemini-3-flash-preview` não estava no `GoogleModelName`
   - Runtime fazia fallback para `gpt-5-nano` sem avisar

### Como Funciona Agora

```python
# ANTES (hardcoded)
from schema.models import OpenAIModelName
model = get_model(OpenAIModelName.GPT_5_NANO)

# DEPOIS (dinâmico)
model = get_model("gpt-5-nano")  # Provider auto-detectado
# ou
model = get_model("gpt-5-nano", provider="openai")  # Explícito
```

### Rollback (se necessário)

Os enums antigos estão preservados em `_deprecated_models.py`.

Para reverter:

1. Copiar conteúdo de `_deprecated_models.py` para `models.py`
2. Reverter `src/core/llm.py` para versão anterior (git checkout)
3. Reverter `src/agents/workflow_agent.py` para versão anterior
4. Reverter `src/core/settings.py` para versão anterior

### Arquivos Afetados

| Arquivo | Mudança |
|---------|---------|
| `src/schema/models.py` | Apenas `Provider` enum permanece |
| `src/core/llm.py` | `get_model(model_id: str, provider: str \| None)` |
| `src/core/settings.py` | `DEFAULT_MODEL: str`, `AVAILABLE_MODELS: set[str]` |
| `src/agents/workflow_agent.py` | Usa Model Registry diretamente |
| `src/agents/llama_guard.py` | Usa string ao invés de enum |

### Model Registry Features

- **Descoberta dinâmica**: Via SDKs nativos (OpenAI, Anthropic, Google, Groq)
- **Cache in-memory**: TTL de 24 horas
- **Fallback estático**: Se API falhar, usa lista pré-definida
- **Validação**: Endpoint `/models/validate` para verificar antes de salvar
- **141+ modelos**: Descobertos automaticamente no startup
