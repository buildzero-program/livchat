"""End Node - Marks workflow completion.

This node is a pass-through that visually marks the end of a workflow.
It doesn't modify state, just provides a clear endpoint for:
- Visual clarity in the workflow editor
- Multiple termination points in branching workflows
- Future: completion metrics and logging

★ Insight ─────────────────────────────────────
- Pass-through: returns {} (no state modification)
- LangGraph connects it to END automatically
- Label config is for logging/debugging only
─────────────────────────────────────────────────
"""

import logging
from typing import Any

from langchain_core.runnables import RunnableConfig

from nodes.base import BaseNode
from nodes.registry import node_registry

logger = logging.getLogger(__name__)


@node_registry.register
class EndNode(BaseNode):
    """End node - marks workflow completion.

    A pass-through node that doesn't modify state. Used to visually
    mark endpoints in the workflow graph.

    Config:
        label: Optional label for logging (default: "completed")
               Examples: "Success", "Error", "Timeout"

    Example config:
        {
            "label": "Success"
        }

    Usage in workflow JSON:
        {
            "id": "end-1",
            "type": "end",
            "name": "Workflow Complete",
            "config": {"label": "Success"}
        }
    """

    node_type = "end"

    async def execute(
        self,
        state: dict[str, Any],
        config: RunnableConfig,
    ) -> dict[str, Any]:
        """Pass-through - returns empty dict (no state modification).

        The workflow state flows through unchanged. This node simply
        marks the completion point for logging and visualization.

        Args:
            state: Current workflow state (not modified)
            config: LangGraph runnable config

        Returns:
            Empty dict (no state updates)
        """
        label = self.config.get("label", "completed")
        logger.debug(f"Workflow end: {self.node_id} ({label})")
        return {}
