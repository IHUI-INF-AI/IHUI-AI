<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 快速开始 · REST/WebSocket API · 能力目录 · 模型自动同步 · IM 多平台 · 数据库

> 本文件是从根 `README.md` 拆出的**原文收纳件**(2026-09-30,台账票 G-814434「README 重写收编重做」)。
> 来源:重写前工作树 `README.md`(6,476 行)以下所注行号区间,逐字搬入,未改写任何一句;整理仅限本文头尾的标题与来源注记。
> 索引层与九份主题文档的总入口见根 [`README.md`](../../README.md)。

---

## 快速开始

### 环境要求

| 工具       | 版本               | 说明                                               |
| ---------- | ------------------ | -------------------------------------------------- |
| Node.js    | `>=22.13.0`        | LTS 22.x,推荐 `nvm use`                            |
| pnpm       | `>=11.0.0`         | 项目固定 `pnpm@11.18.0`,`corepack enable` 自动激活 |
| Python     | `3.12+`            | 仅 `apps/ai-service` 需要                          |
| PostgreSQL | `15+`              | compose 用 `postgres:15-alpine`                    |
| Redis      | `7+`               | compose 用 `redis:7-alpine`                        |
| Docker     | `24+` + Compose v2 | 可选,推荐用于一键启动                              |
| Git        | `2.40+`            | `core.autocrlf=false`(项目强制 LF)                 |

#### Windows 开发机:静默化派生进程(可选,推荐)

Windows 下 Node 的 `child_process` 默认 `windowsHide: false`。当 node 脚本由**无控制台的父进程**(后台推送 worker、计划任务、IDE agent 宿主)派生 git / pnpm / cmd 时,Windows 会为其新分配一个**可见控制台窗口** —— 表现为"桌面不停闪黑窗"。项目内派生点已显式补 `windowsHide: true`;若仍被弹窗干扰,可再装一层机器级钩子,让本机**所有** node 进程默认静默:

```bash
node scripts/install-console-window-hook.mjs --verify   # 巡检,不写盘
node scripts/install-console-window-hook.mjs --apply    # 安装(落盘前先试跑,不通过即拒绝写入)
node scripts/install-console-window-hook.mjs --remove   # 卸载并恢复原 NODE_OPTIONS
```

钩子文件落在**仓库外**的稳定目录(默认 `<TEMP 上级>/ihui-node-hooks`,可用 `IHUI_NODE_HOOKS_DIR` 覆盖),经用户环境变量 `NODE_OPTIONS=--import=file:///...` 生效;显式传 `windowsHide: false` 的调用一律尊重。安装后需重启 IDE / 终端,其新派生的进程才会静默。

为防止以后新写的脚本再次漏参,仓库设有机制守门:`scripts/check-no-visible-spawn.mjs`(pre-commit blocking 第 52 项)会用括号配平提取派生调用,首参可确认为控制台程序(git / node / pnpm / cmd / pwsh 等)而 options 缺 `windowsHide` 时直接拦截。手动审计:`node scripts/check-no-visible-spawn.mjs`,逻辑自检:`--self-test`。

#### Windows 开发机:把开发栈整体迁入无桌面会话(根治弹窗,推荐)

`windowsHide` 这一层只能管**我们自己写的**派生点。本地开发栈重启时弹出的窗口,实际来自 `tsx` / `uvicorn` / pnpm **内部**的 spawn(实测 `tsx` dist 里 `windowsHide` 出现 0 次),那些调用点不在仓库控制内 —— 逐点补参数永远追不上。

根治办法是换**宿主会话**:守护与看门狗以 `LogonType=S4U` 的计划任务运行,落在 session 0(没有桌面),该会话内任何进程都无法在屏幕上产生窗口,与它怎么 spawn 无关。

```bash
pnpm dev:stack:autostart                        # 注册/修复 IHUI-DevStack(S4U)+ 清理旧启动夹自启
node scripts/dev-stack-watchdog.mjs --install   # 看门狗任务同样注册为 S4U
./start-all.bat                                 # 双击即用:schtasks /Run IHUI-DevStack,零本地派生
```

自愈节奏不变(每 30s 体检、挂了立刻重拉,无退避);`IHUI-DevStackWatchdog` 每 2 分钟巡检时顺带核验守护任务仍是 S4U,被改回 `InteractiveToken` 或被删除都会自动重装(故障演练实测 5s 内恢复)。停止:`pnpm dev:safe:stop` · 体检:`pnpm dev:stack:check` · 日志:`.tmp-sync/dev-stack-*.log`。

A/B 实测(同一隐藏采样器 + 同一"故意 `windowsHide:false`"子进程):交互任务 = session 1 弹 1 扇;S4U 任务 = session 0 零扇,且其监听端口从 session 1 经 `127.0.0.1` 正常可达。迁移后实测:api / web / ai-service / redis / prod-proxy / web-preview 六个服务均由 session 0 守护重拉,期间零窗口;metro 只在无真机连接时才迁,避免打断他人调试会话。

### 一键启动(Docker)

```bash
# 1. 克隆
git clone https://github.com/IHUI-INF-AI/IHUI-AI.git IHUI-AI && cd IHUI-AI

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env,填入 JWT_SECRET / DB_PASSWORD / CREDENTIALS_ENCRYPTION_KEY 等

# 3. 一键启动全栈(7 业务 + 7 监控 = 14 服务)
docker compose up -d
```

**服务访问地址:**

| 服务         | URL                              | 说明                                              |
| ------------ | -------------------------------- | ------------------------------------------------- |
| Web          | http://localhost:8801            | Next.js 前端                                      |
| API          | http://localhost:8802/api/health | Fastify 后端健康检查                              |
| Worker       | http://localhost:8830            | BullMQ 异步任务进程                               |
| AI 服务      | http://localhost:8803/health     | FastAPI AI 服务健康检查                           |
| Grafana      | http://localhost:8816            | 默认账号 admin / 修改密码(3 仪表盘自动 provision) |
| Prometheus   | http://localhost:9091            | 指标采集                                          |
| Jaeger UI    | http://localhost:8814            | 分布式追踪                                        |
| Loki         | http://localhost:8818            | 日志聚合                                          |
| Alertmanager | http://localhost:9093            | 告警路由                                          |

### 开发模式(本地)

```bash
# 1. 安装
corepack enable && corepack prepare pnpm@11.18.0 --activate
pnpm install

# 2. 启动数据库 + Redis
docker compose up -d db redis

# 3. 迁移 + 校验 + 种子
pnpm --filter @ihui/database db:migrate
pnpm --filter @ihui/database db:check
pnpm --filter @ihui/database seed          # 7 步幂等 seed

# 4. 一键启动所有 apps(turbo 并行)
pnpm dev
# 或单独启动:
# pnpm --filter @ihui/api run dev          # 后端 :8802
# pnpm --filter @ihui/web run dev          # 前端 :8801
# cd apps/ai-service && uv sync && uvicorn app.main:app --reload --port 8803

# 5. 全量验证(typecheck + lint + test)
pnpm turbo build typecheck lint test
```

### Windows 一键启动(9 PowerShell 脚本)

```powershell
.\scripts\dev-up.ps1                    # 启动 web + api + ai-service + 数据库 + Redis
.\scripts\dev-all.ps1                   # 仅启动 dev server(数据库已在跑)
.\scripts\dev-web.mjs                   # 仅启动 web
.\scripts\kill-dev-servers.ps1          # 停止所有 dev server
.\scripts\restart-dev-server.ps1        # 重启 dev server
.\scripts\setup-token-refresh-task.ps1  # 配置 token 刷新定时任务
.\scripts\cleanup-external-junk.ps1     # 清理外部垃圾文件
```

---

## API 与协议

### REST API(4393 路由)

| 服务                | 端点数 | 前缀                  | 路由文件数 | 覆盖域                                                                                                                                                                                                                                                             |
| ------------------- | ------ | --------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **apps/api**        | 4393   | `/api` + `/api/admin` | 267        | 30+ 业务域(auth/users/billing/content/chat/teams/workspace/agents/coze/oss/order/vip/exam/learn/live/news/topic/search/drama/stock/gdpr/rbac/tenant/community/edu/payment/wallet/point/ranking/distribution/developer/workflows/business-card/customer-service 等) |
| **apps/ai-service** | ~55    | `/api`                | 12 routers | a2a(5)/ agents(9)/ health(4)/ llm(2)/ mcp(10)/ tools(3)/ personas(4)/ voice_stt(3)/ self_media(6)/ publish(8)/ agent_runtime(6)/ legacy                                                                                                                            |

**统一响应格式:**

```typescript
// 成功: { code: 0, message: 'success', data: T }
// 错误: { code: number, message: string }
// 由共享 utils/response.ts 的 success()/error() 生成
```

**认证:** JWT HS256 + token-family 旋转 + refresh 黑名单,access token 7 天有效期,所有端点通过 `@ihui/auth` 共享包统一签发/验证。

### Agent 开放能力(能力目录单一事实源,2026-09-20 立)

第三方 AI Agent 通过**机器凭据**调用本项目能力,能力面由 `packages/types/src/capability-catalog.ts` 一处声明、三处消费(API 闸口 / MCP 门禁 / 文档产物)。

| 要素                | 落点                                                                                                                                                                                              | 说明                                                                                                                                                                                                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 凭据                | `Authorization: Bearer ihui_xxx`(+ `X-Api-Secret` 双因子)                                                                                                                                         | 用户自助签发:`POST /api/developer/api-keys`;可按 scope/IP/模型/时段收紧                                                                                                                                                                                                                               |
| 授权                | `apps/api/src/utils/capability-guard.ts`                                                                                                                                                          | `requireCapability(scope)`;`platform` 域与未登记 scope 一律 403(默认拒绝)                                                                                                                                                                                                                             |
| 数据边界            | `CapabilityEntry.dataClass`                                                                                                                                                                       | `compute`(禁读业务表)/ `scoped-read` / `scoped-write`(强制 owner)/ `platform`                                                                                                                                                                                                                         |
| MCP 接入            | `POST /v1/mcp/*`(API Key)+ `apps/ai-service` `POST /api/mcp`、`/api/mcp/export/*`                                                                                                                 | 匿名 tools/call 已关闭;逐工具按目录裁决 scope                                                                                                                                                                                                                                                         |
| 产物                | `packages/types/generated/capabilities.json`                                                                                                                                                      | `pnpm capabilities:export` 生成;`--check` 防漂移                                                                                                                                                                                                                                                      |
| 协议兼容            | `/v1`(OpenAI)/`/v1beta`(Gemini)/`/v1/messages`(Anthropic)/`/v1/realtime`(WS)                                                                                                                      | 官方 SDK 可直接指向本项目                                                                                                                                                                                                                                                                             |
| 限流                | `RATE_PROFILES`(按 risk)+ key 级 5h/1d/7d 窗口 + nginx `limit_req`                                                                                                                                | 限流后端不可用时 billable 能力 fail-closed(503)。key 上的 `rateLimit` 字段**已废弃**(鉴权链零读取点,设了不生效):携带即回 `Deprecation` + `X-Ihui-Deprecated-Fields`,生效窗口只有 5h/1d/7d 与 per-model RPM/TPM                                                                                        |
| MCP 工具面 scope    | `GET /v1/mcp/tools` / `POST /v1/mcp/resources/read` → `tools:read`;`POST /v1/mcp/tools/call` → `tools:call`                                                                                       | 与 `mcp:connect` **无关** —— 后者只服务"把 IHUI 当作 MCP server 长连接接入"(由 ai-service 提供)。申请错会恒 403                                                                                                                                                                                       |
| 不开放              | 账号/计费变更、社媒发布、本机 GUI 控制、沙箱命令、外部消息触达、连接器配置枚举                                                                                                                            | `computer:operate` / `publish:operate` / `sandbox:run` / `diff:apply` / `im:send` / `connectors:read`                                                                                                                                                                                                 |
| OAuth 2.1 提供方    | `/.well-known/oauth-authorization-server`、`/oauth/register`(RFC 7591 DCR)、`/oauth/token`(含 `client_credentials`)、`/oauth/introspect`、`/oauth/revoke`                                         | 授权码链路已真正校验 PKCE(此前形同虚设);discovery 只声明已实现的能力                                                                                                                                                                                                                                  |
| A2A 发现            | `/.well-known/agent.json`(+ `agent-card.json` 别名)                                                                                                                                               | `skills[]` 全部由能力目录派生并剔除门禁不放行的 scope，无真实素材的字段宁缺不假报                                                                                                                                                                                                                     |
| 幂等                | `Idempotency-Key`（带则生效，不带行为不变）                                                                                                                                                       | `idem:<key\|user>:<scope>:<client key>`；进行中 409、已完成原样重放且不重复计费；Redis 断连有 1s 截止避免 fail-hang                                                                                                                                                                                   |
| `/api` 面开放       | `apps/api/src/config/open-capability-registry.ts` 逐条登记（精确路径 + `:param`，**无**前缀通配）                                                                                                 | 未携带 API Key 时根级闸完全 no-op；族内新增端点不会被"顺手开放"                                                                                                                                                                                                                                       |
| 契约产物            | `apps/api/openapi.json`（入库,3778 path / 4763 operation）                                                                                                                                        | `pnpm openapi:export` 由真实 Fastify 启动图导出;`pnpm openapi-check` 阻断"目录声明了但契约里没有",CI 另做产物漂移比对                                                                                                                                                                                 |
| 对外 run 句柄       | `POST /v1/threads/:id/runs` 返回 `irun_<ulid>`,`GET /v1/run-refs/:ref` 反查(runs:read)                                                                                                            | 第三方无需保存 IHUI 内部 runId;`external_id` 反查已实现(`GET /v1/threads/runs/by-external-id/:externalId`,按调用方 userId 命名登记,跨用户查不到且与"不存在"响应体逐字节相同)                                                                                                                          |
| 分页口径            | `/v1` 列表端点统一 `limit` / `after` / `page_format`,响应带 `has_more` 与 `next_cursor`                                                                                                           | 单一实现 `apps/api/src/utils/cursor-page.ts`;内部 `/api/*` 仍用 `page/pageSize`,两套不得互穿                                                                                                                                                                                                          |
| 接入自证            | `node scripts/e2e-agent-access.mjs`（离线）/ `--live`（只读探测）                                                                                                                                 | 四通道 + 匿名/越权默认拒绝 + 配额 429 的可重复判据,不依赖任何服务在跑;另含 OFF-02c/d 两条配置漂移判据(见下行)                                                                                                                                                                                         |
| ai-service 免鉴权面 | 三条边界钉进 `apps/ai-service/app/core/jwt_auth.py`：`_ALWAYS_PUBLIC`(A2A/OAuth 发现必须匿名) · `_NEVER_PUBLIC_ROOTS`(特权 router 根禁止匿名) · `_CATCH_ALL_PUBLIC_ENTRIES`(`/`、`/api` 一律剔除) | `.env` 被 gitignored 且对 `JWT_PUBLIC_PATHS` 是**整串替换**而非增量合并 ⇒ 一台机器的配置手误等于永久改掉部署态白名单、换机不留痕。故代码侧强制剔除 + 告警,门禁则按 **.env 原文**判定(判据不吃"代码是否已加固"——**运行时无害 ≠ 配置债已清**);特权根清单由脚本从源码元组实读,加一个新根守门必须跟随变红 |

治理文档：[capabilities](./docs/developer/capabilities.md) · [data-classes](./docs/developer/data-classes.md) · [rate-limits](./docs/developer/rate-limits.md) · [error-codes](./docs/developer/error-codes.md) · [abuse-policy](./docs/developer/abuse-policy.md) · [compliance](./docs/developer/compliance.md)

详见 [docs/developer/capabilities.md](./docs/developer/capabilities.md)。

### WebSocket 端点(12 个)

| 端点                            | 用途                                                             |
| ------------------------------- | ---------------------------------------------------------------- |
| `/ws/notifications`             | 全局通知推送(多端同步,Redis Pub/Sub 广播)                        |
| `/ws/room/:roomId`              | 聊天室消息(多用户房间)                                           |
| `/ws/customer-service`          | 客服会话(1 对 1)                                                 |
| `/ws/payment/status/:orderNo`   | 支付状态实时更新                                                 |
| `/ws/broadcast`                 | 通用广播                                                         |
| `/ws/agent/stream`              | Agent 流式输出(步骤 / 工具调用 / 思考,interrupt/continue/cancel) |
| `/ws/tts/stream`                | TTS 流式合成(文本 → 音频,支持中断)                               |
| `/ws/realtime/pcm`              | 双向实时音频(ASR 输入 + TTS 输出,PCM16 16kHz)                    |
| `/v1/ai/capabilities/ws/stream` | 通用 AI 能力流(代理到 AI 服务 SSE)                               |
| `/ws/stock/stream`              | 股票行情流                                                       |
| `/ws/timbre/generate`           | 音色克隆生成流                                                   |
| `/ws/coze/chat`                 | Coze 对话流                                                      |
| `/ws/live/chat`                 | 直播聊天室                                                       |

所有 WS 端点通过 `wsAuth(socket, token)` 校验 JWT,支持心跳 ping/pong,多实例通过 Redis Pub/Sub 跨实例广播。

---

## 模型自动同步(ModelSyncService)

AI 服务内置 ModelSyncService,自动从已配置 key 的 provider 拉取最新模型清单,注册到数据库,无需手动改 `default_models.json`。

### 核心能力

- **自动同步**:启动后 60s 首次同步,之后每 6 小时全量同步(可配置)
- **多 Provider 适配**:OpenAI 兼容 / Cloudflare Workers AI(/models/search) / Anthropic(/v1/models) / Google Gemini(/v1beta/models)
- **错误分类处理**:401/403/404/429/5xx 分类,404 永久禁用,429 长退避,5xx 指数退避重试
- **连续失败自动禁用**:连续 3 次失败标记 unhealthy,跳过同步(可手动重置)
- **增量同步**:ETag / Last-Modified 缓存,304 Not Modified 跳过 upsert
- **深度元数据**:display_name 智能派生 / pricing 多 schema 适配 / context_length 6 级 fallback / 模型分类标签(vision/tool/reasoning/fast/embedding/chat) / vendor 自动推断 / max_output_tokens / supports_tool_call / supports_vision / rate_limit / release_date / deprecation_date
- **事务安全**:DB 事务包裹 upsert,中途失败回滚
- **Prometheus 指标**:6 个指标(operations/latency/new_models/removed_models/provider_health/total_models)
- **Provider 级别并发锁**:同一 provider 同时只允许一个同步任务

### Admin API 端点

| 方法   | 路径                                          | 用途                                                                   |
| ------ | --------------------------------------------- | ---------------------------------------------------------------------- |
| POST   | `/api/llm/models/sync`                        | 手动触发全量同步(可选 `?provider=xxx` 定向,`?dry_run=true` 预览)       |
| GET    | `/api/llm/models/sync/status`                 | 查询最近同步状态(每个 provider 的结果)                                 |
| GET    | `/api/llm/models/sync/history`                | 查询同步历史(可选 `?limit=20`)                                         |
| GET    | `/api/llm/models/sync/health`                 | 查询 provider 健康状态(失败计数 + 永久禁用列表)                        |
| POST   | `/api/llm/models/sync/reset?provider=xxx`     | 重置 provider 失败计数 + 重新启用(v4)                                  |
| PUT    | `/api/llm/models/sync/config`                 | 运行时更新同步配置(v4,body: `{"interval_s": 21600, "concurrency": 5}`) |
| GET    | `/api/llm/models/sync/stats?days=7`           | 查询聚合统计(成功率/延迟/新增下架数)(v4)                               |
| DELETE | `/api/llm/models/sync/history?before_days=30` | 清理旧同步日志(v4)                                                     |

### 配置项(.env)

| 环境变量                 | 默认值  | 说明                                 |
| ------------------------ | ------- | ------------------------------------ |
| `MODEL_SYNC_INTERVAL_S`  | `21600` | 同步间隔(秒,默认 6 小时)             |
| `MODEL_SYNC_CONCURRENCY` | `5`     | 并发拉取数(同时拉取的 provider 数量) |

运行时可通过 `PUT /api/llm/models/sync/config` 端点动态调整,无需重启服务。

---

## IM 多平台远程连接控制(2026-07-31 立,P0)

16 平台 IM 网关:统一适配器配置 + webhook 入站 + 出站发送 + 消息历史 + LLM 自动回复。Admin 后台 `/admin/im-channels` 一站式管理。

### 16 平台清单

飞书 / 企业微信 / 钉钉 / Discord / Telegram / Slack / 微信公众号 / Webhook(通用)/ WhatsApp / Line / KakaoTalk / Signal / Matrix / Rocket.Chat / Mattermost / Zulip

每平台元数据含 `displayName / icon / inboundFieldType / signatureHeader / signatureEncoding / outboundApiPattern / supportsLarkCli / fields[]`,前端按 `fields` schema 动态渲染配置表单(text/password/url/switch)。飞书独有 `useLarkCli` 长连接模式(走 `lark-cli` SDK 替代 webhook)。

### API 端点(7 个,前缀 `/api`)

| 方法 | 路径                            | 鉴权 | 用途                                               |
| ---- | ------------------------------- | ---- | -------------------------------------------------- |
| GET  | `/im-gateway/platforms`         | 登录 | 16 平台元数据(含 fields schema,供前端动态表单)     |
| GET  | `/im-gateway/adapters`          | 登录 | 当前用户已配置的适配器列表                         |
| POST | `/im-gateway/adapters`          | 登录 | upsert 适配器配置(by platform,凭证加密存储)        |
| GET  | `/im-gateway/status`            | 登录 | 16 平台连接状态(enabled / lastError / lastSeenAt)  |
| GET  | `/im-gateway/messages`          | 登录 | 消息历史(分页,可按 platform / direction 过滤)      |
| POST | `/im-gateway/send`              | 登录 | 主动发送出站消息(text/image/file/audio/video/card) |
| POST | `/im-gateway/webhook/:platform` | 验签 | 接收 IM 平台 webhook(无需登录,HMAC-SHA256 验签)    |

### 数据持久化

PostgreSQL 2 张表(`packages/database/src/schema/im-adapters.ts`):

- `im_adapters`:per-user per-platform 适配器配置(userId / platform / enabled / config JSON / 凭证加密 / lastError / lastSeenAt)
- `im_messages`:入站+出站消息历史(userId / platform / direction / content / rawPayload JSON / createdAt,按 createdAt desc 索引)

迁移文件:`packages/database/drizzle/20260801010200_add_im_tables.sql`

### LLM 自动回复(ai-service)

`apps/ai-service/app/services/im_bridge.py` 消费 Redis 队列 `im:inbound`,调用 LiteLLM 生成回复,通过 `/api/im-gateway/send` 回投。支持 per-platform 启用/禁用自动回复,避免人机混发。

### Webhook 验签

入站 webhook 按 `signatureEncoding` 配置做 HMAC-SHA256 验签(`hex` / `base64` / `none` 三档),`timingSafeEqual` 恒定时间比较防时序攻击。验签失败返回 401 不入库。

### 跨端契约

- 类型:`packages/types/src/im-gateway.ts`(16 平台枚举 + 适配器配置 + 网关状态 + 消息历史 + 富卡片 `ImRichCard` / `ImCardElement` / `ImCardAction` / 文件 / 音视频 / 审批 7 类消息)
- API 客户端:`packages/api-client/src/endpoints/im-channel.ts`(`getPlatforms / getAdapters / upsertAdapter / getStatus / getMessages / sendMessage`)
- Admin 前端:`apps/web/app/(main)/admin/im-channels/`(PlatformList + AdapterConfigForm + MessageHistory 三组件)

---

## 数据库

- **单库设计**:PostgreSQL 15,单库 `ihui`,通过 schema 隔离业务域
- **542 表**:205 个 schema 模块文件,覆盖 30+ 业务域
- **drizzle-kit push**:`packages/database/drizzle/`,drizzle-kit generate 生成 + 手动增量(实际 drizzle-kit push文件,含 pgvector / 知识图谱 / RLS 多租户隔离等关键迁移)
- **7 步幂等 seed**:`packages/database/seed/`,模式化 + 容错隔离
- **行级安全**:RLS(Row Level Security)在关键字段启用,多租户隔离
- **读副本**:read-replica + tenant-router 路由查询
- **类型安全**:Drizzle ORM 0.45,TypeScript strict 模式,端到端类型推导
- **关键 schema 模块**:users / auth-identity / oauth-private-keys / agents-extended / agent-commerce / ai-capabilities / ai-cost / learn(45 表)/ exam / certificate / content / news-crawler / self-media / publish-platform / community / order / billing / wechat-pay-contracts / refund-audit / point / wallet / funds / commission / member / teams / tenant / rbac / workspace-permissions / system / canary / ab-tests / live / customer-service / business-cards / stock / trader / developer / sdks / webhooks / workflow / projects / knowledge-base / knowledge-rag / search-contents / cli-provider-imports / email-logs / sensitive-words / audit / visit-tracking / behavior / analytics-events / gamification

---

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
