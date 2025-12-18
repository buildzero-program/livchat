# Plan 14 - AST Model Registry: Descoberta Dinâmica de Modelos LLM

## Objetivo

Implementar um sistema de descoberta dinâmica de modelos LLM no AST, eliminando a necessidade de hardcoding e adicionando validação no momento de salvar workflows.

## Contexto

### Problema Atual

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUXO ATUAL (PROBLEMÁTICO)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Usuário salva workflow com model="gemini-3-flash"          │
│                         │                                       │
│                         ▼                                       │
│  2. Schema aceita (model: str = qualquer string)               │
│                         │                                       │
│                         ▼                                       │
│  3. Workflow salvo no banco ✅                                  │
│                         │                                       │
│                         ▼                                       │
│  4. Runtime: get_model_from_name("gemini-3-flash")             │
│                         │                                       │
│                         ▼                                       │
│  5. Não encontra no enum → FALLBACK SILENCIOSO para gpt-5-nano │
│                         │                                       │
│                         ▼                                       │
│  6. Usuário não sabe que está usando modelo errado! ❌         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Solução Proposta

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUXO NOVO (COM REGISTRY)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Startup: ModelRegistry.refresh_all()                        │
│     - Busca modelos de cada provider via SDK                    │
│     - Cacheia em memória (TTL 24h)                              │
│                         │                                       │
│                         ▼                                       │
│  2. Usuário salva workflow com model="gemini-3-flash"          │
│                         │                                       │
│                         ▼                                       │
│  3. Pydantic validator: registry.validate_model()               │
│                         │                                       │
│              ┌─────────┴─────────┐                             │
│              │                   │                              │
│         [Existe]           [Não Existe]                         │
│              │                   │                              │
│              ▼                   ▼                              │
│         Salva ✅          HTTP 400 ❌                           │
│                          "Modelo não disponível.                │
│                           Disponíveis: [...]"                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                      MODEL REGISTRY                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Provider Fetchers                     │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │   │
│  │  │  OpenAI  │ │ Anthropic│ │  Google  │ │   Groq   │   │   │
│  │  │ SDK .list│ │ SDK .list│ │ SDK .list│ │ SDK .list│   │   │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘   │   │
│  └───────┼────────────┼────────────┼────────────┼──────────┘   │
│          │            │            │            │               │
│          └────────────┴─────┬──────┴────────────┘               │
│                             ▼                                   │
│                   ┌─────────────────┐                           │
│                   │   In-Memory     │                           │
│                   │     Cache       │                           │
│                   │   TTL: 24h      │                           │
│                   └────────┬────────┘                           │
│                            │                                    │
│         ┌──────────────────┼──────────────────┐                │
│         ▼                  ▼                  ▼                │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐          │
│  │ GET /models │   │  Workflow   │   │  get_model  │          │
│  │  (list)     │   │  Validator  │   │  (runtime)  │          │
│  └─────────────┘   └─────────────┘   └─────────────┘          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### SDKs Disponíveis (já instalados)

| SDK | Versão | Método |
|-----|--------|--------|
| `openai` | 2.2.0 | `client.models.list()` |
| `anthropic` | 0.73.0 | `client.models.list()` |
| `groq` | 0.34.1 | `client.models.list()` |
| `google-genai` | 1.50.1 | `client.models.list()` |

---

## Fases de Implementação

### Fase 1: Core - ModelRegistry

#### 1.1 Schema de Modelo

**Arquivo:** `src/schema/model_info.py`

```python
from pydantic import BaseModel, Field
from enum import StrEnum


class ProviderName(StrEnum):
    """Providers suportados para descoberta dinâmica."""
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GOOGLE = "google"
    GROQ = "groq"
    XAI = "xai"  # Sem endpoint de discovery
    OLLAMA = "ollama"  # Local, sem discovery remoto


class ModelInfo(BaseModel):
    """Informações de um modelo LLM."""
    id: str = Field(..., description="ID do modelo (ex: gpt-4o-mini)")
    provider: ProviderName = Field(..., description="Provider do modelo")
    display_name: str | None = Field(None, description="Nome amigável")
    context_window: int | None = Field(None, description="Janela de contexto em tokens")
    is_available: bool = Field(True, description="Se está disponível para uso")


class ModelListResponse(BaseModel):
    """Resposta do endpoint /models."""
    models: list[ModelInfo]
    cached_at: str | None = Field(None, description="Timestamp do cache")
    ttl_seconds: int = Field(86400, description="TTL do cache em segundos")
```

**Testes:** `tests/core/test_model_info_schema.py`

```python
import pytest
from schema.model_info import ModelInfo, ProviderName, ModelListResponse


class TestModelInfoSchema:
    """Tests for ModelInfo schema."""

    def test_model_info_minimal(self):
        """Test ModelInfo with minimal fields."""
        model = ModelInfo(id="gpt-4o", provider=ProviderName.OPENAI)
        assert model.id == "gpt-4o"
        assert model.provider == ProviderName.OPENAI
        assert model.is_available is True

    def test_model_info_full(self):
        """Test ModelInfo with all fields."""
        model = ModelInfo(
            id="claude-sonnet-4-5",
            provider=ProviderName.ANTHROPIC,
            display_name="Claude Sonnet 4.5",
            context_window=200000,
            is_available=True,
        )
        assert model.display_name == "Claude Sonnet 4.5"
        assert model.context_window == 200000

    def test_provider_name_enum(self):
        """Test ProviderName enum values."""
        assert ProviderName.OPENAI == "openai"
        assert ProviderName.GOOGLE == "google"

    def test_model_list_response(self):
        """Test ModelListResponse structure."""
        response = ModelListResponse(
            models=[
                ModelInfo(id="gpt-4o", provider=ProviderName.OPENAI),
                ModelInfo(id="claude-sonnet-4-5", provider=ProviderName.ANTHROPIC),
            ],
            cached_at="2025-12-18T10:00:00Z",
        )
        assert len(response.models) == 2
        assert response.ttl_seconds == 86400
```

#### 1.2 ModelRegistry Core

**Arquivo:** `src/core/model_registry.py`

```python
"""
Model Registry: Descoberta dinâmica de modelos LLM.

Usa os SDKs nativos dos providers para listar modelos disponíveis,
com cache in-memory e fallback para lista estática.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import TypeAlias

from openai import AsyncOpenAI
from anthropic import AsyncAnthropic
from groq import AsyncGroq
from google import genai

from core.settings import settings
from schema.model_info import ModelInfo, ProviderName

logger = logging.getLogger(__name__)

# Cache TTL padrão: 24 horas
DEFAULT_CACHE_TTL = timedelta(hours=24)

# Timeout para requisições aos providers
PROVIDER_TIMEOUT = 10.0  # segundos


class CachedModels:
    """Container para modelos cacheados de um provider."""

    def __init__(self, models: list[ModelInfo], fetched_at: datetime):
        self.models = models
        self.fetched_at = fetched_at

    def is_expired(self, ttl: timedelta = DEFAULT_CACHE_TTL) -> bool:
        return datetime.utcnow() - self.fetched_at > ttl


# Fallback estático para quando APIs falham
FALLBACK_MODELS: dict[ProviderName, list[str]] = {
    ProviderName.OPENAI: [
        "gpt-5-nano",
        "gpt-5-mini",
        "gpt-5.1",
        "gpt-4o",
        "gpt-4o-mini",
    ],
    ProviderName.ANTHROPIC: [
        "claude-haiku-4-5",
        "claude-sonnet-4-5",
        "claude-opus-4-5",
    ],
    ProviderName.GOOGLE: [
        "gemini-1.5-pro",
        "gemini-2.0-flash",
        "gemini-2.5-flash",
        "gemini-2.5-pro",
        "gemini-3-flash-preview",
        "gemini-3-pro-preview",
    ],
    ProviderName.GROQ: [
        "llama-3.1-8b",
        "llama-3.3-70b",
    ],
    ProviderName.XAI: [
        "grok-3-beta",
        "grok-3-latest",
        "grok-4",
        "grok-4-fast-non-reasoning",
    ],
}


class ModelRegistry:
    """
    Registry central para descoberta e validação de modelos LLM.

    Features:
    - Descoberta dinâmica via SDKs nativos
    - Cache in-memory com TTL configurável
    - Fallback para lista estática se API falhar
    - Thread-safe para uso com asyncio
    """

    _instance: "ModelRegistry | None" = None
    _cache: dict[ProviderName, CachedModels]
    _lock: asyncio.Lock
    _initialized: bool

    def __new__(cls) -> "ModelRegistry":
        """Singleton pattern."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._cache = {}
            cls._instance._lock = asyncio.Lock()
            cls._instance._initialized = False
        return cls._instance

    async def initialize(self) -> None:
        """
        Inicializa o registry buscando modelos de todos os providers.
        Chamado no startup do serviço.
        """
        if self._initialized:
            return

        async with self._lock:
            if self._initialized:
                return

            logger.info("Initializing ModelRegistry...")
            await self.refresh_all()
            self._initialized = True
            logger.info("ModelRegistry initialized successfully")

    async def refresh_all(self) -> None:
        """Atualiza cache de todos os providers configurados."""
        providers = self._get_configured_providers()

        # Busca em paralelo
        tasks = [self._fetch_provider_models(p) for p in providers]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for provider, result in zip(providers, results):
            if isinstance(result, Exception):
                logger.warning(
                    f"Failed to fetch models from {provider}: {result}. Using fallback."
                )
                self._cache[provider] = CachedModels(
                    models=self._get_fallback_models(provider),
                    fetched_at=datetime.utcnow(),
                )
            else:
                self._cache[provider] = CachedModels(
                    models=result,
                    fetched_at=datetime.utcnow(),
                )

    def _get_configured_providers(self) -> list[ProviderName]:
        """Retorna providers que têm API key configurada."""
        providers = []

        if settings.OPENAI_API_KEY:
            providers.append(ProviderName.OPENAI)
        if settings.ANTHROPIC_API_KEY:
            providers.append(ProviderName.ANTHROPIC)
        if settings.GOOGLE_API_KEY:
            providers.append(ProviderName.GOOGLE)
        if settings.GROQ_API_KEY:
            providers.append(ProviderName.GROQ)
        if settings.XAI_API_KEY:
            providers.append(ProviderName.XAI)  # Usa fallback (sem endpoint)

        return providers

    async def _fetch_provider_models(
        self, provider: ProviderName
    ) -> list[ModelInfo]:
        """Busca modelos de um provider específico via SDK."""

        try:
            match provider:
                case ProviderName.OPENAI:
                    return await self._fetch_openai_models()
                case ProviderName.ANTHROPIC:
                    return await self._fetch_anthropic_models()
                case ProviderName.GOOGLE:
                    return await self._fetch_google_models()
                case ProviderName.GROQ:
                    return await self._fetch_groq_models()
                case ProviderName.XAI:
                    # XAI não tem endpoint de discovery
                    return self._get_fallback_models(provider)
                case _:
                    return self._get_fallback_models(provider)

        except Exception as e:
            logger.error(f"Error fetching {provider} models: {e}")
            raise

    async def _fetch_openai_models(self) -> list[ModelInfo]:
        """Busca modelos da OpenAI via SDK."""
        client = AsyncOpenAI(timeout=PROVIDER_TIMEOUT)
        response = await client.models.list()

        models = []
        for model in response.data:
            # Filtra apenas modelos de chat (gpt-*)
            if model.id.startswith(("gpt-", "o1-", "o3-")):
                models.append(ModelInfo(
                    id=model.id,
                    provider=ProviderName.OPENAI,
                    display_name=model.id,
                    is_available=True,
                ))

        return models

    async def _fetch_anthropic_models(self) -> list[ModelInfo]:
        """Busca modelos da Anthropic via SDK."""
        client = AsyncAnthropic(timeout=PROVIDER_TIMEOUT)
        response = await client.models.list()

        models = []
        for model in response.data:
            models.append(ModelInfo(
                id=model.id,
                provider=ProviderName.ANTHROPIC,
                display_name=getattr(model, "display_name", model.id),
                is_available=True,
            ))

        return models

    async def _fetch_google_models(self) -> list[ModelInfo]:
        """Busca modelos do Google via SDK."""
        client = genai.Client(api_key=settings.GOOGLE_API_KEY.get_secret_value())

        models = []
        for model in client.models.list():
            # Filtra apenas modelos Gemini
            if "gemini" in model.name.lower():
                # Extrai o nome limpo (remove "models/" prefix)
                model_id = model.name.replace("models/", "")
                models.append(ModelInfo(
                    id=model_id,
                    provider=ProviderName.GOOGLE,
                    display_name=getattr(model, "display_name", model_id),
                    context_window=getattr(model, "input_token_limit", None),
                    is_available=True,
                ))

        return models

    async def _fetch_groq_models(self) -> list[ModelInfo]:
        """Busca modelos do Groq via SDK."""
        client = AsyncGroq(timeout=PROVIDER_TIMEOUT)
        response = await client.models.list()

        models = []
        for model in response.data:
            models.append(ModelInfo(
                id=model.id,
                provider=ProviderName.GROQ,
                display_name=model.id,
                is_available=True,
            ))

        return models

    def _get_fallback_models(self, provider: ProviderName) -> list[ModelInfo]:
        """Retorna lista estática de fallback para um provider."""
        model_ids = FALLBACK_MODELS.get(provider, [])
        return [
            ModelInfo(id=mid, provider=provider, is_available=True)
            for mid in model_ids
        ]

    async def get_models(
        self,
        provider: ProviderName | None = None,
        force_refresh: bool = False,
    ) -> list[ModelInfo]:
        """
        Retorna modelos disponíveis.

        Args:
            provider: Filtrar por provider específico (None = todos)
            force_refresh: Forçar atualização do cache

        Returns:
            Lista de ModelInfo
        """
        if not self._initialized:
            await self.initialize()

        if force_refresh:
            await self.refresh_all()

        # Verifica se cache expirou
        for p, cached in list(self._cache.items()):
            if cached.is_expired():
                logger.info(f"Cache expired for {p}, refreshing...")
                try:
                    models = await self._fetch_provider_models(p)
                    self._cache[p] = CachedModels(models, datetime.utcnow())
                except Exception as e:
                    logger.warning(f"Refresh failed for {p}: {e}")

        # Coleta modelos
        if provider:
            cached = self._cache.get(provider)
            return cached.models if cached else []

        all_models = []
        for cached in self._cache.values():
            all_models.extend(cached.models)
        return all_models

    async def validate_model(
        self,
        model_id: str,
        provider: ProviderName | None = None,
    ) -> tuple[bool, str]:
        """
        Valida se um modelo existe e está disponível.

        Args:
            model_id: ID do modelo a validar
            provider: Provider esperado (opcional)

        Returns:
            Tupla (is_valid, error_message)
        """
        models = await self.get_models(provider=provider)
        model_ids = {m.id for m in models}

        if model_id in model_ids:
            return (True, "")

        # Modelo não encontrado - gera mensagem de erro útil
        available = sorted(model_ids)[:10]  # Limita a 10 sugestões
        if provider:
            msg = (
                f"Modelo '{model_id}' não disponível para {provider}. "
                f"Modelos disponíveis: {', '.join(available)}"
            )
        else:
            msg = (
                f"Modelo '{model_id}' não encontrado. "
                f"Exemplos disponíveis: {', '.join(available)}"
            )

        return (False, msg)

    async def get_model_info(self, model_id: str) -> ModelInfo | None:
        """Retorna informações de um modelo específico."""
        models = await self.get_models()
        for model in models:
            if model.id == model_id:
                return model
        return None

    def get_cache_info(self) -> dict[str, str | None]:
        """Retorna informações sobre o estado do cache."""
        return {
            provider.value: cached.fetched_at.isoformat() if cached else None
            for provider, cached in self._cache.items()
        }


# Singleton instance
model_registry = ModelRegistry()
```

**Testes:** `tests/core/test_model_registry.py`

```python
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timedelta

from core.model_registry import (
    ModelRegistry,
    CachedModels,
    FALLBACK_MODELS,
    DEFAULT_CACHE_TTL,
)
from schema.model_info import ModelInfo, ProviderName


class TestCachedModels:
    """Tests for CachedModels class."""

    def test_is_expired_fresh(self):
        """Test fresh cache is not expired."""
        cached = CachedModels(
            models=[],
            fetched_at=datetime.utcnow(),
        )
        assert cached.is_expired() is False

    def test_is_expired_old(self):
        """Test old cache is expired."""
        cached = CachedModels(
            models=[],
            fetched_at=datetime.utcnow() - timedelta(hours=25),
        )
        assert cached.is_expired() is True

    def test_is_expired_custom_ttl(self):
        """Test cache expiration with custom TTL."""
        cached = CachedModels(
            models=[],
            fetched_at=datetime.utcnow() - timedelta(hours=2),
        )
        # Not expired with default 24h TTL
        assert cached.is_expired() is False
        # Expired with 1h TTL
        assert cached.is_expired(ttl=timedelta(hours=1)) is True


class TestModelRegistry:
    """Tests for ModelRegistry class."""

    @pytest.fixture
    def registry(self):
        """Create fresh registry instance for each test."""
        # Reset singleton
        ModelRegistry._instance = None
        return ModelRegistry()

    @pytest.fixture
    def mock_settings(self):
        """Mock settings with API keys."""
        with patch("core.model_registry.settings") as mock:
            mock.OPENAI_API_KEY = MagicMock()
            mock.OPENAI_API_KEY.get_secret_value.return_value = "sk-test"
            mock.ANTHROPIC_API_KEY = MagicMock()
            mock.ANTHROPIC_API_KEY.get_secret_value.return_value = "sk-ant-test"
            mock.GOOGLE_API_KEY = MagicMock()
            mock.GOOGLE_API_KEY.get_secret_value.return_value = "AIza-test"
            mock.GROQ_API_KEY = MagicMock()
            mock.GROQ_API_KEY.get_secret_value.return_value = "gsk-test"
            mock.XAI_API_KEY = None
            yield mock

    def test_singleton(self):
        """Test ModelRegistry is singleton."""
        r1 = ModelRegistry()
        r2 = ModelRegistry()
        assert r1 is r2

    def test_get_fallback_models(self, registry):
        """Test fallback models for each provider."""
        for provider in ProviderName:
            models = registry._get_fallback_models(provider)
            if provider in FALLBACK_MODELS:
                assert len(models) > 0
                assert all(isinstance(m, ModelInfo) for m in models)
                assert all(m.provider == provider for m in models)

    @pytest.mark.asyncio
    async def test_validate_model_exists(self, registry, mock_settings):
        """Test validating existing model."""
        # Populate cache with fallback
        registry._cache[ProviderName.OPENAI] = CachedModels(
            models=[
                ModelInfo(id="gpt-4o", provider=ProviderName.OPENAI),
                ModelInfo(id="gpt-4o-mini", provider=ProviderName.OPENAI),
            ],
            fetched_at=datetime.utcnow(),
        )
        registry._initialized = True

        is_valid, msg = await registry.validate_model("gpt-4o")
        assert is_valid is True
        assert msg == ""

    @pytest.mark.asyncio
    async def test_validate_model_not_exists(self, registry, mock_settings):
        """Test validating non-existing model."""
        registry._cache[ProviderName.OPENAI] = CachedModels(
            models=[
                ModelInfo(id="gpt-4o", provider=ProviderName.OPENAI),
            ],
            fetched_at=datetime.utcnow(),
        )
        registry._initialized = True

        is_valid, msg = await registry.validate_model("gpt-100-mega")
        assert is_valid is False
        assert "gpt-100-mega" in msg
        assert "não" in msg.lower() or "not" in msg.lower()

    @pytest.mark.asyncio
    async def test_validate_model_with_provider(self, registry, mock_settings):
        """Test validating model with specific provider."""
        registry._cache[ProviderName.ANTHROPIC] = CachedModels(
            models=[
                ModelInfo(id="claude-sonnet-4-5", provider=ProviderName.ANTHROPIC),
            ],
            fetched_at=datetime.utcnow(),
        )
        registry._initialized = True

        is_valid, _ = await registry.validate_model(
            "claude-sonnet-4-5",
            provider=ProviderName.ANTHROPIC,
        )
        assert is_valid is True

    @pytest.mark.asyncio
    async def test_get_models_filtered(self, registry, mock_settings):
        """Test getting models filtered by provider."""
        registry._cache[ProviderName.OPENAI] = CachedModels(
            models=[ModelInfo(id="gpt-4o", provider=ProviderName.OPENAI)],
            fetched_at=datetime.utcnow(),
        )
        registry._cache[ProviderName.ANTHROPIC] = CachedModels(
            models=[ModelInfo(id="claude-sonnet-4-5", provider=ProviderName.ANTHROPIC)],
            fetched_at=datetime.utcnow(),
        )
        registry._initialized = True

        openai_models = await registry.get_models(provider=ProviderName.OPENAI)
        assert len(openai_models) == 1
        assert openai_models[0].id == "gpt-4o"

    @pytest.mark.asyncio
    async def test_get_models_all(self, registry, mock_settings):
        """Test getting all models."""
        registry._cache[ProviderName.OPENAI] = CachedModels(
            models=[ModelInfo(id="gpt-4o", provider=ProviderName.OPENAI)],
            fetched_at=datetime.utcnow(),
        )
        registry._cache[ProviderName.ANTHROPIC] = CachedModels(
            models=[ModelInfo(id="claude-sonnet-4-5", provider=ProviderName.ANTHROPIC)],
            fetched_at=datetime.utcnow(),
        )
        registry._initialized = True

        all_models = await registry.get_models()
        assert len(all_models) == 2

    @pytest.mark.asyncio
    async def test_get_model_info(self, registry, mock_settings):
        """Test getting info for specific model."""
        registry._cache[ProviderName.OPENAI] = CachedModels(
            models=[
                ModelInfo(
                    id="gpt-4o",
                    provider=ProviderName.OPENAI,
                    display_name="GPT-4o",
                    context_window=128000,
                )
            ],
            fetched_at=datetime.utcnow(),
        )
        registry._initialized = True

        info = await registry.get_model_info("gpt-4o")
        assert info is not None
        assert info.id == "gpt-4o"
        assert info.context_window == 128000

    @pytest.mark.asyncio
    async def test_get_model_info_not_found(self, registry, mock_settings):
        """Test getting info for non-existing model."""
        registry._cache[ProviderName.OPENAI] = CachedModels(
            models=[],
            fetched_at=datetime.utcnow(),
        )
        registry._initialized = True

        info = await registry.get_model_info("nonexistent")
        assert info is None

    def test_get_cache_info(self, registry):
        """Test getting cache status info."""
        now = datetime.utcnow()
        registry._cache[ProviderName.OPENAI] = CachedModels(
            models=[],
            fetched_at=now,
        )

        info = registry.get_cache_info()
        assert ProviderName.OPENAI.value in info
        assert info[ProviderName.OPENAI.value] is not None


class TestModelRegistryFetchers:
    """Tests for provider-specific fetchers."""

    @pytest.fixture
    def registry(self):
        ModelRegistry._instance = None
        return ModelRegistry()

    @pytest.mark.asyncio
    async def test_fetch_openai_models_mock(self, registry):
        """Test OpenAI fetcher with mocked client."""
        mock_response = MagicMock()
        mock_response.data = [
            MagicMock(id="gpt-4o", owned_by="openai"),
            MagicMock(id="gpt-4o-mini", owned_by="openai"),
            MagicMock(id="dall-e-3", owned_by="openai"),  # Should be filtered
        ]

        with patch("core.model_registry.AsyncOpenAI") as MockClient:
            mock_client = AsyncMock()
            mock_client.models.list.return_value = mock_response
            MockClient.return_value = mock_client

            models = await registry._fetch_openai_models()

            assert len(models) == 2
            assert all(m.provider == ProviderName.OPENAI for m in models)
            assert "dall-e-3" not in [m.id for m in models]

    @pytest.mark.asyncio
    async def test_fetch_anthropic_models_mock(self, registry):
        """Test Anthropic fetcher with mocked client."""
        mock_response = MagicMock()
        mock_response.data = [
            MagicMock(id="claude-sonnet-4-5", display_name="Claude Sonnet 4.5"),
            MagicMock(id="claude-haiku-4-5", display_name="Claude Haiku 4.5"),
        ]

        with patch("core.model_registry.AsyncAnthropic") as MockClient:
            mock_client = AsyncMock()
            mock_client.models.list.return_value = mock_response
            MockClient.return_value = mock_client

            models = await registry._fetch_anthropic_models()

            assert len(models) == 2
            assert all(m.provider == ProviderName.ANTHROPIC for m in models)

    @pytest.mark.asyncio
    async def test_fetch_groq_models_mock(self, registry):
        """Test Groq fetcher with mocked client."""
        mock_response = MagicMock()
        mock_response.data = [
            MagicMock(id="llama-3.1-8b"),
            MagicMock(id="llama-3.3-70b"),
        ]

        with patch("core.model_registry.AsyncGroq") as MockClient:
            mock_client = AsyncMock()
            mock_client.models.list.return_value = mock_response
            MockClient.return_value = mock_client

            models = await registry._fetch_groq_models()

            assert len(models) == 2
            assert all(m.provider == ProviderName.GROQ for m in models)
```

---

### Fase 2: Integração no Workflow

#### 2.1 Validator no Schema

**Modificar:** `src/schema/workflow_schema.py`

```python
from pydantic import BaseModel, Field, field_validator
from typing import Any

# Importar registry (lazy para evitar circular import)
_registry = None

def get_registry():
    global _registry
    if _registry is None:
        from core.model_registry import model_registry
        _registry = model_registry
    return _registry


class LLMConfig(BaseModel):
    """Configuração do LLM para um node do workflow."""

    provider: str = Field(default="openai", description="LLM provider name")
    model: str = Field(default="gpt-4o-mini", description="Model identifier")
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)

    @field_validator("model")
    @classmethod
    def validate_model_exists(cls, v: str) -> str:
        """
        Valida se o modelo existe no registry.

        NOTA: Esta validação é síncrona por limitação do Pydantic.
        Para validação completa async, usar validate_workflow_models().
        """
        # Validação básica: não vazio
        if not v or not v.strip():
            raise ValueError("Model name cannot be empty")
        return v.strip()


async def validate_workflow_models(workflow_data: dict) -> tuple[bool, list[str]]:
    """
    Valida todos os modelos de um workflow de forma assíncrona.

    Args:
        workflow_data: Dict com flowData do workflow

    Returns:
        Tupla (is_valid, list_of_errors)
    """
    registry = get_registry()
    errors = []

    flow_data = workflow_data.get("flowData", {})
    nodes = flow_data.get("nodes", [])

    for node in nodes:
        config = node.get("config", {})
        llm_config = config.get("llm", {})
        model_name = llm_config.get("model")

        if model_name:
            is_valid, error_msg = await registry.validate_model(model_name)
            if not is_valid:
                errors.append(f"Node '{node.get('id', 'unknown')}': {error_msg}")

    return (len(errors) == 0, errors)
```

**Testes:** `tests/workflows/test_workflow_model_validation.py`

```python
import pytest
from unittest.mock import AsyncMock, patch

from schema.workflow_schema import LLMConfig, validate_workflow_models


class TestLLMConfigValidation:
    """Tests for LLMConfig model validation."""

    def test_valid_model(self):
        """Test valid model name."""
        config = LLMConfig(model="gpt-4o-mini")
        assert config.model == "gpt-4o-mini"

    def test_empty_model_fails(self):
        """Test empty model name fails validation."""
        with pytest.raises(ValueError, match="cannot be empty"):
            LLMConfig(model="")

    def test_whitespace_model_fails(self):
        """Test whitespace-only model name fails."""
        with pytest.raises(ValueError, match="cannot be empty"):
            LLMConfig(model="   ")

    def test_model_trimmed(self):
        """Test model name is trimmed."""
        config = LLMConfig(model="  gpt-4o  ")
        assert config.model == "gpt-4o"


class TestValidateWorkflowModels:
    """Tests for async workflow model validation."""

    @pytest.fixture
    def mock_registry(self):
        """Mock model registry."""
        with patch("schema.workflow_schema.get_registry") as mock:
            registry = AsyncMock()
            mock.return_value = registry
            yield registry

    @pytest.mark.asyncio
    async def test_valid_workflow(self, mock_registry):
        """Test workflow with valid models."""
        mock_registry.validate_model.return_value = (True, "")

        workflow_data = {
            "flowData": {
                "nodes": [
                    {
                        "id": "agent_1",
                        "config": {
                            "llm": {"model": "gpt-4o-mini"}
                        }
                    }
                ]
            }
        }

        is_valid, errors = await validate_workflow_models(workflow_data)

        assert is_valid is True
        assert errors == []

    @pytest.mark.asyncio
    async def test_invalid_model(self, mock_registry):
        """Test workflow with invalid model."""
        mock_registry.validate_model.return_value = (
            False,
            "Modelo 'fake-model' não disponível",
        )

        workflow_data = {
            "flowData": {
                "nodes": [
                    {
                        "id": "agent_1",
                        "config": {
                            "llm": {"model": "fake-model"}
                        }
                    }
                ]
            }
        }

        is_valid, errors = await validate_workflow_models(workflow_data)

        assert is_valid is False
        assert len(errors) == 1
        assert "agent_1" in errors[0]
        assert "fake-model" in errors[0]

    @pytest.mark.asyncio
    async def test_multiple_invalid_models(self, mock_registry):
        """Test workflow with multiple invalid models."""
        mock_registry.validate_model.side_effect = [
            (False, "Modelo 'fake-1' não disponível"),
            (False, "Modelo 'fake-2' não disponível"),
        ]

        workflow_data = {
            "flowData": {
                "nodes": [
                    {"id": "node_1", "config": {"llm": {"model": "fake-1"}}},
                    {"id": "node_2", "config": {"llm": {"model": "fake-2"}}},
                ]
            }
        }

        is_valid, errors = await validate_workflow_models(workflow_data)

        assert is_valid is False
        assert len(errors) == 2

    @pytest.mark.asyncio
    async def test_empty_workflow(self, mock_registry):
        """Test empty workflow passes validation."""
        workflow_data = {"flowData": {"nodes": []}}

        is_valid, errors = await validate_workflow_models(workflow_data)

        assert is_valid is True
        assert errors == []
```

#### 2.2 Validação no Router

**Modificar:** `src/service/workflow_router.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from schema.workflow_schema import (
    WorkflowCreate,
    WorkflowUpdate,
    validate_workflow_models,
)

# ... outros imports ...

@router.post("", response_model=WorkflowResponse)
async def create_workflow_endpoint(
    data: WorkflowCreate,
    store=Depends(get_store),
    _=Depends(verify_bearer),
):
    """Cria um novo workflow com validação de modelos."""

    # Validar modelos antes de salvar
    is_valid, errors = await validate_workflow_models(data.model_dump())
    if not is_valid:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Workflow contém modelos inválidos",
                "errors": errors,
            }
        )

    workflow = await create_workflow(
        store=store,
        name=data.name,
        description=data.description,
        flow_data=data.flowData.model_dump(),
    )
    return WorkflowResponse(**workflow)


@router.patch("/{workflow_id}", response_model=WorkflowResponse)
async def update_workflow_endpoint(
    workflow_id: str,
    data: WorkflowUpdate,
    store=Depends(get_store),
    _=Depends(verify_bearer),
):
    """Atualiza um workflow com validação de modelos."""

    # Se flowData foi atualizado, validar modelos
    if data.flowData:
        is_valid, errors = await validate_workflow_models(
            {"flowData": data.flowData.model_dump()}
        )
        if not is_valid:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Workflow contém modelos inválidos",
                    "errors": errors,
                }
            )

    updates = data.model_dump(exclude_unset=True)
    if "flowData" in updates and updates["flowData"]:
        updates["flowData"] = updates["flowData"]

    workflow = await update_workflow(store, workflow_id, updates)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return WorkflowResponse(**workflow)
```

**Testes adicionais:** `tests/service/test_workflow_router_validation.py`

```python
import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch


class TestWorkflowRouterValidation:
    """Tests for workflow router model validation."""

    @pytest.fixture
    def client(self):
        from service.service import app
        return TestClient(app)

    @pytest.fixture
    def auth_header(self):
        return {"Authorization": "Bearer test-secret"}

    @pytest.mark.asyncio
    async def test_create_workflow_invalid_model(self, client, auth_header):
        """Test creating workflow with invalid model returns 400."""
        with patch("service.workflow_router.validate_workflow_models") as mock:
            mock.return_value = (False, ["Modelo 'fake' não disponível"])

            response = client.post(
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
                                "llm": {"model": "fake"},
                            }
                        }],
                        "edges": [],
                    }
                },
                headers=auth_header,
            )

            assert response.status_code == 400
            data = response.json()
            assert "errors" in data["detail"]
            assert len(data["detail"]["errors"]) > 0

    @pytest.mark.asyncio
    async def test_create_workflow_valid_model(self, client, auth_header):
        """Test creating workflow with valid model succeeds."""
        with patch("service.workflow_router.validate_workflow_models") as mock_validate:
            mock_validate.return_value = (True, [])

            with patch("service.workflow_router.create_workflow") as mock_create:
                mock_create.return_value = {
                    "id": "wf_123",
                    "name": "Test",
                    "description": None,
                    "flowData": {"nodes": [], "edges": []},
                    "isActive": True,
                    "createdAt": "2025-01-01T00:00:00",
                    "updatedAt": "2025-01-01T00:00:00",
                }

                response = client.post(
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
```

---

### Fase 3: Endpoints /models

#### 3.1 Model Router

**Arquivo:** `src/service/model_router.py`

```python
"""
Router para endpoints de modelos LLM.

Endpoints:
- GET /models - Lista todos os modelos disponíveis
- GET /models/{provider} - Lista modelos de um provider específico
- GET /models/info/{model_id} - Informações de um modelo específico
- POST /models/validate - Valida uma lista de modelos
- POST /models/refresh - Força atualização do cache
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from core.model_registry import model_registry
from schema.model_info import ModelInfo, ProviderName, ModelListResponse
from service.auth import verify_bearer

router = APIRouter(
    prefix="/models",
    tags=["models"],
    dependencies=[Depends(verify_bearer)],
)


class ValidateRequest(BaseModel):
    """Request body para validação de modelos."""
    models: list[str]


class ValidateResponse(BaseModel):
    """Response da validação de modelos."""
    valid: list[str]
    invalid: list[dict]  # {"model": str, "error": str}


class RefreshResponse(BaseModel):
    """Response do refresh de cache."""
    refreshed_at: str
    providers: list[str]


@router.get("", response_model=ModelListResponse)
async def list_models(
    provider: ProviderName | None = Query(None, description="Filtrar por provider"),
    force_refresh: bool = Query(False, description="Forçar atualização do cache"),
):
    """
    Lista modelos LLM disponíveis.

    - Sem parâmetros: retorna todos os modelos
    - Com `provider`: filtra por provider específico
    - Com `force_refresh=true`: atualiza cache antes de retornar
    """
    models = await model_registry.get_models(
        provider=provider,
        force_refresh=force_refresh,
    )

    cache_info = model_registry.get_cache_info()
    # Pega o timestamp mais recente
    cached_at = max(
        (v for v in cache_info.values() if v),
        default=None,
    )

    return ModelListResponse(
        models=models,
        cached_at=cached_at,
    )


@router.get("/providers", response_model=list[str])
async def list_providers():
    """Lista providers configurados (com API key)."""
    cache_info = model_registry.get_cache_info()
    return list(cache_info.keys())


@router.get("/info/{model_id}", response_model=ModelInfo | None)
async def get_model_info(model_id: str):
    """
    Retorna informações detalhadas de um modelo específico.

    Retorna 404 se modelo não encontrado.
    """
    info = await model_registry.get_model_info(model_id)
    if info is None:
        raise HTTPException(
            status_code=404,
            detail=f"Modelo '{model_id}' não encontrado",
        )
    return info


@router.post("/validate", response_model=ValidateResponse)
async def validate_models(request: ValidateRequest):
    """
    Valida uma lista de modelos.

    Útil para validar antes de criar/atualizar workflows.
    """
    valid = []
    invalid = []

    for model_id in request.models:
        is_valid, error = await model_registry.validate_model(model_id)
        if is_valid:
            valid.append(model_id)
        else:
            invalid.append({"model": model_id, "error": error})

    return ValidateResponse(valid=valid, invalid=invalid)


@router.post("/refresh", response_model=RefreshResponse)
async def refresh_cache():
    """
    Força atualização do cache de modelos.

    Busca novamente em todos os providers configurados.
    """
    await model_registry.refresh_all()
    cache_info = model_registry.get_cache_info()

    return RefreshResponse(
        refreshed_at=max(v for v in cache_info.values() if v),
        providers=list(cache_info.keys()),
    )
```

#### 3.2 Registrar Router

**Modificar:** `src/service/service.py`

```python
# Adicionar import
from service.model_router import router as model_router

# No final do arquivo, junto com outros routers:
app.include_router(model_router)
```

#### 3.3 Inicialização no Lifespan

**Modificar:** `src/service/service.py` (lifespan)

```python
from core.model_registry import model_registry

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Async context manager for FastAPI lifespan."""
    start = start_timer()

    # ... código existente de database init ...

    # Inicializar Model Registry
    log_timing("lifespan_model_registry_start", start)
    await model_registry.initialize()
    log_timing("lifespan_model_registry_done", start)

    # ... resto do código ...
```

**Testes:** `tests/service/test_model_router.py`

```python
import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch
from datetime import datetime

from schema.model_info import ModelInfo, ProviderName


class TestModelRouter:
    """Tests for model router endpoints."""

    @pytest.fixture
    def client(self):
        from service.service import app
        return TestClient(app)

    @pytest.fixture
    def auth_header(self):
        return {"Authorization": "Bearer test-secret"}

    @pytest.fixture
    def mock_registry(self):
        with patch("service.model_router.model_registry") as mock:
            mock.get_models = AsyncMock(return_value=[
                ModelInfo(id="gpt-4o", provider=ProviderName.OPENAI),
                ModelInfo(id="claude-sonnet-4-5", provider=ProviderName.ANTHROPIC),
            ])
            mock.get_cache_info.return_value = {
                "openai": "2025-12-18T10:00:00",
                "anthropic": "2025-12-18T10:00:00",
            }
            mock.get_model_info = AsyncMock()
            mock.validate_model = AsyncMock()
            mock.refresh_all = AsyncMock()
            yield mock

    def test_list_models(self, client, auth_header, mock_registry):
        """Test GET /models returns all models."""
        response = client.get("/models", headers=auth_header)

        assert response.status_code == 200
        data = response.json()
        assert "models" in data
        assert len(data["models"]) == 2
        assert data["cached_at"] is not None

    def test_list_models_filtered(self, client, auth_header, mock_registry):
        """Test GET /models?provider=openai filters correctly."""
        mock_registry.get_models.return_value = [
            ModelInfo(id="gpt-4o", provider=ProviderName.OPENAI),
        ]

        response = client.get(
            "/models?provider=openai",
            headers=auth_header,
        )

        assert response.status_code == 200
        mock_registry.get_models.assert_called_with(
            provider=ProviderName.OPENAI,
            force_refresh=False,
        )

    def test_list_providers(self, client, auth_header, mock_registry):
        """Test GET /models/providers returns configured providers."""
        response = client.get("/models/providers", headers=auth_header)

        assert response.status_code == 200
        data = response.json()
        assert "openai" in data
        assert "anthropic" in data

    def test_get_model_info_found(self, client, auth_header, mock_registry):
        """Test GET /models/info/{id} returns model info."""
        mock_registry.get_model_info.return_value = ModelInfo(
            id="gpt-4o",
            provider=ProviderName.OPENAI,
            display_name="GPT-4o",
            context_window=128000,
        )

        response = client.get("/models/info/gpt-4o", headers=auth_header)

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == "gpt-4o"
        assert data["context_window"] == 128000

    def test_get_model_info_not_found(self, client, auth_header, mock_registry):
        """Test GET /models/info/{id} returns 404 for unknown model."""
        mock_registry.get_model_info.return_value = None

        response = client.get("/models/info/nonexistent", headers=auth_header)

        assert response.status_code == 404

    def test_validate_models(self, client, auth_header, mock_registry):
        """Test POST /models/validate validates model list."""
        mock_registry.validate_model.side_effect = [
            (True, ""),
            (False, "Modelo 'fake' não disponível"),
        ]

        response = client.post(
            "/models/validate",
            json={"models": ["gpt-4o", "fake"]},
            headers=auth_header,
        )

        assert response.status_code == 200
        data = response.json()
        assert "gpt-4o" in data["valid"]
        assert len(data["invalid"]) == 1
        assert data["invalid"][0]["model"] == "fake"

    def test_refresh_cache(self, client, auth_header, mock_registry):
        """Test POST /models/refresh updates cache."""
        response = client.post("/models/refresh", headers=auth_header)

        assert response.status_code == 200
        mock_registry.refresh_all.assert_called_once()
        data = response.json()
        assert "refreshed_at" in data
        assert "providers" in data
```

---

## Comandos de Execução

### Testes TDD

```bash
cd /home/pedro/dev/sandbox/livchat/ast

# Fase 1: Schema
pytest tests/core/test_model_info_schema.py -v

# Fase 1: Registry Core
pytest tests/core/test_model_registry.py -v

# Fase 2: Workflow Validation
pytest tests/workflows/test_workflow_model_validation.py -v

# Fase 2: Router Validation
pytest tests/service/test_workflow_router_validation.py -v

# Fase 3: Model Router
pytest tests/service/test_model_router.py -v

# Todos os testes
pytest tests/ -v --tb=short

# Com coverage
pytest tests/ --cov=src --cov-report=term-missing
```

### Testar Endpoints

```bash
# Listar modelos
curl -H "Authorization: Bearer $AUTH_SECRET" http://localhost:9000/models

# Filtrar por provider
curl -H "Authorization: Bearer $AUTH_SECRET" "http://localhost:9000/models?provider=google"

# Info de modelo específico
curl -H "Authorization: Bearer $AUTH_SECRET" http://localhost:9000/models/info/gemini-3-flash-preview

# Validar modelos
curl -X POST -H "Authorization: Bearer $AUTH_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"models": ["gpt-4o", "fake-model"]}' \
  http://localhost:9000/models/validate

# Forçar refresh
curl -X POST -H "Authorization: Bearer $AUTH_SECRET" http://localhost:9000/models/refresh
```

---

## Ordem de Implementação (TDD)

### Dia 1: Schema + Registry Core

1. [ ] Criar `src/schema/model_info.py`
2. [ ] Criar `tests/core/test_model_info_schema.py`
3. [ ] Rodar testes: `pytest tests/core/test_model_info_schema.py -v`
4. [ ] Criar `src/core/model_registry.py` (estrutura básica)
5. [ ] Criar `tests/core/test_model_registry.py`
6. [ ] Implementar `ModelRegistry` até testes passarem

### Dia 2: Provider Fetchers

7. [ ] Implementar `_fetch_openai_models()`
8. [ ] Implementar `_fetch_anthropic_models()`
9. [ ] Implementar `_fetch_google_models()`
10. [ ] Implementar `_fetch_groq_models()`
11. [ ] Testar com mocks

### Dia 3: Integração Workflow

12. [ ] Modificar `src/schema/workflow_schema.py`
13. [ ] Criar `tests/workflows/test_workflow_model_validation.py`
14. [ ] Modificar `src/service/workflow_router.py`
15. [ ] Criar `tests/service/test_workflow_router_validation.py`

### Dia 4: Endpoints /models

16. [ ] Criar `src/service/model_router.py`
17. [ ] Criar `tests/service/test_model_router.py`
18. [ ] Registrar router em `service.py`
19. [ ] Adicionar inicialização no lifespan

### Dia 5: Testes de Integração + Deploy

20. [ ] Testar fluxo completo com Docker
21. [ ] Verificar logs e timing
22. [ ] Atualizar CHANGELOG.md
23. [ ] Deploy para staging

---

---

## Fase 4: Deprecar Enums Hardcoded + Refatorar Runtime

### 4.1 Problema Identificado

Após implementar as Fases 1-3, identificamos que o Model Registry funciona para **validação** e **listagem**, mas o **runtime** (`get_model_from_name()` em `workflow_agent.py`) ainda usa enums hardcoded:

```
┌─────────────────────────────────────────────────────────────────┐
│                    PROBLEMA NO RUNTIME                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Workflow salvo com model="gemini-3-flash-preview"          │
│     (validado pelo Model Registry) ✅                          │
│                         │                                       │
│                         ▼                                       │
│  2. Runtime: get_model_from_name("gemini-3-flash-preview")     │
│                         │                                       │
│                         ▼                                       │
│  3. Busca em _ALL_MODEL_ENUMS (hardcoded)                      │
│     GoogleModelName não tem gemini-3-flash-preview!            │
│                         │                                       │
│                         ▼                                       │
│  4. FALLBACK SILENCIOSO para DEFAULT_MODEL (gpt-5-nano) ❌     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Solução: Remover Enums + Usar Model Registry no Runtime

**Estratégia:**
1. Mover enums para `_deprecated_models.py` (backup para rollback)
2. Refatorar `get_model()` para aceitar strings
3. Criar `_detect_provider()` para auto-detectar provider
4. Modificar `workflow_agent.py` para usar Model Registry

### 4.3 Estrutura de Arquivos

```
src/schema/
├── models.py              # REFATORADO: só Provider enum
├── _deprecated_models.py  # NOVO: backup dos enums antigos
└── README.md              # NOVO: documentação da decisão

src/core/
├── llm.py                 # REFATORADO: get_model(model_id, provider)
└── model_registry.py      # EXISTENTE: já funciona

src/agents/
└── workflow_agent.py      # REFATORADO: usar Model Registry
```

### 4.4 Implementação

#### 4.4.1 Mover Enums para Deprecated

**Criar:** `src/schema/_deprecated_models.py`

```python
"""
DEPRECATED: Enums de modelos hardcoded.

Este arquivo contém os enums de modelos que foram substituídos pelo
Model Registry dinâmico (src/core/model_registry.py).

MANTIDO APENAS PARA ROLLBACK - NÃO USAR EM CÓDIGO NOVO.

Se precisar reverter:
1. Copiar este arquivo para models.py
2. Reverter imports em llm.py, workflow_agent.py, settings.py
3. Remover chamadas ao Model Registry

Data: 2025-12-18
Motivo: Model Registry dinâmico elimina necessidade de hardcoding
"""

from enum import StrEnum
from typing import TypeAlias


class OpenAIModelName(StrEnum):
    """OpenAI model names - DEPRECATED."""
    GPT_5_NANO = "gpt-5-nano"
    GPT_5_MINI = "gpt-5-mini"
    # ... resto dos modelos ...


class AnthropicModelName(StrEnum):
    """Anthropic model names - DEPRECATED."""
    HAIKU_45 = "claude-haiku-4-5"
    SONNET_45 = "claude-sonnet-4-5"
    OPUS_45 = "claude-opus-4-5"


class GoogleModelName(StrEnum):
    """Google model names - DEPRECATED."""
    GEMINI_15_PRO = "gemini-1.5-pro"
    GEMINI_20_FLASH = "gemini-2.0-flash"
    # ... resto ...


# ... outros enums ...


# AllModelEnum - DEPRECATED
AllModelEnum: TypeAlias = (
    OpenAIModelName
    | AnthropicModelName
    | GoogleModelName
    # | ...
)
```

**Criar:** `src/schema/README.md`

```markdown
# Schema - Decisões de Arquitetura

## Model Registry vs Enums Hardcoded (2025-12-18)

### Decisão

Substituímos os enums hardcoded de modelos (`OpenAIModelName`, `GoogleModelName`, etc.)
pelo **Model Registry dinâmico** (`src/core/model_registry.py`).

### Motivo

1. **Manutenção**: Novos modelos são descobertos automaticamente via SDK
2. **Redundância**: Model Registry já tem fallback estático próprio
3. **Bug**: Enums desatualizados causavam fallback silencioso para modelo errado

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
2. Reverter `src/core/llm.py` para versão anterior
3. Reverter `src/agents/workflow_agent.py` para versão anterior
4. Reverter `src/core/settings.py` para versão anterior

### Arquivos Afetados

- `src/schema/models.py` - Apenas `Provider` enum permanece
- `src/core/llm.py` - `get_model(model_id: str, provider: str | None)`
- `src/core/settings.py` - `DEFAULT_MODEL: str`, `AVAILABLE_MODELS: set[str]`
- `src/agents/workflow_agent.py` - Usa Model Registry diretamente
- `src/agents/llama_guard.py` - Usa string ao invés de enum
```

#### 4.4.2 Refatorar llm.py

**Modificar:** `src/core/llm.py`

```python
"""
LLM Model instantiation.

Provides get_model() for creating LangChain chat model instances.
Uses Model Registry for provider detection and validation.
"""

import logging
from functools import cache
from typing import TypeAlias

from langchain_anthropic import ChatAnthropic
from langchain_aws import ChatBedrock
from langchain_community.chat_models import FakeListChatModel
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_google_vertexai import ChatVertexAI
from langchain_groq import ChatGroq
from langchain_ollama import ChatOllama
from langchain_openai import AzureChatOpenAI, ChatOpenAI
from langchain_xai import ChatXAI

from core.settings import settings

logger = logging.getLogger(__name__)

# Type alias for all model types
ModelT: TypeAlias = (
    AzureChatOpenAI
    | ChatOpenAI
    | ChatAnthropic
    | ChatGoogleGenerativeAI
    | ChatVertexAI
    | ChatGroq
    | ChatXAI
    | ChatBedrock
    | ChatOllama
    | FakeListChatModel
)


def _detect_provider(model_id: str) -> str:
    """
    Auto-detect provider from model ID using heuristics.

    Args:
        model_id: Model identifier string

    Returns:
        Provider name string

    Raises:
        ValueError: If provider cannot be detected
    """
    model_lower = model_id.lower()

    # OpenAI patterns
    if model_lower.startswith(("gpt-", "o1-", "o3-")):
        return "openai"

    # Anthropic patterns
    if model_lower.startswith("claude-"):
        return "anthropic"

    # Google patterns
    if model_lower.startswith("gemini-"):
        return "google"

    # Groq patterns (Llama, Mixtral, etc.)
    if any(x in model_lower for x in ["llama", "mixtral", "gemma"]):
        return "groq"

    # XAI patterns
    if model_lower.startswith("grok-"):
        return "xai"

    # Deepseek patterns
    if model_lower.startswith("deepseek-"):
        return "deepseek"

    # AWS Bedrock patterns
    if "." in model_id and any(x in model_lower for x in ["anthropic", "amazon", "meta"]):
        return "aws"

    # Ollama (generic)
    if model_lower == "ollama" or settings.OLLAMA_BASE_URL:
        return "ollama"

    raise ValueError(
        f"Cannot detect provider for model '{model_id}'. "
        "Please specify provider explicitly."
    )


@cache
def get_model(model_id: str, provider: str | None = None) -> ModelT:
    """
    Get a LangChain chat model instance.

    Args:
        model_id: Model identifier (e.g., "gpt-5-nano", "claude-sonnet-4-5")
        provider: Provider name. If None, auto-detected from model_id.

    Returns:
        Configured chat model instance

    Raises:
        ValueError: If provider unknown or model unsupported
    """
    # Auto-detect provider if not specified
    if provider is None:
        provider = _detect_provider(model_id)

    logger.debug(f"Creating model: {model_id} (provider: {provider})")

    # Route to provider-specific instantiation
    match provider:
        case "openai":
            return ChatOpenAI(model=model_id, streaming=True)

        case "anthropic":
            return ChatAnthropic(model=model_id, temperature=0.5, streaming=True)

        case "google":
            return ChatGoogleGenerativeAI(
                model=model_id, temperature=0.5, streaming=True
            )

        case "groq":
            # Special case: Llama Guard needs temperature=0
            if "llama-guard" in model_id.lower():
                return ChatGroq(model=model_id, temperature=0.0)
            return ChatGroq(model=model_id, temperature=0.5)

        case "xai":
            return ChatXAI(
                model=model_id,
                temperature=0.5,
                streaming=True,
                xai_api_key=settings.XAI_API_KEY,
                search_parameters={
                    "mode": "auto",
                    "sources": [
                        {"type": "web"},
                        {"type": "x"},
                        {"type": "news"},
                    ],
                    "max_search_results": 20,
                    "return_citations": True,
                },
            )

        case "deepseek":
            return ChatOpenAI(
                model=model_id,
                temperature=0.5,
                streaming=True,
                openai_api_base="https://api.deepseek.com",
                openai_api_key=settings.DEEPSEEK_API_KEY,
            )

        case "aws":
            return ChatBedrock(model_id=model_id, temperature=0.5)

        case "ollama":
            actual_model = settings.OLLAMA_MODEL or model_id
            if settings.OLLAMA_BASE_URL:
                return ChatOllama(
                    model=actual_model,
                    temperature=0.5,
                    base_url=settings.OLLAMA_BASE_URL,
                )
            return ChatOllama(model=actual_model, temperature=0.5)

        case "openrouter":
            return ChatOpenAI(
                model=model_id,
                temperature=0.5,
                streaming=True,
                base_url="https://openrouter.ai/api/v1/",
                api_key=settings.OPENROUTER_API_KEY,
            )

        case "azure":
            if not settings.AZURE_OPENAI_API_KEY or not settings.AZURE_OPENAI_ENDPOINT:
                raise ValueError("Azure OpenAI API key and endpoint must be configured")
            return AzureChatOpenAI(
                azure_endpoint=settings.AZURE_OPENAI_ENDPOINT,
                deployment_name=model_id,
                api_version=settings.AZURE_OPENAI_API_VERSION,
                temperature=0.5,
                streaming=True,
            )

        case "vertexai":
            return ChatVertexAI(model=model_id, temperature=0.5, streaming=True)

        case "fake":
            return FakeListChatModel(
                responses=["This is a test response from the fake model."]
            )

        case _:
            raise ValueError(f"Unsupported provider: {provider}")
```

#### 4.4.3 Refatorar workflow_agent.py

**Modificar:** `src/agents/workflow_agent.py`

```python
"""
Workflow Agent - Dynamic agent that loads configuration from database.
"""

from langchain_core.messages import BaseMessage, SystemMessage
from langchain_core.runnables import RunnableConfig
from langgraph.func import entrypoint
from langgraph.store.base import BaseStore

from core.llm import get_model
from core.model_registry import model_registry
from core.settings import settings
from workflows import get_workflow, process_template


# REMOVIDO: _ALL_MODEL_ENUMS (não mais necessário)


def count_tokens_approx(messages: list[BaseMessage]) -> int:
    # ... (sem alterações)
    pass


def trim_messages(messages: list[BaseMessage], max_tokens: int | None) -> list[BaseMessage]:
    # ... (sem alterações)
    pass


async def get_model_from_name(model_name: str):
    """
    Get a model instance by string name using Model Registry.

    Uses Model Registry to validate and get provider info,
    then instantiates the model via get_model().

    Args:
        model_name: String name of the model (e.g., "gemini-3-flash-preview")

    Returns:
        Configured chat model instance
    """
    # Try Model Registry first (141+ models)
    model_info = await model_registry.get_model_info(model_name)

    if model_info:
        # Found in registry - use provider from registry
        return get_model(model_info.id, provider=model_info.provider.value)

    # Not in registry - try auto-detection
    try:
        return get_model(model_name)  # Auto-detect provider
    except ValueError:
        # Final fallback to default model
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(
            f"Model '{model_name}' not found in registry and provider could not be detected. "
            f"Falling back to DEFAULT_MODEL: {settings.DEFAULT_MODEL}"
        )
        return get_model(settings.DEFAULT_MODEL)


@entrypoint()
async def workflow_agent(
    inputs: dict[str, list[BaseMessage]],
    *,
    previous: dict[str, list[BaseMessage]],
    config: RunnableConfig,
    store: BaseStore,
):
    """Dynamic workflow agent that loads configuration from database."""
    # ... código existente até linha 231 ...

    # 8. Get model and invoke (MODIFICADO: await porque get_model_from_name é async)
    model = await get_model_from_name(model_name)

    # ... resto do código ...
```

#### 4.4.4 Atualizar Settings

**Modificar:** `src/core/settings.py`

```python
# ANTES
from schema.models import AllModelEnum, OpenAIModelName, ...

class Settings(BaseSettings):
    DEFAULT_MODEL: AllModelEnum | None = None
    AVAILABLE_MODELS: set[AllModelEnum] = set()

    def model_post_init(self, __context: Any) -> None:
        if self.OPENAI_API_KEY and not self.DEFAULT_MODEL:
            self.DEFAULT_MODEL = OpenAIModelName.GPT_5_NANO
        # ... popula AVAILABLE_MODELS com enums ...


# DEPOIS
class Settings(BaseSettings):
    DEFAULT_MODEL: str | None = None
    AVAILABLE_MODELS: set[str] = set()

    def model_post_init(self, __context: Any) -> None:
        # Set default based on configured provider
        if self.OPENAI_API_KEY and not self.DEFAULT_MODEL:
            self.DEFAULT_MODEL = "gpt-5-nano"
        elif self.ANTHROPIC_API_KEY and not self.DEFAULT_MODEL:
            self.DEFAULT_MODEL = "claude-sonnet-4-5"
        elif self.GOOGLE_API_KEY and not self.DEFAULT_MODEL:
            self.DEFAULT_MODEL = "gemini-2.5-flash"

        # NOTE: AVAILABLE_MODELS é populado no startup via Model Registry
        # Mantemos vazio aqui - será preenchido em service.py lifespan
```

#### 4.4.5 Atualizar llama_guard.py

**Modificar:** `src/agents/llama_guard.py`

```python
# ANTES
from schema.models import GroqModelName
model = get_model(GroqModelName.LLAMA_GUARD_4_12B)

# DEPOIS
from core.llm import get_model
model = get_model("meta-llama/llama-guard-4-12b", provider="groq")
```

### 4.5 Testes para Fase 4

**Criar:** `tests/core/test_llm_refactored.py`

```python
import pytest
from unittest.mock import patch, MagicMock

from core.llm import get_model, _detect_provider


class TestDetectProvider:
    """Tests for provider auto-detection."""

    def test_detect_openai(self):
        assert _detect_provider("gpt-5-nano") == "openai"
        assert _detect_provider("gpt-4o-mini") == "openai"
        assert _detect_provider("o1-preview") == "openai"

    def test_detect_anthropic(self):
        assert _detect_provider("claude-sonnet-4-5") == "anthropic"
        assert _detect_provider("claude-haiku-4-5") == "anthropic"

    def test_detect_google(self):
        assert _detect_provider("gemini-3-flash-preview") == "google"
        assert _detect_provider("gemini-2.5-pro") == "google"

    def test_detect_groq(self):
        assert _detect_provider("llama-3.3-70b") == "groq"
        assert _detect_provider("mixtral-8x7b") == "groq"

    def test_detect_xai(self):
        assert _detect_provider("grok-4") == "xai"
        assert _detect_provider("grok-3-beta") == "xai"

    def test_detect_unknown_raises(self):
        with pytest.raises(ValueError, match="Cannot detect provider"):
            _detect_provider("unknown-model-xyz")


class TestGetModel:
    """Tests for get_model with string interface."""

    @patch("core.llm.ChatOpenAI")
    def test_get_model_openai(self, mock_chat):
        mock_chat.return_value = MagicMock()
        model = get_model("gpt-5-nano")
        mock_chat.assert_called_with(model="gpt-5-nano", streaming=True)

    @patch("core.llm.ChatGoogleGenerativeAI")
    def test_get_model_google(self, mock_chat):
        mock_chat.return_value = MagicMock()
        model = get_model("gemini-3-flash-preview")
        mock_chat.assert_called_with(
            model="gemini-3-flash-preview",
            temperature=0.5,
            streaming=True,
        )

    @patch("core.llm.ChatAnthropic")
    def test_get_model_explicit_provider(self, mock_chat):
        mock_chat.return_value = MagicMock()
        model = get_model("claude-sonnet-4-5", provider="anthropic")
        mock_chat.assert_called_with(
            model="claude-sonnet-4-5",
            temperature=0.5,
            streaming=True,
        )

    def test_get_model_unsupported_provider(self):
        with pytest.raises(ValueError, match="Unsupported provider"):
            get_model("some-model", provider="unknown-provider")
```

**Criar:** `tests/agents/test_workflow_agent_registry.py`

```python
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from langchain_core.messages import HumanMessage, AIMessage

from agents.workflow_agent import get_model_from_name


class TestGetModelFromNameRegistry:
    """Tests for get_model_from_name with Model Registry integration."""

    @pytest.fixture
    def mock_registry(self):
        with patch("agents.workflow_agent.model_registry") as mock:
            yield mock

    @pytest.mark.asyncio
    async def test_model_found_in_registry(self, mock_registry):
        """Model found in registry should use registry provider."""
        from schema.model_info import ModelInfo, ProviderName

        mock_registry.get_model_info = AsyncMock(
            return_value=ModelInfo(
                id="gemini-3-flash-preview",
                provider=ProviderName.GOOGLE,
            )
        )

        with patch("agents.workflow_agent.get_model") as mock_get_model:
            mock_get_model.return_value = MagicMock()

            model = await get_model_from_name("gemini-3-flash-preview")

            mock_get_model.assert_called_with(
                "gemini-3-flash-preview",
                provider="google",
            )

    @pytest.mark.asyncio
    async def test_model_not_in_registry_autodetect(self, mock_registry):
        """Model not in registry should try auto-detection."""
        mock_registry.get_model_info = AsyncMock(return_value=None)

        with patch("agents.workflow_agent.get_model") as mock_get_model:
            mock_get_model.return_value = MagicMock()

            model = await get_model_from_name("gpt-5-nano")

            # Should call without explicit provider (auto-detect)
            mock_get_model.assert_called_with("gpt-5-nano")

    @pytest.mark.asyncio
    async def test_model_fallback_to_default(self, mock_registry):
        """Unknown model should fallback to DEFAULT_MODEL."""
        mock_registry.get_model_info = AsyncMock(return_value=None)

        with patch("agents.workflow_agent.get_model") as mock_get_model:
            # First call raises (auto-detect fails)
            # Second call succeeds (default model)
            mock_get_model.side_effect = [
                ValueError("Cannot detect provider"),
                MagicMock(),
            ]

            with patch("agents.workflow_agent.settings") as mock_settings:
                mock_settings.DEFAULT_MODEL = "gpt-5-nano"

                model = await get_model_from_name("completely-unknown-model")

                assert mock_get_model.call_count == 2
                mock_get_model.assert_called_with("gpt-5-nano")
```

---

### Ordem de Implementação - Fase 4

1. [ ] Criar `src/schema/_deprecated_models.py` (backup dos enums)
2. [ ] Criar `src/schema/README.md` (documentação)
3. [ ] Criar `tests/core/test_llm_refactored.py` (RED)
4. [ ] Refatorar `src/core/llm.py` (GREEN)
5. [ ] Criar `tests/agents/test_workflow_agent_registry.py` (RED)
6. [ ] Refatorar `src/agents/workflow_agent.py` (GREEN)
7. [ ] Atualizar `src/core/settings.py`
8. [ ] Atualizar `src/agents/llama_guard.py`
9. [ ] Atualizar todos os testes existentes (enum → string)
10. [ ] Rodar `pytest tests/ -v` - tudo deve passar
11. [ ] Testar com `gemini-3-flash-preview` no workflow

---

## Checklist Final

- [x] `src/schema/model_info.py` criado
- [x] `src/core/model_registry.py` criado
- [x] `src/service/model_router.py` criado
- [x] `src/schema/workflow_schema.py` modificado (validação)
- [x] `src/service/workflow_router.py` modificado (validação)
- [x] `src/service/service.py` modificado (registry init + router)
- [ ] **FASE 4:** `src/schema/_deprecated_models.py` criado (backup enums)
- [ ] **FASE 4:** `src/schema/README.md` criado (documentação)
- [ ] **FASE 4:** `src/core/llm.py` refatorado (string interface)
- [ ] **FASE 4:** `src/agents/workflow_agent.py` refatorado (Model Registry)
- [ ] **FASE 4:** `src/core/settings.py` atualizado (tipos string)
- [ ] **FASE 4:** `src/agents/llama_guard.py` atualizado (string)
- [ ] **FASE 4:** Todos os testes atualizados (enum → string)
- [ ] Testes passando: `pytest tests/ -v`
- [ ] Endpoints funcionando: `/models`, `/models/{provider}`, `/models/validate`
- [ ] Validação no workflow: erro 400 para modelos inválidos
- [ ] **Runtime funcionando:** `gemini-3-flash-preview` usa Google, não fallback
- [ ] Cache funcionando: TTL 24h
- [ ] CHANGELOG.md atualizado
