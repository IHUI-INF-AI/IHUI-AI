# Client 后端资产整建制迁移到 Server — 设计 Spec

日期: 2026-06-18
作者: ZCode (brainstorming)
状态: Approved (待 user review spec)

## 1. 背景与目标

### 1.1 现状

`G:\1\client/` 仓库 (`ihui-agi-inf-web`, Vue 3 + Vite 前端) 内混杂了大量后端资产,
违反"前端项目应是纯前端"的项目结构约束:

| 项 | 类型 | 大小/状态 | 启动方式 |
|---|---|---|---|
| `client/backend/` | Python FastAPI 服务 (PDF 签名/水印/合并/上传/客服/工单/认证/RBAC/审计/智能体) | 13 api + 10 services + main.py + run_customer_service.py + customer_service_db.py | `npm run dev:backend` / `dev:cs` |
| `client/backend-api-service/` | 空目录,仅含 `.mvn/wrapper/maven-wrapper.jar` | 实质为空 | — |
| `client/backend-docs/` | Java Spring Boot 文档管理后端碎片 (4 .java + 1 .sql) | 极小,未集成 | — |
| `client/lib/` (根) | Python 运行时包 (bcrypt / paramiko / cryptography 等二进制) | 误落,不应在前端 | — |
| `client/start-pdf-service.bat` | 启动后端的 .bat | — | 双击 |
| `client/start-frontend.bat` | 启动前端 + uvicorn | — | 双击 |

而 `G:\1\server/` (FastAPI 单体, ZHS Platform) 已有完整的 `app/api/v1/<domain>/` 模块化结构
(70+ 域), 但 **缺少** PDF / 客服 / 工单 / RBAC / 审计 / 上传 / 版本 这些模块。

### 1.2 目标

1. `client/` 变成纯前端项目, 任何 Python / Java 后端代码、Python 运行时、FastAPI 入口全部移出
2. 上述功能在 `server/app/` 内按现有 `app/api/v1/<domain>/` 模式整合, **不复制粘贴、不留 legacy/**
3. 前端调用路径 (`/api/pdf/*`, `/api/customer-service/*`, `/api/zhs_api_ticket/*` 等) **零改动** — 通过 server 别名路由实现
4. 不破坏现有 `client/e2e/*` 和 `server/tests/*`

### 1.3 非目标

- 不重写后端业务逻辑 (仅包路径与导入路径调整)
- 不重构 server 已有的 `auth/*` / `chat/*` 等模块
- 不修改前端 UI / 业务代码

## 2. 设计决策

### 2.1 方案选择

| 备选 | 评估 | 决策 |
|---|---|---|
| A. 镜像复制到 `server/legacy/backend/` | 风险最低, 但 `client/` 仍不纯, 后端双套维护 | 否 |
| **B. 整建制迁移到 `server/app/api/v1/<domain>/` + 别名路由** | 真正实现职责分离, 路径对前端透明 | **采用** |
| C. 仅抽公共 services | 不解决"前端含后端"问题 | 否 |

### 2.2 路径兼容策略

server 在 `app/main.py` 加载时, 通过 `app/api/legacy_alias.py` 把
`/api/<domain>/...` 重写为 `/api/v1/<domain>/...` (含 WebSocket)。
前端调用代码、vite 代理、`.env` 中 `VITE_EDU_API_BASE` **全部不变**。

### 2.3 server 已有 auth/* 的处理

`client/backend/api/auth_routes.py` 的功能若与 `server/app/api/v1/auth/login.py` 重叠,
不重复实现; 仅迁移 `auth_routes.py` 中 **不重叠** 的端点 (例如本地账号注册/找回密码 等)
到 `server/app/api/v1/auth/legacy_local.py`, 由 legacy_alias 挂载。

## 3. 详细文件清单

### 3.1 删除 (client/)

| 路径 | 理由 |
|---|---|
| `client/backend-api-service/` (整目录, 含 `.mvn/`) | 空壳, 迁移无价值 |
| `client/lib/` (整目录, Python 二进制包) | 误落, 非前端资产 |
| `client/start-pdf-service.bat` | 不再需要, 启动并入 `server/start-all.bat` |

### 3.2 迁移 (client/backend/ → server/app/)

#### 3.2.1 API 路由 (13 个)

| 源 | 目标 |
|---|---|
| `client/backend/api/routes.py` (pdf_router) | `server/app/api/v1/pdf/pdf_routes.py` |
| `client/backend/api/upload_routes.py` | `server/app/api/v1/upload/routes.py` |
| `client/backend/api/version_routes.py` | `server/app/api/v1/version/routes.py` |
| `client/backend/api/rbac_routes.py` | `server/app/api/v1/rbac/routes.py` |
| `client/backend/api/audit_routes.py` | `server/app/api/v1/audit/routes.py` |
| `client/backend/api/auth_routes.py` (非重叠部分) | `server/app/api/v1/auth/legacy_local.py` |
| `client/backend/api/customer_service_routes.py` | `server/app/api/v1/customer_service/customer_service_routes.py` |
| `client/backend/api/ticket_routes.py` | `server/app/api/v1/customer_service/ticket_routes.py` |
| `client/backend/api/agent_routes.py` | `server/app/api/v1/agent/routes.py` (与已有 agents/ 共存) |
| `client/backend/api/audit_routes.py` | `server/app/api/v1/audit/routes.py` |
| `client/backend/api/config.py` | `server/app/api/v1/_legacy_config.py` (改用 `app.config.settings`) |
| `client/backend/api/models.py` | `server/app/schemas/legacy_schemas.py` (合并入已有 schemas) |
| `client/backend/api/__init__.py` | 删除 (使用 server 自己的包) |

#### 3.2.2 Services (10 个)

| 源 | 目标 |
|---|---|
| `client/backend/services/pdf_service.py` | `server/app/services/pdf_service.py` |
| `client/backend/services/storage_service.py` | `server/app/services/storage_service.py` |
| `client/backend/services/cleanup_service.py` | `server/app/services/cleanup_service.py` |
| `client/backend/services/metrics_service.py` | `server/app/services/metrics_service.py` (合并 PrometheusMiddleware, 避免与 `app/monitoring.py` 重复) |
| `client/backend/services/database_service.py` | `server/app/services/database_service.py` (与 `app/database.py` 共存) |
| `client/backend/services/backup_service.py` | `server/app/services/backup_service.py` |
| `client/backend/services/security_service.py` | `server/app/services/security_service.py` |
| `client/backend/services/auth_service.py` | `server/app/services/auth_service.py` |
| `client/backend/services/audit_service.py` | `server/app/services/audit_service.py` |
| `client/backend/services/diff_service.py` | `server/app/services/diff_service.py` |

#### 3.2.3 基础设施

| 源 | 目标 |
|---|---|
| `client/backend/customer_service_db.py` | `server/app/core/customer_service_db.py` |
| `client/backend/run_customer_service.py` | `server/app/cli/run_customer_service.py` (可选保留, 但默认启动 `app.main`) |
| `client/backend/scripts/init_db.py` | `server/scripts/init_legacy_db.py` |
| `client/backend/requirements.txt` | 追加到 `server/requirements.txt` 末尾 "Legacy PDF/Customer Service" 段 |
| `client/backend/.env.example` | 合并到 `server/.env.example` "Legacy PDF/Customer Service" 段 |
| `client/backend/main.py` | **不迁**; 内容由 `server/app/main.py` create_app() 统一加载 |
| `client/backend/Dockerfile` | 不迁; server 已有 `server/Dockerfile`, 增量依赖加到 `pyproject.toml` |
| `client/backend/README.md` | 转写为 `server/docs/MIGRATION_FROM_CLIENT_BACKEND.md` |
| `client/backend/certs/`, `uploads/`, `storage/`, `outputs/`, `logs/`, `backups/`, `data/` | **删除** (运行时产物, 不进版本) |

### 3.3 迁移 (client/backend-docs/ → server/app/api/v1/docs/)

| 源 | 目标 |
|---|---|
| `client/backend-docs/Document.java` | `server/app/api/v1/docs/Document.md` (转写为 FastAPI Pydantic 模型) |
| `client/backend-docs/DocumentController.java` | `server/app/api/v1/docs/routes.py` (实现等价 FastAPI 路由) |
| `client/backend-docs/MarkdownConverter.java` | `server/app/services/markdown_converter.py` (Python 重新实现) |
| `client/backend-docs/document.sql` | `server/app/api/v1/docs/schema.sql` |
| `client/backend-docs/README.md` | `server/app/api/v1/docs/README.md` |

> 说明: 4 个 Java 文件描述的是简单的文件→Markdown 转换 + CRUD, 用 FastAPI + python-docx / openpyxl 重新实现成本低, 不再保留 .java。

### 3.4 client 端脚本改动

`client/package.json`:
```diff
   "scripts": {
-    "dev:backend": "cd backend && python -m uvicorn main:app --host 127.0.0.1 --port 8000",
-    "dev:cs": "cd backend && python run_customer_service.py",
+    "dev:server": "cd ../server && start-all.bat",
+    "dev:server:backend": "cd ../server && start-backend.bat",
     "dev": "chcp 65001 >nul && vite --port 8888",
```

`client/start-frontend.bat` 重写为:
```bat
@echo off
chcp 65001 >nul
cd /d "%~dp0"
node node_modules\vite\bin\vite.js --port 8888
pause
```

`client/vite.config.ts` **不变** (仍代理到 8000, 8000 现在跑的是 server)。

`client/.env` 中 `VITE_EDU_API_BASE=http://127.0.0.1:8000` **不变**。

## 4. server 端新结构 (diff 视图)

```
server/app/
  api/
    legacy_alias.py          # 新建: /api/* → /api/v1/* 重写
    v1/
      pdf/                   # 新建 (从 client/backend/api/routes.py)
      upload/                # 新建
      version/               # 新建
      rbac/                  # 新建
      audit/                 # 新建
      customer_service/      # 新建
        customer_service_routes.py
        ticket_routes.py
      auth/
        legacy_local.py      # 新建 (非重叠部分)
      agent/
        routes.py            # 新建 (与 agents/ 共存)
      docs/                  # 新建 (从 client/backend-docs/)
        routes.py
        Document.md
        README.md
        schema.sql
  services/
    pdf_service.py           # 新建
    storage_service.py       # 新建
    cleanup_service.py       # 新建
    metrics_service.py       # 新建
    database_service.py      # 新建
    backup_service.py        # 新建
    security_service.py      # 新建
    auth_service.py          # 新建
    audit_service.py         # 新建
    diff_service.py          # 新建
    markdown_converter.py    # 新建 (from client/backend-docs/MarkdownConverter.java)
  core/
    customer_service_db.py   # 新建
  cli/
    run_customer_service.py  # 新建 (可选, 默认启动 app.main)
  main.py                    # 修改: 加载 legacy_alias + 新模块
```

## 5. 别名路由实现 (server/app/api/legacy_alias.py)

```python
"""路径兼容层: 把 /api/<old>/... 重写为 /api/v1/<old>/..."""
from fastapi import FastAPI
from fastapi.routing import APIRoute

# 旧 → 新 映射 (与 client/backend/main.py 的 include_router 保持一致)
LEGACY_REWRITES = {
    "/api/pdf": "/api/v1/pdf",
    "/api/upload": "/api/v1/upload",
    "/api/version": "/api/v1/version",
    "/api/rbac": "/api/v1/rbac",
    "/api/audit": "/api/v1/audit",
    "/api/auth": "/api/v1/auth",
    "/api/customer-service": "/api/v1/customer-service",
    "/api/zhs_api_ticket": "/api/v1/customer-service/ticket",
    # WebSocket
    "/customer-service/chat": "/api/v1/customer-service/ws/chat",
}

def install_legacy_alias(app: FastAPI) -> None:
    """为每个旧路径注册一个 catch-all 代理路由."""
    # 使用 starlette Mount + Route 转发到内部 ASGI app
    # 或注册 ASGI 路径重写中间件
    ...
```

实现方式: 用 `starlette.middleware.Mount` + 自定义 ASGI 中间件
(检查 `scope["path"]`, 若匹配 `LEGACY_REWRITES` 前缀, 改写 `path` 后再 call downstream app)。
WebSocket 同理。

**契约**: 前端 `axios/fetch` 打到 `/api/customer-service/...` 的请求,
server 收到后, 重写为 `/api/v1/customer-service/...` 并走新模块。

## 6. 验证

### 6.1 静态检查 (必过)

```bash
# client/ 不应再含 Python / 后端痕迹
cd G:\1\client
find . -name "*.py" -not -path "./node_modules/*" -not -path "./miniapp/*"
# 期望: 无输出 (miniapp 自身没有 .py, 排除 node_modules)

# 不应再含 FastAPI / 启动后端的脚本
grep -r "uvicorn" package.json start-*.bat 2>/dev/null
# 期望: 无输出
```

### 6.2 启动验证 (必过)

1. `cd G:\1\server && start-all.bat` → uvicorn 监听 8000
2. `cd G:\1\client && npm run dev` → vite 监听 8888
3. 浏览器打开 `http://localhost:8888`, 依次验证:
   - 登录 (走 `/api/auth/login` → 命中 `server/app/api/v1/auth/login.py`)
   - 上传 PDF (走 `/api/upload` → `app/api/v1/upload/routes.py`)
   - 客服聊天 (走 `/api/customer-service` + ws `/customer-service/chat`)
   - 工单创建 (走 `/api/zhs_api_ticket` → `app/api/v1/customer-service/ticket_routes.py`)
   - RBAC 权限校验 (走 `/api/rbac`)
   - 审计日志 (走 `/api/audit`)
4. 全部请求在 vite dev server 端 console 应有 `[proxy] /api/... → :8000` 日志

### 6.3 回归测试 (必过)

- `cd G:\1\client && npm run test` (vitest 套件)
- `cd G:\1\client && npm run e2e -- api-integration.spec.ts backend-contract.spec.ts` (核心 e2e)
- `cd G:\1\server && run-tests.bat` (server 套件)

## 7. 风险与回退

| 风险 | 缓解 |
|---|---|
| 别名路由引入性能开销 | 仅做 path prefix 替换, O(1) 字符串操作, 可忽略 |
| 迁移时漏掉某个 import | 迁移后 `cd server && python -c "import app.main"` 应零 ImportError; `cd client && npm run typecheck` 应零错误 |
| venv/依赖差异 | 把 `client/backend/requirements.txt` 完整追加到 `server/requirements.txt`, 重建 server venv |
| 启动后端服务名变化 (app.main vs backend.main) | 在 `server/docs/MIGRATION_FROM_CLIENT_BACKEND.md` 写明"从 backend/main.py 迁移到 app/main.py" |
| client `dev:backend` / `dev:cs` 脚本被外部文档引用 | 改写后保留为 deprecated alias, console.warn 提示, 1 个迭代后删除 |

回退方案: 所有迁移在 commit 前留 `client/backend.bak/` 副本, 验证通过后再删除。

## 8. 文档产出

- `server/docs/MIGRATION_FROM_CLIENT_BACKEND.md` — 迁移清单与映射
- `server/app/api/v1/docs/README.md` — docs/ 模块使用说明
- 更新 `server/README.md` 添加 "Legacy PDF/Customer Service Modules" 章节

## 9. 验收标准 (Definition of Done)

- [ ] `client/` 内无 `*.py` / `requirements.txt` / `uvicorn` 引用 / `certs/` / `uploads/` 等后端资产
- [ ] `client/backend-api-service/`、`client/lib/`、`client/start-pdf-service.bat` 已删除
- [ ] `client/backend/`、`client/backend-docs/` 内容全部进入 `server/app/` 对应位置
- [ ] `server/app/main.py` 启动后 `/docs` 显示所有新旧路由
- [ ] 前端登录 / PDF / 客服 / 工单 / RBAC / 审计 6 类核心 e2e 通过
- [ ] `server/tests/` 套件全部通过
- [ ] `server/docs/MIGRATION_FROM_CLIENT_BACKEND.md` 已写
- [ ] git commit 一次, 标题 `refactor: migrate client/backend assets into server (no behavior change)`
