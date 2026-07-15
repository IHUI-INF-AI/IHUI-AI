-- 智能体扩展字段 + 互动表（迁移自 coze_zhs_py/api/agent_models.py）
-- 对应 schema: packages/database/src/schema/agents-extended.ts
--   agents.collectCount / publishStatus / suggestedQuestions
--   zhs_agent_thumbs / zhs_agent_collect / zhs_agent_useDetail
-- 幂等可重复执行（IF NOT EXISTS + ADD COLUMN IF NOT EXISTS）

-- 1. agents 表扩展字段
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "collect_count" bigint DEFAULT 0 NOT NULL;
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "publish_status" varchar(20) DEFAULT 'published';
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "suggested_questions" text;

-- 2. 点赞表
CREATE TABLE IF NOT EXISTS "zhs_agent_thumbs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "uuid" varchar(64) NOT NULL,
  "bot_id" varchar(64) NOT NULL,
  "thumbs_time" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "zhs_agent_thumbs_uuid_bot_idx" ON "zhs_agent_thumbs" ("uuid", "bot_id");

-- 3. 收藏表
CREATE TABLE IF NOT EXISTS "zhs_agent_collect" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "uuid" varchar(64) NOT NULL,
  "bot_id" varchar(64) NOT NULL,
  "collect_time" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "zhs_agent_collect_uuid_bot_idx" ON "zhs_agent_collect" ("uuid", "bot_id");

-- 4. 使用记录表
CREATE TABLE IF NOT EXISTS "zhs_agent_useDetail" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "uuid" varchar(64) NOT NULL,
  "bot_id" varchar(64) NOT NULL,
  "last_time" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "zhs_agent_useDetail_uuid_bot_idx" ON "zhs_agent_useDetail" ("uuid", "bot_id");
