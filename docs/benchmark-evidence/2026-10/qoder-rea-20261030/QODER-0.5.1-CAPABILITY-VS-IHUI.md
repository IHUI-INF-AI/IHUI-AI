<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# Qoder CN 0.5.1 能力取证 × IHUI-AI 差距判定(2026-10-30 第六轮 · REA 重建)

> **本目录是本轮取证的正本面。**上一册 `docs/AI_CHAT_BENCHMARK_MASTER_PLAN_2026-10.md` 的证据基线钉在
> Qoder CN **v0.4.3**(2026-09-28)。本仓红线:"竞品版本一变,本册全部结论作废,必须重取"。
> 本轮重取时,对照程序已连跳 **0.4.3 → 0.4.9 → 0.4.11 → 0.5.1**(本机三版共存),且取证载体
> 从"解包读文件"升级为 **REA 静态重建证据图 + 混淆字符串还原**两种新器物。
>
> 射程:**只对标 Qoder CN 一款**(Codex/Trae 两族本轮不重取,沿用 V4 与 D141 正本,但那些行的
> "版本前提"仍写着旧值,引用者自行判新旧)。
> 手法纪律:每条结论标 [观察]/[推断]/[未知];[观察] 一律给可复跑锚点(路径+键名/偏移/字节数)。
> 红线合规:全目录只出现路径、符号名、配置键、枚举档、事件名与 ≤60 字符定位串,**零成段源码**。

## 0 证据基线(现读于 2026-10-30 夜,复现前必查)

| 项 | 读数 | 取法 / 载体 |
| --- | --- | --- |
| 共存版本 | `0.4.9` / `0.4.11` / `0.5.1`(各旁挂 `<ver>.qoder-update-ready.json`) | `ls G:\Qoder CN\.qoder-versions\` |
| **生效版本** | **0.5.1 正在运行**(12 枚进程 20:37:12 起于根安装位;根 `Qoder CN.exe` 即 ExecutablePath) | `Get-CimInstance Win32_Process` + `.qoder-app-status.json.version=0.5.1` |
| 包体哈希 | 根 `resources/app.asar` 196,831,317 B,sha256 前缀 `7cdfc0a41795cf86…` **与** `.qoder-versions/0.5.1/resources/app.asar.qoder-pending` 逐字节相等 | `sha256sum` 双件比对 |
| 0.4.11 旧版 | 包体 189,505,973 B,sha256 `e9d780de8caa3d108ffe476c…` == REA 证据 `ev_1c03427d…` 记录值 ⇒ **上一轮 193MB 证据对 0.4.11 仍有效** | 同上 |
| 构建事实 | 0.5.1:electron 43.1.1 / commit `ef0366398c9f…` / buildNumber 84759508 / buildTime **2026-10-30T05:45:18Z**;0.4.11:commit `d9996760e3d4…` / 2026-10-23 | `resources/build-manifest.json` |
| Agent 运行时 | worker `1.1.75-hotfix.1`(0.4.11)→ **`1.1.79-hotfix.7`**(0.5.1),体积 34,389,777 → 34,838,773 B(+448,996) | `dist/_worker/runtime-info.json` 两版并列 |
| 产品自述 | `qoder-cn` "Qoder - Agent workbench for human and AI software teams",main=`out/main/index.js`,private=true | `benchmark-asar-read --get /package.json`(须 `MSYS_NO_PATHCONV=1`) |
| 包内条目 | 0.4.11:6,420 条(展开 284,499,765 B,**6,420 条全带 integrity 字段**) / 0.5.1:6,435 条(新增 155、删除 140) | 自建 header 遍历器 `chair-asar-diff.mjs` |

**三份 REA 证据(gitignore 缓存,不入库;复跑命令在各席件 §内)**
`asar-analysis.json` 193,121,114 B(app.asar)/ `agentsdk-analysis.json` 24,183,892 B(unpacked SDK)/
`extensions-analysis.json` 53,902,965 B(`resources/extensions`,subject sha `e5d3a410…`,本轮新跑,exit 0)。

**取证件清单(本目录,7 席 + 主席自验,共 ~175 KB)**

| 件 | 射程 |
| --- | --- |
| `S0-chair-verified-baseline.md` | 主席自验版本基线、哈希复验、包内字节级差集、本仓取证工具的三条实测边界 |
| `S1-prior-session-digest.md` | 上一轮 4,526 行导出件的已确证事实 / 已跑命令 / 未完成清单 / **被推翻假设** |
| `S2-agent-sdk.md` | Agent 运行时:38 内置工具+参数键、28 钩子事件、6 权限档、压缩阈值数字、proto 全字段、12 项独有机制 |
| `S3-desktop-shell.md` | 壳层 15 个载体目录 + 9→10 枚扩展 contributes 与权限令牌 + 用户态 `~/.qoder-cn` 全布局 + AppData sqlite 面 |
| `S4-rea-evidence.md` | REA 三份证据的 coverage/limitations/fingerprints/unknowns 聚合读数 + "零值不等于没有"的取证边界 |
| `S5-ihui-capabilities.md` | IHUI-AI 侧现读(15 节,禁读对标文档):479 模块 / 615 表 / 92 MCP 工具 / ~100 CLI 工具 / 78 条能力台账放量态 |
| `S7-asar-internals.md` | app.asar 内部:主进程 40 件 18.6MB、明文还原 47,099 条、十项能力定位、12 档 `QoderModelPurpose` |
| `S8-version-delta.md` | 0.4.11→0.5.1 差集:browser-connector / collaboration-cli / index-settings / office +35.6MB |

## 1 Qoder 能力地图(六层,每层给一手锚)

**L0 交付与版本层** — `.qoder-versions/<ver>/` + `<ver>.qoder-update-ready.json{releaseId,archiveSha256,payloadLayout=pending-asar-v1}` + Launcher `state.ini{schemaVersion=3,status,installDir,appExecutable,targetVersion,updatedAt}`(INI 非 JSON,配 `state.ini.writers/` 写者锁)+ `fast-update` 文件级 sha 清单 868 条 + `qoder-fast-update.cat`(Authenticode 目录)+ `qoder-fast-update-trust.exe` + `elevate.exe` + `--verify-authenticode` 旗标 + 失败码族 `WINDOWS_LAUNCHER_{HANDOFF_ACK_TIMEOUT,HANDOFF_REJECTED,INSTALLATION_MISMATCH,LOCALE_*}` / `WINDOWS_FAST_UPDATE_{AUTHENTICODE_FAILED,INSUFFICIENT_DISK_SPACE:required=}`。**双通道**:全量 electron-updater@6.8.9 兜底 + 增量交 Launcher([S7§3.10])。

**L1 进程与宿主层** — `out/main/` 自有 40 件 18,574,099 B:`electronMain.js` 单包 19,500,750 B(0.5.1)+ `pluginHost.js` 59,173 + `remoteControlProcess.js` + `dataDirectoryProcess.js` + `remoteSdkDaemonBridge.js` + 34 枚 hash chunk;`out/preload/` 9 件 6.25 MB,其中 `pluginViewRuntime.cjs` 2.63 MB、`pluginViewDiagramRuntime.cjs` **5.07 MB(0.5.1 +47%)**= 插件视图沙箱;6 枚 browser window;进度窗显式 `webPreferences{sandbox:true,contextIsolation:true,nodeIntegration:false}`;`resources/node-repl/` 3.4 MB 持久 JS/Node 求值内核(tree-sitter wasm 647 KB 做语法树内省);`resources/bin/` 4 枚原生件(`native_clipboard` / `notification_permission` / **`dji_mic_button`** / `appshot_bare_modifier_monitor.exe` 裸修饰键全局监听)。[S3§1 S7§2 S4]
> 定性修正:**它不是 VS Code fork。** 这颗 asar 内无 `out/vs/**`、无上游 `extensions/**`、渲染层是 Vite hash 资产、IPC 字面通道 0;但 `~/.qoder-cn/extensions/extensions.json` 走 **VS Code 兼容扩展宿主面**(`$mid/isBuiltin/pinned/targetPlatform`),实装一枚 `ms-python.debugpy` 35 MB;编辑器核以 `@qoder-space/editor-core` 构建期内联(依赖写 `*` 而 node_modules 内不存在)。⇒ **自研 Electron 壳 + 内联编辑器核 + VS Code 兼容扩展宿主(只为调试器)**。[S7§2 S3§6]

**L2 扩展平台层(Qoder 作为"平台"的核心,也是我方最缺的一层)** — 唯一清单 `resources/extensions/catalog.v1.json` 86.8 KB:`{schemaVersion,plugins[]}`,每枚带 **完整 manifest + 逐文件 sha256**(清单即完整性校验)。9→10 枚内置扩展的 contributes 实测:`views`(slot=@workbench/@settings/@file.preview/@session.resource/@chat.mentionPreview)、`filePreviewers`(`.canvas.tsx`/`.pptx`/`.qoder.site`/`.xlsx`,带 `priority/hostHeader/tabIcon/hoverPreview/refreshPolicy`)、`sidebarNavItems`(slot=workbench.sidebar.secondary)、`sessionResources(+taskMonitorSection)`、`chatMentionProviders(id=knowledge,onUnavailable=continue)`、`activationEvents(onChatMention:knowledge)`、`nativeModules(picture-in-picture-host,lifecycle=plugin)`、`qoderAgentSdk.plugins` 按 **操作系统 ∧ 配置键双条件 enablement**(browserUse / computerUse{Windows≥10.0,MacOS≥14.0,Linux})。权限是**细粒度能力令牌**:`chat.{createSession,observeTurn,interruptTurn,attachAnnotation,sendToSourceSession,provideMentions}`、`files.{readSessionResource,stageLocal}`、`mcp.registerInProcess`、`workspace.{read,readProjects}`、`auth.readUserToken`、`enterprisePolicy.read`、`extensions.manage`、`network.readProxy`、`session.provideResources`。市场:`known_marketplaces.json`(url+autoUpdate)+ `installed_plugins_v2.json` + 插件级 **8 版本目录并存**;装机预置 `bundled-resources/manifest.json` 带 `maxEntries=90 / maxExpandedBytes=19,430,823`(解压炸弹护栏)+ `presence=ensure-minimum` + `userVisible`。[S3§2§6]

**L3 Agent 运行时** — worker `qoderclicn` 同源(`productName=qoderclicn` ⇒ 桌面嵌的就是 CLI 内核),34,838,777 B 混淆单文件。
- **38 枚内置工具**(`ALL_BUILTIN_TOOL_NAMES` @偏移 1616957):Glob/TodoWrite/Write/WebSearch/ImageSearch/WebFetch/Edit/Bash/PowerShell/Monitor/TaskStop/BashInput/BashOutput/BashResize/Grep/Read/Skill/AskUserQuestion/TaskCreate/TaskGet/TaskUpdate/TaskList/GetGoal/CreateGoal/UpdateGoal/EnterPlanMode/NotebookEdit/ExitPlanMode/UpdateTopic/CompleteTask/ImageGen/VideoGen/VideoGenRetrieve/CronCreate/CronDelete/CronList/ScheduleWakeup/Agent/EnterWorktree/ExitWorktree/Workflow;另 `ListAgents`/`ListPeers`/`RunWorkflow`/`StructuredOutput`/`CodebaseInvestigator`/`GrepRipgrep` + MCP 三元 `mcp_list`/`mcp_get`/`mcp_call`。
- **工具属性面(不是布尔,而是九把方法)**:`isReadOnly`/`isConcurrencySafe`/`isDestructive`/**`isOpenWorld`**/`interruptBehavior()`(默认 `block`)/`requiresUserInteraction()`/**`toClassifierInput()`(入参截 4000 字符喂风险分类器)**/`maxResultSizeChars`/`validateParams`,kind 全集含 `read|search|fetch|execute|workflow|other`。
- **28 个钩子事件** × **4 类 handler(`command|http|prompt|agent`)**:`prompt`/`agent` 两型是**隔离 LLM 评估器且明写"不见主会话历史"**;字段含 `matcher/if:"Tool(glob)"/async/asyncRewake(exit 2 唤醒模型)/rewakeMessage/rewakeSummary/sequential`;Bash 复合命令用 **tree-sitter 拆条逐个匹配**;`AGENT_HOOK_DISALLOWED_TOOLS` 给 agent 型 hook 再套一层禁调集。
- **6 档权限模式**:`default/acceptEdits/bypassPermissions/plan/**dontAsk**/**auto**`(后两档连自家 `sdk/SKILL.md` 都没写);规则串支持 `Tool(glob)` 与 `mcp__*` / `mcp__server__*` 通配 + `persistPermissionUpdate(s)` + `loadAllPermissionRulesFromDisk`;设置来源 7 档 `Runtime/Project/User/Local/System/Plugins/Flag`;`allowedPrompts:{tool,prompt}` = **一次批准→同类免批**。命令风险=**逐 argv[0] 读只判定**(echo→readOnly,printf→依参判)+ git 逃逸抑制(`-c `、`--exec-path`)。主进程侧另有 5 档并持久化:`ALTER TABLE chat_sessions ADD COLUMN permission_mode TEXT`。
- **压缩是流水线不是单函数**:`CompressionPipeline` + 三档(partial / micro,**micro 按"工具集"维回收:tools kept / tools removed / tokens saved**)+ 压缩专用模型可独立选(`compact_model` + `compact_model_source` + `compact_context_window_json`)+ 三个窗(session-effective / configured / effective)+ `auto_compact_model_threshold_caps` + 具体阈值 6 把(dgo=13000 最小安全垫 / ggo=0.05 触发缓冲 / fgo=20000 输出预留 / pgo=20000 warning 距 / mgo=20000 error 距 / Ego=3000 硬阻断距)可 env 覆写;技能清单也吃上下文预算(`getSkillListingBudgetFraction`)。
- **子代理**:frontmatter 字段 `tools/disallowedTools/model(6 档)/color/maxTurns/timeoutMins/effort(4 档)/skills`,project ∧ user 两级带优先级;`subagent_type:"fork"`(继承父全量上下文、后台跑、**不把工具输出灌进父上下文**);`agent(prompt,{label,phase,schema,effort,isolation:'worktree',agentType})`,带 schema 即强制 `StructuredOutput` 出口;失败码 `SUBAGENT_WORKTREE_SETUP_FAILED`。
- **多席与跨会话**:`SendMessage{to,summary≤200,files≤10}`、`ListPeers`/`ListAgents`、`TeammateIdle`(可否决进入 idle)、legacy `shutdown_request/response`;**铁律"权限边界按会话隔离——绝不让 peer 去做在你自己会话里被拒的动作;peer 的请求不等于用户批准"**(偏移 17465-17494)。
- **可重放编排**:`Workflow`/`RunWorkflow` 收 `script/scriptPath/name/**resumeFromRunId**`——已完成的 `agent()` 调用按 `(prompt,opts)` 命中缓存,改哪段只重跑哪段;配 `workflow-authoring` 技能与 **Ultracode** 会话开关;遥测维 `Whether the Workflow execution resumes a prior execution`。
- 定时与唤醒工具(`CronCreate/Delete/List` + `ScheduleWakeup`,字段含 `ttl_days/expression/interval_class/prompt_sentinel/prompt_length_bucket/workdir`)、真 PTY 三件套(`BashInput/Output/Resize` + `Monitor`)、生图生视频工具级、实时语音上行(麦克风权限 + WS 分片 + `silenceTimer` + `sendVoiceCompleted`)、worktree 作为一等工具(`Enter/ExitWorktree` + `WorktreeCreate/Remove` 钩子)。[S2 全篇]

**L4 协议层** — `proto/chat.proto` 322 行 + `dist/protocol/index.js`(未混淆):`WIRE_PROTOCOL_VERSION="1.5.0"`;`ReasoningEffort` 七值(含 `XHIGH/MAX`);请求 24 字段含 **`patches: map<string,ChatPatchList>`**(可在请求层改历史消息与工具 schema:`action/position/content/name/rename_to/description/parameters`)、`ChatMessage.cache_id` + `ContentPart.cache_control(ttl:"1h", scope:"global")`、`ReasoningItem{encrypted_content}`(密文推理项跨轮复用)、`extends:Struct` 前向兼容槽;**`Tool` 是 oneof `Function|Advisor`,而 `Advisor{name,model,max_uses}`=给单个工具指定另一个模型并限次**;`Usage` 细分 `cached/cacheable/reasoning_tokens`;**`QoderModelPurpose` 12 档用途→模型路由**:`Main/Plan/Task/Compact/Title/Suggestion/Generate/HookPrompt/Subagent/WebFetch/ImageGen/Compression/Utility`;四维 metadata 里 `WorkspaceMetadata{file_count,languages,codebase_status,codebase_soft_status,codebase_external_id,data_policy}`、`ContextMetadata` 带 `source_session_id`(会话谱系)与 `request_set_id`;运行模式判定 `remote_worker|acp|sdk|tui|headless` 五态同吃;双协议适配(OpenAI Responses 事件字面量 + `ANTHROPIC_MESSAGES`)。BYOK 是一等子系统:`CustomModelConfig{name,url,style,provider,type,model,parameters}` + 鉴权源六档 `user/project/org/temporary/oauth/none` + `BYOK_{catalog_load,operation,validation}_*` 事件族 + `BYOK_CAPABILITY_METADATA_{CONTEXT_WINDOWS,EFFORTS}`(每档模型登记自己的窗口与 effort 能力)。[S2§5§9 S7§3.1§3.8]

**L5 用户态与数据层** — `~/.qoder-cn`:`memory/MEMORY.md` 索引 + 分类前缀 md(29 `feedback-*` / 8 `reference-*`)与**旧形态 `memories/<uid>/{global,projects}` 并存**(= 迁移痕迹,`memory_migration_ledger` 表 + "Import Qoder IDE Quest memory" 文案);`file-history/<sessionId>/<fileUuid>@vN` 逐版本**原始字节**快照(1.58 GB);`plans/<三英文词随机名>.md`(全库 1 份,不分项目);`goals/<id>.json{objective,status,maxTurns,turnsUsed,timeUsedSeconds,creditsUsed}`(**机读三维预算计数器**);`mcp-router.json{schemaVersion,pid,baseUrl=http://127.0.0.1:<port>,apiKey,startedAt}`(**MCP 聚合走单条本地 HTTP 路由进程**);`external-commands/registry.json`(**按平台分桶的远程可执行下载表**:url+sha256+archiveType+entryName);`shell-snapshots/` 134 枚逐 1591 B **登录 shell 环境快照**;`session-env/<sid>/sessionstart-hook-<n>.sh`;`host-actions/result-index/<sha256>-<uuid>.json` + `.staged/`(**内容寻址的宿主动作结果索引**);`logs/runs/<run_id>/manifest.json{argv,ppid,process_role,cli_version,node_version,project_id,env_flags}` 1040 个 + `logs/latest` 软链。AppData 侧:`main.sqlite` 709 MB + `chat-session-turn-payload-buffer.sqlite` 63.7 MB + `sessionMigration.sqlite` / `memoryMigration.sqlite`(**跨版本搬家各留一道工序**)+ `qoder-data.v1.json` 协作域模型 26 顶层键(squads/turns/turnInputs/sessionDeliveries/attention/evidence/projects/issues/comments/subscriptions/agentRuntimeTargets…)。加密边界:会话 `state.json{items.s0.{c,u,n,p}}` 与 `.models/<uid>/catalog-v7` 是密文,而 `settings.json→providers.*.apiKey`、`mcp-router.json→apiKey`、`ipc/browser-use.json→token` **三处明文**。[S3§3§4§5]

## 2 逐轴对比(判定口径:真缺 / 部分 / 对等 / 我方强)

| # | 轴 | Qoder 实证(锚) | IHUI-AI 现读(锚) | 判定 | 代价 |
| --- | --- | --- | --- | --- | --- |
| 1 | 宿主扩展点(第三方贡献 UI) | `catalog.v1.json` views/filePreviewers/sidebarNavItems/chatMentionProviders/activationEvents/nativeModules[S3§2] | 全仓 grep `contributes\|capabilityToken\|registerInProcess\|mentionProvider\|filePreviewer` **零命中**(阳性对照:同正则打 Qoder catalog 命中 10/3/3);我方 "plugins" = Fastify 服务端中间件 | **真缺** | XL |
| 2 | 能力令牌化权限 | 14 类 `chat.*/files.*/mcp.registerInProcess/enterprisePolicy.read/auth.readUserToken` 逐插件授权[S3§2] | `mcp_server.py:555 _ADMIN_ONLY_TOOLS` 一份字符串集合 + `TOOL_RISK_LEVELS=['read','write','dangerous']`(packages/types/src/tool-contract.ts:254) | **真缺(令牌维)** | L |
| 3 | 工具运行期属性 | `isOpenWorld`/`interruptBehavior`/`toClassifierInput`(截 4000 入分类器)/`isConcurrencySafe`/`requiresUserInteraction`[S2§2] | `ToolPermissionContract`/`TOOL_CONFIRMATION_MODES`/`ToolResultBudgetContract` 在,**无开放世界/中断语义/分类器入参投影** | 部分 | M |
| 4 | 权限模式档位 | 6 档含 `dontAsk`/`auto`;`Tool(glob)`+`mcp__*` 通配规则持久化;设置来源 7 档;`allowedPrompts` 一次批准同类免批[S2§6] | 有 permission_mode/axis/profiles(`MCP_PERMISSION_PROFILES_ENABLED` 默认 false)与命令归一键;**无 dontAsk/auto、无"批准即生成放行规则"落盘面** | **真缺(两档+规则生成)** | M |
| 5 | 审批到人界面 | 宿主内置审批 UI + `PermissionRequest`/`PermissionDenied` 钩子 + `MCP_AGENT_NOT_APPROVED` 族[S7§3.5] | 后端 `routers/decisions.py` 已聚合;**任何一端都没有审批收件箱页面**(web admin 实测只有 `clawdbot/{permissions,tools}`)[S5§6§12] | **真缺(且最便宜)** | **S** |
| 6 | agent 生命周期钩子 | 28 事件 × 4 handler 型(含隔离 `prompt`/`agent` 评估器)+ `asyncRewake` + tree-sitter 拆命令[S2§6] | `packages/types/src/agent-runtime.ts:37-52` **恰 14 事件**:`preToolCall/postToolCall/userPromptSubmit/preCompact/postCompact/notification/stop/stopFailure/postToolUseFailure/permissionDenied/subagentStart/subagentStop/sessionStart/sessionEnd`;`HookEntry.webhook?` = http 型对位 | 部分(缺 14 项:`PermissionRequest`/`TeammateIdle`/`ConfigChange`/`InstructionsLoaded`/`CwdChanged`/`FileChanged`/`WorktreeCreate/Remove`/`TaskCreated/Completed`/`QueryEnd`/`Setup`/`Elicitation`/`ElicitationResult`) | M |
| 7 | 子代理声明与隔离 | frontmatter 8 字段(model 6 档/effort 4 档/skills/color/timeout)+ `fork` 语义 + `isolation:'worktree'` + `StructuredOutput`[S2§3] | `apps/cli/src/subagents/types.ts`:`IsolationMode none/worktree/subprocess`、`CapabilityMode` 4 档、`PrecedenceLayer` 3 档、生命周期/终态/detach reason[S5§4] | 对等(声明面我方更细);**缺 fork 与强制结构化出口** | S |
| 8 | 可重放编排 | `Workflow`+`resumeFromRunId` 按 `(prompt,opts)` 命中缓存 + Ultracode + `workflow-authoring`[S2§10.1] | CLI `commands/workflows.ts` + plan 状态机;服务端 `dag_scheduler.py` 1167 行;**无调用键缓存重放** | **真缺** | M |
| 9 | 模型可编程定时 | `CronCreate/Delete/List`+`ScheduleWakeup`(ttl_days/interval_class/prompt_sentinel)+ `croner` + `automation-task` 域 8 次迁移[S2§10.2 S7§3.6] | 工具 `schedule_task/create_automation/configure_automation_task` 在 `_TOOLS`;**`services/automation_executor.py` 180 行、`automation_thread.py` 103 行实测零消费方** | 部分(入口有,执行腿断) | **S** |
| 10 | 上下文压缩 | 三档流水线 + micro 按工具集维 + 压缩专用模型 + 三窗 + 6 把阈值可 env 覆写[S2§4] | `core/context_compaction.py` 714 行常量齐;`DEFAULT_COMPACTION_TRIGGER_RATIO=0.85`/target 0.6,**但 `_compaction_context_limit_from_env` 默认 0 ⇒ 实际不触发**;canary 三档[S5§3] | 实现有 / **放量无** + 缺两维 | **S**(放量)/M(两维) |
| 11 | 请求级 patch 与缓存锚 | `ChatPatch`(改历史消息与工具 schema)/`cache_id`/`cache_control(ttl,scope)`[S2§9] | SSE 30 事件 + usage 判别成员(D132)**无请求级 patch 通道** | **真缺** | L |
| 12 | 按用途分档模型路由 | `QoderModelPurpose` **12 档**[S7§3.1] | 全仓 grep `model_purpose\|MODEL_PURPOSE` **零命中**;`compact_model_fallback_tags` 只是重试回退标签(Codex 同族),不是用途绑定 | **真缺** | M |
| 13 | per-tool 指定模型 | `Tool{function\|advisor}`,`Advisor{name,model,max_uses}`[S2§9] | 无对位结构 | **真缺** | M |
| 14 | 工作区画像进请求 | `WorkspaceMetadata{file_count,languages,codebase_status,soft_status,external_id,data_policy}`[S2§9] | `probe_code_file_count` 只服务 rg fallback(mcp_server.py:1148);请求体无工作区画像/合规态 | 部分 | M |
| 15 | 代码库索引可控面 | 0.5.1 新增扩展 `qoder.index-settings@0.1.0`,方法 `indexing.settings.{snapshot,start,cancel,setAuto,setWorkspaceIndex,reconcile}` + `indexing.ensure`[S8] | 索引实现在 `services/codebase_indexer.py`(977 行,6 消费,Merkle+pgvector);**用户面只有 `index_codebase` 工具,无快照/取消/自动档/对账四动词** | 部分 | S |
| 16 | 模型名文案热通道 | `dynamic-text/qoder-cn.json` 51→120 键(`model.<代号>.{label,detail,description}`),免发版远程改模型名[S3§1 S8] | 文案走 i18n 五语言 JSON = 发版态 | **真缺(通道形态)** | S |
| 17 | BYOK 能力元数据 | `CustomModelConfig{name,url,style,…}` + `BYOK_CAPABILITY_METADATA_{CONTEXT_WINDOWS,EFFORTS}` + 鉴权源六档[S7§3.8] | `developer_api_keys`/`api_key_groups`/`api_key_shares` 强,relay 号池独有;**代码内 "BYOK" 字面 0 命中**,无 `style`(响应格式适配)层 | 部分 | M |
| 18 | MCP 聚合与治理 | 两代 SDK 并存(`@modelcontextprotocol/*@2` 与 SDK 内 `sdk@1.27.1`)+ `QODER_MCP_LAZY` + 名单治理 8 集合 + `EnterpriseMcpGovernance` + 60+ 错误码 + **`mcp-router.json` 本地 127.0.0.1 路由进程**[S2§7 S7§3.7 S3§4] | `mcp_server.py` 12,222 行 / 92 工具;**`TOOL_DEFERRAL=on` 默认开的 lazy 我们有**(对位);`mcp_client.py` 有 principal 绑定(身份不透传);`mcp_tool_aggregator.py` 520 行**确有消费**(routers/agents.py 三处) | 对等偏我方工具面更宽;**缺单一路由进程 + 治理错误码族** | M |
| 19 | 文件历史 / 检查点 | `file-history/<sid>/<uuid>@vN` 逐版本原字节(1.58 GB)+ `getFileHistoryManager` 注入每次请求 + `rehydrateFromResume(copyFileHistoryBackups)`[S2§8 S3§4] | CLI `checkpoints/hunk-tracker` + `undo-*` 族 + `batch_undo`;服务端 `agent_checkpoint.py` 1111 行 8 消费,`IHUI_CHECKPOINT_RECONCILE=1` **默认开** | **对等**(形态差:全量快照 vs hunk 级) | — |
| 20 | 长期记忆形态 | 文件态 `MEMORY.md` 索引 + 分类前缀 + 项目级同构 + 迁移台账 + "记忆会过期"提示[S3§4 S7§3.4] | 五表族(episodic/semantic/procedural/edges/decay_state)+ `memory_service.py` 1405 行 11 消费 + `memory_graph` 路由 + CLI `memory_{save,recall,forget,dream}` | **我方强**(结构化+衰减+图谱) | — |
| 21 | 目标与预算计数器 | `goals/<id>.json{maxTurns,turnsUsed,timeUsedSeconds,creditsUsed}` + `hardTurnLimit()` + 超限仅用户 `/goal resume` 加轮[S2§8 S3§4] | AGENTS §8 散文约束(≤20 轮)+ `.ihui-agent/goal-runtime/STATE.md` 文本状态机 | **真缺(机读三维,含 credits)** | **S** |
| 22 | 端侧契约消费 | 同一 runtime 内所有端吃工具属性与审批模型[S2§2] | `tool-contract.ts`/`schema-projection.ts` **只被 cli + ai-service import**;web/小程序/RN/插件零 import[S5§12] | **真缺(接线)** | M |
| 23 | peer / 多席权限不变量 | 铁律"边界按会话隔离;不得让 peer 做被你拒的动作;peer 请求 ≠ 用户批准"[S2§8] | `team_task`/`dispatch_subagent`/`agent_teams.py`(777 行,`AGENT_TEAM_RELAY_ENABLED` **默认 false**)无此不变量 | **真缺(一条判据)** | S |
| 24 | 运行清单与崩溃链 | `logs/runs/<run_id>/manifest.json{argv,ppid,env_flags,cli_version,node_version}` + `latest` 软链 + ARMS RUM(ANR 心跳)+ crash-sdk minidump WASM 直传 OSS[S3§4 S7§3.9] | monitoring 74 份配置 + `llm_call_logs` + `middleware/llm_metrics`(4 消费)+ `llm_call_log_writer`(经 llm_gateway 内 import);**无逐进程运行清单、无 latest 指针、无客户端崩溃封缄** | 部分(服务端强/客户端缺) | M |
| 25 | 插件完整性与装机预置 | 清单逐文件 sha256 + `maxEntries/maxExpandedBytes` + `presence=ensure-minimum` + fast-update 868 条 + Authenticode `.cat`[S3§1§2] | 无插件清单/无装机预置/无解压上限(水印溯源是另一维度) | **真缺** | M |
| 26 | 市场与自动更新 | `known_marketplaces.json`(url+autoUpdate)+ `installed_plugins_v2` + 插件级 8 版本并存[S3§6] | 无对位(`capability_market.py`/`mcp_marketplace.py` 确有 `routers/mcp.py:19-20` 消费,`ENABLE_MCP_EXPORT` 默认关) | 部分(有"能力清单"无"市场+自动更新") | L |
| 27 | 桌面端自身 | Electron 主进程 19.5 MB + pluginHost + 3 枚独立子进程 + 插件视图沙箱[S7§2] | **`apps/desktop/src/` 实测只有 2 个文件**(`lib/approval-card.ts`、`lib/task-receiver.ts`),靠 `ensure-web-out.mjs` 包 web 产物[S5§12] | **真缺(结构性塌陷)** | XL |
| 28 | 浏览器接管载体 | 0.5.1 装进 `browser-connector/`:MV3 扩展 v1.7.6(固定 ID+sha256 自证)、permissions 含 `debugger`(CDP)+`nativeMessaging`+`sidePanel`、`ws://127.0.0.1` 本地腿 + `wss://browser-connector.test-preview.qoder.sh` 云中继 + `"mcp-tools"` 工具面;`native-messaging-host` 校验 pid 存活 / 30 s 陈旧 / 未来时刻容差 5 s[S8 S3§1] | MCP `browser_*`(12)+ CLI `browser_*`(16)+ `browser_page_*`;真实 Chrome 靠 CDP(机主侧已用) | 部分(工具有,**缺"装机即带的官方扩展 + 本地/云双腿桥"**这个载体) | M |
| 29 | 交付物与文档管线 | canvas 28 MB(.canvas.tsx 预览 + SDK d.ts 组件表 + 7 份 recipe)/ office 14→49.6 MB(自带 PPTX 编辑器 + 字体 + `xlsx-sidecar.exe` 原生;0.5.1 新增 workbook/xlsm/csv 三视图与文件关联)/ sites 11 MB / knowledge.center 10 MB[S3§2 S8] | `services/artifacts_store.py` + `agent_deliverables.py` + `create_artifact`/`summarize_artifacts`;导出面实测只有 `excel-export-service.ts`/`pdf-service.ts`/`xlsx-parser.ts`[S5§8] | 部分,**端内"文件级预览器 + 原生编辑器"缺** | L |
| 30 | 安全扫描产品化 | 三档 `l1StaticCheck/l2LightweightScan/l3DeepScan`(默认 false)+ **`$configuration` 把同一把设置直透 SDK 选项面** + qoder-security 0.9.5(edit 时 pattern warning / Stop 时 cloud diff review / agentic commit-push review / SHA tracking / 跨平台 `qodersec` 二进制)[S2§1 S3§2] | 提交链 260+ 道守门 + `review_pr` 工具 + `guardian_review`;**无"三档当场扫描"产品化,无"设置即 SDK 选项"的单源引用机制** | 部分(数量我方碾压,形态缺) | M |
| 31 | 进程沙箱 | **未见 OS 级沙箱开关**(无 `dangerouslyDisableSandbox`);`vm.createContext` 只用于策略求值 ⇒ 风险靠"读只判定+分类器+审批规则+worktree"四件合成[S2§6] | `core/proc_sandbox.py` 用 ctypes 打 **Windows Job Object** + `os_sandbox.py` 1671 + `sandbox.py` 1028 + `exec_policy.py` 1072 + 网络策略判定单源 | **我方强** | — |
| 32 | 生成与语音 | `ImageGen`(含图生图)/`ImageSearch`/`VideoGen`/`VideoGenRetrieve` 工具级;实时语音上行(麦克风权限 + WS 分片 + silenceTimer)[S2§10] | MCP `image_generation/image_edit/video_generation/music_generation/voice_tts/audio_transcription/generate_chart` + `#46 实时语音协作` 尺子判已交付 | **我方更宽**(多音乐/ASR/TTS/图表) | — |
| 33 | 终端与命令 | node-pty + `BashInput/Output/Resize` + `Monitor` + xterm 161 处[S2§2 S7§3.2] | CLI `terminal_{open,read,write,resize,close}` + `terminal_exec_sandboxed` + `run_tests`;服务端 `run_command` | 对等;**缺的是"terminal 帧在 RN 主屏零命中"这条端可达**(V4 #D19 残留) | S |

## 3 判定汇总:这轮量到的"真不如它" Top 12(按 用户可感知 × 补起来便宜 排序)

| 序 | 差距 | 为什么现在能便宜 | 补起来第一步(具体到文件) |
| --- | --- | --- | --- |
| 1 | **审批收件箱页面缺**(后端 `decisions.py` 已聚合,零 UI) | 数据面与帧面都在(D131/D193 已交付),只差一屏 | `apps/web/app/(main)/…` 新建收件箱路由,消费既有 `GET /api/decisions` 面;三端同批(小程序/RN 至少给只读列表) |
| 2 | **目标机读预算计数器**(maxTurns/turnsUsed/timeUsedSeconds/creditsUsed) | 我方已有 `rollout_budget`/`agent_run_control` 实现,缺落盘形态 | 定一个 `agent_goals` 表形态 + `goal-verification.ts` 读写同一把计数器;AGENTS §8 的"≤20 轮"改由字段判,不靠散文 |
| 3 | **压缩默认不触发**(context_limit 默认 0) | 阈值与流水线都在,是放量动作 | `capability_matrix` 里把 `AGENT_COMPACTION_MODE` 的 canary 起一档(按 session 稳定哈希),同批补"触发后 turn 计数不退化"的观测 |
| 4 | **automation 执行腿零消费**(工具在册,executor 死) | 断点明确:`services/automation_executor.py` 180 行没被 import | 把 `create_automation/configure_automation_task` 的落库点接到 executor,再加一条"任务被创建⇒执行器有登记"的镜像测试 |
| 5 | **权限缺 `dontAsk`/`auto` 两档 + "批准即生成规则"** | 规则串与持久化半边已有(command_canonicalization) | 在 `core/permission_mode.py` 补两档语义,`resolve_approval_for_requester` 批准分支里同批写 `workspace_permission_rules` |
| 6 | **钩子事件缺 14 项**(尤其 `PermissionRequest`/`TaskCreated`/`FileChanged`/`CwdChanged`) | 事件位是联合类型 + HooksConfig 字段,加维度是线性活 | `packages/types/src/agent-runtime.ts:37` 扩 union,同步 CLI dispatcher 与 ai-service 触发点,守门"事件并集两侧同宽"防漂移 |
| 7 | **模型可编程定时任务**(`Cron*` 等价工具) | 第 4 条通了就顺手 | MCP 目录补 `cron_create/list/delete` 三枚,复用 BullMQ repeatable job,不新开路由 |
| 8 | **Workflow 可重放**(`resumeFromRunId` 语义) | CLI 已有 plan 状态机与 workflows 命令 | 给子调用加 `(prompt,opts)` 指纹缓存 + `run_id` 台账;先只做同会话命中,跨进程持久化作第二步 |
| 9 | **按用途分档模型路由**(12 档对位) | `combo_router`/`model_availability` 是现成执行器 | 定 `MODEL_PURPOSE` 枚举(先落 Main/Compact/Title/Suggestion/Subagent 五档),`llm_gateway` 按 purpose 取模,目录条目带 capabilities |
| 10 | **端侧契约不落地**(web/小程序/RN/插件不 import tool-contract) | 契约已在 `packages/types`,是消费面缺 | 从插件端起步(它离 CLI 最近),逐端加"风险级→文案"单源,配跨端 parity 门 |
| 11 | **peer 权限边界不变量** | 一条判据 + 一处提示词 + 一条测试 | `agent_teams`/team_task 派发处加"被拒动作不得转派 peer";测试钉"peer 请求不构成用户批准" |
| 12 | **宿主扩展点 + 插件清单完整性 + 市场**(平台化三件套) | 不便宜,但要开始:先把"清单+逐文件 sha"做出来就能挡住今天的 `--force-running-reason` 类手工绕行 | 第一步只做 `.ihui/plugins/catalog.v1.json`(id/version/root/manifest/files[].sha256)+ 一条"清单与盘面对账"的守门;UI 贡献面留到下一轮 |

> **不便宜但最刺眼的一条**(不入上表排序,单独记):`apps/desktop/src/` 实测 2 个文件 —— 我们的桌面端今天仍然是 web 的壳,而对照程序把主进程做成了 19.5 MB 的能力宿主(独立子进程 ×3 + 插件视图沙箱 + 原生外设)。这不是"少个功能",是**产品形态层级的差**，任何"端侧接线"类的第 10 条差距在 desktop 这一端都无处可接。

### 3b 上表逐条复核(2026-10-30 深夜,交付前第二遍现读 —— **第 1、5 行被推翻**)

派工前对上表每条复跑承载判据,结果如下。**凡我判错就照原样登记,不删原行**(原行保留作留痕):

| 行 | 复核结论 | 现读证据 |
| --- | --- | --- |
| 1 审批收件箱 | **推翻:此缺口不存在** | web 侧 `apps/web/src/components/feature-center/NotificationCenter.tsx` 已有 `pendingDecisions` 区块(含空态/条数/`myPendingDecisions` 文案)+ 测试 `__tests__/d193-decision-inbox.test.tsx`;RN 侧 `apps/mobile-rn/src/screens/PendingDecisionsScreen.tsx`(270 行)独立屏 + 30 分钟超时判据;数据源两侧同吃 `listPendingDecisions()`(packages/api-client/src/endpoints/chat.ts)。**残余只有一格**:收件箱里只能深链回源会话,不能当场结算(`onDecisionItemClick` 只做跳转)——而对照程序本来也是在会话内批准,故这一格不构成差距 |
| 5 "批准即生成规则" | **推翻:后端已有** | `apps/ai-service/app/services/agent_loop_v2.py:682 grant_tool_approval_persist(approval_id, scope)` 支持 `session` / `always` 两级("批 53 persist 通道",注释自陈对标 codex PERSIST_SESSION/ALWAYS),契约侧 `packages/types/src/tool-contract.ts` 有 `TOOL_PERSIST_SCOPES`。**残余只在"UI 是否暴露该档"——本轮未取证,标 [未知]** |
| 3 压缩默认不触发 | **半真** | `_compaction_context_limit_from_env()` 默认 `"0"` 确为"未配置=不压缩"(agent_loop_v2.py:1637-1643),但同处注释明写"生产按模型实际上下文窗口设置(如 128000)"⇒ 是否真不触发取决于 **生产 env**,本机只读到默认值,标 [未知];不得据默认值断言线上不压缩 |
| 4 automation 执行腿 | **改判:不是"断腿",是"僵尸模块 + 覆盖窄"** | `automation_executor.py` 除自身外确零 import;但工具本身**真会执行**:`mcp_server.py:4845 _tool_configure_automation_task` 在 `execute=True`(默认)时按 `action` 分派到 `_tool_schedule_task` / `_tool_dispatch_subagent` / `httpx POST webhook`(:4903 起)。⇒ 真实问题两件:① `automation_executor.py`(180 行,含 retry/abort/fallback/on_success 与多步 trace)是**没被任何人调用**的重复实现;② 模型可编程的定时面只有 `schedule_task` 单动词,缺对照的 `CronCreate/CronList/CronDelete/ScheduleWakeup` **增删查看四件套** |
| 2 目标机读预算 | **真** | `packages/database/src/schema/` 无任何 goal 表;`services/` 与 `core/` 对 `turnsUsed/turns_used/goal_turn_budget/maxTurns` **零命中**;只有 `services/goal_resume.py`(300 行,零消费)与 CLI 侧 `goal-verification.ts` |
| 11 peer 权限边界 | **真** | `services/agent_teams.py` 内 `peer|teammate` **零命中**,连概念都没有 |
| 6 钩子 14 vs 28 | **真,且比原判更糟:我们是两套互不相干的钩子** | ① TS 侧 `packages/types/src/agent-runtime.ts:37-52` 恰 14 值(CLI hook 配置面);② Python 侧另有 `apps/ai-service/app/core/hook_runtime.py`,其 `HookKind` **只有 6 个挂载点**(`session_start / user_prompt_submit / pre_tool_use / pre_compact / post_compact / stop`,L40-48),消费方是 `agent_loop_v2.py:6400`。两套**没有共享枚举、没有映射表**——同一件事两个真相源,比"少了 14 个事件"严重。⇒ 扩面前必须先合并成一个事件集(TS∪Py 并集单源),否则加多少都是第三套 |
| 8 工作流可重放 | **真,但有一半等价** | CLI `subagents/state-store.ts` 的 `resumeFrom` 是**子代理断点续跑**,不是对照那种"`agent()` 调用按 (prompt,opts) 命中缓存、改哪段只重跑哪段"的编排级重放 |
| 9 桌面端 2 文件 | **真** | `apps/desktop/src/` 现读 2 文件 |
| 12 按用途 12 档路由 | **真** | 全仓 `MODEL_PURPOSE|model_purpose` 零命中 |
| 10 端侧契约消费 | **真** | `tool-contract`/`schema-projection` 仅 cli + ai-service import |
| 7 模型可编程定时 | **真(入口有、执行腿断)** | 见第 4 行,同一根因 |

**复核后的真实待办序**:②(goals 机读预算)> ⑪(12 档用途路由)> ⑥(钩子 14→28 扩面)> ⑦(定时四件套 + 清 `automation_executor` 僵尸)> ⑩(端侧契约消费)> ⑨(desktop 形态,最贵)>(可选)⑫ 收件箱内结算。**①作废、⑤只剩 UI 暴露面未取证、③需看生产 env。****教训**:Top 榜也不可信到"照着开工"——本仓"造好没装车"与"装好了没人记得"两种形态同时存在,判"我方没有"必须先 `grep` 到消费点,而不是只 `grep` 到声明点。**第 1 行这条假缺口如果照单开工,就是给已交付的 D193 重做一遍。**

## 4 我方不输/反超项(防单向自卑,每条同样给锚)

1. **进程级 OS 沙箱**:Windows Job Object(ctypes)在 `core/proc_sandbox.py`,对照程序**未见 OS 级沙箱**(S2§6)。
2. **记忆结构化**:五表(episodic/semantic/procedural/edges/**decay_state**)+ 图谱路由 + `dream`;对照是文件态 md + 迁移台账。
3. **生成类工具覆盖面**:多 `music_generation`/`voice_tts`/`audio_transcription`/`generate_chart`。
4. **提交链守门规模**:260+ 道(编号与档位以 `guardian-runner.mjs` 现值为准),对照的安全是"三档扫描 + 插件",没有"每次提交跑一整套本仓判据"这一层。
5. **MCP 工具目录规模**:92(MCP `_TOOLS`)+ ~100(CLI)对 38(对照内置,其宿主面另经 MCP 扩)。
6. **检查点默认开着**:`IHUI_CHECKPOINT_RECONCILE=1` 默认开,且 lazy 工具发现 `TOOL_DEFERRAL=on` 也默认开 —— 对照这两处形态未见(其 lazy 有,默认态未取证)。
7. **供给与商业面**:号池/relay/反向代理/定价规则引擎/积分/商城/教育线 `edu_*` 14 工具 —— 对照程序完全不在此域(它是单机 workbench)。
8. **运维到人**:邮件单通道 + 身份去重 + 发信量台账 + 守护自证;对照只有崩溃上报与 RUM。
9. **i18n 五语言同批纪律**(parity 门 + 语种纯度门)。

## 5 不得列为差距(含阳性对照,防下一位重抄)

- **`umid` 设备指纹 / `sgsdk.dll` 风控 / `installation_id`+`machine-id`+`.updaterId` 四把身份键并存 / DJI 麦克风物理按键 / 裸修饰键全局监听**:取证确凿,但属合规与硬件绑定的商业选择,不是能力缺失。**记"知道有,不建议抄",不得立票。**
- **`@arms/rum-electron`、崩溃 minidump 直传 OSS**:是运维基建,不是 agent 能力;§3 第 24 行只主张"逐进程运行清单"这一格。
- **REA 的零值面**:`preload_entrypoints=0 / context_bridge_apis=0 / native_addon_bindings=0 / utility_processes=0`,而盘上实测 `out/preload/` 有 9 文件 6.25 MB、9 枚 `.node` ⇒ **零值是覆盖口径,不是"竞品没有"**;谁把它读成"没有"谁就在造假(S4 的结论,沿用为本册 §6)。
- **上一册 D156 六件事**(逐条时间戳/思考 token 数/工具卡全文搜索/Mermaid 外图表 等):其否证基线是 **v0.4.3 的 bundle**,本轮未对 0.5.1 重做该六件的字面检索 ⇒ **本轮不援引、也不翻案**,标 [未知] 待重验。
- **代码库索引在云端**:对照程序 `Codebase status detection requires an access token.` 无 token 即降级 ⇒ "它有云端索引我们没本地索引"这类句子**两头都不成立**;真实差在 §2 第 14/15 行(请求带不带画像、用户能不能控制索引)。

## 6 取证边界(这轮能证到哪,哪些仍是"未判定")

- REA 静态重建的证据等级是 **partial**:`asar-analysis.json` 的 graph.coverage 自陈 `semantic_result_budget` 只剩 **10,145 B**;8,230 条 limitations 里 **8,211 条是 `resource_constraint`**(609×2 条正落在自有 `out/` 件);语义图 `child-process / configuration / request` 三族 **retained_relations 恰为 0**。⇒ "IPC 通道名、contextBridge 暴露面、子进程-配置-请求三族关系、真实端点、提示词与工具注册" **静态不可证**,不是不存在。
- `unknowns` 58,323 条里 **84.6% 是预算截断**而非代码不可解 ⇒ 当前等级应读作 **"未判定"**。
- 端点面假阳性:app.asar 的 248 枚 `endpoint` 节点里 **490/492 观测来自 `out/renderer/pdf.worker.min.mjs`,值是 PDF 字典键名**(`MCID/ColorTransform/FreeText`),URL host 聚合 = 0 个真实端点;真正带 `route`/`client.request` 语义的 272 条全在 SDK worker 里且**全是相对路径** ⇒ 端点必须走动态捕获,静态报表会造出假 API 面。
- REA 的 limitations 有**模板化输出**风险:`bundler_registrations`、`role_paths` 两维在 4,099 枚文件上全为 0,却仍逐条打印 "Webpack/Rspack factories were recovered…" ⇒ **引用自陈能力前必须核对对应数组维**。
- 完整性异常:9 枚 dll/exe 声明哈希 ≠ 实测(libvips×2、aoq-electron-sdk×3、winpty×4),已按 `record-and-continue` 记 `observed-untrusted`;签名核验腿本机 `inspect_signature available:false(unsupported_host)` ⇒ **Windows Authenticode 那一路未判定**,需换工具。
- 混淆还原的可复现性:`electronMain.js` 与 worker 均字符串数组混淆(自定义 base64 字母表小写在前 + 数组轮转 + 取值偏移 + 控制流平坦化);本册符号出自主席可复跑的还原器(47,099 条明文 / SDK 侧 1,331,115 B 明文),还原器在 D 盘 scratch,**不入库**(入库即把对方专有形态带进仓,违 §0.12 红线)。

## 7 本轮被推翻/纠正的判断(全部就地留痕,防下一个人重抄)

| 原判断 | 谁说的 | 现读结论 |
| --- | --- | --- |
| "Qoder 是 VS Code fork" | 上一轮会话开头假设 | **改口径**:asar 内无 `out/vs/**`、渲染层 Vite、IPC 字面通道 0 ⇒ 自研 Electron 壳 + 构建期内联 editor-core + **VS Code 兼容扩展宿主**(只为 debugpy) |
| "`app.asar.qoder-pending` ⇒ 0.5.1 未激活,跑的还是 0.4.11" | **主席本人(S0 初稿)** | **作废**:根 `resources/app.asar` 与 pending 件哈希逐字节相等,12 枚进程 20:37:12 起于根位 ⇒ 0.5.1 已激活。**教训:文件名形态不是生效证据,进程可执行路径 + 包体哈希才是** |
| "agent 循环必须另解那颗 `qoderclicn-worker-runtime-*.tgz`" | S7 席 | **修正**:全盘 `find` 无该 tgz;循环体就是 unpacked 那颗 34.8 MB `qoder-worker-runtime.obf.mjs`,且 S2 已还原出 38 工具/28 钩子/6 权限档 ⇒ tgz 只是安装期运输形态 |
| "`agent_engine.py` 7774 行零消费方 = 僵尸" | S5 席僵尸清单 | **改判**:它被 `routers/engine.py:38` import,挂在 `POST /api/engine/rpc` + `WS /api/engine/ws`(main.py:1282-1285),有 `tests/test_agent_engine.py` 与 conn_guard 加固 —— 真实形态是**"协议面已实现、仓内零客户端、2026-09-30 立票记'客户端已放弃'"**;判它"死码"会掩盖"挂着对外端点却没人接"这个更要紧的问题 |
| 同清单里 `capability_market/llm_metrics/mcp_tool_aggregator/token_compaction/model_router/agent_run_control/doom_loop` 等标"零消费" | S5 席(其扫描面刻意排除 `routers/`) | **逐条复算推翻**:llm_metrics 4 处、mcp_tool_aggregator 3 处(均在 routers/agents.py)、token_compaction 2 处(llm_gateway+llm 路由)、capability_market 2 处(routers/mcp.py:19-20)、model_router/llm_call_log_writer 各经 llm_gateway 内懒 import。⇒ 凡引用"零消费方"结论,**必须声明扫描面含不含 routers/** |
| "本地索引是我方优势" | 上一册口径 | **重写**:两边索引都在服务端;真实差是"请求带不带工作区画像 + 用户能不能控制索引"(§2 第 14/15 行) |

## 7b 本轮已落地的修复(2026-10-31,两席并行 + 主席复核改判)

| 项 | 做了什么 | 证据 |
| --- | --- | --- |
| ⑦ 定时四件套(部分) | 服务层早有 `list_tasks`/`remove_task`,缺的是工具面投影 ⇒ 新增 **`list_scheduled_tasks` / `cancel_scheduled_task`** 两枚 MCP 工具,handler 直接委托既有单例方法,零第二份调度判据 | `apps/ai-service/app/services/mcp_server.py`(工具声明 + `_TOOL_HANDLERS` 双键);`apps/ai-service/tests/test_scheduled_task_tools.py` 16 例 |
| 安全改判(主席裁) | 底层 `list_tasks(None)` **无归属过滤**、`remove_task` **无归属校验**,而创建动词 `schedule_task` 本就是 admin 专属 ⇒ 两个新动词一并进 `_ADMIN_ONLY_TOOLS`;测试锁「role 0 被拒 ∧ handler 零副作用」 | 同文件 `_ADMIN_ONLY_TOOLS` 注释 + `test_admin_only_denies_plain_user` |
| ② run 三维机读计数 | `agent_run_control` 新增 `_RunBudget` + `note_turn` / `can_continue` / `budget_snapshot`;在 `AgentLoopV2` **每轮唯一挂点**累计 turns/time,**credits 维取不到真实值故显式留空不编造** | `apps/ai-service/app/services/agent_run_control.py`;`agent_loop_v2.py` 迭代循环内 +10 行(带 try/except 降级,计数失败不影响主循环);`tests/test_run_budget_counter.py` 5 例 |
| 顺带 | 归正 `mcp_server.py` 里 **HEAD 既有**的 import 块 I001(不归正则含该文件的任何提交都会撞 ruff 门) | `ruff check` 0 错 |

**验证现读**:`pytest tests/test_scheduled_task_tools.py tests/test_run_budget_counter.py tests/test_api_tools_bridge.py` 连跑两轮 **54 passed**;串行单跑该文件 16 passed。  
**我抓到的两处席级缺陷**(留痕,防复发):① 执行席的反向自证**没还原干净**——`cancel_scheduled_task` 的 `_TOOL_HANDLERS` 注册键被删掉后未加回,导致"声明了没接线"恰好被它自己的测试抓住;② 席按其自定判据把新工具放在非 admin 面,与创建动词不同档 —— 由主席按安全口径改判。

## 8 下一步(已按 AGENTS §24 代裁,不是请示)

- 本册先立**判定面**;**派工顺序以 §3b 复核表为准,不以 §3 原表为准**(原表第 1 行是假缺口、第 5 行后端已有,照原表开工会给已交付的 D193 重做一遍)。当前真实序:④ automation 执行腿 → ② goals 机读预算 → ⑪ 12 档用途路由 → ⑥ 钩子扩面 →(可选)⑫ 收件箱内结算。
- 立票动作走 `scripts/live-doc-edit.mjs` + `plan-fields-extract`(侧车是第四种交代),**不在本轮顺手写台账**——本轮交付物是取证与判定,票面要按 §1 的编号/主键/交代三要素一次性立齐,免得产出第二套"僵尸票"。
- 0.4.9 与 0.5.1 的 SDK 差集已交 S8 件,但 **0.4.3 → 0.4.9 那一格仍无取证物**(本机已无 0.4.3 目录)⇒ 上一册凡依赖 0.4.3 字面检索的结论,状态一律读作 [未知],不得沿用。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
