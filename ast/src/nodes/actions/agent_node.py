"""
Agent Node - Invokes LLM with prompt and conversation context.

This is the main action node for AI-powered responses.
Reuses utilities from the existing workflow_agent module for DRY.
"""

from typing import Any

from langchain_core.messages import BaseMessage, SystemMessage
from langchain_core.runnables import RunnableConfig

from nodes.base import BaseNode
from nodes.registry import node_registry

# Reuse existing utilities (DRY)
# Import directly to avoid circular import through agents/__init__.py
from workflows import process_template

# These functions are defined in workflow_agent but we need to avoid
# importing the whole agents module. Import the specific module instead.
import importlib

# Lazy import to avoid circular dependency
_workflow_agent_module = None


def _get_workflow_agent_module():
    """Lazy load workflow_agent module to avoid circular import."""
    global _workflow_agent_module
    if _workflow_agent_module is None:
        # Import the specific module, not the agents package
        _workflow_agent_module = importlib.import_module("agents.workflow_agent")
    return _workflow_agent_module


def trim_messages(messages, max_tokens=None):
    """Wrapper to avoid circular import."""
    module = _get_workflow_agent_module()
    return module.trim_messages(messages, max_tokens)


async def get_model_from_name(model_name: str):
    """Wrapper to avoid circular import."""
    module = _get_workflow_agent_module()
    return await module.get_model_from_name(model_name)


@node_registry.register
class AgentNode(BaseNode):
    """
    Agent node that invokes an LLM.

    Processes system prompt with template variables, trims messages
    to fit token limit, and invokes the configured model.

    Config:
        prompt: PromptConfig with system prompt and variables
        llm: LLMConfig with model and temperature
        memory: MemoryConfig with tokenLimit
    """

    node_type = "agent"

    async def execute(
        self,
        state: dict[str, Any],
        config: RunnableConfig,
    ) -> dict[str, Any]:
        """
        Execute agent node logic.

        1. Extract config
        2. Process template variables in system prompt
        3. Trim messages to fit token limit
        4. Invoke LLM
        5. Return response

        Args:
            state: Current workflow state with messages
            config: RunnableConfig with thread_id

        Returns:
            State update with new message and agent_response
        """
        # Extract configuration with defaults
        prompt_config = self.config.get("prompt", {})
        llm_config = self.config.get("llm", {})
        memory_config = self.config.get("memory", {})

        system_prompt = prompt_config.get("system", "You are a helpful assistant.")
        model_name = llm_config.get("model", "gpt-4o-mini")
        token_limit = memory_config.get("tokenLimit", 16000)

        # Get thread_id from config for template processing
        thread_id = config.get("configurable", {}).get("thread_id")

        # Process template variables (@current_datetime, @model_name, etc)
        processed_prompt = process_template(
            system_prompt,
            model_name=model_name,
            thread_id=thread_id,
        )

        # Get messages from state
        messages: list[BaseMessage] = state.get("messages", [])

        # Trim messages to fit token limit
        trimmed_messages = trim_messages(messages, max_tokens=token_limit)

        # Build messages for LLM (system prompt + conversation)
        messages_for_llm = [
            SystemMessage(content=processed_prompt),
            *trimmed_messages,
        ]

        # Get model and invoke
        model = await get_model_from_name(model_name)
        response = await model.ainvoke(messages_for_llm)

        # Return state update
        return {
            "messages": [response],
            "agent_response": response.content,
        }
