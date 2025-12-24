"""
Manual Trigger Node - Entry point for API-invoked workflows.

This trigger is used when workflows are started via:
- POST /workflows/{id}/invoke
- POST /workflows/{id}/stream
"""

from typing import Any

from langchain_core.runnables import RunnableConfig

from nodes.base import BaseNode
from nodes.registry import node_registry


@node_registry.register
class ManualTriggerNode(BaseNode):
    """
    Trigger for manual workflow invocation.

    Sets source to "manual" and initializes empty trigger_data.
    Messages are passed through from the initial state.

    Config:
        (none required)
    """

    node_type = "manual_trigger"

    async def execute(
        self,
        state: dict[str, Any],
        config: RunnableConfig,
    ) -> dict[str, Any]:
        """
        Execute manual trigger logic.

        Sets the source field to identify this as a manual invocation.

        Args:
            state: Current workflow state (contains messages from API input)
            config: RunnableConfig with workflow_id and thread_id

        Returns:
            State update with source and trigger_data
        """
        return {
            "source": "manual",
            "trigger_data": {},
        }
