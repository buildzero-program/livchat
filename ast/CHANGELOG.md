# Changelog

All notable changes to this fork of agent-service-toolkit for LivChat.

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
