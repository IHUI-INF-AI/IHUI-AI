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
| 数据库表 | 598 | `dbTables` |
| schema 文件 | 231 | `dbSchemaFiles` |
| API 路由 | 4449 | `apiRoutes` |
| 路由文件 | 606 | `apiRouteFiles` |
| AI 服务路由 | 576 | `aiServiceRoutes` |
| WebSocket 端点 | 25 | `wsEndpoints` |
| 入库模型清单 | 118 | `llmModels` |
| 发布平台 | 38 | `publishPlatforms` |
| 端应用包 | 9 | `appPackages` |
| 共享包 | 16 | `sharedPackages` |
| CLI 命令文件 | 66 | `cliCommandFiles` |
| CLI 工具文件 | 71 | `cliToolFiles` |
| 语言 | 5 | `i18nLanguages` |
| i18n 作用域 | 7 | `i18nScopes` |
| 语言包 JSON | 35 | `i18nMessageFiles` |
| 测试文件 | 2968 | `testFiles` |
| CI 工作流 | 49 | `ciWorkflows` |
| Compose 服务 | 14 | `composeServices` |
| 工程守门 | 260 | `guardianGates` |
| — blocking | 236 | `guardianBlocking` |
| — warn | 27 | `guardianWarn` |
| 跟踪文件 | 15179 | `trackedFiles` |

上表由 `node scripts/gen-doc-numbers.mjs --markdown` 生成,最后核对日期 2026-10-20。
每个数的来源就写在取数键旁边的实现里(`scripts/gen-doc-numbers.mjs` 的 `SOURCES`),**不得手抄、不得另立第二份**。

<!-- END GENERATED NUMBERS -->


## Recent updates (auto-maintained)

<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->
**2026-10-20**
- ⚡ Perf:页头字标换成真矢量,1.18MB -> 42KB(两版各减 96%) (c079c6d705b)
- 📚 Docs:文档层洗掉已退役看板程序名(README×3 + docs 29 份,128 处) (8c1e72e10b1)
- ♻️ Refactor:自有 env 键 GRAFANA_* → BOARD_*(含 saas 编排/gen-secrets/示例) (b17056a4ed9)
- 📚 Docs:门名索引跟着 panel 系改名(修 R4:新门名在文档里看不见) (bb5c9acbef9)
- ♻️ Refactor:看板器物改名落库(panel 系;门 220/222 的悬空引用一并解掉) (a7ced7411ca)
- ⚡ Perf:语言包改为按需加载,首屏不再带 5 种语言 (5dba888279d)

**2026-10-20**
- 🐞 Fix:Sidebar 补回 useNavVisibilityFilter 的 import,解部署环 TS2304 冻结 (9451f3378d0)
- 🐞 Fix:根治原生适配器绕过并发闸 + GBK 丢日志 + 流式错误无溯源 (72dc9299846)

**2026-10-20**
- 🐞 Fix:SSO 授权误报登录失效——会话失效改由后端 Bearer 裁定 (1dd7392401a)
- 🚀 Feature/Improvement:新守门 check-board-name-legacy.mjs 接进提交链 (60d3b6a55ff)
- 🐞 Fix:剔除侧边栏提交误带的 contentHub/eduHub/tradeHub 孤儿键 (59e15ae4b0b)
- ⚡ Perf:页头 logo 只下载当前主题那一枚,首屏少下 1.18MB (ca29364f932)
- 🐞 Fix:LLM 上游失败补 warning 日志 + 修 orchestration 读端旧格式用例 (b7815962c3d)
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
- 📚 Docs:L14361 G-811 图源池 —— 三格逐格现读均为已落地态,翻勾并留终态取证(零生产代码改动) (512b4bf1561)
- 📚 Docs:协议通道②/③ 与 VideoPlayerScreen 两行按完成即删摘除(翻勾已落 5392c69cc964db7ffbae5203dd8743dc37cec45e,本枚只删行) (db01b6fffca)
- 📚 Docs:G-621 现读更正 —— 票面点名的现场形状已不复现,仍开的只剩最后那一格通用缝隙 (791e2e664ae)
- 📚 Docs:L29247 传输层单点化 —— 翻勾并留终态取证(代码已为落地态) (8c68744302b)
- 📚 Docs:G-29 现读口径纠偏 + 两端收集存量现读追加 (4962b1ce2f7)
- 🐞 Fix:miniapp 验证码弹窗标题与 RN 对齐「请输入验证码」(verify.getCode 五语值纠偏) (5c00ad26050)

**2026-10-19**
- 🐞 Fix:受检形态必须等于该端真实跑法 —— 派生 vitest 时不再丢掉 test script 的旗标(实测 31 条用例假红) (66cfdd0d19a)
- 📚 Docs:协议通道②/③ 与 VideoPlayerScreen 两行翻勾(仓库侧内容已全部入库;剩余是环境前提,写在本枚信息与两行注记里交后手) (5392c69cc96)
- 🔧 Chore/Other:三枚套件收集期即炸 ⇒ 端内 93 条用例从未执行 —— vi.mock 改 partial-mock(importOriginal 形态),不再手抄闭集出口表 (dc41de3bb57)
- 🐞 Fix:disable xinference local provider probe by default (53597943dc7)
- 🔧 Chore/Other:门128 基线入账 VerifyCodeModal 族(counts 3 / radiusCounts 0 / elementRadiusCounts 0) (108d1fe6434)
- 🐞 Fix:门 105 四端 ui-routes 派生产物第三次对齐 —— 并发会话连续改小程序与 web 侧页面源文件,产物自述钉与 head 面现算持续不等;重生成前已验全部输入源的工作树与 HEAD 逐字一致(工作树干净),故产物钉住的是 HEAD 面的源 (cf46bb2a8ef)
- 📚 Docs:协议通道②/③与 VideoPlayerScreen 两行就地补现状与出路(逐字原文保留,只追加行尾注记) (1ef9ebdb469)
- ♻️ Refactor:VerifyCodeModal 收进共享单一源 verify-code-modal-spec(门128唯一判红族) (4c0dbc10212)
- 📚 Docs:登记 RN↔web 能力对齐收口轮的守门收口(③)并订正两处过时表述 —— 标题由「本轮未入库」改为已入库 14 枚;①里「单测直接 import web 的 SLASH_COMMAND_IDS」订正为「直接 import 共享层 @ihui/shared/chat/slash-command-ids」(端→端 import 边违反架构契约 D1,门 103 判红,已下沉共享层消解);③ 记本轮 8 道恒红门的逐条处置与唯一未消项(门 184 系并发会话在飞删除 desktop 构建脚本的中间态) (f439d089fdf)
- ♻️ Refactor:SquareScreen / PlazaScreen 两处共享类型重声明改为 import 共享层 (3ead65aee50)
- 🐞 Fix:门 105 小程序端 ui-routes 派生产物再对齐 —— 并发会话在本席上一枚落库后又改了 apps/miniapp-taro/src/components/DrawerComponent.tsx,产物自述钉遂与 head 面现算不等;重生成前已验全部输入源的工作树与 HEAD 逐字一致(工作树干净),故产物钉住的是 HEAD 面的源 (00960fa854c)
- 🐞 Fix:sso 隧道源站 8543→8850(端口铁律,注册表+docs §2.7 双向登记) (b2503baa8ee)

**2026-10-20**
- 🐞 Fix:监控大屏(panels)适配明暗主题,移除写死蓝黑配色 (790f669fbc3)

**2026-10-20**
- 🐞 Fix:orchestration_hub 事件改为单键 JSON 写入 Redis 流 (6048e094485)

**2026-10-19**
- 🐞 Fix:disable xinference local provider probe by default (afd853023e9)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a6291841552)
- 📚 Docs:结清 D113 流式 diff 实时预览(复验+回归绿) (79c54edbd64)
- 🐞 Fix:--staged 归属判据改差值棘轮(锚 HEAD),解除全场提交被迫跳门的恒红 (18eb57d63de)
- 📚 Docs:结清两条 P0 技能市场授权缺陷(复验+回归绿) (5b52770931d)
- 📚 Docs:守门 207 体积瘦身 —— §1「重复登记副本」两行历史叙述整区搬入归档件(逐字原文,原位置留一行压缩条款,规则内核一字未减),另删一处与文首逐字重复的压缩版说明行;载荷行逐字未变、零宽字符总数未变(脚本自证) (8b05e0e2f5b)
- 🐞 Fix:sso 隧道源站 8543→8850(端口铁律,注册表+docs §2.7 双向登记) (3b5fa476169)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a969d2a5aa1)
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
- 🐞 Fix:守门 8 修两处判据盲区 + BP 腿基线下调到 15 (c1afcfc8ce0)
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

**2026-10-19**
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
