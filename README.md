# IHUI-AI

> 让每个人都拥有自己的 AI 程序 —— 一个全栈、全端、全场景的开源 AI 应用共建平台。

IHUI-AI 是一套企业级全栈 AI 平台,采用 TS Monorepo(pnpm workspace + Turborepo)架构,横跨 **8 个端**(Web / API / AI 服务 / CLI / 桌面 / 浏览器扩展 / 移动 React Native / 小程序 Taro),统一接入 **100+ 大模型**,内置 **LangGraph + MCP + A2A** 三栈协同,提供从认证、计费、内容、工作空间到 AI 工作流编排的完整能力。

我们相信,AI 不应被少数平台垄断。本项目以 Apache 2.0 协议开源,目标是让任何开发者、团队、企业都能基于它构建属于自己的 AI 程序,并把改进反哺回社区,共同打造最强、最全的 AI 应用。

---

## 为什么选择 IHUI-AI

| 维度                 | 能力                                                                  | 行业定位                        |
| -------------------- | --------------------------------------------------------------------- | ------------------------------- |
| **端覆盖**           | Web / API / AI 服务 / CLI / 桌面 / 扩展 / 移动 RN / 小程序 Taro       | 行业首个 8 端全覆盖 AI 全栈平台 |
| **模型接入**         | LiteLLM 网关统一 100+ 模型(国际 30+ / 国产 15+ / 云厂商 10+)          | 一站式接入,智能路由 + 60% 缓存  |
| **AI 编排三栈**      | LangGraph(工作流)+ MCP(工具协议)+ A2A(Agent 互通)                     | 工作流、工具、智能体协同一体化  |
| **自研 CLI**         | ACP Server + 6 内置工具,对标 Claude Code                              | 命令行原生 AI 编程体验          |
| **CLI 配置无缝导入** | cc-switch / codex++ / Claude / Codex / Gemini / Hermes 6 源一键导入   | 跨 CLI 工具配置零迁移成本       |
| **企业级安全**       | RBAC + 工作空间 3 模式权限 + 7 端点运行时拦截 + 60s 审计超时          | 决策者级风险控制                |
| **数据加密**         | AES-256-GCM(credentials 加密)+ JWT token-family 旋转 + refresh 黑名单 | 金融级数据保护                  |
| **可观测性**         | Prometheus + Grafana + Loki + Promtail + Jaeger + OpenTelemetry       | 全链路指标 / 日志 / 追踪        |
| **工程守门**         | 17 个 pre-commit 守门脚本 + post-commit 自动 push + git-push-guard    | 杜绝协作事故,99.9% SLA          |
| **国际化**           | zh-CN / zh-TW / en / ko / ja 5 语言 parity                            | 5 语言键集合强一致性            |
| **数据库**           | 96+ 表 + 32+ 迁移 + Drizzle ORM 类型安全                              | 单库 PostgreSQL 15,schema 隔离  |
| **API 规模**         | ~1135 端点(api 1080 + ai-service 55)+ 12 WebSocket 端点               | 远超源项目 331 端点             |

---

## 项目愿景

我们正在构建的不是另一个 ChatGPT 套壳,而是一套**完整的 AI 应用基础设施**:

- **个人开发者**:用它搭建自己的 AI 助手、内容创作平台、私有知识库
- **企业团队**:基于工作空间权限、计费、审计构建企业级 AI 中台
- **AI 服务商**:复用多模型代理、计费、订阅、SDK 能力快速上线商业产品
- **教育机构**:启用 AI 教育全栈(课程 / 题库 / 考试 / 学习路径 / SRS 间隔重复)
- **内容创作者**:一键发布到 14 平台(公众号 / 知乎 / CSDN / 掘金 / 小红书 / B 站 / YouTube / 抖音 等)

开源不是终点,而是起点。每一份 PR、每一个 Issue、每一次 Fork 都让这个平台更接近"让每个人都拥有自己的 AI 程序"的目标。

---

## 技术栈

| 层         | 技术                                                                   | 版本                                |
| ---------- | ---------------------------------------------------------------------- | ----------------------------------- |
| Monorepo   | pnpm workspace + Turborepo                                             | pnpm 9.15 / turbo 2.3               |
| 后端 API   | Fastify + @fastify/jwt + @fastify/websocket + Drizzle ORM + PostgreSQL | Fastify 5.1 / Drizzle 0.38 / PG 15  |
| 缓存与队列 | Redis 7 + BullMQ                                                       | 独立 worker 进程                    |
| 前端 Web   | Next.js + React + Tailwind CSS + shadcn/ui                             | Next 15.1 / React 19 / Tailwind 4   |
| 前端状态   | @tanstack/react-query 5 + Zustand                                      | 服务端 + 客户端状态分离             |
| 国际化     | next-intl                                                              | zh-CN / zh-TW / en / ko / ja 5 语言 |
| AI 服务    | FastAPI + LangGraph + LiteLLM + MCP + A2A                              | FastAPI 0.115 / LangGraph 0.2       |
| AI 协议    | SSE(Agent 流式)+ WebSocket(聊天室 / 多模型流式)+ REST                  | 三协议分层                          |
| 桌面端     | Tauri 2 + React 19                                                     | 跨平台原生体验                      |
| 浏览器扩展 | WXT + React                                                            | Chrome / Edge / Firefox             |
| 移动端     | React Native + Expo EAS                                                | iOS / Android                       |
| 小程序     | Taro 4 + React                                                         | 微信小程序                          |
| CLI        | Node.js + Commander + Inquirer                                         | 对标 Claude Code                    |
| 认证       | @ihui/auth 共享包(JWT HS256 + token-family + OAuth2 + RBAC)            | 跨端统一签发                        |
| 验证       | Zod 3.24(后端)+ React Hook Form(前端)                                  | 端到端类型安全                      |
| 日志       | Pino 9.5(后端)+ Python logging(AI 服务)+ Loki + Promtail               | 结构化 + 聚合                       |
| 追踪       | OpenTelemetry + Jaeger                                                 | 分布式全链路                        |
| 监控       | Prometheus + Grafana + Node Exporter                                   | 主机 + 应用指标                     |
| 测试       | Vitest(后端)+ Playwright(E2E)+ pytest(AI 服务)                         | 268 + 400+ 用例                     |
| Node       | >=20.10.0                                                              | -                                   |
| Python     | 3.12+(仅 AI 服务)                                                      | -                                   |

---

## 8 端架构

```
                    ┌─────────────────────────────────────────┐
                    │          用户 / 企业 / 开发者              │
                    └────────────┬───────────────────┬────────┘
                                 │                   │
        ┌────────────────────────┼───────────────────┼────────────────────────┐
        │                        │                   │                        │
   ┌────▼─────┐  ┌──────────┐  ┌─▼────────┐  ┌──────▼─────┐  ┌──────────┐  ┌─▼────────┐
   │  Web     │  │ Desktop  │  │ Extension│  │ Mobile RN │  │ Miniapp  │  │   CLI    │
   │ Next 15  │  │ Tauri 2  │  │  WXT     │  │  Expo     │  │ Taro 4   │  │ Node.js  │
   │ :3000    │  │          │  │          │  │           │  │          │  │          │
   └────┬─────┘  └────┬─────┘  └────┬─────┘  └─────┬────┘  └────┬─────┘  └────┬─────┘
        │             │             │              │            │             │
        └─────────────┴─────────────┴──────┬───────┴────────────┴─────────────┘
                                           │  HTTPS / WebSocket / SSE
                                  ┌────────▼─────────┐
                                  │   apps/api       │  Fastify 5 + Drizzle ORM
                                  │   :8080          │  ~1080 端点 + 12 WS 端点
                                  └────┬───────┬─────┘
                                       │       │
                          ┌────────────▼─┐   ┌─▼──────────────┐
                          │  PostgreSQL  │   │  apps/ai-service│  FastAPI
                          │  15 (96 表)  │   │  :8000          │  LangGraph + LiteLLM + MCP + A2A
                          └──────────────┘   └────┬────────────┘
                                                  │
                                            ┌─────▼─────┐
                                            │  Redis 7  │  Pub/Sub + 缓存 + BullMQ
                                            └───────────┘
```

### 8 端职责

| 端          | 目录                 | 技术栈                | 职责                                                      |
| ----------- | -------------------- | --------------------- | --------------------------------------------------------- |
| **Web**     | `apps/web/`          | Next.js 15 + React 19 | 主前端,83 页面,5 语言 i18n,PWA,SEO                        |
| **API**     | `apps/api/`          | Fastify 5 + Drizzle   | 业务管理 + 多厂商代理 + 认证 + WebSocket,~1080 端点       |
| **AI 服务** | `apps/ai-service/`   | FastAPI + LangGraph   | LLM 网关 + Agent 执行 + MCP 工具 + A2A 协议,~55 端点      |
| **CLI**     | `apps/cli/`          | Node.js + Commander   | 自研命令行 AI 编程助手,ACP Server + 6 工具 + 6 源配置导入 |
| **桌面**    | `apps/desktop/`      | Tauri 2 + React       | 跨平台桌面应用,系统托盘 + 本地文件访问                    |
| **扩展**    | `apps/extension/`    | WXT + React           | 浏览器扩展,上下文菜单 + 侧边栏                            |
| **移动**    | `apps/mobile-rn/`    | React Native + Expo   | iOS / Android 原生应用                                    |
| **小程序**  | `apps/miniapp-taro/` | Taro 4 + React        | 微信小程序,微信支付原生集成                               |

---

## 项目结构

```
IHUI-AI/
├── apps/
│   ├── ai-service/          # AI 服务 (FastAPI + LangGraph + LiteLLM + MCP + A2A)
│   ├── api/                 # 后端 API (Fastify 5 + Drizzle ORM, ~1080 端点)
│   ├── cli/                 # 自研 CLI (ACP Server + 6 工具, 对标 Claude Code)
│   ├── desktop/             # 桌面端 (Tauri 2 + React)
│   ├── extension/           # 浏览器扩展 (WXT + React)
│   ├── miniapp-taro/        # 微信小程序 (Taro 4 + React)
│   ├── mobile-rn/           # 移动端 (React Native + Expo)
│   └── web/                 # 前端 (Next.js 15 + React 19, 83 页面)
├── packages/
│   ├── auth/                # @ihui/auth 共享认证 (JWT + token-family + OAuth2 + RBAC)
│   ├── config/              # @ihui/config 共享配置
│   ├── database/            # @ihui/database Drizzle schema (96 表 + 32 迁移)
│   ├── eslint-config/       # @ihui/eslint-config
│   ├── i18n/                # @ihui/i18n 共享国际化
│   ├── sdk/                 # @ihui/sdk 自动生成的 SDK
│   ├── tsconfig/            # @ihui/tsconfig
│   ├── types/               # @ihui/types 共享类型定义
│   ├── ui/                  # @ihui/ui Web 端 shadcn/ui 组件库
│   └── ui-native/           # @ihui/ui-native React Native 组件库
├── deploy/
│   ├── nginx/               # Nginx 反向代理配置
│   └── scripts/             # 部署 / 备份 / 回滚 / 健康检查脚本
├── docs/
│   ├── architecture.md      # 系统架构文档(技术栈、路由、启动流程)
│   ├── CONTRIBUTING.md      # 贡献指南
│   ├── DEPLOYMENT_RUNBOOK.md# 部署运维手册(蓝绿部署 / 回滚)
│   ├── SECURITY.md          # 安全策略
│   ├── EMAIL_SETUP.md       # 邮件服务配置
│   └── I18N-COMPLETION-PLAN.md
├── monitoring/
│   ├── grafana/             # Grafana 仪表盘 provisioning
│   ├── loki/                # Loki 日志聚合配置
│   ├── prometheus/          # Prometheus 抓取配置
│   ├── promtail/            # Promtail 日志采集
│   └── otel-collector/      # OpenTelemetry Collector
├── scripts/                 # 17+ 守门脚本 + 运维工具
├── .github/workflows/       # CI (build / ci / e2e / knip)
├── .husky/                  # Git hooks (pre-commit 17 项 + post-commit 自动 push)
├── docker-compose.yml       # 编排 (api + web + ai-service + db + redis + 监控栈)
├── Dockerfile.api-new       # 后端镜像
├── Dockerfile.web-new       # 前端镜像
├── Dockerfile.migrate       # 迁移一次性服务镜像
├── AGENTS.md                # AI Agent 协作规范(强制规则)
├── PROJECT_PLAN.md          # 项目唯一任务计划文档
├── LICENSE                  # Apache 2.0
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

---

## 核心能力

### 1. 100+ 大模型一站式接入

通过 LiteLLM 网关统一接入,智能路由 + 60% 缓存命中:

- **国际模型**:OpenAI GPT / Anthropic Claude / Google Gemini / xAI Grok / Groq / OpenRouter / Mistral
- **国产模型**:智谱 GLM / 通义千问 Qwen / 豆包 Doubao / DeepSeek / 月之暗面 Kimi / 阶跃星辰 StepFun / 百川 / Yi / MiniMax
- **云厂商**:阿里云 / 腾讯云 / 华为云 / 火山引擎 / 百度智能云 / AWS Bedrock / Azure OpenAI
- **多模态**:文本 / 图像 / 语音(STT + TTS)/ 视频 / 嵌入向量

### 2. LangGraph + MCP + A2A 三栈协同

- **LangGraph**:StateGraph 工作流(plan → execute → summarize),支持 stub 模式无 API key 也能开发
- **MCP**:11 内置工具(search_codebase / read_file / write_file / run_command / web_search / git_operations / db_query / analyze_code / generate_test / refactor_code / file_search)+ 3 资源 + 3 提示词
- **A2A**:Agent-to-Agent 协议,Redis 持久化 + 内存降级,智能体之间互相调用
- **向量记忆**:嵌入 + 余弦相似度语义搜索,跨会话长期记忆

### 3. 自研 CLI(对标 Claude Code)

`apps/cli/` 提供 ACP(Agentic Coding Protocol)Server + 6 内置工具,支持:

- **斜杠命令**:`/goal` 目标驱动模式 + `/loop` 自动迭代 + `/skill` 工具调用 + `/plan` 计划等 12 命令
- **Skills 系统**:code-review / bug-fix / feature-plan / refactor-helper / api-designer / test-writer
- **配置无缝导入**:cc-switch / codex++ / Claude / Codex / Gemini / Hermes 6 源一键导入,跨 CLI 工具零迁移成本
- **多端联动**:与 Web / API 共享认证 + 会话 + 工作空间

### 4. 企业级工作空间权限

3 种权限模式 + 7 端点运行时拦截 + 60s 审计超时:

- **default**:任何 FS 调用都触发人工审计弹窗
- **accept-edits**:白名单规则匹配放行,不匹配触发弹窗
- **bypass-permissions**:全部放行(仅信任环境使用)
- 7 个 FS 端点全部接入:`/fs/read` `/fs/write` `/fs/edit` `/fs/delete` `/fs/grep` `/fs/glob` `/fs/run`
- WebSocket 实时推送权限请求,60s 不响应自动拒绝

### 5. 内容创作全栈

- **自媒体工作台**:公众号文章 + 口播稿双流水线,通过 AI 对话框斜杠命令(`/wechat-article` / `/koubo-script`)或附加栏按钮双入口调用
- **14 平台一键自动发布**:
  - 文章 9 平台:WordPress / Medium / 公众号 / 头条 / 知乎 / CSDN / 掘金
  - 图片 2 平台:小红书 / 微博
  - 视频 5 平台:YouTube / B 站 / 抖音 / 快手 / 视频号
- **凭证 AES-256-GCM 加密存储**,发布完成 WebSocket 实时通知 + 完整记录

### 6. AI 教育全栈

课程 / 题库 / 考试 / 学习路径 / SRS 间隔重复 / 直播 / 学习报告全套能力,涵盖:

- **学习路径**:结构化课程 + 章节 + 进度跟踪
- **题库与考试**:多题型枚举双向映射 + 自动批改 + 章节练习
- **SRS 间隔重复**:基于艾宾浩斯遗忘曲线的智能复习调度
- **直播**:AI 辅助直播教学
- **学习报告**:学习行为分析 + 个性化建议

### 7. 多智能体业务管理

完整的智能体市场 + 开发者生态:

- 智能体购买 / 审核 / 结算 / 提现 / 分类 / 开发者认证
- Coze SDK 代理(Bot / 对话 / 工作流 / 数据集 / 模板 / 变量 / 工作空间)
- OAuth 2.0 + 用户 SK + PAT + SMS 全套认证
- 计费 / 订阅 / VIP / 积分 / 钱包 / 退款完整交易闭环

---

## 快速开始

### 环境要求

| 工具       | 版本               | 说明                                              |
| ---------- | ------------------ | ------------------------------------------------- |
| Node.js    | `>=20.10.0`        | LTS 20.x,推荐 `nvm use`                           |
| pnpm       | `>=9.0.0`          | 项目固定 `pnpm@9.15.0`,`corepack enable` 自动激活 |
| Python     | `3.12+`            | 仅 `apps/ai-service` 需要                         |
| PostgreSQL | `15+`              | compose 用 `postgres:15-alpine`                   |
| Redis      | `7+`               | compose 用 `redis:7-alpine`                       |
| Docker     | `24+` + Compose v2 | 可选,推荐用于一键启动                             |
| Git        | `2.40+`            | `core.autocrlf=false`(项目强制 LF)                |

### 一键启动(Docker)

```bash
# 1. 克隆
git clone <repo-url> IHUI-AI && cd IHUI-AI

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env,填入 JWT_SECRET / DB_PASSWORD / CREDENTIALS_ENCRYPTION_KEY 等

# 3. 一键启动全栈(api + web + ai-service + db + redis + 监控栈)
docker compose up -d

# 服务访问:
# - Web:           http://localhost:3000
# - API:           http://localhost:8080/api/health
# - AI 服务:       http://localhost:8000/health
# - Grafana:       http://localhost:3001 (admin / 修改密码)
# - Prometheus:    http://localhost:9091
# - Jaeger UI:     http://localhost:16686
```

### 开发模式(本地)

```bash
# 1. 安装
corepack enable && corepack prepare pnpm@9.15.0 --activate
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
# pnpm --filter @ihui/api run dev          # 后端 :8080
# pnpm --filter @ihui/web run dev          # 前端 :3000
# cd apps/ai-service && uv sync && uvicorn app.main:app --reload --port 8000

# 5. 全量验证(typecheck + lint + test)
pnpm turbo build typecheck lint test
```

### Windows 一键启动

```powershell
# 同时启动 web + api + ai-service + 数据库 + Redis
.\scripts\dev-up.ps1

# 或仅启动 dev server(数据库已在跑)
.\scripts\dev-all.ps1
```

---

## API 与协议

### REST API(~1135 端点)

| 服务                | 端点数 | 前缀                  | 覆盖域                                                                                                                                                              |
| ------------------- | ------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **apps/api**        | ~1080  | `/api` + `/api/admin` | 37 路由文件,涵盖 auth / users / billing / content / chat / teams / workspace / agents / coze / oss / order / vip / exam / learn / live / news / topic / search / 等 |
| **apps/ai-service** | ~55    | `/api`                | a2a(5)/ agents(9)/ health(4)/ llm(2)/ mcp(10)/ tools(3)/ self_media / publish                                                                                       |

**统一响应格式**:

```typescript
// 成功: { code: 0, message: 'success', data: T }
// 错误: { code: number, message: string }
// 由共享 utils/response.ts 的 success()/error() 生成
```

**认证**:JWT HS256 + token-family 旋转 + refresh 黑名单,access token 7 天有效期,所有端点通过 `@ihui/auth` 共享包统一签发/验证。

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

所有 WS 端点通过 `wsAuth(socket, token)` 校验 JWT,支持心跳 ping/pong,多实例通过 Redis Pub/Sub 跨实例广播。

---

## 数据库

- **单库设计**:PostgreSQL 15,单库 `ihui`,通过 schema 隔离业务域
- **96+ 表**:34 个 schema 模块文件,覆盖 users / projects / files / billing / audit / chat / teams / rbac / workflow / comments / promotions / gamification / content / social / community / learn / exam / order / live / member / resource / point / schedule / statistics / message / topic / behavior / oss / setting / self-media / publish 等
- **32+ 迁移**:`packages/database/drizzle/`,drizzle-kit generate 生成 + 手动增量
- **7 步幂等 seed**:`packages/database/seed/`,模式化 + 容错隔离
- **行级安全**:RLS(Row Level Security)在关键字段启用,多租户隔离
- **类型安全**:Drizzle ORM 0.38,TypeScript strict 模式,端到端类型推导

---

## 可观测性

全栈可观测性,三支柱(指标 / 日志 / 追踪)完整就绪:

### 指标(Prometheus + Grafana)

- **Prometheus**(:9091):抓取 api `/metrics` + ai-service `/metrics` + node-exporter 主机指标
- **Grafana**(:3001):IHUI-AI 总览仪表盘自动 provision,包含请求 QPS / 响应时间 / 错误率 / 状态码分布 / 主机 CPU/内存/磁盘
- **Node Exporter**(:9100):主机 CPU / 内存 / 磁盘 / 网络指标

### 日志(Loki + Promtail)

- **Loki**(:3100):日志聚合后端
- **Promtail**:自动发现带 `logging=promtail` 标签的 Docker 容器,采集 Docker + Nginx + API 应用日志

### 追踪(OpenTelemetry + Jaeger)

- **OpenTelemetry Collector**(:4318):接收 OTLP 追踪 / 指标,导出到 Jaeger + Prometheus
- **Jaeger UI**(:16686):分布式追踪可视化,API ↔ AI 服务 ↔ 数据库全链路

### 健康检查

- `GET /api/health` — 后端综合健康(DB + Redis 探针)
- `GET /api/health/live` — Liveness
- `GET /api/health/ready` — Readiness
- `GET /health` — AI 服务健康检查

---

## 安全设计

| 维度             | 实现                                                                       |
| ---------------- | -------------------------------------------------------------------------- |
| **认证**         | JWT HS256 + token-family 旋转(防盗用)+ refresh token 黑名单                |
| **限流**         | 全局 100/min,auth login/register 10/min,分层 rate-limit                    |
| **加密**         | AES-256-GCM 加密 credentials(OSS 驱动凭证 + 教育设置凭证 + 发布平台账号)   |
| **密码**         | bcryptjs 哈希(member 表 SHA256 兼容旧 Java 数据)                           |
| **数据脱敏**     | password / passwordHash 字段在 API 响应中解构剥离                          |
| **事务安全**     | DB 事务化:order 支付/退款 + social tag + gamification 积分 + chat 清空消息 |
| **行锁**         | `.for('update')` 行锁防 TOCTOU 竞态                                        |
| **CSRF**         | `@fastify/csrf-protection` 双 token 模式                                   |
| **XSS**          | sanitizer 绕过检测脚本守门(pre-commit 第 6 项)                             |
| **API key 泄露** | `check-api-key-leak.mjs` 守门(pre-commit 第 1 项)                          |
| **RBAC**         | roleId >= 1 才能访问 admin 路由,plugin-level preHandler 统一鉴权           |
| **工作空间权限** | 3 模式 + 7 端点运行时拦截 + 60s 审计超时                                   |

---

## 工程守门(17 个 pre-commit 钩子)

项目通过 17 个 pre-commit 钩子 + post-commit 自动 push 杜绝协作事故:

| #   | 脚本                                         | 用途                                     |
| --- | -------------------------------------------- | ---------------------------------------- |
| 1   | check-api-key-leak.mjs                       | API key 泄露检测                         |
| 2   | check-i18n-keys.mjs                          | i18n 键完整性 + parity                   |
| 2b  | scan-i18n-zh-residue.mjs zh-TW               | zh-TW 简体字残留(opencc 字形转换)        |
| 2c  | scan-i18n-zh-residue.mjs ko                  | ko.json 中文残留(字符范围检测)           |
| 2d  | scan-i18n-zh-residue.mjs ja                  | ja.json 中文残留(warn-only)              |
| 2e  | check-i18n-broken-en.mjs                     | en.json 破碎机翻英文守门                 |
| 3   | check-db-schema-drift.mjs                    | schema drift 检测                        |
| 4   | check-stale-dist.mjs                         | packages 陈旧 dist 检测                  |
| 4b  | check-dist-encoding.mjs                      | packages dist UTF-8 BOM 守门             |
| 4c  | check-api-client-utf8.mjs                    | api-client 源码字节级 UTF-8 完整性       |
| 5   | lint-staged                                  | eslint + prettier                        |
| 6   | check-sanitizer-bypass.mjs                   | XSS sanitizer 绕过检测                   |
| 7   | check-dedupe.mjs                             | 依赖碎片化检测                           |
| 8   | check-api-routes.mjs                         | 前后端路由一致性                         |
| 9   | check-safe-parse.mjs                         | safeParse 静默忽略(warn-only)            |
| 11  | check-rounded-full.mjs                       | 容器圆角违规(强制尺寸梯度)               |
| 12  | check-delivery-report-consistency.mjs        | 交付报告一致性                           |
| 13  | check-grokbuild-integration-completeness.mjs | grok-build 整合完整性                    |
| 13b | check-project-plan-size.mjs                  | PROJECT_PLAN.md 体积 < 50KB              |
| 13c | check-project-plan-archive.mjs               | PROJECT_PLAN.md 已完成任务条目防误删     |
| 15  | check-api-migration-completeness.mjs         | 迁移完整性                               |
| 16  | 条件 typecheck                               | apps/web staged 时跑 typecheck           |
| 16b | 条件 database build                          | packages/database/src staged 时跑 build  |
| 17  | git-push-guard.mjs(post-commit)              | 自动 push + 验证 local == remote(防遗漏) |

---

## 测试

| 类型     | 框架       | 规模              | 命令                             |
| -------- | ---------- | ----------------- | -------------------------------- |
| 后端单元 | Vitest     | 38 文件,268 用例  | `pnpm --filter @ihui/api test`   |
| 前端 E2E | Playwright | 17 spec 文件      | `pnpm test:e2e`                  |
| AI 服务  | pytest     | 13 文件,400+ 用例 | `cd apps/ai-service && pytest`   |
| CLI 单元 | Vitest     | 13 文件           | `pnpm --filter @ihui/cli test`   |
| 全量验证 | turbo      | 22 tasks          | `pnpm turbo typecheck lint test` |

**测试策略**:Fastify inject 模式(不监听端口)+ Mock 数据库层 + 覆盖 auth / billing / content / success-paths / business-logic / edge-cases。

---

## 部署

### Docker Compose(推荐)

```bash
# 配置 .env.production
cp .env.production.example .env.production
# 编辑 JWT_SECRET / DB_PASSWORD / CREDENTIALS_ENCRYPTION_KEY / 微信支付证书 / SMTP 等

# 一键启动(api + web + ai-service + worker + db + redis + migrate + 监控栈)
docker compose up -d
```

服务清单(7 业务 + 7 监控):

| 服务           | 端口  | 用途                       |
| -------------- | ----- | -------------------------- |
| api            | 8080  | Fastify 后端               |
| worker         | 8081  | BullMQ 独立 worker 进程    |
| web            | 3000  | Next.js 前端(standalone)   |
| ai-service     | 8000  | FastAPI AI 服务            |
| db             | 5432  | PostgreSQL 15              |
| redis          | 6379  | Redis 7                    |
| migrate        | -     | 一次性迁移服务(完成后退出) |
| jaeger         | 16686 | 分布式追踪 UI              |
| otel-collector | 4318  | OpenTelemetry Collector    |
| prometheus     | 9091  | 指标采集                   |
| grafana        | 3001  | 可视化仪表盘               |
| node-exporter  | 9100  | 主机指标                   |
| loki           | 3100  | 日志聚合                   |
| promtail       | -     | 日志采集                   |

### 生产部署

详见 [DEPLOYMENT_RUNBOOK.md](docs/DEPLOYMENT_RUNBOOK.md) — 蓝绿部署 / 镜像 tag 切换 / Nginx upstream 切换 / 数据库备份恢复 / 证书续期 / 健康检查 / 回滚。

```bash
# 部署前 10 项硬性门禁自检
node scripts/pre-deploy.mjs

# PostgreSQL 备份
node apps/api/scripts/pg-backup.mjs

# 健康检查
./deploy/scripts/health-check.sh

# 回滚
./deploy/scripts/rollback.sh
```

### IaC 决策

本架构选用 **Docker Compose + GitHub Actions** 而非 K8s + Helm + ArgoCD,理由:

- 单 VM 即可部署,运维门槛低
- 无控制平面开销,资源利用率高
- 部署速度 10-30s(K8s 30s-2min)
- 适用规模 ≤ 5 服务 / 单团队 / 单集群

何时迁移 K8s:业务服务 > 10 / 跨可用区多活 / 单 VM 资源触顶 / 需要 HPA 自动伸缩 / 多租户 namespace 级别隔离。所有 Dockerfile 可直接复用为 K8s 容器镜像,迁移路径已预留。

---

## 国际化

5 语言 parity(键集合强一致性),由 4 个守门脚本保证质量:

| 语言  | 文件                           | 守门                                     |
| ----- | ------------------------------ | ---------------------------------------- |
| zh-CN | `apps/web/messages/zh-CN.json` | 基准语言                                 |
| zh-TW | `apps/web/messages/zh-TW.json` | opencc 字形转换检测简体字残留(阻塞)      |
| en    | `apps/web/messages/en.json`    | 破碎机翻英文检测(阻塞)                   |
| ko    | `apps/web/messages/ko.json`    | 字符范围检测中文残留(阻塞)               |
| ja    | `apps/web/messages/ja.json`    | 中文残留检测(warn-only,日文汉字词易误报) |

**品牌翻译策略**:优先官方英文名(智谱清言 → Zhipu AI,百度文心 → Baidu ERNIE,火山引擎 → Volcengine 等),机器可读映射表见 `scripts/brand-glossary.json`。

---

## 贡献

我们欢迎任何形式的贡献:Issue / PR / 文档改进 / Bug 修复 / 新功能 / 翻译 / 测试用例。

### 贡献流程

1. **Fork 仓库** → 创建分支 `feat/your-feature` 或 `fix/your-bugfix`
2. **阅读规范**:[AGENTS.md](AGENTS.md)(AI Agent 协作规范)+ [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)(人类贡献指南)
3. **本地开发**:`pnpm install && pnpm dev`,遵守 17 项 pre-commit 守门
4. **提交规范**:Conventional Commits(`feat:` / `fix:` / `docs:` / `chore:` / `test:` / `refactor:`)
5. **自验通过**:`pnpm turbo build typecheck lint test` 全绿
6. **提交 PR**:描述清晰,关联 Issue,等待 review

### 行为准则

- 尊重每一位贡献者,无论水平高低
- 用代码说话,不用身份说话
- 做**减法**优先,做加法谨慎 — 最小化代码,零冗余
- 不创建冗余文件,不加 copyright/license header
- 复用现有代码和模式,不重复造轮子

### 贡献方向

我们特别欢迎以下方向的贡献:

- **新模型适配**:接入更多 LLM 厂商(Replicate / Together AI / DeepInfra 等)
- **新发布平台**:接入更多内容发布平台(TikTok / Instagram / LinkedIn 等)
- **新语言**:新增 i18n locale(日语 / 阿拉伯语 / 葡萄牙语等)
- **新端适配**:增强现有 8 端 + 新增端(鸿蒙 HarmonyOS / 鸿蒙 Next)
- **AI 工作流**:贡献 LangGraph 工作流模板 / MCP 工具 / A2A Agent
- **企业级能力**:多租户隔离增强 / 审计日志完善 / SSO 集成(Okta / Keycloak)
- **测试覆盖**:增加边界用例 / E2E 场景 / 性能基准
- **文档改进**:更多使用教程 / 架构解析 / 最佳实践

---

## 文档导航

| 文档                                                         | 说明                                                             |
| ------------------------------------------------------------ | ---------------------------------------------------------------- |
| [docs/architecture.md](docs/architecture.md)                 | 系统架构(技术栈 / 数据库 / API 路由 / 启动流程 / 旧架构弃用说明) |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)                 | 贡献指南(环境搭建 / 代码规范 / 提交规范 / PR 流程)               |
| [docs/DEPLOYMENT_RUNBOOK.md](docs/DEPLOYMENT_RUNBOOK.md)     | 部署运维手册(蓝绿部署 / 回滚 / 证书续期)                         |
| [docs/SECURITY.md](docs/SECURITY.md)                         | 安全策略(漏洞披露 / 加密设计 / 权限模型)                         |
| [docs/EMAIL_SETUP.md](docs/EMAIL_SETUP.md)                   | 邮件服务配置(SMTP / 模板 / DKIM)                                 |
| [docs/I18N-COMPLETION-PLAN.md](docs/I18N-COMPLETION-PLAN.md) | 国际化完成计划                                                   |
| [docs/CHANGELOG.md](docs/CHANGELOG.md)                       | 变更日志                                                         |
| [docs/INCIDENTS.md](docs/INCIDENTS.md)                       | 历史事故复盘                                                     |
| [AGENTS.md](AGENTS.md)                                       | AI Agent 协作规范(21 节强制规则)                                 |
| [PROJECT_PLAN.md](PROJECT_PLAN.md)                           | 项目唯一任务计划文档                                             |

---

## 路线图

### 已交付(2026-07-20)

- 8 端全覆盖(Web / API / AI 服务 / CLI / 桌面 / 扩展 / 移动 RN / 小程序 Taro)
- 100+ 大模型 LiteLLM 统一接入
- LangGraph + MCP + A2A 三栈协同
- 自研 CLI + 6 源配置无缝导入(cc-switch / codex++ / Claude / Codex / Gemini / Hermes)
- 工作空间权限 3 模式 + 7 端点运行时拦截 + 60s 审计超时
- 自媒体工作台(公众号文章 + 口播稿双流水线)
- 14 平台一键自动发布平台
- AI 教育全栈(课程 / 题库 / 考试 / SRS / 直播 / 报告)
- 5 语言 i18n parity(zh-CN / zh-TW / en / ko / ja)
- 全栈可观测性(Prometheus + Grafana + Loki + Promtail + Jaeger + OpenTelemetry)
- 17 pre-commit 守门脚本 + post-commit 自动 push
- 企业级安全(RBAC + AES-256-GCM + JWT token-family + CSRF + XSS 守门)
- D 盘 → G 盘架构迁移整合 100% 完成(79 P0 + 37 P1 + 29 P2 全部修复)

### 进行中

- 内容发布平台 11 平台真实凭证调通(代码已就绪,需用户提供凭证)
- 多租户 namespace 级别隔离增强
- 鸿蒙 HarmonyOS / 鸿蒙 Next 端适配

### 规划中

- K8s + Helm + ArgoCD 重型 IaC 迁移(业务服务 > 10 时触发)
- 更多 AI 工作流模板市场
- A2A Agent 跨实例联邦
- 更多 i18n locale(阿拉伯语 / 葡萄牙语 / 西班牙语)

完整任务计划与历史归档见 [PROJECT_PLAN.md](PROJECT_PLAN.md)。

---

## 开源共建愿景

我们坚信:

> **AI 不应被少数平台垄断。每个人都应该拥有自己的 AI 程序。**

IHUI-AI 不是一个产品,而是一份**开源基础设施**。它存在的意义是:

- 让**个人开发者**用最低成本搭建属于自己的 AI 助手,数据完全自托管
- 让**中小企业**不用从零开始,基于它构建企业级 AI 中台
- 让**AI 服务商**复用成熟的多模型代理、计费、订阅能力,专注业务创新
- 让**教育机构**用 AI 教育全栈改造教学,让每个学生都有专属 AI 老师
- 让**内容创作者**用一键发布平台解放生产力,专注内容本身

每一行代码、每一个 PR、每一个 Issue 都让这个目标更近一步。无论你是初学者还是资深工程师,无论你贡献代码还是文档,无论你修复 Bug 还是提出建议 —— 你都是这个共建生态的一部分。

**Fork 它,改它,用它,把它变成你自己的。** 然后把改进反哺回来,让下一个开发者站在你的肩膀上。

这才是 AI 时代开源应有的样子。

---

## License

[Apache License 2.0](LICENSE) — 自由使用、修改、分发、商业使用,无传染性。

---

## 致谢

IHUI-AI 的诞生离不开以下开源项目的启发与支持:

- [Next.js](https://nextjs.org/) / [React](https://react.dev/) / [Tailwind CSS](https://tailwindcss.com/) / [shadcn/ui](https://ui.shadcn.com/)
- [Fastify](https://fastify.dev/) / [Drizzle ORM](https://orm.drizzle.team/) / [FastAPI](https://fastapi.tocloud.com/)
- [LangGraph](https://langchain-ai.github.io/langgraph/) / [LiteLLM](https://litellm.vercel.app/) / [MCP](https://modelcontextprotocol.io/)
- [Turborepo](https://turbo.build/) / [pnpm](https://pnpm.io/) / [Vitest](https://vitest.dev/) / [Playwright](https://playwright.dev/)
- [Tauri](https://tauri.app/) / [Taro](https://taro-docs.jd.com/) / [WXT](https://wxt.dev/) / [Expo](https://expo.dev/)
- [Prometheus](https://prometheus.io/) / [Grafana](https://grafana.com/) / [Loki](https://grafana.com/loki) / [Jaeger](https://www.jaegertracing.io/) / [OpenTelemetry](https://opentelemetry.io/)

感谢每一位贡献者,让这个项目持续演进。
