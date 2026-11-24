<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R32 · Codex 26.1111 A2A 协议 Task 状态封闭集

> 逆向-复现-超越铁律第 ③ 步交付。对照程序：Codex CLI 26.1111 主引擎
> `codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe`（364.8MB，strings 定向抽取）。
> 本仓复现：`app/core/a2a_task_state.py` + `tests/test_a2a_task_state.py`（41 用例）。

## 1. 目标

下潜 **A2A（Agent-to-Agent）协议** Task 生命周期状态轴。前几轮下潜了本仓单机 agent loop
的 turn 错误码（R28）、Guardian 复核（R30）、auto-compact（R31）；本轮转向**跨 agent 协议**
Task 状态——对照物是完整 A2A 协议栈（`SendMessage`/`GetTask`/`CancelTask`/`TaskStatusNotification`
方法名逐字命中）。

## 2. 取证（Evidence）

codex.exe strings 逐字锚：

```
working input_required completed failed cancelled
submitted
GetTaskRequest UpdateTaskRequest CancelTaskRequest SendMessage
TaskStatusNotification
```

Task 生命周期状态逐字确证**六档**：`submitted`/`working`/`input_required`/`completed`/`failed`/`cancelled`。
语义（A2A 协议惯例）：
- `submitted` 已受理未执行；`working` 执行中；`input_required` 暂停等客户端输入/授权；
- `completed` 成功终态；`failed` 失败终态；`cancelled` 取消终态。

**取证纠偏（防后人踩，模块 docstring + 测试双重标注）**：
- `submitted` 在 strings 中**另起**（未与 `workinginput_required...` 拼同一连续块），登记为
  逐字确证成员但标注「单独出现」；
- `blocked`/`auth_required`/`rejected` 出现在**相邻但不同上下文**（`auth_required` 属
  remote_catalog 插件市场轴），**不属 TaskState**，已排除；
- 是否同一 Rust enum 变体、serde rename、是否还有 `blocked` 档未确证，只收逐字确证六档。

## 3. 本仓真空白确认

- `app/services/a2a_service.py`（无在飞改动）的 A2A task 用**自由字符串**：
  `self.status = "pending"`（`:57`，注释列 `pending/running/completed/failed/canceled`）、
  `"running"`（`:389`）、`"completed"`（`:400`/`:423`）、`"failed"`（`:330`/`:426`）——**无封闭集**；
- 与协议标准值域**语义错位**：本仓 `pending`/`running` 对应协议 `submitted`/`working`；
  `canceled`（单 l）对应协议 `cancelled`（双 l）；**缺 `input_required` 档**（等待客户端输入
  是 A2A 核心交互态）；
- 全仓无 `A2ATaskState` 专用封闭集模块；
- 结论：本仓 A2A task state 是散落自由字符串 + 协议错位 + 缺档。

## 4. 复现交付

`app/core/a2a_task_state.py` + `tests/test_a2a_task_state.py`（41 用例）。

- **`A2ATaskState`** 六档 StrEnum（`SUBMITTED`/`WORKING`/`INPUT_REQUIRED`/`COMPLETED`/`FAILED`/
  `CANCELLED`，逐字对照协议标准值域，对齐 `turn_stop_reason` 同纪律）；
- **`TERMINAL_STATES`** 终态集合常量（completed/failed/cancelled，供守门静态解析与判据共用）；
- **`A2A_TASK_STATE_VALUES`** 字面量总表（供守门静态解析，漂移由 pytest 钉死）；
- **`ensure_a2a_task_state()`** 值域闭合判据（未登记抛 `A2ATaskStateError` 点名）；
- **`is_terminal_state()`** 三终态判定；**`requires_client_input()`** 暂停态判定（仅 `input_required`）；
  未登记档位抛错不静默判 False（遵循 §0 铁律 3）。

## 5. 一轴超越

对照把六档散在 A2A 协议栈各状态分支（运行时遇到才产出），无统一封闭集与「终态判定」判据。
本仓：
- Task 状态**显式封闭集** + 值域闭合判据（未登记抛错点名）；
- **`is_terminal_state`/`requires_client_input` 纯函数**（轮询/交互前置判据）；
- **协议标准值域对齐**：`submitted/working/cancelled(双l)` 替换本仓 `pending/running/canceled(单l)`
  错位口径，补 `input_required` 缺档；
- 可 diff 可单测可挂 A2A 轮询前置。

## 6. 验证实数

- **41 pytest 全过**。含反向变异：working 误判终态 / completed 误判非终态 / 终态集合漂移；
  含参数化覆盖：本仓旧自由字符串（pending/running/canceled）与别轴档（blocked/auth_required）
  均被封闭集拒绝。
- **ruff 全绿**（--fix 修 2 处：import 排序）；**py_compile OK**；**水印 head/tail 2/2**。

## 7. 诚实边界

- **未接生产路径**（`a2a_service.py` 属在跑服务，本模块是**状态真相源**，接入点留属主；
  替换其自由字符串需改 6 处赋值 + `get_task_status` 序列化，不在本轮范围）。
- **协议对齐是推定映射**：`pending→submitted`/`running→working`/`canceled→cancelled` 的对应
  是按 A2A 协议惯例推定（对照只确证协议侧六档字面量，未确证本仓旧字符串的迁移映射）。
- `input_required` 的**确切触发语义**（等输入 vs 等授权 vs 二者）未从二进制确证；
  `submitted` 与 `working` 的**分界时机**（受理即 submitted、开始执行转 working？）未确证。
- `blocked`/`auth_required`/`rejected` 已判属**别的轴**（remote_catalog 插件市场），但
  `auth_required` 是否也可能作为 Task 暂停态未完全排除（strings 相邻不同上下文，推定排除）。
- A2A 协议的**方法层**（`SendMessage`/`GetTask`/`CancelTask`/`UpdateTask`）与 Task 状态的
  **配对关系**（哪个方法驱动哪个状态迁移）未下潜——本轮只取 TaskState 值域。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
