<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# WorkBuddy 5.11.4 · agent-harness 全量图谱与原生 addon 层取证（2026-11-20）

> 性质：**取证升级**，关闭 2026-11-19 报告 §7 仍开着的最后一条限制——"WorkBuddy 四件为抽取件，未做全量模块扫描（11,587 个模块）"。本轮第一次对 `WorkBuddyAI 5.11.4` 跑 REA 全量 JS 图谱，并把原生 `.node` addon 逐枚溯源到它所属 npm 包，补 2026-11-14 原生册只走 asar/grep 面、未做 addon 实体定位的缺。
> 落地对账**不在本册重复**：能力矩阵与 20 项落点以 `docs/agent-harness-benchmark-2026-11-19.md` 为准，Qoder 六子系统对账以 `qoder-capability-gap-matrix.md` 为准，原生横向结论以 `trae-workbuddy-native-rea-20261114.md` 为准（§0.6 单一真相源）。本册只新增"WB 全量 + addon 溯源"这一层证据，并据此给 WB 侧的收口裁决。
> 只读：未运行被分析程序，未改其任何字节，不脱壳、不提取凭据。红线同 §0.12——不粘专有源码、不破解许可证、不绕付费。

## 1. 工具链与靶体（现读，可复核）

| 项 | 值 |
| --- | --- |
| 引擎 | `rea-agents@6.4.0` 全局（`D:\DevEnv\tools\npm-global\node_modules\rea-agents\scripts\rea.mjs`）；`craft-anything-cli 0.6.1`（`D:\DevEnv\craft-anything\0.6.1`，doctor healthy、MCP self-test 30 工具）；Ghidra 12.1.4 + JDK 21（`rea doctor` ghidra 全组 healthy） |
| 机主给的快捷方式 | `E:\桌面\rea-rea-agents-6.4.0.lnk` 实测不存在（E 盘未挂载）→ 取证一律走 D 盘在位件，属环境事实差异非"没跑"（与 `agent-harness-benchmark-2026-11-19.md §2` 同口径） |
| 靶 A | `D:\电脑软件\WorkBuddyAI\resources\app.asar` · 172,752,516 B · `WorkBuddy AI.exe` 版本 `5.11.4.0`（agent-harness scope `@genie`） |
| 靶 B（身份对照） | `D:\Huorong\WorkBuddy\` 5.11.3（非 AI 版）；`@genie\agent-harness` 即其 CLI 的 agent 引擎 |
| 原生 addon 解包点 | `…\resources\app.asar.unpacked\node_modules\@genie\agent-harness\{bin,cli\bin,cli\vendor,vendor}` + `koffi` / `@lydell\node-pty-*` / `@ban-dal\os-bridge-*` / `perf-metrics` |
| 长跑死因记录 | 首次以"全量 1 asar"派生：Qoder 0.5.13 跑通（189 MB 图谱，子进程 exit 0）；deepseek 旧册那条"子进程 V8 OOM exit 4294967295、只回 partial_observation 错误信封"在 Qoder **根** asar（旧 0.5.3 壳 + 4346 文件，含全部 node_modules）上复现一次——`--max-heap-mb 6144` 在 5108 条目全量上仍炸，按"语义分析未启动"降级；本机物理内存 31.8 GB、并发席位常驻时 free ~4–5 GB 是 OOM 诱因。本轮产物均走 `.qoder-versions\0.5.13` 真实身（见 §4） |

## 2. WorkBuddy 5.11.4 · REA 全量 JS 图谱（首扫）

`analyze-javascript-application <app.asar> --integrity-policy record-and-continue --analysis-timeout-ms 480000 --max-heap-mb 6144 --format json`，覆盖率 `status=partial`（`javascript_analysis_parent_result_budget_bytes = 1,985,231,524` 触顶，parent 对尾部 chunk 保留静态观测、未起语义分析；这是 REA 容量上界，非靶体故障，逐条写进 `limitations`）。

| 量 | 读数 |
| --- | --- |
| relevant_files / parsed_javascript / modules | 9,089 / 8,481 / **769** |
| visited_ast_nodes / findings / parse_failures | 35,951,597 / 123,658 / 22 |
| 应用图 graph | nodes 34,578 / edges 36,362 |
| 语义图 semantic_graph | nodes 33,804 / relations 23,248 / unknowns 109,662 |
| **context_bridge_apis / exposed_api_members** | **83 / 38** |
| **ipc** operations | **178**（literal 62，dynamic 99；renderer_transmissions 97，main_handlers 61，paired 12，unpaired_literal 25，ambiguous 0） |
| utility_processes | 1 |
| **native_addon_bindings / resolved** | **2 / 2** |
| sender_validation_observations | 58 |

读法：相对 2026-11-14 只抽 4 件的旧账，全量首扫把 WB 的宿主面量化了——它是 **Electron contextBridge 型桌面壳**（83 组 preload 暴露 API + 178 IPC operations），这一层 IHUI 桌面是 Tauri（Rust command + 无 contextBridge），**结构上不对应**（与 W1/W2、20261114 同源结论一致：不抄 Electron 桥）。`native_addon_bindings: 2` 是 REA 从 JS 侧静态可归属的 `.node` dlopen 绑定数（其余 addon 经 `@genie` 内部注册，不表现为字面 `require('*.node')`），故 §3 用文件系统解包实体兜底枚全。

## 3. 原生 addon 层 · 逐枚溯源与对账（本节是 net-new）

`.node` 实体落在 `app.asar.unpacked`，逐个定位到所属包，据此判"agent 引擎原生面"与"产品绑定"两类：

### 3a. `@genie/agent-harness` —— WorkBuddy 的 agent 引擎原生面（与 IHUI `apps/cli`/ai-service agent loop 同类）

| addon | 体积 | 归属路径 | 能力 | IHUI 对账 |
| --- | --- | --- | --- | --- |
| `job-object.node` | 291 KB | `@genie\agent-harness\cli\bin\native\win32-x64` | Win32 Job Object 把子进程随父而终止 | 🟢 **S6 已复现并超越**（脱离式看门狗 + 判据纯函数化 + unjudged 不动手；见 `parent-bound.ts`）。**本册补一条归属更正**：旧头注写"对照 WorkBuddy 主程序"，实为 `@genie/agent-harness` 自带，归属更精确，行为同向不变 |
| `process-snapshot.node` | 68 / 32 KB | `@genie\agent-harness\bin\native\{darwin-*}` | 进程快照（崩溃/子进程状态捕获） | 🟡 **新增候选，非缺件**：IHUI 有 app 级会话体检（20 项落点 §5.16），但对工具执行瞬间的**子进程原生快照**无对应物。要做需落桌面 Tauri(Rust) 原生面 = 新增工具，机主拍板；不在逆向-复现"补已有机制缺陷"射程 |
| `brokered-sandbox-native.node` | 52 / 20 KB | `@genie\agent-harness\cli\vendor\sandbox-center-runtime-kit\shim\native` | **沙箱中心的原生 broker**：每次工具执行前的本地隔离/授权裁判（"brokered execution"） | 🔴 **安全边界扩张，刻意不碰**：2026-11-14 原生册已记 brokered-execution 属"安全边界扩张、不在逆向-复现射程"。全量扫描印证它确实是 harness 自带的原生 broker。IHUI 沙箱是服务端 `subprocess_sandbox` + 远程后端（§5.12），形态不同；把"沙箱裁判"下沉到客户端原生 = 信任模型反转，须专章设计 + 机主授权 |
| `ripgrep.node` | **6,813 KB** | `@genie\agent-harness\cli\vendor\ripgrep\x64-win32` | harness **自带 ripgrep** 做文件检索（即"检索是 agent 基础设施"） | 🔵 **已对等**：IHUI §5.11 已把 `grep`/`glob` 注册为模型工具 + pgvector/BM25 混合 `search_codebase`。"再 vendored 一枚 6.8MB ripgrep"=换实现路径非补能力，且引入体积；AGENTS §"shared 非 Node 宿主纯度/不擅引依赖"取向不搬 |
| `conpty.node`/`pty.node`/`conpty_console_list.node` | 295/85/142 KB | `@lydell\node-pty-*`（开源库，非 @genie） | ConPTY/PTY 交互式终端 | 🔵 **库非机制**：是标准开源 node-pty。IHUI `run_command` 现走非交互管道（20261114 记为刻意的交互性边界）。要"能跑 TUI 子代理"= 接 `portable-pty`，属新增能力 + 桌面原生面，机主拍板 |
| `perf_metrics.node` | 170 KB | `native/perf-metrics`（WB 自带，小） | 原生性能计数器 | 🟡 新增遥测候选，非缺件；同上需桌面原生面专章 |

### 3b. 产品绑定层（WorkBuddy 的社交/设备身份，⚫ 无 IHUI 承接点）

`qimei.node`、`turing_sdk.node`（腾讯设备指纹/风控）、`wechat_copydata_decoder.node`（微信聊天数据解码）、`im-napi.node`、`im_channels_native.node` + `os-bridge.*.node`（`@ban-dal/os-bridge-*` 跨平台 OS 桥，IHUI 等价物是 Tauri Rust command）+ `koffi.node`（通用 FFI 库）——这些把 WB 钉在"微信/IM 生态 + 设备身份"产品形态上，与 IHUI agent 平台架构正交，**如实标 ⚫ 不搬**。`wechat_copydata_decoder` 与 `im_channels_native` 恰印证 WB 主打微信会话接入——这解释了它为何是"办公/IM 助手"而非通用 agent 框架：其差异化在**渠道集成**，在 harness 内核层面对 IHUI 无可借鉴增量。

### 3c. Qoder `native_clipboard.node`（craft-anything 0.6.1 deep 反编译，本轮在位补做）

721,408 B · sha256 `c0dca0ec466ded6f…` · 唯一 N-API 入口 `napi_register_module_v1`。导入表（Ghidra 干净，函数级符号被裁，靠导入 + 引用归能）：`OpenClipboard/EmptyClipboard/IsClipboardFormatAvailable/RegisterClipboardFormatW/SetClipboardData/GetClipboardData/**GetClipboardSequenceNumber**/CloseClipboard`。**结论**：它是 Win32 剪贴板读写 + 格式枚举 + **序列号轮询监听**的 N-API 桥。`GetClipboardSequenceNumber` 这条 20 项报告里列为 🟡"剪贴板序号监听"的候选，本轮**函数级坐实**了它的确切机制（不是事件钩子，是轮序数判变化）。IHUI 桌面如需"感知外部复制"可据此走同一 Win32 序数轮询（纯函数、易测），但 IHUI 现无剪贴板消费点——属新增工具，机主拍板，不擅自立项（§0.9）。

## 4. Qoder 0.5.13 版本刷新（对 2026-11-05 §1 的续）

取 `.qoder-versions\0.5.13\resources\app.asar`（166 MB，真身；根 `resources\app.asar` 5108 条目版分析 OOM 降级，见 §1），全图 nodes 16,740 / edges 18,072 / sem 31,630/23,203，summary：ipc operations 8（全动态 channel）、sender_validation 11、context_bridge_apis 0（Qoder 主进程不用 contextBridge，与 WB 相反）、native_addon_bindings 0、parse_failures 16。

- 与 0.5.3 基线一致项：MCP 全家桶（含 `@modelcontextprotocol/server`）、agent SDK 端点、node-pty + @xterm、sharp/jose/hono 等依赖面**稳定**，33 轴对照结论**不作废**。
- **本轮新见的分发面**（版本包内散件，`resources\{collaboration-cli,node-repl,dynamic-text}` + `extensions\{qoder.canvas,communication,computer-control,desktop-pet-skill,knowledge.center,office,security,sites}`）：
  - `@ali/qoder-collab-cli 0.1.14`（`collaboration-cli`）：把"协作平台操作"装成**宿主注入的 CLI**（dist/host 1.38 MB bundle）+ 一份 `skills/desktop/SKILL.md`（教 agent 怎么调）：定身份三态 `User/RuntimeOwner/RuntimeAgent`、`--json`/`--schema`、`partial_success` 带 `updatedFields/skippedFields`/`never replay successful fields`、`outcome_unknown` ⇒ 先读回执再重试。
    **对账（不新立判定）**：这套"副作用幂等 + 部分成功记账 + 不确定态先回读"纪律，IHUI **已在两处独立具备**——DB 写侧 `check-batch-write-count-honesty`(门 134) 强制 `.returning({id})` 回库 + `missedIds`；ACP 侧 `apps/cli/src/acp/recovery-policy.ts` 已含 `outcome_unknown/partial_success` 语义。故 collab-cli 是**产品形态**（Qoder 云 Projects/Issues/Discussion，对标 `qoder-capability-gap-matrix.md` 系统二 `discussion_*` 已判 ⚫）而非新机制，纪律层 IHUI 已对等。
  - `qoder.office`（pdfjs-dist/mammoth/jszip/underscore）+ `qoder.knowledge.center`/`qoder.canvas`：文档解析与知识画布，属 IHUI 已有的文档/资料侧产品面，非 agent-harness 内核增量。

## 5. 收口裁决（WB 侧）

- 全量首扫后，`@genie/agent-harness` 的**通用引擎原生面**（Job Object 随父终、检索基础设施、命令三段决策对应的 brokered-sandbox）**IHUI 要么已落地并超越（S6/§5.11）、要么属"形态不同"而非缺件（Tauri 桥 vs Electron contextBridge、服务端沙箱 vs 客户端 broker）**。
- 真正的**新增面**经本席 18:35 现读逐枚核到三态，并**更正本册前一轮把②误列"零落地"的事实性判错**（判错认账）：
  - **② 交互式 PTY / 跑 TUI 子代理 = 🔵 已落地，更正为"非候选"**：本仓 `apps/ai-service/app/services/interactive_terminal.py`（2026-11-14 立）已做**长寿命交互会话闭环**（`open/send/read/signal/close/list_terminal` + Windows `CTRL_BREAK_EVENT` 进程组 + 按 (user_id,session_id) 越权与不存在同形），比 deepseek-tui 一次性 run 与 WB 的 conpty 语义在中枢能力上等价。它**仅剩一条本模块 docstring 第 20-22 行自己有意记录并如实标注**的边界：「这里用**管道而非 PTY**，需 `isatty` 才出进度的程序会降级块缓冲」。把这有意记录的设计差异当"漏掉的缺陷"补 = 推翻工程决策，且补真 PTY 要 **①引原生 PTY 库（winpty/pywinpty）②改 `sandbox._strict_child_env` 严档环境白名单**——属沙箱受控面扩张，**须机主拍板，不由本席塞依赖当场半成品**。前一轮我凭印象把②当"零落地待拍板候选"，未读 `interactive_terminal.py` 即下判，违反"交底每枚事实须现读确认存在"，在此更正。
  - **（2026-11-20 补记，更正上条末句的"须拍板"前提）Windows 侧真 PTY 已落地**：`apps/ai-service/app/services/interactive_terminal.py` 的"Windows 平台专章"用 ctypes 直连 kernel32（`CreatePseudoConsole` + `CreateProcessW` 启动属性表，折入现有模块、不另立第二份实现），**零第三方依赖、未引 pywinpty/winpty、`sandbox._strict_child_env` 的白名单一列未改**；真 tty 该有的终端身份两键由 PTY 专属的 `_pty_child_env` 以 `setdefault` 补上（`TERM=xterm-256color` / `COLORTERM=truecolor`，缺 TERM 时 `ls --color`/`git`/`less`/`vim` 会按 dumb 终端降级；调用方显式传值仍以调用方为准，管道后端不补）。Windows 实测 `isatty()→True`，交互中断走行规程 `0x03`（子进程退出码 `0xC000013A` = `STATUS_CONTROL_C_EXIT`）；PTY 仍是显式 opt-in（`IHUI_INTERACTIVE_PTY`），宿主探不到 ConPTY 时照旧 fail-closed 硬拒 `TERMINAL_PTY_UNSUPPORTED_ON_PLATFORM`。

  - **（2026-11-21 补记）传统终端原语闭环再补多档**：`resize`（POSIX `TIOCSWINSZ` / Windows `ResizePseudoConsole`，`open` 可直接开在目标尺寸）、`wait_for`（命中/超时/已退出三态）、`keys`（键表单一真相源）、`eof`（三后端语义区分，Windows ConPTY 走 `^Z`+回车）、`paste`（依程序 `DECSET 2004` 决定是否用 `ESC[200~…ESC[201~` 包裹）、`interrupt`（PTY 走输入字节 `0x03`，不再只给首进程发信号）、闲置会话回收（`IHUI_TERMINAL_IDLE_TTL_S`）、缓冲缺口显式上报（`dropped_chunks` / `gap` / `first_seq`），本轮再增 `snapshot`（剥掉转义序列的屏幕快照，末尾 N 行 + `truncated`）与 `search`（同一份归一文本上的 scrollback 检索，支持 regex / ignore_case）。转义归一只有 `strip_ansi` 一处出口，快照与检索共用，不另造第二把尺子；工具层 action 一并接到 `_tool_terminal`。再补 `mouse`：鼠标上报（`DECSET 1000/1002/1003` 由程序"点单"才发，没请求就显式拒 `TERMINAL_MOUSE_DISABLED`，不先发发看）、四代坐标封装（`1006` SGR / `1015` urxvt / `1005` UTF-8 承载远坐标 / 老 x10 单字节上限 223）由同一编码出口 `_mouse_sequence` 产出，修饰键位与滚轮"只有 press"按协议如实表达。
  - **① OS 级子进程树瞬时快照（deepseek `process-snapshot.node` / WB harness 崩溃期活进程树留证）= 本仓无 OS 级等价物（实测：`agents_md_state/auto_compact_window/bounded_ttl_store` 等 `*.snapshot()` 全是**领域对象内存快照**，非 OS 进程树），但服务端命令崩溃归因已由 `sandbox_metrics.py` + 退出码 + 输出缓冲承担、桌面崩溃另走 `crashReportsRoutes`，**当前无现成消费点** → 按 §0.9"声明必须有消费者"不立项；若要将来得先定义消费面（如服务端 run_command 崩溃时的进程树取证端点）。
  - **③ 原生 perf 计数器（WB harness `perf_metrics.node`）= 🔵 已对等/更贴**：本仓 `apps/ai-service/app/core/sandbox_metrics.py` + `middleware/agent_metrics.py` + `core/turn_timing.py` + `startup_prewarm.py` 按业务语义（沙箱/agent 调用轮/回合时延/预热）做度量，比对照的裸 native CPU 计数器更贴 IHUI agent 平台。
  - 剪贴板序数监听见 §3c（craft 已函数级坐实 = `GetClipboardSequenceNumber` 轮询，IHUI 现无消费点）。综上，三枚原生面**无一构成"可单方落地且不撞他席、且有消费者"的缺口**——②是唯一有真实增量价值的升级，但它落在沙箱受控面，按 §0.10 失效方向应是"多要一次定向拍板说明"，不是放宽自补。
- **与 `qoder-capability-gap-matrix.md` 终判合流**：那里 Qoder 侧已收口"能榨的已榨干，剩余要么需先建前提基建要么平台绑定"。本册给出 **WB 对称结论**——WB 全量扫描 + addon 溯源后，harness 通用机制无一遗漏地对位或证明"形态不同非缺件"，余下是微信/设备身份产品绑定（⚫）与上条已逐枚核到三态的原生面（②已落地：真 PTY/ConPTY 与终端身份键均在，沙箱严档白名单未改 / ①OS进程树快照无消费者不立项 / ③已对等）。
- 至此 2026-11-19 §7 唯一还开着的"WB 未全量扫描"限制**关闭**：升级为"已全量扫描（9,089 文件 / 769 模块 / 34 native-addon 节点 / addon 逐枚源码归属）"。
- **命令审计档（deepseek `default|allow|deny|audit` 四值枚举）＝ 🔵 本轮主动试做、被证据证伪为"已对等/更全"，明确不造**：本席 18:25 现读核证 IHUI——`mcp_server.py:4305,4323,4346` 有运行期 `_exec_mode=="audit"` 观察态（PROMPT/DENY 记录后放行，普通模式 DENY 仍硬拒不降级）；`apps/api/src/routes/cli-tool-invoke-audit.ts:6–39` 每次工具调用无条件进 HMAC 审计链 `audit_logs_chain`（0 新表，`accepted` 取库侧确认集 = 门 134 同律）；`mcp_server.py:18798/18868/18902` `_audit_logs`+`get_audit_logs()` 第三处承载。对照把 `audit` 做成"逐命令枚举档"，IHUI 以"全进程可切观察态 + 全局防篡改留痕"承载，更宽且与阻断裁决解耦——故**不给 `Decision` 加第四态**（加它会把"是否阻断"与"是否留痕"重新耦合进 `_SEVERITY{allow:0,prompt:1,deny:2}` 与 `detect_shadows`，正是并行席对 `input_replacements` 同型要避的"牵动核心类型"架构级改动）。登记此负结论免后续席位重复踩（同 `qoder-capability-gap-matrix.md` §5 `peer_devices` 复核更正型）；未粘对照枚举源码、未触发凭据/付费面。

## 6. Limitations（如实，不冒绿）

- 全量图谱 `coverage=partial`：parent 结果预算（≈1.9 GB）触顶，尾部 chunk（含 `wb-webview-preload.js`、`tdoc-*-preload.js`、若干内置 skill 资产 JS）"语义分析未启动"——**ipc 178 / context-bridge 83 是已归属下限，非总数**；不得把"未起语义"读成"不存在"（§0.3）。
- `brokered-sandbox-native`/`process-snapshot` 等只到"文件实体 + 所属包 + 命名语义"，**未做反编译**（本机并发席位常驻、free ~4–5 GB，且 20261114 已记 harness `ai_agent/harness.dll` 类大体积 Ghidra 全量 >1h 超时）；其"具体系统调用差异/夹紧点"仍未知，不作安全结论。
- `@genie/agent-harness` 是 WorkBuddy 自有包（scope `@genie`），其 `.node` 多为 stripped 符号；归能用"引用串 + 包路径"，不是函数名。
- deepseek-tui 原生函数级证据的权威在并行席已入库的 `deepseek-tui-native-20261120.md`；本席 36 MB 主体只做**字符串锚点级**复核（compaction/snapshot/sandbox/hook/subagent/approval/checkpoint/cycle_threshold/CapacityConfig/prompt_cache 计数均命中，佐证该册），不重复其函数级表，遵 §0.6 单一真相源。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
