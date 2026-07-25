-- L8 长程一致性系统持久化 migration(2026-07-25 立)
-- 持久化 SessionSummarizer 生成的会话摘要 + 工作记忆压缩日志,
-- 使跨会话 RAG 检索 / 工作记忆压缩策略可审计,进程重启不丢失。
--
-- 设计:
--   agent_session_summary              会话摘要表(每会话 1 行,含 summary + embedding)
--   agent_working_memory_compression   工作记忆压缩日志(每次压缩 1 行,审计用)
--
-- 说明:db:generate 自 idx 128 起因 snapshot 缺失无法非交互运行(详见 _journal.json),
--       本 migration 沿用项目 20260722* 系列手写 SQL 约定(IF NOT EXISTS 幂等),
--       不修改 _journal.json。
--
-- 执行方式(与项目 20260722* 系列手写 migration 一致):
--   pnpm tsx packages/database/scripts/apply-migration.mjs drizzle/20260725180000_agent_session_summary.sql
-- 或直接 psql:
--   psql "$DATABASE_URL" -f packages/database/drizzle/20260725180000_agent_session_summary.sql

-- ============================================================================
-- 1. agent_session_summary — 会话摘要表
-- ============================================================================
-- 每行表示一次会话的 LLM 摘要(200-500 字)+ 关键事实/决策 + summary 向量,
-- 供 LongTermMemory.recall_cross_session 跨会话 RAG 检索。
CREATE TABLE IF NOT EXISTS "agent_session_summary" (
  -- 摘要 ID(UUID,主键,由 gen_random_uuid 自动生成)
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 用户 ID(跨会话检索的过滤维度)
  "user_id" text NOT NULL,
  -- 会话 ID(单会话唯一,用于去重 / 反查)
  "session_id" text NOT NULL,
  -- LLM 生成的会话摘要(200-500 字)
  "summary" text NOT NULL,
  -- 关键事实列表(jsonb 数组 of string,如 ["用户偏好中文回复", "项目用 React 19"])
  "key_facts" jsonb DEFAULT '[]'::jsonb,
  -- 关键决策列表(jsonb 数组 of string,如 ["采用 Tailwind 4", "放弃 Redux"])
  "key_decisions" jsonb DEFAULT '[]'::jsonb,
  -- 会话消息条数(统计用)
  "message_count" integer DEFAULT 0,
  -- 会话 token 数估算(统计用)
  "token_count" integer DEFAULT 0,
  -- 会话开始时间
  "start_time" timestamp with time zone,
  -- 会话结束时间(默认 now,跨会话检索排序键)
  "end_time" timestamp with time zone DEFAULT now(),
  -- 重要性评分(0-1,可由 LongTermMemory.update_importance 更新)
  "importance_score" real DEFAULT 0.5,
  -- summary 的嵌入向量(jsonb array of float,用于跨会话 cosine 检索,可空)
  "embedding" jsonb,
  -- 创建时间(首次持久化时写入)
  "created_at" timestamp with time zone DEFAULT now()
);

-- 用户维度索引:按 user_id 过滤该用户全部会话摘要
CREATE INDEX IF NOT EXISTS "agent_session_summary_user_idx"
  ON "agent_session_summary" ("user_id");
-- 用户 + 时间倒序索引:按 user_id 检索最近会话(用于 list_user_summaries)
CREATE INDEX IF NOT EXISTS "agent_session_summary_user_end_idx"
  ON "agent_session_summary" ("user_id", "end_time" DESC);
-- 会话维度索引:按 session_id 反查(用于去重 / 更新)
CREATE INDEX IF NOT EXISTS "agent_session_summary_session_idx"
  ON "agent_session_summary" ("session_id");

-- ============================================================================
-- 2. agent_working_memory_compression — 工作记忆压缩日志表(审计用)
-- ============================================================================
-- 每次 compress_working_memory 调用记录 1 行,用于审计压缩策略效果。
-- 不影响运行时行为,仅作历史记录。
CREATE TABLE IF NOT EXISTS "agent_working_memory_compression" (
  -- 日志 ID(UUID,主键)
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 用户 ID
  "user_id" text NOT NULL,
  -- 会话 ID
  "session_id" text NOT NULL,
  -- 压缩前消息条数
  "original_messages" integer NOT NULL,
  -- 压缩后保留的消息数
  "compressed_to" integer NOT NULL,
  -- 压缩比(compressed_to / original_messages,0-1)
  "compression_ratio" real NOT NULL,
  -- 压缩策略:summary / sliding_window / hybrid
  "strategy" text NOT NULL,
  -- 创建时间
  "created_at" timestamp with time zone DEFAULT now()
);

-- 用户 + 会话维度索引:按 (user_id, session_id) 查询某会话的压缩历史
CREATE INDEX IF NOT EXISTS "agent_working_memory_compression_user_session_idx"
  ON "agent_working_memory_compression" ("user_id", "session_id");
