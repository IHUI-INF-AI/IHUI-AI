# 开发环境端口约定

> 2026-06-18 起统一规范, 详见 [vite.config.ts](../client/vite.config.ts) 顶部 `BACKEND_TARGET` 常量
>
> **2026-06-25 强化**: 新增"运行时启动规范"章节, 明确禁止 AI 助手/开发者临时启动后端时改端口。违规案例见文末。

## 端口分配

| 端口 | 用途          | 启动命令                                     | 禁止事项             |
|------|---------------|----------------------------------------------|----------------------|
| 8000 | FastAPI 后端  | `python server/scripts/restart_backend.py`   | 禁止改 Vite 代理指此 |
| 8888 | Vite dev server | `pnpm dev` (在 client 目录)                | 禁止改 BASE_URL 默值 |
| 4173 | Vite preview (CI 集成测试) | `pnpm build && pnpm preview`         | 本地 dev 不要用此端口 |
| 9090 | Prometheus    | (运维侧)                                     | 业务不要监听         |

## 端口漂移历史 (已修复, 仅留档)

| 时间点       | 端口状况                              | 原因                       |
|--------------|---------------------------------------|----------------------------|
| 历史 dev     | 8000(后端) + 18000(后端) + 8888(Vite) | 后端存在两套启动脚本       |
| 2026-06-18   | 8000(后端) + 8888(Vite)               | 统一 BACKEND_TARGET, 18000 已废弃 |

## 验证

```bash
# 后端 8000 端口可达
curl http://localhost:8000/api/health
# Vite 代理 8888 端口可达
curl http://localhost:8888/api/health
# 18000 端口必须无服务 (回归检测)
curl --max-time 2 http://localhost:18000/api/health
# ^ 应返回连接失败
```

更严谨的回归检测由 e2e 自动化覆盖: [infra-vite-proxy.spec.ts](../client/e2e/infra-vite-proxy.spec.ts) 6 个测试用例, 任一失败即视作端口漂移回归。

## 一键启动

```bash
# 同时拉起后端 + Vite dev server
powershell -ExecutionPolicy Bypass -File scripts/dev-up.ps1

# 仅查看端口状态, 不启动
powershell -ExecutionPolicy Bypass -File scripts/dev-up.ps1 -Status

# 优雅停机 (SIGTERM, 等 5s 后 kill)
powershell -ExecutionPolicy Bypass -File scripts/dev-up.ps1 -Down
```

## 如何修改端口 (4 步操作清单)

> 警告: 修改端口是跨多个文件的工作, 必须按顺序执行, 任何遗漏都会引发"端口漂移"被 check:port-drift 拦截.

### 步骤 1: 决定新值

确认新端口符合:
- 在 1024-65535 范围
- 不与已分配的 8000/8888/4173/9090 冲突
- 不在你系统中其它服务常用范围 (3000, 5000, 5432, 6379 等)

### 步骤 2: 修改 [client/config/ports.ts](../client/config/ports.ts) (SSoT)

```ts
// 修改这 3 个 fallback 默认值
export const BACKEND_PORT  = envPort('BACKEND_PORT',  <NEW_BACKEND_PORT>)
export const FRONTEND_PORT = envPort('FRONTEND_PORT', <NEW_FRONTEND_PORT>)
export const PREVIEW_PORT  = envPort('PREVIEW_PORT',  <NEW_PREVIEW_PORT>)
```

如果新端口替代了某个**已废弃**端口, 同步更新 `DEPRECATED_PORTS` 数组:
```ts
export const DEPRECATED_PORTS: number[] = [<旧废弃端口>]
```

### 步骤 3: 同步 PowerShell / Bash 启动脚本

`ports.ts` 的值必须与以下 3 个启动脚本中的 `$DEFAULT_*_PORT` 同步 (PowerShell 不能 import .ts, 镜像维护):

- [scripts/dev-up.ps1](../../scripts/dev-up.ps1) - `$DEFAULT_BACKEND_PORT` / `$DEFAULT_FRONTEND_PORT` / `$DEFAULT_DEPRECATED_PORT`
- [scripts/ci-env-setup.ps1](../../scripts/ci-env-setup.ps1) - 8000/4173 fallback
- [scripts/ci-env-setup.sh](../../scripts/ci-env-setup.sh) - `DEFAULT_BACKEND_PORT` / `DEFAULT_PREVIEW_PORT`

### 步骤 4: 验证

按顺序跑下面 4 条命令, 全部通过才算改端口完成:

```bash
# 4.1 端口漂移检测 (拦截字面量散落)
cd client && node scripts/check-port-drift.mjs
# 期望: [OK] 端口配置统一, 无漂移

# 4.2 端口探活
powershell -ExecutionPolicy Bypass -File scripts/dev-up.ps1 -Status
# 期望: 新端口 [LISTEN], 旧端口 [IDLE]

# 4.3 启动 + 链路验证
powershell -ExecutionPolicy Bypass -File scripts/dev-up.ps1
# 期望: Backend listening on <NEW_BACKEND_PORT> / Vite listening on <NEW_FRONTEND_PORT>

# 4.4 e2e 回归
cd client && npx playwright test infra-vite-proxy
# 期望: 12 passed (6 用例 × 2 浏览器)
```

### 不需要改的地方

以下文件**不需要**手动改, 它们通过 import / env 自动跟随 SSoT:
- [client/vite.config.ts](../client/vite.config.ts) - 用 `BACKEND_TARGET` / `FRONTEND_URL` / `FRONTEND_PORT`
- [client/playwright.config.ts](../client/playwright.config.ts) - 用 `FRONTEND_URL` / `BACKEND_URL`
- [client/e2e/infra-vite-proxy.spec.ts](../client/e2e/infra-vite-proxy.spec.ts) - 用 `BACKEND_URL` / `FRONTEND_URL` / `DEPRECATED_PORTS`

如果改了 SSoT 后这些文件有违规, 说明它们引入了字面量, **修复这些文件**, 而不是把它们也加到 SSoT 中.

## 修改端口前请先看

- [client/config/ports.ts](../client/config/ports.ts) - **唯一来源**, 改端口只改这里
- [client/vite.config.ts](../client/vite.config.ts) - 顶部 `BACKEND_TARGET` / `FRONTEND_URL` 常量, 12 处 proxy target 都引用
- [client/playwright.config.ts](../client/playwright.config.ts) - 顶部端口约定注释
- [client/e2e/infra-vite-proxy.spec.ts](../client/e2e/infra-vite-proxy.spec.ts) - 端口契约 e2e 测试
- [client/scripts/check-port-drift.mjs](../client/scripts/check-port-drift.mjs) - 端口漂移检测器, pre-commit 钩子自动跑

---

## 运行时启动规范 (2026-06-25 新增, 强制遵守)

> **核心原则: 后端必须监听 8000 端口, 不得以任何理由临时改为其他端口.**

### 1. 适用范围

本规范适用于**所有**启动后端的方式, 包括但不限于:

- AI 助手 (Trae / Cursor / Claude 等) 自动启动后端做联调验证
- 开发者手动 `uvicorn` / `python -m uvicorn` 启动
- CI / 脚本启动
- 容器化 / Docker 启动
- 任何"临时""一次性"的启动

### 2. 唯一允许的启动命令

```bash
# ✅ 正确: 用 8000 端口
cd server
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# ✅ 正确: 不带 --port (端口由 .env 的 API_PORT=8000 控制)
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1
```

### 3. 严禁的启动方式

```bash
# ❌ 违规: 临时改端口为 8001 / 8002 / 9000 等
.venv\Scripts\python.exe -m uvicorn app.main:app --port 8001

# ❌ 违规: 用环境变量 BACKEND_PORT 临时覆盖 (前端 proxy 会指向错误端口)
$env:BACKEND_PORT=8001; npm run dev

# ❌ 违规: 在临时脚本里写死非 8000 端口
```

### 4. 8000 端口被占用怎么办

**不得改端口绕过**, 必须先释放 8000:

```bash
# 1. 查看谁占用 8000
netstat -ano | findstr ":8000" | findstr "LISTENING"

# 2. 用 PID 杀进程
Stop-Process -Id <PID> -Force

# 3. 确认 8000 空闲后再启动
netstat -ano | findstr ":8000" | findstr "LISTENING"
# 应无输出

# 4. 启动后端 (用 8000)
cd server && .venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### 5. 为什么禁止临时改端口

| 后果 | 说明 |
|------|------|
| **前后端断链** | Vite proxy 写死指向 8000, 后端改 8001 后所有 `/api/*` 请求 502 |
| **环境变量污染** | `$env:BACKEND_PORT=8001` 会残留到后续命令, 污染前端启动 |
| **联调假象** | 临时改端口后前端需带环境变量才能联调, 重启即失效, 浪费排查时间 |
| **CI 失败** | CI 检测端口漂移会拦截, 但运行时改端口 CI 测不到, 形成盲区 |
| **规范崩塌** | 一次违规会让后续 AI 助手/开发者误以为"可以随便改端口", 规范形同虚设 |

### 6. 运行时检测

新增 [scripts/check-runtime-port.mjs](../scripts/check-runtime-port.mjs) 检测脚本, 扫描运行中的 uvicorn/python 进程监听端口, 若非 8000 则报警:

```bash
cd client && node scripts/check-runtime-port.mjs
# 期望: [OK] 后端运行在 8000 端口
# 违规: [ERROR] 发现 uvicorn 监听 8001, 违反端口规范, 请改回 8000
```

**已集成到 [scripts/dev-up.ps1](../../scripts/dev-up.ps1) Step 4 (2026-06-25)**: `dev-up.ps1` 启动后端 + Vite 完成后会自动执行一次运行时端口检测, 失败仅 `Write-Warn` 不阻断启动 (避免误伤已跑起来的前后端), 事件日志写入 `logs/dev-up-events.jsonl` 的 `runtime_port_check` 事件. 即便 AI 助手/开发者通过 `dev-up.ps1` 启动, 也会被兜底检测覆盖.

---

## 违规案例留档 (2026-06-25)

### 案例 1: AI 助手临时改 8001 端口

**时间**: 2026-06-25
**违规者**: Trae AI 助手
**经过**: AI 助手在联调验证时, 因 8000 端口被占用, 未经用户同意擅自改为 8001 端口启动后端, 并创建 `server/scripts/_health_check.py` 写死 8001.
**后果**: 前端 Vite proxy 仍指向 8000, 联调失败; 用户发现后要求整改.
**处理**:
1. 停掉 8001 后端进程
2. 删除 `_health_check.py` (含 8001 痕迹)
3. 后端回归 8000 端口启动
4. 新增本规范章节 + 运行时检测脚本, 杜绝再次发生
**教训**:
- **AI 助手不得擅自改端口**, 必须先释放 8000
- 任何"临时"启动都必须遵守端口规范
- 临时脚本不得写死非标准端口
