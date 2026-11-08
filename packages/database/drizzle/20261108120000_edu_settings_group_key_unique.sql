-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

-- F-638(P2): edu_settings 补 (group,key) 唯一索引
--
-- 背景:批量导入 importEduSettings 以 (group,key) 判定 upsert,但表上只有普通索引,
-- ①同批次重复 key 会重复 INSERT;②并发导入可落重复行;③按 group+key 取一条无 ORDER BY。
-- 本迁移: 1) 存量去重(每组保留 updated_at 最新的一行) 2) 建唯一索引供 ON CONFLICT DO UPDATE。
-- 注: edu_settings 无 deleted_at 软删列,故使用全量 (group,key) 唯一索引,而非部分唯一索引。
--
-- 锁表说明(执行前必读):
--   * edu_settings 为行数级配置表,但本文件全部 DDL 在事务内执行,不能使用 CONCURRENTLY:
--     packages/database/scripts/apply-migration.mjs 对非 CONCURRENTLY 文件整体包 sql.begin(...)
--     事务;drizzle-kit migrate 同样逐条迁移包事务 ⇒ CREATE INDEX CONCURRENTLY 会直接报
--     "cannot run inside a transaction block"。
--   * 去重 DELETE、DROP INDEX 与 CREATE UNIQUE INDEX 期间持表级锁;CREATE UNIQUE INDEX 构建
--     完成前持 ShareLock,阻塞 INSERT/UPDATE/DELETE 写入(读不受影响)。
--   * 因此建议在维护窗口/低峰执行;若生产必须零阻塞,请把索引构建拆成独立脚本用
--     CONCURRENTLY 执行并单独记账,不要塞进本事务迁移。
--   * 执行前请先备份 edu_settings(见下方 ROLLBACK)。
--
-- ROLLBACK(回滚):
--   DROP INDEX IF EXISTS "edu_settings_group_key_uidx";
--   CREATE INDEX IF NOT EXISTS "edu_settings_group_key_idx"
--     ON "edu_settings" USING btree ("group", "key");
--   注意: 去重 DELETE 不可逆,被删除的旧重复行只能从执行前备份恢复。

-- 1. 存量去重:同一 (group,key) 只保留 updated_at 最新的一条;时间相同按 id 最大者保留(确定性)。
DELETE FROM "edu_settings" e
USING "edu_settings" k
WHERE e."group" = k."group"
  AND e."key" = k."key"
  AND (
    e."updated_at" < k."updated_at"
    OR (e."updated_at" = k."updated_at" AND e."id" < k."id")
  );

--> statement-breakpoint

-- 2. 普通索引已被唯一索引覆盖,先删旧索引避免重复维护写入放大。
DROP INDEX IF EXISTS "edu_settings_group_key_idx";

--> statement-breakpoint

-- 3. (group,key) 唯一索引:保证 upsert 的 ON CONFLICT 有可推断目标,并挡住重复/并发插入。
CREATE UNIQUE INDEX IF NOT EXISTS "edu_settings_group_key_uidx"
  ON "edu_settings" USING btree ("group", "key");
