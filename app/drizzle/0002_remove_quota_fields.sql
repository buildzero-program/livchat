-- Migration: Remove obsolete quota fields from instances table
-- Reason: Message quota is now tracked in Redis (Upstash)
-- See: Plan-06 - Redis-based quota system
-- Date: 2024-12-10

-- Drop columns that were used for lazy reset daily quota
-- These are now tracked in Redis with TTL-based auto-expiry
ALTER TABLE "instances" DROP COLUMN IF EXISTS "messages_used_today";
ALTER TABLE "instances" DROP COLUMN IF EXISTS "last_message_reset_at";
