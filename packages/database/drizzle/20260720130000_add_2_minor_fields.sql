-- 20260720130000_add_2_minor_fields.sql
-- P2-11: agent_heat_stats 加 2 个非关键字段(审计报告标注的 Medium 影响小字段)
--   p95_duration_ms integer  -- 95 百分位耗时(毫秒)
--   error_rate decimal(4,4)  -- 错误率 0.0000-1.0000

-- ============ P2-11: agent_heat_stats 加 2 字段 ============
ALTER TABLE "agent_heat_stats"
  ADD COLUMN IF NOT EXISTS "p95_duration_ms" integer,
  ADD COLUMN IF NOT EXISTS "error_rate" numeric(4, 4);
