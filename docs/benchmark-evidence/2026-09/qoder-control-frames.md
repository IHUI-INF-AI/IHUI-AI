<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# Qoder 控制帧一手清单(线层封套 + 出站控制请求 + 入站反向 RPC,票 D141 步 1)


> **本文是什么**:Qoder 桌面端 agent SDK 的**控制面**(control plane)帧全集一手穷举 —— 线层封套、
> 出站控制请求、入站反向 RPC 三层逐帧列原文。对话流(用户看得见的流式帧)不在此文,在
> `qoder/chat-stream-inventory.md`。判定「我方有没有、叫什么名」见同目录
> `qoder-control-frames-equivalence.md`(票 D141 步 2)。
>
> **版本钉(复现前必查,版本一变结论就可能作废)**:
> - 竞品产品版本 `qoder-cn v0.4.3`(asar 内 `/package.json`,README 本目录「版本与被取证对象」表已登记);
> - SDK dist 内版本常量 `var et="1.0.50"`(字节偏移 @578,紧随 18 名 hook 事件数组之后);
> - 取证载体 `G:\Qoder CN\resources\app.asar`(2026-10-01 在位,141,361,471 B);
> - 被取文件 `/node_modules/@qoder-ai/qoder-cn-agent-sdk/dist/index.js`(205,839 B,**单行压缩,无行号**,
>   下文一律给**字节偏移** `@N` 定位)。
>
> **取法命令**(工具已由 D157 升为常驻 `scripts/benchmark-asar-read.mjs`,本目录不留副本;必须 Windows
> 形式路径 + `MSYS_NO_PATHCONV=1` 禁 MSYS 路径改写):
>
> ```bash
> export MSYS_NO_PATHCONV=1
> node scripts/benchmark-asar-read.mjs "G:/Qoder CN/resources/app.asar" \
>   --get /node_modules/@qoder-ai/qoder-cn-agent-sdk/dist/index.js > .ihui-agent/tmp/qoder-sdk-index.js
> # 控制帧穷举 = 对整串跑正则(单行压缩,严禁按行):
> node -e "const s=require('fs').readFileSync('.ihui-agent/tmp/qoder-sdk-index.js','utf8');\
>   const re=/\.request\(\{type:\s*\"([a-z_]+)\"/g;let m;const seen=new Set();\
>   while((m=re.exec(s)))seen.add(m[1]);console.log([...seen].sort().join('\n'))"
> ```

## 一、线层封套(daemon v2 wire,`switch(t.type)` @122329)

分派原文(逐字,@122329):

```js
if(Object.hasOwn(t,"protocol_version")&&!Object.hasOwn(t,"type"))throw new w("daemon v1 frame envelopes are not supported on the v2 wire");
switch(t.type){
  case"control_request":cu(t);break;
  case"control_response":lu(t);break;
  case"status_event":uu(t);break;
  case"keep_alive":C(t,["type"],"keep_alive frame");break;
  case"session_input":case"session_output":throw new w(`${String(t.type)} is not supported on the v2 wire`);
  default:if(E(t,"type"),!pu(t.type))throw new w(`unknown daemon messa…`}
```

| 封套帧 | 语义 | 校验原文(偏移) |
| --- | --- | --- |
| `control_request` | 宿主→CLI 控制请求信封 | `C(n,["type","request_id","session_id","request"],"control_request…`(@125282 附近) |
| `control_response` | CLI→宿主 控制应答信封 | `{type:"control_response",response:{subtype:"success",req…`(snake_case 命中 x8) |
| `control_cancel_request` / `control_cancel` | 取消未决控制请求 | `n.type==="control_cancel_request"\|\|n.type==="control_cancel"`(x3) |
| `status_event` | 守护进程状态事件 | `n.status!=="daemon.session_updated")throw…;C(e,["local_session_id","state","error"],…;e.state!=="failed")throw`(@125282) |
| `keep_alive` / `keepalive` | 心跳(两种拼写都收) | `e==="keepalive"\|\|e==="keep_alive"`(@122329 附近) |
| `session_input` / `session_output` | **v2 线上显式不支持**(收到即抛) | 见上方分派原文逐字 |

## 二、出站控制请求(宿主→CLI,`.request({type:"…"})` 全集 = 34 名,按字母序)

每名给方法名(反编译形)与原文片段。偏移 = `String.prototype.indexOf` 首次命中位置。

| # | 帧名 | 调用点原文(节选,偏移见括号) |
| --- | --- | --- |
| 1 | `account_info` | `async accountInfo(){try{let t=await this.request({type:"account_info"});if(t?.account&&Object.keys(t.account).length>0)return t.account}` |
| 2 | **`add_directories`** | `async addDirectories(e){if(!Array.isArray(e))throw new Error("directories must be an array");return await this.request({type:"add_directories",directories:e})}`(@80368) |
| 3 | `apply_flag_settings` | `async applyFlagSettings(e){await this.request({type:"apply_flag_settings",settings:e})}` |
| 4 | `check_byok_config` | `…requireCliCapability(n.BYOK_CONFIG_MANAGEMENT_CAPABILITY),await this.request({type:"check_byok_config",config:e})` |
| 5 | `create_byok_config` | `(await this.request({type:"create_byok_config",config:e})).config` |
| 6 | `delete_byok_config` | `await this.request({type:"delete_byok_config",target:e})` |
| 7 | `disable_remote_projection` | `async disableRemoteProjection(e={}){let t=await this.request({type:"disable_remote_projection"},{requestIdPrefix:n.REMOTE_PROJECTION_REQUEST_ID_PREFIX,…})}` |
| 8 | `enable_remote_projection` | `await this.request({type:"enable_remote_projection",remote_session_id:e,…{suppress_initial_idle_state_events:!0}…{skip_initial_flush:!0}…{from_sequence_num:t.fromSequenceNum}})`(@78679) |
| 9 | `flush_memory` | `async performMemoryFlush(){await this.requireSdkMemoryEnabled(),await this.request({type:"flush_memory"})}` |
| 10 | `flush_skill_evolution` | `async performSkillEvolutionFlush(){await this.requireSkillEvolutionEnabled(),await this.request({type:"flush_skill_evolution"})}` |
| 11 | `generate_session_title` | `(await this.request({type:"generate_session_title",description:e,…{persist:t.persist}}))?.title` |
| 12 | `get_byok_config` | `(await this.request({type:"get_byok_config"}))?.providers??null` |
| 13 | `get_context_usage` | `async getContextUsage(){return await this.request({type:"get_context_usage"})}` |
| 14 | `get_usage_info` | `let e=await this.request({type:"get_usage_info"}),t=gt(e?.usage),s=ft(e?.session)` |
| 15 | `interrupt` | `async interrupt(){let t=(await this.request({type:"interrupt"}))?.still_queued;if(Array.isArray(t))return{still_queued:t.filter(s=>typeof s=="string")}}` |
| 16 | `list_byok_configs` | `(await this.request({type:"list_byok_configs"})).configs` |
| 17 | `list_plugins` | `async listPlugins(){return(await this.request({type:"list_plugins"})).plugins}` |
| 18 | `mcp_authenticate` | `let s=await this.request({type:"mcp_authenticate",serverName:e,…{redirectUri:t}}),o=s?.requiresUserAction===!0` |
| 19 | `mcp_clear_auth` | `async mcpClearAuth(e){await this.request({type:"mcp_clear_auth",serverName:e})}` |
| 20 | `mcp_inject_token` | `async injectMcpToken(e,t){await this.request({type:"mcp_inject_token",serverName:e,token:t})}` |
| 21 | `mcp_oauth_callback_url` | `await this.request({type:"mcp_oauth_callback_url",serverName:e,callbackUrl:t})` |
| 22 | `mcp_reconnect` | `async reconnectMcpServer(e){await this.request({type:"mcp_reconnect",serverName:e})}` |
| 23 | `mcp_set_servers` | `await this.request({type:"mcp_set_servers",servers:t})??{added:[],removed:[],errors:{}}`(@85101) |
| 24 | `mcp_status` | `async mcpServerStatus(){return(await this.request({type:"mcp_status"}))?.servers??[]}` |
| 25 | `mcp_toggle` | `async toggleMcpServer(e,t){await this.request({type:"mcp_toggle",serverName:e,enabled:t})}` |
| 26 | `refresh_memory` | `async refreshMemory(){await this.requireSdkMemoryEnabled(),await this.request({type:"refresh_memory"})}` |
| 27 | `reload_plugins` | `let e=await this.request({type:"reload_plugins"});return this.replaceLatestCommands(e.commands),e` |
| 28 | `reload_skills` | `await this.requireCliCapability("reload_skills_v1"),await this.request({type:"reload_skills"})` |
| 29 | `seed_read_state` | `async seedReadState(e,t){await this.request({type:"seed_read_state",path:e,mtime:t})}`(@83565) |
| 30 | `set_model` | `async setModel(e){await this.request({type:"set_model",model:e??""})}` |
| 31 | `set_permission_mode` | `await this.request({type:"set_permission_mode",mode:t,…{preservePlanMode:!0}})`(mode 合法集见 §五) |
| 32 | `set_proxy` | `async setProxy(e){await this.request({type:"set_proxy",proxy:e\|\|null})}` |
| 33 | `update_byok_config` | `await this.request({type:"update_byok_config",config:e})` |
| 34 | `validate_byok_model` | `await this.request({type:"validate_byok_model",provider:e.provider,model:e.model,api_key:e.api_key,…{url:e.url…}})` |

另有 2 名**不以该字面形态构造**但确在线上(响应分派 `switch(n)` 可见):`get_models`(`{subtype:"get_models",…}`,
动态构造)、`initialize`(`{type:"initialize",modelPolicyProvider:this.resolveModel!==void 0,supportsCatalogReadyInitialize:!0,supportsAvailableModelsUpdate:!0,supportsCommandsChanged:!0,initializeTimeoutMs:n.INITIALIZE_TIMEOUT_…}`@69599)。

## 三、会话管理响应分派面(`So(n,e)` 内 `switch(n)`)

`initialize` / `open_session` / `list_sessions` / `rename_session` / `close_session` /
`delete_session` / `shutdown` / `fetch_job_token` / `fetch_service_account_token` / `get_models` /
`get_byok_config` / `list_byok_configs` / `create_byok_config` / `update_byok_config` /
`delete_byok_config` / `validate_byok_model` / `check_byok_config` / `list_plugins` /
`account_info` / `get_usage_info` / `resolve_session_artifacts`。

样例原文:`case"open_session":{…return E(s,"daemon_version"),mu(s,"capabilities"),s}`(`open_session`
应答必带 `daemon_version` + `capabilities`);`case"rename_session":{rn(e,"rename_session response");…}`;
`case"list_sessions":{q(e,"list_sessions response");…}`。

## 四、入站反向 RPC(CLI→宿主,`switch(t.request.type)`)

| 帧 | 宿主回调原文(节选) |
| --- | --- |
| `daemon.auth.fetch_job_token` / `daemon.auth.fetch_service_account_token` | `switch(t.request.type){case"daemon.auth.fetch_job_token":return Iu(n,t,e);case"daemon.auth.fetch_service_account_token":return Du(n,t,…` |
| `can_use_tool` | `for(let t of e)Be(t.request)==="can_use_tool"&&this.handleControlRequest(t)…`(配 `pending_permission_requests` 批量面,x1 命中 + pending 面) |
| `hook_callback` | `case"hook_callback":{let i=r.callback_id;if(!i)throw new Error("Hook callback missing callback_id");…invokeRegisteredHookCallback(i,r.input,r.tool_use_id,t)}` |
| `mcp_message` | `case"mcp_message":{let i=r.server_name,a=r.message,u=this.sd…` |
| `elicitation` / `elicitation_response` | `case"elicitation":case"elicitation_response":return this.onElicitation?await this.awaitAbortable(this.onElicitation({serverName:r.mcp_server_name??"",message:r.message??r.prompt??"",mode:r.mode,url:r.url,elicitationId:r.elicitation_id,requestedSchema:r.requested_s…`(@68165) |
| `memory_should_generate` | `case"memory_should_generate":{let i=r.callbackId;if(!i)throw new Error("Memory shouldGenerate request missing callbackId");…` |
| `skill_evolution_should_review` | `case"skill_evolution_should_review":{let i=r.callbackId;…shouldReviewCallbacks.get(i)…`(@67412) |
| `get_model_policy` | `case"get_model_policy":{if(!this.resolveModel)return{type:"get_model_policy"};let i={purpose:r.purpose,sessionId:r.sessionId,turnIndex:r.turnIndex,agentId:r.agentId,agentType:r.agentType,resolvedModel:r.resolvedModel,availableModels:r.models??[…`(@68536) |
| `resolve_session_artifacts` | `let s=e.request,o=Be(s),r=s;switch(o){case"resolve_session_artifacts":{if(!this.resolveSessionArti…` |
| `fetch_job_token`(会话形态) | `case"fetch_job_token":{if(!this.fetchJobToken)throw new Erro…` |

## 五、附着枚举(控制面的参数集)

- **权限模式映射**(`toQoderDefaultPermissionMode` / 反向,x1 各):宿主侧
  `acceptEdits / bypassPermissions / yolo / dontAsk / default` → 线侧
  `accept_edits / bypass_permissions / dont_ask / plan / auto`。
  原文:`case"acceptEdits":return"accept_edits";case"bypassPermissions":case"yolo":return"bypass_permissions";case"dontAsk":return"dont_ask";case"default":case"accept_edits":case"bypass_permissions":case"dont_ask":case"plan":case"auto":return e`
- **capability 门**(requireCliCapability / capabilities.includes):`session_rewind_v1`(全量会话回退)、
  `reload_skills_v1`、`byok_config_management_v1`(常量原文
  `static BYOK_CONFIG_MANAGEMENT_CAPABILITY="byok_config_management_v1"`@52705)、`host_action`。
- **hook 事件 18 名**(@4582 附近,数组 Mr):`PreToolUse, PostToolUse, PostToolUseFailure,
  UserPromptSubmit, SessionStart, SessionEnd, Stop, SubagentStart, SubagentStop, PreCompact,
  PostCompact, CwdChanged, InstructionsLoaded, FileChanged, PermissionRequest, PermissionDenied,
  WorktreeCreate, WorktreeRemove`。
- **CLI 旗标映射**(SDK 组装 qodercli 命令行):`--setting-sources`、`--disable-builtin-skills`、
  **`--add-dir`(每个 additionalDirectory 追加一次)**、`--max-turns`、`--plugin-dir`、
  `--fork-session`。原文:`t.additionalDirectories&&t.additionalDirectories.length>0)for(let r of t.additionalDirectories)e.push("--add-dir",r)`
- **rewind 两帧参数**:`rewind_files`:`{type:"rewind_files",user_message_id:e}`(+`dry_run`),
  应答判 `canRewind`;`rewind`:`{type:"rewind",user_message_id:e,scope:t?.scope??"both"}`(+`dry_run`),
  先查 `capabilities?.includes("session_rewind_v1")` 否则抛(@83409)。

## 已知边界

1. 本文只穷举**控制面**;对话流帧(`user/assistant/system/result/tool_use/tool_result/…`)在
   `qoder/chat-stream-inventory.md`,两文不互相代替。
2. dist 单行压缩,"行号"不存在,偏移随版本漂移 —— 复现时按帧名重搜,别按偏移。
3. `session_input`/`session_output` 与 daemon v1 封套**在线层显式抛"not supported"**:帧名存在
   不等于能力存在(判定表按"竞品也无"处置的来源之一)。
4. 全部结论为**静态取证**(包内字面量),未跑过一次真实 qodercli 会话(D150 同款限定)。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
