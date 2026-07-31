-- USDT 加密货币支付网关(2026-08-01 立)
-- usdt_payments: USDT 充值订单表
--   - order_id: 业务订单号(全局唯一,格式 USDT + 时间戳 + 随机后缀)
--   - user_id: 发起充值的用户(级联删除)
--   - address: 充值目标地址(TRC20/ERC20 链上地址,从 env 读取)
--   - network: 链网络(TRC20 / ERC20)
--   - amount: 应收 USDT 数量(numeric(20,8),8 位小数精度)
--   - amount_paid: 实际到账 USDT 数量(确认时回写)
--   - tx_hash: 链上交易哈希(确认时回写)
--   - status: pending=待支付 / confirmed=已确认到账 / expired=已过期 / cancelled=已取消
--   - expires_at: 订单过期时间(默认创建后 30 分钟)
--   - confirmed_at: 确认到账时间
CREATE TABLE IF NOT EXISTS "usdt_payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "order_id" text NOT NULL UNIQUE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "address" text NOT NULL,
  "network" text NOT NULL,
  "amount" numeric(20,8) NOT NULL,
  "amount_paid" numeric(20,8) NOT NULL DEFAULT 0,
  "tx_hash" text,
  "status" text NOT NULL DEFAULT 'pending',
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "confirmed_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "usdt_payments_user_id_idx" ON "usdt_payments"("user_id");
CREATE INDEX IF NOT EXISTS "usdt_payments_status_idx" ON "usdt_payments"("status");
CREATE INDEX IF NOT EXISTS "usdt_payments_address_idx" ON "usdt_payments"("address");
