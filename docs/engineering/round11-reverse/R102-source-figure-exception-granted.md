<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R102 — 源图豁免真的被打开了

> R101 只知道"要一个不可编辑披露"，不知道它住在哪。这轮把它攻下来了：
> `exception` 从 `false` 变成 `true`，并且把措辞规则、作用域、分隔符三件事全部测清。

## 1. 一句话结论

**披露不是图片的元数据，是幻灯片上的文字。** 图片名写成 `Source figure (non-editable)`，
或 `descr` 属性写成同样的句子，全部无效；只有页面上出现一段文字才生效。

## 2. 载体：三种猜法，只有一种成立

| 载体 | 结果 |
| --- | --- |
| 文本框（页面上）写 `Source figure, non-editable` | **rc=0, exception=true** |
| 图片 `cNvPr name="Source figure (non-editable)"` | rc=1, exception=false |
| 图片 `cNvPr descr="Non-editable source figure"` | rc=1, exception=false |
| 三者全加 | rc=0, exception=true（但起作用的是那段文本） |

这条很重要：**把声明塞进图片属性，门看不见。** 它读的是页面的文字层。

## 3. 措辞：两个半边都要有

单独测每个半边：

| 文本 | 结果 |
| --- | --- |
| `Source figure` | ✗ 失败 |
| `non-editable` | ✗ 失败 |
| `Source figure, non-editable` | ✓ 通过 |
| `Source figure non-editable`（无逗号） | ✓ 通过 |
| `SOURCE FIGURE, NON-EDITABLE`（全大写） | ✓ 通过 |
| `non-editable source figure`（倒序） | ✓ 通过 |
| `The source figure is non-editable` | ✓ 通过 |
| `Source figure, noneditable`（无连字符） | ✓ 通过 |
| `Source figure, non editable`（空格分开） | ✓ 通过 |
| `Source figure, not editable` | ✓ 通过 |
| `Source figure, non_editable`（下划线） | ✗ 失败 |

⇒ **规则**：必须同时含 `source figure` **和** 下列任一拼法：
`non-editable` / `noneditable` / `non editable` / `not editable`。

**下划线不算分隔符**——`non_editable` 通不过。这一条最能说明它是按"词"匹配的，不是粗暴子串：
连字符、空格、"什么都不加"都算把两个词连成一体，下划线则让它变成一个陌生词。

## 4. 作用域：整页，不是单段

把两个半边拆到**两个不同的形状**里：

```
shape A: "Source figure"
shape B: "non-editable"
→ rc=0, exception=true
```

⇒ 匹配跑在**整页拼接后的文本**上，不是逐段落判。

而把 `non-editable` 塞进标题、`Source figure` 放进正文，也能通过：

```
标题: "Quarterly Review non-editable"
正文: "Source figure"
→ rc=0, exception=true
```

反过来的组合（标题只有 `non-editable`、正文什么都没）就失败——**因为缺 `source figure` 这一半**，不是因为位置。

## 5. 三个条件现在全部可达

```
exception 成立 =
    页码 ∈ --expected-chart-slides
  ∧ 该页有 raster picture
  ∧ 整页文本同时含 "source figure" 与 non-editable 变体
```

三条缺一不可，每条都单独测过。

## 6. 落成

`apps/ai-service/app/core/codex_source_figure_exception.py`：

- `DISCLOSURE_CARRIER = "slide-text"`、`PICTURE_NAME_WORKS = False`、`PICTURE_DESCRIPTION_WORKS = False`
- `SOURCE_HALF = "source figure"` + `NONEDITABLE_SPELLINGS`（4 种）
- `ACCEPTED_DISCLOSURE_PHRASES`（7 条实测通过）、`REJECTED_DISCLOSURE_PHRASES`（4 条实测失败）
- `slide_has_disclosure(text)`：实现真实判定
- `disclosure_from_shapes(texts)`：跨形状拼接
- `EXCEPTION_GRANTED_IN_PROBES = True`、`EXCEPTION_GRANTED_EXIT_CODE = 0`

**22 passed**、ruff 全绿、水印 2/2。

模块里的断言是**双向的**：7 条通过的在 `validate` 里必须真的通过，4 条失败的在 `validate` 里必须真的失败。哪一边写反，构造时当场抛错。

## 7. 诚实边界

1. 我**没有**穷举所有可能的措辞。7 条通过 + 4 条失败覆盖的是"两个半边 + 分隔符"这个维度，
   **别的词**（比如 `read-only`、`flat image`）有没有效，没测。
2. 只测了英文。中文、其他语言有没有等效写法，没测。
3. 匹配是否还有别的隐藏条件（比如必须靠近图片、必须有特定字号），没测——我的文本放在页面底部也过了，
   说明至少位置不敏感。
4. `--receipt` 的 enforcement 目录仍未找到。

## 8. 合规

deck 与 PNG 全自写；判定全部来自执行输出与退出码。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
