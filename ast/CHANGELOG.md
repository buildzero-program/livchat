# Changelog

All notable changes to this fork of agent-service-toolkit for LivChat.

## 2024-12-14

### Changed
- Port changed from 8080 to 9000 (avoid conflict with wuzapi)
- Healthcheck updated to use Python instead of curl
- Removed local postgres service (using Neon DB)
- Updated streamlit AGENT_URL to use port 9000

### Added
- Neon DB integration with dev/prod branches
  - Dev: `ep-long-mouse-acie9nar-pooler.sa-east-1.aws.neon.tech`
  - Prod: `ep-soft-pine-acc7zl9c-pooler.sa-east-1.aws.neon.tech`
- LangSmith project configuration (livchat-dev / livchat)

### Configuration
- `DATABASE_TYPE=postgres`
- `PORT=9000`
- `MODE=dev`

---

## Upstream

Based on [JoshuaC215/agent-service-toolkit](https://github.com/JoshuaC215/agent-service-toolkit)

See upstream [README](./README.md) for original documentation.
