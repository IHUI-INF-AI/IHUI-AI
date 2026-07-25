-- L9 元认知反思日志 migration(2026-07-25 立)
-- 持久化 Metacognition.reflect_on_memories / detect_conflicts 产生的反思日志,
-- 使进程重启不丢失元认知历史。启动时由 ai-service lifespan 按需从本表 SELECT
-- 填充 Metacognition._cache,运行时由 Metacognition 增量 INSERT。
--
-- 设计:每条反思日志 1 行,reflection_type 区分:
--   memory_audit:        记忆自我审计(scan_stale + LLM 评估每条是否过时/错误/冗余)
--   forgetting_decision: 主动遗忘决策(forget_memory / demote_memory 调用记录)
--   conflict_detection:  冲突检测(detect_conflicts 发现的潜在冲突)
--   stale_check:         过期检查(scan_stale_memories 单独触发)
--
-- 说明:db:generate 自 idx 128 起因 snapshot 缺失无法非交互运行(详见 _journal.json),
--       本 migration 沿用项目 20260722* 系列手写 SQL 约定(IF NOT EXISTS 幂等),
--       不修改 _journal.json。
--
-- 执行方式(与项目 20260722* 系列手写 migration 一致):
--   pnpm tsx packages/database/scripts/apply-migration.mjs drizzle/20260725190000_agent_metacognition_log.sql
-- 或直接 psql:
--   psql "$DATABASE_URL" -f packages/database/drizzle/20260725190000_agent_metacognition_log.sql

-- ============================================================================
-- 1. agent_metacognition_log — 元认知反思日志持久化表
-- ============================================================================
-- 本表是 Metacognition._cache(list[dict])的持久化镜像,
-- 启动时由 lifespan 按需读取并 hydrate 到内存,运行时由 Metacognition 增量 INSERT。
-- user_id 可空:系统级反思(user_id=NULL,如跨用户模式挖掘)。
-- target_id 可空:系统级反思时 target_id=NULL。
CREATE TABLE IF NOT EXISTS "agent_metacognition_log" (
  -- 反思日志 ID(UUID,主键,自动生成)
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 用户 ID(可空,系统级反思为 NULL)
  "user_id" text,
  -- 反思类型:memory_audit / forgetting_decision / conflict_detection / stale_check
  "reflection_type" text NOT NULL,
  -- 反思对象所在记忆层:episodic / semantic / procedural / working(可空,系统级时为 NULL)
  "target_layer" text,
  -- 反思对象 ID(可空,系统级反思为 NULL)
  "target_id" text,
  -- 反思发现的问题列表(jsonb 数组,每项 {"issue":"...","severity":"low/medium/high"})
  "findings" jsonb DEFAULT '[]'::jsonb NOT NULL,
  -- 采取的行动列表(jsonb 数组,每项 {"action":"forget/merge/demote/promote","target_id":"...","reason":"..."})
  "actions_taken" jsonb DEFAULT '[]'::jsonb NOT NULL,
  -- 反思结论的置信度(0-1,LLM 评估的可信度,启发式规则默认 0.5)
  "confidence" real DEFAULT 0.5 NOT NULL,
  -- 是否调用了 LLM(启发式降级时 false)
  "llm_used" boolean DEFAULT false NOT NULL,
  -- LLM 调用 token 消耗(LLM 未调用时 0)
  "token_cost" integer DEFAULT 0 NOT NULL,
  -- 创建时间(反思日志写入时自动填充)
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- 用户索引:按 user_id 过滤(用户级反思历史查询)
CREATE INDEX IF NOT EXISTS "agent_metacognition_log_user_idx" ON "agent_metacognition_log" ("user_id");
-- 反思类型索引:按 reflection_type 过滤(按类型审计 / 统计)
CREATE INDEX IF NOT EXISTS "agent_metacognition_log_type_idx" ON "agent_metacognition_log" ("reflection_type");
-- 创建时间索引:按 created_at 倒序查询最近反思(供 build_system_prompt_snippet / get_reflection_history)
CREATE INDEX IF NOT EXISTS "agent_metacognition_log_created_idx" ON "agent_metacognition_log" ("created_at" DESC);
