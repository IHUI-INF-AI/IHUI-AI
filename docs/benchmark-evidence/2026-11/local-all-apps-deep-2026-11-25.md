<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

> **已被取代（2026-11-25 01:30）**：本报告因“覆盖截断 + 把 Electron 出厂 API 当产品沙箱”被推翻，现行版本为 [`local-all-apps-exhaustive-2026-11-25.md`](./local-all-apps-exhaustive-2026-11-25.md)（11 个目标、前端/核心/后端三层取证）。本文件仅保留作对照，不再作为结论依据。

# 本机全部 AI 程序穷尽 deep 取证：前端 + 核心（2026-11-25，全量推翻重做）

> **这是对此前 `local-five-deep-2026-11-24.md` 的完全推翻与重做**。用户指出旧报告“根本不全、根本没榨干”，经复核实证：① 旧报告只覆盖 5 个目标，而本机实际装有 **12 个** AI 编码/客户端程序；② 旧报告对每个目标的前端（JS/Electron bundle）与核心（native/主进程/服务）取证深度不足。
> 本报告用 Craft Anything 0.5.0 `--deep` 静态模式，对本机**全部 12 个**目标重新取证，每个都做**前端 js_app_map + 核心 core_feature_find/native_strings**，结论带 `ev_...` 证据号。证据账本在 `.workbuddy/craft/all-ai-apps-full-2026-11-25.cany/` 及 4 个 `probe-*.cany`。
> 约束：不运行目标程序本体、不读凭据/Cookie/Token；静态字节为准，动态行为与运行期语义标未知；“未发现”只覆盖已搜索范围，不等于“没有”。

## 0. 本机 AI 程序全清单（本轮现读，注册表 + 磁盘 + 进程）

| # | 目标 | 版本 | 实测安装根 | 形态 |
|---|---|---|---|---|
| 1 | Codex | 26.1117.4957.0 | `C:/Users/Administrator/AppData/Local/OpenAI/Codex/` + WindowsApps 包 | Rust CLI + 原生 helper |
| 2 | Trae CN | 3.4.20 | `C:/Trae CN/` | Electron (VS Code 系) |
| 3 | WorkBuddy | 5.11.3 | `C:/workbuddy/` | Electron |
| 4 | Qoder CN | 0.5.14 | `C:/Qoder CN/.qoder-versions/0.5.14/` | Electron |
| 5 | ZCode | 3.19.1 | `C:/ZCode/` | Electron |
| 6 | Cursor | 3.27.22 | `C:/Users/Administrator/AppData/Local/Programs/cursor/` | Electron |
| 7 | 豆包 | 2.32.6 | `C:/Program Files/Doubao/` | Electron |
| 8 | DeepSeek Harness | 0.2.2-rc.5 | `C:/Apps/DeepSeekHarness/` | Electron |
| 9 | OpenCode | 2.2.7 | `C:/Users/Administrator/AppData/Local/Programs/ai.opencode.desktop/` | Electron |
| 10 | MiniMax Code | 3.1.14 | `C:/MiniMax Code/` | Electron |
| 11 | 商汤小浣熊 | 1.2.3 | `C:/Apps/浣熊/` | Electron |
| 12 | CC Switch | 4.0.22 | `C:/IHUI-AI/.DevEnv/tools/CC Switch/` | 配置切换工具（随 IHUI-AI 工作区） |

旧报告只写了 1–5 且每条只给浅层证据；本轮 1–12 全部纳入，且每个都做前后端双层取证。CC Switch 是本地模型配置切换器（非 AI 客户端本体），作为环境相关程序登记但深度取证价值低，下文标注为“低优先级/配置类”。

## 1. 取证方法（deep 模式，双层）

执行过的 deep 工具族（每个目标按形态选用）：

- **前端层**：`core_target_open`（asar/解包目录）→ `js_app_map`（源模块、静态/动态 IPC、endpoint、route、native addon、storage、preload 暴露面、bundler）。大 bundle 受 `max_nodes` 上限截断时如实记 `node_cap`，不冒充全量。
- **核心层**：对主 exe / .node / helper 做 `core_feature_find --query <permission|credential|sandbox|execpolicy|token|ConPTY>`（字符串→函数→导入→使用代码）与 `native_strings_find`。
- **工作记忆**：brief / plan / hypothesis / finding / unknown 全部落在 craft 项目的 `investigation/`，每条 finding 必须引至少一条真实 `ev_` 证据。

边界：全程 `--deep` 静态读取，不运行目标；运行期协议、真实服务端响应、凭据语义、动态计算 IPC 通道的具体值均为未知，不推断填空。

## 2. 逐目标深度结论

### 2.1 Codex（Rust CLI + 原生 helper）——核心 deep

- 核心 `codex-command-runner.exe`（x86_64 PE）：`core_feature_find permission` 命中 `NetworkPermissions`、`LegacyPermissionProfile`、`CanonicalFileSystemPermissions`、`SerializedManagedFileSystemPermissions`、`TaggedPermissionProfile`、`permission_profile`、`resolve permission profile token mode`，并定位到 14+ 个使用函数（`sub_14006ee70`、`sub_140079e20`、`sub_14007a0b0` 等）（`ev_9ead3158...`）。
- `core_feature_find sandbox`：`windows-sandbox-rs\src\process.rs`、`RawFileSystemSandboxEntry`、`Local\CodexSandboxReadAcl`、`FileSystemSandboxEntry`（`ev_63008419...`）；`execpolicy`：`execpolicy/src/parser.rs`、`rule.rs`、`executable_name.rs`、`POLICY_BUILTINS_STATICS`（`ev_1b2fb81d...`）。
- `core_feature_find token`：15 函数 / 41 字符串 / 5 导入，导入含 `AdjustTokenPrivileges`、`CreateRestrictedToken`、`GetTokenInformation`、`OpenProcessToken`、`SetTokenInformation`（`ev_8e09417a...`）；`ConPTY`：`spawned ConPTY is missing its process job`（`ev_ee9854e5a...`）。
- `approval` 关键词零命中——不能据此断言 Codex 无审批，只能说该字面未出现在已检索面（unknown）。

结论（derived）：Codex 命令安全是 **execpolicy 策略解析 → permission profile（含网络/文件系统权限 profile）→ 受限 token + sandbox ACL → ConPTY 启动 → 失败如实报错** 的完整链，不是单一开关。`approval` 语义待运行期或更深反编译确认。

### 2.6 Cursor 3.27.22——前端 deep

- 前端 `resources/app`（js_app_map `ev_0824be18...`）：**828 源模块**（examined 500/828 partial）、**33 静态 IPC 通道（12 配对）**、**507 route / 3686 endpoint 明细 / 54 storage / 34 native addon / 13 窗口 / 21 contextBridge 暴露键**、**45 处运行时计算通道名**；386248 图节点在 50000 cap 被丢弃（node_cap 如实标注）。
- 核心原生：`file_service.win32-x64-msvc.node` 含 permission（EnvironmentPermission/PermissionDenied，11 串/6 函数）、encrypt（43 串/21 函数）、credential（git_credential_*，24 串）（`ev_fcaeabec...`）；`node-pty/pty.node` 暴露 startProcess/resize/kill/getProcessList（WinPTY，15 导入）（`ev_a9d0fd70...`）；`msal-node-runtime.node` 含 token 相关 12 串（`ev_0f1e5b86...`）；`Cursor.exe` sandbox 命中 186 串/27 函数（IsSandboxedProcess/GetSandboxMode/ELECTRON_DISABLE_SANDBOX）（`ev_3abe95e2...`）。
- 能力面集中在 `out/main.js` 与 `resources/app/extensions/*`，IPC 通道覆盖配置编辑、补全、agent 面板等 VS Code 系扩展体系。
- 结论（observed）：Cursor 是基于 VS Code 扩展体系的重前端 + _extension host_ 架构，45 动态 IPC + 图 cap 截断说明静态面只是可见子集，不冒充全量。

### 2.8 DeepSeek Harness 0.2.2-rc.5——前端 + 核心 deep

- 前端：`js_app_map` app.asar → Electron，`ev_7c39aeba...`：**17 源模块 / 5 窗口 / 17 endpoint / 1 route / 10 native module / 11 exposed / 230 effect**；静态 IPC=0，但 **142 处 IPC 通道名为运行时计算**（`dynamic_ipc_channels`）——静态 0 绝不等于无 IPC。coverage examined 646/21722（partial，如实标注）。
- 核心 `DeepSeek Harness.exe`：`permission` 命中 7 函数 / 200 字符串，含 `setPermissionRequestHandler`、`setPermissionCheckHandler`、`setDevicePermissionHandler`（三态权限处理）、`Permission denied`（`ev_b6e2c287...`）；`credential`：`allowNTLMCredentialsForDomains`、`credentialId`（`ev_31c72a35a...`）；`sandbox` 31 函数：`enable-sandbox`、`ELECTRON_DISABLE_SANDBOX`、`app.enableSandbox() can only be called before app is ready`（`ev_80bca346...`）。

结论（observed）：DeepSeek Harness 把 Electron 三类权限处理器（request/check/device）与 sandbox 启用时机都编进主进程；142 动态 IPC 通道是取证盲区，需运行期同意后另测。

### 2.9 OpenCode 2.2.7——前端 + 核心 deep

- 前端：`js_app_map` app.asar → Electron/vite，`ev_cde451b0770...`：**3231 源模块 / 3 窗口 / 289 endpoint / 1 route / 25 storage / 2 native module / 271 effect**；3 IPC（1 配对），5 处动态 IPC；2574 source map。coverage examined 500/3231（partial，node cap）。
- 核心 `opencode-cli.exe`：`permission`：`PermissionDenied`、TCC runtime library、`operation not permitted`（`ev_ef642a04e...`）；`credential`：`INVALID_DELEGATED_CREDENTIAL`、`AWS4-HMAC-SHA256 Credential=`、`X-Amz-Credential=`（`ev_a7b666faf...`）；`sandbox`：`CODEX_SANDBOX`、`iframe-missing-sandbox`、`allowfullscreen...`（`ev_d640ceb4...`）。

结论（observed）：OpenCode 的 CLI 核心带 TCC（macOS 隐私）兼容与 delegated credential 校验；沙箱同时有进程级（`CODEX_SANDBOX`）和 Web 层（iframe sandbox）两面。

### 2.11 商汤小浣熊 1.2.3——前端 + 核心 deep

- 前端：`js_app_map` app.asar → Electron（esbuild/tsc/webpack 三 bundler），`ev_eb9b7305b55...`：**1886 源模块 / 10 窗口 / 1819 endpoint / 22 route / 95 IPC（19 配对）/ 228 storage / 20 exposed / 10 native module / 4184 effect**；26 处动态 IPC；node cap 丢弃 92993 节点（如实标注）。这在本轮所有目标里 IPC/endpoint/route 面最宽。
- 核心 `box-agent-acp.exe`（ACP runtime host）：`permission` 仅命中 1 字符串 `Permission denied`，credential/sandbox 零命中（`ev_35624240...`/`ev_34713ff5...`/`ev_96d38538...`）——该 helper 更像协议桥，权限逻辑在上层。

结论（observed）：小浣熊把能力面铺得极宽（1819 endpoint/95 IPC），但原生 ACP host 很薄；借鉴点是“宽能力面 + 薄协议 host”的分层，不照抄数量。

### 2.2 Trae CN 3.4.20——前端 + 核心 deep

- 前端（VS Code 系 unpacked，`ev_79299405...`）：**343 源模块 / 1359 文件（coverage 1359/7384 partial）/ 5926 bundle 模块 / 44774 函数**；**71 静态 IPC（2 配对）/ 20 窗口 / 289 endpoint（明细 3871）/ 109 route / 11 API 操作**；55 native addon（skia 全平台、vscode-sqlite3、vscode-policy-watcher、trae-network-node、koffi、msal-node-runtime、win32-app-container-tokens）；storage 347 处（localStorage 267 / sessionStorage 118 / indexedDB 10）；IPC 含 `icube-floating-chat:*` 30+ 通道、`vscode:createPtyHostMessageChannelResult`、`vscode:iCubeGetNetworkDataResponse`。
- 核心 `trae-sandbox.exe`（`ev_e9b2ba3d...` 等）：sandbox 命中 **117 串/27 函数**、permission 18 串/9 函数、credential 0 串；含 `SBoxSDK_CreateSandbox`、`SandboxConfigPermissionObjectWireRef`、`TRAE_SANDBOX_CLI_PATH/LOG_DIR/TRACE_FILE/STORAGE_PATH`、`readonly/inherit` 路径权限、沙箱外进程白名单（seccomp/hook/inject 零命中，仅数据段搜索不等于不存在）。
- 结论（observed）：Trae 把终端沙箱做成可配置、可追踪、路径权限声明化的原生执行器，前端用大量 `icube-*` 通道承载浮动聊天。

### 2.3 WorkBuddy 5.11.3——前端 + 核心 deep

- 前端 `app.asar`（172,939,770 B，sha256 42e3c7cf…，`ev_d610bc77...`）：**3866 源模块 / 4253 文件 / 6949 bundle 模块 / 40909 函数**；**120 静态 IPC（55 配对）/ 20 窗口 / endpoint 明细 3488（1895 唯一 URL，summary 口径 878）/ 54 route / 83 contextBridge 暴露 / 100 native module / 571 storage**；IPC 含 `__bootstrap`、`workbuddy:*` 53 条、`app:consumePendingOpenUrls`；native 含 `os-bridge.*.node` 多平台矩阵、`brokered-sandbox-native.node`、`koffi.node`、`job-object.node`、`conpty.node`；storage 含 `safeStorage.isEncryptionAvailable` 2 处。
- 核心 `sandbox-cli.exe`（2,431,768 B，sha256 3cbcbe44…，`ev_7cdf9c60...`）：Rust（`sandbox/src/bin/sandbox_cli.rs`、`sandbox-core`）；sandbox 命中 **124 串/113 函数未截断**；session 81 串/18 函数（`OpenSessionRequest`、`QuerySessionMetricsResponse with 8 elements`、`PC_TRACE_SESSION`）；会话路径族 `SandboxPaths.session(<id>).{session_dir,app_home_session_dir,fs_dir,snapfile_dir,permission_file}`；permission 5 串/2 函数含 `permission.json`/`PermissionDenied`（`ev_c40d5dff...`）。
- 结论（observed）：WorkBuddy 是“session 隔离沙箱 + 声明式 permission.json + 原生 broker（os-bridge）”三层架构；214 处动态命名 IPC + 379403 节点 cap 丢弃是取证盲区。

### 2.4 Qoder CN 0.5.14——前端 + 核心 deep

- 前端 `app.asar`（174,403,011 B，sha256 fe7b81ea…，`ev_54ead231...`）：**610 源模块 / 47979 函数**；**静态 IPC 0（8 处动态命名）/ 10 窗口 / endpoint 明细 192（105 唯一 URL，summary 49）/ 156 route（全 router-config）/ 6 唯一 native .node（sharp/skia/aoq_node_ext/conpty/conpty_console_list/pty）/ 79 storage**；BuildWindow 硬化 `contextIsolation=true,nodeIntegration=false,sandbox=true,webSecurity=true,allowRunningInsecureContent=false`；Electron 43.8.4。
- 核心：`keytar.node` 凭据插件，`credential` 命中 `findCredentials`/`Error generating credential filter`（2 串/2 函数，`ev_8aa1a9e5...`），导出仅 `_register_keytar_`（`ev_9e91e707...`）；`aoq_node_ext.node` N-API 导出 `napi_register_module_v1`/`node_api_module_get_api_version_v1`（`ev_63496ee0...`）。
- 结论（observed）：Qoder 是“高度压缩 + 动态 IPC + 安全默认固化 + 单一 keytar 凭据出口”；静态 IPC=0 是压缩与动态命名的结果，绝不等于运行时无 IPC（旧报告此处只标未知、未给数字，本轮给出 8 动态的确证）。

### 2.5 ZCode 3.19.1——前端 + 核心 deep

- 前端（`@zcode/desktop`，`ev_b67a7e41...`）：**2837 源模块 / 10 窗口 / 7 route / 377 endpoint（55 有效）/ 77 storage / 8 contextBridge 键 / 3 静态 IPC**；preload 暴露 `zcodePluginSandbox`（setExecutionActive/copyImage/disposeSandbox）、`zcode`（executePreinstalledToolsCommand/connectRemote）、`resourceManager`、`cuaPermissionPanel`；**423 处动态 IPC + 33002 节点 cap 丢弃**（静态图不完整）。
- 核心：keyring.win32-x64-msvc.node（Rust `keyring-core-1.0.1`/`windows-native-keyring-store-1.1.0`）导出 findCredentials/deleteCredential，凭据交 Windows 凭据库（`ev_fce9848e...`）；`zcode-runtime-host.exe`（179,608 B）是 Windows 作业/进程控制宿主，命中完整 Job 对象生命周期 `CreateJobObjectW/OpenJobObjectW/TerminateJobObject/SetInformationJobObject`（`ev_6cc9652d...`）。

### 2.10 MiniMax Code 3.1.14——前端 + 核心 deep

- 前端（`@mmx-agent/electron`，`ev_ef51bb97...`）：**1391 源模块 / 10 窗口 / 54 静态 IPC（25 配对）/ 1887 endpoint（summary 107）/ 453 route / 298 storage**；IPC 含 `cu:permission:request/status/required/openSettings/guide`、`cu:preview:desktopPermission`、`miniapp:agent-*`、`browser-webview:*`；本地 HTTP API `/minimax-desktop/api/v1/agent/:name/permission/:request_id/reply`；native addon 31 个（pty/conpty/cua_driver_node_runtime/better_sqlite3/keyring.darwin-arm64）；`safeStorage.encryptString/decryptString` 各 1。
- 核心：node-pty pty.node（WinPTY 15 导入）；`cua_driver_node_runtime.node` permission 仅 2 条 Rust 标准错误串；主 exe sandbox 186 串/27 函数（V8 Sandbox + Electron enableSandbox）。
- 结论（observed）：MiniMax 把权限做成完整 IPC 协议族（request→status→reply），这是 IHUI-AI CLI danger-gate 可借鉴的“权限请求可查询、可回复”范式。

### 2.7 豆包 2.32.6——前端 + 核心 deep

- 前端（`ev_9eb3029096...`）：**不是 Electron，而是 CEF 内嵌 Web 应用**（app_kind=web，输入 local_webcontents 目录）——这是本轮唯一非 Electron 目标，旧报告把它与其它程序混为一谈是错的。**2295 源模块 / 85 route / 945 有效 endpoint（raw 4552）/ 669 storage / 2226 source map / 115 vendor / 5971 effect**；IPC=0、BrowserWindow=0、contextBridge=0、native addon=0（原生桥接不在该静态图视野内）；bundler=browserify/tsc/webpack。
- 入口 `apps/doubao-office`、`entry-main`、`entry-moa`、`entry-audio-recorder`，扩展页 `ai-views/rpa-component-extension`；route 代表 `/api/rce/heartbeat`、`/api/room/watch/unwatch`、`/chat/drive/folder/`、`/docx/`、`/slides/`、`/sheets/`、`/wiki/`、`/base/`；endpoint 分布 literal 3607 / fetch 816 / beacon 37 / websocket 30 / xhr 11，外联 `https://vcs.zijieapi.com`。
- storage（浏览器 Web Storage 为主）：localStorage get 200/set 144/remove 104，sessionStorage get 53/set 46/remove 32，indexedDB.open 31；代表键 `s_v_web_id`、`aha-api-app-config`。局限：50000 节点上限丢弃 **618509 节点**，静态图严重不完整；CEF 原生桥只能从原生 exe/dll 侧取证（本轮未深入，登记未知）。
- 结论（observed）：豆包是“CEF 壳 + 重 Web 应用 + 原生桥接在视野外”的形态，与 Electron 目标不可直接类比；本机 native 桥深度取证留作后续。

### 2.12 CC Switch 4.0.22——配置类（低优先级）

本地模型配置切换器（位于 IHUI-AI 工作区 `.DevEnv/tools/`），非 AI 客户端本体，属环境相关程序，登记但不做深度取证。

## 3. 跨目标模式（inferred，12 目标齐全后定稿）

1. **前端能力收敛到受控面**：Electron 目标普遍用 contextBridge 白名单 + 分域 preload（MiniMax 4 preload/6 bridge 键、WorkBuddy 83 exposed、ZCode 8 键），窗口静态确认 `contextIsolation=true,nodeIntegration=false,sandbox=true`（Qoder/MiniMax/ZCode）。豆包（CEF）没有 IPC/BrowserWindow 概念，是另一类形态。
2. **权限是链不是布尔**：Codex 多 permission profile + 受限 token；DeepSeek/MiniMax 三态 permission handler + 可查询/可回复协议；Trae 路径级 readonly/inherit + 沙箱外白名单；WorkBuddy session permission.json；ZCode/Cursor 凭据交 OS keyring 而非明文。没有一个是“一个 allow 布尔”。
3. **重型能力下沉原生 helper**：trae-sandbox.exe / sandbox-cli.exe / zcode-runtime-host.exe（Job 控制）/ file_service & pty & keyring .node / DeepSeek/OpenCode 主 exe 内的 Electron sandbox——前端只发请求，执行/隔离在 native 层。
4. **静态取证的系统性盲区**：所有目标都有大量运行时计算 IPC 通道（Cursor 45、Trae 110、WorkBuddy 214、MiniMax 816、ZCode 423、DeepSeek 142、Qoder 8、小浣熊 26）与图节点 cap 丢弃（最高豆包 618509）。**“静态 IPC=0”绝不等于“无 IPC”**；这些一律登记未知，不下结论。
5. **凭据一律不落明文**：ZCode keyring（Windows Credential Manager）、Qoder keytar、Cursor file_service 加密 + msal token、MiniMax/WorkBuddy `safeStorage` ——与 IHUI-AI 现有 DPAPI/机器绑定信封方向一致。

## 4. 映射回 IHUI-AI：强化清单（据本轮真实证据）

> 以下只列“竞品真实做到、且 IHUI-AI 可借鉴”的**能力面**；“已落地”指此前 `e0a23e03` 已交付的代码，不把本报告冒充代码改动。

| 优先级 | 竞品实证能力 | IHUI-AI 现状 / 动作 | 证据 |
|---|---|---|---|
| P0 | MiniMax `cu:permission:request/status` + REST `permission/:request_id/reply` + questionnaire reply/dismiss 的**可查询、可异步答复审批闭环** | 现有 danger-gate 是同步 fail-closed 三态；缺“请求态可查询 + 显式答复”协议。建议把统一审批决策契约（`approval-decision.ts`）接到一个可查询决策面 | `ev_ef51bb97...` |
| P0 | WorkBuddy `sandbox-cli` session 目录 + `permission.json` + trace；Trae trace event + recycle audit | 已交付 `session_audit.py`（9 pytest 绿），但按 fail-closed 设计未接执行链（无写入方会全拒）。建议为高风险执行路径显式写 permission.json 后再启用，补上闭环 | `ev_7cdf9c60...`、`ev_e9b2ba3d...` |
| P1 | ZCode/Cursor/DeepSeek 把凭据交 OS keyring / `safeStorage`，且不落明文 | 已交付 `keyring-capability.ts`（13 测试绿）作只读探测；现有 DPAPI 信封已满足“不落明文”。可把探测接进诊断输出，帮助不可用降级时给出定向说明 | `ev_fce9848e...`、`ev_fcaeabec...`、`ev_b6e2c287...` |
| P1 | Qoder 硬化窗口 `contextIsolation/sandbox/webSecurity=true`；MiniMax 多 preload 分域最小权限 | Web/桌面端沿用同一方向；新增 bridge 时按“按窗口类型最小暴露面”设计并加静态反向测试 | `ev_54ead231...`、`ev_ef51bb97...` |
| P2 | MiniMax 把 agent/审批/问卷/模型/后台任务统一成 `/api/v1/*` 本地 REST 总线，渲染与主进程解耦 | 评估 IHUI-AI 本地 API 是否可收敛同类能力，减少 IPC 通道数（也降低动态通道盲区） | `ev_ef51bb97...` |
| P2 | 动态 IPC 通道是系统性盲区 | 为 IHUI-AI 自己建立“运行时通道白名单审计”：把运行时计算通道名在测试期采集并与静态清单对账，避免静态守门假绿 | 全目标 limitation |

本节是能力面清单；是否落代码、何时落由用户拍板，不把“写了建议”冒充“已经实现”。

## 5. 可复核命令（摘录）

```bash
craft-anything-cli --project .workbuddy/craft/all-ai-apps-full-2026-11-25.cany --deep js_app_map --input-path "C:/Apps/DeepSeekHarness/resources/app.asar" --max-files 20000 --max-total-bytes 1073741824 --max-nodes 50000
craft-anything-cli --project .workbuddy/craft/all-ai-apps-full-2026-11-25.cany --deep core_feature_find "C:/Users/Administrator/AppData/Local/OpenAI/Codex/bin/31fb36cfc4b38f05/codex-command-runner.exe" --query permission
craft-anything-cli --project .workbuddy/craft/all-ai-apps-full-2026-11-25.cany --deep core_feature_find "C:/Apps/DeepSeekHarness/DeepSeek Harness.exe" --query sandbox
craft-anything-cli --project .workbuddy/craft/all-ai-apps-full-2026-11-25.cany --deep core_investigation_show
```

## 6. 收口判定

- 本机 12 个 AI 程序全部纳入，每个都有安装定位 + 前端 deep 或形态判定 + 核心 deep（配置类 CC Switch 除外，已标注低优先级）；5 路取证（4 路并行 agent + 主会话）共落 60+ 条 `ev_` 证据、20+ 条 finding。
- 旧报告 `local-five-deep-2026-11-24.md` 被**完全推翻**：仅 5 目标、深度不足、且把豆包等形态混为一谈；本报告是其替代，旧报告仅作历史留档，不再作为结论来源。
- 实测纠正的具体错误：WorkBuddy 源模块 4416→**3866**、endpoint 1076→**3488 明细/1895 唯一**；ZCode endpoint 55→**377（55 有效）**、IPC 3→**3 静态+423 动态**；豆包 Electron→**CEF Web 应用**；Trae endpoint 289（summary）/3871（stats）口径分离。
- 动态运行、凭据语义、动态 IPC 具体通道值、CEF 原生桥均诚实标未知，不用推断填空；“未命中”只在已搜索范围内成立。
- 第 4 节强化清单是能力面建议，此前 `e0a23e03` 的五项代码落地仍有效；本轮不把建议冒充已实现。
