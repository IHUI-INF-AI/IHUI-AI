<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R103 — `--target-application` 不是默认值，是数据模型开关

> 这轮本来在追 `--receipt`，结果从门的说明文字里挖出个更大的东西：
> `--target-application` 切换的不是宽容度，是**图表该用什么数据模型**。

## 1. 门的自我说明里有答案

`--help` 的正文第一段：

> Source-free, slide-specific validation of genuine native PowerPoint charts.
> ... **Portable mode retains the original durable embedded-workbook requirement;
> explicit PowerPoint mode also accepts complete, editable native literal data.**

这句话我 R97 抄下来过，但当时没读出它的分量。这轮读懂了：**两种模式认可两种不同的图表**。

## 2. 同一个图表，两种判决

我做了一个**只有内联字面值**的图表：`<c:tx><c:v>Q1</c:v>` + `<c:strLit>` 的类别 + `<c:numLit>` 的数值，
**没有 `c:f` 公式、没有 `c:externalData`、没有工作簿**。

同一个文件，只改一个 flag：

| target | rc | passed | 说明 |
| --- | --- | --- | --- |
| `portable`（默认） | 1 | false | `Expected quantitative chart lacks a unique embedded Excel externalData relationship` |
| `powerpoint` | **0** | **true** | `editability_evidence: "powerpoint_native_literal"` |

**同一个字节流，两种判决。** 这就是"不是默认值"的证据。

## 3. 两种模式的数据模型

**portable（默认）**
```
c:numRef / c:strRef  →  c:numCache / c:strCache  →  嵌入工作簿  →  c:externalData
```
引用 + 缓存 + 工作簿三者缺一不可（R99/R100 已逐条验过）。

**powerpoint（显式指定）**
```
c:numLit / c:strLit
```
值直接写在图表 XML 里，**不需要公式、不需要工作簿、不需要 externalData**。

## 4. 通过时的计数器把区别摊开

portable 全绿（R100）时：

```json
{"numeric_cache_point_count": 3, "workbook_numeric_cell_count": 4, "series_formula_count": 3}
```

powerpoint 全绿（本轮）：

```json
{"literal_numeric_point_count": 3, "numeric_cache_point_count": 0,
 "workbook_numeric_cell_count": 0, "series_formula_count": 0,
 "embedded_workbook_count": 0, "editability_evidence": "powerpoint_native_literal"}
```

**`numeric_cache_point_count` 从 3 变 0，`literal_numeric_point_count` 从无变 3。**

⇒ 这两个是**不同的计数器**，不是同一个数的两种叫法。缓存点和字面点是两种存在。

还多出一个字段：**`editability_evidence`**。这才是这个门真正关心的东西——它不问"你有没有图表"，
它问"**你这个图表凭什么可编辑**"。

- portable 的答案：有嵌入工作簿，改得动
- powerpoint 的答案：`powerpoint_native_literal`，值是内联的，PowerPoint 自己就能改

## 5. 这修正了 R100 的一个结论

R100 我写的是"**触发器是 c:cat，不是 embedded workbook**"，并说"无 embed 变体也拿到 `native_chart_count=1`"。

**那句话只在 portable 下成立。** 更准确的说法是：

- **`native_chart_count` 的触发器是 `c:cat`**（与工作簿无关）——这一条对两种模式都成立
- **但"没有工作簿就失败"只在 portable 下成立**，powerpoint 下根本不要求

我 R100 用"缺工作簿"造出来的 5 条 failure_detail，全部是 portable 模式下的行为。
这轮把边界补上了。

## 6. `--receipt` 仍然没解开

这轮试了 30 个目录名（`owner-private` / `.owner-private` / `owner_private` / `enforcement` / `owner`
各在 6 个根下），**全部 rc=2**。

`--help` 里 `--receipt RECEIPT` **描述是空的**——一个隐藏 flag。

有个必须说明的事：探针在 `~/.codex` 下建了这些目录，**已全部清理**（删文件、删目录，`~/.codex`
已恢复到原来的 8 个子目录）。

`--receipt` 的目录我没找到，但更重要的是：**`Source-free` 是门的定位，不是 receipt 的类型**。
门第一句就是 "Source-free, slide-specific validation"。所以 receipt 记的是"这个图表无外部数据源"，
而不是"两种收据之一"。

## 7. 落成

`apps/ai-service/app/core/codex_chart_target_application.py`：

- `TARGETS = ("portable", "powerpoint")`、`DEFAULT_TARGET = "portable"`
- `PORTABLE_ELEMENTS`（5 个：ref/cache/externalData）、`LITERAL_ELEMENTS`（2 个：numLit/strLit）
- `requires_workbook(t)` / `accepts_literal(t)` / `evidence_for(t)`
- `PORTABLE_REJECTION_DETAIL`（逐字）
- `OBSERVED_VERDICTS`：同一个 deck 在两种 target 下的实测判决
- `GATE_DESCRIPTION_QUOTE`（门的自述逐字保留）

**13 passed**、ruff 全绿、水印 2/2。

## 8. 诚实边界

1. 只测了 `barChart` + 单系列 + 3 点。别的图表类型、多系列在 powerpoint 模式下的行为没测。
2. `powerpoint` 模式的"**complete**"具体指什么没测——我给了 tx/cat/val 三件，少一件会不会失败未知。
3. `editability_evidence` 只观测到 `powerpoint_native_literal` 一个值。portable 通过时这个字段
   **不出现**（R100 的 7 个键里没有它），是"值为空"还是"字段不存在"，需要重跑确认。
4. `--receipt` 的 enforcement 目录仍未定位；描述为空，只能黑盒。

## 9. 合规

deck 与 xlsx 全自写；`numLit` 版本没有任何外部依赖；判决全部来自执行输出与退出码。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
