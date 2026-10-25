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

Headline claims (same source as the table below, all live-computed): **606 tables · 4562 API routes ·
25 WebSocket endpoints · 101 catalogued LLMs · 38 platforms auto-publishing · 3163 test files ·
273 engineering gates · 50 CI workflows · 5-language i18n parity · 9 app packages · 16 shared packages ·
14 compose services**.

<!-- BEGIN GENERATED NUMBERS (node scripts/gen-doc-numbers.mjs --markdown) -->
| 指标 | 现值 | 取数键 |
| ---- | ---- | ------ |
| 数据库表 | 608 | `dbTables` |
| schema 文件 | 235 | `dbSchemaFiles` |
| API 路由 | 4561 | `apiRoutes` |
| 路由文件 | 627 | `apiRouteFiles` |
| AI 服务路由 | 595 | `aiServiceRoutes` |
| WebSocket 端点 | 25 | `wsEndpoints` |
| 入库模型清单 | 101 | `llmModels` |
| 发布平台 | 38 | `publishPlatforms` |
| 端应用包 | 9 | `appPackages` |
| 共享包 | 16 | `sharedPackages` |
| CLI 命令文件 | 66 | `cliCommandFiles` |
| CLI 工具文件 | 72 | `cliToolFiles` |
| 语言 | 5 | `i18nLanguages` |
| i18n 作用域 | 7 | `i18nScopes` |
| 语言包 JSON | 35 | `i18nMessageFiles` |
| 测试文件 | 3224 | `testFiles` |
| CI 工作流 | 50 | `ciWorkflows` |
| Compose 服务 | 14 | `composeServices` |
| 工程守门 | 281 | `guardianGates` |
| — blocking | 258 | `guardianBlocking` |
| — warn | 26 | `guardianWarn` |
| 跟踪文件 | 16135 | `trackedFiles` |

上表由 `node scripts/gen-doc-numbers.mjs --markdown` 生成,最后核对日期 2026-10-25。
每个数的来源就写在取数键旁边的实现里(`scripts/gen-doc-numbers.mjs` 的 `SOURCES`),**不得手抄、不得另立第二份**。

<!-- END GENERATED NUMBERS -->


## Recent updates (auto-maintained)

<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->
**2026-10-25**
- 🔧 Chore/Other:侧车补正——G-21畸形记录补key(行文互证)+G-03/G-46 blocking残句清空+parseHeader等段占位修复同批(镜像11/11) (6c7689cefb)
- 🔧 Chore/Other:G-50行双标头折叠为单标头(租约保留;A2终枚收口) (8fa1ec5d0b)

**2026-10-25**
- 🔧 Chore/Other:标头投影第二批——3行行内旧等段按已清侧车重写(等:国内短信/等:本机无/等:—占位叠加) (151e7d4982)
- 🔧 Chore/Other:G-63 owner统一为行内标头简称(反引号原文正文已可查),A2对账终枚 (4b52b3d395)
- 🔧 Chore/Other:侧车改判落地——A2对账批5键blocking残句清空+waiting出桶(G-20/G-100/G-50/O02/G-63) (cab00564bb)
- 🔧 Chore/Other:侧车标头投影批——10行行内标头与侧车投影形统一(A2对账收口;守恒断言在位) (462f1e8798)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (23eadba0af)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4ecb0c164b)
- 🔧 Chore/Other:结清 USDT TRC20 收款地址票(两行同题)——根 .env 与 apps/api/.env 现读均已按票面决策填入 sponsor 页同值,TRON 正则与 assertUsdtAddressFormat 两调用点在位;ERC20 并存不收敛为已裁结论。凭据:脱敏比对逐字相等(长度三十四/前缀 TMtT/后缀 MnbG)。 (2dffc2434d)

**2026-10-25**
- 🐞 Fix:teardown 默认翻为跳过 cleanup——共享库测试用户被并发裸跑删除当日两次复发;E2E_AUTO_CLEANUP=1 显式启用才清理(CI 本就显式 '0' 于 e2e.yml:225,零消费方依赖默认清理);交错型并发(对方跑完清理的瞬间本席浏览器未起)是 hasConcurrentPlaywright 拦不住的形态,故默认不删;手动清理出口 node apps/api/scripts/cleanup-test-users.mjs 不变 (886eae6992)

**2026-10-25**
- 🐞 Fix:OpenAPI 契约产物同步今日补建的两条绑定路由 (462044fe47)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2110948b96)
- 📚 Docs:D04 登记验收面进展(浏览器级五例已入库,枚 4c80bf75db418f70d1b3fcf374efc2d845594cdd)—— 取证与剩余格按 §1 只进那枚提交信息,本行不翻勾(票面③规模化未动) (47b9db9f93)
- 🔧 Chore/Other:侧车reclassify终批——7键出等条件桶(G-03/G-20/G-100/G-46归他席与机主面,O02/G-50/G-74出桶),v2尺等条件归零 (8e681cfb07)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (59f1476f95)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1614f18a56)
- 🔧 Chore/Other:等条件禁令清偿收尾——末批摘行5枚(④/需真机副本/D19/H01/冷启动盘点,f12-purge留痕;union带回尾巴清零)⇒散文尺等条件全清 (9b53fd05d0)
- 🔧 Chore/Other:goal-r4 结清长会话滚动四维活账——r3e 判据三件齐:四维权名(映射 spec 断言)+可跑自验命令(supply 入口)+实测 rc=0(真浏览器 9 passed 2.3m);副本 L7663 已由他席结为指针 (12391049ef)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b5d3110deb)
- 🔧 Chore/Other:去重 机器可见的欠账清单(三路并行审计产出)2026-10-24 逐条核账 副本行改为指向主行短指针(禁手写归并注记) (5fdb7afd77)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6fc06bf1bb)
- 🔧 Chore/Other:goal-r4 结清 TEMP 等环境票——分叉已消(HKCU 现读标准值 D:/DevEnv/Temp)+夹具门现跑 rc=0 红线 0;LocalSystem 面按 §26 显式指定目录既有口径 (ef98e4083e)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (24f139c94f)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (95f0527553)

**2026-10-25**
- 🔧 Chore/Other:D04 消息串内富文本锚点补浏览器级验收面(五例真跑全绿) (4c80bf75db)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d3aeebebc7)
- 🔧 Chore/Other:goal-r4 结清 AGENTS 体积判据接链票——前提过时:门 207 已 blocking 装车(runner:4891 现读,stagedTriggers=AGENTS.md),注册表按域拆分条件随装车消散 (b4b7f05298)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (74ddef1c3d)

**2026-10-25**
- 🔧 Chore/Other:G-1102638 批1 同主键副本行物理归并 — 删 7 行(机主拍板〔拍板@2026-10-08 机主:真删+立即执行〕;幸存者规则与F4同向;落账注记行保留待批2;复跑auditPlan对账F1=0/F9不增;逐行留痕 .ihui-agent/archive/PROJECT_PLAN_copy-purge-2026-10-25.md) (6426b6134e)

**2026-10-25**
- 🔧 Chore/Other:G-1102638 批1 同主键副本行物理归并 — 删 7 行(机主拍板〔拍板@2026-10-08 机主:真删+立即执行〕;幸存者规则与F4同向;落账注记行保留待批2;复跑auditPlan对账F1=0/F9不增;逐行留痕 .ihui-agent/archive/PROJECT_PLAN_copy-purge-2026-10-25.md) (606f93a250)

**2026-10-25**
- 🔧 Chore/Other:等条件禁令清偿——散文尺清零批(摘行12留痕f12-purge+改写出桶+dispositionOf等段占位修复'—'=无等待);门245复跑器exit2为枚举0份的未判定假红,手动全量档rc=0绿,按AGENTS§16显式说明提交;G-74 env已落地确认、G-96微信IDE CLI预览出码结清 (5f92e70b33)
- 🐞 Fix:ui-routes 派生产物写回 + relay 脚本错误文案有界化 (3e4bbfc3c0)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7f3497e362)
- 🔧 Chore/Other:r4c 给 D04 加现读证据注记(租约保留,未翻勾) (5fa5190a35)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (f15d53dd3b)
- 🔧 Chore/Other:r4c 认领 D04 富文本动作锚点(qoder-claimfix 释放票,加租约) (9612eb0219)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b88a7e4e02)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (ba8a12ea2a)
- 🔧 Chore/Other:r4b 结清 G-29 带值旗标普查票(翻勾 + 证据注记) (70bf04ae5c)
- 🐞 Fix:收编器加滞后副本守卫,防把旁路落地成果按滞后工作树副本写回旧版 —— 判据:工作树 blob != HEAD 且 == 该路径某祖先 blob ⇒ 跳过并点名(取不到探针一律 fail-open);立因=2026-10-25 实测 16576ffa0d 在同一文件回退绑定手机/邮箱端点 88 行与门 198 updatedAt 出口形态两处,HEAD 面行为锁 7/7 全红;纯判据 partitionStaleCopies + 镜像测试 6/6(含 fail-open/混批/装车锁),node --check 与 --dry-run RC=0 (508cb8c11f)
- 🔧 Chore/Other:G-29 旗标单源收口第四批两站(站点 31→29) (179fc770b5)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (387b2abaac)
- 🔧 Chore/Other:零改动结清 4 票(键名对齐保全/上游两票本仓已落/门13d判据已立)——凭据:e09d866222f8151a6b78278fb8bef3371872907d(apiKeyPerms 63 键五语言 parity OK)、8894762aed0a025e668e3714728528a1667abc2b(HostTurnFault)、aefe7b14c6119a18da52f608eeb563767c1123c3(ApprovalGenerationCas 双 reasonCode)、check-plan-dup-pointer-ratchet 维③ NOTE_TOKEN_SRC+redundantNoteCountInLine 已立(--self-test 8/8);门13d 存量 6 份均在折并引文内属观察不占票;取消信号行已由他席同日翻勾故不在本批 (0acb63b0a8)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (bd163622b3)
- 🔧 Chore/Other:goal-r4 结清取消信号穿压缩票——压缩/钩子/session_start 三件均已 _wait_interruptible 包裹(G-815970 主刀+10-24 补刀,现读 4+ 包裹点),机制=轮询+task.cancel 真实退出强于内部检查型;MCP init 在本架构无对应等待点;行面前提读数过时 (f924df03b4)
- 🔧 Chore/Other:G-29 旗标单源收口第三批两站(站点 33→31) (8d9de275cc)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5397d6febc)
- 🔧 Chore/Other:goal-r4 结清守门8假绿灯票——前持席已收官约束失效,三条产生路径全部查清(①路由从未注册+alias 过近似 ②在册但运行面 404 部署态 ③cozeZhsApi 前缀归一+边缘改写派生),修正按票面归扩面批次,本票不改判据 (1d5e73e2d3)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (9b8c758945)
- 🔧 Chore/Other:零改动结清 --allow-dangerous 确认旁路票——前提被 danger-gate 收口推翻:策略唯一出口=tools/danger-gate.ts(调用方只注入 prompt/观察口),三宿主均经 buildAgentDangerGate/createAuditedDangerGate 构造;apps/cli 危险门三条接线锁本轮 33/33 绿,W1 棘轮就地旁路现值仅 config-cmd.ts 的配置键 getter 1 处(非放行决策);票面行号已漂按内容锚点改判 (eaba6379cd)
- 🔧 Chore/Other:G-29 旗标单源收口第二批两站(站点 36→33) (10a2898311)

**2026-10-25**
- 🐞 Fix:ui-routes 派生产物写回 + relay 脚本错误文案有界化 (3e4bbfc3c0)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7f3497e362)
- 🔧 Chore/Other:r4c 给 D04 加现读证据注记(租约保留,未翻勾) (5fa5190a35)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (f15d53dd3b)
- 🔧 Chore/Other:r4c 认领 D04 富文本动作锚点(qoder-claimfix 释放票,加租约) (9612eb0219)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b88a7e4e02)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (ba8a12ea2a)
- 🔧 Chore/Other:r4b 结清 G-29 带值旗标普查票(翻勾 + 证据注记) (70bf04ae5c)
- 🐞 Fix:收编器加滞后副本守卫,防把旁路落地成果按滞后工作树副本写回旧版 —— 判据:工作树 blob != HEAD 且 == 该路径某祖先 blob ⇒ 跳过并点名(取不到探针一律 fail-open);立因=2026-10-25 实测 16576ffa0d 在同一文件回退绑定手机/邮箱端点 88 行与门 198 updatedAt 出口形态两处,HEAD 面行为锁 7/7 全红;纯判据 partitionStaleCopies + 镜像测试 6/6(含 fail-open/混批/装车锁),node --check 与 --dry-run RC=0 (508cb8c11f)
- 🔧 Chore/Other:G-29 旗标单源收口第四批两站(站点 31→29) (179fc770b5)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (387b2abaac)
- 🔧 Chore/Other:零改动结清 4 票(键名对齐保全/上游两票本仓已落/门13d判据已立)——凭据:e09d866222f8151a6b78278fb8bef3371872907d(apiKeyPerms 63 键五语言 parity OK)、8894762aed0a025e668e3714728528a1667abc2b(HostTurnFault)、aefe7b14c6119a18da52f608eeb563767c1123c3(ApprovalGenerationCas 双 reasonCode)、check-plan-dup-pointer-ratchet 维③ NOTE_TOKEN_SRC+redundantNoteCountInLine 已立(--self-test 8/8);门13d 存量 6 份均在折并引文内属观察不占票;取消信号行已由他席同日翻勾故不在本批 (0acb63b0a8)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (bd163622b3)
- 🔧 Chore/Other:goal-r4 结清取消信号穿压缩票——压缩/钩子/session_start 三件均已 _wait_interruptible 包裹(G-815970 主刀+10-24 补刀,现读 4+ 包裹点),机制=轮询+task.cancel 真实退出强于内部检查型;MCP init 在本架构无对应等待点;行面前提读数过时 (f924df03b4)
- 🔧 Chore/Other:G-29 旗标单源收口第三批两站(站点 33→31) (8d9de275cc)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5397d6febc)
- 🔧 Chore/Other:goal-r4 结清守门8假绿灯票——前持席已收官约束失效,三条产生路径全部查清(①路由从未注册+alias 过近似 ②在册但运行面 404 部署态 ③cozeZhsApi 前缀归一+边缘改写派生),修正按票面归扩面批次,本票不改判据 (1d5e73e2d3)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (9b8c758945)
- 🔧 Chore/Other:零改动结清 --allow-dangerous 确认旁路票——前提被 danger-gate 收口推翻:策略唯一出口=tools/danger-gate.ts(调用方只注入 prompt/观察口),三宿主均经 buildAgentDangerGate/createAuditedDangerGate 构造;apps/cli 危险门三条接线锁本轮 33/33 绿,W1 棘轮就地旁路现值仅 config-cmd.ts 的配置键 getter 1 处(非放行决策);票面行号已漂按内容锚点改判 (eaba6379cd)
- 🔧 Chore/Other:G-29 旗标单源收口第二批两站(站点 36→33) (10a2898311)

**2026-10-25**
- ♻️ Refactor:再摘十四枚 plugins-data 死副本(曾被批量提交整批带回) (f2402b1503)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b0e6607076)
- 🔧 Chore/Other:goal-r4 结清合流吞没票——两层建议已有更强实现:union-converge 落地前吞并判红(三型夹具)+门100/168 提交时拦(现跑 rc=0,--move 11/11)+证据案例族被守门91钉死(现跑 0 违规) (ed6067dde4)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (0f44f58f42)
- 🔧 Chore/Other:零改动结清 3 票(窗格续传×2 孪生/工具面板开关窗格化)——凭据=56735273286b5f258bed90a714ca228bf6c3561a 与 5978933ee6bf06620e317439353efc33ac961a86 均在 HEAD 祖先链,本轮现读内容锚点仍在:pane-split.ts 的 PANE_SPLIT_PERSIST_KEY/rehydratePaneSplitLayout、chat-pane-body.tsx 的 shouldPrefillRecentMessages、usePaneAiToolsPanelStore 禁回落根单例;三行零改动,孪生副本同据结清;工具面板'独立 split 叶'观察不占票 (7eaa8a1f64)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (0f3a333e8a)
- 🔧 Chore/Other:goal-r4 结清 P2-13③ 孪生两行——prod-bundle 诊断链已全额交付且影子门三对逐字节等值(采集库补齐三输入+失败点接线+结果落盘三形态),现读凭据入行内注记 (094181c956)
- 🔧 Chore/Other:G-29 旗标单源收口三站(吞值判死,站点 39→36) (f2b549a2ea)
- 🐞 Fix:恢复被 auto 收编按滞留工作树副本回退的两处已入库修复 —— ① compat 绑定手机/邮箱端点整块 88 行(c87193d5c0;恢复前 HEAD 面行为锁 7/7 全 404 红,恢复后 7/7 绿)② 门 198 updatedAt 出口形态两处(b0802ff9bf);内容取回退前 16576ffa0d^,行级声明 removed=2/added=88 逐行对账;api typecheck RC=0 (bb883c8c4e)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5620df43a2)

**2026-10-25**
- 🐞 Fix:墙板页提交树内 Git 冲突标记清零并补回合并吞掉的 userGrowthOption (57d95110fd)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (17d9b20c46)
- 🔧 Chore/Other:守门134第二格整票零改动结清(①触发条件未达 ②updated/created 已入键族) (a648e79f91)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a27f73951f)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2b3ff5b11b)
- 🔧 Chore/Other:号池凭证到期字段票的旧未勾副本零改动复结 (4019b32c69)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a710d0c636)
- 🔧 Chore/Other:goal-r4 结清 G-24——重定范围核验:三页+知识库登录态门已在 HEAD(现读各 4 处 authGate,同型 215 页),sidebar-chat-history 已消失前提过时;先前查空系行内路径带陈旧 src/ 前缀 (69b778e669)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8f1987a136)
- 🔧 Chore/Other:服务运行时代码新鲜度 dot-source 维零改动结清(7801) (e563aa2c85)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (34e204d985)
- 🔧 Chore/Other:goal-r4 第三波结清 6 行——Esc 三副本(10-23 四要件结清,凭据 30db9bd97b 祖先+双 spec 在库)/真机走查(两修一误报,凭据 84583fdf6+26cf923961)/prod-bundle(S9 结清,影子门现读 14 对等值)/四件拍板(r27 波结清,mail 鉴权与版式消亡现读在位) (3247fd2355)
- 🔧 Chore/Other:relay-reencrypt-keys 补 §22d 入口守卫(门194 存量 1→0) (392ea7625c)
- 🐞 Fix:小程序/扩展两端 I18nProvider context value 定身 + 各装回归锁(母型缺陷跨端同步收口) (30565b6f8e)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (cb981dd52c)
- 🔧 Chore/Other:goal-r4 结清 3 票(守门91债/G-27盘点/allow-dangerous观察)——证据均本轮现读:守门91与守门12现跑0违规、gitdir硬编码0命中、旁路事实在位;G-24票面三页已从HEAD消失需重定范围故不结 (c9a13dad88)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8223205b06)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8e6f8ec142)
- 🔧 Chore/Other:清偿 miniapp 死键 deventerModeledit.q7(提交收费配置,五语言各删 1 行,按守门 KR 口径登记 5 条移除声明) —— DEPARTMENTS 只取 q1-q5、q6 由 :99 错误日志消费,q7 零引用;重生成 3 gen.ts + 4 b64 与 ui-routes pin 元数据 (8e030dea7b)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3d4b8cebca)
- 🔧 Chore/Other:goal-r4 复翻 8 枚今日回潮复活体(G-35/G-61/G-76/G-807/G-939/发丝线/锁初始化/O-1)——凭据逐条核验:8 枚结清提交均为 HEAD 祖先,锁初始化另现跑 15/15 绿;读取数与凭据见各行复翻注记 (136f2cab0d)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b39c7b9ed7)
- 🔧 Chore/Other:chore/fix(plan): r3e 核验等条件桶-补现读实测值/修正stale判据(0结清6改写) (c54fba94d5)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2e22a31f97)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2a0af4e0b1)

**2026-10-25**
- 🔧 Chore/Other:H02 复翻——回潮体复结(auto-collector union 滞后工作树副本曾把 a6c3c036be 的翻勾写回未勾态;三面已刷齐疗法落地);裁决同前:全仓零声明⇒结构性无样本,闸门不开,只记不挡维持 (eff4b6d5bd)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b907745ef1)
- 🔧 Chore/Other:G-01 远端 CI 现读对账(53094555 上 4红/2进行中/9绿:i18n 两枚判清、OpenAPI 已被并发删除解、ruff/RN 已修、Knip 另席);O02 门128 两格判据补齐+SC1转绿+T8两项取证(待裁 LoginPopUp 40/44 与 RD 16 档) (b7cdf9c74d)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (41baa72b16)

**2026-10-25**
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (869f330a78)
- 🔧 Chore/Other:为 mobile-rn 端登记 topic.detail.loading 形状键契约(c72a93dda9 跨端同屏同字补键;本端由 topic-detail-screen-render.test USED 清单钉住 15 键,单删即 5 红) —— 三条 evidence 按 HEAD 面可核验 (a49c6b729b)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a6c3c036be)
- 🔧 Chore/Other:H02 结清——allowed-tools 闸门代裁落定(全仓零声明⇒结构性无样本,只记不挡维持,首声明技能出现时按新票评估) (353b8b4b90)
- 🔧 Chore/Other:live-doc-edit 补一条镜像锁 —— 改桶与新增完整租约同批必拒(条件③逐字节),钉住「分两次定向改写」的既有口径 (3b8caa24fc)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (50a9ea7397)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7ef91d4c41)
- 🔧 Chore/Other:端内套件三枚红的两条根因分头收口 —— 冷装载搬出计时阶段 + 串行等待窗并到终点 (9c8f66c472)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4df4137ee2)
- 🔧 Chore/Other:G-24 同题孪生复翻——G-18 行已按同证据零改动结清(前提消散+AuthGate 在位),本行同判 (564eac5011)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (ae1c98d35d)
- 🔧 Chore/Other:守门91冻结9处票结清——四格全闭(study-publish 5ce93b9e1/基线归零 907c6568d4/spread 三态升级/阳性对照制度化),r27q 现读全绿 (dfc9041056)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (25f10e867e)
- 🔧 Chore/Other:认领 G-61 旁路落地器镜像套件红 26 例(核验席 r3d 2026-10-25 收口轮:镜像套件四件现读 101/101 全绿 + line-loss 第三形态已判活,票面前置满足) (eeed12179f)
- 🐞 Fix:同名函数族判据只数带 body 的声明 —— TS 函数重载(多签名+单实现)不再被判成重复族;tauri-bridge.ts withTimeout 2 签名+1 实现曾致落地复跑假红,现读 0 命中;补重载/真重复两枚用例 (bd350cd6bf)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b2be520d74)
- 🔧 Chore/Other:G-27 零改动结清——守门[12]现读违规 0(互斥措辞已修正),并发副作用登记票面自记已处置 (14d6ad950f)
- 🔧 Chore/Other:补 test_wb_sync_expiring_triggers_extraction 漏掉的 save_device_map/clear_open_cooldowns 两处 monkeypatch 桩 —— CI 红形似缺 env,真因是 checkin_scheduler.py:702-703 真调 checkin_store 写库⇒db_pool.py:103 fail-closed 抛 RuntimeError: DATABASE_URL 未配置;同族三条用例(alive_skips/extract_failure/throttles)各有桩,只这条漏,补桩即与家族同口径(零改断言、零改 workflow);本机空 DATABASE_URL 单用例 100% 复现 CI 那一红,带 DATABASE_URL 则会真写开发库 id=7 行(违 §5)⇒ 修复方向是让测试不碰库,而非给 CI 塞 service container(现 job 自述离线子集,且空库上 UPDATE checkin_accounts 会改判 UndefinedTableError,红换形态不消);验证 单用例 GREEN passed=1 failed=0、整文件 CI 条件 passed=22 failed=0、ruff All checks passed、check-ci-failure-triage-wiring RC=0、水印 verify RC=0 (f648ba8385)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3531e7a0ef)
- 🔧 Chore/Other:L7688 --allow-dangerous 旁路确认零改动结清(调用方健在;同题带 goal-1024t 租约行归该席不碰) (552630f18b)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (f8f4698e36)
- 🔧 Chore/Other:结清三票——G-13 孪生号同判(量面已亡)、合流吞修复票(两站点已 resolvedTheme+门100 A5/A6 覆盖)、--allow-dangerous 旁路确认(调用方健在) (2b0a82a0b3)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d5e70130c5)
- 🔧 Chore/Other:键名对齐票四复翻(第六轮复核)——四文件早由 02e3474c932/a00983523bc 覆盖,五语 parity RC0+233 例+tsc 8/8;注记载明后续见此票即零改动复翻勿空烧 (628e22f318)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (084843ab6e)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2146490d12)
- 🔧 Chore/Other:10 行进展注记(取证席 HEAD 证据:6060 AASA 半开/7635 富文本余语序/7652 守门91 ①闭/7653 union-converge 断言缺/7657+7694+7695 Esc 三份并指针/7662 G-27 ①③闭/7705 缺键名清单/7727 副本指针) (e77a9cd6fb)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c7e949ff40)
- 🔧 Chore/Other:结清 12 行(取证席逐行 HEAD 证据:7599 api-routes 棘轮/7640+7666 prod-bundle diagnose/7654 BOOL_ACK 键集/7661 resolvedTheme/7668 requireFlagValue 四门/7672 取号器全文件集/7684 prod-bundle 门 exit0/7697+7698 窗格续传三件/7737 dup-pointer 棘轮/7513 无样本) (4c95362c71)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (14fb422425)
- 🔧 Chore/Other:E/F/G 三票(取消信号穿延长回合/宿主中止身份标记/审批代际 CAS)复翻——8894762aed 一枚全落地,r25j 席 10/10 GREEN 核实在案,三枚皆再次回捞的回潮体 (c63b6bba9d)
- 🐞 Fix:补齐 SSO 停靠浏览器伴生改动(rememberSsoDockedWindow 改名 + destroyDockedBrowser 收尾 + ihui:close-docked-browser 广播) —— 与 48b8f4be 的 tauri-bridge 导出配套,修复 HEAD 门 98 第二处悬空(LoginDialog.tsx:20) (4ef788126c)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (22ea1082a6)
- 🔧 Chore/Other:号池到期字段票零改动结清——三路径已由 aa8d575f7c+99db9d2412 闭环,r27o 现读 78/78+typecheck 8/8 核验,存量脏数据收敛属运行时事件 (416ff11d9d)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (089873b0aa)
- 🔧 Chore/Other:G-38 补落 r3c 结清注记(首版注记引指针字面被 purge 剥掉,改写述材重落;只动本行) (32274fafd1)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6c4bf2c87e)
- 🔧 Chore/Other:结清两票——O-1 工件四件全在 HEAD(曾由批次7 S4 复核结清,重复登记形态)与工具面板开关窗格化(mode-switcher:62 已读写窗格实例+域测试 2/2+e2e ① 绿) (e03a6bd968)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (aaf840ab5f)
- 🔧 Chore/Other:G-60 结清——r27n 取证代裁:三根因并列无指纹,维持移除(收益已由 windowing 承接+原位收益归零),防回潮锁随提交落库,10-07 口径闭环 (522ac4dac2)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (9d5061842f)
- 🐞 Fix:守门 52 的三枚脚本自己漏了 windowsHide —— 判弹窗的门本身会弹窗(5 处 spawnSync) (1d0c597d69)
- 🐞 Fix:[207] AGENTS.md 二次清偿 97851→95760 余量 240 —— ①主战收尾合并把我上轮删的两行同题旧副本再插回(活文档 union 认不出清偿副本型删行的同型回潮,R14 已录),再删留指针;②旧 §24「须用户确认」死文本(标题+206B 正文,已由 2026-10-23 机主令作废、现行口径=「24. 新增功能决策口径」)整段逐字移 .ihui-agent/archive/AGENTS_trim-2026-10-25.md 留短指针;③两条点名指针注释精简。IHUI_SKIP_LIVE_DOC_CHECK=1 定向说明:唯一豁免对象=上述同题旧副本与已作废死文本的有意清偿(§1 重复登记/死文本零容忍;逐字留档在案;先例 5e1f901d2f5/72a52b17509 同型),主战在飞新增行(等条件条目同型禁止/端侧读数)一枚未动 (53094555fa)
- 🐞 Fix:i18n 死键门识别模板字面量键 t(`${m}Desc`) 等 (ae95b30a45)
- 🐞 Fix:miniapp-compat 两处 updatedAt 盲写形态改门 198 豁免出口 —— 改密码(L2473)与令牌扣费(L2857)的单行显式键形态命中 G-998153 宽形态棘轮;改写为 .set({ ...changed, updatedAt: new Date() }) 出口形态,字段集与行为零变化(passwordHash 盐随机必变/够才扣条件语句保扣成必变,均为真变化路径),comment 注明必变性依据;验证:门 198 --staged 无新增盲写、turbo typecheck @ihui/api 过、token-balance-concurrency 3/3、g134-updated-ack-honesty 6/6(updated 派生语义直接覆盖) (b0802ff9bf)
- 🔧 Chore/Other:fix(api)+fix(ai-service): 两处谎报正常的故障面改如实 + asyncio 裸任务强引用族收口 —— ① GET /cli/announcements/latest 与 /version 的 catch 原回 200+空列表/空时间戳,DB 故障与'确实没有公告'完全同形(同文件详情端点早已用 500 ⇒ 异类是漏改)。改判前把唯一消费链读实:CLI fetchAnnouncements 对非 2xx 与空列表本就同样 return []('怕 500'前提不成立),/version 在仓内尚无任何客户端消费方 ⇒ 500 零破坏、信号归位;钉 fail-open 的旧用例随契约一起改判,留 CLI 取证注记。② fire-and-forget 的 asyncio.create_task 返回值被丢弃的三处(memory_graph.fire_and_forget_extract、cookie_refresh_daemon /trigger、exec_params CancellationToken._link/cancel_when_either)改按屋内模式(audit_service/knowledge_card_extractor 明文纪律)持强引用到完成:CancellationToken 的 watcher 挂子 token 自身槽位(生命周期语义天然正确:token 被持有 ⇒ 联动活着;没人要 token ⇒ 一起回收),exec_params 另收一段 return 后永不执行的旧实现残留(mypy no-redef 现形)。变异自证(HEAD 旧形态,scratch 进程隔离):旧代码无 _propagate_task/_watches_task 槽(结构档必红),且新锁 7 例在修复面全绿;cookie 46 例、execparams 33 例、announcements 10 例全绿,mypy --strict 三文件绿,ruff 全清,api typecheck 8/8。 (88c60b8fa6)
- 📚 Docs:对齐现算口径(表608/API4561/路由文件627/端9/schema235/WS25) (fe3deed00a)
- 🐞 Fix:守门 55 coverage 89/90 归零 —— team_task(D18 团队共享任务板)补显示名映射与五语言文案 (a4bce96c50)
- 🐞 Fix:[105] miniapp+web ui-routes 与 remote-locales 派生产物重生成补齐 —— miniapp 会话收尾(8 源文件落定 HEAD)后其输入面已定,重生成 ui-routes/gen:i18n 对齐钉 hash;web 侧主战收尾批(wallboard/checkin/preferences)落定后同法补齐;门 105 staged 现读『未发现漏生成』全绿 (dff9e14086)
- 🐞 Fix:对齐源码硬编码口径至现算值(平台38/端9/免费provider24) (f9061a7f59)
- 🐞 Fix:VoiceNote 聚焦态描边回归修复 —— 主战收尾提交引入的 brand.DEFAULT 墨档描边(门 83 R8)+ 未配对实底(R3)双红;换 §4 强调描边合法档 brandAccent.deep(端内 BottomPopup/AgentList/BottomActionBar 同尺),聚焦反馈保留(只换色不换宽度,门 212 口径)。根因:原写法依赖门 83 聚焦守卫的 styles 块 key 形态识别,JSX 内联三元(searchFocused ? {borderColor} : null)不为其所认 ⇒ 输入框聚焦态这一 §4 唯一例外位在合法写法下被双门误判,属门间互顶;合法档位换档是无需动判据的正解,门体聚焦守卫的 JSX 内联盲区另录待治 (df1b6341cf)
- 🐞 Fix:c-drive-auto-maintain 补 2b 段「真 TEMP 顶层陈年滞留让位」—— §26 改道后管家天天在扫错误的地板 (9e1c75d1c9)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6a1cae3d42)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (f2f8a54ec4)
- 🐞 Fix:VoiceNote 搜索框补聚焦态(裸 TextInput 普查锁,G-978007 口径) (6fcaf89ad0)
- 🐞 Fix:doc-numbers 派生块 trackedFiles 改 volatile(结构性防恒红) (2ba88aa276)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (73a7f7f9e4)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (24a2ecdf06)
- 🔧 Chore/Other:fix(miniapp)+fix(gates)+test(miniapp-taro): 门 8 动词式传输口装上后客户端死调用同批清偿 —— 承接配额中断会话的在飞态(该批次曾被并发合并窗洗回工作树,已从对象库按 staged blob 逐枚回捞并验指纹,非重写)。判据面:LINE_TRANSPORT_RE 加动词式传输口(小程序桥接 get/post/put/patch/del 是 fetchApi 薄壳,原一支不认 ⇒ 274 处调用点对该门结构不可见,订单页 404 而门报✅的成因即此格);零宽前瞻+词边界+接收者词根三重收窄把 Map.get/URLSearchParams 同名不同职挡在抽取层。门咬出新增 3 处全清:pay 收银台 GET /vip/order/:no 从未注册(真形 GET /orders/:orderNo,投影逐字 targetTitle/createdAt),「余额支付」档摘除(POST /pay/balance 无注册、/user/profile 从不回 balance、全仓唯一余额账本是 AI token 额度非现金、web 同源收银台仅微信/支付宝两档 ⇒ 跨端对齐;真做余额支付需先定义现金钱包账本,另票);pay.balance/balanceAmount/balanceInsufficient/recharge 四键五语言同批清 + gen:i18n 重派生 + ICU 登记表与 mock 同步;api-settings /about/api-config 面板改本地如实值,连通性测试改真实在册 GET /contact(原 POST /about/api-test 会把 Coze 令牌发往不存在端点,消掉这条设想中的凭据传输链)。一并入库前段在飞修复:password 键名对齐 Zod、alipay 支当场如实拒、email 发码走唯一出口 sendEmailCode、model-edit/n8n 去『接口暂未开放已模拟』假成功改如实报错(§30)、circle/detail 评论/点赞/收藏改真实在册路径与加减形。留痕:LAND_ALLOW_STATE=1 因 i18n 键删除属有意改写(基线逐字节对账通过:16 源文件 HEAD blob 与中断基线一致)。验证:api/miniapp/web typecheck 绿(8/8+6/6),miniapp 全套 80 文件 1032 例绿,门 8 自检 66 例绿且 worktree 面 RC=0(新增 0),ICU/compressed/on-demand 58 例绿。 (ce93d01c09)
- 📚 Docs:全库口径最终对齐现算值(README 中英双版 + 工程文档 stale 数字刷新) (af84ceca3b)
- 🐞 Fix:[105] web ui-routes 产物重生成补齐 —— 主战会话收尾提交(wallboard/ai-plugin/landing 批)改写页面源后未重跑生成器,输入面现已落定 HEAD,web 产物钉 hash 对齐(inputsSha256 现算一致);miniapp 产物输入面仍有 8 源文件在飞(另一会话),产物留工作树随其同批提交不代裁 (aee6010432)
- 🐞 Fix:第八处 CI 红 —— VoiceNote 搜索框补聚焦态(裸 TextInput 普查锁) (2cc6a2ea0b)
- 🐞 Fix:补建 compat 绑定手机/邮箱端点 —— POST /user/phone/bind、/user/email/bind 此前从未注册,小程序「绑定手机号/邮箱」确认步每次 404 被前端 catch 吞成无响应。判据逐字对齐 auth-extended /auth/change-phone/confirm:同一份验证码存储(code-store.verifyCode,Redis 原子比对+删除消费一次)、同一 409 占用语义、同一限频档;差别只在绑定无旧号可验。归属锚点=令牌注入的 request.userId(§5 认证不等于授权:请求体不收 userId)。行为锁 7 例(miniapp-compat-bind.test.ts):匿名/错码/他人占用三闸都断言写库链零调用,两条正向对照拦 eq() 实参证 where 锚本人;变异自证:HEAD(未建)面整套无法通过、修复面 7/7 绿 + stubs 38/38 不回归。 (c87193d5c0)
- 🚀 Feature/Improvement:「业务深纵 / AI 号池」两块补更多可监控数据(机主 2026-10-25 要求"更多实际有用的数据") —— 业务深纵新增用户构成 5 格(VIP 用户 / 操盘手 / 邀请注册 / 近7日邀请 / 近7日活跃)与等级分布行(普通·白银·黄金·钻石),全部与 usersTotal 同一次查询的 filter 计数 ⇒ 零额外开销;activeUsers7d 走 sign_in_records 的 (user_id, sign_in_date) 唯一索引。AI 号池新增:Key 健康四态(unknown/healthy/degraded/down,与汇总字段同一把尺子 RELAY_POOL_HEALTH_STATE_VALUE)、余额不足 Key 数(<5 元且非无限)、24h 内临期账号数(补"只看最短临期"的盲区:只修最短的,第二个过期时又宕一次)、按 provider 分组的 Key 与账号分布表(可调度/总数/异常)。号池侧全部在 computeRelayPoolLiveSnapshot 已加载的两份行上累加 ⇒ 相对现状零新增查询,5 秒轮询成本不变。验证:api/web tsc --noEmit 均 0 错、check-i18n-keys 5 语言 parity OK、门 240 --worktree R1-R8 全绿、verify-wallboard-readout --self-test 12/12(建模 60/60 格) (aab60021f4)

**2026-10-25**
- 🔧 Chore/Other:G-60 取证收口——content-visibility 维持移除裁定+防回潮回归锁(r27n) (7413f9fd31)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (74850e2c36)
- 🐞 Fix:G-865 行补接 theirs 侧独有票号标记 —— 收敛人工裁定预备(信息守恒) (74d9bf7f30)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d946f111a4)
- 🔧 Chore/Other:结清 G-38 无编号 P1 视觉票漂开副本归并出口票(归并席 r3c 2026-10-25:出口在库复验绿+三票离场前提消散,逐份裁定与凭据见行内注) (8665cf45ae)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (01defdb094)
- 🔧 Chore/Other:L7714 四件已拍板事项零改动结清——env键在/邮件鉴权073de24a52/手搓渲染单源化消亡/alertmanager改tmpl真注入,四项实测全过 (0f292dbdc3)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1d12801672)
- 🔧 Chore/Other:L7798 发丝线复翻——三余格已由后续会话清偿(存量 31→0/指纹单源合一),原翻勾 38f0580dfc 被 G-32 回捞带回,现读双尺全绿同据复翻 (7be1d6baff)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (603d8236d8)
- 🔧 Chore/Other:D42046 同题孪生复翻——D14 行已按同判据结清(D690 落地+r27k 核验),孪生行随判 (dd36db8bbe)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (dc89f8a3f2)
- 🔧 Chore/Other:G-939 结清——r27l 取证:裸 update-ref 跳链吞没(先于推送,票面更正),门未响=射程外+当时盲区;修法 A2~A6 已全落地,现门 --move 复现 11/11 检出 RC=0;两条加固建议交后手 (9c725319ee)
- 🐞 Fix:补齐被 ca6995ca20 自动收编遗漏的停靠浏览器伴生导出(318 行全为新增,零删除) —— HEAD 的 web-work-panel.tsx 早已 import 这 9 个符号,单侧收编导致门 98 在 HEAD 恒红;本次只补导出面,不改消费方 (48b8f4be76)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (722d29a0db)
- 🔧 Chore/Other:结清 git-guardian 陈旧副本挂号(按重贴完整实现+fail-closed 处置,落 3718485996);G-16 两格判据注记进展(暂存待收口,SC1/T8 待复裁) (750050c352)
- 🔧 Chore/Other:G-01③/票面点名的 OpenAPI 契约漂移收口 —— 按代码面离线重生成 apps/api/openapi.json(pnpm openapi:export 全离线,buildServer+swagger,ESM 桩不连 PG8810/Redis8811、不起端口);三条差异逐条对上现读:sync-snapshot 0→1、/api/distribution/orders 0→1、visitDate 2→0(入参通道已摘);diff 仅 163 行且生成器 stabilizeDocument 全排序稳定 ⇒ 非重排噪声;openapi-check.mjs [A]-[D] RC=0,[E] 需 --fresh 档在 CI 判 (f76f07ef39)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (f48b3b677b)
- 🔧 Chore/Other:D14 断线审批重放结清——主席代裁 A 案,主对话流腿已由 D690 全量落地(r27k 核验 30 测绿+mypy 零错+契约两侧同值闭环),零改动 (e7d44de174)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (46c5de8ac9)
- 🔧 Chore/Other:G-807 恢复器用例稳定性零改动结清——正解①(copyNeedsRefresh 写侧显式置过期)已在 HEAD,本席 10 连跑全绿(每轮 34/34)过票面验收口径 (c4721a8a39)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d0c6b114b2)
- 🔧 Chore/Other:认领 G-38 无编号 P1 视觉票漂开副本归并出口票(归并席 r3c 2026-10-25) (f59fbbf6a0)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a1fe104475)
- 🔧 Chore/Other:L7800 RF 族 dot-source 盲区零改动结清——G-1080903(10-13)已落传递闭包比较,票面系旧读数 (9ae5273783)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (9cb23e8bce)
- 🔧 Chore/Other:结清两票——锁初始化(lock-atomic-init 在 HEAD 实测接线)零改动;G-77 值守班量面已亡体系换代前提消散(26 天无复发) (2865ff9baa)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (91a961ed05)
- 🔧 Chore/Other:L7806 工具钩子取消腿结清——toolCtx 接线在 HEAD(结清判据满足),r27j 补有意不接点名+形状锁 5/5,随 cli 提交落库 (964f9db7cf)
- 🔧 Chore/Other:L7806 工具钩子取消腿收尾——补两处有意不接点名+形状锁用例(r27j) (973ad61db4)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (746327ce2b)
- 🔧 Chore/Other:重生成 ui-routes 产物以吸收已入库的 19 处输入 sha(门105 G5 陈旧清偿;路由 159 条与 pin 结构不变,仅自述钉更新) (fdb8be50b0)
- 🐞 Fix:解开 main required 检查 lint-typecheck-test 的三枚红 —— VoiceNote.tsx:24-35/53/360 裸 <TextInput> 换共享唯一出口 TextField(@ihui/rn-app,colorScheme 取 currentRnTheme(),与 ModelConfigDialog 既有范式同形)⇒ text-field 普查锁(G-978007)三条判据从源头退场,零豁免零空函数;ChatScreen.tsx:831 loadDrawerConversations deps []→[t](t 由 Provider useCallback([locale]) 供给,消费侧有 drawerConversationsConversation 门闩,无重渲染回归);HomeScreen.tsx:1038/1078 localizePlaceholderGroups 提为模块作用域纯函数、t 改第二参数传入(同 ChatScreen:3579 mapConversationToDrawer(c,t) 口径),useMemo deps 摘掉该函数;验证 eslint --max-warnings 0 RC=0(改前 2 warnings)、turbo typecheck --filter=@ihui/mobile-rn RC=0(6/6)、voice-note-mount 13/13、check-input-focus-feedback --worktree RC=0、check-rn-readout-cell --worktree RC=0、水印 verify 3/3;RN 聚焦墨档观感 H5 验不了,需真机目检(代码形与 89 站点既有范式同构) (fd6c54fbc1)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6d556c844a)
- 🔧 Chore/Other:goal-r3 结清两票——G-217(benchmark-delivery 已装车+覆盖面未建档 0 条)与 G-960(探活腿已钉真腿分档,裸域降级自测夹具)均零改动,前提过时复翻 (d82007c89c)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (99364e453f)
- 🔧 Chore/Other:L7811 真机走查两项欠账零改动结清——①守门83跨兄弟键已由 b15/S10 修复(self-test 全过),②colorScheme 默认值 108 修+9 冻基线系设计终态 (ac91bb4a91)
- 🐞 Fix:取号器活状态测试族补并发窗口分诊 —— 58/59 假红根因根治(G-35 交后手项收口) (3f10d328cf)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c2249b30f3)
- 🔧 Chore/Other:G-955 零改动结清——next-plan-id --check 现读 rc=0,取号入口可用;7 组孪生在归档面只报数归并线自管 (89ee03fe05)
- 🐞 Fix:墙板 scrape-target 小按钮按角色档 control 取 sm(4px,门150 锚点归位);git-guardian 任务形态改 PowerShell Get-ScheduledTask 主通道+schtasks 默认关兜底(缺 __test__ 的陈旧副本 fail-closed 报副本陈旧),新增形态通道回归锁 5 例 (3718485996)
- 🐞 Fix:live-doc-edit 声明式改桶出口收窄到归属桶单维 —— 不再充当三维守恒的全维总闸 (6f2b92c7c4)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (218fdf6ed2)
- 🔧 Chore/Other:goal-r3 结清五票——MCP stdio 缺陷族四票(G-689/691/692/694,r27i 现读 67/67+74/74+typecheck 8/8 全绿零改动)+G-239(四门守卫早已补齐,严判口径归零) (bf49b3702a)
- 🐞 Fix:补"未判定"批次的非零出口(同票回归自纠,f1fa20213b 把后果一起改了) (5fc069c18e)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (596ab903fe)
- 🔧 Chore/Other:G-18 僵尸票零改动结清——工作树待落前提消散,HEAD 四页 AuthGate 门在位(38d41f1cd0 同型),早已随收编入库 (64f4c99027)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1100081916)
- 🔧 Chore/Other:L7807(7 脚本 self-test tmpdir)回潮体复翻——10-23 两度零改动结清后再次被 union 带回;本日现读 check-fixture-tmpdir rc=0 零红线,复翻结清 (264c728948)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1438d2fc90)
- 🔧 Chore/Other:G-865 回潮体复翻——死键早于 9410970ece45ddc00be11886f7d607ea2399f1f3 摘除(README 记账在案),现读 external-urls.ts 无此键,零改动结清 (9d307bed64)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6dc9438f9a)
- 🔧 Chore/Other:goal-r3 第四波认领——MCP stdio 缺陷族四票(G-689/691/692/694)落租约派 r27i;B06/G-73 回潮体复翻(原结清证据链在注记,勿再派工) (0aae188190)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (00bca54a63)
- 🐞 Fix:复结 L7759 门39六红票 —— 六屏共享层下沉已完工(零改动翻勾) (99c758fa3a)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (61392d3fb5)
- 🔧 Chore/Other:G-02 进展注——①subagents/all 早由 G-299① 落地(旧读数前提过时)零实现结清格,测试加固入库;②③维持 n8n 代理持有人归属 (5e73a08e49)

**2026-10-25**
- 🔧 Chore/Other:死端点簇复量遗留收尾——course-qa 注释勘正 + edu/qa 与 messages/private 两枚契约测试(r27h) (17bfd83e58)
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
