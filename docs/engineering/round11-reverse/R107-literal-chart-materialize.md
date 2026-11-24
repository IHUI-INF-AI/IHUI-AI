<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R107 — 把字面值变成真工作簿：R103 那个缺口被补上了

> R103 留下一个判断：字面值图表（`c:v` + `c:strLit` + `c:numLit`，无 `c:f`、无 `c:externalData`）只能在 `powerpoint` 模式用，`portable` 一律拒绝。
> 这轮找到了补它的工具，而且真的跑通了。

## 1. 结果先说

```
numlit.pptx (5,208 B)  ->  out.pptx (6,915 B)   rc=0
converted_chart_count: 1
workbook_part: ppt/embeddings/chart-data-snapshot-001.xlsx
portable_chart_validation_passed: true
```

**字面值物化成工作簿之后，`portable` 校验通过了。** R103 说的"字面值走不通 portable"，现在有了正解。

## 2. 工具自己的措辞值得抄下来

`--help` 里那句自我说明：

> Experimental: snapshot complete literal chart data into an honest embedded XLSX. A snapshot creates new chart-owned worksheet formulas. **It never recovers, preserves, or claims lineage** to an original source workbook or its formulas.

它在**开头就声明自己是实验性的**，连 schema 名都带前缀：`experimental.literal-chart-workbook-snapshot.v1`。

## 3. 四层前置条件，每一层都是被拒出来的

| 试法 | 答复 |
|---|---|
| 无参 | `required: source, destination, --workspace, --receipt` |
| 两个位置参数 | `required: --workspace, --receipt` |
| 相对路径 | `Chart snapshot requires exact absolute staged input/output/receipt/workspace paths` |
| 绝对但文件是假的 | `Chart snapshot input must be an approved bounded staged PPTX` |
| 真字面值 PPTX | **rc=0** |

**"staged" 这个词第三次出现**（R103 的 receipt、R104 的边界，加上这轮）。输入的三个形容词缺一不可：**approved ∧ bounded ∧ staged**。

## 4. 最漂亮的是它拒绝

我试着要求它"保留原始源公式"：

```
--require-source-formulas-slide 1
-> {"error": "A literal snapshot cannot preserve expressly required original source formulas
          or workbook", "error_category": "SnapshotError", "ok": false}
```

**它拒绝被诱导做一个它做不到的来源声明。**

一个工具能主动说"我不能给你这个假承诺"，比它能做多少事更能说明设计者的态度。

## 5. 18 字段信封

```
conversion                        chart_data_snapshot
converted_chart_count             1
converted_charts                  [{chart_part, owner_slide, point_count, series_count, workbook_part}]
detected_chart_owner_slides       [1]
experimental                      true
input_sha256                      67c258f2...
new_formulas_describe_snapshot_only  true
output_bytes                      6,915
output_sha256                     4348f73a...
portable_chart_validation_passed  true
portable_validated_owner_slides   [1]
preserved_existing_workbook_chart_count  0
preserved_existing_workbook_charts       []
schema_version                    experimental.literal-chart-workbook-snapshot.v1
source_formula_required_slides    []
source_formulas_preserved         false
source_workbook_preserved         false
source_workbook_required_slides   []
```

**四个诚实性字段全是 false 或零**：源公式没保留、源工作簿没保留、已有工作簿图表一个没动。

`new_formulas_describe_snapshot_only: true` —— 新公式只描述这一次快照，不冒充原始数据。

## 6. 补齐了 R100/R103 之间的断链

| 轮次 | 结论 |
|---|---|
| R100 | `portable` 需要真工作簿 + `c:cat` 触发 |
| R103 | `powerpoint` 接受字面值，`portable` 拒绝 |
| **R107** | **物化工具把字面值升级成工作簿，`portable` 也过了** |

三段接上之后，从"只有内联数字"到"通过 portable 校验"有了完整可行的路径。

## 7. 落成

`apps/ai-service/app/core/codex_literal_chart_materialize.py`：

- `SELF_DESCRIPTION`（逐字，含 no-lineage 条款）
- `SCHEMA_VERSION`（自带 experimental 前缀）
- `POSITIONAL_ARGS`(2) / `REQUIRED_OPTIONS`(2) / `VALUE_OPTIONS`(2) / `REQUIRED_ARG_COUNT=4`
- 四条拒绝文本 `STAGE_1_ERROR..STAGE_4_ERROR` + `PRECONDITION_TRIAD`
- `REFUSAL_ERROR` + `REFUSES_FALSE_PROVENANCE=True`
- `ENVELOPE_KEYS`(18) + `CONVERTED_CHART_KEYS`(5)
- `OBSERVED_INPUT_BYTES=5208` / `OBSERVED_OUTPUT_BYTES=6915`
- `LITERALS_PORTABLE_BEFORE=False` / `LITERALS_PORTABLE_AFTER=True` / `CLOSES_R103_GAP=True`

**17 passed**、ruff 全绿、水印 2/2。

两条反向变异：`SOURCE_FORMULAS_PRESERVED` 改 True → 红；`PRECONDITION_TRIAD` 砍掉一个形容词 → 红。

## 8. 诚实边界

1. **只跑了一种输入**（R109 的 `numLit` 单页单图 3 点）。多图、多页、已有工作簿混合的情形没测。
2. `--require-source-workbook-slide` 我试了但和 formulas 那条一起触发的，**单独试它会不会报别的错，没分离**。
3. "approved" 和 "bounded" 的具体判据没摸到——我只知道这三层存在，不知道各自的阈值。
4. 那个 `out.pptx` 我只看了字节数和 receipt，**没有把它再喂给 chart gate 独立复验**。
5. 序号 `001` 的递增规则（第二张图会不会是 002）没测。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
