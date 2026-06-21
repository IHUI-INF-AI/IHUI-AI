-- ZHS Platform Staging PG 初始化 (建议 114)
-- 在 PG 容器首次启动时自动执行, 建多租户基础 schema + 元数据表
-- (业务表 schema 改造由 alembic 005/006/007 完成)

-- 1. 默认租户 schema (历史 tenant_id=1, 单租户模式迁移期使用)
CREATE SCHEMA IF NOT EXISTS tenant_1;

-- 2. 多租户元数据表 (与 alembic 005 同步, 用于 PG 才生效)
CREATE TABLE IF NOT EXISTS public.admin_tenant (
    id          BIGSERIAL PRIMARY KEY,
    tenant_code VARCHAR(64)  NOT NULL UNIQUE,
    tenant_name VARCHAR(200) NOT NULL,
    schema_name VARCHAR(64)  NOT NULL UNIQUE,
    status      INTEGER      NOT NULL DEFAULT 1,  -- 0=disabled, 1=active
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. 种子数据: 默认租户 (id=1)
INSERT INTO public.admin_tenant (id, tenant_code, tenant_name, schema_name, status)
VALUES (1, 'default', 'Default Tenant (historical)', 'tenant_1', 1)
ON CONFLICT (id) DO NOTHING;

-- 4. 给 zhs 用户授权
GRANT ALL ON SCHEMA public     TO zhs;
GRANT ALL ON SCHEMA tenant_1   TO zhs;
GRANT ALL ON ALL TABLES    IN SCHEMA public   TO zhs;
GRANT ALL ON ALL TABLES    IN SCHEMA tenant_1 TO zhs;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public   TO zhs;
GRANT ALL ON ALL SEQUENCES IN SCHEMA tenant_1 TO zhs;

-- 5. 让后续在 public 创建的表默认走 tenant_1 (可选, 业务侧用 search_path 动态切)
-- ALTER ROLE zhs IN DATABASE zhs_platform SET search_path = tenant_1, public;
