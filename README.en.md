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

Headline claims (same source as the table below, all live-computed): **618 tables · 4673 API routes ·
25 WebSocket endpoints · 100 catalogued LLMs · 38 platforms auto-publishing · 3998 test files ·
303 engineering gates · 51 CI workflows · 5-language i18n parity · 9 app packages · 16 shared packages ·
14 compose services**.

<!-- BEGIN GENERATED NUMBERS (node scripts/gen-doc-numbers.mjs --markdown) -->
| 指标 | 现值 | 取数键 |
| ---- | ---- | ------ |
| 数据库表 | 618 | `dbTables` |
| schema 文件 | 240 | `dbSchemaFiles` |
| API 路由 | 4673 | `apiRoutes` |
| 路由文件 | 658 | `apiRouteFiles` |
| AI 服务路由 | 628 | `aiServiceRoutes` |
| WebSocket 端点 | 25 | `wsEndpoints` |
| 入库模型清单 | 100 | `llmModels` |
| 发布平台 | 38 | `publishPlatforms` |
| 端应用包 | 9 | `appPackages` |
| 共享包 | 16 | `sharedPackages` |
| CLI 命令文件 | 69 | `cliCommandFiles` |
| CLI 工具文件 | 73 | `cliToolFiles` |
| 语言 | 5 | `i18nLanguages` |
| i18n 作用域 | 7 | `i18nScopes` |
| 语言包 JSON | 35 | `i18nMessageFiles` |
| 测试文件 | 3998 | `testFiles` |
| CI 工作流 | 51 | `ciWorkflows` |
| Compose 服务 | 14 | `composeServices` |
| 工程守门 | 315 | `guardianGates` |
| — blocking | 286 | `guardianBlocking` |
| — warn | 31 | `guardianWarn` |
| 跟踪文件 | 18867 | `trackedFiles` |

上表由 `node scripts/gen-doc-numbers.mjs --markdown` 生成,最后核对日期 2026-11-02。
每个数的来源就写在取数键旁边的实现里(`scripts/gen-doc-numbers.mjs` 的 `SOURCES`),**不得手抄、不得另立第二份**。

<!-- END GENERATED NUMBERS -->
<!-- END GENERATED NUMBERS -->


## Recent updates (auto-maintained)

<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->
**2026-11-02**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (9065d9cba8)
- 🚀 Feature/Improvement:补齐跨端自愈链的最后一节「落库」,写盘件从此有凭据可入库 (4bbb261050)
- 🔧 Chore/Other:合并前置：还原被并发写坏的计划档并重登记确认行 (f958623743)

**2026-11-02**
- 🚀 Feature/Improvement:补齐跨端自愈链的最后一节「落库」,写盘件从此有凭据可入库 (4bbb261050)
- 🔧 Chore/Other:合并前置：还原被并发写坏的计划档并重登记确认行 (f958623743)

**2026-11-02**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (d48ee4d4d3)

**2026-11-02**
- 🚀 Feature/Improvement:四家商店通道由未判定推进到已证可达,两格仍诚实留未判定 (a83a952cfb)
- 📚 Docs:就地改写 Y-70(四家商店通道已证可达,vivo/OPPO 仍未判定) (233eec47d3)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (e2e2250558)
- 🔧 Chore/Other:字号档收口第 6/6 批 —— src/components 402 文件 (45525b8354)
- 🔧 Chore/Other:字号档收口第 5/6 批 —— (main) 业务页 356 文件(乙)+ app/en 与 app/ 其它 (7f01a52f3d)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (0491faf17f)
- 🔧 Chore/Other:字号档收口第 4/6 批 —— (main) 业务页 341 文件(甲) (7e35051ed2)
- 🚀 Feature/Improvement:safe-commit 新增 --files-from 清单入口(大批量路径绕开 Windows argv 上限) (9710581b38)
- 🔧 Chore/Other:字号档收口第 3/6 批 —— (main)/admin 其余 260 文件(乙) (f685e7e41d)
- 🔧 Chore/Other:字号档收口第 2/6 批 —— (main)/admin 其余 262 文件(甲) (381df55136)
- 🔧 Chore/Other:字号档收口第 1/6 批 —— (main)/admin/edu 126 文件 (72df7ca87d)
- 🐞 Fix:B68 oauth-keys /list 不再被压力闸 503,副本失败降级主库 (2c3a0d1b33)
- 🚀 Feature/Improvement:移动端 agentChat 补 stop 停止按钮文案(zh-CN/zh-TW/en/ja/ko 五语,对应 B4 流式停止入口) (2ba6fecdb8)
- 🚀 Feature/Improvement:B4 Agent 会话 SSE 消费侧——共享 streamAgentChat 增量回调+abort,断线带 Last-Event-ID 重连一次,仍败回落 v2 分页读+一次性 POST;RN 宿主增量渲染/done 落库替换/失败显式报错;共享屏仅四枚可选 props(缺省显式关闭);新增 4+3 例测试,双端 typecheck 0,门273 --staged 零新增 (0335facba1)
- 🚀 Feature/Improvement:发布面从四条腿扩成全平台矩阵(华为通道已证可达,缺的是凭据类型) (dceb9c5695)
- 🚀 Feature/Improvement:登记全平台发布矩阵三格未收(华为凭据类型/store 维度/鸿蒙产物) (94e1a44d78)
- 🐞 Fix:演练记录不再生产告警,旧信号不按墙钟窗口复活成票(B69) (6506c8efe1)
- 🚀 Feature/Improvement:B3 Agent 会话 SSE 流式回复端点(Last-Event-ID 重放/15s 心跳/单写者接管) (247f9f5652)

**2026-11-02**
- 🐞 Fix:发布链两处跑不通的出路按实测改掉,站点腿根因与本机承载面分开报 (cb447bab63)

**2026-11-02**
- 🚀 Feature/Improvement:打通 RN 发布链路(五腿唯一出口 + OTA 桶解耦 + Play 读数器物化) (377af4364d)
- 📚 Docs:结清 Y-14(安卓 latest 行实测在位,登记腿已常态化) (a2da71c391)
- 🚀 Feature/Improvement:发布链路登记余两格(站点落点/Play 签名一致性) (1fa03b6655)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (922f84068c)
- 🐞 Fix:补齐 ImagePicker 资产字段/底部安全区,Share 返回常量并锁 Animated 静态样式合并(B3+B4) (13bf8f6c82)
- ♻️ Refactor:500 字摘要截断收敛为单一数值口径 (e972681f74)
- 🐞 Fix:收口被整块重复的登记(F6 块级判据的修复出口) (1eaf77b8b4)
- 🚀 Feature/Improvement:音频端口化 —— 可选 AudioPort,缺省走 capability-off(RN 壳 expo-audio 注入) (3b2c98c6f5)
- 📚 Docs:补 13 条回捞行侧车归属/在等/证据,stock 19→12 (ce6201bcc3)
- 🐞 Fix:M4 nav-A — RN 壳 push 收口到 onNavigate 端口(9 壳 38 处;CourseDetail 讲师入口改指 TeacherDetail) (e8f8967f07)
- 🚀 Feature/Improvement:Agent 会话分页读 version=2,seq 游标与 v1 兼容(B2) (0da2a6a9a7)
- 🐞 Fix:$rp 参数通道补页面 unload 释放,并钉住容量/释放单测 (bb92d216f2)
- 🐞 Fix:Agent 会话写路径改原子追加,修复 20 条窗口截断(B1) (7f39323460)
- 🐞 Fix:announcements 补 platforms 列声明 —— 迁移 20261024160000 为真源 (3ca684ddc8)
- 🐞 Fix:wallet 测试 i18n 替身稳定化 —— 根治 4GB 堆 OOM(真泄漏) (880b86817f)
- 📚 Docs:标注 B53/B91 与同形态告警的签名差异,消除副本读数(+2→0) (03584c62b6)
- 🐞 Fix:三组既有红灯按新契约回正 —— 遥测 store 形状/usePathname/引导时序 (8ae8bf4537)
- 📚 Docs:补 15 条待办归属/在等字段(证据不足标 unassigned 并注明原因),对齐 5 条行内标头与侧车 (e252177924)
- 🐞 Fix:收编器改路径白名单——业务代码/测试与规则文件不再自动入库 (f6e0ba44a9)
- 🔧 Chore/Other:清偿旧版快照区数字 —— scrub --scope=all 用生成器同源现算值清 README 全量存量 54315 处(README.md/README.en.md 共 29820 行改写、5 行挂历史叙述豁免、manual 0)；同笔给 scrub 增显式维护档 archive|all(缺省行级棘轮不动,自检 21/21) (15f9293a7d)
- 🔧 Chore/Other:补登 6 枚远端带入文件的溯源水印(门47 HEAD面欠账清偿) (c3c03c7da3)

**2026-11-02**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (624f3fded6)

**2026-11-02**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (9f63e266d2)
- 📚 Docs:全工作树口径条款压缩至体积预算内(语义不变;有意替换本席 a7082004 所加长句,无他人行被吃)并重封根护栏 (4ec42583d6)
- 🔧 Chore/Other:按生成器刷新四端最近更新并推进基线(.doc-autoupdate/last-sha) (4e3caa439c)
- 🔧 Chore/Other:收敛后按 HEAD 面重生成 3 件 i18n 派生产物 (cf4929783c)
- 🚀 Feature/Improvement:全工作树未提交状态唯一口径(check-worktree-status + 门 281) (a708200410)
- 🔧 Chore/Other:收敛后重生成 web ui-routes 派生件——合并树新增路由共 911 条,sourceCommit 钉到 17398feed4,与输入 sha256 c03c0415 对齐 (c62d667f09)
- 🔧 Chore/Other:收敛后重生成 miniapp 离线包 b64 派生件——与已提交的 3 份 .gen.ts 同批产出(输入 sha256 789e9bbe、sourceCommit 4cf59c6ef8),补齐收敛引入的词包更新 (031c4d0933)
- 🔧 Chore/Other:收敛后按合并树重生成 ui-routes 派生件——union-converge 落地 e174123809 后按合并树重算,sourceCommit 钉到该合并,输入 sha256 不变(两侧改动路径除本生成物外无重叠) (4cf59c6ef8)
- 🚀 Feature/Improvement:M4 B1 契约冻结——8 个共享 types 补必填 onNavigate/onToast,29 个共享屏加 assertRequiredPort,30 个 RN 壳经 useHostPorts 接线并挂全局轻提示层,小程序 about-shared 宿主补端口并同步重生成 ui-routes,新增端口接线契约测试(2 例);接手他人未提交工作、来源会话不明(76 条遗留已在前序 5 笔按域提交 b3d2f24247/90b700fb81/99c09c4938/cb39924428/3fe2499620),本笔为随后 M4 B1 自研施工;门禁:根 typecheck 绿(TS+mypy)、两端 typecheck 绿、miniapp test 99 文件/1239 例绿、mobile-rn test 152/153 文件 1385/1397(存量 tests/wallet.test.tsx worker OOM 12 例未跑,文件未改、与 B1 无 import 关系)、parity gap 0/residual 1、门128 判红 0、planner 30/21/15 未变 (408efad761)
- 🐞 Fix:get_session_extra_roots 空会话早退后显式收窄 session_id——消 mcp_server.py:715 存量 mypy 错(str | None 传给 str),根 pnpm typecheck 由红转绿;行为不变 (620f408c83)

**2026-11-02**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (a3bf177b50)

**2026-11-02**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (7f9c0f84ca)

**2026-11-02**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (ff3f0c5c5c)

**2026-11-02**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (fb8410f958)

**2026-11-02**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (dd0248cbd2)
- 🔧 Chore/Other:清算主工作树滞后副本并补齐派生产物 (04d0c2c7cb)
- 📚 Docs:deploy-feedback 自动登记(deploy_outcome;端到端反馈闭环第二切片,O65 自进化系列) (05e0909aff)
- 🔧 Chore/Other:重封 AGENTS.md 铁律段哈希，消除合流后 advisory 告警 (86bde84fa7)
- 🔧 Chore/Other:补 .gitignore 兜住本地优选 IP 凭据，避免令牌误入库 (213b7c038c)
- 🔧 Chore/Other:重生成 ui-routes 生成物（911 条），对齐设置页新卡片 (d388266f28)
- 🔧 Chore/Other:按新 HEAD 源重生成离线语言包（键 544→592，钉 2fb7af837e） (2f98eb1e6b)

**2026-11-02**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (c5a90766cf)

**2026-11-01**
- 🐞 Fix:probe 改派 headless 可执行的只读自检,解危险拒签死循环 (1e42fc5e81)
- 🐞 Fix:自治环改用 tsx 加载 CLI 源码,解除 dist 未 bundle 导致的会话派发死锁 (4aa78225b0)
- 🔧 Chore/Other:派单面管理员闸 + LIKE转义 + publish同源SSRF闸 (c85a866895)
- 🐞 Fix:盘根白名单补 MiniMaxCode(D: 盘已安装应用,消除误报外流) (65b643bb9c)
- 🚀 Feature/Improvement:会话全文落盘腿与CLI空转/无头审批人根因修复 (09a3f02274)
- 🔧 Chore/Other:subagent 全局配置变更面强制管理员闸 (c8c4213622)
- 🔧 Chore/Other:收口越权/SSRF/注入/凭据泄露 5 类高危面 (ff4d42705a)
- 🐞 Fix:qoder 保活腿——单轮瞬时失败静音,连续失败才报警 (a72ca967d3)
- 📚 Docs:标注暴露凭据轮换未判定保留 warning 的安全域意图 (74bb1a4c02)
- 🐞 Fix:噪声治理——info 档只登记不寄信 + 自愈全成功静音 (28b2cee5df)
- 🐞 Fix:CLI 登录态写入不再因 ENOENT 打断整轮派发 —— 服务身份下 USERPROFILE 没有机主的登录态 (2c346fb800)
- 🐞 Fix:票面被截断时风险因子不许读 0 —— 那是"把高风险票排到前面"的失效方向 (65cc7e48a0)
- 🚀 Feature/Improvement:打通自开发最后三格 —— 会话干完能落账、排期真按模型走、经验真能沉淀 (bf1a42f113)
- 🐞 Fix:上下文/记忆面 8 个端点的身份从"自报"改成"注入" (9103baba9b)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (1b6443c3ab)
- 🐞 Fix:收窄 mobile-rn 两处依赖数组消除 exhaustive-deps 红、favorites 镜像件与生成器补 resourceType/resourceId 契约注解、CI pytest 覆盖 basetemp 根因 (c97d501323)
- 🐞 Fix:补上五处"闸装错了层/装错了方向"的凭据与主体防线 (f4d5103361)
- 🐞 Fix:派发契约尺子学会说取不到输入,隧道不在位不再被念成接线消失 (03a4fdd580)
- 🐞 Fix:5类报警根因修复 + 报警前自愈路由层 (1827fde982)
- 🐞 Fix:两维尺子不再因历史存量恒红 —— 结算腿改结清全部悬案,A3 只在封禁过半时叫人 (c08df4d714)
- 🐞 Fix:裸字面量 TTL 归口常量、两枚策略常量搬到可扫描取用点、probe-dev-extra 进 CI 自述点名表 (9fb6fee7a8)
- 🐞 Fix:冲突标记门体接旁路落地自证臂并扣减空冲突区补回量 (c3fc430bc5)
- 🚀 Feature/Improvement:两类写了没装车的展示契约与错误码契约装上真取用点 (98f7f3be13)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (837e41f4fb)
- 🚀 Feature/Improvement:给自开发装上"派发结算"这一问 —— 会话 exit 0 从此不等于票推进了 (31ec3e231f)
- 🔧 Chore/Other:本席认领「灰度观察窗排在换流之后」并挂租约(防双开;SPLIT 席已停笔,该格由 OBSWIN 席接手) (6341165f67)
- 🐞 Fix:供应商健康摘要的 30s SWR 策略从装饰常量收成单一旋钮 (71b2265af0)
- 🐞 Fix:摘掉被 union 归并留成两份的 workbook 路由注册,并把零 JSX 的 React 模块从 .tsx 改回 .ts (8eebef0d1f)
- 🚀 Feature/Improvement:灰度期实切车道计数持久化 + 熔断记账按轮次结果分桶(收编 SPLIT 席产出) (2829bd6e34)
- 🚀 Feature/Improvement:端侧存储 transport 取用归口到各端工厂,并收掉 shared 里未接线的 JSON 装饰层 (199c84c412)
- 🚀 Feature/Improvement:五枚"写了保留策略却从未执行"的清理函数装上真实触发点 (69a64068bd)
- 📚 Docs:执行体积清偿第六批——4 行逐字移入归档件,原位置只留一句指针注记 (d3baf99018)
- 📚 Docs:落 AGENTS.md 体积清偿第六批的逐字迁出件(先落归档,再摘正文,防 merge-live-doc 把搬走的行判成 lost 补回) (5a6c653770)
- 📚 Docs:再摘一次合流捞回的冲突标记行,并把回捞这一型登记成在册票 (24ff0bc188)
- 📚 Docs:登记「冲突标记经旁路落地+行级 union 反复回捞」这一格(本席已认领,含两轮实测 sha 与出路) (9795d38e68)
- 📚 Docs:补上编辑意图预测(Predictive Edit)能力清单——服务端三态/前端三把钥匙/scene 分账/真模型取证首跑(§21 交付门槛:新增端能力须同枚更新 README) (639c0bb9d2)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (177ac30e3c)
- 🐞 Fix:合流选边遗留的接线红就地收正——W10 补回采样面折算维,部署环 decide 同时带两把钥匙 (ef4c07a465)
- 🐞 Fix:产物 token 的签名密钥去掉公开常量兜底,并把"生产必填"那句话真接成启动闸;SaaS 模板弱默认口令封口 (da6f241813)
- 📚 Docs:deploy-feedback 自动登记(deploy_outcome;端到端反馈闭环第二切片,O65 自进化系列) (7a809936fe)
- 🐞 Fix:收正合流选边遗留两格——灰度产物来源换回对侧定案形态 + web 族源收成共享层壳 (77cb1dc7f1)
- 🐞 Fix:/api/context 进"永不公开"地板 —— 那张 router 七格全无端点级身份,靠陈旧 .env 就能匿名重开 (e119289438)
- 🐞 Fix:clawdbot 整面闸升到带 requireActiveUser 的档位;并更正我自己写进提交史的一句 folklore (8c7054044b)
- 🐞 Fix:摘除合并落进 AGENTS.md 的三行未解决冲突标记 (08b12deaa4)
- 🐞 Fix:MCP 项目/集成面收归令牌主体,并堵掉"裸 id 可删任意 system_configs 行"的跨面删除 (3d31adbdac)
- 🐞 Fix:票59 消息级版本切换补上小程序消费腿 + 灰度补 P95 延迟劣化真策略用例 (a92c063cac)
- 🐞 Fix:摘掉打死守护的三处悬空引用,补齐 pure 层缺失的同类节流判据 (f73fb2793d)
- 🐞 Fix:工作簿读写面补装车 —— 五条端点此前线上全 404,而仓里那把"必须注册"的尺一直红着 (75de94caae)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (f4e8324d22)
- 🚀 Feature/Improvement:barrel 销账下到符号级,标题臂不再写死形态名——清掉两条假账 (bc64e57842)
- 🔧 Chore/Other:壳声明件跟随自动升级的 4 枚页(按 HEAD 面派生) (b2b9dfd385)
- 🔧 Chore/Other:自动把 4 枚手写镜像页升级为壳承载 (a69349f15b)
- 🚀 Feature/Improvement:列表分页与输入框聚焦两族按「闭环在不在屏上」销账——再解放 2 页 (c395144e6c)
- 🚀 Feature/Improvement:判据认「barrel 里只装了导航条」这一型重复接线——两页当场变 convertible (830fb1b708)
- 🐞 Fix:合并后重生成 miniapp 两族派生产物(门 105 的 G5 钉随输入集更新) (0373e9aa2b)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (afc5595c90)
- 🐞 Fix:正文作用域补上承载壳——判据认「提示住在壳里」这一格 (5b3db1a65e)
- 🔧 Chore/Other:收编停留≥3分钟的 i18n 未提交改动 (bd98a24260)
- 🔧 Chore/Other:修三处 api 存量红 —— 豁免清单腐烂 / 出站口换 undici / 返回面加了 localEmbedded (39b1ee5ca2)
- 🐞 Fix:parentMessageId 口径加宽到 string | null + 小程序腿三处类型错 + knip 兼容层出口盲区登记豁免 (1f1e6e99fb)
- 🐞 Fix:回补 cli 包 14 枚动态派生词条 + 登记契约键 (bac640521e)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (fbad083b81)
- 🐞 Fix:清掉 api 包的四类存量 lint 红 + captcha 清理按自身头注分批 (3ebae14ded)
- 🚀 Feature/Improvement:ws-chat 把断线补发/幂等去重/跨实例限流三枚工具模块装进生产生命周期 (fadde1bce7)
- ♻️ Refactor:useFontMultiplier 改名 readFontMultiplier —— 它是纯读函数,不是 React Hook (e75621c841)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (7362129f72)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (eb60e13737)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (9930484394)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (da729e3f6f)
- 🐞 Fix:chat-sync 帧收件人只取承载层认证身份,堵死客户端自报 userId 的跨用户投递 (58fb182dec)
- 🔧 Chore/Other:给 hub 早退分支的工具入参校验补行为锁 (bbbf3f7443)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (fbb4ec7ea9)
- 🐞 Fix:套件红项分诊末簇收口——①百分比裁剪 5 处内联手搓收敛到具名唯一出口 clampPercent(@ihui/shared/utils/clamp-percent,api/miniapp/mobile-rn/packages-app×2,语义逐字等价:toNumber 保证有限值/round 先后序等价/NaN 归 0 为出口既定语义),edu-grade-trend 本地同名实现摘除;②三枚镜像测试对齐现形(ui-react T5 仓外样本改真仓兄弟路径构造——toRel 纯路径数学无需夹具/mkScratch 已入仓内批准根;tool-arg-wired 守恒式补 forwarded 转发豁免桶——头注恒等式 covered+forwarded+uncovered===total;transcript TA-12 数据条件化——audit.jsonl schema 演化后 path-ish 族为 0 条,判存在性用门体单源 extractTarget) (f25456c0fd)
- 🐞 Fix:合并后重新施加本侧独有的两格运行时缺口 —— Modal 遮罩点关 + Image onLoad 转发 (5f38f5d8dd)
- 🐞 Fix:卫生门真债+旧尺各一——①dev-stack-launch-fallback.test.mjs:77 中文绝对路径字面量改 \u 转义构造(运行时语义不变,销 GBK 乱码违规;HEAD 面欠账只有带进 HEAD 的提交能销);②check-workspace-hygiene 落点判据对齐 G-158 现形(改用唯一判据 isAllowedScratchRoot,批准根已入仓内 .DevEnv——判据没跟上设计红在尺子,check-service-binary-paths F3 同型) (007f24437c)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (225523491f)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (312ff9ad19)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (0d8853a870)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (9ab4908d49)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (97a63e10e8)
- 🐞 Fix:套件红项分诊第一簇续收 4 格——测试形状正则对齐现形(commit-payload 发令帮手改名 commitArgv/d159 合并命名出口/deploy-diverged 补救功能已整票回退故豁免面关闭零破坏性动词/arg-guard getOpt 三参) (3e76692c31)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (3722d122d7)
- 🔧 Chore/Other:收编停留≥3分钟的 i18n 未提交改动 (eb97698dbc)
- 📚 Docs:T12 §5b 状态更新——#8/#6 身份半格已落地,#5 大半落地,#3 缓议有因 (4b188b3468)
- 🚀 Feature/Improvement:钩子派发宿主身份核验(deny-by-default)—— T12 缺口表 #6 半格收口 (713eaf1513)
- 🚀 Feature/Improvement:索引快照压缩落盘(gzip 魔数自识别)—— T12 缺口表 #8 落地 (3b3e9542a4)
- 🔧 Chore/Other:parity-auto-stage-crash.test.mjs 溯源水印欠账带进 HEAD(门47 HEAD面欠账清偿) (aaabb813bf)
- 🔧 Chore/Other:回正 check-pkg-installable 镜像夹具的包名(包更名后夹具腐烂) (7fba73b50f)
- 🐞 Fix:灰度产物来源定案,放量判定拆成在位三态并不再把未判定折成通过 (5d2380fe2f)
- ♻️ Refactor:危险操作确认旁路的消费侧收拢到唯一出口并锁零就地判定 (88763ecb62)
- 🐞 Fix:号池入库契约把 phone 提为显式键并锁四档命名优先级(O66) (369f74ab01)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (5cc57906d3)
- 🐞 Fix:小程序宿主 typecheck 61→0 —— 去掉索引签名,RN 事件/props 类型面归口 primitives (ff2abfcdbf)
- 🔧 Chore/Other:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (dc9a528104)
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (cffca2c7c7)
- 🐞 Fix:F6 判据改行级预算口径,根治「union 重组涌现块」半格死锁 (1addf6f4ab)
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
