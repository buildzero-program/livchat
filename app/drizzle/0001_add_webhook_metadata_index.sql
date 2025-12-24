-- Migration: Add index for webhook logs query optimization
-- This index enables efficient SQL filtering on metadata->>'webhookId'
-- instead of fetching all events and filtering in JavaScript memory

-- Index for webhookId lookups in metadata JSONB
CREATE INDEX IF NOT EXISTS idx_events_metadata_webhook_id
ON events ((metadata->>'webhookId'));
--> statement-breakpoint

-- Partial index for webhook logs query pattern (webhookId + name + created_at)
-- Only indexes rows where webhookId exists (saves space)
CREATE INDEX IF NOT EXISTS idx_events_webhook_logs
ON events ((metadata->>'webhookId'), name, created_at DESC)
WHERE metadata->>'webhookId' IS NOT NULL;
