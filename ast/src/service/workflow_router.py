"""
Workflow Router - FastAPI endpoints for workflow management and execution.

Provides CRUD operations for workflows and invoke/stream endpoints for execution.
"""

import json
import logging
from collections.abc import AsyncGenerator
from typing import Annotated, Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from langchain_core.messages import HumanMessage
from langchain_core.runnables import RunnableConfig

from agents import get_agent
from core.settings import settings
from schema.workflow_schema import (
    WorkflowCreate,
    WorkflowUpdate,
    WorkflowResponse,
    WorkflowInvokeInput,
    WorkflowStreamInput,
)
from workflows import (
    create_workflow,
    get_workflow,
    list_workflows,
    update_workflow,
    delete_workflow,
)

logger = logging.getLogger(__name__)

WORKFLOW_AGENT_ID = "workflow-agent"


# =============================================================================
# Authentication
# =============================================================================


def verify_bearer(
    http_auth: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(HTTPBearer(description="Please provide AUTH_SECRET api key.", auto_error=False)),
    ],
) -> None:
    """Verify Bearer token authentication."""
    if not settings.AUTH_SECRET:
        return  # No AUTH_SECRET configured, allow all requests
    auth_secret = settings.AUTH_SECRET.get_secret_value()
    if not http_auth or http_auth.credentials != auth_secret:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)


# =============================================================================
# Router Setup
# =============================================================================


router = APIRouter(
    prefix="/workflows",
    tags=["workflows"],
    dependencies=[Depends(verify_bearer)],
)


def _get_store():
    """Get the store from the workflow agent."""
    agent = get_agent(WORKFLOW_AGENT_ID)
    store = agent.store
    if not store:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Store not initialized",
        )
    return store


# =============================================================================
# CRUD Endpoints
# =============================================================================


@router.post("", response_model=WorkflowResponse)
async def create_workflow_endpoint(workflow_data: WorkflowCreate) -> WorkflowResponse:
    """
    Create a new workflow.

    Args:
        workflow_data: Workflow configuration including name, description, and flowData

    Returns:
        Created workflow with generated ID
    """
    store = _get_store()

    try:
        workflow = await create_workflow(
            store=store,
            name=workflow_data.name,
            flow_data=workflow_data.flowData.model_dump(),
            description=workflow_data.description,
        )
        return WorkflowResponse(**workflow)
    except Exception as e:
        logger.error(f"Error creating workflow: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create workflow",
        )


@router.get("", response_model=list[WorkflowResponse])
async def list_workflows_endpoint(limit: int = 100) -> list[WorkflowResponse]:
    """
    List all workflows.

    Args:
        limit: Maximum number of workflows to return

    Returns:
        List of workflows
    """
    store = _get_store()

    try:
        workflows = await list_workflows(store, limit=limit)
        return [WorkflowResponse(**w) for w in workflows]
    except Exception as e:
        logger.error(f"Error listing workflows: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list workflows",
        )


@router.get("/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow_endpoint(workflow_id: str) -> WorkflowResponse:
    """
    Get a workflow by ID.

    Args:
        workflow_id: The workflow ID (wf_xxx format)

    Returns:
        Workflow details

    Raises:
        HTTPException: 404 if workflow not found
    """
    store = _get_store()

    try:
        workflow = await get_workflow(store, workflow_id)
        if not workflow:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Workflow {workflow_id} not found",
            )
        return WorkflowResponse(**workflow)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching workflow: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch workflow",
        )


@router.patch("/{workflow_id}", response_model=WorkflowResponse)
async def update_workflow_endpoint(
    workflow_id: str,
    updates: WorkflowUpdate,
) -> WorkflowResponse:
    """
    Update a workflow.

    Args:
        workflow_id: The workflow ID
        updates: Fields to update

    Returns:
        Updated workflow

    Raises:
        HTTPException: 404 if workflow not found
    """
    store = _get_store()

    try:
        # Convert flowData to dict if present
        updates_dict = updates.model_dump(exclude_none=True)
        if "flowData" in updates_dict and updates_dict["flowData"]:
            updates_dict["flowData"] = updates_dict["flowData"]

        updated = await update_workflow(store, workflow_id, updates_dict)
        if not updated:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Workflow {workflow_id} not found",
            )
        return WorkflowResponse(**updated)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating workflow: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update workflow",
        )


@router.delete("/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workflow_endpoint(workflow_id: str) -> None:
    """
    Delete a workflow.

    Args:
        workflow_id: The workflow ID

    Raises:
        HTTPException: 404 if workflow not found
    """
    store = _get_store()

    try:
        deleted = await delete_workflow(store, workflow_id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Workflow {workflow_id} not found",
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting workflow: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete workflow",
        )


# =============================================================================
# Execution Endpoints
# =============================================================================


@router.post("/{workflow_id}/invoke")
async def invoke_workflow(
    workflow_id: str,
    input_data: WorkflowInvokeInput,
) -> dict[str, Any]:
    """
    Invoke a workflow and get the final response.

    Args:
        workflow_id: The workflow ID
        input_data: Message and thread ID

    Returns:
        AI response message

    Raises:
        HTTPException: 404 if workflow not found
    """
    store = _get_store()

    # Verify workflow exists
    workflow = await get_workflow(store, workflow_id)
    if not workflow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workflow {workflow_id} not found",
        )

    agent = get_agent(WORKFLOW_AGENT_ID)

    try:
        run_id = uuid4()
        thread_id = input_data.threadId or str(uuid4())

        config = RunnableConfig(
            configurable={
                "workflow_id": workflow_id,
                "thread_id": thread_id,
            },
            run_id=run_id,
        )

        response_events = await agent.ainvoke(
            input={"messages": [HumanMessage(content=input_data.message)]},
            config=config,
            stream_mode=["updates", "values"],
        )

        # Get the last response
        response_type, response = response_events[-1]
        if response_type == "values":
            last_message = response["messages"][-1]
            return {
                "message": {
                    "content": last_message.content,
                    "type": "ai",
                    "run_id": str(run_id),
                },
                "threadId": thread_id,
            }
        else:
            raise ValueError(f"Unexpected response type: {response_type}")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error invoking workflow: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to invoke workflow",
        )


async def workflow_stream_generator(
    workflow_id: str,
    input_data: WorkflowStreamInput,
    store,
) -> AsyncGenerator[str, None]:
    """
    Generate streaming workflow events using astream_events for token streaming.

    Args:
        workflow_id: The workflow ID
        input_data: Message and thread ID
        store: The store instance

    Yields:
        SSE-formatted events
    """
    agent = get_agent(WORKFLOW_AGENT_ID)
    thread_id = input_data.threadId or str(uuid4())

    try:
        run_id = uuid4()

        config = RunnableConfig(
            configurable={
                "workflow_id": workflow_id,
                "thread_id": thread_id,
            },
            run_id=run_id,
        )

        # Use astream_events for proper token streaming
        async for event in agent.astream_events(
            input={"messages": [HumanMessage(content=input_data.message)]},
            config=config,
            version="v2",
        ):
            event_kind = event.get("event")

            # Stream tokens from chat model
            if event_kind == "on_chat_model_stream":
                chunk = event.get("data", {}).get("chunk")
                if chunk and hasattr(chunk, "content") and chunk.content:
                    yield f"data: {json.dumps({'type': 'token', 'content': chunk.content})}\n\n"

            # Chain/Graph completion
            elif event_kind == "on_chain_end":
                if event.get("name") == "LangGraph":
                    output = event.get("data", {}).get("output", {})
                    messages = output.get("messages", [])
                    if messages:
                        last_msg = messages[-1]
                        if hasattr(last_msg, "content"):
                            yield f"data: {json.dumps({'type': 'complete', 'content': last_msg.content})}\n\n"

    except Exception as e:
        logger.error(f"Error in workflow stream: {e}")
        yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

    finally:
        yield f"data: {json.dumps({'type': 'done', 'threadId': thread_id})}\n\n"
        yield "data: [DONE]\n\n"


@router.post("/{workflow_id}/stream", response_class=StreamingResponse)
async def stream_workflow(
    workflow_id: str,
    input_data: WorkflowStreamInput,
) -> StreamingResponse:
    """
    Stream workflow execution with Server-Sent Events.

    Args:
        workflow_id: The workflow ID
        input_data: Message and thread ID

    Returns:
        Streaming response with SSE events

    Raises:
        HTTPException: 404 if workflow not found
    """
    store = _get_store()

    # Verify workflow exists
    workflow = await get_workflow(store, workflow_id)
    if not workflow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workflow {workflow_id} not found",
        )

    return StreamingResponse(
        workflow_stream_generator(workflow_id, input_data, store),
        media_type="text/event-stream",
    )
