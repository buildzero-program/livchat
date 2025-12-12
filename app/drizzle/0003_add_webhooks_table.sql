-- Migration: Add webhooks table
-- Feature: User-configured webhook endpoints
-- Plan: Plan-08 - Webhooks do Usuário
-- Date: 2024-12-12

-- Create webhooks table
CREATE TABLE IF NOT EXISTS "webhooks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" text NOT NULL DEFAULT 'Webhook',
  "url" text NOT NULL,
  "signing_secret" text,
  "headers" jsonb,
  "instance_ids" uuid[],
  "subscriptions" text[],
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "idx_webhooks_org_active" ON "webhooks" ("organization_id", "is_active");
CREATE INDEX IF NOT EXISTS "idx_webhooks_org" ON "webhooks" ("organization_id");
