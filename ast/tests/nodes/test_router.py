"""Tests for RouterNode - TDD Phase 2.2."""

import pytest
from unittest.mock import MagicMock
from langgraph.types import Command


@pytest.fixture
def basic_router_config():
    """Basic router configuration with source-based routing."""
    return {
        "expression": "source",
        "outputs": [
            {"key": "manual", "target": "agent-chat"},
            {"key": "whatsapp", "target": "agent-wa"},
        ],
        "defaultOutput": "agent-fallback",
    }


@pytest.fixture
def mock_config():
    """Mock RunnableConfig for tests."""
    return MagicMock()


class TestRouterNodeRegistration:
    """Tests for router node registry."""

    def test_router_node_registered(self):
        """RouterNode should be registered in the registry."""
        from nodes.registry import node_registry

        # Import to trigger registration
        from nodes.logic.router_node import RouterNode  # noqa: F401

        assert "router" in node_registry._nodes

    def test_router_node_type(self):
        """RouterNode should have correct node_type."""
        from nodes.logic.router_node import RouterNode

        assert RouterNode.node_type == "router"


class TestRouterNodeValidation:
    """Tests for router config validation."""

    def test_missing_outputs_raises(self):
        """Router without outputs should raise ValueError."""
        from nodes.logic.router_node import RouterNode

        with pytest.raises(ValueError, match="outputs"):
            RouterNode("router-1", {"defaultOutput": "fallback"})

    def test_missing_default_output_raises(self):
        """Router without defaultOutput should raise ValueError."""
        from nodes.logic.router_node import RouterNode

        with pytest.raises(ValueError, match="defaultOutput"):
            RouterNode(
                "router-1",
                {"outputs": [{"key": "x", "target": "y"}]},
            )

    def test_valid_config_accepted(self, basic_router_config):
        """Valid config should create router without error."""
        from nodes.logic.router_node import RouterNode

        router = RouterNode("router-1", basic_router_config)
        assert router.node_id == "router-1"


class TestRouterNodeExecution:
    """Tests for router execute behavior."""

    @pytest.mark.asyncio
    async def test_routes_to_matching_output(self, basic_router_config, mock_config):
        """Router should route to matching output."""
        from nodes.logic.router_node import RouterNode

        router = RouterNode("router-1", basic_router_config)
        state = {"source": "manual", "messages": []}

        result = await router.execute(state, mock_config)

        assert isinstance(result, Command)
        assert result.goto == "agent-chat"

    @pytest.mark.asyncio
    async def test_routes_to_default_on_no_match(
        self, basic_router_config, mock_config
    ):
        """Router should use defaultOutput when no match."""
        from nodes.logic.router_node import RouterNode

        router = RouterNode("router-1", basic_router_config)
        state = {"source": "unknown_source", "messages": []}

        result = await router.execute(state, mock_config)

        assert isinstance(result, Command)
        assert result.goto == "agent-fallback"

    @pytest.mark.asyncio
    async def test_routes_to_default_on_missing_field(
        self, basic_router_config, mock_config
    ):
        """Router should use defaultOutput when field missing."""
        from nodes.logic.router_node import RouterNode

        router = RouterNode("router-1", basic_router_config)
        state = {"messages": []}  # No 'source' field

        result = await router.execute(state, mock_config)

        assert isinstance(result, Command)
        assert result.goto == "agent-fallback"

    @pytest.mark.asyncio
    async def test_command_does_not_modify_state(
        self, basic_router_config, mock_config
    ):
        """Router Command should have empty update."""
        from nodes.logic.router_node import RouterNode

        router = RouterNode("router-1", basic_router_config)
        state = {"source": "manual", "messages": []}

        result = await router.execute(state, mock_config)

        assert result.update == {}

    @pytest.mark.asyncio
    async def test_second_output_match(self, basic_router_config, mock_config):
        """Router should route to second matching output."""
        from nodes.logic.router_node import RouterNode

        router = RouterNode("router-1", basic_router_config)
        state = {"source": "whatsapp", "messages": []}

        result = await router.execute(state, mock_config)

        assert result.goto == "agent-wa"


class TestRouterExpressionEvaluation:
    """Tests for expression evaluation (dot notation)."""

    @pytest.mark.asyncio
    async def test_simple_expression(self, mock_config):
        """Simple field access should work."""
        from nodes.logic.router_node import RouterNode

        config = {
            "expression": "source",
            "outputs": [{"key": "test", "target": "target-1"}],
            "defaultOutput": "fallback",
        }
        router = RouterNode("router-1", config)
        state = {"source": "test"}

        result = await router.execute(state, mock_config)

        assert result.goto == "target-1"

    @pytest.mark.asyncio
    async def test_dot_notation_expression(self, mock_config):
        """Dot notation should access nested fields."""
        from nodes.logic.router_node import RouterNode

        config = {
            "expression": "trigger_data.type",
            "outputs": [{"key": "connection", "target": "handler-1"}],
            "defaultOutput": "fallback",
        }
        router = RouterNode("router-1", config)
        state = {"trigger_data": {"type": "connection", "sender": "123"}}

        result = await router.execute(state, mock_config)

        assert result.goto == "handler-1"

    @pytest.mark.asyncio
    async def test_deep_dot_notation(self, mock_config):
        """Deep nested access should work."""
        from nodes.logic.router_node import RouterNode

        config = {
            "expression": "a.b.c",
            "outputs": [{"key": "value", "target": "target-1"}],
            "defaultOutput": "fallback",
        }
        router = RouterNode("router-1", config)
        state = {"a": {"b": {"c": "value"}}}

        result = await router.execute(state, mock_config)

        assert result.goto == "target-1"

    @pytest.mark.asyncio
    async def test_missing_nested_field_uses_default(self, mock_config):
        """Missing nested field should use defaultOutput."""
        from nodes.logic.router_node import RouterNode

        config = {
            "expression": "trigger_data.missing",
            "outputs": [{"key": "x", "target": "y"}],
            "defaultOutput": "fallback",
        }
        router = RouterNode("router-1", config)
        state = {"trigger_data": {"type": "test"}}

        result = await router.execute(state, mock_config)

        assert result.goto == "fallback"

    @pytest.mark.asyncio
    async def test_non_dict_intermediate_uses_default(self, mock_config):
        """Non-dict intermediate value should use defaultOutput."""
        from nodes.logic.router_node import RouterNode

        config = {
            "expression": "trigger_data.nested.value",
            "outputs": [{"key": "x", "target": "y"}],
            "defaultOutput": "fallback",
        }
        router = RouterNode("router-1", config)
        state = {"trigger_data": "not_a_dict"}

        result = await router.execute(state, mock_config)

        assert result.goto == "fallback"

    @pytest.mark.asyncio
    async def test_none_value_uses_default(self, mock_config):
        """None value should use defaultOutput."""
        from nodes.logic.router_node import RouterNode

        config = {
            "expression": "source",
            "outputs": [{"key": "None", "target": "target-1"}],
            "defaultOutput": "fallback",
        }
        router = RouterNode("router-1", config)
        state = {"source": None}

        result = await router.execute(state, mock_config)

        # None becomes "" after str conversion, no match
        assert result.goto == "fallback"

    @pytest.mark.asyncio
    async def test_integer_value_converted_to_string(self, mock_config):
        """Integer values should be converted to string for matching."""
        from nodes.logic.router_node import RouterNode

        config = {
            "expression": "priority",
            "outputs": [
                {"key": "1", "target": "high"},
                {"key": "2", "target": "medium"},
            ],
            "defaultOutput": "low",
        }
        router = RouterNode("router-1", config)
        state = {"priority": 1}  # Integer, not string

        result = await router.execute(state, mock_config)

        assert result.goto == "high"


class TestRouterDefaultExpression:
    """Tests for default expression behavior."""

    @pytest.mark.asyncio
    async def test_default_expression_is_source(self, mock_config):
        """If no expression provided, should default to 'source'."""
        from nodes.logic.router_node import RouterNode

        config = {
            # No "expression" field
            "outputs": [{"key": "manual", "target": "agent-1"}],
            "defaultOutput": "fallback",
        }
        router = RouterNode("router-1", config)
        state = {"source": "manual"}

        result = await router.execute(state, mock_config)

        assert result.goto == "agent-1"
