# IHUI-AI 多平台内容分发模板

> 目的:用户(或 AI agent)可直接复制粘贴本文件中各平台的模板,在 10 个国内外平台同步发布,1 周内获取首批 200+ star 和外链。
>
> 使用方式:每个平台 1 篇,发布时间错开 4-8h(避免被判 spam)。建议顺序:掘金 → 思否 → CSDN → 知乎 → 微信公众号 → Reddit → Hacker News → Twitter → LinkedIn → Product Hunt。
>
> **重要**:发帖后 24h 内回复所有评论;任何"求 star"评论必回复;社区活跃度 = 算法推荐权重。

---

## 通用信息(所有平台共用)

| 字段 | 内容 |
| --- | --- |
| 项目名 | IHUI AI(智汇 AI) |
| GitHub | https://github.com/IHUI-INF-AI/IHUI-AI |
| 官网 / Demo | https://ihui.ai |
| 定位 | 8 端全栈 AI 操作系统,Apache 2.0 开源 |
| 亮点 | 8 端同源 / 176 模型 / LangGraph+MCP+A2A / P3 深度层 |
| 对标 | Dify / Coze / FastGPT / n8n / ChatGPT Team / Claude Code |
| 定价 | Free / Pro ¥49/月 / Team ¥199/人/月 / Enterprise ¥2999/月起 |
| 技术栈 | Next.js 15 + Fastify 5 + FastAPI + LangGraph + LiteLLM + MCP + Taro 4 |
| 数据 | 340 表 / 144 迁移 / 1300+ API / 5346 测试 / 176 模型 |
| License | Apache-2.0(商业可用) |
| 国内镜像 | Gitee https://gitee.com/JLSLSSZWHYXGS_0/IHUI-AI · GitCode https://gitcode.com/IHUI-AI/IHUI-AI |
| 联系方式 | 微信 `ok502319984` · 邮箱 502319984@qq.com |
| 一句话 | 一个仓库,干翻 40+ 商业产品 — 8 端 / 176 模型 / LangGraph+MCP+A2A / 340 表 / 1300+ API / Apache 2.0 |

---

## 国内平台(5 个)

### 1. 掘金(juejin.cn)

#### 平台特点
- **受众**:国内前端/全栈开发者,90% 中文,技术氛围浓厚
- **内容风格**:技术深度长文(1500-3000 字),配代码块 + 架构图;排斥硬广
- **最佳发帖时间**:工作日 10:00-12:00、19:00-22:00;周末流量低 30%

#### 标题模板(三选一)
1. 《花了 X 个月,我把 40+ 商业 AI 产品整合进了 1 个开源仓库》
2. 《8 端同源 + 176 模型 + LangGraph+MCP+A2A:这个开源 AI 平台把 Dify/Coze/Cursor 都对标了》
3. 《340 张表 · 1300+ API · 5346 测试:一个 Apache 2.0 开源 AI 商业平台是怎么炼成的》

#### 正文模板(直接复制)

```
> 编者按:本文不卖课不带货,纯分享一个 Apache 2.0 开源项目的架构和踩坑。GitHub:https://github.com/IHUI-INF-AI/IHUI-AI,在线 Demo:https://ihui.ai

## 一句话介绍

IHUI-AI 是一个开源 AI 商业级一体化超级平台,8 端同源(web/api/ai-service/cli/desktop/extension/mobile/miniapp),176 大模型统一调度,LangGraph + MCP + A2A 三栈,340 张表,1300+ API,Apache 2.0 商业可用。

## 为什么造这个轮子

2024 年初,我接了第 3 个 AI 应用外包项目,发现 60% 的代码在重复:AI 聊天 UI、LLM API 接入、Stripe 支付、Auth0 鉴权、用户管理、订单系统。每次都要重写一遍,客户每次都要付同样价格。

与此同时,我深度使用 Dify/Coze/LangChain/Cursor,发现每个产品只解决了 AI 产业链的一环:

- Dify 解决了 AI 应用编排,但**没有支付/会员/订单**(商业闭环缺失)
- Coze 体验丝滑但**完全闭源**(数据出不了飞书)
- Cursor 编程强但**只做编程**(垂直太深)
- FastGPT 知识库好但**没有 SaaS 闭环**
- LangChain/AutoGen 是**框架,不是产品**(客户要的是能上线收钱的产品,不是 hello world)

**所以我做 IHUI-AI 的核心思路是:"整车下线",不是"造车框架"**。非技术团队 clone 下来,改改配置就能上线,能直接收钱。

一年多时间,从 0 做到了 8 端同源(web/api/ai-service/cli/desktop/extension/mobile/miniapp)+ 176 大模型统一调度 + LangGraph+MCP+A2A 三栈 + 340 张表 + 1300+ API + 5346 测试 + 32 个 pre-commit 守门脚本。

## 6 大类能力对标

| 类别 | 对标产品 | IHUI-AI 优势 |
| --- | --- | --- |
| AI 编程 CLI | Claude Code / Cursor / Aider | 8 端同源 + 176 模型 |
| AI 应用平台 | Dify / Coze / FastGPT | Apache 2.0 + 自部署 |
| Agent 框架 | LangGraph / CrewAI / AutoGen | 内置 MCP + A2A |
| 商业 SaaS | ChatGPT Team / Notion AI | ¥49/月 vs $25/月,省 70% |
| AI 教育 | Coursera / Udemy | 内置课程 + SRS 间隔重复 |
| 多端框架 | Taro / uni-app | AI 原生 8 端 |

## 核心架构

- **API**:Fastify 5 + Drizzle ORM 0.38 + PostgreSQL(340 表 / 144 迁移 / 30+ 业务域)
- **Web**:Next.js 15 + React 19 + Tailwind 4 + shadcn/ui
- **AI Service**:FastAPI + LangGraph + LiteLLM + MCP
- **Miniapp**:Taro 4 + React
- **Desktop / Extension / Mobile / CLI**:各端独立

## 三个最值得说的技术点

### 1. 8 端同源:一个 packages/ 目录喂饱所有端

[展开 200-400 字,讲 packages/types / sdk / design-tokens / ui-react / api-client 共享策略]

### 2. 176 大模型统一调度:LiteLLM + 成本追踪

[展开 200-400 字,讲 LiteLLM 适配层 + token 计费 + 模型 leaderboard]

### 3. P3 深度层:Agent 元认知 + 多模态记忆 + A/B 测试

[展开 200-400 字,讲 P3 深度层 16 张表]

## 性能与规模

- 5346 个测试用例,CI 全绿
- 1300+ API endpoint
- 340 张表(单库),含 RLS 多租户隔离
- 176 大模型支持(OpenAI / Anthropic / Gemini / 通义千问 / 智谱 / DeepSeek / Ollama 本地等)

## 价格对比(国内开发者最关心)

| 方案 | 月费 | 等价 IHUI-AI |
| --- | --- | --- |
| ChatGPT Team | $25/人 ≈ ¥180 | Pro ¥49(省 70%) |
| Claude Pro | $20 ≈ ¥145 | Pro ¥49(省 65%) |
| Cursor Pro | $20 ≈ ¥145 | Free 自部署 |
| Notion AI | $10 ≈ ¥72 | Team ¥199/人(全功能) |

## 如何开始

1. Star 仓库:https://github.com/IHUI-INF-AI/IHUI-AI
2. 在线体验:https://ihui.ai
3. 本地部署(5 分钟):见 README 的 Quick Start
4. 加微信群:`ok502319984` 备注"掘金"

## License

Apache 2.0,商业可用,可二次销售。

---

如果觉得有用,给个 ⭐ Star 支持一下。后续会分享:
- 8 端同源的具体实现
- 176 模型调度内幕
- P3 深度层的 Agent 元认知设计
- 从 0 到 5346 测试的工程经验
```

#### 标签 / 话题
`AI` `人工智能` `开源` `LangGraph` `大模型` `Agent` `前端` `全栈` `Next.js` `Fastify`

#### 配图建议
- **首图**:架构图(8 端拓扑 + 模型调度层),可用 Excalidraw 画
- **图 2**:价格对比表截图(突出"省 70%")
- **图 3**:终端运行 `pnpm dev` 启动 3 端的 GIF
- **图 4**:仓库 README 截图(显示 5346 测试 badge)

#### 发布时间
周二/周三 10:00-11:00(避开周一开会 + 周五下班)

#### 互动策略
- 评论"求 star" → 回复"已 star 你的 XX 项目,欢迎回访 IHUI-AI"
- 评论"为什么不用 XX" → 回复技术对比,不贬低对手
- 评论"价格还能便宜吗" → 回复"Free 版永久免费,Pro ¥49 是开发者友好价"
- 24h 内回复所有评论,持续 3 天

---

### 2. 知乎(zhihu.com)

#### 平台特点
- **受众**:技术 + 产品 + 投资人混合,喜欢深度分析和"是否值得用"
- **内容风格**:问答 + 文章双形式;文章偏长(2000-4000 字),讲技术 + 讲商业
- **最佳发帖时间**:工作日 9:00-11:00、20:00-23:00

#### 标题模板(三选一)
1. 《如何评价 IHUI-AI 这个 8 端同源的开源 AI 平台?对标 Dify/Coze 有优势吗?》
2. 《2026 年了,为什么我选择 Apache 2.0 开源一个全栈 AI 操作系统而不是 SaaS?》
3. 《340 张表 + 1300+ API + 5346 测试:商业级 AI 平台的工程实践》

#### 正文模板(直接复制)

```
> 先放链接:GitHub https://github.com/IHUI-INF-AI/IHUI-AI · 在线 Demo https://ihui.ai · Apache 2.0 商业可用

## TL;DR

IHUI-AI 是一个 8 端同源(web/api/ai-service/cli/desktop/extension/mobile/miniapp)的开源 AI 操作系统,176 大模型统一调度,LangGraph + MCP + A2A 三栈协议,340 张表,1300+ API,5346 测试,Apache 2.0 商业可用,定价 Free / Pro ¥49 / Team ¥199 / Enterprise ¥2999。

国内 ChatGPT Team ¥180/月,我做了个 ¥49/月 的开源替代。

## 为什么写这篇文章

我是 [作者背景一句话],过去 X 个月全职开发 IHUI-AI。期间被问最多的 3 个问题:
1. 为什么不直接用 Dify / Coze / FastGPT?
2. 8 端同源是不是 PPT?真做出来了吗?
3. Apache 2.0 开源怎么赚钱?

本文就这 3 个问题展开。

## 一、为什么不直接用 Dify / Coze / FastGPT

[对比表格 + 你的差异化。200-400 字]

核心差异:
- **Dify**:工作流编排强,但只有 web 端,无 CLI/desktop/extension
- **Coze**:字节闭源,数据不在你手里,合规风险
- **FastGPT**:知识库强,但不是 Agent 框架,无 MCP/A2A
- **IHUI-AI**:8 端 + 176 模型 + LangGraph+MCP+A2A + 商业化(订阅/钱包/积分/分销)开箱即用

## 二、8 端同源是真的吗

[架构图 + 代码示例。300-500 字]

核心:packages/ 目录下 7 个共享包(types / sdk / api-client / design-tokens / ui-react / ui-native / auth),8 个 apps/ 各自实现端特定逻辑。

```ts
// 8 端共用同一个 SDK
import { IhuiClient } from '@ihui/sdk';

const client = new IhuiClient({ apiKey: process.env.IHUI_API_KEY });

// 在 web / desktop / extension / mobile / miniapp / cli 都是同一行
const response = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello' }],
});
```

## 三、Apache 2.0 开源怎么赚钱

[商业模式说明。300-500 字]

四档定价:
- **Free**:自部署,Apache 2.0,所有功能可用
- **Pro ¥49/月**:个人开发者,托管服务 + 优先支持
- **Team ¥199/人/月**:团队协作,SLA 99.5%
- **Enterprise ¥2999/月起**:私有部署 + 定制开发 + 培训

开源 = 用户教育 + 信任 + 反向引流到托管服务。Dify / Supabase / Cal.com 都是这条路。

## 四、技术细节(给工程师看)

### 1. 176 大模型统一调度

LiteLLM 适配层,统一 OpenAI / Anthropic / Gemini / 通义千问 / 智谱 / DeepSeek / Ollama / vLLM 接口。

### 2. P3 深度层:Agent 元认知

16 张表实现 Agent 自我反思 + 多模态记忆 + A/B 测试 + 联邦学习。详见仓库 `apps/api/src/schema/p3-deep-layer.ts`。

### 3. 多租户 RLS

PostgreSQL Row-Level Security,单库 340 表隔离多租户,详见 `apps/api/src/schema/rls.ts`。

## 五、数据和现状

- GitHub star:[当前数字]
- 在线注册用户:[当前数字]
- 付费用户:[当前数字]
- 月活:[当前数字]
- 5346 测试通过率:100%

## 六、如何参与

1. Star:https://github.com/IHUI-INF-AI/IHUI-AI
2. 试用:https://ihui.ai
3. 加群:微信 `ok502319984` 备注"知乎"
4. 投稿 / PR:欢迎 issue

## License & 定价

Apache 2.0,商业可用。定价见上。

---

感谢阅读。如果你在做 AI 应用,欢迎交流 — 评论必回。
```

#### 标签 / 话题
`人工智能` `开源` `AI` `ChatGPT` `LangGraph` `大模型` `编程` `软件工程` `创业`

#### 配图建议
- **首图**:价格对比表(ChatGPT Team ¥180 vs IHUI-AI ¥49)
- **图 2**:架构图(8 端 + 模型调度)
- **图 3**:GitHub 仓库截图(star 数 + 测试 badge)
- **图 4**:在线 Demo 截图

#### 发布时间
周三/周四 20:00-22:00(知乎用户晚间活跃)

#### 互动策略
- 知乎评论区讲究"理性",不要硬广
- 回答"@某某 怎么看"类问题,先肯定对方观点再补充自己数据
- 收藏数 > 点赞数 = 文章质量好,知乎算法会推荐

---

### 3. SegmentFault(segmentfault.com)

#### 平台特点
- **受众**:国内前端/后端工程师,技术氛围最纯,排斥营销
- **内容风格**:技术教程 / 架构分享,1500-2500 字,代码块要详细
- **最佳发帖时间**:工作日 9:00-11:00、14:00-17:00

#### 标题模板(三选一)
1. 《8 端同源 AI 平台架构实践:从 packages 共享到 apps 分发》
2. 《LangGraph + LiteLLM + MCP 实现 176 大模型统一调度的工程经验》
3. 《PostgreSQL 340 表 + RLS 多租户:商业级 AI 平台的数据库设计》

#### 正文模板(直接复制)

```
> 项目背景:IHUI-AI 是一个 Apache 2.0 开源的全栈 AI 操作系统,8 端同源(web/api/ai-service/cli/desktop/extension/mobile/miniapp),176 大模型,340 张表。GitHub:https://github.com/IHUI-INF-AI/IHUI-AI

## 架构总览

```
apps/
├── api/            Fastify 5 + Drizzle ORM 0.38 + PostgreSQL
├── web/            Next.js 15 + React 19 + Tailwind 4
├── ai-service/     FastAPI + LangGraph + LiteLLM + MCP
├── miniapp-taro/   Taro 4 + React
├── desktop/        Electron
├── extension/      Chrome MV3
├── mobile-rn/      React Native
└── cli/            Commander.js

packages/
├── types/          共享 TS 类型
├── sdk/            JS/TS SDK
├── api-client/     1300+ endpoint 客户端
├── design-tokens/  设计令牌(8 端共享)
├── ui-react/       React 19 组件库
├── ui-native/      React Native 组件库
└── auth/           JWT + OAuth2 + 多租户
```

## 1. 8 端同源:packages/ 设计

### 1.1 类型共享(types 包)

[200-300 字 + 代码示例,讲 types 包如何让 8 端用同一份契约]

### 1.2 SDK 双形式:ESM + CJS

[200-300 字 + tsup 配置 + 多入口 exports 字段]

### 1.3 设计令牌跨端复用

[200-300 字 + design-tokens 的 JS 对象 + CSS 变量双形式,如何同时喂给 web 和 react-native]

## 2. 176 大模型统一调度

### 2.1 LiteLLM 适配层

[300-400 字 + 代码示例,讲 OpenAI / Anthropic / Gemini / 通义千问 / Ollama 的统一接口]

### 2.2 成本追踪 + 模型 Leaderboard

[200-300 字,讲 token 计费表 + 模型性价比排行]

## 3. PostgreSQL 340 表 + RLS 多租户

### 3.1 Schema 分层

```ts
// apps/api/src/schema/index.ts
export * from './users';
export * from './chat';
export * from './agents-extended';
// ... 30+ 业务域,340 张表
```

### 3.2 RLS 多租户隔离

[300-400 字 + 代码示例,讲 Row-Level Security 策略]

## 4. 测试与 CI

- 5346 个测试用例,vitest + pytest 双栈
- CI:GitHub Actions,turbo 缓存,全量跑 < 8 分钟
- pre-commit 30+ 守门脚本(圆角守门 / i18n 纯度 / push 同步等)

## 总结

8 端同源 + 176 模型 + 商业级工程实践,Apache 2.0 商业可用。

- GitHub:https://github.com/IHUI-INF-AI/IHUI-AI
- Demo:https://ihui.ai
- 文档:见仓库 docs/

如果觉得有用,Star 支持一下。后续会写:
- Drizzle ORM 0.38 实践
- LangGraph 多 Agent 编排
- Taro 4 + React 19 微信小程序集成
```

#### 标签 / 话题
`架构` `开源` `AI` `大模型` `LangGraph` `PostgreSQL` `Next.js` `TypeScript` `Drizzle ORM`

#### 配图建议
- **首图**:仓库目录结构截图(apps/ + packages/)
- **图 2**:架构图(8 端 + 共享层)
- **图 3**:数据库 ER 图片段(选 5-10 张核心表)
- **图 4**:CI 绿色截图(5346 测试)

#### 发布时间
周二/周三 14:00-16:00(程序员下午茶时间)

#### 互动策略
- SegmentFault 用户偏资深,技术问题认真回答
- 评论里"这个方案有 XX 问题" → 承认局限 + 给出权衡理由
- 不要"求 star",改为"欢迎提 issue / PR"

---

### 4. CSDN(csdn.net)

#### 平台特点
- **受众**:国内最大开发者社区,SEO 权重高,长尾流量
- **内容风格**:技术教程 / 工具推荐,1500-2500 字,关键词堆叠对 SEO 友好
- **最佳发帖时间**:工作日 9:00-11:00、19:00-22:00;周末流量也行

#### 标题模板(三选一)
1. 《2026 最值得关注的 8 端开源 AI 平台:IHUI-AI 完整部署教程》
2. 《Apache 2.0 开源 AI 商业平台 IHUI-AI:176 大模型 + 8 端同源 + 商业化开箱即用》
3. 《替代 ChatGPT Team 的开源方案:IHUI-AI 自部署教程(省 70% 成本)》

#### 正文模板(直接复制)

```
> 关键词:开源 AI 平台 / 8 端同源 / 176 大模型 / LangGraph / MCP / A2A / Apache 2.0 / 自部署 / 商业级 AI / Dify 替代 / Coze 替代 / ChatGPT Team 替代

## 一、IHUI-AI 是什么

IHUI-AI 是一个 Apache 2.0 开源的 8 端全栈 AI 操作系统,核心特性:

- **8 端同源**:web / api / ai-service / cli / desktop / extension / mobile / miniapp
- **176 大模型**:OpenAI / Anthropic / Gemini / 通义千问 / 智谱 / DeepSeek / Ollama / vLLM
- **三栈协议**:LangGraph + MCP + A2A
- **商业级**:340 表 / 144 迁移 / 1300+ API / 5346 测试
- **License**:Apache 2.0(商业可用,可二次销售)

GitHub:https://github.com/IHUI-INF-AI/IHUI-AI
在线 Demo:https://ihui.ai

## 二、为什么选择 IHUI-AI

### 2.1 对标 ChatGPT Team,省 70%

| 方案 | 月费 | 等价 IHUI-AI |
| --- | --- | --- |
| ChatGPT Team | $25/人 ≈ ¥180 | Pro ¥49(省 70%) |
| Claude Pro | $20 ≈ ¥145 | Pro ¥49(省 65%) |
| Cursor Pro | $20 ≈ ¥145 | Free 自部署 |

### 2.2 对标 Dify / Coze / FastGPT

| 平台 | 闭源 | 8 端 | 商业化 | 自部署 |
| --- | --- | --- | --- | --- |
| Dify | 开源 | 仅 web | 无 | ✅ |
| Coze | 闭源 | 仅 web | 无 | ❌ |
| FastGPT | 开源 | 仅 web | 部分 | ✅ |
| **IHUI-AI** | **Apache 2.0** | **8 端** | **完整(订阅/钱包/积分/分销)** | ✅ |

## 三、5 分钟本地部署

### 3.1 环境要求

- Node.js >= 18
- pnpm >= 8
- PostgreSQL >= 15
- Redis >= 7
- Python >= 3.11(ai-service)

### 3.2 克隆 + 安装

```bash
git clone https://github.com/IHUI-INF-AI/IHUI-AI.git
cd IHUI-AI
pnpm install
```

### 3.3 配置 .env

[贴出 .env.example 关键字段]

### 3.4 启动数据库 + 迁移

```bash
docker compose up -d postgres redis
pnpm --filter @ihui/database db:migrate
pnpm --filter @ihui/database db:seed
```

### 3.5 启动 3 端

```bash
pnpm dev
# 自动启动:web(8801) + api(8802) + ai-service(8803)
```

访问 http://localhost:8801 注册账号即可。

## 四、核心功能演示

### 4.1 176 大模型聊天

[截图 + 步骤说明]

### 4.2 Agent 编排(LangGraph)

[截图 + 步骤说明]

### 4.3 知识库 RAG(pgvector)

[截图 + 步骤说明]

## 五、商业化开箱即用

IHUI-AI 内置完整商业化模块:

- **订阅**:Free / Pro / Team / Enterprise 4 档
- **钱包**:用户充值 + 按量扣费
- **积分**:签到 / 邀请 / 任务赚积分
- **分销**:三级分销 + 佣金自动结算
- **支付**:微信支付 + 支付宝 + Stripe

## 六、社区与生态

- **License**:Apache 2.0
- **Star**:欢迎 Star 支持 https://github.com/IHUI-INF-AI/IHUI-AI
- **微信群**:加 `ok502319984` 备注"CSDN"
- **Issue**:欢迎提 bug / feature request

## 七、相关推荐

- [8 端同源架构详解]
- [LangGraph 多 Agent 编排教程]
- [PostgreSQL RLS 多租户实战]

---

> 本文作者:[你的名字]
> 版权:CC BY 4.0,转载请注明出处
> 项目地址:https://github.com/IHUI-INF-AI/IHUI-AI
```

#### 标签 / 话题
`AI` `人工智能` `开源` `大模型` `LangGraph` `Next.js` `Fastify` `PostgreSQL` `Drizzle` `Taro` `ChatGPT 替代` `Dify 替代`

#### 配图建议
- **首图**:Logo + "8 端 / 176 模型 / Apache 2.0" 大字
- **图 2**:部署流程截图(git clone → pnpm install → pnpm dev)
- **图 3**:聊天界面截图
- **图 4**:价格对比表

#### 发布时间
周一/周二 9:00-11:00(CSDN 周一流量最高)

#### 互动策略
- CSDN 流量来自 SEO 长尾,持续 6-12 个月
- 文末一定要"相关推荐"链接到其他文章,提升 PV
- 评论"求源码" → 回复"GitHub 链接已贴"
- 私信问部署 → 耐心解答,引导加微信群

---

### 5. 微信公众号

#### 平台特点
- **受众**:私域流量,粉丝粘性高,转发裂变强
- **内容风格**:2000-3500 字,标题党 + 钩子开头 + 软广
- **最佳发帖时间**:工作日 7:30-9:00(通勤)、12:00-13:00(午休)、20:00-22:00(晚间)

#### 标题模板(三选一)
1. 《我花 X 个月做了个开源 AI 平台,8 端同源,干翻 40+ 商业产品》
2. 《ChatGPT Team ¥180/月?我做了个 ¥49/月 的开源替代》
3. 《340 表 / 1300+ API / 5346 测试:一个 Apache 2.0 开源 AI 商业平台的诞生》

#### 正文模板(直接复制)

```
> 头图建议:仓库 README 截图 + 大字标题"8 端同源 / 176 模型 / Apache 2.0"

如果你在做 AI 应用,大概率遇到过这些痛点:

- Dify 只有 web 端,做不了 CLI / 桌面 / 浏览器扩展
- Coze 闭源,数据不在自己手里,合规过不了
- ChatGPT Team ¥180/月,团队 10 人一年 ¥2.16 万
- n8n 是工作流,不是 AI 操作系统
- 自己从 0 搭,8 端 + 176 模型 + 商业化,至少 6 个月

过去 X 个月,我做了一件事:

**把这 5 个痛点,用一个开源仓库解决了。**

## 01 一个仓库,8 端同源

IHUI-AI,Apache 2.0 开源,8 端全栈 AI 操作系统:

- web(Next.js 15 + React 19)
- api(Fastify 5 + Drizzle ORM + PostgreSQL)
- ai-service(FastAPI + LangGraph + LiteLLM + MCP)
- miniapp-taro(Taro 4 微信小程序)
- desktop(Electron)
- extension(Chrome MV3)
- mobile(React Native)
- cli(Commander.js)

8 端共用 7 个 packages(types / sdk / api-client / design-tokens / ui-react / ui-native / auth),一处修改 8 端生效。

GitHub:https://github.com/IHUI-INF-AI/IHUI-AI

## 02 176 大模型,统一调度

支持的模型(部分):

- OpenAI:GPT-4o / GPT-4.1 / o1 / o3
- Anthropic:Claude 3.5 / 3.7 / 4 Sonnet/Opus
- Google:Gemini 2.0 / 2.5 Flash/Pro
- 国内:通义千问 / 智谱 GLM / DeepSeek / Kimi / 文心一言
- 开源:Llama 3.3 / Qwen 2.5 / DeepSeek V3 / Mistral
- 本地:Ollama / vLLM / LM Studio

通过 LiteLLM 统一接口,一行代码切模型:

```ts
const client = new IhuiClient({ apiKey: '...' });

// GPT-4o
await client.chat.completions.create({ model: 'gpt-4o', ... });

// Claude 4 Opus
await client.chat.completions.create({ model: 'claude-4-opus', ... });

// 本地 Ollama
await client.chat.completions.create({ model: 'ollama/llama3.3', ... });
```

## 03 商业化,开箱即用

不是只有聊天界面,而是完整商业系统:

- **订阅**:Free / Pro ¥49 / Team ¥199 / Enterprise ¥2999
- **钱包**:用户充值,按 token 量扣费
- **积分**:签到 / 邀请 / 任务赚积分
- **分销**:三级分销 + 佣金自动结算
- **支付**:微信支付 + 支付宝 + Stripe
- **管理后台**:用户 / 订单 / 内容 / 系统 30+ 模块

340 张表,144 个迁移,1300+ API endpoint。

## 04 价格,省 70%

| 方案 | 月费 | 年费(10 人团队) |
| --- | --- | --- |
| ChatGPT Team | ¥180/人 | ¥2.16 万 |
| Claude Team | ¥180/人 | ¥2.16 万 |
| Cursor Business | ¥145/人 | ¥1.74 万 |
| **IHUI-AI Team** | **¥199/人** | **¥2.39 万**(含完整平台) |

或者 **Free 自部署,¥0**。

## 05 性能与规模

- **5346 个测试**,CI 全绿
- **1300+ API**,覆盖 30+ 业务域
- **340 张表**,含 RLS 多租户隔离
- **176 大模型**,统一调度 + 成本追踪
- **8 端同源**,packages 共享

## 06 怎么开始

**3 种方式**:

1. **在线体验**:https://ihui.ai 注册即用
2. **本地部署**:GitHub 仓库 README 有 5 分钟部署教程
3. **加群交流**:微信 `ok502319984` 备注"公众号"

GitHub:https://github.com/IHUI-INF-AI/IHUI-AI

## 07 License

**Apache 2.0**,商业可用,可二次销售。

不是 MIT 那种"别告我"的宽松,也不是 GPL 那种"传染"的限制。Apache 2.0 = 商业友好 + 专利授权 + 显式免责。

---

如果觉得有用,**转发**给在做 AI 应用的朋友。

点击"在看"👇 支持开源。
```

#### 标签 / 话题
- 公众号不支持标签,但标题和摘要里堆关键词:`开源 AI` `8 端` `LangGraph` `替代 ChatGPT`

#### 配图建议
- **头图**:仓库 README 截图 + 大字"8 端同源 / 176 模型 / Apache 2.0"
- **图 2**:8 端架构图
- **图 3**:价格对比表(突出省 70%)
- **图 4**:Demo 截图(聊天界面)
- **图 5**:微信群二维码

#### 发布时间
周二/周三 7:30-8:30(早通勤)或 20:00-21:00(晚间)

#### 互动策略
- 公众号评论区要"精选"+ 回复,提升互动率
- 引导"在看"和"转发" — 算法权重 > 点赞
- 自动回复配置:关注后回复"加群" → 推微信群二维码 + GitHub 链接
- 24h 内回复所有留言

---

## 海外平台(5 个)

### 6. Reddit

#### 平台特点
- **受众**:技术社区,反营销,喜欢技术细节和谦逊态度
- **内容风格**:长文 markdown,代码块 + 数据;标题不营销,正文放数据
- **最佳发帖时间**:Tue/Wed 09:00-11:00 EST(= 14:00-16:00 UTC)

#### 4 个目标 Subreddit

| Subreddit | 订阅数 | 风格 | IHUI-AI 角度 |
| --- | --- | --- | --- |
| r/LocalLLaMA | 250K+ | 本地 LLM 自部署,反 OpenAI | Ollama / vLLM 集成 + 176 模型 |
| r/selfhosted | 400K+ | 自部署一切,反 SaaS | Apache 2.0 + 8 端自部署 |
| r/MachineLearning | 3M+ | 学术 + 工业 ML | LangGraph + MCP + P3 Agent 元认知 |
| r/programming | 5M+ | 通用编程,语言/架构 | 8 端 monorepo + 5346 测试 |

#### 标题模板(r/LocalLLaMA 三选一)
1. `[Open Source] IHUI-AI — Full-stack AI platform with 176 LLMs (incl. Ollama/vLLM), LangGraph+MCP+A2A, 8-platform support (Apache 2.0)`
2. `I built an open-source self-hosted AI OS supporting 176 LLMs (local + cloud) — 8 platforms, 340 tables, 5346 tests. Apache 2.0.`
3. `Show & Tell: LocalLLM-friendly AI platform with built-in LiteLLM + Ollama + vLLM adapters, 1300+ APIs, Apache 2.0`

#### 正文模板(直接复制 — r/LocalLLaMA)

```
Hi r/LocalLLaMA,

I've been building an open-source full-stack AI platform for the past [X months], and just hit a milestone I wanted to share. **No marketing, all technical.**

## What it is

**IHUI-AI** — Apache 2.0 licensed AI operating system, 8-platform monorepo:

- **API**: Fastify 5 + Drizzle ORM 0.38 + PostgreSQL (340 tables / 144 migrations)
- **Web**: Next.js 15 + React 19 + Tailwind 4
- **AI Service**: FastAPI + LangGraph + LiteLLM + MCP
- **8 platforms**: web, api, ai-service, cli, desktop (Electron), extension (Chrome MV3), mobile (React Native), miniapp (Taro 4)

GitHub: https://github.com/IHUI-INF-AI/IHUI-AI
Live demo: https://ihui.ai

## Why r/LocalLLaMA might care

- **176 LLMs supported via LiteLLM adapter layer** — OpenAI / Anthropic / Gemini / Qwen / DeepSeek / Kimi / **Ollama** / **vLLM** / **LM Studio** / Llama 3.3 / Mistral
- **Self-hosted everything**: PostgreSQL (with RLS multi-tenant isolation), Redis, ai-service — no cloud lock-in
- **Local model cost tracking**: per-request token accounting + model leaderboard (cost vs quality)
- **MCP + A2A native**: not bolted-on, designed from day 1
- **Apache 2.0**: commercial-friendly, patent grant, no copyleft contamination

## Architecture (packages/shared layer)

```
packages/
├── types/          Shared TS types (8-platform contracts)
├── sdk/            JS/TS SDK (176 LLMs, 1300+ endpoints)
├── api-client/     Full API client with circuit breaker + WS
├── design-tokens/  Design tokens (web + RN dual)
├── ui-react/       React 19 components (Radix-based)
├── ui-native/      React Native components
└── auth/           JWT + OAuth2 + multi-tenant
```

8 platforms share 7 packages. One change → all 8 platforms updated.

## Scale

- **340 tables** in a single PostgreSQL database (with RLS for multi-tenant isolation)
- **144 migrations** (drizzle-kit managed)
- **1300+ API endpoints** across 30+ business domains
- **5346 tests** (vitest + pytest), CI green
- **176 LLMs** unified via LiteLLM

## What's the catch

Honestly:
- It's a one-person project so far. Code review welcome.
- UI is functional but not Dify-polished yet.
- Documentation is in progress (50% Chinese, 50% English).
- Enterprise features (SSO, audit log) are there but not battle-tested at scale.

## Pricing model

- **Free**: Self-host, Apache 2.0, all features
- **Pro ¥49/mo** (~$7): Hosted + priority support
- **Team ¥199/user/mo** (~$28): SLA 99.5%
- **Enterprise ¥2999/mo** (~$420): Private deployment + customization

Yes, the hosted plan is a SaaS — but **the code is 100% open**. Self-host everything if you want.

## What I'd love feedback on

1. LiteLLM adapter pattern — anyone tried alternative abstractions?
2. RLS for multi-tenant: any horror stories at scale?
3. MCP integration: we went with native protocol, anyone using MCP server registry?

**Star if useful**: https://github.com/IHUI-INF-AI/IHUI-AI
**Live demo**: https://ihui.ai

Happy to answer any technical questions in comments.
```

#### 标签 / 话题
Reddit 不支持标签,但标题 prefix `[Open Source]` / `[Show & Tell]` 是惯例

#### 配图建议
- Reddit 偏好纯文本 + 代码块,**少图**
- 可选 1 张:架构图(8 端 + LiteLLM 适配层)
- 不要 marketing 截图,会被删

#### 发布时间
- r/LocalLLaMA: Tue/Wed 09:00-11:00 EST
- r/selfhosted: Tue/Wed 14:00-16:00 UTC
- r/MachineLearning: Tue 09:00-11:00 EST
- r/programming: Tue/Wed 09:00-11:00 EST
- 4 个 subreddit 错开 24h 发布,避免被判 spam

#### 互动策略
- **Reddit 文化**:谦逊 + 接受批评,不要"my product is the best"
- 评论 "Why not use X?" → "X is great for Y use case, we differ in Z"
- 评论 "this is marketing" → 礼貌回复技术细节,不删评
- 24h 内回复所有评论,持续 3 天
- 不要请朋友刷 upvote,Reddit 算法会检测

---

### 7. Hacker News(Show HN)

#### 平台特点
- **受众**:硅谷工程师 / 创业者 / 投资人,Y Combinator 旗下
- **内容风格**:极简标题 + 技术正文,反营销到了极致
- **最佳发帖时间**:Tue-Thu 08:00-10:00 PST(= 16:00-18:00 UTC)

#### 标题模板(三选一,严格遵守 "Show HN: Name – tagline" 格式)
1. `Show HN: IHUI-AI – Open-source 8-platform AI OS with 176 LLMs, LangGraph+MCP+A2A (Apache 2.0)`
2. `Show HN: I built a self-hostable AI platform supporting 176 LLMs across 8 platforms (web/cli/desktop/extension/mobile/miniapp)`
3. `Show HN: IHUI-AI – Full-stack AI platform, 340 tables, 1300+ APIs, 5346 tests, Apache 2.0`

#### 正文模板(直接复制 — Show HN)

```
Hi HN,

I've been building IHUI-AI for the past [X months]. It's an open-source full-stack AI operating system — Apache 2.0, 8-platform monorepo, 176 LLMs unified via LiteLLM.

GitHub: https://github.com/IHUI-INF-AI/IHUI-AI
Live demo: https://ihui.ai

## What it does

- **8 platforms** from one monorepo: web (Next.js 15), API (Fastify 5), ai-service (FastAPI + LangGraph), CLI, desktop (Electron), browser extension (Chrome MV3), mobile (React Native), miniapp (Taro 4 for WeChat)
- **176 LLMs** supported via LiteLLM adapter — OpenAI, Anthropic, Gemini, Qwen, DeepSeek, Kimi, plus local via Ollama / vLLM / LM Studio
- **Native MCP + A2A support** — not bolted on, designed from day 1
- **Built-in commercial layer**: subscriptions, wallet, credits, 3-tier affiliate, payment (WeChat Pay, Alipay, Stripe)

## Why I built it

Existing options each cover a slice:
- Dify: workflow orchestration, web-only
- Coze: closed-source, ByteDance
- FastGPT: knowledge base focus, not Agent framework
- n8n: workflow, not AI OS
- ChatGPT Team: hosted only, $25/user/mo

I wanted one repo covering all 8 platforms + 176 LLMs + commercial layer, Apache 2.0 so anyone can self-host and sell.

## Technical highlights

- **PostgreSQL 340 tables** in single DB, multi-tenant isolation via Row-Level Security
- **Drizzle ORM 0.38**, 144 migrations managed by drizzle-kit
- **5346 tests** (vitest + pytest), CI green
- **1300+ API endpoints** across 30+ business domains
- **LangGraph multi-agent orchestration** + LiteLLM cost tracking + model leaderboard
- **P3 Deep Layer**: 16 tables for agent metacognition, multimodal memory, A/B testing, federated lessons

## Stack

- API: Fastify 5 + Drizzle ORM 0.38 + PostgreSQL 15
- Web: Next.js 15 + React 19 + Tailwind 4 + shadcn/ui
- AI: FastAPI + LangGraph + LiteLLM + MCP
- Mobile: Taro 4 + React Native
- Build: Turborepo + pnpm workspace

## Caveats

- One-person project, code review welcome
- Documentation is 50/50 Chinese/English (working on full English)
- UI is functional, not Dify-polished
- Enterprise SSO/audit exists but not battle-tested at scale

## Pricing

- Free: self-host, Apache 2.0, all features
- Pro ¥49/mo (~$7): hosted
- Team ¥199/user/mo (~$28): SLA
- Enterprise ¥2999/mo (~$420): private deployment

Code is 100% open. Hosted plan is just a convenience.

## Links

- GitHub: https://github.com/IHUI-INF-AI/IHUI-AI
- Live demo: https://ihui.ai
- Docs: see `docs/` in repo

Happy to answer technical questions. Particularly interested in feedback on:
- LiteLLM adapter pattern (alternative abstractions?)
- RLS for multi-tenant at scale
- MCP integration approach
```

#### 标签 / 话题
HN 不支持标签,但标题必须遵守 `Show HN: Name – tagline` 格式

#### 配图建议
- HN 是纯文本社区,**不要配图**
- 文中可贴 1-2 段代码,但不要嵌入图片

#### 发布时间
Tue/Wed/Thu 08:00-10:00 PST(= 16:00-18:00 UTC = 北京时间 00:00-02:00)

#### 互动策略
- **HN 文化**:反营销到了极致,任何"amazing product"措辞都会被踩
- 第一条评论由作者自己写,补充技术细节
- 评论 "Why not use X?" → 详细技术对比,承认 X 的优势
- 评论 "this is a SaaS ad" → 礼貌回复"code is Apache 2.0, self-hostable, hosted plan is convenience"
- 不要刷 upvote,HN 会检测并隐藏帖子
- 24h 内回复所有评论,持续 3 天
- 上首页(top 30)的概率:20-30%,取决于前 1 小时的 upvote 速度

---

### 8. Twitter/X

#### 平台特点
- **受众**:全球技术圈 + 创业者 + 投资人,viral 传播
- **内容风格**:短帖(280 字)钩子 + 长帖(thread)展开
- **最佳发帖时间**:Tue-Thu 09:00-11:00 EST(= 14:00-16:00 UTC)

#### 模板 A:短帖(钩子,280 字以内)

```
Spent [X months] building an open-source AI platform.

8 platforms. 176 LLMs. LangGraph + MCP + A2A. 340 tables. 5346 tests. Apache 2.0.

One repo to replace 40+ commercial products.

GitHub: https://github.com/IHUI-INF-AI/IHUI-AI
Demo: https://ihui.ai

🧵 Thread 👇
```

#### 模板 B:Thread(8-12 条,完整故事)

```
1/ I built an open-source 8-platform AI operating system.

Apache 2.0. 176 LLMs. LangGraph + MCP + A2A.

One repo to replace: Dify, Coze, FastGPT, n8n, Cursor, Claude Code, ChatGPT Team.

Here's the story 👇

2/ The problem:

- Dify: web only, no CLI/desktop/extension
- Coze: closed-source, ByteDance
- ChatGPT Team: $25/user/mo, no self-host
- n8n: workflow, not AI OS

I wanted ONE repo covering all 8 platforms + 176 LLMs + commercial layer.

3/ The solution: IHUI-AI

8 platforms from one monorepo:
- web (Next.js 15)
- api (Fastify 5)
- ai-service (FastAPI + LangGraph)
- cli, desktop, extension, mobile, miniapp

Apache 2.0. Self-hostable. Commercial-friendly.

4/ 176 LLMs unified via LiteLLM

- OpenAI (GPT-4o, o1, o3)
- Anthropic (Claude 4 Opus)
- Google (Gemini 2.5)
- Qwen, DeepSeek, Kimi (China)
- Llama 3.3, Mistral (open source)
- Ollama, vLLM, LM Studio (local)

One SDK, swap models in 1 line.

5/ Architecture: 8 platforms, 7 shared packages

packages/types, sdk, api-client, design-tokens, ui-react, ui-native, auth

One change → all 8 platforms updated.

This is what "8-platform same-source" actually looks like.

6/ Scale:

- 340 tables (PostgreSQL, with RLS multi-tenant isolation)
- 144 migrations (drizzle-kit)
- 1300+ API endpoints
- 5346 tests (CI green)
- 30+ business domains

7/ Built-in commercial layer:

- Subscriptions (Free / Pro / Team / Enterprise)
- Wallet (per-token billing)
- Credits (sign-in, invite, tasks)
- 3-tier affiliate (auto commission)
- Payment (WeChat Pay, Alipay, Stripe)

Not a chat UI. A full business system.

8/ Pricing comparison:

- ChatGPT Team: $25/user/mo ($300/user/yr)
- Claude Team: $25/user/mo
- Cursor Business: $20/user/mo
- IHUI-AI Pro: ¥49/mo (~$7) — or Free self-host

Code is 100% Apache 2.0. Hosted plan is convenience.

9/ What's next:

- Full English docs (currently 50/50 CN/EN)
- UI polish (functional but not Dify-level yet)
- Enterprise SSO battle-testing
- Community contributors welcome

10/ Links:

- GitHub: https://github.com/IHUI-INF-AI/IHUI-AI
- Live demo: https://ihui.ai
- Docs: see docs/ in repo

Star if useful. Feedback welcome.

Apache 2.0. Commercial-friendly. Self-hostable.

11/ If you're building AI apps and want to chat:

DMs open. Or comment below.

Retweets appreciated to spread the word 🙏

EOF
```

#### 标签 / 话题
`#OpenSource` `#AI` `#LangGraph` `#MCP` `#SelfHosted` `#Apache2` `#BuildInPublic` `#LLM`

#### 配图建议
- **第 1 条**:架构图(8 端拓扑)
- **第 4 条**:176 模型 logo 矩阵
- **第 7 条**:价格对比表
- **第 8 条**:Demo 聊天截图

#### 发布时间
Tue/Wed/Thu 09:00-11:00 EST(= 北京时间 22:00-00:00)

#### 互动策略
- 第 1 条 30 分钟内回复所有评论,提升算法权重
- 引导"Retweet to spread" — 但每 thread 只 1 次
- 大 V 转发后,主动回复感谢
- 不要买粉 / 买转发,Twitter 算法会降权
- 24h 后再发 1 条"update"帖,补充 thread 没说的

---

### 9. LinkedIn

#### 平台特点
- **受众**:职场人士 / B2B 决策者 / HR / 投资人
- **内容风格**:专业 + 商业导向,1500-2500 字,讲 ROI 和团队价值
- **最佳发帖时间**:Tue-Thu 08:00-10:00 EST(= 14:00-16:00 UTC)

#### 标题模板(三选一,LinkedIn 没有标题字段,放正文开头)
1. `I open-sourced an 8-platform AI operating system. Apache 2.0, commercial-friendly.`
2. `How we cut our AI tooling costs by 70% by open-sourcing our own platform`
3. `Building an 8-platform AI OS: lessons from 340 tables, 1300+ APIs, and 5346 tests`

#### 正文模板(直接复制)

```
I open-sourced an 8-platform AI operating system. Apache 2.0, commercial-friendly.

After [X months] of building, I'm excited to share IHUI-AI — a full-stack AI platform that runs across 8 platforms (web, API, AI service, CLI, desktop, browser extension, mobile, miniapp) from a single monorepo.

GitHub: https://github.com/IHUI-INF-AI/IHUI-AI
Live demo: https://ihui.ai

## Why I built it

Most AI platforms cover a single slice:
- Dify: web-only workflow orchestration
- Coze: closed-source, hosted only
- ChatGPT Team: $25/user/month, no self-host
- n8n: workflow automation, not an AI OS

For teams needing 8-platform coverage + 176 LLM support + commercial layer (subscriptions, billing, affiliate), the options were: stitch together 5+ tools, or build from scratch.

I chose option 3: build once, open-source it, let everyone benefit.

## What's included

**8 platforms** from one monorepo:
- Web (Next.js 15 + React 19)
- API (Fastify 5 + Drizzle ORM + PostgreSQL)
- AI Service (FastAPI + LangGraph + LiteLLM + MCP)
- CLI, Desktop (Electron), Extension (Chrome MV3), Mobile (React Native), Miniapp (Taro 4)

**176 LLMs unified via LiteLLM**:
- OpenAI, Anthropic, Google Gemini
- China: Qwen, DeepSeek, Kimi, Zhipu
- Open-source: Llama 3.3, Mistral
- Local: Ollama, vLLM, LM Studio

**Built-in commercial layer**:
- 4-tier subscriptions (Free / Pro / Team / Enterprise)
- Per-token wallet billing
- 3-tier affiliate with auto-commission
- Payment: WeChat Pay, Alipay, Stripe

**Enterprise features**:
- Multi-tenant PostgreSQL with Row-Level Security
- SSO (OAuth2)
- Audit logging
- 30+ admin modules

## By the numbers

- 340 database tables (single PostgreSQL instance, RLS-isolated)
- 144 migrations (drizzle-kit managed)
- 1300+ API endpoints across 30+ business domains
- 5346 tests (vitest + pytest), CI green
- 176 LLMs supported

## Why Apache 2.0

Apache 2.0 is the license I chose deliberately:
- **Commercial-friendly**: you can sell the software, no copyleft contamination
- **Patent grant**: explicit patent license from contributors
- **Enterprise-friendly**: legal teams approve it without negotiation

MIT is too loose (no patent grant). GPL is too restrictive (copyleft). Apache 2.0 is the sweet spot for commercial AI platforms.

## Pricing model

- **Free**: self-host, all features, no limits
- **Pro ¥49/month** (~$7): hosted, priority support
- **Team ¥199/user/month** (~$28): SLA 99.5%, team collaboration
- **Enterprise ¥2999/month** (~$420): private deployment + customization + training

The code is 100% open. The hosted plan is for teams who don't want to self-host.

## Cost comparison

For a 10-person team over 1 year:
- ChatGPT Team: $25/user/mo × 10 × 12 = $3,000
- Claude Team: $25/user/mo × 10 × 12 = $3,000
- IHUI-AI Team: ¥199/user/mo × 10 × 12 = ¥23,880 (~$3,300)

Or IHUI-AI Free: $0 (self-hosted)

## What's next

- Full English documentation (currently 50/50 CN/EN)
- UI polish (functional, not Dify-polished yet)
- Enterprise SSO battle-testing at scale
- Community contributors welcome

## How to get involved

1. **Star the repo**: https://github.com/IHUI-INF-AI/IHUI-AI
2. **Try the demo**: https://ihui.ai
3. **Self-host**: see README for 5-minute deployment
4. **Connect**: DM me here on LinkedIn
5. **Contributors welcome**: see CONTRIBUTING.md

## License

Apache 2.0. Commercial-friendly. Self-hostable. Patent-protected.

---

If you're evaluating AI platforms for your team, I'd love to hear your use case. Comment below or DM.

#OpenSource #AI #ArtificialIntelligence #LangGraph #MCP #SelfHosted #Apache2 #BuildInPublic #EnterpriseAI #SaaS
```

#### 标签 / 话题
`#OpenSource` `#AI` `#ArtificialIntelligence` `#LangGraph` `#MCP` `#SelfHosted` `#Apache2` `#BuildInPublic` `#EnterpriseAI` `#SaaS` `#OpenSourceSoftware`

#### 配图建议
- **首图**:Logo + 大字"8 Platforms / 176 LLMs / Apache 2.0"
- **图 2**:架构图(8 端 + 共享层)
- **图 3**:价格对比表
- **图 4**:Demo 截图

#### 发布时间
Tue/Wed/Thu 08:00-10:00 EST(= 14:00-16:00 UTC = 北京时间 22:00-00:00)

#### 互动策略
- LinkedIn 算法重视"评论深度" > 点赞
- 评论 "Great work!" → 回复"thanks, what's your use case?"
- 主动评论同行 / 投资人的帖子,提升曝光
- 不要短回复("thanks"),写 2-3 句
- 24h 内回复所有评论,持续 3 天

---

### 10. Product Hunt

#### 平台特点
- **受众**:早期 adopter / 产品爱好者 / 投资人 / 科技媒体
- **内容风格**:产品发布页,标题 + 描述 + 截图 + 评论互动
- **最佳发帖时间**:Mon-Wed 00:01 PST(= 08:01 UTC = 北京时间 16:01)

#### 标题模板(三选一,严格 ≤ 60 字符)
1. `IHUI-AI — Open-source 8-platform AI OS with 176 LLMs`
2. `IHUI-AI — Apache 2.0 AI platform: 8 platforms, 176 LLMs, self-hostable`
3. `IHUI-AI — Full-stack AI OS replacing 40+ commercial products`

#### 描述模板(Product Hunt "Description" 字段,≤ 260 字符)

```
Open-source 8-platform AI operating system. Apache 2.0. 176 LLMs via LiteLLM. LangGraph + MCP + A2A. 340 tables, 1300+ APIs, 5346 tests. Self-host or use hosted (Pro $7/mo, Team $28/user/mo).
```

#### 第一评论(Maker Comment,直接复制)

```
Hey Product Hunt! 👋

I'm [your name], maker of IHUI-AI. After [X months] of building, I'm excited to launch it here.

## What is IHUI-AI?

An open-source full-stack AI operating system. Apache 2.0. 8 platforms from one monorepo.

**8 platforms**: web, API, AI service, CLI, desktop (Electron), browser extension, mobile (React Native), miniapp (Taro 4 for WeChat).

**176 LLMs unified** via LiteLLM: OpenAI, Anthropic, Google Gemini, Qwen, DeepSeek, Kimi, plus local via Ollama / vLLM.

**Native protocols**: LangGraph (multi-agent), MCP (model context), A2A (agent-to-agent).

## Why I built it

Existing AI platforms each cover a slice:
- Dify: web only, workflow orchestration
- Coze: closed-source, ByteDance
- ChatGPT Team: $25/user/mo, no self-host
- n8n: workflow, not AI OS

I wanted ONE repo covering all 8 platforms + 176 LLMs + commercial layer (subscriptions, wallet, affiliate). Apache 2.0 so anyone can self-host and sell.

## What's included

- **8 platforms** from one monorepo (Turborepo + pnpm workspace)
- **7 shared packages**: types, SDK, API client, design tokens, UI (React + Native), auth
- **340 tables** in PostgreSQL with Row-Level Security (multi-tenant)
- **1300+ API endpoints** across 30+ business domains
- **5346 tests** (vitest + pytest), CI green
- **Built-in commercial**: subscriptions, per-token wallet, 3-tier affiliate, payment (WeChat Pay, Alipay, Stripe)

## Pricing

- **Free**: self-host, Apache 2.0, all features
- **Pro ¥49/mo** (~$7): hosted, priority support
- **Team ¥199/user/mo** (~$28): SLA 99.5%
- **Enterprise ¥2999/mo** (~$420): private deployment

Code is 100% open. Hosted plan is convenience.

## What's next

- Full English docs (currently 50/50 CN/EN)
- UI polish
- Enterprise SSO battle-testing
- Community contributors

## Links

- GitHub: https://github.com/IHUI-INF-AI/IHUI-AI
- Live demo: https://ihui.ai
- Docs: see docs/ in repo

I'll be here all day answering questions. Ask me anything — technical, business, roadmap.

🎉 Launch day special: use code `PRODUCTHUNT` for 3 months free Pro.

Star the repo if you find it useful ⭐

Thanks for checking it out!
```

#### 标签 / 话题
Product Hunt 支持选 4 个 Topics,推荐:
- `Developer Tools`
- `Open Source`
- `Artificial Intelligence`
- `SaaS`

#### 配图建议(Product Hunt 必需)
- **Gallery 图 1**(必需):Logo + "8 Platforms / 176 LLMs / Apache 2.0" 大字
- **Gallery 图 2**:架构图(8 端 + 共享层)
- **Gallery 图 3**:Demo 截图(web 端聊天界面)
- **Gallery 图 4**:价格对比表
- **Gallery 图 5**:GitHub 仓库截图(star + 测试 badge)
- **Gallery 图 6**:8 端运行 GIF(web + desktop + extension + mobile)

#### 发布时间
**关键**:Product Hunt 一天 24h 周期,PST 00:01 开启新一天

- **最佳**:Mon/Tue/Wed 00:01 PST(= 08:01 UTC = 北京时间 16:01)
- **避开**:周五/周末(流量低 50%)、周四(竞争激烈)
- **预热**:发布前 1 周在 Twitter / LinkedIn 预告,收集"will support"承诺

#### 互动策略
- **PH 文化**:Maker 必须在前 4 小时内回复所有评论
- 提前邀请朋友"点赞 + 评论"(不是刷票,是真实互动)
- 第一条评论(Maker Comment)必须在发布后 1 分钟内发出
- 评论 "How does this compare to X?" → 详细对比表
- 评论 "Is it production-ready?" → "Yes for SMB, enterprise features in beta"
- 持续 24h 回复,目标前 5 名 = 24h 内 500+ upvotes
- 发布后 7 天内,所有 PH 评论都要回复

---

## 发布排期表(1 周计划)

| 日期 | 平台 | 时间(当地) | 备注 |
| --- | --- | --- | --- |
| Day 1 (Mon) | CSDN | 09:00 CST | 国内 SEO 长尾,先发 |
| Day 1 (Mon) | 微信公众号 | 20:00 CST | 私域启动,转发裂变 |
| Day 2 (Tue) | 掘金 | 10:00 CST | 国内技术社区,主力 |
| Day 2 (Tue) | Reddit r/LocalLLaMA | 09:00 EST | 海外技术启动 |
| Day 2 (Tue) | Twitter | 09:00 EST | Thread 同步 |
| Day 3 (Wed) | SegmentFault | 14:00 CST | 国内技术深度 |
| Day 3 (Wed) | Reddit r/selfhosted | 14:00 UTC | 海外自部署社区 |
| Day 3 (Wed) | LinkedIn | 08:00 EST | B2B 受众 |
| Day 4 (Thu) | 知乎 | 20:00 CST | 国内深度问答 |
| Day 4 (Thu) | Hacker News | 08:00 PST | 海外主力,冲首页 |
| Day 4 (Thu) | Reddit r/programming | 09:00 EST | 海外通用编程 |
| Day 5 (Fri) | Reddit r/MachineLearning | 09:00 EST | 海外学术/工业 ML |
| Day 6 (Sat) | Product Hunt | 00:01 PST | 海外产品发布(选 Tue/Wed 更好,避开) |
| Day 7 (Sun) | 回复所有平台评论 | 全天 | 维护期 |

> **关键**:Product Hunt 优先排在 Tue/Wed(流量最高),不要排在 Sat。如调整,把 Day 6/7 整体往前挪 2 天。

---

## 效果追踪指标

发布后 7 天,统计以下指标:

| 平台 | 指标 | 目标 |
| --- | --- | --- |
| GitHub | Star 增量 | +200 |
| GitHub | Fork 增量 | +20 |
| GitHub | Issue 增量 | +10 |
| 网站流量 | UV | +5000 |
| 网站注册 | 新用户 | +200 |
| 掘金 | 阅读 / 点赞 / 评论 | 5000 / 200 / 50 |
| 知乎 | 阅读 / 点赞 / 评论 | 3000 / 100 / 30 |
| SegmentFault | 阅读 / 点赞 | 2000 / 50 |
| CSDN | 阅读 / 收藏 | 10000 / 200 |
| 公众号 | 阅读 / 在看 / 转发 | 2000 / 100 / 50 |
| Reddit | Upvote / Comment | 100 / 30(每个 subreddit) |
| Hacker News | Points / Comment | 50 / 30 |
| Twitter | Impression / Like / Retweet | 50000 / 200 / 50 |
| LinkedIn | Impression / Comment | 10000 / 30 |
| Product Hunt | Upvote / Comment | 200 / 30 |

---

## 通用注意事项

### 1. 不要硬广
- 国内平台:技术分享 80% + 软广 20%
- 海外平台:技术细节 90% + 链接 10%
- 任何"amazing product"措辞都会被踩

### 2. 错开发帖时间
- 同一平台 24h 内不要发 2 次
- 不同平台间隔 4-8h
- 避免 0 点同时发(被判 spam)

### 3. 评论必回
- 24h 内回复所有评论
- 持续关注 3-7 天
- "求 star" 评论必回

### 4. 数据要真实
- Star 数 / 测试数 / 模型数 = 仓库实际数据
- 不要夸大(评论者会去验证)
- 价格对比要给出计算依据

### 5. License 一致
- 所有平台统一说 **Apache 2.0**
- 不要在某个平台说 MIT,另一个说 GPL

### 6. 链接一致
- GitHub: https://github.com/IHUI-INF-AI/IHUI-AI
- Demo: https://ihui.ai
- 邮箱: 502319984@qq.com
- 微信: ok50319984(国内平台提)

### 7. 配图版权
- 用自己仓库截图 + Excalidraw 画的架构图
- 不要用 Unsplash / Pexels(配图风格不统一)
- Logo 用项目自己的

### 8. 跨平台引流
- 国内平台 → 引导加微信群
- 海外平台 → 引导 GitHub Star + Twitter Follow
- 所有平台 → 引导官网注册

---

## 附录:模板变量替换清单

发帖前替换以下变量(用 `[XXX]` 标记的占位符):

- `[X months]` — 项目开发时长(如 "6 months" / "8 个月")
- `[当前数字]` — GitHub star / 注册用户 / 付费用户 / 月活
- `[你的名字]` — 作者署名
- `[作者背景一句话]` — 如"前 XX 公司全栈工程师" / "独立开发者"

替换后即可直接复制粘贴发帖。
