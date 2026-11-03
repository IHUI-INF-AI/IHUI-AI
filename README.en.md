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

Headline claims (same source as the table below, all live-computed): **619 tables · 4683 API routes ·
25 WebSocket endpoints · 100 catalogued LLMs · 38 platforms auto-publishing · 4021 test files ·
320 engineering gates · 52 CI workflows · 5-language i18n parity · 9 app packages · 16 shared packages ·
14 compose services**.

<!-- BEGIN GENERATED NUMBERS (node scripts/gen-doc-numbers.mjs --markdown) -->
| 指标 | 现值 | 取数键 |
| ---- | ---- | ------ |
| 数据库表 | 619 | `dbTables` |
| schema 文件 | 240 | `dbSchemaFiles` |
| API 路由 | 4683 | `apiRoutes` |
| 路由文件 | 658 | `apiRouteFiles` |
| AI 服务路由 | 628 | `aiServiceRoutes` |
| WebSocket 端点 | 25 | `wsEndpoints` |
| 入库模型清单 | 100 | `llmModels` |
| 发布平台 | 38 | `publishPlatforms` |
| 端应用包 | 9 | `appPackages` |
| 共享包 | 16 | `sharedPackages` |
| CLI 命令文件 | 69 | `cliCommandFiles` |
| CLI 工具文件 | 73 | `cliToolFiles` |
| 语言 | 5 | `i18nLanguages` |
| i18n 作用域 | 7 | `i18nScopes` |
| 语言包 JSON | 35 | `i18nMessageFiles` |
| 测试文件 | 4034 | `testFiles` |
| CI 工作流 | 52 | `ciWorkflows` |
| Compose 服务 | 14 | `composeServices` |
| 工程守门 | 322 | `guardianGates` |
| — blocking | 293 | `guardianBlocking` |
| — warn | 31 | `guardianWarn` |
| 跟踪文件 | 18985 | `trackedFiles` |

上表由 `node scripts/gen-doc-numbers.mjs --markdown` 生成,最后核对日期 2026-11-03。
每个数的来源就写在取数键旁边的实现里(`scripts/gen-doc-numbers.mjs` 的 `SOURCES`),**不得手抄、不得另立第二份**。

> ⚠️ 未判定 1 项:`guardianGates`(runner 里有 1 个重复 id ⇒ 撞号,条目数不可信)

<!-- END GENERATED NUMBERS -->
<!-- END GENERATED NUMBERS -->


## Recent updates (auto-maintained)

<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->
**2026-11-03**
- 📚 Docs:F9 撞号让号(正牌取号器发 Y-3,原 D53 行留痕归档)并摘除滞留已勾行 RP-35 (72ec4879aa)
- 🐞 Fix:摘除合并回灌造成的 DOWNLOAD_PLATFORMS/isDownloadPlatform 重复定义,修 T1 双声明 typecheck 红 (baab5bfadb)
- 🐞 Fix:清掉 downloads.config 重复的 DOWNLOAD_PLATFORMS/isDownloadPlatform 声明（TS2451/TS2456，gate-analyse 与 gate-build 同根因） (dceb324bf1)
- 🐞 Fix:两条长期红的修因 —— 假远端页改同源独立文档(生产 CSP 无 unsafe-eval 时 srcdoc 继承策略拦 eval);登录首屏协议弹窗按真实用户路径处理,并消除共享 LoginForm 与 web 扫码面板的双重协议窗 (ffdd903b73)
- 🔧 Chore/Other:二次合并后按生成器重算四语 README 数字块与最近更新(619 表/4683 路由/4034 测试/322 守门/52 CI) (e857b3fa9e)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (6ca3a30179)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (05be848608)
- 🔧 Chore/Other:考勤词包契约的扫描面从 1 枚扩到 8 枚,并教会它认出"本地转发助手"型取词(票 B71 收口) (69b79aee34)
- 📚 Docs:D53 结清后另登记两格真工作(HTTP 真 404 / 手册 5 章补图),各带现状与出路,不混入已结清行 (c6a39010f2)
- 📚 Docs:结清 D53 文档中心格式层与排版收口(七簇逐簇有凭据,摘本席牌后整行删除) (9a5f4296d1)

**2026-11-03**
- 🔧 Chore/Other:合并 origin/main 后重算四语 README 数字与最近更新、重建三端生成件并重封根护栏 (c497ced6bf)
- 🐞 Fix:恢复被归并丢弃的 unknown 收窄与 e2e 类型导入 (3d7d912572)
- 🐞 Fix:收掉收敛合并的两处后遗症——docs 公开面门重复登记摘除(正号 285),指标存在性门补 R4 文档点名 (657534b221)
- 🐞 Fix:文档中心每页只剩一个 H1 且它必须是本页主题;不存在的 slug 不再把 slug 当标题(票 D53 第八批) (b2267de78c)
- 🔧 Chore/Other:收敛非 required 高频 workflow —— visual-regression/lighthouse/i18n-dead 转 schedule+dispatch,real-db/mirror/style-spec 按 ref 只跑最新,android APK 改 per-ref 取消 (6d42d30f15)

**2026-11-03**
- 🐞 Fix:老格式 Office 预览默认不再外发文件地址,文档中心口径同批改准(票 D53 第七批) (4fe47b7af3)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (ac7a1c3ac3)
- 🔧 Chore/Other:对齐 README.md 头条表/API/测试/守门/CI 五处数字 (72d41e857d)
- 🔧 Chore/Other:对齐 README.en 头条测试文件/守门/CI 三处数字 (12fa52aaa9)
- 🚀 Feature/Improvement:文档中心首页接上数据库那侧,后台发布的文档终于在前台可见(票 D53 第六批·7 簇最后一格) (b53b8e29c6)
- 🔧 Chore/Other:重算四语 README 数字块与活性散文数字(生成器实算面) (3c459e2087)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (48540f650b)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (e746f0ba20)
- 🐞 Fix:重生成离线语言包载荷，去除合并回灌引入的尾部换行 (f5968144d6)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (d7d35fb2cc)
- 🚀 Feature/Improvement:装上「格式登记表↔渲染实现」对账尺 + 更正门 282 头注与注册现实的矛盾(票 D53 第五批) (43523a5807)
- ♻️ Refactor:Drawer 复合间距保持字面量（跨端门 128 静态解值回退） (137d4dcec4)
- 🔧 Chore/Other:活性散文数字对齐生成器实际读数(c9b69e6758 面) (dccd868650)
- 🐞 Fix:从 COLORS_MAPPING 删除已废弃 tertiary 常量并重算 ui-routes 钉 (c9b69e6758)
- 🔧 Chore/Other:数字块重算到 830eb717 + FAQ/头条断言对齐实际 (319213f532)
- 🐞 Fix:收窄家长端鉴权用例 unknown 类型并清零 e2e --no-ignore eslint 报错 (75a9836204)
- 🚀 Feature/Improvement:支付出口移入导航层 + Follow/VideoPlayer 语义登记 + 九屏端口自证测试 (830eb717a3)
- 🚀 Feature/Improvement:校正 AigcList 薄壳对共享屏承接行号的引用 (b569c10672)
- 🔧 Chore/Other:重算四语 README 数字块并刷新最近更新 (e647bf8ab5)
- ♻️ Refactor:间距 rpx 字面量等值落档（CSS var / taroSpacing，weapp 像素零变化） (0ea20bbe01)
- 🔧 Chore/Other:扫码凭证用例确定化 2500ms 轮询触发,消除首轮计时抖动 (ad65d2b05f)
- 🐞 Fix:修掉 runner 两处撞号并重封根护栏 (73e64fd2e2)
- 🐞 Fix:文档中心五页正文表情图标清零+rag 伪表格改语义表格+能力宣称改准(票 D53 第四批) (66c6f4e195)
- ♻️ Refactor:常量/条件字面量与手工收尾字号落档 (89831e5034)
- 🚀 Feature/Improvement:Vip 支付链成功落 PayResult(replace),失败/取消留守;等级横幅入口走 VipUpgrade (2c37223cfd)
- ♻️ Refactor:发布/巡检脚本接入 mobile-download-leg 单源并补一致性断言 (5a9fcadb2e)
- 🚀 Feature/Improvement:ConversationImport 选文件取消/失败经 onToast 明确反馈 (f778f2a752)
- ♻️ Refactor:字号任意值等值落具名档（className 字面量批，零视觉变化） (0fdda86798)
- 🚀 Feature/Improvement:AigcList 切薄壳并给 AigcPublish 接真实上传进度 (ea9e0f60f7)
- 🚀 Feature/Improvement:补 ExamDetail/VipUpgrade 路由并收口 Exam 两屏推送 (a514deeecc)
- 🐞 Fix:给 @ihui/rn-app 替身补出 AgentReview 列表/详情两屏与 props 捕获出口(与真身 154/278 行同步) (73f7fb1242)
- 🐞 Fix:补录 ai-service memory.py 六个 MEMORY_* 兜底码到错误目录并补齐五语词包 (d08f93800e)
- 🔧 Chore/Other:refactor(web)!: 容器 hover 浮起回归 --lift-* 单源并立守门 285 防回潮 (13a919a708)
- 🔧 Chore/Other:main 档不再排队/取消(false 仍会杀掉 pending 的 required run),恢复并行出结论 (3b2e5983cb)
- 🔧 Chore/Other:去掉表达式取模(startup failure),PR 侧改单队列;并发上限 3 (57f2a0fbd9)
- ♻️ Refactor:发布/巡检脚本接入 mobile-download-leg 单源并补一致性断言 (4078b4afcd)
- 🔧 Chore/Other:bump gitleaks/gitleaks-action 2.3.9 -> 3.0.0 (PR #112) —— v3 仅 Node24 运行时(v2 钉 Node20,2026-09-16 起已从 GitHub runner 移除),inputs/outputs/behavior 无变化 (311e770178)
- 🔧 Chore/Other:bump actions/deploy-pages 4.0.5 -> 5.0.1 (PR #113) —— v5 仅 Node24 运行时 + 部署轮询改 backoff/jitter,pin 与上游 tag v5.0.1 一致 (fc70686974)
- 🐞 Fix:给 @ihui/rn-app 替身补出 AgentReview 列表/详情两屏与 props 捕获出口(与真身 154/278 行同步) (7ffcf16a68)
- 🐞 Fix:补录 ai-service memory.py 六个 MEMORY_* 兜底码到错误目录并补齐五语词包 (575a1bd2b7)
- 🔧 Chore/Other:并发闸按 ref 分档(main 取消 + PR 2 槽轮转),e2e 同时占用硬上限 4 (fa5c88025b)
- 🐞 Fix:撞号的文档中心门让号 282→285,重封根护栏,再摘 AGENTS.md 回潮的合并残留标记 (37147a7496)
- 🔧 Chore/Other:分叉收敛后按 HEAD 面重生成 web/miniapp 两枚 ui-routes 产物(合并提交承诺的落地后重生成;门 105 stale→matched) (35bddefbd9)
- ♻️ Refactor:容器 hover 浮起按 2026-11-03 机主二次定档减淡 —— 数值源 --lift-* 单点收敛(位移-4px→-2px,缩放1.015→1.008,两层阴影 6px/12%+30px/25%→3px/6%+18px/12%,暗档同比例),端内不散改 (03d1c4d32e)
- 🔧 Chore/Other:补全 10 个文件的 L2 零宽载荷与水印尾标(scripts/watermark.mjs inject 生成物) (0223f5e987)
- ♻️ Refactor:BannerCarousel 的 50% 白改走设计令牌 rnCssLight.white50 (3d0d31a294)
- 🐞 Fix:收口被整块重复的登记(F6 块级判据的修复出口) (1086dc23ba)
- ⚡ Perf:下载栏的站点腿探测改「本机源站优先」,并给安卓版补上真实体积 (6a324ae21d)
- 🔧 Chore/Other:回退 monorepo 测试分片(实测 3.5%)并修分诊矩阵替换 (986657675d)
- 🔧 Chore/Other:烘焙 0.1.77 更新源与下载页快照 — Gitee 镜像仓为空仓无 main/tag/release,字节对账未判定故保留 GitHub 直链 (694810b9dc)
- 🔧 Chore/Other:停掉 WorkBuddy 回灌腿并把降噪窗口临时拉长到 7 天 (6556ac1b6f)
- 🔧 Chore/Other:版本 bump 0.1.77 — 0.1.76 已发布,本轮以最新 origin/main 重建发布(语义化 patch 递增) (86c77f3d0a)
- 🐞 Fix:WorkBuddy refresh 60 天绝对寿命落库并加 7 天提前预警 (5cc9ccb083)
- ♻️ Refactor:撤除 WorkBuddy 会话同步幽灵定时腿 (684db31ef5)
- 🔧 Chore/Other:补齐 ci-test-shards.mjs 溯源水印(HEAD 面欠账) (e748bb7157)
- 📚 Docs:「运行期真值出口」那行跟代码对齐 —— iOS 已优先走自有站点腿,小程序那一格由实物码判 (9409300768)
- 🐞 Fix:下载端取数层的头注跟现实对齐(iOS 已走站点腿、小程序由实物码说话) (db3763e794)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (8f02bee92a)
- 🔧 Chore/Other:压缩单次 push 墙钟(并发收敛/Docker 层缓存/测试分片,required check 名不变) (5dfdc1fcb8)
- ♻️ Refactor:12 处等值字号落具名档,并给落档器加字重守卫 (da32fc5a1e)
- 🚀 Feature/Improvement:radius 6 档接入 @theme 单源派生,门 77 从只对账改为必须派生 (9cae140f9e)
- 🐞 Fix:重封根护栏清单(门 282/47p 两批注册是纯新增),并摘掉 AGENTS.md 末尾三行合并残留 (b2be1733a3)
- 🐞 Fix:disable non-persistable fields with read-only hint (3d0a63d3ad)
- 🔧 Chore/Other:壳声明件跟随新落承载页(203 条说明符) (960dc3addb)
- 🔧 Chore/Other:增加下载腿手动/定时校验工作流 (418f628e29)
- 🔧 Chore/Other:补三枚 RN 屏溯源水印(合并后 push 门 47p 修复) (9d91dd8bf4)
- 🔧 Chore/Other:合并后同步 README 跟踪文件数(18895) (57a4917e38)
- 🚀 Feature/Improvement:新增下载腿门并把发布链改指单源 (a279d8986e)
- 📚 Docs:收口 Android 下载腿单源与站点上传步骤 (5ce53ef082)
- 🔧 Chore/Other:[deepseek-v4-rn-shell] fix(rn-shell): AgentReviewDetail 详情壳补真 onRetry（按 id 重取列表定位条目） (f8bf031e93)
- 🐞 Fix:docs 阅读面探针盒型断言补齐 width/height(修 TS2339) (34208ce787)
- 🐞 Fix:收窄 tool-display 索引读取类型,恢复 packages/app typecheck 0 红(既存阻塞,非本批功能改动) (9539ea4a0e)
- ♻️ Refactor:测试断言从 Taro.showToast 切到端口层信号 (4bb2f8bfe6)
- 🐞 Fix:ModelEdit 路由补 agentId 参数(DevEnter 已传,缺 id 不落假成功) (b6e791ca42)
- 🔧 Chore/Other:[deepseek-v4-rn-shell] feat(rn-shell): RN 薄壳恢复轮播/菜单/知识星球/FAB/Drawer 并补 AgentReviewDetail 详情壳 (4525ed560a)
- 🐞 Fix:对账尺子加传输层重试与总预算闸,别再天天量不出结论 (e2e718a6db)
- ♻️ Refactor:442 处直呼迁入端口,4 处长文案改 Modal (ee873c0e6a)
- 🔧 Chore/Other:合并后刷新 README 数字块(跟踪文件 18894 / 测试文件 4006) (b917f0096f)
- 🐞 Fix:ModelEdit 保存改真实 PUT /agents/:id 并走 onToast 真失败反馈 (ff41fea387)
- 🐞 Fix:就绪探针放宽 + 队列锁期补登记 + 侧栏分组标题脱离 10px 档 (667d027777)
- 🔧 Chore/Other:APK 定性 dev 包并前置出包门链 (137b52ed22)
- 🚀 Feature/Improvement:门链前置 + AAB 产物 + 验签与体积基线 (d8f5b06a78)
- 🔧 Chore/Other:x (83391fa024)
- 🚀 Feature/Improvement:共享屏补齐轮播/菜单/知识星球/FAB/详情点击可选能力 (16c59f800b)
- 🚀 Feature/Improvement:文档中心公开面健康门装车(编号 282,blocking)+ 补记上一枚占位信息 (119c860fc8)
- ♻️ Refactor:新增小程序宿主 onToast 端口实现 (13dd6e8ddb)
- 🔧 Chore/Other:对账尺子按端档案跑 iOS,派发腿拆成两层 (c8ca880f5f)
- 🔧 Chore/Other:补 knip alias 自检脚本的溯源水印 (d92f6a957f)
- 🔧 Chore/Other:knip 棘轮面收紧 —— rn-compat 构建别名与 Taro 约定入口纳入生成器，清理 209 条死导出并合并重复符号，exports/duplicates/devDeps 三项回绿 (795d606084)
- 🚀 Feature/Improvement:About/LearnDevelop 改走数据层(web 无接口即静态声明) + Profile 补 onToast 端口 (efd8e0bf85)
- 🐞 Fix:补 Ruff I001 + 分诊重跑尊重 working-directory + 守卫用例移出仓库根 (784ec4d642)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (552db15ca2)
- 🚀 Feature/Improvement:考勤后端面补全 票B67 B70 B71 B72 承载层格 (56a6489c6e)
- 🚀 Feature/Improvement:新增允许差异到期回收器(三态 + --gate/--json)并补镜像测试 (0887cd2204)
- 🔧 Chore/Other:F4 反向例补齐「两组真实重复并行计组」 (70c3d516e8)
- 🐞 Fix:修正 --only 段选择器与覆盖段门号 237,自检补全 20 段全覆盖 (19f9a138f3)
- 🐞 Fix:notifyGuardRed 增加可选 policyFile 注入缝,单测与生产策略表解耦 (dbf2531b79)
- 🐞 Fix:两处单行文本断言改多行结构解析 + 重生成 openapi 产物 (a730538dc6)
- 🔧 Chore/Other:对齐补救功能整票回退后的现形,关掉豁免面 (051d975389)
- 🚀 Feature/Improvement:下载栏最后一格改由实物码说话,并给生码链加"文件名与字节同形"闸 (7a468f1ad8)
- 🐞 Fix:verify-guardian-mutex 只认四类硬证据 (51d95e1f1b)
- 🔧 Chore/Other:按 origin/main 源面重生成三端 ui-routes 产物,消 G5 自述钉陈旧 (0b3c68bda9)
- 🐞 Fix:F4 组数口径最小豁免——已归并副本行退出 dupOpenGroups 分母(1→0) (8e8788ef50)
- 🚀 Feature/Improvement:下载栏最后一格改由实物码说话,并给生码链加"文件名与字节同形"闸 (1d81b430e7)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (ef2123786e)
- 🐞 Fix:daemon 入口取锁补传 roundStaleMs (3a7d4b8010)
- 📚 Docs:AiCostLedgerWriteFailures 正文补「首事件也会报」 (a6e2893aef)
- 🐞 Fix:恢复事件不再摘去重档,改为 24h 同身份发送上限 (5d9d529393)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (1fb2f45d04)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (30d2f7ca16)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (3c9a00be72)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (f6d68d470b)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (415b1414a3)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (d365afb360)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (34ba63607b)
- 🚀 Feature/Improvement:账号级 needsReauth 五类归因与 provider×reason 计数 (6f00e6f1d5)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (9b60105652)
- 🔧 Chore/Other:AgentReviewDetail 改判 not-applicable（无 RN 详情路由/入口） (4381683c20)
- 🚀 Feature/Improvement:CoursePlanet/MoreCourse/StudyIndex 接共享屏薄壳 (30a2725d76)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (ae46cd2635)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (45954293cd)
- 🐞 Fix:补齐镜像构建上下文缺失的 postinstall 脚本 (5282f9a93c)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (ce45e49f3f)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (4c8f9d6aca)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (be8220b87d)
- 🐞 Fix:新分支 merge tip 补 push scope 二级推导(47p 31224ms→~1s) (6954f92679)
- 🐞 Fix:签到同步失败当场落日志 + 域外账号按 provider 归因,补调度关闸与归因反向例 (cace48db40)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (3f04652720)
- 🔧 Chore/Other:并发定死 4 worker + testTimeout/hookTimeout 抬到 20s（固化靠 CLI flag 才绿的设置） (f07719c5b3)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (bd75e36dab)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (4eb11de592)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (603ecbfc37)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (ac1469fc5c)
- 🐞 Fix:收敛 app-version store 维度测试两处 TS2532(测试侧非空守卫) (77c120366d)
- 🚀 Feature/Improvement:到人哨兵再加「小程序档位偏离同源」两维(defaulted / literal 净增) (b604096a0b)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (685cd7f884)
- 🐞 Fix:补 windowsHide,销掉门 52 抓出的派生弹窗缺陷(本会话上一枚引入) (a1cc3c3d0d)
- 🚀 Feature/Improvement:给到人哨兵补上「样式档位净增」四维,兑现档位尺那句"净增经 §5e 到人" (13d41f451a)
- 🐞 Fix:push 档门改用 47p,避免与 pre-commit 的 47 撞号(R5) (421b3e3daf)
- 🔧 Chore/Other:夹具钉 git 身份、并发窗口改走离线旗标、取名改判磁盘主面,并同步词表收窄与新增编号族 (0ee72a091c)
- 🐞 Fix:门47 挂进 push 门(只判 push scope)+ 私有索引落盘接入水印预检(事故 0335facba1) (e2d8b52784)
- 🔧 Chore/Other:号池夹具按两位数池宽(99)重建,并同步池式期望值 (0351606d05)
- 🐞 Fix:签到/保活总闸在部署入口默认开,并让启动与 status 可见 (bcdec109c9)
- 🚀 Feature/Improvement:新增门 284「声明承载 vs 真承载」差集棘轮(小程序功能对齐不再按声明计) (abf77f0662)
- 🐞 Fix:测试 DATABASE_URL 兜底改不可用哨兵并硬拒生产 8810 (9fa87280b3)
- 🐞 Fix:about 断言同步宿主端口三参转发 + 摘掉合并带入的 no-console 告警 (b9bceb51b0)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (2a56005f6c)
- 🚀 Feature/Improvement:把守门 251 的修法出口首次上守护周期腿(前置=归属闸与未知旗拒绝) (72650fe783)
- 🔧 Chore/Other:覆盖写路径默认严格与 --legacy-lenient 逃生阀 (9a821daebd)
- 🐞 Fix:严格编号判据改为写路径默认生效，并留 --legacy-lenient 逃生阀 (90fcbe7029)
- 🐞 Fix:测试 Redis 兜底改不可用哨兵并硬拒生产 8811 (bd61b9faa7)
- 🐞 Fix:about 屏跳转夹具补齐 getState + 清掉 useCallback 缺依赖 (5dd12ffd3a)
- 🔧 Chore/Other:覆盖同号重复/带号行解删/空行被吞/无 attestation 四场景 (b30700c44f)
- 🐞 Fix:合并器补严同号重复与我方带号行解删 (e4f24acbb2)
- 🚀 Feature/Improvement:三信封口接入 alert-family-gate,首封必达 + 同族 24h 只留首封 (ab2e6fc1ab)
- 🐞 Fix:号池签到同步失败可定位/可升级 + 同名冲突改用确定性别名 + 保活摘除留痕 (216987682c)
- 🔧 Chore/Other:Revert "fix(i18n): 小程序词包补 career 命名空间七键" —— 撤回,根因是承载关系不在 (92bd78493b)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (63f9ac4a14)
- 🐞 Fix:小程序词包补 career 命名空间七键,消掉"整屏文案取不到"的产物级回归 (909ce225b5)
- 🔧 Chore/Other:分叉决策账本 24 条 owner/到期/证据认领(pending 146→0) (820f29156e)
- 🐞 Fix:补齐 web 间距采集边向前缀与 -px/负向,遮罩注释噪声 (27e755d9b5)
- 🔧 Chore/Other:销 plan-write-invariants 两枚的 HEAD 面水印欠账(假横幅 → 可解码载荷) (47263ad17c)
- 📚 Docs:补 282 与 283 两道已接线门的 R4 点名行,消掉接线层一枚真红 (f56d51306f)
- 🐞 Fix:重新生成契约产物,补齐 9 条已入库但未导出的路径 (f58725d9e1)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (7367e5a195)
- 🐞 Fix:六条新族窗口收到 8h,并带上另三条族窗口 (7a27cabd22)
- 🚀 Feature/Improvement:把 RN 薄壳覆盖判据装上提交链(守门 283,blocking) (e8c610eadb)
- 🔧 Chore/Other:收编守护落档产出(4 件,凭落点账本) (5355177bb8)
- 🐞 Fix:心跳续约锁与另一席巡检块合并落地 (04f580d447)
- 🐞 Fix:落库器每条早退路径都必须出机读结论行(治"器物在跑但说不出话") (6178c8bdf7)
- 🐞 Fix:覆盖门把 evidence 纳入 needsManual 硬判据并补缺 evidence 镜像测试 (60df42dbf4)
- 🐞 Fix:修 lint-typecheck-test 三处报错 —— import() 类型注解改顶层 import type + 去多余非空断言 (9cdb7f9255)
- 🔧 Chore/Other:12 枚 needsManual 全量登记(3 语义不同/5 退役内联/4 手写壳挂账) (296be37c48)
- 🐞 Fix:补齐导航替身 getState 契约并保持 navigate 实参形状 (a7282ff7c4)
- 🐞 Fix:五族窗口收口,族级 24h 只留首封 (0529aa2aaa)
- 🐞 Fix:钩子失败按可重试/非本笔分流,并点名锁持有者 (ac5017c39e)
- 🐞 Fix:ai-career 判为非同源,摘除旧镜像对 (d03f4aba12)
- 🔧 Chore/Other:给 web↔RN 缺口棘轮建真实基线件,脱离"首跑常量"锚 (03be228081)
- 🐞 Fix:QUIC 腿数改读 metrics gauge,netstat 只在 http2 交叉校验 (36bb5bde05)
- 🐞 Fix:邮件双失败后单次后台重试,UNDEL 留最终凭据 (df43cb3e07)
- 🐞 Fix:commit-msg 遵守 --only 的临时索引 (1428656ec0)
- 🐞 Fix:修存量红:段宽期望与实际不一致 (1b172544c3)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (5f728aca25)
- 🚀 Feature/Improvement:新增门 282 web↔RN 覆盖缺口棘轮 (43fe135510)
- 🚀 Feature/Improvement:派生链补 rn-host-shell 段,gen-rn-host-shell 真正上链 (c7339348b7)
- 🐞 Fix:build-static 改按 proxy 反向依赖闭包移出引用者(修 Pages TS2307) (82f59f4550)
- 🐞 Fix:映射块比对改判像素等值,止住 ui-mirror 腿回退他人已入库修复 (6dcfd1d601)
- 🐞 Fix:真 onRetry 取代别名（第 3 批） (8dca03cb7b)
- 🐞 Fix:重注入 agent-chat-stream.ts 的溯源水印载荷 (dde93677f6)
- 🐞 Fix:尊重 --only 的临时索引,堵住 lint-staged 撞 index.lock 与 MM 静默回滚 (b082a600a6)
- 🐞 Fix:CI test-python Ruff 清零(3->0) —— 2 条 I001 自动修 + B905 改 itertools.pairwise (777eb272a4)
- 🔧 Chore/Other:并入 main 末枚后再重算：trackedFiles 18873 (20a0683841)
- 🔧 Chore/Other:并入 main 最新 5 枚后再重算严格档数字：testFiles 4000 / trackedFiles 18870 (0b65b91e57)
- 🚀 Feature/Improvement:新增小程序端口等价表与只读门禁(表/实现/类型键集合三向对账) (a0280a8b94)
- 🔧 Chore/Other:补门 47 水源印：plan-write-invariants 与其镜像测试（main 新入两文件缺 [IHUI-AI-PROVENANCE]，闸已自行注入） (5d649056d1)
- 🐞 Fix:A3 测试的 git 派生显式接管 stdio(门 193) (7f700f94c9)
- 🐞 Fix:真 onRetry 取代别名（第 2 批） (3fa6b98e7a)
- 🐞 Fix:replace 缺失走 CAPABILITY_OFF、tab 语义透传、空实现黑名单与小程序 toast 落地 (14038ab3e4)
- 🔧 Chore/Other:合并后再重算严格档数字：testFiles 3998 / trackedFiles 18867（并入 main 11+6 枚新增测试与脚本） (fb482bd67e)
- 📚 Docs:更正 P0-2/P0-3 头注里的门号引用 (0cf2b9ddc6)
- 🚀 Feature/Improvement:新增写盘不变量库(六条断言) (00d9edda4b)
- 🐞 Fix:严格档把 dup 与租约同键重复判红 (c1300d59c7)
- 🐞 Fix:租约追加同键幂等,重复段拒绝再写 (ec34d3ab47)
- 🐞 Fix:真 onRetry 取代别名（第 1 批） (f8e651a83b)
- 🐞 Fix:回捞拒绝同号多候选,--pick 显式选一枚 (6ffe4b85b9)
- 🐞 Fix:补齐 getState 端口面并把 tabBar 名单收敛为唯一真相源 (27dfe8e87e)
- 🚀 Feature/Improvement:放行两件"器物早已存在、写档从未被放行"的存量落档器,并把归属判据收成单源 (8096a3aff8)
- 🐞 Fix:P0-1/P0-2 新增脚本 lint 未用变量与 prettier 收口 (fb04a6e9ed)
- 🚀 Feature/Improvement:新增非色档分叉 decision 账本对账 decide-style-tier-forks(P0-3) (1fd4311254)
- 🔧 Chore/Other:合并后再重算严格档数字：trackedFiles 18840（新增 iOS 站点腿与测试文件） (03d9b62dff)
- 🚀 Feature/Improvement:新增 web↔RN 覆盖缺口棘轮 check-web-rn-gap-ratchet(P0-2) (7c799be026)
- 🐞 Fix:下载中心未上线平台改走显式「尚未上线」态,并收平平台清单多份真相 (097f73e73b)
- 🐞 Fix:纠正上一枚把 7 个文件发成空 blob 的自伤,并给重放器装上字节自证闸 (d6a5a73b51)
- 🔧 Chore/Other:补齐摘权限插件的水印覆盖(HEAD 面唯一缺口,落地后复跑点名的那条 blocking 就是它) (dd715319dc)
- 🔧 Chore/Other:把 iOS 站点腿中继调度器贴到远端那份 guardian 上(锚点唯一性自证) (c3a1c72b8d)
- 🚀 Feature/Improvement:新增 RN 薄壳直接 import 覆盖判据 check-rn-host-shell-coverage(P0-1) (01a900c030)
- 🔧 Chore/Other:合并后重算严格档数字：testFiles 3996、trackedFiles 18837（合并树新增测试与跟踪文件） (3795f79f88)
- 🐞 Fix:下载中心「尚未上线」态三键补齐五语言 (791b2bcf0e)
- 📚 Docs:补齐 ApkPure 与其余品牌的核实结论,并把 App 备案挂成法律级前置 (d333f3f82a)
- 📚 Docs:Y-70 就地改写为四格动手清单(备案号登记/四家接口凭据/迁移先于上线/三端 store 消费) (133f99596f)
- 🚀 Feature/Improvement:.ipa 改走自有站点腿(指针 302 + 版本副本长缓存),构建产物自己报版本号 (0eda23a561)
- 🚀 Feature/Improvement:各商店提交前的合规对账器 + 摘除一个全仓零引用的危险权限 (1c6aecb1a4)
- 🚀 Feature/Improvement:app_versions 加 store 维度,多渠道各自一条 latest 才表达得出来 (33f26c2d18)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (8581b5c75f)
- 🔧 Chore/Other:补门 47 水源印：agent-chat-stream.ts（远端 SSE 消费出口带入 HEAD 时缺溯源水印） (5cb5e2fe35)
- 🔧 Chore/Other:合并前置：与 d16d78d008 兜底清扫冲突，按真实缺陷保留 Y-14（安卓 latest 行缺失导致更新卡无下载地址） (46197828d3)
- 🐞 Fix:同一 alertId 跨进程原子占位,堵住双跑重复投递 (84cc8a94db)

**2026-11-02**
- 🔧 Chore/Other:解合并卡点：README 自动块刷新 + 严格档数字重算 (1e71ef9b40)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (9065d9cba8)
- 🚀 Feature/Improvement:补齐跨端自愈链的最后一节「落库」,写盘件从此有凭据可入库 (4bbb261050)
- 🚀 Feature/Improvement:桌面发现射程早警 + 各端解析带分页预算自证 (3caef3e395)
- 🔧 Chore/Other:合并前置：还原被并发写坏的计划档并重登记确认行 (f958623743)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (d48ee4d4d3)
- 🔧 Chore/Other:并入 origin/main 后新入库测试的类型收敛(13 条诊断→0) (f2fb1414a8)
- 🔧 Chore/Other:清理 mock/夹具形状与杂项类型残留(909→0) (1447fc2d48)
- 🔧 Chore/Other:DB 夹具 returning 行守卫(TS18048/TS2532 最大簇) (c233a70517)
- 🔧 Chore/Other:对齐 preHandler 与路由工厂调用签名(TS2554 62 + TS2684 2) (430f89344b)
- 🔧 Chore/Other:收敛 inject 包装入参与 method 字面量类型(57 条) (327fad29ca)
- 🚀 Feature/Improvement:按服务名复用轮级锁，锁跳过时回滚预记状态 (74ec597cd7)
- 🔧 Chore/Other:cli-import 响应索引访问补非空断言(TS18048/TS2532) (8209066282)
- 🔧 Chore/Other:setErrorHandler 回调标注 FastifyError(TS18046 340 条) (a544bbd373)
- 🚀 Feature/Improvement:四家商店通道由未判定推进到已证可达,两格仍诚实留未判定 (a83a952cfb)
- 🚀 Feature/Improvement:接入轮级原子锁终结 daemon 与计划任务双跑 (7297e37425)
- 📚 Docs:就地改写 Y-70(四家商店通道已证可达,vivo/OPPO 仍未判定) (233eec47d3)
- 🐞 Fix:按件选根修 8 格未判定——不全局切根,P4a 仍读仓内 .DevEnv (5c8aec3653)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (e2e2250558)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (18aab35379)
- 🐞 Fix:侧栏落点不被运行期资产覆写,并把 iOS 构建期兜底换成真 tag 直链 (227700178b)
- 🐞 Fix:补齐 5 个派发点稳定身份 + 派发点审计去重计数 + 形状锁单行清理 (e875255f52)
- 🚀 Feature/Improvement:下载栏 8 端改取运行期真值,并修掉桌面分页与 iOS 死链 (6a6d193eca)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (8086f74944)
- 🐞 Fix:--audit-new 并行区间不收敛致 10-30 存量每 4h 重投 (1de878d421)
- 🐞 Fix:跨端缺块理由按承载形态分措辞——hand 页不再误报整屏文案取不到 (6a71dc4332)
- 🐞 Fix:状态文件损坏不再静默清零——原子落盘、损坏件备份、未来时间戳不构成压制 (bed9d10121)
- 🐞 Fix:补 shared 五语 career 命名空间——从 mobile-rn 逐字搬 7 键,消跨端词包缺块 (7ee9fc0fa4)
- 📚 Docs:auto-triage 自动登记(mail-failure;第 1 期感知层产线动作,O65) (78576fcda4)
- 🐞 Fix:去重窗口留 10 分钟余量(230min<AM repeat 4h),杜绝重推被误压成 8h (6f1da728de)
- 🐞 Fix:出口被身份窗口压住不得记成已寄出——stdout 处置标记 + 抑制分支只计数不续窗口 (f439a8c84d)
- 🐞 Fix:去重窗口不再被重复推送续期——被抑制的推送只读不写,持续 firing 按窗口重报 (19f67b3b45)
- 📚 Docs:修正 AiLlm 告警注释里 printf 措辞（与 humanizePercentage 模板对齐） (99f9e0ed34)
- 🐞 Fix:修 AiLlm 告警正文把比率当百分比格式化（printf "%.0f%%" → humanizePercentage） (e7bab5a086)

**2026-11-03**

- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (434987ae32)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (a69c95034d)

**2026-11-03**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (682d2b65d3)

**2026-11-03**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (b19d4901bb)

**2026-11-03**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (016ef5e5dc)

**2026-11-03**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (dffec0afec)
- 🐞 Fix:考勤阈值时刻解析补收带秒形态,迟到/早退与每日补缺勤不再静默判不出(票 B67/B71 残余格) (3b29aa1bef)
- 🚀 Feature/Improvement:文档中心余下 4 页接 docs.* i18n 并把 tip 块表情换矢量 Lightbulb(票 D53 第三批·余格) (5d27ad4027)

**2026-11-03**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (28e56a22ac)
- 🔧 Chore/Other:diag-manifest (c3f5d12ac5)

**2026-11-03**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (70912fe3ea)
- 🐞 Fix:文档中心三页伪表格改语义表格+后台文档编辑接 Markdown 预览(票 D53 第二批) (ff07dd5811)

**2026-11-03**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (8bd4b42a48)
- 📚 Docs:本侧 Y-70 让号到 Y-20079(归并新增撞号组 F9 的当场清偿) (eaa4d5ff51)

**2026-11-03**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (17c174997e)

**2026-11-03**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (bf9b34d0db)
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

### Academic admin and attendance in the education vertical (added 2026-11-03 — thresholds, absence back-fill, approval coupling)

Per-class cut-offs for lateness, early leave and absence live in `edu_attendance_rule` (three `HH:MM` thresholds plus the QR signing secret, editable in the web academic console). A scheduled job (`edu-attendance-absent-daily`) back-fills an `absent` row for every enrolled student who has not checked in once the absence threshold passes, so attendance rate is no longer divided by checked-in students only. Approving a leave request writes the matching `leave` rows idempotently in the same transaction. Whole-class batch check-in confirms the affected set against the database (`created · skipped · missedIds`), and attendance exports to CSV. Check-in comes in three modes — `manual`(teacher proxy), `self`(student self-service) and `qrcode`(HMAC-signed QR with a 60-second TTL, rendered on web and RN, scanned on RN and the mini-program). Students get their own attendance page on all three ends through `GET /attendance/me`, which trusts only the authenticated session and resolves ownership server-side; the parent portal reads attendance behind per-endpoint authentication. Face check-in was ruled out instead of stubbed: it would require a third-party face library, liveness detection and consent handling.

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
