"""Tests for ModelRegistry - dynamic model discovery."""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

from core.model_registry import (
    ModelRegistry,
    CachedModels,
    FALLBACK_MODELS,
    DEFAULT_CACHE_TTL,
)
from schema.model_info import ModelInfo, ProviderName


class TestCachedModels:
    """Tests for CachedModels helper class."""

    def test_is_expired_fresh(self):
        """Test fresh cache is not expired."""
        cached = CachedModels(
            models=[],
            fetched_at=datetime.utcnow(),
        )
        assert cached.is_expired() is False

    def test_is_expired_old(self):
        """Test old cache (>24h) is expired."""
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

    def test_stores_models(self):
        """Test CachedModels stores model list."""
        models = [
            ModelInfo(id="gpt-4o", provider=ProviderName.OPENAI),
            ModelInfo(id="gpt-4o-mini", provider=ProviderName.OPENAI),
        ]
        cached = CachedModels(models=models, fetched_at=datetime.utcnow())
        assert len(cached.models) == 2
        assert cached.models[0].id == "gpt-4o"


class TestModelRegistrySingleton:
    """Tests for ModelRegistry singleton pattern."""

    def test_singleton_pattern(self):
        """Test ModelRegistry is singleton."""
        # Reset singleton for test
        ModelRegistry._instance = None

        r1 = ModelRegistry()
        r2 = ModelRegistry()
        assert r1 is r2

    def test_singleton_preserves_state(self):
        """Test singleton preserves internal state."""
        ModelRegistry._instance = None

        r1 = ModelRegistry()
        r1._initialized = True

        r2 = ModelRegistry()
        assert r2._initialized is True


class TestModelRegistryFallback:
    """Tests for fallback models."""

    @pytest.fixture
    def registry(self):
        """Create fresh registry for each test."""
        ModelRegistry._instance = None
        return ModelRegistry()

    def test_fallback_models_exist(self, registry):
        """Test fallback models defined for main providers."""
        assert ProviderName.OPENAI in FALLBACK_MODELS
        assert ProviderName.ANTHROPIC in FALLBACK_MODELS
        assert ProviderName.GOOGLE in FALLBACK_MODELS
        assert ProviderName.GROQ in FALLBACK_MODELS

    def test_get_fallback_models_openai(self, registry):
        """Test getting fallback models for OpenAI."""
        models = registry._get_fallback_models(ProviderName.OPENAI)
        assert len(models) > 0
        assert all(isinstance(m, ModelInfo) for m in models)
        assert all(m.provider == ProviderName.OPENAI for m in models)

    def test_get_fallback_models_google(self, registry):
        """Test getting fallback models for Google."""
        models = registry._get_fallback_models(ProviderName.GOOGLE)
        assert len(models) > 0
        # Should include gemini-3-flash-preview
        model_ids = [m.id for m in models]
        assert "gemini-3-flash-preview" in model_ids

    def test_get_fallback_models_unknown(self, registry):
        """Test getting fallback for unknown provider returns empty."""
        models = registry._get_fallback_models(ProviderName.OLLAMA)
        # OLLAMA not in FALLBACK_MODELS, should return empty
        assert models == []


class TestModelRegistryValidation:
    """Tests for model validation."""

    @pytest.fixture
    def registry(self):
        """Create registry with pre-populated cache."""
        ModelRegistry._instance = None
        reg = ModelRegistry()
        reg._cache[ProviderName.OPENAI] = CachedModels(
            models=[
                ModelInfo(id="gpt-4o", provider=ProviderName.OPENAI),
                ModelInfo(id="gpt-4o-mini", provider=ProviderName.OPENAI),
            ],
            fetched_at=datetime.utcnow(),
        )
        reg._cache[ProviderName.ANTHROPIC] = CachedModels(
            models=[
                ModelInfo(id="claude-sonnet-4-5", provider=ProviderName.ANTHROPIC),
            ],
            fetched_at=datetime.utcnow(),
        )
        reg._initialized = True
        return reg

    @pytest.mark.asyncio
    async def test_validate_model_exists(self, registry):
        """Test validating existing model returns True."""
        is_valid, msg = await registry.validate_model("gpt-4o")
        assert is_valid is True
        assert msg == ""

    @pytest.mark.asyncio
    async def test_validate_model_not_exists(self, registry):
        """Test validating non-existing model returns False with message."""
        is_valid, msg = await registry.validate_model("gpt-100-mega")
        assert is_valid is False
        assert "gpt-100-mega" in msg
        assert "não" in msg.lower() or "not" in msg.lower()

    @pytest.mark.asyncio
    async def test_validate_model_with_provider_filter(self, registry):
        """Test validating with specific provider."""
        # claude-sonnet-4-5 exists in Anthropic
        is_valid, _ = await registry.validate_model(
            "claude-sonnet-4-5",
            provider=ProviderName.ANTHROPIC,
        )
        assert is_valid is True

        # gpt-4o does NOT exist in Anthropic
        is_valid, msg = await registry.validate_model(
            "gpt-4o",
            provider=ProviderName.ANTHROPIC,
        )
        assert is_valid is False

    @pytest.mark.asyncio
    async def test_validate_error_message_suggests_alternatives(self, registry):
        """Test error message includes available models."""
        is_valid, msg = await registry.validate_model("nonexistent")
        assert is_valid is False
        # Should suggest at least one available model
        assert "gpt-4o" in msg or "claude" in msg


class TestModelRegistryGetModels:
    """Tests for getting models from registry."""

    @pytest.fixture
    def registry(self):
        """Create registry with pre-populated cache."""
        ModelRegistry._instance = None
        reg = ModelRegistry()
        reg._cache[ProviderName.OPENAI] = CachedModels(
            models=[ModelInfo(id="gpt-4o", provider=ProviderName.OPENAI)],
            fetched_at=datetime.utcnow(),
        )
        reg._cache[ProviderName.ANTHROPIC] = CachedModels(
            models=[ModelInfo(id="claude-sonnet-4-5", provider=ProviderName.ANTHROPIC)],
            fetched_at=datetime.utcnow(),
        )
        reg._initialized = True
        return reg

    @pytest.mark.asyncio
    async def test_get_models_all(self, registry):
        """Test getting all models from all providers."""
        models = await registry.get_models()
        assert len(models) == 2

    @pytest.mark.asyncio
    async def test_get_models_filtered_by_provider(self, registry):
        """Test getting models filtered by provider."""
        models = await registry.get_models(provider=ProviderName.OPENAI)
        assert len(models) == 1
        assert models[0].id == "gpt-4o"

    @pytest.mark.asyncio
    async def test_get_models_unknown_provider(self, registry):
        """Test getting models for unconfigured provider returns empty."""
        models = await registry.get_models(provider=ProviderName.GROQ)
        assert models == []

    @pytest.mark.asyncio
    async def test_get_model_info_found(self, registry):
        """Test getting info for specific model."""
        info = await registry.get_model_info("gpt-4o")
        assert info is not None
        assert info.id == "gpt-4o"
        assert info.provider == ProviderName.OPENAI

    @pytest.mark.asyncio
    async def test_get_model_info_not_found(self, registry):
        """Test getting info for non-existing model returns None."""
        info = await registry.get_model_info("nonexistent")
        assert info is None


class TestModelRegistryCacheInfo:
    """Tests for cache info methods."""

    @pytest.fixture
    def registry(self):
        """Create registry with cache."""
        ModelRegistry._instance = None
        reg = ModelRegistry()
        now = datetime.utcnow()
        reg._cache[ProviderName.OPENAI] = CachedModels(models=[], fetched_at=now)
        return reg

    def test_get_cache_info(self, registry):
        """Test getting cache status info."""
        info = registry.get_cache_info()
        assert ProviderName.OPENAI.value in info
        assert info[ProviderName.OPENAI.value] is not None

    def test_get_cache_info_empty(self):
        """Test cache info when cache is empty."""
        ModelRegistry._instance = None
        reg = ModelRegistry()
        info = reg.get_cache_info()
        assert info == {}


class TestModelRegistryFetchers:
    """Tests for provider-specific fetchers with mocks."""

    @pytest.fixture
    def registry(self):
        """Create fresh registry."""
        ModelRegistry._instance = None
        return ModelRegistry()

    @pytest.mark.asyncio
    async def test_fetch_openai_models_filters_non_chat(self, registry):
        """Test OpenAI fetcher filters non-chat models."""
        mock_response = MagicMock()
        mock_response.data = [
            MagicMock(id="gpt-4o", owned_by="openai"),
            MagicMock(id="gpt-4o-mini", owned_by="openai"),
            MagicMock(id="dall-e-3", owned_by="openai"),  # Should be filtered
            MagicMock(id="whisper-1", owned_by="openai"),  # Should be filtered
            MagicMock(id="o1-preview", owned_by="openai"),  # Should be included
        ]

        with patch("core.model_registry.AsyncOpenAI") as MockClient:
            mock_client = AsyncMock()
            mock_client.models.list.return_value = mock_response
            MockClient.return_value = mock_client

            models = await registry._fetch_openai_models()

            # Should include gpt-*, o1-*, o3-* only
            assert len(models) == 3
            model_ids = [m.id for m in models]
            assert "gpt-4o" in model_ids
            assert "gpt-4o-mini" in model_ids
            assert "o1-preview" in model_ids
            assert "dall-e-3" not in model_ids

    @pytest.mark.asyncio
    async def test_fetch_anthropic_models(self, registry):
        """Test Anthropic fetcher."""
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
    async def test_fetch_groq_models(self, registry):
        """Test Groq fetcher."""
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


class TestModelRegistryInitialization:
    """Tests for registry initialization."""

    @pytest.fixture
    def registry(self):
        """Create fresh registry."""
        ModelRegistry._instance = None
        return ModelRegistry()

    @pytest.fixture
    def mock_settings(self):
        """Mock settings with API keys."""
        with patch("core.model_registry.settings") as mock:
            mock.OPENAI_API_KEY = MagicMock()
            mock.OPENAI_API_KEY.get_secret_value.return_value = "sk-test"
            mock.ANTHROPIC_API_KEY = None
            mock.GOOGLE_API_KEY = None
            mock.GROQ_API_KEY = None
            mock.XAI_API_KEY = None
            yield mock

    def test_get_configured_providers(self, registry, mock_settings):
        """Test detecting configured providers from settings."""
        providers = registry._get_configured_providers()
        assert ProviderName.OPENAI in providers
        assert ProviderName.ANTHROPIC not in providers

    @pytest.mark.asyncio
    async def test_initialize_only_once(self, registry, mock_settings):
        """Test initialize is idempotent."""
        with patch.object(registry, "refresh_all", new_callable=AsyncMock) as mock_refresh:
            await registry.initialize()
            await registry.initialize()  # Second call

            # Should only refresh once
            mock_refresh.assert_called_once()

    @pytest.mark.asyncio
    async def test_refresh_all_uses_fallback_on_error(self, registry, mock_settings):
        """Test refresh_all uses fallback when API fails."""
        with patch.object(
            registry, "_fetch_provider_models", side_effect=Exception("API Error")
        ):
            await registry.refresh_all()

            # Should have fallback models for OpenAI
            cached = registry._cache.get(ProviderName.OPENAI)
            assert cached is not None
            assert len(cached.models) > 0
