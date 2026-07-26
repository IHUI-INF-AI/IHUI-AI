# Awesome 列表 PR 提交清单

> 目标:把 IHUI AI 提交到 GitHub 上的 awesome-* 列表,获取反向链接 + 社区曝光。每个 awesome 列表都有 PR 流程,本文件提供完整的提交清单和 PR 文案模板。

---

## 一、目标 Awesome 列表(20 个)

### AI 平台/框架类(8 个)

| # | 仓库名 | Star 数 | 提交位置 | 优先级 |
| --- | --- | --- | --- | --- |
| 1 | `sindresorhus/awesome` | 340K+ | `readme.md` → AI section | P0 |
| 2 | `e2b-dev/awesome-ai-agents` | 15K+ | `README.md` → Open Source | P0 |
| 3 | `marmelab/awesome-chatgpt` | 3K+ | `README.md` → Open Source Alternatives | P1 |
| 4 | `steven2358/awesome-chatgpt` | 4K+ | `README.md` → Open Source | P1 |
| 5 | `KilnAI/awesome-local-llms` | 2K+ | `README.md` → Platforms | P1 |
| 6 | `Shubhamsaboo/awesome-llm-apps` | 3K+ | `README.md` → Open Source | P1 |
| 7 | `pseudoyu/awesome-ai-tools` | 1K+ | `README.md` → Open Source | P2 |
| 8 | `dragonnotfound/awesome-self-hosted` | 2K+ | `README.md` → AI | P2 |

### LLM/RAG/Agent 类(6 个)

| # | 仓库名 | Star 数 | 提交位置 | 优先级 |
| --- | --- | --- | --- | --- |
| 9 | `hymiee/awesome-llmops` | 2K+ | `README.md` → Open Source | P0 |
| 10 | `kyrolabs/awesome-agents` | 8K+ | `README.md` → Frameworks | P1 |
| 11 | `wandb/awesome-llm-rag` | 3K+ | `README.md` → Open Source | P1 |
| 12 | `dalinvin/awesome-llm` | 10K+ | `README.md` → Open Source | P1 |
| 13 | `microsoft/ai-agents-for-developers` | 5K+ | `README.md` → Open Source | P2 |
| 14 | `humanlayer/awesome-human-llm-interaction` | 1K+ | `README.md` → Tools | P2 |

### 开源/自托管类(4 个)

| # | 仓库名 | Star 数 | 提交位置 | 优先级 |
| --- | --- | --- | --- | --- |
| 15 | `awesome-selfhosted/awesome-selfhosted` | 200K+ | `README.md` → AI | P0 |
| 16 | `Code-Ya/awesome-open-source` | 5K+ | `README.md` → AI | P2 |
| 17 | `lorien/awesome-open-source-alternatives` | 3K+ | `README.md` → AI | P1 |
| 18 | `RunaCapital/awesome-oss-alternatives` | 15K+ | `README.md` → AI/ML | P1 |

### 中文社区类(2 个)

| # | 仓库名 | Star 数 | 提交位置 | 优先级 |
| --- | --- | --- | --- | --- |
| 19 | `jobbole/awesome-java` | 3K+ | `README.md` → AI Tools | P2 |
| 20 | `ithena/awesome-cn-ai` | 1K+ | `README.md` → Open Source | P2 |

---

## 二、PR 文案模板

### 通用 PR 标题

```
Add IHUI-AI — 8-end open-source AI platform (176 models, LangGraph+MCP, Apache 2.0)
```

### 通用 PR 描述

```markdown
## What is IHUI-AI?

IHUI-AI is an open-source, 8-end (Web / API / AI Service / CLI / Desktop / Browser Extension / Mobile / Miniapp) AI operating system. It's a commercial-grade integrated platform written in TypeScript (Next.js 15 + Fastify 5) + Python (FastAPI).

### Key Features

- **8 ends same-source codebase** — one pnpm monorepo outputs 8 platforms
- **176 LLM models** — OpenAI / Claude / Gemini / Qwen / DeepSeek / GLM / Ollama (via LiteLLM)
- **LangGraph + MCP + A2A triple stack** — agent orchestration + tool calling + agent-to-agent
- **RAG knowledge base** — pgvector + hybrid retrieval (vector + fulltext + rerank)
- **Agent marketplace** — build, publish, and monetize AI agents
- **Enterprise-grade** — 340 DB tables, 144 migrations, 1300+ API endpoints, 5346 tests
- **Apache 2.0** — commercial-ready, no viral license

### Comparison

| | Dify | Coze | FastGPT | **IHUI-AI** |
| --- | --- | --- | --- | --- |
| 8 ends | ❌ | ❌ | ❌ | ✅ |
| 176 models | 50+ | limited | 30+ | **176** |
| MCP protocol | beta | ❌ | ❌ | ✅ |
| A2A protocol | ❌ | ❌ | ❌ | ✅ |
| Self-host | ✅ | ❌ | ✅ | ✅ |
| License | Apache 2.0 | proprietary | Apache 2.0 | **Apache 2.0** |

### Links

- GitHub: https://github.com/IHUI-INF-AI/IHUI-AI
- Live demo: https://ihui.ai
- Docker Compose one-click deploy

### Checklist

- [x] Open source (Apache 2.0)
- [x] Actively maintained (daily commits)
- [x] Documentation included
- [x] Working demo available
- [x] Not a duplicate of existing entry
```

### 中文版 PR 描述(用于中文 awesome 列表)

```markdown
## IHUI-AI 是什么?

IHUI-AI 是 8 端全栈 AI 操作系统(Web / API / AI Service / CLI / Desktop / Extension / Mobile / Miniapp),Apache 2.0 开源。

### 核心亮点

- **8 端同源**:一个 pnpm monorepo 输出 8 个平台
- **176 大模型**:OpenAI / Claude / Gemini / 通义 / DeepSeek / 智谱 / 文心 / 豆包 / Ollama
- **三栈协议**:LangGraph(编排)+ MCP(工具)+ A2A(Agent 间通信)
- **RAG 知识库**:pgvector + 混合检索(向量+全文+重排)
- **Agent 市场**:构建、发布、变现 AI Agent
- **企业级**:340 表 / 144 迁移 / 1300+ API / 5346 测试

### 链接

- GitHub: https://github.com/IHUI-INF-AI/IHUI-AI
- 在线 Demo: https://ihui.ai
- Docker Compose 一键部署

### 对标

ChatGPT Team / Dify / Coze / FastGPT / n8n 的开源替代方案,价格仅 ChatGPT 的 30%。
```

---

## 三、提交条目格式(添加到 awesome 列表的位置)

### 英文列表格式

```markdown
- [IHUI-AI](https://github.com/IHUI-INF-AI/IHUI-AI) - 8-end open-source AI platform with 176 LLM models, LangGraph + MCP + A2A triple stack, RAG knowledge base, and agent marketplace. Apache 2.0.
```

### 中文列表格式

```markdown
- [IHUI-AI](https://github.com/IHUI-INF-AI/IHUI-AI) - 8 端全栈 AI 操作系统,176 大模型 + LangGraph+MCP+A2A 三栈 + RAG 知识库 + Agent 市场。Apache 2.0 开源。
```

### 分类建议(根据列表结构选择)

| 列表类型 | 建议分类 |
| --- | --- |
| awesome(总列表) | AI / Machine Learning / Tools |
| awesome-ai-agents | Open Source / Frameworks |
| awesome-selfhosted | AI / Automation |
| awesome-llm | Open Source / Frameworks |
| awesome-chatgpt | Open Source Alternatives |

---

## 四、提交流程(每个列表)

1. **Fork** 目标仓库
2. **Clone** fork 到本地
3. **编辑** README.md,在合适分类下添加 IHUI-AI 条目(按字母序)
4. **Commit**:`Add IHUI-AI — 8-end open-source AI platform`
5. **Push** 到 fork
6. **Create PR**:使用上面的 PR 描述模板
7. **等待审核**(通常 1-7 天)
8. **回复审核意见**(如有)

### 注意事项

- 严格遵守每个列表的 Contributing Guidelines
- 条目格式必须和列表现有格式一致(dash/space/link/description)
- 按字母序插入(不要插到末尾)
- 一个 PR 只加一个条目(不要批量加)
- 描述简明扼要(一行,不超过 120 字符)
- 不要在 PR 里堆砌营销话术(awesome 列表审核者反感)

---

## 五、效果追踪

| 列表 | PR 链接 | 状态 | 合并日期 | 引流 star |
| --- | --- | --- | --- | --- |
| awesome | — | ⏳ 待提交 | — | — |
| awesome-ai-agents | — | ⏳ 待提交 | — | — |
| awesome-selfhosted | — | ⏳ 待提交 | — | — |
| awesome-llm | — | ⏳ 待提交 | — | — |
| awesome-chatgpt | — | ⏳ 待提交 | — | — |

**目标**:20 个列表中至少 10 个合并成功,带来 200+ 反向链接和 100+ star。

---

## 六、额外资源提交

### 除了 awesome 列表,还可以提交到:

| 平台 | 类型 | 提交方式 |
| --- | --- | --- |
| [AlternativeTo](https://alternativeto.net) | 软件替代 | 添加 IHUI-AI 作为 ChatGPT/Dify/Coze 的替代 |
| [Product Hunt](https://producthunt.com) | 产品发布 | 准备 Launch Day |
| [SaaSHub](https://saashub.com) | SaaS 目录 | 添加 IHUI-AI |
| [Open Source Builders](https://github.com/osbuilders) | 开源生态 | 提交项目 |
| [GitHub Topics](https://github.com/topics) | GitHub 主题 | 添加 topics(需 admin 权限) |
| [HackerNews "Who is hiring"](https://news.ycombinator.com) | 社区 | 月初发 "Show HN" |

### 提交到 AlternativeTo 的文案

```
IHUI-AI is an open-source, self-hosted alternative to ChatGPT Team, Dify, and Coze. It provides 8-end coverage (Web, API, CLI, Desktop, Extension, Mobile, Miniapp), 176 LLM model support, LangGraph + MCP + A2A agent orchestration, RAG knowledge base, and an agent marketplace. Apache 2.0 licensed, commercial-ready.
```
