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
	"messages_used_today" integer DEFAULT 0 NOT NULL,
	"last_message_at" timestamp with time zone,
	"last_message_reset_at" timestamp with time zone DEFAULT now(),
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
ALTER TABLE "instances" ADD CONSTRAINT "instances_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instances" ADD CONSTRAINT "instances_created_by_device_id_devices_id_fk" FOREIGN KEY ("created_by_device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_device_token" ON "devices" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_device_expires" ON "devices" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_instance_org" ON "instances" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_instance_device" ON "instances" USING btree ("created_by_device_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_instance_provider" ON "instances" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "idx_instance_orphan_virgin" ON "instances" USING btree ("organization_id","whatsapp_jid","created_at");--> statement-breakpoint
CREATE INDEX "idx_org_owner" ON "organizations" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_org_slug" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_external" ON "users" USING btree ("external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_email" ON "users" USING btree ("email");