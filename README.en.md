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
| API 路由 | 4862 | `apiRoutes` |
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
| 测试文件 | 5953 | `testFiles` |
| CI 工作流 | 59 | `ciWorkflows` |
| Compose 服务 | 14 | `composeServices` |
| 工程守门 | 370 | `guardianGates` |
| — blocking | 338 | `guardianBlocking` |
| — warn | 34 | `guardianWarn` |
| 跟踪文件 | 23157 | `trackedFiles` |

上表由 `node scripts/sync-readme-numbers.mjs`(唯一写入口,索引面取数)生成,最后核对日期 2026-11-21。
每个数的来源就写在取数键旁边的实现里(`scripts/gen-doc-numbers.mjs` 的 `SOURCES`),**不得手抄、不得另立第二份**。

<!-- END GENERATED NUMBERS -->


## Recent updates (auto-maintained)

<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->
**2026-11-21**
- 🔧 Chore/Other:clone-retry 封顶阈值抬到 6s(并发下桩子进程冷启动越过 1s 误杀第二轮) (b9c3f24702)
- 🐞 Fix:Resend 腿可定向验真 + 离线取源钉已推送基线(第 105/106 项) (2ff89003c8)
- 🐞 Fix:状态扫光改用 .text-sweep(前景观色打底,只让亮带扫过),不给"运行行比兄弟行浅"留口子 (bbf6cb2d43)
- 🔧 Chore/Other:队列名六族契约用例给 60s 预算(重 import 10+ 模块在并发下吃满 15s) (6fadbe233d)
- 🐞 Fix:状态"进行中"统一为文字左→右扫光,图标/圆点颜色恒定(对标取证后全量收敛) (b2b4793de4)
- 🐞 Fix:failure-badge 用例 mock 补齐 useAgentRuntime 真实契约字段 (89dc712c69)
- 🐞 Fix:"目录不存在"不再冒充"读不到" + P5b 回显真实退出码 + 修净面 TS 红(第 102/103/104 项) (c3f011448d)
- 🐞 Fix:in_progress 图标断言跟进 2026-11-21 定档(不再透明呼吸) (cb7edd50c4)
- 🐞 Fix:根护栏清单按 HEAD 面重封(第 93 项改 git-guardian.mjs 时漏了同批重封) (872d5ea8fe)
- 🐞 Fix:标头真等段时抽取器不造记录,侧车退回原状(门 234 A2 归零) (a0b989bd31)
- 📚 Docs:第 101 项入档 + RP-17 侧车记录补登(stock 17→14) (2bcee754cd)
- 🐞 Fix:标头归位 10 行 + 摘两枚同号重复登记副本(S-28/RP-17),复合主键 12 行不可寻址→0(第 101 项) (53db75f156)
- 🐞 Fix:投影收口两行标头形态(Y-58 加标头 / RP-37 摘空等段),清掉门 234 的 midform (e9a49cc55e)
- 🐞 Fix:过程行图标不再用透明度呼吸表达"进行中",根除"运行代码图标发灰" (15624ea3df)
- 🐞 Fix:最后 4 条孤儿侧车键按声明档退净,orphan 23→0(第 100 项收尾二) (9ffc4e216b)
- 🐞 Fix:侧车 legacy 兜底键 T:<hex> 可退场,两个器物互相指对方的死锁闭环(第 100 项) (632be3eb22)
- 🐞 Fix:终端命令结束自动收起,不再停在"默认展开"态 (616090c75b)
- 🐞 Fix:三台服务现场修复 + 基准件对齐现读(第 99 项) (5708edc8cb)
- 🐞 Fix:引导线轨道改为 StreamGroup 一处施加,不再由调用方自觉套让位档 (f30df0756f)
- 🐞 Fix:校准 web 五条落后于 2026-11-21 定档的形态断言 + UpdatePrompt 按钮圆角 (eb54c0f082)
- 📚 Docs:生成块跟上 HEAD 面 trackedFiles 23154 → 23153(第 98 项退出索引的运行副本) (a55f0cc81c)
- 🐞 Fix:字段面判据补齐真实消费面 + 纠正 deploy.sh 运行副本被跟踪(第 97/98 项) (9ae958f943)
- 🔧 Chore/Other:字形补偿断言改判"逐行同值",不钉字面串 (94bffb0564)
- 🔧 Chore/Other:申报 D:\小浣熊(商汤桌面端安装目录)进白名单,停掉唯一那条常红(第 95 项) (c42579102d)
- 🐞 Fix:过程行基线归零 + 行尾内容紧跟前文(不再被 flex-1 顶到行末) (660a4dd6b6)
- 📚 Docs:生成块与最近更新按第 93/94 项落地刷新(trackedFiles 23150 → 23151) (a7ea00515f)
- 🐞 Fix:回补器拒绝「树已在主线祖先里」的对象,不再造空合并(第 94 项) (8290de4e53)
- 🔧 Chore/Other:追认守夜人回补的错误签名对象 df7faf9a(第 92 项弃用件)(第 93 项) (8894dd4b77)
- 🐞 Fix:四条结构锁接线补齐,并把射程判定收紧为取值白名单(第 93 项) (6d4a292f20)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (b23a960c36)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (7e7f0b6878)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (3eff3f9df9)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (43e8e2b9a8)
- 🐞 Fix:补 R3F 全局 JSX 元素类型注册(ThreeDViewer 7 处 TS2339)并把 theme-provider 改为透传 props(children 类型断链) (e3121c4d19)
- 🐞 Fix:test 任务透传浏览器探测所需 env(turbo 默认 strict 剥掉 LOCALAPPDATA/ProgramFiles ⇒ CDP 用例找不到 Chrome);cli/api 四处真 git·真 IO 用例预算 60s (c84d054513)
- 📚 Docs:跟踪文件数随第 92 项 +2(23148 → 23150) (1010bb2e1b)
- 🚀 Feature/Improvement:tmp 体积哨兵加「有意保留」登记面,并修消费端正则(第 92 项) (b8478a5dda)
- 🚀 Feature/Improvement:tmp 体积哨兵加「有意保留」登记面,并修消费端正则(第 92 项) (df7faf9a66)
- 🔧 Chore/Other:真 git/真 IO 用例全局预算 15s→60s(并发档反复打穿,单跑全绿) (0e93ee2d11)
- 📚 Docs:数字生成块按落地面刷新(第 91 项后) (fec4a5790a)
- 🔧 Chore/Other:302p 基线定向刷新 tierPending 10→21(别席 RN 7px 存量,非本批引入) (1df21d5b6f)
- 🐞 Fix:StreamDetail 的左右让位落回档表,不再用任意值(17px / 7px) (2f9187093b)
- 🐞 Fix:test 任务透传浏览器探测所需 env(strict 模式剥掉 LOCALAPPDATA/ProgramFiles 致 CDP 用例找不到 Chrome) + cli 两处真 git 用例预算 60s (d4a40f4cc7)
- 🐞 Fix:过程行几何从根统一(图标/文字列/行高/基线不再随可点击性变化) (07768a3318)
- 🐞 Fix:摘掉已退役门 173 的钩子腿,并把 H3 的「未设置按 .git/hooks 判」接到实现 (d3fef60264)
- 🐞 Fix:键面防丢闸补「处置权」维,对侧正当退役登记键不再把分叉收敛押死 (a979a3a89a)
- 📚 Docs:刷新生成块数字(别席退役门 173 后 trackedFiles/守门 数下降,87->88 项文档口径) (9cf61f2462)
- 🐞 Fix:总状态读执行体身份,pid 已死的 daemon 不再被兜底 tick 读成健康 (da57617be0)
- 🔧 Chore/Other:退役 README 数字对账门 173(数字滞后改人工定期刷新) (84572f3af0)
- 🐞 Fix:总状态读执行体身份,pid 已死的 daemon 不再被兜底 tick 读成健康 (29427e3110)
- ⚡ Perf:scanFolders 普通目录不再逐项 realpath(O(目录数) 系统调用把 limit 截断退化成时间截断) (b3d8c73722)
- 📚 Docs:生成块跟上 HEAD 面 trackedFiles 23150(删两枚幽灵测试) (9e18a5bede)
- 📚 Docs:生成块跟上 HEAD 面 trackedFiles 23150(删两枚幽灵测试) (cf5fa8ccdf)
- 🐞 Fix:删掉两枚引用不存在符号的幽灵测试,判红文案不再把历史快照当现状 (1f27ed595f)
- 📚 Docs:生成块按合并后 HEAD 面现算对齐(testFiles 5952/trackedFiles 23154),并还原被并重的块内行 (662099cb18)
- 🚀 Feature/Improvement:AI 面板流式态按钮四周旋转激光光带 (35836df0a4)
- 🔧 Chore/Other:三处重 I/O 用例预算放宽(并发档超时,单跑全绿) (b3c24001dd)
- 📚 Docs:生成块与最近更新区按远端正版重放(上次合并把块内行并重/散文插进表格/丢最近更新条目) (649f1596ae)
- 🐞 Fix:盘根封口不再把读不到当不存在(UNREADABLE 态),守护把失败原因逐条打进日志 (9f11b985f4)
- 🔧 Chore/Other:workspace-picker 五语言 parity 用例预算放宽到 60s (a3928f113a)
- 📚 Docs:生成块跟上 HEAD 面 trackedFiles 更新 (3990e89914)
- 🐞 Fix:恢复源缺席不再冒充刷新失败,并真把本机恢复层建回来 (58cb4cfdbc)
- 🔧 Chore/Other:F-519 回归锁改为分段拼路径,消除旁路删除硬门误读路径字面量为引用 (c98c5581c0)
- 📚 Docs:生成块 trackedFiles 按合并后 HEAD 面现算对齐(23150->23152) (692a86bc22)
- 📚 Docs:生成块 trackedFiles 按 HEAD 面现算对齐(23147->23150,合并远端新增 3 路径) (5ed0fe74a2)
- 📚 Docs:生成块 5 项数字按 HEAD 面现算对齐(apiRoutes 4865/apiRouteFiles 716/aiServiceRoutes 686/testFiles 5952/trackedFiles 23147) (70f2ff6d00)
- 🐞 Fix:侧边栏开发者组两枚 admin 管理页归位到管理域 (00ed724d70)
- 🐞 Fix:AI 面板过程行去掉底色与描边,字号压到 13px (728358d835)
- 📚 Docs:生成块跟上 HEAD 面 trackedFiles 23151 (b4b96c0069)
- 🐞 Fix:盘根卫生判红不再自己抛异常,内容维与 H3 kind 措辞补齐 (4c85889861)
- 🐞 Fix:删掉 WIP 提交回捞的 F-519 死路由与其专属测试 (16e7b08309)
- 🔧 Chore/Other:追认守夜人回补的未签名前身 c459d76e(内容与已推送 cab11e80 逐字相同) (d897e933b4)
- 📚 Docs:生成块跟上 HEAD 面 trackedFiles 23152 (f7983be795)
- 🐞 Fix:存活哨兵不再把活着的 daemon 判死,并按腿节律判 stale (89834ed935)
- 📚 Docs:生成块跟上 HEAD 面 trackedFiles 23151 (cdb2e55d09)
- 📚 Docs:第81项收尾 两处头注按现读改写 (cab11e8059)
- 📚 Docs:生成块跟上 HEAD 面 trackedFiles 23151 (a9f1e5c4e4)
- 📚 Docs:第81项收尾 两处头注按现读改写 (c459d76e44)
- 🐞 Fix:第81项 dev库口令轮换窗口巡检+双挂点+登记第19腿 (227a62ef86)
- 🐞 Fix:第80项 新腿补进黑腿探测器登记表+戳名归族 (a86afc9c58)
- 📚 Docs:生成块跟上 HEAD 面 trackedFiles 23150 (9a8db2c83b)
- 🐞 Fix:第79项 user_feedback单源入口派发器+双挂点 (7c2cd83d0a)
- 📚 Docs:生成块跟上 HEAD 面 trackedFiles 23149 (f7eb862856)
- 🐞 Fix:第78项 IP归属可信度尺巡检轮+main/tick双挂点 (24c42126a0)
- 🔧 Chore/Other:七件测试漂移跟上实现变更(SSO 基址 / sora2 停服 / 出图接通 / 注销取数形态 / 进程探测) (81147cd4b9)
- 📚 Docs:生成块跟上 HEAD 面 trackedFiles 23148 (981812f365)
- 🐞 Fix:第77项 补被契约声明的监控三源入库派发器+双挂点 (b1f5d4984b)
- 🐞 Fix:图标同源守门——构建前校验 6 个 PNG + ico 每个尺寸层必须与源图同源派生;安装器收尾通知 shell 重建图标缓存 (079ab30a89)
- 🐞 Fix:第76项 自愈腿搬进常驻 tick(ref-move-loss/gitee-backfill) (915a8c41c1)
- 🐞 Fix:第75项 写手面与推送面不同时拒绝写入并报两面读数 (9d641a88c1)
- 🔧 Chore/Other:七件测试漂移跟上实现变更(SSO 基址 / sora2 停服 / 出图接通 / 注销取数形态 / 进程探测) (e59b7e2632)
- 🐞 Fix:第74项 守夜人不回补内容已被覆盖的改写前提交 (375fd9207e)
- 📚 Docs:按 HEAD 面重算生成块数字(trackedFiles 23147 / testFiles 5952) (8fccfc24be)
- 📚 Docs:按合并后 HEAD 面重算生成块数字(trackedFiles 23147 / testFiles 5952) (b980262432)
- 🐞 Fix:第73项 cap 只买 warn 名额,blocking 不吃这名额 (d13f8d821b)
- 🐞 Fix:第72项 复跑道数预算只压 warn,blocking 全跑 (70664a0a64)
- 🔧 Chore/Other:救急保全本地未提交改动 —— license/hook审计、agent terminal、BUG29索引外键、relay-switch、i18n、desktop更新链与守护脚本 (341f2295b3)
- 🐞 Fix:永久保活改用「刷新时钟」,忙号也照续(治主力号 rt 闲置到被上游回收) (4cf118dfb4)
- 🐞 Fix:第71项 可发性探针与发号器同面(补远端/让位/结清三张面) (80c70a4983)
- 🐞 Fix:钩子审计尺子改走统一取材层(HEAD blob) + AGENTS 门名点名补三枚 (7a490d402f)
- 📚 Docs:deploy-feedback 自动登记(deploy_outcome;端到端反馈闭环第二切片,O65 自进化系列) (94cb493b28)
- 🚀 Feature/Improvement:号池通道补工具回路 —— 取 schema/带 tools/收 tool_calls/执行后文本回灌续跑; 顺带修 hr 工具判据的续做说法漏带与工具卡成败标注 (424b06d808)
- 🐞 Fix:CORS_ORIGIN 模板补全 www/api/bsm 子域(漏列致预检被拒+WS 403,前端初始化卡死) (cce388a078)
- 🐞 Fix:补 4 枚错误码五语言词包并修 zh-TW agentTerminal.cursor 繁简残留 (32e3cc8c0e)
- 🐞 Fix:第69项 复跑预算 block 前置(blocking 门不许被 warn 挤出预算) (91894a2f5d)
- 🐞 Fix:第68项 结构性豁免写进注册表(落地覆盖面与门262各一层)+ 门262 镜像T5 按现结构重写 (42b13f7287)
- 🐞 Fix:第67项 自愈层补AD形态(已暂存新增/盘缺从索引回盘)+ 自检三格按现设计重写 (6350937b37)
- 🔧 Chore/Other:烘焙桌面端更新 feed 到 0.1.93 (6d4c372690)
- 🐞 Fix:号池保活告警按终态分层,判死号不再每天重播 (80d6e03af4)
- 🐞 Fix:修复 12 族真 bug(Windows 锁探活/僵尸锁、cmd 代码页、Auto 审查闸、多模态消息丢弃、任务状态误判错误体、交付物规约与 present_files 丢失等),pytest 分批全绿 (64500e176d)
- 🐞 Fix:第66项 历史存量不再当现状(A13 三档/A6 数据坏先未判定)+ 两把锁按登记表现读 (c55e6241aa)
- 🐞 Fix:统一 OAuth 回调地址,补 Google 换 token 出站代理与启动自检 | 线上两处真因:后端 GOOGLE_PC_REDIRECT_URI 仍指 localhost:8801 而前端内联 aizhs.top(Google 换 token 要求逐字符相等);直连 oauth2.googleapis.com 不通且 PROXY_URL 未配、该端点不在默认白名单。改动:proxy-dispatcher 与 ai-service 镜像表补 oauth2.googleapis.com;config/index.ts 新增 collectOAuthConfigWarnings(纯判据)+runtime-env-guard 6 例:生产启动把"回调指向本机""PROXY_URL 未配"喊出来(只告警不阻塞);oauth 上游错误体与 redirect_uri 进错误串;.env.production.template 回调段改正。验证:33 单测绿;python 双面等值 8 绿;门 116 绿;typecheck @ihui/api 绿。 (304c0fdbcb)
- 🐞 Fix:模型终端屏面改为盖在 IDE 终端之上的一层(不挪 xterm 几何,避免 hidden 父层按 0 尺寸重算丢 scrollback) (dbbfc9e28e)
- 🐞 Fix:0.1.93 根治「更新失败红字」—— 前端更新链与 Rust 链统一走系统代理 (47a5cb17cb)
- 📚 Docs:第65项 文档按现读校正 A12 读数(ok3/n-a12/drift0/unjudged1) (4d339a34c4)
- 🔧 Chore/Other:追认第64项 708477f 两枚受保护面(签发面 1 枚 ≠ 改动面 2 枚) (c68a023344)
- 🐞 Fix:第65项三修 always→conditional 按写盘分支取证(三条事件驱动腿不再报假 drift) (3081717cb8)
- 🐞 Fix:第65项二修 outputRel 改为 state 相对路径(A12 不再把读盘 ENOENT 读成零产出) (972dbb390d)
- 🐞 Fix:读回端点改按 conversationId 寻址(终端记账键,流会话 id 会让面板永远空白);noSession 措辞与文档同步 (6dc0a0b60a)
- 🚀 Feature/Improvement:第65项 自治腿登记表补齐 A12 产出四格(16 腿全部未判定 → 可判) (e4b6bd506a)
- 🚀 Feature/Improvement:第64项 会话写类调用派生产物清单(A13 落地腿接通)+ 自检未导入引用与 Ⓔ 锁错位修正 (708477f440)
- 🔧 Chore/Other:烘焙桌面端更新 feed 到 0.1.92 (ce91fbfd75)
- 📚 Docs:生成块数字随模型终端屏面(api-client/hook/组件/用例)刷新(testFiles 5948 / trackedFiles 23109) (818dac9c50)
- 🚀 Feature/Improvement:模型终端屏面接进 AI 终端停靠面板(只读轮询 terminal_face)+ api-client 两条读回出口 + 五语词包;文档补记四 (8ffccdd0b5)
- 🔧 Chore/Other:第63项 重封根护栏清单 (856a254e1d)
- 🐞 Fix:第63项 A15 认领 runner-budget-exhausted + ref 位移守夜人补挂 daemon 面 (e265876eef)
- 📚 Docs:生成块数字随终端读回端点与用例刷新(aiServiceRoutes 688 / testFiles 5947 / trackedFiles 23106) (3a7d70cca4)
- 📚 Docs:数字按 HEAD 现算同步(trackedFiles 23106 / testFiles 5947 / aiServiceRoutes 688) (2264fed91b)
- 🔧 Chore/Other:追认回补进历史的旧消息副本 64b3916e5c (9cba5ad600)
- 🚀 Feature/Improvement:终端屏面聚合原语 terminal_face + 只读读回端点(/terminals,/face);ConPTY 输入边界随 open 回执如实下发 (9f91ba8975)
- 🔧 Chore/Other:发 0.1.92 演示版 —— 仅版本号(0.1.91 -> 0.1.92) (a82b0d0139)
- 🔧 Chore/Other:第62项 重封根护栏清单(git-guardian=157777b0edd0) (5b030e17d7)
- 🐞 Fix:第62项 Gitee 资产补齐腿补挂 daemon tick 面(此前只挂 main ⇒ 零派发) (e2b37de93b)
- 🚀 Feature/Improvement:第61项 A8 补源面覆盖面(登记表漏腿结构上看不见) (e8a83b0996)
- 🚀 Feature/Improvement:第61项 A8 补源面覆盖面(登记表漏腿结构上看不见)+第60项两条真派发腿补登记 (64b3916e5c)
- 🔧 Chore/Other:第60项 两条真派发腿(api 活体体检 / tmp 体积哨兵)登记进黑腿探测器 (d8a8153a16)
- 🔧 Chore/Other:第59项 新派发腿登记进黑腿探测器 + 镜像测试状态泄漏修正(连跑两遍 7/7) (fb0af590ac)
- 📚 Docs:testFiles 按现算修正回 5946(trackedFiles 23103 不变) (e0dae5462c)
- 🔧 Chore/Other:第58项重封 root-guard 清单 (d10599088f)
- 🚀 Feature/Improvement:监控三源入库派发装车(第58项) (1644af1ec8)
- 📚 Docs:生成块按 HEAD 面现算修正(trackedFiles 23102 / testFiles 5946) (4d5ca83919)
- 🔧 Chore/Other:第57项二次收敛后重封清单(git-guardian=3ede8c8ccc89) (0ab383bc9a)
- 🔧 Chore/Other:追认第57项 union 合并枚(bf3cf4db7e) (ad1e74364e)
- 🔧 Chore/Other:manifest 与 HEAD 面 git-guardian 对齐重封(部署环 fail-closed 解封) (2a5d8ccc41)
- 🔧 Chore/Other:第57项收敛归并后重封清单(git-guardian=3ede8c8ccc89) (7199e846ff)
- 🔧 Chore/Other:第57项重封 root-guard 清单(git-guardian=4cbbc9a018db) (ae9c4bf21e)
- 🐞 Fix:守护派发第六面成器 + IP归属信任巡检接线复原(第57项) (86df95839e)
- 🔧 Chore/Other:Gitee 资产补齐节流 30→10 分钟(压缩新版本国内可用窗口) (f1bc4c6dcc)
- 📚 Docs:生成块 testFiles 5946 / trackedFiles 23100 按 HEAD 面现算对齐(本票新增 1 测试文件) (e3be42de66)
- 🐞 Fix:模态档 id 前缀统一取裸名(目录 agnes/x 与上游 x 双形态)+9 例判据测试 (cf3f3dfe7d)
- 🔧 Chore/Other:第56项重封 root-guard 清单(git-guardian=604659742724) (c86194df62)
- 🐞 Fix:派发器三种读数空洞修正(第56项) (65b844c034)
- 🔧 Chore/Other:重封根护栏清单(第55项 runReadoutGate 收敛与镜像保真度接通后对齐) (bac9d5f53b)
- ♻️ Refactor:三把读数尺子收敛到 runReadoutGate 并接通镜像保真度(第55项) (b86fc43ec0)
- 🔧 Chore/Other:重封根护栏清单(第54项 双挂点与325自述改正后与规则对齐) (ce3963582d)
- 🚀 Feature/Improvement:临时检出寿命闸接入双挂点并改正325自述(第54项) (fc2cc30cd8)
- 🔧 Chore/Other:重封根护栏清单(git-guardian 新增 auditHookAuditHealth 后与规则同枚对齐,恢复部署自洽) (eb29502db9)
- 📚 Docs:按 HEAD 树重钉生成块数字(守门/文件/测试计数) (712507cbf4)
- 🐞 Fix:执行计划步骤说明里的英文工具码名改为本地化功能名 (587b64573e)
- 🐞 Fix:模态档豁免 availability 过滤(chat 探针把 image/video/tts 整批判 DOWN)+ 分类前置 (a8b62e012a)
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
- 🔧 Chore/Other:style+fix: 交互终端测试按 ai-service ruff 分组收敛 import;deploy 脚本补 UTF-8 BOM(门 263/265) (1b98d3b948)

**2026-11-20**
- 🚀 Feature/Improvement:推理强度改卡片式滑轨并上移到模型列表顶部 (03dcb232d6)
- 🐞 Fix:回补上一枚(3eba327)误删的 24 条键,推理强度新增三键保留 (7ddd03e371)
- 🚀 Feature/Improvement:推理强度补 ultra/默认/恢复默认三键(五语言同批) (3eba32725f)
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
- 🚀 Feature/Improvement:交互终端补 wait_for（expect 原语，命中/超时/已退出三态） (13502ec3cf)
- 🚀 Feature/Improvement:钩子配置只读自述端点 + 面板未生效提示(第31项) (910b5e3d56)
- 🐞 Fix:REST/SSE 基址改走 EdgeOne 承载的 www 臂(WS 仍钉 api 子域) (b03a443ed5)
- 🔧 Chore/Other:README 生成块 trackedFiles 23049 刷新 (c759895ef3)
- 📚 Docs:落 api 腿承载结论与 webhook 面迁移说明 (a0ac4cc111)
- 🐞 Fix:ai-endpoints 派生件按新 HEAD 面重钉(端点数据行零改动) (234bb2c119)
- 🔧 Chore/Other:给 8c87943 补具名追认(gate-body 无签名阻塞全仓 push) (c0257b063f)
- ⚡ Perf:47 全量面 blob 装箱上限放大,块数 9+ → 2 (efe4acf74a)
- 🐞 Fix:结清 Y-73 hygiene尺人工问责出口(H3判据从祖先76599d688还原,--strict/--json三维实测,16/18自测绿;出口2 LAND_ALLOW_STALE 因trailer超长) (8c87943bf5)
- 🚀 Feature/Improvement:交互终端补窗口尺寸 resize（POSIX TIOCSWINSZ / Windows ResizePseudoConsole） (c1c9cb39d2)
- 🔧 Chore/Other:部署环 fail-closed 复核——guardian-executor 清单按 HEAD 面 blob 重封(判据语义零改动) (e3e8882f31)
- 🐞 Fix:收录 TERMINAL_PTY_UNSUPPORTED_ON_PLATFORM 错误码 + 五语言词包(守门 94 R1) (1dad924450)
- 🚀 Feature/Improvement:hook.run 逐钩子运行结果前端消费面 + 报告 §5.31(第30项) (4d3aa6a635)
- 🔧 Chore/Other:README 生成块数字刷新(testFiles 5927 / trackedFiles 23048 / aiServiceRoutes 684) (d5afd8a89c)
- ⚡ Perf:30a 整面 raw 读数预启动,与 fsck 并发、失败回落同步档 (636b82d012)
- 🐞 Fix:端点派生件(ai-endpoints/api-endpoints)按新 HEAD 面重钉 —— 正文零改动 (47de80224d)
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
- 🚀 Feature/Improvement:交互终端补真 PTY 后端(POSIX stdlib pty,默认关,零依赖,Windows fail-closed) (77fcb6df0c)
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
Headline claims (same source as the table below, all live-computed): **654 tables · 4862 API routes ·
40 WebSocket endpoints · 103 catalogued LLMs · 38 platforms auto-publishing · 5953 test files ·
332 engineering gates · 59 CI workflows · 5-language i18n parity · 9 app packages · 16 shared packages ·
Headline claims (same source as the table below, all live-computed): **654 tables · 4862 API routes ·
Headline claims (same source as the table below, all live-computed): **654 tables · 4862 API routes ·
