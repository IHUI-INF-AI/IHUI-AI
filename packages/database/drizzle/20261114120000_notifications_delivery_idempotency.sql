-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

-- Migration 20261114120000: 通知投递幂等 + 邮件出口两戳(F-512)
-- 创建时间: 2026-11-14
-- 与 packages/database/src/schema/notifications.ts 逐字对齐。
--
-- 背景(F-512):notification 队列是**至少一次**语义,BullMQ 在 `attempts:3` 下会重投。
-- 旧 worker 先 createNotification 普通 INSERT(无 onConflict)再发信,于是"落库成功、
-- 发信前进程被杀"⇒ 重投后同一用户两条站内信 + 第二封邮件,且邮件不可撤回。
--
--   ① idempotency_key + (user_id, idempotency_key) 唯一索引 = 落库幂等锚点。
--      worker 用 `INSERT ... ON CONFLICT DO NOTHING RETURNING` 插入,重投命中冲突即
--      视为"已落库",不再新增行(同 job 重投 ⇒ 一行)。
--   ② email_claimed_at / email_sent_at = 邮件出口的"占位 → 完成"两戳:
--      发信前先 `UPDATE ... WHERE email_sent_at IS NULL AND (claim 为空或已过期)`
--      原子抢占(跨实例只有一个抢到),发成功后写 email_sent_at;重投只补站内信不补邮件。
--      claim 过期窗口同时兜住"发信途中进程被杀"的情形(到期后允许重试)。
--
-- 三列全部可空 ⇒ 存量行零回填、零改写;唯一索引对 NULL 不去重(Postgres 语义),
-- 因此不经队列的同步直写路径(无幂等键)行为与迁移前完全一致。
--
-- 幂等安全:ADD COLUMN IF NOT EXISTS + CREATE UNIQUE INDEX IF NOT EXISTS,可重复执行。
-- 大表提示:notifications 若已达千万级,请把 CREATE UNIQUE INDEX 单独以
-- `CONCURRENTLY`(事务外)执行,避免建索引期间长锁写路径;
-- 本文件保持普通写法,以便能被单事务迁移器整体执行。

ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "idempotency_key" varchar(128);
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "email_claimed_at" timestamptz;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "email_sent_at" timestamptz;

-- 幂等锚点:同 (user_id, idempotency_key) 只有一行(重投的 ON CONFLICT 落点)
CREATE UNIQUE INDEX IF NOT EXISTS "notifications_user_idem_uq"
  ON "notifications" ("user_id", "idempotency_key");

-- 执行方式(与 20261113100000_workflow_todo.sql 同口径):
--   pnpm tsx packages/database/scripts/apply-migration.mjs drizzle/20261114120000_notifications_delivery_idempotency.sql
-- 生产走 drizzle-kit migrate 时,需由 `db:generate` 重新生成 journal/snapshot 后再执行。
