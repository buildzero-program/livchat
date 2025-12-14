"""Tests for workflow router endpoints."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient
from fastapi import FastAPI

from service.workflow_router import router
from schema.workflow_schema import WorkflowResponse


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def app():
    """Create a test FastAPI app with the workflow router."""
    app = FastAPI()
    app.include_router(router)
    return app


@pytest.fixture
def client(app):
    """Create a test client."""
    return TestClient(app)


@pytest.fixture
def auth_header():
    """Auth header for protected endpoints."""
    return {"Authorization": "Bearer test-secret"}


@pytest.fixture
def mock_store():
    """Create a mock store."""
    store = AsyncMock()
    return store


@pytest.fixture
def sample_workflow():
    """Sample workflow data."""
    return {
        "id": "wf_test123abc",
        "name": "Test Workflow",
        "description": "A test workflow",
        "flowData": {
            "nodes": [
                {
                    "id": "agent_1",
                    "type": "agent",
                    "name": "Test Agent",
                    "position": {"x": 0, "y": 0},
                    "config": {
                        "prompt": {"system": "You are helpful.", "variables": []},
                        "llm": {"provider": "openai", "model": "gpt-5-mini", "temperature": 0.7},
                        "memory": {"type": "buffer", "tokenLimit": 16000, "messageLimit": None},
                        "tools": [],
                    },
                }
            ],
            "edges": [],
        },
        "isActive": True,
        "createdAt": "2024-12-14T10:00:00",
        "updatedAt": "2024-12-14T10:00:00",
    }


@pytest.fixture
def sample_create_payload():
    """Sample payload for creating a workflow."""
    return {
        "name": "New Workflow",
        "description": "A new workflow",
        "flowData": {
            "nodes": [
                {
                    "id": "agent_1",
                    "type": "agent",
                    "name": "Agent",
                    "config": {
                        "prompt": {"system": "You are helpful."},
                        "llm": {"model": "gpt-5-mini"},
                    },
                }
            ],
            "edges": [],
        },
    }


# =============================================================================
# Helper to mock get_agent and store
# =============================================================================


def mock_get_agent_with_store(store):
    """Create a mock agent with store."""
    mock_agent = MagicMock()
    mock_agent.store = store
    mock_agent.checkpointer = MagicMock()
    return mock_agent


# =============================================================================
# Tests for CREATE workflow
# =============================================================================


def test_create_workflow_success(client, auth_header, mock_store, sample_create_payload, sample_workflow):
    """POST /workflows should create a workflow and return 200."""
    with patch("service.workflow_router.get_agent") as mock_get_agent:
        with patch("service.workflow_router.create_workflow", new_callable=AsyncMock) as mock_create:
            mock_get_agent.return_value = mock_get_agent_with_store(mock_store)
            mock_create.return_value = sample_workflow

            response = client.post("/workflows", json=sample_create_payload, headers=auth_header)

            assert response.status_code == 200
            data = response.json()
            assert data["id"] == "wf_test123abc"
            assert data["name"] == "Test Workflow"


def test_create_workflow_invalid_empty_name(client, auth_header, mock_store):
    """POST /workflows with empty name should return 422."""
    payload = {
        "name": "",  # Empty name
        "flowData": {"nodes": [], "edges": []},
    }

    with patch("service.workflow_router.get_agent") as mock_get_agent:
        mock_get_agent.return_value = mock_get_agent_with_store(mock_store)

        response = client.post("/workflows", json=payload, headers=auth_header)

        assert response.status_code == 422


# =============================================================================
# Tests for GET workflow
# =============================================================================


def test_get_workflow_found(client, auth_header, mock_store, sample_workflow):
    """GET /workflows/{id} should return workflow if found."""
    with patch("service.workflow_router.get_agent") as mock_get_agent:
        with patch("service.workflow_router.get_workflow", new_callable=AsyncMock) as mock_get:
            mock_get_agent.return_value = mock_get_agent_with_store(mock_store)
            mock_get.return_value = sample_workflow

            response = client.get("/workflows/wf_test123abc", headers=auth_header)

            assert response.status_code == 200
            data = response.json()
            assert data["id"] == "wf_test123abc"


def test_get_workflow_not_found(client, auth_header, mock_store):
    """GET /workflows/{id} should return 404 if not found."""
    with patch("service.workflow_router.get_agent") as mock_get_agent:
        with patch("service.workflow_router.get_workflow", new_callable=AsyncMock) as mock_get:
            mock_get_agent.return_value = mock_get_agent_with_store(mock_store)
            mock_get.return_value = None

            response = client.get("/workflows/wf_notfound", headers=auth_header)

            assert response.status_code == 404


# =============================================================================
# Tests for LIST workflows
# =============================================================================


def test_list_workflows_empty(client, auth_header, mock_store):
    """GET /workflows should return empty list if no workflows."""
    with patch("service.workflow_router.get_agent") as mock_get_agent:
        with patch("service.workflow_router.list_workflows", new_callable=AsyncMock) as mock_list:
            mock_get_agent.return_value = mock_get_agent_with_store(mock_store)
            mock_list.return_value = []

            response = client.get("/workflows", headers=auth_header)

            assert response.status_code == 200
            assert response.json() == []


def test_list_workflows_with_items(client, auth_header, mock_store, sample_workflow):
    """GET /workflows should return list of workflows."""
    with patch("service.workflow_router.get_agent") as mock_get_agent:
        with patch("service.workflow_router.list_workflows", new_callable=AsyncMock) as mock_list:
            mock_get_agent.return_value = mock_get_agent_with_store(mock_store)
            mock_list.return_value = [sample_workflow]

            response = client.get("/workflows", headers=auth_header)

            assert response.status_code == 200
            data = response.json()
            assert len(data) == 1
            assert data[0]["id"] == "wf_test123abc"


# =============================================================================
# Tests for UPDATE workflow
# =============================================================================


def test_update_workflow_success(client, auth_header, mock_store, sample_workflow):
    """PATCH /workflows/{id} should update workflow."""
    updated = {**sample_workflow, "name": "Updated Name"}

    with patch("service.workflow_router.get_agent") as mock_get_agent:
        with patch("service.workflow_router.update_workflow", new_callable=AsyncMock) as mock_update:
            mock_get_agent.return_value = mock_get_agent_with_store(mock_store)
            mock_update.return_value = updated

            response = client.patch(
                "/workflows/wf_test123abc",
                json={"name": "Updated Name"},
                headers=auth_header,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["name"] == "Updated Name"


def test_update_workflow_not_found(client, auth_header, mock_store):
    """PATCH /workflows/{id} should return 404 if not found."""
    with patch("service.workflow_router.get_agent") as mock_get_agent:
        with patch("service.workflow_router.update_workflow", new_callable=AsyncMock) as mock_update:
            mock_get_agent.return_value = mock_get_agent_with_store(mock_store)
            mock_update.return_value = None

            response = client.patch(
                "/workflows/wf_notfound",
                json={"name": "New Name"},
                headers=auth_header,
            )

            assert response.status_code == 404


# =============================================================================
# Tests for DELETE workflow
# =============================================================================


def test_delete_workflow_success(client, auth_header, mock_store):
    """DELETE /workflows/{id} should return 204 on success."""
    with patch("service.workflow_router.get_agent") as mock_get_agent:
        with patch("service.workflow_router.delete_workflow", new_callable=AsyncMock) as mock_delete:
            mock_get_agent.return_value = mock_get_agent_with_store(mock_store)
            mock_delete.return_value = True

            response = client.delete("/workflows/wf_test123abc", headers=auth_header)

            assert response.status_code == 204


def test_delete_workflow_not_found(client, auth_header, mock_store):
    """DELETE /workflows/{id} should return 404 if not found."""
    with patch("service.workflow_router.get_agent") as mock_get_agent:
        with patch("service.workflow_router.delete_workflow", new_callable=AsyncMock) as mock_delete:
            mock_get_agent.return_value = mock_get_agent_with_store(mock_store)
            mock_delete.return_value = False

            response = client.delete("/workflows/wf_notfound", headers=auth_header)

            assert response.status_code == 404


# =============================================================================
# Tests for INVOKE workflow
# =============================================================================


def test_invoke_workflow_success(client, auth_header, mock_store, sample_workflow):
    """POST /workflows/{id}/invoke should return AI response."""
    from langchain_core.messages import AIMessage

    mock_response = AIMessage(content="Hello! I'm here to help.")

    with patch("service.workflow_router.get_agent") as mock_get_agent:
        with patch("service.workflow_router.get_workflow", new_callable=AsyncMock) as mock_get:
            mock_agent = mock_get_agent_with_store(mock_store)
            mock_agent.ainvoke = AsyncMock(
                return_value=[("values", {"messages": [mock_response]})]
            )
            mock_get_agent.return_value = mock_agent
            mock_get.return_value = sample_workflow

            response = client.post(
                "/workflows/wf_test123abc/invoke",
                json={"message": "Hello", "threadId": "thread-123"},
                headers=auth_header,
            )

            assert response.status_code == 200
            data = response.json()
            assert "message" in data


def test_invoke_workflow_not_found(client, auth_header, mock_store):
    """POST /workflows/{id}/invoke should return 404 if workflow not found."""
    with patch("service.workflow_router.get_agent") as mock_get_agent:
        with patch("service.workflow_router.get_workflow", new_callable=AsyncMock) as mock_get:
            mock_get_agent.return_value = mock_get_agent_with_store(mock_store)
            mock_get.return_value = None

            response = client.post(
                "/workflows/wf_notfound/invoke",
                json={"message": "Hello", "threadId": "thread-123"},
                headers=auth_header,
            )

            assert response.status_code == 404


# =============================================================================
# Tests for STREAM workflow
# =============================================================================


def test_stream_workflow_returns_sse(client, auth_header, mock_store, sample_workflow):
    """POST /workflows/{id}/stream should return SSE response."""
    with patch("service.workflow_router.get_agent") as mock_get_agent:
        with patch("service.workflow_router.get_workflow", new_callable=AsyncMock) as mock_get:
            mock_agent = mock_get_agent_with_store(mock_store)

            # Mock async generator for stream
            async def mock_stream(*args, **kwargs):
                yield ("updates", {"node": "agent_1"})

            mock_agent.astream = mock_stream
            mock_get_agent.return_value = mock_agent
            mock_get.return_value = sample_workflow

            response = client.post(
                "/workflows/wf_test123abc/stream",
                json={"message": "Hello", "threadId": "thread-123"},
                headers=auth_header,
            )

            assert response.status_code == 200
            assert response.headers["content-type"] == "text/event-stream; charset=utf-8"


# =============================================================================
# Tests for authentication
# =============================================================================


def test_create_workflow_requires_auth(client, mock_store, sample_create_payload):
    """POST /workflows without auth should return 401."""
    with patch("service.workflow_router.settings") as mock_settings:
        mock_settings.AUTH_SECRET = MagicMock()
        mock_settings.AUTH_SECRET.get_secret_value.return_value = "secret"

        response = client.post("/workflows", json=sample_create_payload)

        # Should be 401 or 403 depending on implementation
        assert response.status_code in [401, 403]


def test_get_workflow_requires_auth(client, mock_store):
    """GET /workflows/{id} without auth should return 401."""
    with patch("service.workflow_router.settings") as mock_settings:
        mock_settings.AUTH_SECRET = MagicMock()
        mock_settings.AUTH_SECRET.get_secret_value.return_value = "secret"

        response = client.get("/workflows/wf_123")

        assert response.status_code in [401, 403]


# =============================================================================
# Tests for error handling
# =============================================================================


def test_create_workflow_store_not_initialized(client, auth_header, sample_create_payload):
    """Should return 500 if store not initialized."""
    with patch("service.workflow_router.get_agent") as mock_get_agent:
        mock_agent = MagicMock()
        mock_agent.store = None  # Store not initialized
        mock_get_agent.return_value = mock_agent

        response = client.post("/workflows", json=sample_create_payload, headers=auth_header)

        assert response.status_code == 500
        assert "Store not initialized" in response.json()["detail"]


def test_invoke_workflow_internal_error(client, auth_header, mock_store, sample_workflow):
    """Should return 500 on internal error."""
    with patch("service.workflow_router.get_agent") as mock_get_agent:
        with patch("service.workflow_router.get_workflow", new_callable=AsyncMock) as mock_get:
            mock_agent = mock_get_agent_with_store(mock_store)
            mock_agent.ainvoke = AsyncMock(side_effect=Exception("Internal error"))
            mock_get_agent.return_value = mock_agent
            mock_get.return_value = sample_workflow

            response = client.post(
                "/workflows/wf_test123abc/invoke",
                json={"message": "Hello", "threadId": "thread-123"},
                headers=auth_header,
            )

            assert response.status_code == 500
