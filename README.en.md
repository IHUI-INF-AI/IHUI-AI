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
25 WebSocket endpoints · 100 catalogued LLMs · 38 platforms auto-publishing · 4025 test files ·
322 engineering gates · 52 CI workflows · 5-language i18n parity · 9 app packages · 16 shared packages ·
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
| 工程守门 | 326 | `guardianGates` |
| — blocking | 297 | `guardianBlocking` |
| — warn | 31 | `guardianWarn` |
| 跟踪文件 | 18991 | `trackedFiles` |

上表由 `node scripts/gen-doc-numbers.mjs --markdown` 生成,最后核对日期 2026-11-04。
每个数的来源就写在取数键旁边的实现里(`scripts/gen-doc-numbers.mjs` 的 `SOURCES`),**不得手抄、不得另立第二份**。

<!-- END GENERATED NUMBERS -->
<!-- END GENERATED NUMBERS -->


## Recent updates (auto-maintained)

<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->
**2026-11-04**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (a8f8227ad9)

**2026-11-04**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (dde2283d8c)
- 🐞 Fix:恢复下载详情页被误删的三个展示组件,修复主干编译中断 (a7fc6138d3)
- 🐞 Fix:门291 C组32条挂账清零,RN改取web真源键并摘除旧键 (0605ec255d)
- 🐞 Fix:门 285 证据定位改为按符号名解析，消除加注释即报证据行漂移的误红 (842c0f0b9a)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (4fd158208d)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (61d4502095)
- 🐞 Fix:分片腿加首片看门狗,任何失败都退回原生单流 (61bf95afe2)

**2026-11-04**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (decbaf9b4c)
- 🐞 Fix:B 组收尾补漏（showClear 两端删除、mini robotImage 真渲染） (dcd22d3ccc)
- 🐞 Fix:平台裁决清零(46→0),A组18条真实现/删除,门128两红收口;补 pnpm-lock 记账(解门101 存量红) (2cf8856fd1)
- 🐞 Fix:整包下载改 8 连接分片 + 诚实的速率读数 (7242b9cc3d)

**2026-11-04**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (6dcc3be9c8)

**2026-11-04**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (8e04ad552e)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (4cde28b4d4)

**2026-11-04**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (dcd5d46c43)
- 🐞 Fix:c-drive 默认即扫暂存区，无输入面不再空转报绿 (ce21ce2967)
- 📚 Docs:门45 注释同步空暂存区=0 不适用 (d03d3421ab)
- 🐞 Fix:c-drive 空暂存区按 A 级 check-file-size 口径 = 0 不适用（更正） (15ab31909f)
- ♻️ Refactor:屏级默认档等值落具名档·carte/edu-parent 10 处 (31b1682c69)
- 🐞 Fix:B 级 6 门三态化，取不到输入即 exit 2 (12c11a928f)
- 🚀 Feature/Improvement:跨端写盘腿 tick 落 downgrade/undetermined 两态并接告警面 (682441757b)
- 🐞 Fix:登录页 welcome SVG 按 </svg> 截断,消除裸文本子节点触发的 Text 组件告警 (2892132dbf)
- 🚀 Feature/Improvement:新增真机热更预览通道 rn-live-preview(8809, 自检12/12) (80a4925cb6)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (cd055b78af)
- 🐞 Fix:BottomActionBar 来源面板空声明回退 (cf4c76ff1e)
- 🐞 Fix:LoginPopUp/BackChevron 必选性对齐 (f11df86f5f)
- 🐞 Fix:ModelConfigDialog 死变体删除 (923044485c)
- 🐞 Fix:InputArea/ModelList 死腿删除 (804ee7142a)
- 🐞 Fix:BottomActionBar 手工压缩入口接线与死腿删除 (a7e4a73d7a)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (cbe4ddd32c)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (5ffc1c5120)
- 🐞 Fix:NavBar/VideoPlayer 证据换真 (2ef7755dc4)
- 🐞 Fix:VoiceInput 图片死腿删除 (633b4a018a)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (9795a8effe)
- 🐞 Fix:UserInfoCard onOpenVip 真实现与死字段删除 (67afef48b0)
- 🐞 Fix:LoginPopUp 协议真实现与同槽收敛 (db8e6679cb)
- 🐞 Fix:capability-catalog 门取不到暂存面时改判 exit 2 未判定 (d551e17bc3)
- 🔧 Chore/Other:dedupe 夹具超时放宽到 600s(规避 pnpm 并发持有夹具) (552b8cfc5d)
- 🐞 Fix:底部淡出遮罩渐变段 120→90 —— 机主复看仍点名「顶部有点高」 (f989956df1)
- 🐞 Fix:根治「签名不一致」—— debug 签名不再静默可得,装机前强制证书对账 (45506184a7)
- 🐞 Fix:底部淡出遮罩渐变段 160→120 —— 机主点名「还是高」,同步「我的」页让位量 104→72 (2c32f411d7)
- 🐞 Fix:overlay-zindex 门扫描面为空/文件读不到时改判 exit 2 (c26b9a983a)
- 🐞 Fix:基线落账补记等价映射条数,棘轮字段不再随重落丢失 (beb3a3e6e9)
- 🐞 Fix:event-closure-leak 门取材失败/文件缺失时改判 exit 2 (31cede2149)
- 🔧 Chore/Other:门285 基线重落(存量存差 177→0,judged 166,裁决不适用 2 对) (f92c386395)
- 🐞 Fix:VoiceInput 3 键逐键裁决登记(RN 预留未接线腿) (5538025fff)
- 🐞 Fix:VideoPlayer 3 键逐键裁决登记(原生 Video vs 注入组件/页面标题) (a728994def)
- 🐞 Fix:NavBar 23 键逐键裁决登记(固定槽位 vs RN 泛型动作数组) (d7d23a6822)
- 🐞 Fix:file-size 门取材失败/读不到文件时改判 exit 2 (361b4678f8)
- 🐞 Fix:ModelList 5 键逐键裁决登记(分组 groups vs 平铺 models+currentType) (362de27391)
- 🐞 Fix:ModelConfigDialog 23 键逐键裁决登记(indexa 媒体链路未接/选型拆到 ModelList) (45fe8f9a40)
- 🐞 Fix:LoginPopUp 20 键逐键裁决登记(登录三回调 vs RN 受控弹窗+扁平资料) (91d15877ab)
- 🐞 Fix:IntelligentAssistant robotImage 归矢量字形媒介裁决 (3280b88e47)
- 🐞 Fix:BackChevron 2 键逐键裁决登记(label 端内 i18n 兜底/color 走 token) (c4154d3c81)
- 🐞 Fix:dedupe 门取不到 staged 面/锁文件时改判 exit 2 (137263b6ac)
- 🐞 Fix:BottomActionBar 44 键逐键裁决登记(开关聚合/图标卡入参与 RN 受控腿) (0fe3ce7009)
- 🐞 Fix:InputArea 31 键逐键裁决登记(折叠/模型/语音腿归平台载体) (dfd42f5393)
- 🐞 Fix:Carousel banner↔items 映射登记(3 键转裁决) (d7ab5acac8)
- 🐞 Fix:UserInfoCard 扁平字段真接线 + 报销空 prop 半成品(6 键转裁决) (784d8dfdbb)
- 🐞 Fix:commit-scope 门取不到输入时改判 exit 2 未判定 (9ffeb094b2)
- 🐞 Fix:push-sync 四类折绿分支收口 —— 窗口只降文案不降退出码,祖先/HEAD/清单读数失败一律 exit 2 (e0f8c0e451)
- 🐞 Fix:底部淡出遮罩延伸到屏幕底 —— 胶囊下方那段悬浮间距此前无人覆盖 (3c2e132bf5)

**2026-11-04**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (43f56aa425)
- 🐞 Fix:首页 AI 输入框不再被底部淡出遮罩压住 —— 补小程序已有的那一层 (12b69b48aa)
- 🐞 Fix:校正 push-sync 注释的 rev-list 失败实测读数(本机 bad object exit 1,非 128) (15915596b8)

**2026-11-04**
- 🔧 Chore/Other:收编守护落档产出(5 件,凭落点账本) (cd17b5992d)
- 🐞 Fix:push-sync 读数改三态 —— rev-list 失败/取不到对象不再折算成 ahead=0 假绿,5 例钉三态 (03f58d1a29)
- 🐞 Fix:两处 git 派生补 windowsHide —— 门52 生产面两处判红清零,消除控制台闪窗;staged 面 3 文件 0 违规 (3f5a439b05)
- 🐞 Fix:git 派生调用显式接管 stdio —— 门193 三处判红清零(两枚测试文件),解除 pre-push 阻塞;两测试 14/14 通过 (38f420f6cb)
- 🐞 Fix:写盘闸 HEAD 三态 —— git 取不到不再折成「新增文件」放行 (860fc3e087)

**2026-11-03**
- 🔧 Chore/Other:285 judged 自检改临时夹具 —— 不再钉死真仓行号 (414db88c6b)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (6f77b0a629)
- 📚 Docs:285/289/290/291/292 语义与三条纪律入档 + 逃生变量并入 §6.3 (53cbd16b34)
- 🚀 Feature/Improvement:门285 引入逐键 judged 桶 —— 存差=未实现+未映射+未裁决 (0013f61827)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (1759854c49)
- 🐞 Fix:门290 判据纠偏 + A3 可挂账 + 修真缺陷 (9e6d7fedeb)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (eb67922536)
- 🔧 Chore/Other:账本收敛为 C 组挂账与 A/B/E 裁决,统一 3 处可改调用点并登记 LearnScreen 4 处 web 无键文案 (7337b633c3)
- 🐞 Fix:证书基准拆为官网/Play 上传/Play 应用签名三值并互不校验 (c7274b7f66)
- 🔧 Chore/Other:登记 9 对跨端 props 提案(等价 21 + 平台 141 + FloatBox 整对不适用) (582088f7cd)
- 🐞 Fix:新增 B3 同义键异值判据、common.* 白名单/同字不同义裁决与唯一键去重 (fcb2cc8570)
- 🐞 Fix:门291 P0 将 10 处 RN 硬编码文案改为 web 同源键并补齐 5 语言词包 (dc74afd1bb)
- 🔧 Chore/Other:登记 9 对跨端 props 提案(等价 21 + 平台 141 + FloatBox 整对不适用) (8c63a3b963)
- 🐞 Fix:LoginPopUp 24→20 键 —— RN 补 visible 可选、userInfo 适配、defaultAvatar、onNicknameChange (c5b7f31ae9)
- 🐞 Fix:NavBar 25→23 键 —— 小程序补 subtitle/sticky 真实现，menuIcon 接渲染分支 (db8b3c8c06)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (ffbc1e83bd)
- 🐞 Fix:BottomActionBar 59→56 键 —— RN 真接 placeholder/disabled,小程序真接 isLoading (3356abdcd5)
- 🐞 Fix:VideoPlayer 补齐 autoplay/poster/loading/onPlay/onPause/startPosition (4c44c59a30)
- 🐞 Fix:ModelList 两端补齐选择/加载/动效/样式契约 (29f6d7e7d1)
- 🐞 Fix:ModelConfigDialog 对齐必填漂移 visible/config/onChange/modelType (46b2a8cf4a)
- 🐞 Fix:InputArea 补齐 RN 输入契约 autoFocus/onFocus/onBlur/onKeyboardHeightChange (60fa2ebbea)
- 🔧 Chore/Other:摘除 ColorfulLoader 死副本并重算 ui-routes inputs —— 全仓静态/动态引用为 0,删除后经生成器重算(inputs 611→610、自述钉自洽);门105 保持绿、门285 258 键不变 (72eea3c5d5)
- 📚 Docs:派生块按生成器重算 —— 守门/跟踪文件读数对齐现算,最近更新补齐 48540f6..HEAD (4576ffade7)

**2026-11-03**
- 🔧 Chore/Other:ui-routes 派生件按 HEAD 面重生成(model-edit/apis 两枚输入补钉) (c6c90050fb)
- 🐞 Fix:小程序 model-edit 接上 RN 同一份只读清单,并补派生进程 windowsHide (5133f2817d)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (7755f73e27)
- 🚀 Feature/Improvement:词包搬运器补键级射程(整块之外的单键缺口此前无人判) (0f42f52703)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (29e3c26cc0)
- 🔧 Chore/Other:收编守护落档产出(5 件,凭落点账本) (335d63c7e8)
- 🐞 Fix:门285 将 ScreenStates 判为 not-applicable —— 文件级四组件族容器,非单组件对 (ec90d7b58b)
- 🚀 Feature/Improvement:小程序词包整块缺口首次有器物并挂上自动链 (3c19ced5cd)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (57c6228ab4)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (8548571866)
- 🐞 Fix:SectionHeader 两端同源收口 —— 小程序适配层真接 leading/style/titleStyle/subtitleStyle/accessibilityLabel(容器与文字样式覆盖、ariaLabel 落地),非空 prop;门285 270→265,该对归零;intentional-delete: 该对五键已由实现消除 (b80032e3b9)
- 🐞 Fix:IntelligentAssistant 两端同源收口 —— RN 补 isLoggedIn(登录态文案+隐藏充值,默认 true 零观感变化)与 5 语 loginRequired,tokenQuantity↔tokenBalance 入映射表;门285 273→270;intentional-delete: 该对 tokenQuantity/tokenBalance/isLoggedIn 三键已由映射+实现消除 (9436bdf042)
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
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (55c2cb04cd)
- ♻️ Refactor:共享屏间距 26 处落档 + 2 处 Platform 锁 web 值,销账 18 条 decision (73dfd3f56c)
- 🐞 Fix:B02② 会话切换时 chatSync 判据面与 resyncPending 一起换人(同 id 重设不动,补 1 条判据测试) (03b1cec6db)
- 🐞 Fix:PayPopup 回退误带入的他会话间距中间态，仅保留 ¥ 档位落档 (2ea19b406b)
- 🐞 Fix:RP-1 号域族注册表(RP 多字母族在册,单字母逐字不变)+ O01 空对照面收口为「挂账+到期」; immutable-exempt: 族注册表为新增只读取表,挂账判定只在空对照面改判,既有判红档与退出码语义不动 (73eac1c22b)
- 🐞 Fix:RP-47×2 staged 面双测试(有暂存必须取索引 blob/暂存为空判未判定不回落工作树) (1952b604cd)
- ♻️ Refactor:钱包/课程/排行等 92 处间距默认档落具名档 (7afdef0638)
- 🐞 Fix:runGate 的 node 分支显式 windowsHide(守门 no-visible-spawn 73 行按面转绿;超时与错误文案不变) (f4e33958fc)
- 🐞 Fix:出包链 windowsHide 接线回归锁(静态扫描全部 spawn/exec 调用点+门体形态锁,2 项) (f04f0b8ab7)
- 🔧 Chore/Other:D171 形状锁五→六处，点名 O67 发令前只读点名 (fd1fe89c72)
- ♻️ Refactor:门128 几何名额回退 3 处(4/8 档恢复 numeric) (b295cede8c)
- 🐞 Fix:18 处人工档位判定·落 8 保 10·不动几何额度 (ec9802df54)
- 📚 Docs:守门 207 体积清偿归零(96,790→95,910) (8e09798d32)
- ♻️ Refactor:支付/分销/课程头/简介/VIP/课时 87 处间距默认档落具名档 (9772113c78)
- ♻️ Refactor:共享屏 17/28/32/36 字号落 title/displayLg 档·10 处 (7a241e4d3e)
- ♻️ Refactor:模型配置/运行时/评论 92 处间距默认档落具名档 (d32e043698)
- ♻️ Refactor:共享屏 22px 标题/数值落 heading 20 档·71 处 (d2f150f983)
- 🐞 Fix:默认永不跳钩,锁重试收窄为 3 次/指数退避/60s,新增 --allow-skip-hooks (c3898fdb14)
- 🔧 Chore/Other:提交后格式化回流 2 文件 (1eac95dcd6)
- ♻️ Refactor:默认档等值落具名档·课程批 73 处 (904cb347c2)
- ♻️ Refactor:默认档等值落具名档·屏级批 58 处 (511fcc7b95)
- ♻️ Refactor:默认档等值落具名档·组件批 68 处 (766687c346)
- 🐞 Fix:--next-id 拒发池外号,池满点名改走 next-plan-id(G-44/G-54) (42f6d6414f)
- ♻️ Refactor:销账 6 条已全清 decision、补细 19 条挂账证据 (903c6cee1a)
- ♻️ Refactor:22px 上边距落 xl 20 档、30px 内边距落 3xl 32 档 (d5a54b93f4)
- ♻️ Refactor:18px 间距落 lg 16 档、30px 落 3xl 32 档 (83617072bc)
- 📚 Docs:门 287 号位现读回灌两枚残留 —— hover 门入库时与同批 props 对账门撞 285,落地腿已把 runner 注册块与门体头注顺延为 287(HEAD 面在位);本枚对齐其余两处字面:README 点名条 runner id 与 UI/样式尾注、镜像⑦形状锁号位 regex+文案(prettier 归位后水印已复验完整)。README 盘上派生块(跟踪文件 18947/收编行,可重算件)随本枚带落;props 门自身与其 285 条目未触碰。盘面 scripts/guardian-runner.mjs 为已落地历史拷贝的幻影漂移(§5b 形态,P1 对账尺当轮点名),已按 30c 出路②单文件 checkout HEAD 对齐——零丢失(盘 blob 系上一枚落地态,本票文字全部已入 HEAD)。 (1c9cdb39c2)
- ♻️ Refactor:17/32/40/12.5 字号落 title/displayLg/label 档 (4e11292057)
- 🔧 Chore/Other:结清 B67/B70/B71、G-1222560/59/56 与 Z-1 两条(证据见行内) (85f1c08855)
- ♻️ Refactor:22px 金额/标题落 heading 20 档 (2be9294d5f)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (14cdb641cc)

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
