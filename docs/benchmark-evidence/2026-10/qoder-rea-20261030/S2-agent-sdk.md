<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# S2 — Qoder CN 0.4.11 `@qoder-ai/qoder-cn-agent-sdk` 运行时能力取证

> 认领@2026-10-30/S2

目标根:`G:\Qoder CN\.qoder-versions\0.4.11\resources\app.asar.unpacked\node_modules\@qoder-ai\qoder-cn-agent-sdk\`
取证席:只读;结论分 [观察]/[推断]/[未知]。

## 1. 包结构与逻辑主战场 [观察]

- 目录只有 `dist/_worker/` 一棵;**该 unpacked 负载里没有 package.json / exports / bin**(`find` 全量 213 文件,根层 0 文件)。即:这一格是「worker 运行时资产包」,不是可 import 的 npm 包;真正的公开 SDK 是另一个包 `@qoder-ai/qoder-agent-sdk`(见 `builtin/sdk/SKILL.md` 第 18 行:它 spawn `qodercli` 子进程,走双向 JSONL 协议,入口 `query()` 返回 `AsyncGenerator<SDKMessage>`)。
- 版本与构建事实:`dist/_worker/runtime-info.json` → `name: qoder-worker-runtime` / `version: 1.1.75-hotfix.1` / `profile: platform` / `target: win32-x64` / `entrypoint: qoder-worker-runtime.obf.mjs` / `git.commit cb3c036a38ba56e4a9aba7079186de52ae2e482d` / `build.site cn`、`productName qoderclicn`。
- 体积排序(字节):`qoder-worker-runtime.obf.mjs` 34,389,777(唯一逻辑体,855 行、最长行 19,680,122 字符)、`vendor/ripgrep/x64-win32/rg.exe` 5,440,512、`builtin/hook-config/SKILL.md` 22,335、`proto/chat.proto` 8,366、`runtime-info.json` 2,568。
- 字符串混淆:`const _$d=(s,k="Rni9LeZSmPXE")=>…base64+XOR`(包首行),提示词/描述类字符串全部编码。本席写辅助器 `G:\IHUI-AI\.ihui-agent\tmp\qoder-rea\s2\decode.mjs` 解出 1,331,115 B 明文(`s2/decoded.txt`),再用 `s2/ctx.mjs`(indexOf 窗口法,避免 34 MB 单行正则回溯超时)定位常量区。
- 原生依赖线索(`runtime-info.json` 的 `copiedPackages`):`@lydell/node-pty`(真 PTY)、`sharp` + `@img/sharp-win32-x64` + `@silvia-odwyer/photon-node`(图像编解码/缩放)、`keytar`(OS 钥匙串存凭据)、`semver`、`detect-libc`。⇒ 视觉输入管线、持久交互终端、系统级凭据存储都是内置能力。
- vendor 插件两枚:`vendor/qoder-security/`(`.qoder-plugin/plugin.json`:name security-scan、version 0.9.5、category Coding、hooks → `.qoder-plugin/qoder-hooks.json`、skills → `./skills/security-scan`;实测 hooks 事件 = SessionStart / PostToolUse(matcher `Edit|Write|MultiEdit|NotebookEdit|Bash`) / Stop)+ `vendor/qoder-sites/`(sites-building / sites-hosting / sites-management / sites-build-agent-app 四 skill,含 SSE/WebSocket/realtime 语音资产与 `artifact.json`)。

## 2. 内置工具集(tool registry)[观察,证据 = 包内偏移]

工具名常量集中区 `@1117740–1118900` 与 `@1616200–1617100`;`ALL_BUILTIN_TOOL_NAMES` 变量 `WVA` 在 `@1616957`,**共 38 枚**(解析变量名后的字面量):
Glob、TodoWrite、Write、WebSearch、ImageSearch、WebFetch、Edit、Bash、PowerShell、Monitor、TaskStop、BashInput、BashOutput、BashResize、Grep、Read、Skill、AskUserQuestion、TaskCreate、TaskGet、TaskUpdate、TaskList、GetGoal、CreateGoal、UpdateGoal、EnterPlanMode、NotebookEdit、ExitPlanMode、UpdateTopic、CompleteTask、ImageGen、VideoGen、VideoGenRetrieve、CronCreate、CronDelete、CronList、ScheduleWakeup、Agent、EnterWorktree、ExitWorktree、Workflow。
另有不在 WVA 但已实现的:`ListAgents`(`F9e`)、`ListPeers`(`msi`)、`RunWorkflow`(`K0e`)、`StructuredOutput`(`xT`,子代理强制结构化出口)、`GrepRipgrep`(同 `Grep` 名的 rg 变体)、MCP 元工具 `mcp_list`/`mcp_get`/`mcp_call`(`@23412388`)。

参数键(同区常量逐字):
- `Read`: `file_path`(必填)、`offset`、`limit`、`pages`;超限回 `<system-reminder>Warning: the file exists but the contents are empty.` / `PARTIAL view: showing lines …`(decoded.txt:9843、15432)。
- `Glob`: `pattern`(必填)、`path`、`case_sensitive`、`respect_git_ignore`、`respect_gemini_ignore`、`file_filtering_options`。
- `Grep`: `pattern`、`path`、`glob`、`output_mode`、`-B`/`-A`/`-C`/`-n`/`-i`、`type`、`context`、`head_limit`、`offset`、`multiline`、`include_pattern`、`exclude_pattern`、`names_only`、`max_matches_per_file`、`total_max_matches`、`fixed_strings`、`after`、`before`、`no_ignore`。
- `Write`: `file_path`+`content`;`Edit`: `old_string`+`new_string`+`allow_multiple`;`NotebookEdit`: `cell_id`/`cell_type`/`edit_mode` 形制。
- `Bash`(`@1591303`): `command`+`description`+`run_in_background`+`timeout`+`dir_path`;PTY 家族 `BashInput`/`BashOutput`/`BashResize` 带 `pty`/`cols`/`rows`/`wait_ms`/`idle_ms`,`Monitor` 为终端观察器。
- `WebFetch`: `url`+`prompt`;`WebSearch`: `query`+`allowed_domains`+`blocked_domains`;`ImageSearch`: `query`+`count`。
- `ImageGen`(`@33983447`): `name`+`prompt`+`size`+`images`(图生图);`VideoGen`: `name`/`mode`/`prompt`/`media`/`size`/`duration_seconds`/`delivery`,`VideoGenRetrieve`: `video_id`。⇒ 生图与生视频是**工具级**能力,不是插件。
- `AskUserQuestion`: `questions[]`{`question`,`header`,`options[]`{`label`,`description`,`preview`},`multiSelect`},回执键 `answers`/`annotations`/`metadata`。
- `ExitPlanMode`→`plan_filename`;`EnterPlanMode`→`reason`;`UpdateTopic`→`title`/`summary`/`strategic_intent`。
- `TodoWrite` 状态枚举 `@1610813`:`pending|in_progress|completed|cancelled|blocked`(比 Claude 的三态多 cancelled/blocked)。
- `Skill`:参数 `skill`(+`args`)。
- 属性面(类式工具,`@19902804`):`get isReadOnly(){return fst.includes(this.kind)}`,`fst=["read","search","fetch"]`,`@1616230` 处 kind 全集含 `"execute"`/`"other"`/`"workflow"`;并 `isConcurrencySafe()`、`isDestructive()`、`isOpenWorld()`(开放世界=有外部副作用)、`interruptBehavior()`(默认 `"block"`)、`requiresUserInteraction()`、`toClassifierInput()`(把入参截 4000 字符喂风险分类器)、`maxResultSizeChars`(Workflow = 1e5)、`validateParams`。
- 分组常量:`GVA=Set(Edit,Write,NotebookEdit)`(改文件)、`FlA=Set(BashInput,BashOutput,BashResize)`、`jsc=Set(Glob,Grep,Read,Write,Edit,Bash,PowerShell)`、`Tcn=Set(TaskCreate,TaskGet,TaskList,TaskUpdate)`、`bcn=Set(Cron*)`、`YVA`(plan/交互/生成类集合)、`Mcn=Tcn∪bcn`。
- 钩子可用工具白名单:`static AGENT_HOOK_DISALLOWED_TOOLS = Set([Agent, EnterPlanMode, ExitPlanMode, AskUserQuestion, TaskCreate, TaskStop, TaskOutput])`(`@24051491`)——**agent 型 hook 自带禁调工具集**。

## 3. 内置 agents / skills [观察]

- 内置 skill 四枚:`builtin/agent-creator`、`builtin/hook-config`、`builtin/sdk`、`builtin/skill-creator`,前与后三枚 frontmatter `allowed-tools: Edit, Write`;`sdk/SKILL.md` 的 description 本身就是路由触发词表(`query()`/`createSdkMcpServer`/`tool()`/`accessTokenFromEnv`/`canUseTool`)。
- Agent 定义字段表(`builtin/agent-creator/SKILL.md:88-94`):`tools`(string 或数组)、`model`、`color`、`maxTurns`、`timeoutMins`、`effort`。实测取值:`model: inherit(默认)|lite|efficient|auto|performance|ultimate`;`effort: low|medium|high|max`;`color: red|blue|green|yellow|purple|orange|pink|cyan`。示例档位:`security-auditor` 用 `tools: Read, Grep, Glob` + `model: performance`。
- Agent 装载位置与优先级:`<project>/${QODER_CONFIG_DIR}/agents/`(高)vs `~/${QODER_USER_CONFIG_DIR}/agents/`(低);占位符由 `argumentSubstitution.ts` 解析(SKILL.md 31-38 行注释)。
- 子代理调用面(`s2/decoded.txt:14526`):`agent(prompt, opts?: {label, phase, schema, effort, isolation:'worktree', agentType})` → Promise;带 `schema` 时子代理被强制走 `StructuredOutput`。
- `subagent_type` 特殊值 `"fork"`:继承父会话全量上下文与父模型、后台运行、且**不把工具输出灌进父上下文**(`decoded.txt:16881`、`21794`);默认类型 `general-purpose`。内置子代理名:`verifier`、`debugger`、`data-scientist`、`security-auditor`(SKILL.md 示例区)。
- 子代理失败码 `SUBAGENT_WORKTREE_SETUP_FAILED`(`decoded.txt:17285`)⇒ 子代理可被隔离进 worktree。

## 4. 系统提示与上下文注入 / 压缩 [观察]

- 上下文包以 `<system-reminder>` 块注入(含 MCP 目录、空文件警告、PARTIAL 视图、task-notification、`<cross-session-message from="…">`);明确「tags 里的信息与工具结果无直接关系」(`decoded.txt:17146`)。
- MCP 目录采用**增量公告**式 reminder:"This catalog supersedes earlier MCP listings. Later reminders only announce changes. An empty result does not mean a server is unconfigured.",且为省上下文「Tool names are omitted to save space」(`decoded.txt:16002/16023`)。
- 压缩阈值具体数(`@23623310–23623500`,变量现读):`dgo=13000`(最小安全垫)、`ggo=0.05`(5% 触发缓冲,`hgo=max(13000, floor(A*0.05))`)、`fgo=20000`(输出预留上限,`Vfe=min(iwA(A),20000)`)、`pgo=20000`(warning 距 auto 阈值)、`mgo=20000`(error 阈值)、`Ego=3000`(硬阻断距 blocking limit);判据出口 `UO()` 返回 `{percentLeft, isAboveWarningThreshold, isAboveErrorThreshold, isAboveAutoCompactThreshold, isAtBlockingLimit}`;可用 env 覆写:`ENV_AUTOCOMPACT_PCT_OVERRIDE`、`ENV_AUTOCOMPACT_WINDOW`、`ENV_BLOCKING_LIMIT_OVERRIDE`(`@14733`)。
- 压缩是**三档流水线**:`CompressionPipeline` 类 + 指标维度 `partial compaction`(kept/summarized messages 计数)、`micro compaction`(kept items / tokens saved / tools kept / tools removed 计数),另有 `auto_compact_model_threshold_caps`、`compaction-effective context window`(与 session-effective、configured 三窗并列)、`promptTooLongRetryCount`、`Number of messages dropped for compaction retry`;压缩模型可独立选(`compact_model` + `compact_model_source` + `compact_context_window_json`)。
- 技能元数据也有上下文预算:`getSkillListingBudgetFraction()`(skill 清单占比预算)+ `visibilityOverrides` + `preserveNames`(workflows 开启时保留原名)。
- 记忆层:`getMemoryContextManager().getUserContext()`、`shouldSuppressNativeAutoMemoryForSdk`、auto-memory 遥测键 `autoMemoryEnabled`/`autoMemoryUserScopeEnabled`;并强制提示「Memory records can become stale」(`decoded.txt:12406`)。

## 5. 模型与推理档位 [观察]

- proto 权威枚举:`proto/chat.proto:13-21` `ReasoningEffort = UNSPECIFIED/NONE/LOW/MEDIUM/HIGH/XHIGH/MAX`(七档,含 `xhigh`/`max`)。
- tier 集合 `@26563413`:`fLu = new Set(["auto","ultimate","performance","efficient","lite"])`(5 档,`Btr` 各带展示名)。`CodebaseInvestigator` 工具存在(`GJe`)。
- 模型目录条目形态 `@19502523`:`{modelId:"qwen3.8-max", displayName:"Qwen 3.8 Max", contextWindow:1e6, maxOutputTokens:32e3, capabilities:{tools:true, vision:true, cacheControl:true, thinking:{…}}, maxTokensField:"max_completion_tokens"}`;`CacheControl` 有 `type:"ephemeral"` + `ttl:"1h"` + `scope:"global"`(`@19502700`)。
- BYOK:`proto/chat.proto:221-229` `CustomModelConfig{name,url,style,provider,type,model,parameters}`;请求侧 `custom_model=24`、env `ENV_BYOK_OVERRIDE_ORG`;鉴权源枚举 `["user","project","org","temporary","oauth","none"]`(`@23525225`)。
- per-agent 覆盖:agent frontmatter `model`/`effort`/`maxTurns`/`timeoutMins` 已证;`q.setModel()`、`pickQueryOverrides`、`getEffectiveContextWindow(model)`、`inferenceRoute` 字段亦在跑。

## 6. 权限与安全 [观察]

- permission mode 的 Zod 枚举(`@23525225`,6 值):`["default","acceptEdits","bypassPermissions","plan","dontAsk","auto"]`——`dontAsk` 与 `auto` 是文档表(`sdk/SKILL.md:220-225`)之外的两档。SDK 文档另给 `allowDangerouslySkipPermissions: true` 前置。
- 规则面:`permissionRuleValueFromString`/`permissionRuleValueToString`/`permissionRulesFromStartup`/`persistPermissionUpdate(s)`/`loadAllPermissionRulesFromDisk`/`createSettingsWriter`;规则文本支持 `"ToolName(glob)"` 与 `mcp__*`、`mcp__*__*`、`mcp__server`、`mcp__server__*` 通配(`@24092258`);设置来源枚举 `QG = Runtime/Project/User/Local/System/Plugins/Flag`(`@22772175`)。
- 命令风险判定是**逐命令读只判定**:`@22331351` 起按 argv[0] 分类(echo ⇒ readOnly、printf ⇒ 依参判定),`@22334450` 含 dangerous-callback 检测与 git 逃逸抑制(`-c `、`--exec-path`);Plan 模式文案「This context only permits read-only shell commands…」「Only read-only shell commands are permitted in this context」。`allowedPrompts: array of {tool, prompt}` 出现在审批 schema 里(一次批准→后续同类免批)。
- 沙箱:未见 OS 级沙箱开关(无 `dangerouslyDisableSandbox`);`vm.createContext` 仅用于 experiment-policy 求值(`@22631453`,`codeGeneration:{strings:false,wasm:false}`)。⇒ [推断] 风险控制靠「读只判定 + 分类器 + 审批规则 + worktree 隔离」四件,而非容器沙箱。
- hook 事件全集(枚举对象 `Ou`,起始 `@22771526`;现数 **28 项**,逐字):PreToolUse、PostToolUse、PostToolUseFailure、SubagentStart、SubagentStop、SessionStart、SessionEnd、Setup、PreCompact、PostCompact、Stop、StopFailure、QueryEnd、UserPromptSubmit、Notification、ConfigChange、TeammateIdle、InstructionsLoaded、CwdChanged、FileChanged、WorktreeCreate、WorktreeRemove、Elicitation、ElicitationResult、TaskCreated、TaskCompleted、PermissionRequest、PermissionDenied —— 其中 `Setup`/`Elicitation`/`ElicitationResult`/`QueryEnd`/`StopFailure`/`TeammateIdle`/`PermissionDenied` 等**文档 `hook-config/SKILL.md` 未列全**(文档缺 Setup/Elicitation/ElicitationResult 三项)。同区紧随其后的是 handler 型枚举(`command`/`http`/`prompt`/`agent`)。handler 四型 `command|http|prompt|agent`,字段 `matcher/sequential/async/timeout/statusMessage/if/asyncRewake/rewakeMessage/rewakeSummary`;`asyncRewake` 用 exit 2 唤醒模型,one-shot headless 下自动降级同步(`hook-config/SKILL.md:93-101`)。
- 凭据:`keytar`(OS keychain)+ 品牌 env 前缀 + `BRAND_AUTH_PROVIDER_ID`;本席未读任何 `.auth`/`.dat` 内容。

## 7. MCP [观察]

- 既是客户端也提供服务端:客户端侧配置在 `options.mcpServers`(插件 manifest 亦带 `mcpServers` 字段,`@19949437`),内置默认 `f6l={mcpServers:{}, mcp:{enableAllPr…}}`(`@23169044`);服务端侧出口 `createSdkMcpServer({name,tools:[tool(name,desc,zodShape,handler)]})`,in-process 注册,工具全名 `mcp__<server>__<tool>`(`sdk/SKILL.md:188-213`)。
- 命名/解析:`rE="mcp__"`、分隔 `mD="__"`(`@1615174`);品牌前缀归一函数 `lce()` 会把 `<cli>_`/`<cli>.`/`<brand>.`/`<brand>_` 都折成规范名。
- lazy-loading 两机制:`VVA="discovered_tool_"`(工具发现前缀,`@1616934`)+ 三元工具 `mcp_list({keyword,includeDescription})` / `mcp_get({toolName})` / `mcp_call({toolName,arguments})`(`@23412388`,遥测 `mcp_operation`→list/get/call);目录 reminder 只对部分 server 展开工具名并教用 keyword 前缀再查。另有 `createEagerMcpToolChecker`、`mcp-server-suppressed-duplicate`、MCP OAuth 错误码 `mcp_oauth_authorization_denied/provider_unavailable/authorization_failed`、企业治理键 `enterprise.mcp-governance.policy`。
- 未发现 `mcp-router` 这类独立文件;`mcpServers` 是 settings/plugin 内联 JSON,`.mcp.json`/`mcp.json` 作为插件检查项存在(`@19955322`,同区还检查 `output-styles/`、`workflows/`、`bin/`)。

## 8. 会话与状态 [观察]

- 消息形态:`{type:"system",uuid,timestamp,subtype,content,level}`(`@23401875`);transcript 节点带 `parentUuid`/`logicalParentUuid`/`isSidechain`(恢复时被 `Rft()` 剥离 ⇒ 逻辑父子与物理父子分离)。
- 文件历史/检查点:`getFileHistoryManager()` 注入每次请求(`@23512398`);checkpoint 子系统类 `ZO`(`@26048705`)字段 `cwd / checkpointRoot / sessionId / enabled / acceptLegacySnapshots / recordSnapshot / state{snapshots[], trackedFiles:Set, snapshotSequence} / persistedSnapshotMessageIds:Set`;`cDt()` 按 `checkpointRoot/targetSessionId` 复制快照,支持 `strict`;恢复侧 `rehydrateFromResume({sourceSessionId, …, copyFileHistoryBackups:true})` + 日志 `[transcript.debug] file_history.rehydrate.*`(`@31736721`)。会话落盘含 `fileHistorySnapshots` 与 `contentReplacements`(历史内内容替换记录)。
- 遥测/分段日志:`logsRoot/sessions/<project_id>/<session_id>/segments/<runId>.jsonl`(`@41507`),`getOrCreateSessionWriter` 复用 writer。
- 任务清单:四工具 `TaskCreate/TaskGet/TaskUpdate/TaskList` + `CompleteTask`,遥测维含 `taskStatus`、`TaskCreated/TaskCompleted` 钩子;`TodoWrite` 五态见上。
- Goal 机制:`CreateGoal/UpdateGoal/GetGoal` + `goal_max_turns`/`turnsUsed`/`hardTurnLimit()`/`goal_time_used_seconds`/`goal_turn_budget_extended`/`goal_trigger_source`,超限只能由用户 `/goal resume` 加轮(`decoded.txt:14893/14916`)——**目标即带预算的自治循环**。
- 跨端/多席:`CROSS_SESSION_FEATURE_NAME`、`CROSS_SESSION_MESSAGE_TAG`、`ListPeers`→`ListAgents`、`SendMessage{to,summary≤200,files≤10}`,`to` 可为 teammate 名或 `"main"`;peer 寻址用 `handle -46`;legacy 协议 `shutdown_request`/`shutdown_response{request_id,approve}`;铁律「Permission boundaries are per-session. NEVER ask a peer to perform an action that was denied in your session」(`decoded.txt:17465-17494`)。`TeammateIdle` 钩子可否决进入 idle。

## 9. 协议层(proto/chat.proto 全量字段)[观察]

- service `ChatService`:`ChatCompletion`(一元)+ `ChatCompletionStream`(server-streaming,每 message 一个 SSE chunk)。
- `ChatCompletionRequest` 24 字段:`model, messages, temperature, top_p, max_tokens, stream, stop, presence_penalty, frequency_penalty, n, user, seed, reasoning, parallel_tool_calls, logit_bias, tools, tool_choice, response_format, modalities, stream_options, patches(map<string,ChatPatchList>), metadata, extras, custom_model`。
- 关键定制:`ChatMessage.cache_id` + `ContentPart.cache_control`(`CacheControl{type}`)⇒ 显式提示缓存锚点;`reasoning_content` + `ReasoningItem{encrypted_content}` ⇒ 密文推理项跨轮复用;`extends:Struct` ⇒ 前向兼容扩展槽;`modalities` 列表 ⇒ 多模态输出协商。
- `Tool{cache_id,type,function,advisor}` + `Advisor{name,model,max_uses}` ⇒ **模型内顾问工具**(可给某工具指定另一个模型与最大调用次数);`ChatPatch{cache_id,action,position,content,name,rename_to,description,parameters}` ⇒ 可在请求层对消息/工具做 patch(改序、改名、改描述、改参数 schema)。
- `ChatMetadata` 四维:`WorkspaceMetadata{file_count, languages, codebase_status, codebase_soft_status, codebase_external_id, data_policy}`、`BusinessMetadata{id,name,begin_at,product,version,type,stage,sub_task}`、`ContextMetadata{request_id,session_id,task_id,request_set_id,machine_id,client_type,source_session_id}`、`UserMetadata{user_id}`。
- `Usage` 细分:`prompt_tokens_details{cached_tokens, cacheable_tokens}`、`completion_tokens_details{reasoning_tokens}`。
- 运行模式判定(`@1617100` 的 `BL()`):`remote_worker | acp | sdk | tui | headless`——同一运行时同时吃 ACP 协议与 SDK/远端 worker 形态。
- 另有 OpenAI Responses 风格事件字面量(`response.reasoning_summary_text.delta`)与 `ANTHROPIC_MESSAGES` 常量 ⇒ 双协议适配。

## 10. 本项目大概率没有的机制(按证据点名)[观察]

1. **Workflow 工具 + `RunWorkflow`**:`kind:"workflow"`,`parameterSchema` 收 `script`/`scriptPath`/`name`/`resumeFromRunId`(`@25519098`),`resumeFromRunId` 下「已完成的 agent() 调用若 (prompt,opts) 未变则瞬时返回缓存,只有改动或新增的调用重跑」(`decoded.txt:14544`),配套 `workflow-authoring` skill 与 **Ultracode** 会话开关(`decoded.txt:14455/14499`),遥测 `Whether the Workflow execution resumes a prior execution`。⇒ 确定性可重放的脚本化多代理编排。
2. **定时/唤醒**:`CronCreate/CronDelete/CronList` + `ScheduleWakeup`;cron 任务字段 `cron_task_id/kind/create_source/persistence/ttl_days/expression/interval_class/interval_seconds/prompt_sentinel/prompt_length_bucket/workdir`(`@25181738`),含 `interval_once`/recurring 分类。
3. **后台任务生命周期**:`TaskCreate/TaskGet/TaskUpdate/TaskList/TaskStop/TaskOutput/CompleteTask` + `TaskCreated/TaskCompleted` 钩子 + `<task-notification>` 唤醒。
4. **真 PTY 会话**:node-pty + `BashInput/BashOutput/BashResize`(cols/rows/wait_ms/idle_ms)+ `Monitor`。
5. **生成类工具**:`ImageGen`(name/prompt/size/images)、`ImageSearch`(query/count)、`VideoGen`/`VideoGenRetrieve`(mode/media/duration_seconds/delivery/video_id)。
6. **实时语音**:`j8o` 模块含 `checkRecordingAvailability / checkVoiceDependencies / requestMicrophonePermission / startRecording / stopRecording`,并有 `flushRemainingAudio / sendVoiceCompleted / silenceTimer` 的 WebSocket 上行分片(`@26544002`、`@26551274`)。
7. **多席/团队 + 跨会话通信**(第 8 节):`SendMessage`、peer session、`TeammateIdle` 否决、按会话隔离权限边界。
8. **worktree 作为一等工具**:`EnterWorktree`/`ExitWorktree` + `WorktreeCreate`/`WorktreeRemove` 钩子 + 子代理 `isolation:'worktree'`。
9. **Elicitation 协议**:`Elicitation`/`ElicitationResult` 钩子 + ACP 模式 ⇒ 中途结构化索取输入。
10. **三档压缩流水线 + 微压缩的"工具集"维度**(partial/micro compaction 各带 tools kept/removed 计数)、**压缩专用模型与独立上下文窗**。
11. **Advisor 型工具与请求级 patch**(proto `ChatPatch`),`StructuredOutput` 强制子代理结构化出口,`CodebaseInvestigator` 专职代码调查。
12. **安全扫描插件**(qoder-security 0.9.5):pattern warning on edits + cloud diff review on Stop + agentic commit/push review + SHA tracking,自带 cross-platform `qodersec` 二进制与 bootstrap/update/launch 脚本。

## 11. 未知项 [未知]

- 工具级"是否需审批"没有单一布尔字段:实际由 `kind`/`isReadOnly` + 读只判定 + 分类器 + `permissionRules` + mode 五者合成,合成次序未逐行读完。
- WVA 之外是否还有端内私有工具(如 canvas/browser/computer-use)需读 `.obsidian` 之外的宿主应用包,本包只见 skill 层。
- 各 tier 与具体 modelId 的映射表(`Btr` 值是混淆文案,非 id)未解;`auto` 路由策略在 `ModelRoute` 事件里,未展开。
- transcript 主文件的落盘路径/命名(本席只证到 `segments/*.jsonl` 与 file-history 快照面)。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
