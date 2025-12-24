"""Tests for EndNode - TDD Phase 2.3."""

import pytest
from unittest.mock import MagicMock


@pytest.fixture
def mock_config():
    """Mock RunnableConfig for tests."""
    return MagicMock()


class TestEndNodeRegistration:
    """Tests for end node registry."""

    def test_end_node_registered(self):
        """EndNode should be registered in the registry."""
        from nodes.registry import node_registry

        # Import to trigger registration
        from nodes.terminal.end_node import EndNode  # noqa: F401

        assert "end" in node_registry._nodes

    def test_end_node_type(self):
        """EndNode should have correct node_type."""
        from nodes.terminal.end_node import EndNode

        assert EndNode.node_type == "end"


class TestEndNodeExecution:
    """Tests for end node execute behavior."""

    @pytest.mark.asyncio
    async def test_execute_returns_empty_dict(self, mock_config):
        """End node should return empty dict (no state modification)."""
        from nodes.terminal.end_node import EndNode

        node = EndNode("end-1", {})
        state = {"messages": [{"role": "user", "content": "Hello"}], "source": "manual"}

        result = await node.execute(state, mock_config)

        assert result == {}

    @pytest.mark.asyncio
    async def test_execute_with_label(self, mock_config):
        """End node with label should still return empty dict."""
        from nodes.terminal.end_node import EndNode

        node = EndNode("end-1", {"label": "Success"})
        state = {"messages": [], "source": "test"}

        result = await node.execute(state, mock_config)

        assert result == {}

    @pytest.mark.asyncio
    async def test_execute_preserves_state_unchanged(self, mock_config):
        """End node should not modify the original state."""
        from nodes.terminal.end_node import EndNode

        node = EndNode("end-1", {})
        original_state = {"messages": ["msg1"], "source": "test", "custom": True}
        state = original_state.copy()

        await node.execute(state, mock_config)

        # State should remain unchanged
        assert state == original_state

    @pytest.mark.asyncio
    async def test_execute_with_empty_state(self, mock_config):
        """End node should handle empty state."""
        from nodes.terminal.end_node import EndNode

        node = EndNode("end-1", {})
        state = {}

        result = await node.execute(state, mock_config)

        assert result == {}


class TestEndNodeConfiguration:
    """Tests for end node configuration."""

    def test_create_without_config(self):
        """End node should work with empty config."""
        from nodes.terminal.end_node import EndNode

        node = EndNode("end-1", {})
        assert node.node_id == "end-1"
        assert node.config == {}

    def test_create_with_label(self):
        """End node should accept label in config."""
        from nodes.terminal.end_node import EndNode

        node = EndNode("end-1", {"label": "Workflow Complete"})
        assert node.config.get("label") == "Workflow Complete"

    def test_label_default(self):
        """Default label should be 'completed'."""
        from nodes.terminal.end_node import EndNode

        node = EndNode("end-1", {})
        # Label is used in logging, default is "completed"
        assert node.config.get("label", "completed") == "completed"
