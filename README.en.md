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
    &nbsp;&nbsp;|&nbsp;&nbsp;
    <strong>Mirrors</strong> · <a href="https://gitee.com/JLSLSSZWHYXGS_0/IHUI-AI">Gitee</a> · <a href="https://gitcode.com/IHUI-AI/IHUI-AI">GitCode</a>
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

Headline claims (same source as the table below, all live-computed): **598 tables · 4,443 API routes ·
25 WebSocket endpoints · 118 catalogued LLMs · 38 platforms auto-publishing · 2,955 test files ·
260 engineering gates · 49 CI workflows · 5-language i18n parity · 9 app packages · 16 shared packages ·
15 compose services**.

<!-- BEGIN GENERATED NUMBERS (node scripts/gen-doc-numbers.mjs --markdown) -->
| 指标 | 现值 | 取数键 |
| ---- | ---- | ------ |
| 数据库表 | 599 | `dbTables` |
| schema 文件 | 232 | `dbSchemaFiles` |
| API 路由 | 4451 | `apiRoutes` |
| 路由文件 | 609 | `apiRouteFiles` |
| AI 服务路由 | 576 | `aiServiceRoutes` |
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
| 测试文件 | 3010 | `testFiles` |
| CI 工作流 | 49 | `ciWorkflows` |
| Compose 服务 | 14 | `composeServices` |
| 工程守门 | 267 | `guardianGates` |
| — blocking | 243 | `guardianBlocking` |
| — warn | 27 | `guardianWarn` |
| 跟踪文件 | 15510 | `trackedFiles` |

上表由 `node scripts/gen-doc-numbers.mjs --markdown` 生成,最后核对日期 2026-10-21。
每个数的来源就写在取数键旁边的实现里(`scripts/gen-doc-numbers.mjs` 的 `SOURCES`),**不得手抄、不得另立第二份**。

<!-- END GENERATED NUMBERS -->


## Recent updates (auto-maintained)

<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->
**2026-10-21**
- 🐞 Fix:用户自装的 mmcode 自愈脚本不是 agent 污染 —— 显式豁免 (18c81b13af9)

**2026-10-21**
- 📚 Docs:回补 32 枚 PROJECT_PLAN 归档锚点件入库 (aba30748621)
- 🐞 Fix:把 glass 两档登记进跨端 token 对账 —— 暗档手抄白值的漏登记当场补上 (688d894ae42)

**2026-10-21**
- 🐞 Fix:删掉自己用例里的一处类型红(noUncheckedIndexedAccess) (e4098efc4b9)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a8d78bbbd57)
- 🔧 Chore/Other:给门 231 涉事判据喂测试桩 —— 夹具仓的树真门读不到,26 条端到端因此全红 (f7cb10c3396)
- 📚 Docs:再补三条会打死全站的事实到运维档 —— 公网两臂都得活着(WS 只能留慢臂)/ EdgeOne 现无源站组(源站守卫能上线的前提)/ 别设 assetPrefix(CSP 会把跨域进来的脚本全拦) + React19 自动 preload 的真实成因 (c234639641d)
- 🚀 Feature/Improvement:源站直连守卫上 EdgeOne —— 8801 直填家宽 IP 之后 Host 为裸公网 IP 的直连请求一律 403,失败方向全部 fail-open (e6a318d38fa)
- 🔧 Chore/Other:让号收口 F9 撞号 —— G-927 让给 G-1142551(归并前置,零删行) (67f45124bfa)
- 🐞 Fix:名单外那台的信必须带门 153 已判出的问题行 —— "它停了"不可整改,"它的 exe 不存在"才可以 (eca627cb50c)
- ⚡ Perf:营销/文档页初始 JS 减 2,529KB raw / 523KB gz(三页各测) —— 把 BrandIcon 全集与 three 栈移出阻塞路径 (3c5a06a71ad)
- 🚀 Feature/Improvement:手机端 REST 切快臂(实测 ttfb 差 1.3~7.0s),实时通道显式钉回 api 臂并写死"两臂都得活着" (542ec2105ec)
- 🐞 Fix:归属账按 T10 摘除 B 档两条(.ihui-agent/tmp/outputs 已零命中) —— 陈旧放行凭据:盘上副本 = git show HEAD:该文件 ⊕ 这一处编辑,diff --numstat 1 插 19 删(scopeNote 摘记 1 行 + 两块 B 档条目体),无第三方行被写回;T10 点名后依 §0.7 删条目,尺子 13/13 (12612c2115f)
- ♻️ Refactor:把纯 IP 判据从带 node:dns 的 ssrf-guard 里分出来 —— 为 Edge 侧消费铺路,行为零变化 (01af3886c24)
- 🐞 Fix:摘掉 user.ts 里重复注册的 POST /user/ip-whitelist(HEAD 起 API 启动即 FST_ERR_DUPLICATED_ROUTE,本地全栈无法起) (8c41e92a62f)
- 🔧 Chore/Other:G-926 完成即删摘行(翻勾后整行删除,已勾行进不了守门 71 保护集) (41aa033ba63)
- 📚 Docs:登记 2026-10-21 下午对齐第二轮(6 枚已入库;新派单:web ja/ko 机翻坏文按块清) (6498675ca80)
- 📚 Docs:同轮收口登记 —— IP 白名单生效链、RN 管理面、五项护栏按人生效、小程序关于页、两条假端点删除 (5b3fe1f3c67)
- 🔧 Chore/Other:G-926 翻勾(B 档收口:60 枚取消跟踪 + 落地器删除档 + --self-test,三态复量全绿) (61062533365)
- 📚 Docs:把 agent 护栏的过期自述与契约产物一起对齐到落地后事实 (1cd867fbf80)
- 📚 Docs:L7220 桌面僵尸实例 P1-P3 进展登记(欠双实例现场复现,不翻勾) (5fa9b4c4120)
- 📚 Docs:G-865 就地翻勾结清 —— DEFAULT_AVATAR_URL 死键已摘(枚 9410970ece45ddc00be11886f7d607ea2399f1f3,三处同批改,用例 9/9 与 shared tsc RC=0 为凭);行仍留 HEAD 等"完成即删"兜底轮摘除 (98c4de50b7a)
- 🐞 Fix:僵尸实例三块补丁 —— preflight 填账可观测 + 启动相位只等不杀 + 事件循环后置健康门(L7220) (b2d6ff56ed3)
- 🔧 Chore/Other:摘掉 DEFAULT_AVATAR_URL 死键 —— 指向恒 502 的 file.aizhs.top 且消费方已归零(门 121「声明必须有消费者」) (9410970ece4)
- 🔧 Chore/Other:G-926 完成即删(B 档 60 枚已取消跟踪 + 落地器删除档 + --self-test,三态复量全绿) (76e1128fc98)
- 🚀 Feature/Improvement:关于页三端同脸 —— 小程序补齐 web/RN 那六段结构 (a21108a3f46)
- 🔧 Chore/Other:无损折叠同行叠同一注记超额 26 份(7 行,方法学承 92b5d876) (31323b5d355)
- 📚 Docs:§0.9 点名义务 —— 把本批三件新器物写进运维工具档(出口 IP 漂移尺子 / 部署收尾预热 / 公开接口边缘缓存头),并注明"判机器状态一律不接提交链" (1b6ab6e6188)
- 🚀 Feature/Improvement:落地器 --self-test 自含电池(7 例,票面"带 --self-test 与镜像用例"收口)+ 镜像 T10 (04473df2771)
- 🐞 Fix:摘掉指向死源站 file.aizhs.top 的用户可见素材引用 —— 该域名不在我们隧道上,恒 502 (bafa2de7790)
- 🐞 Fix:页脚小图不再抢首屏连接 + docs 七页 21 条内链改 Link —— 根因是 React 19 SSR 对任意非 lazy img 自动发 preload (217a8998e64)
- 📚 Docs:立票 —— 裸 git 派生棘轮 76→85(本席那一枚已改走 face-reader.gitRaw 并落地,读数随 86→85);行内写清取新增者名单的命令与两个实测坑(rev: 前缀要先剥、注释里的字面量也会被数进去),并注明存量清零前只报数 (df979a1eb27)
- ♻️ Refactor:清扫器的派生 git 改走脚本层 —— 镜像套件里"裸 git 派生的生产文件只减不增"棘轮现读 76→86,本文件是新增者之一(我昨天落它时直接起 git 进程)。改法 = 那个 git() 帮手委托给 lib/face-reader 的 gitRaw(同时白拿它的超时/stdio/quotepath 纪律);注释里也不许出现裸调用字面量,否则棘轮正则连注释一起数(第一版就是这么"改了还在名单上")。现读:自检 15/15、镜像 12/12、预演 state=clean、eslint/prettier/watermark 全清。棘轮剩下的 9 枚新增者不在本席射程(逐枚归属见 git diff 14a04f013f..HEAD 那一族),已按实测另立条目 (35be7331286)
- 🚀 Feature/Improvement:公开只读 GET 接口加边缘缓存头 —— 审计 P1.3 那一格,取值与写头收在唯一出口 (42e21bacda0)
- 🚀 Feature/Improvement:安全中心接 IP 白名单管理面,并修掉 web settings.ip 的 ja/ko 机翻坏文 (29cdd1c00bf)
- 🚀 Feature/Improvement:部署收尾预热 EdgeOne 真装车 —— warm-prod-cache.mjs 自落地起全仓零调用方,属"造好没装车=没有"(§0.9) (4eaefdde4bc)
- 🔧 Chore/Other:hooks-extended 修 Windows 读-写竞态 —— 钩子文件等内容非空而非仅等存在 (706847132c9)
- 🚀 Feature/Improvement:家宽公网出口 IP 漂移装上看守 —— EdgeOne 源站直填 IP 之后全仓零器物,一变即全公网 5xx (030483ced98)
- 🐞 Fix:同题多号存量 8 组 26 行收拢清零(机主授权@2026-10-21) (0eb36182652)
- 🚀 Feature/Improvement:五项安全开关改为按登录主体生效(硬门与 kill switch 不受用户档影响) (59ea36eb632)
- 🐞 Fix:exec 族出 stdio 维度射程 —— 回退 hooks-auto 的 exec stdio(ExecOptions 无该字段),姊妹门 classify 加 exec 排除层 (b6281fcacda)
- 🔧 Chore/Other:取消跟踪 60 枚 tracked-but-ignored 临时件(B 档:56 枚 plan-pointer-purge 取证流水 + 4 枚 outputs;LAND_REMOVE_PATHS 首用) (988a243cd12)
- 🐞 Fix:补回 32ce073019de6d750a65133aec3146752ff3e655 自己造成的回归 —— 我用 prettier 重排该文件时把 `const HEADING = /…/gm` 折成两行,而镜像 next-plan-id-remote 的 T5/T6 从源码里抽这颗字面量复用(§22c),抽取一失败两条就从绿变红;上一枚报的"6/6"是重排**之前**量的,当时已失效。修法 = 注解写明形状承重 + `// prettier-ignore` 紧贴该行(注释与 const 之间留空行 = ignore 不生效,第一版就这么没成),并把量词写成 `{0,}`(与祖先逐字相同会被门 84 判"复活行"假阳,这里是等价改形)。现读:prettier 通过、next-plan-id-remote 6/6、plan-id-duplicates 6/6、plan-id-lease 9/9、--check rc=0、watermark 零残迹。教训钉进注释:核对顺序必须是 改 → 全跑 → 再落地,格式化也算改 (5a9d8f26d9e)
- ♻️ Refactor:删掉 PDF print/sign 两条假端点(全仓零消费方) (d22063dd4e6)
- 🚀 Feature/Improvement:落地器暴露 LAND_REMOVE_PATHS 声明式删除出口(G-926 器物侧) (f20d7354f0e)
- 🚀 Feature/Improvement:IP 白名单生效链接入 18 条新登录腿(只拦新会话、留自救出口) (9383e4645a2)
- 🔧 Chore/Other:G-1162551 第三次改判留勾(清扫⇄回捞连抖,不再摘第二次) (80d437743b8)
- 🐞 Fix:服务自愈「重启预算用完」终态接到人 —— 45 分钟 boot 崩曾一封信都没有 (4f9371871d5)
- 🚀 Feature/Improvement:打通历史课程视频的播放链 (506f115c1b1)
- 🔧 Chore/Other:G-53 与 L6762 结清翻勾 (f029adf6f52)
- 🚀 Feature/Improvement:把 history-read-ops 真挂进 ihui chat history(L6762 的真缺口)并钉装车锁 (172aba73338)
- 🚀 Feature/Improvement:补齐流式中换档即终止的腿(G-53 唯一真缺口,四端同判据表) (b00e5766c55)
- 📚 Docs:立票 —— 旁路落地器镜像套件红 26 例的根因(门 231 --rev 按自身仓根解析树 oid,测试通道换仓时该 oid 在主仓不存在 ⇒ exit 2 ⇒ 落地器 fail-closed 拒 ⇒ 用例整批红;生产面不受影响)。成因枚 e1f18b5a32070c9ab14f71187b963fc3de95c3ca,归属该门持有席(它此刻正被并发编辑);两条出路都写明,并禁止用"摘门/加 skip"消红 (5ea8c7ae9c0)
- 🔧 Chore/Other:给关于页补行为级自证套件(§17 不许只凭代码审查声明改好) (7561a8b9092)
- 🐞 Fix:摘掉 drawer-nav 三枚无人使用的 lucide 图标 (adadf82b37c)
- 📚 Docs:D18 SDK 发布尝试被 npm 拒的真因登记 (3b64f1fa79e)
- 📚 Docs:常驻工具清单点名 audit-pane-store-addressing.mjs(只读普查尺子,未接提交链也不接巡检轮 —— 它判的是"该不该按窗格分"这类人要读的归属,挂 blocking 即 §12e 恒红门) (7fbaea08b2a)
- 🔧 Chore/Other:补一把只读普查尺子 audit-pane-store-addressing.mjs(票60)—— 从"会进非根窗格的子树"(ChatPaneBody/MessageList/MessageInput,含 @/hooks,depth 可调)做 import BFS,列出现存 store 与三态窗格通道(自带 ForPane / 被注册表 import / 无),另给归属代理(状态形状里有没有会话或消息为键)。刻意**不接提交链也不接巡检轮**:它判的是"这枚 store 该不该按窗格分",那是人要读的归属问题,挂 blocking 就是 §12e 恒红门(同 check-temp-landing / alert-volume-report 那一档);取材失败显式 exit 2「未判定」不记绿。现跑读数:子树扫 40 个文件、引用 12 枚 store,已有通道 2(chat 经注册表、progress-jump 自带)、无通道 10。isDirectRun 走 pathToFileURL(§22d),eslint/prettier/watermark/门 221 全清 (0ff18ec7258)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (eba4bcb57ec)
- 📚 Docs:G-53 持有行复量 + 旧号 68 孪生行补副本指针 + L6762/L28828 处置留痕 (2069ae3d9fc)
- 📚 Docs:票60 行补非根窗格 store 普查读数 —— 子树 12 枚:已有通道 2(chat 经注册表、progress-jump 自带)、按设计属全局 3(auth/auth-store/navigation)、以会话或消息为键因而天然安全 2(ai-panel、d180)、要逐座定性的 5 枚点名(business-forms 的 clearForms 清全部 = 任一窗格切会话抹掉别窗格填一半的业务表单,是用户可见数据丢失;context-mention;conversation-detail-mode 名实待读;mode.ts;timeline-store),并写明判据与片 5 同形(能寻址的走 usePaneChatStore,只能按会话归属的把 conversationId 写进键里、清理动作按键收窄,不得整表 clear) (6789a60c66a)
- 🐞 Fix:诊断清单的 `[object Object]` —— 我把 notOk 改成对象后漏改了一处映射 (e884297f30f)
- 🐞 Fix:删掉 user.ts 里只会回显的 POST /user/ip-whitelist 空壳 —— 它与 security-config-routes 的同路径真实现同时注册,Fastify 抛「already declared」⇒ IHUI-API 崩溃循环 60 次、8802 未监听、登录全量 500、部署环健康门禁 8 轮不过已回滚 (7078c88d956)
- 🚀 Feature/Improvement:跨端对账门补 CSS Module / CSS-in-JS 取用形态覆盖面(CS 维)—— 收 L28828 空白② (ba9f1bca74f)
- 🐞 Fix:补回上一枚漏掉的类型标注 —— pane-tail-consumers 的 assistant() 工厂返回 ChatMessage(字面量 role 不做返回类型标注时 tsc 判 string 不可赋给联合类型,3 条 TS2322 随 cca856a67c 落进了 HEAD)。教训自己钉住:vitest 绿不等于 tsc 绿(测试文件的类型不在 esbuild 编译路径上),落地前必须单独跑一次 tsc 并按文件过滤归因。修后 tsc 现读 2 条错误均属他席在飞(panels/page.tsx headerExtra、status/models-section 工作树缺),本枚文件零命中;3 例仍绿 (fcdb043e85f)
- 📚 Docs:票60 行残余① 收口 —— 长尾四座已窗格化(枚 cca856a67cededa438319b203c4f233ff1437b05,成对 3 例 + 变异对照全红,宽档 1710 例绿),3 座按边界 1 只根窗格渲染 + 侧栏族按设计属全局面 ⇒ 不窗格化的理由写进行内;同枚修掉 D184 源码字面量锁的假阳成因与反证 (c2aa045c2af)
- 🚀 Feature/Improvement:票60 长尾四座窗格化 —— 朗读腿(voice-stream-speaker)/画布覆盖层(canvas-overlay)/采样参数面板与按钮(sampling-params-panel)/连接态入口(agent-progress-trigger)改读 usePaneChatStore:它们经 MessageInput/MessageList 进非根窗格,原先读根单例 ⇒ 在非根窗格里显示与写入的是根会话的参数/正文/消息流。成对 3 例:① 根窗格流式收尾不触发本窗格、本窗格自己过 done 边沿才播 ② Provider 外仍读根单例(单窗格形态逐字不变)③ 形状锁钉四座不再引用根单例;变异对照(把朗读腿改回读根单例)3 条当场全红,还原后逐字节相同。顺手修 D184 那条源码字面量锁:票60 片 4 起 detail 里多一个 paneId,旧逐字单行断言把合法代码读成"没派发"(HEAD 面实测红),归一化只吞排版(折行+尾逗号),事件名与 text: selectionText 仍逐字钉住并补两型反证。176 文件 1710 例绿,eslint/prettier/watermark 全清 (cca856a67ce)
- 🚀 Feature/Improvement:侧边栏与 web 端全量对齐(第五批) - 抽屉补 57 条 web 缺口+移动端独立分组, 域 hub 补 12 条 edu/content/trade, 五语新增 5 个分组键 (e1005d41cdd)
- 🚀 Feature/Improvement:侧边栏与 web 端全量对齐(第五批) - 抽屉补 57 条 web 缺口+移动端独立分组, 域 hub 补 12 条 edu/content/trade, 五语新增 5 个分组键 (fed40bbacb2)
- 📚 Docs:同轮补的后端读写面、门户两条缺页与记忆详情 WebView 承载登记 (83b1e59b5dc)
- 📚 Docs:登记 2026-10-21 RN↔web 全量对齐收口轮(本轮 3 枚已入库;IP 白名单与 agent 护栏的生效链待拍板) (bc93cac4af3)
- 🚀 Feature/Improvement:门户补两张缺页 + 记忆详情走 WebView 承载 (ef7cc1697a0)
- 🔧 Chore/Other:夹具的 git 身份落进仓库 config —— CI 干净检出没有全局 user.*,21 枚用例在第一步就抛 (f7043438ed4)
- 📚 Docs:票60 行残余① 从"13 处"收紧到现读分档 —— 真会串 4 座(sampling-params-panel / agent-progress-trigger / voice-stream-speaker 经 message-input,canvas-overlay 经 MessageList+artifact-canvas),3 座按边界 1 只在根窗格渲染(compaction-status-bar / d176-task-recap / task-monitor-sections,把它下面板化时要与片 3 数据面同批改),4 座按设计属全局面 ⇒ 下一片射程=那 4 座,判据同片 5 的两种形态 (a4e07eccbe4)
- 📚 Docs:票60 行就地改写 —— 残余② ProgressJumpStore 已窗格化(枚 d01bc20577c0b7075b0f8e5d14e7058b3730c94b,成对 7 例 + 变异对照 5 红,268 例绿);残余① 13 处根单例消费面定性清单留在行内 (5a680ada9b8)
- 🚀 Feature/Improvement:票60 残余 —— ProgressJumpStore 按窗格寻址(照 usePaneChatStore 同一形态:状态配方只有一份 buildProgressJumpState,根单例与各窗格实例都由它构造,nonce/highlightTimer 挪进实例闭包) ⇒ 任一窗格消费后 clearPendingJump 不再抢走别窗格那次跳转、高亮与 PlanStep↔Message 联动映射不再跨窗格串;Provider 外仍恒返回根单例(单窗格调用面逐字不变),空 paneId 抛错不静默回落;消费面 5 处改用 useProgressJumpStoreForPane(pane-gate 那枚既有用例的观测面随之改挂到该窗格实例,断言未放宽)。成对 7 例含变异对照:把 getProgressJumpStoreForPane 改回返回根单例 ⇒ 5 条当场红(还原后逐字节相同);34 文件 268 例绿,eslint/prettier/watermark 全清 (d01bc20577c)
- 🔧 Chore/Other:L7177 区段头折行回潮改判留勾(不摘第二次) (94a133dc824)
- 🔧 Chore/Other:五枚摘后被自愈按未勾补回的行改判留勾(回潮型,不摘第二次) (190ad482554)
- 🔧 Chore/Other:重钉 web ui-routes 自述钉(承接大屏 13 处红字改档) (994d9dd6da1)
- 🔧 Chore/Other:九枚本机也红的镜像测试 —— 八枚是"测试停在旧世界/测量缺陷",一枚是共享判据的漏判 (d3646d3b255)
- 🐞 Fix:大屏 13 处红字改走 danger 角色档 —— 真浏览器逐元素量出来 text-destructive 亮档只有 3.64(两档同值 #ff3333 是漏网的一族),换档后亮 5.65~6.47 / 暗 5.73~6.29 (a7a68146729)
- 🐞 Fix:lucide-react-native 强制单实例；底栏取源方式定档留痕 (036f52bce07)
- 📚 Docs:G-924 就地改判 —— 那 10 条取不到的图标 URL 全是零消费方死键,不是用户可见破图(出路改按门 121 摘死键) (9496f924ab9)
- 📚 Docs:G-934 结清(接线枚 c5b3f0f65d9c7a6979b476bcce16e67caad34822 + 23/23 与 211/211 复量 + §17 真浏览器核验枚 82c9a68ae0f2acf61a84b709caa5ed4d4bce8cd3 + README 同步枚 c9e4a15681437b1d2efb595944a0b3a69072cbbb);G-935 记第一枚 e2e 与产品定档(维持"拆分=承载既有会话",不改真分叉;双流式/工具面板仍无用例 ⇒ 不翻勾;窗格会话 write-once 使更强形态结构性不可达,以 annotations.gap 点名);票60 行补现读残余(13 处根单例消费面定性清单 + ProgressJumpStore 未窗格化) (a96c36ad4c2)
- 🚀 Feature/Improvement:关于页照 web 补齐六段内容,合规 7 项改走 i18n 取词 (cd57f5d3d38)
- 📚 Docs:把 HEAD 面体积收回 96,000 预算内(96618→95854) —— 按 §1 两步走逐字留痕搬出两行:207 的旧档(warn 起步/50KB,已被同段"定档更正"整段取代)与一枚重复的压缩版页脚,去处 .ihui-agent/archive/AGENTS_trim-2026-10-20.md(同族追加,原位置留 HTML 指针注记) (b16c42f5261)
- 🔧 Chore/Other:票60/G-935 多窗格与滚动位恢复补上真浏览器核验 —— 新增 chat-pane-split-scroll-restore.spec.ts 4 例(① 切走再切回落点±60px 内且非零 ② 反证 短会话不冒充恢复 ③ 拆分后两格各有独立消息列表 DOM ④ 反证 同一会话双窗格 scrollTop 各记各的 |Δ|>200 + 根格切走切回恢复自己而 pane-1 不动);全链 page.route  mocked 不依赖活后端,PLAYWRIGHT_REUSE_SERVER 连跑两次 4 passed/4 passed;④ 更强形态(pane-1 也切走再切回)按产品事实不可达(窗格会话 write-once:canDropToPane 只认空叶 + dropConversationToPane 拒非空目标)⇒ 用例内以 annotations.gap 点名,不当已完成 (82c9a68ae0f)
- 📚 Docs:登记小程序 10 条远程图标线上取不到(6 条代码残路径 + 4 条旧上传件已失) (93595c2f754)
- 🐞 Fix:多设备在线时 versionCode 自动定档逐个 -s 询问（此前不带 -s 被 adb 拒绝 ⇒ 静默回落 1，产出降级包装不上） (fee177a1f8e)
- 📚 Docs:G-927 现读进展 —— 判据认形态后误报清零,剩块级重复归人工 (40c78817179)
- 🐞 Fix:取号器重号判据认系列小后缀形态,不再把正当小节读成撞号(G-927) (82ee72dbf12)
- 🔧 Chore/Other:失败清单必须带诊断 —— 只印用例名等于"红了 102 条却没有一个字说为什么" (bbb2f362441)
- 🐞 Fix:三处"只在单层检出/单台机上成立"的判据 —— c-drive 路径正则、硬编码 G:、未入库证书夹具 (359af9e4b45)
- 📚 Docs:§21 同步 —— D73 多任务窗格行补「会话级滚动位按窗格::会话落账」(G-934 把恢复接回生产后的用户可见能力:切走存 scrollTop+following、切回两段恢复+grace 修正、同一会话双窗格各记各的) (c9e4a156814)
- 📚 Docs:G-939 结清 —— 旁路合并两半复量均已接车入库(门 100 A1 半 + 门 168 半) (0499c91575d)
- 📚 Docs:登记 870 枚历史课程视频接入播放链(云端桶已就位,现网零课程行;上架前置三件) (3b07f00330e)
- 📚 Docs:G-927 现读分档 —— 7 组里真孪生 8 处 vs 系列小节(O62 附族等),并点名两处判据不自洽(--check 按编号计数而默认路径自写"追加续写不算相撞"=同一把尺两个面两种结论 §0.6;plan-tasks-merge --heal 现读 F1 0/F4 0/F10 判不出 4,标题行不在 F4 射程 ⇒ 原出路结构性打不到);出路顺序改为先修分组键为「编号+标题整行逐字」再摘孪生 (5586dadcc31)
- 🐞 Fix:视频小节详情补 playUrl 出网名,修小程序视频页必然黑屏 (消费方 video-detail/index.tsx:202 读 playUrl,生产者只出 url;新增 4 例离线契约测试钉住同值与 400/404 臂) (a1f899efb9f)
- 🔧 Chore/Other:fix(gate-?) killer-parity-ends 的两枚真红:一枚是测试停在旧世界,一枚是同值不同义没登记 (0cdbbf3719d)
- 📚 Docs:G-926 就地改写 —— A 档 25 枚已由就近出口件中和(枚 7bbf24ec4b8120db003ae496455bcc8b9aed6cf8)、C 档 2 枚按账内出路放 .gitignore 例外(枚 c8b17fe8ea70de22ed59dc775bf4fafdfcdb2e65)、归属账两条由 T10 清单腐烂档点名后摘除;剩 B 档 58 枚的拦路是"旁路落地器表达不了删除"这一格,出路写成可动手的活(lib 已有 deleted 护栏,要的是声明式出口 + 反向自证 + 正反用例),题面 84 枚按现读更正为 87/命中 83/中和 25/残留 58 (594bc634bb2)
- 🐞 Fix:release 构建拒绝裸 apex 基址 + ABI/基址回读对账（真机实测） (45397bc186e)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7145a144459)
- 🐞 Fix:收口锁自检两处 flaky 成因 —— 计时窗外置身份探针 + 派生 CLI 显式 stdio(L7233 那一格) (6a06acc6709)
- 🐞 Fix:旁路合并接门 168 —— 推进前复量本侧显式删除是否被合并带回结果树(G-939) (0f8a38e9cd1)
- 🚀 Feature/Improvement:侧边栏第四批对齐 web 终态对账(10 入口,web 端零改动) (274c78e0eaa)
- 🔧 Chore/Other:G-212 重新销账 + L7233 现读复量 (9aeb9d51a60)
- 🔧 Chore/Other:复验 L7177 区段头折行结清 + 更新 D18/L6762 现读 (ee57b4c96d2)
- 🐞 Fix:门 193 掩码根治 —— markHidden 认正则字面量(L477 病灶跨行错位误判自检夹具判红 2 处阻塞 push),连带清偿 4 处被错位洗绿的真违规 (98e7b8a62c4)
- 📚 Docs:G-939 结清 —— 旁路合并侧已 import 门 100 的 A1 判据在 update-ref 前复量(枚 402f347edc/bf25ee60e2),红则拒推进+保全悬空枚+点名,裸跳门旗不放行;镜像 6/6 含真夹具正控,最近 4 枚 converge 合并逐枚复量 lost=0 (47cb77e6495)
- 🐞 Fix:Python 子进程一律钉 UTF-8 —— 那族门在 Windows 上会把「判据说的话」读成乱码 (d6655c70c30)
- 🚀 Feature/Improvement:派发契约键集对账尺子入库(常设只读,禁接提交链)—— 12 格真跑 119 个声明读键全量到;自检 7/7 含'不许裸豁免'与'跑不出 JSON 不得当空集'两条反证,并明写两条边界(不发现新读键、数组元素内字段不在射程) (58bd3c15e52)
- 🔧 Chore/Other:补 ai-service 空 venv —— 判据住在 Python 里的那族守门此前在 CI 上恒「未判定」 (0c6723389f1)
- 🔧 Chore/Other:翻勾 G-274 与 G-1162551,改判 G-620/G-923 现读 (89c12fe5665)
- 🚀 Feature/Improvement:G-934 会话级滚动位恢复接回生产 —— hook 切走落账/切回二段恢复(RESTORE_PHASE2_DELAY_MS/RESTORE_GRACE_MS 由模块常量驱动),键加窗格维 pane::conversation 防双窗格同会话互串,grace 期修正挂 handleScroll,卸载定时器;成对用例 6 例(正向=窗格隔离,反证=单窗格缺省形态逐字不变;把窗格维摘掉 4 例当场红) (c5b3f0f65d9)
- 🚀 Feature/Improvement:把 SSE 全量帧盲合并门接进提交链(id 233,blocking)—— 收 G-274 (b559acd95cd)
- 🚀 Feature/Improvement:G-939 补第二格 —— 吞并复量"过了也要把判过量出来"(丢失/补回计数落 dim 行),atRefUndetermined 非空时单独喊未判定,不并进"零丢失"那句(§0.3:静默通过与根本没跑到这一步在日志里同形) (bf25ee60e2a)
- 🐞 Fix:G-939 把门 100 的 A1 判据 import 给旁路合并侧复量 —— commit-tree+CAS 不跑钩子,对"吞掉对侧独有新增"结构性失明(实测本轮自己的 wave3 提交被卷走);落 update-ref 前拒推进并 backupOrphanMerge,裸 skipEnv 无理由照拦,成对镜像 6 例含真夹具正控 (402f347edc2)
- 🔧 Chore/Other:翻勾 L7224 / G-932 / G-922 (079a269bf6f)
- 🔧 Chore/Other:检出改为全历史 —— 那批"必须拿真仓历史证"的判据在浅克隆上结构上过不了 (2fc70504830)
- ♻️ Refactor:AI_SERVICE_URL 默认值收敛为单一真相源,并由 localhost 改 127.0.0.1 (8861116d425)

**2026-10-21**
- 🚀 Feature/Improvement:安全中心接 IP 白名单管理面,并修掉 web settings.ip 的 ja/ko 机翻坏文 (29cdd1c00bf)
- 🚀 Feature/Improvement:五项安全开关改为按登录主体生效(硬门与 kill switch 不受用户档影响) (59ea36eb632)
- ♻️ Refactor:删掉 PDF print/sign 两条假端点(全仓零消费方) (d22063dd4e6)
- 🚀 Feature/Improvement:IP 白名单生效链接入 18 条新登录腿(只拦新会话、留自救出口) (9383e4645a2)
- 🔧 Chore/Other:给关于页补行为级自证套件(§17 不许只凭代码审查声明改好) (7561a8b9092)
- 🐞 Fix:摘掉 drawer-nav 三枚无人使用的 lucide 图标 (adadf82b37c)
- 🚀 Feature/Improvement:侧边栏与 web 端全量对齐(第五批) - 抽屉补 57 条 web 缺口+移动端独立分组, 域 hub 补 12 条 edu/content/trade, 五语新增 5 个分组键 (fed40bbacb2)
- 📚 Docs:同轮补的后端读写面、门户两条缺页与记忆详情 WebView 承载登记 (83b1e59b5dc)
- 📚 Docs:登记 2026-10-21 RN↔web 全量对齐收口轮(本轮 3 枚已入库;IP 白名单与 agent 护栏的生效链待拍板) (bc93cac4af3)
- 🚀 Feature/Improvement:门户补两张缺页 + 记忆详情走 WebView 承载 (ef7cc1697a0)
- 🔧 Chore/Other:夹具的 git 身份落进仓库 config —— CI 干净检出没有全局 user.*,21 枚用例在第一步就抛 (f7043438ed4)
- 📚 Docs:票60 行就地改写 —— 残余② ProgressJumpStore 已窗格化(枚 d01bc20577c0b7075b0f8e5d14e7058b3730c94b,成对 7 例 + 变异对照 5 红,268 例绿);残余① 13 处根单例消费面定性清单留在行内 (5a680ada9b8)
- 🚀 Feature/Improvement:票60 残余 —— ProgressJumpStore 按窗格寻址(照 usePaneChatStore 同一形态:状态配方只有一份 buildProgressJumpState,根单例与各窗格实例都由它构造,nonce/highlightTimer 挪进实例闭包) ⇒ 任一窗格消费后 clearPendingJump 不再抢走别窗格那次跳转、高亮与 PlanStep↔Message 联动映射不再跨窗格串;Provider 外仍恒返回根单例(单窗格调用面逐字不变),空 paneId 抛错不静默回落;消费面 5 处改用 useProgressJumpStoreForPane(pane-gate 那枚既有用例的观测面随之改挂到该窗格实例,断言未放宽)。成对 7 例含变异对照:把 getProgressJumpStoreForPane 改回返回根单例 ⇒ 5 条当场红(还原后逐字节相同);34 文件 268 例绿,eslint/prettier/watermark 全清 (d01bc20577c)
- 🔧 Chore/Other:L7177 区段头折行回潮改判留勾(不摘第二次) (94a133dc824)
- 🔧 Chore/Other:五枚摘后被自愈按未勾补回的行改判留勾(回潮型,不摘第二次) (190ad482554)
- 🔧 Chore/Other:重钉 web ui-routes 自述钉(承接大屏 13 处红字改档) (994d9dd6da1)
- 🔧 Chore/Other:九枚本机也红的镜像测试 —— 八枚是"测试停在旧世界/测量缺陷",一枚是共享判据的漏判 (d3646d3b255)
- 🐞 Fix:大屏 13 处红字改走 danger 角色档 —— 真浏览器逐元素量出来 text-destructive 亮档只有 3.64(两档同值 #ff3333 是漏网的一族),换档后亮 5.65~6.47 / 暗 5.73~6.29 (a7a68146729)
- 🐞 Fix:lucide-react-native 强制单实例；底栏取源方式定档留痕 (036f52bce07)
- 📚 Docs:G-924 就地改判 —— 那 10 条取不到的图标 URL 全是零消费方死键,不是用户可见破图(出路改按门 121 摘死键) (9496f924ab9)
- 📚 Docs:G-934 结清(接线枚 c5b3f0f65d9c7a6979b476bcce16e67caad34822 + 23/23 与 211/211 复量 + §17 真浏览器核验枚 82c9a68ae0f2acf61a84b709caa5ed4d4bce8cd3 + README 同步枚 c9e4a15681437b1d2efb595944a0b3a69072cbbb);G-935 记第一枚 e2e 与产品定档(维持"拆分=承载既有会话",不改真分叉;双流式/工具面板仍无用例 ⇒ 不翻勾;窗格会话 write-once 使更强形态结构性不可达,以 annotations.gap 点名);票60 行补现读残余(13 处根单例消费面定性清单 + ProgressJumpStore 未窗格化) (a96c36ad4c2)
- 🚀 Feature/Improvement:关于页照 web 补齐六段内容,合规 7 项改走 i18n 取词 (cd57f5d3d38)
- 📚 Docs:把 HEAD 面体积收回 96,000 预算内(96618→95854) —— 按 §1 两步走逐字留痕搬出两行:207 的旧档(warn 起步/50KB,已被同段"定档更正"整段取代)与一枚重复的压缩版页脚,去处 .ihui-agent/archive/AGENTS_trim-2026-10-20.md(同族追加,原位置留 HTML 指针注记) (b16c42f5261)
- 🔧 Chore/Other:票60/G-935 多窗格与滚动位恢复补上真浏览器核验 —— 新增 chat-pane-split-scroll-restore.spec.ts 4 例(① 切走再切回落点±60px 内且非零 ② 反证 短会话不冒充恢复 ③ 拆分后两格各有独立消息列表 DOM ④ 反证 同一会话双窗格 scrollTop 各记各的 |Δ|>200 + 根格切走切回恢复自己而 pane-1 不动);全链 page.route  mocked 不依赖活后端,PLAYWRIGHT_REUSE_SERVER 连跑两次 4 passed/4 passed;④ 更强形态(pane-1 也切走再切回)按产品事实不可达(窗格会话 write-once:canDropToPane 只认空叶 + dropConversationToPane 拒非空目标)⇒ 用例内以 annotations.gap 点名,不当已完成 (82c9a68ae0f)
- 📚 Docs:登记小程序 10 条远程图标线上取不到(6 条代码残路径 + 4 条旧上传件已失) (93595c2f754)
- 🐞 Fix:多设备在线时 versionCode 自动定档逐个 -s 询问（此前不带 -s 被 adb 拒绝 ⇒ 静默回落 1，产出降级包装不上） (fee177a1f8e)
- 📚 Docs:G-927 现读进展 —— 判据认形态后误报清零,剩块级重复归人工 (40c78817179)
- 🐞 Fix:取号器重号判据认系列小后缀形态,不再把正当小节读成撞号(G-927) (82ee72dbf12)
- 🔧 Chore/Other:失败清单必须带诊断 —— 只印用例名等于"红了 102 条却没有一个字说为什么" (bbb2f362441)
- 🐞 Fix:三处"只在单层检出/单台机上成立"的判据 —— c-drive 路径正则、硬编码 G:、未入库证书夹具 (359af9e4b45)
- 📚 Docs:§21 同步 —— D73 多任务窗格行补「会话级滚动位按窗格::会话落账」(G-934 把恢复接回生产后的用户可见能力:切走存 scrollTop+following、切回两段恢复+grace 修正、同一会话双窗格各记各的) (c9e4a156814)
- 📚 Docs:G-939 结清 —— 旁路合并两半复量均已接车入库(门 100 A1 半 + 门 168 半) (0499c91575d)
- 📚 Docs:登记 870 枚历史课程视频接入播放链(云端桶已就位,现网零课程行;上架前置三件) (3b07f00330e)
- 📚 Docs:G-927 现读分档 —— 7 组里真孪生 8 处 vs 系列小节(O62 附族等),并点名两处判据不自洽(--check 按编号计数而默认路径自写"追加续写不算相撞"=同一把尺两个面两种结论 §0.6;plan-tasks-merge --heal 现读 F1 0/F4 0/F10 判不出 4,标题行不在 F4 射程 ⇒ 原出路结构性打不到);出路顺序改为先修分组键为「编号+标题整行逐字」再摘孪生 (5586dadcc31)
- 🐞 Fix:视频小节详情补 playUrl 出网名,修小程序视频页必然黑屏 (消费方 video-detail/index.tsx:202 读 playUrl,生产者只出 url;新增 4 例离线契约测试钉住同值与 400/404 臂) (a1f899efb9f)
- 🔧 Chore/Other:fix(gate-?) killer-parity-ends 的两枚真红:一枚是测试停在旧世界,一枚是同值不同义没登记 (0cdbbf3719d)
- 📚 Docs:G-926 就地改写 —— A 档 25 枚已由就近出口件中和(枚 7bbf24ec4b8120db003ae496455bcc8b9aed6cf8)、C 档 2 枚按账内出路放 .gitignore 例外(枚 c8b17fe8ea70de22ed59dc775bf4fafdfcdb2e65)、归属账两条由 T10 清单腐烂档点名后摘除;剩 B 档 58 枚的拦路是"旁路落地器表达不了删除"这一格,出路写成可动手的活(lib 已有 deleted 护栏,要的是声明式出口 + 反向自证 + 正反用例),题面 84 枚按现读更正为 87/命中 83/中和 25/残留 58 (594bc634bb2)
- 🐞 Fix:release 构建拒绝裸 apex 基址 + ABI/基址回读对账（真机实测） (45397bc186e)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7145a144459)
- 🐞 Fix:收口锁自检两处 flaky 成因 —— 计时窗外置身份探针 + 派生 CLI 显式 stdio(L7233 那一格) (6a06acc6709)
- 🐞 Fix:旁路合并接门 168 —— 推进前复量本侧显式删除是否被合并带回结果树(G-939) (0f8a38e9cd1)
- 🚀 Feature/Improvement:侧边栏第四批对齐 web 终态对账(10 入口,web 端零改动) (274c78e0eaa)
- 🔧 Chore/Other:G-212 重新销账 + L7233 现读复量 (9aeb9d51a60)
- 🔧 Chore/Other:复验 L7177 区段头折行结清 + 更新 D18/L6762 现读 (ee57b4c96d2)
- 🐞 Fix:门 193 掩码根治 —— markHidden 认正则字面量(L477 病灶跨行错位误判自检夹具判红 2 处阻塞 push),连带清偿 4 处被错位洗绿的真违规 (98e7b8a62c4)
- 📚 Docs:G-939 结清 —— 旁路合并侧已 import 门 100 的 A1 判据在 update-ref 前复量(枚 402f347edc/bf25ee60e2),红则拒推进+保全悬空枚+点名,裸跳门旗不放行;镜像 6/6 含真夹具正控,最近 4 枚 converge 合并逐枚复量 lost=0 (47cb77e6495)
- 🐞 Fix:Python 子进程一律钉 UTF-8 —— 那族门在 Windows 上会把「判据说的话」读成乱码 (d6655c70c30)
- 🚀 Feature/Improvement:派发契约键集对账尺子入库(常设只读,禁接提交链)—— 12 格真跑 119 个声明读键全量到;自检 7/7 含'不许裸豁免'与'跑不出 JSON 不得当空集'两条反证,并明写两条边界(不发现新读键、数组元素内字段不在射程) (58bd3c15e52)
- 🔧 Chore/Other:补 ai-service 空 venv —— 判据住在 Python 里的那族守门此前在 CI 上恒「未判定」 (0c6723389f1)
- 🔧 Chore/Other:翻勾 G-274 与 G-1162551,改判 G-620/G-923 现读 (89c12fe5665)
- 🚀 Feature/Improvement:G-934 会话级滚动位恢复接回生产 —— hook 切走落账/切回二段恢复(RESTORE_PHASE2_DELAY_MS/RESTORE_GRACE_MS 由模块常量驱动),键加窗格维 pane::conversation 防双窗格同会话互串,grace 期修正挂 handleScroll,卸载定时器;成对用例 6 例(正向=窗格隔离,反证=单窗格缺省形态逐字不变;把窗格维摘掉 4 例当场红) (c5b3f0f65d9)
- 🚀 Feature/Improvement:把 SSE 全量帧盲合并门接进提交链(id 233,blocking)—— 收 G-274 (b559acd95cd)
- 🚀 Feature/Improvement:G-939 补第二格 —— 吞并复量"过了也要把判过量出来"(丢失/补回计数落 dim 行),atRefUndetermined 非空时单独喊未判定,不并进"零丢失"那句(§0.3:静默通过与根本没跑到这一步在日志里同形) (bf25ee60e2a)
- 🐞 Fix:G-939 把门 100 的 A1 判据 import 给旁路合并侧复量 —— commit-tree+CAS 不跑钩子,对"吞掉对侧独有新增"结构性失明(实测本轮自己的 wave3 提交被卷走);落 update-ref 前拒推进并 backupOrphanMerge,裸 skipEnv 无理由照拦,成对镜像 6 例含真夹具正控 (402f347edc2)
- 🔧 Chore/Other:翻勾 L7224 / G-932 / G-922 (079a269bf6f)
- 🔧 Chore/Other:检出改为全历史 —— 那批"必须拿真仓历史证"的判据在浅克隆上结构上过不了 (2fc70504830)
- ♻️ Refactor:AI_SERVICE_URL 默认值收敛为单一真相源,并由 localhost 改 127.0.0.1 (8861116d425)

**2026-10-21**
- 🚀 Feature/Improvement:补齐 IP 白名单与 agent 护栏配置的读写面(整条要登录、只存不拦) (bb494eba53c)

**2026-10-21**
- 🚀 Feature/Improvement:侧边栏第四批对齐 web 终态对账(10 入口,web 端零改动) (08e1da5b63d)

**2026-10-21**
- 🐞 Fix:安全日志页按 security_logs 实列渲染，删掉后端从不给的"状态"列 (761a7a22cab)
- 🚀 Feature/Improvement:PDF 三链真处理落地 + security_logs 接上写入出口 (e1cc3e36ec0)
- 🔧 Chore/Other:钉住危险操作确认的唯一旁路出口(L7224) (251ee617671)
- 🔧 Chore/Other:翻勾 G-107 / G-929 (7ea5a84ed10)
- 🔧 Chore/Other:修 G-929 过期用例并补 G-107 接线四例 (1a12afbdbf2)
- 🔧 Chore/Other:裁决 5 张待拍板票 + 销账 3 张失效票 + 修 1 张回捞副本标记 (a525b912d17)
- 🐞 Fix:扫码弹窗平台清单拉取失败必须响 —— 不再静默留白 (79451dab125)
- 🔧 Chore/Other:publish-scan 归入 @browser-hub 档 + 平台选择兼容 pill(机主选 A) (c364b64a0de)
- 🐞 Fix:补齐 ROUTE_ROOT_BG 剩余 27 屏 chrome 档 —— 顶栏结构锁全量测试唯一红清零 (63cd174c852)
- 🐞 Fix:补齐 ROUTE_ROOT_BG 剩余 27 屏 chrome 档 —— 顶栏结构锁全量测试唯一红清零 (b6568357c97)
- 🔧 Chore/Other:work-panel 切 tab 改按 store 现读 id 选「非激活那颗」—— 收 P4-6 (ddfa3590e0e)
- 🚀 Feature/Improvement:暖色描边禁令装上旁路落地腿 —— 门 231 增 --rev 审树档,落地器 fail-closed 调用 (e1f18b5a320)
- 🐞 Fix:登录历史改接真数据源 audit_logs，并清偿本会话写进的 zh-TW 简体用字 (05940a38cef)
- 🔧 Chore/Other:重钉 ui-routes 派生自述钉(承接 6ddca76ce8 的 11 处源改动) (b39af6dae53)
- 🐞 Fix:原生组件着色属性位的 CSS var 全部改成 JS 派生值 —— 11 处此前静默回落宿主默认色 (6ddca76ce83)
- 🔧 Chore/Other:重钉 web/RN ui-routes 自述钉并补回 MyPapers/DistributionCompany 两枚白名单(1fc61a86437 旁路落地未跑写回钩子) (5bede5f6858)
- 🚀 Feature/Improvement:把"没设≠没色"这条因果律推到 web 腿 —— 门 231 增 W5 与 CSS 输入类维,并钉掉 3 枚裸 Switch (be681a0bcee)
- 🔧 Chore/Other:fix(tokens)+feat(scripts): danger 暗档文字改取 #f87171(原 #ef4444 压在自己 /10 淡底上实测 4.21 不达 AA)+ 状态色文字射程对账尺子入库(自检 8/8、镜像 9/9,含同面口径修正) (721e61b929b)
- 🐞 Fix:资产注册表强制单实例 —— 根治「本地 PNG 的 Image 在 release 上恒空白」这一类 (4a876685d26)
- ⚡ Perf:图片引用升 ?v=20261021 + 预热脚本 no-cache 强制回源 (720d3f582f7)
- 📚 Docs:补 §21 欠账——登记移动 App 与 web 逐页对齐口径与本批 35 屏 (2834f08be35)
- 🐞 Fix:登录历史卡按 security_logs 实列渲染，不再读后端从不返回的字段 (dcf3735fc2a)
- 🐞 Fix:补录侧边栏新挂 7 入口的 ROUTE_ROOT_BG chrome 档(ApiKeys/Usage/Groups/Invoices/Points/VoiceStt/AgentCategories) (76452bb2069)
- 🚀 Feature/Improvement:补齐我的试卷与分销中心，并收口 i18n 动态拼键反模式 (1fc61a86437)
- 🐞 Fix:反代目标 localhost → 127.0.0.1(修正 d4bfb37b7e6:标题即此修复但内容未落地) (0d36f406d20)
- 🚀 Feature/Improvement:侧边栏对齐 web 第二批 —— AI 组补 /models 与 /agents 父子入口,三域补 web 漏挂项,清 4 处重复登记,回归锁扩到域 hub(web 端零改动) (330056b5352)
- 🔧 Chore/Other:按 HEAD 干净面重生成 web/RN 两份 ui-routes 产物钉 —— 收门 105 的 G5 (acc4ab047d5)
- 🔧 Chore/Other:摘回门 233 注册条目 —— 点名面被他人 605 行在飞改动占住,先不给别人埋雷;门体降为常设只读尺子 (ec025c8fd6d)
- 🔧 Chore/Other:work-panel 收藏按钮按 aria-label 定位 + 切 tab 改为轮询等待 (d07b67bfdbb)
- 🔧 Chore/Other:清掉 check-ops-patrol 三枚存量红 —— 两枚是测量缺陷,一枚是半截落地的欠账 (04b56a1011f)
- 🐞 Fix:反代目标 localhost → 127.0.0.1,根治 WS 通知 ECONNREFUSED(34,701 次 ::1) (d4bfb37b7e6)
- 🔧 Chore/Other:G-924 apps/cli 记忆模块两处直连后端改走 api-client(守门 73 真存量):新增 packages/api-client/src/endpoints/memory.ts 端点(listMemories/createMemory),endpoints barrel 增加导出;UnifiedMemoryClient.getEntries/addEntry 由裸 fetch 改调 api-client 端点,保留 SSRF 守卫与降级语义 (7f586945251)
- 🚀 Feature/Improvement:门 233 门体入库 —— 状态色文字角色档的对比度射程对账(自检 8/8 含两支阳性对照与两支反证) (33bee2381e2)
- 🚀 Feature/Improvement:新守门 check-state-text-contrast.mjs 接进提交链 (c7d7f57aaf8)
- ⚡ Perf:/status 只 SSR 前 30 条模型,其余按需展开(1.05MB → ~30KB) (b9ec5f4dfaf)

**2026-10-21**
- 🚀 Feature/Improvement:补齐 6 屏对齐 web 内容编辑域(文章/问答/名片/AI世界/广场发布) (ce9c8c08a8e)
- 🔧 Chore/Other:登录请求显式声明通道 —— 解开本机 e2e 全量的 401 阻断 (67c57e311b6)
- 🚀 Feature/Improvement:补齐 14 屏对齐 web 用户/发布/学习域 (1982228870b)
- 📚 Docs:G-939 成因查明并改写 —— 门 100 头注自写口径只覆盖提交链,而 git-sync-converge 是 commit-tree+CAS 旁路不跑钩子 ⇒ 对旁路合并结构性失明;活改成"把 A1 判据 import 给旁路侧复量" (587f74e7c7d)
- 📚 Docs:登记「已推送提交被并发合并吞掉且守门 100/168 当场没响」这一格(现读枚 12898ccd9b 双否,已 tag 保全并重落) (ffc81df2014)
- 📚 Docs:G-921 翻勾 —— 三枚(Connectors / DomainHub / McpStore)共享层下沉全部落地并上线(枚 588a6342d8 / 7f9eb8eb00 / cc9b3672ef) (316bc4bf2e7)
- 📚 Docs:登记门 39 全量档新增的 6 枚 V1 红(枚 8f16334f48 补齐 12 屏里的 ConnectedAccounts / ImageGenGallery / ImageGenTemplates / Points / Usage / WrongQuestions 六屏未做共享层下沉) (d7deeddd30b)
- 🔧 Chore/Other:重生成 RN ui-routes 自述钉并补回 SecurityCenter 白名单条目(45088b42447 旁路落地时未跑写回钩子) (752074e67f6)
- 🐞 Fix:后台守卫不再把「角色还没查到」折成 0 —— 真管理员冷加载 6 次有 3 次被弹到 /forbidden(附双臂变异自证的时序测试) (c9a75878532)
- 🐞 Fix:监控面板查询失败整轮不落结果 (f6f9715fe98)
- 📚 Docs:守门 229 那条就地改写 —— 补 H4 档(摘前先问门 71 会不会把这条按未勾还原)、H3 基线改判 HEAD^、新增 state=all-held 与 exit 3 的机读结论(全仓不再有无需清扫式兜底文案) (ef8e6666cc9)
- 📚 Docs:票60 就地改写进度注记 —— 第三、四批已落(含被并发合并吞掉那枚的重落凭据),未收口只剩 e2e 真机核验与描边态分窗格 (4e4fc9e5b25)
- 📚 Docs:登记本轮收口留下的六件真活(归档件 lint-staged 雷区其余 84 枚 / 取号入口被 O 族重号顶死 / 门 105 G5 产物钉存量红 / D197 换行开关用例存量红 / 会话滚动位恢复无生产接线 / 多窗格缺 e2e 真机核验) (d96c474a17c)
- 🚀 Feature/Improvement:票60 第三、四批 —— 续传/工具面板/发起分析全面窗格化,跳转总线按窗格门控(重落被并发合并吞掉的 12898ccd9b) (d3541dc2670)
- 🚀 Feature/Improvement:G-921 第三枚(收官)—— McpStoreScreen 的 UI 下沉到共享层(新建 packages/app/src/features/mcp-store/McpStoreScreen.tsx + index.ts 导出组件、类型与共享判据 mcpInstallBlockedKey),RN 侧改 wrapper(只留四项 API 调用 get / install / setStoreServerEnabled / uninstall、安装与卸载二次确认弹层 appAlert、i18n 与主题注入),照 PaymentScreen / DomainHubScreen / ConnectorsScreen 同一型 wrapper 模式。 (cc9b3672ef2)
- 🐞 Fix:输入框外框的常驻暖色环也纳入判据 —— 门 231 W1 增 W1-input 维 (177e5230c40)
- 🚀 Feature/Improvement:补齐 12 屏对齐 web 设置/内容/交易域 (8f16334f483)
- 🐞 Fix:监控面板查询失败保留旧数据 + 筛选下拉不再撑满整行 (70ea7877d40)
- 🐞 Fix:底栏图标改走内联 data URI —— 本地 PNG 的 Image 取源链在 release 上恒空白 (10c2d9e7643)
- 📚 Docs:G-921 登记第二枚(ConnectorsScreen)下沉共享层的进展与凭据(枚 588a6342d8;门 39 全量红 2→1;剩一枚 McpStoreScreen 归下一批) (c8ee7a2c4d6)
- 🐞 Fix:持续性门槛的 firstAt 必须同时进 info —— 派发侧读的就是那一份 (b398a4035ca)
- 🚀 Feature/Improvement:G-921 第二枚 —— ConnectorsScreen 的 UI 下沉到共享层(新建 packages/app/src/features/connectors/ConnectorsScreen.tsx + index.ts 导出组件与类型),RN 侧改 wrapper(只留 API 调用 get/setEnabled/sync/delete、删除二次确认弹层 appAlert、i18n 与主题注入),照 PaymentScreen/DomainHubScreen 同一型 wrapper 模式。 (588a6342d8b)
- 🐞 Fix:补录 SecurityCenter 的 ROUTE_ROOT_BG chrome 档(屏内渲染 NavBar,顶栏 chrome 结构锁判据要求) (c849c50fa11)
- 🐞 Fix:守门 78 补第六维——外部依赖声明↔链接对账,根治 lucide-react 断链致 8 端构建阻断 (c1e0350c61b)
- 🐞 Fix:监控域之外 5 处状态色文字同接角色档 —— 全 web 残留读数 0(同族后缀档 4/4 未动) (1227a9742cb)

**2026-10-21**
- 📚 Docs:G-921 登记第一枚(DomainHubScreen)下沉共享层的进展与凭据(枚 7f9eb8eb00;门 39 全量红 3→2;剩两枚 Connectors/McpStore 归下一批) (0e948350380)
- 🚀 Feature/Improvement:G-921 第一枚 —— DomainHubScreen 的 UI 下沉到共享层(新建 packages/app/src/features/domain-hub/DomainHubScreen.tsx + index.ts 导出组件与类型),RN 侧改 wrapper(只留路由参数 domain、导航分派 target、i18n 与主题注入),照 PaymentScreen 同一型 wrapper 模式;条目图标以 ReactNode 由平台注入,共享层不绑定图标注册表。门 39 全量档红 3→2(DomainHubScreen 摘掉);共享层与 RN 两侧 typecheck 对本票文件零错误(存量 35 条红全在他人工作树删掉的 drawer-nav / SelectionAnnotationBar 面),eslint 0 finding,水印 verify 通过 (7f9eb8eb00b)
- 🔧 Chore/Other:重钉 web/miniapp ui-routes 自述钉(承接监控域角色档接入) (4a02eacc6f3)
- 🐞 Fix:状态色新增「文字」角色档并接上监控域 48 处 —— 亮档真机实测 1.96~2.62 提到 AA 4.5 以上,暗档取值逐字不动 (c2b0c254a12)
- 🚀 Feature/Improvement:安全中心对齐 web 设置页(评分/2FA/会话/安全事件) (45088b42447)
- 🐞 Fix:/agents/featured 去掉从未实现的 featured=1 参数并取全量 —— 原来静默只显示 20/124 (37805cd2e1a)
- 📚 Docs:现读订正「锁的初始化写全再原子可见」—— lib/lock-atomic-init 已在 HEAD 且两把锁均已接线;解阻判据①③成立,② 的 deploy-lock 套件本机并发下 flaky(三连跑 50/2、51/1、52/0),未归因不冒领,留一格 (c4f81394c79)
- ⚡ Perf:英文首页与公开内容页加边缘缓存头 (940303d21db)
- ⚡ Perf:public 图片按显示尺寸收敛，53MB → 49MB（首屏 logo 867KB→53KB） (52257166e09)
- 📚 Docs:修 tab-bar-metrics 的陈旧注 —— 「颜色一律走 CSS 变量」与实测相反 (cd10e14a8dc)

**2026-10-21**
- 🚀 Feature/Improvement:抽屉侧边栏对齐 web 侧边栏(导航单源 + 二级子菜单 + 内容域) (83e0be9c16d)
- 🔧 Chore/Other:暖色描边禁令补齐 extension 射程 + 落原生插件调用形状回归档 (3ea4cbba0cf)
- 🐞 Fix:两处生产者从不发射的字段错配 —— 停摆正文出处句恒缺失、TEMP 在写证据支恒 0(同 firstAt/stat 一族) (b4872d129c6)
- 📚 Docs:现读订正「AGENTS.md 体积判据接进提交链」—— 门 207 已按 1 行紧凑块接线(HEAD 4855 行),C1 余量 389;同轮报警:AGENTS.md 现读 95,845 字节 / 预算 96,000,余量仅 155 字节,出路=整区归档(不代裁范围) (56844bc8e5f)
- 🐞 Fix:目录一次取全(默认 20→200)+ 修 community 触底重复追加同一批 (c30b7f4f107)
- ⚡ Perf:状态页 RSC payload 1.97MB → ~150KB，模型列表改客户端渲染 (7d1d322bf58)
- 🐞 Fix:市场全量页补 pageSize=200 —— 不带参只吃服务端默认 20,124 枚只见 20 (a3b180513e1)
- 🔧 Chore/Other:work-panel P3-3 补 openPanel() —— openPanel({url}) 只导航不置 open (e345966dd6f)
- 🐞 Fix:重贴被并发收敛卷掉的目录取全修复(RN 增量渲染 + 扩展 30→200) (bf2f6aa466e)
- 🔧 Chore/Other:重钉 web/miniapp ui-routes 自述钉(承接漏斗与磁盘配色两枚改动) (e9343fc4c1b)
- 🐞 Fix:门 232 补 onFailHint(此前是两行空串,失败时提交者拿不到任何出路,只能跳门 —— 违 §0.8/§0.10);同笔把门 39 注释里已失真的写死计数(151/153、白名单四枚旧名)改成现读口径 + G-922 后判据形态 (3fb86c5891f)
- 🐞 Fix:漏斗末段绿条与磁盘指标取同源 token —— 原 emerald-600/purple-600 亮档白字实测 3.61/暗档 2.40 低于 AA (c505a415681)
- 🐞 Fix:「我的 Agent」页签改走 /agents/my —— 原来显示的是市场前 20 枚 (3d8d56c58f7)
- 📚 Docs:更正 sshd 自愈块的归因 —— 502 是本机隧道副本无 sshd,不是生产 sshd 挂了 (ba37f554225)
- 📚 Docs:G-922 登记守门 39 判据四修的进展与凭据(枚 bd3bc2238c;剩一格=21 枚屏级共享存量归 G-921 与各屏持有人) (6856b4d1071)
- ⚡ Perf:首页边缘缓存头 + 公网缓存预热脚本 (7ee87c82172)
- 🐞 Fix:冷启动准入不再把 httpOnly 老用户判成匿名 (1d541e8dbe5)
- 🐞 Fix:守门 39 判据四修(G-922)—— ① ROOT 不再由 cwd 定根(改由 import.meta.url 推导) ② screen 正文按面取 blob(HEAD/索引/工作树,取不到即未判定),不再 readFileSync 读盘 ③ 白名单带 why+expires,到期失效、登记名在 screens 清单里不存在=腐烂判红(按现读摘除 DebugScreen/SquareScreen 两枚死账,存量归零后本维才设红) ④ 新增「屏级共享」维:有 import 还得 packages/app 有同名共享屏,存量 21 枚只报数、只拦新增与退化(§0.2 存量未归零不升 blocking);自检 12/12 + 镜像 6/6 + 变异自证(恒真变异 ⇒ 4 例镜像 + 2 例自检翻红) (bd3bc2238c6)
- 🐞 Fix:部署时自愈 sshd —— 生产 SSH 入口 502 的真因是本机 sshd 没在应答 (1eda2b49ef1)
- 🐞 Fix:公网探测派发契约补上 stat 出口 —— 修严重度档恒 0 使恶化即重报通道失明 (31b33393ae3)
- 🔧 Chore/Other:chat-search 搜索框改按真实 testid —— 旧选择器在共享 SearchInput 上结构上不存在 (dd11b1712e9)

**2026-10-21**
- 🐞 Fix:门 231 staged 档把「本枚提交无射程内文件」误判 exit 2 —— 对任何无关提交恒红 (97891b940c7)
- 🚀 Feature/Improvement:门 212 加维 —— RN 聚焦档 focusedStyle 不得带几何键 (e2810ebc063)
- 🔧 Chore/Other:清扫轮摘行前先问门 71 同一把尺子,并修掉 H3 一处既有假红 (7388b68c073)

**2026-10-21**
- 🐞 Fix:自定义 tabBar 选中色/光晕改走 JS 派生态 —— 根因是内联 var(--color-*) 在 weapp 不解析 (e0fbb8a6247)
- 🔧 Chore/Other:修门 77 镜像测试的 B6 行定位提取式(排版加粗即假红,判据强度不减) (ec6e4465d33)
- 🔧 Chore/Other:重钉 web ui-routes 自述钉(承接 wb-cells 定义补齐) (d14a982fb90)
- 🐞 Fix:拔掉原生强调色回落系统橙的那条腿 (eacdb510932)
- 🐞 Fix:补上 wb-cells/wb-cells-lg 的 CSS 定义(修上一枚引入的单列竖排回归) (ce29449b653)
- 🔧 Chore/Other:checkin 页补账号列表桩 —— 收「空状态永不渲染」那一格 (a0ec15f3e0a)

**2026-10-20**
- 📚 Docs:最近更新小节接入提交钩子,开发时自动从 git log 派生 (754c0386974)
- 📚 Docs:自动化文档更新机制 —— 提交即刷新数字,每日 AI 刷新最近更新 (d9368a7a194)
- 🐞 Fix:未跟踪影子与 tip 同 blob 时免逐条授权让位(根治 ff 停摆) (e481ca471de)
- 🐞 Fix:SignPath Dropdown 改原生 select 语义匹配;加 SP_FORM_HTML 诊断 (ec1d23f640d)
- 🐞 Fix:SignPath 下拉框改属性选择器(id 数字开头非法 CSS 选择器,run 实证 SyntaxError);automation 步骤加 15min 超时防 xvfb-run 报错后挂死 44min (f87111ab38f)
- 🚀 Feature/Improvement:TP 支持 npm 邮箱 OTP(302→/login/email-otp 实证):NPM_OTP_CODE input 填码过新设备验证,OTP 后校验登录态 (9478793050f)
- ♻️ Refactor:侧边栏收敛 P1 —— 去重 4 处 + 设置项归位 3 项 (3e367aa971e)
- 📚 Docs:四语言 README 现算数字刷新(598表/49 CI/4443路由/118模型/38平台/2955测试),对齐最新项目状态并补全新增功能与更新详情 (c6250f420c6)
- 🐞 Fix:门 208 按 §7 三问逐条处置三处嵌套仓(一删两留)+ 补 .gitignore 两处真实缺口(门44 exit2 → 0) (9fa43654ec5)
- 📚 Docs:npm 发布永久走 granular token,2FA 与 Trusted Publisher 结论固化 (c6433fe3afd)
- 🐞 Fix:修守门 203 指纹两处缺陷(同题副本折不掉的生产根因)+ 把 union 归并器的「禁止放行」从注释变成真闸 (9e6f4b17bd7)
- 🔧 Chore/Other:TP 登录加网络监听(TP_NET_LOG 抓登录 POST 真实响应) + 表单区 DOM dump(TP_FORM_HTML),定位静默重置根因 (03667e1082b)
- 🐞 Fix:去掉 FormRequestEvent 的重复 re-export(TS2300 打死本包 build) (25e315a77b6)
- 📚 Docs:量算仪对不在注册面的历史门号如实读法 —— 那是已退役/挪号,不是当下缺门 (a7553a56f90)
- 📚 Docs:G-94 行内旧判断就地订正 —— v2 腿已实跑取证,勾选态归 2026-10-18 侧结清,标注无容器格如实保留 (5a87eef4751)
- 🐞 Fix:TP 登录提交按钮限定 form 内防误点页头 + 登录后错误诊断/fullPage 截图/Turnstile 探测;upload-artifact 加 4min 超时防挂死 (410aa41b135)
- 🐞 Fix:TP 登录提交按钮限定 form 内防误点页头 + 登录后错误诊断/fullPage 截图/Turnstile 探测;upload-artifact 加 4min 超时防挂死 (d7ac1e2a375)
- 🐞 Fix:补 scripts/tests/desktop-build.test.mjs 的溯源水印(门 47 欠账) (8634796f2d4)
- 🐞 Fix:reCAPTCHA 指令轮询窗口 6 分钟 -> 10 分钟 (1dc3aa64282)
- 📚 Docs:摘除 6 行 F1/F4 重复登记副本(并发旧基线 union 合并带回),认领标记原样转移 —— F1 3→0 / F4 3→0 (489ad005a52)
- 🚀 Feature/Improvement:清 BP 腿量出的裸路径死调用 —— RN/小程序 2 处 + web 6 处改指在册端点 (4ba1934c568)
- 📚 Docs:仪表盘数字订正为现读 26(删 jaeger/nginx 幻觉盘下游:MONITORING 21→26、README 三处 21/3/21→26、生成器头注 20+1→24 Prometheus+2 Loki)+ sync-readme-numbers.mjs 补溯源水印(CI watermark check 唯一未覆盖文件) (61031d3ad84)
- 🐞 Fix:reCAPTCHA 挑战改按 DOM 格子序号点击,消除 3x3/4x4 坐标漂移 (f67bcb5fa4e)
- 🚀 Feature/Improvement:斜杠命令面对齐 web(模板正文逐字取自 web chat.cmd*)+ 会话批注补复合归属键与 AsyncStorage 落盘(D180 对齐 web 三处语义);附 mobile-rn 五语言 slashCmd/slashTemplate/selectionAnnotations 词条与 automations.schedule 缺键 (895eefbdbd1)
- 🔧 Chore/Other:npm-bootstrap runner 加远端日志镜像与防挂死硬超时 (28563b79d73)
- 📚 Docs:全文陈旧数字现读刷新(四语言同步,遗留项整改) (d56aa604a9d)
- 🔧 Chore/Other:删除已零引用的计划指针净化临时票据 plan-pointer-purge-2026-10-14-b56c9ad7.md(工作树删除收口,全仓零引用,git 历史可取回) (d6d12cfa96c)
- 📚 Docs:补桌面/MSVC 构建注入与未签名豁免文档段 + 端口登记/port 文档 8861 对齐 dev:desktop:saas 新流程【出口②留痕:AGENTS.md 5 段在祖先 fc3cc1e03(union merge)提交过但被后续重组挤出 HEAD,属恢复丢失非复活陈旧——同批代码 msvc-env/desktop-build*/desktop-unsigned-config/desktop-artifact-single 早已在 HEAD(d03e3fe8d68+c304d2bcbb9),文档与代码是同一次工作的两部分;dev-port-registry.json 键路径复活 0、port-management.md 干净,均非 stale】 (f093663094b)
- 🐞 Fix:健康门禁 llm 维加源站 liveness 腿(公网 unknown 折算为绿)+CLEAN-BUILD 净面还原 sw.js (2ed0508fcb5)
- 🔧 Chore/Other:删除 5 个无引用死文件——3 张轮播图(引用已被 banner-*.jpg 替换)+ jaeger/nginx 两盘幻觉看板(零生成贡献) (741338179d2)
- 🚀 Feature/Improvement:reCAPTCHA 闭环升级——挑战截图经 GITHUB_TOKEN 实时推 rc-live 分支(李总侧 raw 读取识别→坐标 rc-clicks.json 回传→点击),成功后清理 (9a598d8e405)
- 📚 Docs:特性总览重写为结构化可扫读的能力展示(基于现读) (14de5d970c3)
- 🚀 Feature/Improvement:reCAPTCHA 图像挑战闭环(截图回传→rc-clicks.json 坐标指令→人类化点击→VERIFY→多轮);automation 超时 40min (998e83c7232)
- 🐞 Fix:BottomPops 门150 半径 control→sm + check-artifact-budget buildHint 对齐 wrapper/unsigned + ONBOARDING 桌面 dev 命令对齐 (a81e7cd986a)
- 🐞 Fix:SignPath DD 改 label 定位 hsfc-DropdownField + combobox/option 交互;dump SP_DD_HTML 诊断 (342bd7a49e3)
- 🐞 Fix:收归未签名豁免单源 + 银行 build 会话桌面端增量(MSVC 根治体系后续) (c304d2bcbb9)
- 📚 Docs:修复最近更新机制基线悬空缺陷 + 块内容改由主线历史重生成 (6e2e29f3605)
- 🚀 Feature/Improvement:守门 8 补 BP 腿 —— 裸路径传输口调用进调用集(本簇真正的根因器物) (a1c2f1f116a)
- 📚 Docs:G-200 结清 —— 服务端有界续写随码入库,本号行与旧号同题副本一并翻勾 (b48b9675bbf)
- 🚀 Feature/Improvement:守门 98 补 D5 维 —— 同一 barrel 文件内同名导出重复当场拦(防第五次回灌) (e4ef3b38ac8)
- 🚀 Feature/Improvement:G-200 服务端有界续写落地 —— finish_reason 三面透传 + 每恢复段 ≤3 次 + 补丁不落持久历史 (bac27c8f7b0)
- 🚀 Feature/Improvement:补 GET /api/user/security 与 /api/circles/users/recommend —— 两条死路径的真实数据源 (7cfd10d17e3)
- 🚀 Feature/Improvement:G-425 端上截断提示补齐 RN + 小程序两条腿 —— done 帧 finishReason 判 length/max_tokens 即 toast,缺席绝不折成 stop (39471e598a0)
- 🐞 Fix:6 个屏的 8 条死路径改指既有后端 —— 不新建端点、不造表 (8b3e8c5d5fa)
- 🐞 Fix:清掉合并带回的 FormRequestEvent 重复导出 —— HEAD 面 TS2300 打死了本包 build (f1d0b6259cc)

- 🔧 Chore/Other:提交后加诊断截图 (77bbeb81aeb)
- 🐞 Fix:不可见 reCAPTCHA 需等待挑战弹出(45s) + anchor 可见性判定 (d0617767f7a)
- 📚 Docs:结清票 68 —— 流式中切换模型三端齐备(web 18 / 小程序 17 / RN 14 用例通过) (24c516271e6)
- 🐞 Fix:先过 reCAPTCHA 再提交 + Submit JS 兜底 + 提交后复查挑战 (c5ccf62a858)
- 🐞 Fix:批注面板圆角补齐角色档(门 150 点名 panel 应为 xl) (1b23b990989)
- 🐞 Fix:reCAPTCHA 通过判据改 token + 2x 超采样截图 + Submit 重放 (50c8f28b5b9)
- 🐞 Fix:SelectionAnnotationBar 徽章圆角改走档位源 rnRadius.md,去掉 rpx(14) 字面量(AGENTS.md 圆角单一源头:禁止 px/rpx 字面量,计数徽章模板即 rounded-md) (5b2b21def28)
- 🐞 Fix:reCAPTCHA 支持动态挑战多屏循环 + 指令改走 Contents API 免 CDN (a6c085b7f16)
- 📚 Docs:登记 RN↔web 能力对齐收口轮 —— 已对齐面/四类平台豁免/四处误报更正/落库与守门收口实证 (da046c43ad1)
- 🐞 Fix:reCAPTCHA 支持动态挑战多屏循环 + 指令改走 Contents API 免 CDN (cc07bcfbeb8)
- 🐞 Fix:mobile-rn ja 的 slashCmd.wechatArticle 去掉简体字「众」(日文应用「公式アカウント記事」);守门 2o ja 中文残留判红 (a2f39092003)
- 🐞 Fix:守门 8 修两处判据盲区 + BP 腿基线下调到 15 (c1afcfc8ce0)
- 🐞 Fix:W3 补命名空间相对取词出口,并收口图片标注裸 TextInput (ba671cd8a99)
- 📚 Docs:登记 P1 2026-10-19 LLM 观测失配修复轮(用户级指标+并发闸+探测降噪+系统身份映射) (715aac66435)
- 🐞 Fix:门 105 四端 ui-routes 派生产物重生成对齐当前 HEAD 源 —— 生成器原话出路(机械动作);生成前已验三个输入源的工作树与 HEAD 逐字一致,故产物自述钉与 head 面现算相等 (c59ee4d85c0)
- 🐞 Fix:LLM 观测失配修复(用户级指标)+ 自伤并发闸 + 探测降噪 + 系统身份映射 (66a47341319)
- 🐞 Fix:门 83 基线补登 ChatScreen.tsx 的 R2 存量 2 处(图片预览浮钮实底 surface.light,D124 引入时漏登基线 ⇒ 全量档恒红);按全量实测只补这一处,不动其余键 (893b31371c7)
- ♻️ Refactor:斜杠命令模板类 id 清单下沉共享层 —— web/RN 共用同一份(端与端 import 边违反架构契约 D1,门 103 判红);web 侧改 re-export 消费方零改动,RN 测试基准换为共享层 (e77e5bb8e49)
- 🐞 Fix:ChatScreen exhaustive-deps 两条 + ImageAnnotator 裸 TextInput 按 G-978007 判据补齐(CI lint/test 存量红) (b98806f33dd)
- 🐞 Fix:agent 迁移 325 三处 ALTER TYPE 补 DROP DEFAULT(CI 测试库 42804 炸点,default 无法自动转换:federated id/dp_noise_added + meta source_skills) (4af9df7f938)
- 🔧 Chore/Other:chat-branch i18n mock 形状对齐类型定义(CI typecheck 5×TS2322) (4dd69c99528)
- 🐞 Fix:token 就位后等 HubSpot 回调自动提交,不再重点 Submit(否则 reCAPTCHA 重弹) (b88382c6836)
- 🐞 Fix:修最后一处 shotPush 作用域错误 (82722394440)
- ♻️ Refactor:划词批注输入框改用共享层 TextField(§3 共享层优先,端内禁止裸 TextInput);tsc/eslint/门218/门128/水印 全绿 (aaf524d3ebd)
- 📚 Docs:G-194 结清 —— 真机复量:当前 HEAD 首页滚动已不复现,修法未落地 (5041621176d)
- 🐞 Fix:沿祖先链修正显示属性并抬高层级(挑战被页面盖住) (f40959d2d9c)
- 📚 Docs:G-167 ② 已落地并翻勾 —— 流键派生收口到 i18n-key-flow.mjs (0171084ee26)
- 🚀 Feature/Improvement:G-167 ② 流键提取收口到 i18n-key-flow.mjs,门 2 与死键扫描共用同一份派生 (704aeb8f43d)
- 🐞 Fix:强制把挑战 iframe 摆到可见位置(宿主 CSS 压成 150px 条带) (bba38b54b88)
- 🐞 Fix:撤掉 CDP DPR 覆盖(打乱挑战浮层定位) + 网格截图取最大 bframe (df022c4ee35)
- 🐞 Fix:挑战可见性判据改用格子计数 (7f0d26c28aa)
- 🐞 Fix:修 shotPush 作用域错误 + console.error 入镜像 (0fe03661205)
- 📚 Docs:撤回票 68 的错误翻勾 —— 运行时合格证未取得,且该行认领在他席 (68f7664a39e)
- 📚 Docs:结清 D113 流式 diff 实时预览(复验+回归绿) (79c54edbd64)
- 🐞 Fix:--staged 归属判据改差值棘轮(锚 HEAD),解除全场提交被迫跳门的恒红 (18eb57d63de)
- 📚 Docs:结清两条 P0 技能市场授权缺陷(复验+回归绿) (5b52770931d)
- 📚 Docs:守门 207 体积瘦身 —— §1「重复登记副本」两行历史叙述整区搬入归档件(逐字原文,原位置留一行压缩条款,规则内核一字未减),另删一处与文首逐字重复的压缩版说明行;载荷行逐字未变、零宽字符总数未变(脚本自证) (8b05e0e2f5b)
- 🐞 Fix:sso 隧道源站 8543→8850(端口铁律,注册表+docs §2.7 双向登记) (3b5fa476169)
- 🐞 Fix:disable xinference local provider probe by default (afd853023e9)
- 🐞 Fix:orchestration_hub 事件改为单键 JSON 写入 Redis 流 (6048e094485)

- 🐞 Fix:监控大屏(panels)适配明暗主题,移除写死蓝黑配色 (790f669fbc3)
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
