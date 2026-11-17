<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R27 — 推理摘要通道形态封闭集（对标 Codex agent message phase 三档）

> 逆向-复现-超越 §§0.10/0.11：本报告只读字符串取证，非反混淆。对照形状逐字保真。

## 1. 目标

下潜 agent message **通道形态（phase）**轴：一条 agent message 在答案形成中的角色。前轮已确认本仓 `responses_request_assembly.py` 对标了 `reasoning_summary_delivery`（`sequential_cutoff`，摘要怎么随流交付），但那是**交付机制轴**，与 phase 的**消息角色轴**不同。

## 2. 取证（codex.exe 364.8MB strings，逐字锚）

对照物协议层 agent message 的 `phase` 维度三档封闭集：

- **`commentary` / `partial_answer` / `final_answer`**（strings 18 次逐字命中 `commentarypartial_answerfinal_answer`）。

区分两轴（防混淆）：
- `reasoning_summary_delivery` = `sequential_cutoff`（4 命中）——摘要**交付机制**，本仓已对标。
- `phase` = `commentary/partial_answer/final_answer`——消息**角色**，本轮对象。

## 3. 真空白确认

- 全仓 grep `partial_answer` ai-service **零命中**。
- `commentary` / `final_answer` 仅散落于 `model_tools_57.py`（`phase=final_answer` 字面量）与 `stream_events.py`（`phase == "commentary"` 判断），**无封闭集**、无推进判据——零散字符串不可机检、易漂移。

## 4. 复现交付

`app/core/reasoning_channel.py` + `tests/test_reasoning_channel.py`（19 用例）。

- **`ReasoningChannel`**：三档封闭集（`COMMENTARY` / `PARTIAL_ANSWER` / `FINAL_ANSWER`），StrEnum 逐字对照。
- **`is_final_answer()`**：终态判定（接受 StrEnum 或裸字符串，未知字符串返回 False 不误判）。
- **`is_discardable()`**：commentary 可丢弃判定（未知字符串保守按可丢弃）。
- **`advance_phase()`**：推进判据——`current` 已 final 恒保持 final（终态不可回退）；否则 `incoming==final` 定稿；未知 incoming 归一化 commentary。

## 5. 超越轴（一轴）

对照把三档散在协议序列化与各渲染分支、靠字符串字面量隐式区分、无统一封闭集与推进判据；本仓让通道形态成为**显式 StrEnum 封闭集** + `is_final_answer()`/`advance_phase()` 纯函数判据（final_answer 终态不可回退、partial_answer 可被 final 替换、commentary 可丢弃），可 diff 可单测可挂审计。

## 6. 验证实数

- **19 pytest 全过**（含 3 处反向变异：封闭集漏 partial_answer / final 被 commentary 回退 / 未知 incoming 误升级为 final，均转红）。
- **实现纠偏**：`advance_phase` 首版漏了"current 已 final 恒保持"分支（只判 incoming），3 个终态测试转红暴露——已修（先判 current 是否 final 再判 incoming），正是反向变异测试的价值。
- ruff 全绿（--fix 修 4 处：W291/I001/W292 等）。
- 水印 2/2。

## 7. 诚实边界

- **未接生产路径**（`stream_events.py`/`model_tools_57.py` 属核心件，接入点留属主）；本模块是封闭集真相源，可被 `stream_events.py` 的 `phase == "commentary"` 判断引用替换。
- **phase 三档在 agent message item 上的确切字段名**（是否就叫 `phase`）——strings 见 `phase` 键与本仓既有 `phase=final_answer` 字面量一致，但与 `ReasoningContentDelta` 等 reasoning 专用 item 的关系未从二进制确证。
- `commentary`/`partial_answer`/`final_answer` 与 `reasoning_summary_delivery` 的**配对关系**（同 item 还是不同 item 携带）未确证。
- `turn_diff_tracker.py` 轴本轮核实已充分覆盖（`test_engine_harness_twentyseventh` 27 passed），无语义空白；该文件 `TestInstallationId` 组 5 失败是存量（与本轮无关）。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
