"""Pydantic schemas for workflow system."""

from datetime import datetime

from pydantic import BaseModel, Field


class PromptConfig(BaseModel):
    """Configuration for agent prompt."""

    system: str = Field(..., description="System prompt template")
    variables: list[str] = Field(
        default=[],
        description="List of template variables used in the prompt (e.g., current_datetime)",
    )


class LLMConfig(BaseModel):
    """Configuration for LLM model."""

    provider: str = Field(default="openai", description="LLM provider name")
    model: str = Field(default="gpt-4o-mini", description="Model identifier")
    temperature: float = Field(
        default=0.7, ge=0.0, le=2.0, description="Sampling temperature"
    )


class MemoryConfig(BaseModel):
    """Configuration for conversation memory."""

    type: str = Field(default="buffer", description="Memory type (buffer, window, etc)")
    tokenLimit: int | None = Field(
        default=16000, description="Maximum tokens to keep in context"
    )
    messageLimit: int | None = Field(
        default=None, description="Maximum messages to keep in context"
    )


class AgentNodeConfig(BaseModel):
    """Configuration for an agent node."""

    prompt: PromptConfig = Field(..., description="Prompt configuration")
    llm: LLMConfig = Field(..., description="LLM configuration")
    memory: MemoryConfig = Field(
        default_factory=MemoryConfig, description="Memory configuration"
    )
    tools: list[str] = Field(default=[], description="List of tool names to enable")


class WorkflowNode(BaseModel):
    """A node in the workflow graph."""

    id: str = Field(..., description="Unique node identifier")
    type: str = Field(default="agent", description="Node type (agent, condition, etc)")
    name: str = Field(..., description="Display name for the node")
    position: dict[str, float] = Field(
        default={"x": 0, "y": 0}, description="Canvas position for visual editor"
    )
    config: AgentNodeConfig = Field(..., description="Node configuration")


class WorkflowEdge(BaseModel):
    """An edge connecting two nodes in the workflow."""

    source: str = Field(..., description="Source node ID")
    target: str = Field(..., description="Target node ID")
    sourceHandle: str | None = Field(
        default=None, description="Source output handle"
    )
    targetHandle: str | None = Field(
        default=None, description="Target input handle"
    )


class FlowData(BaseModel):
    """Complete workflow flow data with nodes and edges."""

    nodes: list[WorkflowNode] = Field(..., description="List of workflow nodes")
    edges: list[WorkflowEdge] = Field(
        default=[], description="List of edges connecting nodes"
    )


class WorkflowCreate(BaseModel):
    """Schema for creating a new workflow."""

    name: str = Field(
        ...,
        min_length=1,
        max_length=128,
        description="Workflow name",
    )
    description: str | None = Field(default=None, description="Workflow description")
    flowData: FlowData = Field(..., description="Workflow flow data")


class WorkflowUpdate(BaseModel):
    """Schema for updating an existing workflow."""

    name: str | None = Field(default=None, description="New workflow name")
    description: str | None = Field(default=None, description="New description")
    flowData: FlowData | None = Field(default=None, description="New flow data")
    isActive: bool | None = Field(default=None, description="Active status")


class WorkflowResponse(BaseModel):
    """Schema for workflow API responses."""

    id: str = Field(..., description="Workflow ID (wf_xxx format)")
    name: str = Field(..., description="Workflow name")
    description: str | None = Field(default=None, description="Workflow description")
    flowData: FlowData = Field(..., description="Workflow flow data")
    isActive: bool = Field(..., description="Whether workflow is active")
    createdAt: datetime = Field(..., description="Creation timestamp")
    updatedAt: datetime | None = Field(default=None, description="Last update timestamp")


class WorkflowInvokeInput(BaseModel):
    """Schema for invoking a workflow."""

    message: str = Field(
        ...,
        min_length=1,
        description="User message to send to the workflow",
    )
    threadId: str = Field(..., description="Thread ID (UUID) for conversation")


class WorkflowStreamInput(WorkflowInvokeInput):
    """Schema for streaming workflow invocation."""

    pass
