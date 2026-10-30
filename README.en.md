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
| 数据库表 | 612 | `dbTables` |
| schema 文件 | 237 | `dbSchemaFiles` |
| API 路由 | 4617 | `apiRoutes` |
| 路由文件 | 651 | `apiRouteFiles` |
| AI 服务路由 | 617 | `aiServiceRoutes` |
| AI 服务路由 | 615 | `aiServiceRoutes` |
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
| 测试文件 | 3608 | `testFiles` |
| CI 工作流 | 51 | `ciWorkflows` |
| Compose 服务 | 14 | `composeServices` |
| 工程守门 | 299 | `guardianGates` |
| — blocking | 273 | `guardianBlocking` |
| — warn | 28 | `guardianWarn` |
| 跟踪文件 | 17709 | `trackedFiles` |
| 测试文件 | 3612 | `testFiles` |
| CI 工作流 | 50 | `ciWorkflows` |
| 工程守门 | 301 | `guardianGates` |
| — blocking | 275 | `guardianBlocking` |
| 跟踪文件 | 17707 | `trackedFiles` |

上表由 `node scripts/gen-doc-numbers.mjs --markdown` 生成,最后核对日期 2026-10-30。
每个数的来源就写在取数键旁边的实现里(`scripts/gen-doc-numbers.mjs` 的 `SOURCES`),**不得手抄、不得另立第二份**。

<!-- END GENERATED NUMBERS -->


## Recent updates (auto-maintained)

<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->
**2026-10-30**
- 🐞 Fix:check-prod-checkout-foreign-work 装未知旗标闸 + 15 例镜像补齐（RP-79 第二枚落地件） (51b66c3a61)
- 🔧 Chore/Other:收口本地积压（hook-window-guard/check-ops-patrol/deploy-decisions-face 改进 + 新 prod-checkout-root + desktop checkin_capture + i18n 派生重生成） (21b66ff087)
- 🐞 Fix:资讯分类屏按共享屏真实契约接回，此前整屏恒空 (67234f694d)
- ⚡ Perf:face-reader 规格快路径 + git-sync-converge 未知旗闸；收口本地积压 (d6db2333fe)
- 🐞 Fix:补回被误删的 localMonthKey/localDayKey —— miniapp 首页 import 悬空,push 门 typecheck 恒红 (26e62feeee)
- 🐞 Fix:买 VIP 不再被当成 token 充值白送余额 (1484b7bd9d)
- 📚 Docs:登记 RP 族第三票——git-sync-converge 无 --help，未知旗标被当默认动作直接开跑真实索引层收敛（本日实测踩中并留下 16 项中间态，已 reset 清零且证明未进提交）；连同 union-converge 同族一并改为未知旗标显式拒绝并补镜像锁；只加一行不动他票 (5ea3ccc628)
- 📚 Docs:登记 RP 族第二票——AGENTS §5b gitdir 形态描述与实测相反（真 gitdir = 工作区外 D:/IHUI-AI-git-repo，现读 .git 为 gitfile），照旧文处置即删库事故；并硬记门 207 余量仅 51 字节 ⇒ 本枚须等长/净减改法；只加一行不动他票 (663b83881e)
- 🔧 Chore/Other:落地本地未提交改动（Tauri 桌面端 + 文档重生成 + i18n 派生 + face-reader 超时可配） (33deba819e)

**2026-10-30**
- 🐞 Fix:prodCheckoutRoot 装"形态并集回落 + 显式 IHUI_DEVENV_ROOT 不越权"，线上态两条 oracle 不再恒未判定 (e7e35d307da)
- 🚀 Feature/Improvement:补 mobile-rn 提现两步验证文案（五语） (4de978b0e49)
- 🚀 Feature/Improvement:提现补两步验证面板（TOTP 注入后自动重试提现） (24a35d957e4)
- 🚀 Feature/Improvement:提现补两步验证面板（TOTP 注入后自动重试提现） (c46a2c8d8d5)
- 🐞 Fix:支付页选券真正落到订单上，余额支付错误不再被兜底文案盖掉 (ff89366a896)
- 🚀 Feature/Improvement:补小程序支付链三个缺失端点（可用券／选券改价／余额支付） (4c51d614ee4)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d920a4dec0c)
- 📚 Docs:登记 RP 族新票——生产 checkout 根形态遮蔽的另两处收口（deploy-decisions-face prod 候选 / check-prod-checkout-foreign-work 通道 C）；病根已由本日 prodCheckoutRoot 并集回落+覆盖不越权那枚钉死并装上 8 例镜像锁，此票只收口另两处（切生产面读法须与接线方同批验）；G 族短位池 SCAN_FACE_FULL ⇒ 按族表已开的 RP 族取号，只加一行不动他票 (02b2a784bcf)
- 🐞 Fix:修复 leading-none 被 --spacing-none 覆盖成 0px 致大字号读数重叠 (207e9769027)
- 🐞 Fix:看门狗重放间隔收回 6h —— 重放是"先删后加",缩短间隔等于加曝光窗 (06a8630c648)
- 🚀 Feature/Improvement:主机审计基线落盘(4688+命令行+脚本块日志)并接入看门狗同轮重放 (2d0f19b33d8)

**2026-10-30**
- 🐞 Fix:新登录的 Qoder/Trae 号自动进号池 —— 回灌 missing 支改自动 importAccounts (3528b93ac14)
- 🐞 Fix:小程序买课恒报「余额不足」—— 读的是一张没有任何入账的孤儿表 (e6720f4104b)
- 🐞 Fix:边界的唯一自愈层迁出产物目录 —— 看门狗与加固脚本进版本管理 (8d0a2d4e129)
- 🐞 Fix:钱包全套把「分」当「元」—— 余额多两位、提现少两位、到账永远空白 (4586eeb8aa1)
- 🐞 Fix:查词失败整条静默 —— 弹层出失败态并给重试入口 (cf1450635a9)
- 🚀 Feature/Improvement:扩展查词失败态与重试按钮文案（五语言） (3c52c2dd15d)
- 🐞 Fix:两屏选中态前景键仍是错序名 —— 全量 typecheck 红在 push 面,谁都推不动 (0ae18b9b93a)
- 🐞 Fix:支付页四格全空 + 课程购买重复扣款 + 订单金额放大 100 倍 (58c4c4a0d00)
- 🐞 Fix:登出即失效 + 微信回调防重放 + 按用户限流,并把三项行为钉进测试 (5efcd846aa0)
- 🐞 Fix:十屏把后端原因压成一句「加载失败」—— 全部透出 res.error (9f7a4e381ff)
- 🐞 Fix:门 26 从卡死 40 分钟变 1 秒 —— 排除 §15b 批准落点 + 加枚举预算 (3f9ee883631)

**2026-10-30**
- 🐞 Fix:活动详情加载失败只显示通用文案 —— 透出后端可行动的原因 (e00da95782d)
- 🐞 Fix:开发者页「今日成本」按 UTC 日取数 —— 北京时间早上 8 点前显示的是昨天那一窗口 (abfc6f2b7fe)
- 🐞 Fix:埋点 visitDate 取 UTC 日 —— 北京时间 0–8 点的访问被记到前一天 (9c383483d78)
- 🐞 Fix:管理端"今天/近 7 天"按 UTC 日算 —— 早上 8 点前整片统计错一天;并把业务日收成单一源 (113794c70c8)
- 🐞 Fix:支付页在没有订单号时按钮仍可点、页面照常渲染 —— 点了才得到一句「订单异常」 (a44bd304eb0)
- 🐞 Fix:佣金日/月汇总按库会话时区截日 —— 未显式写 +08,换到 UTC 会话的库会整体偏一天 (1b08566e175)

**2026-10-30**
- 🐞 Fix:课程购买把订单号当 orderId 传给支付页,而支付页只认 orderNo —— 点「立即购买」永远付不了 (c1418894a80)
- 🐞 Fix:活动详情不返回"我是否已报名" —— 已报名用户永远只看到「立即报名」，取消入口不可达 (13db09d57c7)
- 🐞 Fix:树选择器选中后焦点掉到页面顶部 —— 交还触发按钮 (775a9a35199)
- 🐞 Fix:消息页只取前 10 条且没有"加载更多" —— 第 11 条起用户以为不存在 (953d50871fc)
- 🐞 Fix:学习周报的 7 天键用 UTC 日、而 SQL 分组按 +08 —— 北京时间 0–8 点的时长恒落在错位的那一格 (3cbd845b038)
- 🐞 Fix:多端缺陷修复、i18n/派生产物重生成与新增测试/守卫/SDK (72769534b63)
- 🐞 Fix:考勤页按 UTC 切日(北京 0–8 点查到昨天)、今日收益按设备本地日算而服务端按 +08 (4de862f3415)
- 🐞 Fix:课程页学习进度被写死 35% —— 进度环、"已看课时/当前课时"与统计全是编的 (f49fc717b62)

**2026-10-30**
- 🐞 Fix:树选择器的节点键盘与读屏都到不了 —— 补可聚焦与选用键位 (79a6235cd43)
- 🐞 Fix:取面超时不再冒充"判红" —— 两门补 try/catch,统一走 exit 2 未判定 (5bf00f08c73)
- 🐞 Fix:trace onError 补 method/url + 补 AGENTS.md 里唯一漏点名的只读尺子(消 R4 存量红) (5b7dcb5e405)
- 🐞 Fix:设置页"消息通知"开关只写本机、全仓无人读 —— 用户以为关了推送,服务端照推 (612ffd55800)
- 🐞 Fix:设置页三个通知开关拨完只改内存(离开即复位);日志查看器不足折叠阈值时仍是可点按钮 (b88da069e86)
- 🐞 Fix:代理失败把上游原文(整屏 HTML/内部 JSON)直接显示到侧栏提示条 (2c7a1c41904)
- 📚 Docs:AGENTS.md 体积清偿(110428→94887)+ 安全文档对齐代码现状 (9b7a3f476a2)
- 🐞 Fix:代理失败把上游原文(整屏 HTML/内部 JSON)直接显示到侧栏提示条 (0a6a1168c33)
- 🐞 Fix:四页下拉刷新只转圈不刷新 —— 关掉没有处理函数的开关 (4393200ed47)
- 🐞 Fix:课程页签到/评价/笔记只弹"成功"、一个请求都不发(笔记会丢用户输入) (8396a002da8)
- 🐞 Fix:托盘「检查更新」可能整场无反应;树选择器缺展开语义且禁用后面板仍可点 (acff087465b)
- 🐞 Fix:相册权限被拒时三屏点了没反应 —— 缺权限前置判断 (272361f262c)
- 🐞 Fix:消息页「赞」「收藏」两个分类永远只显示技术错误 —— 请求了一个后端不存在的类型 (2e8d0827934)
- 🐞 Fix:修 next build 的 CSS 解析失败(0x1A)—— 把构建产物目录移出 Tailwind 扫描面 (5de6f58c2f0)
- 🐞 Fix:交卷后成绩页五项读数全 0、题目回顾空白;优惠券切 tab 双请求互相竞速 (a9d80ed0c18)
- 🐞 Fix:"我的"页四张入口卡与收藏夹前三条全是死链,消息中心"互动"tab 还在显示编造的演示消息 (7fac7d5205a)
- 🐞 Fix:"我的"页四张入口卡与收藏夹前三条全是死链,点了毫无反应 (7b2c7e8be5b)
- 📚 Docs:存续哨兵入档,并消除我自己造出的 §10.9 撞号 (1724d77d3e1)
- 🐞 Fix:侧栏闲置后 access token 不再自动续期 —— 续期闹钟的监听随服务工作线程回收而消失 (e3927a3c768)
- 🐞 Fix:复活 ApiSlowResponse —— 指标名少一个 _ms,这条告警结构上永不触发 (f6d7dbd58d8)
- 🐞 Fix:日历拖拽改期会静默吞掉发布时刻,时间格式又写死中文档 (9a821a58230)
- 🐞 Fix:发布分组展开会显示上一组的成员,误点即删错账号;保存中弹层三条出路被同时锁死 (9ce8ae4c599)
- 🐞 Fix:PDF 首片空白、直播黑屏永久转圈、上传整批被一个超限文件带崩、发布插图被回吞 (3961c9390e7)
- 🚀 Feature/Improvement:给源站回源鉴权装存续哨兵(只读尺子 + 巡检派发腿) (e6cd4ca32f6)
- 🐞 Fix:兜底闸 enforce 误拦 18 条公开面 —— 逐条按语义补名单(P0) (70d2bba8ebe)
- 🐞 Fix:上传"取消/移除"是假的、后台数值留空被写成 0、两处失败静默,外加全站气泡箭头被裁 (1c771ee4fdd)
- 🐞 Fix:WS 客户端 baseUrl 统一走 resolveWsApiBaseUrl,修生产同源 WS 无限重连 (f071844acd5)
- 🐞 Fix:反馈入口全端死路、订单切 tab 读旧筛选、支付可连点、发布失败静默 (7b95329ba0f)
- 🐞 Fix:订单列表首帧整页崩、账号注销 0% 可用、支付记录开出 0 元单等五处 (72d17ce94d6)
- 🐞 Fix:买课/交卷/提问/报名四处与后端请求契约错配,外加两处造出假红的工具面 (1ae7d3bd0c6)

**2026-10-30**
- 🐞 Fix:反馈入口全端死路、订单切 tab 读旧筛选、支付可连点、发布失败静默 (7b95329ba0f)
- 🐞 Fix:订单列表首帧整页崩、账号注销 0% 可用、支付记录开出 0 元单等五处 (72d17ce94d6)
- 🐞 Fix:买课/交卷/提问/报名四处与后端请求契约错配,外加两处造出假红的工具面 (1ae7d3bd0c6)

**2026-10-30**
- 🚀 Feature/Improvement:移动端订单详情补三条文案(五语言同批) —— 破坏性动作要能问、失败要能喊 (738b4492d56)
- 🐞 Fix:提现页接上真实校验原因与余额上限,会话历史搜索改走服务端 (3e505b8b8f2)
- 🚀 Feature/Improvement:提现页补四条校验原因文案(五语言同批) —— 报错不得再只写字段名 (aeef0ecc26e)
- 🐞 Fix:深度排查前端缺陷第二批 —— 注销/2FA 关闭补请求体,富文本三连,失败不再冒充空态 (f0a0ffa77b8)
- 🔧 Chore/Other:移除 knowledge 鉴权里的推断性注释(500 已定位为生产副本未更新) (82fe24c50f4)
- 🔧 Chore/Other:对齐 TOTP 默认档钉子到 enforce —— 修一条已入库的红测试 (20bf9852703)
- 🐞 Fix:服务清单器三处裸 $n 内插根修(RegistryKey.ToString() 返 HKEY_LOCAL_MACHINE 全串⇒真服务全 continue,修前 exit 0 而 services:[])+§0.3「枚举到0个⇒exit 2 未判定」硬闸(T| 分三种0)+生产者形状锁 bareRegistryVarHits;自检 20/20 含改回必翻红成对对照;本机现读 3 枚在册服务零入库真相源,反向 8 枚仓内点名本机不存在 (13c78b14fc2)
- 🐞 Fix:登记表 4 条抢键条目 rn 置 null —— 撞键 5 组收到 1 组,3 个路由名改回真渲染者的页 (b608ba35c3c)
- 📚 Docs:补回上一枚被 bash 命令替换吞掉的门名(守门133 check-i18n-locale-content-language)——反引号串在双引号里被当命令执行,文件名成空 (892b1ff31f6)
- 📚 Docs:更正 §19 假陈述——CJK三族互判与同名自套两层"现无门/人工必查"不成立,守门133 check-i18n-locale-content-language 已 blocking 装车(runner:3737);依 g34-s6 一手读数 (41a0dcebb42)
- 🐞 Fix:结清 G-37 三件事(35枚JSON parse全OK+四道i18n门全绿+CJK互判/同名自套真命中0;133已装车判这两型;看门狗与构建指纹双向消费均在HEAD)——同行清除F11禁桶措辞 (dbb46a7792f)
- 📚 Docs:把 SDK 票漂开版的两个独有记号折进当下行(G-23 与释放注记) —— 为归并做零丢失前置 (55877ff48d9)
- 🐞 Fix:结清G-16(别名+类臂两维已落地)/G-14(svc run脚本已入库+E1真装audit)/G-07(清偿器落地前自查已接)/Esc层栈协议5份副本(单实现+50消费方+23用例+CI 692通过) (d6a4f00558e)
- 📚 Docs:给24枚占位符作用域票补出真实落点(只搬票面正文已点名、但未加反引号且在HEAD存在的路径,零编造)⇒ 派单器可对它们发互斥合格证;勾选/租约/归属三维逐行不变 (93e0ae4653b)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (d2269d7feab)
- 🚀 Feature/Improvement:hook-failed 帧契约 + api-client 解析 + store 落桶(G-87 补链,端侧半) (f41cdcad580)
- 🔧 Chore/Other:块级窗口判据主文件 prettier 格式对齐(语义零变化) (f745178ed83)
- 🔧 Chore/Other:test (eb848ead6b8)
- 🔧 Chore/Other:b76-15 三文件 prettier 格式对齐(语义零变化) (be7ba525d55)
- ♻️ Refactor:孤儿护栏一接一退 —— check-immutable-guard 补 --audit-new(每枚判恰好一次,六态封闭)由 git-guardian 旁路派发(5min 节流/breach 才到人,不挂提交链不堵门);check-guardrail-hashes 退役(与 root-guard 同三目标同机制、基线件从未入库致 --verify 恒 exit 2,接线即 §0.6 重复实现装上车) (b2c05e4493a)
- 🐞 Fix:gen-rn-compat --write 重写 route-map 时 100% exit 2 根修(共享树瞬时句柄争用 errno -4094 不重试且把原因截成命令本身)⇒ 走 lib/atomic-write 唯一出口+退避重试+回读自证 payloadIntact+stderr/errno 点名;镜像 N1-N5,15/15 (b4bb4d01d70)
- 🔧 Chore/Other:路由表随登记面重生成 + RN 测试替身收两处局部复刻 + 硬编码中文基线下调一枚 (3b76e9adf5b)
- 🐞 Fix:有意还原被 9fdbc207ba 当残件删、6d0dbde7c9 只带回消费行的门234纪元声明面 ⇒ --staged/--worktree 不再 ReferenceError(此前 blocking 门在 pre-commit 面等于不存在);恢复 A1 身份维+孤儿 identity 形参接回 judge;侧车签名折算按取证收掉(接回即造 rotn=17 假阳恒红);回归锁:真跑 --staged + 变异反证,镜像 17/17、自检 26/0 (d17a1f6c74f)
- 🐞 Fix:前向重放首页收口那一刀 —— 它被 ffbe506f9e 的整文件重放抹掉,商品族堆叠在 main 上已复活 (e118488e7a0)

**2026-10-29**
- 🚀 Feature/Improvement:「已 accepted 未投影」账本 + 空响应权威答案兜底 (02bdf74496f)
- 🐞 Fix:结清11枚已实现票(告警去重身份/票60多窗格/G-878原生弹窗/D11语音barge-in/G-1222556 CSRF形状/成本熔断/影响面隔离/进化回流/监控大屏/O68就绪门 等,g33 t2t3逐条一手凭据) (e7f79cf7aef)
- 🚀 Feature/Improvement:帧水位事实上报的端内唯一消费点接线(对标 Qoder 借鉴清单第 6 项) (fc66ffaf0d7)
- 🔧 Chore/Other:侧车经三条官方出口整份重建(258→155行):--dedupe 60条同键多份→--retire-orphans 43键退场(28条逐字留痕)→--reclassify G-115改归机主git收敛面;rot 58→40/conflict 40→0/dup 6→0/blind 5→0;非手改jsonl,逐行处置见 g33-s10 报告 (68029830b1b)
- 🐞 Fix:登记表 17 处 rn 错写批量回正 + 补一条两代屏共用映射 —— 小程序 15 个路由名从"点了不动"变可达 (5aebbb02a83)
- 🐞 Fix:结清不可变护栏(root-guard已fail-closed接部署环)/B02(双轴+review+sse契约四落点齐) (86bb156b212)
- 🐞 Fix:结清 B03(双轴类型+consumers+守门68对账齐)/G-965(投影与强制档均已落,门234已blocking) (7d8ec7325f4)
- 🐞 Fix:结清四票(207第二刀declaredDropCaps已接/G-1222558四格已达成/68-RN腿三函数同值/圆角基线前提腐烂) (eb87981ee5e)
- 🚀 Feature/Improvement:帧水位接成有生产点的完整腿 + 静态长文档块级虚拟化（对标 Qoder §2 / §6.6） (efcb3c85735)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (f72df75e510)
- 📚 Docs:摘除 SDK 票同题跨号重复登记副本(代裁) —— 它正挡着全仓推送收敛 (afeb6ed2988)
- 🚀 Feature/Improvement:补 ai.pane.hookFailures 五语言词包(38 键 x 5) (ffdf6e88079)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (888be1ba64a)
- 🔧 Chore/Other:重封 root-guard 清单到已入库的 guardian-runner 内容 —— 三处签出的部署环此前全部 fail-closed (58f51477c1f)
- 🚀 Feature/Improvement:补 ai.pane.hookFailures 五语言词包(38 键 x 5) (40206d8ec6b)
- 🐞 Fix:装悬空提交备份腿到弃落出口(四台落地器共用一份 lib)—— 门 30a 存量从此有排水口 (4468747144b)
- 🐞 Fix:折叠漂开副本族(N→1,认领合并到保留行 + 逐字留痕;--fold-drifted-families) (cd90c6ea1d0)
- 🚀 Feature/Improvement:视频卡片补齐 分享/复制链接/下载 三个动作 —— 对话框内媒体产物可带走 (06b0c509188)
- 🐞 Fix:注册页倒计时改走取词 —— 此前 en/ja/ko/zh-TW 用户看到的是"12秒后重新获取" (7a25781c112)
- 🐞 Fix:结清 G-706 —— apps/cli/src/worktree.ts:570-576 已用 mkdir EEXIST 当原子互斥(不做 existsSync 预检关 TOCTOU),marker 齐备 reused:true、不齐证明不了即保留不删 (5bfdae44b73)
- 🚀 Feature/Improvement:对标 Qoder 借鉴清单第 9/10 项 —— 准入回执配对(inputId)+ 命名错误码分类处置 (ef471e56a9e)
- 🐞 Fix:补齐端内在用而词包查无的 8 枚键 —— 这些界面在非中文语种下一直出中文 (fe13f15ab80)
- 🚀 Feature/Improvement:跨端生成器对同 rn 撞键出声 —— 静默后写覆盖从此可见 (6e712dc3ef8)
- 🐞 Fix:幻影漂移对齐补"活工作二审"—— 恢复历史内容不再被当陈旧副本回滚 (aac2e1af870)
- 🚀 Feature/Improvement:hook 执行失败六态卡接车（数据面待接） (fe687a03820)
- 🐞 Fix:回补误摘的 G-322 行(该票未完成:旗标单源已接的 11 文件已满探针,另 77 站待迁) (ab52c91d87f)
- 🐞 Fix:结清 O01(对照面空判未判定)/G-79(38枚红现读全绿)/G-927(票面9枚已清零,新增21枚另记) (a079c9d7c46)
- 🐞 Fix:check-task-claims --twins 对照集为空时落「未判定」exit 2(不再把"没得比"报成已清零)+ twinsFace 键 + T26/T26b (7406e957481)
- 🔧 Chore/Other:清两族存量测试红 —— skills-market 的 mock 层错位 + 块合并用例沿用旧判据 (65654e57cd6)
- 🚀 Feature/Improvement:语义折叠策略 + 工具摘要计数上屏(对标 Qoder 借鉴清单第 4 项) (66cf1b45b27)
- 🔧 Chore/Other:补齐 plan-fields-project --emit 坏值探针(11/11 全覆盖) + G-79 38 枚红逐条复检取证(现读 514/515 绿,唯一失败不在票面) (b8949cf8d75)
- 📚 Docs:供应商名单补 xai —— 名单项数与计数 18 长期不符,补上后自洽 (3d2895666d2)
- 🐞 Fix:前向修复 9fdbc207ba 整树收编事故 —— 恢复两条被删能力 + 收口 19 处裸 create_task (cd5339a7607)
- 🐞 Fix:结清五票(G-926 ignored雷区已清零/D42046审批重放A档已落/monitor面板/O87g守门8/上游模型双写对账) (eb28653c902)
- 🔧 Chore/Other:补 @ihui/shared 子路径别名与替身出口 —— 六枚套件从账面通过变真跑出用例 (f1560a322ec)
- 🚀 Feature/Improvement:上游模型登记器与 workbuddy 同步器双向归属对账(跨路径 provider 抽取 + assertOwnership 前置守卫 + 只读 --check) (cdef20f80d3)
- 🚀 Feature/Improvement:三处「造好没装车」接上生产渲染路径 (15cd3b6eb32)
- 🔧 Chore/Other:摘除两枚误入库的工具会话导出附件(1.8MB,含凭据行;工具产物不入库,盘上副本保留) (34036e6a83d)
- 🚀 Feature/Improvement:十态轮次状态徽章接线 + 错误码目录首次进屏幕 (651cb924c0b)
- 🐞 Fix:结清 45 枚前提腐烂/已实现票(批3/3,g30 七席只读分诊逐条一手证据) (2d2bceb2c2a)
- 🐞 Fix:重生成小程序路由表 —— 商店跳板回正,并补出 Home/HomeMain (b439ca6e69d)
- 🐞 Fix:结清 46 枚前提腐烂/已实现票(批2/3,g30 七席只读分诊逐条一手证据) (13b4f3b3603)
- 🐞 Fix:结清 46 枚前提腐烂/已实现票(批1/3,g30 七席只读分诊逐条一手证据) (900afc860c4)
- 🐞 Fix:小程序路由表把「AI 应用商店」错指到首页镜像壳 —— 登记表 rn 撞号根治一枚 (8fa01c3233d)
- 🚀 Feature/Improvement:中文全角括号 autolink 修正 + Diff 过期诚实说明 (3f9d52d6443)
- 🐞 Fix:副本归并器物有意还原 1fe3a2b42d 对 plan-copy-row-purge 的 -790 行回退(④c 判据层,HEAD 测试 SyntaxError)+ 接线 21/21;修正 s12 测试件重复函数名 (65f63112c2d)
- 🚀 Feature/Improvement:中文全角括号 autolink 修正 + Diff 过期诚实说明 (d9aa4637b22)
- 🔧 Chore/Other:更正跨端对账基线里 IntelligentAssistant 豁免的叙述 —— 生产调用方 4 枚减为 3 枚 (48c9c5545ad)
- 🔧 Chore/Other:摘 home.recommendCourses 五语言 —— 首页横向推荐列表已下线,键随之零消费者 (0c935a0192f)
- 🐞 Fix:取消信号穿进 hook 调用点 —— 有意还原 9fdbc207ba 当残件删掉的两处 _wait_interruptible 包裹(969d74b9a6..HEAD 对该文件仅 9/32 行差异,已逐行核对) (8a8ff1f65fe)

**2026-10-29**
- 📚 Docs:鉴权兜底闸已切 enforce，补记 12 条裸奔发现与蓝绿踩坑 (6df1c8efdc3)
- 🐞 Fix:enforce 档抓出的两条合法公开面补进名单(app-version / news) (1a55dab48d6)
- 🐞 Fix:删除 relay-account-pool-worker 重复的 runTraeSessionSync 导出 (8176b5c52a6)
- 🐞 Fix:兜底闸不得二次 send —— 修 /api/knowledge 匿名访问 500 而非 401 (83359d53964)
- 🐞 Fix:补全鉴权兜底的公开名单并给 enforce 档留痕 (45e7f7ba552)
- 🐞 Fix:语音输入条两枚圆角收成同档 —— 小程序腿此前比 RN 腿各粗一档 (57c98b75a33)
- 🐞 Fix:恢复被 d801061d98 误回退的文件(fixup,保留后续正常提交与本票 5 文件) (a598eb0f656)
- 🐞 Fix:底部胶囊的毛玻璃模糊半径收成单一源头 —— 两端各写一份 24 靠注释对齐 (5493867cd72)
- 📚 Docs:鉴权兜底闸已以 observe 档上线，更正'未做'记录 (05e0e309c3f)
- 🐞 Fix:observe 档上线即抓到 GitHub webhook —— 补进鉴权兜底的公开名单 (6774a82ebfb)
- 🔧 Chore/Other:补齐三个边缘守卫文件的溯源水印 (aa98aab816d)
- 🚀 Feature/Improvement:鉴权默认拒绝兜底闸(onRoute 追加,默认 observe) (e876ad8f6c3)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (cb284b0b0ab)
- 🐞 Fix:消掉上一枚落地后复跑暴露的三处简体残留 —— 否则这道门就是我造的恒红门 (c306cfaa2ab)
- 🐞 Fix:底部胶囊的 Android 真模糊强度调到可见档 —— 接线补齐后仍看不出模糊 (57dd6758c55)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (b7f6a030176)
- 🔧 Chore/Other:把 ruff/mypy 两面存量红(19 + 4)清到 0,让号池之外的 Python 门重新有牙 (2b981bd839a)
- 🐞 Fix:修 feature-center i18n 键缺失并补 ui-react work-panel 预留属性 (63efdcfb6c8)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (b06c8b01c79)

**2026-10-29**
- 📚 Docs:防病毒已装并用 EICAR 实测、守护自拉起腿已补 —— 两格闭环 (2feee1ff75d)
- 🐞 Fix:修 feature-center i18n 键缺失（开发仓对齐生产仓） (a412a16e56e)
- 🐞 Fix:补齐 checkpoint 回退入口与 tool-summary 帧的两个缺口(全量 typecheck 归零) (909ae74411c)
- 🐞 Fix:secure-store 存量令牌一次性迁移 —— 修复后不必重登 (1b84801d416)
- 🐞 Fix:小程序端词包补 pdfToolsPage —— 这一屏渲染得出,但它每句话都取不到词条 (59a760a6036)
- 🐞 Fix:Trae 切号不再按映像名全杀进程 (3f598e351d2)
- 📚 Docs:自动同步缺口账本到现读口径(镜像 260 · 缺口 11) (28283deb244)
- 🔧 Chore/Other:把 apps/api/scripts 装进 typecheck 射程,并清掉这面 35 枚从未被看见的存量类型错 (1362cec462e)
- 🐞 Fix:dev-stack 重入锁 + 重拉冷却 + pid 文件删除收紧 —— 治三条腿反复「重拉失败」 (899b6855417)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (c9ab7153bca)
- 🐞 Fix:secure-store 回潮重放 + 三屏模糊接线 + 两处 View 直挂裸文本 (ffbe506f9e3)
- 🚀 Feature/Improvement:补 daemon 档自我存活兜底腿 (cca0a95e4f6)
- 📚 Docs:补记 2026-10-29 二轮加固(未授权面/本地文件面/边缘 IP 身份) (4d3f14ea770)
- 🐞 Fix:本地文件面收口(任意文件读/任意目录删/跨用户上传) + TOTP 默认升 enforce (1ec1beea63a)
- 📚 Docs:账本追平 —— PDF 工具台从未判定转已承载,缺口候选 10→9 (7758eabfeee)
- 🐞 Fix:选中态样式键写反了 —— HEAD 面既有的类型红,不修则 RN 包谁都推不动 (bd41560d839)
- 🐞 Fix:结清 web api 壳迁移票——主体234份已在HEAD(349e116a66),末枚admin/sms/operations已迁 (9b30e5b362d)
- 🚀 Feature/Improvement:侧栏补 /tools/pdf 入口(重放版) (c148782a0a6)
- 🔧 Chore/Other:ui-routes 产物追上 app.config(重放版) (20c2d8755e6)
- 🚀 Feature/Improvement:给 PDF 工具台补入口 + ui-routes 追上(重放版) (d2f1080548b)
- 🐞 Fix:镜像构建上下文排除真实密钥,并钉住规则不被删/不写错模式 (c860842563c)
- 🚀 Feature/Improvement:PDF 工具台全链落地(页 + 路由 + 入口 + 判据 + 派生) —— 重放版 (6e3584b69f9)
- 🚀 Feature/Improvement:web 侧栏补 nav.pdfTools 五语言(重放:上一版被并发 ref 移动挪出 main) (23151831409)
- 🐞 Fix:智汇AI 首页收口 —— 同数据源堆叠与随之失效的死码一并清掉 (55c75ae60bd)
- 📚 Docs:闭环源站收敛待办并登记主机侧三项加固 (b3773937d93)
- 🐞 Fix:侧栏滚动淡出遮罩双层错修复 —— 它从来没显示过 (e3daebc7f64)
- 🐞 Fix:边缘 IP 归一再补隧道腿——cloudflared 回环对端采信 CF-Connecting-IP (ad802698dfe)
- 🐞 Fix:边缘 IP 归一再补隧道腿——cloudflared 回环对端采信 CF-Connecting-IP (daf8856aa26)
- 🐞 Fix:成本面/调度状态面进入永不公开名单,收回 .env 白名单漂移 (433df6460d1)
- ♻️ Refactor:收尾最后一枚 api<T> 委托壳 —— admin/sms/operations 迁 apiOrThrow(web 本地 api<T> 声明归零) (7ac88bb579f)
- 🚀 Feature/Improvement:僵尸弹窗与撤销轮次两键五语言词包 (e13b707b2b2)
- 🐞 Fix:/chat/abort 清除 conversation.metadata.pendingQuestion (5c1bbb7c02f)
- 🐞 Fix:补 memory.refresh 三方 parity 漂移 + 承接上一枚提交信息事故说明 (79d47138857)
- 🔧 Chore/Other:-- (bf5355699b1)
- 🐞 Fix:账本生成器补上"写盘后紧随注入"这条腿 —— 并把被我自己洗掉的载荷落回去 (1414862c108)
- 📚 Docs:清偿 13c 归档器的文档↔代码脱节(4 文档 44 行)——文档在号召恢复退役件,这才是回潮的驱动力 (40c9ab3e53b)
- 🐞 Fix:补齐守门 52 存量 22 处 visible-spawn 缺 windowsHide —— 11 个文件全纯追加(零行为变更) (7c624aa2244)
- 🔧 Chore/Other:recover docked-browser panel wiring + cross-panel revealAt/CodeEditorHandle + ticket-60 pane chat-store addressing (d801061d983)
- 🐞 Fix:后端工具名单从前端真相源派生 —— 消除第二把尺子与存量漏计 (a06099ba765)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (15eaa6f61cf)
- 🐞 Fix:回灌腿补归属闸、任务中心断链修复,并把 WorkBuddy 第三条腿真正装车 (c3d5b63ca53)
- 🐞 Fix:secure-store 探测改同步取模块 —— dev bundle 的 lazy chunk 404 让刷新令牌永远落不了盘 (87a16d748a7)
- 🐞 Fix:给守门 26 的存量开一条排水口——清扫器新增具名族 parent-pollution-strays(判据 import 门体,不抄第二份) (c86f69d8e1b)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (e0acf77c41f)
- 🐞 Fix:「我的」页菜单去掉重复的收藏入口 + 三组同屏撞名文案区分 (3dc363cd824)
- 🚀 Feature/Improvement:落 RP 族 RP-1 首行 —— 26 枚「未取号」票的迁移与文案改正线 (c842abf2b7d)
- 🐞 Fix:「我的」页菜单「会员中心」撞名 + 抽屉键错位 + 底部条目被淡出遮罩压暗 (3ac7b5859be)
- 🚀 Feature/Improvement:工具摘要三档维度五语言词包(directories/edits/terminalCommands) (1dfe9bb1320)
- 🚀 Feature/Improvement:活动级几何虚拟化 + 工具摘要三档维度补齐 (80d97436e2b)
- 🚀 Feature/Improvement:轮次呈现投影层建立并装车 —— 消灭「造好没装车」 (1f3e7bd27b0)
- 📚 Docs:账本追平现读 —— 并交后手一条取证结论(小程序缺 PDF 工具台 hub) (b38b4a3e8b0)
- 📚 Docs:结清最后一条 gap chat/workbench —— 工作台在 RN 与小程序都有了承载 (c36f4b71a82)
- 🐞 Fix:增强跨端无硬边淡出遮罩强度 (dd34b4bbfa2)
- 🐞 Fix:屏幕侧配对前景键词序写反 —— filterChip/chip/tab 三键按样式工厂约定回正 (876c4cb4183)
- 🚀 Feature/Improvement:跨端驾驶舱接上唯一调度器 —— 它自述"全自动管线唯一入口"而全仓零调用点 (b8dc9e31543)
- 🚀 Feature/Improvement:D05设计稿落地现状对齐 + 清偿器补守门130落地前自查(F4/F4b/F9三维,g30 s9/s2) (316beddb12d)
- 🔧 Chore/Other:登记会话导出件族豁免 —— 门 47 缺口归零 (599baad8fa9)
- 🐞 Fix:补回富文本锚点 link 族的 <a href> 渲染 —— 事故提交 9fdbc207ba 把 renderLink 当残留删掉导致 role=link 全失效 (8fa512f9bb2)
- 🐞 Fix:拆掉 shared 包内自引造成的循环依赖 + 两个根 tab 多出来的返回键 (e648811e636)
- 🐞 Fix:修复 spacing 受管块压塌全站 max-w 命名档 —— AI 面板 32px 塌缩回归 (4394b6b4907)
- 🔧 Chore/Other:壳声明件跟随新落承载页(176 条说明符) (b35015da09a)
- 🔧 Chore/Other:自动落 1 枚小程序壳承载页(共 1 枚待产) (a62494c34dc)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (20dc73c8283)
- 🚀 Feature/Improvement:补 chatWorkbenchPage 五语言词组 —— 聊天工作台共享屏的取词面 (c0ce5eb4b88)
- 🔧 Chore/Other:goal-b25 结清四票并补 G-07 进展注记 —— 门8未判定桶/F9判据/基线差值矛盾/滞台副本末枚 (427938a5868)
- 🚀 Feature/Improvement:落聊天工作台共享屏 + RN 薄壳 —— web /chat/workbench 的移动端承载 (dd5d0475feb)
- 🔧 Chore/Other:为同批误删恢复件 background_tasks 两枚登记保留裁决 —— 尺子的红线该由证据裁,不该由再摘一次消 (689b98ef7ed)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3355d2fb255)
- 🐞 Fix:驾驶舱补上漂移哨兵这一维,并让"部分覆盖"不能冒充合格证 (4dfcfa7d516)
- 📚 Docs:结清 student/my-resources —— 数据面真补上了,原 gap 的前提已不成立 (b9f69fc4ef1)
- 🐞 Fix:智汇AI 首页移除与 AI 应用商店重复的四块内容 (f571b65018d)
- 🐞 Fix:结清 L28260 api-client 假绿灯票——判死现读 0,清账链 bd5ce8a101 已在 HEAD (a7815297205)
- 🐞 Fix:部署环 ff 竞态锁正则跟上实现演进 + 门 11h 评分星补实心填充 + 水印复注 (2c6838d1690)
- 🔧 Chore/Other:壳声明件跟随新落承载页(175 条说明符) (e3ddff14d59)
- 🐞 Fix:结清三票(G-109四格全闭合/G-924死键已清零/G-689 stderr尾缓冲已装车) (5d9d115a2f0)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3e240a14074)
- 🐞 Fix:结清两枚前提腐烂票(dot-source传递闭包3d31e4c499已装车/六屏下沉411646ee58等已全量) (13c1bdaec1f)
- 🐞 Fix:结清 L5646 门116型B行——前提已腐烂(该文件裸git派生实测0,清偿枚949195bcb5早已是祖先) (b8ede2328ef)
- 🐞 Fix:重放被回潮抹掉的「我的创作」入口迁移 —— 底栏上方那块常驻嵌套块 (1fed27283b5)
- 🐞 Fix:目录级 index.css 被当成每页伴生样式 —— 修判据并恢复被误升级的「领券中心」页 (99e58a986c7)
- 🐞 Fix:合并留下的重复 const 把 Trae/Qoder 两条回灌腿一起炸了 —— 修脚本并补上 scripts 目录的可转译锁 (cecb7d460ea)
- 🐞 Fix:首页输入框占位文案收短到单行 —— 原串在 360dp 下折行，第二行被 48dp 外壳裁掉 (3e70039dd0f)
- 🔧 Chore/Other:摘净回潮尺子至今仍点名的两枚死副本 —— keepalive router 双份 + 孤儿 SDK 单文件 (082523e385e)
- 🐞 Fix:守门 8「前缀假设」收口为三态可判 —— 未判定桶 237→0、孤儿路由变异自证修前绿修后红 (255275c277e)
- 🐞 Fix:落地 background_tasks(spawn 强引用登记处)—— 修 main 上悬空 import (f7d269568cf)
- 🐞 Fix:恢复 WorkPanel 被 9fdbc207ba 删除的第五组 props(主页/点选/开发者工具/独立窗口/常显停止) (f33f7b82a3f)
- 🚀 Feature/Improvement:跨端无硬边滚动淡出遮罩 (RN 底部 / 小程序底部 / Web 侧栏) (1be5a68ad81)
- 🐞 Fix:F9 撞号判据收窄为「同号 ≥2 未勾活行」—— 已完成历史行与单活题面退出判红面 (d09c9d2bc72)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (940fda0cba9)
- 🐞 Fix:补回「清理功能回退残留」删掉的四组功能面(并集恢复,零整文件覆盖) (60668e4c253)
- 🐞 Fix:补 stable 非纯追加时的换代处置 —— 真浏览器验证发现的判据射程缺口 (865460dfa39)
- 🐞 Fix:折叠漂开副本族(N→1,认领合并到保留行 + 逐字留痕;--fold-drifted-families) (1242b2b5e9b)
- 📚 Docs:摘 2 条已被现行判定取代的旧 gap 行 —— gap 全集从 4 收到真值 2 (179334406c4)
- 🔧 Chore/Other:第二次摘除 miniapp-end-capabilities 与 tip-metro-guard —— 并发归并把本票第一次摘除反向抹回 2 枚 (32d79e0c8f0)

**2026-10-29**
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (c9ab7153bca)
- 🚀 Feature/Improvement:补 daemon 档自我存活兜底腿 (cca0a95e4f6)
- 📚 Docs:补记 2026-10-29 二轮加固(未授权面/本地文件面/边缘 IP 身份) (4d3f14ea770)
- 🐞 Fix:本地文件面收口(任意文件读/任意目录删/跨用户上传) + TOTP 默认升 enforce (1ec1beea63a)
- 📚 Docs:账本追平 —— PDF 工具台从未判定转已承载,缺口候选 10→9 (7758eabfeee)
- 🐞 Fix:选中态样式键写反了 —— HEAD 面既有的类型红,不修则 RN 包谁都推不动 (bd41560d839)
- 🐞 Fix:结清 web api 壳迁移票——主体234份已在HEAD(349e116a66),末枚admin/sms/operations已迁 (9b30e5b362d)
- 🚀 Feature/Improvement:侧栏补 /tools/pdf 入口(重放版) (c148782a0a6)
- 🔧 Chore/Other:ui-routes 产物追上 app.config(重放版) (20c2d8755e6)
- 🚀 Feature/Improvement:给 PDF 工具台补入口 + ui-routes 追上(重放版) (d2f1080548b)
- 🐞 Fix:镜像构建上下文排除真实密钥,并钉住规则不被删/不写错模式 (c860842563c)
- 🚀 Feature/Improvement:PDF 工具台全链落地(页 + 路由 + 入口 + 判据 + 派生) —— 重放版 (6e3584b69f9)
- 🚀 Feature/Improvement:web 侧栏补 nav.pdfTools 五语言(重放:上一版被并发 ref 移动挪出 main) (23151831409)
- 🐞 Fix:智汇AI 首页收口 —— 同数据源堆叠与随之失效的死码一并清掉 (55c75ae60bd)
- 📚 Docs:闭环源站收敛待办并登记主机侧三项加固 (b3773937d93)
- 🐞 Fix:侧栏滚动淡出遮罩双层错修复 —— 它从来没显示过 (e3daebc7f64)
- 🐞 Fix:边缘 IP 归一再补隧道腿——cloudflared 回环对端采信 CF-Connecting-IP (ad802698dfe)
- 🐞 Fix:边缘 IP 归一再补隧道腿——cloudflared 回环对端采信 CF-Connecting-IP (daf8856aa26)
- 🐞 Fix:成本面/调度状态面进入永不公开名单,收回 .env 白名单漂移 (433df6460d1)
- ♻️ Refactor:收尾最后一枚 api<T> 委托壳 —— admin/sms/operations 迁 apiOrThrow(web 本地 api<T> 声明归零) (7ac88bb579f)
- 🚀 Feature/Improvement:僵尸弹窗与撤销轮次两键五语言词包 (e13b707b2b2)
- 🐞 Fix:/chat/abort 清除 conversation.metadata.pendingQuestion (5c1bbb7c02f)
- 🐞 Fix:补 memory.refresh 三方 parity 漂移 + 承接上一枚提交信息事故说明 (79d47138857)
- 🔧 Chore/Other:-- (bf5355699b1)
- 🐞 Fix:账本生成器补上"写盘后紧随注入"这条腿 —— 并把被我自己洗掉的载荷落回去 (1414862c108)
- 📚 Docs:清偿 13c 归档器的文档↔代码脱节(4 文档 44 行)——文档在号召恢复退役件,这才是回潮的驱动力 (40c9ab3e53b)
- 🐞 Fix:补齐守门 52 存量 22 处 visible-spawn 缺 windowsHide —— 11 个文件全纯追加(零行为变更) (7c624aa2244)
- 🔧 Chore/Other:recover docked-browser panel wiring + cross-panel revealAt/CodeEditorHandle + ticket-60 pane chat-store addressing (d801061d983)
- 🐞 Fix:后端工具名单从前端真相源派生 —— 消除第二把尺子与存量漏计 (a06099ba765)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (15eaa6f61cf)
- 🐞 Fix:回灌腿补归属闸、任务中心断链修复,并把 WorkBuddy 第三条腿真正装车 (c3d5b63ca53)
- 🐞 Fix:secure-store 探测改同步取模块 —— dev bundle 的 lazy chunk 404 让刷新令牌永远落不了盘 (87a16d748a7)
- 🐞 Fix:给守门 26 的存量开一条排水口——清扫器新增具名族 parent-pollution-strays(判据 import 门体,不抄第二份) (c86f69d8e1b)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (e0acf77c41f)
- 🐞 Fix:「我的」页菜单去掉重复的收藏入口 + 三组同屏撞名文案区分 (3dc363cd824)
- 🚀 Feature/Improvement:落 RP 族 RP-1 首行 —— 26 枚「未取号」票的迁移与文案改正线 (c842abf2b7d)
- 🐞 Fix:「我的」页菜单「会员中心」撞名 + 抽屉键错位 + 底部条目被淡出遮罩压暗 (3ac7b5859be)
- 🚀 Feature/Improvement:工具摘要三档维度五语言词包(directories/edits/terminalCommands) (1dfe9bb1320)
- 🚀 Feature/Improvement:活动级几何虚拟化 + 工具摘要三档维度补齐 (80d97436e2b)
- 🚀 Feature/Improvement:轮次呈现投影层建立并装车 —— 消灭「造好没装车」 (1f3e7bd27b0)
- 📚 Docs:账本追平现读 —— 并交后手一条取证结论(小程序缺 PDF 工具台 hub) (b38b4a3e8b0)
- 📚 Docs:结清最后一条 gap chat/workbench —— 工作台在 RN 与小程序都有了承载 (c36f4b71a82)
- 🐞 Fix:增强跨端无硬边淡出遮罩强度 (dd34b4bbfa2)
- 🐞 Fix:屏幕侧配对前景键词序写反 —— filterChip/chip/tab 三键按样式工厂约定回正 (876c4cb4183)
- 🚀 Feature/Improvement:跨端驾驶舱接上唯一调度器 —— 它自述"全自动管线唯一入口"而全仓零调用点 (b8dc9e31543)
- 🚀 Feature/Improvement:D05设计稿落地现状对齐 + 清偿器补守门130落地前自查(F4/F4b/F9三维,g30 s9/s2) (316beddb12d)
- 🔧 Chore/Other:登记会话导出件族豁免 —— 门 47 缺口归零 (599baad8fa9)
- 🐞 Fix:补回富文本锚点 link 族的 <a href> 渲染 —— 事故提交 9fdbc207ba 把 renderLink 当残留删掉导致 role=link 全失效 (8fa512f9bb2)
- 🐞 Fix:拆掉 shared 包内自引造成的循环依赖 + 两个根 tab 多出来的返回键 (e648811e636)
- 🐞 Fix:修复 spacing 受管块压塌全站 max-w 命名档 —— AI 面板 32px 塌缩回归 (4394b6b4907)
- 🔧 Chore/Other:壳声明件跟随新落承载页(176 条说明符) (b35015da09a)
- 🔧 Chore/Other:自动落 1 枚小程序壳承载页(共 1 枚待产) (a62494c34dc)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (20dc73c8283)
- 🚀 Feature/Improvement:补 chatWorkbenchPage 五语言词组 —— 聊天工作台共享屏的取词面 (c0ce5eb4b88)
- 🔧 Chore/Other:goal-b25 结清四票并补 G-07 进展注记 —— 门8未判定桶/F9判据/基线差值矛盾/滞台副本末枚 (427938a5868)
- 🚀 Feature/Improvement:落聊天工作台共享屏 + RN 薄壳 —— web /chat/workbench 的移动端承载 (dd5d0475feb)
- 🔧 Chore/Other:为同批误删恢复件 background_tasks 两枚登记保留裁决 —— 尺子的红线该由证据裁,不该由再摘一次消 (689b98ef7ed)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3355d2fb255)
- 🐞 Fix:驾驶舱补上漂移哨兵这一维,并让"部分覆盖"不能冒充合格证 (4dfcfa7d516)
- 📚 Docs:结清 student/my-resources —— 数据面真补上了,原 gap 的前提已不成立 (b9f69fc4ef1)
- 🐞 Fix:智汇AI 首页移除与 AI 应用商店重复的四块内容 (f571b65018d)
- 🐞 Fix:结清 L28260 api-client 假绿灯票——判死现读 0,清账链 bd5ce8a101 已在 HEAD (a7815297205)
- 🐞 Fix:部署环 ff 竞态锁正则跟上实现演进 + 门 11h 评分星补实心填充 + 水印复注 (2c6838d1690)
- 🔧 Chore/Other:壳声明件跟随新落承载页(175 条说明符) (e3ddff14d59)
- 🐞 Fix:结清三票(G-109四格全闭合/G-924死键已清零/G-689 stderr尾缓冲已装车) (5d9d115a2f0)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3e240a14074)
- 🐞 Fix:结清两枚前提腐烂票(dot-source传递闭包3d31e4c499已装车/六屏下沉411646ee58等已全量) (13c1bdaec1f)
- 🐞 Fix:结清 L5646 门116型B行——前提已腐烂(该文件裸git派生实测0,清偿枚949195bcb5早已是祖先) (b8ede2328ef)
- 🐞 Fix:重放被回潮抹掉的「我的创作」入口迁移 —— 底栏上方那块常驻嵌套块 (1fed27283b5)
- 🐞 Fix:目录级 index.css 被当成每页伴生样式 —— 修判据并恢复被误升级的「领券中心」页 (99e58a986c7)
- 🐞 Fix:合并留下的重复 const 把 Trae/Qoder 两条回灌腿一起炸了 —— 修脚本并补上 scripts 目录的可转译锁 (cecb7d460ea)
- 🐞 Fix:首页输入框占位文案收短到单行 —— 原串在 360dp 下折行，第二行被 48dp 外壳裁掉 (3e70039dd0f)
- 🔧 Chore/Other:摘净回潮尺子至今仍点名的两枚死副本 —— keepalive router 双份 + 孤儿 SDK 单文件 (082523e385e)
- 🐞 Fix:守门 8「前缀假设」收口为三态可判 —— 未判定桶 237→0、孤儿路由变异自证修前绿修后红 (255275c277e)
- 🐞 Fix:落地 background_tasks(spawn 强引用登记处)—— 修 main 上悬空 import (f7d269568cf)
- 🐞 Fix:恢复 WorkPanel 被 9fdbc207ba 删除的第五组 props(主页/点选/开发者工具/独立窗口/常显停止) (f33f7b82a3f)
- 🚀 Feature/Improvement:跨端无硬边滚动淡出遮罩 (RN 底部 / 小程序底部 / Web 侧栏) (1be5a68ad81)
- 🐞 Fix:F9 撞号判据收窄为「同号 ≥2 未勾活行」—— 已完成历史行与单活题面退出判红面 (d09c9d2bc72)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (940fda0cba9)
- 🐞 Fix:补回「清理功能回退残留」删掉的四组功能面(并集恢复,零整文件覆盖) (60668e4c253)
- 🐞 Fix:补 stable 非纯追加时的换代处置 —— 真浏览器验证发现的判据射程缺口 (865460dfa39)
- 🐞 Fix:折叠漂开副本族(N→1,认领合并到保留行 + 逐字留痕;--fold-drifted-families) (1242b2b5e9b)
- 📚 Docs:摘 2 条已被现行判定取代的旧 gap 行 —— gap 全集从 4 收到真值 2 (179334406c4)
- 🔧 Chore/Other:第二次摘除 miniapp-end-capabilities 与 tip-metro-guard —— 并发归并把本票第一次摘除反向抹回 2 枚 (32d79e0c8f0)

**2026-10-29**
- 🐞 Fix:收紧知识库归属——/api/knowledge 全插件强制登录,归属只认凭据 (ca1775aa7e5)
- 🔧 Chore/Other:新增变更B边缘IP透传端到端链路测试 (1a9f2ba2ba8)
- 🔧 Chore/Other:将 app/core/background_tasks.py 纳入版本控制防丢 (3c6419bf020)

**2026-10-29**
- 🐞 Fix:去掉收敛归并留下的三处重复导出(ExpertAutoRouteMode/ReviewFindingEvent/ReviewFindingSeverity) (b4c26c122e6)
- 🔧 Chore/Other:security：闭环变更B边缘IP透传并补API响应安全头（变更C） (79e830ba981)
- 🚀 Feature/Improvement:折叠语义例外集压过三维阈值 + 连接器分组从零消费者接成生产形态 (b5d9861d416)
- 🐞 Fix:并集补回 api-client 的 D09/D115 类型与发送链参数、web 发送链的窗格 store 参数 (5c20fb78ed4)
- 🔧 Chore/Other:T3 阳性对照窗口 300→40 —— 正控不变而镜像测试从 215s 降到 70s (af58e0f5a6d)
- 🐞 Fix:修 RN 端两处——一处编译不过、一处文案印成键名原文 (53c1dfb0a43)
- 🐞 Fix:miniapp 路由件改按 HEAD 面隔离树重算 —— 上一枚追平把他人未提交的输入烘进了自述钉 (230a8b3da2e)
- 🔧 Chore/Other:三族派生件同枚追平（路由×2 + 离线包×4 + 声明件×3）—— 本票新落的镜像页与壳把它们顶 stale (51cfd40aa99)
- 🐞 Fix:12 份文件补齐溯源水印 + 两处 lint 修正 (9725a9113fe)
- 🔧 Chore/Other:壳声明件跟随新落承载页(176 条说明符) (3e3497502cc)
- 🚀 Feature/Improvement:装出「逐字回潮」这道尺子并挂上常驻班次 —— 单父嫁接绕过钩子这一族从此有人看得见 (47d6d441aff)
- 🔧 Chore/Other:自动落 1 枚小程序壳承载页(共 1 枚待产) (3f45c3f9438)
- ♻️ Refactor:云运行壳与共享屏同名（CloudRunsScreen）—— 让自动造页腿能认出这屏并给小程序端产出镜像页 (b676679d7a2)
- 🔧 Chore/Other:兼容层图标集按现算补 Cloud —— 新共享屏 CloudRunsScreen 把它带进了消费面 (1a54e3d07de)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (f223a88eeae)
- 🔧 Chore/Other:给 carrier 7 枚带回件逐条登记裁决——回潮必须留下「谁判过、依据是什么」 (806ded2afa0)
- 🚀 Feature/Improvement:云运行屏提进 packages/app + RN 薄壳与导航登记 —— 结清 RN 端该内容域零承载 (2f6d6b266fa)
- 🚀 Feature/Improvement:mobile-rn 端包补 cloudRuns 命名空间 24 键（五语）—— 为「云运行」共享屏供词，措辞一律取自 web (7a0a0ab71e2)
- 📚 Docs:给门 89 的 R4 补上 check-web-portal-label-keys 的点名行(走对象空间,不吃别席的行) (0b6f24f7297)
- 🐞 Fix:消掉门 89 的 R5 撞号恒红 + 回补门 237 被无关提交洗掉的 996 行版 + 换掉一把会替人下因果结论的坏尺子 (3ef804fc3f9)
- 🔧 Chore/Other:撤销 1442baa1e0e 的整条移除——补回运营商一键登录的注册腿与消费腿 (b09e82f82c8)

**2026-10-29**
- 🐞 Fix:补齐 9fdbc207ba2 那批「清理功能回退残留」抹掉的实现(api-client 两导出 + 四个 store/hook 面) (c51a00fd0bf)
- 🐞 Fix:G-322 第23批补完 —— 门70/168/195 旗标取值换单源(6/6 逐枚还原正反对照) (2c2931440e)
- 🐞 Fix:结清 G-1142551(ui-routes 产物陈旧已按面重生成落地,门105 matched + 门100 同处存量清零) (3f9448cd4f)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (3104492436)
- 🚀 Feature/Improvement:Y-14 app-version 最新行只读对账腿接入巡检轮(6h节流,fail 给可整改那一步) (ac283709d3)

**2026-10-30**
- 📚 Docs:check-app-version-latest 补点名(R4;与 git-guardian 接线同批) (b5fec79573)
- 🐞 Fix:G-322 第23批 union-converge 单源收口 + deploy-lock 两站 (b3466d1135)
- 🐞 Fix:还原 registry 批内复合键去重与 deduped 留痕 —— 被 2026-10-28 批量落地写回旧版 (7e0ef336cf)
- 🐞 Fix:结清第3波覆盖面票(31枚逐枚切片已入账 426f493091) (b3b3f8f5b3)

**2026-10-30**
- 🚀 Feature/Improvement:遥测/ARMS+processResource 族 31 枚逐枚切片入账(切片872→903,读到体零虚增,父片264→233/97→66 全表 read 守恒) (426f493091)
- 📚 Docs:check-i18n-cross-end-wording 补点名(消门89 R4 红,既有欠账) (334bf4e04d)
- 🐞 Fix:Avatar 头像 src 同源代理 + 新增 toMediaStreamUrl 媒体代理助手 (539181a601)
- 📚 Docs:门 266 补进守门脚本点名索引(R4 义务;AGENTS.md 余量仅120B,只点 README 满足 AGENTS∪README 口径) (9caeb4ccab)

**2026-10-30**
- 🚀 Feature/Improvement:样式工厂键集<->跨文件取用对账门(266) —— 修两处假绿(作用域链传记录致全放过)+绝对零容忍 (e80bc950b3)
- 🐞 Fix:next/image 动态 src 同源代理收口 —— 彻底堵死 img-src 外泄信道 (1f50cf2447)

**2026-10-30**
- 🚀 Feature/Improvement:批量写诚实性两格补口 —— batch-cancel 两表 returning 回库确认 + mergeUserAccounts GET DIAGNOSTICS 回执 (d9325f426b)

**2026-10-30**
- 🚀 Feature/Improvement:G-584 服务运行配置入仓 —— 三面分桶真相源+清单快照(凭据零值命中) (bdf238e447)
- 🐞 Fix:按 s17 普查修复五枚僵尸票的腐烂路径指针(落点改指本仓真实宿主) (116db99890)

**2026-10-30**
- 📚 Docs:门207 清偿收官,移出 R4补记②长版(已逐字归档)+清拼接损伤,95880 字节余量120,lost=0 长行重复0 (fe81e285d8)

- 📚 Docs:逐字固化 AGENTS.md 移出的 R4补记②长版(2026-10-30 清偿第五批) (209f3e11ed)

- 🐞 Fix:两门吞值判据换 import 单源 + 清存量死 import(eqeqeq 用 smart 精准放行 null 判、非盲改 ===) (86e2a5de29)

- 🐞 Fix:G-322 吞值判据换 import 单源(migration-bookkeeping/收敛器 getOpt)+探针测试件 (0de06fd076)
- 🐞 Fix:图片同源代理收口 —— 根治 img-src 外泄信道 (5304d72bb0)
- ♻️ Refactor:摘除腾讯云 COS 备用下载腿(整桶已删,站点 CDN 腿为唯一出口) (c521c77f24)
- 🐞 Fix:删掉 app.json 里无消费者的静态 versionCode,并立 I2 判据拦住它复发 (f91858935d)
- 🚀 Feature/Improvement:小程序词库镜像 174 个共享屏键 —— 补页面前先补齐文案腿 (a3105058ce)
- 🐞 Fix:版本漂移门判据 I 取值失效修正 + 移动端版本号收敛到可追溯值 (359f2a938f)
- 🚀 Feature/Improvement:小程序词包镜像 97 个共享屏键 —— 补页面前先把文案腿补齐(零新译) (b38803a09a)
- 🐞 Fix:统一 Android 签名, debug 变体也用正式 keystore (10819940fc)
- ♻️ Refactor:摘 api-client 六文件零消费方死导出与小程序 /pay/activity 恒404腿 (687201eda9)
- 🐞 Fix:还原度门认原生导航栏标题 —— config 里的页面标题也算页面真实文案(422→410) (6467388a29)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (00ed7d84a7)
- 🐞 Fix:还原度门认同值别名 —— 两套命名空间同一句译文不再记成缺口(501→422,还原度 80.8%) (44addc5cf7)
- 🐞 Fix:聊天 SSE 的 dispatch_subagent 接入已有工具面收窄 (52a6f5ee6b)
- 🐞 Fix:视频卡片功能收口 —— 同源代理根治 CSP 外泄 + 分享全平台可用 (57f4b6a902)
- 🐞 Fix:循环六处收口——非只读串行且取消杀进程、超限结果落盘、压缩连败三次即停、规则上溯叠 .local、检索认 gitignore、目标未达成再跑一轮 (62e4bf530f)
- 🐞 Fix:还原度门的载体面补同目录相对 import 模块 —— 拆子模块的页不再被读成整片缺键 (efde0d87d6)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (9a8f4b4443)
- 🐞 Fix:端数事实统一为「六端」+ 32 枚跨端文案漂移全部落到在册裁定 (5c023fe3f2)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (0319eec121)
- 🐞 Fix:壳承载屏两端同处 UI 的 5 枚值对齐基准,并补两枚会露裸键的缺失词条 (aaf79a68aa)
- 🐞 Fix:端内 common.loading 值本是"检测中..."——50 处列表加载态一直在说检测 (0b9566c39e)
- 🚀 Feature/Improvement:跨端同名键文案漂移的裁定对账尺 —— 46 枚清理完后,让下一次不必有人从零重读 (1454b5a5ac)

- 🚀 Feature/Improvement:流式 markdown 补全未闭合标记,脚注和块级 HTML 不再被切开 (e27a7fb4f2)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (53a07309a7)
- 🐞 Fix:RP-1 第2笔摘占位与旧口径错记文案——4枚已补号行的「未取号/号池已满」叙述整枚摘除(RP-35/36/37/38;号已实发故本笔主键两侧同值不漂,三维守恒逐枚 PASS,归属桶与租约逐枚不变;R7 保住 登记@2026-10-26 日期 = 守门130 F8a 交代;R5 的号在 〔归:…〕 标头之后不漂桶;scripts/** 禁令证据面一处未动) (0d3c0fb662)
- 🚀 Feature/Improvement:暴露即轮换腿落地(编排器全 import 既有 refreshOne/decryptAccountCredentials/fingerprintOf/checkHealth,零第二份实现;镜像 13/13 含"换成功但旧值仍被接受⇒判红"与 canary 五面不外泄);fp 清单今日登记 0 靶——39 枚号池现值 fp 与两枚历史 blob 取交=0、blob 内无 JWT/无裸 rt(解出 aha.device.* 设备标识),故该次泄露不含当下可被上游接受的真凭据,拒绝登记假靶 (ed1aa18ee8)
- 🐞 Fix:结清 D05 协作会话设计稿与迁移298核查单两枚(成果已随 6ac02eebdc 入库) (06c05f3694)
- 📚 Docs:D05 会话协作设计稿写实(现状证据+鉴权落点+分阶段S1-S5) + 迁移298核查单逐格现读校正 (6ac02eebdc)

- 🔧 Chore/Other:批量写诚实性第4批补测57例 + Esc层栈变异读数固化 + zcode登记件入账 (928a924925)
- 🚀 Feature/Improvement:悬空 commit 自动保活腿 —— 消费门30a机读出口零复算(§0.6),只加不减/超窗只报数/时刻读不到保守算窗内/撞名不覆盖并点名/fsck取不到⇒未判定;15min节流(每轮跑一整趟30a约4分钟),clean零留痕零推送,到人按稳定身份去重;镜像15/15含真git端到端与只加不减形状锁,实跑 state=clean tagged=0 零副作用 (1240b5668d)
- 🐞 Fix:对话框内生成的视频能播能存能带走 —— CSP 放行 + 下载走同源代理 (8fbc1bcada)
- 🐞 Fix:收口被整块重复的登记(F6 块级判据的修复出口) (d5a2af0683)
- 🐞 Fix:结清旁路落地器水印那枚(前提腐烂,接法已在 HEAD 并经实证三场景与镜像钉住) (5628d2d313)
- 🐞 Fix:收口被整块重复的登记(F6 块级判据的修复出口) (ee5e49564b)
- 🐞 Fix:registry-sync 批量失败时把真实错误写进 sync_log —— 门 47 现在只报得出条数 (a3d7f7f2bf)
- 🔧 Chore/Other:归档件补溯源水印 —— 销 10-29 归档留下的 HEAD 面欠账(门 47 复跑点名) (d05bdf123d)
- 🐞 Fix:react-native-screens 4.26.2 升到 4.30.1 —— 桥接拆除期 NPE 的官方修复面 (19ab214903)
- 🐞 Fix:回退检查点的时刻在服务端出口折成毫秒 —— 「恢复到本轮之前」此前恒回到未来 (1bf0f57b9d)
- 🐞 Fix:大屏号池列宽下限取实测最大值 186 —— 上一版 143 会把复合读数压出卡片 (977734d140)
- 🐞 Fix:修正门 237 R1 的出路文案 —— 置 null 不是「无 rn 腿」,删不满足登记口径的条目才是恢复口径 (5265a3a294)
- 📚 Docs:登记领券中心两枚端点与工具目录 seed(§21 功能同步) (93cb4a69ca)
- 🐞 Fix:拆开 conversationImport.historyFailed 的同名不同义 —— 一个键在两端承载两种语义 (a420cfe1d5)
- 🐞 Fix:协议条款正文两端同文 —— 46 处文案漂移里唯一可证安全的一族,其余逐枚判过不是缺陷 (35fbc9e45b)
- 🐞 Fix:登记表删 4 条不满足登记口径的行,门 237 四处红与漂移 registry-rot 同笔归零 (3e80ad99e5)
- 🔧 Chore/Other:ui-routes 产物追平领券中心改动 —— 收掉 105 最后一条 G5 (8da3805690)
- 🔧 Chore/Other:离线语言包追平 mobile-rn/shared 已入库的新键 —— 清 105 的 G5+B2 两处判红 (df7e748402)
- 🐞 Fix:重放 nav.pdfTools 五语言 —— 侧栏引用着它,而词条第二次被并发合并洗掉 (532fdfc9da)
- 🚀 Feature/Improvement:还原度尺补"本端词包缺整块命名空间"这一维 —— 两把尺原先同时看不见 (cd05449596)
- 🚀 Feature/Improvement:工具目录补首启 seed —— /tools 页三档此前恒显示「暂无工具」 (784d12c567)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (49f90ce0c2)
- 🐞 Fix:账本候选列不再让 hub 这类结构词冒充业务身份 (d5724ae70f)
- 🔧 Chore/Other:第二次撤净 parent-pollution-strays —— 第一次的撤销枚被别席滞后前推整片洗回 (0a66be2720)
- 🔧 Chore/Other:离线语言包跟随词包重建 —— 补键后产物自述钉必须同源 (442dba3da6)
- 🚀 Feature/Improvement:领券中心接上真实数据与领取动作 —— 止血空态退场 (4f0d0c261b)
- 🚀 Feature/Improvement:小程序补 member.couponList.receiveFailed 五语言 —— 领取动作需要一条失败文案 (45da4d7815)
- 🚀 Feature/Improvement:补「领券中心」的两个用户面端点 —— 可领券列表 + 按 id 领取 (36f6c451f8)

- 🚀 Feature/Improvement:输入区显示尚未对账的命令 (1590ef8afa)
- 🐞 Fix:更新卡就绪态不再引用本端没有的 appUpdate.body —— 端上现渲裸键 (5f75a80223)
- 🚀 Feature/Improvement:子代理工具面收窄到父白名单，超预算只回摘要 (5dcfa93b2b)
- 🔧 Chore/Other:摘掉两枚 HEAD 存量中文残留红 —— 措辞按仓内正本对齐,不自造 上一枚摘键提交落地后的「受影响判据复跑」点名 blocking 两臂(门 2o-mobile-rn / 门 2s-mobile-rn)。 逐枚现跑归因:两枚都是**先于本席存在**的存量红(行号随摘键挪位才第一次被读到),与本票载荷无关, 但红点归 i18n 面、修法唯一,就地收口而不是留给下一位再撞一次: ① ja  webViewPortal.distributionWithdrawRecords 「分销出金履歴」→「代理販売の出金履歴」    —— 后者就是 miniapp-taro/ja.json:4821 同键的在册正本(miniapp-taro/ja 现跑 ✅ 无中文残留)。 ② zh-TW webViewPortal.memoryManager「記憶管理台」→「記憶管理臺」    —— 守门自己给出的替换值,且与 miniapp-taro/zh-TW.json:4824 的在册正本逐字相同。 ko 面同一键的「分销 출금 기록」被扫描器判 **warn-only**(rc=0,半翻译类,「可能是有意为之」), 按 §12e 不为消红去改判据射程外的措辞 ⇒ 不动,在这里点名它的存在与不修理由。 验证末行(现跑):scan-i18n-zh-residue ja/zh-TW --target=mobile-rn 双双 rc=0「无中文残留」; check-i18n-keys --parity-only --worktree ⇒「5 语言 parity OK」× 25777 键路径;watermark verify 残迹 0。 (045c1aeb2c)
- 🐞 Fix:门77 B5 63→0 —— 给漏登记的第三方 lucide 字形生成件补 OUT_OF_SCOPE 声明(路径精确正则+bExempt,零通配;1/3/9 本不在档位表,吸附即改坏字形并与 web lucide-react 脱节)。同数据 LineIcon/icons.ts 早已挂 bExempt,icons-generated.tsx 随门251落地时漏登记;单 hunk 只落数组体内,B1-B8/A/C 零字节改动;摘除 239→240、自检 86 例、镜像 23/23,复核期 2027-04-30 写入 why (902b233314)
- 🔧 Chore/Other:25 枚死键候选逐枚定性后收口 —— 确证死的摘、契约键登记、在飞与双端不变量一律不动 三桶:A 确证死 9 摘(五语言同批) / B 契约键 3 登记 / C 不动 13。判定按行内自写判据当场复跑,不采信报告措辞。 (1bd1a1fdd7)
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
- 🐞 Fix:服务清单器三处裸 $n 内插根修(RegistryKey.ToString() 返 HKEY_LOCAL_MACHINE 全串⇒真服务全 continue,修前 exit 0 而 services:[])+§0.3「枚举到0个⇒exit 2 未判定」硬闸(T| 分三种0)+生产者形状锁 bareRegistryVarHits;自检 20/20 含改回必翻红成对对照;本机现读 3 枚在册服务零入库真相源,反向 8 枚仓内点名本机不存在 (13c78b14fc)
- 🐞 Fix:登记表 4 条抢键条目 rn 置 null —— 撞键 5 组收到 1 组,3 个路由名改回真渲染者的页 (b608ba35c3)
- 📚 Docs:补回上一枚被 bash 命令替换吞掉的门名(守门133 check-i18n-locale-content-language)——反引号串在双引号里被当命令执行,文件名成空 (892b1ff31f)
- 📚 Docs:更正 §19 假陈述——CJK三族互判与同名自套两层"现无门/人工必查"不成立,守门133 check-i18n-locale-content-language 已 blocking 装车(runner:3737);依 g34-s6 一手读数 (41a0dcebb4)
- 🐞 Fix:结清 G-37 三件事(35枚JSON parse全OK+四道i18n门全绿+CJK互判/同名自套真命中0;133已装车判这两型;看门狗与构建指纹双向消费均在HEAD)——同行清除F11禁桶措辞 (dbb46a7792)
- 📚 Docs:把 SDK 票漂开版的两个独有记号折进当下行(G-23 与释放注记) —— 为归并做零丢失前置 (55877ff48d)
- 🐞 Fix:结清G-16(别名+类臂两维已落地)/G-14(svc run脚本已入库+E1真装audit)/G-07(清偿器落地前自查已接)/Esc层栈协议5份副本(单实现+50消费方+23用例+CI 692通过) (d6a4f00558)
- 📚 Docs:给24枚占位符作用域票补出真实落点(只搬票面正文已点名、但未加反引号且在HEAD存在的路径,零编造)⇒ 派单器可对它们发互斥合格证;勾选/租约/归属三维逐行不变 (93e0ae4653)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (d2269d7fea)

- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (f72df75e51)
- 📚 Docs:鉴权兜底闸已切 enforce，补记 12 条裸奔发现与蓝绿踩坑 (6df1c8efdc)
- 🐞 Fix:enforce 档抓出的两条合法公开面补进名单(app-version / news) (1a55dab48d)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (888be1ba64)
- 🐞 Fix:装悬空提交备份腿到弃落出口(四台落地器共用一份 lib)—— 门 30a 存量从此有排水口 (4468747144)
- 🐞 Fix:删除 relay-account-pool-worker 重复的 runTraeSessionSync 导出 (8176b5c52a)
- 🐞 Fix:注册页倒计时改走取词 —— 此前 en/ja/ko/zh-TW 用户看到的是"12秒后重新获取" (7a25781c11)
- 🐞 Fix:兜底闸不得二次 send —— 修 /api/knowledge 匿名访问 500 而非 401 (83359d5396)
- 🐞 Fix:补齐端内在用而词包查无的 8 枚键 —— 这些界面在非中文语种下一直出中文 (fe13f15ab8)
- 🐞 Fix:补全鉴权兜底的公开名单并给 enforce 档留痕 (45e7f7ba55)
- 🐞 Fix:语音输入条两枚圆角收成同档 —— 小程序腿此前比 RN 腿各粗一档 (57c98b75a3)
- 🐞 Fix:底部胶囊的毛玻璃模糊半径收成单一源头 —— 两端各写一份 24 靠注释对齐 (5493867cd7)
- 🐞 Fix:消掉上一枚落地后复跑暴露的三处简体残留 —— 否则这道门就是我造的恒红门 (c306cfaa2a)
- 🐞 Fix:底部胶囊的 Android 真模糊强度调到可见档 —— 接线补齐后仍看不出模糊 (57dd6758c5)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (b7f6a03017)
- 🔧 Chore/Other:把 ruff/mypy 两面存量红(19 + 4)清到 0,让号池之外的 Python 门重新有牙 (2b981bd839)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (b06c8b01c7)

- 🚀 Feature/Improvement:hook-failed 帧契约 + api-client 解析 + store 落桶(G-87 补链,端侧半) (f41cdcad58)
- 🔧 Chore/Other:块级窗口判据主文件 prettier 格式对齐(语义零变化) (f745178ed8)
- 🔧 Chore/Other:test (eb848ead6b)
- 🔧 Chore/Other:b76-15 三文件 prettier 格式对齐(语义零变化) (be7ba525d5)
- ♻️ Refactor:孤儿护栏一接一退 —— check-immutable-guard 补 --audit-new(每枚判恰好一次,六态封闭)由 git-guardian 旁路派发(5min 节流/breach 才到人,不挂提交链不堵门);check-guardrail-hashes 退役(与 root-guard 同三目标同机制、基线件从未入库致 --verify 恒 exit 2,接线即 §0.6 重复实现装上车) (b2c05e4493)
- 🐞 Fix:gen-rn-compat --write 重写 route-map 时 100% exit 2 根修(共享树瞬时句柄争用 errno -4094 不重试且把原因截成命令本身)⇒ 走 lib/atomic-write 唯一出口+退避重试+回读自证 payloadIntact+stderr/errno 点名;镜像 N1-N5,15/15 (b4bb4d01d7)
- 🔧 Chore/Other:路由表随登记面重生成 + RN 测试替身收两处局部复刻 + 硬编码中文基线下调一枚 (3b76e9adf5)
- 🐞 Fix:有意还原被 9fdbc207ba 当残件删、6d0dbde7c9 只带回消费行的门234纪元声明面 ⇒ --staged/--worktree 不再 ReferenceError(此前 blocking 门在 pre-commit 面等于不存在);恢复 A1 身份维+孤儿 identity 形参接回 judge;侧车签名折算按取证收掉(接回即造 rotn=17 假阳恒红);回归锁:真跑 --staged + 变异反证,镜像 17/17、自检 26/0 (d17a1f6c74)
- 🐞 Fix:前向重放首页收口那一刀 —— 它被 ffbe506f9e 的整文件重放抹掉,商品族堆叠在 main 上已复活 (e118488e7a)
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
