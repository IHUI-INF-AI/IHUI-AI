-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

-- F-689(P2): developer_subscriptions 补 order_id 唯一索引
--
-- 背景:支付回调重放(订单已 paid 时 completeOrderWithSaga 返回 success 后,
-- 路由仍会再调 activateOrderSubscription → activateDeveloperSubscription)会重复
-- INSERT 订阅,同一笔订单授予 2 份权益。此前 order_id 只有普通索引,ON CONFLICT 无可推断目标。
-- 本迁移: 1) 存量按 order_id 去重(保留最早一条) 2) 建唯一索引供 ON CONFLICT DO NOTHING。
-- 注: order_id 可空,PostgreSQL 唯一索引允许多个 NULL,未带订单号的历史行不受影响。
--
-- 锁表说明(执行前必读):
--   * 本文件全部 DDL 由 packages/database/scripts/apply-migration.mjs 包在 sql.begin(...)
--     事务内执行(非 CONCURRENTLY),drizzle-kit migrate 同样逐条包事务 ⇒ 不能用 CONCURRENTLY。
--   * 去重 DELETE、DROP INDEX 与 CREATE UNIQUE INDEX 期间持表级锁;唯一索引构建完成前持
--     ShareLock,阻塞 INSERT/UPDATE/DELETE 写入(读不受影响)。
--   * 建议维护窗口/低峰执行;若生产必须零阻塞,请拆成独立脚本用 CONCURRENTLY 构建并单独记账。
--   * 执行前请先备份 developer_subscriptions(见下方 ROLLBACK)。
--
-- ROLLBACK(回滚):
--   DROP INDEX IF EXISTS "developer_subscriptions_order_id_uidx";
--   CREATE INDEX IF NOT EXISTS "ix_developer_subscriptions_order_id"
--     ON "developer_subscriptions" ("order_id");
--   回滚后不可逆的部分: 去重 DELETE 已物理删除重复订阅行,只能从执行前备份恢复;
--   且回滚即恢复"重放可重复插订阅"的缺陷,仅应在确认无重放流量时用于应急。

-- 1. 存量去重:同一 order_id 只保留最早一条;created_at 相同按 id 最小者保留(确定性)。
DELETE FROM "developer_subscriptions" a
USING "developer_subscriptions" b
WHERE a."order_id" = b."order_id"
  AND a."order_id" IS NOT NULL
  AND (
    a."created_at" > b."created_at"
    OR (a."created_at" = b."created_at" AND a."id" > b."id")
  );

--> statement-breakpoint

-- 2. 普通索引已被唯一索引覆盖,先删旧索引避免重复维护写入放大。
DROP INDEX IF EXISTS "ix_developer_subscriptions_order_id";

--> statement-breakpoint

-- 3. order_id 唯一索引:保证 ON CONFLICT (order_id) 有可推断目标,并挡住并发重放插入。
CREATE UNIQUE INDEX IF NOT EXISTS "developer_subscriptions_order_id_uidx"
  ON "developer_subscriptions" USING btree ("order_id");
