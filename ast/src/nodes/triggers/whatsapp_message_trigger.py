"""
WhatsApp Message Trigger - Entry point for message events.

This trigger is used when:
- A WhatsApp message is received
- Filters can be applied (instance, isFromMe, isGroup)

The trigger extracts the message text and creates a HumanMessage.
"""

from typing import Any

from langchain_core.messages import HumanMessage
from langchain_core.runnables import RunnableConfig

from nodes.base import BaseNode
from nodes.registry import node_registry


@node_registry.register
class WhatsAppMessageTriggerNode(BaseNode):
    """
    Trigger for WhatsApp message events.

    Extracts message text from the WuzAPI event payload and creates
    a HumanMessage for the agent to respond to.

    Config:
        instanceIds: List of instance IDs to filter (null = all)
        filters: Dict with isFromMe, isGroup filters
    """

    node_type = "whatsapp_message_trigger"

    async def execute(
        self,
        state: dict[str, Any],
        config: RunnableConfig,
    ) -> dict[str, Any]:
        """
        Execute message trigger logic.

        Extracts message text and creates HumanMessage for agent.

        Args:
            state: Current state (contains trigger_data from webhook)
            config: RunnableConfig

        Returns:
            State update with source, messages, and trigger_data
        """
        trigger_data = state.get("trigger_data", {})

        # Extract message text from WuzAPI payload
        raw_event = trigger_data.get("rawEvent", {})
        message_text = self._extract_message_text(raw_event)

        # Build human message
        human_message = HumanMessage(content=message_text)

        # Update trigger_data with extracted message
        updated_trigger_data = {
            **trigger_data,
            "message_text": message_text,
        }

        return {
            "source": "whatsapp",
            "messages": [human_message],
            "trigger_data": updated_trigger_data,
        }

    def _extract_message_text(self, event: dict[str, Any]) -> str:
        """
        Extract text from WuzAPI message event.

        Handles different message types:
        - conversation: Simple text message
        - extendedTextMessage: Text with links/formatting
        - imageMessage, videoMessage, etc: Returns placeholder

        Args:
            event: WuzAPI event payload

        Returns:
            Extracted message text or placeholder for non-text
        """
        message = event.get("Message", {})

        # Simple text message
        if conversation := message.get("conversation"):
            return conversation

        # Extended text (with links, formatting)
        if ext_text := message.get("extendedTextMessage", {}).get("text"):
            return ext_text

        # Image with caption
        if caption := message.get("imageMessage", {}).get("caption"):
            return f"[Imagem] {caption}"

        # Video with caption
        if caption := message.get("videoMessage", {}).get("caption"):
            return f"[Vídeo] {caption}"

        # Audio message
        if message.get("audioMessage"):
            return "[Áudio]"

        # Document
        if doc := message.get("documentMessage"):
            filename = doc.get("fileName", "documento")
            return f"[Documento: {filename}]"

        # Sticker
        if message.get("stickerMessage"):
            return "[Sticker]"

        # Location
        if loc := message.get("locationMessage"):
            lat = loc.get("degreesLatitude", "?")
            lon = loc.get("degreesLongitude", "?")
            return f"[Localização: {lat}, {lon}]"

        # Contact
        if message.get("contactMessage"):
            return "[Contato]"

        # Unknown message type
        return "[Mensagem não textual]"
