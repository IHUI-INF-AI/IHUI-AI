-- clawdbot + agent_tasks: 4 张表(agent_tasks / clawdbot_bots / clawdbot_permissions / clawdbot_sessions)
-- 注:0095 已被 point_redeem_items/image_gen_favorites/notes/knowledge_base_categories 占用,本 migration 使用 0096。

CREATE TABLE IF NOT EXISTS "agent_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"rule_id" uuid,
	"name" varchar(200) NOT NULL,
	"description" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result" jsonb,
	"scheduled_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_tasks_agent_idx" ON "agent_tasks" ("agent_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_tasks_status_idx" ON "agent_tasks" ("status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clawdbot_bots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"avatar" varchar(500),
	"system_prompt" text,
	"model" varchar(100) DEFAULT 'gpt-4o-mini' NOT NULL,
	"temperature" varchar(10) DEFAULT '0.7',
	"max_tokens" integer DEFAULT 4096 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clawdbot_bots_active_idx" ON "clawdbot_bots" ("is_active");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clawdbot_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bot_id" uuid NOT NULL,
	"user_id" uuid,
	"role" varchar(50) DEFAULT 'user' NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clawdbot_permissions_bot_idx" ON "clawdbot_permissions" ("bot_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clawdbot_permissions_user_idx" ON "clawdbot_permissions" ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clawdbot_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bot_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(200),
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"last_message_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clawdbot_sessions_bot_idx" ON "clawdbot_sessions" ("bot_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clawdbot_sessions_user_idx" ON "clawdbot_sessions" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clawdbot_sessions_status_idx" ON "clawdbot_sessions" ("status");
--> statement-breakpoint
ALTER TABLE "clawdbot_permissions" ADD CONSTRAINT "clawdbot_permissions_bot_id_clawdbot_bots_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."clawdbot_bots"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "clawdbot_sessions" ADD CONSTRAINT "clawdbot_sessions_bot_id_clawdbot_bots_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."clawdbot_bots"("id") ON DELETE cascade ON UPDATE no action;
