-- Relay Webhook 订阅 + 投递日志(2026-08-01 立)
-- 扩展 Webhook 系统:relay 调用完成/异常/余额不足事件订阅 + 重试(3 次指数退避)+ HMAC 签名
-- 幂等:CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS

-- =============================================================================
-- 1. webhook_subscriptions(Relay Webhook 订阅表)
-- =============================================================================
CREATE TABLE IF NOT EXISTS "webhook_subscriptions" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  url varchar(512) NOT NULL,
  events jsonb NOT NULL DEFAULT '[]'::jsonb,
  secret varchar(128) NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  balance_threshold_cents integer DEFAULT 1000,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webhook_subscriptions_user_idx ON webhook_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS webhook_subscriptions_enabled_idx ON webhook_subscriptions (enabled);

COMMENT ON TABLE webhook_subscriptions IS 'Relay Webhook 订阅表(2026-08-01 立,relay 调用事件订阅 + HMAC 签名 + 重试)';
COMMENT ON COLUMN webhook_subscriptions.user_id IS '订阅所属用户(关联 users.id,松耦合不加 FK)';
COMMENT ON COLUMN webhook_subscriptions.url IS '回调 URL(接收方 POST 端点)';
COMMENT ON COLUMN webhook_subscriptions.events IS '订阅事件列表(jsonb 数组,如 ["relay.call.completed","relay.call.failed","relay.balance.low"])';
COMMENT ON COLUMN webhook_subscriptions.secret IS 'HMAC-SHA256 签名密钥(仅在创建时返回一次,后续查询脱敏)';
COMMENT ON COLUMN webhook_subscriptions.balance_threshold_cents IS '余额阈值(分,余额低于此值触发 relay.balance.low,默认 1000=10 元)';

-- =============================================================================
-- 2. webhook_delivery_logs(Relay Webhook 投递日志表)
-- =============================================================================
CREATE TABLE IF NOT EXISTS "webhook_delivery_logs" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
  event varchar(64) NOT NULL,
  payload jsonb NOT NULL,
  response_status integer,
  response_body text,
  attempt integer NOT NULL DEFAULT 1,
  status varchar(16) NOT NULL DEFAULT 'pending',
  next_retry_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webhook_delivery_logs_subscription_idx ON webhook_delivery_logs (subscription_id);
CREATE INDEX IF NOT EXISTS webhook_delivery_logs_status_idx ON webhook_delivery_logs (status);
CREATE INDEX IF NOT EXISTS webhook_delivery_logs_next_retry_idx ON webhook_delivery_logs (next_retry_at);

COMMENT ON TABLE webhook_delivery_logs IS 'Relay Webhook 投递日志表(2026-08-01 立,每次投递记录 + 指数退避重试)';
COMMENT ON COLUMN webhook_delivery_logs.subscription_id IS '关联 webhook_subscriptions.id(级联删除)';
COMMENT ON COLUMN webhook_delivery_logs.event IS '事件类型(如 relay.call.completed)';
COMMENT ON COLUMN webhook_delivery_logs.payload IS '投递负载(jsonb,含事件数据)';
COMMENT ON COLUMN webhook_delivery_logs.response_status IS '接收方返回的 HTTP 状态码(2xx 视为成功)';
COMMENT ON COLUMN webhook_delivery_logs.attempt IS '第几次尝试(1=首次,最多 3)';
COMMENT ON COLUMN webhook_delivery_logs.status IS '投递状态:pending/success/failed/retrying';
COMMENT ON COLUMN webhook_delivery_logs.next_retry_at IS '下次重试时间(指数退避:now + 2^attempt 秒)';
