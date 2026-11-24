<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R84 — 以 JSON Schema 为主语反查：7 个 hook 定义对象，二进制坐实 6 个

## 1. 换主语的动机

R83 的窗口认领是以**待认结构为主语**（我有一个名字不全的结构，去找数组）。R83 报告指出另一条更省力的方向：**以第二来源为主语**——先拿 R64 从 JSON Schema 提取的 7 个 `definitions` 对象，再去二进制里找它们的字段数组。

判据也从"包含"升级为**集合相等**：窗口长度 == 定义字段数 ∧ 窗口字段集 == 定义字段集。相等是对独立来源的比对，因此命中即**认证**，不再是候选。

## 2. 读数：6/7 定位

| 定义对象 | 字段数 | 地址 | 形态 |
| --- | --- | --- | --- |
| `SessionStartHookSpecificOutputWire` | 2 | `0x151f9dee0` | 整条 run |
| `SubagentStartHookSpecificOutputWire` | 2 | `0x151f9dee0` | 整条 run（同上） |
| `UserPromptSubmitHookSpecificOutputWire` | 2 | `0x151f9dee0` | 整条 run（同上） |
| `PreToolUseHookSpecificOutputWire` | 5 | `0x151f9de60` | 窗口（偏移 0） |
| `PermissionRequestDecisionWire` | 5 | `0x151f9dda0` | 窗口（偏移 2） |
| `PermissionRequestHookSpecificOutputWire` | 2 | `0x151f9df10` | 窗口（偏移 2） |
| **`PostToolUseHookSpecificOutputWire`** | 3 | **—** | **未定位** |

**4 个整条 run 之外的一个细节**：三个 2 字段定义**共用同一个地址 `0x151f9dee0`**。这不是错配——三者的 schema 字段集逐字相同（都是 `additionalContext, hookEventName`），所以它们合法地共享一张字段表。这是继 R80 的 `Failure`/`SetupErrorReport` 之后第二例"一址多结构"，但这一例**有第二来源作为解释依据**，不像上一例只能记作未裁决。

**地址成片**：六个地址全部落在 `0x151f9dd00..0x151f9e000` 这一段。hook 输出契约的字段数组是连续排布的，所以一次扫描就能全部命中。这也解释了为什么 R83 的 `PreToolUse` 认领和这里的地址只差 0x80。

## 3. 未定位的那一个

`PostToolUseHookSpecificOutputWire` 的 schema 字段是 `additionalContext, hookEventName, updatedMCPToolOutput`（3 个）。在 4005 条 run 里**没有任何 3 元素窗口**等于这个集合。

诚实表述：**schema 说它存在，记录数组没能证实它**。可能的原因（都不做断定）：该数组未被 R80 的扫描捕获（例如被合进更长的 run 而窗口边界不在 16 B 对齐上），或 `updatedMCPToolOutput` 这个名字未被认得。

记作 `UNLOCATED`，不按"存在"处理。

## 4. 这一轮能说"认证"，为什么

三层理由同时成立：

1. 判据是**集合相等**，不是包含——排除 R81/R82/R83 那类假阳性；
2. 两个来源**互相独立**：一个是 PE 内嵌 JSON Schema 的文本，一个是 `.rdata` 的 16 B 记录数组；
3. 每个对象的 `required` 成员都在读到的字段里（`hookEventName` 全部在位）。

所以 `LOCATED_ATTESTED = True`，而 `ALL_LOCATED = False`（有一个没定位）。这是本链条第一次把 `ATTESTED` 置真——它不是放宽，是因为判据本身够硬。

## 5. 交付

`apps/ai-service/app/core/hook_definition_binary_crosscheck.py`

- `DEFINITION_TOTAL=7`、`LOCATED_COUNT=6`、`UNLOCATED=("PostToolUseHookSpecificOutputWire",)`
- `WHOLE_RUN_COUNT=3`、`WINDOW_ONLY_COUNT=3`
- `LOCATED`: 6 项 `(字段数, 地址, 窗口偏移, 是否整条 run)`
- `SHARED_ADDRESSES=(("0x151f9dee0", (三个名字)),)`、`REGION="0x151f9dd00-0x151f9e000"`
- `LOCATED_ATTESTED=True`、`ALL_LOCATED=False`
- `address_of()` / `located_share()` / `validate_crosscheck()` / `crosscheck_summary()`

校验器拦：`ALL_LOCATED` 被改 True、未定位项与已定位项重叠、整条 run 带非零偏移、共享地址成员与自身地址不符、已定位+未定位 ≠ 7。

测试逐条导入上游 `HOOK_DEFINITION_OBJECTS` 断言字段数与 `required` 在位——判据**只在上游一处**，不在本模块复制一份。

## 6. 验证

| 项 | 结果 |
| --- | --- |
| pytest | **14 passed** |
| ruff | All checks passed（源头修 order-by-type 的 import 分组） |
| mypy（单文件） | no issues |

## 7. 诚实边界

1. **6/7，不是 7/7**。`PostToolUse` 未定位，不能说"全部坐实"。
2. 三个 2 字段定义共用一址，是因为 schema 字段集相同——这是解释，不是猜。
3. 本轮的"认证"只覆盖**字段名集合**，不含类型/枚举/默认值；类型契约仍只有 R64 的 JSON Schema 单源。
4. `PreToolUse` 虽是偏移 0 的窗口，但所在 run 长于 5，所以不能说"整条 run 就是它的数组"。
5. 字段**顺序**未判定（同前几轮）。

## 8. 剩下什么

- `PostToolUse` 的 3 元素数组：可换一种读法（例如放宽到"包含 3 个名字的超集窗口且该 run 长度适配"）再试一次；本轮不做，以免把弱判据混进已认证的表里。
- `HOOK_DEFINITION_ENUMS`（2 个枚举）未与二进制比对。
- 12 家族 input/output 契约（R63）是 23 段 schema，其中 7 个是 `definitions` 对象——本轮覆盖了这 7 个；**剩下 16 段是 inline 对象**，还没有对应的二进制数组定位。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
