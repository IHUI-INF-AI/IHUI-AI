-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- [DB-SCHEMA-GAP-01] 补偿迁移(2026-11-07)：在 20261107000000 建表之后补齐 2 个 api_subscriptions 索引。
-- 背景：20261106150000 里的这 2 个索引在存量库会因 api_subscriptions 不存在而跳过
--   （生产 20260916170000 是 lateGap：journal 有条目、账本无行、when 低于水位，migrate 永不应用）。
-- 本迁移全部幂等（IF NOT EXISTS），空库重放与「已应用 #1..#5 继续往上跑」都安全。
-- 审计可见：每个索引输出 BUG-29 IDX AUDIT item=<name> status=<built|exists|skipped reason=missing_table> sqlstate=<...>。
-- 无 EXCEPTION：缺表走 skipped 分支，其余真实失败直接 abort。

DO $$ BEGIN
  IF to_regclass('public.api_subscriptions') IS NULL THEN
    RAISE NOTICE 'BUG-29 IDX AUDIT item=% status=skipped reason=missing_table sqlstate=42P01', 'ix_api_subscriptions_plan_id';
  ELSIF to_regclass('public.ix_api_subscriptions_plan_id') IS NOT NULL THEN
    RAISE NOTICE 'BUG-29 IDX AUDIT item=% status=exists sqlstate=00000', 'ix_api_subscriptions_plan_id';
  ELSE
    CREATE INDEX IF NOT EXISTS "ix_api_subscriptions_plan_id" ON "api_subscriptions" ("plan_id");
    RAISE NOTICE 'BUG-29 IDX AUDIT item=% status=built sqlstate=00000', 'ix_api_subscriptions_plan_id';
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF to_regclass('public.api_subscriptions') IS NULL THEN
    RAISE NOTICE 'BUG-29 IDX AUDIT item=% status=skipped reason=missing_table sqlstate=42P01', 'ix_api_subscriptions_order_id';
  ELSIF to_regclass('public.ix_api_subscriptions_order_id') IS NOT NULL THEN
    RAISE NOTICE 'BUG-29 IDX AUDIT item=% status=exists sqlstate=00000', 'ix_api_subscriptions_order_id';
  ELSE
    CREATE INDEX IF NOT EXISTS "ix_api_subscriptions_order_id" ON "api_subscriptions" ("order_id");
    RAISE NOTICE 'BUG-29 IDX AUDIT item=% status=built sqlstate=00000', 'ix_api_subscriptions_order_id';
  END IF;
END $$;
