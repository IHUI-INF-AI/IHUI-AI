<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# Qoder 控制帧 ↔ 我方能力 等价性判定表(票 D141 步 2/步 3)


> 逐帧三态判定,帧全集与竞品侧原文见同目录 `qoder-control-frames.md`(步 1,版本钉 qoder-cn v0.4.3 +
> SDK dist 常量 `1.0.50`)。本文只判「我方到底有没有、叫什么名」,**禁止**按标识符零命中直接记"我方没有"。
>
> **三态口径**(票面 V4:744):
> - **真缺** = 我方确无等价能力,且它构成用户可见的对话能力差距 ⇒ 必须附我方侧否证命令与输出原文,
>   且**别名集列强制**,缺列即由尺子②(`check:benchmark-delivery`)判"判不出";
> - **我方等价但另名** = 能力在,名字/形态不同 ⇒ 必须附两侧定位(竞品侧 = dist 字节偏移,单行压缩无行号;
>   我方侧 = `git show HEAD:<path>` 可复核的 file:line);
> - **竞品也无 / 不构成差距**(D156 §十二 口径在本表的扩展)= 两种来源:① 帧名在线层**显式不可达**
>   (如 `session_input`/`session_output` 收到即抛);② 帧是**竞品部署形态的内部管道**
>   (daemon 鉴权 / BYOK 商业形态 / SDK 宿主扩展面),不是对话端用户能力 ⇒ 不得按"竞品有帧、我方无帧"开功能票。
>
> **我方侧锚点全部取自 HEAD**(2026-10-01 现读;工作树对上千路径滞后 HEAD,按磁盘判会假绿)。
> 判定结论:**verdict=真缺 共 1 行**(§二 首行)。

## 一、线层封套(6 帧)

| 帧 | verdict | 竞品侧定位 | 我方锚点(HEAD) / 否证 | 备注 |
| --- | --- | --- | --- | --- |
| `control_request` | 我方等价但另名 | dist @122329 分派 + @125282 校验 | `apps/ai-service/app/routers/engine.py:15,474`(帧报文处理:长跑 prompt 不阻塞 interrupt/approval 帧) | 我方为 HTTP/SSE 服务端形态,控制请求=路由端点,无 daemon 信封 |
| `control_response` | 我方等价但另名 | 同上 | 同上 | 同上 |
| `control_cancel_request` / `control_cancel` | 我方等价但另名 | dist x3 命中 | `apps/ai-service/app/routers/agent_runtime.py:356`(`POST /{session_id}/cancel`) | |
| `status_event` | 竞品也无 / 不构成差距 | @125282(仅承载 `daemon.session_updated` 且 `state` 必须 `failed`) | — | daemon 存活状态管道;我方会话状态走 `agent_runtime.py:348`(`GET /{session_id}/status`) |
| `keep_alive` / `keepalive` | 竞品也无 / 不构成差距 | @122329 | — | 长连心跳;HTTP/SSE 形态无此帧 |
| `session_input` / `session_output` | 竞品也无(线层显式不可达) | @122329 逐字:`throw new w(\`${String(t.type)} is not supported on the v2 wire\`)` | — | 帧名存在 ≠ 能力存在 |

## 二、出站控制请求(34 名 + `initialize`/`get_models`)

| 帧 | verdict | 竞品侧定位 | 我方锚点(HEAD) / 别名集 / 否证 | 备注 |
| --- | --- | --- | --- | --- |
| **`add_directories`** | **真缺(唯一)** | dist @80368:`async addDirectories(e){if(!Array.isArray(e))throw new Error("directories must be an array");return await this.request({type:"add_directories",directories:e})}`;CLI 旗标映射 `--add-dir`(每目录一次) | **别名集**:`add_directories`、`--add-dir`、`additionalDirectories`、`additionalDir`、`extraDir`、`multiRoot`、`workspace folders`。**否证命令与输出原文(2026-10-01 现读)**:①`git grep -n -i -I -E "add_director\|additionalDir\|multiRoot" HEAD -- apps packages` → **零命中**;②`git grep -n -F -- "--add-dir" HEAD -- apps packages` → **零命中**;③票面原判据 `git grep -n -i -I -E "add_director\|extraDir\|additionalDir\|multiRoot" HEAD -- apps packages` → 现 4 命中,全部为 `apps/cli/tests/skills-scan-link.test.ts:51,75,82,96` 的测试局部临时目录变量 `extraDirs`(skills 扫描链路测试的 tmp 目录登记),**不是**会话级多根目录能力 —— 票面"零命中"于 2026-09-28 后过期,故判据精化为①②。 | **多根工作区:往当前会话追加目录**。预填方案(需 §24 拍板):`apps/cli` 加 `--add-dir <path>`(可重复)+ `ToolContext.additionalDirectories: readonly string[]`,权限档 **deny-by-default**(越过工作区边界即越过 §5 授权面,追加须逐次批准);web/RN 端本轮不做,标"平台独占:桌面/终端语义"。 |
| `interrupt` | 我方等价但另名 | dist(`still_queued` 回带) | `engine.py:15,474`;`agent_runtime.py:356`(cancel) | |
| `set_model` | 我方等价但另名 | dist(`model:e??""`) | `agents.py:2082,2096`(`modelOverride`);`fim.py:88`(/llm/models 同源基线) | |
| `set_permission_mode` | 我方等价但另名 | dist(5 模式映射) | `engine.py:15,285`(`approval.respond`,以 thread.user_id 为 principal);`agent_plan.py:397-432`(approve/改签状态机);`guardian_context.py:45-55` | 我方无 5 档全局模式开关,审批逐次/计划逐版;语义等价=工具执行前守门 |
| `rewind` | 我方等价但另名 | dist @83409(`scope` 默认 `both`,capability `session_rewind_v1`) | `apps/ai-service/app/routers/checkpoint_rewind.py:85-87`(`pattern="^(conversation\|code\|both)$"`)、`:197-203`(按 scope 执行) | 票面引 `:85-88` 现读漂移为 `:85-87` |
| `rewind_files` | 我方等价但另名 | dist @82971(`user_message_id`+`dry_run`,应答判 `canRewind`) | `checkpoint_rewind.py:83`(`rollbackFiles` 向后兼容,等价 `scope=both/none`)、`:155`(文件回滚) | |
| `generate_session_title` | 我方等价但另名 | dist(`description`+`persist`) | `apps/api/src/routes/chat.ts:621,631`(`POST /conversations/:id/auto-title`) | 票面引 `:544`,现读漂移至 `:621/:631`(标题 utils 在 `:68`) |
| `get_usage_info` | 我方等价但另名 | dist(`usage`+`session`) | `agents.py:2336`(`GET /agents/{agent_id}/token-usage`) | |
| `get_context_usage` | 我方等价但另名 | dist | `packages/shared/src/sse/contract.ts`(`SSE_EVENTS` 含 `usage`/`budget`,31 名契约) | 我方走对话流帧而非控制帧 |
| `initialize` / `open_session` | 我方等价但另名 | dist @69599 + 应答带 `daemon_version`/`capabilities` | `agent_runtime.py:372,385,393`(sessions 列表/详情/resume);`engine.py:474`(帧处理) | 握手/能力协商在我方=服务端常驻,无逐会话握手帧 |
| `list_sessions` / `rename_session` / `close_session` / `delete_session` / `shutdown` | 我方等价但另名 | dist 响应分派面 | `agents.py:1930`(列表)、`:1946`(消息)、`:1979`(`DELETE /agents/sessions/{session_id}`);`agent_runtime.py:348`(status) | rename 无独立端点(会话命名由对话元数据承载,`chat.ts:137,144` title 字段) |
| `mcp_reconnect` | 我方等价但另名 | dist(`serverName`) | `apps/ai-service/app/routers/mcp.py:86-87`(`reconnect`/`max_reconnect_attempts`)、`:444-445`(`POST /mcp/external/servers/{name}/connect`) | 票面引 `:84-85`,现读漂移至 `:86-87` |
| `mcp_status` / `mcp_message` | 我方等价但另名 | dist | `mcp.py:275-280`(`client_status_visible` 判归属)、`:125,132`(tools) | |
| `mcp_toggle` | 我方等价但另名 | dist(`enabled`) | `mcp.py:769-770`(`POST /mcp/store/{name}/enable`)、`:820-821`(disable) | |
| `mcp_set_servers` | 我方等价但另名 | dist(`added/removed/errors` 回带) | `mcp.py:372`(POST external/servers)、`:423`(DELETE)、`:300`(register) | |
| `mcp_authenticate` / `mcp_inject_token` / `mcp_oauth_callback_url` / `mcp_clear_auth` | 竞品也无 / 不构成差距 | dist(四帧组成 CLI 侧 OAuth 面) | 我方 MCP 凭据由服务端管理器持有(`mcp.py:18` jwt 鉴权面) | 竞品把 OAuth 放宿主-CLI 线上是因为进程分离;服务端形态无此线 |
| `flush_memory` / `refresh_memory` / `memory_should_generate` | 我方等价但另名 | dist(宿主回调 + 两个触发帧) | `apps/ai-service/app/routers/agent_memory.py:7,11-15,122`(`/memory/entries` CRUD + 检索) | 我方记忆写入门控在服务端调度,无宿主回调线 |
| `skill_evolution_should_review` / `flush_skill_evolution` | 我方等价但另名 | dist @67412 | `apps/ai-service/app/core/capability_matrix.py:233-238`(`skill_evolution` → `skill_evolution_scheduler.py:89`) | 同名同义,少见的正撞 |
| `reload_skills` / `reload_plugins` / `list_plugins` | 我方等价但另名 | dist(capability `reload_skills_v1`) | `capability_matrix.py:246-247`(`skill_scheduler.py:200`);`mcp.py:190,200,205`(`/mcp/skills` + skill 实体) | "热重载"无独立帧,由服务端调度承担 |
| `set_proxy` | 我方等价但另名 | dist(`proxy:e\|\|null`) | `apps/ai-service/app/core/config.py:199-206`(`llm_proxy_url`/`openrouter_proxy_url`);`apps/api/src/utils/proxy-dispatcher.ts` | 我方为部署级配置,非逐会话帧 |
| `seed_read_state` | 竞品也无 / 不构成差距 | dist @83565(`path`+`mtime`) | — | rewind 的读态种子管道;我方 checkpoint 直接落盘(`checkpoint_rewind.py:133,155`) |
| `apply_flag_settings` | 竞品也无 / 不构成差距 | dist | `capability_matrix.py`(env 门控面)/`config.py` | settings 透传管道 |
| `account_info` | 我方等价但另名 | dist | `mcp.py:18`(`from ..core.jwt_auth import require_request_user_id, resolve_request_role_id`) | 用户身份=JWT 面贯穿全部路由 |
| `get_byok_config` / `list_byok_configs` / `create_byok_config` / `update_byok_config` / `delete_byok_config` / `validate_byok_model` / `check_byok_config` | 竞品也无 / 不构成差距 | dist(capability `byok_config_management_v1`,@52705 常量原文) | `apps/api/src/routes/admin/model-mappings.ts:9-10`(GET/POST /admin/model-mappings,全局/用户/Key 级) | 商业形态差异:竞品桌面端用户自带 key 直连厂商;我方服务端统一网关计费(`llm_call_logs` + `developer_api_keys`)。"用某个第三方模型"的能力我方有,差异只在 key 托管方 |
| `enable_remote_projection` / `disable_remote_projection` | 竞品也无 / 不构成差距 | dist @78679(`remote_session_id`/`from_sequence_num`) | 多端续聊能力由 `agent_runtime.py:393`(resume)承担 | 竞品桌面多窗/远端投影的部署形态管道,非对话能力 |
| `fetch_job_token` / `fetch_service_account_token` / `daemon.auth.fetch_job_token` / `daemon.auth.fetch_service_account_token` | 竞品也无 / 不构成差距 | dist 反向分派 | — | daemon 形态鉴权管道;我方服务间信任由部署面承担 |
| `resolve_session_artifacts` | 竞品也无 / 不构成差距 | dist 反向分派 | `agents.py:1962`(`/agents/sessions/{session_id}/deliverables`) | CLI 工件路径解析;我方服务端直接持有产物 |
| `get_model_policy` | 我方等价但另名 | dist @68536(`purpose/turnIndex/agentType/resolvedModel`) | `agents.py:2096`(`model_override`);`engine.py:209`(provider/model 前缀取厂商) | 逐 turn 模型策略在我方=请求体字段,非宿主回调 |

## 三、入站反向 RPC(宿主回调,4 帧)

| 帧 | verdict | 竞品侧定位 | 我方锚点(HEAD) | 备注 |
| --- | --- | --- | --- | --- |
| `can_use_tool` | 我方等价但另名 | dist @62004(`pending_permission_requests` 批量面) | `engine.py:15,285`(`approval.respond`);`guardian_context.py:45-55` | |
| `elicitation` / `elicitation_response` | 我方等价但另名 | dist @68165(`mcp_server_name/message/mode/url/elicitation_id/requested_schema`) | `capability_matrix.py:678-684`(`mcp_elicitation_pause`,对标 codex ElicitationService) | 如实记录:我方该门控**默认关**(`MCP_ELICITATION_PAUSE_ENABLED`,default false),结构在位、开关未开 |
| `hook_callback` | 竞品也无 / 不构成差距 | dist(18 名 hook 事件数组) | 工具守门由 guardian/`approval.respond` 承担 | SDK 宿主扩展面;服务端形态无宿主进程 |
| `get_model_policy` | 见 §二 同名行 | dist @68536 | — | 反向/正向双登记,判同 |

## 四、验收自证(票面 V4:747)

1. `git grep -F "add_directories" -- docs/benchmark-evidence/2026-09/` → 命中(本文 §二 首行 +
   `qoder-control-frames.md` §二 #2 原文),证明一手帧表已入库;
2. 本表 verdict=**真缺** 行数 = **1**(多根工作区),且该行别名集 + 三条可粘贴否证命令齐备;
3. 反向对照(票面要求):任取一条已否证的等价项(`rewind` → `checkpoint_rewind.py:85-87`),删掉两侧
   定位后由尺子②(`node scripts/audit-benchmark-delivery.mjs --strict`)跑,必须落"判不出"而不是"已交付"
   —— 尺子②的三态口径(D140 步 2)就是按本表同源口径建的。
4. 行号漂移记录(本表现读 vs 票面 2026-09-28 读数):`auto-title` :544→:621/:631;`rewind scope`
   :85-88→:85-87;`mcp reconnect` :84-85→:86-87。三条形态一致,漂移不翻判定。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
