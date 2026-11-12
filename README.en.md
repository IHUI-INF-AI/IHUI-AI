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
| WebSocket 端点 | 30 | `wsEndpoints` |
| 入库模型清单 | 100 | `llmModels` |
| 发布平台 | 38 | `publishPlatforms` |
| 端应用包 | 9 | `appPackages` |
| 共享包 | 17 | `sharedPackages` |
| CLI 命令文件 | 76 | `cliCommandFiles` |
| CLI 工具文件 | 104 | `cliToolFiles` |
| 语言 | 5 | `i18nLanguages` |
| i18n 作用域 | 7 | `i18nScopes` |
| 语言包 JSON | 35 | `i18nMessageFiles` |
| 测试文件 | 5017 | `testFiles` |
| CI 工作流 | 59 | `ciWorkflows` |
| Compose 服务 | 14 | `composeServices` |
| 工程守门 | 362 | `guardianGates` |
| — blocking | 333 | `guardianBlocking` |
| — warn | 31 | `guardianWarn` |
| 跟踪文件 | 21064 | `trackedFiles` |

上表由 `node scripts/sync-readme-numbers.mjs`(唯一写入口,索引面取数)生成,最后核对日期 2026-11-12。
每个数的来源就写在取数键旁边的实现里(`scripts/gen-doc-numbers.mjs` 的 `SOURCES`),**不得手抄、不得另立第二份**。

<!-- END GENERATED NUMBERS -->


## Recent updates (auto-maintained)

<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->
**2026-11-12**
- 📚 Docs:auto档同步四语 README（changelog/日期/F票记录，非逻辑代码） (a61cec7719)
- 🔧 Chore/Other:新增 §12d 停用防回归守门 check-worktree-dev-banned(316,blocking) (2f6997bf5f)
- 🔧 Chore/Other:结清 CLI F-002/003/006/007/008 与 API F-700/704 七条缺陷票（修复与回归已入库 b46128f309c） (559599bb3f)
- 🐞 Fix:结清 F-002/003/006/007/008/700/704——退出码、进程树回收、审计与 argv 脱敏、钱包与看板 int8 溢出 (b46128f309)
- 🔧 Chore/Other:结清 F-628/629/701/702/718 五条缺陷票（修复与回归已入库 5219f2440db） (f38f2aa4f1)
- 🐞 Fix:结清 F-628/629/718/701/702——中转成本改读真实列、退款回收赠送 token、余额不足扣成欠费并准入拦截、两处 SUM int8 溢出 (5219f2440d)
- 🐞 Fix:托盘拉起切号器用 cmd /d 关掉 AutoRun (245b9930be)
- 🐞 Fix:补 createBlacklist mock 修 blacklist fail-closed 回归 (e44bf1fc00)
- 🔧 Chore/Other:结清 F-40/76/77/87/91 五条缺陷票（修复与回归已入库 221e0cdaadf） (fdf49b2a2b)
- 🐞 Fix:结清 F-87/91/76/77/40 五条缺陷票——媒体代理计费、通知失败重试、PDF 合并上限、部门用户凭据投影、后台 Agent 有界回收 (221e0cdaad)
- 🐞 Fix:离线兜底页补齐状态告知并纠正薄壳降级描述 (be7035bb2b)
- 🐞 Fix:relay 临时目录清理失败不得吞掉业务结果 (2249dc260b)
- 📚 Docs:补开发版配置路径(两套 identifier 各写各的) (f139ac8ad6)
- 🔧 Chore/Other:prettier 格式化 README 的托盘示例数组 (10a2c27874)
- 📚 Docs:托盘 relay_switch 示例改放 quit 之前并说明分组理由 (21397faa33)
- 🐞 Fix:长上下文针测不再把推理模型截断误判为不支持 (bea1251881)
- 🐞 Fix:relay 的 JSON 捕获改临时文件 + 括号配平切载荷,修两处真实缺陷 (a446503454)
- 🔧 Chore/Other:结清 F-07/21/37/48/49 五条缺陷票（修复与回归已入库 abe1fa32fb4） (d1b0d99088)
- 🐞 Fix:结清 F-07/21/37/48/49 五条缺陷票——后台 Agent 归属、业务日键、积分发放补偿、图片任务原子认领、MCP 网关统一 deadline (abe1fa32fb)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (fac7b192d5)
- 🐞 Fix:拆定时炸弹——计划任务不再绑带版本号的 node 路径,自检扩到六项 (633222ecb9)
- 🔧 Chore/Other:结清 F-22/35/42/46/52 五条缺陷票（修复与回归已入库 96512fab9e6） (f4904682db)
- 🔧 Chore/Other:footer 回归用例改挂 public project,脱离登录口令依赖 (fb75f9c2a3)
- 🐞 Fix:relay 网关探测保留完整模型 id，修复 workbuddy 全家能力结论被 403 污染 (5c8c357b6a)
- 🚀 Feature/Improvement:托盘新增操作员专属「AI 客户端一键切号」入口(默认隐藏) (96512fab9e)
- 🐞 Fix:F-22 营收聚合改 bigint 且查询失败不再吞零, F-35 预扣结算失败重试并留对账标记, F-42 产物列表去同步IO, F-46 降级计数器可回收, F-52 终端历史 ZSET 分页 (5858f6aa8f)
- 🔧 Chore/Other:--status 日志行补注『空转轮不写日志』避免误判停滞 (a042e6c583)
- 🐞 Fix:首页移除微信小程序按钮并恢复 Gitee 仓库入口,修正 footer 三栏断点 (adb2d40849)
- 🐞 Fix:回收遗留在生产 checkout 的 A9 具名豁免(~initRoundShardResume) (e942aca9a1)
- 🔧 Chore/Other:结清 F-66/68/70/72/73 五条缺陷票（修复与回归已入库 629d7fca176） (754e9c1967)
- 🐞 Fix:F-66 批量取消条件更新入事务, F-70 OSS STS 策略收敛本人前缀与大小上限, F-72 webhook 触发防重放, F-73 出站 webhook 补 HMAC 签名, F-68 礼物账本回归 (629d7fca17)
- 🚀 Feature/Improvement:--status 一键健康自检 + 号池单测生产隔离修复与守门 (9ceeebf48a)
- 🐞 Fix:公开内容面(tools/news/articles/announcements)补免租户并钉回归锁 (90cc804c79)
- 🔧 Chore/Other:结清 F-36/38/47/50/71 五条缺陷票（修复与回归已入库 7b42edccc43） (0310fba8c1)
- 🚀 Feature/Improvement:选择器只显示前沿模型,同族保留最新两代 (4fefe37168)
- 🐞 Fix:F-36 邮件未发出即重试, F-47 备份 cron 落库前校验且失败保留旧调度, F-50 anthropic 端点补鉴权, F-71 回调日志收口管理员 (7b42edccc4)
- 🔧 Chore/Other:结清 F-58/59/60 三条缺陷票（修复与回归已入库 228f9f86db5） (148cefdd7f)
- 🐞 Fix:F-58 手机注册校验短信码, F-59 租户忽略客户端 plan 并保护 owner, F-60 上报忽略客户端 IP, F-57 授权码绑定 clientId, F-112 身份覆盖回归 (228f9f86db)
- 🐞 Fix:计划任务改 node.exe 直执行 + 脚本内置日志(实测 0xC000013A) (fac97bef4f)
- 🐞 Fix:补 /api/app-version/ 免租户并钉回归锁(治租户401潜伏雷) (c64375fa40)
- 🐞 Fix:落库载荷改回平台原生形状 + 拉回解析去 --json (9e9c213fd9)
- 🔧 Chore/Other:结清 F-86/88/107/108/110/111 六条缺陷票（修复与回归已入库 a83a802010e） (5fa69bc106)

**2026-11-11**
- 🐞 Fix:F-86 Realtime WS 复用共享鉴权与配额预检, F-88 batch 末次尝试才落终态, F-107/108 归属绑定, F-110/111 客服 WS 广播鉴权与槽位释放 (a83a802010)
- 🐞 Fix:同步改用平台原生导出形状 + core 四元组指纹 + raccoon 导出映射 (8f2e70765b)
- 🐞 Fix:工具探测强制 tool_choice=required、放宽到 45s、并发 8→4 (e84a2a3102)
- 🔧 Chore/Other:结清 F-61/62/63/103/104 五条缺陷票（HEAD 已修，本批复核既有回归 31 例全绿） (568a2043b4)
- 🚀 Feature/Improvement:号池跨环境双向自动同步(变更打点 + 收敛式对账 + 计划任务) (601488e231)
- 🔧 Chore/Other:结清 F-17/F-33 两条缺陷票（回归已入库 030cfde6994） (f132baea34)
- 🐞 Fix:F-55 补唯一 active 签名密钥吊销保护，F-17/33/54/56 补回归钉死 HEAD 既有修复 (030cfde699)
- 🚀 Feature/Improvement:悬浮球 hover 辉光 + 最小化图标固定默认落点 (16661511ca)
- 🔧 Chore/Other:结清 F-05/08/27/32/53 五条缺陷票（回归已入库 9a14f1d9ded） (5fbf1447e3)
- 🔧 Chore/Other:F-05/27/32 补回归钉死 HEAD 既有修复，F-53/F-08 补 fail-closed 细节，修 F-09 遗留 payment 测试桩 (9a14f1d9de)
- 🚀 Feature/Improvement:本地⇄生产号池自动同步互通(默认推生产 + --sync-pull 拉回) (bf820ca1ae)
- 🚀 Feature/Improvement:新增 ihui relay 命令组,把号池切号封装成可调用命令面 (bc4ce32477)
- 🔧 Chore/Other:结清 F-09/10/11/14/16 五条缺陷票(修复与用例已入库 920fbfc47f4) (d114992763)
- 🐞 Fix:HR-3 微信订阅消息字段 key 对齐真实模板(实测收尾) (bd1bd6091f)
- 🐞 Fix:F-09/11/14/16 修复（退款调渠道前抢占防双退/积分账本改会员级 advisory lock/扣费先占位幂等键再扣减/提现回调 rawBody fail-closed），F-10 复核已在 HEAD 修复并补用例 (920fbfc47f)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (8f5675e664)
- 🐞 Fix:工具探测预算 64→256,截断/限流记未知而非"不支持" (24c2ee20c7)
- 🐞 Fix:修两族报警真因——app-version端点补免租户 + A9轮起点腿登记豁免 (0417dc0dc2)
- 🐞 Fix:一键切号桌面快捷方式安装器覆盖新入口 (c916ffda00)
- 🐞 Fix:首页移除未合并的 awesome PR 拉票链接 (cbaa3e498c)
- 🔧 Chore/Other:结清 SDB-27/48/56 与 F-01/F-13 五条缺陷票(修复与用例已入库 e618edbfa81) (636a673c4e)
- 🐞 Fix:SDB-48/56 与 F-13 修复（Key 用量按 apiKeyId 归因/直聊补写用户轮/配额窗口重置进 WHERE），SDB-27 与 F-01 复核已在 HEAD 修复并补用例 (e618edbfa8)
- 🔧 Chore/Other:结清 SDB-36/38/39/49/54 五条缺陷票(修复与用例已入库 e63cafc9824) (a8dfdbfe37)
- 🐞 Fix:修复 SDB-36/38/39/49/54 五条缺陷（金丝雀阶段迁移 CAS/停用节点不再入结果/符号检索缺归属即拒/摘要列单写者防覆盖/导入周期判据复用调度器解析） (e63cafc982)
- 🚀 Feature/Improvement:首页 Star 按钮展示 GitHub 实时星标数 (9e6989d206)
- 📚 Docs:HR-1~HR-4 四行翻勾(人事部功能系列已交付并验证) (155a67f9f1)
- 🚀 Feature/Improvement:人事部功能系列 HR-1~HR-4 全量落地(代码层 + README 生成块) (a8cf8d4f4d)
- ⚡ Perf:仿真/真机池改有界并发，绑定口径对齐手机端免扫码 (a8a24b7aa6)
- 🚀 Feature/Improvement:探测升级为流式/工具/长上下文三项实测,选择器按行展示 (82fd86a2b3)
- 📚 Docs:deploy-feedback 自动登记(deploy_outcome;端到端反馈闭环第二切片,O65 自进化系列) (fe6283ecbe)
- 🔧 Chore/Other:结清 SDB-08/28/32/37/40 五条缺陷票(修复与用例已入库 54152ef) (2c729e29a1)
- 🐞 Fix:SDB-08/28/32/37/40 usage 兜底计 input/ERC20 复核倒序翻页/换票账号锁+CAS/DAG 取消传播/沙箱路径闸补全 (54152efcd5)
- 🐞 Fix:下调全局 accent,收口弹层菜单 hover 对比度 (67c74511fc)
- 🐞 Fix:relay 白名单按带前缀模型名登记,探测 403 时回退完整 id 复测 (0e673f6b5f)
- 🐞 Fix:站内消息已读状态落库,刷新后红点不再复活 (2d3cc78874)
- 🚀 Feature/Improvement:公众号合法微信绑定链脚手架(纯接口参数,真人授权收口) (dcf06a1333)
- 🐞 Fix:报警刷屏降噪——补7条族级24h窗口 + budget按日节流 (2e7658179a)
- 🔧 Chore/Other:精修站内消息二级菜单行距与底部入口 (cbc193027f)
- 🚀 Feature/Improvement:站内消息改悬停二级菜单并统一飞书式通知列表 (f25bcd435c)
- 🔧 Chore/Other:结清 SDB-05/17/35/41/42 五条缺陷票(修复与用例已入库 3948c58) (1b45537f33)
- 🐞 Fix:SDB-05/17/35/41/42 订阅无限配额流水/推荐重放/回滚未知态/spec 提交路径/cc-switch 导入校验 (3948c58b1f)
- 🐞 Fix:ModelOption 补齐 verified/healthError 字段,修复生产构建类型检查失败 (2573157b59)
- 🔧 Chore/Other:结清 SDB-03/06/07/09/30 五条缺陷票(修复与用例已入库) (949616c8ed)
- 🐞 Fix:修复 SDB-03/06/07/09/30 五条缺陷(0 天永不过期/限流原子化/刷新 TTL 未知/registry 字段净化/Crew 按 run 计费) (11ac3be553)
- 📚 Docs:固化纯接口参数翻判据的全量证伪证据 (d967a7cc6f)
- 🚀 Feature/Improvement:公众号任务真机实跑 LIVE 模式(达标即真实领奖) (5c29f08f8b)
- 🔧 Chore/Other:结清 SDB-01/04/26/29/31 五条缺陷票(修复与用例已入库 5280eac) (7d7c92075f)
- 🐞 Fix:区分已验证/未验证模型并修复平台中转模型 401 (2f7882cd32)
- 📚 Docs:deploy-feedback 自动登记(deploy_outcome;端到端反馈闭环第二切片,O65 自进化系列) (850f5805b0)
- 📚 Docs:deploy-feedback 自动登记(deploy_outcome;端到端反馈闭环第二切片,O65 自进化系列) (3a4f28a574)
- 🐞 Fix:修复 SDB-01/04/26/29/31 五条缺陷(设备令牌归属闸/不限窗口配额/PR 文件翻页/注销吊销凭据/团队记忆写权限) (5280eaca65)
- 📚 Docs:deploy-feedback 自动登记(deploy_outcome;端到端反馈闭环第二切片,O65 自进化系列) (8f5766750b)
- 🔧 Chore/Other:结清 SDB-10/11/12/33/44 五条缺陷票(修复与用例已入库 cbec88d) (7ba58a64de)
- 🚀 Feature/Improvement:公众号任务绑定生效闭环离线仿真(四阶段状态机) (f74e9163db)
- 🐞 Fix:修复 SDB-10/11/12/33/44 五条缺陷(历史配对顺序/事实归属守卫/PayPal custom_id/支付宝时间戳验收/过期先查链) (8547265806)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (6cbcf13264)
- 🔧 Chore/Other:结清 SDB-13/14/15/16/18 五条缺陷票(修复与用例已入库 f54f9bc) (94446abc23)
- 🐞 Fix:修复 SDB-13/14/15/16/18 五条缺陷(桥接流错误固化/接码响应校验/导入规则收紧/总线业务码/残缺备份闸门) (f54f9bcb0f)
- 🚀 Feature/Improvement:取证公众号订阅参数接口并接入引擎 (6c85d2c7d5)
- 🔧 Chore/Other:结清 SDB-19/20/21/34/43 五条缺陷票(修复与用例已入库 e5984c2) (94e5c1ee9f)
- 🐞 Fix:修复 SDB-19/20/21/34/43 五条缺陷(集成调用同源校验/stop 收尾超时/CTR 口径/偏好判真单点/检查失败升级上报) (e5984c2794)
- 🐞 Fix:补 health-gate-evidence 测试第4组逐维断言 + 521 误回滚收口票 (fc2c4f0180)
- 🔧 Chore/Other:结清 SDB-25/47/50/51/52 五条缺陷票(修复与用例已入库 06d0ece) (d065806d91)
- 🐞 Fix:修复 SDB-25/47/50/51/52 五条缺陷(回调双闸归一/推送桩 fail-closed/索引建目录/终端白名单 token 匹配/备案号批内去重) (06d0ecedd2)
- 🔧 Chore/Other:结清 SDB-22/23/24/53/55 五条缺陷票(修复与用例已入库 90ff53e) (00b2963c1b)
- 🐞 Fix:修复 SDB-22/23/24/53/55 五条缺陷(时间比较/导出截断标记/角色回落/告警窗口口径/Telegram 转义) (94abc74460)
- 🐞 Fix:刷新 README 生成块文件计数对齐合并后现算值 (7168cbe51f)
- 🔧 Chore/Other:撤销侧车归属 1042 条,开放任务全部回待接单面 (4dc85b0527)
- 🚀 Feature/Improvement:删除邀请功能 + 打通小浣熊每日签到长期自动化 (33333da419)
- 🔧 Chore/Other:活文档对齐远端 HM-1 归属牌声明位最新面 (d4b7861b3d)
- 🚀 Feature/Improvement:取证 travel/depart location_id 并补齐订阅任务自动领奖时序 (41c03f66af)
- 🔧 Chore/Other:活文档对齐远端 HM-1 第 0 步最新登记面,消除收敛落地闸的滞后副本 (be6bd133b6)
- 📚 Docs:HM-1 归属牌移到编号声明位(散文归属尺只认声明位) (024bc3bcad)
- 📚 Docs:HM-1 第 0 步入库留痕并改归机主真机验证面 (ea9e0112c3)
- ♻️ Refactor:elevation 档位补齐 Android elevation 并收口 CSS 别名第二源 (2a13b51128)
- 🐞 Fix:修 5 条既有红并收窄弹层高度扫描面 (cebb73dafb)
- ♻️ Refactor:浮层投影统一走 design-tokens ELEVATION_STEPS 档位 (adbe310621)
- ♻️ Refactor:收拢剩余 24 处 expo 调用,并把 picker 门面按包拆开 (511adddfe5)
- 🚀 Feature/Improvement:接通 skill_share 分享链并纳入全量自动驾驶巡检 (838bf0c1ea)
- 🐞 Fix:健康门禁 originOk 改为逐维救援,修复切流窗口 521 误回滚 (42d29418d3)
- 🚀 Feature/Improvement:建立平台适配层门面,收拢 7 个 expo 域(鸿蒙 A2 第 0 步) (19c81cf5eb)
- 🔧 Chore/Other:活文档对齐远端 Y-70/Y-3 最新裁决面,消除收敛落地闸的滞后副本 (b7567d8143)
- 🔧 Chore/Other:补浮窗档分屏禁用回归断言(防 360px 内再分栏溢出) (9b431d1b83)
- 📚 Docs:登记 HM-1 鸿蒙适配 A2 路线第0步(平台适配层) (435f437df6)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (879a4f2c0f)
- 🐞 Fix:将 APP REST 基址 www.aizhs.top 切到稳定的 api.aizhs.top(双保险其一) (2f0280ffde)
- 📚 Docs:补记 Y-70/Y-3 agent 侧子项已清零(仅剩机主凭据/备案/鸿蒙产物) (109c86e869)
- 🚀 Feature/Improvement:客户端会话镜像——根治双消费者轮换竞态(minimax grant 吊销实证) (de22e7492f)
- 🐞 Fix:切号三连修——G盘exe定位/explorer主通道/最小档兜底写回 (ba6fbdb528)
- 🔧 Chore/Other:活文档对齐远端归档移出后的最新面,消除收敛落地闸的滞后基线副本 (7729e5afef)
- 🔧 Chore/Other:重封清单对齐 4f4e686ec39aab301cfe2f755ad65f664eed1e54 规则面(guardian-runner 等门改动同枚落库以放行部署环 fail-closed) (6b50bea596)
- 🔧 Chore/Other:结清 RP-64 判据面追认积压(IG 门红0/门29已同步) (dceaebc5bd)
- 🔧 Chore/Other:追认孤儿目录壳清扫腿枚 2e16a53572 的 AGENTS.md 判据面命中 (96be0510e3)
- 🐞 Fix:修复 RN 邮箱验证码「点了没反应/无倒计时/收不到」三处根因 (889a6e6984)
- 📚 Docs:trackedFiles 计数刷新至 20846 (ad2c88fe37)
- 🐞 Fix:生产 app_versions.latest 的过期 OSS 签名直链做幂等收口 (4b46984084)
- 🐞 Fix:孤儿目录壳清扫腿收口 10 项代码审查(B1/B2/I1-I4/M1-M4)+镜像测试与 AGENTS 留痕,并重封根护栏清单清偿 HEAD 存量 fail-closed (2e16a53572)
- 🐞 Fix:预修还原被 52991b53 旧底稿同步误删的模型健康接线面(为收敛裁决 import 预立两侧动过形态) (27e5263140)
- 🐞 Fix:根治 APK 更新卡死(版本双写 fail-closed + installing 出口 + 服务端假阳性) (6e7f54552c)
- 🐞 Fix:旧底稿整份回退哨兵(提交面报警 + 推送前硬拦) (0de2c0c35a)
- 🔧 Chore/Other:追认i18n跨端门自检1枚 (43a6d76b7e)
- 🐞 Fix:i18n 跨端门自检登记器改为当场求值，5 条用例不再空跑 (03ddbc8fb7)
- 🔧 Chore/Other:README 数字块按索引面重算（门数 359/330、测试文件与跟踪文件同批） (cd25562745)
- 🚀 Feature/Improvement:新增 raccoon-crypto/invite 及测试 (0ae1139db2)
- 🔧 Chore/Other:同步开发改动（合并 origin/main 后落提交本地工作面） (52991b5365)
- 🔧 Chore/Other:合并面文档与生成物按对侧刷新（本侧零意图改动） (9d4ac189fb)
- 🔧 Chore/Other:撤回 ApiKeysScreen 三处档值微调，改由 302p 基线登记 (81b541ee47)
- 🐞 Fix:收敛器补转 --fold-keep 与 --declare-side-loss 两条声明出口 (99d0a54bfd)
- 🔧 Chore/Other:ui-routes 派生面按现 HEAD 面重生成落写回档(复量同面) (c32db7cb6c)
- 🐞 Fix:302p 基线复位 139 + ApiKeysScreen 非档值落档 (be504e408d)
- 🐞 Fix:守门 314→315 撞号让位与按钮描边门 RN 族存量纳管 (7a8a30ae04)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (8bb8cd956b)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (3fc9d80fe2)
- 🐞 Fix:门8 method 推断⑤段加块尾守卫——已闭合函数不再向匿名回调裸fetch借POST(修 edu-attendance e2e 假阳性;T5/T6 夹具钉住) (df51ce0ce5)
- 🔧 Chore/Other:追认人工归并枚 63d4ff3b92 的判据面命中(5 面) (8a7c580112)
- 🐞 Fix:恢复 425ae8286f 误删的 renderStablePin —— 陈旧副本收编把 scripts/lib/generated-input-pin.mjs 翻回 4ab41d4292 之前形态,抹掉稳定钉函数(33行),而调用方四端 generate-ui-routes 与镜像测试 generated-input-pin-stable.test.mjs 仍 import ⇒ 生成器全断(pre-commit --heal-ui-routes 即红)。逐字节回植 4ab41d4292 原版;镜像测试 6/6 绿,miniapp-taro/extension 生成器实测 exit 0。 (03abecfa6e)
- 🐞 Fix:菜单分割线全仓清零 26 处 + 族7豁免收窄为交互式手柄(根治 §66 后门) (917b33ec56)
- 🐞 Fix:WorkBuddy AI 版进程探测与域校验双臂修复 (84636f3175)
- 🔧 Chore/Other:漂移门基线全维刷新至尖 8ddc8d2256 —— 唯一恶化维 tierRnMissingN 134→142 逐处 file:line 证据:packages/app/src/features/api-keys/ApiKeysScreen.tsx:491/:573 paddingHorizontal:5、:492/:554/:574 paddingVertical:1(← 对侧 10f86bc743 共享屏下沉五处)+ packages/app/src/features/patrol/PatrolScreen.tsx:898 paddingVertical:1、:912/:921 gap:3(← 对侧 cd9a85fea2 patrol 屏三处);好转五维 fidelityHosted 239/fidelityPackAbsent 0/fidelityRetractionRot 0/mpTierLiteral 597/duplicateWebKeys 0 按终尖现读重置;evidence 锚点按尖行号重指 (a4d95d3a2c)
- 🔧 Chore/Other:settle B40 + docs-207 rows (both fix seats landed and independently verified) (52ccc1e94e)
- 🐞 Fix:docs-207 第二刀——摘除 207 条目被 9c7d050b58 回灌的 skipEnv 逃生舱(装车形态锁转绿,注册/消费面零命中) (4a17c3c321)
- 🐞 Fix:B40 compose 镜像 tag 缺省即失败(:?)+守门判据 + cli 测试补断言(typecheck:tests 214→0 余档,席已并入的测试修复另枚在账) (1022021cbe)
- 📚 Docs:合并面生成块数字按 HEAD 现读刷新 —— 仓库瘦身 181 件删除+对侧 4 批增量入库后 trackedFiles/字节数重量(173 号门 sync-readme-numbers 官方通道;LAND_ALLOW_STALE 显式声明:20836 是合并面实测非陈旧复活) (3742d33d25)
- 🐞 Fix:message-input 浮窗档强制显示工具栏文字 (forceToolbarText) (d1722cc7cc)
- 🔧 Chore/Other:settle RP-44/RP-45 (fix seats landed; cmd atomicity + api timezone single-source, tests green) (2c0497f4ce)
- 📚 Docs:re-register RP rows from recheck seat A (lost in stale-baseline revert 16787b7af5) (e166ad2269)
- 🔧 Chore/Other:re-settle 113 closed rows (revert 16787b7af5 restored stale ledger; re-applied per recheck seats A/B/C evidence) (13e55a10e3)
- 📚 Docs:README 与 GATEKEEPERS 更新 (67406951df)
- 🔧 Chore/Other:新增 updater 边界测试 (5e7b0d5785)
- 🔧 Chore/Other:新增 tui-fullscreen-keys/terminal 边界测试 (0c73922a67)
- 🐞 Fix:按钮边框色检查更新 (cb2c7b7cd8)
- 🚀 Feature/Improvement:workbench session rail 组件 (8021c1ba2e)
- 🔧 Chore/Other:新增 agent-extended/subagent-*/tool-*/trash-* 边界测试 (b8f0bbeec6)
- 🔧 Chore/Other:新增 sandbox/subagent-extended 测试 + scripts 按钮边框色检查更新 (9d00adf3c4)
- 🔧 Chore/Other:新增 permission-lease/plugin-cache-recovery/product-form 边界测试 (d3ae858f3b)
- 🔧 Chore/Other:pkg-ai 聊天样式 (5c8ebf534e)
- 🔧 Chore/Other:新增 nested-additional-properties/p1-evidence-gaps 边界测试 (10ab3224ab)
- 📚 Docs:AGENTS/PROJECT_PLAN 更新 (16787b7af5)
- 📚 Docs:守门人文档更新 (de4a868ae1)
- 🚀 Feature/Improvement:按钮边框色守门基线检查与 guardian-runner 更新 (a31648c4f1)
- 🚀 Feature/Improvement:patrol 屏组件 (756adf2fc4)
- 🚀 Feature/Improvement:关于联系页与 rn-compat 路由/壳生成物同步 (0d7fd2cf33)
- 🔧 Chore/Other:新增 hooks-trust-gate/lsp/machine-credentials/mcp-* 等边界测试 (edc4c860e8)
- 🚀 Feature/Improvement:多 admin/agent/edu/enterprise 页面与 AI/chat/云运行/客服组件更新 (8d0f79b817)
- 🔧 Chore/Other:补全 ACL/ACP/agent/权限/插件/后台/checkpoint/compaction/SSRF/hook 边界测试与 client-claims (ee6b7b1966)
- 🚀 Feature/Improvement:payment-recurring 上海时区下次扣费 + subscription/api-key-quota 日重置/biz-day/agent-extended 路由 (948597a9a7)
- 🚀 Feature/Improvement:relay-account 转发与号池模型健康监测(含上海时区修复与模型过滤) (9db6361988)
- 🐞 Fix:install-auto-deploy-task.cmd 去 /create /f 先拆后建,改 /query→/change 就地更新→缺才 create(RP-22, DBG-84 同族残余;镜像测试钉三判据) (02c145cf9e)
- 🐞 Fix:移除对已删除 coze-chat-queries 模块的悬空 vi.mock 引用 (c13291363f)
- 🔧 Chore/Other:持久声明补 README×4 与 miniapp i18n 生成件取对侧 (9e4f83dd6f)
- 🔧 Chore/Other:settle 16 rows from recheck seats B+C (infra 8 + business 8, evidence per-seat) (3f8cbf7bd1)
- 📚 Docs:register 2 RP rows from recheck seat A (DBG-84 cmd /f residue + DBG-7 local-calendar scatter x3) (300c53d6e9)
- 🔧 Chore/Other:settle 9 remaining DBG bug-hunt rows (recheck seat A: all CLOSED, fixed-without-marker, evidence per-file) (8bae5a7499)
- 🔧 Chore/Other:settle 88 DBG bug-hunt closed rows (code-face DBG markers + mirror tests verified; 完成即删) (3b509ce0bb)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (5201a66c50)
- 🐞 Fix:re-land intentional-delete coze-chat-queries.ts (2026-11-09 allowlist, dead query layer behind 404-ed endpoints; guardian heal resurrected it twice) + sync README trackedFiles blocks 20829->20828 (DN5) (e9bf534933)
- 🐞 Fix:scratch 墓碑回收腿 —— rmScratch 改名墓碑(.stale-<ts>)按名字死亡戳判龄(60 分钟下限,env 只加严不穿),不再被子树 mtime 6h 闸整轮错过;镜像 T32-T37 + 红证(旧码 2h 墓碑 0 候选) (d760f047a5)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (19b286097f)
- 🐞 Fix:containment 门撞号 175→314 + README 数字刷新与点名 (3b44a123ed)
- 🔧 Chore/Other:提交根目录文档 深度清理Git仓库垃圾文件.md (2a4dccdfc7)
- 🔧 Chore/Other:提交 scripts 的未提交改动 (90 文件) (425ae8286f)
- 🔧 Chore/Other:提交 root 的未提交改动 (9 文件) (2f66efbca8)
- 🔧 Chore/Other:提交 packages 的未提交改动 (50 文件) (b43093af88)
- 🔧 Chore/Other:提交 docs 的未提交改动 (4 文件) (2e0820129b)
- 🔧 Chore/Other:提交 deploy 的未提交改动 (8 文件) (5d8aff3ceb)
- 🔧 Chore/Other:提交 benchmarks 的未提交改动 (37 文件) (cb0aa51554)
- 🔧 Chore/Other:提交 apps/web 的未提交改动 (52 文件) (7b98c933c9)
- 🔧 Chore/Other:提交 apps/mobile-rn 的未提交改动 (51 文件) (058bb378c2)
- 🔧 Chore/Other:提交 apps/miniapp-taro 的未提交改动 (39 文件) (20933a9e52)
- 🔧 Chore/Other:提交 apps/extension 的未提交改动 (23 文件) (7b0fa29d98)
- 🔧 Chore/Other:提交 apps/desktop 的未提交改动 (2 文件) (e463066e2a)
- 🔧 Chore/Other:提交 apps/cli 的未提交改动 (20 文件) (a7271dbc0f)
- 🐞 Fix:R4 模板去路径字面量 + README 数字刷新与点名索引恢复 (5553d3bee8)
- 🔧 Chore/Other:提交 apps/api 的未提交改动 (70 文件) (174ebfed98)
- 🔧 Chore/Other:提交 apps/ai-service 的未提交改动 (171 文件) (87e5810c29)
- 🐞 Fix:根治 partial-clone 懒取回把判据/对齐拖死(2026-11-11) (01dfefb764)
- 🐞 Fix:robocopy maxBuffer 扩容根治回收删除腿 ENOBUFS 假失败 (919b3e600c)
- 🔧 Chore/Other:守门:README RECENT 块外禁增(5833953de0 复发防线) (d96cce0629)
- 🔧 Chore/Other:侧边栏三处字号 text-sm 收敛到 text-body 令牌 (b7dab01acd)
- 🔧 Chore/Other:📚 文档:裁掉 README 锚点外 37179 行历史散落(STRAY_OUTSIDE=4419 枚,写入器已归并最新条目进块) (eb182b6d0f)
- 🐞 Fix:回收器双出口 tag-then-remove + 空闲信号根治巡检污染 (637f750493)
- 🔧 Chore/Other:📚 文档:裁掉 README 锚点外 37179 行历史散落(STRAY_OUTSIDE=4419 枚,写入器已归并最新条目进块) (5833953de0)
- 🔧 Chore/Other:工作树回收射程扩至同盘兄弟检出并收紧空闲阈值到 1 天 (5721eab5cb)
- 🔧 Chore/Other:废弃 doubao-carry 对外方案并重构 relay 长连接与承载页; RepoWiki/Patrol 改用 design-tokens; 同步 cross-end 派生产物 (7740a55348)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (a51ee3250a)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (51af690876)
- 🔧 Chore/Other:壳声明件跟随新落承载页(260 条说明符) (b343fb9047)
- 🔧 Chore/Other:自动落 2 枚小程序壳承载页(共 2 枚待产) (b52af9a4d1)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (b5f52cd1d7)
- 🔧 Chore/Other:移除 miniapp-taro 下误提交的 mobile-rn 资产副本(13MB,无任何引用) (c33dd54e9b)
- 🔧 Chore/Other:清偿仓库体积并加字节级门禁 (956a075e99)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (2d5cff3c98)
- 🔧 Chore/Other:壳声明件跟随新落承载页(258 条说明符) (814f08dde7)
- 🔧 Chore/Other:自动落 2 枚小程序壳承载页(共 4 枚待产) (15ff9a606d)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (4ebde26fef)
- 📚 Docs:deploy-feedback 自动登记(deploy_outcome;端到端反馈闭环第二切片,O65 自进化系列) (a1678371fb)

**2026-11-12**
- 🔧 Chore/Other:新增 §12d 停用防回归守门 check-worktree-dev-banned(316,blocking) (2f6997bf5f)
- 🔧 Chore/Other:结清 CLI F-002/003/006/007/008 与 API F-700/704 七条缺陷票（修复与回归已入库 b46128f309c） (559599bb3f)
- 🐞 Fix:结清 F-002/003/006/007/008/700/704——退出码、进程树回收、审计与 argv 脱敏、钱包与看板 int8 溢出 (b46128f309)
- 🔧 Chore/Other:结清 F-628/629/701/702/718 五条缺陷票（修复与回归已入库 5219f2440db） (f38f2aa4f1)
- 🐞 Fix:结清 F-628/629/718/701/702——中转成本改读真实列、退款回收赠送 token、余额不足扣成欠费并准入拦截、两处 SUM int8 溢出 (5219f2440d)
- 🐞 Fix:托盘拉起切号器用 cmd /d 关掉 AutoRun (245b9930be)
- 🔧 Chore/Other:结清 F-40/76/77/87/91 五条缺陷票（修复与回归已入库 221e0cdaadf） (fdf49b2a2b)
- 🐞 Fix:结清 F-87/91/76/77/40 五条缺陷票——媒体代理计费、通知失败重试、PDF 合并上限、部门用户凭据投影、后台 Agent 有界回收 (221e0cdaad)
- 🐞 Fix:离线兜底页补齐状态告知并纠正薄壳降级描述 (be7035bb2b)

**2026-11-11**
- 🐞 Fix:HR-3 微信订阅消息字段 key 对齐真实模板(实测收尾) (0fe40d5929)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (8f5675e664)
- 🐞 Fix:修两族报警真因——app-version端点补免租户 + A9轮起点腿登记豁免 (0417dc0dc2)

**2026-11-11**
- 📚 Docs:HR-1~HR-4 四行翻勾(人事部功能系列已交付并验证) (155a67f9f1)
- 🚀 Feature/Improvement:人事部功能系列 HR-1~HR-4 全量落地(代码层 + README 生成块) (a8cf8d4f4d)
- 📚 Docs:deploy-feedback 自动登记(deploy_outcome;端到端反馈闭环第二切片,O65 自进化系列) (fe6283ecbe)
- 🔧 Chore/Other:结清 SDB-08/28/32/37/40 五条缺陷票(修复与用例已入库 54152ef) (2c729e29a1)
- 🐞 Fix:SDB-08/28/32/37/40 usage 兜底计 input/ERC20 复核倒序翻页/换票账号锁+CAS/DAG 取消传播/沙箱路径闸补全 (54152efcd5)
- 🐞 Fix:下调全局 accent,收口弹层菜单 hover 对比度 (67c74511fc)
- 🐞 Fix:relay 白名单按带前缀模型名登记,探测 403 时回退完整 id 复测 (0e673f6b5f)
- 🐞 Fix:站内消息已读状态落库,刷新后红点不再复活 (2d3cc78874)
- 🚀 Feature/Improvement:公众号合法微信绑定链脚手架(纯接口参数,真人授权收口) (dcf06a1333)
- 🐞 Fix:报警刷屏降噪——补7条族级24h窗口 + budget按日节流 (2e7658179a)
- 🔧 Chore/Other:精修站内消息二级菜单行距与底部入口 (cbc193027f)
- 🚀 Feature/Improvement:站内消息改悬停二级菜单并统一飞书式通知列表 (f25bcd435c)
- 🔧 Chore/Other:结清 SDB-05/17/35/41/42 五条缺陷票(修复与用例已入库 3948c58) (1b45537f33)
- 🐞 Fix:SDB-05/17/35/41/42 订阅无限配额流水/推荐重放/回滚未知态/spec 提交路径/cc-switch 导入校验 (3948c58b1f)
- 🐞 Fix:ModelOption 补齐 verified/healthError 字段,修复生产构建类型检查失败 (2573157b59)
- 🔧 Chore/Other:结清 SDB-03/06/07/09/30 五条缺陷票(修复与用例已入库) (949616c8ed)
- 🐞 Fix:修复 SDB-03/06/07/09/30 五条缺陷(0 天永不过期/限流原子化/刷新 TTL 未知/registry 字段净化/Crew 按 run 计费) (11ac3be553)
- 📚 Docs:固化纯接口参数翻判据的全量证伪证据 (d967a7cc6f)
- 🚀 Feature/Improvement:公众号任务真机实跑 LIVE 模式(达标即真实领奖) (5c29f08f8b)
- 🔧 Chore/Other:结清 SDB-01/04/26/29/31 五条缺陷票(修复与用例已入库 5280eac) (7d7c92075f)
- 🐞 Fix:区分已验证/未验证模型并修复平台中转模型 401 (2f7882cd32)
- 📚 Docs:deploy-feedback 自动登记(deploy_outcome;端到端反馈闭环第二切片,O65 自进化系列) (850f5805b0)
- 📚 Docs:deploy-feedback 自动登记(deploy_outcome;端到端反馈闭环第二切片,O65 自进化系列) (3a4f28a574)
- 🐞 Fix:修复 SDB-01/04/26/29/31 五条缺陷(设备令牌归属闸/不限窗口配额/PR 文件翻页/注销吊销凭据/团队记忆写权限) (5280eaca65)
- 📚 Docs:deploy-feedback 自动登记(deploy_outcome;端到端反馈闭环第二切片,O65 自进化系列) (8f5766750b)
- 🔧 Chore/Other:结清 SDB-10/11/12/33/44 五条缺陷票(修复与用例已入库 cbec88d) (7ba58a64de)
- 🚀 Feature/Improvement:公众号任务绑定生效闭环离线仿真(四阶段状态机) (f74e9163db)
- 🐞 Fix:修复 SDB-10/11/12/33/44 五条缺陷(历史配对顺序/事实归属守卫/PayPal custom_id/支付宝时间戳验收/过期先查链) (8547265806)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (6cbcf13264)
- 🔧 Chore/Other:结清 SDB-13/14/15/16/18 五条缺陷票(修复与用例已入库 f54f9bc) (94446abc23)
- 🐞 Fix:修复 SDB-13/14/15/16/18 五条缺陷(桥接流错误固化/接码响应校验/导入规则收紧/总线业务码/残缺备份闸门) (f54f9bcb0f)
- 🚀 Feature/Improvement:取证公众号订阅参数接口并接入引擎 (6c85d2c7d5)
- 🔧 Chore/Other:结清 SDB-19/20/21/34/43 五条缺陷票(修复与用例已入库 e5984c2) (94e5c1ee9f)
- 🐞 Fix:修复 SDB-19/20/21/34/43 五条缺陷(集成调用同源校验/stop 收尾超时/CTR 口径/偏好判真单点/检查失败升级上报) (e5984c2794)
- 🐞 Fix:补 health-gate-evidence 测试第4组逐维断言 + 521 误回滚收口票 (fc2c4f0180)
- 🔧 Chore/Other:结清 SDB-25/47/50/51/52 五条缺陷票(修复与用例已入库 06d0ece) (d065806d91)
- 🐞 Fix:修复 SDB-25/47/50/51/52 五条缺陷(回调双闸归一/推送桩 fail-closed/索引建目录/终端白名单 token 匹配/备案号批内去重) (06d0ecedd2)
- 🔧 Chore/Other:结清 SDB-22/23/24/53/55 五条缺陷票(修复与用例已入库 90ff53e) (00b2963c1b)
- 🐞 Fix:修复 SDB-22/23/24/53/55 五条缺陷(时间比较/导出截断标记/角色回落/告警窗口口径/Telegram 转义) (94abc74460)
- 🐞 Fix:刷新 README 生成块文件计数对齐合并后现算值 (7168cbe51f)
- 🔧 Chore/Other:撤销侧车归属 1042 条,开放任务全部回待接单面 (4dc85b0527)
- 🚀 Feature/Improvement:删除邀请功能 + 打通小浣熊每日签到长期自动化 (33333da419)
- 🔧 Chore/Other:活文档对齐远端 HM-1 归属牌声明位最新面 (d4b7861b3d)
- 🚀 Feature/Improvement:取证 travel/depart location_id 并补齐订阅任务自动领奖时序 (41c03f66af)
- 🔧 Chore/Other:活文档对齐远端 HM-1 第 0 步最新登记面,消除收敛落地闸的滞后副本 (be6bd133b6)
- 📚 Docs:HM-1 归属牌移到编号声明位(散文归属尺只认声明位) (024bc3bcad)
- 📚 Docs:HM-1 第 0 步入库留痕并改归机主真机验证面 (ea9e0112c3)
- ♻️ Refactor:elevation 档位补齐 Android elevation 并收口 CSS 别名第二源 (2a13b51128)
- 🐞 Fix:修 5 条既有红并收窄弹层高度扫描面 (cebb73dafb)
- ♻️ Refactor:浮层投影统一走 design-tokens ELEVATION_STEPS 档位 (adbe310621)
- ♻️ Refactor:收拢剩余 24 处 expo 调用,并把 picker 门面按包拆开 (511adddfe5)
- 🚀 Feature/Improvement:接通 skill_share 分享链并纳入全量自动驾驶巡检 (838bf0c1ea)
- 🐞 Fix:健康门禁 originOk 改为逐维救援,修复切流窗口 521 误回滚 (42d29418d3)
- 🚀 Feature/Improvement:建立平台适配层门面,收拢 7 个 expo 域(鸿蒙 A2 第 0 步) (19c81cf5eb)
- 🔧 Chore/Other:活文档对齐远端 Y-70/Y-3 最新裁决面,消除收敛落地闸的滞后副本 (b7567d8143)
- 🔧 Chore/Other:补浮窗档分屏禁用回归断言(防 360px 内再分栏溢出) (9b431d1b83)
- 📚 Docs:登记 HM-1 鸿蒙适配 A2 路线第0步(平台适配层) (435f437df6)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (879a4f2c0f)
- 🐞 Fix:将 APP REST 基址 www.aizhs.top 切到稳定的 api.aizhs.top(双保险其一) (2f0280ffde)
- 📚 Docs:补记 Y-70/Y-3 agent 侧子项已清零(仅剩机主凭据/备案/鸿蒙产物) (109c86e869)
- 🚀 Feature/Improvement:客户端会话镜像——根治双消费者轮换竞态(minimax grant 吊销实证) (de22e7492f)
- 🐞 Fix:切号三连修——G盘exe定位/explorer主通道/最小档兜底写回 (ba6fbdb528)
- 🔧 Chore/Other:活文档对齐远端归档移出后的最新面,消除收敛落地闸的滞后基线副本 (7729e5afef)
- 🔧 Chore/Other:重封清单对齐 4f4e686ec39aab301cfe2f755ad65f664eed1e54 规则面(guardian-runner 等门改动同枚落库以放行部署环 fail-closed) (6b50bea596)
- 🔧 Chore/Other:结清 RP-64 判据面追认积压(IG 门红0/门29已同步) (dceaebc5bd)
- 🔧 Chore/Other:追认孤儿目录壳清扫腿枚 2e16a53572 的 AGENTS.md 判据面命中 (96be0510e3)
- 🐞 Fix:修复 RN 邮箱验证码「点了没反应/无倒计时/收不到」三处根因 (889a6e6984)
- 📚 Docs:trackedFiles 计数刷新至 20846 (ad2c88fe37)
- 🐞 Fix:生产 app_versions.latest 的过期 OSS 签名直链做幂等收口 (4b46984084)
- 🐞 Fix:孤儿目录壳清扫腿收口 10 项代码审查(B1/B2/I1-I4/M1-M4)+镜像测试与 AGENTS 留痕,并重封根护栏清单清偿 HEAD 存量 fail-closed (2e16a53572)
- 🐞 Fix:预修还原被 52991b53 旧底稿同步误删的模型健康接线面(为收敛裁决 import 预立两侧动过形态) (27e5263140)
- 🐞 Fix:根治 APK 更新卡死(版本双写 fail-closed + installing 出口 + 服务端假阳性) (6e7f54552c)
- 🐞 Fix:旧底稿整份回退哨兵(提交面报警 + 推送前硬拦) (0de2c0c35a)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (3fc9d80fe2)
- 🐞 Fix:门8 method 推断⑤段加块尾守卫——已闭合函数不再向匿名回调裸fetch借POST(修 edu-attendance e2e 假阳性;T5/T6 夹具钉住) (df51ce0ce5)

**2026-11-11**
- 🔧 Chore/Other:追认i18n跨端门自检1枚 (43a6d76b7e)

**2026-11-11**
- 🐞 Fix:i18n 跨端门自检登记器改为当场求值，5 条用例不再空跑 (03ddbc8fb7)
- 🔧 Chore/Other:README 数字块按索引面重算（门数 359/330、测试文件与跟踪文件同批） (cd25562745)

**2026-11-11**
- 🐞 Fix:推送分叉自动收敛 + 落地复跑按落地面收窄 + 声明持久化(根治每次推送卡 5-20 分钟) (7265f95f404)
- 🚀 Feature/Improvement:豆包接入签到体系——第五平台全链路接线 (b4cca8b95bb)
- 🚀 Feature/Improvement:签到 API 定稿——detail+checkin 双接口,web 指纹实测定稿 (2ef06ac58be)
- 🐞 Fix:回放文本安全阀——非文本消息占位 + 总长截断 (40cb7783939)
- 🐞 Fix:回放文本安全阀——非文本消息占位 + 总长截断 (d692451deaa)
- 🔧 Chore/Other:给「喂 stdin」修复加装车锁(防回退 inherit 静默复发) (e3273d5391c)
- 🐞 Fix:worker 推送显式喂 pre-push 的 ref 行,水印门不再恒「未判定」 (d9f528d9236)
- 🐞 Fix:远端协议白名单放宽为 https+ssh(本机唯一通道;窗口闸与危险协议拒绝不动) (d33cd67cbbc)
- 🔧 Chore/Other:登记远端删除的 20261111000000 迁移件(删除随合并传播) (987d6e3e8ea)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (f446a0ffc30)
- 🔧 Chore/Other:钉住 renderStablePin 的五个收敛条件(防自激链静默复活) (db32cc91be6)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (a4cbcba5bdd)
- 🐞 Fix:生成物自述钉改为稳定钉,掐断「重生成→收编」自激链 (4ab41d4292b)
- 🐞 Fix:readDoubaoCookie 补 .bytedance.com 域的 msToken 风控票 (2541964724c)
- 🔧 Chore/Other:彻底移除系统 Administrator 凭据轮换违规迁移 (8955918c3bb)
- 🔧 Chore/Other:补 relay 号池批量推送脚本的溯源水印(远端新增文件漏注) (0f70833b764)
- 🔧 Chore/Other:文档自动更新游标推进(last-sha) (cc432ddf82b)
- 📚 Docs:自动刷新最近更新块 + 游标推进 (415e137dd6a)
- 🔧 Chore/Other:nav-styles 箭头常量按 prettier 折行(仅格式) (bf36876c96b)
- 🐞 Fix:侧栏交互项统一 —— 选中态反色、暗色 hover 纯黑、登录与导航同构 (8b37e3972ee)
- 📚 Docs:补本地开发开关说明,并纠正租户严格模式默认值口径 (ca35093984f)
- 🔧 Chore/Other:收编守护落档产出(2 件,凭落点账本) (702e0df09c4)
- 🔧 Chore/Other:重算四端 ui-routes 与 rn-route-map + knip/README 数字同步 (68c0e32d3a2)
- 🐞 Fix:同平台重复治理 —— zcode 键源补链 + 签到归属迁移收养 (2c72a450ece)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (f40d9ae05fb)
- 🐞 Fix:系统管理员凭据轮换例外 —— 仅放行 password_hash 变更 (727f76a0c5d)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (2696dd5c875)
- 🐞 Fix:导出/回放腿按 2026-11-11 真机实证修正三处假绿 (d959839357b)
- 🔧 Chore/Other:壳声明件跟随新落承载页(260 条说明符) (b0edc59ca86)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (df38ca133d7)
- 🔧 Chore/Other:自动落 2 枚小程序壳承载页(共 2 枚待产) (f8075c6c40e)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (82fdd009e19)
- 🐞 Fix:补齐 UpstreamSocketOpenOptions.heartbeatMs 契约并收口两脚本类型错(清 T1) (6756238fb01)
- 🚀 Feature/Improvement:登录锁定支持账号豁免名单,默认关闭 (ab97a2a5fca)
- 🐞 Fix:清掉测试面 typecheck 里长连接 lane 的 6 个存量错误 (9573af5378f)
- 🔧 Chore/Other:壳声明件跟随新落承载页(258 条说明符) (155a5b4d4be)
- 🔧 Chore/Other:自动落 2 枚小程序壳承载页(共 4 枚待产) (7eb6b47f007)
- 📚 Docs:自动刷新最近更新块 (9f1dafe915f)
- 📚 Docs:自动刷新最近更新块(收敛循环) (deda1ac0ffe)
- 🐞 Fix:扫码面板取消自动弹协议窗,改为内联同意并继续 (23e6125fd96)
- 🚀 Feature/Improvement:上游会话续写缓存 —— 同会话多轮透传 conversation_id,不再每次重建对话 (ec105c40232)
- 📚 Docs:自动刷新最近更新块(收敛循环) (d5e9ecf561b)
- 🚀 Feature/Improvement:回放迁移腿 —— 旧号对话以新会话进新号,豆包切号后可接着聊 (1af0dce1f43)
- 📚 Docs:刷新生成块数字(trackedFiles 20934→20936,并入 relay 长连接收口 2 个新文件) (52848a9f7e5)
- 📚 Docs:自动刷新最近更新块 + 游标跟进 cb64a7fd1c (86abb395e5b)
- 🐞 Fix:启动门只等必需后端三件套,/health 免租户(修 240s 假死) (3460206c423)

**2026-11-10**
- ⚡ Perf:全池推生产合并为单次 SSH 握手，能力探针与导出并行 (e4008a1a7a7)
- 📚 Docs:刷新生成块数字(trackedFiles 20930→20934,并入远端 4 个新脚本路径) (cb64a7fd1c4)
- 🔧 Chore/Other:同步小程序 entry 清单(新增 2 枚壳承载页后页面数 331→333) (13e9ad2c965)
- 🐞 Fix:长连接收口——代理隧道 agent、会话级亲和键、看门狗补全 (14dcbd290d5)
- 🐞 Fix:侧边栏选中态降对比 —— 统一 sidebar-active 弱底(明暗主题) (104ed9e8f95)
- 🐞 Fix:豆包跨号会话云端归档腿 + 一键入口文案据实测更新 (8068aa017c8)
- 🚀 Feature/Improvement:号池导入支持批量与生产推送，全池迁生产收敛为一条命令 (da8d7b06061)
- 📚 Docs:刷新生成块数字(relay 长连接 4 文件并入致 trackedFiles+4/testFiles+2/wsEndpoints+1/apiRoutes+1) (993f458ebf0)
- 🔧 Chore/Other:壳声明件跟随新落承载页(258 条说明符) (a83db3919eb)
- 🔧 Chore/Other:自动落 2 枚小程序壳承载页(共 4 枚待产) (7ce25c7a45a)
- 🐞 Fix:会话对账器补字节级兜底 —— 库被清空也不再是盲区 (df6082c173f)
- 🐞 Fix:base.css 第二份源纳入小程序 token 同步触发面 并补全 T1 配套断言 (36d956d285f)
- 🔧 Chore/Other:补 relay 长连接 4 个新增文件的溯源水印 (45e114f364a)
- 🚀 Feature/Improvement:号池 relay 全链路长连接贯通(契约+传输层+选路+WS 入口) (87e9aad2af0)
- 🚀 Feature/Improvement:对话随行落到实处 + WorkBuddy/OpenCode 写回真打通 (250ec2e0e34)
- 🐞 Fix:补 miniapp-taro 词包 eduAi 命名空间 20 键 清门 302p (9ea36e90cb7)
- 🐞 Fix:豆包 chat 打通 —— POST /chat/completion + SSE,推翻「走长连接」误判 (54148716627)
- 🔧 Chore/Other:补两枚判据面收敛提交的具名追认行 (636bde65293)
- 🐞 Fix:豆包 chat 打通 —— POST /chat/completion + SSE,推翻「走长连接」误判 (44404bb5e28)
- 🔧 Chore/Other:ui-routes 四端重算 + knip 受管块同步 (External-Red-Audit / Push-Channel: direct-merge) (94dcbdd310f)
- 🔧 Chore/Other:生成器重算收口 — sync-readme-numbers / gen-ui-routes / gen-i18n-compressed / gen-knip (External-Red-Audit / Push-Channel: direct-merge) (3cc4c48fdbb)
- 🐞 Fix:收尾修复 — 门 128 platform 非法 + docs 同步 + RN 残留清理 (55b19ffe086)
- 🐞 Fix:豆包适配器判活改走 IM batch_get,实证替换全部推断值 (57f105e3f0c)
- 🐞 Fix:豆包适配器判活改走 IM batch_get,实证替换全部推断值 (00a62e9b2e6)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (0ba0746bb83)
- 🐞 Fix:修掉「写了但客户端不认」的两型 —— MiniMax 记录形状污染 + OpenCode v2 落点失效 (0c17085f7da)
- 🐞 Fix:余额端点二次实证纠正(改 points/records + 100001 非失效,避免误杀有效号) (68c93885b46)
- 🐞 Fix:余额端点实证落地(域名+路径+token 头三重纠错,缺票不判死) (ffcff7a443d)
- 🐞 Fix:一键切号写回腿根治 + 缺模板拒写 + 会话模板回填器物 (136b39adffc)
- 🚀 Feature/Improvement:小程序/RN 中文回退链同源 + RN 端自托管方案根因收口 (9fb83e175b5)
- 🚀 Feature/Improvement:web 正文 400 档分段 unicode-range 按需面 + 门 313 跨端触发面补齐 (57d84775b4d)
- 🚀 Feature/Improvement:一键切号窗口实时显示各平台余额(未支持如实标注,不编 0) (c1aebcd0acc)
- 🔧 Chore/Other:裸 git 派生迁 gitRaw 层 收口棘轮例19 (450f4531184)
- 🐞 Fix:收口 gate-test(6) 两枚 Linux 专属红(abort 漏判 + 原子写夹具漂移) (3e662520bcf)
- 🐞 Fix:修复永久保活号静默饿死(server 档未判定放行 + minimax 探针接线 + 1h 节拍) (6a6c3cfcd4a)
- 🚀 Feature/Improvement:门 313 登记维断判据根治 + 属主登记补漏 + token 档位同源 (9dd458b22bc)
- ♻️ Refactor:门体自检的 cat-file 取材收敛到 face-reader 取材层 (a8ad54d2111)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (aef27ba3d9a)
- 📚 Docs:数字块按 HEAD 面重算（与推门 check-doc-numbers 同面） (7c9999939f0)
- 🐞 Fix:补迁 check-hook-chain-refs 的跨行裸 git 派生 (46dd3e0b864)
- 🐞 Fix:五处裸 git 派生迁到统一承载层 gitRaw（清门193与测试面两条欠账） (264c676468c)
- 🐞 Fix:门313 补 T4 书写面臂——品牌/子集/display 族所在栈一律配中文现代黑体兜底 (d786ae8aef7)
- ⚡ Perf:接线对账门多模式 grep 分片,真仓全量 43.8s→8.7s (a381e3a33fa)
- 🐞 Fix:恢复 /llm/models 路由挂载并消除 build_model_catalog 自递归 (3e8fdd3d4d4)
- 🚀 Feature/Improvement:三端滚动边缘淡出 ScrollEdgeFades + 抽屉/底部遮罩细化 (acdd5f169e0)
- ⚡ Perf:祖先取材改逐路径并发,18 条 M 路径 44.8s→19.4s (c6bb81e5844)
- ⚡ Perf:祖先取材按 HEAD+路径记忆,同轮不再为同一路径走两遍全历史 (d0b4aad6715)
- ⚡ Perf:3b 对账延后到后台 + 逐路径覆盖结论缓存,提交链 116.7s→28s (7ab84a93144)
- ⚡ Perf:水印提交档分母收窄到本次携带,单门 24.5s→1.0s (0cf426141b0)
- ⚡ Perf:30a 悬空集合单列缓存,提交链守门实测 309s→69s (775ca7e7837)
- 🐞 Fix:合并后按 token 档归一 inline-question-card 字号与字重 (10e5b33bb52)

**2026-11-08**
- 🚀 Feature/Improvement:补齐 AI 生成显式/隐式标识 (8d972f386c6)
- 🚀 Feature/Improvement:补齐 AI 生成显式/隐式标识 (f4535c338e9)
- 🚀 Feature/Improvement:Groups 屏薄壳承载落地(RN 壳同源渲染,词条取 web 原文) (e7d27e3e994)

**2026-11-07**
- 🐞 Fix:补 web 端 apiKeys en/ko 译文(24 键,清门 4 pending) (5e1c14de23a)
- 🐞 Fix:四屏壳改桶导入,补门173共享屏直接 import 覆盖 (e71cd19a5d6)
- 🚀 Feature/Improvement:TeamKnowledge 屏下沉共享屏,RN/Web 同源渲染零降级 (c0ca814f166)
- 🔧 Chore/Other:重算 rn-shells.generated.d.ts（补 VipTraderScreen，修门 251 C9 不同步） (fa6c08282d1)
- 🐞 Fix:RepoWiki 生成禁用提示回到宿主(详情内重复入口去重后补齐可发现性;删 web 失用键 refresh/regenerate) (a3dc7d1bc5f)
- 🚀 Feature/Improvement:RepoWiki 共享屏下沉(RN/Web 同源渲染,零降级) (b37e84d18cd)
- 🐞 Fix:Groups 三列断点卡片基宽 (97cb9752de7)
- 🚀 Feature/Improvement:Groups 屏下沉共享屏,两端宿主注入 (39fcfc991bb)
- 🚀 Feature/Improvement:Patrol 屏下沉共享屏,两端宿主注入 (cd9a85fea20)
- 🚀 Feature/Improvement:ApiKeys 屏下沉共享屏,web/mobile-rn 五语言词表补齐 (10f86bc743f)
- ♻️ Refactor:EarnCommission 壳删冗余 View 层(共享屏根已等价提供 flex+背景) (62cb2eaa1f9)
- 🚀 Feature/Improvement:TokenValue 记录时间范围条下沉共享屏(数据型注入点,RN/小程序同源) (e7c52e45ba2)
- 🚀 Feature/Improvement:8 条单端槽位裁决落锁,2 条真下沉 (72a500c1156)
- 🔧 Chore/Other:再 rebase 后生成器取胜, 刷新 ui-routes 钉值与 README 数字 (5c833a7bbc5)

**2026-11-06**
- 🚀 Feature/Improvement:补齐 Team/MessageCenter/ArticleList/Coupon 行为型 prop 跨端缺口并清理死契约 (a872076ccc9)

**2026-11-09**
- 📚 Docs:合并面 0d503a4 数字按唯一写入口现算刷新(trackedFiles 20612/testFiles 4768) (1c27bda99a)
- 🔧 Chore/Other:perf(sag2)+feat(sag2): 扫描件 OCR 四级链落地；多跳检索等价提速 4.4×（召回结果逐条不变） (abd73298e4)
- 📚 Docs:trackedFiles 20577->20578 / testFiles 4753->4754(上一枚新增 tests/test_agent_loop_tools_wire.py) (fd62c925ce)
- 🐞 Fix:派工 tools 从未进入模型请求 —— 接上转发并把参数面改成分层瘦身 (fd5f2a1243)

**2026-11-09**
- 🔧 Chore/Other:入库11-08远端分支只读清点工单+防火墙禁用滚动留痕(README数字块DN5同源刷新) (0646e1d290)
- 🚀 Feature/Improvement:真文件监听 + 音视频转写 + 图片OCR，并修掉建库平方级开销（229×） (7d2e787bcf)
- 🚀 Feature/Improvement:本地文件夹登记/增量扫描 + 7 类格式抽取 + 接入 RAG 第三路与 Agent 门面 (8ed115c505)
- 🚀 Feature/Improvement:批次3-2 钩子链引用完整性门落地(4fbf 归档移植,号 312→305/305p) (0b74581c6b)
- 🚀 Feature/Improvement:融合增益/真实判定质量/真实pgvector A/B 实测落地 + 对外宣称口径文档 (de424b3c06)
- 🚀 Feature/Improvement:批次3-1 看门狗阶段协议落地(1d885 归档移植,只取分段+BLOCKED_BY_CONCURRENCY) (d01f415176)
- 📚 Docs:trackedFiles/testFiles 按 81288dac 合并面刷新(ai-service 腿 2 新路径入数) (16d0abcf2c)
- 🚀 Feature/Improvement:刷新模型列表/每5h自动探测联动上游模型同步 (47bc9a182b)
- 📚 Docs:批次2/4经合并枚5189b047入wave-1108去向补记 + README按合并面刷新(trackedFiles 20575) (ce0419d708)
- 📚 Docs:门数漂移 332→344 定性为夹具过时(12 增 0 删含引入提交)+ 收尾账快照(F-274/275、F-191、pytest 22 例新立账、Kling1500 裁决保留) (a6221b70d8)
- 🐞 Fix:多线并行期显式暂停跨端收编腿(开关文件+日志,不靠改时间戳) (b920768a68)
- 🚀 Feature/Improvement:P0-2 先验后落+目标ref参数化(A/B/C/D+④/F) (57bac66a17)
- 🐞 Fix:收编归档线 DBG-43..49 写盘守卫与 8 个用例(批次2 单提交) (a01cb2722b)
- 📚 Docs:区分 06:25/06:30 两笔 update-ref，补硬编码 main 的落地器与封口第④条 (91d705cc70)
- 📚 Docs:记门47 三组存量红与 2bb7c39959 通道归因 (a3dea0ff9e)
- 🐞 Fix:水印门 47 拿不到范围一律 exit 2，自愈写盘严格限制在判定面内 (ce22583703)
- 📚 Docs:补录 CI continue-on-error 清单与 immutable guard 读真实索引两篇，并登记主工作区瘦身波不采纳票 (f8d0cd42c9)
- 🔧 Chore/Other:忽略 worktree 归档、e2e 截图与轮转日志 (438f3e1fb4)
- 📚 Docs:交接账补收尾链 51749a7075 与门47 75/190 读数 (876f81a986)
- 📚 Docs:交接账补最终 tip(38c8148278) (51749a7075)
- 📚 Docs:UI 缺陷合入交接账(17 笔映射/4 笔门账/45→0 复算/14 笔审计) (38c8148278)
- 📚 Docs:T1 收官票补数字口径与直推 main 绕过留痕 (4ac7febf4a)
- 📚 Docs:T1 存量红基线票收官为已清 (cfe4d6f731)
- 🐞 Fix:夹具对齐共享类型面(分销传参/plan constraints) (d5c0dd8731)
- 🐞 Fix:移除 money-unit 测试中未使用的 REPO_ROOT (e4c0a435a3)
- 🐞 Fix:tt 调用补 fallback 并给路由夹具加空表守卫 (e81cf6e796)
- 🐞 Fix:account-deletion 页补 useAuthGate 导入 (e643edd9e4)
- 🐞 Fix:收敛重复的 measuredCompactRatio 并移除未用导入 (e7b1139c57)
- 🐞 Fix:清 T1 存量红 25 处(合并重复/缺列/响应码声明/泛型约束/夹具) (1e0d1c1b19)
- 🐞 Fix:deadline-ticker 环境探针改为 globalThis 能力判定 (4fb05b74bd)
- 🐞 Fix:对齐小程序端 common.gotIt 与 RN 端,清 303p 跨端文案存量未裁项 (c0ee26ecf3)
- 🐞 Fix:RN 收藏页接后端真分页与加载更多(票 C),补齐 bookmark 分页五语键 (5bc619bdd4)
- 🐞 Fix:手机号页发码/绑定同 tick 互斥与定时器托管(票 E),补齐 9 个延迟返回页卸载清理 (99467300f8)
- 🐞 Fix:接入顶层键大小写冲突门禁 (3c3831db44)
- 🐞 Fix:miniapp-taro 顶层大小写重复键归位 camelCase (b603657f60)
- 🐞 Fix:mobile-rn 顶层大小写重复键归位 camelCase (564d350917)
- 🐞 Fix:绑定邮箱发码/提交加同 tick 互斥,延迟返回定时器托管卸载清理 (1378c54ddd)
- 🐞 Fix:补 302r 的 R4 文档点名,门 89 在 main 面转绿 (fb01cbda03)
- 🐞 Fix:吸收 main BUG-NEW-01——ActivityDetailScreen 错误/空态恢复页头返回入口，清 3 例既有红 (f7454026c9)
- 🔧 Chore/Other:吸收 main 红面扫描批次4 的三份夹具，清 avatar/chip 行距/pump 慢路径 4 例既有红 (6befb78f7a)
- 📚 Docs:校正 XUI-084 消费点行号（回填 :71 / 提交 :39 / 单元格 :70） (c4f74df783)
- 🔧 Chore/Other:opType 七键文案与压缩载荷重生成 (6d2ee32b72)
- 🐞 Fix:三腿钱包流水接入唯一表，opType 6 按非金额渲染 (2f0ac5f2c4)
- ♻️ Refactor:opType 展示语义收成全仓唯一表 (26122d8cfa)
- 🐞 Fix:API 套餐价格量纲收成唯一换算点并补首尾相等夹具 (97e1d135dc)
- 🐞 Fix:收口全部如实登记遗留项——真实PG/HTTP端到端、UI真测试、判定状态形状锁、工具链与门红根治 (29489c1165)

**2026-11-08**
- 📚 Docs:收口 web/RN ui-routes 补生成——终态钉、输入条数与已变来源；定论为源码改了未重生成，非生成器缺陷 (09ddb6c586)
- 🐞 Fix:重生成 ui-routes 白名单（2 输入，1 条已变：RootNavigator.tsx ← XUI-004 0ba309d2f7 + XUI-068 d6306a65b3；终态钉 fd754397…；349 条路由未变，仅 skipped 7→8） (23bfb6ca86)
- 📚 Docs:记录 web/RN ui-routes 补生成——web 已提交 ea1555d0cc，RN 因输入来自 XUI-004/XUI-068 停下待裁决 (c445ae3725)
- 🐞 Fix:重生成 ui-routes 白名单（923 输入未变，4 条已变输入均来自本线：wallet 页/XUI-086、agents 精选+我的/XUI-075、admin 套餐/XUI-082；终态钉 d413f735…） (ea1555d0cc)
- 🐞 Fix:193 第二处 stdio + T1 预算校准(405s 实测) + 并集口径票 (43b74a5a10)
- 🐞 Fix:门 193 判红面补显式 stdio(check-hand-migration-snapshot 派生 git) (2bd0011ef1)
- 📚 Docs:散文声明数字对齐现算(testFiles 4372→4404 / 守门 351→352) (0f8c684ffa)
- 📚 Docs:B 票 + 存量红清单 + commit-tree 一次性例外留痕 (84d9ca21d6)
- 🐞 Fix:F-89 流式中断按实际 token 结算；F-181 缓存命中 token 归零、请求次数照计 (e59db57adb)
- 📚 Docs:更正对照组复核——web/RN ui-routes 本次 0 diff 但自身钉早已陈旧 (a9f02c26d6)
- 🐞 Fix:F-203 Coze 扣费按定价折算成分,token 估算取 chars/4;Kling 1500 保持不动 (dcd98ca604)
- 📚 Docs:记录 XUI-076 重生成完成（9fc8e895cb，8 文件）与终态钉/对照组 0 差异证据 (5d173a7dcb)
- 🐞 Fix:XUI-076 重生成 i18n 四语载荷与 ui-routes 白名单（单一写入者一次完成，8 文件） (9fc8e895cb)
- 🐞 Fix:F-203 stock-service 预扣/退还改按定价成本(分),不再拿 token 估算数当钱扣 (3cefb12800)
- 🐞 Fix:F-203 Crew 路由删掉按 run 的二次扣费,避免与 adapter 逐次成本结算双扣 (5e608a3792)
- 📚 Docs:记录 XUI-076 执行前闸门——API 线 F-203 未合 main 且四个同型扣费点未全部收口，暂不重生成 (7532cae8e6)
- 🐞 Fix:F-203 异步回调 worker 改为按定价成本(分)结算,堵住 token 数当分的错扣 (2492296e86)
- 📚 Docs:刷新 XUI-076 重生成前置清单（含 4 个 b64 载荷）并将 XUI-087 处置改为 B、由 API 线统一修 (5104a2ef05)
- 🐞 Fix:F-203 口径 B,钱包扣减与 ai_cost_records 同源按真实成本(分)结算 (cea6f4565e)
- 📚 Docs:XUI-086 opType 方向修正落地 + XUI-087 AI 计费腿判定（污染资金账，待费率口径） (60ab2b569e)
- 🐞 Fix:opType 文案/正负号/颜色按服务端权威枚举（3=退款扣回 4=Relay 转账），未知值中性兜底 (0b3724817a)
- 📚 Docs:同步文档数字（ciWorkflows 56→57、trackedFiles 20187→20188，新增 cleanup 工作流） (3aac6c7a2f)
- 🔧 Chore/Other:落地通道改为固定分支 cross-end-auto+复用单 PR+自批 CI+auto-merge；新增 3 天快照清理（默认 dry-run，删前导出 sha 清单） (669b753484)
- 🔧 Chore/Other:补两个钱腿端到端量纲断言（199 元 ⇒ 请求体 199 ⇒ 落库 19900 分；提现反向） (79eac0bbcf)
- 🐞 Fix:写清 token_flows 同列两义（分/配额），钱流水端点默认排除 op_type=6 (ec179dfd99)
- 🐞 Fix:API 套餐 price 分→元（表格/回填/提交三腿同源） (f219b27053)
- 🐞 Fix:知识卡片读不到时抛 KnowledgeCardsUnread,不再覆盖旧卡库 (9295896f4f)
- 🔧 Chore/Other:worktree-state 注释收敛回 §3 <250 行(结构调整,非缺陷) (6b22eca35c)
- 🔧 Chore/Other:夹具对齐 wc-l 行数口径与技能扫描 fail-closed 语义 (2becdb0a36)
- 🔧 Chore/Other:对齐额度一位小数、V2 mock 与压缩锚点后的 parity 期望 (28d07ff516)
- 🐞 Fix:会话发现区分读不到与没有,补齐跨产品迁移预演判定 (3ee8c4cde4)
- 🐞 Fix:removeWorktree 恢复必填 withinRoot 根内断言 (1a9add9abb)
- 🔧 Chore/Other:require-permission mock 补 isSystemAdmin 同步导出，修 agents-market-public 4 例存量红（夹具缺口，无实现改动） (0648ffbd3a)
- 🐞 Fix:金额单位 支付弹窗元值直用 + 订单详情映射 payAmount 并修正退款字符串 (a6413ea859)
- 🐞 Fix:恢复检查点/hunk 目录的根内断言与路径穿越拒绝 (b1f3c6a6e7)
- 🐞 Fix:金额单位 智能体详情/精选/分类价格按分转元 (8f7b3b3036)
- 🐞 Fix:金额单位 支付宝下单分转元 + 提现分/元对齐 (2cd995ca5d)
- 🐞 Fix:配置存在但读不到时抛错,不再静默当空层 (e0bd5f2aaf)
- 📚 Docs:README 数字同步(F-26/F-31/F-49 新增 2 个测试文件:4449 / 20187) (8343b1f606)
- 🐞 Fix:F-26 页码上界(1e308→Infinity)、F-31 agents 分页边界、F-49 MCP 转发 deadline 与超时/不可用分流 (17b4c9c4f6)
- 📚 Docs:README 正文测试文件现算数同步(4446→4447) (7026d2d0bc)
- 📚 Docs:README 数字同步(F-255 新增 1 个测试文件:4447 测试文件 / 20185 跟踪文件) (c79daf93d0)
- 🔧 Chore/Other:F-255 归属闸改异步后同步夹具(mock 补 findByIdOrRestore、结构断言容忍 await) (a7624e9799)
- 🐞 Fix:F-255 终态派单运行时无界增长收口(200 条 LRU + 30 分钟 + Redis 回退/TTL) (2e4ab7e3ca)
- 🐞 Fix:XUI-068 忘记密码复用 web 找回页断开死环 + XUI-071 分片下载有界 + XUI-054 FS 显式 not-supported (d6306a65b3)
- 🐞 Fix:XUI-063 广场/充值文案 key 对齐源并补齐缺失键(含 common.gotIt) (af15ecdcb5)
- 🐞 Fix:相对时间兜底补 ja/ko(Hermes 无 RelativeTimeFormat 时不再回落英文) (c38ec4c9b4)
- 🐞 Fix:智能体价格分转元 + mobile-rn 订单/登录/产物 i18n key 补齐 (ffa7594775)
- 🐞 Fix:宿主壳对账补扫孤儿生成物(按 --screen 溯源行反查契约) (1229f26b8b)
- 📚 Docs:抽走核心数字段残留派生字面量 + 补 Monorepo 分隔符 (0994e3a989)
- 🐞 Fix:RN 宿主壳生成器按腿声明 hook + 把不可复现的旧壳判为陈旧 (54f841b4f7)
- 🐞 Fix:倒计时统一收敛到 shared useCountdown(截止戳派生+回前台对表) (83f61d85eb)
- 🐞 Fix:F-306 契约面去掉误导性 200,只声明 501 (0d8db01064)
- 🔧 Chore/Other:host-git/agent-control/考勤规则面板夹具跟上共享出口与 Tooltip(批次24) (9c374b6e6f)
- 🔧 Chore/Other:徽章/自定义侧栏/nav 计数夹具跟上 2026-11 实现(红面扫描批次23) (a870c411ce)
- 🐞 Fix:修 knowledge-base i18n 泄漏并让争议夹具跟上实现语义(红面扫描批次22) (6edf5a1764)
- 🐞 Fix:恢复学生考勤 B72 整月视图与自签退,并对齐 api-client 出口(红面扫描批次21) (495ca3e36c)
- 🔧 Chore/Other:勾选 AIS-053（已修@2026-11-08/mcp-media-p1-1108@fdf457bd9a） (da95fbbd17)
- 🐞 Fix:AIS-053 外部 MCP 落点默认 fail-closed + 注册权收归 admin + DNS 后按真实 IP 判定 (fdf457bd9a)
- ♻️ Refactor:倒计时收敛进 useDeadlineCountdown(行为不变,非缺陷修复) (1d08865528)
- 🔧 Chore/Other:use-chat 三夹具补 onDone 回执对齐 G-816008 真变更(红面扫描批次20) (42937822c7)
- 🐞 Fix:ActivityDetailScreen 错误/空态恢复页头返回入口(BUG-NEW-01) (6814636558)
- 🔧 Chore/Other:tbox 分页腿 list 与课程小节批量取数桩(红面扫描批次19) (b37bb6ea5a)
- 🔧 Chore/Other:paginatedSuccess 返回 list 的三处断言对齐(红面扫描批次18) (ef3d9f89ff)
- 🔧 Chore/Other:家长账单批量取账/agent 首屏 50/消息可见投影对齐(红面扫描批次17) (9cacf3ed42)
- 🔧 Chore/Other:journal idx 0-based 与 MCP 纯代理腿计数对齐(红面扫描批次16) (adf18d872a)
- 🔧 Chore/Other:keepalive/sweep/微信判定对齐心跳与代理改造(红面扫描批次15) (6ec261bc82)
- 🔧 Chore/Other:池导入/告警/钱包对齐新契约(红面扫描批次14) (75e1de43c8)
- 🔧 Chore/Other:内容/内部中继/代管导入对齐 requireAdmin 与 HMAC 新契约(红面扫描批次13) (83f6dcecf0)
- 🔧 Chore/Other:补 require-permission isSystemAdmin 与 messages users 表桩(红面扫描批次12) (6620f18100)
- 🔧 Chore/Other:桥层上报转接 api-client 端点出口,消除模块级 fetchApi 盲区(红面扫描批次11) (f1bdb2ac81)
- 🔧 Chore/Other:fetchApi 改 text()+JSON.parse、插件改 api-client 端点、401 按 BUG-69 先清会话(红面扫描批次10) (bbe313a17a)
- 🔧 Chore/Other:补 Taro 运行时常量 define;崩溃上报 mock 补 reportCrash;community 壳页断言对齐(红面扫描批次9) (51592d32de)
- 🐞 Fix:n8n 创建表单补回 3 个 useUiField 登记;采纳锁随壳承载退场(红面扫描批次8) (08274c0295)
- 🔧 Chore/Other:桥层上报改 mock api-client 端点出口;搜索文案走 sharedT(红面扫描批次7) (1eaf457e97)
- 🔧 Chore/Other:SSO 断言对齐生产域名回退(BUG-41/68),不再钉 localhost:8802(红面扫描批次6) (428ef237f2)
- 🔧 Chore/Other:会话历史排序结构锁下沉到 shared/chat/conversation-org(红面扫描批次5) (3d77870667)
- 🔧 Chore/Other:pump 慢路径计数/Avatar 接锁/chip 行距死腿与 token 化对齐(红面扫描批次4) (456d1777e3)
- 🔧 Chore/Other:ENGINE_METHODS 补两法 + 空响应体按 null 新契约(红面扫描批次3) (8d5f5272db)
- 🐞 Fix:VipScreen 接回 host port;linuxdo 排序夹具对齐(红面扫描批次2) (cf2bffa4a1)
- 🚀 Feature/Improvement:P1-P5 全量收口(二级聚合挂载图/PG持久化/真实判定网关/预算留痕/基准/测试增强) (6ea56fc0d2)
- 🔧 Chore/Other:对齐 journal 0-based 与已删除的孤儿安装迁移(红面扫描批次1) (ff17c13163)
- 🔧 Chore/Other:勾选 AIS-008（已修@2026-11-08/mcp-media-p1-1108@bcf50b3280） (b06174d971)
- 🐞 Fix:命令流/子代理进度流改为有界队列(AIS-008) (bcf50b3280)
- 🔧 Chore/Other:勾选 AIS-049/057（已修@2026-11-08/mcp-media-p1-1108@2b1f28b3d2） (28c8b748ea)
- 🐞 Fix:self_media 历史查询不再吞 DB 故障 + 工具兜底回执补 errorCode 并脱敏(AIS-049/057) (2b1f28b3d2)
- 🔧 Chore/Other:勾选 AIS-035/083（已修@2026-11-08/mcp-media-p1-1108@bc025ddb42） (4621a5eeab)
- 🐞 Fix:computer-use 导航 SSRF 双闸 + file_edit 读改写整体持锁(AIS-035/083) (bc025ddb42)
- 🔧 Chore/Other:补齐本次新增 11 个文件的 47p 溯源水印 (87e35b6132)
- 🔧 Chore/Other:勾选 AIS-054/056/085（已修@2026-11-08/mcp-media-p1-1108@c2e723bf2d） (9351e9a823)
- 🐞 Fix:web_search 失败透传 + Windows 进程树回收 + db_query 主机文件函数黑名单(AIS-054/056/085) (c2e723bf2d)
- 🐞 Fix:F-324 不可采样时不再输出 NaN,usage 序列直接省略 + available 状态位 (836cd95169)
- 🐞 Fix:F-306 Workspace agent/run 停伪成功,LLM 端点补 /api 前缀,失败落 failed (78226aa578)
- 🔧 Chore/Other:勾选 84E/93E/94E（AIS-084/093/094 已修@781905ece0） (49c0fac00e)
- 🐞 Fix:F-449 金额列 real→numeric(12,2),支付换算改十进制精确 (cfb0b7b2da)
- 🐞 Fix:抓取族补网络审批门 + 媒体代理流式限流 + Chrome 导入端口属主绑定（AIS-084/093/094） (781905ece0)
- 🐞 Fix:F-432 Workspace ACP 会话真落库 + begin/end 归属校验 (744822836d)
- 🐞 Fix:F-424 用户任务列表改为分页扫描后按归属过滤 (f26fc249de)
- 🐞 Fix:导出正文缓存写入前清扫过期项 (F-41) (aa6d931b0b)
- 🔧 Chore/Other:勾选 29E/30E/55E（AIS-029/030/055 已修@680ccf0fd7） (9fbc1c5b1c)
- 🐞 Fix:F-334 积分兑换改为 referenceId 精确判重 + 唯一索引并发兜底 (7279e93b01)
- 🐞 Fix:浏览器会话上限/降级回收 + 自媒体调度关停 + 后台任务终态保留（AIS-029/030/055） (680ccf0fd7)
- 🐞 Fix:Redis publish 失败时回落本机直推,不再静默丢通知 (F-113) (6face3f2c2)
- 🐞 Fix:F-228 单条结算同步补 pending 状态闸,堵住残留的先记账路径 (ee5909ebf8)
- 🐞 Fix:F-203 收紧为两段判定,禁止零余额先跑后账 (620437d2b2)
- 🐞 Fix:文件搜索强制上限 50/硬顶 100 并接受 limit 参数 (F-19) (2a7a74a671)
- 🐞 Fix:F-324 连接池指标不可采样时显式报不可用,不再假绿 0 (cc10014367)
- 📚 Docs:p0p1 交接与复核结果 + README 数字块刷新 (591fd05b48)
- 🐞 Fix:文件搜索/最近/全局搜索排除回收站记录 (F-18) (5d2cf741c9)
- 🐞 Fix:F-346 webhook 投递先持久认领再回 200 (5dedc68989)
- 🔧 Chore/Other:勾选 24E/82E/95E（AIS-024/082/095 已修@389dc8a096） (a4b759f91d)
- 🔧 Chore/Other:F-203 夹具补溯源水印头(推送门 47p 覆盖) (f208ff1c94)
- 🐞 Fix:AIS-024/082/095 定时发布抢占 CAS、read_file 读侧上限、run_id 归属 (389dc8a096)
- 🐞 Fix:P89 租约行收成一条 + 门13d 立维⑤「整行逐字重复」差值棘轮 (e727680394)
- 🐞 Fix:F-203 Crew 子 LLM 按真实 usage 扣钱包并写 token_flows (c5d442294e)
- 🔧 Chore/Other:修复: ai-service 合并波次 hybrid 收口(AIS-100/050/051/081) (92f67fe33d)
- 🔧 Chore/Other:勾选 23E/40E/42E（AIS-023/040/042 已修@134b439d76） (ab8f2c53cd)
- 🐞 Fix:AIS-023/040/042 发布并发门、定时任务管理门、运行态归属 (134b439d76)
- 🐞 Fix:F-68 礼物扣款统一到 user_margins 主账本并补 token_flows (fe3feafaaf)
- 🐞 Fix:AIS-102 self-healing 端点补管理员门 (a115b9775f)
- 🐞 Fix:AIS-102 self-healing 端点补管理员门 (d68423ddd6)
- 🐞 Fix:F-147/F-689 支付重放加状态守卫与订单号唯一约束,endTime 锚定支付时刻 (ff276504d8)
- 🐞 Fix:F-228 结算补账期唯一键与主库条件插入,客户端传价显式 400 (ede422e8e5)
- 🐞 Fix:同面封装不再误报 no-content,补 19 道门方向锁 (abe25479d0)
- 🔧 Chore/Other:勾选 101E/104E/105E（AIS-101/104/105 已修@77230b153b） (88d1787c42)
- 🐞 Fix:AIS-101/104/105 录制属主、全局记忆 reset 权限与重载、沉淀计数有界 (77230b153b)
- 🐞 Fix:P0 Apple id_token 按 JWKS 验签,堵自签 JWT 冒充任意 Apple 账号 (88c599252f)
- 🐞 Fix:审计密钥登记解析失败改未判定,不再默认放行 (F-340/340G) (ddeb90c49c)
- 🐞 Fix:团队收件箱绑定 actor,禁冒名/跨人已读 (F-350/350G) (45478c80a7)
- 🐞 Fix:移出团队成员同事务回收知识空间授权 (F-384/384G) (ec3e0ec3f1)
- 🐞 Fix:spec 读写/提交按工作区权限做用户级 ACL,非属主 404 (F-390/390G) (09194288ee)
- 🐞 Fix:小程序消息房间端点按 roomId 对端过滤 (F-211) (a6e89dab58)
- 🐞 Fix:Agent 任务按发起人归属并诚实落 failed (F-39/F-306) (6cd8bc5e1a)
- 🔧 Chore/Other:对齐协议方法清单与空响应体期望(仅测试侧) (92149f6ee8)
- 🐞 Fix:tools.result/approval.respond 回传失败不再静默吞掉(PKG-01) (b457a2e5db)
- 🐞 Fix:XUI-074 审批卡片与标注输入行补 maxHeight/ScrollView/KAV (eb74643e55)
- 🐞 Fix:分类器补认 git grep 的正文面并清 T19(no-content 是口径盲区不是脚本缺口);T6 文档面改 AGENTS∪README 同 R4 口径 (3935c3140c)
- 🐞 Fix:postMessage 来源闸 + runtime 切会话残留重置(S-08/S-09) (54f6465567)
- 🔧 Chore/Other:勾销 582G/583G/688G 并落档 F-583/F-584/F-689 修复结论 (c1190f8059)
- 🐞 Fix:开发者订阅按 orderId 唯一幂等，回调重放不再重复插订阅(F-689) (ec2f95556f)
- 🐞 Fix:F-03 replaceMessages 增加会话属主校验,堵跨用户清空/覆写 (3d259432f4)
- 🐞 Fix:结账页档位改由服务端解析,plan id 不再当 vipLevelId(P1) (2aaefa1ea5)
- 📚 Docs:缺陷① 提交期登记门接线落地并关闭票 (30372adf74)
- 🐞 Fix:302 提为 blocking 且只拦承载面,新接 302r 登记同步只报数 (b13a7fd3dc)
- 🐞 Fix:提交面按索引取材并只让承载削减面阻断 (8d9a257219)
- 🐞 Fix:催费微信按渠道开关，留痕先 pending 后按送达落 sent/failed(F-583/F-584) (0bcf77a3a7)
- 🐞 Fix:F-191 系统 token AI 端点按 usage 归账到调用者 (cbb20b06f8)
- 🔧 Chore/Other:勾选 103E/108E/109E（AIS-108/109/103 已修@df01268091） (fb56f29d3f)
- 🐞 Fix:AIS-108/109/103 会话与主体归属、probe 逐跳 SSRF 收口 (df01268091)
- 🐞 Fix:F-190 微调任务按调用者隔离,F-216 owner 谓词改同位绑定 (a7023b7835)
- 🐞 Fix:圈子帖 visibility 落库过滤 + 评论 UGC 过滤/原子计数/回复归属 (F-332/F-335) (93d1747085)
- 📚 Docs:locale 残留共用的扫描器按 lint-staged 语义自述取材面 (fd4adb0891)
- 🐞 Fix:F-54/F-155/F-134 跨租户读写面收紧为管理员,普通用户 403 且下游零触达 (b0c86ac64a)
- 🐞 Fix:第三批——旧扫描根/死维度(17/91/105) (226b420ce7)
- 🐞 Fix:剧本改/删/批量删按 createdBy 属主或管理员收口 (F-159/159G) (32a4fdd648)
- 🐞 Fix:工单评级仅属主可读 (F-160/160G) (ab33ed4bd3)
- 🐞 Fix:chat/stream 与 chat/resume 身份只认认证主体,堵 metadata.userId 跨用户读知识库/错置预算 (F-02) (271f7ccbba)
- 🐞 Fix:第二批——取材面与级别对齐(11b/20/27/34/38/2g-web) (4e058c545f)
- 📚 Docs:四条证据缺口标未判定(不计入已修) + CLI/AIS 标否条目复核结论回填 (252fa5ea15)
- 🔧 Chore/Other:勾选 98E/99E/110E（AIS-098/099/110 已修@d6bffcd978） (cc7ca8b008)
- 🐞 Fix:AIS-098/099/110 外链图片下载与 edu 退款 id 收口 (d6bffcd978)
- 🐞 Fix:agent-control/execute 投递目标只认 JWT 主体,堵 body.userId 跨用户派发 (F-07 同族) (071278fc58)
- 🐞 Fix:退费校验归属与额度并锁流水，全额退满推离 paid，汇总冲减退费(F-315/F-322) (b9cac6fdf2)
- 🐞 Fix:AIS-046 审计成功码统一为 0 + AIS-047 审计中间件落主体 user_id (21bd5a2df1)
- 🐞 Fix:三个 by-ids 批量端点只返回 status=1 (F-331/331G) (55094ac14a)
- 🐞 Fix:隐藏圈子详情/帖子/发帖可见性闸 + 成员校验 (F-330/330G) (0aced0d0e0)
- 🐞 Fix:官方知识库写面收口管理员,读面按发布态过滤 (F-329/329G) (649aeaf899)
- 🐞 Fix:U-7 提现金额剥离千分位并如实提示失败 (1a24120be2)
- 🐞 Fix:IME 提交守卫 + token 作用域与 storage 访问级收窄 (bacfc1dd4d)
- 🐞 Fix:缴费落库与账目重算收进同一事务，重算先 FOR UPDATE 锁行再读(F-316/F-582) (a4ff3e50f1)
- 🐞 Fix:AIS-019 语义召回把属主下推到检索层,勿让他人条目占满全局 top_k (e12f8a9550)
- 🐞 Fix:XUI-055 选图垫片尊重多选声明 (81b3fc2771)
- 🐞 Fix:圈子分类关系全局配置写面收口管理员 (F-158/158G) (78beb8b7bc)
- 🐞 Fix:审批应答按认证主体复核，堵住"他人代答批准高危工具" (78e0957509)
- 🐞 Fix:170 fail-closed + 260 依赖触发面/暂存面真判 (32bc4c4451)
- 🐞 Fix:消息来源闸 — bridge/ext-ui/content 的 sender 校验与零副作用夹具 (7eb29354c4)
- 🐞 Fix:XUI-061 时间格式按调用时创建不再冻结时区 (0831c5f8a0)
- 🔧 Chore/Other:勾销 691G/692G 并落档 F-692/F-693 修复结论 (63d288d2b3)
- 🐞 Fix:XUI-051 补 MediaTypeOptions 别名 (bcbd00572c)
- 🐞 Fix:浏览时长收敛为单条原子 upsert + 考试状态机统一 submitted→graded(F-692/F-693) (becc864f28)
- 🐞 Fix:XUI-056 导航垫片兼容对象形 navigate (c6fc25f996)
- 🐞 Fix:禁用/删除同步吊销 refresh token,member-users 写响应白名单投影 (F-127/F-131) (7b36965af8)
- 🐞 Fix:XUI-052/053 rn-compat 补齐相册与去设置垫片 (6db56b4765)
- 🔧 Chore/Other:勾选 100E/117E/118E（AIS-100/117/118 已修@9479704a7f） (61417e2efe)
- 🐞 Fix:F-03e /chat/steer/reorder 归属校验 —— 越权重排他人 steer 队列一律 404 且零副作用 (852d803a24)
- 🐞 Fix:AIS-100/117/118 身份与落盘失败语义收口 (9479704a7f)
- 🐞 Fix:XUI-065 智汇值格式收敛到共享函数 (a3021e99e5)
- 🐞 Fix:开发者链接写归属强制取令牌主体 (F-138/138G) (f3cfedb521)
- 🐞 Fix:Coze 全局变量面收口系统管理员 (F-137/137G) (e0975b7170)
- 🐞 Fix:XUI-066 组3b 通知设置不再吞掉加载失败 (67f95aa05b)
- 🔧 Chore/Other:更正 F-04/F-06 证据为 fix/api-p0-1108 并记录移交 (a0b99e8317)
- 📚 Docs:174 道 pending 门只读体检清单与 222 枚 lost-commit 命名缺陷 GC 判据 (a4c176283e)
- 🐞 Fix:F-03b/c/d 流控制端点归属校验 —— abort/steer/steer-withdraw 越权一律 404 且零副作用 (0ff34b851f)
- 🐞 Fix:XUI-066 组3a 消息中心/推广排行/隐私设置不再吞掉加载失败 (d8e7efae39)
- 🐞 Fix:后台 Agent 与执行回执按登录属主收敛,堵跨用户 list/get/cancel 与 result 伪结算 (F-07/F-08) (ff80abe77a)
- 🔧 Chore/Other:移交：F-04/F-06 由 fix/api-p0-1108 修复，此处回退避免双实现 (138bd5120a)
- 🐞 Fix:XUI-066 组2b 资讯/VIP/直播订阅不再吞掉加载失败 (27140b31c8)
- 🔧 Chore/Other:勾选 106E/107E/116E（AIS-106/107/116 已修@b19be35552） (78c4e35052)
- 🐞 Fix:智能体人设归属闸 + 规则参数写面收口 admin (F-133/F-363) (702337d515)
- 🐞 Fix:XUI-066 组2 发布与讲师详情不再吞掉失败 (6c49f40763)
- 🐞 Fix:单条审核仅允许 status=0 放行,uuid 形状闸+审计 (F-129/129G) (e0ddc1ef11)
- 🐞 Fix:AIS-106/107/116 补 file_search/investigate/image_edit 调用前闸 (b19be35552)
- 🐞 Fix:查询数组双向可还原 + 顶层数组形状收口 (a5082d93c6)
- 🚀 Feature/Improvement:新增提交期屏/路由登记同步只读门(未接 .husky) + 临时仓库三态夹具 (1c1bce0b2b)
- 🐞 Fix:问答/分销统计/创作列表按登录身份收敛,堵 query.userId 与 body.userId 越权读 (F-04/F-05/F-06) (e18899419a)
- 🐞 Fix:XUI-066 组1 五个壳把加载失败如实上抛 (5fd91c5f27)
- 📚 Docs:教育域「否」条目逐条复核落档——F-690/691/694 坐实已修，F-692/693 坐实待修，F-449/689 转资金线 (0744c48551)
- 🐞 Fix:支付凭据只收标量 + Enter 提交防回潮守卫 (8b3e7c0b5f)
- 🐞 Fix:公开试卷列表/详情/取题/开考补 status=1 判据，禁用试卷不可达(F-690) (3163dccb52)
- 🐞 Fix:XUI-073 + 同型B死路由 充值失败不跳空单号、/pagesA 迁在册页 (b342856a45)
- 🐞 Fix:根治门禁基础设施三缺陷 (f2314ea16d)
- 🐞 Fix:三条存量红真修——钩子/安全提交只读探针迁 gitRaw,夹具增长按新证据记账 (bc814f64be)
- 🐞 Fix:私密名片详情仅属主可见,浏览量原子自增 (F-156/156G) (f6d3ff19fd)
- 🐞 Fix:分类创建/付费开关/缓存运维收口到管理员 (F-359/361/362) (3beb864b81)
- 🐞 Fix:审计日志按 key 递归脱敏凭据字段 (F-128/128G) (b944de83f8)
- 🐞 Fix:倒计时改截止戳派生(use-countdown/use-register-form) (b02dbe204e)
- 🐞 Fix:XUI-069/070 请求竞态丢旧响应、下单与选图入口上锁 (981c44915b)
- 🔧 Chore/Other:补 F-069/F-047/F-062/F-087/F-003/F-097 夹具(4 条行为级 + 4 条结构锁,均实测旧码红) (7ce2de83ee)
- 🐞 Fix:XUI-050/072 + 假思考进度 权限如实上报、签到 toast 互斥、去掉伪造百分比 (95e1a0892e)
- 🐞 Fix:学生自助签退只接受服务端当日，历史补签由教师代签承担(F-210) (74a49610b2)
- 🐞 Fix:远端位置只问服务器(收编腿改 resolveRemoteHead),棘轮 3 条存量红收口 (1e4810338e)
- 🐞 Fix:成绩指标按记录终态只计一次，人工阅卷/复核走增量平移(F-694) (d40957f377)
- ♻️ Refactor:门脚本裸 git 迁入 gitRaw/catBatch,删除自拼 batch 与 spawnSync (327598e096)
- 🐞 Fix:公开专题详情过滤未发布课时，管理员预览显式 includeUnpublished 放行(F-691) (2de550fd3c)
- ♻️ Refactor:lib 层派生 git 迁入取材层(含 push-receipt 远端/批查改走 ls-remote+catBatchOids) (1c0403149f)
- 🐞 Fix:content-extended 内容管理端点逐路由 requireAdmin，AIGC 自助面恢复登录可用(d050d90d10 起管理端为 admin-only，夹具补管理员身份) (9d72a23d13)
- 🔧 Chore/Other:勾选消息/聊天域身份采信三条(F-03/F-04/F-06)并追加 sidecar 证据 (a837c5f963)
- 🐞 Fix:消息/聊天域身份采信点 F-03/F-04/F-06 —— 会话归属与主体一律以服务端认证态为准 (3183046cf8)
- 🐞 Fix:审计链查询失败不再吞成空结果 (F-246/246G) (a1ed380dbb)
- 🐞 Fix:结算缓存/收入概览运维面收口到管理员 (F-365/365G) (0d396d392a)
- 🐞 Fix:全站打赏流水仅管理员可读 (F-199/199G) (ba48392ca8)
- 🔧 Chore/Other:收口钩子格式化与溯源水印残留(纯格式,无逻辑变更) (6515de9ec6)
- 🔧 Chore/Other:F-002 旧断言 toBeUndefined 本身就是错的 —— 补齐理由并实测旧源码红 (a799cf700a)
- 🐞 Fix:W-03/W-06 收口 + 同型根因自查 S-01/02/03 (682034b1fd)
- 🐞 Fix:终端会话自然退出即回收,注销擦除补齐五张 PII 表 (F-236/F-269) (f34d9ad906)
- 🔧 Chore/Other:F-103 补旧码必红夹具(runtime 跨 chunk 残帧 + 行内坏字节不吃下一帧) (93130904d2)
- 🐞 Fix:AIS-081 元字符机制改为按 shell 形态判 + AIS-050 声纹克隆归属/计费闸 (4af2f5490f)
- 🐞 Fix:XUI-017/018/046 关于入口逐条路由、社区入口迁 pkg-ai、直播结束与人数 (b776154139)
- 🐞 Fix:删角色同事务清理用户-角色/部门/菜单绑定 (F-403/403G) (1661b376a3)
- 🐞 Fix:封堵打赏流水匿名读,并给 Kling 轮询加归属校验与幂等扣费 (F-199/F-119) (a16b82c1bd)
- 🐞 Fix:DG-06 预算单一来源(defaultTimeoutMs),30a 按 2026-11-08 复测收敛(600s),超时不洗绿 (5583f50cfc)
- 🐞 Fix:XUI-023/024/031/045 运行时代次、分页依赖环、溢出作用域、分享图片 URI (beb86a377f)
- 🔧 Chore/Other:收口 post-commit 钩子格式化残留(无逻辑变更);payment.test.ts 固化「processing 当成功」的旧断言此前已纠正 (80d9341826)
- ⚡ Perf:门 30a 缓存跨 worktree 共享 + reflog 面提速,存量悬空债清理 (5657fea9e3)
- 🐞 Fix:judgedGapWeb 拆登记面与承载拆解面，诚实登记不再判红 (c3d819dd6a)
- 🐞 Fix:平台 Key 图像/音频/视频编排补计费闸与资源回收 (F-103/F-104/F-105) (879a8df5a6)
- 🐞 Fix:XUI-026/027/030/033 通知 type 兜底、408 归瞬时、小时除数、续读保留对侧游标 (f2df1e6ca3)
- 🔧 Chore/Other:勾选第三批 5 条 P1(F-02/F-285/F-381/F-549/F-568)并追加 sidecar 证据 (847e1740a9)
- 🐞 Fix:修复考试倒计时/IME误提交/充值钓鱼三组缺陷 (W-01/02/04/05/07) (434a93e097)
- 🐞 Fix:Persona 写端点整组收为管理员,内置人格不可改 (F-364/364G) (de18e75902)
- 🐞 Fix:分类更新收口到管理员并加字段白名单 (F-360/360G) (3571c9757f)
- 🐞 Fix:DG-11 gate-scope 头注以实现为准,改注释不改行为 (4075db4e2b)
- 🐞 Fix:DG-10 format 显式基线不可解析改为未判定,全零 sha 回落显式告警 (d33fb0412d)
- 🐞 Fix:DG-09 HUSKY_SKIP_TYPECHECK 只跳过 T1,其余 12 道 push 门照跑 (25d5944603)
- 🐞 Fix:DG-08 拆 built/healthy 两态标记,被杀轮次下一轮必重跑门禁 (a989580bb3)
- 🐞 Fix:DG-07 守护锁增记 pidStartTime,pid 复用不再永久死锁 (3a1951dba9)
- 🐞 Fix:消息/上传域第三批 P1(F-02/F-285/F-381/F-549/F-568) 以服务端身份为准并收口资源与清理边界 (2fc4299c8a)
- 🐞 Fix:XUI-015/037/044/048 注销路由、相册 loading、webview timer、录音卸载清理 (b5f1627643)
- 🐞 Fix:已撤销证书禁止下载 PDF，与验证接口同口径 404(F-570) (6355eb628f)
- 🐞 Fix:公告详情校验发布时间/过期，CLI 列表与版本查询下推到 SQL(F-488/F-489) (8d02465cc1)
- 🐞 Fix:legacy-learn 统计接口按登录身份定归属，专题/课时过滤发布状态(F-515/F-517) (f0fe4740ed)
- 🐞 Fix:XUI-020/034/036/042 改密失败复位、脱敏容错、手机号/金额边界、订单列表归一 (3bf0fc4dcb)
- 🚀 Feature/Improvement:直跑面 ratchet + --only 单门入口(A+C 裁决落地) (ba514fec82)
- 🐞 Fix:n8n webhookPath 锁同源防密钥外泄、SRS 服务器密钥仅管理员可读、推流列表/详情按属主收敛(F-117/F-195/F-196) (dee4e559cc)
- 🐞 Fix:MCP servers 全局表收口到管理员,封死跨用户读/删/注入 (F-101/101G) (1d0f00caf4)
- 🐞 Fix:注销 PII 擦除补齐 5 表并改 fail-closed 事务 (F-269/269G) (28d9e65b65)
- 🐞 Fix:XUI-022/025/032 通知订阅引用稳定、loadMore 失败解锁、分页同 tick 去重 (b400751172)
- 📚 Docs:记录跨根 tsbuildinfo 实测/共享 buildinfo 重写说明与 stale-dist 夹具漂移归因 (3d3b5580fc)
- 🔧 Chore/Other:陈旧 dist 夹具补齐 js+d.ts 成对产物,新增产物缺失仍判红对照 (e5ab1c0f42)
- 🐞 Fix:self-media 记录列表按作者收口,跨用户 payload 不再泄露 (F-170/170G) (23751e8e7a)
- 🐞 Fix:平台 Key 媒体代理补余额闸与结算、OpenRouter 代理计费/超时/错误体收敛、多厂商编排去重限流(F-87/F-93/F-192) (19d6df7c02)
- 🐞 Fix:XUI-038/039/043 会员支付走真实链路、成功页只认服务端 paid、换绑提交旧号验证码 (dd880eef4b)
- 🐞 Fix:dist 内容缓存键纳入构建根/outDir/tsbuildinfo,禁止跨根复用 (62836eb12d)
- 🐞 Fix:重建前隔离跨根 tsbuildinfo,产物缺失点名到具体路径 (0bfbc66476)
- 📚 Docs:收口门 173 文档数字结构性修复,写入运维一句话 (0e52466c44)
- 🔧 Chore/Other:补勾 52E(AIS-052,与 AIS-031 同源分派闸同笔修复) (24b0b27c3a)
- 🐞 Fix:XUI-028/029/035/047 权限 fail-closed、水合失败不落盘、重试上限、提现入口锁 (c126e0892a)
- 📚 Docs:登记 T1 tsbuildinfo 假红(每并行分支复发,根治归专项) (cabec4abb5)
- 🐞 Fix:heat-stats 按小时水位增量同步,消除 usage_count 重复累加 (F-262/262G) (df6f7947f5)
- 🐞 Fix:watch-aspect 计数钩子移到鉴权之后,杜绝匿名/越权计数 (F-206/206G) (12d8fed34e)
- 🐞 Fix:SRS 服务器列表收口到管理员,apiSecret 不再外泄 (F-195/195G) (2c900395ab)
- 🔧 Chore/Other:导出 resolveLedgerPath 供 F-075 ⑦b 夹具断言(EACCES⇒null) (f134e3e82f)
- 🐞 Fix:logger 对 err(含 Error) 递归凭据打码 (F-284/284G) (f96d96298d)
- 🐞 Fix:后台长跑命令分派按角色收口(AIS-031) (acc6d80cbf)
- 📚 Docs:校正数字块注释,如实描述 push 档全判 (9aa8248aa7)
- 🐞 Fix:refresh 重放拒绝 stale-sibling、OAuth 码原子消费、usercenter 脱敏 2FA 凭据(F-268/F-244/F-245) (045402b2ff)
- 🐞 Fix:增量索引写/删失败不再推进快照(AIS-027) (61369af5cc)
- 🐞 Fix:computer-use 宿主机键鼠/截屏整族收紧到管理员 (F-400/400G) (1d8f9b5ab9)
- 📚 Docs:清掉中英头条残留的派生数字字面量 (51f66de013)
- 🐞 Fix:封堵内置管理员改密/第三方绑定接管与私信通知越权读(F-125/F-126/F-154) (9eb017a220)
- 🐞 Fix:课程评价补报名闸与服务端 signId，判重插入原子化(F-503) (2503dce969)
- 🐞 Fix:SRS 流列表/详情/状态按属主收口,保留属主与管理员路径 (F-196/196G) (b03181c969)
- 📚 Docs:抽走 README 正文派生数字,数字块收口为唯一写入口 (91ca025370)
- 🐞 Fix:教育公告按 sort/发布时间稳定排序，并按 publishTime 控制对外可见(F-637) (239830bbdb)
- 📚 Docs:测试文件数 4378→4379 与现算值对账 (a772cb88ff)
- 🐞 Fix:派发器如实传入 env,判面冲突当场 exit 2 (edd6a71fd6)
- 🚀 Feature/Improvement:门体同代自检 + 判面显式声明 + 重试变绿判未判定 (9a3f2a4561)
- 🐞 Fix:学生自助签到只允许当日，拒绝客户端任意 date(F-210) (1e0d9d1a9d)
- 📚 Docs:余下正文 4383→4385 全部对齐 (74bcbef7d4)
- 🐞 Fix:TTS 链路改走服务间凭证并显式告警降级(AIS-092 连带) (1d4207f4af)
- 🐞 Fix:批次/考试/证书/自媒体读接口按属主收敛(F-85/F-168/F-169/F-170) (d47f12ba47)
- 🐞 Fix:OAuth web token 授权码改为原子消费 (F-244/244G) (14f113ad09)
- 📚 Docs:正文测试文件数对齐现算 4385 (ae9b9c7f11)
- 🐞 Fix:课程/视频 8 个管理写端点升级为管理员闸(F-166 P0) (dbd9b80acd)
- 🐞 Fix:客服/ws-ai 会话与出站身份归属校验(F-109/F-112) (ce6b59caf3)
- 🐞 Fix:OAuth authorize/userinfo 先校验 token 黑名单 (F-56/56G) (025974f194)
- 🐞 Fix:收紧 OAuth/MCP/LLM 转发面的管理员与身份归属校验(F-55/F-56/F-101/F-102) (e7ba41ad70)
- 🐞 Fix:XUI-016/019/021 退款金额归一、注销闸门复位、分销字段映射 (7708c2c548)
- 🔧 Chore/Other:去掉 test_api_v1 夹具重复导入(ruff F811) (26a8a6afc6)
- 🔧 Chore/Other:登账(数字对账): README 正文 testFiles 4367→4373(本轮新增 6 个测试文件) (2d22798621)
- 🐞 Fix:学习计划完成率按整数汇总，修正 int8 字符串拼接导致的 442%(F-699) (b1d34a9341)
- 🐞 Fix:资金链路 P1 第二批 B 组(F-135/136/167/228) (edf15947cd)
- 🔧 Chore/Other:登账(缺陷普查批次): mcp_server 工具族+语音/媒体/发布 9 条 P1 收口(AIS-021/050/051/073/080/081/092/096/097) (f3e69fad00)
- 🐞 Fix:审计证据导出改 ASC 键集游标并生成链锚 (F-646/645G) (841c74661d)
- 🐞 Fix:访问明细响应白名单投影，封死跨用户 PII 泄漏 (F-592/591G) (1937e6d8f1)
- 🐞 Fix:schedule 写端点补管理员闸 (F-636/635G) (99aa6d9e21)
- 🐞 Fix:P1 连接关闭/续跑并发/索引提交语义(AIS-021/022/027) (e49b792b1f)
- 🔧 Chore/Other:修(AIS-021/073/096/097): 发布域连接泄漏与账号越权 + 媒体 sidecar/在途强失败 (56dbb657ab)
- 🐞 Fix:P1 流式终态/原生计量/取消收敛/压缩引用/媒体清扫(AIS-001/002/005/009/058/065/096/097/111/112) (cdc5a9547c)
- 🐞 Fix:Batch 单对象端点补 API Key 归属校验 (F-85/85G) (492b3b3287)
- 🔧 Chore/Other:修(AIS-050/051/080/081/092): mcp_server 工具族路径/SSRF/命令注入收口 + 付费 TTS 鉴权 (1417646ce1)
- 🐞 Fix:XUI-003 会员页对 /vip/my 空记录落空态并消除 TS2345 (03eaf32af9)
- 📚 Docs:修正 code 标签内测试文件数 4367→4372 (0a8fe453f4)
- 🐞 Fix:OAuth 密钥管理端点改为管理员闸 (F-55/55G) (7a320a0e06)
- 📚 Docs:同步新增 5 个夹具后的测试文件数 4367→4372 (826dc1c3a9)
- 🐞 Fix:scoped-guard 归属判据绑定主体参数并拒绝 or 绕过 (F-216/216G) (9a88a3c6e0)
- 🐞 Fix:修正 gate-failure-kind C7/F5 判据锚点(存量红真修,不删断言) (6040fed71a)
- 🔧 Chore/Other:登账(msg-p1): 消息/推送/社交/文件上传 13 条 P1 已修并勾选 (1fe3efb480)
- 🐞 Fix:用户中心显式投影剔除 2FA/密码类敏感列 (F-245/245G) (ec12ec1c62)
- 🐞 Fix:资金链路 P1 第二批 A 组(F-229/230/220/62/63) (bba5be1be0)
- 🐞 Fix:消息/聊天 6 条 P1 根因修复（F-54/109/112/154/170/192） (12be6889fa)
- 📚 Docs:P0 落成后对齐测试文件计数 4378 (d728c5a24f)
- 🐞 Fix:考勤墙钟固定 Asia/Shanghai，修复 UTC 主机迟到误判(F-263) (688ba35066)
- 🐞 Fix:阻断第三方账号绑定/改绑内置管理员接管路径 (F-126/126G) (7f0441c2dc)
- 📚 Docs:正文 testFiles 4367→4368(W-01 新增 1 个测试文件) (eefd9ee63d)
- 🐞 Fix:上传/推送/社交评论 7 条 P1 根因修复（F-28/69/680/155/332/479/698） (f4651bf29d)
- 🐞 Fix:考试记录归属校验与判分去重，证书详情补属主闸(F-168/F-169/F-172) (f7450e25a3)
- 🐞 Fix:禁止管理员重置系统内置管理员密码 (F-125/125G) (f2e2e8bd2b)
- 🐞 Fix:XUI-014 提现余额按分转元展示、提交金额按元转分 (cfa074991d)
- 🐞 Fix:付费课程以已支付订单为准，封死零支付解锁(F-153) (10d0de57c8)
- 🐞 Fix:倒计时改按截止时间戳重算(后台节流/锁屏不再无声延长考试) (7974a14834)
- 🐞 Fix:XUI-009/010/013 充值签名与 orderType、Easing.sin、Clipboard 默认导出 (eb3bff76f7)
- 📚 Docs:正文两处工程守门数同步为 352(生成块已同步,正文补漏) (88053d3c24)
- 📚 Docs:同步守门门数 351→352(新增全量腿 IGf) (7972a763e4)
- 🐞 Fix:evil merge 按逐父交集判 + 判据库执行器入根护栏 + 全量腿注册 IGf (8182bd1234)
- 🐞 Fix:XUI-007/008 支付订单详情拆包络且 DEV mock 不再直通成功 (c024572376)
- 🐞 Fix:XUI-005/006 登录态改用 getUserInfo 并让清缓存保留登出标记 (bf3d1e2bda)
- 🔧 Chore/Other:补 F-075/103 夹具(unjudged 出口 fail-closed、NDJSON 中文跨 chunk) (37bc6d6f19)
- 🐞 Fix:required 聚合器 needs 补齐两个 preflight 并逐项断言结果 (90fed2988c)
- 🐞 Fix:P1 代码工具/命令策略/取消/付费TTS/索引主体收口(AIS-080/081/086/092/100/106/107/116) (8adaf979c3)
- 🔧 Chore/Other:补 F-002/006/007/008 双断言夹具(旧红/新绿:exitCode、键名脱敏、argv 脱敏) (6c33f037af)
- 🐞 Fix:XUI-004 未登录分支补齐 Privacy/Agreement/ChangePhone/ChangePwd 四路由 (0ba309d2f7)
- 🐞 Fix:P1 资金组一批 F-09/10/16/17/32/33 堵资金双出与回调丢单 (8ee5b47dcf)
- 🐞 Fix:跳门证据绑定失败门集合(T1 之外一律 deny) (acc0f53f69)
- 🔧 Chore/Other:补 F-073/074/095/069 双断言夹具(旧绕过路径被拒 + 正常路径照放行) (400c6dfc7d)
- 🐞 Fix:补齐进程树回收、POSIX 沙箱超时杀组、出口 fail-closed、LSP 回收、记忆原子写去重、钩子中央派发与子代理基线 (F-003/004/075/087/088/097/098/103; F-080 已在上一笔) (e7c9754681)
- 🐞 Fix:XUI-003 会员 /vip/my 拆 {vip} 包络并归一 user_vips 行 (1576fe79aa)
- 🐞 Fix:修复异常退出码、审计/argv 脱敏、状态文件权限、WS 过载、签到回跳与深链/托盘授权 (F-002/005/006/007/008/046/047/062/100; 含 F-080 原子落盘) (b107b1cd3e)
- 🐞 Fix:修复插件名/落点逃逸、沙箱白名单与 ACL 越界、回收站与隔离区恢复越界 (F-069/070/073/074/101/102/095/053/099) (c6e262ba6e)
- 🐞 Fix:F-205 关注幂等语义修正,堵住重复刷积分 (99a7e1e7f2)
- 🐞 Fix:push 门缓存指纹纳入全仓脏状态(含 scripts/ 与根配置),超限 fail-closed (1adb9a7bbc)
- 🐞 Fix:P1 越权面收口(会话/检索/图谱/Hook/预算/媒体/发布/recap) (2ec168289f)
- 🐞 Fix:XUI-002 订单详情拆 {order} 包络并修正 RN 字段映射 (5d668e9d2a)
- 📚 Docs:对齐 XUI-001 新增测试文件后的文档计数 (edd666cd1b)
- 🐞 Fix:F-166 课程/视频管理写端点升级为 requireAdmin (5f0adc5e76)
- 🐞 Fix:XUI-001 订单状态视图补全 7 值并对未知状态兜底 (81c4ff1ffe)
- 🐞 Fix:F-133 personality 读写加属主/管理员闸门 (84d4c21002)
- 🐞 Fix:补齐 Web 订单状态 refunding/completed/failed 三值文案 (67dc23846b)
- 🐞 Fix:F-61 分销提现改走 applyWithdrawal 原子冻结 (14d4b67ffa)
- 🐞 Fix:修复 CLI/桌面 3 条 P0(run_tests EINVAL、store 越权、钩子自证绕过) (35bc40522f)
- 🐞 Fix:全量腿共用 gate-prep 取材面 + 按门看门狗预算(30a 不再被 300s 恒杀) (5e1997f6ae)
- 🐞 Fix:F-53 /auth/profile 禁止仅凭会话改绑邮箱 (adab73935a)
- 🐞 Fix:封死 AIS-031/AIS-052 任意 argv 越权面(P0) (0d542813ed)
- 🐞 Fix:F-01 public-socket 运维端点补 await 管理员判定 (edbdc7126d)
- 📚 Docs:auto-triage 自动登记(api-logs;第 1 期感知层产线动作,O65) (616fb59a5a)
- 📚 Docs:auto-triage 自动登记(api-logs;第 1 期感知层产线动作,O65) (aec3023ba2)
- 📚 Docs:auto-triage 自动登记(api-logs;第 1 期感知层产线动作,O65) (d400a0e35b)
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
