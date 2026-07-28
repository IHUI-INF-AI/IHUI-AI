-- P0-2a VIP levelValue 4 档扩展 + 配额字段(2026-07-28 立)
-- 扩展 vip_levels 表,为每个档位增加配额默认值:
--   1. ai_budget_defaults  jsonb  — 该档位默认 AI 预算(dailyTokenLimit/monthlyTokenLimit/dailyCostLimit/monthlyCostLimit)
--   2. api_qps             int    — API 每秒查询限制(默认 10,0=不限)
--   3. max_concurrency     int    — 最大并发请求数(默认 3,0=不限)
--   4. model_whitelist     jsonb  — 允许的模型 ID 数组(null=全部允许,[]=无权限)
--
-- levelValue 语义变更(无需 DDL,integer 列不变):
--   旧: 0=普通 1=VIP 2=操盘手
--   新: 0=免费 1=个人 2=团队 3=企业
--   注:levelValue=3 的记录由 seed 数据或运营后台创建,本 migration 不插入数据。
--
-- 幂等:全部使用 IF NOT EXISTS,可安全重复执行。
--
-- 执行方式:
--   pnpm tsx packages/database/scripts/apply-migration.mjs drizzle/20260728120000_vip_levels_quota_fields.sql
-- 或直接 psql:
--   psql "$DATABASE_URL" -f packages/database/drizzle/20260728120000_vip_levels_quota_fields.sql

-- 1. ai_budget_defaults:默认 AI 预算(免费档:10 万 token/日,100 万 token/月)
ALTER TABLE "vip_levels" ADD COLUMN IF NOT EXISTS "ai_budget_defaults" jsonb NOT NULL DEFAULT '{"dailyTokenLimit":100000,"monthlyTokenLimit":1000000,"dailyCostLimit":"10","monthlyCostLimit":"100"}';

-- 2. api_qps:API 每秒查询限制(默认 10)
ALTER TABLE "vip_levels" ADD COLUMN IF NOT EXISTS "api_qps" integer NOT NULL DEFAULT 10;

-- 3. max_concurrency:最大并发请求数(默认 3)
ALTER TABLE "vip_levels" ADD COLUMN IF NOT EXISTS "max_concurrency" integer NOT NULL DEFAULT 3;

-- 4. model_whitelist:允许的模型 ID 数组(null=全部允许)
ALTER TABLE "vip_levels" ADD COLUMN IF NOT EXISTS "model_whitelist" jsonb;
