<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# Codex / ChatGPT 桌面客户端 + CLI —— 对话流程用户可见面穷举清单

取证时间：2026-09-28。全程只读；未修改 WindowsApps 与 `~/.codex` 任何内容。
产出物目录：`G:\IHUI-AI\.ihui-agent\tmp\v5-evidence\codex\`

## 取证物与读数（现读，勿照抄派单）

| 载体 | 路径 | 读法 | 结果 |
| --- | --- | --- | --- |
| 桌面 Electron asar | `C:/Program Files/WindowsApps/OpenAI.Codex_26.917.9434.0_x64__2p2nqsd0c76g0/app/resources/app.asar`（373,072,813 B） | 自写 `asar-helpers.mjs` 解 header + 定点抽条（未用外部 asar 包） | 15,596 条目全清单可读，**无 ACL 拒绝** |
| 渲染层 bundle | asar 内 `/webview/assets/*`（14,582 条 / 335 MB）、`/webview/index.html`、`/webview/detached-window.html` | 导出 41 个关键 chunk 到 `codex/bundle/`（35 MB）后本地正则 | 见下文 `x_renderer_literals.txt`（2,799 条唯一引号字面量） |
| 主进程 bundle | asar 内 `/.vite/build/*`（21 条 / 8.9 MB，最大 `main-BR_2NHW6.js` 3,877K） | 同上 | 已并入字面量池 |
| 原生菜单本地化 | asar 内 `/native-menu-locales/*.json`（64 语言，含 zh-CN/zh-TW/zh-HK） | 可直接 `--get` | **未展开逐条**（见「未做」） |
| 产物模板选择器 | `.../app/resources/artifact-template-picker/server.mjs`（30,990 B）+ `server.test.mjs` | 直接读 | 已提取 `ARTIFACT_KINDS` / `DESCRIPTION_KINDS` / `LIMITS` |
| CLI 二进制（独立安装） | `C:/Users/Administrator/AppData/Local/Programs/codex/codex.exe` 247 MB，`--version` = **codex-cli 0.137.0** | `--help` 全子命令 + 流式 printable-strings | `cli-help/all-subcommand-help.txt`（1,107 行）、`strings_cli.txt`（85,896 条唯一串 / 3.1 MB） |
| 桌面内置 CLI 与宿主 | `.../app/resources/`：`codex`(280 MB)、`codex.exe`(320 MB)、`codex-code-mode-host.exe`(70 MB)、`codex-windows-sandbox-service.exe`(53 MB)、`codex-command-runner.exe`(8.2 MB)、`rg.exe` | 只 list 未 strings | **未做二进制展开**（见「未做」） |
| 协议 schema | `codex app-server generate-json-schema --experimental --out <本地>` 生成 45 文件 / `codex_app_server_protocol.v2.schemas.json` **524 个 definition** | CLI 自带导出器，写到本任务临时目录 | `app-server-schema/`、`x_defnames.txt`、`x_enums_all.txt` |
| 事件面 | 解析 `ServerNotification.json`(64 变体)、`ServerRequest.json`(10 变体)、`ClientRequest.json`(112 变体) | 同上 | `x_server_notifications.txt`、`x_all_methods.txt` |

**出处缩写**：
`SCHEMA-v2` = `codex_app_server_protocol.v2.schemas.json`；
`SCHEMA-notify` = `ServerNotification.json`；`SCHEMA-req` = `ServerRequest.json`；
`SCHEMA-cmd-approve` = `CommandExecutionRequestApprovalParams.json`；
`STRINGS-CLI` = `strings_cli.txt`；
`B-INIT` = `bundle/webview__assets__app-initial-fc9a33fdda88.js`；
`B-PRIM` = `bundle/webview__assets__app-primary-a7ff54c980af.js`；
`B-SHARED` = `bundle/webview__assets__app-shared-dc8f183e4945.js`；
`B-MAIN` = `bundle/.vite__build__main-BR_2NHW6.js`；
`B-SRC` = `bundle/.vite__build__src-DldfpmrL.js`；
`B-ACT` = `bundle/webview__assets__agent-activity-item-620ef86d1785.js`；
`ATP` = `artifact-template-picker/server.mjs`。

---

## 0. 协议层词汇表（先立底座：下面 16 类的原文都挂在这套键名上）

### 0.1 ThreadItem 的 16 种类型（对话流里能被渲染的"块"的穷举）
`userMessage{clientId,content,id,type}` — 原文 — 出处 SCHEMA-v2::ThreadItem
`hookPrompt{fragments,id,type}` — 原文 — SCHEMA-v2::ThreadItem
`agentMessage{id,memoryCitation,phase,text,type}` — 原文 — SCHEMA-v2::ThreadItem
`plan{id,text,type}` — 原文 — SCHEMA-v2::ThreadItem
`reasoning{content,id,summary,type}` — 原文 — SCHEMA-v2::ThreadItem
`commandExecution{aggregatedOutput,command,commandActions,cwd,durationMs,exitCode,id,processId,source,status,type}` — 原文 — SCHEMA-v2::ThreadItem
`fileChange{changes,id,status,type}` — 原文 — SCHEMA-v2::ThreadItem
`mcpToolCall{arguments,durationMs,error,id,mcpAppResourceUri,pluginId,result,server,status,tool,type}` — 原文 — SCHEMA-v2::ThreadItem
`dynamicToolCall{arguments,contentItems,durationMs,id,namespace,status,success,tool,type}` — 原文 — SCHEMA-v2::ThreadItem
`collabAgentToolCall{agentsStates,id,model,prompt,reasoningEffort,receiverThreadIds,senderThreadId,status,tool,type}` — 原文 — SCHEMA-v2::ThreadItem
`webSearch{action,id,query,type}` — 原文 — SCHEMA-v2::ThreadItem
`imageView{id,path,type}` — 原文 — SCHEMA-v2::ThreadItem
`imageGeneration{id,result,revisedPrompt,savedPath,status,type}` — 原文 — SCHEMA-v2::ThreadItem
`enteredReviewMode{id,review,type}` — 原文 — SCHEMA-v2::ThreadItem
`exitedReviewMode{id,review,type}` — 原文 — SCHEMA-v2::ThreadItem
`contextCompaction{id,type}` — 原文 — SCHEMA-v2::ThreadItem

### 0.2 状态枚举原文
`TurnStatus` = `["completed","interrupted","failed","inProgress"]` — SCHEMA-v2
`ThreadStatus` 变体 = `notLoaded | idle | systemError | active{activeFlags}` — SCHEMA-v2
`CommandExecutionStatus` = `["inProgress","completed","failed","declined"]` — SCHEMA-v2
`CollabAgentStatus` = `["pendingInit","running","interrupted","completed","errored","shutdown","notFound"]` — SCHEMA-v2
`GuardianApprovalReviewStatus` = `["inProgress","approved","denied","timedOut","aborted"]` — SCHEMA-v2（描述原文："[UNSTABLE] Lifecycle state for an approval auto-review."）
`GuardianRiskLevel` = `["low","medium","high","critical"]` — SCHEMA-v2（"[UNSTABLE] Risk level assigned by approval auto-review."）
`GuardianUserAuthorization` = `["unknown","low","medium","high"]` — SCHEMA-v2
`AutoReviewDecisionSource` = `["agent"]` — SCHEMA-v2
`GuardianCommandSource` = `["shell","unifiedExec"]` — SCHEMA-v2
`PatchApplyStatus` / `WriteStatus` / `LocalShellStatus` / `DynamicToolCallStatus` / `McpToolCallStatus` / `CollabAgentToolCallStatus` / `ThreadUnsubscribeStatus` — 存在这些定义名 — SCHEMA-v2（**逐值未展开**，见「未做」）
`TurnItemsView` = `"notLoaded" | "summary" | "full"` — SCHEMA-v2；配套描述原文："`items` contains only a display summary for this turn." / "`items` contains every ThreadItem available from persisted app-server history for this turn."
`ThreadGoalStatus` = `["active","paused","blocked","usageLimited","budgetLimited","complete"]` — SCHEMA-v2
`NonSteerableTurnKind` = `["review","compact"]` — SCHEMA-v2

### 0.3 审批/沙箱/档位键名原文
`AskForApproval` 变体 = `"untrusted"/"on-failure"/"on-request"/"never"` ∪ `{granular}` — SCHEMA-v2
`SandboxMode` = `["read-only","workspace-write","danger-full-access"]` — SCHEMA-v2
`SandboxPolicy` 变体 = `dangerFullAccess | readOnly{networkAccess} | externalSandbox{networkAccess} | workspaceWrite{excludeSlashTmp,excludeTmpdirEnvVar,networkAccess,writableRoots}` — SCHEMA-v2
`NetworkAccess` = `["restricted","enabled"]` — SCHEMA-v2
`NetworkDomainPermission` = `["allow","deny"]` — SCHEMA-v2
`NetworkPolicyRuleAction` = `["allow","deny"]` — SCHEMA-cmd-approve
`NetworkApprovalProtocol` = `["http","https","socks5Tcp","socks5Udp"]` — SCHEMA-cmd-approve
`FileSystemAccessMode` = `["read","write","deny"]` — SCHEMA-cmd-approve
`FileSystemPath.kind` = `path | glob_pattern | special` — SCHEMA-cmd-approve
`FileSystemSpecialPath.kind` = `root | minimal | project_roots{subpath} | tmpdir | slash_tmp | unknown{path,subpath}` — SCHEMA-cmd-approve
`ApprovalsReviewer` = `["user","auto_review","guardian_subagent"]` — SCHEMA-v2（描述原文："Configures who approval requests are routed to for review. Examples include sandbox escapes, blocked network access, MCP approval prompts, and ARC escalations. Defaults to `user`. `auto_review` uses a …"）
`ReasoningEffort` = `["none","minimal","low","medium","high","xhigh"]` — SCHEMA-v2
`ReasoningSummary` 变体 = `"auto"/"concise"/"detailed"` ∪ `"none"` — SCHEMA-v2
`ThreadMemoryMode` = `["enabled","disabled"]` — SCHEMA-v2
`ReviewDelivery` = `["inline","detached"]` — SCHEMA-v2（描述原文："Where to run the review: inline (default) on the current thread or detached on a new thread (returned in `reviewThreadId`)."）
`ReviewTarget` 变体 = `uncommittedChanges | baseBranch{branch} | commit{sha,title} | custom{instructions}` — SCHEMA-v2
`PlanType`（订阅档）= `["free","go","plus","pro","prolite","team","self_serve_business_usage_based","business","enterprise_cbp_usage_based","enterprise","edu","unknown"]` — SCHEMA-v2
`ContentItem` = `input_text{text} | input_image{detail,image_url} | output_text{text}` — SCHEMA-v2
`CollaborationMode` = `{mode: ModeKind, settings: Settings}`；`collaborationMode/list` 返回档 = `["plan","default"]`，其内 mask 的 effort = `["none","minimal","low","medium","high","xhigh"]` — SCHEMA-v2 / `CollaborationModeListResponse.json`
`ActivePermissionProfile` = `{id, extends}`；描述原文："Identifier from `default_permissions` or the implicit built-in default, such as `:workspace` or a user-defined `[permissions.<id>]` profile." — SCHEMA-v2
`CommandAction.kind` = `["read","listFiles","search","unknown"]` — SCHEMA-cmd-approve
`ParsedCommand.kind` = `["read","list_files","search","unknown"]` — `ExecCommandApprovalParams.json`（注意 v1/v2 命名不同形：`listFiles` vs `list_files`）
`FileChange.kind` = `["add","delete","update"]` — `ApplyPatchApprovalParams.json`
`ConfigReadResponse` 里出现的枚举族（一次取回全部配置档位）= `"auto"|"prompt"|"approve"` / `"user"|"auto_review"|"guardian_subagent"` / `"untrusted"|"on-failure"|"on-request"|"never"` / `"total"|"body_after_prefix"` / `"mdm"|"system"|"enterpriseManaged"|"user"|"project"|"sessionFlags"|"legacyManagedConfigTomlFromFile"|"legacyManagedConfigTomlFromMdm"` / `"chatgpt"|"api"` / `"auto"|"concise"|"detailed"` / `"none"` / `"read-only"|"workspace-write"|"danger-full-access"` / `"low"|"medium"|"high"` / `"disabled"|"cached"|"live"` — `ConfigReadResponse.json`

### 0.4 审批弹窗的按钮集合（逐字，含描述原文）
`"accept"` — "User approved the command." — SCHEMA-cmd-approve::CommandExecutionApprovalDecision
`"acceptForSession"` — "User approved the command and future prompts in the same session-scoped approval cache should run without prompting." — 同上
`"acceptWithExecpolicyAmendment" { execpolicy_amendment: string[] }` — "User approved the command, and wants to apply the proposed execpolicy amendment so future matching commands can run without prompting." — 同上
`"applyNetworkPolicyAmendment" { network_policy_amendment }` — "User chose a persistent network policy rule (allow/deny) for this host." — 同上
`"decline"` — "User denied the command. The agent will continue the turn." — 同上
`"cancel"` — "User denied the command. The turn will also be immediately interrupted." — 同上

### 0.5 服务端→UI 事件全名（64 条，逐条）
`error` / `thread/started` / `thread/status/changed` / `thread/archived` / `thread/unarchived` / `thread/closed` / `skills/changed` / `thread/name/updated` / `thread/goal/updated` / `thread/goal/cleared` / `thread/settings/updated` / `thread/tokenUsage/updated` / `turn/started` / `hook/started` / `turn/completed` / `hook/completed` / `turn/diff/updated` / `turn/plan/updated` / `item/started` / `item/autoApprovalReview/started` / `item/autoApprovalReview/completed` / `item/completed` / `item/agentMessage/delta` / `item/plan/delta` / `command/exec/outputDelta` / `process/outputDelta` / `process/exited` / `item/commandExecution/outputDelta` / `item/commandExecution/terminalInteraction` / `item/fileChange/outputDelta` / `item/fileChange/patchUpdated` / `serverRequest/resolved` / `item/mcpToolCall/progress` / `mcpServer/oauthLogin/completed` / `mcpServer/startupStatus/updated` / `account/updated` / `account/rateLimits/updated` / `app/list/updated` / `remoteControl/status/changed` / `externalAgentConfig/import/completed` / `fs/changed` / `item/reasoning/summaryTextDelta` / `item/reasoning/summaryPartAdded` / `item/reasoning/textDelta` / `thread/compacted` / `model/rerouted` / `model/verification` / `warning` / `guardianWarning` / `deprecationNotice` / `configWarning` / `fuzzyFileSearch/sessionUpdated` / `fuzzyFileSearch/sessionCompleted` / `thread/realtime/started` / `thread/realtime/itemAdded` / `thread/realtime/transcript/delta` / `thread/realtime/transcript/done` / `thread/realtime/outputAudio/delta` / `thread/realtime/sdp` / `thread/realtime/error` / `thread/realtime/closed` / `windows/worldWritableWarning` / `windowsSandbox/setupCompleted` / `account/login/completed`
— 全部出处 SCHEMA-notify（原文为 `"method": {"const": "…"}`）

### 0.6 服务端→UI 的"要用户回答"请求（10 条）
`item/commandExecution/requestApproval` / `item/fileChange/requestApproval` / `item/tool/requestUserInput` / `mcpServer/elicitation/request` / `item/permissions/requestApproval` / `item/tool/call` / `account/chatgptAuthTokens/refresh` / `attestation/generate` / `applyPatchApproval` / `execCommandApproval` — SCHEMA-req

### 0.7 UI→服务端可发起的方法（112 条全量，逐条）
`initialize` / `thread/start` / `thread/resume` / `thread/fork` / `thread/archive` / `thread/unsubscribe` / `thread/increment_elicitation` / `thread/decrement_elicitation` / `thread/name/set` / `thread/goal/set` / `thread/goal/get` / `thread/goal/clear` / `thread/metadata/update` / `thread/settings/update` / `thread/memoryMode/set` / `memory/reset` / `thread/unarchive` / `thread/compact/start` / `thread/shellCommand` / `thread/approveGuardianDeniedAction` / `thread/backgroundTerminals/clean` / `thread/rollback` / `thread/list` / `thread/search` / `thread/loaded/list` / `thread/read` / `thread/turns/list` / `thread/turns/items/list` / `thread/inject_items` / `skills/list` / `skills/extraRoots/set` / `hooks/list` / `marketplace/add` / `marketplace/remove` / `marketplace/upgrade` / `plugin/list` / `plugin/installed` / `plugin/read` / `plugin/skill/read` / `plugin/share/save` / `plugin/share/updateTargets` / `plugin/share/list` / `plugin/share/checkout` / `plugin/share/delete` / `app/list` / `fs/readFile` / `fs/writeFile` / `fs/createDirectory` / `fs/getMetadata` / `fs/readDirectory` / `fs/remove` / `fs/copy` / `fs/watch` / `fs/unwatch` / `skills/config/write` / `plugin/install` / `plugin/uninstall` / `turn/start` / `turn/steer` / `turn/interrupt` / `thread/realtime/start` / `thread/realtime/appendAudio` / `thread/realtime/appendText` / `thread/realtime/stop` / `thread/realtime/listVoices` / `review/start` / `model/list` / `modelProvider/capabilities/read` / `experimentalFeature/list` / `permissionProfile/list` / `experimentalFeature/enablement/set` / `remoteControl/enable` / `remoteControl/disable` / `remoteControl/status/read` / `remoteControl/pairing/start` / `remoteControl/client/list` / `remoteControl/client/revoke` / `collaborationMode/list` / `mock/experimentalMethod` / `environment/add` / `mcpServer/oauth/login` / `config/mcpServer/reload` / `mcpServerStatus/list` / `mcpServer/resource/read` / `mcpServer/tool/call` / `windowsSandbox/setupStart` / `windowsSandbox/readiness` / `account/login/start` / `account/login/cancel` / `account/logout` / `account/rateLimits/read` / `account/sendAddCreditsNudgeEmail` / `feedback/upload` / `command/exec` / `command/exec/write` / `command/exec/terminate` / `command/exec/resize` / `process/spawn` / `process/writeStdin` / `process/kill` / `process/resizePty` / `config/read` / `externalAgentConfig/detect` / `externalAgentConfig/import` / `config/value/write` / `config/batchWrite` / `configRequirements/read` / `account/read` / `fuzzyFileSearch` / `fuzzyFileSearch/sessionStart` / `fuzzyFileSearch/sessionUpdate` / `fuzzyFileSearch/sessionStop` — SCHEMA-cmd（`ClientRequest.json`）

### 0.8 任务书点名的几个"专项键"是否取证到
`model_reasoning_summary` — 原文 — B-INIT（配置键字面量，出现于 settings 面）
`conversation_detail_mode` — **未在 asar 字面量池与 CLI strings 中取到该字面量**；取到的是协议侧 `TurnItemsView`(`notLoaded|summary|full`) 与 `ReasoningSummary`(`auto|concise|detailed|none`) 两型，见 §2
`thread_history_projection_state` — **未取证到该字面量**；取到的相邻形态是 `Thread.itemsView`/`Turn.itemsView`、`thread/resume` 的 `initialTurnsPage`、以及 `mapResumeResponse(q,{fallbackCwd,resolvedPermissions})` 原文（B-MAIN / B-INIT）
`followUpQueueMode` — **未取证到该驼峰字面量**（asar 池里无此串）；队列/转向的实际可见原文见 §11
`auto_review` — 原文 `"user" | "auto_review" | "guardian_subagent"` — STRINGS-CLI:17854 与 SCHEMA-v2::ApprovalsReviewer
`prefix_rule` — 原文 `rules prefix_rules cannot be empty` / `rules prefix_rule at index ` / `prefix_rule(pattern=` / `prefix_rules` — STRINGS-CLI:18826 / 18827 / 19385(≈21935) / 18881
`network_proxy` — 作为 feature 名出现：`network_proxy  experimental  false` — `codex features list` 输出
`.git` / `.codex` / `.agents` 强制只读 — **未取证到该三者的"强制只读"字面量**；取到的相邻原文见 §8

---

## 1. 消息气泡与内容块

`userMessage{clientId,content,id,type}` — 原文（键名） — SCHEMA-v2::ThreadItem
`agentMessage{id,memoryCitation,phase,text,type}` — 原文（键名；`phase` 与 `memoryCitation` 是气泡上的附加位） — SCHEMA-v2::ThreadItem
`plan{id,text,type}` — 原文 — SCHEMA-v2::ThreadItem
`reasoning{content,id,summary,type}` — 原文 — SCHEMA-v2::ThreadItem
`imageView{id,path,type}` — 原文（对话内图片块） — SCHEMA-v2::ThreadItem
`imageGeneration{id,result,revisedPrompt,savedPath,status,type}` — 原文（生成图块，带 `revisedPrompt`） — SCHEMA-v2::ThreadItem
`webSearch{action,id,query,type}` — 原文 — SCHEMA-v2::ThreadItem
`image_detail_original` — 原文（feature 名，`removed false`） — `codex features list`
`chatgpt_math_blocks` — 原文（chunk 文件名，LaTeX 渲染面） — asar `/webview/assets/chatgpt_math_blocks-9905574f666f.js`
`chatgpt-mermaid-preview-actions` — 原文（chunk 文件名，Mermaid 预览操作条） — asar `/webview/assets/chatgpt-mermaid-preview-actions-771ea4ab6d90.js`
`chatgpt-code-block` / `chatgpt-code-block-editor` / `chatgpt-code-block-highlighting` — 原文（chunk 名，代码块三件套） — asar `/webview/assets/chatgpt-code-block-*`
`chatgpt-sources-message` / `chatgpt-sources-side-panel-tab` — 原文（chunk 名，引用来源消息 + 侧栏标签） — asar `/webview/assets/`
`chatgpt-image-lightbox` / `chatgpt-video-lightbox` — 原文（chunk 名） — asar `/webview/assets/`
`chatgpt-generated-image-favorite` — 原文（chunk 名） — asar `/webview/assets/`
`ComposedChart` — 原文（chunk 名，2,315K；图表渲染） — asar `/webview/assets/ComposedChart-1bcabe87b902.js`
`workbook` — 原文（chunk 名，2,335K；表格产物） — asar `/webview/assets/workbook-bf4a6e3bcea2.js`
`mapbox-gl` — 原文（chunk 名，1,690K；地图块） — asar `/webview/assets/mapbox-gl-*.js`
artifact 卡（结果卡）一族 i18n 键名：
`artifactTemplate.resultCard.label` / `.open` / `.actions` / `.viewDetails` / `.edit` / `.openInFinder` / `.document` / `.presentation` / `.spreadsheet` / `.site` / `.googleDoc` / `.googleSlides` / `.googleSheet` / `.image` / `.email` / `.slack` / `.editPrompt` / `.useDocumentPrompt` / `.usePresentationPrompt` — 原文（键名逐条） — B-INIT
`artifact.kind` / `artifact.import_kind` / `artifact.lifecycle_kind` / `artifact.produced_file_count` / `artifact.edited_file_count` / `artifact.timing_source` / `artifact_renderer` / `artifact_preview` / `artifact_parsed` / `artifact-list` / `artifacts_folder` / `artifact-template` / `artifact-template.json` / `artifact-template-skill-manifests` / `artifact_generation` / `artifact-direct-comment` — 原文（键名/通道名逐条） — B-INIT
`Artifact annotation: ${…}` — 原文（模板串） — B-INIT
`Artifact Session viewer reconciliation timed out.` — 原文 — B-MAIN
`Artifact document compaction thresholds must be positive` — 原文 — B-MAIN
**未取证到**：Mermaid/LaTeX 折叠标题的可见原文（只取到 chunk 名，未展开该 chunk 内字面量）。

---

## 2. 推理摘要展示

`reasoning{content,id,summary,type}` — 原文 — SCHEMA-v2::ThreadItem
`item/reasoning/summaryTextDelta` / `item/reasoning/summaryPartAdded` / `item/reasoning/textDelta` — 原文（三条流式事件名，摘要与全文分道） — SCHEMA-notify
`ReasoningSummary` = `auto | concise | detailed | none` — 原文枚举 — SCHEMA-v2
`ReasoningSummary` 描述原文："A summary of the reasoning performed by the model. This can be useful for debugging and understanding the model's reasoning process." — SCHEMA-v2
`ReasoningEffort` = `none | minimal | low | medium | high | xhigh` — 原文枚举 — SCHEMA-v2
`model_reasoning_summary` — 原文（配置键字面量） — B-INIT
`reasoning_recap` / `reasoning_ended` / `reasoning_cancelled` — 原文（分析事件名） — B-INIT
`reasoning summaries` — 原文（截断窗口里可见的选项词，同窗含 `reasoning effort`） — STRINGS-CLI:11322 / 37185
`Override the reasoning effort for subsequent turns.` — 原文 — STRINGS-CLI:16160 / 16974
`Override the reasoning summary for subsequent turns.` — 原文 — STRINGS-CLI:16974
`Reasoning efforts: ` / `Reasoning effort ` / `. Supported reasoning efforts: ` — 原文 — STRINGS-CLI:20028 / 20055 / 20056
`Choose a specific model and reasoning level (current: ` — 原文 — B-INIT(实为 STRINGS-CLI:≈34545 区)
`Select Reasoning Level for ` — 原文 — STRINGS-CLI:≈34516 区
`reasoning_levelssupported_reason` / `supported_reasoning` — 原文（模型能力位，串在截断窗内） — STRINGS-CLI:11277
`Transcript parts update targets a non-reasoning item` — 原文 — B-INIT
`auto_review_mode_reasoning_level` — 原文（键名片段，截断窗内） — STRINGS-CLI:11277
**折叠标题原文未取证到**（如 "Thought for 12s" 这类字面量在本次 strings 抽取窗内未出现；需展开 `app-primary`/`app-shared` 的推理块组件字面量）。

---

## 3. 工具 / 命令调用行

`commandExecution{…,command,commandActions,cwd,durationMs,exitCode,processId,source,status,type}` — 原文（一行命令的全部可渲染字段） — SCHEMA-v2::ThreadItem
`CommandExecutionStatus` = `inProgress | completed | failed | declined` — 原文 — SCHEMA-v2
`CommandExecutionSource` = `agent | userShell | unifiedExecStartup | unifiedExecInteraction` — 原文 — SCHEMA-v2
`command/exec/outputDelta` + `CommandExecOutputDeltaNotification.stream` = `stdout | stderr` — 原文（边跑边出的流） — SCHEMA-notify / SCHEMA-v2
`item/commandExecution/outputDelta` / `item/commandExecution/terminalInteraction` — 原文（工具行内增量与"终端交互"事件） — SCHEMA-notify
`item/fileChange/outputDelta` / `item/fileChange/patchUpdated` — 原文（diff 边写边更新） — SCHEMA-notify
`item/mcpToolCall/progress` — 原文 — SCHEMA-notify
`mcpToolCall{arguments,durationMs,error,id,mcpAppResourceUri,pluginId,result,server,status,tool,type}` — 原文 — SCHEMA-v2::ThreadItem
`dynamicToolCall{arguments,contentItems,durationMs,id,namespace,status,success,tool,type}` — 原文 — SCHEMA-v2::ThreadItem
`Running ` — 原文（TUI 命令行前缀） — STRINGS-CLI:35085
`Applying` / `Applying '` — 原文 — STRINGS-CLI:18604 / 12138
`Searching` — 原文 — STRINGS-CLI:35206
`Reading ` / `Reading additional input from stdin...` — 原文 — STRINGS-CLI:21572（前缀 `Reading` 见同文件多处）
`Reviewing ` / `Reviewing approval request` / `Reviewing ` + ` approval requests` — 原文 — STRINGS-CLI:34529 区 + ≈34660
`Approved` / `Denied` / `Aborted` / `Timed out` — 原文（枚举 `approved|denied|aborted|timedOut` 见 §0.2；桌面侧独立字面量 `Aborted`、`Timed out`） — STRINGS-CLI / B-MAIN
`risk level` 展示位 — 原文枚举 `low | medium | high | critical`（`GuardianRiskLevel`）+ `rationale`（自由文本，同 payload） — SCHEMA-v2::GuardianApprovalReview
`<unrenderable guardian action>` — 原文（无法渲染的守护动作兜底串） — STRINGS-CLI:≈34660 区
`<no message>` — 原文（空消息兜底） — STRINGS-CLI:≈34850 区
`commandActions[] -> CommandAction{kind: read|listFiles|search|unknown}` — 原文（命令被解析成的动作类别） — SCHEMA-cmd-approve
`ToolRequestUserInputParams.questions[] -> ToolRequestUserInputQuestion.options[] -> ToolRequestUserInputOption` — 原文（工具反过来问用户的多选/单选） — SCHEMA-v2
`/raw [on|off]` — 原文（TUI 原始事件流开关） — STRINGS-CLI:≈34690 区
`Usage: /keymap [debug]` — 原文 — STRINGS-CLI 同上区

---

## 4. 终端与输出

`item/commandExecution/terminalInteraction` + `TerminalInteractionNotification` — 原文（终端交互回传事件） — SCHEMA-notify
`command/exec/resize` / `process/resizePty` / `command/exec/write` / `process/writeStdin` / `command/exec/terminate` / `process/kill` — 原文（终端尺寸/输入/终止） — `ClientRequest.json`
`terminal_resize_reflow` — 原文 feature，stage `experimental`，effective `true` — `codex features list`
`unified_exec` / `unified_exec_zsh_fork` / `shell_snapshot` / `shell_tool` / `shell_zsh_fork` — 原文 feature 名 — 同上
`thread/backgroundTerminals/clean` — 原文（后台终端清理） — `ClientRequest.json`
`thread/shellCommand` — 原文 — 同上
`--no-alt-screen` — 原文描述："Disable alternate screen mode" / "Runs the TUI in inline mode, preserving terminal scrollback history." — `cli-help/all-subcommand-help.txt`
`chatgpt-conversation-transcript` — 原文（chunk 名，全屏 transcript 面） — asar `/webview/assets/chatgpt-conversation-transcript-*.js`
`Inline transcript message shown when a workspace owner reaches a usage limit.` — 原文（该串是 i18n 的**描述注释**，证明 transcript 内联消息这一形态存在） — B-PRIM
`Copied last message to clipboard` — 原文 — STRINGS-CLI:≈34490 区
`Copy failed: ` / `No agent response to copy` / `Cannot copy that response after rewinding. Only the most recent " responses are available to /copy.` — 原文 — 同上区
`Ctrl+L is disabled while a task is in progress.` — 原文 — 同上区
`Waiting for a keypress...` — 原文 — STRINGS-CLI:35121
`attach_image path=` / `pasted image size=` / ` format=` / `failed to paste image: ` / `Failed to paste image: ` — 原文（贴图入终端） — STRINGS-CLI:≈34482 区
`event tui\src\chatwidget\interaction.rs:86` / `:77` — 原文（源路径随 panic/log fmt 落进二进制，可定位键位处理文件） — STRINGS-CLI 同区
`command/exec` 描述原文："Shell command string evaluated by the thread's configured shell. Unlike `command/exec`, this intentionally preserves shell syntax such as pipes, redirects, and quoting. This runs unsandboxed with full access rather than inheriting the thread sandbox policy." — STRINGS-CLI:15978
`The final `command/exec` response is deferred until the process exits and is sent only after all `command/exec/outputDelta` notifications for that connection have been emitted.` — 原文 — STRINGS-CLI:16943
`Process exit code.` / `Buffered stdout capture.` — 原文（字段描述） — STRINGS-CLI:16943 同窗

---

## 5. diff 与 Review 面板

`enteredReviewMode{id,review,type}` / `exitedReviewMode{id,review,type}` — 原文（进入/退出 review 的两个流内块） — SCHEMA-v2::ThreadItem
`turn/diff/updated` + `TurnDiffUpdatedNotification` — 原文 — SCHEMA-notify
`fileChange{changes,id,status,type}`；`FileUpdateChange{diff,kind,path}`；`FileChange.kind` = `add|delete|update` — 原文 — SCHEMA-v2 / `ApplyPatchApprovalParams.json`
`item/fileChange/patchUpdated` — 原文（patch 中途刷新） — SCHEMA-notify
**Review 源档位原文（CLI 侧，与桌面 preset 一一对上）**：
`Review uncommitted changes` / `Review against a base branch` / `Custom review instructions` / `Select a review preset` / `Type instructions and press Enter` — 原文 — STRINGS-CLI:≈34665 区
`Review staged, unstaged, and untracked changes` — 原文（`codex review --uncommitted` 的帮助文） — `cli-help/...`
`Review the changes introduced by a commit`（`--commit <SHA>`）/ `Review changes against the given base branch`（`--base <BRANCH>`）/ `Optional commit title to display in the review summary`（`--title <TITLE>`）/ `Custom review instructions. If `-` is used, read from stdin`（`[PROMPT]`） — 原文 — `cli-help/...`
`ReviewTarget` 变体逐字 = `uncommittedChanges | baseBranch{branch} | commit{sha,title} | custom{instructions}` — SCHEMA-v2
**源档位 `Unstaged/Staged/Commit/Branch/Last turn` 这五个英文标签本身：未取证到**（取到的是上面这套短语与枚举名）。
`ReviewDelivery` = `inline | detached`；描述原文："Where to run the review: inline (default) on the current thread or detached on a new thread (returned in `reviewThreadId`)." — SCHEMA-v2 / STRINGS-CLI:16960
`Review was interrupted. Please re-run /review and wait for it to complete.` — 原文 — STRINGS-CLI:23493
`! reviews); interrupting the turn.` — 原文（截断窗内） — STRINGS-CLI:20554
`/diff` 相关：`` `/diff`  _not inside a git repository_ `` / `Failed to compute diff: ` / `Failed to compute diff: workspace command runner unavailable` / `/tmp/test.txt` `/tmp/test2.txt` `/tmpMemory maintenance` — 原文 — STRINGS-CLI:≈34680 区
`codex apply <TASK_ID>` — 原文描述："Apply the latest diff produced by Codex agent as a `git apply` to your local working tree [aliases: a]" — `cli-help/...`
逐条/逐文件 accept·reject·stage·revert·commit·push·PR 徽章：**未取证到对应英文原文**（本轮只取到 §0.4 的审批决定集与 §7/§15 的 worktree 迁移文案）。
`turn/rollback` 描述原文："The number of turns to drop from the end of the thread. Must be >= 1." — STRINGS-CLI:16972
`Thread.ephemeral` / `Thread.gitInfo` / `Thread.preview` — 原文字段 — SCHEMA-v2::Thread

---

## 6. 计划与任务

`plan{id,text,type}` — 原文 — SCHEMA-v2::ThreadItem
`turn/plan/updated` + `TurnPlanUpdatedNotification`；`item/plan/delta` + `PlanDeltaNotification`；定义 `TurnPlanStep`、`TurnPlanStepStatus` — 原文 — SCHEMA-notify / SCHEMA-v2
`plan-implementation` — 原文（活动条目 kind） — B-ACT
`automation-plan-summary-update` — 原文 — B-INIT
`review_latest_plans` — 原文（键名） — B-INIT
`Implement this plan?` — 原文（流内确认问句） — STRINGS-CLI:≈34655 区
`Plan mode prompt: ` / `plan-mode-prompt` — 原文 — STRINGS-CLI:11322 窗 / ≈34665 区
`Plan mode unavailable right now.` — 原文 — STRINGS-CLI:≈34678 区
`Always use  in Plan mode.` / `user-chosen Plan override (` / `built-in Plan default (no reasoning)` / `built-in Plan default` / `built-in Plan default]` — 原文 — STRINGS-CLI:≈34540 区
`Set the global default reasoning level and the Plan mode override. This replaces the current ` — 原文 — 同上
`failed to persist plan mode reasoning effort` / `Failed to save Plan mode reasoning effort: ` — 原文 — STRINGS-CLI:13484
`Apply reasoning change` / `Apply to Plan mode override` / `Apply to global default and Plan mode override` — 原文 — STRINGS-CLI:≈34545 区
`Compact task summaries must contain between 1 and 60 characters` / `Compact task summaries must include their completed turn key` — 原文 — B-MAIN
`Also fill the structured compactSummary field with a concise completion summary of at most 60 characters for a small activity pill. Do not refer to the assistant or the user; state the completed action or result directly.` — 原文（活动小丸文案的生成约束，证明 UI 上有 60 字 pill） — B-SRC
`Fill the structured description field with a compact, search-oriented summary (up to 100 characters) of the thread's current purpose.` — 原文 — B-SRC
`.trim().slice(0,280)` 与 `.trim().slice(0,60)` 配对出现，形如 `{summary, compactSummary}` — 原文（双档截断） — B-SRC
`collaborationMode/list` 返回 mode = `["plan","default"]` — 原文 — `CollaborationModeListResponse.json`
`/goal` 一族：`Usage: /goal <objective>` / `Example: /goal improve benchmark coverage` / `Goal objective must not be empty.` / `/goal ` / `The session must start before you can set a goal.` / `The session must start before you can change a goal.` — 原文 — STRINGS-CLI:≈34685 区；事件 `thread/goal/updated`、`thread/goal/cleared`；状态 `ThreadGoalStatus`（§0.2）；feature `goals` = stable/true。
**`/review` findings 的优先级形态**：未取证到"优先级"专名；最接近的是 `GuardianRiskLevel = low|medium|high|critical` 与 `GuardianUserAuthorization = unknown|low|medium|high`。

---

## 7. 子代理与并行

`collabAgentToolCall{agentsStates,id,model,prompt,reasoningEffort,receiverThreadIds,senderThreadId,status,tool,type}` — 原文（含"发送线程/接收线程"多路形态） — SCHEMA-v2::ThreadItem
`CollabAgentStatus` = `pendingInit | running | interrupted | completed | errored | shutdown | notFound` — 原文 — SCHEMA-v2
定义名 `CollabAgentState`、`CollabAgentTool`、`CollabAgentToolCallStatus`、`SubAgentSource`、`SubagentMigration`、`AgentPath` — 原文 — SCHEMA-v2（**逐值未展开**）
`subagent-activity` — 原文（活动条目 kind） — B-ACT
`subagent-start` / `subagent-stop` — 原文（hook 事件名） — STRINGS-CLI:22490 窗 / ≈34886 区
`When a subagent is created` / `Right before a subagent ends its turn` / `Right before Codex ends its turn` — 原文（hook 时机的人类可读档名） — STRINGS-CLI:≈34886 区
`spawn_agent could not resolve the child model for service tier validation` — 原文 — STRINGS-CLI:20052
`Full-history forked agents inherit the parent agent type, model, and reasoning effort; omit agent_type, model, and reasoning_effort, or spawn without a full-history fork.` — 原文 — STRINGS-CLI:20052 同窗
`Reasoning effort requested for the spawned agent, when applicable.` — 原文 — STRINGS-CLI:17148
`spawn_agent spawn agent subagent sub-agent delegate delegation parallel work worker explorer no-apps fork model reasoning` — 原文（工具搜索词表，含 `explorer` 角色名） — STRINGS-CLI:20786
`send_input send message existing agent subagent follow up interrupt redirect queue target` — 原文（含 `queue` 一词） — STRINGS-CLI:20802
`- This agent's reasoning effort is set to ` / `&` and its reasoning effort is set to ` — 原文（角色档描述模板） — STRINGS-CLI:19636 / 19639
`Thread.agentNickname` / `Thread.agentRole`（均 `string|null`） — 原文 — SCHEMA-v2::Thread
`identicon` — **未取证到该字面量**（昵称/角色字段在位，图形身份标识名未出现在抽取窗内）。
`/agents`（6 次）、`/agent`（4 次） — 原文（斜杠命令名，计数现读） — STRINGS-CLI 频次统计
`agentMention` — 原文 — B-INIT
`agent-turn-complete` / `TurnNotSteerable` — 原文（事件/键名） — STRINGS-CLI:11322 窗 / 11124 窗
`Agent turn complete` — 原文 — STRINGS-CLI:≈34665 区
feature：`multi_agent` = stable/true；`multi_agent_v2` = under development/false；`enable_fanout` = under development/false；`guardian_approval` = stable/true；`approvalsReviewer = guardian_subagent` 档 — 原文 — `codex features list` + SCHEMA-v2
**Ultra 委派提示原文（桌面）**：
`Use Ultra with Full access?` — 原文（对话框标题） — B-PRIM
`With Ultra and Full access on, Codex can use extended reasoning while running commands, using the internet, and editing files anywhere on your computer without asking. Switch to a more restricted permission mode or use Full access.` — 原文（Code 模式描述） — B-PRIM
`With Ultra and Full access on, ChatGPT can use extended reasoning while running commands, using the internet, and editing files anywhere on your computer without asking. Switch to a more restricted permission mode or use Full access.` — 原文（ChatGPT 模式描述） — B-PRIM
`With Ultra and Full access on, Codex can use extended reasoning while running commands, using the internet, and editing files anywhere on your computer without asking. No more restricted permission mode is currently available.` — 原文（无可降级档时的分支） — B-PRIM
`Use Full access` — 原文（按钮） — B-PRIM
`Title for the row controlling whether Full access appears in the permissions menu beside the prompt input field` — 原文（i18n 描述注释，证明权限菜单就在输入框旁） — B-INIT

---

## 8. 审批与沙箱

`-s, --sandbox <SANDBOX_MODE>` `[possible values: read-only, workspace-write, danger-full-access]` — 原文 — `cli-help/...`
`-a, --ask-for-approval <APPROVAL_POLICY>` 四档逐字（含官方解释）：
- `untrusted`: "Only run "trusted" commands (e.g. ls, cat, sed) without asking for user approval. Will escalate to the user if the model proposes a command that is not in the "trusted" set"
- `on-failure`: "DEPRECATED: Run all commands without asking for user approval. Only asks for approval if a command fails to execute, in which case it will escalate to the user to ask for un-sandboxed execution. Prefer `on-request` for interactive runs or `never` for non-interactive runs"
- `on-request`: "The model decides when to ask the user for approval"
- `never`: "Never ask for user approval Execution failures are immediately returned to the model"
— 原文 — `cli-help/all-subcommand-help.txt`
`` `on-failure` approval policy is deprecated and will be removed in a future release. Use `on-request` for interactive approvals or `never` for non-interactive runs. `` — 原文 — STRINGS-CLI:23666
`--dangerously-bypass-approvals-and-sandbox` — "Skip all confirmation prompts and execute commands without sandboxing. EXTREMELY DANGEROUS. Intended solely for running in environments that are externally sandboxed" — 原文 — `cli-help/...`
`--dangerously-bypass-hook-trust` — "Run enabled hooks without requiring persisted hook trust for this invocation. DANGEROUS. Intended only for automation that already vets hook sources" — 原文 — 同上
`Enable full access?` + `When Codex runs with full access, it can edit any file on your computer and run commands with network, without your approval. Exercise caution when enabling full access. This significantly increases the risk of data loss, leaks, or unexpected behavior.` — 原文（三档弹窗之一的全文） — STRINGS-CLI:34652
`Full Access mode` / `Read-Only mode` / `Agent mode` — 原文（档名，同窗 `tui\src\chatwidget\pets.rs`） — STRINGS-CLI:34672
`failed to persist full access warning acknowledgement` / `Failed to save full access confirmation preference: ` — 原文 — STRINGS-CLI:13481
`Full access` / `Use Full access` — 原文 — B-INIT / B-PRIM
`sandbox_workspace_write` — 原文 — B-MAIN；`sandbox_workspace_write.network_access` — 原文 — B-INIT
`approval_policy = "on-request"` — 原文（生成的 config 片段） — STRINGS-CLI:28700
`approval.response` — 原文（通道名） — B-INIT
`Approval requested: ` / `Approval requested by ` / `Codex wants to edit ` — 原文（弹窗正文模板） — STRINGS-CLI:≈34660 区
`codex could access ` / `codex to access ` / `codex could call MCP tool ` / `codex to call MCP tool ` / `codex could request permissions` / `codex to request permissions` — 原文（授权范围两种语态） — 同上区
`permission request` / `Question requested` / ` questions requested` — 原文 — 同上区
`automatic-approval-review` — 原文（活动 kind，即 auto_review 复核的 UI 落点） — B-ACT
`Automatic approval review rejected too many approval requests for this turn` — 原文 — B-INIT
`timed out draining guardian review session after interrupt` — 原文 — STRINGS-CLI:20417
`guardianWarning`（事件）+ `GuardianWarningNotification{message,threadId}`，描述原文："Concise guardian warning message for the user." / "Thread target for the guardian warning." — 原文 — SCHEMA-notify / SCHEMA-v2
`thread/approveGuardianDeniedAction` — 原文（被拒动作的人工放行口） — `ClientRequest.json`
`item/permissions/requestApproval` + `PermissionsRequestApprovalParams{cwd, permissions}`，`RequestPermissionProfile{fileSystem,network}`（`additionalProperties:false`） — 原文 — SCHEMA-req / SCHEMA-v2
`.git` / `.codex` / `.agents` **强制只读**：未取证到这三条的"强制只读"字面量。取到的相邻机制是 `FileSystemSpecialPath = root|minimal|project_roots|tmpdir|slash_tmp|unknown`（§0.3）与 `FileSystemAccessMode = read|write|deny`；`disable_warningse_untracked_dirs` / `ignore_large_unt_untracked_files` 串窗（STRINGS-CLI:11111）与 `.codex-mark` CSS 类（STRINGS-CLI:22879）。
`prefix_rule` 白名单编辑面：
`prefix_rule(pattern=` — 原文（规则渲染形态） — STRINGS-CLI:21935
`rules prefix_rules cannot be empty` / `rules prefix_rule at index ` — 原文 — STRINGS-CLI:18826 / 18827
`set either token or any_of` / `any_of cannot be empty` / `any_of cannot include empty tokens` / `token cannot be empty` / `set either token or any_of, not both` — 原文（规则编辑校验报错全集） — STRINGS-CLI:18881
`matchedRules` / `invariant failed: matched_rules must be non-empty` / `execpolicy\src\executable_name.rs` / `execpolicy\src\rule.rs` / `execpolicy\src\policy.rs` / `execpolicy\src\parser.rs` — 原文（规则引擎源文件随 fmt 落进二进制） — STRINGS-CLI:21926 / 21927 / 21937 / 21952
`# network rule saved in execpolicy (` / `:failed to persist network policy amendment to execpolicy: ` / `and against one or more execpolicy files` — 原文 — STRINGS-CLI:20730 / 20369 / 21921
`--ignore-rules` — "Do not load user or project execpolicy `.rules` files" — 原文 — `cli-help/...`
`Optional proposed execpolicy amendment to allow similar commands without prompting.` — 原文 — STRINGS-CLI:16584
`NetworkPolicyAmendment{action: allow|deny}` 与 `proposedNetworkPolicyAmendments[]` — 原文 — SCHEMA-cmd-approve
`network_proxy` — 原文 feature，stage `experimental`，effective `false` — `codex features list`
`AdditionalNetworkPermissions` / `NetworkRequirements` / `NetworkUnixSocketPermission` — 原文定义名（逐值未展开） — SCHEMA-v2
`Windows restricted token sandbox` — 原文（`codex sandbox` 参数说明 "Full command args to run under Windows restricted token sandbox"） — `cli-help/...`
`--permissions-profile <NAME>` — "Named permissions profile to apply from the active configuration stack" / `--include-managed-config` — "Include managed requirements while resolving an explicit permissions profile" — 原文 — 同上
`permissionProfile/list` + `PermissionProfileSummary` / `PermissionProfileListResponse` — 原文 — `ClientRequest.json` / SCHEMA-v2
`windowsSandbox/setupStart` / `windowsSandbox/readiness` / `windowsSandbox/setupCompleted` / `windows/worldWritableWarning` / `WindowsSandboxSetupMode` / `WindowsSandboxReadiness` — 原文 — `ClientRequest.json` / SCHEMA-notify / SCHEMA-v2
`Timed out waiting for Windows sandbox setup completion` — 原文 — B-MAIN
`Secondary status shown when read-only mode remains available after the Windows sandbox readiness check fails` — 原文（i18n 描述注释） — B-PRIM
`Secondary status explaining read-only access when organization policy does not allow the Windows sandbox update` — 原文（同上） — B-PRIM
`Computer Use app approval timed out` — 原文 — B-MAIN
`feature exec_permission_approvals` = under development/false；`auth_elicitation` = under development/false；`default_mode_request_user_input` = under development/false；`request_permissions_tool` = under development/false；`tool_call_mcp_elicitation` = stable/true — 原文 — `codex features list`
`McpServerElicitationRequestParams` 值域全集：`McpElicitationStringType=string` / `McpElicitationNumberType=number|integer` / `McpElicitationBooleanType=boolean` / `McpElicitationArrayType=array` / `McpElicitationObjectType=object` / `McpElicitationStringFormat=email|uri|date|date-time`，以及 single-select / multi-select / legacy-titled 三型 `McpElicitationEnumSchema` — 原文 — `McpServerElicitationRequestParams.json`
`ConfigReadResponse` 的 `"auto"|"prompt"|"approve"` 与 `"total"|"body_after_prefix"` — 原文枚举（MCP 服务器审批档 + 摘要投递档） — `ConfigReadResponse.json`
**`.git` / `.codex` / `.agents` 强制只读**：未取证到这三条的"强制只读"字面量。在位相邻机制见 §0.3 的 `FileSystemSpecialPath` / `FileSystemAccessMode`，以及 `disable_warningse_untracked_dirs`、`ignore_large_unt_untracked_files`（STRINGS-CLI:11111 窗）与 `.codex-mark` CSS 类（STRINGS-CLI:22879）。

---

## 9. 上下文

`% context left` / `100% context left` — 原文（状态行；前者是模板，后者是满额态） — STRINGS-CLI:34934 / 34935
`context-compaction` — 原文（活动条目 kind） — B-ACT
`contextCompaction` / `compact` / `Compact` — 原文 — B-MAIN
`contextCompaction{id,type}` — 原文（流内块，见 §0.1） — SCHEMA-v2::ThreadItem
`thread/compacted` + `ContextCompactedNotification` — 原文 — SCHEMA-notify
`thread/compact/start` + `ThreadCompactStartParams` / `ThreadCompactStartResponse` — 原文 — `ClientRequest.json` / SCHEMA-v2
`pending-manual-context-compaction` — 原文（待人工压缩的 UI 态） — B-INIT
`AutoCompactTokenLimitScope` — 原文定义名（自动压缩的额度口径开关） — SCHEMA-v2
`remote_compaction_v2` = under development/false；`local_thread_store_compression` = under development/false — 原文 feature — `codex features list`
`compactionImageBudget` — 原文 — B-SRC
`Context window exceeded while compacting; removing oldest history item. Error: ` — 原文 — STRINGS-CLI:23582
`pre-compact` / `post-compact` — 原文 hook 事件名 — STRINGS-CLI:22490 窗
`Before context compaction` / `After context compaction` — 原文（hook 时机人话档名） — STRINGS-CLI:≈34886
`/compact`（5 次） — 原文命令 — STRINGS-CLI 频次统计
`/status`（10 次） — 原文命令；配套可见原文 `Heads up, you have less than ` + `%` + ` of your ` + `)` + ` limit left. Run /status for a breakdown.` — 原文（截断窗内拼装） — STRINGS-CLI:≈34505 区
`/status` 的 workspace 列项相邻原文：`Usage limits require a ChatGPT account on this task's host.` / `Usage resets require a ChatGPT account on this task's host.` / `Workspace/account identifier that Codex was previously using.` — B-INIT / STRINGS-CLI:16975
`Current rollout path: ` / `Rollout path is not available yet.` — 原文 — STRINGS-CLI:≈34682 区
`ThreadTokenUsage` / `TokenUsageBreakdown` / `thread/tokenUsage/updated` — 原文 — SCHEMA-v2 / SCHEMA-notify
`/tokens`（2 次） — 原文命令 — STRINGS-CLI 频次统计
`AdditionalContextEntry` / `AdditionalContextKind` / `TurnSteerParams.additionalContext: object|null` — 原文（注入额外上下文的两处形态） — SCHEMA-v2
`max_rollout_age_generate_memories` / `remaining_percent` / `external_context` / `disable_on_exter` — 原文（截断窗内配置键碎片） — STRINGS-CLI:11108 窗
**`conversation_detail_mode` / `thread_history_projection_state` 字面量**：未取证到；在位的同义机制是 §0.2 的 `TurnItemsView = notLoaded|summary|full` 与 `ThreadStatus = notLoaded|idle|systemError|active{activeFlags}`。

---

## 10. 引用与输入辅助

`mentions/search` / `mention-catalog` / `mention-discovery` / `agentMention` — 原文（键名/通道名） — B-INIT
`mentions_v2` = under development / false — 原文 feature — `codex features list`
`/mention` — **未取证到**：STRINGS-CLI 频次统计里出现的斜杠命令全集为 `/plugins`(51) `/skills`(38) `/goal`(17) `/status`(10) `/settings`(10) `/resume`(7) `/model`(7) `/hooks`(7) `/copy`(7) `/agents`(6) `/usage`(5) `/test`(5) `/reasoning`(5) `/login`(5) `/fork`(5) `/compact`(5) `/review`(4) `/agent`(4) `/title`(3) `/sandbox`(3) `/new`(3) `/diff`(3) `/apps`(3) `/tokens`(2) `/steer`(2) `/rename`(2) `/permissions`(2) `/memories`(2) `/logout`(2) `/interrupt`(2) `/init`(2) `/feedback`(2) `/environment`(2) `/help`(1) `/fast`(1) `/clear`(1) `/archive`(1) `/approval`(1) — 原文（现读计数）
`/ide-context` — **未取证到**。相邻形态：`externalAgentConfig/detect` / `externalAgentConfig/import` / `ExternalAgentConfigMigrationItem(Type)` / `HookMigration` / `SubagentMigration` / `ExternalAgentConfigImportCompletedNotification`，及原文 "If true, include detection under the user's home (~/.claude, ~/.codex, etc.)."（STRINGS-CLI:16386）、`CLAUDE.md` + `AGENTS.md target path has no parent` + `settings_path`（15547）
Chrome 标签页提及（桌面独有）：`Timed out waiting for Chrome tab mention response to ${…}` / `Timed out connecting to Chrome tab mention provider` — 原文 — B-MAIN
`-i, --image <FILE>...` — "Optional image(s) to attach to the initial prompt" — 原文 — `cli-help/...`
`input_image{detail,image_url,type}` — 原文 — SCHEMA-v2::ContentItem；`image_detail_original` = removed/false — `codex features list`
`chatgpt-file-upload` / `chatgpt-image-upload-reminder-dialog` / `chatgpt-content-reference-file-download` — 原文（chunk 名） — asar `/webview/assets/`
`--search` — "Enable live web search. When enabled, the native Responses `web_search` tool is available to the model (no per‑call approval)" — 原文 — `cli-help/...`
`web_search_cached` = deprecated/false；`web_search_request` = deprecated/false；`standalone_web_search` = under development/false；`search_tool` = removed/false — 原文 feature — `codex features list`
`"disabled"|"cached"|"live"` — 原文枚举（web search 三档，落在 `ConfigReadResponse`） — `ConfigReadResponse.json`
`WebSearchContextSize` — 原文定义名 — SCHEMA-v2
`fuzzyFileSearch` / `fuzzyFileSearch/sessionStart|sessionUpdate|sessionStop` / `fuzzyFileSearch/sessionUpdated|sessionCompleted` / `FuzzyFileSearchMatchType` / `FuzzyFileSearchResult` / `FuzzyFileSearchParams` — 原文（文件模糊搜索输入辅助全套） — `ClientRequest.json` / SCHEMA-notify / SCHEMA-v2
`Appshots` — **未取证到该字面量**。相邻形态：`app/resources/accessibility/` 目录、`.vite/build/capture-DaZJeQgG.js`、`.vite/build/upload-n-8O_tez.js`、`Timed out waiting for Codex Computer Use capture`（B-MAIN）、feature `computer_use` = stable/true、`browser_use` / `browser_use_external` / `in_app_browser` = stable/true
`Opaque cursor to pass to the next call to continue after the last item. If None, there are no more items to return.` — 原文 — STRINGS-CLI:16928 窗

---

## 11. 队列与转向

`turn/steer` + `TurnSteerParams{additionalContext, clientUserMessageId, expectedTurnId, input, responsesapiClientMetadata, threadId}` + `TurnSteerResponse` — 原文 — `ClientRequest.json` / SCHEMA-v2
`turn/interrupt` + `TurnInterruptParams` / `TurnInterruptResponse` — 原文 — 同上
`NonSteerableTurnKind` = `review | compact` — 原文（这两类 turn 不接受转向） — SCHEMA-v2
`TurnNotSteerable` / `activeTurnNotSteerable` — 原文（错误键与错误形态 `{ "activeTurnNotSteerable": … }`） — STRINGS-CLI:11124 窗 / 17594
`Steering requires an active compatible TPP turn` / `Steering requires an existing TPP conversation` — 原文 — B-INIT
`Model interrupted to submit steer instructions.` — 原文（转向时的流内可见提示） — STRINGS-CLI:≈34658 区
`received active-turn-not-steerable error without a matching pending steer` — 原文 — 同上区
`/steer`（2 次） — 原文命令；feature `steer` = stage `removed` / effective `true` — STRINGS-CLI / `codex features list`
`send_input send message existing agent subagent follow up interrupt redirect queue target` — 原文（工具搜索词表，同窗含 `follow up` 与 `queue`） — STRINGS-CLI:20802
`Do not claim that a running backend task cannot be updated, redirected, or interrupted.` — 原文（提示词侧约束，反证 UI 承诺可重定向） — STRINGS-CLI:19226
`struct variant ClientRequest::TurnSteer with 2 elements` / `struct TurnSteerParams with 6 elements` / `struct TurnSteerResponse with 1 element` / `struct TurnInterruptParams with 2 elements` — 原文（serde 诊断串） — STRINGS-CLI:12307 / 12412 / 12418 / 12493
**"Steer vs Queue 二选一"的成对按钮原文**、**默认档设置项**、**拖拽排序**、**`followUpQueueMode` 驼峰字面量**：均未取证到。最接近的机制证据是上面 `turn/steer` 与 `turn/interrupt` 两条独立方法 + `NonSteerableTurnKind`。

---

## 12. 中断与恢复

`Keyboard interrupt` — 原文 — STRINGS-CLI:11410
`no active turn to interrupt` / `failed to interrupt ` / `Failed to submit interrupt to Codex: ` / `turn/interrupt failed: ` / `turn/interrupt failed in TUI` — 原文 — 11741 / 11742 / 12044 / 11405 / 13399
`turn interrupted` / `interrupt received: abort current task, if any` — 原文 — 21599 / 23616
`aborted by user` / `aborted by user after ` / `timed out after ` — 原文 — 20113 / 20114 / 37588
`failed to flush interrupted-turn marker before emitting TurnAborted: ` — 原文（事件名 `TurnAborted`） — 23492
`Review was interrupted. Please re-run /review and wait for it to complete.` — 原文 — 23493
`MCP startup interrupted. The following servers were not initialized: ` / `MCP startup incomplete (` / `Booting MCP server:` / `Starting MCP servers` / ` failed to start` — 原文 — ≈34500 区
`Press Ctrl+C to return to the main thread first.` — 原文（侧会话键位） — ≈34690 区
`(' is unavailable in side conversations.` / `+' is unavailable before the session starts.` / `Unrecognized command '/` + `'. Type "/" for a list of supported commands.` / `Side starting...` — 原文 — 同上区
`Ctrl+L is disabled while a task is in progress.` — 原文 — ≈34490 区
`codex resume` — "Resume a previous interactive session (picker by default; use --last to continue the most recent)" / "[SESSION_ID] Session id (UUID) or session name. UUIDs take precedence if it parses. If omitted, use --last to pick the most recent recorded session" — 原文 — `cli-help/...`
`codex exec resume` — "Resume a previous session by id or pick the most recent with --last" — 原文 — 同上
`--ephemeral` — "Run without persisting session files to disk" — 原文 — 同上
`thread/resume` + `ThreadResumeResponse`，描述原文 "`thread/turns/list` page returned when requested by `initialTurnsPage`." — STRINGS-CLI:16972
`ThreadStatus = notLoaded | idle | systemError | active{activeFlags}` — 原文（重连后可见四态） — SCHEMA-v2
`TurnItemsView = notLoaded | summary | full` — 原文（重连后历史投影三档） — SCHEMA-v2；配套 `mapResumeResponse(q,{fallbackCwd:…, resolvedPermissions:…})` 与 `.filter(e=> … e.status!==…)` — B-MAIN / B-INIT
`session_init.thread_name_lookup` / `codex.thread.started` — 原文事件名 — STRINGS-CLI:23666 / 23666 窗
`--remote <ADDR>` — "Connect the TUI to a remote app server endpoint. Accepted forms: `ws://host:port`, `wss://host:port`, `unix://`, or `unix://PATH`." / `--remote-auth-token-env <ENV_VAR>` — 原文 — `cli-help/...`
`remote-control start|stop` + `remoteControl/status/changed` + `RemoteControlConnectionStatus` + `Timed out waiting for remote control step-up login.` — 原文 — `cli-help/...` / SCHEMA-notify / SCHEMA-v2 / B-MAIN
`codex cloud` — "[EXPERIMENTAL] Browse tasks from Codex Cloud and apply changes locally" — 原文 — `cli-help/...`
**"云端容器缓存 48s→5s"这类可观测提示**：未取证到。

---

## 13. 计量与成本

`/usage`（5 次） — 原文命令 — STRINGS-CLI 频次统计
`usage-settings` / `usage.heartbeat` / `usage.snapshot` / `usageLimitExceeded` / `plan_type_bucket` — 原文（键名/事件名） — B-INIT
`account/rateLimits/updated` + `AccountRateLimitsUpdatedNotification` + `account/rateLimits/read` — 原文 — SCHEMA-notify / `ClientRequest.json`
`GetAccountRateLimitsResponse` 描述原文："…per-bucket view keyed by metered `limit_id` (for example, `codex`)." — 原文 — STRINGS-CLI:16975
`CreditsSnapshot` — 原文定义名 — SCHEMA-v2
`PlanType` 12 档（§0.3 逐字） — 原文 — SCHEMA-v2
限流原因 5 档逐字 = `rate_limit_reached` / `workspace_owner_credits_depleted` / `workspace_member_credits_depleted` / `workspace_owner_usage_limit_reached` / `workspace_member_usage_limit_reached` — 原文 — `AccountRateLimitsUpdatedNotification.json`
`chatgpt authentication required to read rate limits` / `codex account authentication required to read rate limits` / `failed to fetch codex rate limits: no snapshots returned` / `failed to construct backend client: ` / `failed to fetch codex rate limits: ` — 原文 — STRINGS-CLI:11851 / 11852
`You've reached your workspace credit limit` / `Your workspace is out of credits. Ask your workspace owner to add more. Notify owner?` / `Usage limit reached` / `Request a limit increase from your owner to continue using codex. Request increase?` — 原文（弹窗全文） — ≈34515 区
`Approaching rate limits` / ` for lower credit usage?` / `Switch to ` / `Keep current model` / `Keep current model (never show again)` / `Hide future rate limit reminders about switching models.` — 原文（换档建议条按钮全集） — 同上区
`Uses fewer credits for upcoming turns.` — 原文 — 同上区
`< reasoning effort can quickly consume Plus plan rate limits.` — 原文 — STRINGS-CLI:34510
`failed to persist rate limit switch prompt preference` / `Failed to save rate limit reminder preference: ` — 原文 — STRINGS-CLI:13483
`credits_depleted` / `version_mismatch` — 原文（截断窗内键名） — STRINGS-CLI:11111 窗
reset banking 原文：`Usage reset was cancelled before redemption.` / `Usage resets require a ChatGPT account on this task's host.` / `Usage limits request was cancelled.` — B-INIT；`account/sendAddCreditsNudgeEmail` + `AddCreditsNudgeEmailStatus` — `ClientRequest.json` / SCHEMA-v2
度量/OTel 属性键名（截断窗内逐条）：`codex.turn.ttft` + `ttft.duration_ms` / `codex.turn.ttfm` + `ttfm.duration_ms` / `codex.tool.call.` + `call.duration_ms` / `codex.api_reques…` / `codex.sse_event.` + `event.duration_ms` / `codex.websocket.request` / `codex.websocket.event` — STRINGS-CLI:11327 窗
`runtime_metrics` = under development/false；`enable_request_compression` = stable/true；`prevent_idle_sleep` = experimental/false — 原文 feature — `codex features list`
`--analytics-default-enabled` 帮助原文："Controls whether analytics are enabled by default. … for first-party use cases like the VSCode IDE extension, we default analytics to be enabled by default by setting this flag. Users can still opt out by setting this in their config.toml: `[analytics] enabled = false`" — 原文 — `cli-help/...`
**倍率表（1.5×/2.5× 之类数字）**：未取证到。

---

## 14. 会话管理

`/copy`(7) `/rename`(2) `/archive`(1) `/fork`(5) `/new`(3) `/clear`(1) `/title`(3) `/resume`(7) — 原文命令（现读计数） — STRINGS-CLI 频次统计
`Copied last message to clipboard` / `Copy failed: ` / `No agent response to copy` — 原文 — STRINGS-CLI:≈34490 区
`Cannot copy that response after rewinding. Only the most recent ` + `" responses are available to /copy.` — 原文（rewind 后可复制窗口受限） — 同上区
`Rename thread` / `Name thread` / `Type a name and press Enter` / `Thread name cannot be empty.` — 原文 — 同上区
`thread/name/set` + `thread/name/updated` + `ThreadNameUpdatedNotification` — 原文 — `ClientRequest.json` / SCHEMA-notify
`thread/archive` / `thread/unarchive` / `thread/unsubscribe` / `thread/closed` + `ThreadArchivedNotification` / `ThreadUnarchivedNotification` / `ThreadClosedNotification` — 原文 — 同上
`codex archive` — "Archive a saved session by id or session name"；`codex unarchive` — "Unarchive a saved session by id or session name"；`codex fork` — "Fork a previous interactive session (picker by default; use --last to fork the most recent)" — 原文 — `cli-help/...`
`thread/fork` + `Thread.forkedFromId` / `parentThreadId` / `sessionId` / `path` / `preview` / `createdAt` / `updatedAt` / `cliVersion` / `modelProvider` / `threadSource` / `source` / `ephemeral` / `gitInfo` / `cwd` / `status` / `turns` — 原文字段逐条 — SCHEMA-v2::Thread
`Thread forked from ` + `event tui\src\chatwidget\session_flow.rs:69` / `:50` / `:63` + `codex_tui::chatwidget::session_flow` + `replace_err` — 原文 — STRINGS-CLI:≈34550 区
`Full-history forked agents inherit the parent agent type, model, and reasoning effort; omit agent_type, model, and reasoning_effort, or spawn without a full-history fork.` — 原文 — STRINGS-CLI:20052
`thread/rollback` — "The number of turns to drop from the end of the thread. Must be >= 1." — 原文（从更早处回退的机制底座） — STRINGS-CLI:16972
`GetConversationSummaryParams` 变体 = `ThreadId | RolloutPath` — 原文（按线程或按 rollout 文件取历史两种入口） — STRINGS-CLI:16794 窗
`thread/list` / `thread/search` / `thread/loaded/list` / `thread/read` / `thread/turns/list` / `thread/turns/items/list` / `thread/inject_items` — 原文（会话台账的七种读法） — `ClientRequest.json`
`Explanation that a new worktree chat keeps the existing files and branch but not the previous conversation` — 原文（i18n 描述注释：新 worktree 会话保留文件/分支但不带旧对话） — B-INIT
**"编辑最近一条 prompt"的原文标签**：未取证到；机制证据是 `tui\src\chatwidget\input_restore.rs:119` + `codex_tui::chatwidget::input_restore`（≈34658 区）。
**"从任意更早消息 fork"的原文标签**：未取证到（只有 §上列 `thread/fork` + `forkedFromId` + `rollback` 三个机制件）。

---

## 15. 模型与档位

`/model`(7) `/reasoning`(5) `/fast`(1) `/sandbox`(3) `/permissions`(2) `/approval`(1) — 原文命令 — STRINGS-CLI 频次统计
`Switch models or reasoning effort quickly with /model.` — 原文 — STRINGS-CLI:34334
`Select Model` / `Pick a quick auto mode or browse all models.` / `No additional models are available right now.` / `Select Model and Effort` / `Access legacy models by running codex -m <model_name> or in your config.toml` / `Choose a specific model and reasoning level (current: ` — 原文（模型选择器全文） — ≈34540 区
`Select Reasoning Level for ` — 原文 — ≈34516 区
`threads model reasoning effort` — 原文（键名片段窗） — STRINGS-CLI:33278
`Reasoning efforts: ` / `Reasoning effort ` / `. Supported reasoning efforts: ` — 原文 — 20028 / 20055 / 20056
`ReasoningEffort` 六档逐字 = `none | minimal | low | medium | high | xhigh`；定义名 `ReasoningEffortOption` — 原文 — SCHEMA-v2
`ReasoningSummary` = `auto | concise | detailed | none` — 原文 — SCHEMA-v2
`model/list` + `ModelListParams` / `ModelListResponse` / `Model` / `ModelAvailabilityNux` / `ModelServiceTier` / `ModelUpgradeInfo` / `ModelRerouteReason` / `ModelVerification` — 原文 — `ClientRequest.json` / SCHEMA-v2
`model/rerouted` / `model/verification` — 原文事件 — SCHEMA-notify
`modelProvider/capabilities/read` + `ModelProviderCapabilitiesReadParams/Response` — 原文 — 同上
`Override the reasoning effort for this turn and subsequent turns.` / `Override the reasoning effort for subsequent turns.` / `Override the reasoning summary for subsequent turns.` / `` … `null` clears the current service tier; omission leaves it unchanged. `` — 原文 — 17457 / 16160 / 16974
`-m, --model <MODEL>` "Model the agent should use" / `--oss` "Use open-source provider" / `--local-provider <OSS_PROVIDER>` "Specify which local provider to use (lmstudio or ollama). If not specified with --oss, will use config default or show selection" — 原文 — `cli-help/...`
`*Warning: OpenAI base URL is overridden to ` + `https://api.openai.com/v1` + `Selecting models may not be supported or work properly.` — 原文 — ≈34525 区
`codex debug models` — "Render the raw model catalog as JSON" — 原文 — `cli-help/...`
`remote_models` = removed/false；`fast_mode` = stable/true；`personality` = stable/true；`goals` = stable/true — 原文 feature — `codex features list`
`realtime_conversation` = under development/false + `thread/realtime/start|appendAudio|appendText|stop|listVoices` + `RealtimeVoice` / `RealtimeVoicesList` / `RealtimeOutputModality` / `RealtimeConversationVersion` / `ThreadRealtimeStartTransport` — 原文 — 同上 / `ClientRequest.json` / SCHEMA-v2
执行环境 Local / Worktree / Cloud：
`codex cloud` "[EXPERIMENTAL] Browse tasks from Codex Cloud and apply changes locally" — 原文 — `cli-help/...`
`Branch is already checked out in another worktree.` — 原文 — B-INIT
`Error shown when move-to-local cannot use a branch that is checked out in another worktree` — 原文（i18n 描述注释，点名 `move-to-local`） — B-INIT
`Worktree branch name is required` / `Error shown when move-to-worktree is attempted without a target worktree branch name` — 原文 — B-INIT
`Failed to prepare worktree branch “{branch}”: {message}` / `Failed to create worktree branch "${…}": ${…}` — 原文 — B-INIT
`Cannot create worktree branch "${r.branchName}" because the project's default branch could not be resolved.` — 原文 — B-INIT
`No other checkout branch is available before handing this thread off to a worktree.` — 原文 — B-INIT
`You are now working on {worktreeBranch} in a worktree. Branch {localBranch} was checked out locally.` / `You are now working on {worktreeBranch} in a new worktree. Branch {localBranch} was checked out locally.` — 原文（迁移成功两条落定文案） — B-PRIM
`Detaching branch from worktree` / `Progress step shown while checking out a branch in the worktree during task handoff` / `Progress step shown while detaching the worktree branch during handoff back to local` — 原文（进度步） — B-PRIM
`getHostWorktreeSettings()` / `worktreesRoot` — 原文 — B-MAIN
`environment/add` + `TurnEnvironmentParams` + `EnvironmentAddParams/Response` — 原文 — `ClientRequest.json` / SCHEMA-v2
`collaboration_modes` = removed/true + `collaborationMode/list` + `CollaborationModeMask` + mode 档 `["plan","default"]` — 原文 — `codex features list` / `CollaborationModeListResponse.json`
**`/fast` 的 "1.5× 速度 / 2.5× 积分" 原文**：未取证到（`/fast` 仅 1 次命中，同窗无倍率数字）。

---

## 16. 规则与记忆

AGENTS.md 读取链：
`failed to discover AGENTS.md docs for instruction sources` — 原文 — STRINGS-CLI:11399
`Failed to read global AGENTS.md instructions from ` / ` AGENTS.md instructions from ` — 原文 — 20563 / 20565
`CLAUDE.md` + `AGENTS.md target path has no parent` + `settings_path` + `event app-server\src\config\external_agent_config.rs:539` — 原文 — 15547
`child_agents_md` = under development / false — 原文 feature（子目录 AGENTS.md） — `codex features list`
`project_doc_max_bytes` — **未取证到该字面量**（CLI strings 与 asar 字面量池均无）。在位相邻键窗：`max_rollout_age_generate_memories`、`remaining_percent`、`external_context`、`disable_on_exter…`（STRINGS-CLI:11108）。
`/init`（2 次）+ 生成提示词全文（逐段）：`Generate a file named AGENTS.md that serves as a contributor guide for this repository.` / `Your goal is to produce a clear, concise, and well-structured document with descriptive headings and actionable explanations for each section.` / `Follow the outline below, but adapt as needed ` / `Document Requirements` / `- Title the document "Repository Guidelines".` / `- Use Markdown headings (#, ##, etc.) for structure.` / `- Keep the document concise. 200-400 words is optimal.` / `Recommended Sections` / `Project Structure & Module Organization` / `Build, Test, and Development Commands` / `Coding Style & Naming Conventions` / `Testing Guidelines` / `Commit & Pull Request Guidelines` / `(Optional) Add other sections if relevant, such as Security & Configuration Tips, Architecture Overview, or Agent-Specific Instructions.` / `` = already exists here. Skipping /init to avoid overwriting it. `` — 原文 — ≈34670 区
记忆开关形态：`/memories`(2) — 原文命令；feature `memories` = experimental/false — `codex features list`
`thread/memoryMode/set` + `ThreadMemoryMode = enabled | disabled` + `ThreadMemoryModeSetParams/Response` — 原文 — `ClientRequest.json` / SCHEMA-v2
`memory/reset` + `MemoryResetResponse` + `memory` + `memory/status` — 原文通道名 — B-INIT
`MemoryCitation` / `MemoryCitationEntry` — 原文定义名；`agentMessage.memoryCitation` 字段 — 原文 — SCHEMA-v2
`codex debug clear-memories` — 原文（debug 子命令项，与 `debug models` / `debug app-server` / `debug prompt-input` / `debug trace-reduce` 同列） — STRINGS-CLI:13253
`no_memories_if_mem…` — 原文（截断窗内键名） — STRINGS-CLI:11108 窗
`memory:${…}:${…}` 复合键两处 / `memory_scope` / `artifacts_folder` — 原文键名 — B-INIT
规则/市场与插件载体：`.agents/plugins/marketplace.json` / `.claude-plugin/marketplace.json` / `.codex-marketplace-install.json` / `data did not match any variant of untagged enum RawMarketplaceManifestPluginSource` / `failed to write activated marketplace metadata: ` — 原文 — STRINGS-CLI:21063 / 21203
Hooks（规则的另一半）：`hooks.json`；事件名逐字 `pre-tool-use` / `post-tool-use` / `pre-compact` / `post-compact` / `session-start` / `user-prompt-submit` / `subagent-start` / `subagent-stop` / `permission-request`；时机人话档名逐字 `Before a tool executes` / `When permission is requested` / `After a tool executes` / `Before context compaction` / `After context compaction` / `When a new session starts` / `When the user submits a prompt` / `When a subagent is created` / `Right before a subagent ends its turn` / `Right before Codex ends its turn`；定义名 `HookEventName` / `HookSource` / `HookTrustStatus` / `HookRunStatus` / `HookRunSummary` / `HookExecutionMode` / `HookScope` / `HookHandlerType` / `HookOutputEntry` / `HookOutputEntryKind` / `HookErrorInfo` / `HooksListEntry` / `HooksListParams/Response` / `ConfiguredHookHandler` / `ConfiguredHookMatcherGroup` / `ManagedHooksRequirements` — 原文 — STRINGS-CLI:22490 / ≈34886 / SCHEMA-v2
`hook/started` / `hook/completed` + `HookStartedNotification` / `HookCompletedNotification` — 原文事件 — SCHEMA-notify
`hooks` = stable/true；`plugin_hooks` = removed/false — 原文 feature — `codex features list`
`hook returned invalid PreCompact hook JSON output` + `hookSpecificOutput` / `trigger` / `tool_input` / `updatedInput` / `updatedPermissions` / `interrupt` — 原文 — STRINGS-CLI:22523
对话内可见的安全/信任提示（规则触达用户的一型）：`Your conversations have multiple flags for possible cybersecurity risk. Responses may take longer because extra safety checks are on. To get authorized for security work, join the Trusted Access for Cyber program: https://chatgpt.com/cyber` — 原文 — STRINGS-CLI:≈34657 区
产物模板（"对话里能显示什么"的直接证据，逐字）：
`ARTIFACT_KINDS` = `document{extension:"docx"}` / `presentation{extension:"pptx"}` / `spreadsheet{extension:"xlsx"}` / `google-docs{family:"document",workspacePath:"document"}` / `google-slides{family:"presentation",workspacePath:"presentation"}` / `google-sheets{family:"spreadsheet",workspacePath:"spreadsheets"}` — 原文 — ATP
`DESCRIPTION_KINDS` = `"document"→document` / `"presentation"→presentation` / `"spreadsheet"→spreadsheet` / `"google doc"→google-docs` / `"google slides presentation"→google-slides` / `"google sheet"→google-sheets` — 原文 — ATP
`LIMITS` = `templates: 100` / `offered: 10` / `request: 1_000` / `previewBytes: 8 * 1024 * 1024` / `totalBytes: 32 * 1024 * 1024` / `previewPixels: 16 * 1024 * 1024` / `totalPixels: 32 * 1024 * 1024` — 原文（"一次最多 offered 10 个模板"是用户可感上限） — ATP
`WORK_SKILLS_ROOT` = `$CODEX_HOME/skills/remote-skills`；`WORK_PLUGINS_ROOT` = `$CODEX_HOME/plugins/cache`；`WORK_PREVIEW` = `data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==`（1×1 透明 GIF 占位） — 原文 — ATP
表单形态枚举 `type: "text" | "file" | "array" | "boolean" | "object" | "string"` — 原文 — ATP
`skills` / `plugins` / `apps` 三面（对话里可被 @/选中的能力池）：`skills/list` / `skills/extraRoots/set` / `skills/config/write` / `skills/changed`；`plugin/list|installed|read|skill/read|install|uninstall|share/save|share/updateTargets|share/list|share/checkout|share/delete`；`marketplace/add|remove|upgrade`；`app/list` + `AppListUpdatedNotification` + `AppInfo` / `AppBranding` / `AppMetadata` / `AppReview` / `AppScreenshot` / `AppToolApproval`；feature `apps` = stable/true、`plugins` = stable/true、`enable_mcp_apps` = under development/false、`plugin_sharing` = stable/true、`workspace_dependencies` = stable/true；`/plugins`(51) `/skills`(38) `/apps`(3) — 原文 — `ClientRequest.json` / SCHEMA-v2 / `codex features list` / STRINGS-CLI

---

## 附 A. 读不到的面 / 取证受限项（如实登记）

1. **WindowsApps ACL：本次未出现任何 EPERM/EACCES。** `app/`、`app/resources/`、asar 头与 15,596 条目、`artifact-template-picker/*.mjs` 均可只读打开。受限的是**体量而非权限**：`chrome.dll` 326 MB、`resources/codex.exe` 320 MB、`resources/codex`（无扩展名）281 MB、`codex-code-mode-host.exe` 71 MB、`codex-windows-sandbox-service.exe` 54 MB、`codex-command-runner.exe` 8.2 MB —— 只对 `AppData/Local/Programs/codex/codex.exe`（247 MB）跑了 strings 管线。
2. **`/native-menu-locales/*.json` 64 语言未逐条展开**（含 `zh-CN.json` / `zh-HK.json` / `zh-TW.json`，各 12–22K）。这是**原生菜单**的可见文案源，读得到；下一票最便宜的一块，能把 §5 / §8 / §14 的菜单项补齐英文与中文双跑。
3. **renderer 的 i18n key → 显示串映射未定位**。本轮取到的是 `artifactTemplate.resultCard.*` 这类**键名**与紧邻其的**英文描述注释**（形如 `Title for the row controlling whether Full access appears in the permissions menu beside the prompt input field`）。`_localized_strings-*.js` 只有 loader（64 个 locale chunk 的动态 import 表），不含串。
4. **`/webview/assets` 14,582 个 chunk 只导出 41 个。** 未导出但已点名的高价值候选：`compact-empty-state-5b7c7deba4dc.js`（§9 直接证据）、`chatgpt-conversation-page-*`（两个版本并存）、`chatgpt-temporary-chat-ui-*`、`chatgpt-saved-memory-source-delete-dialog-*`、`chatgpt-personalization-route-*`、`chatgpt-onboarding-dialog-*`、`codex-micro-settings-*`、`codex-micro-keyboard-surface-*`、`codex-micro-layout-*`、`codex-thread-report-dialog-*`、`codex-local-access-splash-*`、`codex-pet-assets-*`、`agent-menu-*`、`agent-settings-*`。
5. **SCHEMA-v2 的 524 个 definition 只展开了约 45 个。** 按名登记未展开的有：`PatchApplyStatus` / `WriteStatus` / `LocalShellStatus` / `DynamicToolCallStatus` / `McpToolCallStatus` / `CollabAgentToolCallStatus` / `CollabAgentState` / `CollabAgentTool` / `SubAgentSource` / `MemoryCitation(Entry)` / `AdditionalContextKind` / `NetworkRequirements` / `NetworkUnixSocketPermission` / `RemoteControlConnectionStatus` / `WindowsSandboxReadiness` / `McpAuthStatus` / `McpServerStatus(Detail)` / `HookRunStatus` / `HookOutputEntryKind` / `HookEventName` / `RealtimeVoice` / `ExternalAgentConfigMigrationItemType`。逐值一律现读：`node codex/def-dump.mjs codex/app-server-schema/codex_app_server_protocol.v2.schemas.json <定义名…>`。
6. **任务书点名的 4 个键在两个文本面都未取到**：`conversation_detail_mode`、`thread_history_projection_state`、`followUpQueueMode`（驼峰）、`project_doc_max_bytes`。**替代取证法**：这三/四个更像**服务端下发配置的字段名**而非客户端常量（客户端侧只认得到投影结果 `TurnItemsView` / `ThreadMemoryMode` / `ReasoningSummary`）。要拿它们，可 (a) 跑 `codex app-server generate-ts --experimental --out …` 拿 TS 绑定全集（本轮只跑 json-schema），(b) 跑 `codex debug prompt-input` 看模型可见输入，(c) 读登录后 `~/.codex/config.toml` 与 features 下发响应 —— (c) 属宿主状态且需登录，本任务按令未动。
7. **未登录态**：`codex debug models`、`account/rateLimits/read` 一类需凭据的**实时值**未取；本轮全部结论来自静态字面量与协议 schema，**不含任何一次真实对话渲染**。§9 的 `100% context left`、§13 的额度文案因此是"文案在位"而非"实测出现过"。
8. **`C:\Users\Administrator\.codex` 未读**（junction，宿主状态，任务明令不动）。故档位真实生效值、`config.toml` 里的 `[permissions.<id>]` 自定义档、`execpolicy` `.rules` 实档均未取证。
9. **九项具体未取证到**：`.git`/`.codex`/`.agents` 强制只读、Steer/Queue 成对按钮原文与其默认档设置项、Review 面板 `Unstaged/Staged/Commit/Branch/Last turn` 五标签、逐条/逐文件 accept·reject·stage·revert·commit+push 的按钮原文、PR 状态徽章、`/fast` 的 1.5×/2.5×、云端容器缓存 48s→5s 类提示、`identicon`、Mermaid/LaTeX 折叠标题原文、Appshots。分两批补：① `/native-menu-locales/` + `compact-empty-state` + `codex-micro-settings` 三个未展开面（覆盖多数）；② 对 `resources/codex`（281 MB，与已扫的 `codex.exe` 可能同源不同构建）与 `codex-code-mode-host.exe` 复跑同一 strings 管线。
10. **`resources/` 下 `plugins/`、`skills/`、`native/`、`cua_node/`、`default_app/`、`accessibility/`、`tools/`、`pyproto/`、`locales/` 九个目录本轮只 list 了一层未深入。**

## 附 B. 骨架完成度

§1–§16 **每类均有落位条目，无整类空缺**。跨类共性缺口集中在三处：SCHEMA-v2 未全展开（524 中约 45）、renderer chunk 未全展开（14,582 中 41）、菜单/图标资产只报名未读。具体"未取证到"逐项内联在各类末尾与附 A。

## 附 C. 复现命令（全部只读，产物落本目录）

```bash
cd /g/IHUI-AI/.ihui-agent/tmp/v5-evidence
export MSYS_NO_PATHCONV=1
export ASAR="C:/Program Files/WindowsApps/OpenAI.Codex_26.917.9434.0_x64__2p2nqsd0c76g0/app/resources/app.asar"
node codex/asar-helpers.mjs --tree 2                        # 目录分组
node codex/asar-helpers.mjs --entries '^/webview/.*\.js$'   # 11,202 个 chunk
node codex/asar-helpers.mjs --largest '^/webview/.*\.js$'
node codex/asar-helpers.mjs --dump '<路径正则>' 'G:/IHUI-AI/.ihui-agent/tmp/v5-evidence/codex/bundle'
node codex/bin-strings.mjs 'C:/Users/Administrator/AppData/Local/Programs/codex/codex.exe' \
  --min 6 --pattern '[A-Za-z]{4}' --out 'G:/IHUI-AI/.ihui-agent/tmp/v5-evidence/codex/strings_cli.txt'
"C:/Users/Administrator/AppData/Local/Programs/codex/codex.exe" features list
"C:/…/codex.exe" app-server generate-json-schema --experimental --out 'G:/…/codex/app-server-schema'
node codex/schema-scan.mjs --enums codex/app-server-schema/v2 codex/app-server-schema/v1 codex/app-server-schema
node codex/def-dump.mjs codex/app-server-schema/codex_app_server_protocol.v2.schemas.json ThreadItem TurnStatus
```

**两个坑（本轮实踩）**：① asar 路径与 `--dump` 输出目录**都必须 Windows 形式**（`G:/…`）且带 `MSYS_NO_PATHCONV=1`；给 Git Bash 形式 `/g/…` 时 node 会解成 `<cwd 盘符>\g\…`，脚本照样打印"导出 N 个"而 `du` 找不到目录。② 从 `C:/Program Files/WindowsApps/…` 读到的条目 mtime/大小可能因打包器硬链接出现 `2 Administrator` 链接数，`sed -n /a/,b/p` 对同一 Map 定义会**重复打印**（附 A 第 9 条引用的 `ARTIFACT_KINDS` 输出即此型，已按去重后读值登记）。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
