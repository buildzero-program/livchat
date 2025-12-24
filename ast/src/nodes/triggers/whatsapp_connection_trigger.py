"""
WhatsApp Connection Trigger - Entry point for connection events.

This trigger is used when:
- A WhatsApp instance connects
- A WhatsApp instance disconnects

The trigger creates a SystemMessage to inform the agent about the event.
"""

from typing import Any

from langchain_core.messages import SystemMessage
from langchain_core.runnables import RunnableConfig

from nodes.base import BaseNode
from nodes.registry import node_registry


@node_registry.register
class WhatsAppConnectionTriggerNode(BaseNode):
    """
    Trigger for WhatsApp connection events.

    Creates a SystemMessage informing the agent about the connection event.
    This allows the agent to respond appropriately (e.g., welcome message).

    Config:
        events: List of events to trigger on (e.g., ["connected", "disconnected"])
    """

    node_type = "whatsapp_connection_trigger"

    async def execute(
        self,
        state: dict[str, Any],
        config: RunnableConfig,
    ) -> dict[str, Any]:
        """
        Execute connection trigger logic.

        Creates a SystemMessage with connection details for the agent.

        Args:
            state: Current state (contains trigger_data from webhook)
            config: RunnableConfig

        Returns:
            State update with source, messages, and trigger_data
        """
        trigger_data = state.get("trigger_data", {})

        # Extract connection info
        instance_name = trigger_data.get("instanceName", "Unknown")
        phone = trigger_data.get("phone", "Unknown")
        instance_id = trigger_data.get("instanceId", "Unknown")

        # Build system message about the connection
        system_message = SystemMessage(
            content=(
                f"[SISTEMA] O usuário conectou a instância '{instance_name}' "
                f"com o número {phone}. "
                f"Dê boas-vindas e explique brevemente como você pode ajudar."
            )
        )

        return {
            "source": "whatsapp",
            "messages": [system_message],
            "trigger_data": trigger_data,
        }
