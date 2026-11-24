<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# Cursor 3.27.22 运行时动态面深度取证（2026-11-24）

> 承接 `native-functions-2026-11-24.md` 与 `r12/REPORT.md` §六/§八/§九遗留的两条证据欠账：
> ① `js-app-map` 报 63,655 图节点被 2,500 上限截断；② 31 个 IPC channel 名"运行时计算、不在 channel map"。
> 本轮把两条都**实质攻下**：不是靠运行目标程序，而是靠提高静态分析上限 + 静态追常量定义。
>
> 纪律：全静态取证，未运行 Cursor 本体；只读安装目录；不粘对方源码（每条连续片段 ≤10 行，
> 下文只给符号名/常量名 + 文件:行，不给实现正文）；三档（观察/推断/未知）分开写。

## 1. 工具链现读（当次实测）

| 项 | 值 |
| --- | --- |
| craft-anything CLI | `C:\Users\Administrator\AppData\Local\craft-anything\0.5.0\craft-anything-cli.exe`（0.5.0，本轮唯一可用） |
| `js-app-map` 可调参数 | `--max-nodes` / `--max-files` / `--max-file-bytes` / `--max-total-bytes` / `--limit` / `--include-node-modules`（`craft js-app-map --help` 现读） |
| 目标安装根 | `C:\Users\Administrator\AppData\Local\Programs\cursor\resources\app`（存在，Cursor 3.27.22） |
| craft 0.6.1 | `D:\DevEnv\craft-anything\0.6.1\` 盘上不存在（`.ihui/mcp.json` 仍指向它）→ 未采用、未伪造 |
| REA 6.4.0 | `rea-agents` 全盘无落盘（`scripts/rea-mcp-entry.mjs` 在但引擎缺失）→ 未采用、未伪造 |

## 2. 欠账①：节点截断 —— 已攻下

三次同目标重跑，只改 `max_nodes`（其余同为 `include_node_modules=false`）：

| 轮次 | max_nodes | 实留节点 | edges | 读取文件 | limitation:node_cap | IPC | paired |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 旧 r12 | 2,500 | 2,500 | 10,000 | 530 | `63655 dropped` | 13 | 0 |
| 本轮 A | 8,000 | 8,000 | 163,559 | 500* | `300636 dropped` | 33 | 12 |
| 本轮 B | 420,000 | **286,220** | **596,047** | 1,859 | **无此条** | 33 | 12 |

- \* A 轮 `limit=500` 只影响模块摘要分页；B 轮 `limit=1200` + `max_total_bytes=419430400` 后读取文件升到 1,859。
- **观察**：`max_nodes=420,000` 时实际图只有 286,220 节点，`node_cap` limitation 消失 ⇒ 2,500 上限下被丢的 63,655 节点全部保留，且远不止此数（旧图是完整图的一个极小切片）。
- **观察**：`functions` 从旧图不可见到 273,475；`bundle_modules=5,063`；`windows` 9→13；`native_modules` 17→33；`routes` 137→351；`endpoints` 927→3,566；`vendors` 491→638；`source_maps` 42→237。
- **推断**：旧报告"13 channel 且 0 paired"是**截断造成的假象**，不是 Cursor 的 IPC 设计；完整图是 33 channel / 12 paired。
- **still partial 的口径**：B 轮 `coverage.examined=1859 / total=15930`，但 `total` 是含 `node_modules` 的全树条目数，而本轮 `include_node_modules=false` 只读源码；这是**口径差**不是截断。余下 `input` 限制仅"4 文件因体积未读"。
- 复核命令（绝对路径，当次可重跑）：
  - `craft --deep js-app-map @.ihui-agent/tmp/r12/appmap-params-full.json --output-format json`（参数文件 `max_nodes=420000`）
  - 证据实物：`.ihui-agent/tmp/r12/cursor-appmap-max.json`（220,744,071 字节）、`cursor-appmap-full.json`（65,597,789 字节）。

## 3. 欠账②：31 个动态 IPC —— 已收窄到具名常量清单

craft 的 `dynamic_ipc_channels` 判据 = "channel 实参非字符串字面量"。用严格静态扫描复现
（只认 `ipcRenderer/ipcMain/webContents/contextBridge` 的 `invoke/send/on/handle/postMessage/...`，
覆盖 `out/ + molten/ + extensions/` 共 777 个 JS/CJS 文件，排除 node_modules）：

- **观察**：严格命中 **43 处动态调用 / 31 个唯一 channel 表达式**，与 craft 在 B 轮报的
  `43 IPC call(s)` 及旧图报的 `31` 精确对齐 —— 扫描器与 craft 判据同口径，可交叉复核。
- **观察**：31 个表达式里绝大多数是**具名常量**（craft 看不到常量值才判"动态"）：
  `CRASH_REPORT_CHANNEL`、`QUIT_CONFIRM_CHANNEL`、`QUIT_AGENTS_CHANNEL`、`QUIT_READY_CHANNEL`、
  `DESKTOP_PORT_REQUEST_CHANNEL`/`DESKTOP_PORT_CHANNEL`、`ENGINE_PORT_REQUEST_CHANNEL`/`ENGINE_PORT_CHANNEL`、
  `ENGINE_DOWN_CHANNEL`、`PTY_HOST_PORT_REQUEST_CHANNEL`/`PTY_HOST_PORT_CHANNEL`、
  `PTY_HOST_UP_CHANNEL`/`PTY_HOST_NOT_RUNNING_CHANNEL`/`PTY_HOST_DOWN_CHANNEL`、
  `PTY_HOST_PORT_IF_RUNNING_CHANNEL`、`PREFS_BOOT_SYNC_CHANNEL`、`RENDERER_PING_CHANNEL`/
  `RENDERER_PONG_CHANNEL`、`POWER_STATE_CHANNEL`、`APP_QUITTING_CHANNEL`。
  出处集中在 `molten/dist/electron-main/host.cjs`（main 侧）与 `molten/dist/electron-preload/preload.cjs`（preload 侧）。
- **观察**：真正"值级动态"只剩 4 类：`e.responseChannel`（请求/响应通道对，`out/main.js:66`）、
  裸 `channel`/`channelName` 形参（`host.cjs:14588/16893`）、`event.data`（`preload.cjs:1150`）、
  `e`（泛型转发，`main.js:53/160`）。
- **推断**："31 个动态 IPC 不可见"实为**静态分析器的字面量判据盲区**，不是运行时才生成的秘密通道；
  常量名本身即 channel 身份，配 `molten/*` 12 对双工通道构成完整宿主 IPC 面。
- **未知**：这些常量的**字面值**未逐个追到（多为打包后单行常量表，追值需展开整份 minified bundle，
  超出"≤10 行连续片段"纪律）；`e.responseChannel` 的具体生成算法未函数级还原。
- 复核命令：`node .ihui-agent/tmp/r12/scan-dynamic-ipc-strict.mjs`（输出 `dynamic-ipc-strict.json`，
  含每条 `file:line` 与源码行）；产物 `.ihui-agent/tmp/r12/dynamic-ipc-strict.json`。

## 4. 新出现的证据面（旧截断图完全没有）

- **GraphQL API operations（10 条）**：`cursor-retrieval/dist/main.js` 与配置编辑/ GitHub 扩展
  访问 `/graphql` / `/api/graphql`；具名 query：`repositoryPermissions`、`repositoryRulesets`、
  `assignableUsers`（`extensions/github/dist/extension.js`）。craft 标 `confidence=inferred`、
  `source=document-text` —— **观察**级只到"这些端点/操作名出现在文本"，**未知**其协议细节与鉴权。
- **`molten/*` 宿主双工通道族**：`molten:crash-report`（`takeWindowReports`↔preload send）、
  `molten:desktop-port-request`/`molten:desktop-port`、`molten:pty-host-port-request`/`molten:pty-host-port`、
  `molten:prefs-boot-sync`（`installPrefs` ↔ `sendSync`）、`renderer-ping`/`renderer-pong`
  （`installRendererPing` ↔ preload）。形态 = 主进程 `host.cjs` 注册 handler + preload 发/收，请求通道与数据通道成对。
- **`exposed` contextBridge 面**：`moltenCrashReport`/`moltenShell`/`moltenPrefs`/`moltenBootPrefs`/
  `moltenBootThemes`/`moltenBootKeybindings`/`moltenBootTerminalSettings`/`moltenBootChatMaxWidth` 等
  （`molten/dist/electron-preload/preload.cjs`）。
- **原生模块（33）**：`tree-chunk-napi`、`better_sqlite3`、`tree-sitter-*`、`whichlang-node`、
  `file_service`、`msal-node-runtime`、`w32appcontainertokens`、`conpty*`、`watcher`、`vscode-policy-watcher`、
  `crypt32`、`CreateMutex`、`windows_process_tree`、`winregistry`、`cursor_proclist`、`kerberos`、
  `iselevated`、`pty`、`foreground_love` 等 —— 与上一轮原生函数级证据互补（本条只是**存在性观察**）。

## 5. 对照判定：本仓是否值得落地等价能力（结论：不造）

逐条对照本仓现状（真跑 grep，路径 + 命中数）：

| Cursor molten 形态 | 本仓对应 | 判定 |
| --- | --- | --- |
| `*_PORT_REQUEST_CHANNEL` / `*_PORT_CHANNEL` 请求-响应配对 | Tauri 2 `#[tauri::command]` 天然 request→`Result` 配对；`apps/desktop/src-tauri/src/bin/ihui_native_host.rs` 已有 oneshot frame 回执（`:54 reply` / `:80 write_frame`） | **已等价覆盖**，且类型安全、编译期注册；造通道常量层 = 纸面件 |
| `RENDERER_PING/PONG` | Tauri webview 生命周期 + `window_chrome.rs`/`auto_refresh.rs` | 等价/不需要；无证据表明有缺口 |
| contextBridge `exposed` 白名单 | Tauri `invoke_handler` 显式命令清单 + `ipc_channel_acl.rs` DACL | 已等价覆盖且更严（SD/DACL 兜底） |
| `crash-report` / `quit-*` 双工 | `QUIT_FORCED_EXIT_GRACE_SECS`（`lib.rs:617`）、`startup_guard.rs` | 已覆盖，不做 |
| GraphQL `/api/graphql` 检索 | 本仓 codebase 检索走 REST + pgvector（P0-8 全链） | 协议选型差异，非缺口；无协议细节证据不足以落地 |
| 63,655 节点截断 / 31 动态 IPC | 取证参数 + 静态判据盲区 | **纯证据问题**，本轮已攻下，非能力缺口 |

依据 AGENTS §0.9「造好没装车 = 没有」与 §0 总纲「重交付结果」：本轮**不新增代码文件**。
交付物 = 本证据文档 + 三份可复核产物（app map × 2、动态 IPC 扫描结果）。

## 6. 三档小结（红线自查）

- **观察**：三次 max_nodes 读数的单调变化；node_cap 消失；43 调用/31 表达式与 craft 对齐；
  31 表达式中具名常量占多数；10 条 GraphQL operations 名；33 原生模块存在性。
- **推断**：旧"13 channel/0 paired"是截断假象；"动态 IPC 不可见"是字面量判据盲区；
  molten 采用请求/数据双工通道配对设计。
- **未知**：channel 常量的字面值；`e.responseChannel` 生成算法；GraphQL 协议/鉴权细节；
  4 个超体积文件的正文；一切运行时交错与时序结论。
- 未运行目标程序；未粘专有源码正文；未破解/绕过/提取凭据。craft 0.6.1 与 REA 6.4.0 缺失照实登记，未伪造。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
