# 开发环境端口约定

> 2026-06-18 起统一规范, 详见 [vite.config.ts](../client/vite.config.ts) 顶部 `BACKEND_TARGET` 常量

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
