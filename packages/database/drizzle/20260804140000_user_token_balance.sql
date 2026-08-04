-- 用户 Token 余额表(2026-08-04 补建)
-- 预先存在的 schema 缺口:apps/api 代码(agents.ts / miniapp-compat-routes.ts)直接 SQL 引用此表,
-- 但 TS schema 与 migration 从未定义,导致运行时 500 "关系 user_token_balance 不存在"。
-- 字段对齐代码中的 SQL 查询:user_uuid / balance / frozen_balance / updated_at。
CREATE TABLE IF NOT EXISTS "user_token_balance" (
    "user_uuid" VARCHAR(64) PRIMARY KEY,
    "balance" NUMERIC(20, 4) NOT NULL DEFAULT 0,
    "frozen_balance" NUMERIC(20, 4) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
