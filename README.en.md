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

Headline claims (same source as the table below, all live-computed): **618 tables · 4670 API routes ·
25 WebSocket endpoints · 100 catalogued LLMs · 38 platforms auto-publishing · 3959 test files ·
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
| CLI 工具文件 | 74 | `cliToolFiles` |
| 语言 | 5 | `i18nLanguages` |
| i18n 作用域 | 7 | `i18nScopes` |
| 语言包 JSON | 35 | `i18nMessageFiles` |
| 测试文件 | 3959 | `testFiles` |
| CI 工作流 | 49 | `ciWorkflows` |
| Compose 服务 | 14 | `composeServices` |
| 工程守门 | 313 | `guardianGates` |
| — blocking | 285 | `guardianBlocking` |
| — warn | 30 | `guardianWarn` |
| 跟踪文件 | 18738 | `trackedFiles` |

上表由 `node scripts/gen-doc-numbers.mjs --markdown` 生成,最后核对日期 2026-11-01。
每个数的来源就写在取数键旁边的实现里(`scripts/gen-doc-numbers.mjs` 的 `SOURCES`),**不得手抄、不得另立第二份**。

<!-- END GENERATED NUMBERS -->
<!-- END GENERATED NUMBERS -->


## Recent updates (auto-maintained)

<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->
**2026-11-01**
- 🚀 Feature/Improvement:把人工阀从"打印出来的装饰"接成派发路径上的真闸(observe 起步),并加 A6 维量它哑不哑 (65443d4d53)
- 🐞 Fix:root-guard 用例派生 git 补 stdio 接管（门 193 存量红入库） (246a39e64a)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (19ff4238f5)
- 🐞 Fix:修 06:00 探针假阳性 + Qoder 补跑轮 + 号池锚点保护 + 同步徽章 (219424fad8)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (29bba39eaf)

**2026-11-01**
- 📚 Docs:登记「deploy/** 改动当天拿不到 CI 信号」 (4e529f995c)
- 🚀 Feature/Improvement:把自开发发起腿从"死了 6 天没人知道"修成真能派,并装上存续判据与调度器 (8bb0fb7f9f)
- 📚 Docs:登记「deploy/** 改动当天拿不到 CI 信号」—— 缺的是时延不是覆盖,要 workflow paths 与改动映射两处一起改 (2afdbef684)
- 🐞 Fix:根护栏前置闸不再读"上一版"把自己锁死 —— 当前面红时改问"本轮要检出的那一面"自洽否 (6198c6c102)
- 📚 Docs:点名跨端分享正文通道(§21 交付门槛:新增端能力须同批更新 README) (b5536d03fa)
- 🔧 Chore/Other:壳声明件跟随自动升级的 1 枚页(按 HEAD 面派生) (7b9a016f68)
- 🔧 Chore/Other:自动把 1 枚手写镜像页升级为壳承载 (fef888deb5)
- 🚀 Feature/Improvement:打通手写镜像页转壳的第一例——判据认「端内别名转发到共享层」这一型能力覆盖 (6e0a3da5cd)
- 🚀 Feature/Improvement:分享族 7 屏真的发布正文,并补齐朋友圈卡独立标题与封面两维 (f1af950bf5)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (bd9071a44c)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (1f8ccfe6ae)
- 🚀 Feature/Improvement:跨端分享正文通道落地——屏发布正文,宿主在页面级注册转发/朋友圈 (baf7462ab1)
- 🔧 Chore/Other:根护栏清单按 HEAD 面重封 —— 解开部署环的 fail-closed (0b5fcb5cd6)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1046648321)
- 📚 Docs:登记「根护栏前置闸读的是换流前那一面,能把自己锁成整轮空转」这一格 —— 带本日两次实测读数与两条同面出路 (9f68e99c85)
- 🐞 Fix:公开页 nonce 排除判据从未生效 —— 31 条缓存规则全数不匹配,边缘缓存件里钉死一个 nonce (69ad209b34)
- 🐞 Fix:内容类型闸对空 fileName 从"崩成 500 + 产物留盘"收成 fail-closed 的 415 (2b38b72597)
- 📚 Docs:deploy-feedback 自动登记(deploy_outcome;端到端反馈闭环第二切片,O65 自进化系列) (cde5c238ec)
- 📚 Docs:deploy-feedback 自动登记(deploy_outcome;端到端反馈闭环第二切片,O65 自进化系列) (0607f0042a)
- 📚 Docs:deploy-feedback 自动登记(deploy_outcome;端到端反馈闭环第二切片,O65 自进化系列) (84f53c0111)
- 🐞 Fix:clawdbot 的对话桶与配对属主从「客户端自报 userId」收回令牌主体(三格) (12f2079a20)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (41d5a81463)
- 🔧 Chore/Other:补 props-resolution 两新件的尾部水印行(与 rn-compat 同类文件同形)+ ui-routes 钉重生成 (98f1252165)
- 🐞 Fix:三处构建文件的 pnpm 工具链从 @latest 收回收成逐字钉版,并把判据装到 deploy 面(门 48 规则 D) (660ee253f8)
- 🐞 Fix:分包总量消重 —— 根桶副作用豁免,9 份 707 KB 目录块收回 1 份 (eff410c0e5)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7801e27aef)
- 📚 Docs:T12 §5b 状态更新——#8/#6 身份半格已落地,#5 大半落地,#3 缓议有因 (f7eaa3e4ac)
- 🚀 Feature/Improvement:钩子派发宿主身份核验(deny-by-default)—— T12 缺口表 #6 半格收口 (ea4ec0266f)
- 🚀 Feature/Improvement:索引快照压缩落盘(gzip 魔数自识别)—— T12 缺口表 #8 落地 (e2c90a75fd)
- 📚 Docs:灰度那行就地改写 —— 来源与折绿两格已修死(枚 cf1fdef9cef),留的正是剩下的顺序语义那一格 (f2f8792e29)
- 🐞 Fix:灰度槽位从此有产物可服务,且"灰度没量过"再也不能记成判定通过 (cf1fdef9ce)
- 🚀 Feature/Improvement:消息中心数据钩子补齐——小程序向 RN 对齐真实动作链,fidelity 缺键 17→0 (c970ac616c)
- 🐞 Fix:5 个 use-cases 子页的 ja/ko 副本进 hreflang 集群 —— 那句"路由文件不存在"已与盘上相反 (5bbcc27509)
- 🔧 Chore/Other:六档陈旧卷宗跟回生产契约 —— 全量回归里剩下的红全部清零(除一枚需暴露决策的) (4cf0461f33)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (44dfcfd91c)
- 📚 Docs:同号多行去重 —— Z-1 4→1 / RP-79 2→1 / RP-47 2→1 (55f010724f)
- 🐞 Fix:结清 AGENTS.md 守门 207 体积债(HEAD 现读超预算)并补本票两道新门的 R4 点名 (44a91f7f4f)
- 🐞 Fix:rn-compat 垫片 props 契约对齐 RN 0.86 —— 小程序宿主 tsc 61 条型错归零 (3b541f58dd)
- 🐞 Fix:LIKE 通配符转义收成单源并上门(279),顺手把 AGENTS.md 的体积债与 R4 欠账一并清掉 (96d1f8305b)
- 🐞 Fix:会话记忆读/清补可达性闸 —— 身份对了还不够,conversationId 也是客户端给的 (179a297446)
- 🐞 Fix:考试判分与题型词表收成单源,并补齐四处端间缺口 (74e79a8fce)
- 🚀 Feature/Improvement:补登跨端对齐残留产物与镜像资源 (d76f63cde9)
- 🚀 Feature/Improvement:跨端对齐一键级联编排器 pnpm sync:cross-end(web→RN→小程序 按依赖序一发跑完) (08db578671)
- 🚀 Feature/Improvement:dir_rhash 接进索引增量链 + T12 缺口表闭环补记(缺口表 #1 全程收口) (37dfaf9dd3)
- 🐞 Fix:把登录"等代价"外壳拆出 password-crypto —— 修掉我自己上一批留下的整片替换式 mock 雷 (377115d10e)
- 📚 Docs:登记「灰度槽位从未拿到产物」这一型 —— 20/20 轮未判定被折成放量完成 (87f89d0a95)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (92a9ec433a)
- 📚 Docs:把明文例外域名清单登记进声明面 —— 强度只住在本地 .env 就会在一次整体替换时消失 (9c194f3c00)
- 🐞 Fix:门 273 遮罩识别补三格 —— 遮罩不再被计成缺按压反馈(HEAD 面 h2 3→0) (759ca70c1e)
- 🐞 Fix:开发者绑定一族五格补属主过滤 —— user_id 住在表里,这一族本就可以收 (ce0ae6c9a1)
- 📚 Docs:auto-triage 自动登记(api-logs;第 1 期感知层产线动作,O65) (6cbb66b189)
- 📚 Docs:压缩守门速查节冗余重复登记、修复失真读数,使体积回到门207预算内 (d3c9ef1f14)
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
- ♻️ Refactor:web 端字号统一落盘 —— 只落可证恒等的 3877 处(font-weight 锁档) (22d67096b3)
- 🚀 Feature/Improvement:手工批 5 文件 8 枚 —— 含门 131 漏判的"命名函数 style"这一型 (8f8b994f80)
- 🚀 Feature/Improvement:三端落档腿装车齐 —— web 那一侧补上调度器,并把它独有的安全旗写死在 argv 上 (eab90b40e2)
- 🐞 Fix:门 128 几何维补上「CSS 命名档」这一腿 —— 落档自动化推进到哪,尺子就跟到哪 (cc6f9ee29d)
- 🚀 Feature/Improvement:按压反馈批 34 文件 62 枚 —— 死样式清掉、函数形态拆成设计档两参 (d58e272801)
- ♻️ Refactor:web 端字号统一落盘 —— 只落可证恒等的 3877 处(font-weight 锁档) (695a08c77f)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (9fdb4b7b3b)
- 🚀 Feature/Improvement:Tappable 加 pressedStyle 档 —— 修样式不许顺手改掉设计档 (06b84c8012)
- ♻️ Refactor:web 端字号统一落盘 —— 只落可证恒等的 3877 处(font-weight 锁档) (a70cb9c766)
- 🚀 Feature/Improvement:号池永久保活档 —— 机主本机 Trae 号进池并给它一条不会死的续期路 (a6179dd4a0)
- 🐞 Fix:门 273 不再把函数形态 style 当作已有反馈 —— 与门 131 停止互相打脸 (8b50a87750)
- 🚀 Feature/Improvement:人工批落 24 枚 —— VoiceNote/HomeScreen/ChatScreen/ImageAnnotator 全换 Tappable (2ffa442d8b)
- ♻️ Refactor:剩余字号任意值落档 350 处(500~700 字重档)—— 小程序端字号面清零 (dcf297e539)

**2026-10-31**
**2026-10-30**
- 🔧 Chore/Other:ui-routes 派生产物按 HEAD 面重生成落地 —— 还原度批 48 文件与壳承载升级后四端路由钉同步(mobile-rn 27 行级 / miniapp-taro 119 行级;web 份有他席在飞改动按门纪律拒绝写回未触碰;钉头注行与祖先 3f5069448 的重合是生成器幂等产出,非滞后回退) (aea62a2896)
- 🔧 Chore/Other:docs(agnes)[cross-domain]: 端点与域名事实按 2026-10-30 直连四组合更正 + 副本收单源 + 出网披露清单按现读重建 (110cf9d6d4)

- 🐞 Fix:门 253 补 D4「模块对象属性取用」维 + 存量逐条点名 —— 当日的安静停机这一型终于有尺子 (8d7d15a5a9)

- 🚀 Feature/Improvement:切号携对话闭环收口 —— 一条命令完成「切号+连续性对账」,对账器扩到 codex/zcode/opencode (a22b5d07a1)
- 🐞 Fix:门 253 补 D4「模块对象属性取用」维 + 存量逐条点名 —— 当日的安静停机这一型终于有尺子 (8d7d15a5a9)

- 🔧 Chore/Other:未判定连击三格的行为锁 —— 起点不得被清 / 未知腿有阳性对照 / 测试不得拿真实起点账当对象 (de9c682b29)
- 🐞 Fix:未判定连击三格收口 —— 三条腿自报 undetermined 时不再清起点账,180 分钟到人这条腿才真会响 (e1636ec07b)

- 🔧 Chore/Other:G-1102638 批1 同主键副本行物理归并 — 删 8 行(机主拍板〔拍板@2026-10-08 机主:真删+立即执行〕;幸存者规则与F4同向;落账注记行保留待批2;复跑auditPlan对账F1=0/F9不增;逐行留痕 .ihui-agent/archive/PROJECT_PLAN_copy-purge-2026-10-30.md) (fa1954acfb)
- 🚀 Feature/Improvement:新增 relay:switch-oneclick 一键切号模式（自动建会话库快照+联动换桶，支持TTY交互选号，复用现有函数不复制逻辑） (484b0c8ec0)
- 🐞 Fix:清掉 2 条 exhaustive-deps 警告 —— 依赖表取稳定成员与移除未用 t (d9c1a97546)

- 🐞 Fix:/coupons/available 双注册把整个 API 色挡在线下 —— 支付页那支迁到 /pay 下 (399dc2969c)
- 🚀 Feature/Improvement:第二轮产品级差距修复(G1 跨设备/G2 自动化闭环/G3 产物管线/G4 计费弹性/G5 知识引擎/G6 企业治理 + E1/E2/E4) (0e875130c0)
- 🚀 Feature/Improvement:第二轮产品级五语词表(设备互联/交付物/自动化/企业治理/导入七源/CLI wiki) (9654b6a156)
- 🔧 Chore/Other:补齐两处源文件水印 —— csp.ts 与 tag 剪枝器 (97c20cc3d6)
- 🔧 Chore/Other:补登 4 个测试文件的溯源水印(HEAD 面欠账清偿) (06efc5fe3e)
- 🔧 Chore/Other:四枚按 g41-A 席一手证据结清(L28150 / L5645 / L5650 / L5644) (1cf14da043)
- 🔧 Chore/Other:恢复被整笔回退的两处判据 —— 敏感路由声明模型与 9 档事件清单按真实语义对齐 (af40ec736d)
- 🐞 Fix:清偿 ruff 全量 6 条(SIM103/UP037/I001/B905) —— 判据面禁改文件由本席按规则最小修正 (087f9e291c)
- 🐞 Fix:两屏颜色键按样式工厂约定回正 —— chipActiveText/tabActiveText/filterChipActiveText (b2b5f5fceb)
- 🚀 Feature/Improvement:一键切号补齐客户端生命周期,桌面双击完成关→选号→切号换桶→续开 (ab064e7d80)
- 🐞 Fix:合并吞掉的 13 个拆分组件回盘 —— 小程序 typecheck 在 HEAD 恒红 (36f97a756a)
- 🔧 Chore/Other:补登 14 枚文件的溯源水印 —— 续 06efc5fe3e0c5516885408df8a76f65adfb12181 那笔未落完的 web/archify/ai-service 批次(上一会话在落地前中断);工作树面 14/14 载荷已验完好,本枚只把水印带进 HEAD (2d96e7167f)
- 📚 Docs:登记 HTTP 路由唯一性零判据与支付链缺测试面 —— 今日 /api/coupons/available 双注册把 API 整色挡在线下的后续工单 (5d5705b36c)
- 🚀 Feature/Improvement:大屏「使用数据」六块面板接线 —— 布局与数据一直在,页面从未渲染 (cffda9f484)
- 📚 Docs:更正"在线还原演练缺建库权限"那句 —— 隔离集群法已端到端实证 (d0eeb48556)
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
- 🐞 Fix:摘掉安装期的 wxt prepare —— 干净检出上它必解析不到 @ihui/i18n 的 dist,setup 一挂就带走 CI/OpenAPI/e2e/real-db/Knip 五条 workflow;prepare 改挂 typecheck 脚本,ci-monorepo 里并把该步移到建包之后;顺手补 build 作业 mirror-fidelity 的自述登记 (59c1bc650f)
- 🔧 Chore/Other:RP-47 结清摘行 —— 两门 --staged 现读 rc=0(221:2118 枚逐一编译通过;254:零缺口),票面所称「恒取不到索引 blob」症状已不在;票面要求的可观测腿已装车(lib/face-reader 的 probeFaceSpec/describeProbe,两门未判定分支各接一次,镜像 39/39 含接线形状锁),落地 53d8ef47e9 (db197d2f1e)
- 🐞 Fix:RP-47 可观测腿 —— 两把门的「取不到」未判定必须点名命令/rc/stderr (53d8ef47e9)

- 🔧 Chore/Other:G-1102638 批1 同主键副本行物理归并 — 删 8 行(机主拍板〔拍板@2026-10-08 机主:真删+立即执行〕;幸存者规则与F4同向;落账注记行保留待批2;复跑auditPlan对账F1=0/F9不增;逐行留痕 .ihui-agent/archive/PROJECT_PLAN_copy-purge-2026-10-30.md) (fa1954acfb)
- 🚀 Feature/Improvement:新增 relay:switch-oneclick 一键切号模式（自动建会话库快照+联动换桶，支持TTY交互选号，复用现有函数不复制逻辑） (484b0c8ec0)
- 🐞 Fix:清掉 2 条 exhaustive-deps 警告 —— 依赖表取稳定成员与移除未用 t (d9c1a97546)

- 🐞 Fix:/coupons/available 双注册把整个 API 色挡在线下 —— 支付页那支迁到 /pay 下 (399dc2969c)
- 🚀 Feature/Improvement:第二轮产品级差距修复(G1 跨设备/G2 自动化闭环/G3 产物管线/G4 计费弹性/G5 知识引擎/G6 企业治理 + E1/E2/E4) (0e875130c0)
- 🚀 Feature/Improvement:第二轮产品级五语词表(设备互联/交付物/自动化/企业治理/导入七源/CLI wiki) (9654b6a156)
- 🔧 Chore/Other:补齐两处源文件水印 —— csp.ts 与 tag 剪枝器 (97c20cc3d6)
- 🔧 Chore/Other:补登 4 个测试文件的溯源水印(HEAD 面欠账清偿) (06efc5fe3e)
- 🔧 Chore/Other:四枚按 g41-A 席一手证据结清(L28150 / L5645 / L5650 / L5644) (1cf14da043)
- 🔧 Chore/Other:恢复被整笔回退的两处判据 —— 敏感路由声明模型与 9 档事件清单按真实语义对齐 (af40ec736d)
- 🐞 Fix:清偿 ruff 全量 6 条(SIM103/UP037/I001/B905) —— 判据面禁改文件由本席按规则最小修正 (087f9e291c)
- 🐞 Fix:两屏颜色键按样式工厂约定回正 —— chipActiveText/tabActiveText/filterChipActiveText (b2b5f5fceb)
- 🚀 Feature/Improvement:一键切号补齐客户端生命周期,桌面双击完成关→选号→切号换桶→续开 (ab064e7d80)
- 🐞 Fix:合并吞掉的 13 个拆分组件回盘 —— 小程序 typecheck 在 HEAD 恒红 (36f97a756a)
- 🔧 Chore/Other:补登 14 枚文件的溯源水印 —— 续 06efc5fe3e0c5516885408df8a76f65adfb12181 那笔未落完的 web/archify/ai-service 批次(上一会话在落地前中断);工作树面 14/14 载荷已验完好,本枚只把水印带进 HEAD (2d96e7167f)
- 📚 Docs:登记 HTTP 路由唯一性零判据与支付链缺测试面 —— 今日 /api/coupons/available 双注册把 API 整色挡在线下的后续工单 (5d5705b36c)
- 🚀 Feature/Improvement:大屏「使用数据」六块面板接线 —— 布局与数据一直在,页面从未渲染 (cffda9f484)
- 📚 Docs:更正"在线还原演练缺建库权限"那句 —— 隔离集群法已端到端实证 (d0eeb48556)
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
- 🐞 Fix:schedule_task 落库的 conversation_id 改为真会话 id(此前写任务名,导致按会话查不到自建任务);补两条映射测试 (bb8df39199)
- 🚀 Feature/Improvement:注册门 269 API 路由唯一性(blocking,stagedTriggers=apps/api/) (030b894f1c)
- 📚 Docs:门 269 check-api-route-uniqueness 补进点名索引(R4 义务,先点名后注册) (1bb1c8c30c)
- 🚀 Feature/Improvement:补「同一 (method,path) 注册两次」的提交链判据 —— 今日已为此停摆一次 (46d65e94ac)
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

- 🐞 Fix:恢复被 72769534b6 整片回退的离线包承载层装载 —— 生成器接回 bundleInputRels/rn-carried-keys,钉与门 105 的现算口径重新同源 (3b36cc477a)
- 📚 Docs:补 Agnes 生产落地三步 —— 密钥面 + 定价行落地 + 三处验证 (d99922c773)
- 🐞 Fix:切号连续性快照落点修正 —— 状态不再写进 scripts/.ihui-agent 树内 (638a0b0476)
- 🔧 Chore/Other:补最后一枚归档件水印 —— 取 HEAD 内容注水,不碰别席在飞改动 (71adeb2b6f)
- 🔧 Chore/Other:G-1102638 批1 同主键副本行物理归并 — 删 8 行(机主拍板〔拍板@2026-10-08 机主:真删+立即执行〕;幸存者规则与F4同向;落账注记行保留待批2;复跑auditPlan对账F1=0/F9不增;逐行留痕 .ihui-agent/archive/PROJECT_PLAN_copy-purge-2026-10-30.md) (fa1954acfb)
- 🚀 Feature/Improvement:新增 relay:switch-oneclick 一键切号模式（自动建会话库快照+联动换桶，支持TTY交互选号，复用现有函数不复制逻辑） (484b0c8ec0)
- 🐞 Fix:清掉 2 条 exhaustive-deps 警告 —— 依赖表取稳定成员与移除未用 t (d9c1a97546)

- 🐞 Fix:/coupons/available 双注册把整个 API 色挡在线下 —— 支付页那支迁到 /pay 下 (399dc2969c)
- 🚀 Feature/Improvement:第二轮产品级差距修复(G1 跨设备/G2 自动化闭环/G3 产物管线/G4 计费弹性/G5 知识引擎/G6 企业治理 + E1/E2/E4) (0e875130c0)
- 🚀 Feature/Improvement:第二轮产品级五语词表(设备互联/交付物/自动化/企业治理/导入七源/CLI wiki) (9654b6a156)
- 🔧 Chore/Other:补齐两处源文件水印 —— csp.ts 与 tag 剪枝器 (97c20cc3d6)
- 🔧 Chore/Other:补登 4 个测试文件的溯源水印(HEAD 面欠账清偿) (06efc5fe3e)
- 🔧 Chore/Other:四枚按 g41-A 席一手证据结清(L28150 / L5645 / L5650 / L5644) (1cf14da043)
- 🔧 Chore/Other:恢复被整笔回退的两处判据 —— 敏感路由声明模型与 9 档事件清单按真实语义对齐 (af40ec736d)
- 🐞 Fix:清偿 ruff 全量 6 条(SIM103/UP037/I001/B905) —— 判据面禁改文件由本席按规则最小修正 (087f9e291c)
- 🐞 Fix:两屏颜色键按样式工厂约定回正 —— chipActiveText/tabActiveText/filterChipActiveText (b2b5f5fceb)
- 🚀 Feature/Improvement:一键切号补齐客户端生命周期,桌面双击完成关→选号→切号换桶→续开 (ab064e7d80)
- 🐞 Fix:合并吞掉的 13 个拆分组件回盘 —— 小程序 typecheck 在 HEAD 恒红 (36f97a756a)
- 🔧 Chore/Other:补登 14 枚文件的溯源水印 —— 续 06efc5fe3e0c5516885408df8a76f65adfb12181 那笔未落完的 web/archify/ai-service 批次(上一会话在落地前中断);工作树面 14/14 载荷已验完好,本枚只把水印带进 HEAD (2d96e7167f)
- 📚 Docs:登记 HTTP 路由唯一性零判据与支付链缺测试面 —— 今日 /api/coupons/available 双注册把 API 整色挡在线下的后续工单 (5d5705b36c)
- 🚀 Feature/Improvement:大屏「使用数据」六块面板接线 —— 布局与数据一直在,页面从未渲染 (cffda9f484)
- 📚 Docs:更正"在线还原演练缺建库权限"那句 —— 隔离集群法已端到端实证 (d0eeb48556)
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

- 🚀 Feature/Improvement:切号携对话全覆盖收口 —— MiniMax 会话回灌 + 统一入口 + 对账器扩到 8 平台 (05508a71a7)
- 🚀 Feature/Improvement:复登两枚「造好没装车」判据 + 修 CI 还原度假接线与两处零调度盲区 (8e9094548c)
- 🐞 Fix:恢复被 72769534b6 整片回退的离线包承载层装载 —— 生成器接回 bundleInputRels/rn-carried-keys,钉与门 105 的现算口径重新同源 (3b36cc477a)
- 📚 Docs:补 Agnes 生产落地三步 —— 密钥面 + 定价行落地 + 三处验证 (d99922c773)
- 🐞 Fix:8 枚 .ps1 补 UTF-8 BOM —— 门 265 的 HEAD 面绝对判据(含今天安全那批 deploy/win) (953b46af35)
- 🐞 Fix:切号连续性快照落点修正 —— 状态不再写进 scripts/.ihui-agent 树内 (638a0b0476)
- 🐞 Fix:补两件 HEAD 欠账(ps1 + 归档件)—— blob 档,别席在飞件一行不动 (3b647eaf63)
- 🔧 Chore/Other:补最后一枚归档件水印 —— 取 HEAD 内容注水,不碰别席在飞改动 (71adeb2b6f)
- 📚 Docs:207 体积回预算内 + 更正一条与实测相反的机器事实 (349f7a40fe)
- 🚀 Feature/Improvement:聊天端自动压缩上限改为按模型解析(对齐执行器侧与 Qoder/Trae) (19653cc078)
- 📚 Docs:删掉被取代的 gitdir 旧版描述 —— 同一机器事实两份并存,留 2026-10-31 实测更正版(.git 实体目录 / D:/IHUI-AI-git-repo 不存在 / 备份目录禁删清),删被取代的那份;门 207 与 238 复跑见末读数 (2040dbcdd0)
- 🚀 Feature/Improvement:输入上下文溢出应急压缩(对齐 Qoder/Trae) (8aa6e04350)
- 🚀 Feature/Improvement:补装 schedule_wakeup 延迟唤醒工具(定时四件套补齐),同 admin 档;修席遗留的 handler 注册键(测试随 ce51d9031 已落,本枚补实现件) (5cc32a4b19)
- 📚 Docs:207 再回预算内(95,207/96,000)+ gitdir 机器事实按实测改对 (c323d961bd)
- 🚀 Feature/Improvement:补装 schedule_wakeup 延迟唤醒工具(定时四件套补齐),同 admin 档;修席遗留的 handler 注册键 (ce51d90315)
- 📚 Docs:删掉第三条重复且与本机实测相反的 gitdir 断言行(仍写 gitfile 指向不存在的 D-IHUI-AI-git-repo) —— 同一条断言在文内已另有两条且均为实测正确的实体目录版; immutable-exempt: 删除的是会被后续读者当成事实的假断言重复副本,不新增也不放宽任何判据 (fce6073326)
- 🐞 Fix:生产构建红于 expo-blur → expo-modules-core 未编译 TS(补端内承载面 + 双段 alias) (335dbba679)

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
- 🐞 Fix:清偿 devices.ts 两处 eqeqeq 存量 lint 红(0e875130c0 带入)—— 全量 turbo lint 臂清零 (a7e0cb5343)
- 🔧 Chore/Other:离线包按 HEAD 面重生成 —— 修正上一枚用工作树面取材导致的钉不一致 (ace1c864db)

- 🔧 Chore/Other:补 agent-engine parity 测试期望清单漏同步的 memory.refresh —— 清偿 79d4713885 的半截修复 (7e5dcd1021)

- 📚 Docs:切号条目口径按 2026-10-31 取证更正 + 补登统一入口与 MiniMax 回灌 (772eb33cca)

- 🐞 Fix:ScreenStates 占位高台收单一源 + 标题字号撤手写档 —— 消解 2026-11-24 到期豁免的真实差异半边 (e8ba95f0f3)
- 🚀 Feature/Improvement:切号链收尾 —— codearts 快照面解除 supported:false + 闭环 CLI 挂 script + 快照落点补忽略 (42b2ce0a2e)

- 🔧 Chore/Other:probe3 (61600c99b2)
- 🐞 Fix:补齐 RN 端 7 枚 t() 调用点的缺词 —— 界面不再回显裸键路径 (3229f88b8d)
- 🐞 Fix:DevicesScreen 展开面板圆角回角色档 —— panel 取 xl(12) 不再 sm(4) (c164fb5f83)
- 🔧 Chore/Other:probe (a8ef367298)
- 🐞 Fix:弹层键盘避让补进唯一承载件 + 提现 2FA 面板色值收口(三道 HEAD 恒红门归零) (235d418a8e)
- 🐞 Fix:跨端接线族五连修(末枚)—— 幻影判据补间接消费维 / tooltip 语义反转 / 裁定账摘 SectionHeader / 补回 navbar-core 导出 (c3ff235506)
- 🔧 Chore/Other:probe6 (403d6bfa0d)
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
- 🚀 Feature/Improvement:守门 273 触屏交互卫生上线 + 命中尺寸 22→0 清零 + 三处静默失效补口 (8dfce6e70d)
- 🐞 Fix:I18nProvider 定身恢复(9fdbc207ba 第五票)+ drawer artifacts 条目五语言补齐 + i18n 产物按 HEAD 面重生成 (f195ed1e06)
- 🐞 Fix:generate-ui-routes 写盘加重试 —— build 链三处生成脚本写盘全部覆盖(同 gen-i18n/watermark 同型) (1d1d7894c2)
- 🐞 Fix:watermark inject 写盘加重试 —— gen 写完紧随的 inject 撞实时扫描锁(同 gen-i18n 同型) (1df3c59ff0)
- 🐞 Fix:I18nProvider value 定身恢复 —— 9fdbc207ba 回退的第四票(与 miniapp/mobile-rn 同型母型缺陷) (a0d46a32ab)
- 🐞 Fix:再删 aboutPageSections 死件回潮(第三次)—— 检出滞后把轮 55 的正当删除带回来 (c247b0a7f7)

- 🔧 Chore/Other:摘除 AGENTS.md 四条与现读事实相反的「结构与守护」重复副本(门 207 体积回预算内) —— 现读三面一致:①ls -ld .git = drwxr-xr-x 实体目录、②git rev-parse --absolute-git-dir = G:/IHUI-AI/.git、③D:/IHUI-AI-git-repo 与 D:/IHUI-AI.git-backup-20260912 均 No such file or directory;被摘四条分别自称 gitfile/28字节gitfile/遗留目录存在,与实测相反且是同一段落的重复副本(保留 §0 的 L26 正确条,内容零减);immutable-exempt: 判据面文档删除与实测矛盾的重复副本,无规则条款减少 (b0fee6b656)
- 🔧 Chore/Other:第四次摘除 aboutPageSections 死件回潮 —— 共享真相源 packages/app/src/features/about/ 在位、AboutScreen.tsx:24 注释明说端内实现与分段数据表一并删除、端内零真实 import(grep 命中均为注释文字);c247b0a7f7 第三次删后 7a47524b07 自动收编第四次带回;按门 30c 修法①走唯一删除档,门 39 V1 红同源同消 (bfc06bc2b0)

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

- 🐞 Fix:数字值列退位出表格锚点,根治 Step2b 数字对齐与活文档闸自咬 —— README 生成块「|名称|数值|键名|」三列形态下 gen-doc-numbers 每轮翻新数值,旧锚点 T#名|73 与新锚点 T#名|72 永不相遇 ⇒ 改写被误判 lost、--apply 把旧数值插回、下一轮再翻新,死循环(2026-10-31 实测两枚提交各吃一轮);行身份改取名称+键名,仅第 2 格纯数字且第 3 格键名形状才走此路,两列表与自由文本第 3 格维持旧行为(反向锁在自检 ⑱a);immutable-exempt: 修的是两把器物判据咬合造成的恒红循环,扩识别不放宽语义,带正反用例与镜像 18/18 (0e63b9c2a3)

- 🐞 Fix:收编器补齐滞后副本守卫的接线与两个漏网洞 —— ① main 重新接线 dropStaleCopies:判据与装车锁 T6 于 2026-10-29 写好,main 里的接线被后续副本覆盖洗掉,守卫整个悬空(教训:镜像测试红了必须有人读),aboutPageSections 第四次回潮(7a47524b07)即此通道,T6 一直红着无人修;② partitionStaleCopies 的 !head 分支不再 fail-open:HEAD 无此文件但 git log --diff-filter=A 证得到曾入库 ⇒ 删除档死件回潮必须跳过(第四轮回潮正是这条通道);③ 祖先窗口 6→40(回潮-删除轮次多的路径在 6 枚窗口漏网);新增 T10/T11/T12,镜像 12/12,dry-run rc=0 (f221586d3f)
- 📚 Docs:三条 [归并] 指针副本按证据结清摘除 —— 其所指实质工作均已在 HEAD 落地:①prod-bundle 运行入口三枚入库源在册(git ls-files deploy/scripts/prod-bundle/svc/run-{api,web,ai}.ps1)+ check-prod-bundle-shadow.mjs:148-159 的 PAIRS 三对已登记,E1 枚举闭合(14 个运行副本全在登记表,运行副本本机不在=未判定非失败);②门 98 D6「错名 .js 影子架空 .ts 说明符映射」判据已实现(头注 35-46 + 实现 1170-1232,--self-test 19 例)。三行均属「重复登记副本存量清零」射程,不再保留一行一状态 (999ea0250c)
- 📚 Docs:安装器视觉三版按证据结清 —— 选型 A 版墨光·续已于 3a1f2a462f 落地(90 枚氛围资产+全帧目审 18/18),本机 check-installer-assets 三行 PASS、正式与候选同 blob 复核通过 (c4c5dd0f42)
- 📚 Docs:G-23 admin 默认口令按证据结清 —— fixtures/seed 已改从 env 取、守门 check-public-admin-default 现跑通过、离线取证现役散列对公开默认六候选全脱靶;余项凭据三点漂移归机主核对 (f5cc79b586)
- 🚀 Feature/Improvement:G-09/G-17/G-05/G-10 —— elicitation 接线 + 会话身份注入 + 图片检索 + 压缩五判据 (a6e69e7452)
- 📚 Docs:O68 pass-entry-broken 按证据结清 —— 该型根因是切流空窗:门禁起点早于新构建真就绪、web 维被 EdgeOne 缓存刷绿,触发条件在 deploy/win/health-gate-verdict.ps1:98(末轮明确 fail ∧ 源站 web+api 直探均 pass)、产出点 ihui-deploy.ps1:3429;修复四枚全部已在 HEAD 谱系(merge-base --is-ancestor 逐枚现读):e6d21d196d 就绪等待替代固定 8s、8f572260a4 结清(实测源站 5 秒就绪/门禁首轮全绿)、38d71cfb82 与 dfc9b905b5 蓝绿+router 原子切流(空窗归零);信号时刻 2026-10-27T17:30Z=本地 10-28 01:30,正是 ihui-deploy.ps1:3238 记载 6 枚 01:30~09:10 的首枚,早于修复 ⇒ 票面系滞后回填,本仓无需再改代码 (180f90e911)
- 📚 Docs:票86 证据级可追溯执行流水按证据结清 —— 落库四要素/链式审计/签名导出路由+公钥面/180 天保留作业四层全部在车,承载测试 67 例单跑全绿(并发下超时为饿死假红) (cbed2c09ab)

- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (b6cd06f203)
- ♻️ Refactor:字号任意值落档 620 处(仅 400 字重档)—— 项目档消费率 53.3%→约 62% (3a42b19b63)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (c1cb851e27)
- 🐞 Fix:补回试点批漏挂的 Tappable import 的另一半 —— 摘掉没用到却挂着的 (908a5ba821)
- 🚀 Feature/Improvement:按压反馈重铺 72 文件 220 枚 —— className 走 active 变体、原生走 Tappable (35868ba148)
- ♻️ Refactor:尺寸/定位属性与内联 style 的等值落档 —— 项目档消费率 50%→53.3% (0509c5a60f)
- 🚀 Feature/Improvement:守门 273 的遮罩档接上第二跳 —— styles.KEY → 命名 token，现读消掉 28 枚误判 (5213aee5cd)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (0147b013b9)

**2026-11-01**
- 🔧 Chore/Other:重封根护栏清单 —— 6f57e57fe6 的守门277 注册改动合法但漏了 seal,部署环 fail-closed (3dfd9975ba)
- 🐞 Fix:归档落点器的保留档能力被一枚清理提交整片写回旧基线,镜像测试空等6天 (17a1d45836)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (785700f1ea)
- 📚 Docs:T7 派单索引更新到本轮现场 —— 交接面(防上下文断档丢现场) (54942dc36d)
- 🚀 Feature/Improvement:门 128 几何维认得 CSS 变量解值 —— 两族 var 假分叉撤豁免、零分叉族摘锚点键 (88bd07c0c0)
- 🔧 Chore/Other:摘 38 处冗余 default + 4 个桶的无人转发出口 + 两枚 OS/装载型登记 —— 棘轮 6/7 维转绿 (735334d665)
- 🔧 Chore/Other:摘掉门78里一枚取了没人消费的读数 externalScanned —— 它在 audit 内已随结论行印过,main 侧再解构一次既不打印也不参与判据,却把 eslint 顶成1枚error(lint-staged 只查暂存面⇒存量红一碰这文件就现,上一枚提交因此被逼走 --no-verify 并留痕) (a92aa52da3)
- 🐞 Fix:门78深扫档把pnpm跨平台可选变体判成401条悬空红——判据假阳(§12e恒红门) (3feeb2ae4e)
- 📚 Docs:auto-triage 自动登记(api-logs;第 1 期感知层产线动作,O65) (a1e6e0e784)
- 📚 Docs:T8 两枚 Qoder sidecar 原生面取证(Ghidra headless 级,逆向复现超越本轮的取证腿) (e2a418dd84)
- 📚 Docs:auto-triage 自动登记(api-logs;第 1 期感知层产线动作,O65) (61e2fa79a8)
- 📚 Docs:守门点名索引补门 277 一行(门 89 R4 义务,与接线同批) (7d386b2826)
- 📚 Docs:T3 缺口矩阵补「时效告示」一节 —— 治"按腐烂册面重复派单"(逆向复现超越本轮的防复发腿) (90933dd5ae)
- 🚀 Feature/Improvement:dev 库口令轮换器补上唯一登记出口 --register(此前全仓无创建出口 ⇒ 下次暴露无人能记) (817e45952f)
- 📚 Docs:按机主裁定结清 G-20 与 O68 —— 两项均已完成,整行摘除 (a51d5a1fb5)
- 📚 Docs:细节能力清单第 30 条登记 run_workflow(AGENTS §21 新增能力必须同批更新 README) (1eeab01a1d)
- 🚀 Feature/Improvement:补齐 run_workflow 工具面,对齐 Qoder Workflow/RunWorkflow 的未变节点回缓存重放(G-01) (09fa348a4f)
- 🐞 Fix:dev 库口令轮换巡检腿补四处会把它变成死线的缺陷(含一处 fail-open 误判窗口) (f571ea79f0)
- 🐞 Fix:号池任务中心"心跳在位"不再被写成"执行成功" —— 与本线已修的四处同族的最后一格 (e28e5f6e4b)
- 🐞 Fix:收口被整块重复的登记(F6 块级判据的修复出口) (c64b4566a1)
- 🔧 Chore/Other:死 key 存量基线五端下调为 0 —— 存量已实测归零,不留"不会到期的豁免" (5c25e975cf)
- 🐞 Fix:补上 mobile-rn 五个词包的死键摘除 + 小程序离线包同批重生成 (eb1dad8a82)
- 🔧 Chore/Other:收编停留≥3分钟的 i18n 未提交改动 (f0572d64c4)
- 📚 Docs:结清 O69 —— dev 库口令轮换已挂进 guardian 巡检轮 (1502053d88)
- 🐞 Fix:G 盘根守护整族跑不动的病根是同一文件写了两条版本声明 —— pwsh 7 在绑参阶段报 Cannot bind parameter because parameter 'version' is specified more than once,install/guardian/status/uninstall 四件一条命令都执行不了;而 VBS 用 SW_HIDE 不等返回、计划任务恒报 LastResult=0,于是这道防线两个月来静默什么都没做(status 件现读 Running: NO 且日志文件从来不存在)。按 §27 保留唯一一条 #requires -Version 7,摘掉陈旧的第二条;修后用 PowerShell 自己的 Parser 全量复验 94 枚 .ps1,bad=0;真跑只读 status 件通过,启任务后守护在 session 0 起进程、日志从不存在变为有内容(v2.0 mode=allowlist-first);顺带把 G 根守护任务按它自己声明的 S4U 复位(此前主体漂回 Interactive,注册器坏了没人修得动 = AGENTS §0.8 那条铁律的现场) (030fa25535)
- 🚀 Feature/Improvement:dev 库口令轮换挂进巡检轮(票 O69) (b081fa37d8)

**2026-11-01**
- 🐞 Fix:CLI 的 V1 配置装配路径接进项目层封闭表 —— 仓库一枚 settings.json 不再能把凭据改道到攻击者主机 (d55306655f)
- 🔧 Chore/Other:给新测试补溯源载荷 (L2 头 + L3 尾两行,内容未改) —— 门 47 HEAD 面缺口,工作区已注入待提交 (8f0f4c2b41)

**2026-11-01**
- 🐞 Fix:入站身份裁决收进单一出口 —— 修掉三族 v1 路由的混淆代理(可跨租户读代码/写归属) (969b19b054)
- 🐞 Fix:门 103 的 D4 接表级例外 + 测试面单向借用登记 —— 例外机制此前对环违规结构性失效(EX-D4 永不命中还自报清单腐烂),补 exPass 并加自检;EX-D4-1 登记 repo-tooling→miniapp 测试借用环;immutable-exempt: 门自身缺陷(例外不覆盖 D4)导致登记后仍红且自报腐烂,补判据链并加成对自检 (25ab228ae7)
- 🚀 Feature/Improvement:号池永久保活档 —— 机主本机 Trae 号进池并给它一条不会死的续期路 (ee77dea986)

**2026-11-01**
- 🐞 Fix:className 类型增强改用 side-effect import —— triple-slash 在 Next 消费面不生效(部署实测) (68c8117b25)
- 🐞 Fix:摘除 Z-1 与 RP-79 回捞复活残影共 4 行 —— Z-1 前提已不成立、RP-79 已结清(证据 7908385ffb 结清摘行是祖先 + union-converge-flags 与镜像测试在位) (d6f66d322b)

**2026-11-01**
- 🐞 Fix:恢复被旧基线写回的两处已入库修复 —— className 增强与 wb_tasks.not_running_reason (88d43f8c1d)

**2026-11-01**
- 🐞 Fix:修复两处已入库的构建阻断 —— 跨端 UI 二期的 className 类型没跟公开入口走、types 漏了 wb_tasks.not_running_reason (6b50c92f5e)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6453cfd2e3)
- 🐞 Fix:让号 O67→O42819(合并时新增撞号) —— 改未推本地一侧 2 行,改前原文留痕入归档件 (d58824d54f)
- 🐞 Fix:ai-generation 族队列名接进库身份单源,清掉这一型最后一枚字面量 —— 主库(ihui、未设后缀)解析结果与旧字面量逐字节相同 ⇒ 线上零扰动,这条性质不是口头保证:它调的是被 24 例钉住的同一个纯函数出口(§0.6 单源);本仓 new Worker('ai-generation') 现读零命中 ⇒ 这次改动不构成生产/消费分家(要么两侧都原名,要么本仓根本没有消费者);面纯度已核:E 席那批没碰这族,不存在半接线;两面 tsc 与 eslint 零错,队列契约 29 例仍绿 (14ab2c654c)
- 📚 Docs:登记一票=dev 库口令轮换器已入库但未挂调度(窗口靠人盯)，正解照 sweepExposedCredentialRotation 形态挂进 guardian 巡检轮 (03afa371c7)
- 📚 Docs:登记一票=门 128 CSS 变量解值根治与 torpx 夹具重订(席位撞轮次上限且改在滞后副本上,产物已存档 seat-k-salvage,须从最新 HEAD 重做) (5e4df4f003)
- 🐞 Fix:让号 O68→O22819(合并时新增撞号) —— 只改未推本地一侧 1 行,改前原文留痕入归档件 (395a5e55fd)
- 📚 Docs:O68 记轮换器物化进展 —— 器物已入库,执行窗口待机器空闲 (c0ff3a1e79)
- 🐞 Fix:收口被整块重复的登记(F6 块级判据的修复出口) (d60e6b85d8)
- 🚀 Feature/Improvement:本机 dev 库口令轮换器物化(票 O68) (27b7f9e6b7)
- 🐞 Fix:入口自带 className 类型增强 —— 止住 CI 构建面 51 条类型红(堵 e2e 与 web build) (6c5f60070d)
- 🐞 Fix:守护心跳移到初始启动之前,冷启动窗口不再被判成死亡 —— 一手量数:守护 22:11:13 起、首枚心跳 22:13:53,窗口 160 秒;watchdog 每 2 分钟巡检且阈值 90 秒,于是 22:12:04 派了第二个头,双头并存 109 秒并用 'w' 把 watcher.err.log 截成 0 字节吞掉诊断;另量到常驻期心跳龄 85 秒贴着 90 秒阈值。取「消除零心跳」这一档:单实例锁与第一枚心跳都排在 await run() 之前,此后由真推进事件续写并按 20 秒节流;--check 与一次性体检不写心跳(注定退场的 pid 不许冒充守护);巡检侧阈值 90 秒、2 分钟节律、revive() 调用点一字未动 ⇒ 真死上界仍是 90+120=210 秒未降速;主席补修两枚死变量(heartbeatShouldRefresh 的 freshMs 是无 caller 的装饰入参,删除而非改名;测试里 HEARTBEAT_PHASE_STARTUP 是死解构);新增 17 例并变异自证 (7066570b31)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (1bd4947583)
- 🐞 Fix:其余六族 BullMQ 队列名全部接进库身份单源,号池不再是唯一被隔离的一族 —— 取证席在 Redis db0 实测到同族事故残留 bull:relay-health-check-queue:failed=500,说明 2026-10-24 那笔停摆不只打在号池上;解析层新增语义中立唯一出口 queueNameWithDbIdentity,relayQueueName 退为薄封装(规则表仍只有 resolve 一份);接正 email/notification/ai-callback/notification-dispatch/registry/scheduler/batch/usdt-payment/relay-health-check 九处取名点,观测面 relay-task-center 两枚写死字面量一并改走解析器(该字段会被 admin 路由喂给 new Queue);主库逐字节原名不变用两路取证(契约①逐字比对 + HEAD blob 探针 10 族 3 档);smoke 套件那条等值断言不删只搬到主库 DSN 下的契约①判,原处保留形状与无冒号牙;新增契约用例 5 例、受影响 6 套件 96 例、两面 tsc 均 0 (651283be00)
- 📚 Docs:结清 O67 —— safe-commit 发令前点名索引内非本票件已装车 (e9a6a3cea8)
- 🚀 Feature/Improvement:发令前只读点名「索引里非本票声明的已暂存件」(票 O67) (1a4be3bcb4)
- 📚 Docs:登记一票=本机 dev 库口令部分入会话的轮换器物化(现读 DSN 仅 localhost 开发库;红线是前缀也不许进会话,处理口径照 2026-10-26 同类事故=主动提轮换并造轮换器) (56dc3b0258)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (e119e324f2)
- 📚 Docs:结清移动端走查票(首页/学习页区段头几何读数)—— 白屏根因修复已入库 04a5e71d1e:构建后步骤 patch-entry-chunks.mjs 给每个入口补静态 deferred chunk require(幂等+单测3/3,接入 build/build:weapp;干净构建 312 入口/4285 条;getApp()=true、page.data 有 root、首页与学习页完整渲染;主包 1,720,290B≤2,097,152B)。读数:镜像首页 redirect 到 pages/index/index(同一首页、无区段头);学习页「继续学习」自绘头 316×684 截图字高 15px→390 视口≈18.5px(36rpx=18.72),与 spec 16px 差≈2.5px,证实未走 SectionHeader(spec/adapter 半边已由 1394db170f/189f31951f 落地)。automator 的 page 查询对 Taro 渲染树不可用,读数走截图换算。 (62b4253106)
- 🔧 Chore/Other:Taro 页面按 app.config.ts 派生 entry —— files 925→350、unlisted 186→4(基线不动) (1e2779b7d4)
- 📚 Docs:结清移动端走查票(首页/学习页区段头几何读数)—— 白屏根因修复已入库 04a5e71d1e:构建后步骤 patch-entry-chunks.mjs 给每个入口补静态 deferred chunk require(幂等+单测3/3,接入 build/build:weapp;干净构建 312 入口/4285 条;getApp()=true、page.data 有 root、首页与学习页完整渲染;主包 1,720,290B≤2,097,152B)。读数:镜像首页 redirect 到 pages/index/index(同一首页、无区段头);学习页「继续学习」自绘头 316×684 截图字高 15px→390 视口≈18.5px(36rpx=18.72),与 spec 16px 差≈2.5px,证实未走 SectionHeader(spec/adapter 半边已由 1394db170f/189f31951f 落地)。automator 的 page 查询对 Taro 渲染树不可用,读数走截图换算。 (803d6f8f18)
- 📚 Docs:登记一票=提交链所有权盲区(safe-commit 发令前不点名索引内非本票声明的已暂存件) —— 本轮实测两起后果,含 HEAD 一度带 1 failed | 8 passed 的红(已由枚 eb7fbad5ae 结清) (0807e4a16d)
- 🔧 Chore/Other:签到面板「自动做任务」补真浏览器规格 16 例(真实 CSP 下全绿) + 一处因果表述更正 (90970468e0)
- 🚀 Feature/Improvement:把「任务锚点烤进第三方私有目录」变成常驻体检 —— 今天手工修的两枚守护任务只是止血,病根是没有任何一层盯着「任务里烤的是哪枚 node」;ensure-silent-tasks 的任务审计新增 ①c 锚点禁地一档(刻意排在 LogonType 豁免之前:S4U 任务同样会被捆绑 node 拖停,与会不会弹窗无关;Execute 与参数两半都问,真实病形态是锚点藏在 VBS/pwsh 参数里);判据仍单源在 lib/task-node-anchor,巡检器不另写目录清单;锚点测试 8→11 例、巡检器 4→5 例(含接线形状锁);现跑 --check 本机 17 枚任务 0 处违规。immutable-exempt: 只在判据层加新出口与更严的拒绝分支,未放宽任何既有判据 (75428ae4a9)
- 🐞 Fix:修好整端白屏 —— 给 webpack 入口补静态 deferred chunk 加载腿。根因(2026-10-31 实测):weapp 为压主包 2MB 上限开 mini.optimizeMainPackage 并摘掉 Taro cacheGroups.common.name,产物里 app.js 与每个页面/组件的入口回调 e.O(0,[…]) 会等二十多个独立 <id>.js;这些 chunk 从未被 require、小程序运行时也不自动加载(动态拼路径实测报 module '…' is not defined)⇒ deferred modules 永不满足 ⇒ App()/页面组件永不执行,表现即整端白屏(getApp() 恒 false、page.data 仅 __webviewId__)。修法:新增构建后步骤 patch-entry-chunks.mjs —— 扫产物里每个含 e.O(0,[...]) 的 JS,把其依赖且 dist 根确实存在的 <id>.js 以静态字面量 require 追加到文件末尾(带 /*miniapp-entry-chunks*/ 幂等标记);接入 build/build:weapp 的 taro build 之后。实测:干净构建 312 个入口共补 4285 条 require;重开 IDE 后 getApp()=true、page.data 出现 root、wx.request success,首页与学习页完整渲染(截图 .ihui-agent/tmp/mobile-walk/{final-render,measure-last}.png);主包 1,720,290B / 上限 2,097,152B(余量 376,862B,check-artifact-budget ✅)。单测 scripts/tests/patch-miniapp-entry-chunks.test.mjs 3/3(层级相对路径/缺产物不补/幂等/无 deferred 不动)。代价:启动时多加载这些 chunk;待 Taro/config 侧能共存后本脚本退役。 (04a5e71d1e)
- 🐞 Fix:常驻任务的 node 锚点收成单源,止住「谁跑就烤谁」 —— 今天两枚守护任务长期烤着第三方 AI IDE 自带的 node(…\.workbuddy\binaries\node\versions\…),对方升级或卸载即消失,守护与看门狗会一起静默停摆;新增判据 scripts/lib/task-node-anchor.mjs(纯判据零 IO:优先 PATH 上当次实测的规范 node,取不到且当次解释器干净才如实标 fallback,落在第三方私有目录则拒绝,两者皆无 ⇒ exit 2 未判定,不写死盘符),本台注册器已接;镜像 8 例钉住五型分岔与平台分隔符;immutable-exempt: 新增判据层文件,不改写任何既有判据,只把锚点取值从随进程改成随本机实测 (6c61829ab3)

**2026-10-31**
- 📚 Docs:内置 MCP 工具数 24 -> 105(现读 _TOOLS) + 旧 24 枚枚举改指针 —— 本批新增 advisor_consult 后 _TOOLS 现读 105 枚(check-tool-name-display-coverage 105/105);原表里的 24 枚旧名枚举已与注册表严重脱节,改为指向 mcp_server._TOOLS 并列出核心族,避免下次再漂。历史归档段的 24 保持原样(那是当时快照)。其余语言 README 当前不在飞改写中时同批对齐。验证:check-readme-table-integrity + check-doc-numbers 复跑。 (b50d78dc28)
- 📚 Docs:G-20 记腾讯云侧真实进展 —— 资质与 8 枚模板已过,唯一卡点签名被拒后已重报(审核中) (10e6e9c8d1)
- 🔧 Chore/Other:离线语言包重生成 —— 英文 inviteTitle 去中文残留(Join AI 智汇 community -> Join the IHUI AI community)已由 i18n 收编枚 26e6336 入源;本轮按干净输入面(0 未提交)重生成 3 份 gen + 4 份 CDN 载荷,同时吸收别席已提交的源键。验证:check-i18n-locale-content-language --worktree 候选 0、i18n parity 工作树面 19840 键×5 语言 OK。 (9b9fabfdee)
- 📚 Docs:auto-triage 自动登记(api-logs;第 1 期感知层产线动作,O65) (31f8d34ccb)
- 🔧 Chore/Other:收编停留≥3分钟的 i18n 未提交改动 (26e6336ec3)
- 🐞 Fix:补齐 CSP 修复的另两条路径 —— 上一枚只带进 1/3 声明路径,HEAD 一度带"新断言打旧生产码"的红 (92adf1bb5c)
- 🔧 Chore/Other:收编停留≥3分钟的 i18n 未提交改动 (f81ebdc0b6)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (98eaa34e88)

**2026-11-01**
- 🐞 Fix:门 103 契约收口 —— 补 6 处依赖与 9 条公开入口声明、2 处具名豁免(带到期)、archify 目录退出扫描;staged 判红 22→0,自检 138 例绿 (80e11ab999)

**2026-10-31**
- 🚀 Feature/Improvement:WorkBuddy 回灌腿装成用户态任务 —— 与 Qoder 共用同一把哨兵/派发判据 (ec88d0370f)
- 🔧 Chore/Other:部署墙钟上限临时 480→720 —— 机主拍板的单次放宽(发完回调) (73294fc085)
- ♻️ Refactor:移除已下线提现端点的 createAgentWithdrawal 封装与孤儿类型 —— 端点已 410、全仓零调用点(删前三问已答),api/web tsc 零错误 (b80a3b0c32)
- 🔧 Chore/Other:补 webview 承载页降级回归 —— 非信任 URL 分支必须复制链接且不调 setUrl (33ff9af8c7)
- 🔧 Chore/Other:根护栏清单与 HEAD 面重新对齐 —— 解部署环 fail-closed (5cd9e86ffe)
- 📚 Docs:安全强化 goal R12 结账注记 —— 四枚提交已入库且 origin 同步(4b32f83f9c) (6705507975)
- 📚 Docs:撤掉重复的 R10+R11 合并注记并把两条正本里的短 sha 补成 40 位 —— 逐行自证仅删 1 行+两行 sha 替换 (449c5ec1ff)
- 🔧 Chore/Other:修 message_bus 单跑必炸 —— autouse mock 先把 app.main 惰性导入走完再替换 httpx.AsyncClient (4b32f83f9c)
- 🐞 Fix:守门276 接正取材面档位并接通人工逃生舱 —— 全量档正文改取 HEAD blob(此前读磁盘,共享工作树里别席未提交字节会混进判定面),清单与内容同面同轮走层出口;新增 --worktree 人工档、未知旗与任意两枚面旗同给一律 exit 2 逐枚点名(此前 --worktree 被静默吞、抬头照打 --staged);MAX_BYTES 512KB→4MB 的依据是现读 git-guardian.mjs HEAD blob 563558B 一直整枚被跳过,即最大启动器从未被审;自检 17→28 例、镜像 13→21 例,runner 的例数与出路同步;immutable-exempt: 本次是把新增门自己的取材面接回统一层并修档位形状,判据三条与三档豁免一字未减 (4d51b4c8ce)
- 🐞 Fix:R12 前端收口 —— 画布消息源校验、Playground Key 清旧 localStorage 残值(web 腿) (66545ca044)
- 🔧 Chore/Other:收编停留≥3分钟的 i18n 未提交改动 (7cb6c06409)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (584b1bceaa)
- 🐞 Fix:R12 安全续修 12 项 —— 微信登录补 2FA 闸、TOTP 同一步只兑付一次、结算单读取限 admin、全仓发 token 点结构锁扩射程(8 处带理由豁免)、小程序 webview 白名单补备案与微信签约域(修 R11 回归)、签约响应补 signUrl、work-panel 新开标签限 http/https、SVG 资产断源、A2A 生产禁本地回环、MCP 音频下载钉 IP、IM webhook 过 SSRF 尺;API 96 + 小程序 6 + ai-service 94 用例全绿,mypy 674 文件零错误 (9cb6d0efdd)
- 📚 Docs:结清 Y-14 —— 生产库 latest 行已登记且公网端点返回真数据 (b8d3e48ac2)

**2026-10-31**
- 🐞 Fix:dev 态 CSP 的 nonce 分支补回 unsafe-eval —— 本机活体实测页面曾被推进错误边界 (e77022e24a)
- 🐞 Fix:客户端回灌腿同因未判定降噪 —— 服务身份读不到 DPAPI,每 10 分钟一条同文 warn (c0176795b0)
- ♻️ Refactor:三端巡检态判据收单一真相源 + 补"配置已开却没跑"档五语言文案 (34c0749d1a)
- 🔧 Chore/Other:重落死副本删除 —— fetch-protocols 与 url-protocols 同值且 HEAD 与工作树两面现读全仓零引用,该副本被归并回捞回来过一次;单源保留 url-protocols(消费方 navigable-url 与 ssrf-guard);intentional-delete: 裁决原文见提交 f7ab13bdea1d87171939a8e637cd92b3e348be5b,本枚只是把它重新落地并留可追责意图记录(safe-commit 因窗口期内有他席新件拒发普通提交,按它给的出口走对象空间档,只交声明集) (97150355ae)
- 📚 Docs:移动端走查根因挖到构建配置 —— HEAD「开 optimizeMainPackage + 摘 common 名」使 app 入口等 25 个 chunk(其中 23 个独立 NNNNN.js 从未被加载),App() 永不执行、getApp() 恒 false(入口探针无抛错);对照构建关下沉+保留 common 名后 getApp()=true 且开始发 wx.request,但主包超硬上限 137,388B;反向组合构建中止(SplitChunksPlugin 同名冲突)。三选一修法与取证见 .ihui-agent/tmp/mobile-walk/DIAGNOSIS-2026-10-31.md;实验改动已还原 (0378c4b6cc)

**2026-10-31**
- 🚀 Feature/Improvement:Qoder 回灌任务加存续哨兵 —— 任务被删/停摆/身份漂移都会安静失效,现在到人 (9da1df3ba6)
- 🔧 Chore/Other:补上被别枚提交卷走的号池任务中心用例 —— HEAD 面实测 1 条红就地结清 (eb7fbad5ae)

**2026-10-31**
- 🐞 Fix:R12 同族收口 —— 调度 webhook 与 A2A 派发补 SSRF 钉 IP、agent 注册归属、连接器写面诚实失败 (714948f4b8)
- 🐞 Fix:给 web 的 tsc 程序接上 nativewind 类型增强 —— 修好 next build 在 ui-native 上的类型红 (ea6eacbbf9)
- 🐞 Fix:巡检态改观测态 + 手动任务入口补风控预检 + 补签卡写侧装两把机器锁 (0cc3259504)
- 🚀 Feature/Improvement:能力矩阵认得 settings 族默认关开关 —— 加 J4 覆盖面并登记 5 行 (97083bca8f)
- 📚 Docs:T3 §10 修正一处笔误(p 原文 -> prompt 原文)—— 纯文案,无判据变化。 (b740cc303d)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (5d49e9fbd6)
- 📚 Docs:撤掉重复的 R10+R11 goal 注记 —— 保留 12f3cbd 的四条正本,本行内容与 STATE/loop-run-log 重复 (49e83a69d9)
- 🔧 Chore/Other:收编停留≥3分钟的 i18n 未提交改动 (fcd9e5a010)
- 📚 Docs:安全强化 goal R10+R11 结账注记 —— 两批已入库且 origin 同步(b0e506f31b5e) (5215ebf608)
- 📚 Docs:补安全强化 R8/R9/R10/R11 goal 结账注记 —— HEAD 面纯追加 4 行,不带工作区他席在飞行 (12f3cbd383)
- 🐞 Fix:dev-stack 常驻链定 pipe 为默认形态并把注册结果判据修对 —— 旧判据只认 LAST=0,而 ExecutionTimeLimit=0 的常驻任务回读到的正是 SCHED_S_TASK_RUNNING(267009),于是每次成功注册都被打成失败:照文档敲 autostart 的人看见假错,watchdog 自愈腿按非零退出记 repair-failed 永远收不到成功、每 2 分钟重装并顺手杀掉在跑的守护;现按 0/267009 判成功、读不到形状走 exit 2 不冒绿(§0.3)。本机实测 IHUI-DevStack 与 IHUI-DevStackWatchdog 双任务已落 S4U + 系统 node(不再挂第三方 IDE 捆绑的 node 目录),守护自起 8801/8802/8806/8807 并续写心跳;镜像 install 6 例、launcher 26 例 (91dcc16835)
- 📚 Docs:T3 增 §11 残余四条复判 —— jti 防重放纠正为假缺口，关卡41已消，壳层与持久层维持原判并附复跑入口 (1638812845)
- 🐞 Fix:号池队列换库必换队列,并把队列名分隔符从冒号改成连字符 —— BullMQ QueueBase 对名字里的冒号直接抛,旧形态让隔离栈 API 崩在 worker 启动那一步(本机实测);登记守门276(warn 起步,存量假阳未清不升档)+ 镜像13例 + 单测24例含不变量;门体正文改走取材层 catBatch/readWorktreeFile;新增 docs/RELAY_QUEUE_DB_ISOLATION.md 立「队列属于数据库」;immutable-exempt: 本次是新增门的注册条目与 onFailHint 措辞同步并接正取材层,未削弱任何既有判据 (522584b7ff)
- 📚 Docs:守门 276 补进「守门脚本点名索引」的号池队列隔离行 —— 门 89 R4 义务(已接线门必须被文档点名) (da510dd9a4)
- 🚀 Feature/Improvement:Qoder 会话回灌装成用户态计划任务 —— 服务身份 LocalSystem 读不到 DPAPI,本机号一直静默脱池 (fdc24da553)
- 🐞 Fix:残余 7 例逐例定性落地 —— 5 例测试腐烂/环境配置按新 IA 重钉,1 例拆开同帧耦合 (8ed1fbddf3)
- 🐞 Fix:派单腿指向本机真实 CLI 入口 + 白名单补 deploy-feedback (34402556a8)
- 🐞 Fix:mcp_server SSRF 批的收尾 —— mypy 类型收窄 + webhook 测试支撑(安全强化第 32 批) (24c4c72b23)
- 🚀 Feature/Improvement:advisor_consult 顾问模型工具(G-11 协议层收尾)—— 指定另一个模型就子问题作答,带会话级次数预算与模型名 fail-closed。 (ace8fec86b)
- 🚀 Feature/Improvement:钩子唤醒腿宿主接线真正入库 —— REPL 会话队列接管 async 钩子 exit2 回灌 (6a6f388253)
- 🚀 Feature/Improvement:计划执行工厂补回 hook_runtime 与指令片段声明面两参 —— 与第 27 批归属收口同面归并 (6747dfe947)
- 🔧 Chore/Other:删掉与 url-protocols 同值的死副本 fetch-protocols —— 协议表只留一份(§0.6) (f7ab13bdea)
- 🐞 Fix:协议白名单拆出零 Node 内建的 url-protocols —— 止住扩展/web 构建阻断(node:dns 进浏览器包) (e95ff27a1e)
- 🚀 Feature/Improvement:补齐第三批 —— 指令片段声明面 + TodoWrite 五态 + 编辑器态共享腿 (906a4ab47b)
- 🚀 Feature/Improvement:「自动做任务」补齐移动端与小程序 —— 三端同能力、同口径 (3275ed6ee0)
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
