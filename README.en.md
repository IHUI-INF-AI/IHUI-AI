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

Headline claims (same source as the table below, all live-computed): **612 tables · 4616 API routes ·
25 WebSocket endpoints · 100 catalogued LLMs · 38 platforms auto-publishing · 3607 test files ·
273 engineering gates · 50 CI workflows · 5-language i18n parity · 9 app packages · 16 shared packages ·
14 compose services**.

<!-- BEGIN GENERATED NUMBERS (node scripts/gen-doc-numbers.mjs --markdown) -->
| 指标 | 现值 | 取数键 |
| ---- | ---- | ------ |
| 数据库表 | 612 | `dbTables` |
| schema 文件 | 237 | `dbSchemaFiles` |
| API 路由 | 4616 | `apiRoutes` |
| 路由文件 | 651 | `apiRouteFiles` |
| AI 服务路由 | 611 | `aiServiceRoutes` |
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
| 测试文件 | 3600 | `testFiles` |
| CI 工作流 | 50 | `ciWorkflows` |
| Compose 服务 | 14 | `composeServices` |
| 工程守门 | 299 | `guardianGates` |
| — blocking | 273 | `guardianBlocking` |
| — warn | 28 | `guardianWarn` |
| 跟踪文件 | 17677 | `trackedFiles` |

上表由 `node scripts/gen-doc-numbers.mjs --markdown` 生成,最后核对日期 2026-10-29。
每个数的来源就写在取数键旁边的实现里(`scripts/gen-doc-numbers.mjs` 的 `SOURCES`),**不得手抄、不得另立第二份**。

<!-- END GENERATED NUMBERS -->


## Recent updates (auto-maintained)

<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->
**2026-10-30**
- 🐞 Fix:registry-sync 批量失败时把真实错误写进 sync_log —— 门 47 现在只报得出条数 (a3d7f7f2bf)
- 🔧 Chore/Other:归档件补溯源水印 —— 销 10-29 归档留下的 HEAD 面欠账(门 47 复跑点名) (d05bdf123d)
- 🐞 Fix:react-native-screens 4.26.2 升到 4.30.1 —— 桥接拆除期 NPE 的官方修复面 (19ab214903)

**2026-10-30**
- 🐞 Fix:回退检查点的时刻在服务端出口折成毫秒 —— 「恢复到本轮之前」此前恒回到未来 (1bf0f57b9d)
- 🐞 Fix:大屏号池列宽下限取实测最大值 186 —— 上一版 143 会把复合读数压出卡片 (977734d140)
- 🐞 Fix:修正门 237 R1 的出路文案 —— 置 null 不是「无 rn 腿」,删不满足登记口径的条目才是恢复口径 (5265a3a294)
- 📚 Docs:登记领券中心两枚端点与工具目录 seed(§21 功能同步) (93cb4a69ca)
- 🐞 Fix:拆开 conversationImport.historyFailed 的同名不同义 —— 一个键在两端承载两种语义 (a420cfe1d5)
- 🐞 Fix:协议条款正文两端同文 —— 46 处文案漂移里唯一可证安全的一族,其余逐枚判过不是缺陷 (35fbc9e45b)
- 🔧 Chore/Other:摘掉两枚 HEAD 存量中文残留红 —— 措辞按仓内正本对齐,不自造 上一枚摘键提交落地后的「受影响判据复跑」点名 blocking 两臂(门 2o-mobile-rn / 门 2s-mobile-rn)。 逐枚现跑归因:两枚都是**先于本席存在**的存量红(行号随摘键挪位才第一次被读到),与本票载荷无关, 但红点归 i18n 面、修法唯一,就地收口而不是留给下一位再撞一次: ① ja  webViewPortal.distributionWithdrawRecords 「分销出金履歴」→「代理販売の出金履歴」    —— 后者就是 miniapp-taro/ja.json:4821 同键的在册正本(miniapp-taro/ja 现跑 ✅ 无中文残留)。 ② zh-TW webViewPortal.memoryManager「記憶管理台」→「記憶管理臺」    —— 守门自己给出的替换值,且与 miniapp-taro/zh-TW.json:4824 的在册正本逐字相同。 ko 面同一键的「分销 출금 기록」被扫描器判 **warn-only**(rc=0,半翻译类,「可能是有意为之」), 按 §12e 不为消红去改判据射程外的措辞 ⇒ 不动,在这里点名它的存在与不修理由。 验证末行(现跑):scan-i18n-zh-residue ja/zh-TW --target=mobile-rn 双双 rc=0「无中文残留」; check-i18n-keys --parity-only --worktree ⇒「5 语言 parity OK」× 25777 键路径;watermark verify 残迹 0。 (045c1aeb2c)
- 🐞 Fix:登记表删 4 条不满足登记口径的行,门 237 四处红与漂移 registry-rot 同笔归零 (3e80ad99e5)
- 🐞 Fix:门77 B5 63→0 —— 给漏登记的第三方 lucide 字形生成件补 OUT_OF_SCOPE 声明(路径精确正则+bExempt,零通配;1/3/9 本不在档位表,吸附即改坏字形并与 web lucide-react 脱节)。同数据 LineIcon/icons.ts 早已挂 bExempt,icons-generated.tsx 随门251落地时漏登记;单 hunk 只落数组体内,B1-B8/A/C 零字节改动;摘除 239→240、自检 86 例、镜像 23/23,复核期 2027-04-30 写入 why (902b233314)
- 🔧 Chore/Other:25 枚死键候选逐枚定性后收口 —— 确证死的摘、契约键登记、在飞与双端不变量一律不动 三桶:A 确证死 9 摘(五语言同批) / B 契约键 3 登记 / C 不动 13。判定按行内自写判据当场复跑,不采信报告措辞。 (1bd1a1fdd7)
- 🔧 Chore/Other:ui-routes 产物追平领券中心改动 —— 收掉 105 最后一条 G5 (8da3805690)
- 🔧 Chore/Other:G-1102638 批1 同主键副本行物理归并 — 删 1 行(机主拍板〔拍板@2026-10-08 机主:真删+立即执行〕;幸存者规则与F4同向;落账注记行保留待批2;复跑auditPlan对账F1=0/F9不增;逐行留痕 .ihui-agent/archive/PROJECT_PLAN_copy-purge-2026-10-29.md) (1451a858cf)
- 🐞 Fix:深度排查前端缺陷第二批 —— 注销/2FA 关闭补请求体,富文本三连,失败不再冒充空态 (f0a0ffa77b)
- 📚 Docs:固化 goal-b33/b34 全部 24 份席位交接件(原在 gitignored 临时区,机器清理即丢)⇒ 逐席结论与未收格入受跟踪归档;凭据扫描零命中,水印已注入 (05b1bc5ebd)
- 🔧 Chore/Other:两条装车形状锁恢复排版容差(被 9fdbc207ba 批量回退吞掉的那一型)—— 判据没坏,是尺子按折行前的字节形态找字 (8ad1e7dfe7)
- 🐞 Fix:有意接回被 1fe3a2b42d -790行回退抹掉的 ④d「枚回执」档(按 91ead7dd14 原设计逐条移植进 HEAD 现有结构,非整文件覆盖)⇒ G-946 唯一尾巴从 archive-absent 拒删变 ④d 可删;④a/④b/④c/⑤/⑥ 零放宽(用例正向钉住 merge-note twin 不经此通道),三镜像合跑 38/38,三型反向各一枚 (db608ef73d)
- 🐞 Fix:生成器幂等判据补上「值」这一维 —— 绿灯即缺陷已闭 器物此前只比键名集合,登记表回正 CourseMain/NewsCategory/Assistant 三条的 miniapp 指向后 键名一条没变,于是 --write 自报「✓ 路由映射无变化(盘上已覆盖现读 257 条)」并拒绝写盘: 生成物与登记面长期背离,而 --write 正是门 251 C3 点名的修复出口(§0.8 不许写跑不通的出路)。 (746d64acf8)
- 🐞 Fix:有意还原被滞后副本收编吞掉的 requireFlagValue 守卫(门231 --rev 裸值曾静默回落HEAD面/231 --only 吞值假绿/255 --emit-blobs 把旗标当文件名往仓根写/91 --root resolve("")=cwd)+ G-322 blocking档真无守卫4站接齐(站点读数90→86,尺子与 lib/flag-value 一字未动,--self-test 10/10)+ plan-row-conservation 新增窄补号档 idFillTransitionOf(extractTaskFingerprint 族字面量不认两字母个位号⇒RP-1 出路此前结构性不可达;35/35,六型反向全拒) (454c7387cb)
- 🐞 Fix:摘 HEAD 自带的重复 import type SyncReason(:53-54,与:47 逐字同,TS2300 挡全 @ihui/api typecheck)——去重后形态恰等于加重复那份之前的祖先,属预期,非回退;tsc 复验该文件 0 错 (168343a7bf)
- 📚 Docs:auto-triage 自动登记(api-logs;第 1 期感知层产线动作,O65) (9879a83b86)
- 🔧 Chore/Other:移除 knowledge 鉴权里的推断性注释(500 已定位为生产副本未更新) (82fe24c50f)
- 🔧 Chore/Other:对齐 TOTP 默认档钉子到 enforce —— 修一条已入库的红测试 (20bf985270)

**2026-10-30**
- 🔧 Chore/Other:离线语言包追平 mobile-rn/shared 已入库的新键 —— 清 105 的 G5+B2 两处判红 (df7e748402)
- 🐞 Fix:重放 nav.pdfTools 五语言 —— 侧栏引用着它,而词条第二次被并发合并洗掉 (532fdfc9da)
- 🚀 Feature/Improvement:还原度尺补"本端词包缺整块命名空间"这一维 —— 两把尺原先同时看不见 (cd05449596)

**2026-10-30**
- 🚀 Feature/Improvement:工具目录补首启 seed —— /tools 页三档此前恒显示「暂无工具」 (784d12c567)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (49f90ce0c2)
- 🐞 Fix:账本候选列不再让 hub 这类结构词冒充业务身份 (d5724ae70f)
- 🔧 Chore/Other:第二次撤净 parent-pollution-strays —— 第一次的撤销枚被别席滞后前推整片洗回 (0a66be2720)
- 🔧 Chore/Other:离线语言包跟随词包重建 —— 补键后产物自述钉必须同源 (442dba3da6)
- 🐞 Fix:服务清单器三处裸 $n 内插根修(RegistryKey.ToString() 返 HKEY_LOCAL_MACHINE 全串⇒真服务全 continue,修前 exit 0 而 services:[])+§0.3「枚举到0个⇒exit 2 未判定」硬闸(T| 分三种0)+生产者形状锁 bareRegistryVarHits;自检 20/20 含改回必翻红成对对照;本机现读 3 枚在册服务零入库真相源,反向 8 枚仓内点名本机不存在 (13c78b14fc)
- 🐞 Fix:登记表 4 条抢键条目 rn 置 null —— 撞键 5 组收到 1 组,3 个路由名改回真渲染者的页 (b608ba35c3)
- 📚 Docs:补回上一枚被 bash 命令替换吞掉的门名(守门133 check-i18n-locale-content-language)——反引号串在双引号里被当命令执行,文件名成空 (892b1ff31f)
- 📚 Docs:更正 §19 假陈述——CJK三族互判与同名自套两层"现无门/人工必查"不成立,守门133 check-i18n-locale-content-language 已 blocking 装车(runner:3737);依 g34-s6 一手读数 (41a0dcebb4)
- 🐞 Fix:结清 G-37 三件事(35枚JSON parse全OK+四道i18n门全绿+CJK互判/同名自套真命中0;133已装车判这两型;看门狗与构建指纹双向消费均在HEAD)——同行清除F11禁桶措辞 (dbb46a7792)
- 📚 Docs:把 SDK 票漂开版的两个独有记号折进当下行(G-23 与释放注记) —— 为归并做零丢失前置 (55877ff48d)
- 🐞 Fix:结清G-16(别名+类臂两维已落地)/G-14(svc run脚本已入库+E1真装audit)/G-07(清偿器落地前自查已接)/Esc层栈协议5份副本(单实现+50消费方+23用例+CI 692通过) (d6a4f00558)
- 📚 Docs:给24枚占位符作用域票补出真实落点(只搬票面正文已点名、但未加反引号且在HEAD存在的路径,零编造)⇒ 派单器可对它们发互斥合格证;勾选/租约/归属三维逐行不变 (93e0ae4653)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (d2269d7fea)
- 🚀 Feature/Improvement:hook-failed 帧契约 + api-client 解析 + store 落桶(G-87 补链,端侧半) (f41cdcad58)
- 🔧 Chore/Other:块级窗口判据主文件 prettier 格式对齐(语义零变化) (f745178ed8)
- 🔧 Chore/Other:test (eb848ead6b)
- 🔧 Chore/Other:b76-15 三文件 prettier 格式对齐(语义零变化) (be7ba525d5)
- ♻️ Refactor:孤儿护栏一接一退 —— check-immutable-guard 补 --audit-new(每枚判恰好一次,六态封闭)由 git-guardian 旁路派发(5min 节流/breach 才到人,不挂提交链不堵门);check-guardrail-hashes 退役(与 root-guard 同三目标同机制、基线件从未入库致 --verify 恒 exit 2,接线即 §0.6 重复实现装上车) (b2c05e4493)
- 🐞 Fix:gen-rn-compat --write 重写 route-map 时 100% exit 2 根修(共享树瞬时句柄争用 errno -4094 不重试且把原因截成命令本身)⇒ 走 lib/atomic-write 唯一出口+退避重试+回读自证 payloadIntact+stderr/errno 点名;镜像 N1-N5,15/15 (b4bb4d01d7)
- 🔧 Chore/Other:路由表随登记面重生成 + RN 测试替身收两处局部复刻 + 硬编码中文基线下调一枚 (3b76e9adf5)
- 🐞 Fix:有意还原被 9fdbc207ba 当残件删、6d0dbde7c9 只带回消费行的门234纪元声明面 ⇒ --staged/--worktree 不再 ReferenceError(此前 blocking 门在 pre-commit 面等于不存在);恢复 A1 身份维+孤儿 identity 形参接回 judge;侧车签名折算按取证收掉(接回即造 rotn=17 假阳恒红);回归锁:真跑 --staged + 变异反证,镜像 17/17、自检 26/0 (d17a1f6c74)
- 🐞 Fix:前向重放首页收口那一刀 —— 它被 ffbe506f9e 的整文件重放抹掉,商品族堆叠在 main 上已复活 (e118488e7a)

**2026-10-29**
- 🚀 Feature/Improvement:「已 accepted 未投影」账本 + 空响应权威答案兜底 (02bdf74496)
- 🐞 Fix:结清11枚已实现票(告警去重身份/票60多窗格/G-878原生弹窗/D11语音barge-in/G-1222556 CSRF形状/成本熔断/影响面隔离/进化回流/监控大屏/O68就绪门 等,g33 t2t3逐条一手凭据) (e7f79cf7ae)
- 🚀 Feature/Improvement:帧水位事实上报的端内唯一消费点接线(对标 Qoder 借鉴清单第 6 项) (fc66ffaf0d)
- 🔧 Chore/Other:侧车经三条官方出口整份重建(258→155行):--dedupe 60条同键多份→--retire-orphans 43键退场(28条逐字留痕)→--reclassify G-115改归机主git收敛面;rot 58→40/conflict 40→0/dup 6→0/blind 5→0;非手改jsonl,逐行处置见 g33-s10 报告 (68029830b1)
- 🐞 Fix:登记表 17 处 rn 错写批量回正 + 补一条两代屏共用映射 —— 小程序 15 个路由名从"点了不动"变可达 (5aebbb02a8)
- 🐞 Fix:结清不可变护栏(root-guard已fail-closed接部署环)/B02(双轴+review+sse契约四落点齐) (86bb156b21)
- 🐞 Fix:结清 B03(双轴类型+consumers+守门68对账齐)/G-965(投影与强制档均已落,门234已blocking) (7d8ec7325f)
- 🐞 Fix:结清四票(207第二刀declaredDropCaps已接/G-1222558四格已达成/68-RN腿三函数同值/圆角基线前提腐烂) (eb87981ee5)
- 🚀 Feature/Improvement:帧水位接成有生产点的完整腿 + 静态长文档块级虚拟化（对标 Qoder §2 / §6.6） (efcb3c8573)
- 📚 Docs:摘除 SDK 票同题跨号重复登记副本(代裁) —— 它正挡着全仓推送收敛 (afeb6ed298)
- 📚 Docs:鉴权兜底闸已切 enforce，补记 12 条裸奔发现与蓝绿踩坑 (6df1c8efdc)
- 🐞 Fix:enforce 档抓出的两条合法公开面补进名单(app-version / news) (1a55dab48d)
- 🚀 Feature/Improvement:补 ai.pane.hookFailures 五语言词包(38 键 x 5) (ffdf6e8807)
- 🔧 Chore/Other:重封 root-guard 清单到已入库的 guardian-runner 内容 —— 三处签出的部署环此前全部 fail-closed (58f51477c1)
- 🚀 Feature/Improvement:补 ai.pane.hookFailures 五语言词包(38 键 x 5) (40206d8ec6)
- 🐞 Fix:折叠漂开副本族(N→1,认领合并到保留行 + 逐字留痕;--fold-drifted-families) (cd90c6ea1d)
- 🚀 Feature/Improvement:视频卡片补齐 分享/复制链接/下载 三个动作 —— 对话框内媒体产物可带走 (06b0c50918)
- 🐞 Fix:兜底闸不得二次 send —— 修 /api/knowledge 匿名访问 500 而非 401 (83359d5396)
- 🐞 Fix:结清 G-706 —— apps/cli/src/worktree.ts:570-576 已用 mkdir EEXIST 当原子互斥(不做 existsSync 预检关 TOCTOU),marker 齐备 reused:true、不齐证明不了即保留不删 (5bfdae44b7)
- 🚀 Feature/Improvement:对标 Qoder 借鉴清单第 9/10 项 —— 准入回执配对(inputId)+ 命名错误码分类处置 (ef471e56a9)
- 🚀 Feature/Improvement:跨端生成器对同 rn 撞键出声 —— 静默后写覆盖从此可见 (6e712dc3ef)
- 🐞 Fix:补全鉴权兜底的公开名单并给 enforce 档留痕 (45e7f7ba55)
- 🐞 Fix:幻影漂移对齐补"活工作二审"—— 恢复历史内容不再被当陈旧副本回滚 (aac2e1af87)
- 🚀 Feature/Improvement:hook 执行失败六态卡接车（数据面待接） (fe687a0382)
- 🐞 Fix:回补误摘的 G-322 行(该票未完成:旗标单源已接的 11 文件已满探针,另 77 站待迁) (ab52c91d87)
- 🐞 Fix:结清 O01(对照面空判未判定)/G-79(38枚红现读全绿)/G-927(票面9枚已清零,新增21枚另记) (a079c9d7c4)
- 🐞 Fix:check-task-claims --twins 对照集为空时落「未判定」exit 2(不再把"没得比"报成已清零)+ twinsFace 键 + T26/T26b (7406e95748)
- 🔧 Chore/Other:清两族存量测试红 —— skills-market 的 mock 层错位 + 块合并用例沿用旧判据 (65654e57cd)
- 🚀 Feature/Improvement:语义折叠策略 + 工具摘要计数上屏(对标 Qoder 借鉴清单第 4 项) (66cf1b45b2)
- 🔧 Chore/Other:补齐 plan-fields-project --emit 坏值探针(11/11 全覆盖) + G-79 38 枚红逐条复检取证(现读 514/515 绿,唯一失败不在票面) (b8949cf8d7)
- 📚 Docs:供应商名单补 xai —— 名单项数与计数 18 长期不符,补上后自洽 (3d2895666d)
- 🐞 Fix:前向修复 9fdbc207ba 整树收编事故 —— 恢复两条被删能力 + 收口 19 处裸 create_task (cd5339a760)
- 🐞 Fix:结清五票(G-926 ignored雷区已清零/D42046审批重放A档已落/monitor面板/O87g守门8/上游模型双写对账) (eb28653c90)
- 🔧 Chore/Other:补 @ihui/shared 子路径别名与替身出口 —— 六枚套件从账面通过变真跑出用例 (f1560a322e)
- 🚀 Feature/Improvement:上游模型登记器与 workbuddy 同步器双向归属对账(跨路径 provider 抽取 + assertOwnership 前置守卫 + 只读 --check) (cdef20f80d)
- 🚀 Feature/Improvement:三处「造好没装车」接上生产渲染路径 (15cd3b6eb3)
- 🔧 Chore/Other:摘除两枚误入库的工具会话导出附件(1.8MB,含凭据行;工具产物不入库,盘上副本保留) (34036e6a83)
- 🚀 Feature/Improvement:十态轮次状态徽章接线 + 错误码目录首次进屏幕 (651cb924c0)
- 🐞 Fix:结清 45 枚前提腐烂/已实现票(批3/3,g30 七席只读分诊逐条一手证据) (2d2bceb2c2)
- 🐞 Fix:重生成小程序路由表 —— 商店跳板回正,并补出 Home/HomeMain (b439ca6e69)
- 🐞 Fix:结清 46 枚前提腐烂/已实现票(批2/3,g30 七席只读分诊逐条一手证据) (13b4f3b360)
- 🐞 Fix:结清 46 枚前提腐烂/已实现票(批1/3,g30 七席只读分诊逐条一手证据) (900afc860c)
- 🐞 Fix:小程序路由表把「AI 应用商店」错指到首页镜像壳 —— 登记表 rn 撞号根治一枚 (8fa01c3233)
- 🚀 Feature/Improvement:中文全角括号 autolink 修正 + Diff 过期诚实说明 (3f9d52d644)
- 🐞 Fix:副本归并器物有意还原 1fe3a2b42d 对 plan-copy-row-purge 的 -790 行回退(④c 判据层,HEAD 测试 SyntaxError)+ 接线 21/21;修正 s12 测试件重复函数名 (65f63112c2)
- 🚀 Feature/Improvement:中文全角括号 autolink 修正 + Diff 过期诚实说明 (d9aa4637b2)
- 🔧 Chore/Other:更正跨端对账基线里 IntelligentAssistant 豁免的叙述 —— 生产调用方 4 枚减为 3 枚 (48c9c5545a)
- 🔧 Chore/Other:摘 home.recommendCourses 五语言 —— 首页横向推荐列表已下线,键随之零消费者 (0c935a0192)
- 🐞 Fix:取消信号穿进 hook 调用点 —— 有意还原 9fdbc207ba 当残件删掉的两处 _wait_interruptible 包裹(969d74b9a6..HEAD 对该文件仅 9/32 行差异,已逐行核对) (8a8ff1f65f)

**2026-10-30**
- 🐞 Fix:账本候选列不再让 hub 这类结构词冒充业务身份 (d5724ae70f)
- 🔧 Chore/Other:第二次撤净 parent-pollution-strays —— 第一次的撤销枚被别席滞后前推整片洗回 (0a66be2720)
- 🔧 Chore/Other:离线语言包跟随词包重建 —— 补键后产物自述钉必须同源 (442dba3da6)

**2026-10-30**
- 🚀 Feature/Improvement:领券中心接上真实数据与领取动作 —— 止血空态退场 (4f0d0c261b)

**2026-10-30**
- 🚀 Feature/Improvement:小程序补 member.couponList.receiveFailed 五语言 —— 领取动作需要一条失败文案 (45da4d7815)
- 🚀 Feature/Improvement:补「领券中心」的两个用户面端点 —— 可领券列表 + 按 id 领取 (36f6c451f8)

**2026-10-29**
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (f72df75e51)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (888be1ba64)
- 🐞 Fix:装悬空提交备份腿到弃落出口(四台落地器共用一份 lib)—— 门 30a 存量从此有排水口 (4468747144)
- 🐞 Fix:删除 relay-account-pool-worker 重复的 runTraeSessionSync 导出 (8176b5c52a)
- 🐞 Fix:注册页倒计时改走取词 —— 此前 en/ja/ko/zh-TW 用户看到的是"12秒后重新获取" (7a25781c11)
- 🐞 Fix:补齐端内在用而词包查无的 8 枚键 —— 这些界面在非中文语种下一直出中文 (fe13f15ab8)
- 🐞 Fix:语音输入条两枚圆角收成同档 —— 小程序腿此前比 RN 腿各粗一档 (57c98b75a3)
- 🐞 Fix:恢复被 d801061d98 误回退的文件(fixup,保留后续正常提交与本票 5 文件) (a598eb0f65)
- 📚 Docs:鉴权兜底闸已以 observe 档上线，更正'未做'记录 (05e0e309c3)
- 🐞 Fix:observe 档上线即抓到 GitHub webhook —— 补进鉴权兜底的公开名单 (6774a82ebf)
- 🔧 Chore/Other:补齐三个边缘守卫文件的溯源水印 (aa98aab816)
- 🚀 Feature/Improvement:鉴权默认拒绝兜底闸(onRoute 追加,默认 observe) (e876ad8f6c)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (cb284b0b0a)
- 📚 Docs:防病毒已装并用 EICAR 实测、守护自拉起腿已补 —— 两格闭环 (2feee1ff75)
- 🐞 Fix:修 feature-center i18n 键缺失（开发仓对齐生产仓） (a412a16e56)
- 🐞 Fix:修 feature-center i18n 键缺失并补 ui-react work-panel 预留属性 (63efdcfb6c)
- 🐞 Fix:补齐 checkpoint 回退入口与 tool-summary 帧的两个缺口(全量 typecheck 归零) (909ae74411)
- 🐞 Fix:Trae 切号不再按映像名全杀进程 (3f598e351d)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (c9ab7153bc)
- 🚀 Feature/Improvement:补 daemon 档自我存活兜底腿 (cca0a95e4f)
- 📚 Docs:补记 2026-10-29 二轮加固(未授权面/本地文件面/边缘 IP 身份) (4d3f14ea77)
- 🐞 Fix:本地文件面收口(任意文件读/任意目录删/跨用户上传) + TOTP 默认升 enforce (1ec1beea63)
- 🐞 Fix:镜像构建上下文排除真实密钥,并钉住规则不被删/不写错模式 (c860842563)
- 📚 Docs:闭环源站收敛待办并登记主机侧三项加固 (b3773937d9)
- 🐞 Fix:边缘 IP 归一再补隧道腿——cloudflared 回环对端采信 CF-Connecting-IP (ad802698df)
- 🐞 Fix:边缘 IP 归一再补隧道腿——cloudflared 回环对端采信 CF-Connecting-IP (daf8856aa2)
- 🐞 Fix:成本面/调度状态面进入永不公开名单,收回 .env 白名单漂移 (433df6460d)
- 🐞 Fix:收紧知识库归属——/api/knowledge 全插件强制登录,归属只认凭据 (ca1775aa7e)
- 🔧 Chore/Other:新增变更B边缘IP透传端到端链路测试 (1a9f2ba2ba)
- 🔧 Chore/Other:将 app/core/background_tasks.py 纳入版本控制防丢 (3c6419bf02)
- 🐞 Fix:去掉收敛归并留下的三处重复导出(ExpertAutoRouteMode/ReviewFindingEvent/ReviewFindingSeverity) (b4c26c122e)
- 🔧 Chore/Other:security：闭环变更B边缘IP透传并补API响应安全头（变更C） (79e830ba98)
- 🐞 Fix:补齐 9fdbc207ba2 那批「清理功能回退残留」抹掉的实现(api-client 两导出 + 四个 store/hook 面) (c51a00fd0b)

**2026-10-29**
- 🐞 Fix:底部胶囊的毛玻璃模糊半径收成单一源头 —— 两端各写一份 24 靠注释对齐 (5493867cd7)
- 🐞 Fix:消掉上一枚落地后复跑暴露的三处简体残留 —— 否则这道门就是我造的恒红门 (c306cfaa2a)
- 🐞 Fix:底部胶囊的 Android 真模糊强度调到可见档 —— 接线补齐后仍看不出模糊 (57dd6758c5)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (b7f6a03017)
- 🔧 Chore/Other:把 ruff/mypy 两面存量红(19 + 4)清到 0,让号池之外的 Python 门重新有牙 (2b981bd839)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (b06c8b01c7)

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

