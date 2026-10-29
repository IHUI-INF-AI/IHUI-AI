<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

> ⚠️ **Copyright & Commercial Licensing Notice**
>
> © 2026 **IHUI AI (智汇AI)** · Copyright owner: **Li Chunchuan (李春川)** · https://aizhs.top
>
> - Dual licensing: open-source use under **Apache-2.0** (copyright notice and NOTICE must be retained); **closed-source commercial use, rebranding, or SaaS resale** requires a separate commercial license.
> - All source files in this repository are embedded with provenance watermarks (visible banners + invisible zero-width steganography; verify with `node scripts/watermark.mjs decode <file>`). Removing watermarks does not change copyright ownership; unauthorized commercial use is technically traceable and legally actionable.
> - CI enforces watermark verification (`pnpm watermark:check`); any change that strips watermarks fails the build.

# IHUI-AI

<p align="center">
  <img src="apps/web/public/images/logo.png" width="140" alt="IHUI-AI Logo" />
</p>

<p align="center">
  <strong>Self-hosted full-stack AI platform</strong>: multi-model chat · OpenAI-compatible API relay · multi-platform account pool · check-in &amp; keepalive · Agent/MCP · RAG &amp; publishing · 8 clients + CLI
</p>

<p align="center">
  <strong>Online Demo</strong> · <a href="https://aizhs.top">https://aizhs.top</a> &nbsp;|&nbsp; <strong>GitHub</strong> · <a href="https://github.com/IHUI-INF-AI/IHUI-AI">Star this repo</a><br/>
  <sub>Model gateway + Agent orchestration + multi-tenant backend + 8 frontend ends · Apache-2.0 (retain NOTICE) · fork and self-host</sub>
</p>

<p align="center">
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI/actions/workflows/ci.yml"><img src="https://github.com/IHUI-INF-AI/IHUI-AI/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI/actions/workflows/build.yml"><img src="https://github.com/IHUI-INF-AI/IHUI-AI/actions/workflows/build.yml/badge.svg" alt="Build" /></a>
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI/actions/workflows/e2e.yml"><img src="https://github.com/IHUI-INF-AI/IHUI-AI/actions/workflows/e2e.yml/badge.svg" alt="E2E" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue.svg" alt="License: Apache-2.0" /></a>
</p>

<p align="center">
  <sub>
    <a href="README.md">简体中文</a> · <a href="README.en.md">English</a> · <a href="README.ko.md">한국어</a> · <a href="README.ja.md">日本語</a>
  </sub>
</p>

---

> **This file is an index layer.** Capability-first intro, live-computed numbers, quick start, and nine topic archives under [`docs/engineering/`](./docs/engineering). Engineering rules: [`AGENTS.md`](./AGENTS.md).

## On this page

- [What you can do](#what-you-can-do) · [What this is not](#what-this-is-not) · [Key numbers](#key-numbers-live-computed) · [Nine topic documents](#nine-topic-documents-verbatim-archives-from-the-old-root-readme) · [The 8 ends](#the-8-ends-plus-one-shell) · [Quick start](#-quick-start)

---

## Key numbers (live-computed)

**These numbers are not hand-copied.** The single algorithm lives in
[`scripts/gen-doc-numbers.mjs`](./scripts/gen-doc-numbers.mjs); the gate
[`scripts/check-doc-numbers.mjs`](./scripts/check-doc-numbers.mjs) re-computes them for this file and the Chinese README.

```bash
pnpm doc:numbers
node scripts/gen-doc-numbers.mjs --markdown
node scripts/check-doc-numbers.mjs --worktree
```

Use the table keys only (`llmModels`, `publishPlatforms`, `apiRoutes`, …)—do not paste stale counts in prose.

<!-- BEGIN GENERATED NUMBERS (node scripts/gen-doc-numbers.mjs --markdown) -->
| 指标 | 现值 | 取数键 |
| ---- | ---- | ------ |
| 数据库表 | 612 | `dbTables` |
| schema 文件 | 237 | `dbSchemaFiles` |
| API 路由 | 4608 | `apiRoutes` |
| 路由文件 | 649 | `apiRouteFiles` |
| AI 服务路由 | 616 | `aiServiceRoutes` |
| WebSocket 端点 | 25 | `wsEndpoints` |
| 入库模型清单 | 99 | `llmModels` |
| 发布平台 | 38 | `publishPlatforms` |
| 端应用包 | 9 | `appPackages` |
| 共享包 | 16 | `sharedPackages` |
| CLI 命令文件 | 67 | `cliCommandFiles` |
| CLI 工具文件 | 72 | `cliToolFiles` |
| 语言 | 5 | `i18nLanguages` |
| i18n 作用域 | 7 | `i18nScopes` |
| 语言包 JSON | 35 | `i18nMessageFiles` |
| 测试文件 | 3547 | `testFiles` |
| CI 工作流 | 51 | `ciWorkflows` |
| Compose 服务 | 14 | `composeServices` |
| 工程守门 | 298 | `guardianGates` |
| — blocking | 272 | `guardianBlocking` |
| — warn | 28 | `guardianWarn` |
| 跟踪文件 | 17546 | `trackedFiles` |

上表由 `node scripts/gen-doc-numbers.mjs --markdown` 生成,最后核对日期 2026-10-29。
每个数的来源就写在取数键旁边的实现里(`scripts/gen-doc-numbers.mjs` 的 `SOURCES`),**不得手抄、不得另立第二份**。

<!-- END GENERATED NUMBERS -->
---

## What you can do

**IHUI-AI** is a self-hostable full-stack AI platform: one backend for chat & models, **OpenAI-compatible API relay**, **account pools & scheduled check-in**, Agent/MCP/workflows, knowledge & multi-platform publishing, education & community, plus Web / desktop / app / mini-program / CLI / extension.

### Chat & models

- Multi-model chat on Web, app, mini-program, and CLI (catalog size: key `llmModels`); streaming; params, favorites, and history.
- BYOK, usage, prompts/personas; Plan-Act; task progress bar; queue reorder/withdraw/edit; multi-pane layout.
- Voice STT/TTS (incl. WebRTC); image gen/edit; video task queue; session import (Chrome/CLI).

### API relay (developer gateway)

- Developer keys and **OpenAI-compatible** `/v1/chat/completions` plus related `v1-*` APIs.
- Token/image/video billing; public vs effective pricing and peak pricing; IP/model allowlists and quotas; wallet and usage logs.
- Upstream channel routing with failover; shared key pool with weighted pick and circuit breaking.
- Route Trae / WorkBuddy / CodeArts / Qoder **IDE accounts** through the same `/v1` entry (adapter-translated upstream).

### Account pool

- **Operator pool**: import up to **12** provider kinds (`RELAY_PROVIDERS`); enable/disable, claim, health checks—**pool membership ≠ check-in**.
- **Personal pool**: user-owned accounts across Web / RN / mini-program; selection policies (weighted, expiry-first, concurrency caps, etc.).
- **CAS sync** between pool credentials and check-in assistants; refresh where the platform supports it.
- Local import via `scripts/relay-account-pool.mjs` and Trae/WorkBuddy/Qoder login-sync scripts.

### Check-in & keepalive

- **Check-in whitelist (four only)**: Trae, WorkBuddy, Qoder, MiniMax—scheduled credits; manual check-in supported.
- WorkBuddy task family (growth / travel / activity / blackcat); **keepalive center** probes cookies/JWT and does **not** check in for you.
- **No** Cursor or Claude product-account check-in. CodeArts and others may be in the pool/relay without a check-in engine.

### Gateway & egress

- **Product meaning**: multi-tenant **OpenAI-shaped API gateway** (per-key quota and billing)—not a generic arbitrary HTTP reverse-proxy console.
- Egress **proxy pool** (per-account or shared rotation); `/api/checkin/*` proxies to ai-service for all clients.

### Agent, tools & MCP

- Agent marketplace and “my agents”; workbench, timeline, kanban, canvas; plans and progress; subagent dispatch.
- Tools & skills marketplace; MCP store/projects/gateway; connectors and capability registry; workflows, automations, orchestration, schedules.

### Knowledge & publishing

- RAG, team knowledge/memory, personal memory; multi-platform publishing (count: key `publishPlatforms`; WeChat, Zhihu, Bilibili, Douyin, Xiaohongshu, CSDN, Juejin, …); calendar and analytics.

### Commerce, teams, education & community

- VIP/subscriptions, wallet, orders/refunds, invoices, points; teams/workspaces and permissions.
- Courses, exams, live lessons, certificates; plaza, Q&A, circles; optional edu-admin and parent views.

### Multi-client & developers

- Web, Tauri desktop shell, React Native, WeChat mini-program, CLI, browser extension; shared `packages/app` screens and WebView portal.
- Developer center: keys, webhooks, relay docs; route scale via `apiRoutes` / `aiServiceRoutes` / `cliCommandFiles`.

---

## What this is not

| Myth | Fact |
| --- | --- |
| “12 platforms auto check-in” | Up to 12 **pool** providers; **check-in only** Trae / WorkBuddy / Qoder / MiniMax |
| Cursor / Claude account check-in | No check-in engine in-repo; usable as LLM upstream, not this product’s check-in surface |
| “Free unlimited relay” | Billing, quotas, allowlists, and key-pool circuit breaking apply |
| “Reverse-proxy any HTTP backend” | Narrative is OpenAI gateway + pool forwarding + egress proxy pool |
| “Production RLS fully enabled” | Mostly application-layer tenant gates—do not overclaim |
| “Just a chat wrapper” | Full tenant, billing, content, and education domains |
| “One codebase compiles to 8 ends” | Independent per-end code; shared tokens and contracts |

Full positioning: [`docs/engineering/readme-01-positioning.md`](./docs/engineering/readme-01-positioning.md).

---

## Recent updates (auto-maintained)

<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->
**2026-10-28**
- 🔧 Chore/Other:两端 ui-routes 按 HEAD 检出场重生(清在飞面污染,worktree=登记制 .worktrees/) (9ef1520d2939)

**2026-10-28**
- 🔧 Chore/Other:两端 ui-routes 派生件按 HEAD 面重生(G5 陈旧清账) (7da265ab7ad4)

**2026-10-28**
- 📚 Docs:自动同步缺口账本到现读口径(镜像 237 · 缺口 11) (d56f39c1ead9)
- 🐞 Fix:壳声明件收回 HEAD 面同形(148→144 段,摘 4 枚别席未入库页的幽灵段) (a6d739f94eaa)

**2026-10-28**
- 🔧 Chore/Other:壳声明件跟随 coupon 直载页重生(148 段,含他席在飞 4 段) (a8ec51d9aa39)

**2026-10-28**
- 🚀 Feature/Improvement:小程序 member/coupon 页迁为直载承载(第 16 枚手写页出桶) (a4727217e92d)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (f8ab3ed973cf)
- 🔧 Chore/Other:自动落 1 枚小程序壳承载页(共 1 枚待产) (facfc43e4b24)

**2026-10-28**
- 🚀 Feature/Improvement:agents/edit 落共享源并接 RN 宿主(P0 跨端对齐第一枚) (bc1cfb81133f)

**2026-10-28**
- 🔧 Chore/Other:词包派生件跟承载补键重生成(remote +2 键族, b64 载荷与 manifest 同步) (c8ab98610f4d)

**2026-10-28**
- 🚀 Feature/Improvement:券/讲师共享屏落地新出口(条件渲染零像素)+规划器提示等价并入共享屏面(toastCovered/toastFullyCovered 增 sharedText 维:词条住在共享屏而壳装载它时不再误判'壳没有该提示';出口 appAlert/Toast 仍须住壳;S22 成对钉自检 28/28,三镜像 24/24,RN typecheck 6/6) (e3eec689604b)

**2026-10-28**
- 🚀 Feature/Improvement:共享屏补两枚交互出口 + 词包五语言同批补键 (559cd4c826b8)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (c35f4089c52b)

**2026-10-28**
- 🔧 Chore/Other:词包派生件按 HEAD 面重生成(承载补键 2370→2667) (bc42b94f7c1a)

**2026-10-28**
- 🐞 Fix:承载键算式补裸字面量键表识别 + K6 用例补全 (a033a290e16c)
- 🔧 Chore/Other:壳声明件跟随新落承载页(142 条说明符) (8c5a67af32ae)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (460c1d930050)
- 📚 Docs:自动同步缺口账本到现读口径(镜像 236 · 缺口 11) (aeed408107ff)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (88aab4bc3ea2)
- 🔧 Chore/Other:自动落 1 枚小程序壳承载页(共 1 枚待产) (fcaaf5553d05)
- 🔧 Chore/Other:edu/dashboard 改判 aligned;settings/login-security 记录「只剩 passkey」 (ea003326f763)
- 🚀 Feature/Improvement:补「教育看板」屏 —— 单端点 /api/edu/dashboard,挂「学习」分区入口 (0cb8caafa61b)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (47f51483e9e8)

**2026-10-28**
- 🔧 Chore/Other:edu/dashboard 改判 aligned;settings/login-security 记录「只剩 passkey」 (ea003326f763)
- 🚀 Feature/Improvement:补「教育看板」屏 —— 单端点 /api/edu/dashboard,挂「学习」分区入口 (0cb8caafa61b)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (47f51483e9e8)

**2026-10-28**
- 🚀 Feature/Improvement:安全中心补「重新生成恢复码」—— MFA 恢复码在 RN 侧此前完全没有入口 (511b2c40c17a)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (40fbbaa48d9d)
- 🔧 Chore/Other:壳声明件跟随新落承载页(141 条说明符) (8eb003c1542c)
- 📚 Docs:自动同步缺口账本到现读口径(镜像 235 · 缺口 11) (89836bfa485a)
- 🔧 Chore/Other:给 member/settings 记 domainAudit —— 与 web 的有意分歧(web 页接的是坏路由) (79cbe1403e6a)
- 🔧 Chore/Other:自动落 1 枚小程序壳承载页(共 1 枚待产) (1dfd0f7af7b6)

**2026-10-28**
- 🔧 Chore/Other:agents/my 改判 aligned —— 我的智能体列表已有真承载 (65781503efdb)
- 🚀 Feature/Improvement:补「我的智能体」列表屏 —— 走 /api/agents/my,入口挂「我的」页新分区 (97ede8727378)
- 🔧 Chore/Other:自动落 1 枚小程序壳承载页(共 1 枚待产) (19742a8618ab)
- 🔧 Chore/Other:member/dashboard 改判 aligned —— 会员中心首页已有真承载(组合取数) (ec53c4324a65)
- 🚀 Feature/Improvement:补「会员中心首页」屏 —— 四卡 + 有效期 + 最近订单,数据按真身组合 (dc683835ed7f)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (a0e55b091b4b)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (a10d03d3dcef)
- 🔧 Chore/Other:member/settings 改判 aligned + 三条 gap 写入本轮 recon 结论 (fa89b2c08244)
- 🔧 Chore/Other:壳声明件跟随新落承载页(139 条说明符) (5c8373e37828)
- 🔧 Chore/Other:自动落 1 枚小程序壳承载页(共 1 枚待产) (d6b9f48b6fb2)
- 🚀 Feature/Improvement:补「会员偏好」屏(通知四档 + 隐私三开关),并刻意不复用 web 那条坏路由 (e3a9e8b1489b)
- 🔧 Chore/Other:壳声明件跟随新落承载页(138 条说明符) (7c5c46e2bbe0)
- 📚 Docs:自动同步缺口账本到现读口径(镜像 232 · 缺口 11) (59d28079c77d)
- 🔧 Chore/Other:security-audit 改判 aligned —— RN 侧已有真承载(共享屏+宿主+入口) (ee40bb0ba0bd)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (bb20b4fea8ca)
- 🔧 Chore/Other:自动落 1 枚小程序壳承载页(共 1 枚待产) (d7480b7a29da)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (b538c947f09b)
- 🐞 Fix:两处死传参删掉,PC 端 typecheck 转绿 —— backLabel / terminalReason 共享组件都不消费 (a11cc59c26c9)
- 🚀 Feature/Improvement:域错配队列认手核结论 —— 行内 domainAudit 一旦写下就不再重复点名 (ad223e702853)
- 🚀 Feature/Improvement:Trae 一键切号——号池账号写回本机客户端登录态 (c463501b6ac3)
- 🐞 Fix:circles/post 载体指针纠偏 —— 两端都 POST /api/circles,原指针指向社区发帖屏 (c3364c684740)
- 🐞 Fix:取回 automations 端点类型里被剥离的 terminalReason 字段(本地 A 桶纯丢失) (76fa6e82c6be)
- 🐞 Fix:正文闸的屏幕键口径漏掉驼峰命名空间 —— 40 余屏的文案面塌成 common.*，正常正文被算成"该屏渲染不出" (e2a497a8bb22)
- 🐞 Fix:OTA 卡片改按 expo-updates 原生模块存在性按需加载 —— 本机 debug APK 未编入该原生模块时,静态 import 会启动即抛 Cannot find native module 致整 App 红屏(12:49 实测复现);门内用 requireOptionalNativeModule 判存在性,缺失渲染空组件。真机实测:首页与广场正常渲染,分享徽章浮动动画、广场分类宫格图标均生效 (5fcbe332cacf)
- 🚀 Feature/Improvement:把 OTA 更新提示真正装车 —— 补回 origin 已声明的 expo 依赖并挂载 UpdatePrompt (43623513bdd4)
- 🐞 Fix:learn/[id]/homework 复位为 gap —— 课程作业与 SRS 复习是两套机制 (41bd0a41b6aa)
- 🐞 Fix:域错配队列补回行身份 —— 上一版把 web/rn 段集合覆盖到 web/rn 字段上,队列不可点 (32f4ee60cc61)
- 🐞 Fix:复位两条「能力不同物」的 aligned —— RN 全仓无 mfa/passkey,安全审计事件也零消费方 (8bbd938db43a)
- 🚀 Feature/Improvement:新增只读队列「aligned 却打不同后端域」—— 把 news 那类假对齐变成可复跑的一眼活 (2651d5e47f4b)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (60554209a256)

**2026-10-28**
- 🔧 Chore/Other:member/dashboard 改判 aligned —— 会员中心首页已有真承载(组合取数) (ec53c4324a65)
- 🚀 Feature/Improvement:补「会员中心首页」屏 —— 四卡 + 有效期 + 最近订单,数据按真身组合 (dc683835ed7f)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (a0e55b091b4b)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (a10d03d3dcef)
- 🔧 Chore/Other:member/settings 改判 aligned + 三条 gap 写入本轮 recon 结论 (fa89b2c08244)
- 🔧 Chore/Other:壳声明件跟随新落承载页(139 条说明符) (5c8373e37828)
- 🔧 Chore/Other:自动落 1 枚小程序壳承载页(共 1 枚待产) (d6b9f48b6fb2)
- 🚀 Feature/Improvement:补「会员偏好」屏(通知四档 + 隐私三开关),并刻意不复用 web 那条坏路由 (e3a9e8b1489b)
- 🔧 Chore/Other:壳声明件跟随新落承载页(138 条说明符) (7c5c46e2bbe0)
- 📚 Docs:自动同步缺口账本到现读口径(镜像 232 · 缺口 11) (59d28079c77d)
- 🔧 Chore/Other:security-audit 改判 aligned —— RN 侧已有真承载(共享屏+宿主+入口) (ee40bb0ba0bd)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (bb20b4fea8ca)
- 🔧 Chore/Other:自动落 1 枚小程序壳承载页(共 1 枚待产) (d7480b7a29da)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (b538c947f09b)
- 🐞 Fix:两处死传参删掉,PC 端 typecheck 转绿 —— backLabel / terminalReason 共享组件都不消费 (a11cc59c26c9)
- 🚀 Feature/Improvement:域错配队列认手核结论 —— 行内 domainAudit 一旦写下就不再重复点名 (ad223e702853)
- 🚀 Feature/Improvement:Trae 一键切号——号池账号写回本机客户端登录态 (c463501b6ac3)
- 🐞 Fix:circles/post 载体指针纠偏 —— 两端都 POST /api/circles,原指针指向社区发帖屏 (c3364c684740)
- 🐞 Fix:取回 automations 端点类型里被剥离的 terminalReason 字段(本地 A 桶纯丢失) (76fa6e82c6be)
- 🐞 Fix:正文闸的屏幕键口径漏掉驼峰命名空间 —— 40 余屏的文案面塌成 common.*，正常正文被算成"该屏渲染不出" (e2a497a8bb22)
- 🐞 Fix:OTA 卡片改按 expo-updates 原生模块存在性按需加载 —— 本机 debug APK 未编入该原生模块时,静态 import 会启动即抛 Cannot find native module 致整 App 红屏(12:49 实测复现);门内用 requireOptionalNativeModule 判存在性,缺失渲染空组件。真机实测:首页与广场正常渲染,分享徽章浮动动画、广场分类宫格图标均生效 (5fcbe332cacf)
- 🚀 Feature/Improvement:把 OTA 更新提示真正装车 —— 补回 origin 已声明的 expo 依赖并挂载 UpdatePrompt (43623513bdd4)
- 🐞 Fix:learn/[id]/homework 复位为 gap —— 课程作业与 SRS 复习是两套机制 (41bd0a41b6aa)
- 🐞 Fix:域错配队列补回行身份 —— 上一版把 web/rn 段集合覆盖到 web/rn 字段上,队列不可点 (32f4ee60cc61)
- 🐞 Fix:复位两条「能力不同物」的 aligned —— RN 全仓无 mfa/passkey,安全审计事件也零消费方 (8bbd938db43a)
- 🚀 Feature/Improvement:新增只读队列「aligned 却打不同后端域」—— 把 news 那类假对齐变成可复跑的一眼活 (2651d5e47f4b)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (60554209a256)
**2026-10-26**
- 📚 Docs:12 枚僵尸票批量结清——前提在 HEAD 逐条不成立:桌面 ANR 残行 55 字、G-195 三个入口脚本全在 HEAD、take_loop_v2_handoff 生产面 18 处已装车、O87g 精确挂载图已装车(本轮另补 compositeDelta 报数)、三枚归并副本指向行已归档、G-8 为副本套娃 31 层的一次性快照、G-242 残行且属禁用的等条件形态、G-948 被吞行已回补、G-66 为单点读数加等条件形态、cloudflared 运行副本与入库源逐字节等值 (9be4bfd2bb)
**2026-10-29**
- 🐞 Fix:复洁器补"未勾形态被加表头改写后回潮"这一维 —— 四道维此前结构上全够不着 (37de95181b5)
- 🔧 Chore/Other:同步本地未提交改动——新增 keepalive REST router 与 Python SDK，收紧键盘快捷键类型，清理 G-44 监控腿冗余，README 数据更新 (b41b9fdce8c)
**2026-10-29**
- 🐞 Fix:预算基线换成同 command 同 pass 态的实测值 147067ms —— 旧基线把两步判红的时间算进来了 (702d476c8d5)
**2026-10-29**
- 🐞 Fix:补回被 45dd89e4e45 吞掉的 pnpm check:all:120 —— 预算档此前根本没有可执行的出路 (d92a968ec68)
**2026-10-29**
- 🐞 Fix:GitHub App webhook 豁免 sqli-guard —— 实测 59 条 400 正在把提供方投递判死 (d1e739d9fc0)
**2026-10-29**
- 📚 Docs:登记一张可派单票 —— App 内更新卡取不到安卓包(app_versions 无 latest 安卓行) (c4dd4ae894a)
- 🐞 Fix:回收站存续腿补上第三格 —— 删除弹「回收站」错误框的真因是 SID 目录上的显式 Deny (329073ee006)
- 📚 Docs:登记两张可派单票(Y 族第三、四枚) —— api 公网腿 p95 8.3 秒 与 webhook 对 CI 事件返 400/500 (8d46643e473)
**2026-10-29**
- 🐞 Fix:下载按钮不得被 GitHub nightly 资产劫持 —— 现读线上按钮指向 releases/download/nightly-40425910619/ihui-ai-latest.apk (dbf1d8ac4a7)
**2026-10-29**
- 🐞 Fix:门 98 D7 的排除格改成"点名不静默" —— 展开式命名空间不判,但必须登记未判定 (0105cb2b0ad)
- 🐞 Fix:web 蓝绿换色自 03:03 起每轮静默蒸发 —— 健康探测读满 4096 就掐流,Promise 永悬后 Node 静默 exit 0 (2dd65414250)
**2026-10-29**
- 🐞 Fix:门 98 D7 自身崩整道门 —— test 走原文、exec 走遮噪面,注释里的形状让 m 为 null (4a695e663a8)

**2026-10-29**
- 🔧 Chore/Other:侧车补两条归属记录 —— 把 O68/Z-1 从"靠散文报数"搬进机读面(抽取器唯一出口) (81a2f9872dc)
- 🚀 Feature/Improvement:守门 98 加 D7 维 —— 动态 import 拼出来的扁平命名空间,成员悬空此前三层全盲 (c65caf91e1c)
- 🐞 Fix:workbuddy「一键切号」写回端此前是死路 —— 扁平命名空间里 5 个成员在 lib 根本不存在 (d5b136ee427)

**2026-10-29**
- 🔧 Chore/Other:写回 apps/web 端派生钉 —— 收编器把别席路由源改动带进 HEAD 时没跑钩子,G5 在干净 HEAD 上红 (c02aaffcab1)

**2026-10-29**
- 🐞 Fix:回收站清理装载器补「写走 schtasks/XML + 读走 COM」回落腿 —— 本机 5.1 系统模块目录已不存在,只认 cmdlet 的装载器结构上装不上任务 (72092781dd6)
- 📚 Docs:APK 分发地址三处遗留出口归一 —— 出包链已改站点 CDN 腿,文档与部署机模板不得再指向 public/apk (0e2e3c81c35)

**2026-10-29**
- 🐞 Fix:G16 汇总有未判定腿时不得写成 ok —— 用词改 partial 并自证覆盖面 (a22b2f25ae8)

**2026-10-29**
- 🐞 Fix:根治"重启后 web 入口不自启"三层缺口,并补完上一轮被额度掐断的 env 形态尺子 (8e9e0f53e18)
- 🐞 Fix:根治"重启后 web 入口不自启"三层缺口,并补完上一轮被额度掐断的 env 形态尺子 (3dee3fe7540)

**2026-10-29**
- 📚 Docs:GitHub 回调腿位不变量写进入口路由头注 —— 裸域/www 经 web 蓝绿 router,换流瞬间对本入口连发 ECONNRESET(2026-10-28 19:47-21:23Z 实测 svc-web-router.log 10 条),GitHub 侧读成 522/超时并 1-3 分钟一次重试;api 腿由 IHUI-API-ROUTER 单点接管、换流不断流。仓内无任何脚本写这个 url,故把不变量钉在下一个改址的人一定会读到的位置,并写明"取现值/用真实事件核对投递腿"两个动作。 (bd66dab8579)
- 🔧 Chore/Other:复结 Z-1 号池饱和票并摘除回捞带回的两份形态 —— 上枚 d5be75da91 摘后被并发席的守门 71 回捞腿按未勾旧形态补回(两份形态与留痕 rowBefore 不同字 ⇒ declaredExempt 认不出,故按当下逐字重入账再摘);凭据不变:出路三开新字母族已实测 Z 族令牌可发,出路二放宽扫描面被取号器判据源明文禁止,出路一扩池属既有拍板 (a23a42a3fb5)

**2026-10-26**

**2026-10-26**

**2026-10-26**

**2026-10-26**
- 🚀 Feature/Improvement:号池对标 workbuddy-switch 三件套——①外来格式自适应导入(别名搬运+秒/毫秒量纲归一,立修 expires_at 被当秒折成 5138 年永不失明) / ②空闲保活档(greatest(last_used,last_refresh) 防闲置 invalid_grant,client-first 让位本机,env RELAY_ACCOUNT_KEEPALIVE_DAYS) / ③号体检速查 CLI relay:inspect(六态结论+下一步,零DB零上游不回显凭据) -- AGENTS §21 docs/README 同步(本批仅 docs;两张活文档归并不在本笔);测试 typecheck8/8+vitest69+格式棘轮+水印verify,端范围 api/worker/CLI 平台独占豁免见 PLAN (79d39e8365)
- 🚀 Feature/Improvement:账号保活中心统一两条保活线 + 密钥路径锚定治静默失效第8例 (f541169ba4)
- 🐞 Fix:结清翻勾 3 枚僵尸票(G-22/G-34/git-guardian前提腐烂)——机主令接管;结清事实由 b8r1/b10r1/b13r1 注记+引用枚落定,本批翻勾并盖接管戳,正文逐字守恒 (eb3a7b66da)
- 🚀 Feature/Improvement:check-task-claims 补超龄认领牌现读枚数口——判据一律 import 挂牌单源零复算,新读数只做附加不改既有各档形态;同枚按其自注重新设计 T20 夹具(真仓叙述形态已合法归零,阳性对照改由真行合成,尺子的牙不变)(执行席 claims-cl1 交回;主席复跑镜像测试廿五例全绿) (9db07eae77)
- 🐞 Fix:G-1182551 结清——机主令接管僵尸票(持牌 g2-alltasks 近48h零活动),ssh 隧道处置(deploy 10-21 实证档)+生产日志 strict-UTF8 终验全绿 (398c711c3b)
- 🐞 Fix:监控侧告警去重身份改走单源出口——不再整条文本自拼身份,证据锁进 harness 与镜像测试;抖动门现读零新增(执行席 monitor-identity 交回;主席复跑镜像测试十九例全绿与守门 224 现读) (b9162299c8)
- 🐞 Fix:守门115 认跨文件转发豁免并钉依据链——hub adapter 的转发点名校验出口与两处调用点,演示路径真缺口保留点名不一起消掉;同枚修复该文件工作树副本的 JSDoc 断头(语法坏件会让整门解析失败)(执行席 gate115-forward 交回,主席补齐注释开头并复跑读数:命中一候选三,转发豁免一带依据链) (56497242c4)
- 🔧 Chore/Other:给四枚零测试共享工具补真用例——base64、number-format、token-estimate、dangerous-command-detector(执行席 shared-utils-tests 交回;主席复跑 vitest 五十三例 GREEN 且 shared 包 typecheck 过) (552bb5d058)
- 📚 Docs:四枚二次复跑 PASS 结清——G-397 锁租约认 token(反向验收四例含迟到 finish 不改控制文件)、G-53 lint-staged 三态分档三针已打补丁、G-63 safe-commit 发令数组无 pathspec 且 env-blocked 四条十五天零复发、G-863 附件容量写前 CAS 与跨批用例均在 HEAD(执行席 zombie-recheck-B 换角度独立复跑,主席按其现读末行摘行) (bc0c7ceb69)

**2026-10-26**
- 🚀 Feature/Improvement:票面 G-941 写账侧最后两格——计划链构造点带主链别、koubo 工作流复用引擎唯一出口入账(链别在出口处本文件零字面量);自证抓出两处真错(增量基线逐条相加断言、账本路径自算致零副作用断言恒真)已由该席改正(执行席 api-plan-chain 交回;主席复跑该族 pytest 册十六例 GREEN) (39b7c18110)
- 📚 Docs:G-1200042 挂牌认领——本席按票面把 Knip 残余债切两席裁决(5 枚零引用文件 / 23 枚零消费导出),§7 三问逐枚答完才动手;基线收紧一格按 §12e 留 owner,不在本票射程 (dfa48b8d67)
- 🔧 Chore/Other:菜单层级 e2e 补历史页 /chat/history 同型用例——一线≤7/导出子菜单2项/压缩子菜单2项,main#main 作用域消歧侧栏同名 testid;run9 4 passed (3fc3f73066)
- 📚 Docs:登记票 G-1200042 Knip 棘轮残余债(5 枚零引用文件 + 23 枚零消费导出的接线或删除裁决),判词与复算材料落 .ihui-agent/tmp/s27-knip;本票可派单,不阻塞 CI 现绿面 (47853a52d8)
- 📚 Docs:Knip 棘轮收口与 RN 文字快捷笔记切片两条行级注记落账(证据在枚 8ab7f67b86/31a2b3cb45 提交信息;D03 行只记事实与未裁关系,不翻勾不代裁) (d469a45e5b)
- 📚 Docs:修我刚写坏的那行兜底口径(反引号被转义成反斜杠 + 短语重复一遍) (67b79c811b)
- 📚 Docs:G-44 结清摘牌——去重身份已含病因维且抖动读数归一(枚 714efaa19196b077947206f4ee62213f81586600 入库),席 g44-alertdedup 双对照取证:异病因异键成立、轮次/条数/时刻/sha 漂移同键;票面行号 257 已腐烂(现读调用侧 459 与 486)。残余一格(监控侧自拼身份未走单源)另派他席,不在本票射程 (bf25ef478d)

**2026-10-26**

**2026-10-26**

**2026-10-26**

**2026-10-26**

**2026-10-26**
- 🔧 Chore/Other:菜单层级 e2e 补历史页 /chat/history 同型用例——一线≤7/导出子菜单2项/压缩子菜单2项,main#main 作用域消歧侧栏同名 testid;run9 4 passed (3fc3f73066)
- 📚 Docs:登记票 G-1200042 Knip 棘轮残余债(5 枚零引用文件 + 23 枚零消费导出的接线或删除裁决),判词与复算材料落 .ihui-agent/tmp/s27-knip;本票可派单,不阻塞 CI 现绿面 (47853a52d8)
- 📚 Docs:Knip 棘轮收口与 RN 文字快捷笔记切片两条行级注记落账(证据在枚 8ab7f67b86/31a2b3cb45 提交信息;D03 行只记事实与未裁关系,不翻勾不代裁) (d469a45e5b)
- 📚 Docs:修我刚写坏的那行兜底口径(反引号被转义成反斜杠 + 短语重复一遍) (67b79c811b)
- 📚 Docs:G-44 结清摘牌——去重身份已含病因维且抖动读数归一(枚 714efaa19196b077947206f4ee62213f81586600 入库),席 g44-alertdedup 双对照取证:异病因异键成立、轮次/条数/时刻/sha 漂移同键;票面行号 257 已腐烂(现读调用侧 459 与 486)。残余一格(监控侧自拼身份未走单源)另派他席,不在本票射程 (bf25ef478d)

**2026-10-26**
- 🚀 Feature/Improvement:票面 G-941 写账侧补 workflow 生产者并把 chain 缺省收成必填语义——工作流不再静默落未判定桶,漏传当场点名;bench 与越权用例补传主链别(执行席 g941c-workflow 交回;主席复跑该族 pytest 册六十二例 GREEN,被删的 data/cost_ledger.json 经现读属 gitignored 残留) (7faee0fb1b)
- 🔧 Chore/Other:守门98 镜像 D4 计数行的假牙改形态锁——只报数维不再把一次性读数钉成下限,补两条变异自证(摘行必红、读数归零不红),pass 由廿五增到廿六(执行席 gate98-softcount 交回;上一枚因并发清索引落成空提交,本枚重试) (e65492b6e2)
- 📚 Docs:git 出网兜底口径对齐实现 —— 换腿双向(代理↔直连)、网络形状含挂死零回显、方向由 plan.useDirectArgs 单点给 (b1b1fd08a7)
- 🐞 Fix:把换腿兜底补成对称的两臂,并治好它自己的两处失真 —— ① 旧判据只兜"代理→直连"单向:显式绕过(--no-proxy)后若只剩代理腿能用,仍把"我有腿"判成"无法判定远端位置"(rc=2;当天 09:20 实测 Failed to connect to github.com:443 + 200s 挂死各一次)。现按 usedDirect/alreadyDirect 双向换腿,方向由 plan.useDirectArgs 单点给出(写死任一方向=只兜一条腿的偏判) ② 挂死到超时既无退出码也无回显,旧判据 `status!==128` 直接不兜 ⇒ 又成安静失效(§12f);新增 isTransportEgress 统一口径(128+传输回显 ∨ 挂死/零回显) ③ 无腿可换那一支也留痕,且先过动词表(实测曾把 for-each-ref 的本地失败记成 both-failed 往账本造脏行,该 1 行已清) ④ 用例 25 例(对称两臂+挂死+服务器裁决四型不得换腿+源码形状锁),face-reader 35 / git-push-guard 32 / safe-commit-triage 5 合跑 97/97 (f23d935e54)
- 🐞 Fix:免鉴权目录空 key 不再发 "Bearer " —— 占位 key 判未配置后 huggingface 以空 key 出网,默认分支仍无条件拼 Bearer ⇒ httpx LocalProtocolError Illegal header value,本该 200 的 router /v1/models 变失败又把 health 打成0;三处 Bearer 分支配 api_key 守卫空则不设 header,并加回归用例钉住(无 key ⇒ 无 Authorization);pytest 224 全绿 (f52f4580c7)
- 🐞 Fix:占位 key=未配置⇒未配凭据厂商不进人告警(机主定案)——实测 ai_model_config 三家密文解出 sk-placeholder-… 变体,精确匹配的 _PLACEHOLDER_KEYS 拦不住⇒github_models/cloudflare_workers_ai 被拉进同步连败3次永久禁用、huggingface 直连被墙 ConnectError,三家 gauge 钉死0⇒LlmProviderUnhealthy 长期 firing;新增 _is_placeholder_key(空/白名单/含placeholder 大小写不敏感)收敛在选取层:占位 key 厂商不进同步也不进启动恢复(无序列⇒告警自愈),免鉴权放行时不带占位 key 出网;huggingface 标 keyless_model_list(router /v1/models 无key 200 实测)换域后照常同步转健康;pytest 5 例新增+233 例全绿,变异自证(摘判据⇒2例咬红) (352731df85)

- 🔧 Chore/Other:侧栏会话菜单层级 e2e 冒烟 spec 入库——真浏览器验证一线10项/导出子菜单7项/压缩子菜单2项/MD导出真下载/Issue白话提示上屏(run7 3 passed);随重构补装回归防线 (7db240fbd0)

- 🐞 Fix:还原收编器抢先入库的过窄状态——零使用符号不得被去 export 背景:收编器在 8ab7f67b86 把我席在树的 Knip 第二轮收窄整片提交,而那一刻我尚未跑完 全量 typecheck 的修复轮,HEAD 因此带着 tsc 立刻点名的错误(未用局部量/未用类型)。 判据:去 export 只对「本文件内确有使用」的符号成立;若该符号在本文件内也零使用且 全仓零消费方,去掉 export 会让它变成 tsc 眼里的死局部量。这类不得由我单方面删除 (§7 三问无人背书),故一律还原为原导出形态。 还原面 48 文件:api 服务层 __reset*ForTest 与账本条目类型、miniapp-taro 的 canvasToTempFilePath/rpxToPx/imagesToBase64/writeFileFromBase64/useChatSyncMessages/ stopTokenAutoRefresh/readFileAsBase64 别名腿、mobile-rn token 与 web useAIWebSocket、 shared hands 契约两枚、topic-detail 样式类型等。 验证:turbo typecheck 全量 32/32 任务 0 错误(还原后现跑);knip 复量待干净检出。 (31a2b3cb45)
- 🔧 Chore/Other:守门98 镜像 D4 计数行的假牙改形态锁——只报数维不再把一次性读数钉成下限,补两条变异自证(摘行必红、读数归零不红),pass 由廿五增到廿六(执行席 gate98-softcount 交回,主席复跑同条命令绿) (3a1c07ed0a)
- 📚 Docs:两枚结清——G-17 schema_check 认借来的连接(席 g17-schemacheck,主席复跑 pytest 五十九例 GREEN,枚 8ab7f67b86 入库);G-39 判为守门98 D6 同题重复登记(门体早于批基线在 HEAD,席 g39-shadow-js 现读 self-test 四十例全绿、真仓 RC=0,按僵尸票摘行通道结清) (b49b38ec62)

- 🚀 Feature/Improvement:票面 G-941 第二读面补链维——用量基线来源键按链别分桶,未判定桶独立可见不并入主链(执行席 g941b-usage 交回;主席独立复跑该族 pytest 廿七例 GREEN) (1727fb92d3)
- 🐞 Fix:折叠 web 五语词包的同行逐字重复键——门 2 / 2e-dupns 由红转绿(全仓提交链解堵) (bec5acc3e8)
- 🚀 Feature/Improvement:绑定Issue对话框加普通用户用法提示——副标题改白话说明(bindIssueHint)、搜索按钮长句改短动词键(searchIssueAction),五语言同批补键parity 19260 OK;对话框测试12/12、web typecheck全绿;顺带prettier对齐该文件存量格式欠账 (edaa348b22)

- 🐞 Fix:退化留痕账本自身学会老化,并把我上一轮探针注进真账的假历史单独清掉(chore) —— ① pruneEgressLedger(30 天窗,行首 ISO 切分刻意写成 slice(0,tab):写成 slice(0,slice(0,i)) 会把字符串当长度传进去恒 NaN,老化形同虚设——这一格由用例 ⑤ 钉住) ② 被裁条数写进账本自己的 cad=prune marker,共享层不打 stdout/stderr(否则污染几百把尺子的逐字基线) ③ 注入口 isForceDirect/pruneEgressLedger/KEEP_DAYS/noteEgressDegradation 进 __test__ 供镜像测试消费 ④ 新增 ③e/③f(绕过通道 env→第一趟直连→不叠第二趟 三段接线锁)与 ⑤/⑤a/⑤b/⑤c(端到端真写盘,夹具落 mkScratch 不碰真账);另把真账里 verb=probe｜依据=夹具 那 1 行删除(我自己造的假历史,其余 105 行一字未动) —— 用例 21/21 全绿 (939f7ff30e)
- 🐞 Fix:离线语言包随 G-957 新键重生成——门 105 由红转绿 (d1b79b8411)
- 🔧 Chore/Other:G-1102638 批1 同主键副本行物理归并 — 删 2 行(机主拍板〔拍板@2026-10-08 机主:真删+立即执行〕;幸存者规则与F4同向;落账注记行保留待批2;复跑auditPlan对账F1=0/F9不增;逐行留痕 .ihui-agent/archive/PROJECT_PLAN_copy-purge-2026-10-26.md) (125a0d4a3c)
- 🐞 Fix:plan-copy-row-purge 开④d「枚回执」档——行号型指针(`副本指针（编号 L6880）`+行内枚 sha)有了可验出路 (7160346576)
- 🐞 Fix:收口 union 回潮的 4 道门——① 门2b web zh-TW 4 处简体残留再修(前臺/後臺/分佈/任一臺,与 2c2699be79 同批形);② 门83 R3/R8:filterChipTextActive/tabTextActive 改名仓内 Text 后缀惯例(filterChipActiveText/tabActiveText)使兄弟配对成立,archivedDotOn 指示点与两处 progressFill 走 brandAccent.deep(stepDotOn 先例);③ 门94:MODEL_RETIRED 收编 error-catalog(resourceNotFound 档)+ 五语言词包;④ 门105:小程序 ui-routes 重生成(输入 use-ui-control-bridge/taro-ws-ticket 已在 HEAD 漂移)。quick-notes-styles.ts 的 archivedDotOn 修在笔记席位在飞副本上,随其落地 (e216dca2f6)
- 🚀 Feature/Improvement:G-957 小程序网页授权回传腿闭合(代码侧)——① web 中转页 /sso/login 新增 miniapp-bridge.ts:微信 JS-SDK jweixin-1.6.0 CDN 注入 + wx.miniProgram.postMessage 回传 sso_code(载荷契约 ihui-sso-code 与小程序接收侧逐字同源,SDK 失败超时 8s reject 如实提示绝不静默,交接成功留完成卡不跳转防丢 bindmessage 整批投递时机);② auth-sso.ts 深链 scheme 白名单默认补 ihui-miniapp(过 isSafeRedirectUri 的合法形态,AGENTS §9 契约);③ miniapp sso.ts 导出 SSO_REDIRECT_URI + LoginPopUp 增 onWebAuthLogin 传入才渲染格 + user 页接线(收弹窗再跳 webview 页);④ 五语言:miniapp-taro login.webAuthLogin + web miniappHandoff 三键;⑤ 测试:web 桥 12 例本席绿+主席独立复跑 12/12;剩余人工窗=小程序后台业务域名白名单+真机投递时机验证 (20fce9cea8)
- 🚀 Feature/Improvement:G-40 A/E 双格闭合——command-acks 写侧端点 + ack 事实存活判据——① POST /api/command-acks(authenticated 零公开面,owner_key 由令牌主体拼出,Zod 入参,PG 事实先行+KV 镜像后写不共事务,KV 失败不回滚 PG、如实 kv_mirrored:false,复合主键 onConflictDoNothing 幂等:同指纹 replayed/processing 409/异指纹 KEY_REUSED);② services/command-ack-facts.ts 纯判据四档死因硬错 + GET /alive/:parent/:cmd 查询面;③ 新测 18 例全内存零真库,本席两遍 + 主席独立复跑均 18/18 绿;④ turbo typecheck api+web 11/11 任务 0 错误(删除批 27 枚已还原后现跑);⑤ index.ts 仅 import+注册两行接线 (865aad52cb)
- 🐞 Fix:huggingface 入口换域 api-inference→router.huggingface.co——旧域被网络封锁(直连超时+代理TLS reset 实测),官方推理入口已迁;registry/种子/web 中继清单三处同步,生产 DB ai_model_config 行已另行 UPDATE 到位 (b4b1c6a3ab)












- 📚 Docs:门207体积清偿——R4漏点名补记②三份漂移副本删二留一(保留最全版含CI问责腿与analytics点名),被删两版逐字归档 AGENTS_trim-2026-10-26,规则条款零删减;有意重写整份文档故按门84 出路带 IHUI_SKIP_LIVE_DOC_CHECK=1 留痕 (e7fbe3b0f3)
- 📚 Docs:G-172 记进展不翻勾——CI 红因两条判清(水印门 5 枚随删除腿自愈;Knip 棘轮四类清单交主席),票面本机无 gh 前提腐烂(gh 2.96.0 在位) (082d85ee02)

- 🔧 Chore/Other:合并落地后重生成 web ui-routes 钉(union-converge 对生成物留下的本侧副本须立即重跑生成器,门 105 现读 web 行 stale⇒heal 后待入库;miniapp 端他席在飞 taro-ws-ticket.ts 由 heal 档正确拒写不背书) (c411929340)
- 🐞 Fix:G-1200041 按 2026-10-25 机主令出等条件桶——两格真卡点归机主控制台/运维动作面,存在句改归属句(事实未动),清合并回潮的 F12 基线违例 (3c6956763c)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (9ae2dd7013)
- 🐞 Fix:健康 ping 与同步同用出网判据(专用代理表→SYNC_PROXY_URL→直连)——huggingface 直连被封经代理可达却被误判 DOWN,系 LlmProviderUnhealthy 误报根因;钉测含变异自证 (ce76fff2c1)















- ♻️ Refactor:侧栏/历史页会话菜单按钮层级重构——导出7格式与压缩2档位收进二级子菜单,一线16项收敛为9项(48项菜单测试/typecheck/prettier现读绿,i18n五语言补键parity OK) (09b5462b8f)
- 🐞 Fix:推送腿兜底两处收尾 —— ① 探针取根改用脚本自身位置 EGRESS_ROOT,不再引用尚未赋值的 repoRoot(实测:兜底自己崩在判据之前,Cannot access 'repoRoot' before initialization,比没兜底更坏) ② 两条腿都不通时把诊断写进 push-state reason,读数不再退化成'退出码 128 且无可辨认特征'(AGENTS §5e-3 量得到/§12f 失效不许安静),并给出单次绕过的可跑通道 --no-proxy ③ withDirectArgs 保住 git.exe 与尾随空格形态。回归 git-push-guard.test 32 例 + push-attempt-triage 自跑全绿 (5999fa708e)
**2026-10-29**
- 🚀 Feature/Improvement:APK 固定地址改走站点 CDN 腿并加 no-cache 302 指针 —— CF 橙云腿实测只剩 3-6KB/s (8afd5986ca2)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5f85b6a6639)
- 🔧 Chore/Other:补 G-86 仓内侧装车证明 —— WebSocket 有界重连、SSE 降级兜底、可见失败终态与终态唯一性四条臂十例真跑绿;变异取证三条(摘上限判断七红、摘兜底腿五红、摘终态门仅终态唯一性一红)均还原并 sha 复验回基线;测试根因是工厂构造写在 render 回调内致每轮新标识符拆建 effect,与真实消费方 helpers.ts 模块级单次构造相反,已全部外提 (a0693d9feb6)
- 🐞 Fix:把 O93 号池选号八钮登记进 .env.example —— CI Test 步唯一红的根因是模板没登记 (2b415a4e5ff)
- 🐞 Fix:补回 playwright.stream-lifecycle.config.ts 的溯源载荷 —— HEAD 面欠账清零 (9960c239c4d)
- 🚀 Feature/Improvement:分诊留账补齐 + --status 分桶读数 —— registered 面此前只打印不落账,导致三次矛盾归因都无从判死 (49b1a67a8eb)
- 📚 Docs:§1 侧车出口措辞跟上现实 —— 归属改判的声明式出口入册(票 O68 结清批) (5d6cc2d5582)
- 🔧 Chore/Other:结清 O68 侧车改判出口 —— plan-fields-reclassify.mjs 已交付(声明档逐条给 before/after 桶 + why,复用 dispositionOfV2 复算,11 例镜像测试),O02 已改判并吃出派单面 (0faf6809192)
- 📚 Docs:需求发现器第三源生产者已落并更正票面 —— export-user-feedback 自检 10/10、guardian 已派发,旧注记『仓内无生产者』过期 (fd426cdb345)
- 🐞 Fix:补上 plan-fields-extract --reclassify 旧腿的禁桶守卫 —— 它此前是 F11/F12 的后门 (f9ecc8879b6)
- 📚 Docs:凭据交付面空键读数更正 —— 实测 48 空键,真需供值约 20 枚(其余设计默认或代码自生成),票面 35/74/79 三个旧读数过期 (aa53c467432)
- 🚀 Feature/Improvement:补 pnpm check:public-exposure 入口 —— G-329 ④ 的 pnpm 面此前只有 node 直调,门已接线而脚本位缺失 (f85e1f55dee)
- 🔧 Chore/Other:结清 G-329 与 O66 + G-957 卡点定位更正 (5016a012223)
- 📚 Docs:体积清偿第 29 日批 —— §5c 一条改判留痕整段逐字迁 archive,净省 944 字节回到预算内 (535029dfeaf)
<!-- END RECENT UPDATES -->

## Nine topic documents (verbatim archives from the old root README)

| File                                                                                                     | Domain                           | Archived sections                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`readme-01-positioning`](./docs/engineering/readme-01-positioning.md)                                   | Positioning & claims             | Header banners & manifesto · one-click deploy · tech-stack overview · project manifesto · GEO optimization · TOC · positioning · feature matrix                                                                                |
| [`readme-02-ux-and-ai-control`](./docs/engineering/readme-02-ux-and-ai-control.md)                       | UX & AI control                  | Streaming AI UX (Phase 19) · full AI-control bridge · GlobalTopBar + Plus popover · use cases · AI conversation decision surface & runtime facts                                                                               |
| [`readme-03-why-comparison-scenarios`](./docs/engineering/readme-03-why-comparison-scenarios.md)         | Selling points & scenarios       | Why IHUI-AI · benchmark matrix · who uses it · 5 typical scenarios · contact                                                                                                                                                   |
| [`readme-04-architecture-and-modules`](./docs/engineering/readme-04-architecture-and-modules.md)         | Architecture & modules           | Tech stack · 8-end architecture · cross-end sharing · maintenance ratio · app hierarchy diagrams · project structure · 15 module deep-dive                                                                                     |
| [`readme-05-quickstart-api-data`](./docs/engineering/readme-05-quickstart-api-data.md)                   | Quick start / API / data         | Quick start · REST/WebSocket API & capability catalog · model auto-sync · IM multi-platform control · database                                                                                                                 |
| [`readme-06-security-observability-gates`](./docs/engineering/readme-06-security-observability-gates.md) | Security / observability / gates | Observability · security design · root guardian service · full gate table · commit-loss protection · quality evidence · AI collaboration statement · testing · deployment · CI · i18n · LLM dictionary · gate registry addenda |
| [`readme-07-faq-roadmap-commerce`](./docs/engineering/readme-07-faq-roadmap-commerce.md)                 | FAQ / roadmap / commerce         | FAQ · contributing · doc navigation · roadmap (delivered / recent updates / capability list) · monetization · star history · translated READMEs · contact                                                                      |
| [`readme-08-seo-keywords-story`](./docs/engineering/readme-08-seo-keywords-story.md)                     | SEO & brand story                | AI-engine exposure · our story · open-source vision · license · join us · acknowledgements · quick FAQ · full keywords                                                                                                         |
| [`readme-09-ops-tools`](./docs/engineering/readme-09-ops-tools.md)                                       | Ops tooling & archives           | Release-line closure capabilities & ops entries · production monitoring tools · gate registry addenda · dangling table rows archive                                                                                            |

## The 8 ends (plus one shell)

The workspace holds **9 app packages** (the last row is a Capacitor shell reusing the web static export)
and **16 shared packages**.

| End               | Directory           | Stack                                          | Notes                                                        |
| ----------------- | ------------------- | ---------------------------------------------- | ------------------------------------------------------------ |
| Web               | `apps/web`          | Next.js 16 + React 19 + Tailwind 4 + shadcn/ui | Main site + admin console + IDE panel                        |
| API               | `apps/api`          | Fastify 5 + Drizzle ORM + PostgreSQL + Zod     | Business backend: auth/tenants/billing/content/WebSocket     |
| AI service        | `apps/ai-service`   | FastAPI + LangGraph + LiteLLM + MCP            | Model gateway, agent engine, RAG, workflows                  |
| Mini-program      | `apps/miniapp-taro` | Taro 4 + React + NativeWind                    | WeChat, native WeChat Pay                                    |
| Mobile app        | `apps/mobile-rn`    | React Native + Expo + NativeWind               | Shares screen layer `packages/app`                           |
| Desktop           | `apps/desktop`      | Tauri 2 (thin Rust shell) + web frontend       | No bundled frontend in release builds; tray + auto-update    |
| Browser extension | `apps/extension`    | WXT + Chrome MV3                               | Side Panel toolset                                           |
| CLI               | `apps/cli`          | Node.js + TypeScript                           | Terminal assistant, tools, drift checks, agent-engine client |
| Capacitor shell   | `apps/mobile-cap`   | Capacitor 7                                    | Packages `apps/web` `out/` export for Android/iOS            |

### Sidebar domain hub and per-domain entry pages (introduced 2026-10-19, AI and personal domains added 2026-10-23)

The sidebar collapses many first-level menu items into **per-domain entries**; each domain's full set of pages is hosted by one card-grid page. Existing routes are untouched (`CategoryShell` as a Next.js layout only covers its own directory subtree, so moving a directory would change URLs), so the entry page only groups and links.

- **What it does**: all five entry pages render through one component, `apps/web/src/components/layout/DomainHub.tsx`, and take their items from the `*_HUB_ITEMS` exports in `apps/web/src/components/sidebar/nav-data.ts` (single source of truth — no per-page copy of the list). Visibility goes through `useNavVisibilityFilter` (`apps/web/src/components/sidebar/use-nav-visibility.ts`): `adminOnly`/`permission` decide *may this be seen at all*, `advancedOnly` decides *should it be shown to ordinary users*. Same predicate as the Sidebar; do not re-implement it per page.
- **How to use**: open one of the URLs below, or click the domain entry in the sidebar and then a card. The tier (simple mode) is set in Settings → sidebar tiers and persists to `user_preferences.group=preferences` under `navTiers`.

| Entry URL | Item source | End |
| --------- | ----------- | --- |
| `/domains/ai` | `AI_HUB_ITEMS` | web (Next.js, platform-exclusive) |
| `/domains/personal` | `PERSONAL_HUB_ITEMS` | web (Next.js, platform-exclusive) |
| `/domains/content` | `CONTENT_HUB_ITEMS` | web (Next.js, platform-exclusive) |
| `/domains/edu` | `EDU_HUB_ITEMS` | web (Next.js, platform-exclusive) |
| `/domains/trade` | `TRADE_HUB_ITEMS` | web (Next.js, platform-exclusive) |

- **End**: web-only (the desktop shell reuses this web UI; mini-program and RN carry their own navigation).

### User-side read-only and unauthenticated endpoints (registered 2026-10-23 — previously absent from the README)

| Endpoint | Method | Auth | Response shape | End / consumer |
| -------- | ------ | ---- | -------------- | -------------- |
| `/api/goods/select` | GET | Public — only the on-shelf catalogue where `zhs_product.status = 1`, no private user fields | `{ code, message, data: { list, total, page, pageSize } }`; `page` defaults to 1, `pageSize` is 1..100 with default 20 | api + mobile-rn `CartScreen` + mini-program `pkg-shop/cart`, through `selectGoods()` in `packages/api-client/src/endpoints/goods.ts` |
| `/api/sign-ups` | GET | Requires login; ownership is checked in the handler — a `?userId` that is not the caller's, without system-admin rights, gets 403 (authentication is not authorization) | `{ code, message, data: { list: [{ id, targetTitle, targetType, status, createdAt }] } }`, status normalised to `draft/published/rejected/completed` | api + web `apps/web/app/(main)/user/sign-up/page.tsx`; aggregates `lesson_sign_ups` and `exam_signups` |
| `/api/auth/wechat/mini/one-tap-login` | POST | **Unauthenticated** (rate limited to 5 requests per minute); the phone number and the openId are both exchanged from one-time WeChat codes, so nothing is taken from the client | Success returns `{ ...tokens, user }` — the user object travels with the tokens; 503 when WeChat mini is unconfigured, 401 when the code exchange fails, 409 when the openId is already bound to another account, 403 when the account is disabled | api + mini-program `apps/miniapp-taro` (one-tap login button) |

- **What they do**: `/goods/select` supplies the cart's product paging read; `/sign-ups` merges course sign-ups and exam sign-ups into one "my sign-ups" list; `/auth/wechat/mini/one-tap-login` is a newly opened endpoint — previously `/mini/login` answered new users with `{needPhone:true, openId}` and issued no token, while `/mini/phone` required an existing session and returned no token either, so that chain was structurally impossible (proof case: `apps/api/src/routes/__tests__/wechat-mini-one-tap-login.test.ts`).
- **How to use**: all three are registered in `apps/api/src/routes/index.ts` (`goods.ts` under `prefix:'/api'`, `sign-ups.ts` under `prefix:'/api/sign-ups'`, the login leg under the auth prefix). Inputs are Zod-validated; one-tap login accepts `{ loginCode, phoneCode }` as a `strictObject`, so unknown keys answer 400.
- **End**: backend `apps/api`; consumers are listed in the table column above (web / mobile-rn / mini-program).

## 🚀 Quick start

```bash
git clone https://github.com/IHUI-INF-AI/IHUI-AI.git
cd IHUI-AI
cp .env.example .env           # fill JWT_SECRET / DB_PASSWORD / CREDENTIALS_ENCRYPTION_KEY
docker compose up -d           # business + migrations; add --profile observability as needed
```

If something does not come up: `docs/DEPLOYMENT_RUNBOOK.md` · `docs/TROUBLESHOOTING.md` · port registry `docs/port-management.md`.

Local development:

```bash
pnpm install                   # full install, --filter is forbidden (AGENTS §12e)
docker compose up -d db redis
pnpm --filter @ihui/database run db:migrate
pnpm dev                       # web :8801 + api :8802 (+ ai-service :8803)
pnpm turbo build typecheck lint test
```

Model keys are never in the repo: bootstrap with `node scripts/env-backfill-model-keys.mjs --verify`
(see [`AGENTS.md` §5d](./AGENTS.md)). Windows one-click launch scripts, full env-var table, REST/WebSocket
API, model sync and IM multi-platform control: [`readme-05`](./docs/engineering/readme-05-quickstart-api-data.md).

## Deployment

| Topic                                            | Where                                                                               |
| ------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Production runbook (blue-green, rollback, certs) | [`docs/DEPLOYMENT_RUNBOOK.md`](./docs/DEPLOYMENT_RUNBOOK.md)                        |
| Compose / IaC decisions                          | [`docs/INFRASTRUCTURE_DECISION.md`](./docs/INFRASTRUCTURE_DECISION.md)              |
| Monitoring & alerting (email single channel)     | [`docs/MONITORING.md`](./docs/MONITORING.md)                                        |
| Database backups & read-only backup role         | [`docs/DATABASE.md`](./docs/DATABASE.md)                                            |
| Credential rotation                              | [`docs/CREDENTIAL_ROTATION_RUNBOOK.md`](./docs/CREDENTIAL_ROTATION_RUNBOOK.md)      |
| CI workflow inventory                            | [`.github/workflows/`](./.github/workflows) + the workflow count in the table above |

## Development constraints (excerpt)

**The rules in this repo are code, not verbal agreements.** The single authoritative text is
[`AGENTS.md`](./AGENTS.md). The ones you hit on day one:

1. Task plans live only in `PROJECT_PLAN.md`; claims use the lease format `（进行中@日期/持有者）`.
2. Commits go through `node scripts/safe-commit.mjs`; `git add .` / `-A` / `-u` are forbidden; live docs
   require `node scripts/merge-live-doc.mjs --file README.md` first.
3. `git stash`, `git pull --rebase` and hand-written `git push` are forbidden; pushes go through the
   post-commit `git-push-guard`.
4. Single-branch development: no branches except `goal/*`.
5. Shared layer first: check `packages/` before writing any hook/util/type/api-client twice.
6. UI hard rules: single source of truth for radii/geometry; vector icons only; no emoji as icons.
7. Auth: authentication is not authorization; identity comes from the carrying layer, never from the
   request body; batch writes report the DB-confirmed set (`.returning({id})`).
8. i18n: key parity across five languages (en/zh-CN/zh-TW/ja/ko) is a gate.
9. Temp files only under `.ihui-agent/tmp/<task>/`.
10. New files must be watermarked: `node scripts/watermark.mjs inject <file>`.

## License & copyright

- **License**: Apache-2.0 (see [`LICENSE`](./LICENSE)); contributor terms in [`CONTRIBUTING.md`](./CONTRIBUTING.md).
- **NOTICE**: must be retained with every copy.
- **Provenance watermarks**: three-layer watermark on source files, maintained by `scripts/watermark.mjs`;
  they do not alter the rights granted by Apache-2.0.
- **Trademarks**: "智汇AI / IHUI-AI" and its logos belong to the project; Apache-2.0 grants no trademark rights.

## Contact

- Site / docs: <https://aizhs.top>
- Issues: <https://github.com/IHUI-INF-AI/IHUI-AI/issues>
- Security disclosures (please do not post publicly): [`SECURITY.md`](./SECURITY.md)
- Code of conduct: [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md)

<div align="center">

If this project is useful to you, a ⭐ is the most direct contribution.

</div>
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->

