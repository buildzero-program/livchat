"""
Base Node - Abstract base class for all workflow nodes.

All node types (triggers, actions, logic) inherit from this class.
"""

from abc import ABC, abstractmethod
from typing import Any

from langchain_core.runnables import RunnableConfig


class BaseNode(ABC):
    """
    Abstract base class for workflow nodes.

    Each node type must:
    1. Define a unique `node_type` class attribute
    2. Implement the `execute` method

    Attributes:
        node_type: Unique identifier for this node type (e.g., "manual_trigger")
        node_id: Instance-specific ID from workflow config
        config: Node configuration from workflow
    """

    node_type: str = "base"

    def __init__(self, node_id: str, config: dict[str, Any]):
        """
        Initialize a node instance.

        Args:
            node_id: Unique node ID from workflow config
            config: Node-specific configuration
        """
        self.node_id = node_id
        self.config = config

    @abstractmethod
    async def execute(
        self,
        state: dict[str, Any],
        config: RunnableConfig,
    ) -> dict[str, Any]:
        """
        Execute the node logic.

        Args:
            state: Current workflow state
            config: LangGraph RunnableConfig with thread_id, workflow_id, etc.

        Returns:
            State update dict to merge with current state.
            Return empty dict {} if no state changes needed.
        """
        pass

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(id={self.node_id!r}, type={self.node_type!r})"
