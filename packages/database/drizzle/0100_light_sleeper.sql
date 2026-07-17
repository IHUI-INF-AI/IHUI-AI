CREATE TABLE "tbox_agent_channel" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" varchar(64) NOT NULL,
	"agent_id" varchar(100) NOT NULL,
	"action" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"payload" jsonb,
	"result" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ix_tbox_agent_channel_device_id" ON "tbox_agent_channel" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "ix_tbox_agent_channel_agent_id" ON "tbox_agent_channel" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "ix_tbox_agent_channel_status" ON "tbox_agent_channel" USING btree ("status");