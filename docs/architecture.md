# 系统架构文档

## 1. 技术栈

### 后端
- Framework: FastAPI + Uvicorn
- ORM: SQLAlchemy 2.0 (declarative_base + sessionmaker)
- DB: PostgreSQL (prod 默认) / SQLite (dev fallback, 需 `DB_ALLOW_SQLITE_FALLBACK=True`)
- 日志: loguru (JSON 格式输出到 `logs/app.jsonl`, 10MB 轮转 / 7 天保留)
- 认证: PyJWT (HS256)
- 监控: Prometheus (自研 `PrometheusMiddleware`) + OpenTelemetry APM (可选)
- 配置: pydantic-settings (`app/config.py`, `ENV` 环境变量切换 dev/prod)

### 前端
- Framework: Vue 3 + TypeScript
- 构建: Vite (esbuild 压缩, manualChunks 拆包)
- 状态: Pinia
- UI: Element Plus (按需引入) + Tailwind CSS
- 测试: Playwright (e2e/) + Vitest
- 端口: 统一 8888 (dev) / 4173 (preview), 配置集中在 `client/config/ports.ts`

## 2. 多 Engine 数据库架构

后端使用 3 个 SQLAlchemy engine 对应 3 个业务域 (`app/database.py`):

| Factory | Engine | 用途 | 环境变量 | 默认值 |
|---------|--------|------|----------|--------|
| SessionFactory1 | engine1 (ai) | AI 业务库 (agents/orders/activities/sys_*) | DB1_URL | postgresql+psycopg2://zhs:zhs_pg_pass@127.0.0.1:5432/zhs_platform |
| SessionFactory2 | engine2 (center) | Center 中心库 (users/auth/oauth) | DB2_URL | 同上 |
| SessionFactory3 | engine3 (course) | Course 课程库 (courses/videos/education) | DB3_URL | 同上 |

- 三个 engine 默认指向同一 PostgreSQL `zhs_platform` 库, 通过 `schema=public` 隔离业务域.
- `DB_ALLOW_SQLITE_FALLBACK=False` (默认严格模式): PG 不可用时直接抛 RuntimeError, 不降级.
- 允许降级时 (`=True`), dev/test 生成 `.zhs_db_fallback_{1,2,3}.sqlite` 本地文件.
- 智能路由: `get_engine_for_table(table_name)` 按 `AI_PROJECT_TABLES / CENTER_TABLES / COURSE_TABLES` 三张白名单把表路由到对应 engine.
- v2 业务端点 (agents/courses/order/admin) 额外用 `sqlite3` 标准库直查 `g:\IHUI-AI\server\data\zhs_dev.sqlite`, 绕过 SQLAlchemy `schema=public` 在 SQLite 上的不兼容问题.

## 3. API 路由架构

### v1 vs v2 共存
- `/api/v1/*` - 主业务路由 (文件名 `v1_*.py`, P0~P9 批次, ~1059+ 端点), 是当前唯一主线.
- `/api/v2/*` - P20 真业务路由 (`v2_agents / v2_courses / v2_order / v2_admin / v2_ws`, 92 端点), 用 SQLite 真数据查询.
- `/api/v3/*` - v3 聚合查询 (`v3_query.py`, 共享 httpx ASGITransport 客户端).
- `/api/v1/auth/login` 等认证端点由 `v1_auth.py` 提供.

v2 router 注册位于 `main.py` 721-735 行:
```python
from app.api.v2_admin import router as v2_admin_router
from app.api.v2_agents import router as v2_agents_router
from app.api.v2_courses import router as v2_courses_router
from app.api.v2_order import router as v2_order_router
app.include_router(v2_agents_router)
app.include_router(v2_courses_router)
app.include_router(v2_order_router)
app.include_router(v2_admin_router)
```

### Vite Proxy 配置 (实际)
**注意**: 历史 v1→v2 rewrite 已在 P18/P19 阶段物理删除, 当前 `/api/*` 直达后端, 不做路径改写. v1 与 v2 在后端共存, 前端按需调用.

`client/vite.config.ts` 关键 proxy 片段:
```typescript
// /admin -> /api/v1/admin (管理后台桥接)
'/admin': {
  target: BACKEND_TARGET,   // http://127.0.0.1:8000
  changeOrigin: true,
  rewrite: (path: string) => path.replace(/^\/admin/, '/api/v1/admin'),
},

// /api 兜底代理: 直连本地 Python FastAPI 后端, 不改写路径
'/api': {
  target: BACKEND_TARGET,
  changeOrigin: true,
  rewrite: (path: string) => path,
  bypass: (req: any) => {
    const url = req.url || ''
    if (url === '/api-test' || url.startsWith('/api-test/')) return url
    return null
  },
},
```

仍依赖 Java 后端 (bsm.aizhs.top) 的代理: `/auth`, `/login/pwd`, `/login/wechat`, `/prod-api`, `/ws`, `/socket.io`, `/system`, `/gen`, `/ai-program`, `/message`, `/tools`, `/content`, `/statistics`, `/api/developer`, `/api/openclaw`.

## 4. 数据层差异

### dev (SQLite)
- v2 业务端点用 `sqlite3` 标准库直查 `g:\IHUI-AI\server\data\zhs_dev.sqlite` (绕过 SQLAlchemy `schema=public` 不兼容).
- ORM engine 在严格模式下连 PG, 失败抛 RuntimeError; 允许降级时落到 `.zhs_db_fallback_*.sqlite`.
- 背景任务 (expiration_monitor / agent_sync 等) 通过 `_is_sqlite()` 检测静默跳过.
- 数据文件: `g:\IHUI-AI\server\data\zhs_dev.sqlite` (agents 表 12 行真数据).
- dev-up.ps1 默认 `ENV=development`, `RATE_LIMIT_DISABLED=1` (E2E 测试不限流).

### prod (PostgreSQL)
- SQLAlchemy ORM 完整功能, `schema=public` 多租户隔离.
- `MULTI_TENANT_ENABLED=True` 时注册 `search_path` 切换 hook (`_register_tenant_routing_if_enabled`).
- 背景任务正常执行, Redis 健康检查 fail-fast (`REDIS_HEALTHCHECK_FAIL`).
- CORS 强制具体域名, 禁止通配符 `*`.

## 5. 启动流程

`scripts/dev-up.ps1` 执行步骤:
1. **端口清理**: 清理 8000 (backend) / 8888 (frontend) / 18000 (已废弃) 端口, 调用 `Wait-Port.ps1` 等待释放 (Windows TIME_WAIT 60s).
2. **环境变量**: `RATE_LIMIT_DISABLED=1` (dev 限流旁路), `ENV=development`, `AUTO_CREATE_SCHEMA=1`; 生产环境断言禁止 `RATE_LIMIT_DISABLED=1`.
3. **可选服务**: `-WithRedis` 启动 Redis (6379), `-WithDB` 启动 PostgreSQL (5432).
4. **启动后端**: `python -m uvicorn app.main:app --host 127.0.0.1 --port 8000`, 日志输出到 `server/logs/uvicorn_dev_up.log`.
5. **健康检查**: `GET http://127.0.0.1:8000/api/health` 等待 200.
6. **启动前端**: `pnpm dev` / `npm dev` (port 8888), 日志输出到 `client/logs/vite_dev_up.log`.
7. **事件日志**: 全程写 `logs/dev-up-events.jsonl` (5MB 轮转, 保留 3 份), 可选 OpenTelemetry 旁路输出.

停机: `dev-up.ps1 -Down` 优雅停机 (SIGTERM/Ctrl+C, 5s 超时后强杀).

## 6. 测试架构

### 后端 pytest
- `server/tests/test_n_plus_one_detector.py` - N+1 查询检测器 (record/stats/batch_load).
- `server/tests/test_slow_sql_trace.py` - 慢 SQL 跟踪 (OTel trace_id 注入, SLOW_SQL_WITH_TRACE counter).
- `server/tests/test_auth.py` - 认证.
- `server/tests/test_agents.py`, `test_alerts.py`, `test_canary.py` - 业务/告警/灰度.
- CI: `backend-test` job 跑 `pytest tests/ -v --tb=short --cov=app`.

### 前端 Playwright
- `client/e2e/real-backend-integration.spec.ts` - 真联调.
- `client/e2e/auth-flow-integration.spec.ts` - 登录态联调.
- `client/e2e/client-server-integration.spec.ts` - 前后端联调.
- `client/e2e/websocket-integration.spec.ts` - WebSocket 联调.
- `client/e2e/style-verify.spec.ts` - 样式验证.
- CI: `playwright-e2e` job (依赖 backend-test + frontend-build + smoke-fast-gate).

## 7. 可观测性

### 日志
- `logs/uvicorn.log` - uvicorn 启动日志 (20MB 轮转, 14 天保留).
- `logs/app.jsonl` - 结构化 JSON 日志 (10MB 轮转, 7 天保留, zip 压缩), 便于 ELK/Loki 采集.
- `logs/dev-up-events.jsonl` - dev-up 启动事件流 (5MB 轮转, 3 份归档).
- `server/logs/uvicorn_dev_up.log` - dev-up 启动的后端 stdout.

### 健康检查 (`app/api/health.py`)
- `GET /health` - 综合健康 (兼容旧版).
- `GET /health/live` - Liveness (进程存活, 轻量, 不依赖 DB).
- `GET /health/ready` - Readiness (检查 engine1/2/3 + Redis 探针, 决定是否接流量).
- `GET /api/health` - 兼容性兜底 (dev-up.ps1 使用).

### 监控指标
- `GET /metrics` - Prometheus 文本格式 (PrometheusMiddleware 注入).
- `GET /api/migration/metrics` - v1/v2 迁移覆盖率指标.
- 慢 SQL: `install_sql_events(ENGINES)` 注册 SQLAlchemy `before/after_cursor_execute` 钩子, >= 0.5s 触发 `SQL_SLOW_COUNT` + `SLOW_SQL_WITH_TRACE` (OTel active span 时) counter.
- 连接池: `install_pool_events` + `collect_pool_metrics` 采集 pool checkout/checkin/overflow.
