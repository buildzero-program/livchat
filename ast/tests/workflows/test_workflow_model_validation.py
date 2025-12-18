"""Tests for workflow model validation."""

import pytest
from unittest.mock import AsyncMock, patch

from schema.workflow_schema import LLMConfig, validate_workflow_models


class TestLLMConfigValidation:
    """Tests for LLMConfig basic validation."""

    def test_valid_model(self):
        """Test valid model name passes."""
        config = LLMConfig(model="gpt-4o-mini")
        assert config.model == "gpt-4o-mini"

    def test_empty_model_fails(self):
        """Test empty model name fails validation."""
        with pytest.raises(ValueError, match="cannot be empty"):
            LLMConfig(model="")

    def test_whitespace_model_fails(self):
        """Test whitespace-only model name fails."""
        with pytest.raises(ValueError, match="cannot be empty"):
            LLMConfig(model="   ")

    def test_model_trimmed(self):
        """Test model name is trimmed of whitespace."""
        config = LLMConfig(model="  gpt-4o  ")
        assert config.model == "gpt-4o"

    def test_default_model(self):
        """Test default model value."""
        config = LLMConfig()
        assert config.model == "gpt-4o-mini"

    def test_default_provider(self):
        """Test default provider value."""
        config = LLMConfig()
        assert config.provider == "openai"


class TestValidateWorkflowModels:
    """Tests for async workflow model validation."""

    @pytest.fixture
    def mock_registry(self):
        """Mock model registry."""
        with patch("schema.workflow_schema.get_registry") as mock:
            registry = AsyncMock()
            mock.return_value = registry
            yield registry

    @pytest.mark.asyncio
    async def test_valid_workflow_single_node(self, mock_registry):
        """Test workflow with valid model passes."""
        mock_registry.validate_model.return_value = (True, "")

        workflow_data = {
            "flowData": {
                "nodes": [
                    {
                        "id": "agent_1",
                        "name": "Test Agent",
                        "config": {
                            "prompt": {"system": "Hello"},
                            "llm": {"model": "gpt-4o-mini"},
                        },
                    }
                ]
            }
        }

        is_valid, errors = await validate_workflow_models(workflow_data)

        assert is_valid is True
        assert errors == []
        mock_registry.validate_model.assert_called_once_with("gpt-4o-mini")

    @pytest.mark.asyncio
    async def test_invalid_model_single_node(self, mock_registry):
        """Test workflow with invalid model fails."""
        mock_registry.validate_model.return_value = (
            False,
            "Modelo 'fake-model' não disponível. Modelos disponíveis: gpt-4o",
        )

        workflow_data = {
            "flowData": {
                "nodes": [
                    {
                        "id": "agent_1",
                        "name": "Test Agent",
                        "config": {
                            "prompt": {"system": "Hello"},
                            "llm": {"model": "fake-model"},
                        },
                    }
                ]
            }
        }

        is_valid, errors = await validate_workflow_models(workflow_data)

        assert is_valid is False
        assert len(errors) == 1
        assert "agent_1" in errors[0]
        assert "fake-model" in errors[0]

    @pytest.mark.asyncio
    async def test_multiple_nodes_all_valid(self, mock_registry):
        """Test workflow with multiple valid models."""
        mock_registry.validate_model.return_value = (True, "")

        workflow_data = {
            "flowData": {
                "nodes": [
                    {
                        "id": "node_1",
                        "config": {"llm": {"model": "gpt-4o"}},
                    },
                    {
                        "id": "node_2",
                        "config": {"llm": {"model": "claude-sonnet-4-5"}},
                    },
                ]
            }
        }

        is_valid, errors = await validate_workflow_models(workflow_data)

        assert is_valid is True
        assert errors == []
        assert mock_registry.validate_model.call_count == 2

    @pytest.mark.asyncio
    async def test_multiple_nodes_some_invalid(self, mock_registry):
        """Test workflow with some invalid models."""
        mock_registry.validate_model.side_effect = [
            (True, ""),
            (False, "Modelo 'fake-2' não disponível"),
        ]

        workflow_data = {
            "flowData": {
                "nodes": [
                    {"id": "node_1", "config": {"llm": {"model": "gpt-4o"}}},
                    {"id": "node_2", "config": {"llm": {"model": "fake-2"}}},
                ]
            }
        }

        is_valid, errors = await validate_workflow_models(workflow_data)

        assert is_valid is False
        assert len(errors) == 1
        assert "node_2" in errors[0]

    @pytest.mark.asyncio
    async def test_multiple_invalid_models(self, mock_registry):
        """Test workflow with multiple invalid models."""
        mock_registry.validate_model.side_effect = [
            (False, "Modelo 'fake-1' não disponível"),
            (False, "Modelo 'fake-2' não disponível"),
        ]

        workflow_data = {
            "flowData": {
                "nodes": [
                    {"id": "node_1", "config": {"llm": {"model": "fake-1"}}},
                    {"id": "node_2", "config": {"llm": {"model": "fake-2"}}},
                ]
            }
        }

        is_valid, errors = await validate_workflow_models(workflow_data)

        assert is_valid is False
        assert len(errors) == 2

    @pytest.mark.asyncio
    async def test_empty_workflow(self, mock_registry):
        """Test empty workflow passes validation."""
        workflow_data = {"flowData": {"nodes": []}}

        is_valid, errors = await validate_workflow_models(workflow_data)

        assert is_valid is True
        assert errors == []
        mock_registry.validate_model.assert_not_called()

    @pytest.mark.asyncio
    async def test_node_without_llm_config(self, mock_registry):
        """Test node without llm config is skipped."""
        workflow_data = {
            "flowData": {
                "nodes": [
                    {"id": "node_1", "config": {}},  # No llm config
                ]
            }
        }

        is_valid, errors = await validate_workflow_models(workflow_data)

        assert is_valid is True
        mock_registry.validate_model.assert_not_called()

    @pytest.mark.asyncio
    async def test_node_without_model(self, mock_registry):
        """Test node with llm config but no model is skipped."""
        workflow_data = {
            "flowData": {
                "nodes": [
                    {"id": "node_1", "config": {"llm": {}}},  # No model
                ]
            }
        }

        is_valid, errors = await validate_workflow_models(workflow_data)

        assert is_valid is True
        mock_registry.validate_model.assert_not_called()

    @pytest.mark.asyncio
    async def test_missing_flowdata(self, mock_registry):
        """Test missing flowData is handled gracefully."""
        workflow_data = {}

        is_valid, errors = await validate_workflow_models(workflow_data)

        assert is_valid is True
        assert errors == []

    @pytest.mark.asyncio
    async def test_node_id_in_error_message(self, mock_registry):
        """Test error message includes node ID for identification."""
        mock_registry.validate_model.return_value = (
            False,
            "Modelo não disponível",
        )

        workflow_data = {
            "flowData": {
                "nodes": [
                    {
                        "id": "my_custom_node",
                        "config": {"llm": {"model": "invalid"}},
                    }
                ]
            }
        }

        is_valid, errors = await validate_workflow_models(workflow_data)

        assert is_valid is False
        assert "my_custom_node" in errors[0]
