-- 中转站渠道分组表(2026-07-31 立,#4 #6 合并任务)
-- 渠道分组 + 负载均衡(weight / round-robin / least-latency)+ 故障自动切换
-- 幂等:CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS
-- 关联:ai_relay_channel_group_members.key_pool_id → ai_relay_key_pool.id(不加 FK,跨 schema 文件松耦合)

-- =============================================================================
-- 1. 渠道分组主表
-- =============================================================================
CREATE TABLE IF NOT EXISTS ai_relay_channel_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(64) NOT NULL,
  description TEXT,
  load_balance_strategy VARCHAR(32) NOT NULL DEFAULT 'weight',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ai_relay_channel_groups IS '中转站渠道分组(负载均衡 + 故障切换)';
COMMENT ON COLUMN ai_relay_channel_groups.name IS '组名(admin 识别用,如 openai-group / claude-group)';
COMMENT ON COLUMN ai_relay_channel_groups.load_balance_strategy IS '负载均衡策略:weight=加权随机 / round-robin=轮询 / least-latency=最少延迟';
COMMENT ON COLUMN ai_relay_channel_groups.priority IS '组优先级(数字越大越优先,故障降级到低的)';

CREATE INDEX IF NOT EXISTS ai_relay_channel_groups_enabled_idx ON ai_relay_channel_groups(enabled);
CREATE INDEX IF NOT EXISTS ai_relay_channel_groups_priority_idx ON ai_relay_channel_groups(priority);
CREATE UNIQUE INDEX IF NOT EXISTS ai_relay_channel_groups_name_unique ON ai_relay_channel_groups(name);

-- =============================================================================
-- 2. 渠道-分组关联表(一个 key_pool 条目可属于多个组)
-- =============================================================================
CREATE TABLE IF NOT EXISTS ai_relay_channel_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES ai_relay_channel_groups(id) ON DELETE CASCADE,
  key_pool_id UUID NOT NULL,
  weight INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ai_relay_channel_group_members IS '渠道-分组关联(多对多,key_pool_id 不加 FK 松耦合)';
COMMENT ON COLUMN ai_relay_channel_group_members.key_pool_id IS '关联 ai_relay_key_pool.id(应用层维护,不加 FK)';
COMMENT ON COLUMN ai_relay_channel_group_members.weight IS '组内权重(用于 weight 策略)';

CREATE INDEX IF NOT EXISTS ai_relay_channel_group_members_group_id_idx ON ai_relay_channel_group_members(group_id);
CREATE INDEX IF NOT EXISTS ai_relay_channel_group_members_key_pool_id_idx ON ai_relay_channel_group_members(key_pool_id);
-- 一个 key 在同一组内只能出现一次(避免重复权重)
CREATE UNIQUE INDEX IF NOT EXISTS ai_relay_channel_group_members_group_key_unique ON ai_relay_channel_group_members(group_id, key_pool_id);
