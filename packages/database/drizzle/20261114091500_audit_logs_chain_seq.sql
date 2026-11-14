-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

-- F-274:审计链(audit_logs_chain)原先没有单调序号,写链时用
--   SELECT current_hash FROM audit_logs_chain ORDER BY timestamp DESC LIMIT 1
-- 取链尾。timestamp 是各实例的本地毫秒时钟:
--   ① 多实例时钟偏差 / NTP 回拨 ⇒ 「timestamp 最大」不等于「最后写入」;
--   ② 同毫秒并发 ⇒ timestamp 没有 tie-breaker(id 是随机 uuid,不能当顺序)。
-- 后果:后写入的行挂到错的前驱(链分叉),或校验把链按 timestamp 重排后误报「链断裂」。
--
-- 本迁移给链补单调序号 seq(BIGSERIAL 由库序列分配 ⇒ 严格单调),既有行按
-- **物理插入顺序**回填(ADD COLUMN 带 volatile default 会重写整表,逐行 nextval 的
-- 扫描顺序即物理顺序)。seq 不进哈希输入(computeAuditHash 只吃 prev_hash + 业务字段),
-- 所以既有行 current_hash 一字不改,不需要 rechain。
--
-- 上线顺序(硬要求):**先在所有库执行本迁移,再发布改用 seq 的代码**。
-- 代码早于迁移时链尾查询会因列不存在而失败,recordAuditLog 会走既有 catch 降级
-- (审计行不落库):不会写坏链,但窗口期的审计记录会丢。
--
-- 锁与耗时:ADD COLUMN 带 default 需要重写整表(ACCESS EXCLUSIVE,期间阻塞读写),
-- 大表请放维护窗口;唯一索引在本迁移事务内一并建好(非 CONCURRENTLY)。
-- 回滚:ALTER TABLE "audit_logs_chain" DROP COLUMN IF EXISTS "seq";
--       (BIGSERIAL 自带的序列 audit_logs_chain_seq_seq 随列一起删除)
ALTER TABLE "audit_logs_chain" ADD COLUMN IF NOT EXISTS "seq" bigserial;

CREATE UNIQUE INDEX IF NOT EXISTS "audit_logs_chain_seq_uniq"
  ON "audit_logs_chain" USING btree ("seq");

ALTER TABLE "audit_logs_chain" ALTER COLUMN "seq" SET NOT NULL;
