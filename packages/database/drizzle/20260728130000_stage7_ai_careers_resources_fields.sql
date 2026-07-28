-- 阶段7 schema 字段补齐 migration(2026-07-28 立)
-- 1. ai_careers 表新增 5 字段(category/tags/experience/education/requirements)
-- 2. resources 表新增 price 字段
--
-- 配套:
--   - packages/database/src/schema/ai-modules.ts(aiCareers 表定义)
--   - packages/database/src/schema/resource.ts(resources 表定义)
--   - packages/api-client/src/endpoints/ai.ts(AiCareerItem 类型显式化)
--   - packages/api-client/src/endpoints/resource.ts(Resource 类型显式化)
--   - apps/mobile-rn/src/screens/RecruitmentScreen.tsx(TABS 真实 category 筛选)
--   - apps/mobile-rn/src/screens/LiveHostScreen.tsx(强类型 price 字段)
--
-- 说明:db:generate 自 idx 128 起因 snapshot 缺失无法非交互运行(详见 _journal.json),
--       本 migration 沿用项目 20260722* 系列手写 SQL 约定(IF NOT EXISTS 幂等),
--       不修改 _journal.json。
--
-- 执行方式(与项目 20260722* 系列手写 migration 一致):
--   pnpm tsx packages/database/scripts/apply-migration.mjs drizzle/20260728130000_stage7_ai_careers_resources_fields.sql
-- 或直接 psql:
--   psql "$DATABASE_URL" -f packages/database/drizzle/20260728130000_stage7_ai_careers_resources_fields.sql

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
