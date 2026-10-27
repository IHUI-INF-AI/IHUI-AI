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

Headline claims (same source as the table below, all live-computed): **608 tables · 4564 API routes ·
25 WebSocket endpoints · 99 catalogued LLMs · 38 platforms auto-publishing · 3362 test files ·
286 engineering gates · 49 CI workflows · 5-language i18n parity · 9 app packages · 16 shared packages ·
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
| 测试文件 | 3374 | `testFiles` |
| CI 工作流 | 49 | `ciWorkflows` |
| Compose 服务 | 14 | `composeServices` |
| 工程守门 | 289 | `guardianGates` |
| — blocking | 263 | `guardianBlocking` |
| — warn | 28 | `guardianWarn` |
| 跟踪文件 | 16733 | `trackedFiles` |

上表由 `node scripts/gen-doc-numbers.mjs --markdown` 生成,最后核对日期 2026-10-27。
每个数的来源就写在取数键旁边的实现里(`scripts/gen-doc-numbers.mjs` 的 `SOURCES`),**不得手抄、不得另立第二份**。

<!-- END GENERATED NUMBERS -->


## Recent updates (auto-maintained)

<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->
**2026-10-27**
- 🚀 Feature/Improvement:账号级代理前后端闭环入库,管理入口与文案由「私有出口」改名「账号代理」 (2d779c49ce)
- 🚀 Feature/Improvement:号池一键网页重登(Trae 先行)+ 重登不毁自续票 (0471fd3d9a)
- 📚 Docs:号池对标⑦会话搬家侦察定案一行 —— 先取证,不施工 (b27b6474ab)
- 🐞 Fix:补注册门 254 check-ruff-python —— 清偿 8a48e5411f 半笔落地欠账 (911fb16f9c)
- 🔧 Chore/Other:结清 ruff 接提交链票(L28763 未取号行)—— 票面三条判据当场复跑:①前置存量归零=ruff 全量档 0 violations(1492 个 .py,HEAD/索引/磁盘三档各实跑一次);②注册条目成套=id 254 blocking+skipEnv HUSKY_SKIP_RUFF+射程 apps/ai-service/(门 89 已接线数 321→322、门 253 新增缺 0);③摘掉即翻红形状锁=check-ruff-gate-wiring T2 对缺 skipEnv/缺射程/换 id/降 warn 四维逐条咬住,镜像 11 例 + 自检 11 例全过 (3e71a669a5)
- 🐞 Fix:门 39 清偿 —— ScanLoginScreen.tsx 按 B 通道登记 RN 独占白名单(expo-camera 相机/条码扫描硬件依赖,共享层无同名屏,票务判据已共用 shared parseQrLoginTicket;与 VoiceSttScreen 先例同构)。证据:门 rc 1→0(312 枚无未迁移、白名单零腐烂),镜像测试全过 (ce64684498)
- 🚀 Feature/Improvement:152 道存量门射程声明一次清偿 —— 门 253 棘轮存量归零 (91a47401d5)
- 🚀 Feature/Improvement:ruff 守门接进提交链(id 254,blocking)+ AGENTS R4 点名同批 —— 前半件脚本入库后接线与点名必须同批(§0.9 造好没装车=没有;门 89 R4 已接线不点名即红)。AGENTS.md 走 LAND_BLOBS 而非工作树:该文件此刻是他人门 207 体积清偿的在飞脏面,交工作树字节等于替他们落地,正解=HEAD 版⊕本票一行。落地后接线锁 check-ruff-gate-wiring 的 T1 由红转绿(它读 HEAD 面 runner,落地前红是设计内阳性对照) (8a48e5411f)
- 🚀 Feature/Improvement:workbuddy 号池⑥余额点查 getQuota(实弹闭环) (2ab083b8d3)
- 🚀 Feature/Improvement:ruff 守门脚本入库(未接线,接线与文档点名同批待落)——把 Python lint 从只挂 CI 接进提交链的前半件:三档判定面(HEAD/索引/磁盘,外部工具只能看磁盘故先物化到 scratch)照 check-mypy 同口径,ruff 版本 pin 从 apps/ai-service/pyproject.toml 解析(§0.6,不硬编码),uvx 缺失/pin 解析失败/面取不到一律 exit 2 未判定且优先于红。证据:--worktree/--staged/全量档三档实跑 0 violations(1492 个 .py)、--self-test 11 例全过、镜像测试 11/11、接线锁 check-ruff-gate-wiring 反向对照 4 维逐条翻假 (9ce6ffcf6c)
- 🔧 Chore/Other:gb17-e2 结清 lint-staged 盯针票(门252 已装车,翻勾+证据) (ab17635a2e)
- 🔧 Chore/Other:gb17-e1 完成即删(翻勾行移除,不留档) (c266040802)
- 📚 Docs:L6065 现状升级落账 —— 生产源站 522 三连/ssh 隧道 bad handshake/三通道同断,原解阻判据不可执行,修复属机主带外(p7 席外网实测) (0362b423f7)
- 🔧 Chore/Other:gb17-e1 结清 git-guardian 指针形态票(翻勾+摘牌+证据) (fb2ba69985)
- 📚 Docs:G-116 结清(代码镜像载体已删,等机主删 ref/GC 的前提随之失效) + USDT 事实纠偏(地址已非空) + 三枚自进化票复核注记(结清注记不成立,保持未勾) (74aa4f9dcf)
- 📚 Docs:AGENTS.md 补 R4 漏点名补记 ⑤ —— 门 253 点名(接线对账 R4 清偿) (dfb48c1dcd)
- 🐞 Fix:G-70 备份脚本 pg_dump 解析优先级 —— ProgramFiles 优先于旧机落点(换机后残留旧客户端会顶掉 18.6,报错形态与口令错同形,误导排障方向),全落空改 exit 2 显式未判定;影子副本已同步等值 (e478e9885e)
- 🚀 Feature/Improvement:plan-fields-extract 补孤儿键退场档并接 CLI —— 侧车记录终于有"只退不抽"的合法出口 (1ce6414900)
- 🚀 Feature/Improvement:G-395 请求档与实得档留痕 + 出处标签 —— 新增 EffortResolution(四层 source、requested/effective 两档、matched),formatConfigSnapshot 单点渲染;十一例测试移入 tests 面由 runner 实收集(原放 src 下不会被跑,不接线等于没验) (87b306dec1)
- 🔧 Chore/Other:lint-staged stdio 补丁器补自证 4 例 + 盯针门镜像对齐 —— 三针补丁此前只有生产脚本、无回归网 (6821396b31)
- 🚀 Feature/Improvement:门 253 本体入库 + 镜像测试 + 落地通道盲绿修复 (85a41c1276)
- 🐞 Fix:check-ps1-bom 补回 windowsHide 三处——本侧重写把对侧提交「给新装车的门 251 与其修复器补 3 处 windowsHide」的两处改动覆盖掉了(门 52 全量档会判),按原意在全部三个派生 git 调用点补齐:git() / selfTest.run() / selfTest.runNoPs(),末者为本侧重写新增的夹具。证据:产物 --self-test 11 例全 PASS(判据六 + 端到端五),node --check 通过,常规档扫描 77 带BOM 77 存量缺 0 (e87d13d918)
- 🔧 Chore/Other:门 30 validate-i18n-integrity 修法席收口 —— D1 三态哨兵与 D2 定根在镜像里钉死,9/9 (42aff94ccf)
- 📚 Docs:gb17-chair 结清 5 枚(G-29 回潮再结/门134后续批/同一契约两份声明/G-41/两类残行)+ 金丝雀注记纠偏(灰度分流实测零命中,保持未勾) (b3c71c1f0a)
- 🐞 Fix:门 31 check-ps1-bom 修法席收口 —— 三处判据缺陷已修,镜像 13/13 (76383db3e0)
- 🚀 Feature/Improvement:新守门 check-gate-triggers.mjs 接进提交链(射程声明完备性,id 253) (c8455ef160)
- 🚀 Feature/Improvement:lint-staged stdio 三针盯针门挂进守门批(id 252,warn) (34425c621d)
- 🐞 Fix:deferred 队列终态文案与代码行为对齐——撤回队列项走 message-input.tsx 的 onUndo:先 recordQueueSendOutcome(...,'deferred') 再 removeQueued,消息实际已出队;旧文案「仍保留在队列中」把用户引向等待一次不会发生的重发,五语言同批改为「已从队列移除,请重新发送」。证据:门30 validate-i18n-integrity 通过(5 文件)、check-i18n-keys 19278 键 5 语 parity OK、scan-i18n-zh-residue zh-TW/ko/ja 均无中文残留、五语 leaf 均为 string 且无同名自套 (db904288fb)
- 🐞 Fix:号池页代理显隐按钮圆角归 control 档 —— 门 150 单族判红(account-pool/page.tsx:1579 裸 rounded-md=6px,应为 sm=4px) (3179d3e2ad)
- 🐞 Fix:dispatch-board 镜像走 __test__ 出口并纠正一次红测试 —— 枚 102c21f68c8 落地时 ⑰b 因我只做顶层 export 未进 __test__ 而红(实现自证绿、镜像红的半套入库,§10 反面);现 self-test 29/29、镜像 20/20 (072bec49e7)
- 🐞 Fix:dispatch-board 补 scope-placeholder 维 —— 占位符路径(<x>-spec、通配、含空白)以前被当成真作用域,会把席派到一条不存在的文件上并给它发"这块地没人占"的合格证(今晚实测:一席据此领到 packages/shared/src/ui/<x>-spec/) (102c21f68c)
- 🔧 Chore/Other:小程序 ui-routes 自述钉按合并后源面重派(门 105 G5 维) (e2c90724a7)
- 🐞 Fix:zh-TW 字形残留单点修正 + 离线包按新源重派(门 2j-shared blocking 红清偿) (58f4078e52)
- 🐞 Fix:给新装车的门 251 与其修复器补 3 处 windowsHide(门 52 全量档红清偿) (695955befa)
- 🔧 Chore/Other:goal-b17 gb17-e5 认领(加复合租约) (d973b9d7ec)
- 🔧 Chore/Other:goal-b17 gb17-e4 认领(加复合租约) (42ef31b5eb)
- 🔧 Chore/Other:goal-b17 gb17-e3 认领(加复合租约) (21c584b4f8)
- 🔧 Chore/Other:goal-b17 gb17-e2 认领(加复合租约) (5e12de960d)
- 🔧 Chore/Other:goal-b17 gb17-e1 认领(加复合租约) (3c4ba5f0f9)
- 🔧 Chore/Other:违禁桶兜底清扫——HEAD面等条件/待拍板未勾行自动摘除(两道机主禁令的执行器物化,留痕f12-purge;复翻席请同步摘形态,事实内容按各批结清提交保留) (53b18b238d)
- 📚 Docs:重登被误摘的侧车退场档票(改用不撞桶名的等价表述,复合主键语义不变) (71ce65a9da)
- 🐞 Fix:dispatch-board 补 dirty-inflight 那一维 —— 他席未提交的脏面以前只算不压,是"不打架"的另一半;自检 27/27、镜像 19/19(含反向锁:dirtyHit 为空时同票必须能排进来,防这一维变恒拒) (aa357de376)
- 🔧 Chore/Other:违禁桶兜底清扫——HEAD面等条件/待拍板未勾行自动摘除(两道机主禁令的执行器物化,留痕f12-purge;复翻席请同步摘形态,事实内容按各批结清提交保留) (9ea4fac622)
- 🔧 Chore/Other:门 208 具名登记 2 处对外贡献 fork 克隆——消掉 CI 全量档的 blocking 红 (173381c761)
- 🔧 Chore/Other:门 30 validate-i18n-integrity 补三态自证据与 §22c 镜像 —— blocking 门此前无任何自证 (77fd720a81)
- 🐞 Fix:取材一过性失败不再被读成判红(门 84/107/117/243) (a382488082)
- 📚 Docs:守门 251 check-ps1-bom 补进点名索引(门 89 R4 义务) (be6a520abe)
- 🔧 Chore/Other:check-ps1-bom 补 §22c 镜像与 §22d 守卫 —— 一道 blocking 门此前"一 import 就打死宿主" (6dde87dfa3)
- 📚 Docs:门 207 余量告急处置——git 网络与推送族删旧版留现行版(95937→94975 B,余量 63→1025) (9af1033f1b)
- 📚 Docs:AGENTS.md git 网络与推送族旧副本的逐字迁出件(先入库立凭据) (f6e9093843)
- 📚 Docs:G-19 行去尽字面量(两处) + 记入今日扫全读数 —— 该行把令牌前缀写成可重跑命令与 git grep 样本,导致每条 plan-head 快照自繁殖一份外泄面串(今晚实测 619 枚快照即此源);改为"现读 secrets 单存件头 6 字符作 pattern"的取法,并记 630 命中/6 真令牌/621 已清/3 处待机主轮换保留;本行不翻勾,未收格=轮换属机主职权 (e26491797d)
- 🔧 Chore/Other:抽取器注释措辞换掉被禁字面量——消掉一处假阳性的第二把尺子告警 (2594a64ee0)
- 🐞 Fix:adoptMovesOf 的搬支补整族闸——归并不会再把违禁桶搬上活键 (adbe260628)
- 🐞 Fix:销掉一枚已入库迁移的水印欠账(门 47 自愈补盘 ⇒ 提交才销账) (85380ee43a)
- 🐞 Fix:合并面的活文档放大定罪改用单源尺 —— 假 F11 不再焊死全仓推送(真放大照旧拒推) (e5383dfb68)
- 📚 Docs:立两枚可派单真工作票(侧车孤儿键退场档缺失 / ruff 不在提交链) (1382eae649)
- ♻️ Refactor:4 条旧号孤儿键的 waiting/blocking 收敛到活键读数(退场前置) (d1c4029f3e)
- 🔧 Chore/Other:净面复量抓到的 4 条 ruff 真红清零(旁路收编带进 HEAD 的漏网面) (88af2ba859)
- 📚 Docs:两枚票注记已入库格(防下一班重复派单) —— gitdir 票 ③修复面已落 枚 5e11de4b1f5、G-70 票 ③调度面已落 枚 b2fecee0ae(①角色面归对席 8def005420);两行均不翻勾,未收格逐条点名在行内;凭据=主席亲自复跑的镜像 31/31 与 readiness 7/7 末行 (15cc8f947f)
- 🐞 Fix:摘除留痕回捞腿补两档判据——16 枚假阳性不再死锁完成即删 (e03b22c295)
- 🚀 Feature/Improvement:dispatch-board 补派单书档(--brief) —— 今晚三条硬约束从"主席记得"变成"随行印出" (031d555cc0)
- 🐞 Fix:check-ps1-bom 两处裸派生 git 补 stdio(门 193)+ 给 193/251 补 stagedTriggers (532880b398)
- 📚 Docs:补回第⑤刀误删的 README 在库行（纠偏） (65d1ba9730)
- 🚀 Feature/Improvement:「更傻瓜」第⑤刀——号池导入框支持拖拽 .json / 点「选文件」,不必再手抄粘贴 (477c441a57)
- ♻️ Refactor:H01 改判出等条件桶(归:机主微信扫码会话面) (06d42e60b0)
- ♻️ Refactor:H01 出等条件桶——标头按侧车投影改写(归:机主微信扫码会话面) (c73967172a)
- 📚 Docs:lint-staged stdio 三针盯针结清——只读门现读绿(3/3 针)、已挂 git-guardian 巡检(引用 6 处,实现在 lib)、接线锁 8/8 通过;按 §12e 不进提交链 (2d672a55d5)
- 📚 Docs:门 207 体积清偿批二(语义裁决,非字节重放) + 两枚只读器的 npm 别名与 R4 点名同批接入 (b6e4c20c81)
- 🚀 Feature/Improvement:号池入口层「登记面/未装车面」分档——编排器平台注册表(FROM_PROVIDERS,单一登记入口,§0.6):qoder/codearts parse 通过但 --from 运行期明示未判定(exit 2)并点名当下真出路(后台导入/--file),不再用笼统「暂不支持」把「号池认该平台」与「本机提取器未开发」两件事混成一条(§0.3 不猜,§0.8 不指跑不通的路;新平台取证后补登记即接入)。容量归零哨兵复活出口补齐 qoder/codearts(qoder=池内通用巡检换票优先+重授权走导入并预告提取器未装车;codearts=适配器 refresh 优先+无签到引擎不被要求签到)。测试:⑦⑧两镜像锁注册表形状与分档,M5b 扩两平台断言;三套 13+8+12 例全绿,门自检 30 例全绿。后续派单格(交后手,取证类):qoder/codearts 本机会话落点取证→登记适配器;workbuddy/codearts getQuota 上游端点取证;池侧四平台一键重登(桌面停靠浏览器单元向 pool 侧推广);签到任务中心(攒积分)按实证端点逐平台扩展 (bc2f677e6f)
- 🐞 Fix:门 22 的"存量恒红"换成只减不增的差值棘轮(§0.5) + 对齐 GATEKEEPERS 过期四行 (9415fe1937)
- 🐞 Fix:备份链调度面跟上现读形态 —— psql 走探测式、日志从 DevEnv 根派生、调度器自写留痕;readiness 判据钉现行不变量(7/7) (b2fecee0ae)
- 🐞 Fix:清偿 shared zh-TW 简体字残留 (5c771301ad)
- 🐞 Fix:quick-notes 接线用例补 @ihui/rn-app 类型引用,门 39 V1 存量清零 (e7f626e736)
- 🔧 Chore/Other:补票面点名的形状锁「指针形态机上不得出现对 .git 的 mkdirSync」—— 现读零处 + 变异对照点名 writeGitdirPointer + 异形大文件真跑一例(归档后仍落文件不是目录);gb17-v1 隔离沙箱三形态演练(合法指针/25MB 异形文件/目录)rc 全 0,异形那例 61ms 自愈且现场已归档、工作区根零残骸 (2ad6e1b636)
- 🐞 Fix:指针形态 .git 的异形现场不再被守护静默删掉 + lint-staged 三针盯针接进巡检轮 (5e11de4b1f)
- 📚 Docs:L6067 部署机格进展落账——SSH 只读核实今日构建已落地,旧滞留前提过期;bad handshake 属已知 530 窗口不追动 (d8b012625e)
- 🔧 Chore/Other:web ui-routes 自述钉随 HEAD 再钉一次 (d01913072d)
- 🚀 Feature/Improvement:「比他们更傻瓜」第④刀——号池管理页出「体检徽章列」(六态+闲置天数,机主"都要") (7a110c4deb)
- 🐞 Fix:G-19 明文面收口——ssh config 脱明文走 secrets 文件+包装器(ssh 实测通),3 处副本隔离/净身,新发现 cloudflared 构建默认值是第 8 副本源;余轮换归机主面(API token 无 ZT 权限) (01d3a1be13)
- 🔧 Chore/Other:他席 i18n/新增页落地后重派三处派生件 (4f929a5a4f)
- 🐞 Fix:陈旧副本重放不再把活着的会话永久锁死(stale-sibling 放行轮转) (e6f75c3418)
- 🐞 Fix:构建冷却必须比对它自己记录的 head —— 记录坏/HEAD 取不到一律显式未判定,不再默认压住或默认放行 (d9f6e2e2a6)
- 🔧 Chore/Other:部署成本阀墙钟闸 240→480 分钟(三闸配额对齐) (63acf50477)
- 🐞 Fix:账号池容量归零告警按 provider 点名复活出口——trae 凭据死亡时收信人的当场动作是重开 Trae 客户端登录一次,worker trae-session-sync 每 10 分钟自动回灌新会话入池(2026-10-26 跨 profile 兜底扫描落地后这条链在真机才跑得通),不再要求人工记着跑命令或找后台按钮;workbuddy 点名 --from workbuddy 重提取;无定制出口的 provider 不被硬塞别家文案(§0.8 出路必须真跑得通)。镜像 M5b 例 + 门自检查表锁三型(12+30 例全绿) (94b9133cb8)
- 🐞 Fix:ps1-add-bom 的"全仓已清零"不再被打成用法错 —— 出口三态各自有话说 (d07bc892a9)
- 🚀 Feature/Improvement:备份只读角色幂等建制器——SELECT 探测后只补差值,默认 dry-run,apply 单事务并回读自证,口令只报长度不覆盖不打印;判据复用 pg-restore-drill 的口令链单源,落 deploy 之外的 node 侧因 .sql 一次性载体做不到先探测(执行席 g70-backup 交回;主席复跑自检十一例与镜像廿五例全绿,本机无超管身份时按未判定 exit 2 不猜) (8def005420)
- 🚀 Feature/Improvement:排他切席板 dispatch-board + lint-staged 盯针门入库 —— 把主席手三条派单纪律变成器物 (429cf91aac)
- 🔧 Chore/Other:违禁桶兜底清扫——HEAD面等条件/待拍板未勾行自动摘除(两道机主禁令的执行器物化,留痕f12-purge;复翻席请同步摘形态,事实内容按各批结清提交保留) (4146ce30ab)
- 🔧 Chore/Other:ruff 存量 36 枚清零(CI ruff check . 同口径红清偿) (3161e42705)

**2026-10-27**
- 🐞 Fix:Trae 落点候选加跨 profile 兜底扫描——非登录用户 shell 下裸跑 --from trae 即命中本机真会话(2026-10-26 实测首跑栽于沙箱 %APPDATA%,靠手工 IHUI_TRAE_DIR 救回);候选次序=显式覆盖>当前用户>他人 profile,IHUI_TRAE_SCAN_USERS=0 可关;镜像测试 13 例全绿+裸跑 dry-run 打穿为证 (cba1c89415)
- 📚 Docs:README.en 生成块与散文六处数字按现算重钉 —— 门 173 见我改过它,从此对它全判 (0dbf4375a6)
- 📚 Docs:自进化 7 枚由主席逐条现读复核后结清——金丝雀三器物在 HEAD、自治决策/经验提炼/决策链三条腿提交均为 HEAD 祖先、需求发现器三源适配器提交为祖先、反馈闭环器件在 HEAD、E2E 缺口门已接 runner id 250 (ecf125780a)
- 🐞 Fix:冷启动不再把「cookie 还在」的老用户判成匿名 (db0bcde945)
- 📚 Docs:三份外文 README 补「账号保活中心」一节 —— 中文那份已在 HEAD,外文一直缺 (06035647e9)
- 🔧 Chore/Other:显式声明 expo-camera 相机权限 (fbfaa42034)
- 🚀 Feature/Improvement:默认头像域名收敛到 www.aizhs.top(省一次 CF 301) (ed751bd809)
- 📚 Docs:G-11 队列拒因三件结清——b/c 两格在 HEAD 逐条复验(deferred/failed 终态与静态键盘面在位,承载测试 12/12),a 格三个输入无合法生产者按观察类结清不臆造 (fbb8c22cac)
- 📚 Docs:两枚结清——argument-validation 三格逐格复跑(裁决夹具 8/8、演示路径 4/4、hub 前提已腐烂);G-37 三格逐条复验(语言包 JSON + i18n 两门 RC=0、冷却指纹测试 4/4、80 端口已进值守监控与人跑清单附 5 例夹具) (c282980c9f)
- 🚀 Feature/Improvement:补上手机端扫码确认 PC 登录(小程序 + RN) (b5d89fc7ba)
- ♻️ Refactor:保活中心 router 迁 app/routers/ —— 让门8 的那 6 条端点从「未判定」变「在册」 (4d673db992)
- 🐞 Fix:zh-TW 一枚简体残留改繁体——sourceCookie 的平台应为平臺(opencc 判残留导致门 2b 红;该值由枚 f541169ba4 keepalive 批次新增;执行席 g37-locale-json 现读点名,主席一字修正并复跑 JSON 解析与语言判定) (b77a3373ff)
- 🚀 Feature/Improvement:未设置头像统一使用平台 Logo (a078ca2b10)
- 🚀 Feature/Improvement:归属尺只认真实证据——散文标签的持有者须同时过租约/提交史/脏面三条之一才剔出派单面,否则落 stale-owner-label 并在 --dispatchable 默认保留;机主面与活租约一律仍剔,取不到输入落未判定(执行席 owner-scale-r2 交回;主席独立复跑同一命令得 出单 9 与 仍归他人 23=机主面17/侧车5/在飞1,与席位读数一致;三条反向自证齐备) (6129400e9b)
- 🚀 Feature/Improvement:门251 判据本体补上 + 存量 67 枚 .ps1 一次补齐 UTF-8 BOM + R6 判据右边界修正 (c384d583b9)
- 🔧 Chore/Other:web ui-routes 自述钉按当前 HEAD 重钉 (541e325761)
- 🐞 Fix:plan-copy-row-purge ④c 开「陈旧快照」降级档——化石件里的旧 open 不再永久挡陈旧指针 (91ead7dd14)
- 🔧 Chore/Other:三枚假牙改形态锁(续假牙B同型)——api-failure-throw 删 total 硬下限改四字段形态锁、shared-type 的 hits 与 csrf 的 sites 同改,存量维一律可解析断言,取材面非空与真判据全保留,补变异自证(执行席 faketooth-a 交回;主席复跑三档十+十一+十四例全绿) (94709e33b6)
- 🔧 Chore/Other:三枚假牙改形态锁——把门体自己声明只报数的存量维从下限改成可解析断言,取材面非空与真判据全保留,补变异自证(摘形态锁必红/存量归零不红)(执行席 faketooth-b 交回;主席复跑三档十五+十三+十二例全绿) (afe5fd443f)
- 📚 Docs:两枚副本指针行按完成即删处置——二者本身是指针不是任务(承载行均在册),而指针注记存量自 2026-10-14 已定为零基线;翻勾后由 5 分钟节拍的清扫器摘除 (7a139fbe21)
- 🐞 Fix:门71 判据补齐成套——missingFrom 按条目自带名额展开并启用 multiset(复制份标 dupSlot 折成 multiSlot 只点名不回捞),openCount 语义改为窗口内同时开放峰值(避免把 churn 累计量当名额致规模闸误触),加粗族按 marker 出现次数记账;自检 73 升 78、镜像 85 升 95(执行席 g948-complete-r2 交回;主席复跑两档全绿且全量档 RC=0 未新增红) (b3427a4a6a)
- 🐞 Fix:演示路径不再执行工具 + 部署断言锚点跟上新写法——① workspace-ai-service 的 AgentLoopRuntime.run 删掉 await tool.execute({}) 那段模拟执行(轨迹仍成对、状态 completed,自述未执行);② o6 ⑤ 定位器跟上 merge 改为 git -C $Root merge --ff-only 的新形态(语义断言零删改);两枚反向牙均实跑:塞回 execute 即 2 failed、退回 -Entries 全量脏文件即 BLOCKED-WIP 断言红 (357496236a)
- 🔧 Chore/Other:归并后按合并树重派三处派生件 (ac65a7954d)
- 🚀 Feature/Improvement:新守门 check-ps1-bom.mjs 接进提交链 (6e8f4bd2a4)
- 🐞 Fix:工作空间页短内容撑满卡片剩余高度，消除项目区下方大片空白 (aec2acdf90)

**2026-10-26**
- 🔧 Chore/Other:收敛后重派 6 枚派生件(三端 ui-routes + i18n 离线包与清单) (170b1ba6de)
- 🐞 Fix:工作空间页短内容撑满卡片剩余高度，消除项目区下方大片空白 (253418c2de)
- 🐞 Fix:补齐收敛并入的 3 枚缺载荷文件(CI verify 面回潮清偿) (9e0f5aedb0)
- 🐞 Fix:补齐 deploy 三枚缺载荷文件(门 47 全量档/CI 红清偿) (67f3a74541)
- 📚 Docs:守门 207 体积红二次清偿——合并把已清副本 union 回来了(100886→94975 B) (0f85b56149)
- 🐞 Fix:还原被本席上一枚提交覆盖的别席逐字迁出条目(同名归档件撞车) (3be29eb3ec)
- 🚀 Feature/Improvement:海外登录隐藏手机号入口并主推 Google，Google OAuth 出站走白名单代理 (0451b10e78)

**2026-10-26**
- 📚 Docs:12 枚僵尸票批量结清——前提在 HEAD 逐条不成立:桌面 ANR 残行 55 字、G-195 三个入口脚本全在 HEAD、take_loop_v2_handoff 生产面 18 处已装车、O87g 精确挂载图已装车(本轮另补 compositeDelta 报数)、三枚归并副本指向行已归档、G-8 为副本套娃 31 层的一次性快照、G-242 残行且属禁用的等条件形态、G-948 被吞行已回补、G-66 为单点读数加等条件形态、cloudflared 运行副本与入库源逐字节等值 (9be4bfd2bb)

**2026-10-26**
- 🔧 Chore/Other:fix(scripts)+test(deploy): 两批判据补强——① 门 8 组合前缀 compositeDelta 报数(票面第 4 格少判组合必须报名,此前无机器断言;现读少判 877654 条,只报数不判红,兜底档返回 null)② 人跑健康清单补 cdn 80 端口三态(原本只查 8801/8802/8803/8810/8811;取不到记 null 且仅未判定 exit 2),附两枚镜像各含摘掉即翻红用例 (0b0f033dec)
- 🐞 Fix:补齐部署窗口线三枚新文件的溯源水印 (c4da901e2a)
- 📚 Docs:AGENTS.md 重复登记副本清偿批的逐字迁出件(先入库立凭据) (7d5e7474e5)
- 📚 Docs:三枚已结清未翻勾行由主席复验后翻勾——G-706 证据件三枚在 HEAD 且夹具 11/11 通过、G-42 架构策略表相对 HEAD diff 0 行、G-56 索引 D 前缀 0 条;原行内"不翻勾/不动勾"注记经当场复验解除,按完成即删口径处置 (5e5b788612)
- 📚 Docs:§21 补登「账号保活中心」——两条保活线收成一份状态,6 条 /api/keepalive/* 从 in-doc-window 清零 (094dd7f730)
- 📚 Docs:号池 workbuddy-switch 三件套活文档补账——PROJECT_PLAN 加 2026-10-26 本批节(三件判据/成对对照端/验绿末行/端范围平台独占豁免/推送分叉如实登记仅别两席两 ps1 真冲突与这两枚无关);README 号池表 3 处(账号池调度巡检扩为四档含空闲保活、新增号池导入格式自适应、号体检速查 CLI) —— 以权威 HEAD 基面叠加我的新增,自检 HEAD 逐行零丢失(唯一差异=该表行按'一编号一行当前状态'就地改写,旧①②③文本原样保留在新版内),活文档归并走 object-space-land 带行级复活守卫 (49e67301c1)
- 📚 Docs:归档件说明头补改号映射句(G-39⇒G-36 新号形态) (6ffbbff6b9)
- 🔧 Chore/Other:union 合并落地后按合并树重派 8 枚派生件 (66e547dcb7)
- 📚 Docs:G-39→G-36 改号留痕归档件(守门 71 出路②凭据) (62c1800e06)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (892b2349c2)
- 🐞 Fix:部署窗口显式化 —— 部署期间只暂存部署相关告警,成功后留 15 分钟 settle,失败/回滚立即放行 (370d9f26c7)
- 🐞 Fix:聊天流程 taintEgressGate 全端同步 + 两处存量 build 红清偿 (100038acb4)
- 🐞 Fix:全量 pytest 清零——生产两处真修复 + 测试判据去假红 (56ac086fab)

**2026-10-26**
- 🐞 Fix:部署面按「取对侧(已声明+可复核)」导入 origin 的部署窗口线 + 两处归并与两处修红 (c02b88bc63)
- 📚 Docs:G-5 结清——超龄认领牌存量现读归零(代摘器干跑 SWEEP-RESULT state=clean stale=0 held=40 stripped=0 @22:51),且 2026-10-25 机主令已禁止等条件桶 ⇒ 原"等持有人处置"的出路由器物 strip-stale-claim-marks 接手,本行无剩余动作 (ebf8f7d516)
- 🐞 Fix:门41 认「退役远端的残留跟踪引用」为一档(orphan)—— gitee 远端 2026-10-23 摘配后 packed-refs 里 4 条 refs/remotes/gitee/* 掉出 mirror 档、又不属 origin 的 stale 档,被判成超窗旁支,而本门给的四条出路对它全部不成立(A 删的是别的 remote / B 对远程跟踪引用无效 / D 只 prune origin)⇒ 无解恒红挂每次提交(§12e/§12f);判据改为按 git remote 现配清单分档,configuredRemotes 取不到时一律不判 orphan(失效方向仍是多拦),T21 端到端锁正例 + 自检四例反向对照;同批门150 三族圆角归位(KeepaliveCenterPanel panel→rounded-xl / control→rounded-sm,quick-notes archivedDot tiny→rnRadius.xs),工作树面复跑判红 0 族 (bf63f8c40b)
- 📚 Docs:G-397 双席同题对账入当前行—s6 席 deploy-lock 负向与本席 git-lock 迟到finish 验收互补,合跑6/6绿,auto 已收编 (bca2ffaeb7)
- 🐞 Fix:G-1182551 终验闭合二落——03:00 轮转档案当日 4 行 strict-UTF8+CJK 正常(mojibake=0)non-UTF8=0 成立;一次 CAS 被合批洗回 open 已如实注记 (93ff2c73dc)

**2026-10-26**
- 📚 Docs:号池三件套补登记——package.json 的 relay:inspect 入口 + docs 增 §2.1 外来格式自适应/§5.7 归一单源/§9 号体检CLI六态/§10 空闲保活时钟;两张活文档归并不在本笔 (a4ef5e2bf0)
- 🐞 Fix:G-397 结清——验收实验双臂实跑过(git-lock-lease-token.test),机主令接管僵尸票 (2355619e6f)
- 🚀 Feature/Improvement:号池对标 workbuddy-switch 三件套——①外来格式自适应导入(别名搬运+秒/毫秒量纲归一,立修 expires_at 被当秒折成 5138 年永不失明) / ②空闲保活档(greatest(last_used,last_refresh) 防闲置 invalid_grant,client-first 让位本机,env RELAY_ACCOUNT_KEEPALIVE_DAYS) / ③号体检速查 CLI relay:inspect(六态结论+下一步,零DB零上游不回显凭据) -- AGENTS §21 docs/README 同步(本批仅 docs;两张活文档归并不在本笔);测试 typecheck8/8+vitest69+格式棘轮+水印verify,端范围 api/worker/CLI 平台独占豁免见 PLAN (79d39e8365)
- 🚀 Feature/Improvement:账号保活中心统一两条保活线 + 密钥路径锚定治静默失效第8例 (f541169ba4)
- 🐞 Fix:结清翻勾 3 枚僵尸票(G-22/G-34/git-guardian前提腐烂)——机主令接管;结清事实由 b8r1/b10r1/b13r1 注记+引用枚落定,本批翻勾并盖接管戳,正文逐字守恒 (eb3a7b66da)
- 🚀 Feature/Improvement:check-task-claims 补超龄认领牌现读枚数口——判据一律 import 挂牌单源零复算,新读数只做附加不改既有各档形态;同枚按其自注重新设计 T20 夹具(真仓叙述形态已合法归零,阳性对照改由真行合成,尺子的牙不变)(执行席 claims-cl1 交回;主席复跑镜像测试廿五例全绿) (9db07eae77)
- 🐞 Fix:G-1182551 结清——机主令接管僵尸票(持牌 g2-alltasks 近48h零活动),ssh 隧道处置(deploy 10-21 实证档)+生产日志 strict-UTF8 终验全绿 (398c711c3b)
- 🐞 Fix:监控侧告警去重身份改走单源出口——不再整条文本自拼身份,证据锁进 harness 与镜像测试;抖动门现读零新增(执行席 monitor-identity 交回;主席复跑镜像测试十九例全绿与守门 224 现读) (b9162299c8)
- 🐞 Fix:守门115 认跨文件转发豁免并钉依据链——hub adapter 的转发点名校验出口与两处调用点,演示路径真缺口保留点名不一起消掉;同枚修复该文件工作树副本的 JSDoc 断头(语法坏件会让整门解析失败)(执行席 gate115-forward 交回,主席补齐注释开头并复跑读数:命中一候选三,转发豁免一带依据链) (56497242c4)
- 🔧 Chore/Other:给四枚零测试共享工具补真用例——base64、number-format、token-estimate、dangerous-command-detector(执行席 shared-utils-tests 交回;主席复跑 vitest 五十三例 GREEN 且 shared 包 typecheck 过) (552bb5d058)
- 📚 Docs:四枚二次复跑 PASS 结清——G-397 锁租约认 token(反向验收四例含迟到 finish 不改控制文件)、G-53 lint-staged 三态分档三针已打补丁、G-63 safe-commit 发令数组无 pathspec 且 env-blocked 四条十五天零复发、G-863 附件容量写前 CAS 与跨批用例均在 HEAD(执行席 zombie-recheck-B 换角度独立复跑,主席按其现读末行摘行) (bc0c7ceb69)

**2026-10-26**
- 🚀 Feature/Improvement:号池对标 workbuddy-switch 三件套——①外来格式自适应导入(别名搬运+秒/毫秒量纲归一,立修 expires_at 被当秒折成 5138 年永不失明) / ②空闲保活档(greatest(last_used,last_refresh) 防闲置 invalid_grant,client-first 让位本机,env RELAY_ACCOUNT_KEEPALIVE_DAYS) / ③号体检速查 CLI relay:inspect(六态结论+下一步,零DB零上游不回显凭据) -- AGENTS §21 docs/README 同步(本批仅 docs;两张活文档归并不在本笔);测试 typecheck8/8+vitest69+格式棘轮+水印verify,端范围 api/worker/CLI 平台独占豁免见 PLAN (79d39e8365)
- 🚀 Feature/Improvement:账号保活中心统一两条保活线 + 密钥路径锚定治静默失效第8例 (f541169ba4)
- 🐞 Fix:结清翻勾 3 枚僵尸票(G-22/G-34/git-guardian前提腐烂)——机主令接管;结清事实由 b8r1/b10r1/b13r1 注记+引用枚落定,本批翻勾并盖接管戳,正文逐字守恒 (eb3a7b66da)
- 🚀 Feature/Improvement:check-task-claims 补超龄认领牌现读枚数口——判据一律 import 挂牌单源零复算,新读数只做附加不改既有各档形态;同枚按其自注重新设计 T20 夹具(真仓叙述形态已合法归零,阳性对照改由真行合成,尺子的牙不变)(执行席 claims-cl1 交回;主席复跑镜像测试廿五例全绿) (9db07eae77)
- 🐞 Fix:G-1182551 结清——机主令接管僵尸票(持牌 g2-alltasks 近48h零活动),ssh 隧道处置(deploy 10-21 实证档)+生产日志 strict-UTF8 终验全绿 (398c711c3b)
- 🐞 Fix:监控侧告警去重身份改走单源出口——不再整条文本自拼身份,证据锁进 harness 与镜像测试;抖动门现读零新增(执行席 monitor-identity 交回;主席复跑镜像测试十九例全绿与守门 224 现读) (b9162299c8)
- 🐞 Fix:守门115 认跨文件转发豁免并钉依据链——hub adapter 的转发点名校验出口与两处调用点,演示路径真缺口保留点名不一起消掉;同枚修复该文件工作树副本的 JSDoc 断头(语法坏件会让整门解析失败)(执行席 gate115-forward 交回,主席补齐注释开头并复跑读数:命中一候选三,转发豁免一带依据链) (56497242c4)
- 🔧 Chore/Other:给四枚零测试共享工具补真用例——base64、number-format、token-estimate、dangerous-command-detector(执行席 shared-utils-tests 交回;主席复跑 vitest 五十三例 GREEN 且 shared 包 typecheck 过) (552bb5d058)
- 📚 Docs:四枚二次复跑 PASS 结清——G-397 锁租约认 token(反向验收四例含迟到 finish 不改控制文件)、G-53 lint-staged 三态分档三针已打补丁、G-63 safe-commit 发令数组无 pathspec 且 env-blocked 四条十五天零复发、G-863 附件容量写前 CAS 与跨批用例均在 HEAD(执行席 zombie-recheck-B 换角度独立复跑,主席按其现读末行摘行) (bc0c7ceb69)

**2026-10-26**
- 🚀 Feature/Improvement:票面 G-941 写账侧最后两格——计划链构造点带主链别、koubo 工作流复用引擎唯一出口入账(链别在出口处本文件零字面量);自证抓出两处真错(增量基线逐条相加断言、账本路径自算致零副作用断言恒真)已由该席改正(执行席 api-plan-chain 交回;主席复跑该族 pytest 册十六例 GREEN) (39b7c18110)
- 📚 Docs:G-1200042 挂牌认领——本席按票面把 Knip 残余债切两席裁决(5 枚零引用文件 / 23 枚零消费导出),§7 三问逐枚答完才动手;基线收紧一格按 §12e 留 owner,不在本票射程 (dfa48b8d67)
- 🔧 Chore/Other:菜单层级 e2e 补历史页 /chat/history 同型用例——一线≤7/导出子菜单2项/压缩子菜单2项,main#main 作用域消歧侧栏同名 testid;run9 4 passed (3fc3f73066)
- 📚 Docs:登记票 G-1200042 Knip 棘轮残余债(5 枚零引用文件 + 23 枚零消费导出的接线或删除裁决),判词与复算材料落 .ihui-agent/tmp/s27-knip;本票可派单,不阻塞 CI 现绿面 (47853a52d8)
- 📚 Docs:Knip 棘轮收口与 RN 文字快捷笔记切片两条行级注记落账(证据在枚 8ab7f67b86/31a2b3cb45 提交信息;D03 行只记事实与未裁关系,不翻勾不代裁) (d469a45e5b)
- 📚 Docs:修我刚写坏的那行兜底口径(反引号被转义成反斜杠 + 短语重复一遍) (67b79c811b)
- 📚 Docs:G-44 结清摘牌——去重身份已含病因维且抖动读数归一(枚 714efaa19196b077947206f4ee62213f81586600 入库),席 g44-alertdedup 双对照取证:异病因异键成立、轮次/条数/时刻/sha 漂移同键;票面行号 257 已腐烂(现读调用侧 459 与 486)。残余一格(监控侧自拼身份未走单源)另派他席,不在本票射程 (bf25ef478d)

**2026-10-26**
- 🔧 Chore/Other:菜单层级 e2e 补历史页 /chat/history 同型用例——一线≤7/导出子菜单2项/压缩子菜单2项,main#main 作用域消歧侧栏同名 testid;run9 4 passed (3fc3f73066)
- 📚 Docs:登记票 G-1200042 Knip 棘轮残余债(5 枚零引用文件 + 23 枚零消费导出的接线或删除裁决),判词与复算材料落 .ihui-agent/tmp/s27-knip;本票可派单,不阻塞 CI 现绿面 (47853a52d8)
- 📚 Docs:Knip 棘轮收口与 RN 文字快捷笔记切片两条行级注记落账(证据在枚 8ab7f67b86/31a2b3cb45 提交信息;D03 行只记事实与未裁关系,不翻勾不代裁) (d469a45e5b)
- 📚 Docs:修我刚写坏的那行兜底口径(反引号被转义成反斜杠 + 短语重复一遍) (67b79c811b)
- 📚 Docs:G-44 结清摘牌——去重身份已含病因维且抖动读数归一(枚 714efaa19196b077947206f4ee62213f81586600 入库),席 g44-alertdedup 双对照取证:异病因异键成立、轮次/条数/时刻/sha 漂移同键;票面行号 257 已腐烂(现读调用侧 459 与 486)。残余一格(监控侧自拼身份未走单源)另派他席,不在本票射程 (bf25ef478d)

**2026-10-26**
- 🚀 Feature/Improvement:票面 G-941 写账侧补 workflow 生产者并把 chain 缺省收成必填语义——工作流不再静默落未判定桶,漏传当场点名;bench 与越权用例补传主链别(执行席 g941c-workflow 交回;主席复跑该族 pytest 册六十二例 GREEN,被删的 data/cost_ledger.json 经现读属 gitignored 残留) (7faee0fb1b)
- 🔧 Chore/Other:守门98 镜像 D4 计数行的假牙改形态锁——只报数维不再把一次性读数钉成下限,补两条变异自证(摘行必红、读数归零不红),pass 由廿五增到廿六(执行席 gate98-softcount 交回;上一枚因并发清索引落成空提交,本枚重试) (e65492b6e2)
- 📚 Docs:git 出网兜底口径对齐实现 —— 换腿双向(代理↔直连)、网络形状含挂死零回显、方向由 plan.useDirectArgs 单点给 (b1b1fd08a7)
- 🐞 Fix:把换腿兜底补成对称的两臂,并治好它自己的两处失真 —— ① 旧判据只兜"代理→直连"单向:显式绕过(--no-proxy)后若只剩代理腿能用,仍把"我有腿"判成"无法判定远端位置"(rc=2;当天 09:20 实测 Failed to connect to github.com:443 + 200s 挂死各一次)。现按 usedDirect/alreadyDirect 双向换腿,方向由 plan.useDirectArgs 单点给出(写死任一方向=只兜一条腿的偏判) ② 挂死到超时既无退出码也无回显,旧判据 `status!==128` 直接不兜 ⇒ 又成安静失效(§12f);新增 isTransportEgress 统一口径(128+传输回显 ∨ 挂死/零回显) ③ 无腿可换那一支也留痕,且先过动词表(实测曾把 for-each-ref 的本地失败记成 both-failed 往账本造脏行,该 1 行已清) ④ 用例 25 例(对称两臂+挂死+服务器裁决四型不得换腿+源码形状锁),face-reader 35 / git-push-guard 32 / safe-commit-triage 5 合跑 97/97 (f23d935e54)
- 🐞 Fix:免鉴权目录空 key 不再发 "Bearer " —— 占位 key 判未配置后 huggingface 以空 key 出网,默认分支仍无条件拼 Bearer ⇒ httpx LocalProtocolError Illegal header value,本该 200 的 router /v1/models 变失败又把 health 打成0;三处 Bearer 分支配 api_key 守卫空则不设 header,并加回归用例钉住(无 key ⇒ 无 Authorization);pytest 224 全绿 (f52f4580c7)
- 🐞 Fix:占位 key=未配置⇒未配凭据厂商不进人告警(机主定案)——实测 ai_model_config 三家密文解出 sk-placeholder-… 变体,精确匹配的 _PLACEHOLDER_KEYS 拦不住⇒github_models/cloudflare_workers_ai 被拉进同步连败3次永久禁用、huggingface 直连被墙 ConnectError,三家 gauge 钉死0⇒LlmProviderUnhealthy 长期 firing;新增 _is_placeholder_key(空/白名单/含placeholder 大小写不敏感)收敛在选取层:占位 key 厂商不进同步也不进启动恢复(无序列⇒告警自愈),免鉴权放行时不带占位 key 出网;huggingface 标 keyless_model_list(router /v1/models 无key 200 实测)换域后照常同步转健康;pytest 5 例新增+233 例全绿,变异自证(摘判据⇒2例咬红) (352731df85)

**2026-10-26**
- 🔧 Chore/Other:侧栏会话菜单层级 e2e 冒烟 spec 入库——真浏览器验证一线10项/导出子菜单7项/压缩子菜单2项/MD导出真下载/Issue白话提示上屏(run7 3 passed);随重构补装回归防线 (7db240fbd0)

**2026-10-26**
- 🐞 Fix:还原收编器抢先入库的过窄状态——零使用符号不得被去 export 背景:收编器在 8ab7f67b86 把我席在树的 Knip 第二轮收窄整片提交,而那一刻我尚未跑完 全量 typecheck 的修复轮,HEAD 因此带着 tsc 立刻点名的错误(未用局部量/未用类型)。 判据:去 export 只对「本文件内确有使用」的符号成立;若该符号在本文件内也零使用且 全仓零消费方,去掉 export 会让它变成 tsc 眼里的死局部量。这类不得由我单方面删除 (§7 三问无人背书),故一律还原为原导出形态。 还原面 48 文件:api 服务层 __reset*ForTest 与账本条目类型、miniapp-taro 的 canvasToTempFilePath/rpxToPx/imagesToBase64/writeFileFromBase64/useChatSyncMessages/ stopTokenAutoRefresh/readFileAsBase64 别名腿、mobile-rn token 与 web useAIWebSocket、 shared hands 契约两枚、topic-detail 样式类型等。 验证:turbo typecheck 全量 32/32 任务 0 错误(还原后现跑);knip 复量待干净检出。 (31a2b3cb45)
- 🔧 Chore/Other:守门98 镜像 D4 计数行的假牙改形态锁——只报数维不再把一次性读数钉成下限,补两条变异自证(摘行必红、读数归零不红),pass 由廿五增到廿六(执行席 gate98-softcount 交回,主席复跑同条命令绿) (3a1c07ed0a)
- 📚 Docs:两枚结清——G-17 schema_check 认借来的连接(席 g17-schemacheck,主席复跑 pytest 五十九例 GREEN,枚 8ab7f67b86 入库);G-39 判为守门98 D6 同题重复登记(门体早于批基线在 HEAD,席 g39-shadow-js 现读 self-test 四十例全绿、真仓 RC=0,按僵尸票摘行通道结清) (b49b38ec62)

**2026-10-26**
- 🚀 Feature/Improvement:票面 G-941 第二读面补链维——用量基线来源键按链别分桶,未判定桶独立可见不并入主链(执行席 g941b-usage 交回;主席独立复跑该族 pytest 廿七例 GREEN) (1727fb92d3)
- 🐞 Fix:折叠 web 五语词包的同行逐字重复键——门 2 / 2e-dupns 由红转绿(全仓提交链解堵) (bec5acc3e8)
- 🚀 Feature/Improvement:绑定Issue对话框加普通用户用法提示——副标题改白话说明(bindIssueHint)、搜索按钮长句改短动词键(searchIssueAction),五语言同批补键parity 19260 OK;对话框测试12/12、web typecheck全绿;顺带prettier对齐该文件存量格式欠账 (edaa348b22)

**2026-10-26**
- 🐞 Fix:退化留痕账本自身学会老化,并把我上一轮探针注进真账的假历史单独清掉(chore) —— ① pruneEgressLedger(30 天窗,行首 ISO 切分刻意写成 slice(0,tab):写成 slice(0,slice(0,i)) 会把字符串当长度传进去恒 NaN,老化形同虚设——这一格由用例 ⑤ 钉住) ② 被裁条数写进账本自己的 cad=prune marker,共享层不打 stdout/stderr(否则污染几百把尺子的逐字基线) ③ 注入口 isForceDirect/pruneEgressLedger/KEEP_DAYS/noteEgressDegradation 进 __test__ 供镜像测试消费 ④ 新增 ③e/③f(绕过通道 env→第一趟直连→不叠第二趟 三段接线锁)与 ⑤/⑤a/⑤b/⑤c(端到端真写盘,夹具落 mkScratch 不碰真账);另把真账里 verb=probe｜依据=夹具 那 1 行删除(我自己造的假历史,其余 105 行一字未动) —— 用例 21/21 全绿 (939f7ff30e)
- 🐞 Fix:离线语言包随 G-957 新键重生成——门 105 由红转绿 (d1b79b8411)
- 🔧 Chore/Other:G-1102638 批1 同主键副本行物理归并 — 删 2 行(机主拍板〔拍板@2026-10-08 机主:真删+立即执行〕;幸存者规则与F4同向;落账注记行保留待批2;复跑auditPlan对账F1=0/F9不增;逐行留痕 .ihui-agent/archive/PROJECT_PLAN_copy-purge-2026-10-26.md) (125a0d4a3c)
- 🐞 Fix:plan-copy-row-purge 开④d「枚回执」档——行号型指针(`副本指针（编号 L6880）`+行内枚 sha)有了可验出路 (7160346576)
- 🐞 Fix:收口 union 回潮的 4 道门——① 门2b web zh-TW 4 处简体残留再修(前臺/後臺/分佈/任一臺,与 2c2699be79 同批形);② 门83 R3/R8:filterChipTextActive/tabTextActive 改名仓内 Text 后缀惯例(filterChipActiveText/tabActiveText)使兄弟配对成立,archivedDotOn 指示点与两处 progressFill 走 brandAccent.deep(stepDotOn 先例);③ 门94:MODEL_RETIRED 收编 error-catalog(resourceNotFound 档)+ 五语言词包;④ 门105:小程序 ui-routes 重生成(输入 use-ui-control-bridge/taro-ws-ticket 已在 HEAD 漂移)。quick-notes-styles.ts 的 archivedDotOn 修在笔记席位在飞副本上,随其落地 (e216dca2f6)
- 🚀 Feature/Improvement:G-957 小程序网页授权回传腿闭合(代码侧)——① web 中转页 /sso/login 新增 miniapp-bridge.ts:微信 JS-SDK jweixin-1.6.0 CDN 注入 + wx.miniProgram.postMessage 回传 sso_code(载荷契约 ihui-sso-code 与小程序接收侧逐字同源,SDK 失败超时 8s reject 如实提示绝不静默,交接成功留完成卡不跳转防丢 bindmessage 整批投递时机);② auth-sso.ts 深链 scheme 白名单默认补 ihui-miniapp(过 isSafeRedirectUri 的合法形态,AGENTS §9 契约);③ miniapp sso.ts 导出 SSO_REDIRECT_URI + LoginPopUp 增 onWebAuthLogin 传入才渲染格 + user 页接线(收弹窗再跳 webview 页);④ 五语言:miniapp-taro login.webAuthLogin + web miniappHandoff 三键;⑤ 测试:web 桥 12 例本席绿+主席独立复跑 12/12;剩余人工窗=小程序后台业务域名白名单+真机投递时机验证 (20fce9cea8)
- 🚀 Feature/Improvement:G-40 A/E 双格闭合——command-acks 写侧端点 + ack 事实存活判据——① POST /api/command-acks(authenticated 零公开面,owner_key 由令牌主体拼出,Zod 入参,PG 事实先行+KV 镜像后写不共事务,KV 失败不回滚 PG、如实 kv_mirrored:false,复合主键 onConflictDoNothing 幂等:同指纹 replayed/processing 409/异指纹 KEY_REUSED);② services/command-ack-facts.ts 纯判据四档死因硬错 + GET /alive/:parent/:cmd 查询面;③ 新测 18 例全内存零真库,本席两遍 + 主席独立复跑均 18/18 绿;④ turbo typecheck api+web 11/11 任务 0 错误(删除批 27 枚已还原后现跑);⑤ index.ts 仅 import+注册两行接线 (865aad52cb)
- 🐞 Fix:huggingface 入口换域 api-inference→router.huggingface.co——旧域被网络封锁(直连超时+代理TLS reset 实测),官方推理入口已迁;registry/种子/web 中继清单三处同步,生产 DB ai_model_config 行已另行 UPDATE 到位 (b4b1c6a3ab)
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
