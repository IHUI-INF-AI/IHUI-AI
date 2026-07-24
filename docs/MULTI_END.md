# 多端架构与同步开发

> IHUI-AI 8 端独立代码 + 14 共享包的架构总览、跨端调用链路、同步开发规则与多端发布矩阵。同步开发强制规则见 [AGENTS.md §9](../AGENTS.md),本文档聚焦架构与代码组织、链路打通与发布矩阵,不重复规则条款。

---

## 1. 总览

IHUI-AI 是全栈 AI 平台,采用 TS Monorepo(pnpm workspace + Turborepo)组织 **8 个独立端** + **14 个共享包**,通过共享层实现跨端类型契约与组件复用。

- **8 端**:`apps/web`、`apps/api`、`apps/ai-service`、`apps/cli`、`apps/desktop`、`apps/extension`、`apps/mobile-rn`、`apps/miniapp-taro`
- **14 共享包**:`packages/` 下的 `auth`/`config`/`database`/`types`/`ui-react`/`ui-native`/`design-tokens`/`api-client`/`context-compaction`/`eslint-config`/`tsconfig`/`sdk`/`shared`/`app`(详见 [PACKAGES.md](./PACKAGES.md))
- **同步规则**:见 [AGENTS.md §9 多端同步开发强制规则](../AGENTS.md),默认每个任务全端连通

### 架构分层

```
┌─────────────────────────────────────────────────────────┐
│  端层(8 端独立代码,apps/*)                              │
│  web │ api │ ai-service │ cli │ desktop │ extension │   │
│  mobile-rn │ miniapp-taro                                │
├─────────────────────────────────────────────────────────┤
│  共享层(14 包跨端复用,packages/*)                       │
│  @ihui/auth @ihui/api-client @ihui/types @ihui/database │
│  @ihui/ui-react @ihui/ui-native @ihui/design-tokens     │
│  @ihui/config @ihui/context-compaction @ihui/sdk        │
│  @ihui/shared @ihui/app                                  │
│  @ihui/eslint-config @ihui/tsconfig                     │
├─────────────────────────────────────────────────────────┤
│  基础设施层                                              │
│  PostgreSQL 15 │ Redis 7 │ Docker Compose │ Nginx       │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 8 端架构矩阵

| 端 | 代码路径 | 技术栈 | 端口 | 主要功能 |
|----|----------|--------|------|----------|
| Web | `apps/web/` | Next.js 15 + React 19 + Tailwind 4 + shadcn/ui | 8801(开发)/ 3000 | 200+ 页面,主站 + 管理后台 |
| API | `apps/api/` | Fastify 5 + Drizzle ORM 0.38 + PostgreSQL | 8802 | ~1080 端点,业务管理 + 多厂商代理 + 认证 + WebSocket |
| AI Service | `apps/ai-service/` | FastAPI + LangGraph + LiteLLM + MCP | 8803 / 8000 | ~55 端点,LLM 网关 + Agent 执行 + MCP 工具 + A2A |
| CLI | `apps/cli/` | TS(commander + inquirer + ws) | 终端 | 24 源配置导入 + subagent 并行 + ACP 协议 + TUI |
| Desktop | `apps/desktop/` | Tauri 2.1 + React 18 + Vite | 桌面 | 系统托盘 + 深链接 + 自动更新 + 文件系统 |
| Extension | `apps/extension/` | WXT 0.19 + React 19 | 浏览器 | 浏览器上下文菜单 + token 注入 + 页面增强 |
| Mobile RN | `apps/mobile-rn/` | React Native 0.74.5 + Expo 51 + NativeWind | 8805 | 移动端 + SSO + 生物认证 + 推送 |
| Miniapp Taro | `apps/miniapp-taro/` | Taro 4.2 + React 18 + Tailwind | 微信小程序 | 多端小程序(微信/支付宝/百度/字节/H5)+ 微信支付 |

> 端口分配规则详见 [docs/port-management.md](./port-management.md),统一使用 `88xx` 段。

### 2.1 apps/web(Next.js 15)

- **框架**:Next.js 15.1 + React 19,Turbopack(开发)+ Webpack(生产 standalone 输出)
- **样式**:Tailwind CSS 4 + shadcn/ui,复用 `@ihui/ui-react`
- **状态**:`@tanstack/react-query` 5(服务端状态)+ Zustand(客户端状态)
- **i18n**:next-intl,5 语言(详见 [I18N.md](./I18N.md))
- **路由**:`app/` 目录,`(auth)/` 认证区 + `(main)/` 主区(81 页面)+ `admin/` 管理端
- **API 调用**:统一封装 `src/lib/api.ts`(`fetchApi<T>`),自动携带 JWT,解析 `{ code, message, data }`
- **端口**:开发 8801,Lighthouse CI 用 3000

### 2.2 apps/api(Fastify 5)

- **框架**:Fastify 5.1 + @fastify/jwt + @fastify/websocket + @fastify/rate-limit
- **ORM**:Drizzle ORM 0.38 + postgres-js,单库 PostgreSQL 15
- **认证**:`@ihui/auth` 共享包(JWT HS256 + token-family + blacklist + OAuth2)
- **验证**:Zod 3.24
- **路由**:37 文件 447 端点,公共路由(`/api/*`)+ 管理员路由(`/api/admin/*`)
- **WebSocket**:12 端点(详见 [architecture.md §3](./architecture.md))
- **端口**:8802

> 详见 [architecture.md §1 后端 API](./architecture.md)。

### 2.3 apps/ai-service(FastAPI)

- **框架**:FastAPI 0.115 + Uvicorn
- **AI 编排**:LangGraph 0.2(StateGraph 工作流 plan → execute → summarize)
- **LLM 网关**:LiteLLM(多模型统一接口,含 stub 模式)
- **MCP**:MCP SDK(11 工具 + 3 资源 + 3 提示词)
- **A2A**:Agent-to-Agent 协议(Redis 持久化 + 内存降级)
- **向量记忆**:嵌入 + 余弦相似度语义搜索
- **端口**:8803(docker-compose)/ 8000(直接 uvicorn)

> 详见 [architecture.md §5 AI 服务架构](./architecture.md) 与 [AI_SERVICE.md](./AI_SERVICE.md)。

### 2.4 apps/cli(TS CLI)

- **框架**:commander(命令解析)+ inquirer(交互)+ chalk/ora(TUI)+ ws(WebSocket)
- **协议**:Agent Client Protocol(ACP,`@agentclientprotocol/sdk`)+ Language Server Protocol(vscode-jsonrpc)
- **能力**:24 源配置导入 + subagent 并行 + plan 模式 + memory 嵌入 + mermaid 渲染 + voice + skills 同步
- **i18n**:`src/i18n/messages/`(en/ja/ko 3 语言,独立于 web 的 next-intl)
- **发布**:npm 公开包(`@ihui/cli`,`bin: ihui`)

### 2.5 apps/desktop(Tauri 2.1)

- **框架**:Tauri 2.1(Rust 后端 `src-tauri/`)+ React 18 + Vite
- **能力**:系统托盘 + 深链接(`@tauri-apps/plugin-deep-link`)+ 文件系统 + 自动更新(`@tauri-apps/plugin-updater`)+ 通知 + shell
- **i18n**:`src/i18n/`
- **复用**:`@ihui/api-client` + `@ihui/types` + `@ihui/ui-react`

### 2.6 apps/extension(WXT 浏览器扩展)

- **框架**:WXT 0.19 + React 19(`@wxt-dev/module-react`)
- **能力**:浏览器上下文菜单 + token 注入(`lib/token.ts`)+ 页面增强
- **配置**:`wxt.config.ts`
- **复用**:`@ihui/api-client` + `@ihui/types` + `@ihui/ui-react` + `@ihui/design-tokens`

### 2.7 apps/mobile-rn(React Native + Expo)

- **框架**:React Native 0.74.5 + Expo 51 + NativeWind 4
- **导航**:`@react-navigation/native`(bottom-tabs + native-stack)
- **能力**:SSO(`src/lib/sso.ts`)+ 生物认证(`expo-local-authentication`)+ 推送(`expo-notifications`)+ 安全存储(`expo-secure-store`)+ 视频(`react-native-video`)
- **复用**:`@ihui/api-client` + `@ihui/types` + `@ihui/ui-native` + `@ihui/design-tokens`
- **端口**:8805(`expo start --port 8805`)

### 2.8 apps/miniapp-taro(Taro 4 小程序)

- **框架**:Taro 4.2 + React 18 + Tailwind 3.4
- **多端**:微信(weapp)/ 支付宝(alipay)/ 百度(swan)/ 字节(tt)/ H5
- **状态**:Zustand
- **i18n**:`src/i18n/`(en/ja/ko 3 语言)
- **复用**:`@ihui/api-client` + `@ihui/types`

---

## 3. 共享层(packages/)

14 个共享包跨端复用,避免重复实现。详见 [PACKAGES.md](./PACKAGES.md)。

| 包 | 用途 | 主要消费端 |
|----|------|------------|
| `@ihui/auth` | JWT + token-family + blacklist + data-scope + OAuth2 + ws-auth | api / web / cli / desktop / extension / mobile-rn |
| `@ihui/api-client` | 统一 API 客户端(endpoints + circuit-breaker + ws-client) | web / cli / desktop / extension / mobile-rn / miniapp-taro |
| `@ihui/types` | 跨端类型契约(user/api/ai/agent/workspace 等) | 全端 |
| `@ihui/database` | Drizzle schema(160+ 表)+ 迁移 + client + RLS | api / ai-service(只读) |
| `@ihui/ui-react` | Web 组件库(Button/Input/Card/Dialog/Tabs/Tooltip 等 25+) | web / desktop / extension |
| `@ihui/ui-native` | React Native 组件库(avatar/badge/button/card/dialog/input/loading/switch/tabs/vip-badge,10 组件) | mobile-rn |
| `@ihui/design-tokens` | 跨端基础原语(cn + HSL/HEX tokens + CSS 变量) | web / extension / mobile-rn / desktop |
| `@ihui/config` | constants + env 配置 | 全端 |
| `@ihui/context-compaction` | 上下文压缩(88% 阈值自动压缩) | cli / api / ai-service |
| `@ihui/sdk` | 多语言 SDK(TS/Go/Python/Java/.NET) | 外部集成 |
| `@ihui/shared` | 8端共享业务逻辑(auth/sso + memory + notifications + plan + workflows 等) | 全端 |
| `@ihui/app` | RN app 共享逻辑(AboutScreen/ProfileScreen/SettingsScreen + tokens) | mobile-rn / web |
| `@ihui/eslint-config` | base/next/react ESLint 配置 | 全端 |
| `@ihui/tsconfig` | base/nextjs/node/react-library TSConfig | 全端 |

> `@ihui/sdk` 还提供 Go / Python / Java / .NET 多语言 SDK,供外部系统接入,见 `packages/sdk/` 各子目录。

---

## 4. 跨端调用链路

所有端的业务最终汇聚到 `apps/api`(Fastify),AI 推理汇聚到 `apps/ai-service`(FastAPI)。web 通过 Next.js rewrites 代理分流。

### 4.1 web → api → ai-service

```
浏览器
  └─ apps/web (Next.js 8801)
       ├─ /api/llm/*     ─┐
       ├─ /api/agents/*   ─┤  Next.js rewrites
       ├─ /api/mcp/*      ─┼─→ apps/ai-service (FastAPI 8803) /api/*
       ├─ /api/a2a/*      ─┤
       ├─ /api/ai/*       ─┘  → ai-service /api/v1/ai/*
       └─ /api/*          ──→ apps/api (Fastify 8802) /api/*
            ├─ Drizzle ORM → PostgreSQL 15
            ├─ Redis 7(缓存/限流/Pub/Sub)
            └─ @ihui/auth(JWT 校验)
```

**Next.js rewrites 配置**(`apps/web/next.config.ts`):
- AI 服务路由(`/api/llm`、`/api/agents`、`/api/tools`、`/api/mcp`、`/api/a2a`、`/api/ai`)优先匹配,转发到 FastAPI
- 其余 `/api/*` 转发到 Fastify 后端

### 4.2 cli → api

```
终端
  └─ apps/cli (ihui 命令)
       ├─ @ihui/api-client → apps/api (Fastify 8802) /api/*
       ├─ ACP 协议(vscode-jsonrpc)→ IDE 集成
       └─ WebSocket(ws)→ apps/api /ws/* 流式
```

### 4.3 mobile-rn → api

```
移动设备
  └─ apps/mobile-rn (Expo 8805)
       ├─ @ihui/api-client → apps/api (Fastify 8802) /api/*
       ├─ expo-secure-store(token 安全存储)
       └─ expo-notifications → 推送 token 注册到 api
```

### 4.4 extension → api

```
浏览器
  └─ apps/extension (WXT)
       ├─ lib/token.ts(从 cookie/localStorage 注入 token)
       └─ @ihui/api-client → apps/api (Fastify 8802) /api/*
```

### 4.5 desktop → api

```
桌面
  └─ apps/desktop (Tauri)
       ├─ @tauri-apps/plugin-http(原生 HTTP)
       ├─ @ihui/api-client → apps/api (Fastify 8802) /api/*
       └─ @tauri-apps/plugin-store(token 持久化)
```

### 4.6 miniapp-taro → api

```
微信小程序
  └─ apps/miniapp-taro (Taro)
       ├─ @tarojs/taro.request → apps/api (Fastify 8802) /api/*
       └─ 微信支付 → apps/api /api/order/* + /api/payment/*
```

### 4.7 跨端 WebSocket

`apps/api` 提供 12 个 WebSocket 端点(详见 [architecture.md §3](./architecture.md)),多端共享:
- `/ws/notifications`:全局通知推送(多端同步,Redis Pub/Sub 广播)
- `/ws/room/:roomId`:聊天室
- `/ws/agent/stream`:Agent 流式输出(web / cli / desktop 共用)

**鉴权**:所有 WS 端点通过 `@ihui/auth` 的 `wsAuth(socket, token)` 校验 JWT。

---

## 5. 同步开发规则(落地)

同步开发强制规则见 [AGENTS.md §9](../AGENTS.md)。本节聚焦"怎么落地"。

### 5.1 全端连通三层标准

每个任务默认必须满足三层:

| 层 | 标准 | 验证方式 |
|----|------|----------|
| 代码同步 | 各端代码同步改动,共享类型/UI/schema 跨端引用一致 | typecheck |
| 链路打通 | 跨端调用链路实测连通,任一端不报契约错/类型错/路由错/404 | curl / browser / 实际调用 |
| 验证齐绿 | 受影响的各端 typecheck + build + test 全绿 | `pnpm turbo build typecheck lint test` |

### 5.2 平台独占豁免

仅当任务**天然只属特定端**时可豁免全端同步,**必须在 `PROJECT_PLAN.md` 显式标注**:

| 平台独占场景 | 端 | 示例 |
|--------------|----|----|
| 系统托盘 | desktop | Tauri tray icon |
| 浏览器上下文菜单 | extension | WXT contextMenus API |
| 微信支付 | miniapp-taro | `wx.requestPayment` |
| 终端集成 | cli | ACP 协议 / TUI |
| 纯 README/文档/守门脚本 | — | 不涉及运行时能力 |

> 未标注的按全端同步执行,不得自行默判"这个只属单端"。

### 5.3 多端同步守门

`scripts/check-multi-end-sync.mjs`(pre-commit 第 21 项,warn-only)检测 staged 文件跨端分布,详见 [GATEKEEPERS.md 第 21 项](./GATEKEEPERS.md)。

4 场景:
- 纯豁免目录(scripts/.husky/docs/AGENTS.md/PROJECT_PLAN.md 等)→ pass
- 触及 `packages/*` 共享包且未在 PROJECT_PLAN.md 标注"共享包 only/跨端共享"→ warn
- 触及 ≥2 端 → pass(满足全端连通)
- 触及 1 端且未在 PROJECT_PLAN.md 标注"跨端:仅 X 端 / 平台独占 / X 独占"→ warn

---

## 6. 多 Subagent 并行派单

多端任务优先用 §11 多 Subagent 并行模式,按端拆分 subagent。派单规则见 [AGENTS.md §11](../AGENTS.md),本节聚焦派单模板实操。

### 6.1 派单模板(强制格式)

派发子任务时必须用以下格式,缺一拒绝执行:

```markdown
## 任务目标
<一句话>

## 受影响文件(绝对路径,只允许以下文件)
- g:\IHUI-AI\path\to\file1
- g:\IHUI-AI\path\to\file2

## 禁止修改
- 任何不在上述清单的文件

## 验证命令(子任务完成后必须自行运行)
- pnpm --filter @ihui/web typecheck
- pnpm --filter @ihui/api test

## 约束边界
- <API 契约/类型/样式/行为约束>

## 交付物
- 完整代码 + 自验通过 + 一句话总结
```

### 6.2 按端拆分 subagent

主 agent 派发多端任务时,按端拆分,每个 subagent 只管自己端的代码 + typecheck + build:

| subagent | 负责范围 | 验证命令 |
|----------|----------|----------|
| web-subagent | `apps/web/` | `pnpm --filter @ihui/web typecheck` |
| api-subagent | `apps/api/` | `pnpm --filter @ihui/api typecheck && pnpm --filter @ihui/api test` |
| ai-service-subagent | `apps/ai-service/` | `pytest` |
| cli-subagent | `apps/cli/` | `pnpm --filter @ihui/cli typecheck` |
| desktop-subagent | `apps/desktop/` | `pnpm --filter @ihui/desktop typecheck` |
| extension-subagent | `apps/extension/` | `pnpm --filter @ihui/extension typecheck` |
| mobile-rn-subagent | `apps/mobile-rn/` | `pnpm --filter @ihui/mobile-rn typecheck` |
| miniapp-taro-subagent | `apps/miniapp-taro/` | `pnpm --filter @ihui/miniapp-taro typecheck` |

### 6.3 主 agent 职责

主 agent 负责:
- **跨端契约对齐**:共享类型(`packages/types`)/ API 路由 / schema
- **最终全链路连通验证**:不得把"跨端连通"下放给单个 subagent
- **统一 push**:subagent 完成后由主 agent 统一 push(见 [AGENTS.md §11 联动规则](../AGENTS.md))

---

## 7. 跨端类型契约

`packages/types` 是跨端类型契约的唯一来源,所有端通过 `@ihui/types` 共享类型定义。

### 7.1 类型文件组织

| 文件 | 用途 |
|------|------|
| `src/api.ts` | API 请求/响应类型(`{ code, message, data }` 包装) |
| `src/api-contracts.ts` | API 契约(端点入参/出参类型) |
| `src/user.ts` | 用户类型 |
| `src/ai.ts` | AI 对话 / 模型类型 |
| `src/agent-runtime.ts` | Agent 运行时类型 |
| `src/workspace.ts` | 工作区类型 |
| `src/cli-config.ts` | CLI 配置类型 |
| `src/hooks.ts` | Webhook 类型 |
| `src/notification.ts` | 通知类型 |
| `src/rules.ts` | 规则类型 |
| `src/memory.ts` | 记忆类型 |
| `src/subagent-dispatch.ts` | subagent 派单类型 |

### 7.2 API 契约对齐

API 契约(`api-contracts.ts` + `v1-endpoints.ts`)定义端点入参/出参,前后端共享:
- 后端 `apps/api/src/routes/*.ts` 实现端点,返回 `{ code, message, data }`
- 前端 `@ihui/api-client` 的 `endpoints/*.ts` 调用端点,类型由 `@ihui/types` 保证
- `check-api-routes.mjs`(pre-commit 第 8 项)守门前后端路由一致性

> 修改 API 契约时,必须同步更新 `packages/types` + `@ihui/api-client` + 各消费端。

---

## 8. 端到端测试

每端有独立的测试方式:

| 端 | 测试框架 | 测试目录 | 覆盖 |
|----|----------|----------|------|
| web | Playwright + Vitest | `apps/web/e2e/` + `apps/web/tests/` | 25+ e2e spec + 视觉回归 |
| api | Vitest | `apps/api/tests/` | 45+ 测试文件,Fastify inject 模式 |
| ai-service | pytest | `apps/ai-service/tests/` | 13 文件 400 用例 |
| cli | Vitest | `apps/cli/tests/` | 27 测试文件 |
| desktop | Vitest + Testing Library | `apps/desktop/tests/` | i18n + token |
| extension | Vitest | `apps/extension/`(配置就绪) | `--passWithNoTests` |
| mobile-rn | Vitest + Testing Library | `apps/mobile-rn/tests/` | setup |
| miniapp-taro | Vitest | `apps/miniapp-taro/`(配置就绪) | `--passWithNoTests` |

> 详见 [TESTING.md](./TESTING.md)。

---

## 9. 多端发布矩阵

发布配置在 `deploy/` 目录,覆盖 14 平台。发布流程详见 [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md),本节聚焦多端发布矩阵。

| 端 | 发布平台 | 配置/产物 | 发布方式 |
|----|----------|-----------|----------|
| web | Docker + Nginx | `deploy/docker/Dockerfile.web` | docker-compose + Nginx reverse proxy |
| api | Docker | `deploy/docker/Dockerfile.api` | docker-compose |
| ai-service | Docker | `apps/ai-service/Dockerfile` | docker-compose |
| cli | Docker + npm | `deploy/docker/Dockerfile.cli` + npm publish | `npm publish`(公开包 `@ihui/cli`) |
| desktop | winget + scoop + homebrew + snap | `deploy/winget/` + `deploy/scoop/` + `deploy/homebrew/` + `deploy/snap/` | Tauri updater + 4 包管理器 |
| extension | Chrome Web Store | `wxt zip` 产物 | 手动上传 / CI 自动发布 |
| mobile-rn | App Store + Play Store | `apps/mobile-rn/eas.json`(EAS Build) | `eas build` + `eas submit` |
| miniapp-taro | 微信审核 | `taro build --type weapp` 产物 | 微信开发者工具上传 + 提审 |

### 9.1 Docker 部署

```bash
# 一键启动全部服务
docker compose up -d
# 服务: api(8802) + web(8801) + ai-service(8803) + db(8810) + redis(8811)
```

### 9.2 Desktop 多平台发布

Tauri 2.1 支持 Windows / macOS / Linux 三平台,通过 4 个包管理器分发:
- **winget**(Windows):`deploy/winget/IHUI.IHUI.yaml`
- **scoop**(Windows):`deploy/scoop/ihui.json`
- **homebrew**(macOS/Linux):`deploy/homebrew/ihui.rb`
- **snap**(Linux):`deploy/snap/snapcraft.yaml`
- 自动更新:`@tauri-apps/plugin-updater`

### 9.3 Mobile RN 发布

EAS Build(`apps/mobile-rn/eas.json`)构建原生包,提交到 App Store / Play Store:
```bash
cd apps/mobile-rn
eas build --platform ios    # 构建 iOS
eas build --platform android # 构建 Android
eas submit --platform ios    # 提交 App Store
eas submit --platform android # 提交 Play Store
```

### 9.4 小程序发布

Taro 4 支持多端小程序,微信为主:
```bash
cd apps/miniapp-taro
pnpm build:weapp    # 微信
pnpm build:alipay   # 支付宝
pnpm build:swan     # 百度
pnpm build:tt       # 字节
pnpm build:h5       # H5
```

微信小程序需在微信开发者工具上传 + 提交审核。

---

## 相关文档

- [AGENTS.md §9 多端同步开发强制规则](../AGENTS.md) — 全端连通 / 平台独占豁免 / 多 Subagent 派单
- [AGENTS.md §11 多 Subagent 并行开发强制规则](../AGENTS.md) — 派单格式 / 联动规则
- [architecture.md](./architecture.md) — 系统架构 / 职责分工 / WebSocket 端点
- [PACKAGES.md](./PACKAGES.md) — 15 共享包详解
- [GATEKEEPERS.md 第 21 项](./GATEKEEPERS.md) — 多端同步守门
- [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md) — 部署流程
- [docs/port-management.md](./port-management.md) — 端口分配规则
