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

Headline claims (same source as the table below, all live-computed): **603 tables · 4551 API routes ·
25 WebSocket endpoints · 118 catalogued LLMs · 38 platforms auto-publishing · 3129 test files ·
271 engineering gates · 49 CI workflows · 5-language i18n parity · 9 app packages · 16 shared packages ·
14 compose services**.

<!-- BEGIN GENERATED NUMBERS (node scripts/gen-doc-numbers.mjs --markdown) -->
| 指标 | 现值 | 取数键 |
| ---- | ---- | ------ |
| 数据库表 | 603 | `dbTables` |
| schema 文件 | 232 | `dbSchemaFiles` |
| API 路由 | 4551 | `apiRoutes` |
| 路由文件 | 622 | `apiRouteFiles` |
| AI 服务路由 | 582 | `aiServiceRoutes` |
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
| 测试文件 | 3127 | `testFiles` |
| CI 工作流 | 49 | `ciWorkflows` |
| Compose 服务 | 14 | `composeServices` |
| 工程守门 | 271 | `guardianGates` |
| — blocking | 248 | `guardianBlocking` |
| — warn | 26 | `guardianWarn` |
| 跟踪文件 | 15856 | `trackedFiles` |

上表由 `node scripts/gen-doc-numbers.mjs --markdown` 生成,最后核对日期 2026-10-23。
每个数的来源就写在取数键旁边的实现里(`scripts/gen-doc-numbers.mjs` 的 `SOURCES`),**不得手抄、不得另立第二份**。

<!-- END GENERATED NUMBERS -->


## Recent updates (auto-maintained)

<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->
**2026-10-23**
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (485a183354)
- 📚 Docs:登记一条可派单票 —— 号池凭证到期字段与上游接受态背离(库里记未来时刻而上游当场回 401),出路是换票被拒时收敛该列并让巡检按同判据降级;余额档已改为不依赖该字段 (049f177588)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b926b99b36)
- 📚 Docs:就地更正号池可观测行里"按到期时刻触发刷新"那句 —— 真号实测该字段不可信(上游已回 401 code 1001 而库里记的是未来时刻),现行判据是上游当场判鉴权失效才换票重试一次 (a9215ca573)

**2026-10-23**
- 🐞 Fix:余额自愈改由上游鉴权标志触发,并以真号回包量出库里到期字段不可信 (11e5dc625e)
- 📚 Docs:收编 README 四语面 —— §21 域页导航覆盖(/domains/ai、/domains/personal 按域速览) + 发丝分隔线清理配套 + FAQ/Keywords 改挂 docs/engineering 索引 + 生成块数字对齐现算(2026-10-23) (237864c1d5)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (fde93239bf)
- 🐞 Fix:门105 web ui-routes.generated.ts 自述钉重生成收stale (0166dd30b5)
- 🐞 Fix:settings notifications/privacy 登录态三态门 —— ready 未就绪显加载而非误踢未登录(与签到助手/favorites 同型,useAuthGate.ready HEAD 已导出) (f9b56e4278)
- 📚 Docs:门207瘦身——守门历史/取证叙述与收敛带回重复副本整区归档(AGENTS_trim-2026-10-23b) (8307ff098c)
- 🔧 Chore/Other:收编死席遗留守门/测试簇 —— G-322 flag-value 单源断言补全(R3 CLI 档) + 新增只读尺 hairline-separator/plan-fragment-rows(未接提交链,§12e 设计) + 11 门体/lib 与 7 镜像测试更新,逐件自测/镜像测试全绿 (ea0fb180f0)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b4be005b4a)
- 📚 Docs:翻勾背景色发丝线判据票(分割线守门族4/6形状重载补档已落地) (086fe3491c)
- 🚀 Feature/Improvement:分割线守门补背景色发丝线判据(族4/6形状重载·L29015)——三型结构件机械排除+RN对象块档并入差值棘轮 (c45c9c0bb8)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (285b0f5b69)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4c0462af2b)
- 📚 Docs:族归并 + 立因叙述压缩,体积 102,084→85,755 字节(余量 10,245) (0f47cbeed6)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (f3c07eb17e)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (0cd065958d)
- 📚 Docs:结清 G-924 小程序远程图标注册表死键滞留行(四条现读凭据) (8c67ae715c)

**2026-10-23**
- 🐞 Fix:摘除被收编捞回的 plugins-data 残留副本 —— 解 HEAD 面 12 处 TS2307 悬空引用 (75ba36d703)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2ac0f9c6b2)
- 📚 Docs:号池可观测票两格收满并纠票面错述 — ①「fusion judge 腿无主体不写行」经现读与代码不符(gateway 触发 combo 处已显式下传 billing_user_id,两处 judge 经 kwargs 拿到同一主体,3 枚用例钉住);②config_id 取既有 bigint 列零新迁移。同批记入号池上游余额按需点查两枚(trae 与 qoder getQuota;过期票先走调度器同一把 refreshOne)。翻勾仍差票面验收第 3 条(真跑一次网关调用后 llm_call_logs 命中腿字段可查),该行保持未勾。 (9c0cdc5c67)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8d7d6440af)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (10f12f561d)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1dbaa32547)
- 📚 Docs:结清「另有 7 个脚本的 self-test 仍走 os.tmpdir()」滞留行 3 枚(含 1 枚 F4 指针行) (1c947c216f)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (80ec7a548b)
- 🔧 Chore/Other:Esc 无层栈协议补上真机档,并量出它判得到与判不到的两维 (edc008bf94)
- 📚 Docs:摘除收敛期回潮的旧口径压缩说明行,体积 89,544→89,057 (b4a9496821)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (e5c1807696)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4b9fb09999)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (94e6292b83)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7feef45a4f)
- 🔧 Chore/Other:翻勾「锁初始化写全再原子可见」(lib 入树 + 两锁各 2 处接线 + 54/54 含真进程并发对照) (f7d3a945c2)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (425cb2c503)
- 📚 Docs:Esc 无层栈协议 —— 真机档交付两格并写明余下一格的判据边界(附变异矩阵读数) (ff6181c4fc)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (9b9bc1ab26)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1287fefa94)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (865a55d6ce)
- 🔧 Chore/Other:G-343 翻勾(盘根/PG 落点私有推导四处残余现读已闭环,镜像 59/59 反向锁在场) (8d2ac1a574)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (f748dc87f4)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (e78e341fc9)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (9c77e05e29)
- 🔧 Chore/Other:G-929 翻勾(旁路落地器镜像套件现读 76/76 全绿,他席已修本席复核) (a1959b4d3a)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3352407e2b)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (ce1b8cf95b)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (dbfe3aa4e0)
- 🔧 Chore/Other:G-239 翻勾(门 194 存量清零,第 5 枚 auto-commit-quiet 补守卫) (de5dcdb6f0)
- 📚 Docs:压缩 AGENTS.md 96,531→88,993 字节,清偿门 207 超预算红 (0f9d7af1ce)
- 🐞 Fix:auto-commit-quiet 补 §22d isDirectRun 守卫与 __test__ 判据导出(门 194 存量清零) (cbf84dc055)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3e792853fa)
- 🐞 Fix:漂开副本归并(--merge-drifted,人工点名持有行后 N→1) (81e91aa2c5)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (641c0a8195)
- 🐞 Fix:漂开副本归并(--merge-drifted,人工点名持有行后 N→1) (fe5b3b23c4)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1363080ec9)
- 📚 Docs:结清三票——恢复器用例 10 连跑全绿 / 小程序远程图标死键 / 无编号漂开行归并出口 (5d9c161869)
- 🔧 Chore/Other:alipay 配置判据用例跟上"私钥真读得到才算配好"——假路径改判 false,补真实可读文件正向例(反向锁不许修成一律红) (1a50193483)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (67d786124a)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (dc1e29551a)
- 🚀 Feature/Improvement:派单入口新增「时间序档 order=late」,出单顺序改问仓库 (b40fb20c3e)
- 🔧 Chore/Other:V3 #52 RAG 真重排补 tests/test_reranker.py(46 例:RRF 手算断言/去重聚合/关键词单路降级/LLM mock 失败降级链) (42aeb1d040)
- 🐞 Fix:readme-sync 镜像补溯源水印(HEAD 缺载荷,CI 水印红第 3 次复现) (76bf5cabf9)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c04a01c3a5)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d56ce2b511)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (62c289f65e)
- 🔧 Chore/Other:重生成 ui-routes 派生自述钉(union 合并后输入面已取对侧) (df8e576f68)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (609106eac9)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (21812f4e57)
- 🚀 Feature/Improvement:大屏补 Relay 号池健康组(deep-pipeline 11 板 + overview 头条行) (4c3c012fdd)
- 🔧 Chore/Other:G-926 收口:articles/ 不再整体忽略(宽式规则无挡之物) (a402f50043)
- 🚀 Feature/Improvement:中转号池健康 gauge(key/账号两表四档健康态 + 显式丢失 + 失败不写空) (6bda68dcae)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c468db756e)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (20fe4e4dd9)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a71e95072e)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (08ef43589d)

**2026-10-23**
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a703a69a8e)
- 📚 Docs:修本席刚写错的一处证据指针,改判留痕改指全 40 位可取回的那枚 (e7fb235acb)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (da9bd67811)
- 📚 Docs:更正本席 13:34 写进 G-14 的错读数并补 O 族有空号这一实测事实(本票不翻勾,差的格子写明) (901f21bb30)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (eef5d3dc41)
- 📚 Docs:把同号多题存量今日重测就地并进持有行 (ca44c32ee3)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (9338d10c44)
- 🐞 Fix:漂开副本归并(--merge-drifted,人工点名持有行后 N→1) (1a15e4841a)

**2026-10-23**
- 🐞 Fix:网关流水带上命中的 provider 配置行 id,并把 fusion judge 腿的主体传递钉成用例 (8368505b62)
- 🐞 Fix:挂牌判据补第四型口径漂移——半角括号里的租约不再隐身 (f13bfd0db1)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (203cdbbcfb)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3d6190a5a2)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3f1ec1e02d)
- 🔧 Chore/Other:结清 G-79 的 31 枚内容红——所在 15 个文件现读 389/389 绿 (7b86a39b3d)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (aefb0b62b2)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4c82694a39)
- 📚 Docs:把 G-322 两站被镜像反向锁钉住的前置格就地并进持有行 (ddff78a208)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (bf3783fca2)
- 📚 Docs:§5b 自愈行点名"删除意图到期档"——先问留痕账再决定让路还是回盘 (89763f6d21)
- 🔧 Chore/Other:摘除根目录一次性扫描草稿 candidates2.txt,按门 99 通道登记具名豁免(带 reason) (ba517478df)
- ♻️ Refactor:格式棘轮门的带值旗标改接单源判据,不再自算 argv 下一位(G-322 warn 档一站;自检 30 例、探针 26 例、eslint 零 error 全绿) (5b9c8058f7)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (9b63a78b6b)
- 🔧 Chore/Other:写回四端 ui-routes 派生钉 —— 生成器输入面现读全部与 HEAD 同形，重生成只清陈旧钉不改语义 (ab7c343a12)
- 🐞 Fix:存续自愈的删除意图保护只看该路径最新一条留痕——陈旧那档不得永久护着 (edef1bce7e)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7646bc4b3c)
- 📚 Docs:给侧边栏收敛批次补进展注记(六大域第二批已入库,余跨端对齐) (f7910fb15d)
- 🔧 Chore/Other:侧边栏档位对账锁 —— 逐条钉住 HEAD 直标 31 枚在收敛后仍为 27 枚直标加 4 枚经继承,有效可见集逐字相等 (7de6d11fe4)
- 🐞 Fix:工作区存续自愈加"删除意图到期档"——摘标超两小时仍缺的文件回盘,意图逐字转进同一本账 (09a647d761)

**2026-10-22**
- 🐞 Fix:Button 门本地直调不受专项档跳过——索引面 0 候选直接绿,执行点真装车 (9a96efd75e)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (0e4621c90a)

**2026-10-22**
- 🐞 Fix:反代号池领取按钮改用 xs 档——移除 h-7 覆盖,守住门 235 的 HEAD 零存量 (457bec27c7)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (452d031ea7)
- ♻️ Refactor:G-965 投影第二批 29 枚——放宽存量长行、侧车 owner/等待条件复算后可投影 (c02c02763d)
- 🔧 Chore/Other:gate-scope 注释经 prettier 归一(前枚应急路径跳过 lint-staged 的补账) (b27c490866)
- 🔧 Chore/Other:侧车记录复算——修 10 枚截断 owner、补 9 枚等待条件(桶零漂,19 枚) (8f7d21bcf7)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4db1f2ea1c)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (95168bb1a5)
- 📚 Docs:消 F9 撞号——G-926 后来者(生产 web 部署承载者,10-22 登记)去掉复用编号,G-926 仍归 lint-staged 那条;G-312 不得批量改号,本处只改后来者一条 (7195c3e181)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (08604e1db1)
- 🐞 Fix:解绑后重新扫码不得登进旧账号 —— 绑定表读出口径统一并加族级锁 (ff588871cc)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (76cce23bb7)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4777c3cd32)
- 🐞 Fix:登录方式实测收口 —— 认证端点不得冒充成功,第三方按钮改按服务器真值启用 (f4693c3d0d)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c643fb6d4e)

**2026-10-22**
- 🔧 Chore/Other:refactor(scripts)+test(scripts): Button 门改三面取材并接入 guardian 全量档(235);本地保留单门索引面直调 (b99b5f2cdf)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (58fa79259a)
- 📚 Docs:结清 L28924 部署承载者——本机复核 IHUI-DEPLOYLOOP 服务不存在/IHUI-WEB Stopped/8801 是 dev-stack 子进程(本机不是承载面);远端实证见 cba0a36dee(生产 DEPLOYLOOP Running+deploy-loop.log 14:45 HEAD=c9d2cbc1d5)⇒票面三件是取证面取错 (b760ea6b15)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2a0cba0619)
- 📚 Docs:结清 L7191 api<T> 壳迁移——票面口径现读 0 命中(function api</const api=async 等四种模式均0,仅 api.ts 注释与一处测试正则);apiOrThrow 消费者 378;web typecheck RC=0 (6040fedd92)
- 🐞 Fix:守门 134 后续批①——9 处 updated/created 布尔 ACK 改真库确认(RETURNING 行数/委托返回 id),B1 六处+B2 三处清零;门 134 候选3违规0未判定0 RC=0,typecheck 绿,7 文件 113 用例全过 (1c56e797c6)
- ♻️ Refactor:G-343 psql 定位收敛到 lib 唯一出口(pgBinDir/backupPgDir 私有副本 5→0,audit/drill/app-reads 三臂自证绿);三脚本 --self-test 夹具迁 mkScratch(33/61/85 例);G-926 补 lint-staged 已跟踪被忽略三臂 E2E(19/19) (852c9409a5)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (53c841a721)
- 📚 Docs:G-107 挂进行中@goal-r53(补派席位在飞,scratch-dir 席收口后空位顶替) (fe8f26d29c)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (785ee61b80)
- 🔧 Chore/Other:chore(scripts)+docs(plan): scratch-dir 同族残余清偿——plan-fields-project.test.mjs 两处夹具迁 mkScratch/rmScratch(门91 --worktree clean RC=0,16/16 绿);G-343 僵尸副本与票B 按现读证据结清(四脚本+12 枚名单全部已在 HEAD,席位逐格复核) (fd0593c52c)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (f48d8e0395)
- 📚 Docs:复翻 G-964/G-965——并发重复登记清偿回退,补摘除声明后重落结清 (3c3e73ac26)
- 🚀 Feature/Improvement:Button 高度档位门接入 guardian 全量档(三面取材:HEAD/索引/工作区) (239fb861e7)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d9f7105728)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (23556f6ba6)
- 📚 Docs:结清 G-927 与 G-939——镜像棘轮现读 72/基线 72 零新增(face-reader.test 31/31);taken 提交吞掉型已由 CAS 祖先三态守卫+git-sync-converge 复量收口(五测试 45/45,艘 feb0cd072d/402f347edc/bf25ee60e2) (642958fb19)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (030595989c)
- 📚 Docs:6 票挂进行中@goal-r53——五席满编在飞(守门134后续批①9处清偿/zcode第三批/G-14取号器查重/scratch-dir同族(G-343四处+7脚本tmpdir)/G-874 Passkey) (8677b58c27)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (fc0fcd1057)
- 📚 Docs:结清 G-14 与 G-874——取号器改全文件号集扫描(scanFamilyIds 唯一实现,两取号出口共用,枚 2321b81343aa1dcea5a514dcb5500abc006c313b);Passkey 登录首屏接线(login-form options→verify 闭环 + web 两端点注入 + @simplewebauthn/browser,同枚) (5be63cbe29)
- 🚀 Feature/Improvement:G-874 Passkey 登录入口接线(login-form options->verify 闭环+web 两端点注入+@simplewebauthn/browser);D222 回退不可用显式声明工作区未变化+五语三键;G-14 取号器全文件号集扫描(scanFamilyIds 唯一实现,两取号出口共用) (2321b81343)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2ffe97f3f5)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (357bb9fc36)
- 📚 Docs:结清 G-927/G-929/G-934/锁四票——927 型B基线9→3收紧(fadc7b91a3)且棘轮绿;929 object-space-land 66例全绿;934 scroll-session-restore 生产消费者在位+32/32;锁 lock-atomic-init 已收口(50/50) (56cc4a66f4)
- 🔧 Chore/Other:G-927 型B 基线 9→3 收紧(现读 3 枚),裸 git 棘轮复跑仍绿 (fadc7b91a3)
- 🔧 Chore/Other:ui-routes 生成件钉自愈——G-957 接收腿入库后 inputsSha256 0d5dd914→70076f30(门105 G5 miniapp 腿 stale→matched);web 腿 stale 归他席在飞输入(admin configs/developer/learn 三页),不代落 (ac032619b3)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5e7b63cc6c)
- 📚 Docs:结清 G-963——f9 夹具闭包已收同级 ./ 并递归到不动点(HEAD 注释即本票),node --test 该文件 10/10 绿 (25bd11dc3d)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d64c1288f8)
- 📚 Docs:结清 D222 与门39六屏票——D222 五态键五语言齐+验收 13/13 绿;门39六屏(ConnectedAccounts/ImageGenGallery/Usage/Points/WrongQuestions/ImageGenTemplates)全部下沉,白名单清零(30513b904f/3ffe7d9b5a) (486624f223)
- 🚀 Feature/Improvement:门39 六屏共享化收官——ImageGenTemplates 下沉 @ihui/rn-app,端内留 wrapper;门39白名单摘第三枚(六屏全清) (3ffe7d9b5a)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (310e88d35c)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4d1bc0cf67)
- 📚 Docs:结清 L7283 同一契约两份声明——UseSearchHistoryResult 等 4 组已在 HEAD;GenResult 本轮收单源 @ihui/types(3e609d3249),端点已修(503 明确报未接通);门193 RC=0 (c1fd90155b)

**2026-10-22**
- 🚀 Feature/Improvement:门39 六屏共享化收官——ImageGenTemplates 下沉 @ihui/rn-app,端内留 wrapper;门39白名单摘第三枚(六屏全清) (3ffe7d9b5a)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (310e88d35c)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4d1bc0cf67)
- 📚 Docs:结清 L7283 同一契约两份声明——UseSearchHistoryResult 等 4 组已在 HEAD;GenResult 本轮收单源 @ihui/types(3e609d3249),端点已修(503 明确报未接通);门193 RC=0 (c1fd90155b)

**2026-10-22**
- ♻️ Refactor:L7283 GenResult 收单源——web/RN 同读 @ihui/types 的 ImageGenResult;端点已修(503 明确报未接通,不伪造 imageUrl) (3e609d3249)
- 🔧 Chore/Other:fix(scripts)+test(scripts): git 候选解析改为系统 Git 优先,并修 Button 门提交链取材面(漏 --staged) (71ab80ad79)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3596769881)
- 📚 Docs:结清 7 票已落地项——G-924 十死键已删/G-958 H5 如实提示/G-959 取键(用户可见中文0)/G-53(b00e5766c5)/G-932(12文件在HEAD,111测试)/L6977(4f33a3c71b)/票60(5e8a44a71f,641/642) (4d868a3f9d)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (85a074df8c)
- 🔧 Chore/Other:feat(miniapp)+chore(zcode)+docs(plan): G-957 接收腿落库(14 测+全量 1000 绿)+zcode 二批回填 24 份+守门134 裁定B结清并立后续批 (1829916446)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (0ee6b4b6b9)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d6de0ba0a3)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (10334c804b)
- 🔧 Chore/Other:test(dom-actions)+docs(plan): WP-7 结清——包镜像测试面补齐(18 例+消费端 33 例含真机 cdp),实现层系 09-25 已入库的陈旧双记 (53e6a1b4d1)
- 🐞 Fix:监控大屏适配工作区容器(高度链贯通 + 容器查询网格 + 顶栏/侧栏重排) (db7c9659b8)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (79769a1eac)
- 🔧 Chore/Other:feat(web+api)+test+docs(plan): 票59 消息级版本切换结清——regenerate 前端去截断改 sibling 占位+坐标通道四段接线+行为测5例与静态对账10例 (5bee0d6223)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (24f449d114)
- ♻️ Refactor:G-965 投影残批——加行内标头并删逐字等价归属句(21 枚) (86e2288edb)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c56ae845bb)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (0a04506656)
- 📚 Docs:结清 G-274/G-107/G-865 三票——水位协议与 fail-closed 闸门承载测试 42/42 + parity 14/14 + 门233 自检 15/15;G-865 死键代码引用 0(仅 4 处历史注释) (78778d8af5)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (860236457a)
- 🐞 Fix:复翻 G-965——重复登记清偿误并回未勾态,同日结清证据复原 (f1920fbb6f)

**2026-10-22**
- 🚀 Feature/Improvement:门39 六屏共享化第二批——Points/WrongQuestions 两屏 UI 下沉 @ihui/rn-app,端内留 wrapper;门39白名单摘两枚 (30513b904f)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (f0b285786b)
- 🐞 Fix:结清批2c——G-706/G-819/G-11三票翻勾+摘3条滞留已勾行 (9e04f7cf0e)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (236e30de22)
- 📚 Docs:票60 真并行多窗格取证结清——步序二~六全部已在 HEAD(零代码改动,窗格化套件 641/642,tsc 0 错) (5e8a44a71f)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (e6e29b2f67)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (59c6684b64)
- 📚 Docs:结清 G-964(P1 验收全绿)+G-965(投影器物/强制档/写盘闸三件齐) (3ba1de3712)
- 🚀 Feature/Improvement:G-965 写盘闸接三维守恒(仅 open→open 断言,翻勾/删行豁免并出声;镜像 G965-1..5) (9fdef2e898)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (617fd1c5d7)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4c6544030e)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (0e5fd7fd27)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5d639c6138)
- 📚 Docs:G-873 就地改写当前状态 —— 前后端接线已入库,只剩微信开发者工具真机验一次 (07aeb13426)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (cfeb0b85c8)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (dc57e24388)
- 🐞 Fix:本地未推面让号 G-928 → G-1142551,解 union-converge F9 归并新增撞号组 (dfab38cfa1)
- 🐞 Fix:小程序手机号一键登录接线落地 —— 消费点改打 one-tap-login,响应随 token 回 user (ec9853d2e1)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (52f584d238)
- 📚 Docs:登记一键登录小程序接线与 web Passkey 提首屏两票(后端均已就绪,缺前端接线) (2eed653ccb)
- 🐞 Fix:微信手机号一键登录此前是结构性死路 —— 补免鉴权端点 /auth/wechat/mini/one-tap-login (40fa6eef9c)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3a5f626116)
- 📚 Docs:更新 G-871 腾讯云第二通道剩余卡点(应用与密钥归属已核实,只剩实名资质 0 条待报) (8f6360855d)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (ef069e6d93)
- 📚 Docs:登记腾讯云短信第二通道的剩余动作(建应用取 SmsSdkAppId + 签名/模板报审,现读均空集) (184f0d17aa)
- 🚀 Feature/Improvement:接入腾讯云短信作为第二通道 —— 通道可切换,但缺配置一律如实报未配置 (43e040bdb8)

**2026-10-22**
- 🔧 Chore/Other:全量回归 10408 例归零——auth 码位串扰/course 漂移对账/o6 判据词锚/parity 与重路由 hook 超时/gate8 钉 admin 真面 (f6befe10b8)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (82a1078618)
- 🔧 Chore/Other:fix(scripts)+test(scripts)+docs(plan): L7272 守门8假绿灯结清——TRANSPORT_RE 派生化补泛型未判定腿+FG-4 正反例;O65 追加复验注(18 枚干净面红全闭 290/290) (01b83b3188)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d2e4d133b3)
- 🔧 Chore/Other:feat(cli)+test(cli)+docs(plan): L6977 工具钩取消腿结清——票域 ~90 处 runPre/PostToolCall 全接 ctx.signal+生产链真子进程判别测(abort→Cancelled) (4f33a3c71b)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a612f4dded)
- 🐞 Fix:结清批2b——G-40/G-27/G-41/G-593/G-956/分叉票六票翻勾+摘1条滞留已勾行 (aff198f5cb)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (0d8bc2615e)
- 🔧 Chore/Other:fix(api)+test(api)+docs(plan): O64 宽限定时器接线结清——断连信号源 request.raw→reply.raw 三处换源+生产接线判别测(真断连武装/接管重武装,零直调) (5a83c26d65)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6d154a80a3)
- 🚀 Feature/Improvement:G-965 投影器物补"删等价归属句"同批改造(16例镜像)+门234升blocking只挂差值维 (2bcbe59144)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (ad1a65977d)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (f3753c6f1b)
- 🔧 Chore/Other:test(ai-service)+docs(plan): O65 登记并结清——21 枚新红清零(多根桩契约测+工厂注入+_mode_policy 夹具,零改生产) (42fd7dab20)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (f89d2d4766)
- 🔧 Chore/Other:docs(desktop)+docs(plan): L7170 僵尸实例结清(方向a/c已在HEAD+复现前置静态取证收口+startup_guard 头注取证入库) (ec0a39cde4)
- 🔧 Chore/Other:只为止损看拒绝原因 (0c0200f3f6)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8445d76a1c)
- 🔧 Chore/Other:fix(deploy)+test(database)+docs(plan): G-921 结清(seed 执行环接线 --only=13,14+870 守恒复证+7用例测试入库) (0c637dbe97)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (ff56ae5a39)
- 📚 Docs:结清批2a——G-858/G-21/G-245/G-928/G-943/G-34/G-10 七票(实现票2+陈旧票现读关闭5)+摘HEAD滞留已勾行 (f6d8c66ce0)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6bc296c463)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (aa5970900b)
- 🔧 Chore/Other:refactor(web)+docs(plan): L7217 二批 api壳清零(asks/plaza helpers 迁 apiOrThrow+两测试随迁,手抄壳全仓归零)结清+六票进行中认领(O64/工具钩取消腿/守门8假绿灯/59/60/WP-7) (1f3af973f1)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (253caa5c07)
- 🔧 Chore/Other:docs(plan)+test(web): 结清 G-424(现读=已在库,残段移交未取号新行)/活动时钟(陈旧票,G-820/G-821在库)/L5881 元认知真冲突判据(枚 40801f217b)/G-941 账本chain(枚 40801f217b)/G-13 守门98 D6(枚 40801f217b)/桌面日志P1残余②(陈旧票,勾版已在)/G-863(实现 f9fe720fc6+本枚3例钉测试);G-925 进展注记(dead-class清零,真机观感留口);同枚摘HEAD滞留已勾行 (64a1113316)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5360c7ae29)
- 📚 Docs:G-274/G-79 零改动结清+G-962/重放触发面结清(产出已随 d425670f26 入库)+api壳首批进展注+G-957 两格闭合进展注+另立 O64(宽限定时器实盘不武装接线缺口) (66e0a642f1)

**2026-10-22**
- 🐞 Fix:G-13 守门98 D6错名影子判据维(覆盖面0不新增恒红,self-test改前后逐字同)/G-941 成本账本生产者chain接线(main×2+subagent×1,端到端基线不互吞锁)/L5881 元认知真冲突判据三型拦截+写前带幂等证;子席定向 120/68+90/24+195 全绿 (40801f217b)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (65f8ea94a5)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6d6d21aeae)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (31be3e642f)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d45134fb73)
- 🔧 Chore/Other:fix(scripts)+docs(plan): G-952 可发现性落地(--merge-drifted 出口点名+钉锁测)+G-952 结清+L7231 出口注+D18 纠偏注 (3ce56ca283)

**2026-10-22**
- 📚 Docs:结清 O87g(守门8前缀假设扩提取式已随机制⑥入库)+G-962 进展注记+离线包自述钉(登记即结清);同枚按完成即删摘除全部跨枚滞留已勾行(结清凭据在各枚入库提交) [live-doc-skip=有意摘行留痕] (b04eeb3134)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (aa3ae15340)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2f7de8e0d0)

**2026-10-22**
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a4efee57ef)
- 📚 Docs:重落被旧基座吞回的 G-107 结清+D690 认领(拍板A)，结清 G-923(端到复量全绿) (c28c3b8287)
- 📚 Docs:结清 D195(实现已入库,验收实证全绿) (5f24b4f106)
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
