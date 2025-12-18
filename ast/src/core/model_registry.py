"""
Model Registry: Dynamic discovery of LLM models.

Uses native provider SDKs to list available models,
with in-memory cache and fallback to static list.
"""

import asyncio
import logging
from datetime import datetime, timedelta

from openai import AsyncOpenAI
from anthropic import AsyncAnthropic
from groq import AsyncGroq
from google import genai

from core.settings import settings
from schema.model_info import ModelInfo, ProviderName

logger = logging.getLogger(__name__)

# Cache TTL: 24 hours
DEFAULT_CACHE_TTL = timedelta(hours=24)

# Timeout for provider API requests
PROVIDER_TIMEOUT = 10.0


class CachedModels:
    """Container for cached models from a provider."""

    def __init__(self, models: list[ModelInfo], fetched_at: datetime):
        self.models = models
        self.fetched_at = fetched_at

    def is_expired(self, ttl: timedelta = DEFAULT_CACHE_TTL) -> bool:
        """Check if cache has expired."""
        return datetime.utcnow() - self.fetched_at > ttl


# Static fallback models when APIs are unavailable
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
    Central registry for LLM model discovery and validation.

    Features:
    - Dynamic discovery via native SDKs
    - In-memory cache with configurable TTL
    - Fallback to static list when APIs fail
    - Thread-safe for asyncio usage
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
        Initialize registry by fetching models from all providers.
        Called during service startup.
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
        """Refresh cache for all configured providers."""
        providers = self._get_configured_providers()

        # Fetch in parallel
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
        """Return providers that have API keys configured."""
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
            providers.append(ProviderName.XAI)

        return providers

    async def _fetch_provider_models(self, provider: ProviderName) -> list[ModelInfo]:
        """Fetch models from a specific provider via SDK."""
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
                    # XAI has no discovery endpoint
                    return self._get_fallback_models(provider)
                case _:
                    return self._get_fallback_models(provider)

        except Exception as e:
            logger.error(f"Error fetching {provider} models: {e}")
            raise

    async def _fetch_openai_models(self) -> list[ModelInfo]:
        """Fetch models from OpenAI via SDK."""
        client = AsyncOpenAI(timeout=PROVIDER_TIMEOUT)
        response = await client.models.list()

        models = []
        for model in response.data:
            # Filter only chat models (gpt-*, o1-*, o3-*)
            if model.id.startswith(("gpt-", "o1-", "o3-")):
                models.append(
                    ModelInfo(
                        id=model.id,
                        provider=ProviderName.OPENAI,
                        display_name=model.id,
                        is_available=True,
                    )
                )

        return models

    async def _fetch_anthropic_models(self) -> list[ModelInfo]:
        """Fetch models from Anthropic via SDK."""
        client = AsyncAnthropic(timeout=PROVIDER_TIMEOUT)
        response = await client.models.list()

        models = []
        for model in response.data:
            models.append(
                ModelInfo(
                    id=model.id,
                    provider=ProviderName.ANTHROPIC,
                    display_name=getattr(model, "display_name", model.id),
                    is_available=True,
                )
            )

        return models

    async def _fetch_google_models(self) -> list[ModelInfo]:
        """Fetch models from Google via SDK."""
        api_key = settings.GOOGLE_API_KEY
        if api_key:
            api_key_value = (
                api_key.get_secret_value() if hasattr(api_key, "get_secret_value") else api_key
            )
        else:
            return self._get_fallback_models(ProviderName.GOOGLE)

        client = genai.Client(api_key=api_key_value)

        models = []
        for model in client.models.list():
            # Filter only Gemini models
            if "gemini" in model.name.lower():
                # Remove "models/" prefix
                model_id = model.name.replace("models/", "")
                models.append(
                    ModelInfo(
                        id=model_id,
                        provider=ProviderName.GOOGLE,
                        display_name=getattr(model, "display_name", model_id),
                        context_window=getattr(model, "input_token_limit", None),
                        is_available=True,
                    )
                )

        return models

    async def _fetch_groq_models(self) -> list[ModelInfo]:
        """Fetch models from Groq via SDK."""
        client = AsyncGroq(timeout=PROVIDER_TIMEOUT)
        response = await client.models.list()

        models = []
        for model in response.data:
            models.append(
                ModelInfo(
                    id=model.id,
                    provider=ProviderName.GROQ,
                    display_name=model.id,
                    is_available=True,
                )
            )

        return models

    def _get_fallback_models(self, provider: ProviderName) -> list[ModelInfo]:
        """Return static fallback models for a provider."""
        model_ids = FALLBACK_MODELS.get(provider, [])
        return [ModelInfo(id=mid, provider=provider, is_available=True) for mid in model_ids]

    async def get_models(
        self,
        provider: ProviderName | None = None,
        force_refresh: bool = False,
    ) -> list[ModelInfo]:
        """
        Get available models.

        Args:
            provider: Filter by specific provider (None = all)
            force_refresh: Force cache refresh before returning

        Returns:
            List of ModelInfo
        """
        if not self._initialized:
            await self.initialize()

        if force_refresh:
            await self.refresh_all()

        # Check for expired cache entries
        for p, cached in list(self._cache.items()):
            if cached.is_expired():
                logger.info(f"Cache expired for {p}, refreshing...")
                try:
                    models = await self._fetch_provider_models(p)
                    self._cache[p] = CachedModels(models, datetime.utcnow())
                except Exception as e:
                    logger.warning(f"Refresh failed for {p}: {e}")

        # Collect models
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
        Validate if a model exists and is available.

        Args:
            model_id: Model ID to validate
            provider: Expected provider (optional)

        Returns:
            Tuple of (is_valid, error_message)
        """
        models = await self.get_models(provider=provider)
        model_ids = {m.id for m in models}

        if model_id in model_ids:
            return (True, "")

        # Model not found - generate helpful error message
        available = sorted(model_ids)[:10]  # Limit to 10 suggestions
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
        """Get detailed info for a specific model."""
        models = await self.get_models()
        for model in models:
            if model.id == model_id:
                return model
        return None

    def get_cache_info(self) -> dict[str, str | None]:
        """Return cache status information."""
        return {
            provider.value: cached.fetched_at.isoformat() if cached else None
            for provider, cached in self._cache.items()
        }


# Singleton instance
model_registry = ModelRegistry()
