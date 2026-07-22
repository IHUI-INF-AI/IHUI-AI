CREATE TABLE "resource_github_projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"url" varchar(500) NOT NULL,
	"stars" integer,
	"category" varchar(100),
	"description" text,
	"language" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_world_rankings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"leaderboard" varchar(50) NOT NULL,
	"category" varchar(50) NOT NULL,
	"rank" integer NOT NULL,
	"model_name" varchar(200) NOT NULL,
	"provider" varchar(100),
	"score" varchar(100),
	"scores" jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"published_at" timestamp with time zone,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_ai_world_rankings_lb_cat_model" UNIQUE("leaderboard","category","model_name")
);
--> statement-breakpoint
CREATE TABLE "t_clazz" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"school_id" bigserial NOT NULL,
	"grade_id" bigserial NOT NULL,
	"name" varchar(200) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "t_grade" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "t_school" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"logo" varchar(512),
	"address" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "t_subject" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "t_knowledge_point" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"parent_id" bigserial DEFAULT 0 NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "t_course_recommend" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"course_id" bigserial NOT NULL,
	"member_id" bigserial NOT NULL,
	"reason" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "t_course_recommend_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"recommend_id" bigserial NOT NULL,
	"action" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_memory_episodic" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar(64) NOT NULL,
	"user_id" uuid NOT NULL,
	"content" text NOT NULL,
	"summary" varchar(500),
	"importance_score" numeric DEFAULT '0.5' NOT NULL,
	"decay_factor" numeric DEFAULT '1.0' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"last_accessed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "agent_memory_procedural" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"pattern" text NOT NULL,
	"tool_name" varchar(100) DEFAULT '' NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"importance_score" numeric DEFAULT '0.5' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_memory_semantic" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(1536),
	"importance_score" numeric DEFAULT '0.5' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_accessed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "commission_flows" DROP CONSTRAINT "commission_flows_beneficiary_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "withdrawal_flows" DROP CONSTRAINT "withdrawal_flows_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_logs" ALTER COLUMN "details" SET DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "search_history" ALTER COLUMN "filters" SET DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "chat_conversations" ALTER COLUMN "metadata" SET DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "chat_messages" ALTER COLUMN "metadata" SET DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "workflow_instances" ALTER COLUMN "context" SET DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "workflows" ALTER COLUMN "trigger_config" SET DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "workflows" ALTER COLUMN "steps" SET DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "workflows" ALTER COLUMN "steps" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "integration_configs" ALTER COLUMN "config" SET DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "oss_drivers" ALTER COLUMN "config" SET DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "certificate_templates" ALTER COLUMN "template_config" SET DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "commission_flows" ALTER COLUMN "beneficiary_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "withdrawal_flows" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_vendor_configs" ALTER COLUMN "config_json" SET DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "analytics_events" ALTER COLUMN "properties" SET DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "llm_call_logs" ALTER COLUMN "metadata" SET DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "commission_flows" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "commission_flows" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "withdrawal_flows" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "oauth_apps" ADD COLUMN "client_secret_hash" text;--> statement-breakpoint
ALTER TABLE "ai_world_items" ADD COLUMN "trending_score" integer;--> statement-breakpoint
ALTER TABLE "ai_world_items" ADD COLUMN "trending_metrics" jsonb;--> statement-breakpoint
ALTER TABLE "ai_world_items" ADD COLUMN "trending_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "agent_tasks" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "oauth_private_keys" ADD COLUMN "encryption_key_id" varchar(256);--> statement-breakpoint
ALTER TABLE "t_clazz" ADD CONSTRAINT "t_clazz_school_id_t_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."t_school"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "t_clazz" ADD CONSTRAINT "t_clazz_grade_id_t_grade_id_fk" FOREIGN KEY ("grade_id") REFERENCES "public"."t_grade"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "t_course_recommend_log" ADD CONSTRAINT "t_course_recommend_log_recommend_id_t_course_recommend_id_fk" FOREIGN KEY ("recommend_id") REFERENCES "public"."t_course_recommend"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_memory_episodic" ADD CONSTRAINT "agent_memory_episodic_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_memory_procedural" ADD CONSTRAINT "agent_memory_procedural_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_memory_semantic" ADD CONSTRAINT "agent_memory_semantic_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "resource_github_projects_category_idx" ON "resource_github_projects" USING btree ("category");--> statement-breakpoint
CREATE INDEX "ix_ai_world_rankings_leaderboard" ON "ai_world_rankings" USING btree ("leaderboard");--> statement-breakpoint
CREATE INDEX "ix_ai_world_rankings_category" ON "ai_world_rankings" USING btree ("category");--> statement-breakpoint
CREATE INDEX "ix_ai_world_rankings_rank" ON "ai_world_rankings" USING btree ("rank");--> statement-breakpoint
CREATE INDEX "t_clazz_school_idx" ON "t_clazz" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "t_clazz_grade_idx" ON "t_clazz" USING btree ("grade_id");--> statement-breakpoint
CREATE INDEX "t_knowledge_point_parent_idx" ON "t_knowledge_point" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "t_course_recommend_course_idx" ON "t_course_recommend" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "t_course_recommend_member_idx" ON "t_course_recommend" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "t_course_recommend_log_recommend_idx" ON "t_course_recommend_log" USING btree ("recommend_id");--> statement-breakpoint
CREATE INDEX "ix_agent_memory_episodic_user" ON "agent_memory_episodic" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ix_agent_memory_episodic_session" ON "agent_memory_episodic" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "ix_agent_memory_episodic_importance" ON "agent_memory_episodic" USING btree ("importance_score");--> statement-breakpoint
CREATE INDEX "ix_agent_memory_procedural_user" ON "agent_memory_procedural" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ix_agent_memory_procedural_tool" ON "agent_memory_procedural" USING btree ("tool_name");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_agent_memory_procedural_user_pattern_tool" ON "agent_memory_procedural" USING btree ("user_id","pattern","tool_name");--> statement-breakpoint
CREATE INDEX "ix_agent_memory_semantic_user" ON "agent_memory_semantic" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ix_agent_memory_semantic_importance" ON "agent_memory_semantic" USING btree ("importance_score");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_flows" ADD CONSTRAINT "commission_flows_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_flows" ADD CONSTRAINT "commission_flows_beneficiary_id_users_id_fk" FOREIGN KEY ("beneficiary_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawal_flows" ADD CONSTRAINT "withdrawal_flows_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawal_flows" ADD CONSTRAINT "withdrawal_flows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_agent_id_agents_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("agent_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_rule_id_agent_rule_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."agent_rule"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "token_flows_order_op_unique_idx" ON "token_flows" USING btree ("related_order_no","op_type");--> statement-breakpoint
CREATE INDEX "ix_ai_world_items_trending_score" ON "ai_world_items" USING btree ("trending_score");