-- Phase 5/6 new tables: user preferences, knowledge, skills, likes, security logs, export tasks, content generation, mcp, openclaw, site categories, analytics, funds, ai feed, ai world, workspace ai, ai modules, developer, coze chat, agent reviews

-- ============================================================
-- user_preferences
-- ============================================================
CREATE TABLE IF NOT EXISTS "user_preferences" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "group" varchar(50) NOT NULL,
  "key" varchar(100) NOT NULL,
  "value" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_preferences_user_group_key_unique" ON "user_preferences" ("user_id", "group", "key");

-- ============================================================
-- knowledge_base
-- ============================================================
CREATE TABLE IF NOT EXISTS "knowledge_base" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "title" varchar(200) NOT NULL,
  "summary" text,
  "content" text,
  "cover_image" varchar(500),
  "category_id" uuid,
  "author_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "view_count" integer DEFAULT 0 NOT NULL,
  "like_count" integer DEFAULT 0 NOT NULL,
  "is_published" boolean DEFAULT false NOT NULL,
  "status" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "knowledge_base_category_idx" ON "knowledge_base" ("category_id");
CREATE INDEX IF NOT EXISTS "knowledge_base_author_idx" ON "knowledge_base" ("author_id");

-- ============================================================
-- skills
-- ============================================================
CREATE TABLE IF NOT EXISTS "skills" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "name" varchar(100) NOT NULL,
  "description" text,
  "icon" varchar(500),
  "category_id" uuid,
  "difficulty" integer DEFAULT 1 NOT NULL,
  "content" text,
  "author_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "is_published" boolean DEFAULT false NOT NULL,
  "status" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- ============================================================
-- resource_likes
-- ============================================================
CREATE TABLE IF NOT EXISTS "resource_likes" (
  "id" serial PRIMARY KEY,
  "resource_type" varchar(50) NOT NULL,
  "resource_id" varchar(100) NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "resource_likes_unique" ON "resource_likes" ("resource_type", "resource_id", "user_id");
CREATE INDEX IF NOT EXISTS "resource_likes_user_id_idx" ON "resource_likes" ("user_id");

-- ============================================================
-- security_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS "security_logs" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "action" varchar(100) NOT NULL,
  "ip" varchar(45),
  "user_agent" text,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "security_logs_user_idx" ON "security_logs" ("user_id");

-- ============================================================
-- export_tasks
-- ============================================================
CREATE TABLE IF NOT EXISTS "export_tasks" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "type" varchar(50) NOT NULL,
  "status" integer DEFAULT 0 NOT NULL,
  "file_url" varchar(500),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "export_tasks_user_idx" ON "export_tasks" ("user_id");

-- ============================================================
-- content_generation_tasks
-- ============================================================
CREATE TABLE IF NOT EXISTS "content_generation_tasks" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "template_id" uuid,
  "input" text,
  "output" text,
  "status" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "content_generation_tasks_user_idx" ON "content_generation_tasks" ("user_id");

-- ============================================================
-- content_generation_templates
-- ============================================================
CREATE TABLE IF NOT EXISTS "content_generation_templates" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "name" varchar(100) NOT NULL,
  "description" text,
  "prompt" text,
  "category" varchar(50),
  "status" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- ============================================================
-- mcp_servers
-- ============================================================
CREATE TABLE IF NOT EXISTS "mcp_servers" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "name" varchar(100) NOT NULL,
  "description" text,
  "endpoint" varchar(500) NOT NULL,
  "status" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- ============================================================
-- openclaw_items
-- ============================================================
CREATE TABLE IF NOT EXISTS "openclaw_items" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "title" varchar(200) NOT NULL,
  "content" text,
  "cover_image" varchar(500),
  "author_id" uuid,
  "view_count" integer DEFAULT 0 NOT NULL,
  "status" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "openclaw_items_author_idx" ON "openclaw_items" ("author_id");

-- ============================================================
-- site_categories
-- ============================================================
CREATE TABLE IF NOT EXISTS "site_categories" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "name" varchar(100) NOT NULL,
  "type" varchar(50) NOT NULL,
  "icon" varchar(500),
  "sort" integer DEFAULT 0 NOT NULL,
  "status" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- ============================================================
-- analytics_events
-- ============================================================
CREATE TABLE IF NOT EXISTS "analytics_events" (
  "id" serial PRIMARY KEY,
  "user_id" uuid,
  "event" varchar(100) NOT NULL,
  "properties" jsonb,
  "ip" varchar(45),
  "user_agent" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "analytics_events_user_idx" ON "analytics_events" ("user_id");

-- ============================================================
-- funds
-- ============================================================
CREATE TABLE IF NOT EXISTS "funds" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "code" varchar(50) NOT NULL,
  "name" varchar(100) NOT NULL,
  "type" varchar(50),
  "status" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_funds_code" ON "funds" ("code");

-- ============================================================
-- fund_net_values
-- ============================================================
CREATE TABLE IF NOT EXISTS "fund_net_values" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "fund_id" uuid NOT NULL REFERENCES "funds"("id") ON DELETE cascade,
  "date" date NOT NULL,
  "value" numeric(10, 4),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ix_fund_net_values_fund" ON "fund_net_values" ("fund_id");

-- ============================================================
-- ai_feed_posts
-- ============================================================
CREATE TABLE IF NOT EXISTS "ai_feed_posts" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "title" varchar(200) NOT NULL,
  "content" text,
  "cover_image" varchar(500),
  "author_id" uuid,
  "view_count" integer DEFAULT 0 NOT NULL,
  "like_count" integer DEFAULT 0 NOT NULL,
  "is_published" boolean DEFAULT false NOT NULL,
  "status" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ix_ai_feed_posts_published" ON "ai_feed_posts" ("is_published");

-- ============================================================
-- ai_world_categories
-- ============================================================
CREATE TABLE IF NOT EXISTS "ai_world_categories" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "name" varchar(100) NOT NULL,
  "icon" varchar(500),
  "sort" integer DEFAULT 0 NOT NULL,
  "status" integer DEFAULT 1 NOT NULL
);

CREATE INDEX IF NOT EXISTS "ix_ai_world_categories_sort" ON "ai_world_categories" ("sort");

-- ============================================================
-- ai_world_items
-- ============================================================
CREATE TABLE IF NOT EXISTS "ai_world_items" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "category_id" uuid REFERENCES "ai_world_categories"("id") ON DELETE set null,
  "title" varchar(200) NOT NULL,
  "content" text,
  "cover_image" varchar(500),
  "author_id" uuid,
  "view_count" integer DEFAULT 0 NOT NULL,
  "status" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ix_ai_world_items_category" ON "ai_world_items" ("category_id");

-- ============================================================
-- workspace_ai_tasks
-- ============================================================
CREATE TABLE IF NOT EXISTS "workspace_ai_tasks" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "type" varchar(50) NOT NULL,
  "input" text,
  "output" text,
  "status" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "ix_workspace_ai_tasks_user" ON "workspace_ai_tasks" ("user_id");
CREATE INDEX IF NOT EXISTS "ix_workspace_ai_tasks_status" ON "workspace_ai_tasks" ("status");

-- ============================================================
-- ai_index_banners
-- ============================================================
CREATE TABLE IF NOT EXISTS "ai_index_banners" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "title" varchar(100),
  "image" varchar(500),
  "link" varchar(500),
  "sort" integer DEFAULT 0 NOT NULL,
  "status" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ix_ai_index_banners_status" ON "ai_index_banners" ("status");

-- ============================================================
-- ai_team_members
-- ============================================================
CREATE TABLE IF NOT EXISTS "ai_team_members" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "name" varchar(100) NOT NULL,
  "avatar" varchar(500),
  "description" text,
  "sort" integer DEFAULT 0 NOT NULL,
  "status" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ix_ai_team_members_status" ON "ai_team_members" ("status");

-- ============================================================
-- ai_conversations
-- ============================================================
CREATE TABLE IF NOT EXISTS "ai_conversations" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "title" varchar(200),
  "model_id" varchar(100),
  "last_message_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ix_ai_conversations_user" ON "ai_conversations" ("user_id");

-- ============================================================
-- ai_aigc_tasks
-- ============================================================
CREATE TABLE IF NOT EXISTS "ai_aigc_tasks" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "type" varchar(50) NOT NULL,
  "status" integer DEFAULT 0 NOT NULL,
  "input" text,
  "output" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "ix_ai_aigc_tasks_user" ON "ai_aigc_tasks" ("user_id");
CREATE INDEX IF NOT EXISTS "ix_ai_aigc_tasks_status" ON "ai_aigc_tasks" ("status");

-- ============================================================
-- ai_ext_capabilities
-- ============================================================
CREATE TABLE IF NOT EXISTS "ai_ext_capabilities" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "name" varchar(100) NOT NULL,
  "description" text,
  "enabled" boolean DEFAULT false NOT NULL,
  "config" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- ============================================================
-- ai_ext_reports
-- ============================================================
CREATE TABLE IF NOT EXISTS "ai_ext_reports" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "type" varchar(50) NOT NULL,
  "content" text,
  "status" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ix_ai_ext_reports_user" ON "ai_ext_reports" ("user_id");

-- ============================================================
-- ai_careers
-- ============================================================
CREATE TABLE IF NOT EXISTS "ai_careers" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "title" varchar(200) NOT NULL,
  "company" varchar(100),
  "description" text,
  "salary" varchar(50),
  "location" varchar(100),
  "sort" integer DEFAULT 0 NOT NULL,
  "status" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ix_ai_careers_status" ON "ai_careers" ("status");

-- ============================================================
-- ai_chat_types
-- ============================================================
CREATE TABLE IF NOT EXISTS "ai_chat_types" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "name" varchar(100) NOT NULL,
  "description" text,
  "icon" varchar(500),
  "sort" integer DEFAULT 0 NOT NULL,
  "status" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ix_ai_chat_types_status" ON "ai_chat_types" ("status");

-- ============================================================
-- ai_community_posts
-- ============================================================
CREATE TABLE IF NOT EXISTS "ai_community_posts" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "title" varchar(200) NOT NULL,
  "content" text,
  "likes" integer DEFAULT 0 NOT NULL,
  "views" integer DEFAULT 0 NOT NULL,
  "status" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ix_ai_community_posts_user" ON "ai_community_posts" ("user_id");
CREATE INDEX IF NOT EXISTS "ix_ai_community_posts_status" ON "ai_community_posts" ("status");

-- ============================================================
-- developer_applications
-- ============================================================
CREATE TABLE IF NOT EXISTS "developer_applications" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "name" varchar(100) NOT NULL,
  "description" text,
  "status" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ix_developer_applications_user" ON "developer_applications" ("user_id");
CREATE INDEX IF NOT EXISTS "ix_developer_applications_status" ON "developer_applications" ("status");

-- ============================================================
-- developer_pricing
-- ============================================================
CREATE TABLE IF NOT EXISTS "developer_pricing" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "name" varchar(100) NOT NULL,
  "price" numeric(10, 2) NOT NULL,
  "period" varchar(50),
  "features" jsonb NOT NULL DEFAULT '[]',
  "status" integer DEFAULT 1 NOT NULL,
  "sort" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ix_developer_pricing_status" ON "developer_pricing" ("status");

-- ============================================================
-- coze_chat_history
-- ============================================================
CREATE TABLE IF NOT EXISTS "coze_chat_history" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "bot_id" varchar(100) NOT NULL,
  "conversation_id" varchar(100) NOT NULL,
  "role" varchar(20) NOT NULL,
  "content" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ix_coze_chat_history_bot_conv" ON "coze_chat_history" ("bot_id", "conversation_id");

-- ============================================================
-- agent_reviews
-- ============================================================
CREATE TABLE IF NOT EXISTS "agent_reviews" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "agent_id" varchar(100) NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "rating" integer NOT NULL,
  "content" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "ix_agent_reviews_agent" ON "agent_reviews" ("agent_id");
CREATE INDEX IF NOT EXISTS "ix_agent_reviews_user" ON "agent_reviews" ("user_id");
