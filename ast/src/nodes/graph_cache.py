"""Workflow Graph Cache - Caches compiled StateGraphs for performance.

This module implements a singleton cache for compiled LangGraph StateGraphs,
avoiding the overhead of recompiling on every request. The cache key is
deterministic, based on workflow_id and a hash of the flowData.

★ Insight ─────────────────────────────────────
- Singleton pattern via __new__ ensures single cache instance across app
- Cache key: {workflow_id}:{md5(flowData)[:12]} for determinism
- asyncio.Lock prevents concurrent builds for the same workflow
─────────────────────────────────────────────────
"""

import asyncio
import hashlib
import json
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from langgraph.graph.state import CompiledStateGraph


class WorkflowGraphCache:
    """Singleton cache for compiled workflow StateGraphs.

    Avoids recompiling graphs on every request by caching them
    with a key based on workflow_id and flowData hash.

    Usage:
        from nodes.graph_cache import workflow_graph_cache

        # Configure once at startup
        workflow_graph_cache.configure(checkpointer=checkpointer, store=store)

        # Get or build graph
        graph = await workflow_graph_cache.get_or_build(workflow_dict)

        # Invalidate on workflow update
        workflow_graph_cache.invalidate("wf_123")
    """

    _instance: "WorkflowGraphCache | None" = None

    def __new__(cls) -> "WorkflowGraphCache":
        """Singleton pattern - always return the same instance."""
        if cls._instance is None:
            instance = super().__new__(cls)
            instance._cache: dict[str, "CompiledStateGraph"] = {}
            instance._locks: dict[str, asyncio.Lock] = {}
            instance._global_lock = asyncio.Lock()
            instance._checkpointer: Any | None = None
            instance._store: Any | None = None
            cls._instance = instance
        return cls._instance

    def _make_cache_key(self, workflow: dict[str, Any]) -> str:
        """Generate deterministic cache key from workflow_id and flowData hash.

        Key format: {workflow_id}:{md5_hash[:12]}

        Only flowData affects the hash - other fields like 'name' don't
        change the compiled graph structure.
        """
        workflow_id = workflow.get("id", "unknown")
        flow_data = workflow.get("flowData", {})

        # Serialize flowData deterministically (sorted keys)
        flow_json = json.dumps(flow_data, sort_keys=True, ensure_ascii=False)
        flow_hash = hashlib.md5(flow_json.encode("utf-8")).hexdigest()[:12]

        return f"{workflow_id}:{flow_hash}"

    async def get_or_build(
        self, workflow: dict[str, Any]
    ) -> "CompiledStateGraph":
        """Get cached graph or build a new one.

        Uses per-key locking to prevent concurrent builds of the same workflow
        while allowing parallel builds of different workflows.
        """
        key = self._make_cache_key(workflow)

        # Fast path: already cached
        if key in self._cache:
            return self._cache[key]

        # Slow path: need to build with proper locking
        # First, ensure we have a lock for this key
        async with self._global_lock:
            if key not in self._locks:
                self._locks[key] = asyncio.Lock()
            key_lock = self._locks[key]

        # Acquire the per-key lock
        async with key_lock:
            # Double-check after acquiring lock (another coroutine might have built it)
            if key in self._cache:
                return self._cache[key]

            # Build the graph - lazy import to avoid circular dependencies
            from nodes.executor import build_workflow_graph

            graph = await build_workflow_graph(
                workflow=workflow,
                checkpointer=self._checkpointer,
                store=self._store,
            )
            self._cache[key] = graph
            return graph

    def invalidate(self, workflow_id: str) -> int:
        """Remove all cached graphs for a workflow.

        Called when a workflow is updated or deleted to ensure
        the next request rebuilds with the new configuration.

        Returns:
            Number of cache entries removed.
        """
        keys_to_remove = [k for k in self._cache if k.startswith(f"{workflow_id}:")]
        for key in keys_to_remove:
            del self._cache[key]
            # Also clean up the lock
            self._locks.pop(key, None)
        return len(keys_to_remove)

    def clear(self) -> int:
        """Remove all cached graphs.

        Useful for testing or when configuration changes globally.

        Returns:
            Number of cache entries removed.
        """
        count = len(self._cache)
        self._cache.clear()
        self._locks.clear()
        return count

    def stats(self) -> dict[str, Any]:
        """Return cache statistics.

        Returns:
            Dict with 'entries' count and list of cached 'workflow_ids'.
        """
        workflow_ids: set[str] = set()
        for key in self._cache:
            # Key format: workflow_id:hash
            parts = key.split(":")
            if parts:
                workflow_ids.add(parts[0])

        return {
            "entries": len(self._cache),
            "workflow_ids": sorted(workflow_ids),
        }

    def configure(
        self,
        checkpointer: Any | None = None,
        store: Any | None = None,
    ) -> None:
        """Configure checkpointer and store for graph builds.

        Should be called once at application startup before any
        graph builds occur.

        Args:
            checkpointer: LangGraph checkpointer for state persistence
            store: LangGraph store for cross-thread memory
        """
        if checkpointer is not None:
            self._checkpointer = checkpointer
        if store is not None:
            self._store = store


# Module-level singleton instance - import this in other modules
workflow_graph_cache = WorkflowGraphCache()
