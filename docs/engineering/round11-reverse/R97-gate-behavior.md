<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R97 — 六道门的行为契约：黑盒执行，不抄实现

> 触发：机主要求"照着源码临摹抄袭，不粘贴就得了"
> 做法：不临摹（临摹出来的东西仍属"derivative works"，与粘贴同一条禁令），改为**把六道门当黑盒跑起来，只依据观测到的行为写自己的实现**
> 取证：`--help` / 无参 / 喂一个结构极小的 pptx，三次执行 × 六门 = 18 次实跑

## 1. 为什么黑盒比临摹值钱

临摹拿到的是"它是怎么写的"。黑盒拿到的是"它到底怎么判的"。

这轮实测直接推翻了上一轮读文本得出的一个结论：R95 报告说**三道门**有 `--fail-on-findings`，实测是**四道**。读文本会漏，跑起来不会。

## 2. 拿到的三件新东西

### 2.1 `layout_geometry` 的真实参数是 34 个，完整清单

R95 只记了"33 个"。实测 34 个，按角色分成六组：

| 组 | 数量 | 成员 |
| --- | --- | --- |
| 白名单批准 | 10 | `--approved-bullet-slide` `--approved-dense-slide` `--approved-font-family` `--approved-heading-slide` `--approved-icon-slide` `--approved-image-sha256` `--approved-logo-placement-slide` `--approved-logo-sha256` `--approved-redundant-chart-slide` `--approved-script-font` |
| 强制要求 | 5 | `--require-editorial-slide` `--require-logo-bottom-left` `--require-native-table-slide` `--require-uniform-font-family` `--required-default-font-family` |
| 校验开关 | 3 | `--validate-bullet-geometry` `--validate-heading-fit` `--validate-heading-punctuation` |
| 上限/期望 | 9 | `--cover-role` `--cover-word-limit` `--expected-aspect` `--expected-slide-count` `--expected-slide-size-emu` `--folio-mode` `--max-content-prose-words` `--max-logo-area` `--max-redundant-table-charts` |
| 模式 | 4 | `--allow-cover-chart` `--allow-cover-table` `--forbid-unapproved-decorative-icons` `--inspect-font-families` |
| 判红 | 1 | `--fail-on-findings` |
| 内置 | 2 | `--help` `-h` |

合计 34。六门 flag 总数 **59**。

### 2.2 判定是两级的——这是本轮最重要的发现

喂一个结构极小（有 `[Content_Types].xml`、`.rels`、`presentation.xml`，但 `sldIdLst` 为空）的 pptx，六门**全部 rc=2**：

| 门 | 诊断（逐字） |
| --- | --- |
| layout_geometry | `presentation has no slide dimensions` |
| package_integrity | `presentation is missing required package part: ppt/_rels/presentation.xml.rels` |
| chart_gate | `Declare expected chart owners or explicitly request actual chart discovery` |
| table_arithmetic | `{"error": "native_table_arithmetic_audit_failed", "error_type": "ChartGateError", "passed": false, "schema_version": "presentation-native-table-arithmetic.v1"}` |
| chart_title | `Chart-title inspection could not validate the package` |
| template_fidelity | 返回 usage（没给 `--reference-slide` 就拒绝开始比较） |

关键在于**这些失败与 `--fail-on-findings` 无关**。也就是说：

```
结构坏  →  rc=2  硬红，任何 flag 都救不回来
内容瑕疵 →  默认只出诊断（rc=0），--fail-on-findings 才判红
```

⇒ **调用方不能靠"省略严格开关"让一个坏包通过**。这条设计是我们读多少遍文本都读不出来的，只有跑才会撞见。

### 2.3 诊断一律是 JSON，两个门带版本化 schema

六门全部把 JSON 写到 stdout。两个带 `schema_version`，形态统一：`presentation-native-*.v1`

- `native_table_arithmetic_gate` → `presentation-native-table-arithmetic.v1`
- `native_chart_title_gate` → `presentation-native-chart-titles.v1`

另外 `chart_gate` 与 `package_integrity` 输出 JSON 但无 schema 字段（前者 `{"ok": false, "error": ...}`，后者 `{"status": "error", "error": ...}`）——**同一个包里至少两种 JSON 外壳**。

## 3. 落成的模块

`apps/ai-service/app/core/codex_presentation_gate_behavior.py`：

- `FLAG_COUNTS`（6 门 → 8/4/2/8/3/34，`TOTAL_FLAGS = 59`）
- 34 个 geometry flag 逐字分组（六组 + 内置两个）
- `STRUCTURAL_FAILURE_EXIT_CODE = 2`、`NO_ARGS_EXIT_CODE = 2`、`HELP_EXIT_CODE = 0`
- `TWO_TIER_VERDICT` / `STRUCTURAL_FAILURE_IS_UNSOFTENABLE` / `CONTENT_FINDINGS_ARE_OPT_IN`
- `FAIL_ON_FINDINGS_GATES`（**4 个**，纠正 R95 的 3）
- `SCHEMA_VERSIONS`（2 个，`.v1` 后缀）
- `MINIMAL_DIAGNOSTICS`（5 条逐字诊断 + 1 条"返回 usage"）
- `content_verdict_is(gate, fail_on_findings)`：对坏包永远不返回 pass
- `structural_failure_is_hard()`：三级一致性断言

**21 passed**、ruff 全绿、水印 2/2。

## 4. 诚实边界

1. **拿到的是行为面，不是实现面**。六门各自的判据算法（比如"heading fit 的容差怎么算"、"跨页图表重复判定按什么距离"）仍然没有复现。要复现那些，需要构造能触发具体 findings 的 fixture，逐个撞出来——这是下一步。
2. `--receipt` 的实际输出结构仍未取。这轮只确认了它是 `chart_gate` 独有的 flag。
3. `template_fidelity` 缺 `--reference-slide` 时的行为（返回 usage）说明它**不是**"缺省比较自身"，而是"必须先指定基准"——但基准的性质（是页码还是路径）没测。
4. 极小结只触发了"结构层"失败。**内容层的 findings 一条都没被触发过**，所以 `--fail-on-findings` 的真实判据范围还是空白。

## 5. 合规说明

本轮**没有复制任何文件，也没有依据其实现代码改写**。做法是：执行 → 观测退出码与诊断文本 → 把观测到的事实写进本仓模块。诊断文本逐字记录属于"报告观察结果"，不构成对材料的再分发。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
