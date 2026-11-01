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

Headline claims (same source as the table below, all live-computed): **617 tables · 4656 API routes ·
25 WebSocket endpoints · 100 catalogued LLMs · 38 platforms auto-publishing · 3782 test files ·
303 engineering gates · 51 CI workflows · 5-language i18n parity · 9 app packages · 16 shared packages ·
14 compose services**.

<!-- BEGIN GENERATED NUMBERS (node scripts/gen-doc-numbers.mjs --markdown) -->
| 指标 | 现值 | 取数键 |
| ---- | ---- | ------ |
| 数据库表 | 618 | `dbTables` |
| schema 文件 | 240 | `dbSchemaFiles` |
| API 路由 | 4670 | `apiRoutes` |
| 路由文件 | 658 | `apiRouteFiles` |
| AI 服务路由 | 628 | `aiServiceRoutes` |
| WebSocket 端点 | 25 | `wsEndpoints` |
| 入库模型清单 | 100 | `llmModels` |
| 发布平台 | 38 | `publishPlatforms` |
| 端应用包 | 9 | `appPackages` |
| 共享包 | 16 | `sharedPackages` |
| CLI 命令文件 | 69 | `cliCommandFiles` |
| CLI 工具文件 | 72 | `cliToolFiles` |
| 语言 | 5 | `i18nLanguages` |
| i18n 作用域 | 7 | `i18nScopes` |
| 语言包 JSON | 35 | `i18nMessageFiles` |
| 测试文件 | 3905 | `testFiles` |
| CI 工作流 | 49 | `ciWorkflows` |
| Compose 服务 | 14 | `composeServices` |
| 工程守门 | 312 | `guardianGates` |
| — blocking | 284 | `guardianBlocking` |
| — warn | 30 | `guardianWarn` |
| 跟踪文件 | 18633 | `trackedFiles` |

上表由 `node scripts/gen-doc-numbers.mjs --markdown` 生成,最后核对日期 2026-11-01。
每个数的来源就写在取数键旁边的实现里(`scripts/gen-doc-numbers.mjs` 的 `SOURCES`),**不得手抄、不得另立第二份**。

<!-- END GENERATED NUMBERS -->
<!-- END GENERATED NUMBERS -->


## Recent updates (auto-maintained)

<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->
**2026-11-01**
- 🚀 Feature/Improvement:消息中心数据钩子补齐——小程序向 RN 对齐真实动作链,fidelity 缺键 17→0 (c970ac616c)
- 📚 Docs:同号多行去重 —— Z-1 4→1 / RP-79 2→1 / RP-47 2→1 (55f010724f)
- 🐞 Fix:rn-compat 垫片 props 契约对齐 RN 0.86 —— 小程序宿主 tsc 61 条型错归零 (3b541f58dd)
- 🐞 Fix:考试判分与题型词表收成单源,并补齐四处端间缺口 (74e79a8fce)
- 🚀 Feature/Improvement:补登跨端对齐残留产物与镜像资源 (d76f63cde9)
- 🚀 Feature/Improvement:dir_rhash 接进索引增量链 + T12 缺口表闭环补记(缺口表 #1 全程收口) (37dfaf9dd3)
- 🐞 Fix:把登录"等代价"外壳拆出 password-crypto —— 修掉我自己上一批留下的整片替换式 mock 雷 (377115d10e)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (92a9ec433a)
- 📚 Docs:auto-triage 自动登记(api-logs;第 1 期感知层产线动作,O65) (6cbb66b189)
- 📚 Docs:压缩守门速查节冗余重复登记、修复失真读数,使体积回到门207预算内 (d3c9ef1f14)

**2026-11-01**
- 🚀 Feature/Improvement:跨端对齐一键级联编排器 pnpm sync:cross-end(web→RN→小程序 按依赖序一发跑完) (08db578671)
- 📚 Docs:登记「灰度槽位从未拿到产物」这一型 —— 20/20 轮未判定被折成放量完成 (87f89d0a95)
- 📚 Docs:把明文例外域名清单登记进声明面 —— 强度只住在本地 .env 就会在一次整体替换时消失 (9c194f3c00)
- 🐞 Fix:门 273 遮罩识别补三格 —— 遮罩不再被计成缺按压反馈(HEAD 面 h2 3→0) (759ca70c1e)
- 🐞 Fix:开发者绑定一族五格补属主过滤 —— user_id 住在表里,这一族本就可以收 (ce0ae6c9a1)
- ♻️ Refactor:评论管理面的特权判定收归单源 —— 摘掉本仓最后一枚自带 ADMIN_ROLE_ID 常量 (1f7b651270)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (ce9af1cfd6)
- 🐞 Fix:迁移容器不再以 root 运行 —— 它全程只握着 DATABASE_URL 这一枚生产凭据 (6d9dd26e57)
- 🐞 Fix:提现审核的审计主体改从令牌主体取 —— reviewer 不再住请求体 (2e16754244)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (f23f5fb6df)
- 🐞 Fix:五个镜像页取词/功能面与共享屏齐平 —— 镜像保真缺口 17 → 0 (b4794da004)
- 🐞 Fix:个人号池反向同步端的内部凭据比较改走 secretsEqual 单源 (5f0bea107c)
- 🔧 Chore/Other:根护栏清单按 HEAD 面重封 —— 解开部署环的 fail-closed (e454818278)
- 🐞 Fix:两格裸 httpx 取远端可控 URL 补 SSRF 逐跳复检(入口一次 + 每跳一次) (b3099dee1c)
- 🐞 Fix:CI 安装步逐字钉版 + 门 48 新增规则 C 把这件事变成机器闸 (630198fe57)
- 🔧 Chore/Other:ruff 全量归零(41 机械项 + 3 手工)—— CI 的 Ruff job 直接原因 (2665af9c69)
- 🐞 Fix:收口 9095「今日已签」语义 + 第四条回灌腿(minimax)归属缺陷 (e561910994)
- 🐞 Fix:补 @rn-shells/DeveloperScreen 类型声明 —— 修壳化落地后的 tsc 红臂 (9da200af08)
- 🐞 Fix:rules 面五格裸端点补端点级身份 + /api/rules 进"配置重开不了"的地板名单 (70955c9eb5)
- 🔧 Chore/Other:补 test_codebase_indexer_ignore_channels.py 溯源水印 (7995b0f539)
- 🐞 Fix:一键登录的明文流量从"整 App 授权"改成"按域名开、默认关死" (0ae5f24bec)
- 🐞 Fix:红项按文件归因改走 TAP location，根治 junit file= 在本机恒空转 (1421e386b8)
- 🐞 Fix:补上 torpx 夹具里那处未接管 stdio 的 git 派生 —— 门 193 现读点名的一处裸奔 (1d7a026b66)
- 🚀 Feature/Improvement:目录级递归前像 dir_rhash —— 缺口表 #1 落地(超越 qoder/trae mtree 设计) (1f4956f07b)
- 🐞 Fix:补齐小程序 compat 层的四类类型缺口 —— 跨端共享包在小程序宿主下少红 17 条 (f2ac8cf1b5)
- 🐞 Fix:两处"外部串直接当路径用"收口 —— 规则删除的任意 .md 删除、git 面的跨目录只读泄露 (2f2511c4f3)
- 🐞 Fix:上下文/记忆族的归属只认令牌主体,客服工单 admin 面自带本地闸 (abc0baa402)
- 🚀 Feature/Improvement:号池隔离盲区监测器收口 D1-D6 + 守护 sweepPoolIsolation 接线 (2026-11-01) (115028214b)
- 🐞 Fix:回跳落点必须交出一份第一方落点集 —— 新增门 278 并把 OIDC 自动回跳收到同源 (85ca07c5a9)
- 🐞 Fix:torpx 镜像件派生 git 未接管 stdio —— 门 193 唯一红点 (a7039c0c1a)
- 🚀 Feature/Improvement:工具面能力门 + 索引剪枝回执(缺口表 #7 落地) (4b4fb09283)
- 🐞 Fix:根护栏清单按已入库的门 48 规则 B 重封 —— root-guard 不再 fail-closed 挡部署 (674da0c573)
- 📚 Docs:复摘 P84/P85/P86 三条僵尸行 —— 结清提交被整份取对侧的合并抹掉后又被回捞腿带回 (b5f0bd106c)
- 🐞 Fix:qoder/workbuddy 回灌同型收口 —— 目标行改唯一行并按主键写,本机号落个人池时不再另建运营池行 / 不再恒"池内没有该 uid" (43e9e4a3c3)
- 🐞 Fix:悬空导入门两处假阳收紧 + 清掉 seed 里指向未实现特性的三处悬空引用 (d92645f737)
- 📚 Docs:结清 P84/P85 —— ai-service 索引 ignore 判据与改名检测已入库 (e91e4492eb)
- 🐞 Fix:Toolbar 浮动余量判据改按设计令牌解析 —— 代码按规范写了,判据却"失明" (253c6e8ca8)
- 🚀 Feature/Improvement:索引面接 ignore 判据 + 代码检索改名检测(票 P84/P85) (789a23b8e0)
- 🐞 Fix:object-space-merge-cap 的派生口补 windowsHide 默认值 —— 门 52(blocking,stagedTriggers **/*)不再全仓逼人跳门 (40f4a89a70)
- 🐞 Fix:Trae 回灌按唯一目标行并精确到主键 —— 本机号已被个人池持有时不再另建运营池重复行 (4e72e8bf14)
- 📚 Docs:结清 O62819(门 128 几何维 CSS 变量解值 + torpx 夹具按新 HEAD 重订) (b2b6ee5909)
- 🐞 Fix:钉 @vitejs/plugin-react 到 4.x + Dockerfile 补 COPY ui-native —— e2e/ci.yml/Build Docker 三条真红同批收口 (c67e18d095)
- 🔧 Chore/Other:门 128 的 torpx 镜像件 C2 改吃生产面取证(夹具不得比门瞎) (9434c8a932)
- 🐞 Fix:4 处 pressFeedback 迁到 Tappable —— 补完 RN 0.86 迁移尾巴,typecheck 归零 (230b6d63dc)
- 📚 Docs:结清 O62819 / O67 / P86 —— 门128 工具类模型与门84 混合陈旧底稿拦闸已入库 (b673b33bef)
- 🐞 Fix:三处登录端点对"账号不存在"付出等代价口令校验 —— 堵掉耗时面的账号枚举 (b5aaf7e5bc)
- 🚀 Feature/Improvement:web/小程序腿接可解析工具类模型 + 几何维重锚(票 O62819/O67) (ca00ed0f39)
- 🐞 Fix:内部服务鉴权的老门加使用留痕 —— 关它需要证据,而它今天是静默的 (fe7f193699)
- 📚 Docs:补第廿一条欠账 —— 同仓索引租约、快照自证六档、检索金标双命名空间打分写进能力面 (484c798d84)
- 🐞 Fix:门7 依赖碎片化改差值口径 + 修好从 10-26 起长期烂着的镜像夹具 (aa460475d0)
- 🐞 Fix:转壳判据补上 useEffect 承载标题那一形,标题节律同批保住 (cdb29d00b5)
- 🔧 Chore/Other:补摘 2 处冗余默认导出(AboutScreen / ClientOnly)—— knip duplicates 维收口 (6ab2605046)
- 🐞 Fix:两枚镜像的构建期供应链全部钉版 —— 可变 tag、未钉版安装与 `curl | bash` 清零 (c042ae8041)
- 🐞 Fix:派生自愈腿 i18n 一族只交变化集给落地器, 4 份"盘==HEAD"的 CDN 载荷曾把真变的 3 份堵在后面 (5ff60c00c4)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (3ec38ed5ea)
- 🐞 Fix:生产 next build 通过 —— 类型增强显式进 web 程序 + 删死引用 + 补 transpilePackages (98ce4e6d43)
- 📚 Docs:认领 O62819(torpx 夹具按新 HEAD 重订)—— 镜像件现读 3 条红(C2/C3/C8),成因已量清:夹具的档表面比门的生产面窄(只喂 spacing,未并 cssTierPxFrom),而旧反例载体 ScreenStates 的 400rpx 已被落档批改成 var(--spacing-3xl) ⇒ 按 HEAD 硬钉的 [15,200] 与「onlyRn=0」双双腐烂。本轮把取证面改成与门同形、并把「反例不得变绿」这一腿换成行为推导而非字面数字。 (394c9b1a34)
- 🐞 Fix:再摘 499+11 枚死键(回补提交把它们搬回来了)—— 五端实测归零 (ea9c9e6624)
- 🚀 Feature/Improvement:补「混合陈旧底稿」行级拦闸(票 P86) (8aa1a3ddfa)
- 🐞 Fix:全仓归一 react-native 到单份 0.86.2 —— 修好 next build 类型面最后一处红(部署阻断真因) (e4beec16d3)
- 🐞 Fix:兜底鉴权闸缺省档随运行时武装,并停止抢在内部凭据之前判死(实测线上第一方回调被 401) (bc15c99664)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (eb846d39cb)
- 🚀 Feature/Improvement:id_native 轨首次可判 —— 同 id 索引(bench/score_id_native.py)(逆向复现超越 goal-b47) —— runner 头注早就写着「哪天仓内真落了同 id 的索引,这一轨自动点亮(判据现算)」,本件就是那把索引:检索宇宙换成本仓 ParentChildChunker 现算的父块、id 用它自带的十六位 chunk_id,不改判据、不做位置配对、不抄 id 表。现读:金标二十八枚 distinct id 复现二十七枚(未复现那枚是随正文变过的陈旧 id,题目与原因逐条点名),二百六十四题里判定二百六十三、判不了的每条带原因名;MRR 零点八一二、hit@5 零点九四三、nDCG@5 零点八四二。指标一律 import retrieval_eval,本件不自带第二份公式(有用例按源码锁这一条)。全程零连库零网络 (7a35b76a1a)
- 🚀 Feature/Improvement:门 131 补 F3「函数先起名再当 style 传」一档, F1 的内联正则对这一型全盲 (72e36cc58e)
- 🐞 Fix:提交面回退巡检的日志判语跟着臂次走 —— partial 型不再被念成"与祖先逐字同形" (8504f90ce0)
- 📚 Docs:结清 O22819 —— 侧车改判出口已具备声明式契约 (6e5044df0f)
- 🚀 Feature/Improvement:侧车归属改判出口补齐三处契约缺口(票 O22819) (4be834eeeb)
- 🐞 Fix:自动化配置缓存与调度任务镜像补封顶(只写不读那型再消两格) (09e1678f43)
- 🚀 Feature/Improvement:run-script-tests 补上「红项 → 文件」归因 —— 252 枚红从此有靶子可打 (3f656a28ea)
- 📚 Docs:登记提交链缺口「混合陈旧底稿绕过门 84 R1」—— 本席一枚提交实测吞掉他人 55 枚已入库行并当场回补,判据定义外的这一型从此有人盯 (96088b6edd)
- 🐞 Fix:49 枚工作流的 GITHUB_TOKEN 权限面收进顶层声明,并装上门 48 规则 B (304b03ace2)
- 🐞 Fix:回补被上一枚提交吃掉的他人已入库件(团队任务表面「队数封顶与逐出」那段安全强化,五十五枚行) —— 成因如实写:上一枚把工作树那份滞后副本整文件交回,吞掉了别人已入库的内容;它没被门 84 拦下不是判据该改,而是那一条判的是「暂存 blob 逐字节等于某祖先版本」,而我这份是「陈旧底稿加我自己的新增」的混合体,结构上落在它的定义之外。正解顺序是先取父提交 blob 把他人内容整段保回、再只把自己的响应面字段重新加一次。现读:五处逐出符号回归、相关用例绿、mcp 族 一七八例绿 (4710182cc9)
- 🐞 Fix:index_codebase 响应面接齐三代结果字段并上逐字段完整性钉 —— 遍历通道、快照自证、租约档三代各往 IndexResult 写了字段,而工具响应用的是手挑 key 清单,三回都没抄进去,于是「降级过/自证失败/被租约挡住」在端上与「一切正常」同形;新用例不再测某一个字段,改测「IndexResult 每个字段必须出现在响应里」,不靠人记得手抄。二百三十二例绿、mypy 六百八十二源文件零错 (6534b09698)
- 🔧 Chore/Other:金标缺陷答案重标器与前后对比基线(逆向复现 goal-b47,收编席 V 交付) —— 先更正本席派单时的成因假设:那九十五条缺陷题过去根本不在分母里,不是压低召回,而是百分之三十六的金标从未被打分(覆盖缺陷)。补齐后可判从一百六十九升到二百六十四,Recall@5 反升两点零三分、MRR 降两点五五分,检索腿的真实缺口因此才量得出来。重标只取源文件逐字切片,全量二百六十四条断言期望串是其源文件子串(本席另跑一遍复验),原金标件 sha 恒等未被改;取不到时移出打分集并计数,不静默删也不冒充答错。顺带定位到 id_native 轨出路:金标二十八枚 id 就是本仓 ParentChildChunker 的父块 id,现读复现二十七条,漏的一枚是随正文变过的陈旧派生 id。用例十例绿、ruff 通过、mypy 六百八十一源文件零错 (60eb0cbaa6)
- 🐞 Fix:夹具闭包推导器把注释里的举例 import 当真边收 —— 一型毒红整片套件的 8 枚用例 (0c99ef30c7)
- 🚀 Feature/Improvement:同仓索引加租约层做单飞行(逆向复现超越,对齐 T9 的 startSync/refreshLock/endSync 串行协议) —— 本仓此前根本没有这一格:懒索引闸门与 index_codebase 两条路都会发起整仓索引,同仓并发就是各花一遍 embedding,还会抢同一枚临时快照名。并进去的那轮在响应上写 lockState=coalesced-waited;等过窗口返回 over-window 并点名本轮未开工(零索引数不得被读成没东西可索引);跑完即摘牌,所以不存在拿到陈旧结果的通道。测试顺带咬出第二枚真缺陷:并发 replace 被瞬时锁挡下时旧代码只 debug 级留痕并把临时件留在盘上,现改为出声并自清。索引族 一五九例绿、ruff 通过、mypy 六百八十一源文件零错 (a208022b4d)
- 🐞 Fix:凭据脱敏闸接到 api 根 logger,并把 BYOK 的 Google key 从 URL 移进头 (99e7ed1d32)
- 🚀 Feature/Improvement:装上提交面「内容整片退回更早版本」的只读巡检尺 —— 本会话第三起损失的根因格从此有人看 (0082da2004)
- 🐞 Fix:平台凭据不再进 URL,并给两条落盘链各接一道凭据脱敏闸 (0e208a6d07)
- 🐞 Fix:畸形 ignore 模式不再把整次骨架装配带崩(本仓真档实测复现) —— 上一枚提交里我写了「生成产物全进骨架」这句成因,这枚把它量出来并修掉自己埋的雷:结尾单反斜杠的字符集合按字面量处理,其余编不过的模式跳过并把出处点名到规则文件行号,坏模式不连坐同文件的其它规则。现读实测本仓工作树面:同一份两千 token 预算下源文件从三十枚升到一百七十三枚、目录行从三百四十七降到一百一十六,另有三千零七十九条被剪条目带出处可答。四十三例绿、ruff 通过、mypy 六百八十一源文件零错 (cd32863fb6)
- 🐞 Fix:项目百科缓存与团队任务板补外层键封顶 —— "内层有上限、外层键没人管"那型再消两格 (8e6903090f)
- 🚀 Feature/Improvement:Merkle 快照读回补自证档(逆向复现超越,对齐 T9 逐字段校验并拒绝截断文件那一格) —— 旧口径把打不开、形态不合、尾部截断一律塌成空表,于是响应上读起来像增量完成,实际白烧一轮全量向量,而且删除集的分母一起变空、幽灵切片永不清理。现在写侧带 schemaVersion 与 fileCount,读侧除了比条数还要拿 files 重算 merkleRoot,六档形态收成一份单源清单并随响应回传 snapshotState;自证失败那一档本轮刻意不清幽灵、也不冒充清理过,原委写进 errors。新增九例、索引族套件 一三九例全绿,ruff 通过、mypy 六百八十一源文件零错 (b655b3eaa2)
- 🐞 Fix:销一枚溯源水印 HEAD 面欠账 —— 门 47 在 CI 钉版本那枚提交的复跑里抓到 (4ec0770e47)
- 🐞 Fix:CI 的 248 处第三方 Action 引用全部按提交号钉死 —— 可变标签是签名发布链的远程代码执行面 (671a0e6a47)
- 📚 Docs:登记两格逆向复现残余(索引面 ignore 接线、改名检测)—— 上一枚提交信息说了「已另开票」,这一枚就是那张票 (1aab7fd5ac)
- 🚀 Feature/Improvement:ignore 规则判据层落地并接进目录骨架装配(逆向复现超越,对齐 T12 原生层 ignore 三文件族剪枝) —— 本仓此前刻意给 rg 传 no-ignore 换两通道对账,代价是生成产物全进骨架与索引;现在规则求值收成一段纯函数、在枚举之后统一过一遍,所以两通道对 ignore 的判断在结构上不可能不一致。剪枝带回出处(哪枚规则文件的哪一行),规则文件读不动或超上限逐条点名不当没发生。索引面这一格刻意没同时接线:本仓存在跟踪但被 gitignore 覆盖的路径(守门 236 就是为这型立的),一口吃进去会让这些文件静默从索引消失,已另开票。三十一例绿、ruff 通过、mypy 六百八十源文件零错 (978b6f7854)
- 🐞 Fix:文件版本表补外层键封顶 + watcher 名额闸排在起线程之前 —— 同族第 5 批 (3c3943773e)
- 🔧 Chore/Other:回调机主批准的临时放宽 deploy.minutesPerDay 720→480(含现场读数与真因) (ed59167b4a)
- 📚 Docs:登记 render_repo_tree 目录骨架预算装箱与代码检索双腿融合(补第廿一条欠账) (b64a2c1b1a)
- 🚀 Feature/Improvement:新增 render_repo_tree 按 token 预算装箱仓库目录骨架(逆向复现超越,对齐 Qoder mtree 的 renderTree) —— 枚举走 rg_fallback_parity 单源出口不写第二遍遍历,预算先保目录骨架再补文件,削掉的文件与被 scope 排除的条目分格计数并以 complete 与 dropReason 出声,token 估算复用 context_compaction 不另立第二把尺;渲染钉十二例加接线钉五例共十七例绿,ruff 通过、mypy 六百七十九源文件零错 (0de483bff6)
- 🐞 Fix:会话级内存账本补外层键封顶 —— 准入留痕只增不删 与 产物"成功也镜像"两格一起收 (8ad1b44ec4)
- 📚 Docs:T12 mtree 原生面与钩子宿主取证结清(席 S 交付、本席复验) —— napi 导出实测二十三枚并据此更正 T9 的二十四枚,快照双哈希与 ignore 三文件族在原生层判定,hook 宿主是 Rust tokio 薄壳(导入表无 CreateProcess、无网络栈),钩子契约两个拐点(承载体换原生 exe、事件面从二档扩到五档并首次出现 matcher),缺口对撞表八条含七条真缺口 (18be313f02)
- 🐞 Fix:PR diff 缓存补键上限与真过期 + 原语加"新鲜度/会话"两档语义与晚绑定时钟 (4e7177bb74)
- 🔧 Chore/Other:归档处置镜像三例按"仍可达的两格"重写 —— 正控前提已被归并层自己吃掉,套件回绿 (e751da2b37)
- 🐞 Fix:进程内存储补"键数上限+滑动寿命"原语并接三处 + 更正我上一批过粗的 MCP 角色闸 (9ef49a8476)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (654a48986a)
- 🚀 Feature/Improvement:检索金标召回基线 runner 与首份基线件(补齐"指标与金标都在、从没见过面"那一格,逆向复现超越 T9 分档阶梯) (0d5f41b9ba)
- 🐞 Fix:收编器补上「部分回退」臂,并修好两条从未被递达的探针 (8af02b64e8)
- 🐞 Fix:收敛零丢失判据的空行口径收口 —— 修掉一道把同步链整体卡死的与内容无关的红 (9bb933f627)
- 🐞 Fix:file-transfer 两处出网补 SSRF 闸 —— 已导出的通用工具不该指望未来调用方自觉 (8991a5434e)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (6bdbc1885c)
- 🚀 Feature/Improvement:代码检索改双腿并跑加权融合加降级具名出声(逆向复现超越 #10,对齐 Qoder 五档召回阶梯) (a898e78057)
- 📚 Docs:F9 让号 —— 本侧未推行让给已入库同号(门 203 同题跨号禁止),改前整行逐字入归档件 (64d9562895)
- 🐞 Fix:技能库导入/评分面补容量·份额·归属 —— 单人写爆内存与刷高均值两条通道一起关 (4738b9dcf2)
- 📚 Docs:固化本轮 16 份席位交接件出 gitignored tmp,落在本轮取证册同族路径 (05e018e583)
- 🐞 Fix:三条产出发布物的 CI 链收口到 --frozen-lockfile —— 签名/发布路径不再静默重解析依赖 (dd437a0463)
- 🐞 Fix:网络段内网强制锁把某一代写法当契约,实现加强后它自己恒红 (e534238946)
- 📚 Docs:只读尺清单同批登记本会话新立的两把尺(检索召回质量尺 + AI 归属读侧聚合) (2743fd398f)
- 🐞 Fix:AI 归属主体缺失时不再静默跳过(读侧尺子量出"接线在而零落笔"后的补刀) (2b81e939a7)
- 🐞 Fix:ReDoS 闸补齐另外两处调用点 —— 长度闸门挡不住 7 字符的病态模式 (c5487c1ce9)
- 🐞 Fix:上一枚回补落地后受影响判据点名门 2f-miniapp-taro 判红,就地补 ko parity —— 反算把 zh-CN 三枚键请回而 ko 缺同键(utilsMiniapplogin.alipayUnsupported / webViewPortal.artifacts / identityVerify.submit);按 i18n 流水线正牌路径自主补译 ko 三条(术语对齐包内既有写法 알리페이 / 산출물 / 인증 제출),经 i18n-apply --target=miniapp-taro --check-first 写入,派生态同批重派(gen-i18n-compressed;en/ja/zh-TW 的 b64 与基线逐字相同故不入声明集)。有意留痕:ko.json 含上一枚从祖先回补的 565 行,按守卫的尺即「行级复活」,而窄清单通道 LAND_RESTORE_MANIFEST 对 .json 只受理数组元素级、字典键级还原不受理 ⇒ 走出口② LAND_ALLOW_STALE=1 显式放行(与枚 fa2b5a4082 同一理由的续格),其余判据一道未跳。末行现读:i18n-diff --target=miniapp-taro 报「无 pending,所有语言 parity + 翻译完整」,i18n-apply 自报 parity 通过。 (af54b80080)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (a05583509c)
- 🐞 Fix:WebView 落点信任闸上收共享层 —— RN 不再把会话授权码签给任意 origin (5cfcb917de)
- 🐞 Fix:回补被收编扫描整片抹掉的 2915 行翻译(cli 状态词+小程序五语包+web),派生态同批重派 —— 枚 f9fb2e4ceb(2026-10-31)入库六小时后被枚 f0572d64c4(2026-11-01 00:40 chore(i18n) 收编停留≥3分钟未提交改动)反手抹掉,同枚还削掉 miniapp-taro 五语包各 586 行与 web 各 2 行,合计 2915 删除;现读 cli 包键数 66 掉到 52,packages/types 词条镜像用例红在 HEAD 面(zh-CN 缺 cli.failureOutcomeRetryable ⇒ 五语言全缺)。这与本轮已修的 G-24 归档保留档(枚 9fdbc207ba 抹)、G-44 告警身份单源(枚 9fdbc207ba 与 b41b9fdce8 抹)是同一把按滞后副本写回的刀,本枚只结清语言包这一格,扫描器自身缺守卫另行处理。修法:对 f0572d64c4 那 15 个文件逐字节反向应用(只撤其 hunk),再走正牌生成器同批重派三个 gen.ts 与四个 CDN b64。有意留痕:19 条路径的新内容按定义等于被抹前的祖先 blob(还原的目的就是回到那一形态),窄清单通道 LAND_RESTORE_MANIFEST 只受理行级与数组元素级、JSON 字典键级不受理,故按落地器出口② LAND_ALLOW_STALE=1 显式放行并在此写明;其余判据未跳。差集可核:cli 每包回补 15 键、miniapp-taro 每包 565 行、web 每包 2 行。末行现读:packages/types 词条镜像 10/10(改前红),check:i18n-keys 五语言 parity OK,离线包自述钉 matched。 (fa2b5a4082)
- 🚀 Feature/Improvement:检索召回质量只读尺 check-retrieval-quality(为双腿融合改造先立验收判据,判据先于改造) (3ac3595549)
- 🐞 Fix:notify(email) hook 不再"未投递却报成功" —— 审计/告警通道的终态必须诚实 (09ee10ea92)
- 🚀 Feature/Improvement:AI 代码归属读侧聚合出口 ai-authorship-report(补"只有写侧没有读侧"那一半,并量出写侧一枚都没落过) (1e49ec1740)
- 🐞 Fix:入口把本包自己的 nativewind env 拉进类型程序 —— 补上双份 react-native 那一格 (6239f00e6f)
- 🚀 Feature/Improvement:agent 工作簿读写工具面入库(对齐 Qoder xlsx-sidecar 的 open/read_range/write_cells/save/close) (d96d43d00d)
- 🐞 Fix:回补被两枚同步提交整片写回的 G-44 告警身份单源(部署腿+监控腿),HEAD 面三处恒红转绿 (e9134d30e2)
- 🐞 Fix:USDT 验签改走单源常数时间比较 + 未注册的 organization 路由就地补角色闸(堵 fail-open 陷阱) (64c87d8b42)
- ♻️ Refactor:web 端字号统一落盘 —— 只落可证恒等的 3877 处(font-weight 锁档) (46cd4f9051)
- 📚 Docs:F9 让号 —— 本地两枚未推行 O67 让给已入库的 O67(门128 CSS 变量解值),原行逐字入归档件 (87b3f475e1)
- 🐞 Fix:匿名语音上传补上限读取 + 外部 MCP 的 url 通道收归管理员 + 限流补档 (0448b4f43c)
- 🐞 Fix:工作区沙箱补齐 git 出网闸 + 集成代理不再让 path 改写落点 + grep 接嵌套量词判据 (555f539da8)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (92428cbd6d)
- 📚 Docs:细节能力清单第 32/33 条登记插件更新判据层与安全扫描 hooks 接线(AGENTS §21 新增端能力必须同批更新 README) (572470b674)
- 🔧 Chore/Other:门 273 自检⑯ 的 H3 资格锁改判 HEAD 面 —— 别让别人的滞后盘钉红我的自检 (079a6825a2)
- 🐞 Fix:门224镜像按固定缩进取注册条目,一枚缩进漂到三格的收尾把两条目读成合并体 (35426d5dc9)
- 🔧 Chore/Other:摘掉本席那把重复镜像锁 —— 同一判据由 O67 的 lib 单源承担,不留第二把 (1e441b5cfb)
- 🚀 Feature/Improvement:插件更新判据层 checkUpdates 与 planUpdate(补齐 G-22 autoUpdate 残腿,把门 277 接成供应链防线) (23e52bc8bf)
- 🚀 Feature/Improvement:安全扫描判据搬出命令壳并接进 hooks 两腿(逆向复现超越 G-12,对齐 Qoder security-scan 插件) (60af71ad11)
- 🚀 Feature/Improvement:工作簿读写服务面入库(收编中断席位可用的半格,主席补类型收口与 lint 修正) (5dc42a3a28)
- 🐞 Fix:让号 O67→O62819(合并新增撞号) —— 改未推本地一侧 1 行,改前原文留痕入归档件 (7a7e57708d)
- 🐞 Fix:备份落点探测锁把 G-50 的加强读成缺失,HEAD 面两例恒红 (9f1dc08fcd)
- 🐞 Fix:terminal_run 补上参数面收敛与沙箱 cwd —— 白名单内命令不再能读走仓库根的 .env (ae1546014a)
- 🐞 Fix:门104把位置比对的行数当漂移量级报,11行真差被读成213行 (9db11efbdc)
- 🐞 Fix:共享 RN 屏的类型程序自己挂上 className 增强 —— 结清 138 条类型红 (089130c719)
- 📚 Docs:细节能力清单第 31 条登记桌面输入动作族与两道内置门(AGENTS §21 新端能力必须同批更新 README) (7460082e2f)
- 📚 Docs:T8 把「对侧没有人工审批门与速率闸」降为分层表述(执行席否证主席派单断言,据实采纳) (04a1c90db6)
- ♻️ Refactor:web 端字号统一落盘 —— 只落可证恒等的 3877 处(font-weight 锁档) (5988f4cd4b)
- 🚀 Feature/Improvement:operator.rs 补输入类动作族与两道内置门(对齐 QoderComputerUse 动作面,逆向复现超越 T8 §A) (55744315c8)
- 📚 Docs:O67 就地改写为精确剩余项 —— 原点名的两条红已随枚 88bd07c0c0e 结清,剩下的是 web/小程序腿工具类未建模那一格 (975a26574f)
- 📚 Docs:点名 check-qoder-session-sync-task.mjs —— 消掉 HEAD 上唯一一枚 R4 恒红(已接线而文档隐形) (94c7251d4b)
- 🐞 Fix:登录/注册回跳收成"同源 ∪ env"白名单 + 证书打印窗转义 —— 堵掉带会话外跳与同源弹窗执行面 (fca5f7a796)
- 🐞 Fix:完成即删兜底轮把号段租约行当滞留票吃掉,千段租约的占用账被清空 (adf3f7e9a8)
- 📚 Docs:更正 Trae 册「消费方接线仍被在飞面挡住」这句过期账(写侧已接、缺的是读侧) (6d3b02600c)
- 🐞 Fix:补两枚 keyboardShouldPersistTaps —— H3 绝对零容忍维回到 0，顺带修"键盘抬起吞一次点击" (28769216be)
- 📚 Docs:按 T10 复核就地更正三处内核数字(16值/89迁移/145下限)——错误读数留在在册文档里就等于给下一席发错票 (19b19eb030)
- 📚 Docs:T10 复核 Trae 内核五条推断级读数 —— 推翻两条并给出逐枚偏移实锤(逆向复现超越的取证纪律腿) (d501ae2f64)
- 🐞 Fix:入口的 nativewind 类型增强改成注释指令 —— side-effect import 让打包器必炸 (bf1396e524)
- 📚 Docs:T9 Qoder 检索引擎实现级取证 + T8 对照架构图凭据(逆向复现超越的取证腿收口) (e90fe71010)
- 🔧 Chore/Other:.ihui-agent/tmp/rn-hyg/msg-renum.txt (11dc40379b)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (9c73e2d913)
- 🐞 Fix:清掉 HEAD 面一枚水印欠账 —— apps/api/tests/relay-account-pool-keepalive-forever.test.ts (c0958c47c7)
- 🚀 Feature/Improvement:ui-native 四原语补按压 + 两条按压通道深浅并成一档 (e63c5c17e7)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (7ae43b698d)
- 🔧 Chore/Other:重封根护栏清单 —— 6f57e57fe6 的守门277 注册改动合法但漏了 seal,部署环 fail-closed (3dfd9975ba)
- 🐞 Fix:归档落点器的保留档能力被一枚清理提交整片写回旧基线,镜像测试空等6天 (17a1d45836)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (785700f1ea)
- 📚 Docs:T7 派单索引更新到本轮现场 —— 交接面(防上下文断档丢现场) (54942dc36d)
- ♻️ Refactor:web 端字号统一落盘 —— 只落可证恒等的 3877 处(font-weight 锁档) (22d67096b3)
- 🚀 Feature/Improvement:门 128 几何维认得 CSS 变量解值 —— 两族 var 假分叉撤豁免、零分叉族摘锚点键 (88bd07c0c0)
- 🔧 Chore/Other:摘 38 处冗余 default + 4 个桶的无人转发出口 + 两枚 OS/装载型登记 —— 棘轮 6/7 维转绿 (735334d665)
- 🔧 Chore/Other:摘掉门78里一枚取了没人消费的读数 externalScanned —— 它在 audit 内已随结论行印过,main 侧再解构一次既不打印也不参与判据,却把 eslint 顶成1枚error(lint-staged 只查暂存面⇒存量红一碰这文件就现,上一枚提交因此被逼走 --no-verify 并留痕) (a92aa52da3)
- 🐞 Fix:门78深扫档把pnpm跨平台可选变体判成401条悬空红——判据假阳(§12e恒红门) (3feeb2ae4e)
- 🚀 Feature/Improvement:手工批 5 文件 8 枚 —— 含门 131 漏判的"命名函数 style"这一型 (8f8b994f80)
- 📚 Docs:auto-triage 自动登记(api-logs;第 1 期感知层产线动作,O65) (a1e6e0e784)
- 📚 Docs:T8 两枚 Qoder sidecar 原生面取证(Ghidra headless 级,逆向复现超越本轮的取证腿) (e2a418dd84)
- 📚 Docs:auto-triage 自动登记(api-logs;第 1 期感知层产线动作,O65) (61e2fa79a8)
- 🐞 Fix:CLI 的 V1 配置装配路径接进项目层封闭表 —— 仓库一枚 settings.json 不再能把凭据改道到攻击者主机 (d55306655f)
- 🔧 Chore/Other:给新测试补溯源载荷 (L2 头 + L3 尾两行,内容未改) —— 门 47 HEAD 面缺口,工作区已注入待提交 (8f0f4c2b41)
- 📚 Docs:守门点名索引补门 277 一行(门 89 R4 义务,与接线同批) (7d386b2826)
- 🚀 Feature/Improvement:三端落档腿装车齐 —— web 那一侧补上调度器,并把它独有的安全旗写死在 argv 上 (eab90b40e2)
- 📚 Docs:T3 缺口矩阵补「时效告示」一节 —— 治"按腐烂册面重复派单"(逆向复现超越本轮的防复发腿) (90933dd5ae)
- 🐞 Fix:入站身份裁决收进单一出口 —— 修掉三族 v1 路由的混淆代理(可跨租户读代码/写归属) (969b19b054)
- 🐞 Fix:门 103 的 D4 接表级例外 + 测试面单向借用登记 —— 例外机制此前对环违规结构性失效(EX-D4 永不命中还自报清单腐烂),补 exPass 并加自检;EX-D4-1 登记 repo-tooling→miniapp 测试借用环;immutable-exempt: 门自身缺陷(例外不覆盖 D4)导致登记后仍红且自报腐烂,补判据链并加成对自检 (25ab228ae7)
- 🐞 Fix:门 128 几何维补上「CSS 命名档」这一腿 —— 落档自动化推进到哪,尺子就跟到哪 (cc6f9ee29d)
- 🚀 Feature/Improvement:dev 库口令轮换器补上唯一登记出口 --register(此前全仓无创建出口 ⇒ 下次暴露无人能记) (817e45952f)
- 📚 Docs:按机主裁定结清 G-20 与 O68 —— 两项均已完成,整行摘除 (a51d5a1fb5)
- 🚀 Feature/Improvement:按压反馈批 34 文件 62 枚 —— 死样式清掉、函数形态拆成设计档两参 (d58e272801)
- 📚 Docs:细节能力清单第 30 条登记 run_workflow(AGENTS §21 新增能力必须同批更新 README) (1eeab01a1d)
- 🚀 Feature/Improvement:补齐 run_workflow 工具面,对齐 Qoder Workflow/RunWorkflow 的未变节点回缓存重放(G-01) (09fa348a4f)
- 🐞 Fix:dev 库口令轮换巡检腿补四处会把它变成死线的缺陷(含一处 fail-open 误判窗口) (f571ea79f0)
- ♻️ Refactor:web 端字号统一落盘 —— 只落可证恒等的 3877 处(font-weight 锁档) (695a08c77f)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (9fdb4b7b3b)
- 🐞 Fix:className 类型增强改用 side-effect import —— triple-slash 在 Next 消费面不生效(部署实测) (68c8117b25)
- 🐞 Fix:号池任务中心"心跳在位"不再被写成"执行成功" —— 与本线已修的四处同族的最后一格 (e28e5f6e4b)
- 🚀 Feature/Improvement:Tappable 加 pressedStyle 档 —— 修样式不许顺手改掉设计档 (06b84c8012)
- 🐞 Fix:收口被整块重复的登记(F6 块级判据的修复出口) (c64b4566a1)
- 🔧 Chore/Other:死 key 存量基线五端下调为 0 —— 存量已实测归零,不留"不会到期的豁免" (5c25e975cf)
- 🐞 Fix:补上 mobile-rn 五个词包的死键摘除 + 小程序离线包同批重生成 (eb1dad8a82)
- 🐞 Fix:摘除 Z-1 与 RP-79 回捞复活残影共 4 行 —— Z-1 前提已不成立、RP-79 已结清(证据 7908385ffb 结清摘行是祖先 + union-converge-flags 与镜像测试在位) (d6f66d322b)
- 🚀 Feature/Improvement:号池永久保活档 —— 机主本机 Trae 号进池并给它一条不会死的续期路 (ee77dea986)
- 🔧 Chore/Other:收编停留≥3分钟的 i18n 未提交改动 (f0572d64c4)
- 📚 Docs:结清 O69 —— dev 库口令轮换已挂进 guardian 巡检轮 (1502053d88)
- 🐞 Fix:恢复被旧基线写回的两处已入库修复 —— className 增强与 wb_tasks.not_running_reason (88d43f8c1d)
- 🐞 Fix:G 盘根守护整族跑不动的病根是同一文件写了两条版本声明 —— pwsh 7 在绑参阶段报 Cannot bind parameter because parameter 'version' is specified more than once,install/guardian/status/uninstall 四件一条命令都执行不了;而 VBS 用 SW_HIDE 不等返回、计划任务恒报 LastResult=0,于是这道防线两个月来静默什么都没做(status 件现读 Running: NO 且日志文件从来不存在)。按 §27 保留唯一一条 #requires -Version 7,摘掉陈旧的第二条;修后用 PowerShell 自己的 Parser 全量复验 94 枚 .ps1,bad=0;真跑只读 status 件通过,启任务后守护在 session 0 起进程、日志从不存在变为有内容(v2.0 mode=allowlist-first);顺带把 G 根守护任务按它自己声明的 S4U 复位(此前主体漂回 Interactive,注册器坏了没人修得动 = AGENTS §0.8 那条铁律的现场) (030fa25535)
- 🚀 Feature/Improvement:dev 库口令轮换挂进巡检轮(票 O69) (b081fa37d8)
- 🐞 Fix:修复两处已入库的构建阻断 —— 跨端 UI 二期的 className 类型没跟公开入口走、types 漏了 wb_tasks.not_running_reason (6b50c92f5e)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6453cfd2e3)
- 🐞 Fix:让号 O67→O42819(合并时新增撞号) —— 改未推本地一侧 2 行,改前原文留痕入归档件 (d58824d54f)
- 🐞 Fix:ai-generation 族队列名接进库身份单源,清掉这一型最后一枚字面量 —— 主库(ihui、未设后缀)解析结果与旧字面量逐字节相同 ⇒ 线上零扰动,这条性质不是口头保证:它调的是被 24 例钉住的同一个纯函数出口(§0.6 单源);本仓 new Worker('ai-generation') 现读零命中 ⇒ 这次改动不构成生产/消费分家(要么两侧都原名,要么本仓根本没有消费者);面纯度已核:E 席那批没碰这族,不存在半接线;两面 tsc 与 eslint 零错,队列契约 29 例仍绿 (14ab2c654c)
- 📚 Docs:登记一票=dev 库口令轮换器已入库但未挂调度(窗口靠人盯)，正解照 sweepExposedCredentialRotation 形态挂进 guardian 巡检轮 (03afa371c7)
- 📚 Docs:登记一票=门 128 CSS 变量解值根治与 torpx 夹具重订(席位撞轮次上限且改在滞后副本上,产物已存档 seat-k-salvage,须从最新 HEAD 重做) (5e4df4f003)
- 🐞 Fix:让号 O68→O22819(合并时新增撞号) —— 只改未推本地一侧 1 行,改前原文留痕入归档件 (395a5e55fd)
- ♻️ Refactor:web 端字号统一落盘 —— 只落可证恒等的 3877 处(font-weight 锁档) (a70cb9c766)
- 📚 Docs:O68 记轮换器物化进展 —— 器物已入库,执行窗口待机器空闲 (c0ff3a1e79)
- 🐞 Fix:收口被整块重复的登记(F6 块级判据的修复出口) (d60e6b85d8)
- 🚀 Feature/Improvement:本机 dev 库口令轮换器物化(票 O68) (27b7f9e6b7)
- 🐞 Fix:入口自带 className 类型增强 —— 止住 CI 构建面 51 条类型红(堵 e2e 与 web build) (6c5f60070d)
- 🚀 Feature/Improvement:号池永久保活档 —— 机主本机 Trae 号进池并给它一条不会死的续期路 (a6179dd4a0)
- 🐞 Fix:守护心跳移到初始启动之前,冷启动窗口不再被判成死亡 —— 一手量数:守护 22:11:13 起、首枚心跳 22:13:53,窗口 160 秒;watchdog 每 2 分钟巡检且阈值 90 秒,于是 22:12:04 派了第二个头,双头并存 109 秒并用 'w' 把 watcher.err.log 截成 0 字节吞掉诊断;另量到常驻期心跳龄 85 秒贴着 90 秒阈值。取「消除零心跳」这一档:单实例锁与第一枚心跳都排在 await run() 之前,此后由真推进事件续写并按 20 秒节流;--check 与一次性体检不写心跳(注定退场的 pid 不许冒充守护);巡检侧阈值 90 秒、2 分钟节律、revive() 调用点一字未动 ⇒ 真死上界仍是 90+120=210 秒未降速;主席补修两枚死变量(heartbeatShouldRefresh 的 freshMs 是无 caller 的装饰入参,删除而非改名;测试里 HEARTBEAT_PHASE_STARTUP 是死解构);新增 17 例并变异自证 (7066570b31)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (1bd4947583)
- 🐞 Fix:其余六族 BullMQ 队列名全部接进库身份单源,号池不再是唯一被隔离的一族 —— 取证席在 Redis db0 实测到同族事故残留 bull:relay-health-check-queue:failed=500,说明 2026-10-24 那笔停摆不只打在号池上;解析层新增语义中立唯一出口 queueNameWithDbIdentity,relayQueueName 退为薄封装(规则表仍只有 resolve 一份);接正 email/notification/ai-callback/notification-dispatch/registry/scheduler/batch/usdt-payment/relay-health-check 九处取名点,观测面 relay-task-center 两枚写死字面量一并改走解析器(该字段会被 admin 路由喂给 new Queue);主库逐字节原名不变用两路取证(契约①逐字比对 + HEAD blob 探针 10 族 3 档);smoke 套件那条等值断言不删只搬到主库 DSN 下的契约①判,原处保留形状与无冒号牙;新增契约用例 5 例、受影响 6 套件 96 例、两面 tsc 均 0 (651283be00)
- 📚 Docs:结清 O67 —— safe-commit 发令前点名索引内非本票件已装车 (e9a6a3cea8)
- 🚀 Feature/Improvement:发令前只读点名「索引里非本票声明的已暂存件」(票 O67) (1a4be3bcb4)
- 🐞 Fix:门 273 不再把函数形态 style 当作已有反馈 —— 与门 131 停止互相打脸 (8b50a87750)
- 📚 Docs:登记一票=本机 dev 库口令部分入会话的轮换器物化(现读 DSN 仅 localhost 开发库;红线是前缀也不许进会话,处理口径照 2026-10-26 同类事故=主动提轮换并造轮换器) (56dc3b0258)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (e119e324f2)
- 📚 Docs:结清移动端走查票(首页/学习页区段头几何读数)—— 白屏根因修复已入库 04a5e71d1e:构建后步骤 patch-entry-chunks.mjs 给每个入口补静态 deferred chunk require(幂等+单测3/3,接入 build/build:weapp;干净构建 312 入口/4285 条;getApp()=true、page.data 有 root、首页与学习页完整渲染;主包 1,720,290B≤2,097,152B)。读数:镜像首页 redirect 到 pages/index/index(同一首页、无区段头);学习页「继续学习」自绘头 316×684 截图字高 15px→390 视口≈18.5px(36rpx=18.72),与 spec 16px 差≈2.5px,证实未走 SectionHeader(spec/adapter 半边已由 1394db170f/189f31951f 落地)。automator 的 page 查询对 Taro 渲染树不可用,读数走截图换算。 (62b4253106)
- 🔧 Chore/Other:Taro 页面按 app.config.ts 派生 entry —— files 925→350、unlisted 186→4(基线不动) (1e2779b7d4)
- 📚 Docs:结清移动端走查票(首页/学习页区段头几何读数)—— 白屏根因修复已入库 04a5e71d1e:构建后步骤 patch-entry-chunks.mjs 给每个入口补静态 deferred chunk require(幂等+单测3/3,接入 build/build:weapp;干净构建 312 入口/4285 条;getApp()=true、page.data 有 root、首页与学习页完整渲染;主包 1,720,290B≤2,097,152B)。读数:镜像首页 redirect 到 pages/index/index(同一首页、无区段头);学习页「继续学习」自绘头 316×684 截图字高 15px→390 视口≈18.5px(36rpx=18.72),与 spec 16px 差≈2.5px,证实未走 SectionHeader(spec/adapter 半边已由 1394db170f/189f31951f 落地)。automator 的 page 查询对 Taro 渲染树不可用,读数走截图换算。 (803d6f8f18)
- 🚀 Feature/Improvement:人工批落 24 枚 —— VoiceNote/HomeScreen/ChatScreen/ImageAnnotator 全换 Tappable (2ffa442d8b)
- 📚 Docs:登记一票=提交链所有权盲区(safe-commit 发令前不点名索引内非本票声明的已暂存件) —— 本轮实测两起后果,含 HEAD 一度带 1 failed | 8 passed 的红(已由枚 eb7fbad5ae 结清) (0807e4a16d)
- 🐞 Fix:门 103 契约收口 —— 补 6 处依赖与 9 条公开入口声明、2 处具名豁免(带到期)、archify 目录退出扫描;staged 判红 22→0,自检 138 例绿 (80e11ab999)
- 🔧 Chore/Other:签到面板「自动做任务」补真浏览器规格 16 例(真实 CSP 下全绿) + 一处因果表述更正 (90970468e0)
- ♻️ Refactor:剩余字号任意值落档 350 处(500~700 字重档)—— 小程序端字号面清零 (dcf297e539)
- 🚀 Feature/Improvement:把「任务锚点烤进第三方私有目录」变成常驻体检 —— 今天手工修的两枚守护任务只是止血,病根是没有任何一层盯着「任务里烤的是哪枚 node」;ensure-silent-tasks 的任务审计新增 ①c 锚点禁地一档(刻意排在 LogonType 豁免之前:S4U 任务同样会被捆绑 node 拖停,与会不会弹窗无关;Execute 与参数两半都问,真实病形态是锚点藏在 VBS/pwsh 参数里);判据仍单源在 lib/task-node-anchor,巡检器不另写目录清单;锚点测试 8→11 例、巡检器 4→5 例(含接线形状锁);现跑 --check 本机 17 枚任务 0 处违规。immutable-exempt: 只在判据层加新出口与更严的拒绝分支,未放宽任何既有判据 (75428ae4a9)
- 🐞 Fix:修好整端白屏 —— 给 webpack 入口补静态 deferred chunk 加载腿。根因(2026-10-31 实测):weapp 为压主包 2MB 上限开 mini.optimizeMainPackage 并摘掉 Taro cacheGroups.common.name,产物里 app.js 与每个页面/组件的入口回调 e.O(0,[…]) 会等二十多个独立 <id>.js;这些 chunk 从未被 require、小程序运行时也不自动加载(动态拼路径实测报 module '…' is not defined)⇒ deferred modules 永不满足 ⇒ App()/页面组件永不执行,表现即整端白屏(getApp() 恒 false、page.data 仅 __webviewId__)。修法:新增构建后步骤 patch-entry-chunks.mjs —— 扫产物里每个含 e.O(0,[...]) 的 JS,把其依赖且 dist 根确实存在的 <id>.js 以静态字面量 require 追加到文件末尾(带 /*miniapp-entry-chunks*/ 幂等标记);接入 build/build:weapp 的 taro build 之后。实测:干净构建 312 个入口共补 4285 条 require;重开 IDE 后 getApp()=true、page.data 出现 root、wx.request success,首页与学习页完整渲染(截图 .ihui-agent/tmp/mobile-walk/{final-render,measure-last}.png);主包 1,720,290B / 上限 2,097,152B(余量 376,862B,check-artifact-budget ✅)。单测 scripts/tests/patch-miniapp-entry-chunks.test.mjs 3/3(层级相对路径/缺产物不补/幂等/无 deferred 不动)。代价:启动时多加载这些 chunk;待 Taro/config 侧能共存后本脚本退役。 (04a5e71d1e)
- 🐞 Fix:常驻任务的 node 锚点收成单源,止住「谁跑就烤谁」 —— 今天两枚守护任务长期烤着第三方 AI IDE 自带的 node(…\.workbuddy\binaries\node\versions\…),对方升级或卸载即消失,守护与看门狗会一起静默停摆;新增判据 scripts/lib/task-node-anchor.mjs(纯判据零 IO:优先 PATH 上当次实测的规范 node,取不到且当次解释器干净才如实标 fallback,落在第三方私有目录则拒绝,两者皆无 ⇒ exit 2 未判定,不写死盘符),本台注册器已接;镜像 8 例钉住五型分岔与平台分隔符;immutable-exempt: 新增判据层文件,不改写任何既有判据,只把锚点取值从随进程改成随本机实测 (6c61829ab3)

**2026-10-31**
- 📚 Docs:内置 MCP 工具数 24 -> 105(现读 _TOOLS) + 旧 24 枚枚举改指针 —— 本批新增 advisor_consult 后 _TOOLS 现读 105 枚(check-tool-name-display-coverage 105/105);原表里的 24 枚旧名枚举已与注册表严重脱节,改为指向 mcp_server._TOOLS 并列出核心族,避免下次再漂。历史归档段的 24 保持原样(那是当时快照)。其余语言 README 当前不在飞改写中时同批对齐。验证:check-readme-table-integrity + check-doc-numbers 复跑。 (b50d78dc28)
- 🚀 Feature/Improvement:WorkBuddy 回灌腿装成用户态任务 —— 与 Qoder 共用同一把哨兵/派发判据 (ec88d0370f)
- 🔧 Chore/Other:部署墙钟上限临时 480→720 —— 机主拍板的单次放宽(发完回调) (73294fc085)
- 📚 Docs:G-20 记腾讯云侧真实进展 —— 资质与 8 枚模板已过,唯一卡点签名被拒后已重报(审核中) (10e6e9c8d1)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (b6cd06f203)
- 🔧 Chore/Other:离线语言包重生成 —— 英文 inviteTitle 去中文残留(Join AI 智汇 community -> Join the IHUI AI community)已由 i18n 收编枚 26e6336 入源;本轮按干净输入面(0 未提交)重生成 3 份 gen + 4 份 CDN 载荷,同时吸收别席已提交的源键。验证:check-i18n-locale-content-language --worktree 候选 0、i18n parity 工作树面 19840 键×5 语言 OK。 (9b9fabfdee)
- ♻️ Refactor:移除已下线提现端点的 createAgentWithdrawal 封装与孤儿类型 —— 端点已 410、全仓零调用点(删前三问已答),api/web tsc 零错误 (b80a3b0c32)
- 📚 Docs:auto-triage 自动登记(api-logs;第 1 期感知层产线动作,O65) (31f8d34ccb)
- 🔧 Chore/Other:补 webview 承载页降级回归 —— 非信任 URL 分支必须复制链接且不调 setUrl (33ff9af8c7)
- 🔧 Chore/Other:收编停留≥3分钟的 i18n 未提交改动 (26e6336ec3)
- 🐞 Fix:补齐 CSP 修复的另两条路径 —— 上一枚只带进 1/3 声明路径,HEAD 一度带"新断言打旧生产码"的红 (92adf1bb5c)
- 🔧 Chore/Other:根护栏清单与 HEAD 面重新对齐 —— 解部署环 fail-closed (5cd9e86ffe)
- 📚 Docs:安全强化 goal R12 结账注记 —— 四枚提交已入库且 origin 同步(4b32f83f9c) (6705507975)
- 🔧 Chore/Other:收编停留≥3分钟的 i18n 未提交改动 (f81ebdc0b6)
- 📚 Docs:撤掉重复的 R10+R11 合并注记并把两条正本里的短 sha 补成 40 位 —— 逐行自证仅删 1 行+两行 sha 替换 (449c5ec1ff)
- 🔧 Chore/Other:修 message_bus 单跑必炸 —— autouse mock 先把 app.main 惰性导入走完再替换 httpx.AsyncClient (4b32f83f9c)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (98eaa34e88)
- 🐞 Fix:守门276 接正取材面档位并接通人工逃生舱 —— 全量档正文改取 HEAD blob(此前读磁盘,共享工作树里别席未提交字节会混进判定面),清单与内容同面同轮走层出口;新增 --worktree 人工档、未知旗与任意两枚面旗同给一律 exit 2 逐枚点名(此前 --worktree 被静默吞、抬头照打 --staged);MAX_BYTES 512KB→4MB 的依据是现读 git-guardian.mjs HEAD blob 563558B 一直整枚被跳过,即最大启动器从未被审;自检 17→28 例、镜像 13→21 例,runner 的例数与出路同步;immutable-exempt: 本次是把新增门自己的取材面接回统一层并修档位形状,判据三条与三档豁免一字未减 (4d51b4c8ce)
- 🐞 Fix:R12 前端收口 —— 画布消息源校验、Playground Key 清旧 localStorage 残值(web 腿) (66545ca044)
- 🔧 Chore/Other:收编停留≥3分钟的 i18n 未提交改动 (7cb6c06409)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (584b1bceaa)
- 🐞 Fix:R12 安全续修 12 项 —— 微信登录补 2FA 闸、TOTP 同一步只兑付一次、结算单读取限 admin、全仓发 token 点结构锁扩射程(8 处带理由豁免)、小程序 webview 白名单补备案与微信签约域(修 R11 回归)、签约响应补 signUrl、work-panel 新开标签限 http/https、SVG 资产断源、A2A 生产禁本地回环、MCP 音频下载钉 IP、IM webhook 过 SSRF 尺;API 96 + 小程序 6 + ai-service 94 用例全绿,mypy 674 文件零错误 (9cb6d0efdd)
- 📚 Docs:结清 Y-14 —— 生产库 latest 行已登记且公网端点返回真数据 (b8d3e48ac2)
- 🐞 Fix:dev 态 CSP 的 nonce 分支补回 unsafe-eval —— 本机活体实测页面曾被推进错误边界 (e77022e24a)
- 🐞 Fix:客户端回灌腿同因未判定降噪 —— 服务身份读不到 DPAPI,每 10 分钟一条同文 warn (c0176795b0)
- 🚀 Feature/Improvement:Qoder 回灌任务加存续哨兵 —— 任务被删/停摆/身份漂移都会安静失效,现在到人 (9da1df3ba6)
- ♻️ Refactor:三端巡检态判据收单一真相源 + 补"配置已开却没跑"档五语言文案 (34c0749d1a)
- 🔧 Chore/Other:重落死副本删除 —— fetch-protocols 与 url-protocols 同值且 HEAD 与工作树两面现读全仓零引用,该副本被归并回捞回来过一次;单源保留 url-protocols(消费方 navigable-url 与 ssrf-guard);intentional-delete: 裁决原文见提交 f7ab13bdea1d87171939a8e637cd92b3e348be5b,本枚只是把它重新落地并留可追责意图记录(safe-commit 因窗口期内有他席新件拒发普通提交,按它给的出口走对象空间档,只交声明集) (97150355ae)
- 📚 Docs:移动端走查根因挖到构建配置 —— HEAD「开 optimizeMainPackage + 摘 common 名」使 app 入口等 25 个 chunk(其中 23 个独立 NNNNN.js 从未被加载),App() 永不执行、getApp() 恒 false(入口探针无抛错);对照构建关下沉+保留 common 名后 getApp()=true 且开始发 wx.request,但主包超硬上限 137,388B;反向组合构建中止(SplitChunksPlugin 同名冲突)。三选一修法与取证见 .ihui-agent/tmp/mobile-walk/DIAGNOSIS-2026-10-31.md;实验改动已还原 (0378c4b6cc)
- 🐞 Fix:R12 同族收口 —— 调度 webhook 与 A2A 派发补 SSRF 钉 IP、agent 注册归属、连接器写面诚实失败 (714948f4b8)
- 🐞 Fix:给 web 的 tsc 程序接上 nativewind 类型增强 —— 修好 next build 在 ui-native 上的类型红 (ea6eacbbf9)
- 🔧 Chore/Other:补上被别枚提交卷走的号池任务中心用例 —— HEAD 面实测 1 条红就地结清 (eb7fbad5ae)
- 🐞 Fix:巡检态改观测态 + 手动任务入口补风控预检 + 补签卡写侧装两把机器锁 (0cc3259504)
- 🚀 Feature/Improvement:能力矩阵认得 settings 族默认关开关 —— 加 J4 覆盖面并登记 5 行 (97083bca8f)
- 📚 Docs:T3 §10 修正一处笔误(p 原文 -> prompt 原文)—— 纯文案,无判据变化。 (b740cc303d)
- ♻️ Refactor:字号任意值落档 620 处(仅 400 字重档)—— 项目档消费率 53.3%→约 62% (3a42b19b63)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (5d49e9fbd6)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (c1cb851e27)
- 📚 Docs:撤掉重复的 R10+R11 goal 注记 —— 保留 12f3cbd 的四条正本,本行内容与 STATE/loop-run-log 重复 (49e83a69d9)
- 🔧 Chore/Other:收编停留≥3分钟的 i18n 未提交改动 (fcd9e5a010)
- 🐞 Fix:补回试点批漏挂的 Tappable import 的另一半 —— 摘掉没用到却挂着的 (908a5ba821)
- 📚 Docs:安全强化 goal R10+R11 结账注记 —— 两批已入库且 origin 同步(b0e506f31b5e) (5215ebf608)
- 📚 Docs:补安全强化 R8/R9/R10/R11 goal 结账注记 —— HEAD 面纯追加 4 行,不带工作区他席在飞行 (12f3cbd383)
- 🐞 Fix:dev-stack 常驻链定 pipe 为默认形态并把注册结果判据修对 —— 旧判据只认 LAST=0,而 ExecutionTimeLimit=0 的常驻任务回读到的正是 SCHED_S_TASK_RUNNING(267009),于是每次成功注册都被打成失败:照文档敲 autostart 的人看见假错,watchdog 自愈腿按非零退出记 repair-failed 永远收不到成功、每 2 分钟重装并顺手杀掉在跑的守护;现按 0/267009 判成功、读不到形状走 exit 2 不冒绿(§0.3)。本机实测 IHUI-DevStack 与 IHUI-DevStackWatchdog 双任务已落 S4U + 系统 node(不再挂第三方 IDE 捆绑的 node 目录),守护自起 8801/8802/8806/8807 并续写心跳;镜像 install 6 例、launcher 26 例 (91dcc16835)
- 📚 Docs:T3 增 §11 残余四条复判 —— jti 防重放纠正为假缺口，关卡41已消，壳层与持久层维持原判并附复跑入口 (1638812845)
- 🐞 Fix:号池队列换库必换队列,并把队列名分隔符从冒号改成连字符 —— BullMQ QueueBase 对名字里的冒号直接抛,旧形态让隔离栈 API 崩在 worker 启动那一步(本机实测);登记守门276(warn 起步,存量假阳未清不升档)+ 镜像13例 + 单测24例含不变量;门体正文改走取材层 catBatch/readWorktreeFile;新增 docs/RELAY_QUEUE_DB_ISOLATION.md 立「队列属于数据库」;immutable-exempt: 本次是新增门的注册条目与 onFailHint 措辞同步并接正取材层,未削弱任何既有判据 (522584b7ff)
- 🚀 Feature/Improvement:按压反馈重铺 72 文件 220 枚 —— className 走 active 变体、原生走 Tappable (35868ba148)
- 📚 Docs:守门 276 补进「守门脚本点名索引」的号池队列隔离行 —— 门 89 R4 义务(已接线门必须被文档点名) (da510dd9a4)
- 🚀 Feature/Improvement:Qoder 会话回灌装成用户态计划任务 —— 服务身份 LocalSystem 读不到 DPAPI,本机号一直静默脱池 (fdc24da553)
- 🐞 Fix:残余 7 例逐例定性落地 —— 5 例测试腐烂/环境配置按新 IA 重钉,1 例拆开同帧耦合 (8ed1fbddf3)
- 🐞 Fix:派单腿指向本机真实 CLI 入口 + 白名单补 deploy-feedback (34402556a8)
- 🐞 Fix:mcp_server SSRF 批的收尾 —— mypy 类型收窄 + webhook 测试支撑(安全强化第 32 批) (24c4c72b23)
- 🚀 Feature/Improvement:advisor_consult 顾问模型工具(G-11 协议层收尾)—— 指定另一个模型就子问题作答,带会话级次数预算与模型名 fail-closed。 (ace8fec86b)
- 🚀 Feature/Improvement:钩子唤醒腿宿主接线真正入库 —— REPL 会话队列接管 async 钩子 exit2 回灌 (6a6f388253)
- 🐞 Fix:/api/admin/news 根因收口 —— 删除直连 8803 的 rewrite,status 经 apps/api 代理(安全强化第 31 批) (ab5417bdbf)
- 🐞 Fix:R11 收口 —— A2A 注册鉴权+SSRF、连接器密钥失败封闭、MCP 四处下载 SSRF、web/miniapp 三处信任边界 (548fb0c55c)
- 🐞 Fix:上传/认证/金额面 9 项收口(安全强化第 31 批/R10) —— 5 P0(账号接管·同源 XSS·平台币越权·造币·2FA 绕过)+4 P1,98 用例全绿,变异验证通过 (c6e20569d8)
- 🚀 Feature/Improvement:计划执行工厂补回 hook_runtime 与指令片段声明面两参 —— 与第 27 批归属收口同面归并 (6747dfe947)
- 🐞 Fix:Eval 数据集删除加归属 —— 任何登录用户不再能删别人的数据集(安全强化第 30 批) (652deeef9a)
- ♻️ Refactor:尺寸/定位属性与内联 style 的等值落档 —— 项目档消费率 50%→53.3% (0509c5a60f)
- 🚀 Feature/Improvement:守门 273 的遮罩档接上第二跳 —— styles.KEY → 命名 token，现读消掉 28 枚误判 (5213aee5cd)
- 🔧 Chore/Other:删掉与 url-protocols 同值的死副本 fetch-protocols —— 协议表只留一份(§0.6) (f7ab13bdea)
- 🐞 Fix:大屏 firing 扩散面契约改锁消息源 —— 文案键由并席补齐后旧断言恒红 (0c16a2c593)
- 🐞 Fix:browser/render 补 SSRF 两道闸 —— 内网/云元数据不再可被读走(安全强化第 29 批) (bff588c7f4)
- 🐞 Fix:协议白名单拆出零 Node 内建的 url-protocols —— 止住扩展/web 构建阻断(node:dns 进浏览器包) (e95ff27a1e)
- 🐞 Fix:/api/admin/news 写面加发布权限 —— 认证≠授权,普通登录用户不再能发布内容(安全强化第 28 批) (455399b0b0)
- 🐞 Fix:agent-plan 计划归属收口 —— 他人计划不可读/不可改/不可批准执行(安全强化第 27 批) (7d35755a04)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (0147b013b9)
- 🚀 Feature/Improvement:守门 273 的遮罩证据认得命名 token —— 名单按被审面现读，不抄颜色表 (5d09fcb928)
- 🚀 Feature/Improvement:补齐第三批 —— 指令片段声明面 + TodoWrite 五态 + 编辑器态共享腿 (906a4ab47b)
- 🐞 Fix:监控子页改回并席单源实现 —— 撤回本席重复词表与假筛选(裁决保留 c2ecfaee13) (e26a046983)
- 🚀 Feature/Improvement:「自动做任务」补齐移动端与小程序 —— 三端同能力、同口径 (3275ed6ee0)
- 🐞 Fix:补回试点批漏挂的 Tappable import —— 消掉我上一枚造出的 TS2304 (9d179377e4)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (6f8add3e37)
- 🐞 Fix:langgraph 线程归属落库 —— 重启后不再凭 threadId 读走他人 graphState(安全强化第 26 批) (6576cd2331)
- 🚀 Feature/Improvement:按压反馈重铺试点 4 文件 20 枚 —— AST 定位，className 走 active 变体、原生走 Tappable (6595be65c1)
- ♻️ Refactor:CSS font-size 等值落档 761 处 + 修档名 kebab 转换 —— 项目档消费率 36.5%→50% (4af1d20018)
- 🔧 Chore/Other:补两枚 web 组件溯源水印 —— 清 HEAD 面欠账(门 47) (422364d6f5)
- 🔧 Chore/Other:probe (fb5aa7785f)
- 🐞 Fix:转换器符号表不再跨 import 吞并 —— 首个具名符号曾整枚丢失 (9daba5c203)
- 🐞 Fix:stdio 导出在生产档可用 —— 用"本进程是否 stdio 通道"的代码标记区分,scope 按第三方尺度收紧 (78591eefac)
- 🚀 Feature/Improvement:web 端字号统一器物入库(未落盘)—— 取证到 font-weight 反例,只证得 29.7% 恒等 (9f3d81735b)
- 🐞 Fix:测试进程 env 差异回滚 + 工作区根"空值回落 cwd"口径对齐 —— 三条并发红根治,并修一条生产真缺陷 (0a3246a9c5)
- 🔧 Chore/Other:删除 press-feedback.ts 定义体 —— 出口与调用点均已清零 (5c9c2bdccb)
- 🔧 Chore/Other:补 Tappable 行为锁的类型收口 —— tests/tappable-press-feedback.test.tsx tsc 归零 (11a69d590c)
- ♻️ Refactor:补交上一枚漏落的 1122 处 CSS 落档 + 新增 99 处字号落档(有 leading 覆盖) (74dba938c1)
- 🚀 Feature/Improvement:自动做任务的可观测性闭环 —— 巡检态上界面、上回执、上文档 (ff8d6db683)
- 🐞 Fix:分佣计划接真值 + 转换器端点判据补两型 + 样式三项同档 (45f7859e9f)
- 🚀 Feature/Improvement:守门 131 补 F2（helper 调用型函数形态）+ Tappable 行为锁 + 删除 press-feedback (bf01184e73)
- 🔧 Chore/Other:收编停留≥3分钟的 i18n 未提交改动 (933bef1e8f)
- 🐞 Fix:撤完最后 34 处 pressFeedback 函数形态 —— RN 侧样式丢失缺陷从 HEAD 清零 (63f19b7e15)
- 🐞 Fix:SSE 端点 CORS 凭证绕过收口 —— 回显 Origin 前过 evaluateOriginAllowance 同一判据(R10 第 25 批) (f8aeac6cf6)
- 🐞 Fix:SSO state 接入剩余两端(安全强化第 23/24 批) (f994dbcd9d)
- 🔧 Chore/Other:5 个 RN 屏整文件 prettier 规范化 —— 零语义改动，为撤除铺路 (6b2d46787c)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (d86f3400ea)
- 🔧 Chore/Other:小程序派生语言包按源重建 —— 结清唯一红例(i18n-on-demand 大小写) (21c0a6dfb2)
- 🐞 Fix:把 ALLOWED_FETCH_PROTOCOLS 迁出带 node:dns 的 ssrf-guard —— 修好 @ihui/extension 构建红(它在堵整条部署链) (a748e7aaea)
- 🐞 Fix:撤完剩余 102 处 pressFeedback 函数形态 —— 10 文件，RN 侧样式丢失缺陷清零 (d00f772fa9)
- ♻️ Refactor:删掉与已入库门 268 重复的词表尺子 —— 单一真相源(§0.6) (5734ff5b0c)
- 🐞 Fix:zh-TW 分佣空态用繁体「傭」 —— 门 2j-shared 简体残留当场结清 (bafa544b0f)
- 🐞 Fix:ja 分佣空态改日文原词 —— 门 2d/2o 简体字残留当场结清 (94561eea1a)
- 🐞 Fix:补落九格对齐所需词条 —— 首落清单漏掉的 shared/web 十份语言包 (452770251e)
- 🐞 Fix:git filter 残留巡检 + 两腿裸 logger 未定义 —— 前者防 Qoder 因 filter.lfs 配置跳过 git 状态采集（本机零 LFS 仓库，复发通道 = git lfs install 或 Git 升级）；后者 13 处 ReferenceError 会在 tick 到期时中断其后全部巡检 (36309f00fc)
- 🐞 Fix:补响应式 max-w 变体兜底 —— web 端 max-w 的主要用法是 sm:/min-[640px]: 变体(77 处) (e9b868fafb)
- 🔧 Chore/Other:回退过宽的 stdio 本地主体改动 —— 它把"按主体收紧工具/资源"的语义冲掉了 (ec57af2dd9)
- 🔧 Chore/Other:再摘第五次回潮的 mirror-to-cn.yml —— 退役清单装车 15 分钟就咬住它 (2bbfc34a5f)
- 🚀 Feature/Improvement:九格能力对齐 —— about 三屏/模型备案/考试答题/分佣真值/权益卡/实名徽标/聊天视频/消息中心 (62b61b5816)
- 🐞 Fix:Tappable 的 style 只收 StyleProp<ViewStyle)，拒绝函数形态 (497a5cbe53)
- 🔧 Chore/Other:收编停留≥3分钟的 i18n 未提交改动 (25f8df77e6)
- 📚 Docs:移动端走查记取证进展 —— 白屏定位到小程序代码侧(非 IDE):同机最小项目同窗口正常渲染;IHUI 项目生命周期全触发但 getApp() 恒 false、page.data 仅 __webviewId__、零 wx.request,按当前源码重建 dist 后不变;config ui-native 回归已按 HEAD 恢复。取证/下一步见 .ihui-agent/tmp/mobile-walk/DIAGNOSIS-2026-10-31.md (7a3308fed3)
- 🔧 Chore/Other:放弃与远端重复的语言包改动 —— 同一批键已由并发会话入库,以远端为准 (4cfa74a9e6)
- 🚀 Feature/Improvement:Tappable 入库并接进守门 273 射程 —— 按压反馈改由组件内部持有 pressed (acc16e5109)
- 🔧 Chore/Other:预置 advisor_consult 功能名(五语言)+ 重生成离线包 —— 顾问模型工具(协议层扩展)落地前的展示名先就位:TOOL_DISPLAY_KEYS 加 advisor_consult -> toolAdvisorConsult,五语言 taskStatus 同批;小程序 generated 三件与 assets 四件由 pnpm gen:i18n 唯一产出(派生件,pin 行随源变化属设计)。验证:tool-display-resolvable 工作树面 139 功能名 + 29 措辞键共 5596 项全解析、tool-name-coverage 104/104、shared 类型检查此前 4/4 绿。 (6fd18ae83f)
- 🔧 Chore/Other:清偿两枚入库测试的水印欠账 —— HEAD 面缺口由本枚销账 (14408f98b7)
- 🔧 Chore/Other:重生成 ui-routes 自述钉 —— 跟随 admin 监控三页与漏斗页的页面变更 (199e2e7d76)
- 🚀 Feature/Improvement:签到页新增「自动做任务」面板(WorkBuddy 任务中心六族一键巡检) (c9f451476b)
- 🐞 Fix:任务中心三处生产级缺陷 —— activity body 驼峰/毫秒、claim 令牌域兜底、travel 日限假失败 (c53fd669c7)
- 🐞 Fix:补 4 处派生漏窗 windowsHide —— 第二批落地复跑抓到的 HEAD 面存量就地结清 (e8c51efd20)
- 🐞 Fix:两键改用嵌套形态 —— 上一枚写成了扁平 "a.b" 键,门 2 当场判形态违规 (bbf56c0740)
- 🐞 Fix:修三处 --spacing-<name> 与 Tailwind 命名空间撞名 —— max-w-* 宽度塌缩 / leading-none 行高 0 / max-h-none (ee1cc0e002)
- 🔧 Chore/Other:小程序离线语言包按新 HEAD 重生成 —— 承接上一枚(工具族注册 + 12 枚功能名 + 3 个被覆盖键);7 个派生件由 pnpm gen:i18n 唯一产出,sourceCommit/inputsSha256/payload 行按设计随源变化;核对:tool-display-resolvable 工作树面 5562 项全解析、i18n parity 19823 键×5 语言 OK、四个 b64 与三份 gen 均由生成器写入且带水印。 (b19be834eb)
- 🐞 Fix:补齐 chat.message.metadataLoading / metadataUnavailable —— HEAD 缺键让门 2 恒红 (61d0898480)
- 🔧 Chore/Other:第二批摘净复活的退役件 4 枚 —— 退役清单同批补到 10 条 (e8e9799518)
- 🐞 Fix:SSO 登录接入 state 绑定(安全强化第 22 批) (f8ede75d16)
- 🐞 Fix:代码导航/记忆两族工具活过 setupAgentTools + 12 枚功能名补齐 —— setupAgentTools 首行 clearTools() 会抹掉 tools/index.ts 顶层副作用注册的 LSP(8 枚)/MEMORY(4 枚),静态门 check-tool-family-registered 看不见这一型;改为在 setup 内显式注册,并新增系统级回归(每族每枚必须活过 setup,摘掉任一族即红)。同批:12 枚工具补 TOOL_DISPLAY_KEYS + 五语言 taskStatus。 (88e3aeb31b)
- 🐞 Fix:@theme 改 static —— 修好 1122 处落档里 8 个变量在产物中不存在 (14e33882da)
- 🐞 Fix:stdio 导出在生产档恒被拒(功能死) —— 本地宿主主体 + 五语言推理强度新档补齐 (9e1c8daacb)
- 🐞 Fix:撤除 pressFeedback 的函数形态 style —— 66 文件 / 149 处，它会让整份内联样式消失 (aee81f70f9)
- 🚀 Feature/Improvement:监控告警词表单一真源尺子(守护巡检档,不进提交链) (3e94c1fa67)
- 🐞 Fix:三档随第 14 批契约归位 —— hook 模板 allow_script / checkin 时间炸弹 / 读资源主体 (609effa305)
- 📚 Docs:结清两张票 —— 门173 行级棘轮落地(README 可改) + admin 监控崩溃族五点收口 (8139f158a9)
- 🐞 Fix:守门 268 撞号改 275 —— 268 已被 PROJECT_PLAN 回捞件差值棘轮占用 (d2ea105402)
- 🐞 Fix:SSO 回调绑 state —— 堵住"谁先投码谁赢"的登录 CSRF(安全强化第 21 批·shared/web/cli) (ad3f814766)
- 🚀 Feature/Improvement:小程序非色档尺 + 等值落档器 —— 项目档消费率 14.8%→34.6%(1122 处) (4f7c361ca2)
- 🚀 Feature/Improvement:守门 268 监控告警词表同值副本 —— canonical 落 packages/types 后的机器牙 (629471c664)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (c702c12298)
- 🐞 Fix:漏斗页改读真漏斗数据 + 摘掉占位假路由(它把告警 id 当业务维度) (c86f57edf3)
- 🐞 Fix:redeem/lottery 写侧补齐 —— body 字段真机实证 + 自动兑换/抽完闭环 (6b11d66228)
- 🔧 Chore/Other:收编停留≥3分钟的 i18n 未提交改动 (49c3ecd38e)
- 🐞 Fix:本站凭据只发往本站域集合 —— 共享层根治"代持凭据请求任意域"(安全强化第 20 批) (87e26cfc2a)
- 🔧 Chore/Other:补钩子宿主唤醒接线用例 —— repl 会话队列接管 async 钩子 exit2 回灌 (ed6d8c0ee4)
- 🐞 Fix:admin 监控三页契约对齐 —— 崩表根因(裸取 Record)收口 + 假读数改未判定 (b10635ddab)
- 🐞 Fix:监控子页崩溃族收口 —— 词表单一真相源 + 真漏斗 + 真实读数 (c2ecfaee13)
- 🐞 Fix:HelpScreenProps 三个受控搜索字段被旧基线覆盖吞掉 —— 恢复 HEAD 已入库定义 (7b8c0c682d)
- 🔧 Chore/Other:relay-pool-policy.test.ts 补溯源水印 —— 该测试随外部提交 5f225a3e42(preferLowCredit)入库时未带载荷,HEAD 面欠账由 watermark list-uncovered 现读点名;inject 后 verify 1/1 完整(残迹/损坏/仅隐写 0),判据面=工作树显式点名。仅末行不可见载荷,测试内容零改动。 (148c0991e3)
- 🐞 Fix:四档随 workspace 闸 / rg 缺失归位 —— checkpoint 读回滚、后台任务 test_suite、护栏对账 (616403dbb2)
- 🔧 Chore/Other:清除失效 LFS 过滤规则 —— 7 条规则指向的 client/ server/ 路径在 HEAD 中已不存在、git lfs ls-files 为 0；LFS content filter 使客户端跳过工作树状态采集 (d0812f6a70)
- 🐞 Fix:image_search 工具描述补 trust 分档语义 —— 可信度分档落地后模型消费方看不见字段用途,补一行描述(tier/score/reasons、按 score 降序、unsafe 在 message 点名);验证:test_tool_registry_single_source_v47 + test_image_search + test_image_search_trust 39/39 绿,watermark verify 水印完整 (af7d9995a8)
- 🐞 Fix:Gitee 汇总如实写「未落地」—— 不许把降档后的 outcome=success 渲染成镜像成功 (8b7552f55e)
- 🚀 Feature/Improvement:补齐 qoder/trae 对照缺口四件 —— 钩子三档真派发 + 会话寻址投递 + 编辑前脏判定接线 + Notebook 单元格编辑 (0e3ad01c29)
- 🐞 Fix:pytest 临时目录从盘根迁到批准落点 DevEnv/Temp —— 盘根写入 + 可能干扰"仓库外"判据 (67d348dd9c)
- 🐞 Fix:门173 staged 档改行级差值棘轮 —— README 从「不可改」解锁 (57a496310a)
- 🚀 Feature/Improvement:补 toolSendToSession 五语言显示名 —— 会话寻址投递工具的本地化功能名 (13d6334654)
- 🐞 Fix:收编器 scope 死锁根治 —— i18n 单独成枚 + 无 scope 聚合 (76c7880c73)
- 📚 Docs:.env.example 补 IHUI_RELAY_POOL_PREFER_LOW_CREDIT 钮位(配对 preferLowCredit 落地) (5d60287164)
- 📚 Docs:Y-14 记 agent 侧进展 —— 结构性根因已封死入库(03a3a4af85):publish-mobile-apk.mjs 在 verifySiteLegLive 后接 publishRegisterStep(!ok⇒return 1),发布链现在必然登记 app_versions;无凭据一腿不发、stderr 点名 DATABASE_URL/IHUI_ADMIN_TOKEN 与唯一可复制命令、main exit 1;W1–W8 八例 + 五套关联 63/63 全绿。本机 DATABASE_URL 现读 localhost:5432/ihui(非生产);0.0.9/26102816 latest 行登记动作使用生产凭据或管理员 JWT。 (fd6091ee6b)
- 🚀 Feature/Improvement:逐字回潮尺子补「退役清单」第二维 —— 窗口档够不着的回潮从此有人喊 (21426b22af)
- 🚀 Feature/Improvement:relay 选号新增 preferLowCredit(积分紧迫轮换,默认 off) (5f225a3e42)
- 🐞 Fix:Gitee 镜像配额超限不再判红 + 调度降频到 2h —— 被拒包仍计入体积,重试本身在加重 (f119b0bbb4)
- 📚 Docs:结清 B53(deploy-feedback) —— 票源取证为联测构造记录而非生产故障:.ihui-agent/deploy-decisions.jsonl 唯一行 reason 原文「联测构造记录:本机无生产部署决策账,以本仓当前 HEAD 模拟一次整份回滚,用于端到端反馈闭环演练」(sha=990160a00c4651e7c1e6572e19433027da85a8c3, action=rollback, gateVerdict=fail, failDims=web+llm);同刻 incident-signals 与 deploy-feedback-ledger 三账逐字对齐(dry-run→undetermined→registered B53),感知→建单两跳已在真账上跑通,无真实生产对象可修。派单/修复/部署/裁决四跳归「端到端反馈闭环」主票。 (8aeece108d)
- 🚀 Feature/Improvement:再清 24 处按压反馈 —— 20 文件；改稿器 v6 补上「无 style 元素」与 prettier 收口 (4a1e536ce9)
- 🚀 Feature/Improvement:任务中心补齐族五/六 redeem(连签兑换)+ lottery(抽奖) (d90f1d9e8c)
- 📚 Docs:结清 D16 Agent SDK 对外开放 —— @ihui-ai/sdk@0.1.0 已在 npm registry 可见(npm view version=0.1.0、dist-tags.latest=0.1.0;run 41185016746 日志 published via OIDC provenance、sigstore logIndex=3612314245)。该 run 唯一失败点是回读轮询 12×10s=120s 短于 registry 传播时间(包实际已发布),缺陷已由 80838a0e70 修复(npm/PyPI 两条回读循环 12→36 轮=360s,超时文案补「本步失败不等于未发布」)。tag sdk-v0.1.0 刻意不推:push 事件无 language 入参⇒gate 缺省 all⇒现读缺 PYPI_TOKEN/MAVEN_USERNAME/MAVEN_TOKEN/NUGET_API_KEY 四项会整轮判红并重复发布 0.1.0(EPUBLISHCONFLICT);对外发布事实以 npm registry + sigstore 为准。其余四通道 blocker 见 config/sdk-release-channels.json 归属机主。 (3b5e4d2601)
- 🐞 Fix:两档随生产结构/闸位归位 —— app 解包链穿两层 + 商店安装的工作区白名单 (99b76f6c18)
- 🔧 Chore/Other:摘净逐字复活的 6 枚退役件 —— 复原机主弃用令与三次退役裁决 (adc64aeb6f)
- 🐞 Fix:扩展 navigate 同尺接线 + 导航守卫去掉归一化副作用(安全强化第 22 批) (46b733345c)
- 🐞 Fix:knowledge 工作区闸 / 索引器 G7 回落语义 两族随生产契约归位 (f0bfa8dfc0)
- 🐞 Fix:图片保存族随 R6 下载链归位 —— 假响应/假客户端补契约 + DNS 面用桩 (0afd9ed5eb)
- 🐞 Fix:浏览器导航协议白名单(单一真相源)—— 堵 file:// 本地任意文件读链(安全强化第 21 批) (1397353dad)
- 🐞 Fix:mypy HEAD 面 1 error 挡住全队提交 —— DEFAULT_TIMEOUT 改显式再导出 (d3db932243)
- 🐞 Fix:CLI 工作区 mcp.json 默认不信任 + 敏感键收全局层 + 0600 + ref 校验(安全强化第 20 批) (08bd94c1ad)
- 🐞 Fix:回调链路六档 + 媒体两档随生产契约归位 —— 目标白名单同源 / 假客户端补 extensions (f8d3dee39d)
- 🚀 Feature/Improvement:任务中心巡检新增按积分紧迫度轮换(可选,默认 off) (5671f4ba7e)
- 🐞 Fix:三族测试随生产契约归位 —— 管理员闸 / rg 缺失不冒红 / wiki 工作区登记闸 (fa917e2065)
- 🔧 Chore/Other:去除 workbuddy_tasks 冗余前向引用引号(ruff UP037),CI 门禁转绿 (e18c916dae)
- 🚀 Feature/Improvement:任务中心四族自动化补齐 claim Web 域 + 上报→重判→claim 闭环 + activity 指纹头 (O68) (1e619dbc49)
- 📚 Docs:逆向取证(Cfs/Trae/Qoder)+archify架构图(b41/b42/b43)收口 (8b9953e6ef)
- 🚀 Feature/Improvement:断点续跑加定义摘要 + 图搜来源可信度分档 + 装机资产安装副本对账 (39366dc12d)
- 🚀 Feature/Improvement:监控告警两条封闭词表的唯一份 —— 终结三套并存的崩溃族 (0d1c4ff9c2)
- 🐞 Fix:四族测试随生产契约归位 + sandbox_metrics 身份判据漏收纯数字(时间戳会变成时序标签) (28337f077b)
- 🐞 Fix:release-sdk 发布后回读窗口 120s→360s —— 实测枚 41185016746 的 npm publish 已成功(日志 published via OIDC provenance + provenance 已上 sigstore 透明日志 logIndex=3612314245),但回读只轮询 12×10s=120s 短于 registry 传播时间 ⇒ job 判红而包实际已可见(npm view @ihui-ai/sdk version = 0.1.0)。npm 与 PyPI 两条回读循环同批 12→36 轮;超时文案补一句本步失败不等于未发布、先人工回读再决定是否重跑(判红语义不变,不用「命令没报错」当结论) (80838a0e70)
- 🐞 Fix:Python 验收面从"整轮不可判"恢复到可判 —— 跑测器 106MB 输出撑爆缓冲 + conftest 建栈只建了根节点 (8313fa33e8)
- 🐞 Fix:pressFeedback 返回类型与 RN 0.86 对齐 —— 止住 packages/app 35 条 TS2322 (445250bd01)
- 🐞 Fix:支付 orderType=6 金额服务端反查 + 弹幕转义单出口 + WS 展示身份服务端取材(安全强化第 19 批) (77c9293d64)
- 🚀 Feature/Improvement:非色档进小程序 @theme 注册区 —— 拿到 p-md/text-body/shadow-elevation-* 语义类 (f5db1221ae)
- 🚀 Feature/Improvement:批量补 91 处按压反馈 —— 55 个 RN 屏/组件统一走 pressFeedback() (47f23a4fc9)
- 🐞 Fix:api.proxy 只认站内相对路径 —— 阻断"后台带本站凭据请求任意域"(安全强化第 19 批) (7f3ffa9b0b)
- 🐞 Fix:一键切号启动自动清理同账号冗余快照,杜绝 0269 重复刷屏复发 (72348466a3)
- 🐞 Fix:安全强化第 10 批 R9 第二轮确认修复 —— R8 修复面的轻量独立复评三枚收口 —— ① N1 中高:沙箱文件闸对  前缀参数一刀切跳过,GNU 组合长选项(cp x --target-directory=/外、tar --file=/外)与短选项粘值(grep -f/etc/passwd)的路径 operands 曾全量漏网 —— 取值规则重写:--flag=value 取 = 右侧、-f/-C 路径型短选项取后缀、纯旗标跳过、裸路径照查(全部进 looksLikePath+isInsideRoot);② N2 低:db_query 的 LIMIT 探针可被块注释 /* LIMIT */ 或字符串字面量 '%LIMIT%' 欺骗致全量物化 —— 改无条件外层包裹 SELECT * FROM (sql) _ihui_limited_query LIMIT n(剥尾行注释后包,外层 LIMIT 恒在且与内层 LIMIT/ORDER BY/WITH 合法共存,判断面归零);③ N3 装饰:docker 壳三处 location(_next/static、@rate_limited、/apk)补回 CSP(add_header 断继承,与蓝绿侧口径对齐)。测试:sandbox containment 13/13(新增 N1 组合长选项/短粘值两枚拒绝+纯旗标正向),六套安全测试 42/42,mypy 单文件+全量零错误。复评确认:WAF 合法正则字节级 PASS、F1 闸①③ PASS、发现1-5 全 PASS、A2/B1/B3 PASS —— R8 修复面第二轮独立确认除上述三枚外无新真漏洞。rdp/ssh 机主处置跟踪:DNS 现读 rdp/ssh.aizhs.top 仍解析(CF 边缘)= 未处置,72h 邮件窗内(请示发出约 5h),未到升级重发时点。 (f9494a90cb)
- 🚀 Feature/Improvement:五屏再清 22 处按压反馈 —— VoiceNote/NotesPanel/BusinessFormSheet/ScanLogin/AiAssistantN8n (a74b1e1a1b)
- 🐞 Fix:转换器②端点判据补 api-client 符号解析 —— 止住"封装藏端点"的假拒 (8eaafcbd3c)
- 🐞 Fix:门 41 给机器人 PR 分支单列豁免类 —— 不再把 dependabot 分支当"人类旁支滞留"判红 (e5a0de6c58)
- 🚀 Feature/Improvement:RN 落档自愈轮 —— 30 分钟补落被并发洗掉的工作树改动,落库交给 auto-commit-quiet (a44d8de29f)
- 🐞 Fix:#5 长任务采集面更正——旧带归因=0 是结构性误读 —— Long Tasks 的 attribution.containerSrc 只在 iframe/frame/embed/object 容器上才有值,顶层窗口 containerType 恒 window 且 containerSrc 恒空(W3C 规范)⇒ 旧读数量的其实是有没有 iframe,既不能证明采集坏也不能证明长任务来自哪段代码。改为并存两个 sink:长任务计数仍走 longtask(断言与阈值一字未动),脚本级归因走 LoAF(Chrome 123+,每条长帧自带 scripts 的 sourceURL/invoker/invokerType/duration),LoAF 只读数不参与断言、取不到即报未判定不冒充 0 (e905da283a)
- ♻️ Refactor:间距裸数字等值落档 314 文件 —— 跟随率 64.2%→85.2%,器物 land-rn-style-tiers (6a25fb4b03)
- 🚀 Feature/Improvement:五屏再清 18 处按压反馈 —— CircleIndex/Cart/ChatDisclosure/HandPlatePops/BusinessFormSheet (a6fdaec2b1)
- 🐞 Fix:Y-14 根因封死——发布链现在必然登记 app_versions —— publish-mobile-apk.mjs:351 在公网自证 verifySiteLegLive 之后接 publishRegisterStep(!step.ok ⇒ return 1),登记腿函数组 :182-262,非法参数在落包前 fail-fast(:307 exit 2);选腿按发布进程实能拿到啥:DATABASE_URL ⇒ db 腿优先,否则 IHUI_ADMIN_TOKEN ⇒ api 腿,执行全部委托登记器物导出的 applyViaDb/applyViaApi(含写后自证),buildPlan 三态判据零复制零改动(register 侧仅新增 openDbConnection:265 可复用出口)。无凭据行为已证:一腿不发、stderr 点名「未登记/DATABASE_URL/IHUI_ADMIN_TOKEN/唯一可复制命令」三要素、main 以 1 退出(失效方向=多喊一次,绝不静默成功),凭据值零外泄。guardian 侧仅补 auditAppVersionLatest 的裁决注释(按 §5e-1 三条理由判 undetermined 刻意不升喊人,行为零变化)。测试 publish-mobile-apk-register-wiring W1–W8 全绿(含真 applyViaDb+fake 库跑通 create→noop 幂等、plan 与 buildPlan 逐键相等、main 形状锁),五套关联 63/63、node --check 四文件 OK、水印 verify 4/4 (03a3a4af85)
- ♻️ Refactor:间距裸数字落档器上线 —— 等值改写为 rnSpacing 引用,跟随率 64.2%→85.2%(批 2/4) (6b94d67bbb)
- 🚀 Feature/Improvement:接线图片原图降级 + SSE 断流续传去第二份真相 (b4a47c190d)
- 🔧 Chore/Other:门 173 差值棘轮补 T11 装车锁 —— 摘掉裁决路径的调用必须翻红 (10a4048022)
- 🚀 Feature/Improvement:五屏再清 35 处按压反馈 —— Drawer/PlazaScreen/ImageAnnotator/ImagePreviewModal/ToolApprovalSheet (162da9d8be)
- 🐞 Fix:安全强化第 10 批 R8 复评修复二批收尾 —— ① 发现4(R6 引入的可用性回归):media_tasks._send_following_redirects 钉 IP 后缺 sni_hostname 扩展,TLS server_hostname 取 URL host(IP)⇒ 域名证书 hostname mismatch,download/stream/image/upload 四端点对全部 https 源站握手失败 502 —— build_request 补 extensions 对齐 mcp_server 版本;② r3 回归锁 FakeClient 签名跟上 extensions。六套安全测试 42/42 全绿,mypy 672 零错误。本枚经 LAND_ALLOW_STALE 显式放行:media_tasks 的 sni 行在历史(第 14 批媒体上传逐跳版本)出现过后被重写删除,现重加属有意的同语义修复;diff 共 8+10 行已逐行核验,非滞后回退 (192af74a40)
- 🚀 Feature/Improvement:前向重放 —— 四屏 54 处按压反馈 + pressFeedback 兼容函数型 style(仅本票路径) (0a3793b4a1)
- 🔧 Chore/Other:p2 (6c464cd3dd)
- 🚀 Feature/Improvement:共享帮助屏补搜索 —— RN 端对齐 web 帮助页的搜索能力 (85ba2a6a35)
- 🔧 Chore/Other:p1 (21b4ea6024)
- 🐞 Fix:pressFeedback 兼容函数型 style —— 修掉上一枚引入的 TS2345(两处 Pressable) (f7751be0d3)
- 🔧 Chore/Other:probe-fix1 (69cfebd322)
- 📚 Docs:三条登记席实测进展(均保持未勾) —— G-20 补齐主通道失败不降级这一真缺陷并留机主资质七步;反馈闭环本机真账首次串通感知→建单两跳并修两处取号/票号断点;移动端走查窗口链路已全通但四路由白屏,同批修掉 press-feedback 被删与 ui-native 未进 compile.include 两层真因 (ae1b5bf442)
- 📚 Docs:四条按席取证结清 —— 部署健康门禁(取证面三缺陷已修 a328eb127e5/判定面未动)、门250 自动补测(rule⑤+三份真测/缺口3864→3845)、O67(构建已恢复+reason 带原文已入库)、G-86(票面前提失效:101 后应用层 close 非通道故障) (b48c877bec)
- 🐞 Fix:安全强化第 10 批 R8 复评修复二批(基础设施面)—— ① A1 P0:docker 壳 WAF 反斜杠正则改合法 PCRE(与 00-waf.conf 同批修,折叠后尾随裸反斜杠曾致 pcre_compile 必败 = web 容器启动即崩,经 Dockerfile.web COPY 落 default.conf);② A2:三处 location(_next/static 自托管 JS 主出口、@rate_limited 429 错误体、/apk)的 add_header 覆盖继承缺口补回安全头;③ B1 P2:可观测性栈 7 处端口映射绑 127.0.0.1(此前 0.0.0.0:Jaeger UI 无鉴权看全链路 trace、Prometheus --web.enable-lifecycle 可远程 reload/quit)+ 摘该旗;④ B3 P2:Tauri 签名私钥不再以 artifact 发布(24h 窗口协作者可下载签发恶意更新包),只落 runner 临时文件随 job 销毁,summary 步骤提示同步改;⑤ 静态验证:模拟 ngx_conf_read_token 折叠规则确认折叠后无尾随裸反斜杠(PCRE 合法),本机无 nginx/docker 二进制 nginx -t 判定不可得如实记录 (d72f60ea8c)
- 🔧 Chore/Other:probe (d7a821aee7)
- 🚀 Feature/Improvement:门 250 判据补 rule ⑤ 并真补三测 —— 判据层新增⑤:①③④ 的名字维认 x.<限定词>.test.*(如 billing-queries.real),但必须**证明测试正文真 import 了该模块**(证据维);19 枚候选里 16 枚有 import 消掉、3 枚只是复刻逻辑或 import 别的 barrel 被挡回。抽样 46 枚(8 桶)复核假缺口≈0.4%,无更多可安全收窄项。读数:缺口 3864→3848(收窄)→3845(补测后),新增恒 0。真补三份测试(骨架→真断言):biz-day(5)/protected-paths(4)/token-estimate(5),14 例全绿。self-test 39/39、镜像 14+24 pass、autofill self-test 39 例、eslint 0。[LAND_ALLOW_STALE 留痕:守卫报'消失 18/重现 152/复活 1'实为本票有意扩展的签名变化 —— testCoreOf 由私有转 export、collectionTestCovers/nestedTestsDirCovers 各加第三参 testText(承载⑤的证据维),三函数在落地版逐一定位在 201/402/443 行,无一行判据被抹;复活那 1 行是祖先同名签名 c3905ac75 的字面巧合] (fd49085b7c)
- 🐞 Fix:README 活性区数字按现算重钉 + 生成块刷新 —— 历史快照区 29981 条刻意不动(差值棘轮接管) (34b9fae929)
- 🐞 Fix:门 173 的 DN2 加差值棘轮 —— 历史快照区只拦本枚带进来的改动,活性区照判 (64e548e5ef)
- 🚀 Feature/Improvement:四屏 75 处按压反馈接唯一口 —— ChatScreen/ModelConfigDialog/HomeScreen/BottomActionBar (b3f204759b)
- 🐞 Fix:WS ticket 双向隔离 + RN deep-link state 绑定 + 黑名单 fail-closed + SSE 行缓冲熔断 + 扩展注入面收窄(安全强化第 18 批) (430e74f08e)
- 🐞 Fix:主通道失败不降级这一真缺陷补齐 —— 原链只在发送前按'配置存在性'选一档、选定后只发一次,auto 档也不含腾讯云(验证码须显式 SMS_PROVIDER=tencent),即票面'已接线'其实不成立;新增 attemptSmsChannels + judgeSmsFailover:仅'云侧明确拒收/未发出'才换下一档,超时与不可解析一律停手(防重复短信),每档各落一行审计、失败行 reason 带 fallback_to= 可 SQL 计数,验证码与通知两条链同时接上;未配置/未批仍 fail-closed(not_configured + 退配额),非静默成功。哨兵 check-sms-channel-health 补降级计数。验证:新测 26 passed、既有短信 9 文件 144 例全绿、tsc --noEmit 无输出、self-test pass9/fail0、现读 unjudged(近24h 尝试=0)RC=2 (6b38151fb6)
- 📚 Docs:登记两张在册票(173×R4×207 三门互锁致 README 不可改;admin 监控子页崩溃族 5 处) (4b88ef9ce7)
- 🚀 Feature/Improvement:根护栏清单自洽性尺子装车 —— 挂守护巡检双执行体,一天两次部署链停摆从此有人喊 (56438062e0)
- 🐞 Fix:安全强化第 10 批 R8 复评修复 —— 独立复评(api/前端两路)发现的 1 高危 1 中危 1 回归 3 加固 —— ① F1 高危:/sandbox/execute 与 /fs/run 的登记根闸只判 cwd 不判命令参数路径,且白名单含 node/python 解释器族 —— 任意登录用户自服务拿 bypass-permissions 后可先 /fs/write 落脚本再执行,等价 RCE(读磁盘 .env 绕过 cleanEnv 环境净化、任意出网)。三道收口:解释器族仅 admin(isAdmin 经路由层 resolveAdminRoleId 透传,错误信息说明原因)、文件操作类(cat/cp/mv/tee/sed 等十九个)参数路径逐个 realpathOrResolve+isInsideRoot(与 FSBridge.resolvePath 同判据)、cwd 强制与 workspacePath 同根(消跨根越过权限梯);② F2 中危:ReDoS 长度闸挡不住短型灾难回溯((a+)+b 七字符对 10KB 输入指数级)—— hasNestedQuantifier 嵌套量词静态检测入运行面兜底(与长度闸互补,存量行不经入库闸);③ D1 回归:share-content 的 safeMediaUrl 无差别套 lists 把「结论如下」类 text 项整条剔除 —— 按 type 分流,text 放行、媒体型过滤;④ O2:ws-bridge 的 Origin:null(沙箱 iframe)不再跳过来源校验(fail-closed 多拒一次);⑤ O4:settings.json 首次落盘统一 writePrivateFile(0600 起);⑥ clipboard_get 加电脑控制闸(读剪贴板是凭据窃取面,clipboard_set 只写保留)。测试:sandbox containment 20/20(新增解释器 admin 两态/参数路径越界+根内正向/同根约束五组),三端 typecheck 零错误。复评结论:R1-R7 修复面全部在位语义正确,scheme 白名单四变体全挡,桌面文件读写/git 通道/内嵌浏览器三处抽查过关。 (827a5336c0)
- 🔧 Chore/Other:api-settings 转壳承载后按同口径移出逐屏采纳锁 (d1ceca1eae)
- 🚀 Feature/Improvement:守门 275 上线 —— 改根护栏绑定的规则文件必须同批重封清单(部署链一天被打死两次) (7f7e53ea9a)
- 🔧 Chore/Other:再次摘除 AGENTS.md 四条与现读事实相反的「结构与守护」重复副本(门 207 体积回预算内) —— 现读三面一致:①[ -d .git ] 为真、②git rev-parse --absolute-git-dir = G:/IHUI-AI/.git、③D:/IHUI-AI-git-repo No such file or directory;被摘四条分别自称 gitfile/28字节gitfile/遗留目录存在,与实测相反,且是同一段落的重复副本(保留 §0 那条 2026-10-31 实测=实体目录 的正确条,规则条款零减)。immutable-exempt: 判据面文档删除与实测矛盾的重复副本,无规则条款减少 (78b465d704)
- 🐞 Fix:undici 同族再收两档 + R7/G7 两枚新契约登记 —— api 全量红档由 12 收到 0(除他人半成品一条) (91e98191f9)
- 📚 Docs:补回被我误摘的票5/D35(长会话分页投影)未勾行 —— 上一枚 00aa9119cd 的干净基线误取了 2fa2b47ca5(该版曾把进展注记误写成结清档而删行),而 5128e3340b 已把原行恢复并附实测进展;本枚从 5128e3340b 逐字取回原行插回 G-20 行之后,内容一字未改。上下文:该票本轮另有实现落地(3f9c7b97df metadata 摘要懒取/失败占位/投影挂载;api 侧投影与 CLI 消费方均在 HEAD),但仍欠生产口径 perf 复测与丢帧复核,故维持未勾 (9ff6645e6a)
- 🐞 Fix:自审两个真缺陷 —— latest 指针并发半截 JSON + set 值摘要跨进程漂移 (44d63dd25a)
- 🐞 Fix:消息路由补来源闸 + token.get 不再外发 refreshToken(安全强化第 18 批) (3dd43d565d)
- 🐞 Fix:健康门禁取证面三处真缺陷 —— ① llm 维 401/404/502/超时在日志里完全同形(fail 分支连日志都不打)⇒ 每轮多输出一行纯 ASCII GATE-DIM web=..api=..llm=..origin=.. 并把原始探测结果记入 LastLlmProbe;② 公网 web 维可能被 EdgeOne 缓存刷绿而源站 fail 被忽略、整轮被误判为通过 ⇒ 新增 Get-GateWebDimension,该情形降为 unknown 并标 GATE-CACHE-BLIND(不据此回滚);③ HealthGateEntryBroken 未在入口归零(同进程第二次调用继承上轮 true)。判定面与回滚判据一字未动:7 场景对照只有'误判为通过'那格从 pass 变 pass-unproven。新增 deploy/win/tests/health-gate-evidence.test.ps1 29 例 pass=29 fail=0,既有 harness pass=42 fail=0,node 镜像 9/0,三文件 ParseFile 0 错 (a328eb127e)
- 🚀 Feature/Improvement:D35 metadata 摘要懒取 + 票71 SSE created/patched 与 gap→resync 接线 —— ①D35:packages/shared/src/chat/message-metadata-summary.ts(九类摘要投影,幂等);api 消息列表改摘要形态并新增 GET /api/chat/conversations/:id/messages/:messageId/metadata 懒取口(先鉴权再判会话归属);web use-lazy-message-metadata(idle/loading/ready/failed,失败渲染占位不白屏);chat-pane-body 挂载 useChatHistoryProjection;②票71:ai-chat-stream 补 created/patched 流式帧(复用 chat-sync-contract,单帧串行),ws-broadcast rev 收敛 PG 账本单源,web chat-sync-resync(404/409 摘坐标、瞬时失败退避、耗尽不抛)由 gap 事件触发并入 store;③openapi +1 路由(codebase 两条随 HEAD 保留);验证:typecheck 11/11、prettier 全过、web 114 例 / api 6 例 / shared 7 例全绿 (3f9c7b97df)
- 🐞 Fix:凭据落盘收进唯一写入口 —— 揭开"writeFileSync 的 mode 对已存在文件无效"这一格(安全强化第 17 批) (bc1b891da8)
- 🚀 Feature/Improvement:knowledge_write agent 知识写面 —— 对标 Qoder Repo Wiki 写工具族(goal-b43,先对齐再超越) (6ef61c1bfa)
- 🐞 Fix:补回被落后副本覆盖的 admin.wallboard 两键 —— 承接 e11ae9f9bff/105cd52ae5，先前两枚以工作树面落地时把 99a7ebadd4 刚补的 pv5mNow/firingRowsSplit 一并洗掉，wallboard 页取词出现缺键(门 2 WARNING) (d2532f563c)
- 📚 Docs:deploy-feedback 自动登记(deploy_outcome;端到端反馈闭环第二切片,O65 自进化系列) (499a9f3eab)
- 🐞 Fix:补两枚已入库但未导出的路由契约 —— codebase repo chunks/file —— 重建面与 committed+2 路由规范化后逐键全等;同批在飞的 chat 元数据路由不烘进契约(不在 HEAD) (03f15064bf)
- 🐞 Fix:三档 SSRF/预览回归锁的出站替身改到 undici —— 此前它们真连公网,且守卫失效也会被读成通过 (e358a18965)
- 🐞 Fix:shell open 运行面正则对齐 dev localhost 条目(第 17 批修正) (8c9495c6c1)
- 🐞 Fix:shell open 双面收口 —— capability url scope 显式域 + plugins.shell.open 运行时正则(安全强化第 17 批) (adf06fac99)
- 🔧 Chore/Other:安全强化第 10 批 R8 回归复评 —— R6 钉 IP 闸落地后 r3 两枚 safe-path 用例跟上新闸(resolve_pinned_target 需要 getaddrinfo mock;FakeClient 按路径判跳——钉 IP 后连接 URL 的 host 是解析 IP 非域名;_Inner.get 补 headers/extensions 形参——helper 钉 IP 后带 Host 头与 sni_hostname)。六套安全测试 42/42 全绿,mypy --strict 670 文件零错误,三端 typecheck 13/13 (f005fd5f18)
- 🐞 Fix:canvas 线程归属闸 —— 防"把攻击者 DAG 注册到他人 runId" + 跨用户读/控收口(安全强化第 16 批) (f717a21e3d)
- 🐞 Fix:relay-param-ops 配置型正则 ReDoS 双闸 —— 入库长度/flags 白名单 + 运行时超长跳过(安全强化第 16 批) (3059608db4)
- 🐞 Fix:web 五语言同批补齐 —— 上一枚只落了 zh-TW(self-existing 四语言仍在旧版)，门 2 parity 判红 (105cd52ae5)
- 🐞 Fix:ui-native 补进小程序编译面 —— 修好整端 weapp 构建被行内 type 说明符打挂 (5a6abbf8c3)
- 🐞 Fix:安全强化第 10 批 R7 —— 边缘 WAF 接线 + 桌面电脑控制默认闸 —— ① deploy/nginx/nginx-blue-green.conf 443 server 块顶接线 if ($waf_block) { return 444; }(conf.d/00-waf.conf 的 map 定义齐全但 $waf_block 无人引用 = 永不生效,现按其头注的启用方式激活;同批纪律写入头注,只放本文件时 nginx -t 以 unknown waf_block fail-fast);② deploy/docker/nginx.web.conf 按 docker_ 前缀先例(limit_req_zone 同款)自含 docker_waf_* 三条 map + server 块顶 if —— 本文件不能直引 $waf_block(00-waf.conf 未必同批挂载,且同落一个 http 上下文时 map 重名是启动失败),正则行从 00-waf.conf 逐字复制防转义漂移;③ 桌面 lib.rs 电脑控制统一闸:screenshot_screen/mouse_move/mouse_click/mouse_scroll/keyboard_type/keyboard_press/keyboard_hotkey 七命令默认拒绝(IHUI_DESKTOP_COMPUTER_CONTROL=1 显式解锁,与 api 侧 ComputerUseService 的 IHUI_COMPUTER_USE_ENABLED 同型)—— 这组命令等价程序替人操作电脑,capability 层曾对线上页面全量开放,任意 XSS 即可静默截屏/键鼠注入;active_window 只读窗口信息保留未闸。rdp/ssh ingress 公网暴露(P0)连续第四批向机主交代:需 Cloudflare 控制台同批操作且可能断机主远程管理面。验证:两片配置括号配平+map 定义引用配对静态验证通过(本机无 nginx 二进制与 MSVC 链接器,nginx -t 与 cargo check 拿不到判定,如实记录不冒绿);桌面 Rust 改动为纯函数插闸(签名返回类型全部 Result<_, String> 兼容 ? 运算符) (d13e3b1d2b)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (478206726e)
- 🐞 Fix:八档后端红用例按当前生产契约更新 + 迁移 journal 两枚 when 差整一年 (6c41e7a495)
- 🔧 Chore/Other:安全强化第 10 批 R6 回归锁 —— ① resolve_pinned_target 钉 IP 五态(IP 字面直通/解析失败 None/全内网 None/公网+端口+路径钉定/_download_url_ssrf_safe 连接层必须用 IP URL 且 Host 头保持原域名);② repo_wiki 登记白名单两态(登记根外 None/空登记 fail-closed)。7/7 全绿,mypy --strict 669 文件零错误 (5914970a10)
- 🔧 Chore/Other:重新封存清单 —— 并发会话改 guardian-runner 未同批重封,部署环再次 fail-closed (7937dca345)
- 🐞 Fix:图片下载重定向 SSRF 两处收口 + 备份脚本命令注入 + DB 错误脱敏(安全强化第 15 批) (7704d9fad5)
- 🐞 Fix:定时器句柄与分母守卫收口(门 244)+ zh-TW 一处简体字残留(门 2b) (e11ae9f9bf)
- 🐞 Fix:安全强化第 10 批 R6 ③ Tauri capabilities 把 checkin/qoder/workbuddy 全族 33 项命令移出 remote 授权面 —— web 面零消费方(tauri-bridge 桥函数亦零引用,逐命令 grep 取证),此前线上页面含任意 XSS 可直调扫描其他 IDE 应用 leveldb/DPAPI 提取 JWT、重置设备指纹;Rust 命令本体保留(本地通道仍可用);键鼠/截屏/剪贴板为 agent-control 在用功能保留(服务端审批门缓解)。本枚经 LAND_ALLOW_STALE 显式放行:capabilities.json 的 permissions 数组**有意删除 33 个元素**是本安全修复本体,键路径档的「丢键无条件拒绝」在此处判的是修复动作本身;单文件落地,其 diff 已逐行核验(33 项授权删除 + description 追加,零其他变化),非滞后回退。 (eeb29b12bc)
- 🐞 Fix:安全强化第 10 批 R6 ④ hooks-auto 工作区信任门:克隆的恶意仓库自带 .claude/hooks/ 曾可在发现链接入后自动执行 —— 现工作区级 hook 默认 enabled=false(执行器只认 enabled 结构性断开),显式 ihui hooks-auto trust 写信任文件后生效,~/.ihui/hooks 全局目录免信任,IHUI_HOOKS_TRUST_FILE 供测试隔离;⑤ manifest.ts readCliPackage 缺 import.meta.url 实参 TS2554 顺手清(5deda5045c 引入,门挡路故代清)。测试 hooks-auto-trust-gate 3/3(未信任禁用/信任往返/损坏 fail-closed) (f2ec86a2a7)
- 🐞 Fix:chat-sync 消息 rev 分配被"清理功能回退残留"还原成 Redis INCR —— 归位 PG 权威账本 (fc82207299)
- 🚀 Feature/Improvement:装上一台早已入库却零调用/无镜像的数字清偿器 —— 补 5 例镜像 + 填门 173 的修复指引 (7ccfc20921)
- 🐞 Fix:安全强化第 10 批 R6 ② repo_wiki_engine.ensure_wiki 的 workspace_path 接 MCP_WORKSPACE_ROOTS 登记白名单(与 _get_workspace_roots 同一登记源,fail-closed)—— 此前请求体用户可控路径可指向服务器任意目录,_inject_workspace_memory 读目标 CLAUDE.md/AGENTS.md 注入 system prompt ⇒ 跨租户文件探测/内容注入面。测试 r6 白名单两态 7/7 全绿 (2eb8ace261)
- 🐞 Fix:装机资产对账器补 windowsHide —— 门 52 抓出 spawnSync git 缺 windowsHide(AGENTS §5b 派生进程纪律);补后自检 8/8 仍绿 (6ed9a5639f)
- 📚 Docs:T5 §2.3 诚实化 —— toolhost 反编译未完成不冒绿(§0.3) (48cf8be95b)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (637e6aaa07)
- 🚀 Feature/Improvement:再两枚页面改壳承载 —— 转换器"缺端点"判据对 api-client 封装是假阳性 (a08d1ed786)
- 🔧 Chore/Other:probe3 (79faaf72f2)
- 🔧 Chore/Other:装机资产清单按 HEAD 重生成 —— .ihui/skills/rea-surpass/SKILL.md 由别席更新(字节 5003556→5004711),清单与 HEAD blob 面重新逐文件对齐;check-installed-asset-catalog → ok(192/192 / 5,004,711 B)。生成物重生成出口:LAND_ALLOW_STALE=1 显式留痕(旧条目被新条目替换,非还原祖先内容) (ef8aaed307)
- 🚀 Feature/Improvement:接线四条"已实现但零调用方"的启动/查询腿 (e7c5a4f1fc)
- 🚀 Feature/Improvement:VoiceNote 再清 6 处按压反馈 —— 取消/插入/重置三枚按钮与三枚分组筛选 chip 接 pressFeedback() (19fb23bbb1)
- 🔧 Chore/Other:probe2 (1ee30fe4a5)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (9427a1f18e)
- 🐞 Fix:mcode 会话回灌腿在服务身份下读不到用户目录 —— 支持 MINIMAX_DATA_DIR 显式数据根 (1bf3c7f5df)
- 🐞 Fix:跳门成因如实 —— 17 处 ⏭ 播报改打印实测成因,门 173 提示行重播并改指配套清偿器 (d0e586b32d)
- 🐞 Fix:收口剩余 CI 红 —— i18n 存量棘轮、e2e 地区与 CSP、OpenAPI 契约漂移、水印缺口 (af90aa3d59)
- 🐞 Fix:safeFetch/embed-proxy/url-preview 建 connect-time 守卫收口 DNS rebinding TOCTOU + WS 升级 fail-fast + learn 302 协议白名单(安全强化第 15 批) (5bb0295530)
- 🐞 Fix:两处取键写错 + 小程序词包对象遮盖共享叶子键(端上渲染成对象/空串) (beda3504b6)
- 🔧 Chore/Other:probe (182c329374)
- 🐞 Fix:zh-TW agentBillings 平台→平臺 —— 门 2b(zh-TW 简体字残留)存量一处,随本文件变更一并清掉,其余内容逐字不动 (dcd40b377b)
- 🐞 Fix:更正五语言 JSON —— 上一枚 1be794eee0c 在错误锚点插键且漏逗号致 JSON 解析失败(门 2/2n 红),本枚摘掉错插并改在 chat.message 的 toggleMetadata 后正确插入 metadataLoading/metadataUnavailable,五语 JSON.parse 全通过 (42b243c3b2)
- 🚀 Feature/Improvement:间距档补 2xs/xs-loose/sm-loose —— 新尺量出两端各自成规模用 2/6/10px 而表里没有 (8934ce6115)
- 🚀 Feature/Improvement:G7 本地 embedding 回落档 —— 离线索引可识别不冒充(goal-b42,对标 Trae ckg -local_embedding) (d1a0710f5b)
- 🔧 Chore/Other:补 420038c4e6 带入的溯源水印欠账 —— 安全强化第 1 批那枚测试文件未带载荷 (e572d46bb6)
- 📚 Docs:门点名 check-web-rn-style-tiers —— 已接线于 parity-auto 的 gate-style-tiers 腿(R4 义务) (e879b111a1)
- 🚀 Feature/Improvement:web↔RN 非色档档位对账尺装上驾驶舱 —— 字号/间距/圆角这一腿此前零判据 (95326a0bfe)
- 🐞 Fix:run manifest 版本读取补 selfUrl 参数 —— readCliPackage 要求显式 selfUrl,漏传时 tsc TS2554(落地后复跑判据抓出);补后 apps/cli typecheck 0 错、run-manifest 5 例绿 (fe7274ffff)
- 🚀 Feature/Improvement:D35 metadata 懒取与票71 chat-sync 帧/重同步 —— 五语言补 chat.message.metadataLoading/metadataUnavailable 两键(只落本票两键,同文件他席在飞键不代落) (1be794eee0)
- 📚 Docs:AGENTS.md 回落预算内 95645/96000 —— 重复登记副本与历史取证叙述整区移入 AGENTS_trim-2026-10-31b.md (68a419e612)
- 🚀 Feature/Improvement:推理档位扩到 xhigh/max(四抄写面同批 + web 轴) (bb5058f925)
- 🚀 Feature/Improvement:新增按压反馈唯一口 pressFeedback() —— 判据同步认它,并把 VoiceNote 三个主按钮接上 (244efbd30d)
- 🐞 Fix:webhook 生产投递 SSRF 复检 + OAuth deny 守卫 + checkpoint 路径复验 + Tauri symlink 解析(安全强化第 14 批) (de8f370857)
- 🔧 Chore/Other:接上 AI 代码归属 git notes 的零调用死腿(fail-open) (ea2a4adf09)
- 🚀 Feature/Improvement:G-18 运行清单 + G-25 产物内容寻址 (5deda5045c)
- 🔧 Chore/Other:补齐钩子异步唤醒+8 档事件的用例文件(与 9d14cbe3b 同批,前次提交窗口被并发 reset 打断) (b75a40cc7a)
- 🚀 Feature/Improvement:钩子 async/rewake 不阻塞 + 8 档事件单源(HookEvent 23→31) (9d14cbe3bb)
- 📚 Docs:恢复误删的票5(perf e2e)未勾行 —— 上一枚 2fa2b47ca51 把进展注记误写成结清档导致该行被删除;本次从 139d7f462a7 逐字取回原行并附实测进展(首屏 1158ms/1600ms dev 口径通过,长任务带归因 0 属 dev 噪声),票维持未勾 (5128e3340b)
- 🐞 Fix:DAG 面 admin 收敛 + 子进程环境/工作目录白名单 + 会话记忆按主体隔离 + MCP 商店工作区闸 + hook script 限管理员 + 媒体上传逐跳 SSRF(安全强化第 14 批·ai-service) (1480eefdf8)
- 📚 Docs:票5 perf e2e 实测进展 —— 隔离栈真跑通(首屏 1158ms/1600ms dev 口径通过),长任务 183/86 带归因 0 属 dev 噪声;票不结清,下一步生产口径复测+归因补 src (2fa2b47ca5)
- 🚀 Feature/Improvement:编辑器态喂索引(editor_state 入上下文聚合，默认关灰度) (f77199d13f)
- 🚀 Feature/Improvement:e2e-local-supply 修文档跑不通的旗标形态 + 新增 --stack 隔离栈自起停 —— flagValue 兼容 --base-url <v> 空格形态(此前只认 = 形式,照 --help 敲必 exit 2,§0.8);--stack 自带起/停隔离 API+web(独立库/独立端口/独立 dist,跑完自动收口,--keep 可保留),新增 --api-port/--db/--keep;unknown 判定排除值位置 token。实测:用 --stack + E2E_SKIP_SEED=1 跑通 perf-long-session 首屏用例 1158ms / 预算 1600ms(dev×2)通过(热档 277ms) (139d7f462a)
- 🐞 Fix:两处同向嵌套滚动容器摊平 —— 纵向 ScrollView 里别再套纵向 FlatList (86ef41808a)
- 🚀 Feature/Improvement:micro压缩接入执行器 + 浏览器动作tab级作用域 (0cbd8bdb9f)
- 🚀 Feature/Improvement:号池管理页加归属筛选(我的个人池 owner=me)+ 个人池徽章 —— admin 账号也能看自己的池 (0ddc1fcbf5)
- 🐞 Fix:安全强化第 10 批基础设施批 —— 侦察五处收敛 —— ① cloudflared metrics 0.0.0.0:36500 → 127.0.0.1:36500(Prometheus 指标不再监听全网卡);② 蓝绿主站 nginx 补 /api/internal/ 边缘封禁 403(与 docker 壳同口径 —— 此前只有 docker 壳有,蓝绿腿 aizhs.top 直达 Fastify;/api/internal/* 鉴权 = 单一共享 X-Internal-Secret 且 require-permission 允许内部 token 降级,密钥泄露即冒充任意用户);③ deploy/docker/nginx.web.conf 补全套安全响应头(蓝绿同款复制:HSTS/X-Frame-Options/nosniff/Referrer-Policy/CSP/X-XSS —— 本壳是 cloudflared aizhs.top 落点,此前公网实际响应零安全头,/admin/ 与 /sso/login 可被任意站点 iframe);④ SaaS Traefik dashboard 加 ipAllowlist 仅私有网段(此前知道 ADMIN_DOMAIN 即可读全部客户路由拓扑);⑤ refresh_token cookie「不记住登录」时同为 session(此前无条件 30d,关闭浏览器即登出语义被破坏,令牌窃取窗口与 remember 等价);⑥ relay-pool-snapshot-sync.ts 局部 now 未读 TS6133 顺手清(bcaf7f58d2 引入,deps.now 已随 spread 透传,归属其管道门挡路故代清)。未动项如实交代:cloudflared 的 rdp/ssh 两条 ingress(宿主机远程管理通道,删除需 Cloudflare 控制台同批操作且可能断机主自己的远程面)归机主处置;deploy/nginx/conf.d/00-waf.conf 的 $waf_block 未接线属既有设计取舍,已记录。验证:pnpm turbo typecheck --filter=@ihui/api --force 8/8 全绿,auth-cookie-domain-scope 套通过 (58f6dc169b)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (badfe334a6)
- 🐞 Fix:清两处测试假 oracle —— 夹具给生产从不填充的 request.user 赋值(门 242 W3 绝对零容忍) (51b6e4be56)
- 🐞 Fix:内部端点公网封禁 + 运营面越权收口(安全强化第 14 批·api/web) (bd60682c87)
- 🚀 Feature/Improvement:G2 ContextFS 只读虚拟文件系统 + Qoder 导入 4 维对位物(goal-b41,先对齐再超越) (6b25542a75)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (b1ba3762e4)
- 🐞 Fix:测试 mock 的 Redis URL 用非法 db 段当哨兵 ⇒ ioredis 真连接后 SELECT NaN,未处理拒绝把 vitest 退出码打成 1 (1963eee7a7)
- 🚀 Feature/Improvement:错题本页改壳承载 + 修好「可换却写不进去」的转换器 (1dbd0dc639)
- 🐞 Fix:安全强化第 10 批 R5 —— db_query 只读双层加固 + git_operations argv 注入封死 —— ① db_query:关键词黑名单从「尾随空格子串」改词边界 regex(此前 DELETE\nFROM / DELETE/**/FROM 型变体可绕过,deleted_at/drop_function 类标识符不误杀)+ asyncpg conn.transaction(readonly=True) 数据库层兜底(此前 data-modifying CTE 如 WITH d AS (DELETE...RETURNING...) SELECT... 能穿过任何文本黑名单,数据库层只读事务把这一整族含未来未知写语法结构性封死,黑名单降级为纵深第一道);② git_operations:position 段(ref/分支名/tag 名/pattern)全部过 _assert_safe_git_arg(拒 - 前缀 —— show --output=<path> 曾可写服务器任意文件、--ext-diff 可调外部程序;拒空白/控制符),show/branch_create/branch_switch/branch_delete/merge/rebase/tag_create/tag_list 八个动作点全覆盖。测试 test_security_batch10_r5.py 8/8(换行/注释变体拒绝+标识符正向对照+argv 四态+show 端到端)。 (8407903655)
- 🚀 Feature/Improvement:大屏「使用数据」补齐用户构成/等级分布/14日增长 + 告警行数分裂提示 (9d2aee1235)
- 🚀 Feature/Improvement:大屏五语言同批补 6 键 + 删 1 键按正规出口声明 (99a7ebadd4)
- 🚀 Feature/Improvement:34 处键盘点击穿透清零并升 H3 为绝对零容忍;顺带根治门 273 自身的恒红缺陷 (a0e5261a78)
- 🔧 Chore/Other:重新封存根护栏清单 —— guardian-runner 07:17 改动未同批重封,部署环 fail-closed 停摆 (f1fb8220dd)
- 🐞 Fix:归位被"清理功能回退残留"整段回退的积分兑换事务修复 (acd8cd7456)
- 📚 Docs:T3 §9 内核族五探复判 + rea 逐函数里程碑 (257e673bea)
- 🐞 Fix:号池「可调度」补票面维 + 告警账号容量归位 —— 票过期 70 小时的号仍算在分子里 (cbc49b04e9)
- 🚀 Feature/Improvement:号池账号归属改判 admin 个人池 + 一键切号直连号池(免本机登录) (bcaf7f58d2)
- 🔧 Chore/Other:安全强化第 13 批接线面回归锁 —— 主链工具结果装配点定界断言五条(llm.py 裸拼形态归零+8 处单源引用 / conversation 失败分支宿主指令在块外(Raw result: {raw_tool_json})/ agent_orchestrator 无裸拼 / agent_loop_v2 第 8 批既有接线未绕开 / protocol_adapter 协议转换器刻意不接定界(既有消息回放,双重包裹破坏回放))。第 13 批修复本体已由并行会话收编入库(f0e490a7f9,与本席 R4 工作树改动同内容),本枚补齐其接线面防回归锁。10/10 全绿(r4+r4_framing),mypy --strict 665 文件零错误 (ae754729de)
- 🐞 Fix:安全强化第 13 批 —— 凭据落盘加密/沙箱 fail-closed/工具结果宿主定界/错误帧脱敏/桌面原生确认/边缘封禁 (f0e490a7f9)
- 📚 Docs:T3 缺口矩阵补 §8 G-07 跨进程边界复核 (6fa08f7b53)
- 🚀 Feature/Improvement:用 rea 对标 Qoder/Trae 落地三枚能力并先对齐再超越 (14aa125c49)
- 🚀 Feature/Improvement:补 6 枚新工具显示名映射并清偿守门55 HEAD 存量4条红 (26851745bf)
- 🐞 Fix:配对码爆破限流 + relay-keys-admin 鉴权归位 + 组织成员写端点收口 + auth cookie Secure fail-safe(安全强化第 12 批) (2c53ec8a3c)
- 📚 Docs:goal-b40 最底层取证架构图源稿迁入 docs(同 8f89907bf6 先例路径形态) (eacca3120a)
- 🐞 Fix:安全强化第 10 批 R3 —— 重定向绕过 SSRF 五处收口 —— ① media_tasks 代理三端点(/media/download、/media/stream、/media/image)改手动逐跳 _send_following_redirects(每跳含 302 落点都重新过 _validate_url_ssrf,follow_redirects=True 自动跟随不复检 ⇒ 公网页 302 → http://169.254.169.254/ 即整条 SSRF,响应体原样回吐调用方;与 web_crawl_tools._http_get_html 2026-10-27 同型修复,HTTPException 穿透保持 SSRF 拒绝 400 不被吞成 502);② mcp_server 三处 URL 下载(_fetch_image_bytes/_resolve_image_source_bytes/_download_media_bytes)统一收口 _download_url_ssrf_safe 单源(逐跳复检,image_edit 的 _resolve_image_source_bytes 此前连首跳校验都没有,role=0 可经 /api/mcp 调用盲打内网+内网图像经编辑结果回流)。测试:test_security_batch10_r3.py 7/7(逐跳拒绝/首跳拒绝/安全链正向+每跳都被问过断言/下载单源四态),与 p0 批+media_tasks 既有套同跑 108/108 全绿,mypy --strict 664 文件零错误 (08db2f2556)
- 📚 Docs:goal-b40 最底层取证架构图源稿入库(同 8f89907bf6 先例) (cb1965c784)
- 🚀 Feature/Improvement:AIGC 生成内容打标(goal-b40,对齐 Trae tagAigcMetadata)——媒体落库链路自动打标+显式标识文案+标准引用 (122001affa)
- 🐞 Fix:组织树零鉴权收口 + LSP/knowledge 路径白名单 + 邀请 IDOR + 500 泄漏与 extra 凭据脱敏(安全强化第 11 批) (88c0e60987)
- 🚀 Feature/Improvement:WorkBuddy 切号列表按账号去重展示 + 快照库同账号重复清理器物 (33f5d27f0a)
- 🐞 Fix:两处归属/鉴权缺口 —— 免费次数插件五个端点零鉴权、visit-log 的业务日可由客户端决定 (236a550bab)
- 🔧 Chore/Other:第五次摘除 aboutPageSections 死件回潮 —— 共享真相源 packages/app/src/features/about/ 在位(AboutScreen.tsx 注释明说端内实现与分段数据表一并删除),端内零真实 import;bfc06bc2b0 第四次删后 74d85e2f21 auto 收编把索引旧副本带回 HEAD;本次走 object-space-land 删除档从结果树摘除并清索引 (d906805d4f)
- 🐞 Fix:安全强化第 10 批 ai-service 侧两枚 P0 —— ① generate_test 收进 _ADMIN_ONLY_TOOLS+pytest 子进程 python -I(隔离模式)+populate_env CORE 白名单环境(此前 arguments.code 原样落盘为可 import 的 source.py 并起 pytest 真执行,pytest 收集时执行模块级代码 ⇒ 任意登录用户 role=0 经 /api/mcp 直调即服务身份 RCE,且子进程未传 env 完整继承服务进程 os.environ ⇒ provider API key/JWT_SECRET/AI_CALLBACK_SECRET 随取;判据取 core/exec_env 六步构造器单源:CORE 白名单起步+KEY/SECRET/TOKEN 形名排除,不造第二套);② _fire_callback 目标白名单 _is_allowed_callback_target(此前 callback_url 是请求体用户可控字段零校验,指向攻击者服务器 = 把 X-Internal-Secret 内部共享密钥(/internal/checkin 全套唯一防线)整枚送出+携带完整推理结果与元数据的 POST SSRF;现仅 settings.api_service_url scheme+host+port 同源可收回调,白名单检查排在带密钥发送之前,非白名单连裸 POST 都不发)。测试:test_security_batch10_p0.py 10/10 全绿(admin-only 矩阵+env 白名单两向断言+callback 白名单四态+零外发断言),mypy --strict 664 文件零错误;xdist 大组合 ERROR 为环境既有问题,涉事文件单跑全绿(155/155) (d6e1a583ca)
- 🐞 Fix:子 LLM 那条链也走同一套宿主定界(安全强化第 12 批) (31b5094680)
- 🐞 Fix:安全强化第 10 批 cli 侧 serve 面四道收敛 —— ① 默认绑定 127.0.0.1(此前 listen(port) 落 0.0.0.0,局域网对端可达),--host 显式放开且非回环面必须配套入站凭据否则启动期拒绝;② anonymous 透传收窄:主机零凭据时只有无 scope 请求(/health)放行,凡要求 scope 一律 401(此前零凭据主机全 API 匿名直通);③ WS 握手 Origin 校验:浏览器跨站 WebSocket(CSWSH)不受 CORS 限,非回环来源握手直接拒绝(带凭据也不放行);④ CORS 头只在回环面发,非回环暴露面不发 ACAO 让浏览器预检失败;⑤ 凭据写盘 settings.json 统一 0o600(此前默认 0644 组/其他可读)。测试:machine-credentials 54/54 全绿(含 anonymous 收窄新断言),cli typecheck 零错误 (b500f36355)
- 🐞 Fix:安全强化第 10 批 web 侧两枚 —— ① 分享页 lists image 点击处 scheme 白名单:content 是分享创建者可控的自由字符串,javascript: 经 window.open 会在本站源执行(存储型 XSS,新窗口继承 opener),现只放行 http(s) 外链并显式 noopener,noreferrer 断开 opener;② RichTextEditor markdownToHtml 属性注入:url/src 内双引号闭合 href/src 属性可注入 onmouseover 等事件处理器,现引号转义 %22 进属性+链接目标 scheme 白名单(http(s)/站内/锚点/mailto),javascript: 同族降级为无 href 的 <a>。验证:web typecheck 零错误(配合 api 侧 share-content 出口 safeMediaUrl 双闸) (ddbe681c57)
- 🐞 Fix:安全强化第 10 批 api 侧四组收敛 —— ① /workspace/sandbox/execute 补工作区权限闸+登记根闸(workspacePath/cwd 双过 assertWithinRegisteredRoots fail-closed)+danger-full-access 收窄 admin-only+cleanEnv 全模式滤敏感键(此前任意登录用户自报该档可整袋端走 JWT_SECRET/DATABASE_URL,等价全站接管);② /api/embed-proxy/raw 补 CSP sandbox(onSend 覆盖全部早退路径,直接导航场景第三方脚本不再以 API 同源身份执行,与前端 iframe 档同语义);③ spec-service 落盘面收口:12 处 resolve 换 assertRegisteredWorkspace 单源闸+branchName/version/pipelineId 白名单(SAFE_SPEC_SEGMENT)+git commit 改 spawnSync argv 且 --no-verify 防恶意仓库钩子(branchName ../../ 穿越可写服务器任意 .md);④ share-content 出口 safeMediaUrl 只放行 http(s)/站内绝对路径+rules ReDoS 双闸(schema max(200)+运行闸同 webhooks 口径)。测试:workspace-sandbox-containment 5/5+embed-proxy-ssrf-redirect 4/4+spec-service-containment 6/6 全绿,api/web/cli typecheck 零错误,水印 8/8 完好 (6598779ea0)
- 🔧 Chore/Other:编辑器内预测式编辑 §17 真浏览器验证 —— 建议条上屏/hover 预览装饰/逐条选择性应用/埋点真发四链路全通 (be7f1894b6)
- ♻️ Refactor:ioredis 内存替身收成一份实现(src/testing)+ tests/helpers 只做再导出 (9cc45fe107)
- 🐞 Fix:修 main 上 8 条 workflow 红的真因 —— 配置解析、构建顺序、依赖面、快速失败档、静态导出暂存、expo 入口双拼、ruff 与死指令 (b00a35fabf)
- 📚 Docs:WP-7 元素句柄与票71 多端 chat 同步按证据结清 —— WP-7 交付落 dbfe0c624d5(9 例含真 Chrome 全绿),71 三端聊天面(web/taro/RN)全部接线+契约四件收口,cli/extension 无聊天面如实豁免 (242ac41536)
- 🚀 Feature/Improvement:WP-7 浏览器可复用元素句柄 + 票71 RN 端 chat 同步接线 —— ① CLI browser_snapshot 为交互元素分配会话级稳定 ref(eN,WeakMap 同元素同 ref),click/type 支持 ref 与 selector 二选一,导航后旧 ref 显式 stale_ref 并提示重新快照;测试 browser-element-handle 9 例(含真 Chrome 5 例)绿,tsc RC=0。② RN 端 message:* 广播 handler 经共享 chat-sync-store 投影进 ChatScreen(幂等/四态零复制/回声跳过),测试 chat-sync-rn 19 例绿;仅单测未真机,新会话 conversationId 为空时同步不生效属已知边界 (dbfe0c624d)
- 🚀 Feature/Improvement:G-08 worktree 会话级工具 + G-14 lesson-draft 调度 + G-22 插件默认态 + G-21 装机资产对账 (f97112d718)
- 🐞 Fix:两档最大红簇收口 —— admin-missing-routes 15 红其实是超时、n8n 7 红其实是 mock 少一个导出 (86f0e94de3)
- 🐞 Fix:自愈用例不再在主进程 exec/eval,改子进程隔离执行(安全强化第 11 批) (007f1bfb9c)
- 🐞 Fix:生产 CSP 的 connect-src 收成显式名单 + 供应链年龄闸复位 + compose 端口收回环(安全强化第 10 批) (5985317e88)
- 🐞 Fix:家长账单端点两枚真缺陷 —— 全量请求恒 400(参数键名漂移)+ 端点手写 401 顶替承载层出口 (6fd09a0303)
- 🐞 Fix:企业微信取 token 的 legacy 端点不再匿名中继任意企业凭据(安全强化第 9 批) (9060490a6e)
- 🐞 Fix:两处"病灶回归"归位 —— 清空浏览记录重新对非法 userId 报 400、chat/steer 不再把上游凭据错发成 401 (c413b3034d)
- 🚀 Feature/Improvement:工具结果进入模型上下文前加宿主定界与保留标签中和(安全强化第 8 批) (f02cdd0b43)
- 🐞 Fix:归位被"清理回退残留"chore 洗掉的两枚已入库修复 —— 协作者撤销终态守卫 + 号池换 Key 出口 (7b79a81411)
- 🐞 Fix:两档 auth 链路用例改吃 ioredis 内存替身 —— 此前它们在生产 Redis 上跑,并因重连退避恒超时 (25130d6314)
- 🐞 Fix:远端页面拿不到的本机通道一律摘掉,并关闭 %APPDATA% 直读直写(安全强化第 7 批) (c041f3e3a7)
- 🐞 Fix:Azure TTS 的 SSML 不再由未转义的用户文本拼出 + escapeXml 收成一份 (ed3670152c)
- 🐞 Fix:SSE/WS 代理的出站期限与断连中止 —— 上游 stall 不再永久占连接 (465fc9ef3c)
- 🔧 Chore/Other:四处测试基座缺陷收口 —— 限流隔离夹具一直在结构性空转 (e3e80abf4f)
- 🐞 Fix:计算类声明求值改用白名单 AST,摘掉外部输入直达 eval(安全强化第 6 批) (968fb44abd)
- 🐞 Fix:SSRF 的 IPv6 一维同样收成单源,规范出口补齐 v6 组播/NAT64/discard 三族 (120baff8a3)
- 🐞 Fix:回捞与后台任务查询的身份收口到宿主主体(安全强化第 5 批) (e7af51499d)
- 🐞 Fix:im-bridge 无凭据时不发身份头 + 摘除第二份 keepalive router + 修一条误报判据 (2979ff7d2b)
- 🐞 Fix:补齐 CloudRunStore 归属入参的两处漏装调用点(前向更正) (13490436d7)
- 🐞 Fix:SSRF 内网地址判定收成单源,并补规范出口漏掉的数值字面量档 + 修 19 条恒红用例 (66af475034)
- 🐞 Fix:MCP stdio 注册加两道闸 + 目录一键注册的工作目录收口(安全强化第 3 批) (7a1c556d19)
- 🐞 Fix:memory/status 作用域只认主体(§5 越权)+ 两处逐字重复实现收成单源 (aa7b8488d5)
- 🐞 Fix:agent-runtime 全线补归属校验 —— 任一登录用户此前可读/写/停他人会话(§5) (c16140a862)
- 🐞 Fix:后端四枚在册缺陷收口 —— 云会话跨用户读写、签到日界、NaN 进 SQL、Azure 主机名注入 (1811855960)
- 🐞 Fix:前端三处可控输入面收口(安全强化第 2 批) (144a28e8af)
- 🐞 Fix:后端三格重复实现收成单源,并补 SSRF 与脱敏覆盖 (a9c6cf18c7)
- 🐞 Fix:后端越权 / SSRF / 受限模型红线收口(安全强化第 1 批) (420038c4e6)

**2026-10-31**
- 🐞 Fix:收编器补齐滞后副本守卫的接线与两个漏网洞 —— ① main 重新接线 dropStaleCopies:判据与装车锁 T6 于 2026-10-29 写好,main 里的接线被后续副本覆盖洗掉,守卫整个悬空(教训:镜像测试红了必须有人读),aboutPageSections 第四次回潮(7a47524b07)即此通道,T6 一直红着无人修;② partitionStaleCopies 的 !head 分支不再 fail-open:HEAD 无此文件但 git log --diff-filter=A 证得到曾入库 ⇒ 删除档死件回潮必须跳过(第四轮回潮正是这条通道);③ 祖先窗口 6→40(回潮-删除轮次多的路径在 6 枚窗口漏网);新增 T10/T11/T12,镜像 12/12,dry-run rc=0 (f221586d3f)
- 📚 Docs:三条 [归并] 指针副本按证据结清摘除 —— 其所指实质工作均已在 HEAD 落地:①prod-bundle 运行入口三枚入库源在册(git ls-files deploy/scripts/prod-bundle/svc/run-{api,web,ai}.ps1)+ check-prod-bundle-shadow.mjs:148-159 的 PAIRS 三对已登记,E1 枚举闭合(14 个运行副本全在登记表,运行副本本机不在=未判定非失败);②门 98 D6「错名 .js 影子架空 .ts 说明符映射」判据已实现(头注 35-46 + 实现 1170-1232,--self-test 19 例)。三行均属「重复登记副本存量清零」射程,不再保留一行一状态 (999ea0250c)
- 📚 Docs:安装器视觉三版按证据结清 —— 选型 A 版墨光·续已于 3a1f2a462f 落地(90 枚氛围资产+全帧目审 18/18),本机 check-installer-assets 三行 PASS、正式与候选同 blob 复核通过 (c4c5dd0f42)
- 📚 Docs:G-23 admin 默认口令按证据结清 —— fixtures/seed 已改从 env 取、守门 check-public-admin-default 现跑通过、离线取证现役散列对公开默认六候选全脱靶;余项凭据三点漂移归机主核对 (f5cc79b586)
- 🚀 Feature/Improvement:G-09/G-17/G-05/G-10 —— elicitation 接线 + 会话身份注入 + 图片检索 + 压缩五判据 (a6e69e7452)
- 📚 Docs:O68 pass-entry-broken 按证据结清 —— 该型根因是切流空窗:门禁起点早于新构建真就绪、web 维被 EdgeOne 缓存刷绿,触发条件在 deploy/win/health-gate-verdict.ps1:98(末轮明确 fail ∧ 源站 web+api 直探均 pass)、产出点 ihui-deploy.ps1:3429;修复四枚全部已在 HEAD 谱系(merge-base --is-ancestor 逐枚现读):e6d21d196d 就绪等待替代固定 8s、8f572260a4 结清(实测源站 5 秒就绪/门禁首轮全绿)、38d71cfb82 与 dfc9b905b5 蓝绿+router 原子切流(空窗归零);信号时刻 2026-10-27T17:30Z=本地 10-28 01:30,正是 ihui-deploy.ps1:3238 记载 6 枚 01:30~09:10 的首枚,早于修复 ⇒ 票面系滞后回填,本仓无需再改代码 (180f90e911)
- 📚 Docs:票86 证据级可追溯执行流水按证据结清 —— 落库四要素/链式审计/签名导出路由+公钥面/180 天保留作业四层全部在车,承载测试 67 例单跑全绿(并发下超时为饿死假红) (cbed2c09ab)

**2026-10-31**
- 🐞 Fix:数字值列退位出表格锚点,根治 Step2b 数字对齐与活文档闸自咬 —— README 生成块「|名称|数值|键名|」三列形态下 gen-doc-numbers 每轮翻新数值,旧锚点 T#名|73 与新锚点 T#名|72 永不相遇 ⇒ 改写被误判 lost、--apply 把旧数值插回、下一轮再翻新,死循环(2026-10-31 实测两枚提交各吃一轮);行身份改取名称+键名,仅第 2 格纯数字且第 3 格键名形状才走此路,两列表与自由文本第 3 格维持旧行为(反向锁在自检 ⑱a);immutable-exempt: 修的是两把器物判据咬合造成的恒红循环,扩识别不放宽语义,带正反用例与镜像 18/18 (0e63b9c2a3)

**2026-10-31**
- 🚀 Feature/Improvement:G1b 设备互联安全面三件(对齐 Qoder 0.5.1 peerDevice 状态族)——8 位配对码/设备指纹绑定/版本兼容闸 (1bcaf44c0b)
- 📚 Docs:票79 权限双轴化按证据结清 —— 契约/裁决器/wire/前端 UI 四层全部在车,双轴 picker 挂载与请求链消费现读,承载测试 14 例复跑绿;resume 三出口有意不接与真机集成验证按票面原样交后手 (d00771a6b1)
- 📚 Docs:票59 消息级版本切换按证据结清 —— 三段(后端不删行/sibling 入族坐标/CanvasVersionMenu 复用)全部在车,承载测试 22 例复跑绿 (032f358bdf)
- 🐞 Fix:离线包生成物按当前词包源重刷(门 105 G-680 自述钉 stale 清偿)—— gen:i18n 现跑产物,inputsSha256 与源对齐;ui-routes 钉已 matched 不动 (4f511bba67)
- 📚 Docs:三条僵尸票按证据结清 —— argument-validation 三格全有终局(模块退役裁决+行为锁 10 例)、--allow-dangerous 契约声明与测试面已落地、O66 四件落点全在车(承载测试 55 例);三批本机现读全绿 (627aa16be5)
- 🚀 Feature/Improvement:26 处内容文字接回系统字号通道 —— 新增唯一放大机制 scaleText(),门 273 的 H4 随之升绝对零 (d1a6dea5a1)
- 🚀 Feature/Improvement:文字必须随系统字号长大 —— FloatBox 接上缩放唯一口 + 一把握不住复发三次的替身缺口尺子 (c7c6f50dd5)
- 🚀 Feature/Improvement:门 273 补 H3「键盘点击穿透」普查 + 摘掉两处"填完再点第一下没反应" (cf65e9c457)
- 🐞 Fix:门 273 两条判据方向再校正 —— 遮罩不算缺反馈 + 摘掉一枚假 affordance (10790ffb22)
- 🔧 Chore/Other:probe (92a1ebbb9b)
- 🔧 Chore/Other:壳声明件跟随新落承载页(187 条说明符) (d64476f31f)
- 🚀 Feature/Improvement:守门 274 字号可读地板上线 + 字号表补 badge 档 + 9px 文字 11 处收进档 (f0a0cfda3d)
- 🔧 Chore/Other:恢复 RTL asyncUtilTimeout:4000 —— 9fdbc207ba 回退的第六票(43ce93f1a8 的等待预算被「清理回退残留」抹掉) (92729cb16d)
- 🐞 Fix:门 273 的 H2 判据认原语默认态 —— 957 枚误报当场收窄(1296→352) (2aba634b5b)

**2026-10-31**
- 🔧 Chore/Other:摘除 AGENTS.md 四条与现读事实相反的「结构与守护」重复副本(门 207 体积回预算内) —— 现读三面一致:①ls -ld .git = drwxr-xr-x 实体目录、②git rev-parse --absolute-git-dir = G:/IHUI-AI/.git、③D:/IHUI-AI-git-repo 与 D:/IHUI-AI.git-backup-20260912 均 No such file or directory;被摘四条分别自称 gitfile/28字节gitfile/遗留目录存在,与实测相反且是同一段落的重复副本(保留 §0 的 L26 正确条,内容零减);immutable-exempt: 判据面文档删除与实测矛盾的重复副本,无规则条款减少 (b0fee6b656)
- 🔧 Chore/Other:第四次摘除 aboutPageSections 死件回潮 —— 共享真相源 packages/app/src/features/about/ 在位、AboutScreen.tsx:24 注释明说端内实现与分段数据表一并删除、端内零真实 import(grep 命中均为注释文字);c247b0a7f7 第三次删后 7a47524b07 自动收编第四次带回;按门 30c 修法①走唯一删除档,门 39 V1 红同源同消 (bfc06bc2b0)

**2026-10-31**
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (adf8244981)
- 🚀 Feature/Improvement:守门 273 触屏交互卫生上线 + 命中尺寸 22→0 清零 + 三处静默失效补口 (8dfce6e70d)
- 🐞 Fix:I18nProvider 定身恢复(9fdbc207ba 第五票)+ drawer artifacts 条目五语言补齐 + i18n 产物按 HEAD 面重生成 (f195ed1e06)
- 🐞 Fix:generate-ui-routes 写盘加重试 —— build 链三处生成脚本写盘全部覆盖(同 gen-i18n/watermark 同型) (1d1d7894c2)
- 🐞 Fix:watermark inject 写盘加重试 —— gen 写完紧随的 inject 撞实时扫描锁(同 gen-i18n 同型) (1df3c59ff0)
- 🐞 Fix:I18nProvider value 定身恢复 —— 9fdbc207ba 回退的第四票(与 miniapp/mobile-rn 同型母型缺陷) (a0d46a32ab)
- 🐞 Fix:再删 aboutPageSections 死件回潮(第三次)—— 检出滞后把轮 55 的正当删除带回来 (c247b0a7f7)

**2026-10-31**
- 📚 Docs:中英散文声明行数字对齐 gen-doc-numbers 现算 —— 617 表/4653 路由/3698 测试文件/306 守门/51 CI/14 Compose(仅声明行 8+1 行;并摘除 en 内混入的历史中文生成块行 cliToolFiles,该行祖先态已删属复活);历史变更日志行不动 (645f426bf4)
- 🚀 Feature/Improvement:文件读取状态缓存接线 + 失败词表对账门 + 派生面收敛收尾 —— ai-service read_file 登记会话级内容指纹、file_edit 落盘前脏判定(fresh/stale/never_read/undetermined 四档不并桶,__session_id 取承载层注入,判据本体 file_read_state 单源)+ 沙箱阻断计量测试;词表对账门入库(复用门 151 解析器,接线另票);门 269 提取器内联箭头按块记账(修 alias-routes 三处同名形参前缀塌缩);reset 页面细进度条圆角收编 rounded-xs 与 prettier 重排 (c0312b47ff)
- 🐞 Fix:恢复模型广场兜底容量与兜底降级组 —— 转壳承载丢失的能力维随形状锁取材点迁移一并归位 (4f45a62234)
- 🐞 Fix:守门 102 的 GA1 字形集扩进关闭/勾选族 —— × 当图标长期不响这一格补上 (824b10cb6c)
- 🔧 Chore/Other:on-demand 三级就绪对账改挂产物文件面 —— 同 i18n-compressed 的收口逻辑 (86660d7aee)
- 🐞 Fix:门 272 的镜像锁改用 code-mask 剥注释,并格式化门体 (e255be79c3)
- 🐞 Fix:清偿 i18n 测试收口枚的未用标识符(mergeMessages/Locale/MESSAGES_ROOT/REPO_ROOT 删除后残留 import 与常量)+ sep 回补(下游相对路径换算仍在用) (7baf0ecb7e)
- 🐞 Fix:四处弹层输入补键盘避让,并装守门 272 锁住这一型 (fe670d07fd)
- 📚 Docs:守门 272 补进「守门脚本点名索引」的 UI/样式 行 (092b35faf9)
- 🔧 Chore/Other:i18n 无损性套件撤第二份合并判据 —— 降回产物层健康锁,内容对账归守门 105 钉现算 (3a7a164c51)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (37ca28af71)
- 🔧 Chore/Other:采纳锁两处对齐现状 —— feedback 壳承载摘出 ADOPTED + setValue 同源判据补 props 透传形态 (1ccbebaa2f)
- 🐞 Fix:验证码弹层补键盘避让 —— 键盘不再盖住用户要看的 6 个码格 (5e99373861)
- 🐞 Fix:gen-i18n 三处写盘全部走重试(remote-locale-manifest.gen.ts 同型锁实证) (6f78b9dc8d)
- 🐞 Fix:恢复 I18nProvider value 定身(9fdbc207ba 第三票回退)+ d20 形状锁窗口放宽 (12fe73bd51)
- 🐞 Fix:gen-i18n 写盘加重试 —— Windows 实时扫描毫秒级独占锁致全量 turbo 连续三轮稳定红 (3fc2338841)
- 🐞 Fix:恢复 G-41 钩子事件流生产接线 —— 9fdbc207ba「清理回退残留」抹掉的第二个接线面 (7cc430a3df)
- 🔧 Chore/Other:补 packages/ui-react/tests/setup.ts 的溯源水印横幅 —— 销 HEAD 面欠账 (f77e41df3f)
- 🐞 Fix:守门 218 射程补上 packages/app/src —— 共享屏层的手抄色值不再对门隐身 (23dee91758)
- 🐞 Fix:清偿 devices page 的 TASK_STATUSES 只用作类型 lint 红(0e875130c0 带入的 HEAD 存量) (61d3c76645)
- ♻️ Refactor:色相表分成"带前景的族"与"纯底档的族"两型 + 收编最后一张手抄表 (38f236b266)
- 🔧 Chore/Other:清偿 devices-g1.test 两处 eqeqeq(0e875130c0 带入的 HEAD 存量 lint 红) (397e481f7a)
- 🔧 Chore/Other:清偿 rn-sheet-keyboard-cta 两处 children-as-prop(235d418a8e 带入的 HEAD 存量 lint 红) (ecb6277916)
- 🔧 Chore/Other:补 vitest 入口的两个漏项 —— 浏览器全局补丁未挂 + Radix Trigger 裸 click 恒假 (906c04feca)
- 🐞 Fix:色相表补上构建装车腿 + 8 个共享屏的 tint 抄本收编到单源 (1160d9530c)
- 🐞 Fix:根槽位判据扩两条窄追跳 —— 同文件本地代渲染 + 跨端同源核心构造判定 (56ef0e8d7f)
- 🚀 Feature/Improvement:色相族 tint 落单一真相源 —— 收编 RN 侧 8 份手抄调色板的落点 (894de57d3a)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (a7b434d031)
- 🐞 Fix:跨端接线族五连修(末枚)—— 幻影判据补间接消费维 / tooltip 语义反转 / 裁定账摘 SectionHeader / 补回 navbar-core 导出 (c3ff235506)
- 🔧 Chore/Other:probe6 (403d6bfa0d)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (3bd0be64c9)
- 🔧 Chore/Other:probe3 (61600c99b2)
- 🐞 Fix:补齐 RN 端 7 枚 t() 调用点的缺词 —— 界面不再回显裸键路径 (3229f88b8d)
- 🐞 Fix:DevicesScreen 展开面板圆角回角色档 —— panel 取 xl(12) 不再 sm(4) (c164fb5f83)
- 🔧 Chore/Other:probe (a8ef367298)
- 🐞 Fix:弹层键盘避让补进唯一承载件 + 提现 2FA 面板色值收口(三道 HEAD 恒红门归零) (235d418a8e)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (39d0793928)
- 🐞 Fix:ScreenStates 占位高台收单一源 + 标题字号撤手写档 —— 消解 2026-11-24 到期豁免的真实差异半边 (e8ba95f0f3)
- 🚀 Feature/Improvement:切号链收尾 —— codearts 快照面解除 supported:false + 闭环 CLI 挂 script + 快照落点补忽略 (42b2ce0a2e)

**2026-10-31**
- 📚 Docs:切号条目口径按 2026-10-31 取证更正 + 补登统一入口与 MiniMax 回灌 (772eb33cca)

**2026-10-31**
- 🔧 Chore/Other:补 agent-engine parity 测试期望清单漏同步的 memory.refresh —— 清偿 79d4713885 的半截修复 (7e5dcd1021)

**2026-10-31**
- 🐞 Fix:清偿 devices.ts 两处 eqeqeq 存量 lint 红(0e875130c0 带入)—— 全量 turbo lint 臂清零 (a7e0cb5343)
- 🔧 Chore/Other:离线包按 HEAD 面重生成 —— 修正上一枚用工作树面取材导致的钉不一致 (ace1c864db)

**2026-10-31**
- ♻️ Refactor:门户维收敛候选集编排抽成纯函数,段级族可被构造面钉住 (182440479b)
- 🔧 Chore/Other:派生产物按最新 HEAD 面重生成 —— 补 webViewPortal.artifacts 词条,离线包与两枚路由钉同步 (bdd9129d40)
- 📚 Docs:miniapp 生产构建红按真跑结清(僵尸票) —— 构建 Compiled successfully 两点五四分钟 EXIT 零,主包余量四十万字节,dist 内 expo-modules-core 零命中,alias 与承载面 md5 与 HEAD 逐字相同 (fd7f9e2f28)
- 📚 Docs:Trae 逆向取证三册入库并补索引(上一轮只覆盖了 Qoder) (dc189f2ef8)
- 🐞 Fix:qoder 导入补齐会话模板 —— 模板此前在导入面被静默丢弃,池票永远 tpl=NULL (185987e308)
- 🐞 Fix:rn-compat 图标出口按 HEAD 面重生成 —— 补 ListTodo/MonitorSmartphone 两枚,门 251 C2 缺口清零 (16124c3b04)
- 🐞 Fix:清偿门 39 三条 HEAD 存量红(0e875130c0 旁路落地带回的未迁移形态) (577b3364ac)
- 📚 Docs:gitdir 描述只留实测相符的一条 —— 现读 test -d .git 为真、D:/IHUI-AI-git-repo 不存在;面上另有两条断言 28 字节 gitfile 的错版(照它处置就是把真 gitdir 当遗留删掉 = 删库事故,RP-78 立项正是为此),连同 10-30 旧版一并删除 (15c6b3ca1c)
- 🚀 Feature/Improvement:AI 代码归属落 Git notes(对齐 Trae 的 refs/notes/ai,并补「未判定」态) (1394337a75)
- 🚀 Feature/Improvement:web→RN 对齐链最后一枚缺口 artifacts 清零 —— 产物中心进 web-portal 门户(两端 WebView 承载, sso cookie 链路) (6ff6f36887)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (b88b1080c5)
- 🚀 Feature/Improvement:聊天端自动压缩上限改为按模型解析(对齐执行器侧与 Qoder/Trae) (19653cc078)
- 📚 Docs:删掉被取代的 gitdir 旧版描述 —— 同一机器事实两份并存,留 2026-10-31 实测更正版(.git 实体目录 / D:/IHUI-AI-git-repo 不存在 / 备份目录禁删清),删被取代的那份;门 207 与 238 复跑见末读数 (2040dbcdd0)
- 🚀 Feature/Improvement:输入上下文溢出应急压缩(对齐 Qoder/Trae) (8aa6e04350)
- 🚀 Feature/Improvement:补装 schedule_wakeup 延迟唤醒工具(定时四件套补齐),同 admin 档;修席遗留的 handler 注册键(测试随 ce51d9031 已落,本枚补实现件) (5cc32a4b19)
- 📚 Docs:207 再回预算内(95,207/96,000)+ gitdir 机器事实按实测改对 (c323d961bd)
- 🚀 Feature/Improvement:补装 schedule_wakeup 延迟唤醒工具(定时四件套补齐),同 admin 档;修席遗留的 handler 注册键 (ce51d90315)
- 📚 Docs:删掉第三条重复且与本机实测相反的 gitdir 断言行(仍写 gitfile 指向不存在的 D-IHUI-AI-git-repo) —— 同一条断言在文内已另有两条且均为实测正确的实体目录版; immutable-exempt: 删除的是会被后续读者当成事实的假断言重复副本,不新增也不放宽任何判据 (fce6073326)
- 🐞 Fix:生产构建红于 expo-blur → expo-modules-core 未编译 TS(补端内承载面 + 双段 alias) (335dbba679)

**2026-10-31**
- 🚀 Feature/Improvement:切号携对话全覆盖收口 —— MiniMax 会话回灌 + 统一入口 + 对账器扩到 8 平台 (05508a71a7)
- 🚀 Feature/Improvement:复登两枚「造好没装车」判据 + 修 CI 还原度假接线与两处零调度盲区 (8e9094548c)
- 🐞 Fix:恢复被 72769534b6 整片回退的离线包承载层装载 —— 生成器接回 bundleInputRels/rn-carried-keys,钉与门 105 的现算口径重新同源 (3b36cc477a)
- 📚 Docs:补 Agnes 生产落地三步 —— 密钥面 + 定价行落地 + 三处验证 (d99922c773)
- 🐞 Fix:8 枚 .ps1 补 UTF-8 BOM —— 门 265 的 HEAD 面绝对判据(含今天安全那批 deploy/win) (953b46af35)
- 🐞 Fix:切号连续性快照落点修正 —— 状态不再写进 scripts/.ihui-agent 树内 (638a0b0476)
- 🐞 Fix:补两件 HEAD 欠账(ps1 + 归档件)—— blob 档,别席在飞件一行不动 (3b647eaf63)
- 🔧 Chore/Other:补最后一枚归档件水印 —— 取 HEAD 内容注水,不碰别席在飞改动 (71adeb2b6f)
- 📚 Docs:207 体积回预算内 + 更正一条与实测相反的机器事实 (349f7a40fe)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (7a73ede0ec)
- 🐞 Fix:离线包生成器恢复承载层 —— 72769534b6 把它整段删了,门与单源 lib 却仍在按三层算 (6518d4415b)
- 🐞 Fix:schedule_task 落库的 conversation_id 改为真会话 id(此前写任务名,导致按会话查不到自建任务);补两条映射测试 (bb8df39199)
- 🚀 Feature/Improvement:注册门 269 API 路由唯一性(blocking,stagedTriggers=apps/api/) (030b894f1c)
- 📚 Docs:门 269 check-api-route-uniqueness 补进点名索引(R4 义务,先点名后注册) (1bb1c8c30c)
- 🚀 Feature/Improvement:补「同一 (method,path) 注册两次」的提交链判据 —— 今日已为此停摆一次 (46d65e94ac)
- 🐞 Fix:三处"判据看不见合法形制"的误报 + 专项档判据方向反了 —— 守门面按形态扩,阈值一个不动 (ed9d964382)
- 🔧 Chore/Other:旗清单落成 JSON + 镜像测试重写为 11 例(修 HEAD 上缺依赖的那一格) (b201309b88)
- 📚 Docs:RP-79 剩余面结清摘行(第二次,按回捞后的当前形态入账) —— 旗面单源完备性机器现算,未知旗闸装车 exit two 加定向说明放行,形状锁八例,自检一百五十八例,代码落地枚 d3201093f07 (830fee3d46)
- 📚 Docs:重落正本 §7b(首落 ee403f088c 被别席收敛吞掉,已打 lost-commit tag 保活) (f9c0dc1988)
- 📚 Docs:RP-79 剩余面结清摘行 —— 旗面抽单源且完备性机器现算(源码消费十六枚全覆盖),未知旗闸装车(exit two + 定向说明放行),USAGE 成套形状锁八例,自检一百五十八例全过,落地枚 d3201093f07 (7908385ffb)
- 🚀 Feature/Improvement:补装定时任务查询/取消工具 + run 三维机读计数;按创建动词同档收紧为 admin (1964518737)
- 🐞 Fix:收敛器装未知旗闸并把旗面抽成单源 —— 未认识的旗按用法错退出码二,定向说明可放行;清单完备性由源码扫描器现算而非人抄;形状锁八例。immutable-exempt: 本票要求为收敛器装闸并抽出清单单源,改动只新增闸与接线,不动任何既有判据与阈值 (d3201093f0)
- 🔧 Chore/Other:清 23 枚 HEAD 面水印欠账 —— 只补溯源载荷,零业务改动 (7cd758f4e3)
- 📚 Docs:补一行体积清偿指针 —— 44 行已整行移入 .ihui-agent/archive/AGENTS_trim-2026-10-31.md(规则条款一条未减;R4 点名义务同期转 README,补 17 枚门名),现读 95,121/96,000 (2f0140dc1f)
- 🐞 Fix:check-app-version-latest 补 --self-test(28 例)—— 此前文档写了跑不通的出路 (3f60aa920b)
- 🐞 Fix:重封 root-guard 清单 —— fea7830303 补门 268 时未同批封存,三个签出的部署环被 fail-closed 卡住 (c20d6ad587)
- 📚 Docs:R4 补点名 17 枚 —— AGENTS 体积清偿把 R4 登记补记整行移入归档件后,这些门的唯一文档点名处随之搬走(门 89 R4 立刻翻红 17 枚)。按 AGENTS 自己的口径「点名索引的正式归宿 = README」把 17 个门名补进索引节,判据不动;逐条判据/自检/跳过变量仍在各门体头注与原归档件里 (36f2020a6c)
- 🐞 Fix:关客户端改成「先枚举 PID、再逐个 /PID 杀」—— taskkill /IM 只收裸文件名,会连带关掉同名别的安装 (8379b3ad23)
- 📚 Docs:体积清偿 —— 44 行 R4 登记补记与同族重复副本整行移入 .ihui-agent/archive/AGENTS_trim-2026-10-31.md(门 207:121,974→95,121 B,预算 96,000;两步归档先移动后摘;七类必须留的判据各自存活至少一份;R4 点名义务由 README 索引承担,搬后门 89 R4 零红) (a1536eaa24)
- 🐞 Fix:tag 清仓要同时摘「存续层期望清单」—— 否则守护按清单把删掉的引用原样重建 (65788e5f6b)
- 📚 Docs:先把体积清偿要搬走的 44 行逐字归档,再动 AGENTS.md(两步归档:先移动、再摘) (e6eb9a03dc)
- 📚 Docs:RP-78 按实测结清 —— 票面称本机 .git 是 gitfile 被三面现读推翻(实体目录/非重解析点/D-IHUI-AI-git-repo 不存在),真风险方向相反且已在 AGENTS 更正(d59742000f) (ee4092b624)
- 📚 Docs:gitdir 形态按 2026-10-31 实测更正(工作区 .git 是实体目录,非 gitfile;D:/IHUI-AI-git-repo 不存在) —— 原文写反会把真库标成遗留并诱发误删; immutable-exempt: 更正与本机实测相反的机器事实断言,属 §0 七类机器事实每次现读要求的纠错 (d59742000f)
- 🐞 Fix:摘掉安装期的 wxt prepare —— 干净检出上它必解析不到 @ihui/i18n 的 dist,setup 一挂就带走 CI/OpenAPI/e2e/real-db/Knip 五条 workflow;prepare 改挂 typecheck 脚本,ci-monorepo 里并把该步移到建包之后;顺手补 build 作业 mirror-fidelity 的自述登记 (59c1bc650f)
- 🚀 Feature/Improvement:号池面板补齐健康四态 / 按供应商分布 / 24h 临期 —— 三格数据一直回但界面无人读 (7215469a79)
- 🔧 Chore/Other:RP-47 结清摘行 —— 两门 --staged 现读 rc=0(221:2118 枚逐一编译通过;254:零缺口),票面所称「恒取不到索引 blob」症状已不在;票面要求的可观测腿已装车(lib/face-reader 的 probeFaceSpec/describeProbe,两门未判定分支各接一次,镜像 39/39 含接线形状锁),落地 53d8ef47e9 (db197d2f1e)
- 🐞 Fix:RP-47 可观测腿 —— 两把门的「取不到」未判定必须点名命令/rc/stderr (53d8ef47e9)

**2026-10-30**
- 📚 Docs:复核第 4 行再改判 —— automation 工具真会执行,问题在僵尸模块与定时四件套缺位 (2c6154d191)
- 📚 Docs:派工前逐条复核 Top-12,第 1 行「审批收件箱缺失」与第 5 行「批准即生成规则」被现读推翻 —— 加 §3b 复核表并改派工序 (df330034d6)
- 🔧 Chore/Other:RP-90 结清摘行 —— 两处 prod 候选已同改吃 lib/prod-checkout-root 单源(HEAD 现读:deploy-decisions-face.mjs 注释自述 RP-90 已收、check-prod-checkout-foreign-work.mjs:90 import 且:584-592 通道C 走 prodCheckoutRoot),镜像 check-ops-patrol 51/51 + check-prod-checkout-foreign-work 1/1 全绿 (8c9486bd0b)
- 📚 Docs:能力树改为「源入库+产物不入库」—— candidate.json 与四份回执入库,HTML 按 .gitignore:295 的全局 *.html 规则不入库(不 -f 绕规) (c11469fdb8)
- 📚 Docs:O68 侧车归属改判无出口 按当场复跑证伪摘行 (声明式改判器 plan-fields-reclassify 在册且自检 9 通过 0 失败; O02 侧车 owner 已为机主真机验证面且 updatedBy 即该器; plan-tasks 派单现读对 O02 零命中) (6da6be99c2)
- 🔧 Chore/Other:守门 268 与兜底清扫器的 no-console 警告按同侪写法收口 (6014abefb3)
- 🔧 Chore/Other:G-50 结清删除 —— DevEnv 搬迁完成(旧根退役、备份卷改道) (19f5440261)
- 🐞 Fix:G-50 收口 —— 备份卷改道 §15b 批准落点,旧根 G:\DevEnv 退役删除 (e91f297336)
- 📚 Docs:守门 268 check-head-recall-stock 补进点名索引(门 89 R4 义务;AGENTS 已超 207 预算,AGENTS∪README 文档面按 README 归零) (b7989c8dfd)
- 🔧 Chore/Other:补落离线包派生面 —— 本席上一笔在合并前重生成,把"比源少 4 键"的包带进了 HEAD (0e6e8bfb45)
- 📚 Docs:提交/推送/合并改为 agent 自主强制动作 —— 取消'合并决策权归人',未合并检出改由 agent 依证据自主裁决(§12h 补条) (ed7b0f2098)
- 🐞 Fix:_model 的两处 no-any-return —— 收窄要判在"绑出来的局部"上,不是判在 .get() 表达式上 (e54a88d069)
- 📚 Docs:CSP 那行按线上实测更正 —— 文档写着比实际弱的面,本身就是缺陷 (244d6a4e0d)
- 🐞 Fix:收口被整块重复的登记(F6 块级判据的修复出口) (e2c9f7cf62)
- 🔧 Chore/Other:G-50 两形态并一 —— 摘除被取代的「等环境」旧行(正文已在保留行内) (bc70a3cad5)
- 🐞 Fix:停摆尺子读线上标记的落点硬写 .next —— 蓝绿形态下每轮读空并寄假停摆 (999e7051c9)
- 🐞 Fix:小程序 8 处调用接回真身并停止伪装 —— 与五语言同批(门 R2 规定含 messages/ 的提交取 scope=i18n,故本枚把端上改动与语言包同笔落) (c0f644a7c8)
- 🐞 Fix:补动态评论两条腿 + 邮箱验证码开 bind 场景 —— 前端接回真身的前置 (b52b052ee1)
- 🐞 Fix:一键模式的「快照已就绪」判据改与换桶同源 —— 昨天有快照不再冒充今天 (0d46f19685)
- 🔧 Chore/Other:快捷方式安装器入库 —— 桌面入口丢了/换机可一条命令重建 (3b195ef715)
- 🐞 Fix:收口被整块重复的登记(F6 块级判据的修复出口) (407c91eb36)
- 🐞 Fix:真机验证抓到两处「关闭客户端」缺陷 —— 进程名解析与强制兜底 (ca4874f3e5)
- 🚀 Feature/Improvement:补「HEAD 面回捞件」那一格——根治计划任务文档读数跳跃 (fea7830303)
- 🐞 Fix:派生弹窗存量 10 处归零 —— archify/rea 入仓时没带 windowsHide,这道门从那时起钉红所有人 (7681858835)
- 🐞 Fix:pre-push 的 tag-only 豁免看不见「删除 tag」——清仓实测 20 倍提速 (6272e5dca3)
- 📚 Docs:Qoder CN 0.5.1 REA 取证册入库(六层能力地图/33 轴判定/真缺 Top12/本轮被推翻 6 条) (18aea5255a)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (f4e3275aec)
- 🚀 Feature/Improvement:一键切号补齐客户端生命周期,桌面双击完成关→选号→切号换桶→续开 (ab064e7d80)
- 🐞 Fix:合并吞掉的 13 个拆分组件回盘 —— 小程序 typecheck 在 HEAD 恒红 (36f97a756a)
- 🔧 Chore/Other:补登 14 枚文件的溯源水印 —— 续 06efc5fe3e0c5516885408df8a76f65adfb12181 那笔未落完的 web/archify/ai-service 批次(上一会话在落地前中断);工作树面 14/14 载荷已验完好,本枚只把水印带进 HEAD (2d96e7167f)
- 📚 Docs:登记 HTTP 路由唯一性零判据与支付链缺测试面 —— 今日 /api/coupons/available 双注册把 API 整色挡在线下的后续工单 (5d5705b36c)
- 🚀 Feature/Improvement:大屏「使用数据」六块面板接线 —— 布局与数据一直在,页面从未渲染 (cffda9f484)
- 📚 Docs:更正"在线还原演练缺建库权限"那句 —— 隔离集群法已端到端实证 (d0eeb48556)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (6e0252f4ec)
- 🐞 Fix:/coupons/available 双注册把整个 API 色挡在线下 —— 支付页那支迁到 /pay 下 (399dc2969c)
- 🚀 Feature/Improvement:第二轮产品级差距修复(G1 跨设备/G2 自动化闭环/G3 产物管线/G4 计费弹性/G5 知识引擎/G6 企业治理 + E1/E2/E4) (0e875130c0)
- 🚀 Feature/Improvement:第二轮产品级五语词表(设备互联/交付物/自动化/企业治理/导入七源/CLI wiki) (9654b6a156)
- 🔧 Chore/Other:补齐两处源文件水印 —— csp.ts 与 tag 剪枝器 (97c20cc3d6)
- 🔧 Chore/Other:补登 4 个测试文件的溯源水印(HEAD 面欠账清偿) (06efc5fe3e)
- 🔧 Chore/Other:四枚按 g41-A 席一手证据结清(L28150 / L5645 / L5650 / L5644) (1cf14da043)
- 🔧 Chore/Other:恢复被整笔回退的两处判据 —— 敏感路由声明模型与 9 档事件清单按真实语义对齐 (af40ec736d)
- 🐞 Fix:清偿 ruff 全量 6 条(SIM103/UP037/I001/B905) —— 判据面禁改文件由本席按规则最小修正 (087f9e291c)
- 🐞 Fix:两屏颜色键按样式工厂约定回正 —— chipActiveText/tabActiveText/filterChipActiveText (b2b5f5fceb)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (f9012a7f35)
- 🔧 Chore/Other:G-1102638 批1 同主键副本行物理归并 — 删 8 行(机主拍板〔拍板@2026-10-08 机主:真删+立即执行〕;幸存者规则与F4同向;落账注记行保留待批2;复跑auditPlan对账F1=0/F9不增;逐行留痕 .ihui-agent/archive/PROJECT_PLAN_copy-purge-2026-10-30.md) (fa1954acfb)
- 🚀 Feature/Improvement:新增 relay:switch-oneclick 一键切号模式（自动建会话库快照+联动换桶，支持TTY交互选号，复用现有函数不复制逻辑） (484b0c8ec0)
- 🐞 Fix:清掉 2 条 exhaustive-deps 警告 —— 依赖表取稳定成员与移除未用 t (d9c1a97546)
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
