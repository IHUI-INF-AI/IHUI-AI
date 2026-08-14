-- F5 dead-migration 处置(2026-08-15):DROP 遗留孤立表 audit_chain_entries
--
-- 背景:
--   audit_chain_entries 由 0043_neat_the_spike.sql 创建,是早期审计链表实现。
--   现已被 packages/database/src/schema/audit-chain.ts 的 audit_logs_chain 表取代
--   (字段更完整:加入 user_id/action/resource_type/result 等,prev_hash/current_hash 命名一致)。
--   全局 grep 确认 audit_chain_entries 无任何 TS / Python / SQL 代码引用(grep 全仓仅命中本
--   migration 与 drizzle meta snapshot),属遗留孤立表。
--
-- 处置:补 DROP migration,消除 check-db-schema-drift 的 dead migration 告警。
--   使用 IF EXISTS + CASCADE,幂等安全;仅在 drizzle-kit migrate 执行时真正落库。
--
-- 执行方式(与项目 20260722* 系列手写 migration 一致):
--   pnpm tsx packages/database/scripts/apply-migration.mjs drizzle/20260815000000_drop_audit_chain_entries.sql
-- 或直接 psql:
--   psql "$DATABASE_URL" -f packages/database/drizzle/20260815000000_drop_audit_chain_entries.sql

DROP TABLE IF EXISTS "audit_chain_entries" CASCADE;
