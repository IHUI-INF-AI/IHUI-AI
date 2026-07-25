-- L5 A/B 测试持久化 migration(2026-07-25 立)
-- 持久化 ABTest 状态(对照版本 control_version vs 实验版本 treatment_version),
-- 让 shadow 流量 + 显著性检验 + 自动 promote/rollback 决策在进程重启后可恢复。
--
-- 设计:
--   1 张主表 agent_ab_tests:
--     每个 skill 同时只允许 1 条 status='running' 的测试(由应用层保证)
--     status: running / promoted / rolled_back / stopped
--     control_stats / treatment_stats 为 JSONB 累计统计快照:
--       {
--         "success_count": int,
--         "failure_count": int,
--         "duration_ms_sum": float,
--         "duration_ms_sum_sq": float,  (用于计算方差)
--         "tokens_sum": int,
--         "tokens_sum_sq": float
--       }
--     decision_reason 记录显著性检验细节(p-value / effect size / 置信区间)
--
-- 内存模型(ABTestTracker._tests: dict[test_id, ABTestStats])为运行时累计主体,
-- 本表为持久化镜像:
--   - 启动时由 lifespan 全量 hydrate(只加载 status='running' 的测试)
--   - 周期性 flush(每次 ABTestScheduler 循环 / 决策时)写穿到 DB
--   - 决策(promote/rollback)→ 同步更新 DB
--
-- 说明:db:generate 自 idx 128 起因 snapshot 缺失无法非交互运行(详见 _journal.json),
--       本 migration 沿用项目 20260722* 系列手写 SQL 约定(IF NOT EXISTS 幂等),
--       不修改 _journal.json。
--
-- 执行方式(与项目 20260722* 系列手写 migration 一致):
--   pnpm tsx packages/database/scripts/apply-migration.mjs drizzle/20260725150000_agent_ab_tests.sql
-- 或直接 psql:
--   psql "$DATABASE_URL" -f packages/database/drizzle/20260725150000_agent_ab_tests.sql

-- ============================================================================
-- 1. agent_ab_tests — A/B 测试主表
-- ============================================================================
CREATE TABLE IF NOT EXISTS "agent_ab_tests" (
  -- 测试 ID(UUID,主键)
  "id" uuid PRIMARY KEY NOT NULL,
  -- 被测试的 skill 名(同一 skill 同时只允许 1 条 status='running')
  "skill_name" text NOT NULL,
  -- 控制组版本号(线上稳定版本,如 "1.0.0")
  "control_version" text NOT NULL,
  -- 实验组版本号(shadow 流量调用的候选版本,如 "1.1.0")
  "treatment_version" text NOT NULL,
  -- 测试状态:running(进行中)/ promoted(升级,新版替换旧版)/
  --          rolled_back(回滚,新版被淘汰)/ stopped(手动停止)
  "status" text NOT NULL DEFAULT 'running',
  -- shadow 流量比例(0-1,treatment 占比,默认 0.1 = 10% 流量走新版)
  "shadow_ratio" real DEFAULT 0.1 NOT NULL,
  -- 触发显著性检验的最小样本量(每组,默认 30,基于 CLT 中心极限定理)
  "min_sample_size" integer DEFAULT 30 NOT NULL,
  -- 显著性水平 α(默认 0.05,p-value < α 视为显著差异)
  "significance_level" real DEFAULT 0.05 NOT NULL,
  -- 控制组累计统计(JSONB,见上方注释结构)
  "control_stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
  -- 实验组累计统计(JSONB)
  "treatment_stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
  -- 决策结果:promote / rollback / inconclusive(样本不足或差异不显著)
  "decision" text,
  -- 决策原因(JSON 字符串,含 p-value / effect_size / 置信区间 / 检验方法)
  "decision_reason" text,
  -- 测试启动时间
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  -- 决策时间(promote / rollback 时写入)
  "decided_at" timestamp with time zone,
  -- 测试结束时间(任何终态都写入)
  "ended_at" timestamp with time zone
);

-- skill + 状态索引:查询某 skill 当前 running 的测试
CREATE INDEX IF NOT EXISTS "agent_ab_tests_skill_status_idx"
  ON "agent_ab_tests" ("skill_name", "status");
-- 状态索引:ABTestScheduler 周期扫描所有 running 测试
CREATE INDEX IF NOT EXISTS "agent_ab_tests_status_idx"
  ON "agent_ab_tests" ("status");
-- 启动时间索引:按时间排序查询历史测试
CREATE INDEX IF NOT EXISTS "agent_ab_tests_started_at_idx"
  ON "agent_ab_tests" ("started_at" DESC);
