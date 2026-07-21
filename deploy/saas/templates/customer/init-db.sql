-- 客户租户数据库初始化(由 init-db.sql 在 PostgreSQL 首次启动时执行)
-- 完整的 IHUI-AI schema 由 API 容器启动时的 migrate 任务自动创建
-- 此脚本仅做基础准备:

-- 启用常用扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 记录创建信息(便于运维审计)
CREATE TABLE IF NOT EXISTS _saas_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO _saas_metadata (key, value) VALUES
    ('saas_customer_slug', current_setting('app.customer_slug', true)),
    ('saas_created_at', NOW()::TEXT),
    ('saas_platform_version', '1.0.0')
ON CONFLICT (key) DO NOTHING;
