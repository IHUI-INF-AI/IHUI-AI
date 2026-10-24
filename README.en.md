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
| 数据库表 | 606 | `dbTables` |
| schema 文件 | 234 | `dbSchemaFiles` |
| API 路由 | 4562 | `apiRoutes` |
| 路由文件 | 624 | `apiRouteFiles` |
| AI 服务路由 | 593 | `aiServiceRoutes` |
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
| 测试文件 | 3163 | `testFiles` |
| CI 工作流 | 50 | `ciWorkflows` |
| Compose 服务 | 14 | `composeServices` |
| 工程守门 | 273 | `guardianGates` |
| — blocking | 250 | `guardianBlocking` |
| — warn | 26 | `guardianWarn` |
| 跟踪文件 | 15949 | `trackedFiles` |

上表由 `node scripts/gen-doc-numbers.mjs --markdown` 生成,最后核对日期 2026-10-24。
每个数的来源就写在取数键旁边的实现里(`scripts/gen-doc-numbers.mjs` 的 `SOURCES`),**不得手抄、不得另立第二份**。

<!-- END GENERATED NUMBERS -->


## Recent updates (auto-maintained)

<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->
**2026-10-24**
- 🚀 Feature/Improvement:守门 71 补归并名额维 —— 同题副本两行 marker 逐字相同,丢失维把删掉带进展那一份读成没删(真仓成对实测零报);新维要求当次逐号定向声明 IHUI_PLAN_MERGE_FOLD,与本次改动不同轮或给出空声明同样判红,归档豁免沿用丢失维同一把尺子先行放行,刻意只挂提交链以绝恒红门;镜像测试十例(归档豁免/丢失维/空声明三支变异各有承重)+门体自检七十例全绿 (a331c34b6e)
- 🐞 Fix:注入交代列表改走 @ihui/shared 叶子路径,修 8801 全站 500 (a49c5520f2)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c2617915bc)

**2026-10-24**
- 🚀 Feature/Improvement:71 chat 同步广播腿 + D115 /review 采集端点 + G-962 移动端聊天路由 (2d8ac453e8)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8c74e47e10)
- 🔧 Chore/Other:收口 HEAD 面等态行 —— 等人拍板/等条件双桶归零(2026-10-24 强制令代裁) (2621a8fb72)

**2026-10-24**
- 🐞 Fix:门 150 圆角角色档 9 处归位(上一枚 web 收编带进来的新增红) (44fc684813)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c07225c777)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (fedc4732a7)
- 🔧 Chore/Other:goal-20261024-M 收口 8 票(343/239/927/878/874/924/932/807 结清)+ G-1162551 进展注(8801 全站 500 阻塞归 3b40be384a) (ebb8dcf7c8)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (02ee3cc21a)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (ffcc48e008)
- 🔧 Chore/Other:G-873 旧登记录复验注记(代码面已闭环、活账以 L28917 为准、唯一差口=真机复登) (bebf9f9dc3)
- 🔧 Chore/Other:G-927 棘轮基线 61→60 紧贴现读 (6baf62529a)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a03bdd61b2)
- 🔧 Chore/Other:G-955 按票面判据翻勾(取号入口 RC=0) + G-196/G-925 现读复验注记(①②已过时/代码面清零,余项如实仍开) (d0793e1ddb)
- 🐞 Fix:G-927 最后一枚裸 git 派生改走 face-reader.gitRaw (74b82a84e6)
- 🚀 Feature/Improvement:D77/D124/D125/79/D181 五票接线 + 票71 同步切片 + G-828/G-86/G-944/FIM 收口 (773016c7fc)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4d6eb0e977)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (9d2517b439)
- 🔧 Chore/Other:零改动结清 5 枚(MCP stdio 诊断/结果级 isError/重连单飞代次/成对清理/f9 闭包) —— 主席亲跑测试 + 四席只读复核 (1e307ba015)

**2026-10-24**
- 🚀 Feature/Improvement:D120 注入来源单源 + 71 chat 同步契约 + 五语对齐 (3b40be384a)

**2026-10-24**
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7d7b03ce00)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (62acaf01c3)
- 🔧 Chore/Other:清等条件桶回潮两枚——G-217 与 G-1018222 现读证成翻勾(尺子②已进 check:all 且 29/29 建档;trace_id 列与迁移在本机 PG 已应用、九例回归绿) (6bb51d75c3)

**2026-10-24**
- 🚀 Feature/Improvement:D121 团队共享任务板 + D115 review 收尾投影 + D120 轮次预算交代 (2fc9ab9b55)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b973bea545)
- 🔧 Chore/Other:goal-20261024-M 认领本波 9 票(scripts 三席 / web 弹窗两席 / 复核三席 / e2e 一席) (304499effa)
- 🐞 Fix:AGENTS §5b 清除镜像在役断言(门 237 M4 存量红) (7bb240acde)
- 🚀 Feature/Improvement:工具调用证据级流水落库(表与时间戳迁移与唯一写入口;链式可验证引用既有审计链不复制第二份,权限枚举与操作者身份皆由承载层显式入参,十4 例回归绿) (49cf56d65a)
- 🐞 Fix:摘掉反查池 worker 对 sweep 产出面两枚幻影键的取值使 HEAD 面类型转净 + 钉住产出与消费键集同批的三例回归(附带登记 da758a7d6f 删半截接线致 reconcile 与 retry 生产调用方归零这条真故障,复活接线另票) (099b843951)
- 🐞 Fix:导引轨改造收掉 swarm 单边描边并补 path-labels 数据权利条 + 数据权利页三态登录门(擦除回执臂序经负控证明不可颠倒) (19a891faa5)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6a09723ff6)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2eb811b14b)
- 🔧 Chore/Other:收敛复核清等条件桶回潮两枚——G-945 翻勾(枚 b774e2dc6e 已代落,现跑 13/13)与 G-925 改判(修复已入库 枚1e96525416,真机观感验证归属:机主) (1eb9eb677e)
- 🔧 Chore/Other:落 G-925 改判记录(owner=机主)——回潮裸行经门71回捞后的等条件桶清账,真机/模拟器观感验证留人工窗口 (6fff53af5e)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (9a4d0c5b2c)
- ♻️ Refactor:remove SwiftAPI(x5m5x)/ihui_relay first-party provider & product surface (ee3768f140)
- 🚀 Feature/Improvement:小程序端补齐 Sheet/Tabs/Collapsible 并对齐 Tooltip/ConfirmDialog/LoadingSpinner/Avatar (d2543d4a04)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (11fa233768)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (e304605ae6)
- 🐞 Fix:监控数据大屏拼满12列网格并补齐缺失字段 (6d21d2adee)
- 🚀 Feature/Improvement:FIM 指标聚合补 scene 维(补全/编辑意图分桶,旧调用落原桶) + 计划审阅面板五阶段连接线去档3分割线 (8f782af01c)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b4b90c1301)
- 🔧 Chore/Other:G-880 两枚同题入口一并挂本席租约(该票现读有两个可领入口,一席已在做;不给没干的票占牌,G-871/G-873 属他人职权等待面故不挂) (6edf27eeee)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (17c8dc6e6b)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (dcdb7406d6)
- 🔧 Chore/Other:本轮新开五票挂租约(权限双轴展示腿/A36影子账接线/G-880取材面/G-921对账尺子/门128几何差裁定)防同票双领 (82df919bc9)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5bbf5d0add)
- 🔧 Chore/Other:侧边栏同题六枚可领入口全部挂本席租约(归并器与指针注记面由别席持有,不抢其写;先让六席抢同一张票这一格当场消失) (0202cca64f)
- 🚀 Feature/Improvement:合并引用位移补 A5 内容存活维(路径仍在但 blob 回退 ⇒ 判 lost),G-939 原案 11 枚由 0 检出变 repaired 点名 (ca668b21c0)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (87833d362b)
- 🔧 Chore/Other:把 types 的 chat-sync-contract 子路径登记进架构契约公共入口白名单(E1 齐备对账 85 到 86 条,解析不到 0) (4db8ac2008)
- 🚀 Feature/Improvement:顶层 {...props} 三态可判(spread-unknown 8→0)+7 处 RN 主题接线修复;LearnDevelop 的 useTheme 行属回归复原(祖先 dfc69ab8c2 有、61c36c45c5 批量同步时被误删,同批还丢了 tintColor 主题分支,后者另立债) (a02efc5e0e)
- 🐞 Fix:补回 settings data-rights 导航入口并钉十例回归(当年归位只做了一半,该页全站零入口;词键复用既有五语种 dataRightsTitle 未新增) (bb78199345)
- 🐞 Fix:分割线存量 RN 与共享层清偿十处(清线留距,几何与色档一字未动;在飞那枚 StudyIndexScreen 已移出射程) (de15e7c0b7)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8305dd7d59)
- 🐞 Fix:出图契约补 item 声明并撤两端 revisedPrompt 死渲染(后端零产出通路已复核,503 透出分支逐字未动) (63ec1c1709)
- 🐞 Fix:分割线存量清偿与契约出口挂出(两席成果;判据读数与回归末行见交付报告) (feca6dd3ea)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (641a621a6f)
- 🐞 Fix:修回 D119 结清行被吃掉的左括号(本席落地脚本把 5 字的复选框前缀按 6 字切,吃掉了认领标记的左括号);唯一命中位置定向插回,其余三枚经逐字对照实为完好,先前"四枚损伤"是本席拿错对照副本的假阳 (b96432f414)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5dd04f1642)
- 🔧 Chore/Other:给执行流水落库票与契约下沉票挂写盘席租约(qoder-maxpar)防同票双领 (de735fc528)
- 🐞 Fix:补齐队列终态的共享判据与各端接线 (a8e700ba9b)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (86d47eb6f5)
- 📚 Docs:D690 结清(A 档重放已在 HEAD 落地,本席亲跑 pytest 末行 passed=6 verdict=GREEN) (14e7b06c72)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d7003ebe1b)
- 📚 Docs:五票按 HEAD 现读结清(api壳待迁0三枚迁移枚验祖先;D119 并行预取已交付;三票上游锚点本仓零命中而等价实现已入库挂测) (d63f269168)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c99ff58e65)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1c70ced9a9)
- 📚 Docs:D195 与 G-107 两票结清(D195 三档链路 HEAD 已闭环十键齐;G-107 上游锚点零命中而本仓等价实现已入库挂门) (db4be9c307)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2714521757)
- 🔧 Chore/Other:给 RN 分类栏收口与 Predictive Edit 两票挂写盘席租约(qoder-maxpar)防同票双领 (f530bd4402)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (75498f5cc9)
- 📚 Docs:键名对齐票结清(HEAD 面四枚文件键名已对齐+双枚祖先确证,票面旧快照断言证伪) (355ab45e1e)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (fc6f6761ed)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (f48131e250)
- 🔧 Chore/Other:挂 4 枚写盘席租约(qoder-maxpar)防同票双领;W3 e2e解阻 / W5 门11d分割线 / W6 api壳批次 / W7 SDK就绪 (254c94ce4e)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (de363ff0d1)
- 🔧 Chore/Other:认领 D114/D120/守门134后续批(goal-20261024 三席并发:web 选择器 / 预算续跑 / ACK 存量清偿) (b9f5ca2776)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6f178ae55b)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c2a409cea1)
- 🔧 Chore/Other:结清工具粒度钩子取消腿票(票面验收条件=HEAD 现读见 toolCtx;现读 4 命中,端到端取消用例 4/4、既有 69 例无回归已记录在票面) (0bff9440a3)
- 🐞 Fix:严格类型收窄、繁体词包补键与构建产物门自检 (b4e3d74076)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (e79a05b3d6)
- 📚 Docs:发丝线票结清(正本行;12 枚落地+指纹单源,尺子 HEAD 面存量 31→0) (679d6aea30)
- 🚀 Feature/Improvement:会话内语音笔记挂载与队列审批许可门成套 (6740a555d1)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (f89d89e1ce)
- 🔧 Chore/Other:摘除 3 条已归档僵尸活行(完成即删;逐条核对:归档文件 containsBody=true 且活行无归档日之后的注记) (1739c8f0a6)
- 🔧 Chore/Other:移除弃用的镜像工作流与未选型的安装器评审资产 (25b02eea97)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (338d9da079)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4d4274b8ae)
- 📚 Docs:L4248 进展注——① 守门83 盲区已由 R4 键名配对覆盖(阳性对照实测判红),②基线冻结留门91侧核 (f41d940dd8)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c1b9f5b244)
- 📚 Docs:L4246 128 点迁移重复副本按归档正主翻勾(不重开不派单) (91aa32bfb4)
- 🚀 Feature/Improvement:补齐 D125 协作会话的 schema、迁移与客户端出口 (97a8e4291f)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7c766ce77d)
- 📚 Docs:L4247 prod-bundle 入库源票结清(2 枚无法判定→0,14 对等值/9 对设计未判定/镜像 11 例) (65b4c2c543)
- 🐞 Fix:恢复自动收编误删的三组路由注册 (232a2ab912)
- 🐞 Fix:CheckinAssistant 两枚 blocking 门红归正(badge 角色档 sm→md 合门150;submitText 去死兜底 #fff 合门218) (7521033a46)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (90fe9942b7)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (aced7c358f)
- 📚 Docs:发丝线票结清(RN/内联 12 枚落地+三型指纹单源,尺子 HEAD 面存量 0) (567d8cd1ac)
- 🚀 Feature/Improvement:代理分流名单追加 groq/agnes(实测直连恒失败,Clash 可达) (76fb09a7c5)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (e2360eb4d7)
- 📚 Docs:等条件桶收尾补丁@we-clear-20261023——5 枚〔归:〕简写牌补"属"字使 v1 散文尺与侧车同判(桶不变,仅补散文表态:G-942/G-116/G-371/G-113/G-115 归他席);G-947 追记后台席像素取证结论(009/010 假图坐实、012 真图,终判不变等机主素材) (ce4301ddcd)
- 🐞 Fix:发丝线剩 2 枚(HomeScreen/StudyIndex 的 RN 样式行)按 HEAD⊕本票行落地,不吞他席暂存面 (d1198a2962)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8fcbfbd029)

**2026-10-23**
- 🐞 Fix:两处品牌/描边档错配归正(门83 R3 选中胶囊底改 brand.cta 与 ctaForeground 同档配对;R8 侧栏激活描边改 brandAccent 强调档) (e653efa64a)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b82b5d34bc)
- 📚 Docs:等条件桶清零@we-clear-20261023 机主清零令窗口——翻勾 13/改判等机主 20/改判归他席 3/摘牌转可做 2, 逐票取证注记随行(33 票并行执行核实+新增六行强制令改写行同批改判; 侧车 0f8b5f55fb 先行过守恒) (0806b19d7d)
- 🔧 Chore/Other:等条件桶清零改判记录 25 条(we-clear-20261023)——19 枚 waiting:human、3 枚 owner 归他席、2 枚 waiting:none 摘牌; 先侧车后散文以过三维守恒, 只增不删最新者胜 (0f8b5f55fb)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (fe6c213684)
- 🐞 Fix:发丝线 12 枚中 10 枚落地 + 三型结构件指纹单源(11d 承载/本门 import);另 2 枚因他席已暂存同文件顺延不大包 (8d52e6dfa9)
- 🚀 Feature/Improvement:Qoder 积分计费上游适配，credits 如实透传（重新落地被 87c 挤出 main 的 feature） (427d896e0d)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (e5f4610cb6)
- 🔧 Chore/Other:结清真机走查三项票(两修一误报,遗留陷阱由另条承接) (4a04141575)
- 🐞 Fix:typecheck-full --self-test 跳过 os.tmpdir 串行锁(自检零派生不互等)+T5 结构钉 (55dec4110c)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (cb311f13c8)
- 🔧 Chore/Other:结清活动时钟单调票(ai-service max形态11处 + cli monotonicUpdatedAt 现读均在库) (c4cfe4f782)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4c1f68dc7d)
- 🔧 Chore/Other:结清两条僵尸票(7脚本--self-test走os.tmpdir,前提已过时·门91现读clean) (4f4a0a8e79)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5e343f1d1f)
- 🐞 Fix:修复 G-169 行 malformed 标头(gate234 A2 唯一拦红臂)按侧车投影回填 (a0fe2c6ddc)
- 🐞 Fix:守门 200 档位并表——RELAY_POOL_HEALTH_STATES 改派生自 packages/types 的 PROVIDER_HEALTH_STATUSES(不再逐字重述四档), 承 99cfe1630c 落地门复跑判红点名 (287004e6b5)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5e91ceeae1)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b6fb023d25)
- 🔧 Chore/Other:结清 --allow-dangerous 旁路票(两锚点现读无旁路+8 例锁定) (e23e345f7a)
- 🔧 Chore/Other:钉死 --allow-dangerous 策略唯一出口(两锚点现读无旁路)+源码反向锁 8 例 (0538a1e526)
- 🐞 Fix:ihui_relay 购买入口改回站内 VIP 页(原指向已停运供应商) (d247c89242)
- 🐞 Fix:mypy 收敛 7 条——tomllib/resp.json 的 get 结果先落临时变量再 isinstance 收窄(init_agents_md 两处+checkin_user_pool_bridge 一处), 承 e499574b02 落地门复跑判红点名 (99cfe1630c)
- 📚 Docs:AGENTS.md 归档瘦身解守门 207 存量超支(114,567 → 95,573 B) (3d21caec5a)
- 🔧 Chore/Other:结清 O-1 一键导入工具 + 残行只读尺;守门134③落地进展注 (92f636d0d9)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (69fc411cc8)
- 🚀 Feature/Improvement:守门134③ 信封锚枚举改造——fallback 键族与 B8 兜底假 ACK 判据成对落地 + 镜像30例 (7612afea20)
- 🚀 Feature/Improvement:D14② 沙箱任务队列(sandbox_task_queue+router 接线+10 例) + G-86 types 协议序号字段终态 + G-158 scratch 根迁移 .DevEnv\Temp —— we-clear-20261023 窗口子代理终态字节补落(前批部分快照已入库,本枚收工作树终态) (e499574b02)
- 🚀 Feature/Improvement:出网代理分流——只让被墙 host 走本地 Clash,修 openai/gemini degraded (9664261777)
- 📚 Docs:PROJECT_PLAN 路径迁移与归并在途待办入库 (7b140f3117)
- 🔧 Chore/Other:Web UI 间距微调与构建产物更新 (a0e7532ad8)
- 🔧 Chore/Other:结清号池到期列收敛 + G-109 三投影;守门134①补测进展注 (a4ac5f9108)
- 📚 Docs:守门 237 补 R4 点名(AGENTS.md 守门脚本速查区) (dca330fa0c)
- 📚 Docs:守门 237 头注接线状态改写为已接入 (aa42687eee)
- 🔧 Chore/Other:守门 44 登记 .runtime 白名单 + 移走根目录扫描尾产物(解恒红) (928eaddb22)
- 🚀 Feature/Improvement:守门 237 镜像 purge 内容完好对账接进提交链(blocking,射程 10 文档) (5d251e6021)
- 🚀 Feature/Improvement:镜像 purge 内容门装车(提交时硬拦镜像回潮)+ 修 union 回归两处 (bd37b5fcd6)
- 🔧 Chore/Other:SwiftAPI 弃用代码侧收口(供应商停运:防复活+清残留) (686a77b64a)
- 🐞 Fix:G-109 反向锁回正——output 逐字节原样透传,有界面只走 modelContent (6e874979bc)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (79367780c9)
- 📚 Docs:关闭 2-11 swiftapi 充值事项——供应商停运、号池与路由配置已弃用清除(2026-10-23 核验) (a34f002d6d)
- 🚀 Feature/Improvement:G-109 工具结果三投影(modelContent/display/persistence)唯一装配点 + 端到端事件接线 (d8afd97283)
- 🐞 Fix:号池凭据到期列与上游拒收同写收敛 + 守门134 九处 updated/created 布尔 ACK 两分支钉 (aa8d575f7c)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (0c899d172e)
- 🐞 Fix:健康三态定级 + Qoder chat 通路统一 + 导入测试桩对齐 (da758a7d6f)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4766dd515a)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (fea1295fcd)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b44b1fa3df)
- 🔧 Chore/Other:结清 G-929 镜像套件红26例(--root 修复已入库,主席现跑四验收全绿) (475756ea17)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (72c15515dd)
- 🔧 Chore/Other:提交工作区全部遗留改动，使本地与 HEAD 对齐 (20bb9349d9)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7822086d98)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (aa61f154c9)
- 🔧 Chore/Other:认领 G-929 旁路落地器镜像套件红26例(门231 --rev 换仓未判定被当拒绝) (e8a9aa04a0)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (e3f9b231c5)
- 🔧 Chore/Other:零改动结清僵尸实例修复票(票面前置双证钉死+方向a/c仓内已实现,主席亲验六面过) (53eb429353)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (00ff8b1c65)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (ca97221061)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (83c7618b9f)
- 🔧 Chore/Other:Esc 无层栈协议 两副本一并翻勾(dedup 反复折叠翻勾,副本留指针) (19697372d2)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (f8f5f1bb96)
- 🔧 Chore/Other:结清「锁的初始化必须写全再原子可见」(验收 15/15 绿)+ 发丝线类面 19/19 全清续注 (846bd903eb)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (198f7e8ca4)
- 🔧 Chore/Other:ScanLoginDialog 2 枚发丝改单边 border(h-px+bg → border-t,flex-1 保留;视觉等积) (8ca737a885)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (655e4612c5)
- 🔧 Chore/Other:缺口A/B/C 进展注(实现已在 HEAD,单测 16/16;e2e 验收被他席 API 500 阻塞) (78c0956f61)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1f621d901e)
- 📚 Docs:修复 union 合并带回的 README 徽章回归与数字陈旧 (68e4b42399)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (373d70b8a9)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a34f1aab1a)
- 🔧 Chore/Other:结清 G-807(零改动:HEAD 已含两解;14 连跑 RC=0;并登记 --filter 错名假绿灯坑) (134e681456)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c1376f0bcf)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (59ec182cc3)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (e09142992c)
- 🔧 Chore/Other:安装器三版挂进展注(候选交付待选型)+门39六屏票面前提过时结清+僵尸实例认领 (e700cb1b05)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c0d3db1ad0)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (67cf6965e3)
- 🔧 Chore/Other:批次5认领 G-807 与第3波覆盖面(zcode-cli 面) (0e079155ed)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (61aca6a787)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (862d82aa14)
- 🔧 Chore/Other:结清「失败也是共享事实」(零改动:实现+验收用例在 HEAD,现跑 4/4 绿) (c4a9f73795)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a0d5c33af1)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (cabe2608ba)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (65fdb3f59e)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6a3cc9efd6)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (281699b2af)
- 🔧 Chore/Other:结清「Esc 无层栈协议」(四要件核证;真机三层叠开 e2e 两轮零重试 4/4 绿 + jsdom 23/23) (061820455b)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (ea2c95e031)
- 🔧 Chore/Other:D126挂取证定档进展注(G席主席亲验四面过,真实差距进开发) (e25488f352)
- 🔧 Chore/Other:Esc 无层栈协议真机三层叠开逐层退出 e2e(遮罩+弹层+模态;键盘 zero-mousedown;焦点契约断言;2 轮零重试 4/4 绿) (30db9bd97b)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (26d77c0035)
- 🔧 Chore/Other:批次7修复第一步:清偿器误折重结G-212+重认领D126/安装器(纯加牌,注记另笔) (c4f7bf677c)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (88336bcee2)
- 🔧 Chore/Other:摘除滞后副本带回的 G-15/G-828/G-395 旧形态行(2026-10-23 强制令结清:F5 折叠吸收+比较集收窄历史对 violations 0 / 长会话窗口化判据生产接线 677 绿 / 配置出处标签+降档留痕 222 绿;旧行原文已声明进 plan-row-drop.jsonl) (05f1a2906d)
- 📚 Docs:二次合并后刷新四语言 README 现算数字 (5796bdf3fb)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3a269a4120)
- 🔧 Chore/Other:摘除 G-877 旧225处形态副本行(F4 同题两条待办,持有行为带 2026-10-23 已清155文件进度那条;注记档被周期性归并器反复洗掉,改走摘除+plan-row-drop.jsonl 声明的抗回潮通道) (b19714914b)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b50c378495)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5bcadb6b4a)
- 🔧 Chore/Other:重施 G-877 旧副本【归并】注记(7e8bbb48c3 滞后副本回退了我席 3a8ab40d92 的注记,F4 副本行棘轮基线 0 被顶红;blob 档只动这一行) (27ea77fefe)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6c13581591)
- 🔧 Chore/Other:结清 G-935 多窗格 e2e 真机核验(5/5 绿)+ 发丝线第一刀 17/19 进展注(租约保留) (7e8bbb48c3)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (00713950ff)
- 🔧 Chore/Other:G-877 旧225处形态副本加【归并】注记(首次强制令落地时滞后副本带回,同主键以带155文件进度那条为准,F4副本行归零) (3a8ab40d92)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a451cb9ee5)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c40e662da6)
- 🐞 Fix:O64 签到同步收尾 —— 接通待推重推 + 修状态键错 + e2e 补牙 + openapi 全量同步 (8ab04c36f4)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (9ba0e52f5f)
- 🔧 Chore/Other:再摘 O46 重连取向格(2026-10-23 强制令结清,取向B已落地;门71回捞已由 plan-row-drop.jsonl 声明摘除挡死,seat=waiting-human-closure) (6619f29543)
- 📚 Docs:合并后刷新四语言 README 现算数字 (a642ecd945)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (25ea7c7add)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c27536a32b)
- 🔧 Chore/Other:按 2026-10-23 机主强制令清零 waiting-human(F11=0) · 摘除5行已结清(feed重复已量化未修/G-201身份模型已服务端推导/O46重连取向B已落/守门30a豁免档已落/G-197四格已落) · 整行改写4(邮件四件→等条件生产ssh隧道凭据/D125→设计稿+切片已落另批/env keys→等素材第三方凭据/desktop→等素材真实账号登录态) · 外科手术4(G-271线③代裁代执行/MoreLink等真机登录态复验窗/G-933需先定/D77迁移+读口已落库) · 侧车5(D181/G-947/G-933→env,D77/G-271→none) (56fff65e04)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8b681ee320)
- 📚 Docs:结清门39六屏共享层下沉(10-22三批已入库,当轮现读255枚判0红,本席零改动)@goal-20261023 (9dd7ca7e35)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a1e09234c5)
- 📚 Docs:批次6认领 门39六屏共享层下沉@goal-20261023 (a7b098c73b)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (355896fb89)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (491bb877dc)
- 📚 Docs:结清G-79(31枚现读全绿零改动)+钩子取消腿挂进展注(代码待收编)@goal-20261023 (2a7d4dc051)
- 📚 Docs:四语言 README 摘除国内镜像徽章并同步现算数字 (515703fb1d)
- 📚 Docs:API Key 两因子与单凭据组合形态写入接口契约 (ec50b754c7)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c2f4103a43)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b6c14daf29)
- 📚 Docs:结清 WP-7 浏览器语义快照(陈旧双记:两腿已入库+契约18/18绿,本席零改动)@goal-20261023 (5227960092)
- 🐞 Fix:流式帧 id 统一——收尾 usage 帧复用上游帧 id (f70c6eeab6)
- 🐞 Fix:渠道已写出帧后禁止回退 ai-service——防正文重复/错乱 (77c50f6cae)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (038dc0d282)
- 📚 Docs:批次5认领 G-79/钩子取消腿/WP-7 三票租约@goal-20261023 (f254bee9e5)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (86acafcb40)
- 🐞 Fix:流式结束帧唯一化——上游已给 finish 时收尾不再补 (8fdd484098)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b0bc69968d)
- 📚 Docs:结清 G-944/G-951/desktop日志 三票(判据主席亲验/真跑)@goal-20261023 (b334eddf90)
- 🐞 Fix:G-944 ERC20 取证侧格式校验补守卫(verifyErc20OnChain fail-closed)+新增4例@goal-20261023 (fe01decaa6)
- 🐞 Fix:流式终止帧唯一化 + API Key 单凭据组合形态 (50bc802606)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2fd9e5ad0a)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b7b98ad033)
- 📚 Docs:结清O-1 Qoder导入工具(HEAD面齐备+49例绿)@goal-20261023 (05c02dfb2d)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (98fb073fd9)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (29aa9bd0f6)
- 📚 Docs:批次3结清(G-322/D17/锁初始化)+RN分类栏挂进展+批次4认领(G-944/G-951/desktop日志/O-1)@goal-20261023 (acf39de067)
- 🔧 Chore/Other:hairline 逐点人判清偿:类面 17 枚 bg 发丝改单边 border(视觉等积;ScanLoginDialog 2 枚缓做避浮层在飞面,RN/内联 12 枚前置未满足保持存量) (3cabadf73d)
- 📚 Docs:清掉文案里的 Gitee/GitCode 镜像入口(同批第二枚,补市场/发布文档) (819378c6e1)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6ff6f49dce)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4a7db0278b)
- 🔧 Chore/Other:goal-20261023 批次4认领4票(Esc无层栈协议三孪生/多窗格e2e真机核验)行首插租约 (4c2d22399e)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (f97eecefe2)
- 🔧 Chore/Other:goal-20261023 批次3尾结清5票翻勾(窗格续传孪生×2 C席核证+主席亲验/L7054空行残段/G-351指针副本×2)+D118推进注保租约(落点①③入库②待下批) (3b3c4334dd)
- 🚀 Feature/Improvement:D118 /init 式 AGENTS.md 生成器 init_agents_md(扫描构建命令/目录/约定/工具链→草稿,默认不落盘,写路径过 path_guard 双闸门,8+17 例绿)[goal-20261023] (3f471d1efc)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (71d7f96581)
- 🔧 Chore/Other:彻底清除 GitCode/Gitee 代码镜像痕迹(机主:早已弃用,不许留尾巴) (d10db9132d)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1f2370e4db)
- 🔧 Chore/Other:goal-20261023 批次3结清 L4318 键名对齐(前提证伪:批次早已入库,双祖先+三门RC=0,零改动) (76c806b468)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (f54bbc4b62)
- 🔧 Chore/Other:goal-20261023 批次3主席结清6票(真机走查三项复验/残行尺子/tmpdir孪生归并×2/G-952归并出口/G-932落地核验) (9ab90edcc2)
- 🐞 Fix:Qoder 模型名归一——对外 qoder/auto 剥前缀成 auto 再进桥 (8854fca2c0)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (bdd344cf3b)
- 🔧 Chore/Other:goal-20261023 批次3认领5票(真机走查验证/键名对齐重做/窗格续传孪生双领/D118)插租约 (bc32e57431)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d0bfa44168)
- 🚀 Feature/Improvement:Qoder chat 打通——常驻本机桥 + executeChat 接入 (ae0b492fc8)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (420300ab45)
- 📚 Docs:批次2结清 8 票翻勾(L4247/L4248/L29034/L5887/L7215/L7049/L7050/L7051)+2 票推进注(L29036/L7269) [goal-20261023] (2d45bf1482)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5c462227de)
- 📚 Docs:批次3 结清G-866定性收口 认领守门91待清/G-322/RN分类栏/锁初始化/D17语言包 [goal-20261023] (3cc9b5bd97)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (9c8eeb4acd)
- 🔧 Chore/Other:批次2收编 G-322第十九批四站接单源/守门83 R4镜像锁四层/shared失败广播双在途补强 [goal-20261023] (96c40a96fc)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (528e3ba1f9)
- 📚 Docs:第一波结清 守门134后续批/G-14/G-874/G-880x2/新鲜度摘牌/G-876/G-924/G-957/G-343/G-417/G-866 [goal-20261023] (b1fef682cd)
- 🐞 Fix:从部署链彻底移除 GitCode/Gitee 镜像回退(机主:早已弃用) (bbf17d6c9a)
- 🚀 Feature/Improvement:chat 彻底打通 —— jobToken 通道用 device token 直连, 无需 PAT/浏览器授权 (8585981263)
- 🐞 Fix:号池"滞后"改为报快照年龄,账号刷新戳另立字段 (9974950c87)
- 🚀 Feature/Improvement:chat 探针支持免 PAT 路径(登录 CLI 后直接用 qodercliAuth) (577e061ee0)
- 🐞 Fix:补「内容==本轮 tip」的幻影漂移判据,解 BLOCKED-WIP 永久停摆 (8a7a9e0d86)
- 🚀 Feature/Improvement:新增官方 SDK chat 契约探针, 固化 chat 端点/签名/PAT 三处实证结论 (409791b737)
- 🚀 Feature/Improvement:大屏访客/号池改实时快照 + 修自动部署链取源与 fetch 墙钟 (5a3cedfd40)
- 🐞 Fix:中文主机名致 HTTP 头编码崩溃 + Qoder 凭证统一到 relay 池唯一真源 (43ae7c36a8)
- 🐞 Fix:新鲜度戳为 0 时折成未判定,别把「从未刷新」渲染成两万天 (8f6595ffaf)
- 🚀 Feature/Improvement:数据大屏补访客/机器人/号池/签到四类数字 (18f0c8e8ec)
- 🐞 Fix:新增中转站凭据重加密修复脚本 (1a2258ee93)
- 🐞 Fix:补齐 market-plugins.ts 的 parts 依赖闭包(他席收编时漏提交的 13 件) (6417b5ceee)

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
