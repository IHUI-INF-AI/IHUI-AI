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
| 测试文件 | 3016 | `testFiles` |
| CI 工作流 | 49 | `ciWorkflows` |
| Compose 服务 | 14 | `composeServices` |
| 工程守门 | 267 | `guardianGates` |
| — blocking | 243 | `guardianBlocking` |
| — warn | 27 | `guardianWarn` |
| 跟踪文件 | 15530 | `trackedFiles` |

上表由 `node scripts/gen-doc-numbers.mjs --markdown` 生成,最后核对日期 2026-10-21。
每个数的来源就写在取数键旁边的实现里(`scripts/gen-doc-numbers.mjs` 的 `SOURCES`),**不得手抄、不得另立第二份**。

<!-- END GENERATED NUMBERS -->


## Recent updates (auto-maintained)

<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->
**2026-10-21**
- 🚀 Feature/Improvement:生产签出外来工作只读尺子装车(尺子+12例镜像测试+巡检双挂点) —— 未跟踪洪水只计数不判定,结论行新增 untracked 字段;抓到生产签出 12 枚远端没有的已暂存新文件 (e7581c4ee0f)
- 📚 Docs:extension/cli/miniapp 分区注释与 models --all 帮助文案对齐 2026-10-21 isArchivedModel 新判据(standard 不再折叠)——8 处滞后旧语义收口 (2512a6b8ee7)
- 🐞 Fix:补回被合并 fba604cf4a 吞掉的四枚文件 (41015953631)
- 🐞 Fix:抽屉底部 UserRow 与 web 对齐 —— 上下对称 8px (ef3f4cad032)
- 🐞 Fix:reset 判据改看被丢的那一枚 —— 备份过的 reset 不再恒红 (fe1031d8df1)
- 🚀 Feature/Improvement:TS 增量缓存整体请出源码树 —— 回收站灌入的最后一格根治 (2094d275c70)
- 🐞 Fix:stagedTriggers 支持 glob —— 97/98/102 三道 blocking 门不再隐形跳过 (b981746fd9b)
- ♻️ Refactor:本地 api<T>() 手抄壳迁移第 4 轮 —— 103 枚壳 + 55 枚调用方改读单源出口 apiOrThrow(逐字裸转发才迁,7 枚 ApiError/errorCode 特型点名不迁) + ui-routes 派生钉随源刷新;验证:typecheck 基线 1 错不增、touched 全量 eslint/prettier 0 问题、URL 字面量多重集守恒、门 105 预飞 matched (0d0e601d3cc)
- 🐞 Fix:策略器补空枚举反证与四态自检,两处"NukeOnDelete 不约束"旧断言按实测更正 (c2a82df9db0)
- 🐞 Fix:侧栏底部用户行容器改纯色底、上下内边距对称 (b8464f6946f)
- 📚 Docs:G-939 收口 —— 吞并枚复现(单亲非 FF relay 重写,非合并)+ 丢失集守卫已接 casUpdateRef(枚 feb0cd072d),镜像 8/8 回归全绿,翻勾 (cf68170f569)
- 🐞 Fix:G-939 丢失集守卫接进 casUpdateRef 共享咽喉 (feb0cd072d1)
- 🐞 Fix:ui-routes 产物自述钉刷新 —— 门 105 唯一红 G5 清零(派生产物,web 源码零改动) (51c09d5d1c7)
- 🐞 Fix:ui-routes 产物自述钉刷新 —— 门 105 唯一红 G5 清零(派生产物,web 源码零改动) (dc4ab093c12)
- 📚 Docs:票60 普查批收口 —— 普查段 5 座 store 全部定档落地(4 座窗格化+business-forms 先前收窄)、发送链 paneIdForChatStore 反查、六座实例随叶回收、残余② advance.retryable 补 toast,残余归零本行翻勾,枚 ce88ed459c (b638680a880)
- 🐞 Fix:给"删除不落回收站"这道闸门找到主人,并把树内再生缓存从 KEEP 里分出来 (69b2d7ba724)
- 🚀 Feature/Improvement:票60 普查批 —— 剩余 4 座全局 store 逐座定档按窗格寻址 + 发送链按 chatStore 反查伴生态 + 六座实例随叶统一回收 + 非根 advance.retryable 补 toast (ce88ed459c0)
- 🚀 Feature/Improvement:侧边栏与 web 端全量对齐(第六批,web 端零改动) (86b96f6d180)
- 🚀 Feature/Improvement:侧边栏与 web 端全量对齐(第六批,web 端零改动) (eca62eeb4b2)

**2026-10-21**
- 🚀 Feature/Improvement:生产签出外来工作只读尺子装车(尺子+12例镜像测试+巡检双挂点) —— 未跟踪洪水只计数不判定,结论行新增 untracked 字段;抓到生产签出 12 枚远端没有的已暂存新文件 (e7581c4ee0f)
- 📚 Docs:extension/cli/miniapp 分区注释与 models --all 帮助文案对齐 2026-10-21 isArchivedModel 新判据(standard 不再折叠)——8 处滞后旧语义收口 (2512a6b8ee7)
- 🐞 Fix:补回被合并 fba604cf4a 吞掉的四枚文件 (41015953631)
- 🐞 Fix:抽屉底部 UserRow 与 web 对齐 —— 上下对称 8px (ef3f4cad032)
- 🐞 Fix:reset 判据改看被丢的那一枚 —— 备份过的 reset 不再恒红 (fe1031d8df1)
- 🚀 Feature/Improvement:TS 增量缓存整体请出源码树 —— 回收站灌入的最后一格根治 (2094d275c70)
- 🐞 Fix:stagedTriggers 支持 glob —— 97/98/102 三道 blocking 门不再隐形跳过 (b981746fd9b)
- ♻️ Refactor:本地 api<T>() 手抄壳迁移第 4 轮 —— 103 枚壳 + 55 枚调用方改读单源出口 apiOrThrow(逐字裸转发才迁,7 枚 ApiError/errorCode 特型点名不迁) + ui-routes 派生钉随源刷新;验证:typecheck 基线 1 错不增、touched 全量 eslint/prettier 0 问题、URL 字面量多重集守恒、门 105 预飞 matched (0d0e601d3cc)
- 🐞 Fix:策略器补空枚举反证与四态自检,两处"NukeOnDelete 不约束"旧断言按实测更正 (c2a82df9db0)
- 🐞 Fix:侧栏底部用户行容器改纯色底、上下内边距对称 (b8464f6946f)
- 📚 Docs:G-939 收口 —— 吞并枚复现(单亲非 FF relay 重写,非合并)+ 丢失集守卫已接 casUpdateRef(枚 feb0cd072d),镜像 8/8 回归全绿,翻勾 (cf68170f569)
- 🐞 Fix:G-939 丢失集守卫接进 casUpdateRef 共享咽喉 (feb0cd072d1)
- 🐞 Fix:ui-routes 产物自述钉刷新 —— 门 105 唯一红 G5 清零(派生产物,web 源码零改动) (51c09d5d1c7)
- 🐞 Fix:ui-routes 产物自述钉刷新 —— 门 105 唯一红 G5 清零(派生产物,web 源码零改动) (dc4ab093c12)
- 📚 Docs:票60 普查批收口 —— 普查段 5 座 store 全部定档落地(4 座窗格化+business-forms 先前收窄)、发送链 paneIdForChatStore 反查、六座实例随叶回收、残余② advance.retryable 补 toast,残余归零本行翻勾,枚 ce88ed459c (b638680a880)
- 🐞 Fix:给"删除不落回收站"这道闸门找到主人,并把树内再生缓存从 KEEP 里分出来 (69b2d7ba724)
- 🚀 Feature/Improvement:票60 普查批 —— 剩余 4 座全局 store 逐座定档按窗格寻址 + 发送链按 chatStore 反查伴生态 + 六座实例随叶统一回收 + 非根 advance.retryable 补 toast (ce88ed459c0)
- 🚀 Feature/Improvement:侧边栏与 web 端全量对齐(第六批,web 端零改动) (86b96f6d180)
- 🚀 Feature/Improvement:侧边栏与 web 端全量对齐(第六批,web 端零改动) (eca62eeb4b2)

**2026-10-21**
- 🐞 Fix:11 枚脚本改走 face-reader 取材 —— 清偿"裸 git 派生生产文件"棘轮的 11 处新增 (8d8bae27a22)
- 🐞 Fix:切流受阻告警的"宽限窗超期转正式告警"永远到不了期 —— 45 分钟登录 500 一封信都没寄的第二根因 (38d2f44a10d)
- 🐞 Fix:模型选择器"调不通的还在显示、能调通的没显示"三处根治 (624e5a7a904)
- 📚 Docs:agent.md 补同源与适用范围声明 —— 消 §0.6 第二份真相、限定 §0.8 那条承诺 (4b0aeb7a033)

**2026-10-21**
- 🐞 Fix:api-migration 门与镜像测试跟上现役端点(/api/agents/my),[8/8] 的 Windows 崩溃码显式未判定 (6a0f666c6b7)
- 📚 Docs:本侧 G-926 未勾旧行对齐为对侧已勾版 —— 该票已由 chore(gates) 归档出口件枚落地,union-converge 的折叠层拒裁的两态并存属本侧滞后,按远端事实对齐 (a87bb0dad85)
- 📚 Docs:修正 README 与代码相反的默认值 —— 写着 default https://api.aizhs.top,实际 src/config/defaults.ts:27 是 http://localhost:8802 且无内置公网域(§0.8:文档不得写跑不通的出路;取证席全仓扫"写死慢臂基址"时顺带挖出,无用例钉该句,watermark verify 1/1 无损) (13577fcf824)
- 📚 Docs:G-866 就地翻勾结清 —— 同一 URL 连打三次实测 EO 默认遵守源站 s-maxage 缓存 /api(第2/3次 HIT,Age 4/8);此前"两次都 MISS"是我自己的测试缺陷(第一次带随机 cache-buster ⇒ 两个不同缓存键),免控制台即判,不消耗免费版唯一规则额度 (ffc80eb00cb)
- 🔧 Chore/Other:课程域死端点清账:附件屏换源 /api/resources、删除 members/:id 与 categories/tree 死函数、修 CourseScreen tags 悬空崩溃 (64747d0733c)
- 📚 Docs:票60 补 e2e 收口注记(双流式 3 例枚 8e45f91a6f; G-935 已由 23b7ae8164 翻勾并被 509c7cc1d8 完成即删摘除, 行内指向结清; 本行不翻勾, 残余仍为 advance.retryable 静默 + 普查 5 座全局 store) (3f743381590)
- 🔧 Chore/Other:G-926 翻勾(B 档 62 枚全收尾,守门 13/13,按 heal 纪律不删行) (1e96e49cac1)
- 🚀 Feature/Improvement:npm-bootstrap 增加 org_create 动作(真 Chrome+xvfb 网页代行建 npm org) (05c80ad3f76)
- 🐞 Fix:form-request 捕获改用 JS fetch 覆盖绕开跨域预检拦截 (adab5bf9597)
- 📚 Docs:补 R4 点名义务 —— 本批四件器物(出口 IP 巡检尺子 / 部署收尾预热 / 公开接口缓存头唯一出口 / 源站直连守卫)在根 README 逐条点名,写清判据、自检与"判机器状态一律不接提交链"的定级理由 (b11f1599de9)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (044ca7cdc63)
- 🔧 Chore/Other:RN 课程域第二程:目录/章节/评价三屏换源 /api/learn —— api-client 新增 getCourseCatalog/getCourseComments 出口(详情再投影 + rates 端点,口径与旧 /api/courses/:id/* 逐字同,绕开正被清除的注册面),课程详情报名成功即补拉学习进度,CourseCatalogItem 补 videoUrl 挂点;顺清 memory.ts 存量 eqeqeq x4 (a48f62d5def)
- 🐞 Fix:release-sdk 补 @ihui/types 构建前置 + NPM token 改名取自 NPM_PUBLISH_TOKEN (790cec5b53d)
- 🔧 Chore/Other:让号收口 F9 撞号 —— G-922 让给 G-1162551(归并前置,零删行) (6ce7934a1d2)
- 🔧 Chore/Other:G-865/G-935 翻勾(完工事实在链,按 heal 死循环纪律不删行) (23b7ae81643)
- ♻️ Refactor:G-929 恢复开放面留存(带完工注记)—— heal 死循环下唯一双绿稳定形态 (3d174f989e2)
- 🔧 Chore/Other:收编 agent.md 机主指令件与 tauri 两枚权限生成物入库 (f5b5bfa1b82)
- 🐞 Fix:一枚真代码回归 + 一枚门停在旧世界 + 两枚测试在干净检出上取证不了 (ba2aa4070d7)
- 🐞 Fix:修 checkin 空状态与侧边栏导航对齐两处 CI 红 (29c9ec7ad75)
- 🔧 Chore/Other:票60/G-935 双流式互不顶补上真机核验 —— 新增 chat-pane-parallel-stream.spec.ts 3 例(① 两格并发流式交错推送,增量只进自己那格且终态逐字等值 ② 反证 两条流在同一瞬间都活着、甲收束不牵动乙 ③ 停止只 abort 自己那一格,乙照样跑完);自控 fetch 泵逐帧推 Response(ReadableStream),读环/行缓冲/parseStreamLine/水位闸/abort 归因全走生产码;传输面按 frameContents 抽 content 后逐字断言(整帧原文 join 数学上不可能含连续 payload);全链 page.route mock 不依赖活后端,连跑两轮 3 passed / 3 passed (8e45f91a6fb)
- 📚 Docs:停摆工作树收口 - 五份活文档三方归并 + AGENTS 体积搬出(消门 207 与门 89 R4) (bab1bf4c6ce)
- 🐞 Fix:六枚镜像测试 + 一枚门 —— 有人是"测试停在旧世界",有人是"干净检出上不可能满足" (077d01f6c53)
- ♻️ Refactor:G-929 指针注记化(破 heal 死循环:窗口滚动后删行必被判无凭据减少) (8dfbca5b45a)
- 🔧 Chore/Other:课程学习进度全链接线:详情端点补真实评分与小节时长秒字段,api-client 课程域收口到 /api/learn 小节制进度/心跳,播放器 15s 节流心跳+标记完成走自动完成契约,课程详情清单按小节渲染 (d510ab99efa)
- 🐞 Fix:用户自装的 mmcode 自愈脚本不是 agent 污染 —— 显式豁免 (18c81b13af9)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3cb5fd123b4)
- 📚 Docs:回补 32 枚 PROJECT_PLAN 归档锚点件入库 (aba30748621)
- 🔧 Chore/Other:G-929 完成即删摘行(二翻勾配平后) (ad31c98c3fa)
- 🐞 Fix:免费旗舰 :free 变体救回为 latest 档(免翻折叠区) (4cb7f72a253)
- 🐞 Fix:把 glass 两档登记进跨端 token 对账 —— 暗档手抄白值的漏登记当场补上 (688d894ae42)
- 🔧 Chore/Other:G-929 二翻勾(配平 2 笔历史无凭据减少,完工事实不变) (8bc3d0ff549)
- 📚 Docs:G-870 就地改写为终稿 —— 用户可见缺陷本身已按"不依赖控制台"的路径修掉(web 补 /uploads 精确代理 + FILE_CDN_BASE 改判 www 快臂),剩这一格只做"历史死链自愈+微信 applinks",并如实写明为什么我这边推不动(zone 记录改指隧道只有 CF 登录态一条路,本机无 token 且内置浏览器面板 visibilityState=hidden、行内下拉合成事件不弹) (600f2c61b68)
- 🔧 Chore/Other:登记 line-loss「已收拢」判据缺第三形态票 + 摘 G-79 S1 行 (1a03a2cc5aa)
- 🔧 Chore/Other:G-929 完成即删摘行(翻勾后整行删除) (a0713703c2f)
- 🔧 Chore/Other:G-929 翻勾(暖色门 --root 收口,镜像 28 红全消) (833ed224c9b)
- 🐞 Fix:把 /uploads 精确前缀补回 web 代理 —— 实测快臂上公开文件结构性不可达(探针文件 8802/api 臂 200 image/png,www 臂 133KB Next 404 HTML) (7f94692c39f)
- 🐞 Fix:暖色描边门支持 --root 显式被审仓根 + 落地器透传 —— 镜像套件 28 红全消(66/66);镜像 M16 三态+双向变异验证 (ad02ccba7df)
- 🔧 Chore/Other:撤回本席对锁票的翻勾(单方面 [x] 会造出 F1 同主键两态并存,顶死 union-converge) (ccc117c72ea)
- 🔧 Chore/Other:G-79 结清 + 锁票改判消 F1 两态并存 (96ddaeadfcd)
- 🐞 Fix:清偿三盏存量红灯 —— mobile-rn 未用导入 / i18n 过期契约声明 / OpenAPI 产物漂移 (a89a26f1dfc)
- 🔧 Chore/Other:解推送车道的一枚阻塞 —— 按**远端逐字节原值**恢复一枚被两侧判成"本侧删除"的临时件 (ea325b1eeac)
- 🐞 Fix:删掉自己用例里的一处类型红(noUncheckedIndexedAccess) (e4098efc4b9)
- 📚 Docs:登记 file.aizhs.top 那一半还没修的死链(决定性差分已量:同刻同服务 api 200 / file 502,隧道第5条路由本已存在⇒病灶在 zone 记录)与"为何选改记录而不选改 .env" (b9898ddc450)
- 🐞 Fix:余额为 0 不再等于通道不通 —— OpenRouter :free 模型从选择器复活 (9fa52f020c2)
- 🚀 Feature/Improvement:服务自愈第三格"连续六小时量不到"也接到人 —— 报的不是服务坏了,是看守层瞎了 (ef064b20659)
- 🔧 Chore/Other:deploy-lock flaky 归因取证做实 + 摘 1 条 S1 滞留已勾行 (afbfec0699f)
- ♻️ Refactor:本地 api<T>() 壳首批迁到 apiOrThrow 单一出口(L7162 第一批 14 枚) (44c476593a4)
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
- 🚀 Feature/Improvement:补齐 IP 白名单与 agent 护栏配置的读写面(整条要登录、只存不拦) (bb494eba53c)
- 🚀 Feature/Improvement:侧边栏第四批对齐 web 终态对账(10 入口,web 端零改动) (274c78e0eaa)
- 🔧 Chore/Other:G-212 重新销账 + L7233 现读复量 (9aeb9d51a60)
- 🔧 Chore/Other:复验 L7177 区段头折行结清 + 更新 D18/L6762 现读 (ee57b4c96d2)
- 🐞 Fix:门 193 掩码根治 —— markHidden 认正则字面量(L477 病灶跨行错位误判自检夹具判红 2 处阻塞 push),连带清偿 4 处被错位洗绿的真违规 (98e7b8a62c4)
- 🚀 Feature/Improvement:侧边栏第四批对齐 web 终态对账(10 入口,web 端零改动) (08e1da5b63d)
- 📚 Docs:G-939 结清 —— 旁路合并侧已 import 门 100 的 A1 判据在 update-ref 前复量(枚 402f347edc/bf25ee60e2),红则拒推进+保全悬空枚+点名,裸跳门旗不放行;镜像 6/6 含真夹具正控,最近 4 枚 converge 合并逐枚复量 lost=0 (47cb77e6495)
- 🐞 Fix:Python 子进程一律钉 UTF-8 —— 那族门在 Windows 上会把「判据说的话」读成乱码 (d6655c70c30)
- 🚀 Feature/Improvement:派发契约键集对账尺子入库(常设只读,禁接提交链)—— 12 格真跑 119 个声明读键全量到;自检 7/7 含'不许裸豁免'与'跑不出 JSON 不得当空集'两条反证,并明写两条边界(不发现新读键、数组元素内字段不在射程) (58bd3c15e52)
- 🔧 Chore/Other:补 ai-service 空 venv —— 判据住在 Python 里的那族守门此前在 CI 上恒「未判定」 (0c6723389f1)
- 🔧 Chore/Other:翻勾 G-274 与 G-1162551,改判 G-620/G-923 现读 (89c12fe5665)
- 🚀 Feature/Improvement:G-934 会话级滚动位恢复接回生产 —— hook 切走落账/切回二段恢复(RESTORE_PHASE2_DELAY_MS/RESTORE_GRACE_MS 由模块常量驱动),键加窗格维 pane::conversation 防双窗格同会话互串,grace 期修正挂 handleScroll,卸载定时器;成对用例 6 例(正向=窗格隔离,反证=单窗格缺省形态逐字不变;把窗格维摘掉 4 例当场红) (c5b3f0f65d9)
- 🚀 Feature/Improvement:把 SSE 全量帧盲合并门接进提交链(id 233,blocking)—— 收 G-274 (b559acd95cd)
- 🚀 Feature/Improvement:G-939 补第二格 —— 吞并复量"过了也要把判过量出来"(丢失/补回计数落 dim 行),atRefUndetermined 非空时单独喊未判定,不并进"零丢失"那句(§0.3:静默通过与根本没跑到这一步在日志里同形) (bf25ee60e2a)
- 🐞 Fix:安全日志页按 security_logs 实列渲染，删掉后端从不给的"状态"列 (761a7a22cab)
- 🚀 Feature/Improvement:PDF 三链真处理落地 + security_logs 接上写入出口 (e1cc3e36ec0)
- 🐞 Fix:G-939 把门 100 的 A1 判据 import 给旁路合并侧复量 —— commit-tree+CAS 不跑钩子,对"吞掉对侧独有新增"结构性失明(实测本轮自己的 wave3 提交被卷走);落 update-ref 前拒推进并 backupOrphanMerge,裸 skipEnv 无理由照拦,成对镜像 6 例含真夹具正控 (402f347edc2)
- 🔧 Chore/Other:翻勾 L7224 / G-932 / G-922 (079a269bf6f)
- 🔧 Chore/Other:检出改为全历史 —— 那批"必须拿真仓历史证"的判据在浅克隆上结构上过不了 (2fc70504830)
- 🔧 Chore/Other:钉住危险操作确认的唯一旁路出口(L7224) (251ee617671)
- 🔧 Chore/Other:翻勾 G-107 / G-929 (7ea5a84ed10)
- 🔧 Chore/Other:修 G-929 过期用例并补 G-107 接线四例 (1a12afbdbf2)
- 🔧 Chore/Other:裁决 5 张待拍板票 + 销账 3 张失效票 + 修 1 张回捞副本标记 (a525b912d17)
- 🐞 Fix:扫码弹窗平台清单拉取失败必须响 —— 不再静默留白 (79451dab125)
- 🔧 Chore/Other:publish-scan 归入 @browser-hub 档 + 平台选择兼容 pill(机主选 A) (c364b64a0de)
- ♻️ Refactor:AI_SERVICE_URL 默认值收敛为单一真相源,并由 localhost 改 127.0.0.1 (8861116d425)
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
- 🚀 Feature/Improvement:补齐 6 屏对齐 web 内容编辑域(文章/问答/名片/AI世界/广场发布) (ce9c8c08a8e)
- ⚡ Perf:/status 只 SSR 前 30 条模型,其余按需展开(1.05MB → ~30KB) (b9ec5f4dfaf)
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
- 🐞 Fix:底栏图标改走内联 data URI —— 本地 PNG 的 Image 取源链在 release 上恒空白 (10c2d9e7643)
- 🐞 Fix:补录 SecurityCenter 的 ROUTE_ROOT_BG chrome 档(屏内渲染 NavBar,顶栏 chrome 结构锁判据要求) (c849c50fa11)

**2026-10-21**
- 🐞 Fix:监控面板查询失败保留旧数据 + 筛选下拉不再撑满整行 (70ea7877d40)
- 📚 Docs:G-921 登记第二枚(ConnectorsScreen)下沉共享层的进展与凭据(枚 588a6342d8;门 39 全量红 2→1;剩一枚 McpStoreScreen 归下一批) (c8ee7a2c4d6)
- 🐞 Fix:持续性门槛的 firstAt 必须同时进 info —— 派发侧读的就是那一份 (b398a4035ca)
- 🚀 Feature/Improvement:G-921 第二枚 —— ConnectorsScreen 的 UI 下沉到共享层(新建 packages/app/src/features/connectors/ConnectorsScreen.tsx + index.ts 导出组件与类型),RN 侧改 wrapper(只留 API 调用 get/setEnabled/sync/delete、删除二次确认弹层 appAlert、i18n 与主题注入),照 PaymentScreen/DomainHubScreen 同一型 wrapper 模式。 (588a6342d8b)
- 🐞 Fix:守门 78 补第六维——外部依赖声明↔链接对账,根治 lucide-react 断链致 8 端构建阻断 (c1e0350c61b)

**2026-10-21**
- 🐞 Fix:监控域之外 5 处状态色文字同接角色档 —— 全 web 残留读数 0(同族后缀档 4/4 未动) (1227a9742cb)
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
- 🐞 Fix:门 231 staged 档把「本枚提交无射程内文件」误判 exit 2 —— 对任何无关提交恒红 (97891b940c7)
- 🐞 Fix:自定义 tabBar 选中色/光晕改走 JS 派生态 —— 根因是内联 var(--color-*) 在 weapp 不解析 (e0fbb8a6247)
- 🔧 Chore/Other:修门 77 镜像测试的 B6 行定位提取式(排版加粗即假红,判据强度不减) (ec6e4465d33)
- 🚀 Feature/Improvement:门 212 加维 —— RN 聚焦档 focusedStyle 不得带几何键 (e2810ebc063)
- 🔧 Chore/Other:清扫轮摘行前先问门 71 同一把尺子,并修掉 H3 一处既有假红 (7388b68c073)
- 🔧 Chore/Other:重钉 web ui-routes 自述钉(承接 wb-cells 定义补齐) (d14a982fb90)
- 🐞 Fix:拔掉原生强调色回落系统橙的那条腿 (eacdb510932)
- 🐞 Fix:补上 wb-cells/wb-cells-lg 的 CSS 定义(修上一枚引入的单列竖排回归) (ce29449b653)
- 🔧 Chore/Other:checkin 页补账号列表桩 —— 收「空状态永不渲染」那一格 (a0ec15f3e0a)

**2026-10-20**
- 🐞 Fix:修掉本票 e2e 锁里一枚不存在的 Playwright 断言方法 (c7de0dc2d18)
- 🐞 Fix:被动失效清桌面 vault 也走 CAS —— expireSession 曾盲清 auth.json,抹掉另一窗口刚轮转写回的新 token(自动登录时好时坏的另一条腿);补 api.test 三例与 store 侧 CAS 五例、小程序 clearAuth 同批清用户资料断言 (e53a1911c91)
- 🔧 Chore/Other:收紧门 218 的 RN 端硬编码 hex 基线(P0 治理后置) (c498f676642)
- ♻️ Refactor:摘除 packages/app 零消费者底栏副本(文件 + barrel 两行导出) (1d8f576f35a)
- 🔧 Chore/Other:给监控面板两种呈现的切换器钉一条真实浏览器 a11y 回归锁 (d4c48f875eb)
- 🔧 Chore/Other:首次 bootstrap .ihui-agent/archive/ 的 lint-staged 就近出口件 (a966301a801)
- 🐞 Fix:归零 11 屏 137 处圆角死类名(此前圆角实际为 0),并修 3 屏占位符明暗颠倒 (1e965254164)
- 🔧 Chore/Other:重生成 ui-routes 产物自述钉 —— 收旁路合并点名的那步"落地后需重生成" (4d57b0c3080)
- 🔧 Chore/Other:重钉 web ui-routes 自述钉(承接内层网格改造经归并后的当前面) (4c9736fb71e)
- 🐞 Fix:大屏内层 StatCell/KPI 网格改 auto-fit,消除窄轨逐字换行 (706f8d02dd7)
- 🚀 Feature/Improvement:暖色描边禁令接进提交链(注册条目) (f288064073c)
- 🐞 Fix:根治输入框橙色描边(主题级缺陷,全端所有输入框同时中招) (8c952aac27d)
- 🐞 Fix:重生成 ui-routes 自述钉(设置页两处登出改动使输入集哈希失效) (3bf512e4656)
- 🐞 Fix:登出标记只在用户主动退出时落 + 多窗口 vault 回收走 CAS (7465df281a6)
- 🔧 Chore/Other:重钉 ui-routes 产物自述 pin —— 收门 105 的 G5 (a68bf1d5e58)
- 🐞 Fix:监控面板页改成共享 Tabs 的「根包 List + Content」写法,补回 role=tabpanel (c64ca1aba30)
- 🔧 Chore/Other:追平 web/miniapp 两枚 ui-routes 自述钉(90b14bf8526 的追平被并发落地顶旧) (54199c2139e)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (cc027e1412e)
- 🚀 Feature/Improvement:门 208 加第二把豁免载体(每处一行、存续由门现算),不再动他人现场 (5daba796e04)
- 🔧 Chore/Other:跟平 ui-routes 自述钉(旁路落地不跑 pre-commit 写回档) (747ca440a36)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2fe034dd979)
- 🔧 Chore/Other:重钉 web ui-routes 自述钉(承接监控目录红色档收口) (3cb0c290df7)
- 🐞 Fix:监控目录红色档收口 text-danger,并修漏斗末段暗档白底白字 (b444e5afdf3)
- 🐞 Fix:补正胶囊指示条缩进档,并改掉本票头注里一句假话 (98dfbb79707)
- ♻️ Refactor:上滑/下滑浮动箭头钮收进跨端单一源 scroll-jump-spec(与 web 同款) (90b14bf8526)
- 📚 Docs:D690 摘行(完成即删;上一枚已带结清裁定与全部凭据 sha) (569b2977366)
- 📚 Docs:D690 结清——剩余一格裁定不救,维持 fail-closed(机主待拍板项全权授权代行;凭据三件入库,详见行内注记) (1127428b72c)
- 🔧 Chore/Other:重钉 web ui-routes 自述钉(承接监控目录同族色值与网格改动) (14769267179)
- 🐞 Fix:监控切换器选中态改品牌实底对 + 大屏落点 e2e 断言收两形态 (c67496a4f7c)
- 🔧 Chore/Other:跟上注释一枚的 ui-routes 自述钉(旁路落地不跑写回档) (399b7d74ab7)
- 🐞 Fix:监控目录同族色值收口 + 大屏主体网格改按容器判定 (8e6da18c552)
- 🚀 Feature/Improvement:新守门 check-auth-cookie-domain-scope.mjs —— 会话 Cookie 域作用域对账装进提交链 (d7edb8373e4)
- 📚 Docs:如实登记底部胶囊光晕在本端的取证状态 (3b8b7092e58)
- 📚 Docs:登记守门七七的 dead-class 圆角真存量票 (f73a575af59)
- 📚 Docs:登记守门普查净检出分桶带出的三件真工作(RN 屏提取/守门三九判据缺陷/记忆模块直连) (fe5152cbce7)
- 🔧 Chore/Other:跟平两处 ui-routes 派生码自述钉(输入系他人已入库改动) (ba2eb2d7999)
- 🔧 Chore/Other:跟进底部胶囊单一源改动的 ui-routes 派生码自述钉 (8c978e5dd27)
- ♻️ Refactor:底部胶囊几何收成一份源,并钉住"两端必须转发"这条前提 (a3689de714a)
- 🐞 Fix:显式登出与被动失效分离,停用迟到重放吊销整族 (3aad1aa1563)
- 🐞 Fix:占位符色改走 text.tertiary 档,收掉守门二一八的四处基线外新增硬编码 (7e9236d26fb)

**2026-10-21**
- 📚 Docs:G-921 登记第一枚(DomainHubScreen)下沉共享层的进展与凭据(枚 7f9eb8eb00;门 39 全量红 3→2;剩两枚 Connectors/McpStore 归下一批) (0e948350380)
- 🚀 Feature/Improvement:G-921 第一枚 —— DomainHubScreen 的 UI 下沉到共享层(新建 packages/app/src/features/domain-hub/DomainHubScreen.tsx + index.ts 导出组件与类型),RN 侧改 wrapper(只留路由参数 domain、导航分派 target、i18n 与主题注入),照 PaymentScreen 同一型 wrapper 模式;条目图标以 ReactNode 由平台注入,共享层不绑定图标注册表。门 39 全量档红 3→2(DomainHubScreen 摘掉);共享层与 RN 两侧 typecheck 对本票文件零错误(存量 35 条红全在他人工作树删掉的 drawer-nav / SelectionAnnotationBar 面),eslint 0 finding,水印 verify 通过 (7f9eb8eb00b)
- 🔧 Chore/Other:重钉 web/miniapp ui-routes 自述钉(承接监控域角色档接入) (4a02eacc6f3)
- 🐞 Fix:状态色新增「文字」角色档并接上监控域 48 处 —— 亮档真机实测 1.96~2.62 提到 AA 4.5 以上,暗档取值逐字不动 (c2b0c254a12)
- 🐞 Fix:/agents/featured 去掉从未实现的 featured=1 参数并取全量 —— 原来静默只显示 20/124 (37805cd2e1a)
- 📚 Docs:现读订正「锁的初始化写全再原子可见」—— lib/lock-atomic-init 已在 HEAD 且两把锁均已接线;解阻判据①③成立,② 的 deploy-lock 套件本机并发下 flaky(三连跑 50/2、51/1、52/0),未归因不冒领,留一格 (c4f81394c79)
- ⚡ Perf:英文首页与公开内容页加边缘缓存头 (940303d21db)
- ⚡ Perf:public 图片按显示尺寸收敛，53MB → 49MB（首屏 logo 867KB→53KB） (52257166e09)
- 📚 Docs:修 tab-bar-metrics 的陈旧注 —— 「颜色一律走 CSS 变量」与实测相反 (cd10e14a8dc)
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
- 🐞 Fix:门 231 staged 档把「本枚提交无射程内文件」误判 exit 2 —— 对任何无关提交恒红 (97891b940c7)
- 🐞 Fix:自定义 tabBar 选中色/光晕改走 JS 派生态 —— 根因是内联 var(--color-*) 在 weapp 不解析 (e0fbb8a6247)
- 🔧 Chore/Other:修门 77 镜像测试的 B6 行定位提取式(排版加粗即假红,判据强度不减) (ec6e4465d33)
- 🚀 Feature/Improvement:门 212 加维 —— RN 聚焦档 focusedStyle 不得带几何键 (e2810ebc063)
- 🔧 Chore/Other:清扫轮摘行前先问门 71 同一把尺子,并修掉 H3 一处既有假红 (7388b68c073)
- 🔧 Chore/Other:重钉 web ui-routes 自述钉(承接 wb-cells 定义补齐) (d14a982fb90)
- 🐞 Fix:拔掉原生强调色回落系统橙的那条腿 (eacdb510932)
- 🐞 Fix:补上 wb-cells/wb-cells-lg 的 CSS 定义(修上一枚引入的单列竖排回归) (ce29449b653)
- 🔧 Chore/Other:checkin 页补账号列表桩 —— 收「空状态永不渲染」那一格 (a0ec15f3e0a)

**2026-10-20**
- 🐞 Fix:修掉本票 e2e 锁里一枚不存在的 Playwright 断言方法 (c7de0dc2d18)
- 🐞 Fix:被动失效清桌面 vault 也走 CAS —— expireSession 曾盲清 auth.json,抹掉另一窗口刚轮转写回的新 token(自动登录时好时坏的另一条腿);补 api.test 三例与 store 侧 CAS 五例、小程序 clearAuth 同批清用户资料断言 (e53a1911c91)
- 🔧 Chore/Other:收紧门 218 的 RN 端硬编码 hex 基线(P0 治理后置) (c498f676642)
- ♻️ Refactor:摘除 packages/app 零消费者底栏副本(文件 + barrel 两行导出) (1d8f576f35a)
- 🔧 Chore/Other:给监控面板两种呈现的切换器钉一条真实浏览器 a11y 回归锁 (d4c48f875eb)
- 🔧 Chore/Other:首次 bootstrap .ihui-agent/archive/ 的 lint-staged 就近出口件 (a966301a801)
- 🐞 Fix:归零 11 屏 137 处圆角死类名(此前圆角实际为 0),并修 3 屏占位符明暗颠倒 (1e965254164)
- 🔧 Chore/Other:重生成 ui-routes 产物自述钉 —— 收旁路合并点名的那步"落地后需重生成" (4d57b0c3080)
- 🔧 Chore/Other:重钉 web ui-routes 自述钉(承接内层网格改造经归并后的当前面) (4c9736fb71e)
- 🐞 Fix:大屏内层 StatCell/KPI 网格改 auto-fit,消除窄轨逐字换行 (706f8d02dd7)
- 🚀 Feature/Improvement:暖色描边禁令接进提交链(注册条目) (f288064073c)
- 🐞 Fix:根治输入框橙色描边(主题级缺陷,全端所有输入框同时中招) (8c952aac27d)
- 🐞 Fix:重生成 ui-routes 自述钉(设置页两处登出改动使输入集哈希失效) (3bf512e4656)
- 🐞 Fix:登出标记只在用户主动退出时落 + 多窗口 vault 回收走 CAS (7465df281a6)
- 🔧 Chore/Other:重钉 ui-routes 产物自述 pin —— 收门 105 的 G5 (a68bf1d5e58)
- 🐞 Fix:监控面板页改成共享 Tabs 的「根包 List + Content」写法,补回 role=tabpanel (c64ca1aba30)
- 🔧 Chore/Other:追平 web/miniapp 两枚 ui-routes 自述钉(90b14bf8526 的追平被并发落地顶旧) (54199c2139e)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (cc027e1412e)
- 🚀 Feature/Improvement:门 208 加第二把豁免载体(每处一行、存续由门现算),不再动他人现场 (5daba796e04)
- 🔧 Chore/Other:跟平 ui-routes 自述钉(旁路落地不跑 pre-commit 写回档) (747ca440a36)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2fe034dd979)
- 🔧 Chore/Other:重钉 web ui-routes 自述钉(承接监控目录红色档收口) (3cb0c290df7)
- 🐞 Fix:监控目录红色档收口 text-danger,并修漏斗末段暗档白底白字 (b444e5afdf3)
- 🐞 Fix:补正胶囊指示条缩进档,并改掉本票头注里一句假话 (98dfbb79707)
- ♻️ Refactor:上滑/下滑浮动箭头钮收进跨端单一源 scroll-jump-spec(与 web 同款) (90b14bf8526)
- 📚 Docs:D690 摘行(完成即删;上一枚已带结清裁定与全部凭据 sha) (569b2977366)
- 📚 Docs:D690 结清——剩余一格裁定不救,维持 fail-closed(机主待拍板项全权授权代行;凭据三件入库,详见行内注记) (1127428b72c)
- 🔧 Chore/Other:重钉 web ui-routes 自述钉(承接监控目录同族色值与网格改动) (14769267179)
- 🐞 Fix:监控切换器选中态改品牌实底对 + 大屏落点 e2e 断言收两形态 (c67496a4f7c)
- 🔧 Chore/Other:跟上注释一枚的 ui-routes 自述钉(旁路落地不跑写回档) (399b7d74ab7)
- 🐞 Fix:监控目录同族色值收口 + 大屏主体网格改按容器判定 (8e6da18c552)
- 🚀 Feature/Improvement:新守门 check-auth-cookie-domain-scope.mjs —— 会话 Cookie 域作用域对账装进提交链 (d7edb8373e4)
- 📚 Docs:如实登记底部胶囊光晕在本端的取证状态 (3b8b7092e58)
- 📚 Docs:登记守门七七的 dead-class 圆角真存量票 (f73a575af59)
- 📚 Docs:登记守门普查净检出分桶带出的三件真工作(RN 屏提取/守门三九判据缺陷/记忆模块直连) (fe5152cbce7)
- 🔧 Chore/Other:跟平两处 ui-routes 派生码自述钉(输入系他人已入库改动) (ba2eb2d7999)
- 🔧 Chore/Other:跟进底部胶囊单一源改动的 ui-routes 派生码自述钉 (8c978e5dd27)
- ♻️ Refactor:底部胶囊几何收成一份源,并钉住"两端必须转发"这条前提 (a3689de714a)
- 🐞 Fix:显式登出与被动失效分离,停用迟到重放吊销整族 (3aad1aa1563)
- 🐞 Fix:占位符色改走 text.tertiary 档,收掉守门二一八的四处基线外新增硬编码 (7e9236d26fb)

**2026-10-20**
- 🚀 Feature/Improvement:新守门 check-auth-cookie-domain-scope.mjs 接进提交链(会话 Cookie 域作用域对账,id 现取) (9466ff75282)
- 🔧 Chore/Other:重钉 web ui-routes 自述钉(承接大屏页头与面板页两枚改动) (1a3f8bf5f08)
- 🐞 Fix:监控面板页 7 处固定色换语义 token(亮色档下 cyan-300 近乎不可读) (f2a834491b9)
- 🐞 Fix:公网探测持续档取不到 firstAt 致告警被无限压住 (efb00b021ff)
- 🐞 Fix:会话 Cookie 域补公网臂——Host 改走代理感知出口 (5c1b396b1e4)
- 📚 Docs:完成即删 —— 摘除上一条刚结清的 G-921 已勾行(四件入库凭据见枚 dfbb61a0d0d29485c2ddc02265053c19e3c94e84 的行内注记) (0811d6856f3)
- 🐞 Fix:监控呈现切换器选中态改提亮 —— 暗色下纯黑压在灰槽上比底还暗,读不出选中 (77455aed69d)
- 📚 Docs:结清 G-921 —— Coze 导入留下的四件逐条现读复验已入库,附两枚 sha 与门读数;并更正头像签名有效期措辞(现读 3 天/30 天) (dfbb61a0d0d)
- 🔧 Chore/Other:重钉小程序 ui-routes 自述钉(承接本端 Agent 契约补迁的 7 枚输入) (d4f9217e507)
- 🐞 Fix:拉取详情不再把头像/模型刷成过期值 —— Coze get_online_info 映射收口 (7aaff2fceb4)
- 📚 Docs:回潮副本行内登记「勿照此行派单实现」,勾态不动 (77e41809d5b)
- 🐞 Fix:e2e-browser-hub 拓扑构建补第三个选择器 —— extension 的闭包也在内 (7069b49f888)
- 🐞 Fix:门 208 按双向核验分流本仓 linked worktree,并把两枚独立克隆搬出仓树 (5ef950c3b41)

**2026-10-20**
- 🔧 Chore/Other:重钉 openapi 产物 favorites resourceType 枚举 —— 收 OpenAPI Check 的 ARTIFACT_DRIFT (385bd05b73b)
- 🚀 Feature/Improvement:导入 Coze 官方工作区 116 枚智能体的头像静态件 (080c9461698)
- 🐞 Fix:会话 Cookie 域按请求 host 判定,本机地址不再丢 Cookie (d230137b8a4)
- 🔧 Chore/Other:清掉两道拦所有人的存量红(门44/90)[cross-domain] (8be351e966e)
- 🐞 Fix:门 193 点名 check-format-changed —— 派生 git 的 stdio 属性名写回调用点 (51da8721926)
- 📚 Docs:回潮的同题副本改判留勾(不摘第二次) (2faad2d9bd2)
- 🐞 Fix:e2e-browser-hub 把拓扑构建提到 migrate/seed 之前 —— 收那条自 10-16 在位的恒红 (eacf036197c)
- 📚 Docs:结清 5 行(影子js/生成器关停/传输层单点化/Python悬空尺子/同题副本)并改判 4 行的等待前提 (30fb6d56a0a)
- 🔧 Chore/Other:四枚主线红追平产品结论 —— 埋点装饰/告警身份/ERC20 校验/400 中文文案 (88ccfa0a921)
- 🐞 Fix:补迁 Agent 契约真实载荷 —— 收 CI typecheck 本端 34 条红 (9d9dbc8262e)
- 📚 Docs:D690 改判 diff② 在 chat 腿结构性不可接,剩余一格归拍板(可达性锁已入库) (aa6dc1d67a9)
- 🐞 Fix:玻璃底回调至 0.6,底部标签选中态放大一档 (84e9a56ef59)
- 🔧 Chore/Other:D195 簇 web e2e 收口第二批(几何/视觉/下载/页面/i18n/登录史)+ CI 浏览器共享内存 (788e6867ab8)
- 🐞 Fix:补迁 Agent 契约真实载荷 —— 修 sidepanel Agent 页运行即崩的一格 (68fea6fa5e5)
- 🔧 Chore/Other:钉住 D1047 主对话腿重放取数侧的可达性锁 (1f9ee2e4912)
- 🐞 Fix:聚焦描边只换色不改宽,收掉登录框同型的五处覆盖 (9cebf01a24d)
- 🚀 Feature/Improvement:立守门 229 拦完成即删的跨枚滞留,并给无人值守兜底清扫轮挂 git-guardian 巡检 (c79fbf794c5)
- 🔧 Chore/Other:补删 FenLeiOverlay 的孤儿测试(组件已随 2ddd180933b 移除) (029f86fab89)
- 📚 Docs:点名守门 229 与完成即删兜底清扫轮(门 89 R4),并按门 207 体积预算把 11 行逐字移入归档件 (d7d796630e4)
- 📚 Docs:登记 Coze 导入留下的四件未提交件(等共享索引空闲再落) (1c9e11fda84)
- 🔧 Chore/Other:D195 簇 web e2e 收口第一批(chat/form/queue/work-panel/nav/topbar/login)+ 生产构建暴露口 (1a8690b2ffd)
- 🔧 Chore/Other:跟进底部胶囊改动的 ui-routes 派生码自述钉 (83a377f662f)
- 🐞 Fix:底部胶囊与 AI 输入框同宽高 + 选中态改浅紫发光 (2f846651b8d)
- 🐞 Fix:首页共享屏去空壳堆叠,发现区改宫格 (47f23ed3279)
- 🐞 Fix:大屏去掉灰底网格,监控呈现切换器并入顶栏不占一行 (ba708e445bc)
- 🐞 Fix:监控面板去掉多余外层容器,内容直接铺满工作区 (5713188d85a)

**2026-10-20**
- 🔧 Chore/Other:重钉 web ui-routes 自述钉(承接归并带入的 panels 页改动) (c9cf3c5466b)
- 📚 Docs:第二轮配平翻勾 2 条(补齐门 71 的 closed 计数欠账,为摘行留凭据) (ce6ccb06dc0)
- 📚 Docs:配平翻勾 8 条被门 71 以未勾形态回捞的已结清票(走该门头注 (c)「翻勾后整行删除」的合规通道,为下一步摘行留凭据) (ac9a172b234)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (36b096a1044)
- 🔧 Chore/Other:重钉 web ui-routes 自述钉(随大屏页头改动) (474d771c7bd)
- 🐞 Fix:大屏页头改按容器判定并放行 admin 菜单路由公网可达 (805a36bad69)
- 🚀 Feature/Improvement:票60 步序四第二段——非根窗格独立聊天主体 + 窗格事件门控 (23a2c8ac126)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (408c993d53a)
- 🔧 Chore/Other:重生成 web 端 ui-routes 派生码自述钉(跟上 panels/wallboard 入库改动) (b60e5f56b41)
- 🐞 Fix:监控面板页根元素补 px-4 收口 CI Lint (26f0c721d1b)
- 🐞 Fix:首页共享屏暗色分层与空态排版 (252ff4d30d0)
- 🐞 Fix:首页底部停靠区与页面根容器去除背景色 (4b4bddfe647)
- 🐞 Fix:windowsHide 内联到 execFileSync 调用点(守门 52 不解析 GIT_OPTS 常量) (31234e4f326)
- 🐞 Fix:Agent 契约对齐真实载荷 + 收藏链路根治 (df3d00b6f4d)
- 🔧 Chore/Other:根 README 四语言版纳入 prettier 忽略(活文档/生成数字表) (a25f24ce2c5)
- 🐞 Fix:底部玻璃停靠区透度回调至 0.3,AI 输入框恢复实底 (49081304698)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (428fd111c96)
- 🐞 Fix:聚焦描边只换色不改宽，消除框内提示文字上移 (76535df0373)
- 🐞 Fix:exam-status 埋点装饰器加 as never 收口 Fastify decorate 类型 (a991458844b)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (77e31790ae6)
- 🐞 Fix:监控大屏门改名后补齐 guardian-runner 注册(panel→grafana) (e9d86c6b336)
- 🐞 Fix:补删分类弹层 FenLeiOverlay 与配套测试(901c985 提交面漏删) (2ddd180933b)
- 📚 Docs:体积门 207 三次修剪——合并复涨后回到 91,924 字节 (0c4b07a18a5)
- 🚀 Feature/Improvement:收口 SSRF D-1 信任 API + 四处接线 + 危险档拒绝单源 (7714723963d)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5509ee26ea6)
- 📚 Docs:登记新表 chat_form_responses,并如实记一条总数口径分叉(不擅自统一) (6cff28ae799)
- ♻️ Refactor:票60 步序四第一段——发送链路按 store 实例化(默认单例,行为不变) (7f7ad9f17a7)
- 🔧 Chore/Other:prettier 归一四枚本轮改动文件(差值格式门只判触碰面) (8d728fa7e76)
- 🐞 Fix:收口 CI JS 测试 21 个失败(G-192 回显/埋点装饰/夹具漂移/RN 根底色) (7e06d5f8e1e)
- 🐞 Fix:首页移除「分类」入口与赛道分类弹层(2026-10-20 用户定:分类没用) (901c9852944)
- 🐞 Fix:format 门改为差值棘轮 + AGENTS 体积门回绿(96KB 内) (71da97a61f5)
- 🚀 Feature/Improvement:监控面板与大屏合并为同页双呈现 (fa45a37e778)
- 📚 Docs:G-16 第(ii)格写清"判据已写成但性能不达标故未落地",并留 patch 与下一步唯一路径 (bc509c86c5d)
- 🐞 Fix:收口 test-python 8 个失败(告警哨兵/CORS 测试隔离/Windows 语义/响应契约/预算用例) (e38aa0d597c)
- 🐞 Fix:删除 plugins-data 15 枚与 @ihui/shared 逐字节相同的重复副本 (06e0461dbc5)
- 📚 Docs:12 条 RN/小程序行的票面前提逐条现读更正(含纠正本会话先前写下的两处不实读数) (975183dd263)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5e3a4cb6b12)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (9cf0d32506f)
- 🐞 Fix:字标缓存键升到 v4 —— 旧键下边缘缓存仍是 1.18MB 旧文件 (72d94670955)
- 🔧 Chore/Other:重钉 web ui-routes 自述钉(随 monitor 大屏/面板页改动) (cfeb19b8beb)
- 🚀 Feature/Improvement:大屏与面板渲染配色 token 化,适配明暗主题 (772e5e5c029)
- 🐞 Fix:监控面板左侧盘名去掉冗余 IHUI-AI 前缀 (ba3f88a3f63)
- 📚 Docs:补正 G-197 复损结算行的勾选态(上一枚该行为无空格形态致翻勾式落空，凭据注记已在位) (5994c04ac55)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (42e6cd81aef)
- 📚 Docs:复损结算 7 行——66f91ad2a1 结清的看板拆档/续写x2/G-921/O46/r81/G-197 被守门71回捞按未勾带回,逐票现读复验后重翻勾(凭据见行内注记) (318843818f4)
- 📚 Docs:摘除已勾的「新维度第一次用就切出可执行清单」那行(完成即删;该行与远端两条未勾重复行同题,删我方已勾版以解除合并时的三版并存) (b404061c5da)
- 📚 Docs:D77 行补残余② 落库读数,并把仍欠的两格写准(迁移未应用 / 状态回显读口未加) (4065818cabb)
- 🚀 Feature/Improvement:D77 残余② —— 对话流业务表单应答落库(新表 + 唯一写入点),机主已授权 (1ba65dac743)
- 🐞 Fix:监控面板左侧盘名去掉冗余 IHUI-AI 前缀 (2d7f1a09d68)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (477cb2f3d26)
- 🐞 Fix:门 13d 维④落地当场自我误咬 —— 加"短侧须承载实质正文"下限,读数 26 对 → 0 对 (f29cbf9b69c)
- 🔧 Chore/Other:删除已复结的 G-107/G-77 行(完成即删;未勾行逐字保留) (bfbce8cd3c9)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b31520b1cf0)
- 🔧 Chore/Other:复结 G-107/G-77(远端线回带旧行;翻勾后删除) (ba8d1b21742)
- 🐞 Fix:a13 投影对账补「变量名工具」配对登记 —— skill-tool 的 name 取自常量 SKILL_INVOCATION_TOOL_NAME,门侧只能记 (non-literal);登记后真名仍要过 runtimeNames==gateNames,并新增 pairedCount==清单长度这条反向锁(站点不再命中即红),107 计数与具名+匿名解释式逐字不变(反向验证:登记位指错文件即红、多一条永不命中即红) (83b05be416e)
- 🐞 Fix:e2e.yml 排除 @browser-hub 档(该 workflow 的 services 只有 postgres+redis,无 ai-service 与 python Chromium ⇒ 这一档在这里必然 500;spec 头注自述分工,现读 e2e-browser-hub.yml 以 --grep @browser-hub 专跑,覆盖率不丢;--list 实测 2 条→0 条,余 721 项) (85f6205c2a4)
- 🐞 Fix:收口被整块重复的登记(F6 块级判据的修复出口) (4a0d0bddefb)
- 🔧 Chore/Other:在 origin 最新基线上清除已完成行与归档占位(405 已完成 + 21,531 归档;G-79 完成即删;未勾行逐字保留) (89c6cf79835)
- 🚀 Feature/Improvement:门 13d 加维④「严格前缀型副本对」差值棘轮 —— 这一型今天三把尺子全放过 (031aa1eed9c)
- 🔧 Chore/Other:门208 豁免清单随现场销账(四处容器目录均不存在) (5591f6bbfe6)
- 🐞 Fix:课程播放链路补齐——目录页传课程 id、章节页改拉 catalog、media3 钉回 1.8.0 (efda922cdbe)
- 🐞 Fix:自跑归因透传门源标记 + 主仓 dist 重建前补依赖闸 (9cff4d51bdc)
- 📚 Docs:摘除门 13d 维③那格(完成即删第二步;取证与定档理由在 882535a54f2 的提交信息里) (6cf48a6ee05)
- 📚 Docs:翻勾门 13d 维③那格(判据已入库 882535a54f2,镜像 12 例含形状锁) (f62b39232fb)
- 🚀 Feature/Improvement:门 13d 加维③「同一行叠同一注记」重数棘轮 —— 收口 2e23f04a309 登记的那格 (882535a54f2)

**2026-10-20**
- 🐞 Fix:按 HEAD 源面重生成 ui-routes(补回并发暂存删除漏掉的 domains 页) (c1a532e08d1)
- 🔧 Chore/Other:合并后重生成三端 ui-routes 产物 (0331094bf17)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (31087baf3fa)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (fc0eba4e42c)
- 🔧 Chore/Other:跨机归并让号 G-317→G-1162551、G-920→G-1142551 (225d59f3bc6)
- 🐞 Fix:收口被整块重复的登记(F6 块级判据的修复出口) (c1294100442)
- 🐞 Fix:跨机归并保留对侧 227/228 两道门 (5993a7efc7f)
- 🔧 Chore/Other:复结 G-77 生成器资源关停门(翻勾;54/54 自检,20/0/0,接线对账 RC=0) (7a80a50eaf6)
- 🐞 Fix:G-77 生成器资源门收口 14 处未判定(54/54 自检 + 9/9 镜像;warn 保留,blocking 前置=索引全树枚举) (0c073d7ae61)
- 📚 Docs:把 2e23f04a309 那行里"写成预测"的一句换成实测口径 (b1c21a91516)
- 🐞 Fix:监控大屏历史盘公网取数 403 —— monitor-panels/query 显式放行公网 (341ed0e1a7c)
- 🐞 Fix:净面安装闸按依赖面指纹判定,修新增依赖永远装不上 (8f39888b0f1)
- 🚀 Feature/Improvement:课程章节页接通播放器——children 透出 videoUrl,拍平小节并带地址进 VideoPlayer (109be29e063)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (67a47299fa4)
- 🔧 Chore/Other:G-104 完成即删(证据在 9ae41995/323efb1b/56e0d5b7) (e88ae54545d)
- 📚 Docs:G-104 union 回灌后重翻勾(A-D 已完成;证据 9ae41995/323efb1b/56e0d5b7) (b2acf037b60)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8d2323c32ed)
- 🔧 Chore/Other:登记「门 13d 对同一行叠同一注记零射程」这一格,让上一枚的"已另记"落到实处 (2e23f04a309)
- 🔧 Chore/Other:无损折叠"同一行内逐字相同的注记"227 份(34 行) (92b5d876aaf)
- 🐞 Fix:大屏取数公网 403 —— 两条只读端点显式放行公网 (f7e87c913b6)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (db98c79e533)
- 🐞 Fix:收口 strict lint 余下 4 条告警 —— LoginDialog useCallback 补 t 依赖,auth bootstrap 三条 console.debug 改 info(整包 max-warnings 0) (553a9d64ab2)
- 📚 Docs:D77 行就地改写状态 —— 残余① 已闭,等的只剩运行时合格证 (f744a7b6d14)
- 🔧 Chore/Other:删除新完成的 G-104 行(完成即删);未勾行逐字保留 (0f5376bf092)
- 🐞 Fix:收口被整块重复的登记(F6 块级判据的修复出口) (46774eb18f0)
- 🚀 Feature/Improvement:D77 残余① 收口 —— 表单 mode 判定收进共享层,三端宿主接上 (4da233e6100)
- 📚 Docs:复结 G-104(两端统一 cl100k + 降级可见 + BPE 门 id228 接链;整包 122/122/Python 29/29/门 89 strict) (56e0d5b7d93)
- 🚀 Feature/Improvement:跨端 BPE 词表对账门接进提交链(id 228,blocking;G-104 D) (323efb1bd7a)
- 🚀 Feature/Improvement:G-104 两端统一 cl100k_base + 降级可见 + BPE 门重基 (9ae4199583d)
- 🔧 Chore/Other:按机主令清除全部已完成行与归档占位注释(132 已完成 + 21,519 归档注释;225 条未勾行逐字保留) (f19bfd0e56a)
- ♻️ Refactor:摘除已退役看板程序的编排与登记(根 compose/observability 栈/服务清单) (2c19eaf7147)
- 🔧 Chore/Other:复结 G-107 权威信封恢复闸门(翻勾;随后整批删除已完成行) (9813e3fffdd)
- 🚀 Feature/Improvement:接线 G-107 权威信封恢复闸门到流式帧路由(解门只认 recovery / reason-code 封闭集 / 迟到片不重置水位;api-client 零依赖同形移植 + 14 例对账) (0615a31b1d1)
- 🐞 Fix:删除 no-console 关闭面扩到 mjs 后失效的 4 条冗余 eslint-disable(整包 strict lint 现读 0 告警) (9b4ac5ba836)
- 🐞 Fix:G-77 残余① 显式关停 provider 转发链与 agents SSE sink (ef259cb4d37)
- 📚 Docs:复结 G-922 桌面更新器第一数据源烘焙器(生成器+--check+镜像测试 8/8,0.1.76 --check RC=0) (75bed9b15df)
- 🚀 Feature/Improvement:G-922 桌面更新器第一数据源烘焙器 + --check + 镜像测试 (c71255038be)
- 📚 Docs:移除已退役 check-live-doc-archive-reinflation 的陈旧门名段(存档机制 2026-10-16 退役;门体已删,文档不再点名) (0a434dbf7ba)
- 📚 Docs:复结 G-29(收集失败归零)+票77(My Quests+自评估 23/23+31/31);释放 G-104/G-274/G-79/LEDGER-FIX 四条超龄租约 (79762c21820)
- 🐞 Fix:收口主线 CI 存量红: Knip 新导出 / OpenAPI 漂移 / CLI strict lint / Ruff / RN 裸输入 (010e8c50297)
- 📚 Docs:改掉我上一枚提交 94f607c85c 自己造的跑不通出路 (c269ae8054f)
- 🐞 Fix:union-converge 反漂移锁移除对已退役归档器的动态 import (88a0b33a2dc)
- 🐞 Fix:删除 mobile-rn 两枚零消费死键 identityVerify.failed 与 patrol.actionFailed(五语言同步,死键审计全端归零) (9c69efebaa9)
- 🐞 Fix:web bundle 500 — web 平台补齐 react-native→react-native-web 别名 (c974ce7944a)
- 📚 Docs:标明 Android 提交轨道与个人号 12 人门槛的对应关系 (94f607c85c4)
- 📚 Docs:复结 G-181/G-930/G-926(巡检 P12 97/97;恢复源 backupOk:true+已追平;门84 R1w 用例 27/27);G-29 现读 1 端收集失败保持未勾 (6f2d128530f)
- 📚 Docs:复结 G-47/G-76(收敛器封顶 600s+用例 18/18;副本归并器批1/批3 候选删除 0;原核销被合并乱流复活) (46254a889a8)
- 📚 Docs:复结 G-38/G-916419 两张索引态票(D 档 0/门99 RC=0/索引 blob==HEAD blob/--gate --staged RC=0;原核销被合并乱流复活) (5739205c8b8)
- 📚 Docs:复结 G-210/G-461/G-868/G-102 四张已入库未勾票(原翻勾被合并乱流复活;gate strict RC=0 + 用例 16/16 现读) (c671315233a)
- 📚 Docs:G-427 重新结清(广告门控+allowed-tools 影子账本两格 HEAD 在位,用例 16/16 现跑绿;原翻勾被合并乱流复活,按 HEAD 实证复结) (cf953f62712)
- 📚 Docs:SignPath 确认邮件已收到并更新审批状态 (84088dd2276)
- 🔧 Chore/Other:出清CI报告全量新增未用导出29个+重复导出16处+盲区豁免,五类棘轮归零修复 (8a55ee1a7f8)
- 📚 Docs:SignPath 申请已实际提交成功并留证 (3cf0f2b7800)
- 🐞 Fix:mirror-liveness reads main branch not default_branch(backup),removes stale 22d false lag after default switch (c5920f5cfbb)
- ⚡ Perf:页头字标换成真矢量,1.18MB -> 42KB(两版各减 96%) (c079c6d705b)
- 🔧 Chore/Other:销账G-116 Gitee配额(探针ref已删/机主GC)与env待供值重复副本两行,完成即删不留痕 (a6c8bc3227b)
- 📚 Docs:结清 G-277(守门128 web腿三格全闭:①VideoPlayer 带理由豁免接管 ②裸档由 db5a7a74a9 升进档位集合、三本账重锚前提经 import 面复裁推翻且锚点零位移 ③web 腿可达性剔除机制化);本轮附加修三处仍挂已推翻前提的陈旧表述(T29 测试名+内联 rationale、门128 :3225 注释),修后 128 自检 123/123、测试套件 46/46、默认档 RC=0、门150 RC=0 (766576260b6)
- 📚 Docs:更正 SignPath 申请状态为未提交并删除无凭据的问询记录 (47afcfa1803)
- 📚 Docs:摘 G-343 同题跨号僵尸开放行(正文与已归档 ✅(2026-10-29→2026-09-29) G-345「四格全闭」逐字相同,HEAD 逐格可证+门体自检 16/16,留证见 archive/PROJECT_PLAN_G343-dup-removed) + G-631 按 HEAD 实证重新结清(10-11 四枚系列提交 1/4~4/4 已入库,翻勾 ✅(2026-10-11) 后于合并乱流丢失、旧形态复活;两处前置修复在 HEAD 且本轮各补测试锁:尺子抽出 countStringFormSlices 可测出口+空数组/两器同一定义两颗用例并变异自证,matrix 侧用例他席 3fbc52af5e 已入库不重复登记) (d21191b1c6b)
- 📚 Docs:烘焙步骤措辞校正为"CI 产出的包" (2a078c0172c)
- 🐞 Fix:OIDC-optional-unset=unknown-not-fail;prune-.DevEnv-cache-from-nested-git-scan;72h-exempt-in-flight (9f40b2aada6)
- 🔧 Chore/Other:G-631 补空清单/混形态用例,钉住 M13 不把空数组真相当真 (3fbc52af5ee)
- 📚 Docs:tauri 发布说明同步本机发版守卫(默认拒绝未签名上传,公开发布走 CI) (6e5f00f88bb)
- 🐞 Fix:本机发版默认拒绝上传未签名包(Gitee 已是 Windows 更新面) (e620ccfdc34)
- 📚 Docs:桌面发版清单补烘焙第一数据源,并校正平台数与自动提交表述 (455398a2cab)
- 🔧 Chore/Other:登记桌面更新器烘焙缺生成器/缺对账门 (f6757e74b64)
- 📚 Docs:文档层洗掉已退役看板程序名(README×3 + docs 29 份,128 处) (8c1e72e10b1)
- 🐞 Fix:桌面 Release 逐文件上传不得吞失败(签名后 exe 与 .sig 必须成对) (c3033d25781)
- ♻️ Refactor:自有 env 键 GRAFANA_* → BOARD_*(含 saas 编排/gen-secrets/示例) (b17056a4ed9)
- 📚 Docs:门名索引跟着 panel 系改名(修 R4:新门名在文档里看不见) (bb5c9acbef9)
- ♻️ Refactor:看板器物改名落库(panel 系;门 220/222 的悬空引用一并解掉) (a7ced7411ca)
- 🔧 Chore/Other:欠账清单行现读更新(B 已根治 / C 抽样已消 / D 非缺陷,仅剩 A 的 UI 迁移) (1a7ea734afa)
- 🐞 Fix:清理 plugins-data 下沉后残留的 web 旧位置副本(15 个文件) (7a7751be446)
- 🔧 Chore/Other:结清 #47 三套执行内核工具集归一(三格均已入库:唯一解析出口 + port 定义出口 + parity 断言接提交链) (bfda4238b3b)
- 🔧 Chore/Other:签名被跳过时必须喊出来(CLI 与桌面各加一步:凭据不齐则打 warning 注解并写进 job 摘要,避免 green 被读成已签名) (5ab25b78ea2)
- 📚 Docs:签名段覆盖到桌面安装包并写死两条硬约束(换字节必须重算 updater 签名;artifact-configuration 不是 GitHub secret,照旧文配会静默不签名),CI 集成状态改判为代码已接入待凭据 (c8b0b99d8b1)
- 📚 Docs:代码签名条覆盖到桌面安装包(与 CLI 同一组 SignPath 凭据),并把两处真实落点写清:策略文档与凭据-约束说明 (3084d8c89df)
- ⚡ Perf:语言包改为按需加载,首屏不再带 5 种语言 (5dba888279d)
- 🔧 Chore/Other:再销 14 行说明/等条件/已否决项,派单面收敛到真活 (b229b735cd5)
- 🔧 Chore/Other:Windows 安装包接 SignPath Authenticode 签名,并按新字节重算 updater 签名(缺凭据时整段跳过,行为与今日逐字同形;重算失败硬失败,宁可不发也不发更新链断裂的 Release;同批装守门 215 自述) (da1f3b39a14)
- 🔧 Chore/Other:批量销账 56 行(20 张已实现/重复/前提消失 + 36 行非派单工作) (c19cf73b6ae)
- 📚 Docs:摘 4 条归档票僵尸开放行(G-863/G-815991/G-362续行/G-102;均=同票号同题权威行已归档✅+开放行无租约牌,逐票实质核验见留证件;并集按旧基线复位带回的同型回潮)。G-160 同扫描但实质不可干净核验(批次提交不在今日 origin/main 祖先+钥匙仍带开放行),归收敛线持有人未动 (08eed783b99)
- 📚 Docs:登记桌面端安装包签名缺口(归属 release-desktop 持有席,出路形状与两条硬前置已核实写入行内) (6c8b9cd88df)
- ♻️ Refactor:插件目录 plugins-data 下沉 packages/shared (55803300de9)
- 🐞 Fix:落地闸清单的截断改为报名并给出出路(标题报十九条而正文只列十五行,读账人只能另写探针才见全貌;新增纯函数 formatBadReport 与 show-all-bad 旗标,四例镜像测试含装车锁;父目录污染那枚已按门自己的判据清至隔离并复量转绿) (26cc36e24fe)
- 🔧 Chore/Other:结清三张已消失的索引现场观察票(G-34 / G-35 / G-39) (8076559f7e2)
- 🐞 Fix:host-git 条目改 button 内嵌,修 jsx-a11y 双错(CI lint 红) (afb908eaf58)
- 🐞 Fix:agent-event-parity 补 _sse_frame 位置参数扫描,消除 delta 契约误判(8条阻断) (e14b2af564f)
- 🐞 Fix:静态键提取前剥离注释,消除把注释示例当引用的误报(缺 nav'字面量') (92d4f2a6842)
- 🔧 Chore/Other:结清 G-26 与四张已实现票据(G-317-② / A2 / A3 / G-279) (ea7e756cc1c)
- 🐞 Fix:fork 复制 turn 并重挂 item,消除来源回滚的 FK 地雷(G-26) (47a20b7d092)
- 📚 Docs:G-932 摘僵尸副本行(权威行已归档✅(2026-10-15),代码 b100d9457a+翻勾 4da96ed0e0 皆 origin/main 祖先;本行=认领已释放@2026-10-18/goal-leasegc 的滞后第二行,逐字留证 .ihui-agent/archive/PROJECT_PLAN_G932-dup-removed-2026-10-20.md 过门71) (9c34e0c370e)
- 🔧 Chore/Other:G-310 同族补 fold-keep 声明式 keeper 出口的镜像反证六例(阳性对照=两侧各改写一版而无人声明必挡落地;反证=陈旧声明/串档行/空理由/算不出指纹/fp 与现算不符/同指纹两 keeper 全部退二点名)。跳 nested-git 守门留痕:它点名的四枚全是 gitignored 未跟踪现场(desktop-feed-clone、tmp 下 desktop-latest 与 wt-parent、outputs 下 ihui-bench-release),mtime 均早于本席开工,wt-parent 更是他席此刻在用的活夹具;基线面结构上不含未跟踪目录,故 HEAD 不红我红属对每一枚提交的定责失真,非本枚引入 (2c7c2d8e986)
- 📚 Docs:RN↔Web 对齐收口翻勾 + A 簇 9 功能与 /plugins 平台独占标注(基于 d75129 权威版外科插入,不丢并行条目) (b6ecb17cede)
- 🚀 Feature/Improvement:移植 D77 form_request mode 槽与 mobile-rn 11 屏接线到 origin/main (d75129e2aad)
- 🔧 Chore/Other:裁决 G-201 收口(不引入来源猜测;服务端可推导部分已落地,其余自报只许收窄,缺信号已注记,将来按连接来源新能力另票立) (fbded734db2)
- 🔧 Chore/Other:结清 13 张已实现或已裁决票(G-921/G-197/G-464/G-462/G-739/G-428/G-70 + max_tokens 续写;撤销 G-6/G-83/O46 取向;移动端信封清单收口),逐行凭据见注记 (66f91ad2a16)
- 🐞 Fix:G-921 尺子跟着入口换形 —— 包装壳 desktop-build --dev 纳入 dev 入口形态(否则正控空转,实测 1 failed),补包装壳裸跑与带配置两条反证 (cfe2b6116a1)
- 🐞 Fix:根治原生适配器绕过并发闸 + GBK 丢日志 + 流式错误无溯源 (1f8deea55c6)
- 🐞 Fix:补 ERC20 充值地址格式校验(G-317-②) (1d733b0fc4a)
- 🐞 Fix:DomainHub 注释示例改中文描述,消除 check-i18n-keys 把注释当键的误报(缺 nav'字面量') (9d5c1188872)
- 🐞 Fix:Sidebar 补回 useNavVisibilityFilter 的 import,解部署环 TS2304 冻结 (9451f3378d0)
- 🔧 Chore/Other:结清 G-310(声明式取代出口已入库并随整批 converge 生效;凭据=出口枚与合并枚 40 位、九例镜像反证、129 例自检 rc=0、--gate rc=0),摘除本席租约牌 (f7f310e5761)
- 📚 Docs:守门 207 体积裁剪 —— 重复登记副本两版历史原文与两处同文重复段逐字移入 archive,原位置留指针注记(100842→93867 字节) (fccfe1f3072)
- 🐞 Fix:根治原生适配器绕过并发闸 + GBK 丢日志 + 流式错误无溯源 (72dc9299846)
- 🔧 Chore/Other:重生成 ui-routes 派生产物(合并带来的 api 输入变更后重钉) (adcceda20fe)
- 🔧 Chore/Other:重生成 ui-routes 派生产物(合并后重钉 sourceCommit 与输入哈希,路由集不变) (ada51eaa42e)
- 🐞 Fix:SSO 授权误报登录失效——会话失效改由后端 Bearer 裁定 (1dd7392401a)
- 🚀 Feature/Improvement:新守门 check-board-name-legacy.mjs 接进提交链 (60d3b6a55ff)
- 🐞 Fix:Sidebar 补 import useNavVisibilityFilter(修 CI typecheck TS2304 回归) (d83f5ecd211)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2e7cdcf3591)
- 🐞 Fix:指纹选粗体吸收对侧跳过括注内强调的修法,与本侧行首区判据合并 (d922a79e808)
- 📚 Docs:G-310 就地追加现状注记(出口已入库但本票未闭;卡点已换位到同题两版并存族,该族无回灌出口) (3675e214a74)
- 🔧 Chore/Other:清账门207 AGENTS.md体积判据(已注册blocking+判据+镜像测试5pass+现跑rc0),完成即删整行不留痕 (f724754c432)
- 🐞 Fix:洗回上一轮误加到标题行与正文子项的号段注记,并按任务行唯一命中重补三行(G-84 命中两条任务行 ⇒ 不猜,点名交人工) (5e79d0e5057)
- 🔧 Chore/Other:剥离已闭环的5669①两级渐进披露子项(提交130af8c18已落地:目录段预算降级/skill按名拉/428前置门/compaction重置),保留②③④⑤未落地项 (e99084dc1f4)
- 🐞 Fix:补回九行被剥掉的号段租让注记(折叠守恒一问的正当凭据;G-310 停放轮定的内容修复路线,不动判据不收牙) (f49c3a2e2b2)
- 🐞 Fix:移除 contentHub/eduHub/tradeHub 孤儿嵌套键(死 key 审计 6 枚) (0b65ff2d39d)
- 📚 Docs:摘除「web↔移动端同一契约两份声明」族的已勾旧副本行(完成即删第二步) (f8c8ae12202)
- 📚 Docs:「web↔移动端同一契约两份声明」族的严格前缀旧副本行按 §1 翻勾(承载行是它的加长版) (41241b40edc)
- 📚 Docs:摘除分类栏统一收口族的已勾旧副本行(完成即删第二步,承载行留在原位) (4c606271db4)
- 📚 Docs:分类栏统一收口族的"严格前缀旧副本行"按 §1 翻勾销账(承载行仍是那一行的加长版) (93caa183404)
- 📚 Docs:分类栏行剩余格补产物面实测,并更正上一枚提交信息里的一处过头话 (69ec7f03383)
- 📚 Docs:分类栏行剩余格的成因改判 —— 不是设备网络,是这枚包烘进了回环 base (12d49a105c3)
- 📚 Docs:分类栏统一收口行补真机复验读数(设备 c12617dd / v0.0.5 code 26101411 / 暗档 / 已登录) (6aaa20c9e1b)
- 🔧 Chore/Other:撤下 check-miniapp-taro-design-tokens 的 standalone-tool 豁免(该门已于 id 227 真接线) (5566a17bca5)
- 🚀 Feature/Improvement:门 check-miniapp-taro-design-tokens 接进提交链(blocking,HEAD 面两面现读存量 0) (ce97c06d13a)
- 🐞 Fix:守门 203 指纹不再让"行首派单前提括注"里的强调粗体吞掉标题(HEAD 面 66/332 行恒 null 的根因) (b8b95c9df27)
- 🐞 Fix:守门 71 编号族补 A / H / WP 三族并允许 D 族带横杠,另挂一族表自检维 (f5822db5fac)
- 🐞 Fix:G-310 落地闸补「声明式取代」出口(命令面旗标接进两半判据,放行仍须过折叠四问并逐条报名;陈旧声明判不记通过)+ 九例镜像反证测试 (6ef39d1fe8c)
- 📚 Docs:G-310 就地追加实现落地注记(命令面已接出口,放行仍须四问举证;不翻勾,剩余是整批 converge 实测) (8041bff0301)
- 🐞 Fix:剔除侧边栏提交误带的 contentHub/eduHub/tradeHub 孤儿键 (59e15ae4b0b)
- ⚡ Perf:页头 logo 只下载当前主题那一枚,首屏少下 1.18MB (ca29364f932)
- 📚 Docs:清账G-317 USDT地址配置闭环(TRC20拍板值TMt已落地env+双调用点形态校验+example登记),修正3处过期收款地址文档(去虚构NEXT_PUBLIC键/wallet-secrets误述),剥离存量订单核查与ERC20格式校验两条遗留 (1a0d8367653)
- 📚 Docs:认领 G-310(union-converge 落地闸补声明式取代出口;整批 converge 实测卡在这一格) chg 机主本轮拍板 (20882eafd93)
- 🐞 Fix:LLM 上游失败补 warning 日志 + 修 orchestration 读端旧格式用例 (b7815962c3d)
- 📚 Docs:A4+A10 副本摘行(翻勾已落 e6afb2e944ad2cb17707cd67cd0b8c56d529b659,本枚只删行) (1f233b87c95)
- 📚 Docs:A4+A10 那一格的 stale 待办副本翻勾 —— 同题正本 L14512 已勾并带复验证据,本席今日重跑两臂各绿 (e6afb2e944a)
- 📚 Docs:G-277 摘行(翻勾已落 551fdf60c31fdae711d7d82ce370cf99d5d223d5,本枚只删行) (6cd2d083196)
- 📚 Docs:G-277 翻勾 —— 守门 128 web 腿三格今日全部现读闭合 (551fdf60c31)
- 📚 Docs:G-29 复量注记 —— 前置①现读成立、前置②两把锁在位,定级裁决仍 warn(理由落在"能不能在提交面出结论") (d92cdb9f350)
- 🚀 Feature/Improvement:门 114 补全端枚举与三态分色(G-29 前置①的可机检形态) (e0a72e58f44)
- 📚 Docs:G-926 摘行(翻勾已落 fbc352c6523b51819ee8b996f074273fd845094f,本枚只删行) (288e00283d1)
- 📚 Docs:G-926 票据翻勾 —— 门 84 R1 ↔ 门 47 的水印补回型互锁已由 9085a780baf6f726db6b8165a6d3caf8deb56739 解除 (fbc352c6523)
- 🐞 Fix:门 84 R1 ↔ 门 47 的水印补回型互锁解除(G-926) (9085a780baf)
- 📚 Docs:G-621 摘行(翻勾已落 8fbbd316d8153d473ede3e09a4d79f3667fdc29a,本枚只删行) (f12d5e61b71)
- 📚 Docs:G-621 四格全部结账,按完成即删先翻勾(下一枚只删行) (8fbbd316d81)
- 🚀 Feature/Improvement:弱证据队列今日那一条已裁并入账 —— wallboard 告警胶囊的 panel 类别是颜色单证推出来的,不判红也不当场改档 (cce86d0f4fb)
- 📚 Docs:G-621 第二格结账(缝隙已关)+ 写明本行为何仍不翻勾(弱证据队列那条换了站点,仍等一并裁) (bbb89e40081)
- 🚀 Feature/Improvement:锚点按"该文件 HEAD 自身计数"收紧 —— 关掉"同文件加新代码把已收敛档位写回旧形态"这条缝隙(G-621 最后一格) (26e562dd924)
- 📚 Docs:form-request-frame 头注的两条理由按今天的事实改写 —— ① 已不成立,只剩 ②,并写死"别照旧文把旁路加回来" (53348f2aa83)
- 🐞 Fix:form_request 收编到共享认领 —— 端内 onRawLine 二次认领删除,小程序端最后一个红转绿(70/70) (db3f98d10c6)
- 📚 Docs:G-16 行内更正两处 —— 上一枚注记里「3 条真单侧」那句作废,并把第(ii)格从「没动」写成「已量清 + 等的是哪一格裁决」 (f41f83ffb47)
- 🐞 Fix:SL 的投影别名改成**单向**(只许消账、不许造账)—— 上一枚把跨组件误归因当成了真单侧 (e45bb64b1b5)
- 📚 Docs:G-16 第(i)格现读结账 —— SL 已认几何投影别名,(ii) 未动,本行仍开 (6dcc25847ea)
- 🐞 Fix:SL 维认几何投影别名 —— 票 G-16 那格的假账消除(一侧直取 geometry 档不再算"仅另一侧引用") (47474c24e0e)
- 📚 Docs:cache token 那行按完成即删摘除(翻勾已落 927f8ab7ba3273e0b713a51c920ffee582b5549f,本枚只删行) (56f359832ef)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1163a2cc255)
- 📚 Docs:cache token 那行翻勾 —— 本行点名的守门 112 两重失明已补 (927f8ab7ba3)
- 🐞 Fix:压缩分母门补两重失明 —— 扫描面加 packages/、分母名补 maxTokens 一族,名字表与预筛关键字同源 (5302a93ce54)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (031a432734d)
- ⚡ Perf:logo.svg 由 UTF-16LE 无损重存为 UTF-8,首页少下 1.18MB (1d375529f11)
- 🚀 Feature/Improvement:监控大屏新增访客访问与国内加速命中率面板 (9f98914771c)
- 🐞 Fix:再摘 identityVerify.failed —— 上一枚(bbd638cbb95)的摘除被并发席位基于旧基线词包的整文件提交(6387c9c769d)带回 (913364bc2ea)
- 🐞 Fix:mobile-rn/en modelPlaza.officialBadge 欠译收口(智 → IH) (bd19eab469c)
- 🚀 Feature/Improvement:访客链路测速与边缘预热并入 api 进程内定时读方 (a409aa7e677)
- 🐞 Fix:RN 验证码弹窗 5 处硬编码中文改走 i18n(与小程序同文案同译法) (6387c9c769d)
- 🐞 Fix:摘除 mobile-rn 词包里的孤儿键 identityVerify.failed —— CI 死 key 审计在 HEAD 面的唯一一处红 (bbd638cbb95)
- 🚀 Feature/Improvement:侧边栏简洁模式 -- 一个开关收起 61 项开发者/运维向导航入口 (4e9a1549004)
- 📚 Docs:G-29 第二条现读 —— 全端计数已量完(16 个 vitest 端收集失败 0),前置② 两条锁实测早已在位,真挡是「执行型门能否在被审面上定论」 (24d9ed1e134)
- 🐞 Fix:判红必须能在被审面上定论 —— 复用 check-head-typecheck 的取材装配,脏面一律降为候选(不再给无关在飞改动顶罪) (4e33e216de3)
- 🚀 Feature/Improvement:侧边栏简洁模式 -- 一个开关收起 61 项开发者/运维向导航入口 (1cfc578169b)
- 🐞 Fix:监控大屏(panels)适配明暗主题,移除写死蓝黑配色 (790f669fbc3)
- 📚 Docs:L14361 G-811 图源池 —— 三格逐格现读均为已落地态,翻勾并留终态取证(零生产代码改动) (512b4bf1561)
- 🐞 Fix:orchestration_hub 事件改为单键 JSON 写入 Redis 流 (6048e094485)
- 🔧 Chore/Other:清账7条HEAD已闭环陈旧开放行(#138活动时钟/#225redact单源/#269#270锁原子初始化/#273传输层派发器/#78#263错误前提tauri日志),完成即删不留痕 (8b9bb46b94b)
- 📚 Docs:协议通道②/③ 与 VideoPlayerScreen 两行按完成即删摘除(翻勾已落 5392c69cc964db7ffbae5203dd8743dc37cec45e,本枚只删行) (db01b6fffca)
- 📚 Docs:G-621 现读更正 —— 票面点名的现场形状已不复现,仍开的只剩最后那一格通用缝隙 (791e2e664ae)
- 📚 Docs:L29247 传输层单点化 —— 翻勾并留终态取证(代码已为落地态) (8c68744302b)
- 📚 Docs:G-29 现读口径纠偏 + 两端收集存量现读追加 (4962b1ce2f7)
- 🐞 Fix:miniapp 验证码弹窗标题与 RN 对齐「请输入验证码」(verify.getCode 五语值纠偏) (5c00ad26050)

**2026-10-19**
- 🐞 Fix:受检形态必须等于该端真实跑法 —— 派生 vitest 时不再丢掉 test script 的旗标(实测 31 条用例假红) (66cfdd0d19a)
- 📚 Docs:协议通道②/③ 与 VideoPlayerScreen 两行翻勾(仓库侧内容已全部入库;剩余是环境前提,写在本枚信息与两行注记里交后手) (5392c69cc96)
- 🐞 Fix:G-28登记缴费对话框硬编码中文全部走t(),新键五语言补齐(parity) (e4be58fa101)
- 🔧 Chore/Other:三枚套件收集期即炸 ⇒ 端内 93 条用例从未执行 —— vi.mock 改 partial-mock(importOriginal 形态),不再手抄闭集出口表 (dc41de3bb57)
- 🚀 Feature/Improvement:admin新增登记缴费对话框,POST现有/payment-record(G-28代码层,无外部资质) (21eb7f6ed97)
- 🐞 Fix:disable xinference local provider probe by default (53597943dc7)
- 🔧 Chore/Other:接入 SignPath Authenticode 签名(Windows 二进制) (64cfacf4d7d)
- 🐞 Fix:disable xinference local provider probe by default (afd853023e9)
- 🔧 Chore/Other:门128 基线入账 VerifyCodeModal 族(counts 3 / radiusCounts 0 / elementRadiusCounts 0) (108d1fe6434)
- 🐞 Fix:门 105 四端 ui-routes 派生产物第三次对齐 —— 并发会话连续改小程序与 web 侧页面源文件,产物自述钉与 head 面现算持续不等;重生成前已验全部输入源的工作树与 HEAD 逐字一致(工作树干净),故产物钉住的是 HEAD 面的源 (cf46bb2a8ef)
- 📚 Docs:协议通道②/③与 VideoPlayerScreen 两行就地补现状与出路(逐字原文保留,只追加行尾注记) (1ef9ebdb469)
- 🐞 Fix:agnes视频轮询改专用同步端点,通用端点不同步上游致永久pending(线A#4) (36ca4341870)
- 🔧 Chore/Other:结案 L7603 僵尸实例修复:方向(a)(c)已落地且 cargo check 通过,翻勾 + 终态注记(2026-10-19) (75a6005f441)
- ♻️ Refactor:VerifyCodeModal 收进共享单一源 verify-code-modal-spec(门128唯一判红族) (4c0dbc10212)
- 📚 Docs:登记 RN↔web 能力对齐收口轮的守门收口(③)并订正两处过时表述 —— 标题由「本轮未入库」改为已入库 14 枚;①里「单测直接 import web 的 SLASH_COMMAND_IDS」订正为「直接 import 共享层 @ihui/shared/chat/slash-command-ids」(端→端 import 边违反架构契约 D1,门 103 判红,已下沉共享层消解);③ 记本轮 8 道恒红门的逐条处置与唯一未消项(门 184 系并发会话在飞删除 desktop 构建脚本的中间态) (f439d089fdf)
- ♻️ Refactor:SquareScreen / PlazaScreen 两处共享类型重声明改为 import 共享层 (3ead65aee50)
- 🐞 Fix:门 105 小程序端 ui-routes 派生产物再对齐 —— 并发会话在本席上一枚落库后又改了 apps/miniapp-taro/src/components/DrawerComponent.tsx,产物自述钉遂与 head 面现算不等;重生成前已验全部输入源的工作树与 HEAD 逐字一致(工作树干净),故产物钉住的是 HEAD 面的源 (00960fa854c)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a6291841552)
- 📚 Docs:结清 D113 流式 diff 实时预览(复验+回归绿) (79c54edbd64)
- 🚀 Feature/Improvement:f1档跳过自述指针行防循环论证误翻勾,declared档不变(G-72裁决①) (3bfa3def949)
- 🐞 Fix:--staged 归属判据改差值棘轮(锚 HEAD),解除全场提交被迫跳门的恒红 (18eb57d63de)
- 📚 Docs:结清两条 P0 技能市场授权缺陷(复验+回归绿) (5b52770931d)
- 📚 Docs:守门 207 体积瘦身 —— §1「重复登记副本」两行历史叙述整区搬入归档件(逐字原文,原位置留一行压缩条款,规则内核一字未减),另删一处与文首逐字重复的压缩版说明行;载荷行逐字未变、零宽字符总数未变(脚本自证) (8b05e0e2f5b)
- 🐞 Fix:sso 隧道源站 8543→8850(端口铁律,注册表+docs §2.7 双向登记) (3b5fa476169)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a969d2a5aa1)
- 🐞 Fix:W3 补命名空间相对取词出口,并收口图片标注裸 TextInput (ba671cd8a99)
- 📚 Docs:登记 P1 2026-10-19 LLM 观测失配修复轮(用户级指标+并发闸+探测降噪+系统身份映射) (715aac66435)
- 🐞 Fix:门57 error-retry-action锚点改指ChatMessageList.tsx + 门44补登.doc-autoupdate白名单(2026-10-19) (bedbb942285)
- 🐞 Fix:门 105 四端 ui-routes 派生产物重生成对齐当前 HEAD 源 —— 生成器原话出路(机械动作);生成前已验三个输入源的工作树与 HEAD 逐字一致,故产物自述钉与 head 面现算相等 (c59ee4d85c0)
- 🐞 Fix:LLM 观测失配修复(用户级指标)+ 自伤并发闸 + 探测降噪 + 系统身份映射 (66a47341319)
- 🐞 Fix:门 83 基线补登 ChatScreen.tsx 的 R2 存量 2 处(图片预览浮钮实底 surface.light,D124 引入时漏登基线 ⇒ 全量档恒红);按全量实测只补这一处,不动其余键 (893b31371c7)
- ♻️ Refactor:斜杠命令模板类 id 清单下沉共享层 —— web/RN 共用同一份(端与端 import 边违反架构契约 D1,门 103 判红);web 侧改 re-export 消费方零改动,RN 测试基准换为共享层 (e77e5bb8e49)
- 🐞 Fix:ChatScreen exhaustive-deps 两条 + ImageAnnotator 裸 TextInput 按 G-978007 判据补齐(CI lint/test 存量红) (b98806f33dd)
- 🐞 Fix:agent 迁移 325 三处 ALTER TYPE 补 DROP DEFAULT(CI 测试库 42804 炸点,default 无法自动转换:federated id/dp_noise_added + meta source_skills) (4af9df7f938)
- 🔧 Chore/Other:chat-branch i18n mock 形状对齐类型定义(CI typecheck 5×TS2322) (4dd69c99528)
- 🐞 Fix:token 就位后等 HubSpot 回调自动提交,不再重点 Submit(否则 reCAPTCHA 重弹) (b88382c6836)
- 🐞 Fix:sso 隧道源站 8543→8850(端口铁律,注册表+docs §2.7 双向登记) (b2503baa8ee)
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
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (cf85ee4574f)
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
- 🔧 Chore/Other:回退F10折叠两行注记(门13d恒红,purge被3个他人在飞族卡),恢复父版正文 (36ca42c5228)
- 🐞 Fix:守门 8 修两处判据盲区 + BP 腿基线下调到 15 (c1afcfc8ce0)
- 🐞 Fix:折叠"同题不同编号"的孪生待办登记(F10 折叠档) (949f0a3d3a1)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (76045c98e0d)
- 🐞 Fix:reCAPTCHA 指令轮询窗口 6 分钟 -> 10 分钟 (1dc3aa64282)
- 📚 Docs:摘除 6 行 F1/F4 重复登记副本(并发旧基线 union 合并带回),认领标记原样转移 —— F1 3→0 / F4 3→0 (489ad005a52)
- 🚀 Feature/Improvement:清 BP 腿量出的裸路径死调用 —— RN/小程序 2 处 + web 6 处改指在册端点 (4ba1934c568)
- 📚 Docs:仪表盘数字订正为现读 26(删 jaeger/nginx 幻觉盘下游:MONITORING 21→26、README 三处 21/3/21→26、生成器头注 20+1→24 Prometheus+2 Loki)+ sync-readme-numbers.mjs 补溯源水印(CI watermark check 唯一未覆盖文件) (61031d3ad84)
- 🐞 Fix:reCAPTCHA 挑战改按 DOM 格子序号点击,消除 3x3/4x4 坐标漂移 (f67bcb5fa4e)
- 🚀 Feature/Improvement:斜杠命令面对齐 web(模板正文逐字取自 web chat.cmd*)+ 会话批注补复合归属键与 AsyncStorage 落盘(D180 对齐 web 三处语义);附 mobile-rn 五语言 slashCmd/slashTemplate/selectionAnnotations 词条与 automations.schedule 缺键 (895eefbdbd1)
- 🔧 Chore/Other:npm-bootstrap runner 加远端日志镜像与防挂死硬超时 (28563b79d73)
- 📚 Docs:全文陈旧数字现读刷新(四语言同步,遗留项整改) (d56aa604a9d)
- 🔧 Chore/Other:删除已零引用的计划指针净化临时票据 plan-pointer-purge-2026-10-14-b56c9ad7.md(工作树删除收口,全仓零引用,git 历史可取回) (d6d12cfa96c)
- 📚 Docs:全文陈旧数字现读刷新(四语言同步,遗留项整改) (07752095ed0)
- 📚 Docs:补桌面/MSVC 构建注入与未签名豁免文档段 + 端口登记/port 文档 8861 对齐 dev:desktop:saas 新流程【出口②留痕:AGENTS.md 5 段在祖先 fc3cc1e03(union merge)提交过但被后续重组挤出 HEAD,属恢复丢失非复活陈旧——同批代码 msvc-env/desktop-build*/desktop-unsigned-config/desktop-artifact-single 早已在 HEAD(d03e3fe8d68+c304d2bcbb9),文档与代码是同一次工作的两部分;dev-port-registry.json 键路径复活 0、port-management.md 干净,均非 stale】 (f093663094b)
- 🔧 Chore/Other:GC翻勾7条已修票(skills市场授权2/D176/锁原子2/resolveRemoteHead/G-621) (ea6b14bd894)
- 🐞 Fix:健康门禁 llm 维加源站 liveness 腿(公网 unknown 折算为绿)+CLEAN-BUILD 净面还原 sw.js (2ed0508fcb5)
- 🔧 Chore/Other:删除 5 个无引用死文件——3 张轮播图(引用已被 banner-*.jpg 替换)+ jaeger/nginx 两盘幻觉看板(零生成贡献) (741338179d2)
- 🚀 Feature/Improvement:reCAPTCHA 闭环升级——挑战截图经 GITHUB_TOKEN 实时推 rc-live 分支(李总侧 raw 读取识别→坐标 rc-clicks.json 回传→点击),成功后清理 (9a598d8e405)
- 📚 Docs:特性总览重写为结构化可扫读的能力展示(基于现读) (14de5d970c3)
- 📚 Docs:P3 侧边栏收敛 RN 域入口层翻勾 (403cab6c145)
- 📚 Docs:特性总览重写为结构化可扫读的能力展示(基于现读,李总诉求) (3b881dedf2e)
- 🚀 Feature/Improvement:reCAPTCHA 图像挑战闭环(截图回传→rc-clicks.json 坐标指令→人类化点击→VERIFY→多轮);automation 超时 40min (998e83c7232)
- 🚀 Feature/Improvement:L5669① skills 两级渐进披露 + 技能前置门 428 (130af8c18c7)
- ♻️ Refactor:侧边栏收敛 P3 —— 教育/交易/社区收为域入口二级屏 (7bc83e2b593)
- 🐞 Fix:BottomPops 门150 半径 control→sm + check-artifact-budget buildHint 对齐 wrapper/unsigned + ONBOARDING 桌面 dev 命令对齐 (a81e7cd986a)
- 🐞 Fix:SignPath DD 改 label 定位 hsfc-DropdownField + combobox/option 交互;dump SP_DD_HTML 诊断 (342bd7a49e3)
- 🐞 Fix:收归未签名豁免单源 + 银行 build 会话桌面端增量(MSVC 根治体系后续) (c304d2bcbb9)
- 📚 Docs:修复最近更新机制基线悬空缺陷 + 块内容改由主线历史重生成 (6e2e29f3605)
- 🚀 Feature/Improvement:守门 8 补 BP 腿 —— 裸路径传输口调用进调用集(本簇真正的根因器物) (a1c2f1f116a)
- 📚 Docs:G-200 结清 —— 服务端有界续写随码入库,本号行与旧号同题副本一并翻勾 (b48b9675bbf)
- 🚀 Feature/Improvement:守门 98 补 D5 维 —— 同一 barrel 文件内同名导出重复当场拦(防第五次回灌) (e4ef3b38ac8)
- 🚀 Feature/Improvement:G-200 服务端有界续写落地 —— finish_reason 三面透传 + 每恢复段 ≤3 次 + 补丁不落持久历史 (bac27c8f7b0)
- 📚 Docs:最近更新小节接入提交钩子,开发时自动从 git log 派生 (471d53ab18d)
- 🚀 Feature/Improvement:补 GET /api/user/security 与 /api/circles/users/recommend —— 两条死路径的真实数据源 (7cfd10d17e3)
- 🔧 Chore/Other:认领 L5669 ①skills 两级渐进披露+技能前置门 428 (b9de28d2207)
- 📚 Docs:自动化文档更新机制 —— 提交即刷新数字,每日 AI 刷新最近更新 (a862205d662)
- 🔧 Chore/Other:同步四端 ui-routes 派生产物(P2 域入口页新增路由) (90c5d44c06b)
- ♻️ Refactor:侧边栏收敛 P2 —— 教育/内容/交易三域收为域入口(72→24) (126b47d148b)
- 🚀 Feature/Improvement:G-425 端上截断提示补齐 RN + 小程序两条腿 —— done 帧 finishReason 判 length/max_tokens 即 toast,缺席绝不折成 stop (39471e598a0)
- 🐞 Fix:6 个屏的 8 条死路径改指既有后端 —— 不新建端点、不造表 (8b3e8c5d5fa)
- 🐞 Fix:清掉合并带回的 FormRequestEvent 重复导出 —— HEAD 面 TS2300 打死了本包 build (f1d0b6259cc)

**2026-10-20**
- ⚡ Perf:页头字标换成真矢量,1.18MB -> 42KB(两版各减 96%) (c079c6d705b)
- 📚 Docs:文档层洗掉已退役看板程序名(README×3 + docs 29 份,128 处) (8c1e72e10b1)
- ♻️ Refactor:自有 env 键 GRAFANA_* → BOARD_*(含 saas 编排/gen-secrets/示例) (b17056a4ed9)
- 📚 Docs:门名索引跟着 panel 系改名(修 R4:新门名在文档里看不见) (bb5c9acbef9)
- ♻️ Refactor:看板器物改名落库(panel 系;门 220/222 的悬空引用一并解掉) (a7ced7411ca)
- ⚡ Perf:语言包改为按需加载,首屏不再带 5 种语言 (5dba888279d)
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
