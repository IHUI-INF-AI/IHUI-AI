-- ============================================================================
-- Stage7: ai_careers 表新增 5 字段 + resources 表新增 price 字段
--
-- 背景:
--   - schema 代码已定义字段(packages/database/src/schema/ai-modules.ts aiCareers 表
--     和 resource.ts resources 表),但 drizzle-kit generate 因 0131_snapshot.json
--     元数据腐败无法生成 migration,改用手写 SQL。
--   - 沿用项目 20260722* 系列手写 migration 约定,不修改 _journal.json。
--   - IF NOT EXISTS 幂等设计,重复执行无副作用。
-- 验证:
--   - pnpm --filter @ihui/database typecheck exit 0
--   - pnpm tsx scripts/apply-migration.mjs drizzle/20260728130000_stage7_ai_careers_resources_fields.sql
-- ============================================================================

-- ============================================================================
-- 1. ai_careers 表新增 5 字段(category/tags/experience/education/requirements)
-- ============================================================================
ALTER TABLE "ai_careers"
  ADD COLUMN IF NOT EXISTS "category" varchar(50),
  ADD COLUMN IF NOT EXISTS "tags" jsonb,
  ADD COLUMN IF NOT EXISTS "experience" varchar(50),
  ADD COLUMN IF NOT EXISTS "education" varchar(50),
  ADD COLUMN IF NOT EXISTS "requirements" jsonb;

-- ============================================================================
-- 2. resources 表新增 price 字段(NULL = 免费)
-- ============================================================================
ALTER TABLE "resources"
  ADD COLUMN IF NOT EXISTS "price" numeric(10, 2);
