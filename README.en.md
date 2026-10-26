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
| API 路由 | 4562 | `apiRoutes` |
| 路由文件 | 628 | `apiRouteFiles` |
| AI 服务路由 | 597 | `aiServiceRoutes` |
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
| 测试文件 | 3334 | `testFiles` |
| CI 工作流 | 49 | `ciWorkflows` |
| Compose 服务 | 14 | `composeServices` |
| 工程守门 | 285 | `guardianGates` |
| — blocking | 260 | `guardianBlocking` |
| — warn | 27 | `guardianWarn` |
| 跟踪文件 | 16615 | `trackedFiles` |

上表由 `node scripts/gen-doc-numbers.mjs --markdown` 生成,最后核对日期 2026-10-26。
每个数的来源就写在取数键旁边的实现里(`scripts/gen-doc-numbers.mjs` 的 `SOURCES`),**不得手抄、不得另立第二份**。

> ⚠️ 未判定 2 项:`apiSrc`(apps/api/src 有 4 个 .ts 在面上取不到内容);`aiServiceRoutes`(apps/ai-service/app 有 2 个 .py 取不到内容)

<!-- END GENERATED NUMBERS -->


## Recent updates (auto-maintained)

<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->
**2026-10-26**
- 🔧 Chore/Other:合并落地后重生成 web ui-routes 钉(union-converge 对生成物留下的本侧副本须立即重跑生成器,门 105 现读 web 行 stale⇒heal 后待入库;miniapp 端他席在飞 taro-ws-ticket.ts 由 heal 档正确拒写不背书) (c411929340)
- 🐞 Fix:G-1200041 按 2026-10-25 机主令出等条件桶——两格真卡点归机主控制台/运维动作面,存在句改归属句(事实未动),清合并回潮的 F12 基线违例 (3c6956763c)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (9ae2dd7013)
- 🐞 Fix:健康 ping 与同步同用出网判据(专用代理表→SYNC_PROXY_URL→直连)——huggingface 直连被封经代理可达却被误判 DOWN,系 LlmProviderUnhealthy 误报根因;钉测含变异自证 (ce76fff2c1)

**2026-10-26**
- ♻️ Refactor:侧栏/历史页会话菜单按钮层级重构——导出7格式与压缩2档位收进二级子菜单,一线16项收敛为9项(48项菜单测试/typecheck/prettier现读绿,i18n五语言补键parity OK) (09b5462b8f)
- 🐞 Fix:推送腿兜底两处收尾 —— ① 探针取根改用脚本自身位置 EGRESS_ROOT,不再引用尚未赋值的 repoRoot(实测:兜底自己崩在判据之前,Cannot access 'repoRoot' before initialization,比没兜底更坏) ② 两条腿都不通时把诊断写进 push-state reason,读数不再退化成'退出码 128 且无可辨认特征'(AGENTS §5e-3 量得到/§12f 失效不许安静),并给出单次绕过的可跑通道 --no-proxy ③ withDirectArgs 保住 git.exe 与尾随空格形态。回归 git-push-guard.test 32 例 + push-attempt-triage 自跑全绿 (5999fa708e)

**2026-10-26**
- 🐞 Fix:把'代理腿死'的出路做成真跑得通的通道(AGENTS §0.8) —— converge 加 --no-proxy、face-reader 加 isForceDirect 与 opts.forceDirect(第一趟就直连,不再先烧一次代理超时),alreadyDirect 认 forceDirect 不叠第二趟;两腿都不通时 push-state reason 点名两腿与各自动作;兜底探针取根不再碰未赋值的 repoRoot;直连实测新形态 'Connection was reset' 补进传输特征串。接线锁 scripts/tests/git-egress-fallback.test.mjs 16 例(含 HTTP 403 / not-a-git-repository 两条成对反证);face-reader.test 35 例同跑 51/51 全绿 (362addb4d8)
- 🐞 Fix:git-lock 落 G-397 租约凭据四档释放(单一删除出口承镜像反向锁⑤)并接 CLI --token;fix(ui): edu-ai tabActiveText 配对补全消费点(门83 R3) (b0f575b666)
- 📚 Docs:登记 O 族派单面同尺票 v2 接线(结清注记,第二步摘行) (4dc4effa68)
- 🐞 Fix:mypy 归零——_version_sort_key 恢复完整泛型注解(收口上一枚带入的裸 tuple),parent_child_chunking 删多余 import-not-found ignore(本venv已装 tiktoken,unused-ignore 判红) (f28c7ace34)
- 📚 Docs:G-241 与 O87g 记进展不翻勾——认领 CAS+终态封闭集已入库(journal 345,applied 回环 dev),门8 提取式第①步 ⊇ 自证主席复跑(4357→4648/回归 0/未判定点名 62→170);两行各自写明剩余格,不开假账 (fb54ff62f0)
- 🚀 Feature/Improvement:窗控 overlay 深浅判定拆出纯函数 classify_topbar_luminances+10 组单测,新增几何/深浅真机自证日志(note_chrome_state,节流三闸);本机无 MSVC 链接器未编译验证,以门为准 (654ade932e)
- 🐞 Fix:派单口径分桶切到 v2 尺与 --dispatchable 过滤面同尺(票 G-1182552) (2f0830e8ee)
- 🚀 Feature/Improvement:cf-preferred-ip 优选 IP 守护脚本落库(PROJECT_PLAN 已登记该交付物,此前仅存生产机未入库;.env 本体仍由 gitignore 屏蔽) (bf805b6551)
- 🚀 Feature/Improvement:模型同步按 provider 指定出网代理(SYNC_PROXY_URL_<PROVIDER> 环境变量驱动,缺省回退全局);收口 httpx proxy= 三处测试替身欠账 (b30f56aa66)
- 🐞 Fix:ai-world 收藏前景键改 favBtnActiveText 与底键同前缀(门83 R3 兄弟对);chore(miniapp): llm-settings 空态补 key-round 图标,ui-routes 派生产物随源同步 (d184010664)
- 🚀 Feature/Improvement:[cross-domain] safe-commit 两处停摆根治 + intentional-delete 摘净国内代码镜像残留 + 根目录 .screenshots/ 入忽略层 —— ① 本进程取不到 user.email 时按 lib/bypass-git.mjs 的 REPO_GIT_IDENTITY_ARGS 唯一出口补署名(问不到当作有身份,绝不伪造作者);② 裸 exit 128 不再冒充索引锁争用(本机实测:身份缺失被当锁连烧 10 轮守门链 ≈100 分钟),确定性致命因有专档且不退 --no-verify;③ 删 mirror-to-cn.yml + scripts/setup-mirror-repos.mjs(机主 2026-10-23 弃用令被并发 union 带回,gitee 残留远端同批已摘;桌面端 Gitee 附件分发与 release-desktop.yml 不受影响);④ .screenshots/ 入忽略层 ⇒ 守门 44 从"归属无从判定 exit 2"落到只告警层,不删并发席位现场。接线锁 scripts/tests/safe-commit-failure-triage.test.mjs 5 例 + git-egress-fallback.test.mjs 14 例;回归 face-reader 35 / safe-commit 20 / git-push-guard 32 全绿 (2f9def0ddd)
- 🔧 Chore/Other:RAG_PARENT_CHILD_ENABLED 登记能力矩阵(开关类,默认关;放量判据=金标集真实库 on/off 对照) (63cf7dbfd3)
- 🐞 Fix:cross-publish-v2ex 用法文案漂移(参数→值)对齐单源措辞,g322 第二十批探针 29/29 转绿 (f0b3e47c3c)
- 🐞 Fix:补 stepfun 除名最后两处漏网(入站显式档 + 用户可见面板) (9d01bc93a8)
- 🐞 Fix:部署脚本 git 调用一律钉 -C $Root(取源/定 tip/算 behind/快进不再读错仓库) (85eeb326a7)
- 🔧 Chore/Other:三端 ui-routes 派生产物重生成(大屏「会话质量/访问来源/页面流转」三块面板改动 ⇒ 自述钉 inputsSha256 须同步;派生产物由生成器产出,不得手改) (e3138d8057)
- 🚀 Feature/Improvement:大屏新增「访问来源」与「页面流转」两格(流量从哪来 + 人往哪走) (bc28df94c1)
- 🐞 Fix:清零 shared/api 两包 lint 错误 (f78f79461f)
- 🚀 Feature/Improvement:KB 检索金标集入库(264 条问答 + schema 校验常驻尺子) (0451cb1e18)
- 🚀 Feature/Improvement:检索指标模块(Recall/Precision/MRR/nDCG/HitRate/ContextPrecision) (a7701fa00e)
- 🚀 Feature/Improvement:父子块 small-to-big 摄取/检索接线(RAG_PARENT_CHILD_ENABLED 默认关) (9e7923d0fd)
- 🔧 Chore/Other:守门44白名单登记 .screenshots(只登记、不搬不删,归属并行会话产物) (308d4c57d7)
- 🐞 Fix:永久退役厂商(stepfun)在同步/可用性/面板/调用/清单五面统一除名 (535dfe6d92)
- 🔧 Chore/Other:三端 ui-routes 派生产物重生成(墙板页面改动 + 并发侧 bi-dashboard 变更 ⇒ 自述钉 inputsSha256 须同步;派生产物由生成器产出,不得手改) (7694177548)
- 🚀 Feature/Improvement:大屏新增会话质量腿(会话数/单页会话占比/人均浏览页数/会话深度分档/落地页TOP) (9d6fbb62ee)
- 🐞 Fix:修「网络异常 × 401 续期」预算互挤 + 补 fetchText 续期契约;RN 替身补转发;api 三例存量红收口 (40f18df5fe)
- 🐞 Fix:LlmProviderUnhealthy 文案去「补 key」出路措辞 + 接线锁文案层射程扩到全部 LLM 告警规则 (af69efdde8)
- 🔧 Chore/Other:三端 ui-routes 派生产物重生成(墙板页面改动 + 合并带入的路由源变更 ⇒ 自述钉 inputsSha256 须同步;派生产物由生成器产出,不得手改) (f43a72e73f)
- 📚 Docs:G-1200041 压行至 388 字(≤400 合规),主键与归属桶逐字不动 (11c70b4ac4)
- 📚 Docs:G-1200041 登记 sso.aizhs.top 502 剩余两格(归:机主控制台面);本机 Keycloak 已对齐 8850 (e4a65ab104)
- 🐞 Fix:三条通道的 401 续期收口 —— SSE 双闸收敛为一道 / WS 换票 401 语义下沉 / 小程序通知 WS 票据化 (de1a3c2902)
- 🐞 Fix:页面路径归一单源 + 授权凭据落库防线;大屏排行补端前缀与占比 (0c50f20838)

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
