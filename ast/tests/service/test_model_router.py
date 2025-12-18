"""Tests for model router endpoints."""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime

from schema.model_info import ModelInfo, ProviderName


class TestModelRouter:
    """Tests for /models endpoints."""

    @pytest.fixture
    def mock_registry(self):
        """Mock model registry for all tests."""
        with patch("service.model_router.model_registry") as mock:
            # Setup default return values
            mock.get_models = AsyncMock(
                return_value=[
                    ModelInfo(id="gpt-4o", provider=ProviderName.OPENAI),
                    ModelInfo(id="claude-sonnet-4-5", provider=ProviderName.ANTHROPIC),
                ]
            )
            mock.get_cache_info.return_value = {
                "openai": "2025-12-18T10:00:00",
                "anthropic": "2025-12-18T10:00:00",
            }
            mock.get_model_info = AsyncMock()
            mock.validate_model = AsyncMock()
            mock.refresh_all = AsyncMock()
            yield mock

    @pytest.fixture
    def mock_settings(self):
        """Mock settings for auth."""
        with patch("service.model_router.settings") as mock:
            mock.AUTH_SECRET = None  # Disable auth for tests
            yield mock

    @pytest.fixture
    def client(self, mock_registry, mock_settings):
        """Create test client with mocked dependencies."""
        from service.model_router import router
        from fastapi import FastAPI

        app = FastAPI()
        app.include_router(router)
        return TestClient(app)


class TestListModels(TestModelRouter):
    """Tests for GET /models endpoint."""

    def test_list_models_returns_all(self, client, mock_registry):
        """Test listing all models."""
        response = client.get("/models")

        assert response.status_code == 200
        data = response.json()
        assert "models" in data
        assert len(data["models"]) == 2
        assert data["cached_at"] is not None

    def test_list_models_filtered_by_provider(self, client, mock_registry):
        """Test filtering models by provider."""
        mock_registry.get_models.return_value = [
            ModelInfo(id="gpt-4o", provider=ProviderName.OPENAI),
        ]

        response = client.get("/models?provider=openai")

        assert response.status_code == 200
        mock_registry.get_models.assert_called_with(
            provider=ProviderName.OPENAI,
            force_refresh=False,
        )

    def test_list_models_force_refresh(self, client, mock_registry):
        """Test force refresh parameter."""
        response = client.get("/models?force_refresh=true")

        assert response.status_code == 200
        mock_registry.get_models.assert_called_with(
            provider=None,
            force_refresh=True,
        )

    def test_list_models_empty(self, client, mock_registry):
        """Test listing when no models available."""
        mock_registry.get_models.return_value = []
        mock_registry.get_cache_info.return_value = {}

        response = client.get("/models")

        assert response.status_code == 200
        data = response.json()
        assert data["models"] == []


class TestListProviders(TestModelRouter):
    """Tests for GET /models/providers endpoint."""

    def test_list_providers(self, client, mock_registry):
        """Test listing configured providers."""
        response = client.get("/models/providers")

        assert response.status_code == 200
        data = response.json()
        assert "openai" in data
        assert "anthropic" in data

    def test_list_providers_empty(self, client, mock_registry):
        """Test when no providers configured."""
        mock_registry.get_cache_info.return_value = {}

        response = client.get("/models/providers")

        assert response.status_code == 200
        assert response.json() == []


class TestGetModelInfo(TestModelRouter):
    """Tests for GET /models/info/{model_id} endpoint."""

    def test_get_model_info_found(self, client, mock_registry):
        """Test getting info for existing model."""
        mock_registry.get_model_info.return_value = ModelInfo(
            id="gpt-4o",
            provider=ProviderName.OPENAI,
            display_name="GPT-4o",
            context_window=128000,
        )

        response = client.get("/models/info/gpt-4o")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == "gpt-4o"
        assert data["context_window"] == 128000

    def test_get_model_info_not_found(self, client, mock_registry):
        """Test getting info for non-existing model."""
        mock_registry.get_model_info.return_value = None

        response = client.get("/models/info/nonexistent")

        assert response.status_code == 404
        assert "nonexistent" in response.json()["detail"]


class TestValidateModels(TestModelRouter):
    """Tests for POST /models/validate endpoint."""

    def test_validate_models_all_valid(self, client, mock_registry):
        """Test validating all valid models."""
        mock_registry.validate_model.return_value = (True, "")

        response = client.post(
            "/models/validate",
            json={"models": ["gpt-4o", "claude-sonnet-4-5"]},
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["valid"]) == 2
        assert len(data["invalid"]) == 0

    def test_validate_models_some_invalid(self, client, mock_registry):
        """Test validating with some invalid models."""
        mock_registry.validate_model.side_effect = [
            (True, ""),
            (False, "Modelo 'fake' não disponível"),
        ]

        response = client.post(
            "/models/validate",
            json={"models": ["gpt-4o", "fake"]},
        )

        assert response.status_code == 200
        data = response.json()
        assert "gpt-4o" in data["valid"]
        assert len(data["invalid"]) == 1
        assert data["invalid"][0]["model"] == "fake"

    def test_validate_models_empty_list(self, client, mock_registry):
        """Test validating empty list."""
        response = client.post(
            "/models/validate",
            json={"models": []},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["valid"] == []
        assert data["invalid"] == []


class TestRefreshCache(TestModelRouter):
    """Tests for POST /models/refresh endpoint."""

    def test_refresh_cache(self, client, mock_registry):
        """Test refreshing model cache."""
        response = client.post("/models/refresh")

        assert response.status_code == 200
        mock_registry.refresh_all.assert_called_once()
        data = response.json()
        assert "refreshed_at" in data
        assert "providers" in data

    def test_refresh_cache_returns_providers(self, client, mock_registry):
        """Test refresh returns updated providers."""
        response = client.post("/models/refresh")

        assert response.status_code == 200
        data = response.json()
        assert "openai" in data["providers"]
        assert "anthropic" in data["providers"]
