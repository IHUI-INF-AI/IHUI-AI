<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# S1 席:上一轮 REA 取证会话导出件摘要

> 认领@2026-10-30/S1

导出件:`E:\桌面\深度重新使用rea的能力分析QODER，_要分析透彻_彻底_，然后深度比对本项目还有哪里不如…_2026-10-30_19-55.md`(4526 行)
状态:导出件 4526 行已全部读完。末行 = `> Failure: QODER_EXECUTION_STREAM_FAILED`(会话在读取 agent-creator SKILL.md 后流断裂,差距对比报告从未产出)。标注约定:[观察]=导出件内有原始证据;[推断]=会话内推断;[未知]=证据缺失。

## 一、上一轮已确证的 QODER 事实清单

### 1. 安装布局与版本 [观察]
- Launcher:`C:\Users\Administrator\AppData\Local\Qoder CN\Qoder CN Launcher\`;`state.ini`:installDir=**G:\Qoder CN**,appExecutable=`.qoder-versions\0.4.11\Qoder CN.exe`,updatedAt=2026-10-29(同文件 targetVersion 0.4.9→0.4.11 升级痕迹在 install.ini/state.ini 分层)。
- `build-manifest.json`:productVersion **0.4.11**,electronVersion **43.1.1**,commit `d9996760e3d4…`,buildNumber 82468212,buildTime 2026-10-23T06:45:57Z。
- `product.json`:productId qoder-cn、appId `com.qodercn.app`、protocolScheme `qoder-cn`、更新源 `https://static.qoder.com.cn/qoder-app/releases`。
- 主 exe 225,510,408 B(逐版本目录各一份)。

### 2. 体积与资源清单 [观察]
- resources/ du:app.asar **181M**(app.asar 实体 189,505,973 B)、app.asar.unpacked **121M**(仅 node_modules)、extensions **62M**、umid 7.5M、bundled-resources 6.1M、bin 3.6M、node-repl 3.4M。
- unpacked node_modules 11 包:`@img @lydell @napi-rs @qoder-ai @silvia-odwyer aoq-electron-sdk detect-libc keytar node-pty semver sharp`。
- bin/:`appshot_bare_modifier_monitor.exe`、`dji_mic_button.node`、`native_clipboard.node`、`notification_permission.node`(DJI 麦克风按钮原生件值得注意)。
- 内置扩展 9 枚(extensions/catalog.v1.json 逐条提取了 manifest):canvas/communication/computer-control/desktop-pet-skill/find-extensions/knowledge.center/office/security/sites。**权限模型为细粒度能力令牌**(chat.createSession、chat.observeTurn、mcp.registerInProcess、workspace.read、enterprisePolicy.read、auth.readUserToken 等,逐插件清单在导出件 L1889-1941)。`qoderAgentSdk.plugins` 把本地 CLI 插件注入 agent(browserUse/computerUseWindows 带 OS+配置双条件 enablement);security 插件声明 **l1StaticCheck/l2LightweightScan/l3DeepScan** 三档扫描。
- node-repl/:kernel.mjs+moduleLoader.mjs+operationEvents.mjs+**web-tree-sitter(wasm)**;node_modules 含 `@ali/qoder-browser-use-sdk`、`@ali/qoder-cu-sdk`。
- qoder-helper/skills/(SKILL.md+evals/boundary-cases.md+references/knowledge/{extensions-overview,logs,quick-answers,settings-map}.md)、collaboration/skills/SKILL.md、dynamic-text/qoder-cn.json、umid/(sgsdk.dll+runtime-info.exe)、tray/tray.ico 均只列了名。
- bundled-resources/archives:qoder-cn-computer-use 与 qoder-cn-context-plugin 两个 sha256 命名 zip(未解)。

### 3. Agent SDK(`app.asar.unpacked/node_modules/@qoder-ai/qoder-cn-agent-sdk/dist/_worker/`) [观察]
- `qoder-worker-runtime.obf.mjs` **34,389,777 B**(混淆)。runtime-info.json:版本 **1.1.75-hotfix.1**、profile=platform、git commit `cb3c036a…`、productName **qoderclicn**(即 Desktop 内嵌的是 CLI 同源运行时)。
- builtin skills 4 份:agent-creator(10,028B)/hook-config(22,335B)/sdk(10,449B)/skill-creator(10,529B)。
- **sdk SKILL.md 全文已在导出件内**(L3266-3441):`query()` 单/多轮双形态、`canUseTool`(须回显 toolUseID)、4 档权限模式(default/acceptEdits/plan/bypassPermissions)、会话四操作(continue/resume/forkSession/listSessions+getSessionMessages)、`createSdkMcpServer`/`tool()` in-process MCP(命名 `mcp__<server>__<tool>`)、result.subtype 错误族(error_during_execution/error_max_turns/error_max_budget_usd)、maxTurns/settingSources/includePartialMessages/pathToQoderCLIExecutable、中断控制 interrupt/setModel/setPermissionMode、auth 帮助器(accessTokenFromEnv/qodercliAuth)。
- **hook-config SKILL.md 全文已在导出件内**(L3564-4165):26 个钩子事件(PreToolUse/PostToolUse/PostToolUseFailure/PermissionRequest/SessionStart/SessionEnd/SubagentStart/SubagentStop/**TeammateIdle**/Stop/**QueryEnd**/StopFailure/PreCompact/PostCompact/UserPromptSubmit/ConfigChange/Notification/**InstructionsLoaded**/CwdChanged/FileChanged/WorktreeCreate/WorktreeRemove/TaskCreated/TaskCompleted);4 类 handler(command/http/**prompt**/**agent**,后两类是隔离 LLM 评估器,明确"不见主会话历史"的上下文边界);exit 0/2 语义;**asyncRewake**(后台钩子 exit 2 唤醒模型+rewakeMessage/rewakeSummary);`if: "Tool(glob)"` 与前缀规则,Bash 复合命令经 tree-sitter 拆分逐个匹配;exec form vs shell form;`${QODER_PLUGIN_ROOT}/${QODER_PLUGIN_DATA}` 占位符经 env 导出。
- **agent-creator SKILL.md 全文已在导出件内**(L4168-4249):agent=MD+YAML frontmatter,字段含 tools/disallowedTools/**model 六档(inherit/lite/efficient/auto/performance/ultimate)**/color/maxTurns/timeoutMins/**effort(low/medium/high/max)**/skills;project 与 user 两级目录;`@agent-name` 调起、`/agents reload`。(读到此处流断裂)
- skill-creator SKILL.md:**列出但未读**。

### 4. proto/chat.proto(322 行,全文在导出件 L2280-2604)[观察]
- `ReasoningEffort` 七值枚举:UNSPECIFIED/NONE/LOW/MEDIUM/HIGH/**XHIGH**/**MAX**。
- `ChatCompletionRequest.patches: map<string, ChatPatchList>`;`ChatPatch{cache_id,action,position,content,name,rename_to,description,parameters}`——**会话消息/工具声明的增量补丁协议**(改历史消息与改工具定义免整包重传)。
- `ChatMessage`/`Tool` 均带顶层 `cache_id`;`ContentPart.cache_control`(Anthropic 式显式缓存);Usage 细节 `cached_tokens/cacheable_tokens/reasoning_tokens`。
- `Tool` 是 oneof 形态的 **Function|Advisor**;`Advisor{name,model,max_uses}`——主模型可挂"顾问子模型"，限次调用。
- `ChatMetadata` 四维:WorkspaceMetadata(**file_count/languages/codebase_status/codebase_soft_status/codebase_external_id/data_policy**)、BusinessMetadata(product/version/stage/sub_task)、ContextMetadata(request_id/session_id/task_id/**request_set_id**/machine_id/client_type/**source_session_id** 会话谱系)、UserMetadata。
- `CustomModelConfig{name,url,style,provider,type,model,parameters}`=BYOK 且带 style(响应格式适配)与 parameters。
- `ReasoningItem{id, encrypted_content}`(gpt-5 系推理项加密回传)、多模态 InputAudio、gRPC ChatService(Unary+ServerStream 双 rpc)、java_package=com.qoder.grpc——协议层为 gRPC/SSE 混合。

### 5. REA 对 app.asar 的重建读数(asar-analysis.json)[观察]
- evidence `ev_1c03427dd088…`、root sha256 `e9d780de…`、graph `jag_4458035b…`、semantic `jsrg_3882ff7c…`。
- statistics:relevant_files 4463、parsed_javascript_files **4157**、visited_ast_nodes **18,362,585**、findings **19,479**、parse_failures 16、text_bytes_read 118,061,676、nested_asar_containers 0。
- summary:browser_windows 6、explicit_web_preferences 33、**preload_entrypoints 0、context_bridge_apis 0**、ipc operations 5 且全部 dynamic channel(main_handlers 5)、utility_processes 0、native_addon_bindings 0。
- graph:nodes 17,096/edges 18,274/limitations 8,230、coverage=**partial**(semantic_result_budget 只剩 10,145 B);semantic_graph:nodes 31,707/relations 23,157/fingerprints 869/**unknowns 58,323**。
- integrity_contradictions 9 条(sharp libvips 两枚 dll、aoq-electron-sdk alivcffmpeg.dll 等,declared≠observed,已按 record-and-continue 记 observed-untrusted)。
- 文件面(kind 分布 javascript-asset 4157/unknown 8227/javascript-module 56/artifact 297/package 210/native-addon 9):**依赖含 @modelcontextprotocol 3455 文件、hono 1122、zod 530、jose 164、electron-updater 98、pdfjs/xlsx/mammoth(Office 预览)**;主进程 `out/main/electronMain.js` **17.4MB** 单文件 + pluginHost.js/remoteControlProcess.js/dataDirectoryProcess.js/remoteSdkDaemonBridge.js;渲染层 vite hash 资产(Cux9x6wn.js 14.7MB、presentation-render.worker×2);out/preload/pluginViewRuntime.cjs 2.5MB+pluginViewDiagramRuntime.cjs 3.4MB(插件视图沙箱)。

### 6. 用户态落点 [观察:目录名/大小;内容未查]
- `C:\Users\Administrator\.qoder-cn\`:`.auth/`(未碰)、`.models/`、`memory/`+`memories/`(两个并存!)、`plans/`、`projects/`、`file-history/`、`external-commands/`、`host-actions/`、`canvas/`、`qoder-knowledge/`、`plugins/`、`ipc/`、`mcp-router.json`、`mcp.json`、`installation_id`、`argv.json`、`.qoder-app-status.json`、`logs/`、`.cache/`、`.last-cleanup`。
- 兄弟目录并存:`.qoder/`、`.qoder-cli/`(仅 ai-stats)、`.qodersec/`、`.qoderwork/`、`.qoderworkcn/`。

## 二、上一轮实际跑过的 REA 命令与产物
1. `rea --help`(全局包 D:\caches\npm\prefix\node_modules\rea-agents,6.4.0)→ 超时转后台,后有完整命令清单输出(170 工具面)。
2. `rea analyze-javascript-application "G:/Qoder CN/.qoder-versions/0.4.11/resources/app.asar" --max-heap-mb 6144 --analysis-timeout-ms 1800000 --format json`(首次)→ **失败** `artifact_integrity_mismatch`(libvips-42.dll sha 不符),1295B 错误 JSON。
3. 同命令 + `--integrity-policy record-and-continue` → 成功,产出 `asar-analysis.json` 193,121,114 B + `.err` 853,166 B(17:51 落盘)。
4. `rea analyze-javascript-application ".../app.asar.unpacked/node_modules/@qoder-ai/qoder-cn-agent-sdk" --integrity-policy record-and-continue …` 后台启动(b4tmxahoq)→ 盘上有产物 **agentsdk-analysis.json 24,183,892 B(19:31 完成)**,但**导出件内从未解析过它**(会话在此之前断裂)——这是留给主席的最大现成矿。
5. 辅助:`inspect-evidence.mjs`(outline/findings/counts 三模式)、`extract-paths.mjs`(→ `files.json` 1.4MB,12,956 条路径)、`list-modules.mjs`(错误假设 node 有 role 属性,**作废**,modules.txt 恒 0B)。
- 放弃路径:REA MCP 未注册于当会话(mcp_list 无 mcp__rea__*)⇒ 改走 CLI;`--detail summary` 是 MCP 参数,CLI 无,改用 JSON 直解。

## 三、明确未完成清单
1. **agentsdk-analysis.json 未解析**(含 obf runtime 的重建证据,24MB 已在盘上,先跑 counts)。
2. extensions 9 插件 dist(62MB)未做 REA 分析,只读了 catalog manifest。
3. `out/main/electronMain.js` 未深挖(trace_application_feature 从未调用;系统提示词/上下文注入包结构**完全未取证**——任务主题之一空白)。
4. skill-creator SKILL.md、qoder-helper SKILL.md+knowledge 4 篇、collaboration SKILL.md 未读。
5. node-repl kernel.mjs/moduleLoader.mjs/operationEvents.mjs 未读。
6. vendor/qoder-security(config.yaml.example、security-patterns.yaml.example)与 vendor/qoder-sites artifact.json 未读。
7. bundled-resources 两个 zip 未解;umid/sgsdk.dll 未分析;0.4.9(根 resources)未对比 compare-application-versions。
8. 用户态 memory//memories//plans//projects//file-history 内容未取证(仅目录名);`.auth/` 按红线只看名(正确)。
9. **与 IHUI-AI 的差距对比一字未写**,交付报告从未产出。
10. runtime 观察(list_electron_targets/capture-electron-scenario)未用,全部结论限于静态。

## 四、未经证据支撑或已被推翻的假设(勿转述为事实)
1. [推断→疑伪]"Qoder 是 VS Code fork"——早期 thinking 假设;后续证据相反:product.json 无 VS Code 键、渲染层是 vite hash 资产、IPC literal channel=0、preload/contextBridge=0(VS Code fork 不可能如此)。合理解读:自研 Electron 壳 + 自有 pluginHost.js;但这也只是 [推断]。
2. [推断]"preload 为 0 因为 VS Code 内嵌结构"——未验证的顺口解释,且整文件级 out/preload/pluginViewRuntime.cjs 明明存在(2.5MB),REA 却报 preload_entrypoints 0 ⇒ 二者至少一条口径待查,**不能当事实**。
3. [假设→被观测推翻]"Qoder CLI 在 resources/bin"——bin 实测只有原生 helper;qoderclicn 实际以 worker runtime 形态住在 agent SDK(经 runtime-info.json 才确证)。
4. [假设→被观测推翻]"extensions 各目录有 package.json"——实测为 `.qoder-app-plugin/plugin.json` + catalog.v1.json 集中制。
5. [推断]"electronMain.js = VS Code main + Qoder 逻辑"——只凭 17MB 体积猜,未做过模块级取证。
6. [推断]"modules=0 表示图里没有模块"——实为 CLI 输出与 inspect_analysis_view 集合的口径差(graph.nodes 里有 javascript-module 56 个);解析该 JSON 时别重蹈 list-modules.mjs 的 role 假设。
7. 会话总结区无数值性断言可推翻,因**总结从未写出**——导出件里所有"发现"级陈述均以上述原始命令输出为准,未见任何先于证据的成稿结论。

## 附:关键落点绝对路径
- G:\IHUI-AI\.ihui-agent\tmp\qoder-rea\asar-analysis.json(193MB,ev_1c03427d…)
- G:\IHUI-AI\.ihui-agent\tmp\qoder-rea\agentsdk-analysis.json(24MB,**未解析**)
- G:\IHUI-AI\.ihui-agent\tmp\qoder-rea\files.json(12,956 路径)
- G:\IHUI-AI\.ihui-agent\tmp\qoder-rea\{inspect-evidence,extract-paths}.mjs(可复用;list-modules.mjs 作废)
- 对照程序:G:\Qoder CN\.qoder-versions\0.4.11\resources\
- 导出件原文:E:\桌面\深度重新使用rea的能力分析QODER，…_2026-10-30_19-55.md
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
