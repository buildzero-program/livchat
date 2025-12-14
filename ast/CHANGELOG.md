# Changelog

All notable changes to this fork of agent-service-toolkit for LivChat.

## 2025-12-14

### Added
- XAI/Grok provider support with Live Search (web, X/Twitter, news)
  - Grok 3: grok-3-beta, grok-3-mini-beta, grok-3-latest
  - Grok 4: grok-4, grok-4-fast-non-reasoning, grok-4-fast-reasoning
  - Grok 4.1: grok-4-1-fast-non-reasoning, grok-4-1-fast-reasoning
  - Auto search mode with citations
- Neon DB integration with dev/prod branches
  - Dev: `ep-long-mouse-acie9nar-pooler.sa-east-1.aws.neon.tech`
  - Prod: `ep-soft-pine-acc7zl9c-pooler.sa-east-1.aws.neon.tech`
- LangSmith project configuration (livchat-dev / livchat)

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
