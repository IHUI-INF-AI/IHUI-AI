-- L2-4 用户画像持久化 migration(2026-07-25 立)
-- 持久化 UserProfileBuilder._profiles 的用户画像聚合,使进程重启不丢失画像数据。
-- 启动时由 ai-service lifespan 从本表全量 hydrate 到 UserProfileBuilder 内存 Map,
-- 运行时 build_profile / update_profile 增量 UPSERT 同步,保证进程崩溃/重启后画像可恢复。
--
-- 设计:每用户 1 行(UserProfileAggregate 整体序列化为 jsonb),而非每维度 1 行,
-- 因为画像聚合通常整体读取 + 整体更新(不分维度查询),jsonb 简化 schema + 提升读写性能。
--
-- 说明:db:generate 自 idx 128 起因 snapshot 缺失无法非交互运行(详见 _journal.json),
--       本 migration 沿用项目 20260722* 系列手写 SQL 约定(IF NOT EXISTS 幂等),
--       不修改 _journal.json。
--
-- 执行方式(与项目 20260722* 系列手写 migration 一致):
--   pnpm tsx packages/database/scripts/apply-migration.mjs drizzle/20260725130000_agent_user_profile.sql
-- 或直接 psql:
--   psql "$DATABASE_URL" -f packages/database/drizzle/20260725130000_agent_user_profile.sql

-- ============================================================================
-- 1. agent_user_profile — 用户画像聚合持久化表
-- ============================================================================
-- 本表是 UserProfileBuilder._profiles(Map<userId, UserProfileAggregate>)的持久化镜像,
-- 启动时由 lifespan 全量读取并 hydrate 到内存,运行时由 UserProfileBuilder 增量同步。
-- profile 字段是 UserProfileAggregate 整体序列化的 jsonb,包含:
--   {userId, entries: [{dimension, content, confidence, supportingMemoryIds, updatedAt}],
--    totalMemories, completeness, updatedAt}
CREATE TABLE IF NOT EXISTS "agent_user_profile" (
  -- 用户 ID(主键,与 users.id 类型一致)
  "user_id" uuid PRIMARY KEY NOT NULL,
  -- 画像完整度(0-1),用于排序"哪些用户画像最完整"等查询
  "completeness" real DEFAULT 0.0 NOT NULL,
  -- 总记忆条数(画像基于的记忆数量,用于审计 + 画像新鲜度判断)
  "total_memories" integer DEFAULT 0 NOT NULL,
  -- 画像聚合 jsonb(UserProfileAggregate 完整结构,含 entries 数组)
  "profile" jsonb NOT NULL,
  -- system prompt 片段(可选,LLM 预生成的紧凑画像摘要,供 AgentLoop 注入)
  -- 若为 null 表示尚未生成,AgentLoop 调 build_system_prompt_snippet 实时生成
  "system_prompt_snippet" text,
  -- 创建时间(首次持久化时写入)
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  -- 更新时间(每次增量同步时刷新)
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- 完整度索引:按 completeness 排序查询画像最完整的用户(用于优先 hydrate / 审计)
CREATE INDEX IF NOT EXISTS "agent_user_profile_completeness_idx" ON "agent_user_profile" ("completeness" DESC);
-- 更新时间索引:按 updated_at 排序查询最近活跃用户(用于增量同步 / 审计)
CREATE INDEX IF NOT EXISTS "agent_user_profile_updated_idx" ON "agent_user_profile" ("updated_at" DESC);
