-- resource_tags 表新增 pid 字段,支持标签树形结构(自引用,父标签删除时置 NULL)
-- 注意:resource_tags.id 为 uuid 类型,故 pid 也用 uuid(与 resource_categories.pid 一致)
-- 对应 schema: packages/database/src/schema/resource.ts resourceTags.pid
ALTER TABLE "resource_tags"
  ADD COLUMN IF NOT EXISTS "pid" uuid REFERENCES "resource_tags"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "resource_tags_pid_idx" ON "resource_tags" ("pid");
