-- 0079: circles 表增加 cid_list 字段(jsonb 数组,分类树多选)
-- 用于 CircleDialog 的 cidList 分类树 cascader(多选分类 ID 列表)
-- 兼容旧项目 cidList 字段,与 categoryId(单值)并存
ALTER TABLE "circles" ADD COLUMN IF NOT EXISTS "cid_list" jsonb;
