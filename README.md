# IHUI-AI · 智汇 AI

> **一个仓库,重新定义 AI 应用的边界。** IHUI-AI 是开源 AI Agent 平台与 LLM 网关的集大成者 —— 以 LangGraph + MCP + A2A 三栈为引擎,176 大模型统一调度,8 端同源 Monorepo,340 张表的生产级数据库,1300+ API 端点,14 平台自动发布,完整商业闭环,AI 教育全栈 —— Apache 2.0 协议,5 分钟 Fork 到上线。

<p align="center">
  <img src="apps/web/public/images/logo.png" width="140" alt="IHUI-AI Logo" />
</p>

<p align="center">
  <strong>在线 Demo</strong> · <a href="https://aizhs.top">https://aizhs.top</a> &nbsp;|&nbsp; <strong>GitHub</strong> · <a href="https://github.com/IHUI-INF-AI/IHUI-AI">Star 感谢支持</a><br/>
  <sub>8 端同源 · 176 模型 · LangGraph+MCP+A2A 三栈 · P3 深度层 · 完整商业闭环 · Apache 2.0 商业可用</sub>
</p>

<p align="center">
  <strong>这不是一个项目,这是一座 AI 工厂。</strong><br/>
  <sub>从模型调度到 Agent 编排,从支付计费到内容发布,从教育考试到可观测性 —— 别人用 40 个产品拼凑的能力,这里一个仓库全部内置。</sub>
</p>

<p align="center">
  <strong>340 张表 · 144 迁移 · 1300+ API 端点 · 21 Grafana 仪表盘 · 33+ 守门 · 237 测试套件 / 5346 用例 · 63 e2e spec · 5 语言 i18n parity</strong><br/>
  <sub>不是 PPT,不是画饼,不是占位 —— 每一个数字都能在代码里 grep 到</sub>
</p>

<p align="center">
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI/actions/workflows/ci.yml"><img src="https://github.com/IHUI-INF-AI/IHUI-AI/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI/actions/workflows/build.yml"><img src="https://github.com/IHUI-INF-AI/IHUI-AI/actions/workflows/build.yml/badge.svg" alt="Build" /></a>
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI/actions/workflows/e2e.yml"><img src="https://github.com/IHUI-INF-AI/IHUI-AI/actions/workflows/e2e.yml/badge.svg" alt="E2E" /></a>
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI/actions/workflows/knip.yml"><img src="https://github.com/IHUI-INF-AI/IHUI-AI/actions/workflows/knip.yml/badge.svg" alt="Knip" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue.svg" alt="License: Apache-2.0" /></a>
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI"><img src="https://img.shields.io/github/stars/IHUI-INF-AI/IHUI-AI?style=social" alt="Stars" /></a>
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI/issues"><img src="https://img.shields.io/github/issues/IHUI-INF-AI/IHUI-AI.svg" alt="Issues" /></a>
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI/pulls"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome" /></a>
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI"><img src="https://img.shields.io/github/last-commit/IHUI-INF-AI/IHUI-AI.svg" alt="Last Commit" /></a>
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI/graphs/contributors"><img src="https://img.shields.io/github/contributors/IHUI-INF-AI/IHUI-AI.svg" alt="Contributors" /></a>
</p>

<p align="center">
  <a href="README.md">简体中文</a> ·
  <a href="README.en.md">English</a> ·
  <a href="README.ko.md">한국어</a> ·
  <a href="README.ja.md">日本語</a>
</p>

<p align="center">
  <strong>国内镜像</strong> ·
  <a href="https://gitee.com/JLSLSSZWHYXGS_0/IHUI-AI">Gitee</a> ·
  <a href="https://gitcode.com/IHUI-AI/IHUI-AI">GitCode</a>
  <br/>
  <sub>国内用户克隆/下载更快,与 GitHub 自动同步</sub>
</p>

---

## 一键部署

> 5 分钟 Fork 到上线,不懂代码也能部署。详细图文指南见 [docs/deployment/family-friends-guide.md](docs/deployment/family-friends-guide.md)

<table align="center">
  <tr>
    <td align="center"><strong>Vercel</strong><br/><sub>前端 · 免费 · 全球 CDN</sub><br/><a href="https://vercel.com/new/clone?repository-url=https://github.com/IHUI-INF-AI/IHUI-AI&project-name=ihui-ai&repository-name=ihui-ai&env=NEXT_PUBLIC_API_URL&envDescription=API%20URL"><img src="https://vercel.com/button" alt="Deploy with Vercel" height="32" /></a></td>
    <td align="center"><strong>Railway</strong><br/><sub>后端 API · 免费 $5/月额度</sub><br/><a href="https://railway.app/new/template?template=https://github.com/IHUI-INF-AI/IHUI-AI&envs=DATABASE_URL,JWT_SECRET,CREDENTIALS_ENCRYPTION_KEY&databases=postgresql,redis"><img src="https://railway.app/button.svg" alt="Deploy on Railway" height="32" /></a></td>
  </tr>
  <tr>
    <td align="center"><strong>Render</strong><br/><sub>全栈 3 服务 · 免费层</sub><br/><a href="https://render.com/deploy?repo=https://github.com/IHUI-INF-AI/IHUI-AI"><img src="https://render.com/images/deploy-to-render-button.svg" alt="Deploy to Render" height="32" /></a></td>
    <td align="center"><strong>Heroku</strong><br/><sub>经典 PaaS · 免费 dyno</sub><br/><a href="https://heroku.com/deploy?template=https://github.com/IHUI-INF-AI/IHUI-AI"><img src="https://www.herokucdn.com/deploy/button.svg" alt="Deploy to Heroku" height="32" /></a></td>
  </tr>
</table>

### Docker Compose(推荐)

```bash
git clone https://github.com/IHUI-INF-AI/IHUI-AI.git
cd IHUI-AI
cp .env.example .env              # 复制环境变量模板,按提示填入密码
docker compose up -d              # 一键启动 14 服务(7 业务 + 7 监控)
```

访问 **http://localhost:8801**(前端)/ **8802**(API)/ **8803**(AI 服务)。端口表见 [docs/port-management.md](docs/port-management.md)。

### 零成本上线组合

| 角色     | 平台           | 免费额度        | 用途                  |
| -------- | -------------- | --------------- | --------------------- |
| 前端 Web | Vercel         | 100GB 流量/月   | 静态导出 + 全球 CDN   |
| 后端 API | Railway        | $5 额度/月      | Fastify + Drizzle ORM |
| AI 服务  | Render         | 750 小时/月     | FastAPI + LangGraph   |
| 数据库   | Railway/Render | 免费 PostgreSQL | 1GB 存储              |
| 缓存     | Railway/Render | 免费 Redis      | 25MB 存储             |

---

## 项目宣言

> 你有没有想过 ——
>
> 为什么 AI 红利总是被大厂独享?为什么搭建一个 AI 应用要从零拼凑认证、计费、模型路由、工作流、多端发布?为什么个人开发者、中小企业、教育机构总在重复造轮子,而不是站在彼此的肩膀上?
>
> **IHUI-AI 想改变这件事。**
>
> 我们把一个完整的 AI 应用基础设施 —— 从 8 端框架、176 模型接入、工作流编排、企业级权限、计费订阅、内容发布、AI 教育、可观测性,到 33 道工程守门 —— 以 Apache 2.0 协议全部开源出来。
>
> 这不是一个 demo,不是一个脚手架,不是一个套壳。这是一个**真正可生产、可商用、可自托管的 AI 超级平台**。每一个功能都有代码,每一行代码都有测试,每一个测试都能在 CI 里跑通。
>
> **让 AI 的力量,属于每一个人。**

---

## 核心能力总览(30 秒看完所有能力)

| 能力域 | IHUI-AI 交付的内容 | 对标产品 |
|--------|-------------------|----------|
| **8 端同源** | Web / API / AI-Service / Desktop(Tauri) / Extension(WXT) / Mobile(RN) / Miniapp(Taro) / CLI,16 共享包跨端复用 | Tauri+Electron+Expo+Taro+WXT 六个框架合一 |
| **176 模型网关** | LiteLLM 统一调度,31+ provider 适配器,智能路由 + FallbackRouter 故障转移 + 60% 缓存命中 | OpenAI Router / OmniRoute(超越) |
| **LangGraph 编排** | StateGraph 工作流 + PostgresSaver checkpoint + interrupt() HITL + 5 模式 streaming + Time Travel | LangGraph 商业版 |
| **MCP 协议** | 36 内置工具 + 3 资源 + 3 提示词 + MCP 路由 13 端点 + Sampling | Anthropic MCP |
| **A2A 协议** | Agent-to-Agent 通信 + 跨 Agent 任务委派 + Swarm 拓扑 | Google A2A |
| **完整商业闭环** | 10 支付网关 + VIP 4 档 + 积分计价 + 钱包 + 订阅 + 退款 + 发票 + 佣金 + 分销 + 优惠券 + 兑换码 | Stripe+PayPal+Auth0 合体 |
| **14 平台发布** | 文章 9 + 图片 1 + 视频 5,含反风控(指纹隔离/代理池/行为拟人化) | 蚁客+新媒体管家+Buffer |
| **AI 教育全栈** | 课程/题库/考试/直播(SRS)/证书/SM-2 间隔复习/AI 助教 7 学科/AI 批改 | Khan Academy+Coursera 开源版 |
| **P3 工程深度** | Rules 引擎 + Hook 服务 + Spec 模式 + L1-L9 自进化(技能迭代→失败聚类→元学习→A/B 测试→梦境固化→联邦学习→元认知) | Claude Code 工程体系 |
| **全链路可观测** | Prometheus + 21 Grafana 仪表盘 + Loki + Jaeger + OpenTelemetry + Alertmanager | Datadog 开源替代 |
| **5 语言 i18n** | zh-CN / zh-TW / en / ko / ja,100% parity + 23 脚本 + AI 翻译流水线 | next-intl 最佳实践 |
| **33+ 工程守门** | 32 pre-commit + 1 commit-msg,涵盖 i18n / 代码质量 / UI 样式 / 安全 / Push 同步 / 防提交丢失 | 企业级 CI/CD 标杆 |
| **多租户 RLS** | PostgreSQL 行级安全 + 租户路由 + 数据隔离 + 读写分离 | Supabase Enterprise |
| **CLI 对标 Claude Code** | 40+ 命令 + 25+ 工具 + ACP Server + LSP 集成 + 代码图谱 + 计划模式 | Claude Code / Codex |
| **桌面端自动更新** | Tauri 2 Updater,启动/使用中/退出三阶段零点击自动更新 | VS Code 自动更新 |

---

## 技术栈与项目规模

> 所有数字均与代码实测一致,可在代码里 grep 验证。

| 维度 | 实际值 |
|------|--------|
| **前端 Web** | Next.js 15 + React 19 + Tailwind CSS 4 + shadcn/ui + Zustand + TanStack Query 5 + Monaco Editor + xterm.js + Three.js + ECharts |
| **后端 API** | Fastify 5 + Drizzle ORM 0.38 + PostgreSQL 15 + Zod 3.24 + BullMQ + WebSocket + Swagger/OpenAPI |
| **AI 服务** | FastAPI + LangGraph 0.2 + LiteLLM 1.55+ + MCP + A2A + Socket.IO + Playwright + faster-whisper(Python 3.12) |
| **桌面端** | Tauri 2 + WebView2 + Rust + 自动更新(GitHub Releases 签名) |
| **扩展端** | WXT 0.19 + React 19 + Chrome Manifest V3 |
| **移动端** | Expo 53 + React Native 0.79 + NativeWind 4 + 微信登录/支付 |
| **小程序端** | Taro 4.2 + React 18 + 6 平台(微信/支付宝/百度/抖音/H5/快手) |
| **CLI 端** | Node.js 20+ + Commander 12 + ACP 协议 + LSP + 代码图谱 |
| **Monorepo** | pnpm 9.15 workspace + Turborepo 2.3 + 16 共享包 |
| **数据库** | 340 张表(155 schema 文件)/ 144 迁移 / pgvector 向量 / RLS 多租户 |
| **API 端点** | 1300+(200+ 路由文件)/ 12 WebSocket 通道 / v1 OpenAI 兼容 |
| **Web 页面** | 100+ 路由 / 40+ 组件分类 / 200+ 页面 |
| **测试覆盖** | 237 测试套件 / 5346 测试用例 + 63 e2e spec + pytest + Locust 压测 + Lighthouse |
| **可观测性** | Prometheus + 21 Grafana 仪表盘 + Loki + Promtail + Jaeger + OpenTelemetry + Alertmanager |
| **工程守门** | 33+ pre-commit/commit-msg 钩子 + post-commit 自动 push + 11 迁移审计 |
| **AI 编排** | LangGraph 真接入(21 文件使用),非"接入级编排" |
| **License** | Apache 2.0(完全自托管,商用友好,无传染性) |

---

## 8 端架构矩阵

> 8 端**独立代码**(非"一套代码编译适配"),各端完成度不同。16 个共享包(`@ihui/*`)跨端复用类型/UI/逻辑/API 客户端。

### Web 端(Next.js 15)

100+ 页面路由,涵盖 AI 对话、Agent 市场、知识库、多平台发布、管理后台、AI 教育、IDE 工作空间等全功能矩阵。

| 模块 | 页面 | 核心能力 |
|------|------|----------|
| **AI 对话** | `/chat` | 流式 Markdown、工具调用卡片、上下文管理、语音输入、技能库、斜杠命令 |
| **Agent 市场** | `/agents` | AgentGrid、市场筛选、我的 Agent、运行时面板、工作台、看板、子 Agent DAG |
| **AI 生成** | `/ai-generation` | 文本/图片/音频/视频/3D/音乐/代码多模态生成,通义/豆包/即梦/Qwen/Kling/Sora2 适配 |
| **知识库** | `/knowledge-base` | RAG 文档上传与检索、知识图谱、向量嵌入(DashScope/OpenAI/MiniMax) |
| **模型市场** | `/models` | 176 模型,ModelDetailDialog、QuickKeyDialog、定价页、AI 应用世界排行 |
| **发布管理** | `/publish` | 14 平台一键发布、账号管理、扫码登录、自媒体管理 |
| **管理后台** | `/admin/*` | 30+ 子模块:Agent/模型/用户/权限/VIP/订单/支付/钱包/敏感词/公告/API 调试/日志/渠道/优惠券 |
| **AI 教育** | `/learn` `/exam` `/edu` `/live` | 课程/题库/考试/直播(SRS)/证书/SM-2 间隔复习/AI 助教 7 学科 |
| **IDE 工作空间** | `/workspace` | 文件浏览器、Monaco 代码编辑、xterm 终端、调试面板、Diff 查看器、源码管理 |
| **商业闭环** | `/pricing` `/wallet` `/vip` | 定价/钱包/订单/VIP/积分/收益/开发者门户(API Key) |
| **社区** | `/circles` `/asks` `/plaza` | 问答/圈子/帖子/话题/广场 |
| **P3 深度层** | `/tools` `/hooks` `/rules` `/spec` | Rules 引擎、Hook 服务、Spec 模式 |

### API 端(Fastify 5)

200+ 路由文件,1300+ API 端点,12 WebSocket 通道。TypeScript 全栈类型安全。

| 能力域 | 路由模块 | 亮点 |
|--------|----------|------|
| **认证** | auth / auth-sso / mfa / auth-codes | JWT + SSO(微信/钉钉/飞书/企业微信/Apple/Google) + MFA + 验证码 |
| **Agent** | agents / agent-runtime / agent-langgraph | CRUD / 运行时 / LangGraph 编排 / 创建 / 看板 |
| **聊天** | chat / ai-chat-stream | 对话 / 模型 / 技能 / 流式 |
| **AI 能力** | ai-generation / ai-image-edit / ai-video-compose | 多模态生成 / 图片编辑 / 视频合成 / AI 助教 |
| **v1 协议** | v1-messages / v1-realtime / v1-midjourney | OpenAI 兼容 v1 API / Realtime WebSocket / Midjourney |
| **LLM 中继** | relay-public / developer-relay | LLM 中继网关 / 开发者门户 |
| **商业** | billing / payment-gateway / order / wallet / vip / point | 计费 / 10 支付网关 / 订单 / 钱包 / VIP / 积分 / 退款 |
| **发布** | publish-routes / self-media-routes | 14 平台发布 / 自媒体 |
| **管理后台** | admin/(40+ 子路由) + admin-extended + admin-sys | 完整 RBAC 后台 |
| **教育** | learn / exam / edu-extended / srs / study-plans | 课程 / 考试 / 间隔复习 / 学习计划 |
| **WebSocket** | ws-chat / ws-tasks / ws-notifications / ws-payment / ws-customer-service / ws-ai | 6 类实时通道 |
| **安全** | security / audit / gdpr / rbac | 安全 / 审计 / GDPR / RBAC |

50+ 插件层:安全(auth/csrf/xss/sqli/prompt-injection/threat-detector/mtls)、性能(rate-limit/cache/slow-sql-killer/n1-detector)、多租户(tenant/rls-context)、可观测(audit/metrics/otel/trace)。

### AI 服务端(FastAPI + LangGraph)

Python 3.12,80+ 服务文件,24 路由模块,18 LLM Provider。mypy strict 0 errors。

| 引擎 | 核心 | 交付能力 |
|------|------|----------|
| **LangGraph** | langgraph_service / agent_graph / agent_orchestrator | StateGraph 工作流 + PostgresSaver checkpoint + interrupt() HITL + 5 模式 streaming + Time Travel + 状态历史 |
| **MCP** | mcp_server.py | 36 内置工具(11 基础 + 12 浏览器 + 10 电脑)+ 3 资源 + 3 提示词 + 120s 全局超时 |
| **A2A** | a2a_service.py | Agent-to-Agent 协议 + 跨 Agent 任务委派 |
| **LLM 网关** | llm_gateway / FallbackRouter | 176 模型统一调度 + Key 池轮转 + 故障转移 + 响应缓存(Redis) |
| **RAG** | rag / knowledge_graph / knowledge_lookup | 三源并发检索(codebase_indexer + RAG + long_term_memory) |
| **记忆系统** | memory / long_term_memory / vector_memory / multimodal_memory | 四层记忆 + Dream 梦境固化 + 记忆衰减 + 多模态嵌入 |
| **自进化 L1-L9** | skill_evolution / meta_learner / dream_scheduler / federated_learner / metacognition | 技能迭代 → 失败聚类 → 元学习 → A/B 测试 → 梦境固化 → 联邦学习 → 元认知 |
| **上下文工程** | context_engine / token_compaction | Context Engineering + Token 压缩(RTK+Caveman,压缩率 93.35%) |
| **发布引擎** | publish/(15 适配器 + 反风控 6 模块) | 14 平台 + AES-256-GCM 凭证加密 + 调度器 + WebSocket 通知 |
| **语音 STT** | voice_stt / faster-whisper | 本地推理零成本,74MB 离线模型,替换付费 Whisper API |
| **Browser Hub** | browser_hub | CDP 完整 Chrome 内置浏览器,WebSocket 画面流,会话幂等 |

### 桌面端(Tauri 2)

跨平台桌面应用(Windows/macOS/Linux),WebView2 + Rust 后端,复用 Web 端全部能力。

- **自动更新**:Tauri Updater + GitHub Releases 公钥签名,启动/使用中/退出**三阶段零点击自动更新**
- **无边框窗口**:自定义标题栏,Dark 主题,1200x780 默认尺寸
- **CSP 安全**:限制 connect-src 到本地服务(8802 API / 8803 AI-Service)
- **分发**:Windows/macOS/Linux 全平台 bundle + Windows Store 资源

### 扩展端(WXT + Chrome MV3)

35+ Side Panel 页面,完整复刻 Web 端核心功能。Chrome Manifest V3。

- **Side Panel**:Chat / Agent / AI Apps / Skills / Models / ImageGen / Memory / Articles / Dashboard / Wallet / Settings 等 35+ 页面
- **Popup**:快捷操作入口
- **Background**:消息路由 / 通知管理 / Token 刷新
- **Content Script**:页面内容工具栏 + 位置记忆
- **IndexedDB**:词汇数据库(本地学习)
- **Agent 联动**:与 Web 端 Agent 控制桥接

### 移动端(Expo + React Native)

100+ 屏幕,iOS + Android 双端,微信登录/支付 + 生物识别 + 推送通知。

- **AI 对话**:Chat / AgentChat / AiAssistant
- **Agent**:市场 / 详情 / 创建 / 统计 / 评价
- **AI 多模态**:多模态生成 / AIGC 列表 / 发布 / 封面
- **教育**:课程系列 11 屏 / 考试 4 屏
- **社区**:圈子 / 问答 / 广场
- **商业**:分销 / 财务 / 优惠券 / 签到 / 会员卡
- **用户**:资料 / 设置 / 安全 / 会员权益 / 名片 / 证书 4 屏
- **微信集成**:登录(WX_APP_APPID)+ 支付 + Universal Link
- **生物识别**:expo-local-authentication(指纹/面容)
- **EAS Build**:iOS + Android 云构建

### 小程序端(Taro 4)

50+ 页面,6 平台一套代码(微信/支付宝/百度/抖音/H5/快手)。

- **AI 对话**:chat / agent / agent-detail / history / image / video / voice / career
- **教育**:课程详情/列表/星球/学习开发
- **考试**:答题/详情/列表/结果
- **社区**:圈子(create/detail/index)/问答/广场
- **商业**:分销(公司/成员/订单/计划/佣金/排名/团队/提现)/开发者(收入/订阅/提现)
- **会员**:权益/优惠券/积分
- **直播**:主播/日历/详情/历史/列表/预约
- **80+ 组件**:20+ Taro 适配器 + AgentRuntimePanel + PayButton + VipBenefitsPopup

### CLI 端(Node.js)

对标 Claude Code / OpenAI Codex,40+ 命令,25+ 工具,ACP 协议 Server。

- **命令系统**:agent / chat / checkpoint / context / developer / file-ops / hooks / import / knowledge / login / mcp / memory / models / plan / plugin / registry(7 个) / repl / security / serve / session / settings / share / skills / slash / spec / subagent / template / token / undo-redo / workflows
- **工具系统**:file-edit / git / git-advanced / github-pr / terminal / lsp / mcp-runtime / web-search / fetch-url / clipboard / codegraph / debug / todo-write / run-tests / ask-user / subagent
- **记忆系统**:short-term / long-term / embedding / vector-search / hybrid-search / chunker / dream / soul / query-expansion
- **ACP Server**:Agent Client Protocol,可作为 IDE 的 Agent 后端
- **LSP 集成**:代码补全/诊断/跳转
- **多 Agent 并行**:worker-pool + worktree 隔离
- **代码图谱**:增量索引(manager / parser / persist)
- **计划模式**:xstate 状态机
- **分发**:Homebrew / Scoop / Winget

---

## AI 三栈引擎:LangGraph + MCP + A2A

> 三栈协同,不是三栈拼凑。LangGraph 负责"怎么想",MCP 负责"怎么用",A2A 负责"怎么协作"。

### LangGraph —— Agent 编排引擎

真正接入 LangGraph(21 文件使用),不是"接入级编排"。

| 能力 | 实现 |
|------|------|
| **StateGraph 工作流** | `agent_graph.py` / `koubo_workflow.py` — 复杂多步 Agent 工作流 |
| **PostgresSaver checkpoint** | `langgraph_checkpoint.py` — 持久化检查点,崩溃恢复 |
| **interrupt() HITL** | Human-in-the-Loop,人在回路审批 |
| **5 模式 streaming** | `langgraph_stream.py` — values / updates / messages / events / debug |
| **Time Travel** | 状态历史回溯,回到任意 checkpoint 重跑 |
| **Agent 编排器** | `agent_orchestrator.py` — 多 Agent 协调中枢 |

### MCP —— Model Context Protocol

36 内置工具,服务端实现,兼容 Anthropic MCP 标准。

| 工具类别 | 数量 | 示例 |
|----------|------|------|
| **基础工具** | 11 | 文件操作、代码执行、搜索 |
| **浏览器控制** | 12 | 导航、点击、输入、截图、CDP |
| **电脑控制** | 10 | 键盘、鼠标、窗口、剪贴板 |
| **资源** | 3 | MCPResource 定义 |
| **提示词** | 3 | MCPPrompt 定义 |
| **路由端点** | 13 | 工具/资源/提示词/Skill/Slash/Sampling |

全局超时 MCP_GLOBAL_TIMEOUT = 120s,防 handler 无限挂起。

### A2A —— Agent-to-Agent 协议

`a2a_service.py` 实现 Agent 间通信与任务委派,支持 Swarm 拓扑,多 Agent 协同完成复杂任务。

---

## 176 模型统一网关

> 一个 API,调全球 176 个大模型。LiteLLM 统一调度,智能路由,故障转移,缓存省钱。

### Provider 适配器(18 个原生 + 31+ 配置)

| 类别 | Provider | 说明 |
|------|----------|------|
| **国际大厂** | OpenAI / Anthropic / Google Gemini | GPT-4o / Claude 3.5 / Gemini 2.0 |
| **国内大厂** | 阿里 DashScope / 字节豆包 / 智谱 GLM / 腾讯混元 / 火山引擎 | 通义千问 / 豆包 / GLM-4 / 混元 / Doubao |
| **新兴厂商** | 阶跃星辰 StepFun / 快手可灵 / 即梦 / Luyala | Step / Kling / Jimeng |
| **聚合平台** | OpenRouter | 200+ 模型一个 Key |
| **本地推理** | Ollama / llama.cpp / LM Studio / Qwen Local | 零成本,完全离线 |
| **免费 provider** | Cloudflare / NVIDIA / GitHub / Vercel AI Gateway / Modal / Inference.net / NLP Cloud / Scaleway / Alibaba Intl | 注册即用,零成本 |
| **OpenAI 兼容** | Cerebras / Mistral / Cohere / HuggingFace / ZAI / Kilo / Pollinations / LLM7 / OVH / AIHorde / Reka / Routeway / Bazaarlink / AINative | 14 个兼容端点 |

### 网关核心能力

| 能力 | 说明 |
|------|------|
| **FallbackRouter 故障转移** | 主 provider 挂了自动切备用,不间断服务 |
| **Key 池轮转** | 多 Key 负载均衡,单 Key 限速不阻塞 |
| **Combo 多级 fallback** | 3 策略(priority / cheapest / fusion 并发票决),超越 OmniRoute |
| **协议互转** | OpenAI ↔ Anthropic ↔ Gemini 三协议互转 |
| **响应缓存(Redis)** | hash key 命中直接返回不计费,省钱利器 |
| **Token 压缩** | RTK+Caveman 算法,压缩率 **93.35%**(超越 OmniRoute 89%) |
| **模型映射** | gpt-4o → deepseek-chat,降本神器 |
| **prompt cache 折扣** | cache hit 10% / creation 125%,Anthropic 原生格式 |
| **渠道亲和性** | 最小连接数路由 + 用户级模型限流 |
| **TLS stealth** | 6 UA 池 + OpenRouter 403 代理 failover |

### 积分计价系统

5 档倍数梯度,支持 SaaS 多租户计费:

| 档位 | 倍数 | 适用模型 | 示例 |
|------|------|----------|------|
| 免费 | ×0 | 免费 provider | Cloudflare / NVIDIA / GitHub |
| 经济 | ×1 | 轻量模型 | Qwen-Turbo / GLM-Flash |
| 标准 | ×3 | 主力模型 | GPT-4o-mini / Claude Haiku |
| 高级 | ×10 | 强力模型 | GPT-4o / Claude Sonnet |
| 旗舰 | ×30 | 顶级模型 | GPT-4o / Claude Opus / Gemini Ultra |

---

## 完整商业闭环

> 别人花 $300/月拼凑 Stripe + Auth0 + Mailgun + Mixpanel,这里全部内置。

### 支付网关(10 个)

| 支付方式 | 场景 | 状态 |
|----------|------|------|
| **微信支付** | 国内主流,V3 安全加固 + 商户私钥 + 平台证书激活 | 生产就绪 |
| **支付宝** | 国内主流,沙箱/生产双环境 | 生产就绪 |
| **Stripe** | 国际信用卡,Subscription + Checkout + Webhook | 生产就绪 |
| **PayPal** | 国际支付,沙箱/生产双环境 | 生产就绪 |
| **USDT 加密货币** | Web3 场景,链上支付 | 已集成 |
| **对公转账** | 企业客户,发票开具 | 已集成 |

### 计费体系

| 模块 | 能力 |
|------|------|
| **VIP 4 档会员** | plan-driven 中间件,42 模型价格 seed,权益矩阵 |
| **API 订阅包** | orderType=6,产品化订阅 |
| **积分系统** | 5 档梯度计价,充值/消耗/退款全链路 |
| **钱包** | 余额管理,充值/提现/明细 |
| **兑换码** | 充值码系统,批量生成/核销 |
| **优惠券** | 裂变体系,满减/折扣/限时 |
| **返佣** | relay 消费返佣,分销佣金 |
| **阶梯计价** | 充值阶梯折扣,量大优惠 |
| **退款** | 退款审计,全链路追溯 |
| **发票** | 发票管理,对公开票 |
| **Webhook** | 支付回调,实时通知 |

### 安全与合规

| 能力 | 实现 |
|------|------|
| **多租户 RLS** | PostgreSQL 行级安全,租户数据隔离 |
| **RBAC** | 角色/权限/菜单,精细到按钮级 |
| **零信任** | mTLS + 网络分段 + 设备指纹 |
| **风控** | IP 信誉 + 频率限制 + 分布式限流 |
| **GDPR** | 数据导出/删除/匿名化 |
| **审计** | 全操作审计链,不可篡改 |
| **凭证加密** | AES-256-GCM,平台账号凭证加密存储 |
| **凭证轮换** | watchdog + 自动化监控告警 |

---

## 14 平台自动发布

> 一个后台,管 14 个平台。文章/图片/视频全覆盖,反风控保驾护航。

### 平台清单

| # | 平台 | 类型 | 适配器 |
|---|------|------|--------|
| 1 | CSDN | 文章 | csdn.py |
| 2 | 知乎 | 文章 | zhihu.py |
| 3 | 掘金 | 文章 | juejin.py |
| 4 | 微博 | 文章 | weibo.py |
| 5 | 微信公众号 | 文章 | wechat.py |
| 6 | WordPress | 文章 | wordpress.py |
| 7 | Medium | 文章 | medium.py |
| 8 | 博客园 | 文章 | cnblogs.py |
| 9 | 今日头条 | 文章 | toutiao.py |
| 10 | 小红书 | 图片 | xiaohongshu.py |
| 11 | 视频号 | 视频 | shipinhao.py |
| 12 | B 站 | 视频 | bilibili.py |
| 13 | 抖音 | 视频 | douyin.py |
| 14 | 快手 | 视频 | kuaishou.py |
| 15 | YouTube | 视频 | youtube.py |

### 反风控体系(6 模块)

| 模块 | 能力 |
|------|------|
| **指纹隔离** | 每个账号独立浏览器指纹 |
| **代理池** | IP 轮换,防关联 |
| **行为拟人化** | 模拟真人操作节奏 |
| **账号画像** | 账号健康度评分 |
| **隐身模式** | stealth 反检测 |
| **浏览器工厂** | Playwright 多实例管理 |

### 发布流程

扫码登录(`/scan-login`内置浏览器) → 账号管理(`/publish/accounts`) → 创建发布任务(`/publish/new`) → 调度器排队 → Playwright 自动发布 → WebSocket 实时通知 → 结果统计。

---

## AI 教育全栈

> 开源版 Khan Academy + Coursera,Apache 2.0 协议,教育机构可直接 fork 部署。

| 模块 | 能力 |
|------|------|
| **课程系统** | 课程/章节/资源/附件/评论/问答/报名/筛选/目录 |
| **题库系统** | 题目管理/组卷/随机出题 |
| **考试系统** | 在线考试/答题/判分/历史记录 |
| **直播 SRS** | 直播间/主播/日历/预约/历史 |
| **证书系统** | 证书生成/验证/4 屏管理 |
| **SM-2 间隔复习** | 科学记忆算法,个性化复习计划 |
| **AI 助教** | 7 学科(数学/物理/化学/生物/英语/语文/编程),学科讲解/提示/出题 |
| **AI 批改** | 主观题自动评分 |
| **学习计划** | study-plans,个性化路径 |

---

## P3 AI 工程深度层

> 对标 Claude Code 的工程体系,不只是"能用",而是"工程级能用"。

### Rules / Hooks / Spec 三件套

| 能力 | 说明 |
|------|------|
| **Rules 引擎** | rules_engine.py + rules.py 路由,规则化约束 |
| **Hook 服务** | hook_engine.py + hooks.py 路由,生命周期钩子 |
| **Spec 模式** | spec_generator.py + spec.py 路由,规格驱动开发 |

### L1-L9 自进化体系

> Agent 不是"调一次就完",而是"越用越聪明"。

| 层级 | 能力 | 服务 |
|------|------|------|
| **L1 技能迭代** | 技能自动优化 | skill_iterator / skill_evolution_scheduler |
| **L2 失败聚类** | 失败模式识别 | failure_clusterer |
| **L3 元学习** | 跨任务知识迁移 | meta_learner / meta_learner_scheduler |
| **L4 A/B 测试** | 技能效果验证 | ab_test_scheduler / ab_test_tracker |
| **L5 梦境固化** | 离线记忆整合 | dream_scheduler / dream_service |
| **L6 联邦学习** | 多 Agent 知识共享 | federated_learner |
| **L7 元认知** | 自我反思 | metacognition |
| **L8 技能反馈** | 用户反馈闭环 | skill_feedback / skill_tester |
| **L9 主动遗忘** | 记忆衰减 | active_forgetter / memory_decay |

### 上下文工程

| 能力 | 说明 |
|------|------|
| **Context Engine** | 上下文窗口管理 |
| **Token 压缩** | RTK+Caveman 算法,压缩率 93.35% |
| **上下文压缩 V2** | CLI 端 compaction-v2.ts |
| **Doom Loop 检测** | 防止 Agent 陷入死循环 |
| **四层记忆** | 短期/长期/向量/多模态 |
| **Dream 梦境** | 离线记忆整合 |
| **Soul 灵魂** | Agent 人格持久化 |

---

## 工程守门体系

> 33+ 道守门,不是"写了就完",而是"每一行代码都被审查"。

### 守门分类(32 pre-commit + 1 commit-msg)

| 类别 | 项数 | 核心 |
|------|------|------|
| **i18n** | 9 | key parity / zh-TW 繁体字形 / ko 中文残留 / ja 中文残留 / en 破碎机翻 / AI 翻译流水线 / 命名空间传递 / cli parity |
| **代码质量** | 10 | API key 泄露 / schema drift / 陈旧 dist / UTF-8 完整性 / lint-staged / sanitizer / dedupe / 路由一致性 / safeParse / OpenAPI |
| **UI/样式** | 8 | 圆角(禁 rounded-full) / CSS token / title tooltip / Tailwind 冲突 / z-index / miniapp design-tokens 同步 |
| **工程约束** | 7 | 交付报告一致性 / PLAN 体积 / 迁移完整性 / staged 污染 / 多端同步 / README 同步 / staged 清单 |
| **Push/工作区** | 3 | 项目外路径(阻塞) / 父目录污染(阻塞) / Push 同步(阻塞) |
| **防提交丢失** | 1 | reflog reset 检测 + fsck 悬空 commit + lost-commit tag 备份 |
| **Python 类型** | 1 | mypy 检查(阻塞) |
| **依赖治理** | 1 | solito 幽灵依赖回归守门 |
| **迁移完整性** | 1 | mobile-rn screen 迁移守门 |
| **共享层重复** | 1 | 端内重新实现 shared hook/util 检测 |

### 自动化防线

| 防线 | 触发 | 动作 |
|------|------|------|
| **pre-commit** | git commit | 33+ 检查,阻塞/警告 |
| **post-commit** | git commit | git-push-guard 自动 push + 验证 local == remote |
| **pre-push** | git push | pnpm typecheck:full,失败阻止 push |
| **commit-msg** | git commit | 交付报告一致性守门 |

---

## 全链路可观测性

> 21 个 Grafana 仪表盘,不是"能看到日志",而是"能看到一切"。

| 组件 | 能力 |
|------|------|
| **Prometheus** | 指标采集,alerts.yml 告警规则 |
| **Grafana** | 21 仪表盘,全链路可视化 |
| **Loki** | 日志聚合 |
| **Promtail** | 日志收集 |
| **Jaeger** | 分布式追踪 |
| **OpenTelemetry** | 标准化遥测 |
| **Alertmanager** | 告警 + noise-rules 噪音过滤 |

监控覆盖:API 响应时间 / AI 模型调用量 / LLM 成本追踪 / WebSocket 连接数 / 数据库慢查询 / Redis 命中率 / 支付成功率 / 发布任务状态 / Agent 运行时指标 / 资源使用率。

---

## 5 语言 i18n 体系

> 100% parity,不是"翻译了",而是"5 语言完全对齐"。

| 维度 | 数据 |
|------|------|
| **支持语言** | zh-CN(基准) / zh-TW(繁体) / en / ko / ja |
| **命名空间** | 68 个 |
| **守门脚本** | 23 个 .mjs(4 web + 4 extension + 2 AI 翻译流水线 blocking × 2 端) |
| **品牌映射** | brand-glossary.json 95 条 canonical 映射 |
| **AI 翻译流水线** | i18n-diff → AI agent 翻译 → i18n-apply,零 LLM API 调用,开发成本降 70%+ |
| **治理 4 阶段** | 动态拼接 307→0 + 无引用 key 453→0 + 递归 key 9910→9679 |

---

## 竞品对比矩阵

> 不是功能覆盖度对标,是"一个仓库 vs 40+ 产品"的降维打击。

| 对比维度 | Dify / FastGPT / Langflow | Claude Code / Cursor / Copilot | Stripe / Auth0 / Clerk | LangChain / AutoGen / CrewAI | Khan Academy / Coursera | 蚁客 / 新媒体管家 | **IHUI-AI** |
|----------|---------------------------|-------------------------------|------------------------|------------------------------|-------------------------|-------------------|-------------|
| AI 应用编排 | 有 | 无 | 无 | 框架级 | 无 | 无 | **有(LangGraph)** |
| 176 模型网关 | 部分 | 无 | 无 | 无 | 无 | 无 | **有(LiteLLM)** |
| MCP 协议 | 无 | 部分 | 无 | 无 | 无 | 无 | **有(36 工具)** |
| A2A 协议 | 无 | 无 | 无 | 无 | 无 | 无 | **有** |
| 8 端同源 | 无 | 无 | 无 | 无 | 无 | 无 | **有(16 共享包)** |
| CLI 工具 | 无 | 有 | 无 | 无 | 无 | 无 | **有(40+ 命令)** |
| 完整商业闭环 | 无 | 无 | 有(单一) | 无 | 无 | 无 | **有(10 支付)** |
| 14 平台发布 | 无 | 无 | 无 | 无 | 无 | 有 | **有** |
| AI 教育全栈 | 无 | 无 | 无 | 无 | 有(闭源) | 无 | **有(开源)** |
| 全链路可观测 | 部分 | 无 | 无 | 无 | 无 | 无 | **有(21 仪表盘)** |
| 33+ 工程守门 | 无 | 无 | 无 | 无 | 无 | 无 | **有** |
| 多租户 RLS | 部分 | 无 | 无 | 无 | 无 | 无 | **有** |
| Apache 2.0 开源 | 部分 | 闭源 | 闭源 | 部分 | 闭源 | 闭源 | **是** |

**核心差异化**:在全球开源 AI 生态里,你找得到比 IHUI-AI 更专的项目,但找不到比 IHUI-AI 更全的开源平台。把 6 大类商业产品的能力整合进一个 Apache 2.0 仓库。

---

## 技术栈详情

### 前端 Web(Next.js 15)

```
Next.js 15 (App Router + Turbopack) + React 19 + TypeScript
Tailwind CSS 4 + shadcn/ui (Radix UI) + Zustand
TanStack Query 5 + TanStack Table 8
Monaco Editor + xterm.js + TipTap + Three.js + ECharts + Mermaid
Playwright (E2E + 视觉回归) + Storybook
next-intl (5 语言) + next-themes (暗色模式)
XState 5 (状态机) + Zod (校验) + pdfjs-dist (PDF)
```

### 后端 API(Fastify 5)

```
Fastify 5 + TypeScript + Drizzle ORM 0.38 + postgres-js
Zod 3.24 + JWT (@fastify/jwt) + Argon2/bcryptjs
BullMQ (任务队列) + ioredis (Redis) + node-cron
OpenTelemetry + Pino + Swagger/OpenAPI
@fastify/websocket (12 WebSocket 通道)
Alipay / WeChat Pay / PayPal / Stripe (多支付)
Sharp / pdf-lib / pdfkit / exceljs / xlsx / mammoth
nodemailer + 阿里云短信
node-pty (终端) + fluent-ffmpeg (转码)
```

### AI 服务(FastAPI + LangGraph)

```
FastAPI + Uvicorn (ASGI) + Pydantic 2 + Python 3.12+
LangGraph 0.2 + LangChain 0.3 + LangChain-OpenAI/Anthropic
LiteLLM 1.55+ (176 模型) + MCP 1.0+ + A2A
asyncpg + Redis (hiredis) + APScheduler + croniter
Playwright (浏览器自动化 / 截图 / 发布)
faster-whisper (本地语音 STT,零成本)
OpenTelemetry + Prometheus + Socket.IO
mypy strict (0 errors) + BeautifulSoup4 + pdfplumber
```

### 桌面端(Tauri 2)

```
Tauri 2 + WebView2 + Rust
自动更新 (Tauri Updater + GitHub Releases 签名)
无边框窗口 + 自定义标题栏
CSP 安全策略
```

### 扩展端(WXT + Chrome MV3)

```
WXT 0.19 + React 19 + TypeScript
Tailwind CSS 4 + @ihui/ui-react
Chrome Manifest V3 (minimum 114)
@wxt-dev/storage + @wxt-dev/module-react
react-router-dom 6
```

### 移动端(Expo + React Native)

```
Expo 53 + React Native 0.79 + React 19 + TypeScript
React Navigation 6 + NativeWind 4
Expo modules: audio / device / image-picker / linking / local-authentication / notifications / secure-store / status-bar / web-browser
react-native-wechat-lib (微信登录/支付)
Zustand + AsyncStorage + expo-secure-store
```

### 小程序端(Taro 4)

```
Taro 4.2 + React 18 + TypeScript
Tailwind CSS 3.4 + weapp-tailwindcss 5.1
Zustand
6 平台: weapp / alipay / swan / tt / h5 / 快手
Vite + Webpack5 双构建器
```

### CLI 端(Node.js)

```
Node.js 20+ / TypeScript / ESM
Commander 12 + Inquirer 12 + Chalk 5 + Ora 8
@agentclientprotocol/sdk 1.2 (ACP 协议)
vscode-jsonrpc + vscode-languageserver-protocol (LSP)
gpt-tokenizer + ws (WebSocket)
```

### 共享包(16 个)

| 包 | 用途 |
|----|------|
| `@ihui/database` | Drizzle ORM + PostgreSQL,155 schema / 340 表 / 144 迁移 / RLS / pgvector |
| `@ihui/auth` | JWT / OAuth2 / Token Family / Key Rotation / Blacklist / WS Auth |
| `@ihui/types` | 38 个跨端 TypeScript 类型文件 |
| `@ihui/shared` | 16 hooks / 25+ utils / stores / constants / workflows(xstate) |
| `@ihui/api-client` | 统一 API 调用层 + 熔断器 + WebSocket 客户端 |
| `@ihui/ui-react` | 30+ shadcn/ui 风格组件 + 登录组件套件 |
| `@ihui/ui-native` | 15 个 React Native 组件 |
| `@ihui/design-tokens` | Web/RN/小程序三端设计令牌同步 |
| `@ihui/i18n` | 跨端国际化加载器 |
| `@ihui/sdk` | 6 语言 SDK(TS + Go + Python + Java + .NET + Rust) |
| `@ihui/context-compaction` | 上下文压缩(CLI 与 API 共享) |
| `@ihui/eslint-config` | ESLint 共享配置 + 跨端规则 |
| `@ihui/tsconfig` | TypeScript 共享配置 |
| `@ihui/browser-platform` | 浏览器平台抽象层 |
| `@ihui/dom-actions` | DOM 操作抽象 |
| `@ihui/app` | Expo 应用入口抽象 |

---

## 部署方式

### 1. Docker Compose(推荐)

```bash
git clone https://github.com/IHUI-INF-AI/IHUI-AI.git
cd IHUI-AI
cp .env.example .env
docker compose up -d              # 14 服务(7 业务 + 7 监控)
docker compose --profile observability up -d  # 含监控
```

### 2. 一键部署平台

| 平台 | 用途 | 链接 |
|------|------|------|
| Vercel | 前端 Web | [Deploy](https://vercel.com/new/clone?repository-url=https://github.com/IHUI-INF-AI/IHUI-AI) |
| Railway | 后端 API + DB | [Deploy](https://railway.app/new/template?template=https://github.com/IHUI-INF-AI/IHUI-AI) |
| Render | 全栈 3 服务 | [Deploy](https://render.com/deploy?repo=https://github.com/IHUI-INF-AI/IHUI-AI) |
| Heroku | 经典 PaaS | [Deploy](https://heroku.com/deploy?template=https://github.com/IHUI-INF-AI/IHUI-AI) |

### 3. 本地开发

```bash
pnpm install                     # 安装依赖
pnpm dev                          # 启动所有服务(web:8801 + api:8802 + ai-service:8803)
pnpm turbo build typecheck lint test  # 全量验证
```

### 4. 其他部署资源

| 资源 | 说明 |
|------|------|
| `deploy/docker/` | 4 个 Dockerfile + nginx |
| `deploy/nginx/` | 蓝绿部署配置 |
| `deploy/observability/` | docker-compose 可观测性栈 |
| `deploy/scripts/` | deploy.sh / rollback.sh / backup-db.sh / health-check.sh |
| `deploy/homebrew/` | Homebrew Formula(ihui.rb) |
| `deploy/scoop/` | Windows Scoop manifest |
| `deploy/snap/` | Ubuntu Snap |
| `deploy/winget/` | Windows Winget manifest |

详细部署文档:[一键部署](docs/deployment/one-click-deploy.md) · [Vercel](docs/deployment/vercel-deploy.md) · [Railway](docs/deployment/railway-deploy.md) · [家人朋友代部署](docs/deployment/family-friends-guide.md) · [DEPLOYMENT_RUNBOOK](docs/DEPLOYMENT_RUNBOOK.md)

---

## 开源商业化

> Apache 2.0 协议,完全自托管,商用友好,无传染性。同时提供企业版和专业服务。

### 企业版 4 档报价

| 版本 | 年费 | 用户上限 | 部署 | SLA | 响应 |
|------|------|----------|------|-----|------|
| 社区版 | 免费 | 无限 | 自部署 | 无 | 社区 |
| Starter | ¥5 万 | ≤50 | SaaS | 99.5% | 8h 邮件 |
| Business | ¥10 万 | ≤200 | SaaS | 99.9% | 4h 工单+群 |
| Enterprise | ¥30 万 | 无限 | 私有/混合 | 99.9% | 2h 专属 |
| Custom | ¥50 万+ | 无限 | 完全私有化 | 99.99% | 1h 专属团队 |

### 专业服务

| 服务 | 价格 | 内容 |
|------|------|------|
| 私有化部署 | ¥4,999/次 | 源码部署 + 2h 培训 + 30 天邮件支持 |
| 企业培训工作坊 | ¥9,999/场 | 1 天线下/2 天线上 + 核心维护者授课 |
| 定制开发 | ¥19,999 起 | 80 工时 + 3 个月保修 |
| 技术咨询 | ¥999/小时 | 架构咨询/技术选型/代码 review |

详细见:[企业服务白皮书](docs/enterprise-service/whitepaper.md) · [功能对比](docs/enterprise-service/feature-comparison.md) · [报价生成器](docs/enterprise-service/quote-generator.mjs) · [商业化文档](docs/monetization/)

---

## 典型使用场景

### 场景 1:AI 中转站造血

5 分钟搭建 LLM 中转站,对标超越 SwiftAPI / New API。176 模型统一网关 + Combo fallback + 响应缓存 + 模型映射 + 渠道负载均衡 + API Key 分组 + 实时监控 Dashboard + 兑换码 + 优惠券 + 返佣。

### 场景 2:企业 AI 内部平台

8 端同源,员工用 Web / CLI / 桌面端 / 扩展,管理层用管理后台。多租户 RLS 隔离,RBAC 权限,SSO 登录,全链路审计,21 仪表盘监控。

### 场景 3:内容创作者一键分发

14 平台自动发布,文章/图片/视频全覆盖。反风控保驾护航,扫码登录内置浏览器,一个后台管所有平台。

### 场景 4:教育机构 AI 教学平台

课程/题库/考试/直播/证书/SM-2 间隔复习/AI 助教 7 学科/AI 批改。Apache 2.0 协议,直接 fork 部署,无需从零开发。

### 场景 5:AI Agent 开发者

LangGraph 工作流 + MCP 36 工具 + A2A 协议 + L1-L9 自进化。CLI 对标 Claude Code,ACP Server 可作为 IDE Agent 后端。Agent 市场 + 看板 + DAG 子 Agent。

### 场景 6:全栈 AI SaaS 创业

10 支付网关 + VIP + 积分 + 订阅 + 钱包 + 退款 + 发票 + 佣金 + 分销。5 分钟 Fork 到上线,零成本启动。

---

## 路线图

### 已完成

- [x] 8 端同源 Monorepo(Web / API / AI-Service / Desktop / Extension / Mobile / Miniapp / CLI)
- [x] 176 模型统一网关(LiteLLM + 31+ provider + FallbackRouter)
- [x] LangGraph + MCP + A2A 三栈引擎
- [x] 完整商业闭环(10 支付 + VIP + 积分 + 订阅 + 退款)
- [x] 14 平台自动发布 + 反风控
- [x] AI 教育全栈(课程/题库/考试/直播/证书/SM-2)
- [x] P3 工程深度层(Rules / Hooks / Spec + L1-L9 自进化)
- [x] 全链路可观测性(21 Grafana 仪表盘)
- [x] 5 语言 i18n parity + AI 翻译流水线
- [x] 33+ 工程守门 + 防提交丢失
- [x] 桌面端三阶段零点击自动更新
- [x] P0 中转站造血能力(3 批次,对标超越 SwiftAPI / New API)
- [x] P0 AI 网关核心补强(超越 OmniRoute,Token 压缩 93.35%)
- [x] miniapp-taro 样式与功能组件完整对齐(159 页清单)
- [x] 多端维护成本优化(6.8x → 3.1x,降本 54.4%)

### 进行中

- [ ] P0 中转站第三批次收尾(/v1/responses / /v1/batch / /v1/assistants / 参数覆盖 / Passkey / USDT)
- [ ] 6 语言 SDK 发布(TS + Go + Python + Java + .NET + Rust)
- [ ] 更多 LLM provider 接入(目标 200+ 模型)

### 规划中

- [ ] AI Agent Marketplace 公开市场(对标 Coze)
- [ ] 知识图谱可视化编辑器
- [ ] 多模态 Agent(视觉 + 听觉 + 语言)
- [ ] 联邦学习跨组织知识共享
- [ ] AI Code Review 自动化
- [ ] 更多平台发布(目标 20+)

---

## 贡献指南

欢迎贡献!请阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 了解开发流程。

```bash
# 开发环境
pnpm install
pnpm dev                          # 启动所有服务

# 验证
pnpm turbo build typecheck lint test

# 单独验证
pnpm --filter @ihui/api typecheck  # 后端
pnpm --filter @ihui/web typecheck  # 前端
```

### 项目工程规范

项目遵循严格的工程规范(见 [AGENTS.md](AGENTS.md)),包括:

- TypeScript 类型零技术债(禁用 `any`,优先 `unknown` + 类型守卫)
- 共享层优先(写新代码前先查 `packages/` 是否已有实现)
- 8 端同步开发(默认全端连通,平台独占需标注)
- 单分支开发(所有改动统一往 main 合并)
- 33+ 工程守门脚本(pre-commit + commit-msg + post-commit)
- 防提交丢失(reflog 检测 + fsck 悬空 commit + tag 备份)

---

## 文档资源

| 文档 | 说明 |
|------|------|
| [docs/architecture.md](docs/architecture.md) | 系统架构 |
| [docs/MULTI_END.md](docs/MULTI_END.md) | 8 端架构矩阵 |
| [docs/AI_SERVICE.md](docs/AI_SERVICE.md) | AI 服务深度文档 |
| [docs/API_REFERENCE.md](docs/API_REFERENCE.md) | API 参考 |
| [docs/LLM_SETUP.md](docs/LLM_SETUP.md) | LLM 接入指南 |
| [docs/I18N.md](docs/I18N.md) | i18n 体系 |
| [docs/DATABASE.md](docs/DATABASE.md) | 数据库文档 |
| [docs/DEPLOYMENT_RUNBOOK.md](docs/DEPLOYMENT_RUNBOOK.md) | 部署手册 |
| [docs/GATEKEEPERS.md](docs/GATEKEEPERS.md) | 守门脚本 |
| [docs/SECURITY.md](docs/SECURITY.md) | 安全文档 |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | 变更日志 |
| [docs/port-management.md](docs/port-management.md) | 端口注册表 |
| [docs/credit-pricing.md](docs/credit-pricing.md) | 模型积分计价 |
| [docs/blog/](docs/blog/) | 15 篇技术博客 |

---

## 许可证

[Apache License 2.0](LICENSE) — 完全自托管,商用友好,无传染性。

---

## 联系我们

<p align="center">
  <strong>吉林省爱智汇人工智能科技有限公司</strong> · <strong>智汇 AI 集团</strong><br/>
  <sub>吉林省长春市高新区越达路 107 号 · 人工智能人才孵化基地</sub>
</p>

<p align="center">
  <strong>邮箱</strong> · <a href="mailto:502319984@qq.com">502319984@qq.com</a><br/>
  <strong>微信客服</strong> · <code>ok502319984</code> &nbsp;|&nbsp; <strong>电话</strong> · <code>18643389808</code><br/>
  <strong>官网</strong> · <a href="https://github.com/AIZHS2025">https://github.com/AIZHS2025</a> &nbsp;|&nbsp; <strong>在线 Demo</strong> · <a href="https://aizhs.top">https://aizhs.top</a>
</p>

<p align="center">
  <sub>合作咨询 · 企业接入 · 技术交流 · 投资对接 — 请致信 <a href="mailto:502319984@qq.com">502319984@qq.com</a>,24 小时内回复。</sub>
</p>

<p align="center">
  <sub><strong>如果 IHUI-AI 对你有帮助,欢迎 Star 支持我们。</strong> Star 不是终点,是让更多人看到这个项目的起点。</sub>
</p>
