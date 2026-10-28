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

Headline claims (same source as the table below, all live-computed): **606 tables · 4562 API routes ·
25 WebSocket endpoints · 101 catalogued LLMs · 38 platforms auto-publishing · 3163 test files ·
273 engineering gates · 50 CI workflows · 5-language i18n parity · 9 app packages · 16 shared packages ·
14 compose services**.

<!-- BEGIN GENERATED NUMBERS (node scripts/gen-doc-numbers.mjs --markdown) -->
| 指标 | 现值 | 取数键 |
| ---- | ---- | ------ |
| 数据库表 | 611 | `dbTables` |
| schema 文件 | 236 | `dbSchemaFiles` |
| API 路由 | 4586 | `apiRoutes` |
| 路由文件 | 641 | `apiRouteFiles` |
| AI 服务路由 | 604 | `aiServiceRoutes` |
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
| 测试文件 | 3483 | `testFiles` |
| CI 工作流 | 50 | `ciWorkflows` |
| Compose 服务 | 14 | `composeServices` |
| 工程守门 | 291 | `guardianGates` |
| — blocking | 265 | `guardianBlocking` |
| — warn | 28 | `guardianWarn` |
| 跟踪文件 | 17019 | `trackedFiles` |

上表由 `node scripts/gen-doc-numbers.mjs --markdown` 生成,最后核对日期 2026-10-28。
每个数的来源就写在取数键旁边的实现里(`scripts/gen-doc-numbers.mjs` 的 `SOURCES`),**不得手抄、不得另立第二份**。

<!-- END GENERATED NUMBERS -->


## Recent updates (auto-maintained)

<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->
**2026-10-28**
- 🐞 Fix:把 api 蓝绿切换脚本与 router 入库——此前从主仓发起的部署每次都要断流 20~30 秒 (00adfa0036a)
- 📚 Docs:G-20 改判注记(认账)—— 模板 10 枚实为全部过审生效(0=通过生效,上一注记自造反序码表判反);真死点=签名 2 枚 rejected(ReviewReply API 面空,控制台看)+ auto 档不含 tencent ⇒ 切换时序:签名生效后 SMS_PROVIDER=tencent,现切会掐验证码。机主动作面收敛为报签名 (be50d7db08b)
- 🐞 Fix:造页/壳落地两阶段给足上限 —— 超时误判会把能跑完的阶段说成「未判定」 (908d5a2199f)
- 🐞 Fix:小程序 token 写回把排版当漂移 —— 拆掉恒红与「每次提交都在制造格式债」 (ee30b624814)
- 🚀 Feature/Improvement:跨端自动同步编排器 —— web→RN→小程序 12 阶段唯一入口 (2d697d6cd4d)
- 📚 Docs:登记号池对标 workbuddy2api-panel 五票(选号策略/任务自动化/授权链接扩容/单机形态/指纹收点) (a44df1d0f5f)
- 🔧 Chore/Other:收编滞留的渲染层平滑度守门,并修掉它压在全仓 push 门上的 2 处类型错误 (be3e20b55df)
- 📚 Docs:更正上一枚对阿里云签名切换的错误结论并回退口径——验证码 DELIVERED 是兜底替发的,不能当新签名可用 (27ad89634e7)
- 📚 Docs:门 44 补「封口链接」档 —— 指向 D:/DevEnv/{Temp,Logs} 的 junction 放行、实体目录仍红 (d4bfe49d627)
- 📚 Docs:§1 完成口径跟上「结清即删」默认,并压回体积预算 (5ee5523cbeb)
- 🔧 Chore/Other:给语音笔记「分组输入框」的圆角补运行时回归锁(门 150 静态判据的运行面) (8b8ee29187e)
- 📚 Docs:§1 完成口径跟上「结清即删」默认(整行删除;回退 LIVE_KEEP_CLOSED_ROW=1) (40c89ce1cdf)
- 📚 Docs:「须真机人验」行的取证指针由 10 位短 sha 改内容锚点(§1 证据指针禁令:短 sha 腐烂率 30.2%,要么全量 40 位要么内容锚点)——改为「/api/admin/api-logs 显式放行公网可达」那枚提交的标题原文;归属桶/勾选态/判据句逐字未动 (c54ef3c321f)
- 🐞 Fix:补上 reaction 三键的 web 五语 —— 上一枚把组件落了,词包却还在他席暂存区 (93fb8726916)
- 🔧 Chore/Other:收编滞留 18 小时的 relay-switch 暂存半成品,并修掉它压在全仓 push 门上的 2 处类型错误 (739a31b94f7)
- 📚 Docs:补 R4 漏点名 ⑨ —— check-live-doc-merge-recall 已接 .husky/post-merge,文档面须可见(门 89 R4) (8bd204a0d69)
- 🚀 Feature/Improvement:reaction 收成三态闭环 —— 读回落地 + 「再点一次撤销」 (50c8bce8277)
- 🐞 Fix:收口 Test 步 13 个失败文件 —— 2 处真缺陷(短信回调 CSRF 豁免被自动收编误删、频控 reset 两面不同语义) + 8 处判据/契约未跟上新实现 (0fd3f2ac2ac)
- 📚 Docs:「须真机人验」行两处过期陈述改判据实测——重启免登录/15min 静默续期两格已留记录(装机版受控 kill+重启 16:07→16:09 仍已登录;16:23 启动→空闲 18min→16:41 点管理导航不弹登录),④ nginx 全量代理四路探针均 401 结构化回码(非 404/502)结清;原写"三项人工记录仍 0 条 ⇒ 未满足"与现读不符,已改。本行仅剩 WebView SSO 一格,且写明 agent 侧不可造该条件(登出机主会话属破坏性动作)——归属桶与判据句逐字未动 (fded8029a35)

**2026-10-28**
- 📚 Docs:闭环票对账注记 —— 登记→派单环两格断点已补(枚 e1228822159 面切换+680e9d3370d 票号环),断点语义从"票号不可解析"改口为"未派单";尾环待一次端到端真实绿再结清 (dabd2552f41)
- 🔧 Chore/Other:OSV 批量升级有已知漏洞的 PyPI 包 (b2464e5899f)
- 🐞 Fix:nodemailer 传递面收敛与根 legacy overrides 节同步 (7d1f2cc2a8a)

**2026-10-28**
- 🐞 Fix:nodemailer 传递面收敛与根 legacy overrides 节同步 (7d1f2cc2a8a)

**2026-10-28**
- 🐞 Fix:安全审计第二刀 npm 侧 overrides 批次 + nodemailer ^10.2.1 (b088f0aa301)
- 🐞 Fix:P0-5 高危动作白名单补执行侧兜底门禁 (c2e35dc36a1)

**2026-10-28**
- 🐞 Fix:验签层增加通知 app_id 与本机 ALIPAY_APP_ID 强比对 (8da9f9cd284)

**2026-10-28**
- 🔧 Chore/Other:结清 HEAD 面缺失的溯源水印 —— check-web-rn-parity.mjs 的载荷在一次 prettier 重排里被吃掉 (c99dd151ed2)
- 📚 Docs:登记 API Key 的 step-up 前置 + 对齐门 173 点名的两处数字 (c3fa1d0381b)

**2026-10-28**
- 🚀 Feature/Improvement:连接期出网守卫 + API Key 挂 step-up + 三登录入口哈希升级对齐 (3fee82d0bc7)

**2026-10-28**
- 🔧 Chore/Other:给 wsGuard 补覆盖面自证——全仓只许有一套 WebSocketServer (3b303c4d1d6)

**2026-10-28**
- 🐞 Fix:两处 SSE 的断连清理挂错信号源——要么流刚建立就变哑、要么每次访问累积一个泄漏 (be8c2574f42)
- 🔧 Chore/Other:收编滞留 18 小时的 relay-switch 暂存半成品,并修掉它压在全仓 push 门上的 2 处类型错误 (48e0a9f69a0)
- 🐞 Fix:收口 Test 步 13 个失败文件 —— 2 处真缺陷(短信回调 CSRF 豁免被自动收编误删、频控 reset 两面不同语义) + 8 处判据/契约未跟上新实现 (9ec6ad819d8)

**2026-10-28**
- 🚀 Feature/Improvement:2FA step-up —— 资金流出动作补第二因子(会话被窃后提现不再只靠令牌) (4c8efc7c632)
- 🚀 Feature/Improvement:装门 257 看守四道抗 DDoS 闸会不会被静默摘掉(点名落 AGENTS 余量) (b2f5cceaf6d)
- 🔧 Chore/Other:check-web-rn-parity 过 prettier 格式化(纯换行重排,水印与逻辑零变更) (c7296c7f6f5)
- 🐞 Fix:SSRF 守卫补两处既存绕过 + relay 出网复检住进发请求那一刻 (3ec2cca7b46)
- 🚀 Feature/Improvement:新增 web↔RN 跨端对账门(仅报告)并注册进 guardian (777923eb0c5)

**2026-10-28**
- 🔧 Chore/Other:生产端第二轮落账 —— 摘除票①(完成即删削尾:出路三件当日已落地 4d55e0fd7bf/92f0d8d88e5/反向夹具) + 金丝雀票复核(生产 checkout 账 22 枚金丝雀真跑过:17 pass/4 rollback/1 unproven;载体已装;wiring 9 格 wired) + 闭环票复核(intake 取值面接生产 checkout 后首枚 O67 实落账;取号池死锁复现待人裁) + G-23 交接页挂载 + G-20 报备复核注记 (f5e6819dc7d)

**2026-10-28**
- 🐞 Fix:部署链补「api 实听者身份」自证 —— 健康 200 证明不了新代码在答(2026-10-28 当天实测的假成功) 现场:部署把生产签出 ff 到新提交、web 换流、/api/health 与 router 都回 200,但监听 8843 的仍是 15:34 那个旧孤儿 node —— 服务"重启"起来的新子进程因端口被占(EADDRINUSE)当场退出,账面却记成部署成功,API 侧修复在生产上根本没上岗(§12f:判据失效的表现永远是安静)。 做法:新增只读尺子 deploy/win/api-listener-freshness.ps1(三态 fresh/stale/undetermined,ASCII 契约行,exit 3 给调用侧当红灯),ihui-deploy.ps1 在两条 api 重启分支之后统一问一次"应答的进程是本轮起来的吗":fresh 记 Ok、stale 报 ALERT STALE-API-LISTENER 并给精确出路(按 pids 逐个 Stop-Process,**禁止按映像名批杀**)、量不到只报未判定(§0.3 两头都不许冒充结论)。 两把尺子写的时候就各带反向对照,过程中真抓到两个坑:① 参数用 [int[]] 接 "8842,8843" 被 .NET 按千分位折成 88428843 ⇒ 两色谁都量不到、整把尺子静默 no-listener(F6 钉死);② PowerShell 变量名大小写不敏感,局部 $ports 覆盖参数 $Ports ⇒ split 在空列表上跑 ⇒ 同样静默 no-listener,而 F3/F5 照样"绿"(F8 形状锁钉死);③ 锚点不带时区标记会被按本地时区解,UTC+8 机上静默差 8 小时,该判 stale 判成 fresh ⇒ 缺时区一律不判定并给反向对照(F4b)。镜像 9 例全过,夹具自开临时监听端口,不碰生产端口与服务。 (8cf02551215)
- 🚀 Feature/Improvement:给 Python 侧也挂总量上界(uvicorn --limit-concurrency 3000) (1f264af5e93)

**2026-10-28**
- 📚 Docs:结清「普通 git merge 绕开 union 判据把结清行按旧形态带回」—— 探测器与 R4 点名两半都已在 HEAD (fb0089d0c02)
- 🐞 Fix:并发守卫补上流式归还通道(它自己正在漏槽)，并装全局连接硬顶 (84e34bb03bf)

**2026-10-28**
- 📚 Docs:给 18:30 落库的活文档回捞探测器补 R4 点名 —— 否则门 89 当场把全链拦住 (8f6f7611b66)
- 📚 Docs:deploy-feedback 自动登记(deploy_outcome;端到端反馈闭环第二切片,O65 自进化系列) (a9cb59ed41e)

**2026-10-28**
- 🐞 Fix:让人机验证「不在岗」这件事在运行期留痕(方向不改) (9d6c6df64b0)
- 🚀 Feature/Improvement:结清即删改为默认 —— 根治「已勾行滞留反复出现」 (2ad7ed6a546)
- 🚀 Feature/Improvement:结清「普通 git merge 合并活文档会绕开 union 判据」——回捞探测腿已落地并接线 (f1d3706f2f4)
- 🚀 Feature/Improvement:普通 git merge 合并活文档的回捞探测器(post-merge 接线,判据复用 liveDocExpectedCounts) (632919a87cf)
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
## The 9 ends (8 apps + 1 Capacitor shell)


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
