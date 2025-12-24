"""
Workflow Executor - Builds and executes StateGraph from workflow config.

This module is the bridge between workflow configuration (JSON) and
LangGraph execution (StateGraph).
"""

import logging
from typing import Any

from langchain_core.messages import BaseMessage
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.graph import StateGraph, END
from langgraph.graph.state import CompiledStateGraph
from langgraph.store.base import BaseStore

from nodes.base import BaseNode
from nodes.registry import node_registry

# Import all nodes to register them
import nodes.triggers  # noqa: F401
import nodes.actions  # noqa: F401
import nodes.logic  # noqa: F401
import nodes.terminal  # noqa: F401

logger = logging.getLogger(__name__)


# =============================================================================
# Workflow State
# =============================================================================


class WorkflowState(dict):
    """
    State that flows through workflow nodes.

    This is a dict subclass to work with LangGraph's state management.
    Uses the add_messages reducer pattern for the messages field.

    Fields:
        messages: List of conversation messages (auto-appended by LangGraph)
        source: Origin of the trigger ("manual", "whatsapp")
        trigger_data: Event-specific data from trigger
        agent_response: Convenience field with last agent response
    """

    pass


# Define state schema for StateGraph
# Using TypedDict-style for LangGraph compatibility
from typing import TypedDict, Literal, Annotated
from langgraph.graph.message import add_messages


class WorkflowStateSchema(TypedDict, total=False):
    """Schema for workflow state with message reducer."""

    messages: Annotated[list[BaseMessage], add_messages]
    source: Literal["manual", "whatsapp"]
    trigger_data: dict
    agent_response: str


# =============================================================================
# Node Executor Factory
# =============================================================================


def get_node_executor(
    node_type: str,
    node_id: str,
    config: dict[str, Any],
) -> BaseNode:
    """
    Create a node executor instance by type.

    Args:
        node_type: The node type string (e.g., "manual_trigger", "agent")
        node_id: Unique node ID from workflow config
        config: Node-specific configuration

    Returns:
        Instantiated node executor

    Raises:
        KeyError: If node type is not registered
    """
    node_class = node_registry.get(node_type)
    return node_class(node_id, config)


# =============================================================================
# Workflow Graph Builder
# =============================================================================


async def build_workflow_graph(
    workflow: dict[str, Any],
    checkpointer: BaseCheckpointSaver | None = None,
    store: BaseStore | None = None,
) -> CompiledStateGraph:
    """
    Build a LangGraph StateGraph from workflow configuration.

    This function:
    1. Parses the workflow config (nodes and edges)
    2. Creates node executors for each node
    3. Builds the StateGraph with proper connections
    4. Sets the entry point (trigger node)
    5. Compiles and returns the graph

    Args:
        workflow: Workflow dict with flowData containing nodes and edges
        checkpointer: Optional checkpointer for conversation persistence
        store: Optional store for long-term memory

    Returns:
        Compiled StateGraph ready for execution

    Raises:
        ValueError: If workflow has no trigger node
        KeyError: If unknown node type is encountered
    """
    flow_data = workflow.get("flowData", {})
    nodes = flow_data.get("nodes", [])
    edges = flow_data.get("edges", [])

    # Create StateGraph
    builder = StateGraph(WorkflowStateSchema)

    # Track trigger nodes
    trigger_nodes = []

    # Add nodes
    for node in nodes:
        node_id = node["id"]
        node_type = node["type"]
        node_config = node.get("config", {})

        # Create executor
        executor = get_node_executor(node_type, node_id, node_config)

        # Add to graph
        builder.add_node(node_id, executor.execute)

        # Track triggers
        if node_type.endswith("_trigger"):
            trigger_nodes.append(node_id)

    # Validate we have at least one trigger
    if not trigger_nodes:
        raise ValueError(
            "Workflow must have at least one trigger node. "
            "Add a node with type ending in '_trigger' (e.g., manual_trigger)"
        )

    # Build node type lookup for quick access
    node_types = {n["id"]: n["type"] for n in nodes}

    # Add edges
    for edge in edges:
        source = edge["source"]
        target = edge["target"]

        # Check if target exists
        target_node = next((n for n in nodes if n["id"] == target), None)
        if not target_node:
            logger.warning(f"Edge target '{target}' not found in nodes")
            continue

        # Router nodes use Command(goto=...), so skip their edges
        # The router decides the next node dynamically at runtime
        source_type = node_types.get(source, "")
        if source_type == "router":
            logger.debug(f"Skipping edge from router '{source}' (uses Command pattern)")
            continue

        builder.add_edge(source, target)

    # Find terminal nodes (nodes with no outgoing edges)
    sources_with_edges = {edge["source"] for edge in edges}
    for node in nodes:
        if node["id"] not in sources_with_edges:
            # This node has no outgoing edges - connect to END
            if not node["type"].endswith("_trigger"):  # Triggers should have outgoing
                builder.add_edge(node["id"], END)

    # Set entry point to first trigger node
    # In future, we can support multiple entry points
    builder.set_entry_point(trigger_nodes[0])

    # Compile with optional checkpointer and store
    return builder.compile(checkpointer=checkpointer, store=store)
