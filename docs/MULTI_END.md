<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 多端架构与同步开发

> IHUI-AI 9 端独立代码 + 14 共享包的架构总览、跨端调用链路、同步开发规则与多端发布矩阵。同步开发强制规则见 [AGENTS.md §9](../AGENTS.md),本文档聚焦架构与代码组织、链路打通与发布矩阵,不重复规则条款。

---

## 1. 总览

IHUI-AI 是全栈 AI 平台,采用 TS Monorepo(pnpm workspace + Turborepo)组织 **8 个独立端** + **14 个共享包**,通过共享层实现跨端类型契约与组件复用。

- **9 端**:`apps/web`、`apps/api`、`apps/ai-service`、`apps/cli`、`apps/desktop`、`apps/extension`、`apps/mobile-rn`、`apps/miniapp-taro`、`apps/mobile-cap`
- **14 共享包**:`packages/` 下的 `auth`/`config`/`database`/`types`/`ui-react`/`ui-native`/`design-tokens`/`api-client`/`context-compaction`/`eslint-config`/`tsconfig`/`sdk`/`shared`/`app`(详见 [PACKAGES.md](./PACKAGES.md))
- **同步规则**:见 [AGENTS.md §9 多端同步开发强制规则](../AGENTS.md),默认每个任务全端连通

### 架构分层

```
┌─────────────────────────────────────────────────────────┐
│  端层(9 端独立代码,apps/*)                              │
│  web │ api │ ai-service │ cli │ desktop │ extension │   │
│  mobile-rn │ miniapp-taro                                │
├─────────────────────────────────────────────────────────┤
│  共享层(14 包跨端复用,packages/*)                       │
│  @ihui/auth @ihui/api-client @ihui/types @ihui/database │
│  @ihui/ui-react @ihui/ui-native @ihui/design-tokens     │
│  @ihui/context-compaction @ihui-ai/sdk                     │
│  @ihui/shared @ihui/rn-app                                  │
│  @ihui/eslint-config @ihui/tsconfig                     │
├─────────────────────────────────────────────────────────┤
│  基础设施层                                              │
│  PostgreSQL 18 │ Redis 7 │ Docker Compose │ Nginx       │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 9 端架构矩阵

| 端 | 代码路径 | 技术栈 | 端口 | 主要功能 |
|----|----------|--------|------|----------|
| Web | `apps/web/` | Next.js 16 + React 19 + Tailwind 4 + shadcn/ui | 8801 | 200+ 页面,主站 + 管理后台 |
| API | `apps/api/` | Fastify 5 + Drizzle ORM 0.38 + PostgreSQL | 8802 | 4561 路由,业务管理 + 多厂商代理 + 认证 + WebSocket |
| AI Service | `apps/ai-service/` | FastAPI + LangGraph + LiteLLM + MCP | 8803 | ~55 端点,LLM 网关 + Agent 执行 + MCP 工具 + A2A |
| CLI | `apps/cli/` | TS(commander + inquirer + ws) | 终端 | 24 源配置导入 + subagent 并行 + ACP 协议 + TUI |
| Desktop | `apps/desktop/` | Tauri 2.1(Rust 薄壳,无前端工程) | 桌面 | 系统托盘 + 深链接 + 自动更新 + 文件系统;UI 由运行时直连的线上站点提供 |
| Extension | `apps/extension/` | WXT 0.19 + React 19 | 浏览器 | 浏览器上下文菜单 + token 注入 + 页面增强 |
| Mobile RN | `apps/mobile-rn/` | React Native 0.86.2 + Expo 57 + NativeWind | 8805 | 移动端 + SSO + 生物认证 + 推送 |
| Miniapp Taro | `apps/miniapp-taro/` | Taro 4.2 + React 18 + Tailwind | 微信小程序 | 多端小程序(微信/支付宝/百度/字节/H5)+ 微信支付 |

> 端口分配规则详见 [docs/port-management.md](./port-management.md),统一使用 `88xx` 段。

### 2.1 apps/web(Next.js 16)

- **框架**:Next.js 16.2.12 + React 19,Turbopack(开发)+ Webpack(生产 standalone 输出)
- **样式**:Tailwind CSS 4 + shadcn/ui,复用 `@ihui/ui-react`
- **状态**:`@tanstack/react-query` 5(服务端状态)+ Zustand(客户端状态)
- **i18n**:next-intl,5 语言(详见 [I18N.md](./I18N.md))
- **路由**:`app/` 目录,`(auth)/` 认证区 + `(main)/` 主区(81 页面)+ `admin/` 管理端
- **API 调用**:统一封装 `src/lib/api.ts`(`fetchApi<T>`),自动携带 JWT,解析 `{ code, message, data }`
- **端口**:8801

### 2.2 apps/api(Fastify 5)

- **框架**:Fastify 5.1 + @fastify/jwt + @fastify/websocket + @fastify/rate-limit
- **ORM**:Drizzle ORM 0.38 + postgres-js,单库 PostgreSQL 18
- **认证**:`@ihui/auth` 共享包(JWT HS256 + token-family + blacklist + OAuth2)
- **验证**:Zod 3.24
- **路由**:627 文件 4561 路由,公共路由(`/api/*`)+ 管理员路由(`/api/admin/*`)
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
- **端口**:8803(docker-compose)/ 8803(直接 uvicorn)

> 详见 [architecture.md §5 AI 服务架构](./architecture.md) 与 [AI_SERVICE.md](./AI_SERVICE.md)。

### 2.4 apps/cli(TS CLI)

- **框架**:commander(命令解析)+ inquirer(交互)+ chalk/ora(TUI)+ ws(WebSocket)
- **协议**:Agent Client Protocol(ACP,`@agentclientprotocol/sdk`)+ Language Server Protocol(vscode-jsonrpc)
- **能力**:24 源配置导入 + subagent 并行 + plan 模式 + memory 嵌入 + mermaid 渲染 + voice + skills 同步
- **i18n**:`src/i18n/messages/`(en/ja/ko 3 语言,独立于 web 的 next-intl)
- **发布**:npm 公开包(`ihui-cli`,`bin: ihui`)

### 2.5 apps/desktop(Tauri 2.1 薄壳,2026-09-29 按 HEAD 实改)

- **形态**:桌面端 = Tauri 薄壳 + 直连线上站点:frontendDist 指向 src-tauri/shell 占位页,窗口 url 直接加载 https://aizhs.top/ 首页(2026-10-13 起启动页由 /agents 改为首页,用户拍板;薄壳不打包本地 web 产物仍依 V3 #72)
- **版本与风险**:桌面端 AI 版本由线上站点决定,本仓不可校验;线上不可用时**业务能力不可用**(AI 对话、模型调用、会话同步都在服务端),但壳侧有本地降级:`auto_refresh` 探活失败会切到内置 `offline/index.html` 兜底页(本地可渲染 UI),切页前通知工作区保存草稿,恢复后回到离线前地址。兜底页不承载业务逻辑,无法离线进行 AI 对话。2026-11-12 起探活结果分 `Unreachable` / `ServerError` / `GateDenied` 三档,通知、窗口标题与离线页按档显示,并提供「立即重新检测」入口(详见 `apps/desktop/README.md` 的「离线行为与边界」)。
- **框架**:Tauri 2.1(Rust 后端 `src-tauri/`);`apps/desktop/package.json` 实际依赖仅 `@tauri-apps/cli` + `rimraf`,本端无 React/Vite/前端目录(旧条目"React 18 + Vite"与"`src/i18n/`"失真,已删——端内平台特有部分全在 `src-tauri/` 的 Rust 侧,见 `apps/desktop/README.md`)
- **能力**:系统托盘 + 深链接(`@tauri-apps/plugin-deep-link`)+ 文件系统 + 自动更新(`@tauri-apps/plugin-updater`)+ 通知 + shell(均在 Rust 侧)
- **共享包复用**:桌面端**不**直接依赖 `@ihui/api-client` / `@ihui/types` / `@ihui/ui-react`——旧条目称"复用"与 `apps/desktop/package.json` 矛盾,已按事实改正;这些包由线上站点加载的 `apps/web` 前端消费,不是本端 npm 依赖
- **条件构建脚本(不在构建链)**:本脚本不在构建链:tauri.conf.json 的 build.beforeBuildCommand 为空串、apps/desktop/package.json 的 build 直跑 tauri build,它仅是手动问责/条件重建入口。问责命令(从仓库根):pnpm --filter @ihui/desktop exec node scripts/ensure-web-out.mjs(指 `apps/desktop/scripts/ensure-web-out.mjs`;2026-09-17 薄壳化后发版链已整体移除 web 构建,见 `.github/workflows/release-desktop.yml` 顶部注释)

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
| `@ihui/auth` | JWT + token-family + blacklist + data-scope + OAuth2 + ws-auth | api / web / cli / extension / mobile-rn |
| `@ihui/api-client` | 统一 API 客户端(endpoints + circuit-breaker + ws-client) | web / cli / extension / mobile-rn / miniapp-taro |
| `@ihui/types` | 跨端类型契约(user/api/ai/agent/workspace 等) | 全端 |
| `@ihui/database` | Drizzle schema(160+ 表)+ 迁移 + client + RLS | api / ai-service(只读) |
| `@ihui/ui-react` | Web 组件库(Button/Input/Card/Dialog/Tabs/Tooltip 等 25+) | web / extension |
| `@ihui/ui-native` | React Native 组件库(avatar/badge/button/card/dialog/input/loading/switch/tabs/vip-badge,10 组件) | mobile-rn |
| `@ihui/design-tokens` | 跨端基础原语(cn + HSL/HEX tokens + CSS 变量) | web / extension / mobile-rn |
| `@ihui/context-compaction` | 上下文压缩(88% 阈值自动压缩) | cli / api / ai-service |
| `@ihui-ai/sdk` | 多语言 SDK(TS/Go/Python/Java/.NET) | 外部集成 |
| `@ihui/shared` | 9端共享业务逻辑(auth/sso + memory + notifications + plan + workflows 等) | 全端 |
| `@ihui/rn-app` | RN app 共享逻辑(AboutScreen/ProfileScreen/SettingsScreen + tokens) | mobile-rn / web |
| `@ihui/eslint-config` | base/next/react ESLint 配置 | 全端 |
| `@ihui/tsconfig` | base/nextjs/node/react-library TSConfig | 全端 |

> **desktop 不在上表任何一行的消费端里**(2026-09-29 按 `apps/desktop/package.json` 实测改正:devDependencies 仅 `@tauri-apps/cli` + `rimraf`,无 `typecheck` script)。桌面端 = Tauri 薄壳 + 直连线上站点,这些共享包由**线上站点加载的 `apps/web` 前端**消费,桌面端经站点**间接使用、不直接依赖**;上表标"全端"的行(`@ihui/types` / `@ihui/shared` / `@ihui/eslint-config` / `@ihui/tsconfig`)同此理解。旧条目把 desktop 列进 `api-client`/`ui-react`/`design-tokens`/`auth` 四行,与 §2.5 和该 package.json 矛盾,已删。

> `@ihui-ai/sdk` 还提供 Go / Python / Java / .NET 多语言 SDK,供外部系统接入,见 `packages/sdk/` 各子目录。

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
            ├─ Drizzle ORM → PostgreSQL 18
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
  └─ apps/desktop (Tauri 薄壳,不含前端)
       ├─ 窗口 url 直连 https://aizhs.top/ 首页 → 线上部署的 apps/web 站点
       │    └─ 该站点内 @ihui/api-client → apps/api (Fastify 8802) /api/*
       ├─ @tauri-apps/plugin-http(原生 HTTP,供 Rust 侧探活/更新检查)
       └─ @tauri-apps/plugin-store(token 持久化)
```

> 桌面端**不**直接依赖 `@ihui/api-client`(`apps/desktop/package.json` 实测 devDependencies 仅 `@tauri-apps/cli` + `rimraf`):API 调用发生在运行时加载的那份线上 web 站点里,不是本端代码。旧条目把 `@ihui/api-client` 画成桌面端自身的一跳,与 §2.5 矛盾,已按事实改正。

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
| cli-subagent | `apps/cli/` | `pnpm --filter ihui-cli typecheck` |
| desktop-subagent | `apps/desktop/` | `pnpm --filter @ihui/desktop build`(= `tauri build`);**无 `typecheck` script**(`apps/desktop/package.json` 实测 scripts 仅 dev/build/tauri/build:debug/icons:regen/clean),Rust 侧用 `cargo check` |
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
| desktop | **无 JS 测试面**(本端无前端工程,`apps/desktop/tests/` 不存在,2026-09-29 实测);Rust 侧测试在 `apps/desktop/src-tauri/` | `apps/desktop/src-tauri/src/` | Rust 单元;旧条目"Vitest + Testing Library / i18n + token"失真,已按事实改正 |
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
| cli | Docker + npm | `deploy/docker/Dockerfile.cli` + npm publish | `npm publish`(公开包 `ihui-cli`) |
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
- **分发的是薄壳安装包**:桌面端 = Tauri 薄壳 + 直连线上站点:frontendDist 指向 src-tauri/shell 占位页,窗口 url 直接加载 https://aizhs.top/ 首页(2026-10-13 起启动页由 /agents 改为首页,用户拍板;薄壳不打包本地 web 产物仍依 V3 #72)——四个包管理器与 Tauri updater 分发/更新的都是这份**不含前端产物**的壳,web 能力更新只需线上部署、无需重发桌面包
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
eas submit --platform android # 提交 Play Store（落哪条轨道看 eas.json 的 submit.production.android.track）
```

> 个人号正式版门槛（12 名测试员连续 14 天）**只认封闭测试**，其 androidpublisher 轨道名是 `alpha`（不是 `closed`）；`track: "internal"` 的提交不计入门槛。详见 `docs/RELEASE.md` 的「Android 提交轨道」。

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

## 门 290 · pkg-shop/vip 两处空端口结案（2026-11-08）

- 范围：`apps/miniapp-taro/src/pkg-shop/vip/index.tsx`、`apps/miniapp-taro/src/pkg-shop/vip/upgrade.tsx`
- 判据：门 290 `scripts/check-miniapp-interaction-hygiene.mjs`（A2-empty-port）
- 基线：`origin/main`（分支 `fix/gate290-vip-empty-port`，独立工作树 `D:/IHUI-AI-wt-vip-290`）

### 结论

两处命中不是「取不到宿主/数据」，而是**确证为空**：`onNavigate` 是共享屏 `VipScreen` 声明的必填端口，但屏内**零消费**，只有 `assertRequiredPort` 的断言。它只对某一个端（RN）有真实回调可传，另外两端（小程序两页）只能挂 `() => {}` 空实现来喂断言——正是「只有一个端会传的 prop」。

按硬约束该端口**本不该存在**，处置为**删除死端口**，而不是给小程序补一条无人调用的假导航。删除后门 290 的 A2 从 2 处降为 0，且不产生任何行为变化。

### 证据链（为什么是「确证为空」而不是「取不到宿主」）

1. **屏内零消费**：`packages/app/src/features/vip/VipScreen.tsx` 改前 `onNavigate` 只出现两次——`L66` 解构、`L76` `assertRequiredPort('onNavigate', onNavigate)`，函数体再无任何调用点。
2. **每个交互元素都有自己的专属回调**，无一需要通用导航：`L103` `BackChevron onPress={onBack}`；`L131` `introduce.onPress`；`L166` `viewBenefits.onPress`；`L211` `plans.onSelect`、`L227` `plans.onToggleAutoRenew`、`L236` `plans.onManage`；`L258` `buyBar.onPress`；`L271` `overlay.onClose`、`L317` `overlay.agree.onToggle`、`L332` `method.onPress`、`L345` `overlay.onPrimary`。共享屏没有任何「需要跳转到逻辑 target」的 UI，端口没有语义承载位。
3. **RN 端传的是真回调，但用途都在共享屏之外**：`apps/mobile-rn/src/screens/VipScreen.tsx` `L219` 取 `useHostPorts()`，`onNavigate` 只在 `L445`（`navigateAfterVipPay`）、`L641`（`VipUpgrade`）、`L664`（`VipTrader`）使用；传给 `SharedVipScreen` 的那一份（改前 `L694`）没有任何消费方。
4. **小程序两页只能挂空实现**：`pkg-shop/vip/index.tsx` 改前 `L356`、`upgrade.tsx` 改前 `L184` 均为 `onNavigate={() => {}}`。`assertRequiredPort` 在 dev 对「已知空实现」直接抛错（`packages/app/src/host/ports.ts`），即这两页在 dev 下本来就会崩，空实现不是合法补齐。
5. **宿主端口其实存在，不是取不到**：`scripts/data/host-port-equivalence.json` 已把 `onNavigate` 映射到小程序侧 `apps/miniapp-taro/src/rn-compat/navigation.tsx`。小程序**具备**接真实导航的能力，但共享屏没有消费点，接上也无行为——问题在设计，不在宿主取不到。
6. **web 端不渲染该屏**：全仓 `VipScreenProps` / `features/vip/VipScreen` 导入点中无 web 侧调用，三端里只有 RN 与小程序两端渲染该共享屏。

### 判据语义分界（读不到 ≠ 通过）

| 情形 | 处置 | 位置 |
| --- | --- | --- |
| 被审面文件读失败 | `exit 2` 并点名文件 | `scripts/check-miniapp-interaction-hygiene.mjs` `readTextSafe`（L102）+ `run()` 循环（L838） |
| 端口表为空（A2 射程静默收缩） | `exit 2`，不得以零端口名判 A2 通过 | 同文件 L820 |
| 确证为空（端口无消费方） | 删除端口后 `exit 0`，门打印 `A2 空端口:0(端口表已加载 N 名;…)` 作为依据 | 同文件 L894 |

「确证为空」不接受白名单挂账：唯一合法处置是删端口；「取不到」不接受任何兜底放行。

### 改动清单

1. `packages/types/src/app-growth.ts`：`VipScreenProps` 删除 `onNavigate: OnNavigate` 字段（`L341` 接口内）。
2. `packages/app/src/features/vip/VipScreen.tsx`：删除解构 `onNavigate` 与 `assertRequiredPort('onNavigate', onNavigate)`。
3. `apps/mobile-rn/src/screens/VipScreen.tsx`：`<SharedVipScreen>` 移除 `onNavigate={onNavigate}`（本地 `onNavigate` 变量保留，`L445/L641/L664` 仍在用）。
4. `apps/miniapp-taro/src/pkg-shop/vip/index.tsx`、`upgrade.tsx`：移除 `onNavigate={() => {}}` 空实现。
5. `apps/miniapp-taro/src/constants/ui-routes.generated.ts`：生成器随源码变更重算的 pin 头（sourceCommit/inputsSha256/generatedAt + 两个 vip 页输入哈希）。
6. `scripts/check-miniapp-interaction-hygiene.mjs`：新增 `readTextSafe`、端口表空闸、A2 读数行。
7. `scripts/tests/check-miniapp-interaction-hygiene.test.mjs`：新增 T13（取不到 ⇒ 显式 error，不折成零违规）。

未触碰：其它屏、跨端登记表数据文件、`check-staged-typecheck.mjs`。

### 验证读数

> 前提：本机当时有四条并发开发线同时跑门，下列耗时/读数受 CPU 争用影响；门本身是静态扫描，结论不随并发变化。

- 门 290（改后）：`blocking:0`，`A2 空端口:0(端口表已加载 8 名…)`，`扫 707 文件 / 6576 标签`。
- 门 290 镜像测试：`node --test scripts/tests/check-miniapp-interaction-hygiene.test.mjs` → `tests 13 / pass 13 / fail 0`。
- 门 296（重试别名，default face=head）：**基线既有红**，与本次改动无关——`apps/miniapp-taro/src/pkg-ai/ai/history.tsx:788 onRetry={onRefresh}` 判为新增假重载；该文件不在本次改动面，HEAD 与 `origin/main` 同一 sha `6030e877`。归该文件所属并发线处理，本线不越界修改。
- 门 299：`✅ 结论:无新增复制页;存量复制页逐条在册`，exit 0。
- 宿主端口等价门：`entries=5 ports=onAudio,onNavigate,onToast`，exit 0。
- `@ihui/rn-app typecheck`：exit 0。
- `@ihui/mobile-rn typecheck`：exit 2，仅基线既有 2 处（`LoginScreen.tsx:279`、`chat-render-model.ts:554`），均不在本次改动面。
- `@ihui/miniapp-taro typecheck`：exit 2，仅基线既有 4 处（`n8n-model/list-view.tsx` 缺 `./workflow-card`、`vip-trader/index` 缺 `@rn-shells/VipTraderScreen`、`streaming-recognizer.ts` 重复实现 ×2），均不在本次改动面。
- 定向单测：rn-app `vip-levels-section` 6/6；miniapp `shop-vip-shell-render` 8/8 + `shop-vip-upgrade-details-shell` 6/6；mobile-rn `vip-purchase-order-contract` 3/3 + `vip-benefit-labels` 3/3。

## 相关文档

- [AGENTS.md §9 多端同步开发强制规则](../AGENTS.md) — 全端连通 / 平台独占豁免 / 多 Subagent 派单
- [AGENTS.md §11 多 Subagent 并行开发强制规则](../AGENTS.md) — 派单格式 / 联动规则
- [architecture.md](./architecture.md) — 系统架构 / 职责分工 / WebSocket 端点
- [PACKAGES.md](./PACKAGES.md) — 15 共享包详解
- [GATEKEEPERS.md 第 21 项](./GATEKEEPERS.md) — 多端同步守门
- [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md) — 部署流程
- [docs/port-management.md](./port-management.md) — 端口分配规则

---

## 附:22 条「缺 RN 行」核验与收口(2026-11-08)

> 取材面 `origin/main@6030e87763`;判定口径:壳文件存在 + 从 `@ihui/rn-app` 导入共享屏 + 有 JSX 渲染点,三证齐备才算「这屏有 RN 壳」。结论同时覆盖两张账:映射表 `scripts/data/web-rn-screen-map.jsonl`(web→RN)与三端登记表 `scripts/data/cross-end-screen-registry.json`(shared→RN→小程序)。

**结论**:映射表 22/22 路由原本已有 `aligned` 行,本次改 21 行 —— 2 行 `rn` 由共享源改指薄壳(`login`、`mcp-store`)、19 行补「导入行 + 渲染行」证据;`registry` **不改判**(无 RN 壳、路由对不上 ⇒ 按「无证据」列入保留清单,不改登记行:改判会触发 302p 承载面棘轮,须由跨端对齐线裁决并刷新基线)。三端登记表**可补 0 行**:A 通用屏 `ConsoleTableScreen` 不能按路由落槽(13 条 edu + `models/prompts`);B 一槽已占(`ai-world/history`、`agreement/[type]`);C 裁决台账已判 not-applicable(`login`/`mcp-store`/`bi-dashboard`/`ai-career`/`business-card`);D 无壳(`registry`,`apps/mobile-rn/src/screens` 零命中,`drawer-nav.ts:745-757` 的 `/registry→McpStore` 只是导航迁移,功能不等价,App 经 WebView 门户 `/registry` 承载 `packages/shared/src/constants/web-portal.ts:1017-1019`)。

| # | web 路由 | RN 壳(导入行/渲染行) | 渲染的共享屏 | 三端登记表 |
|---|---|---|---|---|
| 1 | `login` | `LoginScreen.tsx:47`/`:1173` | `features/login/LoginScreen.tsx` | 不可补(C,裁决 `miniapp-mirror-verdicts.jsonl:71`) |
| 2 | `mcp-store` | `McpStoreScreen.tsx:7`/`:191` | `features/mcp-store/McpStoreScreen.tsx` | 不可补(C,裁决 `:72`) |
| 3 | `registry` | 无 RegistryScreen | 原指 `features/mcp-store/McpStoreScreen.tsx`(非同屏) | 不可补(D,保留清单;建议对齐线裁决 portal/gap) |
| 4 | `bi-dashboard` | `DashboardScreen.tsx:8`/`:213` | `features/dashboard/DashboardScreen.tsx` | 不可补(C,裁决 `:45`) |
| 5 | `ai-career` | `AiCareerScreen.tsx:14`/`:192` | `features/ai-career/AiCareerScreen.tsx` | 不可补(C,裁决 `:10`,registry 旧镜像对已删) |
| 6 | `ai-world/history` | `AiWorldHistoryScreen.tsx:19`/`:69` | `features/ai-world/AiWorldCollectionScreen.tsx` | 不可补(B,已有槽 rn=`AiWorldFavoritesScreen.tsx`) |
| 7 | `business-card` | `BusinessCardScreen.tsx:20`/`:231` | `features/business-card/BusinessCardScreen.tsx` | 不可补(C,裁决 `:119`) |
| 8 | `models/prompts` | `ModelsPromptsScreen.tsx:12`/`:75` | `features/console-table/ConsoleTableScreen.tsx` | 不可补(A,通用杠杆屏) |
| 9 | `agreement/[type]` | `AgreementByTypeScreen.tsx:10`/`:65` | `features/agreement/AgreementScreen.tsx` | 不可补(B,已有槽 rn=`AgreementScreen.tsx`) |
| 10 | `edu/attendance` | `EduMyAttendanceScreen.tsx:21`/`:184` | `ConsoleTableScreen` | 不可补(A,小程序无硬路径镜像) |
| 11 | `edu/edu-management/grades` | `EduGradesScreen.tsx:15`/`:101` | `ConsoleTableScreen` | 不可补(A) |
| 12 | `edu/edu-management/enrollment` | `EduEnrollmentScreen.tsx:15`/`:80` | `ConsoleTableScreen` | 不可补(A,小程序无对应页) |
| 13 | `edu/edu-management/finance` | `EduFinanceScreen.tsx:15`/`:108` | `ConsoleTableScreen` | 不可补(A) |
| 14 | `edu/edu-management/meal` | `EduMealScreen.tsx:15`/`:90` | `ConsoleTableScreen` | 不可补(A,小程序无对应页) |
| 15 | `edu/edu-management/schedule` | `EduScheduleScreen.tsx:17`/`:113` | `ConsoleTableScreen` | 不可补(A,小程序无对应页) |
| 16 | `edu/edu-management/scheduling` | `EduSchedulingScreen.tsx:16`/`:101` | `ConsoleTableScreen` | 不可补(A,小程序无对应页) |
| 17 | `edu/parent/bind` | `EduParentBindScreen.tsx:22`/`:168` | `ConsoleTableScreen` | 不可补(A,绑定段在 `edu-parent/index` 页内) |
| 18 | `edu/parent/children/[childId]/courses` | `EduChildScheduleScreen.tsx:16`/`:91` | `ConsoleTableScreen` | 不可补(A) |
| 19 | `edu/parent/children/[childId]/attendance` | `EduChildAttendanceScreen.tsx:19`/`:84` | `ConsoleTableScreen` | 不可补(A) |
| 20 | `edu/parent/children/[childId]/grades` | `EduChildGradesScreen.tsx:19`/`:81` | `ConsoleTableScreen` | 不可补(A) |
| 21 | `edu/parent/children/[childId]/meals` | `EduChildMealsScreen.tsx:19`/`:82` | `ConsoleTableScreen` | 不可补(A) |
| 22 | `edu/parent/children/[childId]/study-plans` | `EduChildStudyPlansScreen.tsx:19`/`:94` | `ConsoleTableScreen` | 不可补(A) |

> 壳路径前缀均为 `apps/mobile-rn/src/screens/`;共享屏前缀均为 `packages/app/src/`。A 类依据:`ConsoleTableScreen` 自述「通用控制台列表屏 —— 61 条控制台类页面的规模化杠杆」(`packages/app/src/features/console-table/ConsoleTableScreen.tsx:21-25`),裁决台账 `miniapp-mirror-verdicts.jsonl:32` 同判 not-applicable;小程序侧 `镜像 packages/app/src/features/console-table/ConsoleTableScreen.tsx` 命中 0。

**门读数**(当时有其它线并发跑门,耗时只作参考):门 285p `check-web-rn-screen-parity`(HEAD 面)`alignedUnique 292→292`、`portalRows 88→88`(只改 2 行 `rn` 指向,不动承载面)、`rot/duplicateWebKeys/unmapped/contradictedRows` 均 0,exit 0,耗时约 2.7s;门 189p `check-web-mp-route-carriers` exit 0(`shared 275 / carried 252 / missingCarrier 0 / undetermined 0 / red 0`,login/mcp-store 仍判 legal-absence),耗时约 4.4s;门 302 `check-cross-end-parity-drift --gate` exit 0(`aligned 292 = 基线 292`,无 regression),耗时约 9.2s;门 301 三端登记表未动(`registryEntries 256 / mirrored 256 / coverageRed 0`);门 291 `check-web-rn-copy-parity` 在 HEAD 即 `SyntaxError: Identifier 'catBatch' has already been declared`(`scripts/check-web-rn-copy-parity.mjs:72`,merge `06927f16fa` 引入的重复 import),属存量红、与本线无关(提交期该门未拦,推送期需该线修复先落 main)。

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
