CREATE TYPE "public"."plugin_event_type" AS ENUM('click', 'install', 'uninstall', 'pin', 'unpin');--> statement-breakpoint
CREATE TABLE "plugin_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plugin_id" varchar(100) NOT NULL,
	"event_type" "plugin_event_type" NOT NULL,
	"user_id" uuid,
	"ip" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plugin_events" ADD CONSTRAINT "plugin_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plugin_events_plugin_type_date_idx" ON "plugin_events" USING btree ("plugin_id","event_type","created_at");--> statement-breakpoint
CREATE INDEX "plugin_events_type_date_idx" ON "plugin_events" USING btree ("event_type","created_at");--> statement-breakpoint
CREATE INDEX "plugin_events_date_idx" ON "plugin_events" USING btree ("created_at");