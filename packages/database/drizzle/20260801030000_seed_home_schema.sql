-- P3-4.3 Server-Driven UI:种子默认首页 schema 配置
-- 日期:2026-08-01
-- 设计目标:在 system_configs 表插入 key='home_schema' 的公开配置,
-- 存储首页 7-section 的 JSON schema(顺序 + 显隐),admin 可通过 /api/admin/configs 编辑,
-- 前端营销页(/)与工作区首页(/home)通过 GET /api/configs 加载并驱动渲染。
--
-- 幂等:ON CONFLICT (key) DO NOTHING — 仅在不存在时插入默认值,不覆盖 admin 已做的自定义配置。
--
-- 执行方式(与项目 20260722* 系列手写 migration 一致,不登记到 _journal.json):
--   pnpm tsx packages/database/scripts/apply-migration.mjs drizzle/20260801030000_seed_home_schema.sql
-- 或直接 psql:
--   psql "$DATABASE_URL" -f packages/database/drizzle/20260801030000_seed_home_schema.sql

INSERT INTO "system_configs" ("key", "value", "type", "category", "description", "is_public")
VALUES (
  'home_schema',
  '{"version":"1.0.0","sections":[{"id":"page-1-hero","component":"hero","enabled":true},{"id":"page-2-features","component":"featureGrid","enabled":true},{"id":"page-3-scenarios","component":"scenarios","enabled":true},{"id":"page-4-roi","component":"roi","enabled":true},{"id":"page-5-comparison","component":"comparison","enabled":true},{"id":"page-6-pricing","component":"pricing","enabled":true},{"id":"page-7-magazine","component":"magazine","enabled":true}]}',
  'json',
  'home_schema',
  '首页/营销页 section schema(Server-Driven UI):控制 7 个 section 的渲染顺序与显隐。编辑后前端自动加载,无需改代码。',
  true
)
ON CONFLICT ("key") DO NOTHING;
