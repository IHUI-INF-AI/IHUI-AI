<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R35 · Codex 26.1111 Agent/Operation 生命周期状态封闭集（wire 七档）

> 逆向-复现-超越铁律第 ③ 步交付。对照程序：Codex CLI 26.1111 主引擎
> `codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe`（364.8MB，strings 定向抽取）。
> 本仓复现：`app/core/agent_operation_status.py` + `tests/test_agent_operation_status.py`（34 用例）。

## 1. 目标

下潜 **Rust 引擎 agent loop 行为轴**（用户选定 pivot-rust-loop 方向）。沿 `codex_core::agent::control`
符号（`spawn_guard`/`completion`/`operation`）取证，定位到 agent/operation **生命周期状态机**。

## 2. 取证（Evidence）

codex.exe strings 逐字锚：

```
PendingInit Running Interrupted Completed Errored Shutdown        (Rust 变体名，6 档)
pending_init running interrupted errored shutdown not_found        (wire serde，7 档)
AgentStatusEntry / AgentStatusHistoryCell / AgentStatusThreadPreview  (结构名)
```

**取证纠偏（本轴核心，防后人踩）**：Rust enum 变体名（6 档）与 wire serde rename（7 档）
**档数不同**——Rust 侧无 `not_found` 变体，wire 值域在 `shutdown` 后紧跟 `not_found`。二者
配对证据是 `AgentStatusEntry`/`AgentStatusHistoryCell` 结构名（agent 状态轴）。本封闭集取
**wire 七档**（对外契约更全，含 `not_found`），`not_found` 标注为「wire 独有、Rust 变体名未现」。
是否同一 enum、serde rename 确切为何未逐字段确证，已双重标注。

语义（agent 生命周期）：
- 在飞三态 `pending_init`/`running`/`interrupted`（不对外发消息，仍会迁移）；
- 发消息四态 `completed`/`errored`/`shutdown`/`not_found`（对外发完成/错误/关闭/未找到消息）。

## 3. 本仓真空白确认

- `app/core/session_prefix.py`（无在飞）的 `format_inter_agent_completion_message` /
  `build_inter_agent_completion_fragment` 用**七档自由字符串** + `if/elif` 链（`:113-124`：
  `status == "completed"`/`"errored"`/`"shutdown"`/`"not_found"`），**无封闭集、无值域校验**；
- 未知 status 走 `else: return None`（`:123-124`）**静默吞掉**——不抛错、不点名，消费面可
  凭空写错档位而不被发现；
- 全仓无 `AgentOperationStatus` 专用封闭集枚举；`pending_init` 仅 `session_prefix.py` 一处消费；
- 结论：本仓 agent 生命周期状态是散落自由字符串 + if/elif + 静默吞未知档位。

## 4. 复现交付

`app/core/agent_operation_status.py` + `tests/test_agent_operation_status.py`（34 用例）。

- **`AgentOperationStatus`** 七档 StrEnum（wire 值域，逐字对照，对齐 `turn_stop_reason` 同纪律）；
- **`MESSAGE_EMITTING_STATES`**（四态）/ **`IN_FLIGHT_STATES`**（三态）集合常量；
- **`AGENT_OPERATION_STATUS_VALUES`** 字面量总表（供守门静态解析，漂移由 pytest 钉死）；
- **`ensure_agent_operation_status()`** 值域闭合判据（未登记抛 `AgentOperationStatusError`
  点名，对照 `session_prefix` 的 `else: return None` 静默吞档位改为抛错）；
- **`is_terminal_state()`**（脱离在飞四态）/ **`emits_message()`**（对外发消息四态）/
  **`is_in_flight()`**（在飞三态）——语义纯函数；未登记抛错不静默判 False（遵循 §0 铁律 3）。

## 5. 一轴超越

对照把七档散在 agent 状态分支（运行时遇到才产出），「该状态是否对外发消息、是否终态」靠
分支位置隐式决定、无统一判据；本仓 `session_prefix.py` 用 if/elif + `else: return None`
静默吞未知档位。本仓：
- 生命周期状态**显式封闭集** + 值域闭合判据（未登记抛错点名，不静默放行）；
- **在飞/发消息两集合穷尽划分**（`test_partition_is_exhaustive` 钉死 3+4=7 互斥完备）；
- **`is_terminal_state`/`emits_message`/`is_in_flight` 纯函数**（终态/发消息/在飞三维判据）；
- 可 diff 可单测可挂 inter-agent 完成消息前置。

## 6. 验证实数

- **34 pytest 全过**。含反向变异：not_found 既终态也发消息 / completed 误判不发 / running
  误判发 / pending_init 误判终态 / 未登记档位须抛错不静默返 None（4 处语义判据 + 静默吞档位）；
  含参数化覆盖在飞三态 + 发消息四态 + 无关档位（started/done/failed/queued）均被拒。
- **ruff 全绿**（--fix 修 4 处 import 排序）；**py_compile OK**；**水印 head/tail 2/2**。

## 7. 诚实边界

- **未接生产路径**（`session_prefix.py` 属在跑服务，本模块是**状态真相源**，接入点留属主；
  替换其 if/elif 需改 `format_inter_agent_completion_message`，不在本轮范围）。
- **Rust 6 档 vs wire 7 档差异**：`not_found` 是 wire 独有（Rust 变体名未现），配对证据是
  `AgentStatusEntry` 结构名——但「wire `not_found` 对应哪个 Rust 变体/分支」未确证。
- 七档是否同一 enum、serde rename 确切为何未逐字段确证（只有连续 token 块 + 结构名）。
- **状态迁移关系未下潜**：`pending_init→running→completed/errored` 等合法迁移边、哪些迁移
  被 `spawn_guard` 拦截未取证（本轮只取状态值域，未取状态机迁移图）。
- `interrupted` 与 R28 `TurnErrorCode.INTERRUPTED` 的**关系**未厘清（operation 级中断 vs
  turn 级中断错误，可能是同源不同层）。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
