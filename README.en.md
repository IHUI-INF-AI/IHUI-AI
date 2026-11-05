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

Headline claims (same source as the table below, all live-computed): **618 tables · 4672 API routes ·
25 WebSocket endpoints · 100 catalogued LLMs · 38 platforms auto-publishing · 3985 test files ·
303 engineering gates · 50 CI workflows · 5-language i18n parity · 9 app packages · 16 shared packages ·
14 compose services**.

<!-- BEGIN GENERATED NUMBERS (node scripts/gen-doc-numbers.mjs --markdown) -->
| 指标 | 现值 | 取数键 |
| ---- | ---- | ------ |
| 数据库表 | 621 | `dbTables` |
| API 路由 | 4699 | `apiRoutes` |
| 路由文件 | 663 | `apiRouteFiles` |
| AI 服务路由 | 631 | `aiServiceRoutes` |
| WebSocket 端点 | 25 | `wsEndpoints` |
| 入库模型清单 | 100 | `llmModels` |
| 发布平台 | 38 | `publishPlatforms` |
| 端应用包 | 9 | `appPackages` |
| 共享包 | 16 | `sharedPackages` |
| CLI 命令文件 | 74 | `cliCommandFiles` |
| CLI 工具文件 | 78 | `cliToolFiles` |
| 语言 | 5 | `i18nLanguages` |
| i18n 作用域 | 7 | `i18nScopes` |
| 语言包 JSON | 35 | `i18nMessageFiles` |
| 测试文件 | 4117 | `testFiles` |
| CI 工作流 | 53 | `ciWorkflows` |
| Compose 服务 | 14 | `composeServices` |
| 工程守门 | 336 | `guardianGates` |
| — blocking | 306 | `guardianBlocking` |
| — warn | 32 | `guardianWarn` |
| 跟踪文件 | 19275 | `trackedFiles` |

上表由 `node scripts/gen-doc-numbers.mjs --markdown` 生成,最后核对日期 2026-11-05。
每个数的来源就写在取数键旁边的实现里(`scripts/gen-doc-numbers.mjs` 的 `SOURCES`),**不得手抄、不得另立第二份**。

> ⚠️ 未判定 1 项:`dbSchemaFiles`(packages/database/src/schema 面上列出 241 个 .ts,其中 1 个取不到内容)

<!-- END GENERATED NUMBERS -->
<!-- END GENERATED NUMBERS -->


## Recent updates (auto-maintained)

<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->
**2026-11-05**
- 🐞 Fix:公众号关注项判据换成服务端直读,并更正取证面(现读 42 条端点零写侧) (d8d888dd9e)
- 🐞 Fix:强保腿三格同批修(心跳取错键/整族拨心跳/登记面锁死运营池),并把 10 枚 Qoder 号真正接管续期 (88288827eb)
- 🐞 Fix:持久错误文案里的整对象/整数组内插改走有界化出口——清门 181 点名的 3 处 PERSISTENT (68522452b1)
- 📚 Docs:第七回合入账——三席产物 + 「到期清理」调度腿 + T1 七条缺口逐条定性 (47cd0595ec)
- 🚀 Feature/Improvement:给「产品形态 → 能力布尔」建声明式单源,两个消费点按表降权、缺键显式出声(rea goal-b49 Y3 席产物,主席复量收口) (bbcedb110e)
- 🐞 Fix:摘掉两文件基线外硬编码 hex 并清白名单僵尸条目——门 218 RULE-1 (26b4a22cec)
- 🚀 Feature/Improvement:复现 Trae 的企业命令黑名单与命令级三段决策,合并器逐条点名来源(rea goal-b49 Y2 席产物,主席复量收口) (b3e3723331)
- 🚀 Feature/Improvement:复现 Trae git-ai 的「AI 代码归属追踪」并把三态判据做成仓内只此一份(rea goal-b49 Y1 席产物,主席复量收口) (392a4f94a1)
- 🚀 Feature/Improvement:成长任务「公众号关注」项的收口命令——关注后到账即领 (319ed3dee5)
- 🐞 Fix:agent-progress 触发器圆角回 control 档(sm)——清门 150 点名的唯一判红族 (6aef6f0c04)
- 🐞 Fix:小程序侧 sse-parse 显式认领 chunk 帧——门 63 判的是分支守卫不是产出 (609ecff87d)
- 🐞 Fix:大屏指标门的扫描根接到 11-04 退役后的真源——HEAD 面枚举 0 枚把 CI 顶成 blocking 红 (7ac117afea)
- 🐞 Fix:Qoder 回灌腿补写客户端心跳,永久保活档不再可能被误判静默 (2daeeca027)
- 🐞 Fix:skills-catalog-wiring 测试去 eslint-disable——importOriginal 泛型改顶层 import type(对齐 a939b66110 先例),清掉被抑制的 consistent-type-imports (2e24bd1ca2)
- 🚀 Feature/Improvement:给回收站到期清理装调度腿(24h 节流 + 仅退休才寄信) (3e3cd3dd9f)
- 🚀 Feature/Improvement:给回收站到期清理落可执行入口(调度腿的唯一跨进程边界) (fd1edb25bd)
- 🚀 Feature/Improvement:成长任务「专家体验」项的真客户端驱动链——召唤+对话+回读确认计分 (295e588b0b)
- 🐞 Fix:verify-deploy-facts.ps1 补 UTF-8 BOM——门265 绝对判据(HEAD 面缺 BOM 即红) (2643ca2c28)
- 🐞 Fix:守护全量日志改落 .ihui-agent/tmp——首轮实测日志写在仓根把门 281 判红(自己捅的) (1f63426bdc)
- 🔧 Chore/Other:哨兵分流独立镜像用例——目标存在/悬空/无 gitdir 三对照仍照旧命中 (8675e46be9)
- 🚀 Feature/Improvement:registry 汇总口定性落档 + manifest 别名归一化(rea goal-b49 X2 席产物,主席收口) (cb9cb55724)
- 🐞 Fix:认 .DevEnv 坏 gitfile 边界哨兵——worktree 里跑测试不再把全仓提交链堵死 (8706e2bb82)
- 🚀 Feature/Improvement:回收站到期清理落端内 adapter(七步 + fail-closed + 连败退休),判据零复算(rea goal-b49 X1 席产物,主席复量收口) (b709aa4ade)
- ♻️ Refactor:skills list 与 /skills 同源同形 + 到期判据按职责拆档(rea goal-b49 X3 席产物,主席复量收口) (4c08c9baf1)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (d5bc3901f5)
- 📚 Docs:第六回合五席产出入账 + §8c 那道合并分歧的结清读数 (2441c18be2)
- 🐞 Fix:共享层公开入口补登 5 条精确名——清门103 D3 的 14 处"入口未声明" (6dc60e0fd3)
- 🐞 Fix:NavBar 加入按钮描边改 brandAccent.deep——对齐小程序端既有档,清门83 R3/R8 双债 (16b03e422b)
- 🚀 Feature/Improvement:补上 worktree 删除出口的容器性断言并接满三处出口,W-2 那格连账面副作用一起改对(rea goal-b49 W5 判据 + W9 接线,主席复量收口) (78926473f1)
- 🚀 Feature/Improvement:给删除保护链补上「到期清理」判据 + 清理器自身的死亡机制(rea goal-b49 W7 席产物,主席复量收口) (c96284038a)
- 🐞 Fix:收编时拦下「行级祖先命中」的滞后副本(事故 8dbe7ed287 回放) (2c25073cc7)
- 🚀 Feature/Improvement:技能目录缓存接上 /skills 真消费点(rea goal-b49 W4 写 + W8 复核,主席复量收口) (d51703a8b3)
- 🚀 Feature/Improvement:复现 Qoder 的激活事件档位与 33 条权限名入库,并接权限面到 dataClass 默认拒(rea goal-b49 W6 席产物,主席复量收口) (97d676acd8)
- 🐞 Fix:放宽 _wb_request/_post_once 的 body 类型——main 侧 c70dc9951b 引入的 arg-type,修语义不消音 (9ace5d96e0)
- 🐞 Fix:g706 夹具改走 scratch-dir——不再在仓库树内造 .git 堵死门208 (994ae64ea8)
- 🐞 Fix:恢复 local-folder-picker 的具名字号档与继承钉(11 处,守护判据回归合规) (ce1fb18770)
- 🚀 Feature/Improvement:快照存储层按 fs 适配拆档,GC「判不出⇒不删」的原因逐条上账(rea goal-b49 W3 席产物,主席复量收口) (d71a551036)
- 🐞 Fix:rebuild-local 摘掉 || true 恒真兜底——cat-file 失败不再被读成健康 (45a9da7bde)
- 🔧 Chore/Other:治理债②结清——删除 HEAD 面 13 枚零消费者死脚本 (34cd0f1b20)
- 🚀 Feature/Improvement:门89 R3 登记面扩到 scripts/ 直属全量 + red-r3-rot 腐烂档;r3Register +18 枚逐枚定性 (37881c66ba)
- 🚀 Feature/Improvement:守护全量档开工作日定时+报告档——332 道门不再只靠人手点,逐门日志入 artifact 且不设 required (64bf9417b9)
- 🚀 Feature/Improvement:把 Trae 式四维工具配额真正接到消费点(具名拒绝,不静默截断) (405239526e)
- 🐞 Fix:stylelint 缺配置改灰跳不假绿——探测步单源门控,未执行落 warning 与 step summary 而非静默成功 (1c67575e1c)
- 🚀 Feature/Improvement:把插件贡献审计装到生产装载链,并把 loader.ts 按职责拆到三档(rea goal-b49 W2 席产物,主席复量收口) (74e321fc08)

**2026-11-05**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (9dbe548e3d)
- 🐞 Fix:顶层 import type 替代 import() 类型注解，修复 gate-analyse lint 红 (a939b66110)

**2026-11-05**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (bc95503ed4)
- 🐞 Fix:会员权益页类型改从 @ihui/types 取，修复 gate-analyse TS2305 (d51e6a4f63)

**2026-11-05**
- 🔧 Chore/Other:收编守护落档产出(1 件,凭落点账本) (8dbe7ed287)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (362ff59142)

**2026-11-05**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (cc719f9f96)
- 🔧 Chore/Other:合并后按词源重生成 i18n 生成物 —— 3 枚 .gen.ts 用 gen-i18n-compressed.mjs --head 重出(可达键 3515 / RN 包 6346 键);4 枚 b64 与 HEAD 逐字相同(421→426 键的陈旧副本已由重生成消掉);承 union-converge 落地要求「生成物按本侧留下、落地后需重生成」 (0464e09ba0)

**2026-11-05**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (fcdb5ca239)
- 🐞 Fix:活文档维恢复对侧原样的 missingTheirs 行名——处置权过滤另起名,两侧对同一行必须逐字同形(否则零损失断言判我方没含住对侧那行) (c78497e238)
- 🐞 Fix:防丢闸补上 union 那三个「不补回」口子——改写形态族销账 + 本侧处置权维(两把尺子必须同形,否则恒红门那一型) (d971ace310)
- 🐞 Fix:内容级防丢闸并入远端「剥生成块」纠偏——两侧对同一行改成同一形态,三方归并不再留冲突区 (edc453d125)
- 🐞 Fix:清掉号段租约区 P89 的 2 条逐字重复副本(留首条,主键/租约语义不变) (a77728492a)
- 🔧 Chore/Other:[cross-end-1105] docs(cross-end): 三端对齐矩阵按 HEAD 面重生成落地 —— 生成器的分桶修复追上了措辞,却没追上派生件 (15975e732a)
- 🔧 Chore/Other:壳声明件跟随新落承载页(206 条说明符) (a5d27375e8)
- ♻️ Refactor:首批复制页薄壳化(recruitment/benefits/exam-answer) (a67842c570)
- ♻️ Refactor:RN SRS 与小程序模型列表改走共享端点 (609ce38556)
- 🚀 Feature/Improvement:把档表缺位的「准入线」从散文装成可跑判据 —— 222 处缺位值首次有核销面 (6384640463)
- 🔧 Chore/Other:content-loss-gate 镜像测试补溯源水印(门 47p push-scope 检出缺失) (9d10f9c3f2)
- 🐞 Fix:内容级防丢闸对活文档生成块剥后再判 —— 修 README 数字层的恒红维(§12e) 实测:第 9 轮收敛落地闸被 README.md「对侧缺失行 5」拦停,那 5 行全是 gen-doc-numbers 生成块内数字/trackedFiles 值——两侧各自重算时点不同,行值互斥,「行级全包含」在生成块上结构上不可满足,等价恒红门。纠偏=stripGeneratedBlocks 只剥成对 BEGIN/END GENERATED 标记块再判行级包含;人工段落一行不放宽、键集面一字不动,生成块零丢失由生成器单源+落地后 docs 重算腿(47b 系列)承接。另:lint 修复 read 回调未用形参。 (815b0467e1)
- 🐞 Fix:扩展版本抬到 1.0.1 并把下载面刷新接进部署净面回搬 (023aa1d154)
- 📚 Docs:testFiles 散文声明同步 4098→4099(68f2f1a346 新增测试后门 173 判红;README.md 12 处 / README.en.md 1 处) (cb5d636851)
- 🐞 Fix:Browser Hub 真画面用例改走服务端默认空会话(2026-11-01 SSRF 闸对 about:blank 判 400),CI Playwright 步骤补 html 报告产物 (edba672f53)
- 📚 Docs:68f2f1a346 新增 2 文件+1 测试后按 HEAD 面重算生成块(trackedFiles 19199→19201 / testFiles 4098→4099);四份 README 先回 HEAD 基线再整块替换 (d2add2d527)
- 🐞 Fix:会话历史日期分桶对齐 web 日历制并下沉共享层 (72c6938d8b)
- 🐞 Fix:降级 37 个无外部引用导出并删除 1 个死函数(exports 1754→1737/types 1473→1452) (60d7094e0a)
- 🐞 Fix:门 121 C6 认领注入型取词器(prop/解构/context/hook),消除共享屏假阳性;补 I19/I20/M8 自测与 T17 端到端 (03a4167167)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (6c32e371e9)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (f29514fd85)
- 🐞 Fix:会话日期分组改为日历制(周一起/1号起)并补 earlier 桶 (77e8c9be98)
- 🔧 Chore/Other:收编守护落档产出(5 件,凭落点账本) (69c7fc354c)
- ♻️ Refactor:收编 B2 同值异键 97 条并修 i18n 测试存量红 (10ab23989e)
- 📚 Docs:testFiles 散文声明同步 4098→4099(68f2f1a346 新增测试后门 173 判红;README.md 12 处 / README.en.md 1 处) (d40cf5c15b)
- 🐞 Fix:Browser Hub 真画面用例改走服务端默认空会话(2026-11-01 SSRF 闸对 about:blank 判 400),CI Playwright 步骤补 html 报告产物 (1ce6c3c3d2)
- 🐞 Fix:CLI 签名缺凭据硬失败 + 补 macOS 公证 .p8 落盘/清理 + 修文档口径 (35da334d47)
- 📚 Docs:68f2f1a346 新增 2 文件+1 测试后按 HEAD 面重算生成块(trackedFiles 19199→19201 / testFiles 4098→4099);四份 README 先回 HEAD 基线再整块替换 (ce0f211988)
- 🐞 Fix:会话历史日期分桶对齐 web 日历制并下沉共享层 (68f2f1a346)
- 🐞 Fix:降级 37 个无外部引用导出并删除 1 个死函数(exports 1754→1737/types 1473→1452) (33df552e06)
- 🐞 Fix:门 121 C6 认领注入型取词器(prop/解构/context/hook),消除共享屏假阳性;补 I19/I20/M8 自测与 T17 端到端 (0e8aa5c8d4)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (3d4cad2fee)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (52e6de40b1)
- 🐞 Fix:会话日期分组改为日历制(周一起/1号起)并补 earlier 桶 (0310e828c3)
- 🔧 Chore/Other:收编守护落档产出(5 件,凭落点账本) (ccdda077fa)
- ♻️ Refactor:收编 B2 同值异键 97 条并修 i18n 测试存量红 (cca23312a5)
- 🐞 Fix:侧栏日期分桶恢复真日历边界与「更早」桶 (9fe567ab54)
- 📚 Docs:869 行门数/阻塞数与生成块对齐(336/306),trackedFiles 19198→19199 按 HEAD 现算重算 (985d546efd)
- 📚 Docs:正文守门数 333→336(英文 332→336),点名索引补 299/300/301 与 drizzle 迁移对账门(门 89 R4 归零) (ac2babd9aa)
- 🐞 Fix:注释去掉 onRetry={...} 字面避免被提取器误判为新站点 (d973db05db)
- 🚀 Feature/Improvement:299/300/301 三门接线与 README 数字块重算(门号按规则分配,285 未用) (9c7d050b58)
- 🐞 Fix:假重载改判合法差异 + 4 枚未判定按调用链定性为真重载(棘轮基线收紧) (ad66b6782b)
- 🔧 Chore/Other:B2 105 条分桶处置(收编单95/角色豁免7/待裁3) (a007807536)
- 📚 Docs:跟踪文件按合并树重算 19191→19195(新增共享屏承载路由尺 4 文件) (b5893f4962)
- 🚀 Feature/Improvement:新增 web↔小程序共享屏承载路由尺(直接度量 web 有而小程序无) (5d21c8e7b7)
- 📚 Docs:跟踪文件按合并树重算 19180→19182(新增 retry-reload-baseline.jsonl 与 lib/retry-reload.mjs) (c059dcd536)
- 🐞 Fix:数组值 t.raw 键改列「已解析但不可比」独立计数 (42c8267f68)
- 🐞 Fix:两条 B3 判为合法角色差异,unresolved 清零 (e80c745796)
- 🐞 Fix:前向再修 workbuddy_behaviors.py 水印——expert-team 批整体改写行面时又丢载荷,官方 clean→inject 重封,verify 载荷完整(47p push scope 销账) (e49f64efe2)
- 🐞 Fix:补齐 RN 端词包真缺键 exam.result.shareTitle / share.courseTitle（5 语言） (1486db586e)
- 🚀 Feature/Improvement:onRetry 真重载判据扩到 web+小程序,存量落账+新增假重载棘轮 (20284146b6)
- 📚 Docs:跟踪文件按合并树重算 19178→19180(新增 docs-page-metadata-exempt.json 与 emoji-text-stock.mjs) (70635253cc)
- 🐞 Fix:D4 接豁免表 —— 表内页面单列不记绿,短理由/表外路径判表损坏 (b6afe0d5e4)
- 🔧 Chore/Other:DN5 补阴性对照 —— 生成块同步后必须绿 (6b36a7782e)
- 🐞 Fix:按运行时词包组合解析 web/RN 键,未解析键 2562→12 (617288905b)
- 📚 Docs:RP-5 守门 207 存量清偿第二刀按持牌席结清摘行 —— 远端 1b0ecaac57 面该票已 [x] 结清(declaredDropCaps 接线 eb87981ee5 在位),本侧 [ ] 副本为登记旧视同键两态(F1 撞组)结清即删;摘除非新增结论:两格"仍缺"项(摘 207 应急变量+三面复跑)由持牌席结清记录承接,不并行留账 (7e3c79710e)
- 🐞 Fix:补三处判据射程欠账 — emoji 文本位 + docs 页 metadata + trackedFiles 清单不变式 (bddbf405de)
- 🐞 Fix:修平 main 两条 required 红——report.ts 类型导入 + 访问裁决跨平台折路径,并补回被重写冲掉的水印 (de359e5c74)
- 🔧 Chore/Other:校正 .mjs 量化登记口径(受管 2385 / ignore 32) (d11c867d94)
- 📚 Docs:跟踪文件按合并树重算 19176→19178(新增 scripts/lib/hook-tool-path.js 与测试) (793fa5d584)
- 🐞 Fix:lint-staged 启动改用 execPath 与仓内绝对 bin,不再依赖继承 PATH (082a260dcd)
- 🔧 Chore/Other:登记 .mjs/.cjs 不纳入 prettier,新增 format:mjs-added 替代入口 (e4e38cfe3b)
- 📚 Docs:RP-5 结清——门 207 应急跳过口已摘,三面读数与反向例留证 (f793d4c5c0)
- 📚 Docs:README 生成块与叙述数字按合并树重算(测试文件 4078→4098 / CLI 命令文件 70→72 / 跟踪文件 19095→19176) (4fd30b6c68)
- 🐞 Fix:附件预览行 key 由裸 index 改 img-{index}-{uri} 稳定复合键 —— 删除中间附件后 React 按位复用导致 Image source 错位闪图(行为级深挖轮 F9 定性,小程序 InputArea:419 同型先例同形态);验证:TypeScript transpile 零语法诊断+锚点唯一断言+回读确认(全量 tsc 待合流后随端跑,本枚为保活分支) (19a190a5ef)
- 🐞 Fix:摘除门 207 应急跳过口并加装「加回即红」反向例(RP-5 ③) (f20588200f)
- 🐞 Fix:活文档拒收 ⇒ 就地重备一次 —— 收编准备的"已归并"是会过期的凭据(13 枚/轮空转收口) (e5b27f5f93)
- 🐞 Fix:活文档面只认共享清单 —— README 进收编准备(第三层冻结:白名单族 13 枚/轮原地空转) (8a71ec679d)
- 🔧 Chore/Other:收编守护落档产出(5 件,凭落点账本) (5f5cfe6184)
- 🔧 Chore/Other:收编守护落档产出(75 件,凭落点账本) (23142d49c7)
- 🐞 Fix:结清件不再占批预算 —— 已在 HEAD 的申报落 settled 桶剔出通道(最后一公里第二层根因) (3fbaf787b6)
- 🐞 Fix:恢复 NavBar 判据锚点并登记 knip 豁免 (33342743bc)
- 🐞 Fix:修 code-editor-pane 失效键依赖红 + 摘除零引用 NavBar 死副本 (19f523b50f)
- 🔧 Chore/Other:收编守护落档产出(5 件,凭落点账本) (d55ce63ef0)
- 🔧 Chore/Other:稳定 mode-switch 用例 — mock 成本预检并等首流真收尾 (572ddff7b7)
- 🐞 Fix:恢复 workbuddy_behaviors.py 的 main 版水印横幅与载荷 (a619ff8e78)

**2026-11-04**
- 🚀 Feature/Improvement:任务进度芯片改双源取真值(chat 流式态 + 最后一条 planSteps) (5121b20a8d)
- 🐞 Fix:进度面板 click-outside 放行底栏状态芯片,避免点了没反应 (3d814ba021)
- 🚀 Feature/Improvement:任务进度实时芯片与流式三动作回到底栏常驻 (45d879aa87)
- 🐞 Fix:语音引擎/全局快捷键/播报字幕改为常驻挂载,修复控件收进 + 菜单后的功能断链 (364aad95cb)
- 🔧 Chore/Other:补齐 composer 设置行样式令牌文件溯源水印 (04d2d35aac)
- 🔧 Chore/Other:AgentPicker 单源挂载判据适配 + 菜单 row 形态(仅放开挂载属性,单源与先后序判据不变) (763f5bd71c)
- ♻️ Refactor:composer 控件彻底收敛为统一设置行,底栏精简为 [+/模型/发送],+ 菜单按会话设置/内容/能力/更多工具分组(含五语言词包) (dcb2ad1ea1)
- 🔧 Chore/Other:ide-editor 触发器限定 main 内 ViewSwitcher;perf 窗口起点改为首条增量渲染(壳挂载帧不计入预算) (83596a8916)
- 🔧 Chore/Other:fix(api+web)+test(e2e): 修正 LLM 分组表列名漂移 + 提示气泡包装层不再吞点击 + 无 500 用例中性化外部依赖 (7dd6745cac)
- 🔧 Chore/Other:fix(web)+test(e2e): 提示气泡不再吞点击 + agent-progress 菜单关闭判据改看面板存在 (ae2b6431d0)
- 🔧 Chore/Other:fix(ai)+test(e2e): 上下文用量弹层视口夹紧 + 二轮取证红点收口 (2ce5b419c4)
- 🔧 Chore/Other:跟随信息架构重构更新入口路径 (7059dde156)
- ♻️ Refactor:建议条无建议时不渲染任何占位节点 (e7800a7286)
- ♻️ Refactor:画中画/环境建议移出滚动容器，流式动作提到 + 菜单一级 (15e13cc7ae)
- ♻️ Refactor:权限/模式/Agent 提到 + 菜单一级，抽屉改稳定网格并补真实流式取证 (608e9e1a93)
- ♻️ Refactor:AI 面板头部收敛为标题+溢出菜单、输入区收敛为 +/模型/发送单行(含五语言词包) (77abee6346)

**2026-11-05**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (d8666c6909)
- 📚 Docs:第五回合收口 + 登记今日两道活文档机制互斥(它卡死了 112 枚远端提交的合并) (4187fa2eb1)
- 🐞 Fix:折叠漂开副本族(N→1,认领合并到保留行 + 逐字留痕;--fold-drifted-families) (0172c44e04)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (98a1b9ae18)
- 🔧 Chore/Other:活文档对账落盘——HEAD 面与本席工作树副本按 §12b 归并(插回 13 行,归并后 lost=0) (be91ef2c18)

**2026-11-05**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (1f3d29c0bf)
- 🐞 Fix:growth 行为任务判据校正——受理≠计分/accept 三态/报文形态对齐官方客户端 (c70dc9951b)

**2026-11-05**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (858c3718a5)
- 🐞 Fix:delete 轴裁决接到 subagents/worktree 的模型可控删除腿,并让"守护清单取不到"一路出声 (e99903d61e)

**2026-11-05**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (edf8a0ee89)

**2026-11-05**
- 🔧 Chore/Other:收编守护落档产出(5 件,凭落点账本) (74e320124d)
- 📚 Docs:结清「推送未落地」那格 —— 根因是没走收敛器自己给的具名出口,不是判据坏了 (42b23199b7)
- 🚀 Feature/Improvement:growth 行为任务真正自动完成——映射事件 + 浏览器会话门控 (791bd75bd0)
- 📚 Docs:goal-b49 第四回合六枚入账 + 三处被现读推翻的记录就地更正 (3903764479)
- 🚀 Feature/Improvement:复现 Trae 的分维工具配额——MCP 工具数/令牌/自定义提示/历史查询四维独立可拒(rea goal-b49 S4 席产物,主席复量收口) (00ef484ebf)
- 🚀 Feature/Improvement:复现 WorkBuddy 的"随父而终"——MCP 子进程派生点补看门狗,且看门狗自带死亡机制(rea goal-b49 S6 席产物,主席复量收口) (e565814a93)
- 🐞 Fix:把 delete 轴裁决接到 WorktreeManager.remove —— 模型可控入参能把删除目标折出 .worktrees(rea goal-b49 S5 席产物,主席复量收口) (091a63b0e7)
- 🚀 Feature/Improvement:复现 Qoder 的会话快照版本序列,并补三约束回收(rea goal-b49 S3 席产物,主席复量收口) (e423b7123f)
- 🚀 Feature/Improvement:复现 Qoder 的随包资源装机策略与解压炸弹上限(rea goal-b49 S1 席产物,主席复量收口) (b06842c4a9)
- 🐞 Fix:RP-5 读数更新至 95,722B（达标但第三项未做，保持开着） (7fbca8d6e9)
- 🚀 Feature/Improvement:复现 Qoder 的插件贡献词表,并把权限接成数据类默认拒(rea goal-b49 S2 席产物,主席复量收口) (15f1acea0c)
- 🐞 Fix:growth WEB 域解析修复——accept_status 归一化 + 终态判定 (13130b3270)
- 🐞 Fix:摘 RP-5 未展开模板占位、补正 RP-7 标题形态，侧车键随形重写 (c384c8fa3f)
- 🔧 Chore/Other:H20 ② 加发送期门控,首帧不再与发送期响应解析抢窗口 (0a3692eca0)
- 🔧 Chore/Other:G667 夹具补 app/core/config.py,被检面成立(J4 不再 exit 2) (a9c1e26d5b)
- 🐞 Fix:保留 NavBar 并登记为 fs 读取判据靶子(回退误删) (17b8e280bf)
- 🔧 Chore/Other:删除零消费者死副本 packages/app NavBar.tsx (cfa1b246aa)
- 🐞 Fix:smoke 去掉重复注入的 --passWithNoTests (f68298076e)
- 🐞 Fix:重新生成 OpenAPI 产物,补齐漏登记的路由契约 (fcf1e460e1)
- 📚 Docs:goal-b49 第三回合六枚入账(C1/C2 席报入档 + §7 落地表) (e557c22648)
- 🚀 Feature/Improvement:复现对侧的工具面惰性装载(具名预算表决定本轮 schema 可见集;rea goal-b49 W1-⑤,C1 席产物主席收口) (7c2faba74c)
- 🚀 Feature/Improvement:复现 WorkBuddy 的启动画像与预热命中读数(rea goal-b49 W1-⑪,C2 席产物主席收口) (49061736f9)
- 🐞 Fix:行级归因 useMemo 的版本号依赖改为真正参与快照取值 (b9ad643161)
- 🚀 Feature/Improvement:复现 Qoder 的本地服务发现(带心跳的认领件)并补代次交叉核验(rea goal-b49 Q1 #6/#12) (5504153385)
- 🐞 Fix:复活闸的取材面收口到"本枚声明面" —— 别席暂存的复活件不再连坐中止跨端自动写回 (c910707bdc)
- 📚 Docs:goal-b49 二三回合入账(诊断报告 / 网络出口 / delete 轴 / Trae 面复取) (68cee669f7)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (52559effd6)
- 🚀 Feature/Improvement:复现对侧的子进程网络出口管控(DNS/域名裁决那一半引擎;rea goal-b49 B6) (923546ffec)
- 🔧 Chore/Other:字号/间距默认档落档重做到 origin/main 新基线 940 处(旧 954 − 上游删除 14) (1bcdbbaf0e)
- 🚀 Feature/Improvement:复现并超越对侧的自包含诊断报告(KPI + 阶段瀑布 + findings;rea goal-b49 B5 收口) (68d68a2cc4)
- 🐞 Fix:拦路者不能只报 unidentified —— 补 safe-commit 三类整轮拒的认名 + 可归因摘要(身份仍用稳定类别) (8552e9e6a8)
- 🐞 Fix:文件访问裁决真正分维(补 delete 轴 + 修一处装了没接线) (14e02e57f5)
- 🐞 Fix:LoginPopUp 裸 TextInput 补聚焦处理 + mobile-rn 考勤七键回填 (1a1e083456)
- 🐞 Fix:收编 95 份 RN 非色档落档产出进 HEAD —— 字号轴 261 处 token 化,钩子链被无关红扣着时按 §12 第三条出路走 (64f5094441)
- 🐞 Fix:登录弹窗两枚裸 TextInput 收到共享 TextField (7dee099dc5)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (678fead5ac)
- 🐞 Fix:收编结论行不再把"被门拦死"报成"收了 N 枚" —— collected 只认真入库,被拦单列 blocked 并点名拦路者到人 (533986198c)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (9657db18ef)
- 🔧 Chore/Other:合面带入的 7 个新文件补溯源水印(门 47p push scope) (9c0a4d58c6)
- 🐞 Fix:把 RN 字号落档腿真装上 —— 器物有三条子腿而守护与级联都只传 --apply(字号轴结构上永不跟随) (e8d4a5dc60)
- 🔧 Chore/Other:合面新增 7 个文件后按生成器重算数字块 19088→19095 (781338f8ac)
- 🚀 Feature/Improvement:内容级防丢闸,合面前后按键集差集与活文档行级包含判红 (45feebfac7)
- 🚀 Feature/Improvement:给 web↔RN 改判开出具名通道(证据字段透传 + 显式让位)—— pending 队列此前结构上判不完 (530a6dc9f2)
- 📚 Docs:goal-b49 四张执行席报告入档 + 残余表按一格一行当前状态收口 (244862bacb)
- 🐞 Fix:桌面 git 候选表不再探测竞品安装目录(rea goal-b49 主席件) (420e3c3c7a)
- 🐞 Fix:分享页去掉 CDN 外链,自写零依赖 markdown 渲染器(rea goal-b49 B3) (2beafada17)
- 📚 Docs:重跑数字生成器,跟踪文件数 19098/19099→19088(与实测 19088 对齐) (03fd7a60de)
- 🚀 Feature/Improvement:复现 WorkBuddy 的技能目录缓存并修掉它的静默错位(rea goal-b49 B4) (79597fd9fc)
- 🚀 Feature/Improvement:倒退看门狗补 web↔RN 功能面两只队列维 —— pending 与 judgedGap 变长必须当场出声 (e37f42a83c)
- 🚀 Feature/Improvement:复现 WorkBuddy 的删除保护链(回收站 + 批量两阶段护栏,rea goal-b49 B1) (cf1e7f9efe)
- 🐞 Fix:门 298 由逐字单档扩成三档判据 + 一档疑退报数 (b5c858506f)
- 🐞 Fix:门 298 由逐字单档扩成三档判据 + 一档疑退报数 (116b779677)
- 📚 Docs:auto-triage 自动登记(api-logs;第 1 期感知层产线动作,O65) (d49a1c57ab)
- 📚 Docs:门号统一 285→288(代码侧残留引用) (4aad99de3a)
- 🔧 Chore/Other:给"倒退看门狗"装上存续锁与坏例归因 —— 自检坏了要当场响,且一行就能定位是哪一维没判 (0ca3cc6ae0)
- 🚀 Feature/Improvement:迁移链双向对账尺装车(rea goal-b49 B2)+ 档案就地更正一条假活账 (e38aad1c2c)
- 🐞 Fix:props 类型解析不到时落 undetermined,不再冒充零 props (e3c28228fe)
- 🐞 Fix:按 ls-remote 现读判定 behind/分叉并红 (f08a6a9f34)
- 🐞 Fix:前向修复两枚 HEAD 面水印欠账 —— AGENTS_trim-2026-11-05 归档件零宽链被压缩枚截断、workbuddy_behaviors.py payload 缺失/损坏;走官方 clean→inject 重封，verify 载荷可解码且等于 WATERMARK_TEXT(47p 自愈式对 HEAD 面欠账不生效,仅前向修复枚能销) (8e81f23d18)
- 🔧 Chore/Other:去掉 8end 触发面里重复的一整块 paths(我上一枚自己引入的) (6f3942f5b3)
- 🐞 Fix:补 workbuddy_behaviors.py 的可见横幅与载荷 —— "NOT ICE" 一个空格让 main 的 preflight 一直红 (d53514d19a)
- 🐞 Fix:清零 main 面残留红——门99 别名、跨端接线锁与 props-parity 批对齐 (ef88ca4138)
- 🐞 Fix:修好跨端「倒退看门狗」的取证面 —— 自检从 19/24 坏例回到 24/24,并把词包缺口的出路从人工指到自动腿 (bf375dc831)
- 📚 Docs:压缩 AGENTS.md 至 95,722 字节(门 207) (1a55955234)
- 📚 Docs:APK 站点腿头注按 11-04 现读纠偏,速率取证交回选腿实现单源 (df378909ca)
- 📚 Docs:rea goal-b49 三席取证档案成册(WorkBuddy 主进程与外围 + Qoder CN 主程序 bundle) (4fe208a71c)
- 🔧 Chore/Other:基线收紧 files 30 → 17(CI 实测值)+ total 3623 → 3610 (cf553af1d7)
- 🐞 Fix:固定 structlog processor 链实例,修 xdist 下 capture_logs 偶发 0 事件 (a5e90b54dc)
- 🚀 Feature/Improvement:复现并超越 WorkBuddy 的按操作分维文件访问裁决(rea goal-b49 首件落地) (e2d819a0a4)
- 🐞 Fix:词包搬运腿补嵌套命名空间射程,并把「刚写完等收编」从 unresolvable 里分出来 (3ddb1ad87d)
- 🚀 Feature/Improvement:任务中心 growth 族补全——行为规划层 + WEB 域并域 (43b0513d7b)
- 🔧 Chore/Other:收尾批后重钉派生 ui-routes 自述(sourceCommit→659b merge 树,inputsSha256 随 docs/message 层落档刷新;生成器产出原样落,无手改) (2bdda19079)
- 🐞 Fix:收尾批 —— chip 角色档纠偏(toggleChip lg->md) + NavBar 测试去 emoji(icon '★'->'藏',评分星族豁免不动) + land-web docs 20 件 tier 收口 + RN Carousel/NavBar 同族落档;miniapp 消息包 5 件不落(其旧 leg 把远端 5a5ff9d25 清掉的死键加回,落地器行级复活判据正确拦截,词包回归 HEAD 形态;message-pack leg 与死键清理的适配归该腿持有人侧,已记本枚信息) (bae518ad7d)
- 📚 Docs:APK 站点腿头注按 11-04 现读纠偏,速率取证交回选腿实现单源 (3a8e195c59)
- 📚 Docs:auto-triage 自动登记(api-logs;第 1 期感知层产线动作,O65) (6e6ea6f5c8)
- 📚 Docs:auto-triage 自动登记(api-logs;第 1 期感知层产线动作,O65) (ee6a067b73)
- 🐞 Fix:清掉 18 件真死代码 —— 棘轮首次在"完整尺子"上读到真数字,47 → 29(基线 30) (d3e791396e)

**2026-11-04**
- 📚 Docs:补点 check-mobile-download-leg-cn 与 check-staged-resurrection —— 门 89 R4 义务 (2837d62091)
- 🐞 Fix:门 99 收绿 —— 摘除 4 件已删文件的存续引用 (d0c22b8a28)
- 🐞 Fix:修平 main required check 的构建/静态/用例红灯 (2b058d2ecf)
- 🐞 Fix:恢复 zh-CN 词包的 2 空格版式(上一提交误落了压缩单行版) (b2a9aa9d33)
- 🐞 Fix:门 105 G-816040 派生腿 stale 收绿 —— ui-routes.generated.ts 按 HEAD 面重生成 (3de07f7f0f)
- 🐞 Fix:门 285 取材面接回 face-reader —— 内容读取统一走 readWorktreeFile，消除门 118 的 loose-fs 真红 (3e6e66a7d7)
- 🐞 Fix:补回被 union 合并逐行放过的 43 枚教育考勤键与 10 枚 apk* 独占键 (489724eb45)
- 🐞 Fix:第 6 处配置加载失败归零 —— mobile-rn 的 tailwind 面前置建 design-tokens(dist 是构建产物) (a1c10de335)
- 📚 Docs:为 check-staged-resurrection 与 check-mobile-download-leg-cn 补 R4 点名(不删接线、不改判据) (2619fc1991)
- 📚 Docs:活性区数字对齐 gen-doc-numbers 现算值(44 处)+ 刷新生成块 (48d5e1ec33)
- 🐞 Fix:补齐尺子(5 处配置加载失败归零 + 棘轮先判加载面)并清掉 3 件真死代码 —— files 34→30、dependencies 29→28 (7c2cc41a52)
- 📚 Docs:为 check-staged-downgrade 分配独立门号并正式登记，解除 292 撞号 (db06025f2e)
- 🐞 Fix:为 check-staged-downgrade 分配独立门号并正式登记，解除 292 撞号 (e396b6b1e9)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (15f0dc1bd1)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (3b63db24b3)
- 🔧 Chore/Other:拆掉三处配置假债并清掉 10 件真死代码 —— files 907→33 (102d5efa29)
- 🔧 Chore/Other:合并 origin/main 后重生成 miniapp 离线包并刷新自述钉 (dfcd6fb6ca)
- 🐞 Fix:清理 miniapp-taro 83 枚死键,同步五语言包与离线包产物 (5aa0ff9d25)
- 🐞 Fix:国内腿兼容 Gitee 200 整包探针(无 Range 也能选腿) (c3b496632d)
- 🐞 Fix:补全前端读点识别面并把「有声明无读取」判红 (dcd2fa7989)
- 🐞 Fix:修回收腿空转、RP-74 覆盖面与点名器 multiSlot 分流 (83f4f33fd5)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (805649666b)
- 🐞 Fix:补齐 apps/mobile-rn 的 expo-intent-launcher 记账(门101) (b77a439ebd)
- 🐞 Fix:AGENTS 三批追加超了注入预算 —— 压成结论式要点,细节外置 (05b14471ce)
- 🐞 Fix:技能安装 manifest 门改由扩展 schema 校验器接管 (fe88a87804)
- 🐞 Fix:复活闸补到 pre-commit 侧,闭合不走 safe-commit 的提交路径 (6b849b5db6)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (08d41693f6)
- 🐞 Fix:圆角角色档 5 族纠偏 + 主题透线 12 处测试渲染点接线 + lock 补 expo-intent-launcher 记账 - AiSkillDetailScreen(3 处 control md->sm)、BannerCarousel(指示点 tiny sm->xs)、AiCareerScreen(chip lg->md)、edu-my-attendance 输入框 control lg->sm、CheckInQrPanel popover lg->md - 6 个共享屏测试渲染点显式传 colorScheme(守门 theme-prop-wiring 禁字面量与漏传同红) - pnpm-lock.yaml: 远端移动 apps/mobile-rn 声明 expo-intent-launcher ~57.0.1 后漏跑全量 install,门 101 判缺记账;本次 install 重新记账并同 commit(违规 1->0) - 验证: radius-role-conformance/theme-prop-wiring worktree 面 0 红, packages/app 六套件 17 用例全绿, app/miniapp/web typecheck 全绿, 门 101 worktree 面绿 (21baead925)
- 🔧 Chore/Other:补测试文件溯源水印 (d8d11d4b6e)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (0cdb9c5adc)
- 🚀 Feature/Improvement:8 条 blocked 升级为机读侧车 + 报告器 join 增列 (dec7e8c4bc)
- 🐞 Fix:补齐两处「静默覆盖他人工作面」的 P0 —— heal 第四层缺通知书闸 + safe-commit 全局 reset (4e6cb8d333)
- 🔧 Chore/Other:国内腿资产运行态门 + 一键补资产入口(fail-closed) (c43867117a)
- 🐞 Fix:国内腿 5 文件回归仓库排版 + 修掉体积下限一致性锁的乘式误捕 (b9679025a0)
- 📚 Docs:更正注释与实现不符 —— 本器只 update-ref,不动 index (e06e5b68ab)
- 🐞 Fix:补齐两处「静默覆盖他人工作面」的 P0 —— heal 第四层缺通知书闸 + safe-commit 全局 reset (1cb1464efc)
- 🚀 Feature/Improvement:隐私设置新增 RUM 开关文案（5 语言） (e1fd1f1345)
- 🚀 Feature/Improvement:补客户端 RUM 轻量可观测（默认关闭、脱敏、有界上报） (03309b6716)
- 🚀 Feature/Improvement:命令风险对接 AST 判定(批量删除按语法节点取事实) + README 审批引擎说明 (fac6c20156)
- 🐞 Fix:补齐 apps/mobile-rn 已声明的 expo-intent-launcher 锁记账(origin/main 存量红,拦所有提交) (ef854886c7)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (cd5826f592)
- 🚀 Feature/Improvement:APK 下载按实测选腿 + 补齐 Gitee 国内腿发布出口 (68321b1f3e)
- 🐞 Fix:extension 端包不再用标量遮蔽 shared 的 chat.terminal 对象 —— 三枚取词此前上屏为裸键名 (af9c8a3588)
- 🐞 Fix:cli /tasks 的 11 枚取词补齐五语言 —— 终端此前直接打印裸键名 (0fe1de367e)
- 🐞 Fix:门285 读数确定性修复+三条映射入账 —— 面重放,证据行按 1bc6ec5167 现读重锚 (1b3dba2d2c)
- 🔧 Chore/Other:跨端自动化链自愈:web 落档守护从永久空转改为可证零变化收敛 (62de462f80)
- 🚀 Feature/Improvement:add skill package install security chain and expert pack generator (2ea7a04cc7)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (3bd970724d)
- 🐞 Fix:补齐 streamingRecognizer.configure 别名,修复与 VoiceInput 调用面的 TS2339 (5e45521700)
- 🐞 Fix:恢复下载详情页被误删的三个展示组件,修复主干编译中断 (60e311a376)
- 🚀 Feature/Improvement:规则级决策引擎 + 自动复核 + 授权记忆,接入 computer-use 应用白名单 (b3053ad3de)
- 🐞 Fix:应用内 APK 更新落地到现 TIP(含漏件补齐) (b973862f5a)
- 🐞 Fix:删除 wt-close 树中 VoiceInput showClear 空声明（仅作接口对齐保留的死键） (218c27961c)
- 🚀 Feature/Improvement:编辑器行级归因开关文案(5 语言) (adaa6e62bd)
- 🐞 Fix:门291 C组32条挂账清零,RN改取web真源键并摘除旧键 (09aab027db)
- 🐞 Fix:门 285 证据定位改为按符号名解析，消除加注释即报证据行漂移的误红 (55cfe0055f)
- 🚀 Feature/Improvement:行级归因 — diff 驱动的 AI/人工三态归属 (8331e5460a)
- 🚀 Feature/Improvement:桌面端安装前逐文件 sha256 校验(清单缺失即拒绝更新) (a9aade3944)
- 🚀 Feature/Improvement:命令风险判定从正则升级为 AST 语义判定 (0107bd99c1)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (e8587b8d24)
- 🔧 Chore/Other:收敛 CreateAgentTeamInput 导出面以过 knip 棘轮 (fad21cedd7)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (3f53cd4128)
- 🐞 Fix:分片腿加首片看门狗,任何失败都退回原生单流 (8dbc29d49e)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (59190b65a4)
- 🚀 Feature/Improvement:新增多 Agent 协作团队实体/持久收件箱/产物转交 (1927ea802b)
- 🐞 Fix:根治「有意删除的 tracked 文件被自愈器自动复活」 (54feeb4011)
- 🚀 Feature/Improvement:声明式扩展 manifest 接入 capability-catalog + 技能按模型能力分档 (3cae335153)
- 🚀 Feature/Improvement:更新包逐文件 sha256 自校验 + 按工作区本地索引开关(默认 off) (7a30a3c6ae)
- 🐞 Fix:B 组收尾补漏（showClear 两端删除、mini robotImage 真渲染） (1b02399947)
- 🐞 Fix:平台裁决清零(46→0),A组18条真实现/删除,门128两红收口;补 pnpm-lock 记账(解门101 存量红) (e281cc9b3e)
- 🐞 Fix:整包下载改 8 连接分片 + 诚实的速率读数 (e4c0b285e7)
- 📚 Docs:跟随 origin/main 重算路由文件/跟踪文件行 (84b10968d8)
- 📚 Docs:README/README.en 散文声明跟随生成块重算 (2e5a32da0f)
- 📚 Docs:README 生成数字块按门173现算值重算 (db6e54d589)
- 🚀 Feature/Improvement:级联链补到 24 段(功能维三把尺 + spec 派生)并修自检判序 (a83883a019)
- 🔧 Chore/Other:清掉 24 件零运行时 import 的孤儿副本并重生成 ui-routes 产物 (9936c8b41e)
- 🐞 Fix:死键扫描器改调用点惰性加载 typescript,修 8-End Cert 零依赖 job 的 ERR_MODULE_NOT_FOUND (e594323b43)
- 🔧 Chore/Other:未接线收尾 — 删除零消费/迁移残留 61 件，接线 11 处 (105a55a40c)
- ♻️ Refactor:拆分 C1 超限文件(edu-ai-management 与 cross-end-ui-parity),零行为变更 (1e2ef9bdb4)
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
- 🐞 Fix:attention 镜像在读不到现值时按变化照写(镜像是派生,宁可重写不漏写),恢复 F3 ⑤ 的落库同步 (de8cdb375d)
- 🔧 Chore/Other:按仓库 format 口径重排 AiCareer/KnowledgeBase 两文件(消 lint 的 prettier 报警) (76b15448be)
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
- 🔧 Chore/Other:补全出码屏 token mock 的 brandAccent.deep(mount 期 TypeError 的根因),不放宽任何断言 (98bd32b630)
- 🐞 Fix:push-sync 四类折绿分支收口 —— 窗口只降文案不降退出码,祖先/HEAD/清单读数失败一律 exit 2 (344c5dd91c)
- 🐞 Fix:底部淡出遮罩延伸到屏幕底 —— 胶囊下方那段悬浮间距此前无人覆盖 (cbce78a947)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (344909256f)
- 🐞 Fix:首页 AI 输入框不再被底部淡出遮罩压住 —— 补小程序已有的那一层 (ba3cec2095)
- 🐞 Fix:校正 push-sync 注释的 rev-list 失败实测读数(本机 bad object exit 1,非 128) (714fda7cf5)
- 🔧 Chore/Other:收编守护落档产出(5 件,凭落点账本) (b255c8ac82)
- 🐞 Fix:选中态复选框补配对前景 key checkBoxOnText(§4 底字同档),清守门 63 末处 (8cfc99b83a)
- 🐞 Fix:push-sync 读数改三态 —— rev-list 失败/取不到对象不再折算成 ahead=0 假绿,5 例钉三态 (9c0824df44)
- ♻️ Refactor:选中态胶囊文字样式改名为 classChipOnText,与 classChipOn 成 R4 兄弟配对(§4 底字同档) (167797c150)
- 🐞 Fix:两处 git 派生补 windowsHide —— 门52 生产面两处判红清零,消除控制台闪窗;staged 面 3 文件 0 违规 (5321db0ce9)
- 🐞 Fix:收口 63 品牌底/前景配对六处 + 77 悬空导入改默认导入解构 (8f671d1061)
- 🐞 Fix:git 派生调用显式接管 stdio —— 门193 三处判红清零(两枚测试文件),解除 pre-push 阻塞;两测试 14/14 通过 (b135c1b1df)
- 🐞 Fix:写盘闸 HEAD 三态 —— git 取不到不再折成「新增文件」放行 (12d92ce084)
- 🐞 Fix:收口 143 道受影响门揭出的三处真红(48 补 windowsHide / 156 圆角角色五处落档 / 161 盲写改按键比较出口形态) (15e9baf8ea)

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
- 🚀 Feature/Improvement:小程序词包整块缺口首次有器物并挂上自动链 (3c19ced5cd)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (57c6228ab4)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (8548571866)
- 🐞 Fix:SectionHeader 两端同源收口 —— 小程序适配层真接 leading/style/titleStyle/subtitleStyle/accessibilityLabel(容器与文字样式覆盖、ariaLabel 落地),非空 prop;门285 270→265,该对归零;intentional-delete: 该对五键已由实现消除 (b80032e3b9)
- 🐞 Fix:IntelligentAssistant 两端同源收口 —— RN 补 isLoggedIn(登录态文案+隐藏充值,默认 true 零观感变化)与 5 语 loginRequired,tokenQuantity↔tokenBalance 入映射表;门285 273→270;intentional-delete: 该对 tokenQuantity/tokenBalance/isLoggedIn 三键已由映射+实现消除 (9436bdf042)

**2026-11-04**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (5574b04e56)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (e6374f6e0c)
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

### Academic admin and attendance in the education vertical (added 2026-11-03 — thresholds, absence back-fill, approval coupling)

Per-class cut-offs for lateness, early leave and absence live in `edu_attendance_rule` (three `HH:MM` thresholds plus the QR signing secret, editable in the web academic console). A scheduled job (`edu-attendance-absent-daily`) back-fills an `absent` row for every enrolled student who has not checked in once the absence threshold passes, so attendance rate is no longer divided by checked-in students only. Approving a leave request writes the matching `leave` rows idempotently in the same transaction. Whole-class batch check-in confirms the affected set against the database (`created · skipped · missedIds`), and attendance exports to CSV. Check-in comes in three modes — `manual`(teacher proxy), `self`(student self-service) and `qrcode`(HMAC-signed QR with a 60-second TTL, rendered on web and RN, scanned on RN and the mini-program). Students get their own attendance page on all three ends through `GET /attendance/me`, which trusts only the authenticated session and resolves ownership server-side; the parent portal reads attendance behind per-endpoint authentication. Face check-in was ruled out instead of stubbed: it would require a third-party face library, liveness detection and consent handling.

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
