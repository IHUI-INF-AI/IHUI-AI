-- 0111_r76_indexes.sql
-- R76 索引补齐 (3 unique + 3 普通)
-- 唯一索引: zhs_order.out_trade_no / zhs_course_pay.order_no / zhs_exchange_rate(from,to)
-- 普通索引: zhs_course.creator / zhs_course_new.creator / zhs_agent_settlement.agent_id

-- 唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS "zhs_order_out_trade_no_uq" ON "zhs_order" ("out_trade_no");
CREATE UNIQUE INDEX IF NOT EXISTS "zhs_course_pay_order_no_uq" ON "zhs_course_pay" ("order_no");
CREATE UNIQUE INDEX IF NOT EXISTS "zhs_exchange_rate_pair_uq" ON "zhs_exchange_rate" ("from_currency", "to_currency");

-- 普通索引
CREATE INDEX IF NOT EXISTS "zhs_course_creator_idx" ON "zhs_course" ("creator");
CREATE INDEX IF NOT EXISTS "zhs_course_new_creator_idx" ON "zhs_course_new" ("creator");
CREATE INDEX IF NOT EXISTS "zhs_agent_settlement_agent_id_idx" ON "zhs_agent_settlement" ("agent_id");
