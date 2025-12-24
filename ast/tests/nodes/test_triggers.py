"""Tests for trigger nodes."""

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
        "messages": [HumanMessage(content="Hello")],
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


# =============================================================================
# Tests for ManualTriggerNode
# =============================================================================


@pytest.mark.asyncio
async def test_manual_trigger_sets_source(sample_state, sample_config):
    """ManualTrigger should set source to 'manual'."""
    from nodes.triggers.manual_trigger import ManualTriggerNode

    node = ManualTriggerNode("trigger-1", {})
    result = await node.execute(sample_state, sample_config)

    assert result["source"] == "manual"


@pytest.mark.asyncio
async def test_manual_trigger_sets_empty_trigger_data(sample_state, sample_config):
    """ManualTrigger should set empty trigger_data."""
    from nodes.triggers.manual_trigger import ManualTriggerNode

    node = ManualTriggerNode("trigger-1", {})
    result = await node.execute(sample_state, sample_config)

    assert result["trigger_data"] == {}


@pytest.mark.asyncio
async def test_manual_trigger_preserves_messages(sample_state, sample_config):
    """ManualTrigger should NOT modify messages (passed through)."""
    from nodes.triggers.manual_trigger import ManualTriggerNode

    node = ManualTriggerNode("trigger-1", {})
    result = await node.execute(sample_state, sample_config)

    # Trigger doesn't modify messages - they are passed through
    # The result should NOT contain messages key (state merge will preserve original)
    assert "messages" not in result or result.get("messages") == sample_state["messages"]


@pytest.mark.asyncio
async def test_manual_trigger_node_type():
    """ManualTriggerNode should have correct node_type."""
    from nodes.triggers.manual_trigger import ManualTriggerNode

    node = ManualTriggerNode("trigger-1", {})
    assert node.node_type == "manual_trigger"


# =============================================================================
# Tests for WhatsAppConnectionTriggerNode (placeholder for Phase 5)
# =============================================================================


@pytest.mark.asyncio
async def test_whatsapp_connection_trigger_sets_source(sample_config):
    """WhatsAppConnectionTrigger should set source to 'whatsapp'."""
    from nodes.triggers.whatsapp_connection_trigger import WhatsAppConnectionTriggerNode

    state = {
        "messages": [],
        "trigger_data": {
            "instanceId": "inst_123",
            "instanceName": "My Instance",
            "phone": "5511999999999",
        },
    }

    node = WhatsAppConnectionTriggerNode("trigger-wa-1", {"events": ["connected"]})
    result = await node.execute(state, sample_config)

    assert result["source"] == "whatsapp"


@pytest.mark.asyncio
async def test_whatsapp_connection_trigger_creates_system_message(sample_config):
    """WhatsAppConnectionTrigger should create a SystemMessage about the connection."""
    from nodes.triggers.whatsapp_connection_trigger import WhatsAppConnectionTriggerNode

    state = {
        "messages": [],
        "trigger_data": {
            "instanceId": "inst_123",
            "instanceName": "Minha Loja",
            "phone": "5511999999999",
        },
    }

    node = WhatsAppConnectionTriggerNode("trigger-wa-1", {"events": ["connected"]})
    result = await node.execute(state, sample_config)

    assert "messages" in result
    assert len(result["messages"]) == 1
    assert isinstance(result["messages"][0], SystemMessage)
    assert "Minha Loja" in result["messages"][0].content
    assert "5511999999999" in result["messages"][0].content


# =============================================================================
# Tests for WhatsAppMessageTriggerNode (placeholder for Phase 6)
# =============================================================================


@pytest.mark.asyncio
async def test_whatsapp_message_trigger_sets_source(sample_config):
    """WhatsAppMessageTrigger should set source to 'whatsapp'."""
    from nodes.triggers.whatsapp_message_trigger import WhatsAppMessageTriggerNode

    state = {
        "messages": [],
        "trigger_data": {
            "sender": "5511888888888",
            "rawEvent": {
                "Message": {"conversation": "Olá Ivy!"},
            },
        },
    }

    node = WhatsAppMessageTriggerNode("trigger-wa-msg-1", {})
    result = await node.execute(state, sample_config)

    assert result["source"] == "whatsapp"


@pytest.mark.asyncio
async def test_whatsapp_message_trigger_creates_human_message(sample_config):
    """WhatsAppMessageTrigger should create a HumanMessage from the message text."""
    from nodes.triggers.whatsapp_message_trigger import WhatsAppMessageTriggerNode

    state = {
        "messages": [],
        "trigger_data": {
            "sender": "5511888888888",
            "rawEvent": {
                "Message": {"conversation": "Olá Ivy!"},
            },
        },
    }

    node = WhatsAppMessageTriggerNode("trigger-wa-msg-1", {})
    result = await node.execute(state, sample_config)

    assert "messages" in result
    assert len(result["messages"]) == 1
    assert isinstance(result["messages"][0], HumanMessage)
    assert result["messages"][0].content == "Olá Ivy!"


@pytest.mark.asyncio
async def test_whatsapp_message_trigger_extracts_extended_text(sample_config):
    """WhatsAppMessageTrigger should extract extendedTextMessage if present."""
    from nodes.triggers.whatsapp_message_trigger import WhatsAppMessageTriggerNode

    state = {
        "messages": [],
        "trigger_data": {
            "sender": "5511888888888",
            "rawEvent": {
                "Message": {
                    "extendedTextMessage": {"text": "Mensagem com link https://..."},
                },
            },
        },
    }

    node = WhatsAppMessageTriggerNode("trigger-wa-msg-1", {})
    result = await node.execute(state, sample_config)

    assert result["messages"][0].content == "Mensagem com link https://..."
