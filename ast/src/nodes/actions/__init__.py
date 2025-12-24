"""
Action Nodes - Nodes that perform operations in workflows.

Actions are the workhorses of workflows:
- agent: Invoke LLM with prompt and context
- respond_webhook: Return response to HTTP caller
- send_whatsapp: Send message via WhatsApp
"""

from nodes.actions.agent_node import AgentNode

__all__ = [
    "AgentNode",
]
