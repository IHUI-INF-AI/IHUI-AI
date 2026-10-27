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

Headline claims (same source as the table below, all live-computed): **608 tables · 4564 API routes ·
25 WebSocket endpoints · 99 catalogued LLMs · 38 platforms auto-publishing · 3362 test files ·
286 engineering gates · 49 CI workflows · 5-language i18n parity · 9 app packages · 16 shared packages ·
14 compose services**.

<!-- BEGIN GENERATED NUMBERS (node scripts/gen-doc-numbers.mjs --markdown) -->
| 指标 | 现值 | 取数键 |
| ---- | ---- | ------ |
| 数据库表 | 611 | `dbTables` |
| schema 文件 | 236 | `dbSchemaFiles` |
| API 路由 | 4583 | `apiRoutes` |
| 路由文件 | 638 | `apiRouteFiles` |
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
| 测试文件 | 3451 | `testFiles` |
| CI 工作流 | 49 | `ciWorkflows` |
| Compose 服务 | 14 | `composeServices` |
| 工程守门 | 290 | `guardianGates` |
| — blocking | 264 | `guardianBlocking` |
| — warn | 28 | `guardianWarn` |
| 跟踪文件 | 16933 | `trackedFiles` |

上表由 `node scripts/gen-doc-numbers.mjs --markdown` 生成,最后核对日期 2026-10-27。
每个数的来源就写在取数键旁边的实现里(`scripts/gen-doc-numbers.mjs` 的 `SOURCES`),**不得手抄、不得另立第二份**。

<!-- END GENERATED NUMBERS -->


## Recent updates (auto-maintained)

<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->
**2026-10-28**
- 🚀 Feature/Improvement:导出席加固 —— --out 不得落进会话库(源库只读红线) (d054425c6a)

**2026-10-28**
- 🔧 Chore/Other:发布就绪判据补 pack 输入与装车证明两格(22→24) + index 判据抽单份 (e36ed1cf4f)
- 🚀 Feature/Improvement:ops 运维腿 —— 日志统计 / 受控轮转 / 快照清单(只报数不删) (0e0121c907)
- 🚀 Feature/Improvement:会话导出腿 —— HTML/JSON 双份,字段对齐官方报告形状 (88e98cfa9d)
- 📚 Docs:生产侧取证落账(G-329五条断言全达/G-1200041 portproxy已修+530根因在DNS绑定) (de0d996d3e)

**2026-10-27**
- 🐞 Fix:健康门禁探测令牌改系统自签,修每轮 HEALTH 401 (c731416937)
- 📚 Docs:回滚 D08 误翻——票面明写 ①③ 未齐不翻勾，待执行席取证后再定 (f27b9ca499)
- 📚 Docs:回滚 G-02 误翻——票面明写本行不翻勾(持有行已归档)，判据绿但状态约定优先 (9c7e4eb83c)
- 📚 Docs:门128 存量复核进展注记(无正值可下调,余真机归走查包) @gb18-g128 (201ce10358)
- 📚 Docs:结清 L28759 门237单侧屏票(前提不成立,零代码改动) @gb18-g237 (5d9f4efbd3)
- 📚 Docs:结清 G-02 三枚待实装路由（subagents/all + n8n PUT/toggle，9 用例绿） (ee63def9c9)
- 📚 Docs:结清 D08 Agent Teams 协作协议（后端48+前端2全绿，三件落点现读） (d7a01a8d52)
- 📚 Docs:结清 D06 结构化代码审查 /review（前端13+后端12全绿，三型验收全覆盖） (a78402dbb2)
- 📚 Docs:结清 D01 对话内 Agent 选择器（判据 20/20 全绿 + 全链落点现读） (4f25b42333)
- 🔧 Chore/Other:并发锁接线锁 —— 证明 move/links 的 --apply 真的取锁 (2728f969d0)
- 🚀 Feature/Improvement:会话腿并发锁 + 复制到桶 copy + 切换后换桶提示 (6833a96637)
- 🔧 Chore/Other:两条无编号行采用对侧已入库形态(对侧就地改写,本侧不持旧形态) (9cdf9530d1)
- 🔧 Chore/Other:G-172 采用对侧已入库那版结清措辞(避免同号两标题) (961506f555)
- 🚀 Feature/Improvement:D03 快捷笔记归档/分组/检索闭环(web+RN 同构，全链路走 api-client) (ef5fab2dbb)
- ♻️ Refactor:SectionHeader 更多标签字号改取 spec 常量(去端内第二份 12) (f55aa8d17b)
- 🐞 Fix:活文档正文点名的归档件不得被回收 (ddbc19f469)
- 🔧 Chore/Other:生产侧终验结清(生产库迁移记账双射转绿 + 线上构建滞留结清 + 归档回收保护缺口补钉) (fe4d02083f)
- 🐞 Fix:跨端几何单一源对齐 + 门237登记补齐 2 条 + D01 单源判据(13 例) (152a57736b)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (14c8a9f99c)
- 🐞 Fix:漂开副本归并(file.aizhs.top G-18→G-100 / Agent SDK G-06→D16 旧面补行首归并指针,不翻勾不删行,派单以持有行为准) (230a6aa9fb)
- 🔧 Chore/Other:04:19构建与dev库唯一索引两票结清(生产现读证据) (6b43a976ad)
- 📚 Docs:结清 O66 派单面同尺(已落地 2f0830e8eefbdb884c4c5e19ae86c64090a32ab7) (1d1a422039)
- 📚 Docs:收口重复登记(SSH条款已在12节机器事实区单源) (3b4e3ab5ce)
- 📚 Docs:认领 D01 对话内 Agent 选择器(G-228) @2026-10-27/gb18-d01 (a485b9bdd3)
- 📚 Docs:立通道探针铁律(ssh单反斜杠事故根治+回归夹具) (05be448d7d)
- 📚 Docs:认领 L28759 跨端单侧屏清零(门237) @2026-10-27/gb18-g237 (ee46d66055)
- 📚 Docs:补记 2026-10-27 生产 API 崩溃事故(缺模块导入)与观测链修复证据 (429a1f187d)
- 🐞 Fix:移除指向未入库 relay-switch-admin 的挂载,修复生产 API 启动崩溃 (6fb5624be5)
- 🐞 Fix:根治 SSH 隧道配置被吃掉反斜杠（体检仪+规范模板+回归锁） (b2c338a487)
- 🐞 Fix:更新后不再停在启动页/灰页 (73696004d0)
- 📚 Docs:⑦换桶真机往返闭环登记(9 会话换出/换入 + auth 还原逐字节核验) (7ef0ca053a)
- 🔧 Chore/Other:本机生产侧五票现读终验结清(部署快进/健康门禁/备份链/UTF-8 编码/邮件真实送达) (70d5698e83)
- 🐞 Fix:修热更首启灰屏死锁 + 重设计更新卡 (1cb2b7c7b6)
- 📚 Docs:⑦切账号联动换桶 swap 装车登记 (bbf108761e)
- 🐞 Fix:桌面壳破坏性命令加原生确认闸 + 清除孤儿签名钥匙 —— XSS 无法再无人应答执行重置 (fa6586a19b)

**2026-10-28**
- 🚀 Feature/Improvement:会话导出腿 —— HTML/JSON 双份,字段对齐官方报告形状 (88e98cfa9d)
- 📚 Docs:生产侧取证落账(G-329五条断言全达/G-1200041 portproxy已修+530根因在DNS绑定) (de0d996d3e)

**2026-10-27**
- 📚 Docs:回滚 D08 误翻——票面明写 ①③ 未齐不翻勾，待执行席取证后再定 (f27b9ca499)
- 📚 Docs:回滚 G-02 误翻——票面明写本行不翻勾(持有行已归档)，判据绿但状态约定优先 (9c7e4eb83c)
- 📚 Docs:门128 存量复核进展注记(无正值可下调,余真机归走查包) @gb18-g128 (201ce10358)
- 📚 Docs:结清 L28759 门237单侧屏票(前提不成立,零代码改动) @gb18-g237 (5d9f4efbd3)
- 📚 Docs:结清 G-02 三枚待实装路由（subagents/all + n8n PUT/toggle，9 用例绿） (ee63def9c9)
- 📚 Docs:结清 D08 Agent Teams 协作协议（后端48+前端2全绿，三件落点现读） (d7a01a8d52)
- 📚 Docs:结清 D06 结构化代码审查 /review（前端13+后端12全绿，三型验收全覆盖） (a78402dbb2)
- 📚 Docs:结清 D01 对话内 Agent 选择器（判据 20/20 全绿 + 全链落点现读） (4f25b42333)
- 🔧 Chore/Other:并发锁接线锁 —— 证明 move/links 的 --apply 真的取锁 (2728f969d0)
- 🚀 Feature/Improvement:会话腿并发锁 + 复制到桶 copy + 切换后换桶提示 (6833a96637)
- 🔧 Chore/Other:两条无编号行采用对侧已入库形态(对侧就地改写,本侧不持旧形态) (9cdf9530d1)
- 🔧 Chore/Other:G-172 采用对侧已入库那版结清措辞(避免同号两标题) (961506f555)
- 🚀 Feature/Improvement:D03 快捷笔记归档/分组/检索闭环(web+RN 同构，全链路走 api-client) (ef5fab2dbb)
- ♻️ Refactor:SectionHeader 更多标签字号改取 spec 常量(去端内第二份 12) (f55aa8d17b)
- 🐞 Fix:活文档正文点名的归档件不得被回收 (ddbc19f469)
- 🔧 Chore/Other:生产侧终验结清(生产库迁移记账双射转绿 + 线上构建滞留结清 + 归档回收保护缺口补钉) (fe4d02083f)
- 🐞 Fix:跨端几何单一源对齐 + 门237登记补齐 2 条 + D01 单源判据(13 例) (152a57736b)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (14c8a9f99c)
- 🐞 Fix:漂开副本归并(file.aizhs.top G-18→G-100 / Agent SDK G-06→D16 旧面补行首归并指针,不翻勾不删行,派单以持有行为准) (230a6aa9fb)
- 🔧 Chore/Other:04:19构建与dev库唯一索引两票结清(生产现读证据) (6b43a976ad)
- 📚 Docs:结清 O66 派单面同尺(已落地 2f0830e8eefbdb884c4c5e19ae86c64090a32ab7) (1d1a422039)
- 📚 Docs:收口重复登记(SSH条款已在12节机器事实区单源) (3b4e3ab5ce)
- 📚 Docs:认领 D01 对话内 Agent 选择器(G-228) @2026-10-27/gb18-d01 (a485b9bdd3)
- 📚 Docs:立通道探针铁律(ssh单反斜杠事故根治+回归夹具) (05be448d7d)
- 📚 Docs:认领 L28759 跨端单侧屏清零(门237) @2026-10-27/gb18-g237 (ee46d66055)
- 📚 Docs:补记 2026-10-27 生产 API 崩溃事故(缺模块导入)与观测链修复证据 (429a1f187d)
- 🐞 Fix:移除指向未入库 relay-switch-admin 的挂载,修复生产 API 启动崩溃 (6fb5624be5)
- 🐞 Fix:根治 SSH 隧道配置被吃掉反斜杠（体检仪+规范模板+回归锁） (b2c338a487)
- 🐞 Fix:更新后不再停在启动页/灰页 (73696004d0)
- 📚 Docs:⑦换桶真机往返闭环登记(9 会话换出/换入 + auth 还原逐字节核验) (7ef0ca053a)
- 🔧 Chore/Other:本机生产侧五票现读终验结清(部署快进/健康门禁/备份链/UTF-8 编码/邮件真实送达) (70d5698e83)
- 🐞 Fix:修热更首启灰屏死锁 + 重设计更新卡 (1cb2b7c7b6)
- 📚 Docs:⑦切账号联动换桶 swap 装车登记 (bbf108761e)
- 🐞 Fix:桌面壳破坏性命令加原生确认闸 + 清除孤儿签名钥匙 —— XSS 无法再无人应答执行重置 (fa6586a19b)

**2026-10-27**
- 🚀 Feature/Improvement:切账号联动换桶 swap —— 换出当前账号会话/换入目标账号桶 (c1848007fe)
- 🔧 Chore/Other:移除创蓝闪验运营商一键登录接入，登录仅保留短信验证码 (1442baa1e0)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (320ffe17b1)
- 🐞 Fix:漂开副本归并(file.aizhs.top G-18→G-100 / Agent SDK G-06→D16 旧面并入承载行,不翻勾不删行) (1e790e2abf)
- 🔧 Chore/Other:门237未判定桶与USDT地址配置面结清(现读复量+锁测试) (7ae54f576c)
- 🔧 Chore/Other:修 scan-login 守卫测试文案类型(noUncheckedIndexedAccess 下 string|undefined 不能喂 getByText) (e165c37257)
- 🐞 Fix:「我的」页会员权益块补屏幕边距 + 4 Tab 与三枚菜单入口消裸键 (bed7a6beba)
- 🔧 Chore/Other:修复 AppQrPanel 轮询测试缺 agreementAccepted 入参 (46ebbb2930)
- 🚀 Feature/Improvement:第三方 OAuth 发起期落协议同意记录(RN 端 fail-closed 配套) (15eefad368)
- 🐞 Fix:第三方 OAuth 发起前落协议同意,并给 sso/auth 加显式同意步骤 (7bd751e7b5)
- 🚀 Feature/Improvement:第三方 OAuth 通用回调增加服务端协议同意闸 (ee40a32128)
- 📚 Docs:⑦真机实弹闭环登记(单会话搬移/回退+客户端自启守护与定向理由放行) (5ad7865a9e)
- 🚀 Feature/Improvement:客户端存续前置增定向理由放行 + 真机搬移/回退实弹闭环 (b20e6e8d37)
- 🐞 Fix:列表元数据不再被打码 + 重登覆盖保留 refresh 到期与展示名 (a3bbfcff86)
- 🔧 Chore/Other:新件补溯源水印载荷 + 登记 SectionHeader 配对族基线(带理由豁免:箭头/标签几何在委托件 MoreLink) (189f31951f)
- 🚀 Feature/Improvement:RN 区段头收口到 @ihui/shared/ui/section-header-spec 单一源 (1394db170f)
- 🐞 Fix:扫码登录路径补协议同意闸——后端单源判据 fail-closed,前端复用共享协议弹窗采集 (afecc4a48b)
- 🔧 Chore/Other:修复 tool_invocation_ledger.py 溯源水印载荷(HEAD 面唯一欠账,门 check-watermark-coverage 自愈产物;其余内容零改动) (212fef3995)
- 🐞 Fix:patch-rn-release-signing 的「已注入」误报 —— signingConfigs.release 恒缺,本地出包链第 1 步断 (785d9df55b)
- 🐞 Fix:F13 判据本体补齐三格 —— 销门98 D1(收 545c2a0f0e1 同族) (1002dee33b)
- 🚀 Feature/Improvement:底部导航恢复真毛玻璃 —— Android 补 blurMethod(0.0.8「模糊不生效」实为漏传参数) (828dbc1374)
- 📚 Docs:⑦自助化收口登记(rebuild --auto / move --account / 客户端存续前置) (f5354a1e97)
- 🐞 Fix:收口第五轮第七批 —— 孤儿签名钥匙清除/RN 凭据明文降级拒绝/web-nginx CSP 死配置摘除 (5c489c48af)
- 🐞 Fix:桌面壳 CSP 从 null 收紧为显式串 —— 防注入脚本任意外联 (ac7ba19a38)
- 🐞 Fix:收口第五轮第六批 —— Python 网页工具逐跳 SSRF 与开发者提现原子化 (ead21e7045)
- 📚 Docs:守门207 体积清偿批三 —— R4② 家族回潮副本/git推送 stub 家族/水印三档第三份/§1 完成即删同物/R4⑦ 内嵌 ruff 段逐字归档;R4⑤⑥⑦ 与 §1 四段按「整区逐字迁出+原位留规则单行」压缩 (ec6703f111)
- 🐞 Fix:运行档位判定全量收口到 config 出口 —— 源码面清零裸读 process.env.NODE_ENV (146c050628)
- 🐞 Fix:收口第五轮第四批 —— 悬赏任务与远程设备控制面的属主闸 (6a586fc06f)
- 🔧 Chore/Other:违禁桶兜底清扫——HEAD面等条件/待拍板未勾行自动摘除(两道机主禁令的执行器物化,留痕f12-purge;复翻席请同步摘形态,事实内容按各批结清提交保留) (dd8919020a)
- 🐞 Fix:收口第五轮第三批 —— 内部密钥计时比较三处漏网/CORS 扩展前缀放行收窄/AI 代理 SSRF (f033148c2a)
- 🔧 Chore/Other:重派 web+miniapp ui-routes 派生件 —— 销门105 自述钉 stale (c6acfafe1d)
- 🔧 Chore/Other:门7 依赖碎片化清偿 —— union 收敛枚合并两侧 lockfile 后收敛回单一版本 (c425140f1a)
- ♻️ Refactor:提取器测试归位 scripts/tests —— 销门103 D1/D2 四处 (003cfc4f6e)
- 🐞 Fix:补齐 findClosedToOpenRegressions 判据本体 —— 7ea94a13db9 引用先入库而实现缺席,全仓提交链被卡 (545c2a0f0e)
- 🐞 Fix:收口第五轮第二批 P0 —— 社交登录 2FA 旁路与未验证邮箱自动关联两条接管链 (402ad2c7b5)
- 🔧 Chore/Other:撤除关于页端内分段数据孤儿件 —— 销门39 V1 (9ef51b6911)
- 🚀 Feature/Improvement:装短信发送通道健康只读哨兵 —— 欠费静默停机不再无人知 (d05a1283cd)
- 🐞 Fix:OTA 提示卡读条填充换强调档 —— 销门83 R3 (c5bc8e1b30)
- 🐞 Fix:OTA 提示卡读条填充换强调档 —— 销门83 R3 (1908366bf3)
- 🐞 Fix:版本号三处漂移收口 + 守门补 I 维(移动端双写一致) (8fb47d2628)
- 🐞 Fix:收口第五轮第一批 P0 —— 越权进他人 Key 组/文件桥任意读写/生产机 shell 面三项 (240cfcbd33)

**2026-10-27**
- 🚀 Feature/Improvement:客户端存续前置增定向理由放行 + 真机搬移/回退实弹闭环 (b20e6e8d37)
- 🐞 Fix:列表元数据不再被打码 + 重登覆盖保留 refresh 到期与展示名 (a3bbfcff86)
- 🔧 Chore/Other:新件补溯源水印载荷 + 登记 SectionHeader 配对族基线(带理由豁免:箭头/标签几何在委托件 MoreLink) (189f31951f)
- 🚀 Feature/Improvement:RN 区段头收口到 @ihui/shared/ui/section-header-spec 单一源 (1394db170f)
- 🐞 Fix:扫码登录路径补协议同意闸——后端单源判据 fail-closed,前端复用共享协议弹窗采集 (afecc4a48b)
- 🔧 Chore/Other:修复 tool_invocation_ledger.py 溯源水印载荷(HEAD 面唯一欠账,门 check-watermark-coverage 自愈产物;其余内容零改动) (212fef3995)
- 🐞 Fix:patch-rn-release-signing 的「已注入」误报 —— signingConfigs.release 恒缺,本地出包链第 1 步断 (785d9df55b)
- 🐞 Fix:F13 判据本体补齐三格 —— 销门98 D1(收 545c2a0f0e1 同族) (1002dee33b)
- 🚀 Feature/Improvement:底部导航恢复真毛玻璃 —— Android 补 blurMethod(0.0.8「模糊不生效」实为漏传参数) (828dbc1374)
- 📚 Docs:⑦自助化收口登记(rebuild --auto / move --account / 客户端存续前置) (f5354a1e97)
- 🐞 Fix:收口第五轮第七批 —— 孤儿签名钥匙清除/RN 凭据明文降级拒绝/web-nginx CSP 死配置摘除 (5c489c48af)
- 🐞 Fix:桌面壳 CSP 从 null 收紧为显式串 —— 防注入脚本任意外联 (ac7ba19a38)
- 🐞 Fix:收口第五轮第六批 —— Python 网页工具逐跳 SSRF 与开发者提现原子化 (ead21e7045)
- 📚 Docs:守门207 体积清偿批三 —— R4② 家族回潮副本/git推送 stub 家族/水印三档第三份/§1 完成即删同物/R4⑦ 内嵌 ruff 段逐字归档;R4⑤⑥⑦ 与 §1 四段按「整区逐字迁出+原位留规则单行」压缩 (ec6703f111)
- 🐞 Fix:运行档位判定全量收口到 config 出口 —— 源码面清零裸读 process.env.NODE_ENV (146c050628)
- 🐞 Fix:收口第五轮第四批 —— 悬赏任务与远程设备控制面的属主闸 (6a586fc06f)
- 🔧 Chore/Other:违禁桶兜底清扫——HEAD面等条件/待拍板未勾行自动摘除(两道机主禁令的执行器物化,留痕f12-purge;复翻席请同步摘形态,事实内容按各批结清提交保留) (dd8919020a)
- 🐞 Fix:收口第五轮第三批 —— 内部密钥计时比较三处漏网/CORS 扩展前缀放行收窄/AI 代理 SSRF (f033148c2a)
- 🔧 Chore/Other:重派 web+miniapp ui-routes 派生件 —— 销门105 自述钉 stale (c6acfafe1d)
- 🔧 Chore/Other:门7 依赖碎片化清偿 —— union 收敛枚合并两侧 lockfile 后收敛回单一版本 (c425140f1a)
- ♻️ Refactor:提取器测试归位 scripts/tests —— 销门103 D1/D2 四处 (003cfc4f6e)
- 🐞 Fix:补齐 findClosedToOpenRegressions 判据本体 —— 7ea94a13db9 引用先入库而实现缺席,全仓提交链被卡 (545c2a0f0e)
- 🐞 Fix:收口第五轮第二批 P0 —— 社交登录 2FA 旁路与未验证邮箱自动关联两条接管链 (402ad2c7b5)
- 🔧 Chore/Other:撤除关于页端内分段数据孤儿件 —— 销门39 V1 (9ef51b6911)
- 🚀 Feature/Improvement:装短信发送通道健康只读哨兵 —— 欠费静默停机不再无人知 (d05a1283cd)
- 🐞 Fix:OTA 提示卡读条填充换强调档 —— 销门83 R3 (c5bc8e1b30)
- 🐞 Fix:OTA 提示卡读条填充换强调档 —— 销门83 R3 (1908366bf3)
- 🐞 Fix:版本号三处漂移收口 + 守门补 I 维(移动端双写一致) (8fb47d2628)
- 🐞 Fix:收口第五轮第一批 P0 —— 越权进他人 Key 组/文件桥任意读写/生产机 shell 面三项 (240cfcbd33)

**2026-10-27**
- 🚀 Feature/Improvement:⑦自助化收口——账号时间线自动推导+按账号批量搬移+客户端存续前置 (e5418db46a)
- 🔧 Chore/Other:第3波待办(覆盖面):wave3-chair 复核注记——无代码面可闭子格,本行保持未勾 (f836a82546)
- 🚀 Feature/Improvement:抽纯函数 planTriageActions 决策层 + 单测(dry-run/单测态,不连生产库) (c906f0b92b)
- 📚 Docs:金丝雀发布票 code-side 复核注记(canary-chair) (0c7d6b8b81)

**2026-10-27**
- 🚀 Feature/Improvement:收编两批死席半成品 —— 门237「未判定桶收缩」(补检测形不松尺 + 复原被洗掉的硬化);e2e 夹具 requireEnv 惰性化 (dbc66f80f0)
- 📚 Docs:六组同题两版对齐到 origin 版 —— 解收敛并集放大,本地独有事实已逐字留证待回补 (0fafd8f54d)
- 🚀 Feature/Improvement:OTA 提示卡补下载读条 + 当前包身份可见 —— 「更新了没变化」从猜变成可对账 (dfecb638f9)
- 🐞 Fix:rustup 家钉正补齐两个 saas 入口,四入口共用一份三态出口 (b00a550dad)
- 🐞 Fix:扫码登录链三处真缺陷 + 三端点零测试补齐(成对变异自证) (f02f0c1ae5)
- 🐞 Fix:补 expo-blur/expo-updates 的 vitest alias,4 套件收集期红清零 (e5eb705a6e)
- 🐞 Fix:「我的创作」入口收进「+」面板,素材卡片行迁入底部停靠区 (81f08b3533)
- 🐞 Fix:收口第四轮认证与写面漏洞 —— 2FA 旁路/人机验证死钩子/撞库续命/未鉴权 webhook 管理面 (c1a1f2b95f)
- 📚 Docs:登录地区行指针改线 —— README:3492 仍指已撤除的 utils/login-order-policy 死路径,f1304bccfb take-theirs + C3(f0768ba6253) 后幸存位=packages/shared/auth/login-region-policy;只改路径指针与措辞归属,不判排序语义 (914df0b224)
- 🐞 Fix:TabBar 几何恢复悬浮胶囊,材质保留磨砂实底 (0c59c2cb10)
- 🐞 Fix:apps/web manifest next 对齐 lock 实态 16.4.3 —— 收敛批次债清偿(2026-10-27):二轮 union 取对席 dedupe 锁(specifier 16.4.3,b25e4783e42 批次 install 升锁未同笔交清单,disk 改了 16.4.3 一直没入库);门101 HEAD 面现读违例 1 条,已成对全席提交链的恒红干扰源(§12e),按修姿①清单向锁对齐:只改 package.json 这一行,不动 lock(门体二选一纪律)。node_modules 与 .pnpm 实测均解析 16.4.3,typecheck 17/17 与全量单测即在该实态跑绿 (af21471f20)
- 🔧 Chore/Other:违禁桶兜底清扫——HEAD面等条件/待拍板未勾行自动摘除(两道机主禁令的执行器物化,留痕f12-purge;复翻席请同步摘形态,事实内容按各批结清提交保留) (04b64c84e1)
- 🐞 Fix:Android 端放弃 dimezis 模糊,改 iOS 白底同款磨砂实底;升 0.0.8 (b25e4783e4)
- 🔧 Chore/Other:撤除本位第一版共享下沉岛 —— 二轮收敛裁决(2026-10-27):f1304bccfb 取对侧后,排序判据幸存位=packages/shared/src/auth/login-region-policy.ts(对席完整版,RN hook/扫码面板/根桶出口/实弹测试齐);本位 utils/login-order-policy.ts 与其 18 例测试、RN lib/login-region.ts 与其测试、utils/index.ts 转发行成孤儿,按 §0.6 撤除;extension/web 经 ui-react shim 取用,端 import 面零改动;README 指针行交后续 live-doc-edit 批 (f0768ba625)
- 🔧 Chore/Other:违禁桶兜底清扫——HEAD面等条件/待拍板未勾行自动摘除(两道机主禁令的执行器物化,留痕f12-purge;复翻席请同步摘形态,事实内容按各批结清提交保留) (a59b7af60b)
- 🔧 Chore/Other:违禁桶兜底清扫——HEAD面等条件/待拍板未勾行自动摘除(两道机主禁令的执行器物化,留痕f12-purge;复翻席请同步摘形态,事实内容按各批结清提交保留) (437f6f8833)
- 🔧 Chore/Other:撤除分叉期对席第二实现 use-extension-login-plan hook 与其 216 行测试 —— 收敛裁决(2026-10-27):L28754 扩展半格两侧各写一份,本位以 f2aa5fc69a9(与 web/RN 同一共享下沉判据)+use-extension-login-region 78 行测试为唯一实现;对席版基于下沉前旧形 region-policy.ts,合并后成孤儿(其 C 节装车断言与本位接线互斥必红),按 §0.6 单一真相源撤除;UI 登录地区判据行为零变化,判据符号 isProviderPlatformAvailable 已在 36cca68136 逐字移植入 ui-react 取用面 (bf8c40b613)
- 🚀 Feature/Improvement:移植对席 provider 可用性谓词进 ui-react 取用面 —— 收敛分叉前置(2026-10-27):origin/ad94f971901 给 region-policy 加 isProviderPlatformAvailable 并随 ui-react index 点名 export;本侧 slim 转发层须自带该符号,合并后双端 import 面才闭合。逐字节自对侧全量 blob 截取移植(纯 LF,水印 verify 通过,括号配平自检 OK) (36cca68136)
- 📚 Docs:登记短信/auth 会话线收口交接行(本机两批在飞未完税,归属席自裁) (4bedeca6d2)
- 🚀 Feature/Improvement:底部导航真背景模糊(iOS 液态玻璃) + 版本升 0.0.7 (ddd7a8ac6d)
- 🐞 Fix:UpdateNoticeCard 补载荷——门 47 HEAD 面归零的收尾一枚 (16cd09952a)
- 🐞 Fix:底部导航改液态玻璃停靠栏 —— 删掉图标行下面独立的白色透明带 (a232db2b84)
- 🚀 Feature/Improvement:阿里云通知/营销短信按用途分模板,与腾讯云映射同构 (4b2081dd79)
- 🔧 Chore/Other:违禁桶兜底清扫——HEAD面等条件/待拍板未勾行自动摘除(两道机主禁令的执行器物化,留痕f12-purge;复翻席请同步摘形态,事实内容按各批结清提交保留) (36d5e2473f)
- 📚 Docs:登录地区判据补上 RN 端接入与小程序端的平台独占说明 (0780fbe178)
- 🔧 Chore/Other:证书收紧为管理员后同步更正测试契约,并修掉两处存量红 (5714553032)
- 📚 Docs:把生产停摆那张票改写成当下状态 —— 分叉已解(0/266 可 ff)、挡 ff 的 3 枚暂存已复位(逐枚证与 origin 同值)、7 枚未跟踪同名副本已改名移出并留 MANIFEST、生产被跟踪改动现读 0;只剩环自己跑通一轮,且记下一条容易踩的账:每轮失败也按 rc=1 计入成本额度(1.19-2.35 分钟/次),所以下一次尝试约 13:49,期间 PAUSE 属预期不必人工干预;运行时 cost-caps 会随 ff 自动吃到 8/h,手工改它反而重新挡住 ff (a9a7b22743)
- 🚀 Feature/Improvement:弹窗与侧栏登录按访客来源地区分档(与 web 同一判据) (f2aa5fc69a)
- 🚀 Feature/Improvement:登录页按访客来源地区分档(国内手机验证码优先/海外邮箱优先且隐藏手机号) (0885c1c860)
- ♻️ Refactor:排序判据下沉共享层,web/RN/扩展共用同一张表 (a55b3b0fe5)
- 🐞 Fix:收口第三轮全量漏洞面 —— 匿名写面/越权/密钥外泄 12 类 (41e55558d1)
- 🐞 Fix:清掉更新提示里的死键与死 UI(写了不渲染的东西不留) (bbbbf5fa8e)
- 🐞 Fix:更新链路三处真 bug + 版本策略加固 + 服务端补发 minimumVersion (b41c252f29)
- 🐞 Fix:安装提示文案接入 i18n(此前硬编码中文,5 语言站上只有中文能看) (12c15fcd04)
- 🚀 Feature/Improvement:更新提示链路补齐与同源化(web 强更渲染端 + PWA 派发端 + RN OTA 状态机) (18d8b710ac)
- 📚 Docs:停摆票就地改写成当下真因——分叉那半已由 chore(merge) 双父提交解掉并推上 origin(合并零丢失由门 100、门 168 各自 rc=0 证明;账本按并集取主线版,采 prod 那版会违门 49 B1 因为它登记了一枚树内不存在的迁移);剩余障碍是生产目录 admin/sms/operations 下三枚未跟踪文件与主线同名不同字节,属写短信后台那一席的在飞现场,按 §12 不删不覆盖、不替谁把未验半成品入库,出路属该席(收编或挪走)此后快进立通。指针一律走内容锚点,不写短 sha(上一版被登记入口按 G-1079146 拒落,拒得对)。 (8379925d2f)
- 📚 Docs:登记两票 —— 扫码路径的协议同意缺口、登录地区判据缺一条零网络边缘腿 (2f47a4541c)

**2026-10-27**
- 🚀 Feature/Improvement:收编两批守门硬化 —— 门130 加 F13「已勾被捣回未勾」差值棘轮维;门44 拆"红/未判定"两档并把未判定变成可指认红因 (7ea94a13db)

**2026-10-27**
- 🔧 Chore/Other:第十三轮收尾落地:ZCode 凭证解密+真身套餐通道实弹闭环 & 豆包双层加密破译+签名墙语义修正。 (c28624c9fc)
- 📚 Docs:B01 Predictive Edit 结清翻勾 —— 五格全闭环:③真模型取证实跑收口(live 闸 1/1、agnes 全契约结构化动作 suggested、失败态真上游两两可分辨),①前端调用方前席已落地本席复核在位;取证事实留档(4000ms 预算封顶装不下跨境往返、LiteLLM 价目表拉取卡事件循环);回归 ai-service 89/89+live 1/1、web 11/11、web tsc 0 错、mypy 0 错 (d99a9739a7)
- 🚀 Feature/Improvement:判据层增规则③收集目录同名 —— 补测配方真落点被门认领(P/tests|test 精确同名盖 P/src|app,同包同名唯一收紧·不认 .spec.*·不做前缀),HEAD 面缺口 4042→3815(227 枚假缺口消解,新增 0);自检 33/33·镜像 6/6·autofill 37/37;runner 250 触发面罩收集目录并重封存根护栏;顺手清 lint 红(extname/LOCAL_DECL_RE 死变量) (222610b372)
- 📚 Docs:门237两新票占用核查注记 —— 门体被他席在飞改写(489+/69-)占住,本席不认领不派单,落地后重走派单面 (dcd2fe250a)
- 📚 Docs:G-02 三枚路由核对注记——①真会话复证 200/②③契约面 9 例绿,不翻勾留验收缺口 (9e2980dd4c)
- 📚 Docs:E2E 自动补测 进展注记(2026-10-27/e2e-chair)—— 判据层规则③收集目录同名落地,缺口 4042→3815,保持未勾 (7647997313)
- 🔧 Chore/Other:G-02 三枚路由契约面复核——修 g299 mock 缺口(getDispatchStats/getDag)使 9/9 绿,含 n8n 成功路径 2 例(fetch-merge-put/activate+回读) (2e5ba54feb)
- 📚 Docs:B04 两格收口合并注记落行 —— 清除器(ef8aedd)+消费面接线(87796c90)落码全绿;接线枚待远端收敛交清扫循环自愈,生产env/prod迁移属运维面维持未勾租约保留 (9549484c6b)
- 🔧 Chore/Other:重派小程序 ui-routes 派生件 —— 门105 该端自述钉 stale (743586edea)
- 📚 Docs:D16 注记读数差澄清 —— check:sdk-publish 19/19→22 的构成(本席对外承诺用例 + 前席在飞的 npm 鉴权口径 2 用例随批入库) (675c72eeb6)
- 🚀 Feature/Improvement:大屏新增「分时访问」面板 + 会话质量补「退出页 TOP」—— 页面级使用数据的时间维度与路径收尾两格 (2d7916c115)
- 📚 Docs:监控大屏与全站埋点进展注记 —— 本轮分时访问面板+退出页 TOP 两增量(不翻勾,持续优化型) (a9ccc5a80c)
- 📚 Docs:D16 发布就绪性代码面收口注记 —— retryAfterMs 限流透出/README 四段对外承诺/CHANGELOG 随包/门 22 用例,自证全绿;剩余为注册表账号与触发 tag 等仓库外动作,维持未勾 (cc3e87e5d7)
- 🚀 Feature/Improvement:D16 发布就绪性收口 —— SdkError.retryAfterMs 限流透出 + README 对外承诺四段(版本与稳定性/遥测与隐私/限流与 429/鉴权获取指引) + CHANGELOG 随包附带 + check:sdk-publish 补对外承诺用例 (1087de1d67)
- 🚀 Feature/Improvement:消费面接线 —— ai-service 工具调用经内部摄入腿落明细账(照既有服务间先例同型,失败不拖主循环) (87796c90ca)
- 📚 Docs:D16 Agent SDK 对外开放 挂牌认领(进行中@2026-10-27/d16-chair)—— 发布就绪性代码面收口在飞 (a2ec2af694)
- 🚀 Feature/Improvement:B04 明细账原文清除器装车 —— 30 天档+86D 同型纪律(dry-run/env 闸/规模闸/账行永不删) (ef8aedd7d9)
- 🐞 Fix:收尾审计三跟进 —— codearts 双源实证信封被重派误冲恢复 + 两处平台清单文案补正 (326db6ec88)
- 📚 Docs:B04 拍板注记落行 —— 保留策略两格定档(原文30天/清除器照抄86D),前席现场接管收口枚 9bb45909b3058485834fd4b00e87b921eaaf85b3,余两格未闭环(清除器落码/ai-service 消费面),行不翻勾租约保留 (231922081d)
- 📚 Docs:登记一条真工作 —— 门 44 把"红"与"未判定"混在一条输出流,归因层无红可指便落应急档(对席跳门疑问的完整因果,只清根目录消不掉这一型) (de56370b72)
- 🔧 Chore/Other:重派 web ui-routes 派生件 —— 销门105 自述钉 stale (7654d0f54a)
- 📚 Docs:O02 跨端 UI 单一源 —— InputArea 族逐档同值核对结论与本枚落地(不翻勾) (7173554aab)
- 🐞 Fix:短信群发确认词改走富文本单一源头 —— 销门249 A2 分叉 (aa3b9e5655)
- 📚 Docs:结清 L28755(生产签出双向分叉)—— 票面五前提逐条当场坍缩,本机侧已清账;并更正本席自写的一句陈旧读数 (28007acce4)

**2026-10-27**
- ♻️ Refactor:O02 跨端 UI 单一源 —— InputArea 切换钮盒边长收进共享 spec 并补跨端一致性校验 (ad9b68aefe)
- 🐞 Fix:codex 上游业务错误文案有界化 —— 销门181 PERSISTENT 命中 (1ef3fe83cc)
- 📚 Docs:结清两票 —— L28753(后台短信运营页五语 i18n,枚 071256d1df6)与 L28754(RN+浏览器扩展登录页消费共享地区排法判据,枚 ad94f971901 + 0d046a5bdaa) (55bbdc5a7d)
- 🚀 Feature/Improvement:L28753 结清 —— 后台短信运营页文案全量接入五语言(该摊此前零 i18n,门70 的 EXCLUDE_DIRS 含 admin ⇒ 机器不响,只能人工跟) (071256d1df)
- 🔧 Chore/Other:门7 依赖碎片化清偿 —— pnpm dedupe --lockfile-only 收敛 lock(31+/98-,webpack 5.91/5.109 双版本族并账),只动 lockfile 不触碰 node_modules 实态 (c9f805bddd)
- 🚀 Feature/Improvement:八平台实弹取证升级四件(实弹抓包收官轮)——loomy 源码级键名+grokbot 解封定案+minimax 端点修正+opencode 健康端点实证 (1dfacf9907)
- 🔧 Chore/Other:relay-qoder-models 族三枚补齐溯源水印(销门47 该族余量) (6508672436)
- 🚀 Feature/Improvement:B04 明细账签名导出器收口入库(接管前席现场) —— filters 补 AuditExportFilterSnapshot 形状(action/resourceType 落记录面固定词汇 tool.invoke/agent_tool_call,原生维度 toolName/sessionId/outcome 随快照进签名),导出口/签名出口/路由接线 13 例全绿 (9bb45909b3)
- 🐞 Fix:根桶补出 isProviderPlatformAvailable —— ad94f971901 漏改 index.ts 造成的干净检出破线 (bcb33ed0f7)
- 🚀 Feature/Improvement:L28754 RN 半格 —— 登录地区排法判据下沉 @ihui/shared 作跨端单源,RN 登录屏按 priorityPlatforms 重排 (0d046a5bda)
- 📚 Docs:B04 挂牌认领@2026-10-27/gb19-e1 —— 接管前席未提交的明细账导出器现场 (afc0177788)
- 🐞 Fix:门83/218 样式合规清偿 —— 社区屏/扫码屏品牌实底配对成文化(内联收编 StyleSheet 兄弟对+chip/bubble 兄弟命名对齐),hex 换 tokens(相机底 gray.black/阴影 gray.black,恒白留基线同 LoginScreen 先例),switch Neo-Brutalist 墨线描边 border-ink-exempt 注记(对齐 web 同色硬投影) (c6feb9b8db)
- 📚 Docs:生产签出分叉票本机格清账注记 —— dev 库追平 3 条迁移,B6/B7 现读绿(库 351==journal 351);票体等生产机侧收敛,行不翻勾 (b4baa622f4)
- 📚 Docs:收尾登记两枚跨端真票 —— 门 237 单侧屏清零与未判定桶收缩(数字派单前现读;只补检测形、不松判据) (f082b91f41)
- 🚀 Feature/Improvement:巡检出口选取统一走 pickProxyForAccount 并补账号级 proxyUrl 解密读 —— scheduler 新增 EgressProxyTally/resolveEgressProxy(换票/健康检查/降级恢复/临期刷新/空闲保活与转发链路同一口径,巡检日志报 proxied/direct);forwarder 聊天重试与就地刷票改 resolveAccountProxyUrl 解密读;reconcile 签到同步同改;六个测试套件补 DB 桩 execute 与代理直通 mock(83 例全绿) (8092d47a50)
- 🐞 Fix:qoder-models 三处下标取值补非空断言 —— 消 @ihui/api typecheck 的 HEAD 级红(重放) (0ac25e1b65)
- 📚 Docs:两格复量注记 —— L28754 扩展端半格已落(ad94f971901,RN 那半落点与硬约束已定位)、L28755 生产分叉票面三前提当场坍缩 (ec9be70d5f)
- 🚀 Feature/Improvement:大屏「页面使用排行」补平均停留列 —— 页面级 page_time 聚合服务 + 路由接线 + web 列 (8c2f870bef)
- 🐞 Fix:跨端页面覆盖门「跑不完」根因收口 —— 取材改批量预取,进程 spawn 千次→个位数 (23362e7aae)
- 📚 Docs:结清 D03 会话内快捷笔记 —— RN 腿 completed 直插 + cancel/interrupt 接线补齐,miniapp 平台独占豁免标注补测试锁 (f1264ed816)
- 🚀 Feature/Improvement:L28754 半格 —— 浏览器扩展登录页消费共享层按地区排登录方式判据(RN 那半未做,票不翻勾) (ad94f97190)

**2026-10-27**
- 📚 Docs:两格复量注记 —— L28754 扩展端半格已落(ad94f971901,RN 那半落点与硬约束已定位)、L28755 生产分叉票面三前提当场坍缩 (ec9be70d5f)
- 🚀 Feature/Improvement:大屏「页面使用排行」补平均停留列 —— 页面级 page_time 聚合服务 + 路由接线 + web 列 (8c2f870bef)
- 🐞 Fix:跨端页面覆盖门「跑不完」根因收口 —— 取材改批量预取,进程 spawn 千次→个位数 (23362e7aae)
- 📚 Docs:结清 D03 会话内快捷笔记 —— RN 腿 completed 直插 + cancel/interrupt 接线补齐,miniapp 平台独占豁免标注补测试锁 (f1264ed816)
- 🚀 Feature/Improvement:L28754 半格 —— 浏览器扩展登录页消费共享层按地区排登录方式判据(RN 那半未做,票不翻勾) (ad94f97190)

**2026-10-27**
- 🚀 Feature/Improvement:D03 语音笔记补齐 completed 直插与 cancel/interrupt 接线 (3bc6aa4cf2)
- 📚 Docs:守门 207 体积清偿批三 —— 3 行失效指针与空壳条目 + 批二指针整区逐字迁出(96,214 → 95,821 B) (7d2906610e)
- 🚀 Feature/Improvement:两件增强做彻底——恢复腿逐条可撤(留底+undo)+qoder 可用模型全链路;上轮被 32db9220c5 误删文件全部重入库 (51866ed6fb)
- 📚 Docs:结清 G-241 自动化结算状态机 —— 票面点名残余两格现读已在 HEAD,端上可见一格同批补齐 (87abd6556d)
- ♻️ Refactor:spec 出口面收口第二批 —— 4 个在飞 spec 的悬空出口撤除(13 枚) (3954c67f45)
- 🐞 Fix:摘除 aboutPageSections.ts 腐烂豁免条目 —— 该数据文件已在 c51a3d9da2 随端内实现一并删除(分段表由 packages/shared/src/constants/about-sections.ts 承载),而门体白名单仍登记它 ⇒ §0.7「豁免项消失同样算红」判清单腐烂,HEAD 面现读 318 枚屏 判 1 条 blocking 红(该红先于本枚存在,与任何提交内容无关 = §12e 型,只能摘条目结清,不能靠豁免) (a73226396b)
- 🔧 Chore/Other:D03 认领挂牌（d03-note-chair） (271eb479be)

**2026-10-27**
- 🐞 Fix:复原违禁桶清扫派发层 sweepBannedBuckets(被 821ce8e621 收编提交整层删除) (3e325c601d)
- 🐞 Fix:收口被整块重复的登记(F6 块级判据的修复出口) (5ae7500220)
- ♻️ Refactor:spec 出口面收口 —— 17 枚「内部专用」常量去 export + 3 组零消费出口撤除(决策并入注释) (ef383b5574)
- 🔧 Chore/Other:违禁桶兜底清扫——HEAD面等条件/待拍板未勾行自动摘除(两道机主禁令的执行器物化,留痕f12-purge;复翻席请同步摘形态,事实内容按各批结清提交保留) (21932bbc75)
- 🚀 Feature/Improvement:union-converge 新增 --take-theirs-doc 活文档整份取对侧声明式出口 (a5e77cdb94)
- 🐞 Fix:门 150/47/105 三门收口 —— chip 圆角归位 + 三文件溯源水印 + 三生成器重派(重放) (a6b495060b)
- 🐞 Fix:门 150/47/105 三门收口 —— 号池邻屏 chip 圆角归位 + 三文件溯源水印 + 三生成器重派 (e6241b229a)
- 🐞 Fix:门 150/47/105 三门收口 —— 号池邻屏 chip 圆角归位 + 三文件溯源水印 + 三生成器重派 (a9cca819be)
- 🐞 Fix:门 150/47/105 三门收口 —— 号池邻屏 chip 圆角归位 + 三文件溯源水印 + 三生成器重派 (b460558a2f)
- 🚀 Feature/Improvement:G-241 终态徽章端上可见 —— 成因→i18n 后缀/色调档映射单源落 @ihui/shared,web/RN 共享屏/RN 卡片三处消费 (c97dfc9e2a)
- 🐞 Fix:门 150/47/105 三门收口 —— 号池邻屏 chip 圆角归位 + 三文件溯源水印 + 三生成器重派 (23cc9136af)
- 🐞 Fix:门 150/47/105 三门收口 —— 号池邻屏 chip 圆角归位 + 三文件溯源水印 + 三生成器重派 (d6d0a20f89)
- 🐞 Fix:门 150/47/105 三门收口 —— 号池邻屏 chip 圆角归位 + 三文件溯源水印 + 三生成器重派 (a36faf3287)
- 🐞 Fix:门 150/47/105 三门收口 —— 号池邻屏 chip 圆角归位 + 三文件溯源水印 + 三生成器重派 (b966cb2167)
- 🐞 Fix:348 前置解药 —— 管理员行 avatar 回填撞不可变触发器 ⇒ 任何按链新建库卡在 345 (484d21186f)
- 🐞 Fix:判据硬化两处 —— ①gitGrep/faceList/faceRead/collectMiniapp 四处 catch 由折成空集记绿改为抛 Undetermined,直执行 exit 2 显式「未判定」点名原因(§0.3:取不到不冒绿);missing 文件仍返 null(合法该面没有,M3 钉住)。②collectRn 口径松已证:只筛 .tsx 混进 tests/barrel,收紧为 <Name>Screen.tsx 形态与 collectShared 同尺,headDelegatedRn 同批收紧保持 R4 两尺对称;HEAD 面实测 315 枚 .tsx 全为该形态 ⇒ 存量读数零漂移。镜像 scripts/tests/check-cross-end-screen-coverage.test.mjs 10 例全绿(正常 5+故障注入 5);门体自检 15 例 0 失败;全量现跑 RC=0 读数不漂(主席复跑) (ec7a5ef870)
- 🐞 Fix:门 150/47/105 三门收口 —— 号池邻屏 chip 圆角归位 + 三文件溯源水印 + 三生成器重派 (32db9220c5)
- 🚀 Feature/Improvement:补全站埋点覆盖缺口三件——RN/小程序末屏停留收口 + web 图标按钮 aria 兜底 (b3a373ceb4)
- 🔧 Chore/Other:pnpm dedupe 收敛 lockfile 重复版本 —— 门7 现读红(taro/webpack 族重复);-84/+20 行纯去重,门7 复跑 RC=0 (6d782ba19d)
- 📚 Docs:B04 证据级可追溯执行流水结清 —— 四要素已落库(提交 49cf56d65ad50050ac28f7130d10290241c939b8),测试现跑 14/14;签名导出沿用 siem-exporter,接本表归下一格 (260fb49701)
- 🚀 Feature/Improvement:⑦写面收口——恢复腿+搬移/隔离腿装车;qoder listModels 取证定案 (3a41d69e7e)
- 🔧 Chore/Other:结清监控大屏与全站埋点持续优化(翻勾@2026-10-27/dash-track-chair2) (57fe8255bb)
- 🚀 Feature/Improvement:跨端视觉原子 spec 覆盖率 9→11 收官(avatar 收口 + button 纳入)+ 守门 256 装车(阶段3) (fe86578df9)
- 🐞 Fix:门83 五格违规清偿 —— R3 配对前景成文化(ScanLoginScreen 行内覆写挪进 StyleSheet 兄弟对;CirclePostScreen chipTextActive→chipTextActive→chipActiveText 兄弟对;LetterChatScreen bubbleTextMine/Theirs→bubbleMineText/TheirsText+sendBtnDisabled 摘重复实底留 opacity)与 R8 描边墨档(switch.tsx border-foreground→border-border 中性描边)。判据函数直验 4 文件 R3=0 R8=0;--staged 索引面 rc=0。第 5 格(account-pool)由并行会话持索引面不代提交 (621ded3e03)
- 📚 Docs:结清 G-1200042 Knip 棘轮残余债 —— 文件腿 c51a3d9da2(2删4留裁决)+导出腿 27abd715c0(15删+8@public)全部落地,knip 面四类全降,knip-chair2 如实归并注记 (bd6b482e02)
- ♻️ Refactor:G-1200042 棘轮残余债清偿·导出腿 —— 零消费导出 15 删 + 仅测试钉住 8 枚 @public 标注 (27abd715c0)
- 📚 Docs:五枚 scope-placeholder 票按票面正文补真实落点 —— ①未闭环(生产侧部署)改归属头〔归:机主部署机面｜等:—〕出桶(行内自述本机不可复现不可修);②git-sync-converge 自指死锁/③短信运营页 i18n/④RN+扩展 loginRegion/⑤B04 执行流水四枚补〔作用域:…〕反引号点名(路径三面在位性已核:region-policy.ts 工作树缺故点目录形态);派单板现读 5 枚 scope-placeholder ⇒ 补齐后重跑 (289c403c2e)
- 🔧 Chore/Other:G-965 P2 —— 侧车强制档合并 1 条(G-1200041)+孤儿键退场 6 键(G-41/G-40/O6501/O6509/O6510/O6512,留痕 6 条入 plan-row-drop.jsonl);同批含并发席 2026-10-27 03:57 已暂存的归并记录(G-79→G-70 搬+6 键退场),本席 --apply 竞态闸验零冲突后未重写 (017a0f12d8)
- 🔧 Chore/Other:四枚 tier 基座件补溯源水印 —— 门47 HEAD 面欠账(他席旁路落地只带了无载荷 blob,工作树又无副本);本枚从 HEAD 还原→inject→带载荷落回 (1159d3d9a9)
- 📚 Docs:comments 接线复用改判 aligned;certificate/download 补「缺的是平台原语不是屏」 (d41527efaa)
- 🚀 Feature/Improvement:⑧补充——trae/trae-solo/qoder 三腿 relay:ide-switch 装车 (77368e2e65)
- 🐞 Fix:gate-failure-kind 第五档 undetermined 补落实现与执行器接线 —— 92d09b9fa27 落了 F9 镜像测试却没带 lib 的 detectUndetermined 与 guardian-executor 的分流(半套入库,§10 反面又犯);镜像 17/17 复跑全绿 (75e454f427)
- 🔧 Chore/Other:relay-ide-switch.ts 补溯源水印 blob —— 门47 HEAD 面欠账销账;工作树副本已带载荷(skip-done),本次只把带水印内容带进 HEAD (1b6467da56)
- 🚀 Feature/Improvement:号池任务中心装车(缺口④,观测面+手动触发) (6ec706ee3a)
- 🔧 Chore/Other:跨端样式对齐 阶段2 续: 校正 spec 覆盖率门口径(collapsible 重分类 EXEMPT, avatar 补 web 路径) (74da58072f)
- 🚀 Feature/Improvement:G-241 结算状态机——FSM 服务层 + migration + 单测 (a9d9ce4bbf)
- 📚 Docs:结清 访客与机器人流量上监控(全链路已落库,本地typecheck+88测试全绿,执行席指令翻勾) (eddcb58012)
- 🐞 Fix:check-gate-triggers 两处派生 git 补 windowsHide —— 门52 实测 HEAD 面红(本文件自体即违例样板);自检 9+7 例、镜像 5/5 复跑全绿 (76a026676c)
- 🚀 Feature/Improvement:补 GET /api/comments/mine 自范围面 —— 修「取错数据」一型并纠两笔假账 (d9e1d9c5f0)
- 🔧 Chore/Other:跨端样式对齐 阶段2: spec 覆盖率守门升级为棘轮(只拦退化,不拦存量) + 提交基线 (be31db2e93)
- 📚 Docs:改掉我自己注记里触发的违禁桶命中 —— 上一笔为说明"不挂账"而写下的措辞恰是无引号护栏族尺的命中词族,闸门如实拦下;改为等价不含词族表述,归属桶与勾选态零变化 (30d62b1f4e)
- 🐞 Fix:补齐 API 地址配置并同步生成物(修真机白屏) (cfca3a32a3)
- 🐞 Fix:地区判定结果进请求日志,并把 GeoIP 三枚旋钮写进声明档 (7d73d4873d)
- 🐞 Fix:补齐地区优先级的最后一格 —— 扫码子面板首位改成微信,并修三条会误报的既有断言与四处缺口 (3941f43800)
- 🐞 Fix:补齐地区优先级的最后一格 —— 扫码子面板首位改成微信,并修三条会误报的既有断言与四处缺口 (3cffc01b88)
- 🚀 Feature/Improvement:Wave3-b 补 user/sign-up —— 我的报名(课程+试卷两路聚合)gap→aligned (935ffb5c43)
- 📚 Docs:登记一张可派单票 —— 生产签出与 origin 双向分叉导致全站发布停摆(带两处落地闸拒因与处置次序) (aa9366ae0e)
- 🚀 Feature/Improvement:OTA 更新提示卡片——对齐 web PWAUpdatePrompt 样式 (8d41e83bdf)
- 📚 Docs:登记生产签出停摆的收口票 —— 真因不是分叉本身:那 5 枚本地提交的内容已被远端全覆盖(3 枚无 patch 等价物的 4 个文件里 3 个 blob 逐字同、_journal 生产侧独有 0 行),卡的是工作树 103 枚未提交的被跟踪文件(其中含运行态本地化,不该被收编也不该被复位)+ 收敛器缺一条「整份活文档取对侧」的声明式出口(--take-theirs 之后活文档行 union 仍把滞后基线形态并回结果,F1/F6 各 1 判红)。备份牌 backup/prod-divergence-20261027-fb936b9 已送本机 mirror 保局;reset --hard 被 git 自拒,那是正确行为 (e3634f5a30)
- 🐞 Fix:EAS 构建注入 EXPO_NO_METRO_WORKSPACE_ROOT=1 根治 monorepo 双重路径 (16aadf4120)
- 🔧 Chore/Other:跨端样式对齐 阶段1: Switch/Sheet 单一源 spec + 双端消费 + 守门 (94a50140b7)
- 🚀 Feature/Improvement:Wave3 首批补屏 5 条 gap 路由 —— 社区与检索(circles/post、invitations、letters、news/category、search/history) (55b7d5088c)
- 📚 Docs:把短信摊那枚票就地改写成当下状态——六件里五件已随 03f18e13a49/cfbcb019c35/8f5fc93e8ac 当场清偿(回调旋钮声明进 .env.example、tenant 按三条完整路径登记、csrf 前缀改按路径并补兄弟路径反例夹具、手机号判据收敛到 utils/phone.ts 且把两份逐字重复的归一实现收成单源、删除注释里不存在的「90 天发送记录」兜底),只剩 /admin/sms/operations 后台页零 i18n(226 行硬编码中文,门 70 排除 admin 故机器不响)——不新增行、不换勾选态、不动归属,整行改写按 §1 只留一行当前状态 (1bfc4a30c3)
- 🐞 Fix:补齐扫码登录页缺载荷的欠账(门 47 blocking,留着即下一位的恒红) (8cbdacd1b2)
- 🚀 Feature/Improvement:扫一扫空白页根因修复+抽屉扫码入口+EAS Update OTA 基建(v0.0.6) (d067c17109)
- 🐞 Fix:补齐 24 枚缺载荷文件——上一枚随批带进 HEAD 的欠账当场清偿 (8f5fc93e8a)
- 🐞 Fix:群发页原生确认窗改走仓内 useConfirm(§4 禁用原生提示窗) (cfbcb019c3)
- 🔧 Chore/Other:给登录窗补一条浏览器双臂锁——只换 loginRegion 就换整套排法 (92117762af)
- 🚀 Feature/Improvement:腾讯云短信通知/营销双通道 + 送达回执与退订合规入库 (03f18e13a4)
- 🐞 Fix:补交 geoip 的 countryCode 出口——上一枚漏了这个文件,兜底腿在真实链路上恒判不出 (5042a0acf1)
- 🔧 Chore/Other:扫码面板刷新按钮居中+图标、二维码卡片加轻阴影 (fb936b9fc3)
- 🐞 Fix:第三方按钮"未配置"提示不再借用 Google 专属文案,五语言同批补通用键 (86b7a8108d)
- 🐞 Fix:远程 GeoIP 腿加每分钟配额,并补上我漏跑的那一层类型门 (12b414993a)
- 🔧 Chore/Other:扫码面板刷新按钮居中+图标、二维码卡片加轻阴影 (495c7cc53d)
- 📚 Docs:登记一张可派单票 —— RN 与浏览器扩展登录页消费按访客 IP 的登录优先级判据 (b2fbe9ac18)
- 📚 Docs:登记「登录窗按访客 IP 地区排登录方式优先级」能力(与同批两枚 feat 一并交付) (e2ec7f3683)
- 🚀 Feature/Improvement:登录窗按地区排登录方式优先级(国内微信扫码最前,海外邮箱+Google/GitHub 最前) (0601fdb954)
- 🚀 Feature/Improvement:登录呈现地区判据落地,并随 oauth-status 下发(判不出显式返回未判定) (15e3828794)
- 🐞 Fix:登录扫码面板统一为1:1正方形根治二维码溢出裁切 (31b1a7df6b)
- 📚 Docs:把昨晚那枚在飞短信摊的清偿票从四件补到六件——另两枚是同席取证时量到的实测缺口:admin-sms.ts 自立第二份手机号正则(与 utils/phone.ts 唯一入口不同形,13x 号段进得了后台进不了公开取码端点),以及 csrf.ts/sms-callback-parse.ts 注释宣称的「90 天发送记录」兜底全仓不存在(只配 IP 白名单时腾讯共享出口内任何人可伪造退订) (8b130377ab)
- 🐞 Fix:登录扫码面板统一为1:1正方形根治二维码溢出裁切 (e267cc3b39)
- 📚 Docs:登记一枚可派单票——短信合规在飞那摊随批落地前须清偿四件(回调旋钮无处配⇒端点上线即恒 503 / tenant 公开前缀缺登记 / csrf 前缀豁免无夹具 / 新后台页零 i18n 硬编码中文 226 行);其中的登录轮转改判已单摘入 e6f75c3418b37613329d0082c276d596e9090e17,不重复占账 (3ce793747c)
- 🐞 Fix:journal 与主线逐字对齐(消解 union 合并冲突) (319358b8fd)
- 🔧 Chore/Other:journal 补登记迁移 20261027091500_default_avatar_www (74038f4502)
- 🚀 Feature/Improvement:默认头像域名收敛到 www.aizhs.top(省一次 CF 301) (85d53f1f6a)
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
