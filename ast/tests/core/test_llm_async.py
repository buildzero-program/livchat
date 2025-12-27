"""
Tests for async-safe model caching in llm.py.

These tests verify that get_model_async():
1. Returns valid model instances
2. Caches results properly (same instance returned)
3. Handles concurrent calls safely (only one initialization)
4. Works with different providers
"""

import asyncio
from unittest.mock import MagicMock, patch

import pytest


class TestGetModelAsync:
    """Tests for the async model getter with caching."""

    @pytest.fixture(autouse=True)
    def clear_cache(self):
        """Clear model cache before each test."""
        from core.llm import clear_model_cache

        clear_model_cache()
        yield
        clear_model_cache()

    @pytest.mark.asyncio
    async def test_get_model_async_returns_model(self):
        """get_model_async should return a valid model instance."""
        from core.llm import get_model_async

        with patch("core.llm._create_model_sync") as mock_create:
            mock_model = MagicMock()
            mock_create.return_value = mock_model

            model = await get_model_async("gpt-4o-mini", provider="openai")

            assert model is mock_model
            mock_create.assert_called_once_with("gpt-4o-mini", "openai")

    @pytest.mark.asyncio
    async def test_get_model_async_caches_result(self):
        """Second call should return cached instance, not create new one."""
        from core.llm import get_model_async

        with patch("core.llm._create_model_sync") as mock_create:
            mock_model = MagicMock()
            mock_create.return_value = mock_model

            model1 = await get_model_async("gpt-4o-mini", provider="openai")
            model2 = await get_model_async("gpt-4o-mini", provider="openai")

            assert model1 is model2
            assert mock_create.call_count == 1  # Only created once

    @pytest.mark.asyncio
    async def test_get_model_async_different_models_different_instances(self):
        """Different models should have different instances."""
        from core.llm import get_model_async

        with patch("core.llm._create_model_sync") as mock_create:
            mock_model1 = MagicMock(name="model1")
            mock_model2 = MagicMock(name="model2")
            mock_create.side_effect = [mock_model1, mock_model2]

            model1 = await get_model_async("gpt-4o-mini", provider="openai")
            model2 = await get_model_async("gemini-2.0-flash", provider="google")

            assert model1 is not model2
            assert mock_create.call_count == 2

    @pytest.mark.asyncio
    async def test_get_model_async_concurrent_calls_single_init(self):
        """
        Concurrent calls for same model should only initialize once.

        This is the key test - it verifies the async lock prevents
        multiple initializations when many requests arrive simultaneously.
        """
        from core.llm import get_model_async

        init_count = 0
        init_event = asyncio.Event()

        def slow_create(model_name, provider):
            nonlocal init_count
            init_count += 1
            # Simulate slow initialization
            return MagicMock(name=f"model-{init_count}")

        with patch("core.llm._create_model_sync", side_effect=slow_create):
            # Launch 10 concurrent requests
            tasks = [get_model_async("gemini-2.0-flash", provider="google") for _ in range(10)]
            results = await asyncio.gather(*tasks)

            # All should get the same instance
            assert all(r is results[0] for r in results)
            # Should only have initialized once
            assert init_count == 1

    @pytest.mark.asyncio
    async def test_get_model_async_auto_detects_provider(self):
        """Should auto-detect provider from model name if not specified."""
        from core.llm import get_model_async

        with patch("core.llm._create_model_sync") as mock_create:
            mock_model = MagicMock()
            mock_create.return_value = mock_model

            await get_model_async("gemini-2.0-flash")  # No provider specified

            # Should have detected "google" as provider
            mock_create.assert_called_once()
            call_args = mock_create.call_args
            assert call_args[0][1] == "google"  # provider arg

    @pytest.mark.asyncio
    async def test_get_model_async_openai_detection(self):
        """Should detect OpenAI provider from gpt- prefix."""
        from core.llm import get_model_async

        with patch("core.llm._create_model_sync") as mock_create:
            mock_model = MagicMock()
            mock_create.return_value = mock_model

            await get_model_async("gpt-4o-mini")

            call_args = mock_create.call_args
            assert call_args[0][1] == "openai"

    @pytest.mark.asyncio
    async def test_get_model_async_anthropic_detection(self):
        """Should detect Anthropic provider from claude- prefix."""
        from core.llm import get_model_async

        with patch("core.llm._create_model_sync") as mock_create:
            mock_model = MagicMock()
            mock_create.return_value = mock_model

            await get_model_async("claude-3-sonnet")

            call_args = mock_create.call_args
            assert call_args[0][1] == "anthropic"


class TestClearModelCache:
    """Tests for cache clearing functionality."""

    @pytest.mark.asyncio
    async def test_clear_model_cache_removes_all(self):
        """clear_model_cache should remove all cached models."""
        from core.llm import clear_model_cache, get_model_async

        with patch("core.llm._create_model_sync") as mock_create:
            mock_create.return_value = MagicMock()

            # Add to cache
            await get_model_async("gpt-4o-mini", provider="openai")
            assert mock_create.call_count == 1

            # Clear cache
            clear_model_cache()

            # Should create again
            await get_model_async("gpt-4o-mini", provider="openai")
            assert mock_create.call_count == 2


class TestGetModelCacheStats:
    """Tests for cache statistics."""

    @pytest.fixture(autouse=True)
    def clear_cache(self):
        """Clear model cache before each test."""
        from core.llm import clear_model_cache

        clear_model_cache()
        yield
        clear_model_cache()

    @pytest.mark.asyncio
    async def test_get_model_cache_stats(self):
        """Should return cache statistics."""
        from core.llm import get_model_async, get_model_cache_stats

        with patch("core.llm._create_model_sync") as mock_create:
            mock_create.return_value = MagicMock()

            # Empty cache
            stats = get_model_cache_stats()
            assert stats["entries"] == 0

            # Add one model
            await get_model_async("gpt-4o-mini", provider="openai")
            stats = get_model_cache_stats()
            assert stats["entries"] == 1

            # Add another model
            await get_model_async("gemini-2.0-flash", provider="google")
            stats = get_model_cache_stats()
            assert stats["entries"] == 2
