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
| WebSocket 端点 | 40 | `wsEndpoints` |
| 入库模型清单 | 100 | `llmModels` |
| 发布平台 | 38 | `publishPlatforms` |
| 端应用包 | 9 | `appPackages` |
| 共享包 | 17 | `sharedPackages` |
| CLI 命令文件 | 78 | `cliCommandFiles` |
| CLI 工具文件 | 107 | `cliToolFiles` |
| 语言 | 5 | `i18nLanguages` |
| i18n 作用域 | 7 | `i18nScopes` |
| 语言包 JSON | 35 | `i18nMessageFiles` |
| 测试文件 | 5226 | `testFiles` |
| CI 工作流 | 59 | `ciWorkflows` |
| Compose 服务 | 14 | `composeServices` |
| 工程守门 | 363 | `guardianGates` |
| — blocking | 334 | `guardianBlocking` |
| — warn | 31 | `guardianWarn` |
| 跟踪文件 | 21361 | `trackedFiles` |

上表由 `node scripts/sync-readme-numbers.mjs`(唯一写入口,索引面取数)生成,最后核对日期 2026-11-13。
每个数的来源就写在取数键旁边的实现里(`scripts/gen-doc-numbers.mjs` 的 `SOURCES`),**不得手抄、不得另立第二份**。

<!-- END GENERATED NUMBERS -->


## Recent updates (auto-maintained)

<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->
**2026-11-13**
- 🔧 Chore/Other:收敛并行会话改动(水印补注+streaming-audit+考勤HR文档+cli文档) (53848eabcbe)

**2026-11-13**
- 🐞 Fix:修复15源码文件溯源水印载荷丢失+清理4文件死变量 (26aa10cbde9)

**2026-11-13**
- 🐞 Fix:修复24源码文件溯源水印载荷丢失(hr/db/i18n/craft)+清理import类型注解 (41cd9760853)

**2026-11-13**
- 🐞 Fix:修复源码文件溯源水印载荷丢失+清理死代码 (2af1a280cc2)

**2026-11-13**
- 🐞 Fix:AI对话流式显示P1修复 —— web早退持久化/并发幂等 + ai-service网关三缺陷 (274b1b6eda6)
- 🐞 Fix:RP-17 标头补等条件(凭证+枚举就位),避免派单器误判 actionable (547cfd5ddaa)
- 🚀 Feature/Improvement:登记考勤 IM 同步剩余三项待办(补 scope/审批枚举/端到端联调) (e503752634a)

**2026-11-13**
- 🐞 Fix:守门基础设施文件回退到origin/main版 —— 治陈旧底稿倒退 (6d289519792)

**2026-11-13**
- 🐞 Fix:收敛 push 门3道判红 —— 193 stdio / 300 端点登记 / 303p 文案裁定 (c605db9ade1)

**2026-11-13**
- 🚀 Feature/Improvement:跨端功能更新 + DeepSeek UI 逆向复现 + 文档维护 (4b9d379d1a8)
- 🐞 Fix:install-git-hooks 净面构建下默认模式跳过(exit 0) (de317e445d6)
- 🐞 Fix:mobile-rn conversationImport 补 noValidContent 5 语言词包 (50f565629d9)
- 🚀 Feature/Improvement:镜像fidelity改section型尺子 + 几何白名单收紧 + cover孤儿css清理 (186e54cc858)
- 📚 Docs:真机清单补注入溯源水印(守门47p) (c7d3c3d7b61)
- 📚 Docs:修正 IHUI-API 单体退役漂移 + 新增 RN 微信一键登录真机清单 (224583730df)
- 📚 Docs:生成块 2 维对齐 HEAD 面现算(testFiles 5226→5227 / trackedFiles 21361→21363) (fb34f051aea)
- 🔧 Chore/Other:为 apps/web/playwright.tail.config.ts 补齐溯源水印(门 47p 欠账) (61c31b13ab0)
- 📚 Docs:派生产物 changelog 日期段自动重排 (8eee8b4a3cd)
- 🚀 Feature/Improvement:dev-enter/cover 迁共享屏薄壳 + 小程序hand迁移计划文档 (05a4bfa1723)
- 🔧 Chore/Other:结清 189G —— F-189 重命名级联已在 a00d16ca08,本轮补 DELETE 守卫事务收口(锁→组行锁→计数→删同事务,f-189 回归 5/5,代码入 a84b0dc7347) (2be18110794)
- 🐞 Fix:branch-delete-with-backup 补自动留痕 —— 治"手工调用不留痕"的结构性缺口 (beb7d0463de)
- 🔧 Chore/Other:fix(api)+docs: F-171 课程问答 lessonId 下推 SQL WHERE(分页/total 以本课 published 问答为口径,f-171 回归 4/4)+F-189 分组删除守卫事务收口(锁→组行 FOR UPDATE→计数→删同事务,并发打标/抢删窗口封死,f-189 回归 5/5);README 块 testFiles 5226/trackedFiles 21361 随 DN5 按终态派生落账(零卷入他席在飞形态) (a84b0dc7347)
- 🔧 Chore/Other:结清批次35 共5张(F-321/333/343/345/351) (6b6de7ea676)
- 🔧 Chore/Other:门 47p 自愈重新注入 streaming-tail-frame 水印 (44800c59c5b)
- 🐞 Fix:结清 F-321 停留统计先归一再截断 + F-333 提现 PUT 状态机守卫 + F-343 保留期清理分批 + F-345 运行时流 done 帧协议 + F-351 资讯分页稳定排序 (543f21144ea)
- 🔧 Chore/Other:补 D2 末帧/整体替换的浏览器侧集成冒烟(判别力边界已实测登记) (939ebb689aa)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (f1eea10ede3)
- 🐞 Fix:F-164 返佣两级费率组合闸+记账封顶——PATCH 单/双字段非法组合一律 400 且 0 写,recordRelayCommission 每笔之和 ≤ sourceCostCents(level1 先取,余预算给 level2);回归 f-164 测试 17/17 绿;README 生成块随 DN5 用 sync-readme-numbers 官方通道刷新(testFiles 5217→5219/trackedFiles 21352→21354,并修复被吃掉的行首反引号) (8418d437bba)
- 🔧 Chore/Other:生成块数字对齐 HEAD 树现算(testFiles 5218 / trackedFiles 21353)并修复 trackedFiles 断字 (1e5db9591b5)
- 🔧 Chore/Other:结清 164G/171G —— F-164 三级费率组合闸+记账封顶入库, F-171 lessonId 下推 WHERE 入库(证据见配对码提交) (277a22436ab)
- 🐞 Fix:模型映射后复检 allowedModels,堵白名单绕过(低价套餐偷调高价模型) + 回归锁 5/5 (792bb030a61)
- 🐞 Fix:模型映射后复检 allowedModels,堵住白名单绕过 + 回归锁 (6a7113da6d5)
- 🔧 Chore/Other:补齐 F-187/F-200 新增文件的溯源水印(守门 47p) (fd8574763b6)
- 🔧 Chore/Other:结清批次34 共5张(F-297/313/314/317/320) (9d25b188cec)
- 🐞 Fix:结清 F-297 编辑写路径会话锁 + F-313 验证码降级读写一致 + F-314 邮件显式超时 + F-317 催费逾期口径 + F-320 巡检失败可观测 (d07c6c267c4)
- 🔧 Chore/Other:结清 F-200 Crew 全失败谎报成功 + F-187 baseUrl SSRF(已修复并测试通过,代码入 a00d16ca08a) (d8b6411950d)
- 🐞 Fix:F-200 Crew 全失败不再谎报成功 + F-187 v2 保存链与 ai-service api_base SSRF 二次校验 (a00d16ca08a)
- 🚀 Feature/Improvement:复现 Trae browser 状态查询族 + 补齐 goal/auto-review/asRpcError 验证闭环 (dd21ff31715)

**2026-11-13**
- 🐞 Fix:mobile-rn conversationImport 补 noValidContent 5 语言词包 (50f565629d)

**2026-11-13**
- 🐞 Fix:mobile-rn conversationImport 补 noValidContent 5 语言词包 (d1734c00a7)

**2026-11-13**
- 🚀 Feature/Improvement:镜像fidelity改section型尺子 + 几何白名单收紧 + cover孤儿css清理 (186e54cc85)

**2026-11-13**
- 📚 Docs:真机清单补注入溯源水印(守门47p) (c7d3c3d7b6)
- 📚 Docs:生成块 2 维对齐 HEAD 面现算(testFiles 5226→5227 / trackedFiles 21361→21363) (fb34f051ae)
- 🔧 Chore/Other:为 apps/web/playwright.tail.config.ts 补齐溯源水印(门 47p 欠账) (61c31b13ab)
- 🐞 Fix:branch-delete-with-backup 补自动留痕 —— 治"手工调用不留痕"的结构性缺口 (beb7d0463d)
- 🔧 Chore/Other:门 47p 自愈重新注入 streaming-tail-frame 水印 (44800c59c5)
- 🔧 Chore/Other:补 D2 末帧/整体替换的浏览器侧集成冒烟(判别力边界已实测登记) (939ebb689a)

**2026-11-13**
- 🔧 Chore/Other:结清 189G —— F-189 重命名级联已在 a00d16ca08,本轮补 DELETE 守卫事务收口(锁→组行锁→计数→删同事务,f-189 回归 5/5,代码入 a84b0dc7347) (2be1811079)
- 🔧 Chore/Other:fix(api)+docs: F-171 课程问答 lessonId 下推 SQL WHERE(分页/total 以本课 published 问答为口径,f-171 回归 4/4)+F-189 分组删除守卫事务收口(锁→组行 FOR UPDATE→计数→删同事务,并发打标/抢删窗口封死,f-189 回归 5/5);README 块 testFiles 5226/trackedFiles 21361 随 DN5 按终态派生落账(零卷入他席在飞形态) (a84b0dc734)
- 🔧 Chore/Other:结清批次35 共5张(F-321/333/343/345/351) (6b6de7ea67)
- 🐞 Fix:结清 F-321 停留统计先归一再截断 + F-333 提现 PUT 状态机守卫 + F-343 保留期清理分批 + F-345 运行时流 done 帧协议 + F-351 资讯分页稳定排序 (543f21144e)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (f1eea10ede)
- 🐞 Fix:F-164 返佣两级费率组合闸+记账封顶——PATCH 单/双字段非法组合一律 400 且 0 写,recordRelayCommission 每笔之和 ≤ sourceCostCents(level1 先取,余预算给 level2);回归 f-164 测试 17/17 绿;README 生成块随 DN5 用 sync-readme-numbers 官方通道刷新(testFiles 5217→5219/trackedFiles 21352→21354,并修复被吃掉的行首反引号) (8418d437bb)
- 🔧 Chore/Other:生成块数字对齐 HEAD 树现算(testFiles 5218 / trackedFiles 21353)并修复 trackedFiles 断字 (1e5db9591b)
- 🔧 Chore/Other:结清 164G/171G —— F-164 三级费率组合闸+记账封顶入库, F-171 lessonId 下推 WHERE 入库(证据见配对码提交) (277a22436a)
- 🐞 Fix:模型映射后复检 allowedModels,堵白名单绕过(低价套餐偷调高价模型) + 回归锁 5/5 (792bb030a6)
- 🐞 Fix:模型映射后复检 allowedModels,堵住白名单绕过 + 回归锁 (6a7113da6d)
- 🔧 Chore/Other:补齐 F-187/F-200 新增文件的溯源水印(守门 47p) (fd8574763b)
- 🔧 Chore/Other:结清批次34 共5张(F-297/313/314/317/320) (9d25b188ce)
- 🐞 Fix:结清 F-297 编辑写路径会话锁 + F-313 验证码降级读写一致 + F-314 邮件显式超时 + F-317 催费逾期口径 + F-320 巡检失败可观测 (d07c6c267c)
- 🔧 Chore/Other:结清 F-200 Crew 全失败谎报成功 + F-187 baseUrl SSRF(已修复并测试通过,代码入 a00d16ca08a) (d8b6411950)
- 🐞 Fix:F-200 Crew 全失败不再谎报成功 + F-187 v2 保存链与 ai-service api_base SSRF 二次校验 (a00d16ca08)
- 🚀 Feature/Improvement:复现 Trae browser 状态查询族 + 补齐 goal/auto-review/asRpcError 验证闭环 (dd21ff3171)

**2026-11-13**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (f1eea10ede3)

**2026-11-13**
- 🐞 Fix:F-164 返佣两级费率组合闸+记账封顶——PATCH 单/双字段非法组合一律 400 且 0 写,recordRelayCommission 每笔之和 ≤ sourceCostCents(level1 先取,余预算给 level2);回归 f-164 测试 17/17 绿;README 生成块随 DN5 用 sync-readme-numbers 官方通道刷新(testFiles 5217→5219/trackedFiles 21352→21354,并修复被吃掉的行首反引号) (8418d437bba)
- 🔧 Chore/Other:生成块数字对齐 HEAD 树现算(testFiles 5218 / trackedFiles 21353)并修复 trackedFiles 断字 (1e5db9591b5)
- 🔧 Chore/Other:结清 164G/171G —— F-164 三级费率组合闸+记账封顶入库, F-171 lessonId 下推 WHERE 入库(证据见配对码提交) (277a22436ab)
- 🐞 Fix:模型映射后复检 allowedModels,堵白名单绕过(低价套餐偷调高价模型) + 回归锁 5/5 (792bb030a61)
- 🐞 Fix:模型映射后复检 allowedModels,堵住白名单绕过 + 回归锁 (6a7113da6d5)
- 📚 Docs:生成块 trackedFiles 对齐 HEAD 面现算(21338→21339) (593905e70db)
- 🔧 Chore/Other:补齐 F-187/F-200 新增文件的溯源水印(守门 47p) (fd8574763b6)
- 🔧 Chore/Other:结清批次34 共5张(F-297/313/314/317/320) (9d25b188cec)
- 🐞 Fix:结清 F-297 编辑写路径会话锁 + F-313 验证码降级读写一致 + F-314 邮件显式超时 + F-317 催费逾期口径 + F-320 巡检失败可观测 (d07c6c267c4)
- 🔧 Chore/Other:结清 F-200 Crew 全失败谎报成功 + F-187 baseUrl SSRF(已修复并测试通过,代码入 a00d16ca08a) (d8b6411950d)
- 🐞 Fix:F-200 Crew 全失败不再谎报成功 + F-187 v2 保存链与 ai-service api_base SSRF 二次校验 (a00d16ca08a)
- 🚀 Feature/Improvement:复现 Trae browser 状态查询族 + 补齐 goal/auto-review/asRpcError 验证闭环 (dd21ff31715)
- 📚 Docs:门 41 存量 24 分支逐枚内容级取证 —— 全部必须保留,0 枚可收口 (46542d1d849)
- 🔧 Chore/Other:结清批次33 共5张(F-286/296/307/309/310) (45fea84f70b)
- 🐞 Fix:结清 F-286 迟到释放带归属 + F-296 流式错误协议化 + F-307 并行工具块 + F-309 定价生效时刻 + F-310 券核销共判据 (fce802dd86f)
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
