"""
Tests for workflow_agent.py integration with Model Registry.

TDD: These tests define the expected behavior for:
1. get_model_from_name() - should use Model Registry for provider detection
2. workflow_agent - should use dynamic models, not fallback
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from langchain_core.messages import HumanMessage, AIMessage


class TestGetModelFromNameRegistry:
    """Tests for get_model_from_name with Model Registry integration."""

    @pytest.fixture
    def mock_registry(self):
        """Mock model_registry."""
        with patch("agents.workflow_agent.model_registry") as mock:
            yield mock

    @pytest.mark.asyncio
    async def test_model_found_in_registry(self, mock_registry):
        """Model found in registry should use registry provider."""
        from schema.model_info import ModelInfo, ProviderName
        from agents.workflow_agent import get_model_from_name

        mock_registry.get_model_info = AsyncMock(
            return_value=ModelInfo(
                id="gemini-3-flash-preview",
                provider=ProviderName.GOOGLE,
            )
        )

        with patch("agents.workflow_agent.get_model") as mock_get_model:
            mock_model = MagicMock()
            mock_get_model.return_value = mock_model

            model = await get_model_from_name("gemini-3-flash-preview")

            # Should call get_model with registry provider
            mock_get_model.assert_called_once_with(
                "gemini-3-flash-preview",
                provider="google",
            )
            assert model is mock_model

    @pytest.mark.asyncio
    async def test_model_not_in_registry_autodetect(self, mock_registry):
        """Model not in registry should try auto-detection."""
        from agents.workflow_agent import get_model_from_name

        mock_registry.get_model_info = AsyncMock(return_value=None)

        with patch("agents.workflow_agent.get_model") as mock_get_model:
            mock_model = MagicMock()
            mock_get_model.return_value = mock_model

            model = await get_model_from_name("gpt-5-nano")

            # Should call without explicit provider (auto-detect)
            mock_get_model.assert_called_once_with("gpt-5-nano")
            assert model is mock_model

    @pytest.mark.asyncio
    async def test_model_fallback_to_default(self, mock_registry):
        """Unknown model should fallback to DEFAULT_MODEL."""
        from agents.workflow_agent import get_model_from_name

        mock_registry.get_model_info = AsyncMock(return_value=None)

        with patch("agents.workflow_agent.get_model") as mock_get_model:
            # First call raises (auto-detect fails)
            # Second call succeeds (default model)
            mock_model = MagicMock()
            mock_get_model.side_effect = [
                ValueError("Cannot detect provider"),
                mock_model,
            ]

            with patch("agents.workflow_agent.settings") as mock_settings:
                mock_settings.DEFAULT_MODEL = "gpt-5-nano"

                model = await get_model_from_name("completely-unknown-model")

                assert mock_get_model.call_count == 2
                mock_get_model.assert_called_with("gpt-5-nano")
                assert model is mock_model

    @pytest.mark.asyncio
    async def test_registry_provider_takes_precedence(self, mock_registry):
        """Registry provider should take precedence over auto-detection."""
        from schema.model_info import ModelInfo, ProviderName
        from agents.workflow_agent import get_model_from_name

        # Registry says this is a Google model
        mock_registry.get_model_info = AsyncMock(
            return_value=ModelInfo(
                id="custom-model",
                provider=ProviderName.GOOGLE,
            )
        )

        with patch("agents.workflow_agent.get_model") as mock_get_model:
            mock_model = MagicMock()
            mock_get_model.return_value = mock_model

            model = await get_model_from_name("custom-model")

            # Should use Google provider from registry
            mock_get_model.assert_called_once_with(
                "custom-model",
                provider="google",
            )


class TestGetModelFromNameIsAsync:
    """Tests to verify get_model_from_name is async."""

    @pytest.mark.asyncio
    async def test_get_model_from_name_is_awaitable(self):
        """get_model_from_name should be an async function."""
        from agents.workflow_agent import get_model_from_name
        import inspect

        assert inspect.iscoroutinefunction(get_model_from_name), \
            "get_model_from_name must be an async function"


class TestWorkflowAgentUsesAsyncGetModel:
    """Tests to verify workflow_agent uses async get_model_from_name."""

    @pytest.fixture
    def clean_workflow_agent(self):
        """Reset workflow_agent checkpointer for tests."""
        from agents.workflow_agent import workflow_agent

        original_checkpointer = workflow_agent.checkpointer
        workflow_agent.checkpointer = None

        yield workflow_agent

        workflow_agent.checkpointer = original_checkpointer

    @pytest.mark.asyncio
    async def test_workflow_agent_awaits_get_model_from_name(
        self, clean_workflow_agent
    ):
        """workflow_agent should await get_model_from_name."""
        from agents.workflow_agent import workflow_agent
        from unittest.mock import AsyncMock, MagicMock
        from langchain_core.messages import HumanMessage, AIMessage

        mock_workflow = {
            "id": "wf_test",
            "flowData": {
                "nodes": [
                    {
                        "id": "agent_1",
                        "config": {
                            "prompt": {"system": "Hello"},
                            "llm": {"model": "gemini-3-flash-preview"},
                            "memory": {"tokenLimit": 1000},
                        },
                    }
                ],
                "edges": [],
            },
        }

        mock_model = MagicMock()
        mock_model.ainvoke = AsyncMock(return_value=AIMessage(content="Test"))

        with patch("agents.workflow_agent.get_workflow", new_callable=AsyncMock) as mock_get_wf:
            mock_get_wf.return_value = mock_workflow

            with patch("agents.workflow_agent.get_model_from_name", new_callable=AsyncMock) as mock_get_model:
                mock_get_model.return_value = mock_model

                with patch("agents.workflow_agent.model_registry"):
                    workflow_agent.store = MagicMock()

                    config = {
                        "configurable": {
                            "workflow_id": "wf_test",
                            "thread_id": "thread-123",
                        }
                    }

                    result = await workflow_agent.ainvoke(
                        {"messages": [HumanMessage(content="Hi")]},
                        config=config,
                    )

                    # Verify get_model_from_name was awaited with correct model
                    mock_get_model.assert_awaited_once_with("gemini-3-flash-preview")
