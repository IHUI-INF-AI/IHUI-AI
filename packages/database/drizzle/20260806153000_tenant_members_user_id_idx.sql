-- tenant_members 按 user_id 反查索引(2026-08-06)
-- 背景:recordAiCost 自动解析租户归属时按 user_id 查 tenant_members,
-- 原联合唯一索引 (tenant_id, user_id) 最左前缀是 tenant_id,按 user_id 查询无法利用,
-- 需独立 user_id 索引(成本归集/配额聚合高频路径,tenant_members 行数随租户增长)。
CREATE INDEX IF NOT EXISTS "tenant_members_user_id_idx"
  ON "tenant_members" ("user_id");
