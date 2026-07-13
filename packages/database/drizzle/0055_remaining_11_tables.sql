-- Migration 0055: 补齐剩余 11 张缺失表
-- 创建时间: 2026-07-13

-- 1. AI 用户模型聊天配置
CREATE TABLE IF NOT EXISTS "zhs_ai_user_model_chat_config" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar(64) NOT NULL,
  "name" varchar(64) NOT NULL,
  "vendor" varchar(20) NOT NULL,
  "model_id" varchar(128) NOT NULL,
  "base_url" varchar(500),
  "api_key" varchar(256) NOT NULL,
  "temperature" real,
  "max_tokens" integer,
  "enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "zhs_ai_user_model_chat_config_user_idx" ON "zhs_ai_user_model_chat_config" ("user_id");

-- 2. AI 用户模型聊天历史
CREATE TABLE IF NOT EXISTS "zhs_ai_user_model_chat_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar(64) NOT NULL,
  "config_id" uuid NOT NULL,
  "model" varchar(128) NOT NULL,
  "content" text NOT NULL,
  "prompt_tokens" integer NOT NULL DEFAULT 0,
  "completion_tokens" integer NOT NULL DEFAULT 0,
  "total_tokens" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "zhs_ai_user_model_chat_history_user_idx" ON "zhs_ai_user_model_chat_history" ("user_id");
CREATE INDEX IF NOT EXISTS "zhs_ai_user_model_chat_history_config_idx" ON "zhs_ai_user_model_chat_history" ("config_id");

-- 3. 实名认证
CREATE TABLE IF NOT EXISTS "auth_identities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "real_name" varchar(50) NOT NULL,
  "id_card" varchar(20) NOT NULL,
  "id_card_front" varchar(500),
  "id_card_back" varchar(500),
  "phone" varchar(20),
  "status" integer NOT NULL DEFAULT 0,
  "audit_user" varchar(64),
  "audit_time" timestamptz,
  "audit_remark" varchar(500),
  "expire_time" timestamptz,
  "type" integer NOT NULL DEFAULT 1,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- 4. 需求广场
CREATE TABLE IF NOT EXISTS "zhs_demand_square" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar(64) NOT NULL,
  "type" varchar(20) NOT NULL,
  "title" varchar(255) NOT NULL,
  "description" text,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "reject_reason" varchar(500),
  "reviewed_by" varchar(64),
  "reviewed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "zhs_demand_square_status_idx" ON "zhs_demand_square" ("status");
CREATE INDEX IF NOT EXISTS "zhs_demand_square_type_idx" ON "zhs_demand_square" ("type");

-- 5. 教育平台
CREATE TABLE IF NOT EXISTS "education_platform" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar(100) NOT NULL,
  "code" varchar(50) NOT NULL,
  "type" varchar(20) DEFAULT 'mooc',
  "api_url" varchar(500),
  "api_key" varchar(200),
  "api_secret" varchar(200),
  "config" text,
  "sync_url" varchar(500),
  "last_sync_time" timestamptz,
  "status" integer DEFAULT 1,
  "description" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "education_platform_code_unique" ON "education_platform" ("code");

-- 6. 教育平台同步日志
CREATE TABLE IF NOT EXISTS "education_sync_log" (
  "id" serial PRIMARY KEY NOT NULL,
  "platform_code" varchar(50) NOT NULL,
  "type" varchar(20) DEFAULT 'course',
  "sync_type" varchar(20) DEFAULT 'pull',
  "success" boolean DEFAULT false,
  "request" text,
  "response" text,
  "error_msg" varchar(500),
  "record_count" integer DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- 7. FAQ 分类
CREATE TABLE IF NOT EXISTS "zhs_faq_category" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(64) NOT NULL,
  "slug" varchar(64) NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "zhs_faq_category_slug_unique" ON "zhs_faq_category" ("slug");

-- 8. FAQ
CREATE TABLE IF NOT EXISTS "zhs_faq" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "category_id" uuid NOT NULL,
  "question" varchar(200) NOT NULL,
  "answer" text NOT NULL,
  "keywords" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "pinned" boolean NOT NULL DEFAULT false,
  "published" boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "zhs_faq_category_id_idx" ON "zhs_faq" ("category_id");
CREATE INDEX IF NOT EXISTS "zhs_faq_pinned_idx" ON "zhs_faq" ("pinned");

-- 9. 考试报名
CREATE TABLE IF NOT EXISTS "exam_sign_up" (
  "id" serial PRIMARY KEY NOT NULL,
  "member_id" integer NOT NULL,
  "exam_id" integer NOT NULL,
  "status" varchar(50) NOT NULL,
  "completed_time" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_esu_member" ON "exam_sign_up" ("member_id");
CREATE INDEX IF NOT EXISTS "idx_esu_exam" ON "exam_sign_up" ("exam_id");
CREATE INDEX IF NOT EXISTS "idx_esu_status" ON "exam_sign_up" ("status");

-- 10. 私信
CREATE TABLE IF NOT EXISTS "message_private_letter" (
  "id" serial PRIMARY KEY NOT NULL,
  "sender_id" varchar(100) NOT NULL,
  "receiver_id" varchar(100) NOT NULL,
  "content" text NOT NULL,
  "read_time" timestamptz,
  "is_read" boolean NOT NULL DEFAULT false,
  "status" varchar(30) NOT NULL DEFAULT 'normal',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_mpl_sender" ON "message_private_letter" ("sender_id");
CREATE INDEX IF NOT EXISTS "idx_mpl_receiver" ON "message_private_letter" ("receiver_id");

-- 11. 区域
CREATE TABLE IF NOT EXISTS "zhs_zone" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(64) NOT NULL,
  "code" varchar(32) NOT NULL,
  "parent_id" uuid,
  "level" integer NOT NULL DEFAULT 0,
  "sort_order" integer NOT NULL DEFAULT 0,
  "enabled" boolean NOT NULL DEFAULT true,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "zhs_zone_code_unique" ON "zhs_zone" ("code");
CREATE INDEX IF NOT EXISTS "zhs_zone_parent_idx" ON "zhs_zone" ("parent_id");
CREATE INDEX IF NOT EXISTS "zhs_zone_level_idx" ON "zhs_zone" ("level");
