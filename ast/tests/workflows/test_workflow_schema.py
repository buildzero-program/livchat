"""Tests for workflow schema - TDD: tests first, implementation after."""

import pytest
from pydantic import ValidationError


class TestPromptConfig:
    """Tests for PromptConfig schema."""

    def test_prompt_config_valid(self):
        from schema.workflow_schema import PromptConfig

        config = PromptConfig(
            system="You are a helpful assistant.",
            variables=["current_datetime"],
        )
        assert config.system == "You are a helpful assistant."
        assert config.variables == ["current_datetime"]

    def test_prompt_config_defaults(self):
        from schema.workflow_schema import PromptConfig

        config = PromptConfig(system="Hello")
        assert config.variables == []

    def test_prompt_config_missing_system_fails(self):
        from schema.workflow_schema import PromptConfig

        with pytest.raises(ValidationError):
            PromptConfig()


class TestLLMConfig:
    """Tests for LLMConfig schema."""

    def test_llm_config_defaults(self):
        from schema.workflow_schema import LLMConfig

        config = LLMConfig()
        assert config.provider == "openai"
        assert config.model == "gpt-4o-mini"
        assert config.temperature == 0.7

    def test_llm_config_custom_values(self):
        from schema.workflow_schema import LLMConfig

        config = LLMConfig(
            provider="anthropic",
            model="claude-3-haiku",
            temperature=0.5,
        )
        assert config.provider == "anthropic"
        assert config.model == "claude-3-haiku"
        assert config.temperature == 0.5


class TestMemoryConfig:
    """Tests for MemoryConfig schema."""

    def test_memory_config_defaults(self):
        from schema.workflow_schema import MemoryConfig

        config = MemoryConfig()
        assert config.type == "buffer"
        assert config.tokenLimit == 16000
        assert config.messageLimit is None

    def test_memory_config_custom_values(self):
        from schema.workflow_schema import MemoryConfig

        config = MemoryConfig(
            type="window",
            tokenLimit=8000,
            messageLimit=50,
        )
        assert config.type == "window"
        assert config.tokenLimit == 8000
        assert config.messageLimit == 50

    def test_memory_config_null_token_limit(self):
        from schema.workflow_schema import MemoryConfig

        config = MemoryConfig(tokenLimit=None)
        assert config.tokenLimit is None


class TestAgentNodeConfig:
    """Tests for AgentNodeConfig schema."""

    def test_agent_node_config_minimal(self):
        from schema.workflow_schema import AgentNodeConfig, PromptConfig, LLMConfig

        config = AgentNodeConfig(
            prompt=PromptConfig(system="Hello"),
            llm=LLMConfig(),
        )
        assert config.prompt.system == "Hello"
        assert config.llm.model == "gpt-4o-mini"
        assert config.memory.tokenLimit == 16000
        assert config.tools == []

    def test_agent_node_config_with_tools(self):
        from schema.workflow_schema import AgentNodeConfig, PromptConfig, LLMConfig

        config = AgentNodeConfig(
            prompt=PromptConfig(system="Hello"),
            llm=LLMConfig(),
            tools=["search", "calculator"],
        )
        assert config.tools == ["search", "calculator"]


class TestWorkflowNode:
    """Tests for WorkflowNode schema."""

    def test_workflow_node_valid(self):
        from schema.workflow_schema import (
            WorkflowNode,
            AgentNodeConfig,
            PromptConfig,
            LLMConfig,
        )

        node = WorkflowNode(
            id="agent_1",
            type="agent",
            name="Test Agent",
            position={"x": 300, "y": 200},
            config=AgentNodeConfig(
                prompt=PromptConfig(system="You are helpful"),
                llm=LLMConfig(),
            ),
        )
        assert node.id == "agent_1"
        assert node.type == "agent"
        assert node.name == "Test Agent"
        assert node.position == {"x": 300, "y": 200}

    def test_workflow_node_defaults(self):
        from schema.workflow_schema import (
            WorkflowNode,
            AgentNodeConfig,
            PromptConfig,
            LLMConfig,
        )

        node = WorkflowNode(
            id="agent_1",
            name="Test",
            config=AgentNodeConfig(
                prompt=PromptConfig(system="Hello"),
                llm=LLMConfig(),
            ),
        )
        assert node.type == "agent"
        assert node.position == {"x": 0, "y": 0}


class TestWorkflowEdge:
    """Tests for WorkflowEdge schema."""

    def test_workflow_edge_valid(self):
        from schema.workflow_schema import WorkflowEdge

        edge = WorkflowEdge(
            source="agent_1",
            target="agent_2",
        )
        assert edge.source == "agent_1"
        assert edge.target == "agent_2"
        assert edge.sourceHandle is None
        assert edge.targetHandle is None

    def test_workflow_edge_with_handles(self):
        from schema.workflow_schema import WorkflowEdge

        edge = WorkflowEdge(
            source="agent_1",
            target="agent_2",
            sourceHandle="output_0",
            targetHandle="input_0",
        )
        assert edge.sourceHandle == "output_0"
        assert edge.targetHandle == "input_0"


class TestFlowData:
    """Tests for FlowData schema."""

    def test_flow_data_with_nodes(self):
        from schema.workflow_schema import (
            FlowData,
            WorkflowNode,
            AgentNodeConfig,
            PromptConfig,
            LLMConfig,
        )

        flow = FlowData(
            nodes=[
                WorkflowNode(
                    id="agent_1",
                    name="Test",
                    config=AgentNodeConfig(
                        prompt=PromptConfig(system="Hello"),
                        llm=LLMConfig(),
                    ),
                )
            ],
        )
        assert len(flow.nodes) == 1
        assert flow.edges == []

    def test_flow_data_with_edges(self):
        from schema.workflow_schema import (
            FlowData,
            WorkflowNode,
            WorkflowEdge,
            AgentNodeConfig,
            PromptConfig,
            LLMConfig,
        )

        flow = FlowData(
            nodes=[
                WorkflowNode(
                    id="agent_1",
                    name="Agent 1",
                    config=AgentNodeConfig(
                        prompt=PromptConfig(system="Hello"),
                        llm=LLMConfig(),
                    ),
                ),
                WorkflowNode(
                    id="agent_2",
                    name="Agent 2",
                    config=AgentNodeConfig(
                        prompt=PromptConfig(system="World"),
                        llm=LLMConfig(),
                    ),
                ),
            ],
            edges=[
                WorkflowEdge(source="agent_1", target="agent_2"),
            ],
        )
        assert len(flow.nodes) == 2
        assert len(flow.edges) == 1


class TestWorkflowCreate:
    """Tests for WorkflowCreate schema."""

    def test_workflow_create_valid(self):
        from schema.workflow_schema import (
            WorkflowCreate,
            FlowData,
            WorkflowNode,
            AgentNodeConfig,
            PromptConfig,
            LLMConfig,
        )

        workflow = WorkflowCreate(
            name="Test Workflow",
            description="A test workflow",
            flowData=FlowData(
                nodes=[
                    WorkflowNode(
                        id="agent_1",
                        name="Test",
                        config=AgentNodeConfig(
                            prompt=PromptConfig(system="Hello"),
                            llm=LLMConfig(),
                        ),
                    )
                ],
            ),
        )
        assert workflow.name == "Test Workflow"
        assert workflow.description == "A test workflow"
        assert len(workflow.flowData.nodes) == 1

    def test_workflow_create_empty_name_fails(self):
        from schema.workflow_schema import (
            WorkflowCreate,
            FlowData,
            WorkflowNode,
            AgentNodeConfig,
            PromptConfig,
            LLMConfig,
        )

        with pytest.raises(ValidationError):
            WorkflowCreate(
                name="",
                flowData=FlowData(
                    nodes=[
                        WorkflowNode(
                            id="agent_1",
                            name="Test",
                            config=AgentNodeConfig(
                                prompt=PromptConfig(system="Hello"),
                                llm=LLMConfig(),
                            ),
                        )
                    ],
                ),
            )

    def test_workflow_create_name_too_long_fails(self):
        from schema.workflow_schema import (
            WorkflowCreate,
            FlowData,
            WorkflowNode,
            AgentNodeConfig,
            PromptConfig,
            LLMConfig,
        )

        with pytest.raises(ValidationError):
            WorkflowCreate(
                name="x" * 129,  # 129 chars, max is 128
                flowData=FlowData(
                    nodes=[
                        WorkflowNode(
                            id="agent_1",
                            name="Test",
                            config=AgentNodeConfig(
                                prompt=PromptConfig(system="Hello"),
                                llm=LLMConfig(),
                            ),
                        )
                    ],
                ),
            )

    def test_workflow_create_no_description(self):
        from schema.workflow_schema import (
            WorkflowCreate,
            FlowData,
            WorkflowNode,
            AgentNodeConfig,
            PromptConfig,
            LLMConfig,
        )

        workflow = WorkflowCreate(
            name="Test",
            flowData=FlowData(
                nodes=[
                    WorkflowNode(
                        id="agent_1",
                        name="Test",
                        config=AgentNodeConfig(
                            prompt=PromptConfig(system="Hello"),
                            llm=LLMConfig(),
                        ),
                    )
                ],
            ),
        )
        assert workflow.description is None


class TestWorkflowUpdate:
    """Tests for WorkflowUpdate schema."""

    def test_workflow_update_partial(self):
        from schema.workflow_schema import WorkflowUpdate

        update = WorkflowUpdate(name="New Name")
        assert update.name == "New Name"
        assert update.description is None
        assert update.flowData is None
        assert update.isActive is None

    def test_workflow_update_all_fields(self):
        from schema.workflow_schema import (
            WorkflowUpdate,
            FlowData,
            WorkflowNode,
            AgentNodeConfig,
            PromptConfig,
            LLMConfig,
        )

        update = WorkflowUpdate(
            name="Updated",
            description="Updated desc",
            isActive=False,
            flowData=FlowData(
                nodes=[
                    WorkflowNode(
                        id="agent_1",
                        name="Test",
                        config=AgentNodeConfig(
                            prompt=PromptConfig(system="Hello"),
                            llm=LLMConfig(),
                        ),
                    )
                ],
            ),
        )
        assert update.name == "Updated"
        assert update.description == "Updated desc"
        assert update.isActive is False
        assert update.flowData is not None


class TestWorkflowResponse:
    """Tests for WorkflowResponse schema."""

    def test_workflow_response_valid(self):
        from datetime import datetime
        from schema.workflow_schema import (
            WorkflowResponse,
            FlowData,
            WorkflowNode,
            AgentNodeConfig,
            PromptConfig,
            LLMConfig,
        )

        now = datetime.now()
        response = WorkflowResponse(
            id="wf_123",
            name="Test",
            description=None,
            flowData=FlowData(
                nodes=[
                    WorkflowNode(
                        id="agent_1",
                        name="Test",
                        config=AgentNodeConfig(
                            prompt=PromptConfig(system="Hello"),
                            llm=LLMConfig(),
                        ),
                    )
                ],
            ),
            isActive=True,
            createdAt=now,
            updatedAt=now,
        )
        assert response.id == "wf_123"
        assert response.isActive is True
        assert response.createdAt == now


class TestWorkflowInvokeInput:
    """Tests for WorkflowInvokeInput schema."""

    def test_invoke_input_valid(self):
        from schema.workflow_schema import WorkflowInvokeInput

        input_data = WorkflowInvokeInput(
            message="Hello!",
            threadId="550e8400-e29b-41d4-a716-446655440000",
        )
        assert input_data.message == "Hello!"
        assert input_data.threadId == "550e8400-e29b-41d4-a716-446655440000"

    def test_invoke_input_empty_message_fails(self):
        from schema.workflow_schema import WorkflowInvokeInput

        with pytest.raises(ValidationError):
            WorkflowInvokeInput(
                message="",
                threadId="550e8400-e29b-41d4-a716-446655440000",
            )

    def test_invoke_input_multimodal_valid(self):
        """Test multimodal message with image and text."""
        from schema.workflow_schema import WorkflowInvokeInput

        input_data = WorkflowInvokeInput(
            message=[
                {"type": "image_url", "image_url": {"url": "https://example.com/img.jpg"}},
                {"type": "text", "text": "Descreva esta imagem"},
            ],
            threadId="550e8400-e29b-41d4-a716-446655440000",
        )
        assert isinstance(input_data.message, list)
        assert len(input_data.message) == 2
        assert input_data.message[0]["type"] == "image_url"
        assert input_data.message[1]["type"] == "text"

    def test_invoke_input_multimodal_empty_list_fails(self):
        """Test that empty multimodal list fails validation."""
        from schema.workflow_schema import WorkflowInvokeInput

        with pytest.raises(ValidationError):
            WorkflowInvokeInput(
                message=[],
                threadId="550e8400-e29b-41d4-a716-446655440000",
            )

    def test_invoke_input_multimodal_missing_type_fails(self):
        """Test that items without 'type' field fail validation."""
        from schema.workflow_schema import WorkflowInvokeInput

        with pytest.raises(ValidationError):
            WorkflowInvokeInput(
                message=[{"text": "Hello"}],  # Missing 'type' field
                threadId="550e8400-e29b-41d4-a716-446655440000",
            )
