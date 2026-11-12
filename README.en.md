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
| 数据库表 | 639 | `dbTables` |
| schema 文件 | 246 | `dbSchemaFiles` |
| API 路由 | 4768 | `apiRoutes` |
| 路由文件 | 694 | `apiRouteFiles` |
| AI 服务路由 | 676 | `aiServiceRoutes` |
| WebSocket 端点 | 30 | `wsEndpoints` |
| 入库模型清单 | 100 | `llmModels` |
| 发布平台 | 38 | `publishPlatforms` |
| 端应用包 | 9 | `appPackages` |
| 共享包 | 17 | `sharedPackages` |
| CLI 命令文件 | 76 | `cliCommandFiles` |
| CLI 工具文件 | 104 | `cliToolFiles` |
| 语言 | 5 | `i18nLanguages` |
| i18n 作用域 | 7 | `i18nScopes` |
| 语言包 JSON | 35 | `i18nMessageFiles` |
| 测试文件 | 5082 | `testFiles` |
| CI 工作流 | 59 | `ciWorkflows` |
| Compose 服务 | 14 | `composeServices` |
| 工程守门 | 362 | `guardianGates` |
| — blocking | 333 | `guardianBlocking` |
| — warn | 31 | `guardianWarn` |
| 跟踪文件 | 21147 | `trackedFiles` |

上表由 `node scripts/sync-readme-numbers.mjs`(唯一写入口,索引面取数)生成,最后核对日期 2026-11-12。
每个数的来源就写在取数键旁边的实现里(`scripts/gen-doc-numbers.mjs` 的 `SOURCES`),**不得手抄、不得另立第二份**。

<!-- END GENERATED NUMBERS -->


## Recent updates (auto-maintained)

<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->
**2026-11-12**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (a0b77c846f)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (5a85fa4cd4)
- 🔧 Chore/Other:ui-routes 生成物按 HEAD 面重跑收口——第三轮收敛落地后守门 105 陈旧义务 (4cebaa4fe4)

**2026-11-12**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (ae89dae598)
- 🔧 Chore/Other:结清 F-014/F-024/F-025/F-032/F-033/F-047/F-053/F-054/F-056/F-058/F-107 十一张缺陷普查工单 (661f0050ac)
- 🐞 Fix:结清 F-014/F-024/F-032/F-033/F-054/F-056/F-058/F-107 八张缺陷普查工单 (e198e77344)
- 🔧 Chore/Other:违禁桶兜底清扫——HEAD面等条件/待拍板未勾行自动摘除(两道机主禁令的执行器物化,留痕f12-purge;复翻席请同步摘形态,事实内容按各批结清提交保留) (4ec4e02493)
- 🐞 Fix:兜底枚换回 RP-76/77/78/81 四行现文——滞后回灌与摘除 credit 的双向销账收口 (199c1b0b39)
- 🐞 Fix:inventory 退出 prettier 格式门禁并还原跨行格式——根治归并行级断言死锁 (eda71b7c8b)
- 🐞 Fix:AIS-076 ai_skills invoke 的 owner_uuid 改取 JWT 主体,拒绝借用他人 BYOK (ea251bb635)
- 🐞 Fix:AIS-075 meta_learner 全族加管理员门(role_id>=1) (b6bacdc706)
- 🔧 Chore/Other:第二轮收敛预置枚——inventory 首条 reverseGaps 加复注逼出真三方 (61734f4c13)
- 📚 Docs:auto-triage 自动登记(mail-failure;第 1 期感知层产线动作,O65) (c3551f0ba1)
- 🐞 Fix:AIS-072 token6688 embedding 校验向量数量与维度 (92ba3bde4f)
- 🐞 Fix:AIS-066 base_provider 200+error 体识别为失败 (9479a5131e)
- 🐞 Fix:重封根护栏清单追认已入库的告警自愈层 (32ea4c5ac0)
- 🔧 Chore/Other:结清 6 张已修复漏勾工单(F-012/013/029/030/031/100) (ddd30bb32b)
- 🔧 Chore/Other:结清 F-012/F-013/F-029/F-030/F-031 五张缺陷普查工单 (3a4152e3be)
- 🐞 Fix:结清 F-012/F-013/F-029/F-030/F-031 —— 非 TTY 默认路径与 login 加守卫、checkpoint manifest 原子写与无清单孤儿 GC、prompt 队列并发 tmp 与损坏隔离、会话损坏三态 (9001f5e84d)
- 🐞 Fix:AIS-087/089/091/113 agent_engine 关闭态守卫+审批策略恢复+exec清理+并发竞态 (67b2bf6e75)
- 🔧 Chore/Other:结清 API P0/P1 族 36 张已核验工单(源码含修复证据,commit 在 HEAD) (aad8e780ef)
- 🔧 Chore/Other:固化并行会话 README 在飞改动 (7eb688b73d)
- 🐞 Fix:repair raccoon one-click onboarding into relay account pool (39237e0cde)
- 🔧 Chore/Other:号池全量可用性探针 relay-probe-pool-health.ts (31d5da6ede)
- 🐞 Fix:AIS-026/028 sandbox 取消回收子进程 + 队列句柄/终态记录回收 (1ba92ef84d)
- 🔧 Chore/Other:固化并行会话在飞 README/PLAN 改动 (34a2a21521)
- 🐞 Fix:AIS-044 timeline 会话归属 fail-open 收敛(None/空属主即拒) (9151132dd2)
- 🐞 Fix:AIS-078/090 agent_runtime 空属主 fail-open 收敛 + 断连落终态 (65c056052e)
- 🐞 Fix:盘根外流族冷却 8h→24h 治长期刷屏 (27b5681fa4)
- 🔧 Chore/Other:结清 F-022/F-023/F-026/F-027/F-100 五张缺陷普查工单 (5605e922d6)
- 🐞 Fix:结清 F-022/F-023/F-026/F-027/F-100 —— worktree 走统一封顶出口、范围提交解析真实 git 目录、输出按流式编码解码、非 UTF-8 gitignore 改写 exclude、深链哨兵令牌+回跳白名单 (ddb8fa9eb1)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5db006996a)
- 🔧 Chore/Other:违禁桶兜底清扫——HEAD面等条件/待拍板未勾行自动摘除(两道机主禁令的执行器物化,留痕f12-purge;复翻席请同步摘形态,事实内容按各批结清提交保留) (e7c1d20186)
- 🔧 Chore/Other:结清 2 张已修复漏勾工单(F-277/292) (91d99756fd)
- 🔧 Chore/Other:结清 XUI 跨端余 49 张工单(41 已修+4 否证+4 已消解,commit 均在 HEAD) (4e4d0b71bb)
- 🐞 Fix:AIS-006/007 断线不发计量帧、中断回调用量不再恒 NULL (1e5cf1a24b)
- 🐞 Fix:AIS-016 图像 part 计入 token 估算 (e2be7338c6)
- 🐞 Fix:F-292 /v1/responses 对齐 BYOK 计费口径，避免私有 Key 用户被二次全额扣费 (e5a1707dfd)
- 🐞 Fix:F-277 补 MJ/rerank/moderations 的 ApiKeyQuota、上游超时与计费留痕 (f245a939e7)
- 🔧 Chore/Other:结清 F-075/F-087/F-088 三张缺陷普查工单 (eca7dd7822)
- 🐞 Fix:结清 F-073/F-075/F-087/F-088 —— 沙箱换行分段拒入、外发 unjudged 回归钉、LSP 启动失败回收、记忆跨进程锁与批量原子提交 (03e95d5fbb)
- 🔧 Chore/Other:违禁桶兜底清扫——HEAD面等条件/待拍板未勾行自动摘除(两道机主禁令的执行器物化,留痕f12-purge;复翻席请同步摘形态,事实内容按各批结清提交保留) (401b6339b2)
- 🔧 Chore/Other:结清 3 张已修复漏勾工单(F-069/073/096) (bb9fc5dcaf)
- 🔧 Chore/Other:结清 5 张已修复但漏勾的工单(F-114/115/117/660/721,commit 均在 HEAD) (15a999e89f)
- 🔧 Chore/Other:结清 API 族 6 张已复核工单(F-324/334/346/424/432/449,commit 均在 HEAD) (b7657a2170)
- 🔧 Chore/Other:结清 F-001/F-045/F-020/F-021/F-046 五张缺陷普查工单 (362937fa5a)
- 🐞 Fix:结清 F-020/F-021 —— git 派生失败单独成档并透出 errno,git 路径输出关闭 core.quotepath (ba5168a70d)
- 🚀 Feature/Improvement:重建缺失的 assets/template.html 并放行入库 —— doctor 27 项全绿、真实渲染可读 (c2e9fd1963)
- 🔧 Chore/Other:结清 DB 族 43 张已核验缺陷普查工单(排除确证未修的 DB-09/DB-35) (224c97e121)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (58a72259c6)
- 🔧 Chore/Other:结清 DG/XUI/WEB 三族 38 张已核验缺陷普查工单(代码已入库,勾选滞后) (7bca8f6ce8)
- 📚 Docs:F-069/070/073/074/101/102 6票重新结清——并发旧基线固化把行写回,按各批结清提交(765e4d2d/36418283b)重删恢复删除态 (c09816f463)
- 🐞 Fix:重写 close-merge-reconcile 收口指引,根治 worktree 乱象指引型源头 (a91bc56727)
- 🔧 Chore/Other:违禁桶兜底清扫——HEAD面等条件/待拍板未勾行自动摘除(两道机主禁令的执行器物化,留痕f12-purge;复翻席请同步摘形态,事实内容按各批结清提交保留) (1d2d52b3fb)
- 🔧 Chore/Other:Merge origin/main: 并入远端33提交,保留本地7票翻勾(F-069/070/073/074/095/101/102)结清 (436bb31a86)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (adeaad8ff5)
- 🔧 Chore/Other:结清 F-016/F-068/F-089/F-090/F-092 五张缺陷普查工单 (f09719cc0e)
- 🐞 Fix:收口 F-016/F-068/F-089/F-090/F-092 五张缺陷普查工单 (db9c303c2a)
- 🐞 Fix:修复多模态任务退款非原子且误加 token 余额列(F-660/F-721) (2faf250017)
- 🔧 Chore/Other:结清 F-063/F-094/F-112/F-113/F-115 五张缺陷普查工单 (b15ec2dcf8)
- 🐞 Fix:收口 F-063/F-112/F-113/F-115 四张缺陷普查工单 (5e2fba2b52)
- 🔧 Chore/Other:固化在飞 PROJECT_PLAN/last-sha 改动 (e0793b38e2)
- 🔧 Chore/Other:结清 F-037/F-038/F-042/W-06/RP-79 五张缺陷普查工单 (79b0637fa9)
- 🐞 Fix:收口 F-037/F-038/F-042 三张缺陷普查工单 (0fc82234c3)
- 🔧 Chore/Other:结清 W-03/W-04/SDB-45/SDB-46/F-041 五张缺陷普查工单 (a7f3b19b4b)
- 🐞 Fix:收口 W-03/SDB-45/SDB-46/F-041 四张缺陷普查工单 (afed3a163e)
- 🐞 Fix:补齐 session-replay 适配层与四处协议/参数映射缺陷,并钉住 11 例变异自证 (bbb17b2ca9)
- 📚 Docs:结清已修复但未销账的 P0/P1 缺陷票 25 条(逐个在源码/测试核到票号标记或等价防护) (ff105bc477)
- 🔧 Chore/Other:收口在飞成果（archify CLI 渲染器、HR 工具与 manifest、swagger 主题、Web 路由生成、trae 桥接、计划结清） (90df910772)
- 🔧 Chore/Other:固化在飞README/守卫改动(并行会话成果), 为merge远端腾干净树 (4fa2fab3ff)
- 🔧 Chore/Other:结清 F-036/F-062/F-103/F-114/F-117 五张 CLI 缺陷普查工单 (0064c74e6f)
- 🐞 Fix:收口 F-036/F-062/F-114/F-117 四张缺陷普查工单 (c89755bda3)
- 🔧 Chore/Other:违禁桶兜底清扫——HEAD面等条件/待拍板未勾行自动摘除(两道机主禁令的执行器物化,留痕f12-purge;复翻席请同步摘形态,事实内容按各批结清提交保留) (ef6741060a)
- 🐞 Fix:告警降噪补全与出口去重修复 (7bfb45a4c5)
- 🐞 Fix:embed-types 支持 @ihui/types 内部传递引用,修掉 pre-push typecheck 门 (4464e623ed)
- 🐞 Fix:把 node_modules.* 兄弟目录的防线补齐到全部 19 个 tsconfig + .gitignore (fe4fc6c2c3)
- 🐞 Fix:结清 XUI-011/012——垫片补齐 createNavigationContainerRef 与 WebView 命名导出 (716be273e1)
- 📚 Docs:追认 44f87ad95a8 的归属边界——11 枚他人暂存件被并入本席提交 (83ce8f6e98)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (b2e8f128e2)
- 🐞 Fix:根治号池隔离误报+止邮箱刷屏 (9f71bb8bdc)
- 📚 Docs:F-069/070/101 3票翻勾——修复+测试全绿钉住(plugin-registry/paths校验+uninstall registry前置+读侧ACL **/.env) (765e4d2d12)
- 📚 Docs:F-073/074/095/102 4票翻勾——测试钉住全绿 (36418283bf)
- 📚 Docs:消门89 R4点名 + 重封根护栏清单解门267 (e94d3b1335)
- 🚀 Feature/Improvement:人事路由补全 OpenAPI schema 让产品 AI 对话端可准确调用 (b140ef6d96)
- 🐞 Fix:解锁提交链并落地 APK ABI 治理 (d8bcac8486)
- 🐞 Fix:门89 R5撞号根治——check-shadow-single-source 让号 316→318 (5bbd503fc5)
- 🐞 Fix:ui-parity 底部渐变遮罩 waiver —— 量纲读数伪差收口 (2d867a23a9)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (3a191459c9)
- 🔧 Chore/Other:违禁桶兜底清扫——HEAD面等条件/待拍板未勾行自动摘除(两道机主禁令的执行器物化,留痕f12-purge;复翻席请同步摘形态,事实内容按各批结清提交保留) (d5299caaba)

**2026-11-11**
- 🔧 Chore/Other:结清 F-001/F-045/F-096 三条 CLI/桌面 P0(整行删除) (a2c9b5cd61)
- 🔧 Chore/Other:结清 W-02/W-04/W-05/W-07 WEB缺陷四票(整行删除) (293f570d3c)
- 🐞 Fix:BUG-29 索引与约束缺失族补齐迁移+对账(结清) (4b53307186)
- 🔧 Chore/Other:结清 O69/RP-3/RP-4/RP-79 四票(整行删除) (653b4e1b53)
- 🔧 Chore/Other:结清 Y-25 豆包键源退化档(整行删除) (cfc40787bf)
- 🚀 Feature/Improvement:键源退化档根治——提取器派生账号级稳定 uid(uid_tt 族) (2d7728faa0)

**2026-11-12**
- 🔧 Chore/Other:运行时产物兜底——box-agent-scratch + 损坏node_modules隔离目录 (24c2ff49fa)
- 📚 Docs:按最终 HEAD 面刷新 README/README.en 生成块数字 (de4b2c1aaf)
- 🔧 Chore/Other:302p 基线对账 staleCountAssertions 0→1 (a5a2593980)
- 📚 Docs:按重放后 HEAD 面刷新 README/README.en 生成块数字 (612e888c78)
- 📚 Docs:消门89 R4点名 + 重封根护栏清单解门267 (62467aca97)
- 🐞 Fix:解锁提交链并落地 APK ABI 治理 (9381dc4816)
- 🐞 Fix:门89 R5撞号根治——check-shadow-single-source 让号 316→318 (5a5649677a)
- 🐞 Fix:ui-parity 底部渐变遮罩 waiver —— 量纲读数伪差收口 (e5eada9d7d)
- 📚 Docs:结清国标平台自动化腿——automation 计划器+内置浏览器执行面+提交闸(17 路径主提交,README 旁路单枚,origin==HEAD 已回读) (397ec95f15)
- 📚 Docs:财务部补国标平台自动化腿叙述(RP-47;派生自 HEAD blob,含提交闸与内置浏览器执行面) (b74dff82a8)
- 🐞 Fix:trae 切号档案自愈接进主链 —— 从根上消灭「切不过的号」 (598b1cf2e0)
- 🚀 Feature/Improvement:一键代账/报税接上国标平台自动化腿——内置浏览器执行面(RP-47 续 RP-46) (83e780ad51)
- 🐞 Fix:trae 切号真根因修复 —— 裸票号缺 storeRegion 被判 need-update 而当场登出 (69fc875151)
- 📚 Docs:结清「财务部板块+AI一键代账/一键报税」—— 主提交 856d0f8699ca184a05662b4fd78f9ca720f9fe4c,收敛 merge af343f9244412cadcfca47d4a8735ce0d87b3468;证据 24+43+330 pytest、mypy strict 0 错、web typecheck 8/8、五语 parity/纯度门绿 (a452637a2d)
- 🚀 Feature/Improvement:财务部板块 + AI 一键代账/一键报税(MCP 插件深绑对话·实时进度回显 RP-46) (856d0f8699)
- 📚 Docs:追认 44f87ad95a8 内被并发 add -A 卷入的更新提示/档位表改动 (72bfa290d1)
- 🐞 Fix:工具判定加确认重试 + 半截流不判死;长上下文输出预算 256→1024 (44f87ad95a)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (b400085104)
- 🔧 Chore/Other:.gitignore 补凭据隔离+恢复核查临时件兜底,根治并发污染 (b66962b673)
- 🔧 Chore/Other:RP-76/77/78/81 认领释放号对齐远端(isolate: 与 origin 同一批摘牌的另一枚释放号,正文逐字相同) (52ca336fbb)
- 🐞 Fix:长上下文针测把 relay 错误帧与"上游无此模型服务"分开处理 (db5c3dc0c6)
- 🐞 Fix:WorkBuddy code=11102(service info not found)判模型级,不再永久"未验证" (f2fa36983f)
- 🐞 Fix:结清 AIS-015/017/018/020/041——多条 system 固定前导、行为偏好按用户隔离、向量维度对齐、回合截断取整回合、流会话属主闸门 (c25e21bd37)
- 📚 Docs:结清第 21 批 AIS-015/017/018/020/041 (17499d41fb)
- 🚀 Feature/Improvement:停用 git worktree 开发隔离并加防回归守门(§12d,机主定案) (3779cd760d)
- 🐞 Fix:长上下文针测双路判定 + 结论按结果分档复测,修复误判不可自愈 (3fedbceda8)
- 🐞 Fix:ACP 方法注册门移出 KNOWN_CLI_FLAGS 错插位,移回 checks 数组尾并改序 317(避让 origin/main 侧 316 worktree 门) (0126d9c789)
- 🔧 Chore/Other:全仓箱形投影类名迁移至 shadow-elevation-* 档位 + 语义豁免标注 (8e7fdb1220)
- 🔧 Chore/Other:阴影投影唯一源守门接入三Runner + Tailwind v3 端 boxShadow 档位映射 (89da19de82)
- 🐞 Fix:索引读缓冲抬到 256MB,治好 ENOBUFS 掐死全部提交 (7877f31cee)
- 🐞 Fix:更新提示完成态整块铺满卡片宽,按钮圆角归回 8px (64b31061d1)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (8978d57de1)
- 🔧 Chore/Other:色板读取器补齐版权与溯源水印头 (785ec6f2fe)
- 🔧 Chore/Other:钉住「按钮槽位=位图内禀尺寸」与更新提示视觉口径 (cc7f895c0b)
- 🐞 Fix:工具调用探测改为流式判定,修复 workbuddy 全家的工具能力误判 (80cfbb12df)
- 🔧 Chore/Other:忽略 agent 任务注册表与 pytest 临时目录 (9b75e56a62)
- 🐞 Fix:更新提示视觉收口——去掉蓝色发光族,投影走档位表,强更弹窗提层 (f064c073a5)
- 📚 Docs:结清第 20 批 AIS-004/009/013/014/022 (cdd0a4b479)
- 🐞 Fix:结清 AIS-004/009/013/014/022——首包前 SSE 心跳、Gemini 原生 usage 归一、Anthropic 缓存输入总量口径、成本账本属主收敛 (7cd781452b)
- 🚀 Feature/Improvement:安装器配色改读设计令牌,修正开关位图裁切与控件基线 (bd73bf0f38)
- 🔧 Chore/Other:两份文档补来源水印 (0cbf9e4b0b)
- 🔧 Chore/Other:刷新四类生成物,消除产物滞后 (db51ac4372)
- 🐞 Fix:还原被误脱敏的业务邮箱,同步重建 README (4281528ca8)
- 🔧 Chore/Other:补齐 137 个文件的来源水印声明 (53bd6e482b)
- 🔧 Chore/Other:结清 AIS-001/002/005/010/012 五条缺陷票（修复与回归已入库 92a93941b50） (ed05fbd6e9)
- 🐞 Fix:结清 AIS-001/002/005/010/012——流中错误不再当成功、断线取消 run 与在途冲突、Gemini 工具配对、Ollama error 帧 (92a93941b5)
- 📚 Docs:auto档同步四语 README（changelog/日期/F票记录，非逻辑代码） (a61cec7719)
- 🔧 Chore/Other:WebView2 Runtime 探针补真机单测 (418fdf4709)
- 🔧 Chore/Other:结清 AIS-032/033/034/038/039 五条缺陷票（HEAD 已修 + 本批补测入库 fc1a316974e） (7cc300bea4)
- 🔧 Chore/Other:结清 AIS-032/033/034/038/039——补齐会话身份、RAG 属主、图谱属主、Hook 提权、预算越权回归（并给 RAG 加条目级属主兜底） (fc1a316974)
- 🔧 Chore/Other:新增 §12d 停用防回归守门 check-worktree-dev-banned(316,blocking) (2f6997bf5f)
- 📚 Docs:清理薄壳离线降级过期口径并同步 dev 配置描述 (d1a1d395b1)
- 🚀 Feature/Improvement:探活分级、离线页立即重试与 WebView2 版本门槛 (e88756f4fa)
- 🔧 Chore/Other:结清 F-703/705/706/711/712 五条缺陷票（修复与回归已入库 e27227b9203） (0c6b54d5f7)
- 🐞 Fix:结清 F-703/705/706/711/712——智能体详情 int8、A/B 聚合字符串拼接、用量比率精度、WS 限流口径与重连游标 (e27227b920)
- 🐞 Fix:workbuddy 账号池失败后不再回环兜底 ai-service (519c3c4bef)
- 🚀 Feature/Improvement:长上下文首轮全覆盖 + 自举目录同步前沿口径 (042ed7cecb)
- 🔧 Chore/Other:结清 CLI F-002/003/006/007/008 与 API F-700/704 七条缺陷票（修复与回归已入库 b46128f309c） (559599bb3f)
- 🐞 Fix:结清 F-002/003/006/007/008/700/704——退出码、进程树回收、审计与 argv 脱敏、钱包与看板 int8 溢出 (b46128f309)
- 🔧 Chore/Other:结清 F-628/629/701/702/718 五条缺陷票（修复与回归已入库 5219f2440db） (f38f2aa4f1)
- 🐞 Fix:结清 F-628/629/718/701/702——中转成本改读真实列、退款回收赠送 token、余额不足扣成欠费并准入拦截、两处 SUM int8 溢出 (5219f2440d)
- 🐞 Fix:托盘拉起切号器用 cmd /d 关掉 AutoRun (245b9930be)
- 🐞 Fix:补 createBlacklist mock 修 blacklist fail-closed 回归 (e44bf1fc00)
- 🔧 Chore/Other:结清 F-40/76/77/87/91 五条缺陷票（修复与回归已入库 221e0cdaadf） (fdf49b2a2b)
- 🐞 Fix:结清 F-87/91/76/77/40 五条缺陷票——媒体代理计费、通知失败重试、PDF 合并上限、部门用户凭据投影、后台 Agent 有界回收 (221e0cdaad)
- 🐞 Fix:离线兜底页补齐状态告知并纠正薄壳降级描述 (be7035bb2b)
- 🐞 Fix:relay 临时目录清理失败不得吞掉业务结果 (2249dc260b)
- 📚 Docs:补开发版配置路径(两套 identifier 各写各的) (f139ac8ad6)
- 🔧 Chore/Other:prettier 格式化 README 的托盘示例数组 (10a2c27874)
- 📚 Docs:托盘 relay_switch 示例改放 quit 之前并说明分组理由 (21397faa33)
- 🐞 Fix:长上下文针测不再把推理模型截断误判为不支持 (bea1251881)
- 🐞 Fix:relay 的 JSON 捕获改临时文件 + 括号配平切载荷,修两处真实缺陷 (a446503454)
- 🔧 Chore/Other:结清 F-07/21/37/48/49 五条缺陷票（修复与回归已入库 abe1fa32fb4） (d1b0d99088)
- 🐞 Fix:结清 F-07/21/37/48/49 五条缺陷票——后台 Agent 归属、业务日键、积分发放补偿、图片任务原子认领、MCP 网关统一 deadline (abe1fa32fb)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (fac7b192d5)
- 🐞 Fix:拆定时炸弹——计划任务不再绑带版本号的 node 路径,自检扩到六项 (633222ecb9)
- 🔧 Chore/Other:结清 F-22/35/42/46/52 五条缺陷票（修复与回归已入库 96512fab9e6） (f4904682db)
- 🔧 Chore/Other:footer 回归用例改挂 public project,脱离登录口令依赖 (fb75f9c2a3)
- 🐞 Fix:relay 网关探测保留完整模型 id，修复 workbuddy 全家能力结论被 403 污染 (5c8c357b6a)
- 🚀 Feature/Improvement:托盘新增操作员专属「AI 客户端一键切号」入口(默认隐藏) (96512fab9e)
- 🐞 Fix:F-22 营收聚合改 bigint 且查询失败不再吞零, F-35 预扣结算失败重试并留对账标记, F-42 产物列表去同步IO, F-46 降级计数器可回收, F-52 终端历史 ZSET 分页 (5858f6aa8f)
- 🔧 Chore/Other:--status 日志行补注『空转轮不写日志』避免误判停滞 (a042e6c583)
- 🐞 Fix:首页移除微信小程序按钮并恢复 Gitee 仓库入口,修正 footer 三栏断点 (adb2d40849)
- 🐞 Fix:回收遗留在生产 checkout 的 A9 具名豁免(~initRoundShardResume) (e942aca9a1)
- 🔧 Chore/Other:结清 F-66/68/70/72/73 五条缺陷票（修复与回归已入库 629d7fca176） (754e9c1967)
- 🐞 Fix:F-66 批量取消条件更新入事务, F-70 OSS STS 策略收敛本人前缀与大小上限, F-72 webhook 触发防重放, F-73 出站 webhook 补 HMAC 签名, F-68 礼物账本回归 (629d7fca17)
- 🚀 Feature/Improvement:--status 一键健康自检 + 号池单测生产隔离修复与守门 (9ceeebf48a)
- 🐞 Fix:公开内容面(tools/news/articles/announcements)补免租户并钉回归锁 (90cc804c79)
- 🔧 Chore/Other:结清 F-36/38/47/50/71 五条缺陷票（修复与回归已入库 7b42edccc43） (0310fba8c1)
- 🚀 Feature/Improvement:选择器只显示前沿模型,同族保留最新两代 (4fefe37168)
- 🐞 Fix:F-36 邮件未发出即重试, F-47 备份 cron 落库前校验且失败保留旧调度, F-50 anthropic 端点补鉴权, F-71 回调日志收口管理员 (7b42edccc4)
- 🔧 Chore/Other:结清 F-58/59/60 三条缺陷票（修复与回归已入库 228f9f86db5） (148cefdd7f)
- 🐞 Fix:F-58 手机注册校验短信码, F-59 租户忽略客户端 plan 并保护 owner, F-60 上报忽略客户端 IP, F-57 授权码绑定 clientId, F-112 身份覆盖回归 (228f9f86db)
- 🐞 Fix:计划任务改 node.exe 直执行 + 脚本内置日志(实测 0xC000013A) (fac97bef4f)
- 🐞 Fix:补 /api/app-version/ 免租户并钉回归锁(治租户401潜伏雷) (c64375fa40)
- 🐞 Fix:落库载荷改回平台原生形状 + 拉回解析去 --json (9e9c213fd9)
- 🔧 Chore/Other:结清 F-86/88/107/108/110/111 六条缺陷票（修复与回归已入库 a83a802010e） (5fa69bc106)

**2026-11-11**
- 🐞 Fix:F-86 Realtime WS 复用共享鉴权与配额预检, F-88 batch 末次尝试才落终态, F-107/108 归属绑定, F-110/111 客服 WS 广播鉴权与槽位释放 (a83a802010)
- 🐞 Fix:同步改用平台原生导出形状 + core 四元组指纹 + raccoon 导出映射 (8f2e70765b)
- 🐞 Fix:工具探测强制 tool_choice=required、放宽到 45s、并发 8→4 (e84a2a3102)
- 🔧 Chore/Other:结清 F-61/62/63/103/104 五条缺陷票（HEAD 已修，本批复核既有回归 31 例全绿） (568a2043b4)
- 🚀 Feature/Improvement:号池跨环境双向自动同步(变更打点 + 收敛式对账 + 计划任务) (601488e231)
- 🔧 Chore/Other:结清 F-17/F-33 两条缺陷票（回归已入库 030cfde6994） (f132baea34)
- 🐞 Fix:F-55 补唯一 active 签名密钥吊销保护，F-17/33/54/56 补回归钉死 HEAD 既有修复 (030cfde699)
- 🚀 Feature/Improvement:悬浮球 hover 辉光 + 最小化图标固定默认落点 (16661511ca)
- 🔧 Chore/Other:结清 F-05/08/27/32/53 五条缺陷票（回归已入库 9a14f1d9ded） (5fbf1447e3)
- 🔧 Chore/Other:F-05/27/32 补回归钉死 HEAD 既有修复，F-53/F-08 补 fail-closed 细节，修 F-09 遗留 payment 测试桩 (9a14f1d9de)
- 🚀 Feature/Improvement:本地⇄生产号池自动同步互通(默认推生产 + --sync-pull 拉回) (bf820ca1ae)
- 🚀 Feature/Improvement:新增 ihui relay 命令组,把号池切号封装成可调用命令面 (bc4ce32477)
- 🔧 Chore/Other:结清 F-09/10/11/14/16 五条缺陷票(修复与用例已入库 920fbfc47f4) (d114992763)
- 🐞 Fix:HR-3 微信订阅消息字段 key 对齐真实模板(实测收尾) (bd1bd6091f)
- 🐞 Fix:F-09/11/14/16 修复（退款调渠道前抢占防双退/积分账本改会员级 advisory lock/扣费先占位幂等键再扣减/提现回调 rawBody fail-closed），F-10 复核已在 HEAD 修复并补用例 (920fbfc47f)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (8f5675e664)
- 🐞 Fix:工具探测预算 64→256,截断/限流记未知而非"不支持" (24c2ee20c7)
- 🐞 Fix:修两族报警真因——app-version端点补免租户 + A9轮起点腿登记豁免 (0417dc0dc2)
- 🐞 Fix:一键切号桌面快捷方式安装器覆盖新入口 (c916ffda00)
- 🐞 Fix:首页移除未合并的 awesome PR 拉票链接 (cbaa3e498c)
- 🔧 Chore/Other:结清 SDB-27/48/56 与 F-01/F-13 五条缺陷票(修复与用例已入库 e618edbfa81) (636a673c4e)
- 🐞 Fix:SDB-48/56 与 F-13 修复（Key 用量按 apiKeyId 归因/直聊补写用户轮/配额窗口重置进 WHERE），SDB-27 与 F-01 复核已在 HEAD 修复并补用例 (e618edbfa8)
- 🔧 Chore/Other:结清 SDB-36/38/39/49/54 五条缺陷票(修复与用例已入库 e63cafc9824) (a8dfdbfe37)
- 🐞 Fix:修复 SDB-36/38/39/49/54 五条缺陷（金丝雀阶段迁移 CAS/停用节点不再入结果/符号检索缺归属即拒/摘要列单写者防覆盖/导入周期判据复用调度器解析） (e63cafc982)
- 🚀 Feature/Improvement:首页 Star 按钮展示 GitHub 实时星标数 (9e6989d206)
- 📚 Docs:HR-1~HR-4 四行翻勾(人事部功能系列已交付并验证) (155a67f9f1)
- 🚀 Feature/Improvement:人事部功能系列 HR-1~HR-4 全量落地(代码层 + README 生成块) (a8cf8d4f4d)
- ⚡ Perf:仿真/真机池改有界并发，绑定口径对齐手机端免扫码 (a8a24b7aa6)
- 🚀 Feature/Improvement:探测升级为流式/工具/长上下文三项实测,选择器按行展示 (82fd86a2b3)
- 📚 Docs:deploy-feedback 自动登记(deploy_outcome;端到端反馈闭环第二切片,O65 自进化系列) (fe6283ecbe)
- 🔧 Chore/Other:结清 SDB-08/28/32/37/40 五条缺陷票(修复与用例已入库 54152ef) (2c729e29a1)
- 🐞 Fix:SDB-08/28/32/37/40 usage 兜底计 input/ERC20 复核倒序翻页/换票账号锁+CAS/DAG 取消传播/沙箱路径闸补全 (54152efcd5)
- 🐞 Fix:下调全局 accent,收口弹层菜单 hover 对比度 (67c74511fc)
- 🐞 Fix:relay 白名单按带前缀模型名登记,探测 403 时回退完整 id 复测 (0e673f6b5f)
- 🐞 Fix:站内消息已读状态落库,刷新后红点不再复活 (2d3cc78874)
- 🚀 Feature/Improvement:公众号合法微信绑定链脚手架(纯接口参数,真人授权收口) (dcf06a1333)
- 🐞 Fix:报警刷屏降噪——补7条族级24h窗口 + budget按日节流 (2e7658179a)
- 🔧 Chore/Other:精修站内消息二级菜单行距与底部入口 (cbc193027f)
- 🚀 Feature/Improvement:站内消息改悬停二级菜单并统一飞书式通知列表 (f25bcd435c)
- 🔧 Chore/Other:结清 SDB-05/17/35/41/42 五条缺陷票(修复与用例已入库 3948c58) (1b45537f33)
- 🐞 Fix:SDB-05/17/35/41/42 订阅无限配额流水/推荐重放/回滚未知态/spec 提交路径/cc-switch 导入校验 (3948c58b1f)
- 🐞 Fix:ModelOption 补齐 verified/healthError 字段,修复生产构建类型检查失败 (2573157b59)
- 🔧 Chore/Other:结清 SDB-03/06/07/09/30 五条缺陷票(修复与用例已入库) (949616c8ed)
- 🐞 Fix:修复 SDB-03/06/07/09/30 五条缺陷(0 天永不过期/限流原子化/刷新 TTL 未知/registry 字段净化/Crew 按 run 计费) (11ac3be553)
- 📚 Docs:固化纯接口参数翻判据的全量证伪证据 (d967a7cc6f)
- 🚀 Feature/Improvement:公众号任务真机实跑 LIVE 模式(达标即真实领奖) (5c29f08f8b)
- 🔧 Chore/Other:结清 SDB-01/04/26/29/31 五条缺陷票(修复与用例已入库 5280eac) (7d7c92075f)
- 🐞 Fix:区分已验证/未验证模型并修复平台中转模型 401 (2f7882cd32)
- 📚 Docs:deploy-feedback 自动登记(deploy_outcome;端到端反馈闭环第二切片,O65 自进化系列) (850f5805b0)
- 📚 Docs:deploy-feedback 自动登记(deploy_outcome;端到端反馈闭环第二切片,O65 自进化系列) (3a4f28a574)
- 🐞 Fix:修复 SDB-01/04/26/29/31 五条缺陷(设备令牌归属闸/不限窗口配额/PR 文件翻页/注销吊销凭据/团队记忆写权限) (5280eaca65)
- 📚 Docs:deploy-feedback 自动登记(deploy_outcome;端到端反馈闭环第二切片,O65 自进化系列) (8f5766750b)
- 🔧 Chore/Other:结清 SDB-10/11/12/33/44 五条缺陷票(修复与用例已入库 cbec88d) (7ba58a64de)
- 🚀 Feature/Improvement:公众号任务绑定生效闭环离线仿真(四阶段状态机) (f74e9163db)
- 🐞 Fix:修复 SDB-10/11/12/33/44 五条缺陷(历史配对顺序/事实归属守卫/PayPal custom_id/支付宝时间戳验收/过期先查链) (8547265806)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (6cbcf13264)
- 🔧 Chore/Other:结清 SDB-13/14/15/16/18 五条缺陷票(修复与用例已入库 f54f9bc) (94446abc23)
- 🐞 Fix:修复 SDB-13/14/15/16/18 五条缺陷(桥接流错误固化/接码响应校验/导入规则收紧/总线业务码/残缺备份闸门) (f54f9bcb0f)
- 🚀 Feature/Improvement:取证公众号订阅参数接口并接入引擎 (6c85d2c7d5)
- 🔧 Chore/Other:结清 SDB-19/20/21/34/43 五条缺陷票(修复与用例已入库 e5984c2) (94e5c1ee9f)
- 🐞 Fix:修复 SDB-19/20/21/34/43 五条缺陷(集成调用同源校验/stop 收尾超时/CTR 口径/偏好判真单点/检查失败升级上报) (e5984c2794)
- 🐞 Fix:补 health-gate-evidence 测试第4组逐维断言 + 521 误回滚收口票 (fc2c4f0180)
- 🔧 Chore/Other:结清 SDB-25/47/50/51/52 五条缺陷票(修复与用例已入库 06d0ece) (d065806d91)
- 🐞 Fix:修复 SDB-25/47/50/51/52 五条缺陷(回调双闸归一/推送桩 fail-closed/索引建目录/终端白名单 token 匹配/备案号批内去重) (06d0ecedd2)
- 🔧 Chore/Other:结清 SDB-22/23/24/53/55 五条缺陷票(修复与用例已入库 90ff53e) (00b2963c1b)
- 🐞 Fix:修复 SDB-22/23/24/53/55 五条缺陷(时间比较/导出截断标记/角色回落/告警窗口口径/Telegram 转义) (94abc74460)
- 🐞 Fix:刷新 README 生成块文件计数对齐合并后现算值 (7168cbe51f)
- 🔧 Chore/Other:撤销侧车归属 1042 条,开放任务全部回待接单面 (4dc85b0527)
- 🚀 Feature/Improvement:删除邀请功能 + 打通小浣熊每日签到长期自动化 (33333da419)
- 🔧 Chore/Other:活文档对齐远端 HM-1 归属牌声明位最新面 (d4b7861b3d)
- 🚀 Feature/Improvement:取证 travel/depart location_id 并补齐订阅任务自动领奖时序 (41c03f66af)
- 🔧 Chore/Other:活文档对齐远端 HM-1 第 0 步最新登记面,消除收敛落地闸的滞后副本 (be6bd133b6)
- 📚 Docs:HM-1 归属牌移到编号声明位(散文归属尺只认声明位) (024bc3bcad)
- 📚 Docs:HM-1 第 0 步入库留痕并改归机主真机验证面 (ea9e0112c3)
- ♻️ Refactor:elevation 档位补齐 Android elevation 并收口 CSS 别名第二源 (2a13b51128)
- 🐞 Fix:修 5 条既有红并收窄弹层高度扫描面 (cebb73dafb)
- ♻️ Refactor:浮层投影统一走 design-tokens ELEVATION_STEPS 档位 (adbe310621)
- ♻️ Refactor:收拢剩余 24 处 expo 调用,并把 picker 门面按包拆开 (511adddfe5)
- 🚀 Feature/Improvement:接通 skill_share 分享链并纳入全量自动驾驶巡检 (838bf0c1ea)
- 🐞 Fix:健康门禁 originOk 改为逐维救援,修复切流窗口 521 误回滚 (42d29418d3)
- 🚀 Feature/Improvement:建立平台适配层门面,收拢 7 个 expo 域(鸿蒙 A2 第 0 步) (19c81cf5eb)
- 🔧 Chore/Other:活文档对齐远端 Y-70/Y-3 最新裁决面,消除收敛落地闸的滞后副本 (b7567d8143)
- 🔧 Chore/Other:补浮窗档分屏禁用回归断言(防 360px 内再分栏溢出) (9b431d1b83)
- 📚 Docs:登记 HM-1 鸿蒙适配 A2 路线第0步(平台适配层) (435f437df6)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (879a4f2c0f)
- 🐞 Fix:将 APP REST 基址 www.aizhs.top 切到稳定的 api.aizhs.top(双保险其一) (2f0280ffde)
- 📚 Docs:补记 Y-70/Y-3 agent 侧子项已清零(仅剩机主凭据/备案/鸿蒙产物) (109c86e869)
- 🚀 Feature/Improvement:客户端会话镜像——根治双消费者轮换竞态(minimax grant 吊销实证) (de22e7492f)
- 🐞 Fix:切号三连修——G盘exe定位/explorer主通道/最小档兜底写回 (ba6fbdb528)
- 🔧 Chore/Other:活文档对齐远端归档移出后的最新面,消除收敛落地闸的滞后基线副本 (7729e5afef)
- 🔧 Chore/Other:重封清单对齐 4f4e686ec39aab301cfe2f755ad65f664eed1e54 规则面(guardian-runner 等门改动同枚落库以放行部署环 fail-closed) (6b50bea596)
- 🔧 Chore/Other:结清 RP-64 判据面追认积压(IG 门红0/门29已同步) (dceaebc5bd)
- 🔧 Chore/Other:追认孤儿目录壳清扫腿枚 2e16a53572 的 AGENTS.md 判据面命中 (96be0510e3)
- 🐞 Fix:修复 RN 邮箱验证码「点了没反应/无倒计时/收不到」三处根因 (889a6e6984)
- 📚 Docs:trackedFiles 计数刷新至 20846 (ad2c88fe37)
- 🐞 Fix:生产 app_versions.latest 的过期 OSS 签名直链做幂等收口 (4b46984084)
- 🐞 Fix:孤儿目录壳清扫腿收口 10 项代码审查(B1/B2/I1-I4/M1-M4)+镜像测试与 AGENTS 留痕,并重封根护栏清单清偿 HEAD 存量 fail-closed (2e16a53572)
- 🐞 Fix:预修还原被 52991b53 旧底稿同步误删的模型健康接线面(为收敛裁决 import 预立两侧动过形态) (27e5263140)
- 🐞 Fix:根治 APK 更新卡死(版本双写 fail-closed + installing 出口 + 服务端假阳性) (6e7f54552c)
- 🐞 Fix:旧底稿整份回退哨兵(提交面报警 + 推送前硬拦) (0de2c0c35a)
- 🔧 Chore/Other:追认i18n跨端门自检1枚 (43a6d76b7e)
- 🐞 Fix:i18n 跨端门自检登记器改为当场求值，5 条用例不再空跑 (03ddbc8fb7)
- 🔧 Chore/Other:README 数字块按索引面重算（门数 359/330、测试文件与跟踪文件同批） (cd25562745)
- 🚀 Feature/Improvement:新增 raccoon-crypto/invite 及测试 (0ae1139db2)
- 🔧 Chore/Other:同步开发改动（合并 origin/main 后落提交本地工作面） (52991b5365)
- 🔧 Chore/Other:合并面文档与生成物按对侧刷新（本侧零意图改动） (9d4ac189fb)
- 🔧 Chore/Other:撤回 ApiKeysScreen 三处档值微调，改由 302p 基线登记 (81b541ee47)
- 🐞 Fix:收敛器补转 --fold-keep 与 --declare-side-loss 两条声明出口 (99d0a54bfd)
- 🔧 Chore/Other:ui-routes 派生面按现 HEAD 面重生成落写回档(复量同面) (c32db7cb6c)
- 🐞 Fix:302p 基线复位 139 + ApiKeysScreen 非档值落档 (be504e408d)
- 🐞 Fix:守门 314→315 撞号让位与按钮描边门 RN 族存量纳管 (7a8a30ae04)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (8bb8cd956b)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (3fc9d80fe2)
- 🐞 Fix:门8 method 推断⑤段加块尾守卫——已闭合函数不再向匿名回调裸fetch借POST(修 edu-attendance e2e 假阳性;T5/T6 夹具钉住) (df51ce0ce5)
- 🔧 Chore/Other:追认人工归并枚 63d4ff3b92 的判据面命中(5 面) (8a7c580112)
- 🐞 Fix:恢复 425ae8286f 误删的 renderStablePin —— 陈旧副本收编把 scripts/lib/generated-input-pin.mjs 翻回 4ab41d4292 之前形态,抹掉稳定钉函数(33行),而调用方四端 generate-ui-routes 与镜像测试 generated-input-pin-stable.test.mjs 仍 import ⇒ 生成器全断(pre-commit --heal-ui-routes 即红)。逐字节回植 4ab41d4292 原版;镜像测试 6/6 绿,miniapp-taro/extension 生成器实测 exit 0。 (03abecfa6e)
- 🐞 Fix:菜单分割线全仓清零 26 处 + 族7豁免收窄为交互式手柄(根治 §66 后门) (917b33ec56)
- 🐞 Fix:WorkBuddy AI 版进程探测与域校验双臂修复 (84636f3175)
- 🔧 Chore/Other:漂移门基线全维刷新至尖 8ddc8d2256 —— 唯一恶化维 tierRnMissingN 134→142 逐处 file:line 证据:packages/app/src/features/api-keys/ApiKeysScreen.tsx:491/:573 paddingHorizontal:5、:492/:554/:574 paddingVertical:1(← 对侧 10f86bc743 共享屏下沉五处)+ packages/app/src/features/patrol/PatrolScreen.tsx:898 paddingVertical:1、:912/:921 gap:3(← 对侧 cd9a85fea2 patrol 屏三处);好转五维 fidelityHosted 239/fidelityPackAbsent 0/fidelityRetractionRot 0/mpTierLiteral 597/duplicateWebKeys 0 按终尖现读重置;evidence 锚点按尖行号重指 (a4d95d3a2c)
- 🔧 Chore/Other:settle B40 + docs-207 rows (both fix seats landed and independently verified) (52ccc1e94e)
- 🐞 Fix:docs-207 第二刀——摘除 207 条目被 9c7d050b58 回灌的 skipEnv 逃生舱(装车形态锁转绿,注册/消费面零命中) (4a17c3c321)
- 🐞 Fix:B40 compose 镜像 tag 缺省即失败(:?)+守门判据 + cli 测试补断言(typecheck:tests 214→0 余档,席已并入的测试修复另枚在账) (1022021cbe)
- 📚 Docs:合并面生成块数字按 HEAD 现读刷新 —— 仓库瘦身 181 件删除+对侧 4 批增量入库后 trackedFiles/字节数重量(173 号门 sync-readme-numbers 官方通道;LAND_ALLOW_STALE 显式声明:20836 是合并面实测非陈旧复活) (3742d33d25)
- 🐞 Fix:message-input 浮窗档强制显示工具栏文字 (forceToolbarText) (d1722cc7cc)
- 🔧 Chore/Other:settle RP-44/RP-45 (fix seats landed; cmd atomicity + api timezone single-source, tests green) (2c0497f4ce)
- 📚 Docs:re-register RP rows from recheck seat A (lost in stale-baseline revert 16787b7af5) (e166ad2269)
- 🔧 Chore/Other:re-settle 113 closed rows (revert 16787b7af5 restored stale ledger; re-applied per recheck seats A/B/C evidence) (13e55a10e3)
- 📚 Docs:README 与 GATEKEEPERS 更新 (67406951df)
- 🔧 Chore/Other:新增 updater 边界测试 (5e7b0d5785)
- 🔧 Chore/Other:新增 tui-fullscreen-keys/terminal 边界测试 (0c73922a67)
- 🐞 Fix:按钮边框色检查更新 (cb2c7b7cd8)
- 🚀 Feature/Improvement:workbench session rail 组件 (8021c1ba2e)
- 🔧 Chore/Other:新增 agent-extended/subagent-*/tool-*/trash-* 边界测试 (b8f0bbeec6)
- 🔧 Chore/Other:新增 sandbox/subagent-extended 测试 + scripts 按钮边框色检查更新 (9d00adf3c4)
- 🔧 Chore/Other:新增 permission-lease/plugin-cache-recovery/product-form 边界测试 (d3ae858f3b)
- 🔧 Chore/Other:pkg-ai 聊天样式 (5c8ebf534e)
- 🔧 Chore/Other:新增 nested-additional-properties/p1-evidence-gaps 边界测试 (10ab3224ab)
- 📚 Docs:AGENTS/PROJECT_PLAN 更新 (16787b7af5)
- 📚 Docs:守门人文档更新 (de4a868ae1)
- 🚀 Feature/Improvement:按钮边框色守门基线检查与 guardian-runner 更新 (a31648c4f1)
- 🚀 Feature/Improvement:patrol 屏组件 (756adf2fc4)
- 🚀 Feature/Improvement:关于联系页与 rn-compat 路由/壳生成物同步 (0d7fd2cf33)
- 🔧 Chore/Other:新增 hooks-trust-gate/lsp/machine-credentials/mcp-* 等边界测试 (edc4c860e8)
- 🚀 Feature/Improvement:多 admin/agent/edu/enterprise 页面与 AI/chat/云运行/客服组件更新 (8d0f79b817)
- 🔧 Chore/Other:补全 ACL/ACP/agent/权限/插件/后台/checkpoint/compaction/SSRF/hook 边界测试与 client-claims (ee6b7b1966)
- 🚀 Feature/Improvement:payment-recurring 上海时区下次扣费 + subscription/api-key-quota 日重置/biz-day/agent-extended 路由 (948597a9a7)
- 🚀 Feature/Improvement:relay-account 转发与号池模型健康监测(含上海时区修复与模型过滤) (9db6361988)
- 🐞 Fix:install-auto-deploy-task.cmd 去 /create /f 先拆后建,改 /query→/change 就地更新→缺才 create(RP-22, DBG-84 同族残余;镜像测试钉三判据) (02c145cf9e)
- 🐞 Fix:移除对已删除 coze-chat-queries 模块的悬空 vi.mock 引用 (c13291363f)
- 🔧 Chore/Other:持久声明补 README×4 与 miniapp i18n 生成件取对侧 (9e4f83dd6f)
- 🔧 Chore/Other:settle 16 rows from recheck seats B+C (infra 8 + business 8, evidence per-seat) (3f8cbf7bd1)
- 📚 Docs:register 2 RP rows from recheck seat A (DBG-84 cmd /f residue + DBG-7 local-calendar scatter x3) (300c53d6e9)
- 🔧 Chore/Other:settle 9 remaining DBG bug-hunt rows (recheck seat A: all CLOSED, fixed-without-marker, evidence per-file) (8bae5a7499)
- 🔧 Chore/Other:settle 88 DBG bug-hunt closed rows (code-face DBG markers + mirror tests verified; 完成即删) (3b509ce0bb)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (5201a66c50)
- 🐞 Fix:re-land intentional-delete coze-chat-queries.ts (2026-11-09 allowlist, dead query layer behind 404-ed endpoints; guardian heal resurrected it twice) + sync README trackedFiles blocks 20829->20828 (DN5) (e9bf534933)
- 🐞 Fix:scratch 墓碑回收腿 —— rmScratch 改名墓碑(.stale-<ts>)按名字死亡戳判龄(60 分钟下限,env 只加严不穿),不再被子树 mtime 6h 闸整轮错过;镜像 T32-T37 + 红证(旧码 2h 墓碑 0 候选) (d760f047a5)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (19b286097f)
- 🐞 Fix:containment 门撞号 175→314 + README 数字刷新与点名 (3b44a123ed)
- 🔧 Chore/Other:提交根目录文档 深度清理Git仓库垃圾文件.md (2a4dccdfc7)
- 🔧 Chore/Other:提交 scripts 的未提交改动 (90 文件) (425ae8286f)
- 🔧 Chore/Other:提交 root 的未提交改动 (9 文件) (2f66efbca8)
- 🔧 Chore/Other:提交 packages 的未提交改动 (50 文件) (b43093af88)
- 🔧 Chore/Other:提交 docs 的未提交改动 (4 文件) (2e0820129b)
- 🔧 Chore/Other:提交 deploy 的未提交改动 (8 文件) (5d8aff3ceb)
- 🔧 Chore/Other:提交 benchmarks 的未提交改动 (37 文件) (cb0aa51554)
- 🔧 Chore/Other:提交 apps/web 的未提交改动 (52 文件) (7b98c933c9)
- 🔧 Chore/Other:提交 apps/mobile-rn 的未提交改动 (51 文件) (058bb378c2)
- 🔧 Chore/Other:提交 apps/miniapp-taro 的未提交改动 (39 文件) (20933a9e52)
- 🔧 Chore/Other:提交 apps/extension 的未提交改动 (23 文件) (7b0fa29d98)
- 🔧 Chore/Other:提交 apps/desktop 的未提交改动 (2 文件) (e463066e2a)
- 🔧 Chore/Other:提交 apps/cli 的未提交改动 (20 文件) (a7271dbc0f)
- 🐞 Fix:R4 模板去路径字面量 + README 数字刷新与点名索引恢复 (5553d3bee8)
- 🔧 Chore/Other:提交 apps/api 的未提交改动 (70 文件) (174ebfed98)
- 🔧 Chore/Other:提交 apps/ai-service 的未提交改动 (171 文件) (87e5810c29)
- 🐞 Fix:根治 partial-clone 懒取回把判据/对齐拖死(2026-11-11) (01dfefb764)
- 🐞 Fix:robocopy maxBuffer 扩容根治回收删除腿 ENOBUFS 假失败 (919b3e600c)
- 🔧 Chore/Other:守门:README RECENT 块外禁增(5833953de0 复发防线) (d96cce0629)
- 🔧 Chore/Other:侧边栏三处字号 text-sm 收敛到 text-body 令牌 (b7dab01acd)
- 🔧 Chore/Other:📚 文档:裁掉 README 锚点外 37179 行历史散落(STRAY_OUTSIDE=4419 枚,写入器已归并最新条目进块) (eb182b6d0f)
- 🐞 Fix:回收器双出口 tag-then-remove + 空闲信号根治巡检污染 (637f750493)
- 🔧 Chore/Other:📚 文档:裁掉 README 锚点外 37179 行历史散落(STRAY_OUTSIDE=4419 枚,写入器已归并最新条目进块) (5833953de0)
- 🔧 Chore/Other:工作树回收射程扩至同盘兄弟检出并收紧空闲阈值到 1 天 (5721eab5cb)
- 🔧 Chore/Other:废弃 doubao-carry 对外方案并重构 relay 长连接与承载页; RepoWiki/Patrol 改用 design-tokens; 同步 cross-end 派生产物 (7740a55348)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (a51ee3250a)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (51af690876)
- 🔧 Chore/Other:壳声明件跟随新落承载页(260 条说明符) (b343fb9047)
- 🔧 Chore/Other:自动落 2 枚小程序壳承载页(共 2 枚待产) (b52af9a4d1)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (b5f52cd1d7)
- 🔧 Chore/Other:移除 miniapp-taro 下误提交的 mobile-rn 资产副本(13MB,无任何引用) (c33dd54e9b)
- 🔧 Chore/Other:清偿仓库体积并加字节级门禁 (956a075e99)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (2d5cff3c98)
- 🔧 Chore/Other:壳声明件跟随新落承载页(258 条说明符) (814f08dde7)
- 🔧 Chore/Other:自动落 2 枚小程序壳承载页(共 4 枚待产) (15ff9a606d)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (4ebde26fef)
- 📚 Docs:deploy-feedback 自动登记(deploy_outcome;端到端反馈闭环第二切片,O65 自进化系列) (a1678371fb)

**2026-11-12**
- 📚 Docs:auto档同步四语 README（changelog/日期/F票记录，非逻辑代码） (a61cec7719)
- 🔧 Chore/Other:新增 §12d 停用防回归守门 check-worktree-dev-banned(316,blocking) (2f6997bf5f)
- 🔧 Chore/Other:结清 CLI F-002/003/006/007/008 与 API F-700/704 七条缺陷票（修复与回归已入库 b46128f309c） (559599bb3f)
- 🐞 Fix:结清 F-002/003/006/007/008/700/704——退出码、进程树回收、审计与 argv 脱敏、钱包与看板 int8 溢出 (b46128f309)
- 🔧 Chore/Other:结清 F-628/629/701/702/718 五条缺陷票（修复与回归已入库 5219f2440db） (f38f2aa4f1)
- 🐞 Fix:结清 F-628/629/718/701/702——中转成本改读真实列、退款回收赠送 token、余额不足扣成欠费并准入拦截、两处 SUM int8 溢出 (5219f2440d)
- 🐞 Fix:托盘拉起切号器用 cmd /d 关掉 AutoRun (245b9930be)
- 🐞 Fix:补 createBlacklist mock 修 blacklist fail-closed 回归 (e44bf1fc00)
- 🔧 Chore/Other:结清 F-40/76/77/87/91 五条缺陷票（修复与回归已入库 221e0cdaadf） (fdf49b2a2b)
- 🐞 Fix:结清 F-87/91/76/77/40 五条缺陷票——媒体代理计费、通知失败重试、PDF 合并上限、部门用户凭据投影、后台 Agent 有界回收 (221e0cdaad)
- 🐞 Fix:离线兜底页补齐状态告知并纠正薄壳降级描述 (be7035bb2b)
- 🐞 Fix:relay 临时目录清理失败不得吞掉业务结果 (2249dc260b)
- 📚 Docs:补开发版配置路径(两套 identifier 各写各的) (f139ac8ad6)
- 🔧 Chore/Other:prettier 格式化 README 的托盘示例数组 (10a2c27874)
- 📚 Docs:托盘 relay_switch 示例改放 quit 之前并说明分组理由 (21397faa33)
- 🐞 Fix:长上下文针测不再把推理模型截断误判为不支持 (bea1251881)
- 🐞 Fix:relay 的 JSON 捕获改临时文件 + 括号配平切载荷,修两处真实缺陷 (a446503454)
- 🔧 Chore/Other:结清 F-07/21/37/48/49 五条缺陷票（修复与回归已入库 abe1fa32fb4） (d1b0d99088)
- 🐞 Fix:结清 F-07/21/37/48/49 五条缺陷票——后台 Agent 归属、业务日键、积分发放补偿、图片任务原子认领、MCP 网关统一 deadline (abe1fa32fb)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (fac7b192d5)
- 🐞 Fix:拆定时炸弹——计划任务不再绑带版本号的 node 路径,自检扩到六项 (633222ecb9)
- 🔧 Chore/Other:结清 F-22/35/42/46/52 五条缺陷票（修复与回归已入库 96512fab9e6） (f4904682db)
- 🔧 Chore/Other:footer 回归用例改挂 public project,脱离登录口令依赖 (fb75f9c2a3)
- 🐞 Fix:relay 网关探测保留完整模型 id，修复 workbuddy 全家能力结论被 403 污染 (5c8c357b6a)
- 🚀 Feature/Improvement:托盘新增操作员专属「AI 客户端一键切号」入口(默认隐藏) (96512fab9e)
- 🐞 Fix:F-22 营收聚合改 bigint 且查询失败不再吞零, F-35 预扣结算失败重试并留对账标记, F-42 产物列表去同步IO, F-46 降级计数器可回收, F-52 终端历史 ZSET 分页 (5858f6aa8f)
- 🔧 Chore/Other:--status 日志行补注『空转轮不写日志』避免误判停滞 (a042e6c583)
- 🐞 Fix:首页移除微信小程序按钮并恢复 Gitee 仓库入口,修正 footer 三栏断点 (adb2d40849)
- 🐞 Fix:回收遗留在生产 checkout 的 A9 具名豁免(~initRoundShardResume) (e942aca9a1)
- 🔧 Chore/Other:结清 F-66/68/70/72/73 五条缺陷票（修复与回归已入库 629d7fca176） (754e9c1967)
- 🐞 Fix:F-66 批量取消条件更新入事务, F-70 OSS STS 策略收敛本人前缀与大小上限, F-72 webhook 触发防重放, F-73 出站 webhook 补 HMAC 签名, F-68 礼物账本回归 (629d7fca17)
- 🚀 Feature/Improvement:--status 一键健康自检 + 号池单测生产隔离修复与守门 (9ceeebf48a)
- 🐞 Fix:公开内容面(tools/news/articles/announcements)补免租户并钉回归锁 (90cc804c79)
- 🔧 Chore/Other:结清 F-36/38/47/50/71 五条缺陷票（修复与回归已入库 7b42edccc43） (0310fba8c1)
- 🚀 Feature/Improvement:选择器只显示前沿模型,同族保留最新两代 (4fefe37168)
- 🐞 Fix:F-36 邮件未发出即重试, F-47 备份 cron 落库前校验且失败保留旧调度, F-50 anthropic 端点补鉴权, F-71 回调日志收口管理员 (7b42edccc4)
- 🔧 Chore/Other:结清 F-58/59/60 三条缺陷票（修复与回归已入库 228f9f86db5） (148cefdd7f)
- 🐞 Fix:F-58 手机注册校验短信码, F-59 租户忽略客户端 plan 并保护 owner, F-60 上报忽略客户端 IP, F-57 授权码绑定 clientId, F-112 身份覆盖回归 (228f9f86db)
- 🐞 Fix:计划任务改 node.exe 直执行 + 脚本内置日志(实测 0xC000013A) (fac97bef4f)
- 🐞 Fix:补 /api/app-version/ 免租户并钉回归锁(治租户401潜伏雷) (c64375fa40)
- 🐞 Fix:落库载荷改回平台原生形状 + 拉回解析去 --json (9e9c213fd9)
- 🔧 Chore/Other:结清 F-86/88/107/108/110/111 六条缺陷票（修复与回归已入库 a83a802010e） (5fa69bc106)

**2026-11-11**
- 🐞 Fix:F-86 Realtime WS 复用共享鉴权与配额预检, F-88 batch 末次尝试才落终态, F-107/108 归属绑定, F-110/111 客服 WS 广播鉴权与槽位释放 (a83a802010)
- 🐞 Fix:同步改用平台原生导出形状 + core 四元组指纹 + raccoon 导出映射 (8f2e70765b)
- 🐞 Fix:工具探测强制 tool_choice=required、放宽到 45s、并发 8→4 (e84a2a3102)
- 🔧 Chore/Other:结清 F-61/62/63/103/104 五条缺陷票（HEAD 已修，本批复核既有回归 31 例全绿） (568a2043b4)
- 🚀 Feature/Improvement:号池跨环境双向自动同步(变更打点 + 收敛式对账 + 计划任务) (601488e231)
- 🔧 Chore/Other:结清 F-17/F-33 两条缺陷票（回归已入库 030cfde6994） (f132baea34)
- 🐞 Fix:F-55 补唯一 active 签名密钥吊销保护，F-17/33/54/56 补回归钉死 HEAD 既有修复 (030cfde699)
- 🚀 Feature/Improvement:悬浮球 hover 辉光 + 最小化图标固定默认落点 (16661511ca)
- 🔧 Chore/Other:结清 F-05/08/27/32/53 五条缺陷票（回归已入库 9a14f1d9ded） (5fbf1447e3)
- 🔧 Chore/Other:F-05/27/32 补回归钉死 HEAD 既有修复，F-53/F-08 补 fail-closed 细节，修 F-09 遗留 payment 测试桩 (9a14f1d9de)
- 🚀 Feature/Improvement:本地⇄生产号池自动同步互通(默认推生产 + --sync-pull 拉回) (bf820ca1ae)
- 🚀 Feature/Improvement:新增 ihui relay 命令组,把号池切号封装成可调用命令面 (bc4ce32477)
- 🔧 Chore/Other:结清 F-09/10/11/14/16 五条缺陷票(修复与用例已入库 920fbfc47f4) (d114992763)
- 🐞 Fix:HR-3 微信订阅消息字段 key 对齐真实模板(实测收尾) (bd1bd6091f)
- 🐞 Fix:F-09/11/14/16 修复（退款调渠道前抢占防双退/积分账本改会员级 advisory lock/扣费先占位幂等键再扣减/提现回调 rawBody fail-closed），F-10 复核已在 HEAD 修复并补用例 (920fbfc47f)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (8f5675e664)
- 🐞 Fix:工具探测预算 64→256,截断/限流记未知而非"不支持" (24c2ee20c7)
- 🐞 Fix:修两族报警真因——app-version端点补免租户 + A9轮起点腿登记豁免 (0417dc0dc2)
- 🐞 Fix:一键切号桌面快捷方式安装器覆盖新入口 (c916ffda00)
- 🐞 Fix:首页移除未合并的 awesome PR 拉票链接 (cbaa3e498c)
- 🔧 Chore/Other:结清 SDB-27/48/56 与 F-01/F-13 五条缺陷票(修复与用例已入库 e618edbfa81) (636a673c4e)
- 🐞 Fix:SDB-48/56 与 F-13 修复（Key 用量按 apiKeyId 归因/直聊补写用户轮/配额窗口重置进 WHERE），SDB-27 与 F-01 复核已在 HEAD 修复并补用例 (e618edbfa8)
- 🔧 Chore/Other:结清 SDB-36/38/39/49/54 五条缺陷票(修复与用例已入库 e63cafc9824) (a8dfdbfe37)
- 🐞 Fix:修复 SDB-36/38/39/49/54 五条缺陷（金丝雀阶段迁移 CAS/停用节点不再入结果/符号检索缺归属即拒/摘要列单写者防覆盖/导入周期判据复用调度器解析） (e63cafc982)
- 🚀 Feature/Improvement:首页 Star 按钮展示 GitHub 实时星标数 (9e6989d206)
- 📚 Docs:HR-1~HR-4 四行翻勾(人事部功能系列已交付并验证) (155a67f9f1)
- 🚀 Feature/Improvement:人事部功能系列 HR-1~HR-4 全量落地(代码层 + README 生成块) (a8cf8d4f4d)
- ⚡ Perf:仿真/真机池改有界并发，绑定口径对齐手机端免扫码 (a8a24b7aa6)
- 🚀 Feature/Improvement:探测升级为流式/工具/长上下文三项实测,选择器按行展示 (82fd86a2b3)
- 📚 Docs:deploy-feedback 自动登记(deploy_outcome;端到端反馈闭环第二切片,O65 自进化系列) (fe6283ecbe)
- 🔧 Chore/Other:结清 SDB-08/28/32/37/40 五条缺陷票(修复与用例已入库 54152ef) (2c729e29a1)
- 🐞 Fix:SDB-08/28/32/37/40 usage 兜底计 input/ERC20 复核倒序翻页/换票账号锁+CAS/DAG 取消传播/沙箱路径闸补全 (54152efcd5)
- 🐞 Fix:下调全局 accent,收口弹层菜单 hover 对比度 (67c74511fc)
- 🐞 Fix:relay 白名单按带前缀模型名登记,探测 403 时回退完整 id 复测 (0e673f6b5f)
- 🐞 Fix:站内消息已读状态落库,刷新后红点不再复活 (2d3cc78874)
- 🚀 Feature/Improvement:公众号合法微信绑定链脚手架(纯接口参数,真人授权收口) (dcf06a1333)
- 🐞 Fix:报警刷屏降噪——补7条族级24h窗口 + budget按日节流 (2e7658179a)
- 🔧 Chore/Other:精修站内消息二级菜单行距与底部入口 (cbc193027f)
- 🚀 Feature/Improvement:站内消息改悬停二级菜单并统一飞书式通知列表 (f25bcd435c)
- 🔧 Chore/Other:结清 SDB-05/17/35/41/42 五条缺陷票(修复与用例已入库 3948c58) (1b45537f33)
- 🐞 Fix:SDB-05/17/35/41/42 订阅无限配额流水/推荐重放/回滚未知态/spec 提交路径/cc-switch 导入校验 (3948c58b1f)
- 🐞 Fix:ModelOption 补齐 verified/healthError 字段,修复生产构建类型检查失败 (2573157b59)
- 🔧 Chore/Other:结清 SDB-03/06/07/09/30 五条缺陷票(修复与用例已入库) (949616c8ed)
- 🐞 Fix:修复 SDB-03/06/07/09/30 五条缺陷(0 天永不过期/限流原子化/刷新 TTL 未知/registry 字段净化/Crew 按 run 计费) (11ac3be553)
- 📚 Docs:固化纯接口参数翻判据的全量证伪证据 (d967a7cc6f)
- 🚀 Feature/Improvement:公众号任务真机实跑 LIVE 模式(达标即真实领奖) (5c29f08f8b)
- 🔧 Chore/Other:结清 SDB-01/04/26/29/31 五条缺陷票(修复与用例已入库 5280eac) (7d7c92075f)
- 🐞 Fix:区分已验证/未验证模型并修复平台中转模型 401 (2f7882cd32)
- 📚 Docs:deploy-feedback 自动登记(deploy_outcome;端到端反馈闭环第二切片,O65 自进化系列) (850f5805b0)
- 📚 Docs:deploy-feedback 自动登记(deploy_outcome;端到端反馈闭环第二切片,O65 自进化系列) (3a4f28a574)
- 🐞 Fix:修复 SDB-01/04/26/29/31 五条缺陷(设备令牌归属闸/不限窗口配额/PR 文件翻页/注销吊销凭据/团队记忆写权限) (5280eaca65)
- 📚 Docs:deploy-feedback 自动登记(deploy_outcome;端到端反馈闭环第二切片,O65 自进化系列) (8f5766750b)
- 🔧 Chore/Other:结清 SDB-10/11/12/33/44 五条缺陷票(修复与用例已入库 cbec88d) (7ba58a64de)
- 🚀 Feature/Improvement:公众号任务绑定生效闭环离线仿真(四阶段状态机) (f74e9163db)
- 🐞 Fix:修复 SDB-10/11/12/33/44 五条缺陷(历史配对顺序/事实归属守卫/PayPal custom_id/支付宝时间戳验收/过期先查链) (8547265806)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (6cbcf13264)
- 🔧 Chore/Other:结清 SDB-13/14/15/16/18 五条缺陷票(修复与用例已入库 f54f9bc) (94446abc23)
- 🐞 Fix:修复 SDB-13/14/15/16/18 五条缺陷(桥接流错误固化/接码响应校验/导入规则收紧/总线业务码/残缺备份闸门) (f54f9bcb0f)
- 🚀 Feature/Improvement:取证公众号订阅参数接口并接入引擎 (6c85d2c7d5)
- 🔧 Chore/Other:结清 SDB-19/20/21/34/43 五条缺陷票(修复与用例已入库 e5984c2) (94e5c1ee9f)
- 🐞 Fix:修复 SDB-19/20/21/34/43 五条缺陷(集成调用同源校验/stop 收尾超时/CTR 口径/偏好判真单点/检查失败升级上报) (e5984c2794)
- 🐞 Fix:补 health-gate-evidence 测试第4组逐维断言 + 521 误回滚收口票 (fc2c4f0180)
- 🔧 Chore/Other:结清 SDB-25/47/50/51/52 五条缺陷票(修复与用例已入库 06d0ece) (d065806d91)
- 🐞 Fix:修复 SDB-25/47/50/51/52 五条缺陷(回调双闸归一/推送桩 fail-closed/索引建目录/终端白名单 token 匹配/备案号批内去重) (06d0ecedd2)
- 🔧 Chore/Other:结清 SDB-22/23/24/53/55 五条缺陷票(修复与用例已入库 90ff53e) (00b2963c1b)
- 🐞 Fix:修复 SDB-22/23/24/53/55 五条缺陷(时间比较/导出截断标记/角色回落/告警窗口口径/Telegram 转义) (94abc74460)
- 🐞 Fix:刷新 README 生成块文件计数对齐合并后现算值 (7168cbe51f)
- 🔧 Chore/Other:撤销侧车归属 1042 条,开放任务全部回待接单面 (4dc85b0527)
- 🚀 Feature/Improvement:删除邀请功能 + 打通小浣熊每日签到长期自动化 (33333da419)
- 🔧 Chore/Other:活文档对齐远端 HM-1 归属牌声明位最新面 (d4b7861b3d)
- 🚀 Feature/Improvement:取证 travel/depart location_id 并补齐订阅任务自动领奖时序 (41c03f66af)
- 🔧 Chore/Other:活文档对齐远端 HM-1 第 0 步最新登记面,消除收敛落地闸的滞后副本 (be6bd133b6)
- 📚 Docs:HM-1 归属牌移到编号声明位(散文归属尺只认声明位) (024bc3bcad)
- 📚 Docs:HM-1 第 0 步入库留痕并改归机主真机验证面 (ea9e0112c3)
- ♻️ Refactor:elevation 档位补齐 Android elevation 并收口 CSS 别名第二源 (2a13b51128)
- 🐞 Fix:修 5 条既有红并收窄弹层高度扫描面 (cebb73dafb)
- ♻️ Refactor:浮层投影统一走 design-tokens ELEVATION_STEPS 档位 (adbe310621)
- ♻️ Refactor:收拢剩余 24 处 expo 调用,并把 picker 门面按包拆开 (511adddfe5)
- 🚀 Feature/Improvement:接通 skill_share 分享链并纳入全量自动驾驶巡检 (838bf0c1ea)
- 🐞 Fix:健康门禁 originOk 改为逐维救援,修复切流窗口 521 误回滚 (42d29418d3)
- 🚀 Feature/Improvement:建立平台适配层门面,收拢 7 个 expo 域(鸿蒙 A2 第 0 步) (19c81cf5eb)
- 🔧 Chore/Other:活文档对齐远端 Y-70/Y-3 最新裁决面,消除收敛落地闸的滞后副本 (b7567d8143)
- 🔧 Chore/Other:补浮窗档分屏禁用回归断言(防 360px 内再分栏溢出) (9b431d1b83)
- 📚 Docs:登记 HM-1 鸿蒙适配 A2 路线第0步(平台适配层) (435f437df6)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (879a4f2c0f)
- 🐞 Fix:将 APP REST 基址 www.aizhs.top 切到稳定的 api.aizhs.top(双保险其一) (2f0280ffde)
- 📚 Docs:补记 Y-70/Y-3 agent 侧子项已清零(仅剩机主凭据/备案/鸿蒙产物) (109c86e869)
- 🚀 Feature/Improvement:客户端会话镜像——根治双消费者轮换竞态(minimax grant 吊销实证) (de22e7492f)
- 🐞 Fix:切号三连修——G盘exe定位/explorer主通道/最小档兜底写回 (ba6fbdb528)
- 🔧 Chore/Other:活文档对齐远端归档移出后的最新面,消除收敛落地闸的滞后基线副本 (7729e5afef)
- 🔧 Chore/Other:重封清单对齐 4f4e686ec39aab301cfe2f755ad65f664eed1e54 规则面(guardian-runner 等门改动同枚落库以放行部署环 fail-closed) (6b50bea596)
- 🔧 Chore/Other:结清 RP-64 判据面追认积压(IG 门红0/门29已同步) (dceaebc5bd)
- 🔧 Chore/Other:追认孤儿目录壳清扫腿枚 2e16a53572 的 AGENTS.md 判据面命中 (96be0510e3)
- 🐞 Fix:修复 RN 邮箱验证码「点了没反应/无倒计时/收不到」三处根因 (889a6e6984)
- 📚 Docs:trackedFiles 计数刷新至 20846 (ad2c88fe37)
- 🐞 Fix:生产 app_versions.latest 的过期 OSS 签名直链做幂等收口 (4b46984084)
- 🐞 Fix:孤儿目录壳清扫腿收口 10 项代码审查(B1/B2/I1-I4/M1-M4)+镜像测试与 AGENTS 留痕,并重封根护栏清单清偿 HEAD 存量 fail-closed (2e16a53572)
- 🐞 Fix:预修还原被 52991b53 旧底稿同步误删的模型健康接线面(为收敛裁决 import 预立两侧动过形态) (27e5263140)
- 🐞 Fix:根治 APK 更新卡死(版本双写 fail-closed + installing 出口 + 服务端假阳性) (6e7f54552c)
- 🐞 Fix:旧底稿整份回退哨兵(提交面报警 + 推送前硬拦) (0de2c0c35a)
- 🔧 Chore/Other:追认i18n跨端门自检1枚 (43a6d76b7e)
- 🐞 Fix:i18n 跨端门自检登记器改为当场求值，5 条用例不再空跑 (03ddbc8fb7)
- 🔧 Chore/Other:README 数字块按索引面重算（门数 359/330、测试文件与跟踪文件同批） (cd25562745)
- 🚀 Feature/Improvement:新增 raccoon-crypto/invite 及测试 (0ae1139db2)
- 🔧 Chore/Other:同步开发改动（合并 origin/main 后落提交本地工作面） (52991b5365)
- 🔧 Chore/Other:合并面文档与生成物按对侧刷新（本侧零意图改动） (9d4ac189fb)
- 🔧 Chore/Other:撤回 ApiKeysScreen 三处档值微调，改由 302p 基线登记 (81b541ee47)
- 🐞 Fix:收敛器补转 --fold-keep 与 --declare-side-loss 两条声明出口 (99d0a54bfd)
- 🔧 Chore/Other:ui-routes 派生面按现 HEAD 面重生成落写回档(复量同面) (c32db7cb6c)
- 🐞 Fix:302p 基线复位 139 + ApiKeysScreen 非档值落档 (be504e408d)
- 🐞 Fix:守门 314→315 撞号让位与按钮描边门 RN 族存量纳管 (7a8a30ae04)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (8bb8cd956b)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (3fc9d80fe2)
- 🐞 Fix:门8 method 推断⑤段加块尾守卫——已闭合函数不再向匿名回调裸fetch借POST(修 edu-attendance e2e 假阳性;T5/T6 夹具钉住) (df51ce0ce5)
- 🔧 Chore/Other:追认人工归并枚 63d4ff3b92 的判据面命中(5 面) (8a7c580112)
- 🐞 Fix:恢复 425ae8286f 误删的 renderStablePin —— 陈旧副本收编把 scripts/lib/generated-input-pin.mjs 翻回 4ab41d4292 之前形态,抹掉稳定钉函数(33行),而调用方四端 generate-ui-routes 与镜像测试 generated-input-pin-stable.test.mjs 仍 import ⇒ 生成器全断(pre-commit --heal-ui-routes 即红)。逐字节回植 4ab41d4292 原版;镜像测试 6/6 绿,miniapp-taro/extension 生成器实测 exit 0。 (03abecfa6e)
- 🐞 Fix:菜单分割线全仓清零 26 处 + 族7豁免收窄为交互式手柄(根治 §66 后门) (917b33ec56)
- 🐞 Fix:WorkBuddy AI 版进程探测与域校验双臂修复 (84636f3175)
- 🔧 Chore/Other:漂移门基线全维刷新至尖 8ddc8d2256 —— 唯一恶化维 tierRnMissingN 134→142 逐处 file:line 证据:packages/app/src/features/api-keys/ApiKeysScreen.tsx:491/:573 paddingHorizontal:5、:492/:554/:574 paddingVertical:1(← 对侧 10f86bc743 共享屏下沉五处)+ packages/app/src/features/patrol/PatrolScreen.tsx:898 paddingVertical:1、:912/:921 gap:3(← 对侧 cd9a85fea2 patrol 屏三处);好转五维 fidelityHosted 239/fidelityPackAbsent 0/fidelityRetractionRot 0/mpTierLiteral 597/duplicateWebKeys 0 按终尖现读重置;evidence 锚点按尖行号重指 (a4d95d3a2c)
- 🔧 Chore/Other:settle B40 + docs-207 rows (both fix seats landed and independently verified) (52ccc1e94e)
- 🐞 Fix:docs-207 第二刀——摘除 207 条目被 9c7d050b58 回灌的 skipEnv 逃生舱(装车形态锁转绿,注册/消费面零命中) (4a17c3c321)
- 🐞 Fix:B40 compose 镜像 tag 缺省即失败(:?)+守门判据 + cli 测试补断言(typecheck:tests 214→0 余档,席已并入的测试修复另枚在账) (1022021cbe)
- 📚 Docs:合并面生成块数字按 HEAD 现读刷新 —— 仓库瘦身 181 件删除+对侧 4 批增量入库后 trackedFiles/字节数重量(173 号门 sync-readme-numbers 官方通道;LAND_ALLOW_STALE 显式声明:20836 是合并面实测非陈旧复活) (3742d33d25)
- 🐞 Fix:message-input 浮窗档强制显示工具栏文字 (forceToolbarText) (d1722cc7cc)
- 🔧 Chore/Other:settle RP-44/RP-45 (fix seats landed; cmd atomicity + api timezone single-source, tests green) (2c0497f4ce)
- 📚 Docs:re-register RP rows from recheck seat A (lost in stale-baseline revert 16787b7af5) (e166ad2269)
- 🔧 Chore/Other:re-settle 113 closed rows (revert 16787b7af5 restored stale ledger; re-applied per recheck seats A/B/C evidence) (13e55a10e3)
- 📚 Docs:README 与 GATEKEEPERS 更新 (67406951df)
- 🔧 Chore/Other:新增 updater 边界测试 (5e7b0d5785)
- 🔧 Chore/Other:新增 tui-fullscreen-keys/terminal 边界测试 (0c73922a67)
- 🐞 Fix:按钮边框色检查更新 (cb2c7b7cd8)
- 🚀 Feature/Improvement:workbench session rail 组件 (8021c1ba2e)
- 🔧 Chore/Other:新增 agent-extended/subagent-*/tool-*/trash-* 边界测试 (b8f0bbeec6)
- 🔧 Chore/Other:新增 sandbox/subagent-extended 测试 + scripts 按钮边框色检查更新 (9d00adf3c4)
- 🔧 Chore/Other:新增 permission-lease/plugin-cache-recovery/product-form 边界测试 (d3ae858f3b)
- 🔧 Chore/Other:pkg-ai 聊天样式 (5c8ebf534e)
- 🔧 Chore/Other:新增 nested-additional-properties/p1-evidence-gaps 边界测试 (10ab3224ab)
- 📚 Docs:AGENTS/PROJECT_PLAN 更新 (16787b7af5)
- 📚 Docs:守门人文档更新 (de4a868ae1)
- 🚀 Feature/Improvement:按钮边框色守门基线检查与 guardian-runner 更新 (a31648c4f1)
- 🚀 Feature/Improvement:patrol 屏组件 (756adf2fc4)
- 🚀 Feature/Improvement:关于联系页与 rn-compat 路由/壳生成物同步 (0d7fd2cf33)
- 🔧 Chore/Other:新增 hooks-trust-gate/lsp/machine-credentials/mcp-* 等边界测试 (edc4c860e8)
- 🚀 Feature/Improvement:多 admin/agent/edu/enterprise 页面与 AI/chat/云运行/客服组件更新 (8d0f79b817)
- 🔧 Chore/Other:补全 ACL/ACP/agent/权限/插件/后台/checkpoint/compaction/SSRF/hook 边界测试与 client-claims (ee6b7b1966)
- 🚀 Feature/Improvement:payment-recurring 上海时区下次扣费 + subscription/api-key-quota 日重置/biz-day/agent-extended 路由 (948597a9a7)
- 🚀 Feature/Improvement:relay-account 转发与号池模型健康监测(含上海时区修复与模型过滤) (9db6361988)
- 🐞 Fix:install-auto-deploy-task.cmd 去 /create /f 先拆后建,改 /query→/change 就地更新→缺才 create(RP-22, DBG-84 同族残余;镜像测试钉三判据) (02c145cf9e)
- 🐞 Fix:移除对已删除 coze-chat-queries 模块的悬空 vi.mock 引用 (c13291363f)
- 🔧 Chore/Other:持久声明补 README×4 与 miniapp i18n 生成件取对侧 (9e4f83dd6f)
- 🔧 Chore/Other:settle 16 rows from recheck seats B+C (infra 8 + business 8, evidence per-seat) (3f8cbf7bd1)
- 📚 Docs:register 2 RP rows from recheck seat A (DBG-84 cmd /f residue + DBG-7 local-calendar scatter x3) (300c53d6e9)
- 🔧 Chore/Other:settle 9 remaining DBG bug-hunt rows (recheck seat A: all CLOSED, fixed-without-marker, evidence per-file) (8bae5a7499)
- 🔧 Chore/Other:settle 88 DBG bug-hunt closed rows (code-face DBG markers + mirror tests verified; 完成即删) (3b509ce0bb)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (5201a66c50)
- 🐞 Fix:re-land intentional-delete coze-chat-queries.ts (2026-11-09 allowlist, dead query layer behind 404-ed endpoints; guardian heal resurrected it twice) + sync README trackedFiles blocks 20829->20828 (DN5) (e9bf534933)
- 🐞 Fix:scratch 墓碑回收腿 —— rmScratch 改名墓碑(.stale-<ts>)按名字死亡戳判龄(60 分钟下限,env 只加严不穿),不再被子树 mtime 6h 闸整轮错过;镜像 T32-T37 + 红证(旧码 2h 墓碑 0 候选) (d760f047a5)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (19b286097f)
- 🐞 Fix:containment 门撞号 175→314 + README 数字刷新与点名 (3b44a123ed)
- 🔧 Chore/Other:提交根目录文档 深度清理Git仓库垃圾文件.md (2a4dccdfc7)
- 🔧 Chore/Other:提交 scripts 的未提交改动 (90 文件) (425ae8286f)
- 🔧 Chore/Other:提交 root 的未提交改动 (9 文件) (2f66efbca8)
- 🔧 Chore/Other:提交 packages 的未提交改动 (50 文件) (b43093af88)
- 🔧 Chore/Other:提交 docs 的未提交改动 (4 文件) (2e0820129b)
- 🔧 Chore/Other:提交 deploy 的未提交改动 (8 文件) (5d8aff3ceb)
- 🔧 Chore/Other:提交 benchmarks 的未提交改动 (37 文件) (cb0aa51554)
- 🔧 Chore/Other:提交 apps/web 的未提交改动 (52 文件) (7b98c933c9)
- 🔧 Chore/Other:提交 apps/mobile-rn 的未提交改动 (51 文件) (058bb378c2)
- 🔧 Chore/Other:提交 apps/miniapp-taro 的未提交改动 (39 文件) (20933a9e52)
- 🔧 Chore/Other:提交 apps/extension 的未提交改动 (23 文件) (7b0fa29d98)
- 🔧 Chore/Other:提交 apps/desktop 的未提交改动 (2 文件) (e463066e2a)
- 🔧 Chore/Other:提交 apps/cli 的未提交改动 (20 文件) (a7271dbc0f)
- 🐞 Fix:R4 模板去路径字面量 + README 数字刷新与点名索引恢复 (5553d3bee8)
- 🔧 Chore/Other:提交 apps/api 的未提交改动 (70 文件) (174ebfed98)
- 🔧 Chore/Other:提交 apps/ai-service 的未提交改动 (171 文件) (87e5810c29)
- 🐞 Fix:根治 partial-clone 懒取回把判据/对齐拖死(2026-11-11) (01dfefb764)
- 🐞 Fix:robocopy maxBuffer 扩容根治回收删除腿 ENOBUFS 假失败 (919b3e600c)
- 🔧 Chore/Other:守门:README RECENT 块外禁增(5833953de0 复发防线) (d96cce0629)
- 🔧 Chore/Other:侧边栏三处字号 text-sm 收敛到 text-body 令牌 (b7dab01acd)
- 🔧 Chore/Other:📚 文档:裁掉 README 锚点外 37179 行历史散落(STRAY_OUTSIDE=4419 枚,写入器已归并最新条目进块) (eb182b6d0f)
- 🐞 Fix:回收器双出口 tag-then-remove + 空闲信号根治巡检污染 (637f750493)
- 🔧 Chore/Other:📚 文档:裁掉 README 锚点外 37179 行历史散落(STRAY_OUTSIDE=4419 枚,写入器已归并最新条目进块) (5833953de0)
- 🔧 Chore/Other:工作树回收射程扩至同盘兄弟检出并收紧空闲阈值到 1 天 (5721eab5cb)
- 🔧 Chore/Other:废弃 doubao-carry 对外方案并重构 relay 长连接与承载页; RepoWiki/Patrol 改用 design-tokens; 同步 cross-end 派生产物 (7740a55348)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (a51ee3250a)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (51af690876)
- 🔧 Chore/Other:壳声明件跟随新落承载页(260 条说明符) (b343fb9047)
- 🔧 Chore/Other:自动落 2 枚小程序壳承载页(共 2 枚待产) (b52af9a4d1)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (b5f52cd1d7)
- 🔧 Chore/Other:移除 miniapp-taro 下误提交的 mobile-rn 资产副本(13MB,无任何引用) (c33dd54e9b)
- 🔧 Chore/Other:清偿仓库体积并加字节级门禁 (956a075e99)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (2d5cff3c98)
- 🔧 Chore/Other:壳声明件跟随新落承载页(258 条说明符) (814f08dde7)
- 🔧 Chore/Other:自动落 2 枚小程序壳承载页(共 4 枚待产) (15ff9a606d)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (4ebde26fef)
- 📚 Docs:deploy-feedback 自动登记(deploy_outcome;端到端反馈闭环第二切片,O65 自进化系列) (a1678371fb)

**2026-11-12**
- 🔧 Chore/Other:新增 §12d 停用防回归守门 check-worktree-dev-banned(316,blocking) (2f6997bf5f)
- 🔧 Chore/Other:结清 CLI F-002/003/006/007/008 与 API F-700/704 七条缺陷票（修复与回归已入库 b46128f309c） (559599bb3f)
- 🐞 Fix:结清 F-002/003/006/007/008/700/704——退出码、进程树回收、审计与 argv 脱敏、钱包与看板 int8 溢出 (b46128f309)
- 🔧 Chore/Other:结清 F-628/629/701/702/718 五条缺陷票（修复与回归已入库 5219f2440db） (f38f2aa4f1)
- 🐞 Fix:结清 F-628/629/718/701/702——中转成本改读真实列、退款回收赠送 token、余额不足扣成欠费并准入拦截、两处 SUM int8 溢出 (5219f2440d)
- 🐞 Fix:托盘拉起切号器用 cmd /d 关掉 AutoRun (245b9930be)
- 🔧 Chore/Other:结清 F-40/76/77/87/91 五条缺陷票（修复与回归已入库 221e0cdaadf） (fdf49b2a2b)
- 🐞 Fix:结清 F-87/91/76/77/40 五条缺陷票——媒体代理计费、通知失败重试、PDF 合并上限、部门用户凭据投影、后台 Agent 有界回收 (221e0cdaad)
- 🐞 Fix:离线兜底页补齐状态告知并纠正薄壳降级描述 (be7035bb2b)

**2026-11-11**
- 🐞 Fix:HR-3 微信订阅消息字段 key 对齐真实模板(实测收尾) (0fe40d5929)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (8f5675e664)
- 🐞 Fix:修两族报警真因——app-version端点补免租户 + A9轮起点腿登记豁免 (0417dc0dc2)

**2026-11-11**
- 📚 Docs:HR-1~HR-4 四行翻勾(人事部功能系列已交付并验证) (155a67f9f1)
- 🚀 Feature/Improvement:人事部功能系列 HR-1~HR-4 全量落地(代码层 + README 生成块) (a8cf8d4f4d)
- 📚 Docs:deploy-feedback 自动登记(deploy_outcome;端到端反馈闭环第二切片,O65 自进化系列) (fe6283ecbe)
- 🔧 Chore/Other:结清 SDB-08/28/32/37/40 五条缺陷票(修复与用例已入库 54152ef) (2c729e29a1)
- 🐞 Fix:SDB-08/28/32/37/40 usage 兜底计 input/ERC20 复核倒序翻页/换票账号锁+CAS/DAG 取消传播/沙箱路径闸补全 (54152efcd5)
- 🐞 Fix:下调全局 accent,收口弹层菜单 hover 对比度 (67c74511fc)
- 🐞 Fix:relay 白名单按带前缀模型名登记,探测 403 时回退完整 id 复测 (0e673f6b5f)
- 🐞 Fix:站内消息已读状态落库,刷新后红点不再复活 (2d3cc78874)
- 🚀 Feature/Improvement:公众号合法微信绑定链脚手架(纯接口参数,真人授权收口) (dcf06a1333)
- 🐞 Fix:报警刷屏降噪——补7条族级24h窗口 + budget按日节流 (2e7658179a)
- 🔧 Chore/Other:精修站内消息二级菜单行距与底部入口 (cbc193027f)
- 🚀 Feature/Improvement:站内消息改悬停二级菜单并统一飞书式通知列表 (f25bcd435c)
- 🔧 Chore/Other:结清 SDB-05/17/35/41/42 五条缺陷票(修复与用例已入库 3948c58) (1b45537f33)
- 🐞 Fix:SDB-05/17/35/41/42 订阅无限配额流水/推荐重放/回滚未知态/spec 提交路径/cc-switch 导入校验 (3948c58b1f)
- 🐞 Fix:ModelOption 补齐 verified/healthError 字段,修复生产构建类型检查失败 (2573157b59)
- 🔧 Chore/Other:结清 SDB-03/06/07/09/30 五条缺陷票(修复与用例已入库) (949616c8ed)
- 🐞 Fix:修复 SDB-03/06/07/09/30 五条缺陷(0 天永不过期/限流原子化/刷新 TTL 未知/registry 字段净化/Crew 按 run 计费) (11ac3be553)
- 📚 Docs:固化纯接口参数翻判据的全量证伪证据 (d967a7cc6f)
- 🚀 Feature/Improvement:公众号任务真机实跑 LIVE 模式(达标即真实领奖) (5c29f08f8b)
- 🔧 Chore/Other:结清 SDB-01/04/26/29/31 五条缺陷票(修复与用例已入库 5280eac) (7d7c92075f)
- 🐞 Fix:区分已验证/未验证模型并修复平台中转模型 401 (2f7882cd32)
- 📚 Docs:deploy-feedback 自动登记(deploy_outcome;端到端反馈闭环第二切片,O65 自进化系列) (850f5805b0)
- 📚 Docs:deploy-feedback 自动登记(deploy_outcome;端到端反馈闭环第二切片,O65 自进化系列) (3a4f28a574)
- 🐞 Fix:修复 SDB-01/04/26/29/31 五条缺陷(设备令牌归属闸/不限窗口配额/PR 文件翻页/注销吊销凭据/团队记忆写权限) (5280eaca65)
- 📚 Docs:deploy-feedback 自动登记(deploy_outcome;端到端反馈闭环第二切片,O65 自进化系列) (8f5766750b)
- 🔧 Chore/Other:结清 SDB-10/11/12/33/44 五条缺陷票(修复与用例已入库 cbec88d) (7ba58a64de)
- 🚀 Feature/Improvement:公众号任务绑定生效闭环离线仿真(四阶段状态机) (f74e9163db)
- 🐞 Fix:修复 SDB-10/11/12/33/44 五条缺陷(历史配对顺序/事实归属守卫/PayPal custom_id/支付宝时间戳验收/过期先查链) (8547265806)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (6cbcf13264)
- 🔧 Chore/Other:结清 SDB-13/14/15/16/18 五条缺陷票(修复与用例已入库 f54f9bc) (94446abc23)
- 🐞 Fix:修复 SDB-13/14/15/16/18 五条缺陷(桥接流错误固化/接码响应校验/导入规则收紧/总线业务码/残缺备份闸门) (f54f9bcb0f)
- 🚀 Feature/Improvement:取证公众号订阅参数接口并接入引擎 (6c85d2c7d5)
- 🔧 Chore/Other:结清 SDB-19/20/21/34/43 五条缺陷票(修复与用例已入库 e5984c2) (94e5c1ee9f)
- 🐞 Fix:修复 SDB-19/20/21/34/43 五条缺陷(集成调用同源校验/stop 收尾超时/CTR 口径/偏好判真单点/检查失败升级上报) (e5984c2794)
- 🐞 Fix:补 health-gate-evidence 测试第4组逐维断言 + 521 误回滚收口票 (fc2c4f0180)
- 🔧 Chore/Other:结清 SDB-25/47/50/51/52 五条缺陷票(修复与用例已入库 06d0ece) (d065806d91)
- 🐞 Fix:修复 SDB-25/47/50/51/52 五条缺陷(回调双闸归一/推送桩 fail-closed/索引建目录/终端白名单 token 匹配/备案号批内去重) (06d0ecedd2)
- 🔧 Chore/Other:结清 SDB-22/23/24/53/55 五条缺陷票(修复与用例已入库 90ff53e) (00b2963c1b)
- 🐞 Fix:修复 SDB-22/23/24/53/55 五条缺陷(时间比较/导出截断标记/角色回落/告警窗口口径/Telegram 转义) (94abc74460)
- 🐞 Fix:刷新 README 生成块文件计数对齐合并后现算值 (7168cbe51f)
- 🔧 Chore/Other:撤销侧车归属 1042 条,开放任务全部回待接单面 (4dc85b0527)
- 🚀 Feature/Improvement:删除邀请功能 + 打通小浣熊每日签到长期自动化 (33333da419)
- 🔧 Chore/Other:活文档对齐远端 HM-1 归属牌声明位最新面 (d4b7861b3d)
- 🚀 Feature/Improvement:取证 travel/depart location_id 并补齐订阅任务自动领奖时序 (41c03f66af)
- 🔧 Chore/Other:活文档对齐远端 HM-1 第 0 步最新登记面,消除收敛落地闸的滞后副本 (be6bd133b6)
- 📚 Docs:HM-1 归属牌移到编号声明位(散文归属尺只认声明位) (024bc3bcad)
- 📚 Docs:HM-1 第 0 步入库留痕并改归机主真机验证面 (ea9e0112c3)
- ♻️ Refactor:elevation 档位补齐 Android elevation 并收口 CSS 别名第二源 (2a13b51128)
- 🐞 Fix:修 5 条既有红并收窄弹层高度扫描面 (cebb73dafb)
- ♻️ Refactor:浮层投影统一走 design-tokens ELEVATION_STEPS 档位 (adbe310621)
- ♻️ Refactor:收拢剩余 24 处 expo 调用,并把 picker 门面按包拆开 (511adddfe5)
- 🚀 Feature/Improvement:接通 skill_share 分享链并纳入全量自动驾驶巡检 (838bf0c1ea)
- 🐞 Fix:健康门禁 originOk 改为逐维救援,修复切流窗口 521 误回滚 (42d29418d3)
- 🚀 Feature/Improvement:建立平台适配层门面,收拢 7 个 expo 域(鸿蒙 A2 第 0 步) (19c81cf5eb)
- 🔧 Chore/Other:活文档对齐远端 Y-70/Y-3 最新裁决面,消除收敛落地闸的滞后副本 (b7567d8143)
- 🔧 Chore/Other:补浮窗档分屏禁用回归断言(防 360px 内再分栏溢出) (9b431d1b83)
- 📚 Docs:登记 HM-1 鸿蒙适配 A2 路线第0步(平台适配层) (435f437df6)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (879a4f2c0f)
- 🐞 Fix:将 APP REST 基址 www.aizhs.top 切到稳定的 api.aizhs.top(双保险其一) (2f0280ffde)
- 📚 Docs:补记 Y-70/Y-3 agent 侧子项已清零(仅剩机主凭据/备案/鸿蒙产物) (109c86e869)
- 🚀 Feature/Improvement:客户端会话镜像——根治双消费者轮换竞态(minimax grant 吊销实证) (de22e7492f)
- 🐞 Fix:切号三连修——G盘exe定位/explorer主通道/最小档兜底写回 (ba6fbdb528)
- 🔧 Chore/Other:活文档对齐远端归档移出后的最新面,消除收敛落地闸的滞后基线副本 (7729e5afef)
- 🔧 Chore/Other:重封清单对齐 4f4e686ec39aab301cfe2f755ad65f664eed1e54 规则面(guardian-runner 等门改动同枚落库以放行部署环 fail-closed) (6b50bea596)
- 🔧 Chore/Other:结清 RP-64 判据面追认积压(IG 门红0/门29已同步) (dceaebc5bd)
- 🔧 Chore/Other:追认孤儿目录壳清扫腿枚 2e16a53572 的 AGENTS.md 判据面命中 (96be0510e3)
- 🐞 Fix:修复 RN 邮箱验证码「点了没反应/无倒计时/收不到」三处根因 (889a6e6984)
- 📚 Docs:trackedFiles 计数刷新至 20846 (ad2c88fe37)
- 🐞 Fix:生产 app_versions.latest 的过期 OSS 签名直链做幂等收口 (4b46984084)
- 🐞 Fix:孤儿目录壳清扫腿收口 10 项代码审查(B1/B2/I1-I4/M1-M4)+镜像测试与 AGENTS 留痕,并重封根护栏清单清偿 HEAD 存量 fail-closed (2e16a53572)
- 🐞 Fix:预修还原被 52991b53 旧底稿同步误删的模型健康接线面(为收敛裁决 import 预立两侧动过形态) (27e5263140)
- 🐞 Fix:根治 APK 更新卡死(版本双写 fail-closed + installing 出口 + 服务端假阳性) (6e7f54552c)
- 🐞 Fix:旧底稿整份回退哨兵(提交面报警 + 推送前硬拦) (0de2c0c35a)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (3fc9d80fe2)
- 🐞 Fix:门8 method 推断⑤段加块尾守卫——已闭合函数不再向匿名回调裸fetch借POST(修 edu-attendance e2e 假阳性;T5/T6 夹具钉住) (df51ce0ce5)

**2026-11-11**
- 🔧 Chore/Other:追认i18n跨端门自检1枚 (43a6d76b7e)

**2026-11-11**
- 🐞 Fix:i18n 跨端门自检登记器改为当场求值，5 条用例不再空跑 (03ddbc8fb7)
- 🔧 Chore/Other:README 数字块按索引面重算（门数 359/330、测试文件与跟踪文件同批） (cd25562745)

**2026-11-11**
- 🐞 Fix:推送分叉自动收敛 + 落地复跑按落地面收窄 + 声明持久化(根治每次推送卡 5-20 分钟) (7265f95f404)
- 🚀 Feature/Improvement:豆包接入签到体系——第五平台全链路接线 (b4cca8b95bb)
- 🚀 Feature/Improvement:签到 API 定稿——detail+checkin 双接口,web 指纹实测定稿 (2ef06ac58be)
- 🐞 Fix:回放文本安全阀——非文本消息占位 + 总长截断 (40cb7783939)
- 🐞 Fix:回放文本安全阀——非文本消息占位 + 总长截断 (d692451deaa)
- 🔧 Chore/Other:给「喂 stdin」修复加装车锁(防回退 inherit 静默复发) (e3273d5391c)
- 🐞 Fix:worker 推送显式喂 pre-push 的 ref 行,水印门不再恒「未判定」 (d9f528d9236)
- 🐞 Fix:远端协议白名单放宽为 https+ssh(本机唯一通道;窗口闸与危险协议拒绝不动) (d33cd67cbbc)
- 🔧 Chore/Other:登记远端删除的 20261111000000 迁移件(删除随合并传播) (987d6e3e8ea)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (f446a0ffc30)
- 🔧 Chore/Other:钉住 renderStablePin 的五个收敛条件(防自激链静默复活) (db32cc91be6)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (a4cbcba5bdd)
- 🐞 Fix:生成物自述钉改为稳定钉,掐断「重生成→收编」自激链 (4ab41d4292b)
- 🐞 Fix:readDoubaoCookie 补 .bytedance.com 域的 msToken 风控票 (2541964724c)
- 🔧 Chore/Other:彻底移除系统 Administrator 凭据轮换违规迁移 (8955918c3bb)
- 🔧 Chore/Other:补 relay 号池批量推送脚本的溯源水印(远端新增文件漏注) (0f70833b764)
- 🔧 Chore/Other:文档自动更新游标推进(last-sha) (cc432ddf82b)
- 📚 Docs:自动刷新最近更新块 + 游标推进 (415e137dd6a)
- 🔧 Chore/Other:nav-styles 箭头常量按 prettier 折行(仅格式) (bf36876c96b)
- 🐞 Fix:侧栏交互项统一 —— 选中态反色、暗色 hover 纯黑、登录与导航同构 (8b37e3972ee)
- 📚 Docs:补本地开发开关说明,并纠正租户严格模式默认值口径 (ca35093984f)
- 🔧 Chore/Other:收编守护落档产出(2 件,凭落点账本) (702e0df09c4)
- 🔧 Chore/Other:重算四端 ui-routes 与 rn-route-map + knip/README 数字同步 (68c0e32d3a2)
- 🐞 Fix:同平台重复治理 —— zcode 键源补链 + 签到归属迁移收养 (2c72a450ece)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (f40d9ae05fb)
- 🐞 Fix:系统管理员凭据轮换例外 —— 仅放行 password_hash 变更 (727f76a0c5d)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (2696dd5c875)
- 🐞 Fix:导出/回放腿按 2026-11-11 真机实证修正三处假绿 (d959839357b)
- 🔧 Chore/Other:壳声明件跟随新落承载页(260 条说明符) (b0edc59ca86)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (df38ca133d7)
- 🔧 Chore/Other:自动落 2 枚小程序壳承载页(共 2 枚待产) (f8075c6c40e)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (82fdd009e19)
- 🐞 Fix:补齐 UpstreamSocketOpenOptions.heartbeatMs 契约并收口两脚本类型错(清 T1) (6756238fb01)
- 🚀 Feature/Improvement:登录锁定支持账号豁免名单,默认关闭 (ab97a2a5fca)
- 🐞 Fix:清掉测试面 typecheck 里长连接 lane 的 6 个存量错误 (9573af5378f)
- 🔧 Chore/Other:壳声明件跟随新落承载页(258 条说明符) (155a5b4d4be)
- 🔧 Chore/Other:自动落 2 枚小程序壳承载页(共 4 枚待产) (7eb6b47f007)
- 📚 Docs:自动刷新最近更新块 (9f1dafe915f)
- 📚 Docs:自动刷新最近更新块(收敛循环) (deda1ac0ffe)
- 🐞 Fix:扫码面板取消自动弹协议窗,改为内联同意并继续 (23e6125fd96)
- 🚀 Feature/Improvement:上游会话续写缓存 —— 同会话多轮透传 conversation_id,不再每次重建对话 (ec105c40232)
- 📚 Docs:自动刷新最近更新块(收敛循环) (d5e9ecf561b)
- 🚀 Feature/Improvement:回放迁移腿 —— 旧号对话以新会话进新号,豆包切号后可接着聊 (1af0dce1f43)
- 📚 Docs:刷新生成块数字(trackedFiles 20934→20936,并入 relay 长连接收口 2 个新文件) (52848a9f7e5)
- 📚 Docs:自动刷新最近更新块 + 游标跟进 cb64a7fd1c (86abb395e5b)
- 🐞 Fix:启动门只等必需后端三件套,/health 免租户(修 240s 假死) (3460206c423)

**2026-11-10**
- ⚡ Perf:全池推生产合并为单次 SSH 握手，能力探针与导出并行 (e4008a1a7a7)
- 📚 Docs:刷新生成块数字(trackedFiles 20930→20934,并入远端 4 个新脚本路径) (cb64a7fd1c4)
- 🔧 Chore/Other:同步小程序 entry 清单(新增 2 枚壳承载页后页面数 331→333) (13e9ad2c965)
- 🐞 Fix:长连接收口——代理隧道 agent、会话级亲和键、看门狗补全 (14dcbd290d5)
- 🐞 Fix:侧边栏选中态降对比 —— 统一 sidebar-active 弱底(明暗主题) (104ed9e8f95)
- 🐞 Fix:豆包跨号会话云端归档腿 + 一键入口文案据实测更新 (8068aa017c8)
- 🚀 Feature/Improvement:号池导入支持批量与生产推送，全池迁生产收敛为一条命令 (da8d7b06061)
- 📚 Docs:刷新生成块数字(relay 长连接 4 文件并入致 trackedFiles+4/testFiles+2/wsEndpoints+1/apiRoutes+1) (993f458ebf0)
- 🔧 Chore/Other:壳声明件跟随新落承载页(258 条说明符) (a83db3919eb)
- 🔧 Chore/Other:自动落 2 枚小程序壳承载页(共 4 枚待产) (7ce25c7a45a)
- 🐞 Fix:会话对账器补字节级兜底 —— 库被清空也不再是盲区 (df6082c173f)
- 🐞 Fix:base.css 第二份源纳入小程序 token 同步触发面 并补全 T1 配套断言 (36d956d285f)
- 🔧 Chore/Other:补 relay 长连接 4 个新增文件的溯源水印 (45e114f364a)
- 🚀 Feature/Improvement:号池 relay 全链路长连接贯通(契约+传输层+选路+WS 入口) (87e9aad2af0)
- 🚀 Feature/Improvement:对话随行落到实处 + WorkBuddy/OpenCode 写回真打通 (250ec2e0e34)
- 🐞 Fix:补 miniapp-taro 词包 eduAi 命名空间 20 键 清门 302p (9ea36e90cb7)
- 🐞 Fix:豆包 chat 打通 —— POST /chat/completion + SSE,推翻「走长连接」误判 (54148716627)
- 🔧 Chore/Other:补两枚判据面收敛提交的具名追认行 (636bde65293)
- 🐞 Fix:豆包 chat 打通 —— POST /chat/completion + SSE,推翻「走长连接」误判 (44404bb5e28)
- 🔧 Chore/Other:ui-routes 四端重算 + knip 受管块同步 (External-Red-Audit / Push-Channel: direct-merge) (94dcbdd310f)
- 🔧 Chore/Other:生成器重算收口 — sync-readme-numbers / gen-ui-routes / gen-i18n-compressed / gen-knip (External-Red-Audit / Push-Channel: direct-merge) (3cc4c48fdbb)
- 🐞 Fix:收尾修复 — 门 128 platform 非法 + docs 同步 + RN 残留清理 (55b19ffe086)
- 🐞 Fix:豆包适配器判活改走 IM batch_get,实证替换全部推断值 (57f105e3f0c)
- 🐞 Fix:豆包适配器判活改走 IM batch_get,实证替换全部推断值 (00a62e9b2e6)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (0ba0746bb83)
- 🐞 Fix:修掉「写了但客户端不认」的两型 —— MiniMax 记录形状污染 + OpenCode v2 落点失效 (0c17085f7da)
- 🐞 Fix:余额端点二次实证纠正(改 points/records + 100001 非失效,避免误杀有效号) (68c93885b46)
- 🐞 Fix:余额端点实证落地(域名+路径+token 头三重纠错,缺票不判死) (ffcff7a443d)
- 🐞 Fix:一键切号写回腿根治 + 缺模板拒写 + 会话模板回填器物 (136b39adffc)
- 🚀 Feature/Improvement:小程序/RN 中文回退链同源 + RN 端自托管方案根因收口 (9fb83e175b5)
- 🚀 Feature/Improvement:web 正文 400 档分段 unicode-range 按需面 + 门 313 跨端触发面补齐 (57d84775b4d)
- 🚀 Feature/Improvement:一键切号窗口实时显示各平台余额(未支持如实标注,不编 0) (c1aebcd0acc)
- 🔧 Chore/Other:裸 git 派生迁 gitRaw 层 收口棘轮例19 (450f4531184)
- 🐞 Fix:收口 gate-test(6) 两枚 Linux 专属红(abort 漏判 + 原子写夹具漂移) (3e662520bcf)
- 🐞 Fix:修复永久保活号静默饿死(server 档未判定放行 + minimax 探针接线 + 1h 节拍) (6a6c3cfcd4a)
- 🚀 Feature/Improvement:门 313 登记维断判据根治 + 属主登记补漏 + token 档位同源 (9dd458b22bc)
- ♻️ Refactor:门体自检的 cat-file 取材收敛到 face-reader 取材层 (a8ad54d2111)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (aef27ba3d9a)
- 📚 Docs:数字块按 HEAD 面重算（与推门 check-doc-numbers 同面） (7c9999939f0)
- 🐞 Fix:补迁 check-hook-chain-refs 的跨行裸 git 派生 (46dd3e0b864)
- 🐞 Fix:五处裸 git 派生迁到统一承载层 gitRaw（清门193与测试面两条欠账） (264c676468c)
- 🐞 Fix:门313 补 T4 书写面臂——品牌/子集/display 族所在栈一律配中文现代黑体兜底 (d786ae8aef7)
- ⚡ Perf:接线对账门多模式 grep 分片,真仓全量 43.8s→8.7s (a381e3a33fa)
- 🐞 Fix:恢复 /llm/models 路由挂载并消除 build_model_catalog 自递归 (3e8fdd3d4d4)
- 🚀 Feature/Improvement:三端滚动边缘淡出 ScrollEdgeFades + 抽屉/底部遮罩细化 (acdd5f169e0)
- ⚡ Perf:祖先取材改逐路径并发,18 条 M 路径 44.8s→19.4s (c6bb81e5844)
- ⚡ Perf:祖先取材按 HEAD+路径记忆,同轮不再为同一路径走两遍全历史 (d0b4aad6715)
- ⚡ Perf:3b 对账延后到后台 + 逐路径覆盖结论缓存,提交链 116.7s→28s (7ab84a93144)
- ⚡ Perf:水印提交档分母收窄到本次携带,单门 24.5s→1.0s (0cf426141b0)
- ⚡ Perf:30a 悬空集合单列缓存,提交链守门实测 309s→69s (775ca7e7837)
- 🐞 Fix:合并后按 token 档归一 inline-question-card 字号与字重 (10e5b33bb52)

**2026-11-08**
- 🚀 Feature/Improvement:补齐 AI 生成显式/隐式标识 (8d972f386c6)
- 🚀 Feature/Improvement:补齐 AI 生成显式/隐式标识 (f4535c338e9)
- 🚀 Feature/Improvement:Groups 屏薄壳承载落地(RN 壳同源渲染,词条取 web 原文) (e7d27e3e994)
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
