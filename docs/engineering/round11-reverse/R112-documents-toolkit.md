<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R112 — documents：36 个工具、一种占位符、一个看不见的坑

> `presentations` 有 12 个容器工具，`documents` 有 **36 个**。这轮先把全貌和契约拿下，再钻进去测两件不看纸面就不知道的事。

## 1. 版图

```
documents/
├── SKILL.md (554 行)
├── scripts/            36 个 .py
├── ooxml/              4 篇规范笔记（comments / hyperlinks_and_fields / rels_and_content_types / tracked_changes）
├── tasks/              12+ 篇任务指南（a11y / captions_crossrefs / clean_tracked_changes /
│                       comments_manage / compare_diff / create_edit / equations / fields_update /
│                       fixtures_edge_cases / footnotes_endnotes / forms_content_controls / headings_numbering …）
├── troubleshooting/    2 篇
└── container_tools/    mark_artifact_operation_started.mjs
```

36 个工具全部跑到 `--help`，契约拿到了。**模式高度统一**：

| 形态 | 数量 | 说明 |
|---|---|---|
| `in_docx + --out` | **32** | 读包 → 打补丁 → 写新包 |
| 子命令 | **1** | `content_controls`：`list` / `wrap_placeholders` / `fill` |
| `--mode` | **3** | `accept_tracked_changes`(report/accept/reject)、`watermark_audit_remove`(report/remove)、`set_protection` |

**没有一个是原地修改**（`set_protection` 例外有 `--out`）。全都要显式给输出路径 —— 这个设计是对的，原件不动。

## 2. 第一件：占位符只认一种语法，这是试出来的

`wrap_placeholders` 到底认什么语法，纸面上看不出来。造一份文档，塞进 5 种候选：

```
Name: {{name}}          ← 双花括号
Title: <<title>>        ← 双尖括号
Code: ${code}           ← 美元花括号
Bracket: [ref]          ← 方括号
Plain paragraph ...     ← 无占位符
```

跑 `wrap_placeholders`：

```
[content_controls] wrapped placeholders in 1 run(s)
```

**包里 5 个候选，只包了 1 个。** `list --json` 确认是哪个：

```json
[{"part": "word\\document.xml", "tag": "name", "alias": "name", "text": "{{name}}"}]
```

⇒ **语法锁死为 `{{tag}}`，别的都不认。**

**这个契约不能猜**：调用方若按 `${name}` 写模板，不会收到任何错误 —— **会拿到一份静默填不满的文档**。这正是必须写进模块的那类事实。

## 3. 第二件：填进去的值是真的，但 `paragraph.text` 看不见它

`fill --set name=Alice` 之后，三个视角给出三个答案：

| 视角 | 结果 |
|---|---|
| `list --json` | `{"tag": "name", "text": "Alice"}` |
| 原始 XML | `<w:sdtContent><w:r><w:t>Alice</w:t></w:r></w:sdtContent>`（`Alice` 出现 1 次） |
| python-docx `paragraph.text` | **`'Name: '`** |

**三个都是真的。**

值确实在包里，Word 打开会显示 Alice。它只是坐在 `w:sdt/w:sdtContent` **嵌套层**下，而 `Paragraph.text` 只拼**直接子级 run** —— SDT 里的 run 不是直接子级。

**⇒ 下游任何用 `paragraph.text` 读文档的东西，都在看这个值的旁边过去。**

`redact_docx`、`privacy_scrub`、`style_lint`、`heading_audit`……这些工具如果基于 `paragraph.text`，**SDT 里的内容一律漏掉**。脱敏工具漏掉一个 SDT 里的姓名，比漏掉一个普通段落糟糕得多。

**这和 R109 是同一类失败的第二次出现**：一个仪表报 clean，因为它看不见它该看的东西。区别在于 —— **R109 是工具 bug，这个是 python-docx 的既定行为**。已知行为更危险，因为没人会去提 issue。

## 4. 一个单位陷阱

`docx_ooxml_patch.py` 的缩进参数叫 **`--indent-left-twips`**。

Word 的水平几何用 **twip**（1/20 pt）；`presentations` 里的绘图面全部用 **EMU**。

```
1 twip = 635 EMU
1 pt   = 20 twip = 12,700 EMU     ← 这正好是 R110 的容差值
1,000,000 用错单位不是"小误差"
```

两套单位混用不会报错，只会算错一个数量级。所以写进模块：`TWIPS_BELONGS_TO_DOCUMENTS` / `EMU_BELONGS_TO_DRAWINGS`。

## 5. 落成

`apps/ai-service/app/core/docx_toolkit_contract.py`：

- `TOOLS`（36 条，名字 + 字节）+ `TOOL_COUNT=36`
- `CONTRACT_FAMILIES`（32 / 1 / 3，且总数必须等于 36 —— 有断言）
- `SUBCONTRACT_COMMANDS` / `MODE_TOOLS` / `MODE_CHOICES`
- `PLACEHOLDER_SYNTAX="{{tag}}"` / `REJECTED_SYNTAXES`（4 种）/ `CANDIDATES_TRIED=5` / `WRAPPED_RUNS=1`
- `SDT_XML_SHAPE`（逐字）/ `SDT_PLAIN_TEXT_MARKER="<w:text/>"`
- `LISTED_TEXT_AFTER_FILL="Alice"` / `RAW_XML_OCCURRENCES_OF_VALUE=1` / `PARAGRAPH_TEXT_AFTER_FILL="Name: "`
- **`SDT_VALUE_IS_INVISIBLE_TO_PARAGRAPH_TEXT=True`** / **`READ_PATCH_WRITE_TOOLS_MAY_BE_BLIND=True`**
- `family_of()` / `is_placeholder()`（只认双花括号）
- 单位：`TWIPS_PER_POINT=20` / `EMU_PER_TWIP=635`，且断言 `635*20 == 12,700`

**15 passed**、ruff 全绿、水印 2/2。

三条反向变异：声称支持第二种语法 → 红；把盲区抹掉 → 红；名单砍掉一个 → 红。

## 6. 诚实边界

1. **36 个工具我只跑了 `--help`，真正执行过的是 1 个**（`content_controls` 的三个子命令）。其余 35 个的**行为**——不只是契约——**没有验证过**。
2. 占位符语法我只试了 5 种候选，**不能排除还有我没想到的形态**。
3. `wrap_placeholders` 的 `--no_headers_footers` 默认扫页眉页脚，**页脚里的 SDT 我没测**。
4. 那个"只包了 1 run"—— **一个段落里有多个 `{{}}` 时怎么处理，没测**。
5. 盲区我只在 python-docx 1.2.0 上验证过，**别的解析器（Word 本身、LibreOffice）能否看见 SDT，我没验证**。诚实说：**Word 一定能看见**（那是它的格式），问题只在用 python-docx 读数的人。
6. `ooxml/` 4 篇规范笔记、`tasks/` 12 篇任务指南，**一篇都没读**。
7. 15 个 mjs 仍然 **0 覆盖**。
8. `spreadsheets`（512 + 467 行）、`template-creator`（206 行）仍然 **0 覆盖**。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
