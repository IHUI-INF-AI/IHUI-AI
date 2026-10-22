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
    &nbsp;&nbsp;|&nbsp;&nbsp;
    <strong>Mirrors</strong> · <a href="https://gitee.com/JLSLSSZWHYXGS_0/IHUI-AI">Gitee</a> · <a href="https://gitcode.com/IHUI-AI/IHUI-AI">GitCode</a>
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

Headline claims (same source as the table below, all live-computed): **599 tables · 4,451 API routes ·
25 WebSocket endpoints · 118 catalogued LLMs · 38 platforms auto-publishing · 3,029 test files ·
268 engineering gates · 50 CI workflows · 5-language i18n parity · 9 app packages · 16 shared packages ·
14 compose services**.

<!-- BEGIN GENERATED NUMBERS (node scripts/gen-doc-numbers.mjs --markdown) -->
| 指标 | 现值 | 取数键 |
| ---- | ---- | ------ |
| 数据库表 | 599 | `dbTables` |
| schema 文件 | 232 | `dbSchemaFiles` |
| API 路由 | 4451 | `apiRoutes` |
| 路由文件 | 609 | `apiRouteFiles` |
| AI 服务路由 | 576 | `aiServiceRoutes` |
| WebSocket 端点 | 25 | `wsEndpoints` |
| 入库模型清单 | 118 | `llmModels` |
| 发布平台 | 38 | `publishPlatforms` |
| 端应用包 | 9 | `appPackages` |
| 共享包 | 16 | `sharedPackages` |
| CLI 命令文件 | 66 | `cliCommandFiles` |
| CLI 工具文件 | 72 | `cliToolFiles` |
| 语言 | 5 | `i18nLanguages` |
| i18n 作用域 | 7 | `i18nScopes` |
| 语言包 JSON | 35 | `i18nMessageFiles` |
| 测试文件 | 3030 | `testFiles` |
| CI 工作流 | 50 | `ciWorkflows` |
| Compose 服务 | 14 | `composeServices` |
| 工程守门 | 268 | `guardianGates` |
| — blocking | 245 | `guardianBlocking` |
| — warn | 26 | `guardianWarn` |
| 跟踪文件 | 15675 | `trackedFiles` |

上表由 `node scripts/gen-doc-numbers.mjs --markdown` 生成,最后核对日期 2026-10-22。
每个数的来源就写在取数键旁边的实现里(`scripts/gen-doc-numbers.mjs` 的 `SOURCES`),**不得手抄、不得另立第二份**。

<!-- END GENERATED NUMBERS -->


## Recent updates (auto-maintained)

<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->
**2026-10-22**
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8c92a7f467)
- 🐞 Fix:本席三票让号(原 G-924/G-926/G-929 全部撞上别席已占号) (bd758ca8f8)

**2026-10-22**
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3a75fa10a2)

**2026-10-22**
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2526330525)

**2026-10-22**
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (ccd7ce10f5)
- 🐞 Fix:净面去 git 化(read-tree+checkout-index),根治 worktree 登记四类故障 (5038b8b0ca)
- 🚀 Feature/Improvement:验证码按场景分模板 —— 注册/登录/找回密码/改绑各走自己已过审的模板 (765d4621e6)
- 🔧 Chore/Other:清 tests/ 第三批 8 处模块内死代码 + 级联的 2 处 import(删 HERE 后 dirname/fileURLToPath 随之无用) —— 只删 eslint 点名且确认零引用的绑定;8 个文件 lint 0 error、测试全过(注:check-redundant 的 T12 是存量红,HEAD 原版同样失败,与本批无关) (6cc7f536b4)
- 🐞 Fix:阿里云验证码这条腿从入库那天起就没通过 —— 修构造函数互操作 + 补响应体业务码判定 + 接通两条发码端点 (d2c3ba781a)
- 🔧 Chore/Other:清 tests/ 第二批 10 处 unused(多具名 import 删单符号 4 处 + 形参加 _ 前缀 6 处)—— 只动 eslint 点名的那一个符号,同行其余绑定与调用方一律不碰;5 个文件 100 个测试全过。scripts/tests/ error 35 → 17 (e8f8389fc6)
- 🔧 Chore/Other:清 tests/ 首批 8 处未使用 import(整体行 5 处 + 多具名里的 rmScratch 3 处)—— 只删 eslint 点名的那一个符号,保留同行其余绑定;改后 5 个文件 lint 0 error、58 个测试全过 (d9f6746207)
- 🔧 Chore/Other:清 scripts/lib/ 最后 3 处存量 lint error —— plan-tasks-merge-selftest 删未使用的 titleOf 导入与 rewritePointer 解构绑定;stale-lock-claim 的 observedAt 参数加 _ 前缀。eslint scripts/lib/ 现为 0 error (e3e940a046)
- 📚 Docs:readme-06 守门结构描述与实现对齐 —— "56+10 pre-commit 项"改为 269 道 runner 门 + 本地元门档 27 道 + 全量归 CI;两处"pre-commit 第 N 项"改为 guardian-runner 注册门 (ba6898c15d)
- 🐞 Fix:node-version 与根 package.json engines 对齐(>=22.13.0)—— 写死 '22' 可能装到 22.0.0,而本仓用了 22.13 之后的特性 (17e6aaf4c1)
- 📚 Docs:收口三处 —— ① AGENTS.md 那句"guardian 每 30 分钟派发"与实现不符(guardian 对该脚本 0 引用),按实录改为"派发层已补建";② JUDGEMENT_LIBS 从两份重复定义合并为单一真相源 scripts/lib/judgement-libs.json(CJS/ESM 共读);③ 补收 14 个漏册高频公共库(flag-value 59 门/code-mask 47 门/selftest-registrant 36 门等),改错会让几十道门静默失效 (d61206d615)
- 🐞 Fix:补建缺失的派发层 sweepStaleClaimMarks + 清两条存量 lint error(tmpdir/DAY_MS 未使用)—— 门 98 的悬空导入(测试引用了从未实现的函数);按测试断言实现:30 分钟节流闸 + 注入式 runner + 结论行解析,拿不到结论行落 undetermined 不记绿 (fd1aaa8ee8)
- 🐞 Fix:补 workflow 溯源水印头 —— 门 47 检出的 HEAD 面欠账(inject 已写工作区,本次提交销账) (52d59c3a62)
- 🔧 Chore/Other:全量守门 workflow 开自动触发(push/PR),先以记录模式跑(continue-on-error) —— 本地无法可靠预测 CI 结果,存量修完后再转拦截模式 (54190217ce)

**2026-10-22**
- 📚 Docs:G-960 公网入口断流旧副本转注释归并(正主为已撤回误判的修订版),清 F4 同题两版以过收敛落地闸 (004f9b4e4d)

**2026-10-22**
- 📚 Docs:翻勾守门104 cloudflared存量红收尾条目(记录pg-backup影子漂移同步)+归并活文档重复登记+README测试文件数对齐现算3029 (6299c2911a)

**2026-10-22**
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (56a54d2fd0)
- 📚 Docs:登记 Cloudflare service token 明文本机暴露(6 处副本)待轮换 (915b16d2d2)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (f813b056a8)

**2026-10-22**
- 🐞 Fix:ihui-pg-backup 未送达留痕改投运行态新址 .ihui-agent/state(迁移漏网件;旧址已不存在且读方 ops-watch 只扫新址,不改=备份告警静默丢) (85062fbeba)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b670fc84c5)
- 📚 Docs:登记"生产 web 的真部署承载者未查明"(被指认的 DEPLOYLOOP 13h 零日志、其工作目录从未创建) (d986561468)
- 🐞 Fix:/login 的"有没有前一页可回"改判 history.length>2,撤掉我在生产上恒空的 referrer 条件 (ae71232df9)

**2026-10-22**
- 📚 Docs:undelivered-debt-acks 阅读提示改指运行态新址 .ihui-agent/state(留迁移注记) (7d2f419cc4)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (982e344432)
- 🔧 Chore/Other:结清 G-960(探活尺子已换到真入口并加零信息自曝) (2ea8a2c611)
- 🐞 Fix:模式徽章的 aria-label 不再中英混血,并卡住那条"赌时长"的 e2e 竞态(收掉 CI 唯一剩余红) (56a8b050c8)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3a4c4fef92)

**2026-10-22**
- 🔧 Chore/Other:移除 IDE 残留跟踪件 .arts/settings.json 与 .spec-mode/spec.md,tasks.md(用户明令清理全部 IDE 文件夹,内容留档 git 历史) (8a65c2ca3c)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a67b214ecc)
- 📚 Docs:登记 packages/app 登录屏 32 处可见文案写死中文,并纠正普查里传走的"门失明"误判 (6c47abadca)
- 🔧 Chore/Other:删掉随假入口一起失效的 login-oauth-* 四条样式 (321643eac8)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d0e9deb82f)
- 🔧 Chore/Other:结清 G-958 / G-959(复跑过承载性判据后翻勾),G-957 就地写清剩余面 (66294b81e5)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6eadde96d2)
- 🐞 Fix:摘掉顶着 Google 图标的假入口,H5 微信失败不再导进死路(票 G-957 可验的两格) (4ef8a7340b)
- 🐞 Fix:H5 微信登录失败不再把用户导进拿不回登录态的 webview(票 G-957 两格之一) (68137fb6e5)
- 🐞 Fix:共享登录屏两处硬编码中文取键(票 G-959),并删掉零消费的 shared.login.ssoLogin 死键 (b57d497658)
- 🚀 Feature/Improvement:mobile-auth 的 clientId 改为可配(缺省仍 mobile-rn)——为票 G-957 拆掉第一块砖 (20ac42245c)
- 🐞 Fix:探活尺子的靶换成真入口,并把"整轮全 3xx"从冒认 ok 改成未判定(票 G-960) (6e2e2a1c0b)

**2026-10-22**
- 🔧 Chore/Other:项目运行态自 .workbuddy 迁至 .ihui-agent/state,清理 IDE 残留目录 (c4012eacc3)
- 📚 Docs:守卫参考文档补溯源水印(生成器输出后注入) (f1b0d8e799)
- 🐞 Fix:头像 shape 接上实现(演示页的 square 此前渲染成圆),并给门 128 的 VoiceInput 登记带理由豁免 (b85a07a11e)

**2026-10-22**
- 📚 Docs:守卫参考文档补溯源水印(生成器输出后注入) (f1b0d8e799)
- 🐞 Fix:头像 shape 接上实现(演示页的 square 此前渲染成圆),并给门 128 的 VoiceInput 登记带理由豁免 (b85a07a11e)

**2026-10-22**
- 🐞 Fix:门71统一全文归一比对(行首编号含点号单源);完成即删清扫层提前到工作区自愈后,避免调度停摆 (97d022cc3d)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c45ca90a55)
- 📚 Docs:G-957 出路补两条实测接手事实(已有 mobile-auth 闭环先例 / 其 clientId 写死 / 域名白名单阻塞) (2a4d89d698)
- 🐞 Fix:门71统一全文归一比对(行首编号含点号单源);完成即删清扫层提前到工作区自愈后,避免调度停摆 (02a714b81c)

**2026-10-22**
- 📚 Docs:G-957 出路补两条实测接手事实(已有 mobile-auth 闭环先例 / 其 clientId 写死 / 域名白名单阻塞) (2a4d89d698)
- 🐞 Fix:门71统一全文归一比对(行首编号含点号单源);完成即删清扫层提前到工作区自愈后,避免调度停摆 (02a714b81c)

**2026-10-22**
- 🚀 Feature/Improvement:头像尺寸档收进跨端唯一表,小程序按定档整体升一档(门 128 Avatar 族) (967c222c24)
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
