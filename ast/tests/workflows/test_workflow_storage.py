"""Tests for workflow storage - TDD: tests first, implementation after."""

import pytest
from unittest.mock import AsyncMock, MagicMock

from workflows.storage import (
    WORKFLOWS_NAMESPACE,
    generate_workflow_id,
    create_workflow,
    get_workflow,
    list_workflows,
    update_workflow,
    delete_workflow,
)


class TestGenerateWorkflowId:
    """Tests for workflow ID generation."""

    def test_generate_workflow_id_format(self):
        wf_id = generate_workflow_id()
        assert wf_id.startswith("wf_")
        assert len(wf_id) == 15  # "wf_" (3) + 12 hex chars

    def test_generate_workflow_id_unique(self):
        ids = [generate_workflow_id() for _ in range(100)]
        assert len(set(ids)) == 100  # All unique


class TestCreateWorkflow:
    """Tests for create_workflow function."""

    @pytest.fixture
    def mock_store(self):
        store = AsyncMock()
        store.aput = AsyncMock()
        return store

    @pytest.mark.asyncio
    async def test_create_workflow_success(self, mock_store):
        result = await create_workflow(
            store=mock_store,
            name="Test Workflow",
            flow_data={"nodes": [], "edges": []},
            description="A test workflow",
        )

        assert result["name"] == "Test Workflow"
        assert result["description"] == "A test workflow"
        assert result["id"].startswith("wf_")
        assert result["isActive"] is True
        assert "createdAt" in result
        assert "updatedAt" in result
        mock_store.aput.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_workflow_no_description(self, mock_store):
        result = await create_workflow(
            store=mock_store,
            name="Test",
            flow_data={"nodes": []},
        )

        assert result["name"] == "Test"
        assert result["description"] is None

    @pytest.mark.asyncio
    async def test_create_workflow_stores_with_correct_namespace(self, mock_store):
        await create_workflow(
            store=mock_store,
            name="Test",
            flow_data={"nodes": []},
        )

        call_args = mock_store.aput.call_args
        assert call_args.kwargs["namespace"] == WORKFLOWS_NAMESPACE


class TestGetWorkflow:
    """Tests for get_workflow function."""

    @pytest.fixture
    def mock_store(self):
        store = AsyncMock()
        return store

    @pytest.mark.asyncio
    async def test_get_workflow_found(self, mock_store):
        mock_store.aget.return_value = MagicMock(
            value={"id": "wf_123", "name": "Test"}
        )

        result = await get_workflow(mock_store, "wf_123")

        assert result["id"] == "wf_123"
        assert result["name"] == "Test"

    @pytest.mark.asyncio
    async def test_get_workflow_not_found(self, mock_store):
        mock_store.aget.return_value = None

        result = await get_workflow(mock_store, "wf_notfound")

        assert result is None


class TestListWorkflows:
    """Tests for list_workflows function."""

    @pytest.fixture
    def mock_store(self):
        store = AsyncMock()
        return store

    @pytest.mark.asyncio
    async def test_list_workflows_empty(self, mock_store):
        mock_store.asearch.return_value = []

        result = await list_workflows(mock_store)

        assert result == []

    @pytest.mark.asyncio
    async def test_list_workflows_with_items(self, mock_store):
        mock_store.asearch.return_value = [
            MagicMock(value={"id": "wf_1", "name": "Workflow 1"}),
            MagicMock(value={"id": "wf_2", "name": "Workflow 2"}),
        ]

        result = await list_workflows(mock_store)

        assert len(result) == 2
        assert result[0]["id"] == "wf_1"
        assert result[1]["id"] == "wf_2"

    @pytest.mark.asyncio
    async def test_list_workflows_respects_limit(self, mock_store):
        mock_store.asearch.return_value = []

        await list_workflows(mock_store, limit=50)

        call_args = mock_store.asearch.call_args
        assert call_args.kwargs["limit"] == 50


class TestUpdateWorkflow:
    """Tests for update_workflow function."""

    @pytest.fixture
    def mock_store(self):
        store = AsyncMock()
        return store

    @pytest.mark.asyncio
    async def test_update_workflow_success(self, mock_store):
        mock_store.aget.return_value = MagicMock(
            value={
                "id": "wf_123",
                "name": "Old Name",
                "description": None,
                "isActive": True,
                "createdAt": "2024-01-01T00:00:00",
                "updatedAt": "2024-01-01T00:00:00",
            }
        )
        mock_store.aput = AsyncMock()

        result = await update_workflow(
            mock_store, "wf_123", {"name": "New Name"}
        )

        assert result["name"] == "New Name"
        assert result["id"] == "wf_123"
        mock_store.aput.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_workflow_not_found(self, mock_store):
        mock_store.aget.return_value = None

        result = await update_workflow(
            mock_store, "wf_notfound", {"name": "New"}
        )

        assert result is None

    @pytest.mark.asyncio
    async def test_update_workflow_updates_timestamp(self, mock_store):
        original_updated = "2024-01-01T00:00:00"
        mock_store.aget.return_value = MagicMock(
            value={
                "id": "wf_123",
                "name": "Test",
                "updatedAt": original_updated,
            }
        )
        mock_store.aput = AsyncMock()

        result = await update_workflow(
            mock_store, "wf_123", {"name": "New"}
        )

        assert result["updatedAt"] != original_updated

    @pytest.mark.asyncio
    async def test_update_workflow_ignores_none_values(self, mock_store):
        mock_store.aget.return_value = MagicMock(
            value={
                "id": "wf_123",
                "name": "Original",
                "description": "Original desc",
            }
        )
        mock_store.aput = AsyncMock()

        result = await update_workflow(
            mock_store, "wf_123", {"name": "New", "description": None}
        )

        # description should remain unchanged because we passed None
        assert result["name"] == "New"
        assert result["description"] == "Original desc"


class TestDeleteWorkflow:
    """Tests for delete_workflow function."""

    @pytest.fixture
    def mock_store(self):
        store = AsyncMock()
        return store

    @pytest.mark.asyncio
    async def test_delete_workflow_success(self, mock_store):
        mock_store.aget.return_value = MagicMock(value={"id": "wf_123"})
        mock_store.adelete = AsyncMock()

        result = await delete_workflow(mock_store, "wf_123")

        assert result is True
        mock_store.adelete.assert_called_once()

    @pytest.mark.asyncio
    async def test_delete_workflow_not_found(self, mock_store):
        mock_store.aget.return_value = None

        result = await delete_workflow(mock_store, "wf_notfound")

        assert result is False
