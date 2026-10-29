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

Headline claims (same source as the table below, all live-computed): **611 tables · 4600 API routes ·
25 WebSocket endpoints · 99 catalogued LLMs · 38 platforms auto-publishing · 3544 test files ·
273 engineering gates · 50 CI workflows · 5-language i18n parity · 9 app packages · 16 shared packages ·
14 compose services**.

<!-- BEGIN GENERATED NUMBERS (node scripts/gen-doc-numbers.mjs --markdown) -->
| 指标 | 现值 | 取数键 |
| ---- | ---- | ------ |
| 数据库表 | 612 | `dbTables` |
| schema 文件 | 237 | `dbSchemaFiles` |
| API 路由 | 4609 | `apiRoutes` |
| 路由文件 | 650 | `apiRouteFiles` |
| AI 服务路由 | 610 | `aiServiceRoutes` |
| WebSocket 端点 | 25 | `wsEndpoints` |
| 入库模型清单 | 100 | `llmModels` |
| 发布平台 | 38 | `publishPlatforms` |
| 端应用包 | 9 | `appPackages` |
| 共享包 | 16 | `sharedPackages` |
| CLI 命令文件 | 67 | `cliCommandFiles` |
| CLI 工具文件 | 72 | `cliToolFiles` |
| 语言 | 5 | `i18nLanguages` |
| i18n 作用域 | 7 | `i18nScopes` |
| 语言包 JSON | 35 | `i18nMessageFiles` |
| 测试文件 | 3574 | `testFiles` |
| CI 工作流 | 50 | `ciWorkflows` |
| Compose 服务 | 14 | `composeServices` |
| 工程守门 | 299 | `guardianGates` |
| — blocking | 273 | `guardianBlocking` |
| — warn | 28 | `guardianWarn` |
| 跟踪文件 | 17622 | `trackedFiles` |

上表由 `node scripts/gen-doc-numbers.mjs --markdown` 生成,最后核对日期 2026-10-29。
每个数的来源就写在取数键旁边的实现里(`scripts/gen-doc-numbers.mjs` 的 `SOURCES`),**不得手抄、不得另立第二份**。

<!-- END GENERATED NUMBERS -->


## Recent updates (auto-maintained)

<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->
**2026-10-29**
- 🐞 Fix:secure-store 存量令牌一次性迁移 —— 修复后不必重登 (1b84801d41)
- 🐞 Fix:小程序端词包补 pdfToolsPage —— 这一屏渲染得出,但它每句话都取不到词条 (59a760a603)
- 📚 Docs:自动同步缺口账本到现读口径(镜像 260 · 缺口 11) (28283deb24)
- 🔧 Chore/Other:把 apps/api/scripts 装进 typecheck 射程,并清掉这面 35 枚从未被看见的存量类型错 (1362cec462)

**2026-10-29**
- 🐞 Fix:dev-stack 重入锁 + 重拉冷却 + pid 文件删除收紧 —— 治三条腿反复「重拉失败」 (899b685541)
- 🐞 Fix:secure-store 回潮重放 + 三屏模糊接线 + 两处 View 直挂裸文本 (ffbe506f9e)
- 📚 Docs:账本追平 —— PDF 工具台从未判定转已承载,缺口候选 10→9 (7758eabfee)
- 🐞 Fix:选中态样式键写反了 —— HEAD 面既有的类型红,不修则 RN 包谁都推不动 (bd41560d83)
- 🐞 Fix:结清 web api 壳迁移票——主体234份已在HEAD(349e116a66),末枚admin/sms/operations已迁 (9b30e5b362)
- 🚀 Feature/Improvement:侧栏补 /tools/pdf 入口(重放版) (c148782a0a)
- 🔧 Chore/Other:ui-routes 产物追上 app.config(重放版) (20c2d8755e)
- 🚀 Feature/Improvement:给 PDF 工具台补入口 + ui-routes 追上(重放版) (d2f1080548)
- 🚀 Feature/Improvement:PDF 工具台全链落地(页 + 路由 + 入口 + 判据 + 派生) —— 重放版 (6e3584b69f)
- 🚀 Feature/Improvement:web 侧栏补 nav.pdfTools 五语言(重放:上一版被并发 ref 移动挪出 main) (2315183140)
- 🐞 Fix:智汇AI 首页收口 —— 同数据源堆叠与随之失效的死码一并清掉 (55c75ae60b)
- 🐞 Fix:侧栏滚动淡出遮罩双层错修复 —— 它从来没显示过 (e3daebc7f6)
- ♻️ Refactor:收尾最后一枚 api<T> 委托壳 —— admin/sms/operations 迁 apiOrThrow(web 本地 api<T> 声明归零) (7ac88bb579)
- 🚀 Feature/Improvement:僵尸弹窗与撤销轮次两键五语言词包 (e13b707b2b)
- 🐞 Fix:/chat/abort 清除 conversation.metadata.pendingQuestion (5c1bbb7c02)
- 🐞 Fix:补 memory.refresh 三方 parity 漂移 + 承接上一枚提交信息事故说明 (79d4713885)
- 🔧 Chore/Other:-- (bf5355699b)
- 🐞 Fix:后端工具名单从前端真相源派生 —— 消除第二把尺子与存量漏计 (a06099ba76)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (15eaa6f61c)
- 🚀 Feature/Improvement:落 RP 族 RP-1 首行 —— 26 枚「未取号」票的迁移与文案改正线 (c842abf2b7)

**2026-10-29**
- 🐞 Fix:账本生成器补上"写盘后紧随注入"这条腿 —— 并把被我自己洗掉的载荷落回去 (e7bd406d8b)
- 🐞 Fix:账本生成器补上"写盘后紧随注入"这条腿 —— 并把被我自己洗掉的载荷落回去 (1414862c10)
- 📚 Docs:清偿 13c 归档器的文档↔代码脱节(4 文档 44 行)——文档在号召恢复退役件,这才是回潮的驱动力 (40c9ab3e53)
- 🐞 Fix:补齐守门 52 存量 22 处 visible-spawn 缺 windowsHide —— 11 个文件全纯追加(零行为变更) (7c624aa224)
- 🔧 Chore/Other:recover docked-browser panel wiring + cross-panel revealAt/CodeEditorHandle + ticket-60 pane chat-store addressing (d801061d98)
- 🐞 Fix:回灌腿补归属闸、任务中心断链修复,并把 WorkBuddy 第三条腿真正装车 (c3d5b63ca5)
- 🐞 Fix:secure-store 探测改同步取模块 —— dev bundle 的 lazy chunk 404 让刷新令牌永远落不了盘 (87a16d748a)
- 🐞 Fix:给守门 26 的存量开一条排水口——清扫器新增具名族 parent-pollution-strays(判据 import 门体,不抄第二份) (c86f69d8e1)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (e0acf77c41)
- 🐞 Fix:「我的」页菜单去掉重复的收藏入口 + 三组同屏撞名文案区分 (3dc363cd82)
- 🚀 Feature/Improvement:工具摘要三档维度五语言词包(directories/edits/terminalCommands) (1dfe9bb132)
- 🚀 Feature/Improvement:活动级几何虚拟化 + 工具摘要三档维度补齐 (80d97436e2)
- 🚀 Feature/Improvement:轮次呈现投影层建立并装车 —— 消灭「造好没装车」 (1f3e7bd27b)

**2026-10-29**
- 🐞 Fix:「我的」页菜单去掉重复的收藏入口 + 三组同屏撞名文案区分 (3dc363cd82)
- 🚀 Feature/Improvement:工具摘要三档维度五语言词包(directories/edits/terminalCommands) (1dfe9bb132)
- 🚀 Feature/Improvement:活动级几何虚拟化 + 工具摘要三档维度补齐 (80d97436e2)
- 🚀 Feature/Improvement:轮次呈现投影层建立并装车 —— 消灭「造好没装车」 (1f3e7bd27b)

**2026-10-29**
- 🐞 Fix:「我的」页菜单「会员中心」撞名 + 抽屉键错位 + 底部条目被淡出遮罩压暗 (3ac7b5859b)
- 🐞 Fix:增强跨端无硬边淡出遮罩强度 (dd34b4bbfa)
- 🐞 Fix:屏幕侧配对前景键词序写反 —— filterChip/chip/tab 三键按样式工厂约定回正 (876c4cb418)
- 🚀 Feature/Improvement:D05设计稿落地现状对齐 + 清偿器补守门130落地前自查(F4/F4b/F9三维,g30 s9/s2) (316beddb12)
- 🔧 Chore/Other:登记会话导出件族豁免 —— 门 47 缺口归零 (599baad8fa)
- 🐞 Fix:补回富文本锚点 link 族的 <a href> 渲染 —— 事故提交 9fdbc207ba 把 renderLink 当残留删掉导致 role=link 全失效 (8fa512f9bb)
- 🐞 Fix:修复 spacing 受管块压塌全站 max-w 命名档 —— AI 面板 32px 塌缩回归 (4394b6b490)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (20dc73c828)
- 🔧 Chore/Other:goal-b25 结清四票并补 G-07 进展注记 —— 门8未判定桶/F9判据/基线差值矛盾/滞台副本末枚 (427938a586)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3355d2fb25)
- 🐞 Fix:智汇AI 首页移除与 AI 应用商店重复的四块内容 (f571b65018)
- 🐞 Fix:结清 L28260 api-client 假绿灯票——判死现读 0,清账链 bd5ce8a101 已在 HEAD (a781529720)
- 🐞 Fix:部署环 ff 竞态锁正则跟上实现演进 + 门 11h 评分星补实心填充 + 水印复注 (2c6838d169)
- 🐞 Fix:结清三票(G-109四格全闭合/G-924死键已清零/G-689 stderr尾缓冲已装车) (5d9d115a2f)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3e240a1407)
- 🐞 Fix:结清两枚前提腐烂票(dot-source传递闭包3d31e4c499已装车/六屏下沉411646ee58等已全量) (13c1bdaec1)
- 🐞 Fix:结清 L5646 门116型B行——前提已腐烂(该文件裸git派生实测0,清偿枚949195bcb5早已是祖先) (b8ede2328e)

**2026-10-29**
- 📚 Docs:账本追平现读 —— 并交后手一条取证结论(小程序缺 PDF 工具台 hub) (b38b4a3e8b)
- 📚 Docs:结清最后一条 gap chat/workbench —— 工作台在 RN 与小程序都有了承载 (c36f4b71a8)
- 🚀 Feature/Improvement:跨端驾驶舱接上唯一调度器 —— 它自述"全自动管线唯一入口"而全仓零调用点 (b8dc9e3154)
- 🐞 Fix:拆掉 shared 包内自引造成的循环依赖 + 两个根 tab 多出来的返回键 (e648811e63)
- 🔧 Chore/Other:壳声明件跟随新落承载页(176 条说明符) (b35015da09)
- 🔧 Chore/Other:自动落 1 枚小程序壳承载页(共 1 枚待产) (a62494c34d)

**2026-10-29**
- 🐞 Fix:拆掉 shared 包内自引造成的循环依赖 + 两个根 tab 多出来的返回键 (e648811e63)
- 🔧 Chore/Other:壳声明件跟随新落承载页(176 条说明符) (b35015da09)
- 🔧 Chore/Other:自动落 1 枚小程序壳承载页(共 1 枚待产) (a62494c34d)

**2026-10-29**
- 🚀 Feature/Improvement:补 chatWorkbenchPage 五语言词组 —— 聊天工作台共享屏的取词面 (c0ce5eb4b8)
- 🚀 Feature/Improvement:落聊天工作台共享屏 + RN 薄壳 —— web /chat/workbench 的移动端承载 (dd5d0475fe)
- 🔧 Chore/Other:为同批误删恢复件 background_tasks 两枚登记保留裁决 —— 尺子的红线该由证据裁,不该由再摘一次消 (689b98ef7e)

**2026-10-29**
- 🚀 Feature/Improvement:落聊天工作台共享屏 + RN 薄壳 —— web /chat/workbench 的移动端承载 (dd5d0475fe)
- 🔧 Chore/Other:为同批误删恢复件 background_tasks 两枚登记保留裁决 —— 尺子的红线该由证据裁,不该由再摘一次消 (689b98ef7e)

**2026-10-29**
- 🐞 Fix:驾驶舱补上漂移哨兵这一维,并让"部分覆盖"不能冒充合格证 (4dfcfa7d51)
- 📚 Docs:结清 student/my-resources —— 数据面真补上了,原 gap 的前提已不成立 (b9f69fc4ef)
- 🔧 Chore/Other:壳声明件跟随新落承载页(175 条说明符) (e3ddff14d5)
- 🐞 Fix:重放被回潮抹掉的「我的创作」入口迁移 —— 底栏上方那块常驻嵌套块 (1fed27283b)
- 🐞 Fix:目录级 index.css 被当成每页伴生样式 —— 修判据并恢复被误升级的「领券中心」页 (99e58a986c)
- 🐞 Fix:守门 8「前缀假设」收口为三态可判 —— 未判定桶 237→0、孤儿路由变异自证修前绿修后红 (255275c277)
- 🐞 Fix:落地 background_tasks(spawn 强引用登记处)—— 修 main 上悬空 import (f7d269568c)
- 🐞 Fix:恢复 WorkPanel 被 9fdbc207ba 删除的第五组 props(主页/点选/开发者工具/独立窗口/常显停止) (f33f7b82a3)
- 🚀 Feature/Improvement:跨端无硬边滚动淡出遮罩 (RN 底部 / 小程序底部 / Web 侧栏) (1be5a68ad8)
- 🐞 Fix:F9 撞号判据收窄为「同号 ≥2 未勾活行」—— 已完成历史行与单活题面退出判红面 (d09c9d2bc7)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (940fda0cba)
- 🐞 Fix:补回「清理功能回退残留」删掉的四组功能面(并集恢复,零整文件覆盖) (60668e4c25)
- 🐞 Fix:补 stable 非纯追加时的换代处置 —— 真浏览器验证发现的判据射程缺口 (865460dfa3)

**2026-10-29**
- 🐞 Fix:重放被回潮抹掉的「我的创作」入口迁移 —— 底栏上方那块常驻嵌套块 (1fed27283b)
- 🐞 Fix:目录级 index.css 被当成每页伴生样式 —— 修判据并恢复被误升级的「领券中心」页 (99e58a986c)
- 🐞 Fix:守门 8「前缀假设」收口为三态可判 —— 未判定桶 237→0、孤儿路由变异自证修前绿修后红 (255275c277)
- 🐞 Fix:落地 background_tasks(spawn 强引用登记处)—— 修 main 上悬空 import (f7d269568c)
- 🐞 Fix:恢复 WorkPanel 被 9fdbc207ba 删除的第五组 props(主页/点选/开发者工具/独立窗口/常显停止) (f33f7b82a3)
- 🚀 Feature/Improvement:跨端无硬边滚动淡出遮罩 (RN 底部 / 小程序底部 / Web 侧栏) (1be5a68ad8)
- 🐞 Fix:F9 撞号判据收窄为「同号 ≥2 未勾活行」—— 已完成历史行与单活题面退出判红面 (d09c9d2bc7)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (940fda0cba)
- 🐞 Fix:补回「清理功能回退残留」删掉的四组功能面(并集恢复,零整文件覆盖) (60668e4c25)
- 🐞 Fix:补 stable 非纯追加时的换代处置 —— 真浏览器验证发现的判据射程缺口 (865460dfa3)

**2026-10-29**
- 🐞 Fix:合并留下的重复 const 把 Trae/Qoder 两条回灌腿一起炸了 —— 修脚本并补上 scripts 目录的可转译锁 (cecb7d460e)
- 🐞 Fix:首页输入框占位文案收短到单行 —— 原串在 360dp 下折行，第二行被 48dp 外壳裁掉 (3e70039dd0)
- 🔧 Chore/Other:摘净回潮尺子至今仍点名的两枚死副本 —— keepalive router 双份 + 孤儿 SDK 单文件 (082523e385)

**2026-10-29**
- 🐞 Fix:折叠漂开副本族(N→1,认领合并到保留行 + 逐字留痕;--fold-drifted-families) (1242b2b5e9)
- 🚀 Feature/Improvement:折叠语义例外集压过三维阈值 + 连接器分组从零消费者接成生产形态 (b5d9861d41)
- 🐞 Fix:并集补回 api-client 的 D09/D115 类型与发送链参数、web 发送链的窗格 store 参数 (5c20fb78ed)
- 🐞 Fix:12 份文件补齐溯源水印 + 两处 lint 修正 (9725a9113f)

**2026-10-29**
- 📚 Docs:摘 2 条已被现行判定取代的旧 gap 行 —— gap 全集从 4 收到真值 2 (179334406c)
- 🔧 Chore/Other:第二次摘除 miniapp-end-capabilities 与 tip-metro-guard —— 并发归并把本票第一次摘除反向抹回 2 枚 (32d79e0c8f)
- 🔧 Chore/Other:T3 阳性对照窗口 300→40 —— 正控不变而镜像测试从 215s 降到 70s (af58e0f5a6)

**2026-10-29**
- 🐞 Fix:修 RN 端两处——一处编译不过、一处文案印成键名原文 (53c1dfb0a4)
- 🐞 Fix:miniapp 路由件改按 HEAD 面隔离树重算 —— 上一枚追平把他人未提交的输入烘进了自述钉 (230a8b3da2)
- 🔧 Chore/Other:三族派生件同枚追平（路由×2 + 离线包×4 + 声明件×3）—— 本票新落的镜像页与壳把它们顶 stale (51cfd40aa9)
- 🔧 Chore/Other:壳声明件跟随新落承载页(176 条说明符) (3e3497502c)
- 🚀 Feature/Improvement:装出「逐字回潮」这道尺子并挂上常驻班次 —— 单父嫁接绕过钩子这一族从此有人看得见 (47d6d441af)
- 🔧 Chore/Other:自动落 1 枚小程序壳承载页(共 1 枚待产) (3f45c3f943)
- 🐞 Fix:恢复 chat store 被 c7476ff89b1 整份回退的实现(契约测试 96/96 钉住) (91cef71b0e)
- ♻️ Refactor:收口新增集里盘上干净的三枚裸 git(棘轮新增 24→21)—— check-ps1-bom(1 生产 + 2 自检夹具,后者写临时仓/无 ps 目录,respectively 传 tmp/noPs 作根)、tip-metro-guard(rev-parse)、check-index-unmerged-age(ls-files -u -z)改走 face-reader 的 gitRaw。三处各有不能照抄的地方,如实记:① ps1-bom 的 git() 下游要 Buffer(subarray + 前 3 字节 hex 判 BOM),故用 { binary: true } 而非默认 utf8 串,原 .toString("utf8") 调用点一个不删;② tip-metro-guard 原来读的是 spawnSync 的 .stdout,且两支失败语义不同 —— git 跑起来非零退出时 stdout 为空串(打印成 "HEAD "),spawn 层失败才吞掉、保持初值 "?";gitRaw 一律抛,故用异常上的 e.status 是不是 number 还原这两支,静默 catch 会把它压成一支、把非零退出错报成 "?";③ check-index-unmerged-age 头注原写「不挂 face-reader 取材层」,迁移后成半真:改成「派生已统一走 gitRaw;判的是 index 元数据而非仓库内容,故仍不走 listFaceFiles/catBatch 那条取材面」,原解释的不按仓库锚点读内容的实质信息保留。验证都是真跑:check-ps1-bom --self-test 判据 + 端到端全 PASS(含面取不到 exit=2 与真零不空扫两向)、check-index-unmerged-age 现读「index 无未合并条目」rc=0、eslint 三文件 0 error(14 warning 全存量 no-console)、where.mjs 三文件均 0 处。范围如实:本批只动新增集里盘上干净的 3 枚;另 3 枚(check-cross-end-screen-coverage / check-web-rn-parity / gen-rn-host-shell)正被别席改(补 windowsHide 治门 193),按纪律未碰;gen-i18n-compressed 盘上已被别席清空;剩 17 枚属「HEAD 有、盘上已删未提交」,随删除落地自消;基线 18 枚是刻意存量(含 spawn 夹具件与钩子内 env 注入那一族),本批不碰。故棘轮在删除落地前仍红,落地后 39-17-3(他席)-1 = 18 = 基线。 (e17454a7de)
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

