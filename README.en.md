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

Headline claims (same source as the table below, all live-computed): **624 tables · 4703 API routes ·
25 WebSocket endpoints · 100 catalogued LLMs · 38 platforms auto-publishing · test file counts in the generated table below ·
336 engineering gates · 54 CI workflows · 5-language i18n parity · 9 app packages · 16 shared packages ·
14 compose services**.

<!-- BEGIN GENERATED NUMBERS (node scripts/gen-doc-numbers.mjs --markdown) -->
| 指标 | 现值 | 取数键 |
| ---- | ---- | ------ |
| 数据库表 | 624 | `dbTables` |
| schema 文件 | 241 | `dbSchemaFiles` |
| API 路由 | 4703 | `apiRoutes` |
| 路由文件 | 666 | `apiRouteFiles` |
| AI 服务路由 | 631 | `aiServiceRoutes` |
| WebSocket 端点 | 25 | `wsEndpoints` |
| 入库模型清单 | 100 | `llmModels` |
| 发布平台 | 38 | `publishPlatforms` |
| 端应用包 | 9 | `appPackages` |
| 共享包 | 16 | `sharedPackages` |
| CLI 命令文件 | 75 | `cliCommandFiles` |
| CLI 工具文件 | 92 | `cliToolFiles` |
| 语言 | 5 | `i18nLanguages` |
| i18n 作用域 | 7 | `i18nScopes` |
| 语言包 JSON | 35 | `i18nMessageFiles` |
| 测试文件 | 4260 | `testFiles` |
| CI 工作流 | 54 | `ciWorkflows` |
| Compose 服务 | 14 | `composeServices` |
| 工程守门 | 336 | `guardianGates` |
| — blocking | 309 | `guardianBlocking` |
| — warn | 29 | `guardianWarn` |
| 跟踪文件 | 19588 | `trackedFiles` |

上表由 `node scripts/gen-doc-numbers.mjs --markdown` 生成,最后核对日期 2026-11-06。
每个数的来源就写在取数键旁边的实现里(`scripts/gen-doc-numbers.mjs` 的 `SOURCES`),**不得手抄、不得另立第二份**。

<!-- END GENERATED NUMBERS -->


## Recent updates (auto-maintained)

<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->
**2026-11-07**
- 🐞 Fix:提现状态补 processing 五语言词条,并在 web 映射补齐 label/style(对齐 @ihui/types 六值契约) (cee709a769)
- 🚀 Feature/Improvement:重放 VIP/钱包薄壳族 + 成绩页整屏单源 + 归属层外部状态本地兜底（十枚滞后续提交的定点入库） (d964d0ec0f)

**2026-11-07**
- 🚀 Feature/Improvement:成绩页跨端词条五语同批（三数/全量解析/rank/三操作）并按合并后源重算离线包 (9d2677fe83)

**2026-11-06**
- 📚 Docs:README 生成块 trackedFiles 19557→19559(按 HEAD 现算值归位) (5f0e886a89)
- 🐞 Fix:OTA 腿 eas update 超时 15→30 min,并把被杀的末段输出打出来 (e2ba407272)
- 🐞 Fix:深度收口 RN 样式高度口径 + 百分比判据进提交链 (88958244a0)
- 🐞 Fix:余下 ciWorkflows 53→54 对齐现算值 (f56a522031)
- 🐞 Fix:ciWorkflows 53→54 对齐现算值(cross-end-sync 工作流落地后) (e0124cd427)
- 📚 Docs:记录 Taro 侧四条平台硬限制(onLayout/RootPortal/定高/line-clamp) (2e99f52b07)
- 🚀 Feature/Improvement:补齐五类原语能力缺口(ScrollView 高度边界/Modal Portal/onLayout/threshold 换算/numberOfLines≥2) (abe20accdb)
- 🐞 Fix:OSS 签名 Content-Type 大小写不敏感(修 0.0.18 快腿 SignatureDoesNotMatch) (b6617e4d20)
- 🐞 Fix:补 zh-TW 的 menu.autoInstallPermission 并按合并后源重算离线包 —— 门 2f 点名本票 overlay 重放只写进四语，§19 五语同批补齐;生成件由 gen-i18n-compressed 重算而非手改(4 枚 CDN b64 载荷本轮逐字节未变，不入清单) (cbae427abd)
- 🔧 Chore/Other:代码检索两腿行为补锁——读不到目录或文件必须显式 unjudged、同步段必须经线程池 (48e81a85d6)
- 🐞 Fix:永久保活接管前先当场探测客户端,把"顶掉机主正在用的号"翻成默认让位 (fe0ab4cbe3)
- 🐞 Fix:离线包按现读尖 bca76e72 重生成(消 B2 缺 categoryDetail.recommended 与 G5 钉值不等) (8875e2b728)
- 📚 Docs:刷新生成块数字 testFiles 4247 / trackedFiles 19553(推送门 [173] 要求) (bca76e7275)
- 🐞 Fix:逐页裁决退休 2 页纯壳并加严 S2 可摘判据 (080d16775f)
- 🐞 Fix:合并残留的 createOrder 改回 createVipOrder,并补 text() 替身(BUG-13) (0b4351eee6)
- 🔧 Chore/Other:同步桶入口替身与受影响的三个套件 (165213038e)
- 🚀 Feature/Improvement:补齐剩余 RN 薄壳导入与 301 三屏映射(未判定 3→0) (a744c37ec7)
- 🐞 Fix:4 份测试替身对齐 BUG-13/字体缩放取档(消 rn-tests 13 例恒红) (fc6784fd1c)
- 📚 Docs:补 4 条删除意图通知书 —— 两枚 src-tauri mod 与两枚死图标 svg 均由主干自身提交(d050d90d10/bce2df19d4)整文件删除，mod 声明两侧实算 0 命中(lib.rs 作阳性对照) (40d1e01772)
- 🐞 Fix:budget-note 判据对齐 formatTokenCount 一位小数口径(85.3K,消 rn-tests 恒红) (1d9ffcb447)
- 🐞 Fix:主进程探测三态化(量不到 != 没进程) + 超时带出 signal (bdc5eff9ed)
- 🐞 Fix:插件读失败只认一份缺失名单 (8c0c0b88f3)
- 🐞 Fix:测试 mock 的 text() 与 json() 同源(BUG-13 2xx 走 text 后 19 例转绿) (ba90dfce18)
- 🐞 Fix:主进程探测三态化(量不到 != 没进程) + 超时带出 signal (f27ffc8809)
- 🔧 Chore/Other:G-815989 公开清单钉子改钉单一真相源(消 rn-tests 红) (f681776468)
- 📚 Docs:README 生成块与现算面数字刷新(消 DN2 红) (f57a72c81e)
- 🐞 Fix:qoder:import 降级通道接上 pool-owner 默认归属,不再恒落运营池 (7ae99e02dc)
- 📚 Docs:README 现算面 API 路由 4702→4703 对齐(消 DN2 红) (7a03f720f6)
- 🐞 Fix:S 族编号判据补族 + S-26 同号归并;消除 ESM 图 TLA 令两把尺恢复同步加载(§22c 16 红→25 绿) (ed4a870092)
- 🐞 Fix:插件目录和完整性门体读不到时不再当成没有 (173a79ac95)
- 🐞 Fix:全量收口 RN 百分比限高面板到高度单一真相源(15 处/12 屏) (ff5f6ac52f)
- 📚 Docs:生成块 trackedFiles 对齐 HEAD 实测 19545(.tmp 未跟踪文件不计入) (20d8c82fdd)
- 📚 Docs:merge 后同步关键数字与生成块(622->624 表, 4699->4703 路由, 4078/4099->4243 测试文件, 333->336 守门) (dee7c77466)
- 🐞 Fix:修复 public-paths 溯源水印载荷损坏(消门47p红) (d79ffb249c)
- 🐞 Fix:pkg-ai/ai/chat 按 S1 撤销退休重新在册(消门299红) (1455683633)
- 🐞 Fix:admin 批量导入把归属落点回显出来,不再静默交运营池 (845ba68a36)
- 📚 Docs:Y-24 结清摘行 — c59c7052e5 键源稳定身份+同批迁库 / 637aa1d8 validate CLI 换 resolveImportAccountUidProbe 与镜像 22+196 例 / 628fba02b7 同 uid 双行根因封口; --check clean 24/24 dupGroups=0, Z68 探针 0 重复组, 61/61+27/27 绿 (dc41e4afa1)
- 🐞 Fix:壳声明不再遮蔽可解析的 @ihui/rn-app 深路径，tsc 101 归零 (e4951cabd2)
- 🐞 Fix:VipScreen 下单改用后端契约 createVipOrder(消 typecheck 红) (c474857607)
- 🐞 Fix:安装包只有路径不能当成内容已核验 (d624bd5852)
- 🔧 Chore/Other:同步 README 生成块现算数字(门173 归零) (2681ff4d52)
- 🔧 Chore/Other:重生成 ui-routes 与 README 现算数字(门105/173 归零) (60a958977f)
- 🔧 Chore/Other:同步 README 现算数字与小程序离线语言包(门173/105 归零) (31f9323852)
- 🐞 Fix:BUG-67 提问卡迁入共享屏 overlaySlot,chat 页恢复真薄壳(门299 归零) (f0325cf3a7)
- 🔧 Chore/Other:收编守护落档产出(1 件,凭落点账本) (1a18e2d274)
- 🚀 Feature/Improvement:APK 快腿接入发版链(OSS 签名直链/证书自动续签/--download-url 登记) (41a9fad663)
- 🐞 Fix:代码检索读不到目录或文件时标明不完整 (470e7dea5a)
- 🔧 Chore/Other:land Z58 bridge: apps/ai-service/app/services/checkin_user_pool_bridge.py, apps/ai-service/tests/test_checkin_user_pool_bridge_owner_subject.py, apps/ai-service/tests/test_checkin_user_pool_bridge_internal_ticket.py (06c4bb2583)
- 🔧 Chore/Other:land Z66 relay-pool artifacts: apps/api/scripts/relay-account-import-validate.ts, apps/api/scripts/relay-pool-uid-keysource-audit.ts, apps/api/tests/relay-pool-validate-cli-uid-keysource.test.ts, apps/api/tests/relay-pool-uid-keysource-audit.test.ts (637aa1d817)
- 🐞 Fix:本机会话自动入池改按 pool-owner 落个人池,同 uid 双行根因封口 (628fba02b7)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (d911713aba)
- 🐞 Fix:全量收口 RN 弹层高度 bug、门131/273 交互缺陷与样式文档漂移(14 文件) (97f70b4b84)
- 🐞 Fix:alignSharedIndex 让路/耗尽两档桶形态 0→[] 坐实并钉住(Z69R) (533b67bfde)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (652ce1d097)
- 📚 Docs:落地取证册§16(第十一回合死席收编与机主面分家定稿,6处短sha补全40位)+RELEASE.md鸿蒙行改五格现读事实(Z67残余3) (ba2af37965)
- 🐞 Fix:读不到的文件不再当成没有再覆盖、删除或改用下一份 (faf9aa9ced)
- 🐞 Fix:根治 BUG-65/79 共享契约字段错位 + 补齐 miniapp 导出声明 + 清理明文 DSN 兜底注释 (52505f20c3)
- 🐞 Fix:简介数字对齐现算口径并移除两枚死图标 (bce2df19d4)
- 🐞 Fix:OTA 腿必须回读新组才算落地 + hook 顺序回归锁 (ede655949e)
- 🐞 Fix:AutoInstallGuide 的 hook 必须早退前声明 (f070fddf2f)
- 🐞 Fix:公网终检 -NoProxy + 重试,清理失败不再污染退出码 (d86d4c7d3f)
- 🔧 Chore/Other:versionName 优先 -P,显示版本与原生基座解耦 (fc592e25e1)
- 🔧 Chore/Other:origin/main 35c870f8705b115086a63aadefe2ecb8e5370558 + mobile overlay b77573788d5d2b31f8d2b09ae2e212c953131f9f (d76367ae48)

**2026-11-05**
- 📚 Docs:记录 node_modules 空洞导致 eslint 加载失败的根因与恢复口径 (384c883107)

**2026-11-04**
- 🐞 Fix:派生进度始终落地,门禁红只拦合并不拦推进 (252ef71a05)
- 🚀 Feature/Improvement:跨端级联全自动流水线 web→RN→小程序 (机主令 2026-11-04) (06f85e2a91)

**2026-11-04**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (08d41693f6)

**2026-11-04**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (0cdb9c5adc)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (cd5826f592)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (3bd970724d)
- 🐞 Fix:恢复下载详情页被误删的三个展示组件,修复主干编译中断 (60e311a376)
- 🐞 Fix:门291 C组32条挂账清零,RN改取web真源键并摘除旧键 (09aab027db)
- 🐞 Fix:门 285 证据定位改为按符号名解析，消除加注释即报证据行漂移的误红 (55cfe0055f)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (e8587b8d24)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (3f53cd4128)
- 🐞 Fix:分片腿加首片看门狗,任何失败都退回原生单流 (8dbc29d49e)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (59190b65a4)
- 🐞 Fix:B 组收尾补漏（showClear 两端删除、mini robotImage 真渲染） (1b02399947)
- 🐞 Fix:平台裁决清零(46→0),A组18条真实现/删除,门128两红收口;补 pnpm-lock 记账(解门101 存量红) (e281cc9b3e)
- 🐞 Fix:整包下载改 8 连接分片 + 诚实的速率读数 (e4c0b285e7)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (9ba7780301)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (ad0af8b999)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (79fc8f2339)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (e89b032d64)
- 🐞 Fix:c-drive 默认即扫暂存区，无输入面不再空转报绿 (3bed6719e3)
- 📚 Docs:门45 注释同步空暂存区=0 不适用 (e27c873fec)
- 🐞 Fix:c-drive 空暂存区按 A 级 check-file-size 口径 = 0 不适用（更正） (e62a4f5e2f)
- ♻️ Refactor:屏级默认档等值落具名档·carte/edu-parent 10 处 (0b23dbfbab)
- 🐞 Fix:B 级 6 门三态化，取不到输入即 exit 2 (ebee2d6fa5)
- 🚀 Feature/Improvement:跨端写盘腿 tick 落 downgrade/undetermined 两态并接告警面 (8c61f56034)
- 🐞 Fix:登录页 welcome SVG 按 </svg> 截断,消除裸文本子节点触发的 Text 组件告警 (493d714c83)
- 🚀 Feature/Improvement:新增真机热更预览通道 rn-live-preview(8809, 自检12/12) (2faca4b6fe)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (af754200b8)
- 🐞 Fix:BottomActionBar 来源面板空声明回退 (731af09c90)
- 🐞 Fix:LoginPopUp/BackChevron 必选性对齐 (947b908505)
- 🐞 Fix:ModelConfigDialog 死变体删除 (767c0b9c0c)
- 🐞 Fix:InputArea/ModelList 死腿删除 (0b8992e620)
- 🐞 Fix:BottomActionBar 手工压缩入口接线与死腿删除 (ca5429d33a)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (61f270bf6e)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (0d87de6175)
- 🐞 Fix:NavBar/VideoPlayer 证据换真 (518a6776d0)
- 🐞 Fix:VoiceInput 图片死腿删除 (458a4ebf67)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (4c371d6d51)
- 🐞 Fix:UserInfoCard onOpenVip 真实现与死字段删除 (0c51f35b2f)
- 🐞 Fix:LoginPopUp 协议真实现与同槽收敛 (912d931bf7)
- 🐞 Fix:capability-catalog 门取不到暂存面时改判 exit 2 未判定 (60b472eaa1)
- 🔧 Chore/Other:dedupe 夹具超时放宽到 600s(规避 pnpm 并发持有夹具) (794f8b02b0)
- 🐞 Fix:底部淡出遮罩渐变段 120→90 —— 机主复看仍点名「顶部有点高」 (cf11ee7293)
- 🐞 Fix:根治「签名不一致」—— debug 签名不再静默可得,装机前强制证书对账 (0c3dd5bed7)
- 🐞 Fix:底部淡出遮罩渐变段 160→120 —— 机主点名「还是高」,同步「我的」页让位量 104→72 (bdab328668)
- 🐞 Fix:overlay-zindex 门扫描面为空/文件读不到时改判 exit 2 (dfbf262512)
- 🐞 Fix:基线落账补记等价映射条数,棘轮字段不再随重落丢失 (f3fc367307)
- 🐞 Fix:event-closure-leak 门取材失败/文件缺失时改判 exit 2 (08298485b8)
- 🔧 Chore/Other:门285 基线重落(存量存差 177→0,judged 166,裁决不适用 2 对) (c44caaf496)
- 🐞 Fix:VoiceInput 3 键逐键裁决登记(RN 预留未接线腿) (47a3762e07)
- 🐞 Fix:VideoPlayer 3 键逐键裁决登记(原生 Video vs 注入组件/页面标题) (2b39134193)
- 🐞 Fix:NavBar 23 键逐键裁决登记(固定槽位 vs RN 泛型动作数组) (94ae780bd9)
- 🐞 Fix:file-size 门取材失败/读不到文件时改判 exit 2 (2dc1efb330)
- 🐞 Fix:ModelList 5 键逐键裁决登记(分组 groups vs 平铺 models+currentType) (9593eb00fe)
- 🐞 Fix:ModelConfigDialog 23 键逐键裁决登记(indexa 媒体链路未接/选型拆到 ModelList) (a773fae04c)
- 🐞 Fix:LoginPopUp 20 键逐键裁决登记(登录三回调 vs RN 受控弹窗+扁平资料) (b5ea3cfbf4)
- 🐞 Fix:IntelligentAssistant robotImage 归矢量字形媒介裁决 (8234539080)
- 🐞 Fix:BackChevron 2 键逐键裁决登记(label 端内 i18n 兜底/color 走 token) (1d228a2a68)
- 🐞 Fix:dedupe 门取不到 staged 面/锁文件时改判 exit 2 (9731f496ba)
- 🐞 Fix:BottomActionBar 44 键逐键裁决登记(开关聚合/图标卡入参与 RN 受控腿) (01196483c8)
- 🐞 Fix:InputArea 31 键逐键裁决登记(折叠/模型/语音腿归平台载体) (07c6dfb7c6)
- 🐞 Fix:Carousel banner↔items 映射登记(3 键转裁决) (172a007e10)
- 🐞 Fix:UserInfoCard 扁平字段真接线 + 报销空 prop 半成品(6 键转裁决) (4a66989645)
- 🐞 Fix:commit-scope 门取不到输入时改判 exit 2 未判定 (b54ee9a4a9)
- 🐞 Fix:push-sync 四类折绿分支收口 —— 窗口只降文案不降退出码,祖先/HEAD/清单读数失败一律 exit 2 (344c5dd91c)
- 🐞 Fix:底部淡出遮罩延伸到屏幕底 —— 胶囊下方那段悬浮间距此前无人覆盖 (cbce78a947)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (344909256f)
- 🐞 Fix:首页 AI 输入框不再被底部淡出遮罩压住 —— 补小程序已有的那一层 (ba3cec2095)
- 🐞 Fix:校正 push-sync 注释的 rev-list 失败实测读数(本机 bad object exit 1,非 128) (714fda7cf5)
- 🔧 Chore/Other:收编守护落档产出(5 件,凭落点账本) (b255c8ac82)
- 🐞 Fix:push-sync 读数改三态 —— rev-list 失败/取不到对象不再折算成 ahead=0 假绿,5 例钉三态 (9c0824df44)
- 🐞 Fix:两处 git 派生补 windowsHide —— 门52 生产面两处判红清零,消除控制台闪窗;staged 面 3 文件 0 违规 (5321db0ce9)
- 🐞 Fix:git 派生调用显式接管 stdio —— 门193 三处判红清零(两枚测试文件),解除 pre-push 阻塞;两测试 14/14 通过 (b135c1b1df)
- 🐞 Fix:写盘闸 HEAD 三态 —— git 取不到不再折成「新增文件」放行 (12d92ce084)

**2026-11-03**
- 🔧 Chore/Other:285 judged 自检改临时夹具 —— 不再钉死真仓行号 (d472bb39bc)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (af3c51866d)
- 📚 Docs:285/289/290/291/292 语义与三条纪律入档 + 逃生变量并入 §6.3 (3ca2913348)
- 🚀 Feature/Improvement:门285 引入逐键 judged 桶 —— 存差=未实现+未映射+未裁决 (aaac585bd5)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (a810aefb23)
- 🐞 Fix:门290 判据纠偏 + A3 可挂账 + 修真缺陷 (d255a623ba)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (a076d3bb7a)
- 🔧 Chore/Other:账本收敛为 C 组挂账与 A/B/E 裁决,统一 3 处可改调用点并登记 LearnScreen 4 处 web 无键文案 (5c1de64915)
- 🐞 Fix:证书基准拆为官网/Play 上传/Play 应用签名三值并互不校验 (9b5b3233f5)
- 🔧 Chore/Other:登记 9 对跨端 props 提案(等价 21 + 平台 141 + FloatBox 整对不适用) (3d8e89c074)
- 🐞 Fix:新增 B3 同义键异值判据、common.* 白名单/同字不同义裁决与唯一键去重 (3834b737e4)
- 🐞 Fix:门291 P0 将 10 处 RN 硬编码文案改为 web 同源键并补齐 5 语言词包 (67e082814f)
- 🔧 Chore/Other:登记 9 对跨端 props 提案(等价 21 + 平台 141 + FloatBox 整对不适用) (1df5542521)
- 🐞 Fix:LoginPopUp 24→20 键 —— RN 补 visible 可选、userInfo 适配、defaultAvatar、onNicknameChange (6480532d13)
- 🐞 Fix:NavBar 25→23 键 —— 小程序补 subtitle/sticky 真实现，menuIcon 接渲染分支 (7772e22277)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (c1b9d5ac1f)
- 🐞 Fix:BottomActionBar 59→56 键 —— RN 真接 placeholder/disabled,小程序真接 isLoading (fcc34bccf8)
- 🐞 Fix:VideoPlayer 补齐 autoplay/poster/loading/onPlay/onPause/startPosition (9816826db5)
- 🐞 Fix:ModelList 两端补齐选择/加载/动效/样式契约 (20e1c01630)
- 🐞 Fix:ModelConfigDialog 对齐必填漂移 visible/config/onChange/modelType (e87ea6fa69)
- 🐞 Fix:InputArea 补齐 RN 输入契约 autoFocus/onFocus/onBlur/onKeyboardHeightChange (6e2dd73d77)
- 🔧 Chore/Other:摘除 ColorfulLoader 死副本并重算 ui-routes inputs —— 全仓静态/动态引用为 0,删除后经生成器重算(inputs 611→610、自述钉自洽);门105 保持绿、门285 258 键不变 (d695719bb0)
- 📚 Docs:派生块按生成器重算 —— 守门/跟踪文件读数对齐现算,最近更新补齐 48540f6..HEAD (40e31c3b92)
- 🔧 Chore/Other:ui-routes 派生件按 HEAD 面重生成(model-edit/apis 两枚输入补钉) (8b2af27a78)
- 🐞 Fix:小程序 model-edit 接上 RN 同一份只读清单,并补派生进程 windowsHide (0f46e9a019)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (43a0ab0c05)
- 🚀 Feature/Improvement:词包搬运器补键级射程(整块之外的单键缺口此前无人判) (03d72eac3c)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (4096426428)
- 🔧 Chore/Other:收编守护落档产出(5 件,凭落点账本) (a3cd0e3375)
- 🐞 Fix:门285 将 ScreenStates 判为 not-applicable —— 文件级四组件族容器,非单组件对 (71a4f299c2)

**2026-11-04**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (a8f8227ad9)

**2026-11-04**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (dde2283d8c)
- 🐞 Fix:恢复下载详情页被误删的三个展示组件,修复主干编译中断 (a7fc6138d3)
- 🐞 Fix:门291 C组32条挂账清零,RN改取web真源键并摘除旧键 (0605ec255d)
- 🐞 Fix:门 288 证据定位改为按符号名解析，消除加注释即报证据行漂移的误红 (842c0f0b9a)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (4fd158208d)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (61d4502095)
- 🐞 Fix:分片腿加首片看门狗,任何失败都退回原生单流 (61bf95afe2)

**2026-11-04**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (decbaf9b4c)
- 🐞 Fix:B 组收尾补漏（showClear 两端删除、mini robotImage 真渲染） (dcd22d3ccc)
- 🐞 Fix:平台裁决清零(46→0),A组18条真实现/删除,门128两红收口;补 pnpm-lock 记账(解门101 存量红) (2cf8856fd1)
- 🐞 Fix:整包下载改 8 连接分片 + 诚实的速率读数 (7242b9cc3d)

**2026-11-04**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (6dcc3be9c8)

**2026-11-04**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (8e04ad552e)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (4cde28b4d4)

**2026-11-04**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (dcd5d46c43)
- 🐞 Fix:c-drive 默认即扫暂存区，无输入面不再空转报绿 (ce21ce2967)
- 📚 Docs:门45 注释同步空暂存区=0 不适用 (d03d3421ab)
- 🐞 Fix:c-drive 空暂存区按 A 级 check-file-size 口径 = 0 不适用（更正） (15ab31909f)
- ♻️ Refactor:屏级默认档等值落具名档·carte/edu-parent 10 处 (31b1682c69)
- 🐞 Fix:B 级 6 门三态化，取不到输入即 exit 2 (12c11a928f)
- 🚀 Feature/Improvement:跨端写盘腿 tick 落 downgrade/undetermined 两态并接告警面 (682441757b)
- 🐞 Fix:登录页 welcome SVG 按 </svg> 截断,消除裸文本子节点触发的 Text 组件告警 (2892132dbf)
- 🚀 Feature/Improvement:新增真机热更预览通道 rn-live-preview(8809, 自检12/12) (80a4925cb6)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (cd055b78af)
- 🐞 Fix:BottomActionBar 来源面板空声明回退 (cf4c76ff1e)
- 🐞 Fix:LoginPopUp/BackChevron 必选性对齐 (f11df86f5f)
- 🐞 Fix:ModelConfigDialog 死变体删除 (923044485c)
- 🐞 Fix:InputArea/ModelList 死腿删除 (804ee7142a)
- 🐞 Fix:BottomActionBar 手工压缩入口接线与死腿删除 (a7e4a73d7a)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (cbe4ddd32c)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (5ffc1c5120)
- 🐞 Fix:NavBar/VideoPlayer 证据换真 (2ef7755dc4)
- 🐞 Fix:VoiceInput 图片死腿删除 (633b4a018a)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (9795a8effe)
- 🐞 Fix:UserInfoCard onOpenVip 真实现与死字段删除 (67afef48b0)
- 🐞 Fix:LoginPopUp 协议真实现与同槽收敛 (db8e6679cb)
- 🐞 Fix:capability-catalog 门取不到暂存面时改判 exit 2 未判定 (d551e17bc3)
- 🔧 Chore/Other:dedupe 夹具超时放宽到 600s(规避 pnpm 并发持有夹具) (552b8cfc5d)
- 🐞 Fix:底部淡出遮罩渐变段 120→90 —— 机主复看仍点名「顶部有点高」 (f989956df1)
- 🐞 Fix:根治「签名不一致」—— debug 签名不再静默可得,装机前强制证书对账 (45506184a7)
- 🐞 Fix:底部淡出遮罩渐变段 160→120 —— 机主点名「还是高」,同步「我的」页让位量 104→72 (2c32f411d7)
- 🐞 Fix:overlay-zindex 门扫描面为空/文件读不到时改判 exit 2 (c26b9a983a)
- 🐞 Fix:基线落账补记等价映射条数,棘轮字段不再随重落丢失 (beb3a3e6e9)
- 🐞 Fix:event-closure-leak 门取材失败/文件缺失时改判 exit 2 (31cede2149)
- 🔧 Chore/Other:门288 基线重落(存量存差 177→0,judged 166,裁决不适用 2 对) (f92c386395)
- 🐞 Fix:VoiceInput 3 键逐键裁决登记(RN 预留未接线腿) (5538025fff)
- 🐞 Fix:VideoPlayer 3 键逐键裁决登记(原生 Video vs 注入组件/页面标题) (a728994def)
- 🐞 Fix:NavBar 23 键逐键裁决登记(固定槽位 vs RN 泛型动作数组) (d7d23a6822)
- 🐞 Fix:file-size 门取材失败/读不到文件时改判 exit 2 (361b4678f8)
- 🐞 Fix:ModelList 5 键逐键裁决登记(分组 groups vs 平铺 models+currentType) (362de27391)
- 🐞 Fix:ModelConfigDialog 23 键逐键裁决登记(indexa 媒体链路未接/选型拆到 ModelList) (45fe8f9a40)
- 🐞 Fix:LoginPopUp 20 键逐键裁决登记(登录三回调 vs RN 受控弹窗+扁平资料) (91d15877ab)
- 🐞 Fix:IntelligentAssistant robotImage 归矢量字形媒介裁决 (3280b88e47)
- 🐞 Fix:BackChevron 2 键逐键裁决登记(label 端内 i18n 兜底/color 走 token) (c4154d3c81)
- 🐞 Fix:dedupe 门取不到 staged 面/锁文件时改判 exit 2 (137263b6ac)
- 🐞 Fix:BottomActionBar 44 键逐键裁决登记(开关聚合/图标卡入参与 RN 受控腿) (0fe3ce7009)
- 🐞 Fix:InputArea 31 键逐键裁决登记(折叠/模型/语音腿归平台载体) (dfd42f5393)
- 🐞 Fix:Carousel banner↔items 映射登记(3 键转裁决) (d7ab5acac8)
- 🐞 Fix:UserInfoCard 扁平字段真接线 + 报销空 prop 半成品(6 键转裁决) (784d8dfdbb)
- 🐞 Fix:commit-scope 门取不到输入时改判 exit 2 未判定 (9ffeb094b2)
- 🐞 Fix:push-sync 四类折绿分支收口 —— 窗口只降文案不降退出码,祖先/HEAD/清单读数失败一律 exit 2 (e0f8c0e451)
- 🐞 Fix:底部淡出遮罩延伸到屏幕底 —— 胶囊下方那段悬浮间距此前无人覆盖 (3c2e132bf5)

**2026-11-04**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (43f56aa425)
- 🐞 Fix:首页 AI 输入框不再被底部淡出遮罩压住 —— 补小程序已有的那一层 (12b69b48aa)
- 🐞 Fix:校正 push-sync 注释的 rev-list 失败实测读数(本机 bad object exit 1,非 128) (15915596b8)
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
