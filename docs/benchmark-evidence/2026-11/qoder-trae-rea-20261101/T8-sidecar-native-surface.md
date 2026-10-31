<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# T8 — Qoder 内置 sidecar 原生件取证（goal-b44 / D 席，2026-11-01）

> 席位：D 席（原生件取证，只读取证；不写本仓产品代码、不 commit/push）。
> 开工 HEAD（`git rev-parse HEAD` 现读）：`e28e5f6e4b0340cb181a741a55fcfb6025c01d8a`（分支 `main`）。
> 取证时刻：本机 2026-11-01 00:54 开工；件 1 Ghidra 全量分析 00:59→01:06 落地，脚本读数 01:10 落盘；件 2 01:07→01:23 全量分析并读数落盘（节拍与真实耗时见 §6，全部按文件 mtime 现读，非估算）。
> 结论三态：**[观察]** = 给出文件 + 可复验命令；**[推断]** = 由观察合成；**[未知]** = 取不到。
> 红线遵守：两枚 exe **全程未执行**（只读字节 + 静态分析）；未把对方源码/反编译整段贴进仓库（本册只写结构事实、符号名、定量读数与最短签名级片段）。

## 0. 对象与装机（[观察]）

| 件 | 体积 | 盘上 sha256（现读核验一致） |
| --- | --- | --- |
| `D:/DevEnv/Temp/rea-b44/new/qoder-computer-use/QoderComputerUse.exe` | 2,530,288 B | `9501bb0d513833c81e89e3981298d2bd477100de3ce992932b952aedce944eaa` |
| `D:/DevEnv/Temp/rea-b44/xlsx/xlsx-sidecar.exe` | 9,147,400 B | `18bee47b4ac95f94a7e6a6d96aa2ad8978f00a164e32458c2c18eaa2b9f5ae3a` |

复验：`sha256sum <上述两路径>`。

工具链（照 T4 §3 已验证流程，未自创路线）：

- Ghidra 12.1.4 = `D:/DevEnv/ghidra_12.1.4`，`support/analyzeHeadless.bat`，`JAVA_HOME=C:/Program Files/Java/jdk-21-temp/jdk-21.0.2+13`。
- 产物与脚本全部落项目外批准落点 `D:/DevEnv/Temp/ihui-scratch/goal-b44-ghidra/`（§15b）。仓库树内零产物、零 `.c`。
- 自研只读字节工具（本席临时件，`.ihui-agent/tmp/rea-goal-b44/`，gitignored）：`strings-pe.mjs`（ASCII+UTF-16LE 串抽取）、`pe-imports.mjs`（PE 导入表解析）、`pe-pdata-funcs.mjs`（`.pdata`/RUNTIME_FUNCTION 函数计数）；导出表复用前席单源 `.ihui-agent/tmp/goal-b41/pe-exports.mjs`。

### 0.1 为什么不走 `rea analyze`（[观察]，本席复核前席留痕）

- `.ihui-agent/tmp/rea-goal-b44/computer-use.analyze.json`：`code=provider_timeout`，`details.operation=list_documents`，`timeout_ms=330000`。
- `.ihui-agent/tmp/rea-goal-b44/xlsx.analyze.json`：同一超时之上再叠 `code=cleanup_incomplete`，残留 Ghidra 私有运行目录 `D:\DevEnv\Temp\rea-ghidra-6aa05de858a704cd01895e2ef9bd0f9c`（`close_binary` 删不掉，报「另一个程序正在使用此文件」）。
- 复验：`cat .ihui-agent/tmp/rea-goal-b44/{computer-use,xlsx}.analyze.json`；`ls -d D:/DevEnv/Temp/rea-ghidra-*`。
-  ⇒ 本席全程走 `analyzeHeadless.bat`，rea 未再用于整包。

### 0.2 前席 headless 失败根因（本席实测复现并修掉，后席必读）[观察]

1. `analyzeHeadless.bat` 的**项目父目录必须预先存在**，否则 `ERROR Abort due to Headless analyzer error: Directory not found: <projDir>` 且**仍然 exit 0**（静默假绿）。
2. Ghidra 自动编译 Java 脚本，**任何一处编译错 ⇒ `GhidraScriptLoadException: The class could not be found` ⇒ 一个产物文件都不落**，同样不影响退出码。前席 `goal-b42-ghidra/`、`goal-b43-ghidra/` 目录里**只有 log 与工程文件，零 `.txt`/`.c`**，即此型失效；`goal-b43-ghidra/harness_surface.java:28` 还含 Java 非法转义字面量 `"D:\DevEnv\..."`（`\D` 编译期即错）。
3. 复验：`grep -a "SidecarSurvey.java:" run_cu.log`；`ls D:/DevEnv/Temp/ihui-scratch/goal-b4{2,3}-ghidra/*.txt`（不存在）。
4. ⇒ 纪律：**每段分析后必须用文件存在性核验，不看退出码**；产物路径写死正斜杠。
5. 复用已分析工程只需 ~1 分钟：`analyzeHeadless <projDir> <projName> -process <文件名> -noanalysis -scriptPath <dir> -postScript <脚本>`（本席 cu 第二/三轮即此形态）。

## 1. A 组 — QoderComputerUse.exe：桌面自动化动作面

模块面（[观察]，符号内源码路径泄漏，`grep -oE "crates.{0,60}qoder-cua.{0,70}" | tr '\\' '/'`）：crate/包名 `qoder_computer_use_windows`，工作区 `crates/qoder-cua/`，模块清单——

- `src/main.rs`、`src/runtime.rs`、`src/errors.rs`、`src/logging.rs`
- `src/native/{accessibility,app_catalog,app_catalog_identity,appshot,capture,clipboard,input,launch,launchErrors,overlay,sdk_elements,window_registry}.rs`
- `src/protocol/mod.rs`、`src/protocol/helper/mod.rs`、`src/protocol/mcp/{mod,schema,content,run_steps,telemetry}.rs`

⇒ [推断] 分层 = `protocol/mcp`（对宿主的工具协议 + schema 生成）/ `protocol/helper`（内部子命令面）/ `native/*`（Win32·UIA·捕获实现）。

### 1.1 A-1 动作全集（[观察]，工具自述文本整段在 `.rdata`，含每个工具的参数语义）

14 个工具名（工具描述文本逐条点名，非猜测）：

`list_apps` · `list_windows` · `get_window` · `launch_app` · `activate_window` · `get_window_state` · `click` · `drag` · `scroll` · `press_key` · `type_text` · `set_value` · `perform_secondary_action` · `run_steps`

参数结构（自述文本与字段名串给出的键，节选）[观察]：

| 动作 | 参数键（观察到的字面标识符） |
| --- | --- |
| `click` | `x`/`y`（窗口相对截图像素）**或** `element_index`（UIA 语义点击）**或** `element_text`（须先有 `get_window_state(include_text:true)` 且唯一命中）；`mouse_button`（`left`…）、`click_count`；不支持的 `mouse_button` 报 `unsupported mouse_button: ` |
| `drag` | `from_x`/`from_y`/`to_x`/`to_y` |
| `scroll` | 窗口相对坐标 + `scrollX`/`scrollY` 增量 |
| `press_key` | X-style 键名或组合（自述举例 `Return`、`Tab`、`Control_L+a`）；`text`/`unicode` 路径 |
| `type_text` | 字面文本入焦点窗口；`press_key` 才用于组合键 |
| `set_value` | `element_index` + `value`（写 UIA 可编辑元素） |
| `perform_secondary_action` | UIA 次级动作：自述举例 `Raise` / `Scroll Up` / `Scroll Down` / `Expand` / `Collapse` |
| `get_window_state` | `window`（或 `id`+`app`）、`include_screenshot`、`include_text`、`max_tree_depth`/`max_tree_nodes`/`max_tree_chars`；返回 `screenshotId` + `accessibilityRevision` + `accessibility.tree` |
| `run_steps` | 批量编排：`steps`（有序 tool 调用）、`target.{app_filter,window_title_filter,source∈{list_apps,list_windows},launch_if_missing,launch_app,launch_poll_attempts,launch_poll_sleep_ms}`、`activate∈{auto,true,false}`、`post_step_sleep_ms`、`post_action_{state,include_screenshot,include_text,sleep_ms}`、`repeat`、`stop_on_error`、`return_step_results`、`rehydrate_on_target_stale`、`recover_state_capture`、`auto_text_state_for_element_text`、`retry_lightweight_timeouts`、`lightweight_retry_sleep_ms`、`final_state*`（`_expect_text`/`_expect_case_sensitive`/`_expect_mode∈{all,any}`/`_poll_attempts`/`_poll_sleep_ms`/`_include_{text,screenshot}`/`_max_tree_{depth,nodes}`/`_sleep_ms`）、`state_tree_{filter,context_lines,front_matter_lines,no_match_fallback,include_critical_context}`、`state_max_tree_lines` |
| 读面 | `list_apps(include_all)`、`list_windows(include_minimized)`、`get_window({window:{app,id}}‖{id,app})`、`launch_app(app id 或「validated executable」标识)` |

UIA 树节点侧观察到的属性键（[观察]）：`node_count`、`nodes`、`tree`、`element_index`、`role`、`localized`、`name`、`value`、`focused_element`、`selected_text`、`selected_elements`、`document_text`、`verticallyScrollable`/`horizontallyScrollable`、`verticalViewSize`、`snapshotRevision`。

动作实现层（[观察]，导入表现值；复验 `node pe-imports.mjs <exe>` + `PE_FILTER` 见 §5）：`user32!SendInput`、`user32!SetCursorPos`、`user32!GetAsyncKeyState`、`user32!SetForegroundWindow`/`AllowSetForegroundWindow`、`user32!PrintWindow`、`gdi32!BitBlt`、`user32!{Open,Get,Set}ClipboardData`、`kernel32!CreateProcessW`、`shell32!ShellExecuteExW`、`ntdll!NtCreateNamedPipeFile`、`dwmapi`+`d3d11`（各 1/2 枚）。导入表**不含** `UIAutomation*` 静态符号 ⇒ [推断] UIA 走 COM 运行时激活（`api-ms-win-core-winrt-l1-1-0.dll` + `ole32!CoCreateInstance`，符号串含 `CoInitializeEx`、`windows-0.61.3/src/Windows/Graphics/Imaging/mod.rs`）。

捕获后端链（[观察]）：`wgc` / `bitblt` / `printwindow` 三后端 + `fallbackBitBlt`、`fallbackPrintWindow` 退化字段 + `Direct3D11CaptureFramePool` + `capture_backend`、`captureBackend`、`screenshotCount`、`relatedTransientWindows`/`compositedRelatedTransientCount`（合成瞬态窗口）。

### 1.2 A-2 权限与确认边界的实现痕迹（本席最关心一格）

[观察] **存在的硬边界**（全部给字面标识符/整句自述，可在 §5 命令复现）：

1. **陈旧态拒绝执行**：`accessibilityRevision`/`snapshotRevision` 作为动作前置；错误文案整句——
   - `element_text requires a current get_window_state(include_text:true) result before the element action`
   - `uses element_index without a current accessibilityRevision; pass state from get_window_state(include_text:true), add get_window_state before this step, or provide accessibilityRevision explicitly`
   - 环境变量开关 `QODER_CUA_REQUIRE_ACCESSIBILITY_REVISION_FOR_ELEMENTS`
   - ⇒ [推断] 「必须先看到再动手」是**协议级强制**，不是建议；对应错误码族 `target_stale`/`requires_refetch`/`screenshot_stale`。
2. **前台校验后才允许指针输入**：`foregroundStatus` + 状态字 `blocked_before_pointer_input`（同处 `.rdata` 串块，`grep -oE ".{0,120}blocked_before_pointer_input.{0,60}"`）。⇒ [推断] 目标不在前台时**拦下**点击，而不是盲发 `SendInput`。
3. **启动目标校验 + 提权检测**：错误族 `app_not_launchable`（"Launch target is not a file."）、`app_not_found`（"The application or a required launch path was not found."）、`app_access_denied`（"Permission denied while accessing the launch file."）、`app_path_check_failed`（"Unable to inspect the launch file."）、`launch_path_check`、**`elevation_required`（"Starting the application requires administrator privileges."）**、`launch_failed`；启动器两条策略字面量 `rust-shellexecute` / `rust-createprocess-fallback`；`launch_app` 自述只接受 "app id or **validated executable** identifier"。⇒ [推断] 应用面是**目录白名单 + 路径核验**模型（`app_catalog.rs`/`app_catalog_identity.rs`/`--qoder-cua-apps-folder-catalog`/`QODER_CUA_APPS_FOLDER_IN_PROCESS`），不是任意路径直执。
4. **可中断**：`user_interrupted` 状态字 + `userInterruptedLatched` 锁存标志（同块）；`turn_id`/`session_id` 与中断态同处一条日志字段串。⇒ [推断] 中断是**闩锁**（一次打断后本回合不再继续动手），不是 merely 取消单次调用。
5. **有界重试，且输入类不重试**：`stop_on_error` 默认 true（首个失败步即停并回 `failedStep`）；`rehydrate_on_target_stale` 默认 true 且「retries that same step **once**」；`recover_state_capture` 「retries that state capture **once**」；`retry_lightweight_timeouts` 仅覆盖 `list_apps`/`list_windows`/`get_window`，自述明写 **`Input actions are never retried by this option`**；`repeat` 默认 1，且「`element_index`/`element_text` cannot repeat」，坐标重复还需 `post_action_state+post_action_include_screenshot` 才给每重复一份新 `screenshotId`。⇒ [推断] 「不重复动手/不盲目重试输入」是刻意设计的失效方向。
6. **体积与令牌预算**：`request_too_large`（"Appshot request exceeded the size limit"）、`size_limit`、`max_tree_depth/nodes/chars`、`state_max_tree_lines`、`axTruncated`/`ax_node_count`、`state_tree_*` 摘要族（含 `no_match_fallback`「给有界前缀摘录而不是空树」）。
7. **日志脱敏黑名单（实装）**：两条独立字段清单里都出现 `password`/`token`/`secret`/`authorization`/`cookie`/`prompt`/`url`/`request`/`arguments`/`axtree`/`clipboard`/`base64`/`dataurl`（`grep -oE ".{0,120}password.{0,90}"`）。⇒ [推断] 敏感类别在写日志前被摘掉；剪贴板内容也在脱敏集内。
8. **动作可见性 + 看门狗**：`QODER_CUA_OPERATION_OVERLAY`、`QODER_CUA_OPERATION_OVERLAY_GRACE_MS`、`QODER_CUA_OPERATION_OVERLAY_WATCHDOG_MS`，配套模块 `src/native/overlay.rs`，自测入口 `--qoder-cua-self-test-overlay`。⇒ [推断] 自动化动作期间有**屏上遮罩/指示层**，并有看门狗管它（不是无痕操作）。
9. **捕获子进程隔离**：`QODER_CUA_CAPTURE_CHILD`、`QODER_CUA_WGC_ISOLATED`、`QODER_CUA_CAPTURE_PROCESS_TIMEOUT_MS`（+`capture_child_timeout`、`QODER_CUA_CAPTURE_PROCESS_TIMEOUT_MSG`）、`src/native/capture.rs` 里 `child_pid`/`isolated WGC capture returned no result`；`isolationFallback` + `isolationFallbackReason`。⇒ [推断] 屏幕捕获被推出到**独立子进程**，失败时按原因记退化路径。
10. **能力级 kill switch（逐动作）**：`QODER_CUA_NATIVE_UIA_ACTIONS`、`QODER_CUA_NATIVE_GET_WINDOW_STATE_TEXT`、`QODER_CUA_NATIVE_GET_WINDOW_STATE_COMBINED`、`QODER_CUA_NATIVE_GET_WINDOW_STATE_SCREENSHOT`、`QODER_CUA_NATIVE_INPUT`、`QODER_CUA_NATIVE_LIST_WINDOWS`、`QODER_CUA_NATIVE_GET_WINDOW`、`QODER_CUA_NATIVE_LIST_APPS`、`QODER_CUA_NATIVE_LAUNCH_APP`、`QODER_CUA_TYPE_TEXT_CLIPBOARD`、`QODER_CUA_TYPE_TEXT_UIA_FALLBACK`、`QODER_CUA_CLEAR_CLIPBOARD_AFTER_TYPE_TEXT`、`QODER_CUA_POINTER_ANIMATION(_MAX_MS)`、`QODER_CUA_VERBOSE_{HELPER,MODEL}_RESULTS`、`QODER_CUA_LOG_*`（`MODE`/`LEVEL`/`DIR`/`QUEUE_CAPACITY`/`REFRESH_SECONDS`/`SHUTDOWN_MS`）。⇒ [推断] 每个动作族都能被环境位单独摘线；指针移动有动画上限（人眼可跟）。
11. **父进程校验（反代理边界）**：宿主启动器明文注释——`// Bridge 会校验直接父进程；不能用 spawn 在宿主与 Bridge 之间留下 Node launcher。`、`// 正式 Bridge 会校验签名父进程，本地 Electron 开发态使用 Dev Bridge。`（`G:/Qoder CN/resources/extensions/qoder.computer-control/dist/cli/computerUseWindows/bin/computerUseClientLauncher.cjs:37,62,91`）⇒ [观察] 设计上「谁生我」决定我是否干活；[未知] 该核验在本 exe 内的具体实现函数（未做反编译定位，见 §4）。

[观察] **没找到的东西（不冒充）**：

- **没有**任何「需人工点确认/审批对话框」的符号痕迹：`approval`/`approve`/`consent`/`confirm_dialog`/`hitl`/`human_in_the_loop` 在 `.rdata` 全部 0 命中。⇒ [推断] 人工批准门（若有）住在**宿主/IDE 侧**，不在原生 exe 里。
- **没有**速率限制实现痕迹：`rate_limit`/`throttle`/`per_minute`/`cooldown`/`max_requests`/`backoff` 0 命中；只有超时（`timeout_ms`、`*_sleep_ms`、`*_poll_attempts`）与有界重试。⇒ [推断] 节流靠「超时 + 有界步骤 + 有界重试」三件，不靠 QPS 闸。
- 没有 `SetWindowsHookEx`、`VirtualAllocEx`、`WriteProcessMemory`、`CreateRemoteThread` 等注入类导入（导入表 238 枚全列，见 §5）⇒ [推断] 动作 = 用户态输入 API + UIA 语义写值，**不是**跨进程内存注入。

### 1.3 A-3 与宿主通信（[观察]）

- 传输 = **宿主 spawn 子进程、继承 stdio**：启动器 `spawn(executable, args, { env, stdio: "inherit", windowsHide: true })`（POSIX 则 `process.execve` 直接替换进程以免留下中间父进程）。运行期落点 `$QODER_HOME/bin/qoder-cn-computer-use/QoderComputerUse.exe`（`QODER_HOME` 缺省 `~/.qoder-cn`）。
- 协议 = **MCP 形态 JSON-RPC**：`.rdata` 有 `mcp.initialize`、`mcp.tools_list`、`protocolVersion`、`unknown_method`、`invalid_json`、`params`/`method`/`requestId`/`response_build_ms`；模块面 `src/protocol/mcp/{mod,schema,content,run_steps,telemetry}.rs`（`schema.rs` ⇒ 工具参数 JSON Schema 生成侧）。⇒ [观察] 方法名与 `tools/list`·`tools/call` 语义一致；但**那两枚字面串本身落在 `.text` 段**（很可能是指令字节假阳性），故本册不把 `tools/list` 当实证据，改以 `mcp.tools_list`/`mcp.initialize`（`.rdata`）为据。
- 宿主注入的环境位（启动器实测）：`QODER_CUA_LOG_MODE=ide`、`QODER_CUA_IDE_PRODUCT`、`QODER_CUA_LOG_LEVEL=info`。
- 产品身份（启动器内 base64，非凭据，解码即得）：`{"productId":"qoder-cn","defaultHomeDirectory":".qoder-cn","runtimeResourceId":"qoder-cn-computer-use","macosAppName":"Qoder CN Computer Use.app","macosDevelopmentAppName":"Qoder CN Computer Use Dev.app","windowsIdeProduct":"QoderCN","displayName":"Qoder CN Computer Use"}`。
- 命名管道：`ntdll!NtCreateNamedPipeFile` + UTF-16 串 `\Device\NamedPipe\`（`.rdata` 唯一命中，无固定管道名字面量）⇒ [推断] 管道用于**自身捕获子进程**（`QODER_CUA_CAPTURE_CHILD`）而非宿主通道；[未知] 管道名生成规则。
- 端口/HTTP：**零命中**（无 `127.0.0.1`、无端口字面量、无 `ws`/`http` server 面）⇒ [观察] 不存在 TCP 服务面。
- 内部自调用模式：`--qoder-cua-capture-window-*`、`--qoder-cua-apps-folder-catalog`、`--qoder-cua-self-test-overlay`、`--qoder-cua-sdK-action*`（原文大小写混杂，逐条见 §5 命令）、`--version` ⇒ [推断] exe 以自身为多模式入口（helper/子捕获/目录枚举/自测）。

## 2. B 组 — xlsx-sidecar.exe：表格能力面

### 2.1 B-2 入口协议形态（[观察]，最硬一格）

`.rdata` 给出 serde **内部标签枚举**与全部标签（复验见 §5）：

- `command` + `internally tagged enum Command` + `variant index 0 <= i < 14`；`struct Request`；封套字段 `version`、`requestId`、`ok`、`result`、`error{code,message}`。
- **14 个命令标签逐字**：`handshake` · `open` · `read_range` · `close` · `read_media` · `read_formula_cells` · `cancel` · `archive_manifest` · `read_entries` · `scan_entries` · `save_archive` · `recalc_cells` · `convert_workbook` · `hash_entries`
- 同名 `struct variant Command::{HashEntries,Close,SaveArchive,ReadRange,Open,ConvertWorkbook,RecalcCells,ReadEntries,ReadFormulaCells,ReadMedia,ScanEntries,Cancel,ArchiveManifest,…}`。
- 错误码族：`invalid_request`、`workbook_error`、`io_error`、`recalc_busy`（整句 "Formula engine is busy with another recalculation."）、`cancelled`（整句 "Request was cancelled by the client."）、`unsupported_version`（整句 "Unsupported sidecar protocol version."）。
- 数据结构字段（观察到的键）：`Entry{name,crc32,compressedSize,uncompressedSize}`、`EntryContent{content,path}`、`Manifest{path,beforeEntries,afterEntries}`、`Cell{sheet,row,column,formatted,number,value,isError,isFormula,unsupportedFormula}`、`Recalc`/`Edit`/`input`、`cells`/`cached`；样式与结构族 `tableStyleElements{headerFill,stripeFill,secondRowStripeFill,columnStripeFill,wholeTableFill,firstColumnFill,lastColumnFill,totalRowFill,totalRowFontColor,totalRowBorderColortotalRowBorderStyle,bodyFontColor,subheadingFill,…}`、`numFmt/numberFormat`、`font/fill/border/alignment`、`mergeCells`、`conditionalFormatting`、`sparklines`、图表族（`barChart/areaChart/lineChart/pieChart/doughnutChart/scatterChart/radarChart` + `trendline/labels/categoryGroups/pointExplosions…`）、数据校验族（`allowBlanks/suppressDropdown/showInputMessage/showErrorMessage/errorStyle/promptTitle`）、`lockStructure/hasPassword`、`showGridLines/showFormulas/rightToLeft/zoomScale`。
- 响应尺寸闸（[观察]整句残缺但可判）：`Range exceeds the <limit>`、`Recalc read exceeds <limit>`、`Embedded image exceeds the media response limit.`（源文件 `src\visuals.rs`）。
- 压缩包防护（[观察]）：`Archive header is too large`、`number of read bytes exceeds limit`、`Could not find EOCD`、`EOCD comment exceeds file boundary`、`EOCD64 extends beyond EOCD64 locator`、`Variable-length field extends beyond file boundary`、`AES encryption without AES extra data field`。⇒ [推断] 对 zip 结构做边界校验，含 OLE-CFB/AES 加密包识别（`cfb.rs` + `aes-0.8.4`）。
- 并发/worker（[观察]）：`Unable to start the recalc worker:` + `recalc_busy` ⇒ [推断] 重算走独立 worker，忙时显式回错而非排队静默。
- 入口本体：`qoder-office-xlsx` + `src\main.rs`（同一条串块）⇒ crate 名 `qoder_office_xlsx`，产品名 `qoder-office-xlsx`。
- 结论：协议是**自研 sidecar JSON 命令协议（带 `version` 握手 + `requestId` + 可取消）**，不是 MCP `tools/list` 形态；[未知] 帧形态（NDJSON vs 长度前缀）——`.rdata` 只给出 serde_json 语法字符集 `{}"true null[,]:/` 与 `stream did not contain valid UTF-8`，无 `Content-Length` 痕迹。⇒ [推断] 走 stdio 行式 JSON，但**不作实证**。

### 2.2 B-1 只读还是含写回：**含写回**（[观察]）

- 命令面直接有 `save_archive` + `convert_workbook` + `recalc_cells` ⇒ 写路径在册。
- 写出侧符号：`zip` 的 `ZipWriter`（整句 "write(): ZipWriter was already closed"、"ZipWriter drop failed: "）+ 写压缩栈 `zopfli-0.8.3`、`flate2-1.1.9`、`bzip2-0.4.4`、`zlib-rs-0.6.6`。
- 读侧模型仍完整：calamine 全套读模块（§2.3）+ 样式/图表/校验的字段级建模。
- **重算/公式**为写回前置：ironcalc 的 `expressions/{lexer,parser}`（含 `stringify.rs` ⇒ 公式可**回写为文本**）+ `formatter/{format,dates,lexer}`（数值格式渲染）+ 全量 Excel 函数库观察（`BESSELJ/K/Y/I`、`AMORDEGRC/AMORLINC`、`COUPNUM`、`TBILLEQ/PRICE/YIELD`、`XLOOKUP`、`IMSUM/IMPRODUCT`、`COUNTIFS/SUMIFS/AVERAGEIFS`、`WORKDAY/NETWORKDAYS/GCD/LCM/MULTINOMIAL/LCM/FVSCHEDULE` 等）。⇒ [观察] 公式引擎不是"只识别不计算"。
- [未知] 写回**保真度**（哪些 OOXML 子结构在 `save_archive` 时被原样透传、哪些被重生成）：需逐命令反编译，本席时间盒外（§4）。

### 2.3 B-3 引擎：包装开源，不是自研（[观察]）

- **读引擎 = calamine 的 vendored 分叉**，源码路径逐字泄漏到 `office\vendor\genoffice\apps\sheets\native\calamine\src\{lib,attrs,cfb,ods,utils,xls,xlsx/mod,xlsx/cells_reader,xlsb/mod,xlsb/cells_reader}.rs` ⇒ 不是 crates.io 直依，是**仓内 vendor 分叉**（可打补丁）。
- **计算/模型引擎 = ironcalc**：crate 台账 `ironcalc-0.7.1`、`ironcalc_base-0.7.1`（38 处符号），模块树 `import/{workbook,worksheets,styles,colors,util}.rs`、`expressions/{lexer/{mod,ranges,structured_references,util},parser/{mod,static_analysis,stringify}}`、`functions/*`（`financial`、`date_and_time`、`logical`、`lookup_and_reference`、`mathematical`、`statistical/*`、`text`、`xlookup`、`database`、`subtotal`、`engineering/number_basis`、`binary_search`、`financial_util`、`text_util`）、`formatter/{dates,format,lexer}`、`number_format.rs`、`styles.rs`、`model.rs`、`language/mod.rs`、`locale/mod.rs`、`utils.rs`。
  - Ghidra 侧独立印证（[观察]）：`xl_strings_defined.txt` 里 `ironcalc_base` 逐条命中 **38** 次、`ironcalc` 6 次（与字节层同数 ⇒ 不是抽取器假象）；`archive_manifest`、`convert_workbook` 两枚命令标签在 Ghidra 已定义串里**各自独立成串**（余 12 枚只出现在合并串块内，见 §5 行号锚点）。
  ⇒ 关键结构事实：泄漏到的只有 **`import/`** 一族，**没有 `export/`** 模块（`grep -oiE "[a-z_]*export[a-z_]*"` 在 9.1MB 件上 **0 命中**）⇒ [推断] xlsx **写出不是走 ironcalc 的 export 通道**，而是自研/其它 `zip+quick-xml` 通道（`save_archive`/`Manifest{beforeEntries,afterEntries}` 的形状正是"条目级增量重写"，即只替换改动的 zip 条目）。
- 其它在册依赖（版本逐字）：`quick-xml 0.38.4/0.41.0`、`roxmltree 0.19.0/0.21.1`、`zip 0.6.6/4.6.1/8.6.0`（三枚并存，版本号按泄漏字面记录，未做上游对照）、`serde/serde_core 1.0.228`、`serde_json 1.0.150`、`bitcode 0.6.9`、`indexmap 2.14.0`、`hashbrown 0.16.1/0.17.1`、`chrono 0.4.45`、`chrono-tz 0.10.4`、`uuid 1.24.0`、`statrs 0.18.0`、`rand 0.8.7`+`rand_chacha 0.3.1`、`regex 1.13.1`+`aho-corasick 1.1.4`、`aes 0.8.4`+`constant_time_eq 0.1.5`+`generic-array 0.14.7`、`encoding_rs 0.8.35`、`memchr 2.8.3`、`fast-float2 0.2.3`、`atoi_simd 0.18.1`、`bumpalo 3.20.3`、`phf/phf_shared 0.12.1`、`itoa 1.0.18`、`rustc-demangle 0.1.26`。
- 自有模块（泄漏文件名，前缀被打包器截短，[未知] 归属包）：`src/visuals.rs`（媒体/图片响应限额）、`src/spreadsheetml.rs`、`src/shared_formulas.rs`、`src/sparklines.rs`、`src/table_styles.rs`、`src/refs.rs`、`src/recalc.rs`、`src/worksheet.rs`。⇒ [推断] 一层"OOXML 结构自研薄层"覆在 calamine(读)+ironcalc(算)+zip(容器) 之上。
- 构建机痕迹：镜像源 `index.crates.io-1949cf8c6b5b557f` 与 `rsproxy.cn-e3de039b2554c837`（两件不同件各用一枚），构建用户 `C:\Users\qoder\` ⇒ [观察] 同一厂商 CI，不同 job。

## 3. C 组 — 两件共同的定量读数

| 指标 | QoderComputerUse.exe | xlsx-sidecar.exe | 口径 |
| --- | --- | --- | --- |
| PE 导出目录 | **0 枚**（`exports=0 named=0`） | **0 枚** | [观察] `node .ihui-agent/tmp/goal-b41/pe-exports.mjs <exe>` |
| Ghidra 导出面（external entry point 口径） | `EXPORTS=1`：仅 `entry @ 1401ce7cc` | `EXPORTS=2`：`entry @ 14054bae4` + **`tls_callback_0 @ 1404bd000`** | [观察] `<p>_exports.txt`。两件 PE 导出目录皆 0；Ghidra 把入口点/TLS 回调算作外部入口，**两个口径不得混说** |
| 函数总数 | **6,995**（Ghidra）/ **6,831**（`.pdata` RUNTIME_FUNCTION，非空且 begin/end 全唯一，差 164 = Ghidra 额外识别的 thunk） | **15,168**（Ghidra）/ **14,998**（`.pdata`，同口径差 170） | [观察] `<p>_summary.txt` + `node .ihui-agent/tmp/rea-goal-b44/pe-pdata-funcs.mjs <exe>`（两口径互验，任一单独都可复现） |
| 导入 | 238 枚 / 21 DLL（PE 解析）；Ghidra 侧 233 枚外部函数 | 110 枚 / 6 DLL（PE 解析）；Ghidra 侧 102（`KERNEL32` 100、`ntdll` 4、`synch-l1-2-0` 3、`bcrypt`、`bcryptprimitives`、`ADVAPI32`） | [观察] `node pe-imports.mjs` + `<p>_imports.txt`（Ghidra 侧偏少 = 逐名去重） |
| 命名函数（Ghidra） | 69 枚（其余 `FUN_`/`thunk_`/`caseD_`）⇒ Rust 发布件剥符号 | 172 枚（同形：`caseD_`/`thunk_FUN_` 为主） | [观察] `<p>_names.txt` |
| Ghidra 已定义字符串 | 1,913 | 3,864 | [观察] `<p>_summary.txt` |
| 节表 | `.text .rdata .data .pdata .reloc` | `.text .rdata .data .pdata .fptable .reloc` | [观察] `pe-exports.mjs` |
| 是否 Rust | **是**：`/rustc/48a229ceaefd4985c50990b14116b6d856af0985`（`/rustc/`+40hex 出现 **131 次**，哈希唯一）；Ghidra `Applied data type archive: rust-common`（多次） | **是**：`/rustc/254b59607d4417e9dffbc307138ae5c86280fe4c`（同口径 **131 次**，哈希唯一） | [观察] 两件事 **rustc commit 不同** ⇒ 不同 toolchain 独立构建；计数用 `grep -oE "/rustc/[a-f0-9]{40}" \| wc -l`（`-c` 只数行，会低估） |
| 嵌入脚本资源 | **无**（`.ps1/.vbs/.vbe/.js/.ts/.py/.lua/.bat/.cmd/.vba` 字面 0 命中；仅 `.json`） | **无**（同上；另有 `Node.js` 字面 2 处，落在第三方串里，不作主张） | [观察] §5 grep 清单 |
| `target` 自述 | `resource.json` 报 `x86_64-pc-windows-msvc`；实测 `x86:LE:64:default` + MSVC CRT（`VCRUNTIME140.dll`、`__scrt_common_main_seh`、`api-ms-win-crt-*`） | 同 | [观察] `cu_summary.txt` + `cu_names.txt` |
| 构建时间戳 | PE `TimeDateStamp` → 2026-10-12T09:28:35Z | 2026-10-30T05:32:09Z | [观察] `pe-exports.mjs` |

`.fptable` 只在 xlsx 件出现（无 `.detourc/.detourd` 伴随）⇒ **不得**据 T4 的 Detours 三件套推它等于 Detours；[推断] 该节由 CFG/IAT 相关链接选项产生，具体未判。

## 4. 未取到的面（如实 [未知]）

1. **逐函数反编译未做**（两件的 `TOTAL_FUNCS` 与串表读数已齐，§3）：尤其 A-2 第 11 条的**父进程/签名父进程核验实现位置**、`save_archive` 的**条目级 zip 重写实现**、`run_steps` 解释器主循环——三处都需定点反编译，本席时间盒外。工程已落盘（`proj_cu/cu_proj`、`proj_xl/xl_proj`），后席只需 `-process … -noanalysis -postScript` 一分钟档即可在其上跑任意目标函数集（§5 末条）。
2. xlsx sidecar 的**帧形态**（NDJSON vs 长度前缀）与 `open/save_archive` 的**字段级 schema**。
3. CU 的 `perform_secondary_action` 可用动作**全集**（自述只举例 5 个）。
4. 两件的签名/证书链（本席只做静态字节，未查 Authenticode）。

## 5. 复验命令（逐条对应上文）

```bash
# 件体与哈希
sha256sum "D:/DevEnv/Temp/rea-b44/new/qoder-computer-use/QoderComputerUse.exe" \
          "D:/DevEnv/Temp/rea-b44/xlsx/xlsx-sidecar.exe"
# PE：节表/导出/时间戳
node .ihui-agent/tmp/goal-b41/pe-exports.mjs "D:/DevEnv/Temp/rea-b44/new/qoder-computer-use/QoderComputerUse.exe" \
                                      "D:/DevEnv/Temp/rea-b44/xlsx/xlsx-sidecar.exe"
# PE：.pdata 函数计数（本席新件）
node .ihui-agent/tmp/rea-goal-b44/pe-pdata-funcs.mjs <exe>...
# PE：导入表（A-1/A-2 判据；DLL 名在描述符 +12，ILT +0，IAT +16）
PE_FILTER="SendInput|SetCursorPos|PrintWindow|BitBlt|NtCreateNamedPipe|Clipboard|CreateProcessW|ShellExecuteEx|Foreground" \
  node .ihui-agent/tmp/rea-goal-b44/pe-imports.mjs <exe>...
# 串层（先重建抽取件，gitignored 夹具）
node .ihui-agent/tmp/rea-goal-b44/strings-pe.mjs <exe> 5 out.strings.txt
# A-1 工具自述整段（一次给全 14 工具与参数语义）
grep -nE "get_window_state|run_steps|perform_secondary_action" out.strings.txt | sed -n '1,40p'
# A-2 边界族
grep -oE ".{0,150}(elevation_required|blocked_before_pointer_input|user_interrupted|app_access_denied|request_too_large).{0,110}" out.strings.txt
grep -oE "QODER_CUA_[A-Z0-9_]+" out.strings.txt | sort -u
# A-3 宿主腿与协议
grep -oE ".{0,70}(mcp\.initialize|mcp\.tools_list|protocolVersion|unknown_method|invalid_json).{0,60}" out.strings.txt
sed -n '37p;58,76p;90,99p' "G:/Qoder CN/resources/extensions/qoder.computer-control/dist/cli/computerUseWindows/bin/computerUseClientLauncher.cjs"
# B-2/B-1 命令枚举与写回
grep -nE "internally tagged enum Command|archive_manifest" out.strings.txt   # xl 件第 49802/49807 行区
grep -oiE "[a-z_]*(save|write|export|recalc|convert)[a-z_]*" out.strings.txt | sort | uniq -c | sort -rn
# B-3 引擎
grep -oE "ironcalc[a-z_]*-0\.7\.1[\\\\/]src[\\\\/][a-zA-Z0-9_\\\\/.-]*\.rs" out.strings.txt | tr '\\' '/' | sed 's|.*src/||' | sort -u
grep -oE "office.{0,10}vendor.{0,80}" out.strings.txt | sort -u | head -30
grep -oE "[a-zA-Z0-9_-]+-[0-9]+\.[0-9]+\.[0-9]+[\\\\/]src" out.strings.txt | sed 's/[\\\\/]src$//' | sort -u
# Ghidra：两件的三段读数（均已落盘）
cat D:/DevEnv/Temp/ihui-scratch/goal-b44-ghidra/{cu,xl}_summary.txt
cat D:/DevEnv/Temp/ihui-scratch/goal-b44-ghidra/{cu,xl}_exports.txt
# 从零重跑（本席实际用的包装，均已真跑通；先 mkdir 工程父目录，见 §0.2）
#   D:/DevEnv/Temp/ihui-scratch/goal-b44-ghidra/run_{cu,xl}.bat 内容即：
#     set JAVA_HOME=C:\Program Files\Java\jdk-21-temp\jdk-21.0.2+13
#     set SIDECAR_OUT_DIR=D:/DevEnv/Temp/ihui-scratch/goal-b44-ghidra
#     set SIDECAR_PREFIX=cu|xl
#     analyzeHeadless.bat <projDir>\proj_<cu|xl> <projName> -import <exe> \
#       -scriptPath D:\DevEnv\Temp\ihui-scratch\goal-b44-ghidra -postScript SidecarSurvey.java
# 只重取读数（工程已在，~1 分钟，不重分析）：
#   run_cu2.bat / run_xl2.bat = 同脚本换 `-process <exe名> -noanalysis`
cmd //c "D:/DevEnv/Temp/ihui-scratch/goal-b44-ghidra/run_xl2.bat"
```

## 6. 时间与实际节拍（[观察]）

| 步 | 实测（按产物文件 mtime 现读：`stat -c %y <file>`） |
| --- | --- |
| 件 1 导入 + 全量自动分析 | 00:59 → 01:06（`run_cu.log` mtime），≈**6.5 分钟**（其中 `Decompiler Switch Analysis` 单项 **269.022 s**；该轮 1,997 条 WARN，其中 1,994 条为 `DecompileCallback` pcode 警告） |
| 件 1 脚本重跑（`-noanalysis -process`） | 01:09 → 01:10:39（`cu_summary.txt` mtime），≈**1 分钟**（三轮：两轮 Java 编译错、一轮成） |
| 件 2 导入 + 全量自动分析 + 读数落盘 | 01:07 → 01:23:14（`xl_summary.txt` mtime），≈**16 分钟**，在 25 分钟单件盒内；该轮 `run_xl.log` 3,014+ 条 WARN |
| 本席总机器时间 | 00:54 → 01:24 ≈ **30 分钟**（50 分钟盒内；件 1 单件 6.5 分钟、件 2 单件 16 分钟，均在 25 分钟盒内） |

## 7. 与本仓对位（只登记事实差，落地裁决归主席）

- 本仓 `apps/desktop/src-tauri/src/operator.rs`（359 行 capture-decide-act 闭环）与 `OperatorAction` 枚举 vs 对侧 14 工具：对侧多出**语义写值通道**（`set_value` / `perform_secondary_action` 走 UIA pattern，不是像素点击）与**批量编排 + 末态自证**（`run_steps` 的 `final_state_expect_text` + `accessibilityRevision` 陈旧拒执）。
- 对侧**原生件内**未找到人工审批门与速率闸:「`.rdata` 0 命中」是 [观察],「门住在宿主 JS 侧而非原生侧」是 [推断](人工确认确实在宿主)⇒ **不得写成「Qoder 没有审批门」**。本仓把审批门与按类别重试禁令内置在 `operator.rs` 原生执行层,是**不同层的取舍**:它不构成对侧缺失的证明,只构成本仓这一层的可测不变式(拒绝路径不构造 Enigo 实例、输入类尝试上限结构上读不到 policy)。后"。
- 可直接吸收的边界形状（[推断]，均有本册 [观察] 支撑）：① 动作前置「revision 必须先看到」+ 陈旧即拒；② 输入类**永不自动重试**；③ 敏感类别日志脱敏黑名单；④ 逐动作环境位摘线 + 屏上 overlay 看门狗；⑤ 捕获退到子进程带超时；⑥ xlsx 写出用**条目级 zip 重写**而非整簿重序列化。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
