ALTER TABLE "events" DROP CONSTRAINT "events_instance_id_instances_id_fk";
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_instance_id_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."instances"("id") ON DELETE set null ON UPDATE no action;