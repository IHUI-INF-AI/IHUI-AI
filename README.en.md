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
| API 路由 | 4561 | `apiRoutes` |
| 路由文件 | 627 | `apiRouteFiles` |
| AI 服务路由 | 597 | `aiServiceRoutes` |
| WebSocket 端点 | 25 | `wsEndpoints` |
| 入库模型清单 | 101 | `llmModels` |
| 发布平台 | 38 | `publishPlatforms` |
| 端应用包 | 9 | `appPackages` |
| 共享包 | 16 | `sharedPackages` |
| CLI 命令文件 | 67 | `cliCommandFiles` |
| CLI 工具文件 | 72 | `cliToolFiles` |
| 语言 | 5 | `i18nLanguages` |
| i18n 作用域 | 7 | `i18nScopes` |
| 语言包 JSON | 35 | `i18nMessageFiles` |
| 测试文件 | 3286 | `testFiles` |
| CI 工作流 | 50 | `ciWorkflows` |
| Compose 服务 | 14 | `composeServices` |
| 工程守门 | 285 | `guardianGates` |
| — blocking | 261 | `guardianBlocking` |
| — warn | 27 | `guardianWarn` |
| 跟踪文件 | 16425 | `trackedFiles` |

上表由 `node scripts/gen-doc-numbers.mjs --markdown` 生成,最后核对日期 2026-10-25。
每个数的来源就写在取数键旁边的实现里(`scripts/gen-doc-numbers.mjs` 的 `SOURCES`),**不得手抄、不得另立第二份**。

<!-- END GENERATED NUMBERS -->


## Recent updates (auto-maintained)

<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->
**2026-10-26**
- 📚 Docs:E2E 自动补测记进展——缺口发现门接 runner 250(warn 档),存量缺口 4009 只报数,准入硬拦未开,守住未勾 (9a0ee76ccf)
- 🔧 Chore/Other:B02 记进展 —— terminal 帧三处接线收口(切片 1 6a316c8559;切片 2 生产端/载体/读 rev 4 文件由自动收编 b2c8197479 / 073bd769f8 入库,主席已核实并复跑 typecheck+5 例);契约 §7 第 4 项已改 ✅(c304de6373);本行仍不勾,残留 SSE 不广播 created/patched ⇒ rev=0 由端侧 gap resync 自愈、taro store 在飞、v2 切换待 created/patched 一并 (82c2534d04)
- 🐞 Fix:triage-incidents 的归一签名改引 auto-triage 唯一定义(门 98 悬空导入清零;--self-test 13/13) (ef0e037ffb)
- 🚀 Feature/Improvement:跨端 UI 契约下沉(二期)— 8 族 spec 单一源 + 两端薄壳接线 + 源码级契约测试 (b766fd234a)
- 🚀 Feature/Improvement:跨设备委派审批 —— 消费端补落(web 审批卡 + i18n 五语言) (7a1330d4c8)

**2026-10-26**
- 📚 Docs:terminal 帧三处接线收口 —— §7 第 4 项由 🟡 改 ✅ (c304de6373)
- 🐞 Fix:补 windowsHide + 还原 next-env.d.ts 规范引用(门 52/50 HEAD 存量红) (61bdc87fe0)
- 📚 Docs:D-07 记进展——根因在 llm.py 等待段 finally 当场 pop;落票面第二档(有界 TTL 账本+三闸+具名拒绝,零 wire 变化、单文件可 revert),代码已由 chore(auto) 收编进 07b4403797,pytest 两遍 125/125、mypy 0 错、ruff 通过;残余"端上可见"一格需跨端载荷键 ⇒ 保持未勾 (721b1df040)
- 🔧 Chore/Other:认领 L28812 端到端反馈闭环(goal-loop 席) (1e339afc6a)
- 🚀 Feature/Improvement:补 status 公开状态页 web->RN 共享屏样板(全链路打通) (9986d2b676)
- 🔧 Chore/Other:守门8参数段82条逐条定性结清(席37自摘本席租约)——①判据错52(param 档合并 + 入桶 continue 排在消费位之前 + 3 条基址常量声明行) ②合法7(无登记位,写进必被 AJ3 判清单腐烂红) ③真缺陷23(主根因 /api/admin/:id 吞五条列表);全量档面=head 门 RC=0、读数未降、零消音;残余四组真工作随本行摘除由续座按现读重登 (b3dfce9a61)
- 🔧 Chore/Other:G-965 P2 进展注记(标头投影+强制档两项目标达成,A2=0;剩余缺口按分因口径点名) (1e933d35d4)
- 🔧 Chore/Other:G-395 结清并自摘本席租约——升档留痕臂+三值封闭 reason+层名单一真相源落地,apps/cli 209/209、typecheck 8/8、水印 4/4(枚 cfec8fda86);残余两格(tools/subagent.ts 未传 reasoningEffort、上游形状非本轮交付物)另立不塞回本行 (24d6458df6)
- 🔧 Chore/Other:门 250 接线留痕(AGENTS 点名 + 门体如实接线 + 根护栏按新 runner 重封存) (587764f561)

**2026-10-26**
- 🚀 Feature/Improvement:G-965 无记录行分因出口(五档,判据全问既有单源)+ 同号旧键点名;不再只报总数 (45b03a543d)
- 🚀 Feature/Improvement:E2E 自动补测·缺口发现门接进提交链(warn 档观察) (4d3c0f0b11)

**2026-10-26**
- 🚀 Feature/Improvement:缺口发现尺子入库(新模块无对应测试的增量判据+射程清单;判据层生成物自述只认文件头) (c3905ac75e)
- 🚀 Feature/Improvement:子代理档位链补"升档也留痕"臂 + 出处标签三面一致(G-395) (cfec8fda86)
- 🔧 Chore/Other:再重钉 ui-routes 产物(wallboard 输入随 67c9d0dac7 变;union 合并后复量) (3b5a4b34d7)
- 🔧 Chore/Other:守门8参数段82条逐条定性 挂牌认领(并发席37)——派单面 --exclude-inflight 从此让出该枚,防两席领同票 (d6fa9a290a)
- 🐞 Fix:端内埋点改走共享 api-client 的 recordVisitLog(解守门 184 直连红) (67c9d0dac7)
- 🔧 Chore/Other:G-1142551 复量注记(门 105 G5 档:web 已重钉 matched,taro 被在飞删除阻塞 ⇒ 不翻勾) (1087a36315)
- 📚 Docs:第 3 期·进化回流同题收敛为唯一保留行(删 2 条无注记副本/1 条未勾副本)+ 装车证据注记 (744a6d2087)
- 🔧 Chore/Other:重钉 ui-routes 产物自述钉(bi-dashboard/wallboard 输入在别席提交 95ca2af/0c0c764 后变) (2110ae45c9)
- 🔧 Chore/Other:D-07 与 端到端反馈闭环 两枚挂牌认领(并发席35/席36)——§24 修订后由 agent 代裁执行;--exclude-inflight 从此把两枚让给本席,防两席领同票 (5b7ceeceed)
- 🐞 Fix:G-965 投影器物两处加固 —— 无侧车记录≠记录为空(不再摘真实归属标头)、owner 括号失配不投影 (6a2c360fcc)
- 🐞 Fix:陈旧 refresh 副本按错误码分流,不再误清凭据 (aefd7d5e0b)
- 🚀 Feature/Improvement:新增各端使用量面板(web/RN/小程序按路径前缀分桶) (ed04dfa525)

**2026-10-26**
- 🔧 Chore/Other:再重钉 ui-routes 产物(wallboard 输入随 67c9d0dac7 变;union 合并后复量) (3b5a4b34d7)
- 🔧 Chore/Other:守门8参数段82条逐条定性 挂牌认领(并发席37)——派单面 --exclude-inflight 从此让出该枚,防两席领同票 (d6fa9a290a)
- 🐞 Fix:端内埋点改走共享 api-client 的 recordVisitLog(解守门 184 直连红) (67c9d0dac7)
- 🔧 Chore/Other:G-1142551 复量注记(门 105 G5 档:web 已重钉 matched,taro 被在飞删除阻塞 ⇒ 不翻勾) (1087a36315)
- 📚 Docs:第 3 期·进化回流同题收敛为唯一保留行(删 2 条无注记副本/1 条未勾副本)+ 装车证据注记 (744a6d2087)
- 🔧 Chore/Other:重钉 ui-routes 产物自述钉(bi-dashboard/wallboard 输入在别席提交 95ca2af/0c0c764 后变) (2110ae45c9)
- 🔧 Chore/Other:D-07 与 端到端反馈闭环 两枚挂牌认领(并发席35/席36)——§24 修订后由 agent 代裁执行;--exclude-inflight 从此把两枚让给本席,防两席领同票 (5b7ceeceed)
- 🐞 Fix:G-965 投影器物两处加固 —— 无侧车记录≠记录为空(不再摘真实归属标头)、owner 括号失配不投影 (6a2c360fcc)
- 🐞 Fix:陈旧 refresh 副本按错误码分流,不再误清凭据 (aefd7d5e0b)
- 🚀 Feature/Improvement:新增各端使用量面板(web/RN/小程序按路径前缀分桶) (ed04dfa525)

**2026-10-26**
- 🚀 Feature/Improvement:message:terminal 终态帧贯通契约层→api-client→web store 投影(票71 切片 1/3,B02) (6a316c8559)
- 🔧 Chore/Other:G-395 挂牌认领(无牌→进行中@2026-10-25/goal-并发席34)——已派子席动 apps/cli/src/subagents 落点,按 §1 认领即租约,防两席领同一张票 (fbd9d7b83d)
- 🔧 Chore/Other:G-965 P2 投影器物加固落地(无记录≠记录为空、owner 括号失配不投影) + 第 3 批 1 条行内标头投影 (d11323e96f)
- 🚀 Feature/Improvement:设备证明密钥对补全跨服务过桥链路——生产 Trae 号可自续(此前结构性刷不动) (bacf2d4173)
- 📚 Docs:需求/异常自动发现器记进展(三源+调度已交付,余数据源素材面) (1386e45a48)
- 📚 Docs:结清第 3 期·进化回流(两条同题副本一并翻勾) —— 席位提交 1f1f9508a7(10 文件 +1069/−18)已入 HEAD;主席自审:五套 59 例 pass 0 fail、四器件 self-test 全绿、git-guardian --check RC=0、受判据 19 臂全绿、水印 10/10。逐格处置:② 守门判据腐烂自检 = check-gate-rot 增差值档(--ratchet/--baseline/--write-baseline),guardian 6h 只喊新增,现读 284+22 项、存量腐烂 1 条(git-lock 路径已登记);③ 依赖升级自动票 = dep-advisory-radar 接 ticketWhitelist,guardian 24h --register,pnpm audit 257 条(35 critical/93 high)、80 可修、已出 3 票;④ token 双闸 = 前席已接并复跑放行;① 自动沉淀 AGENTS.md = 按 §24 代裁不做(门 207 预算 96,000 字节、现读 94,050,余量 1,950;把最高约束文档交给自动写入不可控),落选理由在此留档。两条无编号同题副本同时翻勾(昨次折并后被并集回捞,属 union 无编号行维的已知残余);剩余面:②符号级未覆盖(只判路径存在)、依赖票会派进 AI 会话、EOF 登记无幂等锚点 (59d2499138)
- 🐞 Fix:补 lesson 候选稿合法性尺子,清 HEAD 门 98 悬空导入 (eea073ccd2)
- 🐞 Fix:折叠漂开副本族(N→1,认领合并到保留行 + 逐字留痕;--fold-drifted-families) (7eb5bc4174)
- 🚀 Feature/Improvement:页面访问埋点接入(页面栈轮询上报 visit_logs,免改页面壳) (0c0c764393)
- 📚 Docs:结清金丝雀发布票(观察窗+自动回滚已落地) (10dc45a19c)
- 🔧 Chore/Other:裸 git 派生基线 45→41(G-927 那族在飞迁移入库后按现读收紧) (ca701c4923)
- 🔧 Chore/Other:两张趋势图并排,压缩数据大屏纵向长度 (e30405a000)
- 🔧 Chore/Other:G-965 P2 首批 10 条行内标头投影落账(归属散文→标头,等价搬移) + 投影落地注记 (3ad96dca5a)
- 🚀 Feature/Improvement:数据大屏新增近 7 日访问趋势(PV/UV 逐日)+ 页面渲染测试 (11fee56c8a)
- 📚 Docs:G-24 记进展——回收器已落地(archive-gc 双上限+10代地板,镜像 11/11)但调度未接(HEAD 面仅本体与测试两处命中,git-guardian 无调用点);按 §0.9 保持未勾,残余=接线一格 (0e37914c0b)
- 🐞 Fix:用户 id 失效(外键违约)时降级匿名重插,不再丢整条访问 (d365f2fe82)
- ♻️ Refactor:G-54 第 5 轮 4 门 git 派生收口 face-reader (af6b584786)
- 🔧 Chore/Other:恢复被并发合并清理误删的访问面分桶测试(内容与原件 sha 一致) (06338cf4a5)

**2026-10-26**
- 🔧 Chore/Other:结清三端 ui-routes/离线包重钉(五钉 HEAD 面全 matched) + O6511 候选器交付与真源结构发现 + B02 terminal/resync 契约第二刀 + G-965 P2 投影器增强 (394e7717f6)
- 🔧 Chore/Other:重钉 web/taro ui-routes 自述钉(随 bi-dashboard 与 taro app/auth 输入变更重算,G-816040 四端现读全 matched) (09a79ced04)
- 🚀 Feature/Improvement:新增 catBatchTypes 原语(G-54)并让 audit-decision-log 的提交存在性取材走层 —— 清型 C 自拼 batch 债务,判据语义不变 (894943173e)
- 📚 Docs:结清 G-927(镜像棘轮:裸 git 派生的生产文件只减不增) —— 现读差集 0 枚(判据 headDerivationScan,对基线提交 14a04f013f 逐枚求差)。经过:上席已迁 1 枚(strip-banned-buckets,字节 4,705,595 EQUAL)、第四批 10 枚由 0ff78d7fda 整批迁完(本席复核逐枚裸派生 0 处)、本席再迁 2 枚镜像测试读真仓的裸 execFileSync(对照 512B/1088/53/346/261B 全 EQUAL),棘轮读数 71→70→49→46。逐枚复跑:6 绿(biz-day/guarded-write/identity/live-doc/readout/token-literal),2 红在射程外(ai-task 9/10 的 llm.py 裸 create_task、money 2/3 的 DeveloperConversationsScreen centsToYuan,系门 247/248 存量债,迁移前后同判),10 枚 --self-test 全绿,21 项新旧通道同 blob 对照 17 EQUAL + 4 项仅 core.quotepath 转义差异。如实登记剩余:① 现读 46 vs 基线 45 的 +1 是 scripts/audit-decision-log.mjs(7de326e39b,自进化票,晚于降档 1 分钟入库,型 A 1 处 + 型 C 自拼 batch 1 处)—— 不属本票射程,由该票席位迁移后回调基线;② HEAD 面 45 枚存量债(G-998191 族)按只减不增口径继续逐票收 (90a27b1e8a)
- 🚀 Feature/Improvement:页面排行每行同时给 PV/UV(多少次/多少人) (95ca2af0fb)
- 🚀 Feature/Improvement:页面访问埋点接入(React Navigation 切屏上报 visit_logs) (7cf9b2e8ad)
- 🐞 Fix:WS 换票与小程序 SSE 接入 401 续期 (dba8f63d4f)

**2026-10-26**
- 🚀 Feature/Improvement:三端 ui-routes/离线包重钉 + chat-sync terminal/resync 契约 + gate-grow 候选器 + G-965 P2 投影器增强 (fa9d1ad423)
- 🔧 Chore/Other:侧车 enrich 1 条(G-63 补 blocking),抽取器 --apply 现读 changed=1 bucketsDrift=0、回读 129 条 —— 由 seat-sidecar2 的 --check 点名的唯一一条待办,主席执行;门 234 复跑 state=warn(midform 3→0 / a2=0 / conflict=0 / blind=0),孤儿 80 条只报数 (6b942ede52)
- 🔧 Chore/Other:拆除 31 枚已退役零引用残影(deploy/cf-preferred-ip 2026-10-22 整链退役、qoder 探针退役、plugins-data 已下沉 packages/shared、零引用测试收口) (f80b0bb34e)
- 🔧 Chore/Other:中间态标头归一(门 234 midform 3→0) —— 三条机主面行(G-957 / G-329 / G-1182551)的行内标头带 ｜等:— 属未渲染完的中间态(语义已等价:parseHeader 读回 waiting=none、dispositionOf 同判),按 §1「标头是投影」归一成 renderHeader 产物形态;只动这三行标头,正文与归属语义逐字不变,三维守恒由 live-doc-edit 当场断言(上一版误带第四行被守恒拒落,已剔除) (f1439785cb)
- ♻️ Refactor:audit-decision-log 两处裸 git 派生改走 face-reader.gitBinary()(G-54:棘轮新增拦截即修,行为逐字不变) (1c0938e1d3)

**2026-10-26**
- 🐞 Fix:并集收敛按复合主键认"已处置权"——本侧已结清的行不再被滞后副本回捞成 open 原形态 (937fafb78e)
- 📚 Docs:守门 89 R4 清偿 —— 四枚只读尺子/自检器点名入速查区(gate-rot/plan-truncated-rows/web-rn-screen-parity/miniapp-mirror-fidelity),接线面与退役口径一并写清 (d09bf0a749)
- 🚀 Feature/Improvement:状态查询口同款 9074 自愈——与签到口共用 _rotate_device (b3fadcd296)
- 🐞 Fix:数据大屏前后端字段对齐(修白屏) + 接入页面访问/来源埋点数据 (968b13a99f)
- 🐞 Fix:门 234 A2 收口——投影等式三档化(中间态点名不判红)+ 抽取器同键冲突闸 (6d72f0164c)
- 🚀 Feature/Improvement:AI 自进化调度层四件器物接线装车 + 登记出口补取号令牌/短 sha 守卫(O65 第 0/1/3 期) (1f1f9508a7)
- 🔧 Chore/Other:G-54 第4轮 —— 裸 git 基线 49→45(紧贴现读,不留余量;4 枚入库 cca944cc6a) (62f7d34699)
- 🐞 Fix:补齐权限双轴本机记忆模块(HEAD 缺文件致 web 构建红) + 大屏使用数据面板渲染测试 (cbf3aa4329)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (59145cf2f0)
- 🐞 Fix:探针取证面从单文件改为页面族 —— 修 71 条空壳的假阴性 (7c8d5b9e82)
- 🐞 Fix:流式/AI 服务/raw 通道 401 自动续期 + RN/小程序主动续期 (831baf7200)

**2026-10-26**
- ♻️ Refactor:G-927 第五席复核——票面 10 枚已由 0ff78d7fda 迁完(求差 0),本轮收口两枚镜像测试读真仓的裸 git (8d7cbb701e)
- 🚀 Feature/Improvement:签到设备号 9074 自愈——换新设备号重签一次并持久化 rotated 标记 (529b9879d6)
- 🚀 Feature/Improvement:安全停机状态机与 haltctl(自进化票:安全停机而非硬失败) (94751a0845)
- 🔧 Chore/Other:5 枚结清行被并集收敛回捞,按原凭据再结一次(G-62/G-01/G-03/G-07/O88)——回捞根因=declaredDropCaps 只认整行逐字而翻勾会追加注记,已记入项目记忆 (047f746b15)
- 🚀 Feature/Improvement:金丝雀观察窗上线——源站直探量错误率/P95 与滚动基线比对,异常自动回滚 (9add3a32fe)
- ♻️ Refactor:G-54 第4轮 —— 4 枚守门裸 git 派生收编 face-reader.gitRaw(按钮高度自检夹具/事件闭包/staged 取材/单分支 6 处) (cca944cc6a)
- 🚀 Feature/Improvement:Trae 设备证明通道对齐并超越开源——产品线组合兜底(IDE_PC→SOLO_PC)+设备展示字段可覆盖+端点可覆写联调 (adf5ebc6d9)
- 🐞 Fix:更正 G-962 参数段覆盖注记的转档计数——三轮转档实为 8 条(7 alive + 1 dead),13 条是笔误 (7feaa2d0a4)
- 🔧 Chore/Other:登记三端 ui-routes 自述钉与离线包钉重钉(承 G-1142551 复量) (3c281d1983)
- 🔧 Chore/Other:参数段覆盖 last-mile——4 条转 alive,最终 21 alive / 54 dead / 7 human-review(82/82) (9723b0c004)
- 📚 Docs:第 3 期进化回流三副本收敛(两份同题副本结清,主行保留余面) (c458c8350b)
- 🔧 Chore/Other:参数段覆盖 human-review 二轮转档 5 条 + 记一条双端契约缺口(82/82 结论更新为 18 alive / 54 dead / 10 human-review) (8d9e7ff12a)
- 🐞 Fix:补齐四处"消费方已入库、被 import 的模块却缺失"的断链(门 98 五处清零) (6b167b2a9f)
- 🔧 Chore/Other:G-54 型 A 基线 53→49(紧贴入库后现读,不留余量)—— 4 枚枚举面迁移已入库 7634c0cbb7b,HEAD 面现读 49 与钉数齐 (6f130e29e5)
- 🚀 Feature/Improvement:旁路落地器对新建路径注入溯源水印(G-04) (247ca68459)
- ♻️ Refactor:G-54 批次第 3 轮 4 枚枚举面裸 git 进 face-reader 层(check-i18n-namespace-passing / check-input-border-var / check-permission-mode-vocabulary / check-portal-fixed)—— argv/stdio/timeout/status 语义由 gitRaw 统一,判据零变化 (7634c0cbb7)
- 🚀 Feature/Improvement:判据面不可变护栏(自进化票:不可变护栏) (62fc34e0a9)
- 📚 Docs:结清 G-964 P1 与 decode 家族单源;G-1142551 记进展保留未勾 (5128ce1fd5)
- 🚀 Feature/Improvement:人工阀清单与安全停机判据(自进化票:人工阀清单/安全停机而非硬失败) (1b22f3bb9b)
- 🚀 Feature/Improvement:web→RN 缺口分诊探针 + 小程序镜像还原度门(两枚只读尺子,均不进提交链) (45dd89e4e4)
- ♻️ Refactor:decode 家族 D2 9→0 折到共享 safe-decode-uri(9 处调用点)+miniapp ui-routes 产物重钉 (899f8c8871)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4f81fc23bd)
- 🔧 Chore/Other:G-54 型 A 基线 57→53(紧贴入库后现读,不留余量)—— 4 枚枚举面迁移已入库 3e8b864094,HEAD 面现读 53 与钉数齐 (12d2573ca2)
- 🐞 Fix:access 过期不再 307 打回登录页，守卫认 refresh 并自动续种回跳 (c8815af713)
- ♻️ Refactor:G-54 批次续迁 4 枚枚举面裸 git 进 face-reader 层(check-i18n-keys / check-i18n-messages-exist / check-z-index-guard / check-rounded-overflow)—— argv/stdio/timeout 由 gitRaw 统一,判据零变化 (3e8b864094)
- 🐞 Fix:补入 D01 人设选择器整条依赖链 5 文件——修 HEAD 断链(干净检出 TS2307) (d5a27ded0f)
- 🐞 Fix:收编 agent-picker/agent-notice-bar 两模块——修 HEAD 断链(干净检出无法构建) (442f00dad7)
- 🚀 Feature/Improvement:大屏新增交互热度面板(事件分布/平均停留/热门点击) (578e038dcb)
- 🐞 Fix:收编 agent-picker/agent-notice-bar 两模块——修 HEAD 断链(干净检出无法构建) (f07c4c0d40)
- 🐞 Fix:折叠漂开副本族(N→1,认领合并到保留行 + 逐字留痕;--fold-drifted-families) (29cb1e9aef)
- 🔧 Chore/Other:守门 8 参数段覆盖 82/82 逐条定性——余 49 条 = 7 alive / 30 dead / 10 human-review (27b860b725)
- 📚 Docs:L28120 失败广播票结清(落点与双镜像在 HEAD,5/5 绿) (07a4f28cc9)
- 🔧 Chore/Other:G-54 型 A 基线 60→57(紧贴入库后现读,不留余量)—— 3 枚枚举面迁移已入库 9b7439eee1,HEAD 面现读 57 与钉数齐 (77e7e6d7aa)
- 🔧 Chore/Other:G-1222559 结清——索引面 PROJECT_PLAN.md 无暂存改动(git diff --cached 空),推送收敛 origin=PUSHED,滞台副本形态消失 (98967f3831)
- 🔧 Chore/Other:票→提交环读侧 round-trip 镜像(正证可选绑票键,缺席不写空串) (6adfb2909b)
- 🔧 Chore/Other:G-1222556 结清——CSRF 的 Gemini ?key= 载体已由存在性豁免改为 hasVerifiedApiKeyCarrier 验真(三载体逐个交 isRegisteredUsableApiKey,fail-closed),票面三选一的『实证验真』已由更前置一档满足 (cf50864de4)
- 🐞 Fix:G-54 批次 3 枚裸 git 枚举迁 gitRaw(check-brand-foreground / check-rounded-full / check-capability-catalog)—— 型 A 存量 60→57,自检与全量行为面等值 (9b7439eee1)
- 🚀 Feature/Improvement:大屏新增页面访问热度面板(TOP 页面 + 前台/后台/登录页使用量) (344cda7701)
- 🔧 Chore/Other:G-858 结清——union-converge 镜像 58/58 全绿(登记时 10 红→接手 1 红→0),根因两套口径相反已由 0a3defae5a 收口,三套镜像+端到端探针作证 (a2f356e63d)
- 🐞 Fix:通配归档占位不构成移出凭据——修 union-converge 唯一那条镜像红 (0a3defae5a)
- 🚀 Feature/Improvement:全站页面埋点补齐后台/登录页 + 访问统计前后台口径与页面使用排行 (9cde533655)
- 🚀 Feature/Improvement:收编失败席半成品——G-395 配置分层出处标签(source + sourceRevisions) —— 该席撞今日用量上限停摆;主席自审:apps/cli 跑 subagent-precedence + subagent-precedence-flag ⇒ Tests 83 passed。落点 precedence.ts(+140)与 types.ts(新增 RevisionUnavailable='no-file-source'|'stat-failed' 与 SourceRevisions=Record<PrecedenceLayer,LayerRevision>):每个生效配置对象带 source 标签、快照带 sourceRevisions,四层短路优先级与生效值零变化。未完成面:sourceRevisions 的生产消费者与'取不到⇒null 不冒充'夹具,该席未及交付,已记入残余清单 (de2f6504dd)
- 🚀 Feature/Improvement:O6505 三源适配器(api-logs/grafana-alerts/user-feedback)+签名归一+聚类阈值+dry-run (58d7f4fcee)
- 🚀 Feature/Improvement:Trae 上游服务器自续票(设备证明)——桌面渠道签发的票由池自续,不再依赖本机客户端 (3f5fd52be7)
- 🐞 Fix:收编失败席半成品——归因层差分面按提交面取材(commit-gate-attribution +70/−?) —— 该席撞今日用量上限停摆,主席自审:node --test scripts/tests/commit-payload-attribution.test.mjs ⇒ tests 18 pass 18 fail 0。改动面=归因层差分复跑不再读'还原后的索引',避免并发共享索引里的历史 blob 把无关提交钉红;未完成面:该席未及补'取不到面⇒未判定'的第三条夹具,已记录在残余清单 (fba4ed7968)
- 🔧 Chore/Other:r5 认领自进化两票(金丝雀发布/需求与异常自动发现器)——牌插在复选框后,正文一字未动 (4277abb873)
- 📚 Docs:G-964 更正注记重新落账(上一步为消 union 双行先对齐成远端同文本,事实一条不丢)——三件载体现读全在仓,残余改为存量迁移 101 枚+72 条孤儿 (bdb6bef481)
- 🔧 Chore/Other:登记 Trae 服务器自续票(设备证明)已完成(未取号:号池满) (79cb796af5)
- 🔧 Chore/Other:撤回 G-962 批15 的 20 条参数段覆盖裁决(按陈旧守卫出口②显式放行,删的是本席上一枚自己加的条目) (29dd4876f8)
- 📚 Docs:r5 自进化四票进展注——代码已交付(56855eb75f:自治决策模型/决策链审计/E2E 补测器/经验写回腿),未接线格逐条点名,租约保留不翻勾 (85788c457e)
- 🔧 Chore/Other:G-964 行文本对齐远端同文本(消除活文档 union 双行:F4 0→1 的机械成因)——更正注记随后单独落一次,事实不丢 (489ce34618)

**2026-10-26**
- 🐞 Fix:G-927 第四批 10 枚裸 git 派生迁入 lib/face-reader(gitRaw/catBatch)—— 棘轮 HEAD 面 70→60 与基线 60 对齐;check-cross-end-screen-coverage 正文同时改走 catBatch/readWorktreeFile 满足门 118 取材面纪律 (0ff78d7fda)
- 📚 Docs:G-964 行内更正——『侧车抽取器与新守门未建』已不成立(三件载体现读全在仓 36,986/27,192/24,595 B);残余改为存量迁移 101 枚 + 72 条孤儿记录治理,凭 check-plan-fields 末行 state=warn stock=101 orphan=72 (491c8b3321)
- 🔧 Chore/Other:F9 双档两枚结清(G-455/G-681)——判据已收窄到声明位口径,现读 --gate F9 存量 0 组、宽口径 0 组、引用图 0、差值 F9=0 无 ❌ 行 (620d74f861)

**2026-10-25**
- 🐞 Fix:修复预存 typecheck 错误以通过推送门（App/ModelConfigDialog/TokenValueScreen） (7d0831bc66)
- 🐞 Fix:摘除被 chore 收尾提交复活的死测试 organization.test.ts(恢复 d35827d96c8 的摘除决定;该文件 import ../organization.js 解析不到任何文件,是 HEAD 上全量 typecheck 唯一报错文件 ⇒ 阻塞所有推送;全仓仅此文件引用 organizationRoutes) (ccf42c74ff)
- 🔧 Chore/Other:收尾提交本地未提交改动（registry-sync / qoder 桥接 / 移动端与 Web 插件 / 部署脚本 / 文档） (821ce8e621)

**2026-10-26**
- 🚀 Feature/Improvement:自进化四票真代码交付(自治决策模型/可审计决策链/E2E 自动补测/经验写回腿)—— 判据单源(autonomy-policy/decision-chain-sources/e2e-autofill-map/lesson-writeback-policy 四份 json),测试 import 源脚本零复制;自测 21/9/37/12 组全绿,node --test 四套件 48/48;两枚缺水印文件已补注入;未接线格(受锁 runner 注册与 auto-evolve 排期调用)留进展注不翻勾 (56855eb75f)

**2026-10-25**
- 🔧 Chore/Other:结清发丝线两尺合一票(hairline 尺 HEAD 面真分隔线存量 0 枚;a88793d3d1 已入库,凭据见行内注记) (38f0580dfca)
- 🐞 Fix:补 workPanel.popout 五语键(work-panel 独立窗口按钮引用缺键,i18n 全量档 rc=1 已复绿) (479d43bd68f)

- 🚀 Feature/Improvement:端侧读数判据补 V3-V5(非等分宿主)+ 29 处收口 (b83d50c6344)
- 📚 Docs:端侧读数约束补 V3-V5(space-between 行 / absolute 容器 / 定宽格) —— 存量 23→69 处已归零 (10905ec50cc)
- ♻️ Refactor:G-29 第二十批 10 站接 flag-value 单源(发布/运维脚本 requireFlagValue,语义未动) (a790c0d0a37)
- 🔧 Chore/Other:复结 9 张被并集回捞的已结清票(origin 同步止血) (acbc383068b)
- 🚀 Feature/Improvement:G-62 恢复 F5 欠账名单问责出口(f5Deficit/f5SuppressedCredit 结构化返回,五档判据原样共存)+ 四臂测试 (c9684235f5e)
- 🚀 Feature/Improvement:D08 ② agent 换手结构化事件(kind/agent_id/summary/token_usage/ts,复用 subagent_* 帧)+ 14 例测试 + 端内覆盖登记 (35aa933f806)
- 🐞 Fix:live-doc-edit G-313 期末对账三缺陷修补(取材兜底/留痕链/手填号射程/正则泄漏) (cc0f35a4334)
- 🔧 Chore/Other:goal-r1 认领 5 票加租约(r25a/r25b/r25c+r25e/r25d/r25f@2026-10-25,主会话派单防打架前置) (f881ee1c233)
- 🐞 Fix:门 55 修复第二次落地 —— 前次 d32263e707c 被 920fff8deb7 整体重写吞掉 (1cdbe49d9a6)
- 🔧 Chore/Other:结清 line-loss 第三形态判活票(门71 已补该形态并入库 da26f3624a;HEAD 面 RC=0、self-test 73/73、镜像 81/81,A/B 证明未造恒红门) (7494794a005)
- 🔧 Chore/Other:翻勾结清 G-25 工具结果三投影票(行内已有 3 条结清注记:result-tri-projection.test.mjs 6/6;goal-r1 主会话僵尸行清偿) (8c3e989381f)
- 🔧 Chore/Other:翻勾结清 D13 主聊天并行工具调用票(行内已有 2 条结清注记:D119 只读并行预取在 HEAD、test 5 passed;goal-r1 主会话僵尸行清偿) (7ae7b2995b3)
- 🔧 Chore/Other:结清 G-61 僵尸票(套件两轮 76/76;heal 第三形态前置已由 da26f3624a 补齐,遂按票面自写终态摘除) (ec713677807)
- 🔧 Chore/Other:复结 L7657 键名对齐票(并集回捞复活体;2026-10-23 已有完整结清凭据,零改动按门 239 单调性复结) (3dbc8547e45)
- 🔧 Chore/Other:复结 5 条并集回捞复活体票(prod-bundle/G-33/G-34/桌面log/活动时钟;结清凭据均已在 plan-row-drop.jsonl,按门 239 单调性零改动复结) (508d7b632cb)
- 📚 Docs:全站口径对齐到 9 端 / 101 模型（对外文档+工程文档+发射器） (73d1ed177b8)
- 🚀 Feature/Improvement:D06 审查卡一键派发修复(DispatchSubagentDialog 加 preset 预填,复用既有 dispatch 腿)+ 3 例测试 (f5be4c99b64)
- 🔧 Chore/Other:D06 派发预填对话框用例(2 例) (2718e8749ce)
- 🔧 Chore/Other:清 F11 等人拍板存量 24 条(强制令代裁/摘行;逐条留证) (eb35b31d15d)
- 📚 Docs:英文 README 数字对齐现算值 + 9 端/101 模型口径 (6d490805713)
- 🐞 Fix:修 F3 自检恒红 —— 落点判据跟上 G-158 仓内 .DevEnv (1f9deae5c65)
- 🔧 Chore/Other:结清发丝线两尺合一票(hairline 尺 HEAD 面真分隔线存量 0 枚;a88793d3d1 已入库,凭据见行内注记) (38f0580dfca)
- 🐞 Fix:补 workPanel.popout 五语键(work-panel 独立窗口按钮引用缺键,i18n 全量档 rc=1 已复绿) (479d43bd68f)
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
