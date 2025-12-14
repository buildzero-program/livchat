-- Migration: Add workflows and threads tables
-- Feature: AST Integration for Ivy and future workflows
-- Plan: Plan-11 - AST Workflows System
-- Date: 2024-12-14

-- Workflows table (references to AST workflows)
CREATE TABLE IF NOT EXISTS "workflows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid REFERENCES "organizations"("id") ON DELETE CASCADE,
  "provider_id" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_workflows_org" ON "workflows" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_workflows_provider" ON "workflows" ("provider_id");

-- Threads table (conversation sessions)
CREATE TABLE IF NOT EXISTS "threads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workflow_id" uuid NOT NULL REFERENCES "workflows"("id") ON DELETE CASCADE,
  "organization_id" uuid REFERENCES "organizations"("id") ON DELETE CASCADE,
  "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "device_id" uuid REFERENCES "devices"("id") ON DELETE SET NULL,
  "provider_thread_id" text NOT NULL,
  "title" text,
  "message_count" integer NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'active',
  "last_message_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_threads_workflow" ON "threads" ("workflow_id");
CREATE INDEX IF NOT EXISTS "idx_threads_user" ON "threads" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_threads_device" ON "threads" ("device_id");
CREATE INDEX IF NOT EXISTS "idx_threads_status" ON "threads" ("status");
CREATE INDEX IF NOT EXISTS "idx_threads_provider" ON "threads" ("provider_thread_id");
