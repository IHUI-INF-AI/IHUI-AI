<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R99 — 原生表格与图表：一个包里有两个 schema 命名空间

> 承 R98。目标是把 `--require-native-table-slide` 和两个 chart 门的空白填上。
> 结果：拿到第 4 个 finding kind、chart_gate 的完整信封，以及一条自己也没料到的负结果。

## 1. 先踩的坑：这些 flag 要取值，不是布尔

`--require-native-table-slide` 裸着传，`rc=2` + usage。看起来像布尔，读 `--help` 才知道：

```
[--require-native-table-slide REQUIRE_NATIVE_TABLE_SLIDE]
[--require-editorial-slide REQUIRE_EDITORIAL_SLIDE]
```

**它要的是页码**。补上 `1` 之后才出 verdict。同类还有 `--receipt`、`--require-embedded-workbook-slide`、`--approved-source-figure`、`--target-application`、`--expected-chart-slides`。

这一条值得记：**裸 flag 报 usage，而不是报"缺参数"以外的任何诊断**，所以第一次完全看不出是参数问题，只觉得"这 flag 不认"。浪费了一轮。

## 2. 第 4 个 finding kind：`required_native_table_missing`

同一个包，两种结果：

| 场景 | rc | 输出 |
| --- | --- | --- |
| 第 1 页有 `<a:tbl>` | 0 | `finding_count: 0` |
| 第 1 页没有表格 | 1 | `{"kind": "required_native_table_missing", "slide": 1}` |

⇒ 语义确认：**`--require-native-table-slide <页码>` = 指定某页必须有原生表格**。payload 只有 `slide`，没有别的字段。

## 3. chart_gate 的 schema 不是 `presentation-native-*`

这是本轮最意外的发现。此前一直以为整包统一用 `presentation-native-*.v1`（table-arithmetic / chart-titles 都是）。chart_gate 用的是：

```
owner-private.quantitative-chart-native-gate.v1
owner-private.actual-native-chart-discovery.v1
```

**前缀是 `owner-private`**。也就是说这个包里**至少有两个 schema 命名空间**，而且其中一个是"所有者私有"——从名字看，这两份结论不打算作为公共契约发布。

## 4. chart_gate 的完整信封（13 个顶层键）

```json
{
  "schema_version": "owner-private.quantitative-chart-native-gate.v1",
  "claim_boundary": "OOXML/workbook structural validation only; source provenance and native PowerPoint opening remain separate checks.",
  "passed": false,
  "package_sha256": "...",
  "expected_quantitative_chart_slides": [1],
  "validated_slide_count": 1,
  "failed_slide_count": 1,
  "failed_slides": [1],
  "results": [{
     "slide_number": 1, "status": "failed",
     "native_chart_count": 0, "required_native_chart_count": 1,
     "raster_picture_count": 0, "approved_source_figure_exception": false,
     "failure_codes": ["required_native_chart_missing"]
  }],
  "slide_count": 1,
  "source_attachments_accessed": false,
  "native_application_open_verified": false,
  "formal_human_reviewed": false
}
```

三处细节都值得记：

1. **`claim_boundary` 逐字自我划界**：只做 OOXML/workbook 结构校验，**源出处**与**原生 PowerPoint 打开**是另外两道检查。
2. **三个"未做"字段全是 `false`**：`source_attachments_accessed` / `native_application_open_verified` / `formal_human_reviewed`。这是在输出里明写"这三件事我没做"——不是漏了，是显式声明。
3. **`package_sha256` 是包级而非页级**。

## 5. 负结果：结构引用 chart part 不够

我造了一个标准的图表页：`ppt/charts/chart1.xml`（完整 `chartSpace` + barChart + 两个轴）+ slide 里 `<p:graphicFrame>` 引用 `<c:chart r:id="rId4"/>` + rels 与 ContentTypes 齐备。

结果：

```
native_chart_count: 0
failure_codes: ["required_native_chart_missing"]
```

**它没把我的 chart 认成 native chart。** 同为 0 的还有 `chart_title`（那个门输出 `native_chart_count: 0, passed: true` —— 零图表时它直接放行）。

⇒ 事实：**仅靠 OOXML 结构正确地把 chart part 引上，不足以被计为原生图表**。缺的那一环很可能与 `--require-embedded-workbook-slide` 提示的东西有关（embedded workbook）。这一条是本轮明确留下的口子，没有编解释。

## 6. `--discover-chart-slides` 是另一个信封（9 个键）

```json
{"schema_version": "owner-private.actual-native-chart-discovery.v1",
 "slide_count": 1, "chart_count": 0, "chart_counts": {},
 "chart_owner_slides": [], "chart_owner_slide_parts": {},
 "source_required_chart_owners_inferred": false,
 "source_attachments_accessed": false, "package_sha256": "..."}
```

同一个门，两种模式输出**两套完全不同的信封**，连 schema 都换。

## 7. 仍未触发的

| 面 | 尝试 | 结果 |
| --- | --- | --- |
| 正文词数上限 | 120 词 + `--max-content-prose-words 5`（含表格页） | rc=0 finding 0 |
| `--require-editorial-slide 1` | 给了页码 | rc=0 —— 语义未定 |
| chart 识别 | 标准 chart part + rels + ContentTypes | `native_chart_count: 0` |

## 8. 落成

- 新增 `apps/ai-service/app/core/codex_chart_gate_contract.py`（13/7/9 三套 key 表、两个 `owner-private` schema、`claim_boundary` 逐字、`required_native_chart_missing`、7 个取值 flag、`passed_from()`）
- 更新 `codex_presentation_gate_findings.py`：`FINDING_KINDS` 增至 **4** 个（新增 `required_native_table_missing`）

**36 passed**（两文件合计）、ruff 全绿、水印 4/4。

## 9. 合规

合成包全部自写；观测对象是执行输出。没有复制任何文件。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
