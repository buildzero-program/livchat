-- =============================================================================
-- LivChat - PostgreSQL Init Script
-- =============================================================================
-- Creates separate databases for each service to avoid schema conflicts
-- Note: livchat_app is already created by POSTGRES_DB env var
-- =============================================================================

-- Database for AST (LangGraph checkpoints)
CREATE DATABASE livchat_ast;

-- Database for WuzAPI (WhatsApp sessions)
CREATE DATABASE livchat_wuzapi;

-- Grant permissions (livchat_app already has permissions via POSTGRES_DB)
GRANT ALL PRIVILEGES ON DATABASE livchat_ast TO livchat;
GRANT ALL PRIVILEGES ON DATABASE livchat_wuzapi TO livchat;
