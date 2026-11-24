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
| REA 6.4.0 | **12:33 补装实证**：`npm install -g rea-agents@6.4.0`（`D:\caches\npm\prefix\node_modules\rea-agents`）成功；真实 MCP 握手 `initialize`→`tools/list` 报 `rea@6.4.0`、协议 `2025-06-18`、**170 工具**。`rea doctor` 11/17 绿（Ghidra 12.1.4/headless/原生反编译器全绿；6 项 NOT-OK 全是 Hopper/IDA 可选引擎与各客户端 MCP 注册漂移，非分析核心）。旧结论"全盘无落盘"只查了盘、没查 registry 与 npx 回退，已纠正 |

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
- 未运行目标程序；未粘专有源码正文；未破解/绕过/提取凭据。工具缺失两档的处理见 §7（12:30 后补装实证，旧"缺失"结论已纠正，未伪造任何取证结果）。

## 7. 工具链缺口补装实证（2026-11-24 12:30 后，纠正 §1 旧结论）

§1 写"craft 0.6.1 / REA 6.4.0 盘上缺失 → 未采用"是**只查了盘、没查 registry 与官方源**的疏漏。12:30 后逐项补齐并实测：

### 7.1 REA 6.4.0 —— 已钉装并真实握手

- **获取**：`npm view rea-agents versions` 确认 6.4.0 在册（registry `npmmirror`）；`npm install -g rea-agents@6.4.0` 成功（`added 144 packages`），落点 `D:\caches\npm\prefix\node_modules\rea-agents`，`package.json.version=6.4.0`。此前 `scripts/rea-mcp-entry.mjs` 的 resolveGlobalReaCli 首选路径与 npx 回退路径**本来就可用**，旧结论"引擎缺失"不成立。
- **npx 路径独立验证**：`npx -y rea-agents@6.4.0 --version` → `6.4.0`（退出码 0）。
- **真实 MCP 握手（两种独立验证）**：
  - **REA 官方自检**：`rea mcp doctor --format json` → `healthy=true`、`adapter=production-stdio`、`rea@6.4.0`、协议 `2025-11-25`、**工具 expected=observed=170**（missing/unexpected/duplicates 全空）、prompts 6/6、identity 与 catalog digest `85d80276…` 匹配、`request_flow(binary_session)` ok、`stderr_bytes=0`。产物 `rea-mcp-doctor.json`。这是引擎方最权威的自证。
  - **项目入口实测**：`spawn node scripts/rea-mcp-entry.mjs`（验证器 `.ihui-agent/tmp/r12/rea-mcp-handshake.mjs`）按 **newline-delimited JSON** 发 `initialize`/`tools/list` → `rea@6.4.0`、`protocolVersion=2025-06-18`、**170 工具**。首次用 Content-Length framing 超时、换换行分隔成功——观察：REA 生产 stdio transport 在此入口下按 ndjson 应答。`.ihui/mcp.json` 给 `rea` 标 `"framing":"content-length"`，而项目 runtime（`apps/cli/src/tools/mcp-runtime.ts:1061`）据此编码收发、注释也称"官方 MCP stdio（含 REA）用 content-length"——这与本实测是否构成真实不兼容，**需项目 CLI 连 REA 复核后再定**（本票不改配置、不臆断）。
- **doctor 分级**：`rea doctor --format json` → `healthy=false`、`11/17 checks ok`；6 项 NOT-OK 全是**非分析核心**：`hopper`（可选分析引擎缺失）、`ida-registration`（未配置）、`skill:identity`、`registration:codex/cursor/opencode`（各客户端 MCP 注册漂移）。**Ghidra 全链绿**：`ghidra`/`platform`/`architecture`/`installation`/`version 12.1.4`/`headless`/`native_decompiler(pe x86_64)` 全 ok ⇒ 原生二进制取证能力在位。
- **能力面**：`rea --help` 列出 `analyze-javascript-application`、`decompile`、`compare-application-versions`、`capture-*-scenario` 等完整命令集；`rea capabilities --format json` 可见 provider 级 availability/effects/limitations（macOS-only 项如 `capture_native_ui_scenario`/`demangle_swift` 正确标 `unsupported_host`）。
- **静态取证实跑（诚实边界）**：对 Cursor app 目录跑 `rea analyze-javascript-application`（`--artifact-format directory --analysis-timeout-ms 120000`，**不运行目标**），240s 外层超时（`REA_EXIT=124`）——进度只到 `parse_javascript_source 58/19564`。**观察**：REA 的逐源解析模型在 19,564 文件规模的 Cursor app 上不适合全量取证（4 分钟仅 58 文件），这与 craft `js-app-map` 的整图索引模型不同；结论 = REA 已补装可用（MCP 握手/doctor/Ghidra 链实证），但**对本文目标不是合适的主取证工具**，本文两条欠账仍以 craft 0.5.0 静态攻下为准。产物：`.ihui-agent/tmp/r12/rea-cursor-js.err`（10,959 B 逐条进度）。未伪造分析结果。
- **REA 独占增量取证（Ghidra 函数级，成功）**：改用 REA 擅长的原生件路径——对 Cursor 的 `node_modules/native-is-elevated/build/Release/iselevated.node`（PE x86_64，sha256 `ec5696e70e0bd0a2…`）跑 `rea analyze --provider ghidra` 与 `rea inspect-artifact`，**均成功**（不运行目标）：
  - `inspect-artifact` → Evidence `ev_a28c909b…`，provider `rea-artifact-graph`，`inventory_artifact:completed`，manifest 1 node / 0 edge，graph_sha `fc84fb5f…`。产物 `rea-iselevated-inspect.json`（6,804 B）。
  - `analyze --provider ghidra` → Evidence `ev_3964ff8b…`，**490 procedures / 290 strings / 10 segments**；节表含 `.text[0x180001000..0x18000ec00]`(56,320 B)、`.rdata`(40,960 B)、`.didat`、`.fptable`、`.reloc`、`tdb[0xff00000000..]` 等。产物 `rea-iselevated-analyze2.json`（3,332 B）。
  - **修改说明**：首次 `analyze` 用 `C://Users//...` 双斜杠路径失败（`ERR_REA_WINDOWS_NATIVE` "Ambiguous Windows path component"），改单反斜杠正确路径后成功——是参数传递问题，非引擎缺陷（留痕 `rea-iselevated-analyze.json` 失败证据）。
  - **价值**：这是 craft `js-app-map` 给不出的**函数级原生证据**，补足了 §4 原生模块清单只有名字、无函数计数的空缺；但按 §5「本仓等价覆盖」判据，它仍是**证据增量而非能力缺口**（本仓 Tauri 已用 Rust 原生层），不新增代码。

### 7.2 craft MCP 配置 —— 不是"缺工具"，是**路径漂移**（已修复）

- **真相**：项目 `.ihui/mcp.json` 本来就配了 craft MCP server（`mcp --all-tools --allow-run`），但 `command` 指向 `D:\DevEnv\craft-anything\0.6.1\craft-anything-cli.exe` —— **该 exe 盘上不存在**（0.6.1 从未落盘）。本机现成的 `0.5.0\craft-anything-cli.exe` 完全支持这套参数。**所以缺口不是"工具缺失"，是配置里一个失效的绝对路径**。
- **实测**：`craft-anything-cli 0.5.0 mcp --help` 确认 `--all-tools`/`--allow-run`/`--deep` 全支持；`capabilities` 报 **17 toolsets / 321 工具**。写验证器 `.ihui-agent/tmp/r12/craft-mcp-handshake.mjs` 按项目原参数 spawn 0.5.0 exe 做真实 MCP 握手：`initialize` → `serverInfo={name:"craft-anything",version:"0.5.0"}`、`protocolVersion=2025-06-18`、`tools/list` **321 工具**（`core_target_open`/`native_cursor_show`/…），**握手成功**。
- **修复**：把 `.ihui/mcp.json` 的 craft `command` 从失效的 `0.6.1` 路径改为现成可用的 `0.5.0` 路径（单值改动，其余参数原样）。修后 JSON 合法、路径存在、握手实测通过 ⇒ 项目 craft MCP 配置真正可用。
- **0.6.1 下载的处置**：曾从 GitHub Releases `v0.6.1`（含 `SHA256SUMS.txt`）下载 portable zip，但带宽仅 ~10KB/s，`D:\DevEnv\craft-anything\0.6.1\` 下 zip 停在 37.5MB/69.9MB，**SHA256 不匹配（未完成）⇒ 不解压、不声明可用**。release notes 显示 0.6.1 变更以 R3.12 原生解析器健壮性为主、**对 js-app-map 零增量**，不值得为它耗时。
- **纪律**：不伪造 0.6.1 可用性；不删半成品 zip（留痕下载中断事实）。

### 7.3 对本文结论的影响

- 两条欠账（63,655 节点截断、31 动态 IPC）本就是 craft 0.5.0 静态攻下，与工具版本无关；§2–§6 全部结论**不变**。
- 修订：§1 与 §6 里"工具缺失=未采用"措辞作废 —— **REA 已补装且官方 doctor 全绿（170 工具）**；**craft 不在缺工具，是 MCP 配置路径漂移，已修指向 0.5.0 并握手 321 工具实证**；0.6.1 下载中断如实登记、不声明可用。证据以本节为准。
- 未运行任何目标程序；未粘专有源码正文；未破解/绕过/提取凭据。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
