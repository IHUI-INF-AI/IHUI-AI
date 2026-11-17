<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R25 — 工具结果溯源枚举 + 截断元数据契约（对标 Codex tool_result_source / ToolResultMetadata）

> 逆向-复现-超越 §§0.10/0.11：本报告只读字符串取证，非反混淆。所有对照形状逐字保真。

## 1. 目标

R13 遗留的 agent loop 工具调用编排三面中，前几轮已覆盖**并行调度**（本仓 `_gather_tools_readonly_gated` 对标 codex parallel.rs，只读 gate + 上限 5）。本轮下潜**工具结果溯源 + 截断凭据**这一轴：单条工具结果由谁产出、被截断时带什么凭据。

## 2. 取证（codex.exe 364.8MB strings，逐字锚）

对照物协议层两件物：

- **`tool_result_source`**：溯源枚举，两变体 `codex` / `executed_tool_call`——区分结果由引擎内置工具自产（local_shell / apply_patch / web_search 等 Codex 自己执行）vs 模型发起的工具调用回灌。两者在 transcript item 上是不同变体。
- **`ToolResultMetadata`**：截断元数据，字段逐字 `truncated` / `original_bytes` / `max_bytes` / `omitted_calls` / `original_name_bytes`。

strings 命中形态（多次重复，取最完整一处）：

```
tool_result_sourcestool_result_metadata_codex_executed_tool_call_truncated
original_bytesmax_bytesomitted_callsoriginal_name_bytes
```

## 3. 真空白确认

- 全仓 grep `tool_result_source|ToolResultSource` ai-service **零命中**。
- 全仓 grep `omitted_calls|original_name_bytes|ToolResultMetadata` ai-service **零命中**。
- 本仓 `executed_tool_calls.py` 覆盖的是"本轮尝试过哪些工具调用"的**记录器/回灌**轴（`ExecutedToolCalls` / `build_request_metadata`），与本模块"单条结果由谁产出 + 截断凭据"是**不同轴**，二者互补不替换。
- 本仓 artifact 机制有 `truncatedOnDisk` / `output_total_bytes` 布尔与字节数，但无 source 枚举、无 `omitted_calls`、无结构化截断凭据。

## 4. 复现交付

`app/core/tool_result_provenance.py` + `tests/test_tool_result_provenance.py`（16 用例）。

- **`ToolResultSource`**：溯源封闭集两档 `CODEX` / `EXECUTED_TOOL_CALL`（StrEnum，逐字对照协议层 `tool_result_source`）。
- **`ToolResultMetadata`**：五字段 frozen dataclass（`truncated` / `original_bytes` / `max_bytes` / `omitted_calls` / `original_name_bytes`），逐字对照。
- **`build_result_metadata()`**：唯一构造出口，`truncated` 由 `original_bytes > max_bytes` 显式驱动；未截断时 `omitted_calls` / `original_name_bytes` 显式归零；负数输入 clamp 为 0。
- **`classify_source()`**：由"是否引擎内置工具"布尔判定溯源标签。
- **`metadata_to_dict()`**：序列化为协议层逐字字段名 dict（可机检）。

## 5. 超越轴（一轴）

对照把截断凭据散在协议序列化各处、`truncated` 与 `original_bytes` 靠"字段是否出现"隐式区分（无 `truncated` ⇒ 未截断），无统一构造器；本仓：

- `truncated` 由 `original_bytes > max_bytes` **显式驱动**（非隐式缺字段）。
- 未截断时 `omitted_calls` / `original_name_bytes` **显式归零**（不是缺字段）。
- `build_result_metadata` 是唯一出口，可 diff 可单测可挂审计。

## 6. 验证实数

- **16 pytest 全过**（含 3 处反向变异：`truncated` 判据改 `>=` / 未截断不归零 / 溯源标签混淆，均转红）。
- ruff 全绿（修 3 处：2×W292 末尾换行 + 1×B017 盲 `Exception`→`FrozenInstanceError` + 1×I001 import 排序）。
- 水印 2/2。

## 7. 诚实边界

- **未接生产路径**（`agent_loop_v2.py` 他席在飞件，接入点留属主）；本模块是语义对照真相源。
- **不替换** `executed_tool_calls.py`（记录器轴）与 artifact spill 机制（磁盘落盘轴），三轴互补。
- `tool_result_source` 在 transcript item 上如何与 `ToolResultMetadata` **配对出现**（是否同 item 携带）未从二进制确证——只确证两件物各自存在与字段组成。
- `omitted_calls` 的精确语义（省略的是"整条调用"还是"调用的某个字段"）是推定（从字段名 + `original_name_bytes` 共现推断为省略调用数），对照内部构造点未从二进制确证。
- 并行编排轴（R25 §1）本仓已对标，本轮不重复复现。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
