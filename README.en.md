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
    &nbsp;&nbsp;|&nbsp;&nbsp;
    <strong>Mirrors</strong> · <a href="https://gitee.com/JLSLSSZWHYXGS_0/IHUI-AI">Gitee</a> · <a href="https://gitcode.com/IHUI-AI/IHUI-AI">GitCode</a>
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

Headline claims (same source as the table below, all live-computed): **598 tables · 4,443 API routes ·
25 WebSocket endpoints · 118 catalogued LLMs · 38 platforms auto-publishing · 2,955 test files ·
260 engineering gates · 49 CI workflows · 5-language i18n parity · 9 app packages · 16 shared packages ·
15 compose services**.

<!-- BEGIN GENERATED NUMBERS (node scripts/gen-doc-numbers.mjs --markdown) -->
| 指标 | 现值 | 取数键 |
| ---- | ---- | ------ |
| 数据库表 | 599 | `dbTables` |
| schema 文件 | 232 | `dbSchemaFiles` |
| API 路由 | 4449 | `apiRoutes` |
| 路由文件 | 606 | `apiRouteFiles` |
| AI 服务路由 | 576 | `aiServiceRoutes` |
| WebSocket 端点 | 25 | `wsEndpoints` |
| 入库模型清单 | 118 | `llmModels` |
| 发布平台 | 38 | `publishPlatforms` |
| 端应用包 | 9 | `appPackages` |
| 共享包 | 16 | `sharedPackages` |
| CLI 命令文件 | 66 | `cliCommandFiles` |
| CLI 工具文件 | 72 | `cliToolFiles` |
| 语言 | 5 | `i18nLanguages` |
| i18n 作用域 | 7 | `i18nScopes` |
| 语言包 JSON | 35 | `i18nMessageFiles` |
| 测试文件 | 2993 | `testFiles` |
| CI 工作流 | 49 | `ciWorkflows` |
| Compose 服务 | 14 | `composeServices` |
| 工程守门 | 266 | `guardianGates` |
| — blocking | 242 | `guardianBlocking` |
| — warn | 27 | `guardianWarn` |
| 跟踪文件 | 15476 | `trackedFiles` |

上表由 `node scripts/gen-doc-numbers.mjs --markdown` 生成,最后核对日期 2026-10-21。
每个数的来源就写在取数键旁边的实现里(`scripts/gen-doc-numbers.mjs` 的 `SOURCES`),**不得手抄、不得另立第二份**。

<!-- END GENERATED NUMBERS -->


## Recent updates (auto-maintained)

<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->
**2026-10-21**
- 🚀 Feature/Improvement:补齐 6 屏对齐 web 内容编辑域(文章/问答/名片/AI世界/广场发布) (ce9c8c08a8e)
- 🔧 Chore/Other:登录请求显式声明通道 —— 解开本机 e2e 全量的 401 阻断 (67c57e311b6)
- 🚀 Feature/Improvement:补齐 14 屏对齐 web 用户/发布/学习域 (1982228870b)
- 📚 Docs:G-939 成因查明并改写 —— 门 100 头注自写口径只覆盖提交链,而 git-sync-converge 是 commit-tree+CAS 旁路不跑钩子 ⇒ 对旁路合并结构性失明;活改成"把 A1 判据 import 给旁路侧复量" (587f74e7c7d)
- 📚 Docs:登记「已推送提交被并发合并吞掉且守门 100/168 当场没响」这一格(现读枚 12898ccd9b 双否,已 tag 保全并重落) (ffc81df2014)
- 📚 Docs:G-921 翻勾 —— 三枚(Connectors / DomainHub / McpStore)共享层下沉全部落地并上线(枚 588a6342d8 / 7f9eb8eb00 / cc9b3672ef) (316bc4bf2e7)
- 📚 Docs:登记门 39 全量档新增的 6 枚 V1 红(枚 8f16334f48 补齐 12 屏里的 ConnectedAccounts / ImageGenGallery / ImageGenTemplates / Points / Usage / WrongQuestions 六屏未做共享层下沉) (d7deeddd30b)
- 🔧 Chore/Other:重生成 RN ui-routes 自述钉并补回 SecurityCenter 白名单条目(45088b42447 旁路落地时未跑写回钩子) (752074e67f6)
- 🐞 Fix:后台守卫不再把「角色还没查到」折成 0 —— 真管理员冷加载 6 次有 3 次被弹到 /forbidden(附双臂变异自证的时序测试) (c9a75878532)
- 🐞 Fix:监控面板查询失败整轮不落结果 (f6f9715fe98)
- 📚 Docs:守门 229 那条就地改写 —— 补 H4 档(摘前先问门 71 会不会把这条按未勾还原)、H3 基线改判 HEAD^、新增 state=all-held 与 exit 3 的机读结论(全仓不再有无需清扫式兜底文案) (ef8e6666cc9)
- 📚 Docs:票60 就地改写进度注记 —— 第三、四批已落(含被并发合并吞掉那枚的重落凭据),未收口只剩 e2e 真机核验与描边态分窗格 (4e4fc9e5b25)
- 📚 Docs:登记本轮收口留下的六件真活(归档件 lint-staged 雷区其余 84 枚 / 取号入口被 O 族重号顶死 / 门 105 G5 产物钉存量红 / D197 换行开关用例存量红 / 会话滚动位恢复无生产接线 / 多窗格缺 e2e 真机核验) (d96c474a17c)
- 🚀 Feature/Improvement:票60 第三、四批 —— 续传/工具面板/发起分析全面窗格化,跳转总线按窗格门控(重落被并发合并吞掉的 12898ccd9b) (d3541dc2670)
- 🚀 Feature/Improvement:G-921 第三枚(收官)—— McpStoreScreen 的 UI 下沉到共享层(新建 packages/app/src/features/mcp-store/McpStoreScreen.tsx + index.ts 导出组件、类型与共享判据 mcpInstallBlockedKey),RN 侧改 wrapper(只留四项 API 调用 get / install / setStoreServerEnabled / uninstall、安装与卸载二次确认弹层 appAlert、i18n 与主题注入),照 PaymentScreen / DomainHubScreen / ConnectorsScreen 同一型 wrapper 模式。 (cc9b3672ef2)
- 🐞 Fix:输入框外框的常驻暖色环也纳入判据 —— 门 231 W1 增 W1-input 维 (177e5230c40)
- 🚀 Feature/Improvement:补齐 12 屏对齐 web 设置/内容/交易域 (8f16334f483)
- 🐞 Fix:监控面板查询失败保留旧数据 + 筛选下拉不再撑满整行 (70ea7877d40)
- 🐞 Fix:底栏图标改走内联 data URI —— 本地 PNG 的 Image 取源链在 release 上恒空白 (10c2d9e7643)
- 📚 Docs:G-921 登记第二枚(ConnectorsScreen)下沉共享层的进展与凭据(枚 588a6342d8;门 39 全量红 2→1;剩一枚 McpStoreScreen 归下一批) (c8ee7a2c4d6)
- 🐞 Fix:持续性门槛的 firstAt 必须同时进 info —— 派发侧读的就是那一份 (b398a4035ca)
- 🚀 Feature/Improvement:G-921 第二枚 —— ConnectorsScreen 的 UI 下沉到共享层(新建 packages/app/src/features/connectors/ConnectorsScreen.tsx + index.ts 导出组件与类型),RN 侧改 wrapper(只留 API 调用 get/setEnabled/sync/delete、删除二次确认弹层 appAlert、i18n 与主题注入),照 PaymentScreen/DomainHubScreen 同一型 wrapper 模式。 (588a6342d8b)
- 🐞 Fix:补录 SecurityCenter 的 ROUTE_ROOT_BG chrome 档(屏内渲染 NavBar,顶栏 chrome 结构锁判据要求) (c849c50fa11)
- 🐞 Fix:守门 78 补第六维——外部依赖声明↔链接对账,根治 lucide-react 断链致 8 端构建阻断 (c1e0350c61b)
- 🐞 Fix:监控域之外 5 处状态色文字同接角色档 —— 全 web 残留读数 0(同族后缀档 4/4 未动) (1227a9742cb)

**2026-10-21**
- 📚 Docs:G-921 登记第一枚(DomainHubScreen)下沉共享层的进展与凭据(枚 7f9eb8eb00;门 39 全量红 3→2;剩两枚 Connectors/McpStore 归下一批) (0e948350380)
- 🚀 Feature/Improvement:G-921 第一枚 —— DomainHubScreen 的 UI 下沉到共享层(新建 packages/app/src/features/domain-hub/DomainHubScreen.tsx + index.ts 导出组件与类型),RN 侧改 wrapper(只留路由参数 domain、导航分派 target、i18n 与主题注入),照 PaymentScreen 同一型 wrapper 模式;条目图标以 ReactNode 由平台注入,共享层不绑定图标注册表。门 39 全量档红 3→2(DomainHubScreen 摘掉);共享层与 RN 两侧 typecheck 对本票文件零错误(存量 35 条红全在他人工作树删掉的 drawer-nav / SelectionAnnotationBar 面),eslint 0 finding,水印 verify 通过 (7f9eb8eb00b)
- 🔧 Chore/Other:重钉 web/miniapp ui-routes 自述钉(承接监控域角色档接入) (4a02eacc6f3)
- 🐞 Fix:状态色新增「文字」角色档并接上监控域 48 处 —— 亮档真机实测 1.96~2.62 提到 AA 4.5 以上,暗档取值逐字不动 (c2b0c254a12)
- 🚀 Feature/Improvement:安全中心对齐 web 设置页(评分/2FA/会话/安全事件) (45088b42447)
- 🐞 Fix:/agents/featured 去掉从未实现的 featured=1 参数并取全量 —— 原来静默只显示 20/124 (37805cd2e1a)
- 📚 Docs:现读订正「锁的初始化写全再原子可见」—— lib/lock-atomic-init 已在 HEAD 且两把锁均已接线;解阻判据①③成立,② 的 deploy-lock 套件本机并发下 flaky(三连跑 50/2、51/1、52/0),未归因不冒领,留一格 (c4f81394c79)
- ⚡ Perf:英文首页与公开内容页加边缘缓存头 (940303d21db)
- ⚡ Perf:public 图片按显示尺寸收敛，53MB → 49MB（首屏 logo 867KB→53KB） (52257166e09)
- 📚 Docs:修 tab-bar-metrics 的陈旧注 —— 「颜色一律走 CSS 变量」与实测相反 (cd10e14a8dc)

**2026-10-21**
- 🚀 Feature/Improvement:抽屉侧边栏对齐 web 侧边栏(导航单源 + 二级子菜单 + 内容域) (83e0be9c16d)
- 🔧 Chore/Other:暖色描边禁令补齐 extension 射程 + 落原生插件调用形状回归档 (3ea4cbba0cf)
- 🐞 Fix:两处生产者从不发射的字段错配 —— 停摆正文出处句恒缺失、TEMP 在写证据支恒 0(同 firstAt/stat 一族) (b4872d129c6)
- 📚 Docs:现读订正「AGENTS.md 体积判据接进提交链」—— 门 207 已按 1 行紧凑块接线(HEAD 4855 行),C1 余量 389;同轮报警:AGENTS.md 现读 95,845 字节 / 预算 96,000,余量仅 155 字节,出路=整区归档(不代裁范围) (56844bc8e5f)
- 🐞 Fix:目录一次取全(默认 20→200)+ 修 community 触底重复追加同一批 (c30b7f4f107)
- ⚡ Perf:状态页 RSC payload 1.97MB → ~150KB，模型列表改客户端渲染 (7d1d322bf58)
- 🐞 Fix:市场全量页补 pageSize=200 —— 不带参只吃服务端默认 20,124 枚只见 20 (a3b180513e1)
- 🔧 Chore/Other:work-panel P3-3 补 openPanel() —— openPanel({url}) 只导航不置 open (e345966dd6f)
- 🐞 Fix:重贴被并发收敛卷掉的目录取全修复(RN 增量渲染 + 扩展 30→200) (bf2f6aa466e)
- 🔧 Chore/Other:重钉 web/miniapp ui-routes 自述钉(承接漏斗与磁盘配色两枚改动) (e9343fc4c1b)
- 🐞 Fix:门 232 补 onFailHint(此前是两行空串,失败时提交者拿不到任何出路,只能跳门 —— 违 §0.8/§0.10);同笔把门 39 注释里已失真的写死计数(151/153、白名单四枚旧名)改成现读口径 + G-922 后判据形态 (3fb86c5891f)
- 🐞 Fix:漏斗末段绿条与磁盘指标取同源 token —— 原 emerald-600/purple-600 亮档白字实测 3.61/暗档 2.40 低于 AA (c505a415681)
- 🐞 Fix:「我的 Agent」页签改走 /agents/my —— 原来显示的是市场前 20 枚 (3d8d56c58f7)
- 📚 Docs:更正 sshd 自愈块的归因 —— 502 是本机隧道副本无 sshd,不是生产 sshd 挂了 (ba37f554225)
- 📚 Docs:G-922 登记守门 39 判据四修的进展与凭据(枚 bd3bc2238c;剩一格=21 枚屏级共享存量归 G-921 与各屏持有人) (6856b4d1071)
- ⚡ Perf:首页边缘缓存头 + 公网缓存预热脚本 (7ee87c82172)
- 🐞 Fix:冷启动准入不再把 httpOnly 老用户判成匿名 (1d541e8dbe5)
- 🐞 Fix:守门 39 判据四修(G-922)—— ① ROOT 不再由 cwd 定根(改由 import.meta.url 推导) ② screen 正文按面取 blob(HEAD/索引/工作树,取不到即未判定),不再 readFileSync 读盘 ③ 白名单带 why+expires,到期失效、登记名在 screens 清单里不存在=腐烂判红(按现读摘除 DebugScreen/SquareScreen 两枚死账,存量归零后本维才设红) ④ 新增「屏级共享」维:有 import 还得 packages/app 有同名共享屏,存量 21 枚只报数、只拦新增与退化(§0.2 存量未归零不升 blocking);自检 12/12 + 镜像 6/6 + 变异自证(恒真变异 ⇒ 4 例镜像 + 2 例自检翻红) (bd3bc2238c6)
- 🐞 Fix:部署时自愈 sshd —— 生产 SSH 入口 502 的真因是本机 sshd 没在应答 (1eda2b49ef1)
- 🐞 Fix:公网探测派发契约补上 stat 出口 —— 修严重度档恒 0 使恶化即重报通道失明 (31b33393ae3)
- 🔧 Chore/Other:chat-search 搜索框改按真实 testid —— 旧选择器在共享 SearchInput 上结构上不存在 (dd11b1712e9)

**2026-10-21**
- 🐞 Fix:门 231 staged 档把「本枚提交无射程内文件」误判 exit 2 —— 对任何无关提交恒红 (97891b940c7)
- 🚀 Feature/Improvement:门 212 加维 —— RN 聚焦档 focusedStyle 不得带几何键 (e2810ebc063)
- 🔧 Chore/Other:清扫轮摘行前先问门 71 同一把尺子,并修掉 H3 一处既有假红 (7388b68c073)

**2026-10-21**
- 🐞 Fix:自定义 tabBar 选中色/光晕改走 JS 派生态 —— 根因是内联 var(--color-*) 在 weapp 不解析 (e0fbb8a6247)
- 🔧 Chore/Other:修门 77 镜像测试的 B6 行定位提取式(排版加粗即假红,判据强度不减) (ec6e4465d33)
- 🔧 Chore/Other:重钉 web ui-routes 自述钉(承接 wb-cells 定义补齐) (d14a982fb90)
- 🐞 Fix:拔掉原生强调色回落系统橙的那条腿 (eacdb510932)
- 🐞 Fix:补上 wb-cells/wb-cells-lg 的 CSS 定义(修上一枚引入的单列竖排回归) (ce29449b653)
- 🔧 Chore/Other:checkin 页补账号列表桩 —— 收「空状态永不渲染」那一格 (a0ec15f3e0a)

**2026-10-20**
- 🐞 Fix:修掉本票 e2e 锁里一枚不存在的 Playwright 断言方法 (c7de0dc2d18)
- 🐞 Fix:被动失效清桌面 vault 也走 CAS —— expireSession 曾盲清 auth.json,抹掉另一窗口刚轮转写回的新 token(自动登录时好时坏的另一条腿);补 api.test 三例与 store 侧 CAS 五例、小程序 clearAuth 同批清用户资料断言 (e53a1911c91)
- 🔧 Chore/Other:收紧门 218 的 RN 端硬编码 hex 基线(P0 治理后置) (c498f676642)
- ♻️ Refactor:摘除 packages/app 零消费者底栏副本(文件 + barrel 两行导出) (1d8f576f35a)
- 🔧 Chore/Other:给监控面板两种呈现的切换器钉一条真实浏览器 a11y 回归锁 (d4c48f875eb)
- 🔧 Chore/Other:首次 bootstrap .ihui-agent/archive/ 的 lint-staged 就近出口件 (a966301a801)
- 🐞 Fix:归零 11 屏 137 处圆角死类名(此前圆角实际为 0),并修 3 屏占位符明暗颠倒 (1e965254164)
- 🔧 Chore/Other:重生成 ui-routes 产物自述钉 —— 收旁路合并点名的那步"落地后需重生成" (4d57b0c3080)
- 🔧 Chore/Other:重钉 web ui-routes 自述钉(承接内层网格改造经归并后的当前面) (4c9736fb71e)
- 🐞 Fix:大屏内层 StatCell/KPI 网格改 auto-fit,消除窄轨逐字换行 (706f8d02dd7)
- 🚀 Feature/Improvement:暖色描边禁令接进提交链(注册条目) (f288064073c)
- 🐞 Fix:根治输入框橙色描边(主题级缺陷,全端所有输入框同时中招) (8c952aac27d)
- 🐞 Fix:重生成 ui-routes 自述钉(设置页两处登出改动使输入集哈希失效) (3bf512e4656)
- 🐞 Fix:登出标记只在用户主动退出时落 + 多窗口 vault 回收走 CAS (7465df281a6)
- 🔧 Chore/Other:重钉 ui-routes 产物自述 pin —— 收门 105 的 G5 (a68bf1d5e58)
- 🐞 Fix:监控面板页改成共享 Tabs 的「根包 List + Content」写法,补回 role=tabpanel (c64ca1aba30)
- 🔧 Chore/Other:追平 web/miniapp 两枚 ui-routes 自述钉(90b14bf8526 的追平被并发落地顶旧) (54199c2139e)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (cc027e1412e)
- 🚀 Feature/Improvement:门 208 加第二把豁免载体(每处一行、存续由门现算),不再动他人现场 (5daba796e04)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2fe034dd979)
- 🔧 Chore/Other:重钉 web ui-routes 自述钉(承接监控目录红色档收口) (3cb0c290df7)
- 🐞 Fix:监控目录红色档收口 text-danger,并修漏斗末段暗档白底白字 (b444e5afdf3)
- 📚 Docs:D690 摘行(完成即删;上一枚已带结清裁定与全部凭据 sha) (569b2977366)
- 📚 Docs:D690 结清——剩余一格裁定不救,维持 fail-closed(机主待拍板项全权授权代行;凭据三件入库,详见行内注记) (1127428b72c)
- 🐞 Fix:监控切换器选中态改品牌实底对 + 大屏落点 e2e 断言收两形态 (c67496a4f7c)

**2026-10-20**
- 🔧 Chore/Other:跟平 ui-routes 自述钉(旁路落地不跑 pre-commit 写回档) (747ca440a36)

**2026-10-20**
- 🐞 Fix:补正胶囊指示条缩进档,并改掉本票头注里一句假话 (98dfbb79707)
- ♻️ Refactor:上滑/下滑浮动箭头钮收进跨端单一源 scroll-jump-spec(与 web 同款) (90b14bf8526)

**2026-10-20**
- 🔧 Chore/Other:重钉 web ui-routes 自述钉(承接监控目录同族色值与网格改动) (14769267179)
- 🔧 Chore/Other:跟上注释一枚的 ui-routes 自述钉(旁路落地不跑写回档) (399b7d74ab7)
- 🐞 Fix:监控目录同族色值收口 + 大屏主体网格改按容器判定 (8e6da18c552)
- 🚀 Feature/Improvement:新守门 check-auth-cookie-domain-scope.mjs —— 会话 Cookie 域作用域对账装进提交链 (d7edb8373e4)
- 📚 Docs:如实登记底部胶囊光晕在本端的取证状态 (3b8b7092e58)
- 📚 Docs:登记守门七七的 dead-class 圆角真存量票 (f73a575af59)
- 📚 Docs:登记守门普查净检出分桶带出的三件真工作(RN 屏提取/守门三九判据缺陷/记忆模块直连) (fe5152cbce7)
- 🚀 Feature/Improvement:新守门 check-auth-cookie-domain-scope.mjs 接进提交链(会话 Cookie 域作用域对账,id 现取) (9466ff75282)

**2026-10-20**
- 🔧 Chore/Other:跟平两处 ui-routes 派生码自述钉(输入系他人已入库改动) (ba2eb2d7999)
- 🐞 Fix:占位符色改走 text.tertiary 档,收掉守门二一八的四处基线外新增硬编码 (7e9236d26fb)

**2026-10-20**
- 🔧 Chore/Other:跟进底部胶囊单一源改动的 ui-routes 派生码自述钉 (8c978e5dd27)
- ♻️ Refactor:底部胶囊几何收成一份源,并钉住"两端必须转发"这条前提 (a3689de714a)
- 🔧 Chore/Other:重钉 web ui-routes 自述钉(承接大屏页头与面板页两枚改动) (1a3f8bf5f08)
- 🐞 Fix:监控面板页 7 处固定色换语义 token(亮色档下 cyan-300 近乎不可读) (f2a834491b9)
- 🐞 Fix:显式登出与被动失效分离,停用迟到重放吊销整族 (3aad1aa1563)
- 🐞 Fix:公网探测持续档取不到 firstAt 致告警被无限压住 (efb00b021ff)
- 🐞 Fix:会话 Cookie 域补公网臂——Host 改走代理感知出口 (5c1b396b1e4)
- 📚 Docs:完成即删 —— 摘除上一条刚结清的 G-921 已勾行(四件入库凭据见枚 dfbb61a0d0d29485c2ddc02265053c19e3c94e84 的行内注记) (0811d6856f3)
- 🐞 Fix:监控呈现切换器选中态改提亮 —— 暗色下纯黑压在灰槽上比底还暗,读不出选中 (77455aed69d)
- 📚 Docs:结清 G-921 —— Coze 导入留下的四件逐条现读复验已入库,附两枚 sha 与门读数;并更正头像签名有效期措辞(现读 3 天/30 天) (dfbb61a0d0d)
- 🔧 Chore/Other:重钉小程序 ui-routes 自述钉(承接本端 Agent 契约补迁的 7 枚输入) (d4f9217e507)
- 🐞 Fix:拉取详情不再把头像/模型刷成过期值 —— Coze get_online_info 映射收口 (7aaff2fceb4)
- 📚 Docs:回潮副本行内登记「勿照此行派单实现」,勾态不动 (77e41809d5b)
- 🐞 Fix:e2e-browser-hub 拓扑构建补第三个选择器 —— extension 的闭包也在内 (7069b49f888)
- 🐞 Fix:门 208 按双向核验分流本仓 linked worktree,并把两枚独立克隆搬出仓树 (5ef950c3b41)
- 🔧 Chore/Other:重钉 openapi 产物 favorites resourceType 枚举 —— 收 OpenAPI Check 的 ARTIFACT_DRIFT (385bd05b73b)
- 🚀 Feature/Improvement:导入 Coze 官方工作区 116 枚智能体的头像静态件 (080c9461698)
- 🐞 Fix:会话 Cookie 域按请求 host 判定,本机地址不再丢 Cookie (d230137b8a4)
- 🔧 Chore/Other:清掉两道拦所有人的存量红(门44/90)[cross-domain] (8be351e966e)
- 🐞 Fix:门 193 点名 check-format-changed —— 派生 git 的 stdio 属性名写回调用点 (51da8721926)
- 📚 Docs:回潮的同题副本改判留勾(不摘第二次) (2faad2d9bd2)
- 🐞 Fix:e2e-browser-hub 把拓扑构建提到 migrate/seed 之前 —— 收那条自 10-16 在位的恒红 (eacf036197c)
- 📚 Docs:结清 5 行(影子js/生成器关停/传输层单点化/Python悬空尺子/同题副本)并改判 4 行的等待前提 (30fb6d56a0a)

**2026-10-20**
- 🔧 Chore/Other:四枚主线红追平产品结论 —— 埋点装饰/告警身份/ERC20 校验/400 中文文案 (88ccfa0a921)
- 🐞 Fix:补迁 Agent 契约真实载荷 —— 收 CI typecheck 本端 34 条红 (9d9dbc8262e)
- 📚 Docs:D690 改判 diff② 在 chat 腿结构性不可接,剩余一格归拍板(可达性锁已入库) (aa6dc1d67a9)
- 🐞 Fix:玻璃底回调至 0.6,底部标签选中态放大一档 (84e9a56ef59)
- 🔧 Chore/Other:D195 簇 web e2e 收口第二批(几何/视觉/下载/页面/i18n/登录史)+ CI 浏览器共享内存 (788e6867ab8)
- 🐞 Fix:补迁 Agent 契约真实载荷 —— 修 sidepanel Agent 页运行即崩的一格 (68fea6fa5e5)
- 🔧 Chore/Other:钉住 D1047 主对话腿重放取数侧的可达性锁 (1f9ee2e4912)
- 🐞 Fix:聚焦描边只换色不改宽,收掉登录框同型的五处覆盖 (9cebf01a24d)
- 🚀 Feature/Improvement:立守门 229 拦完成即删的跨枚滞留,并给无人值守兜底清扫轮挂 git-guardian 巡检 (c79fbf794c5)
- 📚 Docs:点名守门 229 与完成即删兜底清扫轮(门 89 R4),并按门 207 体积预算把 11 行逐字移入归档件 (d7d796630e4)
- 📚 Docs:登记 Coze 导入留下的四件未提交件(等共享索引空闲再落) (1c9e11fda84)
- 🔧 Chore/Other:D195 簇 web e2e 收口第一批(chat/form/queue/work-panel/nav/topbar/login)+ 生产构建暴露口 (1a8690b2ffd)
- 🐞 Fix:大屏去掉灰底网格,监控呈现切换器并入顶栏不占一行 (ba708e445bc)
- 🐞 Fix:监控面板去掉多余外层容器,内容直接铺满工作区 (5713188d85a)

**2026-10-20**
- 🔧 Chore/Other:四枚主线红追平产品结论 —— 埋点装饰/告警身份/ERC20 校验/400 中文文案 (88ccfa0a921)
- 🐞 Fix:补迁 Agent 契约真实载荷 —— 收 CI typecheck 本端 34 条红 (9d9dbc8262e)
- 📚 Docs:D690 改判 diff② 在 chat 腿结构性不可接,剩余一格归拍板(可达性锁已入库) (aa6dc1d67a9)
- 🐞 Fix:玻璃底回调至 0.6,底部标签选中态放大一档 (84e9a56ef59)
- 🔧 Chore/Other:D195 簇 web e2e 收口第二批(几何/视觉/下载/页面/i18n/登录史)+ CI 浏览器共享内存 (788e6867ab8)
- 🐞 Fix:补迁 Agent 契约真实载荷 —— 修 sidepanel Agent 页运行即崩的一格 (68fea6fa5e5)
- 🔧 Chore/Other:钉住 D1047 主对话腿重放取数侧的可达性锁 (1f9ee2e4912)
- 🐞 Fix:聚焦描边只换色不改宽,收掉登录框同型的五处覆盖 (9cebf01a24d)
- 🚀 Feature/Improvement:立守门 229 拦完成即删的跨枚滞留,并给无人值守兜底清扫轮挂 git-guardian 巡检 (c79fbf794c5)
- 📚 Docs:点名守门 229 与完成即删兜底清扫轮(门 89 R4),并按门 207 体积预算把 11 行逐字移入归档件 (d7d796630e4)
- 📚 Docs:登记 Coze 导入留下的四件未提交件(等共享索引空闲再落) (1c9e11fda84)
- 🔧 Chore/Other:D195 簇 web e2e 收口第一批(chat/form/queue/work-panel/nav/topbar/login)+ 生产构建暴露口 (1a8690b2ffd)
- 🐞 Fix:大屏去掉灰底网格,监控呈现切换器并入顶栏不占一行 (ba708e445bc)
- 🐞 Fix:监控面板去掉多余外层容器,内容直接铺满工作区 (5713188d85a)

**2026-10-20**
- 🔧 Chore/Other:补删 FenLeiOverlay 的孤儿测试(组件已随 2ddd180933b 移除) (029f86fab89)

**2026-10-20**
- 🔧 Chore/Other:跟进底部胶囊改动的 ui-routes 派生码自述钉 (83a377f662f)
- 🐞 Fix:底部胶囊与 AI 输入框同宽高 + 选中态改浅紫发光 (2f846651b8d)
- 🔧 Chore/Other:重钉 web ui-routes 自述钉(承接归并带入的 panels 页改动) (c9cf3c5466b)
- 📚 Docs:第二轮配平翻勾 2 条(补齐门 71 的 closed 计数欠账,为摘行留凭据) (ce6ccb06dc0)
- 📚 Docs:配平翻勾 8 条被门 71 以未勾形态回捞的已结清票(走该门头注 (c)「翻勾后整行删除」的合规通道,为下一步摘行留凭据) (ac9a172b234)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (36b096a1044)
- 🔧 Chore/Other:重钉 web ui-routes 自述钉(随大屏页头改动) (474d771c7bd)
- 🐞 Fix:大屏页头改按容器判定并放行 admin 菜单路由公网可达 (805a36bad69)
- 🚀 Feature/Improvement:票60 步序四第二段——非根窗格独立聊天主体 + 窗格事件门控 (23a2c8ac126)
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
