<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R98 — 内容层 findings：三态退出码，以及"warning 永不升级"

> 承 R97（只撞到结构层）。这轮先手工合成一个**结构合法**的 OOXML deck 并证明它通过完整性门，才让内容层变得可观测。
> 取证：1 个 base + 7 个内容瑕疵变体 × 实跑

## 1. 前提：先证明包是好的

内容层 findings 只有在"包本身合法"时才会浮出来。所以第一步是造一个结构完整的 pptx（`[Content_Types].xml` + `_rels/.rels` + `presentation.xml` + slideMaster + slideLayout + slide + theme，各带 rels）。

第一次提交时**被门抓了两个 bug**，恰好证明了它在真检查：

```
{"status": "error", "error": "duplicate relationship id rId1 in ppt/_rels/presentation.xml.rels"}
```

修掉 rId 冲突后：

```json
{"status": "pass", "finding_count": 0, "slide_count": 1, "chart_count": 0,
 "notes_parts_skipped": 0, "relationship_part_count": 5,
 "claim_boundary": "Structural package checks only; no slide text, notes, formulas, chart values, or native PowerPoint execution were inspected."}
```

`layout_geometry` 同样给出 `finding_count: 0`、`slide_size_in: [13.3333, 7.5]`。**结构层通了，内容层才开始说话。**

## 2. 退出码是三态，不是两态

R97 只观测到 0 和 2。真实是：

| rc | 含义 |
| --- | --- |
| 0 | 通过，或**只有 warnings** |
| 1 | 有 findings，且给了 `--fail-on-findings` |
| 2 | 结构性失败 / 用法错误 |

`rc=1` 这个状态只有拿着合法包才撞得到——这是本轮补上的最后一块。

## 3. 最重要的不对称：warning 不会被 `--fail-on-findings` 升级

标题末尾带句号，同时给 `--validate-heading-punctuation` **和** `--fail-on-findings`：

```json
{"kind": "presentation_heading_trailing_full_stop", "object_id": "2", "slide": 1,
 "heading_role": "title", "character_count": 17}
```

**rc=0**。

也就是说：`--fail-on-findings` 只把 **findings** 升级成失败，**warnings 永远是 warnings**。这是一个很硬的设计决定——它意味着"标点问题"这类瑕疵在 codex 自己的体系里被明确归类为**不该阻塞交付**的那一类。

这和本仓守门"未判定不冒绿 / 差值棘轮"是同源思想，但这里体现的是另一面：**分级不是靠加 flag，而是靠类别本身**。

## 4. 三种 finding 的真实结构（都带 `kind` 判别键）

| kind | 附加字段 | 触发 flag | rc |
| --- | --- | --- | --- |
| `inconsistent_presentation_font_family` | `font_families`, `font_family_count` | `--require-uniform-font-family` | 1 |
| `requested_slide_count_changed` | `actual_slide_count`, `expected_slide_count` | `--expected-slide-count` | 1 |
| `unexpected_slide_aspect_ratio` | `actual_cx_emu`, `actual_cy_emu`, `expected_aspect` | `--expected-aspect` | 1 |

finding 与 warning 共用一个判别键 `kind`，但**分属两个独立数组**（`findings` / `warnings`），各配 `finding_count` / `warning_count`。

## 5. 没撞出来的（诚实清单）

| 面 | 尝试 | 结果 |
| --- | --- | --- |
| 正文词数上限 | `--max-content-prose-words 50` + 120 个 "word" | rc=0，finding 0 —— 它**不按文本框总词数算**，需要特定段落结构 |
| 缺 native table | `--require-native-table-slide` | rc=2 + usage —— 该 flag 在当前形态下不被接受 |
| 标题溢出 | 窄框 + 超长标题 | finding 0 —— heading-fit 需要真实排版度量，纯 XML 宽度声明不够 |

三条都记录在 `UNTRIGGERED_KINDS` 里，没有假装它们"已验证"。

## 6. 落成的模块

`apps/ai-service/app/core/codex_presentation_gate_findings.py`：

- `EXIT_CLEAN/FINDINGS/STRUCTURAL_OR_USAGE` = 0/1/2，`EXIT_CODE_COUNT = 3`
- `FINDING_KINDS`（3 个，逐字段）、`WARNING_KINDS`（1 个，逐字段）
- `WARNING_IS_NOT_ESCALATED_BY_FAIL_ON_FINDINGS = True`
- `escalates_to_failure(kind, fail_on_findings)`：warning 永远 `False`
- `FLAG_TO_OBSERVED_TIER`（4 个 flag → finding/warning 分档）
- `INTEGRITY_CLAIM_BOUNDARY`（逐字）、`INTEGRITY_INSPECTS_SLIDE_TEXT = False`
- `PROSE_CAP_NOT_TRIGGERED`、`NATIVE_TABLE_FLAG_NOT_ACCEPTED_IN_OBSERVED_FORM`、`UNTRIGGERED_KINDS`

**19 passed**、ruff 全绿、水印 2/2。

## 7. 合规

合成包是我自己写的 OOXML（不是复制它的样例），观测对象是执行结果与诊断文本。全部事实来源是"跑出来的行为"。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
