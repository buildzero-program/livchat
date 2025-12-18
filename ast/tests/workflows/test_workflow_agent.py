"""Tests for the workflow agent."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

from agents.workflow_agent import (
    count_tokens_approx,
    trim_messages,
    get_model_from_name,
)


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def clean_workflow_agent():
    """
    Reset workflow_agent checkpointer for tests that need isolation.

    When service tests run first, they configure agents with checkpointer,
    which then affects workflow_agent tests. Use this fixture for isolation.
    """
    from agents.workflow_agent import workflow_agent

    original_checkpointer = workflow_agent.checkpointer
    workflow_agent.checkpointer = None

    yield workflow_agent

    workflow_agent.checkpointer = original_checkpointer


# =============================================================================
# Tests for count_tokens_approx
# =============================================================================


def test_count_tokens_approx_empty():
    """Empty list should return 0 tokens."""
    result = count_tokens_approx([])
    assert result == 0


def test_count_tokens_approx_single_message():
    """Single message should calculate tokens based on ~4 chars per token."""
    messages = [HumanMessage(content="Hello world")]  # 11 chars
    result = count_tokens_approx(messages)
    assert result == 2  # 11 // 4 = 2


def test_count_tokens_approx_multiple_messages():
    """Multiple messages should sum all tokens."""
    messages = [
        HumanMessage(content="Hello"),  # 5 chars = 1 token
        AIMessage(content="Hi there!"),  # 9 chars = 2 tokens
    ]
    result = count_tokens_approx(messages)
    assert result == 3  # 14 // 4 = 3


def test_count_tokens_approx_long_message():
    """Long message should calculate correctly."""
    messages = [HumanMessage(content="A" * 100)]  # 100 chars
    result = count_tokens_approx(messages)
    assert result == 25  # 100 // 4 = 25


# =============================================================================
# Tests for trim_messages
# =============================================================================


def test_trim_messages_empty():
    """Empty list should return empty list."""
    result = trim_messages([], max_tokens=1000)
    assert result == []


def test_trim_messages_under_limit():
    """Messages under limit should all be kept."""
    messages = [
        HumanMessage(content="Hi"),  # ~0 tokens
        AIMessage(content="Hello"),  # ~1 token
    ]
    result = trim_messages(messages, max_tokens=1000)
    assert len(result) == 2
    assert result == messages


def test_trim_messages_over_limit():
    """Messages over limit should be trimmed from oldest."""
    messages = [
        HumanMessage(content="A" * 100),  # ~25 tokens
        AIMessage(content="B" * 100),  # ~25 tokens
        HumanMessage(content="C" * 100),  # ~25 tokens
    ]
    # Limit of 30 tokens should only keep the most recent message
    result = trim_messages(messages, max_tokens=30)
    assert len(result) == 1
    assert result[0].content == "C" * 100


def test_trim_messages_none_limit():
    """None limit should return all messages."""
    messages = [HumanMessage(content="A" * 10000)]
    result = trim_messages(messages, max_tokens=None)
    assert len(result) == 1


def test_trim_messages_keeps_recent():
    """Should keep most recent messages when trimming."""
    messages = [
        HumanMessage(content="First"),  # 5 chars = 1 token
        AIMessage(content="Second"),  # 6 chars = 1 token
        HumanMessage(content="Third"),  # 5 chars = 1 token
        AIMessage(content="Fourth"),  # 6 chars = 1 token
    ]
    # Limit of 3 tokens should keep last 3 messages (roughly)
    result = trim_messages(messages, max_tokens=3)
    # Each message is ~1-2 tokens, so should keep 2-3
    assert len(result) >= 1
    assert len(result) <= 3
    # Most recent should be kept
    assert result[-1].content == "Fourth"


def test_trim_messages_exact_limit():
    """Messages exactly at limit should all be kept."""
    messages = [
        HumanMessage(content="AAAA"),  # 4 chars = 1 token
        AIMessage(content="BBBB"),  # 4 chars = 1 token
    ]
    result = trim_messages(messages, max_tokens=2)
    assert len(result) == 2


# =============================================================================
# Tests for get_model_from_name
# =============================================================================


@pytest.mark.asyncio
async def test_get_model_from_name_openai():
    """Should find OpenAI model by string name (via auto-detection since not in registry)."""
    with patch("agents.workflow_agent.model_registry") as mock_registry:
        mock_registry.get_model_info = AsyncMock(return_value=None)

        with patch("agents.workflow_agent.get_model") as mock_get_model:
            mock_model = MagicMock()
            mock_get_model.return_value = mock_model

            result = await get_model_from_name("gpt-5-mini")

            assert result == mock_model
            mock_get_model.assert_called_once_with("gpt-5-mini")


@pytest.mark.asyncio
async def test_get_model_from_name_anthropic():
    """Should find Anthropic model by string name (via auto-detection)."""
    with patch("agents.workflow_agent.model_registry") as mock_registry:
        mock_registry.get_model_info = AsyncMock(return_value=None)

        with patch("agents.workflow_agent.get_model") as mock_get_model:
            mock_model = MagicMock()
            mock_get_model.return_value = mock_model

            result = await get_model_from_name("claude-sonnet-4-5")

            assert result == mock_model
            mock_get_model.assert_called_once_with("claude-sonnet-4-5")


@pytest.mark.asyncio
async def test_get_model_from_name_groq():
    """Should find Groq model by string name (via auto-detection)."""
    with patch("agents.workflow_agent.model_registry") as mock_registry:
        mock_registry.get_model_info = AsyncMock(return_value=None)

        with patch("agents.workflow_agent.get_model") as mock_get_model:
            mock_model = MagicMock()
            mock_get_model.return_value = mock_model

            result = await get_model_from_name("llama-3.3-70b")

            assert result == mock_model
            mock_get_model.assert_called_once_with("llama-3.3-70b")


@pytest.mark.asyncio
async def test_get_model_from_name_xai():
    """Should find XAI/Grok model by string name (via auto-detection)."""
    with patch("agents.workflow_agent.model_registry") as mock_registry:
        mock_registry.get_model_info = AsyncMock(return_value=None)

        with patch("agents.workflow_agent.get_model") as mock_get_model:
            mock_model = MagicMock()
            mock_get_model.return_value = mock_model

            result = await get_model_from_name("grok-4")

            assert result == mock_model
            mock_get_model.assert_called_once_with("grok-4")


@pytest.mark.asyncio
async def test_get_model_from_name_unknown_uses_default():
    """Unknown model name should fallback to default model."""
    with patch("agents.workflow_agent.model_registry") as mock_registry:
        mock_registry.get_model_info = AsyncMock(return_value=None)

        with patch("agents.workflow_agent.get_model") as mock_get_model:
            with patch("agents.workflow_agent.settings") as mock_settings:
                mock_settings.DEFAULT_MODEL = "fake-default"
                mock_model = MagicMock()
                # First call raises (auto-detect fails), second succeeds (default)
                mock_get_model.side_effect = [
                    ValueError("Cannot detect provider"),
                    mock_model,
                ]

                result = await get_model_from_name("unknown-model-xyz")

                assert result == mock_model
                # Should be called twice: once for unknown, once for default
                assert mock_get_model.call_count == 2
                mock_get_model.assert_called_with("fake-default")


# =============================================================================
# Tests for workflow_agent (integration-style with mocks)
# =============================================================================


@pytest.fixture
def mock_store():
    """Create a mock store."""
    store = AsyncMock()
    return store


@pytest.fixture
def mock_workflow():
    """Sample workflow data."""
    return {
        "id": "wf_test123",
        "name": "Test Workflow",
        "description": "A test workflow",
        "flowData": {
            "nodes": [
                {
                    "id": "agent_1",
                    "type": "agent",
                    "name": "Test Agent",
                    "config": {
                        "prompt": {
                            "system": "You are a helpful assistant. Today is @current_datetime.weekday.",
                            "variables": ["current_datetime"],
                        },
                        "llm": {
                            "provider": "openai",
                            "model": "gpt-5-mini",
                            "temperature": 0.7,
                        },
                        "memory": {
                            "type": "buffer",
                            "tokenLimit": 16000,
                            "messageLimit": None,
                        },
                    },
                }
            ],
            "edges": [],
        },
        "isActive": True,
    }


@pytest.fixture
def sample_config():
    """Sample RunnableConfig."""
    return {
        "configurable": {
            "thread_id": "thread-123",
            "workflow_id": "wf_test123",
        }
    }


@pytest.mark.asyncio
async def test_workflow_agent_missing_workflow_id(mock_store, clean_workflow_agent):
    """Should raise error if workflow_id is missing."""
    workflow_agent = clean_workflow_agent

    inputs = {"messages": [HumanMessage(content="Hello")]}
    config = {"configurable": {}}  # No workflow_id

    with pytest.raises(ValueError, match="workflow_id.*required"):
        await workflow_agent.ainvoke(
            inputs,
            config=config,
        )


@pytest.mark.asyncio
async def test_workflow_agent_workflow_not_found(mock_store, sample_config, clean_workflow_agent):
    """Should raise error if workflow not found in store."""
    workflow_agent = clean_workflow_agent

    # Mock store to return None
    with patch("agents.workflow_agent.get_workflow", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = None

        inputs = {"messages": [HumanMessage(content="Hello")]}

        with pytest.raises(ValueError, match="not found"):
            # Set store on agent
            workflow_agent.store = mock_store
            await workflow_agent.ainvoke(inputs, config=sample_config)


@pytest.mark.asyncio
async def test_workflow_agent_empty_nodes(mock_store, sample_config, clean_workflow_agent):
    """Should raise error if workflow has no nodes."""
    workflow_agent = clean_workflow_agent

    workflow_no_nodes = {
        "id": "wf_test123",
        "flowData": {"nodes": [], "edges": []},
    }

    with patch("agents.workflow_agent.get_workflow", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = workflow_no_nodes

        inputs = {"messages": [HumanMessage(content="Hello")]}

        with pytest.raises(ValueError, match="no nodes"):
            workflow_agent.store = mock_store
            await workflow_agent.ainvoke(inputs, config=sample_config)


@pytest.mark.asyncio
async def test_workflow_agent_processes_template(
    mock_store, mock_workflow, sample_config, clean_workflow_agent
):
    """Should process template variables in system prompt."""
    workflow_agent = clean_workflow_agent
    from datetime import datetime

    mock_model = AsyncMock()
    mock_model.ainvoke = AsyncMock(return_value=AIMessage(content="Hello!"))

    with patch("agents.workflow_agent.get_workflow", new_callable=AsyncMock) as mock_get:
        with patch("agents.workflow_agent.get_model_from_name") as mock_get_model:
            mock_get.return_value = mock_workflow
            mock_get_model.return_value = mock_model

            inputs = {"messages": [HumanMessage(content="Hi")]}

            workflow_agent.store = mock_store
            result = await workflow_agent.ainvoke(inputs, config=sample_config)

            # Model should have been invoked
            mock_model.ainvoke.assert_called_once()

            # Check that system message was processed (contains weekday, not @current_datetime)
            call_args = mock_model.ainvoke.call_args[0][0]
            system_msg = call_args[0]
            assert isinstance(system_msg, SystemMessage)
            assert "@current_datetime" not in system_msg.content


@pytest.mark.asyncio
async def test_workflow_agent_merges_messages(mock_store, mock_workflow, sample_config, clean_workflow_agent):
    """Should merge previous messages with new input."""
    workflow_agent = clean_workflow_agent

    mock_model = AsyncMock()
    mock_model.ainvoke = AsyncMock(return_value=AIMessage(content="Response"))

    with patch("agents.workflow_agent.get_workflow", new_callable=AsyncMock) as mock_get:
        with patch("agents.workflow_agent.get_model_from_name") as mock_get_model:
            mock_get.return_value = mock_workflow
            mock_get_model.return_value = mock_model

            inputs = {"messages": [HumanMessage(content="New message")]}

            workflow_agent.store = mock_store

            # First call - no previous
            result1 = await workflow_agent.ainvoke(inputs, config=sample_config)

            # Check model received messages
            call_args = mock_model.ainvoke.call_args[0][0]
            # Should have: SystemMessage + HumanMessage
            assert len(call_args) == 2
            assert isinstance(call_args[0], SystemMessage)
            assert isinstance(call_args[1], HumanMessage)


@pytest.mark.asyncio
async def test_workflow_agent_returns_response(mock_store, mock_workflow, sample_config, clean_workflow_agent):
    """Should return AI response in correct format."""
    workflow_agent = clean_workflow_agent

    expected_response = AIMessage(content="I'm here to help!")

    mock_model = AsyncMock()
    mock_model.ainvoke = AsyncMock(return_value=expected_response)

    with patch("agents.workflow_agent.get_workflow", new_callable=AsyncMock) as mock_get:
        with patch("agents.workflow_agent.get_model_from_name") as mock_get_model:
            mock_get.return_value = mock_workflow
            mock_get_model.return_value = mock_model

            inputs = {"messages": [HumanMessage(content="Help me")]}

            workflow_agent.store = mock_store
            result = await workflow_agent.ainvoke(inputs, config=sample_config)

            # Result should contain the response message
            assert "messages" in result
            assert len(result["messages"]) >= 1


# =============================================================================
# Tests for edge cases
# =============================================================================


def test_count_tokens_approx_with_none_content():
    """Should handle messages with None content gracefully."""
    messages = [HumanMessage(content="")]
    result = count_tokens_approx(messages)
    assert result == 0


def test_trim_messages_single_large_message():
    """Single message larger than limit should still be returned."""
    messages = [HumanMessage(content="A" * 1000)]  # ~250 tokens
    result = trim_messages(messages, max_tokens=10)
    # Should return the message even if over limit (can't trim a single message)
    assert len(result) == 1


def test_trim_messages_preserves_order():
    """Trimmed messages should preserve chronological order."""
    messages = [
        HumanMessage(content="1"),
        AIMessage(content="2"),
        HumanMessage(content="3"),
        AIMessage(content="4"),
        HumanMessage(content="5"),
    ]
    result = trim_messages(messages, max_tokens=2)
    # Should be in order
    for i in range(len(result) - 1):
        assert int(result[i].content) < int(result[i + 1].content)
