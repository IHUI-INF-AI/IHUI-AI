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

Headline claims (same source as the table below, all live-computed): **608 tables · 4558 API routes ·
25 WebSocket endpoints · 101 catalogued LLMs · 38 platforms auto-publishing · 3204 test files ·
273 engineering gates · 50 CI workflows · 5-language i18n parity · 9 app packages · 16 shared packages ·
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
| 测试文件 | 3206 | `testFiles` |
| CI 工作流 | 50 | `ciWorkflows` |
| Compose 服务 | 14 | `composeServices` |
| 工程守门 | 281 | `guardianGates` |
| — blocking | 258 | `guardianBlocking` |
| — warn | 26 | `guardianWarn` |
| 跟踪文件 | 16105 | `trackedFiles` |

上表由 `node scripts/gen-doc-numbers.mjs --markdown` 生成,最后核对日期 2026-10-25。
每个数的来源就写在取数键旁边的实现里(`scripts/gen-doc-numbers.mjs` 的 `SOURCES`),**不得手抄、不得另立第二份**。

<!-- END GENERATED NUMBERS -->


## Recent updates (auto-maintained)

<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->
**2026-10-25**
- 🐞 Fix:补建 compat 绑定手机/邮箱端点 —— POST /user/phone/bind、/user/email/bind 此前从未注册,小程序「绑定手机号/邮箱」确认步每次 404 被前端 catch 吞成无响应。判据逐字对齐 auth-extended /auth/change-phone/confirm:同一份验证码存储(code-store.verifyCode,Redis 原子比对+删除消费一次)、同一 409 占用语义、同一限频档;差别只在绑定无旧号可验。归属锚点=令牌注入的 request.userId(§5 认证不等于授权:请求体不收 userId)。行为锁 7 例(miniapp-compat-bind.test.ts):匿名/错码/他人占用三闸都断言写库链零调用,两条正向对照拦 eq() 实参证 where 锚本人;变异自证:HEAD(未建)面整套无法通过、修复面 7/7 绿 + stubs 38/38 不回归。 (c87193d5c07)
- 🚀 Feature/Improvement:「业务深纵 / AI 号池」两块补更多可监控数据(机主 2026-10-25 要求"更多实际有用的数据") —— 业务深纵新增用户构成 5 格(VIP 用户 / 操盘手 / 邀请注册 / 近7日邀请 / 近7日活跃)与等级分布行(普通·白银·黄金·钻石),全部与 usersTotal 同一次查询的 filter 计数 ⇒ 零额外开销;activeUsers7d 走 sign_in_records 的 (user_id, sign_in_date) 唯一索引。AI 号池新增:Key 健康四态(unknown/healthy/degraded/down,与汇总字段同一把尺子 RELAY_POOL_HEALTH_STATE_VALUE)、余额不足 Key 数(<5 元且非无限)、24h 内临期账号数(补"只看最短临期"的盲区:只修最短的,第二个过期时又宕一次)、按 provider 分组的 Key 与账号分布表(可调度/总数/异常)。号池侧全部在 computeRelayPoolLiveSnapshot 已加载的两份行上累加 ⇒ 相对现状零新增查询,5 秒轮询成本不变。验证:api/web tsc --noEmit 均 0 错、check-i18n-keys 5 语言 parity OK、门 240 --worktree R1-R8 全绿、verify-wallboard-readout --self-test 12/12(建模 60/60 格) (aab60021f45)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (850a49aaa88)
- 🐞 Fix:第七处 CI 红 —— Avatar 圆角档回归 shared 规格(md/lg),不迁就 RN 的 2xl (a8852839304)
- 🐞 Fix:修 release 包启动即崩(P0)——GlobalFloatBox/PrivacyPolicyModal 调 useI18n 却挂在 I18nProvider 之外 (31c4acff133)
- 🐞 Fix:第六处 CI 红 —— PROJECT_PLAN 副本归并归档件补溯源水印 (37b8728d5a9)
- 🐞 Fix:第五处存量 lint 红 —— visit-log 测试的 import() type annotation (f9dd9556502)
- 🐞 Fix:第四处存量 lint 红 —— auth-gate 测试 mock 的 next/link 缺 href (9fe3d1d63ce)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7dbc8c28053)
- 🐞 Fix:补建 GET /distribution/orders —— 小程序「分销-我的订单」自建站起打空炮 (8c036a661c1)
- 🐞 Fix:登出未清内容缓存导致**跨账号看到上一账号的 AI 对话与生成结果** (1ac6f8d5a25)
- 🐞 Fix:非中文用户的相对时间兜底不再掉英文;三处列表分组改按本地时区(不再切 UTC 串) (928325829e5)
- 🐞 Fix:分页"加载更多"三型缺陷收口 —— 整屏顶掉前一页 / 提前断供 / 页边界重复行 (8817a9a40d4)
- 🔧 Chore/Other:侧车两键随让号迁移(G-100#把file / G-101#生产备份链…),waiting 同步改 env (2f141c5f36d)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (67734203348)
- 🔧 Chore/Other:F9 两枚撞号让后来者改号(G-20→G-100 / G-76→G-101),侧车键随号迁移 (c5787574c2c)
- 🐞 Fix:六处"合法为 0 的读数被当成缺失"收口(0 积分显示成别人的量纲 / 免费显示成没数据) (c32be823130)
- 🐞 Fix:智能体点赞/收藏收进单事务并对父行 FOR UPDATE —— 无唯一约束下的并发重复计数 (22ee752721b)
- 🔧 Chore/Other:侧车五条 waiting 按机主令代裁改判(human→none/env) (e688eb82eaa)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (55f828f091c)
- 🔧 Chore/Other:代裁结清余下五条 F11 存量(侧车改判 + 行文同步) (7bb316e3106)
- 🐞 Fix:分销佣金"分当元"显示(100 倍)与两处接错后端的取数,统一走 @ihui/shared 的 formatPrice (46758b5b2b8)
- 🚀 Feature/Improvement:侧车新增声明式改判档 —— 判据修正后旧桶不再被永久钉死 (a59a40b5f8a)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4651830c72e)
- 🐞 Fix:根治计数字段"读出来±1再写绝对值"族,门 243 追加 G5 档(存量实测 10 处→0) (50ca17bd8e6)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d6000a93163)
- 🔧 Chore/Other:代裁结清两条 F11 存量(翻勾 + 已拍板条目改题面) (b9fc733c78a)
- 🚀 Feature/Improvement:活文档编辑器新增声明式改桶出口 —— 解开机主令与三维守恒的结构互斥 (9c034053fcc)
- 🐞 Fix:守门 246 取材改走读取层批量口 —— 逐文件 git show 在 HEAD 面直接判"未判定" (600b0d58a4b)
- 🐞 Fix:归属桶不再读侧车投影标头 —— F11「等人拍板」24 条误判收窄到 7 条真决策 (c9e26351407)
- 📚 Docs:守门数回补为现算 258 blocking / 16104 跟踪文件(ddf16383c65 装上守门 246 带来的增量) (1ca62f93d03)
- 🐞 Fix:业务日界统一到 Asia/Shanghai 单一出口,根治大屏同屏「上海日新增 vs UTC 日签到」互搏 + 装守门 246 (ddf16383c65)
- 🐞 Fix:README 守门数回补为现算 280/257/16100(本枚装上守门 245 后的现读值) (ccb1be68122)
- 🐞 Fix:根治活文档"同形态副本逐次翻倍"族 —— README 4.6MB→1.1MB,并装守门 245 (95b5a628b0c)
- 🐞 Fix:同题折叠认「仅投影标头/尾部注记差异」的两版 —— 治跨机合并 F4 放大把分叉卡死 (37e05b810f5)
- 📚 Docs:生成块与散文数字回补为现算值(门 173 落地后点名) (7d05820dc59)
- 🐞 Fix:根治「定时器句柄被覆盖」与「零分母读数上屏」两族 + 装车守门 244 (48872214e10)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (51148733d6d)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b87d50d12da)
- 🔧 Chore/Other:G-50 / G-75 同票两版并为「侧车标头 + 对侧富化正文」(含本侧独有注记) (a745c38c304)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2a9d2b19197)
- 🔧 Chore/Other:三处同票两版并为「侧车标头 + 对侧富化正文」—— 为跨机合并消解同题两版并存 (f66ad738723)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (676c6cb43d0)
- 🔧 Chore/Other:L7470 死端点簇六路复核:整路径字面量 grep 假 0 修正为 6/6 全通(前缀合成+通用端点改指),三处裸路径改显式 /api 已落 f1ee3fee8e、门 8 主腿 2829→2832 三路各 0→1 判活;仍待三件人定档(bank-cards 无表 / annex-resource 是否新增 /courses/:id/resources / course-qa 与 agent-reviews 语义) (7c3ac208fa7)
- 🐞 Fix:生产签出外来工作巡检不再把第三方仓读成未判定(本机 RSSHub 连续 134 分钟假警报) (5bcbc960b47)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (f7f5b44aaf8)
- 🔧 Chore/Other:L7472 六路口径修正:三处裸路径改显式 /api/(AgentReviewListScreen.tsx:43 /api/agent-reviews、BankCardScreen.tsx:28 /api/bank-cards、MessageChatScreen.tsx:45,71 /api/messages/private 族);六路实为 6/6 通,票面「5 路 0 命中」是整路径字面量 grep 对前缀合成+通用端点改指的假 0,作废;门 8 worktree 主腿 2829→2832(三路各 0→1 判活,行为不变),mobile-rn tsc RC0、悬空 0(11161 文件) (f1ee3fee8ed)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3a03f4521ba)
- 🐞 Fix:同名函数族扫描先遮字符串/模板串 —— 治夹具里的声明被当成第二份定义(落地复跑假红) (37fac19cde2)
- 🐞 Fix:两条告警根因 —— z-index 门对 cn() 遮罩失明;卫生门把 tmp 一次性脚本算成可移植性违规 (5d1ff7294b3)
- 🐞 Fix:PV/UV 的业务日不再由浏览器决定 —— visit-log 收口客户端自报时间键 (aa08ed57dd6)
- 🔧 Chore/Other:L7467 冷启动盘点复核新增修 1 格:pages/study/my-study/index.tsx 冷启动直发鉴权端点 GET /study/records(user/study-routes.ts:45 + user/index.ts:36 组级 preHandler)补 useAuthReadyGate+waitUntilReady,ui-routes 自述钉重生成;其余格=代码面 60 枚门控/扩展 SW 早退/mcp-store 有意无闸均已在 HEAD,唯一阻塞=机主手机扫码;自验 check-miniapp-generated --worktree --group ui-routes RC0、miniapp tsc RC0、eslint RC0、use-auth-ready-gate 14 passed (0c9e33f2624)
- 🔧 Chore/Other:G-16 门128 新增 classArmResolution 解析维(只报数不进退出码):usedClassRefs(带 conditional 上下文的唯一提取式,usedClassNames 改为其键集)、classDefScan、classArmVerdicts、collect 接线、人读面打印、--json.classArm;按票面机主定档:唯一无覆盖定义+无条件使用=resolved,多处定义/!important/非单类/条件取用=undetermined,小程序侧查无定义且非工具类形态=undefined 逐条点名(web/rn 无 Tailwind 配置可解析一律 undetermined,不折成通过);顺带修两处取材(比较运算符后字面量不当类名、@media/@supports/@layer 剥壳后不误判选择器非单类)。HEAD 现读 47 腿中 16 用类名:唯一无覆盖定义33/查无定义0/未判定69。自验 --check RC0(10s)、测试 48 例 T42 在位、--self-test 因另一席未提交的 scripts/lib/cross-end-ui-parity-selftest.mjs 脏副本在 :2570 崩(pristine HEAD 复现同栈,非本批) (3570211ffd9)
- 🚀 Feature/Improvement:迁移缺口审计接入守护巡检(30min 节流;缺口集合进告警身份) (69f0e349f71)
- 🔧 Chore/Other:G-91② 全量基准门:all-checks-runner 末段固定输出「总耗时/门数/预算/判定」,预算与基线读自新文件 scripts/check-all-budget-baseline.json(budgetMs=120000, baselineMs=156711);新增 pnpm check:all:120(--budget-strict,超预算 RC=1),默认 check:all 只报不顶红(耗时不是判据真假;失败路径由自检 A12 钉死);自验 --self-test 13/13、check-gate-wiring RC0、--budget-strict 实跑 RC1(27 步 25 通过 2 失败:第13步 check:miniapp-generated 与第18步 scan-dead-i18n-keys,判定面均 HEAD 且非本批产物;首次全量 156711ms/27 门) (1f654a6c5f1)
- 🐞 Fix:两处入账的丢失更新(管理员调整余额 / USDT 到账)改为 DB 侧原子增减 (0450d797418)
- 🚀 Feature/Improvement:迁移账本「中间缺口」审计与修复器物 —— 治生产库长期落后代码且部署只说档位噪声 (e0ed1d8105a)
- 🔧 Chore/Other:G-40 A 格最小落地:command_ack_facts 表(复合主键 child:<parentSessionId>:<sourceCommandId> 即幂等键,status/载荷双 CHECK,expires_at 索引,尾部回滚注释)+ TS 镜像(schema/index.ts 导出)+ journal idx342;run-idempotency.ts 仅记 E 格 TODO 点名写入侧 agent-runs.ts:304-318 与重放侧 :725-731,不半截实现。自验:bookkeeping --worktree 342↔342、schema-drift(TS608/迁移611,dead=1 存量 rag_chunks)、immutable、ledger-drift 无 DSN=SKIP、scripts/tests 38 例、@ihui/database tsc RC0;未跑(无 PG):from-zero/真实应用/drizzle-kit generate (14df3f14f00)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (44c6681ef70)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4a1c78d5df9)
- 🐞 Fix:行内标头按侧车收口 8 行(3 条 malformed + 5 条陈旧) —— 门 234 A2 清零 (9fe2a464509)
- 🔧 Chore/Other:侧车去重 91→87(4 条被新记录接管的旧副本) (48c19258605)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (604a52d0999)
- 🐞 Fix:ws-payment 归属校验改为 fail-closed(两处降级放行是活的越权口) (713efc621e2)
- 🔧 Chore/Other:结清 门39 六屏共享层下沉 + D42046 断线窗口待决审批重放(r2d 席 2026-10-25,零改动现读凭据行内) (887902d5ccf)
- 🐞 Fix:侧车写入链路三处根因补齐(散文优先 / 去省略号 / 投影保散文回退) (6596afa1ba6)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (58be7dd6c78)
- 🔧 Chore/Other:三翻勾结清 G-61(--root 修复在 HEAD+镜像 76/76 全绿;heal 回捞根因器物 RETIRED_LEDGER 随自愈器修复提交入库激活,窗口外拒复插;诊断出处按内容锚点指门体头注) (5fdb3e8b96f)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4b7215ce475)
- 🐞 Fix:陈旧行内标头按侧车重渲染/摘除 6 行(门 234 A2 收敛) (7416c88b28d)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (98b5de5e77c)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (50d1bb1ddab)
- 🔧 Chore/Other:认领 门39 六屏共享层下沉(r2d 席 2026-10-25) (1caff10ad83)
- 🔧 Chore/Other:侧车同键去重 105→87(18 条重复记录;解析映射逐键零变化) (6a55e44ef13)
- 🐞 Fix:侧车投影可往返 + 抽取器只加不减 + 同键去重入口(门 234 根因三连) (f9c1514b303)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (e88befc9306)
- 🔧 Chore/Other:结清 D42046 断线重放票(diff①/diff② 均已由 D690 方案 A 批次落地 8214722404;r26b 现读核实 129 例全绿零改动;过时注记交后手) (3a49101391f)
- 🐞 Fix:提现释放冻结补齐额度守卫(G3 存量归零),并给兑换补运行时行为锁 (a0e53989322)
- 🔧 Chore/Other:工具两件:G-62 第二版 F5 恢复等价注释(②档 b-o 即 max(基底,本侧),未复制期望值基准,用例 58/58 不变)、G-24 新建归档回收器 archive-gc(默认 dry-run/三条判据 maxFiles5+100MB+keepGenerations10/未判定 fail-closed RC2;真实 .ihui-agent/archive 现读 72件32代→保留23待删48未判定1;9 例自检);不含 --apply,不改既有归档 (785d9eca686)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2f2368da057)
- 🐞 Fix:行内标头按侧车重投影 16 行 —— 门 234 A2/同键矛盾走正牌出口 (5468186d7f7)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d50fcd1cf91)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3b24a9a9db1)
- 🔧 Chore/Other:认领 门39 六屏共享层下沉 / D42046 断线窗口待决审批重放(r2d 席 2026-10-25) (71ca38eee9e)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (61864c2094d)
- 🔧 Chore/Other:B06 认领租约(r26a@2026-10-25 接手余步序四;前牌 goal-r52 超 72h 且会话已收官,按 §1 交回派单面) (33d0312d05d)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (cc8e353c6eb)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1ab2f4992bb)
- 🔧 Chore/Other:结清 G-38(三条 P1 目标票已离场,漂开副本归并出口诉求前提消散,零改动现读凭据行内) (21487be7d7f)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5d71c78cdfe)
- 🔧 Chore/Other:复结取消信号+宿主故障标记孪生再回捞两枚+结清审批代际CAS票(approval_generation_cas.py 整套在 HEAD,票面 grep=0 系 2026-10-13 过时读数;三行均零改动现读凭据行内) (cf106d58c02)
- 🐞 Fix:check-credential-health 服务存在性探测换通道 —— sc.exe 属本机程序黑名单，spawn 那一刻安全策略杀的是整个 node 进程(RC=143)，致 IHUI credential-health 每 6h 巡检腿整条静默消失；改为先经 Get-Service 读同一份 SCM，sc.exe 仅 IHUI_ALLOW_SC_EXE=1 兜底，探测不可用仍返回 null(不误判，未放宽任何门) (d45af31ef71)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (878a312df9f)
- 🔧 Chore/Other:结清 G-35 取号器撞号票(形态 A 18e4bf960c+形态 B d34600b0e84 两出口占用面补全;镜像族全绿;存量 9 组清偿去向登记) (8779ebae1be)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1a70ac6955c)
- 🔧 Chore/Other:r2e 基建普查注记 —— scripts/ 下 reg/schtasks/sc 类黑名单 spawn 一律改 PS 通道（换通道不跳门，读不到如实报未判定） (c29d41e11a4)
- 🔧 Chore/Other:侧车抽取正规产出 12 条(plan-fields-extract --apply,bucketsDrift=0) (70520a6fbc1)
- 🐞 Fix:G-35 形态 B —— 第一发号出口 live-doc-edit 补扫工作树副本(r25k 席,主会话裁决采纳档)—— CAS 循环内每轮读工作树副本用同一把尺 scanFamilyIdHits 扫(先剔租约行与 HEAD 面同口径),副本独有号并进占用面(并集方向:HEAD 证据保留 fromWorktree:false 不倒扣,镜像 ⑧b① 钉);worktreeText 缺省 undefined 本维完全缺席行为与改前逐字同形(⑧b②),读不到退回 HEAD 宽面警告出声(⑧c);命中明细带来源面「工作树副本第 N 行(未提交)」;I10 形状锁收窄到立法意图(幂等判据区段零磁盘取材,收窄不削判据,工作树维另由 ⑧c 锁);验证:live-doc-edit 自检 29/29+组合 169/169+collision 10/10+id-collision 19/19+next-plan-id-remote 14/14 全绿,水印 6/6,--check exit 0;形态 A 已入库 18e4bf960c(收编器) (d34600b0e84)
- 🔧 Chore/Other:门94 补 D08① 团队任务六码(唯一真源+五语词包+用例):mcp_server.py 产出的 ALREADY_CLAIMED/BOARD_FULL/FORBIDDEN/INVALID_STATUS/TASK_CLOSED/TASK_NOT_FOUND 入 ERROR_CODE_CATALOG;实测 check-error-code-coverage --worktree 111 码/128 条全覆盖、五语词包 19174 键 parity OK、error-catalog vitest 16/16、@ihui/shared tsc RC0 (1062bcb3daf)
- 🐞 Fix:已结清短留痕 —— 窗口外不再把已翻勾的票复插成未勾(G-61 型) (25ca3e6be2d)
- 🐞 Fix:积分兑换超卖与提现回调黑洞根治,并装守门 243(额度写影响行 / 回调吞失败) (bddb7beaff4)
- 🐞 Fix:两端 ui-routes 派生产物按 HEAD 输入重生成(门 105 转绿) (b1f5c1c3848)
- 📚 Docs:删除被并发 union 回插的重复速查块(97,095 → 95,057)—— 门 207 体积回预算 (6c96fc42260)
- 🐞 Fix:第三处存量 lint 红 —— agent-free-times-authz 的 import() type annotation (dcaa35a376e)
- 🐞 Fix:生产构建改 staging 原子换入(构建期零影响)+ 部署锁 run 托管;DevEnv 根按机器标记识别;凭据巡检停用备份口令真登录;AGENTS 去重回预算 (7d36e564f57)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (98091967daf)
- 🔧 Chore/Other:安装器三版沙箱编译实测进展注(基线/A/B/C 四轮真实构建读数+还原自证;选型归机主票不结清;未尽②全帧目审仍开) (5ee1dd77682)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (651decf90cd)
- 🔧 Chore/Other:D08 订正注(D06 前置已按完成即删摘除,首条注记的当次现读已过时;r2a 席) (cd379d91073)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (e2ba1dcb349)
- 🔧 Chore/Other:G-35 进展注(形态 A 第二出口远端避让已落盘 19 臂绿;形态 B 已裁决采纳续做;存量 9 组清偿去向登记) (a9c1b939f1a)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (046f9979c70)
- 🐞 Fix:G-35 第二发号出口补远端号集避让(r25k 席)—— next-plan-id.mjs 发号路径原只吃 remote.max,远端低位独占号(本地面已让空/已推未并)结构上不被避让会被当空闲发出(与第一出口 live-doc-edit 自 G-454② 已扣远端号集两出口同漂);lib/plan-id-lease.mjs 加 remoteIdNumsOf 单源投影,liveUsed 并入远端号集(同号集恒等并行为逐字同形)+skippedByRemote 逐枚点名;镜像 T11a 三段(修复前撞号实证/修复后顺延/恒等并反证)+T11b 装车形状锁;验证:next-plan-id-remote 14/14+plan-id 族 7 镜像 52/52+--check exit 0(建议号 O65 含远端避让)+水印 3/3;2026-10-22 三连撞号病型已由 c84e98229c 收清、夹具 7 条正证在 allocator-collision (18e4bf960c0)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7549b151cfa)
- 🔧 Chore/Other:chore/fix(plan): r2c 席核验派单口径 11 行等条件 —— 2 条前置已成立结清(G-55 trace 列 / P1 残余② desktop 日志 target),9 条改写为可机读成立判据并补当次实测值 (e551927717d)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (0fe3d826f6c)
- 🔧 Chore/Other:D08①团队共享任务列表落地进展注(goal-r2 2026-10-25 r2a 席;③ 归属 web 在飞面) (215fe312e59)
- 🐞 Fix:又一处存量 lint 红 —— chat-sync-rev-persistence 测试的 Fastify import 未使用 (c75a540f094)
- 🚀 Feature/Improvement:D08① 团队共享任务列表 —— team_task 工具(子 agent 可认领/更新条目) (42ac1f1a682)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (28cfabd24e0)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (01d74c51f43)
- 🔧 Chore/Other:复结取消信号+宿主故障标记两枚并集回捞复活体(8894762aed 已实现+cf4321f8d0 已翻勾;r25j 现读核实 10/10 GREEN,零改动按门 239 单调性复结) (b8cb8144768)
- 🐞 Fix:开发者密钥弹窗「权限点/说明」改走语言包(adminTools.developer.permissionLabel/permissionHint),五语齐;该文件硬编码 chrome 归零 (e4f57db0da3)
- 🐞 Fix:收口 /api/agent-free-times 匿名挂载 —— 空 body 的 /reset 不再清零整表 (dca9bbbd6d5)
- 🔧 Chore/Other:G-1102638 批1 同主键副本行物理归并 — 删 7 行(机主拍板〔拍板@2026-10-08 机主:真删+立即执行〕;幸存者规则与F4同向;落账注记行保留待批2;复跑auditPlan对账F1=0/F9不增;逐行留痕 .ihui-agent/archive/PROJECT_PLAN_copy-purge-2026-10-24.md) (2cb472ebe55)
- 🚀 Feature/Improvement:G-67 判据④补「归档已勾主行」档 —— 陈旧悬空指针可删、主行仍活仍拒删(fail-closed);7 例自检 + dry-run 候选 7 行 (75d2a278471)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (62addf0b582)
- 🔧 Chore/Other:结清 G-79(待落 13 文件已由 f9b56e4278+a6c7cb36ec 入库,零改动)+ 复结窗格续传同题孪生复活体(引用 L7817/7818 结清凭据,门 239 单调性) (227c4f01ca8)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (77583333a7d)
- 🐞 Fix:G-04 落地器水印预检改判「将要提交的那个 blob」(cat-file + 临时副本,豁免面按 REPO_ROOT 复算),不再判工作树盘面;76/76 + 23/23 自检 (62f7eb65c69)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d2938d435ca)
- 🔧 Chore/Other:B02 resync 切片进展注(rev PG 权威源+快照端点+gap 接线,160 例绿,剩余面 5 条登记)+ 结清 L7648(401→502 映射代裁,132 例绿) (4ed1a7edfa3)
- 🐞 Fix:第二处 G-948 回归 —— course/detail 入口桶文件次序(CI Build 已复现新冲突对) (e3635cc7406)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (22a3aaa5a7a)
- 🐞 Fix:更正 e6cfb5cf563 —— knowledge-rag 三处 query 局部成了死变量 (c15feca74b5)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c3e485ddf68)
- 🐞 Fix:存量 lint 红归零 —— 两个号池测试文件的 3 处 eslint error (e121b36c406)
- 🔧 Chore/Other:重结 D06 /review 票(回潮修复:union 归并带回旧行,7f20caf30f 已在祖先链;主席裁定代行) (2ef3c77ef93)
- ♻️ Refactor:返回键无障碍名改由 wrapper 注入 i18n(common.back) —— 共享层不再写死中文,消 scan-hardcoded-zh 增量(有意重引入 useI18n:此屏 UI 已下沉共享层后一度无取词点,现新增 a11y 标签需取词) (078dd7c8445)
- 🐞 Fix:L7648 非会话 401 被当会话死亡代裁结清(r25i 席)—— 口径:真 401 只有 api 鉴权层能发,过了 api 鉴权之后上游/内部 401/403 一律映射 502;唯一映射实现 errors/upstream-status.ts mapUpstreamOutbound(401/403→502+UPSTREAM_AUTH_FAILED,422/404/429 语义保留,区间外兜底 502 同 v1 先例);新错误码 UPSTREAM_AUTH_FAILED 走 codes.ts 注册形态(守门 206 零增量);ai-chat-stream 3 处主通道+v1-multimodal 2 处对外面+agent-extended 兜底 ??401 收窄 ??502 接线;response.error() 加可选 errorCode 三参(两参形状逐字节不变);测试 10 例(核心对照:上游 401⇒502 非 401 端到端+本服务鉴权 401 仍 401)+132 例回归全绿;typecheck 8/8;水印 7/7;遗留:同型透传点约 15 处逐点收编(helper 已就位,语义各异须单独核,不在本票授权面) (d42caa742a5)
- 🐞 Fix:生产 web 构建脚本补 node22-lts 候选 —— 原三条候选(C:\Users\Administrator\.workbuddy\binaries\... 与 D:\DevEnv\runtimes\node22\node.exe)在本机全部不存在,构建脚本 [FATAL] Node 22 未找到、生产 web 无法重建(2026-10-25 实测阻断一次全链部署)。本机实际在位的 Node 22 是 D:\DevEnv\runtimes\node22-lts\node.exe,已用它成功跑完 next build(7.3min 编译 + 类型检查,BUILD_ID=lGLze0tuCla8z1ZhrisTr,IHUI-WEB 自动重启正常)。SWC 在 Node 26 上 STATUS_STACK_BUFFER_OVERRUN 的老结论不变,只是执行者路径要按本机现读取值(AGENTS 首部七类机器事实) (d4d718cd813)
- 🐞 Fix:根治身份主体族缺陷 —— crew/knowledge 匿名越权,并装守门 242 杜绝回潮 (e6cfb5cf563)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5e39b95ebfe)
- 🔧 Chore/Other:D08 Agent Teams 协作协议 前置未解除进展注(goal-r2 2026-10-25 r2a 席) (49ee66a8f56)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (24b0a6e3b48)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7a9c9c6d33e)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2db12443a26)
- 🔧 Chore/Other:登记 P0 —— PG 备份链空转(IHUI-PG-BACKUP 服务未安装/sc query 1060;脚本已修到可跑且运行副本已同步,但无 03:00 节拍器等于没备份;出路=装 nssm 服务或由部署机承载+建只读 beifen 角色) (01ef2d5e6f8)
- 🐞 Fix:题面指纹 16→32 字,避免同前缀不同票被一并豁免 (1902f5ed847)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (612a65ee7cc)
- 🔧 Chore/Other:结清 L7209 门33 provider 名单票(2026-10-07 拍板②已落地单向投影消灭手抄名单,现跑 rc=0 九 provider 全识别,零改动) (420077e8337)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (336654db9d9)
- 🔧 Chore/Other:翻勾结清八票(服务定义入仓+基准维 self-test 90/0;门98 D6 维 rc=0;O01 孪生 0;USDT 两 env 非空;H04 三语 JSON OK;门112 双根齐;G-28 CI 接线 714efaa19196;G-61 镜像 76/76 且系被 heal 捞回再翻) (154404a1aa9)
- 🔧 Chore/Other:认领 D08 Agent Teams 协作协议(goal-r2 2026-10-25 r2a 席) (c4734de1ed2)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b1026855a81)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (61a536ce317)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2a5ce505323)
- 🔧 Chore/Other:精确摘除 A2 回潮的 4 条同题变体(按复合主键,不按 16 字题面) (ac77ba67992)
- 🔧 Chore/Other:结清 L7334 health 契约分叉票(代裁=web 读法对齐后端;backend-health 换真多服务端点+monitoring-dashboard 同型分叉同批清,入库 d107d57a2f;落地器瞬时判红的 scan-hardcoded-zh 复跑两面 rc=0,系并发索引中间态非本票引入) (87e3f1000e5)
- 🚀 Feature/Improvement:G-10 门接线 —— check-service-binary-paths 加仓内基准对账维(列出/在册/缺/启动类型/Application/快照过期六件事;只读只报数,不参与 computeExitCode,基准读不到或坏 JSON 记未判定);__test__ 导出同步加 normalizeStartType/parseServiceBaseline/compareServiceBaseline/readAndCompareBaseline/BASELINE_REL/SERVICE_BASELINE_PATH;补回 HEAD 的 F3 G-158 修正(isAllowedScratchRoot + gitFaceEscapesToRepo 两维);LAND_ALLOW_STALE 理由=复活守卫把席 J 新写的 const services=[] 与 2026-09-28 祖先同文本行撞车误判(已逐行核对:HEAD 内容零丢失,__test__ 两项为正常重写、旧导出名全保留);验证 --self-test 90/0 rc=0 全绿、基准行 列出3/在册3/缺0、全量 rc=1 为存量机器态 (cf4cda08c26)
- ♻️ Refactor:五站返回键/箭头收口到共享 BackChevron 与 LineIcon(零字形箭头);死副本 NavBar 只报证据不动 (1e63ced855e)
- 🐞 Fix:合并吞并门 A5/A6 不再把「机器生成块」翻新判成内容丢失 —— README×4 那次 reset 的唯一差异全在两枚标记块内,A5 只比 blob 退回基底 ⇒ 恒红顶住提交链(§12e) (3888c3708aa)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1b8c99cb145)
- 🐞 Fix:check-c-drive-pollution 注册表读取换通道 —— reg.exe 被安全策略黑名单 spawn 时杀的是本 node 进程(RC=143),致 live-doc-edit/safe-commit 整条落地链断裂;改为先走脚本宿主读值、reg.exe 仅 IHUI_ALLOW_REG_EXE=1 兜底,读不到如实报未判定 (2500db80556)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3560fe13f58)
- 🚀 Feature/Improvement:补「用户增长」近 14 日每日新增曲线 —— 后端 buildBusiness 新增一条独立 catch 的聚合(createdAt + 8h 按上海日界切分,与 usersTodayNew 同口径;窗口 = shanghaiDayStartUtc(13) 起含今天),查询失败整块 null 不渲染(§0.3 不把"没量到"画成 14 根 0 柱),成功则按 shanghaiDateString 逐日补齐 14 天、无行日期填真实读数 0;前端 BusinessSnapshot 加 userGrowth 字段 + userGrowthOption(CHART_CYAN 面积折线,62px,与签到 7 日图同族),业务面板左栏用户三格(注册/活跃/今日新增)之下紧接增长曲线;packages/i18n 五语言补 userGrowth14d 键。验证:api/web tsc --noEmit 均 0 错、check-i18n-keys 5 语言 parity OK(19156 键)、门 240 --worktree R1-R8 全绿、verify-wallboard-readout --self-test 12/12 (1fb444802bc)
- 🐞 Fix:文档数字门屏蔽 RECENT UPDATES 块 —— 自动抄来的「176 llms → 101 llms」是历史陈述,不是当前总量声明 (be12ee7a531)
- 🔧 Chore/Other:侧车再对齐 3 条(并发新行;bucketsDrift=0,回读 79 条) (521c75d74f0)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (155d311e600)
- 🐞 Fix:L7334 health 契约分叉清偿(web 读法对齐后端,后端契约不动)—— backend-health 页换读真多服务端点 /api/admin/monitor/services(r25h:原 apiOrThrow<ServiceStatus[]>('/api/health') 把单对象当数组,.map 必空;新端点 requireAdmin 回 success({list}),ServiceStatus.status 补 running 档+删后端不存在的 message 死分支+ICONS 键对齐后端 name+健康判定 !==unhealthy);同型隐患同批清:monitoring-dashboard 页(该端点回 {list} 信封而页按 ServiceItem[] 读)——page.tsx 解 list、types.ts ServiceItem 补 running+ICONS 键对齐、MonitorStatCards 判定 !==unhealthy;tsc 全量唯一红在 r25d 在飞中间态文件(use-conversation-broadcast-sync)非本票面,本票 4 文件 0 错 (d107d57a2f7)
- 🚀 Feature/Improvement:D04 富文本动作锚点装车 —— 消息正文含锚点时走 RichAnchorText 白名单渲染(不进 rehype-raw),a/link 仅安全 URL 出真 href;5 例新测试 (83321dbba3f)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1312e8f5507)
- 🔧 Chore/Other:G-21 格⑤落格收口注记(agent-control 在飞图 CAS 驱逐+入口拒重复,枚 447e047a7b6 全量在注记)+④⑥证据刷新;租约按器物形态保留待 TTL 代摘,余格交回派单面 (1ef258d66bd)
- 🔧 Chore/Other:侧车搬说辞 30 条(抽取前后归属桶零漂移;存量 123→92) (c6e4dae08c4)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (571aa33dddf)
- 🔧 Chore/Other:翻勾结清三票(活动时钟单调:G-820/G-821 已在库 46e9a67095、session_store 九写入点全 max()、test_session_store 50 passed、值级探针 PROBE_RC=0;门13d 同行叠注记维已在且 --self-test 8/0+全量 rc=0、DUP_POINTER_RE 不扩字族仍成立;G-91 尺子②:audit-benchmark-delivery --strict rc=0、29 条/43 断言/未建档 0、三态 42/1/0) (e5037766201)
- 🔧 Chore/Other:r2-infra 落地链验证（黑名单程序换 PS 通道） (9e19de0f3fc)
- 🐞 Fix:补回被 73d1ed177b8 连带抹掉的 130 处 web 五语言键(workPanel / reviewTarget / captureTraeWeb / expertRoute / injectionKindExpertPack) (43c7ec0fd1c)
- 🐞 Fix:Build 步骤加 --force —— 消除 turbo 缓存把不完整 api-client dist 固化的通道 (a2a9f872342)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2120941b104)
- 🔧 Chore/Other:G-67 回填十条指针行逐条判定(4 条陈旧悬空可删 / 3 条主行仍活禁删)+两尺失明带 (8d2266f7367)
- 🔧 Chore/Other:F11 存量清零后刷新基线注记(24→0;地板仍为 []) (1a929de6660)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (474e1fe6ca7)
- 🔧 Chore/Other:G-29 第二十一批 10 站进展注(065957e4ae5,39→28)+ G-21 第③格完成进展注(cause 链脱敏代理入库) (66d3d39b442)
- 🐞 Fix:G-21 格⑤ agent-control 在飞图并发守卫(对齐上游 in-flight 合并+CAS 驱逐纪律) (447e047a7b6)
- 🚀 Feature/Improvement:G-21③ 诊断量代替原文 —— mcp-credentials.ts cause 链脱敏代理(redactedParseCause:JSON.parse SyntaxError 原文经 V8 短消息策略会整段嵌凭据片段进 crash-handler flattenErrorForReport 与 console.error 两个消费面;代理后只留位置数字诊断量,message 经 @ihui/shared redactSecrets 兜底,依赖已有未新增);新增 4 组威胁模型测试(裸 token/三段式 JWT/深处失败/正向对照)全绿;既有回归 mcp-credentials 族 105 + oauth 族 47 全绿;turbo typecheck --filter=ihui-cli 8/8;水印 verify 1/1 (5d9a026c9c9)
- 🐞 Fix:G-44 告警去重身份从整条消息文案改为「类别+归一化骨架」——16 个稳定枚举+时刻/路径/hex/数字归一,累计次数由既有 repeatNo 承载不进键;补 11g 读数漂移同槽/11h 异族不共槽;harness pass=44 fail=0、mjs 7/7、deploy-alert-dedup 17/17、门224 --worktree 与 --staged 身份抖动0(豁免1)/自检15,ihui-deploy.ps1 仅同步一行注释;ci: G-28 HEAD 面逐端 typecheck 接进 ci-monorepo.yml typecheck job(id=head-typecheck,45min,预算30min/单端10min),TRIAGE_IDS+O_HEAD_TYPECHECK 同步;本地实跑 rc=0(20端通过/已入库红0/未判定0,484s),YAML parse rc=0,check-ci-failure-triage-wiring --staged rc=0,check-gate-wiring R1/R2/R4 rc=0 (714efaa1919)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d85e4c530ad)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (f0c49713407)
- 🔧 Chore/Other:补删 F11 最后 2 条(题面维已装车,回捞应被声明挡住) (47bb7ea918e)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (87f3f8cbe2c)
- 🔧 Chore/Other:翻勾 G-22(F9b 畸形登记号维已在且进收敛闸,现读 0;四套件 145/181/58/82 绿) (ed0c8f671e9)
- ♻️ Refactor:G-29 第二十一批 10 站接 flag-value 单源(requireFlagValue 判死:漏值/坏值 exit 2 点名实得 token;纯函数层契约不动语义未变)—— i18n-messages-exist/--root、load-state-loaded-marks/--root、migration-immutable/--root、miniapp-build-artifacts/--dist、turn-ordinal-lock/--root、txn-cancel-boundary/--root、theme-prop-wiring/--root(旧裸取值改判死)、tool-contract-declared/--today、scan-upstream-models/--provider、sync-alpha-usage/--face;另修既有断裂:check-batch-write-count-honesty 补 3 旧出口转发(0ce9314545 拆层未留转发,state-guard 加载即炸);探针+30 支全 rc=2;镜像 10 套全绿;只读尺未接 39→28 (065957e4ae5)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (401f1715c77)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (804700feb24)
- 🔧 Chore/Other:翻勾 G-36(圆角死类名代码面归零+门77/150/235 三绿实证,余人工观感项) (f6cd572b1bb)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d1f9ff98905)
- 🔧 Chore/Other:结清 G-47 三红票(①端口门 rc=0②ruff 全绿两枚入库③lint 根因=产物目录缺 ignore 已补入库 7611a789c5;三格齐绿判据零放宽) (e1a6a59d5fc)
- 🐞 Fix:G-47③ 受保护检查 lint 红清偿 —— apps/cli/eslint.config.js ignores 补 dist-sea/**(SEA bundle 构建产物,gitignored,同 dist/coverage 性质;4072 个 lint error 全部来自 dist-sea/ihui.bundle.cjs 单文件,判据零放宽、产物退出射程);复跑 pnpm run lint rc=0,turbo typecheck 47 任务面绿 (7611a789c59)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (19d26c0a479)
- 🔧 Chore/Other:二次结清 G-61(首次翻勾被并发旧基线抹掉、回捞按未勾态复插;凭据 = object-space-land 镜像 76/76 两轮) (5a54bfaff50)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (536679efbc5)
- 🔧 Chore/Other:O02 第④格回填现读读数(BottomActionBar 20/InputArea 18)+最小第一步清单与拍板前置 (8b23d590bde)
- 🐞 Fix:G-47 ruff I001 清偿第二枚 —— mcp_server.py:5345 import 块排序(ruff --fix 自动归并同源导入块;上一枚 5b3c657347 因改动在工作树未随 pathspec 进链,本枚补交;uvx ruff check . 全仓 All checks passed) (9c092c779fd)
- 🐞 Fix:G-47 ruff 存量代裁清偿 2 处 —— tests/test_voice_tts_stream_router.py:26 F401 未用导入删除(该文件仅 1 个历史版本,删后 blob 不撞祖先,门 84 零风险;pytest 7/7 GREEN);mcp_server.py:5345 I001 import 排序(ruff --fix;改前三方比对确证幻影 M:索引 blob==HEAD 即 mtime 漂移非在飞);改后 uvx ruff@0.16.6 check . 全仓 All checks passed (5b3c6573477)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (217442aafad)
- 🔧 Chore/Other:G-47 ②清偿进展注(ruff 2 错代裁清:测试 F401 删+mcp_server I001 幻影确证后 --fix;ruff 全仓 All checks passed;①rc=0 现读;③全量验证在跑) (308796bfe5b)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2c35955af7d)
- 🔧 Chore/Other:结清 G-28 HEAD 面类型检查出口票(器物已在库 check-head-typecheck.mjs+镜像,self-test 23/23,零改动) (906c5d09603)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (fc12053235e)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (349253de0bd)
- 🔧 Chore/Other:回填四票进展注记(G-29 第二十批十站 / G-62 F5 问责恢复 / D08② 换手事件 / D06③④ 收口) (eb294fd9c62)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5ab90ce2d66)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (46ffaf48c13)
- 🔧 Chore/Other:G-21 挂租约认领(zcode-main@2026-10-25,按票面「派单时逐格可」逐格推进:先刷新六格证据核我方落点,优先③⑤⑥,①②量力另派) (48a465e21e1)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (df2dd29d170)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8bc3731623f)
- 🔧 Chore/Other:结清 D06 /review 票(「/new 仍缺」格经 r25a 现读裁定已由其后提交补齐:send-message.ts:983 注册 onReviewFinding+防回潮锁在;零改动,摘 r25a 租约) (7f20caf30fc)

**2026-10-25**
- 🐞 Fix:修 F3 自检恒红 —— 落点判据跟上 G-158 仓内 .DevEnv (1f9deae5c65)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (58111ebfb00)
- 📚 Docs:英文 README 数字对齐现算值 + 9 端/101 模型口径 (6d490805713)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1142cf1807d)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (fb7072816bf)
- 🔧 Chore/Other:清 F11 等人拍板存量 24 条(强制令代裁/摘行;逐条留证) (eb35b31d15d)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (62280da2286)
- 🔧 Chore/Other:D06 派发预填对话框用例(2 例) (2718e8749ce)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (e3686744ce8)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (60c64ebf80d)
- 🔧 Chore/Other:复结 5 条并集回捞复活体票(prod-bundle/G-33/G-34/桌面log/活动时钟;结清凭据均已在 plan-row-drop.jsonl,按门 239 单调性零改动复结) (508d7b632cb)
- 📚 Docs:全站口径对齐到 9 端 / 101 模型（对外文档+工程文档+发射器） (73d1ed177b8)
- 🚀 Feature/Improvement:D06 审查卡一键派发修复(DispatchSubagentDialog 加 preset 预填,复用既有 dispatch 腿)+ 3 例测试 (f5be4c99b64)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a58f8399d47)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1793b07844f)
- 🔧 Chore/Other:复结 L7657 键名对齐票(并集回捞复活体;2026-10-23 已有完整结清凭据,零改动按门 239 单调性复结) (3dbc8547e45)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (ab006eaae77)
- 🔧 Chore/Other:结清 G-61 僵尸票(套件两轮 76/76;heal 第三形态前置已由 da26f3624a 补齐,遂按票面自写终态摘除) (ec713677807)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (e5324f86b3b)
- 🔧 Chore/Other:翻勾结清 D13 主聊天并行工具调用票(行内已有 2 条结清注记:D119 只读并行预取在 HEAD、test 5 passed;goal-r1 主会话僵尸行清偿) (7ae7b2995b3)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (f210e8fd3ff)
- 🔧 Chore/Other:翻勾结清 G-25 工具结果三投影票(行内已有 3 条结清注记:result-tri-projection.test.mjs 6/6;goal-r1 主会话僵尸行清偿) (8c3e989381f)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b0418b09bbc)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (0f52a79625f)
- 🔧 Chore/Other:结清 line-loss 第三形态判活票(门71 已补该形态并入库 da26f3624a;HEAD 面 RC=0、self-test 73/73、镜像 81/81,A/B 证明未造恒红门) (7494794a005)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (e531eb4367c)
- 🔧 Chore/Other:goal-r1 认领 5 票加租约(r25a/r25b/r25c+r25e/r25d/r25f@2026-10-25,主会话派单防打架前置) (f881ee1c233)
- 🐞 Fix:门 55 修复第二次落地 —— 前次 d32263e707c 被 920fff8deb7 整体重写吞掉 (1cdbe49d9a6)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (cfa5c9ec9dc)
- 🚀 Feature/Improvement:D08 ② agent 换手结构化事件(kind/agent_id/summary/token_usage/ts,复用 subagent_* 帧)+ 14 例测试 + 端内覆盖登记 (35aa933f806)
- 🐞 Fix:live-doc-edit G-313 期末对账三缺陷修补(取材兜底/留痕链/手填号射程/正则泄漏) (cc0f35a4334)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (ae64a8112b0)
- 🔧 Chore/Other:复结 9 张被并集回捞的已结清票(origin 同步止血) (acbc383068b)
- 🚀 Feature/Improvement:G-62 恢复 F5 欠账名单问责出口(f5Deficit/f5SuppressedCredit 结构化返回,五档判据原样共存)+ 四臂测试 (c9684235f5e)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (db8223555c1)
- ♻️ Refactor:G-29 第二十批 10 站接 flag-value 单源(发布/运维脚本 requireFlagValue,语义未动) (a790c0d0a37)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (21a03a92fa5)
- 🚀 Feature/Improvement:端侧读数判据补 V3-V5(非等分宿主)+ 29 处收口 (b83d50c6344)
- 📚 Docs:端侧读数约束补 V3-V5(space-between 行 / absolute 容器 / 定宽格) —— 存量 23→69 处已归零 (10905ec50cc)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (49791979997)
- 🔧 Chore/Other:结清发丝线两尺合一票(hairline 尺 HEAD 面真分隔线存量 0 枚;a88793d3d1 已入库,凭据见行内注记) (38f0580dfca)
- 🐞 Fix:补 workPanel.popout 五语键(work-panel 独立窗口按钮引用缺键,i18n 全量档 rc=1 已复绿) (479d43bd68f)

**2026-10-24**
- 🐞 Fix:发丝尺严格指纹整体上收进分割线门族7(scanHairlineFaces 单源),hairline 门退化为适配层、旧 RN 循环与 classifyBgToken/HAIRLINE_AXIS_RE 退役 —— 两尺对同一枚文件读同一组枚数,等积清偿后计数只降不升,棘轮天然放行,零豁免零削尺;清偿最后一枚 RN 发丝线 HomeScreen.modelModalHairline(背景色画改等积单边描边,同中性档)。主席自证:两把尺 --self-test RC=0(64/64、19/19),镜像 49/49(hairline 20 + no-divider 29),与 HEAD 版同场对账 hairline 输出逐字零差异、no-divider 唯一差异=预筛面 1172→1465(覆盖面变宽,结论行不变);改名一处局部变量 sd→dividerHit 以避开与祖先行逐字撞车的复活判据(行为零变化,已复跑三件) (a88793d3d1d)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (aad49b8ece0)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (75f91b11f67)
- 🔧 Chore/Other:复结 G-29(并集回捞;blocking 口径已清) (18b6e8a5951)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (536ea8dd1c1)
- 🔧 Chore/Other:翻勾三条已带结清证据的存量(G-25 三投影 6/6 · prod-bundle 入库源 rc=0 · D13 只读并行 5 passed) (88f0c680baa)
- 🐞 Fix:剥开 satisfies 后暴露的 3 处端侧缺口 + web 断点陷阱 8 处收口 (00c9eb7343c)
- 🐞 Fix:收口 CI Build 唯一的红 —— community 入口桶文件 import 次序回归(票 G-948) (02bba4c2db9)
- 🐞 Fix:门 55 存量红归零 88/89 → 89/89 —— init_agents_md 补显示名映射与五语言文案 (d32263e707c)
- 🚀 Feature/Improvement:编辑器空态一键生成 AGENTS.md(双确认 + 失败明示 + 不带 output_path) (04cfdb7704f)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2ad9065cdea)
- 🔧 Chore/Other:waitFor/findBy 等待预算从"机器负载读数"改回"测试判据"—— RTL 出厂默认每段 1000ms,实测同一条链空闲 3ms／事件循环被占 1200ms 时首跳 1201ms,本机常年并发 200+ 道守门 ⇒ 122 枚 P1 用例 + 168 处无预算 findBy 的红绿由负载决定。单点杠杆 configure({asyncUtilTimeout:4000}) 落 mobile-rn/web 两端 setup(此前全仓零先例),两处手搓 helper 分身同步抬档;成对自证(旧预算红/新默认绿)+反向牙(永不为真仍红 4008ms)+回归 66 例全绿;g-469 那条 vi.setConfig 注释纠偏(它只抬墙上时间,一分不加给 waitFor 段预算)。落选方案:逐枚改 122 条用例 —— 足迹过大且与兄弟席在飞面撞车 (43ce93f1a80)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8d5b040ddba)
- 🔧 Chore/Other:结清 G-73(④a 根窗格续传回归已修,8813 clean 服务 8/8) (530e9116c74)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (ce9e0407489)
- 🚀 Feature/Improvement:流式 TTS 打断(VAD RMS + policy 驱动 abort) + CodeEditorPane 注册 store 级 reveal 出口 (12e5594f051)
- 🐞 Fix:根窗格续传 await 缓存后台复核 —— 修 ④a tail 静默丢弃 (cd7fb541cf6)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1ce426b999b)
- 🔧 Chore/Other:补挂本席认领牌(前枚只改到句子未插上牌,String.replace 收字符串时 ^ 是字面量) (fb1436f9ef2)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (94a236c6763)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (f15f35e92c3)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (cdfe4c03f8e)
- 🔧 Chore/Other:认领 line-loss 第三形态判活票(机主令全部收口,原注"属他人射程"让位) (761b1c7618b)
- 🔧 Chore/Other:复结 4 张被并集回捞的票 + D-07 同题行(D42046 已结清) (80332d96882)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1003b2a6b57)
- 🔧 Chore/Other:结清 16 票(A 档零改动;承载命令/测试已复跑) (058dd42d258)
- ♻️ Refactor:门 8 方法推导判据抽到 lib 单源 —— 补齐悬空 import 并钉 T7-T10 (88a9e46d799)

**2026-10-24**
- 🔧 Chore/Other:C8 死规则锚点下调 fractional 3→0 / total 14→11 —— fractional 族根治后重锚 (f09d1cbeb19)

**2026-10-24**
- 🐞 Fix:fractional 死规则根治 —— 1.5 档类串换等值 rpx 任意值(样式静默失效的真 bug) (51faca27a46)

**2026-10-24**
- ♻️ Refactor:27 份文件内 react-native mock 收归全局替身 —— 根治项落地(45 例红事故的复发通道封口) (8c2585ffe55)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (eec8e44473b)
- 🐞 Fix:摘掉 check-rn-readout-cell 的未用 import(改走取材层后 readFileSync 已无调用点) (3dccfd167ca)
- 🚀 Feature/Improvement:端侧「等分读数格」判据落地 + 23 处存量收口(门 241) (8ec3cfa172f)
- 🐞 Fix:门 150 弱证据 6 处代裁归位 + scroll-jump-spec 未判定清偿(§24 代裁,依据随附) (482cf8fe9c4)
- 📚 Docs:点名端侧读数格守门 241 —— §13.4 的两条判据与唯一写法 (a510448d379)
- 🚀 Feature/Improvement:/review 斜杠只读 diff + review-finding 帧注册 + 聊天 store 审查发现索引 + MessageItem 呈现 (12d98b1d88b)
- ♻️ Refactor:门134 词法层拆出 scripts/lib/batch-write-lexer.mjs(门103 C1 6117⇒5658 行)—— 459 行逐字搬运零改写:台面与 HEAD 版同跑对账 94 行输出 diff 空、--self-test 174 条全过、镜像 30/30 与 9/9 全绿;M13 形状锁的取材面同批扩成 门体∪词法层(只数门体会把"已搬到别处"读成"没有第二份"=把没判写成判过) (0ce9314545c)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6511981014b)
- 📚 Docs:删除「一格一读数」短版重复行(origin 长版为同条上位表述) (a7a78ce6229)
- 🚀 Feature/Improvement:CodeEditor 暴露 revealAt 句柄(行内跳转) + 审查发现卡 P1/P2/Nit 分组 (c9bdea170c5)
- 🔧 Chore/Other:长按二维码存相册两枚用例改「只等链终点一次 + 8s 预算」—— 机制实测:同步占死事件循环 1200ms ⇒ fireEvent 到首跳 1201ms > waitFor 默认 1000ms(空闲档同链 3ms),三段串行等待在并发跑 200+ 道守门的同机上必被打成假红;断言不减(requestPermissions/saveToLibrary 仍在,反向牙实测打断写库步照样翻红),连跑 10 次全绿 (e4989cbb9e8)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (81f924cd857)

**2026-10-24**
- 🔧 Chore/Other:重生成 web/miniapp ui-routes —— 清两枚 stale 自述钉(check:all 第 13 步红因) (c532c7bd028)

**2026-10-24**
- 🐞 Fix:门103 C1 行数天花板收口 —— git-guardian/check-batch-write 大块注释逐字归档换指针(零行为变化) (318240af9bb)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (dd0d3f1dcaa)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5a83a417d9c)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b48d16a5759)
- 📚 Docs:清掉「读数不得断行」点名行的旧版重复副本(并发写回叠入,旧版带已腐烂的例数,§0.1 数字现读) (d74139d8d07)
- 🐞 Fix:check-mass-deletion 去裸 git 兜底 —— 型 B 棘轮 3→4 回归 (384c797851c)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c377952bcdd)
- 🔧 Chore/Other:结清 G-84(裸 git 棘轮 60=基线) (bb80c4a27e0)
- 🐞 Fix:G-322 旗标单源收口 + 运维脚本空值静默回落堵死 (b73ed821234)
- 🐞 Fix:三处写死 git 落点改走 §5b 唯一出口(gitdir.resolveGitBin) + sync-tags 补 path/url import + 端内 dispatch 登记 onReviewFinding 缺席理由(web baseline 38→39) (9272aeb4c9a)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1b1648fe62d)
- 🐞 Fix:采纳对席圆角收口终版,消除 ScreenStates 双席分歧 —— 解开三方合并死结 (9a8202b5ae9)
- 🐞 Fix:origin 并集落地后回补 local 两处(门77 圆角 rounded-sm + 未用参数 _json) (aeaab5a5681)
- 🐞 Fix:门 150 七族 + 门 77 四处圆角存量清偿(wallboard 收尾 + ScreenStates/carte/account-pool/live 跨端同批) (718f6a413d6)
- 🐞 Fix:停靠浏览器 UI 状态改名规避门 223 规则 F(业务名词 session) (591733d9de7)
- 🐞 Fix:门103 D1+D2 消红 —— 三枚 RN 端内测试不再 import 门体(rank 40→90 反向依赖),迁移门判据断言收编进 scripts/tests T11;顺带修 T1/T3 夹具腐坏(原钉 AboutScreen.tsx,该屏今日 01:39 改薄壳并摘线) 对照实测:recruitment 两枚长按落相册用例在 HEAD 面同红(2 failed 9 passed)非本席引入 (afc8080a411)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (86f0588597d)
- 🚀 Feature/Improvement:D09 专家路由设置卡 + reveal 注册表 + review-finding 契约 (d6499fc8849)
- 🚀 Feature/Improvement:停靠浏览器 stop/home/pick 三命令纵向切片 + 五语种键补齐 (a78e4fcdc6d)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (81a851ac233)
- 🔧 Chore/Other:临时对齐两处同行冲突以让 union-converge 三方归并(随后回补 local 样式/命名) (c0d46b5ac03)
- 🐞 Fix:4 枚门改走 gitRaw(裸 git 棘轮 64→60) + 取号同题查重 + third-party-roots 非仓库误判根治 (a4f7931af5b)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (095537b1e58)
- 🚀 Feature/Improvement:D07 残余② 接入 init_agents_md + 钩子初始化纳入可中断语义 + MCP 工作区根守卫 (78f2e0bbeb7)
- 🔧 Chore/Other:结清 B07(步序四已在,服务端 fork 按产品定档不建)+ G-73 复验注记(④a 归因未判定,不翻勾) (5d507ec93d9)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d805b31cdae)
- 🔧 Chore/Other:结清工具面板开关窗格化(实现现读在位+单测 16 passed) (ebcbb85f038)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (63898cbb055)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7e66f217e14)
- 🔧 Chore/Other:goal-b15 轮42 B67 结清翻勾 —— 方案②落地(esc 头注跑法更正+global-setup SKIP 警示),现行跑法 esc 主体绿 (d2cd3276763)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a64e1d82386)
- 🔧 Chore/Other:结清 G-41 与门134 第二格(两处均零改动,判据现读已消) (5c9c0663ebd)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3005e32c336)
- 🔧 Chore/Other:结清 G-85(门100 A6 内容回退维落地) (0b38961892c)
- 🐞 Fix:半径档位表回归 7 处(门77 B1/B3/B9 + 门150 角色档 chip/card/control) (8892284497f)
- 🐞 Fix:B67 esc 跑法更正与 SKIP 警示 —— ①esc spec 头注更正过时跑法(旧版 SKIP+no-deps 已证不可行:③生态入口依赖 API 数据+SKIP 缺 globalSetup 副作用致①③协议弹窗不叠开,采样矩阵带seed三次3passed/SKIP三次2failed零反例),现行跑法=带 seed 全量;②global-setup SKIP 分支加 teardown 清库警示(不改行为);验证 tsc 0 错+水印完整+带 seed 3passed/3passed/2passed(第3轮1例波动如实记) (ef7bf0417ef)
- 🐞 Fix:门100 补 A6 内容回退维 —— 并发提交被合并吞掉时路径仍在、blob 退回共同基底,A1/A2 结构失明(G-85) (700de8ba1f5)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (30aa5bb3790)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (0c7f94d374d)
- 🔧 Chore/Other:goal-b15 轮41 esc SKIP_SEED 跑法发现登记候补票(采样矩阵零反例:带seed三次3passed/SKIP三次2failed;两方案出路+验收判据齐) (42daa5960d0)
- 🐞 Fix:merge-live-doc 无锚点追加分支逐行去重(README 尾部腐坏的根因) (da3095f0ad0)
- 📚 Docs:协作会话最小纵向切片设计稿落档 + §6「另批」时点回填指针 (56dd64658dd)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (af70399256b)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b70f553e967)
- 🔧 Chore/Other:结清 3 票(D13 只读并行 / 取消信号 hook 腿 / 窗格续传) (6d3c17ada9d)
- 🔧 Chore/Other:P10 逐条裁决登记 2026-10-24 孤儿删除引用欠账(复验 0 命中,不补发) (b7f3263b94e)
- 🚀 Feature/Improvement:D09 专家意图自动路由腿 — expert_route 规则分类 + llm 接线 + 跨端契约 + 五语言键 (b048e637e54)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5bf2a99586f)
- 🔧 Chore/Other:goal-20261024-Q 结账注记(G-26 与第3波覆盖面行保持未勾,余量逐条写明) (4194b5faf07)
- 🔧 Chore/Other:补 check-duplicate-policy-literals 的 render 崩溃回归镜像锁(源已入库、锁悬空两日) (1efd821c7d5)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c17625fb208)
- 🔧 Chore/Other:goal-20261024-Q 收尾批3 终读(门 105/184 归零、ui-routes 全 matched、终读读数) (2cedeff3541)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6158849f52e)
- 🔧 Chore/Other:web ui-routes 自述钉再按 HEAD 面重算(checkin/preferences 落地后),内容行零差 (8655bfb6c18)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (013cc1e82a0)
- 🔧 Chore/Other:结清 D06 结构化代码审查(选择器+事件+卡片+行级揭示) (e4d970ce070)
- 🔧 Chore/Other:四端 ui-routes 自述钉随公告/看板/密钥池页面落地重算,内容行零差 (7382127d478)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (0d73c8bf3eb)
- 🔧 Chore/Other:goal-b15 轮30 G-73 结清翻勾 —— 多窗格 e2e 真机核验达成(6 passed+1 flaky 如实记,四片主体全覆盖) (d07649d6537)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4cbf4faf66c)
- 🔧 Chore/Other:goal-20261024-Q 收尾批2(checkin 取词/edu 测试转绿/handlers 115 精读收口) (1fc16551d86)
- 🚀 Feature/Improvement:历史课程视频(G-921)现网挂载量算仪 check-learn-video-mount.mjs —— 只读尺子,刻意不进提交链 (24430b3a47d)
- 🐞 Fix:批量写诚实性的证据窗收窄到"被审那条写链"(F1/E1b),旧「同体放行」恒绿格钉成必红 (c587f6fbeef)

**2026-10-24**
- 🔧 Chore/Other:C8 死规则分族棘轮重锚 fractional 0→3 / other 12→6(total 17→14) (85e5c9c3166)
- 🐞 Fix:门 193 的 6 处 execSync 补 stdio + 豁免一条随删除消失的存量 —— 解堵推送链 (225fab254d7)
- 🚀 Feature/Improvement:分叉告警自带「已验证的补救」——把 7.3 小时的现场重判压成一封可粘贴的信 (61a4812fe3a)

**2026-10-24**
- 📚 Docs:全局 mock 替身加迁移指引 —— 禁止新测试再写覆盖式文件内 react-native mock (edc5bc43555)
- 🐞 Fix:media-tasks 手机档 5 列切断读数,并把 76 处存量的最坏格宽算清、登记断点陷阱 (44ba5d64476)

**2026-10-24**
- 🐞 Fix:清偿 RN 端剩余测试红至全量 1185/0 —— 全局 mock 替身补键两处 + 真回归复挂 VoiceNote + 路由档补录 + 契约随形态 (978a132bbdf)
- 🐞 Fix:长标签收进悬停口径,读数格标签不再折行 (bfd6ce46a49)
- 🔧 Chore/Other:按代码面重算 openapi.json,清掉 CI 的 ARTIFACT_DRIFT (d4d1065aab8)

**2026-10-24**
- 🐞 Fix:清偿 web 全量测试面 32 例真红(8 族根因,6739 用例全绿终验在跑) (d0ccb867450)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (92cda2bce94)
- 🐞 Fix:/api/internal/* 网络分域显式声明(根治 G-815989 判据在 CI 的红) (e65f374d8a9)
- 🐞 Fix:清掉 ruff 全量红(15→0),按 §5c clean→改→inject 保水印载荷 (a43d6eaec99)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (85bd4df8b50)
- 🐞 Fix:drop unnecessary 'tt' dep in course-planet loadData useCallback (CI lint:strict warning->red) (b560edce07d)
- 🐞 Fix:读数不得替「没量到」下结论 + 时间按数据侧时区 + 页头扫描线的横向溢出 (dab47611c97)
- 🚀 Feature/Improvement:大屏读数尺补五语言档,并把覆盖边界现读进文档(别把「已装门」当「已覆盖」) (0a6da8a0c1b)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b80203fb3e1)
- 🔧 Chore/Other:goal-b15 轮29 三行取证补录 —— S1/S2 e2e 真跑 3 passed(PG18 恢复后)+G-02 真登录态 200 取证(subagents/all 形状同票面期望) (5cdd3f80244)
- 🚀 Feature/Improvement:落地「停靠浏览器 + Trae 网页登录」自洽单元(build.rs 命令表补齐 10 条) (a7b3500f73e)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (88185c202b9)
- 🐞 Fix:旁路落地器接「落地后复跑受影响判据」(G-113) —— lib/land-gate-rerun.mjs 与两台落地器同批入库 (afe67708b50)
- 🚀 Feature/Improvement:D11 语音打断腿 — /voice/tts/stream 逐段 NDJSON + voice_barge_in 打断判据 + 22 例测试 (31690b4cb74)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6b5b56ceb24)
- 🐞 Fix:relay 号池「上游明确拒收」三处断链补实 + 产出面键集契约回退 (99db9d24126)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (488d3ed3724)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b9bb78319fb)
- 🔧 Chore/Other:goal-b15 轮20 G-81 结清翻勾 —— 病面已由 G-876 席修复(code zod 必填+verifyCode 统一入口,枚 9e103ac0f6),auth 1311 全绿复验 (384058380d8)
- 🐞 Fix:门 71 抹号/折算位数上限 4→6(止血换号被自愈回插)+ D42046 归位 D-07 (c8d64eb3f27)

**2026-10-24**
- 🔧 Chore/Other:删除存活清单登记 6 枚清偿归档件 —— 对侧 plan 清偿工作的正当产出面 (760811fa380)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1094e57f254)
- 🔧 Chore/Other:goal-b15 轮18 G-05 伞票翻勾 —— 真剩 0 点(全迁讫/豁免/在飞归其线),两轮勘正证据在前两注记 (e5c1fb6ffe5)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (69b5177b03c)
- 🔧 Chore/Other:goal-b15 轮18 G-05 二次勘正 —— archive:684 实为镜像注入点设计豁免(注释明记刻意不走 gitRaw),伞票真剩 0 点可翻勾 (460870ed01a)
- 🔧 Chore/Other:goal-b15 轮18 G-05 伞票侦察勘正 —— 名单实况:wire-strictness 已迁净/两枚剩注释/archive 真剩 1 点(:684 rev-parse),真剩量=1 枚 1 点 (de2ec569bb7)
- 🐞 Fix:清除最后两处不合规声明号 —— G-27 同号异题拆号 + D42046 超池归位 (d9b060d47b0)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (31e25f5d46b)
- 🔧 Chore/Other:test+fix(gates): D/E 簇收口 —— 生产签出外来工作多通道发现 + 提交链三门成套 (b7ae8b5f9c3)
- 🔧 Chore/Other:goal-b15 轮17 裸对象语义验证半结清 —— 信封层:814 整条 body 作 data;实测 health 回对象非数组,web 按数组读分叉实锤;主格对外契约维持等机主定档 (bdbb697d25d)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (48c7e2ebffc)
- 🔧 Chore/Other:结清 D09 意图自动路由(后端三格+设置项+i18n 漂移归零) (1b0545b8087)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (ed597393295)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4c159340f5f)
- 📚 Docs:G-17 本侧行改写为与 origin 逐字同一(取超集那份,独有票号集为空零丢失) —— 清掉 union 归并放大的同题两版,解 origin 分叉收敛的唯一卡点 (524492f05a4)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8b0efe63dfd)
- 🔧 Chore/Other:goal-b15 轮15 G-02 服务面取证注记 —— 三枚路由存在性实证(401/403 非 404,枚 2704c4d27 旁证),剩真机+真登录态两半阻塞 (c0afe3fbb62)
- 🐞 Fix:取号器撞号镜像跟随两位数池 —— 自有段改 G-90~G-99,号域 92/93/94 (643cb24607b)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (ae257603ca5)
- 🔧 Chore/Other:goal-b15 轮13 发丝线票实测注记 —— 最后1枚(RN面)按配方改写实测两尺互顶(hairline 0 但 no-divider 族6 新增红),已回退归两尺合一前置 (d9d660cd034)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b3f44518f62)
- 🔧 Chore/Other:goal-b15 轮12 发丝线票进展注记 —— 类面存量 31→1(97% 清偿),剩 1 枚+RN 12 枚(判据前置归门 11d 线) (9648a28f188)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (92dcc9ae069)
- 🔧 Chore/Other:结清 G-09 + 记进展(D06/D09/连续语音) (2e9da27db61)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (9b0c51ac1a6)
- 🔧 Chore/Other:goal-b15 轮12 G-98 结清翻勾 —— 三盲区判据均已实现(族6 RN对象/族5 css块+SCAN_GLOBS/任意值分流),self-test 62/62+镜像 29/29 (a4bf8f4d9d9)
- 🔧 Chore/Other:web ui-routes 输入钉全量按 HEAD blob 重算(含 settings/preferences),内容行零差 (7f79d643697)
- 🐞 Fix:编号收口最后两枚超池号 + 门 71 抹号表补齐 H/I 族(止血"改名被判丢 → 旧号回捞"的重复副本) (f040d776c97)
- 🐞 Fix:批量档判定归位 lib 单源 + 隐藏启动包装器改为等待子进程(根治 54 枚常驻的第二半) (3c75fceac5f)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2d4cd563392)
- 🔧 Chore/Other:goal-b15 轮11 钩子取消腿结清翻勾 —— 票面判据达成:toolCtx 在 HEAD 三处全换+取消证明 4/4+tsc 0 (cfae8d75b61)
- 🔧 Chore/Other:relay 导入 mock 收形为单点返回 (2d4a7389463)
- 🐞 Fix:修复两处镜像测试回归 —— 单源锁断言跟随 declaredKeyOf;A4 真实形态夹具改用生产件 (f79c2700d66)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (165a0e5db64)
- 🔧 Chore/Other:goal-b15 轮10 G-865 结清翻勾+勘正 —— 摘键早已完成(键不在/真实使用 0/命中全为历史注记),轮 9『4 处生产消费』注记系 grep 误判一并勘正撤回 (db3e31f1276)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a0de770a095)
- 🔧 Chore/Other:goal-b15 轮9 G-865 前提已变注记(不翻勾) —— 现读 4 处生产消费方,摘键前提不成立;迁 initials 需另立票连带 4 消费点+2 测试 (9e6a3784e45)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7cacd399613)
- 🔧 Chore/Other:goal-b15 轮9 三行齐翻 —— G-95 二翻(带回后复翻)/真机走查孪生齐翻/tmpdir 复验 clean RC=0 结清(摘牌回单残留) (b35fe9057d0)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (0d1f26bad03)
- 🔧 Chore/Other:goal-b15 轮9 G-93 结清翻勾 —— 高置信死候选族已被清偿(门全绿+点名族 dump 零命中),参数段未判定为设计形态非债,未写基线未塞白名单 (eb0aa674627)
- 🐞 Fix:嵌套 ref 存续层改走批量快照 —— 逐条 rev-parse 把守护堆成 54 枚常驻 (4dd635da6f8)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b3f335ec303)
- 🔧 Chore/Other:web ui-routes 自述钉再按 HEAD 面重算(wallboard 页已落地变更),内容行零差 (378bbb69530)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6dde87431a9)
- 🔧 Chore/Other:goal-b15 轮8 G-94 结清翻勾 —— 探活靶已改 www 真腿(旧靶留名防洗),self-test 76/76 RC=0 (dba7da727ff)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a3e8582d50e)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (9100369ad60)
- 🔧 Chore/Other:goal-b15 轮7 G-95 结清翻勾 —— G-963 席已修(闭包两型+递归不动点),f9 复跑 10/0 全绿 (8c9f59a6a7b)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c8df54169c3)
- 🔧 Chore/Other:goal-20261024-Q 收尾批注记(门128红臂收口/门105产物钉/门98孤儿/i18n离线包/mobile-rn 编译断点) (356cc2e269e)
- 🔧 Chore/Other:结清「锁初始化写全再原子可见」留挂的 deploy-lock flaky 归因格 —— 实现/接线/入树三件早已达成(scripts/lib/lock-atomic-init.mjs 在 HEAD,git-lock.mjs:1017 与 deploy-lock.mjs:1024 接线,镜像 15/15);该格当年(10-21 复量)本机未复现而不肯判结,今连跑三轮 node scripts/deploy-lock.mjs --self-test = 自检 143 条 pass 143 / fail 0 ×3(较当年 95 条规模已扩且无漂),按 §1 待拍板条目由 agent 代裁结清;票面路径 packages/services/... 系上游研究副本非本仓文件 (f4c42d8281b)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (028e03fabba)
- 🔧 Chore/Other:goal-b15 轮7 G-78 结清翻勾 —— DRIVEROOT 同族残留已清(注释收口+硬编码零命中+宽 grep 零残留+测试 0 fail) (fdfa25b86ad)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (54c3de6903b)
- 🔧 Chore/Other:goal-b15 轮7 G-97 结清翻勾 —— 原生弹窗已清偿(门两面存量 0/RC=0,grep 零命中),45 处由他席清完 (e1a6f90e613)
- 🐞 Fix:修 i18n 扫尾引入的 4 处编译断点(t 未注入/映射函数缺参/误插 appAlert 按钮/res 未定义),双包 typecheck 归零 (ff5d0aec431)
- 🐞 Fix:编号形态再收口 —— 只改重号与超池号(合规唯一号一个不动)+ 映射多跳合成 (de8b7748775)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (83fb6c8d37c)
- 🔧 Chore/Other:goal-b15 轮6 G-89 补翻 —— isError 语义已在 HEAD(g-692 专项全绿,mcp 族 270/270) (6a73359c174)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1e162a7f917)
- 🔧 Chore/Other:goal-b15 轮6 五票结清翻勾 —— G-87 stderr 监听(S17 取证:实现早已入库+正式结清过,MCP 族 270/270 复验)+G-88/89/90 MCP 三连票(实现全在 HEAD 专项测试本轮全绿)+G-92 四门 isDirectRun 守卫(已治理:点名门双真+门 193 两面 RC=0) (635f2cfc96b)
- 🔧 Chore/Other:补 revokeCollaborator 终态守卫直接测(G1-G4 四例) (15e75cfc11c)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (461dc0045f9)
- 🔧 Chore/Other:goal-b15 轮6 G-83 结清翻勾 —— 代码侧全绿收口(摘假图标+如实提示+接收腿 14 例+全量 1000/1000),剩余四项结构性人工窗(后台白名单/CSP 决策/真机时机)以注记交代 (84e0e39cddd)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a511a294315)
- 🔧 Chore/Other:goal-b15 轮6 G-82 结清翻勾 —— Passkey 前端全链已装车(依赖+组件动态 import+web 两端点消费),测试 12/12 绿+tsc 0 错;§9 小程序平台豁免随注记 (af81e257cbc)
- 🐞 Fix:编号形态再收口 —— 只改重号与超池号(合规唯一号一个不动)+ 映射多跳合成 (7fbab3acb27)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5008ce95cda)
- 🔧 Chore/Other:goal-b15 轮5 G-80 结清翻勾 —— qoder-时间序席 10-23 四条凭据完备(死键撤净+判据锁 4 例绿+动态候选分类+阳性对照),漏翻补翻 (28066980993)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1f764234f31)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d31afcdd3ea)
- 🔧 Chore/Other:goal-b15 轮5 G-86 结清翻勾 —— 正解①已落地(G-807:写侧显式置过期+判定不吃 mtime),本轮补票面验收 10 连跑 pass=10 fail=0 (e9b299ef92b)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (05d93223ee3)
- 🔧 Chore/Other:goal-b15 轮5 G-46 结清翻勾 —— 三批全收口(批1 381行/批2 证伪留原地+F5退役/批3 491行+幂等0),sha 链与工具全在库,收口漏翻补翻 (de2c8ee99a3)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (e008db090f6)
- 🔧 Chore/Other:goal-b15 轮5 O03 二翻 —— 已裁决回捞残留(66f91ad2a1 批内撤销取向=维持告警+降档,凭据链完整),守门 71 回捞带回未勾形态,复验后二翻 (5645c20065a)
- 🐞 Fix:全族按文档顺序收口两位号 —— G 族 104 条压回 G-01..G-99 + 溢出族 H01..H05,D 族三条超池号归位 (6fb923cbe18)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5a05a498410)
- 🔧 Chore/Other:goal-b15 轮4 G-41 结清翻勾 —— 生产接线落地(runAgent 订阅事件流+形状锁 3 例+32 臂全绿),四态终态+真打断全线闭环 (716cba159de)
- 🔧 Chore/Other:ui-routes 自述钉按 HEAD 面重生成(web wallboard / 小程序 ScreenStates),内容行零差 (f3902194d2d)
- 🐞 Fix:门 98 悬空具名导入清零 —— 删孤儿测试 __tests__/organization.test.ts(其被测模块 routes/organization.ts 在 HEAD 已不存在,全仓仅此文件引用 organizationRoutes;工作树已删除、此处落地固化),避免测试收集阶段解析失败 (686d9650c28)
- 🐞 Fix:A2 占位改指真锚点 —— AGENTS_compact-2026-10-21.md 从未入库,改指 AGENTS_trim-2026-10-21.md (c2f584a7bef)
- 🚀 Feature/Improvement:G-41 钩子事件流生产接线 —— runAgent 订阅 onHookRunEvent(实现层 d4f8ba336b 事件面的首个生产消费者),terminal 事件落终端结构化行(json 模式静默),finally 在 runSessionEndHooks 之后退订;§30 生产侧终态出口自此可填;形状锁 g41-hook-run-events-wired.test.ts 3 例防静默摘线;验证 tsc 0 错+g-424 9/9+形状锁 3/3 (ecf6e73678f)
- 📚 Docs:补回 7 份归档件 —— 归档门 A1/A2/A3 落空清零 (090eb4f8406)
- 🐞 Fix:README 数字同源对账 —— 生成块换成 HEAD 面现算段(trackedFiles 15939→16000、testFiles 3163→3179、guardianGates 273→274、guardianBlocking 250→251、apiRoutes 4562→4556、apiRouteFiles 624→623),末尾 6 行散抄同步改正;守门 173 复绿 (0c072b523e1)
- 📚 Docs:补回 6 份归档件 + 快照锚点改写 —— 归档门 A1/A2/A3 落空清零 (7e888a5fe96)
- 🐞 Fix:README 三处指向已删镜像仓的死链清掉 —— §5b 弃用镜像后 Gitee 仓库根链接与 GitCode 死仓 URL 都是死的,改为一行「2026-10-23 已弃用并整仓删除,只保留 GitHub 一处源」;守门 238 不入射程 (3c0fa1ee34f)

**2026-10-24**
- 🐞 Fix:清偿测试面 31 例真红 —— 共享层 ScreenStates 动画族打盲 RN mock + 登录门没 mock + 回潮副本 (86b577c1e3a)
- 🐞 Fix:端侧读数格同锁「整格换行不切数字」—— Income/Usage/Dashboard 三处共享源 (76cbb78d28d)
- 🐞 Fix:补齐大屏状态词五语言 + 读数列宽档按实测下限收紧 (fa2615ca274)
- 🔧 Chore/Other:web ui-routes 产物按 HEAD 面重生成(旁路落地不跑写回钩子的必然残差) (df63e36ac5f)
- 🐞 Fix:ScreenStates.taro.css 的水印改回 CSS 合法注释形(解门 95 活恒红) (f6a1b7e646d)
- 🚀 Feature/Improvement:门 240 R8 把「大字号读数必须 nowrap」推广到 web 全仓 —— 差值棘轮不造恒红门 (aec90201d40)
- 🐞 Fix:大屏读数不断行收口全 49 格 —— 补掉上一枚只修号池留下的自伤 (463dbd44e4d)
- 🔧 Chore/Other:号池换 Key 补 handler 端到端锁(密文可解回新值 + 健康态同批复位) (dc481b7d6f0)
- 🔧 Chore/Other:四端 ui-routes 产物按 HEAD 面重生成,收口门 105 的 G5 陈旧钉 (cf618b89bf3)
- 🚀 Feature/Improvement:号池 PUT 支持换 Key 并复位健康态,admin 页补「替换 Key」入口 (b40c09c125b)

**2026-10-24**
- 🐞 Fix:MCP_WORKSPACE_ROOTS 空值回落 cwd —— 根治 patch_root 全量序 503 污染(生产配空值同病) (cdb68fbb360)
- 🚀 Feature/Improvement:大屏读数不得断行 —— 号池面板「6天19小时」被切成两半的三层成因根治 (94234605561)
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
