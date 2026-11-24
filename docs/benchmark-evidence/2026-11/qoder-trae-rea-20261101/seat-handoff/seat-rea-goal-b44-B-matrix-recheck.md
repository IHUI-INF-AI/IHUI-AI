<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# B 矩阵复量(rea-goal-b44 只读核查席)

- 取证面:**HEAD 面**(`git grep -n <pat> HEAD -- …` / `git show HEAD:<file>`),HEAD = `eb1dad8a823ef859ace5f684abc424383c6e5e50`(成文时现读)。
- 口径:三态 = 已结清 / 真缺口 / 未判定;「字段存在但零调用方」不记结清。
- 对照册:`docs/benchmark-evidence/2026-10/trae-rea-20261031/T3-gap-matrix.md`。其 §1 表格多条已被册子自身 §6–§11 及后续批次推翻,本文件按**当前代码**重判。

## 汇总表(11 行)

| # | 三态结论 | 一句话 |
|---|---|---|
| G-07 | **已结清** | send_team_message / read_team_inbox / send_to_session 已双射注册进 mcp_server,agent_comm 有生产消费方,3 份测试在册;跨进程 Redis 腿刻意留空(册 §8 定界) |
| G-08 | **已结清** | enter_worktree/exit_worktree 两枚工具经 WORKTREE_TOOLS 注册(agent.ts:435),worktreeCreate/worktreeRemove 钩子在枚举且有真实派发点,行为锁测试两枚 |
| G-10 | **已结清** | micro_compact(+tools_kept/removed 计数)接进 agent_loop_v2 真循环;percent_left+四阈值五判据在 context_compaction 出口;压缩专用模型/回退标签在产;partial 命名零命中但 LLM 摘要腿即其等价 |
| G-11 | **已结清**(残留子腿见分节) | advisor_consult(带 max_uses 预算)、investigate_codebase、output_schema 三腿全部双射注册且有测试;仅请求级 ChatPatch 仍不存在(无消费方,册 §10 已裁不造) |
| G-14 | **已结清** | sweepLessonDraft 已入 git-guardian 巡检轮(main 健康轮 + daemon tick),镜像测试 lesson-draft-dispatch.test.mjs 在册;写回留人工带 immutable-exempt(与票面边界一致) |
| G-17 | **已结清**(替代形态) | inject_session_env 原有两处真实调用(command_streamer.py:288、mcp_server.py:2636);不落 .sh 盘,以 env 注入(IHUI_SESSION_ID + IHUI_VERSION)替代,与 §15 卫生一致 |
| G-18 | **已结清**(册判 C 已腐烂) | apps/cli/src/runs/manifest.ts 逐进程清单(argv/ppid/envFlags/cliVersion/nodeVersion/projectId)+ latest 指针,启动腿 index.ts:1363 实调,run-manifest.test.ts 钉行为 |
| G-20 | **真缺口 → 形态不适用,不建议立票** | 无远程可执行下载注册表;原生腿由 npm 平台包(argon2/@parcel/watcher optionalDependencies)+ Tauri 随包构建承担等价;本仓无"运行期取原生 exe"需求面 |
| G-21 | **真缺口**(半腿) | 安装产物逐文件 sha256 清单+对账门确无(maxExpandedBytes/maxEntries 在 plugins 面 0 命中);但插件取源是 git clone+commit-SHA pin,无解包面 ⇒ zip-bomb 那半不适用,真缺的是已装面完整性对账 |
| G-22 | **已结清**(册称 B 前提已消) | defaults.ts 已显式登记 plugins/pluginMarketplace 默认 false(带 G-22 注记)且 layer-policy 同批;registry.json 台账+installedAtRankOf 多版本当代选取在产;autoUpdate 仍 0 命中(册自列次要腿) |
| G-26 | **真缺口 → 形态不适用,不建议立票** | targetVersion/.qoder-versions/state.ini 全部命中只在本仓"采集/清理对方产品"一侧,非自身安装形态;自更新腿(auto_refresh.rs 每小时 + cli updater minimumVersion 闸 + web 强更闸)在产,多版本共存与原子切换无载体且撞唯一产物判据 |

计数:**已结清 8 / 真缺口 3(其中 2 条判形态不适用)/ 未判定 0**。

---

## 逐条明细

### G-07 多席/团队 + 跨会话通信 —— **已结清**
- 命令:`git grep -nE "send_team_message|read_team_inbox" HEAD -- apps/ai-service` → `_TOOLS` 声明 12317/12336、`_TOOL_HANDLERS` 12946/12947、handler 定义 9753/9779;`git grep -nE 'name="send_to_session"' HEAD` → mcp_server.py:12353(按会话 id 寻址,与按代理名寻址互补,9806 头注)。
- 消费方:`git grep "agent_comm" HEAD -- apps/ai-service/app | grep -v tests` → mcp_server.py:28,9755,9781,9811,10087(advisor 复用 `_identity_or_error`)、agent_orchestrator.py:1035,1234(`BlackboardEntry/agent_message_bus`)、agent_loop_v2.py:2356(team_blackboard)。
- 测试:HEAD 面 `apps/ai-service/tests/{test_agent_comm,test_team_messaging,test_send_to_session,test_agent_loop_team_relay}.py` 均在册。
- 边界如实:`_get_redis`(agent_comm.py:225)跨进程持久腿仍零调用 = 册 §8 主席定界的**刻意留空**(矩阵口径是跨"逻辑会话",单进程 asyncio 承载多会话即达成),非孤儿判据翻转。
- 是否本仓应有:**是**(ai-service 多代理编排是产品/内核能力)。

### G-08 worktree 一等工具 + 创建/回收钩子 —— **已结清**
- 工具面:`git grep -niE "enter_worktree|exit_worktree" HEAD -- apps/cli` → `tools/worktree.ts:489,596`(name/permissionKey 齐)、`tools/index.ts:2134-2135` 导出、`commands/agent.ts:50,435 registerTools(WORKTREE_TOOLS)`、`worktree.ts:758` 工具族定义。
- 钩子面:`git grep -niE "worktreeCreate|worktreeRemove" HEAD -- apps/cli/src/hooks` → HooksConfig 字段 162/164 + `HOOK_EVENT_KEYS` 枚举 633(含对齐 Qoder/Trae WorktreeCreate/WorktreeRemove 的注释),且 189-194 有 HooksConfig⇄HookEvent 编译期双向锁;真实派发点 `tools/worktree.ts:561,731 fireWorktreeHook(...)`。
- 测试:`apps/cli/tests/worktree-session-tools.test.ts`(行为锁)+ `worktree-session-tools-registration.test.ts`(挂名锁)。
- 与在册治理关系:本仓 §12h 的收尾五步/注册表 prune 判据在 `scripts/agent-worktree.mjs` + git-guardian 回收轮,工具面复用同一实现(agent.ts:433 注释自述"与子代理隔离腿同一套创建/回收实现")——不是只差一半,是已等于并把治理带进工具。
- 是否本仓应有:**是**(多会话并行是本仓一等约束)。

### G-10 压缩流水线 + 阈值阶梯 + 专用模型 —— **已结清**
- micro 腿:`git grep -nE "tools_kept|tools_removed" HEAD` → `context_compaction.py:896-897`(计数产出)、`agent_loop_v2.py:2967-2968`(消费)、`compaction_metrics.py:177-182`(指标维度)。
- 循环接线:`git show HEAD:apps/ai-service/app/services/agent_loop_v2.py` 3008 行 `messages = self._maybe_micro_compact(messages)` 在真压缩路径上(非孤儿);测试 `test_agent_loop_micro_compaction.py` + `test_context_pressure_micro_compaction.py`。
- 阈值阶梯:`assess_context_pressure`(context_compaction.py:487)五字段 percent_left/is_above_warning(<40)/is_above_error(<20)/is_above_auto_compact(>trigger_ratio 0.88)/blocking,658-811 随 compress 出口 info 同批下发。如实:五布尔字段在 services/routers 侧暂无独立再读取者,其消费形态 = 压缩 info 的组成部分(474 头注:「只把当前上下文处于哪一档如实报给调用方/UI/指标」)。
- 专用模型:`agent_engine.py:3723,3980 _compaction_model_mismatch` + `compact_with_llm.py:479 compact_model_fallback_tags`(对标 codex compact_model_fallback.rs)。
- "partial" 字面:`git grep -niE "partial.?compact" HEAD -- apps packages scripts` → 0 命中(册该判据仍成立),但 LLM 摘要压缩腿(compress_messages_if_needed/compact_with_llm,保留尾段摘要旧段)即对方 partial 的行为等价 ⇒ 命名缺、行为在。
- 是否本仓应有:**是**(内核能力)。

### G-11 Advisor / ChatPatch / StructuredOutput / CodebaseInvestigator —— **已结清**(册判 C 已腐烂;残一条注册性子腿)
- Advisor:`git grep -nE "advisor_consult" HEAD -- apps/ai-service/app/services/mcp_server.py` → `_TOOLS:12398` + `_TOOL_HANDLERS:12952` 双射;`advisor.py:32-33,68-72,122` max_uses 预算 `[1,10]` 默认 3;测试 `apps/ai-service/tests/test_advisor_tool.py`。超越轴按册 §10(模型名 fail-closed `_skip_fallback`)。
- CodebaseInvestigator:`investigate_codebase` 双射注册(mcp_server 12296/12945,handler 9745 引 `codebase_investigator.py`)。
- StructuredOutput:`agent_engine.py:713-714 output_schema` 字段 + 958 `_parse_output_schema` + 981 `_validate_output_schema_payload` + 2559 请求入口解析,在产。
- 残子腿(如实登记):请求级 ChatPatch(对 messages/tools 的增量补丁协议)**不存在**——`git grep -nE "ChatPatch|chat_patch" HEAD` 的命中全部是 `packages/types/src/chat-sync-contract.ts` 的 UI 同步契约(kind='delta'|'snapshot'),语义不同。册 §10 已裁「本仓按请求重建 messages,无增量补丁消费方,不凭空造协议」⇒ 该子腿**不属本仓该有的能力**,不据此翻判。
- 是否本仓应有:**是**(advisor/调查/结构化出口三腿均产品/内核能力,已落地)。

### G-14 记忆/教训自动写回 —— **已结清**(在票面边界内)
- 派发器:`git grep -nE "sweepLessonDraft|lesson-draft" HEAD -- scripts` → `git-guardian.mjs:5354 export function sweepLessonDraft`(5 分钟节流形态,5361 tickFile),接线两处:main 健康轮 `if (!CHECK_ONLY) sweepLessonDraft()`(10331 注释块)与 daemon tick(11708 注释块点名"镜像测试 lesson-draft-dispatch 按名 import,不复制判据")。
- 镜像测试:`scripts/tests/lesson-draft-dispatch.test.mjs` 在 HEAD 面存在。
- 写回边界(特别留意 1 已核):sweepLessonDraft 只落候选稿到 `.ihui-agent/tmp/lesson-draft/`(5332,5341 注释「写回 AGENTS.md / memory 仍留人工」)——与本仓不可变护栏 + 门 207 体积预算的裁决一致,**写回那一半本来就不该做**,不构成缺口。
- 是否本仓应有:**是**(自进化腿;合法格=产候选稿自动、写回人工,现状正是该形态)。

### G-17 子进程会话身份注入(对标 session-env 落盘面) —— **已结清**(env 注入替代落盘)
- 注入实调:`git grep -n "inject_session_env" HEAD -- apps/ai-service/app` → 除定义 `exec_env.py:358` 外,真实调用两处:`services/command_streamer.py:279,288`(带 `current_session_env_id()` contextvar 兜底 + 依赖缺失降级不注入)与 `services/mcp_server.py:2634-2636`(exec 派生点注入 `harness_version()`)。册 §5 复验轮"恰好 1 命中=定义行"的前提**已腐烂**。
- 落盘面:`git grep -nE "session-env|sessionstart-hook" HEAD -- apps scripts` → 仅 `apps/desktop/src-tauri/src/qoder_reset.rs:15,41`(清理**对方产品**目录清单),本仓无每会话 .sh 落盘——这正是票面建议的「不抄」(与 §15 工作区卫生冲突);注入走 `IHUI_SESSION_ID`+`IHUI_VERSION` 环境变量(exec_env.py:39,360-364)。
- 是否本仓应有:**是**(子进程归属可观测);字面 .sh 形态不适用,由 env 腿结清。

### G-18 运行清单 run manifest —— **已结清**(册判 C「0 命中」已腐烂)
- 载体:`apps/cli/src/runs/manifest.ts`(头注自述对标 `logs/runs/<run_id>/manifest.json`),字段现读 `argv/ppid/envFlags{ci,debug,noColor,json,headless}/cliVersion/nodeVersion/projectId/projectRoot/cwd` + `runId`;落点 `.ihui-agent/state/runs/` + **latest 指针 JSON**(刻意避软链/junction,§26 红线);写失败静默降级不挡主流程。
- 消费:`git grep -n "writeRunManifest" HEAD -- apps/cli/src/index.ts` → :38 import、:1363 启动调用。
- 测试:`apps/cli/tests/run-manifest.test.ts`(buildRunManifest/findProjectRoot/projectIdOf/runsRootFor/writeRunManifest 全 import)。
- 是否本仓应有:**是**(跨壳/CI/用户机排障对账)。

### G-20 平台分桶远程可执行下载表 —— **真缺口,但形态不适用(不建议立票)**
- 负发现(命令跑完,非截断):`git grep -nE "external-commands|externalCommands" HEAD -- apps packages scripts` → 0 命中;`git grep -nE "darwin-arm64|win32-x64|linux-x64" HEAD` 全量 7 命中,逐条核过:password-crypto.ts:30,35(argon2 预编译踩坑**注释**)、check-lock-manifest-consistency.mjs:20,24(锁面注释)、desktop-nsis-template.mjs:483、recycle-bin-policy.mjs:100-101(对方产品路径)——无一为下载注册表;`git grep -nE "archiveSha256|sha256.*(download|binary)|..." HEAD -- apps/cli/src scripts` → 0 命中。
- 等价面:本仓原生依赖走 **npm optionalDependencies 平台包** + Tauri 随包构建(`scripts/desktop-build.mjs`/`lib/msvc-env.mjs`),无"运行期按 arch 取 exe"的需求面;skills `prerequisites` 只做声明检查。
- 最小落点:**无**(建议维持册 §4/§11 口径:登记"知道有,不抄",事实进 commit message,不占台账)。
- 是否本仓应有:**否**(对方桌面 IDE 分发形态;本仓 SaaS+8 端不适用)。

### G-21 插件 manifest 逐文件 sha256 + 解包上限 —— **真缺口(半腿);zip-bomb 半腿不适用**
- 负发现(收窄射程,跑完不截断):`git grep -nE "maxExpandedBytes|max_expanded_bytes|maxEntries|zip.?bomb" HEAD -- apps/cli/src/plugins apps/ai-service/app/services` → 仅 `importers/wechat.py:61,124`(导入器一侧,与插件安装无关);`git grep -n "sha256" HEAD -- apps/cli/src/plugins` → 仅 url-shape.ts:93(git commit SHA 合法性注释);`createHash` 仅 cache.ts:77 **sha1 URL 缓存键**。⇒ 逐文件完整性清单与解包上限在插件面确认为 0。
- 关键新事实:插件取源是 **git clone + ref/sha pin**(`cache.ts:237` 执行 git clone;`installer.ts` 事务号/CAS 回滚在案)⇒ 不存在 zip/tar 解包面,`maxExpandedBytes/maxEntries` 属**形态不适用**;commit-SHA pin 本身即比逐文件清单更强的完整性机制。
- 真缺的半腿:已装产物(插件目录/.ihui skills)落位后的**逐文件 sha256 台账 + 对账守门**(防盘上被旁路改写;现读 registry.json 只存安装记录不存文件摘要)。
- 最小落点:`apps/cli/src/plugins/installer.ts` 落位完成处为 `registry.json` record 增 `files:[{rel,sha256}]`,配 `scripts/check-lock-manifest-consistency.mjs` 骨架的对账门(§0.6 单源,勿新写第二份判据)。
- 是否本仓应有:**半是**(供应链完整性对真实安装路径有意义;解包上限不适用)。

### G-22 插件台账 + 市场默认态 + autoUpdate —— **已结清**(册称 B 的前提已消)
- 册 B 判据(「默认态未写进 defaults.ts」)已腐烂:`git show HEAD:apps/cli/src/config/defaults.ts` 46-52 行现读,带「G-22:插件两档显式登记默认态」注记的 `pluginMarketplace:{enabled:false}` + `plugins:{enabled:false}` 已入;`config/layer-policy.ts:81-82,131-132` 同批白名单在案。
- 台账/市场/多版本腿在产:`plugins/paths.ts:59-61` registry.json 权威路径、`installer.ts:13,83,667`(去重短路、事务号、CAS 回滚)、`cache.ts:691,727 installedAtRankOf`(同 name 多行取当代)。
- 残余如实:`git grep -nE "autoUpdate|autoupdate" HEAD -- apps/cli/src/plugins apps/cli/src/commands/plugin-marketplace.ts` → 0 命中(auto 更新轮未装)。按册 §10 建议第 10 名自己的排序,「默认态显式化」才是先做的,autoUpdate 是次级增强(出路=挂 guardian tick,不自开 daemon)⇒ 不据此把本条判回 B,登记为残腿即可。
- 是否本仓应有:**是**(插件生态真实存在)。

### G-26 多版本共存 + Launcher 原子切版本 —— **真缺口,但形态不适用(不建议立票)**
- 负发现:`git grep -nE "targetVersion|qoder-versions|state\.ini" HEAD -- apps packages scripts` 全量命中逐条核过 = ①`qoder_reset.rs`(清理对方目录)、②`apps/api/src/services/qoder-bridge-client.ts:93` + `scripts/qoder-chat-bridge.mjs:95` + `apps/api/scripts/qoder-capture.ps1`(采集**对方产品**版本目录形态)、③worktree-card 的 i18n `state.*` 键名噪声。本仓自身安装面无任何多版本目录/原子切换载体(桌面 = NSIS 就地覆盖 + tauri updater)。
- 已具备的最近等价腿(现读):`apps/desktop/src-tauri/src/auto_refresh.rs`(每小时单端点自更)、`apps/cli/src/updater.ts`(minimumVersion 闸)、`apps/web/src/lib/app-version-gate.ts`(强更六终态)。三者是版本**闸**,非共存/回滚载体。
- 真需求(灰度回滚)已由服务端影子档(`shadow_runner.py` 族)承担更便宜等价面;照抄多版本目录会撞 `desktop-artifact-single.mjs` 唯一产物判据 + §15/§26 盘卫生红线。
- 最小落点:**无**(维持册 §11「不抄」原判,复跑入口即上述 grep)。
- 是否本仓应有:**否**(桌面分发壳层形态)。

---

## 给派单的净结论

- **无需派单(已结清,重复派=重复劳动)**:G-07、G-08、G-10、G-11、G-14、G-17、G-18、G-22。
- **可派单一条**:G-21 残半腿 = 插件已装面逐文件 sha256 台账 + 对账守门(installer.ts record 扩展 + 照 check-lock-manifest-consistency 骨架的门);zip-bomb/解包上限那半**不派**(git clone 取源,无解包面)。
- **不派、按 §1「台账只记真工作」把结论写进 commit message 即可**:G-20、G-26(形态不适用,证据与复跑入口已在本文件逐条锚定)。
- 册子 §1 表格与 §5 复验轮对 G-17/G-18/G-22 的证据行已过期(inject_session_env 零调用、run_manifest 0 命中、defaults 缺登记三前提均被 HEAD `eb1dad8a82` 现状推翻);引用该册时以本文件与 §7–§11 为准。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
