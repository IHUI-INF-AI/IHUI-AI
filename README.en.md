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

Headline claims (same source as the table below, all live-computed): **608 tables · 4564 API routes ·
25 WebSocket endpoints · 99 catalogued LLMs · 38 platforms auto-publishing · 3362 test files ·
286 engineering gates · 49 CI workflows · 5-language i18n parity · 9 app packages · 16 shared packages ·
14 compose services**.

<!-- BEGIN GENERATED NUMBERS (node scripts/gen-doc-numbers.mjs --markdown) -->
| 指标 | 现值 | 取数键 |
| ---- | ---- | ------ |
| 数据库表 | 612 | `dbTables` |
| schema 文件 | 237 | `dbSchemaFiles` |
| API 路由 | 4608 | `apiRoutes` |
| 路由文件 | 649 | `apiRouteFiles` |
| AI 服务路由 | 616 | `aiServiceRoutes` |
| WebSocket 端点 | 25 | `wsEndpoints` |
| 入库模型清单 | 100 | `llmModels` |
| 发布平台 | 38 | `publishPlatforms` |
| 端应用包 | 9 | `appPackages` |
| 共享包 | 16 | `sharedPackages` |
| CLI 命令文件 | 67 | `cliCommandFiles` |
| CLI 工具文件 | 72 | `cliToolFiles` |
| 语言 | 5 | `i18nLanguages` |
| i18n 作用域 | 7 | `i18nScopes` |
| 语言包 JSON | 35 | `i18nMessageFiles` |
| 测试文件 | 3579 | `testFiles` |
| CI 工作流 | 50 | `ciWorkflows` |
| Compose 服务 | 14 | `composeServices` |
| 工程守门 | 299 | `guardianGates` |
| — blocking | 273 | `guardianBlocking` |
| — warn | 28 | `guardianWarn` |
| 跟踪文件 | 17624 | `trackedFiles` |

上表由 `node scripts/gen-doc-numbers.mjs --markdown` 生成,最后核对日期 2026-10-29。
每个数的来源就写在取数键旁边的实现里(`scripts/gen-doc-numbers.mjs` 的 `SOURCES`),**不得手抄、不得另立第二份**。

<!-- END GENERATED NUMBERS -->


## Recent updates (auto-maintained)

<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->
**2026-10-29**
- 🐞 Fix:智汇AI 首页移除与 AI 应用商店重复的四块内容 (f571b65018)
- 🐞 Fix:结清 L28260 api-client 假绿灯票——判死现读 0,清账链 bd5ce8a101 已在 HEAD (a781529720)
- 🐞 Fix:部署环 ff 竞态锁正则跟上实现演进 + 门 11h 评分星补实心填充 + 水印复注 (2c6838d169)
- 🐞 Fix:结清三票(G-109四格全闭合/G-924死键已清零/G-689 stderr尾缓冲已装车) (5d9d115a2f)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3e240a1407)
- 🐞 Fix:结清两枚前提腐烂票(dot-source传递闭包3d31e4c499已装车/六屏下沉411646ee58等已全量) (13c1bdaec1)
- 🐞 Fix:结清 L5646 门116型B行——前提已腐烂(该文件裸git派生实测0,清偿枚949195bcb5早已是祖先) (b8ede2328e)
- 🐞 Fix:守门 8「前缀假设」收口为三态可判 —— 未判定桶 237→0、孤儿路由变异自证修前绿修后红 (255275c277)
- 🐞 Fix:落地 background_tasks(spawn 强引用登记处)—— 修 main 上悬空 import (f7d269568c)
- 🚀 Feature/Improvement:跨端无硬边滚动淡出遮罩 (RN 底部 / 小程序底部 / Web 侧栏) (1be5a68ad8)

**2026-10-29**
- 🐞 Fix:恢复 WorkPanel 被 9fdbc207ba 删除的第五组 props(主页/点选/开发者工具/独立窗口/常显停止) (f33f7b82a3)
- 🐞 Fix:F9 撞号判据收窄为「同号 ≥2 未勾活行」—— 已完成历史行与单活题面退出判红面 (d09c9d2bc7)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (940fda0cba)
- 📚 Docs:摘 2 条已被现行判定取代的旧 gap 行 —— gap 全集从 4 收到真值 2 (179334406c)
- 🔧 Chore/Other:第二次摘除 miniapp-end-capabilities 与 tip-metro-guard —— 并发归并把本票第一次摘除反向抹回 2 枚 (32d79e0c8f)

**2026-10-29**
- 🐞 Fix:补回「清理功能回退残留」删掉的四组功能面(并集恢复,零整文件覆盖) (60668e4c25)

**2026-10-29**
- 🐞 Fix:补 stable 非纯追加时的换代处置 —— 真浏览器验证发现的判据射程缺口 (865460dfa3)
- 🐞 Fix:折叠漂开副本族(N→1,认领合并到保留行 + 逐字留痕;--fold-drifted-families) (1242b2b5e9)

**2026-10-29**
- 🚀 Feature/Improvement:折叠语义例外集压过三维阈值 + 连接器分组从零消费者接成生产形态 (b5d9861d41)
- 🔧 Chore/Other:T3 阳性对照窗口 300→40 —— 正控不变而镜像测试从 215s 降到 70s (af58e0f5a6)
- 🐞 Fix:修 RN 端两处——一处编译不过、一处文案印成键名原文 (53c1dfb0a4)
- 🐞 Fix:miniapp 路由件改按 HEAD 面隔离树重算 —— 上一枚追平把他人未提交的输入烘进了自述钉 (230a8b3da2)
- 🔧 Chore/Other:三族派生件同枚追平（路由×2 + 离线包×4 + 声明件×3）—— 本票新落的镜像页与壳把它们顶 stale (51cfd40aa9)
- 🔧 Chore/Other:壳声明件跟随新落承载页(176 条说明符) (3e3497502c)
- 🚀 Feature/Improvement:装出「逐字回潮」这道尺子并挂上常驻班次 —— 单父嫁接绕过钩子这一族从此有人看得见 (47d6d441af)
- 🔧 Chore/Other:自动落 1 枚小程序壳承载页(共 1 枚待产) (3f45c3f943)
- ♻️ Refactor:云运行壳与共享屏同名（CloudRunsScreen）—— 让自动造页腿能认出这屏并给小程序端产出镜像页 (b676679d7a)
- 🔧 Chore/Other:兼容层图标集按现算补 Cloud —— 新共享屏 CloudRunsScreen 把它带进了消费面 (1a54e3d07d)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (f223a88eea)
- 🔧 Chore/Other:给 carrier 7 枚带回件逐条登记裁决——回潮必须留下「谁判过、依据是什么」 (806ded2afa)
- 🚀 Feature/Improvement:云运行屏提进 packages/app + RN 薄壳与导航登记 —— 结清 RN 端该内容域零承载 (2f6d6b266f)
- 🚀 Feature/Improvement:mobile-rn 端包补 cloudRuns 命名空间 24 键（五语）—— 为「云运行」共享屏供词，措辞一律取自 web (7a0a0ab71e)
- 📚 Docs:给门 89 的 R4 补上 check-web-portal-label-keys 的点名行(走对象空间,不吃别席的行) (0b6f24f729)
- 🐞 Fix:消掉门 89 的 R5 撞号恒红 + 回补门 237 被无关提交洗掉的 996 行版 + 换掉一把会替人下因果结论的坏尺子 (3ef804fc3f)
- 🔧 Chore/Other:撤销 1442baa1e0e 的整条移除——补回运营商一键登录的注册腿与消费腿 (b09e82f82c)

**2026-10-29**
- 🐞 Fix:并集补回 api-client 的 D09/D115 类型与发送链参数、web 发送链的窗格 store 参数 (5c20fb78ed)
- 🐞 Fix:恢复 chat store 被 c7476ff89b1 整份回退的实现(契约测试 96/96 钉住) (91cef71b0e)

**2026-10-29**
- 🐞 Fix:12 份文件补齐溯源水印 + 两处 lint 修正 (9725a9113f)
- ♻️ Refactor:收口新增集里盘上干净的三枚裸 git(棘轮新增 24→21)—— check-ps1-bom(1 生产 + 2 自检夹具,后者写临时仓/无 ps 目录,respectively 传 tmp/noPs 作根)、tip-metro-guard(rev-parse)、check-index-unmerged-age(ls-files -u -z)改走 face-reader 的 gitRaw。三处各有不能照抄的地方,如实记:① ps1-bom 的 git() 下游要 Buffer(subarray + 前 3 字节 hex 判 BOM),故用 { binary: true } 而非默认 utf8 串,原 .toString("utf8") 调用点一个不删;② tip-metro-guard 原来读的是 spawnSync 的 .stdout,且两支失败语义不同 —— git 跑起来非零退出时 stdout 为空串(打印成 "HEAD "),spawn 层失败才吞掉、保持初值 "?";gitRaw 一律抛,故用异常上的 e.status 是不是 number 还原这两支,静默 catch 会把它压成一支、把非零退出错报成 "?";③ check-index-unmerged-age 头注原写「不挂 face-reader 取材层」,迁移后成半真:改成「派生已统一走 gitRaw;判的是 index 元数据而非仓库内容,故仍不走 listFaceFiles/catBatch 那条取材面」,原解释的不按仓库锚点读内容的实质信息保留。验证都是真跑:check-ps1-bom --self-test 判据 + 端到端全 PASS(含面取不到 exit=2 与真零不空扫两向)、check-index-unmerged-age 现读「index 无未合并条目」rc=0、eslint 三文件 0 error(14 warning 全存量 no-console)、where.mjs 三文件均 0 处。范围如实:本批只动新增集里盘上干净的 3 枚;另 3 枚(check-cross-end-screen-coverage / check-web-rn-parity / gen-rn-host-shell)正被别席改(补 windowsHide 治门 193),按纪律未碰;gen-i18n-compressed 盘上已被别席清空;剩 17 枚属「HEAD 有、盘上已删未提交」,随删除落地自消;基线 18 枚是刻意存量(含 spawn 夹具件与钩子内 env 注入那一族),本批不碰。故棘轮在删除落地前仍红,落地后 39-17-3(他席)-1 = 18 = 基线。 (e17454a7de)
- 🐞 Fix:D58 类目卡接回 D21 折叠策略——修「判据在、消费者为 0」 (01ea49c5f2)
- 🚀 Feature/Improvement:对话框里能真出视频了 —— 视频工具接进普通对话 + agnes 免费档提交/取件闭环 (f1f0a37342)
- 🐞 Fix:流式 markdown 块边界单调性——修两级真 bug + 新增跨拍判据 (b70cfde77b)

**2026-10-29**
- 🐞 Fix:D58 类目卡接回 D21 折叠策略——修「判据在、消费者为 0」 (01ea49c5f2)
- 🚀 Feature/Improvement:对话框里能真出视频了 —— 视频工具接进普通对话 + agnes 免费档提交/取件闭环 (f1f0a37342)
- 🐞 Fix:流式 markdown 块边界单调性——修两级真 bug + 新增跨拍判据 (b70cfde77b)

**2026-10-29**
- 🐞 Fix:补回 chat.ts 被整行替换吞掉的 steerNoticesByMessageId 两处初始值 (418ac6aef6)
- 🐞 Fix:收口被整块重复的登记(F6 块级判据的修复出口) (6313f42b14)
- 🚀 Feature/Improvement:WS 失败终态可见可归因（G-86 前置半格） (202de10148)
- 🐞 Fix:补回被「清理功能回退残留」删掉的伴生导出 —— 解 web 构建恒红 (53e6c362f6)
- ♻️ Refactor:三处裸 git 迁移到 face-reader 的 gitRaw(棘轮 48→45)—— check-ruff-python 的 gitRun、check-gate-triggers 的 git 包装与其自检夹具 run、root-guard 的 headHashOf,三处都只是把「execFileSync 裸 git + 各自抄一遍 stdio 两态」换成层出口;§12g 的 stdio 两态由 gitRaw 写死,调用方不再复算。首推被 lint-staged 挡下两次并都点名本任务文件(未使用的 execFileSync 导入、catch 的 e 变为未使用),均已修后重发;现读 eslint 0 error。验证:ruff 自检 11/11、gate-triggers 自检九例+端到端七例、root-guard 无悬空标识符(execFileSync 残留 0)。范围如实:本批只收敛 3 枚,该棘轮仍红 —— 48 个命中里 20 个盘上已不存在(属 HEAD 存续而工作树已删未提交的 373 枚那一族),它们要么随删除落地自动从分母消失、要么需先恢复再迁,不在本批射程;另 check-index-unmerged-age 头注明写「判的不是仓库内容故不挂 face-reader」,按其既有决策不硬迁。 (52c88a32cf)
- 🐞 Fix:两处派生 git 显式接管 stdio,解除 push 门 193 (7916748b79)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (a54821ee50)
- 🐞 Fix:客户端 IP 归属收口 —— 边缘归一 + 三处手读 XFF 清除 (e5dce1709d)
- 🔧 Chore/Other:goal-b24 结清四票并补三票进展注记 —— 部署停摆升档/号池让位/公网腿归因/webhook 三类事件 (5a1fdcc51d)
- 🔧 Chore/Other:摘净嫁接带回的 9 枚退役/零消费者件,并更正 1fe3a2b42d 的两处不实陈述 (1250480412)
- 🔧 Chore/Other:撤销 systeminformation 豁免 —— override 已把它锁到修复版 (e9704d597d)
- 🐞 Fix:流式引用不再被切散,遥测收流对齐结束时刻 (444ca2abc1)
- 🐞 Fix:发现器读数去重口径 + 闭环三处真缺陷（门槛单源/票号边界/同 sha 裁决） (9f2dfb3a64)
- 🐞 Fix:补齐锁文件缺失的 workspace 依赖 —— 解生产 frozen-lockfile 安装失败 (7f3924a5ad)
- 🚀 Feature/Improvement:安卓 latest 只读对账 + 幂等登记腿 + 公网腿分阶段时延尺 (0b2a21d314)
- 🚀 Feature/Improvement:金丝雀观察窗从不可验变成本机可复现实测 + 修分流器契约缺失即整进程崩 (ebbac969af)
- 🐞 Fix:重封根护栏 —— 门脚本六枚正当演进后清单过期(部署环 fail-closed) (f933451ec5)
- 🚀 Feature/Improvement:停摆静默阈值改由日志实测分布派生 + 落后且停写时定向升级一次 (89c0980a95)
- 🚀 Feature/Improvement:大屏指挥台二轮 —— 主导航隐藏 + 速率火花线 + 块级增量 Markdown + 工具卡窗口化 (71a5e026d6)
- 🚀 Feature/Improvement:EdgeOne 回源鉴权头改由脚本直落,源站已切 enforce 并实测三向 (58c1403844)
- 🐞 Fix:合并把基础契约取成本侧旧版、消费方却是新版 —— api 端 36 条 TS 红按面逐条归位 (ad0a290626)
- 🚀 Feature/Improvement:驾驶舱补出「小程序壳绑定块 ← RN 壳」这一格读数,并摘掉文档里会腐烂的阶段计数 (91dabc0193)
- 🐞 Fix:门户维收敛落账 —— 5 条过期 gap 判定由 portal 行取代,并摘 1 条已作废的重复判定 (ee0b0c61da)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (b945ead980)
- 🐞 Fix:补齐两处裸派生 git 的 stdio 接管 —— 解门 193 阻塞 (09ea205d18)
- 🚀 Feature/Improvement:链条三段补齐调度 + 清掉自动补屏引入的 emoji 图标红 (072ce45ea5)
- 🐞 Fix:边缘 router 补三处「装了但装一半」的缺口 (3d99c2b3c6)
- 🐞 Fix:回补 410f749036 洗掉的 5 条 gap 登记 —— 本票上一枚用滞后工作树副本整文件提交，吞了别席在册条目 (0a1180c78d)
- 🐞 Fix:清偿 CategoryBar 的钉值与已不再命中的豁免 —— 门恢复判定后唯一的红就是这笔腐烂清单 (b7c072c963)
- 🔧 Chore/Other:兼容层图标/路由映射与词包派生件按 HEAD 面重生成 —— 门 251 的 C2/C10 两维从判红转绿 (a05684b04a)
- 🐞 Fix:锁版本消除生产可达 critical/high 依赖漏洞（8 包） (fc651ffaab)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (a83ab9c96a)
- 🐞 Fix:根桶补回 25 个出口 + 清掉 FavoriteScreen 的合解死块 —— 移动端 36 条 TS2305/2304 清零 (0de6e9f4f3)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (b6f0a1e7c9)
- 🔧 Chore/Other:壳声明件跟随新落承载页(175 条说明符) (d0e43db6e5)
- 🔧 Chore/Other:自动落 1 枚小程序壳承载页(共 1 枚待产) (fba6247f59)
- 🐞 Fix:恢复快捷键匹配的 undefined key 守卫 —— HEAD 上该回归用例本就是红的 (31ec5a483c)
- 🚀 Feature/Improvement:源站回源鉴权(三档默认off) + 依赖审计接常驻派发 + 豁免临期提醒 (eefe8f90c8)
- 📚 Docs:§10.7 的「待补判据」改判为已补 —— 门 260 当日收尾 (34c3ccbcf0)
- 🚀 Feature/Improvement:门 260 —— 生产依赖 critical/high 必须为 0(带到期日的豁免制) (af28a00f9f)

**2026-10-29**
- ♻️ Refactor:三处裸 git 迁移到 face-reader 的 gitRaw(棘轮 48→45)—— check-ruff-python 的 gitRun、check-gate-triggers 的 git 包装与其自检夹具 run、root-guard 的 headHashOf,三处都只是把「execFileSync 裸 git + 各自抄一遍 stdio 两态」换成层出口;§12g 的 stdio 两态由 gitRaw 写死,调用方不再复算。首推被 lint-staged 挡下两次并都点名本任务文件(未使用的 execFileSync 导入、catch 的 e 变为未使用),均已修后重发;现读 eslint 0 error。验证:ruff 自检 11/11、gate-triggers 自检九例+端到端七例、root-guard 无悬空标识符(execFileSync 残留 0)。范围如实:本批只收敛 3 枚,该棘轮仍红 —— 48 个命中里 20 个盘上已不存在(属 HEAD 存续而工作树已删未提交的 373 枚那一族),它们要么随删除落地自动从分母消失、要么需先恢复再迁,不在本批射程;另 check-index-unmerged-age 头注明写「判的不是仓库内容故不挂 face-reader」,按其既有决策不硬迁。 (52c88a32cf)
- 🐞 Fix:两处派生 git 显式接管 stdio,解除 push 门 193 (7916748b79)
- 🔧 Chore/Other:goal-b24 结清四票并补三票进展注记 —— 部署停摆升档/号池让位/公网腿归因/webhook 三类事件 (5a1fdcc51d)
- 🐞 Fix:流式引用不再被切散,遥测收流对齐结束时刻 (444ca2abc1)
- 🐞 Fix:发现器读数去重口径 + 闭环三处真缺陷（门槛单源/票号边界/同 sha 裁决） (9f2dfb3a64)
- 🚀 Feature/Improvement:安卓 latest 只读对账 + 幂等登记腿 + 公网腿分阶段时延尺 (0b2a21d314)
- 🚀 Feature/Improvement:金丝雀观察窗从不可验变成本机可复现实测 + 修分流器契约缺失即整进程崩 (ebbac969af)
- 🚀 Feature/Improvement:停摆静默阈值改由日志实测分布派生 + 落后且停写时定向升级一次 (89c0980a95)
- 🚀 Feature/Improvement:大屏指挥台二轮 —— 主导航隐藏 + 速率火花线 + 块级增量 Markdown + 工具卡窗口化 (71a5e026d6)

**2026-10-29**
- ♻️ Refactor:两个自拼 cat-file batch 的工具改走共享层 —— 棘轮测试「自拼 batch 却不走本层的门」现读 0 涨到 2(audit-aligned-domain-drift / measure-cross-end-page-sizes),而自拼一件要把 stdio[0]=pipe / maxBuffer / 头解析三处本仓都真踩过的坑各重写一遍。改法:两处批量取材改调 lib/face-reader.mjs 的 catBatch(键即 rev 串,HEAD 面用 HEAD:path);顺带修掉 audit 那处索引面的空前缀,原实现把裸路径当对象规格喂进去,取不到只静默记 null。两脚本在盘上是已删未提交态(HEAD 面仍在),按 §7 先从 HEAD 恢复再改;真跑 rc=0。本轮首推被 lint-staged 挡下并点名本文件(execFileSync 迁走后成未使用导入),已修;eslint 现读 0 error 5 warning(均为存量 no-console)。仅收敛存量维 2→0;另一维裸 git 派生 18→49 未动,那需要逐文件迁 gitRaw,属另一条线。 (68a7087665)
- 🐞 Fix:让 xAI Grok 真的出现在模型选择器首屏 —— 探测腿代理 + 4.20 版本归一 (ec788c8d92)

**2026-10-29**
- 🐞 Fix:让 xAI Grok 真的出现在模型选择器首屏 —— 探测腿代理 + 4.20 版本归一 (5a30eca114)
- 🐞 Fix:CI 三类事件不再静默失聪 —— check_suite/workflow_run/check_run 白名单 + 可诊断 500 (bd0fb9da32)
- 🚀 Feature/Improvement:号池让位器物 —— 已完成条目退出占用面、号随让位回池 (eba39416ce)

**2026-10-29**
- 🚀 Feature/Improvement:接入 xAI Grok 官方 key —— 上游 14 档全量入库 + 计费/路由/分类三处补口 (c653f36454)

**2026-10-29**
- 🚀 Feature/Improvement:接入 Agnes 视频生成（agnes-video-2.5 / 2.5-flash） (cb33e2848e)

**2026-10-29**
- 🚀 Feature/Improvement:工具活动窗口化展开文案（五语言同批） (80d75f9a52)
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
