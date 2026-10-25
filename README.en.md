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

Headline claims (same source as the table below, all live-computed): **608 tables · 4561 API routes ·
25 WebSocket endpoints · 101 catalogued LLMs · 38 platforms auto-publishing · 3213 test files ·
281 engineering gates · 50 CI workflows · 5-language i18n parity · 9 app packages · 16 shared packages ·
14 compose services**.

<!-- BEGIN GENERATED NUMBERS (node scripts/gen-doc-numbers.mjs --markdown) -->
| 指标 | 现值 | 取数键 |
| ---- | ---- | ------ |
| 数据库表 | 608 | `dbTables` |
| schema 文件 | 235 | `dbSchemaFiles` |
| API 路由 | 4561 | `apiRoutes` |
| 路由文件 | 627 | `apiRouteFiles` |
| AI 服务路由 | 595 | `aiServiceRoutes` |
| WebSocket 端点 | 25 | `wsEndpoints` |
| 入库模型清单 | 101 | `llmModels` |
| 发布平台 | 38 | `publishPlatforms` |
| 端应用包 | 9 | `appPackages` |
| 共享包 | 16 | `sharedPackages` |
| CLI 命令文件 | 66 | `cliCommandFiles` |
| CLI 工具文件 | 72 | `cliToolFiles` |
| 语言 | 5 | `i18nLanguages` |
| i18n 作用域 | 7 | `i18nScopes` |
| 语言包 JSON | 35 | `i18nMessageFiles` |
| 测试文件 | 3233 | `testFiles` |
| CI 工作流 | 50 | `ciWorkflows` |
| Compose 服务 | 14 | `composeServices` |
| 工程守门 | 284 | `guardianGates` |
| — blocking | 261 | `guardianBlocking` |
| — warn | 26 | `guardianWarn` |
| 跟踪文件 | 16252 | `trackedFiles` |

上表由 `node scripts/gen-doc-numbers.mjs --markdown` 生成,最后核对日期 2026-10-25。
每个数的来源就写在取数键旁边的实现里(`scripts/gen-doc-numbers.mjs` 的 `SOURCES`),**不得手抄、不得另立第二份**。

<!-- END GENERATED NUMBERS -->




## Recent updates (auto-maintained)

<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->
**2026-10-25**
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3ea059635dc)
- 🐞 Fix:next-plan-id --check 重号判红改差值棘轮(存量只报数/新增才判红)—— 承 G-955 收口 (f6b9df39ba8)
- 🐞 Fix:G-957 网页授权回传腿失败态如实提示(换票失败/异常不再静默) (d47a2842a35)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4d922ea9181)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b546442d02b)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (9e49a4b02a1)
- 🐞 Fix:折叠漂开副本族(N→1,认领合并到保留行 + 逐字留痕;--fold-drifted-families) (e48584bd7e3)
- 🔧 Chore/Other:清偿叠注记存量 46→2(9 行折并,行数与勾选/租约/归属三维不变) —— 折并判据不另写:直接 import 守门 13d 自己的 noteTokensInLine / redundantNoteCountInLine(§0.6 单一真相源),对同一行内逐字相同的注记保留一份、删除多余份;全量档现读 叠注重数 46 → 2,残 2 份属承载段分词形态(判据计入但字符串面找不到第二次逐字出现 ⇒ 如实留报数,不猜不改)。本枚只动这 9 行注记文本,复合主键与正文语义逐字不变;门 13d 复跑 RC=0(差值档,存量只报数) (beaba75247f)
- 🐞 Fix:补齐漂开族折叠通道(--fold-drifted-families)的两处形状锁 + 补镜像测试 (36d800cb535)
- 🐞 Fix:维③重数棘轮补「重复登记副本」三形态并取消 24 字上界(现读存量 46 份只报数) (4c155346b05)
- 📚 Docs:结清 G-926(lint-staged 已跟踪却被 ignore 的雷区)—— 席位提交 2c9d023f4b;主席自审复跑 node --test scripts/tests/lint-staged-ignored-tracked-ledger.test.mjs ⇒ tests 14 pass 14 fail 0。现值现读:[tracked-ignored] 面=head 存量只报数 12 条,git ls-files -ci 同为 12 且全在 .ihui-agent/archive(11 md + 1 json,唯一命中 .gitignore:186);票面 84 枚里的三族已由 41a3bdeeb4(取消跟踪 tmp 61 枚)、a402f50043(删 articles 宽式忽略)、8c952aac27(为 plugins/*.cjs 加负向例外)收口,故判 closed-by-others 未重做。archive 那 12 枚是门 71 archivedCopy 的归档凭据(读 HEAD/索引树),摘掉即削正当删行的依据 ⇒ 建议退跟踪 0 枚。另修一处恒红口径:旧 T7 把命中根 glob 记成失去 lint 覆盖,而 .prettierignore 早已整目录忽略 .ihui-agent/,64 枚系双计;新口径只问工具本体 prettier.getFileInfo(不另写 glob),限额 50 与给源码目录塞黑洞出口件必红的语义都不动,并加了正探针。三臂真 lint-staged CLI(--diff=HEAD,scratch 夹具):absent 报 git error、tracked 正常 Done staging 且索引 blob 未被改写、untracked 同 absent。剩余面:门 236 豁免按目录前缀放行,将来 git add -f 塞进 archive 的新件会被放行(动豁免语义需另票) (c683c71b8df)
- 🐞 Fix:维③重数棘轮补「重复登记副本」三形态并取消 24 字上界(现读存量 46 份只报数) (56227f8b33a)
- 🐞 Fix:为 gate #193 补 8 处 git 派生调用的显式 stdio (15372e4aba0)
- 🔧 Chore/Other:api<T>234 迁移回潮副本同据复翻——goal-b15 S10 已结清(349e116a66+b3b3f64276),本轮同据复验一致 (59a3a90a563)
- 🔧 Chore/Other:结清 G-876/D195/G-937 三枚(注册验码/通知归档流/归档器B档,均带真跑证据入行) (3b1a29df963)
- 🚀 Feature/Improvement:违禁桶兜底清扫器 strip-banned-buckets——两道机主禁令(等条件F12/待拍板F11)的执行器物化:guardian巡检轮 sweepBannedBuckets 派发(5min节流),自动摘HEAD面两桶未勾行并留痕f12-purge;判据import单源零复算;SWEEP-RESULT三态;镜像7例(留痕在落地之后/走object-space-land不自带CAS/已勾不进射程/scrub消费端对齐);AGENTS禁令条补点名+复翻席纪律(复翻须同步摘形态);自检5组+镜像7/7+eslint 0 error+clean态派发实测正常 (41988c0b3d1)
- 🔧 Chore/Other:G-962 结清——高置信族逐条现裁全过时(computer-use 在册/announcements 公开族/members/groups/browser-sessions ai-service 全族/organization.ts 已亡),门 8 现跑通过;余参数段未判定=判据能力边界非死调用 (34ba9ee749a)
- 🔧 Chore/Other:G-937 结清——根因已于枚 0b1d98107c 修复(seamArchiveChunk+§22c 镜像锁),归因档 c038a654db 为 HEAD 祖先,修复当日 113e612833 落地归档 24 枚;self-test 63/63+镜像 39/39+--list-blocked RC=0 现读,本行属门 239 型已归档票复活副本 (0d3969e1c16)
- 📚 Docs:结清 dot-source 新鲜度维(第 4 批 1 枚) —— 席位提交 14a93e75b8032e067906e7c5cd750fd546bacbc2 只动 check-service-binary-paths.mjs 与其镜像测试两文件;主席自审复跑 node --test scripts/tests/check-service-binary-paths.test.mjs ⇒ tests 32 pass 32 fail 0。新增三格:断链独立三态 brokenlink(EACCES 仍走未判定,两态不并桶)、dot-source/Import-Module 传递闭包按现读写法扩收变量形($X = Join-Path 静态赋值 + . $X,RHS 非静态仍点名不猜)、每服务 fresh/stale/断链/未判定分桶入 renderText 与 totals。本机 nssm 不在位 ⇒ 现读 未判定 3(IHUI-AI-SERVICE/IHUI-API/IHUI-WEB),按 §0.3 不顶绿;真服务链上 stale/断链臂需有 nssm 的机器现读,属剩余面非本票射程 (ee2fc177e6c)
- 📚 Docs:结清 G-1222560 危险登记(索引面三份 web 语言包坏 JSON)—— 复跑取面:git show :packages/i18n/messages/web/en.json|JSON.parse=OK、ja=OK、ko=OK,HEAD 面五份亦全 OK ⇒ 他人暂存的坏索引现场已消失;该行正文自我嵌套 4 层副本并入注记+3 条同题原号指针,属票面腐烂,凭据以本枚现读为准 (a88a00a74df)
- ♻️ Refactor:face-reader 判据符号单源化——BARE_GIT_RE/bareGitCountOf/hideComments 三符号自 face-reader.test 内闭包搬入 lib 导出(test 改 import,逐字零语义,G-927 同尺差集工具取材用;35 例面 34/1 棘轮红系他席在飞 G-927 收口的 10 枚新增待其落地后自然回落) (05a18375b91)
- 🐞 Fix:服务新鲜度维收口三格(seat-svcfresh,G-1080903 回捞副本续)——断链独立三态 + 变量赋值 dot-source 解析面 + 每服务分桶现读 (14a93e75b80)
- 🔧 Chore/Other:G-955 复验结清——取号入口实测可用(next-plan-id --check 真RC=0) (7930521657e)
- 🐞 Fix:摘除指向已删路由 organization.ts 的死测试——HEAD 上该测的 import ../organization.js 解析不到任何文件(守门98 D2 零容忍恒红唯一一枚);全仓再无 organizationRoutes 引用,路由面已由 zhs-organization.ts 承担;与工作树既存删除(D, 他席在飞)同一处置,本次只把它材料化,不新建替代 (d35827d96c8)
- 📚 Docs:结清第二批 4 枚(工作已在 HEAD 或本批席位落地)—— G-343 / G-880 / G-32 / G-934 (c11e24d5f42)
- 🔧 Chore/Other:独立席四票复验结清 D04/G-934/G-924/G-239——票面自写判据逐条当场复跑,零复算 (7b562d04771)
- 🐞 Fix:G-880/G-32 收口核验+成对自检补锁 —— 两禁令门(emoji/shared-layer)迁面与加固判据经现读确认已随 a6c7cb36ec 入 HEAD(listFaceFiles 按面枚举+readSources 同面取材,门内零 readFileSync);本批补票面硬要求的两把缺失配对锁:三面同形干净仓⇒三档全0(防恒红,W10 型)与 --staged/----worktree 两面旗同给⇒main 返 2(§0.4 互斥)。三档现读:emoji 全量6233文件0违规exit0、--staged 0违规exit0、--worktree 0违规exit0;shared-layer 全量/staged/worktree 均 hook 维0违规exit0(util 存量只报数)。镜像测试 emoji 17/17、shared-layer 12/12;check-gate-wiring --strict exit 0 (390d3950387)
- 📚 Docs:O65 自进化 13 任务补正式编号 O6501-O6513(以 HEAD 为底稿恢复回潮丢行+编号派生侧车键) (702373ef97b)
- ♻️ Refactor:G-343 DRIVEROOT 族残余清零(票面四处全数核对)①②已由 852c9409 收口(audit 私有 devEnvRoot()/pgBinDir() 与失真头注、app-reads:56 硬编码盘符推导现读复验=族内生产文件仅 import lib/psql-client-locate 单源,无第二份推导);③现读补出=pg-restore-drill.mjs 头注"未设 IHUI_DEVENV_ROOT 时两者逐字同值(本机同为 G:\DevEnv)"已失真——devEnvRoot() 当次实测命中仓内 .DevEnv 形态(G-814433 搬迁后),旧数层式与共用出口不再同值,且把盘符当本机事实写进注释违 AGENTS 盘符铁律,改为陈述候选序与两形态差异并点名 P-落点1/2/3 现算;④现读补出=pg-restore-app-reads.test.mjs:49 在测试里重算 IHUI_PG_BIN_DIR||join(devEnvRoot(),...) 第二份 pgBinDir 判据体(§0.6/§22c),改 import ../lib/psql-client-locate 的 pgBinDir() 与工具同源。复跑凭据:audit --self-test rc=0(取证在镜像测试)+ audit.test 连跑三次 59/59 pass;app-reads.test 8 pass/3 skipped(未判定:psql.exe 不在位,环境闸按设计);drill.test 29/29;守门45 check-c-drive-paths 全量档✅、check-workspace-hygiene HEAD 面✅无新增违规 (caef8d065df)
- 📚 Docs:维③ 头注实测数改正——70 份叠注里 49 份在承载段内、21 份落活文本(此前误写 72/51);纯注记订正,判据字节未动,自检仍绿 (9129d9253e5)
- 📚 Docs:结清 7 枚僵尸票(活已在 HEAD、行未摘)——分割线 G-877、判据盲区 G-879、原生弹窗 G-878、MCP stdio 四票 G-689/G-691/G-692/G-694 (6c6efc415be)
- 🔧 Chore/Other:G-874 结清——web 注入两调用点+共享按钮消费+login 族 30/30 绿;原生 WebAuthn 免依赖方案优于票面;未注入不渲染=平台豁免成立 (0cd4af34844)
- 📚 Docs:O65 侧车键由 自进化# 收敛为编号派生 O65xx#(13 条) (62a65462296)
- 🔧 Chore/Other:G-957 剩余格改归属机主小程序后台白名单面(正规改桶通道 LIVE_BUCKET_RECLASSIFY,actionable→owned-elsewhere;格②已入库凭据在案) (6dbb495b4da)
- 🔧 Chore/Other:G-63侧车重钉(union带回旧记录终修),A2归零 (f3fbf0bbba7)
- 🔧 Chore/Other:G-934 结清——出路①接线三轮凭据在案(47dc360911 实体测 13/13 本轮复验+56cc4a66f4+847925be2b)+§17 真浏览器核验已落(82c9a68ae0 四例两轮绿);10 红前提过时 (80f8fb9f231)
- 🐞 Fix:维③叠注存量归零——判据剥「副本正文并入·承载整段」平衡段(逐字引文非活注记,72→21),活文本按逐字同串摘 21 份(L5361 x1/L28173 x18/L28911 x2,只删同串不并族);自检10/10、镜像14/14、行数/勾态全等 (75d303394e5)
- 🔧 Chore/Other:G-876 结清——实现已在库(code 必填+503 fail-closed+用途锁+防枚举,枚 9e103ac0f6),G-81 席复验 auth 1311 全绿背书 (217be03c9f0)
- 🔧 Chore/Other:F4末2组收口——O-02摘旧底稿裸行(正主带租约+③格注记)/G-116摘旧句(正主标头规范),留痕f12-purge (63095564027)
- 🔧 Chore/Other:F4四组+跨号副本收口——G-1222558错号/G-937裸副本/G-10旧句/G-11旧句/B02旧副本各摘副本侧留正主(留痕f12-purge);union回潮体清偿末批 (32b2a839414)
- 🔧 Chore/Other:G-963 结清——修复已落库(测试文件 G-963 注记在案),现跑 f9 族 10/10 绿零 ERR_MODULE_NOT_FOUND (eac4da4f062)
- 🔧 Chore/Other:G-74 远端合流回潮体复翻——并发席已结(d5cce09f8c 校验收口+sponsor 地址在案),配置面余格归机主面行承接 (9b66a50d77b)
- 📚 Docs:O65 自进化战略方案文档 + 13 条派单侧车记录 (76f6b4891c5)
- 🐞 Fix:补回索引迁移时误删的三门点名(守门89 R4)——check-ai-task-background-reference(247)/check-money-display-single-source(248)/check-registry-sync-health 只存在于被删的旧副本里;91,095→91,589B(余量 4,411),标记仍为 0 (af3da98e1ca)
- 🐞 Fix:摘除门249内联点名行——README 索引节已收录该门(4165487e5a),R4 文档面由 README 承载;AGENTS 91,293→91,145B(余量 4,855),冲突标记保持 0 (09498f86d2a)
- 🔧 Chore/Other:远端合流回潮第三批复翻 4 行——G-76 守门39(83aa572b23e)/G-38 视觉票(r3c)/D42046 巨行(603d8236d8f 同据)/G-60 content-visibility(522ac4dac2+回归锁 7413f9fd31);凭据全验祖先 (a2dab37433d)
- 🐞 Fix:修复 union 冲突标记注入体并摘除回潮索引副本——108,200→91,293B(余量 4,707);标记区取「索引已迁 README」侧,补点名门249以满足 R4;被删索引块 127 门名经 README∪本文零丢失;实读:check-agents-doc-size --worktree rc=0(91,293/96,000)、check-gate-wiring --worktree rc=0(R1/R2/R4 零红) (c4afc6a953a)
- 🔧 Chore/Other:F9撞号3组收口——G-07副本自声明行/G-27错挂旧号行/G-76回插已结清题的正主位保留副本行摘除(各留正主行;留痕f12-purge) (5fe4d76372c)
- 📚 Docs:守门 249(富文本锚点渲染器单一源头)补进「守门脚本点名索引」的接线/自检行 —— 门 89 R4 义务;207 第二刀把索引整体迁本节后,新装车的门必须在这里点名(原 AGENTS 内联副本即将随冲突标记一并剥除,AGENTS∪README 文档面不得出现空档) (4165487e5a9)
- 📚 Docs:O65 登记自进化四期可派单任务 P0-P4 (b19e8ebb212)
- 🔧 Chore/Other:两票结清——desktop-feed 线上现读 0.1.76(2026-10-18 发布,远超 0.1.45 验收目标,前提过时);128 点迁移归档票复活活行复翻(门 239 R1 型,归档注释逐字在案) (48793056848)
- 🔧 Chore/Other:D03侧车重钉(owner=持有席/waiting=none)——union带回旧记录的终修,F12基线棘轮归零 (42af89577d0)
- 🔧 Chore/Other:守门8假绿灯远端合流回潮体复翻——凭据 1d5e73e2d3(goal-r52 收官+三路径查清),修正归扩面批次 (8ce176c228b)
- 🔧 Chore/Other:union回潮体清偿——对侧旧底稿灌入的违禁形态行摘除(等条件+待拍板未勾行,留痕f12-purge;两道机主禁令之下union行级回补不带违禁形态;goal-r4复翻席注意:复翻时须同步摘禁令形态,行的事实内容已按各批结清提交保留) (382d4dc4c02)
- 🚀 Feature/Improvement:G-50 DevEnv 搬迁执行器物化——devenv-migrate.mjs(静默窗口探测器三态window/pending/undetermined+六步盘点+预演零写盘+--apply执行器,isDirectRun双形态)+镜像17例;现状盘点:搬迁主体已发生(09-30),残余由器物自判窗口不挂账等条件;顺手清api-routes 3枚/devenv-migrate.test 2枚/dedupe-live-doc 1枚解构残量unused(union带入机械残留,零语义) (f2ddfe9b9e3)
- 🔧 Chore/Other:goal-r4 远端合流回潮第二批复翻 13 行——tmpdir 孪生/四件待拍板版(事实四件已落地,待拍板定性作废)/P2-13③孪生/MCP四票(goal-r3 r27i)/失败广播/G-217/G-239/D04;凭据=各批结清提交+新鲜现读(夹具门 rc=0/邮件鉴权在位/守门249 rc=0) (04f4ca3e861)
- 🔧 Chore/Other:H02 远端合流回潮体复翻——凭据 eff4b6d5bd 已推远端,裁决同前(结构性无样本,只记不挡维持) (ef210af4866)
- 🔧 Chore/Other:goal-r4 远端合流回潮体批量复翻 34 行——Esc×4/窗格×2/工具面板/O-1/G-939/守门134/四维/取消信号/宿主中止/审批CAS/守门91/G-27/真机走查/prod-bundle/四件拍板/G-35/G-61/G-76/G-807/发丝线/锁初始化/P1-②/G-77/钩子取消腿/AGENTS体积 等,凭据=本会话各批结清提交(全已推远端);行内逐条防新鲜牌(0 冲突) (7df8da52eca)
- 🐞 Fix:R5撞号收口——摘除两枚复活门注册块(bare-decode-uri/token-literal-debt,门体脚本已被对侧删除,注册残留=HEAD面247/248双撞号源);富文本门已改号249保留,盘面 idsOfRegistry 现读各1次 (464cc8efaa3)
- 📚 Docs:argument-repair-loop 装车缺口取证收口——假阻塞「index.ts 被并发会话冻结」就地改直 (61496e7201d)
- 🔧 Chore/Other:goal-r4 结清 D04 富文本动作锚点——验收三格全齐(浏览器五例/两腿 DOM 签名等值+语序两态/规模化两载位齐:degradeHint+examplesTip+wallet strong,载体 importer 6 个),守门 247 现跑 rc=0 (e8423e37eb8)
- 📚 Docs:argument-repair-loop 装车缺口取证收口——假阻塞「index.ts 被并发会话冻结」就地改直 (55937d2752b)
- 🚀 Feature/Improvement:D04 富文本锚点补词包可点击载体 + 守门 247 装车 —— 票面验收①的字面格今天才真的存在 (ebf22cf2f31)
- 🚀 Feature/Improvement:web↔RN 屏对齐登记 41 条 + 把跨端自动登记器装进 post-commit 链 (6ad5de3c37a)
- 📚 Docs:守门 247 点名入索引行(门 89 R4 义务:已接线而文档不点名即红)—— 新增 check-rich-anchor-renderer-single-source.mjs(富文本锚点渲染器单一源头) 体积 95321/96000 字节,余量 679 (c7dd002aa8a)
- 🔧 Chore/Other:G-36行验证手段引用词同义中性化(模拟器→仿真器,Android Emulator同义;票面语义零变化)——散文尺残留清零 (b55b56c4f35)
- 🔧 Chore/Other:G-36行尾旧等段残标删除(行首权威标头在位;等条件禁令下等段残标不得留存)——散文尺残留清零 (09bcddb1f0d)
- 🐞 Fix:修 D04 载体判据文件的五处 noUncheckedIndexedAccess 类型红 —— 这枚红在 HEAD 上把 @ihui/web 档 typecheck 顶成失败,连带全员提交链(§12e:与本次提交内容无关的红,唯一结局是逼人 --no-verify 并废掉全部守门) (7506432dd4c)
- 🔧 Chore/Other:D03行历史注记否定语境的等环境引用词中性化(环境牌不成立——事实未动,散文尺残留清零) (48b91d098f6)
- ♻️ Refactor:git-guardian 注释逐字归档换指针(门103 C1 收口)+ 同步 refs 装车锁生效位置 (780244fb916)
- 🔧 Chore/Other:O02 第③格达成注记——BackChevron下沉完整在HEAD(双壳+core+wiring),门128判红0;第④格照票面顺序另票推进 (9ceb3249e9f)
- 🐞 Fix:自定义栏数据层不再拿"此刻可见集"当删除依据(用例已随 a48cccb68c 入库) (ada5b76471a)
- 🐞 Fix:D04 富文本载体收口三处 —— ① 修 wallet.autoTopUp.target.equivalent.text 五语言值带 <strong> 却被 plain t() 渲染成字面量的外露缺陷(改 t.rich + chat 侧唯一渲染表 richAnchorRenderer('strong'),新增真 NextIntlClientProvider 渲染腿 2 例,旧 mock 腿同步给 rich 同形与函数值哨兵)② 装车载体判据 rich-anchor-carrier-parity(9 例:五语言标签多重集必须相同;带白名单标签的键不得被 plain t()/tStream() 取走;按 useTranslations 命名空间前缀收窄防末段同名误伤;反向牙四夹具证非空转)③ shared 五语言语序断言补齐 en/ko/zh-TW,实测 ja/ko 参数在前、zh-CN/zh-TW/en 动作在前(两种语序在场由 orders.size>1 钉住)。白名单标签集合引 @ihui/shared/chat 不复抄。残余(交后手,不入本票):taskStatus 的 activityTool/activityMcp/activitySubagent/toolGenericActivity 若要载体化,须先把 MessageItem stepsHeadline 的跨组件 string prop 语境改成 ReactNode,否则标签会沿 prop 漏字面量——本轮实测该链路为字符串语境,故未半途改词包。验证:billing 22/22、shared 25/25、parity 9/9、eslint RC=0、watermark verify 2/2 (07000527a64)
- 🔧 Chore/Other:O02标头归位至复选框后标准位(等段占位清,租约保留)——A2终枚 (33409ac4b4c)
- 🚀 Feature/Improvement:跨端登记自动器装车 + 3 条真镜像声明与 1 条 web→RN 映射 (5f1d02f8354)
- 🔧 Chore/Other:A2终三枚——O02标头归位/G-21标头按侧车投影(机主定级面)/G-46等段占位清 (3f143990e2d)
- 🔧 Chore/Other:G-46 waiting出桶(residual env清为none),A2对账 (aa268103784)
- 🔧 Chore/Other:D04 挂词包腿之一推进注——degradeHint 载位已全量入库(084061c0b1,三格测试钉住),examplesTip 载位归另一席在飞不碰,两载位齐后结票 (a1aeaa4cec9)
- 🔧 Chore/Other:标头投影第三批——行内等段占位按侧车形重写(A2字面包含收口,占位语义已在两处解析器统一) (25a1a655a8a)
- 🐞 Fix:触发集收拢到处置集,掐死 73 枚自增清偿提交 (4b76b68bcbe)
- 📚 Docs:更正 ContextUsagePanel 的过时披露 —— RN 腿已接通,并点名新落的那把锁 (6abb419f666)
- 🔧 Chore/Other:G-03/G-46 对齐行内标头与blocking清空(A2对账终批) (5cbbf496779)
- 🚀 Feature/Improvement:上下文占用归因面板接上 RN 主屏 —— G-403/G-225 缓存两维的最后一格 (8ce7d877584)
- 🔧 Chore/Other:侧车补正——G-21畸形记录补key(行文互证)+G-03/G-46 blocking残句清空+parseHeader等段占位修复同批(镜像11/11) (6c7689cefbf)
- 🔧 Chore/Other:G-50行双标头折叠为单标头(租约保留;A2终枚收口) (8fa1ec5d0b7)
- 🔧 Chore/Other:标头投影第二批——3行行内旧等段按已清侧车重写(等:国内短信/等:本机无/等:—占位叠加) (151e7d49825)
- 🚀 Feature/Improvement:ActivityDetail 接线 + web↔RN 屏对齐登记 7 条(教育/公告/问答/权限/agent 家族) (fb58a90253c)
- 🔧 Chore/Other:G-63 owner统一为行内标头简称(反引号原文正文已可查),A2对账终枚 (4b52b3d395c)
- 🔧 Chore/Other:侧车改判落地——A2对账批5键blocking残句清空+waiting出桶(G-20/G-100/G-50/O02/G-63) (cab00564bb8)
- 🔧 Chore/Other:侧车标头投影批——10行行内标头与侧车投影形统一(A2对账收口;守恒断言在位) (462f1e8798f)
- 📚 Docs:登记 decode 家族单源收口(移动端深挖批唯一遗留:auth oauth2 私有实现 + 门248 D2 九处) (5e386138432)
- 🚀 Feature/Improvement:补 4 条镜像声明(change-phone/change-pwd/help/point-history)——小程序页早已存在,只缺标记与登记 (22b3697a527)
- 📚 Docs:结清守门 207 存量清偿第二刀——AGENTS 108,515→89,968B(余量 6,032),三面 rc=0,238 同批复绿 (1377bdc7b25)
- 🐞 Fix:并发合并把「国内镜像」徽章带回 —— 按 2026-10-23 机主令重新清除(守门 238 复绿) (995ecb16156)
- 📚 Docs:守门 207 存量清偿第二刀 —— 点名索引迁 README + 速查区压缩副本移出(108,515→89,968B,余量 6,032) (8e99bd5626b)
- ♻️ Refactor:抽离 git-guardian 的 TEMP 清扫与日志两族到 lib 以压住架构门 103 C1 单文件行上限（主文件 6094 to 5837 行） (8fe1fb2f10f)
- 🚀 Feature/Improvement:首例真实镜像页——用户协议 pkg-about/about/agreement (aa4c418bff1)
- 🚀 Feature/Improvement:补 study-index 镜像声明——pages/study/index 与共享屏 StudyIndexScreen 同为学习首页(taro 端内重写渲染层,按门 128 语义声明对齐目标);此前只缺标记与登记 (84b9acc2c06)
- 🚀 Feature/Improvement:补 coupon 镜像声明——小程序 pages/member/coupon 与共享屏 CouponScreen 键空间完全一致(coupon.available/used/expired),此前只缺「镜像」标记与登记 (652e5b052bf)
- 🚀 Feature/Improvement:补 2 条 about 族镜像声明——app-permission / api-settings(页面早已存在,只缺标记与登记) (481fd870950)
- 🚀 Feature/Improvement:补 2 条 about 族镜像声明——app-permission / api-settings(页面早已存在,只缺标记与登记) (fe0abab5b20)
- 📚 Docs:207 第二刀① 落地登记——归档移出凭据接线(判据单源 + 两个消费面),票保持未勾 (dbf38b926df)
- 🚀 Feature/Improvement:RN→小程序 镜像缺口账本自动化——139 缺口逐条带候选线索 (f67090ac4ff)
- 🐞 Fix:清掉上一枚带进来的 1 个 error + 收口一处既存 eqeqeq (0bb9bfd89c8)
- 🐞 Fix:AGENTS 归档移出被当成丢行 —— 第四态凭据接线补齐(守门 207 第二刀①) (b6023aa977e)
- 🐞 Fix:合并回填本侧独有词条——miniapp 5 语 ×81 键 + mobile-rn 5 语 ×273 键 (2f651b8ce17)
- 🐞 Fix:合并后撞号收敛——check-bare-decode-uri 让出 241(远端已占,check-rn-readout-cell),改号 248;判据与 skipEnv 一字未动 (68c00a3a054)
- 🐞 Fix:端内测试停止越层 import repo-tooling,清偿架构政策 D1/D2 六处 (4e2758c7402)
- 🐞 Fix:207 第二刀票改"未取号"形态——G 族号池 pool-exhausted(占用面含 42 份归档件)，令牌残留是 G-15107 格①用法错，绝不发 1000+ 号；待号池扩容批补号 (87d1f894e76)
- 📚 Docs:登记守门 207 存量清偿第二刀(前置=补 declaredDropCaps 认 AGENTS 归档移出,防回潮吞掉第一刀成果;现读缺 9,156B)——第一刀已落枚 c9c85d63 (5f4bafc4886)
- 📚 Docs:守门 207 存量清偿第一刀——速查区回潮副本 34 行整区移入 archive(125551B→105156B) (c9c85d639c8)
- 🐞 Fix:门 128 两族判据射程差豁免登记 + 门 77 B1 wallboard 圆角绕档清偿 (a35ac94b7df)
- 🐞 Fix:字形箭头与双返回箭头清零——Collapsible 文本字形换矢量图标 + 五 pkg 页摘页内死返回键 (8f26a1f7793)
- 🔧 Chore/Other:门 241 镜像测 T1 前提断言改大小写不敏感 (3a893d14814)
- 📚 Docs:守门 241(裸 decodeURIComponent)R4 点名行 (8ffd95d1dc0)
- 🐞 Fix:移动端行为级深挖批——裸 decodeURIComponent 族 21 处从底层修复 + 守门 241 防回潮 (815bfe638fd)
- 🐞 Fix:RN 样式裸数字回潮锁改号 240→247——远端 f126e734 已占 240(大屏读数不得断行门),合并前让号,判据与 skipEnv 一字未动 (284aa41062d)
- 🔧 Chore/Other:门 240 判据镜像测试——3 例直接 import 源脚本 __test__(§22c,判据零复制),含阳性对照(把 rnSpacing.lg 改回 16 必须被抓) (1dfe636e62e)
- 🚀 Feature/Improvement:新守门 check-bare-decode-uri.mjs 接进提交链 (6a3e148297b)
- 🚀 Feature/Improvement:新增门 240 RN 样式裸数字回潮锁(差值棘轮)+ runner 接线 (d066355a355)
- 📚 Docs:点名门 240 RN 样式裸数字回潮锁(与接线同批;AGENTS.md 超体积预算暂不写入,README 已满足 R4) (d562ca2018d)
- ⚡ Perf:跨端两把尺子改批量取 blob(HEAD 面 4 分钟→17s) + web→RN 尺支持 --full + 6 段 web-only 豁免 (da67136b162)
- 🚀 Feature/Improvement:补 4 条 about 族镜像声明(账本真实化,零行为变化) (f97405f954d)
- 🐞 Fix:web→RN 功能尺三屏误报根治 + 删除一条不存在的 web 路由登记 (89239b8d3e0)
- 🚀 Feature/Improvement:token 化批 #6 第 5 批(收尾)——21 文件裸数字转档 (3d8a7a33557)
- 🚀 Feature/Improvement:token 化批 #6 第 4 批——60 文件裸数字转档 (0088fd044ed)
- 🚀 Feature/Improvement:token 化批 #6 第 2 批——60 文件 1020 处裸数字转档 (5308e7aaf5b)
- 🚀 Feature/Improvement:token 化批 #6 第 1 批——tokens-migrate 扩为目录批量器物 + 60 文件 1583 处裸数字转档 (e506840fc01)
- 🐞 Fix:普查锁两 offender 清零——VoiceNote/LlmSettings 裸 TextInput 迁共享 TextField (e9226cbb507)
- 🐞 Fix:活副本纠偏批——上轮把 account-cancel/app-topup 判死副本是反的:现读 RootNavigator 1037/1048/1087 挂载体=packages/app 版,二屏 Modal 缺 onRequestClose 即安卓返回键在注销确认/充值说明穿透弹退出应用(与 MemoryScreen 同型,补 onCloseModal/onCloseIntro)。privacy 未入本批:终读现场与 HEAD 逐字节一致(我先前的挤行误判与复原互相抵消,无净改动;页码清单无错位,上轮该条定性撤回)。遗留如实:(a)packages/app 两屏标题硬编码(注销账号/充值)属 i18n 队列射程;(b)SDK 清单与 Expo+RN0.86 真栈脱节为法律文案,归机主/法务 (6e5cc2e93be)
- 🐞 Fix:行为级 bug 两枚——① VoiceNote 语音笔记面板:RN 原生 Modal 自成窗口不吃外层 KeyboardAvoidingView,面板内搜索框弹键盘后操作行整块顶出可视区(iOS/小屏安卓必现,Modal 内键盘关不掉)——避让容器移进 Modal 内侧,iOS padding/安卓 height;② packages/app MemoryScreen 新建记忆 Modal 缺 onRequestClose:Android 返回键不关弹层反弹确认退出——与右上角取消同语义接回 onCloseCreate。定性:account-cancel/AppTopup 两份 packages/app 旧身=死副本(消费方全指端内键化版,守门不判红)不代删除按§7归包持有人;auth.ts login 抛错为设计契约调用方统一兜;VoiceNote 已有 onRequestClose 不重复补。验证:RN tsc 0 错、vn-mount 13/13、eslint 0、水印 2/2 (60e2c900998)
- 🔧 Chore/Other:F9 分批收敛 #5(终)——CSRF 行 G-12→G-02、两版F5 行 G-30→G-18(双侧真声明位零 + 239 归档 marks 过滤验证);五门现读全绿(strict F9 0 组/234 warn/239 0/211 0/13d 0/71 无丢失)——机主授权合并背景 (87338aa530c)
- 🐞 Fix:auth.ts 支付宝回包防护补丁自纠——上一枚提交里 info 类型注多套了一层 .response(TS2339 ×2,miniapp tsc 当场红),语义层级回归 parse→.response→{nickName,avatar} 真形 (20c8ba1c13f)
- 🐞 Fix:逻辑级 bug 三枚——①充值自定义金额 Number('9.9')*100 浮点毛刺直进支付订单(分语义被打成 990.0000000000002),对齐 CartScreen 既有 Math.round 范式;②credential-storage 裸 JSON.parse:AsyncStorage 半截写/手改/回滚脏数据在启动链抛 SyntaxError 打断记住账号预填,降级为无记录(后续 persistedAccount 覆盖);③miniapp 支付宝 getOpenUserInfo 取消/异常回包 response 非 JSON 时裸 parse 打崩整条登录链,降级空资料走既有手动补路径。定性留档:定时器清理全配对/formatDateByTemplate 带 tz+NaN 守卫/totalFee 经 zod int 非空/支付按钮走 paying 锁+disabled——四类候选核实为健;Clipboard try 豁免=RN API 不抛;CONTEXT 崩溃上报未脱敏一条已漂移(现码过 redactCrashText) (92e31d50fae)
- 🔧 Chore/Other:F9 分批收敛 #4 终版——Agent SDK 票:原 G-06 行插回存续(门 71 编号行不丢)+ 行尾让号注记 + 未取号行承载实际推进(行内交代归属=qoder-maxpar)+ 旧 G-36 双行摘除留痕 + merge-live-doc 归并(lost=0);五门现读全绿(71 无丢失/239 0/211 0/13d F10 2→2/234 warn)——机主授权合并背景 (688b7ce6bec)
- 🐞 Fix:backup-pg-local 追到断链根因——pg tooling 已迁 D:\ihui-pg\16(服务镜像为证),脚本写死旧卷 D:\DevEnv\runtimes\pgsql 失踪后,wscript 启动的计划任务看不到 pwsh 的 CommandNotFound ⇒ 本地 dump 静默停摆一个月(P7 只量到副本侧,源侧 P5 格当时未判定)。路径更新 + 新增'pg_dump 不在位必写 backup.log 再退'守卫——停摆必须留下可被人量到的痕迹,任务面 Last Result 0 是谎。实证:修复后手跑 EXIT=0,backup.log 落 10-25 01:16 OK 9.6MB 新行 (de4073ff047)
- 🔧 Chore/Other:F9 分批收敛 #3——取号器行 G-48→G-90(G-48 被远端新纪元 F1不认行占用,重让;PLAN 全文零出现的 G-90 空投)——五门现读全绿(strict F9 撞号 0 组/234 warn/239 0/211 0/13d 0) (73c966154a6)
- 🔧 Chore/Other:F9 分批收敛 #2——取号器行 G-48(远端占用,重让)→G-183 链理正 + 侧车按真实 compositeKey 全量重建(5 条;234 warn a1=0 a2=0/211 0/13d F10 0/239 0/plan-gate strict F9 撞号 0 组)——机主授权合并背景 (a056001ebfd)
- 🔧 Chore/Other:F9 分批收敛 #1 终——L28868→G-48/L28888→G-50/L29002→G-90/L29063→G-26/G-880 误改恢复/G-183 误改恢复;L29068 回退原号 G-18(远端键位零)+G-18 侧车补;六组侧车按真实 compositeKey 重写(234 warn a1=0 a2=0/13d F10 0/239 归档单调 0/211 号池 0)——机主授权合并背景,逐行留痕 (45254bd876b)
- 🐞 Fix:course-planet loadData deps 剔无用 tt(体内未引用,判据面 JSX 层独立吃,exhaustive-deps warning 清零)+ tailwind.config 头注版本事实修正(现读:声明 v3 仅服务 preset 工具链,产物引擎=weapp-tw@5.2.9 vendored v4,alpha 原生生效——漂移注释清);验证:miniapp 端内 eslint 首次 --max-warnings 0 exit 0 (25817edb687)
- 🔧 Chore/Other:F9 分批收敛 #1 终版——本地 5 行键位改号到验证组合(G-48/G-50/G-90/G-26/G-09;G-880 误改恢复;G-183 误改恢复)+ 侧车 6 条按真实 compositeKey 重写(234 a1=0 a2=0/239 归档单调 0/211 号池 0/13d F10 0/plan-gate F9 撞号 0 组,五门现读全绿)——机主授权合并背景,逐行留痕 (12a9581f6a0)

**2026-10-24**
- 🔧 Chore/Other:navbar-no-chrome 补 i18n mock——NavBar 在 i18n 扫尾批起吃 useI18n,裸 render 抛「must be used within I18nProvider」整文件稳定红(全量两轮复跑 1/1 坐实,非 flake;与 fenlei-overlay 同治,判据只量根元素样式不涉文案) (e8c502633e8)
- 🐞 Fix:门77 B1 终清+门150 弱证据 web 两站归档(wallboard 条形帽 3px→2 就近档;wb-panel 根容器 lg→xl 跟 panel 角色;PiP card 容器 md→lg)——移动端收官顺手清全仓 UI 档残余 (d5fe70025bf)
- 🔧 Chore/Other:F9 分批收敛 #1——本地 5 行键位改号到远端零键位号(G-08→G-48/G-09→G-50/G-12→G-90/G-12→G-26/G-09→G-37;G-880 误改恢复)+ 侧车 5 条按真实键重写(234 a1=0 a2=0/211 差值 0/13d F10 0/239 归档单调 0/plan-gate F9 撞号 0 组现读)——机主授权合并背景 (58e51c9b2e8)
- 🐞 Fix:移动端第三轮收官——中文/半翻译残留 82 站清零 + D43 首页语音笔记挂载落账 + 门150 弱证据移动端 6 站归档 (dc9667c1607)
- 🔧 Chore/Other:F9 撞号 6 组人工键位裁决改号(G-32/14/53/20/18/D18 → 池内新纪元两位号 G-01..G-07)+ 副本行标记 + 7 行侧车记录补齐(234 a1=0 a2=0;211 号池差值 0)——机主授权合并背景;逐行带原号留痕注记 (2d30287aad1)
- 🐞 Fix:ScreenStates 空态圆章真圆写法改 50%(守门 77 B1 认可的几何真圆形;64/2 表达式被 B9 求值判超上限,同形百分比是门自带出口) (3ffd223f896)
- 🐞 Fix:移动端跨端观感修复批——四件套骨架屏尺寸减半(用户可见)+圆角角色档 43 站收口(守门 77/150 在册红) (a1de25ce244)
- 🐞 Fix:清两处合并连带的死导入(AgentSettingScreen ActivityIndicator / OrderScreen TouchableOpacity,HEAD 面已红即合并 auto-merge 产物,未用导入删除无行为变化)——解锁 push 全量 typecheck 门 (76ab1465061)
- 🐞 Fix:修复合并连带损伤——NotificationPanel formatPushTime 内 Date 变量撞名参数 t(改 dt)+ useI18n import 补位 + 签名对齐 useI18n;原 push 门全量 typecheck 红因;验证:eslint 0/该文件 typecheck 清/水印完好 (1a3295d1de0)
- 🐞 Fix:移动端 typecheck 清零批次——i18n 提取残骸 36 文件/119 错修复 + 测试滞后 12 红 + 顶栏两截带一枚 (fc5925035e5)
- 🔧 Chore/Other:收敛 origin/main(2026-10-24 编号新纪元)——PROJECT_PLAN 取远端重排版(旧卷全文已由远端 renumber-snapshot 归档,零丢失;goal 十四枚提交未触碰 PLAN);代码文件 auto-merge;机主授权合并 (7fb7e5e52fa)
- 🐞 Fix:补落第二枚遗漏的 8 文件——5 共享屏(console-table/switch-prefs/user-public/llm-settings/edu-shop)与 3 小程序镜像页(pkg-user/user-public、pkg-user/llm-settings、pkg-shop/edu-shop);第二枚重跑时目录参数展开失败致漏(index.ts/app.config 已引用它们,干净检出必断,本地工作树假绿掩盖);验证:eslint 0/typecheck 零错/水印 verify 完好 (41d84097bbc)
- 🔧 Chore/Other:screen-registry 三元组补登 3 条——UserPublic/LlmSettings/EduShop(shared/rn/miniapp 三端齐,goal 新屏首批评入镜像登记链);门 screen-coverage HEAD 面现读 71 条全真、镜像 72/213,新 3 条落地后 75/215 (aaad6357153)
- 🚀 Feature/Improvement:存量 token 化批 #5(长尾)——四屏 69 处(ChangePwd 12/ChatRoom 19/LecturerList 15/Publish 23);验证:eslint 0/typecheck 零错/水印 verify 完好;token 化累计 30 屏 885 处 (45b3c6bc35d)
- 🚀 Feature/Improvement:存量 token 化批 #4——七屏 218 处(StudyIndex 45/Promote 33/LiveDetail 38/Settings 24/SelfMedia 23/VipTrader 33/EarnCommission 22);验证:eslint 0/typecheck 零错/水印 verify 完好;token 化累计 26 屏 816 处,15+ 裸行档清零 (5a89172e0d9)
- 📚 Docs:D17 生态统一入口结清翻勾(内容锚:「D17 生态统一入口装车」提交=page+hub+nav+五语 ecosystem 37 键 empty0+nav.ecosystemHub×5;现读 check-i18n-keys 19127 键 parity OK+hub 测试 16/16;语言包占写已解除)✅(2026-10-24) (49ef8ccb886)
- 🚀 Feature/Improvement:存量 token 化批 #3——六屏 203 处(Points 24/Memory 45/AppTopup 27/WrongQuestions 29/AiWorld 45/Plaza 33);验证:eslint 0/typecheck 零错/水印 verify 完好;token 化累计 19 屏 598 处 (89aba90a012)
- 🚀 Feature/Improvement:存量 token 化批 #2——六屏批量转写(ConversationImport 23/LecturerDetail 27/CourseTab 45/AiGroup 55/ImageGenTemplates 29/ModelIncome 42 共 221 处)+ 转写器 ensureImport 增强(import 检测改在 design-tokens import 语句内做,根治正文已含 token 名时的漏补);验证:eslint 0/typecheck 零错/水印 verify 完好;token 化累计 13 屏 395 处 (f03953d525c)
- 📚 Docs:G-959/G-865 结清翻勾(现读证据:app-login sso 键化+shared 五语+守门测试 16/16 · DEFAULT_AVATAR_URL 死键已摘+两测试同批改净)✅(2026-10-24) (81f16bbaffc)
- 🚀 Feature/Improvement:存量 token 化批 #1——批量转写器 scripts/tokens-migrate.mjs(裸数字→rnSpacing/rnType 档,恰在档才换不硬凑,自检 6/6)+ LoginScreen 首屏 65 处转写;验证:eslint 0/typecheck 零错/水印完好;工具可复用到全部存量屏 (ccd9fb1624e)
- 🚀 Feature/Improvement:edu-management 族小程序镜像批——考勤/成绩/缴费三页(pkg-user/edu-mgmt-*,复用 edu-child/records-page 共享渲染件)+ app.config 注册 + miniapp 五语言(eduMgmt 3 + eduFinance 9 含状态枚举 + eduGrades 正名);验证:eslint 0×3/miniapp typecheck 零错/水印完好;镜像累计 14 页 (26fc056da64)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (92f382ef86b)
- 🚀 Feature/Improvement:children 六子页小程序镜像批——共享渲染件 records-page(列驱动卡片列表,对齐 RN ConsoleTable 模式)+ 六薄壳(课表/考勤/成绩/餐食/账单/学习计划,参数 childId)+ app.config 注册 + miniapp 五语言 edu 族键组(eduChildAttendance/eduGrades/eduAttendance 等 4 组 + statusTitle/empty);家长端小程序闭环(首页→六子页);验证:eslint 0×7/miniapp typecheck 全零/水印完好;镜像累计 11 页 (01bb3b47a8f)
- 🚀 Feature/Improvement:小程序镜像批 #2——家长端首页(pkg-user/edu-parent,孩子卡片列表+状态徽章,对齐 RN EduParentScreen;children 子页镜像排后续)+ app.config 注册 + miniapp 五语言 eduParent 10 键;验证:eslint 0/typecheck 零错/水印完好;镜像累计 5 页 (2ceb517ea6e)
- 🔧 Chore/Other:对账尺登记批——edu 族 18 条 aligned 入账(edu-management 7 + parent/children 9 + user/[id]/settings/llm/edu/shop 落地补登);worktree 面现读 aligned 142/缺口 355/零腐烂 (4b5234a9081)
- 🚀 Feature/Improvement:goal 教育域批——edu-management 可列表承载面全落地(考勤/成绩/班级/缴费/餐次模板/校园课表/教师排班 7 页)+ 家长端闭环(首页/绑定 CRUD/children 六子页)+ EduParent 六键导航;全部 ConsoleTable 杠杆薄壳 + 五语言 i18n(edu 族 12 键组);验证:eslint 0×18/typecheck 本轮零错/水印 verify 完好 (c1712deb254)
- 🔧 Chore/Other:vip/success 时长三连裸串接 tt('vip.success.daysUnit') + 词包五语 {n} 天键 (73dae30a4ee)
- ♻️ Refactor:批131 · AgentShopList emptyText 默认参拆雷(全仓可接面清零收口枚) (c51ca43ae95)
- ♻️ Refactor:批130 尾修 4 处 appAlert 第一参变体(AccountCancel/ChangePwd) (a9d478aa0de)
- ♻️ Refactor:批130 硬编码中文清零(6 文件 / 90+ 处) (80ec061080a)
- 🚀 Feature/Improvement:批130 入典(88 组新键 ×5 · chat.msg/toolbar/topup/confirm/sr/dist 族) (f2673153bd8)
- ♻️ Refactor:批129 硬编码中文清零(5 文件 / 90+ 处) (3ff73743771)
- 🚀 Feature/Improvement:批129 入典(74 组新键 ×5 · need/news/iaa/bab/vip 族+common.known) (a2f2edbfa26)
- ♻️ Refactor:批128 硬编码中文清零(6 文件 / 80+ 处) (3694083f708)
- 🚀 Feature/Improvement:批128 入典(65+ 组新键 ×5 · subPkg/account/share/lp/annot/aigcList 族+补 courseDesc) (fd6316a81a4)
- ♻️ Refactor:批127 硬编码中文清零(11 文件 / 90+ 处) (36398ccb1ae)
- 🚀 Feature/Improvement:批127 入典(110+ 组新键 ×5) (9af71a11bc5)
- 🚀 Feature/Improvement:批127 W1 入典(23 组新键 ×5) (5926d858a3e)
- 🚀 Feature/Improvement:goal 应用批——RN 六屏 token 化(109 处 rnSpacing/rnType/rnRadius 档)+ 9 张 RN 屏四件套(他人主页/BYOK/教育商城/控制台六页,ConsoleTable/SwitchPrefs 两杠杆屏)+ 小程序镜像三页(三新屏三端闭合)+ 小程序提现页语义档 + RootNavigator 九路由 + miniapp 五语言键组;验证:eslint 0/typecheck 本轮零错/水印完好/i18n parity OK (47e3b46cc51)
- ♻️ Refactor:批 126 硬编码中文清零(Menu 8 项表转键/Notification 时间族/PushBanner 回落/VoiceInput 全组) (3785cb014f6)
- 🚀 Feature/Improvement:批 126 入典(22 组新键 ×5) (62378825a29)
- ♻️ Refactor:批 125 硬编码中文清零(9 文件 / 60+ 处,组件批收官) (593cb4ec619)
- 🚀 Feature/Improvement:批 125 入典(29 组新键 ×5) (ad22965d3cd)
- ♻️ Refactor:批 124 硬编码中文清零(13 文件 / 55 处 · RN 端 UI 串清零收官批) (bd0dfe0c8b7)
- 🚀 Feature/Improvement:批 124 入典(37 组新键 ×5) (cda81d5afee)
- ♻️ Refactor:批 123 硬编码中文清零(13 文件 / 40+ 处,含 3 张顶层表转键) (aecd7c7a30f)
- 🚀 Feature/Improvement:批 123 入典(35 组新键 ×5,含工具三态状态词五语同批) (a43b9ae9895)

**2026-10-25**
- 🚀 Feature/Improvement:auto-evolve 起会话通路端到端打通(O65 第 0 期收尾:JWT 现签 + --probe 自检 + 真派验证) (87a7713ccd1)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1081dca6e13)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (194de047081)
- 🚀 Feature/Improvement:O65 第 0 期翻勾(调度器+四道闸随批完成,验收证据入注记;代码枚 0e4bd3628db);1-3 期补立档日期交代(三选一:新鲜日期,按依赖序排队) (b1ffbc4b23c)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (ab3bc7beb43)

**2026-10-25**
- 🚀 Feature/Improvement:auto-evolve 自进化调度器第 0 期落地(总纲 O65·调度层+四道闸) (0e4bd3628db)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (0166713afdc)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7faaebcc512)

**2026-10-25**
- 🚀 Feature/Improvement:登记 AI 自进化调度系统 auto-evolve 四期系列总纲(O65;第 0 期调度器+四道闸随批施工,感知/部署/回流三期按依赖序排队) (164b973cfe7)
- 🚀 Feature/Improvement:G-217a 点赞/收藏两表唯一键迁移 —— zhs_agent_thumbs/zhs_agent_collect 加 (uuid,bot_id) UNIQUE,把上一批(22ee752721b)靠事务 FOR UPDATE 父行的防重底线放进库层:2026-10-25 实测该族缺陷正是『一次点赞计数+2、取消只减一次』,应用层锁管住今天的写口,管不住未来绕事务的批量导入/人工修数(无约束=漂移只在计数与明细分叉后暴露,而全仓无 count(*) 对账)。线上两表 0 行,零回填成本。手写迁移口径(sql+journal,idx 343)+水印,同 20261026100000_command_ack_facts 批形制;旧普通索引保留不删(一次提交一件事,删索引是另一票)。验证:check-migration-immutable 绿(存量基线报警为门内只报数项,非本枚引入)、database tsc 0 错、likes-routes 回归 8/8 绿。 (c92836e7e78)

**2026-10-25**
- 🔧 Chore/Other:refactor(web,mobile-rn,miniapp)+feat(gates): 显示层分→元格式化同形副本 20 处收口 formatPrice 唯一出口 + 装守门 248 —— fmtYuan=¥\.toFixed(2) 一族在 HEAD 逐字复制(web12+app2+enterprise×2+formatYuan+toYuan 共 20 处):改一处单位口径须 20 处手改,漏一处=那端页 100 倍显示事故(分销族 46758b5b2b8 批修的同型受害者)。全量委托 @ihui/shared/utils formatPrice(非有限回 0.00,定长两位,¥ 前缀归调用面维持版式)。刻意出射程(行为不同非复制):ai-pricing maximumFractionDigits:4 定价展示、purchase/helpers 动态位数 formatCents、局部常量行(M2 只报数)、返回 number 的数字换算。守门 248(blocking,stagedTriggers=显示层四端):M1 展示型自算定义绝对零容忍(存量本波清零;委托转发合法,定罪看实现,与日界闸 246 同口径)/M2 行内定长格式化按文件 HEAD 差值棘轮/M3 装车(importer 20);self-test 10 例成对夹具+镜像 3 例(全显示层 0 违规扫),门体先经 eslint 定责一轮(死常量/eqeqeq 两错已修)。AGENTS 点名 248(R4),并顺手为别席在飞的 registry 哨兵闸补 R4 点名行(照 runner/guardian 接线原样,该闸文档隐形会挡所有提交链)。AGENTS 先过 merge-live-doc 归并(lost=0)。验证:eslint 涉改文件预跑 0 问题,gate worktree 三面绿,miniapp 1032+mobile-rn 1185 例全绿,web/miniapp/rn typecheck 我文件 0 错(web 余 openDockedTab 三文件红=别席 work-panel 在飞面)。 (0d2a23f9701)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1d8116c1b96)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (dd997d68b7f)
- 🐞 Fix:收敛预解第二轮 —— G-55 就地翻为对侧结算行(四项已在库,本席==基底旧态由本行承让),删除尾部 dump 区的守门 89 R9 重复块(首份完整保留) —— 为 union-converge 预解 F1 最后一组与 F6 最后一块;两侧独有行零损失由 union 模拟 REG=[] 现证 (07ea442ded4)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2f39e473afd)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (23eadba0af1)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4ecb0c164b4)
- 🔧 Chore/Other:结清 USDT TRC20 收款地址票(两行同题)——根 .env 与 apps/api/.env 现读均已按票面决策填入 sponsor 页同值,TRON 正则与 assertUsdtAddressFormat 两调用点在位;ERC20 并存不收敛为已裁结论。凭据:脱敏比对逐字相等(长度三十四/前缀 TMtT/后缀 MnbG)。 (2dffc2434db)
- 🐞 Fix:teardown 默认翻为跳过 cleanup——共享库测试用户被并发裸跑删除当日两次复发;E2E_AUTO_CLEANUP=1 显式启用才清理(CI 本就显式 '0' 于 e2e.yml:225,零消费方依赖默认清理);交错型并发(对方跑完清理的瞬间本席浏览器未起)是 hasConcurrentPlaywright 拦不住的形态,故默认不删;手动清理出口 node apps/api/scripts/cleanup-test-users.mjs 不变 (886eae6992d)
- 🐞 Fix:OpenAPI 契约产物同步今日补建的两条绑定路由 (462044fe47a)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2110948b96b)
- 📚 Docs:D04 登记验收面进展(浏览器级五例已入库,枚 4c80bf75db418f70d1b3fcf374efc2d845594cdd)—— 取证与剩余格按 §1 只进那枚提交信息,本行不翻勾(票面③规模化未动) (47b9db9f93e)
- 🔧 Chore/Other:侧车reclassify终批——7键出等条件桶(G-03/G-20/G-100/G-46归他席与机主面,O02/G-50/G-74出桶),v2尺等条件归零 (8e681cfb073)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (59f1476f951)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1614f18a56b)
- 🔧 Chore/Other:等条件禁令清偿收尾——末批摘行5枚(④/需真机副本/D19/H01/冷启动盘点,f12-purge留痕;union带回尾巴清零)⇒散文尺等条件全清 (9b53fd05d0b)
- 🔧 Chore/Other:goal-r4 结清长会话滚动四维活账——r3e 判据三件齐:四维权名(映射 spec 断言)+可跑自验命令(supply 入口)+实测 rc=0(真浏览器 9 passed 2.3m);副本 L7663 已由他席结为指针 (12391049ef8)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b5d3110debb)
- 🔧 Chore/Other:去重 机器可见的欠账清单(三路并行审计产出)2026-10-24 逐条核账 副本行改为指向主行短指针(禁手写归并注记) (5fdb7afd772)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6fc06bf1bbd)
- 🔧 Chore/Other:goal-r4 结清 TEMP 等环境票——分叉已消(HKCU 现读标准值 D:/DevEnv/Temp)+夹具门现跑 rc=0 红线 0;LocalSystem 面按 §26 显式指定目录既有口径 (ef98e4083ec)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (24f139c94f9)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (95f05275536)
- 🔧 Chore/Other:D04 消息串内富文本锚点补浏览器级验收面(五例真跑全绿) (4c80bf75db4)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d3aeebebc76)
- 🔧 Chore/Other:goal-r4 结清 AGENTS 体积判据接链票——前提过时:门 207 已 blocking 装车(runner:4891 现读,stagedTriggers=AGENTS.md),注册表按域拆分条件随装车消散 (b4b7f052980)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (74ddef1c3d0)
- 🔧 Chore/Other:G-1102638 批1 同主键副本行物理归并 — 删 7 行(机主拍板〔拍板@2026-10-08 机主:真删+立即执行〕;幸存者规则与F4同向;落账注记行保留待批2;复跑auditPlan对账F1=0/F9不增;逐行留痕 .ihui-agent/archive/PROJECT_PLAN_copy-purge-2026-10-25.md) (6426b6134e9)
- 🔧 Chore/Other:G-1102638 批1 同主键副本行物理归并 — 删 7 行(机主拍板〔拍板@2026-10-08 机主:真删+立即执行〕;幸存者规则与F4同向;落账注记行保留待批2;复跑auditPlan对账F1=0/F9不增;逐行留痕 .ihui-agent/archive/PROJECT_PLAN_copy-purge-2026-10-25.md) (606f93a250c)
- 🔧 Chore/Other:等条件禁令清偿——散文尺清零批(摘行12留痕f12-purge+改写出桶+dispositionOf等段占位修复'—'=无等待);门245复跑器exit2为枚举0份的未判定假红,手动全量档rc=0绿,按AGENTS§16显式说明提交;G-74 env已落地确认、G-96微信IDE CLI预览出码结清 (5f92e70b33d)
- 🐞 Fix:ui-routes 派生产物写回 + relay 脚本错误文案有界化 (3e4bbfc3c07)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7f3497e3621)
- 🔧 Chore/Other:r4c 给 D04 加现读证据注记(租约保留,未翻勾) (5fa5190a358)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (f15d53dd3bb)
- 🔧 Chore/Other:r4c 认领 D04 富文本动作锚点(qoder-claimfix 释放票,加租约) (9612eb02196)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b88a7e4e023)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (ba8a12ea2a2)
- 🔧 Chore/Other:r4b 结清 G-29 带值旗标普查票(翻勾 + 证据注记) (70bf04ae5c6)
- 🐞 Fix:收编器加滞后副本守卫,防把旁路落地成果按滞后工作树副本写回旧版 —— 判据:工作树 blob != HEAD 且 == 该路径某祖先 blob ⇒ 跳过并点名(取不到探针一律 fail-open);立因=2026-10-25 实测 16576ffa0d 在同一文件回退绑定手机/邮箱端点 88 行与门 198 updatedAt 出口形态两处,HEAD 面行为锁 7/7 全红;纯判据 partitionStaleCopies + 镜像测试 6/6(含 fail-open/混批/装车锁),node --check 与 --dry-run RC=0 (508cb8c11ff)
- 🔧 Chore/Other:G-29 旗标单源收口第四批两站(站点 31→29) (179fc770b5a)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (387b2abaace)
- 🔧 Chore/Other:零改动结清 4 票(键名对齐保全/上游两票本仓已落/门13d判据已立)——凭据:e09d866222f8151a6b78278fb8bef3371872907d(apiKeyPerms 63 键五语言 parity OK)、8894762aed0a025e668e3714728528a1667abc2b(HostTurnFault)、aefe7b14c6119a18da52f608eeb563767c1123c3(ApprovalGenerationCas 双 reasonCode)、check-plan-dup-pointer-ratchet 维③ NOTE_TOKEN_SRC+redundantNoteCountInLine 已立(--self-test 8/8);门13d 存量 6 份均在折并引文内属观察不占票;取消信号行已由他席同日翻勾故不在本批 (0acb63b0a88)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (bd163622b33)
- 🔧 Chore/Other:goal-r4 结清取消信号穿压缩票——压缩/钩子/session_start 三件均已 _wait_interruptible 包裹(G-815970 主刀+10-24 补刀,现读 4+ 包裹点),机制=轮询+task.cancel 真实退出强于内部检查型;MCP init 在本架构无对应等待点;行面前提读数过时 (f924df03b4d)
- 🔧 Chore/Other:G-29 旗标单源收口第三批两站(站点 33→31) (8d9de275cc6)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5397d6febcc)
- 🔧 Chore/Other:goal-r4 结清守门8假绿灯票——前持席已收官约束失效,三条产生路径全部查清(①路由从未注册+alias 过近似 ②在册但运行面 404 部署态 ③cozeZhsApi 前缀归一+边缘改写派生),修正按票面归扩面批次,本票不改判据 (1d5e73e2d34)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (9b8c758945a)
- 🔧 Chore/Other:零改动结清 --allow-dangerous 确认旁路票——前提被 danger-gate 收口推翻:策略唯一出口=tools/danger-gate.ts(调用方只注入 prompt/观察口),三宿主均经 buildAgentDangerGate/createAuditedDangerGate 构造;apps/cli 危险门三条接线锁本轮 33/33 绿,W1 棘轮就地旁路现值仅 config-cmd.ts 的配置键 getter 1 处(非放行决策);票面行号已漂按内容锚点改判 (eaba6379cd9)
- 🔧 Chore/Other:G-29 旗标单源收口第二批两站(站点 36→33) (10a28983111)
- ♻️ Refactor:再摘十四枚 plugins-data 死副本(曾被批量提交整批带回) (f2402b15035)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b0e66070762)
- 🔧 Chore/Other:goal-r4 结清合流吞没票——两层建议已有更强实现:union-converge 落地前吞并判红(三型夹具)+门100/168 提交时拦(现跑 rc=0,--move 11/11)+证据案例族被守门91钉死(现跑 0 违规) (ed6067dde4c)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (0f44f58f420)
- 🔧 Chore/Other:零改动结清 3 票(窗格续传×2 孪生/工具面板开关窗格化)——凭据=56735273286b5f258bed90a714ca228bf6c3561a 与 5978933ee6bf06620e317439353efc33ac961a86 均在 HEAD 祖先链,本轮现读内容锚点仍在:pane-split.ts 的 PANE_SPLIT_PERSIST_KEY/rehydratePaneSplitLayout、chat-pane-body.tsx 的 shouldPrefillRecentMessages、usePaneAiToolsPanelStore 禁回落根单例;三行零改动,孪生副本同据结清;工具面板'独立 split 叶'观察不占票 (7eaa8a1f649)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (0f3a333e8a8)
- 🔧 Chore/Other:goal-r4 结清 P2-13③ 孪生两行——prod-bundle 诊断链已全额交付且影子门三对逐字节等值(采集库补齐三输入+失败点接线+结果落盘三形态),现读凭据入行内注记 (094181c956a)
- 🔧 Chore/Other:G-29 旗标单源收口三站(吞值判死,站点 39→36) (f2b549a2ea2)
- 🐞 Fix:恢复被 auto 收编按滞留工作树副本回退的两处已入库修复 —— ① compat 绑定手机/邮箱端点整块 88 行(c87193d5c0;恢复前 HEAD 面行为锁 7/7 全 404 红,恢复后 7/7 绿)② 门 198 updatedAt 出口形态两处(b0802ff9bf);内容取回退前 16576ffa0d^,行级声明 removed=2/added=88 逐行对账;api typecheck RC=0 (bb883c8c4eb)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5620df43a2f)
- 🐞 Fix:墙板页提交树内 Git 冲突标记清零并补回合并吞掉的 userGrowthOption (57d95110fdc)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (17d9b20c463)
- 🔧 Chore/Other:守门134第二格整票零改动结清(①触发条件未达 ②updated/created 已入键族) (a648e79f913)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a27f73951fa)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2b3ff5b11b6)
- 🔧 Chore/Other:号池凭证到期字段票的旧未勾副本零改动复结 (4019b32c69c)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a710d0c6367)
- 🔧 Chore/Other:goal-r4 结清 G-24——重定范围核验:三页+知识库登录态门已在 HEAD(现读各 4 处 authGate,同型 215 页),sidebar-chat-history 已消失前提过时;先前查空系行内路径带陈旧 src/ 前缀 (69b778e669a)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8f1987a1364)
- 🔧 Chore/Other:服务运行时代码新鲜度 dot-source 维零改动结清(7801) (e563aa2c853)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (34e204d9852)
- 🔧 Chore/Other:goal-r4 第三波结清 6 行——Esc 三副本(10-23 四要件结清,凭据 30db9bd97b 祖先+双 spec 在库)/真机走查(两修一误报,凭据 84583fdf6+26cf923961)/prod-bundle(S9 结清,影子门现读 14 对等值)/四件拍板(r27 波结清,mail 鉴权与版式消亡现读在位) (3247fd2355e)
- 🔧 Chore/Other:relay-reencrypt-keys 补 §22d 入口守卫(门194 存量 1→0) (392ea7625c5)
- 🐞 Fix:小程序/扩展两端 I18nProvider context value 定身 + 各装回归锁(母型缺陷跨端同步收口) (30565b6f8e3)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (cb981dd52cb)
- 🔧 Chore/Other:goal-r4 结清 3 票(守门91债/G-27盘点/allow-dangerous观察)——证据均本轮现读:守门91与守门12现跑0违规、gitdir硬编码0命中、旁路事实在位;G-24票面三页已从HEAD消失需重定范围故不结 (c9a13dad884)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8223205b06c)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8e6f8ec1424)
- 🔧 Chore/Other:清偿 miniapp 死键 deventerModeledit.q7(提交收费配置,五语言各删 1 行,按守门 KR 口径登记 5 条移除声明) —— DEPARTMENTS 只取 q1-q5、q6 由 :99 错误日志消费,q7 零引用;重生成 3 gen.ts + 4 b64 与 ui-routes pin 元数据 (8e030dea7b4)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3d4b8cebcab)
- 🔧 Chore/Other:goal-r4 复翻 8 枚今日回潮复活体(G-35/G-61/G-76/G-807/G-939/发丝线/锁初始化/O-1)——凭据逐条核验:8 枚结清提交均为 HEAD 祖先,锁初始化另现跑 15/15 绿;读取数与凭据见各行复翻注记 (136f2cab0d1)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b39c7b9ed7e)
- 🔧 Chore/Other:chore/fix(plan): r3e 核验等条件桶-补现读实测值/修正stale判据(0结清6改写) (c54fba94d5d)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2e22a31f974)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2a0af4e0b1e)
- 🔧 Chore/Other:H02 复翻——回潮体复结(auto-collector union 滞后工作树副本曾把 a6c3c036be 的翻勾写回未勾态;三面已刷齐疗法落地);裁决同前:全仓零声明⇒结构性无样本,闸门不开,只记不挡维持 (eff4b6d5bd4)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b907745ef12)
- 🔧 Chore/Other:G-01 远端 CI 现读对账(53094555 上 4红/2进行中/9绿:i18n 两枚判清、OpenAPI 已被并发删除解、ruff/RN 已修、Knip 另席);O02 门128 两格判据补齐+SC1转绿+T8两项取证(待裁 LoginPopUp 40/44 与 RD 16 档) (b7cdf9c74df)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (41baa72b164)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (869f330a786)
- 🔧 Chore/Other:为 mobile-rn 端登记 topic.detail.loading 形状键契约(c72a93dda9 跨端同屏同字补键;本端由 topic-detail-screen-render.test USED 清单钉住 15 键,单删即 5 红) —— 三条 evidence 按 HEAD 面可核验 (a49c6b729b0)

**2026-10-25**
- 🐞 Fix:在途请求覆盖新态四格根治(前端清单收尾批)+形状锁 —— ① TrendChartDialog:弹窗重开/换 itemId/换窗口连发,慢的旧窗口响应覆盖新曲线且旧 finally 提前熄灭 loading;② learn/topic 付费课:切课时旧列表迟到响应串进新页;③ ide/mcp-pane DetailPanel:常驻不重挂载,切换选中项时迟到详情张冠李戴;④ ModelDetailDialog 行过滤 .filter((r)=>r.value) 把合法 0(免费模型 inputPrice/outputPrice=0)当缺失吞整行,读作『无此项』——改判 !=null && !==''。竞态窗口在微任务时序,jsdom 行为锁必 flaky ⇒ 按 race 家族既定口径钉形状:fetch-sequence-guards.node-test.mjs 四真组件逐一体检(序号自增+写前复核+ModelDetail 两向)+成对夹具(摘守卫翻红 6/6 绿);形状搬家 assert fail 报『锁要跟着搬家』防静默失配。验证:apps/web tsc 我文件 0 错(仓内余 3 红=checkin/GlobalTopBar/web-work-panel 属别席 ca6995 收编批残留,非本批),node --test 6/6。 (5e1978b98af)

**2026-10-25**
- 🐞 Fix:三方归并预解——增长图取对侧 57d951 柱形新形态,本席重排保留,并全文件格式归位 —— 别席线形图(1fb44)与对侧柱形图(57d9=14 根太密⇒interval:2/纯柱形/柱顶不标数)是同功能两种写法,取新者;重排四档(wb-prio-user/ai/traffic/trend)+KPI 双卡前置+业务面板用户三格提首/接口排行下移,均在对侧底版上三方重放(merge-file,唯一冲突=图定义二选一,已按裁决留柱形)。验证:prettier --check RC=0(本席 3083b39 未走钩子的格式存量一并归零)、水印零宽链完好 verify 绿、门 240 --worktree R1-R8 全绿、vitest wallboard 2 文件 11 例全绿、tsc 墙板 0 错(仅存三枚别席在飞红点名不代治)、KPI 卡序 users>ai>qps>err>p95>turnover 现读。为 git-sync-converge 的 --resolve 页面路径预解:本面已含两侧全部独有行(对侧逐字打底),收敛无需人工 (584041c957e)
- 🐞 Fix:重锚机主 2026-10-25 定档首屏重排 + 补回被连带洗掉的增长曲线定义 —— 别席 ca6995ca20b(自动收编在飞副本)把 page.tsx 从「639bd 重排 + 1fb44 增长图」形态写回旧两档编排,并丢了 userGrowthOption 的 useMemo 定义(2219 行用法仍在 => tsc TS2304)。本枚按 639bd7f7797 底稿在现 HEAD 上重落:KPI 带「用户/AI调用」两卡前置到最左(用户卡 sub 今日新增=增长读数);面板业务纵深 wb-prio-user(-40)、AI 号池 wb-prio-ai(-30)、访客与机器人 wb-prio-traffic(-20)、流量趋势 wb-prio-trend(-10),四档两两不等防同值静默回落;业务面板内用户三格提为第一眼读数、接口调用排行下移至签到块之后(14 日增长曲线随位保留);WALLBOARD_CSS 四档定义与编排注释同批,其余面板 order-1 形态不动;userGrowthOption 定义块从 1fb444802bc 逐字恢复(复活行=本票有意重落,走 LAND_ALLOW_STALE 留痕,非滞后副本误带)。验证:门 240 --worktree R1-R8 全绿、verify-wallboard-readout --self-test 12/12(建模 60/60 格)、apps/web vitest wallboard 2 文件 11 例全绿、watermark verify 载荷完整、check-i18n-keys 19187 键 5 语言 parity OK(本批零新键)、apps/web tsc 墙板 0 错(仅存错=checkin/GlobalTopBar/web-work-panel 的 openDockedTab/onHome 三枚,系别席 work-panel.ts 在飞未落,本票不代交点名在此)。并发说明:普通提交路径仍被别席在途文件占用,走 object-space-land 只交本票一文件 (3083b390c9c)

**2026-10-25**
- 🐞 Fix:union-converge 冲突标记闸补接 import —— 2026-10-25 头注的闸只写调用未引 lib/conflict-marker-guard 的 assertNoConflictMarkers ⇒ 本器任何带 <<<<<<< 的树内容在 writeBlob 处 ReferenceError 崩(实测 dry-run base=a6c3c036be ours=本地线 theirs=179fc770b5a 即崩,RC=2 未判定),收敛器全程瘫;补一行 import 后同输入 dry-run 正常出闸(CHECK ONLY 正常走完,落地闸 3 处为真实内容裁决)。修复凭据=§1「能当场修的当场修」+本席收敛作业被此 bug 挡住的直接受害现场 (df25853257b)
- 🐞 Fix:墙板页剥回成对冲突标记 —— 11:18 手工收敛把 merge-file 原始标记带进 main 的清偿(零内容变化) (3363928c6ef)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (cc7389109eb)

**2026-10-25**
- 🐞 Fix:三族小面根治+一批测量基建纠错 —— ① packages/shared usePaginatedList 补序号守卫(末发定案:后发请求落地前,先发的任何迟到响应不写数据/不写错误/不翻加载位),此前筛选切档与在途页互盖:旧结果 setItems 替换新第1页、把页游标偷换成旧页号(下次加载更多直接跳页缺页);web/RN/miniapp 三端共用该 hook,守卫随源生效。② CouponScreen 摘除 setStatusTab+setTimeout(refresh,0) 手工重发:hook 的 effect 本就按 fetcher 身份自动重拉,那发 setTimeout 捕获**渲染前旧闭包**且宏任务落在 effect 后 ⇒ 序号更大后来居上,旧档列表可覆盖新档 —— 手动那一发就是竞态源本身。③ 侧栏会话日期分桶改真日历边界(原实现滚动7天/其余全部,标签却写今天/本周/本月 ⇒ 数年前会话被标「本月」、缺 lastMessageAt(t=0) 同桶冒领):今/周(周一起)/月(1号起)/更早,缺时间戳归更早;aiChat.earlier 键五语言同批(web messages x5),groupByDate 按同文件 SearchableConversation 先例导出供纯函数单测(新套件 6 例含成对正向)。④ 测量基建纠错:apps/mobile-rn/tests/use-paginated-list.test.ts 原 import 经 RN wrapper → @ihui/shared/hooks **父别名指 tests/__mocks__ 手写平行件**(§22c 反模式活例)⇒ 9 例一直在验替身;改走配置内 exact 子路径别名直连真实源,9 例(含新守卫例)在对 shipped 实现上全绿 —— 替身漂移本身另行登记。⑤ 上一枚 history-page-hydration.node-test.mjs 水印载荷修复(手写头行截短致残迹,verify --staged 现形;clean+重注入 0 不合格)。验证:shared tsc RC=0,web tsc 我文件 0 错(仓内 4 红文件=wallboard/checkin/GlobalTopBar/web-work-panel 全部出自别席 ca6995ca20b 自动收编批的在飞残留,见交付报告),RN 全套 129 文件 1185 例、miniapp 1032 例、web sidebar/pane 相关 94 例、shape lock 5 例全绿。 (0d036f99091)
- 🐞 Fix:旁路落地器补「成对冲突标记拒绝进树」闸 —— 79 看不见不走钩子的通道,牙装在写口上 (a844588db0e)

**2026-10-25**
- 🐞 Fix:AI 侧栏历史翻页双缺陷根治(判高两条,前端清单回源仍活) —— ① 根窗格 handleLoadMoreHistory 原 res.data.messages.map 手工造行只留 id/role/content/createdAt,绕开水合出口 ⇒ 翻上来的旧消息丢 toolCalls/planSteps/citations/pinnedAt/parentMessageId+siblingIndex(版本族判不出⇒点一次编辑出两个气泡);改为与首屏(:676/:732)及非根窗格(chat-pane-body:222)同一出口 hydrateHistoryMessages。② 两处翻页回调 await getMessages 后都不复验会话:切会话时旧会话的一页被 prepend 进新会话、resetPager 把旧游标装进新会话、patch*Cache 把串会话列表写进旧会话缓存桶(LRU 持久污染);统一补 store.getState().conversationId 复验且先于一切写入(window 窗格体与根窗格同修)。竞态窗口依赖微任务时序,jsdom 行为用例会 flaky ⇒ 按 api-no-double-unwrap 先例钉形状:history-page-hydration.node-test.mjs 抽函数体+三判据(水合出口/复验存在/复验先于写入),2 文件×(正向+三型变异夹具)+良性对照 5 例全绿,摘任一判据即翻红。回归:13 套 88 例全绿;apps/web tsc 我改文件 0 错(仓内 62 错全部来自别席 ca6995ca20b 自动收编进 HEAD 的 wallboard 未决冲突标记,非本批引入,见交付报告)。 (dd56090e923)

**2026-10-25**
- 📚 Docs:对外文档数字/端数口径收尾 —— README 瘦身版尾部旧版碎屑整段清除(7082→6007 行:八端清单/176 models SEO 段/两行矛盾结尾/孤立表行,主体均有现算版);L183 IP 白名单『只存不拦』过时表述改实链事实(ip-whitelist-guard.ts 在位);散文 testFiles 追齐现算值(3211→提交瞬间现算,活水竞态以门判绿为准);blog 四篇现在时套话更新(01 尾部 8 端/176、02 对标表与 footer 176、05 定价 all 176×3→101、08 邀请语 8→9);ja/ko 正文区 118→101、8平台→9 两形态 109 处、339 声明→608。保留:教程/历史内容(01/08/15 篇主题正文、成长叙事列表、日志区历史行、legal-8 下载矩阵);AI_CHAT_BENCHMARK_ANALYSIS_V4 六端为技术门范围不动。IHUI_SKIP_LIVE_DOC_CHECK=1 定向说明:README.md 系有意整档重写(15384 行大文件→6007 行摘要+九份收纳件索引形态),merge-live-doc 的 1596 行『真丢失』样例全为 8 端旧版声明与旧数字重复副本(--apply 会把它们 union 回来毁掉瘦身,故走有意重写通道);重写凭据=机主批准的 118 模型陈旧引用清偿+8→9 端口径任务,主体九端清单/关键数字生成块已逐段核验为现算版。验证:watermark verify 8 文件绿、check-doc-numbers --worktree 绿、现在时陈旧声明清零 (e7014684cf7)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (29582c20a82)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a6c3c036bee)
- 🔧 Chore/Other:H02 结清——allowed-tools 闸门代裁落定(全仓零声明⇒结构性无样本,只记不挡维持,首声明技能出现时按新票评估) (353b8b4b905)
- 🔧 Chore/Other:live-doc-edit 补一条镜像锁 —— 改桶与新增完整租约同批必拒(条件③逐字节),钉住「分两次定向改写」的既有口径 (3b8caa24fc0)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8f7efe9cf87)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (50a9ea73973)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7ef91d4c414)
- 🚀 Feature/Improvement:资源目录同步停更哨兵三件套 —— 760 条全军只有一行 WARN 的静默型,自此当轮即红、恢复即绿 (0dd89c37e99)
- 🔧 Chore/Other:端内套件三枚红的两条根因分头收口 —— 冷装载搬出计时阶段 + 串行等待窗并到终点 (9c8f66c4728)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4df4137ee2f)
- 🔧 Chore/Other:G-24 同题孪生复翻——G-18 行已按同证据零改动结清(前提消散+AuthGate 在位),本行同判 (564eac5011d)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (ae1c98d35d4)
- 🔧 Chore/Other:守门91冻结9处票结清——四格全闭(study-publish 5ce93b9e1/基线归零 907c6568d4/spread 三态升级/阳性对照制度化),r27q 现读全绿 (dfc90410565)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (25f10e867eb)
- 🔧 Chore/Other:认领 G-61 旁路落地器镜像套件红 26 例(核验席 r3d 2026-10-25 收口轮:镜像套件四件现读 101/101 全绿 + line-loss 第三形态已判活,票面前置满足) (eeed12179f0)
- 🐞 Fix:同名函数族判据只数带 body 的声明 —— TS 函数重载(多签名+单实现)不再被判成重复族;tauri-bridge.ts withTimeout 2 签名+1 实现曾致落地复跑假红,现读 0 命中;补重载/真重复两枚用例 (bd350cd6bf6)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b2be520d744)
- 🚀 Feature/Improvement:出口代理闸 IHUI_REGISTRY_EGRESS_PROXY —— marketplace 直连抖段的运维旋钮(默认关=行为零变化) (7fe57853cf1)
- 🔧 Chore/Other:G-27 零改动结清——守门[12]现读违规 0(互斥措辞已修正),并发副作用登记票面自记已处置 (14d6ad950fc)
- 🔧 Chore/Other:补 test_wb_sync_expiring_triggers_extraction 漏掉的 save_device_map/clear_open_cooldowns 两处 monkeypatch 桩 —— CI 红形似缺 env,真因是 checkin_scheduler.py:702-703 真调 checkin_store 写库⇒db_pool.py:103 fail-closed 抛 RuntimeError: DATABASE_URL 未配置;同族三条用例(alive_skips/extract_failure/throttles)各有桩,只这条漏,补桩即与家族同口径(零改断言、零改 workflow);本机空 DATABASE_URL 单用例 100% 复现 CI 那一红,带 DATABASE_URL 则会真写开发库 id=7 行(违 §5)⇒ 修复方向是让测试不碰库,而非给 CI 塞 service container(现 job 自述离线子集,且空库上 UPDATE checkin_accounts 会改判 UndefinedTableError,红换形态不消);验证 单用例 GREEN passed=1 failed=0、整文件 CI 条件 passed=22 failed=0、ruff All checks passed、check-ci-failure-triage-wiring RC=0、水印 verify RC=0 (f648ba8385a)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3531e7a0ef1)
- 🔧 Chore/Other:L7688 --allow-dangerous 旁路确认零改动结清(调用方健在;同题带 goal-1024t 租约行归该席不碰) (552630f18bb)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (f8f4698e36b)
- 🔧 Chore/Other:结清三票——G-13 孪生号同判(量面已亡)、合流吞修复票(两站点已 resolvedTheme+门100 A5/A6 覆盖)、--allow-dangerous 旁路确认(调用方健在) (2b0a82a0b36)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d5e70130c5d)
- 🔧 Chore/Other:键名对齐票四复翻(第六轮复核)——四文件早由 02e3474c932/a00983523bc 覆盖,五语 parity RC0+233 例+tsc 8/8;注记载明后续见此票即零改动复翻勿空烧 (628e22f3180)
- 🐞 Fix:registry 批量 upsert 批内复合键去重 —— 上游 offset 分页重叠让整批 760 条全军(PG 21000) (33cf83062e1)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (084843ab6ef)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2146490d122)
- 🔧 Chore/Other:10 行进展注记(取证席 HEAD 证据:6060 AASA 半开/7635 富文本余语序/7652 守门91 ①闭/7653 union-converge 断言缺/7657+7694+7695 Esc 三份并指针/7662 G-27 ①③闭/7705 缺键名清单/7727 副本指针) (e77a9cd6fba)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c7e949ff401)
- 🔧 Chore/Other:结清 12 行(取证席逐行 HEAD 证据:7599 api-routes 棘轮/7640+7666 prod-bundle diagnose/7654 BOOL_ACK 键集/7661 resolvedTheme/7668 requireFlagValue 四门/7672 取号器全文件集/7684 prod-bundle 门 exit0/7697+7698 窗格续传三件/7737 dup-pointer 棘轮/7513 无样本) (4c95362c713)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (14fb4224257)
- 🔧 Chore/Other:E/F/G 三票(取消信号穿延长回合/宿主中止身份标记/审批代际 CAS)复翻——8894762aed 一枚全落地,r25j 席 10/10 GREEN 核实在案,三枚皆再次回捞的回潮体 (c63b6bba9d4)
- 🐞 Fix:补齐 SSO 停靠浏览器伴生改动(rememberSsoDockedWindow 改名 + destroyDockedBrowser 收尾 + ihui:close-docked-browser 广播) —— 与 48b8f4be 的 tauri-bridge 导出配套,修复 HEAD 门 98 第二处悬空(LoginDialog.tsx:20) (4ef788126c5)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (22ea1082a64)
- 🔧 Chore/Other:号池到期字段票零改动结清——三路径已由 aa8d575f7c+99db9d2412 闭环,r27o 现读 78/78+typecheck 8/8 核验,存量脏数据收敛属运行时事件 (416ff11d9d3)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (089873b0aa2)
- 🔧 Chore/Other:G-38 补落 r3c 结清注记(首版注记引指针字面被 purge 剥掉,改写述材重落;只动本行) (32274fafd1f)
- 🔧 Chore/Other:治四处存量"代码对、锁旧"的源码漂移锁 —— 锚句跟着判据形态搬家,同时补变异自证 (91272a063be)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6c4bf2c87eb)
- 🔧 Chore/Other:结清两票——O-1 工件四件全在 HEAD(曾由批次7 S4 复核结清,重复登记形态)与工具面板开关窗格化(mode-switcher:62 已读写窗格实例+域测试 2/2+e2e ① 绿) (e03a6bd968e)
- 🐞 Fix:门 103 C1 二次超限收口 —— git-guardian 六块 141 行注释逐字归档换指针(零行为变化) (1f9a9a6fa6f)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (aaf840ab5f5)
- 🔧 Chore/Other:G-60 结清——r27n 取证代裁:三根因并列无指纹,维持移除(收益已由 windowing 承接+原位收益归零),防回潮锁随提交落库,10-07 口径闭环 (522ac4dac2a)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (9d5061842f2)
- 🔧 Chore/Other:G-60 取证收口——content-visibility 维持移除裁定+防回潮回归锁(r27n) (7413f9fd31f)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (74850e2c364)
- 🐞 Fix:G-865 行补接 theirs 侧独有票号标记 —— 收敛人工裁定预备(信息守恒) (74d9bf7f301)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d946f111a4f)
- 🔧 Chore/Other:结清 G-38 无编号 P1 视觉票漂开副本归并出口票(归并席 r3c 2026-10-25:出口在库复验绿+三票离场前提消散,逐份裁定与凭据见行内注) (8665cf45ae2)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (01defdb0945)
- 🔧 Chore/Other:L7714 四件已拍板事项零改动结清——env键在/邮件鉴权073de24a52/手搓渲染单源化消亡/alertmanager改tmpl真注入,四项实测全过 (0f292dbdc3e)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1d12801672a)
- 🔧 Chore/Other:L7798 发丝线复翻——三余格已由后续会话清偿(存量 31→0/指纹单源合一),原翻勾 38f0580dfc 被 G-32 回捞带回,现读双尺全绿同据复翻 (7be1d6baff8)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (603d8236d8f)
- 🔧 Chore/Other:D42046 同题孪生复翻——D14 行已按同判据结清(D690 落地+r27k 核验),孪生行随判 (dd36db8bbef)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (dc89f8a3f2e)
- 🔧 Chore/Other:G-939 结清——r27l 取证:裸 update-ref 跳链吞没(先于推送,票面更正),门未响=射程外+当时盲区;修法 A2~A6 已全落地,现门 --move 复现 11/11 检出 RC=0;两条加固建议交后手 (9c725319eeb)
- 🐞 Fix:补齐被 ca6995ca20 自动收编遗漏的停靠浏览器伴生导出(318 行全为新增,零删除) —— HEAD 的 web-work-panel.tsx 早已 import 这 9 个符号,单侧收编导致门 98 在 HEAD 恒红;本次只补导出面,不改消费方 (48b8f4be761)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (722d29a0dba)
- 🐞 Fix:守门 52 的三枚脚本自己漏了 windowsHide —— 判弹窗的门本身会弹窗(5 处 spawnSync) (1d0c597d696)
- 🔧 Chore/Other:结清 git-guardian 陈旧副本挂号(按重贴完整实现+fail-closed 处置,落 3718485996);G-16 两格判据注记进展(暂存待收口,SC1/T8 待复裁) (750050c352e)
- 🔧 Chore/Other:G-01③/票面点名的 OpenAPI 契约漂移收口 —— 按代码面离线重生成 apps/api/openapi.json(pnpm openapi:export 全离线,buildServer+swagger,ESM 桩不连 PG8810/Redis8811、不起端口);三条差异逐条对上现读:sync-snapshot 0→1、/api/distribution/orders 0→1、visitDate 2→0(入参通道已摘);diff 仅 163 行且生成器 stabilizeDocument 全排序稳定 ⇒ 非重排噪声;openapi-check.mjs [A]-[D] RC=0,[E] 需 --fresh 档在 CI 判 (f76f07ef396)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (f48b3b677b7)
- 🔧 Chore/Other:D14 断线审批重放结清——主席代裁 A 案,主对话流腿已由 D690 全量落地(r27k 核验 30 测绿+mypy 零错+契约两侧同值闭环),零改动 (e7d44de1748)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (46c5de8ac91)
- 🔧 Chore/Other:G-807 恢复器用例稳定性零改动结清——正解①(copyNeedsRefresh 写侧显式置过期)已在 HEAD,本席 10 连跑全绿(每轮 34/34)过票面验收口径 (c4721a8a39b)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d0c6b114b2c)
- 🔧 Chore/Other:认领 G-38 无编号 P1 视觉票漂开副本归并出口票(归并席 r3c 2026-10-25) (f59fbbf6a03)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a1fe1044758)
- 🔧 Chore/Other:L7800 RF 族 dot-source 盲区零改动结清——G-1080903(10-13)已落传递闭包比较,票面系旧读数 (9ae52737832)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (9cb23e8bce9)
- 🔧 Chore/Other:结清两票——锁初始化(lock-atomic-init 在 HEAD 实测接线)零改动;G-77 值守班量面已亡体系换代前提消散(26 天无复发) (2865ff9baa6)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (91a961ed052)
- 🔧 Chore/Other:L7806 工具钩子取消腿结清——toolCtx 接线在 HEAD(结清判据满足),r27j 补有意不接点名+形状锁 5/5,随 cli 提交落库 (964f9db7cf8)
- 🔧 Chore/Other:L7806 工具钩子取消腿收尾——补两处有意不接点名+形状锁用例(r27j) (973ad61db4b)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (746327ce2b7)
- 🔧 Chore/Other:重生成 ui-routes 产物以吸收已入库的 19 处输入 sha(门105 G5 陈旧清偿;路由 159 条与 pin 结构不变,仅自述钉更新) (fdb8be50b0e)
- 🐞 Fix:解开 main required 检查 lint-typecheck-test 的三枚红 —— VoiceNote.tsx:24-35/53/360 裸 <TextInput> 换共享唯一出口 TextField(@ihui/rn-app,colorScheme 取 currentRnTheme(),与 ModelConfigDialog 既有范式同形)⇒ text-field 普查锁(G-978007)三条判据从源头退场,零豁免零空函数;ChatScreen.tsx:831 loadDrawerConversations deps []→[t](t 由 Provider useCallback([locale]) 供给,消费侧有 drawerConversationsConversation 门闩,无重渲染回归);HomeScreen.tsx:1038/1078 localizePlaceholderGroups 提为模块作用域纯函数、t 改第二参数传入(同 ChatScreen:3579 mapConversationToDrawer(c,t) 口径),useMemo deps 摘掉该函数;验证 eslint --max-warnings 0 RC=0(改前 2 warnings)、turbo typecheck --filter=@ihui/mobile-rn RC=0(6/6)、voice-note-mount 13/13、check-input-focus-feedback --worktree RC=0、check-rn-readout-cell --worktree RC=0、水印 verify 3/3;RN 聚焦墨档观感 H5 验不了,需真机目检(代码形与 89 站点既有范式同构) (fd6c54fbc1b)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6d556c844a8)
- 🔧 Chore/Other:goal-r3 结清两票——G-217(benchmark-delivery 已装车+覆盖面未建档 0 条)与 G-960(探活腿已钉真腿分档,裸域降级自测夹具)均零改动,前提过时复翻 (d82007c89cd)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (99364e453f3)
- 🔧 Chore/Other:L7811 真机走查两项欠账零改动结清——①守门83跨兄弟键已由 b15/S10 修复(self-test 全过),②colorScheme 默认值 108 修+9 冻基线系设计终态 (ac91bb4a91e)
- 🐞 Fix:取号器活状态测试族补并发窗口分诊 —— 58/59 假红根因根治(G-35 交后手项收口) (3f10d328cf4)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c2249b30f30)
- 🔧 Chore/Other:G-955 零改动结清——next-plan-id --check 现读 rc=0,取号入口可用;7 组孪生在归档面只报数归并线自管 (89ee03fe053)
- 🐞 Fix:墙板 scrape-target 小按钮按角色档 control 取 sm(4px,门150 锚点归位);git-guardian 任务形态改 PowerShell Get-ScheduledTask 主通道+schtasks 默认关兜底(缺 __test__ 的陈旧副本 fail-closed 报副本陈旧),新增形态通道回归锁 5 例 (3718485996c)
- 🐞 Fix:live-doc-edit 声明式改桶出口收窄到归属桶单维 —— 不再充当三维守恒的全维总闸 (6f2b92c7c4b)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (218fdf6ed29)
- 🔧 Chore/Other:goal-r3 结清五票——MCP stdio 缺陷族四票(G-689/691/692/694,r27i 现读 67/67+74/74+typecheck 8/8 全绿零改动)+G-239(四门守卫早已补齐,严判口径归零) (bf49b3702ad)
- 🐞 Fix:补"未判定"批次的非零出口(同票回归自纠,f1fa20213b 把后果一起改了) (5fc069c18ef)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (596ab903fe3)
- 🔧 Chore/Other:G-18 僵尸票零改动结清——工作树待落前提消散,HEAD 四页 AuthGate 门在位(38d41f1cd0 同型),早已随收编入库 (64f4c990272)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1100081916d)
- 🔧 Chore/Other:L7807(7 脚本 self-test tmpdir)回潮体复翻——10-23 两度零改动结清后再次被 union 带回;本日现读 check-fixture-tmpdir rc=0 零红线,复翻结清 (264c7289483)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1438d2fc902)
- 🔧 Chore/Other:G-865 回潮体复翻——死键早于 9410970ece45ddc00be11886f7d607ea2399f1f3 摘除(README 记账在案),现读 external-urls.ts 无此键,零改动结清 (9d307bed64e)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6dc9438f9a9)
- 🔧 Chore/Other:goal-r3 第四波认领——MCP stdio 缺陷族四票(G-689/691/692/694)落租约派 r27i;B06/G-73 回潮体复翻(原结清证据链在注记,勿再派工) (0aae1881901)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (00bca54a631)
- 🐞 Fix:复结 L7759 门39六红票 —— 六屏共享层下沉已完工(零改动翻勾) (99c758fa3a6)

**2026-10-25**
- 🐞 Fix:[207] AGENTS.md 二次清偿 97851→95760 余量 240 —— ①主战收尾合并把我上轮删的两行同题旧副本再插回(活文档 union 认不出清偿副本型删行的同型回潮,R14 已录),再删留指针;②旧 §24「须用户确认」死文本(标题+206B 正文,已由 2026-10-23 机主令作废、现行口径=「24. 新增功能决策口径」)整段逐字移 .ihui-agent/archive/AGENTS_trim-2026-10-25.md 留短指针;③两条点名指针注释精简。IHUI_SKIP_LIVE_DOC_CHECK=1 定向说明:唯一豁免对象=上述同题旧副本与已作废死文本的有意清偿(§1 重复登记/死文本零容忍;逐字留档在案;先例 5e1f901d2f5/72a52b17509 同型),主战在飞新增行(等条件条目同型禁止/端侧读数)一枚未动 (53094555fa9)
- 🐞 Fix:i18n 死键门识别模板字面量键 t(`${m}Desc`) 等 (ae95b30a45d)
- 🐞 Fix:miniapp-compat 两处 updatedAt 盲写形态改门 198 豁免出口 —— 改密码(L2473)与令牌扣费(L2857)的单行显式键形态命中 G-998153 宽形态棘轮;改写为 .set({ ...changed, updatedAt: new Date() }) 出口形态,字段集与行为零变化(passwordHash 盐随机必变/够才扣条件语句保扣成必变,均为真变化路径),comment 注明必变性依据;验证:门 198 --staged 无新增盲写、turbo typecheck @ihui/api 过、token-balance-concurrency 3/3、g134-updated-ack-honesty 6/6(updated 派生语义直接覆盖) (b0802ff9bf5)

**2026-10-25**
- 🔧 Chore/Other:fix(api)+fix(ai-service): 两处谎报正常的故障面改如实 + asyncio 裸任务强引用族收口 —— ① GET /cli/announcements/latest 与 /version 的 catch 原回 200+空列表/空时间戳,DB 故障与'确实没有公告'完全同形(同文件详情端点早已用 500 ⇒ 异类是漏改)。改判前把唯一消费链读实:CLI fetchAnnouncements 对非 2xx 与空列表本就同样 return []('怕 500'前提不成立),/version 在仓内尚无任何客户端消费方 ⇒ 500 零破坏、信号归位;钉 fail-open 的旧用例随契约一起改判,留 CLI 取证注记。② fire-and-forget 的 asyncio.create_task 返回值被丢弃的三处(memory_graph.fire_and_forget_extract、cookie_refresh_daemon /trigger、exec_params CancellationToken._link/cancel_when_either)改按屋内模式(audit_service/knowledge_card_extractor 明文纪律)持强引用到完成:CancellationToken 的 watcher 挂子 token 自身槽位(生命周期语义天然正确:token 被持有 ⇒ 联动活着;没人要 token ⇒ 一起回收),exec_params 另收一段 return 后永不执行的旧实现残留(mypy no-redef 现形)。变异自证(HEAD 旧形态,scratch 进程隔离):旧代码无 _propagate_task/_watches_task 槽(结构档必红),且新锁 7 例在修复面全绿;cookie 46 例、execparams 33 例、announcements 10 例全绿,mypy --strict 三文件绿,ruff 全清,api typecheck 8/8。 (88c60b8fa67)
- 📚 Docs:对齐现算口径(表608/API4561/路由文件627/端9/schema235/WS25) (fe3deed00a1)
- 🐞 Fix:守门 55 coverage 89/90 归零 —— team_task(D18 团队共享任务板)补显示名映射与五语言文案 (a4bce96c502)

**2026-10-25**
- 🐞 Fix:[105] miniapp+web ui-routes 与 remote-locales 派生产物重生成补齐 —— miniapp 会话收尾(8 源文件落定 HEAD)后其输入面已定,重生成 ui-routes/gen:i18n 对齐钉 hash;web 侧主战收尾批(wallboard/checkin/preferences)落定后同法补齐;门 105 staged 现读『未发现漏生成』全绿 (dff9e140867)
- 🐞 Fix:对齐源码硬编码口径至现算值(平台38/端9/免费provider24) (f9061a7f593)
<!-- END RECENT UPDATES -->

## Nine topic documents (verbatim archives from the old root README)

| File                                                                                                     | Domain                           | Archived sections                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`readme-01-positioning`](./docs/engineering/readme-01-positioning.md)                                   | Positioning & claims             | Header banners & manifesto · one-click deploy · tech-stack overview · project manifesto · GEO optimization · TOC · positioning · feature matrix                                                                                |
| [`readme-02-ux-and-ai-control`](./docs/engineering/readme-02-ux-and-ai-control.md)                       | UX & AI control                  | Streaming AI UX (Phase 19) · full AI-control bridge · GlobalTopBar + Plus popover · use cases · AI conversation decision surface & runtime facts                                                                               |
| [`readme-03-why-comparison-scenarios`](./docs/engineering/readme-03-why-comparison-scenarios.md)         | Selling points & scenarios       | Why IHUI-AI · benchmark matrix · who uses it · 5 typical scenarios · contact                                                                                                                                                   |
| [`readme-04-architecture-and-modules`](./docs/engineering/readme-04-architecture-and-modules.md)         | Architecture & modules           | Tech stack · 9-end architecture · cross-end sharing · maintenance ratio · app hierarchy diagrams · project structure · 15 module deep-dive                                                                                     |
| [`readme-05-quickstart-api-data`](./docs/engineering/readme-05-quickstart-api-data.md)                   | Quick start / API / data         | Quick start · REST/WebSocket API & capability catalog · model auto-sync · IM multi-platform control · database                                                                                                                 |
| [`readme-06-security-observability-gates`](./docs/engineering/readme-06-security-observability-gates.md) | Security / observability / gates | Observability · security design · root guardian service · full gate table · commit-loss protection · quality evidence · AI collaboration statement · testing · deployment · CI · i18n · LLM dictionary · gate registry addenda |
| [`readme-07-faq-roadmap-commerce`](./docs/engineering/readme-07-faq-roadmap-commerce.md)                 | FAQ / roadmap / commerce         | FAQ · contributing · doc navigation · roadmap (delivered / recent updates / capability list) · monetization · star history · translated READMEs · contact                                                                      |
| [`readme-08-seo-keywords-story`](./docs/engineering/readme-08-seo-keywords-story.md)                     | SEO & brand story                | AI-engine exposure · our story · open-source vision · license · join us · acknowledgements · quick FAQ · full keywords                                                                                                         |
| [`readme-09-ops-tools`](./docs/engineering/readme-09-ops-tools.md)                                       | Ops tooling & archives           | Release-line closure capabilities & ops entries · production monitoring tools · gate registry addenda · dangling table rows archive                                                                                            |

## The 9 ends (8 apps + 1 Capacitor shell)

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
