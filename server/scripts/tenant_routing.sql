-- =============================================================================
-- 多租户 schema 路由 SQL 脚本
-- =============================================================================
-- 策略: 一个 database + 多个 schema, 通过 search_path 隔离租户数据
-- 应用层: tenant_routing.py 根据请求头 X-Tenant-Id 切换 search_path
-- 配合: pgBouncer pool_mode=session (支持 SET search_path)
-- =============================================================================

-- 1. 创建主租户 schema (示例 3 个租户)
CREATE SCHEMA IF NOT EXISTS tenant_zhs;
CREATE SCHEMA IF NOT EXISTS tenant_demo;
CREATE SCHEMA IF NOT EXISTS tenant_test;

COMMENT ON SCHEMA tenant_zhs IS 'ZHS 业务主租户';
COMMENT ON SCHEMA tenant_demo IS '演示租户';
COMMENT ON SCHEMA tenant_test IS '测试租户';

-- 2. 创建共享 schema (跨租户数据)
CREATE SCHEMA IF NOT EXISTS shared;

COMMENT ON SCHEMA shared IS '跨租户共享数据 (用户表 / 配置表)';

-- 3. 租户路由辅助函数: 根据 tenant_id 设置 search_path
CREATE OR REPLACE FUNCTION set_tenant_search_path(p_tenant_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_schema TEXT;
BEGIN
    -- 校验租户 ID 格式 (只允许字母数字下划线)
    IF p_tenant_id !~ '^[a-zA-Z0-9_]{1,64}$' THEN
        RAISE EXCEPTION 'Invalid tenant_id: %', p_tenant_id;
    END IF;

    v_schema := 'tenant_' || p_tenant_id;

    -- 检查 schema 是否存在
    IF NOT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = v_schema) THEN
        RAISE EXCEPTION 'Tenant schema not found: %', v_schema;
    END IF;

    -- 设置 search_path (租户 schema 优先, 共享 schema 兜底)
    EXECUTE format('SET search_path TO %I, shared, public', v_schema);
END;
$$;

COMMENT ON FUNCTION set_tenant_search_path(TEXT) IS '根据租户 ID 设置 search_path, 隔离租户数据';

-- 4. 租户路由视图: 列出所有租户
CREATE OR REPLACE VIEW v_tenants AS
SELECT
    schema_name AS tenant_id,
    schema_owner,
    CASE
        WHEN schema_name = 'tenant_zhs' THEN 'production'
        WHEN schema_name = 'tenant_demo' THEN 'demo'
        WHEN schema_name = 'tenant_test' THEN 'test'
        ELSE 'custom'
    END AS tier
FROM information_schema.schemata
WHERE schema_name LIKE 'tenant_%';

COMMENT ON VIEW v_tenants IS '租户清单视图';

-- 5. 共享表: 跨租户用户表 (放置在 shared schema)
CREATE TABLE IF NOT EXISTS shared.users (
    id BIGSERIAL PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    username TEXT NOT NULL,
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, username)
);

CREATE INDEX IF NOT EXISTS idx_shared_users_tenant ON shared.users(tenant_id);

COMMENT ON TABLE shared.users IS '跨租户用户表 (按 tenant_id 分片)';

-- 6. 审计表: 记录租户路由日志
CREATE TABLE IF NOT EXISTS shared.tenant_audit (
    id BIGSERIAL PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    action TEXT NOT NULL,
    schema_name TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_audit_tenant_ts ON shared.tenant_audit(tenant_id, timestamp DESC);

COMMENT ON TABLE shared.tenant_audit IS '租户路由审计日志';

-- 7. 租户健康检查函数
CREATE OR REPLACE FUNCTION check_tenant_health(p_tenant_id TEXT)
RETURNS TABLE (
    tenant_id TEXT,
    schema_name TEXT,
    table_count INT,
    function_count INT,
    health_status TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_schema TEXT;
    v_table_count INT;
    v_func_count INT;
    v_status TEXT;
BEGIN
    v_schema := 'tenant_' || p_tenant_id;

    -- 检查 schema
    IF NOT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = v_schema) THEN
        RETURN QUERY SELECT p_tenant_id, v_schema, 0, 0, 'missing'::TEXT;
        RETURN;
    END IF;

    -- 统计表数量
    SELECT COUNT(*) INTO v_table_count
    FROM information_schema.tables
    WHERE table_schema = v_schema;

    -- 统计函数数量
    SELECT COUNT(*) INTO v_func_count
    FROM information_schema.routines
    WHERE routine_schema = v_schema;

    -- 判断健康状态
    IF v_table_count = 0 THEN
        v_status := 'empty';
    ELSIF v_table_count < 5 THEN
        v_status := 'warning';
    ELSE
        v_status := 'healthy';
    END IF;

    RETURN QUERY SELECT p_tenant_id, v_schema, v_table_count, v_func_count, v_status;
END;
$$;

COMMENT ON FUNCTION check_tenant_health(TEXT) IS '检查单个租户健康状态';

-- 8. 批量健康检查
CREATE OR REPLACE VIEW v_tenant_health AS
SELECT
    t.tenant_id,
    t.schema_name,
    COALESCE(h.table_count, 0) AS table_count,
    COALESCE(h.function_count, 0) AS function_count,
    COALESCE(h.health_status, 'unknown') AS health_status
FROM v_tenants t
LEFT JOIN LATERAL check_tenant_health(t.tenant_id) h ON TRUE;

COMMENT ON VIEW v_tenant_health IS '所有租户健康状态';

-- 9. 示例租户表 (在 tenant_zhs 中)
CREATE TABLE IF NOT EXISTS tenant_zhs.orders (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zhs_orders_user ON tenant_zhs.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_zhs_orders_status ON tenant_zhs.orders(status);

COMMENT ON TABLE tenant_zhs.orders IS 'ZHS 租户订单表';

-- 10. 初始化审计日志
INSERT INTO shared.tenant_audit (tenant_id, action, schema_name)
VALUES
    ('zhs', 'init', 'tenant_zhs'),
    ('demo', 'init', 'tenant_demo'),
    ('test', 'init', 'tenant_test')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 完成
-- =============================================================================
-- 应用层使用方式:
--   1. 请求头 X-Tenant-Id: zhs
--   2. tenant_routing.py 调用: SELECT set_tenant_search_path('zhs');
--   3. 后续 SQL 自动在 tenant_zhs schema 中执行
--   4. 跨租户查询: SELECT * FROM shared.users WHERE tenant_id = 'zhs';
-- =============================================================================
