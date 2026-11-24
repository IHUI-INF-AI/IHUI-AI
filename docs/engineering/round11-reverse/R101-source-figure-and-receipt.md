<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R101 — 源图豁免与收据：两道门，一道都绕不过去

> 承 R100 全绿。这轮攻 chart 门最后两处空白：`--approved-source-figure` 与 `--receipt`。
> 结果：豁免的真条件比预期多一层，收据的目录约束完全没解开。

## 1. 位图不是图表——它先说这句话

我给一页放了一张真 PNG（`ppt/media/image1.png` + `p:pic` + image 关系），但没声明例外：

```json
"failure_codes": ["raster_picture_is_not_native_chart", "required_native_chart_missing"],
"raster_picture_count": 1,
"native_chart_count": 0
```

⇒ **`raster_picture_is_not_native_chart`**。这个码的意思是："你把一张图放在了该放图表的地方，但那不是图表。"

而它同时**分开计** `raster_picture_count`（1）和 `native_chart_count`（0）——两个计数器互不代偿。

## 2. 豁免不是给个页码就成立的

`--approved-source-figure` 我试了两种形态：

| 传入 | 结果 |
| --- | --- |
| 64 位十六进制（猜是摘要） | rc=2 `A source-figure exception must target an explicitly expected quantitative slide` |
| `1`（页号，且该页确实在 `--expected-chart-slides` 里） | 参数被接受，但 **`exception: false`**，仍判红 |
| `2`（页号但不在预期列表） | rc=2，同上 |

**结论：它是页码，不是摘要。** 但拿到页号还不够，测下来是**三个条件全部成立**才成立：

1. 页码出现在 `--expected-chart-slides`
2. 该页**有**至少一张位图（`raster_picture_count ≥ 1`）
3. 该图**带不可编辑披露**

第 3 条是这轮最意外的一条，也是它自己的失败码说的：

```json
"failure_codes": ["approved_source_figure_missing_noneditable_disclosure", "required_native_chart_missing"]
```

⇒ **`approved_source_figure_missing_noneditable_disclosure`**

也就是说：**你可以用一张图替代图表，但你必须声明这张图是不可编辑的。** 不披露 = 豁免不成立。

## 3. 这两条码合起来描述的是一条两门政策

```
要图表页 → 要么给原生 chart
          → 要么声明例外（页码 + 位图）
             → 且必须披露"不可编辑"
```

**两条通道都不能靠"把东西放上去"蒙混。** 用截图冒充图表会被 `raster_picture_is_not_native_chart` 当场点名；想走豁免又会撞上披露要求。这是整个门族里设计得最锋利的一处——它不是"检查有没有图表"，而是检查**你打算怎么交代**。

## 4. `--receipt`：约束找到了，目录没找到

`--receipt` 接受一个路径，但只要不在"owner-private enforcement directory"里就拒：

```json
{"ok": false, "error": "Source-free chart receipts must remain inside the owner-private enforcement directory"}
```

我按名字搜了 `CODEX_HOME`、bundle、`~/.codex` 三处，只搜到一堆 `receipt-*.js` 的 lucide 图标，**那个 enforcement 目录没有找到**。这轮到此为止，不猜。

## 5. 四个 rejection code 的全景（截至本轮）

| code | 首次出现 | 含义 |
| --- | --- | --- |
| `required_native_chart_missing` | R99 | 该页要有原生图表，没有 |
| `native_chart_workbook_contract_failed` | R100 | 缓存与工作簿不一致等 5 种 |
| `raster_picture_is_not_native_chart` | R101 | 位图不因放在图表位而成为图表 |
| `approved_source_figure_missing_noneditable_disclosure` | R101 | 豁免了但没声明"不可编辑" |

另有三条 usage 级错误（`ok:false` 外壳）：缺 owners/discover、收据目录越界、豁免目标不是预期页。

## 6. 落成

`apps/ai-service/app/core/codex_chart_rejection_codes.py`：

- `RESULT_CODES`（4 个，逐字）
- `USAGE_ERRORS`（3 条，逐字）
- `EXCEPTION_CONDITIONS`（3 个条件）
- `exception_grantable(in_expected, has_raster, has_disclosure)`：三条件同时成立才 True
- `raster_can_satisfy_native() -> False`
- `RECEIPT_MUST_BE_INSIDE = "owner-private-enforcement-directory"`、`RECEIPT_DIRECTORY_LOCATED = False`、`RECEIPT_WRITTEN_IN_PROBES = False`

**14 passed**、ruff 全绿、水印 2/2。

## 7. 诚实边界

1. **豁免从未被成功授予**。我给出了全部三个条件里能给的（页码 + 位图），但"不可编辑披露"的具体形态没试出来，所以 `exception: true` 我**一次都没见到**。模块里 `EXCEPTION_NEVER_GRANTED_IN_PROBES = True` 就是记这件事。
2. **收据目录未定位**，`RECEIPT_DIRECTORY_LOCATED = False`，没写任何收据文件。
3. 三个条件的第 3 条，我只能从失败码反推"披露"存在，**它的具体载体**（是图片名、是文本、是 XML 属性）没测。
4. 4 个 code 不等于全部——只覆盖我实际制造出的缺陷。

## 8. 合规

PNG 是我用 zlib 手工生成的；pptx 全自写；观测对象是执行输出。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
