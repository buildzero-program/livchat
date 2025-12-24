"""Tests for base node classes."""

import pytest
from unittest.mock import AsyncMock, MagicMock

from langchain_core.messages import HumanMessage, AIMessage


# =============================================================================
# Test BaseNode abstract class
# =============================================================================


def test_base_node_requires_node_type():
    """BaseNode subclass must define node_type."""
    from nodes.base import BaseNode

    # Try to create a node without node_type should work
    # but it should have a default or be abstract

    class TestNode(BaseNode):
        node_type = "test"

        async def execute(self, state, config):
            return {}

    node = TestNode("test-1", {})
    assert node.node_type == "test"
    assert node.node_id == "test-1"
    assert node.config == {}


def test_base_node_stores_config():
    """BaseNode should store config dict."""
    from nodes.base import BaseNode

    class TestNode(BaseNode):
        node_type = "test"

        async def execute(self, state, config):
            return {}

    config = {"key": "value", "nested": {"a": 1}}
    node = TestNode("my-node", config)

    assert node.config == config
    assert node.config["key"] == "value"
    assert node.config["nested"]["a"] == 1


# =============================================================================
# Test NodeRegistry
# =============================================================================


def test_registry_registers_node():
    """Registry should register node types."""
    from nodes.registry import NodeRegistry

    registry = NodeRegistry()

    class TestNode:
        node_type = "test_node"

    registry.register(TestNode)
    assert "test_node" in registry._nodes


def test_registry_gets_node():
    """Registry should return registered node class."""
    from nodes.registry import NodeRegistry

    registry = NodeRegistry()

    class TestNode:
        node_type = "test_node"

    registry.register(TestNode)
    result = registry.get("test_node")
    assert result == TestNode


def test_registry_raises_for_unknown():
    """Registry should raise for unknown node type."""
    from nodes.registry import NodeRegistry

    registry = NodeRegistry()

    with pytest.raises(KeyError, match="Unknown node type"):
        registry.get("unknown_type")


def test_registry_decorator():
    """Registry decorator should register node."""
    from nodes.registry import node_registry

    # This tests that the global registry and decorator work

    @node_registry.register
    class DecoratedNode:
        node_type = "decorated_test"

    assert "decorated_test" in node_registry._nodes
