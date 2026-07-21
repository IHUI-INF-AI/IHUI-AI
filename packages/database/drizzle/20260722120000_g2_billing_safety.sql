-- G2 计费资金安全:token_flows 加幂等键
-- P0-4:拦截重复支付回调重复加余额(P0-2 + P0-4 联合修复)
-- partial unique index:仅 related_order_no IS NOT NULL 时生效,允许 NULL 值共存
CREATE UNIQUE INDEX IF NOT EXISTS token_flows_order_op_unique_idx
  ON token_flows (related_order_no, op_type)
  WHERE related_order_no IS NOT NULL;
