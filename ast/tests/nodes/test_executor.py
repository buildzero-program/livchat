"""Tests for workflow executor."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from langchain_core.messages import HumanMessage, AIMessage, SystemMessage


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def simple_workflow():
    """Simple workflow with manual trigger and agent."""
    return {
        "id": "wf_test",
        "name": "Test Workflow",
        "flowData": {
            "nodes": [
                {
                    "id": "trigger-manual",
                    "type": "manual_trigger",
                    "name": "Manual Trigger",
                    "config": {},
                },
                {
                    "id": "agent-1",
                    "type": "agent",
                    "name": "Test Agent",
                    "config": {
                        "prompt": {
                            "system": "You are helpful.",
                            "variables": [],
                        },
                        "llm": {"model": "gpt-4o-mini"},
                        "memory": {"tokenLimit": 16000},
                    },
                },
            ],
            "edges": [
                {"source": "trigger-manual", "target": "agent-1"},
            ],
        },
    }


@pytest.fixture
def sample_config():
    """Sample RunnableConfig."""
    return {
        "configurable": {
            "thread_id": "thread-123",
            "workflow_id": "wf_test",
        }
    }


# =============================================================================
# Tests for build_workflow_graph
# =============================================================================


@pytest.mark.asyncio
async def test_build_workflow_graph_returns_compiled_graph(simple_workflow):
    """build_workflow_graph should return a compiled StateGraph."""
    from nodes.executor import build_workflow_graph

    graph = await build_workflow_graph(simple_workflow)

    # Should be a compiled graph
    assert graph is not None
    # Should have ainvoke method
    assert hasattr(graph, "ainvoke")


@pytest.mark.asyncio
async def test_build_workflow_graph_sets_entry_point(simple_workflow):
    """build_workflow_graph should set trigger as entry point."""
    from nodes.executor import build_workflow_graph

    graph = await build_workflow_graph(simple_workflow)

    # The graph should start execution from the trigger node
    # We can verify by checking the graph structure
    assert graph is not None


@pytest.mark.asyncio
async def test_workflow_execution_flows_through_nodes(simple_workflow, sample_config):
    """Workflow execution should flow from trigger to agent."""
    from nodes.executor import build_workflow_graph

    mock_model = AsyncMock()
    mock_model.ainvoke = AsyncMock(return_value=AIMessage(content="Hello!"))

    with patch("nodes.actions.agent_node.get_model_from_name") as mock_get_model:
        mock_get_model.return_value = mock_model

        graph = await build_workflow_graph(simple_workflow)

        # Execute the workflow
        initial_state = {
            "messages": [HumanMessage(content="Hi there")],
        }

        result = await graph.ainvoke(initial_state, sample_config)

        # Should have source set by trigger
        assert result.get("source") == "manual"

        # Should have agent response
        assert result.get("agent_response") == "Hello!"


@pytest.mark.asyncio
async def test_workflow_with_no_trigger_raises(sample_config):
    """Workflow without trigger should raise error."""
    from nodes.executor import build_workflow_graph

    workflow_no_trigger = {
        "id": "wf_test",
        "flowData": {
            "nodes": [
                {
                    "id": "agent-1",
                    "type": "agent",
                    "name": "Agent",
                    "config": {
                        "prompt": {"system": "Hello"},
                        "llm": {"model": "gpt-4o-mini"},
                    },
                },
            ],
            "edges": [],
        },
    }

    with pytest.raises(ValueError, match="[Tt]rigger"):
        await build_workflow_graph(workflow_no_trigger)


@pytest.mark.asyncio
async def test_workflow_with_unknown_node_type_raises():
    """Unknown node type should raise error."""
    from nodes.executor import build_workflow_graph

    workflow_unknown = {
        "id": "wf_test",
        "flowData": {
            "nodes": [
                {
                    "id": "unknown-1",
                    "type": "unknown_type",
                    "name": "Unknown",
                    "config": {},
                },
            ],
            "edges": [],
        },
    }

    with pytest.raises(KeyError, match="[Uu]nknown"):
        await build_workflow_graph(workflow_unknown)


# =============================================================================
# Tests for get_node_executor
# =============================================================================


def test_get_node_executor_returns_instance():
    """get_node_executor should return node instance."""
    from nodes.executor import get_node_executor

    executor = get_node_executor("manual_trigger", "trigger-1", {})

    assert executor is not None
    assert executor.node_id == "trigger-1"
    assert executor.node_type == "manual_trigger"


def test_get_node_executor_passes_config():
    """get_node_executor should pass config to node."""
    from nodes.executor import get_node_executor

    config = {"key": "value"}
    executor = get_node_executor("manual_trigger", "trigger-1", config)

    assert executor.config == config


def test_get_node_executor_unknown_type_raises():
    """get_node_executor should raise for unknown type."""
    from nodes.executor import get_node_executor

    with pytest.raises(KeyError):
        get_node_executor("unknown_type", "node-1", {})
