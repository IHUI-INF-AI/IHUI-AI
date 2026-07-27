# IHUI-AI SEO Keywords 长尾关键词清单

> 作用:统一管理 IHUI-AI 项目的 SEO 关键词资产,用于 README、网站 meta、社媒描述、内容营销。
> 维护策略:新增能力时同步追加对应关键词;commit 前跑 `check-i18n-keys.mjs` 不涉及本文件(纯英文 SEO 资产)。
> 最后更新:2026-07-27

---

## 1. Primary Keywords(核心关键词 · 10 个)

高搜索量 + 项目强相关,优先布局在 README H1/H2、网站 title、meta description。

1. AI Agent Platform
2. LLM Gateway
3. MCP Server
4. LangGraph
5. Multi-tenant AI
6. Open Source ChatGPT Alternative
7. AI Operating System
8. Agentic AI Framework
9. RAG Knowledge Base
10. Agent Marketplace

---

## 2. Long-tail Keywords(长尾关键词 · 30 个)

低竞争 + 高转化,布局在 README 正文、Use Cases、博客文章 H2/H3。

1. open source ai agent platform with multi-tenant
2. self-hosted chatgpt alternative with 176 llms
3. langgraph mcp a2a triple stack ai framework
4. ai operating system 8 platforms monorepo
5. litellm gateway with rag knowledge base
6. multi-tenant row level security ai platform
7. agent marketplace open source apache 2.0
8. next.js 15 fastify 5 ai saas template
9. tauri desktop ai assistant open source
10. wxt browser extension ai agent
11. react native ai chat app template
12. taro mini program ai assistant
13. fastify 5 drizzle orm postgresql ai backend
14. ai saas boilerplate apache 2.0
15. enterprise ai assistant self-hosted
16. multi-model llm router litellm
17. rag knowledge base pgvector postgres
18. ai agent orchestration langgraph
19. mcp model context protocol server
20. a2a agent to agent protocol
21. open source alternative to dify
22. open source alternative to langflow
23. open source alternative to cozye coze
24. open source cursor alternative
25. open source claude code alternative
26. ai education platform open source
27. customer service bot framework open source
28. code generation platform self-hosted
29. developer productivity ai tools open source
30. ai monorepo turborepo pnpm workspace

---

## 3. Question Keywords(疑问句关键词 · 20 个)

匹配 Google PAA(People Also Ask)+ 语音搜索,布局在 FAQ 章节与博客。

1. what is ihui ai
2. how to self host chatgpt alternative
3. how to build ai agent platform
4. what is mcp model context protocol
5. how to use langgraph for ai agents
6. how to deploy multi-tenant ai platform
7. what is a2a agent to agent protocol
8. how to integrate litellm gateway
9. how to build rag knowledge base with postgres
10. why use open source ai platform
11. how many llms does litellm support
12. what is the best open source chatgpt alternative
13. how to build ai agent marketplace
14. how to create multi-tenant ai saas
15. what is ai operating system
16. how to run ai agent locally
17. how to build ai customer service bot
18. how to deploy ai platform on kubernetes
19. what is row level security in ai platform
20. how to monitor ai agents with grafana

---

## 4. Comparison Keywords(对比关键词 · 10 个)

布局在"与同类项目对比"章节 + 博客对比文章,捕获评估阶段搜索流量。

1. ihui ai vs dify
2. ihui ai vs fastgpt
3. ihui ai vs langflow
4. ihui ai vs ragflow
5. ihui ai vs coze
6. ihui ai vs langchain
7. ihui ai vs claude code
8. ihui ai vs cursor
9. open source chatgpt alternative vs chatgpt
10. litellm gateway vs openai api

---

## 5. Platform-specific Keywords(平台专属关键词 · 30 个)

按 8 端拆分,每端 3-5 个,布局在各端文档与对应平台搜索(LangChain Hub / Tauri Apps / WXT Docs 等)。

### Web(Next.js 15)
1. next.js 15 ai saas template
2. next.js 15 react 19 ai dashboard
3. next.js 15 tailwind 4 shadcn ai app

### API(Fastify 5)
4. fastify 5 ai api gateway
5. fastify 5 drizzle orm multi-tenant
6. fastify 5 postgresql ai backend

### AI Service(Python FastAPI)
7. fastapi langgraph litellm service
8. python ai service mcp a2a
9. fastapi ai agent orchestrator

### Desktop(Tauri)
10. tauri ai desktop app
11. tauri react ai assistant
12. tauri multi-platform ai client

### Extension(WXT)
13. wxt browser extension ai agent
14. wxt chrome extension ai assistant
15. wxt firefox extension ai

### Mobile(React Native / Expo)
16. react native ai chat app
17. expo ai assistant app
18. react native multi-model llm app

### Mini-program(Taro)
19. taro mini program ai assistant
20. taro wechat mini program ai
21. taro react ai mini app

### CLI
22. open source cli ai coding tool
23. cli ai agent alternative to claude code
24. terminal ai assistant apache 2.0
25. cli mcp server ai

### Shared Packages
26. monorepo ai shared packages turborepo
27. pnpm workspace ai monorepo
28. shared ui components ai saas

### Infra / Observability
29. ai platform grafana prometheus monitoring
30. ai platform opentelemetry jaeger tracing

---

## 6. 技术栈关键词(辅助 · 用于技术内容 SEO)

LiteLLM | Drizzle ORM 0.38 | PostgreSQL 15 | pgvector | Zod 3.24 | Tailwind CSS 4 | shadcn/ui | Zustand | @tanstack/react-query 5 | Turborepo 2.3 | pnpm 9.15 | Vitest | Playwright | Locust | Prometheus | Grafana | Loki | Jaeger | OpenTelemetry | Alertmanager | Knip | Lighthouse CI

---

## 使用规范

- **README**:Primary Keywords 出现在 H1/H2 + 顶部锚点段落;Long-tail 出现在 Use Cases / Quick FAQ。
- **网站 meta**:`<meta name="keywords">` 取 Primary + 部分 Long-tail(搜索引擎已弱化,但 Bing/Yandex 仍读)。
- **社媒描述**:Twitter/X / LinkedIn / Reddit 描述用 Primary + 1-2 Long-tail + Apache 2.0 hook。
- **博客**:每篇博客主攻 1 个 Long-tail + 2-3 Question Keyword,内链回 README 对应章节。
- **避免堆砌**:同一段落同一关键词不重复超过 2 次,优先自然语言融入(符合 Google E-E-A-T)。

---

## 关联文档

- [README.md](../README.md) — 项目主入口,SEO 内容主战场
- [README.en.md](../README.en.md) — 英文版 README(英文 SEO 主战场)
- [docs/architecture.md](./architecture.md) — 系统架构(技术 SEO 内链目标)
