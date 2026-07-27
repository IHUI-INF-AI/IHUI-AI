# Overseas Community Launch Posts (Reddit / Hacker News / Product Hunt)

> **Goal**: Within 1 week, post to 4 Reddit subreddits + Hacker News + Product Hunt to get first 100+ stars from international users and external backlinks (Google/Bing/AI engines weight overseas backlinks heavily).
>
> **Posting order**: r/LocalLLaMA → r/SideProject → r/selfhosted → r/opensource → Hacker News → Product Hunt (schedule 4-8h apart, avoid spam detection).
>
> **Important**: Reply to every comment within 24h. Reddit upvote ratio and HN points depend on engagement. Be humble, avoid marketing speak, accept criticism gracefully.

---

## Common Info (all platforms)

- **Project**: IHUI-AI
- **GitHub**: https://github.com/IHUI-INF-AI/IHUI-AI
- **Live Demo**: https://ihui.ai
- **License**: Apache-2.0 (commercial-friendly)
- **One-liner**: One repo to replace 40+ commercial products — 8 platforms / 176 LLMs / LangGraph+MCP+A2A / 340 tables / 1300+ APIs
- **Contact**: WeChat `ok502319984` · Email 502319984@qq.com

---

## 1. Reddit r/LocalLLaMA (highest ROI for AI projects)

> Subreddit: https://www.reddit.com/r/LocalLLaMA/
> Vibe: Technical, anti-hype, loves self-hosted LLM infra. Hates marketing speak.
> Best post time: Tue/Wed 09:00-11:00 EST (= 14:00-16:00 UTC)

### Title
```
[Open Source] IHUI-AI — Full-stack AI platform with 176 LLMs, LangGraph+MCP+A2A, 8-platform support (Apache 2.0)
```

### Body

Hi r/LocalLLaMA,

I've been building an open-source AI platform for the past X months. It's Apache 2.0, self-hostable, and tries to combine what Dify / Coze / LangChain / Cursor / Claude Code each do separately into one repo.

**GitHub**: https://github.com/IHUI-INF-AI/IHUI-AI
**Live demo**: https://ihui.ai

**What it does**:

- 8 platforms from one monorepo: Web (Next.js 15) / API (Fastify 5) / AI Service (FastAPI + LangGraph + LiteLLM + MCP) / CLI / Desktop (Tauri) / Browser Extension (WXT) / Mobile (React Native + Expo) / Mini-program (Taro)
- 176 LLMs unified routing via LiteLLM (OpenAI, Anthropic, Gemini, Qwen, DeepSeek, Kimi, Doubao, etc.)
- LangGraph + MCP + A2A tri-stack for agents
- 340 DB tables / 144 migrations / 1300+ API endpoints / 5346 tests / 63 e2e specs
- 5-language i18n with 100% key parity (zh-CN / zh-TW / en / ko / ja)
- 32+ pre-commit guards (i18n parity, rounded-full guard, commit-loss guard, multi-end sync, etc.)

**Self-host in 5 minutes**:

```bash
git clone https://github.com/IHUI-INF-AI/IHUI-AI.git
cd IHUI-AI && pnpm install
cp .env.example .env  # fill in DB + AI keys
docker compose up -d postgres redis
pnpm dev
```

**Why I built this**: Existing options each cover one slice — Dify/FastGPT do AI app orchestration, LangChain/AutoGen are just frameworks, Cursor/Claude Code only do AI coding, Stripe/Auth0 only do single SaaS capabilities. I wanted "整 car off the line" (整车下线) not just a framework — something non-technical teams could actually deploy.

**Honest tradeoffs** (please roast):
- It's huge. 340 tables is overkill if you only need AI chat — you'd only use chat/users/billing schemas.
- The 8-platform ambition means some platforms (mobile/desktop) are less polished than web/api.
- i18n is 100% key parity but translation quality varies (zh-CN is source, others are AI-translated).

Not trying to compete with anyone on precision — Dify/Cursor are more mature in their niches. The pitch is "broadest open-source AI platform, one repo, Apache 2.0, self-hostable".

If you find it interesting, a star helps: https://github.com/IHUI-INF-AI/IHUI-AI

Happy to answer any architecture / engineering questions. Criticism welcome.

---

## 2. Reddit r/SideProject

> Subreddit: https://www.reddit.com/r/SideProject/
> Vibe: Indie hackers, side projects, less technical than r/LocalLLaMA. Loves "I built X" stories.
> Best post time: Tue/Wed 10:00-12:00 EST

### Title
```
After X months of building, I open-sourced an AI platform that tries to replace 40+ commercial products (Apache 2.0)
```

### Body

Hey r/SideProject,

I've been working on IHUI-AI — an open-source AI platform that combines what 40+ commercial products do into one Apache 2.0 repo.

**Live demo**: https://ihui.ai
**GitHub**: https://github.com/IHUI-INF-AI/IHUI-AI

**What's in it**:

- 8 platforms (web, api, ai-service, cli, desktop, extension, mobile, miniapp) from one monorepo
- 176 LLMs unified routing
- LangGraph + MCP + A2A agent tri-stack
- Full SaaS stack: payments (Stripe + WeChat), auth, email, analytics, wallet, orders
- 340 DB tables, 1300+ APIs, 5346 tests
- 5-language i18n
- 14-platform CI/CD auto-publish

**The story**: [Write 200-300 words on your actual journey — why you started, what hurt, what surprised you. r/SideProject loves authentic founder stories.]

**Honest numbers**:
- 9 stars (just launched, help me change that 😅)
- 1 contributor (me)
- X months of nights/weekends
- Live demo running on https://ihui.ai

**What I learned**: [3-5 bullet points — technical lessons, not marketing.]

If you want to try it: https://ihui.ai
If you want to read the code: https://github.com/IHUI-INF-AI/IHUI-AI
If you want to chat: WeChat `ok502319984` or email 502319984@qq.com

Happy to answer any questions. Not trying to sell anything — it's Apache 2.0, take it, fork it, sell it, I don't care.

---

## 3. Reddit r/selfhosted

> Subreddit: https://www.reddit.com/r/selfhosted/
> Vibe: Self-hosting enthusiasts, docker-compose lovers, anti-SaaS. Hates cloud lock-in.
> Best post time: Wed/Thu 09:00-11:00 EST

### Title
```
[Self-hosted] IHUI-AI — Apache 2.0 AI platform (Dify/Coze alternative) you can run in 5 min with docker compose
```

### Body

Hey r/selfhosted,

If you've been looking for a self-hostable alternative to Dify / Coze / FastGPT that also does payments + auth + multi-platform, I open-sourced IHUI-AI under Apache 2.0.

**GitHub**: https://github.com/IHUI-INF-AI/IHUI-AI
**Live demo**: https://ihui.ai

**Self-host in 5 minutes**:

```bash
git clone https://github.com/IHUI-INF-AI/IHUI-AI.git
cd IHUI-AI && pnpm install
cp .env.example .env
docker compose up -d postgres redis
pnpm dev
# web: localhost:3000
# api: localhost:8802
# ai-service: localhost:8000
```

**What's included**:
- 8 platforms (web/api/ai-service/cli/desktop/extension/mobile/miniapp)
- 176 LLMs via LiteLLM (use your own OpenAI/Anthropic/local keys)
- LangGraph + MCP + A2A agents
- Full SaaS: payments (Stripe + WeChat), auth, email, analytics
- 340 tables, 1300+ APIs, 5346 tests
- 5-language i18n
- No vendor lock-in — Apache 2.0, fork-friendly

**No telemetry, no phone-home, no cloud dependency**. Bring your own DB (PostgreSQL), Redis, LLM API keys.

**Why not just use Dify/Coze?**
- Dify: great for AI app orchestration, but no payments/auth/multi-platform
- Coze: closed-source, vendor lock-in
- LangChain/AutoGen: just frameworks, not deployable products

IHUI-AI tries to be the "whole car off the line" — deployable product, not just a framework.

If you try it, would love feedback. Especially on:
- docker-compose setup pain points
- What's missing for your self-hosting use case
- Multi-tenant / SSO support (have it, but want real-world testing)

Star if useful: https://github.com/IHUI-INF-AI/IHUI-AI

---

## 4. Reddit r/opensource

> Subreddit: https://www.reddit.com/r/opensource/
> Vibe: Open source evangelism, license discussions, project showcases. Less technical, more mission-focused.
> Best post time: Tue/Wed 13:00-15:00 EST

### Title
```
I open-sourced a full-stack AI platform under Apache 2.0 — 8 platforms, 176 LLMs, 340 tables, all grep-able
```

### Body

Hey r/opensource,

After X months of building, I've open-sourced IHUI-AI under Apache 2.0 (commercial-friendly, no copyleft trap).

**GitHub**: https://github.com/IHUI-INF-AI/IHUI-AI
**Live demo**: https://ihui.ai

**Why Apache 2.0**: I wanted companies to be able to fork it, build proprietary products on top, and sell them — without GPL copyleft forcing them to open-source their differentiators. Apache 2.0 + patent grant is the most business-friendly mainstream license.

**What's in the repo** (every number grep-able):

| Metric | Value | Verify |
|--------|-------|--------|
| Platforms | 8 (web/api/ai-service/cli/desktop/extension/mobile/miniapp) | `apps/` |
| Shared packages | 12 | `packages/` |
| DB tables | 340 / 144 migrations / 100 schema files | `packages/database/src/schema/` |
| API endpoints | 1300+ | `apps/api/src/routes/` |
| Tests | 5346 + 63 e2e specs | `apps/api/tests/` + `apps/web/e2e/` |
| LLMs | 176 (via LiteLLM) | `apps/ai-service/` |
| i18n | 5 languages, 100% key parity | `apps/web/messages/` |
| Pre-commit guards | 32+ | `scripts/check-*.mjs` |

**Engineering governance** (the part I'm proudest of):
- 32+ pre-commit guards (i18n parity, rounded-full, commit-loss, multi-end sync, push-sync)
- 5-stage i18n pipeline (zero LLM API calls — AI agent translates locally)
- Weekly security audit CI
- Visual regression + Lighthouse CI

**The pitch**: Most open-source AI projects are either frameworks (LangChain, AutoGen) or single-purpose (Dify, FastGPT). IHUI-AI tries to be the broadest — 8 platforms, full SaaS stack, AI education, multi-platform publishing — all Apache 2.0.

**Honest asks**:
- 9 stars right now. Help me get to 100 this week.
- Looking for contributors, especially on mobile/desktop/extension platforms.
- If you fork it and build something, please let me know — I'd love to feature your use case.

Star: https://github.com/IHUI-INF-AI/IHUI-AI
Demo: https://ihui.ai
Contact: 502319984@qq.com or WeChat `ok502319984`

---

## 5. Hacker News

> Submit URL: https://news.ycombinator.com/submit
> Vibe: Highly technical, anti-marketing, loves "Show HN" with substance. One shot — if it flops, can't repost for months.
> Best post time: Tue-Thu 08:00-10:00 PST (= 16:00-18:00 UTC)

### Title (Show HN format required)
```
Show HN: IHUI-AI – Open-source AI platform, 8 platforms, 176 LLMs, Apache 2.0
```

### Body (HN-style, terse, technical)

Hi HN,

I open-sourced IHUI-AI [0] — a full-stack AI platform under Apache 2.0. Live demo: https://ihui.ai

The pitch: existing open-source AI projects each cover one slice — Dify/FastGPT do app orchestration, LangChain/AutoGen are frameworks, Cursor/Claude Code do AI coding, Stripe/Auth0 do single SaaS capabilities. IHUI-AI tries to combine them into one repo.

Numbers (all grep-able):
- 8 platforms from one monorepo (web/api/ai-service/cli/desktop/extension/mobile/miniapp)
- 176 LLMs via LiteLLM
- LangGraph + MCP + A2A tri-stack
- 340 DB tables, 144 migrations, 1300+ API endpoints
- 5346 tests, 63 e2e specs
- 5-language i18n with 100% key parity
- 32+ pre-commit guards

Tech stack:
- API: Fastify 5 + Drizzle ORM 0.38 + PostgreSQL
- Web: Next.js 15 + React 19 + Tailwind 4 + shadcn/ui
- AI Service: FastAPI + LangGraph + LiteLLM + MCP
- Multi-platform: Taro / Tauri / WXT / React Native + Expo + Solito
- Shared: 12 packages (database/auth/types/ui/...)

Self-host:

```
git clone https://github.com/IHUI-INF-AI/IHUI-AI.git
cd IHUI-AI && pnpm install && pnpm dev
```

Honest tradeoffs:
- It's huge. If you only need AI chat, 340 tables is overkill.
- Some platforms (mobile/desktop) are less polished than web/api.
- i18n translations are AI-generated (zh-CN is source).

Not trying to compete on precision — Dify/Cursor are more mature in their niches. The pitch is "broadest open-source AI platform, one repo, Apache 2.0, self-hostable".

Happy to answer architecture / engineering questions. Criticism welcome.

[0] https://github.com/IHUI-INF-AI/IHUI-AI

---

## 6. Product Hunt (scheduled launch)

> Submit: https://www.producthunt.com/posts/new
> Vibe: Product-focused, marketing-friendly, but technical products do well if positioned right. Launch day matters — first 4 hours determine ranking.
> Best launch day: Tue/Wed (Mon is competitive, Thu/Fri is dead, weekend is dead)

### Pre-launch checklist (do these before scheduling launch)

1. **Gallery images** (required, 1270x760):
   - Image 1: Hero — IHUI-AI logo + "8 platforms / 176 LLMs / Apache 2.0" + screenshot
   - Image 2: Architecture diagram (8 monorepo apps + 12 shared packages)
   - Image 3: Live demo screenshot (https://ihui.ai homepage)
   - Image 4: 32+ pre-commit guards screenshot
   - Image 5: 5-language i18n comparison

2. **Tagline** (60 chars max):
   ```
   Open-source AI platform — 8 platforms, 176 LLMs, Apache 2.0
   ```

3. **Description** (260 chars):
   ```
   IHUI-AI is an Apache 2.0 open-source AI platform combining 40+ commercial products into one repo: 8 platforms, 176 LLMs, LangGraph+MCP+A2A, full SaaS stack. Self-host in 5 minutes. No vendor lock-in.
   ```

4. **Maker comment** (post immediately at launch):

   Hey Product Hunt! 👋

   I'm the maker of IHUI-AI. After X months of nights/weekends, I open-sourced it under Apache 2.0.

   **What it is**: A full-stack AI platform that combines what Dify / Coze / LangChain / Cursor / Claude Code / Stripe / Auth0 / Tauri each do — into one repo.

   **Numbers** (all grep-able, no PPT):
   - 8 platforms (web/api/ai-service/cli/desktop/extension/mobile/miniapp)
   - 176 LLMs via LiteLLM
   - 340 DB tables, 1300+ APIs, 5346 tests
   - 5-language i18n with 100% parity
   - 32+ pre-commit guards

   **Why I built it**: Existing open-source AI projects are either frameworks (LangChain) or single-purpose (Dify). I wanted "whole car off the line" — deployable product, not just a framework.

   **Self-host in 5 minutes**:
   ```
   git clone https://github.com/IHUI-INF-AI/IHUI-AI.git
   cd IHUI-AI && pnpm install && pnpm dev
   ```

   Live demo: https://ihui.ai
   GitHub: https://github.com/IHUI-INF-AI/IHUI-AI

   I'm here all day — ask me anything about the architecture, the 32+ pre-commit guards, the 8-platform monorepo, or why I chose Apache 2.0 over MIT/AGPL.

   Cheers!

5. **Launch day timeline**:
   - 00:01 PST: Launch goes live
   - 00:01-04:00 PST: Critical window — get first 20 upvotes from supporters (team, friends, communities)
   - 06:00-10:00 PST: US East Coast wakes up — post to Reddit/HN cross-promotion
   - 12:00 PST: Lunch bump — maker comment reply
   - 18:00 PST: Final push — email list, Telegram/Discord announcement

### Cross-promotion (do these on launch day)

- Reddit r/SideProject: "Launched on Product Hunt today — feedback welcome"
- Twitter/X: Thread with launch tweet + 5 follow-up tweets
- LinkedIn: Personal post (not company page)
- Discord/Telegram communities you're in
- Email list (if any)

---

## Posting Schedule (1-week plan)

| Day | Platform | Time (UTC) | Notes |
|-----|----------|------------|-------|
| Mon | (prep) | — | Polish README.en.md, generate social-preview.png |
| Tue 09:00 EST | r/LocalLLaMA | 14:00 | Highest ROI, technical audience |
| Tue 21:00 EST | r/SideProject | 02:00 Wed | Indie hacker audience |
| Wed 09:00 EST | r/selfhosted | 14:00 | Self-hosting enthusiasts |
| Wed 13:00 EST | r/opensource | 18:00 | Open source evangelism |
| Thu 08:00 PST | Hacker News | 16:00 | One shot, make it count |
| Fri | (Product Hunt prep) | — | Schedule for following Tue/Wed |
| Tue/Wed | Product Hunt | 00:01 PST | Launch day, full push |

---

## Anti-Spam Rules

- **Reddit**: Same project can be posted to multiple subreddits, but space 12h+ apart, and customize title/body for each subreddit (Reddit auto-mods detect copy-paste).
- **Hacker News**: One submission per project, ever. If it flops, wait 6+ months before reposting.
- **Product Hunt**: One launch per project. Schedule carefully — first 4 hours determine ranking.
- **Cross-promotion**: Don't link to your Reddit/HN posts from each other (algorithms detect). Instead, post a separate "I launched on PH today" to Reddit.

---

## Response Templates (copy-paste for common comments)

### "How is this different from Dify/Coze/LangChain?"

> Dify/FastGPT do AI app orchestration only — no payments/auth/multi-platform. Coze is closed-source. LangChain/AutoGen are frameworks, not deployable products. IHUI-AI combines all of these + adds 8 platforms + SaaS stack + AI education. It's broader, not deeper — if you only need AI chat, Dify is more mature. If you want a full SaaS + multi-platform AI business, IHUI-AI is the only open-source option.

### "340 tables is overkill"

> Agreed, if you only need AI chat. The 340 tables cover 30+ business domains (chat/users/billing/articles/courses/marketplace/etc.). If you only use chat, you only need chat/users/billing — 3 schemas, the other 297 tables don't affect runtime. The breadth is intentional — it's a commercial platform, not a chatbot.

### "Why Apache 2.0 not MIT/AGPL?"

> Apache 2.0 has explicit patent grant (MIT doesn't) and is permissive (AGPL is copyleft). I wanted companies to be able to fork it, build proprietary products, and sell them — without GPL/AGPL forcing them to open-source their differentiators. Apache 2.0 is the most business-friendly mainstream license with patent protection.

### "Is this a PPT project?"

> No. Every number is grep-able: 340 tables → `packages/database/src/schema/`, 1300+ APIs → `apps/api/src/routes/`, 5346 tests → `apps/api/tests/`. Live demo at https://ihui.ai. Clone and `pnpm dev` in 5 minutes.

### "Why should I trust a 9-star project?"

> Fair point. I just launched. The code is the proof — 5346 tests pass, 32+ pre-commit guards, 63 e2e specs. If you don't trust it for production, fork it and learn from the architecture. Star if you find anything useful — that's how I'll grow from 9 to 1000.

---

## Expected Outcomes (1 week)

| Platform | Expected stars | Expected traffic |
|----------|----------------|------------------|
| r/LocalLLaMA (hot post) | 50-150 | 2000-5000 visits |
| r/SideProject | 20-50 | 1000-3000 |
| r/selfhosted | 20-50 | 800-2000 |
| r/opensource | 10-30 | 500-1500 |
| Hacker News (front page) | 200-1000 | 10000-50000 |
| Hacker News (flopped) | 5-20 | 200-500 |
| Product Hunt (top 5) | 100-500 | 5000-20000 |
| Product Hunt (page 2+) | 20-80 | 1000-3000 |

**1-week conservative target**: 9 → 100-300 stars, 10000+ visits, Google/Bing/AI engine indexing accelerated by external backlinks.
