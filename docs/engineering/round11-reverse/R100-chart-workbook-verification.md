<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R100 — 图表工作簿校验：触发器是 `c:cat`，不是 embedded workbook

> 承 R99 的负结果（结构引用 chart part 仍计 0）。这轮把它撞开了，而且撞出了这个门最硬的能力。
> 取证：2 个变体（无 embed / 有 embed）× 4 次调用，中间被门连续纠正 5 次

## 1. 触发器找错了两次，最后落在了正确的答案上

R99 的假设是"缺 embedded workbook"。**这个假设是错的。**

这轮 `chart_noembed` 变体（**完全没有** embedded workbook）也拿到了 `native_chart_count: 1`。

真正的差别在别处：R99 的 chart 只有 `<c:tx>` 和 `<c:val>`；这轮我加了 **`<c:cat>`（类别序列）**。

⇒ **判定条件是"有没有类别序列"，与工作簿无关。**

```
c:tx + c:val            → native_chart_count = 0
c:tx + c:cat + c:val    → native_chart_count = 1
```

这一条特别值得记：如果我按 R99 的假设直接把 embedded workbook 加上，序号会变，但**归因会是错的**，我会以为是工作簿解决了问题，而其实从头到尾是 `c:cat` 的事。

## 2. 被门连续纠正五次，每一次都是我自己的真错

chart 一旦被计为原生图表，这个门立刻开始逐层校验，而它给的每一条诊断都精确到"哪一条系列、第几个点"：

| # | failure_detail（逐字） | 我的真实缺陷 |
| --- | --- | --- |
| 1 | `Expected quantitative chart category and numeric value counts disagree` | cat 有 3 点、val 只有 1 点 |
| 2 | `Expected quantitative chart does not resolve its embedded Excel package relationship` | 没给 `c:externalData` |
| 3 | `An embedded workbook cell references a missing shared string` | 我的 xlsx 用了 `t="s"` 却没有 sharedStrings 部件 |
| 4 | `Chart series 1 cat: cached point 1 differs from its exact referenced worksheet cell; refresh the chart cache from that range` | cat 引用了数字单元格却声明成字符串 |
| 5 | `Chart series 1 tx: cached point 0 differs from its exact referenced worksheet cell; …` | tx 引用 `$A$1`（=Q1），缓存却写 `Revenue` |

**这五条是完整的校验链**，且是**按顺序暴露**的——每一层过了才检查下一层。第 4、5 条是重量级能力：它把 chart XML 里的**缓存值**与 embedded workbook 里的**真实单元格**逐个比对，发现不一致就点名"第几条系列、第几个点"，还附上修法（`refresh the chart cache from that range`）。

## 3. 全绿时的形态：`charts[]` 只在通过时出现

```json
{"passed": true, "failed_slide_count": 0, "failed_slides": [],
 "results": [{
   "status": "passed", "failure_codes": [],
   "native_chart_count": 1, "required_native_chart_count": 1,
   "raster_picture_count": 0, "approved_source_figure_exception": false,
   "charts": [{
     "cache_reference_ranges_verified": true,
     "embedded_workbook_count": 1,
     "embedded_workbook_sheet_count": 1,
     "native_chart_types": ["barChart"],
     "numeric_cache_point_count": 3,
     "series_formula_count": 3,
     "workbook_numeric_cell_count": 4
   }]
 }],
 "required_embedded_workbook_slides": [1],
 "target_application": "portable"
}
```

**7 个 `charts[]` 字段只在 pass 时出现，失败时整个数组不在。** 这是很强的设计：诊断只在成功时给出细账，失败时只给一条病因——不让调用方从失败输出里推测"我到底差多少"。

其中最漂亮的一对数字：**`workbook_numeric_cell_count: 4` vs `numeric_cache_point_count: 3`**。我在工作簿里写了 B1–B4 四个数，图表只引用了其中三个，**它两个都数出来了**，并且知道有一个没被引用。

## 4. `target_application` 与 flag 依赖

- `target_application` 默认 `portable`，可选 `portable | powerpoint`
- `--require-embedded-workbook-slide` **不能单独用**，必须先给 `--expected-chart-slides` 或 `--discover-chart-slides`，否则 rc=2 报 `Declare expected chart owners or explicitly request actual chart discovery`

## 5. 落成

`apps/ai-service/app/core/codex_chart_workbook_verification.py`：

- `NATIVE_CHART_COUNT_TRIGGER = "c:cat"`、`counted_as_native(elements)`（R99/R100 两组元素对照）
- 5 条 `failure_detail` 逐字（两个模板带 `{series}`/`{point}` 占位）
- `VERIFICATION_STAGES`（4 层，按实际触发顺序）
- `PASS_CHART_KEYS`（7 个 pass-only 字段）
- `OBSERVED_WORKBOOK_NUMERIC_CELLS = 4` / `OBSERVED_NUMERIC_CACHE_POINTS = 3` / `WORKBOOK_HAD_ONE_UNREFERENCED_CELL = True`
- `detail_for(stage, series, point)`：按层渲染逐字病因

**15 passed**、ruff 全绿、水印 2/2。

## 6. 诚实边界

1. `native_chart_types` 只观测到 `barChart` 一种，其他图表类型未测。
2. `cache_reference_ranges_verified` 的具体判定规则（是逐点全等还是容差）未探——我只知道不一致会报、一致会过。
3. 5 条 `failure_detail` 不是全部可能值——只覆盖了我实际制造出的缺陷类型。
4. `--receipt` 的输出结构仍然没取（这轮专注在 pass/fail 两态）。
5. `--approved-source-figure` 的语义仍空白（它出现在 result 里作为 `approved_source_figure_exception`，但从没被设为 true 过）。

## 7. 合规

所有 pptx 与内嵌 xlsx 均为自写 OOXML；观测对象是执行输出与诊断文本。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
