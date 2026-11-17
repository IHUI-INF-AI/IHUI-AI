<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R85 — 23 段 inline hook schema：只有 3 段在二进制里有字段表

## 1. 做什么

R84 用「集合相等」把 7 个 `definitions` 对象在二进制里坐实了 6 个。本轮把同一判据推到 R63 的另外 **16 段 inline schema**（12 家族的 `command.input` / `command.output`），加上那 7 段共 23 段一起扫 4005 条 FIELDS 记录数组。

判据不变：窗口长度 == 该段字段数 ∧ 窗口字段集 == 该段字段集。

## 2. 读数：3/23，而且 3 段全是 output

| 分类 | 段数 | 定位成功 |
| --- | --- | --- |
| `command.output` | 11 | **3** |
| `command.input` | 12 | **0** |
| 合计 | 23 | **3** |

命中的三段：

| 段 | 字段数 | 地址 | 形态 |
| --- | --- | --- | --- |
| `post-compact.command.output` | 4 | `0x151f986a0`、`0x151f9e290` | **整条 run**（两份） |
| `pre-compact.command.output` | 4 | `0x151f986a0`、`0x151f9e290` | **整条 run**（同上两份） |
| `interrupt.command.output` | 1 | `0x151f986a0` | 窗口（偏移 3） |

两个 4 字段段的字段集逐字相同（`continue, stopReason, suppressOutput, systemMessage`），所以在**同两个地址**各有一份——这是"一份字段表、两个结构共用"的又一例，与 R84 的三个 2 字段定义、R80 的 `Failure`/`SetupErrorReport` 同型。

`interrupt.command.output` 只有 1 个字段，落成一元素窗口——任何单字段表都能命中，所以只算薄证据，不计入认证。

## 3. 这个"只有 3 段"才是本轮的主结论

它把一个此前只能靠感觉的猜测变成了读数：**hook 的 `command.input` / `command.output` 契约大部分不是 serde derive 出来的结构**。

推测链条（已可检验）：

- serde 的 `#[derive(Serialize, Deserialize)]` 会把字段名表 `FIELDS` 以 16 B 记录数组的形式写进 `.rdata` ⇒ **能扫到**。
- 手写 JSON 构建/解析（`serde_json::json!`、`Map<String, Value>`、手动 `insert`）**不产生** `FIELDS` ⇒ **扫不到**。
- 本轮事实：7 个 `definitions` 对象里 6 个能扫到（R84）；16 段 inline `command.*` 里只有 3 个子段能扫到，且**12 个 input 段一个都没有**。

结论（本轮可下的最强版本）：**`*HookSpecificOutputWire` 是 derive 结构；`command.output` 里 compact 与 interrupt 三段是 derive 结构；其余 13 段（含全部 12 个 input）没有 serde 字段表。**

这也给前几轮一个解释：1436 个目录结构里只有 321 个拿到字段名，缺口不是"扫描没做到"，而是**其中相当一部分根本没有 16 B 字段表可扫**——它们是 enum、泛型实例、或手写 JSON 类型。

## 4. 交付

`apps/ai-service/app/core/hook_segment_binary_lookup.py`

- `SEGMENT_TOTAL=23`、`LOCATED_COUNT=3`、`UNLOCATED_COUNT=20`
- `OUTPUT_LOCATED=3`、`INPUT_LOCATED=0`
- `LOCATED`: 3 项 `(字段数, 地址元组, 窗口偏移, 是否整条 run)`
- `UNLOCATED`: 20 段（逐名列出，不汇总成数字）
- `THIN_EVIDENCE=("interrupt.command.output",)`
- `SHARED_ADDRESSES`: 两个地址各被两个 compact 段共享
- `DERIVE_SPLIT="definitions-are-derived-structs-inline-outputs-are-not"`
- `SEGMENTS_ATTESTED=True`（两段整条 run 的集合相等）、`ALL_SEGMENTS_LOCATED=False`
- `address_of()` / `input_share_of_located()` / `validate_segment_lookup()` / `segment_lookup_summary()`

校验器拦：`ALL_SEGMENTS_LOCATED` 被改 True、未定位段混进定位表、薄证据缺失、地址非 hex 前缀、整条 run 带偏移、共享地址成员对不上自己的地址、定位+未定位 ≠ 23。

测试三轮都导入上游 `HOOK_SCHEMA_FIELDS` 断言字段数，判据不复制。

## 5. 验证

| 项 | 结果 |
| --- | --- |
| pytest | **13 passed** |
| ruff | All checks passed |
| mypy（单文件） | no issues |

采集期一处校准：`0xdead` 被用作"非法地址"样本时 `startswith('0x')` 仍然通过——`0xdead` 本身是合法 hex 字面量。改成 `segment-not-an-address` 才真的测到那条分支。

## 6. 诚实边界

1. **3/23 是"没找到"，不是"不存在"**。可能某些段用了 `rename_all` 之类而名字与 schema 不完全一致，也可能数组在 4005 条之外。但按已定义的判据，结果就是 3。
2. `interrupt.command.output` 的 1 字段窗口**不能定位**，只证明"存在某张单字段表"，不证明是它的。故列薄证据。
3. 两个 compact 段的字段表**各有两份**，本轮不判断两份是否逐字相同（只验证了集合相等）。
4. 结论 3 里的"手写 JSON 不产生 FIELDS"是**对 serde 行为的说明**，不是对 codex 源码的直接观察；本轮的观察支撑是"12 个 input 段在数组空间里全空"。
5. 字段顺序仍未判定。

## 7. 剩下的方向

- `HOOK_DEFINITION_ENUMS`（2 个枚举：`PreToolUseDecisionWire`、`PreToolUsePermissionDecisionWire`）可以与 `.rdata` 里的字符串表比对（枚举值以裸字符串存在，不走 FIELDS）。
- 12 个 input 段既然没有 FIELDS，其字段名的第二来源只能在**代码里的字符串比较**（`serde_json::Value` 的 `get("key")` 之类）——需要新的判据，不是本轮这条。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
