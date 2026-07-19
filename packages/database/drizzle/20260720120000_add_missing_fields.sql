-- 20260720120000_add_missing_fields.sql
-- 补齐 schema 缺失字段:
--   P0-4: user_sk_info.expire_at (用户会话密钥过期时间)
--   P0-5: agents.user_name (智能体创建者用户名冗余字段)
--   P1-5: agent_heat_stats 5 字段 + 6 新索引 + 1 UNIQUE(agent_id + date_str)
--     字段: total_calls / success_calls / failed_calls / avg_duration_ms / last_call_at
--     索引: date_str / agent_date / total_calls / success_calls / last_call_at / agent_last_call_at
--   P1-6: agent_callbacks 7 字段
--     method / headers / timeout / retry_count / retry_interval / status / last_callback_at

-- ============ P0-4: user_sk_info 加 expire_at ============
ALTER TABLE "user_sk_info"
  ADD COLUMN IF NOT EXISTS "expire_at" timestamp with time zone;

-- ============ P0-5: agents 加 user_name ============
ALTER TABLE "agents"
  ADD COLUMN IF NOT EXISTS "user_name" varchar(100);

-- ============ P1-5: agent_heat_stats 加 5 字段 ============
ALTER TABLE "agent_heat_stats"
  ADD COLUMN IF NOT EXISTS "total_calls" bigint DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "success_calls" bigint DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "failed_calls" bigint DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "avg_duration_ms" integer,
  ADD COLUMN IF NOT EXISTS "last_call_at" timestamp with time zone;

-- ============ P1-5: agent_heat_stats 6 个新索引 (agent_idx 已存在,保留) ============
CREATE INDEX IF NOT EXISTS "agent_heat_stats_date_str_idx" ON "agent_heat_stats" ("date_str");
CREATE INDEX IF NOT EXISTS "agent_heat_stats_agent_date_idx" ON "agent_heat_stats" ("agent_id", "date_str");
CREATE INDEX IF NOT EXISTS "agent_heat_stats_total_calls_idx" ON "agent_heat_stats" ("total_calls");
CREATE INDEX IF NOT EXISTS "agent_heat_stats_success_calls_idx" ON "agent_heat_stats" ("success_calls");
CREATE INDEX IF NOT EXISTS "agent_heat_stats_last_call_at_idx" ON "agent_heat_stats" ("last_call_at");
CREATE INDEX IF NOT EXISTS "agent_heat_stats_agent_last_call_at_idx" ON "agent_heat_stats" ("agent_id", "last_call_at");

-- ============ P1-5: agent_heat_stats UNIQUE 约束 (agent_id + date_str) ============
CREATE UNIQUE INDEX IF NOT EXISTS "agent_heat_stats_agent_date_unique" ON "agent_heat_stats" ("agent_id", "date_str");

-- ============ P1-6: agent_callbacks 加 7 字段 ============
ALTER TABLE "agent_callbacks"
  ADD COLUMN IF NOT EXISTS "method" varchar(20),
  ADD COLUMN IF NOT EXISTS "headers" text,
  ADD COLUMN IF NOT EXISTS "timeout" integer,
  ADD COLUMN IF NOT EXISTS "retry_count" integer,
  ADD COLUMN IF NOT EXISTS "retry_interval" integer,
  ADD COLUMN IF NOT EXISTS "status" varchar(20),
  ADD COLUMN IF NOT EXISTS "last_callback_at" timestamp with time zone;
