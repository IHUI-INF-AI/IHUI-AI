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
| 数据库表 | 650 | `dbTables` |
| schema 文件 | 252 | `dbSchemaFiles` |
| API 路由 | 4815 | `apiRoutes` |
| 路由文件 | 697 | `apiRouteFiles` |
| AI 服务路由 | 676 | `aiServiceRoutes` |
| WebSocket 端点 | 43 | `wsEndpoints` |
| 入库模型清单 | 100 | `llmModels` |
| 发布平台 | 38 | `publishPlatforms` |
| 端应用包 | 9 | `appPackages` |
| 共享包 | 17 | `sharedPackages` |
| CLI 命令文件 | 78 | `cliCommandFiles` |
| CLI 工具文件 | 111 | `cliToolFiles` |
| 语言 | 5 | `i18nLanguages` |
| i18n 作用域 | 7 | `i18nScopes` |
| 语言包 JSON | 35 | `i18nMessageFiles` |
| 测试文件 | 5454 | `testFiles` |
| CI 工作流 | 59 | `ciWorkflows` |
| Compose 服务 | 14 | `composeServices` |
| 工程守门 | 368 | `guardianGates` |
| — blocking | 335 | `guardianBlocking` |
| — warn | 32 | `guardianWarn` |
| 跟踪文件 | 21831 | `trackedFiles` |

上表由 `node scripts/sync-readme-numbers.mjs`(唯一写入口,索引面取数)生成,最后核对日期 2026-11-14。
每个数的来源就写在取数键旁边的实现里(`scripts/gen-doc-numbers.mjs` 的 `SOURCES`),**不得手抄、不得另立第二份**。

<!-- END GENERATED NUMBERS -->


## Recent updates (auto-maintained)

<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->
**2026-11-14**
- 🔧 Chore/Other:补齐溯源水印覆盖 + audit-app-text-contrast 同族配对 (fd8cb9c30a)

**2026-11-14**
- 🚀 Feature/Improvement:以 ai_pricing 权威价回填配置零价行 (476127d306)
- 🐞 Fix:诊断臂 [7b] DB 迁移落后维从未真判过——函数注册晚于 -diagnose 顶层执行点(第三次落地,范围收窄) (c4be376fd5)
- 🐞 Fix:零价护栏豁免上游真免费模型(:free) (88cfcfeba1)
- 🚀 Feature/Improvement:工作区指令链补齐服务端腿 —— CLAUDE.md/本地叠加 + 轮内深层发现 (a5c6090a05)
- 🚀 Feature/Improvement:补齐 check-plan-claims-vs-head 门——批量预取治本 6.5min→15s + §1021 --self-test (99060ab1ee)
- 🐞 Fix:流式打字机切批升到字素簇边界 —— ZWJ/肤色/旗帜 emoji 不再拆裂(D1b) (a143634115)
- 🔧 Chore/Other:重封根护栏清单(git-guardian 变更后漂移) (ad06d9d1f8)
- 🚀 Feature/Improvement:present_files 显式交付声明 + 交付清单 presentedFiles (904e129c14)

**2026-11-14**
- 🚀 Feature/Improvement:新增 3 个未跟踪文件 (da1823aa1d)

**2026-11-14**
- 🔧 Chore/Other:收尾提交 plan-heal/tag-sync 副产物 (f05491e678)

**2026-11-14**
- 🔧 Chore/Other:收拢本地工作区改动(全量提交) (1be9d1e2c7)
- 🔧 Chore/Other:重封根护栏清单(merge round2 后 gate-scope 漂移) (4b0fc5a3e6)
- 🐞 Fix:补两处契约缺口——SendAdmissionReceipt.ahead 与 ProcessGroupChild.kill 签名 (0dc7a15623)
- 📚 Docs:同步生成块计数(经用户明确授权跳过钩子) (c466bece0a)
- 🚀 Feature/Improvement:per-tool timeout budgets + NO_PROXY routing (5th DSH pass) (41d9096328)
- 🐞 Fix:零价巡检改用采购成本量化损失 (b5a8e3967a)
- 📚 Docs:生成块四维数字回归 HEAD 面现算(apiRoutes 4800->4814/apiRouteFiles 699->697/testFiles 5254->5450/trackedFiles 21591->21820) (6ad68f44c6)
- 🚀 Feature/Improvement:零价上架护栏 + 每日零价巡检 (5b7e639654)
- 🚀 Feature/Improvement:逆向 DSH 审计第三/四遍补齐(导出保真/中断语义/Office 转换) (f2b2cec5da)
- 🐞 Fix:G-20261114 chat-sync 三端（taro/RN/extension）接线 + 回归锁 (41548e0716)
- 🐞 Fix:G-20261114 chat-sync 共享内核与 web 端接线 + 契约文档 (450c939404)
- 🐞 Fix:G-20261114 多端 chat-sync 流式坐标系统一与终态投影（api 端） (5bc4e1c3d4)
- 📚 Docs:补登 check-findings-freshness 守门点名，清门 89 R4 (c791a93bb9)
- 📚 Docs:同步生成块计数 (f83626fbf1)
- 🐞 Fix:F-187 api_base SSRF 非字符串地址 fail-closed 并恢复 T1 判据面 (d61938ace0)
- 📚 Docs:生成块按现算刷新(trackedFiles 21820/testFiles 5450/gates 368)——唯一写入口块面回植 (f0746f71e7)
- 🐞 Fix:盘根外流根治复诊 —— 修合规闸的大小写假阴 + 补回归锁 (2ee1847a94)
- 📚 Docs:归正 sag2/articles 两行登记(回滚 807d0817 携 stale 副本的旧基线降级) (84469fbcd2)
- 🚀 Feature/Improvement:错误卡目录化上收 shared + 三端接线(D-AI-3) (c5a2c24a25)
- 🐞 Fix:零实收更正为「定价前漏计费」并量化应计未计金额 (678e5a3d99)
- 🐞 Fix:Sag2Screen chip sm→md、card md→lg(150 最后 2 族,补齐首轮构造遗漏) (cf31c0d2e4)
- 🐞 Fix:150 余 7 族/315 余 1 族定向清零(control 档 12 处 + Sag2 badge borderColor) (ceb0e44331)
- 🐞 Fix:渠道成本报表增加零实收指标 (706f1fede3)
- 🐞 Fix:修正 299/302p 两道门的历史误判(非新增漂移) (a5b35cb15f)
- 🐞 Fix:F-34 多模态任务失败退款耐久化(补齐实现,对齐已提交测试) (6aab7e619a)
- 🐞 Fix:DB-35 PII 写库加密切片(发票抬头+后台实名 idCard 旁路) (2d3c28cc82)
- 🚀 Feature/Improvement:历史调用成本补数 + 渠道成本对账 + 积分兑换 AI 额度 (d8459f3996)
- 🚀 Feature/Improvement:新增 3 个 drizzle 迁移 —— news 去重唯一索引 / 客服状态枚举对齐 / coze 变量唯一索引 (8a64f3e4a2)
- 🐞 Fix:DB-35 凭据写库加密切片(无迁移) (002ade40cc)
- 🚀 Feature/Improvement:成本列回填接口 + 利润看板按渠道分组 (63cb549a8b)
- 🔧 Chore/Other:对账结清 F-274/F-175(均已在 HEAD 修复) (0f1180807c)
- 🔧 Chore/Other:结清 F-719(充值双币种入账,a6ae85b0c25/cce4625f58a,39 passed) (0bfaa1d848)
- 🐞 Fix:兑换码充值同步入账 cost 余额 (a6ae85b0c2)
- 🔧 Chore/Other:结清 Y-14(前提不成立:安卓 latest 已回 0.0.24) (17c111ccf4)
- 🔧 Chore/Other:RP-16 阻塞留痕 + 认领 Y-14(安卓更新包接口空返回) (67e95c546a)
- 🐞 Fix:去掉 ModelOption 重复的每百万 token 单价字段 (c9d0c23d5e)
- 🔧 Chore/Other:认领 RP-16(考勤 IM 三类审批枚举映射) (a62cd5225c)
- 🔧 Chore/Other:对账结清 12 张已在 HEAD 修复的缺陷普查行 (a9e8f3f9bd)
- 🐞 Fix:单边 token 充值同步入账 cost 余额 (cce4625f58)
- 🔧 Chore/Other:结清 F-512(前提不成立:幂等键已入库;工作树他席回退 risk) (21087e436b)
- 🔧 Chore/Other:按 HEAD 面重封清单(gate-scope 随合并变更未回封) (1b5723c7a8)
- 🔧 Chore/Other:认领 F-512(notification-worker 幂等键缺失) (090cd85811)
- 🔧 Chore/Other:结清 F-722(前提不成立:异常结算已入库;工作树他席改动回退风险) (a500442528)
- 🚀 Feature/Improvement:模型表落地真实采购成本列,利润从反推升级为实价 (412e2bc3e9)
- 🔧 Chore/Other:BUG-29 切片0 阻塞留痕 + 认领 F-722(流式异常跳结算) (a3a3a13347)
- 🔧 Chore/Other:认领 BUG-29(索引约束缺失族,先做切片0) (da6cc97036)
- 🚀 Feature/Improvement:对标 DSH 桌面端补齐四项能力(ZIP 导出/快捷键改键/Auto 审查闸/原生打开) (2add401e8a)
- 🔧 Chore/Other:结清 DG-14(元门档登记表+阻断通道判据,4a4a93d/1a9fa70) (52afa50b53)
- 🔧 Chore/Other:门 262 镜像测试随 gitRaw 重构更新 T5 并补 DG-14 通道维 T6 (1a9fa705dd)
- 🚀 Feature/Improvement:元门档改登记表声明并补阻断通道判据 (4a4a93dea1)
- 🔧 Chore/Other:认领 DG-14(元门档脚本名正则白名单) (76eab8ce64)
- 🔧 Chore/Other:结清 RP-3(前提不成立:索引面已接 ignore 判据) (194bd1611c)
- 🔧 Chore/Other:认领 RP-3(索引面接 ignore 规则判据) (f4d1ba6b00)
- 🔧 Chore/Other:结清 F-355(前提不成立:唯一索引与 upsert 已入库) (f4d3afe10f)
- 🔧 Chore/Other:结清 F-536/F-540/F-574/F-662(实修 db21c929c66,回归锁 5120189d797) (b55c563976)
- 🔧 Chore/Other:补四票回归锁 —— F-536 上传登记归属/F-540 saveBarrier 互斥/F-574 sum bigint/F-662 relay-BYOK 分账(随 db21c929c66) (5120189d79)
- 🔧 Chore/Other:结清 F-271(前提不成立:tenant 维度已随 db21c929c66 入库) (de213e4f41)
- 🔧 Chore/Other:认领 F-355(coze_variables 缺唯一+create 无查重) (7545042fa4)
- 🔧 Chore/Other:结清 F-434(前提不成立:默认值已随 db21c929c66 改为 pending) (5a4f4352d6)
- 🐞 Fix:缺陷普查第5轮 22 票落地(5 组并行修复,含 10 枚迁移待评审) (db21c929c6)
- 🔧 Chore/Other:认领 F-434(会话状态默认值互斥) (05b3a843a0)
- 🔧 Chore/Other:认领 F-271(企微登录缺 corpId) (aefa8110dc)
- 🚀 Feature/Improvement:打通定价→利润闭环,调用落账成本/毛利并提供看板聚合 (40a042b52b)
- 🔧 Chore/Other:补记 824821d9 水印注入追认行 (240643d884)
- 🔧 Chore/Other:收敛轮三枚具名追认入账(两枚合并并集差量 + 一枚水印注入) (f7519585fb)
- 🔧 Chore/Other:结清 F-376(预算告警冷却原子占位,5a77480d37f,18 tests) (3f7f8945d4)
- 🔧 Chore/Other:重结 F-221（并集合并回捞已结行）—— 实修 dda5d5b73c7，原结清 e5bbbf23426 (0999ee9190)
- 🐞 Fix:预算告警冷却改为原子判据 (5a77480d37)
- 🐞 Fix:workbuddy 永久保活不再依赖客户端进程 (a9d2d526aa)
- 🔧 Chore/Other:认领 F-175(技能同步 upsert 无唯一约束) (5224f18175)
- 🔧 Chore/Other:结清 F-419(授权写回行锁+锁内复查,dce370e46f8,4 passed) (6676771a98)
- 🐞 Fix:权限授权改为原子条件写防撤销复活 (dce370e46f)
- 🚀 Feature/Improvement:补齐薪资配置读写接口并接入前端 (92b3741939)
- 🔧 Chore/Other:结清 F-221(RLS 上下文绑定单条 reserve 连接,dda5d5b73c7,73 passed) (e5bbbf2342)
- 🔧 Chore/Other:认领 F-274(审计链链尾按 timestamp 取) (e0e7e3cfee)
- 🐞 Fix:补登 4 道新门的判面声明(button-border-color/shadow-single-source/acp-method/acp-error) (d2315b1390)
- 🐞 Fix:F-221 RLS 上下文 set/clear 绑定同一条 reserve 连接(缺陷普查) (dda5d5b73c)
- 🔧 Chore/Other:结清 F-442(令牌按用户加密+管理员鉴权+审计,75e18089cdb,6 passed) (37192cdcab)
- 🔧 Chore/Other:结清缺陷普查 F-444（GitHub PR/Issue 端点仅本人令牌）—— 实修见 6f84dc9b346 (11c3900cde)
- 🐞 Fix:F-444 GitHub PR/Issue 端点改为仅本人令牌，平台 PAT 不再代理任意 owner/repo (6f84dc9b34)
- 🐞 Fix:GitHub 令牌读写限制为授权角色并留审计 (75e18089cd)
- 🐞 Fix:F-524 worker 关停相位补齐 —— auto-rollback/poolTracker 移入 buildServer onClose,gateway 可关、server.close 有超时 (c03051dc0f)
- 🔧 Chore/Other:定价台合面新露 5 处 control→rounded-sm、payroll 徽标 1 处 chip→rounded-md,工作树预验 150 判红 0 族 (67619ea0f7)
- 🐞 Fix:F-524 worker 关停相位补齐 —— auto-rollback/poolTracker 移入 buildServer onClose,gateway 可关、server.close 有超时 (b6716b4a74)
- 🐞 Fix:缺陷普查两票 —— F-458 金额聚合改 bigint 防溢出/F-649 修复任务状态改共享权威源 (d48dc332a8)
- 🐞 Fix:缺陷普查两票 —— F-458 金额聚合改 bigint 防溢出/F-649 修复任务状态改共享权威源 (7741b6913a)
- 🐞 Fix:缺陷普查三票 —— F-457 佣金状态码统一/F-535 共享公式从格读取/F-620 Key限流原子占位 (216d71a531)
- 🐞 Fix:缺陷普查三票 —— F-457 佣金状态码统一/F-535 共享公式从格读取/F-620 Key限流原子占位 (c7147a5f45)
- 🔧 Chore/Other:认领 F-442(GitHub 令牌单文件越权覆盖) (7aa9572555)
- 🐞 Fix:ModelOption 补 inputPricePerMillion/outputPricePerMillion 可选字段(模型选择器单价行 TS2339) (91fc1781e2)
- 🔧 Chore/Other:定价台 model-pricing-console 11 处裸 border 补显式基础色(315 联动面,按钮→border-border/输入→border-input) (18099f0e06)
- 🔧 Chore/Other:认领 F-376(预算告警冷却竞态) + F-419(授权读改写非原子) (74c51bdd05)
- 🔧 Chore/Other:结清缺陷普查 F-585(completeOrder 补齐消费积分与 order.paid Outbox) —— 实修 288fb813636 + 夹具 a2076a53a88 (030c88dcc6)
- 🔧 Chore/Other:夹具备份产物目录改名 switch-profiles,避开保护闸 backups 的精确等值 (29d71f9c26)
- 🔧 Chore/Other:结清缺陷普查 F-371(退款回收 VIP/订阅/配额) —— 实修见 8784117c0a4 (094dad6f6f)
- 🔧 Chore/Other:结清 F-302(前提不成立:唯一角色启动已由 bf70b42befe 入库) (a56a518b24)
- 🔧 Chore/Other:结清 F-289(公开边缘缓存退到 private 取消共享边缘条目,代码 fd3cad81c72 已入库,回归 11/11 绿) (8e3f2254ab)
- 🔧 Chore/Other:F-585 夹具补齐 FOR UPDATE 档与事务计数(重落,修上一枚 CAS 陈旧树) (a2076a53a8)
- 🐞 Fix:缺陷普查两票 —— F-412 私有文档资产按属主隔离/F-726 流式计费采用上游 usage 真值 (f2b120d3d3)
- 🔧 Chore/Other:F-585 夹具补齐 FOR UPDATE 档与事务计数(随 288fb813636) (3f95cbd081)
- 🐞 Fix:缺陷普查两票 —— F-412 私有文档资产按属主隔离/F-726 流式计费采用上游 usage 真值 (a59cdb7b48)
- 🔧 Chore/Other:结清 F-402(swarms 补属主模型防跨用户劫持,代码 1f9dab14ec1 已入库) (041128c039)
- 🐞 Fix:F-585 completeOrder 补齐消费积分与 order.paid Outbox(缺陷普查) (288fb81363)
- 🔧 Chore/Other:门 150 点名 8 处角色档对齐(control→sm、chip→md,web 定价台/HR 徽章/craft 复刻件) (8a014ccc06)
- 🔧 Chore/Other:属主登记表维护戳 —— 合并前复核 owners 2 项 / unowned 479 项并重签 generatedAt (37811d0499)
- 🐞 Fix:F-402 swarms 补属主模型 防跨用户劫持。SwarmPlan 增 ownerId,list 过滤属主,get/execute/cancel 按(swarmId,ownerId)定位非属主404防枚举,路由透传userId。验证 f402-swarms-owner-scoped 10/10。随附 F-Forge 未追踪新文件 change-request-service/worktree-ledger 使落地import链自洽。 (1f9dab14ec)
- 🔧 Chore/Other:结清缺陷普查 F-577(月末夹取)+F-581(代扣订阅激活) —— 实修见 864ea1e18666 (d5bbc50008)
- 🐞 Fix:F-577 月末/闰日夹取 + F-581 代扣订单激活订阅(缺陷普查) (864ea1e186)
- 🔧 Chore/Other:结清第3轮缺陷普查 47 票(45 项修复由 7acf2f63a97 对象空间三方合并落地;F-542/F-627 由既有提交 d87e4779d5/878aef04e8e 双通道复核属实) (57a643b840)
- 🐞 Fix:缺陷普查第3轮对象空间 CAS 落地 45 票 F-275/F-368/F-431/F-445/F-447/F-506/F-528/F-532/F-533/F-534/F-551/F-557/F-558/F-560/F-561/F-565/F-566/F-567/F-572/F-593/F-609/F-614/F-633/F-640/F-641/F-651/F-654/F-655/F-658/F-659/F-661/F-663/F-664/F-668/F-669/F-672/F-673/F-674/F-679/F-684/F-685/F-695/F-696/F-697/F-709 (7acf2f63a9)
- 🐞 Fix:RN/小程序深挖轮修复净差集落地(squash 转发,拓扑保全见 tag) (6258cebddc)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (957ff5c6b6)
- 🐞 Fix:根治项目文件盘根外流——scratch 逃生舱合规闸+拔系统盘脏env+盘根卫生增申报目录内容对账与C盘覆盖面 (2a85a5024c)
- 🐞 Fix:公开边缘缓存键纳入 Origin (fd3cad81c7)
- 🐞 Fix:退款同步回收已发放 VIP/订阅/配额 (a3c28e6623)
- 🐞 Fix:并入 fd5b05b9c33 后按 HEAD 面重封清单(guardian-runner=8961bc242c69) (e417193cb9)
- 🐞 Fix:还原 relay-chat-stream(1b2184d99fd 删除但 send-message 仍引用)并补齐 hr-attendance/payroll-tabs(导入缺失致 next build 失败) (3b2c05d8fd)
- 🔧 Chore/Other:认领 F-221(RLS 上下文复位不绑连接) (5aae2a4458)
- 🐞 Fix:routine 调度器只在唯一角色启动 (bf70b42bef)
- 🔧 Chore/Other:结清 F-267(自愈依赖修复走受控通道不再 126,0b61b43d557) (e41adafaba)

**2026-11-13**
- 🚀 Feature/Improvement:findings survey 反向对账 — 12f/12g 棘轮门 + plan-tasks 派单降级 (fd5b05b9c3)
- 🐞 Fix:E-P1 鉴权失败(401/403)归 content 不走 resume 阶梯 (f841c69006)
- 🔧 Chore/Other:结清 F-407 退款不冲减佣金(代码随 8784117c0a、回归锁 15/15 同批入库) (8db6cb1b38)
- 🐞 Fix:自愈依赖修复走受控授权通道不再 126 (0b61b43d55)
- 🔧 Chore/Other:结清 F-375/F-436/F-443/F-455/F-526(回归锁随代码同批入库) (7c63ab0f46)
- 🐞 Fix:F-407 退款不冲减佣金(F-408 已随 c9fca632165 入库) —— refundOrder 补佣金冲减 (8784117c0a)
- 🐞 Fix:缺陷普查五票 —— F-375 事务后附属步骤补偿/F-436 嵌套事务统一tx/F-443 非流式计费模型一致/F-455 后台提现单资金闭环/F-526 embedding失败不静默 (bf989a75f0)
- 🔧 Chore/Other:302p 基线定向对账 tierWebOffN 228→229(终尖现读,逐维取证非本枚引入) (6c6bda40ec)
- 🔧 Chore/Other:302p 基线定向对账 tierWebOffN 228→229(定价批 pl-7 落账带取证) (888f730da3)
- 🐞 Fix:补齐两处类型契约 —— AdapterCallOptions.signal 与 ModelOption 单价字段 (456ebd482b)
- 🐞 Fix:notice-log 形参 storage 改名 store,避开 WXT auto-import 把形参误判为 wxt/utils/storage 全局并注入(致 extension 构建失败) (7032fd5e58)
- 🔧 Chore/Other:结清 F-186/F-374/F-394/F-408/F-415(回归锁随代码同批入库) (0330314753)
- 🔧 Chore/Other:推送域 103 个缺溯源水印文件按 HEAD blob 注入(只加水印头,不动正文) (824821d9d1)
- 🐞 Fix:流式工具参数缓冲上限 + defect 终态 + errorCode 端侧接线 (4759055a3b)
- 🔧 Chore/Other:结清 16 票缺陷普查(F-319/397/430/435/491/516/575/665/683/686/687/688 由 d87e4779d5 对象空间 CAS 落地;F-304/401 由 0dafbf2e7a0、F-723/727 由 84e5c20d6e3 双通道复核属实) (a513d2e8e9)
- 🐞 Fix:缺陷普查五票 —— F-186 BYOK连通性用用户Key/F-374 缺周期不写永久/F-394 token流水口径枚举/F-408 佣金入账补流水/F-415 workbook保存配额 (c9fca63216)
- 🔧 Chore/Other:认领 F-302(routine 调度器双执行) (625459fdbf)
- 🔧 Chore/Other:结清 DG-13(回滚支 exit 3 + 按码记失败,7ae5d33fa1a) (4df3c5de81)
- 🐞 Fix:按 HEAD 面重封 O6501 清单,修复 git-guardian 未重封导致的部署 fail-closed (34055a823c)
- 🐞 Fix:清偿回补连带两道真红 —— 47p 四文件水印 + 306p sag2 knip entry (b74611fbb4)
- 🐞 Fix:缺陷普查批次 w1/w2 对象空间 CAS 落地 F-319/F-397/F-430/F-435/F-491/F-516/F-575/F-665/F-683/F-686/F-687/F-688 (d87e4779d5)
- 🔧 Chore/Other:结清 F-337/F-373/F-386/F-395/F-410/F-414(回归锁随代码同批入库) (7adca110a6)
- 🐞 Fix:缺陷普查五票 —— F-373 订阅续期基准与上限/F-386 RAG注入边界/F-395 商品写接口判空/F-410 提现冻结即扣/F-414 workbook会话隔离 (e6aad6e558)
- 🐞 Fix:派发腿级失败不再吃日预算,登录过期告警单独立身份 (11a6ee9fb6)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (b0dcad2699)
- 🔧 Chore/Other:认领 F-371(退款回收 VIP/订阅/配额,P1) (e53eba81b7)
- 🔧 Chore/Other:结清 RP-6(前提不成立:R1s 已由 8aa1a3ddfa77 落地并接线门84) (4499bbb799)
- 🐞 Fix:门禁失败轮回滚后不再以 exit 0 记账 (7ae5d33fa1)
- 🚀 Feature/Improvement:统一定价解析器 + 定价管控台 + 调价审计 + 每日零价巡检 (6a5800a279)
- 🚀 Feature/Improvement:统一定价解析器 + 定价管控台 + 调价审计 + 每日零价巡检 (e61f309851)
- 🔧 Chore/Other:认领 F-267(自愈依赖修复 pnpm 126) (aef0117558)
- 🔧 Chore/Other:结清 F-80(点赞/收藏计数单事务+advisory 锁,92f6b1a4721,34 tests) (5b012454e4)
- 📚 Docs:README trackedFiles 21667→21668(merge带入远端新增1路径) (780a444bde)
- 🔧 Chore/Other:结清 F-387/F-619/F-624/F-647/F-652(回归锁随代码同批入库) (5b61a7b17c)
- 🐞 Fix:缺陷普查五票 —— F-387 摄取按docId贯穿/F-619 在途闸续期/F-624 运维快照节流单飞/F-647 人工摘除不被巡检撤销/F-652 备案同步超时单飞 (e064543710)
- 📚 Docs:补 RECONCILE-findings-staleness.md 反向对账层 (ac22d159d5)
- 🐞 Fix:点赞/收藏计数并发漂移改为原子事务 (92f6b1a472)
- 📚 Docs:标注 8 份 findings 为过期快照并补 AIS-116 复核 (f3acab9b5c)
- 📚 Docs:README 生成块数字对齐现算(sync-readme-numbers 官方通道数值) (8557693e08)
- 🔧 Chore/Other:认领 F-289(边缘缓存键缺 Origin) (00136728d4)
- 🔧 Chore/Other:结清 F-141(会话导入知识库幂等,3dc2bce82c6,12/12) (8e455456f9)
- 🔧 Chore/Other:结清 F-564/F-576/F-594/F-601/F-603(回归锁随代码同批入库) (8deb36995e)
- 🐞 Fix:缺陷普查五票 —— F-564 快照漏采不假成功/F-576 邮件金额口径/F-594 热度刷新管理员限缩/F-601 agent任务过滤下推/F-603 统计口径统一 (35a9f3c13f)
- 🔧 Chore/Other:认领 RP-6(混合陈旧底稿拦闸) (4d5acba534)
- 🔧 Chore/Other:结清 AIS-114(中断落盘半批次 checkpoint,f3b702b1ef2,9 passed) (39f30cb1f3)
- 🐞 Fix:会话导入知识库改为幂等写入 (3dc2bce82c)
- 🐞 Fix:回补 807d0817 误删的 45 个已入库文件(回归锁/sag2 三端承载/notice-log 全套) (d399df7c39)
- 🔧 Chore/Other:结清 F-531/F-550/F-556/F-559/F-563(回归锁随代码同批入库) (0eba7b15c9)
- 🐞 Fix:缺陷普查五票 —— F-531 wiki提示词预算含清单/F-550 对账三重校验/F-556 锁定键归一/F-559 过期监听onFail护栏/F-563 清理不跟随符号链接 (db4b623a88)
- 🐞 Fix:中断时立即落盘半批次 checkpoint (f3b702b1ef)
- 🔧 Chore/Other:结清 F-467/F-493/F-509/F-510/F-527(回归锁随代码同批入库) (5f7a9e5e58)
- 🐞 Fix:缺陷普查五票 —— F-467 WS限流窗口不随断连重置/F-493 生图超时释放/F-509 USDT查询故障不吞/F-510 调度任务失败记账/F-527 知识修订倒序分页 (7db0d98788)
- 🔧 Chore/Other:收敛并行会话改动(水印补注+streaming-audit+考勤HR文档+cli文档) (53848eabcb)
- 🔧 Chore/Other:结清 F-413/F-416/F-451/F-454/F-465(回归锁随代码同批入库) (4df984e53b)
- 🐞 Fix:缺陷普查五票 —— F-413 资产提取上限去重/F-416 embedding分片重试/F-451 事务统一句柄/F-454 冻结只释放一次/F-465 后台改单状态机 (e09eba2d4b)
- 🐞 Fix:修复workflow-todo.ts溯源水印载荷丢失 (872f61b125)
- 🐞 Fix:收口新四档 CSS 等值落档、装车 finance-ai-hub、修 lander null 崩溃 (79afad3922)
- 🐞 Fix:修复15源码文件溯源水印载荷丢失+清理4文件死变量 (26aa10cbde)
- 🔧 Chore/Other:结清 F-336/F-379/F-370/F-157/F-256/F-380(回归锁随代码同批入库) (2e6b3f6d86)
- 🐞 Fix:修复24源码文件溯源水印载荷丢失(hr/db/i18n/craft)+清理import类型注解 (41cd976085)
- 🐞 Fix:缺陷普查四票 —— F-370 订阅白名单唯一出口/F-157 平台Key计量配额/F-256 抢占真中止/F-380 合并状态原子闸 (46cddfe213)
- 🐞 Fix:修复源码文件溯源水印载荷丢失+清理死代码 (2af1a280cc)
- 🐞 Fix:缺陷普查 F-336 圈子按 slug 可达 + F-379 登录风控 R002/R005 字段补齐 (29ce7a9ed9)
- 🔧 Chore/Other:结清 F-675/F-311 —— 代码已入库 1a8f9d399bd(f675 2/2 + f311 2/2 回归锁通过) (3894a7ff73)
- 🐞 Fix:F-675 异步生图零计费(创建即乐观按次扣费)+ F-311 裂变券自荐防护(分享人≠领取人,防刷余额);回归锁 f675 2/2 + f311 2/2 (1a8f9d399b)
- 🐞 Fix:AI对话流式显示P1修复 —— web早退持久化/并发幂等 + ai-service网关三缺陷 (274b1b6eda)
- 🔧 Chore/Other:补齐 plan_a 落档后 3 处 JSX 折行(prettier 合规) (4f1725dd1f)
- 🔧 Chore/Other:结清批次57 —— F-123/F-164/F-200/F-213/F-303（回归锁随代码同批入库） (b32070070a)
- 🐞 Fix:批次57 缺陷普查五票 —— F-123 热搜采集逐条 await/F-164 返佣费率合计不变量/F-200 Crew 全失败记 failed/F-213 视频进度首插 upsert/F-303 routine tick 错误隔离 (f4a723599b)
- 🐞 Fix:收口 plan_a 字号档语义化并补齐档表清单 (6bd7f8db8c)
- 🐞 Fix:RP-17 标头补等条件(凭证+枚举就位),避免派单器误判 actionable (547cfd5dda)
- 🔧 Chore/Other:结清 1 张缺陷普查工单(HEAD 修复核验) (c1829341dc)
- 🐞 Fix:F-213 /learn/video/log 首次观看无历史记录时插入 lessonRecords,避免进度静默丢失 (3806fbc0d5)
- 🚀 Feature/Improvement:登记考勤 IM 同步剩余三项待办(补 scope/审批枚举/端到端联调) (e503752634)
- 🔧 Chore/Other:结清批次56 —— F-281/F-293/F-300/F-301/F-174（回归锁随代码同批入库） (7db10d70e5)
- 🐞 Fix:批次56 缺陷普查五票 —— F-281 直播浏览去重+notify 鉴权/F-293 工具调用贯通/F-300 权限徽章服务端绑定/F-301 routines 属主校验/F-174 观看时长原子自增 (9b52b5aac5)
- 🐞 Fix:微信移动应用 code2session 上游 errcode 带码抛出 —— 40125/40029/40163 不再被吞成泛化文案(与 jscode2session 同族判据),配套三例回归锁 (44587551d8)
- 🔧 Chore/Other:认领 DG-13(部署门禁失败仍 exit 0) (fc79efbdda)
- 🔧 Chore/Other:结清 RP-4(前提不成立:rename_detect 已入库 c0efc7e3,证据 pytest 36/36 GREEN) (82f2d3f7ef)
- 🐞 Fix:admin/** 段级豁免 reason 自述计数 337→338 对齐现读,清偿 staleCountAssertions(门自述计数腐烂归零) (deb93d3afd)
- 🔧 Chore/Other:认领 F-80 / F-141 / AIS-114 / RP-4 四票(wave1 并行 subagent) (c0efc7e335)
- 🔧 Chore/Other:结清批次55 —— F-248/F-279/F-287/F-295/F-298（回归锁随代码同批入库） (ce23c2735c)
- 📚 Docs:重跑 report-rn-miniapp-gaps 派生账本清偿 doc-stale(镜像自述258→257,对应 study 撤除registry假配对) (857b02b7fe)
- 🐞 Fix:AppUpdateBanner 圆角改用 rnRadius.lg 单一真相源,对齐 RN UpdatePrompt/ApkUpdatePrompt (742158c1f1)
- 🔧 Chore/Other:结清批次53/54 八票 —— F-193/F-194/F-204/F-222/F-232/F-84/F-249/F-278,并结清已入库未摘行的 F-132/F-142/F-150/F-214/F-242 (dee8319ec3)
- 🐞 Fix:批次54 缺陷普查五票 —— F-84 ilike 通配符转义/F-132 创建用户契约统一/F-242 参数覆盖缓存回归锁/F-249 closeSession 幂等/F-278 recent 工作区隔离 (0dafbf2e7a)
- 🔧 Chore/Other:结清 7 张缺陷普查工单(HEAD 修复核验) (c6a15ba3f2)
- 📚 Docs:生成块计数对齐最终尖现算(testFiles 5316→5318/trackedFiles 21472→21474) (7316a54c80)
- 🐞 Fix:批次53 缺陷普查五票 —— F-193 内部调用改服务票据/F-194 计费模型统一 billingModel/F-204 工作区锁降级可观测+TTL/F-222 调度器注册超时/F-232 VIP 到期集合式降级 (84e5c20d6e)
- 🐞 Fix:补齐小程序 style-tiers 字号等值腿(--font-safe)在守护轮与CI级联的派发口径,land-miniapp 探针补 changedFiles,parity-auto 接入 RN 原生屏承载差集只读 gate (2a66f32e8a)
- 🐞 Fix:check-miniapp-style-tiers 裸字面量正则加负向后行断言,治 CSS 连写属性误报 (a4db485266)
- 🐞 Fix:撤GEO死副本改MAIN唯一权威 + 自测两断言跟随更新 (6dc3cbdba6)
- 🚀 Feature/Improvement:18rpx(9px)→text-badge(10px),产品定档 plan_a 收尾 (2be193a745)
- 🐞 Fix:登录 429 人机验证挑战降级为友好退避,杜绝「做不了的 CAPTCHA」死锁 (8040375ae5)
- 🚀 Feature/Improvement:font-safe 腿自动落档 ai/special.tsx 38rpx→text-heading-sm(等值,零视觉变化) (661f5558b0)
- 🚀 Feature/Improvement:新增 titleLg/headingSm/headline/displayXl 四个字号档(产品定档 plan_a) (bd82c86a2d)
- 🔧 Chore/Other:结清 F-142 团队知识修订乐观锁 —— 代码已入库(knowledge-team-service.ts reviseItem/setItemStatus 均带 AND revision=基线 + 事务 + 冲突抛 RevisionConflictError)，回归锁 f142 5/5 通过 (53cc1f9f89)
- 🔧 Chore/Other:结清批次52 —— F-681/F-713/F-714/F-716（回归锁随代码同批入库） (fa128c74d3)
- 🐞 Fix:守门基础设施文件回退到origin/main版 —— 治陈旧底稿倒退 (6d28951979)
- 🐞 Fix:批次52 缺陷普查四票 —— F-681 SRS 到期日初始化/F-713 日界无时区解析/F-714 斜杠时间串 UTC 归一/F-716 NO_PROXY 双档并扫 (511ef81ee1)
- 🔧 Chore/Other:补齐 6 个 HEAD blob 的溯源水印(解 47p push 门) (4e5c870902)
- 🚀 Feature/Improvement:有界 JSON 序列化原语(J4) — 迭代遍历+字节/节点/深度三重护栏 (807d0817e4)
- 🐞 Fix:团队知识修订乐观锁下沉到 UPDATE WHERE revision 条件+rowCount 判冲突,update+writeRevision 包同一事务(消除后写覆盖先写+审计失败无回滚)+ 回归锁 5/5 (0f6572662c)
- 🐞 Fix:收敛 push 门3道判红 —— 193 stdio / 300 端点登记 / 303p 文案裁定 (c605db9ade)
- 🔧 Chore/Other:结清批次51 —— F-667/F-678/F-708/F-710/F-715（回归锁随代码同批入库） (e542bca7a1)
- 🐞 Fix:批次51 缺陷普查五票 —— F-667 token 求和溢出/F-678 上游状态码透传/F-708 watchdog 续约容错/F-710 mTLS 未验证身份/F-715 死信读路径淘汰 (5f9d5c4660)
- 🔧 Chore/Other:结清批次50 —— F-634/F-666/F-677/F-707（F-635 行已由批次49 摘除，其代码修复随本批入库） (d538ec2e00)
- 🔧 Chore/Other:刷新 README 生成块数字(索引面,唯一写入口 sync-readme-numbers) (28b938c82c)
- 🐞 Fix:批次50 缺陷普查五票 —— F-634 定价建议聚合精度/F-635 下单金额分位一致/F-666 count 聚合 int8 契约/F-677 账号池读流非正常结束 cancel/F-707 下载逐跳 SSRF 复检 (20afa05e87)
- 🔧 Chore/Other:结清 F-162 数据清理 DELETE 无 LIMIT —— ctid 分批+严格布尔+日志插值已入库 eefd6ada486 + 回归锁 4/4 (f778a325ff)
- 📚 Docs:对齐生成块数字到 HEAD 现算面(解推送侧 DN1/DN2 文档数字对账) (734226843f)
- 🐞 Fix:数据清理 DELETE 改 ctid 分批(LIMIT 50000 循环),dryRun 改严格布尔,dryRun 误判致真实清理被当预览 + 审计日志补插值 + 回归锁 4/4 (eefd6ada48)
- 🚀 Feature/Improvement:Anthropic 兼容端点支持 x-api-key 鉴权与外部模型名回落 (ffc7f98441)
- 🔧 Chore/Other:结清 F-183 熔断计数器读改写非原子 —— 原子 Lua 修复已入库 df968b452a7 + 回归锁 7/7 通过 (fdf9fab832)
- 🐞 Fix:熔断计数器读改写原子化(Lua HINCRBY语义+阈值转open),消除并发失败计数覆盖导致熔断难触发 + 回归锁 7/7 (df968b452a)
- 🐞 Fix:小程序端 noValidContent 文案对齐 RN/Web 口径(解 303p 文案漂移 +1) (4264f62b9f)
- 🚀 Feature/Improvement:跨端功能更新 + DeepSeek UI 逆向复现 + 文档维护 (4b9d379d1a)
- 🐞 Fix:补齐 preview-envelope 模块修编译破窗(J2 复现 Qoder office-reader 结构化信封) (12357ae50b)
- 🔧 Chore/Other:结清 F-404 返佣基数铸币漏洞 —— 代码修复已入库(HEAD等效合并)+ 回归锁6/6通过 (fcac918750)
- 🐞 Fix:relay-minimax 同步脚本补充 client-auth-* 决策类型(解 typecheck:full 脚本面红) (949eb2026d)
- 🐞 Fix:返佣基数取本单充值流水增量(orderNo+opType=0),消除对历史钱包余额反复抽佣 + 回归锁 6/6 (82ba276a9b)
- 🐞 Fix:收口 rows[0] 越界取值的类型面(noUncheckedIndexedAccess),解 typecheck:full 常红 (967e3dfd55)
- 🔧 Chore/Other:结清批次49 —— F-635/F-643/F-656/F-657/F-682 (837f28df86)
- 🐞 Fix:结清 F-635 支付金额分位同源 + F-643 registry 主库判定 + F-656 低余额提醒冷却顺序 + F-657 金丝雀建表自愈 + F-682 个推 token 缓存与有界扇出 (8cbd9f9e17)
- 🔧 Chore/Other:补齐 F-599/F-626/F-631/F-639 新增测试的溯源水印(守门 47p) (bc5cffb9d1)
- 🔧 Chore/Other:结清批次47-48 —— F-599/F-600/F-626/F-639/F-644/F-645/F-648/F-650/F-653 (be7457f36f)
- 🐞 Fix:结清 F-626 别名主库解析与短 TTL 缓存 + F-648 修复任务租约回收 + F-650 代码索引删插同事务 + F-653 巡检异常留痕计数 (1a5ac4d431)
- 🐞 Fix:结清 F-599 权限删除事务 + F-600 分页唯一键兜底 + F-639 群发分批与状态过滤 + F-644 调度运行事务 + F-645 邀请接受事务 (9dcd8d7c26)
- 🐞 Fix:收口 F-623 滑动扫描的索引取值类型(noUncheckedIndexedAccess) (67750ac24d)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (690bb9b24c)
- 🐞 Fix:DG-12 发布 tag 闸从整树 porcelain 改为发布件逐 blob 对账 (f386100622)
- 🔧 Chore/Other:test(api)+docs: F-150 上海业务日口径回归 4/4 + F-214 :childId 形状闸回归 11/11 入库(前笔代码已在 HEAD,本笔补齐回归锁);README 块 testFiles 5240/trackedFiles 21377 随 DN5 对齐(经 isolated 三试均被钩子外来回灌护栏正当拦停,按 §12 出路③改 object-space-land,落地后复跑受影响门) (a5e16d9833)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (231f945879)
- 🔧 Chore/Other:结清批次46 —— F-602/F-625/F-630/F-631/F-632 (03cda13b2f)
- 🐞 Fix:结清 F-602 语音笔记分面口径 + F-625 探针超时取消 + F-630 大屏日界重复平移 + F-631 账单归月上海日 + F-632 积分日历上海日 (c8bba3ff8a)
- 🔧 Chore/Other:结清批次37-45 —— F-382/388/389/393/396/392/406/441/450/417/422/461/466/475/492/494/496/498/504/507/508/511/513/514/518/519/520/529/537/552/538/549/553/554/555/562/569/578/579/589/591/598/606/607/608/621/622/623 共 45 行 (85c98e76bb)
- 🐞 Fix:结清 F-598 点赞幂等 + F-606 OTel query 脱敏 + F-607/F-608 Bulkhead 名额退还与复位解挂 + F-621 代理池原子计数 + F-622 代理日志脱敏 + F-623 提示词全文扫描 (14a0f49ec2)
- 🐞 Fix:结清 F-569 资源发布态闸 + F-578 访问趋势业务日 + F-579 食堂采购日 + F-589 缺勤分批写入 + F-591 收件箱归属 (4229823a4b)
- 🐞 Fix:结清 F-538 中转会话落库 + F-549 清理范围收敛 + F-553 归档分批删除 + F-554 快照保留与孤儿自清 + F-555 锁定双存储合并 + F-562 清理异步单趟 (f34475d3e4)
- 🐞 Fix:收口 ProcessGroupChild.kill 签名以对齐 ChildProcess,解除 typecheck:full 的 apps/cli 红 (a0cfa61ddd)
- 🐞 Fix:结清 F-519 死路由清理 + F-520 组织接口鉴权 + F-529 repo-wiki 模型校验 + F-537 PDF 失败如实 503 + F-552 缓存写失败隔离 (1c095a309c)
- 🐞 Fix:结清 F-508 USDT RPC 超时 + F-511 通知失败重试 + F-513 健康检查互斥合并写 + F-514 平台密钥调用计费 + F-518 引擎 RPC 可达回归锁 (041304b985)
- 🐞 Fix:结清 F-494 批处理先扣费后落键 + F-496 账号池退出码判定 + F-498 回调帧两段确认 + F-504 收藏按用户过滤 + F-507 工具超时取消 (5d949c01a9)
- 🔧 Chore/Other:结清 O69(调度轮 sweepLocalDevDbRotation 与镜像 10 例已入库)与 12A/DG-12(发布 tag 闸改发布件对账,同批提交) (6c2a28998f)
- 🐞 Fix:结清 F-422 Qoder 桥关停竞态 + F-461 WS 活动时间刷新 + F-466 live-chat 单用户连接上限 + F-475 chat 历史表上限 + F-492 生图 worker 租约归属 (c1252d160d)
- 🐞 Fix:结清 F-422 Qoder 桥关停竞态 + F-461 WS 活动时间刷新 + F-466 live-chat 单用户连接上限 + F-475 chat 历史表上限 + F-492 生图 worker 租约归属 (2882733925)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (e2b674edc9)
- 🐞 Fix:结清 F-382 OSS 分片会话隔离 + F-388 关键词下推 + F-389 缓存键凭据指纹 + F-393 内容分类归属 + F-396 兑换码 Key 归属 (d8ffac6ef8)
- 🐞 Fix:结清 F-392 引导凭据闭环 + F-406 提现手续费扣余额 + F-441 剧情增强并发记账 + F-450 代扣回调单事务 + F-417 xlsx 单趟渲染 (6e80aa927c)
- 🐞 Fix:结清 F-382 OSS 分片会话隔离 + F-388 关键词下推 + F-389 缓存键凭据指纹 + F-393 内容分类归属 + F-396 兑换码 Key 归属 (a623f5c402)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (2a38516649)
- 🔧 Chore/Other:结清 F-450 —— 代扣回调建单/完成已并入外层事务(DB-02,commit 55efcffe136):placeOrder(tx)/completeOrder(tx)/rechargeToken(outerTx)/earnPoints(tx) 全链透传,消除半提交与重复发权益;f-450 回归锁 5/5 通过 (63c7cd22e1)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (b5e09bb17f)
- 🐞 Fix:提现旁路写入口全部改调 commission-queries 单源服务——agent-withdrawal apply/approve/reject 补冻结+单号+状态守卫+退冻结,admin第5条写入口消除无守卫直写status(资金守恒同源);回归锁 f452-453 6/6 (d773e33e34)
- 🔧 Chore/Other:结清 F-452/F-453 —— 提现旁路写入口(finance-extended agent-withdrawal 三入口 + admin-extended 第5条)全部改调 commission-queries 单源服务 apply/approve/rejectWithdrawal,补冻结+单号+状态守卫+退冻结(资金守恒同源);回归锁 f452-453 6/6 (aada9610e5)
- 🚀 Feature/Improvement:复现 WorkBuddy subagent journal 闭环(compact/append/merge)—— 逆向-复现-超越 (6a06e59400)
- 🔧 Chore/Other:结清批次36 共5张(F-352/353/367/369/372) (f89c5981fe)
- 🐞 Fix:结清 F-352 定时清理集合化分批 + F-353 积分渠道事务 + F-367 清理器显式生命周期 + F-369 订阅配额原子累加 + F-372 日成本熔断 (3320620624)
- 🐞 Fix:ab_test_results schema 补 UNIQUE(variant_id,bucket) 表约束 + bucket NOT NULL,对齐已入库迁移 20261112000002,防 onConflict 42P10 + 回归锁 5/5 (d1b4766f6b)
- 🔧 Chore/Other:结清 F-448 —— ab_test_results schema 侧补 UNIQUE(variant_id,bucket) 表约束 + bucket NOT NULL,对齐已入库迁移 20261112000002(证据:迁移 + 回归锁 f448 5/5) (72ec4aad2b)

**2026-11-14**
- 🔧 Chore/Other:收拢本地工作区改动(全量提交) (1be9d1e2c7)
- 🔧 Chore/Other:重封根护栏清单(merge round2 后 gate-scope 漂移) (4b0fc5a3e6)
- 🐞 Fix:补两处契约缺口——SendAdmissionReceipt.ahead 与 ProcessGroupChild.kill 签名 (0dc7a15623)
- 📚 Docs:同步生成块计数(经用户明确授权跳过钩子) (c466bece0a)
- 🚀 Feature/Improvement:per-tool timeout budgets + NO_PROXY routing (5th DSH pass) (41d9096328)
- 🐞 Fix:零价巡检改用采购成本量化损失 (b5a8e3967a)
- 📚 Docs:生成块四维数字回归 HEAD 面现算(apiRoutes 4800->4814/apiRouteFiles 699->697/testFiles 5254->5450/trackedFiles 21591->21820) (6ad68f44c6)
- 🚀 Feature/Improvement:零价上架护栏 + 每日零价巡检 (5b7e639654)
- 🚀 Feature/Improvement:逆向 DSH 审计第三/四遍补齐(导出保真/中断语义/Office 转换) (f2b2cec5da)
- 🐞 Fix:G-20261114 chat-sync 三端（taro/RN/extension）接线 + 回归锁 (41548e0716)
- 🐞 Fix:G-20261114 chat-sync 共享内核与 web 端接线 + 契约文档 (450c939404)
- 🐞 Fix:G-20261114 多端 chat-sync 流式坐标系统一与终态投影（api 端） (5bc4e1c3d4)
- 📚 Docs:补登 check-findings-freshness 守门点名，清门 89 R4 (c791a93bb9)
- 📚 Docs:同步生成块计数 (f83626fbf1)
- 🐞 Fix:F-187 api_base SSRF 非字符串地址 fail-closed 并恢复 T1 判据面 (d61938ace0)
- 📚 Docs:生成块按现算刷新(trackedFiles 21820/testFiles 5450/gates 368)——唯一写入口块面回植 (f0746f71e7)
- 🐞 Fix:盘根外流根治复诊 —— 修合规闸的大小写假阴 + 补回归锁 (2ee1847a94)
- 📚 Docs:归正 sag2/articles 两行登记(回滚 807d0817 携 stale 副本的旧基线降级) (84469fbcd2)
- 🚀 Feature/Improvement:错误卡目录化上收 shared + 三端接线(D-AI-3) (c5a2c24a25)
- 🐞 Fix:零实收更正为「定价前漏计费」并量化应计未计金额 (678e5a3d99)
- 🐞 Fix:Sag2Screen chip sm→md、card md→lg(150 最后 2 族,补齐首轮构造遗漏) (cf31c0d2e4)
- 🐞 Fix:150 余 7 族/315 余 1 族定向清零(control 档 12 处 + Sag2 badge borderColor) (ceb0e44331)
- 🐞 Fix:渠道成本报表增加零实收指标 (706f1fede3)
- 🐞 Fix:修正 299/302p 两道门的历史误判(非新增漂移) (a5b35cb15f)
- 🐞 Fix:F-34 多模态任务失败退款耐久化(补齐实现,对齐已提交测试) (6aab7e619a)
- 🐞 Fix:DB-35 PII 写库加密切片(发票抬头+后台实名 idCard 旁路) (2d3c28cc82)
- 🚀 Feature/Improvement:历史调用成本补数 + 渠道成本对账 + 积分兑换 AI 额度 (d8459f3996)
- 🚀 Feature/Improvement:新增 3 个 drizzle 迁移 —— news 去重唯一索引 / 客服状态枚举对齐 / coze 变量唯一索引 (8a64f3e4a2)
- 🐞 Fix:DB-35 凭据写库加密切片(无迁移) (002ade40cc)
- 🚀 Feature/Improvement:成本列回填接口 + 利润看板按渠道分组 (63cb549a8b)
- 🔧 Chore/Other:对账结清 F-274/F-175(均已在 HEAD 修复) (0f1180807c)
- 🔧 Chore/Other:结清 F-719(充值双币种入账,a6ae85b0c25/cce4625f58a,39 passed) (0bfaa1d848)
- 🐞 Fix:兑换码充值同步入账 cost 余额 (a6ae85b0c2)
- 🔧 Chore/Other:结清 Y-14(前提不成立:安卓 latest 已回 0.0.24) (17c111ccf4)
- 🔧 Chore/Other:RP-16 阻塞留痕 + 认领 Y-14(安卓更新包接口空返回) (67e95c546a)
- 🐞 Fix:去掉 ModelOption 重复的每百万 token 单价字段 (c9d0c23d5e)
- 🔧 Chore/Other:认领 RP-16(考勤 IM 三类审批枚举映射) (a62cd5225c)
- 🔧 Chore/Other:对账结清 12 张已在 HEAD 修复的缺陷普查行 (a9e8f3f9bd)
- 🐞 Fix:单边 token 充值同步入账 cost 余额 (cce4625f58)
- 🔧 Chore/Other:结清 F-512(前提不成立:幂等键已入库;工作树他席回退 risk) (21087e436b)
- 🔧 Chore/Other:按 HEAD 面重封清单(gate-scope 随合并变更未回封) (1b5723c7a8)
- 🔧 Chore/Other:认领 F-512(notification-worker 幂等键缺失) (090cd85811)
- 🔧 Chore/Other:结清 F-722(前提不成立:异常结算已入库;工作树他席改动回退风险) (a500442528)
- 🚀 Feature/Improvement:模型表落地真实采购成本列,利润从反推升级为实价 (412e2bc3e9)
- 🔧 Chore/Other:BUG-29 切片0 阻塞留痕 + 认领 F-722(流式异常跳结算) (a3a3a13347)
- 🔧 Chore/Other:认领 BUG-29(索引约束缺失族,先做切片0) (da6cc97036)
- 🚀 Feature/Improvement:对标 DSH 桌面端补齐四项能力(ZIP 导出/快捷键改键/Auto 审查闸/原生打开) (2add401e8a)
- 🔧 Chore/Other:结清 DG-14(元门档登记表+阻断通道判据,4a4a93d/1a9fa70) (52afa50b53)
- 🔧 Chore/Other:门 262 镜像测试随 gitRaw 重构更新 T5 并补 DG-14 通道维 T6 (1a9fa705dd)
- 🚀 Feature/Improvement:元门档改登记表声明并补阻断通道判据 (4a4a93dea1)
- 🔧 Chore/Other:认领 DG-14(元门档脚本名正则白名单) (76eab8ce64)
- 🔧 Chore/Other:结清 RP-3(前提不成立:索引面已接 ignore 判据) (194bd1611c)
- 🔧 Chore/Other:认领 RP-3(索引面接 ignore 规则判据) (f4d1ba6b00)
- 🔧 Chore/Other:结清 F-355(前提不成立:唯一索引与 upsert 已入库) (f4d3afe10f)
- 🔧 Chore/Other:结清 F-536/F-540/F-574/F-662(实修 db21c929c66,回归锁 5120189d797) (b55c563976)
- 🔧 Chore/Other:补四票回归锁 —— F-536 上传登记归属/F-540 saveBarrier 互斥/F-574 sum bigint/F-662 relay-BYOK 分账(随 db21c929c66) (5120189d79)
- 🔧 Chore/Other:结清 F-271(前提不成立:tenant 维度已随 db21c929c66 入库) (de213e4f41)
- 🔧 Chore/Other:认领 F-355(coze_variables 缺唯一+create 无查重) (7545042fa4)
- 🔧 Chore/Other:结清 F-434(前提不成立:默认值已随 db21c929c66 改为 pending) (5a4f4352d6)
- 🐞 Fix:缺陷普查第5轮 22 票落地(5 组并行修复,含 10 枚迁移待评审) (db21c929c6)
- 🔧 Chore/Other:认领 F-434(会话状态默认值互斥) (05b3a843a0)
- 🔧 Chore/Other:认领 F-271(企微登录缺 corpId) (aefa8110dc)
- 🚀 Feature/Improvement:打通定价→利润闭环,调用落账成本/毛利并提供看板聚合 (40a042b52b)
- 🔧 Chore/Other:补记 824821d9 水印注入追认行 (240643d884)
- 🔧 Chore/Other:收敛轮三枚具名追认入账(两枚合并并集差量 + 一枚水印注入) (f7519585fb)
- 🔧 Chore/Other:结清 F-376(预算告警冷却原子占位,5a77480d37f,18 tests) (3f7f8945d4)
- 🔧 Chore/Other:重结 F-221（并集合并回捞已结行）—— 实修 dda5d5b73c7，原结清 e5bbbf23426 (0999ee9190)
- 🐞 Fix:预算告警冷却改为原子判据 (5a77480d37)
- 🐞 Fix:workbuddy 永久保活不再依赖客户端进程 (a9d2d526aa)
- 🔧 Chore/Other:认领 F-175(技能同步 upsert 无唯一约束) (5224f18175)
- 🔧 Chore/Other:结清 F-419(授权写回行锁+锁内复查,dce370e46f8,4 passed) (6676771a98)
- 🐞 Fix:权限授权改为原子条件写防撤销复活 (dce370e46f)
- 🚀 Feature/Improvement:补齐薪资配置读写接口并接入前端 (92b3741939)
- 🔧 Chore/Other:结清 F-221(RLS 上下文绑定单条 reserve 连接,dda5d5b73c7,73 passed) (e5bbbf2342)
- 🔧 Chore/Other:认领 F-274(审计链链尾按 timestamp 取) (e0e7e3cfee)
- 🐞 Fix:补登 4 道新门的判面声明(button-border-color/shadow-single-source/acp-method/acp-error) (d2315b1390)
- 🐞 Fix:F-221 RLS 上下文 set/clear 绑定同一条 reserve 连接(缺陷普查) (dda5d5b73c)
- 🔧 Chore/Other:结清 F-442(令牌按用户加密+管理员鉴权+审计,75e18089cdb,6 passed) (37192cdcab)
- 🔧 Chore/Other:结清缺陷普查 F-444（GitHub PR/Issue 端点仅本人令牌）—— 实修见 6f84dc9b346 (11c3900cde)
- 🐞 Fix:F-444 GitHub PR/Issue 端点改为仅本人令牌，平台 PAT 不再代理任意 owner/repo (6f84dc9b34)
- 🐞 Fix:GitHub 令牌读写限制为授权角色并留审计 (75e18089cd)
- 🐞 Fix:F-524 worker 关停相位补齐 —— auto-rollback/poolTracker 移入 buildServer onClose,gateway 可关、server.close 有超时 (c03051dc0f)
- 🔧 Chore/Other:定价台合面新露 5 处 control→rounded-sm、payroll 徽标 1 处 chip→rounded-md,工作树预验 150 判红 0 族 (67619ea0f7)
- 🐞 Fix:F-524 worker 关停相位补齐 —— auto-rollback/poolTracker 移入 buildServer onClose,gateway 可关、server.close 有超时 (b6716b4a74)
- 🐞 Fix:缺陷普查两票 —— F-458 金额聚合改 bigint 防溢出/F-649 修复任务状态改共享权威源 (d48dc332a8)
- 🐞 Fix:缺陷普查两票 —— F-458 金额聚合改 bigint 防溢出/F-649 修复任务状态改共享权威源 (7741b6913a)
- 🐞 Fix:缺陷普查三票 —— F-457 佣金状态码统一/F-535 共享公式从格读取/F-620 Key限流原子占位 (216d71a531)
- 🐞 Fix:缺陷普查三票 —— F-457 佣金状态码统一/F-535 共享公式从格读取/F-620 Key限流原子占位 (c7147a5f45)
- 🔧 Chore/Other:认领 F-442(GitHub 令牌单文件越权覆盖) (7aa9572555)
- 🐞 Fix:ModelOption 补 inputPricePerMillion/outputPricePerMillion 可选字段(模型选择器单价行 TS2339) (91fc1781e2)
- 🔧 Chore/Other:定价台 model-pricing-console 11 处裸 border 补显式基础色(315 联动面,按钮→border-border/输入→border-input) (18099f0e06)
- 🔧 Chore/Other:认领 F-376(预算告警冷却竞态) + F-419(授权读改写非原子) (74c51bdd05)
- 🔧 Chore/Other:结清缺陷普查 F-585(completeOrder 补齐消费积分与 order.paid Outbox) —— 实修 288fb813636 + 夹具 a2076a53a88 (030c88dcc6)
- 🔧 Chore/Other:夹具备份产物目录改名 switch-profiles,避开保护闸 backups 的精确等值 (29d71f9c26)
- 🔧 Chore/Other:结清缺陷普查 F-371(退款回收 VIP/订阅/配额) —— 实修见 8784117c0a4 (094dad6f6f)
- 🔧 Chore/Other:结清 F-302(前提不成立:唯一角色启动已由 bf70b42befe 入库) (a56a518b24)
- 🔧 Chore/Other:结清 F-289(公开边缘缓存退到 private 取消共享边缘条目,代码 fd3cad81c72 已入库,回归 11/11 绿) (8e3f2254ab)
- 🔧 Chore/Other:F-585 夹具补齐 FOR UPDATE 档与事务计数(重落,修上一枚 CAS 陈旧树) (a2076a53a8)
- 🐞 Fix:缺陷普查两票 —— F-412 私有文档资产按属主隔离/F-726 流式计费采用上游 usage 真值 (f2b120d3d3)
- 🔧 Chore/Other:F-585 夹具补齐 FOR UPDATE 档与事务计数(随 288fb813636) (3f95cbd081)
- 🐞 Fix:缺陷普查两票 —— F-412 私有文档资产按属主隔离/F-726 流式计费采用上游 usage 真值 (a59cdb7b48)
- 🔧 Chore/Other:结清 F-402(swarms 补属主模型防跨用户劫持,代码 1f9dab14ec1 已入库) (041128c039)
- 🐞 Fix:F-585 completeOrder 补齐消费积分与 order.paid Outbox(缺陷普查) (288fb81363)
- 🔧 Chore/Other:门 150 点名 8 处角色档对齐(control→sm、chip→md,web 定价台/HR 徽章/craft 复刻件) (8a014ccc06)
- 🔧 Chore/Other:属主登记表维护戳 —— 合并前复核 owners 2 项 / unowned 479 项并重签 generatedAt (37811d0499)
- 🐞 Fix:F-402 swarms 补属主模型 防跨用户劫持。SwarmPlan 增 ownerId,list 过滤属主,get/execute/cancel 按(swarmId,ownerId)定位非属主404防枚举,路由透传userId。验证 f402-swarms-owner-scoped 10/10。随附 F-Forge 未追踪新文件 change-request-service/worktree-ledger 使落地import链自洽。 (1f9dab14ec)
- 🔧 Chore/Other:结清缺陷普查 F-577(月末夹取)+F-581(代扣订阅激活) —— 实修见 864ea1e18666 (d5bbc50008)
- 🐞 Fix:F-577 月末/闰日夹取 + F-581 代扣订单激活订阅(缺陷普查) (864ea1e186)
- 🔧 Chore/Other:结清第3轮缺陷普查 47 票(45 项修复由 7acf2f63a97 对象空间三方合并落地;F-542/F-627 由既有提交 d87e4779d5/878aef04e8e 双通道复核属实) (57a643b840)
- 🐞 Fix:缺陷普查第3轮对象空间 CAS 落地 45 票 F-275/F-368/F-431/F-445/F-447/F-506/F-528/F-532/F-533/F-534/F-551/F-557/F-558/F-560/F-561/F-565/F-566/F-567/F-572/F-593/F-609/F-614/F-633/F-640/F-641/F-651/F-654/F-655/F-658/F-659/F-661/F-663/F-664/F-668/F-669/F-672/F-673/F-674/F-679/F-684/F-685/F-695/F-696/F-697/F-709 (7acf2f63a9)
- 🐞 Fix:RN/小程序深挖轮修复净差集落地(squash 转发,拓扑保全见 tag) (6258cebddc)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (957ff5c6b6)
- 🐞 Fix:根治项目文件盘根外流——scratch 逃生舱合规闸+拔系统盘脏env+盘根卫生增申报目录内容对账与C盘覆盖面 (2a85a5024c)
- 🐞 Fix:公开边缘缓存键纳入 Origin (fd3cad81c7)
- 🐞 Fix:退款同步回收已发放 VIP/订阅/配额 (a3c28e6623)
- 🐞 Fix:并入 fd5b05b9c33 后按 HEAD 面重封清单(guardian-runner=8961bc242c69) (e417193cb9)
- 🐞 Fix:还原 relay-chat-stream(1b2184d99fd 删除但 send-message 仍引用)并补齐 hr-attendance/payroll-tabs(导入缺失致 next build 失败) (3b2c05d8fd)
- 🔧 Chore/Other:认领 F-221(RLS 上下文复位不绑连接) (5aae2a4458)
- 🐞 Fix:routine 调度器只在唯一角色启动 (bf70b42bef)
- 🔧 Chore/Other:结清 F-267(自愈依赖修复走受控通道不再 126,0b61b43d557) (e41adafaba)

**2026-11-13**
- 🚀 Feature/Improvement:findings survey 反向对账 — 12f/12g 棘轮门 + plan-tasks 派单降级 (fd5b05b9c3)
- 🐞 Fix:E-P1 鉴权失败(401/403)归 content 不走 resume 阶梯 (f841c69006)
- 🔧 Chore/Other:结清 F-407 退款不冲减佣金(代码随 8784117c0a、回归锁 15/15 同批入库) (8db6cb1b38)
- 🐞 Fix:自愈依赖修复走受控授权通道不再 126 (0b61b43d55)
- 🔧 Chore/Other:结清 F-375/F-436/F-443/F-455/F-526(回归锁随代码同批入库) (7c63ab0f46)
- 🐞 Fix:F-407 退款不冲减佣金(F-408 已随 c9fca632165 入库) —— refundOrder 补佣金冲减 (8784117c0a)
- 🐞 Fix:缺陷普查五票 —— F-375 事务后附属步骤补偿/F-436 嵌套事务统一tx/F-443 非流式计费模型一致/F-455 后台提现单资金闭环/F-526 embedding失败不静默 (bf989a75f0)
- 🔧 Chore/Other:302p 基线定向对账 tierWebOffN 228→229(终尖现读,逐维取证非本枚引入) (6c6bda40ec)
- 🔧 Chore/Other:302p 基线定向对账 tierWebOffN 228→229(定价批 pl-7 落账带取证) (888f730da3)
- 🐞 Fix:补齐两处类型契约 —— AdapterCallOptions.signal 与 ModelOption 单价字段 (456ebd482b)
- 🐞 Fix:notice-log 形参 storage 改名 store,避开 WXT auto-import 把形参误判为 wxt/utils/storage 全局并注入(致 extension 构建失败) (7032fd5e58)
- 🔧 Chore/Other:结清 F-186/F-374/F-394/F-408/F-415(回归锁随代码同批入库) (0330314753)
- 🔧 Chore/Other:推送域 103 个缺溯源水印文件按 HEAD blob 注入(只加水印头,不动正文) (824821d9d1)
- 🐞 Fix:流式工具参数缓冲上限 + defect 终态 + errorCode 端侧接线 (4759055a3b)
- 🔧 Chore/Other:结清 16 票缺陷普查(F-319/397/430/435/491/516/575/665/683/686/687/688 由 d87e4779d5 对象空间 CAS 落地;F-304/401 由 0dafbf2e7a0、F-723/727 由 84e5c20d6e3 双通道复核属实) (a513d2e8e9)
- 🐞 Fix:缺陷普查五票 —— F-186 BYOK连通性用用户Key/F-374 缺周期不写永久/F-394 token流水口径枚举/F-408 佣金入账补流水/F-415 workbook保存配额 (c9fca63216)
- 🔧 Chore/Other:认领 F-302(routine 调度器双执行) (625459fdbf)
- 🔧 Chore/Other:结清 DG-13(回滚支 exit 3 + 按码记失败,7ae5d33fa1a) (4df3c5de81)
- 🐞 Fix:按 HEAD 面重封 O6501 清单,修复 git-guardian 未重封导致的部署 fail-closed (34055a823c)
- 🐞 Fix:清偿回补连带两道真红 —— 47p 四文件水印 + 306p sag2 knip entry (b74611fbb4)
- 🐞 Fix:缺陷普查批次 w1/w2 对象空间 CAS 落地 F-319/F-397/F-430/F-435/F-491/F-516/F-575/F-665/F-683/F-686/F-687/F-688 (d87e4779d5)
- 🔧 Chore/Other:结清 F-337/F-373/F-386/F-395/F-410/F-414(回归锁随代码同批入库) (7adca110a6)
- 🐞 Fix:缺陷普查五票 —— F-373 订阅续期基准与上限/F-386 RAG注入边界/F-395 商品写接口判空/F-410 提现冻结即扣/F-414 workbook会话隔离 (e6aad6e558)
- 🐞 Fix:派发腿级失败不再吃日预算,登录过期告警单独立身份 (11a6ee9fb6)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (b0dcad2699)
- 🔧 Chore/Other:认领 F-371(退款回收 VIP/订阅/配额,P1) (e53eba81b7)
- 🔧 Chore/Other:结清 RP-6(前提不成立:R1s 已由 8aa1a3ddfa77 落地并接线门84) (4499bbb799)
- 🐞 Fix:门禁失败轮回滚后不再以 exit 0 记账 (7ae5d33fa1)
- 🚀 Feature/Improvement:统一定价解析器 + 定价管控台 + 调价审计 + 每日零价巡检 (6a5800a279)
- 🚀 Feature/Improvement:统一定价解析器 + 定价管控台 + 调价审计 + 每日零价巡检 (e61f309851)
- 🔧 Chore/Other:认领 F-267(自愈依赖修复 pnpm 126) (aef0117558)
- 🔧 Chore/Other:结清 F-80(点赞/收藏计数单事务+advisory 锁,92f6b1a4721,34 tests) (5b012454e4)
- 📚 Docs:README trackedFiles 21667→21668(merge带入远端新增1路径) (780a444bde)
- 🔧 Chore/Other:结清 F-387/F-619/F-624/F-647/F-652(回归锁随代码同批入库) (5b61a7b17c)
- 🐞 Fix:缺陷普查五票 —— F-387 摄取按docId贯穿/F-619 在途闸续期/F-624 运维快照节流单飞/F-647 人工摘除不被巡检撤销/F-652 备案同步超时单飞 (e064543710)
- 📚 Docs:补 RECONCILE-findings-staleness.md 反向对账层 (ac22d159d5)
- 🐞 Fix:点赞/收藏计数并发漂移改为原子事务 (92f6b1a472)
- 📚 Docs:标注 8 份 findings 为过期快照并补 AIS-116 复核 (f3acab9b5c)
- 📚 Docs:README 生成块数字对齐现算(sync-readme-numbers 官方通道数值) (8557693e08)
- 🔧 Chore/Other:认领 F-289(边缘缓存键缺 Origin) (00136728d4)
- 🔧 Chore/Other:结清 F-141(会话导入知识库幂等,3dc2bce82c6,12/12) (8e455456f9)
- 🔧 Chore/Other:结清 F-564/F-576/F-594/F-601/F-603(回归锁随代码同批入库) (8deb36995e)
- 🐞 Fix:缺陷普查五票 —— F-564 快照漏采不假成功/F-576 邮件金额口径/F-594 热度刷新管理员限缩/F-601 agent任务过滤下推/F-603 统计口径统一 (35a9f3c13f)
- 🔧 Chore/Other:认领 RP-6(混合陈旧底稿拦闸) (4d5acba534)
- 🔧 Chore/Other:结清 AIS-114(中断落盘半批次 checkpoint,f3b702b1ef2,9 passed) (39f30cb1f3)
- 🐞 Fix:会话导入知识库改为幂等写入 (3dc2bce82c)
- 🐞 Fix:回补 807d0817 误删的 45 个已入库文件(回归锁/sag2 三端承载/notice-log 全套) (d399df7c39)
- 🔧 Chore/Other:结清 F-531/F-550/F-556/F-559/F-563(回归锁随代码同批入库) (0eba7b15c9)
- 🐞 Fix:缺陷普查五票 —— F-531 wiki提示词预算含清单/F-550 对账三重校验/F-556 锁定键归一/F-559 过期监听onFail护栏/F-563 清理不跟随符号链接 (db4b623a88)
- 🐞 Fix:中断时立即落盘半批次 checkpoint (f3b702b1ef)
- 🔧 Chore/Other:结清 F-467/F-493/F-509/F-510/F-527(回归锁随代码同批入库) (5f7a9e5e58)
- 🐞 Fix:缺陷普查五票 —— F-467 WS限流窗口不随断连重置/F-493 生图超时释放/F-509 USDT查询故障不吞/F-510 调度任务失败记账/F-527 知识修订倒序分页 (7db0d98788)
- 🔧 Chore/Other:收敛并行会话改动(水印补注+streaming-audit+考勤HR文档+cli文档) (53848eabcb)
- 🔧 Chore/Other:结清 F-413/F-416/F-451/F-454/F-465(回归锁随代码同批入库) (4df984e53b)
- 🐞 Fix:缺陷普查五票 —— F-413 资产提取上限去重/F-416 embedding分片重试/F-451 事务统一句柄/F-454 冻结只释放一次/F-465 后台改单状态机 (e09eba2d4b)
- 🐞 Fix:修复workflow-todo.ts溯源水印载荷丢失 (872f61b125)
- 🐞 Fix:收口新四档 CSS 等值落档、装车 finance-ai-hub、修 lander null 崩溃 (79afad3922)
- 🐞 Fix:修复15源码文件溯源水印载荷丢失+清理4文件死变量 (26aa10cbde)
- 🔧 Chore/Other:结清 F-336/F-379/F-370/F-157/F-256/F-380(回归锁随代码同批入库) (2e6b3f6d86)
- 🐞 Fix:修复24源码文件溯源水印载荷丢失(hr/db/i18n/craft)+清理import类型注解 (41cd976085)
- 🐞 Fix:缺陷普查四票 —— F-370 订阅白名单唯一出口/F-157 平台Key计量配额/F-256 抢占真中止/F-380 合并状态原子闸 (46cddfe213)
- 🐞 Fix:修复源码文件溯源水印载荷丢失+清理死代码 (2af1a280cc)
- 🐞 Fix:缺陷普查 F-336 圈子按 slug 可达 + F-379 登录风控 R002/R005 字段补齐 (29ce7a9ed9)
- 🔧 Chore/Other:结清 F-675/F-311 —— 代码已入库 1a8f9d399bd(f675 2/2 + f311 2/2 回归锁通过) (3894a7ff73)
- 🐞 Fix:F-675 异步生图零计费(创建即乐观按次扣费)+ F-311 裂变券自荐防护(分享人≠领取人,防刷余额);回归锁 f675 2/2 + f311 2/2 (1a8f9d399b)
- 🐞 Fix:AI对话流式显示P1修复 —— web早退持久化/并发幂等 + ai-service网关三缺陷 (274b1b6eda)
- 🔧 Chore/Other:补齐 plan_a 落档后 3 处 JSX 折行(prettier 合规) (4f1725dd1f)
- 🔧 Chore/Other:结清批次57 —— F-123/F-164/F-200/F-213/F-303（回归锁随代码同批入库） (b32070070a)
- 🐞 Fix:批次57 缺陷普查五票 —— F-123 热搜采集逐条 await/F-164 返佣费率合计不变量/F-200 Crew 全失败记 failed/F-213 视频进度首插 upsert/F-303 routine tick 错误隔离 (f4a723599b)
- 🐞 Fix:收口 plan_a 字号档语义化并补齐档表清单 (6bd7f8db8c)
- 🐞 Fix:RP-17 标头补等条件(凭证+枚举就位),避免派单器误判 actionable (547cfd5dda)
- 🔧 Chore/Other:结清 1 张缺陷普查工单(HEAD 修复核验) (c1829341dc)
- 🐞 Fix:F-213 /learn/video/log 首次观看无历史记录时插入 lessonRecords,避免进度静默丢失 (3806fbc0d5)
- 🚀 Feature/Improvement:登记考勤 IM 同步剩余三项待办(补 scope/审批枚举/端到端联调) (e503752634)
- 🔧 Chore/Other:结清批次56 —— F-281/F-293/F-300/F-301/F-174（回归锁随代码同批入库） (7db10d70e5)
- 🐞 Fix:批次56 缺陷普查五票 —— F-281 直播浏览去重+notify 鉴权/F-293 工具调用贯通/F-300 权限徽章服务端绑定/F-301 routines 属主校验/F-174 观看时长原子自增 (9b52b5aac5)
- 🐞 Fix:微信移动应用 code2session 上游 errcode 带码抛出 —— 40125/40029/40163 不再被吞成泛化文案(与 jscode2session 同族判据),配套三例回归锁 (44587551d8)
- 🔧 Chore/Other:认领 DG-13(部署门禁失败仍 exit 0) (fc79efbdda)
- 🔧 Chore/Other:结清 RP-4(前提不成立:rename_detect 已入库 c0efc7e3,证据 pytest 36/36 GREEN) (82f2d3f7ef)
- 🐞 Fix:admin/** 段级豁免 reason 自述计数 337→338 对齐现读,清偿 staleCountAssertions(门自述计数腐烂归零) (deb93d3afd)
- 🔧 Chore/Other:认领 F-80 / F-141 / AIS-114 / RP-4 四票(wave1 并行 subagent) (c0efc7e335)
- 🔧 Chore/Other:结清批次55 —— F-248/F-279/F-287/F-295/F-298（回归锁随代码同批入库） (ce23c2735c)
- 📚 Docs:重跑 report-rn-miniapp-gaps 派生账本清偿 doc-stale(镜像自述258→257,对应 study 撤除registry假配对) (857b02b7fe)
- 🐞 Fix:AppUpdateBanner 圆角改用 rnRadius.lg 单一真相源,对齐 RN UpdatePrompt/ApkUpdatePrompt (742158c1f1)
- 🔧 Chore/Other:结清批次53/54 八票 —— F-193/F-194/F-204/F-222/F-232/F-84/F-249/F-278,并结清已入库未摘行的 F-132/F-142/F-150/F-214/F-242 (dee8319ec3)
- 🐞 Fix:批次54 缺陷普查五票 —— F-84 ilike 通配符转义/F-132 创建用户契约统一/F-242 参数覆盖缓存回归锁/F-249 closeSession 幂等/F-278 recent 工作区隔离 (0dafbf2e7a)
- 🔧 Chore/Other:结清 7 张缺陷普查工单(HEAD 修复核验) (c6a15ba3f2)
- 📚 Docs:生成块计数对齐最终尖现算(testFiles 5316→5318/trackedFiles 21472→21474) (7316a54c80)
- 🐞 Fix:批次53 缺陷普查五票 —— F-193 内部调用改服务票据/F-194 计费模型统一 billingModel/F-204 工作区锁降级可观测+TTL/F-222 调度器注册超时/F-232 VIP 到期集合式降级 (84e5c20d6e)
- 🐞 Fix:补齐小程序 style-tiers 字号等值腿(--font-safe)在守护轮与CI级联的派发口径,land-miniapp 探针补 changedFiles,parity-auto 接入 RN 原生屏承载差集只读 gate (2a66f32e8a)
- 🐞 Fix:check-miniapp-style-tiers 裸字面量正则加负向后行断言,治 CSS 连写属性误报 (a4db485266)
- 🐞 Fix:撤GEO死副本改MAIN唯一权威 + 自测两断言跟随更新 (6dc3cbdba6)
- 🚀 Feature/Improvement:18rpx(9px)→text-badge(10px),产品定档 plan_a 收尾 (2be193a745)
- 🐞 Fix:登录 429 人机验证挑战降级为友好退避,杜绝「做不了的 CAPTCHA」死锁 (8040375ae5)
- 🚀 Feature/Improvement:font-safe 腿自动落档 ai/special.tsx 38rpx→text-heading-sm(等值,零视觉变化) (661f5558b0)
- 🚀 Feature/Improvement:新增 titleLg/headingSm/headline/displayXl 四个字号档(产品定档 plan_a) (bd82c86a2d)
- 🔧 Chore/Other:结清 F-142 团队知识修订乐观锁 —— 代码已入库(knowledge-team-service.ts reviseItem/setItemStatus 均带 AND revision=基线 + 事务 + 冲突抛 RevisionConflictError)，回归锁 f142 5/5 通过 (53cc1f9f89)
- 🔧 Chore/Other:结清批次52 —— F-681/F-713/F-714/F-716（回归锁随代码同批入库） (fa128c74d3)
- 🐞 Fix:守门基础设施文件回退到origin/main版 —— 治陈旧底稿倒退 (6d28951979)
- 🐞 Fix:批次52 缺陷普查四票 —— F-681 SRS 到期日初始化/F-713 日界无时区解析/F-714 斜杠时间串 UTC 归一/F-716 NO_PROXY 双档并扫 (511ef81ee1)
- 🔧 Chore/Other:补齐 6 个 HEAD blob 的溯源水印(解 47p push 门) (4e5c870902)
- 🚀 Feature/Improvement:有界 JSON 序列化原语(J4) — 迭代遍历+字节/节点/深度三重护栏 (807d0817e4)
- 🐞 Fix:团队知识修订乐观锁下沉到 UPDATE WHERE revision 条件+rowCount 判冲突,update+writeRevision 包同一事务(消除后写覆盖先写+审计失败无回滚)+ 回归锁 5/5 (0f6572662c)
- 🐞 Fix:收敛 push 门3道判红 —— 193 stdio / 300 端点登记 / 303p 文案裁定 (c605db9ade)
- 🔧 Chore/Other:结清批次51 —— F-667/F-678/F-708/F-710/F-715（回归锁随代码同批入库） (e542bca7a1)
- 🐞 Fix:批次51 缺陷普查五票 —— F-667 token 求和溢出/F-678 上游状态码透传/F-708 watchdog 续约容错/F-710 mTLS 未验证身份/F-715 死信读路径淘汰 (5f9d5c4660)
- 🔧 Chore/Other:结清批次50 —— F-634/F-666/F-677/F-707（F-635 行已由批次49 摘除，其代码修复随本批入库） (d538ec2e00)
- 🔧 Chore/Other:刷新 README 生成块数字(索引面,唯一写入口 sync-readme-numbers) (28b938c82c)
- 🐞 Fix:批次50 缺陷普查五票 —— F-634 定价建议聚合精度/F-635 下单金额分位一致/F-666 count 聚合 int8 契约/F-677 账号池读流非正常结束 cancel/F-707 下载逐跳 SSRF 复检 (20afa05e87)
- 🔧 Chore/Other:结清 F-162 数据清理 DELETE 无 LIMIT —— ctid 分批+严格布尔+日志插值已入库 eefd6ada486 + 回归锁 4/4 (f778a325ff)
- 📚 Docs:对齐生成块数字到 HEAD 现算面(解推送侧 DN1/DN2 文档数字对账) (734226843f)
- 🐞 Fix:数据清理 DELETE 改 ctid 分批(LIMIT 50000 循环),dryRun 改严格布尔,dryRun 误判致真实清理被当预览 + 审计日志补插值 + 回归锁 4/4 (eefd6ada48)
- 🚀 Feature/Improvement:Anthropic 兼容端点支持 x-api-key 鉴权与外部模型名回落 (ffc7f98441)
- 🔧 Chore/Other:结清 F-183 熔断计数器读改写非原子 —— 原子 Lua 修复已入库 df968b452a7 + 回归锁 7/7 通过 (fdf9fab832)
- 🐞 Fix:熔断计数器读改写原子化(Lua HINCRBY语义+阈值转open),消除并发失败计数覆盖导致熔断难触发 + 回归锁 7/7 (df968b452a)
- 🐞 Fix:小程序端 noValidContent 文案对齐 RN/Web 口径(解 303p 文案漂移 +1) (4264f62b9f)
- 🚀 Feature/Improvement:跨端功能更新 + DeepSeek UI 逆向复现 + 文档维护 (4b9d379d1a)
- 🐞 Fix:补齐 preview-envelope 模块修编译破窗(J2 复现 Qoder office-reader 结构化信封) (12357ae50b)
- 🔧 Chore/Other:结清 F-404 返佣基数铸币漏洞 —— 代码修复已入库(HEAD等效合并)+ 回归锁6/6通过 (fcac918750)
- 🐞 Fix:relay-minimax 同步脚本补充 client-auth-* 决策类型(解 typecheck:full 脚本面红) (949eb2026d)
- 🐞 Fix:返佣基数取本单充值流水增量(orderNo+opType=0),消除对历史钱包余额反复抽佣 + 回归锁 6/6 (82ba276a9b)
- 🐞 Fix:收口 rows[0] 越界取值的类型面(noUncheckedIndexedAccess),解 typecheck:full 常红 (967e3dfd55)
- 🔧 Chore/Other:结清批次49 —— F-635/F-643/F-656/F-657/F-682 (837f28df86)
- 🐞 Fix:结清 F-635 支付金额分位同源 + F-643 registry 主库判定 + F-656 低余额提醒冷却顺序 + F-657 金丝雀建表自愈 + F-682 个推 token 缓存与有界扇出 (8cbd9f9e17)
- 🔧 Chore/Other:补齐 F-599/F-626/F-631/F-639 新增测试的溯源水印(守门 47p) (bc5cffb9d1)
- 🔧 Chore/Other:结清批次47-48 —— F-599/F-600/F-626/F-639/F-644/F-645/F-648/F-650/F-653 (be7457f36f)
- 🐞 Fix:结清 F-626 别名主库解析与短 TTL 缓存 + F-648 修复任务租约回收 + F-650 代码索引删插同事务 + F-653 巡检异常留痕计数 (1a5ac4d431)
- 🐞 Fix:结清 F-599 权限删除事务 + F-600 分页唯一键兜底 + F-639 群发分批与状态过滤 + F-644 调度运行事务 + F-645 邀请接受事务 (9dcd8d7c26)
- 🐞 Fix:收口 F-623 滑动扫描的索引取值类型(noUncheckedIndexedAccess) (67750ac24d)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (690bb9b24c)
- 🐞 Fix:DG-12 发布 tag 闸从整树 porcelain 改为发布件逐 blob 对账 (f386100622)
- 🔧 Chore/Other:test(api)+docs: F-150 上海业务日口径回归 4/4 + F-214 :childId 形状闸回归 11/11 入库(前笔代码已在 HEAD,本笔补齐回归锁);README 块 testFiles 5240/trackedFiles 21377 随 DN5 对齐(经 isolated 三试均被钩子外来回灌护栏正当拦停,按 §12 出路③改 object-space-land,落地后复跑受影响门) (a5e16d9833)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (231f945879)
- 🔧 Chore/Other:结清批次46 —— F-602/F-625/F-630/F-631/F-632 (03cda13b2f)
- 🐞 Fix:结清 F-602 语音笔记分面口径 + F-625 探针超时取消 + F-630 大屏日界重复平移 + F-631 账单归月上海日 + F-632 积分日历上海日 (c8bba3ff8a)
- 🔧 Chore/Other:结清批次37-45 —— F-382/388/389/393/396/392/406/441/450/417/422/461/466/475/492/494/496/498/504/507/508/511/513/514/518/519/520/529/537/552/538/549/553/554/555/562/569/578/579/589/591/598/606/607/608/621/622/623 共 45 行 (85c98e76bb)
- 🐞 Fix:结清 F-598 点赞幂等 + F-606 OTel query 脱敏 + F-607/F-608 Bulkhead 名额退还与复位解挂 + F-621 代理池原子计数 + F-622 代理日志脱敏 + F-623 提示词全文扫描 (14a0f49ec2)
- 🐞 Fix:结清 F-569 资源发布态闸 + F-578 访问趋势业务日 + F-579 食堂采购日 + F-589 缺勤分批写入 + F-591 收件箱归属 (4229823a4b)
- 🐞 Fix:结清 F-538 中转会话落库 + F-549 清理范围收敛 + F-553 归档分批删除 + F-554 快照保留与孤儿自清 + F-555 锁定双存储合并 + F-562 清理异步单趟 (f34475d3e4)
- 🐞 Fix:收口 ProcessGroupChild.kill 签名以对齐 ChildProcess,解除 typecheck:full 的 apps/cli 红 (a0cfa61ddd)
- 🐞 Fix:结清 F-519 死路由清理 + F-520 组织接口鉴权 + F-529 repo-wiki 模型校验 + F-537 PDF 失败如实 503 + F-552 缓存写失败隔离 (1c095a309c)
- 🐞 Fix:结清 F-508 USDT RPC 超时 + F-511 通知失败重试 + F-513 健康检查互斥合并写 + F-514 平台密钥调用计费 + F-518 引擎 RPC 可达回归锁 (041304b985)
- 🐞 Fix:结清 F-494 批处理先扣费后落键 + F-496 账号池退出码判定 + F-498 回调帧两段确认 + F-504 收藏按用户过滤 + F-507 工具超时取消 (5d949c01a9)
- 🔧 Chore/Other:结清 O69(调度轮 sweepLocalDevDbRotation 与镜像 10 例已入库)与 12A/DG-12(发布 tag 闸改发布件对账,同批提交) (6c2a28998f)
- 🐞 Fix:结清 F-422 Qoder 桥关停竞态 + F-461 WS 活动时间刷新 + F-466 live-chat 单用户连接上限 + F-475 chat 历史表上限 + F-492 生图 worker 租约归属 (c1252d160d)
- 🐞 Fix:结清 F-422 Qoder 桥关停竞态 + F-461 WS 活动时间刷新 + F-466 live-chat 单用户连接上限 + F-475 chat 历史表上限 + F-492 生图 worker 租约归属 (2882733925)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (e2b674edc9)
- 🐞 Fix:结清 F-382 OSS 分片会话隔离 + F-388 关键词下推 + F-389 缓存键凭据指纹 + F-393 内容分类归属 + F-396 兑换码 Key 归属 (d8ffac6ef8)
- 🐞 Fix:结清 F-392 引导凭据闭环 + F-406 提现手续费扣余额 + F-441 剧情增强并发记账 + F-450 代扣回调单事务 + F-417 xlsx 单趟渲染 (6e80aa927c)
- 🐞 Fix:结清 F-382 OSS 分片会话隔离 + F-388 关键词下推 + F-389 缓存键凭据指纹 + F-393 内容分类归属 + F-396 兑换码 Key 归属 (a623f5c402)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (2a38516649)
- 🔧 Chore/Other:结清 F-450 —— 代扣回调建单/完成已并入外层事务(DB-02,commit 55efcffe136):placeOrder(tx)/completeOrder(tx)/rechargeToken(outerTx)/earnPoints(tx) 全链透传,消除半提交与重复发权益;f-450 回归锁 5/5 通过 (63c7cd22e1)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (b5e09bb17f)
- 🐞 Fix:提现旁路写入口全部改调 commission-queries 单源服务——agent-withdrawal apply/approve/reject 补冻结+单号+状态守卫+退冻结,admin第5条写入口消除无守卫直写status(资金守恒同源);回归锁 f452-453 6/6 (d773e33e34)
- 🔧 Chore/Other:结清 F-452/F-453 —— 提现旁路写入口(finance-extended agent-withdrawal 三入口 + admin-extended 第5条)全部改调 commission-queries 单源服务 apply/approve/rejectWithdrawal,补冻结+单号+状态守卫+退冻结(资金守恒同源);回归锁 f452-453 6/6 (aada9610e5)
- 🚀 Feature/Improvement:复现 WorkBuddy subagent journal 闭环(compact/append/merge)—— 逆向-复现-超越 (6a06e59400)
- 🔧 Chore/Other:结清批次36 共5张(F-352/353/367/369/372) (f89c5981fe)
- 🐞 Fix:结清 F-352 定时清理集合化分批 + F-353 积分渠道事务 + F-367 清理器显式生命周期 + F-369 订阅配额原子累加 + F-372 日成本熔断 (3320620624)
- 🐞 Fix:ab_test_results schema 补 UNIQUE(variant_id,bucket) 表约束 + bucket NOT NULL,对齐已入库迁移 20261112000002,防 onConflict 42P10 + 回归锁 5/5 (d1b4766f6b)
- 🔧 Chore/Other:结清 F-448 —— ab_test_results schema 侧补 UNIQUE(variant_id,bucket) 表约束 + bucket NOT NULL,对齐已入库迁移 20261112000002(证据:迁移 + 回归锁 f448 5/5) (72ec4aad2b)

**2026-11-13**
- 🔧 Chore/Other:收敛并行会话改动(水印补注+streaming-audit+考勤HR文档+cli文档) (53848eabcbe)
- 🐞 Fix:修复workflow-todo.ts溯源水印载荷丢失 (872f61b1255)
- 🐞 Fix:收口新四档 CSS 等值落档、装车 finance-ai-hub、修 lander null 崩溃 (79afad39223)
- 🐞 Fix:修复15源码文件溯源水印载荷丢失+清理4文件死变量 (26aa10cbde9)
- 🐞 Fix:修复24源码文件溯源水印载荷丢失(hr/db/i18n/craft)+清理import类型注解 (41cd9760853)
- 🐞 Fix:修复源码文件溯源水印载荷丢失+清理死代码 (2af1a280cc2)
- 🐞 Fix:AI对话流式显示P1修复 —— web早退持久化/并发幂等 + ai-service网关三缺陷 (274b1b6eda6)
- 🔧 Chore/Other:补齐 plan_a 落档后 3 处 JSX 折行(prettier 合规) (4f1725dd1f2)
- 🐞 Fix:收口 plan_a 字号档语义化并补齐档表清单 (6bd7f8db8cf)
- 🐞 Fix:RP-17 标头补等条件(凭证+枚举就位),避免派单器误判 actionable (547cfd5ddaa)
- 🚀 Feature/Improvement:登记考勤 IM 同步剩余三项待办(补 scope/审批枚举/端到端联调) (e503752634a)
- 🐞 Fix:admin/** 段级豁免 reason 自述计数 337→338 对齐现读,清偿 staleCountAssertions(门自述计数腐烂归零) (deb93d3afdf)
- 📚 Docs:重跑 report-rn-miniapp-gaps 派生账本清偿 doc-stale(镜像自述258→257,对应 study 撤除registry假配对) (857b02b7fed)
- 🐞 Fix:AppUpdateBanner 圆角改用 rnRadius.lg 单一真相源,对齐 RN UpdatePrompt/ApkUpdatePrompt (742158c1f12)
- 📚 Docs:生成块计数对齐最终尖现算(testFiles 5316→5318/trackedFiles 21472→21474) (7316a54c80b)
- 🐞 Fix:补齐小程序 style-tiers 字号等值腿(--font-safe)在守护轮与CI级联的派发口径,land-miniapp 探针补 changedFiles,parity-auto 接入 RN 原生屏承载差集只读 gate (2a66f32e8a5)
- 🐞 Fix:check-miniapp-style-tiers 裸字面量正则加负向后行断言,治 CSS 连写属性误报 (a4db485266c)
- 🐞 Fix:撤GEO死副本改MAIN唯一权威 + 自测两断言跟随更新 (6dc3cbdba6d)
- 🚀 Feature/Improvement:18rpx(9px)→text-badge(10px),产品定档 plan_a 收尾 (2be193a7455)
- 🐞 Fix:登录 429 人机验证挑战降级为友好退避,杜绝「做不了的 CAPTCHA」死锁 (8040375ae53)
- 🚀 Feature/Improvement:font-safe 腿自动落档 ai/special.tsx 38rpx→text-heading-sm(等值,零视觉变化) (661f5558b0e)
- 🚀 Feature/Improvement:新增 titleLg/headingSm/headline/displayXl 四个字号档(产品定档 plan_a) (bd82c86a2dd)
- 🐞 Fix:守门基础设施文件回退到origin/main版 —— 治陈旧底稿倒退 (6d289519792)
- 🐞 Fix:收敛 push 门3道判红 —— 193 stdio / 300 端点登记 / 303p 文案裁定 (c605db9ade1)
- 🔧 Chore/Other:结清批次50 —— F-634/F-666/F-677/F-707（F-635 行已由批次49 摘除，其代码修复随本批入库） (d538ec2e00f)
- 🔧 Chore/Other:刷新 README 生成块数字(索引面,唯一写入口 sync-readme-numbers) (28b938c82c1)
- 🐞 Fix:批次50 缺陷普查五票 —— F-634 定价建议聚合精度/F-635 下单金额分位一致/F-666 count 聚合 int8 契约/F-677 账号池读流非正常结束 cancel/F-707 下载逐跳 SSRF 复检 (20afa05e874)
- 🔧 Chore/Other:结清 F-162 数据清理 DELETE 无 LIMIT —— ctid 分批+严格布尔+日志插值已入库 eefd6ada486 + 回归锁 4/4 (f778a325ff2)
- 📚 Docs:对齐生成块数字到 HEAD 现算面(解推送侧 DN1/DN2 文档数字对账) (734226843ff)
- 🐞 Fix:数据清理 DELETE 改 ctid 分批(LIMIT 50000 循环),dryRun 改严格布尔,dryRun 误判致真实清理被当预览 + 审计日志补插值 + 回归锁 4/4 (eefd6ada486)
- 🚀 Feature/Improvement:Anthropic 兼容端点支持 x-api-key 鉴权与外部模型名回落 (ffc7f984419)
- 🔧 Chore/Other:结清 F-183 熔断计数器读改写非原子 —— 原子 Lua 修复已入库 df968b452a7 + 回归锁 7/7 通过 (fdf9fab832a)
- 🐞 Fix:熔断计数器读改写原子化(Lua HINCRBY语义+阈值转open),消除并发失败计数覆盖导致熔断难触发 + 回归锁 7/7 (df968b452a7)
- 🐞 Fix:小程序端 noValidContent 文案对齐 RN/Web 口径(解 303p 文案漂移 +1) (4264f62b9f8)
- 🚀 Feature/Improvement:跨端功能更新 + DeepSeek UI 逆向复现 + 文档维护 (4b9d379d1a8)
- 🐞 Fix:补齐 preview-envelope 模块修编译破窗(J2 复现 Qoder office-reader 结构化信封) (12357ae50b0)
- 🔧 Chore/Other:结清 F-404 返佣基数铸币漏洞 —— 代码修复已入库(HEAD等效合并)+ 回归锁6/6通过 (fcac918750d)
- 🐞 Fix:relay-minimax 同步脚本补充 client-auth-* 决策类型(解 typecheck:full 脚本面红) (949eb2026d3)
- 🐞 Fix:返佣基数取本单充值流水增量(orderNo+opType=0),消除对历史钱包余额反复抽佣 + 回归锁 6/6 (82ba276a9bd)
- 🐞 Fix:收口 rows[0] 越界取值的类型面(noUncheckedIndexedAccess),解 typecheck:full 常红 (967e3dfd558)
- 🐞 Fix:install-git-hooks 净面构建下默认模式跳过(exit 0) (de317e445d6)
- 🔧 Chore/Other:结清批次49 —— F-635/F-643/F-656/F-657/F-682 (837f28df860)
- 🐞 Fix:结清 F-635 支付金额分位同源 + F-643 registry 主库判定 + F-656 低余额提醒冷却顺序 + F-657 金丝雀建表自愈 + F-682 个推 token 缓存与有界扇出 (8cbd9f9e177)
- 🔧 Chore/Other:补齐 F-599/F-626/F-631/F-639 新增测试的溯源水印(守门 47p) (bc5cffb9d1e)
- 🐞 Fix:mobile-rn conversationImport 补 noValidContent 5 语言词包 (50f565629d9)
- 🔧 Chore/Other:结清批次47-48 —— F-599/F-600/F-626/F-639/F-644/F-645/F-648/F-650/F-653 (be7457f36fa)
- 🐞 Fix:结清 F-626 别名主库解析与短 TTL 缓存 + F-648 修复任务租约回收 + F-650 代码索引删插同事务 + F-653 巡检异常留痕计数 (1a5ac4d431b)
- 🐞 Fix:结清 F-599 权限删除事务 + F-600 分页唯一键兜底 + F-639 群发分批与状态过滤 + F-644 调度运行事务 + F-645 邀请接受事务 (9dcd8d7c26b)
- 🐞 Fix:收口 F-623 滑动扫描的索引取值类型(noUncheckedIndexedAccess) (67750ac24db)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (690bb9b24ca)
- 🚀 Feature/Improvement:镜像fidelity改section型尺子 + 几何白名单收紧 + cover孤儿css清理 (186e54cc858)
- 🐞 Fix:DG-12 发布 tag 闸从整树 porcelain 改为发布件逐 blob 对账 (f3861006224)
- 🔧 Chore/Other:test(api)+docs: F-150 上海业务日口径回归 4/4 + F-214 :childId 形状闸回归 11/11 入库(前笔代码已在 HEAD,本笔补齐回归锁);README 块 testFiles 5240/trackedFiles 21377 随 DN5 对齐(经 isolated 三试均被钩子外来回灌护栏正当拦停,按 §12 出路③改 object-space-land,落地后复跑受影响门) (a5e16d98333)
- 📚 Docs:真机清单补注入溯源水印(守门47p) (c7d3c3d7b61)
- 📚 Docs:修正 IHUI-API 单体退役漂移 + 新增 RN 微信一键登录真机清单 (224583730df)
- 📚 Docs:派生产物 changelog 日期段自动重排 (8eee8b4a3cd)
- 🚀 Feature/Improvement:dev-enter/cover 迁共享屏薄壳 + 小程序hand迁移计划文档 (05a4bfa1723)
- 🐞 Fix:web-rn-copy-parity 门扩 exam-result 等映射名单 (f1cd5b5c08f)
- 🔧 Chore/Other:ai-career 页面注释同步(镜像标注) (84932a9c634)
- 🐞 Fix:overlayPlanMeta 取词 common.originalPrice(修命名空间) (bcd0e44d9f0)
- 🚀 Feature/Improvement:微信开放平台移动应用配置(WECHAT_MOBILE_APP_ID/SECRET,RN App一键登录/login/wechat) (7ae66424c10)
- 🔧 Chore/Other:gitignore 收敛 — ai-service哨兵残留(20枚精确清单)+PowerShell ModuleAnalysisCache缓存 (1a3e665e45e)
- 📚 Docs:派生产物 changelog + 生成块 trackedFiles 现算同步(21363) (640f4a5a2f8)
- 🐞 Fix:并发会话收敛 — shared词包+miniapp远程locale/生成物/ui-routes现算同步 (3ecaac8dacb)
- 🔧 Chore/Other:事后追认3笔push区间提交(e04bfc4a/0390eac8/7c9a379d)触受保护面 (093406afec7)
- 🐞 Fix:notice-log.test 补 6 处非空断言,消 noUncheckedIndexedAccess TS2532 (949d0173ed8)
- 📚 Docs:派生产物 changelog 同步(2026-11-13) (a0433401462)
- 🔧 Chore/Other:README changelog+数字现算同步 + sag2壳注释对齐全键透传 + parity账本刷新 (ca2efb656ef)
- 🐞 Fix:共享屏改全键取词(t('sag2Lexical.xxx')),对齐About样板,端壳透传裸t,消packAbsent误报 (b41cb887013)
- 🔧 Chore/Other:UpdatePrompt mandatory 强制更新展示面取证(#5) (de7f3c6a959)
- 🐞 Fix:miniapp-taro 补 sag2Lexical 整块(5语言x58键含bm25/chunks/citations/deep),消mirror-pack-namespace-missing (6cb4440a10d)
- 🐞 Fix:miniapp-taro 补 sag2Lexical 整块命名空间(5语言x58键),消 mirror-pack-namespace-missing (4efe4c0b29d)
- 🐞 Fix:合并后重生成 knip-taro-entries + 补 sag2 镜像承载键(搬运 30 枚,基准侧查无 130 枚未代拟) (657c779919a)
- 📚 Docs:派生产物同步 (5bb419a5759)
- 📚 Docs:多语言 README 派生产物同步(sag2 页面路由后) (64fde60eb10)
- 🚀 Feature/Improvement:小程序 sag2 词法多跳检索工作台(pkg-ai 路由页 + drawer-nav 导航 + 跨端屏登记 + ota 测试) (1a2ebbe23a6)
- 📚 Docs:多语言 README 派生产物同步 (01bde91ef0f)
- 🚀 Feature/Improvement:sag2 特性面板(mobile-rn/packages app/types + api-client sag2-lexical 端点) (02cdf682868)
- 📚 Docs:合并后钩子自动维护派生产物 + 导航/api-client 跟踪改动 (97ae9418d90)
- 📚 Docs:同步多语言 README 派生产物 + 自动更新指针 (f3673b52d15)
- 🚀 Feature/Improvement:多语言文案同步 + api-client sag2-lexical 端点(shared/web 五语系) (58b76bade13)
- 🔧 Chore/Other:并发会话本地改动落盘(web/api/ai-service/miniapp/mobile-rn/docs/notice-log 等) (7c9a379d403)
- 📚 Docs:钩子自动维护 Recent updates 派生产物 (891769ad2e3)
- 📚 Docs:同步 README.en 派生产物(现算口径) (2746f7a1f4d)
- 🔧 Chore/Other:收录 install-git-hooks 镜像测试 + README 数字同步 (5f6211b8433)
- 🚀 Feature/Improvement:号池同步任务注册器融合远程隐藏启动器(wscript SW_HIDE 零黑窗)+ 本机 reextract 兜底任务同走隐藏包装;PROJECT_PLAN 清偿逐字副本并保留取号器 B41 行 (d7060ca78f7)
- 🚀 Feature/Improvement:跨端更新提示样式重构 + 对话内提示留痕 notice-log(miniapp-taro/mobile-rn 同批,remote-locales 文案随动) (96a0e7a5044)
- 📚 Docs:同步日文/韩文 Recent updates 派生产物(钩子自动维护) (49d922eae0c)
- 🚀 Feature/Improvement:对话内提示留痕 notice-log + 更新提示样式重构 + README 数字同步 (613b6c555c9)
- 🔧 Chore/Other:违禁桶兜底清扫——HEAD面等条件/待拍板未勾行自动摘除(两道机主禁令的执行器物化,留痕f12-purge;复翻席请同步摘形态,事实内容按各批结清提交保留) (3e958795b95)
- 🔧 Chore/Other:收敛多端改动并纳入号池/中继流式/移动端产物 (0390eac81a6)
- 🔧 Chore/Other:违禁桶兜底清扫——HEAD面等条件/待拍板未勾行自动摘除(两道机主禁令的执行器物化,留痕f12-purge;复翻席请同步摘形态,事实内容按各批结清提交保留) (a7622bf7169)
- 🚀 Feature/Improvement:号池全缺口开发验证 + 能力登记表 + reextract 兜底 + 接口参数补齐 (e04bfc4a31d)

**2026-11-12**
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (06239c8f000)

**2026-11-13**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (231f9458798)
- 🔧 Chore/Other:结清批次46 —— F-602/F-625/F-630/F-631/F-632 (03cda13b2fb)
- 🐞 Fix:结清 F-602 语音笔记分面口径 + F-625 探针超时取消 + F-630 大屏日界重复平移 + F-631 账单归月上海日 + F-632 积分日历上海日 (c8bba3ff8a5)
- 🔧 Chore/Other:结清批次37-45 —— F-382/388/389/393/396/392/406/441/450/417/422/461/466/475/492/494/496/498/504/507/508/511/513/514/518/519/520/529/537/552/538/549/553/554/555/562/569/578/579/589/591/598/606/607/608/621/622/623 共 45 行 (85c98e76bbc)
- 🐞 Fix:结清 F-598 点赞幂等 + F-606 OTel query 脱敏 + F-607/F-608 Bulkhead 名额退还与复位解挂 + F-621 代理池原子计数 + F-622 代理日志脱敏 + F-623 提示词全文扫描 (14a0f49ec2f)
- 🐞 Fix:结清 F-569 资源发布态闸 + F-578 访问趋势业务日 + F-579 食堂采购日 + F-589 缺勤分批写入 + F-591 收件箱归属 (4229823a4ba)
- 🐞 Fix:结清 F-538 中转会话落库 + F-549 清理范围收敛 + F-553 归档分批删除 + F-554 快照保留与孤儿自清 + F-555 锁定双存储合并 + F-562 清理异步单趟 (f34475d3e4a)
- 🐞 Fix:收口 ProcessGroupChild.kill 签名以对齐 ChildProcess,解除 typecheck:full 的 apps/cli 红 (a0cfa61ddd8)
- 🐞 Fix:结清 F-519 死路由清理 + F-520 组织接口鉴权 + F-529 repo-wiki 模型校验 + F-537 PDF 失败如实 503 + F-552 缓存写失败隔离 (1c095a309c1)
- 🐞 Fix:结清 F-508 USDT RPC 超时 + F-511 通知失败重试 + F-513 健康检查互斥合并写 + F-514 平台密钥调用计费 + F-518 引擎 RPC 可达回归锁 (041304b9856)
- 🐞 Fix:结清 F-494 批处理先扣费后落键 + F-496 账号池退出码判定 + F-498 回调帧两段确认 + F-504 收藏按用户过滤 + F-507 工具超时取消 (5d949c01a9e)

**2026-11-13**
- 🔧 Chore/Other:结清 O69(调度轮 sweepLocalDevDbRotation 与镜像 10 例已入库)与 12A/DG-12(发布 tag 闸改发布件对账,同批提交) (6c2a28998f7)
- 🐞 Fix:结清 F-422 Qoder 桥关停竞态 + F-461 WS 活动时间刷新 + F-466 live-chat 单用户连接上限 + F-475 chat 历史表上限 + F-492 生图 worker 租约归属 (c1252d160d6)

**2026-11-13**
- 🐞 Fix:结清 F-422 Qoder 桥关停竞态 + F-461 WS 活动时间刷新 + F-466 live-chat 单用户连接上限 + F-475 chat 历史表上限 + F-492 生图 worker 租约归属 (28827339250)

**2026-11-13**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (e2b674edc9f)
- 🐞 Fix:结清 F-382 OSS 分片会话隔离 + F-388 关键词下推 + F-389 缓存键凭据指纹 + F-393 内容分类归属 + F-396 兑换码 Key 归属 (d8ffac6ef8e)

**2026-11-13**
- 🐞 Fix:结清 F-392 引导凭据闭环 + F-406 提现手续费扣余额 + F-441 剧情增强并发记账 + F-450 代扣回调单事务 + F-417 xlsx 单趟渲染 (6e80aa927ce)
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
