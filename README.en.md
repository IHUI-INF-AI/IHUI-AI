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
| AI 服务路由 | 597 | `aiServiceRoutes` |
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
| 测试文件 | 3243 | `testFiles` |
| CI 工作流 | 50 | `ciWorkflows` |
| Compose 服务 | 14 | `composeServices` |
| 工程守门 | 284 | `guardianGates` |
| — blocking | 261 | `guardianBlocking` |
| — warn | 26 | `guardianWarn` |
| 跟踪文件 | 16323 | `trackedFiles` |

上表由 `node scripts/gen-doc-numbers.mjs --markdown` 生成,最后核对日期 2026-10-25。
每个数的来源就写在取数键旁边的实现里(`scripts/gen-doc-numbers.mjs` 的 `SOURCES`),**不得手抄、不得另立第二份**。

<!-- END GENERATED NUMBERS -->


## Recent updates (auto-maintained)

<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->
**2026-10-26**
- 🐞 Fix:G-927 第四批 10 枚裸 git 派生迁入 lib/face-reader(gitRaw/catBatch)—— 棘轮 HEAD 面 70→60 与基线 60 对齐;check-cross-end-screen-coverage 正文同时改走 catBatch/readWorktreeFile 满足门 118 取材面纪律 (0ff78d7fda)
- 📚 Docs:G-964 行内更正——『侧车抽取器与新守门未建』已不成立(三件载体现读全在仓 36,986/27,192/24,595 B);残余改为存量迁移 101 枚 + 72 条孤儿记录治理,凭 check-plan-fields 末行 state=warn stock=101 orphan=72 (491c8b3321)
- 🔧 Chore/Other:F9 双档两枚结清(G-455/G-681)——判据已收窄到声明位口径,现读 --gate F9 存量 0 组、宽口径 0 组、引用图 0、差值 F9=0 无 ❌ 行 (620d74f861)

**2026-10-25**
- 🐞 Fix:修复预存 typecheck 错误以通过推送门（App/ModelConfigDialog/TokenValueScreen） (7d0831bc66)
- 🐞 Fix:摘除被 chore 收尾提交复活的死测试 organization.test.ts(恢复 d35827d96c8 的摘除决定;该文件 import ../organization.js 解析不到任何文件,是 HEAD 上全量 typecheck 唯一报错文件 ⇒ 阻塞所有推送;全仓仅此文件引用 organizationRoutes) (ccf42c74ff)
- 🔧 Chore/Other:收尾提交本地未提交改动（registry-sync / qoder 桥接 / 移动端与 Web 插件 / 部署脚本 / 文档） (821ce8e621)

**2026-10-26**
- 🚀 Feature/Improvement:自进化四票真代码交付(自治决策模型/可审计决策链/E2E 自动补测/经验写回腿)—— 判据单源(autonomy-policy/decision-chain-sources/e2e-autofill-map/lesson-writeback-policy 四份 json),测试 import 源脚本零复制;自测 21/9/37/12 组全绿,node --test 四套件 48/48;两枚缺水印文件已补注入;未接线格(受锁 runner 注册与 auto-evolve 排期调用)留进展注不翻勾 (56855eb75f)

**2026-10-25**
- 🔧 Chore/Other:结清发丝线两尺合一票(hairline 尺 HEAD 面真分隔线存量 0 枚;a88793d3d1 已入库,凭据见行内注记) (38f0580dfca)
- 🐞 Fix:补 workPanel.popout 五语键(work-panel 独立窗口按钮引用缺键,i18n 全量档 rc=1 已复绿) (479d43bd68f)

- 🚀 Feature/Improvement:端侧读数判据补 V3-V5(非等分宿主)+ 29 处收口 (b83d50c6344)
- 📚 Docs:端侧读数约束补 V3-V5(space-between 行 / absolute 容器 / 定宽格) —— 存量 23→69 处已归零 (10905ec50cc)
- ♻️ Refactor:G-29 第二十批 10 站接 flag-value 单源(发布/运维脚本 requireFlagValue,语义未动) (a790c0d0a37)
- 🔧 Chore/Other:复结 9 张被并集回捞的已结清票(origin 同步止血) (acbc383068b)
- 🚀 Feature/Improvement:G-62 恢复 F5 欠账名单问责出口(f5Deficit/f5SuppressedCredit 结构化返回,五档判据原样共存)+ 四臂测试 (c9684235f5e)
- 🚀 Feature/Improvement:D08 ② agent 换手结构化事件(kind/agent_id/summary/token_usage/ts,复用 subagent_* 帧)+ 14 例测试 + 端内覆盖登记 (35aa933f806)
- 🐞 Fix:live-doc-edit G-313 期末对账三缺陷修补(取材兜底/留痕链/手填号射程/正则泄漏) (cc0f35a4334)
- 🔧 Chore/Other:goal-r1 认领 5 票加租约(r25a/r25b/r25c+r25e/r25d/r25f@2026-10-25,主会话派单防打架前置) (f881ee1c233)
- 🐞 Fix:门 55 修复第二次落地 —— 前次 d32263e707c 被 920fff8deb7 整体重写吞掉 (1cdbe49d9a6)
- 🔧 Chore/Other:结清 line-loss 第三形态判活票(门71 已补该形态并入库 da26f3624a;HEAD 面 RC=0、self-test 73/73、镜像 81/81,A/B 证明未造恒红门) (7494794a005)
- 🔧 Chore/Other:翻勾结清 G-25 工具结果三投影票(行内已有 3 条结清注记:result-tri-projection.test.mjs 6/6;goal-r1 主会话僵尸行清偿) (8c3e989381f)
- 🔧 Chore/Other:翻勾结清 D13 主聊天并行工具调用票(行内已有 2 条结清注记:D119 只读并行预取在 HEAD、test 5 passed;goal-r1 主会话僵尸行清偿) (7ae7b2995b3)
- 🔧 Chore/Other:结清 G-61 僵尸票(套件两轮 76/76;heal 第三形态前置已由 da26f3624a 补齐,遂按票面自写终态摘除) (ec713677807)
- 🔧 Chore/Other:复结 L7657 键名对齐票(并集回捞复活体;2026-10-23 已有完整结清凭据,零改动按门 239 单调性复结) (3dbc8547e45)
- 🔧 Chore/Other:复结 5 条并集回捞复活体票(prod-bundle/G-33/G-34/桌面log/活动时钟;结清凭据均已在 plan-row-drop.jsonl,按门 239 单调性零改动复结) (508d7b632cb)
- 📚 Docs:全站口径对齐到 9 端 / 101 模型（对外文档+工程文档+发射器） (73d1ed177b8)
- 🚀 Feature/Improvement:D06 审查卡一键派发修复(DispatchSubagentDialog 加 preset 预填,复用既有 dispatch 腿)+ 3 例测试 (f5be4c99b64)
- 🔧 Chore/Other:D06 派发预填对话框用例(2 例) (2718e8749ce)
- 🔧 Chore/Other:清 F11 等人拍板存量 24 条(强制令代裁/摘行;逐条留证) (eb35b31d15d)
- 📚 Docs:英文 README 数字对齐现算值 + 9 端/101 模型口径 (6d490805713)
- 🐞 Fix:修 F3 自检恒红 —— 落点判据跟上 G-158 仓内 .DevEnv (1f9deae5c65)
- 🔧 Chore/Other:结清发丝线两尺合一票(hairline 尺 HEAD 面真分隔线存量 0 枚;a88793d3d1 已入库,凭据见行内注记) (38f0580dfca)
- 🐞 Fix:补 workPanel.popout 五语键(work-panel 独立窗口按钮引用缺键,i18n 全量档 rc=1 已复绿) (479d43bd68f)

- 🚀 Feature/Improvement:端侧读数判据补 V3-V5(非等分宿主)+ 29 处收口 (b83d50c6344)
- 📚 Docs:端侧读数约束补 V3-V5(space-between 行 / absolute 容器 / 定宽格) —— 存量 23→69 处已归零 (10905ec50cc)
- ♻️ Refactor:G-29 第二十批 10 站接 flag-value 单源(发布/运维脚本 requireFlagValue,语义未动) (a790c0d0a37)
- 🔧 Chore/Other:复结 9 张被并集回捞的已结清票(origin 同步止血) (acbc383068b)
- 🚀 Feature/Improvement:G-62 恢复 F5 欠账名单问责出口(f5Deficit/f5SuppressedCredit 结构化返回,五档判据原样共存)+ 四臂测试 (c9684235f5e)
- 🚀 Feature/Improvement:D08 ② agent 换手结构化事件(kind/agent_id/summary/token_usage/ts,复用 subagent_* 帧)+ 14 例测试 + 端内覆盖登记 (35aa933f806)
- 🐞 Fix:live-doc-edit G-313 期末对账三缺陷修补(取材兜底/留痕链/手填号射程/正则泄漏) (cc0f35a4334)
- 🔧 Chore/Other:goal-r1 认领 5 票加租约(r25a/r25b/r25c+r25e/r25d/r25f@2026-10-25,主会话派单防打架前置) (f881ee1c233)
- 🐞 Fix:门 55 修复第二次落地 —— 前次 d32263e707c 被 920fff8deb7 整体重写吞掉 (1cdbe49d9a6)
- 🔧 Chore/Other:结清 line-loss 第三形态判活票(门71 已补该形态并入库 da26f3624a;HEAD 面 RC=0、self-test 73/73、镜像 81/81,A/B 证明未造恒红门) (7494794a005)
- 🔧 Chore/Other:翻勾结清 G-25 工具结果三投影票(行内已有 3 条结清注记:result-tri-projection.test.mjs 6/6;goal-r1 主会话僵尸行清偿) (8c3e989381f)
- 🔧 Chore/Other:翻勾结清 D13 主聊天并行工具调用票(行内已有 2 条结清注记:D119 只读并行预取在 HEAD、test 5 passed;goal-r1 主会话僵尸行清偿) (7ae7b2995b3)
- 🔧 Chore/Other:结清 G-61 僵尸票(套件两轮 76/76;heal 第三形态前置已由 da26f3624a 补齐,遂按票面自写终态摘除) (ec713677807)
- 🔧 Chore/Other:复结 L7657 键名对齐票(并集回捞复活体;2026-10-23 已有完整结清凭据,零改动按门 239 单调性复结) (3dbc8547e45)
- 🔧 Chore/Other:复结 5 条并集回捞复活体票(prod-bundle/G-33/G-34/桌面log/活动时钟;结清凭据均已在 plan-row-drop.jsonl,按门 239 单调性零改动复结) (508d7b632cb)
- 📚 Docs:全站口径对齐到 9 端 / 101 模型（对外文档+工程文档+发射器） (73d1ed177b8)
- 🚀 Feature/Improvement:D06 审查卡一键派发修复(DispatchSubagentDialog 加 preset 预填,复用既有 dispatch 腿)+ 3 例测试 (f5be4c99b64)
- 🔧 Chore/Other:D06 派发预填对话框用例(2 例) (2718e8749ce)
- 🔧 Chore/Other:清 F11 等人拍板存量 24 条(强制令代裁/摘行;逐条留证) (eb35b31d15d)
- 🔧 Chore/Other:复结 prod-bundle 票孪生副本第二份(同凭据零改动,门 239 单调性) (8c5a366214b)
- 📚 Docs:英文 README 数字对齐现算值 + 9 端/101 模型口径 (6d490805713)
- 🔧 Chore/Other:翻勾「deploy/prod-bundle/ 被 gitignore 导致 compose 链脚本全仓无入库源」——亲跑 check-prod-bundle-shadow rc=0 复验(本机 14 对逐字节等值/9 对部署机现场未判定按门设计/E1 枚举闭合),同文结清注记 3 份去重归并为 2 份 (782cbd2fbf9)
- 🐞 Fix:修 F3 自检恒红 —— 落点判据跟上 G-158 仓内 .DevEnv (1f9deae5c65)
- 🔧 Chore/Other:结清 G-41 三格(①0 违规②G-417②已落地判据③resolveGitBin 已接单源;三格逐条现读凭据见行内注记;摘 r25c+r25e 租约——②经核验无需再做) (97192f73de2)
- 🔧 Chore/Other:结清 D06 /review 票(「/new 仍缺」格经 r25a 现读裁定已由其后提交补齐:send-message.ts:983 注册 onReviewFinding+防回潮锁在;零改动,摘 r25a 租约) (7f20caf30fc)
- 🔧 Chore/Other:结清 L7742 —— 服务运行时代码新鲜度维已覆盖 dot-source 传递闭包(G-1080903 实现,自检 82/82) (8ea9394d1ba)
- 🔧 Chore/Other:G-21 挂租约认领(zcode-main@2026-10-25,按票面「派单时逐格可」逐格推进:先刷新六格证据核我方落点,优先③⑤⑥,①②量力另派) (48a465e21e1)
- 🐞 Fix:清 push 门两个 not-ours 红 —— 三处 spawnSync 补 stdio + api-client 桶补两个 D09 类型导出 (ece5ac5de3e)
- 🔧 Chore/Other:回填四票进展注记(G-29 第二十批十站 / G-62 F5 问责恢复 / D08② 换手事件 / D06③④ 收口) (eb294fd9c62)
- 🔧 Chore/Other:结清 G-28 HEAD 面类型检查出口票(器物已在库 check-head-typecheck.mjs+镜像,self-test 23/23,零改动) (906c5d09603)
- 📚 Docs:表格/tooltip/toast 一族给技术定论 —— 不是缺陷,不建门 (84db1779e9a)
- 📚 Docs:README 中英双版数字对齐现算值(9 端 / 101 模型口径) (59d386cabed)
- 🔧 Chore/Other:G-47 ②清偿进展注(ruff 2 错代裁清:测试 F401 删+mcp_server I001 幻影确证后 --fix;ruff 全仓 All checks passed;①rc=0 现读;③全量验证在跑) (308796bfe5b)
- 🔧 Chore/Other:O02 第④格回填现读读数(BottomActionBar 20/InputArea 18)+最小第一步清单与拍板前置 (8b23d590bde)
- 🐞 Fix:G-47 ruff I001 清偿第二枚 —— mcp_server.py:5345 import 块排序(ruff --fix 自动归并同源导入块;上一枚 5b3c657347 因改动在工作树未随 pathspec 进链,本枚补交;uvx ruff check . 全仓 All checks passed) (9c092c779fd)
- 🐞 Fix:G-47 ruff 存量代裁清偿 2 处 —— tests/test_voice_tts_stream_router.py:26 F401 未用导入删除(该文件仅 1 个历史版本,删后 blob 不撞祖先,门 84 零风险;pytest 7/7 GREEN);mcp_server.py:5345 I001 import 排序(ruff --fix;改前三方比对确证幻影 M:索引 blob==HEAD 即 mtime 漂移非在飞);改后 uvx ruff@0.16.6 check . 全仓 All checks passed (5b3c6573477)
- 🔧 Chore/Other:二次结清 G-61(首次翻勾被并发旧基线抹掉、回捞按未勾态复插;凭据 = object-space-land 镜像 76/76 两轮) (5a54bfaff50)
- 🔧 Chore/Other:结清 G-47 三红票(①端口门 rc=0②ruff 全绿两枚入库③lint 根因=产物目录缺 ignore 已补入库 7611a789c5;三格齐绿判据零放宽) (e1a6a59d5fc)
- 🐞 Fix:G-47③ 受保护检查 lint 红清偿 —— apps/cli/eslint.config.js ignores 补 dist-sea/**(SEA bundle 构建产物,gitignored,同 dist/coverage 性质;4072 个 lint error 全部来自 dist-sea/ihui.bundle.cjs 单文件,判据零放宽、产物退出射程);复跑 pnpm run lint rc=0,turbo typecheck 47 任务面绿 (7611a789c59)
- 📚 Docs:补齐对外 SEO/roadmap 漏网口径(176 llms → 101 llms、roadmap 8 端 → 9 端) (333fd912418)
- 🔧 Chore/Other:翻勾 G-36(圆角死类名代码面归零+门77/150/235 三绿实证,余人工观感项) (f6cd572b1bb)
- 🔧 Chore/Other:翻勾 G-22(F9b 畸形登记号维已在且进收敛闸,现读 0;四套件 145/181/58/82 绿) (ed0c8f671e9)
- ♻️ Refactor:G-29 第二十一批 10 站接 flag-value 单源(requireFlagValue 判死:漏值/坏值 exit 2 点名实得 token;纯函数层契约不动语义未变)—— i18n-messages-exist/--root、load-state-loaded-marks/--root、migration-immutable/--root、miniapp-build-artifacts/--dist、turn-ordinal-lock/--root、txn-cancel-boundary/--root、theme-prop-wiring/--root(旧裸取值改判死)、tool-contract-declared/--today、scan-upstream-models/--provider、sync-alpha-usage/--face;另修既有断裂:check-batch-write-count-honesty 补 3 旧出口转发(0ce9314545 拆层未留转发,state-guard 加载即炸);探针+30 支全 rc=2;镜像 10 套全绿;只读尺未接 39→28 (065957e4ae5)
- 🐞 Fix:/landing 收款落地页口径对齐现算值(8端→9端 / 339表→606 / 100模型→101 / 14平台→38) (4be00e3625b)
- 🔧 Chore/Other:补删 F11 最后 2 条(题面维已装车,回捞应被声明挡住) (47bb7ea918e)
- 🔧 Chore/Other:G-29 第二十一批 10 站进展注(065957e4ae5,39→28)+ G-21 第③格完成进展注(cause 链脱敏代理入库) (66d3d39b442)
- 🚀 Feature/Improvement:首屏按机主关心的「用户数据 / 增长 / AI」重排 —— KPI 带用户卡与 AI 调用卡前置到最左两格(用户卡 sub 即今日新增=增长读数,不另开第 7 张卡:六列档会落成 6+1 孤格);主体网格 order 四档化 wb-prio-user(-40 业务纵深)/wb-prio-ai(-30 号池)/wb-prio-traffic(-20 访客与机器人 PV·UV)/wb-prio-trend(-10 流量趋势),1920 下首屏两行即读完这四块,主机/服务/质量/告警/数据层/边缘/运行时长顺次后移;业务面板内部把用户三格(注册/活跃/今日新增)+签到 7 日增长图提到左栏顶部,接口调用排行下移为纵深信息。取代原两档 wb-flow-first(-2)/wb-business-early(-1)(同值回落 DOM 顺序、编排会静默失效的旧形态,类名同步删除避免定义无消费)。验证:门 240 --worktree R1-R8 全绿、verify-wallboard-readout --self-test 12/12(建模 49/49 格未脱钩)、apps/web tsc --noEmit 无错。并发说明:走 object-space-land 落地 —— 普通提交路径此刻被并发会话的 lint-staged 争锁阻塞,且它会对他席在途文件(stash/restore 工作树)造成污染;README×4 为他席已暂存内容,本票不代提交 (639bd7f7797)
- 🐞 Fix:ai-plugin.json 描述对齐现算值(API 956→4561 / 路由文件 100→622 / 表 329→606 / provider 18→94) (3eaae06aecf)
- 🐞 Fix:G-21 格⑤ agent-control 在飞图并发守卫(对齐上游 in-flight 合并+CAS 驱逐纪律) (447e047a7b6)
- 🚀 Feature/Improvement:G-21③ 诊断量代替原文 —— mcp-credentials.ts cause 链脱敏代理(redactedParseCause:JSON.parse SyntaxError 原文经 V8 短消息策略会整段嵌凭据片段进 crash-handler flattenErrorForReport 与 console.error 两个消费面;代理后只留位置数字诊断量,message 经 @ihui/shared redactSecrets 兜底,依赖已有未新增);新增 4 组威胁模型测试(裸 token/三段式 JWT/深处失败/正向对照)全绿;既有回归 mcp-credentials 族 105 + oauth 族 47 全绿;turbo typecheck --filter=ihui-cli 8/8;水印 verify 1/1 (5d9a026c9c9)
- 🐞 Fix:G-44 告警去重身份从整条消息文案改为「类别+归一化骨架」——16 个稳定枚举+时刻/路径/hex/数字归一,累计次数由既有 repeatNo 承载不进键;补 11g 读数漂移同槽/11h 异族不共槽;harness pass=44 fail=0、mjs 7/7、deploy-alert-dedup 17/17、门224 --worktree 与 --staged 身份抖动0(豁免1)/自检15,ihui-deploy.ps1 仅同步一行注释;ci: G-28 HEAD 面逐端 typecheck 接进 ci-monorepo.yml typecheck job(id=head-typecheck,45min,预算30min/单端10min),TRIAGE_IDS+O_HEAD_TYPECHECK 同步;本地实跑 rc=0(20端通过/已入库红0/未判定0,484s),YAML parse rc=0,check-ci-failure-triage-wiring --staged rc=0,check-gate-wiring R1/R2/R4 rc=0 (714efaa1919)
- 🔧 Chore/Other:G-67 回填十条指针行逐条判定(4 条陈旧悬空可删 / 3 条主行仍活禁删)+两尺失明带 (8d2266f7367)
- 🔧 Chore/Other:F11 存量清零后刷新基线注记(24→0;地板仍为 []) (1a929de6660)
- 🐞 Fix:补回被 73d1ed177b8 误删的 ide.agentsMd 19 键 + settings.expertRoute 4 键(五语言)—— 根因:该提交删键时两个消费组件(agents-md-generator.tsx/expert-route-card.tsx)正处工作树删除态被判死键;本会话已回盘恢复组件(R13),缺键随之显形。键值逐字取自删除前提交 73d1ed177b8^,文本级插回顶层块(parse+键数断言,五语言 parity 绿);只补有消费的键——hint/auto/off 等 6 键其消费者已随该批移除且未恢复,不回补以免制造新死键(web 死键门复验仍 0) (c891e141efe)
- 🔧 Chore/Other:翻勾结清三票(活动时钟单调:G-820/G-821 已在库 46e9a67095、session_store 九写入点全 max()、test_session_store 50 passed、值级探针 PROBE_RC=0;门13d 同行叠注记维已在且 --self-test 8/0+全量 rc=0、DUP_POINTER_RE 不扩字族仍成立;G-91 尺子②:audit-benchmark-delivery --strict rc=0、29 条/43 断言/未建档 0、三态 42/1/0) (e5037766201)
- 🔧 Chore/Other:r2-infra 落地链验证（黑名单程序换 PS 通道） (9e19de0f3fc)
- 🐞 Fix:补回被 73d1ed177b8 连带抹掉的 130 处 web 五语言键(workPanel / reviewTarget / captureTraeWeb / expertRoute / injectionKindExpertPack) (43c7ec0fd1c)
- 🐞 Fix:Build 步骤加 --force —— 消除 turbo 缓存把不完整 api-client dist 固化的通道 (a2a9f872342)
- 🔧 Chore/Other:G-21 格⑤落格收口注记(agent-control 在飞图 CAS 驱逐+入口拒重复,枚 447e047a7b6 全量在注记)+④⑥证据刷新;租约按器物形态保留待 TTL 代摘,余格交回派单面 (1ef258d66bd)
- 🔧 Chore/Other:侧车搬说辞 30 条(抽取前后归属桶零漂移;存量 123→92) (c6e4dae08c4)
- 🐞 Fix:L7334 health 契约分叉清偿(web 读法对齐后端,后端契约不动)—— backend-health 页换读真多服务端点 /api/admin/monitor/services(r25h:原 apiOrThrow<ServiceStatus[]>('/api/health') 把单对象当数组,.map 必空;新端点 requireAdmin 回 success({list}),ServiceStatus.status 补 running 档+删后端不存在的 message 死分支+ICONS 键对齐后端 name+健康判定 !==unhealthy);同型隐患同批清:monitoring-dashboard 页(该端点回 {list} 信封而页按 ServiceItem[] 读)——page.tsx 解 list、types.ts ServiceItem 补 running+ICONS 键对齐、MonitorStatCards 判定 !==unhealthy;tsc 全量唯一红在 r25d 在飞中间态文件(use-conversation-broadcast-sync)非本票面,本票 4 文件 0 错 (d107d57a2f7)
- 🚀 Feature/Improvement:D04 富文本动作锚点装车 —— 消息正文含锚点时走 RichAnchorText 白名单渲染(不进 rehype-raw),a/link 仅安全 URL 出真 href;5 例新测试 (83321dbba3f)
- 🚀 Feature/Improvement:补「用户增长」近 14 日每日新增曲线 —— 后端 buildBusiness 新增一条独立 catch 的聚合(createdAt + 8h 按上海日界切分,与 usersTodayNew 同口径;窗口 = shanghaiDayStartUtc(13) 起含今天),查询失败整块 null 不渲染(§0.3 不把"没量到"画成 14 根 0 柱),成功则按 shanghaiDateString 逐日补齐 14 天、无行日期填真实读数 0;前端 BusinessSnapshot 加 userGrowth 字段 + userGrowthOption(CHART_CYAN 面积折线,62px,与签到 7 日图同族),业务面板左栏用户三格(注册/活跃/今日新增)之下紧接增长曲线;packages/i18n 五语言补 userGrowth14d 键。验证:api/web tsc --noEmit 均 0 错、check-i18n-keys 5 语言 parity OK(19156 键)、门 240 --worktree R1-R8 全绿、verify-wallboard-readout --self-test 12/12 (1fb444802bc)
- 🐞 Fix:文档数字门屏蔽 RECENT UPDATES 块 —— 自动抄来的「176 llms → 101 llms」是历史陈述,不是当前总量声明 (be12ee7a531)
- 🔧 Chore/Other:侧车再对齐 3 条(并发新行;bucketsDrift=0,回读 79 条) (521c75d74f0)
- 🐞 Fix:check-c-drive-pollution 注册表读取换通道 —— reg.exe 被安全策略黑名单 spawn 时杀的是本 node 进程(RC=143),致 live-doc-edit/safe-commit 整条落地链断裂;改为先走脚本宿主读值、reg.exe 仅 IHUI_ALLOW_REG_EXE=1 兜底,读不到如实报未判定 (2500db80556)
- 🔧 Chore/Other:精确摘除 A2 回潮的 4 条同题变体(按复合主键,不按 16 字题面) (ac77ba67992)
- 🔧 Chore/Other:结清 L7334 health 契约分叉票(代裁=web 读法对齐后端;backend-health 换真多服务端点+monitoring-dashboard 同型分叉同批清,入库 d107d57a2f;落地器瞬时判红的 scan-hardcoded-zh 复跑两面 rc=0,系并发索引中间态非本票引入) (87e3f1000e5)
- 🚀 Feature/Improvement:G-10 门接线 —— check-service-binary-paths 加仓内基准对账维(列出/在册/缺/启动类型/Application/快照过期六件事;只读只报数,不参与 computeExitCode,基准读不到或坏 JSON 记未判定);__test__ 导出同步加 normalizeStartType/parseServiceBaseline/compareServiceBaseline/readAndCompareBaseline/BASELINE_REL/SERVICE_BASELINE_PATH;补回 HEAD 的 F3 G-158 修正(isAllowedScratchRoot + gitFaceEscapesToRepo 两维);LAND_ALLOW_STALE 理由=复活守卫把席 J 新写的 const services=[] 与 2026-09-28 祖先同文本行撞车误判(已逐行核对:HEAD 内容零丢失,__test__ 两项为正常重写、旧导出名全保留);验证 --self-test 90/0 rc=0 全绿、基准行 列出3/在册3/缺0、全量 rc=1 为存量机器态 (cf4cda08c26)
- ♻️ Refactor:五站返回键/箭头收口到共享 BackChevron 与 LineIcon(零字形箭头);死副本 NavBar 只报证据不动 (1e63ced855e)
- 🐞 Fix:合并吞并门 A5/A6 不再把「机器生成块」翻新判成内容丢失 —— README×4 那次 reset 的唯一差异全在两枚标记块内,A5 只比 blob 退回基底 ⇒ 恒红顶住提交链(§12e) (3888c3708aa)
- 🔧 Chore/Other:翻勾结清八票(服务定义入仓+基准维 self-test 90/0;门98 D6 维 rc=0;O01 孪生 0;USDT 两 env 非空;H04 三语 JSON OK;门112 双根齐;G-28 CI 接线 714efaa19196;G-61 镜像 76/76 且系被 heal 捞回再翻) (154404a1aa9)
- 🔧 Chore/Other:认领 D08 Agent Teams 协作协议(goal-r2 2026-10-25 r2a 席) (c4734de1ed2)
- 🔧 Chore/Other:结清 L7209 门33 provider 名单票(2026-10-07 拍板②已落地单向投影消灭手抄名单,现跑 rc=0 九 provider 全识别,零改动) (420077e8337)
- 🔧 Chore/Other:登记 P0 —— PG 备份链空转(IHUI-PG-BACKUP 服务未安装/sc query 1060;脚本已修到可跑且运行副本已同步,但无 03:00 节拍器等于没备份;出路=装 nssm 服务或由部署机承载+建只读 beifen 角色) (01ef2d5e6f8)
- 🐞 Fix:题面指纹 16→32 字,避免同前缀不同票被一并豁免 (1902f5ed847)
- 🔧 Chore/Other:D08 Agent Teams 协作协议 前置未解除进展注(goal-r2 2026-10-25 r2a 席) (49ee66a8f56)
- 🐞 Fix:存量 lint 红归零 —— 两个号池测试文件的 3 处 eslint error (e121b36c406)
- 🔧 Chore/Other:重结 D06 /review 票(回潮修复:union 归并带回旧行,7f20caf30f 已在祖先链;主席裁定代行) (2ef3c77ef93)
- ♻️ Refactor:返回键无障碍名改由 wrapper 注入 i18n(common.back) —— 共享层不再写死中文,消 scan-hardcoded-zh 增量(有意重引入 useI18n:此屏 UI 已下沉共享层后一度无取词点,现新增 a11y 标签需取词) (078dd7c8445)
- 🐞 Fix:L7648 非会话 401 被当会话死亡代裁结清(r25i 席)—— 口径:真 401 只有 api 鉴权层能发,过了 api 鉴权之后上游/内部 401/403 一律映射 502;唯一映射实现 errors/upstream-status.ts mapUpstreamOutbound(401/403→502+UPSTREAM_AUTH_FAILED,422/404/429 语义保留,区间外兜底 502 同 v1 先例);新错误码 UPSTREAM_AUTH_FAILED 走 codes.ts 注册形态(守门 206 零增量);ai-chat-stream 3 处主通道+v1-multimodal 2 处对外面+agent-extended 兜底 ??401 收窄 ??502 接线;response.error() 加可选 errorCode 三参(两参形状逐字节不变);测试 10 例(核心对照:上游 401⇒502 非 401 端到端+本服务鉴权 401 仍 401)+132 例回归全绿;typecheck 8/8;水印 7/7;遗留:同型透传点约 15 处逐点收编(helper 已就位,语义各异须单独核,不在本票授权面) (d42caa742a5)
- 🐞 Fix:生产 web 构建脚本补 node22-lts 候选 —— 原三条候选(C:\Users\Administrator\.workbuddy\binaries\... 与 D:\DevEnv\runtimes\node22\node.exe)在本机全部不存在,构建脚本 [FATAL] Node 22 未找到、生产 web 无法重建(2026-10-25 实测阻断一次全链部署)。本机实际在位的 Node 22 是 D:\DevEnv\runtimes\node22-lts\node.exe,已用它成功跑完 next build(7.3min 编译 + 类型检查,BUILD_ID=lGLze0tuCla8z1ZhrisTr,IHUI-WEB 自动重启正常)。SWC 在 Node 26 上 STATUS_STACK_BUFFER_OVERRUN 的老结论不变,只是执行者路径要按本机现读取值(AGENTS 首部七类机器事实) (d4d718cd813)
- 🐞 Fix:根治身份主体族缺陷 —— crew/knowledge 匿名越权,并装守门 242 杜绝回潮 (e6cfb5cf563)
- 🐞 Fix:更正 e6cfb5cf563 —— knowledge-rag 三处 query 局部成了死变量 (c15feca74b5)
- 🔧 Chore/Other:B02 resync 切片进展注(rev PG 权威源+快照端点+gap 接线,160 例绿,剩余面 5 条登记)+ 结清 L7648(401→502 映射代裁,132 例绿) (4ed1a7edfa3)
- 🐞 Fix:第二处 G-948 回归 —— course/detail 入口桶文件次序(CI Build 已复现新冲突对) (e3635cc7406)
- 🐞 Fix:G-04 落地器水印预检改判「将要提交的那个 blob」(cat-file + 临时副本,豁免面按 REPO_ROOT 复算),不再判工作树盘面;76/76 + 23/23 自检 (62f7eb65c69)
- 🔧 Chore/Other:结清 G-79(待落 13 文件已由 f9b56e4278+a6c7cb36ec 入库,零改动)+ 复结窗格续传同题孪生复活体(引用 L7817/7818 结清凭据,门 239 单调性) (227c4f01ca8)
- 🚀 Feature/Improvement:G-67 判据④补「归档已勾主行」档 —— 陈旧悬空指针可删、主行仍活仍拒删(fail-closed);7 例自检 + dry-run 候选 7 行 (75d2a278471)
- 🔧 Chore/Other:复结取消信号+宿主故障标记两枚并集回捞复活体(8894762aed 已实现+cf4321f8d0 已翻勾;r25j 现读核实 10/10 GREEN,零改动按门 239 单调性复结) (b8cb8144768)
- 🐞 Fix:开发者密钥弹窗「权限点/说明」改走语言包(adminTools.developer.permissionLabel/permissionHint),五语齐;该文件硬编码 chrome 归零 (e4f57db0da3)
- 🐞 Fix:收口 /api/agent-free-times 匿名挂载 —— 空 body 的 /reset 不再清零整表 (dca9bbbd6d5)
- 🔧 Chore/Other:D08①团队共享任务列表落地进展注(goal-r2 2026-10-25 r2a 席;③ 归属 web 在飞面) (215fe312e59)
- 🐞 Fix:又一处存量 lint 红 —— chat-sync-rev-persistence 测试的 Fastify import 未使用 (c75a540f094)
- 🚀 Feature/Improvement:D08① 团队共享任务列表 —— team_task 工具(子 agent 可认领/更新条目) (42ac1f1a682)
- 🔧 Chore/Other:chore/fix(plan): r2c 席核验派单口径 11 行等条件 —— 2 条前置已成立结清(G-55 trace 列 / P1 残余② desktop 日志 target),9 条改写为可机读成立判据并补当次实测值 (e551927717d)
- 🐞 Fix:G-35 第二发号出口补远端号集避让(r25k 席)—— next-plan-id.mjs 发号路径原只吃 remote.max,远端低位独占号(本地面已让空/已推未并)结构上不被避让会被当空闲发出(与第一出口 live-doc-edit 自 G-454② 已扣远端号集两出口同漂);lib/plan-id-lease.mjs 加 remoteIdNumsOf 单源投影,liveUsed 并入远端号集(同号集恒等并行为逐字同形)+skippedByRemote 逐枚点名;镜像 T11a 三段(修复前撞号实证/修复后顺延/恒等并反证)+T11b 装车形状锁;验证:next-plan-id-remote 14/14+plan-id 族 7 镜像 52/52+--check exit 0(建议号 O65 含远端避让)+水印 3/3;2026-10-22 三连撞号病型已由 c84e98229c 收清、夹具 7 条正证在 allocator-collision (18e4bf960c0)
- 🔧 Chore/Other:G-35 进展注(形态 A 第二出口远端避让已落盘 19 臂绿;形态 B 已裁决采纳续做;存量 9 组清偿去向登记) (a9c1b939f1a)
- 🔧 Chore/Other:D08 订正注(D06 前置已按完成即删摘除,首条注记的当次现读已过时;r2a 席) (cd379d91073)
- 🔧 Chore/Other:安装器三版沙箱编译实测进展注(基线/A/B/C 四轮真实构建读数+还原自证;选型归机主票不结清;未尽②全帧目审仍开) (5ee1dd77682)
- 🔧 Chore/Other:r2e 基建普查注记 —— scripts/ 下 reg/schtasks/sc 类黑名单 spawn 一律改 PS 通道（换通道不跳门，读不到如实报未判定） (c29d41e11a4)
- 🔧 Chore/Other:侧车抽取正规产出 12 条(plan-fields-extract --apply,bucketsDrift=0) (70520a6fbc1)
- 🐞 Fix:G-35 形态 B —— 第一发号出口 live-doc-edit 补扫工作树副本(r25k 席,主会话裁决采纳档)—— CAS 循环内每轮读工作树副本用同一把尺 scanFamilyIdHits 扫(先剔租约行与 HEAD 面同口径),副本独有号并进占用面(并集方向:HEAD 证据保留 fromWorktree:false 不倒扣,镜像 ⑧b① 钉);worktreeText 缺省 undefined 本维完全缺席行为与改前逐字同形(⑧b②),读不到退回 HEAD 宽面警告出声(⑧c);命中明细带来源面「工作树副本第 N 行(未提交)」;I10 形状锁收窄到立法意图(幂等判据区段零磁盘取材,收窄不削判据,工作树维另由 ⑧c 锁);验证:live-doc-edit 自检 29/29+组合 169/169+collision 10/10+id-collision 19/19+next-plan-id-remote 14/14 全绿,水印 6/6,--check exit 0;形态 A 已入库 18e4bf960c(收编器) (d34600b0e84)
- 🔧 Chore/Other:门94 补 D08① 团队任务六码(唯一真源+五语词包+用例):mcp_server.py 产出的 ALREADY_CLAIMED/BOARD_FULL/FORBIDDEN/INVALID_STATUS/TASK_CLOSED/TASK_NOT_FOUND 入 ERROR_CODE_CATALOG;实测 check-error-code-coverage --worktree 111 码/128 条全覆盖、五语词包 19174 键 parity OK、error-catalog vitest 16/16、@ihui/shared tsc RC0 (1062bcb3daf)
- 🐞 Fix:已结清短留痕 —— 窗口外不再把已翻勾的票复插成未勾(G-61 型) (25ca3e6be2d)
- 🐞 Fix:积分兑换超卖与提现回调黑洞根治,并装守门 243(额度写影响行 / 回调吞失败) (bddb7beaff4)
- 🐞 Fix:两端 ui-routes 派生产物按 HEAD 输入重生成(门 105 转绿) (b1f5c1c3848)
- 📚 Docs:删除被并发 union 回插的重复速查块(97,095 → 95,057)—— 门 207 体积回预算 (6c96fc42260)
- 🐞 Fix:第三处存量 lint 红 —— agent-free-times-authz 的 import() type annotation (dcaa35a376e)
- 🐞 Fix:生产构建改 staging 原子换入(构建期零影响)+ 部署锁 run 托管;DevEnv 根按机器标记识别;凭据巡检停用备份口令真登录;AGENTS 去重回预算 (7d36e564f57)
- 🔧 Chore/Other:结清 G-35 取号器撞号票(形态 A 18e4bf960c+形态 B d34600b0e84 两出口占用面补全;镜像族全绿;存量 9 组清偿去向登记) (8779ebae1be)
- 🔧 Chore/Other:复结取消信号+宿主故障标记孪生再回捞两枚+结清审批代际CAS票(approval_generation_cas.py 整套在 HEAD,票面 grep=0 系 2026-10-13 过时读数;三行均零改动现读凭据行内) (cf106d58c02)
- 🐞 Fix:check-credential-health 服务存在性探测换通道 —— sc.exe 属本机程序黑名单，spawn 那一刻安全策略杀的是整个 node 进程(RC=143)，致 IHUI credential-health 每 6h 巡检腿整条静默消失；改为先经 Get-Service 读同一份 SCM，sc.exe 仅 IHUI_ALLOW_SC_EXE=1 兜底，探测不可用仍返回 null(不误判，未放宽任何门) (d45af31ef71)
- 🔧 Chore/Other:结清 G-38(三条 P1 目标票已离场,漂开副本归并出口诉求前提消散,零改动现读凭据行内) (21487be7d7f)
- 🔧 Chore/Other:B06 认领租约(r26a@2026-10-25 接手余步序四;前牌 goal-r52 超 72h 且会话已收官,按 §1 交回派单面) (33d0312d05d)
- 🔧 Chore/Other:认领 门39 六屏共享层下沉 / D42046 断线窗口待决审批重放(r2d 席 2026-10-25) (71ca38eee9e)
- 🐞 Fix:行内标头按侧车重投影 16 行 —— 门 234 A2/同键矛盾走正牌出口 (5468186d7f7)
- 🔧 Chore/Other:结清 D42046 断线重放票(diff①/diff② 均已由 D690 方案 A 批次落地 8214722404;r26b 现读核实 129 例全绿零改动;过时注记交后手) (3a49101391f)
- 🐞 Fix:提现释放冻结补齐额度守卫(G3 存量归零),并给兑换补运行时行为锁 (a0e53989322)
- 🔧 Chore/Other:工具两件:G-62 第二版 F5 恢复等价注释(②档 b-o 即 max(基底,本侧),未复制期望值基准,用例 58/58 不变)、G-24 新建归档回收器 archive-gc(默认 dry-run/三条判据 maxFiles5+100MB+keepGenerations10/未判定 fail-closed RC2;真实 .ihui-agent/archive 现读 72件32代→保留23待删48未判定1;9 例自检);不含 --apply,不改既有归档 (785d9eca686)
- 🔧 Chore/Other:认领 门39 六屏共享层下沉(r2d 席 2026-10-25) (1caff10ad83)
- 🔧 Chore/Other:侧车同键去重 105→87(18 条重复记录;解析映射逐键零变化) (6a55e44ef13)
- 🐞 Fix:侧车投影可往返 + 抽取器只加不减 + 同键去重入口(门 234 根因三连) (f9c1514b303)
- 🐞 Fix:陈旧行内标头按侧车重渲染/摘除 6 行(门 234 A2 收敛) (7416c88b28d)
- 🔧 Chore/Other:三翻勾结清 G-61(--root 修复在 HEAD+镜像 76/76 全绿;heal 回捞根因器物 RETIRED_LEDGER 随自愈器修复提交入库激活,窗口外拒复插;诊断出处按内容锚点指门体头注) (5fdb3e8b96f)
- 🐞 Fix:ws-payment 归属校验改为 fail-closed(两处降级放行是活的越权口) (713efc621e2)
- 🔧 Chore/Other:结清 门39 六屏共享层下沉 + D42046 断线窗口待决审批重放(r2d 席 2026-10-25,零改动现读凭据行内) (887902d5ccf)
- 🐞 Fix:侧车写入链路三处根因补齐(散文优先 / 去省略号 / 投影保散文回退) (6596afa1ba6)
- 🐞 Fix:行内标头按侧车收口 8 行(3 条 malformed + 5 条陈旧) —— 门 234 A2 清零 (9fe2a464509)
- 🔧 Chore/Other:侧车去重 91→87(4 条被新记录接管的旧副本) (48c19258605)
- 🐞 Fix:同名函数族扫描先遮字符串/模板串 —— 治夹具里的声明被当成第二份定义(落地复跑假红) (37fac19cde2)
- 🐞 Fix:两条告警根因 —— z-index 门对 cn() 遮罩失明;卫生门把 tmp 一次性脚本算成可移植性违规 (5d1ff7294b3)
- 🐞 Fix:PV/UV 的业务日不再由浏览器决定 —— visit-log 收口客户端自报时间键 (aa08ed57dd6)
- 🔧 Chore/Other:L7467 冷启动盘点复核新增修 1 格:pages/study/my-study/index.tsx 冷启动直发鉴权端点 GET /study/records(user/study-routes.ts:45 + user/index.ts:36 组级 preHandler)补 useAuthReadyGate+waitUntilReady,ui-routes 自述钉重生成;其余格=代码面 60 枚门控/扩展 SW 早退/mcp-store 有意无闸均已在 HEAD,唯一阻塞=机主手机扫码;自验 check-miniapp-generated --worktree --group ui-routes RC0、miniapp tsc RC0、eslint RC0、use-auth-ready-gate 14 passed (0c9e33f2624)
- 🔧 Chore/Other:G-16 门128 新增 classArmResolution 解析维(只报数不进退出码):usedClassRefs(带 conditional 上下文的唯一提取式,usedClassNames 改为其键集)、classDefScan、classArmVerdicts、collect 接线、人读面打印、--json.classArm;按票面机主定档:唯一无覆盖定义+无条件使用=resolved,多处定义/!important/非单类/条件取用=undetermined,小程序侧查无定义且非工具类形态=undefined 逐条点名(web/rn 无 Tailwind 配置可解析一律 undetermined,不折成通过);顺带修两处取材(比较运算符后字面量不当类名、@media/@supports/@layer 剥壳后不误判选择器非单类)。HEAD 现读 47 腿中 16 用类名:唯一无覆盖定义33/查无定义0/未判定69。自验 --check RC0(10s)、测试 48 例 T42 在位、--self-test 因另一席未提交的 scripts/lib/cross-end-ui-parity-selftest.mjs 脏副本在 :2570 崩(pristine HEAD 复现同栈,非本批) (3570211ffd9)
- 🚀 Feature/Improvement:迁移缺口审计接入守护巡检(30min 节流;缺口集合进告警身份) (69f0e349f71)
- 🔧 Chore/Other:G-91② 全量基准门:all-checks-runner 末段固定输出「总耗时/门数/预算/判定」,预算与基线读自新文件 scripts/check-all-budget-baseline.json(budgetMs=120000, baselineMs=156711);新增 pnpm check:all:120(--budget-strict,超预算 RC=1),默认 check:all 只报不顶红(耗时不是判据真假;失败路径由自检 A12 钉死);自验 --self-test 13/13、check-gate-wiring RC0、--budget-strict 实跑 RC1(27 步 25 通过 2 失败:第13步 check:miniapp-generated 与第18步 scan-dead-i18n-keys,判定面均 HEAD 且非本批产物;首次全量 156711ms/27 门) (1f654a6c5f1)
- 🐞 Fix:两处入账的丢失更新(管理员调整余额 / USDT 到账)改为 DB 侧原子增减 (0450d797418)
- 🚀 Feature/Improvement:迁移账本「中间缺口」审计与修复器物 —— 治生产库长期落后代码且部署只说档位噪声 (e0ed1d8105a)
- 🔧 Chore/Other:G-40 A 格最小落地:command_ack_facts 表(复合主键 child:<parentSessionId>:<sourceCommandId> 即幂等键,status/载荷双 CHECK,expires_at 索引,尾部回滚注释)+ TS 镜像(schema/index.ts 导出)+ journal idx342;run-idempotency.ts 仅记 E 格 TODO 点名写入侧 agent-runs.ts:304-318 与重放侧 :725-731,不半截实现。自验:bookkeeping --worktree 342↔342、schema-drift(TS608/迁移611,dead=1 存量 rag_chunks)、immutable、ledger-drift 无 DSN=SKIP、scripts/tests 38 例、@ihui/database tsc RC0;未跑(无 PG):from-zero/真实应用/drizzle-kit generate (14df3f14f00)
- 🔧 Chore/Other:L7472 六路口径修正:三处裸路径改显式 /api/(AgentReviewListScreen.tsx:43 /api/agent-reviews、BankCardScreen.tsx:28 /api/bank-cards、MessageChatScreen.tsx:45,71 /api/messages/private 族);六路实为 6/6 通,票面「5 路 0 命中」是整路径字面量 grep 对前缀合成+通用端点改指的假 0,作废;门 8 worktree 主腿 2829→2832(三路各 0→1 判活,行为不变),mobile-rn tsc RC0、悬空 0(11161 文件) (f1ee3fee8ed)
- 🔧 Chore/Other:L7470 死端点簇六路复核:整路径字面量 grep 假 0 修正为 6/6 全通(前缀合成+通用端点改指),三处裸路径改显式 /api 已落 f1ee3fee8e、门 8 主腿 2829→2832 三路各 0→1 判活;仍待三件人定档(bank-cards 无表 / annex-resource 是否新增 /courses/:id/resources / course-qa 与 agent-reviews 语义) (7c3ac208fa7)
- 🐞 Fix:生产签出外来工作巡检不再把第三方仓读成未判定(本机 RSSHub 连续 134 分钟假警报) (5bcbc960b47)
- 🔧 Chore/Other:三处同票两版并为「侧车标头 + 对侧富化正文」—— 为跨机合并消解同题两版并存 (f66ad738723)
- 🔧 Chore/Other:G-50 / G-75 同票两版并为「侧车标头 + 对侧富化正文」(含本侧独有注记) (a745c38c304)
- 🔧 Chore/Other:代裁结清两条 F11 存量(翻勾 + 已拍板条目改题面) (b9fc733c78a)
- 🚀 Feature/Improvement:活文档编辑器新增声明式改桶出口 —— 解开机主令与三维守恒的结构互斥 (9c034053fcc)
- 🐞 Fix:守门 246 取材改走读取层批量口 —— 逐文件 git show 在 HEAD 面直接判"未判定" (600b0d58a4b)
- 🐞 Fix:归属桶不再读侧车投影标头 —— F11「等人拍板」24 条误判收窄到 7 条真决策 (c9e26351407)
- 📚 Docs:守门数回补为现算 258 blocking / 16104 跟踪文件(ddf16383c65 装上守门 246 带来的增量) (1ca62f93d03)
- 🐞 Fix:业务日界统一到 Asia/Shanghai 单一出口,根治大屏同屏「上海日新增 vs UTC 日签到」互搏 + 装守门 246 (ddf16383c65)
- 🐞 Fix:README 守门数回补为现算 280/257/16100(本枚装上守门 245 后的现读值) (ccb1be68122)
- 🐞 Fix:根治活文档"同形态副本逐次翻倍"族 —— README 4.6MB→1.1MB,并装守门 245 (95b5a628b0c)
- 🐞 Fix:同题折叠认「仅投影标头/尾部注记差异」的两版 —— 治跨机合并 F4 放大把分叉卡死 (37e05b810f5)
- 📚 Docs:生成块与散文数字回补为现算值(门 173 落地后点名) (7d05820dc59)
- 🐞 Fix:根治「定时器句柄被覆盖」与「零分母读数上屏」两族 + 装车守门 244 (48872214e10)
- 🐞 Fix:根治计数字段"读出来±1再写绝对值"族,门 243 追加 G5 档(存量实测 10 处→0) (50ca17bd8e6)
- 🔧 Chore/Other:代裁结清余下五条 F11 存量(侧车改判 + 行文同步) (7bb316e3106)
- 🐞 Fix:分销佣金"分当元"显示(100 倍)与两处接错后端的取数,统一走 @ihui/shared 的 formatPrice (46758b5b2b8)
- 🚀 Feature/Improvement:侧车新增声明式改判档 —— 判据修正后旧桶不再被永久钉死 (a59a40b5f8a)
- 🔧 Chore/Other:F9 两枚撞号让后来者改号(G-20→G-100 / G-76→G-101),侧车键随号迁移 (c5787574c2c)
- 🐞 Fix:六处"合法为 0 的读数被当成缺失"收口(0 积分显示成别人的量纲 / 免费显示成没数据) (c32be823130)
- 🐞 Fix:智能体点赞/收藏收进单事务并对父行 FOR UPDATE —— 无唯一约束下的并发重复计数 (22ee752721b)
- 🔧 Chore/Other:侧车五条 waiting 按机主令代裁改判(human→none/env) (e688eb82eaa)
- 🐞 Fix:补建 GET /distribution/orders —— 小程序「分销-我的订单」自建站起打空炮 (8c036a661c1)
- 🐞 Fix:登出未清内容缓存导致**跨账号看到上一账号的 AI 对话与生成结果** (1ac6f8d5a25)
- 🐞 Fix:非中文用户的相对时间兜底不再掉英文;三处列表分组改按本地时区(不再切 UTC 串) (928325829e5)
- 🐞 Fix:分页"加载更多"三型缺陷收口 —— 整屏顶掉前一页 / 提前断供 / 页边界重复行 (8817a9a40d4)
- 🔧 Chore/Other:侧车两键随让号迁移(G-100#把file / G-101#生产备份链…),waiting 同步改 env (2f141c5f36d)
- 🐞 Fix:第七处 CI 红 —— Avatar 圆角档回归 shared 规格(md/lg),不迁就 RN 的 2xl (a8852839304)
- 🐞 Fix:修 release 包启动即崩(P0)——GlobalFloatBox/PrivacyPolicyModal 调 useI18n 却挂在 I18nProvider 之外 (31c4acff133)
- 🐞 Fix:第六处 CI 红 —— PROJECT_PLAN 副本归并归档件补溯源水印 (37b8728d5a9)
- 🐞 Fix:第五处存量 lint 红 —— visit-log 测试的 import() type annotation (f9dd9556502)
- 🐞 Fix:第四处存量 lint 红 —— auth-gate 测试 mock 的 next/link 缺 href (9fe3d1d63ce)
- 🐞 Fix:[105] web ui-routes 产物重生成补齐 —— 主战会话收尾提交(wallboard/ai-plugin/landing 批)改写页面源后未重跑生成器,输入面现已落定 HEAD,web 产物钉 hash 对齐(inputsSha256 现算一致);miniapp 产物输入面仍有 8 源文件在飞(另一会话),产物留工作树随其同批提交不代裁 (aee60104329)
- 🐞 Fix:第八处 CI 红 —— VoiceNote 搜索框补聚焦态(裸 TextInput 普查锁) (2cc6a2ea0b8)
- 🐞 Fix:补建 compat 绑定手机/邮箱端点 —— POST /user/phone/bind、/user/email/bind 此前从未注册,小程序「绑定手机号/邮箱」确认步每次 404 被前端 catch 吞成无响应。判据逐字对齐 auth-extended /auth/change-phone/confirm:同一份验证码存储(code-store.verifyCode,Redis 原子比对+删除消费一次)、同一 409 占用语义、同一限频档;差别只在绑定无旧号可验。归属锚点=令牌注入的 request.userId(§5 认证不等于授权:请求体不收 userId)。行为锁 7 例(miniapp-compat-bind.test.ts):匿名/错码/他人占用三闸都断言写库链零调用,两条正向对照拦 eq() 实参证 where 锚本人;变异自证:HEAD(未建)面整套无法通过、修复面 7/7 绿 + stubs 38/38 不回归。 (c87193d5c07)
- 🚀 Feature/Improvement:「业务深纵 / AI 号池」两块补更多可监控数据(机主 2026-10-25 要求"更多实际有用的数据") —— 业务深纵新增用户构成 5 格(VIP 用户 / 操盘手 / 邀请注册 / 近7日邀请 / 近7日活跃)与等级分布行(普通·白银·黄金·钻石),全部与 usersTotal 同一次查询的 filter 计数 ⇒ 零额外开销;activeUsers7d 走 sign_in_records 的 (user_id, sign_in_date) 唯一索引。AI 号池新增:Key 健康四态(unknown/healthy/degraded/down,与汇总字段同一把尺子 RELAY_POOL_HEALTH_STATE_VALUE)、余额不足 Key 数(<5 元且非无限)、24h 内临期账号数(补"只看最短临期"的盲区:只修最短的,第二个过期时又宕一次)、按 provider 分组的 Key 与账号分布表(可调度/总数/异常)。号池侧全部在 computeRelayPoolLiveSnapshot 已加载的两份行上累加 ⇒ 相对现状零新增查询,5 秒轮询成本不变。验证:api/web tsc --noEmit 均 0 错、check-i18n-keys 5 语言 parity OK、门 240 --worktree R1-R8 全绿、verify-wallboard-readout --self-test 12/12(建模 60/60 格) (aab60021f45)
- 🔧 Chore/Other:G-24 判据冲突按票面原文裁定:①10 代是地板、maxFiles=5 是总数上限,两轴独立任一超限即判,地板高于上限时地板胜出并报 capUnmet(不再互相矛盾);②射程改为必填 --root,无硬编码默认根,人读面打印「本次射程/射程说明」,命中 gitArchiveDir() 时点名 retire-git-archive 已覆盖;planGc 用 itemBytesRetired 抵扣总数差额防过删;无日期件 .lintstagedrc.json 不归类、点名、RC=2。自验 --check RC0、11/11(新增 T9/T10 强化 T4)、dry-run --root .ihui-agent/archive 72件32代→保留23待删48未判定1 RC2;未执行 --apply (218876e8b24)

- 🔧 Chore/Other:结清 G-07/H04 两行 + G-37① 与欠账清单 A/C 现读补录(2026-10-24) (0217de11a0f)
- ♻️ Refactor:ScrollJumpButton 下沉共享核 scroll-jump-core,RN/小程序两端壳只注入 platform (d550594a787)
- 🔧 Chore/Other:L6029 face-reader 棘轮红补现读取证(基线60→62、两枚新门、他人在飞删除) (d820cbd0f06)
- 🔧 Chore/Other:G-04 两格结清 + O02 第2/3票(NavBar/ScrollJumpButton 下沉)进展注记 (4d9f7f1746f)
- 🔧 Chore/Other:重生成 miniapp ui-routes 自述钉(吸收 Collapsible/NavBar 改动后的 inputsSha) (df920f46c38)
- ♻️ Refactor:NavBar 下沉共享核 navbar-core(骨架/标题/槽位入核,几何与无障碍留两端壳);UserInfoCard 因版面差异硬阻塞另票 (17e5b40b65f)
- 🐞 Fix:G-04 格② — 陈旧守卫在 blob 模式改判构造提交的对象库 blob(报告加 face),整 blob 命中祖先只报名不互锁 (3754d6b0202)
- ♻️ Refactor:门 102 存量清零 — miniapp Collapsible 字形› 改 LineIcon chevron-right,web learn 页箭头位补 back-label-exempt 判据豁免 (c8c62a1ddb2)
- 🔧 Chore/Other:清偿 miniapp-taro 105 + mobile-rn 94 枚死键,重生成四端派生件并吸收 ui-routes pin 漂移 (78f0ea893ed)
- 🔧 Chore/Other:G-13 结清 + O01 第三型判未判定 + D03 最小切片落地注记 (b65aa6b3a51)
- 🚀 Feature/Improvement:转写完成态补一键插入当前对话(复用 draftInput 通道,不经服务端;+1 用例) (8739e84ad49)
- 🔧 Chore/Other:G-96 判为僵尸票结清(四格 HEAD 取证全在位,票面缺件已过期) (d019c6cae73)
- 🚀 Feature/Improvement:GA4 补「同格矢量左向箭头」判据(最近可点容器 + 直接子元素,保守四点),撤 learn 页两处 back-label-exempt(HEAD 相对祖先 a3e97593a 只多这两行,撤回即复原) (f71cd0957a2)
- 🔧 Chore/Other:批4复核回填 — 双重执行/api-client 假绿灯两行结清,G-01 判未判定,argument-validation 与死端点簇注记 (98c1a4a2a2e)
- 🔧 Chore/Other:复结 G-76 守门39四处判据(修复枚 bd3bc2238c 在 HEAD 祖先链,现跑门 RC=0/自检 12/12/镜像 11/11)与 P1-② AI 批量对齐(无待处理分叉样本,按销账口径) —— goal-r2 零改动复结 (fe7a11d7de0)
- 🔧 Chore/Other:复结 D05 多用户协作会话 —— 另批①②现读核验已完工(collab-lock 三端点 33/33 绿、邀请管理 UI 挂载 10/10 绿),③ 多实例广播缺口按设计稿归另票;goal-r2 零改动复结 (ec0c55ffe46)
- 🔧 Chore/Other:门207 AGENTS.md 体积判据接入提交链已落地,翻勾结清 (628d1242dba)
- 🔧 Chore/Other:B06 认领租约(goal-r3@2026-10-25 承 r26a 遗留步序四收尾;挂载已在 HEAD 23a2c8ac12,余发送链窗格化验证收口) (e37181f05a3)
- 🔧 Chore/Other:G-67 批1 只读预演回填(7 行够格删除/3 行不可删/复发根因=union merge 回捞) (202f6d53632)
- 🐞 Fix:G-35 复结翻勾 —— 取号器全文件查重两出口落地,夹具级正证补齐(G-14) (c9b9621aecf)
- 🔧 Chore/Other:G-01 按远端 main tip 31c4acff 现读重列五件,并记 port-registry-check 已转绿 (0b0a5e7c444)
- 🔧 Chore/Other:goal-r3 结清 4 票——B06 步序四收尾翻勾(a12ee75007,含结清注)+守门112 cache token/G-28 head-typecheck/P1 僵尸实例三票零改动复结(r27b 复量证据进注记) (e89d731d710)
- 🚀 Feature/Improvement:B06 步序四收尾——发送链路全参数化窗格寻址(承 r26a 暂存面) (a12ee750078)
- 🔧 Chore/Other:批量翻勾结清十四票(全部按复跑判据而非票面自述):--gate F6/F4/F4b 归零、%TEMP 现读到位、运行副本邮件决策已给、门33 单向投影落地、G-49 四格出口在库 29/29、G-64 ratchetViolations 第三参已传、gitdir 指针判据实在位+6/6、G-67 三批注记齐且幂等出口 0 行、G-45 基线两侧归零、G-52 归因 53 命中+56/56、G-63 Step4 普通提交、G-58 负龄判据八处接入+25/25、G-06 决策格消化取证格不占桶、G-48 findForks 与 F4 同尺 F1=0 (07c7e5f9d96)
- 🔧 Chore/Other:G-73 翻勾结清——窗格族 e2e 15/15 全绿含④a归因关闭(r27d 专席取证,证据进注记;B06 发送链已随 a12ee7500782ebc167dc18fcb9e2cec730861a6f 入库) (41ead978887)
- 🔧 Chore/Other:认领 G-79 落地两道门核验票(goal-r3b 2026-10-25 现读实测:守门208 工作树嵌套仓 / 守门30a 本机对象态悬空 commit) (8354821fd6d)
- 🔧 Chore/Other:G-02 认领租约(goal-r3@2026-10-25 仅接①subagents/all——agent-teams 席位 5 天零提交判休眠,routes/subagent-dispatch.ts 面净;②③n8n 两面仍归 n8n 代理持有人不碰,该文件 5 天内 3 枚提交活跃) (5581324a70d)
- ♻️ Refactor:L7402 收官——删除零消费者 DOM 副本 NavBar(packages/app) (2370cd3339e)
- 🔧 Chore/Other:goal-r3 结清 2 票——L7402 机器可见欠账清单收官(死代码删除 2370cd3339e2cc407cce23e24e3b608a222ac375,走查按票面原文并入真机走查包)+死端点簇复量代裁(r27f 六条全已注册零改动结清,三件语义缺口留 commit message 交后手) (d6101473f31)
- 🔧 Chore/Other:G-37 ② 判为已过时(内容指纹 8be9a644a5 已落),本行只剩 ③ (e6080496151)
- 🔧 Chore/Other:复结 G-79 落地两道门票(goal-r3b 2026-10-25:守门208/守门30a 当次 rc=0,13 文件 2026-10-15 已入库且四枚凭据均为 HEAD 祖先,本行系并集回捞僵尸副本) (e48ab8394e4)
- 🔧 Chore/Other:G-37 翻勾结清——①②既已被前世提交结清复验,③常守活载体本席代裁落地(看门狗任务自愈实测,提交 f815c4536c;落选方案与回退路径留痕) (1f37c2bbe61)
- 🚀 Feature/Improvement:G-37③ :80 图片 CDN 常守活载体落地——看门狗任务 IHUI-ImageCDN-Watch (f815c4536cc)
- 🐞 Fix:ruff B905 — test_d08_team_task_board zip() 补 strict=True(gather 与 agents 一对一,长度不等即编程错误) (0902a3276be)
- 🔧 Chore/Other:取号器撞号防线补并发层夹具 —— 两会话同时取号不会拿到同一个号(G-35 已由他席复结,本席补其未覆盖格) (f2c3c882dd0)
- 🔧 Chore/Other:fix(miniapp)+fix(gates)+test(miniapp-taro): 门 8 动词式传输口装上后客户端死调用同批清偿 —— 承接配额中断会话的在飞态(该批次曾被并发合并窗洗回工作树,已从对象库按 staged blob 逐枚回捞并验指纹,非重写)。判据面:LINE_TRANSPORT_RE 加动词式传输口(小程序桥接 get/post/put/patch/del 是 fetchApi 薄壳,原一支不认 ⇒ 274 处调用点对该门结构不可见,订单页 404 而门报✅的成因即此格);零宽前瞻+词边界+接收者词根三重收窄把 Map.get/URLSearchParams 同名不同职挡在抽取层。门咬出新增 3 处全清:pay 收银台 GET /vip/order/:no 从未注册(真形 GET /orders/:orderNo,投影逐字 targetTitle/createdAt),「余额支付」档摘除(POST /pay/balance 无注册、/user/profile 从不回 balance、全仓唯一余额账本是 AI token 额度非现金、web 同源收银台仅微信/支付宝两档 ⇒ 跨端对齐;真做余额支付需先定义现金钱包账本,另票);pay.balance/balanceAmount/balanceInsufficient/recharge 四键五语言同批清 + gen:i18n 重派生 + ICU 登记表与 mock 同步;api-settings /about/api-config 面板改本地如实值,连通性测试改真实在册 GET /contact(原 POST /about/api-test 会把 Coze 令牌发往不存在端点,消掉这条设想中的凭据传输链)。一并入库前段在飞修复:password 键名对齐 Zod、alipay 支当场如实拒、email 发码走唯一出口 sendEmailCode、model-edit/n8n 去『接口暂未开放已模拟』假成功改如实报错(§30)、circle/detail 评论/点赞/收藏改真实在册路径与加减形。留痕:LAND_ALLOW_STATE=1 因 i18n 键删除属有意改写(基线逐字节对账通过:16 源文件 HEAD blob 与中断基线一致)。验证:api/miniapp/web typecheck 绿(8/8+6/6),miniapp 全套 80 文件 1032 例绿,门 8 自检 66 例绿且 worktree 面 RC=0(新增 0),ICU/compressed/on-demand 58 例绿。 (ce93d01c09c)
- 🐞 Fix:兜底弄死的守门归因由判红改为未判定(§0.3),后果一项不减 (f1fa20213b4)
- 🐞 Fix:全量档取材面收到 HEAD blob(§0.4/§12e),--worktree 保留磁盘扫描并自称审面 (f126e734f47)
- 📚 Docs:全库口径最终对齐现算值(README 中英双版 + 工程文档 stale 数字刷新) (af84ceca3bd)
- 🔧 Chore/Other:G-02 进展注——①subagents/all 早由 G-299① 落地(旧读数前提过时)零实现结清格,测试加固入库;②③维持 n8n 代理持有人归属 (5e73a08e493)
- 🔧 Chore/Other:死端点簇复量遗留收尾——course-qa 注释勘正 + edu/qa 与 messages/private 两枚契约测试(r27h) (17bfd83e58f)
- 🐞 Fix:mobile-rn 词包补 topic.detail.loading 五语言(值逐字取小程序包,跨端同屏同字)+ 装上 Provider 身份回归锁 —— 共享屏 TopicDetailScreen.tsx:214 与小程序 detail.tsx:200 一直在取该键而 RN 包缺(小程序端靠内联兜底掩盖);topic-detail-screen-render 5 枚红即此,补键后 10/10 绿,check-i18n-keys/broken-en/zh-residue(zh-TW,ko,ja) 与 prettier 全绿。另:src/i18n Provider 三层身份 memo 化的回归锁文件此前未跟踪(锁没进仓=没装车,§0.9),本次入库并实测 2/2 绿 (c72a93dda9f)
- 🐞 Fix:VoiceNote 搜索框补聚焦态(裸 TextInput 普查锁,G-978007 口径) (6fcaf89ad0b)
- 🐞 Fix:doc-numbers 派生块 trackedFiles 改 volatile(结构性防恒红) (2ba88aa276c)
- 🐞 Fix:VoiceNote 聚焦态描边回归修复 —— 主战收尾提交引入的 brand.DEFAULT 墨档描边(门 83 R8)+ 未配对实底(R3)双红;换 §4 强调描边合法档 brandAccent.deep(端内 BottomPopup/AgentList/BottomActionBar 同尺),聚焦反馈保留(只换色不换宽度,门 212 口径)。根因:原写法依赖门 83 聚焦守卫的 styles 块 key 形态识别,JSX 内联三元(searchFocused ? {borderColor} : null)不为其所认 ⇒ 输入框聚焦态这一 §4 唯一例外位在合法写法下被双门误判,属门间互顶;合法档位换档是无需动判据的正解,门体聚焦守卫的 JSX 内联盲区另录待治 (df1b6341cf7)
- 🐞 Fix:c-drive-auto-maintain 补 2b 段「真 TEMP 顶层陈年滞留让位」—— §26 改道后管家天天在扫错误的地板 (9e1c75d1c98)
- 🐞 Fix:[105] miniapp+web ui-routes 与 remote-locales 派生产物重生成补齐 —— miniapp 会话收尾(8 源文件落定 HEAD)后其输入面已定,重生成 ui-routes/gen:i18n 对齐钉 hash;web 侧主战收尾批(wallboard/checkin/preferences)落定后同法补齐;门 105 staged 现读『未发现漏生成』全绿 (dff9e140867)
- 🐞 Fix:对齐源码硬编码口径至现算值(平台38/端9/免费provider24) (f9061a7f593)

- 🔧 Chore/Other:fix(api)+fix(ai-service): 两处谎报正常的故障面改如实 + asyncio 裸任务强引用族收口 —— ① GET /cli/announcements/latest 与 /version 的 catch 原回 200+空列表/空时间戳,DB 故障与'确实没有公告'完全同形(同文件详情端点早已用 500 ⇒ 异类是漏改)。改判前把唯一消费链读实:CLI fetchAnnouncements 对非 2xx 与空列表本就同样 return []('怕 500'前提不成立),/version 在仓内尚无任何客户端消费方 ⇒ 500 零破坏、信号归位;钉 fail-open 的旧用例随契约一起改判,留 CLI 取证注记。② fire-and-forget 的 asyncio.create_task 返回值被丢弃的三处(memory_graph.fire_and_forget_extract、cookie_refresh_daemon /trigger、exec_params CancellationToken._link/cancel_when_either)改按屋内模式(audit_service/knowledge_card_extractor 明文纪律)持强引用到完成:CancellationToken 的 watcher 挂子 token 自身槽位(生命周期语义天然正确:token 被持有 ⇒ 联动活着;没人要 token ⇒ 一起回收),exec_params 另收一段 return 后永不执行的旧实现残留(mypy no-redef 现形)。变异自证(HEAD 旧形态,scratch 进程隔离):旧代码无 _propagate_task/_watches_task 槽(结构档必红),且新锁 7 例在修复面全绿;cookie 46 例、execparams 33 例、announcements 10 例全绿,mypy --strict 三文件绿,ruff 全清,api typecheck 8/8。 (88c60b8fa67)
- 📚 Docs:对齐现算口径(表608/API4561/路由文件627/端9/schema235/WS25) (fe3deed00a1)
- 🐞 Fix:守门 55 coverage 89/90 归零 —— team_task(D18 团队共享任务板)补显示名映射与五语言文案 (a4bce96c502)

- 🐞 Fix:[207] AGENTS.md 二次清偿 97851→95760 余量 240 —— ①主战收尾合并把我上轮删的两行同题旧副本再插回(活文档 union 认不出清偿副本型删行的同型回潮,R14 已录),再删留指针;②旧 §24「须用户确认」死文本(标题+206B 正文,已由 2026-10-23 机主令作废、现行口径=「24. 新增功能决策口径」)整段逐字移 .ihui-agent/archive/AGENTS_trim-2026-10-25.md 留短指针;③两条点名指针注释精简。IHUI_SKIP_LIVE_DOC_CHECK=1 定向说明:唯一豁免对象=上述同题旧副本与已作废死文本的有意清偿(§1 重复登记/死文本零容忍;逐字留档在案;先例 5e1f901d2f5/72a52b17509 同型),主战在飞新增行(等条件条目同型禁止/端侧读数)一枚未动 (53094555fa9)
- 🐞 Fix:i18n 死键门识别模板字面量键 t(`${m}Desc`) 等 (ae95b30a45d)
- 🐞 Fix:miniapp-compat 两处 updatedAt 盲写形态改门 198 豁免出口 —— 改密码(L2473)与令牌扣费(L2857)的单行显式键形态命中 G-998153 宽形态棘轮;改写为 .set({ ...changed, updatedAt: new Date() }) 出口形态,字段集与行为零变化(passwordHash 盐随机必变/够才扣条件语句保扣成必变,均为真变化路径),comment 注明必变性依据;验证:门 198 --staged 无新增盲写、turbo typecheck @ihui/api 过、token-balance-concurrency 3/3、g134-updated-ack-honesty 6/6(updated 派生语义直接覆盖) (b0802ff9bf5)

- 🔧 Chore/Other:并发席零改动结清 21 枚(前提现读已闭,证据注记随行)—— web 五票(hit-target/59./60./真机走查/G-60)+ 脚本六票(号池到期/合流盲区/G-960)+ cli·deploy·ops 四票(WP-7/G-109/P2-13③/G-1222561/G-74/D42046)+ 自进化已交付五票 + 第1/2期无号副本回潮复结 (20d9d96a48)
- 🔧 Chore/Other:59. 消息级版本切换三段(1/3 sibling 存储 / 2/3 MessageVersionMenu / 3/3 回调坐标透传)零改动结清——三段落点与回归测试现读齐备 (9ff5da17df)
- 🔧 Chore/Other:O65 P0 四票(O6501 根护栏/O6502 成本熔断/O6503 隔离+原子回滚/O6504 人工阀)与 G-60 窗口化五票零改动结清——器物与部署环接线现读在位,自检 9/13/9+7/12 组全绿 (003a77eb76)
- 🔧 Chore/Other:r5 认领自进化四票(自治决策模型/可审计决策链/E2E 自动补测/经验自动提炼)——牌插在复选框后,正文一字未动 (ef7123a5f4)
- 🔧 Chore/Other:G-274 与 G-107 两票零改动结清——票面前提逐条现读已过期(门 233 已 blocking 接线且生产 importer 4 枚;recovery-gate 已进 sse barrel 且经 stream-authority/client 逐帧消费),证据注记随行 (188fe19586)
- 🐞 Fix:G-962 批13——BP 腿前缀假设可见键 10 处逐条裁决 dead,未判定桶 17→7 (9854d851e1)
- 🐞 Fix:门 234 A2 误判收口——侧车标头定位单源化(locateSidecarHeader),strip/parseHeader/门的 headerOf 同一把尺 (86085c636e)
- 🔧 Chore/Other:F11 回潮行摘"需拍板"措辞——非会话401票归属照旧(api鉴权面+api-client两侧持有者),票保住不被禁令清扫器吃掉 (50d8737b2a)
- 🔧 Chore/Other:health 分叉同题两枚结清——web 健康页现读改走 /api/admin/monitor/services 的 {list} 信封(头注 L7334 结清在案),服务端同形 success({list});/api/health 裸对象契约按原方案不变,对外契约未变更 (0d4bd0747d)
- 🚀 Feature/Improvement:O65 第 3 期第三件 —— 依赖安全通告雷达(实跑 257 条/35 critical,80 枚可修候选)+ 第 3 期进展注记刷新 (5732b6bb28)
- 🚀 Feature/Improvement:锁定 order-log/order-track/message-group 令牌主体与 vip-compare 公开脱敏 (b5c3d62f14)
- 🚀 Feature/Improvement:O65 第 3 期回流两件 —— 失败票归因沉淀器 + 守门判据腐烂自检(自检 7/7 与镜像测试 12/12 全绿) (6567fd5730)
- 🐞 Fix:Step 5 载荷判据改为「实到 == 预期且预期非空」,空提交不再判绿 (3bdcc09dca)
- 📚 Docs:O65 第 3 期进展注记 + 第 2 期重复登记收拢(仅留一条 [x] 完成行) (74fd1f1630)
- 🔧 Chore/Other:G-1222557 复验结清——出口围栏的存量维真跑 15/15 绿;另补记 D04/G-934 两枚的真浏览器凭据 (534682513b)
- 📚 Docs:O65 P0 四件翻勾(正式编号 O6501-O6504)+ 第 1 期感知层自动分诊器翻勾 —— 交付件已入 main 并随 8486d01ddab 上生产 (4e74314d70)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b801d2d8f9)
- 🔧 Chore/Other:G-927 进展注记——求差实证新增12枚中10枚已由别席迁好待入库,agent-worktree/green-state 两枚本席迁讫(gitRaw层,行为面等值,自检9/7);棘轮70随入库递减,基线60不动 (8a8ffefbd6)
- 🐞 Fix:G-927 迁移批——agent-worktree/green-state 两枚裸 spawnSync('git') 改走 face-reader 取材层 gitRaw(绝对路径git+quotepath+safe.directory+timeout+EBUSY兜底),包装函数折回原三态行为面逐字段等值;自检9/7全绿+--list行为面真实返回;求差实证:12枚新增中10枚已由别席迁好待入库(盘面0命中),本批迁余下2枚,棘轮70→随入库递减,基线60不动(下调前置=10枚入库) (a9505b2596)
- 📚 Docs:结清 3 枚(第 12 批:G-272 重臂复位分域 + 门 149 端内 barrel 两条同题) —— ①G-272 席位提交 34828b1db3a5d531b26b06fbf8d20d79fee28f1d:前提现读更正(stopInitiator 在 HEAD 有 15 处命中而非票面 0,该字段已由 G-816026 落地;rearm/重臂/复位仍只命中注释 ⇒ 注释声称有实现没有成立)。实现 apps/cli/src/tools/background-registry.ts 新增 BACKGROUND_TASK_REARM_FACE(preserve/reset/renew 三档,satisfies Record<keyof BackgroundTask,…> 编译期穷尽)+ rearmBackgroundTask(previous, incoming):身份面逐字保留、结算面回构造初值、新生面换代,四档拒绝(not-terminal/id-mismatch/generation-not-renewed/not-live)原样交回旧条目,fail-closed。主席复跑 apps/cli/tests/background-rearm.test.ts ⇒ Tests 6 passed,含变异自证(注释掉 command: previous.command ⇒ 仅用例①红)。剩余面:rearm 暂无生产调用点(registerTask 每次 genId),未来接入时事件处理器必须绑到 rearm 返回的新条目。②门 149 端内 barrel 两条同题行一并收口:席位提交 443561b82c 新增 scanAppBarrelLeaks 与桶/实现分离单源 isBarrelModule,端内桶 universe 由该层目录扩到端内全树;主席复跑 --report 末行 APP-BARREL-REPORT barrels=36 apps=5 consumers=34 hits=0 type=0 elsewhere=0 undetermined=0(存量 0 + 阳性对照 ⇒ 并入既有 --staged 差值棘轮而非升绝对 blocking,符合 §12e 升档前置=存量归零) (00d8db8283)
- 🔧 Chore/Other:A 类 7 枚结清(G-62/G-01/G-03/G-07/O88/G-272/双重执行)——凭据全部本席现读复跑:gate 全零、twins 0 组、CI 唯一 failure=lint-typecheck-test、stopInitiator 20 命中、take_loop_v2_handoff 9 处消费面在位 (1e57d5d821)
- 🚀 Feature/Improvement:门149 补齐端内 barrel 漏出口(桶/实现分离 + 端内全树 universe + --report 只读量算) (443561b82c)
- 📚 Docs:结清「非会话 401 被当成会话死亡」 —— 按 §24 机主令本应由 agent 代裁,现读发现源头已由 2026-10-25 的 L7648 修复落地:apps/api/src/routes/agent-extended.ts 的 preHandler 兜底由 `err.statusCode ?? 401` 收窄为 `?? 502`,行内注释明写「没标 statusCode 的异常是内部/上游故障,盖 401 会被 api-client 读成重新登录(上游 provider 凭据错误 ≠ 会话死亡;口径同 auth.ts 票 G-396/G-765/G-357)」⇒ 用户不再被误导去重新登录。客户端侧 packages/api-client/src/client.ts 仍是 `status===401 && !isAuthEndpoint(url)` 才判会话死亡(两处),由于非会话错误现在以 502 出栈,该启发式不再被误触发;如实登记残余:若将来有上游把第三方 401 原样透传成 401,仍会被读成会话死亡,属纵深防御缺口而非本票未完成 (ba06930d36)
- 📚 Docs:结清票60 真并行多窗格(服务端 fork 腿收口) —— 席位提交 5e72a6df8b 共 5 文件 +942/−50;主席自审复跑 apps/api 三份用例(chat-fork-branch-endpoint + chat-fork-branch-queries + chat-actions)⇒ Test Files 3 passed / Tests 24 passed(席位另报 conversation-archive 11 例,合计 35)。关键事实更正:服务端分叉并非不存在,而是早已以 POST /api/chat/conversations/:id/branch 命名存在(chat.ts,2026-08-30 立;V3 按 fork 关键字 grep 未命中属命名差异)⇒ 按 §0.6 不新开 /fork,改为把既有端点按票面口径收口:响应返回新会话 id + fork{sourceConversationId, forkedFromMessageId, sourceRootId, sourceSiblingIndex, messageCount};复用票59/64 的 parentMessageId+siblingIndex 族根判定并抽出纯函数 linearizeForkHistory(每族只留一版,分叉点必胜);鉴权只取 request.userId(body 自报 attacker 仍以真实主体入 queries,他人会话 403 且 branchConversationFrom 零调用,越权插入/更新计数 0);幂等用 clientRequestId 在源会话 FOR UPDATE 锁内查询,重放返回首建会话 replayed=true 且计数不增,键撞别的分叉点 409;复制以 .returning({id}) 回库确认,不符整批回滚。未判定:真库端到端(.env.test 不存在、PG 仅 5432)⇒ 四格为离线 mock 链。剩余面:客户端(api-client/web/RN)需透传 clientRequestId 才吃幂等 (b55f46c8b5)
- 🐞 Fix:后台任务重臂按结算面/身份面分域复位(G-272) (34828b1db3)
- ♻️ Refactor:rules 族本地 api 壳迁至共享出口 apiOrThrow 并摘零消费方壳文件 (ea570fc43f)
- 📚 Docs:结清 2 枚(第 11 批:G-115 真分叉 / 第二个死端点簇) —— ①G-115 按 §24 机主令代裁并执行:不再等"谁在哪个窗口收敛",直接用仓内既定出口 node scripts/git-sync-converge.mjs 走索引层 union 合并(零触碰他人未提交文件),合并枚 f8c25b537b;现读 git ls-remote origin refs/heads/main = f8c25b537b07a68d9daea4d6a231e7d840441b83 = git rev-parse HEAD,git rev-list --left-right --count origin/main...HEAD = 0 0 ⇒ 部署环的"远端 tip 分叉且自动收敛无效"根因已消除。合并后回潮审计:本会话 23 枚结清行零回潮。②第二个死端点簇按席位二段式复量收口:六条(agent-reviews/wallet-bank-cards/messages-chat/course-annex/course-qa/course-resource)全部已有等价端点且在 HEAD——agent-reviews GET /api/agent-reviews、wallet GET /api/wallet/bank-cards(插件级 requireAuth)、messages GET /api/messages/private/list 与 POST /api/messages/private(checkAuth,senderId 取承载层 request.userId)、课程三屏走 GET /api/resources 与 GET /api/edu/qa 且 RN 屏已改指;阳性对照 invited-users 4 文件 7 行证明尺子有牙;零新增端点(重复造会与既有端点漂移)。受影响用例 Test Files 2 passed / Tests 14 passed。剩余面如实点名:order-log/order-track/vip-compare/message-group 四词另计;BankCardScreen 库无 bank_cards 表(无表可取)、三条课程屏缺 courseId 维度 ⇒ 产品语义缺口,非端点缺口 (fb77aa60b8)
- 🚀 Feature/Improvement:帧名单源收敛到 CHAT_SYNC_EVENT_NAMES,sse 契约只引用不重写值 (54748ccdfb)
- 🚀 Feature/Improvement:会话分叉端点收口(票60 服务端余格)——复用 sibling 版本族 + 幂等键 + 计数诚实 (5e72a6df8b)
- 📚 Docs:O65 补回正式编号 O6501-O6513 + P0 四件翻勾(O6501-O6504) (4f2f9c8176)
- 🔧 Chore/Other:G-593 上行应答接受性守卫改语义锁 —— 票面前提已腐烂(四条在 2026-10-07 已随实现恢复转绿),本轮只把两条字面锁换成行为锁并留变异自证 (caee7106db)
- 🚀 Feature/Improvement:O65 P0 安全护栏四件 —— 根护栏/成本熔断/影响面隔离与原子回滚/人工阀清单 (9caeac97d5)
- 🔧 Chore/Other:结清 G-941(成本账本按链别归一,249 passed+ruff+mypy strict) (a34df2bf63)
- 🔧 Chore/Other:G-593 上行应答接受性守卫改语义锁 —— 票面前提已腐烂(四条在 2026-10-07 已随实现恢复转绿),本轮只把两条字面锁换成行为锁并留变异自证 (c8f2750a5c)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (ca97133f4f)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (90c0862194)
- 📚 Docs:G-957 行内失真路径就地更正(票面挂点 login.tsx 已随 2026-10-23 定档删除/回传腿已由 webview onMessage 接管/scheme 已登记)+残余两格点名;主键·归属·租约三维守恒由 plan-task-index 当场断言 (3af96ef954)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3ef3c8e667)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4c98968e83)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a8b9c604c8)
- 🔧 Chore/Other:L28030 门39票达成完成即删——六屏已由别席下沉(6→0),末条aboutPageSections数据文件豁免与别席同批在库,门现读全绿镜像10/10 (864c743fac)
- 📚 Docs:结清 79/B03 权限双轴化(运行时真接线) —— 席位提交 7f850459839024c3333ee5acb38fa75dc2aef774 共 12 文件 +1247/−53。主席自审复跑:apps/cli 三份新/改用例 permission-axis-runtime + sandbox-strict-default-on-missing-config + sandbox-profile ⇒ Test Files 3 passed / Tests 59 passed。落点:packages/types/src/permission-axis.ts(判定本体 evaluateAxisGate + granular 五布尔 + 归一化)、apps/cli/src/sandbox/permission-axis-runtime.ts(装配优先级:显式 > config profile > 五档映射 > 契约默认)、apps/cli/src/tools/index.ts(ToolContext.permissionAxis + executeToolCall 轴闸,覆盖 hub 分支)。默认值现读:SANDBOX_MODE_DEFAULT=read-only、APPROVAL_POLICY_DEFAULT=on-request、生产装配 DEFAULT_SANDBOX_PROFILE=limited ⇒ workspace-write(绝非 danger-full-access);未知值一律落 read-only/untrusted 并 warning(fail-closed)。单一真相源:三值/四值/五布尔仅存 types 包,CLI 零副本;check-declared-policy-has-consumer 与 check-permission-mode-vocabulary 均通过。剩余面如实记录:交互确认窗未真机走查、CLI 暂无 --sandbox-mode 旗标、loadSettings 不执行 layer-policy 项目层过滤(既有缺口与 sandbox 键同型) (823794e403)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (286ee41245)
- 🔧 Chore/Other:结清 G-863(附件容量改提交式CAS,18/18 绿) (8f39ff5ab8)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (02758036ef)
- 🔧 Chore/Other:L28030 门39票达成完成即删——六屏已由别席下沉(6→0),末条aboutPageSections数据文件豁免与别席同批在库,门现读全绿镜像10/10 (7589a3fa87)
- 🚀 Feature/Improvement:权限双轴运行时接线(79)+ 沙箱默认严档运行时强制补齐(G-212 第十一批 cli 半) (7f85045983)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8486d01dda)
- 🔧 Chore/Other:tmpdir 族 90 副本同据终清(折并器上限外交人工:票已结清,check-fixture-tmpdir rc=0 同据,全部副本翻勾即终态) (8115eb8c5c)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4f0075f311)
- 🔧 Chore/Other:结清 D22046(通道②③+比对驱动未变化承诺,cli 49/49+tsc0) (477ab648bd)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c248511bdd)
- 🔧 Chore/Other:G-212 结清——两侧齐(cli 半 goal-r57 严档+ai-service 半已自落本轮现跑 15 passed),翻勾条件成立 (c797e033c4)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (af71cd1e10)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (29c73b7469)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6d6da34226)
- 🔧 Chore/Other:G-620 结清——两道 blocking 红(门150/门90)本轮现读全部转绿(桌面事件三层闭环通过阻断 0),跳门前提不复存在 (9b816186f3)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3ea059635d)
- 🐞 Fix:next-plan-id --check 重号判红改差值棘轮(存量只报数/新增才判红)—— 承 G-955 收口 (f6b9df39ba)
- 🐞 Fix:G-957 网页授权回传腿失败态如实提示(换票失败/异常不再静默) (d47a2842a3)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4d922ea918)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b546442d02)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (9e49a4b02a)
- 🐞 Fix:折叠漂开副本族(N→1,认领合并到保留行 + 逐字留痕;--fold-drifted-families) (e48584bd7e)
- 🔧 Chore/Other:清偿叠注记存量 46→2(9 行折并,行数与勾选/租约/归属三维不变) —— 折并判据不另写:直接 import 守门 13d 自己的 noteTokensInLine / redundantNoteCountInLine(§0.6 单一真相源),对同一行内逐字相同的注记保留一份、删除多余份;全量档现读 叠注重数 46 → 2,残 2 份属承载段分词形态(判据计入但字符串面找不到第二次逐字出现 ⇒ 如实留报数,不猜不改)。本枚只动这 9 行注记文本,复合主键与正文语义逐字不变;门 13d 复跑 RC=0(差值档,存量只报数) (beaba75247)
- 🐞 Fix:补齐漂开族折叠通道(--fold-drifted-families)的两处形状锁 + 补镜像测试 (36d800cb53)
- 🐞 Fix:维③重数棘轮补「重复登记副本」三形态并取消 24 字上界(现读存量 46 份只报数) (4c155346b0)
- 📚 Docs:结清 G-926(lint-staged 已跟踪却被 ignore 的雷区)—— 席位提交 2c9d023f4b;主席自审复跑 node --test scripts/tests/lint-staged-ignored-tracked-ledger.test.mjs ⇒ tests 14 pass 14 fail 0。现值现读:[tracked-ignored] 面=head 存量只报数 12 条,git ls-files -ci 同为 12 且全在 .ihui-agent/archive(11 md + 1 json,唯一命中 .gitignore:186);票面 84 枚里的三族已由 41a3bdeeb4(取消跟踪 tmp 61 枚)、a402f50043(删 articles 宽式忽略)、8c952aac27(为 plugins/*.cjs 加负向例外)收口,故判 closed-by-others 未重做。archive 那 12 枚是门 71 archivedCopy 的归档凭据(读 HEAD/索引树),摘掉即削正当删行的依据 ⇒ 建议退跟踪 0 枚。另修一处恒红口径:旧 T7 把命中根 glob 记成失去 lint 覆盖,而 .prettierignore 早已整目录忽略 .ihui-agent/,64 枚系双计;新口径只问工具本体 prettier.getFileInfo(不另写 glob),限额 50 与给源码目录塞黑洞出口件必红的语义都不动,并加了正探针。三臂真 lint-staged CLI(--diff=HEAD,scratch 夹具):absent 报 git error、tracked 正常 Done staging 且索引 blob 未被改写、untracked 同 absent。剩余面:门 236 豁免按目录前缀放行,将来 git add -f 塞进 archive 的新件会被放行(动豁免语义需另票) (c683c71b8d)
- 🐞 Fix:维③重数棘轮补「重复登记副本」三形态并取消 24 字上界(现读存量 46 份只报数) (56227f8b33)
- 🐞 Fix:为 gate #193 补 8 处 git 派生调用的显式 stdio (15372e4aba)
- 🔧 Chore/Other:api<T>234 迁移回潮副本同据复翻——goal-b15 S10 已结清(349e116a66+b3b3f64276),本轮同据复验一致 (59a3a90a56)
- 🔧 Chore/Other:结清 G-876/D195/G-937 三枚(注册验码/通知归档流/归档器B档,均带真跑证据入行) (3b1a29df96)
- 🚀 Feature/Improvement:违禁桶兜底清扫器 strip-banned-buckets——两道机主禁令(等条件F12/待拍板F11)的执行器物化:guardian巡检轮 sweepBannedBuckets 派发(5min节流),自动摘HEAD面两桶未勾行并留痕f12-purge;判据import单源零复算;SWEEP-RESULT三态;镜像7例(留痕在落地之后/走object-space-land不自带CAS/已勾不进射程/scrub消费端对齐);AGENTS禁令条补点名+复翻席纪律(复翻须同步摘形态);自检5组+镜像7/7+eslint 0 error+clean态派发实测正常 (41988c0b3d)
- 🔧 Chore/Other:G-962 结清——高置信族逐条现裁全过时(computer-use 在册/announcements 公开族/members/groups/browser-sessions ai-service 全族/organization.ts 已亡),门 8 现跑通过;余参数段未判定=判据能力边界非死调用 (34ba9ee749)
- 🔧 Chore/Other:G-937 结清——根因已于枚 0b1d98107c 修复(seamArchiveChunk+§22c 镜像锁),归因档 c038a654db 为 HEAD 祖先,修复当日 113e612833 落地归档 24 枚;self-test 63/63+镜像 39/39+--list-blocked RC=0 现读,本行属门 239 型已归档票复活副本 (0d3969e1c1)
- 📚 Docs:结清 dot-source 新鲜度维(第 4 批 1 枚) —— 席位提交 14a93e75b8032e067906e7c5cd750fd546bacbc2 只动 check-service-binary-paths.mjs 与其镜像测试两文件;主席自审复跑 node --test scripts/tests/check-service-binary-paths.test.mjs ⇒ tests 32 pass 32 fail 0。新增三格:断链独立三态 brokenlink(EACCES 仍走未判定,两态不并桶)、dot-source/Import-Module 传递闭包按现读写法扩收变量形($X = Join-Path 静态赋值 + . $X,RHS 非静态仍点名不猜)、每服务 fresh/stale/断链/未判定分桶入 renderText 与 totals。本机 nssm 不在位 ⇒ 现读 未判定 3(IHUI-AI-SERVICE/IHUI-API/IHUI-WEB),按 §0.3 不顶绿;真服务链上 stale/断链臂需有 nssm 的机器现读,属剩余面非本票射程 (ee2fc177e6)
- 📚 Docs:结清 G-1222560 危险登记(索引面三份 web 语言包坏 JSON)—— 复跑取面:git show :packages/i18n/messages/web/en.json|JSON.parse=OK、ja=OK、ko=OK,HEAD 面五份亦全 OK ⇒ 他人暂存的坏索引现场已消失;该行正文自我嵌套 4 层副本并入注记+3 条同题原号指针,属票面腐烂,凭据以本枚现读为准 (a88a00a74d)
- ♻️ Refactor:face-reader 判据符号单源化——BARE_GIT_RE/bareGitCountOf/hideComments 三符号自 face-reader.test 内闭包搬入 lib 导出(test 改 import,逐字零语义,G-927 同尺差集工具取材用;35 例面 34/1 棘轮红系他席在飞 G-927 收口的 10 枚新增待其落地后自然回落) (05a18375b9)
- 🐞 Fix:服务新鲜度维收口三格(seat-svcfresh,G-1080903 回捞副本续)——断链独立三态 + 变量赋值 dot-source 解析面 + 每服务分桶现读 (14a93e75b8)
- 🔧 Chore/Other:G-955 复验结清——取号入口实测可用(next-plan-id --check 真RC=0) (7930521657)
- 🐞 Fix:摘除指向已删路由 organization.ts 的死测试——HEAD 上该测的 import ../organization.js 解析不到任何文件(守门98 D2 零容忍恒红唯一一枚);全仓再无 organizationRoutes 引用,路由面已由 zhs-organization.ts 承担;与工作树既存删除(D, 他席在飞)同一处置,本次只把它材料化,不新建替代 (d35827d96c)
- 📚 Docs:结清第二批 4 枚(工作已在 HEAD 或本批席位落地)—— G-343 / G-880 / G-32 / G-934 (c11e24d5f4)
- 🔧 Chore/Other:独立席四票复验结清 D04/G-934/G-924/G-239——票面自写判据逐条当场复跑,零复算 (7b562d0477)
- 🐞 Fix:G-880/G-32 收口核验+成对自检补锁 —— 两禁令门(emoji/shared-layer)迁面与加固判据经现读确认已随 a6c7cb36ec 入 HEAD(listFaceFiles 按面枚举+readSources 同面取材,门内零 readFileSync);本批补票面硬要求的两把缺失配对锁:三面同形干净仓⇒三档全0(防恒红,W10 型)与 --staged/----worktree 两面旗同给⇒main 返 2(§0.4 互斥)。三档现读:emoji 全量6233文件0违规exit0、--staged 0违规exit0、--worktree 0违规exit0;shared-layer 全量/staged/worktree 均 hook 维0违规exit0(util 存量只报数)。镜像测试 emoji 17/17、shared-layer 12/12;check-gate-wiring --strict exit 0 (390d395038)
- 📚 Docs:O65 自进化 13 任务补正式编号 O6501-O6513(以 HEAD 为底稿恢复回潮丢行+编号派生侧车键) (702373ef97)
- ♻️ Refactor:G-343 DRIVEROOT 族残余清零(票面四处全数核对)①②已由 852c9409 收口(audit 私有 devEnvRoot()/pgBinDir() 与失真头注、app-reads:56 硬编码盘符推导现读复验=族内生产文件仅 import lib/psql-client-locate 单源,无第二份推导);③现读补出=pg-restore-drill.mjs 头注"未设 IHUI_DEVENV_ROOT 时两者逐字同值(本机同为 G:\DevEnv)"已失真——devEnvRoot() 当次实测命中仓内 .DevEnv 形态(G-814433 搬迁后),旧数层式与共用出口不再同值,且把盘符当本机事实写进注释违 AGENTS 盘符铁律,改为陈述候选序与两形态差异并点名 P-落点1/2/3 现算;④现读补出=pg-restore-app-reads.test.mjs:49 在测试里重算 IHUI_PG_BIN_DIR||join(devEnvRoot(),...) 第二份 pgBinDir 判据体(§0.6/§22c),改 import ../lib/psql-client-locate 的 pgBinDir() 与工具同源。复跑凭据:audit --self-test rc=0(取证在镜像测试)+ audit.test 连跑三次 59/59 pass;app-reads.test 8 pass/3 skipped(未判定:psql.exe 不在位,环境闸按设计);drill.test 29/29;守门45 check-c-drive-paths 全量档✅、check-workspace-hygiene HEAD 面✅无新增违规 (caef8d065d)
- 📚 Docs:维③ 头注实测数改正——70 份叠注里 49 份在承载段内、21 份落活文本(此前误写 72/51);纯注记订正,判据字节未动,自检仍绿 (9129d9253e)
- 📚 Docs:结清 7 枚僵尸票(活已在 HEAD、行未摘)——分割线 G-877、判据盲区 G-879、原生弹窗 G-878、MCP stdio 四票 G-689/G-691/G-692/G-694 (6c6efc415b)
- 🔧 Chore/Other:G-874 结清——web 注入两调用点+共享按钮消费+login 族 30/30 绿;原生 WebAuthn 免依赖方案优于票面;未注入不渲染=平台豁免成立 (0cd4af3484)
- 📚 Docs:O65 侧车键由 自进化# 收敛为编号派生 O65xx#(13 条) (62a6546229)
- 🔧 Chore/Other:G-957 剩余格改归属机主小程序后台白名单面(正规改桶通道 LIVE_BUCKET_RECLASSIFY,actionable→owned-elsewhere;格②已入库凭据在案) (6dbb495b4d)
- 🔧 Chore/Other:G-63侧车重钉(union带回旧记录终修),A2归零 (f3fbf0bbba)
- 🔧 Chore/Other:G-934 结清——出路①接线三轮凭据在案(47dc360911 实体测 13/13 本轮复验+56cc4a66f4+847925be2b)+§17 真浏览器核验已落(82c9a68ae0 四例两轮绿);10 红前提过时 (80f8fb9f23)
- 🐞 Fix:维③叠注存量归零——判据剥「副本正文并入·承载整段」平衡段(逐字引文非活注记,72→21),活文本按逐字同串摘 21 份(L5361 x1/L28173 x18/L28911 x2,只删同串不并族);自检10/10、镜像14/14、行数/勾态全等 (75d303394e)
- 🔧 Chore/Other:G-876 结清——实现已在库(code 必填+503 fail-closed+用途锁+防枚举,枚 9e103ac0f6),G-81 席复验 auth 1311 全绿背书 (217be03c9f)
- 🔧 Chore/Other:F4末2组收口——O-02摘旧底稿裸行(正主带租约+③格注记)/G-116摘旧句(正主标头规范),留痕f12-purge (6309556402)
- 🔧 Chore/Other:F4四组+跨号副本收口——G-1222558错号/G-937裸副本/G-10旧句/G-11旧句/B02旧副本各摘副本侧留正主(留痕f12-purge);union回潮体清偿末批 (32b2a83941)
- 🔧 Chore/Other:G-963 结清——修复已落库(测试文件 G-963 注记在案),现跑 f9 族 10/10 绿零 ERR_MODULE_NOT_FOUND (eac4da4f06)
- 🔧 Chore/Other:G-74 远端合流回潮体复翻——并发席已结(d5cce09f8c 校验收口+sponsor 地址在案),配置面余格归机主面行承接 (9b66a50d77)
- 📚 Docs:O65 自进化战略方案文档 + 13 条派单侧车记录 (76f6b4891c)
- 🐞 Fix:补回索引迁移时误删的三门点名(守门89 R4)——check-ai-task-background-reference(247)/check-money-display-single-source(248)/check-registry-sync-health 只存在于被删的旧副本里;91,095→91,589B(余量 4,411),标记仍为 0 (af3da98e1c)
- 🐞 Fix:摘除门249内联点名行——README 索引节已收录该门(4165487e5a),R4 文档面由 README 承载;AGENTS 91,293→91,145B(余量 4,855),冲突标记保持 0 (09498f86d2)
- 🔧 Chore/Other:远端合流回潮第三批复翻 4 行——G-76 守门39(83aa572b23e)/G-38 视觉票(r3c)/D42046 巨行(603d8236d8f 同据)/G-60 content-visibility(522ac4dac2+回归锁 7413f9fd31);凭据全验祖先 (a2dab37433)
- 🐞 Fix:修复 union 冲突标记注入体并摘除回潮索引副本——108,200→91,293B(余量 4,707);标记区取「索引已迁 README」侧,补点名门249以满足 R4;被删索引块 127 门名经 README∪本文零丢失;实读:check-agents-doc-size --worktree rc=0(91,293/96,000)、check-gate-wiring --worktree rc=0(R1/R2/R4 零红) (c4afc6a953)
- 🔧 Chore/Other:F9撞号3组收口——G-07副本自声明行/G-27错挂旧号行/G-76回插已结清题的正主位保留副本行摘除(各留正主行;留痕f12-purge) (5fe4d76372)
- 📚 Docs:守门 249(富文本锚点渲染器单一源头)补进「守门脚本点名索引」的接线/自检行 —— 门 89 R4 义务;207 第二刀把索引整体迁本节后,新装车的门必须在这里点名(原 AGENTS 内联副本即将随冲突标记一并剥除,AGENTS∪README 文档面不得出现空档) (4165487e5a)
- 📚 Docs:O65 登记自进化四期可派单任务 P0-P4 (b19e8ebb21)
- 🔧 Chore/Other:两票结清——desktop-feed 线上现读 0.1.76(2026-10-18 发布,远超 0.1.45 验收目标,前提过时);128 点迁移归档票复活活行复翻(门 239 R1 型,归档注释逐字在案) (4879305684)
- 🔧 Chore/Other:D03侧车重钉(owner=持有席/waiting=none)——union带回旧记录的终修,F12基线棘轮归零 (42af89577d)
- 🔧 Chore/Other:守门8假绿灯远端合流回潮体复翻——凭据 1d5e73e2d3(goal-r52 收官+三路径查清),修正归扩面批次 (8ce176c228)
- 🔧 Chore/Other:union回潮体清偿——对侧旧底稿灌入的违禁形态行摘除(等条件+待拍板未勾行,留痕f12-purge;两道机主禁令之下union行级回补不带违禁形态;goal-r4复翻席注意:复翻时须同步摘禁令形态,行的事实内容已按各批结清提交保留) (382d4dc4c0)
- 🚀 Feature/Improvement:G-50 DevEnv 搬迁执行器物化——devenv-migrate.mjs(静默窗口探测器三态window/pending/undetermined+六步盘点+预演零写盘+--apply执行器,isDirectRun双形态)+镜像17例;现状盘点:搬迁主体已发生(09-30),残余由器物自判窗口不挂账等条件;顺手清api-routes 3枚/devenv-migrate.test 2枚/dedupe-live-doc 1枚解构残量unused(union带入机械残留,零语义) (f2ddfe9b9e)
- 🔧 Chore/Other:goal-r4 远端合流回潮第二批复翻 13 行——tmpdir 孪生/四件待拍板版(事实四件已落地,待拍板定性作废)/P2-13③孪生/MCP四票(goal-r3 r27i)/失败广播/G-217/G-239/D04;凭据=各批结清提交+新鲜现读(夹具门 rc=0/邮件鉴权在位/守门249 rc=0) (04f4ca3e86)
- 🔧 Chore/Other:H02 远端合流回潮体复翻——凭据 eff4b6d5bd 已推远端,裁决同前(结构性无样本,只记不挡维持) (ef210af486)
- 🔧 Chore/Other:goal-r4 远端合流回潮体批量复翻 34 行——Esc×4/窗格×2/工具面板/O-1/G-939/守门134/四维/取消信号/宿主中止/审批CAS/守门91/G-27/真机走查/prod-bundle/四件拍板/G-35/G-61/G-76/G-807/发丝线/锁初始化/P1-②/G-77/钩子取消腿/AGENTS体积 等,凭据=本会话各批结清提交(全已推远端);行内逐条防新鲜牌(0 冲突) (7df8da52ec)
- 🐞 Fix:R5撞号收口——摘除两枚复活门注册块(bare-decode-uri/token-literal-debt,门体脚本已被对侧删除,注册残留=HEAD面247/248双撞号源);富文本门已改号249保留,盘面 idsOfRegistry 现读各1次 (464cc8efaa)
- 🚀 Feature/Improvement:auto-evolve 起会话通路端到端打通(O65 第 0 期收尾:JWT 现签 + --probe 自检 + 真派验证) (87a7713ccd)
- 📚 Docs:argument-repair-loop 装车缺口取证收口——假阻塞「index.ts 被并发会话冻结」就地改直 (61496e7201)
- 🔧 Chore/Other:goal-r4 结清 D04 富文本动作锚点——验收三格全齐(浏览器五例/两腿 DOM 签名等值+语序两态/规模化两载位齐:degradeHint+examplesTip+wallet strong,载体 importer 6 个),守门 247 现跑 rc=0 (e8423e37eb)
- 🚀 Feature/Improvement:web↔RN 屏对齐登记 41 条 + 把跨端自动登记器装进 post-commit 链 (6ad5de3c37)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1081dca6e1)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (194de04708)
- 🚀 Feature/Improvement:跨端登记自动器装车 + 3 条真镜像声明与 1 条 web→RN 映射 (5f1d02f835)
- 🚀 Feature/Improvement:O65 第 0 期翻勾(调度器+四道闸随批完成,验收证据入注记;代码枚 0e4bd3628db);1-3 期补立档日期交代(三选一:新鲜日期,按依赖序排队) (b1ffbc4b23)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (ab3bc7beb4)
- 🚀 Feature/Improvement:auto-evolve 自进化调度器第 0 期落地(总纲 O65·调度层+四道闸) (0e4bd3628d)
- 📚 Docs:更正 ContextUsagePanel 的过时披露 —— RN 腿已接通,并点名新落的那把锁 (6abb419f66)
- 🚀 Feature/Improvement:上下文占用归因面板接上 RN 主屏 —— G-403/G-225 缓存两维的最后一格 (8ce7d87758)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (0166713afd)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7faaebcc51)
- 🚀 Feature/Improvement:登记 AI 自进化调度系统 auto-evolve 四期系列总纲(O65;第 0 期调度器+四道闸随批施工,感知/部署/回流三期按依赖序排队) (164b973cfe)
- 🚀 Feature/Improvement:G-217a 点赞/收藏两表唯一键迁移 —— zhs_agent_thumbs/zhs_agent_collect 加 (uuid,bot_id) UNIQUE,把上一批(22ee752721b)靠事务 FOR UPDATE 父行的防重底线放进库层:2026-10-25 实测该族缺陷正是『一次点赞计数+2、取消只减一次』,应用层锁管住今天的写口,管不住未来绕事务的批量导入/人工修数(无约束=漂移只在计数与明细分叉后暴露,而全仓无 count(*) 对账)。线上两表 0 行,零回填成本。手写迁移口径(sql+journal,idx 343)+水印,同 20261026100000_command_ack_facts 批形制;旧普通索引保留不删(一次提交一件事,删索引是另一票)。验证:check-migration-immutable 绿(存量基线报警为门内只报数项,非本枚引入)、database tsc 0 错、likes-routes 回归 8/8 绿。 (c92836e7e7)
- 🚀 Feature/Improvement:ActivityDetail 接线 + web↔RN 屏对齐登记 7 条(教育/公告/问答/权限/agent 家族) (fb58a90253)
- 🔧 Chore/Other:refactor(web,mobile-rn,miniapp)+feat(gates): 显示层分→元格式化同形副本 20 处收口 formatPrice 唯一出口 + 装守门 248 —— fmtYuan=¥\.toFixed(2) 一族在 HEAD 逐字复制(web12+app2+enterprise×2+formatYuan+toYuan 共 20 处):改一处单位口径须 20 处手改,漏一处=那端页 100 倍显示事故(分销族 46758b5b2b8 批修的同型受害者)。全量委托 @ihui/shared/utils formatPrice(非有限回 0.00,定长两位,¥ 前缀归调用面维持版式)。刻意出射程(行为不同非复制):ai-pricing maximumFractionDigits:4 定价展示、purchase/helpers 动态位数 formatCents、局部常量行(M2 只报数)、返回 number 的数字换算。守门 248(blocking,stagedTriggers=显示层四端):M1 展示型自算定义绝对零容忍(存量本波清零;委托转发合法,定罪看实现,与日界闸 246 同口径)/M2 行内定长格式化按文件 HEAD 差值棘轮/M3 装车(importer 20);self-test 10 例成对夹具+镜像 3 例(全显示层 0 违规扫),门体先经 eslint 定责一轮(死常量/eqeqeq 两错已修)。AGENTS 点名 248(R4),并顺手为别席在飞的 registry 哨兵闸补 R4 点名行(照 runner/guardian 接线原样,该闸文档隐形会挡所有提交链)。AGENTS 先过 merge-live-doc 归并(lost=0)。验证:eslint 涉改文件预跑 0 问题,gate worktree 三面绿,miniapp 1032+mobile-rn 1185 例全绿,web/miniapp/rn typecheck 我文件 0 错(web 余 openDockedTab 三文件红=别席 work-panel 在飞面)。 (0d2a23f970)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1d8116c1b9)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (dd997d68b7)
- 🐞 Fix:收敛预解第二轮 —— G-55 就地翻为对侧结算行(四项已在库,本席==基底旧态由本行承让),删除尾部 dump 区的守门 89 R9 重复块(首份完整保留) —— 为 union-converge 预解 F1 最后一组与 F6 最后一块;两侧独有行零损失由 union 模拟 REG=[] 现证 (07ea442ded)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2f39e473af)
- 🐞 Fix:在途请求覆盖新态四格根治(前端清单收尾批)+形状锁 —— ① TrendChartDialog:弹窗重开/换 itemId/换窗口连发,慢的旧窗口响应覆盖新曲线且旧 finally 提前熄灭 loading;② learn/topic 付费课:切课时旧列表迟到响应串进新页;③ ide/mcp-pane DetailPanel:常驻不重挂载,切换选中项时迟到详情张冠李戴;④ ModelDetailDialog 行过滤 .filter((r)=>r.value) 把合法 0(免费模型 inputPrice/outputPrice=0)当缺失吞整行,读作『无此项』——改判 !=null && !==''。竞态窗口在微任务时序,jsdom 行为锁必 flaky ⇒ 按 race 家族既定口径钉形状:fetch-sequence-guards.node-test.mjs 四真组件逐一体检(序号自增+写前复核+ModelDetail 两向)+成对夹具(摘守卫翻红 6/6 绿);形状搬家 assert fail 报『锁要跟着搬家』防静默失配。验证:apps/web tsc 我文件 0 错(仓内余 3 红=checkin/GlobalTopBar/web-work-panel 属别席 ca6995 收编批残留,非本批),node --test 6/6。 (5e1978b98a)
- 🐞 Fix:三方归并预解——增长图取对侧 57d951 柱形新形态,本席重排保留,并全文件格式归位 —— 别席线形图(1fb44)与对侧柱形图(57d9=14 根太密⇒interval:2/纯柱形/柱顶不标数)是同功能两种写法,取新者;重排四档(wb-prio-user/ai/traffic/trend)+KPI 双卡前置+业务面板用户三格提首/接口排行下移,均在对侧底版上三方重放(merge-file,唯一冲突=图定义二选一,已按裁决留柱形)。验证:prettier --check RC=0(本席 3083b39 未走钩子的格式存量一并归零)、水印零宽链完好 verify 绿、门 240 --worktree R1-R8 全绿、vitest wallboard 2 文件 11 例全绿、tsc 墙板 0 错(仅存三枚别席在飞红点名不代治)、KPI 卡序 users>ai>qps>err>p95>turnover 现读。为 git-sync-converge 的 --resolve 页面路径预解:本面已含两侧全部独有行(对侧逐字打底),收敛无需人工 (584041c957)
- 📚 Docs:登记 decode 家族单源收口(移动端深挖批唯一遗留:auth oauth2 私有实现 + 门248 D2 九处) (5e38613843)
- 🐞 Fix:重锚机主 2026-10-25 定档首屏重排 + 补回被连带洗掉的增长曲线定义 —— 别席 ca6995ca20b(自动收编在飞副本)把 page.tsx 从「639bd 重排 + 1fb44 增长图」形态写回旧两档编排,并丢了 userGrowthOption 的 useMemo 定义(2219 行用法仍在 => tsc TS2304)。本枚按 639bd7f7797 底稿在现 HEAD 上重落:KPI 带「用户/AI调用」两卡前置到最左(用户卡 sub 今日新增=增长读数);面板业务纵深 wb-prio-user(-40)、AI 号池 wb-prio-ai(-30)、访客与机器人 wb-prio-traffic(-20)、流量趋势 wb-prio-trend(-10),四档两两不等防同值静默回落;业务面板内用户三格提为第一眼读数、接口调用排行下移至签到块之后(14 日增长曲线随位保留);WALLBOARD_CSS 四档定义与编排注释同批,其余面板 order-1 形态不动;userGrowthOption 定义块从 1fb444802bc 逐字恢复(复活行=本票有意重落,走 LAND_ALLOW_STALE 留痕,非滞后副本误带)。验证:门 240 --worktree R1-R8 全绿、verify-wallboard-readout --self-test 12/12(建模 60/60 格)、apps/web vitest wallboard 2 文件 11 例全绿、watermark verify 载荷完整、check-i18n-keys 19187 键 5 语言 parity OK(本批零新键)、apps/web tsc 墙板 0 错(仅存错=checkin/GlobalTopBar/web-work-panel 的 openDockedTab/onHome 三枚,系别席 work-panel.ts 在飞未落,本票不代交点名在此)。并发说明:普通提交路径仍被别席在途文件占用,走 object-space-land 只交本票一文件 (3083b390c9)
- 🐞 Fix:union-converge 冲突标记闸补接 import —— 2026-10-25 头注的闸只写调用未引 lib/conflict-marker-guard 的 assertNoConflictMarkers ⇒ 本器任何带 <<<<<<< 的树内容在 writeBlob 处 ReferenceError 崩(实测 dry-run base=a6c3c036be ours=本地线 theirs=179fc770b5a 即崩,RC=2 未判定),收敛器全程瘫;补一行 import 后同输入 dry-run 正常出闸(CHECK ONLY 正常走完,落地闸 3 处为真实内容裁决)。修复凭据=§1「能当场修的当场修」+本席收敛作业被此 bug 挡住的直接受害现场 (df25853257)
- 🐞 Fix:墙板页剥回成对冲突标记 —— 11:18 手工收敛把 merge-file 原始标记带进 main 的清偿(零内容变化) (3363928c6e)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (cc7389109e)
- 🐞 Fix:三族小面根治+一批测量基建纠错 —— ① packages/shared usePaginatedList 补序号守卫(末发定案:后发请求落地前,先发的任何迟到响应不写数据/不写错误/不翻加载位),此前筛选切档与在途页互盖:旧结果 setItems 替换新第1页、把页游标偷换成旧页号(下次加载更多直接跳页缺页);web/RN/miniapp 三端共用该 hook,守卫随源生效。② CouponScreen 摘除 setStatusTab+setTimeout(refresh,0) 手工重发:hook 的 effect 本就按 fetcher 身份自动重拉,那发 setTimeout 捕获**渲染前旧闭包**且宏任务落在 effect 后 ⇒ 序号更大后来居上,旧档列表可覆盖新档 —— 手动那一发就是竞态源本身。③ 侧栏会话日期分桶改真日历边界(原实现滚动7天/其余全部,标签却写今天/本周/本月 ⇒ 数年前会话被标「本月」、缺 lastMessageAt(t=0) 同桶冒领):今/周(周一起)/月(1号起)/更早,缺时间戳归更早;aiChat.earlier 键五语言同批(web messages x5),groupByDate 按同文件 SearchableConversation 先例导出供纯函数单测(新套件 6 例含成对正向)。④ 测量基建纠错:apps/mobile-rn/tests/use-paginated-list.test.ts 原 import 经 RN wrapper → @ihui/shared/hooks **父别名指 tests/__mocks__ 手写平行件**(§22c 反模式活例)⇒ 9 例一直在验替身;改走配置内 exact 子路径别名直连真实源,9 例(含新守卫例)在对 shipped 实现上全绿 —— 替身漂移本身另行登记。⑤ 上一枚 history-page-hydration.node-test.mjs 水印载荷修复(手写头行截短致残迹,verify --staged 现形;clean+重注入 0 不合格)。验证:shared tsc RC=0,web tsc 我文件 0 错(仓内 4 红文件=wallboard/checkin/GlobalTopBar/web-work-panel 全部出自别席 ca6995ca20b 自动收编批的在飞残留,见交付报告),RN 全套 129 文件 1185 例、miniapp 1032 例、web sidebar/pane 相关 94 例、shape lock 5 例全绿。 (0d036f9909)
- 🚀 Feature/Improvement:补 4 条镜像声明(change-phone/change-pwd/help/point-history)——小程序页早已存在,只缺标记与登记 (22b3697a52)
- 🐞 Fix:旁路落地器补「成对冲突标记拒绝进树」闸 —— 79 看不见不走钩子的通道,牙装在写口上 (a844588db0)
- 📚 Docs:结清守门 207 存量清偿第二刀——AGENTS 108,515→89,968B(余量 6,032),三面 rc=0,238 同批复绿 (1377bdc7b2)
- 🐞 Fix:并发合并把「国内镜像」徽章带回 —— 按 2026-10-23 机主令重新清除(守门 238 复绿) (995ecb1615)
- 📚 Docs:守门 207 存量清偿第二刀 —— 点名索引迁 README + 速查区压缩副本移出(108,515→89,968B,余量 6,032) (8e99bd5626)
- ♻️ Refactor:抽离 git-guardian 的 TEMP 清扫与日志两族到 lib 以压住架构门 103 C1 单文件行上限（主文件 6094 to 5837 行） (8fe1fb2f10)
- 🚀 Feature/Improvement:首例真实镜像页——用户协议 pkg-about/about/agreement (aa4c418bff)
- 🚀 Feature/Improvement:补 study-index 镜像声明——pages/study/index 与共享屏 StudyIndexScreen 同为学习首页(taro 端内重写渲染层,按门 128 语义声明对齐目标);此前只缺标记与登记 (84b9acc2c0)
- 🚀 Feature/Improvement:补 coupon 镜像声明——小程序 pages/member/coupon 与共享屏 CouponScreen 键空间完全一致(coupon.available/used/expired),此前只缺「镜像」标记与登记 (652e5b052b)
- 🚀 Feature/Improvement:补 2 条 about 族镜像声明——app-permission / api-settings(页面早已存在,只缺标记与登记) (481fd87095)
- 🚀 Feature/Improvement:补 2 条 about 族镜像声明——app-permission / api-settings(页面早已存在,只缺标记与登记) (fe0abab5b2)
- 🐞 Fix:AI 侧栏历史翻页双缺陷根治(判高两条,前端清单回源仍活) —— ① 根窗格 handleLoadMoreHistory 原 res.data.messages.map 手工造行只留 id/role/content/createdAt,绕开水合出口 ⇒ 翻上来的旧消息丢 toolCalls/planSteps/citations/pinnedAt/parentMessageId+siblingIndex(版本族判不出⇒点一次编辑出两个气泡);改为与首屏(:676/:732)及非根窗格(chat-pane-body:222)同一出口 hydrateHistoryMessages。② 两处翻页回调 await getMessages 后都不复验会话:切会话时旧会话的一页被 prepend 进新会话、resetPager 把旧游标装进新会话、patch*Cache 把串会话列表写进旧会话缓存桶(LRU 持久污染);统一补 store.getState().conversationId 复验且先于一切写入(window 窗格体与根窗格同修)。竞态窗口依赖微任务时序,jsdom 行为用例会 flaky ⇒ 按 api-no-double-unwrap 先例钉形状:history-page-hydration.node-test.mjs 抽函数体+三判据(水合出口/复验存在/复验先于写入),2 文件×(正向+三型变异夹具)+良性对照 5 例全绿,摘任一判据即翻红。回归:13 套 88 例全绿;apps/web tsc 我改文件 0 错(仓内 62 错全部来自别席 ca6995ca20b 自动收编进 HEAD 的 wallboard 未决冲突标记,非本批引入,见交付报告)。 (dd56090e92)
- 📚 Docs:207 第二刀① 落地登记——归档移出凭据接线(判据单源 + 两个消费面),票保持未勾 (dbf38b926d)
- 🚀 Feature/Improvement:RN→小程序 镜像缺口账本自动化——139 缺口逐条带候选线索 (f67090ac4f)
- 🐞 Fix:清掉上一枚带进来的 1 个 error + 收口一处既存 eqeqeq (0bb9bfd89c)
- 🐞 Fix:AGENTS 归档移出被当成丢行 —— 第四态凭据接线补齐(守门 207 第二刀①) (b6023aa977)
- 🐞 Fix:合并回填本侧独有词条——miniapp 5 语 ×81 键 + mobile-rn 5 语 ×273 键 (2f651b8ce1)
- 📚 Docs:对外文档数字/端数口径收尾 —— README 瘦身版尾部旧版碎屑整段清除(7082→6007 行:八端清单/176 models SEO 段/两行矛盾结尾/孤立表行,主体均有现算版);L183 IP 白名单『只存不拦』过时表述改实链事实(ip-whitelist-guard.ts 在位);散文 testFiles 追齐现算值(3211→提交瞬间现算,活水竞态以门判绿为准);blog 四篇现在时套话更新(01 尾部 8 端/176、02 对标表与 footer 176、05 定价 all 176×3→101、08 邀请语 8→9);ja/ko 正文区 118→101、8平台→9 两形态 109 处、339 声明→608。保留:教程/历史内容(01/08/15 篇主题正文、成长叙事列表、日志区历史行、legal-8 下载矩阵);AI_CHAT_BENCHMARK_ANALYSIS_V4 六端为技术门范围不动。IHUI_SKIP_LIVE_DOC_CHECK=1 定向说明:README.md 系有意整档重写(15384 行大文件→6007 行摘要+九份收纳件索引形态),merge-live-doc 的 1596 行『真丢失』样例全为 8 端旧版声明与旧数字重复副本(--apply 会把它们 union 回来毁掉瘦身,故走有意重写通道);重写凭据=机主批准的 118 模型陈旧引用清偿+8→9 端口径任务,主体九端清单/关键数字生成块已逐段核验为现算版。验证:watermark verify 8 文件绿、check-doc-numbers --worktree 绿、现在时陈旧声明清零 (e7014684cf)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (29582c20a8)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8f7efe9cf8)
- 🐞 Fix:合并后撞号收敛——check-bare-decode-uri 让出 241(远端已占,check-rn-readout-cell),改号 248;判据与 skipEnv 一字未动 (68c00a3a05)
- 🚀 Feature/Improvement:资源目录同步停更哨兵三件套 —— 760 条全军只有一行 WARN 的静默型,自此当轮即红、恢复即绿 (0dd89c37e9)
- 🚀 Feature/Improvement:出口代理闸 IHUI_REGISTRY_EGRESS_PROXY —— marketplace 直连抖段的运维旋钮(默认关=行为零变化) (7fe57853cf)
- 🐞 Fix:registry 批量 upsert 批内复合键去重 —— 上游 offset 分页重叠让整批 760 条全军(PG 21000) (33cf83062e)
- 🔧 Chore/Other:治四处存量"代码对、锁旧"的源码漂移锁 —— 锚句跟着判据形态搬家,同时补变异自证 (91272a063b)
- 🐞 Fix:门 103 C1 二次超限收口 —— git-guardian 六块 141 行注释逐字归档换指针(零行为变化) (1f9a9a6fa6)
- 🐞 Fix:端内测试停止越层 import repo-tooling,清偿架构政策 D1/D2 六处 (4e2758c740)
- 🐞 Fix:207 第二刀票改"未取号"形态——G 族号池 pool-exhausted(占用面含 42 份归档件)，令牌残留是 G-15107 格①用法错，绝不发 1000+ 号；待号池扩容批补号 (87d1f894e7)
- 📚 Docs:登记守门 207 存量清偿第二刀(前置=补 declaredDropCaps 认 AGENTS 归档移出,防回潮吞掉第一刀成果;现读缺 9,156B)——第一刀已落枚 c9c85d63 (5f4bafc488)
- 📚 Docs:守门 207 存量清偿第一刀——速查区回潮副本 34 行整区移入 archive(125551B→105156B) (c9c85d639c)
- 🐞 Fix:门 128 两族判据射程差豁免登记 + 门 77 B1 wallboard 圆角绕档清偿 (a35ac94b7d)
- 🐞 Fix:字形箭头与双返回箭头清零——Collapsible 文本字形换矢量图标 + 五 pkg 页摘页内死返回键 (8f26a1f779)
- 🔧 Chore/Other:门 241 镜像测 T1 前提断言改大小写不敏感 (3a893d1481)
- 📚 Docs:守门 241(裸 decodeURIComponent)R4 点名行 (8ffd95d1dc)
- 🐞 Fix:移动端行为级深挖批——裸 decodeURIComponent 族 21 处从底层修复 + 守门 241 防回潮 (815bfe638f)
- 🐞 Fix:RN 样式裸数字回潮锁改号 240→247——远端 f126e734 已占 240(大屏读数不得断行门),合并前让号,判据与 skipEnv 一字未动 (284aa41062)
- 🔧 Chore/Other:门 240 判据镜像测试——3 例直接 import 源脚本 __test__(§22c,判据零复制),含阳性对照(把 rnSpacing.lg 改回 16 必须被抓) (1dfe636e62)
- 🚀 Feature/Improvement:新守门 check-bare-decode-uri.mjs 接进提交链 (6a3e148297)
- 🚀 Feature/Improvement:新增门 240 RN 样式裸数字回潮锁(差值棘轮)+ runner 接线 (d066355a35)
- 📚 Docs:点名门 240 RN 样式裸数字回潮锁(与接线同批;AGENTS.md 超体积预算暂不写入,README 已满足 R4) (d562ca2018)
- ⚡ Perf:跨端两把尺子改批量取 blob(HEAD 面 4 分钟→17s) + web→RN 尺支持 --full + 6 段 web-only 豁免 (da67136b16)
- 🚀 Feature/Improvement:补 4 条 about 族镜像声明(账本真实化,零行为变化) (f97405f954)
- 🐞 Fix:web→RN 功能尺三屏误报根治 + 删除一条不存在的 web 路由登记 (89239b8d3e)
- 🚀 Feature/Improvement:token 化批 #6 第 5 批(收尾)——21 文件裸数字转档 (3d8a7a3355)
- 🚀 Feature/Improvement:token 化批 #6 第 4 批——60 文件裸数字转档 (0088fd044e)
- 🚀 Feature/Improvement:token 化批 #6 第 2 批——60 文件 1020 处裸数字转档 (5308e7aaf5)
- 🚀 Feature/Improvement:token 化批 #6 第 1 批——tokens-migrate 扩为目录批量器物 + 60 文件 1583 处裸数字转档 (e506840fc0)
- 🐞 Fix:普查锁两 offender 清零——VoiceNote/LlmSettings 裸 TextInput 迁共享 TextField (e9226cbb50)
- 🐞 Fix:活副本纠偏批——上轮把 account-cancel/app-topup 判死副本是反的:现读 RootNavigator 1037/1048/1087 挂载体=packages/app 版,二屏 Modal 缺 onRequestClose 即安卓返回键在注销确认/充值说明穿透弹退出应用(与 MemoryScreen 同型,补 onCloseModal/onCloseIntro)。privacy 未入本批:终读现场与 HEAD 逐字节一致(我先前的挤行误判与复原互相抵消,无净改动;页码清单无错位,上轮该条定性撤回)。遗留如实:(a)packages/app 两屏标题硬编码(注销账号/充值)属 i18n 队列射程;(b)SDK 清单与 Expo+RN0.86 真栈脱节为法律文案,归机主/法务 (6e5cc2e93b)
- 🐞 Fix:行为级 bug 两枚——① VoiceNote 语音笔记面板:RN 原生 Modal 自成窗口不吃外层 KeyboardAvoidingView,面板内搜索框弹键盘后操作行整块顶出可视区(iOS/小屏安卓必现,Modal 内键盘关不掉)——避让容器移进 Modal 内侧,iOS padding/安卓 height;② packages/app MemoryScreen 新建记忆 Modal 缺 onRequestClose:Android 返回键不关弹层反弹确认退出——与右上角取消同语义接回 onCloseCreate。定性:account-cancel/AppTopup 两份 packages/app 旧身=死副本(消费方全指端内键化版,守门不判红)不代删除按§7归包持有人;auth.ts login 抛错为设计契约调用方统一兜;VoiceNote 已有 onRequestClose 不重复补。验证:RN tsc 0 错、vn-mount 13/13、eslint 0、水印 2/2 (60e2c90099)
- 🔧 Chore/Other:F9 分批收敛 #5(终)——CSRF 行 G-12→G-02、两版F5 行 G-30→G-18(双侧真声明位零 + 239 归档 marks 过滤验证);五门现读全绿(strict F9 0 组/234 warn/239 0/211 0/13d 0/71 无丢失)——机主授权合并背景 (87338aa530)
- 🐞 Fix:auth.ts 支付宝回包防护补丁自纠——上一枚提交里 info 类型注多套了一层 .response(TS2339 ×2,miniapp tsc 当场红),语义层级回归 parse→.response→{nickName,avatar} 真形 (20c8ba1c13)
- 🐞 Fix:逻辑级 bug 三枚——①充值自定义金额 Number('9.9')*100 浮点毛刺直进支付订单(分语义被打成 990.0000000000002),对齐 CartScreen 既有 Math.round 范式;②credential-storage 裸 JSON.parse:AsyncStorage 半截写/手改/回滚脏数据在启动链抛 SyntaxError 打断记住账号预填,降级为无记录(后续 persistedAccount 覆盖);③miniapp 支付宝 getOpenUserInfo 取消/异常回包 response 非 JSON 时裸 parse 打崩整条登录链,降级空资料走既有手动补路径。定性留档:定时器清理全配对/formatDateByTemplate 带 tz+NaN 守卫/totalFee 经 zod int 非空/支付按钮走 paying 锁+disabled——四类候选核实为健;Clipboard try 豁免=RN API 不抛;CONTEXT 崩溃上报未脱敏一条已漂移(现码过 redactCrashText) (92e31d50fa)
- 🔧 Chore/Other:F9 分批收敛 #4 终版——Agent SDK 票:原 G-06 行插回存续(门 71 编号行不丢)+ 行尾让号注记 + 未取号行承载实际推进(行内交代归属=qoder-maxpar)+ 旧 G-36 双行摘除留痕 + merge-live-doc 归并(lost=0);五门现读全绿(71 无丢失/239 0/211 0/13d F10 2→2/234 warn)——机主授权合并背景 (688b7ce6be)
- 🐞 Fix:backup-pg-local 追到断链根因——pg tooling 已迁 D:\ihui-pg\16(服务镜像为证),脚本写死旧卷 D:\DevEnv\runtimes\pgsql 失踪后,wscript 启动的计划任务看不到 pwsh 的 CommandNotFound ⇒ 本地 dump 静默停摆一个月(P7 只量到副本侧,源侧 P5 格当时未判定)。路径更新 + 新增'pg_dump 不在位必写 backup.log 再退'守卫——停摆必须留下可被人量到的痕迹,任务面 Last Result 0 是谎。实证:修复后手跑 EXIT=0,backup.log 落 10-25 01:16 OK 9.6MB 新行 (de4073ff04)
- 🔧 Chore/Other:F9 分批收敛 #3——取号器行 G-48→G-90(G-48 被远端新纪元 F1不认行占用,重让;PLAN 全文零出现的 G-90 空投)——五门现读全绿(strict F9 撞号 0 组/234 warn/239 0/211 0/13d 0) (73c966154a)
- 🔧 Chore/Other:F9 分批收敛 #2——取号器行 G-48(远端占用,重让)→G-183 链理正 + 侧车按真实 compositeKey 全量重建(5 条;234 warn a1=0 a2=0/211 0/13d F10 0/239 0/plan-gate strict F9 撞号 0 组)——机主授权合并背景 (a056001ebf)
- 🔧 Chore/Other:F9 分批收敛 #1 终——L28868→G-48/L28888→G-50/L29002→G-90/L29063→G-26/G-880 误改恢复/G-183 误改恢复;L29068 回退原号 G-18(远端键位零)+G-18 侧车补;六组侧车按真实 compositeKey 重写(234 warn a1=0 a2=0/13d F10 0/239 归档单调 0/211 号池 0)——机主授权合并背景,逐行留痕 (45254bd876)
- 🐞 Fix:course-planet loadData deps 剔无用 tt(体内未引用,判据面 JSX 层独立吃,exhaustive-deps warning 清零)+ tailwind.config 头注版本事实修正(现读:声明 v3 仅服务 preset 工具链,产物引擎=weapp-tw@5.2.9 vendored v4,alpha 原生生效——漂移注释清);验证:miniapp 端内 eslint 首次 --max-warnings 0 exit 0 (25817edb68)
- 🔧 Chore/Other:F9 分批收敛 #1 终版——本地 5 行键位改号到验证组合(G-48/G-50/G-90/G-26/G-09;G-880 误改恢复;G-183 误改恢复)+ 侧车 6 条按真实 compositeKey 重写(234 a1=0 a2=0/239 归档单调 0/211 号池 0/13d F10 0/plan-gate F9 撞号 0 组,五门现读全绿)——机主授权合并背景,逐行留痕 (12a9581f6a)

**2026-10-24**
- 🔧 Chore/Other:C8 死规则分族棘轮重锚 fractional 0→3 / other 12→6(total 17→14) (85e5c9c3166)
- 🐞 Fix:门 193 的 6 处 execSync 补 stdio + 豁免一条随删除消失的存量 —— 解堵推送链 (225fab254d7)
- 🚀 Feature/Improvement:分叉告警自带「已验证的补救」——把 7.3 小时的现场重判压成一封可粘贴的信 (61a4812fe3a)
- 🔧 Chore/Other:goal-20261024-Q 收尾批2(checkin 取词/edu 测试转绿/handlers 115 精读收口) (1fc16551d86)
- 🚀 Feature/Improvement:历史课程视频(G-921)现网挂载量算仪 check-learn-video-mount.mjs —— 只读尺子,刻意不进提交链 (24430b3a47d)
- 🐞 Fix:批量写诚实性的证据窗收窄到"被审那条写链"(F1/E1b),旧「同体放行」恒绿格钉成必红 (c587f6fbeef)

- 🔧 Chore/Other:goal-b15 轮30 G-73 结清翻勾 —— 多窗格 e2e 真机核验达成(6 passed+1 flaky 如实记,四片主体全覆盖) (d07649d6537)
- 🔧 Chore/Other:结清 D06 结构化代码审查(选择器+事件+卡片+行级揭示) (e4d970ce070)
- 🔧 Chore/Other:四端 ui-routes 自述钉随公告/看板/密钥池页面落地重算,内容行零差 (7382127d478)
- 🔧 Chore/Other:web ui-routes 自述钉再按 HEAD 面重算(checkin/preferences 落地后),内容行零差 (8655bfb6c18)
- 🔧 Chore/Other:goal-20261024-Q 收尾批3 终读(门 105/184 归零、ui-routes 全 matched、终读读数) (2cedeff3541)
- 🔧 Chore/Other:goal-20261024-Q 结账注记(G-26 与第3波覆盖面行保持未勾,余量逐条写明) (4194b5faf07)
- 🔧 Chore/Other:补 check-duplicate-policy-literals 的 render 崩溃回归镜像锁(源已入库、锁悬空两日) (1efd821c7d5)
- 🔧 Chore/Other:结清 3 票(D13 只读并行 / 取消信号 hook 腿 / 窗格续传) (6d3c17ada9d)
- 🔧 Chore/Other:P10 逐条裁决登记 2026-10-24 孤儿删除引用欠账(复验 0 命中,不补发) (b7f3263b94e)
- 🚀 Feature/Improvement:D09 专家意图自动路由腿 — expert_route 规则分类 + llm 接线 + 跨端契约 + 五语言键 (b048e637e54)
- 🔧 Chore/Other:goal-b15 轮41 esc SKIP_SEED 跑法发现登记候补票(采样矩阵零反例:带seed三次3passed/SKIP三次2failed;两方案出路+验收判据齐) (42daa5960d0)
- 🐞 Fix:merge-live-doc 无锚点追加分支逐行去重(README 尾部腐坏的根因) (da3095f0ad0)
- 📚 Docs:协作会话最小纵向切片设计稿落档 + §6「另批」时点回填指针 (56dd64658dd)
- 🔧 Chore/Other:结清 G-85(门100 A6 内容回退维落地) (0b38961892c)
- 🐞 Fix:半径档位表回归 7 处(门77 B1/B3/B9 + 门150 角色档 chip/card/control) (8892284497f)
- 🐞 Fix:B67 esc 跑法更正与 SKIP 警示 —— ①esc spec 头注更正过时跑法(旧版 SKIP+no-deps 已证不可行:③生态入口依赖 API 数据+SKIP 缺 globalSetup 副作用致①③协议弹窗不叠开,采样矩阵带seed三次3passed/SKIP三次2failed零反例),现行跑法=带 seed 全量;②global-setup SKIP 分支加 teardown 清库警示(不改行为);验证 tsc 0 错+水印完整+带 seed 3passed/3passed/2passed(第3轮1例波动如实记) (ef7bf0417ef)
- 🐞 Fix:门100 补 A6 内容回退维 —— 并发提交被合并吞掉时路径仍在、blob 退回共同基底,A1/A2 结构失明(G-85) (700de8ba1f5)
- 🔧 Chore/Other:结清 G-41 与门134 第二格(两处均零改动,判据现读已消) (5c9c0663ebd)
- 🔧 Chore/Other:goal-b15 轮42 B67 结清翻勾 —— 方案②落地(esc 头注跑法更正+global-setup SKIP 警示),现行跑法 esc 主体绿 (d2cd3276763)
- 🔧 Chore/Other:结清工具面板开关窗格化(实现现读在位+单测 16 passed) (ebcbb85f038)
- 🚀 Feature/Improvement:D07 残余② 接入 init_agents_md + 钩子初始化纳入可中断语义 + MCP 工作区根守卫 (78f2e0bbeb7)
- 🔧 Chore/Other:结清 B07(步序四已在,服务端 fork 按产品定档不建)+ G-73 复验注记(④a 归因未判定,不翻勾) (5d507ec93d9)
- 🔧 Chore/Other:临时对齐两处同行冲突以让 union-converge 三方归并(随后回补 local 样式/命名) (c0d46b5ac03)
- 🐞 Fix:4 枚门改走 gitRaw(裸 git 棘轮 64→60) + 取号同题查重 + third-party-roots 非仓库误判根治 (a4f7931af5b)
- 🚀 Feature/Improvement:D09 专家路由设置卡 + reveal 注册表 + review-finding 契约 (d6499fc8849)
- 🚀 Feature/Improvement:停靠浏览器 stop/home/pick 三命令纵向切片 + 五语种键补齐 (a78e4fcdc6d)
- 🐞 Fix:采纳对席圆角收口终版,消除 ScreenStates 双席分歧 —— 解开三方合并死结 (9a8202b5ae9)
- 🐞 Fix:origin 并集落地后回补 local 两处(门77 圆角 rounded-sm + 未用参数 _json) (aeaab5a5681)
- 🐞 Fix:门 150 七族 + 门 77 四处圆角存量清偿(wallboard 收尾 + ScreenStates/carte/account-pool/live 跨端同批) (718f6a413d6)
- 🐞 Fix:停靠浏览器 UI 状态改名规避门 223 规则 F(业务名词 session) (591733d9de7)
- 🐞 Fix:门103 D1+D2 消红 —— 三枚 RN 端内测试不再 import 门体(rank 40→90 反向依赖),迁移门判据断言收编进 scripts/tests T11;顺带修 T1/T3 夹具腐坏(原钉 AboutScreen.tsx,该屏今日 01:39 改薄壳并摘线) 对照实测:recruitment 两枚长按落相册用例在 HEAD 面同红(2 failed 9 passed)非本席引入 (afc8080a411)
- 🔧 Chore/Other:结清 G-84(裸 git 棘轮 60=基线) (bb80c4a27e0)
- 🐞 Fix:G-322 旗标单源收口 + 运维脚本空值静默回落堵死 (b73ed821234)
- 🐞 Fix:三处写死 git 落点改走 §5b 唯一出口(gitdir.resolveGitBin) + sync-tags 补 path/url import + 端内 dispatch 登记 onReviewFinding 缺席理由(web baseline 38→39) (9272aeb4c9a)
- 📚 Docs:清掉「读数不得断行」点名行的旧版重复副本(并发写回叠入,旧版带已腐烂的例数,§0.1 数字现读) (d74139d8d07)
- 🐞 Fix:check-mass-deletion 去裸 git 兜底 —— 型 B 棘轮 3→4 回归 (384c797851c)
- 🐞 Fix:门103 C1 行数天花板收口 —— git-guardian/check-batch-write 大块注释逐字归档换指针(零行为变化) (318240af9bb)
- 🔧 Chore/Other:重生成 web/miniapp ui-routes —— 清两枚 stale 自述钉(check:all 第 13 步红因) (c532c7bd028)

- 📚 Docs:删除「一格一读数」短版重复行(origin 长版为同条上位表述) (a7a78ce6229)
- 🚀 Feature/Improvement:CodeEditor 暴露 revealAt 句柄(行内跳转) + 审查发现卡 P1/P2/Nit 分组 (c9bdea170c5)
- 🔧 Chore/Other:长按二维码存相册两枚用例改「只等链终点一次 + 8s 预算」—— 机制实测:同步占死事件循环 1200ms ⇒ fireEvent 到首跳 1201ms > waitFor 默认 1000ms(空闲档同链 3ms),三段串行等待在并发跑 200+ 道守门的同机上必被打成假红;断言不减(requestPermissions/saveToLibrary 仍在,反向牙实测打断写库步照样翻红),连跑 10 次全绿 (e4989cbb9e8)
- 🐞 Fix:摘掉 check-rn-readout-cell 的未用 import(改走取材层后 readFileSync 已无调用点) (3dccfd167ca)
- 🚀 Feature/Improvement:端侧「等分读数格」判据落地 + 23 处存量收口(门 241) (8ec3cfa172f)
- 🐞 Fix:门 150 弱证据 6 处代裁归位 + scroll-jump-spec 未判定清偿(§24 代裁,依据随附) (482cf8fe9c4)
- 📚 Docs:点名端侧读数格守门 241 —— §13.4 的两条判据与唯一写法 (a510448d379)
- 🚀 Feature/Improvement:/review 斜杠只读 diff + review-finding 帧注册 + 聊天 store 审查发现索引 + MessageItem 呈现 (12d98b1d88b)
- ♻️ Refactor:门134 词法层拆出 scripts/lib/batch-write-lexer.mjs(门103 C1 6117⇒5658 行)—— 459 行逐字搬运零改写:台面与 HEAD 版同跑对账 94 行输出 diff 空、--self-test 174 条全过、镜像 30/30 与 9/9 全绿;M13 形状锁的取材面同批扩成 门体∪词法层(只数门体会把"已搬到别处"读成"没有第二份"=把没判写成判过) (0ce9314545c)
- ♻️ Refactor:27 份文件内 react-native mock 收归全局替身 —— 根治项落地(45 例红事故的复发通道封口) (8c2585ffe55)
- 🐞 Fix:fractional 死规则根治 —— 1.5 档类串换等值 rpx 任意值(样式静默失效的真 bug) (51faca27a46)

- 🔧 Chore/Other:C8 死规则锚点下调 fractional 3→0 / total 14→11 —— fractional 族根治后重锚 (f09d1cbeb19)

- 🔧 Chore/Other:结清 16 票(A 档零改动;承载命令/测试已复跑) (058dd42d258)
- ♻️ Refactor:门 8 方法推导判据抽到 lib 单源 —— 补齐悬空 import 并钉 T7-T10 (88a9e46d799)
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
