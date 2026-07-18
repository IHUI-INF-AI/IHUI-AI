-- skills 表软删除字段:支持 CLI ↔ Web 双向同步时正确处理删除语义
-- deletedAt 不为空表示已软删除(tombstone),用于多端同步:
--   - Web 端删除 skill 时设 deleted_at = NOW()(不物理删除)
--   - CLI pull 时若远端 deleted_at 不为空,删除本地文件
--   - CLI sync 时若本地不存在某 slug 但远端存在(未软删除),远端标记为 tombstone
-- 这样本地删文件 → sync → 远端软删除;Web 端删除 → sync → 本地删文件,双向闭环

ALTER TABLE "skills" ADD COLUMN "deleted_at" timestamp with time zone;

-- 索引:快速过滤活跃 skills(deleted_at IS NULL)
CREATE INDEX IF NOT EXISTS "skills_deleted_at_idx" ON "skills" ("deleted_at");
