"""Tests for action nodes."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from langchain_core.messages import HumanMessage, AIMessage, SystemMessage


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def sample_state():
    """Sample workflow state with messages."""
    return {
        "messages": [HumanMessage(content="Hello, how are you?")],
        "source": "manual",
    }


@pytest.fixture
def sample_config():
    """Sample RunnableConfig."""
    return {
        "configurable": {
            "thread_id": "thread-123",
            "workflow_id": "wf_test",
        }
    }


@pytest.fixture
def agent_node_config():
    """Sample agent node configuration."""
    return {
        "prompt": {
            "system": "You are a helpful assistant. Today is @current_datetime.weekday.",
            "variables": ["current_datetime"],
        },
        "llm": {
            "model": "gpt-4o-mini",
            "temperature": 0.7,
        },
        "memory": {
            "tokenLimit": 16000,
        },
    }


# =============================================================================
# Tests for AgentNode
# =============================================================================


@pytest.mark.asyncio
async def test_agent_node_invokes_llm(sample_state, sample_config, agent_node_config):
    """AgentNode should invoke the LLM with messages."""
    from nodes.actions.agent_node import AgentNode

    mock_model = AsyncMock()
    mock_model.ainvoke = AsyncMock(return_value=AIMessage(content="I'm doing great!"))

    with patch("nodes.actions.agent_node.get_model_from_name") as mock_get_model:
        mock_get_model.return_value = mock_model

        node = AgentNode("agent-1", agent_node_config)
        result = await node.execute(sample_state, sample_config)

        # Model should have been invoked
        mock_model.ainvoke.assert_called_once()


@pytest.mark.asyncio
async def test_agent_node_returns_ai_message(sample_state, sample_config, agent_node_config):
    """AgentNode should return messages with AI response."""
    from nodes.actions.agent_node import AgentNode

    expected_response = AIMessage(content="Hello! I'm here to help.")

    mock_model = AsyncMock()
    mock_model.ainvoke = AsyncMock(return_value=expected_response)

    with patch("nodes.actions.agent_node.get_model_from_name") as mock_get_model:
        mock_get_model.return_value = mock_model

        node = AgentNode("agent-1", agent_node_config)
        result = await node.execute(sample_state, sample_config)

        assert "messages" in result
        assert len(result["messages"]) == 1
        assert isinstance(result["messages"][0], AIMessage)
        assert result["messages"][0].content == "Hello! I'm here to help."


@pytest.mark.asyncio
async def test_agent_node_sets_agent_response(sample_state, sample_config, agent_node_config):
    """AgentNode should set agent_response field."""
    from nodes.actions.agent_node import AgentNode

    mock_model = AsyncMock()
    mock_model.ainvoke = AsyncMock(return_value=AIMessage(content="The answer is 42"))

    with patch("nodes.actions.agent_node.get_model_from_name") as mock_get_model:
        mock_get_model.return_value = mock_model

        node = AgentNode("agent-1", agent_node_config)
        result = await node.execute(sample_state, sample_config)

        assert result["agent_response"] == "The answer is 42"


@pytest.mark.asyncio
async def test_agent_node_processes_template(sample_state, sample_config, agent_node_config):
    """AgentNode should process template variables in system prompt."""
    from nodes.actions.agent_node import AgentNode

    mock_model = AsyncMock()
    mock_model.ainvoke = AsyncMock(return_value=AIMessage(content="Response"))

    with patch("nodes.actions.agent_node.get_model_from_name") as mock_get_model:
        mock_get_model.return_value = mock_model

        node = AgentNode("agent-1", agent_node_config)
        await node.execute(sample_state, sample_config)

        # Check the messages sent to the model
        call_args = mock_model.ainvoke.call_args[0][0]
        system_msg = call_args[0]

        assert isinstance(system_msg, SystemMessage)
        # Template should be processed - no @current_datetime
        assert "@current_datetime" not in system_msg.content
        # Should have a weekday name (in Portuguese)
        # We can't test exact value since it depends on current date


@pytest.mark.asyncio
async def test_agent_node_includes_history(sample_config, agent_node_config):
    """AgentNode should include message history in LLM call."""
    from nodes.actions.agent_node import AgentNode

    state = {
        "messages": [
            HumanMessage(content="Question 1"),
            AIMessage(content="Answer 1"),
            HumanMessage(content="Question 2"),
        ],
        "source": "manual",
    }

    mock_model = AsyncMock()
    mock_model.ainvoke = AsyncMock(return_value=AIMessage(content="Answer 2"))

    with patch("nodes.actions.agent_node.get_model_from_name") as mock_get_model:
        mock_get_model.return_value = mock_model

        node = AgentNode("agent-1", agent_node_config)
        await node.execute(state, sample_config)

        # Check messages sent to model
        call_args = mock_model.ainvoke.call_args[0][0]

        # Should be: SystemMessage + 3 history messages
        assert len(call_args) == 4
        assert isinstance(call_args[0], SystemMessage)
        assert isinstance(call_args[1], HumanMessage)
        assert isinstance(call_args[2], AIMessage)
        assert isinstance(call_args[3], HumanMessage)


@pytest.mark.asyncio
async def test_agent_node_uses_configured_model(sample_state, sample_config, agent_node_config):
    """AgentNode should use the model specified in config."""
    from nodes.actions.agent_node import AgentNode

    mock_model = AsyncMock()
    mock_model.ainvoke = AsyncMock(return_value=AIMessage(content="Response"))

    with patch("nodes.actions.agent_node.get_model_from_name") as mock_get_model:
        mock_get_model.return_value = mock_model

        node = AgentNode("agent-1", agent_node_config)
        await node.execute(sample_state, sample_config)

        # Should call with the model from config
        mock_get_model.assert_called_once_with("gpt-4o-mini")


@pytest.mark.asyncio
async def test_agent_node_trims_messages(sample_config):
    """AgentNode should trim messages if they exceed token limit."""
    from nodes.actions.agent_node import AgentNode

    # Config with very low token limit
    config = {
        "prompt": {
            "system": "You are helpful.",
            "variables": [],
        },
        "llm": {"model": "gpt-4o-mini"},
        "memory": {"tokenLimit": 50},  # Very low limit
    }

    # State with many messages
    state = {
        "messages": [
            HumanMessage(content="A" * 100),  # ~25 tokens
            AIMessage(content="B" * 100),  # ~25 tokens
            HumanMessage(content="C" * 100),  # ~25 tokens
        ],
        "source": "manual",
    }

    mock_model = AsyncMock()
    mock_model.ainvoke = AsyncMock(return_value=AIMessage(content="Response"))

    with patch("nodes.actions.agent_node.get_model_from_name") as mock_get_model:
        mock_get_model.return_value = mock_model

        node = AgentNode("agent-1", config)
        await node.execute(state, sample_config)

        # Check that messages were trimmed
        call_args = mock_model.ainvoke.call_args[0][0]
        # Should have fewer messages due to trimming
        # At minimum: SystemMessage + 1 message
        assert len(call_args) >= 2
        assert len(call_args) < 4  # Less than system + 3 messages


@pytest.mark.asyncio
async def test_agent_node_type():
    """AgentNode should have correct node_type."""
    from nodes.actions.agent_node import AgentNode

    node = AgentNode("agent-1", {})
    assert node.node_type == "agent"


# =============================================================================
# Tests for default values
# =============================================================================


@pytest.mark.asyncio
async def test_agent_node_uses_defaults(sample_state, sample_config):
    """AgentNode should use sensible defaults for missing config."""
    from nodes.actions.agent_node import AgentNode

    # Minimal config
    config = {
        "prompt": {"system": "Hello"},
        "llm": {"model": "gpt-4o-mini"},
    }

    mock_model = AsyncMock()
    mock_model.ainvoke = AsyncMock(return_value=AIMessage(content="Hi"))

    with patch("nodes.actions.agent_node.get_model_from_name") as mock_get_model:
        mock_get_model.return_value = mock_model

        node = AgentNode("agent-1", config)
        result = await node.execute(sample_state, sample_config)

        # Should work with minimal config
        assert "messages" in result
        assert "agent_response" in result
