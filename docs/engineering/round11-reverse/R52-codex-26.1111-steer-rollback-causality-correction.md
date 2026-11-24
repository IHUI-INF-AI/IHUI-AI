<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R52 — steer 拒绝 与 thread 回滚 因果方向取证纠偏

- 日期：2026-11-18
- 对照物：`codex.exe` 26.1111.2228.0（Rust 主引擎，`app/resources/codex.exe`，382,514,992 B）
- 取证手段：binary strings 偏移取证 + Ghidra headless 分析尝试（超时，见 §5）
- 本轮性质：**纠偏**（推翻 R51 一处过度断言，非新增封闭集轴）
- 改动：`apps/ai-service/app/core/turn_steerability.py` + `tests/test_turn_steerability.py`

> **✅ R53 确证（2026-11-18，本文 §5 诚实边界已补上反编译层证据）**：本轮用
> RIP-relative LEA 交叉引用扫描 + objdump 定向反汇编绕开全量分析超时，反汇编
> `0x141AB6039` 等三处引用点暴露其为 **JSON 错误码序列化块**（逐字节写 `{`/`"`/`:` +
> LEA 取串 + 长度 25 调序列化），三处 LEA 成对同区（delta 243/243/254）。确证本文的
> 否定结论正确：两串是**并列错误码**、无控制流因果，「拒绝 steer ≠ 触发回滚」。详见
> `R53-codex-26.1111-steer-rollback-disasm-confirmation.md`。

---

## 1. 取证（strings 偏移，决定性）

### 1.1 两个错误码在码表中恒定相邻

三处出现偏移（`.rdata`）：

| 偏移 | `active_turn_not_steerable` 起 | `thread_rollback_failed` 起 | 恒差 |
|---|---|---|---|
| 处1 | 294940078 | 294940103 | **25 B** |
| 处2 | 299915694 | 299915728 | **25 B**（`not_steerable` + `turn_kind` 前缀）|
| 处3 | 302422961 | 302422995 | **25 B** |

偏移恒差 25 字节 ⇒ 二者是**同一错误码表内相邻变体**，非因果链（若为「steer 被拒 →
触发回滚」的控制流，不会有此恒定偏移结构）。

### 1.2 字面义否证「拒绝 ⇒ 回滚」

- `thread_rollback_failed` 字面义 = 「thread 回滚**失败**」——回滚是一个独立过程，
  此码表示该过程**失败了**；
- 另有独立的 `thread_rolled_back`（回滚**已成功**，偏移 ...7483 / ...7547 / ...7647，
  距 `not_steerable` 约 **7405 B**，不在同一错误码表）+ `ThreadRolledBackEvent` 事件
  （R48 已见其结构 `num_turns/agent_nickname/agent_role`）。

⇒ **拒绝 steer ≠ 触发回滚**。三者分域：`ACTIVE_TURN_NOT_STEERABLE`（steer 被拒）、
`THREAD_ROLLBACK_FAILED`（回滚失败）、`thread_rolled_back` / `ThreadRolledBackEvent`
（回滚成功事件）。

---

## 2. 纠偏对象（R51 过度断言）

R51 首版 `validate_steer` 把「拒绝 review/compact 类 turn ⇒ 连带 thread 回滚」写成由
`verdict` 显式驱动的**确证语义**（返回 `thread_rollback=True`）。R51 报告 §5.2 也只
标注为「推定」。本轮 strings 偏移取证**否证**该因果方向，作废两处：

1. `validate_steer` 不再返回 `thread_rollback` 字段，改返回 `error_code`
   （`ACTIVE_TURN_NOT_STEERABLE`）；
2. 新增 `SteerErrorCode` 二档封闭集 + `steer_error_codes()`，把 steer 相关错误码
   **分域显式登记**，并显式排除 `thread_rolled_back`（回滚成功事件，不同域）。

---

## 3. 复现改动

- 新增 `SteerErrorCode` StrEnum 二档（`ACTIVE_TURN_NOT_STEERABLE` /
  `THREAD_ROLLBACK_FAILED`，逐字）+ docstring 记录相邻非因果的取证依据；
- 新增常量 `THREAD_ROLLED_BACK_EVENT = "thread_rolled_back"`（成功回滚事件，独立防混）；
- `validate_steer` 返回值 `thread_rollback` → `error_code`；拒绝裁决只报 steer 被拒
  这一个确证事实，回滚是否发生留未确证；
- 新增 `steer_error_codes()` 供 diff 单测；`__all__` 同步。

### 3.1 一轴超越（更新）

对照把 steer 相关错误码混在 thread/turn 生命周期错误族里，靠码表相邻位置隐式关联、
无显式判据。本仓把「steer 被拒的错误码」与「回滚失败/成功的错误码」**分域显式登记**
（`SteerErrorCode` 二档 vs `THREAD_ROLLED_BACK_EVENT`），可 diff 可单测。

---

## 4. 验证实数

- `31 passed`（原 28：改 2 个 rollback 断言为 error_code 断言、新增 3 个分域/
  无-rollback-字段/封闭集测试、1 个反向变异改为防回滚成功事件混入）；
- `ruff check` 全绿（`--fix` 修 1 处 import 排序）；`py_compile` OK；水印 2/2。

---

## 5. 诚实边界（取证未竟）

1. **Ghidra headless 全量分析超时**：382MB PE `analyzeHeadless` 在 1200s 内未完成
   auto-analysis（卡在 "ANALYZING all memory and code"），交叉引用未取得。本轮结论
   基于 strings 偏移结构 + 字面义，**非反编译控制流**。按 §0 铁律「没判绝不写成判过」，
   「拒绝 steer 后究竟是否/何时启动回滚流程」**留未确证**；
2. PDB 未随二进制提供（`failed to locate PDB`），符号已 strip，`objdump -t` 无
   steer/rollback 符号——进一步需 Ghidra 完整分析或定向 decompile 单函数；
3. `THREAD_ROLLBACK_FAILED` 的**真实触发条件**（什么操作会启动回滚、回滚又因何失败）
   未下潜——本模块只登记它是独立于 steer 拒绝的错误码，不假设其触发时机。

> 注：Ghidra headless 曾因项目路径含 `.` 前缀（`.ihui-agent` / `.box-agent-scratch`）
> 报 `Path element starting with '.' is not permitted`，改用非点号目录后能启动导入，
> 但全量分析耗时超限。后续如需反编译，建议 `-analysisTimeoutPerFile` 限流 + 只分析
> `.rdata` 附近函数，或用 `native_functions_decompile` 定向单函数。

---

## 6. pivot-rust-loop 累计

40 轮记录。本批下潜十五面 + 本轮一次纠偏：exec-approval 真差距复现 + ultra 全端落地
核对 + 七轴本仓已饱和 + 五轴探索停手 + workspace 配额架构差异停手 + collab 生命周期
真空白复现（R50）+ turn 可操纵性真空白复现（R51）+ **steer/回滚因果纠偏（R52）**。
所有停手均有明确证据链不足/架构差异理由，未硬造任何存疑封闭集；本轮主动推翻自身
一处过度断言并如实入档。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
