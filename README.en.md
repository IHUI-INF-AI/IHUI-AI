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
25 WebSocket endpoints · 100 catalogued LLMs · 38 platforms auto-publishing · 4036 test files ·
322 engineering gates · 52 CI workflows · 5-language i18n parity · 9 app packages · 16 shared packages ·
14 compose services**.

<!-- BEGIN GENERATED NUMBERS (node scripts/gen-doc-numbers.mjs --markdown) -->
| 指标 | 现值 | 取数键 |
| ---- | ---- | ------ |
| 数据库表 | 618 | `dbTables` |
| schema 文件 | 239 | `dbSchemaFiles` |
| API 路由 | 4685 | `apiRoutes` |
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
| 测试文件 | 4045 | `testFiles` |
| CI 工作流 | 53 | `ciWorkflows` |
| Compose 服务 | 14 | `composeServices` |
| 工程守门 | 332 | `guardianGates` |
| — blocking | 302 | `guardianBlocking` |
| — warn | 32 | `guardianWarn` |
| 跟踪文件 | 18989 | `trackedFiles` |

上表由 `node scripts/gen-doc-numbers.mjs --markdown` 生成,最后核对日期 2026-11-04。
每个数的来源就写在取数键旁边的实现里(`scripts/gen-doc-numbers.mjs` 的 `SOURCES`),**不得手抄、不得另立第二份**。

<!-- END GENERATED NUMBERS -->
<!-- END GENERATED NUMBERS -->


## Recent updates (auto-maintained)

<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->
**2026-11-03**
- 🔧 Chore/Other:a1029c579c 并入后派生件重算 —— ui-routes 329 页 / README 近期块×4 / last-sha (c95120eb2a)

**2026-11-03**
- 🔧 Chore/Other:合并后派生件重算 —— ui-routes 329 页 / README 近期块×4 / last-sha (f3a4ce5649)
- 🐞 Fix:计划任务档禁用把 main 单轮链 74 条巡检腿整体停摆 27h —— 恢复任务档 + 游标类两枚同挂 tick (a1029c579c)
- 🐞 Fix:for-each-ref 顶穿默认 1MiB 缓冲 ⇒ 22,298 条"假缺失"的失明根因 (5625a4b4ee)
- 🚀 Feature/Improvement:考勤趋势图的 web 五语言键按 HEAD 面重构后入库(不带走别人已入库的键) (2b53f979d7)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (cd02912f6e)
- 🐞 Fix:daemon tick 补齐隧道腿/短信通道/发起腿/隧道指标 4 个审计派发 (84bdfb5b7f)
- 🚀 Feature/Improvement:教师端考勤统计补真趋势图——同板块成绩页早有图表而考勤页停在进度条 (c76c79dffb)
- 🚀 Feature/Improvement:下载栏八端运行期真值哨兵装车(guardian 30min 轮) (63b4f77013)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (d4a120413d)
- 🔧 Chore/Other:bump nativewind from 4.2.6 to 4.2.7 (774e4e53b0)
- 🐞 Fix:添加按钮桌面点击区补足 32px (3855f738d5)
- 🐞 Fix:O21b create 版本正向用例声明 text/markdown —— md 纳入上传白名单后,octet-stream 会被 MIME 一致性闸判 400 (5d30f42942)

**2026-11-03**
- 🐞 Fix:文档上传再收四档 tsv/json/ods/odp,并把收了却解析不了的那条腿一起补齐(票 D53 第十批,③桶 6 到 1) (405e2a5b46)
- 🐞 Fix:小程序端考勤改口服务端判定,状态档与点名时刻走单一契约文件 (ebc76ae16c)
- 🐞 Fix:补 marketing-fonts.css 溯源水印 (3498fbedec)
- ⚡ Perf:营销首页落地窄字体子集(三字重 1,082,248→213,768 B,−80.2%) (e43d3fb049)
- 🔧 Chore/Other:bump knip from 6.32.2 to 6.44.0 (5ee98040e2)
- 🐞 Fix:手机端考勤改口服务端判定——不再自报状态、"早退"有色档、代签限当日 (291f063740)
- 🔧 Chore/Other:考勤扫码屏替身 Tappable 扁平 style 再下发,修 react-dom 数组 style 抛错导致的 2 红 (68da14a59e)
- 🔧 Chore/Other:四语 README 数字块与最近更新按生成器重算(跟踪文件 18997),last-sha 随生成器更新 (5794de40d7)
- 🐞 Fix:小程序 Platform.OS 类型轴补 web 修共享层 TS2367;两处 git 派生测试补显式 stdio (bed67d45fd)
- 🔧 Chore/Other:root-guard 清单按现盘复核重封(guardian-runner 号位顺延后) (189decba97)
- 🐞 Fix:并行入库撞号收口——props 对账 285→288、web↔RN 缺口棘轮 286→289,重复 id 归零 (5e50ac8f86)
- 🔧 Chore/Other:README 活区 testFiles/guardianGates 按生成器现算对齐(4034/323),历史快照区不动 (6ac880c8fc)
- 🔧 Chore/Other:react-native 桩补 Platform/Dimensions,承接共享屏 web/原生间距锁 (defe3f0994)
- 🔧 Chore/Other:合并 origin/main(7afc9413) 后按合并面重算生成件(README×4/ui-routes×3/i18n/root-guard),并清 RP-35 滞留已勾行 (1a89df8894)
- 🐞 Fix:底栏加载态收起 spinner,默认 480 面板恢复单行 (bbceebe19c)
- 🐞 Fix:清 gate-test 存量红（桌面快照翻页、鉴权门桩、横线选择器、历史写入侧取样）并让 scan-hardcoded-zh 自建输出目录 (842954d8bc)
- 🐞 Fix:两格 quic 下 unjudged 的 reason 改归因——点名"quic 结构盲区",不再误写腿断/腿数不足 (523e3bdd37)
- 🔧 Chore/Other:补 scripts/tests/data-json-shape.test.mjs 的溯源水印(门 47 HEAD 面点名) (5d007afdb9)
- 🐞 Fix:工作区自愈两层派生补 timeout —— 一次 --align-drift 挂死能让整轮守护静默 3 小时 (386a71182a)
- 🐞 Fix:考勤屏测试替身过 lint（HostElement 具名、去未用 style），清 gate-analyse 的 [lint] 红 (6e9aaf553b)
- 🐞 Fix:缺勤补录加回溯窗——absent_after 晚于跑批时刻的班级不再永远漏判 (8a9fd219e6)
- 📚 Docs:清理 Gitee 下线后残留的过时注释,避免宣称已不存在的直链 (228e23dce4)
- 🐞 Fix:AI 输入卡底栏按钮重叠:禁止压缩、按优先级收文字并在窄档换行 (2d1939b981)
- 🐞 Fix:教师代签与批量点名不再认客户端自报状态，签退重判让"早退"真有写入路径 (f1f098635e)
- 🐞 Fix:Gitee 下线后不再输出常驻 warn,避免用一种噪音换另一种 (8c928e3283)
- 🔧 Chore/Other:四轮合并后按生成器重算四语 README 数字块与最近更新 (05afa46b95)
- 🐞 Fix:下线空仓 Gitee 发布目标,消除创建标签失败红噪音 (e0869bea5a)
- 🔧 Chore/Other:三轮合并后按生成器重建三端 ui-routes 与小程序 i18n,重算四语 README 数字与最近更新 (aab5de8927)
- ⚡ Perf:36px 图片变体替换两处固定尺寸引用(logo/reddit) (cc40e6b3d0)
- 📚 Docs:F9 撞号让号(正牌取号器发 Y-3,原 D53 行留痕归档)并摘除滞留已勾行 RP-35 (72ec4879aa)
- 🐞 Fix:页脚备案号合规——显示网站号并外链工信部 beian.miit.gov.cn(补实际改动) (4aea31e9a9)
- 🐞 Fix:repair-eo-origin 验证靶改直打源站(修假绿回滚判据) (902e9ed65b)
- 🐞 Fix:知识库上传框收了 md 而后端白名单不收,用户选中必吃 400 —— 白名单补 md、UI 摘掉后端故意拒收的 html/htm(票 D53 第九批) (c52250f555)
- 🚀 Feature/Improvement:proxy 增加 HTTP→HTTPS 301 应用层兜底(判据只认 CDN 正向证据) (374aecc15c)
- 📚 Docs:摘掉收敛写进 HEAD 的三行冲突标记与一条 R4 重复登记副本,体积回到预算内(余量 389 字节) (4fa7c3fd34)
- 📚 Docs:归档件先行——2026-11-03 体积清偿的原文逐字落档(收敛残留标记 3 行 + R4 重复登记副本 1 行 + 尺子行的前像) (f460a82b4e)
- 🐞 Fix:页脚备案号合规——显示网站号并外链工信部 beian.miit.gov.cn (7fac191097)
- ⚡ Perf:36px 图片变体替换两处固定尺寸引用(logo/reddit) (81372b1e93)
- 🔧 Chore/Other:删除死文件 public/wwLogin-1.0.0.js(全仓零引用) (0fa810fa6c)
- 🐞 Fix:静态导出移出 docs/[slug]，空 generateStaticParams 不再阻断构建 (7fd9a596ac)
- ⚡ Perf:PDF worker 长缓存——/pdfjs/* 由 max-age=0 提至 7 天 (f82e28158b)
- 🐞 Fix:摘除合并回灌造成的 DOWNLOAD_PLATFORMS/isDownloadPlatform 重复定义,修 T1 双声明 typecheck 红 (baab5bfadb)
- 🐞 Fix:清掉 downloads.config 重复的 DOWNLOAD_PLATFORMS/isDownloadPlatform 声明（TS2451/TS2456，gate-analyse 与 gate-build 同根因） (dceb324bf1)
- 🐞 Fix:两条长期红的修因 —— 假远端页改同源独立文档(生产 CSP 无 unsafe-eval 时 srcdoc 继承策略拦 eval);登录首屏协议弹窗按真实用户路径处理,并消除共享 LoginForm 与 web 扫码面板的双重协议窗 (ffdd903b73)
- 🔧 Chore/Other:bump tsx from 4.23.12 to 4.23.15 (d94078250f)
- 🔧 Chore/Other:bump @tauri-apps/api from 2.12.1 to 2.12.4 (59f73f26e8)
- 🔧 Chore/Other:告警投递判据表加防误删闸 + scripts/data/*.json 通用形态闸 (755a07df12)
- 🔧 Chore/Other:二次合并后按生成器重算四语 README 数字块与最近更新(619 表/4683 路由/4034 测试/322 守门/52 CI) (e857b3fa9e)
- 🐞 Fix:修掉 zh-TW 下载文案里两处简体「平台」残留(门 2b 落地后复跑点名) (10ad69e61c)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (6ca3a30179)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (05be848608)
- 🔧 Chore/Other:合并 origin/main 后重算四语 README 数字与最近更新、重建三端生成件并重封根护栏 (c497ced6bf)
- 🐞 Fix:恢复被归并丢弃的 unknown 收窄与 e2e 类型导入 (3d7d912572)
- 🔧 Chore/Other:考勤词包契约的扫描面从 1 枚扩到 8 枚,并教会它认出"本地转发助手"型取词(票 B71 收口) (69b79aee34)
- 📚 Docs:D53 结清后另登记两格真工作(HTTP 真 404 / 手册 5 章补图),各带现状与出路,不混入已结清行 (c6a39010f2)
- 🔧 Chore/Other:重封根护栏清单 + 摘 AGENTS 合并残留并压回预算 + 补两处 windowsHide 字面量 (b4faab6d55)
- 📚 Docs:结清 D53 文档中心格式层与排版收口(七簇逐簇有凭据,摘本席牌后整行删除) (9a5f4296d1)
- 🔧 Chore/Other:补齐 9 枚随合并入仓却无载荷的文件,并同批重封根护栏清单 (e1ada60b68)
- 🐞 Fix:收掉收敛合并的两处后遗症——docs 公开面门重复登记摘除(正号 285),指标存在性门补 R4 文档点名 (657534b221)
- 🐞 Fix:文档中心每页只剩一个 H1 且它必须是本页主题;不存在的 slug 不再把 slug 当标题(票 D53 第八批) (b2267de78c)
- 🚀 Feature/Improvement:指标存在性门让号 282→286 装车,根护栏巡检补上「远端 tip」那张脸 (8b56f8a460)
- 🐞 Fix:老格式 Office 预览默认不再外发文件地址,文档中心口径同批改准(票 D53 第七批) (4fe47b7af3)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (ac7a1c3ac3)
- 🔧 Chore/Other:对齐 README.md 头条表/API/测试/守门/CI 五处数字 (72d41e857d)
- 🔧 Chore/Other:对齐 README.en 头条测试文件/守门/CI 三处数字 (12fa52aaa9)
- 🚀 Feature/Improvement:文档中心首页接上数据库那侧,后台发布的文档终于在前台可见(票 D53 第六批·7 簇最后一格) (b53b8e29c6)
- 🔧 Chore/Other:重算四语 README 数字块与活性散文数字(生成器实算面) (3c459e2087)
- 🔧 Chore/Other:收敛非 required 高频 workflow —— visual-regression/lighthouse/i18n-dead 转 schedule+dispatch,real-db/mirror/style-spec 按 ref 只跑最新,android APK 改 per-ref 取消 (6d42d30f15)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (e746f0ba20)
- 🚀 Feature/Improvement:装上「格式登记表↔渲染实现」对账尺 + 更正门 282 头注与注册现实的矛盾(票 D53 第五批) (43523a5807)
- 🐞 Fix:收窄家长端鉴权用例 unknown 类型并清零 e2e --no-ignore eslint 报错 (75a9836204)
- 🐞 Fix:文档中心五页正文表情图标清零+rag 伪表格改语义表格+能力宣称改准(票 D53 第四批) (66c6f4e195)
- 🐞 Fix:给 @ihui/rn-app 替身补出 AgentReview 列表/详情两屏与 props 捕获出口(与真身 154/278 行同步) (73f7fb1242)
- 🐞 Fix:补录 ai-service memory.py 六个 MEMORY_* 兜底码到错误目录并补齐五语词包 (d08f93800e)
- 🔧 Chore/Other:main 档不再排队/取消(false 仍会杀掉 pending 的 required run),恢复并行出结论 (3b2e5983cb)
- 🔧 Chore/Other:去掉表达式取模(startup failure),PR 侧改单队列;并发上限 3 (57f2a0fbd9)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (15c45b0bae)
- 🔧 Chore/Other:bump gitleaks/gitleaks-action 2.3.9 -> 3.0.0 (PR #112) —— v3 仅 Node24 运行时(v2 钉 Node20,2026-09-16 起已从 GitHub runner 移除),inputs/outputs/behavior 无变化 (311e770178)
- 🔧 Chore/Other:bump actions/deploy-pages 4.0.5 -> 5.0.1 (PR #113) —— v5 仅 Node24 运行时 + 部署轮询改 backoff/jitter,pin 与上游 tag v5.0.1 一致 (fc70686974)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (434987ae32)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (a69c95034d)
- 🔧 Chore/Other:并发闸按 ref 分档(main 取消 + PR 2 槽轮转),e2e 同时占用硬上限 4 (fa5c88025b)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (682d2b65d3)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (b19d4901bb)
- 🐞 Fix:撞号的文档中心门让号 282→285,重封根护栏,再摘 AGENTS.md 回潮的合并残留标记 (37147a7496)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (016ef5e5dc)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (dffec0afec)
- 🐞 Fix:考勤阈值时刻解析补收带秒形态,迟到/早退与每日补缺勤不再静默判不出(票 B67/B71 残余格) (3b29aa1bef)
- 🚀 Feature/Improvement:文档中心余下 4 页接 docs.* i18n 并把 tip 块表情换矢量 Lightbulb(票 D53 第三批·余格) (5d27ad4027)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (28e56a22ac)
- 🔧 Chore/Other:diag-manifest (c3f5d12ac5)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (70912fe3ea)
- 🐞 Fix:文档中心三页伪表格改语义表格+后台文档编辑接 Markdown 预览(票 D53 第二批) (ff07dd5811)
- 🐞 Fix:收口被整块重复的登记(F6 块级判据的修复出口) (1086dc23ba)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (8bd4b42a48)
- 📚 Docs:本侧 Y-70 让号到 Y-20079(归并新增撞号组 F9 的当场清偿) (eaa4d5ff51)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (17c174997e)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (bf9b34d0db)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (0fff93a09c)
- 🔧 Chore/Other:回退 monorepo 测试分片(实测 3.5%)并修分诊矩阵替换 (986657675d)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (696ab99e91)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (8248d8dcc7)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (c5c0586a4a)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (3969eafae0)
- 🚀 Feature/Improvement:小程序考勤页接上代签/签退与整班点名(票 B72 小程序腿) (19a08e0fa0)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (bf71375c7f)
- 🐞 Fix:修掉门 282 自带的 2 条类型错误(该腿本地不红、CI 会红) (9d98965011)
- 🔧 Chore/Other:停掉 WorkBuddy 回灌腿并把降噪窗口临时拉长到 7 天 (6556ac1b6f)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (b58037ca86)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (fb238de69e)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (1e4502da88)
- 🐞 Fix:撤回 Button|geometry 与 Button|radius 两条永不命中的允许差异登记(存量债改由 web 腿锚点承担) (50b982eeb0)
- 🐞 Fix:WorkBuddy refresh 60 天绝对寿命落库并加 7 天提前预警 (5cc9ccb083)
- 🔧 Chore/Other:把 WD Button 实测存量钉进 web 腿锚点(几何 12 / 圆角 2) (686ecc1db4)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (853d6aa959)
- ♻️ Refactor:撤除 WorkBuddy 会话同步幽灵定时腿 (684db31ef5)
- 🚀 Feature/Improvement:代码块接上语法高亮,复用对话流既有形态(票 D53) (3ca376e9c8)
- 📚 Docs:登记 WD Button 几何与圆角两维为带到期的允许差异(到期 2026-11-17) (81051824fc)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (a5d5975971)
- 🚀 Feature/Improvement:文档中心文案抽进 docs.* 命名空间,五语言同批齐备(票 D53) (ef8a1a3f9c)
- 🔧 Chore/Other:补齐 ci-test-shards.mjs 溯源水印(HEAD 面欠账) (e748bb7157)
- 🐞 Fix:面板 tooltip 字号脱离 11px 字面量,归到 caption 角色档 (259c615623)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (24ed9b91f5)
- 🔧 Chore/Other:压缩单次 push 墙钟(并发收敛/Docker 层缓存/测试分片,required check 名不变) (5dfdc1fcb8)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (0e166ea090)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (03abe577f7)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (c7d0a84638)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (d58fdb106f)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (2a94268b4e)
- 🚀 Feature/Improvement:考勤端上面收口 票B67 B70 B72 三端可见可操作可配置 (286ce1da49)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (153bf2b63d)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (f018abb84b)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (884719fa8e)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (22205c4117)
- 🐞 Fix:游客态手机打开文档站不再被面板整屏遮住(票 D53 第二枚) (704ae4ed73)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (06507c867d)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (1d2c6be761)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (cd48067b9d)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (bc0de68629)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (5c8563bed1)
- 🐞 Fix:notifyGuardRed 增加可选 policyFile 注入缝,单测与生产策略表解耦 (dbf2531b79)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (ab0f41ac16)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (4743c6882e)
- 🔧 Chore/Other:对齐补救功能整票回退后的现形,关掉豁免面 (051d975389)
- 🚀 Feature/Improvement:文档页内目录组件落地(仅组件与用例,挂载待页面席结清后同批) (50c62a2dd0)
- 🐞 Fix:verify-guardian-mutex 只认四类硬证据 (51d95e1f1b)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (318d219ba2)
- 🐞 Fix:daemon 入口取锁补传 roundStaleMs (3a7d4b8010)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (fd21ed3065)
- 🐞 Fix:就绪探针放宽 + 队列锁期补登记 + 侧栏分组标题脱离 10px 档 (8bfa76bddb)
- 📚 Docs:AiCostLedgerWriteFailures 正文补「首事件也会报」 (a6e2893aef)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (274d22ec99)
- 🚀 Feature/Improvement:考勤后端面补全 票B67 B70 B71 B72 承载层格 (5d1e160ebc)
- 🐞 Fix:恢复事件不再摘去重档,改为 24h 同身份发送上限 (5d9d529393)
- 🚀 Feature/Improvement:文档中心公开面健康门装车(编号 282,blocking)+ 补记上一枚占位信息 (54e17854b2)
- 🚀 Feature/Improvement:三信封口接入 alert-family-gate,首封必达 + 同族 24h 只留首封 (ab2e6fc1ab)
- 🐞 Fix:六条新族窗口收到 8h,并带上另三条族窗口 (7a27cabd22)
- 🐞 Fix:心跳续约锁与另一席巡检块合并落地 (04f580d447)
- 🐞 Fix:五族窗口收口,族级 24h 只留首封 (0529aa2aaa)
- 🐞 Fix:钩子失败按可重试/非本笔分流,并点名锁持有者 (ac5017c39e)
- 🐞 Fix:ai-career 判为非同源,摘除旧镜像对 (d03f4aba12)
- 🐞 Fix:QUIC 腿数改读 metrics gauge,netstat 只在 http2 交叉校验 (36bb5bde05)
- 🐞 Fix:邮件双失败后单次后台重试,UNDEL 留最终凭据 (df43cb3e07)
- 🐞 Fix:commit-msg 遵守 --only 的临时索引 (1428656ec0)
- 📚 Docs:auto-triage 自动登记(api-logs;第 1 期感知层产线动作,O65) (aa859c014b)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (e92e623473)
- 📚 Docs:auto-triage 自动登记(api-logs;第 1 期感知层产线动作,O65) (ef806aa543)
- 🐞 Fix:尊重 --only 的临时索引,堵住 lint-staged 撞 index.lock 与 MM 静默回滚 (b082a600a6)
- 📚 Docs:auto-triage 自动登记(api-logs;第 1 期感知层产线动作,O65) (d6b41fae4f)
- 🔧 Chore/Other:x (8701732dfd)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (4070d7a682)
- 🐞 Fix:同一 alertId 跨进程原子占位,堵住双跑重复投递 (84cc8a94db)
- 📚 Docs:认领文档中心格式层与排版收口票(7 簇并行,主席统一落地) (89b014b18a)

**2026-11-02**
- 🚀 Feature/Improvement:按服务名复用轮级锁，锁跳过时回滚预记状态 (74ec597cd7)
- 🚀 Feature/Improvement:接入轮级原子锁终结 daemon 与计划任务双跑 (7297e37425)
- 🐞 Fix:按件选根修 8 格未判定——不全局切根,P4a 仍读仓内 .DevEnv (5c8aec3653)
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
- 🚀 Feature/Improvement:新增小程序交互卫生门(290)与 web↔RN 措辞一致性门(291) (f664fb52e9)
- 🚀 Feature/Improvement:落语义等价映射表 + 门285 mapped 分类与棘轮 —— 3 条命名等价(onPress↔onTap×2、label↔labelKey)归 mapped 4 键,漂移 277→273;表扩容须同轮收敛 (2ccede4e8e)
- 🔧 Chore/Other:补齐 gen-rn-shell-scaffold 与 rn-shell-target 两枚溯源水印欠账 (e343c19714)
- 🐞 Fix:门 289 补射程声明 stagedTriggers ['**/*'] —— check-gate-triggers 新增缺 1→0(到期与暂存面无关,必须每提交跑) (75768f75a5)
- 🚀 Feature/Improvement:deferred@ 到期判据常驻(门 289,blocking) (fec71850ab)
- 🚀 Feature/Improvement:覆盖门增补「新屏无壳且无判决」造壳命令队列(既有读数不变) (5f258fd86a)
- 🚀 Feature/Improvement:新增 gen-rn-shell-scaffold 预演式造壳器(默认 dry-run/--force 先备份/6 例自检) (9eaf14ef2f)
- 🐞 Fix:结清 P84/P85/P86 + 摘 RP-91 重复副本 + 结清 docs-207 (848e4a4f46)
- 🐞 Fix:收口被整块重复的登记(F6 块级判据的修复出口) (e61c494fc5)
- 🔧 Chore/Other:登记 B72/D04/D05 处置 (a1ee9465bf)
- 🔧 Chore/Other:登记 B72/D04/D05 处置 (d9ed3e722f)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (0af18824e2)
- 🔧 Chore/Other:RP-79 dedupe theirs (plan-union-merge input) (c3a32de7d7)
- 🐞 Fix:ColorfulLoader 两端同源收口 —— RN 补 visible(不渲染即 null)、小程序适配层补 duration(默认共享档),门285 消 2 键 (657b9ed59f)
- 🔧 Chore/Other:store-migration-end-factory 冷启动移出用例窗口——全量超时 flake 的确定化收口 (3b72141949)
- 🐞 Fix:门 30a 悬空 commit 分档——等价残留(仅树逐字同)不判红,四档逐次报数 (18a0179a49)

**2026-11-03**
- 🐞 Fix:小程序 Platform.OS 类型轴补 web 修共享层 TS2367;两处 git 派生测试补显式 stdio (bed67d45fd)
- 🔧 Chore/Other:root-guard 清单按现盘复核重封(guardian-runner 号位顺延后) (189decba97)
- 🐞 Fix:并行入库撞号收口——props 对账 285→288、web↔RN 缺口棘轮 286→289,重复 id 归零 (5e50ac8f86)
- 🔧 Chore/Other:README 活区 testFiles/guardianGates 按生成器现算对齐(4034/323),历史快照区不动 (6ac880c8fc)
- 🔧 Chore/Other:react-native 桩补 Platform/Dimensions,承接共享屏 web/原生间距锁 (defe3f0994)
- 🔧 Chore/Other:合并 origin/main(7afc9413) 后按合并面重算生成件(README×4/ui-routes×3/i18n/root-guard),并清 RP-35 滞留已勾行 (1a89df8894)
- 🐞 Fix:清 gate-test 存量红（桌面快照翻页、鉴权门桩、横线选择器、历史写入侧取样）并让 scan-hardcoded-zh 自建输出目录 (842954d8bc)
- 🐞 Fix:两格 quic 下 unjudged 的 reason 改归因——点名"quic 结构盲区",不再误写腿断/腿数不足 (523e3bdd37)
- 🔧 Chore/Other:补 scripts/tests/data-json-shape.test.mjs 的溯源水印(门 47 HEAD 面点名) (5d007afdb9)
- 🐞 Fix:工作区自愈两层派生补 timeout —— 一次 --align-drift 挂死能让整轮守护静默 3 小时 (386a71182a)
- 🐞 Fix:考勤屏测试替身过 lint（HostElement 具名、去未用 style），清 gate-analyse 的 [lint] 红 (6e9aaf553b)

**2026-11-03**
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (55c2cb04cd)
- 📚 Docs:清理 Gitee 下线后残留的过时注释,避免宣称已不存在的直链 (228e23dce4)
- 🐞 Fix:Gitee 下线后不再输出常驻 warn,避免用一种噪音换另一种 (8c928e3283)
- ♻️ Refactor:共享屏间距 26 处落档 + 2 处 Platform 锁 web 值,销账 18 条 decision (73dfd3f56c)
- 🐞 Fix:B02② 会话切换时 chatSync 判据面与 resyncPending 一起换人(同 id 重设不动,补 1 条判据测试) (03b1cec6db)
- 🐞 Fix:下线空仓 Gitee 发布目标,消除创建标签失败红噪音 (e0869bea5a)
- 🐞 Fix:PayPopup 回退误带入的他会话间距中间态，仅保留 ¥ 档位落档 (2ea19b406b)
- 🐞 Fix:RP-1 号域族注册表(RP 多字母族在册,单字母逐字不变)+ O01 空对照面收口为「挂账+到期」; immutable-exempt: 族注册表为新增只读取表,挂账判定只在空对照面改判,既有判红档与退出码语义不动 (73eac1c22b)
- ⚡ Perf:36px 图片变体替换两处固定尺寸引用(logo/reddit) (cc40e6b3d0)
- 🐞 Fix:RP-47×2 staged 面双测试(有暂存必须取索引 blob/暂存为空判未判定不回落工作树) (1952b604cd)
- ♻️ Refactor:钱包/课程/排行等 92 处间距默认档落具名档 (7afdef0638)
- 🐞 Fix:runGate 的 node 分支显式 windowsHide(守门 no-visible-spawn 73 行按面转绿;超时与错误文案不变) (f4e33958fc)
- 🐞 Fix:页脚备案号合规——显示网站号并外链工信部 beian.miit.gov.cn(补实际改动) (4aea31e9a9)
- 🐞 Fix:repair-eo-origin 验证靶改直打源站(修假绿回滚判据) (902e9ed65b)
- 🐞 Fix:出包链 windowsHide 接线回归锁(静态扫描全部 spawn/exec 调用点+门体形态锁,2 项) (f04f0b8ab7)
- 🔧 Chore/Other:D171 形状锁五→六处，点名 O67 发令前只读点名 (fd1fe89c72)
- ♻️ Refactor:门128 几何名额回退 3 处(4/8 档恢复 numeric) (b295cede8c)
- 🚀 Feature/Improvement:proxy 增加 HTTP→HTTPS 301 应用层兜底(判据只认 CDN 正向证据) (374aecc15c)
- 🐞 Fix:18 处人工档位判定·落 8 保 10·不动几何额度 (ec9802df54)
- 📚 Docs:守门 207 体积清偿归零(96,790→95,910) (8e09798d32)
- 🐞 Fix:页脚备案号合规——显示网站号并外链工信部 beian.miit.gov.cn (7fac191097)
- ♻️ Refactor:支付/分销/课程头/简介/VIP/课时 87 处间距默认档落具名档 (9772113c78)
- ⚡ Perf:36px 图片变体替换两处固定尺寸引用(logo/reddit) (81372b1e93)
- 🔧 Chore/Other:删除死文件 public/wwLogin-1.0.0.js(全仓零引用) (0fa810fa6c)
- ⚡ Perf:PDF worker 长缓存——/pdfjs/* 由 max-age=0 提至 7 天 (f82e28158b)
- ♻️ Refactor:共享屏 17/28/32/36 字号落 title/displayLg 档·10 处 (7a241e4d3e)
- ♻️ Refactor:模型配置/运行时/评论 92 处间距默认档落具名档 (d32e043698)
- ♻️ Refactor:共享屏 22px 标题/数值落 heading 20 档·71 处 (d2f150f983)
- 🔧 Chore/Other:告警投递判据表加防误删闸 + scripts/data/*.json 通用形态闸 (755a07df12)
- 🐞 Fix:默认永不跳钩,锁重试收窄为 3 次/指数退避/60s,新增 --allow-skip-hooks (c3898fdb14)
- 🐞 Fix:修掉 zh-TW 下载文案里两处简体「平台」残留(门 2b 落地后复跑点名) (10ad69e61c)
- 🔧 Chore/Other:提交后格式化回流 2 文件 (1eac95dcd6)
- 🔧 Chore/Other:重封根护栏清单 + 摘 AGENTS 合并残留并压回预算 + 补两处 windowsHide 字面量 (b4faab6d55)
- ♻️ Refactor:默认档等值落具名档·课程批 73 处 (904cb347c2)
- ♻️ Refactor:默认档等值落具名档·屏级批 58 处 (511fcc7b95)
- ♻️ Refactor:默认档等值落具名档·组件批 68 处 (766687c346)
- 🐞 Fix:--next-id 拒发池外号,池满点名改走 next-plan-id(G-44/G-54) (42f6d6414f)
- 🔧 Chore/Other:补齐 9 枚随合并入仓却无载荷的文件,并同批重封根护栏清单 (e1ada60b68)
- ♻️ Refactor:销账 6 条已全清 decision、补细 19 条挂账证据 (903c6cee1a)
- ♻️ Refactor:22px 上边距落 xl 20 档、30px 内边距落 3xl 32 档 (d5a54b93f4)
- ♻️ Refactor:18px 间距落 lg 16 档、30px 落 3xl 32 档 (83617072bc)
- 📚 Docs:门 287 号位现读回灌两枚残留 —— hover 门入库时与同批 props 对账门撞 285,落地腿已把 runner 注册块与门体头注顺延为 287(HEAD 面在位);本枚对齐其余两处字面:README 点名条 runner id 与 UI/样式尾注、镜像⑦形状锁号位 regex+文案(prettier 归位后水印已复验完整)。README 盘上派生块(跟踪文件 18947/收编行,可重算件)随本枚带落;props 门自身与其 285 条目未触碰。盘面 scripts/guardian-runner.mjs 为已落地历史拷贝的幻影漂移(§5b 形态,P1 对账尺当轮点名),已按 30c 出路②单文件 checkout HEAD 对齐——零丢失(盘 blob 系上一枚落地态,本票文字全部已入 HEAD)。 (1c9cdb39c2)
- ♻️ Refactor:17/32/40/12.5 字号落 title/displayLg/label 档 (4e11292057)
- 🔧 Chore/Other:结清 B67/B70/B71、G-1222560/59/56 与 Z-1 两条(证据见行内) (85f1c08855)
- 🚀 Feature/Improvement:指标存在性门让号 282→286 装车,根护栏巡检补上「远端 tip」那张脸 (8b56f8a460)
- ♻️ Refactor:22px 金额/标题落 heading 20 档 (2be9294d5f)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (14cdb641cc)

**2026-11-03**
- 🔧 Chore/Other:四轮合并后按生成器重算四语 README 数字块与最近更新 (05afa46b95)
- 🔧 Chore/Other:三轮合并后按生成器重建三端 ui-routes 与小程序 i18n,重算四语 README 数字与最近更新 (aab5de8927)
- 📚 Docs:F9 撞号让号(正牌取号器发 Y-3,原 D53 行留痕归档)并摘除滞留已勾行 RP-35 (72ec4879aa)
- 🐞 Fix:知识库上传框收了 md 而后端白名单不收,用户选中必吃 400 —— 白名单补 md、UI 摘掉后端故意拒收的 html/htm(票 D53 第九批) (c52250f555)
- 📚 Docs:摘掉收敛写进 HEAD 的三行冲突标记与一条 R4 重复登记副本,体积回到预算内(余量 389 字节) (4fa7c3fd34)
- 📚 Docs:归档件先行——2026-11-03 体积清偿的原文逐字落档(收敛残留标记 3 行 + R4 重复登记副本 1 行 + 尺子行的前像) (f460a82b4e)
- 🐞 Fix:静态导出移出 docs/[slug]，空 generateStaticParams 不再阻断构建 (7fd9a596ac)
- 🐞 Fix:摘除合并回灌造成的 DOWNLOAD_PLATFORMS/isDownloadPlatform 重复定义,修 T1 双声明 typecheck 红 (baab5bfadb)
- 🐞 Fix:清掉 downloads.config 重复的 DOWNLOAD_PLATFORMS/isDownloadPlatform 声明（TS2451/TS2456，gate-analyse 与 gate-build 同根因） (dceb324bf1)
- 🐞 Fix:两条长期红的修因 —— 假远端页改同源独立文档(生产 CSP 无 unsafe-eval 时 srcdoc 继承策略拦 eval);登录首屏协议弹窗按真实用户路径处理,并消除共享 LoginForm 与 web 扫码面板的双重协议窗 (ffdd903b73)
- 🔧 Chore/Other:二次合并后按生成器重算四语 README 数字块与最近更新(619 表/4683 路由/4034 测试/322 守门/52 CI) (e857b3fa9e)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (6ca3a30179)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (05be848608)
- 🔧 Chore/Other:合并 origin/main 后重算四语 README 数字与最近更新、重建三端生成件并重封根护栏 (c497ced6bf)
- 🐞 Fix:恢复被归并丢弃的 unknown 收窄与 e2e 类型导入 (3d7d912572)
- 🔧 Chore/Other:考勤词包契约的扫描面从 1 枚扩到 8 枚,并教会它认出"本地转发助手"型取词(票 B71 收口) (69b79aee34)
- 📚 Docs:D53 结清后另登记两格真工作(HTTP 真 404 / 手册 5 章补图),各带现状与出路,不混入已结清行 (c6a39010f2)
- 📚 Docs:结清 D53 文档中心格式层与排版收口(七簇逐簇有凭据,摘本席牌后整行删除) (9a5f4296d1)
- 🐞 Fix:收掉收敛合并的两处后遗症——docs 公开面门重复登记摘除(正号 285),指标存在性门补 R4 文档点名 (657534b221)
- 🐞 Fix:文档中心每页只剩一个 H1 且它必须是本页主题;不存在的 slug 不再把 slug 当标题(票 D53 第八批) (b2267de78c)
- 🐞 Fix:老格式 Office 预览默认不再外发文件地址,文档中心口径同批改准(票 D53 第七批) (4fe47b7af3)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (ac7a1c3ac3)
- 🔧 Chore/Other:对齐 README.md 头条表/API/测试/守门/CI 五处数字 (72d41e857d)
- 🔧 Chore/Other:对齐 README.en 头条测试文件/守门/CI 三处数字 (12fa52aaa9)
- 🚀 Feature/Improvement:文档中心首页接上数据库那侧,后台发布的文档终于在前台可见(票 D53 第六批·7 簇最后一格) (b53b8e29c6)
- 🔧 Chore/Other:重算四语 README 数字块与活性散文数字(生成器实算面) (3c459e2087)
- 🔧 Chore/Other:收敛非 required 高频 workflow —— visual-regression/lighthouse/i18n-dead 转 schedule+dispatch,real-db/mirror/style-spec 按 ref 只跑最新,android APK 改 per-ref 取消 (6d42d30f15)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (e746f0ba20)
- 🚀 Feature/Improvement:装上「格式登记表↔渲染实现」对账尺 + 更正门 282 头注与注册现实的矛盾(票 D53 第五批) (43523a5807)
- 🐞 Fix:收窄家长端鉴权用例 unknown 类型并清零 e2e --no-ignore eslint 报错 (75a9836204)
- 🐞 Fix:文档中心五页正文表情图标清零+rag 伪表格改语义表格+能力宣称改准(票 D53 第四批) (66c6f4e195)
- 🐞 Fix:给 @ihui/rn-app 替身补出 AgentReview 列表/详情两屏与 props 捕获出口(与真身 154/278 行同步) (73f7fb1242)
- 🐞 Fix:补录 ai-service memory.py 六个 MEMORY_* 兜底码到错误目录并补齐五语词包 (d08f93800e)
- 🔧 Chore/Other:main 档不再排队/取消(false 仍会杀掉 pending 的 required run),恢复并行出结论 (3b2e5983cb)
- 🔧 Chore/Other:去掉表达式取模(startup failure),PR 侧改单队列;并发上限 3 (57f2a0fbd9)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (15c45b0bae)
- 🔧 Chore/Other:bump gitleaks/gitleaks-action 2.3.9 -> 3.0.0 (PR #112) —— v3 仅 Node24 运行时(v2 钉 Node20,2026-09-16 起已从 GitHub runner 移除),inputs/outputs/behavior 无变化 (311e770178)
- 🔧 Chore/Other:bump actions/deploy-pages 4.0.5 -> 5.0.1 (PR #113) —— v5 仅 Node24 运行时 + 部署轮询改 backoff/jitter,pin 与上游 tag v5.0.1 一致 (fc70686974)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (434987ae32)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (a69c95034d)
- 🔧 Chore/Other:并发闸按 ref 分档(main 取消 + PR 2 槽轮转),e2e 同时占用硬上限 4 (fa5c88025b)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (682d2b65d3)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (b19d4901bb)
- 🐞 Fix:撞号的文档中心门让号 282→285,重封根护栏,再摘 AGENTS.md 回潮的合并残留标记 (37147a7496)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (016ef5e5dc)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (dffec0afec)
- 🐞 Fix:考勤阈值时刻解析补收带秒形态,迟到/早退与每日补缺勤不再静默判不出(票 B67/B71 残余格) (3b29aa1bef)
- 🚀 Feature/Improvement:文档中心余下 4 页接 docs.* i18n 并把 tip 块表情换矢量 Lightbulb(票 D53 第三批·余格) (5d27ad4027)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (28e56a22ac)
- 🔧 Chore/Other:diag-manifest (c3f5d12ac5)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (70912fe3ea)
- 🐞 Fix:文档中心三页伪表格改语义表格+后台文档编辑接 Markdown 预览(票 D53 第二批) (ff07dd5811)
- 🐞 Fix:收口被整块重复的登记(F6 块级判据的修复出口) (1086dc23ba)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (8bd4b42a48)
- 📚 Docs:本侧 Y-70 让号到 Y-20079(归并新增撞号组 F9 的当场清偿) (eaa4d5ff51)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (17c174997e)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (bf9b34d0db)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (0fff93a09c)
- 🔧 Chore/Other:回退 monorepo 测试分片(实测 3.5%)并修分诊矩阵替换 (986657675d)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (696ab99e91)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (8248d8dcc7)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (c5c0586a4a)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (3969eafae0)
- 🚀 Feature/Improvement:小程序考勤页接上代签/签退与整班点名(票 B72 小程序腿) (19a08e0fa0)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (bf71375c7f)
- 🐞 Fix:修掉门 282 自带的 2 条类型错误(该腿本地不红、CI 会红) (9d98965011)
- 🔧 Chore/Other:停掉 WorkBuddy 回灌腿并把降噪窗口临时拉长到 7 天 (6556ac1b6f)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (b58037ca86)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (fb238de69e)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (1e4502da88)
- 🐞 Fix:撤回 Button|geometry 与 Button|radius 两条永不命中的允许差异登记(存量债改由 web 腿锚点承担) (50b982eeb0)
- 🐞 Fix:WorkBuddy refresh 60 天绝对寿命落库并加 7 天提前预警 (5cc9ccb083)
- 🔧 Chore/Other:把 WD Button 实测存量钉进 web 腿锚点(几何 12 / 圆角 2) (686ecc1db4)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (853d6aa959)
- ♻️ Refactor:撤除 WorkBuddy 会话同步幽灵定时腿 (684db31ef5)
- 🚀 Feature/Improvement:代码块接上语法高亮,复用对话流既有形态(票 D53) (3ca376e9c8)
- 📚 Docs:登记 WD Button 几何与圆角两维为带到期的允许差异(到期 2026-11-17) (81051824fc)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (a5d5975971)
- 🚀 Feature/Improvement:文档中心文案抽进 docs.* 命名空间,五语言同批齐备(票 D53) (ef8a1a3f9c)
- 🔧 Chore/Other:补齐 ci-test-shards.mjs 溯源水印(HEAD 面欠账) (e748bb7157)
- 🐞 Fix:面板 tooltip 字号脱离 11px 字面量,归到 caption 角色档 (259c615623)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (24ed9b91f5)
- 🔧 Chore/Other:压缩单次 push 墙钟(并发收敛/Docker 层缓存/测试分片,required check 名不变) (5dfdc1fcb8)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (0e166ea090)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (03abe577f7)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (c7d0a84638)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (d58fdb106f)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (2a94268b4e)
- 🚀 Feature/Improvement:考勤端上面收口 票B67 B70 B72 三端可见可操作可配置 (286ce1da49)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (153bf2b63d)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (f018abb84b)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (884719fa8e)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (22205c4117)
- 🐞 Fix:游客态手机打开文档站不再被面板整屏遮住(票 D53 第二枚) (704ae4ed73)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (06507c867d)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (1d2c6be761)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (cd48067b9d)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (bc0de68629)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (5c8563bed1)
- 🐞 Fix:notifyGuardRed 增加可选 policyFile 注入缝,单测与生产策略表解耦 (dbf2531b79)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (ab0f41ac16)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (4743c6882e)
- 🔧 Chore/Other:对齐补救功能整票回退后的现形,关掉豁免面 (051d975389)
- 🚀 Feature/Improvement:文档页内目录组件落地(仅组件与用例,挂载待页面席结清后同批) (50c62a2dd0)
- 🐞 Fix:verify-guardian-mutex 只认四类硬证据 (51d95e1f1b)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (318d219ba2)
- 🐞 Fix:daemon 入口取锁补传 roundStaleMs (3a7d4b8010)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (fd21ed3065)
- 🐞 Fix:就绪探针放宽 + 队列锁期补登记 + 侧栏分组标题脱离 10px 档 (8bfa76bddb)
- 📚 Docs:AiCostLedgerWriteFailures 正文补「首事件也会报」 (a6e2893aef)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (274d22ec99)
- 🚀 Feature/Improvement:考勤后端面补全 票B67 B70 B71 B72 承载层格 (5d1e160ebc)
- 🐞 Fix:恢复事件不再摘去重档,改为 24h 同身份发送上限 (5d9d529393)
- 🚀 Feature/Improvement:文档中心公开面健康门装车(编号 282,blocking)+ 补记上一枚占位信息 (54e17854b2)
- 🚀 Feature/Improvement:三信封口接入 alert-family-gate,首封必达 + 同族 24h 只留首封 (ab2e6fc1ab)
- 🐞 Fix:六条新族窗口收到 8h,并带上另三条族窗口 (7a27cabd22)
- 🐞 Fix:心跳续约锁与另一席巡检块合并落地 (04f580d447)
- 🐞 Fix:五族窗口收口,族级 24h 只留首封 (0529aa2aaa)
- 🐞 Fix:钩子失败按可重试/非本笔分流,并点名锁持有者 (ac5017c39e)
- 🐞 Fix:ai-career 判为非同源,摘除旧镜像对 (d03f4aba12)
- 🐞 Fix:QUIC 腿数改读 metrics gauge,netstat 只在 http2 交叉校验 (36bb5bde05)
- 🐞 Fix:邮件双失败后单次后台重试,UNDEL 留最终凭据 (df43cb3e07)
- 🐞 Fix:commit-msg 遵守 --only 的临时索引 (1428656ec0)
- 📚 Docs:auto-triage 自动登记(api-logs;第 1 期感知层产线动作,O65) (aa859c014b)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (e92e623473)
- 📚 Docs:auto-triage 自动登记(api-logs;第 1 期感知层产线动作,O65) (ef806aa543)
- 🐞 Fix:尊重 --only 的临时索引,堵住 lint-staged 撞 index.lock 与 MM 静默回滚 (b082a600a6)
- 📚 Docs:auto-triage 自动登记(api-logs;第 1 期感知层产线动作,O65) (d6b41fae4f)
- 🔧 Chore/Other:x (8701732dfd)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (4070d7a682)
- 🐞 Fix:同一 alertId 跨进程原子占位,堵住双跑重复投递 (84cc8a94db)
- 📚 Docs:认领文档中心格式层与排版收口票(7 簇并行,主席统一落地) (89b014b18a)

**2026-11-02**
- 🚀 Feature/Improvement:按服务名复用轮级锁，锁跳过时回滚预记状态 (74ec597cd7)
- 🚀 Feature/Improvement:接入轮级原子锁终结 daemon 与计划任务双跑 (7297e37425)
- 🐞 Fix:按件选根修 8 格未判定——不全局切根,P4a 仍读仓内 .DevEnv (5c8aec3653)
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
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (48540f650b)

**2026-11-03**
- 🐞 Fix:重生成离线语言包载荷，去除合并回灌引入的尾部换行 (f5968144d6)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (d7d35fb2cc)
- ♻️ Refactor:Drawer 复合间距保持字面量（跨端门 128 静态解值回退） (137d4dcec4)
- 🔧 Chore/Other:活性散文数字对齐生成器实际读数(c9b69e6758 面) (dccd868650)
- 🐞 Fix:从 COLORS_MAPPING 删除已废弃 tertiary 常量并重算 ui-routes 钉 (c9b69e6758)
- 🔧 Chore/Other:数字块重算到 830eb717 + FAQ/头条断言对齐实际 (319213f532)

**2026-11-03**
- 🚀 Feature/Improvement:支付出口移入导航层 + Follow/VideoPlayer 语义登记 + 九屏端口自证测试 (830eb717a3)
- 🚀 Feature/Improvement:校正 AigcList 薄壳对共享屏承接行号的引用 (b569c10672)
- 🔧 Chore/Other:重算四语 README 数字块并刷新最近更新 (e647bf8ab5)
- ♻️ Refactor:间距 rpx 字面量等值落档（CSS var / taroSpacing，weapp 像素零变化） (0ea20bbe01)

**2026-11-03**
- 🔧 Chore/Other:扫码凭证用例确定化 2500ms 轮询触发,消除首轮计时抖动 (ad65d2b05f)
- 🐞 Fix:修掉 runner 两处撞号并重封根护栏 (73e64fd2e2)
- ♻️ Refactor:常量/条件字面量与手工收尾字号落档 (89831e5034)
- 🚀 Feature/Improvement:Vip 支付链成功落 PayResult(replace),失败/取消留守;等级横幅入口走 VipUpgrade (2c37223cfd)
- ♻️ Refactor:发布/巡检脚本接入 mobile-download-leg 单源并补一致性断言 (5a9fcadb2e)
- 🚀 Feature/Improvement:ConversationImport 选文件取消/失败经 onToast 明确反馈 (f778f2a752)
- ♻️ Refactor:字号任意值等值落具名档（className 字面量批，零视觉变化） (0fdda86798)
- 🚀 Feature/Improvement:AigcList 切薄壳并给 AigcPublish 接真实上传进度 (ea9e0f60f7)
- 🚀 Feature/Improvement:补 ExamDetail/VipUpgrade 路由并收口 Exam 两屏推送 (a514deeecc)
- 🔧 Chore/Other:refactor(web)!: 容器 hover 浮起回归 --lift-* 单源并立守门 285 防回潮 (13a919a708)
- ♻️ Refactor:发布/巡检脚本接入 mobile-download-leg 单源并补一致性断言 (4078b4afcd)
- 🐞 Fix:给 @ihui/rn-app 替身补出 AgentReview 列表/详情两屏与 props 捕获出口(与真身 154/278 行同步) (7ffcf16a68)
- 🐞 Fix:补录 ai-service memory.py 六个 MEMORY_* 兜底码到错误目录并补齐五语词包 (575a1bd2b7)
- 🔧 Chore/Other:分叉收敛后按 HEAD 面重生成 web/miniapp 两枚 ui-routes 产物(合并提交承诺的落地后重生成;门 105 stale→matched) (35bddefbd9)

**2026-11-03**
- ♻️ Refactor:容器 hover 浮起按 2026-11-03 机主二次定档减淡 —— 数值源 --lift-* 单点收敛(位移-4px→-2px,缩放1.015→1.008,两层阴影 6px/12%+30px/25%→3px/6%+18px/12%,暗档同比例),端内不散改 (03d1c4d32e)

**2026-11-03**
- 🔧 Chore/Other:补全 10 个文件的 L2 零宽载荷与水印尾标(scripts/watermark.mjs inject 生成物) (0223f5e987)
- ♻️ Refactor:BannerCarousel 的 50% 白改走设计令牌 rnCssLight.white50 (3d0d31a294)
- ⚡ Perf:下载栏的站点腿探测改「本机源站优先」,并给安卓版补上真实体积 (6a324ae21d)
- 🔧 Chore/Other:烘焙 0.1.77 更新源与下载页快照 — Gitee 镜像仓为空仓无 main/tag/release,字节对账未判定故保留 GitHub 直链 (694810b9dc)
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
