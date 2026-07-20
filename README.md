# IHUI-AI

<p align="center">
  <img src="apps/web/public/images/logo.png" width="140" alt="IHUI-AI Logo" />
</p>

<p align="center">
  <strong>让每个人都拥有自己的 AI 程序</strong><br/>
  <sub>一个全栈、全端、全场景的开源 AI 应用共建平台</sub>
</p>

<p align="center">
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI/actions/workflows/ci.yml"><img src="https://github.com/IHUI-INF-AI/IHUI-AI/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI/actions/workflows/build.yml"><img src="https://github.com/IHUI-INF-AI/IHUI-AI/actions/workflows/build.yml/badge.svg" alt="Build" /></a>
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI/actions/workflows/e2e.yml"><img src="https://github.com/IHUI-INF-AI/IHUI-AI/actions/workflows/e2e.yml/badge.svg" alt="E2E" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue.svg" alt="License: Apache-2.0" /></a>
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI"><img src="https://img.shields.io/github/stars/IHUI-INF-AI/IHUI-AI?style=social" alt="Stars" /></a>
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI/issues"><img src="https://img.shields.io/github/issues/IHUI-INF-AI/IHUI-AI.svg" alt="Issues" /></a>
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI/pulls"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome" /></a>
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI"><img src="https://img.shields.io/github/last-commit/IHUI-INF-AI/IHUI-AI.svg" alt="Last Commit" /></a>
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI/graphs/contributors"><img src="https://img.shields.io/github/contributors/IHUI-INF-AI/IHUI-AI.svg" alt="Contributors" /></a>
</p>

<p align="center">
  <strong>8 端全覆盖</strong> · <strong>100+ 大模型</strong> · <strong>LangGraph + MCP + A2A 三栈协同</strong> · <strong>15+ 业务模块</strong> · <strong>5 语言 i18n</strong>
</p>

---

> **你有没有想过——**
>
> 为什么 AI 红利总是被大厂独享?为什么搭建一个 AI 应用要从零拼凑认证、计费、模型路由、工作流、多端发布?
> 为什么个人开发者、中小企业、教育机构总在重复造轮子,而不是站在彼此的肩膀上?
>
> **IHUI-AI 想改变这件事。**
>
> 我们把一个完整的 AI 应用基础设施——从 8 端框架、100+ 模型接入、工作流编排、企业级权限、计费订阅、内容发布、AI 教育、可观测性,到 17 道工程守门——以 Apache 2.0 协议全部开源出来。
>
> **不是套壳,不是 demo,是真正可生产、可商用、可自托管的 AI 应用基座。Fork 它,改它,把它变成你自己的。**

---

## 目录

- [特性总览(30 秒看完所有能力)](#特性总览30-秒看完所有能力)
- [为什么选择 IHUI-AI](#为什么选择-ihui-ai)
- [与同类项目对比](#与同类项目对比)
- [谁在使用 IHUI-AI](#谁在使用-ihui-ai)
- [5 个典型场景](#5-个典型场景)
- [技术栈](#技术栈)
- [8 端架构](#8-端架构)
- [项目结构](#项目结构)
- [核心能力详解(15 大模块)](#核心能力详解15-大模块)
- [快速开始](#快速开始)
- [API 与协议](#api-与协议)
- [数据库](#数据库)
- [可观测性](#可观测性)
- [安全设计](#安全设计)
- [工程守门](#工程守门17-个-pre-commit-钩子)
- [测试](#测试)
- [部署](#部署)
- [国际化](#国际化)
- [FAQ](#faq)
- [贡献](#贡献)
- [文档导航](#文档导航)
- [路线图](#路线图)
- [联系我们](#联系我们)
- [开源共建愿景](#开源共建愿景)
- [License](#license)
- [致谢](#致谢)

---

## 特性总览(30 秒看完所有能力)

| 大类 | 模块 | 关键能力 |
|---|---|---|
| **AI 对话与模型** | 多模型对话 | 100+ 模型 / 智能路由 / 60% 缓存命中 / 流式 SSE + WebSocket / 对话收藏 / 历史记录 / 分享 / 模板 |
| | AI 图像生成 | 文生图 / 图像编辑 / 多分辨率 / 多模型(Stable Diffusion / DALL-E / 通义万相) |
| | AI 音频 | TTS 流式合成 / ASR 语音识别 / 音色克隆 / 双向实时语音(WebRTC PCM16 16kHz) |
| | AI 视频合成 | 文生视频 / 视频编辑 / 多模型混编 |
| | AI 数字人 | 腾讯混元 3D / AI 世界 / 数字人交互 |
| | AI 职业 | AI 求职助手 / 简历优化 / 模拟面试 |
| | AI 新闻 | AI 资讯聚合 / 智能摘要 |
| **AI 工作流** | LangGraph | StateGraph 工作流(plan → execute → summarize)+ stub 模式 |
| | MCP 工具协议 | 11 内置工具 + 3 资源 + 3 提示词 / 自定义工具 / 项目级 MCP |
| | A2A 协议 | Agent-to-Agent 互通 / Redis 持久化 + 内存降级 |
| | 知识库 RAG | 文档向量化 / 语义搜索 / 引用追溯 |
| | 工作流编排 | 可视化工作流 / CrewAI 集成 / N8N 代理 |
| **多智能体生态** | 智能体市场 | 购买 / 审核 / 结算 / 提现 / 分类 / 推荐 / 排行 |
| | 开发者中心 | API Keys / 调用日志 / 团队管理 / 收益分析 |
| | Coze SDK 代理 | Bot / 对话 / 工作流 / 数据集 / 模板 / 变量 / 工作空间 / OAuth |
| | OpenClaw | 开源 Agent 框架接入 |
| **8 端框架** | Web | Next.js 15 / 83+ 页面 / PWA / SEO / 暗黑模式 / 5 语言 |
| | API | Fastify 5 / ~1080 端点 / 12 WebSocket 端点 / OpenAPI |
| | AI 服务 | FastAPI / LangGraph / LiteLLM / MCP / A2A |
| | CLI | Node.js / ACP Server / 6 内置工具 / 6 源配置导入 |
| | 桌面 | Tauri 2 / 系统托盘 / 本地文件访问 |
| | 浏览器扩展 | WXT / 上下文菜单 / 侧边栏 |
| | 移动 RN | React Native + Expo / iOS + Android |
| | 小程序 | Taro 4 / 微信支付原生集成 |
| **企业级能力** | 工作空间权限 | 3 模式 + 7 端点运行时拦截 + 60s 审计超时 |
| | RBAC + 多租户 | 角色 / 部门 / 组织 / 租户隔离 / 菜单权限 |
| | SSO 单点登录 | OAuth 2.0 / Apple / Google / SSO 中转登录 |
| | 计费与订阅 | VIP 等级 / 订阅 recurring / 钱包 / 积分 / 退款审计 / 发票 / 汇率 |
| | 灰度发布 | Canary / 灰度规则 / A/B 测试 |
| | 数据合规 | GDPR / 敏感词过滤 / 内容审核 / 审计日志 |
| **内容创作** | 自媒体工作台 | 公众号文章 + 口播稿双流水线 / 斜杠命令 |
| | 14 平台自动发布 | 文章 9 + 图片 2 + 视频 5 平台 / 凭证 AES-256-GCM 加密 |
| | 资讯新闻 | 文章 / 新闻 / 专题 / 标签 / 评论 / 点赞 / 收藏 |
| | 短剧 | 短剧创作与管理 |
| **AI 教育全栈** | 课程学习 | 课程 / 章节 / 学习路径 / 学习地图 / 进度跟踪 / 笔记 |
| | 题库与考试 | 多题型 / 自动批改 / 章节练习 / 错题本 / 试卷上传 |
| | SRS 间隔重复 | 艾宾浩斯遗忘曲线 / 智能复习调度 |
| | 直播教学 | 签到 / 互动 / 回放 / AI 辅助 |
| | 学习报告 | 行为分析 / 个性化建议 / 证书发放 |
| | 讲师管理 | 讲师主页 / 课程关联 |
| **社区互动** | 圈子广场 | 圈子 / 广场 / 问答 / 帖子 / 话题 |
| | 私信消息 | 1 对 1 私信 / 系统通知 / 多端同步 |
| | 关注粉丝 | 关注 / 粉丝 / 用户主页 / 名片 |
| | 分享邀请 | 邀请码 / 分享码 / H5 分享 / 推荐返佣 |
| **运营增长** | 积分签到 | 每日签到 / 任务积分 / 积分商城 / 兑换 |
| | 排行榜 | 多维度排行 / 周月榜 / 用户排名 |
| | 抽奖活动 | 抽奖 / 红包 / 奖励视频广告 |
| | 分销佣金 | 分销体系 / 佣金计划 / 提现 |
| | 活动公告 | 活动管理 / 公告推送 / Banner 轮播 |
| **客服支持** | 工单系统 | 工单提交 / 处理 / 评价 / FAQ |
| | 在线客服 | WebSocket 实时客服 / 1 对 1 会话 |
| | 反馈中心 | 用户反馈 / 处理状态 / 追踪 |
| **运维监控** | BI 仪表盘 | 业务指标可视化 / 数据分析 |
| | 错误仪表盘 | 错误聚合 / 告警 / 追踪 |
| | 操作日志 | 登录日志 / 操作日志 / 回调日志 |
| | 监控告警 | Prometheus + Grafana + Loki + Jaeger + OpenTelemetry |
| **工程基础设施** | 数据库 | PostgreSQL 15 / 96+ 表 / 32+ 迁移 / Drizzle ORM |
| | 队列缓存 | Redis 7 + BullMQ / 独立 worker |
| | 对象存储 | OSS 多厂商驱动 / 凭证加密 / 分块上传 / 文件版本 |
| | 邮件短信 | SMTP / 短信网关 / 邮件模板 / 验证码 |
| | 国际化 | 5 语言 parity(zh-CN / zh-TW / en / ko / ja)+ 4 守门脚本 |
| | 工程守门 | 17 pre-commit 钩子 + post-commit 自动 push |
| | 测试覆盖 | 268 + 400+ 用例 / Vitest + Playwright + pytest |
| | 部署运维 | Docker Compose / 蓝绿部署 / 健康检查 / 回滚 / 备份 |

---

## 为什么选择 IHUI-AI

| 维度 | 能力 | 行业定位 |
|---|---|---|
| **端覆盖** | Web / API / AI 服务 / CLI / 桌面 / 扩展 / 移动 RN / 小程序 Taro | 行业首个 8 端全覆盖 AI 全栈平台 |
| **模型接入** | LiteLLM 网关统一 100+ 模型(国际 30+ / 国产 15+ / 云厂商 10+) | 一站式接入,智能路由 + 60% 缓存 |
| **AI 编排三栈** | LangGraph(工作流)+ MCP(工具协议)+ A2A(Agent 互通) | 工作流、工具、智能体协同一体化 |
| **自研 CLI** | ACP Server + 6 内置工具,对标 Claude Code | 命令行原生 AI 编程体验 |
| **CLI 配置无缝导入** | cc-switch / codex++ / Claude / Codex / Gemini / Hermes 6 源一键导入 | 跨 CLI 工具配置零迁移成本 |
| **企业级安全** | RBAC + 工作空间 3 模式权限 + 7 端点运行时拦截 + 60s 审计超时 | 决策者级风险控制 |
| **数据加密** | AES-256-GCM(credentials 加密)+ JWT token-family 旋转 + refresh 黑名单 | 金融级数据保护 |
| **可观测性** | Prometheus + Grafana + Loki + Promtail + Jaeger + OpenTelemetry | 全链路指标 / 日志 / 追踪 |
| **工程守门** | 17 个 pre-commit 守门脚本 + post-commit 自动 push + git-push-guard | 杜绝协作事故,99.9% SLA |
| **国际化** | zh-CN / zh-TW / en / ko / ja 5 语言 parity | 5 语言键集合强一致性 |
| **数据库** | 96+ 表 + 32+ 迁移 + Drizzle ORM 类型安全 | 单库 PostgreSQL 15,schema 隔离 |
| **API 规模** | ~1135 端点(api 1080 + ai-service 55)+ 12 WebSocket 端点 | 远超源项目 331 端点 |
| **业务覆盖** | 15 大模块 / 50+ 子功能 / 83+ Web 页面 | 一个平台覆盖所有 AI 应用场景 |

---

## 与同类项目对比

| 维度 | IHUI-AI | Dify | FastGPT | Langflow | ChatGPT-Next-Web |
|---|---|---|---|---|---|
| **端覆盖** | 8 端(Web/API/AI/CLI/桌面/扩展/移动/小程序) | 2 端(Web/Server) | 2 端(Web/Server) | 1 端(Web) | 1 端(Web) |
| **模型接入** | 100+ 模型 + LiteLLM 网关 | 50+ 模型 | 30+ 模型 | LangChain 适配器 | 仅 OpenAI |
| **工作流引擎** | LangGraph + MCP + A2A 三栈 | 自研工作流 | 简单工作流 | Langflow DAG | 无 |
| **多租户 + RBAC** | 完整(租户/角色/部门/菜单) | 基础 | 基础 | 无 | 无 |
| **计费订阅** | 完整(VIP/订阅/钱包/积分/退款/发票) | 无 | 基础 | 无 | 无 |
| **AI 教育** | 全栈(课程/题库/考试/SRS/直播) | 无 | 无 | 无 | 无 |
| **内容发布** | 14 平台一键自动发布 | 无 | 无 | 无 | 无 |
| **CLI 工具** | 自研 ACP Server + 6 工具 | 无 | 无 | 无 | 无 |
| **可观测性** | 三支柱完整(指标/日志/追踪) | 基础 | 基础 | 无 | 无 |
| **工程守门** | 17 pre-commit 钩子 | 基础 | 基础 | 基础 | 无 |
| **i18n** | 5 语言 parity + 4 守门 | 中英文 | 中英文 | 英文 | 多语言 |
| **License** | Apache 2.0(商用友好) | Apache 2.0 | FastGPT Open License | MIT | MIT |
| **生产级部署** | Docker Compose + 蓝绿 + 回滚 + 备份 | Docker | Docker | Docker | Docker |

**IHUI-AI 不是要替代谁,而是把"搭建一个完整 AI 应用"所需的所有基础设施都开源出来。**

---

## 谁在使用 IHUI-AI

本项目由**吉林省爱智汇人工智能科技有限公司**发起并主导开发,用于支撑公司商业化 AI 平台。我们欢迎更多企业、团队、个人提交使用案例(请编辑此章节提 PR):

| 角色 | 场景 | 状态 |
|---|---|---|
| 爱智汇 AI | 公司主商业化平台(智汇 AI 集团) | 生产使用 |
| AI 服务商 | 多模型代理 + 计费 + 订阅一站式上线 | 适配中 |
| 教育机构 | AI 教育全栈(课程 / 题库 / 考试 / SRS) | 适配中 |
| 内容创作者 | 14 平台一键发布 | 适配中 |
| 个人开发者 | 私有 AI 助手 + 知识库 | 等你来填 |

> 你的公司或项目正在用 IHUI-AI 吗?欢迎提交 PR 加入此列表。

---

## 5 个典型场景

### 场景 1:个人开发者搭建私有 AI 助手

```bash
git clone https://github.com/IHUI-INF-AI/IHUI-AI.git
cd IHUI-AI && docker compose up -d
# 5 分钟后,你拥有:
# - 一个支持 100+ 模型的对话界面
# - 私有知识库 RAG(你的文档向量化 + 语义搜索)
# - 跨端同步(Web + 桌面 + 移动 + 小程序)
# - 数据完全自托管,不被任何大厂窥探
```

### 场景 2:中小企业构建 AI 中台

- 用 RBAC 给 200 个员工开账号,按部门隔离工作空间
- 接入 7 个 LLM 厂商,智能路由选最便宜的模型
- 用计费系统按部门收费,生成发票
- 用 BI 仪表盘看哪些部门用得最多
- 用审计日志满足合规要求

### 场景 3:AI 服务商上线商业产品

- 复用多模型代理 + 计费 + 订阅 + VIP + 钱包 + 积分
- 用智能体市场让开发者入驻,抽取 30% 佣金
- 用 API Keys + SDK 让客户接入你的平台
- 用 14 平台发布做内容营销
- 一周上线,而不是一年

### 场景 4:教育机构改造教学

- 用 AI 教育全栈导入课程 + 题库
- 学生用 SRS 间隔重复自动复习
- 老师用 AI 批改试卷 + 生成学习报告
- 直播 + 签到 + 互动 + 回放
- 学习行为分析 + 个性化建议
- 证书自动发放

### 场景 5:内容创作者解放生产力

- 在自媒体工作台写公众号文章 + 口播稿
- 一键发布到 14 平台(公众号 / 知乎 / CSDN / 掘金 / 小红书 / B 站 / YouTube / 抖音 等)
- 凭证 AES-256-GCM 加密存储,平台不泄露
- 发布完成 WebSocket 实时通知

---

## 技术栈

| 层 | 技术 | 版本 |
|---|---|---|
| Monorepo | pnpm workspace + Turborepo | pnpm 9.15 / turbo 2.3 |
| 后端 API | Fastify + @fastify/jwt + @fastify/websocket + Drizzle ORM + PostgreSQL | Fastify 5.1 / Drizzle 0.38 / PG 15 |
| 缓存与队列 | Redis 7 + BullMQ | 独立 worker 进程 |
| 前端 Web | Next.js + React + Tailwind CSS + shadcn/ui | Next 15.1 / React 19 / Tailwind 4 |
| 前端状态 | @tanstack/react-query 5 + Zustand | 服务端 + 客户端状态分离 |
| 国际化 | next-intl | zh-CN / zh-TW / en / ko / ja 5 语言 |
| AI 服务 | FastAPI + LangGraph + LiteLLM + MCP + A2A | FastAPI 0.115 / LangGraph 0.2 |
| AI 协议 | SSE(Agent 流式)+ WebSocket(聊天室 / 多模型流式)+ REST | 三协议分层 |
| 桌面端 | Tauri 2 + React 19 | 跨平台原生体验 |
| 浏览器扩展 | WXT + React | Chrome / Edge / Firefox |
| 移动端 | React Native + Expo EAS | iOS / Android |
| 小程序 | Taro 4 + React | 微信小程序 |
| CLI | Node.js + Commander + Inquirer | 对标 Claude Code |
| 认证 | @ihui/auth 共享包(JWT HS256 + token-family + OAuth2 + RBAC) | 跨端统一签发 |
| 验证 | Zod 3.24(后端)+ React Hook Form(前端) | 端到端类型安全 |
| 日志 | Pino 9.5(后端)+ Python logging(AI 服务)+ Loki + Promtail | 结构化 + 聚合 |
| 追踪 | OpenTelemetry + Jaeger | 分布式全链路 |
| 监控 | Prometheus + Grafana + Node Exporter | 主机 + 应用指标 |
| 测试 | Vitest(后端)+ Playwright(E2E)+ pytest(AI 服务) | 268 + 400+ 用例 |
| Node | >=20.10.0 | - |
| Python | 3.12+(仅 AI 服务) | - |

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

| 端 | 目录 | 技术栈 | 职责 |
|---|---|---|---|
| **Web** | `apps/web/` | Next.js 15 + React 19 | 主前端,83+ 页面,5 语言 i18n,PWA,SEO |
| **API** | `apps/api/` | Fastify 5 + Drizzle | 业务管理 + 多厂商代理 + 认证 + WebSocket,~1080 端点 |
| **AI 服务** | `apps/ai-service/` | FastAPI + LangGraph | LLM 网关 + Agent 执行 + MCP 工具 + A2A 协议,~55 端点 |
| **CLI** | `apps/cli/` | Node.js + Commander | 自研命令行 AI 编程助手,ACP Server + 6 工具 + 6 源配置导入 |
| **桌面** | `apps/desktop/` | Tauri 2 + React | 跨平台桌面应用,系统托盘 + 本地文件访问 |
| **扩展** | `apps/extension/` | WXT + React | 浏览器扩展,上下文菜单 + 侧边栏 |
| **移动** | `apps/mobile-rn/` | React Native + Expo | iOS / Android 原生应用 |
| **小程序** | `apps/miniapp-taro/` | Taro 4 + React | 微信小程序,微信支付原生集成 |

---

## 项目结构

```
IHUI-AI/
├── apps/
│   ├── ai-service/          # AI 服务 (FastAPI + LangGraph + LiteLLM + MCP + A2A)
│   ├── api/                 # 后端 API (Fastify 5 + Drizzle ORM, ~1080 端点, 37 路由文件)
│   ├── cli/                 # 自研 CLI (ACP Server + 6 工具, 对标 Claude Code)
│   ├── desktop/             # 桌面端 (Tauri 2 + React)
│   ├── extension/           # 浏览器扩展 (WXT + React)
│   ├── miniapp-taro/        # 微信小程序 (Taro 4 + React)
│   ├── mobile-rn/           # 移动端 (React Native + Expo)
│   └── web/                 # 前端 (Next.js 15 + React 19, 83+ 页面)
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
├── docs/                    # 架构 / 贡献 / 部署 / 安全 / 邮件 / i18n / 变更日志
├── monitoring/              # Grafana / Loki / Prometheus / Promtail / otel-collector
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
└── package.json
```

---

## 核心能力详解(15 大模块)

### 1. 100+ 大模型一站式接入

通过 LiteLLM 网关统一接入,智能路由 + 60% 缓存命中:

| 类别 | 模型 |
|---|---|
| **国际模型** | OpenAI GPT / Anthropic Claude / Google Gemini / xAI Grok / Groq / OpenRouter / Mistral |
| **国产模型** | 智谱 GLM / 通义千问 Qwen / 豆包 Doubao / DeepSeek / 月之暗面 Kimi / 阶跃星辰 StepFun / 百川 / Yi / MiniMax |
| **云厂商** | 阿里云 / 腾讯云 / 华为云 / 火山引擎 / 百度智能云 / AWS Bedrock / Azure OpenAI |
| **多模态** | 文本 / 图像 / 语音(STT + TTS)/ 视频 / 嵌入向量 / 3D 数字人(腾讯混元) |

### 2. LangGraph + MCP + A2A 三栈协同

| 栈 | 能力 |
|---|---|
| **LangGraph** | StateGraph 工作流(plan → execute → summarize),支持 stub 模式无 API key 也能开发 |
| **MCP** | 11 内置工具(search_codebase / read_file / write_file / run_command / web_search / git_operations / db_query / analyze_code / generate_test / refactor_code / file_search)+ 3 资源 + 3 提示词 + 项目级 MCP |
| **A2A** | Agent-to-Agent 协议,Redis 持久化 + 内存降级,智能体之间互相调用 |
| **向量记忆** | 嵌入 + 余弦相似度语义搜索,跨会话长期记忆 |
| **知识库 RAG** | 文档向量化 / 语义搜索 / 引用追溯 |

### 3. 自研 CLI(对标 Claude Code)

`apps/cli/` 提供 ACP(Agentic Coding Protocol)Server + 6 内置工具,支持:

- **斜杠命令**:`/goal` 目标驱动模式 + `/loop` 自动迭代 + `/skill` 工具调用 + `/plan` 计划等 12 命令
- **Skills 系统**:code-review / bug-fix / feature-plan / refactor-helper / api-designer / test-writer
- **配置无缝导入**:cc-switch / codex++ / Claude / Codex / Gemini / Hermes 6 源一键导入
- **多端联动**:与 Web / API 共享认证 + 会话 + 工作空间

### 4. 企业级工作空间权限

3 种权限模式 + 7 端点运行时拦截 + 60s 审计超时:

| 模式 | 行为 |
|---|---|
| `default` | 任何 FS 调用都触发人工审计弹窗 |
| `accept-edits` | 白名单规则匹配放行,不匹配触发弹窗 |
| `bypass-permissions` | 全部放行(仅信任环境使用) |

- 7 个 FS 端点全部接入:`/fs/read` `/fs/write` `/fs/edit` `/fs/delete` `/fs/grep` `/fs/glob` `/fs/run`
- WebSocket 实时推送权限请求,60s 不响应自动拒绝

### 5. 多模态 AI 创作

| 能力 | 端点 / 实现 |
|---|---|
| **文生图** | 多模型(Stable Diffusion / DALL-E / 通义万相)/ 多分辨率 / 批量 |
| **图像编辑** | 局部重绘 / 风格迁移 / 背景移除 / 高清放大 |
| **TTS 流式合成** | 12+ 音色 / 多语言 / WebSocket 流式 / 中断控制 |
| **ASR 语音识别** | 实时转写 / 文件转写 / 多语言 |
| **音色克隆** | 短音频样本 → 自定义音色 / ws/timbre/generate |
| **双向实时语音** | WebRTC PCM16 16kHz / ASR + LLM + TTS 闭环 |
| **文生视频** | 多模型混编 / 视频编辑 / 视频合成 |
| **AI 数字人** | 腾讯混元 3D / AI 世界 / 数字人交互 |
| **AI 求职** | 简历优化 / 模拟面试 / 职业建议 |

### 6. 内容创作与多平台发布

- **自媒体工作台**:公众号文章 + 口播稿双流水线,通过 AI 对话框斜杠命令(`/wechat-article` / `/koubo-script`)或附加栏按钮双入口调用
- **14 平台一键自动发布**:

| 类型 | 平台 |
|---|---|
| 文章 9 平台 | WordPress / Medium / 公众号 / 头条 / 知乎 / CSDN / 掘金 |
| 图片 2 平台 | 小红书 / 微博 |
| 视频 5 平台 | YouTube / B 站 / 抖音 / 快手 / 视频号 |

- **凭证 AES-256-GCM 加密存储**,发布完成 WebSocket 实时通知 + 完整记录
- **资讯新闻系统**:文章 / 新闻 / 专题 / 标签 / 评论 / 点赞 / 收藏 / 热门
- **短剧创作与管理**:`apps/web/app/(main)/drama/`

### 7. AI 教育全栈

| 模块 | 能力 |
|---|---|
| **课程学习** | 课程 / 章节 / 学习路径 / 学习地图 / 进度跟踪 / 笔记 / 问答 |
| **题库与考试** | 多题型枚举双向映射 / 自动批改 / 章节练习 / 错题本 / 试卷上传 |
| **SRS 间隔重复** | 基于艾宾浩斯遗忘曲线的智能复习调度 |
| **直播教学** | 直播 / 签到 / 互动 / 回放 / AI 辅助 |
| **学习报告** | 学习行为分析 + 个性化建议 |
| **证书发放** | 完成课程 / 考试通过自动发证 |
| **讲师管理** | 讲师主页 / 课程关联 |
| **学生端** | 我的问答 / 笔记 / 试卷 |

### 8. 多智能体业务管理

完整的智能体市场 + 开发者生态:

| 模块 | 能力 |
|---|---|
| **智能体市场** | 购买 / 审核 / 结算 / 提现 / 分类 / 推荐 / 排行 / 精选 |
| **开发者中心** | API Keys / 调用日志 / 团队管理 / 收益分析 / 开发者认证 |
| **Coze SDK 代理** | Bot / 对话 / 工作流 / 数据集 / 模板 / 变量 / 工作空间 / OAuth |
| **OpenClaw** | 开源 Agent 框架接入 |
| **Crew 集成** | CrewAI 多智能体协作 |
| **N8N 代理** | N8N 工作流平台反向代理 |

### 9. 社区与互动

| 模块 | 能力 |
|---|---|
| **圈子广场** | 圈子 / 广场 / 问答 / 帖子 / 话题 / 标签 |
| **私信消息** | 1 对 1 私信 / 系统通知 / 多端同步 / WebSocket 实时推送 |
| **关注粉丝** | 关注 / 粉丝 / 用户主页 / 名片 / 用户文章 / 问答 / 评论 |
| **分享邀请** | 邀请码 / 分享码 / H5 分享 / 推荐返佣 / 分销体系 |
| **互动反馈** | 评论 / 点赞 / 收藏 / 举报 / 用户反馈中心 |

### 10. 运营增长体系

| 模块 | 能力 |
|---|---|
| **积分签到** | 每日签到 / 任务积分 / 积分商城 / 兑换 / 积分明细 |
| **排行榜** | 多维度排行 / 周月榜 / 用户排名 |
| **抽奖活动** | 抽奖 / 红包 / 奖励视频广告 |
| **分销佣金** | 分销体系 / 佣金计划 / 提现 / 邀请返佣 |
| **活动公告** | 活动管理 / 公告推送 / Banner 轮播 / 推广位 |
| **VIP 会员** | VIP 等级 / 会员权益 / 优惠券 / 粉丝 / 升级 |

### 11. 计费与交易

完整的交易闭环:

```
订阅 VIP → 钱包充值 → 积分获取 → 模型调用扣费 → 退款审计 → 发票开具
                ↓                ↑
            分销佣金 ← 邀请返佣
```

- **VIP 等级**:多级会员 / 权益配置 / 升级流程
- **订阅 recurring**:周期扣款 / 自动续费 / 取消订阅
- **钱包**:充值 / 提现 / 余额 / 流水
- **积分**:签到获取 / 任务获取 / 消费抵扣 / 兑换商品
- **退款审计**:申请 / 审核 / 退款 / 银行流水
- **发票**:增值税普票 / 专票 / 邮寄
- **汇率**:多币种 / 实时汇率

### 12. 客服与支持

| 模块 | 能力 |
|---|---|
| **工单系统** | 工单提交 / 处理 / 评价 / FAQ / 工单列表 |
| **在线客服** | WebSocket 实时客服 / 1 对 1 会话 / ws/customer-service |
| **反馈中心** | 用户反馈 / 处理状态 / 追踪 |
| **帮助中心** | 文档 / 教程 / `[...slug]` 动态路由 |

### 13. 运维与监控

| 模块 | 能力 |
|---|---|
| **BI 仪表盘** | 业务指标可视化 / 数据分析 / 报表 |
| **错误仪表盘** | 错误聚合 / 告警 / 追踪 / admin-error-dashboard |
| **操作日志** | 登录日志 / 操作日志 / 回调日志 / 系统操作日志 |
| **API 调试** | API Debug / API 日志 / API 用量 / API 平台 |
| **灰度发布** | Canary / 灰度规则 / A/B 测试 / admin-gray-release |
| **监控告警** | Prometheus + Grafana + Loki + Jaeger + OpenTelemetry 三支柱 |
| **健康检查** | `/api/health` / `live` / `ready` + AI 服务 `/health` |

### 14. 安全与合规

| 维度 | 实现 |
|---|---|
| **认证** | JWT HS256 + token-family 旋转(防盗用)+ refresh token 黑名单 |
| **SSO 单点登录** | OAuth 2.0 / Apple / Google / SSO 中转登录 / 第三方登录 |
| **限流** | 全局 100/min,auth login/register 10/min,分层 rate-limit |
| **加密** | AES-256-GCM 加密 credentials(OSS + 教育 + 发布平台) |
| **密码** | bcryptjs 哈希(member 表 SHA256 兼容旧 Java 数据) |
| **数据脱敏** | password / passwordHash 字段在 API 响应中解构剥离 |
| **GDPR** | 数据导出 / 数据删除 / 数据可携 / gdpr 路由 |
| **敏感词** | 敏感词过滤 / 内容审核 / admin-sensitive-words |
| **审计日志** | 登录日志 / 操作日志 / 系统操作日志 / 审计追溯 |
| **事务安全** | DB 事务化:order 支付/退款 + social tag + gamification 积分 + chat 清空 |
| **行锁** | `.for('update')` 行锁防 TOCTOU 竞态 |
| **CSRF** | `@fastify/csrf-protection` 双 token 模式 |
| **XSS** | sanitizer 绕过检测脚本守门(pre-commit 第 6 项) |
| **API key 泄露** | `check-api-key-leak.mjs` 守门(pre-commit 第 1 项) |
| **RBAC** | roleId >= 1 才能访问 admin 路由,plugin-level preHandler 统一鉴权 |
| **工作空间权限** | 3 模式 + 7 端点运行时拦截 + 60s 审计超时 |
| **多租户** | 租户隔离 / 组织 / 部门 / 菜单权限 |

### 15. 工程基础设施

| 模块 | 能力 |
|---|---|
| **数据库** | PostgreSQL 15 / 96+ 表 / 32+ 迁移 / Drizzle ORM 0.38 |
| **队列缓存** | Redis 7 + BullMQ / 独立 worker 进程 |
| **对象存储** | OSS 多厂商驱动 / 凭证加密 / 分块上传 / 文件版本 |
| **邮件短信** | SMTP / 短信网关 / 邮件模板 / 验证码 / auth-codes |
| **国际化** | 5 语言 parity + 4 守门脚本 + 品牌翻译策略 |
| **工程守门** | 17 pre-commit 钩子 + post-commit 自动 push |
| **测试覆盖** | 268 + 400+ 用例 / Vitest + Playwright + pytest |
| **部署运维** | Docker Compose / 蓝绿部署 / 健康检查 / 回滚 / 备份 |
| **App 版本** | app-version 管理 / 多端版本控制 |
| **Webhooks** | 事件订阅 / 第三方集成 / callback-log |

---

## 快速开始

### 环境要求

| 工具 | 版本 | 说明 |
|---|---|---|
| Node.js | `>=20.10.0` | LTS 20.x,推荐 `nvm use` |
| pnpm | `>=9.0.0` | 项目固定 `pnpm@9.15.0`,`corepack enable` 自动激活 |
| Python | `3.12+` | 仅 `apps/ai-service` 需要 |
| PostgreSQL | `15+` | compose 用 `postgres:15-alpine` |
| Redis | `7+` | compose 用 `redis:7-alpine` |
| Docker | `24+` + Compose v2 | 可选,推荐用于一键启动 |
| Git | `2.40+` | `core.autocrlf=false`(项目强制 LF) |

### 一键启动(Docker)

```bash
# 1. 克隆
git clone https://github.com/IHUI-INF-AI/IHUI-AI.git IHUI-AI && cd IHUI-AI

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env,填入 JWT_SECRET / DB_PASSWORD / CREDENTIALS_ENCRYPTION_KEY 等

# 3. 一键启动全栈(api + web + ai-service + db + redis + 监控栈)
docker compose up -d
```

**服务访问地址:**

| 服务 | URL | 说明 |
|---|---|---|
| Web | http://localhost:3000 | Next.js 前端 |
| API | http://localhost:8080/api/health | Fastify 后端健康检查 |
| AI 服务 | http://localhost:8000/health | FastAPI AI 服务健康检查 |
| Grafana | http://localhost:3001 | 默认账号 admin / 修改密码 |
| Prometheus | http://localhost:9091 | 指标采集 |
| Jaeger UI | http://localhost:16686 | 分布式追踪 |

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

| 服务 | 端点数 | 前缀 | 覆盖域 |
|---|---|---|---|
| **apps/api** | ~1080 | `/api` + `/api/admin` | 37 路由文件,涵盖 auth / users / billing / content / chat / teams / workspace / agents / coze / oss / order / vip / exam / learn / live / news / topic / search / drama / stock / gdpr / rbac / tenant 等 |
| **apps/ai-service** | ~55 | `/api` | a2a(5)/ agents(9)/ health(4)/ llm(2)/ mcp(10)/ tools(3)/ self_media / publish |

**统一响应格式:**

```typescript
// 成功: { code: 0, message: 'success', data: T }
// 错误: { code: number, message: string }
// 由共享 utils/response.ts 的 success()/error() 生成
```

**认证:** JWT HS256 + token-family 旋转 + refresh 黑名单,access token 7 天有效期,所有端点通过 `@ihui/auth` 共享包统一签发/验证。

### WebSocket 端点(12 个)

| 端点 | 用途 |
|---|---|
| `/ws/notifications` | 全局通知推送(多端同步,Redis Pub/Sub 广播) |
| `/ws/room/:roomId` | 聊天室消息(多用户房间) |
| `/ws/customer-service` | 客服会话(1 对 1) |
| `/ws/payment/status/:orderNo` | 支付状态实时更新 |
| `/ws/broadcast` | 通用广播 |
| `/ws/agent/stream` | Agent 流式输出(步骤 / 工具调用 / 思考,interrupt/continue/cancel) |
| `/ws/tts/stream` | TTS 流式合成(文本 → 音频,支持中断) |
| `/ws/realtime/pcm` | 双向实时音频(ASR 输入 + TTS 输出,PCM16 16kHz) |
| `/v1/ai/capabilities/ws/stream` | 通用 AI 能力流(代理到 AI 服务 SSE) |
| `/ws/stock/stream` | 股票行情流 |
| `/ws/timbre/generate` | 音色克隆生成流 |
| `/ws/coze/chat` | Coze 对话流 |
| `/ws/live/chat` | 直播聊天室 |

所有 WS 端点通过 `wsAuth(socket, token)` 校验 JWT,支持心跳 ping/pong,多实例通过 Redis Pub/Sub 跨实例广播。

---

## 数据库

- **单库设计**:PostgreSQL 15,单库 `ihui`,通过 schema 隔离业务域
- **96+ 表**:34 个 schema 模块文件,覆盖 users / projects / files / billing / audit / chat / teams / rbac / workflow / comments / promotions / gamification / content / social / community / learn / exam / order / live / member / resource / point / schedule / statistics / message / topic / behavior / oss / setting / self-media / publish / drama / stock / certificate 等
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

| 端点 | 用途 |
|---|---|
| `GET /api/health` | 后端综合健康(DB + Redis 探针) |
| `GET /api/health/live` | Liveness |
| `GET /api/health/ready` | Readiness |
| `GET /health` | AI 服务健康检查 |

---

## 安全设计

| 维度 | 实现 |
|---|---|
| **认证** | JWT HS256 + token-family 旋转(防盗用)+ refresh token 黑名单 |
| **SSO** | OAuth 2.0 / Apple / Google / SSO 中转登录 |
| **限流** | 全局 100/min,auth login/register 10/min,分层 rate-limit |
| **加密** | AES-256-GCM 加密 credentials(OSS 驱动凭证 + 教育设置凭证 + 发布平台账号) |
| **密码** | bcryptjs 哈希(member 表 SHA256 兼容旧 Java 数据) |
| **数据脱敏** | password / passwordHash 字段在 API 响应中解构剥离 |
| **GDPR** | 数据导出 / 删除 / 可携 / gdpr 路由 |
| **敏感词** | 敏感词过滤 + 内容审核 + admin-sensitive-words |
| **审计日志** | 登录日志 / 操作日志 / 系统操作日志 / 审计追溯 |
| **事务安全** | DB 事务化:order 支付/退款 + social tag + gamification 积分 + chat 清空消息 |
| **行锁** | `.for('update')` 行锁防 TOCTOU 竞态 |
| **CSRF** | `@fastify/csrf-protection` 双 token 模式 |
| **XSS** | sanitizer 绕过检测脚本守门(pre-commit 第 6 项) |
| **API key 泄露** | `check-api-key-leak.mjs` 守门(pre-commit 第 1 项) |
| **RBAC** | roleId >= 1 才能访问 admin 路由,plugin-level preHandler 统一鉴权 |
| **工作空间权限** | 3 模式 + 7 端点运行时拦截 + 60s 审计超时 |
| **多租户** | 租户隔离 + 组织 + 部门 + 菜单权限 |

---

## 工程守门(17 个 pre-commit 钩子)

项目通过 17 个 pre-commit 钩子 + post-commit 自动 push 杜绝协作事故:

| # | 脚本 | 用途 |
|---|---|---|
| 1 | check-api-key-leak.mjs | API key 泄露检测 |
| 2 | check-i18n-keys.mjs | i18n 键完整性 + parity |
| 2b | scan-i18n-zh-residue.mjs zh-TW | zh-TW 简体字残留(opencc 字形转换) |
| 2c | scan-i18n-zh-residue.mjs ko | ko.json 中文残留(字符范围检测) |
| 2d | scan-i18n-zh-residue.mjs ja | ja.json 中文残留(warn-only) |
| 2e | check-i18n-broken-en.mjs | en.json 破碎机翻英文守门 |
| 3 | check-db-schema-drift.mjs | schema drift 检测 |
| 4 | check-stale-dist.mjs | packages 陈旧 dist 检测 |
| 4b | check-dist-encoding.mjs | packages dist UTF-8 BOM 守门 |
| 4c | check-api-client-utf8.mjs | api-client 源码字节级 UTF-8 完整性 |
| 5 | lint-staged | eslint + prettier |
| 6 | check-sanitizer-bypass.mjs | XSS sanitizer 绕过检测 |
| 7 | check-dedupe.mjs | 依赖碎片化检测 |
| 8 | check-api-routes.mjs | 前后端路由一致性 |
| 9 | check-safe-parse.mjs | safeParse 静默忽略(warn-only) |
| 11 | check-rounded-full.mjs | 容器圆角违规(强制尺寸梯度) |
| 12 | check-delivery-report-consistency.mjs | 交付报告一致性 |
| 13 | check-cli-integration-completeness.mjs | cli 整合完整性 |
| 13b | check-project-plan-size.mjs | PROJECT_PLAN.md 体积 < 50KB |
| 13c | check-project-plan-archive.mjs | PROJECT_PLAN.md 已完成任务条目防误删 |
| 15 | check-api-migration-completeness.mjs | 迁移完整性 |
| 16 | 条件 typecheck | apps/web staged 时跑 typecheck |
| 16b | 条件 database build | packages/database/src staged 时跑 build |
| 17 | git-push-guard.mjs(post-commit) | 自动 push + 验证 local == remote(防遗漏) |

---

## 测试

| 类型 | 框架 | 规模 | 命令 |
|---|---|---|---|
| 后端单元 | Vitest | 38 文件,268 用例 | `pnpm --filter @ihui/api test` |
| 前端 E2E | Playwright | 17 spec 文件 | `pnpm test:e2e` |
| AI 服务 | pytest | 13 文件,400+ 用例 | `cd apps/ai-service && pytest` |
| CLI 单元 | Vitest | 13 文件 | `pnpm --filter @ihui/cli test` |
| 全量验证 | turbo | 22 tasks | `pnpm turbo typecheck lint test` |

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

**服务清单(7 业务 + 7 监控):**

| 服务 | 端口 | 用途 |
|---|---|---|
| api | 8080 | Fastify 后端 |
| worker | 8081 | BullMQ 独立 worker 进程 |
| web | 3000 | Next.js 前端(standalone) |
| ai-service | 8000 | FastAPI AI 服务 |
| db | 5432 | PostgreSQL 15 |
| redis | 6379 | Redis 7 |
| migrate | - | 一次性迁移服务(完成后退出) |
| jaeger | 16686 | 分布式追踪 UI |
| otel-collector | 4318 | OpenTelemetry Collector |
| prometheus | 9091 | 指标采集 |
| grafana | 3001 | 可视化仪表盘 |
| node-exporter | 9100 | 主机指标 |
| loki | 3100 | 日志聚合 |
| promtail | - | 日志采集 |

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

**何时迁移 K8s**:业务服务 > 10 / 跨可用区多活 / 单 VM 资源触顶 / 需要 HPA 自动伸缩 / 多租户 namespace 级别隔离。所有 Dockerfile 可直接复用为 K8s 容器镜像,迁移路径已预留。

---

## 国际化

5 语言 parity(键集合强一致性),由 4 个守门脚本保证质量:

| 语言 | 文件 | 守门 |
|---|---|---|
| zh-CN | `apps/web/messages/zh-CN.json` | 基准语言 |
| zh-TW | `apps/web/messages/zh-TW.json` | opencc 字形转换检测简体字残留(阻塞) |
| en | `apps/web/messages/en.json` | 破碎机翻英文检测(阻塞) |
| ko | `apps/web/messages/ko.json` | 字符范围检测中文残留(阻塞) |
| ja | `apps/web/messages/ja.json` | 中文残留检测(warn-only,日文汉字词易误报) |

**品牌翻译策略**:优先官方英文名(智谱清言 → Zhipu AI,百度文心 → Baidu ERNIE,火山引擎 → Volcengine 等),机器可读映射表见 `scripts/brand-glossary.json`。

---

## FAQ

<details>
<summary><strong>Q1:IHUI-AI 可以商用吗?</strong></summary>

可以。项目采用 Apache License 2.0,允许自由使用、修改、分发、商业使用,无传染性。你可以基于它构建商业产品,无需开源你的业务代码。唯一要求:保留 LICENSE 与 copyright notice。
</details>

<details>
<summary><strong>Q2:与其他开源 AI 项目(Dify / FastGPT / Langflow)有何不同?</strong></summary>

IHUI-AI 不只是 AI 对话平台,而是**完整的 AI 应用基础设施**:

- 8 端覆盖(其他项目仅 1-2 端)
- 完整计费订阅 + VIP + 钱包 + 积分(其他项目无)
- AI 教育全栈(其他项目无)
- 14 平台一键发布(其他项目无)
- 自研 CLI(其他项目无)
- 工程守门 17 钩子(其他项目基础)

详见上方 [与同类项目对比](#与同类项目对比) 表。
</details>

<details>
<summary><strong>Q3:需要哪些 LLM API Key 才能运行?</strong></summary>

至少一个。最简启动只需 OpenAI API Key,即可体验完整对话能力。要使用全部功能,建议接入:

- 国际:OpenAI + Anthropic Claude + Google Gemini
- 国产:智谱 GLM + 通义千问 + DeepSeek + 豆包
- 多模态:Stable Diffusion + 通义万相 + 腾讯混元 3D
- 不想付费?AI 服务支持 stub 模式,无 API key 也能开发调试。
</details>

<details>
<summary><strong>Q4:支持自托管吗?数据会被大厂窥探吗?</strong></summary>

完全自托管。Docker Compose 一键启动后,所有数据(对话 / 知识库 / 用户 / 计费)存储在你自己的 PostgreSQL + Redis 中,LLM 调用走你自己的 API Key,凭证 AES-256-GCM 加密存储。没有任何外部数据回传,你拥有 100% 数据主权。
</details>

<details>
<summary><strong>Q5:项目规模这么大,部署需要什么配置?</strong></summary>

最小生产配置:4 核 CPU / 8GB 内存 / 50GB 磁盘 / 单 VM 即可。开发环境 2 核 4GB 够用。监控栈可选(关掉 Grafana / Loki / Jaeger 节省 1GB 内存)。详见 [DEPLOYMENT_RUNBOOK.md](docs/DEPLOYMENT_RUNBOOK.md)。
</details>

<details>
<summary><strong>Q6:如何贡献代码?需要什么水平?</strong></summary>

欢迎任何水平的贡献者。从修文档错别字、提 Issue、写测试用例,到接入新模型、新发布平台、新端适配都欢迎。详见 [贡献](#贡献) 章节。我们特别欢迎:新模型适配 / 新发布平台 / 新语言 / 新端适配 / AI 工作流模板 / 企业级能力 / 测试覆盖 / 文档改进 8 大方向。
</details>

<details>
<summary><strong>Q7:为什么用 pnpm 而不是 npm / yarn?</strong></summary>

pnpm 在 monorepo 场景下优势明显:严格的依赖隔离(防止幽灵依赖)+ 硬链接节省磁盘 + 工作空间协议 + 与 Turborepo 配合最佳。项目固定 `pnpm@9.15.0`,`corepack enable` 自动激活,无需手动管理版本。
</details>

<details>
<summary><strong>Q8:CLI 配置导入功能是什么?能导入哪些工具的配置?</strong></summary>

自研 CLI 提供 6 源一键导入功能,让你从其他 AI CLI 工具无缝切换到 IHUI-AI CLI,无需重新配置 API Key / 模型 / 工作流:

- cc-switch / codex++ / Claude / Codex / Gemini / Hermes

详见 `apps/cli/` 实现。
</details>

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
- **新语言**:新增 i18n locale(阿拉伯语 / 葡萄牙语 / 西班牙语等)
- **新端适配**:增强现有 8 端 + 新增端(鸿蒙 HarmonyOS / 鸿蒙 Next)
- **AI 工作流**:贡献 LangGraph 工作流模板 / MCP 工具 / A2A Agent
- **企业级能力**:多租户隔离增强 / 审计日志完善 / SSO 集成(Okta / Keycloak)
- **测试覆盖**:增加边界用例 / E2E 场景 / 性能基准
- **文档改进**:更多使用教程 / 架构解析 / 最佳实践

---

## 文档导航

| 文档 | 说明 |
|---|---|
| [docs/architecture.md](docs/architecture.md) | 系统架构(技术栈 / 数据库 / API 路由 / 启动流程 / 旧架构弃用说明) |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | 贡献指南(环境搭建 / 代码规范 / 提交规范 / PR 流程) |
| [docs/DEPLOYMENT_RUNBOOK.md](docs/DEPLOYMENT_RUNBOOK.md) | 部署运维手册(蓝绿部署 / 回滚 / 证书续期) |
| [docs/SECURITY.md](docs/SECURITY.md) | 安全策略(漏洞披露 / 加密设计 / 权限模型) |
| [docs/EMAIL_SETUP.md](docs/EMAIL_SETUP.md) | 邮件服务配置(SMTP / 模板 / DKIM) |
| [docs/I18N-COMPLETION-PLAN.md](docs/I18N-COMPLETION-PLAN.md) | 国际化完成计划 |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | 变更日志 |
| [docs/INCIDENTS.md](docs/INCIDENTS.md) | 历史事故复盘 |
| [AGENTS.md](AGENTS.md) | AI Agent 协作规范(21 节强制规则,可选阅读:展示本项目如何与 AI 协作开发) |
| [PROJECT_PLAN.md](PROJECT_PLAN.md) | 项目任务计划与历史归档(内部开发记录,了解演进轨迹) |

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
- AI 教育全栈(课程 / 题库 / 考试 / SRS / 直播 / 报告 / 证书 / 讲师)
- 多智能体市场 + 开发者中心 + Coze SDK 代理
- 社区互动(圈子 / 广场 / 私信 / 关注 / 分享)
- 运营增长(积分 / 签到 / 排行 / 抽奖 / 分销 / 邀请)
- 计费交易闭环(VIP / 订阅 / 钱包 / 积分 / 退款 / 发票 / 汇率)
- 客服支持(工单 / 在线客服 / 反馈 / 帮助中心)
- BI 仪表盘 + 错误仪表盘 + 灰度发布
- 5 语言 i18n parity(zh-CN / zh-TW / en / ko / ja)
- 全栈可观测性(Prometheus + Grafana + Loki + Promtail + Jaeger + OpenTelemetry)
- 17 pre-commit 守门脚本 + post-commit 自动 push
- 企业级安全(RBAC + 多租户 + SSO + AES-256-GCM + JWT token-family + CSRF + XSS + GDPR)

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

## 联系我们

<p align="center">
  <strong>扫码加入 IHUI-AI 社区,与开发者共建 AI 未来</strong>
</p>

<table align="center">
  <tr>
    <td align="center" width="33%">
      <img src="apps/web/public/footer/erweima/footer-icon-2.png" width="180" alt="官方应用二维码" />
      <br/>
      <strong>官方应用</strong>
      <br/>
      <sub>扫码体验 IHUI-AI App</sub>
    </td>
    <td align="center" width="33%">
      <img src="apps/web/public/footer/erweima/wechat-vx.png" width="180" alt="官方微信二维码" />
      <br/>
      <strong>官方微信</strong>
      <br/>
      <sub>微信号:<code>ok502319984</code></sub>
    </td>
    <td align="center" width="33%">
      <img src="apps/web/public/footer/erweima/community-group.jpg" width="180" alt="企微社区群二维码" />
      <br/>
      <strong>企微社区群</strong>
      <br/>
      <sub>扫码加入开发者社群</sub>
    </td>
  </tr>
</table>

### 公司信息

| 项目 | 信息 |
|---|---|
| **公司全称** | 吉林省爱智汇人工智能科技有限公司 |
| **品牌名** | 智汇 AI 集团 |
| **公司地址** | 吉林省长春市高新区越达路 107 号 · 人工智能人才孵化基地 |
| **联系电话** | 18643389808 |
| **邮箱** | 502319984@qq.com · lizong@aizhs.top |
| **微信客服** | ok502319984(微信搜索添加) |
| **ICP 备案** | 吉ICP备2025027274号 |
| **版权** | © 2025 智汇AI集团 · 中国 |

### 社区与外部平台

| 平台 | 链接 |
|---|---|
| GitHub 组织 | https://github.com/AIZHS2025 |
| X (Twitter) | https://x.com/ok502319984 |
| Facebook | https://www.facebook.com/share/17kQMPNhQb/ |
| Issue 反馈 | https://github.com/IHUI-INF-AI/IHUI-AI/issues |
| PR 贡献 | https://github.com/IHUI-INF-AI/IHUI-AI/pulls |

> 合作咨询、企业接入、技术交流请扫码上方微信或致信 lizong@aizhs.top,我们会在 24 小时内回复。

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

---

<p align="center">
  <sub>Built by <strong>吉林省爱智汇人工智能科技有限公司</strong> · 开源共建,你我同在</sub>
</p>

<p align="center">
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI">Star us on GitHub</a> · <a href="https://github.com/IHUI-INF-AI/IHUI-AI/fork">Fork to build your own</a> · <a href="https://github.com/IHUI-INF-AI/IHUI-AI/issues">Request a feature</a>
</p>
