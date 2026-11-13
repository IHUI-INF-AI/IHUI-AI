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

Headline claims (same source as the table below, all live-computed): **database tables · API routes ·
WebSocket endpoints · LLMs · multi-platform auto-publishing · test file counts in the generated table below ·
engineering gates · CI workflows · i18n parity · app and shared packages · compose services**.

<!-- BEGIN GENERATED NUMBERS (node scripts/gen-doc-numbers.mjs --markdown) -->
| 指标 | 现值 | 取数键 |
| ---- | ---- | ------ |
| 数据库表 | 639 | `dbTables` |
| schema 文件 | 246 | `dbSchemaFiles` |
| API 路由 | 4768 | `apiRoutes` |
| 路由文件 | 694 | `apiRouteFiles` |
| AI 服务路由 | 676 | `aiServiceRoutes` |
| WebSocket 端点 | 40 | `wsEndpoints` |
| 入库模型清单 | 100 | `llmModels` |
| 发布平台 | 38 | `publishPlatforms` |
| 端应用包 | 9 | `appPackages` |
| 共享包 | 17 | `sharedPackages` |
| CLI 命令文件 | 78 | `cliCommandFiles` |
| CLI 工具文件 | 107 | `cliToolFiles` |
| 语言 | 5 | `i18nLanguages` |
| i18n 作用域 | 7 | `i18nScopes` |
| 语言包 JSON | 35 | `i18nMessageFiles` |
| 测试文件 | 5133 | `testFiles` |
| CI 工作流 | 59 | `ciWorkflows` |
| Compose 服务 | 14 | `composeServices` |
| 工程守门 | 363 | `guardianGates` |
| — blocking | 334 | `guardianBlocking` |
| — warn | 31 | `guardianWarn` |
| 跟踪文件 | 21248 | `trackedFiles` |

上表由 `node scripts/sync-readme-numbers.mjs`(唯一写入口,索引面取数)生成,最后核对日期 2026-11-12。
每个数的来源就写在取数键旁边的实现里(`scripts/gen-doc-numbers.mjs` 的 `SOURCES`),**不得手抄、不得另立第二份**。

<!-- END GENERATED NUMBERS -->


## Recent updates (auto-maintained)

<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->
**2026-11-13**
- 🚀 Feature/Improvement:小程序 sag2 词法多跳检索工作台(pkg-ai 路由页 + drawer-nav 导航 + 跨端屏登记 + ota 测试) (1a2ebbe23a)

**2026-11-13**
- 📚 Docs:多语言 README 派生产物同步 (01bde91ef0)

**2026-11-13**
- 🚀 Feature/Improvement:sag2 特性面板(mobile-rn/packages app/types + api-client sag2-lexical 端点) (02cdf68286)

**2026-11-13**
- 📚 Docs:合并后钩子自动维护派生产物 + 导航/api-client 跟踪改动 (97ae9418d9)

**2026-11-13**
- 🐞 Fix:README 联系表去重并把残留旧邮箱收口为 lizong@aizhs.top (203ea00cc7)
- 🐞 Fix:F-20 积分任务日界 / F-23 支付宝退款整数分比较 (9e63bf2ec4)
- 🐞 Fix:AIS-077 知识卡注入面属主裁剪 + AIS-046 审计接口分工说明 (4fa66bc12b)
- 🔧 Chore/Other:一键切号排序补 4 道变异判据 + 桌面 README 沉淀三层入口 + 补 2 枚并发提交具名追认 (eccf5d6d6f)
- 🐞 Fix:假数据与告警收件人收口（mock 用户迁到 example.com，凭据巡检告警改官方邮箱） (a795b74ba4)
- 🐞 Fix:收口剩余旧邮箱残留（README 正文/发布说明/脱敏示例/告警收件人） (5f7ce8307a)
- 🐞 Fix:收口剩余旧邮箱残留（README 正文/发布说明/脱敏示例/告警收件人） (13b775477a)
- 🐞 Fix:自愈锚点挂到每次提交，任务被禁用/删除/改写后自动复原 (874eb3d45a)
- 🔧 Chore/Other:README 生成块数字对账 —— trackedFiles 21245 / testFiles 5130(索引面现算) (2c644690f7)
- 🐞 Fix:推送侧三处收口 —— 47p 范围派生兜底、两枚 tmp 脚本水印、302p 基线对账 (18449f0db1)
- 🐞 Fix:对外邮箱与发件身份统一为 lizong@aizhs.top (8d2ad98f62)
- 🔧 Chore/Other:补签并发零弹窗提交的不可变护栏具名追认(1 枚收口) (fbf88335db)
- 🔧 Chore/Other:违禁桶兜底清扫——HEAD面等条件/待拍板未勾行自动摘除(两道机主禁令的执行器物化,留痕f12-purge;复翻席请同步摘形态,事实内容按各批结清提交保留) (58dc4eefef)
- 🐞 Fix:计划任务零弹窗闭环 — 隐藏包装 + 全盘自愈巡检 + 微信托盘看门狗 (ca4e7d1892)
- 🐞 Fix:install-git-hooks 测试的 git 派生补显式 stdio,消门 193 判红 (284b2a2b80)
- 🔧 Chore/Other:补 3 条不可变护栏具名追认(收敛合并与他席旁路落地) (4629423517)
- 🔧 Chore/Other:收敛前置补录两条删除意图通知书(checkin_* 权限文件) (b50b0b95e3)
- 🚀 Feature/Improvement:一键切号首屏平台顺序钦定(Trae/WorkBuddy/小浣熊/Loomy/Qoder)并加仓内 switch:oneclick 入口 (27f9b236b0)
- 🐞 Fix:临期窗口跟随派发节拍,消除 alert 档 6h 漏刷空窗 (33f7f4b521)
- 🚀 Feature/Improvement:生成物拦截补推送侧 --rev 面 + 钩子安装器单测 (f6b3537365)
- 🐞 Fix:tmp-diag-trae-token 清未用导入与非空收窄, 消 TS6133/TS2769 (123f8f2a66)
- 🐞 Fix:偿还 mypy 存量 20 条类型债务(签到引擎族,全为类型收窄无行为变更) (045d871769)
- 🐞 Fix:tmp-probe-exchg 载荷类型收回 TraeTokenPayload, 消同族类型不兼容 (8352346ead)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (b244888ad0)

**2026-11-13**
- 📚 Docs:同步多语言 README 派生产物 + 自动更新指针 (f3673b52d1)

**2026-11-13**
- 🚀 Feature/Improvement:多语言文案同步 + api-client sag2-lexical 端点(shared/web 五语系) (58b76bade1)

**2026-11-13**
- 🔧 Chore/Other:并发会话本地改动落盘(web/api/ai-service/miniapp/mobile-rn/docs/notice-log 等) (7c9a379d40)

**2026-11-13**
- 📚 Docs:钩子自动维护 Recent updates 派生产物 (891769ad2e)

**2026-11-13**
- 📚 Docs:同步 README.en 派生产物(现算口径) (2746f7a1f4)

**2026-11-13**
- 🔧 Chore/Other:收录 install-git-hooks 镜像测试 + README 数字同步 (5f6211b843)

**2026-11-13**
- 🚀 Feature/Improvement:号池同步任务注册器融合远程隐藏启动器(wscript SW_HIDE 零黑窗)+ 本机 reextract 兜底任务同走隐藏包装;PROJECT_PLAN 清偿逐字副本并保留取号器 B41 行 (d7060ca78f)

**2026-11-13**
- 🚀 Feature/Improvement:跨端更新提示样式重构 + 对话内提示留痕 notice-log(miniapp-taro/mobile-rn 同批,remote-locales 文案随动) (96a0e7a504)

**2026-11-13**
- 🚀 Feature/Improvement:号池全缺口开发验证 + 能力登记表 + reextract 兜底 + 接口参数补齐 (e04bfc4a31)

**2026-11-12**
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (06239c8f00)
- 🔧 Chore/Other:工作区清零 + 工具现场入忽略层 (71216c30e6)
- 🚀 Feature/Improvement:补 3 个句柄族动词 —— scroll / wait_for / drag（对标 Trae 的 browser_* 工具面） (8853cdf643)
- 🚀 Feature/Improvement:账号池退出态保活收口、MiniMax 会话同步与多处修复 (32792c6e04)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (0031186061)
- 🔧 Chore/Other:合并后重结批次20 共16张(F-077 / AIS / F-12,24,43,276,399,501) (e4efa8e049)
- 🚀 Feature/Improvement:把 schedule(cron) 榨出来 —— 周期挂起唤醒，判据与调度分离 (fe0d97cc17)
- 🔧 Chore/Other:结清批次20 共16张(F-077 / AIS-011,025,036,037,043,045,047,048,079 / F-12,24,43,276,399,501) (b74aac553f)
- 🐞 Fix:F-276 三维生成身份/超时/如实失败与计费、F-399 续费回调原文验签 (b2c531f732)
- 🐞 Fix:F-12 支付副作用幂等、F-43 产物哈希流式、F-24 导出业务日界、F-501 clawdbot 连接代次 (cffddf1141)
- 🐞 Fix:AIS-025 dag 调度器重启恢复与 AIS-045 手动/调度签到互斥 (8b6e6cfa4b)
- 🐞 Fix:AIS-011 Gemini 拦截识别、AIS-047 审计 user_id 落库、AIS-079 usage 读面权限门 (35703e03b1)
- 🐞 Fix:AIS-037 workspacePath 越界校验与 AIS-043 SSO state 校验/mock 缺省 (38bf455f2a)
- 🐞 Fix:AIS-036 webhook SSRF 旁路与 AIS-048 错误契约泄露 str(e) (551ec71b1c)
- 🐞 Fix:F-077 egress 判据默认开地址证据(addressProof) (938f602456)
- 🚀 Feature/Improvement:财务部板块 RP-46 三端镜像(cherry-pick 到 origin/main 尖) - 共享屏 FinanceAiHubScreen + RN/Taro 镜像 + 路由注册 + 五语 i18n + 三端登记 - 原 push/finance-ai-rp46(2aec011) 快进重放到当前尖 e3f5dae (6e7193a610)
- 🚀 Feature/Improvement:清掉上轮 4 条局限 —— 错误映射守门 / workflow 真实执行 / auto-review 接诊断 (5210ccbe0c)
- 🐞 Fix:删 tag 同趟摘 refs-manifest,堵守护缺-ref自愈把冗余 tag 回灌(实测8分钟回灌8759枚) (e3f5dae75e)
- 🐞 Fix:OTA 发布四项遗留收口(-m 短旗/--clear-cache/健康探测落点/登录错误本地化) (e57e76d3f3)
- 🐞 Fix:剔除提交已在 remote-tracking refs 的一批,堵 8087 枚 tag 删后 15 分钟回灌;补回 enabled 形参与 A16 await (53d26ccfc9)
- 🐞 Fix:goal iterate 把判据写错说成"崩溃" —— 用户输入错误不该走 crash handler (d7ed1afb17)
- 🔧 Chore/Other:修正 F-327 漏改的 outstanding 断言并补回收链路证据 (4bbd88877d)
- 🐞 Fix:解摘档接上「能再取凭据」判据 + 探针拆平台/本行续期两列 (cf11dc304f)
- 🚀 Feature/Improvement:ralph-loop 闭环 —— 把 goal-loop 与真实 runToolLoop 组合，并给出 CLI 入口 (952993dc75)
- 🚀 Feature/Improvement:实现 5 项 crate 能力并为每项建出真实消费方 (f6eff6a461)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (a102680a5f)
- 🚀 Feature/Improvement:新增 --bundle-archive 冷归档唯一备份 tag(写后双验 + --if-changed 零写入) (33d4fb4241)
- 📚 Docs:刷新生成块到 HEAD 面现算值(21188/5113/ws43) (37854cc080)
- 🔧 Chore/Other:新增 --prune-redundant 复位冗余 lost-commit tag(默认 dry-run + --apply) (35483c3eb6)
- 📚 Docs:刷新生成块 trackedFiles 到 HEAD 面现算值(21186) (76cd998d23)
- 🐞 Fix:补齐 relay-probe-pool-health.ts 溯源水印 HEAD 面欠账 (2e94f8ce2e)
- 🐞 Fix:F-242 参数覆盖规则加 30s 进程内缓存+失效; F-243 非主库默认隔离队列 (7d5d4ec119)
- 🐞 Fix:F-241 组邀请码原子占用,杜绝并发双兑换 TOCTOU (498de981f7)
- 🚀 Feature/Improvement:接通两处断链 —— cost-approval 进预算闸、listWakeableTurns 进 turn/parked (1b2184d99f)
- 🔧 Chore/Other:结清 API F300-499/F500+ 两段 agent 交付的 26 张工单(23 commit 核验 + 3 源码直读核验) (c96bc426ee)
- 🐞 Fix:号池通道三处根因修复(模型清单 401 + 首帧时序 + 服务端缓冲) (4333d20350)
- 🐞 Fix:F-613 Redis 黑名单改每 IP 单键 SET EX,成员级 TTL 不再冲突 (87aa17f52f)
- 🐞 Fix:F-611 api-logger 用在途 Promise 替代布尔互斥,onClose 补一轮 flush (360fa9d830)
- 🐞 Fix:F-597 UGC 敏感词过滤整请求只取一次词表,消除 N+1 (72d8fff690)
- 🔧 Chore/Other:结清 30 张并发 agent 已修复但漏勾的工单(双通道核验) (e575dcf809)
- 🐞 Fix:F-487 用户组列表与成员列表收敛到属主/成员 (5d0f195d9d)
- 🐞 Fix:F-341 下载统计日界显式按上海时区截断 (8b3ca2083c)
- 🐞 Fix:F-440 browser 页面缓存与响应体双重限界 (e1b85f1cf6)
- 🐞 Fix:F-437 剧情内存态限界且同 id 不再覆盖，title/id 加上限 (5385ca3dc1)
- 🐞 Fix:F-409 兜底校准回填 tokenQuantity 并按真实补建数统计 (381429c95c)
- 🐞 Fix:F-327 scanLeaks 只标记不删 outstanding，forceRelease 可真正回收 (610bbc9b38)
- 🐞 Fix:F-610 threat-detector 两个 Map 加硬上限兜底防 OOM (f86c21685a)
- 🐞 Fix:F-596 验证码校验补 expiresAt 过期判断 (0cf9912eca)
- 🐞 Fix:F-586 智能体购买判定加 active 与未过期条件 (5303771513)
- 🐞 Fix:F-571 acceptAnswer 校验回答 status,软删回答不可采纳 (443c5907d9)
- 🐞 Fix:F-502 学习心跳 duration 设上限并封顶累加,防 integer 溢出 (2486ff542f)
- 🐞 Fix:F-500 ai-ext 插件白名单改 url 后缀匹配,不再全退化 admin (cb9273d59f)
- 📚 Docs:刷新生成块数字到 HEAD 面现算值(21184/5112) (b4657a2d77)
- 🐞 Fix:F-060 WorkBuddy 会话 Cookie 不出 Rust——probe 回包剥离 cookie,入库改 Rust 现读直投后端 (b83539f2ba)
- 🔧 Chore/Other:结清 API F001-299 段 14 张工单(12 张 agent 修复 + F-83 本次补齐 + F-290 已收口) (9c1c70e95c)
- 📚 Docs:刷新生成块 testFiles/trackedFiles 到 HEAD 现算值(5109/21180) (b96aa6a4b8)
- 🐞 Fix:F-83 支付/退款/发票抬头/发票申请列表排序补 createdAt 决胜键(不再按随机 UUID v4 乱序) (6e0bfb42bb)
- 🐞 Fix:F-497 全量 upsert 失败抛错，不再让 BullMQ 记 completed (b1a875bbb7)
- 🐞 Fix:F-478 活动过期改单条集合 UPDATE 消除 N+1 (0fa3f22a12)
- 🐞 Fix:F-477 design 降级存储按键数与条数双重限界 (5d5611e883)
- 🐞 Fix:F-464 发货补 UUID 闸、仅已支付可发货且不覆盖原备注 (86c70d2902)
- 🐞 Fix:F-456 退款审核 action 改 zod enum 运行时校验 (3560883b73)
- 🐞 Fix:F-446 任务手动执行未接入返回 501 且不再写假成功日志 (c91214abe0)
- 🐞 Fix:F-439 模型完成未接入上游显式标记 stub，不再伪装真实输出 (a96f42df00)
- 🐞 Fix:F-438 内部/自定义渠道未接入投递不再上报 sent:true (247a3d13e3)
- 🐞 Fix:F-357 findMyMember 排除过期 VIP 并按到期时间判 hasVip (468423db89)
- 🐞 Fix:F-356 四处分页补 id 全序兜底 (b6bb2faed7)
- 🐞 Fix:F-344 实时流量快照缓存与 in-flight 按 source 分键 (b7f45ba6ef)
- 🐞 Fix:F-338/F-339 恢复探测排除手工停用 Key 并按巡检时间轮转 (3a94d3dc16)
- 🐞 Fix:DB-09 差值棘轮接入 CI + 存量认账 baseline (ec342b0432)
- 🐞 Fix:F-283 octet 上传路由显式声明 bodyLimit，2~100MiB 不再被全局 2MiB 静默 413 (c683f2dfe1)
- 🐞 Fix:F-291 SSE 缓冲淘汰流时清理待释放定时器 (4d25daaeab)
- 🐞 Fix:F-250/F-251 AI 世界列表 count 与 list 同条件、详情与分类补 status=1 (be6594d57d)
- 🐞 Fix:F-177 资讯推荐/排行批量取文章补 status=1，下架稿不再被推荐 (69ae61b217)
- 🐞 Fix:F-604 Openclaw 详情补 status 过滤 (cf899f92e9)
- 🐞 Fix:F-604 MCP 详情补 status 过滤 (fb61051a17)
- 🐞 Fix:F-595 AI Feed 详情补发布态过滤 (7421aa20e2)
- 🐞 Fix:F-642 admin-sys 分页参数夹取,防负值/超大 OFFSET (3373236dc0)
- 🐞 Fix:F-615 isPrivateIp 补 172.16/12 与 IPv6 ULA/link-local (10e932cf91)
- 🐞 Fix:F-622 出网代理装配日志脱敏,不落账密 (7974990411)
- 🐞 Fix:F-546 分片合并校验 etag 格式与 parts 上限(防 XML 注入) (ba1db63e61)
- 🐞 Fix:F-590 计费组回退默认组时补 enabled 校验 (8ea0ed7890)
- 📚 Docs:标注两处「判据完整但未接线」的模块,避免被当成已有能力 (ed1753c78d)
- 🐞 Fix:F-383/F-476 风控命中按主体索引且批量落库 (9ff58827fc)
- 🐞 Fix:F-328 终止命令改绝对路径/POSIX 内核信号，不走 PATH 裸名 (5a67e7a0c8)
- 🐞 Fix:F-325/F-326 关停 close 复用 in-flight 且超时计时器不再 unref (ac4ac63181)
- 🐞 Fix:F-318 访问来源分组 cap 前按 pv 降序排序 (227793b746)
- 🐞 Fix:F-312 登录异常通知仅在送达后写去重键并限制内存降级表 (040509eeb9)
- 🐞 Fix:F-308 阶梯定价未达最低档门槛时按原价计费 (9f114ad6cd)
- 🚀 Feature/Improvement:全局对话框接入个人号池通道 + 根因修 WS 全族租户闸 401 (4a00489261)
- 🔧 Chore/Other:员工请假端到端联调转 CI 契约回归测试(HR-3 固化防回归) (ab55a05484)
- 🐞 Fix:F-98 文章详情仅返回已发布稿件，草稿/下线返回 404 且不计浏览 (a7ba9ce514)
- 🐞 Fix:F-90 rerank 兜底 token 估算计入 documents，杜绝系统性少计费 (5213a432dd)
- 🐞 Fix:F-82 ensureMargin 改 onConflictDoNothing，并发首充不再 500 (e1f08a8eab)
- 🐞 Fix:F-81 短信接码快照归日统一上海时区，消除 8 小时错位与重复入库 (5555ded60a)
- 🐞 Fix:F-75 xss 请求体净化改挂 preValidation，body 已解析才生效 (1d8caab400)
- 🐞 Fix:F-25 /v1/assistants 游标排序补 id 决胜键，跨页不再重复漏行 (86676d31a1)
- 🐞 Fix:F-15 邀请码占用改为条件 UPDATE 抢占，杜绝并发双发奖励 (66f75db8d9)
- 🔧 Chore/Other:M26 快照棘轮更新 —— 25 键考古实证合法删行后重建行键快照 (fa8120cde9)
- 🔧 Chore/Other:结清 51 张源码修复注释已在 HEAD 但未勾选的工单(AIS/API/CLI 族) (ac00114794)
- 🔧 Chore/Other:结清 API F-398(schema 与迁移已对齐 uniqueIndex,27cff4fa99a) (313bcd526f)
- 🐞 Fix:DB-09 补齐 0371 快照(重基线含 shared_to_ops,快照门新增违规 65→16) (aa3d15a53d)
- 🐞 Fix:重迁 425ae8286fc 回灌的裸 git —— staging-snapshot 五处 + rn-compat 两处走 gitRaw (66bc4964ae)
- 🔧 Chore/Other:结清 43 张已修复漏勾工单(API/CLI/AIS 族,修复 commit 均在 HEAD 祖先) (1b31ee7b93)
- 🚀 Feature/Improvement:把回合运行态接进真实执行流 —— 不再是可调用但没人调的 API (5490760598)
- 🐞 Fix:7 文件裸 git 派生收口到统一承载层 face-reader (42b77be0b0)
- 🐞 Fix:收口推门 typecheck 红——4 个运维护脚本的 strict 空值/联合收窄 (442b5fe759)
- 📚 Docs:重生 README 数字生成块对齐 HEAD 现算值(过 DN2 push 门) (f4e6681168)
- 🐞 Fix:闭环 APK 降级误判 — 判据可信闸门 + 补回被覆盖的双写判据 + OTA 腿 fail-closed (ce1dd22efa)
- 🐞 Fix:本机即生产本地模式与任务状态枚举误译修正 (1393201a36)
- 📚 Docs:结清 F-20/F-23(业务日区间与退款分值) (584a4a4c20)
- 🐞 Fix:结清 F-20/F-23——业务日区间按上海日界、退款金额先取整成"分" (d3afc268d9)
- 🚀 Feature/Improvement:补连长任务闭环 —— 回合状态机 + 合成结束 + 挂起唤醒 + 目标态 (0b081f4784)
- 🐞 Fix:迁移回填语句改写为合法 SQL 并登记 journal(HR-3 第2期收尾) (4887fa9790)
- 📚 Docs:结清 AIS-063/064/077、F-123/130/132/143 七张缺陷票 (dded71b608)
- 🔧 Chore/Other:结清 F-015/F-028/F-093/F-126 四张缺陷普查工单 (ef57a14f75)
- 🐞 Fix:--status 穿透静默 VBS 包装验内层命令 + 号池全量互通口径落库 (dfe8356621)
- 🐞 Fix:结清 F-015/F-028/F-093/F-126 —— serve 退出码不再截断管道输出,凭据原子写钉 0600,TERM 黑名单补 emacs/eterm/vscode,读缓存补 ctime+inode 判据 (49613c3a9e)
- 🐞 Fix:结清 F-130——已支付/已退款订单禁止物理删除 (4c17897acf)
- 🚀 Feature/Improvement:新增迁移把 shared_to_ops 列默认值收口为 true (69d322a399)
- 🐞 Fix:结清 F-123——GitHub Trending 采集先收集再逐条 await 落库 (2619cbebf4)
- 🔧 Chore/Other:还原被 F-143 提交误带的 automation-card 改动 (eb63144e70)
- 🔧 Chore/Other:docs+test(relay-pool): zcode 显式声明不可续期 + 2026-11-12 桌面端取证复核落档 (e08e63d850)
- 🔧 Chore/Other:docs+test(relay-pool): zcode 显式声明不可续期 + 2026-11-12 桌面端取证复核落档 (a84606f5be)
- 📚 Docs:Y-37 二次诊断——裸域超时根因是CF橙云跨境回源非隧道协议,定方案B(EdgeOne补裸域证书+CF改回源),修正验收口径 (a7541cee39)
- 🐞 Fix:号池两枚「死号」实为活号 —— doubao ttwid 键名误配 + workbuddy global realm 误判 (9c2a2d3b0b)
- 🐞 Fix:结清 F-143——直播回调去重标记改为"成功后才落" (d1c62d5339)
- 🔧 Chore/Other:结清 F-061/F-104 两张缺陷普查工单 (86b8c35318)
- 🐞 Fix:结清 F-061/F-104 —— 剪贴板写权限只补本地 webview,operator 执行改一次性票据+原生确认 (32450a474e)
- 🐞 Fix:结清 F-132——POST /admin/users 请求契约自洽(统一为 password) (4a922df5d3)
- 🔧 Chore/Other:结清 F-004/F-005/F-048/F-070/F-074/F-080/F-085/F-095/F-098/F-101/F-102/F-123/F-136 十三张缺陷普查工单 (d845157848)
- 🐞 Fix:结清 F-004/F-048/F-085/F-123/F-136 五张缺陷普查工单并补 F-005 回归钉 (280d5beca2)
- 🐞 Fix:审批实例快照固化扩到代理/超时时限/升级目标全四件套(HR-3 第2期) (7dc3a322e7)
- 🐞 Fix:结清 AIS-077——知识卡片按属主收口,堵跨租户读/覆盖 (8218b28795)
- 🔧 Chore/Other:结清 F-040/F-064/F-065/F-066/F-067/F-072/F-081/F-082/F-083/F-084/F-086/F-097/F-124/F-125 十四张工单 (6a3655c3ff)
- 🐞 Fix:结清 F-040/F-064/F-065/F-066/F-067/F-072/F-081/F-082/F-083/F-084/F-086/F-097/F-124/F-125 十四张缺陷普查工单 (67985a1889)
- 📚 Docs:登记公网抖动观察待办——Cloudflared 已换 http2,观察 24-48h 再定是否动监控判据 (5a6bf20320)
- 🐞 Fix:结清 AIS-064——审批等待与串行工具执行纳入中断链 (30a366ca62)
- 🐞 Fix:根治 OTA 不可达 — 显式钉死 updates.enabled 并把 prebuild 固化进出包链 (246ea6c283)
- 🔧 Chore/Other:三条回灌腿双形态传参面补回归锁(tsx 侧行为直测+壳侧接线锁) (9badf79cf6)
- 🐞 Fix:审批超时升级扫到 escalated 态,治已升级实例到点未决永久卡死 (d3e9c2d311)
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
### GitHub App webhook async dispatch (registered 2026-11-06 — RP-69)
`POST /api/github-app/webhook` now answers first and processes later (Y-91) on the two dispatch paths, `pull_request` and `issue_comment`.
- **Env var**: `GITHUB_WEBHOOK_RESPONSE_BUDGET_MS` — the response budget in ms. It bounds how long GitHub is kept waiting; it is **not a cancellation timeout**: when the budget expires the handler returns 200 and the job keeps running to completion (no interruption, no retry), still recording the delivery.
- **Default**: 500 ms (`DEFAULT_RESPONSE_BUDGET_MS = 500`, read from source). Missing, non-finite or negative values all fall back to that default rather than being guessed. `0` selects the pure-async mode, which always returns 200 immediately.
- **New response field `dispatch`**: `'inline'` or `'async'`. If the job finishes within the budget the 200 carries `dispatch:'inline'` plus the existing `outcome` (the previous response shape is preserved); when the budget expires — or in `0` mode (`deferred`) — the 200 carries `dispatch:'async'` with no `outcome`, while the heavy work finishes in the background queue.
- **Known gap (deferred is not persisted)**: the dispatch queue is a one-shot in-process, in-memory queue — no resident service, no polling, no durable storage — and the delivery row is written only after the job finishes. If the API process crashes or restarts in the window after a `dispatch:'async'` 200 was sent but before the background job completes, both the in-memory job and the not-yet-written delivery row are lost. GitHub already recorded the delivery as successful and will not redeliver, and the in-process LRU deduper disappears with the process, so that delivery's review / comment write-back is silently lost, cannot be replayed and cannot be reconciled. This window is not closed by the current implementation (the execute-in-place fallback only covers a full backlog, not process exit).

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

<!-- 2026-11-07 全量收敛归档:本侧相对 base 独有行逐字保留(语义由对侧新版承载,零内容丢失) -->
Headline claims (same source as the table below, all live-computed): **624 tables · 4720 API routes ·
25 WebSocket endpoints · 100 catalogued LLMs · 38 platforms auto-publishing · 4341 test files ·
332 engineering gates · 55 CI workflows · 5-language i18n parity · 9 app packages · 16 shared packages ·
Headline claims (same source as the table below, all live-computed): **624 tables · 4720 API routes ·
Headline claims (same source as the table below, all live-computed): **624 tables · 4720 API routes ·
