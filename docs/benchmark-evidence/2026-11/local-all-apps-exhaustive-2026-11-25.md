<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 本地 11 款 AI 客户端全量逆向取证（前端 + 核心 + 后端）

- 日期：2026-11-25
- 范围：本机已安装的 11 个 AI 客户端 / CLI（Codex、Trae CN、WorkBuddy、Qoder CN、ZCode、Cursor、豆包、DeepSeek Harness、OpenCode、MiniMax Code、商汤小浣熊）
- 方法：craft-anything 0.5.0 静态取证（未主动运行任何程序本体、未读取任何用户凭据；运行态只做既有进程/端口/管道快照）
- 结论性质：静态观察 + 派生结论；动态行为以 5.6 的一次运行态快照标注，其余一律“未运行、未知”

**一页结论**

1. **真正有产品级沙箱的只有 6 个**：Codex（受限令牌 + Job + WFP）、Trae（aiep sbox SDK）、WorkBuddy（session 权限文件 + 审批中心）、豆包（agent_infra 运行时策略 + aiep sbox）、Cursor（Rust `SandboxPolicy`）、MiniMax（Rust `srt-win`）。Qoder、DeepSeek、OpenCode 的桌面包内没有产品级原生沙箱证据，标未知。
2. **字节系共用一套沙箱 SDK**：Trae 的 `modules\sandbox\` 与豆包的 `app\sbox\` 文件名同构（`aiep_sbox.dll`、`aiep_ipc.dll`、`run_helper.exe`、`sbox_sdk.dll`），只是构建大小不同（2,320KB vs 2,594KB）。
3. **原有 14 张 jsmap 均未触发 1,500,000 节点上限**：11 个目标、Qoder 四版本各一张；最大豆包 ai-views 465,369 节点 / 1,473,627 边，Cursor 319,057 / 681,140，WorkBuddy 359,769 / 729,926。**新增的豆包 `biz.pak` 图是第 15 张，单图撞到 1,000,000 硬上限（需求 1,615,501，丢 615,501）**；已按顶层目录拆成 `ahalets` / `static` / `rest` 三片重跑，合计 **1,471,311 节点 / 4,072,587 边 / 1,274,239 函数 / 9,562 模块**，**166,986 bundle 模块与单图完全相等**，余差 144,190 节点来自 235 个单图额外计入的模块（资产/非 JS 口径）与跨片边缺失，不是再次截断。Codex `app.asar` 是第 16 张，444,320 节点 / 1,253,774 边，未触发上限。
4. **核心层覆盖 26 个实际存在的二进制 + 1 个 `not_found` 记录**：导入/导出/签名/字符串/函数/特征六类证据；Codex 407MB 超单文件工具上限 256MB，craft 原生 Rust 报告仍缺，但已用字节级正则补出 400 个 crate 与 rustc commit；Codex 另有第五个常驻二进制 `codex-windows-sandbox-service.exe`（62,953,264，运行中，且是 `LocalSystem` 自启动 packaged 服务 `CodexSandboxService.OpenAI.Codex`），标准 PE 解析得到 24 个 DLL / 415 个导入函数，运行态存在 `OpenAI.CodexSandbox...` 与 `codex-app-tools-...` 两条命名管道，见纠正十七至十九。
5. **最能落进 IHUI-AI 的六件事**：统一权限决策对象、Windows Job Object 执行器、审批反向通道、preload 暴露面预算、动态通道注册表、运行时策略热更新（详见第 6 节）。
6. **前端 `partial` 已逐目标审计**：15 个图/分片只数非 `node_modules` 的 JS/TS，再与 `examined` 比，**0 个应用 JS 漏读目标**；`partial` 的 `total` 主要是 node_modules、CSS、HTML、SVG、JSON 资产（详见 3.1 与 `analysis\frontend-coverage-audit.json`）。

---

## 0. 为什么要推翻上一版

上一版 `local-all-apps-deep-2026-11-25.md` 的问题不是“目标少”，而是**口径错**和**覆盖截断**。这一版做了二十处纠正，每一条都能被证据账本复核。

**纠正一：把 Electron 主 exe 的 Chromium 安全 API 当成产品自研沙箱。**
上一版用 `CreateRestrictedToken`、`CreateJobObject`、`CreateProcessAsUserW` 这类导入来证明“某产品有强沙箱”。实测发现，WorkBuddy.exe、Qoder CN.exe、ZCode.exe、Cursor.exe、Trae CN.exe 全部是 Electron 壳，这些 API 属于 Chromium/Electron 出厂能力，**不能归因于产品**。本版把证据分成三层：产品级（Rust/Go helper、.node、主进程 JS）、框架级（Electron/Chromium）、未知级；只有第一层进入结论。

**纠正二：前端图被 cap 截断却写成“全量”。**
上一版 Cursor 只 examined 500/828、WorkBuddy 3866 模块但节点被截、豆包 618509 节点被丢弃。本版把 `max-nodes` 提到 1,500,000，实测：WorkBuddy 359,769 节点 / 729,926 边、Cursor 319,057 节点 / 681,140 边、豆包 ai-views 465,369 节点 / 1,473,627 边、Trae 194,266 节点，均未触发节点上限；**豆包 `biz.pak` 是第 15 张图，单图另撞 1,000,000 硬上限丢 615,501 节点，已拆成 `ahalets` / `static` / `rest` 三片重跑，合计 1,471,311 节点，不再有 1M 截断**。所以“豆包前端”必须分成 ai-views、biz.pak 主图（三片）来读，不能再用一张单图当全量。

**纠正三：Qoder 版本写错。**
上一版写 Qoder 0.5.14，但 `C:\Qoder CN\Qoder CN.exe` 实际是 0.5.6；`.qoder-versions\0.5.14\` 才是新版本（build-manifest 2026-11-17、Electron 43.8.4）。本版两个版本都取证，明确标注差异。

**纠正四：Codex 的 ConPTY 只写了一句。**
本版拿到函数级链路：`resolve permission profile token mode`、`TaggedPermissionProfile::{Managed,External}`、`struct NetworkPermissions with 1 element`、`SerializedManagedFileSystemPermissions::Restricted`、`spawned ConPTY is missing its process job`、`Codex Windows Sandbox WFP` 持久化 WFP provider。

**纠正五：没有后端层。**
本版新增“后端/服务层”：WorkBuddy 的 MCP Host（loopback 随机端口）+ A2A 出站代理、MiniMax 的 `http://127.0.0.1/minimax-desktop/api/v1/*` 本地运行时、ZCode 的 host RPC + Windows Job 控制、OpenCode 的 `opencode-cli serve --service`（isolated 3084，4096 仅为 Add Server 占位；已实跑 v2.2.7，Web UI 200、API 无凭据 401）、Qoder 的 `@qoder-space/application-server` + `peer-transport`、豆包的 Agent Tool 命名管道 + app proxy WebSocket + PIP 三族命名管道（详见纠正十三）。

**纠正六：把“枚举常量引用”误判成“运行期拼接”。**
工具把“首参不是字符串字面量”一律记为 dynamic，导致 DeepSeek 142 条、MiniMax 816 条被写成“运行期拼接、不可还原”。逐文件还原后：DeepSeek 源码只有 **116 个** `ipcMain/ipcRenderer` 调用点，其中 **102 条业务调用**（43 主进程 + 59 preload/renderer）落到 **54 个唯一常量通道**（`DESKTOP_IPC` 34 + `PLATFORM_IPC` 5 + `WELCOME_IPC` 9 + `MANDATORY_IPC` 3 + `UPDATE_DIALOG_IPC` 3），另有 14 条 `removeHandler/off` 解绑清理；142 与 102 的差额是 **40 条工具侧重复条目**，与 40 个 `ipcRenderer.invoke` 数量一致，源码里不存在第 103–142 个独立调用点。MiniMax 的 6 条主进程变量 + 8 条 renderer 变量也已全部回填：主进程 **332 条**、renderer **406 条**，源码共 **804 个调用点、0 条未定**；816 与 804 的 12 条差额是工具侧重复条目。ZCode 与 WorkBuddy 已在本轮闭环：ZCode 本地 227 个调用点全部还原为 180 个通道、0 条未定；WorkBuddy main 侧 115 条注册全部归因，12 个 `require_*` 别名全回填。

**纠正七：Trae 的旧动态 IPC 证据文件是坏样本。**
`analysis\dynamic-ipc-traecn.json` 只扫了 47 个文件、把 `__is_disposable_tracked__` 当成 IPC 通道，示例位置还是 `.:36`，与 Trae `resources\app` 的 8,094 个文件规模完全不符。本版重建为 `analysis\traecn-ipc-final.json`：在真实 app 树里扫到 **73 个 `ipcMain/ipcRenderer` 调用 + 62 个 `webContents.send/postMessage`**，共 58 条非字面量表达式；其中 **56 条落到 30 个唯一通道**，2 条是 `IpcMainWrapper` 形参/`responseChannel` 一类非通道值，**0 条未定**。旧文件里的“4 主进程 + 27 renderer”结论作废。

**纠正八：Cursor 的 45 条动态 IPC 不是“不可审计面”。**
工具只给了一个数字，本版按 777 个非 `node_modules` JS 文件重扫：44 个 Electron IPC 调用点（15 `ipcMain` + 17 `ipcRenderer` + 11 `webContents.send` + 1 `webContents.postMessage`），其中 43 条非字面量。29 条落到 20 个唯一通道，12 条是 wrapper/helper 形参，1 条 `event.data` 被 4 个常量守卫，1 条 `e.responseChannel` 是运行期 payload 通道，**0 个未知通道常量**。45 与 43 的 2 条差额落在 `ms-vscode.js-debug` 里非 Electron 的 WebSocket `.send` 泛化匹配。

**纠正九：Qoder 的 8 条动态 IPC 已全部解码，不是“未知面”。**
Qoder 的字符串表是自定义 base64 + 数组旋转，直接用常规 base64 会解出乱码。按产品自己的 `pe0`/`du` 表和校验函数还原旋转偏移（0.5.6=`283`、0.5.14=`200`）后：0.5.6 的 5 条是 `diagnostics:renderer-responsiveness` + `arms:rum-bridge` / `arms:rum-custom-report` / `arms:rum-anr-heartbeat` / `arms:rum-anr-visibility`；0.5.14 的 8 条是同一组 5 条加 `mcp-app:guest-message` 的 3 条 guest preload 调用；0.5.7 / 0.5.12 为 0。**13 条动态、6 个唯一通道、0 条未定。**

**纠正十：OpenCode 的 5 条动态 IPC 全部是跨文件配对，不是新通道。**
主进程 `desktop-BIxuCyvr.js` 的 `webContents.send(vi)` / `postMessage(Vr)` 对应 `opencode:drag-cancel` / `desktop-rpc-port`；preload 第 1 行写明 `t="desktop-rpc-port"`、`n="opencode:drag-cancel"`、`r="desktop-window-snapshot"`。5 条动态落到 **3 个唯一通道**，且 3 个都已在静态表里，**0 个未知通道**。

**纠正十一：小浣熊的 26 条动态不是 26 个未知通道。**
源码里是 34 个非字面量调用点：16 个落到 11 个固定通道，3 个模板记录形成 2 个族（feedback 三成员、browser-overlay 按 owner），1 个 `VOICE_INPUT_CHANNELS` 清理循环覆盖 7 条 `voice-input:*`，14 个是 helper/cleanup 形参。34 与 26 的 8 条差额是清理调用被工具排除，**0 个未知通道**。

**纠正十二：豆包不是 CEF，上一版“全量前端”只覆盖了 ai-views，漏掉 biz.pak 里 7,837 个 JS。**
`Doubao.dll` 导出 `ChromeMain`，安装清单是 Chromium `147.0.7727.149`；宿主是 Aha/Neotix，不是 CEF。上一版 jsmap 只读了 `local_webcontents` 的 2,311/3,442 个直接文件，得到 2,295 模块 / 465,369 节点 / 1,473,627 边，**恰好等于 `extensions\ai-views` 的 2,282 个 JS**，没有进入 `biz.pak`。本轮解包 `biz.pak` 196,549,135 字节、10,029 个资源（7,837 JS / 1,125 CSS / 369 HTML / 212 SVG / 15 JSON），单图重建 **9,797 模块 / 166,986 bundle 模块 / 881,872 函数 / 2,928,056 边 / 8,988 endpoint（1,231 唯一）/ 335 路由**；单图撞 1,000,000 节点硬上限，需求 1,615,501、丢 615,501。随后按顶层目录拆成 `ahalets`（5,907 模块 / 832,342 节点）、`static`（3,597 / 628,680）、`rest`（58 / 10,289）三片重跑，**合计 9,562 模块 / 1,471,311 节点 / 4,072,587 边 / 1,274,239 函数 / 8,973 endpoint / 335 路由**；**166,986 bundle 模块与单图完全相等**，节点比单图推算需求少 144,190，差在 235 个单图额外计入的模块（资产/非 JS 口径）和跨片不生成跨文件边，不是新的截断。工具在 pak 图上报的 2 条 IPC（`getScrollInfo` / `postMessageSync`）是 SDK/Lynx 方法名误匹配，不是原生通道。真正的原生面是 **Neotix ShellAPI 的 848 个 `neotix::<namespace>::<method>` 方法 / 98 个命名空间**。

**纠正十三：上一版把豆包后端只写成聊天 RPC，漏了 PIP 远程会话子系统。**
`pip_main.exe` 3,208,592 字节自带 `aha_pip\src\pip_ipc\named_pipe_ipc_server.cc` / `named_pipe_ipc_client.cc`、`PipMainPipeName_{}`、`PipSDKPipeName_{}`、`PipRemotePipeName_{}` 三条命名管道族，并用 `GetNamedPipeClientProcessId` 校验对端进程；同目录 `pip_remote.dll`、`connect_to_shadow_session_client.cc`、`shadow_session_credential_precheck.cc`、`shadow_session_guard.cc`、`rdp_host.cc`、`credential_guard.cc`、`key_stroke.cc` —— 按源码文件名，它不是普通 helper，而是远程/影子会话、键鼠注入、凭据保护一整套子系统。它和 Agent Tool 的 `\\.\pipe\aha-agent-tool-ipc-`、Neotix ShellAPI 是三条独立通道，不能只写一条。2026-11-25 15:26 的运行态快照里 `PipMainPipeName_43814` 与 `PipSDKPipeName_50414` 已存在，`PipRemotePipeName` 未出现；只证明 Main/SDK 两族在运行，不能证明远程会话已启用；对端进程与默认监听仍未验证。

**纠正十四：Qoder 的 `aoq` 不是“播放器 SDK”，是阿里云 RTC 引擎；随包携带但当前 app 代码 0 引用。**
`aoq-electron-sdk` 实际是 `optionalDependencies` 从 `registry.anpm.alibaba-inc.com` 拉的 `1.2.0-57793950`，包元数据 `repository=gitlab.alibaba-inc.com:NLS-RTC-Service/aoq-client-sdk.git`、`description=AoqClientSdk for Electron (NAPI addon + TypeScript API)`。`ts/IAoqClientEngine.ts` 有 **43 个引擎方法**（`createEngine`、`connect`、`startAudioCapture`、`startVideoCapture`、`enableAudioFrameObserver`、`enableVideoFrameObserver`、`sendDataMsg` 等），`ts/Types.ts` 的 `IAoqElectronBridge` 有 **45 个 NAPI 桥方法**；`AoqConnectConfig` 必填 `token` / `sid` / `relayEndpoints`，可带 `certFingerprint` / `workspaceIdHash`，发布/订阅 `audio` / `video` / `data` 三类 track。原生四件套是 `AoqClientSdk.dll` 14,688,776、`aoq_node_ext.node` 253,952、`PluginOpus.dll` 730,112、`alivcffmpeg.dll` 4,093,448；DLL 字符串含 `Ali_RTC`、`rtc_core` 424 处、`apsara-video-client`、`cloud-config-service.rtc.aliyuncs.com`、`vod.cn-hangzhou.aliyuncs.com`、`vpp-license-proxy.aliyuncs.com`，源码路径是 `aoq-client-sdk\rtc_core\...`，不是播放器壳。**四个版本都带这套原生文件**：0.5.6 / 0.5.7 / 0.5.12 / 0.5.14 的 `AoqClientSdk.dll` 分别为 14,688,776 / 14,688,768 / 14,688,768 / 14,688,776，四个 SHA256 各不相同。但对四个版本的 asar 内全部 JS/TS/JSON（4,374 / 4,374 / 4,286 / 4,286 个文件，排除 `node_modules/aoq-electron-sdk` 自身）扫描，`aoq-electron-sdk` / `AoqSdk` / `AoqClientEngine` / `aoq_node_ext` 合计只命中 **1 次，且就在根 `package.json` 的 `optionalDependencies` 声明里**，**0 个 app import/require，SDK 目录之外 0 个路径含 `aoq`**；`AoqClientEngineInternal.ts` 的 `const AoqNode = loadNative()` 是模块级，只有被 import 时才加载 `.node`。结论：它是**随包携带、当前静态不可达的 RTC 能力**，不是桌面 IPC 通道（通道增量 0），也不是“已启用的播放器”；若被未来代码路径 import，能力是麦克风/摄像头采集、音视频裸帧观察、Aliyun RTC relay（token/sid 鉴权）与 data channel。启用条件未知，不写成已使用。账本：`analysis\qoder-aoq-sdk.json`。

**纠正十五：`DoubaoLinkRouter.exe` 不是“疑似 URL 路由”，是 Aha/Saman 的协议链接路由器；上一版把 Chromium/perfetto 的 `http/ws/wss` 字符串误当成网络证据。**
`DoubaoLinkRouter.exe` 2,952,080 字节，ProductName `Doubao Link Router`、FileVersion `2.37.16.0`、公司 北京春田知韵科技有限公司，签名有效，SHA256 `26B8838C7A20377E165FD04CA87FCB6C639E604B601E639A254DC58B98489E1D`。源码路径是 `..\..\aha\saman\link_router\router_app\router_main_win.cc`、`router_app.cc`、`component\route_event_store.cc`；常量里有 `doubao:/`、`doubaoap`、`/open-ur` 前缀，注册表 `Software\Doubao` / `Software\DoubaoWork`，目标可执行 `Doubao.exe` / `DoubaoWork.exe`，选择字段 `preferred_client` 加 `doubao_installed` / `doubao_compatible` / `doubao_running` / `doubao_foreground` 与 `work_installed` / `work_compatible` / `work_running` / `work_foreground`，日志字段 `LinkRouter result=` / `target=` / `reason=` / `event_id_created=`。导入表只有 `SHELL32` / `USER32` / `ADVAPI32` / `dbghelp` / `KERNEL32` / `USERENV` / `WINMM` / `SHLWAPI` / `ole32` / WinRT，**没有 `WS2_32` / `WINHTTP` / `WININET`**；所以 `http/ws/wss`、`localhost`、`server` 是 Chromium/perfetto/gurl 资产串，不是它起服务。它是默认协议/链接分流器：按安装、兼容、运行、前台状态和 `preferred_client` 在豆包与豆包 Work 之间选目标并转发链接，**不新增桌面 IPC 通道**。协议注册与启用条件未运行验证。`push_detect.exe` 仍只按名：签名有效、只导入 `Microsoft.WindowsAppRuntime.Bootstrap.dll` + `KERNEL32` / `ole32` / `OLEAUT32`，无产品字符串，不升格为结论。账本：`analysis\doubao-link-router.json`。

**纠正十六：`Doubao_proxy.exe` / `Doubao_browser_proxy.exe` 不是 HTTP 代理，是 Chromium 的进程启动/浏览器入口代理。**
两者都是 FileVersion `147.0.7727.149`、Product `Doubao`、公司 北京春田知韵科技有限公司、签名有效，大小 2,280,336 / 2,409,872。字符串里有 `..\..\base\process\launch_win.cc`、`LaunchProcess`、`LaunchElevatedProcess`、`ShellExecuteExW`、`..\..\base\command_line.cc`，以及 `Chrome.MessageLoopProblem.MESSAGE_POST_ERROR` / `SET_TIMER_ERROR` / `RECEIVED_WM_QUIT_ERROR` / `COMPLETION_POST_ERROR`；`NetLog events...` 只是 Chromium 通用资产串，不是网络服务证据。两者的 PE 导入表解析结果为空（可能走延迟导入、静态链接或解析口径差异），所以不能像 `DoubaoLinkRouter` 那样用导入表做否定证据；但字符串里 `localhost` / `127.0.0.1` / `HttpServer` / `WebSocket` / `netsh` / `InternetSetOption` / `WinHttp` / `PAC` 全部 0 命中，另有 `..\..\base\process\launch_win.cc`、`LaunchProcess`、`LaunchElevatedProcess`、`ShellExecuteExW` 和 `Chrome.MessageLoopProblem.*`，指向“拉起浏览器进程/入口”的 proxy 目标，不像本地 HTTP/WS 代理。它们**不新增桌面 IPC 通道**；是否被默认浏览器/协议调用链实际使用未运行验证。账本：`analysis\doubao-proxy-launchers.json`。

**纠正十七：Codex 的 Windows 沙箱执行器不是 `sandbox-setup.exe`，而是 `codex-windows-sandbox-service.exe`（62,953,264，运行中）。**
`C:\Program Files\WindowsApps\OpenAI.Codex_26.1117.4957.0_x64__2p2nqsd0c76g0\app\resources\codex-windows-sandbox-service.exe` 62,953,264 字节，`OpenAI OpCo, LLC` 签名有效，无 FileVersion / ProductName / FileDescription 元数据，SHA256 `E66E49429469B95C5A2219DAE872938BD8D70FBE920F1F1086E8CBA5777C3569`；运行态 PID 33980。字符串里有 `windows-sandbox-rs\src\process.rs`、`wrapper.rs`、`setup_provisioning.rs`、`no_reparse_dir.rs`、`CreateJobObjectW`、`AssignProcessToJobObject`、`CreateRestrictedToken`、`WFP setup succeeded for `、`Persistent WFP provider for Codex Windows sandbox filters`、`WindowsSandboxService`、`WindowsSandboxModeToml`、`elevated` / `unelevated`、`network-proxy\src\credential_broker\matching.rs` / `providers.rs`。所以 `sandbox-setup.exe` 是安装/供给器，这个 62.9MB 的 service 才是常驻执行器：令牌、Job Object、WFP 过滤器、elevated/unelevated 模式、credential broker 都在它的字符串里。上一版“四个产品二进制”的清单漏了它，核心层应从 25 改为 26。craft 的 PE 导入表解析为 0 条；标准 PE 解析复核为 24 DLL / 415 函数（见纠正十九），所以 0 条是工具口径，不是“静态链接”结论。运行期行为只证明它在跑，未验证每次工具调用都经过它。账本：`native\codex\sandbox-service.json`。

**纠正十八：Codex 的沙箱服务不是普通子进程，是 `LocalSystem` 自启动的 packaged Windows 服务 `CodexSandboxService.OpenAI.Codex`（DisplayName `ChatGPT`）。**
`sc.exe qc` 显示 `TYPE: 210 WIN32_PACKAGED_PROCESS`、`START_TYPE: AUTO_START`、`SERVICE_START_NAME: LocalSystem`、`DEPENDENCIES: staterepository`、`DISPLAY_NAME: ChatGPT`，路径就是 `codex-windows-sandbox-service.exe`；父进程 PID 1264 是 `services.exe`，服务进程 PID 33980，状态 Running。`sc.exe sdshow` 的服务 DACL 是 `D:(A;;CCDCLCSWRPWPDTLOCRSDRCWDWO;;;SY)(A;;CCDCLCSWRPWPDTLOCRSDRCWDWO;;;BA)(A;;CCLCSWRPLORC;;;AU)S:(AU;FA;CCDCLCSWRPWPDTLOCRSDRCWDWO;;;WD)`：`SY` 与 `BA` 全控，`AU` 只有 `CCLCSWRPLORC`，即查询配置/状态、枚举依赖、**启动**、查询、读控制，没有停止、改配置、写 DAC。含义是它以 LocalSystem 运行，具备创建受限令牌、Job Object、WFP 过滤器的权限；普通已认证用户可启动但不能停止/改配置。服务签名有效，这不是漏洞结论，而是权限边界证据：后续审计应看它的 IPC/ACL 与调用方，不能只看二进制字符串。

**纠正十九：Codex 沙箱服务的 PE 导入表不是 0，而是 24 个 DLL / 415 个导入函数；同一 Codex 目标运行态还有 `OpenAI.CodexSandbox...` 与 `codex-app-tools-...` 两条命名管道。**
上一版 craft 的导入表解析为 0 条，被误当成“静态链接或解析口径”。用标准 PE 解析器重读，得到 24 DLL / 415 函数：`kernel32.dll` 183（含 `CreateJobObjectW`、`AssignProcessToJobObject`、`CreateNamedPipeW`、`ConnectNamedPipe`、`GetNamedPipeClientProcessId`、`ImpersonateNamedPipeClient`）、`advapi32.dll` 78（含 `CreateRestrictedToken`、`LogonUserW`、`ImpersonateNamedPipeClient`、`OpenSCManagerW`/`OpenServiceW`）、`ws2_32.dll` 37（完整 socket/select/WSAEventSelect 栈）、`fwpuclnt.dll` 11（WFP 过滤器/子层/事务）、`winhttp.dll` 4（`WinHttpOpen`、`WinHttpGetProxyForUrl`、`WinHttpGetIEProxyConfigForCurrentUser`）、`netapi32.dll` 8（`NetUserAdd`、`NetLocalGroupAddMembers`）、`userenv.dll` 4（`LoadUserProfileW`/`DeleteProfileW`）、`user32.dll` 3（`CreateDesktopW`）、`wtsapi32.dll` 4（`WTSQueryUserToken`）、`secur32.dll` 14（SSPI）。
字符串同时给出命名管道与网络策略：`\\.\pipe\OpenAI.CodexSandbox`、`\\.\pipe\codex-proxy-auth-`、`CodexSandboxOffline`/`CodexSandboxOnline`、`CodexSandboxUser`/`CodexSandboxUsers`、`CodexSandboxDesktop-`、`CodexSandboxReadAcl`、`SANDBOX_PROXY_PORTS`、`sandbox_offline_block_outbound`/`inbound`/`loopback_tcp`/`loopback_udp`、`sandbox_offline_allow_loopback_proxy`、`sandbox_users.json`。
运行态 `Get-ChildItem \\.\pipe\` 命中 `OpenAI.CodexSandbox.OpenAI.Codex_2p2nqsd0c76g0` 与 `codex-app-tools-ba97c01c-b1ce-4010-a6c8-46f38e6132c4`；前者与服务名空间匹配，后者更像 Codex app-server/tools 管道，归属未逐句柄验证。同一时刻 PID 33980 的 TCP/UDP 端点为 0。结论：命名管道 IPC 已实际存在；Winsock/WFP/代理是静态能力，不能据此写成“已在监听”。代理端口是否按会话拉起、管道协议与 ACL 仍未运行验证。

**纠正二十：Codex 不是“无前端 Rust CLI”，桌面壳是 `ChatGPT.exe`（Chromium 158 / Owl Electron）+ 443.8MB `app.asar`；上一版安装矩阵的“无前端”是错的。**
`app\ChatGPT.exe` 是 5,003,568 字节的 Chromium 壳（InternalName `chrome_exe`、OriginalFilename `chrome.exe`、FileVersion `158.0.8127.37`、FileDescription/Product `Codex`），旁边 `chrome.dll` 341,041,456；`resources\app.asar` 443,800,006，包名 `openai-codex-electron`、版本 `26.1117.41037`、`main=.vite/build/early-bootstrap.js`，Owl 运行时（`owl-electron-app.json` / `owl-app.ini`）。所以 Codex 是 **Electron 桌面壳 + Rust `codex.exe` app-server/CLI**，不是单一 Rust CLI。
`app.asar` 头：15,520 文件 / 454,135,151 字节，9,849 `.js` + 22 `.mjs` + 136 `.d.ts`；图：9,660 模块 / 444,320 节点 / 1,253,774 边 / 368,991 函数 / 36 IPC（3 配对、9 仅 handler、24 仅 invoker）/ 48 条运行期拼接（5.11 已逐条还原，0 未知）/ 6 窗口 / 4 暴露键（28 成员）/ 6,624 endpoint 记录（1,889 唯一 URL）/ 294 路由记录（133 唯一路径）/ 6 native 模块。应用 JS 9,656 个全部进图；215 个 node_modules JS 与 136 个 `.d.ts` 按 `--include-node-modules=false` 排除。上一版“无前端（Rust CLI/TUI）”和“前端图 15 张”都漏了这层。

---

## 1. 方法与口径

### 1.1 工具与参数

静态证据通过 `craft-anything-cli.exe 0.5.0` 产生，写入 case `all-ai-apps-full-2026-11-25.cany`；运行态进程/模块/端口指纹与 Codex 服务注册用 PowerShell / `sc.exe` 只读采集，账本同样落在 `out\deep\analysis` 与 `native\codex`。

前端：`js-app-map`，参数固定为
`--max-files 400000 --max-file-bytes 67108864 --max-total-bytes 4294967296 --max-nodes 1500000 --limit 50000`。

核心：`core-overview-show --detail summary`、`native-library-calls-list --limit 5000`、`native-offered-symbols-list --limit 5000`、`native-publisher-show`、`native-strings-find --mode regex --limit 5000`（8 组主题正则）、`core-feature-find`（permission / sandbox / credential / pty）、`native-rust-binary-show`、`native-go-binary-show`。

解包：`core-archive-extract --max-bytes 6000000000 --max-files 400000`，8 个 asar 全部解包成功（WorkBuddy 12,226 文件 / 721MB 等）；Codex `app.asar` 443.8MB 只做 header 解析与 `js-app-map` 图，未整包解压。

### 1.2 三条硬边界

1. **静态为主 + 只读运行态观察**：没有主动启动或驱动任何目标（OpenCode `serve` 实跑除外），没有触发业务 IPC、没有调用业务 API、没有读取凭据。5.6 / 5.7 是既有进程与模块快照；5.8 只对本地监听各发一次 `OPTIONS` / WebSocket Upgrade 指纹，不执行业务请求。所有未被这些观察覆盖的运行时行为仍写“未知”。
2. **可复核**：每条结论后跟 `ev_…` 证据号；证据 JSON 在 `C:\IHUI-AI\.workbuddy\craft\out\deep\` 下，按目标分目录。
3. **归因分层**：Electron/Chromium 自带字符串（primordials、blink::、v8::、node::、Copyright Joyent 等）全部剔除后再判断产品能力。

### 1.3 已知工具上限（必须写进结论）

- `core-overview-show` 的函数发现上限 50,000；字符串保留前 200,000 条；间接跳转未解析数会单列。
- 大文件（>256MB）的 `native-rust-binary-show` 会拒绝；Codex 407MB 因此没有 craft 原生 crate 报告，改用字节级 cargo 路径正则补出 400 个 crate（8,839 次命中）与 rustc commit，详见 4.1。
- `js-app-map` 的动态 IPC 计数不能直接当运行期拼接：DeepSeek 的 142 是工具计数，源码实际 116 个 ipc 调用点（102 业务 + 14 清理），102 条业务调用落到 54 个常量通道；MiniMax 6+8 条变量已回填为 332 主进程 + 406 renderer，源码 804 个调用点、0 条未定（816 与 804 的 12 条差额为工具重复条目）；WorkBuddy main 侧 115 条注册全部归因（12 个 `require_*` 别名全回填）；ZCode 本地 227 个调用点全部还原为 180 个唯一通道、0 条未定。
- `webPreferences: dynamic` 的窗口通常只能标未知；Codex 的 primary window 已通过 `getRendererPreferences` 回溯出字段，但仍缺 `sandbox` 声明，见 4.1。

---

## 2. 安装面矩阵（本轮实测）

| 程序 | 版本 | 主程序 | 主程序大小 | 前端载体 | 前端文件数 | native 模块 |
|---|---|---|---|---|---|---|
| Codex | package 26.1117.41037 / Chromium 158.0.8127.37 | `app\ChatGPT.exe` + `resources\codex.exe` | 5,003,568 / 407,428,400 | `resources\app.asar` 443.8MB（Owl Electron；`webview` + `.vite`） | 15,520 列出；9,660 模块 | 6 |
| Trae CN | product 1.107.1 / exe 2.3.103559 | `Trae CN.exe` | 214,715,792 | `resources\app\` | 8,094 | 0（另有 sandbox SDK） |
| WorkBuddy | 5.11.3 | `WorkBuddy.exe` | 204,590,360 | `resources\app.asar` 172.9MB | 12,226（解包） | 83 |
| Qoder CN | 0.5.6 / 0.5.7 / 0.5.12 / 0.5.14 四版本 | `Qoder CN.exe` | 239,205,896 | 200.6MB / 200.6MB / 174.4MB / 174.4MB（四个 asar） | 5,121 列出 | 24 |
| ZCode | 3.19.1.10833 | `ZCode.exe` | 246,332,312 | `resources\app.asar` 385.2MB | 30,957 列出 | 17 |
| Cursor | 3.27.22 | `Cursor.exe` | 235,483,944 | `resources\app\` | 21,000 | 34 |
| 豆包 | Launcher 2.0.32 | `Doubao.dll`（Chromium 147 宿主） | 335,086,992 | `app\local_webcontents\` | 3,443 | 0（另有 sbox/mcp_helper） |
| DeepSeek Harness | 0.2.2-rc.5 | `DeepSeek Harness.exe` | 246,341,104 | `resources\app.asar` 209.1MB | 20,300 列出 | 26 |
| OpenCode | 2.2.7 | `OpenCode.exe` | 246,614,920 | `resources\app.asar` 240.9MB | 11,618 列出 | 4 |
| MiniMax Code | 3.1.14.220 | `MiniMax Code.exe` | 235,418,560 | `resources\app.asar` 371.9MB | 24,995 列出 | 19 |
| 商汤小浣熊 | 1.2.3 | `商汤小浣熊.exe` | 222,902,112 | `resources\app.asar` 362.5MB | 3,732 | 11 |

签名面：Codex / ChatGPT 壳为 OpenAI OpCo, LLC；WorkBuddy / sandbox helpers 为 Tencent Technology (Shenzhen) 签名；Trae 与 agent-tool-host 为北京引力弹弓科技；ZCode 为北京智谱华章；Cursor 与 cursorsandbox 为 Anysphere, Inc.；Qoder、DeepSeek、OpenCode、MiniMax、小浣熊均为主程序有效签名（逐目标小节给出）。

---

## 3. 前端总矩阵

| 目标 | 源模块 | 图节点 | 边 | 函数 | 静态 IPC | 配对 | 仅 handler | 仅 invoker | 动态 IPC | endpoint | 唯一 URL | 窗口 | 暴露键 | 暴露成员 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Codex Electron | 9,660 | 444,320 | 1,253,774 | 368,991 | 36 | 3 | 9 | 24 | 48（已还原，0 未知） | 6,624 | 1,889 | 6 | 4 | 28 |
| Cursor | 830 | 319,057 | 681,140 | 300,113 | 33 | 12 | 0 | 2 | 45（43 可归因/0 未定） | 3,730 | 1,511 | 13 | 21 | 11 |
| DeepSeek | 17 | 3,129 | 5,931 | 2,778 | 0 | 0 | 0 | 0 | 142（102 调用/54 通道） | 17 | 13 | 5 | 11 | 31 |
| 豆包 ai-views | 2,295 | 465,369 | 1,473,627 | 398,481 | 0 | 0 | 0 | 0 | 0 | 4,552 | 750 | 0 | 0 | 0 |
| 豆包 biz.pak（三片） | 9,562 | 1,471,311 | 4,072,587 | 1,274,239 | 2（SDK 方法误匹配） | 0 | 0 | 2 | 0 | 8,973 | 1,231（单图口径） | 0 | 0 | 0 |
| MiniMax | 1,391 | 124,372 | 330,508 | 112,679 | 54 | 25 | 0 | 14 | 816（332+406/0 未定） | 1,887 | 1,394 | 10 | 35 | 373 |
| OpenCode | 3,231 | 46,281 | 80,579 | 39,462 | 3 | 1 | 0 | 0 | 5（3 唯一/0 未定） | 289 | 156 | 3 | 1 | 5 |
| Qoder 0.5.6 | 637 | 70,256 | — | 67,925 | 0 | 0 | 0 | 0 | 5（5 已归因/0 未定） | 200 | 96 | 8 | 0 | 0 |
| Qoder 0.5.7 | 637 | 70,317 | 124,900 | 67,977 | 0 | 0 | 0 | 0 | 0（0/0） | 202 | 97 | 8 | 0 | 0 |
| Qoder 0.5.12 | 610 | 63,629 | 129,852 | 61,375 | 0 | 0 | 0 | 0 | 0（0/0） | 192 | 105 | 10 | 0 | 0 |
| Qoder 0.5.14 | 610 | 63,630 | 129,877 | 61,382 | 0 | 0 | 0 | 0 | 8（8 已归因/0 未定） | 192 | 105 | 10 | 0 | 0 |
| Trae CN | 343 | 194,266 | — | 181,024 | 71 | 2 | 0 | 12 | 110（58 非字面量/0 未定） | 3,871 | 1,559 | 20 | 5 | 17 |
| WorkBuddy | 3,866 | 359,769 | 729,926 | 339,157 | 120 | 55 | 11 | 14 | 214（115 main 全归因） | 3,488 | 1,895 | 20 | 83 | 43 |
| 小浣熊 | 1,886 | 121,089 | — | 109,542 | 95 | 19 | 38 | 2 | 26（34 非字面量/0 未定） | 1,819 | 1,355 | 10 | 20 | 9 |
| ZCode | 2,837 | 77,729 | 144,984 | 72,766 | 3 | 2 | 0 | 0 | 423（227 全还原·180 唯一） | 377 | 175 | 10 | 8 | 169 |

豆包 `biz.pak` 的单图读数是 **9,797 模块 / 1,000,000 节点（需求 1,615,501，丢 615,501）/ 2,928,056 边 / 881,872 函数**；表内三片是分片重跑后的结果，不是单图子集相加。`ahalets` 5,907 / 832,342、`static` 3,597 / 628,680、`rest` 58 / 10,289；三片 `bundle_modules` 合计 166,986，与单图完全相等，说明 7,837 个 JS 的 bundle 面已全部进入；节点少 144,190 是 235 个单图额外计入的模块（资产/非 JS 口径）与跨片边缺失。三片 `endpoint` 合计 8,973，跨片 `(api,url)` 去重 885；单图 1,231 是工具自身口径，二者不能直接相减。详见 `analysis\doubao-pak-shards.json`。

### 3.1 JS 覆盖审计（`partial` 不等于 JS 漏读）

`js-app-map` 的 `coverage.status` 大多是 `partial`，但 `total` 把 `node_modules`、CSS、HTML、SVG、JSON 都算进去了。真正要证明的是“应用 JS/TS 有没有漏读”，所以逐目标只数非 `node_modules` 的 `.js/.cjs/.mjs/.jsx/.ts/.tsx/.mts/.cts`，再与图里的 `examined` 比：

| 目标 | 非 node_modules JS/TS | 图 examined | 结论 |
|---|---:|---:|---|
| Codex app.asar | 9,656 | 10,663 | 9,656 个应用 JS 全进图；215 个 node_modules JS + 136 个 `.d.ts` 按 `include-node-modules=false` 排除，0 漏读 |
| Cursor | 1,087 | 1,863 | examined 大于 JS，应用 JS 全覆盖；差额是 node_modules/资产 |
| Trae CN | 310 | 1,359 | 全覆盖；差额是 node_modules/资产 |
| WorkBuddy | 3,827 | 4,173 | 全覆盖；差额是资产 |
| Qoder 0.5.6 / 0.5.7 / 0.5.12 / 0.5.14 | 634 / 634 / 606 / 606 | 795 / 803 / 776 / 768 | 四版全覆盖；0.5.7 / 0.5.12 已用 asar header 直接计数，不再折算 |
| ZCode | 2,828 | 3,732 | 全覆盖；差额是 node_modules/资产 |
| DeepSeek Harness | 12 | 633 | 全覆盖；差额是 node_modules/资产 |
| OpenCode | 3,229 | 5,940 | 全覆盖；差额是 node_modules/资产 |
| MiniMax Code | 1,241 | 1,860 | 全覆盖；差额是 node_modules/资产 |
| 商汤小浣熊 | 1,374 | 1,965 | 全覆盖；差额是 node_modules/资产 |
| 豆包 ai-views | 2,291 | 2,311 | 全覆盖；其余 1,131 个未解析是 CSS 747 / TXT 309 / SVG 57 / JSON 16 等 |
| 豆包 biz.pak（三片） | 7,837 | 8,190 | 全覆盖；4,182 + 3,597 + 58 与解包 JS 逐个对齐 |

**结论：15 个前端图/分片里 0 个应用 JS 漏读目标。** 这也是为什么 `partial` 不能直接当成“没分析完”：它统计的是文件总数，不是应用代码总数。逐目标审计账本在 `analysis\frontend-coverage-audit.json`。

读法：**静态 IPC 少不等于能力少**。ZCode 只有 3 条静态通道，423 条工具计数经本地 227 个调用点逐条回填，得到 **227/227 已还原、180 个唯一通道、0 条未定**；WorkBuddy 的 214 条里 main 侧 **115 条注册全部归因**（81 常量/别名 + 29 模板 + 4 helper 形参 + 1 内部通道），12 个 `require_*` 别名全部回填；MiniMax 的 6+8 条变量也已回填，主进程 332 条 + renderer 406 条、源码 804 个调用点、0 条未定；DeepSeek 的 142 条经源码复核只有 **102 条业务调用 + 14 条清理**，业务调用全部落到 **54 个常量通道**，40 条差额是工具侧重复条目；Trae 的 58 条非字面量已归到 30 个通道，0 条未定；Cursor 的 45 条经 44 个 Electron 调用点复核，43 条非字面量里 29 条落 20 个通道、12 条 helper、1 条 4 路守卫、1 条运行期 payload、0 个未知常量，差额 2 条来自 js-debug 的 WebSocket `send` 误匹配；Qoder 四版本 5/0/0/8 共 13 条动态已全部解码到 6 个唯一通道（`diagnostics:renderer-responsiveness`、四个 `arms:rum-*`、`mcp-app:guest-message`），0 条未定；OpenCode 5 条动态全部跨文件配对回 3 个已有静态通道，0 条未定；小浣熊 34 个非字面量里 16 个落到 11 个固定通道、3 个模板族、1 个 7 通道清理循环、14 个 helper，0 条未定；豆包的两张图不能相加：ai-views 2,295 模块是扩展，biz.pak 才是主应用；单图 9,797 模块撞 1M 节点硬上限丢 615,501，三片重跑后 9,562 模块 / 1,471,311 节点 / 4,072,587 边 / 1,274,239 函数，166,986 bundle 模块与单图完全相等，余差 144,190 节点是 235 个单图额外计入的模块（资产/非 JS 口径）与跨片边缺失，不是新截断；它报的 2 条 IPC 是 `getScrollInfo` / `postMessageSync` 方法名误匹配，真正原生面是 Neotix 848 个方法。**“动态”这个字段必须逐目标复核，不能直接当成不可审计面。**

窗口安全：WorkBuddy 有一处 `contextIsolation=false / nodeIntegration=true / sandbox=false`，定位在 `main/index.js:203` 的腾讯文档调试面板（520×720，`DEBUG_PANEL` 分区），不是主 UI；另有一处 `webSecurity=false` 在 `main/main-bootstrap.js:368`。Trae 有 1 处 `sandbox off` + 1 处 `webSecurity off`。Cursor 有 5 处 `contextIsolation/nodeIntegration` 未显式设置（继承 Electron 默认）。Codex 主窗口 `contextIsolation:true / nodeIntegration:false`，但 `sandbox` 未声明、解包 JS 未发现 `app.enableSandbox`，实际默认取决于 Electron 版本与全局设置，静态不判 `false`，与其余 4 个显式 `sandbox:true` 窗口不同。其余见逐目标小节。

---

## 4. 逐目标取证

### 4.1 Codex（OpenAI，Electron 桌面壳 + Rust app-server/CLI）

**安装面**：`C:\Users\Administrator\AppData\Local\OpenAI\Codex\bin\31fb36cfc4b38f05\`，四个产品二进制：`codex.exe` 407,428,400 字节、`codex-code-mode-host.exe` 80,724,784、`codex-windows-sandbox-setup.exe` 19,823,408、`codex-command-runner.exe` 8,862,000；另有 `rg.exe`、`node.exe` 24.14、`node_repl.exe`。全部由 `OpenAI OpCo, LLC` 有效签名。
**Windows 包层（本轮补充）**：已注册 `OpenAI.Codex 26.1117.4957.0`；同机另有 `OpenAI.Codex_26.1120.5083.0` 目录（未注册/待切换）。两个 `PrimaryRuntime`：`v26-1119-907-0` 与 `v26-1123-915-0`。`app\Codex.exe` 只是 20,272 字节的启动 stub，真正的 407MB 主程序在 `app\resources\codex.exe`——这一点很容易被误读成“Codex 只有 20KB”。

**前端层（纠正二十）**：桌面壳是 `app\ChatGPT.exe`，5,003,568 字节，FileVersion `158.0.8127.37`，InternalName `chrome_exe`，FileDescription/Product `Codex`；同目录 `chrome.dll` 341,041,456。`resources\app.asar` 443,800,006 字节，SHA256 `8a437aad94098770c1bf5fd5385c204e162b62c6d7917f688741d74e05babe90`，包名 `openai-codex-electron`、版本 `26.1117.41037`、`main=.vite/build/early-bootstrap.js`，Owl 运行时（`owl-electron-app.json` / `owl-app.ini`）。`app.asar` 头 15,520 文件 / 454,135,151 字节：9,849 `.js` + 22 `.mjs` + 136 `.d.ts`。图：**9,660 模块 / 444,320 节点 / 1,253,774 边 / 368,991 函数 / 36 IPC（3 配对、9 仅 handler、24 仅 invoker）/ 6 窗口 / 4 暴露键（28 成员）/ 6,624 endpoint 记录（1,889 唯一 URL）/ 294 路由记录（133 唯一路径）/ 6 native 模块**。应用 JS 9,656 个全部进图；215 个 node_modules JS 与 136 个 `.d.ts` 按 `--include-node-modules=false` 排除。36 个通道里 `codex_desktop:*` 占 30 个，另有 `codex-shared-texture-create`、`codex:application-websocket`、`experian-verification-*` 3 个、`startup-screen-dismissed`；工具 summary 的 48 条动态调用已逐条还原（见 5.11），另发现 6 个 `sentry-ipc.*` 与 2 个 `worker:git:*` 运行期通道，0 条未知。
6 个窗口里 4 个显式 `sandbox: true`、`nodeIntegration: false`、`contextIsolation: true`；1 个 `WebContentsView` 未显式设 `contextIsolation`（继承 Electron 默认）；1 个 `BrowserWindow` 的 `webPreferences` 对象 `E` 已从 `getRendererPreferences(appearance, initialRoute)` 回溯：`contextIsolation:true`、`nodeIntegration:false`、`spellcheck:true`、`preload=this.options.preloadPath`、`devTools=this.options.allowDevtools`、`webviewTag` 条件开启，但 **没有 `sandbox` 字段**；9,871 个解包 JS 里也没有 `app.enableSandbox`，实际默认取决于 Electron 版本与全局设置，静态不判 `false`。所以这一个是“contextIsolated 但未显式 sandbox”，不是“读不出”；仍标运行验证，不判漏洞。

**第五个常驻二进制（纠正十七）**：`app\resources\codex-windows-sandbox-service.exe` 62,953,264 字节，`OpenAI OpCo, LLC` 签名有效，无 FileVersion/ProductName 元数据，SHA256 `E66E49429469B95C5A2219DAE872938BD8D70FBE920F1F1086E8CBA5777C3569`，运行态 PID 33980。字符串含 `windows-sandbox-rs\src\process.rs`、`wrapper.rs`、`setup_provisioning.rs`、`no_reparse_dir.rs`、`CreateJobObjectW`、`AssignProcessToJobObject`、`CreateRestrictedToken`、`WFP setup succeeded for `、`Persistent WFP provider for Codex Windows sandbox filters`、`WindowsSandboxService`、`elevated`/`unelevated`、`network-proxy\src\credential_broker\matching.rs`/`providers.rs`。`sandbox-setup.exe` 是安装/供给器，这个 service 才是常驻执行器；上一版四二进制清单漏了它。它还不是普通子进程：`sc qc` 显示 `CodexSandboxService.OpenAI.Codex`、`AUTO_START`、`LocalSystem`、DisplayName `ChatGPT`，父进程 PID 1264 是 `services.exe`；`sc sdshow` 的 `AU` 只有 `CCLCSWRPLORC`（可启动、查询，不可停止/改配置）。标准 PE 解析不是 0 导入，而是 24 DLL / 415 函数（`ws2_32` 37、`fwpuclnt` 11、`winhttp` 4、`advapi32` 78）；运行态有 `OpenAI.CodexSandbox.OpenAI.Codex_2p2nqsd0c76g0` 与 `codex-app-tools-ba97c01c-b1ce-4010-a6c8-46f38e6132c4` 两条命名管道，但 PID 33980 的 TCP/UDP 端点为 0。`OpenAI.CodexSandbox` 的 ACL 是 `CodexSandboxUsers` Deny FullControl、`INTERACTIVE` Allow 读写/创建、`SYSTEM`/Administrators FullControl（见 5.9）。详见纠正十八与十九。

**核心概况**（`ev_9c096652…`）：PE x86_64，函数发现到 50,000 上限、字符串 204,743 条（保留前 200,000）、导入 486 个 / 25 个库。主程序导入可以直接归因；桌面壳与 app.asar 另算，不再用“Rust CLI”概括整个产品。

**Rust crate 层（本轮补证，绕开 256MB 上限）**：craft 的 `native-rust-binary-show` 直接拒绝 407,428,400 字节，于是对同一文件做字节级 cargo 路径正则（`registry\src\<index>\<crate>-<version>\`），命中 **8,839 次、去重 400 个 crate**，rustc commit `58cf8f9c35b355199727627d07ae34a4e2846d67`，另有 5 个 git checkout（`bc589d6`/`4253de9`/`b11a40d`/`b211201`/`7447c42`）。两个已安装包（26.1117 / 26.1120）都是 400 个 crate、8,839 / 8,850 次命中、同一 rustc commit，说明 26.1120 是 patch 级重建而非大版本换代。79 个安全/网络相关 crate 里，有四组值得注意：
- `starlark 0.14.2` + `starlark_syntax 0.14.2`（210 + 12 次引用）：与 execpolicy 的 `rule.rs`/`parser.rs` 互相印证，**Starlark 很可能就是策略 DSL 的求值器**。这是依赖清单，不是调用点证明。
- `rama-http-core 0.3.0-alpha.4` 及 `rama-tcp/net/dns/tls-rustls/socks5/http-backend/http`：一整套自建 Rust 代理/HTTP 栈，不是单纯 `reqwest`。
- `aws-config 1.8.12` / `aws-sdk-signin 1.2.0` / `aws-sdk-ssooidc 1.93.0` / `aws-sdk-sts 1.95.0` / `aws-lc-rs 1.18.1`：AWS 登录、SSO、STS 这条链，配合 `oauth2 5.0.0`。
- `quinn 0.11.9` / `quinn-proto`、`tonic 0.14.3`、`rustls 0.23.46`、`hickory-resolver 0.25.2`、`opentelemetry-otlp 0.31.0`：QUIC、gRPC、TLS、DNS、OTLP 遥测。
完整清单在 `out\deep\native\codex\crates.json`（top 40 + 79 个安全相关项）。**限制**：路径存在只证明该 crate 被编译进二进制，不证明对应功能已启用；PE 只有 `.text/.rdata/.data/.pdata/.fptable/.tls/_RDATA/.reloc` 八个 section，没有 `.dep-v0`，所以拿不到 cargo-auditable 的权威依赖清单。PE debug directory 里有一个 CodeView `RSDS` 条目：`codex.pdb`，GUID `A76FDC38-7BA8-ABA9-4C4C-4450205044BE`，age 1；`codex.pdb` 没有随包分发（WindowsApps 与 AppData 下均未找到），COFF symbol table 为 0，所以 demangle 需要外部 PDB，当前不可得。

**权限模型是四层结构，不是一句“有沙箱”。**

1. **策略层**：`execpolicy\src\rule.rs`、`execpolicy\src\parser.rs`、`POLICY_BUILTINS_STATICS`，以及 `policy_builder requires Evaluator.extra to be populated`（`ev_52272be7…`，sandbox-setup 字符串）。说明存在独立的 execpolicy 规则解析器，不是简单 allow/deny 列表。
2. **权限 profile 层**：`struct LegacyPermissionProfile with 2 elements`、`struct variant TaggedPermissionProfile::Managed with 2 elements`、`TaggedPermissionProfile::External`、`struct NetworkPermissions with 1 element`、`struct variant SerializedManagedFileSystemPermissions::Restricted with 2 elements`、`RawFileSystemSandboxEntry with 3 elements`、`resolve permission profile token mode`（`ev_7af3d35e…`，command-runner）。
3. **Windows 令牌层**：`CreateRestrictedToken`、`AdjustTokenPrivileges`、`CreateProcessAsUserW`、`CreateProcessWithLogonW`、`SetTokenInformation`、`OpenProcessToken`（`ev_1e646b63…`，codex.exe 87 个安全导入里）。
4. **作业对象 + ConPTY 层**：`windows-sandbox-rs\src\process.rs`、`windows-sandbox-rs\src\bin\command_runner\win.rs`、`spawned ConPTY is missing its process job`、`Local\CodexSandboxReadAcl`、`CreateJobObjectW`、`AssignProcessToJobObject`、`SetInformationJobObject`、`TerminateJobObject`。这句话很关键：**ConPTY 必须挂进 process job**，否则报错。
5. **网络层**：`Codex Windows Sandbox WFP` 是持久化的 WFP provider 名称，配合 `orchestrator_elevation_check_failed`、`orchestrator_payload_serialize_failed`、`write sandbox users file`、`convert SID failed`、`deny_read_state.rs`，说明沙箱安装器/服务会创建专用用户/SID、写 ACL、注册 WFP 过滤器；服务导入 `FwpmEngineOpen0`/`FwpmFilterAdd0`/`FwpmTransactionCommit0`，字符串还区分 `CodexSandboxOffline` / `Online`、`sandbox_offline_block_outbound`/`inbound`/`loopback_tcp`/`loopback_udp` 与 `sandbox_offline_allow_loopback_proxy`。
6. **密钥层**：`&dpapi protect failed for online user:`、`'dpapi protect failed for offline user:`、`CryptProtectData`、`PFXImportCertStore`（sandbox-setup）。DPAPI 只用于沙箱安装器自己的秘密，不是模型凭据。

**后端接口**：codex.exe 里有 `app-server-client\src\remote_websocket.rs`、`ws://127.0.0.1:0`、`127.0.0.1:0`，说明存在 **app-server 的本地 WebSocket 客户端**（端口由内核分配）。这解释了 Codex 桌面壳与 CLI 之间的通信方式，属于后端层证据。运行态 PID 38788 的 `codex.exe ... app-server` 命令行还声明 `features.code_mode_host=true`、`plugins.codex-app-tools@openai-bundled.mcp_servers.codex_app.enabled=true`，以及 `unified-computer-use`/`node_repl`/`artifact_session` 三组 MCP 启动配置；但快照里只有 `conhost.exe` 子进程，没有实际 MCP 子进程，见 5.10。

**纠偏**：`codex-code-mode-host.exe` 的 47 条 “sandbox” 字符串全部是 **V8 sandbox**（`V8.SandboxedCppHeapPointersCount`、`Failed to reserve the virtual address space for the V8 sandbox`），与操作系统沙箱无关；上一版若把它算进“沙箱能力”是错的。

**证据锚点**：`ev_9c096652…`（overview）、`ev_1e646b63…`（imports）、`ev_3d496a21…`（permission 字符串）、`ev_7af3d35e…`（command-runner imports）、`ev_52272be7…`（sandbox-setup imports）、`ev_5e0ce2c6…`（publisher）。

---

### 4.2 WorkBuddy（腾讯，Electron + Rust sandbox）

**安装面**：`C:\workbuddy`，5.11.3；`WorkBuddy.exe` 204,590,360 字节；`resources\app.asar` 172,939,770 字节，解包 12,226 文件 / 721MB；`app.asar.unpacked` 下 83 个 `.node/.exe/.dll`。

**前端（`ev_9543bb87…`）**：3,866 源模块 / 4,173 个 JS 文件 / 6,949 个 bundle 模块 / 339,157 函数 / 359,769 图节点 / 729,926 边 / 3,488 条 endpoint（1,895 个唯一 URL）/ 20 个窗口 / 83 个 `contextBridge` 暴露键。静态 IPC 120 条，配对 55 条，11 条只有 handler，14 条只有 invoker。工具把 **214 条**非字面量引用记为 dynamic；main 侧逐文件复核后是 **115 条 `ipcMain` 注册**：81 条常量或模块别名、29 条反引号模板、4 条通用 helper 参数、1 条内部 `__completeLocalStorageMigration`（`main-bootstrap.js`）。12 个 `require_*` 别名已全部回填：`proxy-env.y`→`window-app:content-ready`、`shell-env-async.gr`→`window-app:browser-metric`、`lr`→`account-snapshot:persist`、`Rn`→`host-platform:get-sync`、`zn`→`iframe-window:system-close`、`Hn/Bn/Un`→`wechat:isInstalledSync/getVersionSync/isRunningSync`、`menu-builder.L/R/Kt/rn`→`workbuddy:set-close-tab-shortcut-armed/tab-shortcut-unconsumed/renderer:getPerformanceMetrics/window:openStartupAnalysis`；应用层没有未定通道。4 条 `e` 是 `registerListener(e,t)` 的形参，实际通道由调用点常量传入，不是独立通道。

IPC 命名本身就把产品能力摊开了：

- `mcp-app-client-message` / `mcp-app-host-message`：MCP App 的双向消息面。
- `remote-window:close-request` / `confirmClose` / `cancelClose` / `close-ready`：远程窗口关闭四步握手，属于有状态 UI 协议。
- `software-update:getSnapshot` / `state` / `action` / `contentHeight`：更新器是一个独立的状态机。
- `browser-tabs:command`、`browser-annotation:command`、`browser-find:action`、`browser-preview-surface:ack`：内嵌浏览器与批注。
- `buddy-app:read-local-directory`、`read-local-zip`、`watch-debug-directory`、`ensure-https-handler`：本地目录/压缩包读取与自定义 HTTPS handler。
- `workbuddy:debugCookie:get/save/clear`、`debugTencentDocsEngine:save/clear`、`debugTencentDocsOpenDoc:open`：腾讯文档调试链路。
- `oneid:postMessage`、`lexiang:message`、`tdoc-import:*`、`tdoc-preview:*`：OneID / 乐享 / 腾讯文档三套外部集成。

**窗口安全要说清楚，不能拿调试面板吓人。**
`main/index.js:203` 确实创建了一个 `contextIsolation:false, nodeIntegration:true, sandbox:false` 的 `BrowserWindow`，但同一个表达式里写着 `title: "TDoc 调试"`、`width:520,height:720`、`partition: "DEBUG_PANEL"`，并伴随 `createDebugPanelHtmlFile()`（`ev_9543bb87…`，windows 段）。这是腾讯文档登录态调试面板，不是主界面。真正需要关注的是 `main/main-bootstrap.js:368` 的 `webSecurity:false` 窗口，以及 12 个 `webPreferences` 在运行期计算的窗口。

**核心（产品级，不是 Electron 噪声）**：`app.asar.unpacked\cli\vendor\sandbox\5.11.4\` 下两个 Rust helper，均由 Tencent Technology (Shenzhen) 签名：

- `sandbox-cli.exe`（2,431,768 字节，9 个 crate）：`CreateJobObjectW`、`AssignProcessToJobObject`、`SetInformationJobObject`、`QueryInformationJobObject`、`TerminateJobObject`、`CreateNamedPipeW`、`ConnectNamedPipe`，字符串 `SandboxPaths.session(<id>).permission_file`、`permission.json`、`sandbox\src\bin\sandbox_cli.rs`、`sandbox-cli 启动参数:`（`ev_ffba2a7f…`、`ev_6f5ff4ee…`）。
- `sandbox-center.exe`（10,578,712 字节，28 个 crate）：命名管道服务端 + **安全描述符 ACL**（`ConvertStringSecurityDescriptorToSecurityDescriptorW`、`SetSecurityDescriptorDacl`、`DuplicateTokenEx`、`GetNamedPipeClientProcessId`），字符串 `sandbox-center 启用审批反向通道: approval.callbackAddress=`、`approvedByUser`、`approvalReq`、`approvalQueue/backupQueue/restoreQueue`、`sandbox-center\src\cipher\detect\plaintext.rs`，以及一整套 secret 扫描规则（`1password-secret-key`、`adafruit-api-key`、`generic-credential`）（`ev_78fc8fe4…`、`ev_48f8887d…`、`ev_928ed7f5…`）。
- Rust crate 指纹：`aes 0.8.4`、`argon2 0.5.3`、`rusqlite 0.40.2` / `libsqlite3-sys 0.38.2`、`windows 0.58.0`、`regex 1.13.1`。说明审批票据做了加密+口令派生，状态落 SQLite。
- 另有 `betterleaks.exe`（secret 扫描器）与 `resources\im-backend-cmd\im-napi.node`（IM 后端 native 桥）。

**后端/服务层（上一版完全没有）**：`main/server.js` 里是一个 **MCP Host**：

- `tt.createServer(...)` + `listenOnLoopback` 里的 `e.listen(0, "127.0.0.1")`（`main/server.js` 内 `[McpHost] 拿不到回环端口` 上下文已核对），端口由内核分配；`discoveryUrl()` 返回 `http://127.0.0.1:${this.port}${path}`。
- **同一产品里不止一个回环服务**：`main/app-server-mcp-apps-host.js`（`[McpAppsHost]` 专用 HTTP server）与 `main/connector-harness-marketplace.js` 也各自 `listen(0, '127.0.0.1')`。所以“WorkBuddy 有本地服务”不是单点，而是多宿主。
- 路由有注册/注销：`[McpHost] route registered/unregistered`、`MCP route unregistered`、`aborted` 计数。
- 同一文件还有 **A2A outbound proxy**：`A2A outbound proxy failed to bind loopback`、`discoveryUrl()`；以及 **WecomA2A host**：`[WecomA2A]`、`approvals.declineAll()`、`broker.prewarmAgentTicket`、`a2a.host-managed`。
- 环境变量白名单直接暴露后端接线：`OCS_LOCAL_MCP`、`TENCENT_DOCS_LOCAL_SERVER`、`editor_sdk_port`、`WORKBUDDY_VLM_CHAT_URL`、`WORKBUDDY_VLM_AUTH_TOKEN`、`CODEBUDDY_REMOTE_AGENTS_URL`、`CODEBUDDY_A2A_OUTBOUND_ENABLED`、`WECOM_CLI_*`。
- 前端暴露面里还有 `__mcpHostTestApi: getToken, getWBCurrentSessionId`，说明 MCP Host 有测试用取 token 接口（静态可见，是否生产启用未知）。
- 本地 endpoint 实例：`http://127.0.0.1:39099/mcp`（前端 2 次；`daemon-bootstrap.js` 里 `Pe=39099,Fe=39120` 可对上）、`http://127.0.0.1:52741/v1/chat/completions`（`daemon-app-server-main.js` 里用于本地模型注册）、`http://127.0.0.1:{e}/localapi/save`、`http://127.0.0.1:49983/envs`、`http://localhost:11434/v1/chat/completions`（Ollama 兼容）。`http://127.0.0.1:9527` 只出现在 `cli\bin\daemon-status-brief.test.cjs` 的测试夹具里（模拟 daemon endpoint），**不是生产端口**。
- **运行态快照（2026-11-25 15:26，非本轮启动）**：main 22984 监听 `127.0.0.1:18488`；`daemon-app-server-entry.js --stdio` 进程 31688 监听 `56000` / `57736` / `57737`；两个 `codebuddy --serve` 进程 41604 / 8372 分别监听 `57740` / `63423`；`WorkBuddy_SandboxCenter_*`、`WorkBuddy_SensitiveApproval_*`、`workbuddy-...-sidecar-control-*` / `-data-*` 管道均存在。它证明 MCP Host/daemon/sidecar 层不是只在静态代码里，但 HTTP/WS/MCP 协议与鉴权仍未探测。

**一句话结论**：WorkBuddy 的“前后端”是三层——渲染层（Electron renderer + contextBridge 83 键）、主进程服务层（MCP Host / A2A / WeCom / daemon）、原生沙箱层（Rust cli+center，Job Object + pipe ACL + approval 反向通道）。这三层都有产品级证据，且互相咬合。

**证据锚点**：`ev_9543bb87…`（jsmap）、`ev_7d7f5107…`（WorkBuddy.exe overview）、`ev_c3c3cb42…`（imports）、`ev_78fc8fe4…` / `ev_ffba2a7f…`（两个 sandbox helper imports）、`ev_928ed7f5…` / `ev_f0aa264a…`（Rust 指纹）、`ev_48f8887d…`（approval 字符串）。

---

### 4.3 Trae CN（字节系，VS Code fork + 自研 sandbox SDK）

**安装面**：`C:\Trae CN`，`resources\app` 8,094 文件 / 1,445,772,134 字节。版本有三个平面，必须同时写：安装包记录 3.4.20（旧台账）、`product.json` / `package.json` 1.107.1、`Trae CN.exe` 文件版本 2.3.103559。签名主体：北京引力弹弓科技有限公司。

**前端（`ev_84c1dba4…`）**：343 源模块 / 1,359 JS 文件 / 5,926 bundle 模块 / 181,024 函数 / 194,266 节点 / 3,871 endpoint（1,559 唯一）/ 20 窗口 / 71 静态 IPC（配对只有 1 条，12 条仅 invoker）/ **110 条动态（58 条非字面量已全部归因）**。重建后的逐文件账本：**73 个 `ipcMain/ipcRenderer` 调用 + 62 个 `webContents.send/postMessage`**，58 条非字面量里 **56 条落到 30 个唯一通道**，2 条是 `IpcMainWrapper` 形参/`responseChannel` 一类非通道值，0 条未定。110 与 58 的差是工具把 sender/桥接引用重复计入，不是新的未知通道。

IPC 结构揭示了 Trae 的真实产品形态：**71 条里绝大多数是 `icube-floating-chat:*` 与 `vscode:*` 两个前缀**。

- `icube-floating-chat:*`（约 30 条）：`button-hit-region`、`button-resize`、`button-visibility`、`chat-drag-move/end`、`context-menu`、`cursor-position`、`native-input-mode`、`native-mouse-event`、`toast-placement`、`quick-create`、`task-state`、`update-scale`、`update-theme`。这是一套“悬浮聊天窗”的几何与状态协议，主进程负责像素级定位。
- `vscode:*`：`getLastWorkspace`（唯一配对）、`getWindowPosition`、`capturePage`、`fetchShellEnv`、`createPtyHostMessageChannelResult`、`iCubeGetNetworkDataResponse`、`iCubeListProcessesResponse`、`iCubeSystemUsageResponse`、`migration:*`。说明它保留了 VS Code 的 window/pty/migration 通道，同时加了 iCube 的系统监控通道。
- 非字面量的具体落点：`@byted-icube/ai-modules-chat` 的 `SANDBOX_TO_MAIN_*` / `MAIN_TO_SANDBOX_*` 枚举（`vscode:sandbox::main-*` / `vscode:main::sandbox-*`），以及 `vscode:computerSurfaceCatalogChanged`、`vscode:computerSurfaceAction`、`vscode:previewAvailability`、`vscode:icube-task-notification-present`、`vscode:icube-floating-chat-open-panel` 等；`out/main.js` 的 5 个 `t` 是 `IpcMainWrapper.on/once/handle/removeHandler/removeListener` 的形参，不是独立通道。
- 结论：Trae 的前端增量不在“重写 IDE”，而在“把 AI 对话做成独立浮窗 + 系统监控/进程列表通道”。

**核心（产品级）**：`resources\app\modules\sandbox\` 是一个完整的 sandbox SDK，不是单个 exe：

- `sbox_sdk.dll`（2,320,272）、`unified\vm_sdk.dll`（2,582,928）、`x64\aiep_sbox.dll`（757,648）、`x64\aiep_ipc.dll`（577,424）、`x64\run_helper.exe`（682,384），另有 x86 全套。
- `trae-sandbox.exe`（1,255,824，Rust 21 crate）：`tokio 1.48`、`winsafe 0.0.19`、`base64 0.22`、`indexmap`、`parking_lot`；字符串 `apps\icube_server_rs\crates\sandbox\src\ffi_sandbox.rs`、`is_sbox_supported`、`SandboxConfigPermissionObjectWireRef`、`process_policy`、`CreateSandboxFailed`、`TRAE Sandbox Error: process launch failed`（`ev_eda58c80…`、`ev_9c74e597…`、`ev_047bfaa1…`）。
- `agent-tool-host.exe`（101,117,328，独立签名）：安全导入 40 个，含 `CreateJobObjectW`、`AssignProcessToJobObject`、`SetInformationJobObject`、`TerminateJobObject`、`CreateNamedPipeW`、`ConnectNamedPipe`、`SetNamedPipeHandleState`、`AcceptSecurityContext`、`AcquireCredentialsHandleW`、`EncryptMessage`、`DecryptMessage`、`CertVerifyCertificateChainPolicy`（`ev_09d553db…`）。
- 字符串：`toolhost\services\preview-proxy\src\port_policy.rs`、`allowList`、`denyList`、`binary_payload_policy`、`PermissionDenied`、`TRAE_SANDBOX_NEW_PERMISSION`、`TRAE_REMOTE_SANDBOX_NAME`、`/sandboxes/`、`sandbox_namemanager_host`、`mcp_host_meta_session`、`workroom_credent`（`ev_e4b861da…`）。
- 一个很能说明设计意图的提示串：`Hint: If the tool supports running outside the sandbox, you should try requesting to run this command outside the sandbox.`
- **运行期落盘结构（本机已有 543 个会话目录，非本轮运行产生）**：`UserData\ModularData\ai-agent\command-execution\<32位id>\` 下固定四个文件 `cwd.txt`、`execution.json`（502B）、`output.log`、`stderr.log`；同级 `sandbox-storage\restricted\` 存放受限区。说明每条命令一个 session 目录，权限与工作目录按会话隔离，便于事后审计与回放。
- **SDK 版本对比（关键证据）**：Trae `sbox_sdk.dll` 2,320,272 字节 / `FileVersion 1.16.0.0` / SHA256 前 8 位 `47EA81AF`；豆包 `sbox_sdk.dll` 2,656,144 字节 / `FileVersion 2.1.17.0` / `CC96F66B`。同一套 aiep SDK 家族，但**不是同一个构建**：Trae 是 1.x，豆包是 2.x。`aiep_sbox.dll` 也是 x64 757,648（Trae）对 784,272（豆包）。

**后端/服务层**：`agent-tool-host.exe` 同时是 toolhost（工具宿主）、preview-proxy（预览代理 + 端口策略）、sandbox 命名管理器。它用 Named Pipe + SSPI（NTLM/Kerberos）做本机鉴权，用 Job Object 做进程树回收，用 `port_policy` 控制预览端口白名单。这是“工具执行后端”，不是 Electron 主进程的一部分。

**证据锚点**：`ev_84c1dba4…`（jsmap）、`ev_09d553db…`（agent-tool-host imports）、`ev_eda58c80…`（trae-sandbox imports）、`ev_047bfaa1…`（Rust 指纹）、`ev_e4b861da…`（toolhost 字符串）、`ev_5a2ca961…`（签名）。

---

### 4.4 Qoder CN（阿里，Electron，四版本并存）

**安装面**：`C:\Qoder CN` 有四套完整前端：根目录 `resources\app.asar` 200,556,966（对应 `Qoder CN.exe` 0.5.6），`.qoder-versions\0.5.7\resources\app.asar` 200,609,244，`.qoder-versions\0.5.12\resources\app.asar` 174,426,876，`.qoder-versions\0.5.14\resources\app.asar` 174,403,011（0.5.14 exe 239,205,888，build-manifest 显示 Electron 43.8.4、commit b3ac440、buildTime 2026-11-17T11:43:21Z）。四个版本全部做了 jsmap，不再只写 0.5.14。

**0.5.14 前端（`ev_6e0090db…`）**：610 源模块 / 768 JS 文件 / 108 bundle 模块 / 61,382 函数 / 63,630 节点 / 129,877 边 / 192 endpoint（105 唯一）/ 10 窗口 / **0 个静态 IPC** / 8 条动态 / 0 个 contextBridge 暴露键。
**0.5.12 前端（`ev_fa21f425…`）**：610 模块 / 776 文件 / 108 bundle / 61,375 函数 / 63,629 节点 / 129,852 边 / 192 endpoint（105 唯一）/ 10 窗口 / 0 静态 IPC。
**0.5.7 前端（`ev_caf71a90…`）**：637 模块 / 803 文件 / 198 bundle / 67,977 函数 / 70,317 节点 / 124,900 边 / 202 endpoint（97 唯一）/ 8 窗口 / 0 静态 IPC。
**0.5.6 前端（`ev_15085ef1…`）**：637 模块 / 795 文件 / 198 bundle / 67,925 函数 / 200 endpoint（96 唯一）/ 8 窗口 / 0 静态 IPC / 5 动态（5 已归因/0 未定）。
**0.5.6 的 5 条动态已全部还原**：`ipcMain.on("diagnostics:renderer-responsiveness")`（`Rfe`，枚举键 `rendererResponsiveness`）、`ipcMain.on("arms:rum-bridge")`（`cur`）、`ipcMain.on("arms:rum-custom-report")`（`bur`）、`ipcMain.on("arms:rum-anr-heartbeat")`、`ipcMain.on("arms:rum-anr-visibility")`。这 5 条分别是模块级 `const Ocr/Pix/Mix/Xcr` 与 `f0[...]` 枚举键，不是运行期拼接。字符串用 Qoder 自带的自定义 base64 表解码（`pe0` 表 66,125 项，旋转偏移 **283**，校验值 479,282）。
**0.5.14 前端（`ev_6e0090db…`）**：610 模块 / 795 文件 / 108 bundle / 61,382 函数 / 192 endpoint（105 唯一）/ 10 窗口 / 0 静态 IPC / **8 动态，8 条全部还原**——主进程 5 条与 0.5.6 相同（`diagnostics:renderer-responsiveness` + 四个 `arms:rum-*`），另 3 条是 `preload\mcpAppGuest.cjs` 的 `mcp-app:guest-message`（两次 `sendToHost` + 一次 `on`）。0.5.14 的自定义 base64 表 `du` 有 879 项，旋转偏移 **200**，校验值 208,594。
**0.5.7 / 0.5.12**：动态 IPC 为 0，不是“没扫到”，是这两个版本的注册表已改用枚举/事件总线，源码里没有非字面量 `ipcMain/ipcRenderer` 调用点。
**版本关系**：0.5.6 与 0.5.7 主结构几乎一致（637 模块 / 198 bundle / 67,9xx 函数）；0.5.12 与 0.5.14 主结构几乎一致（610 模块 / 108 bundle / 61,3xx 函数 / 192 endpoint）。动态 IPC 的 5/0/0/8 已全部还原：0.5.6 是 5 条主进程 RUM/可响应性通道，0.5.14 多出 `mcp-app:guest-message` 的 3 条 guest preload 调用；0.5.7/0.5.12 确实为 0。差异有明确来源，不再用“运行期拼接未还原”解释。

**0 条静态 IPC 不是“没有 IPC”，而是走了另一套通道。** 主进程模块名给出答案：

- `out/main/remoteSdkDaemonBridge.js`：**远端 SDK daemon 桥**，不是 ipcMain。
- `out/main/qoderSdkDaemonHookMockPreload.js`：daemon hook 的 mock preload，用于开发/调试。
- `out/main/pluginHost.js`、`out/preload/pluginViewRuntime.cjs`、`pluginViewDiagramRuntime.cjs`、`mcpAppGuest.cjs`：插件宿主 + MCP App 客座 preload。
- 依赖表（package.json）：`@qoder-space/application-server`、`@qoder-space/runtime-host-services`、`@qoder-space/peer-transport`、`@qoder-space/collaboration-core`、`@qoder-space/application-sdk-protocol`、`@modelcontextprotocol/client|node|server`、`node-pty`、`ws`、`electron-updater`、`@qoder-ai/qoder-agent-sdk` / `qoder-cn-agent-sdk`（同一包的两个 npm alias，1.0.60-alpha.66）。
- 结论：Qoder 的应用层是 **application-server + runtime-host-services + peer-transport** 的服务化结构，Electron 只是壳；IPC 走 daemon/peer 传输，静态 ipcMain 自然为 0。

**窗口安全是这批产品里最规范的一档。** 10 个窗口全部显式 `contextIsolation:true`、`nodeIntegration:false`、`sandbox:true`、`webSecurity:true`；只有 1 个 `WebContentsView` 没有显式 contextIsolation（继承默认），1 个窗口 `webPreferences` 运行期计算（`ev_6e0090db…`，windows 段）。

**核心**：`.qoder-versions\0.5.14\Qoder CN.exe`（239,205,888）实测 40,845 函数 / 200,688 字符串 / 1,271 导入 / 58 库，安全导入 131 个——但字符串是 blink::、v8::、cppgc::、`node:electron/js2c/sandbox_bundle` 这类 Electron 内置。**这一条不能当产品沙箱证据**，产品能力在 JS 服务层与原生模块（12 个 `.node` + 12 个 DLL/EXE，共 24 个原生文件）。注意：根目录 `Qoder CN.exe` 是 0.5.6（239,205,896），与本条不是同一个文件。
**四个 exe 的关系（本轮补证）**：0.5.7 与 0.5.12 的 overview 计数与 0.5.14 **完全相同**——40,845 函数 / 200,688 字符串 / 1,271 导入 / 58 库，连 entry point `0x14302cde0` 与 timestamp `1792983370` 都一样，`pdb_path` 都是 `electron.exe.pdb`。说明 0.5.7–0.5.14 共用同一套 Electron 壳代码，差异只在版本资源与签名。四个 exe 的 SHA256 前 16 位各不相同：0.5.6 `414A3B1B`、0.5.7 `D3E6376F`、0.5.12 `2CE54B3B`、0.5.14 `D0CF5205`——**代码段相同、文件哈希不同**，这是签名/版本资源导致的正常现象。0.5.7 与 0.5.12 的签名主体是 `Alibaba Cloud Computing Co., Ltd.`（杭州西湖区，`signature_check: valid`）。

**原生模块清单（本轮实测，0.5.6 与 0.5.14 完全同构）**：关键项是 `keytar\prebuilds\win32-x64\keytar.node` 707,584、`aoq-electron-sdk\prebuilds\win32-x64\aoq_node_ext.node` 253,952、`AoqClientSdk.dll` 14,688,776、`PluginOpus.dll` 730,112、`alivcffmpeg.dll` 4,093,448、`skia.win32-x64-msvc.node` 27,294,720、`libvips-42.dll` 19,123,712、`node-pty` 三套构建、`OpenConsole.exe` 1,148,448。
**上一版说的 keytar / aoq 是真的**：本轮一开始只看 `package.json` 依赖表，误判为“未复现”；转到 `app.asar.unpacked` 后，四个版本的 `keytar.node` 与 `aoq_node_ext.node` 都在。这是一次自我纠错，也说明“package.json 没列”不等于“文件不存在”。

**`aoq` 的定性已纠正（纠正十四）**：它不是“播放器 SDK”，而是阿里云 `NLS-RTC-Service` 的 `aoq-client-sdk` RTC 引擎；`IAoqClientEngine` 43 个方法、`IAoqElectronBridge` 45 个 NAPI 方法，支持麦克风/摄像头采集、音视频帧观察、Aliyun RTC relay（`token` / `sid` / `relayEndpoints`）与 data channel。四个版本都带 `AoqClientSdk.dll` / `aoq_node_ext.node` / `PluginOpus.dll` / `alivcffmpeg.dll`，但四个版本的 asar app JS/TS/JSON 扫描（4,374 / 4,374 / 4,286 / 4,286 个文件，排除 SDK 自身）只有根 `package.json` 声明命中，**0 个 import/require，SDK 目录之外 0 个路径含 `aoq`**；`loadNative()` 是模块级，未被 import 就不会加载 `.node`。运行态模块枚举（5.7）里 0.5.14 的 41 / 47 个模块中也没有 `AoqClientSdk.dll` / `aoq_node_ext.node` / `keytar.node` / `PluginOpus.dll` / `alivcffmpeg.dll`，与静态结论一致；仍不能证明未来代码路径不会加载。所以它是**随包携带、当前静态不可达且运行态未加载的 RTC 能力**，桌面 IPC 通道增量为 0，启用条件未知。详见 `analysis\qoder-aoq-sdk.json`。

**后端/服务层**：`application-server` + `peer-transport` 是关键。前者是应用服务宿主，后者是 peer 传输层；加上 `session-history`、`session-migration`、`memory-migration`、`artifact-preview`，说明会话/记忆/工件是被服务化的，不是渲染进程直接读写。端点里能看到阿里内部服务：`ali-skill.alibaba-inc.com`、`iservice.alibaba.com`、`modelstudio.console.aliyun.com`、`bailian.console.aliyun.com`、`img.alicdn.com`。

**四版本后端扫描补证**：asar 内 JS 的 `mcpServer` 命中 665 / 665 / 629 / 629，其中 `out/main/electronMain.js` 123 / 123 / 129 / 129，`@qoder-ai/qoder-cn-agent-sdk/dist/index.js` 各 37；`http.createServer` 8 / 8 / 6 / 6（express + `@modelcontextprotocol/node`），0.5.12 / 0.5.14 另有 `ws/lib/websocket-server.js` 的 `WebSocketServer` 1 处。四版本都没有 `ipcMain.handle/on`、`contextBridge.exposeInMainWorld`、`safeStorage`、`keytar` 的 JS 命中。说明 Qoder 的 MCP 是主进程内独立服务代码路径，Electron IPC 仍走 application-server/peer-transport；是否在启动时 listen 未运行验证。运行态快照里 0.5.14 进程 4744 确实监听 `127.0.0.1:55346`，但它来自本机测试脚本 `C:\IHUI-AI\scripts\qoder-chat-bridge.mjs --port 0`，**不能算 Qoder application-server 的端口**；Qoder 自身服务端口仍未识别。账本：`analysis\backend-qoder-all.json`。

**证据锚点**：`ev_6e0090db…`（0.5.14 jsmap）、`ev_15085ef1…`（0.5.6 jsmap）、`ev_fa21f425…`（0.5.12 jsmap）、`ev_caf71a90…`（0.5.7 jsmap）、`ev_05eabcea…`（0.5.7 exe overview）、`ev_408c01b6…`（0.5.12 exe overview）、`ev_4f5473fe…`（imports）、`ev_07e3697a…`（strings）、`ev_d256efc1…`（签名）。

---

### 4.5 ZCode（智谱，Electron + host RPC）

**安装面**：`C:\ZCode`，`ZCode.exe` 3.19.1.10833 / 246,332,312 字节，`resources\app.asar` 385,193,027 字节（30,957 个列出文件），签名 北京智谱华章科技股份有限公司。`resources\tools\runtime-host\zcode-runtime-host.exe` 只有 179,608 字节，既无 Rust 指纹也无 Go build info，更像一个极薄的 launcher/relay（静态无法判定语言）。

**前端（jsmap `ev_8277c347…`）**：2,837 源模块 / 3,732 JS 文件 / 108 bundle 模块 / 72,766 函数 / 77,729 节点 / 144,984 边 / 377 endpoint（175 唯一）/ 10 窗口 / **3 条静态 IPC** / 423 条动态 / 8 个暴露键 / 169 个暴露成员。

**423 条工具计数已全部归因，业务侧 227/227 还原**：本地 preload 实际有 **227 个** `ipcRenderer.invoke/send/sendSync/once` 调用点；逐文件扫描后 **227 条全部还原，180 个唯一通道，0 条未定**。主通道表是 `out/preload/index.cjs` 的 `var v={…}`，共 **169 项** `zcode:*`（`WindowControlsOverlayChanged` → `zcode:window-controls-overlay-changed`、`PreinstalledToolsState` → `zcode:preinstalled-tools:state` 等）；另有 `ge` 对象 9 项（`DatabaseStartupState`/`DatabaseStartupControl`/`ServicePort`/`ScopedServicePort`/`ScopedServicePortReady`/`ScopedServicePortReleased`/`SourceSettingsServicePort`/`TaskNotificationSound`/`PluginSandboxPorts`）、`QC.Init`→`zcode:plugin-sandbox-init`、`hR`→`zcode:cua-permission-panel-state`、`r`→`zcode-browser-video-recorder:port`。423 与本地 227 的差额来自 node_modules/其他 bundle 的非业务调用，不再是“12 条别名未定”。

**静态 IPC 只有 3 条，暴露面却有 169 个成员。** 真实通道在 `out/preload/index.cjs`（90 次 `ipcRenderer.invoke/sendSync`）和 host RPC：

- `out/host/index.js` + `chunk-VH3XR3TF.js` 里有 `[rpc:call] ${channelName}.${method} OK (${ms})` / `[rpc:listen] ... subscribed` / `this.channels.get(e.channelName)`，说明是**自研命名通道 RPC**，不是 ipcMain。
- 同一个 host 里出现 `Windows runtime control closed before Job was confirmed empty`，紧邻 `T.once("error")`、`T.listen(n)`，说明 host 侧对 Windows Job Object 有“必须确认 Job 为空才允许关闭”的约束（jsmap `ev_8277c347…`）。注意：`resources\zcode-runtime-host.exe` 在本机不存在（native 取证的 `not_found`），所以这条是 **JS 层证据**，不是原生二进制证据。
- `zcode` 暴露 API 的成员表比 IPC 更能说明能力：`connectRemote`、`startWebRemoteControl` / `stopWebRemoteControl` / `getWebRemoteControlStatus`、`bindRemoteWorkspaceSessionContext`、`disposeRemoteSession`、`isDockerAvailable`、`listWSLDistros`、`listDockerContainers`、`listSSHConfigAliases`、`loadMcpFromUserDirectory` / `saveMcpToUserDirectory` / `migrateLegacyCommonMcp`、`selectDirectory` / `selectFiles` / `saveFile`、`printPageToPdf`、`ensureMicrophoneAccess` / `resetMicrophoneAccess`、`captureBrowserGuestPage`。
- 另有 `zcodePluginSandbox: supportsRetainedMove, setExecutionActive, copyImage, getOwnerWebContentsId, disposeSandbox, consumeUserGesture` 与 `cuaPermissionPanel: prepareDrag, startDrag, notifyDragEnded, onState`。

**插件沙箱是 JS 沙箱，不是 OS 沙箱。** `out/plugin-sandbox/` 下有 `plugin-sandbox-alias.js`、`calendar.js`、`gen-ui.js`、`vendor/d3-7.9.0.min.js`、`visualize.html#inline-2`，配合 `supportsRetainedMove`、`consumeUserGesture`，更像“保留 DOM/手势能力的渲染沙箱”；把它当进程沙箱会误判。

**核心**：`ZCode.exe` 246MB 是 Electron 壳（导入 1,284 / 129 安全导入，字符串仍是 Chromium）。真正的产品依赖在 package.json：`@zcode/server`、`@zcode/rpc`、`@zcode/provider`、`@zcode/provider-node`、`@zcode/services`、`@zcode/shared`、`@zcode/zcode-cua`、`@modelcontextprotocol/client|core|server|ext-apps`、`@napi-rs/keyring 2.1.2`、`node-pty 1.0.0`、`playwright-core 1.59.1`、`ssh2 1.16.0`、`@opentelemetry/*`（OTLP trace/metrics exporter）、`electron-updater 6.8.10`。

**后端/服务层**：`@zcode/server` + `@zcode/rpc` + `@zcode/services` 是服务化内核；`@zcode/rpc` 对应 host 的 `[rpc:call]/[rpc:listen]`。`@opentelemetry/exporter-trace-otlp-proto` 说明有 OTLP 遥测出口。`app-update.yml` 的 provider 是 `generic`，`url: http://localhost:8081` —— 更新源指向本机 8081，这是**本地更新代理**，不是公网 CDN（静态可见，运行时是否改写未知）。

**窗口安全**：10 个窗口里 6 个显式 `sandbox:true`，4 个 “sandbox not set”（继承默认），1 个 `webviewTag:true`，1 个 `webPreferences` 运行期计算。整体比 WorkBuddy 干净，但不如 Qoder 一致。

**证据锚点**：`ev_8277c347…`（jsmap）、`ev_45f1ddb1…`（ZCode.exe imports）、`ev_1b7ff43e…`（permission 字符串）、`ev_36e32080…`（签名）。

---

### 4.6 豆包（字节，Chromium 147 + Aha/Neotix 混合宿主）

**安装面**：`C:\Program Files\Doubao`，Launcher 2.0.32。`app\local_webcontents` 3,443 文件 / 615,752,388 字节；其中 `biz.pak` 196,549,135、`resources.pak` 14,760,956、`apps\doubao-office\doubao_office.pak` 119,619,240、`extensions\ai-views` 2,588 文件 / 153,044,370。`app\sbox` 7 文件 / 6,279,920 字节（`sbox_sdk.dll` 2,656,144、`x64\aiep_sbox.dll` 784,272、`x64\aiep_ipc.dll` 577,424、`run_helper.exe` 682,384，x86 全套）；`app\terminal_conpty`（`OpenConsole.exe` 1,066,296 + `conpty.dll` 109,920）。核心 DLL：`Doubao.dll` 335,086,992（15 个导出，含 `ChromeMain`）、`liblark.dll` 190,019,984、`cccreator.dll` 87,105,424、`mcp_helper.dll` 16,500,624、`agent_infra.dll` 10,776,976。主体签名：北京春田知韵科技有限公司（字节系）。

**前端是“扩展图 + 主应用图（三片）”，上一版只交了扩展图。**
第一张 `ev_e0abf81c…` 覆盖 `local_webcontents` 的直接文件（2,311/3,442，partial）：2,295 源模块 / 2,282 个 JS / 52,427 bundle 模块 / 398,481 函数 / 465,369 节点 / 1,473,627 边 / 4,552 endpoint（750 唯一）/ 85 路由 / 669 storage 键。这 2,282 个 JS 恰好是 `extensions\ai-views` 的全部，说明它不是“豆包全量”，是 AI 侧栏扩展。`local_webcontents` 3,443 个文件里只有 2,291 个 JS，图的 2,311 个 examined 已覆盖全部 JS；其余 1,131 个未解析是 CSS 747 / TXT 309 / SVG 57 / JSON 16 等资源，不是 JS 漏读。
第二张 `ev_313f5b47…` 才是主应用：解 `biz.pak` 的 10,029 个资源（7,837 JS / 1,125 CSS / 369 HTML / 212 SVG / 15 JSON / 460 二进制），单图 **9,797 模块 / 166,986 bundle 模块 / 881,872 函数 / 2,928,056 边 / 8,988 endpoint（1,231 唯一）/ 335 路由**；单图撞 1,000,000 节点硬上限（需求 1,615,501，丢 615,501）。随后按顶层目录拆三片重跑：`ahalets` 5,907 模块 / 832,342 节点 / 2,227,188 边 / 744,765 函数、`static` 3,597 / 628,680 / 1,821,726 / 519,774、`rest` 58 / 10,289 / 23,673 / 9,700；**合计 9,562 模块 / 1,471,311 节点 / 4,072,587 边 / 1,274,239 函数 / 8,973 endpoint / 335 路由**。**166,986 bundle 模块与单图完全相等**，三片 JS 源文件 4,182 + 3,597 + 58 = 7,837 与解包 JS 总数逐个对齐，JS 面无漏读；节点少 144,190 是 235 个单图额外计入的模块（资产/非 JS 口径）和跨片不生成跨文件边，不是新截断。`biz.pak` 的 7,837 JS 与 369 HTML 共 8,206 个文本资源，再加 ai-views 的 2,282 JS 与 entry/worklet/RPA，前端取证不再是 2,295 个模块的单图。
工具在 pak 图上报的 2 条 IPC 是 **假阳性**：`getScrollInfo`（`doubao-apps-framework.template.js:44` 的 `.invoke`）和 `postMessageSync`（`doubao-apps-api.template.js:1` 的 `.invoke`）都是 SDK 方法名，不是原生通道。

**IPC 一：Neotix ShellAPI 是真正的产品级原生桥（`ev_313f5b47…` / `ev_2ef855c8…`）。**
`Doubao.dll` 里嵌了完整的 `neotix/shell_api/js_sources/internal/core.js`，常量写得非常明确：`TOP_NAMESPACE='neotix'`、`TOP_CALLBACK='__neotix__callback__'`、`TOP_EVENT_EMITTER='neotixChannel'`、`SHELL_API_IPC_EVENT`、`SHELL_API_ASYNC_CALLBACK`、`SHELL_API_FUNCTION_CALLBACK`、`SHELL_API_RELEASE_CALLBACK`；C++ 侧对应 `shell_api_handler_frame.cc` 的 `HandleJSCallNativeMessage`。原生注册表按 `neotix::<namespace>::<method>` 命名，本轮从 `Doubao.dll` 抽出 **848 个唯一方法、98 个命名空间**：`cloudComputer` 48、`audioRecorder` 45、`computerUse` 34、`system` 32、`sandbox` 31、`ahalets` 27、`window` 26、`agentTask` 23、`fs` 23、`popupView` 23。前端有 **25,310 处 `neotix` 引用**、2,765 处 `globalThis.neotix/window.neotix`、**111 个字面量调用点覆盖 52 个方法**；其中 **50 个方法直接命中 848 项注册表**，2 个只存在于 JS 包装层（`audioRecorder.getSystemAudioCaptureAccess`、`audioRecorder.openSystemAudioCapturePermissionSettings`），在 `Doubao.dll`、`liblark.dll` 和同目录全部 DLL 里都没有同名原生符号；这两个由 IPC 四的 `ShellapiCommonError=8` 门控处理，不是未知通道。**原生通道 0 个未知；2 个版本门控方法 0 条未定。**

**IPC 二：LarkAPI.ipc 是跨 webview 的事件总线，41 个调用点全部可归因。**
宿主注入 `globalThis.LarkAPI.ipc`，浏览器 fallback 明确 `throw Error("not impl in browser")`；11 个方法 `connect/emit/emitWithReply/getCurrentId/getParentId/has/off/on/once/sendTo/sendToAll`。源码 41 个调用点：`DOC_IFRAME_REMOVE` 28 次、`DOC_IFRAME_PUSH` 7 次、`COMMAND` 4 次（`EXPORT_SIGNATURE_TO_DOCX` ×2、`CLOSE_MESSENGER_APP_CHAT_WINDOW_TABS`、`CLOSE_MESSENGER_URGENT_CARDS`）、`getCurrentId` 2 次；**3 个唯一通道、0 条未定**。其中 2 条 `sendTo(1,eN,{id:eT})` 的 `eN="COMMAND"`、`eT/eA` 两个 id 已在 `common/7e136582.js` 源码里回填。

**IPC 三：AppletBridge 是 Lynx native module 协议，不是桌面 IPC，259 个名字不是通道。**
`__doubao_web_sdk_native_modules/applet-bridge-module-core.js` 用 `{type:"call", name, params, callbackId}` 协议；`createAppletBridgeModule(e,t,r)` 的 `t` 是 Lynx 宿主注入的 `postMessage`，`applet-bridge-module.js` 由 Lynx runtime 按 JS 模块表加载，不是固定 Electron/Neotix 通道。前端字面量里抽到 **259 个 API 名（185 个 `doubao.*` + 74 个 `applet.*`）、659 次引用、145 个文件**，包括 `doubao.callMcpTool`、`applet.invokeTool`、`doubao.setStorage`、`applet.subscribeEvent`。这些是 Lynx 模块方法名，不是 IPC 通道；`Doubao.dll` 没有 `AppletBridgeModule` 字面量，是因为 Lynx 在运行期解析模块表，不是“原生缺失”。**对桌面 IPC 面增量为 0。**

**IPC 四：2 个 audio API 是能力门控，不是未知。**
前端 `static/js/async/nn.aff2f600a8.js` 的 `isUnsupportedSystemAudioCaptureError(o)` 明确判断 `o.name==="ShellapiCommonError" && o.value===8`；catch 后 `showSystemAudioPermissionToast("View_Doubao_Recording_SysAudioUnsupportedUpgrade_Toast")`。`2w.8a331f2839.js` 的 `system.getSystemAudioCaptureAccess` 是同一套调用。当前 `Doubao.dll` 的 `audioRecorder` 45 个原生方法里只有 `voixcapEnableSystemAudioCapture`、`voixcapGetSystemMediaDeviceInfo`，没有这两个新名字；旧原生会返回 8，前端降级成升级提示。同目录 `biz\env.json` 记录 `ScmProductionVersion=1.0.10.1222`、`ScmBuildCommitId=4253f776…`，而 `Doubao.dll` 里找不到这两个串，说明 web bundle 是独立构建。**这不是漏洞，也不是未知通道；它是前端 bundle 与原生 DLL 的版本门控，0 条未定。**

**后端层：本地 RPC、WebSocket、MCP、代理、PIP 五套都在。**
`Doubao.dll` 的 `agent_tool_ipc_named_pipe_transport.cc` 写明 Agent Tool RPC Server：命名管道 `\\.\pipe\aha-agent-tool-ipc-`、TCP fallback `127.0.0.1:<ephemeral>`、`AgentToolIpcAuthOnlyLocal`、开关 `enable-agent-tool-ipc`，并有 `OnPrimaryAcceptComplete` / `SchedulePrimaryListenerRecovery` 的降级恢复逻辑。`app_proxy_transport_websocket_server_socket_factory.cc` 在 `127.0.0.1` 起 WebSocket，走 `app_share_protocol` 的 HMAC 加密。`mcp_helper.dll` 有 `STDIO MCP initialize`、`OAuth loopback callback`、`HTTP startup lifecycle was retired`，说明 MCP 走 stdio，HTTP 只用于 OAuth 回调绑定。`secure-proxy-ipc64.dll` 要求 `pipe://NAME` 的 interceptor endpoint；`sbox\x64\aiep_ipc.dll`、`vm_sdk\x64\aiep_ipc.dll` 是 AIEP 沙箱 IPC 的两套构建。
PIP 是独立的一套：`pip_main.exe` 3,208,592 字节带 `aha_pip\src\pip_ipc\named_pipe_ipc_server.cc` / `named_pipe_ipc_client.cc`、`PipMainPipeName_{}`、`PipSDKPipeName_{}`、`PipRemotePipeName_{}` 三条命名管道族，并用 `GetNamedPipeClientProcessId` 校验对端；`pip_remote.dll`、`connect_to_shadow_session_client.cc`、`shadow_session_credential_precheck.cc`、`shadow_session_guard.cc`、`rdp_host.cc`、`credential_guard.cc`、`key_stroke.cc` 按文件名指向远程/影子会话、键鼠注入、凭据保护，和 `aha-agent-tool-ipc-`、Neotix ShellAPI 三条通道互相独立。运行态模块枚举（5.7）里 `AgentInfraProcess`（39808，45 个模块）已加载 `agent_infra.dll` 与 `pip_sdk.dll`，但 `pip_remote.dll` 未加载；命名管道侧 `PipMainPipeName_43814` / `PipSDKPipeName_50414` 存在，`PipRemotePipeName` 缺失。Main/SDK 在跑，远程会话启用条件与对端仍未验证。
helper 侧另有 `DoubaoLinkRouter.exe`（2,952,080，ProductName `Doubao Link Router` 2.37.16.0，Aha/Saman `link_router`，按 `doubao:/` / `doubaoap` 前缀在 `Doubao.exe` / `DoubaoWork.exe` 间分流，导入表无网络 DLL；不是 HTTP/WS 服务，详见纠正十五）、`file_search_host.exe`（3,093,904，`--agent-infra-host-config`）、`file_utils_host.exe`（4,985,232，同参数族）、`ghelper.exe`（4,161,424，`GhostHelperService` + `\\.\pipe\crashpad_%lu_`）、`ttdaemon.exe`（277,392，PDB 路径 `C:\79014\CCCreator\proj\cmake\sln_x64_Release\bin\Release\ttdaemon.pdb`，属 CCCreator 守护进程）、`Doubao_proxy.exe`（2,280,336，Chromium `147.0.7727.149` 进程启动/浏览器入口代理，非 HTTP 代理，详见纠正十六）、`Doubao_browser_proxy.exe`（2,409,872，同族 Chromium proxy/launcher）、`push_detect.exe`（191,376，签名有效、只导入 WinAppSDK bootstrap + `KERNEL32` / `ole32` / `OLEAUT32`，无产品字符串，仍按名疑似推送检测）；`file_*_host` 是 agent infra 的工具宿主，不是聊天 RPC 服务端。

**核心一：Doubao.dll 里嵌了 Deno 运行时权限模型。**
字符串 `third_party\deno\runtime\permissions\lib.rs`、`vdatetimepermission`、`NotFoundPermissionDenied...` 出现在 permission 主题命中里；同时导入层面有 1,613 个导入 / 153 个安全导入（`CreateRestrictedToken`、`CreateProcessWithTokenW`、`CreateProcessAsUserW`、`DuplicateTokenEx`、`CryptProtectData`、`LsaClose`、`SetFileSecurityW`）。
沙箱相关字符串是产品级命名：`IsSandboxedProcess`、`SandboxHelper`、`PROCESS_SANDBOX_HELPER`、`is_sandboxed`、`isSandboxed`（`ev_528b9f74…` / `ev_2ef855c8…`）。
网络栈痕迹：`hickory-resolver 0.25.2`、`encoding WINDOW_UPDATE`、`invalid WINDOW_UPDATE frame`、`recv WINDOW_UPDATE`（HTTP/2）、`RSASSA-PKCS1-v1_5 / RSA-PSS / ECDSA / AES-GCM / HKDF`（rustls/webpki 算法表）。这说明 Doubao.dll 不是纯 C++，而是 C++ + Rust 组件混合。

**核心二：agent_infra.dll 是“本地运行时策略引擎”。**
字符串直接给出 API 与字段：`local_runtime.runtime_policy`、`local_runtime:runtime_policy:get`、`local_runtime:instance_group:update_permission`、`runtime policy updated, probe_enabled={}, background_limit={}, user_env_timeout_ms={}, runtime_probe_timeout_ms={}, probe_startup_timeout_ms={}`、`sandbox.network_config`、`sandbox.internal_config`、`sandbox_network_audit`、`local_runtime.sandbox_switch_config`、`local_runtime:is_support_no_sandbox`、`sandbox_instance_create`（`ev_5eefd5c0…`）。
这是一套可热更新的本地运行时策略：网络配置、沙箱开关、探测开关、后台并发限制、超时预算都在策略里。**“is_support_no_sandbox” 这个键说明产品允许按环境关闭沙箱**，这是设计选择，不是漏洞。
补证：`LocalRuntimeModule::UpdateSandboxSwitchConfig` 的 JSON 结构字段是 `sandbox_switch_enabled` / `health_records`，云配置节名是 `saman_sandbox_switch_config`，总节是 `saman_sandbox_config`；错误路径明确写 `sandbox switch config property rejected, json_bytes={}`。本地 DLL 只有 schema 与更新入口，没有默认布尔值；默认值来自云配置或调用方，未运行验证。

**核心三：mcp_helper.dll 是 MCP 进程宿主，用 Job Object 托底。**
字符串：`process-wrap-9.1.0\src\tokio\job_object.rs`、`JOB_OBJECT_LIMIT`、`wait`、`MCP server executable permission denied`、`OAuth session has no credential checkpoint`、`failed to checkpoint OAuth credentials`、`OAuth credentials rejected; closing the expired MCP session`、`sse stream terminated, no reconnect policy`。
导入：`CreateJobObjectW`、`AssignProcessToJobObject`、`SetInformationJobObject`、`TerminateJobObject`、`SetNamedPipeHandleState`、`CertVerifyCertificateChainPolicy`。它既管 MCP 子进程生命周期，也管 MCP OAuth 凭据检查点。

**跨产品发现（本轮新证据）**：豆包的 `app\sbox\` 与 Trae 的 `resources\app\modules\sandbox\` 是**同一套 aiep 沙箱 SDK 的不同构建**——文件名完全同构（`sbox_sdk.dll`、`aiep_sbox.dll`、`aiep_ipc.dll`、`run_helper.exe`），豆包 sbox_sdk 2,656,144 / 2.1.17.0、Trae 2,320,272 / 1.16.0.0。这不是巧合，说明字节系两个产品共享 sandbox 供应链。

**证据锚点**：`ev_e0abf81c…`（ai-views jsmap）、`ev_313f5b47…`（biz.pak 单图 jsmap）、`analysis\doubao-pak-shards.json`（ahalets/static/rest 三片统计与差账）、`ev_528b9f74…` / `ev_2ef855c8…` / `ev_5eefd5c0…`（三个 DLL overview）、`analysis\doubao-ipc-final.json`（848 项 Neotix 注册表 + 41 条 LarkAPI + 259 个 applet API）、`_work\doubao_helpers_scan.py`（9 个 helper exe 的字符串扫描，可复现 PIP/agent_infra/crashpad 证据）。

---

### 4.7 DeepSeek Harness（DeepSeek，Electron + cordis 插件内核）

**安装面**：`C:\Apps\DeepSeekHarness`，0.2.2-rc.5；`DeepSeek Harness.exe` 246,341,104；`resources\app.asar` 209,083,008；20,300 个列出文件；26 个 native 模块。

**前端（`ev_ce7bcd8d…`）**：只有 **17 个源模块** / 633 个 JS 文件 / 2,778 函数 / 3,129 节点 / 5,931 边 / 17 条 endpoint / 5 个窗口 / 11 个暴露键。`bundle_modules = 0`，说明它不是 webpack 千 chunk 结构，而是“少量大模块 + 插件装配”。

- `lib/main.js`：38 个 `ipcMain.handle`、5 个 `ipcMain.on`。
- `lib/preload-app.cjs`：28 个 `ipcRenderer.invoke`、7 个 `contextBridge.exposeInMainWorld`；`preload-welcome.cjs` 8 个 invoke；`preload-mandatory.cjs` 1 个 expose。
- **静态 IPC 表为 0，工具记 142 条；源码逐文件只有 116 个 ipc 调用点**。`lib/main.js` 内联的 `DESKTOP_IPC` 对象把 34 个通道名映射为 `dsh-desktop:*`（`fileSave` → `dsh-desktop:file-save`、`clipboardImageRead` → `dsh-desktop:clipboard-image-read` 等）；`ipcMain.handle(DESKTOP_IPC.fileSave, ...)` 被工具按“非字面量首参”记成 dynamic。102 条业务调用（43 主进程 + 59 preload/renderer）落到 **54 个唯一通道**：`DESKTOP_IPC` 34、`PLATFORM_IPC` 5、`WELCOME_IPC` 9、`MANDATORY_IPC` 3、`UPDATE_DIALOG_IPC` 3；另 14 条是 `removeHandler/off` 解绑清理。142 = 102 条业务调用 + 40 条工具侧重复条目（与 40 个 `ipcRenderer.invoke` 数量一致，源码中不存在第 103–142 个独立调用点）；2 个 `removeHandler(channel)` 是通用解绑函数的形参，不是新通道，未发现任何运行期字符串拼接。
- 暴露键：`dsh`、`dshDesktop`、`dshDesktopBoot`、`dshPlatform`、`dshUpdateDialog`、`dshMandatoryUpdate`、`dshWelcome`、`dshOnboarding`、`__DSH_DIRECTORY_PICKER__`、`__DSH_HOST_PATHS__`、`__DSH_LOCALE__`。
- 窗口：1 个 `WebContentsView` 显式 `contextIsolation:true / nodeIntegration:false / sandbox:true`；2 个 `BrowserWindow` 的 `webPreferences` 运行期计算（`ev_ce7bcd8d…`，windows 段）。

**依赖即架构**：`@deepseek-ai/cordis`（插件/依赖注入内核，workspace 版本）、`@deepseek-ai/dsh-api-gateway`、`ws 8.21`、`electron-updater 6.8.9`、`semver`。`dsh-api-gateway` 是 API 网关，`cordis` 是插件容器；**17 个模块承载 54 个常量通道（5 张表）**，插件仍可能在运行期注册，但 142 条计数不是“插件拼接”的证据。

**后端/服务层**：本地 endpoint 有 `ws://127.0.0.1/*`、`wss://127.0.0.1/*`，说明主进程与渲染/插件之间存在 **loopback WebSocket** 通道（具体端口运行期决定）。`dsh-api-gateway` 负责对外 API 聚合，cordis 负责插件生命周期；两者都不是 Electron IPC。

**核心（已补录）**：`DeepSeek Harness.exe` 实测 1,284 个导入 / 129 个安全导入，字符串全是 `cppgc::`、`gin::`、`node:electron/js2c/sandbox_bundle`、`enable-sandbox` 这类 Electron 内置；签名主体 Hangzhou DeepSeek Artificial Intelligence Co., Ltd.（有效）。**结论：没有产品级原生沙箱/权限证据**，产品能力在 cordis 插件与 JS 主进程（38 个 `ipcMain.handle`、116 个 ipc 调用点、102 条业务调用/54 个常量通道；142 为工具重复计数）。上一版若用这个 exe 的导入证明“DeepSeek 有沙箱”，同样属于框架级误判。

**证据锚点**：`ev_ce7bcd8d…`（jsmap）。

---

### 4.8 OpenCode（Electron 客户端 + 独立 CLI 后端）

**安装面**：`C:\Users\Administrator\AppData\Local\Programs\ai.opencode.desktop`，2.2.7；`OpenCode.exe` 246,614,920；`resources\app.asar` 240,859,491；`resources\opencode-cli.exe` **265MB**（比主程序还大）；4 个 native 模块。

**前端（`ev_381f0a96…`）**：3,231 源模块 / 5,940 JS 文件 / 39,462 函数 / 46,281 节点 / 80,579 边 / 289 endpoint（156 唯一）/ 3 窗口 / 3 条静态 IPC（1 配对）/ 5 动态（5 已归因/0 未定）/ **只有 1 个暴露键 `electron`（5 个成员）**。
`out/preload/index.cjs` 只有 1 次 `ipcRenderer.invoke` 与 1 次 `exposeInMainWorld`——这是一个**刻意收窄的 preload 面**，和前几个产品动辄 80 个暴露键形成对比。

**5 条动态全部落回已有静态通道，没有新增面**：`out/main/desktop-BIxuCyvr.js` 的 `webContents.send(vi)` 与 `webContents.postMessage(Vr)`，分别对应 `opencode:drag-cancel`（Escape 键）与 `desktop-rpc-port`（MessageChannel `port2` 转移）；`out/preload/index.cjs` 的 `ipcRenderer.on(t)`、`on(n)`、`invoke(r)` 三个绑定在文件第 1 行写明 `t="desktop-rpc-port"`、`n="opencode:drag-cancel"`、`r="desktop-window-snapshot"`。主进程两个常量与 preload 两个监听互为配对，说明工具只看到别名、没看到跨文件配对；**3 个唯一通道全部已在静态表里，0 个未知通道**。

**核心：`opencode-cli.exe` 是 Bun 编译的单文件 JS 运行时，不是 Rust/Go。**
本轮补做了 CLI 的原生取证：41,058 函数 / 200,682 字符串 / 1,284 导入（59 个库），函数表在 6,000,000 条指令处截断（`ev_9f220b64…`）。字符串里同时出现 `JSBundlerPlugin__create returns a non-null protected JSCell` 与 `this indicates a bug in Bun. Please file a GitHub issue.`，以及 ngtcp2/QUIC 常量（`CC_ALGO_BBR`、`DEFAULT_MAX_STREAMS_BIDI`、`TLS_AES_128_GCM_SHA256`）——**Bun + 内置 QUIC/HTTP3 栈**。
签名主体 **Anomaly Innovations, Inc.**（`C=US, ST=Delaware, L=Dover`，Microsoft ID Verified CS AOC CA 03，有效期 2026-11-08 → 2026-11-11，`signature_check: valid`）。

**后端：4096 是“Add Server”对话框的默认占位 URL，不是内置服务端口。**
- 直接对 `app.asar` 做字节级检索，`localhost:4096` 只命中 i18n 文案 `dialog.server.add.placeholder`（值为 `http://localhost:4096`），并在多语言包里重复——这正好解释了 jsmap 里为什么会有 62 次（`ev_381f0a96…` 的 local_urls 段把 i18n 值当成了 endpoint）。
- CLI 侧定向字符串只命中 `ws://127.0.0.1:`、`http://localhost:`、`tcp:localhost:` 这些**模板**，以及 `http://localhost:3000/`（打包进来的 web 内容噪声）；**没有命中字面端口 4096**（`ev_1360868c…`）。所有 `4096` 命中都是 `DigiCert TLS RSA4096` 与 `base_offset.is_multiple_of(4096)`，与端口无关。
- 结论：桌面端是“可连接远端/本地 OpenCode server 的客户端”，4096 只是新建服务器时的建议值；**没有证据证明桌面端会自动在 4096 启动本地服务**。
`hosts` 里还有 `opencode.ai(50)`、`github.com(103)`、`chatgpt.com(3)`、Sentry ingest 域名，说明桌面端同时对接云端与本地。

**桌面端怎么启动 CLI：`serve --service`（本轮补证，asar 解包目录）**：
- `out\main\desktop-BIxuCyvr.js` 里命令是 `[...n.cli.command, 'serve', '--service', ...(isolated ? ['--hostname','0.0.0.0','--port','3084'] : [])]`。
- `out\main\main-BjYxL5qW.js`（WSL 分支）拼的是 `... --log-level ... serve --hostname 0.0.0.0 --port ${i}`。
- `out\main\index.js` 里另有 `desktop-rpc-port`，说明桌面↔CLI 还有一条 RPC 通道。
- 结论更新：**桌面端确实会拉起 `opencode-cli serve`**；隔离模式固定 3084 且绑 `0.0.0.0`，普通模式端口由上层分配。4096 与这个启动链路无关，仍只是 Add Server 占位。

**运行验证（本轮补证，不是静态推测）**：
- `opencode-cli.exe --version` 返回 `opencode v2.2.7`；`serve --help` 明确列出 `--hostname`、`--port`、`--cors`（可重复）、`--service`、`--stdio`，以及全局 `--log-level` / `--print-logs`。
- 以隔离的 `XDG_STATE_HOME` 启动 `serve --service --hostname 127.0.0.1 --port 4601`，6 秒后 `GET /` 返回 **200 / 9,162 字节 / text/html**，是 v2 Web UI；`GET /api` 与 `GET /openapi.json` 均返回 **401**，说明 API 鉴权生效，不是裸奔。`/config`、`/session`、`/health` 等未注册路径返回同一个 SPA HTML（200），是前端 fallback，不能当成真实 API。
- 普通 `serve`（不加 `--service`）在 stdout 打印 `server listening on ...` 与一次性 `server password ...`；`--service` 模式只打印监听地址，未观察到密码行——**桌面端用什么方式把凭据交给服务端，仍未闭环，标未知**。
- 三个测试进程均已被杀，4599/4600/4601 端口确认关闭；全程只发 GET，没有调用写接口。记录在 `out\deep\native\opencode\runtime-serve.json`。

**依赖极简**：`@zip.js/zip.js`、`electron-context-menu`、`electron-log`、`electron-updater 6.8.9`、`lighthouse 13.4.1`。Lighthouse 说明内置了页面审计/性能评分能力，不是纯聊天壳。

**窗口安全**：主窗口显式 `contextIsolation:true / nodeIntegration:false / sandbox:true`；另 2 个窗口 `webPreferences` 运行期计算（`ev_381f0a96…`）。

**一句话结论**：OpenCode 是“薄桌面壳 + 厚 Bun CLI 服务”的结构；前端只暴露 1 个键，真正的工具/会话能力在 CLI 侧，且 CLI 是 Bun 单文件运行时——这解释了它为什么能把 265MB 全部塞进一个 exe。

**证据锚点**：`ev_381f0a96…`（jsmap）、`ev_9f220b64…`（CLI overview）、`ev_1360868c…`（CLI loopback 字符串）、`ev_ed6cc047…`（CLI `--port` 字符串）；`serve` 启动参数来自 asar 解包目录的 `out\main\desktop-BIxuCyvr.js`、`out\main\main-BjYxL5qW.js`、`out\main\index.js`（文件级证据，非 ev_id）。

---

### 4.9 MiniMax Code（MiniMax，Electron + 多平台 Agent）

**安装面**：`C:\MiniMax Code`，3.1.14.220；`MiniMax Code.exe` 235,418,560；`resources\app.asar` **371,919,371**；19 个 native 模块；另有 `resources\resources\computer-use\0.34.1\win32-x64\minimax-computer-use.exe`（34.9MB）与 `resources\app.asar.unpacked\node_modules\@minimax\mcode-sandbox-runtime\vendor\srt-win\x64\srt-win.exe`（3.08MB）。

**前端（`ev_07220c3a…`）**：1,391 源模块 / 1,860 JS 文件 / 5,159 bundle 模块 / 112,679 函数 / 124,372 节点 / 330,508 边 / 1,887 endpoint（1,394 唯一）/ 10 窗口 / 54 条静态 IPC（25 配对、14 仅 invoker）/ **816 条动态** / 35 个暴露键 / **373 个暴露成员**。

**816 条动态已收口**：`dist/main/config/constants.js` 的 `IPC_CHANNELS` 有 380 个键、`WEBVIEW_HOST_CHANNELS` 有 7 个键；`ipcMain.handle(constants_js_1.IPC_CHANNELS.X, ...)` 被工具记成 dynamic。逐文件还原后，主进程 **332 条**（原 326 + 6 条变量）、renderer **406 条**（原 398 + 8 条变量），源码共 **804 个调用点、0 条未定**。6 条主进程变量的落点：`devtools.ipc.js` 的 `channel` 是 `DEVTOOLS_OPEN/DEVTOOLS_TOGGLE` 循环（`devtools:open`/`devtools:toggle`），`channels.confirmQuitChannel`→`app:confirm-quit`，`channels.bringToFrontChannel`→`app:bring-to-front`，`input.channel`→`observability:startup-milestone`；8 条 renderer 变量全部在 `miniapp-host-preload.js` 的 `invoke(channel)` 调用点，落到 `miniapp:host-get-state`、`miniapp:host-subscribe`、`miniapp:host-open`。816 与 804 的 12 条差额是工具侧重复条目，不是 12 个未知通道。

IPC 分组一眼能看出四条业务线：

- **computer-use**：`cu:permission:request`、`cu:permission:status`、`cu:permission:required`、`cu:preview:desktopPermission`、`cu:preview:inspect`、`cu:preview:openDesktopPermissionSettings`、`cu:permission:guide:drag`。这是一套**桌面权限申请/引导/预览**通道，对应 Windows 屏幕捕获与输入注入。
- **内嵌浏览器**：`browser-webview:agent-pointer`、`interaction`、`prepare-native`、`snapshot`、`native-ready`、`applied`；`embedded-browser:agent-cursor-event`、`comment-bridge-event`。浏览器不是简单 iframe，而是带 agent 光标与快照的原生视图。
- **小程序容器**：`miniapp:agent-open/reply/observe/session/sessions/tool-request/speech-transcribe`、`miniapp:composer-append`、`host-unsubscribe`。这是一套“小程序 as agent tool”的协议。
- **模型菜单/PPT 预览**：`model-menu-popup:*`、`ppt-preview-render:prepare/ready/result`。

**后端/服务层**：`@mavis/local-runtime-v2` + `handleLocalRuntimeRequest` 构成一个**进程内本地 API**：

- 调用点直接写 `new Request('http://127.0.0.1/minimax-desktop/api/v1/file/git/invalidate-all', { method:'POST' })`、`http://127.0.0.1/minimax-desktop/api/v1/session/${sessionId}/files?limit=...`、`http://127.0.0.1/minimax-desktop/api/v1/session/${sessionId}`（`ev_07220c3a…` 来源模块 `lifecycle/workspace-git-resume.js`、`modules/document-preview/workspace-authority.js`）。
- 这不是监听端口，而是 **Request/Response 对象在进程内路由**；但它把接口路径、分页参数、方法都显式化了，等价于一套内部 REST。
- 远端：`wss://agent.minimax.cn`（18 次）、`wss://agent.minimax.io`、`wss://matrix-overseas-test.xaminim.com`、`ws://mcode.local/`。
- IM 集成：依赖表里有 `@slack/socket-mode`、`@slack/web-api`、`discord.js`、`@wecom/aibot-node-sdk`、`grammy`（Telegram）。说明 MiniMax Code 支持把 Slack / Discord / 企业微信 / Telegram 当消息入口。
- `@mavis/oauth-core` + `oauth-lease-protocol` + `remote-control-bridge`：OAuth 租约与远程控制桥。

**核心**：`srt-win.exe` 是 **Rust 沙箱运行时**（16 crate：`rusqlite 0.32.1`、`windows 0.62.2`、`serde_json`、`clap`、`hashbrown`），说明沙箱状态落 SQLite、Win32 调用走 windows-rs（`ev_329fd74c…`）。`minimax-computer-use.exe` 是 CUA 驱动，与 `@trycua/cua-driver 0.34.1` 对应。
主程序 `MiniMax Code.exe` 本轮补做原生取证：40,796 函数 / 200,691 字符串 / 1,274 导入（58 库），**PE 头里 `pdb_path: electron.exe.pdb`**——这是“Electron 壳”的硬证据，不是推测；签名主体 上海稀宇科技有限公司（`signature_check: valid`）（`ev_bf548618…`、`ev_6cb39bcb…`）。所以 MiniMax 的产品级原生能力只有 `srt-win` / `minimax-computer-use` 两个 helper，主 exe 的 Win32 导入（`CRYPT32`、`WS2_32`、`WINTRUST`、`UIAutomationCore`）属于 Electron/Chromium 出厂依赖。

**窗口安全**：1 个窗口开启 `<webview>` tag，4 个 `webPreferences` 运行期计算，其余未显式设置（`ev_07220c3a…`）。

**证据锚点**：`ev_07220c3a…`（jsmap）、`ev_329fd74c…`（srt-win Rust 指纹）、`ev_bf548618…`（主 exe overview/PDB）、`ev_6cb39bcb…`（主 exe 导入）。

---

### 4.10 商汤小浣熊（SenseTime，Electron + Python ACP Runtime）

**安装面**：`C:\Apps\浣熊`，1.2.3；`商汤小浣熊.exe` 222,902,112；`resources\app.asar` 362,460,116（345.7MB）；11 个 native 模块。`resources` 下还有一整套外置运行时：`box-agent-runtime`、`browser-gateway`、`browser-tools`、`connectors`、`conversation-skills`、`team-document-skills`、`default-pets`、`hyperframes-assets`、`pandoc`、`rg`、`7za`、`elevate.exe`。

**前端（jsmap `ev_fb77c73a…`）**：1,886 源模块 / 1,965 JS 文件 / 5,004 bundle 模块 / 109,542 函数 / 121,089 节点 / 1,819 endpoint（1,355 唯一）/ 10 窗口 / 95 条静态 IPC / **38 条只有 handler、没有检测到调用方** / 2 条仅 invoker / 26 条动态（34 个非字面量/0 未定）/ 20 个暴露键。

**26 条动态已逐文件重建**：源码里 34 个非字面量 IPC 调用点，其中 **16 个常量/数组项落到 11 个固定通道**（`runtime:progress`、`app-update:status`、`desktop-shell:status`、`desktop-theme:changed`、`desktop-client:windows-menu`、`desktop-client:appshot:start-app-drag`，加 5 条 `app-update:*` 操作通道），3 个模板记录形成 **2 个族**（`desktop-client:feedback-{info,submit,export-logs}` 与 `desktop-browser-overlay:${owner}`），1 个 `VOICE_INPUT_CHANNELS` 清理循环覆盖 **7 条 `voice-input:*`**，剩下 **14 个是 helper/cleanup 形参**，不是独立通道。34 与 26 的 8 条差额正是 `removeHandler/removeListener` 清理与 helper 形参被工具排除；**0 个未知通道**。

IPC 分组说明它是“能力市场型”客户端：

- `appshot:*`：`capture`、`capture-result`、`get-permission-status`、`get-settings`、`save-settings`、`open-permission-settings`、`request-accessibility-permission`、`request-screen-capture-permission`、`start-hotkey-helper`、`reveal-app-bundle`、`start-app-drag`。这是一套**截图 + 屏幕捕获/辅助功能授权**的完整通道（命名是 macOS 风格，Windows 上做等价映射）。
- `branding:get-config / save-config / reset-config / updated`：可换品牌配置。
- `connectors:connect / disconnect / cancel-connect / get-configs / get-states / set-enabled`：连接器生命周期。
- `browser-tools:install-progress`、`chromium-runtime:progress`、`computer-use:install-progress`、`experts-install-progress`、`scenario-install-progress`、`skill-market-install-progress`：五套“按需安装”的运行时/能力包。
- `desktop-client:*`：new-task、language-updated、sync-zoom、skill-navigation 等壳层消息。

**核心：`box-agent-acp.exe` 是 PyInstaller 打包的 Python 3.12 应用，不是 Rust/Go。**
`resources\box-agent-runtime\bin\` 下有 `python312.dll` 6.66MB、`python3.dll`、`base_library.zip` 1.27MB、`_internal\*.pyd`（`unicodedata.pyd`、`_decimal.pyd`、`_ssl.pyd`、`_sqlite3.pyd`、`_cffi_backend.cp312-win_amd64.pyd`）、`libcrypto-3-x64.dll` 7.62MB、`libssl-3-x64.dll`、`sqlite3.dll`，以及 `bin\skills\theme-factory\theme-showcase.pdf`。
`native-rust-binary-show`（`ev_490fb87d…`）与 `native-go-binary-show`（`ev_c063900c…`）都返回“无指纹”，与 PyInstaller 结构吻合。`native-strings-find` 直接命中 PyInstaller 装载器字符串：`[PYI-%d:%s]`、`_MEIPASS`、`%s\base_library.zip`、`Could not load PyInstaller's embedded PKG archive`、`PyInstallerOnefileHiddenWindow`（`ev_56df0946…`）——**onefile 打包，运行时解包到 `_MEI%d` 临时目录**。

**运行时清单（`resources\box-agent-runtime\manifest.json`，本轮新发现）**：

- `mode: standalone`、`platform: win32`、`arch: x64`、`entry: bin/box-agent-acp.exe`；
- **`external_python_sandbox: true`**——产品自己声明“外部 Python 沙箱”；
- `mcp_servers.box-agent-web-extract`：`entry: bin/box-agent-acp.exe`、`args: ["--web-extract-mcp"]`、`transport: stdio`——**同一个 exe 既是 ACP agent runtime，又是一个 stdio MCP server**；
- `config\` 下带 `analysis_prompt.md`、`code_prompt.md`、`system_prompt.md`、`config-example.yaml`、`isolated-profile-example.yaml`、`mcp-example.json`——提示词与隔离 profile 都是外置可改的；
- `bin\_internal\IPython\` 说明内置 IPython 内核，不只是“能跑 Python 脚本”。

这解释了为什么它有 `box-agent-runtime\skills\` 这种目录——ACP runtime 自己带技能包，且用 manifest 声明能力边界。

**后端/服务层**：`browser-gateway`、`browser-tools`、`connectors` 三个外置目录对应前端的三类 IPC；`box-agent-acp` 是 Agent Client Protocol 的运行时宿主（进程外）。这属于“主进程 + 外置 Python runtime”的双层结构，不是纯 Electron。

**窗口安全**：1 个窗口 “sandbox not set”，4 个 `webPreferences` 运行期计算，1 个 `<webview>` tag（jsmap `ev_fb77c73a…`，windows 段）。

**证据锚点**：`ev_fb77c73a…`（jsmap）、`ev_56df0946…`（PyInstaller 字符串）、`ev_490fb87d…`（Rust 无指纹）、`ev_c063900c…`（Go 无指纹）。

---

### 4.11 Cursor（Anysphere，VS Code fork + Rust sandbox-helper）

**安装面**：`C:\Users\Administrator\AppData\Local\Programs\cursor`，3.27.22；`Cursor.exe` 235,483,944；`resources\app` 21,000 文件 / 704MB；34 个 native 模块，其中 `file_service.node` 44MB、`crepectl.exe` 23.7MB；`resources\app\resources\helpers\cursorsandbox.exe` 3.3MB。

**前端（`ev_f48ad437…`）**：830 源模块 / 1,863 JS 文件 / **10,850 bundle 模块** / 300,113 函数 / 319,057 节点 / 681,140 边 / 3,730 endpoint（1,511 唯一）/ 13 窗口 / 33 条静态 IPC（12 配对、2 仅 invoker）/ 45 条动态 / 21 个暴露键（11 个成员）。
目录结构：`molten/` 482 个模块（Cursor 自己的 Electron 主进程宿主层），`extensions/` 288 个（VS Code 扩展宿主），`out/` 60 个。

45 条动态已逐文件重建（777 个非 `node_modules` JS 文件）：**44 个 Electron IPC 调用点**——15 个 `ipcMain`、17 个 `ipcRenderer`、11 个 `webContents.send`（10 动态 + 1 字面量 `vscode:runAction`）、1 个 `webContents.postMessage`（`e.responseChannel`）。43 条非字面量里 **29 条落到 20 个唯一通道**、12 条是 wrapper/helper 形参、1 条 `event.data` 受 `window.message` 的 4 个常量守卫（`molten:engine-port-request` / `molten:pty-host-port-request` / `molten:pty-host-port-if-running` / `quit-ready`）、1 条 `e.responseChannel` 是运行期 payload 通道，**0 个未知通道常量**。工具 45 与源码 43 的 2 条差额来自 `extensions/ms-vscode.js-debug` 里非 Electron 的 WebSocket `.send` 被泛化匹配（该扩展有 6 处这类 `.send`，均属 CDP/ws 传输）。
`molten/` 的通道面很窄，只有 crash-report、prefs-boot-sync、四个 port-request、desktop/engine/pty 三条端口回传、power-state、quit 三段握手（confirm/agents/ready）和 renderer 心跳；真正宽的是 VS Code 继承下来的 `vscode:*` 与 `cursor-isolated-eval`。

**核心：cursorsandbox.exe 是产品级 Rust 沙箱，不是 Electron 自带。**
签名 Anysphere, Inc.，Rust 源码路径 `packages\sandbox-helper\native\sandbox\src\main.rs`，字符串给出策略模型：

- `internally tagged enum SandboxPolicy`
- `workPolicyStrict`、`networkPolicy`、`networkPolicyStrict`、`system`、`workspace`
- `sandbox: policy strict enabled; network access disabled`
- `sandbox: network policy provided but network_access is false`
- `Error: Failed to apply sandbox:`

导入只有 3 个安全项（`CreateProcessW`、`NtCreateNamedPipeFile`、`WSACleanup`），说明它不靠 Win32 token API 硬编码，而是以“策略枚举 + 网络开关”驱动（具体限制手段静态未解析，标未知）。

**前端能力面**：暴露键是 molten 前缀的 9 个（`moltenCrashReport`、`moltenShell`、`moltenPrefs`、`moltenBootPrefs`、`moltenBootThemes`、`moltenBootKeybindings`、`moltenBootTerminalSettings`、`moltenBootChatMaxWidth`、`moltenBootScreenReader`、`moltenBrowser`、`moltenPerf`、`moltenUpdate`、`moltenHostedShell`、`moltenProcessMemory`、`moltenSystemVersion`、`moltenHomeDir`、`moltenPathForFile`），加上两个 `vscode` 与 `cursorPasskey`。`cursorPasskey` 明确指向凭据/密钥能力；`extensionHostWorkerMain.js` 里 `keyring` 相关命中 349 次（VS Code secret storage 的 keyring 实现）。
`molten/` 的存在说明 Cursor 把 VS Code 的 workbench 包了一层“molten 宿主”，这与 Trae 的 icube 浮窗是两条不同路线。

**后端/服务层**：`extensions/` = VS Code extension host；`file_service.node` = 独立文件服务；`crepectl.exe` = Cursor 的辅助控制进程；`agent-host-daemon` 相关模块（`daemon` 命中 8 个）说明有常驻 agent host。本地 endpoint 里 `http://localhost:8787/callback`（11 次）是 OAuth 回调，`http://127.0.0.1:9229/json/list` 是调试端口探测，`http://*.cursor.localhost:8001/*` 是本地代理规则。

**窗口安全**：13 个窗口里 5 个 `contextIsolation`/`nodeIntegration` 未显式设置（继承 Electron 默认），5 个 `webPreferences` 运行期计算，2 个 `sandbox` 未设置。这是本轮 Electron 产品里“显式声明率”较低的一档。

**证据锚点**：`ev_f48ad437…`（jsmap）、`ev_fa784c06…`（Cursor.exe imports）、`ev_a5595fe7…`（签名）。

---

## 5. 横向专题：谁真的有产品级能力

这一节只回答一个问题：**把 Electron/Chromium 自带的东西剥掉之后，每个产品还剩下什么。**

### 5.1 权限与审批模型

| 产品 | 权限表达 | 审批/确认 | 执行约束 | 归因 |
|---|---|---|---|---|
| Codex | `execpolicy` 规则 + `LegacyPermissionProfile` / `TaggedPermissionProfile::{Managed,External}` + `NetworkPermissions` + `SerializedManagedFileSystemPermissions::Restricted` | 字符串含 `request_permissions`、`sandbox_approval`、`mcp_elicitations` | 受限 token + process job + WFP + 专用 SID/ACL | 产品级（Rust） |
| WorkBuddy | `SandboxPaths.session(<id>).permission_file` / `permission.json` | `approval.callbackAddress` 反向通道、`approvedByUser`、approval/backup/restore 三队列 | Job Object + 命名管道 ACL + `GetNamedPipeClientProcessId` | 产品级（Rust） |
| Trae | `SandboxConfigPermissionObjectWireRef`、`process_policy`、`TRAE_SANDBOX_NEW_PERMISSION` | 工具宿主 `approval` 语义 + `PermissionDenied` | Job Object + Named Pipe + SSPI + `port_policy` 白/黑名单 | 产品级（Rust/C++） |
| 豆包 | `local_runtime:instance_group:update_permission`、`local_runtime.runtime_policy` | 策略字段 `probe_enabled/background_limit/user_env_timeout_ms` | `PROCESS_SANDBOX_HELPER`、`IsSandboxedProcess`、`aiep_sbox` | 产品级（C++/Rust） |
| Cursor | `internally tagged enum SandboxPolicy`、`workPolicyStrict`、`networkPolicyStrict` | 未发现审批字符串 | `CreateProcessW` + 策略驱动（细节未知） | 产品级（Rust） |
| MiniMax | `cu:permission:request/status/required`、`cu:preview:desktopPermission` | 桌面权限引导/设置 | `srt-win.exe`（Rust + SQLite） | 产品级（Rust） |
| ZCode | `zcode:cua-permission-panel-state`、`zcodePluginSandbox` | CU 权限面板 | host 侧 Windows Job 控制（“Job was confirmed empty”） | 产品级（JS/宿主） |
| 小浣熊 | `appshot:get-permission-status`、`request-screen-capture-permission`、`request-accessibility-permission` | 系统设置跳转 | `box-agent-acp.exe`（Python 3.12） | 产品级（Python） |
| Qoder | 无产品级权限字符串；窗口 `sandbox:true` | 未发现 | Electron 默认 + application-server | **框架级/未知** |
| DeepSeek | 无产品级权限字符串；142 工具计数 → 102 条业务调用/54 个常量通道，14 条解绑清理 | 未发现 | Electron 默认 + cordis 插件 | **框架级/未知** |
| OpenCode | 暴露面极小；`SandboxPolicy` 未在桌面包发现 | 未发现 | 推测在 CLI（未闭环） | **未知** |

### 5.2 沙箱实现谱系

- **“受限令牌 + 作业对象 + 网络过滤”派**：Codex 最完整。专用用户/SID（`convert SID failed`、`write sandbox users file`）、`Local\CodexSandboxReadAcl`、WFP provider `Codex Windows Sandbox WFP`、`spawned ConPTY is missing its process job` 四处互相咬合；常驻执行器是 `codex-windows-sandbox-service.exe`（62,953,264，运行 PID 33980），`sandbox-setup.exe` 只是供给器；前者还是 `LocalSystem` 自启动 packaged 服务 `CodexSandboxService.OpenAI.Codex`，`AU` 只有启动/查询权，没有停止/改配置权。标准 PE 解析是 24 DLL / 415 函数，含 `ws2_32` 37、`fwpuclnt` 11、`winhttp` 4、`netapi32` 8、`userenv` 4、`user32` 3、`wtsapi32` 4；运行态存在 `OpenAI.CodexSandbox...` / `codex-app-tools...` 命名管道，但该进程当前无 TCP/UDP 端点；服务管道 ACL 显式 Deny `CodexSandboxUsers`、Allow `INTERACTIVE` 读写，靠 `ImpersonateNamedPipeClient` 区分调用方（5.9）。
- **“会话权限文件 + 审批中心”派**：WorkBuddy。cli 只负责把进程塞进 Job Object，center 负责管道 ACL 与审批反向通道，`aes/argon2` 保护审批票据。
- **“共享 SDK”派**：Trae 与豆包都装 `aiep_sbox.dll` / `aiep_ipc.dll` / `run_helper.exe` / `sbox_sdk.dll`，但版本不同：Trae `sbox_sdk` 1.16.0.0（2,320,272，SHA 前 8 位 `47EA81AF`），豆包 2.1.17.0（2,656,144，`CC96F66B`）。同一 SDK 家族、不同代际构建，不能当成同一份二进制。
- **“策略枚举”派**：Cursor 的 `SandboxPolicy` 用 `workPolicyStrict` + `networkPolicyStrict` 表达，而不是堆 Win32 API。
- **“SQLite 状态机”派**：MiniMax `srt-win` 用 `rusqlite` 存沙箱状态。
- **“Python 运行时”派**：小浣熊 `box-agent-acp` 是 PyInstaller Python 3.12，自带 skills 目录。

### 5.3 凭据与密钥

| 产品 | 证据 | 性质 |
|---|---|---|
| Codex | `dpapi protect failed for online/offline user`、`CryptProtectData`、`PFXImportCertStore`、`~/.aws/credentials`、AWS `CredentialsProviderChain`；沙箱服务导入 `CredReadW`/`CredWriteW`/`CredDeleteW` | 沙箱安装器密钥 + AWS SDK 凭据链 + 服务侧 Windows Credential Manager 读写（是否实际使用未知） |
| WorkBuddy | `safeStorage` 1 处、`aes 0.8.4`、`argon2 0.5.3`、secret 扫描规则（1password/adafruit/generic-credential） | 审批票据加密 + 泄露扫描 |
| Trae | `credential_sync`、`git_token`、`workroom_credent`、`credential_sync` 字段；`keyring` 命中 9 | 工具宿主凭据同步 |
| Cursor | `cursorPasskey` 暴露键；`extensionHostWorkerMain.js` keyring 349 次 | VS Code secret storage + Passkey |
| ZCode | `@napi-rs/keyring 2.1.2` | OS keyring |
| Qoder | `keytar.node` 707,584 + `aoq_node_ext.node` 253,952 + `AoqClientSdk.dll` 14.7MB（四版本均带） | OS keyring（keytar）+ 阿里云 RTC 引擎（aoq，43 引擎方法/45 NAPI 方法，`token`/`sid`/`relayEndpoints`；app 代码 0 引用、静态不可达） |
| 豆包 | `mcp_helper` 的 `OAuth session has no credential checkpoint`、`failed to checkpoint OAuth credentials`；`BCrypt` | MCP OAuth 凭据检查点 |
| 小浣熊 | `libcrypto-3-x64.dll` / `libssl-3-x64.dll` / `_ssl.pyd` | Python SSL 栈 |

### 5.4 前后端接口面

| 产品 | 前端形态 | 静态 IPC | 动态 | 暴露键 | 后端载体 |
|---|---|---|---|---|---|
| WorkBuddy | Electron | 120（55 配对） | 214（115 main 全归因） | 83 | `main/server.js` MCP Host + A2A proxy + WeCom A2A + daemon |
| Cursor | Electron（molten） | 33（12 配对） | 45（43 可归因/0 未定） | 21 | extension host + file_service.node + crepectl |
| Trae | Electron（VS Code） | 71（1 配对） | 110（58 非字面量/0 未定） | 5 | agent-tool-host + sandbox SDK + shared process |
| MiniMax | Electron | 54（25 配对） | 816（332+406/0 未定） | 35（373 成员） | `@mavis/local-runtime-v2` 进程内 REST + wss agent |
| ZCode | Electron | 3（2 配对） | 423（227 全还原·180 唯一） | 8（169 成员） | `out/host` RPC + `@zcode/server` + runtime-host |
| 小浣熊 | Electron | 95（19 配对，38 仅 handler） | 26（11 固定/2 族/0 未定） | 20 | box-agent-runtime（Python ACP） + browser-gateway |
| 豆包 | Chromium 147 | 2 条（SDK/Lynx 方法误匹配） | 0（另 41 条 LarkAPI/848 个 Neotix 原生方法） | 0 | `agent_infra.dll` 本地运行时策略 + `mcp_helper.dll` MCP 进程宿主 + Agent tool IPC 命名管道 + PIP `PipMain/PipSDK/PipRemote` 三族命名管道 |
| Qoder | Electron | 0 | 8（5 主进程 + 3 guest/0 未定） | 0 | `application-server` + `peer-transport` + `remoteSdkDaemonBridge` + 主进程 MCP server 代码路径 |
| DeepSeek | Electron | 0 | 142（102 调用/54 常量） | 11 | cordis 插件 + `dsh-api-gateway` + loopback WS |
| OpenCode | Electron | 3（1 配对） | 5（3 唯一/0 未定） | 1（5 成员） | 桌面主进程拉起 `opencode-cli serve --service`；isolated 3084，普通模式动态端口；4096 仅为 Add Server 占位 |
| Codex | Rust TUI/CLI | — | — | — | app-server 本地 WebSocket `ws://127.0.0.1:0` |

**读法**：暴露键数量与安全不是线性关系，但 83 个暴露键（WorkBuddy）与 1 个暴露键（OpenCode）代表两种设计哲学：前者把主进程当“能力总线”，后者把 preload 当“最小门”。IHUI-AI 应该选后者作默认，前者只对受信窗口开放。

**静态载体不等于已启动**：运行态快照（5.6）里 WorkBuddy 的 `18488` / `56000` / `57736` / `57737` / `57740` / `63423` 与豆包的 `49853` / `61167` 是实际监听；Qoder 的 `55346` 是本机测试桥，不是 `application-server`；codex 的 `app-server` 在快照里没有目标专属监听，可能走 stdio。

### 5.5 更新与遥测

- WorkBuddy：`software-update:*` IPC 四件套 + `galileotelemetry.tencent.com`（18）+ `localhost:9411/api/v2/spans`（Zipkin）+ `localhost:4318`（OTLP HTTP）。
- Trae：`update-available/update-downloaded/before-quit-for-update` + `crashReporter` + `VSCODE_CRASH_REPORTER_PROCESS_TYPE`。
- ZCode：`app-update.yml` → `url: http://localhost:8081`（本地更新代理）+ `@opentelemetry/exporter-trace-otlp-proto`。2026-11-25 快照里 ZCode 未运行、8081 无监听，所以这只是静态配置，不能写成“已启用的本地代理”。
- Cursor：`downloads.cursor.com`（14）+ `update` 服务 + crashReporter。
- MiniMax：`electron-updater` + `telemetry` 模块 6 个 + `agent.minimax.cn` wss。
- 豆包：`mon.zijieapi.com`（631 次，最大外部 host）+ `pc_push.dll`；运行态 `saman.push.mojom.PushServerService`（18744，96 个模块）实际加载 `pc_push.dll` 与 `PushNotificationsLongRunningTask.ProxyStub.dll`，`push_detect.exe` 是独立 exe、未出现在模块表。
- Qoder：`@arms/rum-electron`（阿里 ARMS 前端监控）+ `@ali/qoder-crash-sdk`。
- 小浣熊：`app-update:status` IPC + `app-update.yml`。
- DeepSeek / OpenCode：`electron-updater`；OpenCode 另有 Sentry ingest 域名。

### 5.6 运行态快照（2026-11-25 15:26，非本轮启动）

抓取时本机已有 41 个目标进程；它们不是本轮启动的，只是当时状态。快照只证明“运行中存在这些监听/管道”，不证明协议、鉴权或默认配置。

| 目标 | 进程与监听 | 已观察到的管道 | 结论边界 |
|---|---|---|---|
| WorkBuddy | main 22984 → `127.0.0.1:18488`；daemon-app-server 31688 → `56000` / `57736` / `57737`；codebuddy serve 41604 → `57740`；8372 → `63423` | `WorkBuddy_SandboxCenter_*`、`WorkBuddy_SensitiveApproval_*`、`workbuddy-...-sidecar-control-*` / `-data-*`、`workbuddy-pac-31688-*` | MCP/daemon/sidecar 层实际在监听，不再是纯静态；端口协议未探测 |
| 豆包 | main 28736 → `127.0.0.1:49853` / `61167`；运行中的 utility 类型含 `saman.push.mojom.PushServerService`（18744）、`privilege.mojom.PrivilegedAssistantBroker`（35880）、`agent_infra.mojom.AgentInfraProcess`（39808）、`backend.mojom.Service`（32072）、`jsrt.mojom.Service`（39364）、`bdmssdk.mojom.BdmssdkService`（25052） | `aha-agent-tool-ipc-<uuid>`、`PipMainPipeName_43814`、`PipSDKPipeName_50414`、`aha_doctor_ipc_server_name_service_28736` | Agent Tool IPC 与 PIP Main/SDK 活跃；`PipRemotePipeName` 未出现；`push_detect.exe` 不在进程表内，它与 `saman.push` 的关系仍无静态证据 |
| Qoder CN | 0.5.14 主进程 4744 → `127.0.0.1:55346` | 无 Qoder 专属管道 | 该端口对应本机测试脚本 `C:\IHUI-AI\scripts\qoder-chat-bridge.mjs --port 0`，**不算 Qoder application-server** |
| 小浣熊 / codex | 小浣熊为 Chromium 多进程，无目标专属 TCP；codex 无 TCP/UDP 监听（PID 33980 端点为 0），但有 `OpenAI.CodexSandbox.OpenAI.Codex_2p2nqsd0c76g0`、`codex-app-tools-ba97c01c…` 两条命名管道（ACL 见 5.9） | 两条命名管道 | codex 管道协议/ACL 部分未探测 |

端口协议已在 5.8 做只读指纹：`18488` 是 HTTP API，`56000` / `57737` 是 HTTP 403 网关，`49853` 是校验 Origin 的 WebSocket，`55346` 自报 `qoder_bridge_error`；Codex 的 `OpenAI.CodexSandbox` 管道 ACL 见 5.9（`CodexSandboxUsers` Deny FullControl，`INTERACTIVE` Allow 读写）；`codex-app-tools` 管道与 app-server 命令行里的 plugin 别名对应，见 5.10。

### 5.7 运行期模块加载（Qoder / 豆包 / WorkBuddy）

同一快照里对运行进程做 `Get-Process.Modules` 枚举，只记录当时已加载模块；它不是磁盘清单，也不能证明某能力永远不能启动。

| 进程 | 模块数 | 已加载关键模块 | 未加载关键模块 | 结论 |
|---|---|---|---|---|
| Qoder 0.5.14（4744 / 36688） | 41 / 47 | `Qoder CN.exe` | `AoqClientSdk.dll`、`aoq_node_ext.node`、`keytar.node`、`PluginOpus.dll`、`alivcffmpeg.dll` | 当前运行态未加载 AOQ RTC 四件套与 keytar；与静态 0 import/0 路径命中一致 |
| Doubao `AgentInfraProcess`（39808） | 45 | `agent_infra.dll`、`pip_sdk.dll`、`Doubao.dll` | `pip_remote.dll` | agent infra + PIP SDK 已加载；PIP Remote 未加载 |
| Doubao `PushServerService`（18744） | 96 | `pc_push.dll`、`PushNotificationsLongRunningTask.ProxyStub.dll`、`Doubao.dll` | `push_detect.exe` | 推送服务实际用 `pc_push.dll`；`push_detect` 仍是独立 name-only exe |
| Doubao main（28736） | 161 | `Doubao.dll`、`doubao_elf.dll` | `mcp_helper.dll`、`pip_remote.dll`、`aiep_ipc.dll` | MCP helper、PIP Remote、AIEP IPC 在当前主进程未加载；按需/子进程加载未定 |
| WorkBuddy main（22984） | 135 | `WeComAgentConfirmSDK.dll` | `sandbox-cli.exe`、`sandbox-center.exe` | 企微确认 SDK 常驻；沙箱 helper 是独立 exe，空闲态不驻留 |
| Codex Windows 沙箱服务（33980） | 50 | `codex-windows-sandbox-service.exe` | 目标级命名管道 `OpenAI.CodexSandbox.OpenAI.Codex_2p2nqsd0c76g0`、`codex-app-tools-ba97c01c…`（归属未逐句柄验证；第一条 ACL 见 5.9） | 常驻服务确实以 50 个模块运行；命名管道存在；仍未证明每次工具调用都由它执行 |

**边界**：模块枚举是点时刻；缺模块不等于功能不存在，只说明当时未加载。`push_detect.exe` 是独立可执行，不会出现在 `Doubao.exe` 的模块表里；它的角色仍不能由模块表判定。Codex 沙箱服务的两条命名管道是运行态对象，不等于模块加载；管道协议与 ACL 仍未探测。

### 5.8 本地监听协议指纹（只读，2026-11-25 15:45）

对 5.6 的 9 个监听各发一次 `OPTIONS /` 和一次 WebSocket Upgrade 请求；不带凭据、不调用业务 API、不做 MCP initialize。

| 端口 / 进程 | `OPTIONS /` | WebSocket Upgrade | 判定 |
|---|---|---|---|
| 18488 WorkBuddy main | `204 No Content`，`Access-Control-Allow-Origin: *`，允许 GET/OPTIONS | `404` + `{"ok":false,"error":"Not Found"}` | 本地 HTTP API，CORS 全开；不是 WebSocket |
| 56000 WorkBuddy daemon | `403` + `{"error":"forbidden"}` | 同 403 | HTTP 网关，带鉴权/拒绝门 |
| 57736 WorkBuddy daemon | `404`，空 chunked | 同 404 | HTTP 服务，根路径无路由 |
| 57737 WorkBuddy daemon | `403` + `X-Request-Id` + `{"error":"forbidden"}` | 同 403 | HTTP 网关，带 request-id |
| 57740 WorkBuddy codebuddy | 超时 | 超时 | 不响应普通 HTTP；更像 WebSocket/TCP 专用握手 |
| 63423 WorkBuddy codebuddy | 超时 | 超时 | 同上 |
| 49853 豆包 main | `404`，`Content-Type: text/html` | `500`，body `invalid origin` | **WebSocket 服务，且校验 Origin** |
| 61167 豆包 main | 空响应 | 空响应 | 静默 raw TCP；协议未识别 |
| 55346 Qoder 测试桥 | `404` + `{"error":{"message":"not found","type":"qoder_bridge_error","code":"not_found"}}` | 同 404 | HTTP 测试桥，自报 `qoder_bridge_error`；不是 Qoder application-server |

**边界**：每个端口只发一次请求；超时不等于“只能是 WebSocket”；61167 静默可能是自定义 raw TCP。`18488` 的 CORS 全开只说明该 HTTP 端点允许跨源预检，不等于业务接口无鉴权；`56000` / `57737` 的 403 也只证明根路径被拒，鉴权方式仍未识别。

### 5.9 Codex 服务命名管道 ACL（只读）

`Get-Acl \\.\pipe\OpenAI.CodexSandbox.OpenAI.Codex_2p2nqsd0c76g0`：

| 受托人 | 类型 | 权限 |
|---|---|---|
| 本地组 `CodexSandboxUsers` | Deny | `FullControl` |
| `NT AUTHORITY\INTERACTIVE` | Allow | `CreateFiles, WriteExtendedAttributes, WriteAttributes, Read, Synchronize` |
| `NT AUTHORITY\SYSTEM` | Allow | `FullControl` |
| `BUILTIN\Administrators` | Allow | `FullControl` |

SDDL：`O:SYG:SYD:P(D;;FA;;;S-1-5-21-3924373712-2464060091-3741006702-1004)(A;;0x12019b;;;IU)(A;;FA;;;SY)(A;;FA;;;BA)`。`D:P` 表示 DACL 受保护、不做继承。

解读：`CodexSandboxUsers` 被显式拒绝，说明沙箱用户不能连服务管道；`INTERACTIVE` 可创建/读写/同步，但没有删除或执行权，普通交互用户能打开管道，服务必须靠 `ImpersonateNamedPipeClient` 或协议内校验区分调用方——**“能连”不等于“有管理权”**。第二条 `codex-app-tools-ba97c01c…` 的 `Get-Acl` 返回 error 231，ACL 没读到，不能推断。

**边界**：ACL 只证明访问控制，不证明协议、消息格式、认证强度；没有连接管道、没有发业务消息。账本：`native\codex\sandbox-service.json` 的 `pipe_acl`。

### 5.10 Codex app-server 的 MCP 插件启动配置（运行态命令行）

PID 38788（父 PID 11820）运行 `codex.exe ... app-server --analytics-default-enabled`，命令行同时声明：

| 声明项 | 值 |
|---|---|
| feature | `features.code_mode_host=true` |
| plugin | `plugins.codex-app-tools@openai-bundled.mcp_servers.codex_app.enabled=true` |
| plugin MCP | `unified-computer-use@openai-bundled` → `cua_repl`，cwd `C:\Users\Administrator\.codex` |
| MCP | `node_repl` → `...\runtimes\cua_node\23b8c1efed953688\bin\node_repl.exe`，cwd `C:\Users\Administrator\.codex` |
| MCP | `artifact_session` → 同一个 `node_repl.exe`，cwd `C:\Users\Administrator\.codex` |

快照里 PID 38788 的子进程只有 `conhost.exe`（38988），没有 `cua_repl` / `node_repl` / `artifact_session` 子进程；独立的 `codex-code-mode-host.exe` 也没有出现在进程表。`codex-app-tools-ba97c01c…` 管道名与命令行里的 plugin 别名对应，但归属仍是命令行推断，没有逐句柄验证。

**边界**：命令行是启动配置，不是执行证明；没有做 MCP initialize，也没有连接 `codex-app-tools` 管道。`features.code_mode_host=true` 只说明开关被传入，不能据此写成 code-mode host 已在工作。账本：`analysis\codex-app-server-runtime-2026-11-25.json`。

### 5.11 Codex 48 条动态 IPC：50 个非字面量调用点，0 未定

工具 summary 报 `48 dynamic IPC call(s)`。把 `app.asar` 的 9,849 个 `.js` 按 header offset 解到 `_work\codex-asar-js`，按 `ipcRenderer` / `ipcMain` / `sendToHost` 逐调用点解析，得到 **82 个调用点**：50 个 `ipcRenderer`（含 2 个 `postMessage`）、30 个 `ipcMain`（8 个 `handle` + 22 个 `on`）、2 个 `sendToHost`；其中 **50 个首参非字面量**，32 个是字符串字面量。工具 48 与源码 50 的差额正好是 **2 个 `ipcRenderer.postMessage(c/l)`**——工具没把它们计入 dynamic，二者分别解析为 `codex-shared-texture-create` 与 `codex_desktop:connect-app-server-manager`。50 条全部有解，**0 条未知**。

| 动态族 | 调用点 | 解析结果 |
|---|---:|---|
| `browser-page-preload.js` 的 `I` / `D` / `M` | 10 | `browser-sidebar-runtime-message` 7、`browser-page-event` 3、`message-for-view` 2；三个都是 preload 顶层的字符串常量 |
| Sentry preload 的 `createKey` | 12 | `sentry-ipc.start` / `.scope` / `.envelope` / `.status` / `.structured-log` / `.metric`，main 侧 6 个 `on` 与 preload 侧 6 个 `send` 一一对应 |
| `preload.js` 的 `k` / `c` / `l` / `p` / worker 模板 / `u(e)` | 6 | `message-from-view`、`codex-shared-texture-create`、`connect-app-server-manager`、`git-worker-port`、`worker:${e}:from-view`、`worker:${e}:for-view` |
| `early-bootstrap-916` 的 `cr.*` | 19 | 模块 `87329` 的别名表全量可读；逐个落到图里的 19 个静态通道 |
| `(0,cr.$P)(e)` | 1 | `worker:${e}:from-view`；`ty.CN7` 只有 `["git"]`，运行期只产生 `worker:git` 实例 |
| `ty.n4$` | 1 | `codex_desktop:connect-git-worker`；本来就在 36 个静态通道里 |
| `uc` | 1 | `codex-shared-texture-create` |

归一后**唯一通道 44 个 = 36 个图通道 + 6 个 `sentry-ipc.*` + 2 个 `worker:git:*`**；36 个图通道全部能在源码找到至少一个调用点，没有“图里有、源码没有”的幽灵通道。新增的 8 个通道不是未知，而是 `createKey` 与 worker 模板在运行期拼出来的；其中 6 个 Sentry 通道在 `ipc` 图里天然不可见。**边界**：这是静态调用点解析，不是运行期抓包；Sentry 通道的实际发送频率、worker 模板是否只被 `git` 调用，仍需运行时验证。

账本：`analysis\codex-ipc-final.json`（82 个调用点、44 个归一通道、`unknown_channels=0`、`tool_vs_source_delta=2`）。

---

## 6. 对 IHUI-AI 的可落地清单

这一节只写“能落到仓里”的东西。落点用包级/目录级路径，避免编造不存在的文件名。

| 借鉴点 | 证据来源 | IHUI-AI 落点 | 验收标准 |
|---|---|---|---|
| 统一权限决策对象 | Codex `TaggedPermissionProfile` + `NetworkPermissions`；WorkBuddy `permission.json` + approval；Trae `SandboxConfigPermissionObjectWireRef` | `packages/agent-sdk/src` 定义 `PermissionDecision {scope, kind, sessionId, expiresAt, evidenceRef}`；`apps/api` 暴露 policy 端点；`apps/desktop` 只做 UI | 所有工具调用（含 MCP/内置工具/终端）都必须过同一个 `decide()`；没有 `evidenceRef` 的决策直接拒绝 |
| Windows 作业对象执行器 | WorkBuddy `sandbox-cli` 的 `CreateJobObjectW/AssignProcessToJobObject/TerminateJobObject`；Codex `spawned ConPTY is missing its process job` | `apps/desktop` 主进程新增 executor 抽象（Job Object + 进程树回收 + 超时） | 子进程退出后 Job 必须为空；CTRL+C/超时/崩溃三场景都不留孤儿进程 |
| 审批反向通道 | WorkBuddy `approval.callbackAddress` + `approvedByUser` + 三队列；Trae `PermissionDenied` | `apps/desktop` 命名管道（ACL 限制到当前用户）+ `packages/agent-sdk` 审批协议 | 审批请求可追溯到 session；断线后备份/恢复队列不丢请求 |
| preload 暴露面预算 | OpenCode 1 个键 / 5 成员 vs WorkBuddy 83 键 | `apps/desktop` preload 只暴露一个命名空间对象；禁止直接暴露 `ipcRenderer` | 暴露键 ≤ 20；每个键有 owner 与用途注释；CI 里做预算检查 |
| 动态 IPC 注册表 | ZCode `[rpc:call]/[rpc:listen]`、423 条工具计数已归因为 227 个调用点/180 通道；Qoder `peer-transport` | `packages/agent-sdk` 做命名通道 RPC（call/listen/subscribe），替代裸 `ipcMain` | 通道名必须来自注册表；未注册通道运行期拒绝并打点 |
| 本地运行时策略热更新 | 豆包 `local_runtime.runtime_policy`（probe/timeout/background_limit） | `apps/api` 或 `apps/ai-service` 增加 `runtime-policy.json` + 热加载；写入审计 | 策略变更 5 秒内生效；每次变更留 who/when/why；非法字段拒绝整份策略 |
| 桥版本握手 | 豆包前端 2 个 audio API 调用当前 `Doubao.dll` 848 项注册表里不存在；Neotix 848 方法 / LarkAPI 3 通道 | `packages/agent-sdk` + `apps/desktop` 启动时交换 `nativeBridge.version` 与方法摘要；web bundle 只调用注册表里存在的名字 | 启动时 mismatch 直接禁用对应入口并在 UI 明示；CI 对 bundle 调用做 registry 静态校验 |
| MCP Host 回环服务 | WorkBuddy `main/server.js` `listen(0,'127.0.0.1')` + 路由注册/注销 | `apps/api` 提供 MCP Host：随机端口、per-route token、生命周期注销 | 端口不落公网；未注册路由 404；注销后在飞请求被 abort 并计数 |
| 凭据与 OAuth 检查点 | 豆包 `mcp_helper` OAuth checkpoint；ZCode `@napi-rs/keyring`；Cursor `cursorPasskey` | `packages/auth`：OS keyring + DPAPI 封装；MCP OAuth 存 checkpoint 而非内存 | 明文凭据零落盘；refresh 失败可恢复；退出即清内存副本 |
| 遥测与本地采集 | WorkBuddy `localhost:4318`（OTLP）+ `9411`（Zipkin）；ZCode OTLP exporter | `monitoring/` 统一 OTLP，默认本地 collector，远端需显式开关 | 默认不外发；PII 字段白名单过滤；采样率可配 |
| 更新链路 | ZCode `http://localhost:8081` 本地代理；Cursor `downloads.cursor.com` | `apps/desktop` 更新器：签名校验 + 可选本地代理 + 灰度通道 | 安装包签名校验失败即拒绝；本地代理不可用时回退官方源并告警 |
| 通道域隔离 | 豆包 Agent Tool `\\.\pipe\aha-agent-tool-ipc-`、Neotix ShellAPI、PIP `PipMain/PipSDK/PipRemote` 三族命名管道并存但用途分离 | `packages/agent-sdk` 按 domain 划 RPC（agent / ui / remote-session），每条通道独立 ACL 与版本号 | 跨 domain 不能复用通道名；每个 domain 有独立健康检查与关闭开关；审计日志按 domain 分表 |
| 安全基线（窗口） | Qoder 全窗口 `contextIsolation:true/sandbox:true/webSecurity:true`；WorkBuddy 调试面板反例 | `apps/desktop` 统一 `createSecureWindow()` 工厂 | 生产构建禁止 `contextIsolation:false`、`nodeIntegration:true`、`webSecurity:false`；调试窗口独立构建开关 |
| 多端一致（Web/RN/小程序） | 本轮 11 个产品都在“多入口共享同一后端” | `packages/agent-sdk` 作为唯一协议层；`apps/web`、`apps/mobile-rn`、`apps/miniapp-taro` 复用 | 三端调用同一 `agent-sdk` 方法名与错误码；差异只在 UI 适配层 |

**必须避开的反模式（本轮实测到的）**：

1. WorkBuddy `main/index.js:203` 的调试面板 `contextIsolation:false/nodeIntegration:true`——即便只是调试，也不该进生产包。
2. WorkBuddy `main/main-bootstrap.js:368` 的 `webSecurity:false`——同源策略关掉后，任何内嵌页面都能读跨域响应。
3. Trae 的 1 个 `sandbox off` + 1 个 `webSecurity off` 窗口；Cursor 5 个窗口未显式声明安全项。
4. 83 个 `contextBridge` 暴露键（WorkBuddy）与 373 个暴露成员（MiniMax）——能力总线式 preload 的典型膨胀。
5. ZCode 423 条工具计数经本地 227 个调用点逐条回填，**227/227 已还原为 180 个唯一通道、0 条未定**；WorkBuddy 214 条里 main 侧 115 条注册全部归因（12 个 `require_*` 别名全回填）；MiniMax 6+8 条变量已回填，主进程 332 + renderer 406、源码 804 个调用点、0 条未定；DeepSeek 142 条经源码复核为 **102 条业务调用 + 14 条清理**，业务调用全部落 54 个常量通道，40 条差额是工具侧重复条目；Trae 58 条非字面量已归到 30 个通道、0 条未定；Cursor 43 条非字面量里 29 条落 20 个通道、12 条 helper、1 条 4 路守卫、1 条运行期 payload、0 个未知常量；Qoder 四版本 13 条动态全部解码到 6 个唯一通道、0 条未定；OpenCode 5 条动态跨文件配对回 3 个已有静态通道、0 条未定；小浣熊 34 个非字面量已拆成 11 个固定通道 + 2 个模板族 + 7 条 voice-input 清理 + 14 个 helper、0 条未定。不可审计面比表面数字小，ZCode/WorkBuddy/MiniMax/DeepSeek/Trae/Cursor/Qoder/OpenCode/小浣熊 的动态别名已不再留口子。
6. 豆包用 `ShellapiCommonError.value===8` + `SysAudioUnsupportedUpgrade` 做软门控，这比裸调安全，但仍属于“用户触发时才发现版本差”。更稳的做法是启动时交换 `nativeBridge.version` 与方法摘要，把 2 个 audio API 的缺失提前到首屏，而不是等录音入口被点开才弹升级提示。

---

## 7. 局限与未闭环

必须诚实列出来，否则这份报告会重复上一版的问题。

1. **本轮没有主动启动或驱动任何目标**（OpenCode 的 `serve` 实跑除外）：2026-11-25 15:26 的运行态快照显示 Doubao、WorkBuddy、Qoder CN、小浣熊、codex 已在运行，但这些是既有状态，不是受控实验；`sandbox_switch_config` 默认值、ZCode 的 8081 更新代理是否启用、端口鉴权与业务协议、PIP 对端与默认监听都没有实跑验证。端口协议只做了 5.8 的一次只读指纹；Codex 的 `OpenAI.CodexSandbox...` 命名管道只读到 ACL、没有连接测试，`codex-app-tools...` 的 ACL 与两条管道的协议均未探测；app-server 只读到 MCP 启动配置，没有实际 MCP 子进程或 initialize；OpenCode 已补 `serve` 实跑（监听成功、Web UI 200、API 401）。
2. **Codex 407MB 超工具上限**：`native-rust-binary-show` 拒绝 >256MB，因此没有 craft 原生 Rust 报告；本轮用字节级 cargo 路径正则补出 400 个 crate、rustc commit、5 个 git checkout，但没有 demangled symbols 与 `.dep-v0` 审计清单，crate 归属仍不是 craft 官方口径。PE debug directory 已解析出 `codex.pdb`（GUID `A76FDC38-7BA8-ABA9-4C4C-4450205044BE`，age 1），但 PDB 未随包分发，COFF symbol table 为 0，所以 demangle 不是“没找”，是“没有可用符号源”。
3. **OpenCode 已运行验证，但凭据传递仍未知**：`opencode-cli.exe` 2.2.7 的 `serve` 能监听并返回 Web UI；`/api` 与 `/openapi.json` 无凭据返回 401；普通模式 stdout 打印一次性 `server password`，`--service` 模式未观察到密码行。桌面端如何注入凭据、`--stdio` 模式行为、长期运行稳定性都未验证。`localhost:4096` 已证实只是 `dialog.server.add.placeholder` 的默认占位。
4. **Qoder 的 keytar/aoq 已文件级确认，aoq 的定性已纠正**：`keytar.node` 707,584 与 `aoq_node_ext.node` 253,952 在 0.5.6/0.5.14 两个版本中都存在；aoq 不是“播放器 SDK”，而是阿里云 `NLS-RTC-Service` 的 `aoq-client-sdk` RTC 引擎（43 个引擎方法、45 个 NAPI 桥方法，麦克风/摄像头采集、音视频帧观察、Aliyun RTC relay）。四个版本都带原生四件套，但四个版本的 asar app JS/TS/JSON 扫描（排除 SDK 自身）只有根 `package.json` 的 `optionalDependencies` 声明命中，**0 个 import/require、SDK 目录之外 0 个路径含 `aoq`**，因此当前静态不可达、桌面通道增量为 0；运行态模块枚举（5.7）里 0.5.14 的 41 / 47 个模块中也没有 AOQ 四件套与 `keytar.node`，与静态结论一致，启用的代码路径仍未找到。账本 `analysis\qoder-aoq-sdk.json`。
5. **动态 IPC 计数必须逐目标复核**：ZCode 423、MiniMax 816、DeepSeek 142、WorkBuddy 214、Trae 110、Cursor 45 是工具的“非字面量首参”计数，不等于运行期拼接。已还原：DeepSeek 源码 116 个调用点（102 业务 + 14 清理），102 条业务调用落到 54 个常量通道，142 与 102 的 40 条差额是工具侧重复条目；MiniMax 6+8 条变量全部回填为主进程 332 + renderer 406，源码 804 个调用点、0 条未定；WorkBuddy main 侧 115 条注册全部归因（81 常量/别名 + 29 模板 + 4 helper 形参 + 1 内部通道），12 个 `require_*` 别名全回填；ZCode 本地 227 个调用点 227/227 还原为 180 个唯一通道、0 条未定，423 与 227 的差额来自 node_modules/其他 bundle；Trae 真实 app 树 73 个 ipc +62 个 sender，58 条非字面量中 56 条落到 30 个唯一通道、2 条是 wrapper/response 非通道值、0 条未定；Cursor 44 个 Electron 调用点中 43 条非字面量，29 条落 20 个唯一通道、12 条 helper、1 条 4 路守卫、1 条运行期 payload、0 个未知常量，45 与 43 的 2 条差额落在 js-debug 的 WebSocket `.send` 泛化匹配。
6. **`webPreferences: dynamic` 无法判定**：多个产品有 4–12 个窗口的 webPreferences 在运行期计算，静态只能标“未知”，不能下“安全/不安全”结论。Codex 的 6 个窗口里 1 个 `WebContentsView` 未显式设 `contextIsolation`、1 个 `BrowserWindow` 的 `webPreferences` 对象 `E` 已回溯为 `contextIsolation:true / nodeIntegration:false`，但没有 `sandbox` 字段、解包 JS 未发现 `app.enableSandbox`，实际默认取决于 Electron 版本与全局设置，只能标“未显式 sandbox，运行验证”，不能直接判漏洞；另外 4 个显式 `sandbox:true / nodeIntegration:false / contextIsolation:true`。
7. **豆包 0 条未定，但图仍有“分片差账”**：Neotix ShellAPI 的 848 个原生方法已从 `Doubao.dll` 抽出，LarkAPI.ipc 的 41 个调用点已归到 3 个通道；`AppletBridge` 已定性为 Lynx native module 协议，259 个 `doubao.*`/`applet.*` 是模块方法名、不是 IPC 通道，对桌面通道面增量为 0。`audioRecorder.getSystemAudioCaptureAccess` 与 `openSystemAudioCapturePermissionSettings` 在当前 `Doubao.dll` 里没有同名原生方法，但前端 `nn.aff2f600a8.js` 用 `ShellapiCommonError.value===8` 判断后弹 `SysAudioUnsupportedUpgrade` 提示，属于旧原生上的降级门控，不是未知通道。`biz.pak` 三片合计 1,471,311 节点，比单图推算需求 1,615,501 少 144,190，差在 235 个单图额外计入的模块（资产/非 JS 口径）与跨片边缺失；**不是新的节点截断，但也不是与单图逐节点等价**。PIP 子系统的命名管道族已做静态字符串取证，运行态快照又看到 `PipMainPipeName_43814` / `PipSDKPipeName_50414` 存在、`PipRemotePipeName` 缺失；这证明 Main/SDK 两族在运行，但仍不能证明远程会话已启用，对端进程与默认监听的完整边界未验证。
8. **函数发现上限 50,000**：所有大 PE 的函数表都不完整；`core-overview-show` 已明确 `function_limit`。
9. **字符串保留前 200,000 条**：超大二进制（Codex 204,743 条）尾部字符串未进入索引。
10. **签名只验证“文件哈希匹配 + 证书链有效”**，未做吊销/时间戳策略判定。
11. **Qoder 四个版本已全部补图，exe 也补了 overview**：0.5.6 与 0.5.7 主结构一致（637 模块 / 202 endpoint），0.5.12 与 0.5.14 主结构一致（610 模块 / 192 endpoint）；0.5.7 与 0.5.12 的 exe overview 与 0.5.14 完全一致，确认 0.5.7–0.5.14 共用同一 Electron 壳代码。动态 IPC 5/0/0/8 已全部还原到 6 个唯一通道，0.5.14 比 0.5.6 多的是 `mcp-app:guest-message` 的 3 条 guest preload 调用，不是未知运行期拼接。
12. **WorkBuddy 的 9527 已解释**：它只存在于 `cli\bin\daemon-status-brief.test.cjs`，是测试用的假 daemon endpoint，不是生产服务；这一条从“未知”降为“测试夹具”。
13. **Trae 的 543 个 session 目录是本机既有使用痕迹**，不是本轮运行产生；只读取了目录结构与文件名（`cwd.txt`/`execution.json`/`output.log`/`stderr.log`），没有读取命令内容或输出正文。
14. **`push_detect.exe` 仍是 name-only**：签名有效，只导入 `Microsoft.WindowsAppRuntime.Bootstrap.dll`（`MddBootstrapInitialize2`）+ `KERNEL32` / `ole32` / `OLEAUT32`，字符串只有 `C++/WinRT version:2.0.221104.6`，`Toast` / `Notification` / `AppUserModel` / `Push` 全部 0 命中，无产品字符串；无法从静态证据证明它检测什么，只能保留文件名推测。运行态快照里它不在进程表，豆包侧只有 `saman.push.mojom.PushServerService` utility，二者关系仍无静态证据。

---

## 8. 证据索引

所有证据 JSON 位于 `C:\IHUI-AI\.workbuddy\craft\out\deep\`：

- `analysis\install-matrix.json`：11 个目标的安装面、主程序版本/大小/hash、asar 大小、native 模块数量。
- `analysis\frontend-matrix.json`：前端总矩阵（模块/节点/边/endpoint/窗口/IPC/暴露键），13 行——已补 `codex-app`（9,660 模块 / 444,320 节点 / 36 IPC / 6 窗口 / 4 暴露键 / 28 成员）与 `doubao-biz-pak` 三片行；Qoder 四版本里只收 0.5.6 / 0.5.14 两个代表，报告 3 节表另列 0.5.7 / 0.5.12。
- `analysis\frontend-coverage-audit.json`：15 个前端图/分片的 JS 覆盖审计——逐目标非 `node_modules` JS/TS 计数、图 `examined`、`0` 个应用 JS 漏读目标；Codex 9,656 个应用 JS 全进图（215 个 node_modules JS + 136 个 `.d.ts` 排除），Qoder 四版本均按实际文件计数（634 / 634 / 606 / 606），豆包三片按 7,837 个 JS 逐一对齐。
- `analysis\backend-<target>.json`：后端模式扫描（http/ws server、ipcMain、contextBridge、safeStorage、MCP/ACP/LSP）。
- `analysis\backend-qoder-all.json`：Qoder 四版本 asar 后端扫描——`mcpServer` 665 / 665 / 629 / 629（`out/main/electronMain.js` 123 / 123 / 129 / 129，agent-sdk 各 37）、`http.createServer` 8 / 8 / 6 / 6、0.5.12/0.5.14 的 `WebSocketServer` 1、`ipcMain`/`expose`/`safeStorage`/`keytar` 均 0；启动与否未运行验证。
- `analysis\runtime-snapshot-2026-11-25.json`：2026-11-25 15:26 运行态快照——41 个目标进程、9 个本地监听、相关命名管道；含 WorkBuddy `18488`/`56000`/`57736`/`57737`/`57740`/`63423`、豆包 `49853`/`61167` 与 `aha-agent-tool-ipc`/`PipMain`/`PipSDK` 管道、Qoder `55346` 属测试桥而非 application-server 的判定、Codex `OpenAI.CodexSandbox.OpenAI.Codex_2p2nqsd0c76g0` / `codex-app-tools-ba97c01c…` 两条管道与 `34254` 无监听。
- `analysis\runtime-modules-2026-11-25.json`：运行态模块枚举——Qoder 0.5.14 的 41 / 47 个模块中 0 AOQ/keytar/Opus/FFmpeg；豆包 `AgentInfraProcess` 加载 `agent_infra.dll` / `pip_sdk.dll` 但 0 `pip_remote.dll`，`PushServerService` 加载 `pc_push.dll`；WorkBuddy 主进程加载 `WeComAgentConfirmSDK.dll`，沙箱 helper 为独立 exe、空闲态未驻留；Codex Windows 沙箱服务（33980）以 50 个模块运行。
- `analysis\runtime-port-fingerprints-2026-11-25.json`：9 个本地监听的只读协议指纹——`18488` HTTP API CORS 全开、`56000` / `57737` HTTP 403 网关、`57740` / `63423` 不响应普通 HTTP、`49853` WebSocket 且拒绝 invalid origin、`55346` 自报 `qoder_bridge_error` 测试桥。
- `<target>-jsmap-full.json`：前端全量图（豆包 ai-views 437MB、WorkBuddy 273MB、Cursor 247MB 等）；豆包主应用 `biz.pak` 的 1.04GB 图见下一组条目。
- `native\<target>\*.json`：核心取证（overview / imports / exports / publisher / strings0-7 / feat0-3）。
- `native\codex\crates.json`：Codex 407MB 二进制的 400 个 crate 路径清单（含 40 个高频项与 79 个安全/网络相关项）。
- `analysis\codex-app-server-runtime-2026-11-25.json`：PID 38788 `codex.exe ... app-server` 的运行态命令行——`features.code_mode_host=true`、`plugins.codex-app-tools@openai-bundled...enabled=true`，以及 `unified-computer-use` → `cua_repl`、`node_repl` → `node_repl.exe`、`artifact_session` → `node_repl.exe` 三组 MCP 启动配置；快照子进程只有 `conhost.exe`，`codex-app-tools` 管道存在但归属未逐句柄验证。
- `codex-app-jsmap-full.json`：441,212,155 字节；Codex `app.asar` 前端图——9,660 模块 / 444,320 节点 / 1,253,774 边 / 368,991 函数 / 36 IPC（3 配对、9 仅 handler、24 仅 invoker）/ 48 条运行期拼接（5.11 已逐条还原为 6 个 sentry + 2 个 worker + 36 个图通道内的别名/模板，0 未知）/ 6 窗口 / 4 暴露键、28 成员 / 6,624 endpoint 记录、1,889 唯一 URL / 294 路由记录、133 唯一路径 / 6 native 模块；图 `coverage` 10,663 examined / 15,520 total。
- `analysis\codex-app-frontend.json`：Codex 前端账本——`ChatGPT.exe` 5,003,568 / FileVersion 158.0.8127.37、`chrome.dll` 341,041,456、`app.asar` 443,800,006 / SHA256 `8a437aad…`、包 `openai-codex-electron` 26.1117.41037、15,520 文件 / 454,135,151 字节、9,849 `.js` + 22 `.mjs` + 136 `.d.ts`、9,656 应用 JS 全覆盖、6 窗口 webPreferences（第 5 个 `webPreferences:E` 已从 `getRendererPreferences` 回溯，`contextIsolation:true/nodeIntegration:false`，`sandbox` 未设置）、36 个 IPC 通道名、4 个暴露键与 28 个成员。
- `analysis\codex-ipc-final.json`：Codex 动态 IPC 总账——82 个源码调用点（50 `ipcRenderer` + 30 `ipcMain` + 2 `sendToHost`）、50 个非字面量、32 个字面量；工具 48 与源码 50 的差额是 2 个 `ipcRenderer.postMessage`；归一后 44 个唯一通道（36 图通道 + 6 `sentry-ipc.*` + 2 `worker:git:*`）、`unknown_channels=0`。`channels` 数组含每通道调用点数，`callsites` 含 82 条 `file/line/method/arg/kind/channel`。
- `native\codex\sandbox-service.json`：`codex-windows-sandbox-service.exe` 账本——62,953,264 字节、SHA256 `E66E4942…`、无版本元数据、运行 PID 33980、`windows-sandbox-rs` 源码路径、`CreateJobObjectW`/`AssignProcessToJobObject`/`CreateRestrictedToken`/WFP/`credential_broker` 字符串；`imports` 记录 24 DLL / 415 函数（`ws2_32` 37、`fwpuclnt` 11、`winhttp` 4、`advapi32` 78 等）；`windows_service` 块记录 `CodexSandboxService.OpenAI.Codex`、`AUTO_START`、`LocalSystem`、DisplayName `ChatGPT`、父进程 `services.exe`、SDDL 与 `AU` 的 `CCLCSWRPLORC`；`runtime_pipes` 记录 `OpenAI.CodexSandbox.OpenAI.Codex_2p2nqsd0c76g0` / `codex-app-tools-ba97c01c…`，`network_endpoints` 记录当前 TCP/UDP 为空；`pipe_acl` 记录第一条管道的 SDDL、Deny `CodexSandboxUsers`、Allow `INTERACTIVE` 读写，以及第二条 `Get-Acl` error 231。
- `native\opencode\runtime-serve.json`：OpenCode `serve` 实跑记录（版本、help flags、HTTP 状态、鉴权 401、端口关闭确认，密码值不落盘）。
- `analysis\dynamic-ipc-{deepseek,minimax,wb,zcode,traecn}.json`：逐文件还原的 IPC 调用分类（literal / template / resolved 常量 / 未定 expr）、常量表规模、前 20 个还原通道与未定表达式；MiniMax 文件已补 `closure`/`counts_after`（332+406、804 个调用点、0 未定）；`dynamic-ipc-traecn.json` 是旧坏样本（只扫 47 文件、把 `__is_disposable_tracked__` 当通道），结论已作废。
- `analysis\traecn-ipc-final.json`：重建后的 Trae 账本——135 个显式 IPC/sender 调用（73 ipc + 62 sender）、58 条非字面量、56 条映射到 30 个唯一通道、2 条 wrapper/response 非通道值、0 条未定。
- `analysis\cursor-ipc-final.json`：Cursor 的 50 条原始记录账本——44 个 Electron 调用点（15 ipcMain + 17 ipcRenderer + 11 webContents.send + 1 postMessage）、1 条静态字面量、6 条 js-debug WebSocket 误匹配；29 条常量记录、20 个唯一动态通道、12 条 helper、1 条 4 路守卫、1 条 `e.responseChannel`、0 条未定。
- `analysis\qoder-ipc-final.json`：Qoder 四版本动态 IPC 账本——13 条记录（0.5.6 5 条 / 0.5.7 0 / 0.5.12 0 / 0.5.14 8 条）、13 条全部还原、6 个唯一通道、0 条未定；含自定义 base64 表旋转偏移 283/200 与 `arms:rum-*`、`diagnostics:renderer-responsiveness`、`mcp-app:guest-message` 精确通道。
- `analysis\qoder-aoq-sdk.json`：Qoder `aoq-electron-sdk` 账本——包版本 `1.2.0-57793950`、仓库 `NLS-RTC-Service/aoq-client-sdk`、43 个 `IAoqClientEngine` 方法、45 个 `IAoqElectronBridge` 方法、四版本原生四件套大小/SHA256、DLL 的 `Ali_RTC`/`rtc_core`/`aliyuncs.com` 标记、四版本 asar app 引用扫描（各仅根 `package.json` 1 次、0 import、SDK 外 0 个 `aoq` 路径）。
- `analysis\opencode-ipc-final.json`：OpenCode 的 5 条动态 IPC——`vi`/`Vr` 主进程发送、`t`/`n`/`r` preload 监听/调用，全部配对回 `opencode:drag-cancel`、`desktop-rpc-port`、`desktop-window-snapshot` 3 个已有静态通道，0 条未定。
- `analysis\xhz-ipc-final.json`：小浣熊 34 个非字面量 IPC 账本——16 个固定通道记录（11 个唯一）、3 个模板记录（feedback 3 成员 / browser-overlay 按 owner）、1 个 `VOICE_INPUT_CHANNELS` 7 通道清理循环、14 个 helper/cleanup 形参、0 条未定。
- `analysis\doubao-ipc-final.json`：豆包原生桥总账——848 个 Neotix 原生方法 / 98 个命名空间、111 个字面量调用点 / 52 个方法（50 命中 + 2 个版本门控）、41 个 LarkAPI.ipc 调用点 / 3 个通道（`DOC_IFRAME_REMOVE` 28、`DOC_IFRAME_PUSH` 7、`COMMAND` 4）、259 个 applet API 名 / 659 次引用 / 145 文件，另含 Agent Tool IPC 命名管道、app proxy WebSocket、MCP stdio、secure-proxy、PIP 三族命名管道后端记录，以及 `biz.pak` 三片统计。
- `analysis\doubao-pak-shards.json`：豆包 `biz.pak` 三片重跑账本——ahalets 5,907 / 832,342、static 3,597 / 628,680、rest 58 / 10,289；合计 9,562 模块 / 1,471,311 节点 / 4,072,587 边 / 1,274,239 函数 / 8,973 endpoint / 335 路由 / 166,986 bundle 模块；含与单图的逐项差账、2 条 IPC 的 Lynx 方法解码。
- `analysis\doubao-neotix-apis.json`：从 `Doubao.dll` 抽出的 848 个 `neotix::<namespace>::<method>` 注册表（98 个命名空间，`cloudComputer` 48、`audioRecorder` 45、`computerUse` 34、`system` 32、`sandbox` 31）。
- `analysis\doubao-larkipc-allcalls.json`：41 个 `LarkAPI.ipc` 调用点原文——28 个 `DOC_IFRAME_REMOVE`、7 个 `DOC_IFRAME_PUSH`、4 个 `COMMAND`（含 `EXPORT_SIGNATURE_TO_DOCX`、`CLOSE_MESSENGER_APP_CHAT_WINDOW_TABS`、`CLOSE_MESSENGER_URGENT_CARDS`）、2 个 `getCurrentId`，0 条未定。
- `analysis\doubao-applet-apis.json`：259 个 `doubao.*` / `applet.*` 字面量 API（185 + 74）与 659 次引用、145 个文件；含 `doubao.callMcpTool`、`applet.invokeTool`、`doubao.setStorage`、`applet.subscribeEvent`。
- `doubao-pak-jsmap-full.json`：豆包 `biz.pak` 解包后的单张主前端图，9,797 模块 / 166,986 bundle 模块 / 881,872 函数 / 2,928,056 边 / 8,988 endpoint（1,231 唯一）/ 335 路由；1,000,000 节点硬上限丢弃 615,501 节点，`ipc_channels=2` 是 `getScrollInfo`/`postMessageSync` 方法名误匹配。
- `doubao-ahalets-jsmap.json` / `doubao-static-jsmap.json` / `doubao-rest-jsmap.json`：`biz.pak` 的三片重跑图——ahalets 5,907 模块 / 832,342 节点 / 2,227,188 边 / 744,765 函数、static 3,597 / 628,680 / 1,821,726 / 519,774、rest 58 / 10,289 / 23,673 / 9,700；合计 1,471,311 节点 / 4,072,587 边 / 1,274,239 函数，166,986 bundle 模块与单图完全相等。
- `doubao-pak\`：从 `biz.pak` 解出的 10,029 个资源（7,837 JS / 1,125 CSS / 369 HTML / 212 SVG / 15 JSON / 460 二进制），按 manifest 的原始路径落盘。
- `analysis\doubao-native-tokens.json`：`Doubao.dll`、`liblark.dll`、`agent_infra.dll`、`mcp_helper.dll`、`aiep_ipc.dll`、`secure-proxy-ipc64.dll`、`AhaMuleLocalSDK.dll`、`vm_sdk.dll`、`sbox_sdk.dll` 的 `Neotix` / `neotixChannel` / `SHELL_API_IPC_EVENT` / `\\\\.\\pipe\\` / `MCP` / `127.0.0.1` 命中与上下文。
- `analysis\doubao-link-router.json`：`DoubaoLinkRouter.exe` 账本——ProductName/版本/签名/SHA256、Aha/Saman 源码路径、`doubao:/`/`doubaoap`/`/open-ur` 前缀、`Software\Doubao`/`Software\DoubaoWork` 注册表、`Doubao.exe`/`DoubaoWork.exe` 目标、客户选择与遥测字段、10 个导入 DLL 且 0 个网络 DLL；附 `push_detect.exe` 的 WinAppSDK bootstrap 与 name-only 记录。
- `analysis\doubao-proxy-launchers.json`：`Doubao_proxy.exe` / `Doubao_browser_proxy.exe` 账本——FileVersion 147.0.7727.149、Product Doubao、SHA256、Chromium `launch_win.cc`/`LaunchProcess`/`LaunchElevatedProcess`/`ShellExecuteExW`/`command_line.cc` 与 `Chrome.MessageLoopProblem.*` 证据；导入表解析为空，角色按启动器证据判定，运行期未验证。
- `analysis\zcode-channel-map.json`：从 `out/preload/index.cjs` 的 `var v={...}` 解析出的 169 项 `zcode:*` 通道表。
- `analysis\dynamic-ipc-zcode-resolved.json`：ZCode 早期 215 条已还原调用（169 个唯一通道）与 12 条别名；最终闭环结果在 `dynamic-ipc-zcode-final.json`（227/227、180 唯一、0 未定）。
- `analysis\dynamic-ipc-wb-final.json`：WorkBuddy main 侧 115 条 `ipcMain` 注册的最终分类（82 resolved/const + 29 template + 4 helper 形参，0 未定）。
- `analysis\deepseek-ipc-final.json`：DeepSeek 116 个 ipc 调用点的逐条通道映射（102 业务 + 14 清理、54 个唯一通道），含 142=102+40 工具重复条目的汇总字段。
- `analysis\frontend-<target>.json`：前端结构化摘要（IPC、窗口、暴露键、endpoint、模块关键词）。
- `analysis\evidence-ids.json`：目标 → evidence id 映射；`analysis\evidence-map.json`：证据号 → 摘要/路径。

**非 craft 证据（文件级/字节级，正文已标注）**：

- Qoder `app.asar.unpacked` 的 24 个原生文件清单（`keytar.node`、`aoq_node_ext.node`、`AoqClientSdk.dll` 等），0.5.6 与 0.5.14 同构。
- OpenCode `resources\app.asar` 字节级检索 `localhost:4096`，命中 `dialog.server.add.placeholder` i18n 文案。
- Trae `UserData\ModularData\ai-agent\command-execution\` 的 543 个会话目录结构（未读命令内容）。
- Trae / 豆包 `sbox_sdk.dll` 的 SHA256 与 `FileVersion`（1.16.0.0 vs 2.1.17.0）。

前端 jsmap 证据号：

| 目标 | evidence id |
|---|---|
| Cursor | ev_f48ad437… |
| DeepSeek | ev_ce7bcd8d… |
| 豆包 | ev_e0abf81c… |
| MiniMax | ev_07220c3a… |
| OpenCode | ev_381f0a96… |
| Qoder 0.5.6 | ev_15085ef1… |
| Qoder 0.5.7 | ev_caf71a90… |
| Qoder 0.5.12 | ev_fa21f425… |
| Qoder 0.5.14 | ev_6e0090db… |
| Trae CN | ev_84c1dba4… |
| WorkBuddy | ev_9543bb87… |
| 小浣熊 | ev_fb77c73a… |
| ZCode | ev_8277c347… |

复现命令（单目标示例）：

```powershell
$cli = "C:\Users\Administrator\AppData\Local\craft-anything\0.5.0\craft-anything-cli.exe"
$proj = "C:\IHUI-AI\.workbuddy\craft\all-ai-apps-full-2026-11-25.cany"
& $cli --project $proj --deep js-app-map --input-path "C:\workbuddy\resources\app.asar" `
  --max-files 400000 --max-file-bytes 67108864 --max-total-bytes 4294967296 `
  --max-nodes 1500000 --limit 50000 --output-format json
```

```powershell
& $cli --project $proj --deep native-strings-find `
  "C:\workbuddy\resources\app.asar.unpacked\cli\vendor\sandbox\5.11.4\sandbox-center.exe" `
  --pattern "approval|permission|policy" --mode regex --limit 5000 --output-format json
```

---

**结论一句话**：上一版是“五个程序各跑几条命令”；这一版是二十处纠正、11 个程序、8 个 asar 解包、16 张前端图（原有 14 张 + 豆包 `biz.pak` 第 15 张 + Codex `app.asar` 第 16 张）外加 `ahalets` / `static` / `rest` 三张分片图（1,471,311 节点、166,986 bundle 模块与单图完全相等）、26 个实际存在的原生二进制（+1 个 `not_found`）的导入/导出/签名/字符串/函数取证，并把“产品级 / 框架级 / 未知”三分。真正能落进 IHUI-AI 的不是“某个产品有沙箱”，而是**权限决策对象、Job Object 执行器、审批反向通道、preload 预算、动态通道注册表、运行时策略热更新**这六件事。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->

