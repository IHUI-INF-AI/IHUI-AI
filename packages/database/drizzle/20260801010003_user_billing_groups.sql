-- 用户计费分组表(2026-08-01 立,P0 中转站造血能力批次)
-- 用户可分入计费分组,每组对不同模型有独立倍率(如 svip 组 gpt-4 = 0.8 = 8 折)
-- 订阅包自动入组(买 Pro → vip 组,买 Enterprise → svip 组)
CREATE TABLE IF NOT EXISTS user_billing_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(64) NOT NULL,
  description TEXT,
  default_multiplier NUMERIC(5,2) NOT NULL DEFAULT '1.00',
  rate_limit_qpm INTEGER NOT NULL DEFAULT 10,
  is_default BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS user_billing_groups_name_unique ON user_billing_groups(name);
CREATE INDEX IF NOT EXISTS user_billing_groups_enabled_idx ON user_billing_groups(enabled);
CREATE INDEX IF NOT EXISTS user_billing_groups_sort_order_idx ON user_billing_groups(sort_order);

-- 用户-分组关联表(一个用户同时只在一个组)
CREATE TABLE IF NOT EXISTS user_billing_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  group_id UUID NOT NULL REFERENCES user_billing_groups(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_reason VARCHAR(128),
  expires_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS user_billing_group_members_group_id_idx ON user_billing_group_members(group_id);
CREATE INDEX IF NOT EXISTS user_billing_group_members_expires_at_idx ON user_billing_group_members(expires_at);

-- 分组-模型倍率覆盖表(二维矩阵)
CREATE TABLE IF NOT EXISTS user_billing_group_model_multipliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES user_billing_groups(id) ON DELETE CASCADE,
  model_id VARCHAR(128) NOT NULL,
  multiplier NUMERIC(5,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS user_billing_group_model_multipliers_group_model_unique ON user_billing_group_model_multipliers(group_id, model_id);
CREATE INDEX IF NOT EXISTS user_billing_group_model_multipliers_group_id_idx ON user_billing_group_model_multipliers(group_id);

-- Seed: 3 档默认组(default / vip / svip)
-- 使用固定 UUID 便于订阅激活时按 name 查找后引用
INSERT INTO user_billing_groups (id, name, description, default_multiplier, rate_limit_qpm, is_default, sort_order) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'default', '默认组(新用户自动入组,原价)', '1.00', 10, true, 0),
  ('a0000000-0000-0000-0000-000000000002', 'vip', 'VIP 组(买 Pro 订阅自动入组,9 折)', '0.90', 50, false, 1),
  ('a0000000-0000-0000-0000-000000000003', 'svip', 'SVIP 组(买 Enterprise 订阅自动入组,8 折)', '0.80', 100, false, 2)
ON CONFLICT (name) DO NOTHING;
