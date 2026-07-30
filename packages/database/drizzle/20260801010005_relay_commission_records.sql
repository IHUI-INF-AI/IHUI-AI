-- Relay 调用返佣流水表(2026-07-31 立,把返佣绑到 relay 调用消费)
-- 被邀请人每次 relay 调用消费 → 邀请人(父级 5% + 祖父级 1%)返佣,7 天冻结期防刷
-- status: 'frozen'(冻结) / 'released'(已释放,返佣到账) / 'expired'(已过期)
-- beneficiary_level: 1=父级(直接邀请人) / 2=祖父级(父级的邀请人)
-- commission_rate: numeric(5,4),0.0500=5%,0.0100=1%
CREATE TABLE IF NOT EXISTS relay_commission_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_call_log_id UUID REFERENCES llm_call_logs(id) ON DELETE SET NULL,
  source_cost_cents INTEGER NOT NULL,
  beneficiary_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  beneficiary_level INTEGER NOT NULL,
  commission_rate NUMERIC(5,4) NOT NULL,
  commission_cents INTEGER NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'frozen',
  frozen_until TIMESTAMPTZ NOT NULL,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS relay_commission_records_source_user_idx ON relay_commission_records(source_user_id);
CREATE INDEX IF NOT EXISTS relay_commission_records_beneficiary_idx ON relay_commission_records(beneficiary_user_id);
CREATE INDEX IF NOT EXISTS relay_commission_records_status_idx ON relay_commission_records(status);
CREATE INDEX IF NOT EXISTS relay_commission_records_frozen_until_idx ON relay_commission_records(frozen_until);

-- Seed 返佣率默认配置到 system_configs 表(category='relay_commission')
-- level1=父级 5%,level2=祖父级 1%,frozen_days=7 天冻结期
-- 用 ON CONFLICT (key) DO NOTHING 保证幂等(已存在则不覆盖 admin 改后的值)
INSERT INTO system_configs (key, value, type, category, description, is_public)
VALUES
  ('relay_commission.level1_rate', '0.05', 'number', 'relay_commission', 'Relay 返佣父级比例(0.05=5%)', false),
  ('relay_commission.level2_rate', '0.01', 'number', 'relay_commission', 'Relay 返佣祖父级比例(0.01=1%)', false),
  ('relay_commission.frozen_days', '7', 'number', 'relay_commission', 'Relay 返佣冻结天数(到期后释放)', false)
ON CONFLICT (key) DO NOTHING;
