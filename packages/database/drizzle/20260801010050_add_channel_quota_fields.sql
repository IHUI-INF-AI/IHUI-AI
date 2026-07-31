-- 渠道配额功能(2026-08-01 立,成本控制刚需:防止单渠道超额消耗)。
--
-- 1. 给 ai_relay_key_pool 加 4 个配额字段(每日/每月调用次数 + token 上限,null=无限)
-- 2. 新建 ai_relay_channel_daily_usage 表(按日聚合用量,供配额检查 + admin Dashboard 展示)
--
-- 幂等:ALTER TABLE ADD COLUMN IF NOT EXISTS + CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS
-- 向后兼容:4 个新字段全部可空(老数据 NULL = 无限),不破坏现有 key_pool 读写
--
-- 关联:ai_relay_channel_daily_usage.key_pool_id → ai_relay_key_pool.id(ON DELETE CASCADE,
--   key_pool 删除时自动清理用量记录)
--
-- 配额检查流程(channel-quota-service.ts):
--   checkQuota(keyPoolId) → 查 key_pool 拿 4 个 limit → 查 daily_usage 拿当日用量 →
--   SUM 当月所有日期 → 任一超限返回 { allowed: false, reason }
--
-- 当月定义:UTC+8 当月 1 日 00:00 至当前(与 tiered-pricing-service.ts 一致)

-- =============================================================================
-- 1. ai_relay_key_pool 加 4 个配额字段
-- =============================================================================
ALTER TABLE ai_relay_key_pool
  ADD COLUMN IF NOT EXISTS daily_call_limit INTEGER,
  ADD COLUMN IF NOT EXISTS monthly_call_limit INTEGER,
  ADD COLUMN IF NOT EXISTS daily_token_limit BIGINT,
  ADD COLUMN IF NOT EXISTS monthly_token_limit BIGINT;

COMMENT ON COLUMN ai_relay_key_pool.daily_call_limit IS '每日调用次数上限(null=无限)';
COMMENT ON COLUMN ai_relay_key_pool.monthly_call_limit IS '每月调用次数上限(null=无限)';
COMMENT ON COLUMN ai_relay_key_pool.daily_token_limit IS '每日 token 上限(null=无限)';
COMMENT ON COLUMN ai_relay_key_pool.monthly_token_limit IS '每月 token 上限(null=无限)';

-- =============================================================================
-- 2. 渠道用量统计表(按日聚合)
-- =============================================================================
CREATE TABLE IF NOT EXISTS ai_relay_channel_daily_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_pool_id UUID NOT NULL REFERENCES ai_relay_key_pool(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  call_count INTEGER DEFAULT 0,
  total_tokens BIGINT DEFAULT 0,
  total_cost_cents INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(key_pool_id, usage_date)
);

COMMENT ON TABLE ai_relay_channel_daily_usage IS '渠道按日用量统计(配额检查 + admin Dashboard)';
COMMENT ON COLUMN ai_relay_channel_daily_usage.key_pool_id IS '关联 ai_relay_key_pool.id(级联删除)';
COMMENT ON COLUMN ai_relay_channel_daily_usage.usage_date IS '统计日期(UTC date,按日聚合)';
COMMENT ON COLUMN ai_relay_channel_daily_usage.call_count IS '当日调用次数(含错误)';
COMMENT ON COLUMN ai_relay_channel_daily_usage.total_tokens IS '当日累计 token 数';
COMMENT ON COLUMN ai_relay_channel_daily_usage.total_cost_cents IS '当日累计成本(分)';
COMMENT ON COLUMN ai_relay_channel_daily_usage.error_count IS '当日错误次数';
COMMENT ON COLUMN ai_relay_channel_daily_usage.updated_at IS '最近一次更新时间';

CREATE INDEX IF NOT EXISTS idx_channel_daily_usage_date ON ai_relay_channel_daily_usage(usage_date);
CREATE INDEX IF NOT EXISTS idx_channel_daily_usage_key ON ai_relay_channel_daily_usage(key_pool_id);
