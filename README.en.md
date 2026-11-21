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
| API 路由 | 4861 | `apiRoutes` |
| 路由文件 | 714 | `apiRouteFiles` |
| AI 服务路由 | 686 | `aiServiceRoutes` |
| WebSocket 端点 | 40 | `wsEndpoints` |
| 入库模型清单 | 103 | `llmModels` |
| 发布平台 | 38 | `publishPlatforms` |
| 端应用包 | 9 | `appPackages` |
| 共享包 | 18 | `sharedPackages` |
| CLI 命令文件 | 78 | `cliCommandFiles` |
| CLI 工具文件 | 112 | `cliToolFiles` |
| 语言 | 5 | `i18nLanguages` |
| i18n 作用域 | 7 | `i18nScopes` |
| 语言包 JSON | 35 | `i18nMessageFiles` |
| 测试文件 | 5947 | `testFiles` |
| CI 工作流 | 59 | `ciWorkflows` |
| Compose 服务 | 14 | `composeServices` |
| 工程守门 | 371 | `guardianGates` |
| — blocking | 339 | `guardianBlocking` |
| — warn | 34 | `guardianWarn` |
| 跟踪文件 | 23103 | `trackedFiles` |

上表由 `node scripts/sync-readme-numbers.mjs`(唯一写入口,索引面取数)生成,最后核对日期 2026-11-21。
每个数的来源就写在取数键旁边的实现里(`scripts/gen-doc-numbers.mjs` 的 `SOURCES`),**不得手抄、不得另立第二份**。

<!-- END GENERATED NUMBERS -->


## Recent updates (auto-maintained)

<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->
**2026-11-21**
- 🐞 Fix:门44 白名单登记机主本地运维脚本 + 两枚文件补水印载荷(守门 44/47) (d460e012be)
- 🚀 Feature/Improvement:AI 输入框补人事工具条件携带(此前 hr_* 六枚未进 agentTools,真机实测模型答复"找不到人事工具") (56582f28e6)
- 📚 Docs:hook-run 六端按档登记为已知缺口(第47项) - 新增帧不许静默,端能力门 hook-run 一族 12 行清零 (27e7a9a234)
- 🔧 Chore/Other:烘焙桌面端更新 feed 到 0.1.90 (077491b33b)
- 🐞 Fix:load_cache_index 缓存命中分支与上游同一形态收窄类型(no-any-return) (ac9694ca51)
- 🐞 Fix:load_cache_index 缓存命中分支显式收窄类型(no-any-return) - 写入口只有 typed index 赋值,读回 cast 到 dict[str,list[str]] (acdd3d4eb1)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (346fc72dbd)
- 🐞 Fix:dev:local 的 beforeDevCommand 改为绝对路径 (d0e5451163)
- 📚 Docs:模块 docstring 补齐传统终端原语清单(focus/paste/mouse/links/cursor…) (fa17e7db27)
- 🐞 Fix:重封根护栏清单 git-guardian 哈希(43bf5a51c441)。2be0a1df413 对 git-guardian.mjs +92 行(gitee 发版资产补齐,已具名追认)未同枚重封,导致生产部署环 root-guard fail-closed 全面阻塞(部署不推进 ⇒ ai-service 停在旧版 ⇒ 模型目录仍 21 条全 chat)。IHUI_LAND_SKIP_DANGLING_GATE=1 原因:本次仅清单哈希一行,全仓悬空扫描与改动无关且单次 >40min。 (b971e46190)
- 🐞 Fix:镜像索引返回值显式 cast,消 mypy no-any-return (b9210a0f5b)
- 📚 Docs:派生数字按合并后 HEAD 现算重钉(测试文件 5943 / 跟踪文件 23092) (2fe9b1bc9a)
- 🔧 Chore/Other:0.1.90 (版本号推进, 用于验证自更新回执闭环) (9f43b38d9e)
- 🐞 Fix:推理力度滑块两处任意值投影归入 ELEVATION 唯一源(守门 318:轨道改 elevation-none+ring-inset,拇指改 elevation-sm) (6c23fa83f6)
- 🚀 Feature/Improvement:桌面更新源 0.1.89 四平台直链全部切国内 Gitee(此前只有 Windows 走 Gitee,国内补齐后 mac/linux 也齐) (12dfbba37e)
- 📚 Docs:派生数字按门现算值刷新(测试文件 5941 / 跟踪文件 23084) (33698e5f07)
- 🚀 Feature/Improvement:人事部自助/算薪六枚工具补展示映射与五语言文案(守门 55:132/138→138/138) (721ff11a1a)
- 🐞 Fix:推理档位真值落镜像文件,池同步清 metadata 后仍能匹配 (123ea4e01c)
- 📚 Docs:具名追认 2be0a1df(Gitee 发版资产补齐)对 git-guardian.mjs 的追加式改动 (68a44c3d55)
- 📚 Docs:README 生成块按 HEAD 面现算对齐(testFiles 5942 / trackedFiles 23088,随本票新增 2 路径 DN5 同步) (93e75ee4da)
- 🚀 Feature/Improvement:社保基数变更即时通知 + 每日配置巡检(一更新就知道,该更新没更新会被发现) (8628cf72e3)
- 🚀 Feature/Improvement:真 VT 屏幕网格 + cursor 原语(光标位置记账,不再拿行流水冒充屏幕) (bba52834ac)
- 🔧 Chore/Other:烘焙桌面端更新源 0.1.89 (Windows 走 Gitee 直链) (aded46d5b4)
- 📚 Docs:README 生成块测试文件数按远端现值重钉(生成物值复现属有意重生成) (e68fa6a8be)
- 📚 Docs:生成块 testFiles 5939→5940 / trackedFiles 23080→23082 对齐 origin/main 现算(派生数字行,为并发合并消除双值分歧;不读工作树,同文件另有在飞改动) (5db054a0be)
- 🐞 Fix:双击快捷方式启动不了 —— desktop 复用共享 web 8801(registry reusePortOf/processName + 8801 已 UP 则跳过冲突判定)、beforeDevCommand 改 scripts/desktop-before-dev.mjs(UP 复用/DOWN 补起)、存活判据由 8801 HTTP 200 改为 ihui-desktop 进程+窗口句柄(入口脚本轮询 MainWindowHandle)、cargo 按 Get-Command 实测注入;README 数字块由在飞他人票同步,本票不再改 (2e9364f6b5)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (f58931f4fe)
- 🚀 Feature/Improvement:国内侧自动补齐 Gitee 发版资产(治 runner 传 87MB 必超时的结构性缺口) (2be0a1df41)
- 🐞 Fix:reasoning_effort_catalog 循环变量改 patch_json(mypy 2.3.1 判 str 赋给 dict[str, Sequence[str]],同函数体上方 patch 是补丁体,dirty 面不再阻断 push 门 T1) (4b18219e2a)
- 📚 Docs:生成块 testFiles 5940 / trackedFiles 23082 按 HEAD 面现算对齐(并发会话新增文件所致 DN5) (78e3dad903)
- 🐞 Fix:reasoning_effort_catalog 循环变量改用 payload(与上文 dict 变量 patch 解耦,mypy assignment 冲突清零) (e803d0d481)
- 🐞 Fix:图像改按实际张数计费(n in [1,10],原实现按 1 张扣会漏收 9 张)并补 n=10=>30 积分断言。IHUI_LAND_SKIP_DANGLING_GATE=1 原因:本次仅两处 units 1->billingUnits 常量替换(均为 number,typecheck 9/9 已绿),全仓悬空扫描与改动无关且单次 >40min 会拖住并发落地;LAND_ALLOW_STALE=1 原因:proxy-llm 失败分支通用行 return reply 被行级复活判据误判(祖先同形)。 (62be400645)
- 🔧 Chore/Other:mcp_server import 块按 isort 重排(I001,纯排序 27/27 行) (3e3d188b30)
- 🚀 Feature/Improvement:媒体生成按张/次计费(图像 3/张、视频 12/次,倍数沿用单一档位表;预检按本次预估判余额、成功后扣、referenceId 幂等、扣分失败不阻塞产物)。含 3 个单源模块(media-billing / media-billing-pricing / points-multiplier 抽离)与 8 例纯判据测试。LAND_ALLOW_STALE=1 原因:image-gen-routes 与 proxy-llm 的失败分支通用行 'return reply' 被行级复活判据误判(祖先同形),已逐文件核 diff 仅含本票改动。 (d848f09530)
- 🐞 Fix:ruff 清账两件(__init__ 补 HR_INSURANCE_READINESS_DESCRIPTION 进 __all__;reasoning_effort_catalog 改用 datetime.UTC 别名) (b3afde90da)
- 📚 Docs:追加本机Agent并发容量实测诊断附录——三层根因(各自拉整套dev环境/CPU空闲基线吃满/页面文件在机械盘)+三层收口(页面文件迁NVMe/安全清理脚本/AGENTS铁律12)+真实并发上限(共享15-25 vs 各自拉≤5)。纯追加16行零删除,基于HEAD构造不卷带他席120+改动。 (e11cf4b649)
- 📚 Docs:README 生成块按合流后 HEAD 面现算对齐(apiRoutes/testFiles/trackedFiles) (d1bcbd5fa6)
- 📚 Docs:README 生成块按合流后 HEAD 面现算对齐(apiRoutes/testFiles/trackedFiles) (b781d44745)
- 📚 Docs:生成块 testFiles 5939 / trackedFiles 23078 按 HEAD 面现算对齐(DN1/DN5;sync-readme-numbers 按索引面取数与门差 2,故按门现算值手写两条派生行) (76801d102e)
- 🔧 Chore/Other:0.1.89 自更新回执与目录清理, 新增 dev 独立端口热更入口 (e998ed8d1b)
- 📚 Docs:README 生成块按合流后 HEAD 面现算对齐(apiRoutes/testFiles/trackedFiles) (2b3e94f4c5)
- 📚 Docs:记 T1 逐包回执与 IHUI-T1-TIMING/ATTRIB 自述行读法 (9b785f2161)
- 🚀 Feature/Improvement:推理档位按上游真实枚举声明 + 滑轨两端对齐 (055260e1a1)
- 🐞 Fix:zh-TW 台帳 残留简体改臺灣標準字(門 2b 简体残留判红) (b69db3c250)
- ♻️ Refactor:钩子读数抽成 HookReadout 组件(第43项) - 显示优先级单源 + 4 例 RTL 锁 (bcfc68c7a2)
- 📚 Docs:§4 新增「常驻开关图标画状态、不画动作」强制条目(门 89 R4:已接线守门须在 AGENTS 可见;配套 check-toggle-icon-semantics.mjs) (1af0bd2ecf)
- 🔧 Chore/Other:Merge origin/main into main(98943bcf6e9) (edf0098112)
- 🚀 Feature/Improvement:终端焦点事件原语(DEC 1004,程序点单后 ESC[I/ESC[O],未点单拒 TERMINAL_FOCUS_DISABLED) (ddb904134e)
- 🐞 Fix:scheduler 超时竞速去掉同一 Promise 的二次空 catch(wire-strictness 91→90) (6564d87e12)
- 📚 Docs:README 生成块按合流后 HEAD 面现算对齐(apiRoutes/testFiles/trackedFiles) (2f40af76a8)
- 🐞 Fix:审计摘要截断判定修正 + 轮转阈值可调可测(第42项) (a1bbfa1209)
- 📚 Docs:§0 新增铁律12——多agent并发复用同一套dev server(实测8个各自拉整套即卡死);旧12顺延为13。基于HEAD构造,工作区零改动,不卷带他人63个未提交改动。 (8b818ab026)
- 📚 Docs:README 生成块数字按合流后 HEAD 面现算对齐(apiRoutes 4861 / testFiles 5937 / trackedFiles 23074) (f5c5a3720f)
- 📚 Docs:生成块三格对齐(aiServiceRoutes 686 / testFiles 5935 / trackedFiles 23069) (e2d6e4c44c)
- 🚀 Feature/Improvement:社保配置防滞后提醒(记录时间早于生效年度 → 提示疑似沿用旧数据) (93533aec84)
- 🐞 Fix:DB-35 后 email 密文致跨环境 owner 翻译全跳过——读路径经 decryptCredential 解密 (1f403c8b6c)
- 🚀 Feature/Improvement:社保守卫(缺费率配置拒绝出单) + 公积金基数独立夹取 + 算薪配置体检工具 (a0ff3ae1bb)
- 🚀 Feature/Improvement:终端 DECCKM 应用光标键模式(程序 DECSET 1 后方向键/Home/End 改发 SS3,回执 app_cursor) (6a3dbd0f2c)
- 📚 Docs:README 生成块数字按 HEAD 面现算重钉(testFiles 5935→5936 / trackedFiles 23071→23072 / testFiles 5933→5936 / trackedFiles 23067→23072;并发落地带入文件所致;数字块为生成物,值复现属有意重生成) (8228aad892)
- 🚀 Feature/Improvement:模态档只展示有通道的(agnes-image-/agnes-video-)+语音/OCR 未接通给明确说明卡+非 agnes 图像模型显式 400(禁静默顶替);新增选择器判据测试 7 例(vitest)。LAND_ALLOW_STALE=1 原因:image-gen-routes 的 503 未接通分支被有意替换为真出图,新代码里通用行 'return reply' 被行级判据误判为复活(祖先 990b7dcd7 同形),已逐文件核 diff 仅含本票改动。 (9f3255259a)
- 🔧 Chore/Other:桌面更新源烘焙到 0.1.88(Windows 腿走 Gitee，字节一致) (65a0db11ec)
- 🐞 Fix:管道路径空闲即吐(PeekNamedPipe/select 轮询 + 字节级行切,治好 TUI 帧读不到与多字节被切坏) (917fd9c708)
- 📚 Docs:README 生成块数字按合流后 HEAD 面现算对齐(testFiles 5935 / trackedFiles 23071) (1e02688b8a)
- 🚀 Feature/Improvement:hook-run 补进严格解析档(第40项) - 缺 hooks 报字段级故障,不再悄悄走宽松 (94432f75b6)
- 🚀 Feature/Improvement:T1 结局行加耗时自述(IHUI-T1-TIMING),任何结局都打印 (42ebca1640)
- 🚀 Feature/Improvement:终端 alt-screen 分屏记账(1049/1047/47;snapshot/search 按当前屏面取,read 仍原始流) (35cdbdfbaa)
- 📚 Docs:刷新生成块测试/跟踪文件计数(5934/23067) (1cf943b8b4)
- 🚀 Feature/Improvement:0.1.86 桌面源四平台直链全部切国内 Gitee,并补齐 Gitee 缺失资产 (fcee4f84fe)
- 🚀 Feature/Improvement:终端鼠标上报原语(mouse;DECSET 1000/1002/1003 由程序点单,四代坐标封装 1006/1015/1005/x10) (e6a0aecca1)
- 🚀 Feature/Improvement:钩子运行审计落盘(第39项) - 唯一观察者出口,publish_observation 只认 hook.run (821374dca5)
- 📚 Docs:README 生成块数字按 HEAD 面现算重钉(apiRoutes 4857→4860 / testFiles 5932→5933 / trackedFiles 23066→23067,本枚新增 3 个跟踪文件所致;数字块为生成物,值复现属有意重生成) (1a89078980)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (73ec39ea0a)
- 🚀 Feature/Improvement:推理档位随模型声明收敛 + 模型卡片视觉精修 (76fd92e6c7)
- 🚀 Feature/Improvement:会话级钩子累计读数(第38项) - 失败率/超时数/均值/峰值不受 50 条 FIFO 淘汰 (788f6b102b)
- 🚀 Feature/Improvement:mcp_server 注册五枚人事工具(自助四枚+月度算薪) (6b1e4000c0)
- 🐞 Fix:常驻开关图标改画状态,根治「置顶按钮看起来正好相反」 (ad7d24e57c)
- 🚀 Feature/Improvement:wait_for 支持 plain 判定面(按 strip_ansi 归一文本等提示符,治好「屏上写着却等不到」的假超时) (167a3f0cb3)
- 🚀 Feature/Improvement:打通人事薪资 AI 工具与自助端点(五工具+两专家包+月结汇总) (5dac9fe864)
- 🔧 Chore/Other:0.1.88 版本号(用于验证 0.1.87 起的自更新闭环) (2bcccca4cb)
- 🚀 Feature/Improvement:wait_for 支持 plain 判定面(按 strip_ansi 归一文本等提示符,治好「屏上写着却等不到」的假超时) (f1221475d0)
- 🐞 Fix:自更新安装器脱离 kill-on-close 作业(v0.1.87) (e5f0bb97d0)
- 📚 Docs:README 生成块数字按合流后 HEAD 面现算对齐(trackedFiles 23063 / llmModels 103) (654a21eade)
- 🚀 Feature/Improvement:子代理钩子结果接入 hook.run 观察通道(第37项) (97553bef3a)
- 🚀 Feature/Improvement:交互式终端输出缓冲上限可配(IHUI_TERMINAL_BUFFER_LINES,夹在 100..20000,缺省 2000),上限在 __post_init__ 落到 deque (6018b33e05)
- 🔧 Chore/Other:生成块按 HEAD 面现算值刷新(testFiles 5932 / trackedFiles 23062),解掉 push 文档数字对账红 (04e05a61e3)
- 🔧 Chore/Other:桌面更新源烘焙到 0.1.86(Windows 腿走 Gitee，字节一致) (56a71161dd)
- 🔧 Chore/Other:test(agent)+docs: 子代理钩子 5 例与报告 §5.37(第36项) (766a374820)
- 🚀 Feature/Improvement:交互式终端 close 收尾回报参数化(forced/survived + warning),不再把「发了信号」写成「进程已死」 (b2084b688e)
- 🚀 Feature/Improvement:补 HookKind SUBAGENT_START/STOP 与事件映射(第36项核心件,随派发侧同批) (323c8b12f5)
- 🚀 Feature/Improvement:交互式终端跟踪终端状态信号(窗口标题 OSC 0/1/2 + 响铃累计),并进会话账本与快照信封 (5daa841b9a)
- 📚 Docs:README 生成块数字按 HEAD 面现算对齐(trackedFiles 23061→23062 / llmModels 100→103) (eeb39b6b2d)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (e6c0a84119)
- 🚀 Feature/Improvement:交互式终端补 snapshot/search 原语(转义归一单一出口 strip_ansi,快照只留末尾 N 行并报 truncated,检索支持 regex/ignore_case) (03efb6052e)
- 🐞 Fix:补录财务三枚计算器工具本地化名与五语言文案(门55);滑块投影改唯一源档(门318);mcp_server import 排序 ruff 收敛(门263) (b97586f070)
- 🚀 Feature/Improvement:T1 判红时打印推送面/闭包面/脏面三格归因 (97d79523f3)
- 🚀 Feature/Improvement:deepseek-v41 代次误判修复 + 模态档(video 规则补 -video 泛化) + 出图/出片链路接通(/image-gen/generate 真调 Agnes,web 选中图像/视频档分流到生成端点并以工具卡上屏) + Sora 死兜底改显式拒绝(2026-09-24 已停服) (a495767f38)
- 🐞 Fix:chat 补 reasoningEffortReset 键 + financeAi 占位示例按语言本地化(en/ja/ko/zh-TW 去中文残留)(门2/2b/2c/2d/2e) (b3da998251)
- 🚀 Feature/Improvement:交互式终端补 paste 原语(bracketed paste 按程序 DECSET 2004 决策);并恢复被误删的 keys/wait_for/resize/eof 工具分支 (85ff50ba4b)
- 🚀 Feature/Improvement:推理强度只留上游可切换的四档,刷新模型列表按钮并进卡片头行 (52085d1369)
- 🔧 Chore/Other:0.1.86 版本号(用于验证 0.1.85 起的自更新闭环) (e50f7fc127)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (e188af794d)
- 📚 Docs:章节索引层改为行号现算+结构判绿,新增 --locate 现算行区间 (e2b0da9f9f)
- 🔧 Chore/Other:追认合并提交 9e647bab 的 AGENTS.md 追加行 (3c07d09343)
- 📚 Docs:生成块两行数字随第35项现算刷新(testFiles 5931 / trackedFiles 23061) (f18e364cf5)
- 🚀 Feature/Improvement:interrupt 钩子挂载点 + 同步钩子移出事件循环(超时真生效)(第35项) (158edb8775)
- ⚡ Perf:e2e 与 mypy 两条腿也走结论回执(T1 只剩包级 tsc) (a24c285ecc)
- 🐞 Fix:回补被财务矩阵五语重算冲掉的 errorCatalog 词包键(防丢闸点名)——TERMINAL_STDIN_CLOSED 三件套与 runtimeHookConfigStaleBy 五语各 4 键,值逐字取 origin/main 面(10ae0e76 补录),本席 7ddd03e 同型回补先例;修复 5133536968b 重算吃键回归 (32dbad346d)
- 🐞 Fix:修正上一提交把 base64 文本写进文件的问题(v0.1.85) | 自更新安装腿改走 CreateProcess 并检查结果，补 installMode quiet (d36598f30b)
- 🚀 Feature/Improvement:交互式终端 PTY interrupt 统一走 ^C 输入字节(不绕过 tty 直发信号) (3a03899b11)
- 🐞 Fix:合并树键级 union 修复 —— 补回 origin 侧 ai.pane 四键(×5 语言) (b6d71b97ba)
- 🚀 Feature/Improvement:交互式终端闲置会话回收(IHUI_TERMINAL_IDLE_TTL_S,回收逐条点名) (46ae0178d7)
- 🚀 Feature/Improvement:五腿财务矩阵接线收口 —— 报销/社保/专项附加 MCP 注册+专家包+强信号路由,前端三卡+i18n 五语,P0 跨员工累计预扣修复 (5133536968)
- 🐞 Fix:自更新安装腿改走 CreateProcess 并检查结果，补 installMode quiet (v0.1.85) (4cd7a29cc2)
- 📚 Docs:生成块 testFiles 5930 / trackedFiles 23060(按合并面现算) (6b6a9fb4f7)
- 🚀 Feature/Improvement:交互式终端 PTY 输出空闲即吐(TUI 帧不写换行时读端不再空等) (3bd2c756a9)
- 📚 Docs:生成块 testFiles 5929 / trackedFiles 23059(按并集面现算) (840ca89fb6)
- 📚 Docs:README 生成块按现算刷新 testFiles 5930 / trackedFiles 23057(门173) (11f35ecd41)
- 🚀 Feature/Improvement:交互式终端输出缓冲溢出显式报缺口(dropped_chunks/first_seq/gap) (a115138054)
- 🚀 Feature/Improvement:pre/post_model_request 钩子挂载点 + 重试不重复点火(第34项) (6a45975213)
- 🐞 Fix:补录 TERMINAL_STDIN_CLOSED 错误码与五语言词包(门94);README 四语言块外尾部保持已入库版本、块内 changelog 保留(门314/100) (10ae0e7691)
- 🐞 Fix:四平台下载直链全部切至 Gitee 国内通道(mac/linux 资产已补齐并逐字节对账) (fc1a7c2f1b)
- 🔧 Chore/Other:烘焙更新源为 0.1.84 (latest.json -> DESKTOP_LATEST, Windows 直链 Gitee 字节对账一致) (62b1e8bb4c)
- 📚 Docs:生成块 trackedFiles 23058(按字节补丁,保住三层水印) (0f9cfb114f)
- 📚 Docs:生成块 trackedFiles 23055→23058(按 HEAD 面现算,不改他席在飞的正文) (11a6570bf6)
- 🔧 Chore/Other:给逐包回执的两个新源文件补溯源水印(47p HEAD 面欠账) (6e3951d116)
- 🔧 Chore/Other:结清S-28两条(MiniMax mcode会话回灌revived:1本地cred44/生产cred45可调度healthy;OpenCode旧死行auto356已消失换新健康行auto:d9fbe94;修复DB-35后owner-map与账号导出两处email漏解密致跨环境owner翻译跳过;保活任务IHUI-Pool-Sync已重装健康) (7a026e3dd6)
- 🔧 Chore/Other:追认 03b12e2a 的 tmp 体积哨兵(按其提交日重签,去掉日期早于提交的那行) (62fa488050)
- 🔧 Chore/Other:追认 03b12e2a 的 tmp 体积哨兵(未声明改动,只读增收紧) (6ab11c17aa)
- ⚡ Perf:逐包类型结论回执——输入摘要未变的包不再重跑 tsc(T1 从"每次全量"降到"只跑变了的") (bbfc0b0773)
- 🚀 Feature/Improvement:新增 tmp 体积只读哨兵 check-tmp-bloat 并接 5 分钟周期腿;同枚重封根护栏清单 git-guardian 条目哈希 (03b12e2ae6)
- 🔧 Chore/Other:推理强度滑轨加粗到参考比例(14px 轨 + 20px 滑块) (b9dd413ffe)

**2026-11-20**
- 🚀 Feature/Improvement:推理强度改卡片式滑轨并上移到模型列表顶部 (03dcb232d6)
- 🐞 Fix:回补上一枚(3eba327)误删的 24 条键,推理强度新增三键保留 (7ddd03e371)
- 🚀 Feature/Improvement:推理强度补 ultra/默认/恢复默认三键(五语言同批) (3eba32725f)

**2026-11-21**
- 🔧 Chore/Other:style+fix: 交互终端测试按 ai-service ruff 分组收敛 import;deploy 脚本补 UTF-8 BOM(门 263/265) (1b98d3b948)

**2026-11-20**
- 🚀 Feature/Improvement:交互式终端补真终端身份键与 stdin EOF 原语 (d459cd24a2)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (fc7425978b)
- 🔧 Chore/Other:README 生成块 trackedFiles 按 HEAD 面现算对齐(23055) (826c7798c4)
- ⚡ Perf:catBatch 小集跳过尺寸预检 + 单规格走直取,6 把跨端尺派生 96→77、302p 104→82 (6a37acbeb4)
- 🔧 Chore/Other:README 生成块数字按现算刷新(AI服务路由/测试文件/跟踪文件,第31项新增文件所致) (44a7913ada)
- 🐞 Fix:启动时去掉空值代理环境变量,根治自动更新请求零发出(reqwest Proxy::all("") 使 build() 失败); bump 0.1.84 (9e4c61af65)
- 🚀 Feature/Improvement:交互终端补 keys（按键原语：转义序列与控制码字节通道） (b5444d02ab)
- 🚀 Feature/Improvement:选择器放开图像/视频/语音/OCR 模态模型，仍按代次过滤旧代 (c20431b785)
- 🔧 Chore/Other:按 ai-service 侧 ruff 配置重排测试文件 import 分组(isort 第一方组) (060817e433)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (9a2f3f0f54)
- 📚 Docs:数字块取对侧基线,合并后再按门现算重刷(消解合并时数字行的双侧同改) (d650a10004)
- 🐞 Fix:桌面更新源 Windows 直链改指 Gitee(匿名 200 且字节一致,实测 1.77MB/s vs GitHub 20KB/s) (5a8a4f02ba)
- 🔧 Chore/Other:README 生成块的跟踪文件数按 HEAD 面现算刷新(23051→23055) (4386b65592)
- 🔧 Chore/Other:追认 4b6ff40 的 AGENTS.md 体积清偿(未声明改动,已核逐字归档无条款删减) (efa8da085a)
- ⚡ Perf:faceList 的 HEAD 面清单改进程内备忘(整树一次+前缀筛),同一棵树问 N 次只派 1 次 ls-tree (e596f8db4b)
- 🐞 Fix:补录交互终端 4 个 errorCode + 五语言词包、ruff 收口测试文件、WS 断开清理去 .catch 链、README 数字对齐(门94/263/182/173) (69b073294d)
- 📚 Docs:门 207 体积清偿——26 行历史叙述逐字移入 archive/AGENTS_trim-2026-11-20.md，规则条款零删减 (4b6ff400f3)
- 🚀 Feature/Improvement:新增 README/PROJECT_PLAN 章节可寻址索引生成器与两件派生索引(按标题定位行号区间,--check 漂移校验) (b35d8a8415)
- 🔧 Chore/Other:README 生成块数字按 HEAD 面现算对齐(路由 685 / 测试 5928 / 跟踪 23051) (aa3f27382c)
- 🐞 Fix:代理解析候选由单端口扩为 7897/7900/7890(端口漂移曾致部署环 fetch 挂死停摆) (7a80d89ed6)
- 🐞 Fix:zh-TW PTY 标题去简体残留(平台→平臺) (8cb5f4abd8)
- 🚀 Feature/Improvement:173 的 DN5 改差值棘轮(push 档按推送面判责,不再被别席清单漂移顶回来) (8c3dd18680)
- 📚 Docs:落 api 腿承载结论与 webhook 面迁移说明 (3a5bc717f5)
- 🚀 Feature/Improvement:173 的 DN5 改差值棘轮(push 档按推送面判责,不再被别席清单漂移顶回来) (247e47d104)
- 🚀 Feature/Improvement:取消历史模型折叠区，旧代与专用用途模型一律不展示 (e9c2c4d273)

**2026-11-20**
- 🚀 Feature/Improvement:交互终端补 wait_for（expect 原语，命中/超时/已退出三态） (13502ec3cf)
- 🚀 Feature/Improvement:钩子配置只读自述端点 + 面板未生效提示(第31项) (910b5e3d56)
- 🐞 Fix:REST/SSE 基址改走 EdgeOne 承载的 www 臂(WS 仍钉 api 子域) (b03a443ed5)
- 🔧 Chore/Other:README 生成块 trackedFiles 23049 刷新 (c759895ef3)
- 📚 Docs:落 api 腿承载结论与 webhook 面迁移说明 (a0ac4cc111)
- 🐞 Fix:ai-endpoints 派生件按新 HEAD 面重钉(端点数据行零改动) (234bb2c119)
- 🔧 Chore/Other:给 8c87943 补具名追认(gate-body 无签名阻塞全仓 push) (c0257b063f)
- ⚡ Perf:47 全量面 blob 装箱上限放大,块数 9+ → 2 (efe4acf74a)
- 🐞 Fix:结清 Y-73 hygiene尺人工问责出口(H3判据从祖先76599d688还原,--strict/--json三维实测,16/18自测绿;出口2 LAND_ALLOW_STALE 因trailer超长) (8c87943bf5)

**2026-11-20**
- 🚀 Feature/Improvement:交互终端补窗口尺寸 resize（POSIX TIOCSWINSZ / Windows ResizePseudoConsole） (c1c9cb39d2)
- 🔧 Chore/Other:部署环 fail-closed 复核——guardian-executor 清单按 HEAD 面 blob 重封(判据语义零改动) (e3e8882f31)
- 🐞 Fix:收录 TERMINAL_PTY_UNSUPPORTED_ON_PLATFORM 错误码 + 五语言词包(守门 94 R1) (1dad924450)
- 🚀 Feature/Improvement:hook.run 逐钩子运行结果前端消费面 + 报告 §5.31(第30项) (4d3aa6a635)
- 🔧 Chore/Other:README 生成块数字刷新(testFiles 5927 / trackedFiles 23048 / aiServiceRoutes 684) (d5afd8a89c)
- ⚡ Perf:30a 整面 raw 读数预启动,与 fsck 并发、失败回落同步档 (636b82d012)
- 🐞 Fix:端点派生件(ai-endpoints/api-endpoints)按新 HEAD 面重钉 —— 正文零改动 (47de80224d)

**2026-11-20**
- 🚀 Feature/Improvement:交互终端补 Windows 原生 ConPTY 后端（零依赖 ctypes 直连 kernel32） (bec840f434)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (d1aee8dad7)
- 📚 Docs:生成块数字按 HEAD 面现算再对齐 (6054eeff81)
- ⚡ Perf:298 逐字档与 HEAD 面收口,派生 217→110、单跑 94s→53s (8dd06139b0)
- 🐞 Fix:桌面端更新源快照刷新到 0.1.83(发版后 feed 未跟进) (1da8af80ed)
- 📚 Docs:采用远端生成数字块(解除合并吞行判红,数字随后按 HEAD 面重算) (08fe0f75d6)
- 🐞 Fix:桌面端更新源快照刷新到 0.1.83(发版后 feed 未跟进) (f130e93e23)
- 🚀 Feature/Improvement:PRE/POST_COMPACT 压缩前后钩子接入压力判据闸 (db79c5c3a8)
- 🔧 Chore/Other:烘焙 desktop-v0.1.83 更新清单到站点快照 (1b5772276c)
- 🐞 Fix:页面控制族补齐 page_scroll / page_wait_for / page_drag —— 消除"静默少能" (03d2ee243f)
- 🔧 Chore/Other:刷新 README 生成块数字(trackedFiles/testFiles/aiServiceRoutes,唯一写入口 sync-readme-numbers) (b11c475dfa)
- 📚 Docs:生成块数字按 HEAD 面现算再对齐 (fe24a96eec)
- ⚡ Perf:fsck 预启动并行化(76.2s->46.1s) (800a8d4be0)
- 🚀 Feature/Improvement:号池模型接入目录代次判定，旧代与平台目录同口径过滤 (ed623c2009)
- 🚀 Feature/Improvement:STOP 钩子接入正常完成哨点(block 续跑一段,硬上限 1) (f8a9300e7e)
- 🐞 Fix:结清 Y-86 agent-heat 详情端点时区错位(UTC改业务日键bizDayKey,北京00-08点不再漏最新一天;跨时区边界用例5/5) (fa601aab6e)
- 🐞 Fix:sandbox 本地执行异常路径不再抛 UnboundLocalError + test_timeout 补齐全形态 mock (eb3045a7d8)
- ⚡ Perf:三道全仓扫描门并入快档重型清单(151/173/158) (490dcb405a)
- ⚡ Perf:候选遮罩去重 + grep 按扩展名收窄(23.2s->11.9s) (75ebcdf107)
- 🐞 Fix:结清 Y-83/Y-84/Y-91/Y-92/Y-96 五张缺陷普查票(凭据收割确认闸+MachineGuid备份HMAC防伪+terminal锁中毒防护+to_value错误传播+work-panel sync 顶层catch) (832411eb5c)

**2026-11-20**
- 🚀 Feature/Improvement:交互终端补真 PTY 后端(POSIX stdlib pty,默认关,零依赖,Windows fail-closed) (77fcb6df0c)

**2026-11-20**
- 🐞 Fix:web 三枚测试收 import() 内联类型标注(3 处 consistent-type-imports error 归零) (978a82aee8)
- 📚 Docs:生成块数字按 HEAD 面现算刷新(testFiles 5923 / trackedFiles 23042) (87df195c99)
- 🚀 Feature/Improvement:SESSION_START/USER_PROMPT_SUBMIT 生命周期钩子接入会话入口 (7a794bdb97)
- 🐞 Fix:更新链失败/成功双路径全量留痕(手动检查也落原始错误串) (42aaf9b26f)
- ⚡ Perf:合并枚逐父交集整批读(本门单跑 8.3s→6.4s) (4ca6b55c95)
- 🐞 Fix:模型选择器分组标题不再强制大写(品牌名按原样显示) (7cb1ed21ba)
- 🐞 Fix:AIS-064 漏同步的 4 枚审批 stub 补 _wait_interruptible 透明等待(19 例复活) (e0f3eb8f2d)
- 📚 Docs:更正本席 §5 对候选②的事实性判错——interactive_terminal.py(11-14 立)已做长寿命交互终端(open/send/read/signal/close/list+WIN CTRL_BREAK+身份归属,越权与不存在同形),非"零落地待拍板";唯一升级"管道 vs 真PTY"是模块 docstring 有意记录的沙箱受控面差异(补需原生PTY库+改 strict env 白名单),须机主拍板不由本席自补;③perf 已对等(sandbox_metrics/agent_metrics/turn_timing/startup_prewarm);①OS进程树快照无现成消费点按 §0.9 不立项,§5 三枚原生候选同步改为逐枚实测态 (49fbc65617)
- ⚡ Perf:T1 无 TS 输入面判定提前到建图之前(scripts 面 4.1s→0.23s) (24953b857c)
- 📚 Docs:生成数字块随新增测试文件刷新(testFiles 5922/trackedFiles 23041) (e755d5499b)
- 🚀 Feature/Improvement:钩子运行结果进 SSE 通道(hook.run/hook-run) (0cb1a8d7e9)
- ⚡ Perf:193 记忆化扩到索引面(staged 也按 oid 复用) (a418864254)
- ⚡ Perf:193 逐文件判定按 blob oid 记忆化(5.9s→0.7s,批次内不再重扫 46MB) (25e0fa8b43)
- 🔧 Chore/Other:版本 bump 0.1.83 —— 发布含小尺寸图标回退与能力收紧的正式包 (fea8382938)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (9d65736750)
- 🚀 Feature/Improvement:PermissionRequest 审批前置裁决(allow免弹窗/deny零副作用) + 报告§5.26 (fe4afc56c2)
- 📚 Docs:WB 全量册补"命令审计档(deepseek default|allow|deny|audit 四值)已对等/更全"——_exec_mode=audit+cli-tool-invoke-audit HMAC链三处行号证伪负结论 (1a12e9cc63)
- ⚡ Perf:T1 面裁剪 —— 非 TS 输入不参与判定(混合面 235.8s→7.6s) (01d3a0ec78)
- 🐞 Fix:STEP_DECISIONS 补齐 pre_tool_use 钩子两枚裁决词并五语言同批挂键 (8f5e6cde48)
- ⚡ Perf:47p 收窄档改进程内扫描(4.2s→1.3s) (4accb04bee)
- 🐞 Fix:两枚端点派生件按新 HEAD 面重钉 —— 不在脏工作树跑生成器 (0e83258b53)
- 🐞 Fix:测试 schema 进程级回收 —— 每跑一次 pytest 不再永久多几个 sess_<hash> (f54c7d6f21)
- ⚡ Perf:T1 直调扩到多段与 no-op 桩(api 两段 tsc、ai-service echo) (7193f5e859)
- 🔧 Chore/Other:结清 9 条回潮票行(RP-7/RP-6/RP-79/RP-37/B91/Y-37/RP-80/Y-82/Y-14)——纯删 9 行零新增,RP-81 旧行回潮已剔除 (2e8363b800)
- ⚡ Perf:T1 定向档直调 app 本地 tsc(摘掉 pnpm 冷态 114s 尖峰) (56fa38903f)
- 🐞 Fix:重放 required check 四条红修复到 origin tip —— 原枚 47624a37 被并发收敛挤掉 (04c87937b9)
- 🔧 Chore/Other:结清 RP-81(CI发版通知IM通道——Server酱通用push通道已落地+secret已写入+真发验证,完成即删) (ecb92c4fde)
- 🚀 Feature/Improvement:审计脚本机读档不再被结论行污染 + CI 探测 pg_trgm 能力 (8b7d6162aa)
- 🐞 Fix:待确认指令提示只在草稿要重复时才出现,平时零占高 (a4e98a3645)

**2026-11-20**
- 🐞 Fix:自动更新链路根治(首检提前到 5 分钟 + 失败必留痕 + 退避重试) (581d078c31)
- 🚀 Feature/Improvement:updatedInput 真正替换工具入参(过守卫后再改写) + 报告§5.25 (3daac7de3e)
- 📚 Docs:RP-7 行尾补「性能决策」一句(恢复后外部正证 + 定论,其余零改动) (95e53b326a)
- 🚀 Feature/Improvement:RP-81 发版通知接 Server酱通用 push 通道(重落:前枚被收敛挤掉) (f46d674e8c)
- 🔧 Chore/Other:为合并枚登记具名追认一行(AGENTS.md 活文档行 union) (3a1ee1181d)
- ⚡ Perf:stale-baseline sentinel 25.5s -> 3.1s (4f7a419ac7)

**2026-11-20**
- 🐞 Fix:relay-models-sync 下架写入改先比现值再写(消盲写棘轮新增) (daf3f16745)
- 🐞 Fix:heal-tunnel-service.ps1 补 UTF-8 BOM(正文零改动) (9331cfd9a0)

**2026-11-20**
- 🔧 Chore/Other:root-guard 清单按 origin tip 面重封(guardian-runner/guardian-executor 两条脱钩) (e2636202c8)
- 🚀 Feature/Improvement:PreToolUse permissionDecision(allow/ask)前置到审批门 + 报告§5.24 (f0bf2104f3)
- 📚 Docs:trackedFiles 23039→23040 对齐 63d02cfd(新增 workbuddy-5114 全量取证册 1 枚跟踪文件);取数唯一入口 readme-align-from-tree,对象空间落地不卷他席在飞 (7c31f1767c)
- 📚 Docs:trackedFiles 按 HEAD 面现算对齐 (8f0d652766)
- 📚 Docs:WorkBuddy 5.11.4 agent-harness 全量图谱 + 原生 addon 层首扫取证 (63d02cfdfb)
- 📚 Docs:生成块 trackedFiles 对齐 HEAD 现算(23031 -> 23032) (ebd3afbd85)
- 📚 Docs:trackedFiles 按合并后 HEAD 面现算对齐(23039) (43165f296b)
- ⚡ Perf:push face content prefilter + 301 trigger narrowed to route tree (f8ba4e1ea8)
- 🚀 Feature/Improvement:/health/ready 暴露会话存储后端(trgm/like)与 schema,且探活不建库 (a1de82b905)
- 🐞 Fix:CloudflaredApi 隧道服务自愈(服务非 Running 即幂等拉起) (cfd91e244d)
- 📚 Docs:重算生成块数字(testFiles/trackedFiles)以对齐本机 HEAD 面 (f96e94e46d)
- 📚 Docs:生成块 trackedFiles 23028→23031(并发会话新增 3 个跟踪文件,按 HEAD 现算重钉) (ba250b8d73)
- ⚡ Perf:尾部三段改为在 push 门批次之前起飞,与门批次重叠 (c83b0b959d)
- 📚 Docs:生成块数字按合并后 HEAD 面现算对齐(testFiles 5920 / trackedFiles 23033) (fc9133a428)
- 🔧 Chore/Other:结清 Y-82(C盘残留清理,现读22项全不存在目标已达成,完成即删) Y-82登记@11-15的22项残留(全profile递归现读:6文件False ihui-check-401/curl/redis/tenant.ps1+ihui-push.pack/ihui-relay2.pack,16个ihui-wt-escape-*目录count=0,连保留项IHUI-GIT-GUARD/scratch-root也不存在)——票面整套环境已不在本机,清理目标事实上达成无需再删;主会话已亲自复核确认。PROJECT_PLAN仅删此1行/0增,未勾行11→10 (2dbf52a8fa)
- 📚 Docs:.env.example 补会话存储三键与旧 schema 审计入口 (9cb119808d)
- 🚀 Feature/Improvement:BUG-29 索引补齐切片2 + 四格对账判据 格1外键列无索引:新迁移20261120110000_bug29_indexes_slice2.sql补15处,CREATE INDEX IF NOT EXISTS索引名全局唯一/表列全存在,附DROP回滚;journal仅追加idx439 新判据bug29-reconcile.mjs四格对账,反向测试4/4绿(旧判据漏检格1无索引被新判据检出);格3 audit-missing-indexes missing=[];五包幂等通过 格2唯一真缺hr_employee_link_request.user_id与格4的15处DDL类型冲突须机主生产库执行/复核,agent不代跑 注:对象空间落地(共享树孤儿rebase中+文档数字门点名他席staged README,pathspec进不了其内容) (0ba0d71841)
- ⚡ Perf:pre-push 尾部三段(哨兵/数字门/i18n)改并行起飞、按原序收口 (b448d5f9fa)
- 📚 Docs:生成块数字按 HEAD 面现算对齐(testFiles 5920 / trackedFiles 23033) (95face7d06)
- 🚀 Feature/Improvement:会话库按 db_path 现算旧 schema 名并原地接管(不是从库面上猜) (26181fef49)
- 🚀 Feature/Improvement:PostToolUse 产出改写面(updatedMCPToolOutput)接进执行链 + 报告§5.23 (98065763eb)
- ⚡ Perf:T1/IG 并入 push 并行池,破例理由与判据写在白名单注释里 (eefc3f2c05)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (086bb4100f)
- 🐞 Fix:给 check-sqlite-write-paths 的两处 git 派生补显式 stdio (abae812b12)
- 📚 Docs:生成块 trackedFiles 23027→23028(本轮新增旧 schema 审计尺子) (fd28849f59)
- ⚡ Perf:push 面重门收进只读并行池 (145ff02a4a)
- ⚡ Perf:pg-only 预筛提速 + 会话检索后端可观测 + 旧 schema 审计尺子 (7e35880fd5)
- 🐞 Fix:ai-endpoints 派生件按 HEAD 面重钉 —— 输入 codex_plugin_license_audit.py 已删除致钉块陈旧 (fdc68fd0ca)

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
