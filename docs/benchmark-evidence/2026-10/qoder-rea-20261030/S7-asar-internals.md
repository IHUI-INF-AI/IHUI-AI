<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# S7 — Qoder CN 0.4.11 `app.asar` 内部能力取证

> 认领@2026-10-30/S7

对象:`G:\Qoder CN\.qoder-versions\0.4.11\resources\app.asar`,实测 189,505,973 B;[观察] 包内 6,420 个文件、展开 284,499,765 B、39 个 unpacked 引用、**6,420 个条目全部带 integrity 字段**。

## 1. 解包路径与降级说明

- [观察] 任务书给的 REA CLI 调用法(`/c/caches/npm/prefix/node_modules/rea-agents`)在本机**不存在**;实测全局根是 `D:\caches\npm\prefix\node_modules\rea-agents`。REA `extract-artifact` 无 `--output` 出口(只有 `--integrity-policy`),不接受指定落点 ⇒ 按任务书授权的兜底路径执行。
- [观察] 未联网:直接复用 rea-agents 内置的 `@electron/asar`(`D:\caches\npm\prefix\node_modules\rea-agents\node_modules\@electron\asar`)的 `lib/disk` 语义,自写 pickle 头解析器 `D:\DevEnv\Temp\ihui-scratch\qoder-asar-0.4.11-analysis\inspect-header.mjs`(头 magic=4、headerBlockSize=1,683,388、DATA_START=1,683,396)。
- [观察] 选择性展开 `extract.mjs` ⇒ `D:\DevEnv\Temp\ihui-scratch\qoder-asar-0.4.11\`(1,913 文件 / 132,249,893 B = `out/**` + 根 `package.json` + `node_modules/@qoder-ai/**`)。目标目录开工前实测不存在,未覆盖任何同名目录;`node_modules` 其余 4,513 项只登记在 `files.jsonl`(路径+size+abs offset),需要时定点抽。**全程零写入仓库树、零 git 写操作。**

## 2. Qoder 自有代码住在哪(实测树)

| 目录(asar 内路径) | 文件 | 字节 | 定性 |
| --- | --- | --- | --- |
| `out/main` | 40 | 18,574,099 | **主进程定制层**(全部自有) |
| `out/renderer/assets` | 1,643 | 91,000,289 | 工作台前端(Vite chunk) |
| `out/renderer/office-reader` | 41 | 13,716,571 | Office 文档预览自有实现 |
| `out/preload` | 5 | 6,290,920 | 插件视图运行时注入层 |
| `node_modules` | 4,513 | 152,516,350 | 第三方(含 6 个 `@qoder-ai` 自有件) |

- [观察] `out/main/` 自有文件:`index.js`(5,146B 引导)、`electronMain.js`(**17,828,077B 单包**)、`pluginHost.js`(57,298B)、`remoteControlProcess.js`(7,528B)、`dataDirectoryProcess.js`(6,644B)、`remoteSdkDaemonBridge.js`(1,213B)、`chunks/`(34 个 hash 名 chunk)。
- [观察] `out/preload/`:`index.cjs`(191,036B)、`pluginViewRuntime.cjs`(2,610,621B)、`pluginViewDiagramRuntime.cjs`(3,450,036B)。
- [观察] **本 asar 里没有 `out/vs/**`,也没有上游 `extensions/**`** ⇒ [推断] 这颗 `app.asar` 是独立的 "Agent workbench" Electron 应用(根 `package.json`: `name:"qoder-cn"`、`description:"Qoder - Agent workbench for human and AI software teams"`、`main:./out/main/index.js`、`desktopName:qoder-cn.desktop`),VS Code 内核在 `resources/` 同级目录,不属于本席射程。
- [观察] 自有依赖以 npm alias 形式打包:`@qoder-ai/qoder-agent-sdk` = `@ali/qoder-agent-sdk-next@1.0.56-alpha.6`、`@qoder-ai/qoder-cn-agent-sdk` = `@ali/qodercn-agent-sdk-next@1.0.56-alpha.6`;另有 `@ali/qoder-browser-use-sdk@0.4.2`、`@ali/qoder-config-service-sdk`、`@ali/qoder-crash-sdk@0.2.1`、`@arms/rum-electron`。`@qoder-space/*`(workbench / agent-runtime-core / collaboration-client / collaboration-core / editor-core / memory-migration / session-migration / artifact-preview / design-system)在 `package.json` 里版本为 `*` 且 asar `node_modules` 内**不存在** ⇒ [推断] 构建期内联进 `electronMain.js` 与 renderer chunk。
- [观察] 能力指纹依赖:`node-pty`(11.5MB 命令执行)、`@modelcontextprotocol/{client,node,server}`(v2 拆分件,14.3MB)、`croner`(定时任务)、`ws`+`eventsource`+`eventsource-parser`(流)、`hono`/`express`(内嵌 HTTP 面)、`jose`+`pkce-challenge`(OAuth/PKCE)、`sharp`+`@img`(图像)、`@xterm/xterm` v6(终端)、`pdfjs-dist`/`mammoth`/`xlsx`/`yauzl`(附件解析)、`electron-updater`、`proper-lockfile`、`undici`/`socks`/`https-proxy-agent`。可选件 `aoq-electron-sdk@1.2.0`(阿里内部 RTC,32.5MB)。

## 3. 逐能力模块定位

### 3.1 Agent 会话主循环 —— 不在 asar 内(本席最重要结论)

- [观察] `D:\DevEnv\Temp\ihui-scratch\qoder-asar-0.4.11\node_modules\@qoder-ai\qoder-cn-agent-sdk\dist\runtime-manifest.json`:`defaultTransport:"worker"`、`packaged:false`、`delivery:"install"`、`source:"qoder-cli-worker-runtime"`、urlTemplate `https://static.qoder.com.cn/qoder-cli-cn/dev/releases/1.1.75-hotfix.1/qoderclicn-worker-runtime-{target}.tgz`,`qoderCliVersion:"1.1.75-hotfix.1"`。**会话主循环体在按目标平台安装的 CLI worker runtime 里,asar 只有客户端 SDK 桥**(`dist\index.js` 229,303B,符号仅 `transport`×47/`canUseTool`×12/`mcpServers`×9/`appendSystemPrompt`×4/`maxTurns`×4/`includePartialMessages`×4/`settingSources`×5)。
- [观察] 线协议版本与目的分档在同包 `dist\protocol\index.js`(1,500B,未混淆,可直接读):`WIRE_PROTOCOL_VERSION="1.5.0"`;`QoderModelPurpose = Main/Plan/Task/Compact/Title/Suggestion/Generate/HookPrompt/Subagent/WebFetch/ImageGen/Compression/Utility`(**12 档用途→模型路由**);`HOST_ACTIONS = copy_text/helpful/not_helpful/create_branch_task/copy_markdown/add_reply_to_task`;settings 通道 `buildQoderCliFlagSettings` 只认 `securityScan.l1StaticCheck|l2LightweightScan|l3DeepScan` 与 `aiCodeTracking.installGitCommitHook`,以 `--settings <json>`  argv 传入。
- [观察] 流/事件名在主进程明文表:`assistant`、`chat_message`、`cloud_stream_disconnected`、`cloud_invalid_stream`、`adjacent_chunk_merge`(增量补丁合并)、`cancellation/canceled/cancelable`、`agent_result`、`agent_team_delegation_result`、`agent_team_invocation_result`、`chat_hook_turn_result`、`checkpoint_user_message_id`。
- [未知] SSE 与 WS 谁承载会话增量:asar 内无端点字面量,端点在 worker runtime 与 `QODERCN_VPC_ENDPOINT` 侧。

### 3.2 工具执行侧

- [观察] 内置工具 id(明文表逐条命中):`apply_patch`、`call_mcp_tool`、`SearchCodebase`、`SearchSymbol`、`SearchKnowledge`、`SearchWorkspace`、`MultiEdit`、`NotebookEdit`、`DeleteFile`、`ImageSearch`、`AskUserQuestion`、`TaskCreate/TaskGet/TaskList/TaskStop`、`SkillInventory`、`SkillEvolution`、`BrowserAutomation`/`browser_user_open_tabs`/`browser_user_claim_tab`/`browser_user_get_tab_context`/`browser_user_history`、`appshot_capture_result`。
- [观察] 命令执行 = `node-pty` + `cross-spawn`;renderer 侧 `xterm`×161(仅终端 UI,pty 在 main)。环境变量 `QODERCLI_PATH`、`QODER_AGENT_SHELL_PATH_CAPTURE_FILE`(shell 路径捕获)。
- [观察] 接受/拒绝面符号:`acceptEdits`、`rejectAll`、`RESTORE`、`historyRestored`、`history_restore_failed`、`SNAPSHOT_FAILED`/`SNAPSHOT_MISSING`。

### 3.3 上下文工程

- [观察] 组装点(明文标识符):`chatSessionSystemPromptPolicyMainService`、`systemPrompt`/`systemPromptAppend`/`systemPromptPolicy`/`systemPromptSections`、`resolveSystemPromptAppend`、`addRules`/`removeRules`/`replaceRules`、UI 文案 "Add rules for tools this Agent must not use."、"No additional rules. Runtime defaults apply."。
- [观察] 代码库索引 **是服务端能力,不是本地索引**:`fetchCodebaseStatus`/`getCodebaseStatus`/`getMergedCodebaseStatus`/`codebaseSearch`/`codebaseMainService`/`codebaseService`,事件 `codebase_search_started|phase_result|agent_result|result`,`.codebase-status`、`/codebaseStatusChecks`;错误文案 "Codebase status detection requires an access token."、"Codebase status API returned HTTP" ⇒ 无 token 即不可用。开关 `QODERCN_FEATURE_CODEBASE_BACKFLOW`。
- [观察] token 预算键:`thresholdTokens`、`rawMaxTokens`、`maxTokens`、`maxInputTokens`/`maxOutputTokens`/`maxThinkingTokens`,以及 snake 线协议校验 `check(max_input_tokens>0)`、`BYOK_PROFILE_MAX_INPUT_TOKENS_INVALID`。压缩态为 JSON Schema 校验的 `UnifiedCompactRuntimeState`(`bindingId`/`status` enum/`retryable`/`code`)、`UnifiedAttach.properties.token.maxLength`;命令 `/compact`,文案 "Conversation compacted."、"ChatSession compact execution handle recycled for model seed"。**具体阈值数字 [未知]**(在 worker runtime)。

### 3.4 记忆 / 知识 / 历史

- [观察] 长期记忆落到文件 `MEMORY.md`,并有 `Global memory`/`Long-term memory`/`Memory storage`/`:memory:`(SQLite 内存库) 与迁移台账表 `memory_migration_ledger`、`memory_import_target_files`;导入源文案 "Import Qoder IDE Quest memory"(= 从 VS Code 版 Qoder IDE 迁移)。同包 `@qoder-space/memory-migration`、`session-migration` 负责搬迁。
- [观察] 知识中心 `app-plugin:knowledge-center`;`SearchKnowledge` 工具在册。
- [观察] 文件历史 = `file-history-snapshot` + 上述 snapshot/restore 符号;工作树隔离 = `worktree` 数据域 + `restoreManagedWorktree`。

### 3.5 权限与审批

- [观察] 五档模式实锤:`default` / `acceptEdits` / `planMode` / `bypassPermissions` / `readOnly`;持久化实锤 `ALTER TABLE chat_sessions ADD COLUMN permission_mode TEXT`;变更链 `getPermissionMode`/`setPermissionMode`/`chatSessionSetPermissionMode`/`initialPermissionMode`/`permissionModeChanged`/`onDidChangePermissionMode`/`lastNotifiedPermissionMode`/`loop/permissionMode`(线协议路径)。错误码 `AGENT_PERMISSION_MODE_UNSUPPORTED`。
- [观察] 审批 UI/IPC:`Approval`/`Approve`、"Approve the requested local Qoder App preference change."、"About tool permissions"、"Close tool permission editor"、"Edit tool permissions"、"Normal session approval settings apply to the whole call.";插件面 `APP_PLUGIN_MCP_AUTO_APPROVE_INVALID|UNAVAILABLE`、`AGENT_MANAGEMENT_NOT_APPROVED`、`MCP_AGENT_NOT_APPROVED`。
- [观察] 风险判定有原生辅助器:`NativeRiskIdentityError` + `NATIVE_RISK_IDENTITY_{ABORTED,BRIDGE_FAILED,INVALID_OUTPUT,OUTPUT_TOO_LARGE,SPAWN_FAILED,STDERR_TOO_LARGE,TIMEOUT,VALUE_INVALID}`(spawn 子进程 + 输出限长 + 超时 ⇒ [推断] 独立身份/风险探针进程);数据字段 `riskLevel`、`/data/riskLevel`。隔离:进度窗显式 `webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}`(见 `out/main/index.js`)。

### 3.6 多席 / 协作 / 后台

- [观察] 内置角色人格:`agent:default`、`agent:qoder`、`agent:personal-coding`、`agent:frontend-builder`、`agent:product-architect`、`agent:qa-reviewer`、`agent:growth-copywriter`,自定义头像名 `custom:amy|anna|evan|siqi`;多席开关 `QODER_AGENT_TEAMS`、上限 `QODERCN_CLI_MAX_SUBAGENT_SPAWN_DEPTH`。
- [观察] 协作 = **REST 面**(`main-strings.txt` 行 2920+ 连续命中):`/api/v1/collaboration/projects[/{id}/members[/agent|/team]|/leave|/invitations]`、`/discussions[/{id}/messages|/events|/members|/invitations|/issue-links|/key-messages|/snapshot|/sources|/share-access|/agent-executions]`、`/runtime/{connections,discussions,projects,issue-executions}`、`/connections`、`/presence-connections`、`/me/notifications`、`/files`、`/agent-profiles/{profileId}/{avatar,workspaces,invocation-policy}`、`/agent-memberships/query`、`/project-invitations/{accept,preview}`、`/discussion-invitations/accept`。
- [观察] 后台/定时:`automation-task` 数据域 8 次迁移(`v44 add-v2-compatible-storage`/`v48 cut-over-v2-engine`/`v49 purge-legacy-tasks`/`v51 remove-description`/`v55 persist-merged-session-binding`/`v77 add-product-mode`)+ `scheduled-task` 域 + `croner` 依赖 + `BACKGROUND_TASK_SUMMARY`。会话宿主:`qoder-daemon-session-store`(29 次迁移,最大数据域)+ `out/main/remoteSdkDaemonBridge.js`(import `node:net`)、`qoder_daemon_remote_session_launches(cwd)`。跨端:`/sash/api/v1/ai-conversations/credits-summary`、`QODERCN_SESSION_TYPE`、`QODERCN_BUSINESS_PRODUCT`、`QODERCN_CLIENT_TYPE`。

### 3.7 MCP

- [观察] **两代 SDK 并存**:app 依赖 `@modelcontextprotocol/{client,node,server}@^2.0.0`(asar 内 1,178 文件),而 `qoder-cn-agent-sdk` 自带 `@modelcontextprotocol/sdk@^1.27.1`。
- [观察] lazy-loading 实锤 `QODER_MCP_LAZY` + `lazyLoad`;服务面符号 `builtinMcpMainService`/`builtinMcpService`/`getBuiltinMcpService`/`builtinMcpContext|Options|Selection`;名单治理 `allowedMcpServerNames`/`deniedMcpServers`/`enabledMcpServerNames`/`configuredMcpServerNames`/`installedMcpServers`/`inventoryMcpServers`/`allowMcpServers`/`mcpServerSetEnabled`;企业侧 `EnterpriseMcpGovernance`;存储域 `mcp-oauth-credentials` + 表 `mcp_connection_profiles(apphub_server_id)`;错误码族 60+(`MCP_HTTP_{UNAUTHORIZED,FORBIDDEN,RATE_LIMITED,SERVER_ERROR}`、`MCP_CONFIG_*`、`MCP_IPC_CHANGE(S)_INVALID`、`MCP_CONTEXT_STALE`)。工具入口 `call_mcp_tool`。

### 3.8 模型与配额

- [观察] BYOK 是**带目录与迁移的一等子系统**:事件 `BYOK_{catalog_load, catalog_stage, operation, execution, validation}_*`、`byok_{config_list,config_migration,profile_save,profile_delete}_result`、`BYOK_CAPABILITY_METADATA_{CONTEXT_WINDOWS,EFFORTS}_INVALID`(= 每档模型登记 contextWindow 与 effort 能力)、`BYOK_ACCOUNT_CHANGED`、`BYOK_THINKING_MIGRATION_FAILED`;effort 实键 `thinkingEffort`。计费在服务端(`/sash/api/v1/ai-conversations/credits-summary`、`/account/enterprise/credits-sharing`)。区域发现 `/algo/api/v2/service/region/endpoints` + `QODERCN_VPC_ENDPOINT`/`QODERCN_VPC_OPENAPI_ENDPOINT`。

### 3.9 可观测

- [观察] 三路并行:`@arms/rum-electron`(阿里 ARMS RUM,通道 `arms:rum-{bridge,custom-report,anr-heartbeat,anr-visibility}`,ANR 心跳+可见性)、`@opentelemetry/{api,sdk-logs}`、崩溃链 `@ali/qoder-crash-sdk` + `----CrashFeedback`/`----CrashOss`(直传 OSS)+ breakpad/minidump WASM(`minidump_bg.js`,内嵌 wasm base64)+ `AppPluginHostCrash` + `CRASH_ACCOUNT_FINGERPRINT_INVALID`。诊断 `DevV8MemoryProfiler`(`DEV_V8_MEMORY_PROFILING_*`)。

### 3.10 更新链

- [观察] `.qoder-versions` 字面量在册;Windows Launcher 交接为一等流程:`QODER_LAUNCHER_PROTOCOL=`、`Qoder Launcher.exe`、"Handing prepared candidate to Windows Launcher"、"Failed to restore Windows Launcher state";失败码 `WINDOWS_LAUNCHER_{APPLICATION_INVALID,HANDOFF_ACK_TIMEOUT,HANDOFF_REJECTED,INSTALLATION_MISMATCH,LOCALE_INCOMPATIBLE,LOCALE_UNAVAILABLE}`、`WINDOWS_FAST_UPDATE_{AUTHENTICODE_FAILED,INSUFFICIENT_DISK_SPACE:required=}`、`FAST_UPDATE_FALLBACK_RESULT` + `desktop_update_fast_update_fallback_result`;旗标 `--verify-authenticode`。`app-update.yml` + `electron-updater@6.8.9` 同时在册 ⇒ [推断] 双通道(全量 electron-updater 兜底 + fast-update 增量交 Launcher)。**`state.ini` 语义 [未知]**(在 `resources/launcher/`,归 S3 席)。

## 4. 混淆形态(取证方法学)

- [观察] `out/main/index.js` 与 `electronMain.js` 均经字符串数组混淆(自定义 base64 字母表小写在前 + 数组轮转 + 取值偏移 + 控制流平坦化)。本席写了还原器 `D:\DevEnv\Temp\ihui-scratch\qoder-asar-0.4.11-analysis\decode-strings.mjs`,对 `electronMain.js` 扫 49,853 个候选串、解出 **47,099 条唯一明文**(`main-strings.txt` 3,420,194 B;短行子集 `s.txt` 45,194 行)。上面所有符号均出自该明文表 ⇒ 定位法可复现、可增量。
- [观察] renderer(`out/renderer/assets/*.js`)与 `out/preload` **未做字符串混淆**(Vite 明文 chunk),但不含任何网络/协议字面量 ⇒ 网络全在 main。

## 5. 红线合规

只读 + 选择性解包到 `D:\DevEnv\Temp\ihui-scratch\qoder-asar-0.4.11{,-analysis}\`;仓库树内只写了本报告的认领文件;零 git 写操作;未 cat 任何 `*.dat`/`*.auth`,未摘录任何成段源码(只给路径、符号名、配置键、事件名与 ≤60 字符定位串)。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
