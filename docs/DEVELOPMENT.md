# 本地开发指南(Development Guide)

> IHUI-AI 全栈 AI 平台的本地开发环境搭建、启动、调试与常用脚本速查。系统要求与提交规范见 [CONTRIBUTING.md](./CONTRIBUTING.md),系统架构见 [architecture.md](./architecture.md),部署运维见 [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md)。

---

## 1. 系统要求

完整系统要求与安装步骤见 [CONTRIBUTING.md §1.1](./CONTRIBUTING.md#11-系统要求),此处仅列速查表。

| 工具 | 版本 | 用途 |
|---|---|---|
| Node.js | `>=20.10.0`(LTS 20.x) | 全端 JS 运行时(api / web / cli / desktop / extension / mobile-rn) |
| pnpm | `>=9.0.0`(项目固定 `pnpm@9.15.0`) | Monorepo 包管理器,`corepack enable` 激活 |
| Python | `3.12+`(仅 `apps/ai-service`) | FastAPI + LangGraph + LiteLLM |
| PostgreSQL | `15+`(compose 用 `pgvector/pgvector:pg15-alpine`) | 主库,含 pgvector 扩展 |
| Redis | `7+`(compose 用 `redis:7-alpine`) | 缓存 / BullMQ 队列 / WebSocket Pub/Sub |
| Docker | `24+` + Compose v2 | 一键拉起 db / redis / 监控栈 |
| Git | `2.40+`,`core.autocrlf=false` | 项目强制 `endOfLine: lf` |

```bash
# 一次性初始化
git clone <repo-url> IHUI-AI && cd IHUI-AI
corepack enable && corepack prepare pnpm@9.15.0 --activate
pnpm install                         # workspace 联动安装
cd apps/ai-service && uv sync && cd ../..   # AI 服务 Python 依赖
```

---

## 2. 环境变量

项目有 4 个 `.env.example`,复制为对应 `.env` / `.env.local` 后填入实际值。下表按文件分组列出关键变量。

### 2.1 根目录 `.env.example`(全链路编排)

| 变量名 | 用途 | 默认值 | 必填 |
|---|---|---|---|
| `DOMAIN` | 站点域名 | `localhost` | 是 |
| `NODE_ENV` | 运行环境 | `development` | 是 |
| `WEB_PORT` | web 服务端口 | `3000` | 是 |
| `API_PORT` | api 服务端口 | `3001` | 是 |
| `AI_SERVICE_PORT` | ai-service 端口 | `8000` | 是 |
| `AI_SERVICE_URL` | ai-service 地址(api 回调用) | `http://localhost:8000` | 是 |
| `DATABASE_URL` | PostgreSQL 连接串 | `postgresql://ihui:***@localhost:5432/ihui_dev` | 是 |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | DB 分项配置 | `localhost` / `5432` / `ihui` / - / `ihui_dev` | 是 |
| `REDIS_URL` | Redis 连接串 | `redis://localhost:6379` | 是 |
| `JWT_SECRET` | JWT 签名密钥(≥32 字符) | - | 是 |
| `JWT_EXPIRES_IN` | JWT 过期时间 | `7d` | 是 |
| `CREDENTIALS_ENCRYPTION_KEY` | 凭证加密密钥(≥32 字符) | - | 是 |
| `CORS_ORIGIN` | CORS 允许来源 | `http://localhost:3000` | 是 |
| `STEPFUN_API_KEY` / `STEPFUN_API_BASE` | StepFun LLM(默认 provider) | - / `https://api.stepfun.com/step_plan/v1` | 否(空则 stub) |
| `AGNES_API_KEY` / `AGNES_API_BASE` | Agnes AI LLM(备用) | - / `https://apihub.agnes-ai.com/v1` | 否 |
| `GROQ_API_KEY` / `GEMINI_API_KEY` / `OPENROUTER_API_KEY` | 免费 provider 备选 | 空 | 否 |
| `FEISHU_APP_ID` / `FEISHU_APP_SECRET` | 飞书 OAuth | 空 | 否 |
| `COZE_CLIENT_ID` / `COZE_CLIENT_SECRET` | Coze OAuth | 空 | 否 |
| `WECHAT_PAY_*` | 微信支付(商户号/密钥/证书) | 空 | 否 |
| `OSS_*` | 对象存储 | 空 | 否 |
| `SMS_PROVIDER` / `SMS_*` | 短信(aliyun) | `aliyun` / 空 | 否 |
| `SMTP_*` | 邮件 SMTP | 空 | 否 |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OpenTelemetry OTLP 端点 | 空(关闭) | 否 |
| `PROMETHEUS_ENABLED` | Prometheus 指标开关 | `false` | 否 |

### 2.2 `apps/api/.env.example`(后端 API)

| 变量名 | 用途 | 默认值 | 必填 |
|---|---|---|---|
| `PORT` | api 监听端口 | `3002`(独立测试用,与根 `.env` 的 `API_PORT=3001` 二选一) | 是 |
| `DATABASE_URL` | DB 连接串 | `postgresql://postgres:postgres@localhost:5432/ihui` | 是 |
| `REDIS_URL` | Redis 连接串 | `redis://localhost:6379` | 是 |
| `JWT_SECRET` | JWT 密钥 | `change-in-production-min-32-chars` | 是 |
| `OTEL_ENABLED` | OTel 总开关 | `false` | 否 |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP 端点 | `http://localhost:4318` | 否 |
| `OTEL_SERVICE_NAME` | 服务名 | `@ihui/api` | 否 |
| `OTEL_TRACES_SAMPLER` / `OTEL_TRACES_SAMPLER_ARG` | 采样器 / 采样率 | `traceidratio` / `0.1` | 否 |
| `MAIL_PROVIDER` | 邮件路由策略 | `auto` | 否 |
| `SMTP_ENABLED` / `SMTP_*` | SMTP 兜底通道 | `false` / 空 | 否 |
| `RESEND_API_KEY` / `RESEND_FROM` | Resend 通道(国外) | 空 | 否 |
| `TENCENT_SES_*` | 腾讯云 SES 通道(国内) | 空 | 否 |
| `WECHAT_APP_ID` / `WECHAT_APP_SECRET` | 微信扫码登录 | 空 | 否 |
| `DINGTALK_APP_KEY` / `DINGTALK_APP_SECRET` / `DINGTALK_REDIRECT_URI` | 钉钉扫码登录 | 空 | 否 |
| `WECOM_CORP_ID` / `WECOM_AGENT_ID` / `WECOM_SECRET` / `WECOM_REDIRECT_URI` | 企业微信扫码登录 | 空 | 否 |
| `FEISHU_APP_ID` / `FEISHU_APP_SECRET` | 飞书扫码登录 | 空 | 否 |
| `GITHUB_TOKEN` | GitHub API(热度同步) | 空 | 否 |
| `ELASTICSEARCH_URL` / `ELASTICSEARCH_INDEX_PREFIX` | ES 全文检索 | 空 / `ihui` | 否 |

### 2.3 `apps/web/.env.example`(前端 Web)

| 变量名 | 用途 | 默认值 | 必填 |
|---|---|---|---|
| `API_URL` | 后端 API 地址(服务端代理) | `http://localhost:8802` | 是 |
| `AI_SERVICE_URL` | ai-service 地址(服务端代理) | `http://localhost:8803` | 是 |
| `ADMIN_API_URL` | SaaS 管理后台 API | `http://127.0.0.1:8830` | 否 |
| `ADMIN_SAAS_API_KEY` | SaaS Admin API Key | 空 | 否 |
| `NEXT_PUBLIC_GOOGLE_ENABLED` / `NEXT_PUBLIC_GOOGLE_CLIENT_ID` / `NEXT_PUBLIC_GOOGLE_REDIRECT_URI` | Google 登录 | `true` / - / `http://localhost:8801/google/callback` | 否 |
| `NEXT_PUBLIC_APPLE_ENABLED` / `NEXT_PUBLIC_APPLE_CLIENT_ID` / `NEXT_PUBLIC_APPLE_REDIRECT_URI` | Apple 登录 | `true` / - / `http://localhost:8801/apple/callback` | 否 |
| `NEXT_PUBLIC_DINGTALK_ENABLED` / `NEXT_PUBLIC_DINGTALK_APP_ID` / `NEXT_PUBLIC_DINGTALK_REDIRECT_URI` | 钉钉扫码登录 | `true` / - / `http://localhost:8801/callback?platform=dingtalk` | 否 |
| `NEXT_PUBLIC_ENTERPRISE_WECHAT_ENABLED` / `NEXT_PUBLIC_ENTERPRISE_WECHAT_APP_ID` / `NEXT_PUBLIC_ENTERPRISE_WECHAT_REDIRECT_URI` | 企业微信扫码 | `true` / - / `http://localhost:8801/callback?platform=enterpriseWechat` | 否 |
| `NEXT_PUBLIC_WECHAT_ENABLED` / `NEXT_PUBLIC_WECHAT_APP_ID` / `NEXT_PUBLIC_WECHAT_REDIRECT_URI` | 微信扫码 | `true` / - / `http://localhost:8801/callback?platform=wechat` | 否 |
| `NEXT_PUBLIC_FEISHU_ENABLED` / `NEXT_PUBLIC_FEISHU_APP_ID` / `NEXT_PUBLIC_FEISHU_REDIRECT_URI` | 飞书扫码 | `true` / - / `http://localhost:8801/callback?platform=feishu` | 否 |
| `NEXT_PUBLIC_GITHUB_ENABLED` / `NEXT_PUBLIC_GITHUB_CLIENT_ID` / `NEXT_PUBLIC_GITHUB_REDIRECT_URI` | GitHub 登录 | `true` / - / `http://localhost:8801/github/callback` | 否 |
| `NEXT_PUBLIC_ALIPAY_ENABLED` / `NEXT_PUBLIC_ALIPAY_APP_ID` / `NEXT_PUBLIC_ALIPAY_REDIRECT_URI` | 支付宝网页授权 | `true` / - / `http://localhost:8801/callback?platform=alipay` | 否 |

> **注意**:`NEXT_PUBLIC_*` 前缀变量在 Next.js build 时静态编译进产物,运行时修改不生效;改后必须重新 `pnpm --filter @ihui/web build`。

### 2.4 `apps/ai-service/.env.example`(AI 服务)

| 变量名 | 用途 | 默认值 | 必填 |
|---|---|---|---|
| `PORT` | ai-service 端口 | `3003`(独立测试用) | 是 |
| `HOST` | 监听地址 | `0.0.0.0` | 是 |
| `LOG_LEVEL` | 日志级别 | `info` | 否 |
| `CORS_ORIGIN` | CORS 来源 | `http://localhost:3001` | 否 |
| `DATABASE_URL` | DB 连接串 | `postgres://postgres:postgres@localhost:5432/ihui_ai` | 是 |
| `REDIS_URL` | Redis 连接串 | `redis://localhost:6379` | 是 |
| `STEPFUN_API_KEY` / `STEPFUN_API_BASE` | StepFun LLM | - / `https://api.stepfun.com/step_plan/v1` | 否(空则 stub) |
| `AGNES_API_KEY` / `AGNES_API_BASE` | Agnes AI | - / `https://apihub.agnes-ai.com/v1` | 否 |
| `GROQ_API_KEY` / `GEMINI_API_KEY` / `OPENROUTER_API_KEY` | 免费 provider | 空 | 否 |
| `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Workers AI | 空 | 否 |
| `NVIDIA_API_KEY` | NVIDIA NIM | 空 | 否 |
| `GITHUB_TOKEN` | GitHub Models | 空 | 否 |
| `VERCEL_AI_GATEWAY_KEY` | Vercel AI Gateway | 空 | 否 |
| `OPENCODE_ZEN_KEY` | OpenCode Zen | 空 | 否 |
| `MODAL_API_KEY` / `INFERENCE_NET_API_KEY` / `NLP_CLOUD_API_KEY` / `SCALEWAY_API_KEY` / `ALIBABA_INTL_API_KEY` | 其他免费/试用 provider | 空 | 否 |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | 付费 provider | 空 | 否 |
| `LITELLM_MODEL` | 默认模型名(前缀决定 provider) | `stepfun/step-3.7-flash` | 是 |
| `API_SERVICE_URL` | 后端 API 地址(回调用) | `http://localhost:3002` | 是 |
| `AI_CALLBACK_SECRET` | AI 回调共享密钥 | 空 | 否 |
| `VOLC_APP_ID` / `VOLC_ACCESS_KEY` / `VOLC_APP_KEY` | 火山引擎实时语音 | 空 | 否 |
| `CREDENTIALS_ENCRYPTION_KEY` | 凭据加密密钥(与 api 共享) | 空 | 是 |
| `OTEL_ENABLED` / `OTEL_EXPORTER_OTLP_ENDPOINT` / `OTEL_SERVICE_NAME` | OpenTelemetry | `false` / `http://localhost:4318` / `@ihui/ai-service` | 否 |

> **stub 模式**:所有 LLM provider key 均为空时,ai-service 自动降级为 stub 模式(返回模拟响应),不阻塞启动,适合纯前端开发。

---

## 3. 一键启动方式

项目提供 3 个启动脚本 + turbo 并行命令,适用场景不同:

| 方式 | 命令 | 适用场景 | 行为 |
|---|---|---|---|
| turbo 并行 | `pnpm dev` | 日常开发(推荐) | Turborepo 并行启动所有 apps 的 `dev` 脚本,日志汇聚到一个终端 |
| dev-up.ps1 | `powershell -File scripts\dev-up.ps1` | 首次启动 / 全新环境 | 先 `docker compose up -d db redis` → 等待就绪 → 运行迁移 → 并行启动 api + web,Ctrl+C 自动清理 |
| dev-all.ps1 | `powershell -File scripts\dev-all.ps1` | RunCommand 工具失联时 | 健康检查 → 每个服务派生独立 PowerShell 窗口运行,互不干扰 |
| dev-web.mjs | `node scripts/dev-web.mjs` | 单独启动 web | 启动前 `taskkill` 清理端口 3000 残留进程树,杜绝僵尸 next-server |

### 3.1 各脚本差异详解

**`pnpm dev`(turbo 并行)**

```bash
pnpm dev
```

- 调用 `turbo run dev`,按 `turbo.json` 的 `dev` task(`dependsOn: ^build`, `persistent: true`)并行启动各 app。
- 日志前缀带包名(如 `@ihui/web:dev:`),便于区分。
- 单一终端,Ctrl+C 退出所有服务。

**`scripts/dev-up.ps1`(Docker + 迁移 + 服务)**

```powershell
powershell -ExecutionPolicy Bypass -File scripts\dev-up.ps1            # 全量
powershell -ExecutionPolicy Bypass -File scripts\dev-up.ps1 -SkipDocker  # 跳过 Docker(已自建 db/redis)
powershell -ExecutionPolicy Bypass -File scripts\dev-up.ps1 -ApiOnly     # 仅 api
powershell -ExecutionPolicy Bypass -File scripts\dev-up.ps1 -WebOnly     # 仅 web
```

- 自动拉起 Docker(db + redis)→ 等待 `pg_isready` / `redis-cli ping` → `drizzle-kit migrate` → 启动 api + web。
- api 端口 3001,web 端口 3000。
- Ctrl+C 触发 trap 清理子进程。

**`scripts/dev-all.ps1`(独立窗口 + 健康检查)**

```powershell
powershell -ExecutionPolicy Bypass -File scripts\dev-all.ps1             # 启动全部
powershell -ExecutionPolicy Bypass -File scripts\dev-all.ps1 -CheckOnly  # 仅健康检查
powershell -ExecutionPolicy Bypass -File scripts\dev-all.ps1 -Stop       # 停止所有 dev 服务
```

- 适合 RunCommand 工具失联时由用户在真实 PowerShell 中执行。
- 每个服务(api / web / ai-service)派生独立 PowerShell 窗口,编码为 Base64 传参避免引号嵌套。
- 启动前后各做一次健康检查(PostgreSQL / Redis / web HTTP / api 端口 / ai-service 端口)。

**`scripts/dev-web.mjs`(web 专用,防僵尸进程)**

```bash
node scripts/dev-web.mjs                  # 启动 web(默认端口 3000)
node scripts/dev-web.mjs --clean          # 启动前清 .next 缓存
node scripts/dev-web.mjs --port 3001      # 指定端口
```

- 启动前 `taskkill /F /T` 杀掉端口 3000 残留进程树(避免 `EADDRINUSE`)。
- 用 `child_process.spawn` 跟踪 pnpm 进程,注册 SIGINT/SIGTERM/exit handler 退出时杀整棵进程树。
- **禁止**在 dev server 假死时裸用 `Start-Process pnpm dev`,永远用本脚本。

---

## 4. 单端启动

| 服务 | 开发端口 | Docker 内部端口 | 启动命令 | 热重载 |
|---|---|---|---|---|
| api(Fastify 5) | 3001(根 `.env`) / 3002(独立) | 8080 | `pnpm --filter @ihui/api dev` | `tsx watch` 文件变更自动重启 |
| web(Next.js 15) | 3000 / 8801(package.json 默认) | 3000 | `pnpm --filter @ihui/web dev` | Turbopack HMR,毫秒级热更新 |
| ai-service(FastAPI) | 8000 / 3003(独立) | 8000 | `cd apps/ai-service && uvicorn app.main:app --reload --port 8000` | `uvicorn --reload` 文件变更自动重启 |

### 4.1 后端 API

```bash
pnpm --filter @ihui/api dev
# 等价于:tsx watch src/index.ts
# 监听端口由 PORT 环境变量决定(根 .env API_PORT=3001)
# Swagger 文档:http://localhost:3001/docs
# 健康检查:http://localhost:3001/api/health
```

- 热重载:`tsx watch` 监听 `src/**/*.ts`,变更后整进程重启(非 HMR)。
- 日志:Pino 结构化日志,开发环境 `pino-pretty` 美化输出。
- BullMQ Worker 与 API 同进程运行(生产环境可设 `ENABLE_WORKER=false` 拆分)。

### 4.2 前端 Web

```bash
pnpm --filter @ihui/web dev
# 等价于:next dev --turbopack -p 8801
# 注意:package.json 默认端口是 8801,如需 3000 用 node scripts/dev-web.mjs 或传 -p 3000
```

- 热重载:Next.js 15 Turbopack,HMR 毫秒级,保留组件状态。
- 首次启动会编译路由,可能耗时 10-30s。
- 改 `globals.css` 后 HMR 不一定重编译 CSS chunk,可能需要重启(见 [TROUBLESHOOTING.md](./TROUBLESHOOTING.md))。

### 4.3 AI 服务

```bash
cd apps/ai-service
uv sync                                          # 安装依赖(首次)
uvicorn app.main:app --reload --port 8000        # 启动 + 热重载
# 健康检查:http://localhost:8000/health
# API 文档:http://localhost:8000/docs
```

- 热重载:`uvicorn --reload` 监听 `app/**/*.py`,变更后重启进程。
- LLM key 全空时自动降级 stub 模式,返回模拟响应。
- 向量记忆默认尝试连 Redis,失败后降级内存模式(测试环境无 Redis 时不阻塞)。

---

## 5. 数据库本地准备

完整流程 7 步,从 Docker 拉起到种子数据:

```bash
# 1. 启动 PostgreSQL + Redis(Docker)
docker compose up -d db redis

# 2. 等待 PostgreSQL 就绪
docker compose exec -T db pg_isready -U ihui

# 3. 生成迁移文件(改 schema 后)
pnpm --filter @ihui/database db:generate

# 4. 执行迁移
pnpm --filter @ihui/database db:migrate

# 5. 校验 schema 一致性(无 drift)
pnpm --filter @ihui/database db:check

# 6. 推送 schema 到 DB(开发期快速同步,跳过迁移文件)
pnpm --filter @ihui/database db:push

# 7. 种子数据(7 阶段模式化 + 容错隔离)
pnpm --filter @ihui/database seed
```

| 步骤 | 命令 | 作用 |
|---|---|---|
| 1 | `docker compose up -d db redis` | 拉起 `pgvector/pgvector:pg15-alpine` + `redis:7-alpine` |
| 2 | `pg_isready -U ihui` | 等待 DB 接受连接(最多 30 次重试) |
| 3 | `db:generate` | 对比 `src/schema/` 与上一次迁移,生成 SQL 差异文件到 `drizzle/` |
| 4 | `db:migrate` | 执行 `drizzle/*.sql` 迁移文件 |
| 5 | `db:check` | 校验当前 schema 与迁移文件无 drift |
| 6 | `db:push` | 直接把 schema 推到 DB(开发期用,不生成迁移文件) |
| 7 | `seed` | 种子数据(用户 / VIP / 内容 / 配置等 7 阶段) |

> **Drizzle Studio** 可视化:`pnpm --filter @ihui/database db:studio`,打开 `https://local.drizzle.studio`。

> **schema drift 守门**:`scripts/check-db-schema-drift.mjs` 在 pre-commit 第 3 项自动检测,改 schema 后必须 `db:generate` 否则提交被阻塞。

---

## 6. 调试技巧

### 6.1 VS Code launch.json

```jsonc
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug API (Fastify)",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "tsx",
      "args": ["src/index.ts"],
      "cwd": "${workspaceFolder}/apps/api",
      "env": { "NODE_ENV": "development" },
      "envFile": "${workspaceFolder}/apps/api/.env",
      "console": "integratedTerminal",
      "skipFiles": ["<node_internals>/**"]
    },
    {
      "name": "Debug Web (Next.js)",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["--filter", "@ihui/web", "dev"],
      "cwd": "${workspaceFolder}",
      "console": "integratedTerminal"
    },
    {
      "name": "Debug AI Service (FastAPI)",
      "type": "debugpy",
      "request": "launch",
      "module": "uvicorn",
      "args": ["app.main:app", "--reload", "--port", "8000"],
      "cwd": "${workspaceFolder}/apps/ai-service",
      "justMyCode": true
    }
  ]
}
```

### 6.2 Chrome DevTools 调试 Node

```bash
# 启动 api 时开启 inspector
node --import tsx --inspect=9229 apps/api/src/index.ts
# Chrome 打开 chrome://inspect → 配置 localhost:9229 → Attach
```

### 6.3 Fastify Pino 日志

```typescript
// 路由内通过 request.log 输出(自动带 requestId)
request.log.info({ userId, action: 'login' }, '用户登录成功')
request.log.warn({ ip, count }, '触发速率限制')
request.log.error({ err }, '数据库查询失败')

// 开发环境 pino-pretty 自动美化:
// 17:30:45.123 INFO  (req-abc123): 用户登录成功
//   userId: 42
//   action: "login"
```

> **禁止** `console.log`:ESLint 规则拦截,生产代码必须用 `request.log` 或 `apps/web/src/lib/logger.ts`。

### 6.4 Next.js Turbopack

```bash
# 清缓存重启(解决 HMR 异常 / CSS 不更新)
pnpm --filter @ihui/web dev:clean
# 或用 dev-web.mjs
node scripts/dev-web.mjs --clean

# 构建分析
pnpm --filter @ihui/web build:analyze
```

### 6.5 ai-service uvicorn --reload

```bash
cd apps/ai-service
# 详细日志 + 热重载
uvicorn app.main:app --reload --port 8000 --log-level debug
# structlog 输出 JSON 结构化日志,开发环境可读
```

---

## 7. 常用脚本速查

| 脚本 / 命令 | 用途 |
|---|---|
| `pnpm dev` | turbo 并行启动所有 apps |
| `pnpm build` | turbo 并行构建所有 apps |
| `pnpm typecheck` / `pnpm typecheck:full` | 全量类型检查(清 `.tsbuildinfo` 缓存后 `pnpm -r run typecheck`) |
| `pnpm lint` | turbo 并行 lint |
| `pnpm lint:strict` | `--max-warnings 0` 严格模式 |
| `pnpm test` | turbo 并行跑所有包测试 |
| `pnpm test:e2e` | turbo 跑 E2E(Playwright) |
| `pnpm format` / `pnpm format:check` | Prettier 格式化 / 校验 |
| `pnpm check:all` | 一键守门(api-key-leak + i18n-keys + stale-dist + db-schema-drift + sanitizer-bypass + api-routes + safe-parse) |
| `pnpm knip` | 死代码扫描(配置 `knip.jsonc`) |
| `node scripts/pre-deploy.mjs` | 部署前 10 项硬性门禁自检 |
| `node scripts/pre-deploy.mjs --skip-tests` | 跳过测试的应急自检 |
| `node scripts/pre-deploy.mjs --env production` | 生产模式严格 env 检查 |
| `node scripts/git-push-guard.mjs` | 检测本地 ahead → 自动 push → 验证 local == remote |
| `pnpm push:safe` | git-push-retry.ps1,推送失败自动重试 |
| `powershell -File scripts\kill-dev-servers.ps1` | 清理 3000/3001/8000/8081 端口 + 僵尸 next-server |
| `powershell -File scripts\kill-dev-servers.ps1 -DryRun` | 只显示不杀 |
| `powershell -File scripts\restart-dev-server.ps1` | 重启 dev server |
| `pnpm --filter @ihui/api test` | 后端单元测试(mock 模式) |
| `pnpm --filter @ihui/api test:real` | 后端真实 DB 集成测试 |
| `pnpm --filter @ihui/web e2e` | 前端 E2E(Playwright) |
| `pnpm --filter @ihui/web e2e:ui` | Playwright UI 模式 |
| `pnpm --filter @ihui/web storybook` | Storybook 组件开发 |
| `pnpm --filter @ihui/database db:studio` | Drizzle Studio 可视化 |
| `pnpm cert:check` | 证书过期检查 |
| `pnpm miniapp:preview` | 小程序预览 |

---

## 8. 多端联动开发注意事项

项目是 8 端 + 13 共享包的 Monorepo。完整的"全端连通"强制规则见 [AGENTS.md §9](../AGENTS.md),本节聚焦开发流程实操。

### 8.1 端清单

| 端 | 路径 | 技术栈 |
|---|---|---|
| web | `apps/web` | Next.js 15 + React 19 + Tailwind 4 |
| api | `apps/api` | Fastify 5 + Drizzle ORM + PostgreSQL |
| ai-service | `apps/ai-service` | FastAPI + LangGraph + LiteLLM + MCP |
| desktop | `apps/desktop` | Vite + React(Electron 兼容) |
| extension | `apps/extension` | WXT 浏览器扩展 |
| mobile-rn | `apps/mobile-rn` | React Native + Expo |
| miniapp-taro | `apps/miniapp-taro` | Taro 4 + React |
| cli | `apps/cli` | Node.js + Ink TUI |

### 8.2 共享包

| 包 | 路径 | 作用 |
|---|---|---|
| `@ihui/database` | `packages/database` | Drizzle schema + RLS + 迁移 |
| `@ihui/auth` | `packages/auth` | JWT + OAuth2 + WS 认证 + 黑名单 |
| `@ihui/types` | `packages/types` | 共享 TypeScript 类型 |
| `@ihui/ui` | `packages/ui` | shadcn/ui 组件库 |
| `@ihui/api-client` | `packages/sdk` | API SDK(多语言:TS/Go/Java/Python/.NET) |
| `@ihui/config` | `packages/config` | 环境变量校验 |
| `@ihui/eslint-config` | `packages/eslint-config` | 共享 ESLint 配置 |
| `@ihui/tsconfig` | `packages/tsconfig` | 共享 tsconfig |

### 8.3 联动开发流程

1. **改共享类型**:`packages/types/src/*.ts` → `pnpm typecheck` 确认所有引用端编译通过。
2. **改 schema**:`packages/database/src/schema/` → `db:generate` → 受影响的端(api / ai-service)同步适配查询。
3. **改 API 契约**:`apps/api/src/routes/` → `packages/sdk/src/` 同步 → `apps/web/src/lib/api.ts` 适配 → 跑 `pnpm check:api-routes`。
4. **改共享 UI**:`packages/ui/src/` → `apps/web` 引用处确认渲染正常。
5. **跨端验证**:至少跑 `pnpm typecheck`(全包)+ 受影响端的 `test` + `build`。

> **守门**:`scripts/check-multi-end-sync.mjs`(pre-commit 第 21 项,warn-only)检测单端改动未标注"平台独占"时提醒。

---

## 9. Windows 特有注意事项

| 问题 | 原因 | 解决方案 |
|---|---|---|
| PowerShell 不支持 heredoc | PowerShell 无 `<<'EOF'` 语法 | git commit 用 `-m "..."` 单行;多行用 `` `n `` 连接或写 `.git/COMMIT_EDITMSG` |
| CRLF / LF 换行符 | Windows 默认 CRLF,项目要求 LF | `git config --global core.autocrlf false`;`.gitattributes` 强制 `* text=auto eol=lf` |
| 路径分隔符 | Windows `\` vs Unix `/` | 脚本内用 `path.join()` / `path.sep`;PowerShell 兼容 `/` |
| `pnpm` 命令需 shell:true | Windows 下 `pnpm` 是 `.cmd` 批处理 | Node `spawn` 时设 `shell: true`(见 `dev-web.mjs`) |
| 端口占用 `EADDRINUSE` | 上一轮 dev server 未清理 | `powershell -File scripts\kill-dev-servers.ps1` |
| PowerShell 弹窗污染 | `Start-Process` 默认弹独立窗口 | dev server 永远在 TRAE 终端内用 `RunCommand long_running_process` 跑,不派生独立窗口(见 [AGENTS.md §19](../AGENTS.md)) |
| 长路径限制 | Node `node_modules` 嵌套深 | `git config --system core.longpaths true`;Windows 注册表开启长路径支持 |
| Docker Desktop 卷挂载慢 | Windows 文件系统 + WSL2 桥接 | 开发用 `db:push` 直连本地 PG,不依赖容器卷;或把仓库放 WSL2 文件系统内 |
| `taskkill /F /T` | Windows 无 `pkill` | 清理进程树用 `taskkill /F /T /PID <pid>`(见 `kill-dev-servers.ps1`) |
