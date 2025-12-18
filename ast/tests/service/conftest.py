from unittest.mock import AsyncMock, Mock, patch

import pytest
from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage

from service import app


@pytest.fixture
def test_client(mock_settings):
    """Fixture to create a FastAPI test client with auth disabled by default."""
    # Default: disable auth for most tests
    if not hasattr(mock_settings, "_auth_configured"):
        mock_settings.AUTH_SECRET = None
        mock_settings.LANGFUSE_TRACING = False
    yield TestClient(app)


@pytest.fixture
def mock_agent():
    """Fixture to create a mock agent that can be configured for different test scenarios."""
    agent_mock = AsyncMock()
    agent_mock.ainvoke = AsyncMock(
        return_value=[("values", {"messages": [AIMessage(content="Test response")]})]
    )
    agent_mock.get_state = Mock()  # Default empty mock for get_state
    with patch("service.service.get_agent", Mock(return_value=agent_mock)):
        yield agent_mock


@pytest.fixture
def mock_settings():
    """Fixture to mock settings for tests."""
    with patch("service.service.settings") as settings_mock:
        # Set default values
        settings_mock.AUTH_SECRET = None
        settings_mock.LANGFUSE_TRACING = False
        yield settings_mock


@pytest.fixture
def mock_httpx():
    """Patch httpx.stream and httpx.get to use our test client."""
    # Disable auth for e2e tests
    with patch("service.service.settings") as mock_settings:
        mock_settings.AUTH_SECRET = None
        mock_settings.LANGFUSE_TRACING = False
        mock_settings.AVAILABLE_MODELS = ["gpt-5-nano", "gpt-5-mini"]
        mock_settings.DEFAULT_MODEL = "gpt-5-nano"

        with TestClient(app) as client:

            def mock_stream(method: str, url: str, **kwargs):
                # Strip the base URL since TestClient expects just the path
                path = url.replace("http://0.0.0.0", "")
                return client.stream(method, path, **kwargs)

            def mock_get(url: str, **kwargs):
                # Strip the base URL since TestClient expects just the path
                path = url.replace("http://0.0.0.0", "")
                return client.get(path, **kwargs)

            with patch("httpx.stream", mock_stream):
                with patch("httpx.get", mock_get):
                    yield
