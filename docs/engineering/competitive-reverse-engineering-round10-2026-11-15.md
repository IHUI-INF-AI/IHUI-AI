# Codex 桌面端 26.1111 重取证 · 架构改版差异与新增能力面

<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

> round 10 · 2026-11-15 · 前几轮（round 8/9）取证的是 **Codex 26.1106.6628.0**，本机现已升级到
> **26.1111.2228.0**。本轮在**新版**上重取证：把「仍有效结论」与「改版后新增/失效」分开，
> 重点榨干前几轮未覆盖的新增面（code-mode-host、guardian、requirements.toml 托管策略）。
> 对照程序：`C:/Program Files/WindowsApps/OpenAI.Codex_26.1111.2228.0_x64__2p2nqsd0c76g0/`。

## 0. 改版差异总览（26.1106 → 26.1111）

| 维度 | 26.1106.6628.0（旧） | 26.1111.2228.0（新） | 判定 |
|------|------|------|------|
| app.asar | 772.8MB / 19886 文件 | **783.75MB**（仍在，未消失） | 体积 +11MB，结构未改 |
| unpacked/ 目录 | 存在（MSIX 签名改造的原生二进制） | **已消失** | 原生二进制收编进 resources 顶层 |
| resources/codex.exe | 356MB Rust PE | **382.5MB** Rust PE | 主引擎 +26MB |
| codex-code-mode-host.exe | — | **80.5MB 新增**（Rust + V8） | 全新能力面 |
| codex-windows-sandbox-service.exe | 存在 | 58.5MB（+） | 沙箱服务 |
| codex-windows-sandbox-setup.exe | — | 19.6MB | 沙箱初始化 |
| default_app/（index.html/main.js） | — | **新增**（Electron 默认壳） | 备用默认页 |
| 托管策略层 | config.toml | **requirements.toml + guardian** | 新增企业托管 |

**结论**：架构未推翻（仍是 Electron + app.asar + Rust 引擎），但有三个真实新增面：
① code-mode-host（独立 V8 代码执行宿主）② guardian 自动审查 ③ requirements.toml 托管策略。
`unpacked/` 消失只是 MSIX 打包收编，不是架构变化。

## 1. 旧版核心结论重验（逐条标记有效性）

对 26.1106 的核心结论，在 26.1111 上重跑取证：

| 旧结论 | 新版证据 | 判定 |
|--------|---------|------|
| 四维权限档（sandbox_policy/approval_policy/approvals_reviewer/permission_profile） | strings 命中 `sandbox_policy` / `approval_policy` / `approvals_reviewer` / `permission_profile` 全四维 | **仍有效** |
| Windows 沙箱 API 三件套（CreateJobObjectW / CreateRestrictedToken / SetEntriesInAclW / CreateProcessAsUserW） | 新版 codex.exe 全部命中（JobObject×2 / ProcessAsUserW×4 / RestrictedToken×2 / SetEntriesInAclW×6） | **仍有效** |
| WFP 网络过滤（FwpmEngineOpen0 / network_rule） | `FwpmEngineOpen0` 命中；`network_rule(` / `prefix_rule(` DSL 完整 | **仍有效** |
| Starlark execpolicy DSL | starlark-0.14.2 crate 命中；execpolicy 49 处 | **仍有效** |
| app.asar 消失 / 架构迁走 | find 重新找到 app.asar（783MB） | **已证伪**（误记，未消失） |
| codex-computer-use-swift.exe | 文件不存在 | **已证伪**（误记） |
| codex-code-mode-host.exe | **不存在于旧版，新版 80.5MB** | **新增面** |

## 2. 新增面 A：Code Mode 宿主（本轮最高价值）

`codex-code-mode-host.exe`（80.5MB）是**独立 Rust 进程**，内嵌 **V8 引擎**。取证还原：

### 2.1 技术栈（craft-anything strings + cargo 路径）

- **执行引擎**：V8（`v8::` ×112、`Isolate` ×103、`rusty_v8` ×20、`ExternalPointerTable`、`V8 sandbox`）
- **语言**：Rust（三 crate：`codex_code_mode_host` / `codex_code_mode_runtime` / `code-mode-protocol`）
- **IPC**：gRPC over stdio（`grpc_transport.rs` / `grpc_stdio.rs` / `grpc/session.rs`）
- **并发模型**：cell-actor（`cell_actor/{mod,callbacks,types}.rs`）

### 2.2 还原的模块结构（源码路径）

```
code-mode-host/src/{main,lib,delegate,peer,transport,process_metrics}.rs
code-mode-host/src/grpc/{mod,session,delegate,events,routing,waits}.rs
code-mode-host/src/grpc_stdio.rs
code-mode-protocol/src/{session,host/codec}.rs
code-mode-runtime/src/{service,runtime/{mod,timers,event_channel}}.rs
code-mode-runtime/src/cell_actor/{mod,callbacks,types}.rs
code-mode-runtime/src/session_runtime/mod.rs
code-mode-runtime/src/output/{output_collection,output_render}.rs
code-mode-runtime/src/ui/{failures,watchdog}.rs
```

### 2.3 线协议（gRPC 方法 + tagged enum）

gRPC 方法：`code_mode_host.run_main` / `.startup` / `.grpc.close_session` / `.grpc.wait`、
`code_mode.runtime.invoke_tool`。

`HostRequest`（internally tagged）：`Hello` → `session/ready` → `execution/started` →
`delegate/request` → `delegate/cancel` → `cell/closed` → `outcome` → `session/closed`；
版本协商字段 `noCompatibleVersion` / `missingRequiredCapability` / `selectedVersion` / `capabilities`。

`ClientToHost`：`tool/invoke`、`notification/send`。
`DelegateResponse`：`Delivered` / status；`WireResult` 含 `input_text` / `input_image` / `image_url`
/ `input_audio` / `audio_url`（多模态工具入参）。

### 2.4 执行边界（cell-actor 治理，最值得借鉴）

新版错误串精确列出这套边界，全部是**显式上限 + 显式失败语义**：

- `cell_execution_limits` / `output_truncation` —— cell 级执行与输出上限
- `code-mode session has too many tool subscriptions` —— 工具订阅数上限
- `too many pending delegate calls`（session 级 + host 级两层）—— 并发 delegate 上限
- `session event queue is full` / `event stream is closed` —— 事件队列背压
- `runtime reused an active cell ID` —— cell ID 唯一性
- `execution was abandoned` / `closed before cell admission` —— cell 生命周期中断语义
- `result_buffered_for_ns` / `code_mode_host_duration_ns` —— 纳秒级计时埋点
- IPC 帧上限：`initial response exceeds the IPC frame limit` / `host response exceeds the IPC frame limit`

**范式本质**：Codex Code Mode 把「一串工具调用」编译成**一段在 V8 cell 里跑的代码**，
代码里 `await delegate(...)` 并发桥接宿主工具，cell-actor 提供会话级隔离 + 显式执行边界。
这是 Anthropic「Code Execution Tool」同类范式（用代码编排替代逐次 JSON 工具调用，省 token、
可表达控制流/并发）。

## 3. 本仓现状对照（精确差距）

本仓已有 `run_code`（`apps/ai-service/app/services/agent_engine.py:6751`，2026-09-18 第六批，
对标 Codex code-mode/V8 cell）：模型写 **Python** 代码、常驻子进程、`tools.call(name,args)`
桥接引擎工具、全局状态跨调用持久、OS 沙箱（`proc_sandbox.apply_job_sandbox`）+ 帧预算。

| 维度 | Codex 26.1111 code-mode | 本仓 run_code | 差距性质 |
|------|------|------|------|
| 执行引擎 | V8（JS/TS） | CPython `-I` 子进程 | **非差距**（语言选型：Code Mode 目标即 JS；本仓引擎栈是 Python，复用 Python 合理，引入 V8 是负价值） |
| 宿主进程 | 独立 Rust 进程（故障隔离） | Python 子进程（`create_subprocess_exec`） | **等价**（都是独立进程隔离） |
| 工具桥接 | `delegate/request` + 工具订阅，**并发** await | `tools.call` **串行阻塞**（`_CODE_MAX_NESTED_TOOL_CALLS=50` 计数治理） | **真差距**：Codex 可并发桥接，本仓串行 |
| cell 生命周期 | 显式状态机（admission / started / outcome / closed / abandoned） | 隐式 dict（`_code_sessions[sid]` + lock + last_active） | **真差距**：无显式状态机，中断语义靠异常 |
| 执行边界 | `cell_execution_limits` 统一治理 + 队列背压 | 分散常量（TTL/超时/输出 head-tail/嵌套数） | **真差距**：边界分散，无统一 limits 结构 |
| 纳秒计时 | `code_mode_host_duration_ns` / `result_buffered_for_ns` | 无 cell 级计时 | 次要 |
| 静态准入 | —（未在二进制见到等效层） | `code_exec_sandbox.py` vm 级禁令判据 | **本仓领先**（Codex 二进制未见等效静态准入层） |

## 4. 一轴超越：cell 生命周期状态机 + 并发 delegate 边界

Codex 已证明「并发 delegate + 显式 cell 边界」在复杂任务上优于串行阻塞。本仓 `run_code`
当前是**串行阻塞**（一次 `tools.call` 阻塞到返回），且 cell 状态是隐式 dict。可落地超越：
把 run_code 会话治理**收成显式 cell 状态机 + 统一执行边界结构**（复用本仓 asyncio，
不引入 V8）。

刻意不做（边界说清）：
- **不引入 V8 / 不换 JS**：Codex 用 V8 因其 Code Mode 目标语言是 JS；本仓引擎栈是 Python，
  引 V8 是负价值。语言选型不是差距，**并发生命周期治理**才是。
- **不做 gRPC-over-stdio**：本仓 run_code 已用 JSON 帧协议（`command_streamer.read_protocol_frame`），
  协议传输形态不是差距，**协议承载的状态语义**才是。

## 5. 红线遵守

不粘专有源码（全部结论来自 strings 符号/路径/协议名，无源码摘录）；不破解许可；不绕过付费；
不提取凭据。craft-anything `native_rust_binary_show` 对 382MB PE / 294MB ELF 均被 256MB
上限挡住（`is 382514992 bytes; the limit is 268435456`），改用 strings + cargo 路径取证，
已如实标注。
