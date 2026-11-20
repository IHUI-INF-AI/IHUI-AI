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
| 数据库表 | 654 | `dbTables` |
| schema 文件 | 253 | `dbSchemaFiles` |
| API 路由 | 4857 | `apiRoutes` |
| 路由文件 | 714 | `apiRouteFiles` |
| AI 服务路由 | 683 | `aiServiceRoutes` |
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
| 测试文件 | 5921 | `testFiles` |
| CI 工作流 | 59 | `ciWorkflows` |
| Compose 服务 | 14 | `composeServices` |
| 工程守门 | 370 | `guardianGates` |
| — blocking | 339 | `guardianBlocking` |
| — warn | 33 | `guardianWarn` |
| 跟踪文件 | 23040 | `trackedFiles` |

上表由 `node scripts/sync-readme-numbers.mjs`(唯一写入口,索引面取数)生成,最后核对日期 2026-11-20。
每个数的来源就写在取数键旁边的实现里(`scripts/gen-doc-numbers.mjs` 的 `SOURCES`),**不得手抄、不得另立第二份**。

<!-- END GENERATED NUMBERS -->


## Recent updates (auto-maintained)

<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->
**2026-11-20**
- 🐞 Fix:root-guard 清单按并发演进后的 HEAD 面重封(guardian-runner/land-gate-rerun 两条差面) (85e3e10c11)
- ⚡ Perf:push 面按推送改动面收窄 + 定向快通道多 app 循环变量重命名 (7017d9a74a)
- 📚 Docs:README 与工程文档去掉"1h 自动撤销/5s 切换撤销"描述 —— 功能已退役,文档不得再宣称 (9c24b4bf63)
- 📚 Docs:RP-7 外部投递正证已取得并修复 GitHub App webhook 401 回归 (0a198537ab)
- 📚 Docs:生成块数字按 HEAD 面现算对齐(派生值) (e68506d290)
- ⚡ Perf:typecheck 定向快通道放宽到多 app —— 一次 push 带多端改动时不再整批回全量(仍对 scripts/.husky/packages 契约/tsconfig/锁文件回全量);顺手删掉 HEAD 里零引用的 statSizeSafe (ec549b2e34)
- 🐞 Fix:收口三条 CI 红 —— 动效 !important 走门自带行内豁免 / 契约补 manual 端点 / knip 取消内部符号 export (750510c97a)
- 🔧 Chore/Other:结清 5 票(agent 侧已实现完成,完成即删) RP-6 混合陈旧底稿拦闸: R1s 判据已上线(check-stale-revert.mjs analyzeMixedStale + lib/intentional-deletions),mixed 测试 11/11 + 反向变异 A/B 同输入一红一绿,差值棘轮拦新增不误伤存量 RP-79 x2 (F4 同题双行同摘): union-converge 未知旗闸已接线,旗标清单单一真相源(lib/union-converge-flags.mjs)+USAGE 形状锁+转发面全覆盖,arg-guard 13/13 绿,--help 零副作用 RP-80 门320 基线盲区: plan-claims-baseline missing=[] 逐条裁决已清空 + guardian 注册块在 HEAD + 门现读 rc=0/存量 0/新增 0 + self-test/镜像测试绿 Y-14 安卓更新卡: 线上实测 GET /api/app-version/latest?platform=android 返回 status=latest 行(0.0.31/build 26111811/downloadUrl 有效),票面症状已消解 外部阻塞票(Y-58 需生产机执行权+Play Console / RP-7 需 gh 授权 / 其余机主凭据面)不摘,如实保留 (0ee78390ce)
- 🐞 Fix:减动画 !important 四处补行内豁免理由(style-spec 的 no-important 门) (628593563d)
- 🔧 Chore/Other:test(cli)+fix(cli): CI gate-test(6) 残余红的跨平台收口 (864cbf63bc)
- 🔧 Chore/Other:清掉"自动撤销"功能撤除后残留的代码与测试锚点(object-space-land 落地) (9b573b0bad)
- 🔧 Chore/Other:三份 IHUI-GEN-PIN 派生件按当前源头重生成 —— reading-trust 的 D/C 面红收口 (b954e71dbb)
- 🐞 Fix:把 gate-test / lint / mypy / miniapp 五条红逐条修到根因(时区夹具 + POSIX 路径逃逸 + 平台守卫 + 双 React 口径) (a1ff65b0ec)
- 📚 Docs:生成块 dbTables 653→654 / apiRoutes 4856→4857 / testFiles 5917→5919 / trackedFiles 23024→23026(按 HEAD 面现算;数字块是派生值,不是手写行) (68ba3f6edd)
- 🔧 Chore/Other:并入本地已完成的 11 枚提交(web 快捷键面板退役/relay 成本价同步/round11 归档/i18n 死键重删) (4f5611d77f)
- 📚 Docs:dbTables 653->654 对齐现算(合并引入新表) (76d00f09fc)
- 🔧 Chore/Other:重删 16 个"自动撤销"死键 —— 本轮合并为避开合面防丢闸暂时取了远端旧词包,按 83725d7ac86 的结论重新落回(代码零引用,五语言同批) (36f428d1e8)
- 🐞 Fix:摘掉 PROJECT_PLAN 里一行孤立 ======= 冲突残留 —— 它把⑪节切成两段,门12才把"已闭环"与"未实现"读成同段互斥 (4caa6c3726)
- 🐞 Fix:ACP 四个「有实现无注册」的方法接线 + ruff 未用导入清零 (0a33050794)
- 📚 Docs:生成块计数对齐合并后现算(trackedFiles 23027->23026 / apiRouteFiles 715->714) (df01f54b94)
- 🔧 Chore/Other:删掉 historySource.auto-revert 标签(来源枚举已收窄到 4 档) (f1bf787710)
- 🐞 Fix:收窄聊天输入框顶部拖拽手柄高度 h-2(8px) → h-1.5(6px) (8fb3751248)
- 🔧 Chore/Other:棘轮判定面升级为「逐符号清单」—— 只拦新增,存量不再恒红 (3a46a520e6)
- 🔧 Chore/Other:清掉 15 个"自动撤销"死键(chat.permission 内,代码零引用) — 1h 倒计时/5s 撤销/快捷键旧说明全部退役,五语言同批 (83725d7ac8)
- 🚀 Feature/Improvement:relay 模型成本价同步（后端自动更新+按 key 去重） (f38186c74c)
- 📚 Docs:补 R11–R133 编号账 —— 缺号是产物形态不是缺件,五状态逐号可复核 (bab64c621b)
- 🐞 Fix:修 gate-test 分片里 web 侧两条实现回退 —— 交付面板文件行失效 + 被动失效没清私有态 (75bee19bdd)
- 🔧 Chore/Other:死代码棘轮 files 维逐族归因 —— 58 件落档,删 2 件真残留 (93bd931604)
- 🚀 Feature/Improvement:快捷键说明面板去掉"Undo 5s"行(撤销入口已退役,不再教一个不存在的动作) (e546b5f396)
- 🐞 Fix:收回 3 条无人调用的远端授权 + workbuddy 号池重登按 F-060 降 none (0988c55542)

**2026-11-20**
- 🔧 Chore/Other:追认两枚未签名受保护面提交(AGENTS 体积裁剪/land-gate-rerun 面旗)解除本地积压推送阻塞 (6556e29907)
- 🐞 Fix:RP-7 取远端更全形态补回维度拆解注记 (d23c8aba4d)

**2026-11-20**
- 🚀 Feature/Improvement:用户命令钩子配置面(信任闸+并入既有HookRuntime) + 报告§5.22 (94599d460b)
- 🐞 Fix:补齐 SqliteTicketStore 退役漏改的 chat 派工准入用例 (ab409351ab)
- 🔧 Chore/Other:README 生成块对齐远端现值(654/4857/5919/23026) (83b87a787d)
- 🔧 Chore/Other:修 .ihui/mcp.json 失效路径(craft-anything 0.5.0(E盘)→0.6.1(D盘);JAVA_HOME→D:\DevEnv\jdk-21.0.13+9) (b40298be28)
- 📚 Docs:deepseek-tui 原生函数级取证(Ghidra 12.1.4);报告 §2/§3.4/§7 同步 + 原始 xref/func TSV (63f9ef0248)
- 🐞 Fix:补 drizzle-sql-strings 删除意图通知书(knip 引用已摘) (b4ec7bba24)
- 🐞 Fix:摘除 origin/main 已删 drizzle-sql-strings 的陈旧 ignore 条目(0 引用前提) (74df40fd7b)
- 🐞 Fix:为 origin/main 删除的 post-actions.contract.ts 补删除意图通知书 (9bc4ceec32)
- 🐞 Fix:删除 PROJECT_PLAN 合并冲突残留行 =======(无内容损失) (e38fc51927)
- 🐞 Fix:落地复跑补 fullFaceArgs 面旗(门 47 无隐式面,漏读声明会恒报未判定) (143c6504a9)
- 🐞 Fix:check-guardian-leg-health-runner.ps1 补 UTF-8 BOM(守门 265;PowerShell 5.1 无 BOM 会按 ANSI 读中文并断链) (40bd292989)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (4c4c92cbfd)
- 🐞 Fix:漂开副本归并(--merge-drifted,人工点名持有行后 N→1) (a0a0f67760)
- 🐞 Fix:圆角角色档归零 —— control 取 sm、VIP 徽章显式 ui-chip (9128927b32)
- 🐞 Fix:收口被整块重复的登记(F6 块级判据的修复出口) (d21f403419)
- 🐞 Fix:修 gate-test(5) 两条真 bug —— cron 唤醒判据 + 能力登记表超前申报 (ff2fccf4ed)
- ♻️ Refactor:iframe 沙箱档单一真相源(PLUGIN_VIEW_SANDBOX 绑定 ui-react MODEL_CONTENT_SANDBOX, 补入口导出 + 身份断言) (e15797ed72)
- 🐞 Fix:重导 OpenAPI 契约产物(补 34 条已入库路由) + 商店账号补永久保活键 (02c1d4bfeb)
- 🔧 Chore/Other:重新导出 OpenAPI 产物(补 relay admin 34 条路径)+ 记录 DB-09 未判定 (eaf17eec7a)
- 🐞 Fix:修复 auth 两枚新测试的 createBlacklist mock 语法(return 对象内补逗号闭合) (acef08644f)
- 🚀 Feature/Improvement:确认弹窗路径也去掉撤销 toast;文案去掉"5 秒内可撤销"(模式选定即固定,机主定案) (78f1b5e497)
- 📚 Docs:生成块 testFiles/trackedFiles 对齐 HEAD 面现算(5917/23024) (28a67e3817)
- 🐞 Fix:回退小尺寸图标重做 —— 恢复 0.1.80 原图(黑底 IHUI INF)并升版 0.1.82 (cdd582ebda)
- 🐞 Fix:单测族与生产缺陷修复(第二批 50 文件:测试夹具/契约/持久化/沙箱) (4ea55d7cdf)
- 🐞 Fix:real-db 收尾 —— 不再 end 共享连接池 (a56f6659e9)
- 🚀 Feature/Improvement:orchestrate_agents 增 mode=recursive(RLM 整合档的模型面,不新开工具) (4eae336e51)
- 📚 Docs:README 生成块数字对齐 HEAD 面现算(testFiles 5917 / trackedFiles 23024) (26dfb8c542)
- 🐞 Fix:python-ai-service 补建库前置 + ai-service 自建表登记为运行期懒建表 (a1a7e7f127)
- 📚 Docs:trackedFiles 对齐合并后树(23023) (eac98025ea)
- 🐞 Fix:real-db 集成测试存量红灯收敛 (32f62bbaca)
- 🐞 Fix:单测族与生产缺陷修复(第一批 50 文件:鉴权/计费/中转/上传/沙箱/DAG 等) (6edc862fc8)
- 🐞 Fix:python-ai-service 补建库前置 + ai-service 自建表登记为运行期懒建表 (f75ce98feb)
- 🐞 Fix:python-ai-service 补建库前置 + ai-service 自建表登记为运行期懒建表 (7c80df6879)
- 📚 Docs:README 生成块对齐 HEAD 现算值(路由/测试/跟踪文件) (6767bfc2eb)
- 📚 Docs:README 生成块数字对齐 HEAD 面现算(testFiles 5918 / trackedFiles 23025) (f16638797a)
- 📚 Docs:生成数字块对齐当前树(摘除 2 枚废弃文件后 apiRoutes 4856/路由文件 714/testFiles 5916/trackedFiles 23022) (fdd056f8d4)
- 🚀 Feature/Improvement:模式选定即固定 — 去掉切到完全访问后的 5s 撤销 toast(机主定案:撤销/降级只来自用户本人下一次显式切换) (68bfb3ee45)
- 📚 Docs:AI 服务路由现算 683(新增递归端点) (e5ea6be23c)
- 🐞 Fix:摘除已废弃 relay-switch-admin 路由及其旧插件测试(f-519 归零) (94960048b8)
- 📚 Docs:消掉 §11 章节“已闭环”与后续条目并存的互斥措辞(门 12 基线红) (2fae6d9de2)
- 🚀 Feature/Improvement:RLM 递归分解整合进 TeamOrchestrator + 递归端点(+5 例) (6e4a49ddd0)
- ♻️ Refactor:schema 名与 db_path 解耦(换路径不再等于换空库) (c3cfed87c0)
- 🚀 Feature/Improvement:并发子代理闸 max 20(env 只可下调)+ 矩阵同步(19 项) (2e024c248f)
- 🔧 Chore/Other:root-guard 清单重封(guardian-runner=c53abb927a07) — 复核 7df2cdac4a6 的 pg-only 触发面扩展后重新封存,解除部署环 fail-closed (bc15c42f16)
- 🚀 Feature/Improvement:工件卡片内嵌分页预览 + format=json 页面形态(18 项收官) (02aa0425f4)
- 📚 Docs:README 生成块数字对齐 HEAD 面现算(testFiles 5917 / trackedFiles 23024,本轮删 2 个自动撤回文件所致;数字块有意重生成) (948561ef37)
- 🚀 Feature/Improvement:去掉"完全访问 1 小时自动撤回"(机主定案) — 删计时 hook 与倒计时 UI,高风险横幅只留静态提醒 (840dd8ceaa)
- 🔧 Chore/Other:pg-only 触发面扩到 apps/packages/scripts 全域 (7df2cdac4a)
- 🚀 Feature/Improvement:工具卡片挂载工件"查看完整输出"入口 + 五语言文案(17 项收官) (a72da5ea00)
- ♻️ Refactor:授权判据去副作用(persist 只留在命令层)+fs_info 现场日志 (6ba99f6733)
- 🔧 Chore/Other:pg-only 登记判面(auto:--staged⇒索引面/否则 HEAD 面)—— 此前派发层判「未声明判面」exit 2,门在真实批量里从未真正跑过 (2e5660de3d)
- 🔧 Chore/Other:pg-only 注册条目改口径为零容忍(注释/标签/提示与基线清零同步) (6e2e23c112)
- 🚀 Feature/Improvement:工作区授权持久化(Qoder/Trae 同构)+对外路径剥 verbatim 前缀+真实盘冒烟 (e12e111a01)
- 🐞 Fix:can-write 步骤提交消息改 env 注入,修复 shell 双引号破串 exit 127 (60b07fcec3)
- 📚 Docs:生成块数字跟上合并后 HEAD(testFiles 5917→5918,trackedFiles 23025→23026) (29cf0180bb)
- 🐞 Fix:cross-end-sync 级联前补齐 packages dist 闭包 (d0b3f9b2ce)
- 📚 Docs:生成块两枚数字跟上 HEAD(testFiles 5913→5914,trackedFiles 23018→23019) (5041daa547)
- 🚀 Feature/Improvement:ACP JSON-RPC 桥 + 交接文档导出 + 会话体检端点(16 项收官) (f9abaa4541)
- 📚 Docs:aiServiceRoutes 数字对账(669→679,随工件挂载两条路由) (e36fc3b86c)
- 🚀 Feature/Improvement:远程沙箱后端 opt-in + 工具工件预览挂载(404 Mount Expired) + run_command 预算/cwd/timeout (d0ccfc0c0c)
- 🐞 Fix:relay 任务缓存污染/订单路由桩/删除事务/预览归属 F-74 四票(test 归零) (38c67e4381)
- 🚀 Feature/Improvement:会话检索补 pg_trgm GIN(v5)+ 恢复占位语补回安全重试判据 (ccb29946ef)
- 🐞 Fix:F-578 访问趋势按上海业务日切窗 / F-293 Responses 工具项双向转换+流式事件 / F-494 检查点桩 (0893b25304)
- 📚 Docs:能力对齐报告结论摘要同步到 11 项落地 (3ee2eb2625)
- 🐞 Fix:F-708 锁续约容忍+lost信号 / SDB-03 永久订阅 / F-272 step-up 消费counter / F-79 批量归属一次IN / relay能力端点桩 (507531b8ed)
- 🚀 Feature/Improvement:grep/glob 工具上线 —— 模型侧检索能力 + 同族预算 + ** 零层修复 (1c9fb77d15)
- 🐞 Fix:两个 pytest 作业补 PostgreSQL 服务 + _status_count 容忍 None(零 sqlite 后会话库/清扫器/审批/SSO 均按 DATABASE_URL fail-closed) (a12f8a5b69)
- 🐞 Fix:F-189 组删除锁序同事务 + knowledge-team 事务桩/基线冲突前置判定 (f2636272c3)
- 🚀 Feature/Improvement:list_dir 条目上限（默认 200，可提到 1000，回包自述 total/truncated） (69f8841937)
- 🐞 Fix:本机工作区授权改用宿主选择器凭证 —— 修家目录外目录被 git bases 判 out_of_bounds 导致读取不到本地 (fa67820ba2)
- 🚀 Feature/Improvement:pg-only 门升级为零容忍——自有 sqlite 写路径已清零,只保留两条非存储夹具豁免并核对存活 (3ce0878806)
- 🐞 Fix:F-116 四条 WS 链路接背压闸 + F-226 relay 单一幂等 cleanup (64ace2f4b1)
- 🚀 Feature/Improvement:read_file 护栏（分段读 / 超大截断 / 二进制拒绝） (856e13ebf3)
- 🐞 Fix:Gitee 快照门不再把"网络不可达"冒充"快照失败" (c7f78c5b8c)
- 🔧 Chore/Other:桌面端两枚发布快照刷新到 0.1.81(四平台) (82ab6998d7)
- 🐞 Fix:重做任务栏小尺寸图标 —— 16/20/24/32/48/64 透明底高对比 ∞ 并升版 0.1.81 (e31acefb3e)
- 🚀 Feature/Improvement:会话库迁 PostgreSQL —— 最后一条自有 sqlite 写路径下线(5/5) (6070a0b91b)
- 🔧 Chore/Other:root-guard 基线按 HEAD 重封(guardian-runner 67bcad1d59c2)—— Y-71 新登记一道门后清单与现实脱节,部署环按 HEAD 面判据 fail-closed 拒绝推进 (b4e99f5127)
- 🐞 Fix:macOS 无架构标记判 universal 双键 显式 x86_64 标记仍走单键 (59cee7a823)
- 🐞 Fix:macOS 无架构标记判 universal 双键 显式 x86_64 标记仍走单键 (699cc1209c)
- 🐞 Fix:macOS 无架构标记判 universal,显式 x86_64 标记仍走单键 (e0f9575d85)
- 🔧 Chore/Other:烘焙 0.1.80 更新器 feed(四平台 latest.json 1:1) (a23052e301)

**2026-11-19**
- 📚 Docs:生成块按合并树自洽对齐(readme-align-from-tree) (ef92cca07a)
- 🚀 Feature/Improvement:edit_file 保留 BOM（Windows .ps1/.md 常见） (8b054d313d)
- 🔧 Chore/Other:基线摘掉已清零的 sso 测试夹具键 —— 4 文件 / 5 处 (8f184e7466)
- 🚀 Feature/Improvement:SSO 身份库迁 PostgreSQL —— 基线 sqlite 写路径 8/9 → 5/6 (9ea0110d63)
- 🔧 Chore/Other:下载页快照刷新到 0.1.80(updater 四平台) (7c96effc82)
- 🐞 Fix:通知偏好批量上限 F-212、会话改名桩、管理端帖子读取桩、租户成员链形状 (3d8c052081)
- 🚀 Feature/Improvement:edit_file 行尾对齐（CRLF 文件可用 LF 片段匹配，写回保持原行尾） (6c3c07254c)
- 🚀 Feature/Improvement:审批持久层迁 PostgreSQL —— 基线 sqlite 写路径 7/8 → 6/7 (261f7b2167)
- 🐞 Fix:无架构标记的 <product>.app.tar.gz 按 universal 填双 darwin 键 —— Apple Silicon 恢复更新 (5dedf29186)
- 🐞 Fix:无架构标记的 <product>.app.tar.gz 按 universal 填双 darwin 键 —— Apple Silicon 恢复更新 (ef2b0a4032)
- 🐞 Fix:无架构标记的 <product>.app.tar.gz 按 universal 填双 darwin 键 —— Apple Silicon 恢复更新 (5bb3722027)
- 🐞 Fix:无架构标记的 <product>.app.tar.gz 按 universal 填双 darwin 键 —— Apple Silicon 恢复更新 (1b3c4dbeb3)
- 🔧 Chore/Other:修正事务桩插入位置(退款回收用例) (eaca13d67d)
- 🔧 Chore/Other:事务桩补 execute、统计口径对齐 F-22、删项目桩补全量文件出口 (36b2d6cf49)
- 📚 Docs:生成块按合并树自洽对齐(readme-align-from-tree) (1d550b681c)
- 📚 Docs:报告补 5.6 前端 dryRun/edits 的 Apply 入口分治 (b34c8cce99)
- 🐞 Fix:dryRun / edits[] 的 edit_file 不再渲染可 Apply 的 diff 卡 (a24a0ea6d0)
- 🐞 Fix:ACP 会话归属/密钥字节判据/考勤统计与测试桩回补 (52d50994d7)
- 🐞 Fix:临时 worktree 寿命闸的 git 派生补显式 stdio(门 193 判红项) immutable-exempt: 该枚只给 execFileSync 的 options 补 stdio: ['ignore','pipe','pipe'],不改任何判定逻辑与阈值,消掉门 193 的 EBUSY 病灶 immutable-exempt-sig: v2:8067f07765c05626b32f19b53f2a0660b09c43df:21316fda255c788c820cccbd9160c0e862e6ee5a4379e2b73ecbdbc5bc8ee3aa (a4176e33dc)
- 🔧 Chore/Other:具名追认未推送提交 24d7bc1c474(Y-71 寿命闸挂 guardian) immutable-exempt: 该枚只把另一会话的具名追认行落库,判据语义零改动,并以本提交为载体附声明 immutable-exempt-sig: v2:652eee239f384f07922874ead9412418d2495a1c:0013b16c3d470ff322e2d4d30c59706e494697ff0113ff0b8df2c9b749bb6692 (8067f07765)
- 📚 Docs:RP-2 结清翻勾 + RP-7 维度拆解进展(SSH 复核) (652eee239f)
- 📚 Docs:生成块按合并树自洽对齐(readme-align-from-tree:testFiles 5910 / trackedFiles 23015) (144b67e6d5)
- 🔧 Chore/Other:版本号 0.1.80 —— 角标两位数重做后出正式包 (74505b393d)
- 📚 Docs:报告补 5.3–5.5 落地证据并把已落地的 resident_file 移出未落地候选 (5668912a63)
- 📚 Docs:合并面数字块按 HEAD 现算刷新(testFiles 5906 / guardianGates 370 / trackedFiles 23001);数字块为生成物,值复现属有意重生成(LAND_ALLOW_STALE) (d3e5906605)
- 🔧 Chore/Other:翻勾 RP-22 / RP-20 / Y-71 / RP-49 四项结清 (c782878ac0)
- 🚀 Feature/Improvement:edit_file 支持 replaceAll / 原子多编辑 / dryRun 预览 (c0b316a6df)
- 🔧 Chore/Other:feat(hygiene)+docs: Y-71 寿命闸挂 guardian + RP-49 README 补切号说明 (24d7bc1c47)
- 🚀 Feature/Improvement:子代理常驻文件租约（对照 deepseek-tui resident_file） (4fc50d5112)
- 🚀 Feature/Improvement:任务栏角标画真实两位数(10-99 逐位),16px 画布不再只画圆点 (797623b9b2)
- 🐞 Fix:回补被陈旧副本误删的清收口与 ACP 四方法注册;多版本通道补接口工具面;单测判据订正 (3c7317588f)
- 🚀 Feature/Improvement:记忆清扫器迁 PostgreSQL —— 基线 sqlite 写路径 8/9 → 7/8 (1447b73d08)
- 🚀 Feature/Improvement:任务栏角标画真实两位数 —— 10-99 逐位显示,16px 画布不再只画圆点 (4a2f41e83d)
- 📚 Docs:README 生成块数字对齐 HEAD 面(trackedFiles 23002) (7f778a52b5)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (2b520be9b0)
- 🔧 Chore/Other:修绿全仓单测(web/api/cli/小程序/RN/packages 族) (8ccebdb506)
- 🔧 Chore/Other:修绿全仓单测(web/api/cli/小程序/RN/packages 族) (d2184e2d19)
- 🔧 Chore/Other:修绿全仓单测(web/api/cli/小程序/RN/packages 族) (b0771cfc56)
- 🔧 Chore/Other:修绿全仓单测(web/api/cli/小程序/RN/packages 族) (5e3e654081)
- 🔧 Chore/Other:修绿全仓单测(web/api/cli/小程序/RN/packages 族) (9d2983b63c)
- 🔧 Chore/Other:修绿全仓单测(web/api/cli/小程序/RN/packages 族) (ebc19369b4)
- 🔧 Chore/Other:修绿全仓单测(web/api/cli/小程序/RN/packages 族) (50ad2828cc)
- 🔧 Chore/Other:修绿全仓单测(web/api/cli/小程序/RN/packages 族) (eb1d5f0a48)
- 🔧 Chore/Other:修绿全仓单测(web/api/cli/小程序/RN/packages 族) (6e8582e1e2)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (800c232ae7)
- 🐞 Fix:AutoInstallGuide 的 i18n-content-exempt-file 豁免续期至 2027-05-31(门 108 到期) (2c6755847b)
- 🐞 Fix:两端 zh-TW 的 webViewPortal.appsStudio 简体残留「應用台」改「應用臺」 (0a86ccbff7)
- 🔧 Chore/Other:追认 e600e1c(322 镜像落点改判) (ca185ae0d8)
- 🐞 Fix:318 阴影档归位唯一源命名空间、322 镜像落点改判 stream.ts、302r 补判面声明 (e600e1ce46)
- 🔧 Chore/Other:补记 938fa24 的事后追认行(前一披管线被 -First 截断) (6d5506f60c)
- 🐞 Fix:追认 8 枚既成提交的门体判据面改动(IG push 区间拦推根因) (fc3dffc302)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (ba3c5e0737)
- 🐞 Fix:edu-ai-management 补 buildLegacySegment 值导入(原只有 export {…} from 转出口,无本地绑定 ⇒ TS2304/TS18004,全量 typecheck 红并阻断推送) (2c091d64b8)
- 🐞 Fix:5 道门补判面声明(315/317/318/319/322 此前「未声明判面」exit 2)+ 外观页分段按钮补显式描边色 (5ea1ac22f9)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (febd5e3735)
- 🐞 Fix:摘 web 词包 slashCmd 块内 4 枚死键(plan/act/build/spec 的真实消费方在 mobile-rn 自有词包,web 侧零引用) (a8d7be07cf)
- 🐞 Fix:门104 摘过期影子登记;门70b 删 web 包 9 枚死键;门283 补 2 屏挂账;门289 补齐基线后 16 条新路由判决 + 5 张移动端门户条目(hr 三张自助页/外观设置/AI 应用台);门223 认下 write_desktop_prefs 这一条置顶去向 (f7b2e1d9ee)
- 🐞 Fix:摘掉 apps/api/scripts 下 9 枚 tmp-* 旧名(已改名 hr-*/workflow-*),消除重命名残留副本 (84e34cd1ac)
- 🐞 Fix:摘掉 9 枚 tmp-hr/tmp-workflow e2e 与 realign-ledger-hashes 的旧路径副本(迁入新位置后的重复) (dc60c08aac)
- 🐞 Fix:门 103 C1 收口(client.ts SSE 下沉 + 落地判据/规格投影拆分), 清理 D1/D2/D3 与过期例外 (582fb686b6)
- ♻️ Refactor:门 182 —— SSE 控制面 schema 收进恒 strict 工厂 strictObj (abcd204d40)
- 🔧 Chore/Other:门 198 基线锚点收窄 329 → 317(清偿 12 处盲写 updatedAt 后只许减) (e19f826499)
- 🐞 Fix:hr-employee-link 两处块作用域 changed(门 198 逐行豁免口径) (1b3fc3aafc)
- ♻️ Refactor:门 198 存量清偿 —— 27 处盲写 updatedAt 改为 changed 展开形态 (2293090d58)
- 🐞 Fix:gate-analyse 失败自述补登 hand-migration-snapshot(TRIAGE_IDS + O_HAND_MIGRATION_SNAPSHOT) (7af8331e22)
- 📚 Docs:门 207 体积清偿 —— 速查段 11 条重复门名行整行移入 archive,本体留 HTML 指针 (ca440d207c)
- 🐞 Fix:98 悬空导入 6 项实现 + 落地器单实例闸 + f-145/f-219/f-651 真修 (0daafdf811)
- 🐞 Fix:miniapp 5 契约测试改包名引用(react/vi.importActual + react-dom/server),去掉随之失效的 @ts-expect-error (e2036debc8)
- 🐞 Fix:复活接线测试重写(单源 healthRevivalPatchOf + 四腿不写健康面)、miniapp 5 契约测试改 react/vi.importActual 与 react-dom/server 包名 (ebe41e130d)
- 🔧 Chore/Other:给 pg-only 门补镜像判据 + 导入守卫 (2ba2b824e2)
- 🐞 Fix:secret_redaction 占位符替换改为带注解嵌套函数(B023 绑定循环变量 + mypy strict 可推断) (3a8df76003)
- 🐞 Fix:ruff 全量归零(51 autofix + 10 手工)、130 RP-79 同题副本合并;陈旧守卫因 import 行重排(祖先里存在过的 form)误报,已 compileall+91 例单测通过后显式 LAND_ALLOW_STALE 留痕 (8baf55a34b)
- 🐞 Fix:修守门自伤 —— 测试文件不再原样写出 sqlite 针串 (50bd027da1)
- 🔧 Chore/Other:fix(checkin)+test: RP-22 签到链路两处缺口收口 (12f39304e7)
- 🐞 Fix:150 残留两族归位(control→sm、卡片按类别取 md)、263 删除尾部三处重复测试类(F811)并补个人扣款勾稽(F841) (2513116c8b)
- 🚀 Feature/Improvement:工单账迁到 PostgreSQL — 数据层只允许 PG(迁移第 1/5) (0af2145f1b)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (52499d848d)
- 🐞 Fix:圆角角色档归位、ruff SIM300、102 S0 对齐 stroke.focus、309 跳过 GHA paths 过滤块、98 两符号末尾具名导出、130 F4 同题副本合并 (e056c0a1d5)
- 🚀 Feature/Improvement:工具面新增 edit_file（唯一匹配替换 + 读前观察） (6a1d259e3b)
- 🐞 Fix:pg-only 门不再量自己(命中族常量与自检用例是字面命中) (6c54c09bdb)
- 📚 Docs:生成块数字对齐(本机工作区适配层入库后 trackedFiles 刷新) (5cd34e5e77)
- 🔧 Chore/Other:移除已撤销的未验证模型字典键(modelUnverified/modelUnverifiedGroup) (fed28061b0)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (3e13dd6191)
- 🔧 Chore/Other:Y-71 主判据镜像测试 (7ace03fc83)
- 🚀 Feature/Improvement:接线下工具结果裁剪并加读前写保护（对照 dsh/WorkBuddy/deepseek-tui 取证） (fd787ac6bd)
- 🐞 Fix:51 个 ai-service 产出的 errorCode 补齐目录条目与五语言词包(标题+建议动作),门 94 R1 收口 (2eaa270833)
- 🐞 Fix:sag2 筛选选中态改 stroke-selected+bg-cta 同源档、QuestionSheet 勾选框前景改用兄弟键 boxCheckedText(门 83 R8 两处;前者行级命中祖先的既有正确写法,按显式放行) (dc1fc6ed79)
- 🐞 Fix:品牌实底统一到 brand.cta+ctaForeground 配对、选中态描边改 brandAccent.deep、选中态文字不再取墨档(门 83 R3/R4/R8) (95941fa41f)
- 🚀 Feature/Improvement:桌面端本机工作区接线(原生选择器授权 + IPC 列目录 + FileSystemDirectoryHandle 句柄适配,对话侧执行器直落本机文件) (0ce2c0342b)
- 🐞 Fix:主按钮退役档 bg-primary+text-primary-foreground 全部改到同源档 bg-cta/text-cta-foreground(+hover:bg-cta/90),sag2 选中态描边同时改 stroke-selected(门 83 R5) (289f5d992d)
- 📚 Docs:trackedFiles 对齐 HEAD 面 22994(索引面多一枚他人暂存件) (ece204cebb)
- 🔧 Chore/Other:收敛补录两枚删除意图 + 摘掉已删生成物的 knip ignore 条目 (1f478cebb3)
- 📚 Docs:RP-20 结清(修复已落库+T-D3h 通过) / RP-22 诊断完成(实现待下一轮) (2ea8abe798)
- 📚 Docs:trackedFiles 块对齐 HEAD 面(重试 1) (93650e7c90)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (e4e58cb1ea)
- 🔧 Chore/Other:为 pg-only 门那枚补具名追认(水印注入后签名失效须重认) (508efb6c99)
- 📚 Docs:Y-72 翻勾删行——三格已全部落地收口，按「完成即整行删除」摘除派单清单该行 (7d85943292)
- 📚 Docs:trackedFiles 对齐 HEAD 面(22992;索引里他人暂存件不计入) (38aa09bf7c)
- 🚀 Feature/Improvement:数据层禁 sqlite 写路径守门(pg-only 差值棘轮) (9d6b02157e)
- 📚 Docs:trackedFiles 22958->22990 / testFiles 5897->5904 按现算同步(合面后新增文件所致) (a790b861d2)
- 📚 Docs:Y-72 结清——三格全部落地，遗留三条全部化解 (fea0fb4fc8)
- 📚 Docs:trackedFiles 块对齐现算值(补交 workspace_fs 后取数) (97b1edd5ef)
- 🚀 Feature/Improvement:Y-72 哨兵运维件落地(runner+VBS 启动器) (3552acb5d8)
- 📚 Docs:Y-72 行采用远端最新版(含 11-19 落地进展与三条遗留),消掉合面同票两写的行级冲突 (31f1e045b8)
- 🐞 Fix:修上一枚误加的尾逗号(learnDevelop.recommend 是对象末键)—— 五份 mobile-rn 词包恢复合法 JSON,文案仍与小程序端同文 (bbb9c175bd)
- 📚 Docs:对齐 trackedFiles 至 HEAD 面计数(22980 -> 22990) (d3a73c4a06)
- 🚀 Feature/Improvement:号池模型目录每 6 小时自动对账 + 启动首轮即投递(Y-97) (766e65c55d)
- 📚 Docs:Y-72 系统级两格已落地(哨兵计划任务+告警拉起) (986357c889)
- 🐞 Fix:补交 workspace_fs 模块与权限件(远端 main 缺这些文件致 tauri 构建 E0433/E0583) (83f0397588)
- 🐞 Fix:号池模型验证判据 fail-closed(verified 非 true 一律跳过) (c7d66a4c54)
- 📚 Docs:trackedFiles 22977 -> 22979 after the R133 landing (17cbc8666c)
- 🔧 Chore/Other:临时恢复 missing.miniapp-taro.onHookFailure 键(内容等于远端版本)以消掉合面行级冲突,合面后立即再摘掉 (25d1405cab)
- 🚀 Feature/Improvement:prose behaviour rules, and a correction to R132's conditional count (05924ff777)
- 📚 Docs:Y-72 行采用远端更完整版(带 SSH 实测与三条遗留),为后续 merge 消掉同票两写的行级冲突 (0098f8c52a)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (8cb5cc9a5b)
- 🐞 Fix:登记三道具名判据门的判面(320 写死 head,import 完整性/RECENT 块 auto),消掉「未声明判面」型未判定 (0e4ac2759b)
- 🐞 Fix:323 描边角色归零(18 处 border-border/N→角色名,3 处 border-primary→stroke-selected)+RN stroke 具名类型 RnStrokeTokens;104 prod-bundle/deploy.sh 与入库源逐字节同步。注:这些替换曾被祖先 7509f488 做过又回潮,本次按角色名重做,行级判为复活,按 LAND_ALLOW_STALE 显式放行 (7bfd849850)
- 🚀 Feature/Improvement:reference and prose surfaces of the object schemas (85baa27de7)
- 🐞 Fix:摘掉重复的在册 .sql,只留已隔离的 .quarantined 副本(门 49 B12 同名跨目录) (d5ad205025)
- 📚 Docs:trackedFiles 22974 -> 22977 after the R132 landing (3a26f4e00a)
- 🐞 Fix:瓶颈提示的 ⏱ emoji 换 lucide Timer(门 11h 收口) (2f920650f0)
- 🚀 Feature/Improvement:field-level contracts over the 329 app-server object schemas (a3e5d68522)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (fef1176373)
- 📚 Docs:trackedFiles 22970 -> 22974 after the R129-R131 report landing (5f3c517db7)
- 📚 Docs:reports for R129-R131 plus an honest list of what is still not extracted (486cbfdc1f)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (b573ba4492)
- 🐞 Fix:逐族真修 48 道 blocking 红(门 2/12/49/52/55/57/69/73/77/90/91/95/247/248/265/287/296/320);i18n 键为组件所需、有意重生成,按 LAND_ALLOW_STALE 显式放行 (949f8ef3ad)
- 📚 Docs:trackedFiles block to 22970 to match the tree this commit creates (3b7bdc63c3)
- 🚀 Feature/Improvement:Y-72 落地 guardian 存活独立哨兵(三态 ok/stale/down,只读不拉起);README 数字块同步 trackedFiles=22959 (61edf34665)
- 🔧 Chore/Other:事后追认 RP-20 夹具隔离一枚(他席未签名,内容已逐行核过) (881ad0da75)
- 🐞 Fix:RP-20 镜像测试 T-D3h 夹具隔离，不再推进真仓 main (e6f5019555)
- 🚀 Feature/Improvement:Y-71 临时派生检出寿命闸判据（只读，绝不自动回收） (185ab9ca2e)
- 📚 Docs:refresh the generated numbers block to the tree this commit creates (trackedFiles 22972 -> 22969, testFiles 5897 -> 5902) (6d73b32480)
- 🔧 Chore/Other:补回合并时让位的两条具名追认 (e111066801)
- 📚 Docs:Y-72 本机已落 check-guardian-leg-health.mjs，SSH 系统级两格挂起 (264b3dd0db)
- 📚 Docs:Y-72 本机已落 check-guardian-leg-health.mjs，SSH 系统级两格挂起 (6bc4fe5567)
- 🔧 Chore/Other:追认角标提交的 updater-key-pairing 归一 (cd5f32c1db)
- 🚀 Feature/Improvement:R129-R131 skill texts, app-server schema generator, local store read - closed tier reaches 159/159 (b97760ceb2)
- 🚀 Feature/Improvement:Y-72 guardian 存活独立哨兵(只读，不拉起) (5283b2c6d6)
- 🚀 Feature/Improvement:任务栏未读角标重做(DPI 自适应画布/数字与9+/计数口径归一/tooltip 同源) (f7c02ac034)
- 📚 Docs:同步最近更新自动块(本轮两枚安装脚本修复入库) (ad65572bea)
- 🔧 Chore/Other:追认 bd46446f9f 的判据库头注修正 (3aac3fb83d)
- 🚀 Feature/Improvement:R128 Google Workspace export bridge contract, 91.8% -> 92.4% (1584415faa)
- 📚 Docs:同步最近更新自动块(本轮两枚安装脚本修复入库) (3ac94015b9)
- 🔧 Chore/Other:追认 npm-execpath 包管理器判别修复 (92bc0e594e)

**2026-11-18**
- 🐞 Fix:移除提权段,两份安装脚本回到实测零命中形态(火绒 NetLoader 根治收口) (bd46446f9f)
- 🔧 Chore/Other:回潮护栏 30→5 分钟(并发会话重建 IHUI* 任务时快速清零) (f59448a04a)
- 🐞 Fix:号池模型改实时验证(现拉上游清单核对),取消「未验证」档 (b6c9ab1aed)
- 🐞 Fix:根治「默认置顶、切其它程序看不到」并给出用户可见的置顶开关 (727f62a1b0)
- 🐞 Fix:两份分发安装脚本统一为同一实现，彻底消除杀软触发面 (6374264c2e)
- 📚 Docs:align the trackedFiles block to the HEAD-face count the gate computes (6c7ee189ba)
- 🔧 Chore/Other:19 个 Windows 计划任务迁到登录常驻调度器(禁计划任务铁律) (1a48425576)
- 📚 Docs:Y-37/RP-2/Y-58/Y-72 追加 2026-11-18 SSH 生产机只读实测注记 (76ef533a4e)
- 🔧 Chore/Other:acknowledge the protected-face content that merge 31fb90364f6 brought in (c3cbe992f3)
- 🚀 Feature/Improvement:桌面端「窗口置顶」开关的图钉文案(五语言) (5c8c7eb1eb)
- 🐞 Fix:安装脚本不再假装有 binary 通道 + 用法改为实测可用入口 (1d8c59640a)
- 📚 Docs:align generated block to the HEAD face so the doc-numbers gate agrees (3b04349417)
- 📚 Docs:refresh generated blocks after R127 (74aa180317)
- 🐞 Fix:type the empty HELP_ONLY frozenset so the whole-library mypy gate passes (5d9ef5b3fc)
- 🔧 Chore/Other:补 AGENTS 门名点名两处 + 为 merge 枚 89b72b7e 补具名追认 (e287097d4b)
- 🐞 Fix:R127 type the entry list so mypy strict passes (b749a4a768)
- 🚀 Feature/Improvement:R127 duplicate-then-delete starter deck builder, 91.2% -> 91.8% (7ba58d22e3)
- 📚 Docs:refresh generated blocks to the current tree after R124-R126 re-land (9e1649f592)
- 🐞 Fix:模型选择器分组名不再暴露内部 provider code(workbuddy_relay) (89ab8a14f3)
- 🚀 Feature/Improvement:R124 and R125 re-landed a second time after another concurrent reset, 91.2% (f010be92cc)
- 🚀 Feature/Improvement:R126 source-level cheat detection in check_template_fidelity, 90.6% -> 91.2% (4dbfad506f)
- 📚 Docs:登记签到链路两处缺口(调度建表静默不注册/设备指纹自造致1001十年冷却) (affc8cb87b)
- 📚 Docs:体积清偿回到 96K 预算内 + 补 R4 点名两枚隐形门 (5fb4ef953c)
- 🔧 Chore/Other:追认 913f290 的签名欠账(分发安装脚本去载荷) (edb8f1cad6)
- 📚 Docs:同步生成块数字(测试文件/跟踪文件) (b08c158634)
- 🚀 Feature/Improvement:R123 the template creator request gate, 88.7% -> 89.3% (e98b15fed5)
- 🐞 Fix:WS 适配器不再把业务事件收成空通知条目 (8779f22f1a)
- 🚀 Feature/Improvement:R122 the report-shape gate, 88.0% -> 88.7% (fb920bdfc2)
- 🐞 Fix:分发安装脚本去不可见水印载荷,根治杀软"木马"误报死循环 (913f290cb9)
- 🚀 Feature/Improvement:R121 read the presentation finaliser, 86.8% -> 88.0% (1fba5e218a)
- 📚 Docs:按当前树对齐生成块(推送前) (abbb8710f6)
- 🔧 Chore/Other:声明档退场本器自写面孤儿键 210 枚 (9285b2b30a)
- 🔧 Chore/Other:退役孤儿侧车键 1126 枚 + 修正镜像测试取样 (c2396ad261)
- 🔧 Chore/Other:R120 execute the .mjs helper layer, 83.0% -> 86.8% (f7f95b215f)
- 📚 Docs:生成块数字对齐当前树(testFiles 5889 / trackedFiles 22935)。因并发会话新增测试与跟踪文件,推送前 doc-numbers 门判红;本枚只改由 sync-readme-numbers.mjs 独家产出的两处数字行。 (2976204f59)
- 🚀 Feature/Improvement:R119 documents 最后 8 个工具全跑通 —— 全域 36/36，并推翻"无一原地修改" (da59687a11)
- 🐞 Fix:根护栏清单重封到 HEAD 面(git-guardian=3ae00414ebad)。根因:09:38Z 那次重封之后又有三枚 guardian 修复入库(活体体检挂 main() 链、dev api 体检 5 分钟节流、ref 位移守夜人接节拍)未同笔重封 ⇒ 部署环 root-guard fail-closed 拒绝构建切流;本枚仅重算清单期望哈希(与 root-guard 现算的 HEAD 面值逐字相等),规则正文一字未改。 (161d5910cc)
- 🚀 Feature/Improvement:R118 真的把 documents 的 36 个工具跑起来 —— 四种调用约定，不是一种 (e8ae25b758)
- 🐞 Fix:推送清单为空时按 origin/main..HEAD 只读派生改动范围 (8cc73cbdad)
- 📚 Docs:刷新 README.en.md 生成块数字,与当前树对齐。因本轮新增 1 枚迁移文件 + 并发会话新增测试文件,生成块落后 1-2 枚计数 ⇒ 推送前 doc-numbers 门判红;本枚只改由 sync-readme-numbers.mjs 独家产出的数字块。 (5d9b09d989)
- 📚 Docs:按当前树对齐生成块(推送前) (83014b7371)
- 🚀 Feature/Improvement:R117 把文风准则做成能跑的东西 —— 24 条单测全绿，真跑一次就现原形 (18e4b2aaac)
- 📚 Docs:按当前树对齐生成块(并发漂移已消除) (3de0261370)
- 🐞 Fix:数字门判据面冻结为本次推送的 local sha (bf58697bd9)
- 🐞 Fix:补入库 BUG-29 索引补齐迁移 20261118000000_bug29_indexes.sql(38 条 CREATE INDEX IF NOT EXISTS)。根因:该迁移文件此前只在工作树、journal 里已有条目(idx 408)却无对应文件 ⇒ 生产 pull 到 438 条 journal 后 db:migrate 会读到这一条却找不到 SQL,部署在迁移步 fail-closed;本枚只补文件本体,SQL 内容一字未改。 (c573d417d0)
- 🚀 Feature/Improvement:R116 风格表与引擎文档 —— 两份风格指南是同一个文件 (da54e8d0c4)
- 📚 Docs:生成块按树全量对齐(testFiles=5886, trackedFiles=22928) (cc742d547c)
- 📚 Docs:生成块改由按树取数器物对齐(testFiles=5885, trackedFiles=22926) (2fc8e44fdb)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3f84fd6c09)
- 🚀 Feature/Improvement:R115 documents 的 33 篇自述 —— 三种"看起来有信息其实没有"的信号 (1e306ad9df)
- 🐞 Fix:R114 撤回两条错判 —— 尺子量错了方向 (dba8a5a553)
- 📚 Docs:合并后按索引面刷新生成块数字 (a3ffcd1325)
- 📚 Docs:生成块随并发新增再对齐(测试文件 5880→5881,跟踪文件 22915→22919) (5db6857167)
- 🚀 Feature/Improvement:R113 覆盖率尺子 —— 把"百分百"变成可判定的数 (45fccada5a)
- 🚀 Feature/Improvement:R112 documents —— 36 个工具、一种占位符、一个看不见的坑 (499c7e06fa)
- 🚀 Feature/Improvement:R111 旋转 —— 框会撒谎，说这个形状不需要那么多地方 (b9a0b3cfb6)
- 📚 Docs:生成块按树取数对齐(测试文件 5830→5880,跟踪文件 22776→22915) (3b5813e84d)
- 🔧 Chore/Other:补登 29 条孤儿迁移到 drizzle journal(通知投递幂等/唯一索引等)。根因:迁移文件存在但无 journal 条目 ⇒ drizzle-kit migrate 与「迁移先行闸」逐枚审计都看不见它,生产 notifications 表缺 idempotency_key/email_claimed_at/email_sent_at 三列致 GET /api/notifications 500(同实例 unread-count 只 count(*) 故 200)。已按同一口径(ADD COLUMN IF NOT EXISTS + CREATE UNIQUE INDEX IF NOT EXISTS)在生产库逐文件应用 23 枚并在 drizzle.__drizzle_migrations 写入 hash/journal-when 账本行,复测 GET /api/notifications 200;本枚只补登记,SQL 内容一字未改。 (290adc6b6c)
- 🚀 Feature/Improvement:R110 修 —— 造一个真能抓住溢出的检测器 (0c99a50f70)
- 🐞 Fix:Y-88 DiagramPreviewModal 注入前 DOMPurify 消毒 svg,信任边界收到契约层内 + 恶意标记回归测试 (3bd469b41f)
- 🐞 Fix:三枚 codex 契约模块 mypy 清零(行为不变) (b83680a4a9)
- 🚀 Feature/Improvement:R109 那个负责抓溢出的工具，抓不到溢出 (3c09de07dc)
- 🐞 Fix:Y-85 插件统计 days 加 clamp[1,365]+make_interval 参数化,消除 sql.raw interval 字面量拼接面 + 回归测试 (46f816aa90)
- 🚀 Feature/Improvement:R108 渲染链 — 三个环境变量，一个 runtime python，然后终于看见了画面 (270af6e367)
- 🚀 Feature/Improvement:R107 把字面值变成真工作簿 — R103 那个缺口被补上了 (d47243761b)
- 🐞 Fix:恢复被并发推进覆盖的 Y-86 两个文件(statistics.ts / y86-agent-heat 测试) (1e3b2fcb8c)
- 🚀 Feature/Improvement:README 数字对齐器物(按树取数),根治写入口与判据口径断裂 (d00b255d30)
- 🐞 Fix:Y-86 agent-heat 默认日键改用 bizDayKey(Asia/Shanghai) 消除 UTC 错位 + 回归测试 (e1d6773e37)
- 🐞 Fix:文档数字门从 push 腿整体摘除(观测空跑 ~200s 抵不上代价) (f1ff5fa5d6)
- 🐞 Fix:pre-push 文档数字门降为观测腿,不再阻断推送 (b71213859f)
- 🚀 Feature/Improvement:R106 provider 的线协议 — 为什么本地模型池喂不进这个版本 (0066e1b95d)
- 🐞 Fix:文档数字门 push 档改用推送范围判责,不再替别人的新增背锅 (ce3e97c4d4)
- 📚 Docs:数字表按 HEAD 面现算对齐(testFiles 5829 / trackedFiles 22774),表格形态不在写入口覆盖面内,本次按行精确改 (0ad9fcd7e7)
- 🐞 Fix:Y-95 RegistryClient apiUrl 加 transport 闸(仅 https 或回环 http),防非回环 http 明文传 Bearer (26dc199cc0)
- 📚 Docs:数字表按 HEAD 面现算对齐(testFiles 5828 / trackedFiles 22773),写入口只刷列表形态未覆盖表格形态 (e5f2a32351)
- 🚀 Feature/Improvement:R105 问运行期的解析器 — hook 配置到底是什么形状 (5a3e4cbaaf)
- 📚 Docs:按 HEAD 面现算对齐(testFiles 5828 / trackedFiles 22773) (2564bd4a01)
- 🐞 Fix:Y-90/93/94/89 四处 async 回调补 reject 处理(复位loading/落error/记日志),消 unhandled rejection (050b7aafc3)
- 🐞 Fix:恢复被重构丢掉的 tool_result_payload/outcome(mypy 红是真 bug) (5ffcd1b291)
- 📚 Docs:按 HEAD 面现算对齐能力矩阵后的 apiRoutes 4859 / testFiles 5827 / trackedFiles 22772 (b50af59fda)
- 🚀 Feature/Improvement:上游能力矩阵(qoder 7 / trae 10 / workbuddy 8,每条指到真实符号;唯一 unreproducible 是 Qoder 请求签名)+admin 只读端点;对照程序四类典型能力逐条给本仓落点 (965be02cde)
- 📚 Docs:生成块数字对齐现算(testFiles 5826 / trackedFiles 22770) (236d917231)
- 🔧 Chore/Other:撤回并发复用探针(实测回执恒 exit 1 ⇒ 探针从不命中) (c87cc86b8b)
- 🔧 Chore/Other:Y-83..Y-96 的摘除注记批次号对齐到已推送的远端版本(两侧除批次号外逐字节相同,双版并存会永久阻断 git-sync-converge 的折叠裁定) (6def559e82)
- 🐞 Fix:Y-87 GitHub Device Flow 授权页 window.open 补 noopener,noreferrer(reverse tabnabbing) (3d49c30942)
- 🔧 Chore/Other:补齐 miniapp-taro 四语言的 user.menu.about(en 独有),i18n parity 七 scope 全部 0 差异 (dad0a44388)
- 📚 Docs:R104 四十八轮的索引与一份诚实的边界面 (403da8e22e)
- 🐞 Fix:头条热榜 HotValue 是字符串而非 number(实测 "39019941"),原 typeof 判定恒 false 导致热度全丢;改走 parseHotValue 兼容 number/string/万亿单位 (0d3d09513e)
- 📚 Docs:生成块按 HEAD 面现算对齐(apiRoutes 4858 / apiRouteFiles 716 / testFiles 5825 / trackedFiles 22769;本票新增 1 路由文件+3 测试文件+3 服务文件,共 +7) (d5fbe59997)
- 🚀 Feature/Improvement:R103 --target-application 不是默认值，是数据模型开关 (6d846218a1)
- 🚀 Feature/Improvement:公开签名协议层(HMAC-SHA256/AWS SigV4/OAuth1a/JWT-HS256 纯函数)+PAT 一键引导与生效判据+桥接恢复策略(缺件/端口/登录态/阈值分流);admin 两面已接线 (7b8f2decb1)
- 🚀 Feature/Improvement:R102 源图豁免真的被打开了 (0703bcdeb8)
- 🔧 Chore/Other:teardownTimeout 30s —— 出包门链上 forks worker 收尾超默认 10s 被判红,属资源预算不改判据 (7034dca0fc)
- ⚡ Perf:等锁结束后回读并发绿回执(省掉重复的 100s 全量) (c1ad24b619)
- 🐞 Fix:趋势判定在无热度值时改用排名相对变化(实测 16 源 5.3 万条 current_hot 全空,trendTag 原恒 stable);保留期 120→30 天且按日切片收敛(一次性 DELETE 会撞 30s statement_timeout) (19d5d78b86)
- 📚 Docs:生成块按 HEAD 面现算对齐(apiRoutes 4856 / apiRouteFiles 715 / testFiles 5822 / trackedFiles 22762;上一枚 docs 用了回退值,以本枚为准) (9ed3f9e509)
- 📚 Docs:生成块数字对齐现算(apiRoutes 4854 / apiRouteFiles 713 / testFiles 5818 / trackedFiles 22759) (cc43d43078)
- 🚀 Feature/Improvement:Cosy 能力自述层(4条设备头映射+2固定档=verified / 请求签名 unreproducible 明示不伪造 / 客户端桥接 bridged)+admin 只读端点;导出 COSY_HEADERS 为单一真相源;README 四维同步(DN5) (fca275e435)
- ⚡ Perf:回执环境指纹去掉 node_modules 布局尺寸(实测 156s 到 5.1s) (19269c67dd)
- 🚀 Feature/Improvement:R101 源图豁免与收据 — 两道门，一道都绕不过去 (c01c1bad3a)
- 🐞 Fix:F-667 token 聚合列去末端 ::int 消除 22003 溢出(relay stats / saas quota) (5059f28d6b)
- 🚀 Feature/Improvement:R100 图表工作簿校验 — 触发器是 c:cat，不是 embedded workbook (90622a2df6)
- ⚡ Perf:3b 批量取材上限 256MB 抬到 640MB(实测批内 126s→82.7s) (ce5f938946)
- ⚡ Perf:3b 批量取材上限 256MB 抬到 640MB(批内实测 126s → 82.7s) (dc1cbab222)
- 🚀 Feature/Improvement:R99 原生表格与图表 — 一个包里有两个 schema 命名空间 (c99321b975)
- 🚀 Feature/Improvement:补接入套件一键生成(建Key+接入四行+直达链接)与本机凭证发现/端点取证助手(只读不采用);README 四维同步(DN5) (63c34b572d)
- 🐞 Fix:覆盖层是否变化改按内容判(sha 恒漂移导致无改动也白跑 OTA),overlayDiff 单一真相源 (a30d6ad38b)
- 🐞 Fix:收尾 ssh 清理加硬超时(60s) —— 裸 ssh 挂死会持锁导致计划任务每小时全跳 (3f4c0643b0)
- 🐞 Fix:门链输出 Tee 落盘(失败可回溯) + 清 env-probe 诊断残留 (41b8c3ed77)
- 🐞 Fix:退役清单补上 expires 存活期这一维 —— 到期即失去消音资格（清偿 RP-21） (aa372f52da)
- 📚 Docs:生成块补齐 apiRoutes 4852->4854 / apiRouteFiles 712->713 / testFiles 5817->5818(本票新增 1 路由文件+1 测试文件,DN5 清单不变式) (80f94f41fc)
- 🚀 Feature/Improvement:补权益活动领取判据层与 admin 预览面(对标 qoder2api 的签到+福利真实领取;端点未实证整批拒发起);README trackedFiles 22750->22753(DN5) (384cff16b0)
- 🔧 Chore/Other:页脚 DATABASES 移除 sqlite 项后,同步删除 5 语言 databases.sqlite 键(有意删除键,出口②留痕) (6bd6d6bbc4)
- 🔧 Chore/Other:追认 eb8e7d98 一档(门结论缓存库 + 容器圆角门接入) (678794a12d)
- 🚀 Feature/Improvement:R98 内容层 findings — 退出码其实三态，warning 永不升级 (911e9de6d4)
- 🐞 Fix:快照表加 120 天保留期滚动清理(此前只增不删,91 天已 233 万行);fix(web): 页脚云数据库移除 sqlite 项(本项目存储是 PostgreSQL,该项还误配 AWS 图标) (eddc235b84)
- 📚 Docs:生成块 4 个数字跟随当前 HEAD 面(apiRoutes 4852 / apiRouteFiles 712 / testFiles 5817 / trackedFiles 22750) (5ab7d0e0bc)
- ⚡ Perf:门结论缓存库 + 容器圆角门接入(全量档 35s → 0s) (eb8e7d9851)
- 🚀 Feature/Improvement:补客户端接入配置拼装层与 admin 端点(对标 qoder2api 的配置生成器);README 生成块 trackedFiles 22745->22748(DN5) (4b02e48854)
- 🚀 Feature/Improvement:R97 六道门行为契约 — 黑盒执行，两阶段判定实测到手 (2e5ecbc804)
- 📚 Docs:R96 许可审计 — plugin.json 写 MIT，随包 LICENSE.txt 却是全权保留 (202cf92ee9)
- 📚 Docs:生成块 4 个数字跟随 HEAD 面(apiRoutes 4850 / apiRouteFiles 711 / testFiles 5816 / trackedFiles 22745) (537e3b0144)
- 🚀 Feature/Improvement:R95 技能引擎 20 工具 / 6 道质量门 / 两个交互契约 (dbbade8d5e)
- 🔧 Chore/Other:追认 569e0f15.ecedec8a02 一档(typecheck 回执键收紧,判据强度不降) (4747e5b350)
- 🔧 Chore/Other:追认 admin 冻结闸服务env缺失改判未判定 (b35ab22dc1)
- 🚀 Feature/Improvement:补稳定设备身份派生层与 admin 派生面(对标 qoder2api 的 derive_id);README 生成块 trackedFiles 22740->22743(DN5 清单不变式) (e4221f23dc)
- 🐞 Fix:趋势计算改库内聚合+批量写入(原实现把近30天约77万行快照全读入Node并逐 item 串行 upsert,是 api 跑满数小时后 /api/auth/me 卡 20s 的根因);feat(guardian): 体检器物退化时抓进程与PG现场 (21232934d0)
- ⚡ Perf:回执键从整树收紧到 tsc 输入面(136s → 7.3s,18.7 倍) (569e0f150a)
- 🚀 Feature/Improvement:R94 内置插件三层契约与 hook 配置契约（含四条否证） (9133cc9f9c)
- 🐞 Fix:OTA 腿失败不再判整轮红 —— 回落整包(本站唯一真实交付通道),避免 origin/main 被他人推进后每小时红且零产出 (8cbcf685ca)
- 🐞 Fix:admin 冻结闸服务env缺失改判未判定,避免非生产机误报密码被改 (1f31f0e779)
- 📚 Docs:生成块 trackedFiles 22739→22740(本轮新增 1 个跟踪文件) (887507fc26)
- 🚀 Feature/Improvement:等锁改为实时可观测(排队登记 + 每5s进度 + status 查询) (ecedec8a02)
- 🔧 Chore/Other:按 HEAD 面重封根护栏清单(git-guardian=3ae00414ebad,同枚规则文件已在 b50012b24ad) (60100019fe)
- 🐞 Fix:活体体检挂到实际常驻的 main() 链上(原仅挂 daemon 面,常驻轮从未跑到) (b50012b24a)
- 🚀 Feature/Improvement:R93 运行期观测(7crate/12target模块树 + state_5 15表109列62迁移 threads43列 + Electron 17键signed-out) (98beff3321)
- 🔧 Chore/Other:新增 dev api 活体体检器物并按 5 分钟节流挂上常驻面(连续超阈才重启,自证本仓 dev api + 24h 配额双护栏) (78354733f6)
- 🔧 Chore/Other:具名追认 3c7cca1a(guardian 追认提交自签 payload 与实际 blob 错位) (b14723208e)
- 📚 Docs:登记一票——RETIRED_KEYS 带证据登记制缺 expires 存活期，与 §0.7/守门108 的到期要求有差距（核验 489bd483 时发现，本轮只登记不动判据） (83529a62cf)
- 🐞 Fix:StreamTag 补可选 onClick/ariaLabel 并去掉原生 title(修 HEAD 面 2 处 TS2322) (70f342c674)
- 🚀 Feature/Improvement:R92 A4结构性否证(长度1的run=0,单变体枚举不可独立认证)+R56-R92终章索引(33模块/13项终态/10条否证/五条硬读数) (f628359625)
- 🐞 Fix:发版链三处硬化 —— 清 ANDROID_SDK_HOME 冲突 / 删陈旧 JS bundle 产物 / 私有仓分片腿按 exit3 降档(人工确认:行级复活是 throw 行移入 elseif 分支所致,整 blob 语义未丢) (f254a3bcd1)
- 🐞 Fix:补 _schema 返回类型注解,清偿 T1 mypy blocking 红 (1fe94a95e6)
- 🔧 Chore/Other:T1 全量 typecheck 超时预算按 2026-11-18 实测校准(405s→600s) (af49318c19)
- 🐞 Fix:自愈腿的 commit-tree 补单源提交身份，根治派生/服务上下文恒 Author identity unknown (5e40ea8176)
- 🐞 Fix:冷启动静默刷新瞬时失败后排有界自愈,不再永久停在已登录无 token 的混合态 (0cbe966a09)
- 📚 Docs:登记一票——镜像测试 T-D3h 夹具隔离破了，跑它会派生真仓自愈并推进 main（本轮对照实验实测，ROOT 单源解析属高危面须独立做） (e1b81e8c3c)
- 🐞 Fix:验签器兼容 Tauri 双层 .sig + feed 快照刷到 0.1.78 (5203c7df44)
- 🚀 Feature/Improvement:R91 待办收官(A6两条说明揭出schema外规则/A9 57默认值可执行/A3 205-209无变体表/A5前提不存在/Ghidra导入285s无增量) (6ea0efecfc)
- 🚀 Feature/Improvement:模型判死清单下发到前端,号池与兜底清单同样标死必失败的行 (256fb1b9f2)
- 🚀 Feature/Improvement:R89 待办账收口(A2零残片/A7 987结构/A8 60空白族/A11a遥测面) + R90 A12运行期契约校验器 (527e6ac348)
- 🐞 Fix:恢复 StreamTag 可点击定义,清偿 union merge 遗留的两处类型错误 (66acccabf2)
- 🔧 Chore/Other:追认 1cb265e5f 与刷新 302p 基线 (468d0933dd)
- 📚 Docs:R56-R88 codex 逆向链终局报告(三路线闭合/天花板914/A1-A13账/2784例全绿) (88dd6577ac)
- 🐞 Fix:废弃键清单改为「带证据+日期」对象形态,登记本地有意关闭的 TURNSTILE_SECRET_KEY (489bd483a7)
- 🚀 Feature/Improvement:R87 枚举变体表3/4定位(R87多副本13) + R88 代码级字符串路线否证(中位2/正控1-316) (cfa2a191d6)
- 🐞 Fix:关闭 Turbopack 构建期持久缓存,消除 next build 的 SST/zstd 内存分配失败 (2b65b52026)
- 🚀 Feature/Improvement:R86 覆盖缺口分类账(named316/under372/empty500/over226/池路线天花板914) (92f7169081)
- 🚀 Feature/Improvement:R85 23 段 inline schema 二进制定位(3/23 且全为 output/12 个 input 段全空) (b52ff044fd)
- 🐞 Fix:fetch 加 3 次退避重试 + 覆盖层纳入 api-client 源(主干 rn-tests 门红根因) (b4a2f8d91b)
- 🔧 Chore/Other:并入两处主线所需修复(ahead 仅 queued 档 + 发布 scp 255 重试) (963695c34e)
- 🚀 Feature/Improvement:R84 hook 定义对象二进制坐实(7 中 6 认证/3 共享一址/PostToolUse 未定位) (c8b910b01b)
- 🚀 Feature/Improvement:R83 滑动窗口认领16结构(跨源认证1枚/薄证据2枚/覆盖321/长run切分收益0) (6c608e5908)

**2026-11-19**
- 📚 Docs:同步最近更新自动块(本轮两枚安装脚本修复入库) (ad65572bea)
- 🔧 Chore/Other:追认 bd46446f9f 的判据库头注修正 (3aac3fb83d)

**2026-11-19**
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

**2026-11-18**
- 🐞 Fix:安装脚本不再假装有 binary 通道 + 用法改为实测可用入口 (1d8c59640a)

**2026-11-18**
- 📚 Docs:refresh generated blocks to the current tree after R124-R126 re-land (9e1649f592)
- 🐞 Fix:模型选择器分组名不再暴露内部 provider code(workbuddy_relay) (89ab8a14f3)
- 🚀 Feature/Improvement:R124 and R125 re-landed a second time after another concurrent reset, 91.2% (f010be92cc)
- 🚀 Feature/Improvement:R126 source-level cheat detection in check_template_fidelity, 90.6% -> 91.2% (4dbfad506f)

**2026-11-18**
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
