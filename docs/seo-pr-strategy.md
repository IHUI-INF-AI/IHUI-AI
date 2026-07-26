# IHUI AI 高密度曝光度外部 PR 策略

> **目标**:把 IHUI AI 在主流搜索引擎(Google/Bing/百度/Brave)、AI 引擎(GPT/Claude/Perplexity/Gemini/豆包/Kimi/DeepSeek)、开发者社区(GitHub/HN/Reddit/V2EX/掘金/思否/知乎/Medium)、开源目录(awesome-llm/Product Hunt/BetaList)的曝光度提升到较高水平。
> **维护者**:Marketing + DevRel + Agent 协作
> **最后更新**:2026-07-26

---

## 1. 已完成的 GEO/SEO 基建(项目内)

| 文件 | 用途 | 受益对象 |
| --- | --- | --- |
| `/llms.txt` | 短版 LLM 检索文件,精炼项目介绍 | GPTBot / ClaudeBot / 通用 LLM |
| `/llms-full.txt` | 长版 LLM 文档,15KB 完整说明 | 深度 LLM 检索 |
| `/gpt.txt` | OpenAI Q&A 格式优化 | ChatGPT / GPTBot / OAI-SearchBot |
| `/claude.md` | Anthropic 长篇叙事优化 | Claude / ClaudeBot / Claude-SearchBot |
| `/perplexity.md` | Perplexity 引用友好格式 | PerplexityBot / Perplexity-User |
| `/gemini.txt` | Google Gemini 实体-属性优化 | Google-Extended / Gemini |
| `/sitemap.xml` | 动态 sitemap,5 语言 hreflang | Googlebot / Bingbot / 百度 |
| `/robots.txt` | 20+ AI 爬虫显式放行 | 全部 AI 引擎 |
| `/about` + `/faq` | AboutPage + FAQPage JSON-LD | Google Rich Results + LLM |
| `/compare/ihui-vs-{dify,coze,fastgpt,n8n}` | 4 个产品对比页(高搜索量长尾) | 全部搜索引擎 + LLM |
| `/use-cases/{customer-support,knowledge-base,code-assistant,content-generation}` | 4 个场景用例页(高搜索量长尾) | 全部搜索引擎 + LLM |

---

## 2. 必须提交的外部平台清单

### 2.1 AI 引擎官方生态(必做)

| 平台 | 优先级 | 提交方式 | 状态 |
| --- | --- | --- | --- |
| **OpenAI GPT Store / Browse with Bing** | P0 | 提交 llms.txt + gpt.txt 给 OpenAI 收录团队 | ⏳ 待提交 |
| **Anthropic Claude.ai Projects** | P0 | 提交 claude.md,推荐项目给 Anthropic 团队 | ⏳ 待提交 |
| **Perplexity Pages** | P0 | 在 Perplexity 创建项目页面,引用 perplexity.md | ⏳ 待提交 |
| **Google Gemini Apps** | P0 | 提交项目给 Google AI 收录 | ⏳ 待提交 |
| **百度文心 / 千帆** | P1 | 提交项目给百度 AI 收录 | ⏳ 待提交 |
| **字节豆包** | P1 | 提交项目给字节 AI 收录 | ⏳ 待提交 |
| **月之暗面 Kimi** | P1 | 提交项目给 Moonshot 收录 | ⏳ 待提交 |
| **DeepSeek** | P1 | 提交项目给 DeepSeek 收录 | ⏳ 待提交 |
| **智谱清言** | P1 | 提交项目给智谱 AI 收录 | ⏳ 待提交 |
| **阿里通义千问** | P1 | 提交项目给阿里云 AI 收录 | ⏳ 待提交 |

### 2.2 搜索引擎站长工具(必做)

| 平台 | 优先级 | 操作 | 状态 |
| --- | --- | --- | --- |
| **Google Search Console** | P0 | 提交 sitemap,验证域名所有权,监控索引 | ⏳ 待提交 |
| **Bing Webmaster Tools** | P0 | 提交 sitemap,验证域名,监控索引 | ⏳ 待提交 |
| **百度站长平台** | P0 | 提交 sitemap,验证 ICP 备案,主动推送 | ⏳ 待提交 |
| **Yandex Webmaster** | P1 | 提交 sitemap(俄语市场) | ⏳ 待提交 |
| **Naver Search Advisor** | P1 | 提交 sitemap(韩国市场) | ⏳ 待提交 |
| **Brave Search** | P2 | 提交 sitemap(隐私搜索引擎) | ⏳ 待提交 |
| **DuckDuckGo** | P2 | 通过 Bing 间接索引 | 自动 |

### 2.3 开源目录与代码托管(必做)

| 平台 | 优先级 | 链接 | 状态 |
| --- | --- | --- | --- |
| **GitHub Release** | P0 | 打 tag + 写详细 release notes | ⏳ 待发布 |
| **GitHub Topics** | P0 | 添加 topics: ai-agent, llm, rag, mcp, workflow, knowledge-base | ⏳ 待添加 |
| **GitHub awesome-* lists** | P0 | 提交 PR 到: awesome-llm, awesome-ai-agents, awesome-rag, awesome-self-hosted, awesome-mcp | ⏳ 待提交 |
| **Sourcegraph** | P1 | 索引 GitHub 仓库 | 自动 |
| **OpenHub** | P1 | 注册开源项目 | ⏳ 待注册 |
| **Codeberg** | P2 | 镜像仓库(社区友好) | ⏳ 待镜像 |

### 2.4 产品发布平台(必做)

| 平台 | 优先级 | 操作 | 状态 |
| --- | --- | --- | --- |
| **Product Hunt** | P0 | 完整发布页 + hunter + 社区互动 | ⏳ 待发布 |
| **BetaList** | P1 | 提交早期访问 | ⏳ 待提交 |
| **Launching Next** | P1 | 提交发布 | ⏳ 待提交 |
| **AlternativeTo** | P1 | 标记为 Dify/Coze/FastGPT/n8n 替代品 | ⏳ 待标记 |
| **SourceForge** | P2 | 镜像项目页 | ⏳ 待提交 |
| **Slant** | P2 | 添加到对比列表 | ⏳ 待添加 |
| **GetApp** | P2 | 添加到商业软件目录 | ⏳ 待添加 |
| **Capterra** | P2 | 添加到商业软件目录 | ⏳ 待添加 |

### 2.5 中文社区(高优先级)

| 平台 | 优先级 | 操作 | 状态 |
| --- | --- | --- | --- |
| **掘金** | P0 | 发布技术文章 3-5 篇(架构/Agent/RAG/MCP/部署) | ⏳ 待发布 |
| **知乎** | P0 | 创建机构号 + 发布问答 + 创建专栏 | ⏳ 待创建 |
| **思否(SegmentFault)** | P1 | 发布技术问答 | ⏳ 待发布 |
| **V2EX** | P1 | 创意发布板块发布 + tech 板块讨论 | ⏳ 待发布 |
| **OSCHINA** | P1 | 发布开源项目 + 技术博客 | ⏳ 待发布 |
| **博客园** | P2 | 同步技术文章 | ⏳ 待发布 |
| **CSDN** | P2 | 同步技术文章 | ⏳ 待发布 |
| **微信公众号** | P0 | 申请「智汇 AI」原创公众号,发布深度文章 | ⏳ 待申请 |

### 2.6 英文技术社区(高优先级)

| 平台 | 优先级 | 操作 | 状态 |
| --- | --- | --- | --- |
| **Hacker News (Show HN)** | P0 | Show HN: IHUI AI - Open-source full-stack AI OS | ⏳ 待发布 |
| **Reddit r/MachineLearning** | P0 | 发布项目介绍 + 关键差异点 | ⏳ 待发布 |
| **Reddit r/LocalLLM** | P0 | 发布项目,强调自托管 + 多模型 | ⏳ 待发布 |
| **Reddit r/selfhosted** | P0 | 发布自托管部署指南 | ⏳ 待发布 |
| **Reddit r/opensource** | P1 | 发布项目,强调 Apache 2.0 | ⏳ 待发布 |
| **Dev.to** | P0 | 发布技术深度文章 3-5 篇 | ⏳ 待发布 |
| **Medium** | P0 | 同步技术文章到 Medium Publication | ⏳ 待发布 |
| **Hashnode** | P1 | 创建技术博客,发布深度文章 | ⏳ 待创建 |
| **DEV Community** | P1 | 发布技术文章 | ⏳ 待发布 |

### 2.7 视频与社交平台

| 平台 | 优先级 | 操作 | 状态 |
| --- | --- | --- | --- |
| **YouTube** | P0 | 录制 5-10 分钟产品演示视频,发布 + SEO 优化 | ⏳ 待录制 |
| **Bilibili** | P0 | 录制中文产品演示,发布 | ⏳ 待录制 |
| **抖音** | P1 | 录制短视频 1-2 分钟,发布 | ⏳ 待录制 |
| **小红书** | P1 | 发布图文笔记,目标开发者人群 | ⏳ 待发布 |
| **Twitter/X** | P0 | 官方账号 @ihui_ai,日常技术分享 | ⏳ 待激活 |
| **LinkedIn** | P1 | 公司页 + 团队个人页分享 | ⏳ 待创建 |
| **Mastodon** | P2 | 跨平台镜像 Twitter | ⏳ 待镜像 |

### 2.8 行业目录与社区

| 平台 | 优先级 | 操作 | 状态 |
| --- | --- | --- | --- |
| **G2** | P1 | 添加到 AI 平台对比目录 | ⏳ 待添加 |
| **Crozdesk** | P2 | 添加到商业软件目录 | ⏳ 待添加 |
| **StackShare** | P1 | 添加技术栈:Next.js 15, Fastify 5, Tauri 2 等 | ⏳ 待添加 |
| **Stack Overflow** | P0 | 创建 ihui-ai tag,回答相关问题 | ⏳ 待创建 |
| **Slant.co** | P2 | 添加到 AI 平台对比 | ⏳ 待添加 |

### 2.9 学术与研究

| 平台 | 优先级 | 操作 | 状态 |
| --- | --- | --- | --- |
| **arXiv** | P2 | 发布技术论文(架构 / 性能对比) | ⏳ 待撰写 |
| **Papers with Code** | P1 | 链接 GitHub 仓库,标记 benchmark | ⏳ 待链接 |
| **Google Scholar** | P2 | 注册学术引用 | ⏳ 待注册 |

### 2.10 知识图谱与实体

| 平台 | 优先级 | 操作 | 状态 |
| --- | --- | --- | --- |
| **Wikidata** | P1 | 创建 IHUI AI 实体 + sameAs 链接 | ⏳ 待创建 |
| **Crunchbase** | P1 | 注册公司信息,链接官网 | ⏳ 待注册 |
| **LinkedIn Company Page** | P0 | 完善公司信息 + 官网链接 + sameAs | ⏳ 待创建 |
| **DBpedia** | P2 | 自动从 Wikipedia 抓取 | 等待 Wikipedia |
| **Google Knowledge Graph** | P1 | 通过 Organization schema + Wikipedia 自动收录 | 自动 |

---

## 3. 关键词策略

### 3.1 核心关键词(高优先级 SEO)

**英文**:
- "AI agent platform"
- "open source AI agent"
- "AI agent marketplace"
- "self-hosted AI platform"
- "AI agent builder"
- "LLM application platform"
- "RAG platform"
- "Dify alternative"
- "Coze alternative"
- "FastGPT alternative"
- "n8n alternative"
- "AI workflow automation"
- "MCP Model Context Protocol"
- "knowledge base AI"
- "AI customer support"

**中文**:
- "AI 智能体平台"
- "开源 AI 智能体"
- "AI Agent 市场"
- "Dify 替代"
- "Coze 替代"
- "FastGPT 替代"
- "n8n 替代"
- "企业知识库 RAG"
- "AI 客服"
- "MCP 协议"
- "AI 工作流编排"
- "AI 私有化部署"
- "一码六端"

### 3.2 长尾关键词(精准流量)

| 搜索意图 | 长尾词 |
| --- | --- |
| 对比 | "IHUI AI vs Dify", "智汇 AI 和 Dify 区别", "Dify 替代品 开源" |
| 部署 | "AI 平台 Docker 部署", "自托管 AI Agent 平台", "Kubernetes AI 平台" |
| 价格 | "AI 平台 免费 个人版", "开源 AI 平台 价格对比" |
| 用例 | "AI 客服 开源", "AI 代码助手 自托管", "企业知识库 RAG 方案" |
| 技术 | "MCP 协议 实践", "AI Agent 编排 框架", "多模型统一调度" |

---

## 4. 内容营销节奏

### 4.1 第 1 周(发布基建)

- [ ] 创建微信公众号「智汇 AI」
- [ ] 创建 Twitter @ihui_ai,发布 10 条技术分享
- [ ] 创建 YouTube 频道,发布产品介绍视频
- [ ] 申请 Product Hunt 发布
- [ ] 提交 HN Show HN

### 4.2 第 2 周(技术深度)

- [ ] 掘金发布 3 篇技术深度文章
- [ ] Dev.to 同步发布
- [ ] Medium 同步发布
- [ ] 知乎创建机构号,发布 5 个问答

### 4.3 第 3 周(社区渗透)

- [ ] Reddit 多板块发布
- [ ] V2EX 创意发布
- [ ] OSCHINA 项目展示
- [ ] 提交 PR 到 5+ awesome-* 列表

### 4.4 第 4 周(权威建立)

- [ ] Wikidata 实体创建
- [ ] Crunchbase 公司注册
- [ ] LinkedIn 公司页完善
- [ ] 申请 1-2 个行业奖项(G2 Leader, SourceForge Top Project)

---

## 5. 关键 PR 文案模板

### 5.1 Product Hunt 发布文案

**Tagline**: "Open-source full-stack AI operating system — one platform, six clients, every AI you need."

**Description**:
IHUI AI (智汇 AI) is an open-source, full-stack AI operating system that combines Agent design, knowledge-base RAG, multi-model orchestration, cross-platform distribution, and team collaboration into a single product.

**Why we built it**: Companies adopting AI face a "four-piece problem" — model selection, knowledge base integration, cross-platform distribution, team collaboration and billing. Existing tools (Dify, Coze, FastGPT, n8n) each solve one piece. IHUI AI solves all four in one product.

**Key features**:
- 🌍 Six clients from one codebase: Web / Desktop / Mini Programs / Browser Extension / React Native / CLI
- 🤖 200+ Agent templates in marketplace
- 📚 Production-grade RAG (vector + BM25, Chinese-friendly)
- 🔌 Native MCP support (100+ pre-built MCP servers)
- 🔀 10+ AI models with unified credit billing (OpenAI, Claude, Gemini, Qwen, DeepSeek, GLM, ERNIE, Doubao, Kimi, Ollama)
- 👥 Team collaboration (RBAC, audit logs, SSO)
- 🏠 Apache 2.0, self-hosting in 5 minutes

**Links**:
- Website: https://ihui.ai
- GitHub: https://github.com/ihui-ai
- Quickstart: https://ihui.ai/docs/quickstart
- Comparison: https://ihui.ai/compare

### 5.2 HN Show HN 文案

**Title**: Show HN: IHUI AI – Open-source full-stack AI OS (one codebase, six clients)

**Body**:
Hi HN,

We're the team behind IHUI AI (https://ihui.ai), an open-source full-stack AI operating system we've been working on since 2024.

The problem we set out to solve: when companies adopt AI, they typically end up stitching together Dify (LLM app dev) + Coze (Agent platform) + FastGPT (knowledge base) + n8n (workflow) + a custom internal dashboard (team/billing). We built IHUI AI to replace that whole toolchain with one open-source product.

What it does:
- Visual drag-and-drop Agent builder with 200+ templates
- Production RAG (vector + BM25 hybrid, Chinese-friendly)
- 10+ AI models unified (OpenAI, Claude, Gemini, Qwen, DeepSeek, Zhipu, Baidu, Doubao, Kimi, Ollama) with auto-fallback and cost routing
- Native MCP (Model Context Protocol) support with 100+ pre-built MCP servers
- Six-client distribution: Web (Next.js 15), Desktop (Tauri 2), Mini Programs (Taro 4 for WeChat/Alipay/Douyin), Browser Extension (WXT MV3), iOS/Android (React Native), CLI (Node.js/Bun) — all from one React codebase
- Team collaboration (RBAC, audit logs, SSO/OAuth, shared credit pool)
- Apache 2.0, self-hostable in 5 minutes via Docker Compose

Stack: TypeScript monorepo, Next.js 15, Fastify 5, Drizzle ORM, PostgreSQL, FastAPI, LangGraph, LiteLLM, Tauri 2, Taro 4, WXT, React Native.

Comparison pages (so you can see how we stack up against the tools you'd be replacing):
- https://ihui.ai/compare/ihui-vs-dify
- https://ihui.ai/compare/ihui-vs-coze
- https://ihui.ai/compare/ihui-vs-fastgpt
- https://ihui.ai/compare/ihui-vs-n8n

We'd love feedback on the Agent marketplace, RAG quality, and the six-client architecture. If you try the Docker Compose quickstart, please let us know how it goes.

GitHub: https://github.com/ihui-ai
Quickstart: https://ihui.ai/docs/quickstart
LLM-optimized docs: https://ihui.ai/llms.txt

### 5.3 Reddit 发布模板

**Title (r/MachineLearning)**: [P] IHUI AI – Open-source full-stack AI OS with Agent marketplace, RAG, multi-model, six-client distribution

**Title (r/LocalLLM)**: [P] IHUI AI – Self-hostable AI OS, integrates Ollama + 9 cloud models with unified billing

**Title (r/selfhosted)**: IHUI AI – Self-hostable full-stack AI platform (Apache 2.0, Docker Compose 5-min setup)

---

## 6. 监控与效果追踪

### 6.1 关键指标(KPI)

| 指标 | 目标 | 监控工具 |
| --- | --- | --- |
| GitHub stars | 1 个月内 1000+ | GitHub |
| Product Hunt upvotes | 1 周内 500+ | Product Hunt |
| 官网 DAU | 1 个月内 5000+ | Google Analytics |
| Google 搜索流量 | 3 个月内 10K/月 | Google Search Console |
| AI 引擎引用次数 | 1 个月内 100+ | 手动监控 |
| 微信公众号关注 | 3 个月内 5000+ | 微信公众平台 |
| 视频播放量 | 1 个月内 50K+ | YouTube/Bilibili |
| Product Hunt 排名 | 当日前 10 | Product Hunt |

### 6.2 月度复盘

每月 1 号复盘:
- 各项 KPI 进度
- 哪个渠道效果较为突出
- 哪些内容类型转化高
- 下个月重点方向

---

## 7. 责任分工

| 角色 | 职责 |
| --- | --- |
| **DevRel** | 技术文章撰写、社区互动、HN/Reddit 发布、PR |
| **Marketing** | Product Hunt 申请、内容日历、社交媒体运营 |
| **CEO/创始人** | 行业奖项申请、合作伙伴 BD |
| **AI Agent(本项目)** | 自动化提交 + 内容生成 + 监控报表 |

---

## 8. AI Agent 自动化(2026-07-26 立)

为最大化曝光度并节省人力,本项目使用 AI Agent 自动化以下任务:

1. **每周自动生成 3 篇技术博客草稿**(AI 模型对比 / 架构演进 / 客户案例),发布到掘金 + Dev.to + Medium
2. **每周自动提交 5 个外部目录**(从本策略文档 §2 清单中按优先级循环)
3. **每月自动生成监控报表**(KPI 进度 + 待优化项 + 下月计划)
4. **AI 引擎引用监控**:每日检测主流 AI 引擎(ChatGPT/Claude/Perplexity/Gemini)对 ihui.ai 的引用,异常时报警

对应实现见:
- `scripts/seo-monitor.mjs`(待开发)
- `scripts/auto-blog-poster.mjs`(待开发)
- `scripts/auto-directory-submitter.mjs`(待开发)

---

**注意**:本策略文档应每季度复盘一次,根据实际效果调整优先级和渠道。
