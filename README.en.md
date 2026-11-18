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
| 测试文件 | 5832 | `testFiles` |
| CI 工作流 | 59 | `ciWorkflows` |
| Compose 服务 | 14 | `composeServices` |
| 工程守门 | 368 | `guardianGates` |
| — blocking | 338 | `guardianBlocking` |
| — warn | 32 | `guardianWarn` |
| 跟踪文件 | 22781 | `trackedFiles` |

上表由 `node scripts/sync-readme-numbers.mjs`(唯一写入口,索引面取数)生成,最后核对日期 2026-11-18。
每个数的来源就写在取数键旁边的实现里(`scripts/gen-doc-numbers.mjs` 的 `SOURCES`),**不得手抄、不得另立第二份**。

<!-- END GENERATED NUMBERS -->


## Recent updates (auto-maintained)

<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->
**2026-11-17**
- 🐞 Fix:修复 relay 语法阻断 + nav-data 重复声明 + 补登两条孤儿迁移 (64fe054900)
- 🐞 Fix:nav-data 删除末尾重复的 ADMIN_HUB_ITEMS/DEVELOPER_HUB_ITEMS/HR_HUB_ITEMS 定义(Turbopack 'defined multiple times'+ADDR,web 构建 collect page data 失败) (020fe2ef9e)
- 🔧 Chore/Other:同批重封根护栏清单(git-guardian hashTarget 跟随 f1f0640929) (6dc26aae25)
- 🐞 Fix:漂移对齐每轮采样默认 8→40,让旧代副本积压一轮消化 (f1f0640929)

**2026-11-17**
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

**2026-11-15**
- 🐞 Fix:恢复被 69ce958a9b2 误删的不可逆判死码清单;旁路删除硬门射程补入 config/ (4737158ee9)
- 🔧 Chore/Other:fix desktop: 内置浏览器一窗多标签,修 WebView2 profile 冲突致标签全空 (cf373610a1)
- 🐞 Fix:createXhrTransport 预取消令牌 TDZ，对齐 multipart-download 收口 (d831a31dda)
- ⚡ Perf:流式输出渲染优化 —— stable 引用稳定化 + reasoning 前缀节 memo 化 (c7c68b091c)
- 🔧 Chore/Other:清偿 Y-81 server-currency 汇率双形态判据 (7659deacbd)
- 🐞 Fix:商店登录态三处丢失路径收口 —— 只补缺不覆盖, 会话票转持久, 关窗先续后关 (033d69ba6e)

**2026-11-16**
- 📚 Docs:刷新 README 生成数字块(trackedFiles 22410=>22411) (d551b2d73ed)

**2026-11-16**
- 🔧 Chore/Other:floating-layer-spec 补齐溯源水印横幅 (417f5681968)

**2026-11-16**
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

**2026-11-14**
- 🐞 Fix:design-token 对比度语义档迁移(brandAccent/danger/success/warning) (35d8ab967e)

**2026-11-14**
- 🐞 Fix:audit-app-text-contrast TDZ 修复 + repl pendingQuestionRef 提升模块级 (56780a1d7f)
- 🚀 Feature/Improvement:门320 接线 guardian-runner + RP-80 基线盲区清账票 (f81673f27d)
- 🔧 Chore/Other:补齐溯源水印覆盖 + audit-app-text-contrast 同族配对 (fd8cb9c30a)
- 🐞 Fix:审计修掉 skill-evolution 提议 id 遮蔽漏洞 + 补 id 唯一性守卫 (0a1b814614)
- 🐞 Fix:F-274 补齐 SELECT_CHAIN_TAIL_SQL —— 链尾按"链上叶"取，非按最新行取 (390537c970)
- 🚀 Feature/Improvement:新增 3 个未跟踪文件 (da1823aa1d)
- 🚀 Feature/Improvement:逆向 Qoder 6 子系统——判定可落地性(补 4 块技能进化前提基建 + 审计/修订/墓碑层) (3458dca803)
- 🔧 Chore/Other:收尾提交 plan-heal/tag-sync 副产物 (f05491e678)
- 🚀 Feature/Improvement:以 ai_pricing 权威价回填配置零价行 (476127d306)
- 🔧 Chore/Other:收拢本地工作区改动(全量提交) (1be9d1e2c7)
- 🐞 Fix:诊断臂 [7b] DB 迁移落后维从未真判过——函数注册晚于 -diagnose 顶层执行点(第三次落地,范围收窄) (c4be376fd5)
- 🐞 Fix:零价护栏豁免上游真免费模型(:free) (88cfcfeba1)
- 🚀 Feature/Improvement:工作区指令链补齐服务端腿 —— CLAUDE.md/本地叠加 + 轮内深层发现 (a5c6090a05)
- 🚀 Feature/Improvement:补齐 check-plan-claims-vs-head 门——批量预取治本 6.5min→15s + §1021 --self-test (99060ab1ee)
- 🐞 Fix:流式打字机切批升到字素簇边界 —— ZWJ/肤色/旗帜 emoji 不再拆裂(D1b) (a143634115)
- 🔧 Chore/Other:重封根护栏清单(git-guardian 变更后漂移) (ad06d9d1f8)
- 🚀 Feature/Improvement:present_files 显式交付声明 + 交付清单 presentedFiles (904e129c14)
- 🔧 Chore/Other:重封根护栏清单(merge round2 后 gate-scope 漂移) (4b0fc5a3e6)
- 🐞 Fix:补两处契约缺口——SendAdmissionReceipt.ahead 与 ProcessGroupChild.kill 签名 (0dc7a15623)
- 📚 Docs:同步生成块计数(经用户明确授权跳过钩子) (c466bece0a)
- 🚀 Feature/Improvement:per-tool timeout budgets + NO_PROXY routing (5th DSH pass) (41d9096328)
- 🐞 Fix:零价巡检改用采购成本量化损失 (b5a8e3967a)
- 🚀 Feature/Improvement:零价上架护栏 + 每日零价巡检 (5b7e639654)
- 🚀 Feature/Improvement:逆向 DSH 审计第三/四遍补齐(导出保真/中断语义/Office 转换) (f2b2cec5da)
- 🐞 Fix:G-20261114 chat-sync 三端（taro/RN/extension）接线 + 回归锁 (41548e0716)
- 🐞 Fix:G-20261114 chat-sync 共享内核与 web 端接线 + 契约文档 (450c939404)
- 🐞 Fix:G-20261114 多端 chat-sync 流式坐标系统一与终态投影（api 端） (5bc4e1c3d4)
- 📚 Docs:补登 check-findings-freshness 守门点名，清门 89 R4 (c791a93bb9)
- 📚 Docs:同步生成块计数 (f83626fbf1)
- 🐞 Fix:F-187 api_base SSRF 非字符串地址 fail-closed 并恢复 T1 判据面 (d61938ace0)
- 🐞 Fix:盘根外流根治复诊 —— 修合规闸的大小写假阴 + 补回归锁 (2ee1847a94)
- 🚀 Feature/Improvement:错误卡目录化上收 shared + 三端接线(D-AI-3) (c5a2c24a25)
- 🐞 Fix:修正 299/302p 两道门的历史误判(非新增漂移) (a5b35cb15f)
- 🐞 Fix:F-34 多模态任务失败退款耐久化(补齐实现,对齐已提交测试) (6aab7e619a)
- 🐞 Fix:DB-35 PII 写库加密切片(发票抬头+后台实名 idCard 旁路) (2d3c28cc82)
- 🚀 Feature/Improvement:新增 3 个 drizzle 迁移 —— news 去重唯一索引 / 客服状态枚举对齐 / coze 变量唯一索引 (8a64f3e4a2)
- 🐞 Fix:DB-35 凭据写库加密切片(无迁移) (002ade40cc)
- 🔧 Chore/Other:对账结清 F-274/F-175(均已在 HEAD 修复) (0f1180807c)
- 🔧 Chore/Other:结清 F-719(充值双币种入账,a6ae85b0c25/cce4625f58a,39 passed) (0bfaa1d848)
- 🐞 Fix:兑换码充值同步入账 cost 余额 (a6ae85b0c2)
- 🔧 Chore/Other:结清 Y-14(前提不成立:安卓 latest 已回 0.0.24) (17c111ccf4)
- 🔧 Chore/Other:RP-16 阻塞留痕 + 认领 Y-14(安卓更新包接口空返回) (67e95c546a)
- 🔧 Chore/Other:认领 RP-16(考勤 IM 三类审批枚举映射) (a62cd5225c)
- 🔧 Chore/Other:对账结清 12 张已在 HEAD 修复的缺陷普查行 (a9e8f3f9bd)
- 🐞 Fix:单边 token 充值同步入账 cost 余额 (cce4625f58)
- 🔧 Chore/Other:结清 F-512(前提不成立:幂等键已入库;工作树他席回退 risk) (21087e436b)
- 🔧 Chore/Other:认领 F-512(notification-worker 幂等键缺失) (090cd85811)
- 🔧 Chore/Other:结清 F-722(前提不成立:异常结算已入库;工作树他席改动回退风险) (a500442528)
- 🔧 Chore/Other:BUG-29 切片0 阻塞留痕 + 认领 F-722(流式异常跳结算) (a3a3a13347)
- 🔧 Chore/Other:认领 BUG-29(索引约束缺失族,先做切片0) (da6cc97036)
- 🐞 Fix:workbuddy 永久保活不再依赖客户端进程 (a9d2d526aa)
- 🔧 Chore/Other:夹具备份产物目录改名 switch-profiles,避开保护闸 backups 的精确等值 (29d71f9c26)
- 🐞 Fix:根治项目文件盘根外流——scratch 逃生舱合规闸+拔系统盘脏env+盘根卫生增申报目录内容对账与C盘覆盖面 (2a85a5024c)

**2026-11-13**
- 🐞 Fix:E-P1 鉴权失败(401/403)归 content 不走 resume 阶梯 (f841c69006)
- 🔧 Chore/Other:302p 基线定向对账 tierWebOffN 228→229(定价批 pl-7 落账带取证) (888f730da3)
- 🐞 Fix:流式工具参数缓冲上限 + defect 终态 + errorCode 端侧接线 (4759055a3b)
- 🐞 Fix:派发腿级失败不再吃日预算,登录过期告警单独立身份 (11a6ee9fb6)

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
