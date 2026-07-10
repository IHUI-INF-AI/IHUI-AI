-- 0038: 补齐旧架构迁移缺失的 19 张表 (11 高严重 + 8 中严重)

-- ========== 支付回调相关 ==========

-- 支付回调原始记录
CREATE TABLE IF NOT EXISTS "payment_callbacks" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "order_id" varchar(64),
  "payment_method" varchar(32),
  "callback_type" varchar(32),
  "raw_data" text,
  "status" integer DEFAULT 0 NOT NULL,
  "amount" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "payment_callbacks_order_idx" ON "payment_callbacks" ("order_id");

-- 转账信息
CREATE TABLE IF NOT EXISTS "transfer_infos" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "transfer_no" varchar(64) NOT NULL,
  "from_user" varchar(64),
  "to_user" varchar(64),
  "amount" integer DEFAULT 0 NOT NULL,
  "status" integer DEFAULT 0 NOT NULL,
  "remark" varchar(255),
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "transfer_infos_transfer_no_unique" ON "transfer_infos" ("transfer_no");

-- 微信支付通知
CREATE TABLE IF NOT EXISTS "wx_pay_notifications" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "out_trade_no" varchar(64),
  "transaction_id" varchar(64),
  "openid" varchar(128),
  "trade_type" varchar(32),
  "bank_type" varchar(32),
  "total_fee" integer DEFAULT 0 NOT NULL,
  "cash_fee" integer DEFAULT 0 NOT NULL,
  "refund_no" varchar(64),
  "notification_type" varchar(32),
  "result_code" varchar(16),
  "raw_xml" text,
  "status" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "wx_pay_notifications_out_trade_no_idx" ON "wx_pay_notifications" ("out_trade_no");
CREATE INDEX IF NOT EXISTS "wx_pay_notifications_transaction_id_idx" ON "wx_pay_notifications" ("transaction_id");

-- ========== Agent 上下文相关 ==========

-- 用户 Agent 免费次数
CREATE TABLE IF NOT EXISTS "user_agent_free_times" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "user_uuid" varchar(64) NOT NULL,
  "agent_id" varchar(64) NOT NULL,
  "free_times" integer DEFAULT 0 NOT NULL,
  "used_times" integer DEFAULT 0 NOT NULL,
  "last_reset_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "user_agent_free_times_user_uuid_idx" ON "user_agent_free_times" ("user_uuid");
CREATE INDEX IF NOT EXISTS "user_agent_free_times_agent_id_idx" ON "user_agent_free_times" ("agent_id");

-- Agent 上下文 KV 存储
CREATE TABLE IF NOT EXISTS "zhs_user_agent_context" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "user_uuid" varchar(64) NOT NULL,
  "user_id" varchar(64),
  "agent_id" varchar(64) NOT NULL,
  "session_id" varchar(64),
  "role" varchar(20),
  "content" text,
  "content_type" varchar(20) DEFAULT 'text' NOT NULL,
  "tokens" integer DEFAULT 0 NOT NULL,
  "context_key" varchar(200),
  "context_value" text,
  "field_name" varchar(200),
  "create_time" timestamptz DEFAULT now() NOT NULL,
  "update_time" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "zhs_user_agent_context_user_uuid_idx" ON "zhs_user_agent_context" ("user_uuid");
CREATE INDEX IF NOT EXISTS "zhs_user_agent_context_user_id_idx" ON "zhs_user_agent_context" ("user_id");
CREATE INDEX IF NOT EXISTS "zhs_user_agent_context_agent_id_idx" ON "zhs_user_agent_context" ("agent_id");

-- Agent 音频
CREATE TABLE IF NOT EXISTS "zhs_user_agent_audio" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "user_uuid" varchar(64) NOT NULL,
  "agent_id" varchar(64) NOT NULL,
  "audio_url" varchar(500),
  "duration" integer,
  "create_time" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "zhs_user_agent_audio_user_uuid_idx" ON "zhs_user_agent_audio" ("user_uuid");
CREATE INDEX IF NOT EXISTS "zhs_user_agent_audio_agent_id_idx" ON "zhs_user_agent_audio" ("agent_id");

-- Agent 图像
CREATE TABLE IF NOT EXISTS "zhs_user_agent_image" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "user_uuid" varchar(64) NOT NULL,
  "user_id" varchar(64),
  "user_name" varchar(100),
  "agent_id" varchar(64),
  "agent_name" varchar(200),
  "image_url" varchar(500) NOT NULL,
  "image_type" varchar(20) DEFAULT 'input' NOT NULL,
  "prompt" text,
  "model" varchar(50),
  "task_id" varchar(100),
  "status" integer DEFAULT 1 NOT NULL,
  "cost" integer DEFAULT 0 NOT NULL,
  "width" integer,
  "height" integer,
  "size" integer,
  "create_time" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "zhs_user_agent_image_user_uuid_idx" ON "zhs_user_agent_image" ("user_uuid");
CREATE INDEX IF NOT EXISTS "zhs_user_agent_image_user_id_idx" ON "zhs_user_agent_image" ("user_id");
CREATE INDEX IF NOT EXISTS "zhs_user_agent_image_agent_id_idx" ON "zhs_user_agent_image" ("agent_id");

-- ========== 身份认证相关 ==========

-- 身份认证主表
CREATE TABLE IF NOT EXISTS "zhs_identity" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "identity_name" varchar(100) NOT NULL,
  "identity_type" varchar(50),
  "status" integer DEFAULT 1 NOT NULL,
  "create_time" timestamptz DEFAULT now() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ix_zhs_identity_status" ON "zhs_identity" ("status");

-- 组织机构
CREATE TABLE IF NOT EXISTS "zhs_organization" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "org_name" varchar(200) NOT NULL,
  "org_type" varchar(50),
  "parent_id" bigint DEFAULT 0 NOT NULL,
  "status" integer DEFAULT 1 NOT NULL,
  "create_time" timestamptz DEFAULT now() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ix_zhs_organization_parent_id" ON "zhs_organization" ("parent_id");
CREATE INDEX IF NOT EXISTS "ix_zhs_organization_status" ON "zhs_organization" ("status");

-- OAuth 私钥
CREATE TABLE IF NOT EXISTS "oauth_private_keys" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "app_id" varchar(64) NOT NULL,
  "key_type" varchar(32) DEFAULT 'rsa' NOT NULL,
  "key_data" text NOT NULL,
  "status" integer DEFAULT 1 NOT NULL,
  "create_time" timestamptz DEFAULT now() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ix_oauth_private_keys_status" ON "oauth_private_keys" ("status");

-- ========== AI 配置相关 ==========

-- AI 模型配置
CREATE TABLE IF NOT EXISTS "ai_model_config" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "name" varchar(100) NOT NULL,
  "provider_code" varchar(64) NOT NULL,
  "is_builtin" boolean DEFAULT false NOT NULL,
  "base_url" varchar(500) NOT NULL,
  "api_format" varchar(32) DEFAULT 'openai_chat' NOT NULL,
  "api_key_enc" text,
  "model_id_for_test" varchar(100),
  "enabled" boolean DEFAULT true NOT NULL,
  "description" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "owner_uuid" varchar(64),
  "last_test_status" varchar(16),
  "last_test_response_ms" integer,
  "last_tested_at" varchar(32),
  "last_test_error" text,
  "extra_config" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ix_ai_model_config_owner" ON "ai_model_config" ("owner_uuid");
CREATE INDEX IF NOT EXISTS "ix_ai_model_config_enabled" ON "ai_model_config" ("enabled");
CREATE INDEX IF NOT EXISTS "ix_ai_model_config_provider" ON "ai_model_config" ("provider_code");

-- 用户 API Key 信息
CREATE TABLE IF NOT EXISTS "user_sk_info" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_uuid" varchar(255),
  "key" varchar(255),
  "status" integer,
  "type" integer,
  "max" bigint,
  "out_time" timestamptz,
  "created_time" timestamptz DEFAULT now() NOT NULL,
  "updated_time" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ix_user_sk_info_status" ON "user_sk_info" ("status");
CREATE INDEX IF NOT EXISTS "user_sk_info_user_uuid_idx" ON "user_sk_info" ("user_uuid");

-- 视频生成任务队列
CREATE TABLE IF NOT EXISTS "video_generation_tasks" (
  "id" serial PRIMARY KEY NOT NULL,
  "task_id" varchar(36) NOT NULL,
  "user_uuid" varchar(255) NOT NULL,
  "chat_id" varchar(255),
  "status" varchar(50) DEFAULT 'accepted' NOT NULL,
  "message" varchar(512),
  "result" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ix_video_generation_tasks_status" ON "video_generation_tasks" ("status");
CREATE UNIQUE INDEX IF NOT EXISTS "video_generation_tasks_task_id_unique" ON "video_generation_tasks" ("task_id");
CREATE INDEX IF NOT EXISTS "video_generation_tasks_user_uuid_idx" ON "video_generation_tasks" ("user_uuid");

-- ========== Bot 站点相关 ==========

-- AI 工具站点
CREATE TABLE IF NOT EXISTS "aibot_sites" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar(255) NOT NULL,
  "short_desc" text,
  "section" varchar(128),
  "sub_section" varchar(255),
  "icon_url" varchar(512),
  "detail_url" varchar(512),
  "official_url" varchar(512),
  "panel_html" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

-- 简化智能体配置
CREATE TABLE IF NOT EXISTS "simple_bot_configs" (
  "bot_id" varchar(64) PRIMARY KEY NOT NULL,
  "name" varchar(255) NOT NULL,
  "description" text,
  "shortcut_commands" jsonb,
  "agents_variable" jsonb,
  "other_config" jsonb,
  "shortcut_count" integer DEFAULT 0 NOT NULL,
  "variable_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

-- ========== 代码生成 + 系统辅助 ==========

-- 代码生成业务表
CREATE TABLE IF NOT EXISTS "gen_table" (
  "table_id" bigserial PRIMARY KEY NOT NULL,
  "table_name" varchar(200) DEFAULT '' NOT NULL,
  "table_comment" varchar(500) DEFAULT '' NOT NULL,
  "sub_table_name" varchar(200),
  "sub_table_fk_name" varchar(200),
  "class_name" varchar(200) DEFAULT '' NOT NULL,
  "tpl_category" varchar(10) DEFAULT 'crud' NOT NULL,
  "tpl_web_type" varchar(10) DEFAULT 'element-ui' NOT NULL,
  "package_name" varchar(100) DEFAULT '' NOT NULL,
  "module_name" varchar(100) DEFAULT '' NOT NULL,
  "business_name" varchar(100) DEFAULT '' NOT NULL,
  "function_name" varchar(500) DEFAULT '' NOT NULL,
  "function_author" varchar(100) DEFAULT '' NOT NULL,
  "gen_type" varchar(1) DEFAULT '0' NOT NULL,
  "gen_path" varchar(200),
  "options" text,
  "create_by" varchar(64) DEFAULT '' NOT NULL,
  "create_time" timestamptz DEFAULT now() NOT NULL,
  "update_by" varchar(64) DEFAULT '' NOT NULL,
  "update_time" timestamptz DEFAULT now() NOT NULL,
  "remark" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ix_gen_table_create_by" ON "gen_table" ("create_by");
CREATE INDEX IF NOT EXISTS "ix_gen_table_update_by" ON "gen_table" ("update_by");

-- 代码生成业务字段表
CREATE TABLE IF NOT EXISTS "gen_table_column" (
  "column_id" bigserial PRIMARY KEY NOT NULL,
  "table_id" bigint,
  "column_name" varchar(200) DEFAULT '' NOT NULL,
  "column_comment" varchar(1000) DEFAULT '' NOT NULL,
  "column_type" varchar(100) DEFAULT '' NOT NULL,
  "java_type" varchar(100) DEFAULT '' NOT NULL,
  "java_field" varchar(200) DEFAULT '' NOT NULL,
  "is_pk" varchar(1) DEFAULT '0' NOT NULL,
  "is_increment" varchar(1) DEFAULT '0' NOT NULL,
  "is_required" varchar(1) DEFAULT '0' NOT NULL,
  "is_insert" varchar(1) DEFAULT '0' NOT NULL,
  "is_edit" varchar(1) DEFAULT '0' NOT NULL,
  "is_list" varchar(1) DEFAULT '0' NOT NULL,
  "is_query" varchar(1) DEFAULT '0' NOT NULL,
  "query_type" varchar(200) DEFAULT 'EQ' NOT NULL,
  "html_type" varchar(200) DEFAULT 'input' NOT NULL,
  "dict_type" varchar(200) DEFAULT '' NOT NULL,
  "sort" integer DEFAULT 0 NOT NULL,
  "create_by" varchar(64) DEFAULT '' NOT NULL,
  "create_time" timestamptz DEFAULT now() NOT NULL,
  "update_by" varchar(64) DEFAULT '' NOT NULL,
  "update_time" timestamptz DEFAULT now() NOT NULL,
  "remark" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ix_gen_table_column_create_by" ON "gen_table_column" ("create_by");
CREATE INDEX IF NOT EXISTS "ix_gen_table_column_update_by" ON "gen_table_column" ("update_by");

-- Tbox Bean 配置
CREATE TABLE IF NOT EXISTS "tbox_bean" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "bean_type" varchar(50),
  "bean_data" text,
  "status" integer DEFAULT 1 NOT NULL,
  "create_time" timestamptz DEFAULT now() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ix_tbox_bean_status" ON "tbox_bean" ("status");

-- 管理员-岗位关联（复合主键）
CREATE TABLE IF NOT EXISTS "admin_user_post" (
  "user_id" bigint NOT NULL,
  "post_id" bigint NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "admin_user_post_user_id_post_id_pk" PRIMARY KEY ("user_id", "post_id")
);
