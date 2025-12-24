"""Tests for WorkflowGraphCache - TDD Phase 2.1."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import asyncio


@pytest.fixture
def sample_workflow():
    """Sample workflow with trigger + agent."""
    return {
        "id": "wf_test_cache",
        "name": "Test Workflow",
        "flowData": {
            "nodes": [
                {
                    "id": "trigger-1",
                    "type": "manual_trigger",
                    "name": "Trigger",
                    "config": {},
                },
                {
                    "id": "agent-1",
                    "type": "agent",
                    "name": "Agent",
                    "config": {
                        "prompt": {"system": "Hello"},
                        "llm": {"model": "gpt-4o-mini"},
                    },
                },
            ],
            "edges": [
                {"source": "trigger-1", "target": "agent-1"},
            ],
        },
    }


@pytest.fixture
def modified_workflow(sample_workflow):
    """Workflow with modified flowData."""
    modified = sample_workflow.copy()
    modified["flowData"] = sample_workflow["flowData"].copy()
    modified["flowData"]["nodes"] = sample_workflow["flowData"]["nodes"].copy()
    modified["flowData"]["nodes"].append({
        "id": "end-1",
        "type": "end",
        "name": "End",
        "config": {},
    })
    return modified


@pytest.fixture(autouse=True)
def clear_cache():
    """Clear cache before and after each test."""
    from nodes.graph_cache import workflow_graph_cache
    workflow_graph_cache.clear()
    yield
    workflow_graph_cache.clear()


class TestWorkflowGraphCacheSingleton:
    """Tests for singleton pattern."""

    def test_singleton_same_instance(self):
        """Cache should return same instance."""
        from nodes.graph_cache import WorkflowGraphCache

        cache1 = WorkflowGraphCache()
        cache2 = WorkflowGraphCache()

        assert cache1 is cache2

    def test_singleton_module_instance(self):
        """Module-level instance should be singleton."""
        from nodes.graph_cache import WorkflowGraphCache, workflow_graph_cache

        new_instance = WorkflowGraphCache()
        assert new_instance is workflow_graph_cache


class TestCacheKeyGeneration:
    """Tests for cache key determinism."""

    def test_cache_key_format(self, sample_workflow):
        """Cache key should have format workflow_id:hash."""
        from nodes.graph_cache import workflow_graph_cache

        key = workflow_graph_cache._make_cache_key(sample_workflow)

        assert key.startswith("wf_test_cache:")
        assert len(key.split(":")) == 2

    def test_cache_key_deterministic(self, sample_workflow):
        """Same workflow should produce same key."""
        from nodes.graph_cache import workflow_graph_cache

        key1 = workflow_graph_cache._make_cache_key(sample_workflow)
        key2 = workflow_graph_cache._make_cache_key(sample_workflow)

        assert key1 == key2

    def test_cache_key_changes_with_flowdata(self, sample_workflow, modified_workflow):
        """Different flowData should produce different key."""
        from nodes.graph_cache import workflow_graph_cache

        key1 = workflow_graph_cache._make_cache_key(sample_workflow)
        key2 = workflow_graph_cache._make_cache_key(modified_workflow)

        assert key1 != key2

    def test_cache_key_ignores_non_flowdata_fields(self, sample_workflow):
        """Fields outside flowData should not affect key."""
        from nodes.graph_cache import workflow_graph_cache

        key1 = workflow_graph_cache._make_cache_key(sample_workflow)

        # Modify non-flowData field
        sample_workflow["name"] = "Different Name"
        key2 = workflow_graph_cache._make_cache_key(sample_workflow)

        # Same workflow_id and flowData = same key
        assert key1 == key2


class TestCacheHitMiss:
    """Tests for cache hit/miss behavior."""

    @pytest.mark.asyncio
    async def test_cache_miss_builds_graph(self, sample_workflow):
        """First call should build graph (cache miss)."""
        from nodes.graph_cache import workflow_graph_cache

        mock_graph = MagicMock()

        with patch("nodes.executor.build_workflow_graph", new_callable=AsyncMock) as mock_build:
            mock_build.return_value = mock_graph

            result = await workflow_graph_cache.get_or_build(sample_workflow)

            assert mock_build.call_count == 1
            assert result is mock_graph

    @pytest.mark.asyncio
    async def test_cache_hit_reuses_graph(self, sample_workflow):
        """Second call should reuse cached graph (cache hit)."""
        from nodes.graph_cache import workflow_graph_cache

        mock_graph = MagicMock()

        with patch("nodes.executor.build_workflow_graph", new_callable=AsyncMock) as mock_build:
            mock_build.return_value = mock_graph

            # First call - miss
            result1 = await workflow_graph_cache.get_or_build(sample_workflow)
            # Second call - hit
            result2 = await workflow_graph_cache.get_or_build(sample_workflow)

            assert mock_build.call_count == 1  # Only called once
            assert result1 is result2
            assert result1 is mock_graph

    @pytest.mark.asyncio
    async def test_different_workflows_different_graphs(self, sample_workflow, modified_workflow):
        """Different workflows should build separate graphs."""
        from nodes.graph_cache import workflow_graph_cache

        mock_graph1 = MagicMock(name="graph1")
        mock_graph2 = MagicMock(name="graph2")

        with patch("nodes.executor.build_workflow_graph", new_callable=AsyncMock) as mock_build:
            mock_build.side_effect = [mock_graph1, mock_graph2]

            result1 = await workflow_graph_cache.get_or_build(sample_workflow)
            result2 = await workflow_graph_cache.get_or_build(modified_workflow)

            assert mock_build.call_count == 2
            assert result1 is mock_graph1
            assert result2 is mock_graph2


class TestCacheInvalidation:
    """Tests for cache invalidation."""

    def test_invalidate_removes_entries(self, sample_workflow):
        """Invalidate should remove all entries for workflow."""
        from nodes.graph_cache import workflow_graph_cache

        # Manually add to cache
        key = workflow_graph_cache._make_cache_key(sample_workflow)
        workflow_graph_cache._cache[key] = MagicMock()

        # Invalidate
        removed = workflow_graph_cache.invalidate("wf_test_cache")

        assert removed == 1
        assert key not in workflow_graph_cache._cache

    def test_invalidate_returns_zero_when_not_found(self):
        """Invalidate should return 0 when workflow not in cache."""
        from nodes.graph_cache import workflow_graph_cache

        removed = workflow_graph_cache.invalidate("wf_nonexistent")

        assert removed == 0

    def test_invalidate_only_removes_matching_workflow(self, sample_workflow):
        """Invalidate should not affect other workflows."""
        from nodes.graph_cache import workflow_graph_cache

        # Add two different workflows
        workflow_graph_cache._cache["wf_test_cache:abc123"] = MagicMock()
        workflow_graph_cache._cache["wf_other:def456"] = MagicMock()

        # Invalidate only one
        workflow_graph_cache.invalidate("wf_test_cache")

        assert "wf_test_cache:abc123" not in workflow_graph_cache._cache
        assert "wf_other:def456" in workflow_graph_cache._cache

    @pytest.mark.asyncio
    async def test_invalidate_causes_rebuild(self, sample_workflow):
        """After invalidation, next call should rebuild."""
        from nodes.graph_cache import workflow_graph_cache

        mock_graph1 = MagicMock(name="graph1")
        mock_graph2 = MagicMock(name="graph2")

        with patch("nodes.executor.build_workflow_graph", new_callable=AsyncMock) as mock_build:
            mock_build.side_effect = [mock_graph1, mock_graph2]

            # First build
            result1 = await workflow_graph_cache.get_or_build(sample_workflow)

            # Invalidate
            workflow_graph_cache.invalidate("wf_test_cache")

            # Should rebuild
            result2 = await workflow_graph_cache.get_or_build(sample_workflow)

            assert mock_build.call_count == 2
            assert result1 is mock_graph1
            assert result2 is mock_graph2


class TestCacheClear:
    """Tests for cache clear."""

    def test_clear_removes_all_entries(self):
        """Clear should remove all entries."""
        from nodes.graph_cache import workflow_graph_cache

        # Add multiple entries
        workflow_graph_cache._cache["wf_1:abc"] = MagicMock()
        workflow_graph_cache._cache["wf_2:def"] = MagicMock()
        workflow_graph_cache._cache["wf_3:ghi"] = MagicMock()

        count = workflow_graph_cache.clear()

        assert count == 3
        assert len(workflow_graph_cache._cache) == 0

    def test_clear_returns_zero_when_empty(self):
        """Clear should return 0 when cache is empty."""
        from nodes.graph_cache import workflow_graph_cache

        count = workflow_graph_cache.clear()

        assert count == 0


class TestCacheStats:
    """Tests for cache statistics."""

    def test_stats_empty_cache(self):
        """Stats should show empty cache correctly."""
        from nodes.graph_cache import workflow_graph_cache

        stats = workflow_graph_cache.stats()

        assert stats["entries"] == 0
        assert stats["workflow_ids"] == []

    def test_stats_with_entries(self):
        """Stats should reflect cached entries."""
        from nodes.graph_cache import workflow_graph_cache

        workflow_graph_cache._cache["wf_1:abc"] = MagicMock()
        workflow_graph_cache._cache["wf_1:def"] = MagicMock()  # Same workflow, different version
        workflow_graph_cache._cache["wf_2:ghi"] = MagicMock()

        stats = workflow_graph_cache.stats()

        assert stats["entries"] == 3
        assert set(stats["workflow_ids"]) == {"wf_1", "wf_2"}


class TestCacheConfiguration:
    """Tests for cache configuration."""

    def test_configure_stores_checkpointer(self):
        """Configure should store checkpointer."""
        from nodes.graph_cache import workflow_graph_cache

        mock_checkpointer = MagicMock()
        workflow_graph_cache.configure(checkpointer=mock_checkpointer)

        assert workflow_graph_cache._checkpointer is mock_checkpointer

    def test_configure_stores_store(self):
        """Configure should store store."""
        from nodes.graph_cache import workflow_graph_cache

        mock_store = MagicMock()
        workflow_graph_cache.configure(store=mock_store)

        assert workflow_graph_cache._store is mock_store

    @pytest.mark.asyncio
    async def test_build_uses_configured_checkpointer_and_store(self, sample_workflow):
        """Build should use configured checkpointer and store."""
        from nodes.graph_cache import workflow_graph_cache

        mock_checkpointer = MagicMock()
        mock_store = MagicMock()
        workflow_graph_cache.configure(checkpointer=mock_checkpointer, store=mock_store)

        with patch("nodes.executor.build_workflow_graph", new_callable=AsyncMock) as mock_build:
            mock_build.return_value = MagicMock()

            await workflow_graph_cache.get_or_build(sample_workflow)

            mock_build.assert_called_once_with(
                workflow=sample_workflow,
                checkpointer=mock_checkpointer,
                store=mock_store,
            )


class TestCacheConcurrency:
    """Tests for thread-safety and concurrency."""

    @pytest.mark.asyncio
    async def test_concurrent_builds_only_build_once(self, sample_workflow):
        """Concurrent calls for same workflow should only build once."""
        from nodes.graph_cache import workflow_graph_cache

        build_count = 0

        async def slow_build(*args, **kwargs):
            nonlocal build_count
            build_count += 1
            await asyncio.sleep(0.1)  # Simulate slow build
            return MagicMock()

        with patch("nodes.executor.build_workflow_graph", new_callable=AsyncMock) as mock_build:
            mock_build.side_effect = slow_build

            # Start multiple concurrent calls
            results = await asyncio.gather(
                workflow_graph_cache.get_or_build(sample_workflow),
                workflow_graph_cache.get_or_build(sample_workflow),
                workflow_graph_cache.get_or_build(sample_workflow),
            )

            # Should only build once despite concurrent calls
            assert build_count == 1
            # All results should be the same graph
            assert results[0] is results[1] is results[2]
