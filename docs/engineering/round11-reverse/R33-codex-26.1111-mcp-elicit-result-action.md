<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R33 · Codex 26.1111 MCP Elicitation 结果动作封闭集（ElicitResult.action 三档）

> 逆向-复现-超越铁律第 ③ 步交付。对照程序：Codex CLI 26.1111 主引擎
> `codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe`（364.8MB，strings 定向抽取）。
> 本仓复现：`app/core/elicit_result_action.py` + `tests/test_elicit_result_action.py`（29 用例）。

## 1. 目标

下潜 **MCP（Model Context Protocol）Elicitation** 结果决策轴。R32 下潜了 A2A Task 状态；
本轮深入同一协议族的 **elicitation（人机授权/补充输入）**——客户端对 `ElicitRequest` 的
响应决策 `ElicitResult.action` 值域。

## 2. 取证（Evidence）

codex.exe strings 逐字锚：

```
ElicitResult action content
ElicitResultEmptyResult CustomResult action content jsonrpc id
EnumItems accept decline cancel
ElicitRequestParamsWire::Form with 3 elements / ::Url with 4 elements
```

- `ElicitResult` 结构含 `action` + `content` 两字段（`ElicitResultactioncontent` 逐字）；
- `action` 值域以 **EnumItems** 形态逐字确证三档：`accept`/`decline`/`cancel`
  （`citationUntitledEnumItemsacceptdeclinecancel`）；
- 语义（MCP elicitation 惯例）：`accept` 接受并提交 content 数据；`decline` 明确拒绝；
  `cancel` 取消整个流程（区别于 decline，常表「中断上游」）。

**取证纠偏（防后人踩，模块 docstring + 测试双重标注）**：
- `acceptdeclinecancel` 与 `ElicitResult.action` **配对**（非凭空发明）；同样的 token 在
  **别处复用**（`acceptdeclinecancelpersistence`/`acceptdeclinecancelprompts` 属
  persistence/prompts 轴），本封闭集只认与 `ElicitResult.action` 配对那一处；
- `ElicitResult.content` 是表单数据（schema 由 `ElicitRequest.requestedSchema` 给出），
  **不在**本封闭集（值域开放非枚举）；
- 三档是否同一 Rust enum 变体、serde rename 未逐字段确证。

## 3. 本仓真空白确认

- `app/core/elicitation_pause.py` 是**计数暂停门控**（登记/释放并发 elicitation 数、翻 paused
  标志），**不处理 elicitation 结果 action**；
- 全仓 elicitation result 的 `accept`/`decline`/`cancel` 决策**无封闭集**：
  `langgraph_checkpoint.py:437` 用自由字符串 `action == "cancel"`（thread 语义）、
  `subagent_job` 的 cancel 是 subagent 生命周期轴、`resume_confirmations` 的 `accept` 是
  resume 语义、`super_agent_slow.py:55` `_DECISIONS=("accept","ignore","unavailable")` 是
  super_agent 轴——elicitation 客户端决策结果**零命中**专用封闭集；
- 结论：本仓缺「MCP elicitation 结果动作封闭集 + 语义判据」。

## 4. 复现交付

`app/core/elicit_result_action.py` + `tests/test_elicit_result_action.py`（29 用例）。

- **`ElicitResultAction`** 三档 StrEnum（`ACCEPT`/`DECLINE`/`CANCEL`，逐字对照 EnumItems，
  对齐 `turn_stop_reason` 同纪律）；
- **`ELICIT_RESULT_ACTION_VALUES`** 字面量总表（供守门静态解析，漂移由 pytest 钉死）；
- **`ensure_elicit_result_action()`** 值域闭合判据（未登记抛 `ElicitResultActionError` 点名）；
- **`is_accept()`**（提交数据）/ **`stops_action()`**（decline/cancel 均停止 elicitation
  触发的动作）/ **`is_terminal_response()`**（三档均终局响应）——语义纯函数；
  未登记档位抛错不静默判 False（遵循 §0 铁律 3）。

## 5. 一轴超越

对照把三档散在 MCP elicitation 各响应分支（运行时遇到才区分），decline 与 cancel 的语义
边界靠分支位置隐式决定、无统一判据。本仓：
- elicitation 结果动作**显式封闭集** + 值域闭合判据；
- **`stops_action` 显式化 decline/cancel 语义边界**（都停止动作；cancel 额外表中断上游）；
- 与别轴同形字符串**严格隔离**（resume 的 accept、super_agent 的 ignore、thread 的 cancel
  均被封闭集拒绝，防误用）；
- 可 diff 可单测可挂 elicitation 响应前置。

## 6. 验证实数

- **29 pytest 全过**。含反向变异：decline 误判不停止 / accept 误判停止 / cancel 误判为 accept；
  含参数化覆盖：别轴同形字符串（ignore/retry/confirmed/APPROVE）均被封闭集拒绝。
- **ruff 全绿**（--fix 修 1 处 import 排序）；**py_compile OK**；**水印 head/tail 2/2**。

## 7. 诚实边界

- **未接生产路径**（MCP elicitation 响应处理属在跑服务，本模块是**结果动作真相源**，
  接入点留属主；替换需改 elicitation 结果消费分支，不在本轮范围）。
- **三档与 `ElicitResult.action` 的配对**是 strings 相邻 + EnumItems 形态确证，但「是否就是
  MCP 标准的 elicitation result action」未逐字段确证（对照物是 Codex 的 MCP 实现，非 MCP spec）。
- **decline vs cancel 的语义边界**（decline=拒绝当前、cancel=中断上游）是本仓按 MCP 惯例
  推定的工程映射；对照物未逐字段确证二者确切差异，`stops_action` 的「都停止」是保守判据。
- `is_terminal_response()` 恒返回 True 是**语义声明**（ElicitResult 一旦返回即终局），无实际
  判别逻辑——因三档都是 result 的合法终局，等待中状态用别的类型表达（非本轴）。
- 同名 token 在 persistence/prompts 别轴复用的**确切归属边界**未逐 token 确证（只确认复用存在）。
- `ElicitRequestParamsWire::Form`（3 elements）/`::Url`（4 elements）变体的字段名未下潜
  （本轮只取 result action 值域，未取 request 参数结构）。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
