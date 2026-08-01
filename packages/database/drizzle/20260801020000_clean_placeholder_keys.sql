-- H7(Phase D):清理占位符 key,避免覆盖 .env 真实配置
-- 日期:2026-08-01
-- 设计目标:ai_model_config 表中存在占位符 key(如 <your-key> / sk-placeholder / 空字符串 / NULL),
-- 这些占位符在 _resolve_from_db 解密后会覆盖 .env 中的真实 key,导致 LLM 调用 401。
-- 本 migration 把占位符 key 的记录 enabled=false,并在 _resolve_from_db 加运行时检测双保险。
--
-- 触发条件:api_key_enc LIKE '<%' (如 <your-key>) 或 LIKE 'sk-placeholder%' 或 IS NULL 或 = ''
-- 安全策略:只 UPDATE enabled + updated_at,不删除数据(管理员可重新配置 key 后 enabled=true)
--
-- 执行方式(与项目 20260722* 系列手写 migration 一致,不登记到 _journal.json):
--   pnpm tsx packages/database/scripts/apply-migration.mjs drizzle/20260801020000_clean_placeholder_keys.sql
-- 或直接 psql:
--   psql "$DATABASE_URL" -f packages/database/drizzle/20260801020000_clean_placeholder_keys.sql

-- =============================================================================
-- 1. 把占位符 key 的记录 enabled=false(不删除,管理员可重新配置后 enabled=true)
-- =============================================================================
UPDATE "ai_model_config"
SET "enabled" = false,
    "updated_at" = NOW()
WHERE "api_key_enc" IS NULL
   OR "api_key_enc" = ''
   OR "api_key_enc" LIKE '<%'
   OR "api_key_enc" LIKE 'sk-placeholder%';

-- =============================================================================
-- 2. 加表注释(说明占位符 key 规则,COMMENT ON TABLE 幂等可重复执行)
-- =============================================================================
COMMENT ON TABLE "ai_model_config" IS 'AI 模型配置表(H7:占位符 key 自动 enabled=false,不覆盖 .env)';
