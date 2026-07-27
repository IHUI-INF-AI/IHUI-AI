# IHUI-AI

<p align="center">
  <img src="apps/web/public/images/logo.png" width="140" alt="IHUI-AI Logo" />
</p>

<p align="center">
  <strong>Let Everyone Own Their Own AI Program</strong><br/>
  <sub>Open-Source AI Commercial-Grade Integrated Foundation · 5-Minute Fork-to-Production · One Repo Replaces 6 SaaS Categories</sub>
</p>

<p align="center">
  <strong>Live Demo</strong> · <a href="https://ihui.ai">https://ihui.ai</a> &nbsp;|&nbsp; <strong>GitHub</strong> · <a href="https://github.com/IHUI-INF-AI/IHUI-AI">Star ⭐ to support us</a><br/>
  <sub>8-end same-source codebase · 176 LLM models · LangGraph + MCP + A2A triple stack · Apache 2.0 — commercial-ready</sub>
</p>

<p align="center">
  <a href="README.md">简体中文</a> | <strong>English</strong>
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
  <strong>8-End Coverage</strong> · <strong>176 LLMs</strong> · <strong>LangGraph + MCP + A2A Triple Stack</strong> · <strong>14-Platform Auto-Publishing</strong> · <strong>Full-Stack AI Education</strong> · <strong>Complete Commercial Loop</strong> · <strong>5-Language i18n</strong>
</p>

<p align="center">
  <strong>340 tables · 144 migrations · 1300+ API endpoints · 21 Grafana dashboards · 33+ guardrails · 5346 API tests · 63 e2e specs</strong><br/>
  <sub>Not a slide deck, not a promise, not a placeholder — every number is grep-able in the codebase</sub>
</p>

<p align="center">
  <sub>
    <a href="README.md">简体中文</a> ·
    <a href="README.ko.md">한국어</a> ·
    <a href="README.ja.md">日本語</a>
  </sub>
</p>

<p align="center">
  <strong>China Mirrors</strong> ·
  <a href="https://gitee.com/JLSLSSZWHYXGS_0/IHUI-AI">Gitee</a> ·
  <a href="https://gitcode.com/IHUI-AI/IHUI-AI">GitCode</a>
  <br/>
  <sub>Faster clone & download for users in China, auto-synced with GitHub</sub>
</p>

---

## Table of Contents

- [Why IHUI AI](#why-ihui-ai)
- [Feature Overview (15 Modules)](#feature-overview-15-modules)
- [Comparison vs. Dify / Coze / FastGPT / ChatGPT / Claude / Notion AI](#comparison-vs-dify--coze--fastgpt--chatgpt--claude--notion-ai)
- [Quick Start](#quick-start)
- [Tech Stack](#tech-stack)
- [8-End Architecture](#8-end-architecture)
- [Monetization & Pricing](#monetization--pricing)
- [Roadmap](#roadmap)
- [License](#license)
- [FAQ](#faq)
- [Contributing](#contributing)
- [Contact](#contact)

---

## Why IHUI AI

> **One-sentence positioning**: IHUI-AI is an **Open-Source AI Commercial-Grade Integrated Foundation** — not a single AI tool, but the entire infrastructure required to build a fully commercial AI product (8-end framework + 176-model gateway + LangGraph/MCP/A2A triple stack + commercial loop + enterprise security + engineering guardrails + observability), released under Apache 2.0 so any individual, business, school, or creator can fork it and ship their own AI product in 5 minutes.

Building a commercial AI product today means stitching together 6–10 separate SaaS categories: authentication, billing, model routing, RAG, workflows, multi-end publishing, observability. That's 3–6 months of integration work before you write a single line of business logic. **IHUI-AI compresses that to 5 minutes.**

### Five differentiators rarely found together in open-source AI

| # | Capability | What others do | What IHUI-AI does |
|---|------------|----------------|-------------------|
| 1 | **8-end same-source codebase** | Dify/FastGPT ship 2 ends (Web + API). Cursor/Claude Code ship 1 end (CLI). | 8 independent codebases: Web, API, AI Service, CLI, Desktop (Tauri), Browser Extension (WXT), Mobile (RN), Miniapp (Taro) — sharing 12 packages for type-safe cross-end contracts. |
| 2 | **176 LLM models, one gateway** | ChatGPT ships OpenAI only. Coze ships ByteDance only. | LiteLLM gateway unifies 176 models across OpenAI, Anthropic Claude, Google Gemini, Qwen, DeepSeek, GLM, Ernie, Doubao, Kimi, Ollama, and 20+ more providers — with smart routing and 60% cache hit rate. |
| 3 | **LangGraph + MCP + A2A triple stack** | Langflow ships LangChain DAG only. Dify ships a custom workflow engine. | All three protocols working together: LangGraph for stateful agent workflows, MCP (Model Context Protocol) for tool-calling standardization, A2A (Agent-to-Agent) for inter-agent collaboration. |
| 4 | **Apache 2.0, commercial-ready** | Many "open-source" AI tools use AGPL or BSL (source-available, not open source). | True Apache 2.0 — no copyleft, no viral clauses, no commercial restrictions. Fork it, brand it, sell it, ship it. Your data, your servers, your rules. |
| 5 | **Complete commercial loop prebuilt** | Stripe alone is $84/mo. Auth0 is $35/mo. Mailgun is $35/mo. | VIP / subscriptions / wallet / credits / refunds / invoices / 8 payment gateways / commission / referral — a financial-grade commercial loop, included. |

### Who is this for

| Role | Use case |
|------|----------|
| **Individual developers** | Private AI assistant + knowledge base — replaces ChatGPT Team + Claude Code + Notion AI subscriptions |
| **SMBs** | AI middle-platform with RBAC, departmental isolation, billing, and BI dashboards |
| **AI service providers** | Multi-model proxy + billing + subscriptions + agent marketplace — ship a commercial product in a week, not a year |
| **Schools & universities** | Full AI education stack: courses, question banks, exams, live streaming (SRS), certificates |
| **Content creators** | One-click publishing to 14 platforms (WeChat Official Account, Zhihu, CSDN, Xiaohongshu, Bilibili, YouTube, Douyin, etc.) |
| **Enterprise decision-makers** | Self-hosted enterprise AI platform with RBAC, RLS, SSO, AES-256-GCM, GDPR, 2FA |

### Cost reality check

The same capability stack costs **~$1,013/month** across 9 SaaS subscriptions (Stripe + Auth0 + Mailgun + Mixpanel + ChatGPT Team + Claude Code + Dify + Coursera for Business + 蚁客). IHUI-AI self-hosted: **$0/month** plus your own server (~$30/mo VPS). Three-year savings: **$35,000+**, with 100% data sovereignty.

---

## Feature Overview (15 Modules)

Grouped by user role. Every module below ships with code, tests, and at least one running endpoint — not a roadmap promise.

### A. AI Capability Layer (for end users)

#### A1. 176-Model Unified Gateway

One LiteLLM gateway, 176 models, smart routing with 60% cache hit rate, streaming over SSE + WebSocket.

| Category | Models |
|----------|--------|
| **International** | OpenAI GPT · Anthropic Claude · Google Gemini · xAI Grok · Groq · OpenRouter · Mistral · StepFun |
| **Chinese** | Zhipu GLM · Qwen · Doubao · DeepSeek · Kimi (Moonshot) · Baichuan · Yi · MiniMax |
| **Cloud providers** | Alibaba Cloud · Tencent Cloud · Huawei Cloud · Volcengine · Baidu AI Cloud · AWS Bedrock · Azure OpenAI |
| **Local** | Ollama · vLLM · LM Studio (OpenAI-compatible endpoints) |
| **Modalities** | Text · Image · Voice (STT + TTS) · Video · Embeddings · 3D digital humans (Tencent Hunyuan) |

#### A2. LangGraph + MCP + A2A Triple Stack

The heart of the platform — three orchestration protocols working as one:

| Stack | Capability | Implementation |
|-------|------------|----------------|
| **LangGraph** | Stateful agent workflows (plan → execute → summarize), stub mode for no-API-key development | `services/langgraph_service.py` · `agent_graph.py` · `agent_loop.py` · `agent_orchestrator.py` |
| **MCP** (Model Context Protocol) | 22 built-in tools (browser control, computer control, file ops, code search, web search, git, db query) + project-level MCP + mcp-extended | `routers/mcp.py` · `services/mcp_server.py` |
| **A2A** (Agent-to-Agent) | Inter-agent collaboration protocol, Redis-persisted with in-memory fallback | `routers/a2a.py` · `services/a2a_service.py` |
| **Vector memory** | Embedding + cosine similarity semantic search, cross-session long-term memory via pgvector (no separate vector DB needed) | `services/vector_memory.py` · `memory.py` |
| **RAG knowledge base** | Document vectorization · semantic search · citation tracing (native pgvector) | `services/rag.py` · `api/v1/rag.py` |
| **Knowledge graph** | Nodes + relationships, cross-document entity linking — rare in open-source AI platforms | schema `knowledge-graph.ts` |
| **Persona registry** | Custom agent personas with role definitions | `routers/personas.py` |
| **Agent Runtime** | SSE streaming + WebSocket, plan/execute/summarize + interrupt/continue/cancel | `routers/agent_runtime.py` |
| **Orchestration hub** | 6 cross-pillar playbooks (Rules/Hook/Spec/Context/Subagent/Terminal), event bus (26 event types), LLM budget governance (tiered degradation), unified telemetry (37 Prometheus metrics) | `services/orchestration_hub.py` |

#### A3. Multimodal AI Creation

| Capability | Description |
|------------|-------------|
| **Text-to-Image** | Stable Diffusion / DALL-E / Tongyi Wanxiang — multi-resolution, batch generation, favorites |
| **Image editing** | Inpainting, style transfer, background removal, HD upscaling |
| **TTS streaming** | 12+ voices, multi-language, WebSocket streaming with interrupt control |
| **ASR** | Real-time transcription, file transcription, multi-language |
| **Voice cloning** | Short audio sample → custom voice timbre |
| **Bidirectional real-time voice** | WebRTC PCM16 16kHz, ASR + LLM + TTS closed loop |
| **Text-to-Video** | Multi-model composition, video editing, transcoding |
| **AI digital humans** | Tencent Hunyuan 3D, interactive digital avatars |
| **AI career tools** | Resume optimization, mock interviews, career advice |
| **AI news feed** | Aggregation + smart summaries + model leaderboards (OpenCompass / SuperCLUE real data) + API relay directory (29 vendors) + 47-vendor one-click key import |

### B. AI Workflows & Developer Tools

#### B1. Self-Built CLI (benchmarked against Claude Code)

`apps/cli/` ships an ACP (Agentic Coding Protocol) Server + 21 commands + 36 built-in tools, embeddable in Zed / VSCode / Cursor.

**Command highlights:** `ihui` (interactive REPL) · `ihui chat` (multi-turn) · `ihui agent [task]` (autonomous multi-step, `--json` headless) · `ihui acp` (start ACP server for editor embedding) · `ihui mcp list/add/remove` · `ihui import` (24-source config import: cc-switch / codex++ / Claude / Codex / Gemini / Hermes) · `ihui skills list/show` · `ihui audit query/stats`.

**36 built-in tools:** ask-user · clipboard · codegraph · fetch-url · file-edit · git · hub/adapter · mcp-oauth · run-tests · subagent · todo-write · web-search · and more.

**Skills system:** flat-load from 4 directories (`.ihui` / `.agents` / `.claude` / `.cursor`).

#### B2. Enterprise Workspace Permissions

Three permission modes + 7-endpoint runtime interception + 60s audit timeout:

| Mode | Behavior |
|------|----------|
| `default` | Every FS call triggers a human audit popup |
| `accept-edits` | Whitelist-matched calls pass, others trigger popup |
| `bypass-permissions` | All pass (trusted environments only) |

Includes an OpenAI Codex CLI-style approval-mode switcher in the AI input box (shield icon + popover + `1/2/3` keyboard shortcuts + `/permission ask\|auto\|full` slash commands + 1-hour auto-revoke for high-risk modes + first-use confirmation dialog).

### C. Content Creation & Education

#### C1. 14-Platform Auto-Publishing

One-click publish to 14 platforms with AES-256-GCM credential encryption and 14 adapters:

- **Article platforms (7):** WeChat Official Account · Zhihu · CSDN · Juejin · Xiaohongshu · Weibo · Bilibili
- **Image platforms (2):** image galleries
- **Video platforms (5):** YouTube · Douyin · Kuaishou · Bilibili video · Xiaohongshu video

Self-media workbench with article + voiceover script dual pipelines, WebSocket real-time notifications on publish completion.

#### C2. Full-Stack AI Education

Open-source AI education stack (rare in the ecosystem — Khan Academy and Coursera are closed SaaS):

- Courses · Question banks · Exams · Live streaming (SRS) · Learning reports · Certificates
- Instructor + Student portals (12 sub-pages)
- 45-table `edu-full` schema
- Live + check-in + interaction + playback
- Learning behavior analytics + personalized recommendations

#### C3. AI News & Model Leaderboards

- AI news aggregation from 27 native RSS sources + local DailyHotApi (96.3% collection success rate)
- LLM-classified production pipeline (988 NULL → 0 NULL)
- 5 model leaderboards with real data (OpenCompass Playwright rendering + SuperCLUE Gradio)
- API relay directory (29 vendors, latency-tested, color-coded badges)
- 47-vendor one-click key import with `?prefill=` base64 redirects
- 4-language news title switching (zh / en / ja / ko)

### D. Enterprise & Operations

#### D1. Complete Commercial Loop

Financial-grade billing — rare in open-source AI platforms (Dify / FastGPT / Langflow have none):

- VIP memberships (multi-tier) · Recurring subscriptions · Wallet · Credits · Refunds with audit trail · Invoices · Multi-currency exchange rates
- 8 payment gateways (WeChat Pay · Alipay · Stripe · PayPal · etc.)
- Distribution commission + referral rewards
- Money-printing prevention: idempotency keys + transaction locks + amount re-verification + order status JOIN checks (G2/G3/G7/G8 security series)

#### D2. Enterprise Security Stack

| Layer | Implementation |
|-------|----------------|
| **Authentication** | JWT HS256 + token-family rotation + refresh blacklist (access 7d, refresh rotating) |
| **Authorization** | RBAC (5 levels) + data-scope (5 levels) + workspace 3-mode permissions |
| **Multi-tenancy** | PostgreSQL Row-Level Security (RLS) via `set_config($1, $2, true)` parameterized |
| **SSO** | OAuth2 (Google · Apple · GitHub · PKCE) |
| **Encryption** | AES-256-GCM for credentials at rest |
| **Compliance** | GDPR · 2FA · IDOR protection · 7-endpoint runtime interception |
| **Audit** | 60s timeout, full action logging |

#### D3. Agent Marketplace & Developer Center

- Multi-agent marketplace + developer center (13 sub-pages)
- Coze SDK proxy · OpenClaw · Crew integration · N8N proxy
- API Keys + SDK for customer integration
- 30% commission model for marketplace developers

#### D4. Operations & Growth

- Points · Check-in (timezone-corrected UTC+8) · Leaderboards · Lottery · Distribution · Invitations · Gamification (levels / achievements / badges)
- Customer service: tickets · live chat · feedback · help center
- BI dashboards · error dashboards · gray-release (feature flags) · i18n dashboards

### E. Engineering Infrastructure

#### E1. Three-Pillar Observability

SRE-grade observability stack — rare in open-source AI platforms (others ship basic logs at most):

| Pillar | Stack | Endpoints |
|--------|-------|-----------|
| **Metrics** | Prometheus + Node Exporter | `:8815` |
| **Dashboards** | Grafana (21 pre-provisioned dashboards) | `:8816` |
| **Logs** | Loki + Promtail | `:8818` |
| **Traces** | OpenTelemetry + Jaeger | `:8814` |
| **Alerts** | Alertmanager | `:9093` |

#### E2. Engineering Guardrails (33+ hooks)

Mechanism-level guardrails to prevent collaboration accidents — rare in open-source projects:

- **30+ pre-commit hooks** + 1 commit-msg hook: i18n parity (4 blocking) · schema drift detection · API key leak detection · rounded-full CSS guard · icon-text vertical alignment · translation quality (opencc / character range / broken-machinetranslation detection) · commit-loss prevention (reflog reset detection + dangling commit detection + lost-commit tag backup)
- **11 migration audits** · post-commit auto-push · pre-push typecheck
- **9 PowerShell dev scripts** for Windows one-click startup

#### E3. 5-Language i18n with Parity

`zh-CN` / `zh-TW` / `en` / `ko` / `ja` — 99.7% key-set parity, guarded by 8 scripts (4 web + 4 extension):
- opencc glyph detection (zh-TW blocking)
- character range detection (ko blocking)
- broken machine-translation detection (en blocking)
- key parity validation (blocking)
- AI translation pipeline (i18n-diff → AI agent translates → i18n-apply, zero LLM API calls, 70%+ cost reduction)

#### E4. Database & Testing

- **PostgreSQL 15**: 340 tables · 144 migrations · 100+ schema files · pgvector · FTS5 full-text search · RLS multi-tenant isolation
- **API tests**: 5346 cases (Vitest)
- **E2E**: 63 specs (Playwright)
- **AI service**: pytest + Locust load testing + Lighthouse performance

---

## Comparison vs. Dify / Coze / FastGPT / ChatGPT / Claude / Notion AI

> Functional coverage comparison (not accuracy/performance benchmarking). Mobile users: focus on the IHUI-AI column and "Key takeaway" below.

| Dimension | IHUI-AI | OpenAI ChatGPT | Dify | FastGPT | Coze (扣子) | Claude Code | Notion AI |
|-----------|---------|----------------|------|---------|------------|-------------|-----------|
| **Category** | 6-category integrated foundation | General AI chat | AI app dev platform | RAG + knowledge base | AI agent SaaS | AI coding CLI | AI writing assistant |
| **License** | **Apache 2.0** | Closed source | Apache 2.0 | Apache 2.0 | **Closed source** | **Closed source** | **Closed source** |
| **Self-hosting** | **Full self-host** | Not supported | Docker | Docker | Not supported | N/A | N/A |
| **End coverage** | **8 ends** | 2 ends (Web/App) | 2 ends | 2 ends | 2 ends | 1 end (CLI) | 1 end (Web) |
| **Model access** | **176 models + LiteLLM** | OpenAI only | 50+ models | 30+ models | ByteDance only | Anthropic | OpenAI |
| **Workflow engine** | **LangGraph + MCP + A2A** | None | Custom workflow | None | Custom workflow | None | None |
| **Self-built CLI** | **21 commands + 36 tools + ACP** | None | None | None | None | Native CLI | None |
| **Multi-tenant + RBAC** | **Full (5-level + RLS)** | Single user | Basic | Basic | SaaS-internal | None | None |
| **Billing & subscriptions** | **Full (VIP/wallet/credits/8 gateways)** | Subscription ($20-200) | None | None | SaaS-internal | None | Subscription ($10-20) |
| **AI education** | **Full-stack (courses/exams/live SRS/45 tables)** | None | None | None | None | None | None |
| **Content publishing** | **14 platforms + 14 adapters** | None | None | None | None | None | None |
| **Observability** | **3-pillar + 21 dashboards** | - | Basic | Basic | - | None | - |
| **Engineering guardrails** | **33+ hooks + 11 audits + auto-push** | - | Basic | Basic | - | None | - |
| **i18n** | **5-language parity + 8 guardrails** | Multi-language | zh/en | zh/en | Multi-language | English only | Multi-language |
| **Database** | **340 tables + 144 migrations + RLS + pgvector** | SaaS-internal | Basic | Basic | SaaS-internal | None | SaaS-internal |
| **Monthly cost (5 users)** | **$0** (self-host, server only) | $125+ | $59+ | $0 (self-integrate) | SaaS-internal | $100 | $50+ |

### Key takeaway

**IHUI-AI does not aim to replace any single project — it open-sources the 6 categories of infrastructure required to build a complete AI product.**

- vs. **ChatGPT**: IHUI-AI is fully self-hosted with 100% data sovereignty, plus billing/education/publishing. ChatGPT is closed SaaS.
- vs. **Dify / FastGPT**: IHUI-AI adds 6 more ends, a self-built CLI, a complete commercial loop, AI education, 14-platform publishing, enterprise security, and SRE observability.
- vs. **Coze (扣子)**: IHUI-AI is fully self-hosted with 100% data sovereignty and Apache 2.0. Coze is closed SaaS — your data goes to ByteDance.
- vs. **Claude Code**: IHUI-AI's CLI does coding *and* integrates the full AI application platform (chat / RAG / agents / billing), all Apache 2.0.
- vs. **Notion AI**: IHUI-AI is an entire AI application foundation, not just a writing assistant embedded in a notes app. Notion AI is a closed feature.

**One-line summary**: IHUI-AI is the open-source integrated stack of ChatGPT (chat) + Dify (orchestration) + Claude Code (CLI) + Khan Academy (education) + Stripe (billing) + 蚁客 (publishing).

> **Core insight**: In the global open-source AI ecosystem, you can find projects **more specialized** than IHUI-AI (RAGFlow goes deeper on RAG, Claude Code is more mature on CLI, LangChain is more flexible as a framework). But you won't find an open-source foundation **more complete** than IHUI-AI — integrating 6 capability categories in one Apache 2.0 repo is our core differentiator.

---

## Quick Start

### Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | `>=20.10.0` | LTS 20.x recommended, `nvm use` |
| pnpm | `>=9.0.0` | Pinned to `pnpm@9.15.0`, `corepack enable` auto-activates |
| Python | `3.12+` | Only for `apps/ai-service` |
| PostgreSQL | `15+` | Compose uses `postgres:15-alpine` |
| Redis | `7+` | Compose uses `redis:7-alpine` |
| Docker | `24+` + Compose v2 | Optional but recommended for one-click startup |
| Git | `2.40+` | `core.autocrlf=false` (project enforces LF) |

### Option 1: Docker Compose one-click (recommended)

```bash
# 1. Clone
git clone https://github.com/IHUI-INF-AI/IHUI-AI.git IHUI-AI && cd IHUI-AI

# 2. Configure environment
cp .env.example .env
# Edit .env: set JWT_SECRET / DB_PASSWORD / CREDENTIALS_ENCRYPTION_KEY

# 3. One-click start (7 business + 7 monitoring = 14 services)
docker compose up -d
```

**Service endpoints:**

| Service | URL | Notes |
|---------|-----|-------|
| Web | http://localhost:8801 | Next.js frontend |
| API | http://localhost:8802/api/health | Fastify backend health check |
| Worker | http://localhost:8830 | BullMQ async task process |
| AI Service | http://localhost:8803/health | FastAPI AI service health check |
| Grafana | http://localhost:8816 | Default admin / change password (21 dashboards auto-provisioned) |
| Prometheus | http://localhost:9091 | Metrics collection |
| Jaeger UI | http://localhost:8814 | Distributed tracing |
| Loki | http://localhost:8818 | Log aggregation |
| Alertmanager | http://localhost:9093 | Alert routing |

### Option 2: Local dev mode

```bash
# 1. Install dependencies
corepack enable && corepack prepare pnpm@9.15.0 --activate
pnpm install

# 2. Start database + Redis
docker compose up -d db redis

# 3. Migrate + validate + seed
pnpm --filter @ihui/database db:migrate
pnpm --filter @ihui/database db:check
pnpm --filter @ihui/database seed          # 7-step idempotent seed

# 4. Start all apps (turbo parallel)
pnpm dev
# Or start individually:
# pnpm --filter @ihui/api run dev          # backend :3002
# pnpm --filter @ihui/web run dev          # frontend :3001
# cd apps/ai-service && uv sync && uvicorn app.main:app --reload --port 3003

# 5. Full validation (typecheck + lint + test)
pnpm turbo build typecheck lint test
```

### Windows one-click (9 PowerShell scripts)

```powershell
.\scripts\dev-up.ps1                    # Start web + api + ai-service + DB + Redis
.\scripts\dev-all.ps1                   # Dev servers only (DB already running)
.\scripts\dev-web.mjs                   # Web only
.\scripts\kill-dev-servers.ps1          # Stop all dev servers
.\scripts\restart-dev-server.ps1        # Restart dev servers
.\scripts\test-admin-e2e.ps1            # Admin E2E tests
.\scripts\setup-token-refresh-task.ps1  # Configure token refresh scheduled task
.\scripts\cleanup-external-junk.ps1     # Clean external junk files
.\scripts\cleanup-memory-topics.ps1     # Clean memory topics
```

### 5 typical scenarios

1. **Individual developer — private AI assistant**: Clone → `docker compose up -d` → 5 minutes later you have a 176-model chat UI, private RAG knowledge base, cross-end sync (Web + Desktop + Mobile + Miniapp), and a self-built coding CLI. Replaces ChatGPT Team + Claude Code + Notion AI subscriptions, saves $60+/month.

2. **SMB — AI middle-platform**: 200 employee accounts with RBAC, departmental workspace isolation, 7 LLM providers with smart routing (cheapest model wins), departmental chargeback with invoices, BI dashboards for usage, audit logs for compliance.

3. **AI service provider — commercial product**: Reuse the multi-model proxy + billing + subscriptions + VIP + wallet + credits. Launch an agent marketplace, take 30% commission. Issue API keys + SDK for customer integration. Use 14-platform publishing for content marketing. Ship in a week, not a year.

4. **School — transform teaching**: Import courses + question banks into the AI education stack. Students review via live (SRS) playback. Teachers use AI for grading + learning reports. Live + check-in + interaction + playback. Behavior analytics + personalized recommendations. Auto-issued certificates.

5. **Content creator — productivity unleashed**: Write WeChat Official Account articles + voiceover scripts in the self-media workbench. One-click publish to 14 platforms. Credentials AES-256-GCM encrypted — no platform leaks. WebSocket real-time notifications on publish completion.

---

## Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| **Monorepo** | pnpm workspace + Turborepo | pnpm 9.15 / turbo 2.3 |
| **Backend API** | Fastify + @fastify/jwt + @fastify/websocket + Drizzle ORM + PostgreSQL | Fastify 5.1 / Drizzle 0.38 / PG 15 |
| **Cache & queue** | Redis 7 + BullMQ | Independent worker process (`:8081`) |
| **Frontend Web** | Next.js + React + Tailwind CSS + shadcn/ui | Next 15.1 / React 19 / Tailwind 4 |
| **Frontend state** | @tanstack/react-query 5 + Zustand | Server + client state separation |
| **i18n** | next-intl | zh-CN / zh-TW / en / ko / ja (5 languages) |
| **AI Service** | FastAPI + LangGraph + LiteLLM + MCP + A2A + Socket.IO | FastAPI 0.115 / LangGraph 0.2 |
| **AI protocols** | SSE (agent streaming) + WebSocket (chatroom / multi-model streaming) + REST | Three-protocol layering |
| **Desktop** | Tauri 2 + Rust (WebView loads Web `output: 'export'` static export) | Shell architecture, native cross-platform |
| **Browser extension** | WXT + React | Chrome / Edge / Firefox |
| **Mobile** | React Native + Expo EAS | iOS / Android |
| **Miniapp** | Taro 4 + React | WeChat Mini Program |
| **CLI** | Node.js + Commander + Inquirer | Benchmarked against Claude Code |
| **Auth** | @ihui/auth shared package (JWT HS256 + token-family + OAuth2 + RBAC + data-scope 5 levels) | Cross-end unified issuance |
| **Validation** | Zod 3.24 (backend) + React Hook Form (frontend) | End-to-end type safety |
| **Logging** | Pino 9.5 (backend) + Python logging (AI service) + Loki + Promtail | Structured + aggregated |
| **Tracing** | OpenTelemetry + Jaeger | Distributed full-link |
| **Monitoring** | Prometheus + Grafana (21 dashboards) + Node Exporter + Alertmanager | Host + app + alerts |
| **Testing** | Vitest (backend) + Playwright (E2E) + pytest (AI service) + Locust (load) + Lighthouse (perf) | 5346 + 400+ cases |
| **Dead code detection** | Knip | CI guardrail |
| **Node** | `>=20.10.0` | - |
| **Python** | `3.12+` (AI service only) | - |

---

## 8-End Architecture

> Port convention: all dev/host-mapped ports use the `88xx` range (see [docs/port-management.md](docs/port-management.md)), `strictPort: true` to prevent drift; container-internal ports unchanged.

```
                ┌──────────────────────────────────────────────────────────────┐
                │      User / Enterprise / Developer / School / Creator        │
                └────────────┬─────────────────────────────────┬───────────────┘
                             │                                 │
    ┌────────────────────────┼─────────────────────────────────┼────────────────────────┐
    │                        │                                 │                        │
┌───▼────┐  ┌──────────┐  ┌──▼───────┐  ┌──────────────▼┐  ┌──────────┐  ┌──▼────────┐
│  Web   │  │ Desktop  │  │Extension │  │  Mobile RN    │  │ Miniapp  │  │   CLI    │
│ Next 15│  │ Tauri 2  │  │  WXT     │  │  Expo EAS     │  │ Taro 4   │  │ Node.js  │
│ :8801  │  │ web/out  │  │          │  │  :8805        │  │ :8804    │  │ ACP+Skl  │
│ strict │  │ + Rust   │  │          │  │  iOS/Android  │  │ WeChat MP│  │ 21 cmds  │
└───┬────┘  └────┬─────┘  └────┬─────┘  └──────┬────────┘  └────┬─────┘  └────┬─────┘
    │            │             │                │                │             │
    └────────────┴─────────────┴────────┬───────┴────────────────┴─────────────┘
                                        │  HTTPS / WebSocket / SSE / ACP
                               ┌────────▼─────────┐
                               │   apps/api       │  Fastify 5 + Drizzle ORM
                               │   :8802 strict   │  1300+ endpoints + 12 WS + 95 routes
                               │                  │  + Developer API Key /v1/* 105 endpoints
                               └────┬───────┬─────┘
                                    │       │
         ┌──────────────────────────▼─┐   ┌─▼──────────────────────────┐
         │  PostgreSQL 15             │   │  apps/ai-service            │  FastAPI + Socket.IO
         │  ├─ 340 tables / 144 mig  │   │  :8803 strict               │  LangGraph + LiteLLM + MCP + A2A
         │  ├─ pgvector vector index  │   │                             │  + triple stack + P3 deep layer
         │  ├─ FTS5 full-text search  │   │  ├─ 31+ providers + 16 IM   │  + 14 publish adapters
         │  └─ RLS multi-tenant iso   │   │  ├─ 6 sandbox backends      │  + 22 MCP tools
         └────────────────────────────┘   │  ├─ Skill self-evolution    │
                                            │  ├─ Memory (pgvector+FTS5) │
                                            │  └─ 30+ providers + MoA    │
                                            └────┬────────────────────────┘
                                                 │
                               ┌────────────────┼────────────────┐
                               │                │                │
                         ┌─────▼─────┐    ┌─────▼─────┐    ┌─────▼─────┐
                         │  Redis 7  │    │  Worker   │    │ OTel +    │  Jaeger :8814
                         │ Pub/Sub   │    │  BullMQ   │    │ Prometheus│  Grafana :8816
                         │ :8811     │    │  :8830    │    │ :8815     │  Loki :8818
                         └───────────┘    └───────────┘    └───────────┘
```

### 8-End responsibilities

| End | Directory | Stack | Responsibility |
|-----|-----------|-------|----------------|
| **Web** | `apps/web/` | Next.js 15 + React 19 | Main frontend, 200+ pages, 5-language i18n, PWA, SEO, `output: 'export'` static export loaded by Desktop WebView (shell architecture) |
| **API** | `apps/api/` | Fastify 5 + Drizzle | Business management + multi-vendor proxy + auth + WebSocket, ~1300 endpoints / 95+ route files |
| **AI Service** | `apps/ai-service/` | FastAPI + LangGraph + Socket.IO | LLM gateway + agent execution + MCP tools + A2A protocol + 14 publish adapters, ~55 endpoints |
| **Desktop** | `apps/desktop/` | Tauri 2 + Rust | Shell architecture: Tauri WebView loads Web static export. 25+ `#[tauri::command]` native capabilities (tray + single instance + autostart + global hotkeys + deep links + native notifications + file access + clipboard + computer control screenshot/mouse/keyboard) |
| **CLI** | `apps/cli/` | Node.js + Commander | Self-built CLI coding assistant, 21 commands + 36 tools + ACP Server + 24-source config import |
| **Extension** | `apps/extension/` | WXT + React | Browser extension: context menu + sidebar + Chrome/Edge/Firefox |
| **Mobile** | `apps/mobile-rn/` | React Native + Expo EAS | iOS / Android native apps + SSO |
| **Miniapp** | `apps/miniapp-taro/` | Taro 4 + React | WeChat Mini Program, native WeChat Pay integration + 3-language i18n |

### Shared packages (12)

| Package | Purpose |
|---------|---------|
| `@ihui/auth` | Cross-end JWT + OAuth2 + RBAC unified issuance |
| `@ihui/database` | Drizzle ORM schema + 340 tables + 144 migrations |
| `@ihui/types` | Cross-end TypeScript contracts (WorkPanelTab / ToolCallEvent / P3 types / SharedUser) |
| `@ihui/ui-react` | Web + extension shared UI (Card / Button / Resizable / WorkPanel) |
| `@ihui/ui-native` | React Native shared UI primitives |
| `@ihui/design-tokens` | Cross-end design tokens (colors / radius / fonts / animations / 10 breakpoints) — single source of truth |
| `@ihui/app` | RN ↔ Web cross-end shared screens (About / Profile / Settings) via Solito + StyleSheet |
| `@ihui/config` | Shared ESLint / TSConfig / Tailwind presets |
| `@ihui/i18n` | Cross-end i18n utilities |
| `@ihui/api-client` | Type-safe API client with onToolCall callbacks |
| `@ihui/eslint-config` | Shared ESLint rules |
| `@ihui/tsconfig` | Shared TSConfig |

### Project status matrix

Each end ships with real code, tests, and a running dev server — not a placeholder.

| End | Maturity | Pages / Endpoints | Key features live |
|-----|----------|-------------------|-------------------|
| **Web** (`apps/web`) | 🟢 Production | 200+ pages · 5-language i18n · PWA · SEO | Full admin console · AI chat · RAG · agent marketplace · billing · education · publishing · BI dashboards |
| **API** (`apps/api`) | 🟢 Production | 1300+ endpoints · 95 route files · 12 WS | Auth · RBAC · billing · 8 payment gateways · multi-tenant RLS · developer API keys |
| **AI Service** (`apps/ai-service`) | 🟢 Production | ~55 endpoints · 12 routers | LangGraph · MCP (22 tools) · A2A · 31+ providers · 6 sandbox backends · 14 publish adapters · 16 IM channels |
| **CLI** (`apps/cli`) | 🟢 Production | 21 commands · 36 tools · ACP Server | Interactive REPL · agent mode · MCP management · 24-source config import · skills · audit |
| **Desktop** (`apps/desktop`) | 🟢 Production | Tauri 2 + Rust shell · 25+ native commands | Tray · single instance · autostart · global hotkeys · deep links · native notifications · computer control |
| **Extension** (`apps/extension`) | 🟢 Production | Chrome/Edge/Firefox · sidebar + context menu | 5-language i18n · agent action bridge · content script executor · screenshot回传 |
| **Mobile** (`apps/mobile-rn`) | 🟡 Beta | iOS/Android · 3 shared screens | SSO · AboutScreen · ProfileScreen · SettingsScreen (cross-end shared via `@ihui/app`) |
| **Miniapp** (`apps/miniapp-taro`) | 🟡 Beta | WeChat Mini Program · 3-language i18n | WeChat Pay native integration · auth · core browse |

Legend: 🟢 Production (running on the commercial platform) · 🟡 Beta (core flows working, feature parity in progress)

### Cross-end shared layers

To prevent drift across 8 ends, three single-source-of-truth layers are enforced:

- **Design tokens**: `packages/design-tokens/src/styles/tokens.css` — one `@theme` block (colors / radius / fonts / animations / 10 breakpoints) consumed by both Web and Extension via `@import`. Change once, both ends update.
- **i18n**: Web uses `next-intl` (587 namespaces / 28,800 lines JSON); Extension uses self-built Context runtime (5 languages × 17 namespaces). Both guarded by 8 parity scripts (4 web + 4 extension) with opencc / character range / broken-machinetranslation detection.
- **RN ↔ Web shared screens**: `packages/app/` provides `AboutScreen` / `ProfileScreen` / `SettingsScreen` as platform-agnostic components via Solito + StyleSheet + RN primitives, with 5 design tokens (brand / surface / text / border / error).

---

## Monetization & Pricing

IHUI-AI is **Apache 2.0 open source** — self-hosting is forever free. For teams that want a managed/hosted offering, we provide four tiers:

| Tier | Price | Target | Highlights |
|------|-------|--------|------------|
| **Free** | $0 (self-host) | Individual developers, students, hobbyists | Full 8-end codebase, 176 models, all 15 modules — no feature gating |
| **Pro** | ¥49/mo (~$7/mo) | Power users, freelancers | Hosted web + API + AI service · 5GB vector storage · 100K monthly tokens · priority community support |
| **Team** | ¥199/user/mo (~$28/user/mo) | SMBs, small teams (5-50 users) | Everything in Pro · multi-tenant RBAC · departmental billing · 100GB vector storage · 5M monthly tokens · SLA 99.5% · email + WeChat support |
| **Enterprise** | ¥2999/mo+ (~$420/mo+) | Enterprises, schools, AI service providers | Everything in Team · unlimited users · on-premise deployment · custom model fine-tuning · dedicated Grafana · SLA 99.9% · 24/7 support · dedicated account manager · custom integrations |

### Revenue model

- **Self-hosted open-source**: 100% free forever — Apache 2.0, no vendor lock-in
- **Managed cloud**: Pro/Team/Enterprise subscriptions (above)
- **Marketplace commission**: 30% from agent marketplace developer sales
- **Enterprise services**: Custom deployment, fine-tuning, integration consulting
- **Education partnerships**: AI education stack licensing to schools and training institutions

> **Note**: Self-hosting is always free. The paid tiers are for teams that want us to run the infrastructure, not for feature access. The open-source codebase and the managed offering run on identical code.

---

## Roadmap

### Shipped (as of 2026-07-20)

- 8-end full coverage (Web / API / AI Service / CLI / Desktop / Extension / Mobile RN / Miniapp Taro)
- 176 LLM models via unified LiteLLM gateway + 31+ provider adapters
- LangGraph + MCP + A2A triple stack + Persona + Agent Runtime + vector memory
- Self-built CLI: 21 commands + 36 tools + ACP Server + 24-source config import
- Workspace permissions 3 modes + 7-endpoint runtime interception + 60s audit timeout
- Self-media workbench (article + voiceover script dual pipelines) + Skills system
- 14-platform one-click auto-publishing + 14 adapters + AES-256-GCM credential encryption
- Full-stack AI education (courses / question banks / exams / live streaming SRS / reports / certificates / 45-table schema)
- Multi-agent marketplace + developer center (13 sub-pages) + Coze SDK proxy + OpenClaw + Crew + N8N
- Community features (circles / plaza / DMs / follow / share)
- Growth loops (points / check-in / leaderboards / lottery / distribution / referrals / gamification)
- Complete commercial billing loop (VIP / subscriptions / wallet / credits / refunds / invoices / exchange rates / 8 payment gateways)
- Customer support (tickets / live chat / feedback / help center)
- BI dashboards + error dashboards + gray-release + i18n dashboards
- 5-language i18n parity + 19-tool i18n toolchain + 4 guardrails
- Full observability stack (Prometheus + Grafana 21 dashboards + Loki + Promtail + Jaeger + OpenTelemetry + Alertmanager)
- 30+ pre-commit guardrails + post-commit auto-push + 11 migration audits + 9 PowerShell startup scripts
- Enterprise security (RBAC + multi-tenant + RLS + SSO + AES-256-GCM + JWT token-family + CSRF + XSS + GDPR + 2FA)
- 340 database tables + 144 migrations + 12 shared packages + pgvector + knowledge graph + Knip + Lighthouse + Locust

### Recent highlights (2026-07-22)

1. **In-chat embedded browser work panel** (8-end sync, P0→P3++ 4 phases): resizable panel + multi-tab + favorites + history + drag-sort + iframe smart fallback + Playwright screenshot engine + multi-round tool loop with iteration badges
2. **Native browser control + computer control MCP tools** (5-end sync): 22 new MCP tools (12 `browser_control.*` + 10 `computer_control.*`) + cross-end executors (extension content script + desktop Tauri commands) + multi-round tool loop with hallucination guards
3. **P3 deep layer (surpassing Hermes Agent on 11 dimensions)**: agent loop fix + Skill self-evolution closed loop + unified 3-end memory + IM platform gateway (16 platforms) + multi-agent debate + MCP sampling reverse-call + 6 sandbox backends (Local/Docker/SSH/Modal/Daytona/Singularity) + MoA presets + multimodal input + memory deep layer (pgvector + FTS5 + decay + vector persistence) + self-evolution deep layer (auto-testing + feedback tracking + quality gate) + scheduling deep layer (DAG + 4 strategies + watchdog + worktree isolation + ResourceMonitor + NetworkEgressPolicy)
4. **Deep robustness hardening** (85 items across 5 rounds): auth security core (7) + MCP security (6) + API backend security (8) + web frontend security (3) + desktop/extension/mobile/miniapp tightening (6)
5. **CLI Wave 1 + Wave 2**: LSP integration + Client/Server architecture + TUI terminal UI + 4-layer memory + dream mode + Plan-Build-Review tri-mode + undo-redo-share + Subagent peer collaboration
6. **Billing fund security** (G2→G8 series): money-printing prevention + idempotency + transaction locks + CrewAI bypass fix + rechargeToken order status verification
7. **AI news feed refinement**: 27 native RSS sources + 96.3% collection success rate + LLM classification (988 NULL → 0 NULL)

### Next up

- **Mobile RN feature parity** with Web (currently lags on admin console + agent marketplace)
- **Desktop offline mode** with local LLM (Ollama) fallback
- **Extension sidebar agent** with full MCP tool surface
- **Miniapp Taro WeChat Pay** production hardening
- **More IM channels**: Slack, Discord, Telegram bots (currently 16 channels, targeting 25+)
- **More sandbox backends**: E2B, Fly Machines (currently 6, targeting 8)
- **Fine-tuning UI**: LoRA/QLoRA fine-tuning pipeline in the web console
- **A2A protocol v2**: Standardized agent discovery + capability negotiation
- **Multi-region deployment**: Active-active cluster mode for enterprise tier

> Full task plan and progress tracking lives in [PROJECT_PLAN.md](PROJECT_PLAN.md) (Chinese).

---

## License

[Apache License 2.0](LICENSE) — free to use, modify, distribute, and commercialize, with no copyleft restrictions.

### What this means

- ✅ **Commercial use**: Sell it, brand it, ship it as your product — no restrictions
- ✅ **Closed-source derivatives**: Your modifications can stay closed-source
- ✅ **No copyleft**: No viral license clauses, no requirement to open-source your changes
- ✅ **Patent grant**: Explicit patent grant from contributors
- ✅ **Self-hosting**: 100% data sovereignty, no vendor lock-in

> Unlike "source-available" or BSL-licensed projects that restrict commercial use, IHUI-AI is true open source under the OSI-approved Apache 2.0 license.

---

## FAQ

### Is this really open source? Can I use it commercially?

Yes. IHUI-AI is licensed under **Apache 2.0** — the same license used by Kubernetes, Android, and most major open-source projects. You can fork it, brand it, sell it, and ship it as your own commercial product. Your modifications can stay closed-source. There is no copyleft, no viral clause, no "source-available" restriction. The only requirements are: keep the license notice, and state any significant changes you make to the source files.

### How is this different from Dify / FastGPT / Langflow?

Dify, FastGPT, and Langflow are excellent **AI application orchestration platforms** — they help you build chatbots and workflows. IHUI-AI is an **integrated AI commercial foundation**: it includes everything those projects offer (chat, RAG, workflows, agents), plus 6 additional ends (CLI, desktop, extension, mobile, miniapp), a complete commercial billing loop, AI education, 14-platform content publishing, enterprise security, and SRE-grade observability. If you only need AI chat orchestration, Dify is more focused. If you want to ship a complete commercial AI product, IHUI-AI is designed for that.

### How is this different from LangChain / LangGraph / LlamaIndex?

LangChain, LangGraph, and LlamaIndex are **developer frameworks** — they give you the parts to build AI applications (chains, agents, retrievers). IHUI-AI uses LangGraph as one of its three orchestration stacks, but wraps it in a complete product: 8 ends, billing, auth, RBAC, UI, database schema, migrations, observability, and 15 business modules. Frameworks are "car parts"; IHUI-AI is a "rolling car off the assembly line" — non-technical teams can use it directly.

### Do I need to pay for OpenAI / Anthropic API keys?

Yes — you bring your own LLM API keys (OpenAI, Anthropic, Google, Qwen, DeepSeek, etc.). IHUI-AI routes requests through LiteLLM to 176 models across 30+ providers. The platform itself is free; you only pay for the LLM tokens you consume, directly to the model providers. For local-only setups, Ollama and vLLM are supported — zero cloud API cost.

### Can I self-host this on my own servers?

Yes — that's the primary deployment model. `docker compose up -d` starts all 14 services (7 business + 7 monitoring). Your data stays on your servers, encrypted with AES-256-GCM. There is no phone-home, no telemetry to us, no external dependency on our infrastructure. The managed cloud tiers (Pro/Team/Enterprise) are optional — for teams that want us to run the infrastructure.

### How many people do I need to run this in production?

For a small deployment (< 100 users): 1 DevOps engineer familiar with Docker + PostgreSQL + Redis. For a medium deployment (100-1000 users): 1 DevOps + 1 backend developer. The platform is designed to be operated, not just developed — Grafana dashboards, Alertmanager rules, and structured logging are pre-configured.

### What's the database story?

Single PostgreSQL 15 database (`ihui`), 340 tables across 30+ business domains, 144 migrations managed by Drizzle ORM. Multi-tenant isolation via Row-Level Security (RLS) using parameterized `set_config($1, $2, true)`. Vector search via native pgvector extension (no separate vector DB needed). Full-text search via FTS5. Knowledge graph via dedicated schema.

### Is there a managed / hosted version?

Yes — see the [Monetization & Pricing](#monetization--pricing) section. Pro (¥49/mo) for individuals, Team (¥199/user/mo) for SMBs, Enterprise (¥2999/mo+) for large orgs. Self-hosting is always free with the full feature set — the paid tiers are for teams that want us to run the infrastructure.

### How do I contribute?

PRs are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines. The project has 30+ pre-commit hooks to maintain code quality — read [AGENTS.md](AGENTS.md) for the engineering rules (in Chinese, English translation in progress). Key areas needing contribution: mobile RN feature parity, more IM channel adapters, more sandbox backends, English documentation improvements.

### What about data privacy and GDPR?

All data stays on your servers when self-hosted. Credentials (passwords, OAuth secrets, API keys, payment credentials) are encrypted with AES-256-GCM. The platform supports GDPR data export and deletion requests. Audit logs capture all sensitive actions with 60s timeout. 2FA is supported. IDOR protection is built into all endpoints. No data is ever sent to our servers — the open-source codebase has no phone-home telemetry.

### Documentation navigation

| Document | Purpose |
|----------|---------|
| [README.md](README.md) | Chinese README (primary, most up-to-date) |
| [PROJECT_PLAN.md](PROJECT_PLAN.md) | Task plan & progress tracking (Chinese) |
| [AGENTS.md](AGENTS.md) | Engineering rules & agent guidelines (Chinese) |
| [docs/architecture.md](docs/architecture.md) | System architecture deep-dive |
| [docs/port-management.md](docs/port-management.md) | Port registry (88xx range) |
| [docs/lost-commit-archive.md](docs/lost-commit-archive.md) | Commit-loss prevention archive |
| [LICENSE](LICENSE) | Apache 2.0 full text |

---

## Contributing

PRs are welcome — this is an open-source project built by and for the community.

### Development workflow

```bash
# 1. Fork & clone
git clone https://github.com/<your-username>/IHUI-AI.git
cd IHUI-AI

# 2. Install dependencies
corepack enable && pnpm install

# 3. Create a feature branch
git checkout -b feat/your-feature

# 4. Develop (the 30+ pre-commit hooks will guide you)
pnpm dev                                      # Start all services
pnpm turbo build typecheck lint test          # Validate before commit

# 5. Commit (follow conventional commits: feat / fix / docs / chore / test / refactor)
git add <your-files>                          # Stage ONLY your files (never `git add .`)
git commit -m "feat(web): add your feature"

# 6. Push & open a PR
git push origin feat/your-feature
```

### Code quality bar

- **TypeScript strict** across all 8 ends — no `any` without justification
- **Zod validation** on all API request params — runtime safety, not just compile-time
- **i18n parity** — any new i18n key must be added to all 5 languages (zh-CN / zh-TW / en / ko / ja)
- **No rounded-full** — the project enforces specific radius gradients (see [AGENTS.md](AGENTS.md) §4)
- **Tests required** for new API endpoints (Vitest) and critical UI flows (Playwright E2E)
- **Migration required** for any schema change — `pnpm --filter @ihui/database db:generate`

### Areas needing contribution

- 🌍 **English documentation** — many docs are Chinese-only, translation help wanted
- 📱 **Mobile RN feature parity** — admin console + agent marketplace on mobile
- 🔌 **More IM channel adapters** — Slack, Discord, Telegram bots (targeting 25+ channels)
- 🐳 **More sandbox backends** — E2B, Fly Machines (targeting 8 backends)
- 🎨 **Theme contributions** — dark mode polish, accessibility improvements
- 📝 **Tutorials & examples** — cookbook-style guides for common use cases

---

## Contact

<p align="center">
  <strong>Join the IHUI-AI community and build the future of AI with us</strong>
</p>

<table align="center">
  <tr>
    <td align="center" width="33%">
      <img src="apps/web/public/footer/erweima/footer-icon-2.png" width="180" alt="Official App QR" />
      <br/>
      <strong>Official App</strong>
      <br/>
      <sub>Scan to try IHUI-AI App</sub>
    </td>
    <td align="center" width="33%">
      <img src="apps/web/public/footer/erweima/wechat-vx.png" width="180" alt="Official WeChat QR" />
      <br/>
      <strong>Official WeChat</strong>
      <br/>
      <sub>WeChat ID: <code>ok502319984</code></sub>
    </td>
    <td align="center" width="33%">
      <img src="apps/web/public/footer/erweima/community-group.jpg" width="180" alt="Community Group QR" />
      <br/>
      <strong>Community Group</strong>
      <br/>
      <sub>Scan to join the developer community</sub>
    </td>
  </tr>
</table>

### Company information

| Field | Details |
|-------|---------|
| **Company** | Jilin Aizhihui Artificial Intelligence Technology Co., Ltd. (吉林省爱智汇人工智能科技有限公司) |
| **Brand** | Zhihui AI Group (智汇 AI 集团) |
| **Address** | No. 107 Yueda Road, High-Tech Zone, Changchun, Jilin, China · AI Talent Incubation Base |
| **Phone** | +86 186-4338-9808 |
| **Email** | 502319984@qq.com |
| **WeChat** | ok502319984 (search in WeChat to add) |
| **ICP Filing** | 吉ICP备2025027274号 |
| **Copyright** | © 2025 Zhihui AI Group · China |

### Community & external platforms

| Platform | Link |
|----------|------|
| GitHub Org | https://github.com/AIZHS2025 |
| X (Twitter) | https://x.com/ok502319984 |
| Facebook | https://www.facebook.com/share/17kQMPNhQb/ |
| Issue tracker | https://github.com/IHUI-INF-AI/IHUI-AI/issues |
| Pull requests | https://github.com/IHUI-INF-AI/IHUI-AI/pulls |

> For partnership inquiries, enterprise onboarding, or technical exchange, scan the WeChat QR code above or email 502319984@qq.com — we reply within 24 hours.

### Acknowledgments

IHUI-AI wouldn't exist without these open-source projects:

- [Next.js](https://nextjs.org/) · [React](https://react.dev/) · [Tailwind CSS](https://tailwindcss.com/) · [shadcn/ui](https://ui.shadcn.com/)
- [Fastify](https://fastify.dev/) · [Drizzle ORM](https://orm.drizzle.team/) · [FastAPI](https://fastapi.tiangolo.com/)
- [LangGraph](https://langchain-ai.github.io/langgraph/) · [LiteLLM](https://litellm.vercel.app/) · [MCP](https://modelcontextprotocol.io/)
- [Turborepo](https://turbo.build/) · [pnpm](https://pnpm.io/) · [Vitest](https://vitest.dev/) · [Playwright](https://playwright.dev/) · [Locust](https://locust.io/)
- [Tauri](https://tauri.app/) · [Taro](https://taro-docs.jd.com/) · [WXT](https://wxt.dev/) · [Expo](https://expo.dev/)
- [Prometheus](https://prometheus.io/) · [Grafana](https://grafana.com/) · [Loki](https://grafana.com/loki) · [Jaeger](https://www.jaegertracing.io/) · [OpenTelemetry](https://opentelemetry.io/) · [Alertmanager](https://prometheus.io/docs/alerting/latest/alertmanager/)
- [Knip](https://knip.dev/) · [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)

Thank you to every contributor who keeps this project evolving.

---

<p align="center">
  <sub>Built by <strong>Jilin Aizhihui AI Technology Co., Ltd.</strong> · Open-source, together we build</sub>
</p>

<p align="center">
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI">⭐ Star us on GitHub</a> · <a href="https://github.com/IHUI-INF-AI/IHUI-AI/fork">🍴 Fork to build your own</a> · <a href="https://github.com/IHUI-INF-AI/IHUI-AI/issues">💬 Request a feature</a>
</p>

---

## SEO Keywords

<sub>
AI agent platform · LLM orchestration · RAG · Retrieval-Augmented Generation · MCP · Model Context Protocol · A2A · Agent-to-Agent · LangGraph · LiteLLM · open source ChatGPT alternative · self-hosted AI platform · Apache 2.0 AI · AI commercial foundation · multi-model gateway · 176 LLMs · OpenAI · Anthropic Claude · Google Gemini · Qwen · DeepSeek · GLM · Ernie · Doubao · Kimi · Ollama · AI education platform · 14-platform publishing · Tauri · WXT · Taro · React Native · Next.js 15 · Fastify 5 · FastAPI · 8-end architecture · AI agent marketplace · RBAC multi-tenant · pgvector · knowledge graph · vector memory · self-evolving agents · sandbox backends · Modal · Daytona · observability stack · Prometheus · Grafana · Jaeger · OpenTelemetry · i18n parity · 5-language internationalization
</sub>
