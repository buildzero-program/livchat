"""Storage layer for workflows using LangGraph's PostgresStore."""

from datetime import datetime, timezone
from typing import Any
import uuid

from langgraph.store.base import BaseStore

# Namespace for workflows in the store
WORKFLOWS_NAMESPACE = ("workflows",)


def generate_workflow_id() -> str:
    """Generate a unique workflow ID in the format wf_xxxxxxxxxxxx."""
    return f"wf_{uuid.uuid4().hex[:12]}"


async def create_workflow(
    store: BaseStore,
    name: str,
    flow_data: dict[str, Any],
    description: str | None = None,
) -> dict[str, Any]:
    """
    Create a new workflow in the store.

    Args:
        store: LangGraph store instance
        name: Workflow name
        flow_data: Workflow flow data (nodes, edges)
        description: Optional workflow description

    Returns:
        Created workflow data
    """
    workflow_id = generate_workflow_id()
    now = datetime.now(timezone.utc).isoformat()

    workflow = {
        "id": workflow_id,
        "name": name,
        "description": description,
        "flowData": flow_data,
        "isActive": True,
        "createdAt": now,
        "updatedAt": now,
    }

    await store.aput(
        namespace=WORKFLOWS_NAMESPACE,
        key=workflow_id,
        value=workflow,
    )

    return workflow


async def get_workflow(
    store: BaseStore,
    workflow_id: str,
) -> dict[str, Any] | None:
    """
    Get a workflow by ID.

    Args:
        store: LangGraph store instance
        workflow_id: Workflow ID to retrieve

    Returns:
        Workflow data or None if not found
    """
    result = await store.aget(
        namespace=WORKFLOWS_NAMESPACE,
        key=workflow_id,
    )
    return result.value if result else None


async def list_workflows(
    store: BaseStore,
    limit: int = 100,
) -> list[dict[str, Any]]:
    """
    List all workflows.

    Args:
        store: LangGraph store instance
        limit: Maximum number of workflows to return

    Returns:
        List of workflow data
    """
    results = await store.asearch(
        WORKFLOWS_NAMESPACE,
        limit=limit,
    )
    return [item.value for item in results]


async def update_workflow(
    store: BaseStore,
    workflow_id: str,
    updates: dict[str, Any],
) -> dict[str, Any] | None:
    """
    Update an existing workflow.

    Args:
        store: LangGraph store instance
        workflow_id: Workflow ID to update
        updates: Dictionary of fields to update (None values are ignored)

    Returns:
        Updated workflow data or None if not found
    """
    existing = await get_workflow(store, workflow_id)
    if not existing:
        return None

    # Merge updates, ignoring None values
    updated = {
        **existing,
        **{k: v for k, v in updates.items() if v is not None},
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }

    await store.aput(
        namespace=WORKFLOWS_NAMESPACE,
        key=workflow_id,
        value=updated,
    )

    return updated


async def delete_workflow(
    store: BaseStore,
    workflow_id: str,
) -> bool:
    """
    Delete a workflow.

    Args:
        store: LangGraph store instance
        workflow_id: Workflow ID to delete

    Returns:
        True if deleted, False if not found
    """
    existing = await get_workflow(store, workflow_id)
    if not existing:
        return False

    await store.adelete(
        namespace=WORKFLOWS_NAMESPACE,
        key=workflow_id,
    )
    return True
