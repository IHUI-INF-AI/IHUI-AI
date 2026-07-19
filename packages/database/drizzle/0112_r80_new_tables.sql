-- 0112_r80_new_tables.sql
-- R80 补齐: D 盘 coze_zhs_py/models 2 张缺失表 + zhs_developer_link 7 字段 + zhs_agent_settlement issue_no
-- 1. video_generation_tasks (D 盘 video_task_models.py 1:1 迁移)
-- 2. simple_bot_configs (D 盘 simple_bot_config.py 1:1 迁移)
-- 3. zhs_developer_link 7 字段 (R80 补齐)
-- 4. zhs_agent_settlement issue_no 期号 (R80 补齐)

-- 表 1: video_generation_tasks
CREATE TABLE IF NOT EXISTS "video_generation_tasks" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "task_id" uuid NOT NULL UNIQUE,
  "user_uuid" varchar(255) NOT NULL,
  "chat_id" varchar(255),
  "status" varchar(50) NOT NULL DEFAULT 'accepted',
  "message" varchar(512),
  "result" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "video_generation_tasks_user_uuid_idx" ON "video_generation_tasks" ("user_uuid");
CREATE INDEX IF NOT EXISTS "video_generation_tasks_status_idx" ON "video_generation_tasks" ("status");

-- 表 2: simple_bot_configs
CREATE TABLE IF NOT EXISTS "simple_bot_configs" (
  "bot_id" varchar(64) PRIMARY KEY,
  "name" varchar(255) NOT NULL,
  "description" text,
  "shortcut_commands" jsonb,
  "agents_variable" jsonb,
  "other_config" jsonb,
  "shortcut_count" integer NOT NULL DEFAULT 0,
  "variable_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- zhs_developer_link 补齐 7 字段 (D 盘 coze_zhs_py/models/agent_models.py:449 DeveloperLink)
ALTER TABLE "zhs_developer_link"
  ADD COLUMN IF NOT EXISTS "expires_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "field1" varchar(500),
  ADD COLUMN IF NOT EXISTS "field2" varchar(500),
  ADD COLUMN IF NOT EXISTS "assigner" varchar(64),
  ADD COLUMN IF NOT EXISTS "allocate_time" timestamptz,
  ADD COLUMN IF NOT EXISTS "is_del" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "type" integer NOT NULL DEFAULT 0;

-- zhs_agent_settlement 补齐 issue_no 期号字段
ALTER TABLE "zhs_agent_settlement"
  ADD COLUMN IF NOT EXISTS "issue_no" integer;

-- zhs_agent_settlement 补 agent_id 索引
CREATE INDEX IF NOT EXISTS "zhs_agent_settlement_agent_id_idx" ON "zhs_agent_settlement" ("agent_id");
