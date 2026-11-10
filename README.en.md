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
| 数据库表 | 629 | `dbTables` |
| schema 文件 | 242 | `dbSchemaFiles` |
| API 路由 | 4743 | `apiRoutes` |
| 路由文件 | 689 | `apiRouteFiles` |
| AI 服务路由 | 676 | `aiServiceRoutes` |
| WebSocket 端点 | 29 | `wsEndpoints` |
| 入库模型清单 | 100 | `llmModels` |
| 发布平台 | 38 | `publishPlatforms` |
| 端应用包 | 9 | `appPackages` |
| 共享包 | 17 | `sharedPackages` |
| CLI 命令文件 | 75 | `cliCommandFiles` |
| CLI 工具文件 | 102 | `cliToolFiles` |
| 语言 | 5 | `i18nLanguages` |
| i18n 作用域 | 7 | `i18nScopes` |
| 语言包 JSON | 35 | `i18nMessageFiles` |
| 测试文件 | 4819 | `testFiles` |
| CI 工作流 | 59 | `ciWorkflows` |
| Compose 服务 | 14 | `composeServices` |
| 工程守门 | 356 | `guardianGates` |
| — blocking | 327 | `guardianBlocking` |
| — warn | 31 | `guardianWarn` |
| 跟踪文件 | 20866 | `trackedFiles` |

上表由 `node scripts/sync-readme-numbers.mjs`(唯一写入口,索引面取数)生成,最后核对日期 2026-11-10。
每个数的来源就写在取数键旁边的实现里(`scripts/gen-doc-numbers.mjs` 的 `SOURCES`),**不得手抄、不得另立第二份**。

<!-- END GENERATED NUMBERS -->


## Recent updates (auto-maintained)

<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->
**2026-11-10**
- 📚 Docs:README.en.md 头条数字对齐现算值(数据库表 624→629 / API 路由 4719→4733 / CI workflows 54→56)，消门 173 散文漂移 (deac1ec676)
- 🐞 Fix:修复人事考勤链路五处断点(barrel 导出/build 链/类型/权限档位/幽灵列)并补 59 条路由契约锁 (b110ba536c)
- 🐞 Fix:HR 迁移补登记 journal(B1/B5)并前向补部门树外键与 RBAC 权限点 (52ba369f82)
- 🐞 Fix:pre-push 增跨分支推送告警(审错树点名,不改判据与退出码) + README 点名 scan-api-routes.mjs 接线 (195eb486dd)

**2026-11-09**
- 🚀 Feature/Improvement:API 端点桥 5 枚通用工具 + HR 工具族契约化,并清偿门 204 两处 (7cc2a3c29a)
- 📚 Docs:登记人事考勤自动化四期 HR-1..HR-4(机主 2026-11-09 定「放到计划任务里,现在先不做」) (e21c471fe6)
- 🚀 Feature/Improvement:收口 CLI 路由→工具通用工厂(route-tools.ts)与 i18n 压缩产物重生成(sourceCommit 对齐 HR 提交) (6ad9467976)
- 🚀 Feature/Improvement:补齐 CLI 工具族——HR_TOOLS 暴露 AI 对话框考勤操作 + hr_ 审批语义(agent.ts/permission/rules.ts 接入) (162d9a3d0d)
- 🚀 Feature/Improvement:人事考勤模块隔离收口——attendance-core 共享内核/5表/幂等迁移/api路由服务/三端骨架(web·RN·小程序注册)/15文件i18n(41键) (fc2f61da6f)
- 🐞 Fix:读准防线族 5 处 git 派生补显式 stdio(门 193 存量清零) (df08126dc7)
- 📚 Docs:自动同步缺口账本到现读口径(镜像 256 · 缺口 19) (c098a539b8)
- 🚀 Feature/Improvement:协议/考试结果/运行时面板等多屏共享化收编——RN/小程序/web 三腿同批 (fda837a1b4)

**2026-11-08**
- 📚 Docs:记两枚悬空提交的归宿与门30a/写口判面不一致票 (2a7524687a)

**2026-11-07**
- 🐞 Fix:门24a 补 src/dist 派生资源一致性判据并同枚补测 (a0d7b042f1)
- 🔧 Chore/Other:元门B:空输入保护改可审计四分类(真洞/误报/待人工判/已保护),按函数作用域+执行路径判定 [immutable-exempt: 升级共用分类器以消除行窗口启发式误报] (4571cda839)
- 🐞 Fix:8 道门「没读到被审面」取材修复(74/84/153/244/268/277/284/296) (d1bad87c2e)
- 🚀 Feature/Improvement:推送两道拒绝闸 —— 缺省 = 不推(协议闸 + 窗口闸) (e5360a6087)
- 🔧 Chore/Other:重封根护栏清单,并同枚补 AGENTS 点名 5 枚读准防线元门 (e8a8563ceb)
- 📚 Docs:侧栏展开宽最终定档 160px 三端统一 此后不再改动 (d80fd0044d)
- 🔧 Chore/Other:§1 归档两步走 — 先把 AGENTS 压缩迁出的原文入库 (bcc13936c0)
- 🚀 Feature/Improvement:新增读准防线四道元门与门属主登记 (9124b8ae6b)
- 🐞 Fix:225/240 取材面改统一面规格(索引=:stage0),取数失败与真缺失分流 (1b7bd36f9c)
- 🐞 Fix:293/298/13d/70b 接 deltaParents 合并面基准,245 分流枚举失败与真的 0 份 (715a00ae92)
- 🐞 Fix:合并提交的「本次新增」改判为两父皆无,16 门接共享 merge-delta (92fc7ed90e)
- 🚀 Feature/Improvement:共享屏规模化收编 5 页并补齐 ICP/证书两屏契约 (be77bad961)
- 🐞 Fix:safe-commit Step 2b 的 README 生成块改用 staged 面 (6111a478fd)
- 🚀 Feature/Improvement:新增 worktree 链接修复器(重指自树 + 共享 node_modules 安全重建) (52b3f3890e)
- 🚀 Feature/Improvement:新增 worktree 链接完整性检测门(@ihui/* 指向非本树即违规,白名单可配) (eca6631a7e)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (9dd7151725)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (d5f8a86488)
- 🔧 Chore/Other:商店凭据元数据移出版本控制并改为脱敏模板 (cdb7bb99e5)
- 🐞 Fix:web 腿改打专用 /health、重拉窗口提到 readyTimeoutMs、watchdog 复活改非阻塞 (570d7eac2a)

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

**2026-11-07**
- 🐞 Fix:签到按钮同 tick 互斥与失败复位(票 F),并发两次只发一次请求 (125d3b1f3f)
- 🐞 Fix:签到助手回屏只刷新一次(票 D),复用 screen-reappear-adapter (29085fdd48)
- 🐞 Fix:web checkin 改名 checkinAssistant,与 checkIn 区分 (4623179dfc)
- 🐞 Fix:重发倒计时秒数上屏,补全 5 locale 占位符并清掉全量静默丢参 (ef4478996d)
- 🐞 Fix:签到助手写操作加同 tick 互斥与 finally 复位,消除连点重复签到/重复启停 (077ee973a8)
- 🔧 Chore/Other:收编守护落档产出(3 件,凭落点账本) (98b102011c)
- 🐞 Fix:T1 超时预算畸形改硬失败 + 棘轮改跨提交史比对 (3444b0ae67)
- 🐞 Fix:T1 预算棘轮补 margin 证据链,自包含复核判据入库 (6013b5e151)
- 🐞 Fix:T1 改并发4+LPT 派发(300s 让位于实测基线),门251 修 staged 参数序+批量取面并补夹具,worktree 自有 node_modules (a8ff738ce2)
- 🐞 Fix:提现状态五语言包补齐 processing(web 管理端映射同步) (7b95c067b2)

**2026-11-06**
- 🐞 Fix:收口 push 门 typecheck 基线 —— 补齐测得出的契约缺口 (16d9e7721a)
- 🐞 Fix:skill_list 注入登记与生产出口对齐,补齐 frontmatter 三字段契约 (01f9dc5075)
- 🐞 Fix:修正 staged 面 git grep 选项顺序,让提交链能真正取到候选清单 (587d320556)
- 🐞 Fix:同步 Maximize2 生成图标(11h 图标替换的派生产物) (80d8b059dd)
- 🔧 Chore/Other:删除 miniapp dispatch 已实际注册帧的过期 missing 登记 (5382b67330)
- 🐞 Fix:补对话流锚点、圆角档位与真重试,重跑 ui-routes 生成物 (f34b4130c3)
- 🐞 Fix:补 read_tool_output 工具名映射与五语言 taskStatus 键 (8fcbd2354b)
- 🐞 Fix:跨端共享屏与 RN 深色前景/圆角角色档收敛到基线内 (3828fdd41b)
- 🐞 Fix:图标位 emoji 换 lucide 组件,同笔收敛品牌前景与圆角角色档 (dc4c471aa2)
- 📚 Docs:同步生成块计数到当前 HEAD (d4094d7efd)
- 🐞 Fix:门 260 升级 joi 17.13.9 修二次时间 DoS (26d5a88216)
- 🐞 Fix:门 94 补录 4 个未登记 errorCode (571fde5fbd)
- 🐞 Fix:修复 21:05 批改写引入的语法与默认值缺陷，保证空库可从零跑到 370 (523405c8c0)
- 🐞 Fix:清 5 道门红点(173 文档数字 / 207 AGENTS 体积 / 265 ps1 BOM / 267 根护栏重封 / 47 溯源水印) (7c6aff5993)
- 🐞 Fix:门 52 补 windowsHide 防桌面黑窗 (014e9d62fa)
- 🐞 Fix:门 197 截断声明块补计数/总量兄弟键 (56da828293)
- 🐞 Fix:门 263 清零 ruff 欠账 (365722208f)
- 🐞 Fix:隔离必失败的 20261106150000 迁移件并补齐 369/370,解除生产部署阻塞 (93bdb57389)
- 🔧 Chore/Other:sync-readme-numbers 覆盖活性区散文(同门 173 判据)+ 双夹具;README 跟踪数 19496→19498 (8322e79960)
- 📚 Docs:散文数字同步(apiRoutes 4699→4700,scrub --scope=active 共 11 行) (dcd9eaf10c)
- 📚 Docs:用 sync-readme-numbers 刷新 README 生成块(apiRoutes 4700 / testFiles 4226 / trackedFiles 19496) (9a8e6fb3e7)
- 🔧 Chore/Other:chat 页(BUG-67 浮层)按复制页重新在册,门 299 判绿 (5130247253)
- 🐞 Fix:rn-shell-types 派生件接入提交链,251 触发面补 types/ (5cc02e6c39)

**2026-11-08**
- 📚 Docs:同步 RECENT UPDATES 生成块与 doc-autoupdate 基线 (2485323c91)

**2026-11-08**
- 🔧 Chore/Other:补齐门 47 自愈注入留下的隐形载荷缺口，无业务改动 (f3ae170b31)
- 📚 Docs:同步 RECENT UPDATES 生成块与 doc-autoupdate 基线 (8063d609f5)

**2026-11-08**
- 📚 Docs:同步 README 正文的测试文件现算数(4446) (eb11488487)
- 📚 Docs:同步 F-38 夹具后的 README 现算数字(testFiles 4446 / trackedFiles 20184) (82bd61611f)
- 🐞 Fix:F-38 aiServiceFetch 补默认 deadline 并抛可识别超时错误,与上游 5xx 区分 (0ef93c94b6)
- 📚 Docs:同步 README 正文的测试文件现算数(4445) (bf72910261)
- 📚 Docs:同步 F-08 夹具后的 README 现算数字(testFiles 4445 / trackedFiles 20183) (f130b15a5e)
- 🐞 Fix:F-08 agent-control 待处理指令绑定属主,/result 与 /execute 双端校验归属 (92339429b8)
- 📚 Docs:同步 README 正文的测试文件现算数(4444) (0d24bd2a0b)
- 📚 Docs:同步 F-07 夹具后的 README 现算数字(testFiles 4444 / trackedFiles 20182) (b292f991f5)
- 🐞 Fix:F-07 后台 Agent 的 list/get/cancel 按登录归属过滤，创建归属不再接受 body userUuid (831f9fd268)
- 🐞 Fix:清偿全量 typecheck 存量红（14 处，含 F-270/F-252 遗留的类型回归） (e009f22742)
- 📚 Docs:同步 F-223 夹具后的 README 现算数字(testFiles 4443 / trackedFiles 20181) (3bbf54cc3c)
- 🐞 Fix:F-223 未匹配路由的 apiCallTotal 统一落 __unmatched__，消除无界标签基数 (c6730d06bc)
- 📚 Docs:同步新增夹具后的 README 现算数字(testFiles 4442 / trackedFiles 20180) (6414ce5494)
- 🐞 Fix:F-291 SSE 重放缓冲容量满时重注册不再误淘汰其他活跃流 (461bbae68a)
- 📚 Docs:同步 README 文档数字与最近提交面（testFiles/apiRoutes/trackedFiles 与现算对齐） (e179987387)
- 🔧 Chore/Other:补门 193 存量违规 —— check-hand-migration-snapshot 的 git diff 派生显式接管 stdio (3eba6c71fd)

**2026-11-08**
- 🔧 Chore/Other:补门 193 存量违规 —— check-hand-migration-snapshot 的 git diff 派生显式接管 stdio (02d2f85062)

**2026-11-08**
- 🐞 Fix:F-290 WS 限流删除 BURST 死分支，30 条/秒为硬上限 (5828640196)
- 🐞 Fix:F-188 统一 skills:<uid> 为 JSON 数组，识别并救回历史 Hash，install 不再吞掉写入失败 (6a087b84c9)
- 🐞 Fix:F-165 调用趋势改用 llm_call_logs.cost_cents，消除恒 500 的空面板 (4609d003c7)
- 🐞 Fix:F-30 workspace git/status、git/review-diff、github/status 接入 workspace 权限闸 (6d9f31cdb2)
- 🐞 Fix:F-29 pipeline-rollback 的 backupDir 限制在工作区内，拒绝绝对/.. 越界读取 (be36fcbc95)
- 🐞 Fix:F-85 Batch 单对象端点校验 _apiKeyId 归属，跨租户读写/取消按 404 (71ec16d9d9)
- 🐞 Fix:F-180 响应缓存键改用 upstreamMessages 并纳入 top_p/penalties/seed/response_format (d458f4dd64)
- 🐞 Fix:F-56 OAuth authorize/userinfo 叠加 token 黑名单检查，登出后不能再换新令牌 (4699e0f2bc)
- 🐞 Fix:F-288 CSV 注入过滤覆盖前导控制字符/空白，导出器 TAB 也加引号 (a6efaa3015)
- 🐞 Fix:F-252/F-253 自动化 SSE 增加总/空闲超时，断流与流内错误帧按失败结算 (2a68bd67a0)
- 🐞 Fix:F-259 超长幂等键不再静默截断（三处读键统一按没带处理）；F-270 Coze token 缓存按 clientId|userUuid|scope 分槽 (87677474fb)
- 🐞 Fix:F-238 洞察成本维度改查 cost_cents 并暴露降级维度；F-246 审计链查询区分缺表与失败，失败不再静默成空 (46a214d33b)
- 🐞 Fix:F-472 ai-service 直连代理补齐超时；F-473 OAuth 回调补齐超时；F-474 Coze SSE 空闲超时与客户端断连取消 (abb452a946)
- 🐞 Fix:F-347 自定义 registry 识别 IPv6 方括号与 302 逐跳复检；F-348 fetchWithTimeout 覆盖正文读取 (f3ffa5377a)
- 🐞 Fix:F-420 生成队列去重不再把 completed/failed 旧作业当命中；F-421 TaskExecutor 支持取消/超时/wait 上限与任务表上限 (16ab6c051f)
- 🐞 Fix:F-428 batch 保存失败也断开 Redis 连接；F-423 配对过期请求与超量会话回收 (8ed9eb7cfb)
- 🐞 Fix:F-418 anydoc 加载失败不再被进程级永久缓存，失败后下次请求重试（文档解析与 Markdown 转换两处） (efd68fc2d5)
- 🐞 Fix:F-340 上一面登记表解析失败透传为未判定；F-411 定时任务 errors 非空记 failed (33b686a754)
- 🐞 Fix:F-616/617/670 relay 渠道腿上游头超时、4xx 不计熔断、客户端断开不记失败账(并顺带 cancel 非 2xx body) (80e36e330f)
- 🐞 Fix:F-377/F-378 登录风控上下文补齐 ip 信誉与异地判断，注册风控数据源不可用时 fail-closed 503 (41b82ed961)
- 🐞 Fix:F-605 风控体检测点不再先于 authenticate 执行，改挂路由级 preHandler 末尾 (df1037b42b)
- 🐞 Fix:F-269 注销 PII 擦除事务化并补齐五类残留表 (16d4484e2c)
- 🐞 Fix:F-206 浏览量 onResponse 单点计数 + F-284 err 日志打码 (9352cdf254)
- 🐞 Fix:F-260/F-261/F-671 表格与 diff 资源预算、上游断连取消 (7bd0bbd134)
- 🐞 Fix:F-139/F-140/F-236 知识库入库事务化与终端会话回收 (1f051a19df)
- 🐞 Fix:完成率 count 转 int、账本 user_id 放宽可空并补迁移（F-699/F-433） (2c34c4fd6f)
- 🐞 Fix:原子回滚 checkpointId/快照路径越界校验（F-27） (0b36ae1723)
- 🐞 Fix:n8n webhookPath 同源校验与 SSRF 危险地址族补齐（F-117/F-215） (9b5cf6dc89)
- 📚 Docs:登记 ai-service 沙箱实现缺失与 30a 缓存分片/备份命名空间事实 (a8e5f11ca7)
- 🔧 Chore/Other:登记 DB-34/38/39 两条迁移到 journal（idx 375/376） (f3d60f9569)
- 🐞 Fix:大表索引部署前 CONCURRENTLY、租户池预算、副本选举、批量价格/配额与旧表白名单（DB-11/41/42/43/44/45/46） (1537567c09)
- 🐞 Fix:统一连接池护栏、池可关闭、max 可配、校验脚本去明文口令（DB-29/30/31/32/33/36） (459b820415)
- 🐞 Fix:全新库守卫接线、迁移 workflow 复位、读写分离健康与读己之写（DB-08/10/26/27/28） (4b83d3e3ca)
- 🐞 Fix:批量取账本/小节、订单按时间序、统计总览缓存（DB-20/21/22/23/24/25） (1b014454f3)
- 🐞 Fix:备份加密、管理员口令重放守卫、RLS 旁路收窄（DB-34/38/39） (ce81516076)
- 🐞 Fix:team memory 越权写、隐私预热误判、DAG 跳过与配额重试、符号检索归属（SDB-31/34/37/38/39） (0323111b74)
- 🐞 Fix:修掉 mcp 与安全组 9 条存量红 (764221fff7)
- 🐞 Fix:withTenant 的 SET LOCAL 必须在事务内并对租户标识 fail-closed（DB-40） (5b705b64ec)
- 🐞 Fix:relay 凭据刷新不再丢字段/丢更新，并修 alipay 时区、cli-import 后缀、告警任务状态（SDB-32/33/42/43） (f6bee8ba44)
- 🐞 Fix:对齐 schema 与迁移链的漂移并修 NOT NULL/唯一约束（DB-16/17/18/19/37） (27cff4fa99)
- 🐞 Fix:迁移账本一致性与手工修复通道收口（DB-07/09/12/13/14/15） (8a7c642ed4)
- 🐞 Fix:手工迁移执行器改用共享 SQL 分割器与事务化执行（DB-04/05/06） (476da42973)
- 📚 Docs:测试文件计数 4367 → 4372（合入 db-p1 新增的 5 个测试文件） (1513c11c13)
- 🔧 Chore/Other:USDT 到账夹具的有效期改为相对当前时刻，消除固定 T0 过期时间炸弹 (5cd4b33ebd)
- 🐞 Fix:子代理回放终态纳入 stub，复用 backgroundTask 状态词 (1d27adcba4)
- 🐞 Fix:时间线计数补 stub 键；空状态模板开关回落到 onTemplateSelect 契约 (0a1db8503c)
- 🐞 Fix:重派生 rn-shell 声明，补上 VipTraderScreen 契约 (f5c6cb0783)
- 🐞 Fix:清掉误回盘的死 list-view 并收敛重复 configure；重跑 ui-routes 派生钉 (5ee8200673)
- 🐞 Fix:共享第三方平台类型补齐 linuxdo（与 web 端既有能力对齐） (fdb05b274f)
- 🔧 Chore/Other:会话导入用例按 noUncheckedIndexedAccess 收窄空值 (5876707f98)
- 🐞 Fix:接上超级智能体泵启停导入 + 修正快照持久/恢复类型窄化 (039bc57a68)
- 📚 Docs:登记 T1 在纯净 origin/main(00fa9e977f) 即红的基线存量 18 条 (bbcd663951)
- 🐞 Fix:窗口 -1(不限)不再被 Math.max 归一为 0，订阅配额正确落 -1(SDB-04) (3ce91de9d1)
- 🐞 Fix:Crew 计费改为按单次 runId 幂等并结算失败/取消分支的实耗(SDB-30) (3eb4787c1d)
- 🔧 Chore/Other:登账(缺陷普查批次23/23): services/DB 56 条(含 5 条按复核修正晚级)；索引同步 (00fa9e977f)
- 🐞 Fix:鉴权 join users.status 并补注销吊销 developer_api_keys/分享 token(SDB-29) (2e172868ad)
- 🐞 Fix:worktree 面跳过依赖/产物目录,非普通文件不判取不到 (e272f4246e)
- 🔧 Chore/Other:登账(缺陷普查批次22/23): API 收尾 F-721~F-728 共 8 条 (f314bb7067)
- 🔧 Chore/Other:登账(缺陷普查批次21/23): API F-661~F-720 共 60 条 (679c7fd871)
- 🐞 Fix:修 miniapp 历史重试假重载并在 staged 面正取候选清单 (fa06091fec)
- 🐞 Fix:USDT 到账改为唯一金额尾差+精确匹配+未占用 txHash,并翻页覆盖下单至今(SDB-27/28) (23edfeecbf)
- 📚 Docs:记重放前置依赖表(291 只报数不拦提交/typecheck 判据/生成物 pin/README 写入口) 与 push 档独占门 193 的错觉教训 (0d07c3edae)
- 🐞 Fix:共享屏 diff 取档的 execFileSync 补显式 stdio 三槽, 过门 193 的 stdio 显式属性名判据 (a9e2ec90b7)
- 🔧 Chore/Other:登账(缺陷普查批次19/23): API F-541~F-600 共 59 条(F-580 与 DBG-4 重复) (59f8e3168c)
- 🔧 Chore/Other:登账(缺陷普查批次18/23): API F-481~F-540 共 60 条 (1840336239)
- 📚 Docs:registry 保持登记现值并列入保留清单(不改承载面),补正门读数与 21 行口径 (fc4bc77051)
- 🐞 Fix:删除 VipScreen 未被消费的必填端口 onNavigate(门290 两处空端口确证为空) (e85a3b0753)
- 🔧 Chore/Other:登账(缺陷普查批次17/23): API F-421~F-480 共 60 条 (059017cad3)
- 🐞 Fix:余额入账改为单条原子自增/行锁读，消除 USDT 充值与应用订阅并发丢账(DB-03) (8b47174190)
- 📚 Docs:记安装完整性检查的判据、两条读数(exit 0 / 缺 node_modules exit 2)与不扩边界 (d46c983294)
- 📚 Docs:22 条缺 RN 行逐条核验;login/mcp-store 改指壳、registry 改判 portal、19 行补渲染点证据 (2190b793a6)
- 🔧 Chore/Other:登账(缺陷普查批次16/23): API F-361~F-420 共 60 条 (24379a5a0d)
- 🐞 Fix:staged typecheck 加安装完整性前置检查, 缺 node_modules 判 exit 2 (2c0ac6e502)
- 📚 Docs:staged typecheck 缺依赖产物改为 exit 2 已落地, 记三组脱链复验与残存缺口 (4cef479d0c)
- 📚 Docs:补记门读数前提与并发假红重试留痕(30a 一次,附现场物证) (c0db81dc03)
- 🐞 Fix:staged typecheck 依赖产物缺失判 exit 2, 不再把取不到记成改动文件的假红 (7f4f5b01c9)
- 📚 Docs:cherry-pick 生成物通则、staged typecheck 缺 dist 票、icp-record 第 4 条口径 (ab032a7368)
- 🔧 Chore/Other:登账(缺陷普查批次15/23): API F-301~F-360 共 60 条 (f22d7a5719)
- 📚 Docs:icp-record onQuery 改为行模型 href,撤销丢外链让步 (c720fe9d37)
- 🐞 Fix:自动续费回调的建单/完成并入外层事务，消除半提交与重复发权益(DB-02) (55efcffe13)
- 🐞 Fix:合一 /member/favorites 复用 /favorites,门 301 按票作废落档 (cbb5759b19)
- 🔧 Chore/Other:登账(缺陷普查批次14/23): API F-241~F-300 共 60 条 (16df61ba1e)
- 🐞 Fix:手工迁移账本改用 drizzle sha256 + journal.when 且同事务写入(DB-01) (4ff6d1ff57)
- 🔧 Chore/Other:登账(缺陷普查批次13/23): API F-181~F-240 共 60 条 (b6b1ebe470)
- 🚀 Feature/Improvement:icp-record 行模型加可选 href,备案链接两端渲染 (a611c577d1)
- 🔧 Chore/Other:登账(缺陷普查批次12/23): API F-121~F-180 共 60 条 (c182c809fb)
- 🔧 Chore/Other:登账(缺陷普查批次11/23): API F-61~F-120 共 60 条；行题面加来源前缀消除跨源同号误判 (65e022cb30)
- 📚 Docs:colorScheme 全量改后读数与逐处改前改后值 (7a146402b1)
- 🐞 Fix:colorScheme 跟随 resolvedTheme,消除暗色下亮色页 (52ff17b485)
- 📚 Docs:62→71 定性为读数口径修正;分列 9 条误判与 22 条缺 RN 行;colorScheme 扫描;icp-record 判定/修后渲染与内容待定草案;同步 README 生成块 (55de37b336)
- 🔧 Chore/Other:登账(缺陷普查批次10/23): API F-01~F-60 共 60 条 (82c138ff8d)
- 🚀 Feature/Improvement:新增 web 唯一键 settings.icpRecordFooter,供 icp-record 接屏草案的 footer 映射(内容待定) (81306cba0a)
- 🔧 Chore/Other:登账(缺陷普查批次9/23): 跨端 UI 收尾 12 条 (f9aa837257)
- 🐞 Fix:钱包提现页 colorScheme 跟随 resolvedTheme,修暗色用户看到亮色页的已上线退化;同步 ui-routes 输入指纹 (ab50d8d70b)
- 🔧 Chore/Other:登账(缺陷普查批次8/23): 跨端 UI XUI-001~XUI-060 共 60 条 (2405af4f0c)
- 🔧 Chore/Other:登账(缺陷普查批次7/23): AI 服务 AIS-061~AIS-118 共 58 条 (05559cc4d5)
- 🐞 Fix:共享屏 icp-record 标签显式成对,修正 label1-label5 错位;公网安备号/备案时间保留,无 onCopy 时不渲染复制卡;同步重生成小程序离线语言包 (8947e198c8)
- 🔧 Chore/Other:登账(缺陷普查批次6/23): AI 服务 AIS-001~AIS-060 共 60 条 (1332600c7a)
- 🔧 Chore/Other:登账(缺陷普查批次5/23): DB 45 条(DB-40 与 DBG-3 重复不入册) (9453ad492c)
- 🐞 Fix:宿主改读跨端登记表,读不到即未判定(exit 2) (75c8e01d93)
- 🔧 Chore/Other:登账(缺陷普查批次4/23): CLI/桌面收尾 16 条 (d64ddfec88)
- 🔧 Chore/Other:登账(缺陷普查批次3/23): CLI/桌面 F-061~F-120 共 60 条 (963ee4ebf2)
- 🐞 Fix:去重映射表 3 组重复并清 5 条失效映射;基线吸收 ModelList 平台专属 onContentSizeChange (0c74ece9f1)
- 🔧 Chore/Other:登账(缺陷普查批次2/23): CLI/桌面 F-001~F-060 共 60 条 (714866c37e)
- 🔧 Chore/Other:登账(缺陷普查批次1/23): DG/W 21 条入册并归档 8 份报告 (78d0ee9b5a)
- 🐞 Fix:删除 06927f16fa 并集归并引入的重复 catBatch import,恢复门可解析与真实读数 (221c85c80a)
- 🚀 Feature/Improvement:新增 web 接屏脚手架与登记表层别漂移 advisory 门 (a047c571ab)
- 🚀 Feature/Improvement:新增跨端生产线总账与共享屏平台限制判据 (751f33ec8b)
- 📚 Docs:记 cut9 两文件测试的 3 条存量红(与 main 同红,非本笔引入) (67721b7bcc)
- 🐞 Fix:refs 面快进不算重指(避免 push 后 41 假红) + 票补 cut9 重提读数 (833071424e)
- ⚡ Perf:302p 漂移回归门提速 —— 全树 ls-tree 轮内快照 + 判据面收窄 (256be1a65c)
- 📚 Docs:回填 cut9 四道存量红处置结论与 41 分支清点 (3785f8e299)
- 🐞 Fix:explicitFull 只认 GITHUB_ACTIONS,避免宿主 CI=true 关掉 stock 降级 (78c3a05c47)
- 🐞 Fix:两处哨兵身份判断去掉 message 文本匹配,行为等价 (7616c81f18)
- 🐞 Fix:门57 锚点改指共享屏重构后的真实渲染宿主 (92a6e3ee6a)
- 🚀 Feature/Improvement:门判据面 delta/stock + 存量红只报数(路线2) (d1c270d694)
- 📚 Docs:登记 cut9 四道存量门红项(41/57/204/70b) + gate-302 门票落库 sha 89a5938f0c;README 生成块经 sync-readme-numbers --face=staged 重算 (d4e1621806)
- ⚡ Perf:T1 逐包并发 + dist 内容寻址,判据不降 (07f89f627c)
- 📚 Docs:新增 302p 两处结构缺陷门票(登记盲区 + judgedGapWeb 方向混维) (89a5938f0c)
- 🔧 Chore/Other:302 基线定向刷新 judgedGapWeb 0->1 —— /sag2 如实登记缺屏 (1b984a2246)
- 🐞 Fix:30a 结论缓存按判据输入面四指纹复用(修复 3b 有缺口时永不落缓存导致每次全量重算) (dfc2d369ab)
- 🚀 Feature/Improvement:SAG2 词法多跳检索通道前后端落地（rea 取证 + 本仓自有实现） (c20e4a5797)
- 📚 Docs:补充后台 worker 被杀的 fail-closed 语义(残留标记最多等 240s,否则立即回落真跑) (e1086e3467)
- 📚 Docs:补齐推送路径实测墙钟(改造前 105.22s 中位 / 改造后 2.74s 中位 / 回落 115.57s 真跑 13 门证据) (e33313ad3c)
- 🐞 Fix:CLI 根推导退一级修正(scripts/ 入口不能复用 scripts/lib/ 的 ../..) (d365b725b3)
- 🐞 Fix:钥配置按 KeyPath 语义读取文件内容(不得把路径当密钥) (bab82b2299)
- 🚀 Feature/Improvement:提交侧求值 + 推送侧凭据校验(13 门/文档数字/i18n 后台真跑, fail-closed 回落) (a78bee7f3d)

**2026-11-07**
- 🚀 Feature/Improvement:验证码复制按钮改为右侧细描边胶囊并上线落地页 (578c4caf4e)
- 🚀 Feature/Improvement:门结果缓存 + 后台预跑(新增 gate-cache/gate-worker/夹具/注册表) (a49fd06f05)
- 🔧 Chore/Other:D15 对照的 git show 显式接管 stdio(门193) (2ae1a6f90f)
- 📚 Docs:push 面现算对齐 testFiles 4359→4363 与 apiRoutes 4722→4725 (4e82155935)
- 📚 Docs:对齐 push 面 apiRoutes 散文 4722→4725(README.en) (2ff1ed9a34)
- 📚 Docs:校正合并后 apiRoutes 散文数字 4722→4725(官方 scrub 重算) (d62645a507)
- 📚 Docs:归档 2026-11 票与事故记录 (2616002dbb)
- 🚀 Feature/Improvement:邮箱验证码邮件增加一键复制按钮与站点落地页 (aea6081e61)
- 📚 Docs:合并后 push 面现算对齐 testFiles 4349→4353(13 处散文) (d3fed962d3)
- 📚 Docs:README.en 口径行 workflows 数对齐现算 56 (c2b71ce79e)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (f7141dee38)
- 🐞 Fix:修 main 既有 T1 红 —— 超工快照类型面收口(来源 88e2e0b578,该修复此前只在本地 main 未推) (0bcf621eda)
- 🔧 Chore/Other:收敛推送落地后清回清单腐烂正确终态 (8329cc7ee7)
- 🔧 Chore/Other:33 条追认行按独立追认钥重签 (3b8531d83d)
- 📚 Docs:口径自述行 testFiles 对齐现算 4352 (46ad973c01)
- 📚 Docs:收敛落地后按门173 push 面现算值对齐 trackedFiles (d59b265444)
- 📚 Docs:数字对齐现算值(合入 codebase-index 后活性区+口径自述行) (fa9cbdfcb2)
- 📚 Docs:注释对齐唯一写入口(不再指向 gen-doc-numbers --markdown) (cceabb5246)
- 📚 Docs:按门173 push 面现算值对齐活性区数字与生成块 (4bff615e76)
- 🐞 Fix:陈旧 dist 前置改逐产物判据并复核重建产物 (89ddd4c08b)
- 📚 Docs:数字对齐现算值(活性区存量清偿,合并入队前基线校正) (9b719475b7)
- 🐞 Fix:README 生成块收口为唯一写入口 + 写盘 CAS 并发判定 (23f2dddbc0)
- 🔧 Chore/Other:README 生成块随 RP-42 刷新(3 个指标,HEAD 面重跑) (d93460fc66)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (13c9ab1bc8)
- 🚀 Feature/Improvement:超工慢路径判定环落地(RP-42 结清)。shared slow-path:三值 verdict+noteSlowDecisions 注记随快照活+judgeRecorded(record 档只注记不开工/auto∧act∧非机器人走与人工同一条 acceptRecorded 语义、inferred 强度、判定 reason 不渗授权范围/人点名仍在建议之上/通道抛错=未判定积压原地可重试);ai-service POST /api/super-agent/slow-path/judge(批量≤20 恰等长 JSON 硬校验、逐条 requesters 不含承载层主体 403、形状不符 502 不记绿,身份只从 require_request_user_id);api createSlowJudgeCall 注入式适配器(动态 import 测试零 config 拉起);泵 slowJudge 阶段 env 门控 IHUI_SUPER_AGENT_SLOW_PATH 未开=零模型动作。行为对照 dsh-superagent 两级过滤第二级,自写实现。vitest 46+3 例/pytest 12 例/mypy strict 全过 (61ed8adf90)
- 📚 Docs:结清 RP-42——慢路径判定环:shared slow-path 三值注记+judgeRecorded(auto∧act∧非bot 走 acceptRecorded 同一条语义、人点名仍在建议之上、通道抛错=未判定积压原地);ai-service POST /api/super-agent/slow-path/judge 批量恰等长 JSON 硬校验+主体资格 403;api 注入式适配器;泵 env 门控 IHUI_SUPER_AGENT_SLOW_PATH。46+12+12 例全绿+mypy strict (668e95e5e4)
- 🐞 Fix:账本族残渣闸补 root 注入 —— 治 T5/T26 稳定红 (b7a5beae9f)
- 🐞 Fix:清偿迁移链孤儿与 B5 类型畸形,重生成 miniapp-taro ui-routes 钉 (be99b07cfe)
- 🐞 Fix:派生腿整族改 spawn+await,并给长腿装 30s 周期心跳 —— 治 A11 轮内停摆的根因 (b7047ecda5)
- 📚 Docs:用法注释与默认面同步(人读表=索引面) (8bb6257091)
- 📚 Docs:auto-triage 自动登记(api-logs;第 1 期感知层产线动作,O65) (9241a26d3b)
- 🐞 Fix:取数面收敛为唯一权威面(写手默认=索引面),并重封 root-guard 清单 (05242dae38)
- 🚀 Feature/Improvement:超级智能体存算分离落地（RP-41 结清）。host snapshot/restore：版本/形状/归属三重 fail-closed、重放触发幂等、pendingStart 未派队列随账本活、按主体切片计数分账；api 泵每轮去抖落 user_preferences super_agent 组（同 permission 套路零迁移零新路由）、启动先恢复再开节拍；保留账号 IHUI_SUPER_AGENT_STATE_ACCOUNT 未供=unconfigured 如实降级、写失败=degraded 点名（§0.3 不冒充）。行为对照 dsh-superagent 状态持久化+重启恢复设计。shared 38 例+api 9 例全绿。README 功能面债:该文件正被别席大改(索引面 18k/37k 行),持久腿说明待其落地后同批补登 (b9b9181d60)
- 📚 Docs:结清 RP-41——超工账本入库:复用 user_preferences super_agent 组(同 permission 套路,零迁移零新路由);host snapshot/restore 版本与形状 fail-closed、重放触发幂等、pendingStart 随账本活;泵每轮去抖落库,启动先恢复;保留账号 IHUI_SUPER_AGENT_STATE_ACCOUNT 未供=如实 unconfigured。shared 38 例+api 9 例全绿 (4602c57e1d)
- 🐞 Fix:A1「新增行」在合并态对全部父提交求并集排除(单亲逐字节不变) (e26e18f69f)
- 🐞 Fix:长腿改异步 + 心跳点双侧齐平 —— 治 A9 载体分叉与 A11 轮内停摆;A6 分代 + 装车锁认得新形态 (d0028c046f)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (c2d342eb67)
- 🔧 Chore/Other:活性区数字随仓态清账(apiRoutes 4719→4721,11 行)+ 重跑生成块 (06a974db27)
- ⚡ Perf:只 blame 未勾选行,把取票口从 >300s 拉回 16s(治 A3 恒未判定 + 派发腿零派发) (44443b7661)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (4abe3a269c)
- 🔧 Chore/Other:补齐 README 活性区 27 处旧数(DN2 head 面) (46a27cb5a5)
- 📚 Docs:按 gen-doc-numbers 现算值刷新生成块 (73b0fdff97)
- 🐞 Fix:收窄 file-tree-memo 的 unread 入参到 unjudged 分支 reason (2587b33380)
- 🔧 Chore/Other:README 散文 28 处旧数对齐 head 面现算值(DN2) (f5a4ce8f5b)
- 🚀 Feature/Improvement:超级智能体装上 Watchdog 泵与租约心跳。事件源端口+巡检泵（回收即重派不隔拍、单端口故障隔离计数）、report/heartbeat 双通道续租、策略档 workerLeaseMs 默认关保持既有行为；派发经单一出口下传隔离身份与归属，泵循环 env 门控零定时器噪音。行为对照 DeepSeek dsh-superagent（MIT）设计，自写实现并超越（登录主体隔离槽位/租约记账）。shared 32 例+api 5 例全绿三遍稳定。README 功能表债:本票 README 行因 b96828411f 回归远端旧版失去锚点,未随本提交落地,待 README 功能面恢复后由后手同型补登 (61ac4819a2)
- 🔧 Chore/Other:重跑 README 生成块(3 个数随仓态漂移) (9118d99675)
- 🐞 Fix:两笔失效门的治(无 TS 输入面档 + 逐腿心跳),并把 README 回归远端版本 (b96828411f)
- 📚 Docs:超级智能体缺口四票入账（事件源适配器/工单入库/慢路径/工作台面板） (865ca1ea07)
- 🔧 Chore/Other:根护栏清单按收敛后 HEAD 现面重封 (f51957a86a)
- 🔧 Chore/Other:XSS 回归测试重钉到受控子集渲染器四道安全闸 (f2bf0b8c2b)
- 🔧 Chore/Other:按生成器刷新 tool_name_sets.json (f935d7646b)
- 🐞 Fix:心跳从「10 个段界」加密到「逐腿 24 个点」,把 A11 的假红收敛成真信号 (30f1f8f360)
- 🐞 Fix:密钥映射按服务面判定,12 枚媒体键不再读成 ai-service 缺行 (1fad91bb0e)
- 🔧 Chore/Other:清偿 README 活性区存量数字债(296 行),恢复「文档数字门」的可推性 (5a6051794e)
- 🔧 Chore/Other:重跑 README 生成块(6 个数随仓态漂移) (f9787f1d6b)
- 🐞 Fix:typecheck 门在「改动不含 TS 输入」时给可自证结论,并把等锁空烧变成可读诊断 (56051474b4)
- 🔧 Chore/Other:补 22 文件溯源水印 + 6 文件版权头(HEAD 面欠账,由 47p inject 生成,非内容改动;标点改动已剔除) (f7969f149f)
- 🐞 Fix:blame 档位没量到时不挑整文件也不挑行 (95797ca265)
- 🐞 Fix:宿主工单账写入会话库,重启后按同一 trigger 不再派工 (5087422beb)
- 🐞 Fix:按提交读 notes 时把引用不在和没记过分开 (991bac4981)
- 🔧 Chore/Other:违禁桶兜底清扫——HEAD面等条件/待拍板未勾行自动摘除(两道机主禁令的执行器物化,留痕f12-purge;复翻席请同步摘形态,事实内容按各批结清提交保留) (b400fe5189)
- 🚀 Feature/Improvement:作业嵌套失败不按错误码脱离父作业 (e3fc2b1ac4)
- 🐞 Fix:元运维巡检改 spawn+Promise,长腿不再冻结轮级锁心跳 (968f22d4f7)
- 🐞 Fix:提示词只按宿主编号另存，不写进 git notes (78046b6c54)
- 🚀 Feature/Improvement:接线 6 个未派发钩子并补齐 5 个控制帧(CLI / API / 引擎 / SDK) (d6d494fc42)
- 🚀 Feature/Improvement:研究检索只按量到的并发和抓取名额发外呼 (24de8f5b14)
- 🐞 Fix:检查点按去重键写入 git notes，缺引用不补空 ref (a4523173f8)
- 🐞 Fix:重生成 tool_name_sets.json 补 sandbox_session（307p 转绿） (2a0a228342)
- 🚀 Feature/Improvement:启动打点只认接口真正收下的名字 (312392020c)
- 🐞 Fix:量到工具面之外的改动才记 known_human (e09e49acf7)
- 🐞 Fix:写盘前先记 before_edit，写失败不补 after_edit (c22aa69118)
- 🐞 Fix:收窄 FileTreeVerdict 的 unjudged 原因集 —— 修复冷构建 tsc 失败(主线既有类型缺陷,纯类型不动运行语义) (eda8919a31)
- 🚀 Feature/Improvement:流结束时暂停或暂停态没量到就不自动补发 (848ec43bca)
- 🔧 Chore/Other:tool-name 集合补齐 codebase_index —— 新增 /tools/codebase-index 路由后按生成器同步 (80e67c7f8b)
- 🚀 Feature/Improvement:代码库索引能力增强 —— 符号目录 + 新鲜度三态 + 本地检索腿优先读目录 (6eb4b244d5)
- 🐞 Fix:段界检查点顺带续心跳,把 block-enter→post-feedback-loop 的 22 条腿切成 4 段 (7978ca2773)
- 🐞 Fix:编辑检查点按去重键追加，缺测字段不填默认值 (8ff125ddc5)
- 🚀 Feature/Improvement:网页构建模式把多步任务派给既有同进程 worker (1dee4efc82)
- 📚 Docs:对外宣称的 CI workflows 数同步为 55 (d3b5f3219c)
- 🚀 Feature/Improvement:新增能力评测基线并接入 CI 回归门 (26ad3cf05a)
- 🐞 Fix:治轮次静默死的三个真根因——空值解引用、长步骤吃满事件循环、逐文件派生 (47a298fc78)
- 🔧 Chore/Other:补齐 20261107150000_shared_to_ops_flag.sql 溯源水印 (b02fb56bcd)
- 📚 Docs:对齐合并后 HEAD 面对外数字 (9b482db189)
- 📚 Docs:HEAD 面对外数字对齐现算 (76681537f8)
- 🐞 Fix:侧栏宽度守门补齐「五面载体 + 取面纪律」,小程序抽屉菜单改竖排 (e69651e43f)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (1117fab7a9)
- 🐞 Fix:失败水位带上订阅和段，根窗格深链失败留空，待发队列可上下移 (31813a6bd8)
- 🚀 Feature/Improvement:为子代理模拟未完成补齐五语言状态词 (9befaa51cb)
- 🔧 Chore/Other:302 基线 aligned 293→292 —— 远端 a67379e71f 把 knowledge-planet 同键双行折叠为单行 (46594d4a9b)
- ⚡ Perf:削减单文件 lint 固定开销并给 lint-staged 加缓存 (728fdcccf6)
- 🚀 Feature/Improvement:把已取证的会话回放、索引开关和闸门判定落到本仓 (c6a00ffb74)
- 🐞 Fix:提交成功后给还没有提交号的归属账回填 (fa8b49f43a)
- 🐞 Fix:代码归属账记下宿主注入的会话号 (12037d4f7a)
- 🐞 Fix:未准入不再显示成已发送，水位能点名订阅和段，深链按轮取窗 (dfc2c7f48a)
- 🚀 Feature/Improvement:执行前先过宿主工作准入,不让消息正文决定派工范围 (41d2b455b8)
- 🚀 Feature/Improvement:新增桌面端发布核验器(列 Release 资产/签名缺口/下载入口,只读 GitHub API) (9d49b5351b)
- 📚 Docs:在四份 README 写上沙箱生命周期的用法 (ba28ac4d1e)
- 🐞 Fix:损坏的设置、会话、令牌缓存和快照不再被收成新的 (1ec54ac916)
- 🚀 Feature/Improvement:新增 OIDC 自建 IdP 与 GitHub 登录端到端验证脚本(缺凭证/网络不可达一律 exit 2 未判定) (2190cdce38)
- 🚀 Feature/Improvement:LinuxDo 登录接入 web/扩展/RN 三端,五语言词包补 linuxdoLogin (c98ee23482)
- 🐞 Fix:侧栏/抽屉宽度三端同源收口——几何档立 sidebarMaxWidth/sidebarCollapsedWidth,drawerWidth 250→160 (bf19e6174a)
- 🚀 Feature/Improvement:七家应用商店提交脚本补齐 --help 与 --self-test,统一退出码语义 (0feb8a8f16)
- 📚 Docs:铁律点名 e2e skip 由门 311 判 + 同题跨号更正 300→311 + root-guard 重封 (1291b6989a)
- 🐞 Fix:给沙箱会话补上五语言展示名 (a41e6ff7f2)
- 🐞 Fix:损坏的测试报告不再被当成没有结果删掉 (3490513565)
- 🐞 Fix:补上已经在调用、定义却还留在工作树的四个符号 (4fb33f60c8)
- 🚀 Feature/Improvement:agent_loop 高危判定接入动态注册表 write tier(最小接线) (ff8eb7bd55)
- 🐞 Fix:收口沙箱类型并清掉 mypy 全库剩余两处 (d79dde4d55)
- 🚀 Feature/Improvement:受信动态注册表,收紧目录/商店安装入口 (d85803931a)
- 🐞 Fix:损坏的存档不再被收成新的 (7cb5909c63)
- 🚀 Feature/Improvement:重引入 LinuxDo OAuth2 社交登录后端 provider + api 接线 + 6 例单测 (e3244b8166)
- 🐞 Fix:续跑处置参数改用 Mapping，兼容 Literal 声明且不丢失只读语义 (ffc85720eb)
- 🔧 Chore/Other:真子进程硬中断用例证明跨进程续跑四分档 (792bf31f41)
- 🚀 Feature/Improvement:沙箱补上暂停、快照、克隆和原地回滚 (8446fbb65b)
- 🔧 Chore/Other:三处让号与合成落本地(main 未推侧) (b7ec515d92)
- 🚀 Feature/Improvement:把超级智能体领域规则接到现有派单。上下文不恢复、关联不路由、策略按登录主体且不撤已发授权，占槽工人交给既有 subagent dispatch。 (80f8c50c9a)
- 🚀 Feature/Improvement:续跑需要确认时返回 409 + 处置清单（两条 resume 出口同形） (6f1836bd6f)
- 🐞 Fix:落地 vip-trader 薄壳转壳与 publishNew 跨端词包,并刷新 README 生成块数字(4705 路由/19606 文件) (dda5f4bc51)
- 🚀 Feature/Improvement:续跑分支按单 tool_call 判定重放/续跑/拦确认 (121af18d60)
- 🐞 Fix:DBG-83 run-cdn.bat node 发现机制替代死盘符硬编码 (186f7ab616)
- 🐞 Fix:DBG-33/34/35/36/37 相对时间与日期随应用语言 + 令牌轮换写入顺序对齐 (03fffbe9ce)
- 🐞 Fix:DBG-25 canAccess FAMILY 分支真隔离判定 + DBG-23/28 判定留档 (7305671657)
- 📚 Docs:消息 parts 数据模型设计稿(1106) (de1baf69d9)
- 🐞 Fix:DBG-61/62/67/68/72 会话存储访问级+侧栏通道+缓存键+弹层定时器+API基址白名单 (4a4fdb12a6)
- 🚀 Feature/Improvement:工具轮写前 checkpoint + attempting/settle 回执（fail-closed） (07e7baaa9d)
- 🐞 Fix:轮次静默死从「不可见」变「可定位」+ A11 承载体轮次完成度维(RP-75 收口) (15bc7ef95f)
- 🚀 Feature/Improvement:登录主体隔离的超级智能体控制面，点名才开工且进度不出声 (c1c7d4cec0)
- 🐞 Fix:DBG-73 数据源指向原生端口 + DBG-74 级联抑制恒不命中 (a345c6bf08)
- 🐞 Fix:DBG-64 dom action 失败补 .catch 避免 background 等满超时 (b4a4484b01)
- 🚀 Feature/Improvement:共享到运营池 全局开放标记模型 (2524351cb8)
- 🐞 Fix:DBG-71 移除未使用的 scripting 权限 (c886971722)
- 🐞 Fix:DBG-98 私有索引提交脚本共享临时文件路径并发碰撞 (48049e6ced)
- 🐞 Fix:收口 DBG-38 P0 RCE 面 + DBG-75 P1 告警盲区 + DBG-80 P1 部署失效 (4a17d64779)
- 📚 Docs:登记缺陷深挖批次 DBG-1..99（2026-11-07 两轮并行代理审查） (19ccd61bdd)
- 🔧 Chore/Other:接管 memory/soul.ts（原工作树未提交，静默 4h34m，来源：工作树；DBG-44 画像落盘改原子写；无独占测试接入，无覆盖变更） (021f349f31)
- 🔧 Chore/Other:接管 runs/manifest.ts（原工作树未提交，静默 4h31m，来源：工作树；DBG-42 manifest.json 改原子写） (e6fdea1dfb)
- 🔧 Chore/Other:补过期 running 自愈夹具(07:48 现场复盘) (5e258b5118)
- 🔧 Chore/Other:接管 doom-loop-detector.ts（原工作树未提交，静默 3h38m，来源：工作树；窗口参数透传 DoomLoopWindowOptions） (512513ffa4)
- 🔧 Chore/Other:接管 commands/repl.ts（原工作树未提交，静默 5h，来源：工作树；BUG-0015 formatContextStats 入参收敛为 role+content） (c7bdb83d57)
- 🐞 Fix:running 状态校验 pid 存活与启动时刻,死 worker 判中止并留死因 (15fa0e297f)
- 🔧 Chore/Other:补 tools/index.ts 契约最小夹具：ToolResult.data 透传（src 已于 ff669e19e5 接管） (cedb5e221e)
- 🔧 Chore/Other:SquareScreen 退役挂账并重算 ui-routes 生成物钉 (403e634257)
- 🔧 Chore/Other:接管 util/spawn-isolated.ts（原工作树未提交，静默 4h31m，来源：工作树；附 plugin-git-url-shape 异步化适配） (46f2250611)
- 🐞 Fix:补齐 knowledgePlanet 五语命名空间并裁定安全中心只读提示漂移 (e3c530e930)
- 🔧 Chore/Other:接管 commands/session.ts + commands/hooks-auto.ts（原工作树未提交，静默 4h44m/3h09m，来源：工作树） (44ffbcbfea)
- 🐞 Fix:微信支付未确认状态被当成功，直接给充值/VIP 额度（DBG-30 P0 资金安全） (42d0f4c3c8)
- 🔧 Chore/Other:接管 tools/index.ts（原工作树未提交，静默 2h55m，来源：工作树） (ff669e19e5)
- 🐞 Fix:git 重建脚本写锁判据语义写反致有锁时仍继续删 .git（DBG-85） (17c39485b3)
- 🐞 Fix:公告缓存与已读集合改原子写，并把 announcements 纳入写盘安全门射程（DBG-41） (de54122619)
- 📚 Docs:64 条缺陷按 HEAD 实况判完 — 已修 60 / 仍开 2 / 未判定 1 / 部分修复 1 (c99f600be8)
- 🐞 Fix:小程序 permission 按已有口径如实登记为缺口，消除端能力门假红（BUG-0028） (d673f0ddc3)
- 🔧 Chore/Other:合入 origin/main(bf41ae63ed) 后按官方脚本重算 302 基线(31 维逐维等价,仅 generatedAt 前移) (935575c841)
- 🔧 Chore/Other:接管 telemetry/index.ts（原工作树未提交，静默 2h42m，来源：工作树） (8f5b4e837c)
- 🐞 Fix:git 命令加可取消异步版并根治并行测试冷启动竞态（BUG-0040/0037） (1f87eb0048)
- 🐞 Fix:67 例确定性失败按四个根因归并修复（BUG-0035） (cf391b0855)
- 🐞 Fix:命令白名单剥 Windows 可执行后缀，运行测试超时竞态根治（BUG-0032/0033/0034） (e9c3c785ed)
- 📚 Docs:按既有生成器同步生成块与散文数字(guardianGates 336→348 / blocking 309→319 / warn 29→31 / trackedFiles 19596→19603) (8397a52284)
- 🔧 Chore/Other:302 基线在新主尖 88107a38db 上按官方脚本重算(11 维旧→新) + 根护栏按 HEAD 面重封 (192b3f8e24)
- 🔧 Chore/Other:0015 接手 provider-request-admission.test.ts（原在飞无提交，来源：工作树） (c40e470228)
- 🔧 Chore/Other:0015 接手 hooks-trust-atomic-write.test.ts（原在飞无提交，来源：工作树） (7d9a1bede9)
- ♻️ Refactor:forkN 拆 forkNAllowed/forkNUnregistered,302 只对未登记栏判;登记理由改读真实 reason>=20 字 + ISO 到期日 (恒等式 59=50+9 / 22=17+5;302 基线未刷;不 push) (840fb0a113)
- 🐞 Fix:member 镜像补 vip.privileges/pay.originalPrice + 登记 radius 13/24 允许差异 + 解除 settings/activity 误配 (worktree 面 fidelityMissing 81->80, tierPending 11->9, pendingWebPair 2->1; 302 基线未刷新; 不 push) (9ff496b2fb)
- 🐞 Fix:302 假绿改声明为 6 把子尺 + 308 缺依赖折 exit 2 + 两页 css 补镜像标记 (46aa45b318)
- 📚 Docs:更正生成器与 CI 注释里的门号引用 (067abe6914)
- 🐞 Fix:接线移动端 app.json 版本派生机制(安装钩子 + Docker COPY + CI 新鲜度断言) (bd5f2fbfc7)
- 🐞 Fix:补移动端 app.json 版本派生生成器并同步派生值 (edf8e18d6d)
- 🔧 Chore/Other:0015 接手 inflight-ledger.test.ts（原在飞无提交，来源：工作树） (1add3ed5dd)
- 🔧 Chore/Other:0015 接手 plan-machine-integration.test.ts（原在飞无提交，来源：工作树） (1c88e2bf4d)
- 📚 Docs:合到 3bf9b4eef0 后按正规链路重算生成块数字 trackedFiles 19594->19596 (88107a38db)
- 🔧 Chore/Other:0015 接手 mermaid-grammar.test.ts（原在飞无提交，来源：工作树） (c00b60be08)
- 🔧 Chore/Other:0015 接手 checkpoints-corrupt-manifest.test.ts（原在飞无提交，来源：工作树） (d6a70cb68c)
- 🔧 Chore/Other:0015 接手 crash-handler-boundary.test.ts（原在飞无提交，来源：工作树） (5e4261412f)
- 📚 Docs:门 350 落号并登记 GATEKEEPERS;补记 README 同步开关与门 44 未判定 (3bf9b4eef0)
- 📚 Docs:标明 tsconfig.tests.batch.json 仅用于单批读数可复现(BUG-0015) (4f185fae52)
- 🔧 Chore/Other:0015 B1 —— 7 文件 B 组 15 条真修,批次配置钉 true(BUG-0015) (06513dcfa3)
- 🔧 Chore/Other:0015 A2 —— 13 个 tests 文件的索引访问在 noUncheckedIndexedAccess 下真修到 0(BUG-0015) (1824bedc7a)
- 🔧 Chore/Other:保留 BUG-0015 单批读数配置 tsconfig.tests.batch.json(仅批次复现,非全仓配置) (ff7eaebb9d)
- 🔧 Chore/Other:重算小程序离线语言包与 CDN 载荷,跟随 mobile-rn 四语输入 (776cbd7f39)
- 🐞 Fix:修 0212 CASE 语法(从零库必挂)+ 补 0370 share_token_expires_at + 收口历史迁移口径 (0cad8fa0cc)
- 🐞 Fix:BUG-NEW-02 新增 skills 同步出海口静态门,并删掉 imgchr 自相矛盾的 disable_warnings (ebf856d8f9)
- 📚 Docs:登记 RP-75 —— 守护单轮巡检跑不完一轮,承载体结构性跑不到周期腿 (12b42078c2)
- 🔧 Chore/Other:0015 A1 —— 15 个 tests 夹具索引访问在 noUncheckedIndexedAccess 下真修到 0(BUG-0015) (9276758f22)
- 🔧 Chore/Other:重算小程序 ui-routes 自述钉,跟随两页镜像声明行 (6dc4abe7c1)
- 🚀 Feature/Improvement:知识星球补齐星球信息轴与分页,在册残余缺口 7→6 (49ee3f48da)
- 🔧 Chore/Other:0042 未知键断言改经 Record 视图取值(BUG-0015 顺手) (d053fc1031)
- 🔧 Chore/Other:摘取 ff2e942864 仍有效的三条 hunk(BUG-0015) (2d0b61ad1b)
- 🐞 Fix:门基线与镜像 tag 变量化、pnpm action pin SHA（BUG-0056/0058/0061） (1ddd4a6bb3)
- 🐞 Fix:文件写盘安全门覆盖面补 sessions/checkpoints/subagents 状态面(BUG-0044) (879c5cf418)
- 🐞 Fix:全局配置层运行时类型校验,非法值回落默认并逐键点名(BUG-0042) (a2b3b7f60b)
- 🔧 Chore/Other:修 BUG-0030 红臂的豁免剥离写法 (75890067f5)
- 🐞 Fix:10 处字符图标换真图标(BUG-0030) (609787c0f2)
- 🔧 Chore/Other:补 521e7853d4 的最近更新块与两页镜像声明行 (19eb10392d)
- 🚀 Feature/Improvement:新增 dispatchDialog.dagRemoveNode / dagRemoveEdge(5 语言) (ea038ceb6c)
- 🐞 Fix:任务库根是数组时不再被收成空清单 (01df01f356)
- 🐞 Fix:invocationId 改确定性键 agent:{session}:{tool_call}:{attempt} (cbe74d6801)
- 🚀 Feature/Improvement:checkpoint 管理器新增工具回执 CAS 写入（耐久后端才算落地） (2e442cb9a2)
- 🐞 Fix:错误/空态补回页头返回入口,修复 GA7 既有红(BUG-NEW-01) (00367fddf9)
- 🐞 Fix:损坏的 CoW 能力缓存不再被收成新结论 (f1a89806bb)
- 🔧 Chore/Other:落账 web↔RN 非色档分叉 4 项受管决策(pending 7→0) (4d7bd7bb83)
- 🚀 Feature/Improvement:新增模型化 Fast Apply 编辑服务(三档锚定 + 写后校验回滚 + 一次纠错) (3e7de76e27)
- 🚀 Feature/Improvement:跨进程续跑纯判据模块（回执优先于历史，不确定即拦确认） (ca6fe5a465)
- 🔧 Chore/Other:结清 RP-74/Y-26/Y-27/S-26 四条(前提已消失/器物已落地) (dbd1df5e44)
- 🐞 Fix:损坏的安装名单和审核名单不再被保存盖掉 (a1b3f01692)
- 🐞 Fix:BUG-0029 7 处原生 title 当 Tooltip 换成真组件——5 个站点改 Tooltip/TruncatedText；配 24 项夹具（绿臂真实文件 0 处、红臂旧写法 7 处必红） (a22549c134)
- 🐞 Fix:损坏的更新缓存、撤销历史、安装清单和任务清单不再被换成新的 (4f019d4c5f)
- 🚀 Feature/Improvement:B72 学生考勤补自签退入口与业务日修正 (48816d450d)
- 📚 Docs:生成块对齐现读尖现算真值(合入 rebase 与上游裸值补转) (d2a7b83b88)
- 🔧 Chore/Other:腿登记表四条 owner/verifiedAt 复确认(承接 ca4b71b97a) (afaef6545d)
- 🐞 Fix:四条腿的节流戳补齐到 main() 单轮面(A8 恒判 4 枚 rotting 的真因) (ca4b71b97a)
- 🐞 Fix:BUG-0038 跨端锁目标跟真实文件——web voice-input 改 components/chat，Taro Avatar 走具名缺席豁免 (a2c709819c)
- 🐞 Fix:损坏名单不再被换成新的,取对侧理由按路径送达 (56629d209c)
- 🐞 Fix:BUG-0022 五端 SSE dispatch 覆盖收口（派生回调登记为非帧 + 基线现算 + 改前必红夹具） (b7264840df)
- ♻️ Refactor:上游新增的档内裸值补转 token(2 文件 6 处) (1316e7f246)
- ♻️ Refactor:A 桶档内裸值改 token 引用(5/5) (c649a1d4ef)
- ♻️ Refactor:A 桶档内裸值改 token 引用(4/5) (d95d337c72)
- ♻️ Refactor:A 桶档内裸值改 token 引用(3/5) (9b9bb88dfc)
- ♻️ Refactor:A 桶档内裸值改 token 引用(2/5) (f2c6a0679c)
- ♻️ Refactor:A 桶档内裸值改 token 引用(1/5) (ba9f30fb4c)
- 🚀 Feature/Improvement:注册门 300 —— e2e skip 制度化 + 固定等待条件化 (03dce41561)
- 🚀 Feature/Improvement:B72 学生考勤补自签退入口 (a3082dc7f8)
- 🔧 Chore/Other:SSE 事件成员数按现读抬到 37 并补 name 成员断言(BUG-0025) (6f7073dac8)
- 🔧 Chore/Other:判据镜像测试 12 例（合规/无理由/无编号/孤儿/过期/TIMING/自证等） (978c4af8d3)
- 🚀 Feature/Improvement:新增守门 CLI（head/worktree/staged 三面 + --self-test 三态自证） (fbc5314849)
- 🚀 Feature/Improvement:新增 e2e skip/固定等待判据纯函数库（skip 理由/编号、TIMING 注解、孤儿与过期登记） (2bf2381318)
- 📚 Docs:新增 SKIP-WAIT-POLICY 制度正文（skip 登记 + 固定等待条件化） (c3cb576f25)
- 🐞 Fix:清理 remote-icons 4 个零消费死键(BUG-0026) (ba9da25b6a)
- 🚀 Feature/Improvement:B72 学生考勤签退文案五语同步 (347f5aeb31)
- 🔧 Chore/Other:ruff 23 条清零(21 条机械修复 + 1 条 F401)(BUG-0036) (8f841fdb7c)
- 🐞 Fix:清理 4 个脚本的本机硬编码安装路径(BUG-0055) (0ca198e5e1)
- 🔧 Chore/Other:违禁桶兜底清扫——HEAD面等条件/待拍板未勾行自动摘除(两道机主禁令的执行器物化,留痕f12-purge;复翻席请同步摘形态,事实内容按各批结清提交保留) (0d28aa5f2a)
- 🐞 Fix:Defender 排除基址改由脚本位置推导(BUG-0054) (9025f48f74)
- 🐞 Fix:recovery source 仓根改由脚本位置推导(BUG-0053) (49ea7c4133)
- 🚀 Feature/Improvement:B72 学生考勤补齐自签退入口与签退时刻列 (32ad38645c)
- 🐞 Fix:摘除 packages/app barrel 的死副本 NavBar 导出(BUG-0014) (3154d9567c)
- 🐞 Fix:service-binary-paths 修复 PAUSED 分档不可达并打印失败用例名(BUG-0049) (b5ee950d59)
- 🐞 Fix:disk-root-write 只读 gitdir 纳入收窄并补阳性对照(BUG-0045) (306728ef7c)
- 🚀 Feature/Improvement:压缩保留锚点 —— 任务锚与 pinned 消息原文跨压缩保留 (12a6530e5a)
- 🐞 Fix:retrieval-quality 现场用例对齐双路融合判据(BUG-0048) (65c6dec9db)
- 🐞 Fix:model-capacity 自检样本对齐 6 档源码(BUG-0047) (3b6103645d)
- 🐞 Fix:prod-checkout 门补 --self-test 并同步契约锁(BUG-0050) (3bfae56f87)
- 🔧 Chore/Other:登记缺陷审计残余五项合并票(BUG-0015/0042/0044/0058/0061) —— 只登记本轮实证仍开着的项 (f3f91d257f)
- 🐞 Fix:承载面心跳改读锁文件 mtime,纠正 at= 当心跳的误判 (1cc3312fed)
- 🐞 Fix:plan-id-pool 自检语料同步池上限 99 并补边界样本(BUG-0046) (7b9e012e64)
- 🔧 Chore/Other:每周审计 typecheck 去掉 echo 兜底转为阻断(BUG-0062) (b1b25bb813)
- 🔧 Chore/Other:构建/发布 workflow 补 timeout-minutes 与 release concurrency(BUG-0060) (588dbdefa4)
- 🐞 Fix:根栈 web 服务补 healthcheck(BUG-0057) (cb5dc7669c)
- 🐞 Fix:移除 SaaS Prometheus 未鉴权的 web.enable-lifecycle(BUG-0019) (1c768da043)
- 🐞 Fix:修复 observability compose 端口行尾多余单引号致整栈无法启动(BUG-0011) (915a152c82)
- 🐞 Fix:预测式编辑总开关接入编辑器链路(V3 #82) (b208c0f33b)
- 🐞 Fix:预测式编辑总开关接入聊天输入区(V3 #82) (f3600c90e7)
- 🐞 Fix:RP-74 第二批 —— 28 条未判定按「有戳位就接、无戳位就具名」收口 (b1d05ba2c7)
- 🔧 Chore/Other:为 overlay 水位重用例显式放宽超时预算(BUG-0024) (3a91faa1a6)
- 🐞 Fix:语音完成回调收敛为 final 单通道避免重复上屏(BUG-0023) (d2bd277c7f)
- 🐞 Fix:语音条播放收敛为单音频上下文并在切条/停播/卸载时销毁(BUG-0013) (5df7f06505)
- 🐞 Fix:site-apk 增判 downloadUrl 指向自有站点腿,行在位不再当端内更新卡可用 (bddf6e5a59)
- 🐞 Fix:渠道登记面改为实读 0364+schema+路由,store 维度已落地不再长期报缺 (c53ddd7dbe)
- 🔧 Chore/Other:补 GitHub App CI 三类事件忽略应答与零 IO 判据 (7fab2d4079)
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
