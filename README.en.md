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

Headline claims (same source as the table below, all live-computed): **database tables · API routes ·
WebSocket endpoints · LLMs · multi-platform auto-publishing · test file counts in the generated table below ·
engineering gates · CI workflows · i18n parity · app and shared packages · compose services**.

<!-- BEGIN GENERATED NUMBERS (node scripts/gen-doc-numbers.mjs --markdown) -->
| 指标 | 现值 | 取数键 |
| ---- | ---- | ------ |
| 数据库表 | 630 | `dbTables` |
| schema 文件 | 242 | `dbSchemaFiles` |
| API 路由 | 4745 | `apiRoutes` |
| 路由文件 | 689 | `apiRouteFiles` |
| AI 服务路由 | 676 | `aiServiceRoutes` |
| WebSocket 端点 | 30 | `wsEndpoints` |
| 入库模型清单 | 100 | `llmModels` |
| 发布平台 | 38 | `publishPlatforms` |
| 端应用包 | 9 | `appPackages` |
| 共享包 | 17 | `sharedPackages` |
| CLI 命令文件 | 75 | `cliCommandFiles` |
| CLI 工具文件 | 103 | `cliToolFiles` |
| 语言 | 5 | `i18nLanguages` |
| i18n 作用域 | 7 | `i18nScopes` |
| 语言包 JSON | 35 | `i18nMessageFiles` |
| 测试文件 | 4842 | `testFiles` |
| CI 工作流 | 59 | `ciWorkflows` |
| Compose 服务 | 14 | `composeServices` |
| 工程守门 | 357 | `guardianGates` |
| — blocking | 328 | `guardianBlocking` |
| — warn | 31 | `guardianWarn` |
| 跟踪文件 | 20934 | `trackedFiles` |

上表由 `node scripts/sync-readme-numbers.mjs`(唯一写入口,索引面取数)生成,最后核对日期 2026-11-10。
每个数的来源就写在取数键旁边的实现里(`scripts/gen-doc-numbers.mjs` 的 `SOURCES`),**不得手抄、不得另立第二份**。

<!-- END GENERATED NUMBERS -->


## Recent updates (auto-maintained)

<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->
**2026-11-10**
- 📚 Docs:刷新生成块数字(trackedFiles 20930→20934,并入远端 4 个新脚本路径) (cb64a7fd1c)
- 🔧 Chore/Other:同步小程序 entry 清单(新增 2 枚壳承载页后页面数 331→333) (13e9ad2c96)
- 🐞 Fix:侧边栏选中态降对比 —— 统一 sidebar-active 弱底(明暗主题) (104ed9e8f9)
- 🐞 Fix:豆包跨号会话云端归档腿 + 一键入口文案据实测更新 (8068aa017c)
- 🚀 Feature/Improvement:号池导入支持批量与生产推送，全池迁生产收敛为一条命令 (da8d7b0606)
- 📚 Docs:刷新生成块数字(relay 长连接 4 文件并入致 trackedFiles+4/testFiles+2/wsEndpoints+1/apiRoutes+1) (993f458ebf)
- 🔧 Chore/Other:壳声明件跟随新落承载页(258 条说明符) (a83db3919e)
- 🔧 Chore/Other:自动落 2 枚小程序壳承载页(共 4 枚待产) (7ce25c7a45)
- 🐞 Fix:会话对账器补字节级兜底 —— 库被清空也不再是盲区 (df6082c173)
- 🐞 Fix:base.css 第二份源纳入小程序 token 同步触发面 并补全 T1 配套断言 (36d956d285)
- 🔧 Chore/Other:补 relay 长连接 4 个新增文件的溯源水印 (45e114f364)
- 🚀 Feature/Improvement:号池 relay 全链路长连接贯通(契约+传输层+选路+WS 入口) (87e9aad2af)
- 🚀 Feature/Improvement:对话随行落到实处 + WorkBuddy/OpenCode 写回真打通 (250ec2e0e3)
- 🐞 Fix:补 miniapp-taro 词包 eduAi 命名空间 20 键 清门 302p (9ea36e90cb)
- 🐞 Fix:豆包 chat 打通 —— POST /chat/completion + SSE,推翻「走长连接」误判 (5414871662)
- 🔧 Chore/Other:补两枚判据面收敛提交的具名追认行 (636bde6529)
- 🐞 Fix:豆包 chat 打通 —— POST /chat/completion + SSE,推翻「走长连接」误判 (44404bb5e2)
- 🔧 Chore/Other:ui-routes 四端重算 + knip 受管块同步 (External-Red-Audit / Push-Channel: direct-merge) (94dcbdd310)
- 🔧 Chore/Other:生成器重算收口 — sync-readme-numbers / gen-ui-routes / gen-i18n-compressed / gen-knip (External-Red-Audit / Push-Channel: direct-merge) (3cc4c48fdb)
- 🐞 Fix:收尾修复 — 门 128 platform 非法 + docs 同步 + RN 残留清理 (55b19ffe08)
- 🐞 Fix:豆包适配器判活改走 IM batch_get,实证替换全部推断值 (57f105e3f0)
- 🐞 Fix:豆包适配器判活改走 IM batch_get,实证替换全部推断值 (00a62e9b2e)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (0ba0746bb8)
- 🐞 Fix:修掉「写了但客户端不认」的两型 —— MiniMax 记录形状污染 + OpenCode v2 落点失效 (0c17085f7d)
- 🐞 Fix:余额端点二次实证纠正(改 points/records + 100001 非失效,避免误杀有效号) (68c93885b4)
- 🐞 Fix:余额端点实证落地(域名+路径+token 头三重纠错,缺票不判死) (ffcff7a443)
- 🐞 Fix:一键切号写回腿根治 + 缺模板拒写 + 会话模板回填器物 (136b39adff)
- 🚀 Feature/Improvement:小程序/RN 中文回退链同源 + RN 端自托管方案根因收口 (9fb83e175b)
- 🚀 Feature/Improvement:web 正文 400 档分段 unicode-range 按需面 + 门 313 跨端触发面补齐 (57d84775b4)
- 🚀 Feature/Improvement:一键切号窗口实时显示各平台余额(未支持如实标注,不编 0) (c1aebcd0ac)
- 🔧 Chore/Other:裸 git 派生迁 gitRaw 层 收口棘轮例19 (450f453118)
- 🐞 Fix:收口 gate-test(6) 两枚 Linux 专属红(abort 漏判 + 原子写夹具漂移) (3e662520bc)
- 🐞 Fix:修复永久保活号静默饿死(server 档未判定放行 + minimax 探针接线 + 1h 节拍) (6a6c3cfcd4)
- 🚀 Feature/Improvement:门 313 登记维断判据根治 + 属主登记补漏 + token 档位同源 (9dd458b22b)
- ♻️ Refactor:门体自检的 cat-file 取材收敛到 face-reader 取材层 (a8ad54d211)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (aef27ba3d9)
- 📚 Docs:数字块按 HEAD 面重算（与推门 check-doc-numbers 同面） (7c9999939f)
- 🐞 Fix:补迁 check-hook-chain-refs 的跨行裸 git 派生 (46dd3e0b86)
- 🐞 Fix:五处裸 git 派生迁到统一承载层 gitRaw（清门193与测试面两条欠账） (264c676468)
- 🐞 Fix:门313 补 T4 书写面臂——品牌/子集/display 族所在栈一律配中文现代黑体兜底 (d786ae8aef)
- ⚡ Perf:接线对账门多模式 grep 分片,真仓全量 43.8s→8.7s (a381e3a33f)
- 🐞 Fix:恢复 /llm/models 路由挂载并消除 build_model_catalog 自递归 (3e8fdd3d4d)
- 🚀 Feature/Improvement:三端滚动边缘淡出 ScrollEdgeFades + 抽屉/底部遮罩细化 (acdd5f169e)
- ⚡ Perf:祖先取材改逐路径并发,18 条 M 路径 44.8s→19.4s (c6bb81e584)
- ⚡ Perf:祖先取材按 HEAD+路径记忆,同轮不再为同一路径走两遍全历史 (d0b4aad671)
- ⚡ Perf:3b 对账延后到后台 + 逐路径覆盖结论缓存,提交链 116.7s→28s (7ab84a9314)
- ⚡ Perf:水印提交档分母收窄到本次携带,单门 24.5s→1.0s (0cf426141b)
- ⚡ Perf:30a 悬空集合单列缓存,提交链守门实测 309s→69s (775ca7e783)
- 🐞 Fix:合并后按 token 档归一 inline-question-card 字号与字重 (10e5b33bb5)

**2026-11-08**
- 🚀 Feature/Improvement:补齐 AI 生成显式/隐式标识 (8d972f386c)
- 🚀 Feature/Improvement:补齐 AI 生成显式/隐式标识 (f4535c338e)
- 🚀 Feature/Improvement:Groups 屏薄壳承载落地(RN 壳同源渲染,词条取 web 原文) (e7d27e3e99)

**2026-11-07**
- 🐞 Fix:补 web 端 apiKeys en/ko 译文(24 键,清门 4 pending) (5e1c14de23)
- 🐞 Fix:四屏壳改桶导入,补门173共享屏直接 import 覆盖 (e71cd19a5d)
- 🚀 Feature/Improvement:TeamKnowledge 屏下沉共享屏,RN/Web 同源渲染零降级 (c0ca814f16)
- 🔧 Chore/Other:重算 rn-shells.generated.d.ts（补 VipTraderScreen，修门 251 C9 不同步） (fa6c08282d)
- 🐞 Fix:RepoWiki 生成禁用提示回到宿主(详情内重复入口去重后补齐可发现性;删 web 失用键 refresh/regenerate) (a3dc7d1bc5)
- 🚀 Feature/Improvement:RepoWiki 共享屏下沉(RN/Web 同源渲染,零降级) (b37e84d18c)
- 🐞 Fix:Groups 三列断点卡片基宽 (97cb9752de)
- 🚀 Feature/Improvement:Groups 屏下沉共享屏,两端宿主注入 (39fcfc991b)
- 🚀 Feature/Improvement:Patrol 屏下沉共享屏,两端宿主注入 (cd9a85fea2)
- 🚀 Feature/Improvement:ApiKeys 屏下沉共享屏,web/mobile-rn 五语言词表补齐 (10f86bc743)
- ♻️ Refactor:EarnCommission 壳删冗余 View 层(共享屏根已等价提供 flex+背景) (62cb2eaa1f)
- 🚀 Feature/Improvement:TokenValue 记录时间范围条下沉共享屏(数据型注入点,RN/小程序同源) (e7c52e45ba)
- 🚀 Feature/Improvement:8 条单端槽位裁决落锁,2 条真下沉 (72a500c115)
- 🔧 Chore/Other:再 rebase 后生成器取胜, 刷新 ui-routes 钉值与 README 数字 (5c833a7bbc)

**2026-11-06**
- 🚀 Feature/Improvement:补齐 Team/MessageCenter/ArticleList/Coupon 行为型 prop 跨端缺口并清理死契约 (a872076ccc)

**2026-11-10**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (248f785cdb)

**2026-11-10**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (58ff04350e)
- 🐞 Fix:收口 shard 下游 40 项测试红(checkpoints 拆层 + worktree 守卫次序 + 普查面对齐) (1d74cb4f50)

**2026-11-10**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (51c0c84e6c)
- ⚡ Perf:接线对账门多模式 grep 分片,真仓全量 43.8s→8.7s (b3b69ab321)

**2026-11-10**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (c224f786e6)

**2026-11-10**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (d3aa620a76)

**2026-11-10**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (b470d0ec08)

**2026-11-10**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (5f53dfa375)
- 🔧 Chore/Other:离线包按 HEAD 面重生成——清合并票记账「落地后需重生成」欠账;gen --head 输入=HEAD 面词包(他席在飞磁盘内容不烤包),3 gen.ts 同步(4 CDN b64 与 HEAD 恒等零变化),B2/stale 钉收敛;门298红点名为他席滞留磁盘档非本票声明集(pathspec 不进本次内容),经 safe-commit 归因 undetermined-red 后按仓库出路③走本旁路 (3dd977d158)
- 🚀 Feature/Improvement:三端滚动边缘淡出 ScrollEdgeFades + 抽屉/底部遮罩细化 (87084cf084)
- 📚 Docs:数字块按 HEAD 面重算（与推门 check-doc-numbers 同面） (65d93b3390)
- 🔧 Chore/Other:补多行gitBinary形态的反向牙,并更正上一轮的错误归因 (1913e2f971)
- 📚 Docs:README 中文数字块按 HEAD 面重算（与推门 check-doc-numbers 同面） (2db5df9981)
- 📚 Docs:README.en 数字块按 HEAD 面重算（与推门 check-doc-numbers 同面） (4b32f111c1)

**2026-11-10**
- 🐞 Fix:typecheck-full 清缓存增补 .DevEnv/.workbuddy 排除——T1 被看门狗终止的真凶实测定位(cleanTsbuildinfo 对盘根 57000+ 子目录的 .DevEnv 深递归,30s 超时都跑不完);排除后 1248ms 过,全量轮 180s 完成落回执 (c592e24ceb)

**2026-11-10**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (0e10f84bd0)

**2026-11-10**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (ffb5f20a82)
- 🐞 Fix:iOS 站点腿根因三修——出口腿现测借道/取不到不再冒充形状坏/告警身份摘小时数 (4e49779e1d)
- 🐞 Fix:根治界面字体忽粗忽细——GB2312 分档宽子集 + 字重面显式 + 中文黑体回退链 + 门313（重落地） (2d41ff8cbd)
- 🐞 Fix:重生成 miniapp 远端语言包,承载四个工具名五语言文案 (14965b4cdf)
- 🐞 Fix:验证码复制按钮圆角改取档位变量,解守门77 新增红 (b31e2abc08)
- 🐞 Fix:补 ask_user_question/skill/todo_read/todo_write 五语言功能名,守门55 归零 120/120 (d42e720dd0)

**2026-11-10**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (c975820262)
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
### GitHub App webhook async dispatch (registered 2026-11-06 — RP-69)
`POST /api/github-app/webhook` now answers first and processes later (Y-91) on the two dispatch paths, `pull_request` and `issue_comment`.
- **Env var**: `GITHUB_WEBHOOK_RESPONSE_BUDGET_MS` — the response budget in ms. It bounds how long GitHub is kept waiting; it is **not a cancellation timeout**: when the budget expires the handler returns 200 and the job keeps running to completion (no interruption, no retry), still recording the delivery.
- **Default**: 500 ms (`DEFAULT_RESPONSE_BUDGET_MS = 500`, read from source). Missing, non-finite or negative values all fall back to that default rather than being guessed. `0` selects the pure-async mode, which always returns 200 immediately.
- **New response field `dispatch`**: `'inline'` or `'async'`. If the job finishes within the budget the 200 carries `dispatch:'inline'` plus the existing `outcome` (the previous response shape is preserved); when the budget expires — or in `0` mode (`deferred`) — the 200 carries `dispatch:'async'` with no `outcome`, while the heavy work finishes in the background queue.
- **Known gap (deferred is not persisted)**: the dispatch queue is a one-shot in-process, in-memory queue — no resident service, no polling, no durable storage — and the delivery row is written only after the job finishes. If the API process crashes or restarts in the window after a `dispatch:'async'` 200 was sent but before the background job completes, both the in-memory job and the not-yet-written delivery row are lost. GitHub already recorded the delivery as successful and will not redeliver, and the in-process LRU deduper disappears with the process, so that delivery's review / comment write-back is silently lost, cannot be replayed and cannot be reconciled. This window is not closed by the current implementation (the execute-in-place fallback only covers a full backlog, not process exit).

### Account keepalive centre (added 2026-10-26 — two unrelated liveness loops merged into one answer)

Publish-line cookie probing (`services/publish/cookie_refresh_daemon.py`) and AI-platform check-in credentials (`services/checkin_scheduler.py`) used to keep separate switches, separate counters and separate ways of saying "it failed", so the system had **no single answer** to "are these accounts still alive?". The centre (`apps/ai-service/app/services/keepalive/`, HTTP layer in `apps/ai-service/app/routers/keepalive.py`) folds cookie probing, credential (api_key / oauth) expiry detection and check-in JWT health (reads `exp` only, never re-signs) into one schedule, two tables, one health vocabulary and one alert outlet.

| Endpoint | Method | What it answers |
| -------- | ------ | --------------- |
| `/api/keepalive/status` | GET | Self-check: whether it is really on (reason, scheduler liveness, last round, probe list) — never infer it from config |
| `/api/keepalive/overview` | GET | Health roll-up: four buckets, per-source split, needs-attention, expiring soon, 7-day success rate, effective config |
| `/api/keepalive/accounts` | GET | Per-account detail, filterable by `?source=` and `?health=` |
| `/api/keepalive/events` | GET | Probe log, filterable by `?ref=` and `?only_failures=true`; `limit` defaults to 50, caps at 500 |
| `/api/keepalive/stats` | GET | Per-source ok / failed / total / rate over `?days=` (1..90, default 7) |
| `/api/keepalive/run` | POST | Trigger one round in the background and return immediately; `?ref=<source>:<id>` for a single account, `?force=true` to ignore back-off |

- **Health buckets** are computed in exactly one place (`policy.health_of`): `critical` when the last failure was `expired`, the expiry has passed, or consecutive failures reach `ALERT_AFTER_FAILURES`; `warning` while there are consecutive failures, inside the expiry-warning window, or only failures have ever been seen; `healthy` otherwise; `unknown` when neither success nor failure has been recorded. Clients must not recompute them.
- **Failure vocabulary**: `ok` / `expired` / `network` / `error` / `unsupported` / `skipped`, normalised by one entry point (`classify_message`). A ciphertext that will not decrypt (`InvalidTag`, key mismatch) is always `expired` — retrying it a thousand times cannot help, only re-recording the credential can. `unsupported` (nothing to keep alive) counts as neither success nor failure and never lands in `failed`, so it cannot drown real red. Back-off is `base × 2^(n-1)` capped at `RETRY_CAP_SECONDS`, retried at most `RETRY_MAX` times; success clears the counter, the warning stamp and the alert stamp together.
- **Alert outlet**: the site-wide `notifications` table, **one aggregated notification per owner per round** (19 accounts expiring at once must not send 19 messages — users then mute it and never see the real one); non-uuid owners such as `probe-user` are dropped and counted, because one bad owner aborts the whole batch insert; a missing table is reported as a warning rather than pretended delivered. `KEEPALIVE_ALERT_WEBHOOK` adds an extra leg. The whole path is fail-open — a failed notification never interrupts keepalive.
- **Switches**: `KEEPALIVE_ENABLED`, inherited from `COOKIE_REFRESH_ENABLED` / `CHECKIN_CRON_ENABLED` when unset; `resolve_config()` re-reads every round, so an `.env` change takes effect on the next round without a restart. Related defaults: `INTERVAL_HOURS`=6, `RETRY_MAX`=3, `RETRY_BASE_SECONDS`=300, `RETRY_CAP_SECONDS`=21600, `ALERT_AFTER_FAILURES`=3, `ALERT_REPEAT_HOURS`=24, `EXPIRE_WARN_DAYS`=3, `ALERT_INAPP`=true, `PROBE_CONCURRENCY`=4, `EVENT_RETENTION_DAYS`=90.
- **Bounds**: it judges credential liveness only — publishing still belongs to the publish scheduler and daily check-in to `checkin_scheduler`, otherwise one account gets hit by two writers at once. Front end: `apps/web/src/components/publish/KeepaliveCenterPanel.tsx` on `/publish/accounts`; client wrappers in `packages/api-client/src/endpoints/keepalive.ts`.

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

<!-- 2026-11-07 全量收敛归档:本侧相对 base 独有行逐字保留(语义由对侧新版承载,零内容丢失) -->
Headline claims (same source as the table below, all live-computed): **624 tables · 4720 API routes ·
25 WebSocket endpoints · 100 catalogued LLMs · 38 platforms auto-publishing · 4341 test files ·
332 engineering gates · 55 CI workflows · 5-language i18n parity · 9 app packages · 16 shared packages ·
Headline claims (same source as the table below, all live-computed): **624 tables · 4720 API routes ·
Headline claims (same source as the table below, all live-computed): **624 tables · 4720 API routes ·
