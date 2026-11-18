<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R83 — 滑动窗口认领：16 个新结构，其中 1 个被第二个来源认证

## 1. 动机

R81 要求**整条 run** 就是某结构的数组（长度 == arity ∧ 整条名字集 ⊇ 部分名）。但 R80 读出的 run 最长 62 条记录——那是**多个结构首尾相连**。所以本轮把判据从"整条 run"改成"run 内任意窗口"。

## 2. 判据

对每个尚未认领的 under 结构（144 个，326 个 site）：

1. 取它的 arity `a`；
2. 在所有 4005 条 run 上滑动长度 `a` 的窗口；
3. 用 `score = max(该结构的每个池变体 ∩ 窗口)` 打分；
4. 取 score 最高且**唯一**的窗口（无第二窗口并列、无其他结构在同一窗口拿到同分）；
5. 同一窗口被多个结构认领 ⇒ 全部判为争用，不采纳。

读数：**16 个 clean、0 个争用**。

## 3. 关键读数：窗口增量是 0

16 个命中的窗口**全部 `off = 0`**，即都落在 run 起点——等同于"整条 run 就是该数组"。

也就是说：**长 run 的切分收益为 0**。R80 里那些 20–62 条记录的长 run，按"部分名打分"这条路切不出任何额外的结构。这是一个否证式读数，值得记下来：**长 run 不是多个结构的字段表拼接**，更可能是同一个结构的多副本，或根本不是字段表（例如别种 16 B 记录）。

## 4. 跨源互相印证：本轮唯一被认证的一条

| 来源 | `PreToolUseHookSpecificOutputWire` 的字段 |
| --- | --- |
| R64：PE 内嵌 JSON Schema 的 `definitions` | `additionalContext, hookEventName, permissionDecision, permissionDecisionReason, updatedInput`（required = `hookEventName`） |
| R83：二进制 FIELDS 记录数组 | `hookEventName, permissionDecision, permissionDecisionReason, updatedInput, additionalContext` |

**5 个字段集合完全相等，且 `required` 成员就在读到的名字里。** 两条来源互相独立（一条是 JSON Schema 文本，一条是 `.rdata` 的记录数组），一致即认证。

这条是本轮最有分量的产出：**同类判据第一次做到"认证"而不是"候选"**。它同时给出一条通用做法——凡是能和 R63/R64 的 JSON Schema 对上的结构，都能这样升格。

## 5. 证据分级

16 个不平均，必须分层：

| 层 | 数量 | 判据 |
| --- | --- | --- |
| **跨源认证** | **1** | 与 JSON Schema 定义集合相等 |
| 自洽（单源） | 13 | 字段语义与结构名相符 |
| **薄证据** | **2** | score = 2/7，只有 2 个名字来自池，另 5 个本轮首次出现 |

薄证据的两个：`BrowserUseOriginPolicyToml`（`access, downloads, uploads, full_cdp_access, auto_review, persistent_approval, access_approval_lifetime`）与 `ExecutorPlugin`（`remotePluginId, version, localVersion, name, shareContext, source, installed`）。两者字段本身读起来都合理，但 7 个里只有 2 个有池证据支撑，其余靠这次窗口认领——证据薄，标出来而不并入统计。

## 6. 净增量

16 个与 R75/R80/R81/R82 的表**零重叠**（生成器已排除，测试逐名断言）。覆盖 **305 → 321**。

分层表述：305（3 种判据）+ 16（窗口判据）= **321**，其中**只有 1 个**够格称为认证。

## 7. 交付

`apps/ai-service/app/core/struct_window_claims.py`

- `UNCLAIMED_UNDER=144`、`UNDER_SITES=326`、`WIDTH=16`、`MIN_SCORE=2`
- `WINDOW_CLAIMS`: 16 项 `(arity, run 地址, 窗口偏移, 重叠分, 字段序)`
- `CROSS_SOURCE_ATTESTED=("PreToolUseHookSpecificOutputWire",)`
- `THIN_EVIDENCE=("BrowserUseOriginPolicyToml","ExecutorPlugin")`
- `COVERAGE_BEFORE=305`、`COVERAGE_AFTER=321`、`WINDOW_CLAIMS_ATTESTED=False`
- `fields_of()` / `score_of()` / `thin_share()` / `validate_window_claims()` / `window_claims_summary()`

校验器拦：同一结构被分级两次、薄证据不在分数下限、score 超出 `[2, arity]`、`ATTESTED` 被改 True、字段重复、覆盖算术不符。

## 8. 验证

| 项 | 结果 |
| --- | --- |
| pytest | **13 passed** |
| ruff | All checks passed（源头修 2 处未用 import + 1 处 Yoda） |
| mypy（单文件） | no issues |

## 9. 诚实边界

1. **窗口判据整体仍是"候选"**，只有能和第二来源对上的那 1 个升为认证。16 个里 13 个是单源自洽，2 个是薄证据。
2. **长 run 切分收益为 0**——不要因为"支持了窗口"就假定能切开长 run，实测证明了切不开。
3. `PreToolUseHookSpecificOutputWire` 的**字段顺序**来自数组记录序；JSON Schema 的 `definitions` 里 properties 是字典序，两者顺序不同但集合相等。顺序仍不能声称等于声明序。
4. 争用 0 个，但判据只排除"同窗口同分"，未排除"同窗口不同分但都低"的情况——因为只取唯一最高分，这种情况本就不采纳。

## 10. 下一步的可认证化路径

`PostToolUseHookSpecificOutputWire`（JSON Schema 里 3 字段：`additionalContext, hookEventName, updatedMCPToolOutput`）不在本轮 16 个里。若能在 4005 条 run 里定位到它，就能再认证一条。路径同样是"窗口 + 与 definitions 对集合"，只需把判据从"部分名 ⊆ 窗口"放宽到"JSON Schema 字段集 ⊆ 窗口 ∧ 窗口长度 == 该定义字段数"——**以第二来源为主语反查**，而不是以待认结构为主语。这是下一轮最省力的增量方向。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
