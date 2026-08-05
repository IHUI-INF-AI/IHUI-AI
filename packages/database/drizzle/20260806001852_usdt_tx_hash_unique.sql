-- P0-6 USDT 链上交易哈希唯一约束(2026-08-05)
-- 同一 txHash 只能绑定一个 confirmed 订单,防同一笔链上转账重复/超额入账。
-- 部分唯一索引:仅对 status='confirmed' 的行生效(pending/expired 订单 txHash 可为空/占位)。
CREATE UNIQUE INDEX IF NOT EXISTS "usdt_payments_tx_hash_confirmed_uniq"
  ON "usdt_payments" ("tx_hash")
  WHERE "status" = 'confirmed';
