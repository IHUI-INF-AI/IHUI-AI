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
| 数据库表 | 653 | `dbTables` |
| schema 文件 | 253 | `dbSchemaFiles` |
| API 路由 | 4859 | `apiRoutes` |
| 路由文件 | 716 | `apiRouteFiles` |
| AI 服务路由 | 677 | `aiServiceRoutes` |
| WebSocket 端点 | 40 | `wsEndpoints` |
| 入库模型清单 | 100 | `llmModels` |
| 发布平台 | 38 | `publishPlatforms` |
| 端应用包 | 9 | `appPackages` |
| 共享包 | 18 | `sharedPackages` |
| CLI 命令文件 | 78 | `cliCommandFiles` |
| CLI 工具文件 | 112 | `cliToolFiles` |
| 语言 | 5 | `i18nLanguages` |
| i18n 作用域 | 7 | `i18nScopes` |
| 语言包 JSON | 35 | `i18nMessageFiles` |
| 测试文件 | 5910 | `testFiles` |
| CI 工作流 | 59 | `ciWorkflows` |
| Compose 服务 | 14 | `composeServices` |
| 工程守门 | 370 | `guardianGates` |
| — blocking | 339 | `guardianBlocking` |
| — warn | 33 | `guardianWarn` |
| 跟踪文件 | 23015 | `trackedFiles` |

上表由 `node scripts/sync-readme-numbers.mjs`(唯一写入口,索引面取数)生成,最后核对日期 2026-11-19。
每个数的来源就写在取数键旁边的实现里(`scripts/gen-doc-numbers.mjs` 的 `SOURCES`),**不得手抄、不得另立第二份**。

<!-- END GENERATED NUMBERS -->


## Recent updates (auto-maintained)

<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->
**2026-11-22**
- 🔧 工程/其他:硬闸计划任务/自动推送/推送区间大文件 (12782592)
- 🐞 修复:安装器默认目录改为固定盘探测,不再写死盘符(无 D 盘机器静默安装不再落空卷失败) (1e1aefa8)
- 🐞 修复:env-pin.ps1 补齐 NODE_OPTIONS(仅在现值空且钩子文件在盘时补),使重启后自查不再报 changed (f0e458e7)
- 🐞 修复:安装器默认目录由 D:\智汇AI 改为 D:\software\智汇AI(应用不再散落盘根) (70effce8)
- 🔧 工程/其他:增加提交前终局字节闸 (c10ff717)
- 🔧 工程/其他:拆除计划任务自愈与剩余自动回补入口 (f564dd66)
- 🔧 工程/其他:根治自动回补与索引字节绕过 (126761ff)
- 🔧 工程/其他:把仓库重量预算接入 required check (57c04f0e)
- 🔧 工程/其他:禁止历史备份 tag 与收紧仓库重量预算 (1b3f52bc)
- 🐞 修复:新增 env-pin 进程环境变量纠偏（shell profile + 入口预加载），堵住旧 D 盘 env 在驻留父进程里代代相传 (5a576c36)
- 🐞 修复:发布脚本 SDK/JDK 候选序补 %LOCALAPPDATA% 位并纠正过时注释 (4362cf19)
- 🔧 工程/其他:接线字节与仓库重量守门,根治二次膨胀 (e0909151)
- 📚 文档:补安卓工具链落位约定并补登 Y-71 临时工作树门名 (27f0a4b1)
- 🚀 新功能/改进:补齐 app.config.js 引用的阿里妈妈方圆体字体资源,修复 prebuild 缺字体失败 (8e207893)
- 🔧 工程/其他:同步 knip entry 受管块(移除已删页面 index.config.ts) (543c8691)
- 🔧 工程/其他:仓库最终快照（仅保留当前代码，不保留历史） (4fa6b2cf)
- 🔧 工程/其他:同步 knip entry 受管块(移除已删页面 index.config.ts) (7a14c0c8)
- 🐞 修复:公开状态响应连 providerCode 一并归一,JSON 零内部 relay (ac55aca4)

**2026-11-19**
- 📚 Docs:同步最近更新自动块(本轮两枚安装脚本修复入库) (ad65572bea)
- 🔧 Chore/Other:追认 bd46446f9f 的判据库头注修正 (3aac3fb83d)
- 📚 Docs:同步最近更新自动块(本轮两枚安装脚本修复入库) (3ac94015b9)

**2026-11-18**
- 🐞 Fix:移除提权段,两份安装脚本回到实测零命中形态(火绒 NetLoader 根治收口) (bd46446f9f)
- 🐞 Fix:两份分发安装脚本统一为同一实现，彻底消除杀软触发面 (6374264c2e)
- 📚 Docs:align the trackedFiles block to the HEAD-face count the gate computes (6c7ee189ba)
- 🔧 Chore/Other:19 个 Windows 计划任务迁到登录常驻调度器(禁计划任务铁律) (1a48425576)
- 📚 Docs:Y-37/RP-2/Y-58/Y-72 追加 2026-11-18 SSH 生产机只读实测注记 (76ef533a4e)
- 🔧 Chore/Other:acknowledge the protected-face content that merge 31fb90364f6 brought in (c3cbe992f3)
- 🚀 Feature/Improvement:桌面端「窗口置顶」开关的图钉文案(五语言) (5c8c7eb1eb)
- 📚 Docs:align generated block to the HEAD face so the doc-numbers gate agrees (3b04349417)
- 📚 Docs:refresh generated blocks after R127 (74aa180317)
- 🐞 Fix:type the empty HELP_ONLY frozenset so the whole-library mypy gate passes (5d9ef5b3fc)
- 🐞 Fix:R127 type the entry list so mypy strict passes (b749a4a768)
- 🚀 Feature/Improvement:R127 duplicate-then-delete starter deck builder, 91.2% -> 91.8% (7ba58d22e3)
- 🐞 Fix:安装脚本不再假装有 binary 通道 + 用法改为实测可用入口 (1d8c59640a)
- 📚 Docs:refresh generated blocks to the current tree after R124-R126 re-land (9e1649f592)
- 🐞 Fix:模型选择器分组名不再暴露内部 provider code(workbuddy_relay) (89ab8a14f3)
- 🚀 Feature/Improvement:R124 and R125 re-landed a second time after another concurrent reset, 91.2% (f010be92cc)
- 🚀 Feature/Improvement:R126 source-level cheat detection in check_template_fidelity, 90.6% -> 91.2% (4dbfad506f)
- 🔧 Chore/Other:标注反代号池·模型目录自动同步功能(补可追溯历史) (94076b9284b)
- 🚀 Feature/Improvement:R124 the template-following plan gate, 89.3% -> 89.9% (946ceb4abe1)
- 📚 Docs:同步生成块数字(测试文件/跟踪文件) (b08c158634c)
- 🚀 Feature/Improvement:R123 the template creator request gate, 88.7% -> 89.3% (e98b15fed53)
- 🐞 Fix:WS 适配器不再把业务事件收成空通知条目 (8779f22f1a3)
- 🚀 Feature/Improvement:R122 the report-shape gate, 88.0% -> 88.7% (fb920bdfc24)
- 🚀 Feature/Improvement:R121 read the presentation finaliser, 86.8% -> 88.0% (1fba5e218a7)
- 📚 Docs:按当前树对齐生成块(推送前) (abbb8710f6f)
- 🔧 Chore/Other:声明档退场本器自写面孤儿键 210 枚 (9285b2b30ac)
- 🔧 Chore/Other:退役孤儿侧车键 1126 枚 + 修正镜像测试取样 (c2396ad2617)
- 🔧 Chore/Other:R120 execute the .mjs helper layer, 83.0% -> 86.8% (f7f95b215fe)
- 📚 Docs:生成块数字对齐当前树(testFiles 5889 / trackedFiles 22935)。因并发会话新增测试与跟踪文件,推送前 doc-numbers 门判红;本枚只改由 sync-readme-numbers.mjs 独家产出的两处数字行。 (2976204f59b)
- 🚀 Feature/Improvement:R119 documents 最后 8 个工具全跑通 —— 全域 36/36，并推翻"无一原地修改" (da59687a11b)
- 🐞 Fix:根护栏清单重封到 HEAD 面(git-guardian=3ae00414ebad)。根因:09:38Z 那次重封之后又有三枚 guardian 修复入库(活体体检挂 main() 链、dev api 体检 5 分钟节流、ref 位移守夜人接节拍)未同笔重封 ⇒ 部署环 root-guard fail-closed 拒绝构建切流;本枚仅重算清单期望哈希(与 root-guard 现算的 HEAD 面值逐字相等),规则正文一字未改。 (161d5910ccd)
- 🚀 Feature/Improvement:R118 真的把 documents 的 36 个工具跑起来 —— 四种调用约定，不是一种 (e8ae25b758b)
- 🐞 Fix:推送清单为空时按 origin/main..HEAD 只读派生改动范围 (8cc73cbdad3)
- 📚 Docs:刷新 README.en.md 生成块数字,与当前树对齐。因本轮新增 1 枚迁移文件 + 并发会话新增测试文件,生成块落后 1-2 枚计数 ⇒ 推送前 doc-numbers 门判红;本枚只改由 sync-readme-numbers.mjs 独家产出的数字块。 (5d9b09d9893)
- 📚 Docs:按当前树对齐生成块(推送前) (83014b73710)
- 🚀 Feature/Improvement:R117 把文风准则做成能跑的东西 —— 24 条单测全绿，真跑一次就现原形 (18e4b2aaac2)
- 📚 Docs:按当前树对齐生成块(并发漂移已消除) (3de0261370c)
- 🐞 Fix:数字门判据面冻结为本次推送的 local sha (bf58697bd9b)
- 🐞 Fix:补入库 BUG-29 索引补齐迁移 20261118000000_bug29_indexes.sql(38 条 CREATE INDEX IF NOT EXISTS)。根因:该迁移文件此前只在工作树、journal 里已有条目(idx 408)却无对应文件 ⇒ 生产 pull 到 438 条 journal 后 db:migrate 会读到这一条却找不到 SQL,部署在迁移步 fail-closed;本枚只补文件本体,SQL 内容一字未改。 (c573d417d0a)
- 🚀 Feature/Improvement:R116 风格表与引擎文档 —— 两份风格指南是同一个文件 (da54e8d0c43)
- 📚 Docs:生成块按树全量对齐(testFiles=5886, trackedFiles=22928) (cc742d547cf)
- 📚 Docs:生成块改由按树取数器物对齐(testFiles=5885, trackedFiles=22926) (2fc8e44fdb0)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3f84fd6c094)
- 🚀 Feature/Improvement:R115 documents 的 33 篇自述 —— 三种"看起来有信息其实没有"的信号 (1e306ad9dfc)
- 🐞 Fix:R114 撤回两条错判 —— 尺子量错了方向 (dba8a5a5533)
- 📚 Docs:合并后按索引面刷新生成块数字 (a3ffcd13250)
- 📚 Docs:生成块随并发新增再对齐(测试文件 5880→5881,跟踪文件 22915→22919) (5db68571679)
- 🚀 Feature/Improvement:R113 覆盖率尺子 —— 把"百分百"变成可判定的数 (45fccada5ad)
- 🚀 Feature/Improvement:R112 documents —— 36 个工具、一种占位符、一个看不见的坑 (499c7e06fab)
- 🚀 Feature/Improvement:R111 旋转 —— 框会撒谎，说这个形状不需要那么多地方 (b9a0b3cfb6c)
- 📚 Docs:生成块按树取数对齐(测试文件 5830→5880,跟踪文件 22776→22915) (3b5813e84dc)
- 🔧 Chore/Other:补登 29 条孤儿迁移到 drizzle journal(通知投递幂等/唯一索引等)。根因:迁移文件存在但无 journal 条目 ⇒ drizzle-kit migrate 与「迁移先行闸」逐枚审计都看不见它,生产 notifications 表缺 idempotency_key/email_claimed_at/email_sent_at 三列致 GET /api/notifications 500(同实例 unread-count 只 count(*) 故 200)。已按同一口径(ADD COLUMN IF NOT EXISTS + CREATE UNIQUE INDEX IF NOT EXISTS)在生产库逐文件应用 23 枚并在 drizzle.__drizzle_migrations 写入 hash/journal-when 账本行,复测 GET /api/notifications 200;本枚只补登记,SQL 内容一字未改。 (290adc6b6c1)
- 🚀 Feature/Improvement:R110 修 —— 造一个真能抓住溢出的检测器 (0c99a50f703)
- 🐞 Fix:Y-88 DiagramPreviewModal 注入前 DOMPurify 消毒 svg,信任边界收到契约层内 + 恶意标记回归测试 (3bd469b41fe)
- 🐞 Fix:三枚 codex 契约模块 mypy 清零(行为不变) (b83680a4a9d)
- 🚀 Feature/Improvement:R109 那个负责抓溢出的工具，抓不到溢出 (3c09de07dc3)
- 🐞 Fix:Y-85 插件统计 days 加 clamp[1,365]+make_interval 参数化,消除 sql.raw interval 字面量拼接面 + 回归测试 (46f816aa90b)
- 🚀 Feature/Improvement:R108 渲染链 — 三个环境变量，一个 runtime python，然后终于看见了画面 (270af6e3671)
- 🚀 Feature/Improvement:R107 把字面值变成真工作簿 — R103 那个缺口被补上了 (d47243761bf)
- 🐞 Fix:恢复被并发推进覆盖的 Y-86 两个文件(statistics.ts / y86-agent-heat 测试) (1e3b2fcb8cf)
- 🚀 Feature/Improvement:README 数字对齐器物(按树取数),根治写入口与判据口径断裂 (d00b255d30d)
- 🐞 Fix:Y-86 agent-heat 默认日键改用 bizDayKey(Asia/Shanghai) 消除 UTC 错位 + 回归测试 (e1d6773e37c)
- 🐞 Fix:文档数字门从 push 腿整体摘除(观测空跑 ~200s 抵不上代价) (f1ff5fa5d63)
- 🐞 Fix:pre-push 文档数字门降为观测腿,不再阻断推送 (b71213859f9)
- 🚀 Feature/Improvement:R106 provider 的线协议 — 为什么本地模型池喂不进这个版本 (0066e1b95dd)
- 🐞 Fix:文档数字门 push 档改用推送范围判责,不再替别人的新增背锅 (ce3e97c4d40)
- 📚 Docs:数字表按 HEAD 面现算对齐(testFiles 5829 / trackedFiles 22774),表格形态不在写入口覆盖面内,本次按行精确改 (0ad9fcd7e73)
- 🐞 Fix:Y-95 RegistryClient apiUrl 加 transport 闸(仅 https 或回环 http),防非回环 http 明文传 Bearer (26dc199cc02)
- 📚 Docs:数字表按 HEAD 面现算对齐(testFiles 5828 / trackedFiles 22773),写入口只刷列表形态未覆盖表格形态 (e5f2a32351a)
- 🚀 Feature/Improvement:R105 问运行期的解析器 — hook 配置到底是什么形状 (5a3e4cbaafd)
- 📚 Docs:按 HEAD 面现算对齐(testFiles 5828 / trackedFiles 22773) (2564bd4a017)
- 🐞 Fix:Y-90/93/94/89 四处 async 回调补 reject 处理(复位loading/落error/记日志),消 unhandled rejection (050b7aafc3e)
- 🐞 Fix:恢复被重构丢掉的 tool_result_payload/outcome(mypy 红是真 bug) (5ffcd1b2913)
- 📚 Docs:按 HEAD 面现算对齐能力矩阵后的 apiRoutes 4859 / testFiles 5827 / trackedFiles 22772 (b50af59fda0)
- 🚀 Feature/Improvement:上游能力矩阵(qoder 7 / trae 10 / workbuddy 8,每条指到真实符号;唯一 unreproducible 是 Qoder 请求签名)+admin 只读端点;对照程序四类典型能力逐条给本仓落点 (965be02cdec)
- 📚 Docs:生成块数字对齐现算(testFiles 5826 / trackedFiles 22770) (236d917231b)
- 🔧 Chore/Other:撤回并发复用探针(实测回执恒 exit 1 ⇒ 探针从不命中) (c87cc86b8ba)
- 🔧 Chore/Other:Y-83..Y-96 的摘除注记批次号对齐到已推送的远端版本(两侧除批次号外逐字节相同,双版并存会永久阻断 git-sync-converge 的折叠裁定) (6def559e82c)
- 🐞 Fix:Y-87 GitHub Device Flow 授权页 window.open 补 noopener,noreferrer(reverse tabnabbing) (3d49c30942e)
- 🔧 Chore/Other:补齐 miniapp-taro 四语言的 user.menu.about(en 独有),i18n parity 七 scope 全部 0 差异 (dad0a443889)
- 📚 Docs:R104 四十八轮的索引与一份诚实的边界面 (403da8e22e3)
- 🐞 Fix:头条热榜 HotValue 是字符串而非 number(实测 "39019941"),原 typeof 判定恒 false 导致热度全丢;改走 parseHotValue 兼容 number/string/万亿单位 (0d3d09513e0)
- 📚 Docs:生成块按 HEAD 面现算对齐(apiRoutes 4858 / apiRouteFiles 716 / testFiles 5825 / trackedFiles 22769;本票新增 1 路由文件+3 测试文件+3 服务文件,共 +7) (d5fbe599977)
- 🚀 Feature/Improvement:R103 --target-application 不是默认值，是数据模型开关 (6d846218a11)
- 🚀 Feature/Improvement:公开签名协议层(HMAC-SHA256/AWS SigV4/OAuth1a/JWT-HS256 纯函数)+PAT 一键引导与生效判据+桥接恢复策略(缺件/端口/登录态/阈值分流);admin 两面已接线 (7b8f2decb1e)
- 🚀 Feature/Improvement:R102 源图豁免真的被打开了 (0703bcdeb8d)
- 🔧 Chore/Other:teardownTimeout 30s —— 出包门链上 forks worker 收尾超默认 10s 被判红,属资源预算不改判据 (7034dca0fc5)
- ⚡ Perf:等锁结束后回读并发绿回执(省掉重复的 100s 全量) (c1ad24b619e)
- 🐞 Fix:趋势判定在无热度值时改用排名相对变化(实测 16 源 5.3 万条 current_hot 全空,trendTag 原恒 stable);保留期 120→30 天且按日切片收敛(一次性 DELETE 会撞 30s statement_timeout) (19d5d78b86d)
- 📚 Docs:生成块按 HEAD 面现算对齐(apiRoutes 4856 / apiRouteFiles 715 / testFiles 5822 / trackedFiles 22762;上一枚 docs 用了回退值,以本枚为准) (9ed3f9e5096)
- 📚 Docs:生成块数字对齐现算(apiRoutes 4854 / apiRouteFiles 713 / testFiles 5818 / trackedFiles 22759) (cc43d43078b)
- 🚀 Feature/Improvement:Cosy 能力自述层(4条设备头映射+2固定档=verified / 请求签名 unreproducible 明示不伪造 / 客户端桥接 bridged)+admin 只读端点;导出 COSY_HEADERS 为单一真相源;README 四维同步(DN5) (fca275e4358)
- ⚡ Perf:回执环境指纹去掉 node_modules 布局尺寸(实测 156s 到 5.1s) (19269c67dde)
- 🚀 Feature/Improvement:R101 源图豁免与收据 — 两道门，一道都绕不过去 (c01c1bad3af)
- 🐞 Fix:F-667 token 聚合列去末端 ::int 消除 22003 溢出(relay stats / saas quota) (5059f28d6b4)
- 🚀 Feature/Improvement:R100 图表工作簿校验 — 触发器是 c:cat，不是 embedded workbook (90622a2df6e)
- ⚡ Perf:3b 批量取材上限 256MB 抬到 640MB(实测批内 126s→82.7s) (ce5f938946d)
- ⚡ Perf:3b 批量取材上限 256MB 抬到 640MB(批内实测 126s → 82.7s) (dc1cbab2220)
- 🚀 Feature/Improvement:R99 原生表格与图表 — 一个包里有两个 schema 命名空间 (c99321b9754)
- 🚀 Feature/Improvement:补接入套件一键生成(建Key+接入四行+直达链接)与本机凭证发现/端点取证助手(只读不采用);README 四维同步(DN5) (63c34b572da)
- 🐞 Fix:覆盖层是否变化改按内容判(sha 恒漂移导致无改动也白跑 OTA),overlayDiff 单一真相源 (a30d6ad38bb)
- 🐞 Fix:收尾 ssh 清理加硬超时(60s) —— 裸 ssh 挂死会持锁导致计划任务每小时全跳 (3f4c0643b0e)
- 🐞 Fix:门链输出 Tee 落盘(失败可回溯) + 清 env-probe 诊断残留 (41b8c3ed770)
- 🐞 Fix:退役清单补上 expires 存活期这一维 —— 到期即失去消音资格（清偿 RP-21） (aa372f52da5)
- 📚 Docs:生成块补齐 apiRoutes 4852->4854 / apiRouteFiles 712->713 / testFiles 5817->5818(本票新增 1 路由文件+1 测试文件,DN5 清单不变式) (80f94f41fc7)
- 🚀 Feature/Improvement:补权益活动领取判据层与 admin 预览面(对标 qoder2api 的签到+福利真实领取;端点未实证整批拒发起);README trackedFiles 22750->22753(DN5) (384cff16b03)
- 🔧 Chore/Other:页脚 DATABASES 移除 sqlite 项后,同步删除 5 语言 databases.sqlite 键(有意删除键,出口②留痕) (6bd6d6bbc4e)
- 🔧 Chore/Other:追认 eb8e7d98 一档(门结论缓存库 + 容器圆角门接入) (678794a12de)
- 🚀 Feature/Improvement:R98 内容层 findings — 退出码其实三态，warning 永不升级 (911e9de6d4c)
- 🐞 Fix:快照表加 120 天保留期滚动清理(此前只增不删,91 天已 233 万行);fix(web): 页脚云数据库移除 sqlite 项(本项目存储是 PostgreSQL,该项还误配 AWS 图标) (eddc235b844)
- 📚 Docs:生成块 4 个数字跟随当前 HEAD 面(apiRoutes 4852 / apiRouteFiles 712 / testFiles 5817 / trackedFiles 22750) (5ab7d0e0bcc)
- ⚡ Perf:门结论缓存库 + 容器圆角门接入(全量档 35s → 0s) (eb8e7d9851a)
- 🚀 Feature/Improvement:补客户端接入配置拼装层与 admin 端点(对标 qoder2api 的配置生成器);README 生成块 trackedFiles 22745->22748(DN5) (4b02e488541)
- 🚀 Feature/Improvement:R97 六道门行为契约 — 黑盒执行，两阶段判定实测到手 (2e5ecbc8048)
- 📚 Docs:R96 许可审计 — plugin.json 写 MIT，随包 LICENSE.txt 却是全权保留 (202cf92ee99)
- 📚 Docs:生成块 4 个数字跟随 HEAD 面(apiRoutes 4850 / apiRouteFiles 711 / testFiles 5816 / trackedFiles 22745) (537e3b01446)
- 🚀 Feature/Improvement:R95 技能引擎 20 工具 / 6 道质量门 / 两个交互契约 (dbbade8d5e8)
- 🔧 Chore/Other:追认 569e0f15.ecedec8a02 一档(typecheck 回执键收紧,判据强度不降) (4747e5b3501)
- 🔧 Chore/Other:追认 admin 冻结闸服务env缺失改判未判定 (b35ab22dc17)
- 🚀 Feature/Improvement:补稳定设备身份派生层与 admin 派生面(对标 qoder2api 的 derive_id);README 生成块 trackedFiles 22740->22743(DN5 清单不变式) (e4221f23dce)
- 🐞 Fix:趋势计算改库内聚合+批量写入(原实现把近30天约77万行快照全读入Node并逐 item 串行 upsert,是 api 跑满数小时后 /api/auth/me 卡 20s 的根因);feat(guardian): 体检器物退化时抓进程与PG现场 (21232934d0d)
- ⚡ Perf:回执键从整树收紧到 tsc 输入面(136s → 7.3s,18.7 倍) (569e0f150a3)
- 🚀 Feature/Improvement:R94 内置插件三层契约与 hook 配置契约（含四条否证） (9133cc9f9cf)
- 🐞 Fix:OTA 腿失败不再判整轮红 —— 回落整包(本站唯一真实交付通道),避免 origin/main 被他人推进后每小时红且零产出 (8cbcf685cab)
- 🐞 Fix:admin 冻结闸服务env缺失改判未判定,避免非生产机误报密码被改 (1f31f0e7792)
- 📚 Docs:生成块 trackedFiles 22739→22740(本轮新增 1 个跟踪文件) (887507fc264)
- 🚀 Feature/Improvement:等锁改为实时可观测(排队登记 + 每5s进度 + status 查询) (ecedec8a02e)
- 🔧 Chore/Other:按 HEAD 面重封根护栏清单(git-guardian=3ae00414ebad,同枚规则文件已在 b50012b24ad) (60100019fe6)
- 🐞 Fix:活体体检挂到实际常驻的 main() 链上(原仅挂 daemon 面,常驻轮从未跑到) (b50012b24ad)
- 🚀 Feature/Improvement:R93 运行期观测(7crate/12target模块树 + state_5 15表109列62迁移 threads43列 + Electron 17键signed-out) (98beff33214)
- 🔧 Chore/Other:新增 dev api 活体体检器物并按 5 分钟节流挂上常驻面(连续超阈才重启,自证本仓 dev api + 24h 配额双护栏) (78354733f6e)
- 🔧 Chore/Other:具名追认 3c7cca1a(guardian 追认提交自签 payload 与实际 blob 错位) (b14723208e4)
- 📚 Docs:登记一票——RETIRED_KEYS 带证据登记制缺 expires 存活期，与 §0.7/守门108 的到期要求有差距（核验 489bd483 时发现，本轮只登记不动判据） (83529a62cf4)
- 🐞 Fix:StreamTag 补可选 onClick/ariaLabel 并去掉原生 title(修 HEAD 面 2 处 TS2322) (70f342c6744)
- 🚀 Feature/Improvement:R92 A4结构性否证(长度1的run=0,单变体枚举不可独立认证)+R56-R92终章索引(33模块/13项终态/10条否证/五条硬读数) (f628359625f)
- 🐞 Fix:发版链三处硬化 —— 清 ANDROID_SDK_HOME 冲突 / 删陈旧 JS bundle 产物 / 私有仓分片腿按 exit3 降档(人工确认:行级复活是 throw 行移入 elseif 分支所致,整 blob 语义未丢) (f254a3bcd17)
- 🐞 Fix:补 _schema 返回类型注解,清偿 T1 mypy blocking 红 (1fe94a95e6b)
- 🔧 Chore/Other:T1 全量 typecheck 超时预算按 2026-11-18 实测校准(405s→600s) (af49318c19b)
- 🐞 Fix:自愈腿的 commit-tree 补单源提交身份，根治派生/服务上下文恒 Author identity unknown (5e40ea8176a)
- 🐞 Fix:冷启动静默刷新瞬时失败后排有界自愈,不再永久停在已登录无 token 的混合态 (0cbe966a090)
- 📚 Docs:登记一票——镜像测试 T-D3h 夹具隔离破了，跑它会派生真仓自愈并推进 main（本轮对照实验实测，ROOT 单源解析属高危面须独立做） (e1b81e8c3c1)
- 🐞 Fix:验签器兼容 Tauri 双层 .sig + feed 快照刷到 0.1.78 (5203c7df443)
- 🚀 Feature/Improvement:R91 待办收官(A6两条说明揭出schema外规则/A9 57默认值可执行/A3 205-209无变体表/A5前提不存在/Ghidra导入285s无增量) (6ea0efecfc6)
- 🚀 Feature/Improvement:模型判死清单下发到前端,号池与兜底清单同样标死必失败的行 (256fb1b9f27)
- 🚀 Feature/Improvement:R89 待办账收口(A2零残片/A7 987结构/A8 60空白族/A11a遥测面) + R90 A12运行期契约校验器 (527e6ac348d)
- 🐞 Fix:恢复 StreamTag 可点击定义,清偿 union merge 遗留的两处类型错误 (66acccabf20)
- 🔧 Chore/Other:追认 1cb265e5f 与刷新 302p 基线 (468d0933ddb)
- 📚 Docs:R56-R88 codex 逆向链终局报告(三路线闭合/天花板914/A1-A13账/2784例全绿) (88dd6577aca)
- 🐞 Fix:废弃键清单改为「带证据+日期」对象形态,登记本地有意关闭的 TURNSTILE_SECRET_KEY (489bd483a75)
- 🚀 Feature/Improvement:R87 枚举变体表3/4定位(R87多副本13) + R88 代码级字符串路线否证(中位2/正控1-316) (cfa2a191d67)
- 🐞 Fix:关闭 Turbopack 构建期持久缓存,消除 next build 的 SST/zstd 内存分配失败 (2b65b520269)
- 🚀 Feature/Improvement:R86 覆盖缺口分类账(named316/under372/empty500/over226/池路线天花板914) (92f71690819)
- 🚀 Feature/Improvement:R85 23 段 inline schema 二进制定位(3/23 且全为 output/12 个 input 段全空) (b52ff044fdf)
- 🐞 Fix:fetch 加 3 次退避重试 + 覆盖层纳入 api-client 源(主干 rn-tests 门红根因) (b4a2f8d91bc)
- 🔧 Chore/Other:并入两处主线所需修复(ahead 仅 queued 档 + 发布 scp 255 重试) (963695c34ec)
- 🚀 Feature/Improvement:R84 hook 定义对象二进制坐实(7 中 6 认证/3 共享一址/PostToolUse 未定位) (c8b910b01b3)
- 🚀 Feature/Improvement:R83 滑动窗口认领16结构(跨源认证1枚/薄证据2枚/覆盖321/长run切分收益0) (6c608e59084)

**2026-11-17**
- 🐞 Fix:修复 relay 语法阻断 + nav-data 重复声明 + 补登两条孤儿迁移 (64fe054900)
- 🐞 Fix:nav-data 删除末尾重复的 ADMIN_HUB_ITEMS/DEVELOPER_HUB_ITEMS/HR_HUB_ITEMS 定义(Turbopack 'defined multiple times'+ADDR,web 构建 collect page data 失败) (020fe2ef9e)
- 🔧 Chore/Other:同批重封根护栏清单(git-guardian hashTarget 跟随 f1f0640929) (6dc26aae25)
- 🐞 Fix:漂移对齐每轮采样默认 8→40,让旧代副本积压一轮消化 (f1f0640929)
- 🐞 Fix:修复 relay 语法阻断 + nav-data 重复声明 + 补登两条孤儿迁移 (579700cb77)
- 🚀 Feature/Improvement:/v1/models 峰谷价窗口宣告 active_now(qoder2api off_peak_active_now 对齐,判据复用 matchPeakRule) (74e1bc39f6)
- 🐞 Fix:重生成 tool_name_sets.json 使生成物与 TS 真相源同步(消 307 门存量红) (73376f8096)
- 📚 Docs:README 生成块数字刷新(apiRoutes 4840 / apiRouteFiles 706 / testFiles 5725 / trackedFiles 22548) (832401f3b3)
- 🐞 Fix:hook-failures 删除重复的 readHookFailureEvent/HookFailureEventRecord(HEAD 面两份定义致 TS2323/TS2393,@ihui/shared dist 构建 exit 2,部署环连续 build-fail) (e8e963c5a5)
- 🚀 Feature/Improvement:主机诊断只读面 + /v1/models 峰谷价宣告(qoder2api 实现面继续对标) (bb8eca6f56)
- 📚 Docs:数字生成块按 HEAD 面现算刷新(testFiles 5721->5723 / trackedFiles 22539->22543) (de92a4bb19)
- 🐞 Fix:rn-tokens 去重 stroke 块——HEAD 面每段重复一份致 TS2300/TS1117,design-tokens dist 构建 exit 2,部署环连续 build-fail 无法切流;盘上副本=祖先 20c79aa81 的去重态(有意回退,LAND_ALLOW_STALE 留痕) (11b2557cf2)
- 🚀 Feature/Improvement:/v1/models 规格宣告 + 根路径探活别名族(qoder2api 接口面对标) (f3a7171eaa)
- 🐞 Fix:锁落点收成单一真相源并补齐新建仓父目录 (3ddda0ea96)
- 📚 Docs:数字生成块随本票新增 2 文件刷新(testFiles 5721 / trackedFiles 22539) (e1aa678cbc)
- 🐞 Fix:README 增量游标 .doc-autoupdate/last-sha 进 ff 让位封闭清单 (bce9ed62b2)
- 🚀 Feature/Improvement:qoder2api 能力对标超越——模型路由区域判据(双区显式选区 + 独占表平台兜底) (76bb984966)
- 📚 Docs:刷新 README 生成块数字对齐当前 HEAD 面现算(trackedFiles/testFiles/dbTables 等) (069b7a5a5e)
- 📚 Docs:安装器 synopsis 同步「旧版已停用」,只重建主入口 (c694220b65)
- 🐞 Fix:安装器只建主入口,桌面不再产出旧「WorkBuddy 一键切号」 (7b890457e2)
- 🐞 Fix:隔离坏凭据解密失败避免拖垮整条保活腿 (4bf241d567)
- 🐞 Fix:锁落点与gitdir解耦根治多会话误杀 (bf3a628436)
- 📚 Docs:README 主生成块剩余三数按 HEAD 面现算对齐（dbTables 651→652 / dbSchemaFiles 252→253 / apiRoutes 4832→4839，均本票新增表/路由所致） (07ff6714b3)
- 📚 Docs:README 生成块对齐 HEAD 面现算（本票 16 文件落地致 apiRouteFiles 703→704 / testFiles 5705→5707 / trackedFiles 22485→22495） (b44b3c26be)
- 🚀 Feature/Improvement:qoder2api 能力对标超越——号池自助授权会话全链路落地 (3c54d74cbf)
- 🔧 Chore/Other:docs plan: PROJECT_PLAN 登记 RP-81 发版通知 IM webhook 待办 (1bf9845dc2)
- 🐞 Fix:真实复核后续期16条到期降噪策略恢复族级防抖 (3b2d871c81)
- 🔧 Chore/Other:feat desktop: IM 通知支持企业应用凭据换 token 兜底 (aa84d31e4b)
- 🔧 Chore/Other:折叠头行 hover 真浏览器回归闸——底色不变只换低对比描边(量计算样式非读类名) (d6ea6f189b)
- 🐞 Fix:按HEAD面重封根护栏清单解除部署fail-closed (0d88e87c83)
- 📚 Docs:登记定时任务协议全链路实证与号池探底结论(纯注释零行为变更) (8e02564809)
- 🚀 Feature/Improvement:收编 pivot-rust-loop R25-R54 codex 逆向对齐成果(42 文件) (86e2371993)
- 🔧 Chore/Other:fix desktop: 修正发版通知公告端点与群发请求体 (d1d508ff3e)
- 📚 Docs:nail raccoon/loomy refresh impossibility with asar evidence (a9cffcfb43)
- 📚 Docs:同步README生成块数字对齐合并后HEAD面现算 (70142902c8)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (c4f2e778f4)
- 🔧 Chore/Other:feat desktop: 桌面端发版自动推送更新通知 (5cfe15f103)
- ⚡ Perf:T1回执键改HEAD树面根治push重跑 (3a3743707d)
- 🐞 Fix:号池容量与保活哨兵排除商店号设计性摘除 (781b60fe5b)
- 📚 Docs:同步 README 生成块数字对齐 HEAD 面现算 (522d0e7cf5)
- 🔧 Chore/Other:烘焙 0.1.78 更新源使自动更新生效 (526e952464)
- 🐞 Fix:rls-context连接池无界等待根治——有界reserve与探针豁免 (ab6020bf00)
- 🔧 Chore/Other:追认 f5e903a(并发会话守卫批量同步)的判据面改动 (9477d4c7ef)
- 🐞 Fix:生产邮箱告警风暴根治——provider健康误判与PG抓取超时 (e282199964)
- 🐞 Fix:decrypt ZCode v2 credentials before pool sync (f5e903a5dc)
- 📚 Docs:同步 PG 版本基线并注明已清理旧版备份 (cad620e418)
- 🐞 Fix:根治同名资产撞名导致的发版判红 (8dc030543d)
- 🔧 Chore/Other:追认 94ab78d(scratch 夹具幽灵注册根治)的判据面改动 (4a3af51cee)
- 🐞 Fix:从代码层彻底根治幽灵注册堆积——删 scratch 夹具必先摘 worktree 注册 + 创建端信号兜底 (94ab78da0e)
- 🔧 Chore/Other:追认 6 枚本地待推提交的判据面改动(逐枚具名 + 独立追认钥签发) (ca272a1c66)
- 🐞 Fix:固定 Rust 1.99 根治 Linux 编译失败 (dab7ed0c7a)
- 🐞 Fix:根治 scratch 临时检出堆积——回收器落点闸纳入 scratch 家族 (1dd8ae6a0c)
- 🐞 Fix:豆包网页加号收尾——跨语言锚点消除 dead_code 警告 + 入池载荷单测 + 修号池 checkin mock 回归 (21195e2631)
- 🔧 Chore/Other:Linux 构建失败时重跑并回传真实错误 (eb54839e62)
- 🐞 Fix:Verify 期望表去掉 msi(tauri.conf 从未声明该 target) (f89aa45381)
- 🔧 Chore/Other:撤销守门 44 白名单里的两枚一次性探针登记 (d46aa9d385)
- 🔧 Chore/Other:补 createBlacklist 假黑名单 mock 修复13项401腐化 (94f195b1a2)
- 🔧 Chore/Other:一次性验证脚本归入既有调试产物族 (423a86e96d)
- 🐞 Fix:头行分组正文与域入口搜索框的左内边距改取档内值(守门 302p) (f67bc1c028)
- 🐞 Fix:libfuse2 兼容 Ubuntu 24.04 改名(libfuse2t64) (72f5057d55)
- 🐞 Fix:signature-gate 分区归因,不再把下载故障误报成未签名 (661014a73f)
- 🐞 Fix:Linux 补齐 tauri v2 官方依赖 + 恢复三目标打包 (95e740f868)
- 🐞 Fix:去掉 tauri-action 容错 + Verify 按平台逐目标断言(机主拍板根治) (a4b90246a2)
- 🐞 Fix:补齐 22 个文件的溯源水印欠账(推送门 47p 清偿) (28ebf191fb)
- 🐞 Fix:削 HEAD service.ts 函数体里重复的 importAccounts 签名(2c00a 旁路拼接 bug) (91ebd2577b)
- 🐞 Fix:Linux 先只打 deb,探明零产物的真实瓶颈 (37b093c535)
- 🔧 Chore/Other:钉死网页登录加号 JS 侧判据(配套 2c00a 已落 web-login.mjs) (8e2a304e2f)
- 📚 Docs:更正 check-service-inventory 派发面描述(守护巡检早已接线) (303e51f52e)
- 🐞 Fix:Linux 补齐 rpm/file/libfuse2 打包依赖 (aee67209e4)
- 🐞 Fix:补回「豆包网页加号」旁路落地时合成器吞掉的 lib.rs 两行 (0caf6943b9)
- 🔧 Chore/Other:服务快照回归本机实测(2→28 枚/nssm 在位/repoRoot D:) (ebc1d52236)
- 🚀 Feature/Improvement:号池「豆包网页加号」——桌面内嵌浏览器登录,手机号页内只填一次 (3502f975f9)
- 🚀 Feature/Improvement:任务全链路打通 + 号池命名「手机号优先」同步侧 (bc65c0ecf9)
- 🐞 Fix:Windows 的 beforeBuildCommand 依赖改用 pnpm 安装 (fcb7c60494)
- 🚀 Feature/Improvement:豆包加号手机号自动获取——上游直取+掩码唯一归位+签到副本升级 (2c00a0449e)
- 🐞 Fix:桌面端未签名发版可在 push-tag 自动生效 + 修 beforeBuildCommand 平台依赖 (a8e9dc1169)
- 🐞 Fix:run-as-user.ps1 补 -KillPids 跨会话终止腿，修一键切号回滚 (e2e5e109c2)
- 📚 Docs:刷新 README trackedFiles/testFiles 数字块(合并带入新文件后对账) (165836082f)
- 📚 Docs:同步勾结清 43D/DB-35(对侧实修落地,本侧同步消除收敛冲突根因) (5b63c7710d)
- 🐞 Fix:折叠头行统一单层 code 实色底,悬停改低对比描边 (a959f984d7)

**2026-11-16**
- 🚀 Feature/Improvement:desktop 未签名发版开关(allow_unsigned) + 修 npm 构建 tauri 子命令 (31bd368f8e)
- 📚 Docs:DB-35 方案② 定案并实修落地(勾结清 PROJECT_PLAN 行) (e792af6c65)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (96dfd17245)
- 🐞 Fix:DB-35 方案② phone/email 加密存储+盲索引 (31f633d764)
- 📚 Docs:deploy-feedback 自动登记(deploy_outcome;端到端反馈闭环第二切片,O65 自进化系列) (750f58a617)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (74d2185616)
- 📚 Docs:刷新 README trackedFiles 数字块 22411→22413(发版新增2个桌面端权限toml) (984a5a3970)
- 🔧 Chore/Other:全量同步工作区(并发会话遗留改动 + 入库前验证修复) (7509f488a5)
- 🐞 Fix:DB-35 方案② phone/email 加密存储+盲索引 (47f886aa41)
- 🐞 Fix:修复 ja/ko 71 个标题词条被错误替换的文案 (7c7763c342)
- 🚀 Feature/Improvement:任务标题实时更新闭环 + 财务页就地发起 (2b72f544bd)
- 🐞 Fix:补齐 ChatMode 手动入口移除的消费端(修复 HEAD 类型不一致) (072f6c9731)
- 🐞 Fix:补 nav 命名空间 6 个缺失词条(域页/管理导航会显示原始 key) (9e00001c60)
- 📚 Docs:沉淀 2026-11-16 部署两坑 —— ai-service venv 缺失 + /api/* 池累积 (7f4796b153)
- 📚 Docs:刷新 README 生成数字块(trackedFiles 22410=>22411) (d551b2d73e)
- 🐞 Fix:补 nav.financeGroup 五语言词条(侧栏财务分组词条缺失) (793418a436)
- 🔧 Chore/Other:floating-layer-spec 补齐溯源水印横幅 (417f568196)
- 🐞 Fix:域收敛后的选中态/收藏面板/域归属补齐(深度审计二批) (acc084a850)
- 🐞 Fix:补 floating-layer-spec —— 修 web 生产构建 module-not-found (bbbc1db941)
- 🐞 Fix:侧栏收藏/高亮/命令入口收口;补图片生成命令 (a2719fbefb)
- 🐞 Fix:管理入口去掉多余折叠层级,改为直达 /domains/admin (7e6e443bf0)
- 🐞 Fix:/metrics 与 /business-metrics 补免租户 —— Prometheus 抓取面收口 (cfa48e273c)
- 🚀 Feature/Improvement:管理域单入口/侧栏折叠收口;打通孤儿页入口 (f2c8e15cb1)
- 🐞 Fix:收口工作区本地/云端链路（浏览器句柄持久化 + 同名目录隔离 + diff 本地落盘） (f91409eb33)
- 🔧 Chore/Other:修 question-sheet 测试 harness 的 exhaustive-deps warning (ee18c27471)
- 🐞 Fix:收口工作区本地/云端链路（浏览器句柄持久化 + 同名目录隔离 + diff 本地落盘） (7d27e3843d)
- 🔧 Chore/Other:追认两枚推送区间枚触及受保护面的合法改动 (4455e5a29c)
- 🐞 Fix:补回被旧底稿同步误删的三条实现,并把 F-647 拧进判死闸门版 (d77b7788b2)
- 🐞 Fix:流式输出跨端全量修复——JSON代码块/工具调用/思考块/平滑delta + prompt cache计费透传 (d0e1399843)
- 📚 Docs:生成块 dbTables 650→651 对齐现算 (5eb6c610ce)
- 🐞 Fix:恢复被全量同步误退的号池判死闸门实现 (d669b47ab1)
- 🐞 Fix:恢复被全量同步误退的号池判死闸门 + 补 hr_employee_link_request 表定义 (229b261731)
- 🐞 Fix:四个 Dockerfile 补上 COPY scripts/install-git-hooks.mjs (c5d70ae7fe)
- 🐞 Fix:跨端判据补账 + 号池裸残票准入 + 三域入口页 + 备份 tag 隔离 (04596527a7)
- 🐞 Fix:摘除 commission-queries 里重复的 toSafeAmount 旧副本 (b1c23a9cc2)
- 📚 Docs:刷新 README 生成数字块(trackedFiles 22400⇒22406,唯一写手 sync-readme-numbers) (327785f5c6)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (20c79aa819)
- 🚀 Feature/Improvement:签到腿 7x24 最小常驻例外 + 本机跨池重复清零 + 唯一索引迁移补账 (17fe7f6af4)
- 🐞 Fix:门302p unmapped 清偿——逐屏登记 7 条 web 路由三态判定 (9ee70ea00c)
- 🐞 Fix:补回被批量同步提交删掉的类型声明，修 origin/main 编译必挂 (19339e8579)
- 🔧 Chore/Other:门302p基线合规刷新——unmapped 4→7 / fidelityHosted 247→248 重置为终尖现读值 (0223e83cf1)
- 🐞 Fix:remote-branch-triage 补 ssh.github.com:443 带端口 URL 解析(本机实测 rc=2 型),slugFromUrl 纯函数化+四形态镜像测试钉形 (17692f757b)
- 📚 Docs:登记缺陷普查任务批次 DB-35 + API F-84…F-726（P1/P2/P3），证据指针 docs/tickets/2026-11/findings-{db,api}.md (3f30a607c1)
- 🐞 Fix:AI对话流式输出前后端跨端Bug全量修复 + 流式渲染优化 + G段对标取证 (fea4155e74)
- 📚 Docs:缺陷深扫扩至 Y-83~Y-96,新增第五批 Y-92~Y-96(5 P2) (4d134e4ab5)
- 🔧 Chore/Other:按 HEAD 面重生成四端 ui-routes 与离线语言包产物 (71084ed4b1)
- 📚 Docs:刷新 README 生成数字块(trackedFiles 22410=>22411) (d551b2d73ed)
- 🔧 Chore/Other:floating-layer-spec 补齐溯源水印横幅 (417f5681968)
- 🐞 Fix:补 floating-layer-spec —— 修 web 生产构建 module-not-found (bbbc1db941c)
- 🐞 Fix:/metrics 与 /business-metrics 补免租户 —— Prometheus 抓取面收口 (cfa48e273cc)
- 🐞 Fix:收口工作区本地/云端链路（浏览器句柄持久化 + 同名目录隔离 + diff 本地落盘） (f91409eb339)
- 🔧 Chore/Other:修 question-sheet 测试 harness 的 exhaustive-deps warning (ee18c274719)
- 🔧 Chore/Other:追认两枚推送区间枚触及受保护面的合法改动 (4455e5a29c8)
- 🐞 Fix:补回被旧底稿同步误删的三条实现,并把 F-647 拧进判死闸门版 (d77b7788b28)
- 🐞 Fix:流式输出跨端全量修复——JSON代码块/工具调用/思考块/平滑delta + prompt cache计费透传 (d0e13998433)
- 📚 Docs:生成块 dbTables 650→651 对齐现算 (5eb6c610ced)
- 🐞 Fix:恢复被全量同步误退的号池判死闸门实现 (d669b47ab1d)
- 🐞 Fix:恢复被全量同步误退的号池判死闸门 + 补 hr_employee_link_request 表定义 (229b2617316)
- 🐞 Fix:四个 Dockerfile 补上 COPY scripts/install-git-hooks.mjs (c5d70ae7fec)
- 🐞 Fix:跨端判据补账 + 号池裸残票准入 + 三域入口页 + 备份 tag 隔离 (04596527a7e)
- 🐞 Fix:摘除 commission-queries 里重复的 toSafeAmount 旧副本 (b1c23a9cc2b)
- 📚 Docs:刷新 README 生成数字块(trackedFiles 22400⇒22406,唯一写手 sync-readme-numbers) (327785f5c61)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (20c79aa8190)
- 🚀 Feature/Improvement:签到腿 7x24 最小常驻例外 + 本机跨池重复清零 + 唯一索引迁移补账 (17fe7f6af46)
- 🐞 Fix:门302p unmapped 清偿——逐屏登记 7 条 web 路由三态判定 (9ee70ea00c1)
- 🐞 Fix:补回被批量同步提交删掉的类型声明，修 origin/main 编译必挂 (19339e85795)
- 🔧 Chore/Other:门302p基线合规刷新——unmapped 4→7 / fidelityHosted 247→248 重置为终尖现读值 (0223e83cf19)
- 🐞 Fix:remote-branch-triage 补 ssh.github.com:443 带端口 URL 解析(本机实测 rc=2 型),slugFromUrl 纯函数化+四形态镜像测试钉形 (17692f757b7)
- 📚 Docs:登记缺陷普查任务批次 DB-35 + API F-84…F-726（P1/P2/P3），证据指针 docs/tickets/2026-11/findings-{db,api}.md (3f30a607c17)
- 📚 Docs:刷新生成块数字对齐 HEAD 面现算 (testFiles 5632→5672 / trackedFiles 22289→22393) (35e69d40642)
- 🐞 Fix:AI对话流式输出前后端跨端Bug全量修复 + 流式渲染优化 + G段对标取证 (fea4155e749)
- 🚀 Feature/Improvement:CUA 桌面环境快照(系统性能/进程表/浏览器状态)纯逻辑层 (072937f6c11)
- 🔧 Chore/Other:子功能模块页美化落地(CategoryShell 重做 × workspace-tokens 共享令牌)—— 他席 reset 覆盖后按本席上下文重建 (56772bcf61e)
- 🚀 Feature/Improvement:visibility 补 H5 意图细分(导航不需可见 vs 展示才可见) (b6d2d5207b2)
- 🚀 Feature/Improvement:CUA 浏览器可见性能力 + CUA 能力面自描述目录 (0a04ab578ad)
- 🐞 Fix:check-miniapp-generated restore 改用 atomicWriteFileSync,治 Windows 文件锁 EBUSY/UNKNOWN 致钩子崩溃 (c366f33072e)
- 🔧 Chore/Other:摘除回潮的 RP-74/Y-26/Y-27/S-26 —— 四条已由 dbd1df5e44 正式结清(实修 ca4b71b97a/2a769677b5/git-sync-converge 均在HEAD,workflow-card 源码零引用),后被并发回捞件误带回账面;代码+提交史为硬证据 (c96dea18214)
- 🚀 Feature/Improvement:设备信任根(TPM 硬件密钥)纯逻辑层模块 (f768b5d11c2)
- 📚 Docs:ai-side-panel 注释同步去描边口径 — 仅投影,无描边 (d41289f1753)
- 🔧 Chore/Other:摘除回潮的 DB-35 工单行 —— 凭据加密切片(002ade40cc)+PII加密切片+17例回归锁(2d3c28cc82)均已在HEAD,224c97e121 已正式结清过一次,后被并发回捞件误带回账面;代码+提交史为硬证据 (b898e4d0186)
- 🔧 Chore/Other:批量摘除回潮的 78 行缺陷普查工单(F-157…F-726,不含 F-298/301/303 已在上一轮单摘) —— 每条实修代码均已在 HEAD(各批次 fix(api) 提交 + F-371 order-entitlement-revoke.ts + F-536/540/574/662 实修 db21c929c66+回归锁 5120189d797),先前已由对应 chore(plan): 结清批次 正式结清,后被并发回捞件误带回账面;代码+提交史为硬证据 (c990fb22d70)
- 🚀 Feature/Improvement:CDP 事件游标分页 + origin 限定 + 命令白名单纯逻辑模块 (318f4aeb4d1)
- 🚀 Feature/Improvement:WFP 隔离拓扑纯逻辑层模块(含 R11 实测更正) (1acad723fd9)
- 🚀 Feature/Improvement:服务生命周期编排三件套纯逻辑模块 (566506c8c91)
- 🚀 Feature/Improvement:多类型分级凭据脱敏纯函数模块 (0f0156934e6)
- 🚀 Feature/Improvement:workspace 变更解析纯函数模块 (bb8c94d8031)
- 🚀 Feature/Improvement:保活复活通知腿——号退出喊人集合必有一封 info (38d24cb6bd3)
- 🔧 Chore/Other:摘除回潮的缺陷普查 8 行(F-84/150/193/194/204/222/232/278) —— 代码均在 HEAD(批次53=84e5c20d6e、批次54=0dafbf2e7a、F-150 回归锁 a5e16d9833),dee8319e 已正式结清过一次,后被并发回捞件误带回账面 (bfa4c76f52a)
- 🔧 Chore/Other:摘除回潮的 F-214 工单行 —— 代码形状闸+回归锁已在 HEAD(dee8319e 已正式结清过一次,后被并发回捞件误带回账面) (a01814b1cc3)
- 🐞 Fix:壳侧恢复 barrel import(门 128 承载体可判) + 具名追认 2 枚存量红 (f7ec45f19e9)
- 🐞 Fix:iOS 下载底稿自足 + 五语安装指南同步, 修复侧栏 iOS App 置灰 (c6d5e274a01)
- 📚 Docs:缺陷深扫扩至 Y-83~Y-96,新增第五批 Y-92~Y-96(5 P2) (4d134e4ab53)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (c32fcb911c7)
- 🔧 Chore/Other:收拢并发会话工作树改动(i18n 派生产物 + 前端页面 + PROJECT_PLAN 维护) (bda545a56e0)
- 🔧 Chore/Other:刷新 README 生成块数字(门 DN2 现算对账) (aa42203e31c)
- 🚀 Feature/Improvement:browserAuth 提交诊断完整遥测 — 复现 Codex submission_diagnostics (52fd2615a6f)
- 📚 Docs:登记 README 补切号功能句(RP族自动取号;等 README.md 他席在飞解占,出处枚 f876894a30053c26815621cbffab830846c2c917) (349cbaf0148)
- 🚀 Feature/Improvement:浏览器确认卫生(怎么问/何时问/问几次) — 复现 Codex A.4 (f5f6d50b3e9)
- 🔧 Chore/Other:按 HEAD 面重生成四端 ui-routes 与离线语言包产物 (71084ed4b10)
- 🚀 Feature/Improvement:新增 api 看门狗,自动重启半死进程 (6c174f96f6e)
- 🔧 Chore/Other:收拢并发会话工作区改动（README 自动更新块 + 三语同步） (384c9d790b2)
- 🔧 Chore/Other:精准重放本地独有成果(4 文件)+同步 README 生成块 (eeb2da02236)
- 🚀 Feature/Improvement:浏览器三级交互 API 优先级仲裁(复现 Codex 三级交互原语) (f3216c036cd)
- 🐞 Fix:跨会话强杀腿 + 验收窗口 + Windows 中文乱码 (79efa223c85)
- 🐞 Fix:排版令牌对齐 —— 定价管控台 heading/label 字号档 + ProfileScreen avatarText 走 rnType.displayXl (5a4f007eda7)

**2026-11-15**
- 🐞 Fix:恢复被 69ce958a9b2 误删的不可逆判死码清单;旁路删除硬门射程补入 config/ (4737158ee9)
- 🔧 Chore/Other:fix desktop: 内置浏览器一窗多标签,修 WebView2 profile 冲突致标签全空 (cf373610a1)
- 🐞 Fix:createXhrTransport 预取消令牌 TDZ，对齐 multipart-download 收口 (d831a31dda)
- ⚡ Perf:流式输出渲染优化 —— stable 引用稳定化 + reasoning 前缀节 memo 化 (c7c68b091c)
- 🔧 Chore/Other:清偿 Y-81 server-currency 汇率双形态判据 (7659deacbd)
- 🐞 Fix:商店登录态三处丢失路径收口 —— 只补缺不覆盖, 会话票转持久, 关窗先续后关 (033d69ba6e)
- 🚀 Feature/Improvement:浏览器文件/下载交付卫生(复现 Codex cloud-shared-files) (936660ec98e)
- 🚀 Feature/Improvement:浏览器登录凭据 handoff 协议(复现 Codex browserAuth,凭据零回传) (ebe217ca684)
- 🚀 Feature/Improvement:浏览器 Tab 生命周期与所有权协议(复现 Codex tab lifecycle) (4b003bf987e)
- 🔧 Chore/Other:收拢本地工作区改动(全量提交 9 项)+撤回 4 条失效有意删除登记 (32c35c4c2de)
- 🔧 Chore/Other:刷新 README 生成块数字(推送前文档数字对账门要求) (d12472a8288)
- 🚀 Feature/Improvement:改状态动作截图内嵌交付闸(复现 Codex proof-of-work) (510db7e15d6)
- 🚀 Feature/Improvement:浏览器改动可回滚审计账(复现 Codex management.getAuditTrail()) (f5d07dfff07)
- 🐞 Fix:恢复被 69ce958a9b2 误删的不可逆判死码清单;旁路删除硬门射程补入 config/ (4737158ee96)
- 📚 Docs:刷新 README「最近更新」生成块 + 补门 320 R4 点名缺口 + last-sha 指针 (d30402dbc2b)
- 🚀 Feature/Improvement:浏览器反爬/挑战拦截结构化上报(复现 Codex botDetection) (02f0bf86479)
- 🔧 Chore/Other:补 4 个文件的溯源水印(push 门 47p 点名缺口,水印行由门自注入) (085e3732c1c)
- 📚 Docs:同步 README 三语「最近更新」块（补 11-15 文档刷新条目） (f4ce41abc5e)
- 🚀 Feature/Improvement:门324 import完整性 + 视频详情薄壳化 + toast token 源恢复 (3b353f87aed)
- 🚀 Feature/Improvement:浏览器能力自描述注册表(复现 Codex capabilities.list()) (b65cc53d91a)
- 📚 Docs:刷新 README 生成块数字 + 裁剪「最近更新」块到最近一条 (b087f51dcd6)
- 🚀 Feature/Improvement:浏览器交互参数边界 + 对话框一等 API(复现 Codex CUA) (b95b458849b)
- 🚀 Feature/Improvement:ElementInfo 统一元素定位快照(复现 Codex CUA ElementInfo) (96e37c8aa89)
- 🔧 Chore/Other:补 push scope 内 7 文件溯源水印 + post-commit 自动更新登记 (f1297755397)
- 🚀 Feature/Improvement:浏览器动作确认分级(复现 Codex Agent Confirmations Policy) (a3ead0dfd15)
- 🚀 Feature/Improvement:引擎模式本地/云端切换 —— agent流+工具链+浏览器CSP接线 (c91925d3985)
- 🚀 Feature/Improvement:号池管理页一键安装桌面切号快捷方式(前后端) (f876894a300)
- 🐞 Fix:补齐 T1 typecheck 门反复失败的 4 处缺失导出 + 消合面冲突 (23018cf5964)
- 🐞 Fix:侧栏分类收口(热门/管理可折叠,管理默认折叠)与 AI 浮窗取消描边 —— 侧栏对外仅保留热门/管理标题:热门主题红且默认展开、管理默认折叠(偏好仍由 localStorage 记忆),展开内容右缩进 8px,非折叠分组不再渲染标题,折叠可访问性测试夹具由 aiGroupLabel 换为 hotGroupLabel;浮窗 .ai-float-glow 移除 1px border,仅保留 --shadow-elevation-xl 投影。 (ffa37ce45b4)
- 🚀 Feature/Improvement:egress 沙箱补 BLOCKED 离线短路(R11 复现 Codex SandboxNetworkMode) (4841b764f1b)
- 🚀 Feature/Improvement:代码执行沙箱补 offline 网络禁令(准入层先拒) (899e6d84f83)
- 🔧 Chore/Other:按终尖现读全维刷新 302p 漂移基线,9 维变化逐维举证非本批引入 (38fc5989697)
- 🔧 Chore/Other:登记 pkg-hr/hr-attendance/index 为 intentional copy(pure-copy,共享屏 packages/app HrAttendanceScreen) (50ae2ba54f9)
- 🐞 Fix:退款主动/回调路径补 F-09 并发抢占闸门 (6b1a4b539b4)
- 🐞 Fix:恢复被 69ce958a9b2 全量同步误删的 25 个文件 (314bd4d5fe5)
- 🔧 Chore/Other:Merge origin/main: 行尾归一化+小程序RN前端修复落库 (bda89c77c08)
- 🚀 Feature/Improvement:逆向能力目录 34→37 条 + 复现沙箱失败归因/插件 vm 沙箱两模块 (ee4564963a9)
- 🐞 Fix:一键切号快捷方式图标改用项目桌面端 icon.ico (7a1161f1213)
- 🔧 Chore/Other:fix desktop: 内置浏览器一窗多标签,修 WebView2 profile 冲突致标签全空 (cf373610a13)
- 🐞 Fix:createXhrTransport 预取消令牌 TDZ，对齐 multipart-download 收口 (d831a31ddac)
- ⚡ Perf:流式输出渲染优化 —— stable 引用稳定化 + reasoning 前缀节 memo 化 (c7c68b091c6)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (510e4291b5b)
- 🐞 Fix:输入框清空按钮加卡片底色、字数统计贴住第三行末尾 (328b8dec13d)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (849cb17cc1e)
- 🔧 Chore/Other:清偿 Y-81 server-currency 汇率双形态判据 (7659deacbd3)
- 🐞 Fix:收敛前序治理批次(i18n 文案拼接/设计令牌/交互与解包加固) (1632762bf49)
- 🐞 Fix:API 层全量路径段补 encodeURIComponent(对齐 api-client 惯例) (b2ec9922eb4)
- 🐞 Fix:修复 API 层路径编码缺失与响应解包空判 (b4057d9e5df)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (8ee1f8d48ef)
- 🐞 Fix:商店登录态三处丢失路径收口 —— 只补缺不覆盖, 会话票转持久, 关窗先续后关 (033d69ba6e5)
- 🐞 Fix:修跨端交互/逻辑缺陷——pay applyCoupon 补 in-flight 守卫防并发改价、AppUpdateBanner 裸 setTimeout 补 cleanup 治卸载闪没、TagInput 可删列表改按 tag 值作 key 解耦下标、user 历史静默 catch 补失败 toast;ui-routes.generated.ts 按当前输入重生成对齐 (a3df780e706)
- 📚 Docs:README 派生区按 fcee207727 新 HEAD 重算(钩子自动补登最近更新条目) (2b21dab8d82)
- 🐞 Fix:README.en 最近更新区真合并 HEAD/origin 条目清冲突标记(门79);.gitignore 忽略会话一次性中间产物(治门44 未判定) (fcee2077273)
- 🐞 Fix:face-reader worktreeHashObjectBatch 去 -z,修 unknown switch z 取材失败 (329dfd7b567)
- 🐞 Fix:ancestor-downgrade 批量 HEAD blob,治门298 工作树臂第二腿 fork 风暴 (757e8748c2a)
- 🐞 Fix:face-reader 批量工作树 hash 原语,治门298 工作树臂 fork 风暴超时 (1c8c684ae57)
- 🐞 Fix:门298 提前判合法回滚声明,防工作树脏文件祖先比对超时 (c566663e2d7)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (0048ce2254b)
- 🔧 Chore/Other:门IG 追认 71c7d304c1 入库 + 门89 撞号修复(320→323) + 门322 判面层配套 + root-guard 重封 + 门89 判据取面收口 (2f95c46397b)
- 🐞 Fix:圈子页下拉刷新失效(T-03 P1) (4f3161aac0f)
- 🐞 Fix:pkg-ai 主 CTA 走 bg-cta+text-cta-foreground 同源对(T-16 P1) (4d322dc3d2e)
- 🐞 Fix:提现确认按钮防连点(T-20 P1 资金操作) (95c95fc42e9)
- 🐞 Fix:PlazaScreen 正文色去墨档系(T-19 P1) (a00bfb7dab9)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (8081911764f)
- 🐞 Fix:task-status-bar 激活态描边去墨档(T-15 P0 铁律违规) (86981bcff88)
- 🐞 Fix:useTaskReceiver register/answerApproval 包 try/catch 收敛 5xx/网络异常(T-02 P0) (8e0c889bf4c)
- 🐞 Fix:实名验证弹层补关闭途径(T-01 P0) (4ce181f7542)
- 🔧 Chore/Other:解合面冲突(PROJECT_PLAN RP-80/RP-4 union + AGENTS 门名清单 union) (71c7d304c11)
- 🔧 Chore/Other:刷新 302p 跨端漂移基线(推送尖现读,两维恶化留档) (8835130fe3d)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (4f8f58ccda9)
- 🐞 Fix:解 stash pop 格式冲突(RN) + README 超集落地清标记 (669cfb91cf7)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (bfe80e6b01b)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (47b2db1f354)
- 🐞 Fix:手势/触摸冲突 5 处修复 (11cc70a2a0c)
- 🔧 Chore/Other:Carousel geometry 额度 2→3 对齐 HEAD 现值 (de8dbcd5b6a)
- 🐞 Fix:check-line-endings git 派生补显式 stdio(治门193 blocking) (2b53a1b1cfc)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (3f8ec5adefb)
- 🐞 Fix:RN 色值对齐 web 源 + design-tokens dist 重建闸门 (619cc1253a1)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (56d8dae2a71)
- 🐞 Fix:深度扫描第二批收口 RN/小程序端样式、交互与逻辑缺陷 (97b7a7ac968)
- 🐞 Fix:门302 rendersSharedIn 认深子路径导入(补正/反例测试);接线 check-line-endings/check-mirror-surface-parity 判面层(门312 R1);rn-miniapp 矩阵文档重生成为现值(镜像257→258,门302修复后真实现读) (ab211603b9c)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (62368b7976c)

**2026-11-14**
- 🐞 Fix:两端 JSX 裸中文清零 + Taro 静默失败兜底 + 延迟导航定时器清理 (9f5d9041c97)
- 🐞 Fix:深度扫描修复 RN/小程序端样式、交互与逻辑缺陷 (4a007dfecd8)
- 🐞 Fix:补齐 RN/Taro 图标按钮无障碍语义标签 (247c8da4800)
- 🐞 Fix:修复前端遗留问题——RN/Taro 冲突、i18n 源文件还原、promise、定时器 (b276b219572)
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
