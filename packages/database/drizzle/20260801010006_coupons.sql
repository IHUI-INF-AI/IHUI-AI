-- 优惠券 + 用户券表(2026-07-31 立,折扣券/满减券/裂变券三合一)
-- 注:表名用 promo_coupons 而非 coupons,因 promotions 模块已有同名 coupons 表(简单版)
-- type: 'discount'=折扣券 / 'deduction'=满减券 / 'referral'=裂变券
-- code: IHUI-COUPON-XXXXXXXXXXXX(12 位随机,排除易混淆字符 0/O/I/L)
CREATE TABLE IF NOT EXISTS promo_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(32) NOT NULL UNIQUE,
  name VARCHAR(128) NOT NULL,
  type VARCHAR(16) NOT NULL,
  value NUMERIC(5, 2),
  min_spend INTEGER,
  referrer_gets VARCHAR(16),
  referral_value INTEGER,
  applicable_models JSONB,
  applicable_scope VARCHAR(16) NOT NULL DEFAULT 'relay',
  total_quota INTEGER,
  issued_count INTEGER NOT NULL DEFAULT 0,
  per_user_limit INTEGER NOT NULL DEFAULT 1,
  starts_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS promo_coupons_code_idx ON promo_coupons(code);
CREATE INDEX IF NOT EXISTS promo_coupons_type_idx ON promo_coupons(type);
CREATE INDEX IF NOT EXISTS promo_coupons_enabled_idx ON promo_coupons(enabled);

-- 用户券(领取记录)
-- status: 'unused'/'used'/'expired'
-- 裂变链:referrer_user_id(谁分享给我的) + referred_by(关联分享人的 user_coupons.id)
CREATE TABLE IF NOT EXISTS user_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  coupon_id UUID NOT NULL REFERENCES promo_coupons(id) ON DELETE CASCADE,
  status VARCHAR(16) NOT NULL DEFAULT 'unused',
  referrer_user_id UUID,
  referred_by UUID,
  used_at TIMESTAMPTZ,
  used_on_order_id UUID,
  used_on_call_log_id UUID,
  discount_cents INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS user_coupons_user_status_idx ON user_coupons(user_id, status);
CREATE INDEX IF NOT EXISTS user_coupons_coupon_idx ON user_coupons(coupon_id);
CREATE INDEX IF NOT EXISTS user_coupons_referrer_idx ON user_coupons(referrer_user_id);
