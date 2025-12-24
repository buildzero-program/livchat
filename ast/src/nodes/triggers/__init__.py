"""
Trigger Nodes - Entry points for workflow execution.

Triggers determine how a workflow is started:
- manual_trigger: Invoked via API (invoke/stream)
- whatsapp_connection_trigger: WhatsApp instance connected
- whatsapp_message_trigger: WhatsApp message received
"""

from nodes.triggers.manual_trigger import ManualTriggerNode
from nodes.triggers.whatsapp_connection_trigger import WhatsAppConnectionTriggerNode
from nodes.triggers.whatsapp_message_trigger import WhatsAppMessageTriggerNode

__all__ = [
    "ManualTriggerNode",
    "WhatsAppConnectionTriggerNode",
    "WhatsAppMessageTriggerNode",
]
