-- P0 索引补全(2026-07-27 立,技术债批次 4)
-- 补齐高频查询表的索引,消除全表扫描:
--   1. search_history.userId        — 用户查询历史回放(每用户 N 条)
--   2. token_flows(userId, createdAt) — 用户流水查询(分页 + 时间范围)
--   3. refresh_tokens.userId         — revokeAllUserRefreshTokens(userId) 登出/封禁
--   4. refresh_tokens.familyId       — revokeRefreshTokenFamily(familyId) 重放检测
--   5. refresh_tokens.expiresAt      — 过期 token 定时清理任务
--
-- audit_logs 索引已在 migration 0060(R70 分区表)创建,本 migration 不重复。
-- 幂等:全部使用 IF NOT EXISTS,可安全重复执行。
--
-- 执行方式:
--   pnpm tsx packages/database/scripts/apply-migration.mjs drizzle/20260727120000_p0_indexes.sql
-- 或直接 psql:
--   psql "$DATABASE_URL" -f packages/database/drizzle/20260727120000_p0_indexes.sql

-- search_history:用户查询历史(userId 高频过滤)
CREATE INDEX IF NOT EXISTS "search_history_user_idx" ON "search_history" ("user_id");

-- token_flows:用户流水查询(userId + createdAt 范围,分页场景)
CREATE INDEX IF NOT EXISTS "token_flows_user_created_idx" ON "token_flows" ("user_id", "created_at");

-- refresh_tokens:撤销用户所有 token(登出/封禁/密码重置)
CREATE INDEX IF NOT EXISTS "refresh_tokens_user_idx" ON "refresh_tokens" ("user_id");
-- refresh_tokens:撤销 token family(重放检测,token 窃取时整族作废)
CREATE INDEX IF NOT EXISTS "refresh_tokens_family_idx" ON "refresh_tokens" ("family_id");
-- refresh_tokens:过期 token 定时清理任务扫描
CREATE INDEX IF NOT EXISTS "refresh_tokens_expires_idx" ON "refresh_tokens" ("expires_at");
