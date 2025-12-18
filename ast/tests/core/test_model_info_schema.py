"""Tests for ModelInfo schema."""

import pytest
from schema.model_info import ModelInfo, ProviderName, ModelListResponse


class TestProviderName:
    """Tests for ProviderName enum."""

    def test_provider_values(self):
        """Test ProviderName enum values."""
        assert ProviderName.OPENAI == "openai"
        assert ProviderName.ANTHROPIC == "anthropic"
        assert ProviderName.GOOGLE == "google"
        assert ProviderName.GROQ == "groq"
        assert ProviderName.XAI == "xai"
        assert ProviderName.OLLAMA == "ollama"

    def test_provider_from_string(self):
        """Test creating ProviderName from string."""
        assert ProviderName("openai") == ProviderName.OPENAI
        assert ProviderName("google") == ProviderName.GOOGLE


class TestModelInfo:
    """Tests for ModelInfo schema."""

    def test_model_info_minimal(self):
        """Test ModelInfo with minimal required fields."""
        model = ModelInfo(id="gpt-4o", provider=ProviderName.OPENAI)
        assert model.id == "gpt-4o"
        assert model.provider == ProviderName.OPENAI
        assert model.is_available is True
        assert model.display_name is None
        assert model.context_window is None

    def test_model_info_full(self):
        """Test ModelInfo with all fields."""
        model = ModelInfo(
            id="claude-sonnet-4-5",
            provider=ProviderName.ANTHROPIC,
            display_name="Claude Sonnet 4.5",
            context_window=200000,
            is_available=True,
        )
        assert model.id == "claude-sonnet-4-5"
        assert model.display_name == "Claude Sonnet 4.5"
        assert model.context_window == 200000
        assert model.is_available is True

    def test_model_info_unavailable(self):
        """Test ModelInfo with is_available=False."""
        model = ModelInfo(
            id="deprecated-model",
            provider=ProviderName.OPENAI,
            is_available=False,
        )
        assert model.is_available is False

    def test_model_info_serialization(self):
        """Test ModelInfo serializes to dict correctly."""
        model = ModelInfo(
            id="gpt-4o",
            provider=ProviderName.OPENAI,
            display_name="GPT-4o",
        )
        data = model.model_dump()
        assert data["id"] == "gpt-4o"
        assert data["provider"] == "openai"
        assert data["display_name"] == "GPT-4o"


class TestModelListResponse:
    """Tests for ModelListResponse schema."""

    def test_response_with_models(self):
        """Test ModelListResponse with models."""
        response = ModelListResponse(
            models=[
                ModelInfo(id="gpt-4o", provider=ProviderName.OPENAI),
                ModelInfo(id="claude-sonnet-4-5", provider=ProviderName.ANTHROPIC),
            ],
            cached_at="2025-12-18T10:00:00Z",
        )
        assert len(response.models) == 2
        assert response.cached_at == "2025-12-18T10:00:00Z"
        assert response.ttl_seconds == 86400  # Default 24h

    def test_response_empty_models(self):
        """Test ModelListResponse with empty models list."""
        response = ModelListResponse(models=[])
        assert len(response.models) == 0
        assert response.cached_at is None

    def test_response_custom_ttl(self):
        """Test ModelListResponse with custom TTL."""
        response = ModelListResponse(
            models=[],
            ttl_seconds=3600,  # 1 hour
        )
        assert response.ttl_seconds == 3600

    def test_response_serialization(self):
        """Test ModelListResponse serializes correctly."""
        response = ModelListResponse(
            models=[ModelInfo(id="gpt-4o", provider=ProviderName.OPENAI)],
            cached_at="2025-12-18T10:00:00Z",
        )
        data = response.model_dump()
        assert "models" in data
        assert len(data["models"]) == 1
        assert data["cached_at"] == "2025-12-18T10:00:00Z"
