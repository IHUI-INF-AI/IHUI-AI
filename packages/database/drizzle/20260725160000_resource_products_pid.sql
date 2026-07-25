-- resource_products 树形分类 pid 列 migration(2026-07-25 立)
-- 为 resource_products 表增加 pid 自引用列,支持产品树形分类(根节点 pid = NULL)。
-- 配套前端 product-categories 模块 + 后端 GET /api/admin/resources/products/tree 路由。
--
-- 设计:
--   pid uuid REFERENCES resource_products(id) ON DELETE SET NULL
--   - 父产品被删除时,子产品 pid 置 NULL(变为根节点),不级联删除
--   - 与 resource_tags.pid / resource_categories.pid 保持一致
--
-- 说明:db:generate 自 idx 128 起因 snapshot 缺失无法非交互运行(详见 _journal.json),
--       本 migration 沿用项目 20260722* 系列手写 SQL 约定(IF NOT EXISTS 幂等),
--       不修改 _journal.json。
--
-- 执行方式(与项目 20260722* 系列手写 migration 一致):
--   pnpm tsx packages/database/scripts/apply-migration.mjs drizzle/20260725160000_resource_products_pid.sql
-- 或直接 psql:
--   psql "$DATABASE_URL" -f packages/database/drizzle/20260725160000_resource_products_pid.sql

-- ============================================================================
-- 1. resource_products 增加 pid 列(自引用,根节点 NULL)
-- ============================================================================
ALTER TABLE "resource_products"
  ADD COLUMN IF NOT EXISTS "pid" uuid REFERENCES "resource_products"("id") ON DELETE SET NULL;

-- pid 索引:查询子产品列表(按 pid 过滤)
CREATE INDEX IF NOT EXISTS "resource_products_pid_idx"
  ON "resource_products" ("pid");
