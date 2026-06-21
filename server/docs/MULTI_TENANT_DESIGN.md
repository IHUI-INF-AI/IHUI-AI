# ZHS Platform 多租户改造设计 (方案 B: PostgreSQL Schema 隔离)

> 文档版本: v0.2 (2026-06-13)
> 状态: **设计阶段**, 阶段 1 基础设施已开工
> 决策: 用户已拍板 (2026-06-13)
> - 隔离方案: **B: PostgreSQL Schema 隔离 (真迁 PG)**
> - 历史数据: **tenant_id 全部填 1**
> - 上线节奏: **影子流量灰度**

---

## 0. 决策记录 (2026-06-13)

| 决策点 | 选择 | 影响 |
|--------|------|------|
| 隔离方案 | B (PG Schema 隔离) | 已完成 MySQL → PG 迁移 (历史 1-2 周) |
| 历史数据 tenant_id | 1 (default tenant) | alembic backfill + 索引 |
| 上线节奏 | 影子流量灰度 | 阶段 5 跑通, 风险最低 |

---

## 1. 背景与目标

### 1.1 业务背景

ZHS Platform 当前是**单租户架构**：
- 数据库按业务域拆分（ai / center / course 三个独立 PostgreSQL 实例，已从 MySQL 迁移）
- 同一实例只服务一个企业客户
- 跨租户共享数据无场景（认证用单一 `sys_user` 表）

随着业务发展，出现两类客户：
- **A 类**：需要独立部署（合规 / 性能隔离）
- **B 类**：可接受共享实例但要求**数据强隔离**（SaaS 模式）

目标：在不破坏现有单租户部署的前提下，**逐步支持 B 类共享模式**，使同一 FastAPI 进程能服务多个企业客户。

### 1.2 核心诉求

| 诉求 | 必须 | 可选 |
|------|------|------|
| 租户级数据强隔离 (schema 物理隔离) | ✅ | |
| API 层透明（业务代码最少改动） | ✅ | |
| 单租户模式可继续运行（向后兼容） | ✅ | |
| 跨租户数据汇总（运维 dashboard） | | ✅ |
| 租户级限流 / 配额 | | ✅ |
| 租户级 trace_id 串联 | | ✅ |

---

## 2. 方案 B 详细设计 (PG Schema 隔离)

### 2.1 总体架构

```
┌────────────────────────────────────────┐
│  FastAPI 进程 (单租户模式 + 多租户模式) │
│  ┌──────────────────────────────────┐  │
│  │ TenantContextVar (ContextVar)   │  │ ← JWT 解出 tenant_id
│  │   set_current_tenant_id(tid)    │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │ TenantSessionRouter              │  │ ← SQLAlchemy event hook
│  │   before_cursor_execute()        │  │   动态切 search_path
│  │   SET search_path TO tenant_X,   │  │   "SET search_path TO {tid}, public"
│  │                    public         │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │ SQLAlchemy ORM Model             │  │
│  │   __table_args__ = {            │  │ ← Model 显式声明 schema
│  │     "schema": "tenant_1"        │  │   alembic 迁移时按 schema 分
│  │   }                              │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │ PostgreSQL 14+                  │  │ ← 一个 database (zhs_platform)
│  │   schemas: public + tenant_1 +   │  │   多个 schema, 物理隔离
│  │            tenant_2 ...          │  │
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘
```

**核心思想**：
- 一个 PostgreSQL database 内创建多个 schema（`tenant_1`, `tenant_2` ...）
- 每个 schema 拥有完整业务表（order / user / agent / course ...）
- 应用层在每次 query 前 `SET search_path TO {schema}, public`
- 跨租户物理隔离（任何漏过滤都走不到其他 schema）

### 2.2 数据模型

#### 2.2.1 公共 schema (`public`)

存放租户元数据 + 系统级表（跨租户共享）：

```sql
-- public 域: 跨租户共享
CREATE TABLE public.admin_tenant (
    id          BIGINT PRIMARY KEY,         -- 1, 2, 3 ...
    code        VARCHAR(64) UNIQUE NOT NULL, -- 'default', 'acme', 'globex'
    name        VARCHAR(128) NOT NULL,
    schema_name VARCHAR(64) UNIQUE NOT NULL, -- 'tenant_1', 'tenant_2'
    status      TINYINT DEFAULT 1,           -- 1=active, 0=disabled
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- public.admin_tenant_seed (default tenant=1)
INSERT INTO public.admin_tenant (id, code, name, schema_name, status)
VALUES (1, 'default', 'Default Tenant', 'tenant_1', 1);
```

#### 2.2.2 租户 schema (`tenant_{tid}`)

每个租户一份完整业务表（30+ 张）：

```sql
-- 在 alembic 中按 schema 生成:
-- 005_create_tenant_schema.py
--   for tid in [1, 2, ...]:
--       CREATE SCHEMA IF NOT EXISTS tenant_{tid};
--       CREATE TABLE tenant_{tid}.sys_user (...);
--       CREATE TABLE tenant_{tid}.t_order (...);
--       ... (约 30 张表, 复用单租户表结构)
```

**backfill 策略**：
- 阶段 2 第一步: 把现有 PostgreSQL 数据导出 (pg_dump / ETL)
- 第二步: PG 创建 `tenant_1` schema + 所有表
- 第三步: 用 pgloader / COPY 把数据导入
- 第四步: 单租户模式继续指向 `tenant_1` schema

### 2.3 上下文注入 (ContextVar)

```python
# app/core/tenant.py  (新建)
from contextvars import ContextVar
from typing import Optional, Set
import re

_current_tenant_id: ContextVar[Optional[int]] = ContextVar(
    "current_tenant_id", default=None
)

# 白名单: 允许 set 的 tenant_id (避免脏值污染 search_path)
_TENANT_ID_PATTERN = re.compile(r"^tenant_[1-9][0-9]{0,8}$")


def get_current_tenant_id() -> Optional[int]:
    """获取当前请求所属的 tenant_id.

    返回 None 表示系统调用 (后台任务 / Alembic / 管理脚本),
    此时不切 search_path, 走 public schema.
    """
    return _current_tenant_id.get()


def set_current_tenant_id(tid: Optional[int]) -> None:
    """在 FastAPI 依赖 / middleware 中调用, 写入 contextvar.

    None 表示重置 (后台任务入口).
    """
    if tid is not None and (not isinstance(tid, int) or tid < 1):
        raise ValueError(f"tenant_id 必须是正整数, 实际 {tid!r}")
    _current_tenant_id.set(tid)


def get_tenant_schema_name(tid: int) -> str:
    """tenant_id -> schema 名 (白名单防注入)."""
    name = f"tenant_{tid}"
    if not _TENANT_ID_PATTERN.match(name):
        raise ValueError(f"非法 tenant_id: {tid!r}")
    return name


def is_multi_tenant_enabled() -> bool:
    """从 settings 读开关, 单租户模式直接返回 False."""
    from app.config import settings
    return bool(getattr(settings, "MULTI_TENANT_ENABLED", False))
```

### 2.4 SQLAlchemy 动态 search_path 路由 (核心防御层)

```python
# app/core/tenant_filter.py  (新建, 建议 102 阶段 1)
"""SQLAlchemy before_cursor_execute 钩子, 动态切 search_path 到 tenant schema.

纵深防御:
  1. SQLAlchemy event hook (应用层强制, 本文件)
  2. PG schema 本身是物理隔离边界 (DB 层强制, 不需 RLS)
  3. ORM Model __table_args__["schema"] 显式声明 (设计层强制)
"""
from sqlalchemy import event

from app.core.tenant import (
    get_current_tenant_id,
    get_tenant_schema_name,
    is_multi_tenant_enabled,
)


def _set_search_path(conn, cursor, statement, parameters, context, executemany):
    """before_cursor_execute hook: 在每条 SQL 前 SET search_path.

    只在多租户模式 + 有 tenant_id 时切; 单租户模式 / 系统调用走 public.
    """
    if not is_multi_tenant_enabled():
        return  # 单租户模式, 不切
    tid = get_current_tenant_id()
    if tid is None:
        return  # 后台任务 / Alembic, 走 public
    schema = get_tenant_schema_name(tid)
    cursor.execute(f'SET LOCAL search_path TO "{schema}", public')


# 在 app.database.create_all_engines() 时一次性注册:
def register_tenant_routing(engine) -> None:
    """给 engine 注册 before_cursor_execute 钩子.

    单租户模式 (默认) 不注册, 行为与原 MySQL 时期一致 (历史: 迁移前为 MySQL, 现已全部走 PG).
    """
    if not is_multi_tenant_enabled():
        return
    event.listen(engine, "before_cursor_execute", _set_search_path)
```

**关键点**：
- `SET LOCAL search_path` 只在当前事务内生效, 事务结束自动恢复 — 防止跨租户污染
- 多租户未开启 / 无 tenant_id 时不切 — 与单租户模式 100% 向后兼容
- 白名单 regex 防 SQL 注入（即便 SQLAlchemy 已用 prepared statement）

### 2.5 ORM Model 升级

```python
# app/models/app_content_models.py  (示例)
# 原本:
class ZhsAgentBuy(Base):
    __tablename__ = "zhs_agent_buy"
    id = Column(BigInteger, primary_key=True)
    ...

# 阶段 2 之后:
class ZhsAgentBuy(Base):
    __tablename__ = "zhs_agent_buy"
    __table_args__ = (
        {"schema": "tenant_1"},  # default, 多租户时由 alembic 动态改
    )
    id = Column(BigInteger, primary_key=True)
    ...
```

**alembic 策略**：
- 阶段 1: 所有 Model 加 `__table_args__ = {"schema": "public"}` (PostgreSQL 标准)
- 阶段 2: alembic 迁移时按 tid 创建 `tenant_{tid}` schema, 用 `op.create_table(... schema=f"tenant_{tid}")`
- 阶段 3: ORM Model 的 schema 改为动态（通过 metaclass 或 model registry）

**简化路径**：阶段 1 阶段不立即改 ORM Model — 先把 routing 框架搭好，Model 改造放到阶段 2。

### 2.6 鉴权升级 (JWT 加 tenant_id)

```python
# app/security.py  (升级)
def create_access_token(user_uuid: str, expires_delta: timedelta, tenant_id: int = 1) -> str:
    """建议 102: JWT payload 加 tenant_id 字段.

    向后兼容: 单租户模式下 tenant_id 默认 1, 已存在 token 无需强制刷新.
    """
    encode = {
        "sub": user_uuid,
        "exp": datetime.utcnow() + expires_delta,
        "tenant_id": tenant_id,  # 新增
    }
    return jwt.encode(encode, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user_uuid(...):
    # 解 JWT
    payload = jwt.decode(...)
    tenant_id = payload.get("tenant_id", 1)  # 缺省 = 单租户模式 = 1
    # 注入到 ContextVar (后续 query 自动用 tenant_{1} schema)
    set_current_tenant_id(tenant_id)
    return payload.get("sub")
```

### 2.7 PG 迁移路径 (阶段 0: 数据库迁移)

**工作量**: 1-2 周

**步骤**:
1. **代码层 PG 兼容**:
   - 移除 MySQL 专有: `AUTO_INCREMENT` → `SERIAL` / `BIGSERIAL`
   - `TINYINT` → `SMALLINT`
   - `DATETIME` → `TIMESTAMP`
   - `VARCHAR(N) CHARSET utf8mb4` → `VARCHAR(N)`
   - 反引号 → 双引号（SQLAlchemy ORM 自动处理）
   - 测试: 启动 PG + 跑全套单测

2. **数据迁移**:
   ```bash
   # 旧 MySQL:
   mysqldump --no-create-info --skip-comments zhs_ai_project > data_ai.sql
   # 转 PG 兼容:
   pgloader mysql://... postgresql://...
   # 验证:
   psql -d zhs_platform -c "SELECT count(*) FROM tenant_1.t_order"
   ```

3. **回滚预案**:
   - 保留 PG 备份 30 天
   - `MULTI_TENANT_ENABLED=false` 走单租户 PG 路径（项目已完全迁移到 PG, 不再回退到 MySQL）
   - PG 出问题时切回单租户模式

### 2.8 监控维度

- Prometheus 指标加 `tenant` label
- 日志格式加 `tenant_id` 字段 (loguru 注入)
- 告警规则支持 `by (tenant)` 分组
- Grafana dashboard 加 tenant 筛选变量

---

## 3. 实施路线图 (5 阶段, 13 周)

### 阶段 0: PG 迁移 (2 周) ✅ 已完成
- [x] 代码层 MySQL → PG 兼容 (AUTO_INCREMENT / TINYINT / 反引号)
- [x] docker-compose 加 PG 14 服务
- [x] mysqldump → pgloader 迁移脚本
- [x] 单租户模式切 PG 验证 (无业务代码改动)
- [x] 回滚预案演练

### 阶段 1: 基础设施 (2 周) ← **本轮在做**
- [x] 用户决策拍板 (3 个点, 2026-06-13 完成)
- [x] 设计文档按 B 改写 (本文件 v0.2)
- [x] `app/core/tenant.py` ContextVar + 工具函数
- [x] `app/core/tenant_filter.py` SQLAlchemy search_path 钩子
- [x] `app/security.py` JWT payload 加 `tenant_id`
- [x] `public.admin_tenant` 表 + seed default tenant=1
- [x] `MULTI_TENANT_ENABLED` 配置开关
- [x] 单元测试: tenant 工具函数 / JWT 注入 / search_path 路由

### 阶段 2: 业务表迁移 (4 周)
- [ ] 30 张核心表加 schema 声明
- [ ] Alembic 自动生成 + 人工 review
- [ ] 创建 `tenant_1` schema + 复刻所有表结构
- [ ] 数据 backfill (pgloader)
- [ ] 单元测试: 跨租户数据不可见

### 阶段 3: API 层透明化 (3 周)
- [ ] FastAPI 依赖统一注入 tenant_id
- [ ] 所有 route 不显式接收 tenant_id (从 token 拿)
- [ ] WS 房间加 tenant 前缀
- [ ] 管理后台 API: 租户 CRUD / 启用停用

### 阶段 4: 运维增强 (2 周)
- [ ] Prometheus 指标加 tenant label
- [ ] Grafana dashboard 加筛选
- [ ] 告警规则按租户分组
- [ ] 日志注入 tenant_id
- [ ] OTel span attributes 加 tenant.id

### 阶段 5: 灰度上线 (1 周)
- [ ] 影子流量: 生产流量复制到多租户实例, 对比结果
- [ ] 单租户模式保留开关: `MULTI_TENANT_ENABLED=false`
- [ ] 逐步迁入 B 类客户

**总工期: ~14 周 (3.5 个月)**

---

## 4. 风险清单

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| PG 迁移期间数据丢失 | 🔴 高 | 30 天 PG 备份 + 影子流量比对 (历史: 迁移期间保留 MySQL 备份) |
| SQLAlchemy search_path 跨请求污染 | 🔴 中 | `SET LOCAL` (事务级) + ContextVar 隔离 + 单元测试 |
| 业务表 30 张改造遗漏 | 🟡 中 | alembic autogenerate + 跨租户不可见测试 |
| WebSocket 跨租户广播 | 🟡 中 | 房间名前缀强制 |
| 监控指标 cardinality 爆炸 | 🟡 中 | 限制租户数 ≤ 100, 超过按 region 聚合 |
| 性能 (search_path 切换开销) | 🟢 低 | PG connection pool + SET LOCAL 微秒级 |
| 灰度切流数据不一致 | 🟡 中 | 影子流量 7 天, 主从一致后才切 |

---

## 5. 暂未决定 (open questions)

- [ ] 租户级限流: 用 Redis 滑动窗口还是 token bucket?
- [ ] 跨租户数据汇总 dashboard: 是否做, 给谁看?
- [ ] 租户级密钥 (API key / JWT signing): 共享还是每租户独立?
- [ ] 删除租户: 软删 (status=0) 还是硬删 (GDPR 合规)?
- [ ] 跨租户管理员 (super admin) 鉴权: 用单独 role 表还是特殊 tenant_id=0?
- [ ] PG schema 数量上限: 100 / 1000 / 无限制?
- [ ] 租户级独立域名 (DNS + TLS) — 下一阶段

---

## 6. 不在本阶段做的事

- 租户级独立域名 (DNS + TLS) — 阶段 6
- 租户级独立计费 — 与财务系统集成后另立项目
- 租户级独立 CI/CD 流水线 — 暂用一套

---

## 7. 结论

**决策**: 方案 B (PG Schema 隔离) + 历史数据 tenant_id=1 + 影子流量灰度

**总工期**: 14 周, 5 阶段滚动

**当前阶段**: 阶段 1 基础设施 (已开工)

**下一动作**: 阶段 2 — 30 张业务表加 schema 声明 + alembic 迁移 + pgloader 数据 backfill
