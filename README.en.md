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
| 测试文件 | 5250 | `testFiles` |
| CI 工作流 | 59 | `ciWorkflows` |
| Compose 服务 | 14 | `composeServices` |
| 工程守门 | 363 | `guardianGates` |
| — blocking | 334 | `guardianBlocking` |
| — warn | 31 | `guardianWarn` |
| 跟踪文件 | 21387 | `trackedFiles` |

上表由 `node scripts/sync-readme-numbers.mjs`(唯一写入口,索引面取数)生成,最后核对日期 2026-11-13。
每个数的来源就写在取数键旁边的实现里(`scripts/gen-doc-numbers.mjs` 的 `SOURCES`),**不得手抄、不得另立第二份**。

<!-- END GENERATED NUMBERS -->


## Recent updates (auto-maintained)

<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->
**2026-11-13**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (e2b674edc9f)
- 🐞 Fix:结清 F-382 OSS 分片会话隔离 + F-388 关键词下推 + F-389 缓存键凭据指纹 + F-393 内容分类归属 + F-396 兑换码 Key 归属 (d8ffac6ef8e)

**2026-11-13**
- 🐞 Fix:结清 F-392 引导凭据闭环 + F-406 提现手续费扣余额 + F-441 剧情增强并发记账 + F-450 代扣回调单事务 + F-417 xlsx 单趟渲染 (6e80aa927ce)

**2026-11-13**
- 🐞 Fix:结清 F-382 OSS 分片会话隔离 + F-388 关键词下推 + F-389 缓存键凭据指纹 + F-393 内容分类归属 + F-396 兑换码 Key 归属 (a623f5c402a)

**2026-11-13**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (2a385166492)
- 🔧 Chore/Other:结清 F-450 —— 代扣回调建单/完成已并入外层事务(DB-02,commit 55efcffe136):placeOrder(tx)/completeOrder(tx)/rechargeToken(outerTx)/earnPoints(tx) 全链透传,消除半提交与重复发权益;f-450 回归锁 5/5 通过 (63c7cd22e13)
- 📚 Docs:生成块 2 维对齐 HEAD 面现算(testFiles 5226→5227 / trackedFiles 21361→21363) (fb34f051aea)
- 🔧 Chore/Other:为 apps/web/playwright.tail.config.ts 补齐溯源水印(门 47p 欠账) (61c31b13ab0)
- 🐞 Fix:branch-delete-with-backup 补自动留痕 —— 治"手工调用不留痕"的结构性缺口 (beb7d0463de)
- 🔧 Chore/Other:门 47p 自愈重新注入 streaming-tail-frame 水印 (44800c59c5b)
- 🔧 Chore/Other:补 D2 末帧/整体替换的浏览器侧集成冒烟(判别力边界已实测登记) (939ebb689aa)

**2026-11-13**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (b5e09bb17f4)
- 🐞 Fix:提现旁路写入口全部改调 commission-queries 单源服务——agent-withdrawal apply/approve/reject 补冻结+单号+状态守卫+退冻结,admin第5条写入口消除无守卫直写status(资金守恒同源);回归锁 f452-453 6/6 (d773e33e341)
- 🔧 Chore/Other:结清 F-452/F-453 —— 提现旁路写入口(finance-extended agent-withdrawal 三入口 + admin-extended 第5条)全部改调 commission-queries 单源服务 apply/approve/rejectWithdrawal,补冻结+单号+状态守卫+退冻结(资金守恒同源);回归锁 f452-453 6/6 (aada9610e56)
- 🚀 Feature/Improvement:复现 WorkBuddy subagent journal 闭环(compact/append/merge)—— 逆向-复现-超越 (6a06e594008)
- 🔧 Chore/Other:结清批次36 共5张(F-352/353/367/369/372) (f89c5981fe5)
- 🐞 Fix:结清 F-352 定时清理集合化分批 + F-353 积分渠道事务 + F-367 清理器显式生命周期 + F-369 订阅配额原子累加 + F-372 日成本熔断 (33206206243)
- 🐞 Fix:ab_test_results schema 补 UNIQUE(variant_id,bucket) 表约束 + bucket NOT NULL,对齐已入库迁移 20261112000002,防 onConflict 42P10 + 回归锁 5/5 (d1b4766f6ba)
- 🔧 Chore/Other:结清 F-448 —— ab_test_results schema 侧补 UNIQUE(variant_id,bucket) 表约束 + bucket NOT NULL,对齐已入库迁移 20261112000002(证据:迁移 + 回归锁 f448 5/5) (72ec4aad2b7)
- 🔧 Chore/Other:结清 189G —— F-189 重命名级联已在 a00d16ca08,本轮补 DELETE 守卫事务收口(锁→组行锁→计数→删同事务,f-189 回归 5/5,代码入 a84b0dc7347) (2be18110794)

**2026-11-13**
- 🔧 Chore/Other:fix(api)+docs: F-171 课程问答 lessonId 下推 SQL WHERE(分页/total 以本课 published 问答为口径,f-171 回归 4/4)+F-189 分组删除守卫事务收口(锁→组行 FOR UPDATE→计数→删同事务,并发打标/抢删窗口封死,f-189 回归 5/5);README 块 testFiles 5226/trackedFiles 21361 随 DN5 按终态派生落账(零卷入他席在飞形态) (a84b0dc7347)
- 🔧 Chore/Other:结清批次35 共5张(F-321/333/343/345/351) (6b6de7ea676)
- 🐞 Fix:结清 F-321 停留统计先归一再截断 + F-333 提现 PUT 状态机守卫 + F-343 保留期清理分批 + F-345 运行时流 done 帧协议 + F-351 资讯分页稳定排序 (543f21144ea)

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

**2026-11-13**
- 🔧 Chore/Other:收编守护落档产出(2 件,凭落点账本) (a9fd477339f)
- 🔧 Chore/Other:结清 F-184 Hook PATCH 管理员闸（已修复且测试通过） (59bbb11cdf0)
- 🔧 Chore/Other:结清批次32 共5张(F-266/272/273/280/282) (41877ec4b23)
- 🐞 Fix:结清 F-266 隔离记录清理 + F-272 step-up 一次性兑付 + F-273 地理改 HTTPS + F-280 ACP 会话真实化 + F-282 下载不再假成功 (c4981a39f6b)
- 🔧 Chore/Other:结清批次31 共5张(F-254/257/258/264/265) (944031157fd)
- 🐞 Fix:结清 F-254 提及路径闸 + F-257 对公金额校验 + F-258 快照脏重试 + F-264 重建原子切换 + F-265 改动集有界 (e9a9ab4fc96)
- 🔧 Chore/Other:结清批次30 共5张(F-235/237/239/240/243) (2b4d1f06226)
- 🐞 Fix:结清 F-235 短信失败退配额 + F-237 错误透传收敛 + F-239 对账 pending 保留 + F-240 在途闸原子 + F-243 队列默认隔离 (5ec188aad63)
- 🔧 Chore/Other:结清批次28-29 共10张(F-217/218/219/224/225/226/227/231/233/234) (d3691f03a81)
- 🐞 Fix:结清 F-226 WS 归还唯一 + F-227 限流兜底共享容量 + F-231 对账日界 + F-233 订阅配额 fail-closed + F-234 佣金兜底窗口 (1accd6afc69)
- 🐞 Fix:结清 F-217 outbox 原子认领 + F-218 密钥字节校验 + F-219 兜底计数淘汰 + F-224 反自动化白名单 + F-225 loader 回收 (19d278d6d95)
- 🔧 Chore/Other:结清批次24-27 共24张(F-97/130/143/144/145/146/149/151/152/161/148/163/173/176/179/182/197/198/201/202/207/208/209/212) (3ed1fead0ca)
- 🐞 Fix:结清 F-202 取消终态 + F-207 审计不丢行 + F-208 连接守卫 + F-209 限流桶键 + F-212 偏好批量 (b940eb221b7)
- 🐞 Fix:结清 F-182 退订回执如实失败 + F-197 OSS 上传地址与闸门 + F-198 转码淘汰杀子进程 + F-201 工作区锁必释放 (d7ca495b2b6)
- 🐞 Fix:结清 F-148 VIP 数量履约 + F-163 定时任务如实失败 + F-173 帮助文章发布闸 + F-176 下架内容读面 + F-179 Key 解密隔离 (26be82a3357)
- 🐞 Fix:结清 F-149 报表口径 + F-151 插件统计时区日界 + F-161 号池属主边界 (a1fab3c3f92)
- 🐞 Fix:结清 F-130 已支付订单禁硬删 + F-146 转换入口体积闸 + F-152 评论软删谓词 (906da6962ce)
- 🐞 Fix:结清 F-97 能力调用鉴权计费 + F-144 embedding 超时 + F-145 删文档事务 + F-143 补锁 (026ac185ae9)
- 🔧 Chore/Other:结清批次23 共10张(F-34/51/67/74/78/92/94/96/99/116) (0a7b3e855a0)
- 🐞 Fix:结清 F-51 生图轮询可中断 + F-67 提现锁降级不重放 (6bbd9f12e65)
- 🐞 Fix:结清健壮性四张 —— F-34 退款持久补偿、F-78 企业分页、F-99 职业建议如实失败、F-116 WS 背压 (dfeb2b407b0)
- 🐞 Fix:结清越权/泄露四张 —— F-74 预览归属、F-92 MJ 归属、F-94 知识库公开面、F-96 模型配置属主闸 (a1fb921f08f)
- 🔧 Chore/Other:README 生成块数字对账 —— 合并后按现算刷新(trackedFiles/testFiles) (218eb8bd670)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (a7aa681cb65)
- 🔧 Chore/Other:README 生成块数字对账 —— 合并后按现算刷新(trackedFiles/testFiles) (abebf838eba)
- 🔧 Chore/Other:登录 Enter 提交流程夹具改用 example.com，避免旧邮箱地址继续留在端侧源码 (e6da768ad7f)
- 🔧 Chore/Other:移除根目录邮箱排查会话转写稿（含大量已废弃地址，避免误导），并同步 README 数字块 (d04162089ad)
- 🐞 Fix:小程序语言包派生件按现源头重生成（ch10 联系邮箱收口为 lizong@aizhs.top） (210e0246ffb)
- 🔧 Chore/Other:结清批次21+22 共11张(AIS-046/063/064/077、F-20/23/44/45/64/65/79) (abdef7a7e3e)
- 🐞 Fix:F-64/F-65 margin 资金闸与 F-79 工作区批量 N+1 (5abdc48b1f1)
- 🐞 Fix:F-44/F-45 内存 Map 无回收(任务终态即删 + 请求计数按关闭回收) (9d2d2edbf3c)
- 📚 Docs:重建 README —— 清掉误入 HEAD 的 6 处冲突标记,数字取 HEAD 现算 (ad18bd41bb5)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (9748cdedccd)
- 🐞 Fix:README 联系表去重并把残留旧邮箱收口为 lizong@aizhs.top (203ea00cc74)
- 📚 Docs:生成块 22 维对账到 HEAD 现算(8 个维度与实际不符) (874a7bebb9d)
- 📚 Docs:生成块数字对账到 HEAD 现算(testFiles 5130→5135 / trackedFiles 21245→21268) (33739a02868)
- 🔧 Chore/Other:302p 跨端漂移基线全维刷新(终尖现读,五个变维逐项取证非本区间引入) (a0afd5f9c44)
- 🔧 Chore/Other:补齐流式修复批 7 个文件的溯源水印(门 47p 欠账清偿) (1cfac3e8a7a)
- 🔧 Chore/Other:为 1b33002a4ef 补具名追认(门 41 preserve/ 豁免改动缺签名声明) (6d968afc42e)
- 🔧 Chore/Other:补齐流式修复批的溯源水印与格式规整(门 47p 自愈产物) (3d8a85ed174)
- 🐞 Fix:流式输出显示全链修复(D1-D6)——码点切批/末帧不丢/三端跟底/样式隔离 (4bdc41ba942)
- 📚 Docs:Y-38 补全取证结论——卡点定死为「无在册 zcode 号」+ 进程未加载引擎 + 判读口径纠正 (5a7680ce7a5)
- 🐞 Fix:门 41 补 preserve/ 备份豁免 + 门 263 两处存量 ruff 清偿 (1b33002a4ef)

**2026-11-13**
- 🐞 Fix:F-20 积分任务日界 / F-23 支付宝退款整数分比较 (9e63bf2ec48)

**2026-11-13**
- 🐞 Fix:AIS-077 知识卡注入面属主裁剪 + AIS-046 审计接口分工说明 (4fa66bc12b9)
- 🔧 Chore/Other:一键切号排序补 4 道变异判据 + 桌面 README 沉淀三层入口 + 补 2 枚并发提交具名追认 (eccf5d6d6fc)
- 🐞 Fix:假数据与告警收件人收口（mock 用户迁到 example.com，凭据巡检告警改官方邮箱） (a795b74ba4a)
- 🐞 Fix:收口剩余旧邮箱残留（README 正文/发布说明/脱敏示例/告警收件人） (5f7ce8307a6)
- 🐞 Fix:收口剩余旧邮箱残留（README 正文/发布说明/脱敏示例/告警收件人） (13b775477a9)
- 🐞 Fix:自愈锚点挂到每次提交，任务被禁用/删除/改写后自动复原 (874eb3d45a8)
- 🔧 Chore/Other:README 生成块数字对账 —— trackedFiles 21245 / testFiles 5130(索引面现算) (2c644690f76)
- 🐞 Fix:推送侧三处收口 —— 47p 范围派生兜底、两枚 tmp 脚本水印、302p 基线对账 (18449f0db15)
- 🐞 Fix:对外邮箱与发件身份统一为 lizong@aizhs.top (8d2ad98f623)
- 🔧 Chore/Other:补签并发零弹窗提交的不可变护栏具名追认(1 枚收口) (fbf88335dbf)
- 🔧 Chore/Other:违禁桶兜底清扫——HEAD面等条件/待拍板未勾行自动摘除(两道机主禁令的执行器物化,留痕f12-purge;复翻席请同步摘形态,事实内容按各批结清提交保留) (58dc4eefefb)
- 🐞 Fix:计划任务零弹窗闭环 — 隐藏包装 + 全盘自愈巡检 + 微信托盘看门狗 (ca4e7d1892f)
- 🐞 Fix:install-git-hooks 测试的 git 派生补显式 stdio,消门 193 判红 (284b2a2b803)
- 🔧 Chore/Other:补 3 条不可变护栏具名追认(收敛合并与他席旁路落地) (46294235176)
- 🔧 Chore/Other:收敛前置补录两条删除意图通知书(checkin_* 权限文件) (b50b0b95e3b)
- 🚀 Feature/Improvement:一键切号首屏平台顺序钦定(Trae/WorkBuddy/小浣熊/Loomy/Qoder)并加仓内 switch:oneclick 入口 (27f9b236b06)
- 🐞 Fix:临期窗口跟随派发节拍,消除 alert 档 6h 漏刷空窗 (33f7f4b521d)
- 🚀 Feature/Improvement:生成物拦截补推送侧 --rev 面 + 钩子安装器单测 (f6b3537365c)
- 🐞 Fix:tmp-diag-trae-token 清未用导入与非空收窄, 消 TS6133/TS2769 (123f8f2a665)
- 🐞 Fix:偿还 mypy 存量 20 条类型债务(签到引擎族,全为类型收窄无行为变更) (045d8717695)
- 🐞 Fix:tmp-probe-exchg 载荷类型收回 TraeTokenPayload, 消同族类型不兼容 (8352346ead0)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (b244888ad08)

**2026-11-12**
- 🔧 Chore/Other:check-acp-error-mapping 入属主登记表 unowned 面 (be20c8441f1)
- 🐞 Fix:trae 凭证被拒(1001)按 SessionDead 收口, 预检命中即止不再发 claim (b6001fda949)
- 🚀 Feature/Improvement:生成物拦截闭环 — 钩子安装器 + 属主/文档登记 + 判面层与根护栏重封 (4216dfdae81)
- 🚀 Feature/Improvement:生成物拦截闸入库 —— 实验沙箱/日志/副本不得再进提交面 (41f15441f8c)
- 🔧 Chore/Other:工作区清零 + 工具现场入忽略层 (71216c30e65)
- 🚀 Feature/Improvement:补 3 个句柄族动词 —— scroll / wait_for / drag（对标 Trae 的 browser_* 工具面） (8853cdf6435)
- 🚀 Feature/Improvement:账号池退出态保活收口、MiniMax 会话同步与多处修复 (32792c6e049)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (00311860616)
- 🚀 Feature/Improvement:ZCode 每日波谷额度接入号池自动签到(第七平台引擎 + 19:05 窗口 + 补跑轮) (cc4a2a3b6d0)
- 🔧 Chore/Other:合并后重结批次20 共16张(F-077 / AIS / F-12,24,43,276,399,501) (e4efa8e0492)
- 🚀 Feature/Improvement:把 schedule(cron) 榨出来 —— 周期挂起唤醒，判据与调度分离 (fe0d97cc176)
- 🔧 Chore/Other:结清批次20 共16张(F-077 / AIS-011,025,036,037,043,045,047,048,079 / F-12,24,43,276,399,501) (b74aac553f3)
- 🐞 Fix:F-276 三维生成身份/超时/如实失败与计费、F-399 续费回调原文验签 (b2c531f732e)
- 🐞 Fix:F-12 支付副作用幂等、F-43 产物哈希流式、F-24 导出业务日界、F-501 clawdbot 连接代次 (cffddf11416)
- 🐞 Fix:AIS-025 dag 调度器重启恢复与 AIS-045 手动/调度签到互斥 (8b6e6cfa4b5)
- 🐞 Fix:AIS-011 Gemini 拦截识别、AIS-047 审计 user_id 落库、AIS-079 usage 读面权限门 (35703e03b14)
- 🐞 Fix:AIS-037 workspacePath 越界校验与 AIS-043 SSO state 校验/mock 缺省 (38bf455f2a1)
- 🐞 Fix:AIS-036 webhook SSRF 旁路与 AIS-048 错误契约泄露 str(e) (551ec71b1c4)
- 🐞 Fix:F-077 egress 判据默认开地址证据(addressProof) (938f602456b)
- 📚 Docs:Y-38 摘掉已根治的①格(键源四档阶梯本轮落地),只留生产腿首跑待验 (48d3496d5f9)
- 🚀 Feature/Improvement:财务部板块 RP-46 三端镜像(cherry-pick 到 origin/main 尖) - 共享屏 FinanceAiHubScreen + RN/Taro 镜像 + 路由注册 + 五语 i18n + 三端登记 - 原 push/finance-ai-rp46(2aec011) 快进重放到当前尖 e3f5dae (6e7193a610c)
- 🚀 Feature/Improvement:清掉上轮 4 条局限 —— 错误映射守门 / workflow 真实执行 / auto-review 接诊断 (5210ccbe0cb)
- 📚 Docs:登记号池↔ZCode 签到桥收尾两格(uid 键源影子行 + 生产腿首跑待验) (69a755ab7de)
- 🐞 Fix:删 tag 同趟摘 refs-manifest,堵守护缺-ref自愈把冗余 tag 回灌(实测8分钟回灌8759枚) (e3f5dae75e0)
- 🐞 Fix:修 5 个 relay 脚本存量类型错误(全量 typecheck 收敛真绿) (b0c7bd703cc)
- 🐞 Fix:OTA 发布四项遗留收口(-m 短旗/--clear-cache/健康探测落点/登录错误本地化) (e57e76d3f34)
- 🐞 Fix:剔除提交已在 remote-tracking refs 的一批,堵 8087 枚 tag 删后 15 分钟回灌;补回 enabled 形参与 A16 await (53d26ccfc96)
- 🐞 Fix:goal iterate 把判据写错说成"崩溃" —— 用户输入错误不该走 crash handler (d7ed1afb179)
- 🔧 Chore/Other:修正 F-327 漏改的 outstanding 断言并补回收链路证据 (4bbd88877d8)
- 🐞 Fix:解摘档接上「能再取凭据」判据 + 探针拆平台/本行续期两列 (cf11dc304f3)
- 🚀 Feature/Improvement:ralph-loop 闭环 —— 把 goal-loop 与真实 runToolLoop 组合，并给出 CLI 入口 (952993dc759)
- 🚀 Feature/Improvement:财务部板块 Taro 镜像页(RP-46 收尾) - pkg-user/finance-ai-hub 镜像页(gen-miniapp-mirror 生成,文案骨架镜像共享屏 i18n 键) - app.config.ts 注册 finance-ai-hub/index - 五语词包复制(mobile-rn→miniapp-taro,零新译) + b64/manifest 派生 - cross-end-screen-registry 登记(shared/rn/miniapp 三端) - Taro 生成器 --apply applied=8 refused=0;ui-p0-shim 测试回归 9/9 绿 - 走 object-space-land:共享索引被并发 README 污染,commit-msg 反复未判定 (ffd5ca9949e)
- 🚀 Feature/Improvement:mobile-rn 五语词包补 financeAi 键组(RP-46 镜像前置) - 5 语各 +73 行纯新增 financeAi 块(生成器读 HEAD 面,故须先落库) - 上一枚 178d73f4 漏提交 mobile-rn 词包(只提交了 apps/locales) - 走 object-space-land:共享索引被并发 README 污染,commit-msg 阶段反复未判定 (c56b6404c5b)
- 🚀 Feature/Improvement:实现 5 项 crate 能力并为每项建出真实消费方 (f6eff6a4614)
- 🚀 Feature/Improvement:财务部板块 RN/共享屏镜像(RP-46,机主授权 takeover_full 推翻 admin/** 豁免) - packages/app 共享屏 FinanceAiHubScreen(纯展示 props 注入)+ finance-ai-styles - RN 壳 FinanceAiHubScreen:草稿态 + 组结构化指令 + 唤起 Chat(autoSendPrompt,非空壳) - RootNavigator 注册 FinanceAi 路由 + 生成伴生件 ui-routes.generated.ts - barrel 导出;两端 tsc --noEmit 0 错误;i18n 重复命名空间门 EXIT=0 (178d73f4f73)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (a102680a5fd)
- 🚀 Feature/Improvement:新增 --bundle-archive 冷归档唯一备份 tag(写后双验 + --if-changed 零写入) (33d4fb42411)
- 📚 Docs:重生统计块数字对齐 HEAD 现算值 (c75ed05fae9)
- 📚 Docs:刷新生成块到 HEAD 面现算值(21188/5113/ws43) (37854cc0805)
- 🔧 Chore/Other:新增 --prune-redundant 复位冗余 lost-commit tag(默认 dry-run + --apply) (35483c3eb63)
- 📚 Docs:刷新生成块 trackedFiles 到 HEAD 面现算值(21186) (76cd998d23d)
- 🐞 Fix:补齐 relay-probe-pool-health.ts 溯源水印 HEAD 面欠账 (2e94f8ce2e6)
- 🐞 Fix:F-242 参数覆盖规则加 30s 进程内缓存+失效; F-243 非主库默认隔离队列 (7d5d4ec1194)
- 🐞 Fix:F-241 组邀请码原子占用,杜绝并发双兑换 TOCTOU (498de981f71)
- 🚀 Feature/Improvement:接通两处断链 —— cost-approval 进预算闸、listWakeableTurns 进 turn/parked (1b2184d99fd)
- 🔧 Chore/Other:结清 API F300-499/F500+ 两段 agent 交付的 26 张工单(23 commit 核验 + 3 源码直读核验) (c96bc426eed)
- 🐞 Fix:号池通道三处根因修复(模型清单 401 + 首帧时序 + 服务端缓冲) (4333d203505)
- 🐞 Fix:F-613 Redis 黑名单改每 IP 单键 SET EX,成员级 TTL 不再冲突 (87aa17f52f1)
- 🐞 Fix:F-611 api-logger 用在途 Promise 替代布尔互斥,onClose 补一轮 flush (360fa9d830b)
- 🐞 Fix:F-597 UGC 敏感词过滤整请求只取一次词表,消除 N+1 (72d8fff690e)
- 🔧 Chore/Other:结清 30 张并发 agent 已修复但漏勾的工单(双通道核验) (e575dcf8094)
- 🐞 Fix:F-487 用户组列表与成员列表收敛到属主/成员 (5d0f195d9d4)
- 🐞 Fix:F-341 下载统计日界显式按上海时区截断 (8b3ca2083c1)
- 🐞 Fix:F-440 browser 页面缓存与响应体双重限界 (e1b85f1cf6d)
- 🐞 Fix:F-437 剧情内存态限界且同 id 不再覆盖，title/id 加上限 (5385ca3dc14)
- 🐞 Fix:F-409 兜底校准回填 tokenQuantity 并按真实补建数统计 (381429c95ce)
- 🐞 Fix:F-327 scanLeaks 只标记不删 outstanding，forceRelease 可真正回收 (610bbc9b38a)
- 🐞 Fix:F-610 threat-detector 两个 Map 加硬上限兜底防 OOM (f86c21685ae)
- 🐞 Fix:F-596 验证码校验补 expiresAt 过期判断 (0cf9912eca1)
- 🐞 Fix:F-586 智能体购买判定加 active 与未过期条件 (5303771513a)
- 🐞 Fix:F-571 acceptAnswer 校验回答 status,软删回答不可采纳 (443c5907d94)
- 🐞 Fix:F-502 学习心跳 duration 设上限并封顶累加,防 integer 溢出 (2486ff542f7)
- 🐞 Fix:F-500 ai-ext 插件白名单改 url 后缀匹配,不再全退化 admin (cb9273d59f4)
- 📚 Docs:刷新生成块数字到 HEAD 面现算值(21184/5112) (b4657a2d779)
- 🐞 Fix:F-060 WorkBuddy 会话 Cookie 不出 Rust——probe 回包剥离 cookie,入库改 Rust 现读直投后端 (b83539f2ba0)
- 🔧 Chore/Other:结清 API F001-299 段 14 张工单(12 张 agent 修复 + F-83 本次补齐 + F-290 已收口) (9c1c70e95ce)
- 📚 Docs:刷新生成块 testFiles/trackedFiles 到 HEAD 现算值(5109/21180) (b96aa6a4b8d)
- 🐞 Fix:F-83 支付/退款/发票抬头/发票申请列表排序补 createdAt 决胜键(不再按随机 UUID v4 乱序) (6e0bfb42bbe)
- 🐞 Fix:F-497 全量 upsert 失败抛错，不再让 BullMQ 记 completed (b1a875bbb7d)
- 🐞 Fix:F-478 活动过期改单条集合 UPDATE 消除 N+1 (0fa3f22a122)
- 🐞 Fix:F-477 design 降级存储按键数与条数双重限界 (5d5611e883a)
- 🐞 Fix:F-464 发货补 UUID 闸、仅已支付可发货且不覆盖原备注 (86c70d29026)
- 🐞 Fix:F-456 退款审核 action 改 zod enum 运行时校验 (3560883b739)
- 🐞 Fix:F-446 任务手动执行未接入返回 501 且不再写假成功日志 (c91214abe0e)
- 🐞 Fix:F-439 模型完成未接入上游显式标记 stub，不再伪装真实输出 (a96f42df004)
- 🐞 Fix:F-438 内部/自定义渠道未接入投递不再上报 sent:true (247a3d13e3f)
- 🐞 Fix:F-357 findMyMember 排除过期 VIP 并按到期时间判 hasVip (468423db890)
- 🐞 Fix:F-356 四处分页补 id 全序兜底 (b6bb2faed7a)
- 🐞 Fix:F-344 实时流量快照缓存与 in-flight 按 source 分键 (b7f45ba6ef4)
- 🐞 Fix:F-338/F-339 恢复探测排除手工停用 Key 并按巡检时间轮转 (3a94d3dc16e)
- 🐞 Fix:DB-09 差值棘轮接入 CI + 存量认账 baseline (ec342b04322)
- 🐞 Fix:F-283 octet 上传路由显式声明 bodyLimit，2~100MiB 不再被全局 2MiB 静默 413 (c683f2dfe1d)
- 🐞 Fix:F-291 SSE 缓冲淘汰流时清理待释放定时器 (4d25daaeab2)
- 🐞 Fix:F-250/F-251 AI 世界列表 count 与 list 同条件、详情与分类补 status=1 (be6594d57d5)
- 🐞 Fix:F-177 资讯推荐/排行批量取文章补 status=1，下架稿不再被推荐 (69ae61b217d)
- 🐞 Fix:F-604 Openclaw 详情补 status 过滤 (cf899f92e93)
- 🐞 Fix:F-604 MCP 详情补 status 过滤 (fb61051a17f)
- 🐞 Fix:F-595 AI Feed 详情补发布态过滤 (7421aa20e25)
- 🐞 Fix:F-642 admin-sys 分页参数夹取,防负值/超大 OFFSET (3373236dc0c)
- 🐞 Fix:F-615 isPrivateIp 补 172.16/12 与 IPv6 ULA/link-local (10e932cf91e)
- 🐞 Fix:F-622 出网代理装配日志脱敏,不落账密 (79749904119)
- 🐞 Fix:F-546 分片合并校验 etag 格式与 parts 上限(防 XML 注入) (ba1db63e611)
- 🐞 Fix:F-590 计费组回退默认组时补 enabled 校验 (8ea0ed78904)
- 📚 Docs:标注两处「判据完整但未接线」的模块,避免被当成已有能力 (ed1753c78d9)
- 🐞 Fix:F-383/F-476 风控命中按主体索引且批量落库 (9ff58827fc6)
- 🐞 Fix:F-328 终止命令改绝对路径/POSIX 内核信号，不走 PATH 裸名 (5a67e7a0c89)
- 🐞 Fix:F-325/F-326 关停 close 复用 in-flight 且超时计时器不再 unref (ac4ac631818)
- 🐞 Fix:F-318 访问来源分组 cap 前按 pv 降序排序 (227793b746f)
- 🐞 Fix:F-312 登录异常通知仅在送达后写去重键并限制内存降级表 (040509eeb9a)
- 🐞 Fix:F-308 阶梯定价未达最低档门槛时按原价计费 (9f114ad6cdd)
- 🚀 Feature/Improvement:全局对话框接入个人号池通道 + 根因修 WS 全族租户闸 401 (4a004892616)
- 🔧 Chore/Other:员工请假端到端联调转 CI 契约回归测试(HR-3 固化防回归) (ab55a054849)
- 🐞 Fix:F-98 文章详情仅返回已发布稿件，草稿/下线返回 404 且不计浏览 (a7ba9ce514c)
- 🐞 Fix:F-90 rerank 兜底 token 估算计入 documents，杜绝系统性少计费 (5213a432dd3)
- 🐞 Fix:F-82 ensureMargin 改 onConflictDoNothing，并发首充不再 500 (e1f08a8eab9)
- 🐞 Fix:F-81 短信接码快照归日统一上海时区，消除 8 小时错位与重复入库 (5555ded60a9)
- 🐞 Fix:F-75 xss 请求体净化改挂 preValidation，body 已解析才生效 (1d8caab4008)
- 🐞 Fix:F-25 /v1/assistants 游标排序补 id 决胜键，跨页不再重复漏行 (86676d31a11)
- 🐞 Fix:F-15 邀请码占用改为条件 UPDATE 抢占，杜绝并发双发奖励 (66f75db8d97)
- 🔧 Chore/Other:M26 快照棘轮更新 —— 25 键考古实证合法删行后重建行键快照 (fa8120cde97)
- 🔧 Chore/Other:结清 51 张源码修复注释已在 HEAD 但未勾选的工单(AIS/API/CLI 族) (ac001147945)
- 🔧 Chore/Other:结清 API F-398(schema 与迁移已对齐 uniqueIndex,27cff4fa99a) (313bcd526f9)
- 🐞 Fix:DB-09 补齐 0371 快照(重基线含 shared_to_ops,快照门新增违规 65→16) (aa3d15a53db)
- 🐞 Fix:重迁 425ae8286fc 回灌的裸 git —— staging-snapshot 五处 + rn-compat 两处走 gitRaw (66bc4964ae7)
- 🔧 Chore/Other:结清 43 张已修复漏勾工单(API/CLI/AIS 族,修复 commit 均在 HEAD 祖先) (1b31ee7b93a)
- 🚀 Feature/Improvement:把回合运行态接进真实执行流 —— 不再是可调用但没人调的 API (5490760598f)
- 🐞 Fix:7 文件裸 git 派生收口到统一承载层 face-reader (42b77be0b0d)
- 🐞 Fix:收口推门 typecheck 红——4 个运维护脚本的 strict 空值/联合收窄 (442b5fe7598)
- 📚 Docs:重生 README 数字生成块对齐 HEAD 现算值(过 DN2 push 门) (f4e66811685)
- 🐞 Fix:闭环 APK 降级误判 — 判据可信闸门 + 补回被覆盖的双写判据 + OTA 腿 fail-closed (ce1dd22efaf)
- 🐞 Fix:本机即生产本地模式与任务状态枚举误译修正 (1393201a361)
- 📚 Docs:结清 F-20/F-23(业务日区间与退款分值) (584a4a4c207)
- 🐞 Fix:结清 F-20/F-23——业务日区间按上海日界、退款金额先取整成"分" (d3afc268d99)
- 🚀 Feature/Improvement:补连长任务闭环 —— 回合状态机 + 合成结束 + 挂起唤醒 + 目标态 (0b081f47846)
- 🐞 Fix:迁移回填语句改写为合法 SQL 并登记 journal(HR-3 第2期收尾) (4887fa97901)
- 📚 Docs:结清 AIS-063/064/077、F-123/130/132/143 七张缺陷票 (dded71b6085)
- 🔧 Chore/Other:结清 F-015/F-028/F-093/F-126 四张缺陷普查工单 (ef57a14f75a)
- 🐞 Fix:--status 穿透静默 VBS 包装验内层命令 + 号池全量互通口径落库 (dfe8356621a)
- 🐞 Fix:结清 F-015/F-028/F-093/F-126 —— serve 退出码不再截断管道输出,凭据原子写钉 0600,TERM 黑名单补 emacs/eterm/vscode,读缓存补 ctime+inode 判据 (49613c3a9eb)
- 🐞 Fix:结清 F-130——已支付/已退款订单禁止物理删除 (4c17897acfe)
- 🚀 Feature/Improvement:新增迁移把 shared_to_ops 列默认值收口为 true (69d322a3999)
- 🐞 Fix:结清 F-123——GitHub Trending 采集先收集再逐条 await 落库 (2619cbebf4d)
- 🔧 Chore/Other:还原被 F-143 提交误带的 automation-card 改动 (eb63144e700)
- 🔧 Chore/Other:docs+test(relay-pool): zcode 显式声明不可续期 + 2026-11-12 桌面端取证复核落档 (e08e63d850a)
- 🔧 Chore/Other:docs+test(relay-pool): zcode 显式声明不可续期 + 2026-11-12 桌面端取证复核落档 (a84606f5bee)
- 📚 Docs:Y-37 二次诊断——裸域超时根因是CF橙云跨境回源非隧道协议,定方案B(EdgeOne补裸域证书+CF改回源),修正验收口径 (a7541cee39b)
- 🐞 Fix:号池两枚「死号」实为活号 —— doubao ttwid 键名误配 + workbuddy global realm 误判 (9c2a2d3b0b3)
- 🐞 Fix:结清 F-143——直播回调去重标记改为"成功后才落" (d1c62d5339f)
- 🔧 Chore/Other:结清 F-061/F-104 两张缺陷普查工单 (86b8c353188)
- 🐞 Fix:结清 F-061/F-104 —— 剪贴板写权限只补本地 webview,operator 执行改一次性票据+原生确认 (32450a474e9)
- 🐞 Fix:结清 F-132——POST /admin/users 请求契约自洽(统一为 password) (4a922df5d37)
- 🔧 Chore/Other:结清 F-004/F-005/F-048/F-070/F-074/F-080/F-085/F-095/F-098/F-101/F-102/F-123/F-136 十三张缺陷普查工单 (d8451578486)
- 🐞 Fix:结清 F-004/F-048/F-085/F-123/F-136 五张缺陷普查工单并补 F-005 回归钉 (280d5beca2e)
- 🐞 Fix:审批实例快照固化扩到代理/超时时限/升级目标全四件套(HR-3 第2期) (7dc3a322e75)
- 🐞 Fix:结清 AIS-077——知识卡片按属主收口,堵跨租户读/覆盖 (8218b28795b)
- 🔧 Chore/Other:结清 F-040/F-064/F-065/F-066/F-067/F-072/F-081/F-082/F-083/F-084/F-086/F-097/F-124/F-125 十四张工单 (6a3655c3ff7)
- 🐞 Fix:结清 F-040/F-064/F-065/F-066/F-067/F-072/F-081/F-082/F-083/F-084/F-086/F-097/F-124/F-125 十四张缺陷普查工单 (67985a18894)
- 📚 Docs:登记公网抖动观察待办——Cloudflared 已换 http2,观察 24-48h 再定是否动监控判据 (5a6bf203200)
- 🐞 Fix:结清 AIS-064——审批等待与串行工具执行纳入中断链 (30a366ca626)
- 🐞 Fix:根治 OTA 不可达 — 显式钉死 updates.enabled 并把 prebuild 固化进出包链 (246ea6c2830)
- 🔧 Chore/Other:三条回灌腿双形态传参面补回归锁(tsx 侧行为直测+壳侧接线锁) (9badf79cf63)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (ab2ff127e8e)
- 🐞 Fix:跨环境同步按 email 翻译号池归属,根治 owner_user_id 悬空互推 (e5e2b5d6377)
- 🚀 Feature/Improvement:补 loomy/zcode/raccoon 客户端会话定时回捞腿,彻底永久保活 (c7c62ad7ede)
- 🔧 Chore/Other:补录 tauri.localdev-cdp.json 删除意图通知书(旁路删除硬门) (978a160fde1)
- 🔧 Chore/Other:结清 F-079/F-120/F-121/F-122/F-129/F-130/F-131/F-132/F-133/F-134/F-135/F-137/F-138/F-139 十四张工单 (b439fbd2ba4)
- 🐞 Fix:同步 README 数字生成块到 HEAD 现算值(push 门 DN2;活文档闸对生成块值变更结构性误报,走官方留痕出口) (c42d0cd141d)
- 🐞 Fix:结清 F-079/F-120/F-121/F-122/F-129/F-130/F-131/F-132/F-133/F-134/F-135/F-137/F-138/F-139 十四张缺陷普查工单 (9870f310432)
- 🐞 Fix:审批超时升级扫到 escalated 态,治已升级实例到点未决永久卡死 (d3e9c2d3110)
- 🔧 Chore/Other:结清 F-010/F-011/F-017/F-018/F-039/F-043/F-044/F-071/F-076/F-078/F-127/F-128 十二张工单 (85fe00904ec)
- 🐞 Fix:结清 F-010/F-011/F-017/F-018/F-039/F-043/F-044/F-071/F-076/F-078/F-127/F-128 十二张缺陷普查工单 (8ab82c6d32b)
- 🔧 Chore/Other:p1-evidence-gaps F-003 结构锁跟上 kill-tree.ts 收敛 (9d03ad51c6d)
- 🔧 Chore/Other:结清 API F-106(本次已修 f4fe4c8bfca) (b06d1659263)
- 🐞 Fix:F-121 playground compare 全模型失败退非零(--json 与人读两路同口径) (9f447cd2fe0)
- 🐞 Fix:F-120 report 输入加 64MB 上限,覆盖前留 .bak 并改原子写 (67f22970989)
- 🐞 Fix:F-485 FAQ 排序补主键兜底且创建侧接受 sortOrder (c42c49de4de)
- 🐞 Fix:F-483 评论列表 offset 直传 / F-484 点赞关注目标存在性校验 (29eee95a58c)
- 🐞 Fix:F-481 协议查询限定已到生效日的记录 (eccd0d80b9b)
- 🐞 Fix:F-480 公开轮播按 startAt/endAt 投放窗口过滤 (e5943359c81)
- 🐞 Fix:F-131 plan init 改原子写,--force 覆盖前留 .bak 备份 (2a59557fafe)
- 🐞 Fix:F-139 hunk 越界判据按首段恰为 '..',误拒 ..env 等合法文件名 (c3bf12b4734)
- 📚 Docs:README 生成块数字对账 testFiles 5061->5065 / trackedFiles 21121->21126(归并带入 4 个新测试文件,DN5) (e4e667c2e30)
- 🐞 Fix:F-067 编辑器审批请求加 60s 超时;F-066 closeSession 先中止在飞 prompt (05529b111d5)
- 🐞 Fix:F-299 /v1/responses 补挂 requireApiKeyQuota，Key 级小时/天配额生效 (7a32bd514bd)
- 🐞 Fix:F-294 鉴权层归一识别 max_output_tokens，堵 Responses 端 maxTokensPerReq/TPM 绕过 (1a05c5ba3bd)
- 🐞 Fix:F-066 ACP closeSession/SIGINT 先中止在飞 prompt 再关闭,信号带 130/143 退出码 (b3a863b54a7)
- 🐞 Fix:AIS-067/070 + 003 网关侧:原生 complete 先判业务错误再记账,号池重试加错误过滤与退避,原生流正常耗尽补合成 done 终帧 (dbe128ddb12)
- 🐞 Fix:F-523 registry 两个生产者 Queue 补 onClose 关闭出口 (31763cc2251)
- 🐞 Fix:F-521/F-522 补算法备案与边缘探测的对称关停相 (6a54aac1e75)
- 🐞 Fix:F-548 大 xlsx 列数统计改 reduce,规避 Math.max 展开参数溢出 (6d64363dd90)
- 🐞 Fix:F-530 repoName 写入侧统一 trim,与读取侧归一化对齐 (cbe85b19b27)
- 🐞 Fix:F-539 relay 会话/消息分页排序补主键 tie-breaker (2b1446f27dc)
- 🐞 Fix:F-525 会话导入去重条件补 collectionName,换集合导入不再被静默判重 (70886790177)
- 🔧 Chore/Other:F-106 回归——比对本人声纹成功扣分 + 他人 voiceId 403 不扣分 (e94837bfe4d)
- 🐞 Fix:F-545/F-547 OSS callOss 与腾讯云/AWS STS fetch 加超时、判状态、错误体截断 (d02b64cdb6c)
- 🐞 Fix:F-543/F-544 转码取消只对未完成任务生效;stderr 尾部限长消除 O(n²) 扫描 (4a676d7a033)
- 🐞 Fix:F-541 单元格地址校验收敛到 xlsx 规格(16384 列 × 1048576 行) (50c2cc44ebf)
- 🐞 Fix:F-505 直播 by-ids 逐项 uuid 校验,非法 id 400 而非 22P02 裸 500 (d67d690f5d3)
- 🐞 Fix:F-471 提现 method 上限对齐列宽 16 (c589373a321)
- 🐞 Fix:F-470 /ai/users 手机号上限对齐列宽 20 (8550e358d2f)
- 🐞 Fix:F-469 素材 file_url 上限对齐列宽 500 (3b5a0428bfc)
- 🐞 Fix:F-468 视频任务 taskId 上限对齐列宽 36 (97a573f32d2)
- 🐞 Fix:F-463 角色用户解绑 roleId 补 uuid 闸 (942bae3f86a)
- 🐞 Fix:F-460/F-462 maskIdCard 短值 RangeError 与 maskPhone 短号泄漏 (7aa8f17591b)
- 🐞 Fix:F-459 发票更新 userId 收紧 uuid 校验 (8a01f5b2bfd)
- 🐞 Fix:F-106 声纹属主隔离——register 盖章 u{userId}_ 前缀、list 过滤、compare/delete 属主校验(免迁移方案) (f4fe4c8bfca)
- 🐞 Fix:AIS-069 混元原生流累积并透传 tool_calls 与 finish_reason (530d5ca3475)
- 🐞 Fix:AIS-068 OpenAI/Anthropic 原生流识别 error 帧并上抛,不再静默空 done (3a2041fbdb1)
- 🐞 Fix:AIS-065 原生 complete 空 choices 抛 ProviderError 进 fallback,不再 IndexError/静默空回复 (311a622e12d)
- 🐞 Fix:F-065 同会话并发回合按会话串行排队,abort 存集合 cancel 全中止 (01e911ed457)
- 📚 Docs:README 生成块数字对账 testFiles 5059->5061 / trackedFiles 21119->21121(本轮新增 2 个测试文件,DN5 清单不变式) (095390b0f68)
- 🐞 Fix:共享 tsconfig 基座改动不得走无 TS 输入面档 (6649fbc21fc)
- 🐞 Fix:F-426/F-427 /v1/agents 分页全序排序 + call 端点补 UUID 闸 (4d3506e9e27)
- 🐞 Fix:F-425 admin-api-platform 七处 :id 收紧为 uuid 形状闸 (9ff0b0fb879)
- 🐞 Fix:F-425 workspace :id 收紧为 uuid 形状闸 (09a834e87b6)
- 🐞 Fix:F-429 API Key 更新/删除接入 2FA step-up (c625965fd80)
- 🐞 Fix:F-391 创建 API Key 与充值补 2FA step-up 闸 (3f3f613d01a)
- 🐞 Fix:F-064/F-137 HTTP /message 请求体加 1MB 字节闸回 413、SSE 背压中止、显式 server 超时 (bbbe0fd2c00)
- 🐞 Fix:同步 README 文档数字生成块到当前 HEAD 现算值 (7383bdb0da2)
- 🐞 Fix:补齐共享基座 packages/tsconfig/base.json 的 node_modules.* 防线 (ff2c5dc0055)
- 🔧 Chore/Other:补 f-101-102 测试溯源水印——commit-tree 绕过 pre-commit 落地漏注入,47p 水印门按 HEAD blob 判未覆盖 (2835d4b542b)
- 🔧 Chore/Other:结清 CLI F-119(本次已修 b682c7b9f76) (d2421b3d7f2)
- 🐞 Fix:F-119 share includeFiles=false 改为真实过滤工具结果消息(不再只追加省略文案) (b682c7b9f76)
- 🔧 Chore/Other:隔离 Ghidra headless 工作目录 (87c8342df74)
- 🔧 Chore/Other:结清 F-019/F-034/F-035/F-052/F-105/F-106 六张缺陷普查工单 (7f49095906a)
- 🐞 Fix:结清 F-019/F-034/F-035/F-052/F-105/F-106 六张缺陷普查工单 (56943ec8754)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (a7a8a41d2e2)
- 🔧 Chore/Other:结清 API 5 张已修工单(F-119/147/165/180/181,源码含修复标记) (bcd270a2a5a)
- 🐞 Fix:RouteParamSpec 补 items/properties 递归映射 + spec-drift 收编 AI_TASK_TEMPLATE_TOOLS (4d9649c7039)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (29fcde08e76)
- 🔧 Chore/Other:结清 AIS-019(已修 e12f8a9550,属主下推收窄) (7c2775a800a)
- 🔧 Chore/Other:结清 9 张已修复漏勾工单(F-118,AIS-006/015/016/026/044/059/078/087) (2ef1687cfe3)
- 🔧 Chore/Other:结清 AIS 族 4 张已修工单(AIS-066/072/075/076) (0d6a51ffed1)
- 🐞 Fix:同步 README 文档数字生成块到当前 HEAD 现算值 (ae84ca0132a)
- 🐞 Fix:embed-types 支持 @ihui/types 内部传递引用,修掉 pre-push typecheck 门 (3987084c9d9)
- 🐞 Fix:把 node_modules.* 兄弟目录的防线补齐到全部 19 个 tsconfig + .gitignore (edb7ce7a33d)
- 🔧 Chore/Other:结清 F-099/F-109/F-111/F-118 四张缺陷普查工单 (ac614afb4d3)
- 🐞 Fix:结清 F-095/F-099/F-101/F-102/F-109/F-111/F-118 七张缺陷普查工单(后四张为回归钉补钉) (d0e2ab55f87)
- 🔧 Chore/Other:派生产物按归并 HEAD 面重生成(be4abab323)—— web/miniapp ui-routes 补 finance-ai 路由输入哈希 (e2d4f59270a)
- 🐞 Fix:补 F-070 卸载 registry 前置闸真实缺口 + 补交 f-070/f-101-102 验收测试 (09ccdc45b5a)
- 🔧 Chore/Other:结清 F-049/F-050/F-051/F-055/F-057/F-059/F-108/F-110 八张缺陷普查工单 (1979716b829)
- 🐞 Fix:结清 F-049/F-050/F-051/F-055/F-057/F-059/F-108/F-110 八张缺陷普查工单 (e9c1ed47a81)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (184452a399d)

**2026-11-12**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (ab2ff127e8)
- 🐞 Fix:跨环境同步按 email 翻译号池归属,根治 owner_user_id 悬空互推 (e5e2b5d637)
- 🚀 Feature/Improvement:补 loomy/zcode/raccoon 客户端会话定时回捞腿,彻底永久保活 (c7c62ad7ed)
- 🔧 Chore/Other:补录 tauri.localdev-cdp.json 删除意图通知书(旁路删除硬门) (978a160fde)
- 🔧 Chore/Other:结清 F-079/F-120/F-121/F-122/F-129/F-130/F-131/F-132/F-133/F-134/F-135/F-137/F-138/F-139 十四张工单 (b439fbd2ba)
- 🐞 Fix:同步 README 数字生成块到 HEAD 现算值(push 门 DN2;活文档闸对生成块值变更结构性误报,走官方留痕出口) (c42d0cd141)
- 🐞 Fix:结清 F-079/F-120/F-121/F-122/F-129/F-130/F-131/F-132/F-133/F-134/F-135/F-137/F-138/F-139 十四张缺陷普查工单 (9870f31043)
- 🔧 Chore/Other:结清 F-010/F-011/F-017/F-018/F-039/F-043/F-044/F-071/F-076/F-078/F-127/F-128 十二张工单 (85fe00904e)
- 🐞 Fix:结清 F-010/F-011/F-017/F-018/F-039/F-043/F-044/F-071/F-076/F-078/F-127/F-128 十二张缺陷普查工单 (8ab82c6d32)
- 🔧 Chore/Other:p1-evidence-gaps F-003 结构锁跟上 kill-tree.ts 收敛 (9d03ad51c6)
- 🔧 Chore/Other:结清 API F-106(本次已修 f4fe4c8bfca) (b06d165926)
- 🐞 Fix:F-121 playground compare 全模型失败退非零(--json 与人读两路同口径) (9f447cd2fe)
- 🐞 Fix:F-120 report 输入加 64MB 上限,覆盖前留 .bak 并改原子写 (67f2297098)
- 🐞 Fix:F-485 FAQ 排序补主键兜底且创建侧接受 sortOrder (c42c49de4d)
- 🐞 Fix:F-483 评论列表 offset 直传 / F-484 点赞关注目标存在性校验 (29eee95a58)
- 🐞 Fix:F-481 协议查询限定已到生效日的记录 (eccd0d80b9)
- 🐞 Fix:F-480 公开轮播按 startAt/endAt 投放窗口过滤 (e5943359c8)
- 🐞 Fix:F-131 plan init 改原子写,--force 覆盖前留 .bak 备份 (2a59557faf)
- 🐞 Fix:F-139 hunk 越界判据按首段恰为 '..',误拒 ..env 等合法文件名 (c3bf12b473)
- 📚 Docs:README 生成块数字对账 testFiles 5061->5065 / trackedFiles 21121->21126(归并带入 4 个新测试文件,DN5) (e4e667c2e3)
- 🐞 Fix:F-067 编辑器审批请求加 60s 超时;F-066 closeSession 先中止在飞 prompt (05529b111d)
- 🐞 Fix:F-299 /v1/responses 补挂 requireApiKeyQuota，Key 级小时/天配额生效 (7a32bd514b)
- 🐞 Fix:F-294 鉴权层归一识别 max_output_tokens，堵 Responses 端 maxTokensPerReq/TPM 绕过 (1a05c5ba3b)
- 🐞 Fix:F-066 ACP closeSession/SIGINT 先中止在飞 prompt 再关闭,信号带 130/143 退出码 (b3a863b54a)
- 🐞 Fix:AIS-067/070 + 003 网关侧:原生 complete 先判业务错误再记账,号池重试加错误过滤与退避,原生流正常耗尽补合成 done 终帧 (dbe128ddb1)
- 🐞 Fix:F-523 registry 两个生产者 Queue 补 onClose 关闭出口 (31763cc225)
- 🐞 Fix:F-521/F-522 补算法备案与边缘探测的对称关停相 (6a54aac1e7)
- 🐞 Fix:F-548 大 xlsx 列数统计改 reduce,规避 Math.max 展开参数溢出 (6d64363dd9)
- 🐞 Fix:F-530 repoName 写入侧统一 trim,与读取侧归一化对齐 (cbe85b19b2)
- 🐞 Fix:F-539 relay 会话/消息分页排序补主键 tie-breaker (2b1446f27d)
- 🐞 Fix:F-525 会话导入去重条件补 collectionName,换集合导入不再被静默判重 (7088679017)
- 🔧 Chore/Other:F-106 回归——比对本人声纹成功扣分 + 他人 voiceId 403 不扣分 (e94837bfe4)
- 🐞 Fix:F-545/F-547 OSS callOss 与腾讯云/AWS STS fetch 加超时、判状态、错误体截断 (d02b64cdb6)
- 🐞 Fix:F-543/F-544 转码取消只对未完成任务生效;stderr 尾部限长消除 O(n²) 扫描 (4a676d7a03)
- 🐞 Fix:F-541 单元格地址校验收敛到 xlsx 规格(16384 列 × 1048576 行) (50c2cc44eb)
- 🐞 Fix:F-505 直播 by-ids 逐项 uuid 校验,非法 id 400 而非 22P02 裸 500 (d67d690f5d)
- 🐞 Fix:F-471 提现 method 上限对齐列宽 16 (c589373a32)
- 🐞 Fix:F-470 /ai/users 手机号上限对齐列宽 20 (8550e358d2)
- 🐞 Fix:F-469 素材 file_url 上限对齐列宽 500 (3b5a0428bf)
- 🐞 Fix:F-468 视频任务 taskId 上限对齐列宽 36 (97a573f32d)
- 🐞 Fix:F-463 角色用户解绑 roleId 补 uuid 闸 (942bae3f86)
- 🐞 Fix:F-460/F-462 maskIdCard 短值 RangeError 与 maskPhone 短号泄漏 (7aa8f17591)
- 🐞 Fix:F-459 发票更新 userId 收紧 uuid 校验 (8a01f5b2bf)
- 🐞 Fix:F-106 声纹属主隔离——register 盖章 u{userId}_ 前缀、list 过滤、compare/delete 属主校验(免迁移方案) (f4fe4c8bfc)
- 🐞 Fix:AIS-069 混元原生流累积并透传 tool_calls 与 finish_reason (530d5ca347)
- 🐞 Fix:AIS-068 OpenAI/Anthropic 原生流识别 error 帧并上抛,不再静默空 done (3a2041fbdb)
- 🐞 Fix:AIS-065 原生 complete 空 choices 抛 ProviderError 进 fallback,不再 IndexError/静默空回复 (311a622e12)
- 🐞 Fix:F-065 同会话并发回合按会话串行排队,abort 存集合 cancel 全中止 (01e911ed45)
- 📚 Docs:README 生成块数字对账 testFiles 5059->5061 / trackedFiles 21119->21121(本轮新增 2 个测试文件,DN5 清单不变式) (095390b0f6)
- 🐞 Fix:共享 tsconfig 基座改动不得走无 TS 输入面档 (6649fbc21f)
- 🐞 Fix:F-426/F-427 /v1/agents 分页全序排序 + call 端点补 UUID 闸 (4d3506e9e2)
- 🐞 Fix:F-425 admin-api-platform 七处 :id 收紧为 uuid 形状闸 (9ff0b0fb87)
- 🐞 Fix:F-425 workspace :id 收紧为 uuid 形状闸 (09a834e87b)
- 🐞 Fix:F-429 API Key 更新/删除接入 2FA step-up (c625965fd8)
- 🐞 Fix:F-391 创建 API Key 与充值补 2FA step-up 闸 (3f3f613d01)
- 🐞 Fix:F-064/F-137 HTTP /message 请求体加 1MB 字节闸回 413、SSE 背压中止、显式 server 超时 (bbbe0fd2c0)
- 🐞 Fix:同步 README 文档数字生成块到当前 HEAD 现算值 (7383bdb0da)
- 🐞 Fix:补齐共享基座 packages/tsconfig/base.json 的 node_modules.* 防线 (ff2c5dc005)
- 🔧 Chore/Other:补 f-101-102 测试溯源水印——commit-tree 绕过 pre-commit 落地漏注入,47p 水印门按 HEAD blob 判未覆盖 (2835d4b542)
- 🔧 Chore/Other:结清 CLI F-119(本次已修 b682c7b9f76) (d2421b3d7f)
- 🐞 Fix:F-119 share includeFiles=false 改为真实过滤工具结果消息(不再只追加省略文案) (b682c7b9f7)
- 🔧 Chore/Other:隔离 Ghidra headless 工作目录 (87c8342df7)
- 🔧 Chore/Other:结清 F-019/F-034/F-035/F-052/F-105/F-106 六张缺陷普查工单 (7f49095906)
- 🐞 Fix:结清 F-019/F-034/F-035/F-052/F-105/F-106 六张缺陷普查工单 (56943ec875)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (a7a8a41d2e)
- 🔧 Chore/Other:结清 API 5 张已修工单(F-119/147/165/180/181,源码含修复标记) (bcd270a2a5)
- 🐞 Fix:RouteParamSpec 补 items/properties 递归映射 + spec-drift 收编 AI_TASK_TEMPLATE_TOOLS (4d9649c703)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (29fcde08e7)
- 🔧 Chore/Other:结清 AIS-019(已修 e12f8a9550,属主下推收窄) (7c2775a800)
- 🔧 Chore/Other:结清 9 张已修复漏勾工单(F-118,AIS-006/015/016/026/044/059/078/087) (2ef1687cfe)
- 🔧 Chore/Other:结清 AIS 族 4 张已修工单(AIS-066/072/075/076) (0d6a51ffed)
- 🐞 Fix:同步 README 文档数字生成块到当前 HEAD 现算值 (ae84ca0132)
- 🐞 Fix:embed-types 支持 @ihui/types 内部传递引用,修掉 pre-push typecheck 门 (3987084c9d)
- 🐞 Fix:把 node_modules.* 兄弟目录的防线补齐到全部 19 个 tsconfig + .gitignore (edb7ce7a33)
- 🔧 Chore/Other:结清 F-099/F-109/F-111/F-118 四张缺陷普查工单 (ac614afb4d)
- 🐞 Fix:结清 F-095/F-099/F-101/F-102/F-109/F-111/F-118 七张缺陷普查工单(后四张为回归钉补钉) (d0e2ab55f8)
- 🔧 Chore/Other:派生产物按归并 HEAD 面重生成(be4abab323)—— web/miniapp ui-routes 补 finance-ai 路由输入哈希 (e2d4f59270)
- 🐞 Fix:补 F-070 卸载 registry 前置闸真实缺口 + 补交 f-070/f-101-102 验收测试 (09ccdc45b5)
- 🔧 Chore/Other:结清 F-049/F-050/F-051/F-055/F-057/F-059/F-108/F-110 八张缺陷普查工单 (1979716b82)
- 🐞 Fix:结清 F-049/F-050/F-051/F-055/F-057/F-059/F-108/F-110 八张缺陷普查工单 (e9c1ed47a8)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (184452a399)

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
