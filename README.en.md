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

Headline claims (same source as the table below, all live-computed): **617 tables · 4653 API routes ·
25 WebSocket endpoints · 100 catalogued LLMs · 38 platforms auto-publishing · 3685 test files ·
303 engineering gates · 51 CI workflows · 5-language i18n parity · 9 app packages · 16 shared packages ·
14 compose services**.

<!-- BEGIN GENERATED NUMBERS (node scripts/gen-doc-numbers.mjs --markdown) -->
| 指标 | 现值 | 取数键 |
| ---- | ---- | ------ |
| 数据库表 | 617 | `dbTables` |
| schema 文件 | 240 | `dbSchemaFiles` |
| API 路由 | 4653 | `apiRoutes` |
| 路由文件 | 656 | `apiRouteFiles` |
| AI 服务路由 | 624 | `aiServiceRoutes` |
| WebSocket 端点 | 25 | `wsEndpoints` |
| 入库模型清单 | 100 | `llmModels` |
| 发布平台 | 38 | `publishPlatforms` |
| 端应用包 | 9 | `appPackages` |
| 共享包 | 16 | `sharedPackages` |
| CLI 命令文件 | 68 | `cliCommandFiles` |
| CLI 工具文件 | 73 | `cliToolFiles` |
| 语言 | 5 | `i18nLanguages` |
| i18n 作用域 | 7 | `i18nScopes` |
| 语言包 JSON | 35 | `i18nMessageFiles` |
| 测试文件 | 3690 | `testFiles` |
| CI 工作流 | 51 | `ciWorkflows` |
| Compose 服务 | 14 | `composeServices` |
| 工程守门 | 305 | `guardianGates` |
| — blocking | 279 | `guardianBlocking` |
| — warn | 28 | `guardianWarn` |
| 跟踪文件 | 18156 | `trackedFiles` |

上表由 `node scripts/gen-doc-numbers.mjs --markdown` 生成,最后核对日期 2026-10-30。
每个数的来源就写在取数键旁边的实现里(`scripts/gen-doc-numbers.mjs` 的 `SOURCES`),**不得手抄、不得另立第二份**。

<!-- END GENERATED NUMBERS -->
<!-- END GENERATED NUMBERS -->


## Recent updates (auto-maintained)

<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->
**2026-10-31**
- 📚 Docs:切号条目口径按 2026-10-31 取证更正 + 补登统一入口与 MiniMax 回灌 (772eb33cca)

**2026-10-31**
- 🔧 Chore/Other:补 agent-engine parity 测试期望清单漏同步的 memory.refresh —— 清偿 79d4713885 的半截修复 (7e5dcd1021)

**2026-10-31**
- 🐞 Fix:清偿 devices.ts 两处 eqeqeq 存量 lint 红(0e875130c0 带入)—— 全量 turbo lint 臂清零 (a7e0cb5343)
- 🔧 Chore/Other:离线包按 HEAD 面重生成 —— 修正上一枚用工作树面取材导致的钉不一致 (ace1c864db)

**2026-10-31**
- ♻️ Refactor:门户维收敛候选集编排抽成纯函数,段级族可被构造面钉住 (182440479b)
- 🔧 Chore/Other:派生产物按最新 HEAD 面重生成 —— 补 webViewPortal.artifacts 词条,离线包与两枚路由钉同步 (bdd9129d40)
- 📚 Docs:miniapp 生产构建红按真跑结清(僵尸票) —— 构建 Compiled successfully 两点五四分钟 EXIT 零,主包余量四十万字节,dist 内 expo-modules-core 零命中,alias 与承载面 md5 与 HEAD 逐字相同 (fd7f9e2f28)
- 📚 Docs:Trae 逆向取证三册入库并补索引(上一轮只覆盖了 Qoder) (dc189f2ef8)
- 🐞 Fix:qoder 导入补齐会话模板 —— 模板此前在导入面被静默丢弃,池票永远 tpl=NULL (185987e308)
- 🐞 Fix:rn-compat 图标出口按 HEAD 面重生成 —— 补 ListTodo/MonitorSmartphone 两枚,门 251 C2 缺口清零 (16124c3b04)
- 🐞 Fix:清偿门 39 三条 HEAD 存量红(0e875130c0 旁路落地带回的未迁移形态) (577b3364ac)
- 📚 Docs:gitdir 描述只留实测相符的一条 —— 现读 test -d .git 为真、D:/IHUI-AI-git-repo 不存在;面上另有两条断言 28 字节 gitfile 的错版(照它处置就是把真 gitdir 当遗留删掉 = 删库事故,RP-78 立项正是为此),连同 10-30 旧版一并删除 (15c6b3ca1c)
- 🚀 Feature/Improvement:AI 代码归属落 Git notes(对齐 Trae 的 refs/notes/ai,并补「未判定」态) (1394337a75)
- 🚀 Feature/Improvement:web→RN 对齐链最后一枚缺口 artifacts 清零 —— 产物中心进 web-portal 门户(两端 WebView 承载, sso cookie 链路) (6ff6f36887)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (b88b1080c5)
- 🚀 Feature/Improvement:聊天端自动压缩上限改为按模型解析(对齐执行器侧与 Qoder/Trae) (19653cc078)
- 📚 Docs:删掉被取代的 gitdir 旧版描述 —— 同一机器事实两份并存,留 2026-10-31 实测更正版(.git 实体目录 / D:/IHUI-AI-git-repo 不存在 / 备份目录禁删清),删被取代的那份;门 207 与 238 复跑见末读数 (2040dbcdd0)
- 🚀 Feature/Improvement:输入上下文溢出应急压缩(对齐 Qoder/Trae) (8aa6e04350)
- 🚀 Feature/Improvement:补装 schedule_wakeup 延迟唤醒工具(定时四件套补齐),同 admin 档;修席遗留的 handler 注册键(测试随 ce51d9031 已落,本枚补实现件) (5cc32a4b19)
- 📚 Docs:207 再回预算内(95,207/96,000)+ gitdir 机器事实按实测改对 (c323d961bd)
- 🚀 Feature/Improvement:补装 schedule_wakeup 延迟唤醒工具(定时四件套补齐),同 admin 档;修席遗留的 handler 注册键 (ce51d90315)
- 📚 Docs:删掉第三条重复且与本机实测相反的 gitdir 断言行(仍写 gitfile 指向不存在的 D-IHUI-AI-git-repo) —— 同一条断言在文内已另有两条且均为实测正确的实体目录版; immutable-exempt: 删除的是会被后续读者当成事实的假断言重复副本,不新增也不放宽任何判据 (fce6073326)
- 🐞 Fix:生产构建红于 expo-blur → expo-modules-core 未编译 TS(补端内承载面 + 双段 alias) (335dbba679)

**2026-10-31**
- 🚀 Feature/Improvement:切号携对话全覆盖收口 —— MiniMax 会话回灌 + 统一入口 + 对账器扩到 8 平台 (05508a71a7)
- 🚀 Feature/Improvement:复登两枚「造好没装车」判据 + 修 CI 还原度假接线与两处零调度盲区 (8e9094548c)
- 🐞 Fix:恢复被 72769534b6 整片回退的离线包承载层装载 —— 生成器接回 bundleInputRels/rn-carried-keys,钉与门 105 的现算口径重新同源 (3b36cc477a)
- 📚 Docs:补 Agnes 生产落地三步 —— 密钥面 + 定价行落地 + 三处验证 (d99922c773)
- 🐞 Fix:8 枚 .ps1 补 UTF-8 BOM —— 门 265 的 HEAD 面绝对判据(含今天安全那批 deploy/win) (953b46af35)
- 🐞 Fix:切号连续性快照落点修正 —— 状态不再写进 scripts/.ihui-agent 树内 (638a0b0476)
- 🐞 Fix:补两件 HEAD 欠账(ps1 + 归档件)—— blob 档,别席在飞件一行不动 (3b647eaf63)
- 🔧 Chore/Other:补最后一枚归档件水印 —— 取 HEAD 内容注水,不碰别席在飞改动 (71adeb2b6f)
- 📚 Docs:207 体积回预算内 + 更正一条与实测相反的机器事实 (349f7a40fe)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (7a73ede0ec)
- 🐞 Fix:离线包生成器恢复承载层 —— 72769534b6 把它整段删了,门与单源 lib 却仍在按三层算 (6518d4415b)
- 🐞 Fix:schedule_task 落库的 conversation_id 改为真会话 id(此前写任务名,导致按会话查不到自建任务);补两条映射测试 (bb8df39199)
- 🚀 Feature/Improvement:注册门 269 API 路由唯一性(blocking,stagedTriggers=apps/api/) (030b894f1c)
- 📚 Docs:门 269 check-api-route-uniqueness 补进点名索引(R4 义务,先点名后注册) (1bb1c8c30c)
- 🚀 Feature/Improvement:补「同一 (method,path) 注册两次」的提交链判据 —— 今日已为此停摆一次 (46d65e94ac)
- 🐞 Fix:三处"判据看不见合法形制"的误报 + 专项档判据方向反了 —— 守门面按形态扩,阈值一个不动 (ed9d964382)
- 🔧 Chore/Other:旗清单落成 JSON + 镜像测试重写为 11 例(修 HEAD 上缺依赖的那一格) (b201309b88)
- 📚 Docs:RP-79 剩余面结清摘行(第二次,按回捞后的当前形态入账) —— 旗面单源完备性机器现算,未知旗闸装车 exit two 加定向说明放行,形状锁八例,自检一百五十八例,代码落地枚 d3201093f07 (830fee3d46)
- 📚 Docs:重落正本 §7b(首落 ee403f088c 被别席收敛吞掉,已打 lost-commit tag 保活) (f9c0dc1988)
- 📚 Docs:RP-79 剩余面结清摘行 —— 旗面抽单源且完备性机器现算(源码消费十六枚全覆盖),未知旗闸装车(exit two + 定向说明放行),USAGE 成套形状锁八例,自检一百五十八例全过,落地枚 d3201093f07 (7908385ffb)
- 🚀 Feature/Improvement:补装定时任务查询/取消工具 + run 三维机读计数;按创建动词同档收紧为 admin (1964518737)
- 🐞 Fix:收敛器装未知旗闸并把旗面抽成单源 —— 未认识的旗按用法错退出码二,定向说明可放行;清单完备性由源码扫描器现算而非人抄;形状锁八例。immutable-exempt: 本票要求为收敛器装闸并抽出清单单源,改动只新增闸与接线,不动任何既有判据与阈值 (d3201093f0)
- 🔧 Chore/Other:清 23 枚 HEAD 面水印欠账 —— 只补溯源载荷,零业务改动 (7cd758f4e3)
- 📚 Docs:补一行体积清偿指针 —— 44 行已整行移入 .ihui-agent/archive/AGENTS_trim-2026-10-31.md(规则条款一条未减;R4 点名义务同期转 README,补 17 枚门名),现读 95,121/96,000 (2f0140dc1f)
- 🐞 Fix:check-app-version-latest 补 --self-test(28 例)—— 此前文档写了跑不通的出路 (3f60aa920b)
- 🐞 Fix:重封 root-guard 清单 —— fea7830303 补门 268 时未同批封存,三个签出的部署环被 fail-closed 卡住 (c20d6ad587)
- 📚 Docs:R4 补点名 17 枚 —— AGENTS 体积清偿把 R4 登记补记整行移入归档件后,这些门的唯一文档点名处随之搬走(门 89 R4 立刻翻红 17 枚)。按 AGENTS 自己的口径「点名索引的正式归宿 = README」把 17 个门名补进索引节,判据不动;逐条判据/自检/跳过变量仍在各门体头注与原归档件里 (36f2020a6c)
- 🐞 Fix:关客户端改成「先枚举 PID、再逐个 /PID 杀」—— taskkill /IM 只收裸文件名,会连带关掉同名别的安装 (8379b3ad23)
- 📚 Docs:体积清偿 —— 44 行 R4 登记补记与同族重复副本整行移入 .ihui-agent/archive/AGENTS_trim-2026-10-31.md(门 207:121,974→95,121 B,预算 96,000;两步归档先移动后摘;七类必须留的判据各自存活至少一份;R4 点名义务由 README 索引承担,搬后门 89 R4 零红) (a1536eaa24)
- 🐞 Fix:tag 清仓要同时摘「存续层期望清单」—— 否则守护按清单把删掉的引用原样重建 (65788e5f6b)
- 📚 Docs:先把体积清偿要搬走的 44 行逐字归档,再动 AGENTS.md(两步归档:先移动、再摘) (e6eb9a03dc)
- 📚 Docs:RP-78 按实测结清 —— 票面称本机 .git 是 gitfile 被三面现读推翻(实体目录/非重解析点/D-IHUI-AI-git-repo 不存在),真风险方向相反且已在 AGENTS 更正(d59742000f) (ee4092b624)
- 📚 Docs:gitdir 形态按 2026-10-31 实测更正(工作区 .git 是实体目录,非 gitfile;D:/IHUI-AI-git-repo 不存在) —— 原文写反会把真库标成遗留并诱发误删; immutable-exempt: 更正与本机实测相反的机器事实断言,属 §0 七类机器事实每次现读要求的纠错 (d59742000f)
- 🐞 Fix:摘掉安装期的 wxt prepare —— 干净检出上它必解析不到 @ihui/i18n 的 dist,setup 一挂就带走 CI/OpenAPI/e2e/real-db/Knip 五条 workflow;prepare 改挂 typecheck 脚本,ci-monorepo 里并把该步移到建包之后;顺手补 build 作业 mirror-fidelity 的自述登记 (59c1bc650f)
- 🚀 Feature/Improvement:号池面板补齐健康四态 / 按供应商分布 / 24h 临期 —— 三格数据一直回但界面无人读 (7215469a79)
- 🔧 Chore/Other:RP-47 结清摘行 —— 两门 --staged 现读 rc=0(221:2118 枚逐一编译通过;254:零缺口),票面所称「恒取不到索引 blob」症状已不在;票面要求的可观测腿已装车(lib/face-reader 的 probeFaceSpec/describeProbe,两门未判定分支各接一次,镜像 39/39 含接线形状锁),落地 53d8ef47e9 (db197d2f1e)
- 🐞 Fix:RP-47 可观测腿 —— 两把门的「取不到」未判定必须点名命令/rc/stderr (53d8ef47e9)

**2026-10-30**
- 📚 Docs:复核第 4 行再改判 —— automation 工具真会执行,问题在僵尸模块与定时四件套缺位 (2c6154d191)
- 📚 Docs:派工前逐条复核 Top-12,第 1 行「审批收件箱缺失」与第 5 行「批准即生成规则」被现读推翻 —— 加 §3b 复核表并改派工序 (df330034d6)
- 🔧 Chore/Other:RP-90 结清摘行 —— 两处 prod 候选已同改吃 lib/prod-checkout-root 单源(HEAD 现读:deploy-decisions-face.mjs 注释自述 RP-90 已收、check-prod-checkout-foreign-work.mjs:90 import 且:584-592 通道C 走 prodCheckoutRoot),镜像 check-ops-patrol 51/51 + check-prod-checkout-foreign-work 1/1 全绿 (8c9486bd0b)
- 📚 Docs:能力树改为「源入库+产物不入库」—— candidate.json 与四份回执入库,HTML 按 .gitignore:295 的全局 *.html 规则不入库(不 -f 绕规) (c11469fdb8)
- 📚 Docs:O68 侧车归属改判无出口 按当场复跑证伪摘行 (声明式改判器 plan-fields-reclassify 在册且自检 9 通过 0 失败; O02 侧车 owner 已为机主真机验证面且 updatedBy 即该器; plan-tasks 派单现读对 O02 零命中) (6da6be99c2)
- 🔧 Chore/Other:守门 268 与兜底清扫器的 no-console 警告按同侪写法收口 (6014abefb3)
- 🔧 Chore/Other:G-50 结清删除 —— DevEnv 搬迁完成(旧根退役、备份卷改道) (19f5440261)
- 🐞 Fix:G-50 收口 —— 备份卷改道 §15b 批准落点,旧根 G:\DevEnv 退役删除 (e91f297336)
- 📚 Docs:守门 268 check-head-recall-stock 补进点名索引(门 89 R4 义务;AGENTS 已超 207 预算,AGENTS∪README 文档面按 README 归零) (b7989c8dfd)
- 🔧 Chore/Other:补落离线包派生面 —— 本席上一笔在合并前重生成,把"比源少 4 键"的包带进了 HEAD (0e6e8bfb45)
- 📚 Docs:提交/推送/合并改为 agent 自主强制动作 —— 取消'合并决策权归人',未合并检出改由 agent 依证据自主裁决(§12h 补条) (ed7b0f2098)
- 🐞 Fix:_model 的两处 no-any-return —— 收窄要判在"绑出来的局部"上,不是判在 .get() 表达式上 (e54a88d069)
- 📚 Docs:CSP 那行按线上实测更正 —— 文档写着比实际弱的面,本身就是缺陷 (244d6a4e0d)
- 🐞 Fix:收口被整块重复的登记(F6 块级判据的修复出口) (e2c9f7cf62)
- 🔧 Chore/Other:G-50 两形态并一 —— 摘除被取代的「等环境」旧行(正文已在保留行内) (bc70a3cad5)
- 🐞 Fix:停摆尺子读线上标记的落点硬写 .next —— 蓝绿形态下每轮读空并寄假停摆 (999e7051c9)
- 🐞 Fix:小程序 8 处调用接回真身并停止伪装 —— 与五语言同批(门 R2 规定含 messages/ 的提交取 scope=i18n,故本枚把端上改动与语言包同笔落) (c0f644a7c8)
- 🐞 Fix:补动态评论两条腿 + 邮箱验证码开 bind 场景 —— 前端接回真身的前置 (b52b052ee1)
- 🐞 Fix:一键模式的「快照已就绪」判据改与换桶同源 —— 昨天有快照不再冒充今天 (0d46f19685)
- 🔧 Chore/Other:快捷方式安装器入库 —— 桌面入口丢了/换机可一条命令重建 (3b195ef715)
- 🐞 Fix:收口被整块重复的登记(F6 块级判据的修复出口) (407c91eb36)
- 🐞 Fix:真机验证抓到两处「关闭客户端」缺陷 —— 进程名解析与强制兜底 (ca4874f3e5)
- 🚀 Feature/Improvement:补「HEAD 面回捞件」那一格——根治计划任务文档读数跳跃 (fea7830303)
- 🐞 Fix:派生弹窗存量 10 处归零 —— archify/rea 入仓时没带 windowsHide,这道门从那时起钉红所有人 (7681858835)
- 🐞 Fix:pre-push 的 tag-only 豁免看不见「删除 tag」——清仓实测 20 倍提速 (6272e5dca3)
- 📚 Docs:Qoder CN 0.5.1 REA 取证册入库(六层能力地图/33 轴判定/真缺 Top12/本轮被推翻 6 条) (18aea5255a)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (f4e3275aec)
- 🚀 Feature/Improvement:一键切号补齐客户端生命周期,桌面双击完成关→选号→切号换桶→续开 (ab064e7d80)
- 🐞 Fix:合并吞掉的 13 个拆分组件回盘 —— 小程序 typecheck 在 HEAD 恒红 (36f97a756a)
- 🔧 Chore/Other:补登 14 枚文件的溯源水印 —— 续 06efc5fe3e0c5516885408df8a76f65adfb12181 那笔未落完的 web/archify/ai-service 批次(上一会话在落地前中断);工作树面 14/14 载荷已验完好,本枚只把水印带进 HEAD (2d96e7167f)
- 📚 Docs:登记 HTTP 路由唯一性零判据与支付链缺测试面 —— 今日 /api/coupons/available 双注册把 API 整色挡在线下的后续工单 (5d5705b36c)
- 🚀 Feature/Improvement:大屏「使用数据」六块面板接线 —— 布局与数据一直在,页面从未渲染 (cffda9f484)
- 📚 Docs:更正"在线还原演练缺建库权限"那句 —— 隔离集群法已端到端实证 (d0eeb48556)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (6e0252f4ec)
- 🐞 Fix:/coupons/available 双注册把整个 API 色挡在线下 —— 支付页那支迁到 /pay 下 (399dc2969c)
- 🚀 Feature/Improvement:第二轮产品级差距修复(G1 跨设备/G2 自动化闭环/G3 产物管线/G4 计费弹性/G5 知识引擎/G6 企业治理 + E1/E2/E4) (0e875130c0)
- 🚀 Feature/Improvement:第二轮产品级五语词表(设备互联/交付物/自动化/企业治理/导入七源/CLI wiki) (9654b6a156)
- 🔧 Chore/Other:补齐两处源文件水印 —— csp.ts 与 tag 剪枝器 (97c20cc3d6)
- 🔧 Chore/Other:补登 4 个测试文件的溯源水印(HEAD 面欠账清偿) (06efc5fe3e)
- 🔧 Chore/Other:四枚按 g41-A 席一手证据结清(L28150 / L5645 / L5650 / L5644) (1cf14da043)
- 🔧 Chore/Other:恢复被整笔回退的两处判据 —— 敏感路由声明模型与 9 档事件清单按真实语义对齐 (af40ec736d)
- 🐞 Fix:清偿 ruff 全量 6 条(SIM103/UP037/I001/B905) —— 判据面禁改文件由本席按规则最小修正 (087f9e291c)
- 🐞 Fix:两屏颜色键按样式工厂约定回正 —— chipActiveText/tabActiveText/filterChipActiveText (b2b5f5fceb)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (f9012a7f35)
- 🔧 Chore/Other:G-1102638 批1 同主键副本行物理归并 — 删 8 行(机主拍板〔拍板@2026-10-08 机主:真删+立即执行〕;幸存者规则与F4同向;落账注记行保留待批2;复跑auditPlan对账F1=0/F9不增;逐行留痕 .ihui-agent/archive/PROJECT_PLAN_copy-purge-2026-10-30.md) (fa1954acfb)
- 🚀 Feature/Improvement:新增 relay:switch-oneclick 一键切号模式（自动建会话库快照+联动换桶，支持TTY交互选号，复用现有函数不复制逻辑） (484b0c8ec0)
- 🐞 Fix:清掉 2 条 exhaustive-deps 警告 —— 依赖表取稳定成员与移除未用 t (d9c1a97546)

**2026-10-31**
- 🐞 Fix:恢复被 72769534b6 整片回退的离线包承载层装载 —— 生成器接回 bundleInputRels/rn-carried-keys,钉与门 105 的现算口径重新同源 (3b36cc477a)
- 📚 Docs:补 Agnes 生产落地三步 —— 密钥面 + 定价行落地 + 三处验证 (d99922c773)
- 🐞 Fix:切号连续性快照落点修正 —— 状态不再写进 scripts/.ihui-agent 树内 (638a0b0476)
- 🔧 Chore/Other:补最后一枚归档件水印 —— 取 HEAD 内容注水,不碰别席在飞改动 (71adeb2b6f)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (7a73ede0ec)
- 🐞 Fix:schedule_task 落库的 conversation_id 改为真会话 id(此前写任务名,导致按会话查不到自建任务);补两条映射测试 (bb8df39199)
- 🚀 Feature/Improvement:注册门 269 API 路由唯一性(blocking,stagedTriggers=apps/api/) (030b894f1c)
- 📚 Docs:门 269 check-api-route-uniqueness 补进点名索引(R4 义务,先点名后注册) (1bb1c8c30c)
- 🚀 Feature/Improvement:补「同一 (method,path) 注册两次」的提交链判据 —— 今日已为此停摆一次 (46d65e94ac)
- 🔧 Chore/Other:旗清单落成 JSON + 镜像测试重写为 11 例(修 HEAD 上缺依赖的那一格) (b201309b88)
- 📚 Docs:RP-79 剩余面结清摘行(第二次,按回捞后的当前形态入账) —— 旗面单源完备性机器现算,未知旗闸装车 exit two 加定向说明放行,形状锁八例,自检一百五十八例,代码落地枚 d3201093f07 (830fee3d46)
- 📚 Docs:重落正本 §7b(首落 ee403f088c 被别席收敛吞掉,已打 lost-commit tag 保活) (f9c0dc1988)
- 📚 Docs:RP-79 剩余面结清摘行 —— 旗面抽单源且完备性机器现算(源码消费十六枚全覆盖),未知旗闸装车(exit two + 定向说明放行),USAGE 成套形状锁八例,自检一百五十八例全过,落地枚 d3201093f07 (7908385ffb)
- 🚀 Feature/Improvement:补装定时任务查询/取消工具 + run 三维机读计数;按创建动词同档收紧为 admin (1964518737)
- 🐞 Fix:收敛器装未知旗闸并把旗面抽成单源 —— 未认识的旗按用法错退出码二,定向说明可放行;清单完备性由源码扫描器现算而非人抄;形状锁八例。immutable-exempt: 本票要求为收敛器装闸并抽出清单单源,改动只新增闸与接线,不动任何既有判据与阈值 (d3201093f0)
- 🔧 Chore/Other:清 23 枚 HEAD 面水印欠账 —— 只补溯源载荷,零业务改动 (7cd758f4e3)
- 📚 Docs:补一行体积清偿指针 —— 44 行已整行移入 .ihui-agent/archive/AGENTS_trim-2026-10-31.md(规则条款一条未减;R4 点名义务同期转 README,补 17 枚门名),现读 95,121/96,000 (2f0140dc1f)
- 🐞 Fix:check-app-version-latest 补 --self-test(28 例)—— 此前文档写了跑不通的出路 (3f60aa920b)
- 🐞 Fix:重封 root-guard 清单 —— fea7830303 补门 268 时未同批封存,三个签出的部署环被 fail-closed 卡住 (c20d6ad587)
- 📚 Docs:R4 补点名 17 枚 —— AGENTS 体积清偿把 R4 登记补记整行移入归档件后,这些门的唯一文档点名处随之搬走(门 89 R4 立刻翻红 17 枚)。按 AGENTS 自己的口径「点名索引的正式归宿 = README」把 17 个门名补进索引节,判据不动;逐条判据/自检/跳过变量仍在各门体头注与原归档件里 (36f2020a6c)
- 🐞 Fix:关客户端改成「先枚举 PID、再逐个 /PID 杀」—— taskkill /IM 只收裸文件名,会连带关掉同名别的安装 (8379b3ad23)
- 📚 Docs:体积清偿 —— 44 行 R4 登记补记与同族重复副本整行移入 .ihui-agent/archive/AGENTS_trim-2026-10-31.md(门 207:121,974→95,121 B,预算 96,000;两步归档先移动后摘;七类必须留的判据各自存活至少一份;R4 点名义务由 README 索引承担,搬后门 89 R4 零红) (a1536eaa24)
- 🐞 Fix:tag 清仓要同时摘「存续层期望清单」—— 否则守护按清单把删掉的引用原样重建 (65788e5f6b)
- 📚 Docs:先把体积清偿要搬走的 44 行逐字归档,再动 AGENTS.md(两步归档:先移动、再摘) (e6eb9a03dc)
- 📚 Docs:RP-78 按实测结清 —— 票面称本机 .git 是 gitfile 被三面现读推翻(实体目录/非重解析点/D-IHUI-AI-git-repo 不存在),真风险方向相反且已在 AGENTS 更正(d59742000f) (ee4092b624)
- 📚 Docs:gitdir 形态按 2026-10-31 实测更正(工作区 .git 是实体目录,非 gitfile;D:/IHUI-AI-git-repo 不存在) —— 原文写反会把真库标成遗留并诱发误删; immutable-exempt: 更正与本机实测相反的机器事实断言,属 §0 七类机器事实每次现读要求的纠错 (d59742000f)
- 🐞 Fix:摘掉安装期的 wxt prepare —— 干净检出上它必解析不到 @ihui/i18n 的 dist,setup 一挂就带走 CI/OpenAPI/e2e/real-db/Knip 五条 workflow;prepare 改挂 typecheck 脚本,ci-monorepo 里并把该步移到建包之后;顺手补 build 作业 mirror-fidelity 的自述登记 (59c1bc650f)
- 🚀 Feature/Improvement:号池面板补齐健康四态 / 按供应商分布 / 24h 临期 —— 三格数据一直回但界面无人读 (7215469a79)
- 🔧 Chore/Other:RP-47 结清摘行 —— 两门 --staged 现读 rc=0(221:2118 枚逐一编译通过;254:零缺口),票面所称「恒取不到索引 blob」症状已不在;票面要求的可观测腿已装车(lib/face-reader 的 probeFaceSpec/describeProbe,两门未判定分支各接一次,镜像 39/39 含接线形状锁),落地 53d8ef47e9 (db197d2f1e)
- 🐞 Fix:RP-47 可观测腿 —— 两把门的「取不到」未判定必须点名命令/rc/stderr (53d8ef47e9)

**2026-10-30**
- 📚 Docs:复核第 4 行再改判 —— automation 工具真会执行,问题在僵尸模块与定时四件套缺位 (2c6154d191)
- 📚 Docs:派工前逐条复核 Top-12,第 1 行「审批收件箱缺失」与第 5 行「批准即生成规则」被现读推翻 —— 加 §3b 复核表并改派工序 (df330034d6)
- 🔧 Chore/Other:RP-90 结清摘行 —— 两处 prod 候选已同改吃 lib/prod-checkout-root 单源(HEAD 现读:deploy-decisions-face.mjs 注释自述 RP-90 已收、check-prod-checkout-foreign-work.mjs:90 import 且:584-592 通道C 走 prodCheckoutRoot),镜像 check-ops-patrol 51/51 + check-prod-checkout-foreign-work 1/1 全绿 (8c9486bd0b)
- 📚 Docs:能力树改为「源入库+产物不入库」—— candidate.json 与四份回执入库,HTML 按 .gitignore:295 的全局 *.html 规则不入库(不 -f 绕规) (c11469fdb8)
- 📚 Docs:O68 侧车归属改判无出口 按当场复跑证伪摘行 (声明式改判器 plan-fields-reclassify 在册且自检 9 通过 0 失败; O02 侧车 owner 已为机主真机验证面且 updatedBy 即该器; plan-tasks 派单现读对 O02 零命中) (6da6be99c2)
- 🔧 Chore/Other:守门 268 与兜底清扫器的 no-console 警告按同侪写法收口 (6014abefb3)
- 🔧 Chore/Other:G-50 结清删除 —— DevEnv 搬迁完成(旧根退役、备份卷改道) (19f5440261)
- 🐞 Fix:G-50 收口 —— 备份卷改道 §15b 批准落点,旧根 G:\DevEnv 退役删除 (e91f297336)
- 📚 Docs:守门 268 check-head-recall-stock 补进点名索引(门 89 R4 义务;AGENTS 已超 207 预算,AGENTS∪README 文档面按 README 归零) (b7989c8dfd)
- 🔧 Chore/Other:补落离线包派生面 —— 本席上一笔在合并前重生成,把"比源少 4 键"的包带进了 HEAD (0e6e8bfb45)
- 📚 Docs:提交/推送/合并改为 agent 自主强制动作 —— 取消'合并决策权归人',未合并检出改由 agent 依证据自主裁决(§12h 补条) (ed7b0f2098)
- 🐞 Fix:_model 的两处 no-any-return —— 收窄要判在"绑出来的局部"上,不是判在 .get() 表达式上 (e54a88d069)
- 📚 Docs:CSP 那行按线上实测更正 —— 文档写着比实际弱的面,本身就是缺陷 (244d6a4e0d)
- 🐞 Fix:收口被整块重复的登记(F6 块级判据的修复出口) (e2c9f7cf62)
- 🔧 Chore/Other:G-50 两形态并一 —— 摘除被取代的「等环境」旧行(正文已在保留行内) (bc70a3cad5)
- 🐞 Fix:停摆尺子读线上标记的落点硬写 .next —— 蓝绿形态下每轮读空并寄假停摆 (999e7051c9)
- 🐞 Fix:小程序 8 处调用接回真身并停止伪装 —— 与五语言同批(门 R2 规定含 messages/ 的提交取 scope=i18n,故本枚把端上改动与语言包同笔落) (c0f644a7c8)
- 🐞 Fix:补动态评论两条腿 + 邮箱验证码开 bind 场景 —— 前端接回真身的前置 (b52b052ee1)
- 🐞 Fix:一键模式的「快照已就绪」判据改与换桶同源 —— 昨天有快照不再冒充今天 (0d46f19685)
- 🔧 Chore/Other:快捷方式安装器入库 —— 桌面入口丢了/换机可一条命令重建 (3b195ef715)
- 🐞 Fix:收口被整块重复的登记(F6 块级判据的修复出口) (407c91eb36)
- 🐞 Fix:真机验证抓到两处「关闭客户端」缺陷 —— 进程名解析与强制兜底 (ca4874f3e5)
- 🚀 Feature/Improvement:补「HEAD 面回捞件」那一格——根治计划任务文档读数跳跃 (fea7830303)
- 🐞 Fix:派生弹窗存量 10 处归零 —— archify/rea 入仓时没带 windowsHide,这道门从那时起钉红所有人 (7681858835)
- 🐞 Fix:pre-push 的 tag-only 豁免看不见「删除 tag」——清仓实测 20 倍提速 (6272e5dca3)
- 📚 Docs:Qoder CN 0.5.1 REA 取证册入库(六层能力地图/33 轴判定/真缺 Top12/本轮被推翻 6 条) (18aea5255a)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (f4e3275aec)
- 🚀 Feature/Improvement:一键切号补齐客户端生命周期,桌面双击完成关→选号→切号换桶→续开 (ab064e7d80)
- 🐞 Fix:合并吞掉的 13 个拆分组件回盘 —— 小程序 typecheck 在 HEAD 恒红 (36f97a756a)
- 🔧 Chore/Other:补登 14 枚文件的溯源水印 —— 续 06efc5fe3e0c5516885408df8a76f65adfb12181 那笔未落完的 web/archify/ai-service 批次(上一会话在落地前中断);工作树面 14/14 载荷已验完好,本枚只把水印带进 HEAD (2d96e7167f)
- 📚 Docs:登记 HTTP 路由唯一性零判据与支付链缺测试面 —— 今日 /api/coupons/available 双注册把 API 整色挡在线下的后续工单 (5d5705b36c)
- 🚀 Feature/Improvement:大屏「使用数据」六块面板接线 —— 布局与数据一直在,页面从未渲染 (cffda9f484)
- 📚 Docs:更正"在线还原演练缺建库权限"那句 —— 隔离集群法已端到端实证 (d0eeb48556)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (6e0252f4ec)
- 🐞 Fix:/coupons/available 双注册把整个 API 色挡在线下 —— 支付页那支迁到 /pay 下 (399dc2969c)
- 🚀 Feature/Improvement:第二轮产品级差距修复(G1 跨设备/G2 自动化闭环/G3 产物管线/G4 计费弹性/G5 知识引擎/G6 企业治理 + E1/E2/E4) (0e875130c0)
- 🚀 Feature/Improvement:第二轮产品级五语词表(设备互联/交付物/自动化/企业治理/导入七源/CLI wiki) (9654b6a156)
- 🔧 Chore/Other:补齐两处源文件水印 —— csp.ts 与 tag 剪枝器 (97c20cc3d6)
- 🔧 Chore/Other:补登 4 个测试文件的溯源水印(HEAD 面欠账清偿) (06efc5fe3e)
- 🔧 Chore/Other:四枚按 g41-A 席一手证据结清(L28150 / L5645 / L5650 / L5644) (1cf14da043)
- 🔧 Chore/Other:恢复被整笔回退的两处判据 —— 敏感路由声明模型与 9 档事件清单按真实语义对齐 (af40ec736d)
- 🐞 Fix:清偿 ruff 全量 6 条(SIM103/UP037/I001/B905) —— 判据面禁改文件由本席按规则最小修正 (087f9e291c)
- 🐞 Fix:两屏颜色键按样式工厂约定回正 —— chipActiveText/tabActiveText/filterChipActiveText (b2b5f5fceb)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (f9012a7f35)
- 🔧 Chore/Other:G-1102638 批1 同主键副本行物理归并 — 删 8 行(机主拍板〔拍板@2026-10-08 机主:真删+立即执行〕;幸存者规则与F4同向;落账注记行保留待批2;复跑auditPlan对账F1=0/F9不增;逐行留痕 .ihui-agent/archive/PROJECT_PLAN_copy-purge-2026-10-30.md) (fa1954acfb)
- 🚀 Feature/Improvement:新增 relay:switch-oneclick 一键切号模式（自动建会话库快照+联动换桶，支持TTY交互选号，复用现有函数不复制逻辑） (484b0c8ec0)
- 🐞 Fix:清掉 2 条 exhaustive-deps 警告 —— 依赖表取稳定成员与移除未用 t (d9c1a97546)

**2026-10-31**
- 🐞 Fix:摘掉安装期的 wxt prepare —— 干净检出上它必解析不到 @ihui/i18n 的 dist,setup 一挂就带走 CI/OpenAPI/e2e/real-db/Knip 五条 workflow;prepare 改挂 typecheck 脚本,ci-monorepo 里并把该步移到建包之后;顺手补 build 作业 mirror-fidelity 的自述登记 (59c1bc650f)
- 🔧 Chore/Other:RP-47 结清摘行 —— 两门 --staged 现读 rc=0(221:2118 枚逐一编译通过;254:零缺口),票面所称「恒取不到索引 blob」症状已不在;票面要求的可观测腿已装车(lib/face-reader 的 probeFaceSpec/describeProbe,两门未判定分支各接一次,镜像 39/39 含接线形状锁),落地 53d8ef47e9 (db197d2f1e)
- 🐞 Fix:RP-47 可观测腿 —— 两把门的「取不到」未判定必须点名命令/rc/stderr (53d8ef47e9)

**2026-10-30**
- 📚 Docs:复核第 4 行再改判 —— automation 工具真会执行,问题在僵尸模块与定时四件套缺位 (2c6154d191)
- 📚 Docs:派工前逐条复核 Top-12,第 1 行「审批收件箱缺失」与第 5 行「批准即生成规则」被现读推翻 —— 加 §3b 复核表并改派工序 (df330034d6)
- 🔧 Chore/Other:RP-90 结清摘行 —— 两处 prod 候选已同改吃 lib/prod-checkout-root 单源(HEAD 现读:deploy-decisions-face.mjs 注释自述 RP-90 已收、check-prod-checkout-foreign-work.mjs:90 import 且:584-592 通道C 走 prodCheckoutRoot),镜像 check-ops-patrol 51/51 + check-prod-checkout-foreign-work 1/1 全绿 (8c9486bd0b)
- 📚 Docs:能力树改为「源入库+产物不入库」—— candidate.json 与四份回执入库,HTML 按 .gitignore:295 的全局 *.html 规则不入库(不 -f 绕规) (c11469fdb8)
- 📚 Docs:O68 侧车归属改判无出口 按当场复跑证伪摘行 (声明式改判器 plan-fields-reclassify 在册且自检 9 通过 0 失败; O02 侧车 owner 已为机主真机验证面且 updatedBy 即该器; plan-tasks 派单现读对 O02 零命中) (6da6be99c2)
- 🔧 Chore/Other:守门 268 与兜底清扫器的 no-console 警告按同侪写法收口 (6014abefb3)
- 🔧 Chore/Other:G-50 结清删除 —— DevEnv 搬迁完成(旧根退役、备份卷改道) (19f5440261)
- 🐞 Fix:G-50 收口 —— 备份卷改道 §15b 批准落点,旧根 G:\DevEnv 退役删除 (e91f297336)
- 📚 Docs:守门 268 check-head-recall-stock 补进点名索引(门 89 R4 义务;AGENTS 已超 207 预算,AGENTS∪README 文档面按 README 归零) (b7989c8dfd)
- 🔧 Chore/Other:补落离线包派生面 —— 本席上一笔在合并前重生成,把"比源少 4 键"的包带进了 HEAD (0e6e8bfb45)
- 📚 Docs:提交/推送/合并改为 agent 自主强制动作 —— 取消'合并决策权归人',未合并检出改由 agent 依证据自主裁决(§12h 补条) (ed7b0f2098)
- 🐞 Fix:_model 的两处 no-any-return —— 收窄要判在"绑出来的局部"上,不是判在 .get() 表达式上 (e54a88d069)
- 📚 Docs:CSP 那行按线上实测更正 —— 文档写着比实际弱的面,本身就是缺陷 (244d6a4e0d)
- 🐞 Fix:收口被整块重复的登记(F6 块级判据的修复出口) (e2c9f7cf62)
- 🔧 Chore/Other:G-50 两形态并一 —— 摘除被取代的「等环境」旧行(正文已在保留行内) (bc70a3cad5)
- 🐞 Fix:停摆尺子读线上标记的落点硬写 .next —— 蓝绿形态下每轮读空并寄假停摆 (999e7051c9)
- 🐞 Fix:小程序 8 处调用接回真身并停止伪装 —— 与五语言同批(门 R2 规定含 messages/ 的提交取 scope=i18n,故本枚把端上改动与语言包同笔落) (c0f644a7c8)
- 🐞 Fix:补动态评论两条腿 + 邮箱验证码开 bind 场景 —— 前端接回真身的前置 (b52b052ee1)
- 🐞 Fix:一键模式的「快照已就绪」判据改与换桶同源 —— 昨天有快照不再冒充今天 (0d46f19685)
- 🔧 Chore/Other:快捷方式安装器入库 —— 桌面入口丢了/换机可一条命令重建 (3b195ef715)
- 🐞 Fix:收口被整块重复的登记(F6 块级判据的修复出口) (407c91eb36)
- 🐞 Fix:真机验证抓到两处「关闭客户端」缺陷 —— 进程名解析与强制兜底 (ca4874f3e5)
- 🚀 Feature/Improvement:补「HEAD 面回捞件」那一格——根治计划任务文档读数跳跃 (fea7830303)
- 🐞 Fix:派生弹窗存量 10 处归零 —— archify/rea 入仓时没带 windowsHide,这道门从那时起钉红所有人 (7681858835)
- 🐞 Fix:pre-push 的 tag-only 豁免看不见「删除 tag」——清仓实测 20 倍提速 (6272e5dca3)
- 📚 Docs:Qoder CN 0.5.1 REA 取证册入库(六层能力地图/33 轴判定/真缺 Top12/本轮被推翻 6 条) (18aea5255a)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (f4e3275aec)
- 🚀 Feature/Improvement:一键切号补齐客户端生命周期,桌面双击完成关→选号→切号换桶→续开 (ab064e7d80)
- 🐞 Fix:合并吞掉的 13 个拆分组件回盘 —— 小程序 typecheck 在 HEAD 恒红 (36f97a756a)
- 🔧 Chore/Other:补登 14 枚文件的溯源水印 —— 续 06efc5fe3e0c5516885408df8a76f65adfb12181 那笔未落完的 web/archify/ai-service 批次(上一会话在落地前中断);工作树面 14/14 载荷已验完好,本枚只把水印带进 HEAD (2d96e7167f)
- 📚 Docs:登记 HTTP 路由唯一性零判据与支付链缺测试面 —— 今日 /api/coupons/available 双注册把 API 整色挡在线下的后续工单 (5d5705b36c)
- 🚀 Feature/Improvement:大屏「使用数据」六块面板接线 —— 布局与数据一直在,页面从未渲染 (cffda9f484)
- 📚 Docs:更正"在线还原演练缺建库权限"那句 —— 隔离集群法已端到端实证 (d0eeb48556)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (6e0252f4ec)
- 🐞 Fix:/coupons/available 双注册把整个 API 色挡在线下 —— 支付页那支迁到 /pay 下 (399dc2969c)
- 🚀 Feature/Improvement:第二轮产品级差距修复(G1 跨设备/G2 自动化闭环/G3 产物管线/G4 计费弹性/G5 知识引擎/G6 企业治理 + E1/E2/E4) (0e875130c0)
- 🚀 Feature/Improvement:第二轮产品级五语词表(设备互联/交付物/自动化/企业治理/导入七源/CLI wiki) (9654b6a156)
- 🔧 Chore/Other:补齐两处源文件水印 —— csp.ts 与 tag 剪枝器 (97c20cc3d6)
- 🔧 Chore/Other:补登 4 个测试文件的溯源水印(HEAD 面欠账清偿) (06efc5fe3e)
- 🔧 Chore/Other:四枚按 g41-A 席一手证据结清(L28150 / L5645 / L5650 / L5644) (1cf14da043)
- 🔧 Chore/Other:恢复被整笔回退的两处判据 —— 敏感路由声明模型与 9 档事件清单按真实语义对齐 (af40ec736d)
- 🐞 Fix:清偿 ruff 全量 6 条(SIM103/UP037/I001/B905) —— 判据面禁改文件由本席按规则最小修正 (087f9e291c)
- 🐞 Fix:两屏颜色键按样式工厂约定回正 —— chipActiveText/tabActiveText/filterChipActiveText (b2b5f5fceb)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (f9012a7f35)
- 🔧 Chore/Other:G-1102638 批1 同主键副本行物理归并 — 删 8 行(机主拍板〔拍板@2026-10-08 机主:真删+立即执行〕;幸存者规则与F4同向;落账注记行保留待批2;复跑auditPlan对账F1=0/F9不增;逐行留痕 .ihui-agent/archive/PROJECT_PLAN_copy-purge-2026-10-30.md) (fa1954acfb)
- 🚀 Feature/Improvement:新增 relay:switch-oneclick 一键切号模式（自动建会话库快照+联动换桶，支持TTY交互选号，复用现有函数不复制逻辑） (484b0c8ec0)
- 🐞 Fix:清掉 2 条 exhaustive-deps 警告 —— 依赖表取稳定成员与移除未用 t (d9c1a97546)

**2026-10-31**
- 🔧 Chore/Other:未判定连击三格的行为锁 —— 起点不得被清 / 未知腿有阳性对照 / 测试不得拿真实起点账当对象 (de9c682b29)
- 🐞 Fix:未判定连击三格收口 —— 三条腿自报 undetermined 时不再清起点账,180 分钟到人这条腿才真会响 (e1636ec07b)

**2026-10-31**
- 🚀 Feature/Improvement:切号携对话闭环收口 —— 一条命令完成「切号+连续性对账」,对账器扩到 codex/zcode/opencode (a22b5d07a1)
- 🐞 Fix:门 253 补 D4「模块对象属性取用」维 + 存量逐条点名 —— 当日的安静停机这一型终于有尺子 (8d7d15a5a9)

**2026-10-31**
- 🐞 Fix:门 253 补 D4「模块对象属性取用」维 + 存量逐条点名 —— 当日的安静停机这一型终于有尺子 (8d7d15a5a9)

**2026-10-31**
- 🔧 Chore/Other:docs(agnes)[cross-domain]: 端点与域名事实按 2026-10-30 直连四组合更正 + 副本收单源 + 出网披露清单按现读重建 (110cf9d6d4)

**2026-10-30**
- 🔧 Chore/Other:ui-routes 派生产物按 HEAD 面重生成落地 —— 还原度批 48 文件与壳承载升级后四端路由钉同步(mobile-rn 27 行级 / miniapp-taro 119 行级;web 份有他席在飞改动按门纪律拒绝写回未触碰;钉头注行与祖先 3f5069448 的重合是生成器幂等产出,非滞后回退) (aea62a2896)
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
