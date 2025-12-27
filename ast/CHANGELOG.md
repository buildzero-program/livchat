# Changelog

All notable changes to this fork of agent-service-toolkit for LivChat.

## 2025-12-26

### Added
- **Async-Safe Model Cache (Plan-23)** - Fix cold start latency from ~20s to ~3-4s
  - `src/core/llm.py` - New async-safe model caching system
    - `get_model_async()` - Async function with proper locking for concurrent access
    - `_MODEL_CACHE` - Global cache for model instances
    - `_MODEL_CACHE_LOCK` - asyncio.Lock for thread-safe initialization
    - `clear_model_cache()` - Clear cached models
    - `get_model_cache_stats()` - Get cache statistics
    - `_create_model_sync()` - Extracted sync model creation logic
  - **Tests** - 9 new tests for async model caching in `tests/core/test_llm_async.py`

### Changed
- **workflow_agent.py** - Now uses `get_model_async()` for proper async caching
  - Prevents blocking I/O during authentication (documented LangChain issue)
  - Concurrent requests now share cached model instances safely
- **Dependencies** - Updated for better performance
  - `langchain-google-genai >=3.0.0` → `>=4.1.0` (new consolidated SDK)
  - Added `google-genai[aiohttp]` for async HTTP performance

### Fixed
- **Cold Start Latency** - First request latency reduced from ~20s to ~3-4s
  - Root cause: `functools.cache` not thread-safe for async + blocking I/O in auth
  - Solution: Global cache with asyncio.Lock + proper concurrent initialization
- **Stream Response Format** - Fixed `[object Object]` display in Ivy chat
  - Root cause: `langchain-google-genai` v4.x changed `chunk.content` from string to array
  - Solution: Use `convert_message_content_to_string()` in `workflow_router.py`
- **compose.yaml** - Fixed healthcheck endpoint from `/info` (requires auth) to `/health` (public)

### Technical Notes
- `functools.cache` decorator is not suitable for async contexts - replaced with manual cache
- LangChain docs recommend initializing ChatGoogleGenerativeAI in global scope to avoid blocking I/O
- See: https://support.langchain.com/articles/8574277609

## 2025-12-24

### Added
- **Workflow Nodes Infrastructure (Plan-22 Phase 1)** - StateGraph-based multi-node workflow execution
  - `src/nodes/` - New module for workflow node implementations
    - `base.py` - Abstract `BaseNode` class for all workflow nodes
    - `registry.py` - `NodeRegistry` singleton with decorator-based registration
    - `executor.py` - `build_workflow_graph()` function to compile StateGraph from workflow config
  - **Trigger Nodes** (`src/nodes/triggers/`)
    - `ManualTriggerNode` - Entry point for manual/HTTP invocations
    - `WhatsAppConnectionTriggerNode` - Handles WA connection events (creates SystemMessage)
    - `WhatsAppMessageTriggerNode` - Handles incoming WA messages (creates HumanMessage)
  - **Action Nodes** (`src/nodes/actions/`)
    - `AgentNode` - LLM invocation with prompt template, message trimming, model config
  - **Tests** - 32 new tests for nodes infrastructure

- **Workflow Graph Cache (Plan-22 Phase 2.1)** - Performance optimization
  - `src/nodes/graph_cache.py` - Singleton cache for compiled StateGraphs
    - Avoids recompiling graphs on every request
    - Cache key: `{workflow_id}:{md5(flowData)[:12]}`
    - Automatic invalidation on workflow update/delete
    - Configured at startup with checkpointer and store
  - **Tests** - 21 tests for cache behavior, concurrency, invalidation

- **Router Node (Plan-22 Phase 2.2)** - Conditional routing
  - `src/nodes/logic/router_node.py` - Routes based on state expression
    - Uses LangGraph `Command(goto="node_id")` pattern
    - Supports dot notation for nested field access
    - Configurable outputs and default fallback
  - **Tests** - 18 tests for routing logic, expression evaluation

- **End Node (Plan-22 Phase 2.3)** - Terminal node
  - `src/nodes/terminal/end_node.py` - Pass-through terminal node
    - Marks workflow completion visually
    - Optional label for logging/debugging
  - **Tests** - 9 tests for end node behavior

### Changed
- **workflow_router.py** - Now uses cached graphs via `workflow_graph_cache`
  - `invoke_workflow` and `stream_workflow` use `get_or_build()` for cache hits
  - Cache invalidation on `update_workflow` and `delete_workflow`
  - Better error handling for invalid workflows (400 for missing trigger)
- **workflow_schema.py** - `WorkflowNode.config` is now `dict[str, Any]` (flexible for different node types)
  - Supports trigger nodes with empty config, agent nodes with prompt/llm config
- **seeds/__init__.py** - Ivy workflow now has proper structure:
  - `manual_trigger` node as entry point
  - `agent` node connected via edge
  - Flow: `trigger-1 → agent-1 → END`
- **service.py** - Graph cache configured at lifespan startup
  - `workflow_graph_cache.configure(checkpointer, store)` called after store setup
- **executor.py** - Router edge handling
  - Skips edges from router nodes (they use Command pattern)
  - Imports logic and terminal node modules for registration

### Technical Notes
- Lazy import pattern in `AgentNode` to avoid circular imports with `agents.workflow_agent`
- Removed `tests/nodes/__init__.py` to fix package shadowing (pytest discovers tests by naming convention)
- Updated all workflow schema tests to use new trigger+agent node structure
- Graph cache uses per-key `asyncio.Lock` for concurrent builds of different workflows

## 2025-12-21

### Added
- **Auto-seed on startup** - Runs essential seeds automatically on container start
  - `src/seeds/__init__.py` - Seed module with `run_seeds()` function
  - Creates `wf_ivy` workflow if not exists (idempotent)
  - Called from FastAPI lifespan after `store.setup()`
  - Similar to WuzAPI's `initializeSchema()` and App's `db-setup.ts`
- Updated `docker/Dockerfile.service` to include seeds module

### Changed
- Updated `scripts/seed_ivy.py` to match production data structure
  - `isActive` instead of `is_active` (camelCase)
  - Added `position`, `name`, `tools` fields to workflow nodes
  - Default model: `gemini-3-flash-preview`

## 2025-12-18

### Added
- **Model Registry (Plan-14)** - Dynamic LLM model discovery system
  - `src/schema/model_info.py` - Schema for model metadata (10 tests)
  - `src/core/model_registry.py` - Singleton registry with cache (27 tests)
    - Dynamic discovery via native SDKs (OpenAI, Anthropic, Google, Groq)
    - In-memory cache with 24h TTL
    - Fallback to static list when APIs fail
    - Thread-safe async operations
  - `src/service/model_router.py` - REST endpoints for models (13 tests)
    - `GET /models` - List all models (filter by provider)
    - `GET /models/providers` - List configured providers
    - `GET /models/info/{id}` - Get model details
    - `POST /models/validate` - Validate model list
    - `POST /models/refresh` - Force cache refresh
  - Workflow model validation - HTTP 400 on invalid models
    - Added `validate_workflow_models()` async function
    - Integrated in create/update workflow endpoints
  - Registry initialization in service lifespan
- **Plan-15 Planning** - Multimodal file support architecture documented
  - Support for images, PDFs, documents in workflows
  - File processing strategies (resize, tiling, PDF→images)
  - Integration with Gemini 3 Flash `media_resolution` parameter

### Fixed
- **Streamlit AUTH_SECRET** - Added `env_file: .env` to streamlit_app in compose.yaml
  - Fixes 401 Unauthorized when AUTH_SECRET is configured on agent_service

### Changed
- **get_model_from_name** refactored to async - Uses Model Registry for provider detection
- **Deprecated enums** - Hardcoded model enums moved to `_deprecated_models.py`

## 2025-12-14

### Added
- **Token Streaming (Phase 8.1)** - Real-time token streaming via PartyKit
  - Updated `workflow_stream_generator` to use `astream_events` for proper token streaming
  - Events: `on_chat_model_stream` for tokens, `on_chain_end` for completion
  - SSE format: `data: {"type": "token", "content": "..."}`
- **Workflow System (Plan-11)** - Infrastructure for dynamic AI workflows
  - `src/schema/workflow_schema.py` - Pydantic models for workflow validation (25 tests)
  - `src/workflows/storage.py` - PostgresStore CRUD operations (16 tests)
  - `src/workflows/template_processor.py` - Template variable substitution (52 tests)
    - `@current_datetime` with PT-BR formatting and variations (.iso, .date, .weekday, etc.)
    - `@model_name` and `@thread_id` runtime variables
    - Regex-based processing (no Jinja2 dependency)
  - `src/agents/workflow_agent.py` - Dynamic agent with workflow config loading (24 tests)
    - Loads workflow from PostgresStore by workflow_id
    - Processes template variables in system prompts
    - Token-based memory trimming (keeps recent messages)
    - Model name to enum mapping for all providers
  - `src/service/workflow_router.py` - FastAPI endpoints for workflows (17 tests)
    - CRUD: POST/GET/PATCH/DELETE /workflows
    - Execution: /workflows/{id}/invoke, /workflows/{id}/stream
    - SSE streaming support
    - Bearer token authentication
- XAI/Grok provider support with Live Search (web, X/Twitter, news)
  - Grok 3: grok-3-beta, grok-3-mini-beta, grok-3-latest
  - Grok 4: grok-4, grok-4-fast-non-reasoning, grok-4-fast-reasoning
  - Grok 4.1: grok-4-1-fast-non-reasoning, grok-4-1-fast-reasoning
  - Auto search mode with citations
- Neon DB integration with dev/prod branches
  - Dev: `ep-long-mouse-acie9nar-pooler.sa-east-1.aws.neon.tech`
  - Prod: `ep-soft-pine-acc7zl9c-pooler.sa-east-1.aws.neon.tech`
- LangSmith project configuration (livchat-dev / livchat)

### Fixed
- **Timezone in @current_datetime** - Now uses Brazil timezone (America/Sao_Paulo) instead of UTC
  - Added `ZoneInfo('America/Sao_Paulo')` to `template_processor.py`
  - Ivy now shows correct local time in chat responses

### Changed
- Port changed from 8080 to 9000 (avoid conflict with wuzapi)
- Healthcheck updated to use Python instead of curl
- Removed local postgres service (using Neon DB)
- Updated streamlit AGENT_URL to use port 9000
- Upgraded LangChain ecosystem to 1.1.x (langchain-core, langchain-openai, langchain-xai)

### Configuration
- `DATABASE_TYPE=postgres`
- `PORT=9000`
- `MODE=dev`
- `XAI_API_KEY` for Grok models

---

## Upstream

Based on [JoshuaC215/agent-service-toolkit](https://github.com/JoshuaC215/agent-service-toolkit)

See upstream [README](./README.md) for original documentation.
