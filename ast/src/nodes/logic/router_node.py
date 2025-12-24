"""Router Node - Conditional routing based on state expression.

This node evaluates an expression against the workflow state and routes
to different nodes based on the result. Uses LangGraph's Command pattern
for dynamic routing control.

★ Insight ─────────────────────────────────────
- Uses Command(goto="node_id") for dynamic routing
- Supports dot notation for nested field access
- Does NOT modify state - only controls flow
─────────────────────────────────────────────────
"""

import logging
from typing import Any

from langchain_core.runnables import RunnableConfig
from langgraph.types import Command

from nodes.base import BaseNode
from nodes.registry import node_registry

logger = logging.getLogger(__name__)


@node_registry.register
class RouterNode(BaseNode):
    """Router node - conditional routing based on expression evaluation.

    Evaluates an expression against the workflow state and routes to the
    matching output node, or the default if no match is found.

    Config:
        expression: Field path to evaluate (supports dot notation)
                   Default: "source"
        outputs: List of outputs [{"key": "value", "target": "node_id"}]
        defaultOutput: Node ID to route to when no match (required)

    Example config:
        {
            "expression": "source",
            "outputs": [
                {"key": "manual", "target": "agent-chat"},
                {"key": "whatsapp", "target": "agent-wa"}
            ],
            "defaultOutput": "agent-fallback"
        }

    Usage in workflow JSON:
        {
            "id": "router-1",
            "type": "router",
            "name": "Source Router",
            "config": {
                "expression": "trigger_data.type",
                "outputs": [{"key": "message", "target": "agent-1"}],
                "defaultOutput": "handler-default"
            }
        }
    """

    node_type = "router"

    def __init__(self, node_id: str, config: dict[str, Any]):
        """Initialize router with validation.

        Args:
            node_id: Unique identifier for this node
            config: Router configuration

        Raises:
            ValueError: If outputs or defaultOutput is missing
        """
        super().__init__(node_id, config)

        # Validate required config
        if not config.get("outputs"):
            raise ValueError(f"Router '{node_id}': 'outputs' is required")
        if not config.get("defaultOutput"):
            raise ValueError(f"Router '{node_id}': 'defaultOutput' is required")

    async def execute(
        self,
        state: dict[str, Any],
        config: RunnableConfig,
    ) -> Command:
        """Evaluate expression and return Command with routing decision.

        Does not modify the state - only determines the next node.

        Args:
            state: Current workflow state
            config: LangGraph runnable config

        Returns:
            Command with goto set to the target node
        """
        expression = self.config.get("expression", "source")
        outputs = self.config.get("outputs", [])
        default_output = self.config["defaultOutput"]

        # Evaluate expression against state
        value = self._evaluate_expression(expression, state)

        # Find matching output
        target = default_output
        for output in outputs:
            if output.get("key") == value:
                target = output.get("target", default_output)
                logger.debug(
                    f"Router '{self.node_id}': matched '{value}' -> '{target}'"
                )
                break
        else:
            logger.debug(
                f"Router '{self.node_id}': no match for '{value}', using default '{target}'"
            )

        # Return Command with empty update (no state modification)
        return Command(update={}, goto=target)

    def _evaluate_expression(self, expression: str, state: dict[str, Any]) -> str:
        """Evaluate expression against state.

        Supports dot notation for nested access:
        - "source" -> state["source"]
        - "trigger_data.type" -> state["trigger_data"]["type"]
        - "a.b.c" -> state["a"]["b"]["c"]

        Args:
            expression: Field path with optional dot notation
            state: Workflow state dict

        Returns:
            String representation of the value, or "" if not found
        """
        parts = expression.split(".")
        value: Any = state

        for part in parts:
            if isinstance(value, dict):
                value = value.get(part)
            else:
                # Non-dict intermediate - can't continue
                return ""

        # Convert to string for matching, None becomes ""
        if value is None:
            return ""

        return str(value)
