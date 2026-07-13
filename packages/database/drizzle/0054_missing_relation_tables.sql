-- 0054_missing_relation_tables.sql
-- 补建 3 张历史缺失的关联/调度表
-- 来源: D 盘历史项目深度比对审计 (2026-07-12)

-- 1. 会员分组-成员关联表 (历史 t_member_group_member_relation)
CREATE TABLE IF NOT EXISTS "member_group_member_relations" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer NOT NULL,
	"group_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "member_group_member_relations_group_idx" ON "member_group_member_relations" ("group_id");
--> statement-breakpoint
ALTER TABLE "member_group_member_relations" ADD CONSTRAINT "member_group_member_relations_group_id_member_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "member_groups"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- 2. 资源-标签关联表 (历史 t_resource_tag_relation)
CREATE TABLE IF NOT EXISTS "resource_tag_relations" (
	"id" serial PRIMARY KEY NOT NULL,
	"resource_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "resource_tag_relations_resource_idx" ON "resource_tag_relations" ("resource_id");
--> statement-breakpoint
CREATE INDEX "resource_tag_relations_tag_idx" ON "resource_tag_relations" ("tag_id");
--> statement-breakpoint
ALTER TABLE "resource_tag_relations" ADD CONSTRAINT "resource_tag_relations_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "resource_tag_relations" ADD CONSTRAINT "resource_tag_relations_tag_id_resource_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "resource_tags"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- 3. 智能体购买定时任务表 (历史 agent_buy_scheduled_tasks)
-- 注: buy_id 软引用 zhs_agent_buy.id,不建物理外键(zhs_agent_buy 表可能在其他 migration 中创建)
CREATE TABLE IF NOT EXISTS "agent_buy_scheduled_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"buy_id" uuid NOT NULL,
	"task_type" varchar(32) DEFAULT 'expiry_check' NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"executed_at" timestamp with time zone,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"result" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "agent_buy_scheduled_buy_idx" ON "agent_buy_scheduled_tasks" ("buy_id");
--> statement-breakpoint
CREATE INDEX "agent_buy_scheduled_status_idx" ON "agent_buy_scheduled_tasks" ("status");
