# Awesome List PR Submissions

> Last updated: 2026-07-27
>
> Purpose: Track IHUI-AI submissions to high-quality curated lists (Awesome-style) to build organic backlinks and discoverability.

## Active PRs

| # | Target List | Stars | PR | Section | Status | Notes |
|---|---|---|---|---|---|---|
| 1 | punkpeye/awesome-mcp-servers | 91k | [#11005](https://github.com/punkpeye/awesome-mcp-servers/pull/11005) | Aggregators | Open | Title uses 🤖🤖🤖 suffix to opt in to **agent fast-track** per CONTRIBUTING.md |
| 2 | Hannibal046/Awesome-LLM | 27k | [#759](https://github.com/Hannibal046/Awesome-LLM/pull/759) | LLM Applications | Open | Top-level entry between dspy and LangChain |
| 3 | awesome-selfhosted/awesome-selfhosted-data | 308k | [#2793](https://github.com/awesome-selfhosted/awesome-selfhosted-data/pull/2793) | Generative AI | Open | YAML submission; bot builds README weekly |
| 4 | mahmoud/awesome-python-applications | 17.9k | [#235](https://github.com/mahmoud/awesome-python-applications/pull/235) | AI/ML | Open | YAML entry in projects.yaml with ai/internet/dev tags |
| 5 | steven2358/awesome-generative-ai | 12.4k | [#1128](https://github.com/steven2358/awesome-generative-ai/pull/1128) | Coding > Developer tools (DISCOVERIES) | Open | DISCOVERIES list (early-stage < 1k followers); #opensource tag; Apache 2.0 |

**Total potential exposure: ~456k stars** (when all merged).

## Submission entries

### 1. punkpeye/awesome-mcp-servers (Aggregators section)

```
- [IHUI-INF-AI/IHUI-AI](https://github.com/IHUI-INF-AI/IHUI-AI) 📇 ☁️ 🏠 🍎 🪟 🐧 - 8-platform full-stack AI operating system (web / API / AI service / CLI / desktop / extension / mobile / miniapp) that unifies 176 LLMs (OpenAI, Anthropic, Gemini, DeepSeek, Qwen, etc.) via LangGraph + MCP + A2A. Includes RAG knowledge base, agent marketplace, multi-tenant RLS over 340 tables, 1300+ APIs. Apache 2.0 commercial-friendly. Live demo: https://ihui.ai
```

### 2. Hannibal046/Awesome-LLM (LLM Applications section)

```
- [IHUI-AI](https://github.com/IHUI-INF-AI/IHUI-AI) - 8-platform full-stack AI operating system (web/API/AI-service/CLI/desktop/extension/mobile/miniapp) unifying 176 LLMs via LangGraph + MCP + A2A. 340 tables, 1300+ APIs, Apache 2.0 commercial-friendly.
```

### 3. awesome-selfhosted-data (YAML, software/ihui-ai.yml)

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

## Workflow

1. **Discover**: Run `node .trae-cn/tmp/check-awesome.mjs` to evaluate candidate lists (stars, activity, archived status).
2. **Analyze**: For each candidate, fetch `README.md` + `CONTRIBUTING.md` and identify (a) section to insert, (b) entry format, (c) contribution policy (especially agent fast-track markers like 🤖🤖🤖).
3. **Fork**: `POST /repos/{owner}/{name}/forks` (asynchronous; poll until ready).
4. **Edit**: Use `git clone` + local script-based edit + `git commit` + `git push -u origin add-{name}`.
5. **PR**: `POST /repos/{owner}/{name}/pulls` with title and body. For punkpeye: append `🤖🤖🤖` for fast-track opt-in.

## Rejected candidates

- **modelcontextprotocol/servers** — CONTRIBUTING.md explicitly says "We don't accept new server implementations; please use MCP Server Registry instead". Skip.
- **eugeneyan/open-llms** — Repository focuses on open-source LLM checkpoints, not platforms. IHUI-AI is an LLM platform, not an LLM. Skip.

## Future targets (TODO)

- awesome-openai (if exists) — OpenAI-compatible platforms
- awesome-langgraph / awesome-mcp (separate lists)
- awesome-tauri (desktop framework)
- awesome-react-native (mobile)
- awesome-taro (mini-program)
- awesome-fastify (API framework)
- awesome-selfhosted Chinese mirror (if exists)
