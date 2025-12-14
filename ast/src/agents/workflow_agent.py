"""
Workflow Agent - Dynamic agent that loads configuration from database.

This agent reads workflow configurations from the PostgresStore and executes
them dynamically, processing template variables and applying memory limits.
"""

from langchain_core.messages import BaseMessage, SystemMessage
from langchain_core.runnables import RunnableConfig
from langgraph.func import entrypoint
from langgraph.store.base import BaseStore

from core import get_model, settings
from schema.models import (
    AllModelEnum,
    OpenAIModelName,
    AnthropicModelName,
    GoogleModelName,
    GroqModelName,
    XAIModelName,
    DeepseekModelName,
    AWSModelName,
    OllamaModelName,
    OpenRouterModelName,
    FakeModelName,
)
from workflows import get_workflow, process_template


# All model enums for iteration
_ALL_MODEL_ENUMS = [
    OpenAIModelName,
    AnthropicModelName,
    GoogleModelName,
    GroqModelName,
    XAIModelName,
    DeepseekModelName,
    AWSModelName,
    OllamaModelName,
    OpenRouterModelName,
    FakeModelName,
]


def count_tokens_approx(messages: list[BaseMessage]) -> int:
    """
    Approximate token count for a list of messages.

    Uses a simple heuristic of ~4 characters per token.
    This is a rough estimate and actual token counts may vary by model.

    Args:
        messages: List of messages to count tokens for

    Returns:
        Approximate token count
    """
    if not messages:
        return 0

    total_chars = sum(len(str(m.content or "")) for m in messages)
    return total_chars // 4


def trim_messages(
    messages: list[BaseMessage],
    max_tokens: int | None = 16000,
) -> list[BaseMessage]:
    """
    Trim messages to fit within token limit, keeping most recent.

    Processes messages from newest to oldest, keeping as many as fit
    within the token limit.

    Args:
        messages: List of messages to trim
        max_tokens: Maximum tokens to keep (None = no limit)

    Returns:
        Trimmed list of messages (most recent that fit)
    """
    if max_tokens is None or not messages:
        return messages

    result = []
    current_tokens = 0

    # Process from newest to oldest
    for msg in reversed(messages):
        msg_tokens = count_tokens_approx([msg])
        if current_tokens + msg_tokens <= max_tokens:
            result.insert(0, msg)
            current_tokens += msg_tokens
        elif not result:
            # Always keep at least the most recent message
            result.insert(0, msg)
            break
        else:
            break

    return result


def get_model_from_name(model_name: str) -> AllModelEnum:
    """
    Get a model instance by string name.

    Searches through all model enums to find a matching model.
    Falls back to DEFAULT_MODEL if not found.

    Args:
        model_name: String name of the model (e.g., "gpt-5-mini", "claude-sonnet-4-5")

    Returns:
        Configured chat model instance
    """
    # Search through all model enums
    for enum_cls in _ALL_MODEL_ENUMS:
        for member in enum_cls:
            if member.value == model_name:
                return get_model(member)

    # Fallback to default model
    return get_model(settings.DEFAULT_MODEL)


@entrypoint()
async def workflow_agent(
    inputs: dict[str, list[BaseMessage]],
    *,
    previous: dict[str, list[BaseMessage]],
    config: RunnableConfig,
    store: BaseStore,
):
    """
    Dynamic workflow agent that loads configuration from database.

    This agent:
    1. Loads workflow configuration from the store using workflow_id
    2. Processes template variables in the system prompt
    3. Applies memory limits (token trimming)
    4. Executes the configured LLM model

    Args:
        inputs: New input messages {"messages": [HumanMessage(...)]}
        previous: Previous conversation history from checkpointer
        config: RunnableConfig with configurable.workflow_id and thread_id
        store: BaseStore for accessing workflow configurations

    Returns:
        entrypoint.final with value (immediate response) and save (persisted state)

    Raises:
        ValueError: If workflow_id is missing or workflow not found
    """
    # 1. Get workflow_id from config
    workflow_id = config["configurable"].get("workflow_id")
    thread_id = config["configurable"].get("thread_id")

    if not workflow_id:
        raise ValueError("workflow_id is required in config['configurable']")

    # 2. Load workflow from store
    workflow = await get_workflow(store, workflow_id)
    if not workflow:
        raise ValueError(f"Workflow {workflow_id} not found")

    # 3. Extract configuration
    flow_data = workflow.get("flowData", {})
    nodes = flow_data.get("nodes", [])

    if not nodes:
        raise ValueError(f"Workflow {workflow_id} has no nodes")

    # Get first agent node (MVP: single agent)
    agent_node = nodes[0]
    agent_config = agent_node.get("config", {})

    # Extract configuration pieces
    prompt_config = agent_config.get("prompt", {})
    llm_config = agent_config.get("llm", {})
    memory_config = agent_config.get("memory", {})

    system_prompt = prompt_config.get("system", "You are a helpful assistant.")
    model_name = llm_config.get("model", "gpt-5-mini")
    token_limit = memory_config.get("tokenLimit", 16000)

    # 4. Process template variables
    processed_prompt = process_template(
        system_prompt,
        model_name=model_name,
        thread_id=thread_id,
    )

    # 5. Merge messages (previous + new)
    prev_messages = previous.get("messages", []) if previous else []
    new_messages = inputs.get("messages", [])
    all_messages = prev_messages + new_messages

    # 6. Apply memory limits
    trimmed_messages = trim_messages(all_messages, max_tokens=token_limit)

    # 7. Build messages for LLM (system prompt + conversation)
    messages_for_llm = [
        SystemMessage(content=processed_prompt),
        *trimmed_messages,
    ]

    # 8. Get model and invoke
    model = get_model_from_name(model_name)
    response = await model.ainvoke(messages_for_llm)

    # 9. Return with full history for checkpointing (not trimmed)
    return entrypoint.final(
        value={"messages": [response]},
        save={"messages": all_messages + [response]},
    )
