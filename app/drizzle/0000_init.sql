CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"created_by_device_id" uuid,
	"instance_id" uuid NOT NULL,
	"name" text DEFAULT 'Default' NOT NULL,
	"token" text NOT NULL,
	"scopes" text[] DEFAULT ARRAY['whatsapp:*']::text[] NOT NULL,
	"rate_limit_requests" integer DEFAULT 100 NOT NULL,
	"rate_limit_window_seconds" integer DEFAULT 60 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"claimed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"fingerprint" text,
	"ip_address" text NOT NULL,
	"user_agent" text,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "devices_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"organization_id" uuid,
	"instance_id" uuid,
	"api_key_id" uuid,
	"device_id" uuid,
	"value" integer DEFAULT 1 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"created_by_device_id" uuid,
	"name" text DEFAULT 'WhatsApp' NOT NULL,
	"provider_id" text NOT NULL,
	"provider_token" text NOT NULL,
	"provider_type" text DEFAULT 'wuzapi' NOT NULL,
	"whatsapp_jid" text,
	"whatsapp_name" text,
	"whatsapp_picture_url" text,
	"avatar_synced_at" timestamp with time zone,
	"status" text DEFAULT 'disconnected' NOT NULL,
	"last_connected_at" timestamp with time zone,
	"last_message_at" timestamp with time zone,
	"claimed_at" timestamp with time zone,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reuse_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text,
	"plan" text DEFAULT 'free' NOT NULL,
	"max_instances" integer DEFAULT 1 NOT NULL,
	"max_messages_per_day" integer DEFAULT 50 NOT NULL,
	"billing_customer_id" text,
	"billing_subscription_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"organization_id" uuid,
	"user_id" uuid,
	"device_id" uuid,
	"provider_thread_id" text NOT NULL,
	"title" text,
	"message_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"last_message_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text,
	"external_provider" text DEFAULT 'clerk',
	"email" text NOT NULL,
	"name" text,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_external_id_unique" UNIQUE("external_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text DEFAULT 'Webhook' NOT NULL,
	"url" text NOT NULL,
	"signing_secret" text,
	"headers" jsonb,
	"instance_ids" uuid[],
	"subscriptions" text[],
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"provider_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_device_id_devices_id_fk" FOREIGN KEY ("created_by_device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_instance_id_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_instance_id_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instances" ADD CONSTRAINT "instances_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instances" ADD CONSTRAINT "instances_created_by_device_id_devices_id_fk" FOREIGN KEY ("created_by_device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_api_key_org" ON "api_keys" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_api_key_device" ON "api_keys" USING btree ("created_by_device_id");--> statement-breakpoint
CREATE INDEX "idx_api_key_instance" ON "api_keys" USING btree ("instance_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_device_token" ON "devices" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_device_expires" ON "devices" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_events_org_name_created" ON "events" USING btree ("organization_id","name","created_at");--> statement-breakpoint
CREATE INDEX "idx_events_instance_created" ON "events" USING btree ("instance_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_events_name" ON "events" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_instance_org" ON "instances" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_instance_device" ON "instances" USING btree ("created_by_device_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_instance_provider" ON "instances" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "idx_instance_orphan_virgin" ON "instances" USING btree ("organization_id","whatsapp_jid","created_at");--> statement-breakpoint
CREATE INDEX "idx_org_owner" ON "organizations" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_org_slug" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_threads_workflow" ON "threads" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "idx_threads_user" ON "threads" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_threads_device" ON "threads" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "idx_threads_status" ON "threads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_threads_provider" ON "threads" USING btree ("provider_thread_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_external" ON "users" USING btree ("external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_webhooks_org_active" ON "webhooks" USING btree ("organization_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_webhooks_org" ON "webhooks" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_workflows_org" ON "workflows" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_workflows_provider" ON "workflows" USING btree ("provider_id");