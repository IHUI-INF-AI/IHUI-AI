<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->
# D202 对账:双 D141 判定表口径对账(帧名并集归属 · 冲突清单 · 收敛记录)

- 立项:PROJECT_PLAN **D202**(2026-10-01 立);本文件为票面验收物(2026-10-01 收口入库,§5 建议已执行:表 B 已补强、表 A 已指针化改判):「①帧名并集成员级归属表;②真缺判定向覆盖面更全、判据更严者对齐;③收敛后留一份正本 + 一份指针」。
- 对账对象:
  - **表 A**(S15-④ 谱系):`docs/benchmark-evidence/2026-09/qoder-control-frames.md`(帧表,票 D141 步 1)+ `docs/benchmark-evidence/2026-09/qoder-control-frames-equivalence.md`(逐帧三态判定,票 D141 步 2/步 3);
  - **表 B**(尺子③谱系):`docs/benchmark-evidence/2026-10/d141-control-frame-parity.md`(106 原始名 → 68 能力帧候选 → 58 判定行)。
- 本对账为**只读分析**:除本文件(位于 `.ihui-agent/tmp/d202/`)外未写任何仓库文件;关键争议锚点已对工作树做只读复核(核验结果标注「✓核验」,未复核者标注「未复核」)。

## §1 两表概况与帧集口径对比

| 维度 | 表 A(S15-④) | 表 B(尺子③) |
| --- | --- | --- |
| 帧枚举方法 | 控制面三层穷举:线层封套 `switch(t.type)`(6 帧)+ 出站控制请求正则 `\.request\(\{type:\s*"([a-z_]+)"`(34 名)+ 另 2 名动态构造(`initialize`/`get_models`)+ 会话响应分派面 §三 + 入站反向 RPC `switch(t.request.type)` §四 | 三种字面量并集 `subtype:"[a-z_]+"` ∪ `type:"[a-z_]+"` ∪ `case"[a-z_]+"`,原始 106 名 → 68 个按能力帧候选逐条探测 → 余 38 名排除(传输/事件形态 + 控制多路复用 + 权限枚举值) |
| 判定对象帧名数(本对账提取) | 65 名(equivalence.md §一 9 + §二 52 + §三 4 新增) | 74 名(58 判定行,组行含多名:elicitation×2、BYOK×7、权限枚举×8、fetch 票据×2、skill_evolution×2) |
| 三态口径 | 真缺 / 我方等价但另名 / 竞品也无·不构成差距(显式不可达或部署形态内部管道) | 等价 / 等价(部分)/ 真缺(附否证),另有「等价(形态)」标签 6 行 |
| 真缺判定 | **1 帧**(add_directories) | **6 帧**(resume_goal、add_directories、reload_plugins、reload_skills、refresh_memory、mcp_clear_auth) |
| 否证纪律 | 真缺行强制别名集 + 否证命令原文;add_directories 行已有判据精化记录(测试文件 extraDirs 4 命中使票面零命中过期 → 精化为①②两条否证) | 「不得按标识符零命中直接记没有」,零命中帧二轮放宽别名 + 三轮定点否证;底稿可复跑(`.ihui-agent/tmp/d141/probe.sh` → `d141-probe.tsv`) |
| 我方锚点基准 | HEAD(2026-10-01 现读) | 工作树(含 file:line + `git grep` 否证命令) |

**帧集口径差异的根源**:表 A 的帧枚举以「运行时调用点 + 分派面清单」为准,凡动态构造或仅以 `case` 分派出现、无字面 `.request({type:...})` 调用点的帧(目标族 set_goal/get_goal/clear_goal/set_goal_max_turns/resume_goal、执行控制族 cancel_async_message/stop_task/background_tasks、side_question、agent_metadata、feedback、cloud_agent_event、set_plan_mode/get_plan_mode 等)不在其帧集内;表 B 的三字面量并集把这些全部抓进 106 原始名。反之,表 A 的分派面穷举覆盖了表 B 字面量并集抓不到或未入 68 候选的名字(shutdown、mcp_message、enable/disable_remote_projection、daemon.auth.* 前缀变体、control_cancel、keepalive 变体)。两表为**交叉互补的帧集**,重叠 51 名。

**排除规则原文依据**(归属表「另一表为何没判」列引用):
- 表 A:帧集=framed.md 三层(§一/§二含 34 名/§三/§四)+ §五「附着枚举」——权限模式映射(accept_edits/bypass_permissions/dont_ask/plan/auto 等)被表 A 记为**控制面参数集**,不设判定行;`always_allow/always_ask/always_deny` 三名表 A 全文未出现。
- 表 B §3(原文):「传输/事件形态:`user text system tag data event result error success mirror_error action write end relocated sdk qodercli worker status_event process session_input session_output plan id default`——我方由 `core/sse_contract.py` 帧契约承载同语义」「控制多路复用:`control_request control_response control_cancel_request`——SDK 内部 frame multiplexing 机制」「权限枚举值:`dont_ask always_allow always_ask always_deny yolo bypass_permissions accept_edits auto`(已并入 §1.2 行)」。⚠ 该清单 25+3+8=**36 名,与票面 38 名差 2**:`control_cancel` 与 `keepalive`(变体拼写)未显式列入,为表 B 排除清单的枚举缺口(§5 更正项)。

## §2 帧名并集归属表

**并集总数 = 88 名**(共同 51 + 仅表 A 14 + 仅表 B 23);下表按 82 行呈现(组行多名:elicitation×2、BYOK×7、fetch 票据×2)。判定缩写:A-等名=「我方等价但另名」,A-无距=「竞品也无/不构成差距」,B-形=「等价(形态)」,B-部=「等价(部分)」。

### 2.1 两表共同判定(51 名)

| # | 帧名 | 表 A 判定(锚点) | 表 B 判定(锚点) | 差异 |
| --- | --- | --- | --- | --- |
| 1 | `add_directories` | **真缺(唯一)**(equivalence §二首行;dist @80368;别名集+①②精化否证零命中;`--add-dir` 旗标映射+预填方案) | **真缺**(§1.5;git grep 四别名仅 open-capability-registry.ts:50 注释 1 处非能力) | **共识** |
| 2 | `can_use_tool` | A-等名(engine.py:15,285 approval.respond;guardian_context.py:45-55) | 等价(tool-contract.ts:513 humanApprovalMandated + danger-gate + tool-approval 帧族) | 一致(锚点互补) |
| 3 | `elicitation` | A-等名(capability_matrix.py:678-684,默认关门控如实记录) | 等价(capability_matrix.py:678 mcp_elicitation_pause) | 一致 |
| 4 | `elicitation_response` | 同上(组行) | 同上(组行) | 一致 |
| 5 | `set_permission_mode` | A-等名(engine.py:15,285;agent_plan.py:397-432;备注「我方无 5 档全局模式开关」) | 等价(executor_switch.py:386,449;permission_mode.py 归一面) | 一致 |
| 6 | `interrupt` | A-等名(engine.py:15,474;agent_runtime.py:356) | 等价(current_time_reminder.py:54;llm.py abort 链路) | 一致 |
| 7 | `rewind` | A-等名(checkpoint_rewind.py:85-87,漂移记录) | 等价(checkpoint_rewind.py:86-88,漂移勘误) | 一致(行号微漂) |
| 8 | `rewind_files` | A-等名(checkpoint_rewind.py:83,:155) | 等价(同上 scope=code\|both + file_editor.rollback_file) | 一致 |
| 9 | `get_context_usage` | A-等名(shared/src/sse/contract.ts SSE_EVENTS usage/budget) | 等价(world_state_sections.py:8-9) | 一致 |
| 10 | `get_usage_info` | A-等名(agents.py:2336 token-usage) | 等价(同上预算面 + model_pricing.py) | 一致 |
| 11 | `set_model` | A-等名(agents.py:2082,2096 modelOverride) | 等价(chat.ts:628 会话级模型字段) | 一致 |
| 12 | `set_proxy` | A-等名(config.py:199-206;proxy-dispatcher.ts;部署级配置非逐会话帧) | 等价(config.py:542 proxyConfigVar;proxy_pool.py:96) | 一致 |
| 13 | `open_session` | A-等名(agent_runtime.py:372,385,393;engine.py:474) | 等价(api_client.py:514 LoadSessionData) | 一致 |
| 14 | `list_sessions` | A-等名(agents.py:1930) | 等价(sidebar-chat-history.tsx + chat-queries 列表面) | 一致 |
| 15 | `rename_session` | A-等名(agents.py 组行;rename 无独立端点,chat.ts:137,144) | 等价(chat-queries.ts:205) | 一致 |
| 16 | `delete_session` | A-等名(agents.py:1979 DELETE) | 等价(chat-queries.ts:311,325) | 一致 |
| 17 | `generate_session_title` | A-等名(chat.ts:621,631,漂移记录) | 等价(chat.ts:621,650,票面否证锚点) | 一致(行号微漂) |
| 18 | `initialize` | A-等名(组行 initialize/open_session;握手=服务端常驻) | 等价(agent_engine.py:2440 capability 声明) | 一致 |
| 19 | `account_info` | A-等名(mcp.py:18 JWT 面) | 等价(sso.py:315 SSO userinfo) | 一致(锚点互补) |
| 20 | `mcp_status` | A-等名(mcp.py:275-280;:125,132) | 等价(routers/mcp.py:878;services/mcp_status.py) | 一致 |
| 21 | `mcp_reconnect` | A-等名(mcp.py:86-87;:444-445,漂移记录) | 等价(config.py:177 + main.py:473,漂移勘误) | 一致(锚点互补) |
| 22 | `mcp_toggle` | A-等名(mcp.py:769-770,820-821) | 等价(acp/server.ts:427,624 enableMcp) | 一致 |
| 23 | `mcp_authenticate` | A-无距(组行:四帧组成 CLI 侧 OAuth 面,服务端形态无此线) | 等价(mcp-config.ts:17,50 MCPAuth)✓核验 | **冲突③方向翻转,采信 B** |
| 24 | `mcp_inject_token` | A-无距(同组行) | 等价(engine.py:347 reset_mcp_principal)✓核验 | **冲突④方向翻转,采信 B** |
| 25 | `mcp_oauth_callback_url` | A-无距(同组行) | 等价(mcp_client.py:43,83 MCPOAuthClient/MCPOAuthConfig)✓核验 | **冲突⑤方向翻转,采信 B** |
| 26 | `mcp_clear_auth` | A-无距(同组行:「服务端形态无此线」) | **真缺(刻意)**(否证命中「不可清除口径」本身:agent_engine.py:4414、engine_voice.py:151;补齐须先过 §24 拍板) | **冲突⑥真缺口径冲突,采信 B** |
| 27 | `mcp_set_servers` | A-等名(mcp.py:372,423,300 运行时 CRUD) | B-形(mcp-config.ts:208,241 saveMcpConfig;非会话内热更) | 标签精化,采信 B 标签 + A 锚点并入 |
| 28 | `list_plugins` | A-等名(mcp.py:190,200,205 /mcp/skills + skill 实体) | B-形(relay-plugins.ts:15,75 listPlugins;管理面非会话帧) | 标签精化,采信 B 标签(A 锚点实为 skill 面) |
| 29 | `reload_plugins` | A-等名(**capability_matrix.py:246-247 + skill_scheduler.py:200**)✓核验=**self_eval 项,锚点错配** | **真缺**(二轮放宽别名否证 0 命中) | **冲突①真缺 vs 等价,采信 B** |
| 30 | `reload_skills` | A-等名(同上错配锚点) | **真缺**(三轮定点否证 ai_skills.py 路由 0 命中)✓核验;另见 services/skills.py:777 `reload_auto`(mtime 自动重载,非宿主可调口) | **冲突②真缺 vs 等价,采信 B** |
| 31 | `flush_memory` | A-等名(agent_memory.py /memory/entries CRUD + 检索)✓核验=REST 管理面(prefix /longterm-memory) | B-部(v1-knowledge-tools.ts:299 saveMemorySchema;REST 非 SSE 帧) | 标签精化,采信 B |
| 32 | `refresh_memory` | A-等名(与 flush_memory 同组行) | **真缺**(grep 仅 agent_longterm_memory.py:278 内部 updated_at,非运行时刷新帧) | **冲突⑦真缺 vs 等价,采信 B** |
| 33 | `memory_should_generate` | A-等名(同组行) | 等价(agent_longterm_memory.py 长期记忆生成链) | 一致 |
| 34 | `flush_skill_evolution` | A-等名(capability_matrix.py:233-238;同名同义正撞)✓核验 | 等价(capability_matrix.py:233-234 + main.py:389 L3 调度器) | 一致 |
| 35 | `skill_evolution_should_review` | A-等名(同组行,dist @67412) | 等价(同组行) | 一致 |
| 36 | `fetch_job_token` | A-无距(daemon 形态鉴权管道,无我方锚点) | B-形(control_autonomy.py:195 checkInternalServiceToken✓核验 + mcp_server.py:580 service_account.json) | 方向翻转,采信 B(找到实际内部票据承载) |
| 37 | `fetch_service_account_token` | A-无距(同组行) | B-形(同组行) | 同上,采信 B |
| 38 | `apply_flag_settings` | A-无距(settings 透传管道) | 等价(agent_engine.py:2440-2444 capabilities.featureFlags)✓核验 | **冲突⑧方向翻转,采信 B** |
| 39 | `seed_read_state` | A-无距(rewind 读态种子管道;checkpoint 直接落盘 checkpoint_rewind.py:133,155) | B-部(会话已读管理承载;无 seed 帧) | 标签精化,采信 B(A 机理备注保留) |
| 40 | `resolve_session_artifacts` | A-无距(agents.py:1962 deliverables;服务端直接持有产物) | B-部(产物预览面承载;无专用帧) | 标签精化,采信 B 标签 + A 锚点 |
| 41 | `get_model_policy` | A-等名(agents.py:2096;engine.py:209;正向+反向双登记判同) | B-部(agent_engine.py:2426 capability 声明;无独立 policy 帧) | 标签精化,采信 B |
| 42 | `close_session` | A-等名(组行 list/rename/close/delete/shutdown) | B-形(生命周期由 conversations API+归档;显式排除 browser_hub.py:152 假阳性) | 标签精化,采信 B |
| 43 | `hook_callback` | A-无距(SDK 宿主扩展面;「服务端形态无宿主进程」) | 等价(hook_runtime.py:37 HookFunc✓核验 + hooks-auto.ts 热重载) | **冲突⑨方向翻转,采信 B** |
| 44 | `keep_alive` | A-无距(§一封套行:「长连心跳;HTTP/SSE 形态无此帧」) | 等价(llm.py:230 `_APPROVAL_KEEPALIVE_INTERVAL=15`)✓核验(另 :561 同款) | **冲突⑩我方承载认定冲突,采信 B** |
| 45 | BYOK 7 帧 `check/create/get/list/update/delete_byok_config`+`validate_byok_model` | A-无距(byok_config_management_v1 @52705;admin/model-mappings.ts:9-10;商业形态差异) | B-形(llm_gateway.py:269-271 byok/ 平台模式;会话内 CRUD 帧 vs 平台配置面) | 标签精化(语义一致:能力在、形态异),采信 B 标签 |

### 2.2 仅表 A 有判定(14 名)

| # | 帧名 | 表 A 判定(锚点) | 表 B 为何没判(排除规则依据) |
| --- | --- | --- | --- |
| 46 | `control_request` | A-等名(engine.py:15,474 帧报文处理) | B §3「控制多路复用」明列排除(SDK 内部 frame multiplexing) |
| 47 | `control_response` | A-等名(同上) | 同上 |
| 48 | `control_cancel_request` | A-等名(agent_runtime.py:356 cancel) | B §3「控制多路复用」明列排除 |
| 49 | `control_cancel` | A-等名(同上,变体拼写) | B §3 **未显式列出**(38−36 枚举缺口,推断随多路复用排除) |
| 50 | `status_event` | A-无距(daemon 存活状态管道;agent_runtime.py:348 status) | B §3「传输/事件形态」明列排除 |
| 51 | `session_input` | A-无距(线层显式不可达:`throw new w(...is not supported on the v2 wire)`) | B §3「传输/事件形态」明列排除 |
| 52 | `session_output` | A-无距(同上) | 同上 |
| 53 | `keepalive` | A-无距(§一封套行,与 keep_alive 同行,两种拼写都收) | B §3 **未显式列出**(枚举缺口;主名 keep_alive 已在 B §1.8 判定) |
| 54 | `shutdown` | A-等名(agents.py:1979 DELETE /agents/sessions/{session_id},组行) | B 的 106 原始名未含或未入 68 候选(字面量并集抓不到该分派形态名);**B 覆盖缺口** |
| 55 | `mcp_message` | A-等名(mcp.py:125,132 tools;反向 RPC) | 同上;**B 覆盖缺口** |
| 56 | `enable_remote_projection` | A-无距(dist @78679;多端续聊由 agent_runtime.py:393 resume 承担) | 同上;**B 覆盖缺口** |
| 57 | `disable_remote_projection` | A-无距(同组行) | 同上;**B 覆盖缺口** |
| 58 | `daemon.auth.fetch_job_token` | A-无距(dist 反向分派) | B 仅判无前缀变体(前缀形态属 daemon 鉴权管道变体) |
| 59 | `daemon.auth.fetch_service_account_token` | A-无距(同组行) | 同上 |

### 2.3 仅表 B 有判定(23 名)

| # | 帧名 | 表 B 判定(锚点) | 表 A 为何没判(帧集口径依据) |
| --- | --- | --- | --- |
| 60 | `set_goal` | 等价(sse_contract.py:299-303 set_thread_goal_state;goal_verification.py:543) | A 的帧枚举正则/分派面未覆盖该动态构造或 case 分派形态帧 → **A 范围外** |
| 61 | `get_goal` | 等价(sse_contract.py:299 goal_status 单帧,D152) | 同上 |
| 62 | `clear_goal` | 等价(agent_events.py:95 status:'cleared';chat-queries.ts:1298) | 同上 |
| 63 | `set_goal_max_turns` | B-部(doom_loop.py:48 + agents.py:492;无按目标持久化格) | 同上 |
| 64 | `resume_goal` | **真缺**(二轮否证 resumeGoal\|resume_goal\|恢复目标\|continueGoal → 0 命中) | 同上(**A 全文未出现此帧名**) |
| 65 | `set_plan_mode` | 等价(permission_mode.py:343;:103) | 同上 |
| 66 | `get_plan_mode` | 等价(agent_runtime.py:7;ai-chat-stream.ts:268 planMode) | 同上 |
| 67 | `dont_ask` | B-形(§1.2 组行:权限模式枚举值非帧;permission_mode.py 归一 + 审批三档) | A frames.md §五 记为「附着枚举(权限模式映射)」,不设判定行 |
| 68 | `always_allow` | B-形(同组行) | A 全文未出现(附着枚举仅记录 accept_edits/bypass_permissions/dont_ask/plan/auto 5 名) |
| 69 | `always_ask` | B-形(同组行) | 同上 |
| 70 | `always_deny` | B-形(同组行) | 同上 |
| 71 | `yolo` | B-形(同组行) | A §五 映射原文含 yolo→bypass_permissions,不设判定行 |
| 72 | `bypass_permissions` | B-形(同组行) | 同上 |
| 73 | `accept_edits` | B-形(同组行) | 同上 |
| 74 | `auto` | B-形(同组行) | 同上 |
| 75 | `cancel_async_message` | 等价(llm.py:121-124 生成器边排水/abort fetch/finally cancel_all) | A 范围外(动态/case 分派形态) |
| 76 | `stop_task` | 等价(background-registry.ts:810 SIGTERM→5s SIGKILL) | 同上 |
| 77 | `background_tasks` | 等价(background_tasks.py:46;capability_matrix.py:363 owner 登记) | 同上 |
| 78 | `get_models` | 等价(v1-gemini.ts ListModels;agent_engine.py:2426 modelRouting) | **A 提及但无判定行**(§二头「34 名+initialize/get_models」+ §三分派清单列名,但 equivalence.md 无该帧 verdict 行)→ **A 缺口** |
| 79 | `side_question` | B-部(turn_metadata.py:16 子代理帧族 + 分屏面板;无专用帧) | A 范围外 |
| 80 | `agent_metadata` | 等价(turn_metadata.py:16,306) | 同上 |
| 81 | `cloud_agent_event` | B-部(nav-data.ts:400 /cloud-agent;无同名 SSE 帧) | 同上 |
| 82 | `feedback` | 等价(ai_skills.py:34 skill_feedback_tracker + 反馈面) | 同上 |

## §3 冲突清单与采信建议

原则(票面铁律):**向覆盖面更全、判据更严者对齐;严禁拿宽松版顶账**。冲突共 **19 行(涉 26 帧)**,分三档:

### 3.1 档一:真缺 vs 等价(实质冲突,4 帧,全部改判采信 B)

| 帧 | 表 A | 表 B | 哪边更严/更全 | 建议采信 |
| --- | --- | --- | --- | --- |
| `reload_plugins` | 等价另名,锚 capability_matrix.py:246-247 | **真缺**(二轮放宽别名否证 0 命中) | B 更严(附否证命令与多轮纪律)。**✓核验:A 锚点错配**——capability_matrix.py:246-247 实为 `self_eval` 能力项(owner=skill_scheduler.py:200,「Skill 自评估」),与插件重载无关 | **B(真缺)** |
| `reload_skills` | 等价另名,同上错配锚点 | **真缺**(三轮定点否证 ai_skills.py 路由 grep reload\|refresh → 0 命中) | B 更严且核验成立。⚠ nuance:services/skills.py:777 有 `reload_auto()`(mtime 驱动增量重载,仅 auto 来源 skill,引擎自扫描幂等,**非宿主可调运行时重载口**)——两表均未登记,须补注防翻案,但不翻真缺 | **B(真缺)**,补注 reload_auto 机理 |
| `refresh_memory` | 等价另名(与 flush_memory 组行,锚 agent_memory.py /memory/entries CRUD)✓核验=REST 管理面(prefix /longterm-memory,:122 GET /entries) | **真缺**(grep 仅 agent_longterm_memory.py:278 内部 updated_at) | B 区分「REST 写入口」与「运行时刷新帧」,更精细;A 把两帧混入一行是粗化 | **B(真缺)**;flush_memory 维持 B-部 |
| `mcp_clear_auth` | 无距(「服务端形态无此线」) | **真缺(刻意)**(否证命中的是「不可清除口径」本身:agent_engine.py:4414、engine_voice.py:151;✓核验:全仓 clear_auth 命中均为 miniapp 登录态测试,非 MCP 凭据) | B 附否证 + 刻意口径 + §24 拍板前置,更严;A 的组行把 OAuth 四帧捆绑判「无距」过于笼统 | **B(真缺·刻意)** |

### 3.2 档二:等价 vs 「竞品也无/不构成差距」(方向翻转,B 找到 A 没找到的我方承载,7 帧/6 行,采信 B)

| 帧 | 表 A | 表 B(✓=已核验) | 建议采信 |
| --- | --- | --- | --- |
| `mcp_authenticate` | 无距(组行) | 等价:apps/cli/src/commands/mcp-config.ts:17,50 MCPAuth ✓ | B |
| `mcp_inject_token` | 无距(组行) | 等价:engine.py:347 reset_mcp_principal(token) ✓ | B |
| `mcp_oauth_callback_url` | 无距(组行) | 等价:mcp_client.py:43,83 MCPOAuthClient/MCPOAuthConfig ✓ | B |
| `hook_callback` | 无距(「服务端形态无宿主进程」) | 等价:hook_runtime.py:37 HookFunc ✓ + hooks-auto.ts 自动发现/热重载 | B(A 的「无宿主进程」论断被 hook_runtime 实际存在削弱) |
| `apply_flag_settings` | 无距(settings 透传管道) | 等价:agent_engine.py:2440-2444 capabilities.featureFlags ✓ | B |
| `fetch_job_token` / `fetch_service_account_token` | 无距(daemon 鉴权管道) | 等价(形态):control_autonomy.py:195 checkInternalServiceToken ✓ + mcp_server.py:580 service_account.json | B(B 找到内部票据承载,A 行无我方锚点) |

### 3.3 档三:判定方向一致、标签精细度不同(15 帧/9 行,采信更细标签,锚点合并)

| 帧/行 | 表 A | 表 B | 建议采信 |
| --- | --- | --- | --- |
| `keep_alive` | 无距(「HTTP/SSE 形态无此帧」) | 等价:llm.py:230 `_APPROVAL_KEEPALIVE_INTERVAL=15` ✓(另 :561 同款) | B 判定(A 表备注「无此帧」**不成立**,须更正);A 的线层封套定位(竞品侧=daemon v2 wire 心跳)补入 B 行 |
| `get_model_policy` | 等名 | B-部(无独立 policy 帧) | B 标签,A 锚点(agents.py:2096;engine.py:209)并入 |
| `close_session` | 等名 | B-形(显式排除 browser_hub.py:152 假阳性) | B 标签(更严) |
| `mcp_set_servers` | 等名(routers/mcp.py:372,423,300 运行时 CRUD) | B-形(配置文件级,非会话内热更) | B 标签 + A 的运行时 CRUD 锚点并入作补充证据(两锚点承载不同面,合并后覆盖最全) |
| `list_plugins` | 等名(锚 /mcp/skills skill 实体面) | B-形(relay-plugins.ts 管理面,非会话帧) | B 标签;A 锚点注明「实为 skill 面,语义有偏移」 |
| `flush_memory` | 等名 | B-部(REST 非 SSE 帧) | B 标签 |
| BYOK 7 帧 | 无距(商业形态差异) | B-形(平台配置面 vs 会话内 CRUD) | B 标签(语义一致);A 的 @52705 常量原文与 admin 锚点并入 |
| `seed_read_state` | 无距(checkpoint 直接落盘机理) | B-部(会话已读管理承载) | B 标签,A 机理备注并入 |
| `resolve_session_artifacts` | 无距(agents.py:1962 deliverables) | B-部(产物预览面) | B 标签,A 锚点并入 |

### 3.4 无冲突共识项

`add_directories` 两表均判**真缺**(唯一共识真缺),且为 D201(多根工作区)立票依据,不受本对账影响(D202 票面第④点)。另有 26 帧两表判定标签一致(见 §2.1 标「一致」行)。

## §4 关键问题回答:表 B 6 项真缺在表 A 中的处境

| 表 B 真缺帧 | 表 A 处境 | 性质 |
| --- | --- | --- |
| `add_directories` | 判了,同为**真缺**(表 A 唯一真缺行,判据还更精:发现测试文件 extraDirs 4 命中使票面零命中过期并精化否证) | **共识** |
| `resume_goal` | **没出现**——不在 frames.md 任何一层(封套/34 出站/分派面/反向 RPC),equivalence.md 无该帧名 | **范围互补**(A 的帧枚举正则抓不到动态构造/case 分派形态帧) |
| `reload_plugins` | 判了,判为**「我方等价但另名」**(锚点错配,实核为 self_eval 项) | **真冲突** |
| `reload_skills` | 判了,判为**「我方等价但另名」**(同上错配) | **真冲突** |
| `refresh_memory` | 判了,判为**「我方等价但另名」**(与 flush_memory 混入同一组行) | **真冲突** |
| `mcp_clear_auth` | 判了,判为**「竞品也无/不构成差距」**(OAuth 四帧捆绑组行) | **真冲突**(A 的三态里它「不构成差距」,B 的三态里判「真缺(刻意)」) |

**结论**:6 项真缺 = 1 共识(add_directories)+ 1 范围外(resume_goal)+ 4 真冲突(reload_plugins/reload_skills/refresh_memory/mcp_clear_auth)。两表关系是**「帧集范围互补 + 5 帧实质判定冲突」的叠加**,不是纯范围互补——即 D202 票面「初步定性为帧集范围差……但未证毕」的存疑部分**已证毕**:范围差确实存在(88 名并集中 37 名单边),但另有 5 帧是同一帧名上的 verdict 真冲突,必须按 §3 改判收敛,不得以「范围互补」一语带过。

## §5 收敛建议(正本 / 指针 / 需更正行)

**正本 = 表 B(`docs/benchmark-evidence/2026-10/d141-control-frame-parity.md`)**;**指针 = 表 A(`docs/benchmark-evidence/2026-09/qoder-control-frames-equivalence.md`)**。理由:表 B 帧枚举全程可复现(106→68→58 有命令与底稿 `d141-probe.tsv`)、判据更严(零命中帧强制二/三轮放宽别名否证)、覆盖面更全(74 帧名含目标族/执行控制族等表 A 整族缺位者);表 A 的 4 处宽松判定全部需向 B 改判。指针化不销毁:表 A 保留为 S15-④ 谱系一手取证物(34 名调用点原文、线层封套分派原文、`--add-dir` 旗标映射、add_directories 预填方案为独有价值)。

**表 B(正本)需更正/补强 7 处**:
1. `keep_alive` 行:竞品侧补 A 的线层封套定位(daemon v2 wire 心跳),我方锚点维持 llm.py:230(另可补 :561 同款);
2. `mcp_set_servers` 行:补 A 的运行时 CRUD 锚点(routers/mcp.py:372,423,300)为补充证据,标签维持等价(形态);
3. `reload_skills` 行:补注 services/skills.py:777 `reload_auto`(mtime 驱动增量重载,引擎自扫描、非宿主可调口)——防后人拿它翻案,不翻真缺;
4. `add_directories` 行:吸收 A 的判据精化记录(测试文件 extraDirs 命中→①②精化否证)与 `--add-dir` 旗标映射、预填方案指针;
5. §3 排除清单:补列 `control_cancel`、`keepalive` 两名,消除 36≠38 枚举缺口;
6. `mcp_clear_auth` 行:补 A 的形态说明(竞品把 OAuth 放宿主-CLI 线是因进程分离),标签维持真缺(刻意);
7. 补齐单边帧判定行/并入既有行:`shutdown`、`mcp_message`、`enable/disable_remote_projection`、`daemon.auth.*` 前缀变体(A 已判,采其锚点)、`get_models` 已有行核对——使正本覆盖 88 名并集全集。

**表 A(指针化)需更正 6 处**:
1. `reload_skills`/`reload_plugins` 行:锚点 capability_matrix.py:246-247 错配(实为 self_eval),整行撤销改指 B 真缺;
2. `refresh_memory`:从 flush_memory 组行拆出,改指 B 真缺;
3. `mcp_clear_auth`:从 OAuth 组行拆出,改指 B 真缺(刻意);
4. `mcp_authenticate`/`mcp_inject_token`/`mcp_oauth_callback_url`/`hook_callback`/`apply_flag_settings`/`fetch_job_token`/`fetch_service_account_token`:「无距」改指 B 等价(含 §3.2 核验锚点);
5. `keep_alive` 行备注「HTTP/SSE 形态无此帧」更正为「我方有审批等待期 SSE 注释帧(llm.py:230),判等价见正本」;
6. §二 补 `get_models` 判定行(或显式标注「判 See 正本 §1.4」)。

**PROJECT_PLAN 同步**:D202 真缺去向登记行按收敛后口径(真缺 6 帧:resume_goal/add_directories/reload_plugins/reload_skills/refresh_memory/mcp_clear_auth)更正;`add_directories` 维持与 D201 互链,立票依据不受影响。

## §6 方法与复现命令

1. 通读三份文档(跳过水印行),手工提取判定对象帧名全集:表 A 65 名(equivalence.md §一 9 + §二 52 + §三 4)、表 B 74 名(58 判定行展开)。
2. 并集归属 = 51 共同 + 14 仅 A + 14 仅 B + …… 即 **88 名**;单边名的「另一表为何没判」逐名回溯到两表排除规则原文(§1 引用)。
3. 争议锚点只读复核命令(本对账实跑,均在仓库根):
   ```bash
   # reload_skills/reload_plugins 的 A 锚点错配核验(读 capability_matrix.py:225-255)
   #   → :246-247 为 self_eval 项(owner skill_scheduler.py:200)
   # mcp_clear_auth 否证复核
   git grep -inE "clearAuth|clear_auth" -- apps            # 命中均为 miniapp 登录态测试,非 MCP
   # reload_skills 机理补充
   git grep -n "reload_auto" -- apps/ai-service/app/services/skills.py   # :777
   # B 表锚点逐条核验(均命中):
   #   llm.py:230 _APPROVAL_KEEPALIVE_INTERVAL;engine.py:347 reset_mcp_principal;
   #   hook_runtime.py:37 HookFunc;agent_engine.py:2440-2444 featureFlags;
   #   mcp-config.ts:17,50 MCPAuth;mcp_client.py:43,83 MCPOAuthClient;
   #   control_autonomy.py:195 checkInternalServiceToken;agent_memory.py:43,122 /longterm-memory CRUD
   ```
4. 水印复制(本文头 4 行,逐字节取自 d141 文档,禁手打不可见字符):
   ```bash
   python - <<'PY'
   import pathlib
   src = pathlib.Path('docs/benchmark-evidence/2026-10/d141-control-frame-parity.md').read_bytes()
   head = b'\n'.join(src.split(b'\n')[:4]) + b'\n'
   tgt = pathlib.Path('.ihui-agent/tmp/d202/d202-frame-union-reconciliation.md')
   tgt.write_bytes(head + tgt.read_bytes())
   PY
   ```
5. 约束遵守声明:本对账全程只读仓库文件(Read/Grep/mkdir/本文件写入),未运行任何改文件命令,未 git commit/push。
