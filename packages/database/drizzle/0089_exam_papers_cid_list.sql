-- 补齐 exam_papers 表缺失的 cid_list 字段(jsonb)
-- 对应 schema: packages/database/src/schema/exam.ts examPapers.cidList
-- 注:0087_nosy_gateway.sql / 0088_jazzy_speed_demon.sql 已添加此列,本 migration 为幂等补齐(journal 引用)
ALTER TABLE "exam_papers"
  ADD COLUMN IF NOT EXISTS "cid_list" jsonb;
