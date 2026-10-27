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
| 数据库表 | 611 | `dbTables` |
| schema 文件 | 236 | `dbSchemaFiles` |
| API 路由 | 4581 | `apiRoutes` |
| 路由文件 | 636 | `apiRouteFiles` |
| AI 服务路由 | 603 | `aiServiceRoutes` |
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
| 测试文件 | 3435 | `testFiles` |
| CI 工作流 | 49 | `ciWorkflows` |
| Compose 服务 | 14 | `composeServices` |
| 工程守门 | 290 | `guardianGates` |
| — blocking | 264 | `guardianBlocking` |
| — warn | 28 | `guardianWarn` |
| 跟踪文件 | 16898 | `trackedFiles` |

上表由 `node scripts/gen-doc-numbers.mjs --markdown` 生成,最后核对日期 2026-10-27。
每个数的来源就写在取数键旁边的实现里(`scripts/gen-doc-numbers.mjs` 的 `SOURCES`),**不得手抄、不得另立第二份**。

<!-- END GENERATED NUMBERS -->


## Recent updates (auto-maintained)

<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->
**2026-10-27**
- 🐞 Fix:桌面壳破坏性命令加原生确认闸 + 清除孤儿签名钥匙 —— XSS 无法再无人应答执行重置 (fa6586a19b0)
- 🔧 Chore/Other:门237未判定桶与USDT地址配置面结清(现读复量+锁测试) (7ae54f576cc)
- 🔧 Chore/Other:修 scan-login 守卫测试文案类型(noUncheckedIndexedAccess 下 string|undefined 不能喂 getByText) (e165c372578)
- 🐞 Fix:「我的」页会员权益块补屏幕边距 + 4 Tab 与三枚菜单入口消裸键 (bed7a6bebad)
- 🔧 Chore/Other:修复 AppQrPanel 轮询测试缺 agreementAccepted 入参 (46ebbb2930c)
- 🚀 Feature/Improvement:第三方 OAuth 发起期落协议同意记录(RN 端 fail-closed 配套) (15eefad3685)
- 🐞 Fix:第三方 OAuth 发起前落协议同意,并给 sso/auth 加显式同意步骤 (7bd751e7b5f)
- 🚀 Feature/Improvement:第三方 OAuth 通用回调增加服务端协议同意闸 (ee40a321284)
- 📚 Docs:⑦真机实弹闭环登记(单会话搬移/回退+客户端自启守护与定向理由放行) (5ad7865a9eb)
- 🚀 Feature/Improvement:客户端存续前置增定向理由放行 + 真机搬移/回退实弹闭环 (b20e6e8d37a)
- 🐞 Fix:列表元数据不再被打码 + 重登覆盖保留 refresh 到期与展示名 (a3bbfcff869)
- 🔧 Chore/Other:新件补溯源水印载荷 + 登记 SectionHeader 配对族基线(带理由豁免:箭头/标签几何在委托件 MoreLink) (189f31951f8)
- 🚀 Feature/Improvement:RN 区段头收口到 @ihui/shared/ui/section-header-spec 单一源 (1394db170fd)
- 🐞 Fix:扫码登录路径补协议同意闸——后端单源判据 fail-closed,前端复用共享协议弹窗采集 (afecc4a48b2)
- 🔧 Chore/Other:修复 tool_invocation_ledger.py 溯源水印载荷(HEAD 面唯一欠账,门 check-watermark-coverage 自愈产物;其余内容零改动) (212fef3995f)
- 📚 Docs:⑦自助化收口登记(rebuild --auto / move --account / 客户端存续前置) (f5354a1e978)
- 🚀 Feature/Improvement:⑦自助化收口——账号时间线自动推导+按账号批量搬移+客户端存续前置 (e5418db46a7)

**2026-10-27**
- 🐞 Fix:patch-rn-release-signing 的「已注入」误报 —— signingConfigs.release 恒缺,本地出包链第 1 步断 (785d9df55bb)

**2026-10-27**
- 🐞 Fix:F13 判据本体补齐三格 —— 销门98 D1(收 545c2a0f0e1 同族) (1002dee33be)

**2026-10-27**
- 🚀 Feature/Improvement:底部导航恢复真毛玻璃 —— Android 补 blurMethod(0.0.8「模糊不生效」实为漏传参数) (828dbc13747)

**2026-10-27**
- 🐞 Fix:收口第五轮第七批 —— 孤儿签名钥匙清除/RN 凭据明文降级拒绝/web-nginx CSP 死配置摘除 (5c489c48aff)

**2026-10-27**
- 🐞 Fix:桌面壳 CSP 从 null 收紧为显式串 —— 防注入脚本任意外联 (ac7ba19a384)

**2026-10-27**
- 🐞 Fix:收口第五轮第六批 —— Python 网页工具逐跳 SSRF 与开发者提现原子化 (ead21e7045b)
- 📚 Docs:守门207 体积清偿批三 —— R4② 家族回潮副本/git推送 stub 家族/水印三档第三份/§1 完成即删同物/R4⑦ 内嵌 ruff 段逐字归档;R4⑤⑥⑦ 与 §1 四段按「整区逐字迁出+原位留规则单行」压缩 (ec6703f111e)

**2026-10-27**
- 🐞 Fix:运行档位判定全量收口到 config 出口 —— 源码面清零裸读 process.env.NODE_ENV (146c0506282)

**2026-10-27**
- 🐞 Fix:收口第五轮第四批 —— 悬赏任务与远程设备控制面的属主闸 (6a586fc06f9)

**2026-10-27**
- 🔧 Chore/Other:违禁桶兜底清扫——HEAD面等条件/待拍板未勾行自动摘除(两道机主禁令的执行器物化,留痕f12-purge;复翻席请同步摘形态,事实内容按各批结清提交保留) (dd8919020af)
- 🐞 Fix:收口第五轮第三批 —— 内部密钥计时比较三处漏网/CORS 扩展前缀放行收窄/AI 代理 SSRF (f033148c2ad)

**2026-10-27**
- 🔧 Chore/Other:重派 web+miniapp ui-routes 派生件 —— 销门105 自述钉 stale (c6acfafe1d0)

**2026-10-27**
- 🔧 Chore/Other:门7 依赖碎片化清偿 —— union 收敛枚合并两侧 lockfile 后收敛回单一版本 (c425140f1ad)

**2026-10-27**
- ♻️ Refactor:提取器测试归位 scripts/tests —— 销门103 D1/D2 四处 (003cfc4f6eb)

**2026-10-27**
- 🐞 Fix:补齐 findClosedToOpenRegressions 判据本体 —— 7ea94a13db9 引用先入库而实现缺席,全仓提交链被卡 (545c2a0f0e1)
- 🐞 Fix:收口第五轮第二批 P0 —— 社交登录 2FA 旁路与未验证邮箱自动关联两条接管链 (402ad2c7b56)

**2026-10-27**
- 🔧 Chore/Other:撤除关于页端内分段数据孤儿件 —— 销门39 V1 (9ef51b6911a)
- 🚀 Feature/Improvement:装短信发送通道健康只读哨兵 —— 欠费静默停机不再无人知 (d05a1283cd4)
- 🐞 Fix:OTA 提示卡读条填充换强调档 —— 销门83 R3 (c5bc8e1b302)
- 🔧 Chore/Other:第3波待办(覆盖面):wave3-chair 复核注记——无代码面可闭子格,本行保持未勾 (f836a82546a)
- 🚀 Feature/Improvement:抽纯函数 planTriageActions 决策层 + 单测(dry-run/单测态,不连生产库) (c906f0b92ba)
- 📚 Docs:金丝雀发布票 code-side 复核注记(canary-chair) (0c7d6b8b817)
- 🚀 Feature/Improvement:收编两批死席半成品 —— 门237「未判定桶收缩」(补检测形不松尺 + 复原被洗掉的硬化);e2e 夹具 requireEnv 惰性化 (dbc66f80f05)
- 📚 Docs:六组同题两版对齐到 origin 版 —— 解收敛并集放大,本地独有事实已逐字留证待回补 (0fafd8f54d0)
- 🚀 Feature/Improvement:收编两批守门硬化 —— 门130 加 F13「已勾被捣回未勾」差值棘轮维;门44 拆"红/未判定"两档并把未判定变成可指认红因 (7ea94a13db9)
- 🔧 Chore/Other:第十三轮收尾落地:ZCode 凭证解密+真身套餐通道实弹闭环 & 豆包双层加密破译+签名墙语义修正。 (c28624c9fc3)
- 📚 Docs:B01 Predictive Edit 结清翻勾 —— 五格全闭环:③真模型取证实跑收口(live 闸 1/1、agnes 全契约结构化动作 suggested、失败态真上游两两可分辨),①前端调用方前席已落地本席复核在位;取证事实留档(4000ms 预算封顶装不下跨境往返、LiteLLM 价目表拉取卡事件循环);回归 ai-service 89/89+live 1/1、web 11/11、web tsc 0 错、mypy 0 错 (d99a9739a7e)
- 🚀 Feature/Improvement:判据层增规则③收集目录同名 —— 补测配方真落点被门认领(P/tests|test 精确同名盖 P/src|app,同包同名唯一收紧·不认 .spec.*·不做前缀),HEAD 面缺口 4042→3815(227 枚假缺口消解,新增 0);自检 33/33·镜像 6/6·autofill 37/37;runner 250 触发面罩收集目录并重封存根护栏;顺手清 lint 红(extname/LOCAL_DECL_RE 死变量) (222610b372d)
- 📚 Docs:门237两新票占用核查注记 —— 门体被他席在飞改写(489+/69-)占住,本席不认领不派单,落地后重走派单面 (dcd2fe250a8)
- 📚 Docs:G-02 三枚路由核对注记——①真会话复证 200/②③契约面 9 例绿,不翻勾留验收缺口 (9e2980dd4cc)
- 📚 Docs:E2E 自动补测 进展注记(2026-10-27/e2e-chair)—— 判据层规则③收集目录同名落地,缺口 4042→3815,保持未勾 (76479973130)
- 🔧 Chore/Other:G-02 三枚路由契约面复核——修 g299 mock 缺口(getDispatchStats/getDag)使 9/9 绿,含 n8n 成功路径 2 例(fetch-merge-put/activate+回读) (2e5ba54feb8)
- 📚 Docs:B04 两格收口合并注记落行 —— 清除器(ef8aedd)+消费面接线(87796c90)落码全绿;接线枚待远端收敛交清扫循环自愈,生产env/prod迁移属运维面维持未勾租约保留 (9549484c6b3)
- 🔧 Chore/Other:重派小程序 ui-routes 派生件 —— 门105 该端自述钉 stale (743586edea6)
- 📚 Docs:D16 注记读数差澄清 —— check:sdk-publish 19/19→22 的构成(本席对外承诺用例 + 前席在飞的 npm 鉴权口径 2 用例随批入库) (675c72eeb6d)
- 🚀 Feature/Improvement:大屏新增「分时访问」面板 + 会话质量补「退出页 TOP」—— 页面级使用数据的时间维度与路径收尾两格 (2d7916c1153)
- 📚 Docs:监控大屏与全站埋点进展注记 —— 本轮分时访问面板+退出页 TOP 两增量(不翻勾,持续优化型) (a9ccc5a80c9)
- 📚 Docs:D16 发布就绪性代码面收口注记 —— retryAfterMs 限流透出/README 四段对外承诺/CHANGELOG 随包/门 22 用例,自证全绿;剩余为注册表账号与触发 tag 等仓库外动作,维持未勾 (cc3e87e5d7b)
- 🚀 Feature/Improvement:D16 发布就绪性收口 —— SdkError.retryAfterMs 限流透出 + README 对外承诺四段(版本与稳定性/遥测与隐私/限流与 429/鉴权获取指引) + CHANGELOG 随包附带 + check:sdk-publish 补对外承诺用例 (1087de1d674)
- 🚀 Feature/Improvement:消费面接线 —— ai-service 工具调用经内部摄入腿落明细账(照既有服务间先例同型,失败不拖主循环) (87796c90ca6)
- 📚 Docs:D16 Agent SDK 对外开放 挂牌认领(进行中@2026-10-27/d16-chair)—— 发布就绪性代码面收口在飞 (a2ec2af694a)
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
