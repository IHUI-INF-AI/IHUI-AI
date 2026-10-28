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
  <strong>Online Demo</strong> · <a href="https://aizhs.top">https://aizhs.top</a> &nbsp;|&nbsp; <strong>GitHub</strong> · <a href="https://github.com/IHUI-INF-AI/IHUI-AI">Star this repo</a><br/>
  <sub><strong>Self-hosted full-stack AI platform</strong>: model gateway + Agent orchestration + multi-tenant business backend + 8 frontend ends · Apache 2.0 · Fork to production in 5 minutes</sub>
</p>

<p align="center">
  <sub>
    <a href="README.md">简体中文</a> · <a href="README.en.md">English</a> · <a href="README.ko.md">한국어</a> · <a href="README.ja.md">日本語</a>
  </sub>
</p>

---

> **This file is an index only.** As of 2026-09-30 the root README is an index layer: positioning,
> live-computed numbers, quick start, and entry points into nine topic documents. Every capability's
> full rationale and evidence lives, verbatim, in the nine archive files under
> [`docs/engineering/`](./docs/engineering); the authoritative engineering rulebook is
> [`AGENTS.md`](./AGENTS.md).

## What it is

| Dimension   | Description                                                                                                                                                     |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| In one line | Self-hosted full-stack AI platform: model gateway + Agent orchestration + multi-tenant backend + 8 frontend ends                                                |
| Backend     | `apps/api` — Fastify 5 + Drizzle ORM + PostgreSQL + Zod (TypeScript)                                                                                            |
| AI service  | `apps/ai-service` — FastAPI + LangGraph + LiteLLM + MCP (Python)                                                                                                |
| Frontends   | Next.js 16 + React 19 + Tailwind 4 + shadcn/ui (web), Taro 4 (mini-program), React Native + NativeWind (app), Tauri 2 (desktop), WXT (extension), Node.js (CLI) |
| Data        | PostgreSQL (row-level security, multi-tenant) + pgvector vector search + Redis                                                                                  |
| License     | Apache-2.0 (copyright notice and NOTICE must be retained; source files carry provenance watermarks)                                                             |

Full positioning narrative (value pyramid, cost comparison, differentiation, benchmark categories):
[`docs/engineering/readme-01-positioning.md`](./docs/engineering/readme-01-positioning.md).

## Key numbers (live-computed)

**These numbers are not hand-copied.** The single algorithm lives in
[`scripts/gen-doc-numbers.mjs`](./scripts/gen-doc-numbers.mjs), which counts from real sources
(schema code, route registrations, locale directories, compose manifests...). The gate
[`scripts/check-doc-numbers.mjs`](./scripts/check-doc-numbers.mjs) re-computes them for this file and
the Chinese README, and blocks any stale value.

Headline claims (same source as the table below, all live-computed): **609 tables · 4569 API routes ·
25 WebSocket endpoints · 99 catalogued LLMs · 38 platforms auto-publishing · 3326 test files ·
271 engineering gates · 50 CI workflows · 5-language i18n parity · 9 app packages · 16 shared packages ·
14 compose services**.

<!-- BEGIN GENERATED NUMBERS (node scripts/gen-doc-numbers.mjs --markdown) -->
| 指标 | 现值 | 取数键 |
| ---- | ---- | ------ |
| 数据库表 | 609 | `dbTables` |
| schema 文件 | 236 | `dbSchemaFiles` |
| API 路由 | 4569 | `apiRoutes` |
| 路由文件 | 630 | `apiRouteFiles` |
| AI 服务路由 | 596 | `aiServiceRoutes` |
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
| 测试文件 | 3326 | `testFiles` |
| CI 工作流 | 50 | `ciWorkflows` |
| Compose 服务 | 14 | `composeServices` |
| 工程守门 | 292 | `guardianGates` |
| — blocking | 266 | `guardianBlocking` |
| — warn | 28 | `guardianWarn` |
| 跟踪文件 | 16853 | `trackedFiles` |

上表由 `node scripts/gen-doc-numbers.mjs --markdown` 生成,最后核对日期 2026-10-28。
每个数的来源就写在取数键旁边的实现里(`scripts/gen-doc-numbers.mjs` 的 `SOURCES`),**不得手抄、不得另立第二份**。

<!-- END GENERATED NUMBERS -->


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
