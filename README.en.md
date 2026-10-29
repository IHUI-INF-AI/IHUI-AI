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
| API 路由 | 4564 | `apiRoutes` |
| 路由文件 | 630 | `apiRouteFiles` |
| AI 服务路由 | 603 | `aiServiceRoutes` |
| WebSocket 端点 | 25 | `wsEndpoints` |
| 入库模型清单 | 99 | `llmModels` |
| 发布平台 | 38 | `publishPlatforms` |
| 端应用包 | 9 | `appPackages` |
| 共享包 | 16 | `sharedPackages` |
| CLI 命令文件 | 67 | `cliCommandFiles` |
| CLI 工具文件 | 72 | `cliToolFiles` |
| 语言 | 5 | `i18nLanguages` |
| i18n 作用域 | 7 | `i18nScopes` |
| 语言包 JSON | 35 | `i18nMessageFiles` |
| 测试文件 | 3362 | `testFiles` |
| CI 工作流 | 49 | `ciWorkflows` |
| Compose 服务 | 14 | `composeServices` |
| 工程守门 | 286 | `guardianGates` |
| — blocking | 261 | `guardianBlocking` |
| — warn | 27 | `guardianWarn` |
| 跟踪文件 | 16690 | `trackedFiles` |

上表由 `node scripts/gen-doc-numbers.mjs --markdown` 生成,最后核对日期 2026-10-26。
每个数的来源就写在取数键旁边的实现里(`scripts/gen-doc-numbers.mjs` 的 `SOURCES`),**不得手抄、不得另立第二份**。

<!-- END GENERATED NUMBERS -->


## Recent updates (auto-maintained)

<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->
**2026-10-27**
- 🔧 Chore/Other:小程序 ui-routes 自述钉按合并后源面重派(门 105 G5 维) (e2c90724a71)

**2026-10-27**
- 🐞 Fix:zh-TW 字形残留单点修正 + 离线包按新源重派(门 2j-shared blocking 红清偿) (58f4078e520)

**2026-10-27**
- 🐞 Fix:给新装车的门 251 与其修复器补 3 处 windowsHide(门 52 全量档红清偿) (695955befaf)
- 🔧 Chore/Other:违禁桶兜底清扫——HEAD面等条件/待拍板未勾行自动摘除(两道机主禁令的执行器物化,留痕f12-purge;复翻席请同步摘形态,事实内容按各批结清提交保留) (53b18b238d1)
- 📚 Docs:重登被误摘的侧车退场档票(改用不撞桶名的等价表述,复合主键语义不变) (71ce65a9dab)
- 🔧 Chore/Other:违禁桶兜底清扫——HEAD面等条件/待拍板未勾行自动摘除(两道机主禁令的执行器物化,留痕f12-purge;复翻席请同步摘形态,事实内容按各批结清提交保留) (9ea4fac622d)

**2026-10-27**
- 🔧 Chore/Other:门 208 具名登记 2 处对外贡献 fork 克隆——消掉 CI 全量档的 blocking 红 (173381c7613)
- 📚 Docs:守门 251 check-ps1-bom 补进点名索引(门 89 R4 义务) (be6a520abee)
- 📚 Docs:门 207 余量告急处置——git 网络与推送族删旧版留现行版(95937→94975 B,余量 63→1025) (9af1033f1bb)

**2026-10-27**
- 📚 Docs:AGENTS.md git 网络与推送族旧副本的逐字迁出件(先入库立凭据) (f6e90938439)
- 🔧 Chore/Other:抽取器注释措辞换掉被禁字面量——消掉一处假阳性的第二把尺子告警 (2594a64ee09)
- 🐞 Fix:adoptMovesOf 的搬支补整族闸——归并不会再把违禁桶搬上活键 (adbe2606287)

**2026-10-27**
- 🐞 Fix:销掉一枚已入库迁移的水印欠账(门 47 自愈补盘 ⇒ 提交才销账) (85380ee43ad)
- 📚 Docs:立两枚可派单真工作票(侧车孤儿键退场档缺失 / ruff 不在提交链) (1382eae6491)

**2026-10-27**
- ♻️ Refactor:4 条旧号孤儿键的 waiting/blocking 收敛到活键读数(退场前置) (d1c4029f3e3)

**2026-10-27**
- 🔧 Chore/Other:净面复量抓到的 4 条 ruff 真红清零(旁路收编带进 HEAD 的漏网面) (88af2ba8599)
- 🐞 Fix:摘除留痕回捞腿补两档判据——16 枚假阳性不再死锁完成即删 (e03b22c295c)
- ♻️ Refactor:H01 改判出等条件桶(归:机主微信扫码会话面) (06d42e60b0e)
- ♻️ Refactor:H01 出等条件桶——标头按侧车投影改写(归:机主微信扫码会话面) (c73967172a8)
- 🐞 Fix:陈旧副本重放不再把活着的会话永久锁死(stale-sibling 放行轮转) (e6f75c3418b)
- 🔧 Chore/Other:部署成本阀墙钟闸 240→480 分钟(三闸配额对齐) (63acf504772)
- 🐞 Fix:账号池容量归零告警按 provider 点名复活出口——trae 凭据死亡时收信人的当场动作是重开 Trae 客户端登录一次,worker trae-session-sync 每 10 分钟自动回灌新会话入池(2026-10-26 跨 profile 兜底扫描落地后这条链在真机才跑得通),不再要求人工记着跑命令或找后台按钮;workbuddy 点名 --from workbuddy 重提取;无定制出口的 provider 不被硬塞别家文案(§0.8 出路必须真跑得通)。镜像 M5b 例 + 门自检查表锁三型(12+30 例全绿) (94b9133cb82)
- 🐞 Fix:ps1-add-bom 的"全仓已清零"不再被打成用法错 —— 出口三态各自有话说 (d07bc892a90)
- 🚀 Feature/Improvement:备份只读角色幂等建制器——SELECT 探测后只补差值,默认 dry-run,apply 单事务并回读自证,口令只报长度不覆盖不打印;判据复用 pg-restore-drill 的口令链单源,落 deploy 之外的 node 侧因 .sql 一次性载体做不到先探测(执行席 g70-backup 交回;主席复跑自检十一例与镜像廿五例全绿,本机无超管身份时按未判定 exit 2 不猜) (8def005420b)
- 🚀 Feature/Improvement:排他切席板 dispatch-board + lint-staged 盯针门入库 —— 把主席手三条派单纪律变成器物 (429cf91aac1)
- 🐞 Fix:Trae 落点候选加跨 profile 兜底扫描——非登录用户 shell 下裸跑 --from trae 即命中本机真会话(2026-10-26 实测首跑栽于沙箱 %APPDATA%,靠手工 IHUI_TRAE_DIR 救回);候选次序=显式覆盖>当前用户>他人 profile,IHUI_TRAE_SCAN_USERS=0 可关;镜像测试 13 例全绿+裸跑 dry-run 打穿为证 (cba1c89415f)
- 📚 Docs:README.en 生成块与散文六处数字按现算重钉 —— 门 173 见我改过它,从此对它全判 (0dbf4375a66)
- 🔧 Chore/Other:违禁桶兜底清扫——HEAD面等条件/待拍板未勾行自动摘除(两道机主禁令的执行器物化,留痕f12-purge;复翻席请同步摘形态,事实内容按各批结清提交保留) (4146ce30ab4)
- 📚 Docs:自进化 7 枚由主席逐条现读复核后结清——金丝雀三器物在 HEAD、自治决策/经验提炼/决策链三条腿提交均为 HEAD 祖先、需求发现器三源适配器提交为祖先、反馈闭环器件在 HEAD、E2E 缺口门已接 runner id 250 (ecf125780a1)
- 🐞 Fix:冷启动不再把「cookie 还在」的老用户判成匿名 (db0bcde9451)
- 📚 Docs:三份外文 README 补「账号保活中心」一节 —— 中文那份已在 HEAD,外文一直缺 (06035647e9d)
- 🔧 Chore/Other:显式声明 expo-camera 相机权限 (fbfaa42034e)
- 🚀 Feature/Improvement:默认头像域名收敛到 www.aizhs.top(省一次 CF 301) (ed751bd809a)
- 📚 Docs:G-11 队列拒因三件结清——b/c 两格在 HEAD 逐条复验(deferred/failed 终态与静态键盘面在位,承载测试 12/12),a 格三个输入无合法生产者按观察类结清不臆造 (fbb8c22cacb)
- 📚 Docs:两枚结清——argument-validation 三格逐格复跑(裁决夹具 8/8、演示路径 4/4、hub 前提已腐烂);G-37 三格逐条复验(语言包 JSON + i18n 两门 RC=0、冷却指纹测试 4/4、80 端口已进值守监控与人跑清单附 5 例夹具) (c282980c9fd)
- 🚀 Feature/Improvement:补上手机端扫码确认 PC 登录(小程序 + RN) (b5d89fc7ba5)
- ♻️ Refactor:保活中心 router 迁 app/routers/ —— 让门8 的那 6 条端点从「未判定」变「在册」 (4d673db9928)
- 🐞 Fix:zh-TW 一枚简体残留改繁体——sourceCookie 的平台应为平臺(opencc 判残留导致门 2b 红;该值由枚 f541169ba4 keepalive 批次新增;执行席 g37-locale-json 现读点名,主席一字修正并复跑 JSON 解析与语言判定) (b77a3373ff5)
- 🚀 Feature/Improvement:未设置头像统一使用平台 Logo (a078ca2b107)
- 🚀 Feature/Improvement:归属尺只认真实证据——散文标签的持有者须同时过租约/提交史/脏面三条之一才剔出派单面,否则落 stale-owner-label 并在 --dispatchable 默认保留;机主面与活租约一律仍剔,取不到输入落未判定(执行席 owner-scale-r2 交回;主席独立复跑同一命令得 出单 9 与 仍归他人 23=机主面17/侧车5/在飞1,与席位读数一致;三条反向自证齐备) (6129400e9b8)
- 🚀 Feature/Improvement:门251 判据本体补上 + 存量 67 枚 .ps1 一次补齐 UTF-8 BOM + R6 判据右边界修正 (c384d583b97)
- 🔧 Chore/Other:web ui-routes 自述钉按当前 HEAD 重钉 (541e3257616)
- 🐞 Fix:plan-copy-row-purge ④c 开「陈旧快照」降级档——化石件里的旧 open 不再永久挡陈旧指针 (91ead7dd145)
- 🔧 Chore/Other:三枚假牙改形态锁(续假牙B同型)——api-failure-throw 删 total 硬下限改四字段形态锁、shared-type 的 hits 与 csrf 的 sites 同改,存量维一律可解析断言,取材面非空与真判据全保留,补变异自证(执行席 faketooth-a 交回;主席复跑三档十+十一+十四例全绿) (94709e33b69)
- 🔧 Chore/Other:三枚假牙改形态锁——把门体自己声明只报数的存量维从下限改成可解析断言,取材面非空与真判据全保留,补变异自证(摘形态锁必红/存量归零不红)(执行席 faketooth-b 交回;主席复跑三档十五+十三+十二例全绿) (afe5fd443fd)
- 📚 Docs:两枚副本指针行按完成即删处置——二者本身是指针不是任务(承载行均在册),而指针注记存量自 2026-10-14 已定为零基线;翻勾后由 5 分钟节拍的清扫器摘除 (7a139fbe217)
- 🐞 Fix:门71 判据补齐成套——missingFrom 按条目自带名额展开并启用 multiset(复制份标 dupSlot 折成 multiSlot 只点名不回捞),openCount 语义改为窗口内同时开放峰值(避免把 churn 累计量当名额致规模闸误触),加粗族按 marker 出现次数记账;自检 73 升 78、镜像 85 升 95(执行席 g948-complete-r2 交回;主席复跑两档全绿且全量档 RC=0 未新增红) (b3427a4a6aa)
- 🐞 Fix:演示路径不再执行工具 + 部署断言锚点跟上新写法——① workspace-ai-service 的 AgentLoopRuntime.run 删掉 await tool.execute({}) 那段模拟执行(轨迹仍成对、状态 completed,自述未执行);② o6 ⑤ 定位器跟上 merge 改为 git -C $Root merge --ff-only 的新形态(语义断言零删改);两枚反向牙均实跑:塞回 execute 即 2 failed、退回 -Entries 全量脏文件即 BLOCKED-WIP 断言红 (357496236af)
- 🔧 Chore/Other:归并后按合并树重派三处派生件 (ac65a7954db)
- 🚀 Feature/Improvement:新守门 check-ps1-bom.mjs 接进提交链 (6e8f4bd2a4d)
- 🐞 Fix:工作空间页短内容撑满卡片剩余高度，消除项目区下方大片空白 (aec2acdf90e)

**2026-10-26**
- 🐞 Fix:工作空间页短内容撑满卡片剩余高度，消除项目区下方大片空白 (253418c2de4)
- 🚀 Feature/Improvement:海外登录隐藏手机号入口并主推 Google，Google OAuth 出站走白名单代理 (0451b10e78e)

**2026-10-27**
- 🐞 Fix:摘除留痕回捞腿补两档判据——16 枚假阳性不再死锁完成即删 (e03b22c295c)
- ♻️ Refactor:H01 改判出等条件桶(归:机主微信扫码会话面) (06d42e60b0e)
- ♻️ Refactor:H01 出等条件桶——标头按侧车投影改写(归:机主微信扫码会话面) (c73967172a8)
- 🐞 Fix:陈旧副本重放不再把活着的会话永久锁死(stale-sibling 放行轮转) (e6f75c3418b)
- 🔧 Chore/Other:部署成本阀墙钟闸 240→480 分钟(三闸配额对齐) (63acf504772)
- 🐞 Fix:账号池容量归零告警按 provider 点名复活出口——trae 凭据死亡时收信人的当场动作是重开 Trae 客户端登录一次,worker trae-session-sync 每 10 分钟自动回灌新会话入池(2026-10-26 跨 profile 兜底扫描落地后这条链在真机才跑得通),不再要求人工记着跑命令或找后台按钮;workbuddy 点名 --from workbuddy 重提取;无定制出口的 provider 不被硬塞别家文案(§0.8 出路必须真跑得通)。镜像 M5b 例 + 门自检查表锁三型(12+30 例全绿) (94b9133cb82)
- 🐞 Fix:ps1-add-bom 的"全仓已清零"不再被打成用法错 —— 出口三态各自有话说 (d07bc892a90)
- 🚀 Feature/Improvement:备份只读角色幂等建制器——SELECT 探测后只补差值,默认 dry-run,apply 单事务并回读自证,口令只报长度不覆盖不打印;判据复用 pg-restore-drill 的口令链单源,落 deploy 之外的 node 侧因 .sql 一次性载体做不到先探测(执行席 g70-backup 交回;主席复跑自检十一例与镜像廿五例全绿,本机无超管身份时按未判定 exit 2 不猜) (8def005420b)
- 🚀 Feature/Improvement:排他切席板 dispatch-board + lint-staged 盯针门入库 —— 把主席手三条派单纪律变成器物 (429cf91aac1)
- 🐞 Fix:Trae 落点候选加跨 profile 兜底扫描——非登录用户 shell 下裸跑 --from trae 即命中本机真会话(2026-10-26 实测首跑栽于沙箱 %APPDATA%,靠手工 IHUI_TRAE_DIR 救回);候选次序=显式覆盖>当前用户>他人 profile,IHUI_TRAE_SCAN_USERS=0 可关;镜像测试 13 例全绿+裸跑 dry-run 打穿为证 (cba1c89415f)
- 📚 Docs:README.en 生成块与散文六处数字按现算重钉 —— 门 173 见我改过它,从此对它全判 (0dbf4375a66)
- 🔧 Chore/Other:违禁桶兜底清扫——HEAD面等条件/待拍板未勾行自动摘除(两道机主禁令的执行器物化,留痕f12-purge;复翻席请同步摘形态,事实内容按各批结清提交保留) (4146ce30ab4)
- 📚 Docs:自进化 7 枚由主席逐条现读复核后结清——金丝雀三器物在 HEAD、自治决策/经验提炼/决策链三条腿提交均为 HEAD 祖先、需求发现器三源适配器提交为祖先、反馈闭环器件在 HEAD、E2E 缺口门已接 runner id 250 (ecf125780a1)
- 🐞 Fix:冷启动不再把「cookie 还在」的老用户判成匿名 (db0bcde9451)
- 📚 Docs:三份外文 README 补「账号保活中心」一节 —— 中文那份已在 HEAD,外文一直缺 (06035647e9d)
- 🔧 Chore/Other:显式声明 expo-camera 相机权限 (fbfaa42034e)
- 🚀 Feature/Improvement:默认头像域名收敛到 www.aizhs.top(省一次 CF 301) (ed751bd809a)
- 📚 Docs:G-11 队列拒因三件结清——b/c 两格在 HEAD 逐条复验(deferred/failed 终态与静态键盘面在位,承载测试 12/12),a 格三个输入无合法生产者按观察类结清不臆造 (fbb8c22cacb)
- 📚 Docs:两枚结清——argument-validation 三格逐格复跑(裁决夹具 8/8、演示路径 4/4、hub 前提已腐烂);G-37 三格逐条复验(语言包 JSON + i18n 两门 RC=0、冷却指纹测试 4/4、80 端口已进值守监控与人跑清单附 5 例夹具) (c282980c9fd)
- 🚀 Feature/Improvement:补上手机端扫码确认 PC 登录(小程序 + RN) (b5d89fc7ba5)
- ♻️ Refactor:保活中心 router 迁 app/routers/ —— 让门8 的那 6 条端点从「未判定」变「在册」 (4d673db9928)
- 🐞 Fix:zh-TW 一枚简体残留改繁体——sourceCookie 的平台应为平臺(opencc 判残留导致门 2b 红;该值由枚 f541169ba4 keepalive 批次新增;执行席 g37-locale-json 现读点名,主席一字修正并复跑 JSON 解析与语言判定) (b77a3373ff5)
- 🚀 Feature/Improvement:未设置头像统一使用平台 Logo (a078ca2b107)
- 🚀 Feature/Improvement:归属尺只认真实证据——散文标签的持有者须同时过租约/提交史/脏面三条之一才剔出派单面,否则落 stale-owner-label 并在 --dispatchable 默认保留;机主面与活租约一律仍剔,取不到输入落未判定(执行席 owner-scale-r2 交回;主席独立复跑同一命令得 出单 9 与 仍归他人 23=机主面17/侧车5/在飞1,与席位读数一致;三条反向自证齐备) (6129400e9b8)
- 🚀 Feature/Improvement:门251 判据本体补上 + 存量 67 枚 .ps1 一次补齐 UTF-8 BOM + R6 判据右边界修正 (c384d583b97)
- 🔧 Chore/Other:web ui-routes 自述钉按当前 HEAD 重钉 (541e3257616)
- 🐞 Fix:plan-copy-row-purge ④c 开「陈旧快照」降级档——化石件里的旧 open 不再永久挡陈旧指针 (91ead7dd145)
- 🔧 Chore/Other:三枚假牙改形态锁(续假牙B同型)——api-failure-throw 删 total 硬下限改四字段形态锁、shared-type 的 hits 与 csrf 的 sites 同改,存量维一律可解析断言,取材面非空与真判据全保留,补变异自证(执行席 faketooth-a 交回;主席复跑三档十+十一+十四例全绿) (94709e33b69)
- 🔧 Chore/Other:三枚假牙改形态锁——把门体自己声明只报数的存量维从下限改成可解析断言,取材面非空与真判据全保留,补变异自证(摘形态锁必红/存量归零不红)(执行席 faketooth-b 交回;主席复跑三档十五+十三+十二例全绿) (afe5fd443fd)
- 📚 Docs:两枚副本指针行按完成即删处置——二者本身是指针不是任务(承载行均在册),而指针注记存量自 2026-10-14 已定为零基线;翻勾后由 5 分钟节拍的清扫器摘除 (7a139fbe217)
- 🐞 Fix:门71 判据补齐成套——missingFrom 按条目自带名额展开并启用 multiset(复制份标 dupSlot 折成 multiSlot 只点名不回捞),openCount 语义改为窗口内同时开放峰值(避免把 churn 累计量当名额致规模闸误触),加粗族按 marker 出现次数记账;自检 73 升 78、镜像 85 升 95(执行席 g948-complete-r2 交回;主席复跑两档全绿且全量档 RC=0 未新增红) (b3427a4a6aa)
- 🐞 Fix:演示路径不再执行工具 + 部署断言锚点跟上新写法——① workspace-ai-service 的 AgentLoopRuntime.run 删掉 await tool.execute({}) 那段模拟执行(轨迹仍成对、状态 completed,自述未执行);② o6 ⑤ 定位器跟上 merge 改为 git -C $Root merge --ff-only 的新形态(语义断言零删改);两枚反向牙均实跑:塞回 execute 即 2 failed、退回 -Entries 全量脏文件即 BLOCKED-WIP 断言红 (357496236af)
- 🔧 Chore/Other:归并后按合并树重派三处派生件 (ac65a7954db)
- 🚀 Feature/Improvement:新守门 check-ps1-bom.mjs 接进提交链 (6e8f4bd2a4d)
- 🐞 Fix:工作空间页短内容撑满卡片剩余高度，消除项目区下方大片空白 (aec2acdf90e)

**2026-10-26**
- 🐞 Fix:工作空间页短内容撑满卡片剩余高度，消除项目区下方大片空白 (253418c2de4)
- 🚀 Feature/Improvement:海外登录隐藏手机号入口并主推 Google，Google OAuth 出站走白名单代理 (0451b10e78e)

**2026-10-27**
- ♻️ Refactor:H01 改判出等条件桶(归:机主微信扫码会话面) (06d42e60b0e)
- ♻️ Refactor:H01 出等条件桶——标头按侧车投影改写(归:机主微信扫码会话面) (c73967172a8)
- 🐞 Fix:陈旧副本重放不再把活着的会话永久锁死(stale-sibling 放行轮转) (e6f75c3418b)
- 🔧 Chore/Other:部署成本阀墙钟闸 240→480 分钟(三闸配额对齐) (63acf504772)
- 🐞 Fix:账号池容量归零告警按 provider 点名复活出口——trae 凭据死亡时收信人的当场动作是重开 Trae 客户端登录一次,worker trae-session-sync 每 10 分钟自动回灌新会话入池(2026-10-26 跨 profile 兜底扫描落地后这条链在真机才跑得通),不再要求人工记着跑命令或找后台按钮;workbuddy 点名 --from workbuddy 重提取;无定制出口的 provider 不被硬塞别家文案(§0.8 出路必须真跑得通)。镜像 M5b 例 + 门自检查表锁三型(12+30 例全绿) (94b9133cb82)
- 🐞 Fix:ps1-add-bom 的"全仓已清零"不再被打成用法错 —— 出口三态各自有话说 (d07bc892a90)
- 🚀 Feature/Improvement:备份只读角色幂等建制器——SELECT 探测后只补差值,默认 dry-run,apply 单事务并回读自证,口令只报长度不覆盖不打印;判据复用 pg-restore-drill 的口令链单源,落 deploy 之外的 node 侧因 .sql 一次性载体做不到先探测(执行席 g70-backup 交回;主席复跑自检十一例与镜像廿五例全绿,本机无超管身份时按未判定 exit 2 不猜) (8def005420b)
- 🚀 Feature/Improvement:排他切席板 dispatch-board + lint-staged 盯针门入库 —— 把主席手三条派单纪律变成器物 (429cf91aac1)
- 🐞 Fix:Trae 落点候选加跨 profile 兜底扫描——非登录用户 shell 下裸跑 --from trae 即命中本机真会话(2026-10-26 实测首跑栽于沙箱 %APPDATA%,靠手工 IHUI_TRAE_DIR 救回);候选次序=显式覆盖>当前用户>他人 profile,IHUI_TRAE_SCAN_USERS=0 可关;镜像测试 13 例全绿+裸跑 dry-run 打穿为证 (cba1c89415f)
- 📚 Docs:README.en 生成块与散文六处数字按现算重钉 —— 门 173 见我改过它,从此对它全判 (0dbf4375a66)
- 🔧 Chore/Other:违禁桶兜底清扫——HEAD面等条件/待拍板未勾行自动摘除(两道机主禁令的执行器物化,留痕f12-purge;复翻席请同步摘形态,事实内容按各批结清提交保留) (4146ce30ab4)
- 📚 Docs:自进化 7 枚由主席逐条现读复核后结清——金丝雀三器物在 HEAD、自治决策/经验提炼/决策链三条腿提交均为 HEAD 祖先、需求发现器三源适配器提交为祖先、反馈闭环器件在 HEAD、E2E 缺口门已接 runner id 250 (ecf125780a1)
- 🐞 Fix:冷启动不再把「cookie 还在」的老用户判成匿名 (db0bcde9451)
- 📚 Docs:三份外文 README 补「账号保活中心」一节 —— 中文那份已在 HEAD,外文一直缺 (06035647e9d)
- 🔧 Chore/Other:显式声明 expo-camera 相机权限 (fbfaa42034e)
- 🚀 Feature/Improvement:默认头像域名收敛到 www.aizhs.top(省一次 CF 301) (ed751bd809a)
- 📚 Docs:G-11 队列拒因三件结清——b/c 两格在 HEAD 逐条复验(deferred/failed 终态与静态键盘面在位,承载测试 12/12),a 格三个输入无合法生产者按观察类结清不臆造 (fbb8c22cacb)
- 📚 Docs:两枚结清——argument-validation 三格逐格复跑(裁决夹具 8/8、演示路径 4/4、hub 前提已腐烂);G-37 三格逐条复验(语言包 JSON + i18n 两门 RC=0、冷却指纹测试 4/4、80 端口已进值守监控与人跑清单附 5 例夹具) (c282980c9fd)
- 🚀 Feature/Improvement:补上手机端扫码确认 PC 登录(小程序 + RN) (b5d89fc7ba5)
- ♻️ Refactor:保活中心 router 迁 app/routers/ —— 让门8 的那 6 条端点从「未判定」变「在册」 (4d673db9928)
- 🐞 Fix:zh-TW 一枚简体残留改繁体——sourceCookie 的平台应为平臺(opencc 判残留导致门 2b 红;该值由枚 f541169ba4 keepalive 批次新增;执行席 g37-locale-json 现读点名,主席一字修正并复跑 JSON 解析与语言判定) (b77a3373ff5)
- 🚀 Feature/Improvement:未设置头像统一使用平台 Logo (a078ca2b107)
- 🚀 Feature/Improvement:归属尺只认真实证据——散文标签的持有者须同时过租约/提交史/脏面三条之一才剔出派单面,否则落 stale-owner-label 并在 --dispatchable 默认保留;机主面与活租约一律仍剔,取不到输入落未判定(执行席 owner-scale-r2 交回;主席独立复跑同一命令得 出单 9 与 仍归他人 23=机主面17/侧车5/在飞1,与席位读数一致;三条反向自证齐备) (6129400e9b8)
- 🚀 Feature/Improvement:门251 判据本体补上 + 存量 67 枚 .ps1 一次补齐 UTF-8 BOM + R6 判据右边界修正 (c384d583b97)
- 🔧 Chore/Other:web ui-routes 自述钉按当前 HEAD 重钉 (541e3257616)
- 🐞 Fix:plan-copy-row-purge ④c 开「陈旧快照」降级档——化石件里的旧 open 不再永久挡陈旧指针 (91ead7dd145)
- 🔧 Chore/Other:三枚假牙改形态锁(续假牙B同型)——api-failure-throw 删 total 硬下限改四字段形态锁、shared-type 的 hits 与 csrf 的 sites 同改,存量维一律可解析断言,取材面非空与真判据全保留,补变异自证(执行席 faketooth-a 交回;主席复跑三档十+十一+十四例全绿) (94709e33b69)
- 🔧 Chore/Other:三枚假牙改形态锁——把门体自己声明只报数的存量维从下限改成可解析断言,取材面非空与真判据全保留,补变异自证(摘形态锁必红/存量归零不红)(执行席 faketooth-b 交回;主席复跑三档十五+十三+十二例全绿) (afe5fd443fd)
- 📚 Docs:两枚副本指针行按完成即删处置——二者本身是指针不是任务(承载行均在册),而指针注记存量自 2026-10-14 已定为零基线;翻勾后由 5 分钟节拍的清扫器摘除 (7a139fbe217)
- 🐞 Fix:门71 判据补齐成套——missingFrom 按条目自带名额展开并启用 multiset(复制份标 dupSlot 折成 multiSlot 只点名不回捞),openCount 语义改为窗口内同时开放峰值(避免把 churn 累计量当名额致规模闸误触),加粗族按 marker 出现次数记账;自检 73 升 78、镜像 85 升 95(执行席 g948-complete-r2 交回;主席复跑两档全绿且全量档 RC=0 未新增红) (b3427a4a6aa)
- 🐞 Fix:演示路径不再执行工具 + 部署断言锚点跟上新写法——① workspace-ai-service 的 AgentLoopRuntime.run 删掉 await tool.execute({}) 那段模拟执行(轨迹仍成对、状态 completed,自述未执行);② o6 ⑤ 定位器跟上 merge 改为 git -C $Root merge --ff-only 的新形态(语义断言零删改);两枚反向牙均实跑:塞回 execute 即 2 failed、退回 -Entries 全量脏文件即 BLOCKED-WIP 断言红 (357496236af)
- 🔧 Chore/Other:归并后按合并树重派三处派生件 (ac65a7954db)
- 🚀 Feature/Improvement:新守门 check-ps1-bom.mjs 接进提交链 (6e8f4bd2a4d)
- 🐞 Fix:工作空间页短内容撑满卡片剩余高度，消除项目区下方大片空白 (aec2acdf90e)

**2026-10-26**
- 🐞 Fix:工作空间页短内容撑满卡片剩余高度，消除项目区下方大片空白 (253418c2de4)
- 🚀 Feature/Improvement:海外登录隐藏手机号入口并主推 Google，Google OAuth 出站走白名单代理 (0451b10e78e)

**2026-10-27**
- 🔧 Chore/Other:ruff 存量 36 枚清零(CI ruff check . 同口径红清偿) (3161e427058)

**2026-10-26**
- 🔧 Chore/Other:收敛后重派 6 枚派生件(三端 ui-routes + i18n 离线包与清单) (170b1ba6de0)
- 🐞 Fix:补齐收敛并入的 3 枚缺载荷文件(CI verify 面回潮清偿) (9e0f5aedb03)
- 📚 Docs:两枚结清——分叉票按当场复量关闭(origin=ALREADY、本地与远端 0/0、push-state done,合并枚已入祖先链);A01 按行内自带销账注记关闭检查框 (1e67311179d)
- 📚 Docs:结清一枚无编号僵尸行(双重执行/两次 LLM 与两遍工具副作用)——修复形态在 HEAD 三个调用点齐备(orchestration:277/team_orchestration:211/agent_orchestrator:1510 均为 handoff = await take_loop_v2_handoff(...) 后 if handoff is not None 早退),二次复核席判 PASS 后主席独立复跑符号面复核 (4f7cd644f9e)
- 🚀 Feature/Improvement:海外登录隐藏手机号入口并主推 Google，Google OAuth 出站走白名单代理 (b2ff1bf93b0)
- 🐞 Fix:两枚 PowerShell 脚本补 UTF-8 BOM——治 PowerShell 5.1 把中文串读成乱码导致对侧 runId 镜像测试 T2 在 main 恒红(§27 要求 .ps1 带 BOM;内容零改动,只加三字节前缀。上一笔被收敛对齐冲掉盘上修复,本笔重落) (f10838b8f77)
- 📚 Docs:12 枚僵尸票批量结清——前提在 HEAD 逐条不成立:桌面 ANR 残行 55 字、G-195 三个入口脚本全在 HEAD、take_loop_v2_handoff 生产面 18 处已装车、O87g 精确挂载图已装车(本轮另补 compositeDelta 报数)、三枚归并副本指向行已归档、G-8 为副本套娃 31 层的一次性快照、G-242 残行且属禁用的等条件形态、G-948 被吞行已回补、G-66 为单点读数加等条件形态、cloudflared 运行副本与入库源逐字节等值 (9be4bfd2bb5)
- 🔧 Chore/Other:fix(scripts)+test(deploy): 两批判据补强——① 门 8 组合前缀 compositeDelta 报数(票面第 4 格少判组合必须报名,此前无机器断言;现读少判 877654 条,只报数不判红,兜底档返回 null)② 人跑健康清单补 cdn 80 端口三态(原本只查 8801/8802/8803/8810/8811;取不到记 null 且仅未判定 exit 2),附两枚镜像各含摘掉即翻红用例 (0b0f033decf)
- 🐞 Fix:补齐部署窗口线三枚新文件的溯源水印 (c4da901e2a8)
- 📚 Docs:三枚已结清未翻勾行由主席复验后翻勾——G-706 证据件三枚在 HEAD 且夹具 11/11 通过、G-42 架构策略表相对 HEAD diff 0 行、G-56 索引 D 前缀 0 条;原行内"不翻勾/不动勾"注记经当场复验解除,按完成即删口径处置 (5e5b7886124)
- 📚 Docs:§21 补登「账号保活中心」——两条保活线收成一份状态,6 条 /api/keepalive/* 从 in-doc-window 清零 (094dd7f730a)
- 📚 Docs:号池 workbuddy-switch 三件套活文档补账——PROJECT_PLAN 加 2026-10-26 本批节(三件判据/成对对照端/验绿末行/端范围平台独占豁免/推送分叉如实登记仅别两席两 ps1 真冲突与这两枚无关);README 号池表 3 处(账号池调度巡检扩为四档含空闲保活、新增号池导入格式自适应、号体检速查 CLI) —— 以权威 HEAD 基面叠加我的新增,自检 HEAD 逐行零丢失(唯一差异=该表行按'一编号一行当前状态'就地改写,旧①②③文本原样保留在新版内),活文档归并走 object-space-land 带行级复活守卫 (49e67301c19)
- 🐞 Fix:部署面按「取对侧(已声明+可复核)」导入 origin 的部署窗口线 + 两处归并与两处修红 (c02b88bc632)
- 📚 Docs:G-5 结清——超龄认领牌存量现读归零(代摘器干跑 SWEEP-RESULT state=clean stale=0 held=40 stripped=0 @22:51),且 2026-10-25 机主令已禁止等条件桶 ⇒ 原"等持有人处置"的出路由器物 strip-stale-claim-marks 接手,本行无剩余动作 (ebf8f7d5166)
- 🐞 Fix:门41 认「退役远端的残留跟踪引用」为一档(orphan)—— gitee 远端 2026-10-23 摘配后 packed-refs 里 4 条 refs/remotes/gitee/* 掉出 mirror 档、又不属 origin 的 stale 档,被判成超窗旁支,而本门给的四条出路对它全部不成立(A 删的是别的 remote / B 对远程跟踪引用无效 / D 只 prune origin)⇒ 无解恒红挂每次提交(§12e/§12f);判据改为按 git remote 现配清单分档,configuredRemotes 取不到时一律不判 orphan(失效方向仍是多拦),T21 端到端锁正例 + 自检四例反向对照;同批门150 三族圆角归位(KeepaliveCenterPanel panel→rounded-xl / control→rounded-sm,quick-notes archivedDot tiny→rnRadius.xs),工作树面复跑判红 0 族 (bf63f8c40ba)
- 📚 Docs:G-397 双席同题对账入当前行—s6 席 deploy-lock 负向与本席 git-lock 迟到finish 验收互补,合跑6/6绿,auto 已收编 (bca2ffaeb79)
- 🐞 Fix:G-1182551 终验闭合二落——03:00 轮转档案当日 4 行 strict-UTF8+CJK 正常(mojibake=0)non-UTF8=0 成立;一次 CAS 被合批洗回 open 已如实注记 (93ff2c73dc0)
- 📚 Docs:号池三件套补登记——package.json 的 relay:inspect 入口 + docs 增 §2.1 外来格式自适应/§5.7 归一单源/§9 号体检CLI六态/§10 空闲保活时钟;两张活文档归并不在本笔 (a4ef5e2bf0d)
- 🐞 Fix:G-397 结清——验收实验双臂实跑过(git-lock-lease-token.test),机主令接管僵尸票 (2355619e6f8)
- 🚀 Feature/Improvement:号池对标 workbuddy-switch 三件套——①外来格式自适应导入(别名搬运+秒/毫秒量纲归一,立修 expires_at 被当秒折成 5138 年永不失明) / ②空闲保活档(greatest(last_used,last_refresh) 防闲置 invalid_grant,client-first 让位本机,env RELAY_ACCOUNT_KEEPALIVE_DAYS) / ③号体检速查 CLI relay:inspect(六态结论+下一步,零DB零上游不回显凭据) -- AGENTS §21 docs/README 同步(本批仅 docs;两张活文档归并不在本笔);测试 typecheck8/8+vitest69+格式棘轮+水印verify,端范围 api/worker/CLI 平台独占豁免见 PLAN (79d39e83651)
- 🚀 Feature/Improvement:账号保活中心统一两条保活线 + 密钥路径锚定治静默失效第8例 (f541169ba4f)
- 🐞 Fix:结清翻勾 3 枚僵尸票(G-22/G-34/git-guardian前提腐烂)——机主令接管;结清事实由 b8r1/b10r1/b13r1 注记+引用枚落定,本批翻勾并盖接管戳,正文逐字守恒 (eb3a7b66da5)
- 🚀 Feature/Improvement:check-task-claims 补超龄认领牌现读枚数口——判据一律 import 挂牌单源零复算,新读数只做附加不改既有各档形态;同枚按其自注重新设计 T20 夹具(真仓叙述形态已合法归零,阳性对照改由真行合成,尺子的牙不变)(执行席 claims-cl1 交回;主席复跑镜像测试廿五例全绿) (9db07eae77c)
- 🐞 Fix:G-1182551 结清——机主令接管僵尸票(持牌 g2-alltasks 近48h零活动),ssh 隧道处置(deploy 10-21 实证档)+生产日志 strict-UTF8 终验全绿 (398c711c3b5)
- 🐞 Fix:监控侧告警去重身份改走单源出口——不再整条文本自拼身份,证据锁进 harness 与镜像测试;抖动门现读零新增(执行席 monitor-identity 交回;主席复跑镜像测试十九例全绿与守门 224 现读) (b9162299c84)
- 🐞 Fix:守门115 认跨文件转发豁免并钉依据链——hub adapter 的转发点名校验出口与两处调用点,演示路径真缺口保留点名不一起消掉;同枚修复该文件工作树副本的 JSDoc 断头(语法坏件会让整门解析失败)(执行席 gate115-forward 交回,主席补齐注释开头并复跑读数:命中一候选三,转发豁免一带依据链) (56497242c47)
- 🔧 Chore/Other:给四枚零测试共享工具补真用例——base64、number-format、token-estimate、dangerous-command-detector(执行席 shared-utils-tests 交回;主席复跑 vitest 五十三例 GREEN 且 shared 包 typecheck 过) (552bb5d0586)
- 📚 Docs:四枚二次复跑 PASS 结清——G-397 锁租约认 token(反向验收四例含迟到 finish 不改控制文件)、G-53 lint-staged 三态分档三针已打补丁、G-63 safe-commit 发令数组无 pathspec 且 env-blocked 四条十五天零复发、G-863 附件容量写前 CAS 与跨批用例均在 HEAD(执行席 zombie-recheck-B 换角度独立复跑,主席按其现读末行摘行) (bc0c7ceb69f)
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
