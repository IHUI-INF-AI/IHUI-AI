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

Headline claims (same source as the table below, all live-computed): **606 tables · 4557 API routes ·
25 WebSocket endpoints · 101 catalogued LLMs · 38 platforms auto-publishing · 3191 test files ·
273 engineering gates · 50 CI workflows · 5-language i18n parity · 9 app packages · 16 shared packages ·
14 compose services**.

<!-- BEGIN GENERATED NUMBERS (node scripts/gen-doc-numbers.mjs --markdown) -->
| 指标 | 现值 | 取数键 |
| ---- | ---- | ------ |
| 数据库表 | 606 | `dbTables` |
| schema 文件 | 234 | `dbSchemaFiles` |
| API 路由 | 4557 | `apiRoutes` |
| 路由文件 | 622 | `apiRouteFiles` |
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
| 测试文件 | 3191 | `testFiles` |
| CI 工作流 | 50 | `ciWorkflows` |
| Compose 服务 | 14 | `composeServices` |
| 工程守门 | 276 | `guardianGates` |
| — blocking | 253 | `guardianBlocking` |
| — warn | 26 | `guardianWarn` |
| 跟踪文件 | 16058 | `trackedFiles` |

上表由 `node scripts/gen-doc-numbers.mjs --markdown` 生成,最后核对日期 2026-10-24。
每个数的来源就写在取数键旁边的实现里(`scripts/gen-doc-numbers.mjs` 的 `SOURCES`),**不得手抄、不得另立第二份**。

> ⚠️ 未判定 1 项:`aiServiceRoutes`(apps/ai-service/app 有 1 个 .py 取不到内容)

<!-- END GENERATED NUMBERS -->


## Recent updates (auto-maintained)

<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->
**2026-10-24**
- 🔧 Chore/Other:C8 死规则锚点下调 fractional 3→0 / total 14→11 —— fractional 族根治后重锚 (f09d1cbeb19)

**2026-10-24**
- 🐞 Fix:fractional 死规则根治 —— 1.5 档类串换等值 rpx 任意值(样式静默失效的真 bug) (51faca27a46)

**2026-10-24**
- ♻️ Refactor:27 份文件内 react-native mock 收归全局替身 —— 根治项落地(45 例红事故的复发通道封口) (8c2585ffe55)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (eec8e44473b)
- 🐞 Fix:摘掉 check-rn-readout-cell 的未用 import(改走取材层后 readFileSync 已无调用点) (3dccfd167ca)
- 🚀 Feature/Improvement:端侧「等分读数格」判据落地 + 23 处存量收口(门 241) (8ec3cfa172f)
- 🐞 Fix:门 150 弱证据 6 处代裁归位 + scroll-jump-spec 未判定清偿(§24 代裁,依据随附) (482cf8fe9c4)
- 📚 Docs:点名端侧读数格守门 241 —— §13.4 的两条判据与唯一写法 (a510448d379)
- 🚀 Feature/Improvement:/review 斜杠只读 diff + review-finding 帧注册 + 聊天 store 审查发现索引 + MessageItem 呈现 (12d98b1d88b)
- ♻️ Refactor:门134 词法层拆出 scripts/lib/batch-write-lexer.mjs(门103 C1 6117⇒5658 行)—— 459 行逐字搬运零改写:台面与 HEAD 版同跑对账 94 行输出 diff 空、--self-test 174 条全过、镜像 30/30 与 9/9 全绿;M13 形状锁的取材面同批扩成 门体∪词法层(只数门体会把"已搬到别处"读成"没有第二份"=把没判写成判过) (0ce9314545c)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6511981014b)
- 📚 Docs:删除「一格一读数」短版重复行(origin 长版为同条上位表述) (a7a78ce6229)
- 🚀 Feature/Improvement:CodeEditor 暴露 revealAt 句柄(行内跳转) + 审查发现卡 P1/P2/Nit 分组 (c9bdea170c5)
- 🔧 Chore/Other:长按二维码存相册两枚用例改「只等链终点一次 + 8s 预算」—— 机制实测:同步占死事件循环 1200ms ⇒ fireEvent 到首跳 1201ms > waitFor 默认 1000ms(空闲档同链 3ms),三段串行等待在并发跑 200+ 道守门的同机上必被打成假红;断言不减(requestPermissions/saveToLibrary 仍在,反向牙实测打断写库步照样翻红),连跑 10 次全绿 (e4989cbb9e8)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (81f924cd857)

**2026-10-24**
- 🔧 Chore/Other:重生成 web/miniapp ui-routes —— 清两枚 stale 自述钉(check:all 第 13 步红因) (c532c7bd028)

**2026-10-24**
- 🐞 Fix:门103 C1 行数天花板收口 —— git-guardian/check-batch-write 大块注释逐字归档换指针(零行为变化) (318240af9bb)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (dd0d3f1dcaa)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5a83a417d9c)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b48d16a5759)
- 📚 Docs:清掉「读数不得断行」点名行的旧版重复副本(并发写回叠入,旧版带已腐烂的例数,§0.1 数字现读) (d74139d8d07)
- 🐞 Fix:check-mass-deletion 去裸 git 兜底 —— 型 B 棘轮 3→4 回归 (384c797851c)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c377952bcdd)
- 🔧 Chore/Other:结清 G-84(裸 git 棘轮 60=基线) (bb80c4a27e0)
- 🐞 Fix:G-322 旗标单源收口 + 运维脚本空值静默回落堵死 (b73ed821234)
- 🐞 Fix:三处写死 git 落点改走 §5b 唯一出口(gitdir.resolveGitBin) + sync-tags 补 path/url import + 端内 dispatch 登记 onReviewFinding 缺席理由(web baseline 38→39) (9272aeb4c9a)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1b1648fe62d)
- 🐞 Fix:采纳对席圆角收口终版,消除 ScreenStates 双席分歧 —— 解开三方合并死结 (9a8202b5ae9)
- 🐞 Fix:origin 并集落地后回补 local 两处(门77 圆角 rounded-sm + 未用参数 _json) (aeaab5a5681)
- 🐞 Fix:门 150 七族 + 门 77 四处圆角存量清偿(wallboard 收尾 + ScreenStates/carte/account-pool/live 跨端同批) (718f6a413d6)
- 🐞 Fix:停靠浏览器 UI 状态改名规避门 223 规则 F(业务名词 session) (591733d9de7)
- 🐞 Fix:门103 D1+D2 消红 —— 三枚 RN 端内测试不再 import 门体(rank 40→90 反向依赖),迁移门判据断言收编进 scripts/tests T11;顺带修 T1/T3 夹具腐坏(原钉 AboutScreen.tsx,该屏今日 01:39 改薄壳并摘线) 对照实测:recruitment 两枚长按落相册用例在 HEAD 面同红(2 failed 9 passed)非本席引入 (afc8080a411)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (86f0588597d)
- 🚀 Feature/Improvement:D09 专家路由设置卡 + reveal 注册表 + review-finding 契约 (d6499fc8849)
- 🚀 Feature/Improvement:停靠浏览器 stop/home/pick 三命令纵向切片 + 五语种键补齐 (a78e4fcdc6d)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (81a851ac233)
- 🔧 Chore/Other:临时对齐两处同行冲突以让 union-converge 三方归并(随后回补 local 样式/命名) (c0d46b5ac03)
- 🐞 Fix:4 枚门改走 gitRaw(裸 git 棘轮 64→60) + 取号同题查重 + third-party-roots 非仓库误判根治 (a4f7931af5b)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (095537b1e58)
- 🚀 Feature/Improvement:D07 残余② 接入 init_agents_md + 钩子初始化纳入可中断语义 + MCP 工作区根守卫 (78f2e0bbeb7)
- 🔧 Chore/Other:结清 B07(步序四已在,服务端 fork 按产品定档不建)+ G-73 复验注记(④a 归因未判定,不翻勾) (5d507ec93d9)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d805b31cdae)
- 🔧 Chore/Other:结清工具面板开关窗格化(实现现读在位+单测 16 passed) (ebcbb85f038)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (63898cbb055)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7e66f217e14)
- 🔧 Chore/Other:goal-b15 轮42 B67 结清翻勾 —— 方案②落地(esc 头注跑法更正+global-setup SKIP 警示),现行跑法 esc 主体绿 (d2cd3276763)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a64e1d82386)
- 🔧 Chore/Other:结清 G-41 与门134 第二格(两处均零改动,判据现读已消) (5c9c0663ebd)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3005e32c336)
- 🔧 Chore/Other:结清 G-85(门100 A6 内容回退维落地) (0b38961892c)
- 🐞 Fix:半径档位表回归 7 处(门77 B1/B3/B9 + 门150 角色档 chip/card/control) (8892284497f)
- 🐞 Fix:B67 esc 跑法更正与 SKIP 警示 —— ①esc spec 头注更正过时跑法(旧版 SKIP+no-deps 已证不可行:③生态入口依赖 API 数据+SKIP 缺 globalSetup 副作用致①③协议弹窗不叠开,采样矩阵带seed三次3passed/SKIP三次2failed零反例),现行跑法=带 seed 全量;②global-setup SKIP 分支加 teardown 清库警示(不改行为);验证 tsc 0 错+水印完整+带 seed 3passed/3passed/2passed(第3轮1例波动如实记) (ef7bf0417ef)
- 🐞 Fix:门100 补 A6 内容回退维 —— 并发提交被合并吞掉时路径仍在、blob 退回共同基底,A1/A2 结构失明(G-85) (700de8ba1f5)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (30aa5bb3790)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (0c7f94d374d)
- 🔧 Chore/Other:goal-b15 轮41 esc SKIP_SEED 跑法发现登记候补票(采样矩阵零反例:带seed三次3passed/SKIP三次2failed;两方案出路+验收判据齐) (42daa5960d0)
- 🐞 Fix:merge-live-doc 无锚点追加分支逐行去重(README 尾部腐坏的根因) (da3095f0ad0)
- 📚 Docs:协作会话最小纵向切片设计稿落档 + §6「另批」时点回填指针 (56dd64658dd)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (af70399256b)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b70f553e967)
- 🔧 Chore/Other:结清 3 票(D13 只读并行 / 取消信号 hook 腿 / 窗格续传) (6d3c17ada9d)
- 🔧 Chore/Other:P10 逐条裁决登记 2026-10-24 孤儿删除引用欠账(复验 0 命中,不补发) (b7f3263b94e)
- 🚀 Feature/Improvement:D09 专家意图自动路由腿 — expert_route 规则分类 + llm 接线 + 跨端契约 + 五语言键 (b048e637e54)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5bf2a99586f)
- 🔧 Chore/Other:goal-20261024-Q 结账注记(G-26 与第3波覆盖面行保持未勾,余量逐条写明) (4194b5faf07)
- 🔧 Chore/Other:补 check-duplicate-policy-literals 的 render 崩溃回归镜像锁(源已入库、锁悬空两日) (1efd821c7d5)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c17625fb208)
- 🔧 Chore/Other:goal-20261024-Q 收尾批3 终读(门 105/184 归零、ui-routes 全 matched、终读读数) (2cedeff3541)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6158849f52e)
- 🔧 Chore/Other:web ui-routes 自述钉再按 HEAD 面重算(checkin/preferences 落地后),内容行零差 (8655bfb6c18)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (013cc1e82a0)
- 🔧 Chore/Other:结清 D06 结构化代码审查(选择器+事件+卡片+行级揭示) (e4d970ce070)
- 🔧 Chore/Other:四端 ui-routes 自述钉随公告/看板/密钥池页面落地重算,内容行零差 (7382127d478)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (0d73c8bf3eb)
- 🔧 Chore/Other:goal-b15 轮30 G-73 结清翻勾 —— 多窗格 e2e 真机核验达成(6 passed+1 flaky 如实记,四片主体全覆盖) (d07649d6537)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4cbf4faf66c)
- 🔧 Chore/Other:goal-20261024-Q 收尾批2(checkin 取词/edu 测试转绿/handlers 115 精读收口) (1fc16551d86)
- 🚀 Feature/Improvement:历史课程视频(G-921)现网挂载量算仪 check-learn-video-mount.mjs —— 只读尺子,刻意不进提交链 (24430b3a47d)
- 🐞 Fix:批量写诚实性的证据窗收窄到"被审那条写链"(F1/E1b),旧「同体放行」恒绿格钉成必红 (c587f6fbeef)

**2026-10-24**
- 🔧 Chore/Other:C8 死规则分族棘轮重锚 fractional 0→3 / other 12→6(total 17→14) (85e5c9c3166)
- 🐞 Fix:门 193 的 6 处 execSync 补 stdio + 豁免一条随删除消失的存量 —— 解堵推送链 (225fab254d7)
- 🚀 Feature/Improvement:分叉告警自带「已验证的补救」——把 7.3 小时的现场重判压成一封可粘贴的信 (61a4812fe3a)

**2026-10-24**
- 📚 Docs:全局 mock 替身加迁移指引 —— 禁止新测试再写覆盖式文件内 react-native mock (edc5bc43555)
- 🐞 Fix:media-tasks 手机档 5 列切断读数,并把 76 处存量的最坏格宽算清、登记断点陷阱 (44ba5d64476)

**2026-10-24**
- 🐞 Fix:清偿 RN 端剩余测试红至全量 1185/0 —— 全局 mock 替身补键两处 + 真回归复挂 VoiceNote + 路由档补录 + 契约随形态 (978a132bbdf)
- 🐞 Fix:长标签收进悬停口径,读数格标签不再折行 (bfd6ce46a49)
- 🔧 Chore/Other:按代码面重算 openapi.json,清掉 CI 的 ARTIFACT_DRIFT (d4d1065aab8)

**2026-10-24**
- 🐞 Fix:清偿 web 全量测试面 32 例真红(8 族根因,6739 用例全绿终验在跑) (d0ccb867450)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (92cda2bce94)
- 🐞 Fix:/api/internal/* 网络分域显式声明(根治 G-815989 判据在 CI 的红) (e65f374d8a9)
- 🐞 Fix:清掉 ruff 全量红(15→0),按 §5c clean→改→inject 保水印载荷 (a43d6eaec99)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (85bd4df8b50)
- 🐞 Fix:drop unnecessary 'tt' dep in course-planet loadData useCallback (CI lint:strict warning->red) (b560edce07d)
- 🐞 Fix:读数不得替「没量到」下结论 + 时间按数据侧时区 + 页头扫描线的横向溢出 (dab47611c97)
- 🚀 Feature/Improvement:大屏读数尺补五语言档,并把覆盖边界现读进文档(别把「已装门」当「已覆盖」) (0a6da8a0c1b)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b80203fb3e1)
- 🔧 Chore/Other:goal-b15 轮29 三行取证补录 —— S1/S2 e2e 真跑 3 passed(PG18 恢复后)+G-02 真登录态 200 取证(subagents/all 形状同票面期望) (5cdd3f80244)
- 🚀 Feature/Improvement:落地「停靠浏览器 + Trae 网页登录」自洽单元(build.rs 命令表补齐 10 条) (a7b3500f73e)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (88185c202b9)
- 🐞 Fix:旁路落地器接「落地后复跑受影响判据」(G-113) —— lib/land-gate-rerun.mjs 与两台落地器同批入库 (afe67708b50)
- 🚀 Feature/Improvement:D11 语音打断腿 — /voice/tts/stream 逐段 NDJSON + voice_barge_in 打断判据 + 22 例测试 (31690b4cb74)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6b5b56ceb24)
- 🐞 Fix:relay 号池「上游明确拒收」三处断链补实 + 产出面键集契约回退 (99db9d24126)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (488d3ed3724)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b9bb78319fb)
- 🔧 Chore/Other:goal-b15 轮20 G-81 结清翻勾 —— 病面已由 G-876 席修复(code zod 必填+verifyCode 统一入口,枚 9e103ac0f6),auth 1311 全绿复验 (384058380d8)
- 🐞 Fix:门 71 抹号/折算位数上限 4→6(止血换号被自愈回插)+ D42046 归位 D-07 (c8d64eb3f27)

**2026-10-24**
- 🔧 Chore/Other:删除存活清单登记 6 枚清偿归档件 —— 对侧 plan 清偿工作的正当产出面 (760811fa380)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1094e57f254)
- 🔧 Chore/Other:goal-b15 轮18 G-05 伞票翻勾 —— 真剩 0 点(全迁讫/豁免/在飞归其线),两轮勘正证据在前两注记 (e5c1fb6ffe5)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (69b5177b03c)
- 🔧 Chore/Other:goal-b15 轮18 G-05 二次勘正 —— archive:684 实为镜像注入点设计豁免(注释明记刻意不走 gitRaw),伞票真剩 0 点可翻勾 (460870ed01a)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (25947957510)
- 🔧 Chore/Other:goal-b15 轮18 G-05 伞票侦察勘正 —— 名单实况:wire-strictness 已迁净/两枚剩注释/archive 真剩 1 点(:684 rev-parse),真剩量=1 枚 1 点 (de2ec569bb7)
- 🐞 Fix:清除最后两处不合规声明号 —— G-27 同号异题拆号 + D42046 超池归位 (d9b060d47b0)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (31e25f5d46b)
- 🔧 Chore/Other:test+fix(gates): D/E 簇收口 —— 生产签出外来工作多通道发现 + 提交链三门成套 (b7ae8b5f9c3)
- 🔧 Chore/Other:goal-b15 轮17 裸对象语义验证半结清 —— 信封层:814 整条 body 作 data;实测 health 回对象非数组,web 按数组读分叉实锤;主格对外契约维持等机主定档 (bdbb697d25d)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (48c7e2ebffc)
- 🔧 Chore/Other:结清 D09 意图自动路由(后端三格+设置项+i18n 漂移归零) (1b0545b8087)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (ed597393295)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4c159340f5f)
- 📚 Docs:G-17 本侧行改写为与 origin 逐字同一(取超集那份,独有票号集为空零丢失) —— 清掉 union 归并放大的同题两版,解 origin 分叉收敛的唯一卡点 (524492f05a4)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8b0efe63dfd)
- 🔧 Chore/Other:goal-b15 轮15 G-02 服务面取证注记 —— 三枚路由存在性实证(401/403 非 404,枚 2704c4d27 旁证),剩真机+真登录态两半阻塞 (c0afe3fbb62)
- 🐞 Fix:取号器撞号镜像跟随两位数池 —— 自有段改 G-90~G-99,号域 92/93/94 (643cb24607b)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (ae257603ca5)
- 🔧 Chore/Other:goal-b15 轮13 发丝线票实测注记 —— 最后1枚(RN面)按配方改写实测两尺互顶(hairline 0 但 no-divider 族6 新增红),已回退归两尺合一前置 (d9d660cd034)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b3f44518f62)
- 🔧 Chore/Other:goal-b15 轮12 发丝线票进展注记 —— 类面存量 31→1(97% 清偿),剩 1 枚+RN 12 枚(判据前置归门 11d 线) (9648a28f188)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (92dcc9ae069)
- 🔧 Chore/Other:结清 G-09 + 记进展(D06/D09/连续语音) (2e9da27db61)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (9b0c51ac1a6)
- 🔧 Chore/Other:goal-b15 轮12 G-98 结清翻勾 —— 三盲区判据均已实现(族6 RN对象/族5 css块+SCAN_GLOBS/任意值分流),self-test 62/62+镜像 29/29 (a4bf8f4d9d9)
- 🔧 Chore/Other:web ui-routes 输入钉全量按 HEAD blob 重算(含 settings/preferences),内容行零差 (7f79d643697)
- 🐞 Fix:编号收口最后两枚超池号 + 门 71 抹号表补齐 H/I 族(止血"改名被判丢 → 旧号回捞"的重复副本) (f040d776c97)
- 🐞 Fix:批量档判定归位 lib 单源 + 隐藏启动包装器改为等待子进程(根治 54 枚常驻的第二半) (3c75fceac5f)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2d4cd563392)
- 🔧 Chore/Other:goal-b15 轮11 钩子取消腿结清翻勾 —— 票面判据达成:toolCtx 在 HEAD 三处全换+取消证明 4/4+tsc 0 (cfae8d75b61)
- 🔧 Chore/Other:relay 导入 mock 收形为单点返回 (2d4a7389463)
- 🐞 Fix:修复两处镜像测试回归 —— 单源锁断言跟随 declaredKeyOf;A4 真实形态夹具改用生产件 (f79c2700d66)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (165a0e5db64)
- 🔧 Chore/Other:goal-b15 轮10 G-865 结清翻勾+勘正 —— 摘键早已完成(键不在/真实使用 0/命中全为历史注记),轮 9『4 处生产消费』注记系 grep 误判一并勘正撤回 (db3e31f1276)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a0de770a095)
- 🔧 Chore/Other:goal-b15 轮9 G-865 前提已变注记(不翻勾) —— 现读 4 处生产消费方,摘键前提不成立;迁 initials 需另立票连带 4 消费点+2 测试 (9e6a3784e45)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7cacd399613)
- 🔧 Chore/Other:goal-b15 轮9 三行齐翻 —— G-95 二翻(带回后复翻)/真机走查孪生齐翻/tmpdir 复验 clean RC=0 结清(摘牌回单残留) (b35fe9057d0)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (0d1f26bad03)
- 🔧 Chore/Other:goal-b15 轮9 G-93 结清翻勾 —— 高置信死候选族已被清偿(门全绿+点名族 dump 零命中),参数段未判定为设计形态非债,未写基线未塞白名单 (eb0aa674627)
- 🐞 Fix:嵌套 ref 存续层改走批量快照 —— 逐条 rev-parse 把守护堆成 54 枚常驻 (4dd635da6f8)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b3f335ec303)
- 🔧 Chore/Other:web ui-routes 自述钉再按 HEAD 面重算(wallboard 页已落地变更),内容行零差 (378bbb69530)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6dde87431a9)
- 🔧 Chore/Other:goal-b15 轮8 G-94 结清翻勾 —— 探活靶已改 www 真腿(旧靶留名防洗),self-test 76/76 RC=0 (dba7da727ff)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a3e8582d50e)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (9100369ad60)
- 🔧 Chore/Other:goal-b15 轮7 G-95 结清翻勾 —— G-963 席已修(闭包两型+递归不动点),f9 复跑 10/0 全绿 (8c9f59a6a7b)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c8df54169c3)
- 🔧 Chore/Other:goal-20261024-Q 收尾批注记(门128红臂收口/门105产物钉/门98孤儿/i18n离线包/mobile-rn 编译断点) (356cc2e269e)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (799242f059e)
- 🔧 Chore/Other:结清「锁初始化写全再原子可见」留挂的 deploy-lock flaky 归因格 —— 实现/接线/入树三件早已达成(scripts/lib/lock-atomic-init.mjs 在 HEAD,git-lock.mjs:1017 与 deploy-lock.mjs:1024 接线,镜像 15/15);该格当年(10-21 复量)本机未复现而不肯判结,今连跑三轮 node scripts/deploy-lock.mjs --self-test = 自检 143 条 pass 143 / fail 0 ×3(较当年 95 条规模已扩且无漂),按 §1 待拍板条目由 agent 代裁结清;票面路径 packages/services/... 系上游研究副本非本仓文件 (f4c42d8281b)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (028e03fabba)
- 🔧 Chore/Other:goal-b15 轮7 G-78 结清翻勾 —— DRIVEROOT 同族残留已清(注释收口+硬编码零命中+宽 grep 零残留+测试 0 fail) (fdfa25b86ad)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (54c3de6903b)
- 🔧 Chore/Other:goal-b15 轮7 G-97 结清翻勾 —— 原生弹窗已清偿(门两面存量 0/RC=0,grep 零命中),45 处由他席清完 (e1a6f90e613)
- 🐞 Fix:修 i18n 扫尾引入的 4 处编译断点(t 未注入/映射函数缺参/误插 appAlert 按钮/res 未定义),双包 typecheck 归零 (ff5d0aec431)
- 🐞 Fix:编号形态再收口 —— 只改重号与超池号(合规唯一号一个不动)+ 映射多跳合成 (de8b7748775)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (83fb6c8d37c)
- 🔧 Chore/Other:goal-b15 轮6 G-89 补翻 —— isError 语义已在 HEAD(g-692 专项全绿,mcp 族 270/270) (6a73359c174)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1e162a7f917)
- 🔧 Chore/Other:goal-b15 轮6 五票结清翻勾 —— G-87 stderr 监听(S17 取证:实现早已入库+正式结清过,MCP 族 270/270 复验)+G-88/89/90 MCP 三连票(实现全在 HEAD 专项测试本轮全绿)+G-92 四门 isDirectRun 守卫(已治理:点名门双真+门 193 两面 RC=0) (635f2cfc96b)
- 🔧 Chore/Other:补 revokeCollaborator 终态守卫直接测(G1-G4 四例) (15e75cfc11c)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (461dc0045f9)
- 🔧 Chore/Other:goal-b15 轮6 G-83 结清翻勾 —— 代码侧全绿收口(摘假图标+如实提示+接收腿 14 例+全量 1000/1000),剩余四项结构性人工窗(后台白名单/CSP 决策/真机时机)以注记交代 (84e0e39cddd)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a511a294315)
- 🔧 Chore/Other:goal-b15 轮6 G-82 结清翻勾 —— Passkey 前端全链已装车(依赖+组件动态 import+web 两端点消费),测试 12/12 绿+tsc 0 错;§9 小程序平台豁免随注记 (af81e257cbc)
- 🐞 Fix:编号形态再收口 —— 只改重号与超池号(合规唯一号一个不动)+ 映射多跳合成 (7fbab3acb27)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5008ce95cda)
- 🔧 Chore/Other:goal-b15 轮5 G-80 结清翻勾 —— qoder-时间序席 10-23 四条凭据完备(死键撤净+判据锁 4 例绿+动态候选分类+阳性对照),漏翻补翻 (28066980993)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1f764234f31)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d31afcdd3ea)
- 🔧 Chore/Other:goal-b15 轮5 G-86 结清翻勾 —— 正解①已落地(G-807:写侧显式置过期+判定不吃 mtime),本轮补票面验收 10 连跑 pass=10 fail=0 (e9b299ef92b)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (05d93223ee3)
- 🔧 Chore/Other:goal-b15 轮5 G-46 结清翻勾 —— 三批全收口(批1 381行/批2 证伪留原地+F5退役/批3 491行+幂等0),sha 链与工具全在库,收口漏翻补翻 (de2c8ee99a3)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (e008db090f6)
- 🔧 Chore/Other:goal-b15 轮5 O03 二翻 —— 已裁决回捞残留(66f91ad2a1 批内撤销取向=维持告警+降档,凭据链完整),守门 71 回捞带回未勾形态,复验后二翻 (5645c20065a)
- 🐞 Fix:全族按文档顺序收口两位号 —— G 族 104 条压回 G-01..G-99 + 溢出族 H01..H05,D 族三条超池号归位 (6fb923cbe18)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5a05a498410)
- 🔧 Chore/Other:goal-b15 轮4 G-41 结清翻勾 —— 生产接线落地(runAgent 订阅事件流+形状锁 3 例+32 臂全绿),四态终态+真打断全线闭环 (716cba159de)
- 🔧 Chore/Other:ui-routes 自述钉按 HEAD 面重生成(web wallboard / 小程序 ScreenStates),内容行零差 (f3902194d2d)
- 🐞 Fix:门 98 悬空具名导入清零 —— 删孤儿测试 __tests__/organization.test.ts(其被测模块 routes/organization.ts 在 HEAD 已不存在,全仓仅此文件引用 organizationRoutes;工作树已删除、此处落地固化),避免测试收集阶段解析失败 (686d9650c28)
- 🐞 Fix:A2 占位改指真锚点 —— AGENTS_compact-2026-10-21.md 从未入库,改指 AGENTS_trim-2026-10-21.md (c2f584a7bef)
- 🚀 Feature/Improvement:G-41 钩子事件流生产接线 —— runAgent 订阅 onHookRunEvent(实现层 d4f8ba336b 事件面的首个生产消费者),terminal 事件落终端结构化行(json 模式静默),finally 在 runSessionEndHooks 之后退订;§30 生产侧终态出口自此可填;形状锁 g41-hook-run-events-wired.test.ts 3 例防静默摘线;验证 tsc 0 错+g-424 9/9+形状锁 3/3 (ecf6e73678f)
- 📚 Docs:补回 7 份归档件 —— 归档门 A1/A2/A3 落空清零 (090eb4f8406)
- 🐞 Fix:README 数字同源对账 —— 生成块换成 HEAD 面现算段(trackedFiles 15939→16000、testFiles 3163→3179、guardianGates 273→274、guardianBlocking 250→251、apiRoutes 4562→4556、apiRouteFiles 624→623),末尾 6 行散抄同步改正;守门 173 复绿 (0c072b523e1)
- 📚 Docs:补回 6 份归档件 + 快照锚点改写 —— 归档门 A1/A2/A3 落空清零 (7e888a5fe96)
- 🐞 Fix:README 三处指向已删镜像仓的死链清掉 —— §5b 弃用镜像后 Gitee 仓库根链接与 GitCode 死仓 URL 都是死的,改为一行「2026-10-23 已弃用并整仓删除,只保留 GitHub 一处源」;守门 238 不入射程 (3c0fa1ee34f)

**2026-10-24**
- 🐞 Fix:清偿测试面 31 例真红 —— 共享层 ScreenStates 动画族打盲 RN mock + 登录门没 mock + 回潮副本 (86b577c1e3a)
- 🐞 Fix:端侧读数格同锁「整格换行不切数字」—— Income/Usage/Dashboard 三处共享源 (76cbb78d28d)
- 🐞 Fix:补齐大屏状态词五语言 + 读数列宽档按实测下限收紧 (fa2615ca274)
- 🔧 Chore/Other:web ui-routes 产物按 HEAD 面重生成(旁路落地不跑写回钩子的必然残差) (df63e36ac5f)
- 🐞 Fix:ScreenStates.taro.css 的水印改回 CSS 合法注释形(解门 95 活恒红) (f6a1b7e646d)
- 🚀 Feature/Improvement:门 240 R8 把「大字号读数必须 nowrap」推广到 web 全仓 —— 差值棘轮不造恒红门 (aec90201d40)
- 🐞 Fix:大屏读数不断行收口全 49 格 —— 补掉上一枚只修号池留下的自伤 (463dbd44e4d)
- 🔧 Chore/Other:号池换 Key 补 handler 端到端锁(密文可解回新值 + 健康态同批复位) (dc481b7d6f0)
- 🔧 Chore/Other:四端 ui-routes 产物按 HEAD 面重生成,收口门 105 的 G5 陈旧钉 (cf618b89bf3)
- 🚀 Feature/Improvement:号池 PUT 支持换 Key 并复位健康态,admin 页补「替换 Key」入口 (b40c09c125b)

**2026-10-24**
- 🐞 Fix:MCP_WORKSPACE_ROOTS 空值回落 cwd —— 根治 patch_root 全量序 503 污染(生产配空值同病) (cdb68fbb360)
- 🚀 Feature/Improvement:大屏读数不得断行 —— 号池面板「6天19小时」被切成两半的三层成因根治 (94234605561)

**2026-10-24**
- 🐞 Fix:大屏中文界面收口英文产品词(数据源/页脚/告警/数据层/号池/KPI) (5e212c0fbd5)

**2026-10-24**
- 🐞 Fix:清偿测试面 40 例真红(4 族根因)+ 摘除 sweep 产出面无消费对象键 (be797ebccef)
- 🚀 Feature/Improvement:公告全端统一+按端定向;首页能力文案对齐 9 端实测 (db47d154c04)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5d04402908b)
- 🐞 Fix:大屏第八轮补正 —— 上一枚 f96d979 误取自动收编换主前的旧页面 blob (a5cffb137b7)
- 🚀 Feature/Improvement:大屏第八轮(无障碍补强/窄档页头/对比度/缩放触发面) (f96d9798446)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (e60115643c5)
- 🔧 Chore/Other:goal-b15 轮4 WP-01 结清翻勾 —— 浏览器语义快照已入库(f2121db10b 主力+句柄族 b8eab3c8b0),测试 8/8 绿;归档注记 sha 引用勘正(9f404d0 是收尾枚) (dda5f2e549c)
- 📚 Docs:守门 207 体积清偿第二轮 —— 删 4 行同题重复副本(「git 网络与推送」原有 3 份只留最新最全一份 / 只读尺子旧版被新版全覆盖 / 常驻工具清单为已归档件回插),98,838B→95,226B(预算 96,000);逐字留档 AGENTS_trim-2026-10-24.md 附录 2 (ced824b7f7e)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (cead297f1a9)
- 🔧 Chore/Other:goal-b15 轮3 B05 结清翻勾 —— 流式中切模型三腿全装车(web 18+miniapp 17+RN 16 例全绿,本轮现读) (570a5e86495)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (94a129fe2f7)
- 🔧 Chore/Other:goal-b15 轮3 孪生/僵尸齐翻(HEAD 面锚点) —— Esc 漏网份/号池凭证副本/O-1 副本/G-77 复活份 (c38212cf27b)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2cc52dfaeb7)
- 🔧 Chore/Other:goal-b15 轮3 B02 进展注记(不翻勾) —— §7 现状精确化:房间协议+web 端接线已交付;真剩余=resync(rev 持久化前置,ws-broadcast rev 现为进程内存)/terminal 帧/meta 位/帧名收敛;跨端接线依赖 B06 (7ce9d46afb3)
- 🔧 Chore/Other:结清 4 票(图片标注/失败广播/D07/残行尺),二次落盘(防复活) (a715c1d7a4c)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (af71ca7caee)
- 🔧 Chore/Other:结清 2 票(tmpdir 七脚本 / allow-dangerous 单出口) (4372937c1d9)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (69e05903c79)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a1e5b737f78)
- 🔧 Chore/Other:goal-b15 轮2 两票结清翻勾 —— ①合流吞修复票:建议补法已装车(converge:252 verifyUnion+lostAddedLines 行级断言,立因即本票) ②B03 消息级版本切换:票59三切片已完整装车(S12b 席取证,24+5+8 测试绿,tsc 0 错) (cde899e7a81)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3b6a52e4d8e)
- 🔧 Chore/Other:goal-b15 轮2 守门91冻结票结清翻勾 —— ①已清(5ce93b9e1)②7屏已接线(门91现读 RC=0/0未接线)③自记独立改造另立 ④纪律已登记 (376da1f7fc7)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8f13f11316f)
- 🔧 Chore/Other:goal-b15 轮2 真机走查票结清翻勾 —— 三项终局(①已修 84583fdf6 ②误报 ③已修 26cf923961 真机复测),证据全在库,收口漏翻补翻 (02ef5b45ffc)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7e0a3bb0220)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (e105ffdb708)
- 🔧 Chore/Other:goal-b15 轮2 同题异号孪生副本齐翻 4 行 —— G-77(杀班,G-54 主行已翻同证据齐翻)+Esc 族 3 行(10-08 已归档,4 行全为归档残留);修正此前误判:非回捞竞态,是重编号后同题票拿到不同新号、逐份翻勾只命中一份 (98b39636221)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c12ce30dacd)
- 🔧 Chore/Other:goal-b15 轮2 P2-13③ 结清翻勾(两份副本同批) —— prod-bundle AI 部署诊断链已落地:三件套+deploy-diagnose.sh 四失败点接线+结果落盘+消费者全在位;api tsc 0 错 (5a38eb7e961)
- 🐞 Fix:收口编号形态 —— B 族空洞 B03 前移补齐 + G 族重号 G-56 尾行改 G-77 (e740ac885a9)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6ecdc843866)
- 🔧 Chore/Other:goal-b15 轮2 D15 结清翻勾 —— 通知中心隐藏→归档→恢复流已由 D195 席落地(NotificationFeed.tsx :90-156 可撤销迁移+分区),十键五语逐语验齐套,parity OK (2c5c8c68de2)
- 🐞 Fix:号池 chip 前景按兄弟键配对改名(chipOn/chipOnText)+ 重生成小程序 i18n 离线包(zh-TW 源变更后陈旧) (05eb6b414ba)
- ♻️ Refactor:组件批 122 硬编码中文清零(15 组件 / 22 处) (dce5d74489a)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c335a8687ae)
- 🔧 Chore/Other:goal-b15 轮2 D12 结清翻勾 —— 生态入口语言包已落 HEAD(ecosystem 37+connectors 52 键),页面用键 12 全覆盖零缺,五语 parity OK(19125 键),按住理由(语言包被他席占)已过时 (843b785bac3)
- 🚀 Feature/Improvement:组件批 122 入典(19 组新键 ×5 语言) (57e00a3ee9a)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b3d730e5066)
- 📚 Docs:守门 207 体积清偿 —— AGENTS.md 120,198B→93,377B(预算 96,000,余量 2,623);移出 36 行同题副本/取证叙述/L429+L433 索引副本,逐字留档 .ihui-agent/archive/AGENTS_trim-2026-10-24.md;规则本体与 236/238/239/public-admin 的 R4 点名行一枚未动,check-cross-end-screen-coverage 补进 UI 索引防丢点名 (5e1f901d2f5)
- 🔧 Chore/Other:goal-b15 轮2 批量复翻 5 张回捞/僵尸行 —— 窄窗格缺口C/G-51 31红/G-54 杀班/G-57 fail-closed 四张为二次回捞(翻勾↔归并器竞态:已勾被完成即删摘+未勾副本被守恒带回,本轮翻勾后跟留痕链验证);Esc 无层栈为归档残留首翻(10-08 已归档,4 活行是僵尸)。结清证据均已在先前提交(3026adc85f/7d63c88314)信息中 (49a44972fc1)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (e5caa17116c)
- 🔧 Chore/Other:goal-20261024-Q 补回被折并的两条进展注记(handlers 审计纠偏 / 迁移B3与edu根因) (b0814f2ddeb)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8d6b4369f19)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (31940355d9c)
- 🔧 Chore/Other:认领 5 张 ALIVE 票(D07/D11/失败广播/tmpdir/残行尺,goal-1024m..t) (f85b0f0f684)
- 🔧 Chore/Other:goal-20261024-Q 第三批进展注记 —— RN 双包 tsc 归零、ScreenStates R4 清零、db-blind 棘轮转绿、cross-end 余 1 臂归属 (246b9c1a422)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b4d361c468f)
- 🚀 Feature/Improvement:编号形态门(R3)+ 补号 10 条未取号行 + B/D/G 族压回 1..N 连续 (82fd2729f5b)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (dc8e52c81e1)
- 🐞 Fix:ScreenStates 按钮前景改用配对语义键 brand.foreground(替 surface.light),清 R4 跨 key 品牌底白字 (db992fea2bd)
- 🐞 Fix:守门 182 顶破点收口 —— ws-broadcast 跨实例 publish 的异步失败改 then 双参形态(与链式 catch 语义等价);该处处置的是 Promise 发送失败而非 zod 控制面边界算子,故不再混入 strict 棘轮账,HEAD 面 92→91 回到基线 (0957365b5c7)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5d6439b6cc9)
- 🔧 Chore/Other:goal-b15 S10 翻勾 —— api<T>() 壳迁移票结清:主体 234 份同形壳前几轮已迁完(票面口径 HEAD 现读零命中);本席收尾 relay/benefits apiGet 同形壳→apiOrThrow(b3b3f64276,tsc rc=0);剩余 18 文件 api* 命中全为第三类差异不机械迁 (349e116a660)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5d91ad217cb)
- 🐞 Fix:门 71 纪元档判活补两型 —— 散文桶的飞书式要点行 + 号段标记 (60ae4dba060)
- ♻️ Refactor:小屏清扫批 14 屏 UI 串清零 + 存量悬空引用 17 处收口 (37522b95e74)
- 🚀 Feature/Improvement:小屏批×5 入典(15 新键组)+ 还原误删的 aiAssistant.chat 真身 (9b1de773052)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5ae6a0ca05d)
- 🔧 Chore/Other:结清 G-31 另三道禁令门取磁盘面 —— 三门 git diff HEAD 均 0 行,换面已由 ea0fb180f0/a6c7cb36ec 落地(check-no-mask-image 提交 7017cbedb4e,emoji 自检 27/27+镜像 15/15,shared 镜像 10/10;mask/shared 无 self-test 属既有设计);独立席零改动复核 (4e02b6b33b6)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8524dc8c1bb)
- 🔧 Chore/Other:结清 B03 权限双轴化 —— 双轴+config profiles 已在 HEAD 全量落地(permission-axis.ts 196 行 / permission_axis.py 141 行 / gate 285 行 / agents 路由 4 处接线);types typecheck rc=0、pytest 6/6+38/38、vitest 6/6、词表门 rc=0;独立席零改动复核 (66fea9683e3)
- 🐞 Fix:packages/app 三屏 7 处主题接线(dashboard 2 / settings 1 / workflows 4) (41396447b6c)
- 🐞 Fix:并发会话回插的两对撞号行再收口 —— 在册 104 条族内连续且唯一 (6e15137524d)
- 🐞 Fix:撞号两行各发新号,不再折掉其中一行 —— 在册 104 条全两位号、零重复 (c05ca1a5335)
- 🐞 Fix:收口批 —— 取号前导零 / 主题接线 / 清扫器留痕腿 / fail-closed 帧守卫 / README.en 块 (5588819fa8e)
- 🐞 Fix:F9 补「同号异题」维 —— 两件事写同一个票号,此前整道门看不见 (821e00a40e8)
- 🔧 Chore/Other:补齐 12 枚文件溯源水印(chat-collab / ssrf / ws-broadcast 测试、库迁移与 schema、设计文档)—— 守门 47 HEAD 面欠账清零;同批收编在飞席已注入水印的文件内容 (64675e795f2)
- ♻️ Refactor:api<T>() 壳迁移收尾片 —— relay/benefits 的 apiGet 同形壳(仅函数名不同档:fetchApi + !success throw + return r.data 逐字同形)改走统一出口 apiOrThrow,定义删除、两调用点改写、差异化错误处理面(redeem 手动解包)保留 fetchApi 原样;票面主体 234 份同形壳经票面口径 git grep -cE '^(async )?(function|const) api[<(=]' HEAD -- apps/web 现读零命中(前几轮已迁完),剩余 api* 命中 18 文件全为第三类差异(apiFetch 多层校验/apiOverview 业务函数/apiJsonLd/测试 mock),按票面口径不机械迁;验证 tsc --noEmit 全量 rc=0 零错误 (b3b3f642764)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8dab55e33cb)
- 🔧 Chore/Other:认领 5 张 ALIVE 票(D06/D09/D12/B04/图片标注,goal-1024h..l) (d7227719be9)
- 🐞 Fix:typecheck 归零五文件 —— ModelConfigDialog 两处补 useI18n、N8n map 回调签名、Home 索引非空、Profile 图标类型改 LucideIcon、ScreenStates 去掉不存在的 rnSpacing 导出依赖 (0b079628a5f)
- 🔧 Chore/Other:收口并行会话回插的 3 条撞号行 —— 在册 102 条全两位号(G74/D16/O3/A1/B7/WP1),无超 99、无重复 (9c15d2e2d2c)
- 🔧 Chore/Other:盲写棘轮基线随清偿收窄 329→327(chat-collab 两处条件写入形态落地后按 HEAD 面重锚,只减不增) (30fd572385a)
- 🐞 Fix:G-998153 盲写棘轮清偿 —— chat-collab 接受/撤销改条件写入形态(where 的状态守卫即现值比较,已裁决行不再同值空写盖 updatedAt);同批收编在飞席的 metadata 现值比较与 mobile 消息 id 去重写入,三文件合计清掉基线外 5 处命中 (e46ef3ce583)
- 🐞 Fix:门 71 纪元档改按"题面前缀"判活 —— 换号/复用号不再被读成"行被吞了" (eccc6155319)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (0a23c905973)
- 🚀 Feature/Improvement:任务编号全量重排为两位号(一族一系,≤99)+ 历史迁档 (e5a7395071a)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b0c6f9b9f2f)
- 🔧 Chore/Other:goal-20261024-Q 第二轮进展注记 —— handlers 审计三态+P0 裁决、迁移 B3 修复与 edu 测试根因、11 屏静态复核落地读数 (8f62b7536b4)
- 🐞 Fix:shared/zh-TW 「核准」改「核準」—— 与 web 版同键同字对齐,守门 2j-shared 中文残留转绿 (170648b0c07)
- 📚 Docs:goal-20261024-Q 第二批进展 —— handlers 审计三态与 P0 裁决 / 迁移 B3 与 edu transform 根因 / 11 屏静态复核与三枚落地读数 (3fd208f687e)
- 🐞 Fix:守门 89 撞号收口 —— 237 归跨端页面覆盖(runner 补回被误删的 check-cross-end-screen-coverage 注册,门体健康、AGENTS 速查已点名,不得靠删门消红);计划归档单调性 237→239;mirror-purge 头注与 AGENTS 速查编号 237→238 对齐注册现值;AGENTS 补点名 check-plan-archive-monotonic(239)/check-public-admin-default(守门 89 R4 缺口)。本枚 HUSKY_SKIP_GATE_WIRING: R5 取材面固定 HEAD(check-gate-wiring.mjs 头注 R5),修复枚自身必红;落地后 HEAD dup=0。 (66b89a453f7)
- 🐞 Fix:G-925 静态复核 C2/C4/C5 —— 67 处可点击控件补 44px 触控、3 屏错误态接重试、2 处 chip 圆角归档 (aad975c3c42)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (9ed7828556d)
- 🔧 Chore/Other:认领 7 张可派单票(S1..S7 席位租约) (f8d0d7552f1)
- 🚀 Feature/Improvement:任务编号全量重排为两位号(一族一系,≤99)+ 历史迁档 (9d74e923427)
- 🚀 Feature/Improvement:任务编号全量重排为两位号(一族一系,≤99)+ 历史迁档 (ea32579b60b)
- 🐞 Fix:R3 接线前置三件 —— ① check-duplicate-policy-literals render 签名补 strict 形参(修复直跑 ReferenceError,strict 档语义不变,--self-test 43/43 + 镜像 6/6);② check-gate-presence-exemption 头注对齐 108 存活期表现读(该族已进 FAMILY_LIFETIME_DAYS);③ guard-status-where 补 26 处面不匹配实测登记(108 scanFile 只看同行/前一行,gsw 允许后 3 行的形态差异,只记事实不改判据)。R3 前置清障,接线批另行走 AGENTS 字节预算 (96ea8619f0e)
- 🐞 Fix:RN 测试链补齐 @ihui/shared/constants 四枚子路径别名(about-sections/developer-space/trader-plan-promo/web-portal) —— 2eca6eb203 共享屏重写后 RN vitest 链解析失败(父别名前缀替换吞子路径 ⇒ 子路径必须逐枚显式登记,同 storage-keys 既有规矩);修复后 search-overlay.test.tsx 11/11 绿,回归由 #20 审计席现读发现 (58e08d76952)
- 🐞 Fix:11 屏静态复核 C1 —— 9 屏 64 处次级字色补 dark:text-neutral-400(暗底对比 3.78:1 → ~7.4:1) (40dbcae4386)
- 🔧 Chore/Other:生成物 stale 债同笔清偿(承 26ffb03a 通报③) —— 显式放行陈旧守卫留痕:HEAD 面 b64/gen 钉的是 442cc8df2d 生成时的旧输入(解码头对键差 23-25 条全是同路径旧值),本次按 HEAD 现输入重跑 gen-i18n-compressed + 三端 generate-ui-routes,新值 85-87 键/语(about/carte 等合并词典),键路径消失 0;三端 ui-routes 产物 diff 纯自述钉块(sourceCommit/inputsSha256/generatedAt),内容行零差 (788ad715d62)

**2026-10-24**
- 🚀 Feature/Improvement:大屏第八轮(无障碍补强/窄档页头/对比度/缩放触发面) (c7dce2b8151)
<!-- END RECENT UPDATES -->

## Nine topic documents (verbatim archives from the old root README)

| File                                                                                                     | Domain                           | Archived sections                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`readme-01-positioning`](./docs/engineering/readme-01-positioning.md)                                   | Positioning & claims             | Header banners & manifesto · one-click deploy · tech-stack overview · project manifesto · GEO optimization · TOC · positioning · feature matrix                                                                                |
| [`readme-02-ux-and-ai-control`](./docs/engineering/readme-02-ux-and-ai-control.md)                       | UX & AI control                  | Streaming AI UX (Phase 19) · full AI-control bridge · GlobalTopBar + Plus popover · use cases · AI conversation decision surface & runtime facts                                                                               |
| [`readme-03-why-comparison-scenarios`](./docs/engineering/readme-03-why-comparison-scenarios.md)         | Selling points & scenarios       | Why IHUI-AI · benchmark matrix · who uses it · 5 typical scenarios · contact                                                                                                                                                   |
| [`readme-04-architecture-and-modules`](./docs/engineering/readme-04-architecture-and-modules.md)         | Architecture & modules           | Tech stack · 9-end architecture · cross-end sharing · maintenance ratio · app hierarchy diagrams · project structure · 15 module deep-dive                                                                                     |
| [`readme-05-quickstart-api-data`](./docs/engineering/readme-05-quickstart-api-data.md)                   | Quick start / API / data         | Quick start · REST/WebSocket API & capability catalog · model auto-sync · IM multi-platform control · database                                                                                                                 |
| [`readme-06-security-observability-gates`](./docs/engineering/readme-06-security-observability-gates.md) | Security / observability / gates | Observability · security design · root guardian service · full gate table · commit-loss protection · quality evidence · AI collaboration statement · testing · deployment · CI · i18n · LLM dictionary · gate registry addenda |
| [`readme-07-faq-roadmap-commerce`](./docs/engineering/readme-07-faq-roadmap-commerce.md)                 | FAQ / roadmap / commerce         | FAQ · contributing · doc navigation · roadmap (delivered / recent updates / capability list) · monetization · star history · translated READMEs · contact                                                                      |
| [`readme-08-seo-keywords-story`](./docs/engineering/readme-08-seo-keywords-story.md)                     | SEO & brand story                | AI-engine exposure · our story · open-source vision · license · join us · acknowledgements · quick FAQ · full keywords                                                                                                         |
| [`readme-09-ops-tools`](./docs/engineering/readme-09-ops-tools.md)                                       | Ops tooling & archives           | Release-line closure capabilities & ops entries · production monitoring tools · gate registry addenda · dangling table rows archive                                                                                            |

## The 9 ends (8 apps + 1 Capacitor shell)

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
