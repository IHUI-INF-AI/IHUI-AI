-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌​​‌‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍‌​‌‌​‌‌‌‍‍​‌​​‌​​​‍‍​‌​‌​​‌​‍‍‌‌​​‌‌‌‍​⁠

-- ============================================================================
-- 20261108090000_disable_test_verify_code_bypass_seed（DB-33 数据侧收口）
--
-- ⚠ 这份**不是 drizzle 迁移**：
--   1) 迁移 20260801040000_admin_test_verify_code_bypass.sql 已经入库，
--      改它会让已应用环境与新环境的 hash 对不上（迁移链由另一条并行任务独占）；
--   2) 该迁移的种子写的是 is_active=true（ON CONFLICT 还把它改回 true），
--      与自身头注"生产库此表应保持 is_active=false"直接矛盾。
--   因此修复落在 manual-sql：**迁移之后**由运维显式执行本脚本，不写 journal。
--
-- 执行时机（重要）：
--   · 每个环境在 `db:migrate` 之后跑一次；全新库同样会先被迁移种子激活，
--     必须再跑本脚本才算收口；
--   · 生产环境若 `SMS_TEST_BYPASS` 从未设为 true，本脚本只是把潜在后门关死，
--     不影响真实验证码流程。
--
-- 执行方式：
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f packages/database/scripts/manual-sql/20261108090000_disable_test_verify_code_bypass_seed.sql
--
-- 锁表影响：
--   · UPDATE 只命中 seed 的两个标识（主键定位），行锁范围极小；
--   · ALTER COLUMN SET DEFAULT 只改 catalog 元数据，不重写表，持 ACCESS EXCLUSIVE
--     仅毫秒级；若表正被长事务占用会短暂排队，可放到低峰执行。
-- ============================================================================

BEGIN;

-- 1) 关闭迁移种子写入的两个已知占位账号（幂等：已是 false 的行不产生更新）
UPDATE "test_verify_code_bypass"
SET
  "is_active" = false,
  "updated_at" = now()
WHERE "identifier" IN ('admin@ihui.local', '13000000000')
  AND "is_active";

-- 2) 表级默认值同步为 false：未来任何 INSERT 不显式给 is_active 都不会静默激活
ALTER TABLE "test_verify_code_bypass"
  ALTER COLUMN "is_active" SET DEFAULT false;

COMMIT;

-- 3) 校验（必须看）：两行都应为 f
SELECT "identifier", "is_active", "updated_at"
FROM "test_verify_code_bypass"
WHERE "identifier" IN ('admin@ihui.local', '13000000000')
ORDER BY "identifier";

-- ---------------------------------------------------------------------------
-- 回滚（仅当确实需要在本地重新启用固定码时）：
--   把对应开发账号行的 is_active 改回可激活状态，并可视需要恢复列默认值。
--   本脚本有意不给出"重新激活"的现成语句，避免它被原样复制到生产环境。
--   即便重新激活，应用侧仍受双门约束：仅 development 档 + SMS_TEST_BYPASS=true 才查表。
-- ---------------------------------------------------------------------------
