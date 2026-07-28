# Awesome List PR Submissions

> Last updated: 2026-07-28
>
> Purpose: Track IHUI-AI submissions to high-quality curated lists (Awesome-style) to build organic backlinks and discoverability.

## 🎉 Latest: v1.2.0 released!

- 🔗 [Release v1.2.0](https://github.com/IHUI-INF-AI/IHUI-AI/releases/tag/v1.2.0) — P0 商业化 + P1 曝光批次 + 工程治理(104 commits since v1.1.0)
- 🔗 [Release v1.1.0](https://github.com/IHUI-INF-AI/IHUI-AI/releases/tag/v1.1.0) — 5 Awesome PRs + 10 blog posts × 5 languages + 204 commits
- 🔗 [Announcement Discussion #20](https://github.com/IHUI-INF-AI/IHUI-AI/discussions/20)

## Active PRs (7 open / 3 closed)

| # | Target List | Stars | PR | Section | Status | Notes |
|---|---|---|---|---|---|---|
| 1 | punkpeye/awesome-mcp-servers | 91k | [#11005](https://github.com/punkpeye/awesome-mcp-servers/pull/11005) | Aggregators | Open ⚠️ | Bot 要求注册 Glama + 加 badge;**待评估**:IHUI-AI 是 MCP client/host 非 server,定位存疑 |
| 2 | Hannibal046/Awesome-LLM | 27k | [#759](https://github.com/Hannibal046/Awesome-LLM/pull/759) | LLM Applications | Open | Top-level entry between dspy and LangChain |
| 3 | awesome-selfhosted/awesome-selfhosted-data | 308k | [#2793](https://github.com/awesome-selfhosted/awesome-selfhosted-data/pull/2793) | Generative AI | Closed | 2026-07-27 关闭,无评论,可能定位不准(IHUI-AI 非纯 self-hosted 软件) |
| 4 | mahmoud/awesome-python-applications | 17.9k | [#235](https://github.com/mahmoud/awesome-python-applications/pull/235) | AI/ML | Open | YAML entry in projects.yaml with ai/internet/dev tags |
| 5 | steven2358/awesome-generative-ai | 12.4k | [#1128](https://github.com/steven2358/awesome-generative-ai/pull/1128) | Coding > Developer tools (DISCOVERIES) | Open | DISCOVERIES list (early-stage < 1k followers); #opensource tag; Apache 2.0 |
| 6 | punkpeye/awesome-mcp-clients | — | [#258](https://github.com/punkpeye/awesome-mcp-clients/pull/258) | MCP Clients | Open | MCP 客户端列表 — **正确的 MCP 定位**(IHUI-AI 是 MCP host/client) |
| 7 | kyrolabs/awesome-langchain | 9.4k | [#463](https://github.com/kyrolabs/awesome-langchain/pull/463) | LangChain Resources | Closed | 2026-07-28 关闭,无评论;**根因**:awesome-langchain 是 LangChain 资源,IHUI-AI 用的是 **LangGraph**(不同框架),定位错误 |
| 8 | svcvit/Awesome-Dify-Workflow | 10.7k | [#54](https://github.com/svcvit/Awesome-Dify-Workflow/pull/54) | — | Open | Dify 工作流相关 |
| 9 | awesome-rag/awesome-rag | — | [#10](https://github.com/awesome-rag/awesome-rag/pull/10) | — | Open | RAG 系统列表 |
| 10 | Shubhamsaboo/awesome-llm-apps | — | [#1040](https://github.com/Shubhamsaboo/awesome-llm-apps/pull/1040) | — | Closed | 2026-07-28 关闭,维护者明确反馈:"awesome-llm-apps 是自包含可运行教程集合,每个条目需要自己的文件夹+可运行代码,纯链接 PR 不符合格式";**机会**:维护者邀请贡献自包含示例 |

**潜在曝光**(open 7 个):~140k+ stars(mahmoud/awesome-python-applications 17.9k + steven2358/awesome-generative-ai 12.4k + Hannibal046/Awesome-LLM 27k + punkpeye/awesome-mcp-servers 91k + punkpeye/awesome-mcp-clients + svcvit/Awesome-Dify-Workflow 10.7k + awesome-rag/awesome-rag)。

## 教训与改进(2026-07-28)

### 3 个 PR 被关闭的根因

| PR | 根因 | 教训 |
|----|------|------|
| awesome-selfhosted-data #2793 | IHUI-AI 不是"用户能 self-host 的纯软件"(它是 SaaS+开源混合) | 提交前确认仓库定位 — awesome-selfhosted 收录"可本地部署的开源软件",而非"商业 SaaS 平台" |
| awesome-langchain #463 | IHUI-AI 用 LangGraph(非 LangChain) | 框架归属要精确 — awesome-langchain 收录 LangChain 生态资源,LangGraph 应去 awesome-langgraph(若存在) |
| awesome-llm-apps #1040 | 仓库是"自包含可运行教程集合" | 提交前看仓库定位 — awesome-llm-apps 每个条目需自带代码文件夹,纯 README 链接不符合 |

### 待决策:#11005 Glama 注册反馈

awesome-mcp-servers #11005(91k stars)收到 github-actions[bot] 反馈:要求在 https://glama.ai/mcp/servers 注册并加 Glama score badge。

**评估中**:IHUI-AI 本身不是 MCP server(没有提供 MCP 服务),它是 MCP **client/host**(消费 MCP 服务)。如果是这样,#11005 应该主动关闭,因为我们不在 awesome-mcp-servers 的正确分类 — 应保留 awesome-mcp-clients #258。

## Submission entries

### 1. punkpeye/awesome-mcp-servers (Aggregators section)

```
- [IHUI-INF-AI/IHUI-AI](https://github.com/IHUI-INF-AI/IHUI-AI) 📇 ☁️ 🏠 🍎 🪟 🐧 - 8-platform full-stack AI operating system (web / API / AI service / CLI / desktop / extension / mobile / miniapp) that unifies 176 LLMs (OpenAI, Anthropic, Gemini, DeepSeek, Qwen, etc.) via LangGraph + MCP + A2A. Includes RAG knowledge base, agent marketplace, multi-tenant RLS over 340 tables, 1300+ APIs. Apache 2.0 commercial-friendly. Live demo: https://ihui.ai
```

### 2. Hannibal046/Awesome-LLM (LLM Applications section)

```
- [IHUI-AI](https://github.com/IHUI-INF-AI/IHUI-AI) - 8-platform full-stack AI operating system (web/API/AI-service/CLI/desktop/extension/mobile/miniapp) unifying 176 LLMs via LangGraph + MCP + A2A. 340 tables, 1300+ APIs, Apache 2.0 commercial-friendly.
```

### 3. awesome-selfhosted-data (YAML, software/ihui-ai.yml) — closed

```yaml
name: IHUI-AI
website_url: https://ihui.ai
source_code_url: https://github.com/IHUI-INF-AI/IHUI-AI
description: 8-platform full-stack AI operating system unifying 176 LLMs via LangGraph + MCP + A2A, with multi-tenant RLS, RAG knowledge base and agent marketplace.
licenses:
  - Apache-2.0
platforms:
  - Nodejs
  - Python
  - Rust
  - Docker
  - K8s
tags:
  - Generative Artificial Intelligence (GenAI)
demo_url: https://ihui.ai
depends_3rdparty: true
```

### 4. mahmoud/awesome-python-applications (AI/ML section, projects.yaml)

```yaml
- name: IHUI-AI
  slug: ihui-ai
  description: 8-platform full-stack AI operating system unifying 176 LLMs (OpenAI, Anthropic, Gemini, DeepSeek, Qwen, GLM, Doubao, Kimi, Ollama, vLLM) via LangGraph + MCP + A2A. Includes RAG knowledge base, agent marketplace, multi-tenant RLS over 340 tables, 1300+ APIs. Apache 2.0 commercial-friendly.
  website: https://ihui.ai
  source: https://github.com/IHUI-INF-AI/IHUI-AI
  tags:
    - ai
    - internet
    - dev
  license: Apache-2.0
```

### 5. steven2358/awesome-generative-ai (Coding > Developer tools, DISCOVERIES.md)

```
- [IHUI-AI](https://github.com/IHUI-INF-AI/IHUI-AI) - Eight-platform full-stack AI operating system (web, API, AI service, CLI, desktop, browser extension, mobile, mini-program) unifying 176 large language models via LangGraph, MCP, and A2A. Includes RAG knowledge base, agent marketplace, and multi-tenant row-level security. #opensource
```

### 6. punkpeye/awesome-mcp-clients (MCP Clients)

```
- [IHUI-AI](https://github.com/IHUI-INF-AI/IHUI-AI) 📇 ☁️ 🏠 🍎 🪟 🐧 - 8-platform full-stack AI operating system with 176 LLMs (LangGraph + MCP + A2A). MCP host/client: consumes MCP servers as tools. Apache 2.0.
```

### 7. kyrolabs/awesome-langchain — closed (定位错误:LangGraph ≠ LangChain)

### 8. svcvit/Awesome-Dify-Workflow

```
- [IHUI-AI](https://github.com/IHUI-INF-AI/IHUI-AI) - 8-platform full-stack AI operating system with 176 LLMs (LangGraph + MCP + A2A). Dify alternative with multi-tenant RLS + agent marketplace. Apache 2.0.
```

### 9. awesome-rag/awesome-rag

```
- [IHUI-AI](https://github.com/IHUI-INF-AI/IHUI-AI) - 8-platform full-stack AI OS with RAG knowledge base (pgvector) + 176 LLMs (LangGraph + MCP + A2A). Apache 2.0.
```

### 10. Shubhamsaboo/awesome-llm-apps — closed (要求自包含可运行示例,纯链接不符)

## Workflow

1. **Discover**: Run `node .trae-cn/tmp/check-awesome.mjs` to evaluate candidate lists (stars, activity, archived status).
2. **Analyze**: For each candidate, fetch `README.md` + `CONTRIBUTING.md` and identify (a) section to insert, (b) entry format, (c) contribution policy (especially agent fast-track markers like 🤖🤖🤖).
   - **关键**:确认仓库的实际收录定位(是否真的收录"我们这类项目")
3. **Fork**: `POST /repos/{owner}/{name}/forks` (asynchronous; poll until ready).
4. **Edit**: Use `git clone` + local script-based edit + `git commit` + `git push -u origin add-{name}`.
5. **PR**: `POST /repos/{owner}/{name}/pulls` with title and body. For punkpeye: append `🤖🤖🤖` for fast-track opt-in.

## Rejected candidates

- **modelcontextprotocol/servers** — CONTRIBUTING.md explicitly says "We don't accept new server implementations; please use MCP Server Registry instead". Skip.
- **eugeneyan/open-llms** — Repository focuses on open-source LLM checkpoints, not platforms. IHUI-AI is an LLM platform, not an LLM. Skip.
- **agarrharr/awesome-cli-apps** — AI-generated PR 受限 + 功能 scope 不匹配。

## Future targets (TODO)

### 已确认存在的目标(优先级高)

- **awesome-langgraph**(若存在)— LangGraph 生态,正确的框架归属
- **awesome-tauri** — Desktop framework(tauri-apps/awesome-tauri)
- **awesome-react-native** — Mobile framework(jondot/awesome-react-native)
- **awesome-taro** — Mini-program framework(jd-opensource/awesome-taro)

### 平台类型扩展

- **awesome-openai** — OpenAI-compatible platforms
- **awesome-fastify** — API framework
- **awesome-postgres** / **awesome-postgresql** — PostgreSQL 生态(我们用 RLS)
- **awesome-selfhosted Chinese mirror** — 中文镜像

### 重做策略(基于教训)

- **awesome-llm-apps #1040 → 贡献示例**:维护者邀请贡献自包含可运行示例(每个示例一个文件夹 + 代码)。可以做 `examples/quick-start-llm-router/` 演示 IHUI-AI 的 LLM 路由能力
- **awesome-selfhosted-data #2793 → 重定位**:如果 IHUI-AI 提供 Docker self-host 部署(`docker-compose.yml`),可以重新提交,强调 self-host 能力

## 维护者反馈记录

### 2026-07-28 Shubhamsaboo(awesome-llm-apps)

> Thanks for sharing IHUI-AI. awesome-llm-apps is a collection of self-contained, runnable tutorials, where each entry lives in its own folder with code a reader can clone and run. This PR adds only a README link to an external repository, with no runnable code contributed here, so it does not fit the format. We also keep the list focused on individual runnable examples rather than links to external platforms or products.
>
> Closing for now. If you would like to contribute a small, self-contained example that demonstrates one specific capability with runnable code in its own folder, we would be glad to review it.

### 2026-07-27 github-actions[bot](awesome-mcp-servers)

> To ensure that only working servers are listed, we're updating our listing requirements.
>
> 1. Ensure your server is listed on Glama. Submit at https://glama.ai/mcp/servers and verify that it passes all checks.
> 2. Update your PR by adding a Glama score badge after the server description.
>
> `[![OWNER/REPO MCP server](https://glama.ai/mcp/servers/OWNER/REPO/badges/score.svg)](https://glama.ai/mcp/servers/OWNER/REPO)`

**评估**:bot 要求注册 Glama,但 IHUI-AI 是 MCP client/host 非 server,这个 PR 可能需要主动关闭(已在 awesome-mcp-clients #258 正确归类)。
