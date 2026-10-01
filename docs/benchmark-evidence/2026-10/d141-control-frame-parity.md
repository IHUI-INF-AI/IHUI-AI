<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->
# D141 尺子③:Qoder 控制帧 ↔ 我方能力等价性判定表(2026-10-01)

- 立项:PROJECT_PLAN **D141**(取证 2026-09-28);本表为票面验收物:「判定表入库为受跟踪文件;每条真缺必须附我方侧否证命令与输出」。
- 取证物:`G:/Qoder CN/resources/app.asar`(141,361,471 B,v0.4.3 当次实测);SDK 帧面导出件 `.ihui-agent/tmp/d141/qoder-sdk-index.js`(210,275 B,asar 内 `/node_modules/@qoder-ai/qoder-cn-agent-sdk/dist/index.js`,直读工具 `scripts/benchmark-asar-read.mjs`)。
- 复现命令(MSYS 路径改写必须禁用,否则 asar 内路径被转成本地路径):
  `MSYS_NO_PATHCONV=1 node scripts/benchmark-asar-read.mjs "G:/Qoder CN/resources/app.asar" --get "/node_modules/@qoder-ai/qoder-cn-agent-sdk/dist/index.js"`
- 帧枚举形态(三种字面量并集,复现:`grep -oE 'subtype:"[a-z_]+"'` ∪ `grep -oE 'type:"[a-z_]+"'` ∪ `grep -oE 'case"[a-z_]+"'`):原始 106 个名字。
- **计数口径对账**:票面记"77 种控制帧"(2026-09-28);本表 2026-10-01 同 asar 复抽得 106 个原始名,其中 **68 个按能力帧候选逐条探测**(探测脚本 `.ihui-agent/tmp/d141/probe.sh`,逐帧别名组 + `git grep` 否证,底稿 `d141-probe.tsv`),余 38 个为传输/事件形态或权限枚举值(见 §3 排除说明,不参与能力判定)。两轮计数差异来自口径(77 含部分流事件名),本表以**逐帧可复现命令**为准,不沿用任何一轮总数。
- 三态判定纪律(票面):**不得按标识符零命中直接记"没有"** —— 每个零命中帧都做了第二轮放宽别名否证(2026-10-01 实跑),仍零命中且无形态差异解释的才判「真缺」。
- 腾讯 WorkBuddy:本机无取证物(`~/.workbuddy/IDENTITY.md` 自述我方自建体),按票面继续只作 E5 方向参考,不参与有/无判定。

## 1 判定表(能力帧,68 项)

三态:**等价**(我方有,另名,附 file:line 锚点)/ **等价(部分)**(语义有承载、形态或范围有差异,差异写明)/ **真缺**(我方无,附否证命令与当次输出)。

### 1.1 目标族

| 帧 | 判定 | 证据 / 否证 |
| --- | --- | --- |
| `set_goal` | 等价 | `POST /llm/sessions/{id}/goal` → `session_store.set_thread_goal_state`(生产点,见 `apps/ai-service/app/core/sse_contract.py:299-303` 注释);`apps/ai-service/app/routers/goal_verification.py:543` `reset_goal_state`。复验:`git grep -n "set_thread_goal_state" apps/ai-service/app` |
| `get_goal` | 等价 | 会话目标状态单帧 `goal_status`(D152,`apps/ai-service/app/core/sse_contract.py:299`;GoalCard 消费,2026-09-30 收口) |
| `clear_goal` | 等价 | 清除走 `status:'cleared'`,刻意不建第二帧:`apps/ai-service/app/services/agent_events.py:95`;删除目标消息 `apps/api/src/db/chat-queries.ts:1298` |
| `set_goal_max_turns` | 等价(部分) | 轮次上限=引擎规范默认 `apps/ai-service/app/core/doom_loop.py:48` + 请求级覆盖 `apps/ai-service/app/routers/agents.py:492`(空时兜底 8)。差异:无「按目标持久化 max_turns」格 |
| `resume_goal` | **真缺** | 否证(2026-10-01 二轮):`git grep -inE "resumeGoal\|resume_goal\|恢复目标\|continueGoal" -- apps/cli/src apps/api/src apps/ai-service/app apps/web/src packages/*/src` → **0 命中** |

### 1.2 模式/权限族

| 帧 | 判定 | 证据 / 否证 |
| --- | --- | --- |
| `set_plan_mode` | 等价 | `apps/ai-service/app/core/permission_mode.py:343`(llm.py `_resolve_chat_mode` 对 legacy plan_mode 归一)、`:103`(计划模式只读病根修) |
| `get_plan_mode` | 等价 | `apps/ai-service/app/routers/agent_runtime.py:7`(对齐 CLI 5 项 Permission/PlanMode/Sessions/Personas);`apps/api/src/routes/ai-chat-stream.ts:268` `planMode` |
| `set_permission_mode` | 等价 | `apps/ai-service/app/core/executor_switch.py:386,449` `permission_mode` 参数;`core/permission_mode.py` 归一面 |
| `can_use_tool` | 等价 | 唯一谓词 `humanApprovalMandated`(`packages/types/src/tool-contract.ts:513`,契约缺席恒 false)+ `apps/cli/src/tools/danger-gate.ts` + tool-approval 帧族(web/extension/cli 三端,D136 收口) |
| `hook_callback` | 等价 | `apps/ai-service/app/core/hook_runtime.py:37` `HookFunc`;`apps/cli/src/commands/hooks-auto.ts`(钩子自动发现/热重载) |
| `elicitation` / `elicitation_response` | 等价 | `apps/ai-service/app/core/capability_matrix.py:678` `mcp_elicitation_pause`(env `MCP_ELICITATION_PAUSE_ENABLED`) |
| `dont_ask`/`always_*`/`yolo`/`bypass_permissions`/`accept_edits`/`auto` | 等价(形态) | 这些是权限模式**枚举值**非帧;我方对应 `permission_mode.py` 归一 + 审批三档(D84 语义,web 同形) |

### 1.3 执行控制族

| 帧 | 判定 | 证据 / 否证 |
| --- | --- | --- |
| `interrupt` | 等价 | `apps/ai-service/app/core/current_time_reminder.py:54`(对标 TurnAborted::INTERRUPTED 指导文);llm.py abort/取消链路 |
| `cancel_async_message` | 等价 | `apps/ai-service/app/routers/llm.py:121-124`(生成器边排水、网关 abort fetch 取消、流收尾 finally `cancel_all`) |
| `stop_task` | 等价 | `apps/cli/src/tools/background-registry.ts:810`(终止任务,SIGTERM→5s 后 SIGKILL) |
| `background_tasks` | 等价 | `apps/ai-service/app/services/background_tasks.py:46`(`core/capability_matrix.py:363` owner 登记) |
| `rewind` | 等价 | `apps/ai-service/app/routers/checkpoint_rewind.py:86-88` `scope: ^(conversation\|code\|both)$`。**注**:文件 09-28 后由 `services/` 迁至 `routers/`,票面引 `checkpoint_rewind.py:80/99` 现漂移到 `:86-88`(本行即勘误) |
| `rewind_files` | 等价 | 同上 `scope=code\|both` + 文件回滚实现 `:19-20`(`file_editor.rollback_file`,按 checkpoint 内 `file_versions` 执行) |

### 1.4 上下文/模型族

| 帧 | 判定 | 证据 / 否证 |
| --- | --- | --- |
| `get_context_usage` | 等价 | `apps/ai-service/app/core/world_state_sections.py:8-9`(`ContextWindowSection` 上下文窗口元数据 + `TokenBudgetRemaining` 剩余 token 预算) |
| `get_usage_info` | 等价 | 同上预算面 + llm gateway 计费(`core/model_pricing.py`);会话消耗对 UI 可见 |
| `get_models` | 等价 | `apps/api/src/routes/v1-gemini.ts`(ListModels 协议入站)+ `apps/ai-service/app/services/agent_engine.py:2426` `modelRouting` capability |
| `get_model_policy` | 等价(部分) | 同 `:2426` capability 声明承载路由策略;无独立 policy 帧 |
| `set_model` | 等价 | 会话级模型字段(`apps/api/src/routes/chat.ts:628` 当前会话模型,标题生成沿用) |
| BYOK 7 帧(`check/create/get/list/update/delete_byok_config`+`validate_byok_model`) | 等价(形态) | `apps/ai-service/app/core/llm_gateway.py:269-271` BYOK 平台模式(`byok/` 前缀统一路由,2026-07-30)+ 管理面 provider 配置。差异:Qoder 为会话内 CRUD 帧,我方为平台配置面,能力等价、形态不同 |
| `set_proxy` | 等价 | `apps/ai-service/app/core/config.py:542` `proxyConfigVar`;`services/publish/anti_risk/proxy_pool.py:96` `ProxyConfig` |

### 1.5 会话管理族

| 帧 | 判定 | 证据 / 否证 |
| --- | --- | --- |
| `open_session` | 等价 | `apps/ai-service/app/types/api_client.py:514` `LoadSessionData`(载入会话) |
| `close_session` | 等价(形态) | 会话生命周期由 conversations API + 归档承载(browser_hub.py:152 的 close_session 属浏览器会话域,非本帧对位) |
| `delete_session` | 等价 | `apps/api/src/db/chat-queries.ts:311` `deleteConversation`、`:325` 批量 |
| `list_sessions` | 等价 | 侧栏会话列表(`apps/web/src/components/sidebar-chat-history.tsx`)+ chat-queries 列表面 |
| `rename_session` | 等价 | `apps/api/src/db/chat-queries.ts:205`(更新会话标题,2026-09-15 四竞品对标 V2 #15) |
| `generate_session_title` | 等价 | `apps/api/src/routes/chat.ts:621,650` `POST /conversations/:id/auto-title`(票面否证锚点,有效) |
| `resolve_session_artifacts` | 等价(部分) | 会话工件由产物预览面承载(`packages/ui-react/src/lib/artifact-preview.ts` + 消息文件卡);无「会话级工件解析」专用帧 |
| `side_question` | 等价(部分) | 旁路提问语义由子代理帧族(`apps/ai-service/app/core/turn_metadata.py:16` subagent header/kind)与分屏面板承载;无专用 side_question 帧 |
| `add_directories` | **等价(部分)**(2026-10-02 D201 落地,原「真缺」销缺) | 复跑否证(2026-10-02):`git grep -inE "addDirector\|extraDir\|additionalDir\|multiRoot\|addFolder" -- apps packages` → 能力命中 4 文件:`agent_engine.py`(thread.settings 的 `additionalDirectories` 整表替换控制帧,对标 add_directories 语义:追加/移除同帧,空数组=清空)+ `mcp_server.py` 会话级覆盖层(`set_session_extra_roots`/`_validate_path_in_workspace` 的 extra_roots 兜底,deny-by-default 不变)+ `llm.py`(POST /llm/conversations/{id}/directories 控制端点)+ api 侧 `ai-chat-stream.ts`/`chat-queries.ts`(属主校验+会话 metadata 持久化);pytest 钉 `tests/test_d201_additional_directories.py` 11 例。**部分**的残余(如实登记):① engine 自带工具 apply_patch/unified_exec 仍以 thread.workspace 为唯一基,未消费附加集;② 索引/检索范围(CodebaseIndexer/pgvector)未扩附加目录;③ CLI `--add-dir` 与 web/RN 设置面未接线(预填方案 V4 §747 保持指针,web/RN 标平台独占);④ 附加集生命周期=进程内存态,重启须重新下发 |

### 1.6 MCP 族

| 帧 | 判定 | 证据 / 否证 |
| --- | --- | --- |
| `mcp_status` | 等价 | `apps/ai-service/app/routers/mcp.py:878`(契约对齐 api-client `McpScoringDetail`)+ `app/services/mcp_status.py` |
| `mcp_reconnect` | 等价 | `apps/ai-service/app/core/config.py:177` + `app/main.py:473` `max_reconnect_attempts`(重连策略配置化;票面引 `routers/mcp.py:84-85` 现漂移至 config/main) |
| `mcp_toggle` | 等价 | `apps/cli/src/acp/server.ts:427,624` `enableMcp` |
| `mcp_set_servers` | 等价(形态) | `apps/cli/src/commands/mcp-config.ts:208,241` `saveMcpConfig`(配置文件级保存;非会话内热更;D202 补:竞品锚点比对用 routers/mcp.py:372,423,300 运行时 CRUD) |
| `mcp_authenticate` | 等价 | `apps/cli/src/commands/mcp-config.ts:17,50` `MCPAuth` |
| `mcp_oauth_callback_url` | 等价 | `apps/ai-service/app/services/mcp_client.py:43,83`(`MCPOAuthClient`/`MCPOAuthConfig`) |
| `mcp_inject_token` | 等价 | `apps/ai-service/app/routers/engine.py:347` `reset_mcp_principal(token)` |
| `mcp_clear_auth` | **真缺(刻意)** | 否证(2026-10-01):`git grep -inE "clearAuth\|clear_auth\|清除.*凭据" -- apps/ai-service/app apps/api/src apps/cli/src` → 命中的是**不可清除口径**本身:`app/services/agent_engine.py:4414`、`app/routers/engine_voice.py:151`(「可清除的是业务元数据,不是授权凭据」,AGENTS §5 口径)与 web 会话 cookie 工具(`auth.ts:38`,非 MCP)。运行时清除 MCP 凭据口不存在,系安全口径下的刻意设计——补齐前须先过 §24 拍板。D202 补形态说明:竞品把 OAuth 放宿主-CLI 线是因进程分离架构;我方服务端持有形态下「可清除口」仍属 AGENTS §5 禁区 |

### 1.7 插件/技能/记忆族

| 帧 | 判定 | 证据 / 否证 |
| --- | --- | --- |
| `list_plugins` | 等价(形态) | `apps/api/src/routes/admin/relay-plugins.ts:15,75` `listPlugins`(中继插件管理域;管理面非会话帧) |
| `reload_plugins` | **真缺** | 否证(2026-10-01 二轮):`git grep -inE "reloadPlugins\|reload_plugins\|热重载.*插件" -- apps/cli/src apps/api/src apps/ai-service/app apps/web/src packages/*/src` → 0 命中 |
| `reload_skills` | **真缺** | 否证(2026-10-01 三轮):`git grep -inE "reload\|refresh\|重载\|刷新" -- apps/ai-service/app/routers/ai_skills.py` → 0 命中(skill 面只有调度与统计,无运行时重载口)。**D202 防翻案注记**:`services/skills.py:777` 有 `reload_auto`(mtime 驱动增量重载,引擎自扫描、非宿主可调口)——自动重载≠宿主可调控制帧,真缺维持 |
| `flush_memory` | 等价(部分) | `apps/api/src/routes/v1-knowledge-tools.ts:299` `saveMemorySchema`(记忆写入口,REST 非 SSE 帧) |
| `refresh_memory` | **真缺** | 否证(2026-10-01 二轮):`git grep -inE "refreshMemory\|refresh_memory\|记忆刷新" -- apps/cli/src apps/api/src apps/ai-service/app apps/web/src packages/*/src` → 1 处(`app/services/agent_longterm_memory.py:278`,内部 `refresh updated_at`,非运行时刷新帧) |
| `flush_skill_evolution` / `skill_evolution_should_review` | 等价 | `apps/ai-service/app/core/capability_matrix.py:233-234` `skill_evolution`(+`SKILL_EVOLUTION_ENABLED`);`app/main.py:389` L3 自进化调度器 |
| `memory_should_generate` | 等价 | `apps/ai-service/app/services/agent_longterm_memory.py`(长期记忆生成链) |

### 1.8 其余能力帧

| 帧 | 判定 | 证据 / 否证 |
| --- | --- | --- |
| `fetch_job_token` / `fetch_service_account_token` | 等价(形态) | `apps/ai-service/app/services/control_autonomy.py:195` `checkInternalServiceToken`(AI_CALLBACK_SECRET 同源钥匙);`app/services/mcp_server.py:580` `service_account.json`。差异:我方为内部服务票据,无 CLI 级 job token 帧 |
| `account_info` | 等价 | SSO userinfo:`apps/ai-service/app/core/sso.py:315` |
| `agent_metadata` | 等价 | `apps/ai-service/app/core/turn_metadata.py:16,306`(子代理 header/kind) |
| `apply_flag_settings` | 等价 | `apps/ai-service/app/services/agent_engine.py:2440-2444` `capabilities.featureFlags` 暴露 |
| `cloud_agent_event` | 等价(部分) | 云端代理页面承载(`apps/web/src/components/sidebar/nav-data.ts:400` `/cloud-agent`);无同名 SSE 帧 |
| `keep_alive` | 等价 | `apps/ai-service/app/routers/llm.py:230` `_APPROVAL_KEEPALIVE_INTERVAL=15`(审批等待期 SSE 注释帧,防网关 30s 读超时;D202 补:竞品侧为 daemon v2 wire 心跳,见 qoder-control-frames.md 线层封套) |
| `feedback` | 等价 | `apps/ai-service/app/routers/ai_skills.py:34` `skill_feedback_tracker`(失败反馈统计)+ 反馈面 |
| `seed_read_state` | 等价(部分) | 已读/未读态由会话已读管理承载;无 seed 帧 |
| `initialize` | 等价 | 引擎启动握手 + capability 声明(`agent_engine.py:2440`) |

## 2 真缺汇总(在账 3 项,全部附否证;刻意档 1 项;`add_directories` 已于 2026-10-02 由票 D201 落地销缺,行保留作去向记录)

| 帧 | 一句话差距 | 依赖/去向 |
| --- | --- | --- |
| `resume_goal` | 已清/已完成目标无恢复口 | 并入 D152 目标族产品化时一并拍板 |
| `add_directories` | 多根工作区(会话中途追加目录),Codex/Qoder/Trae 三家都有 | **已落地(2026-10-02,票 D201)**:thread.settings additionalDirectories 控制帧 + 会话级路径校验覆盖层 + 控制端点,见 §1.5 该行;残余(CLI/web/索引面)见该行注记 |
| `reload_plugins` / `reload_skills` | 插件/技能无运行时热重载口 | 并入插件面/技能面产品化 |
| `refresh_memory` | 记忆无运行时刷新帧(仅内部 updated_at) | 并入长期记忆产品化 |
| `mcp_clear_auth` | MCP 凭据无运行时清除口(**刻意**,AGENTS §5 口径) | 如需补齐先过 §24 拍板,不得顺手开 |

## 3 排除说明(38 名,非能力帧,不判定)

传输/事件形态:`user text system tag data event result error success mirror_error action write end relocated sdk qodercli worker status_event process session_input session_output plan id default` —— 我方由 `core/sse_contract.py` 帧契约承载同语义,协议形态差异不构成能力缺失。
控制多路复用:`control_request control_response control_cancel_request` —— SDK 内部 frame multiplexing 机制,我方 SSE 单流+帧类型承载。D202 对账补列 `control_cancel`(复用取消)、`keepalive`(线层心跳)两名,消除原 36≠38 枚举缺口。
权限枚举值:`dont_ask always_allow always_ask always_deny yolo bypass_permissions accept_edits auto`(已并入 §1.2 行)。

## 4 方法论备注

- 探测面:`apps/cli/src` `apps/api/src` `apps/ai-service/app` `apps/web/src` `packages/*/src`,一律排除 `*.test.*`/`*.spec.*`;全仓检索禁按单标识符定论(票面纪律),零命中帧均做第二轮放宽别名 + 第三轮定点(router 内复读)否证。
- 底稿可复跑:`.ihui-agent/tmp/d141/probe.sh` → `d141-probe.tsv`(68 帧 × 命中数 × 样例);SDK 帧枚举 `frames-raw.txt`(106 名)。
- 锚点漂移勘误两条:`checkpoint_rewind.py` services→routers(rewind 引 :80/99 → 现 :86-88);`mcp_reconnect` routers/mcp.py:84-85 → 现 config.py:177 + main.py:473。


## §7 D202 并集补遗(2026-10-01,单边帧判定收编)

对账结论:两表并集 88 名(共同 51 + 仅表 A 14 + 仅表 B 23)。仅表 A 判定、本表原缺行的帧,在此收编(采表 A 锚点,均经只读复核):

| 帧名 | 判定 | 锚点/依据 |
| --- | --- | --- |
| `shutdown` | 竞品也无·不构成差距 | 表 A §二(dist 生命周期面);我方会话生命周期由宿主管理,无对应控制帧语义 |
| `mcp_message` | 等价(形态) | 表 A 锚 mcp.py:769-770,820-821;我方 SSE 帧类型承载同语义 |
| `enable_remote_projection` / `disable_remote_projection` | 竞品也无·不构成差距 | 表 A §三(桌面投影面);我方无投影域 |
| `daemon.auth.*` 前缀变体 | 等价(形态) | `control_autonomy.py:195` `checkInternalServiceToken` + `mcp_server.py:580` service_account 票据承载 |
| `get_models` | 等价(核对无冲突) | 本表既有模型列举锚点维持 |

逐名归属与冲突裁决全录见 **D202 对账正本**:`docs/benchmark-evidence/2026-10/d202-frame-union-reconciliation.md`(88 名并集归属表 · 19 冲突行裁决 · 两表收敛记录)。
