-- L2-3 衰减状态持久化 migration(2026-07-25 立)
-- 持久化 MemoryDecayManager._states 的衰减状态,使进程重启不丢失内存中的衰减数据。
-- 启动时由 ai-service lifespan 从本表全量 hydrate 到 MemoryDecayManager 内存 Map,
-- 运行时增量 UPDATE 同步,保证进程崩溃/重启后衰减分数、访问计数、衰减标记可恢复。
--
-- 说明:db:generate 自 idx 128 起因 snapshot 缺失无法非交互运行(详见 _journal.json),
--       本 migration 沿用项目 20260722* 系列手写 SQL 约定(IF NOT EXISTS 幂等),
--       不修改 _journal.json。
--
-- 执行方式(与项目 20260722* 系列手写 migration 一致):
--   pnpm tsx packages/database/scripts/apply-migration.mjs drizzle/20260725120000_agent_memory_decay_state.sql
-- 或直接 psql:
--   psql "$DATABASE_URL" -f packages/database/drizzle/20260725120000_agent_memory_decay_state.sql

-- ============================================================================
-- 1. agent_memory_decay_state — 记忆衰减状态持久化表
-- ============================================================================
-- 本表是 MemoryDecayManager._states(Map<entryId, MemoryDecayState>)的持久化镜像,
-- 启动时由 lifespan 全量读取并 hydrate 到内存,运行时由 MemoryDecayManager 增量同步。
-- entry_id 来自不同记忆表(episodic / semantic / procedural),不强制外键关联避免跨表耦合;
-- user_id 是冗余字段,用于按用户 hydrate / 清理(避免全表扫描)。
CREATE TABLE IF NOT EXISTS "agent_memory_decay_state" (
  -- 记忆条目 ID(主键),对应 MemoryDecayState.entryId,与 agent_memory_episodic/semantic/procedural 的 id 对齐但不外键
  "entry_id" varchar(100) PRIMARY KEY NOT NULL,
  -- 用户 ID(冗余字段,与 users.id 类型一致,可空),用于按用户 hydrate / 清理;可空因为部分全局记忆无归属用户
  "user_id" uuid,
  -- 当前衰减分数(0-1),对应 MemoryDecayState.retentionScore,初始 1.0
  "retention_score" real DEFAULT 1.0 NOT NULL,
  -- 上次访问时间(ISO),对应 MemoryDecayState.lastAccessedAt,默认 now()
  "last_accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
  -- 访问次数,对应 MemoryDecayState.accessCount,初始 0
  "access_count" integer DEFAULT 0 NOT NULL,
  -- 是否已衰减(retention_score < minRetentionScore),对应 MemoryDecayState.isDecayed
  "is_decayed" boolean DEFAULT false NOT NULL,
  -- 计算时的衰减配置快照(jsonb,可空),便于审计衰减算法参数(halfLifeDays / minRetentionScore / decayIntervalMs 等)
  "config" jsonb,
  -- 创建时间(首次持久化时写入)
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  -- 更新时间(每次增量同步时刷新)
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- 用户索引:按 user_id 查询该用户所有衰减状态(启动 hydrate / 用户级清理)
CREATE INDEX IF NOT EXISTS "agent_memory_decay_state_user_idx" ON "agent_memory_decay_state" ("user_id");
-- 衰减标记索引:按 is_decayed 过滤已衰减条目(批量清理 / 统计衰减率)
CREATE INDEX IF NOT EXISTS "agent_memory_decay_state_decayed_idx" ON "agent_memory_decay_state" ("is_decayed");
