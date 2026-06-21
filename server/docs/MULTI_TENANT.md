# 多租户 PG Schema 隔离使用指南

## 架构概览

```
┌─────────────────────────────────────────────┐
│           PostgreSQL Database               │
├─────────────────────────────────────────────┤
│ Schema: public (公共表)                      │
│   - sys_config                              │
│   - hot_config                              │
│   - alembic_version                         │
├─────────────────────────────────────────────┤
│ Schema: tenant_1 (默认租户)                 │
│   - users, products, orders, ...            │
│   - 87 张业务表                             │
├─────────────────────────────────────────────┤
│ Schema: tenant_2 (租户 2)                   │
│   - users, products, orders, ...            │
│   - 87 张业务表 (完全独立)                  │
├─────────────────────────────────────────────┤
│ Schema: tenant_N (租户 N)                   │
│   - 独立数据完全隔离                         │
└─────────────────────────────────────────────┘
```

## 单租户模式 (默认, 已上线)

`.env`:
```bash
MULTI_TENANT_ENABLED=false
DB1_URL=postgresql+psycopg2://zhs:zhs_pg_pass@pg-host:5432/zhs_platform
```

行为:
- 所有数据在 `public` schema
- 业务无感知, 100% 兼容历史代码
- 性能最优, 无 ContextVar 开销

## 多租户模式 (开启步骤)

### 1. 修改 .env

```bash
MULTI_TENANT_ENABLED=true
```

### 2. 重启服务

```bash
docker compose restart api
```

### 3. 初始化默认租户 schema (tenant_1)

```bash
docker compose exec api python -c "
from app.tenant_demo import init_tenant_schema
init_tenant_schema(1)
"
```

输出:
```
[INFO] Initializing tenant schema: tenant_1
[OK] Tenant schema tenant_1 initialized
```

### 4. 业务模型迁移 (已自动完成)

所有继承 `TenantBase` 的业务模型已声明 `__tenant_schema__ = "contextvar"`, 无需修改。

### 5. 新建租户

```bash
# 创建 tenant_2 schema + 全部 87 张私有表
docker compose exec api python -c "
from app.tenant_demo import init_tenant_schema
init_tenant_schema(2)
"

# 验证
docker compose exec postgres psql -U zhs -d zhs_platform -c "\dn"
# 预期输出: public, tenant_1, tenant_2
```

### 6. 在请求中切换租户

#### 方式 A: JWT 中带 tid (推荐)

```python
# 登录时生成 token, payload 中带 tid
token = jwt.encode({
    "sub": user_uuid,
    "tid": user.tenant_id,  # 租户 ID
    "exp": expires_at
}, settings.JWT_SECRET)
```

中间件自动从 JWT 解析 tid, 写入 ContextVar, SQLAlchemy 自动切 schema:

```python
# app/middleware/tenant_middleware.py
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.tenant import set_current_tenant_id, reset_current_tenant_id
from app.config import settings
import jwt

class TenantMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if not settings.MULTI_TENANT_ENABLED:
            return await call_next(request)
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            try:
                payload = jwt.decode(auth[7:], settings.JWT_SECRET, algorithms=["HS256"])
                tid = payload.get("tid")
                if tid is not None:
                    set_current_tenant_id(int(tid))
            except Exception:
                pass
        try:
            return await call_next(request)
        finally:
            reset_current_tenant_id()
```

注册中间件 (在 `app/main.py`):

```python
from app.middleware.tenant_middleware import TenantMiddleware
app.add_middleware(TenantMiddleware)
```

#### 方式 B: Header 切换 (管理后台用)

```python
# 在 API 路由中手动设置
@router.post("/admin/switch-tenant")
async def switch_tenant(tid: int, request: Request):
    set_current_tenant_id(tid)
    return {"status": "ok", "schema": get_tenant_schema_name(tid)}
```

## 数据隔离验证

```bash
# 租户 1 插入数据
docker compose exec api python -c "
import asyncio
from app.core.tenant import set_current_tenant_id
from app.database import get_session
from app.models.user_models import User
set_current_tenant_id(1)
with get_session() as db:
    db.add(User(uuid='u1_tenant1', email='user1@tenant1.com'))
    db.commit()
"

# 切到租户 2, 查询应为空
docker compose exec api python -c "
import asyncio
from app.core.tenant import set_current_tenant_id
from app.database import get_session
from app.models.user_models import User
set_current_tenant_id(2)
with get_session() as db:
    users = db.query(User).all()
    print(f'租户 2 的用户数: {len(users)}')  # 预期: 0
"

# 验证
docker compose exec postgres psql -U zhs -d zhs_platform -c "
SELECT schemaname, COUNT(*) FROM pg_tables
WHERE schemaname LIKE 'tenant_%'
GROUP BY schemaname;
"
# 预期: tenant_1: 87 | tenant_2: 87
```

## 删除租户 (DANGER)

```bash
# 删除 tenant_2 的所有数据 (不可恢复!)
docker compose exec api python -c "
from app.tenant_demo import drop_tenant_schema
drop_tenant_schema(2)
"
```

## 监控

```sql
-- 所有租户的表数量
SELECT schemaname, COUNT(*)
FROM pg_tables
WHERE schemaname LIKE 'tenant_%'
GROUP BY schemaname
ORDER BY schemaname;

-- 所有租户的体积
SELECT schemaname,
       pg_size_pretty(SUM(pg_total_relation_size(schemaname || '.' || tablename)))
FROM pg_tables
WHERE schemaname LIKE 'tenant_%'
GROUP BY schemaname;
```

## 性能优化

- 每租户一个 connection pool: 业务量大时可考虑分租户
- 索引: 公共索引按 tenant_id 隔离
- vacuum: 定期 vacuum 释放死元组

## 紧急回滚

```bash
# 关闭多租户
sed -i 's/^MULTI_TENANT_ENABLED=.*/MULTI_TENANT_ENABLED=false/' .env
docker compose restart api

# 业务回到 public schema, 数据完全保留
```
