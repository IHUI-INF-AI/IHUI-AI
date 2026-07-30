-- API 订阅方案 seed(2026-07-31 立,P0-6 中转站产品化)
-- 3 档 API 订阅方案,对齐国际价位($9/$29/$99 视为 9/29/99 元,贴合国内支付场景)
-- 幂等插入:重复执行不会报错(ON CONFLICT DO NOTHING);name 唯一约束由应用层守门
-- orderType=6 订单关联 plans.id 作为 productId,激活时把 token 配额写入用户当前活跃 Key

-- Starter: ¥9/月送 50 万 token + 10 QPS
INSERT INTO plans (id, name, description, price, interval, features, is_active, sort_order, billing_period, trial_days, is_recurring)
VALUES (
  gen_random_uuid(),
  'API Starter',
  '开发者入门:每月 50 万 token + 10 QPS + 898 模型全库访问',
  900,  -- 900 分 = ¥9.00
  'month',
  '["500000 tokens/month", "10 QPS", "898 models access", "email support", "community access"]'::jsonb,
  true, 1, 'month', 0, true
) ON CONFLICT DO NOTHING;

-- Pro: ¥29/月送 200 万 token + 60 QPS
INSERT INTO plans (id, name, description, price, interval, features, is_active, sort_order, billing_period, trial_days, is_recurring)
VALUES (
  gen_random_uuid(),
  'API Pro',
  '专业开发者:每月 200 万 token + 60 QPS + 优先支持 + BYOK 抽成减半',
  2900,
  'month',
  '["2000000 tokens/month", "60 QPS", "898 models access", "priority support", "BYOK commission 50% off", "playground access"]'::jsonb,
  true, 2, 'month', 0, true
) ON CONFLICT DO NOTHING;

-- Enterprise: ¥99/月送 1000 万 token + 无限 QPS
INSERT INTO plans (id, name, description, price, interval, features, is_active, sort_order, billing_period, trial_days, is_recurring)
VALUES (
  gen_random_uuid(),
  'API Enterprise',
  '企业级:每月 1000 万 token + 无限 QPS + 专属客户经理 + SLA 99.9% + 私有部署支持',
  9900,
  'month',
  '["10000000 tokens/month", "unlimited QPS", "898 models access", "dedicated CSM", "99.9% SLA", "private deployment support", "custom model mapping", "SSO/SAML"]'::jsonb,
  true, 3, 'month', 0, true
) ON CONFLICT DO NOTHING;
