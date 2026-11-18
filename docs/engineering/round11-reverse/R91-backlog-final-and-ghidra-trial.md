<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R91 — A6 / A9 落地、A3 / A5 关掉、Ghidra 实测

这轮把 A1–A13 里最后四项能做的都做了，剩下的是两项"画掉"和一次重武器实测。

## A6 — description 只有 12 条，但其中一条揭出一条规则

23 段 schema 共 **170 个 property**，只有 **12 个带 `description`**，覆盖 **2 个字段**、**2 条文本**：

| 字段 | 份数 | 文本 |
| --- | --- | --- |
| `turn_id` | 10 | "Codex extension: expose the active turn id to internal turn-scoped hooks." |
| `reason` | 2 | "Claude requires `reason` when `decision` is `block`; we enforce that semantic rule during output parsing rather than in the JSON schema." |

第一条是 A6 预期的：一个扩展字段，说明重复进每个 turn-scoped 的 input 契约。

**第二条是这轮真正的产出。** 它用 schema 作者自己的话说清了一件事：契约里有一条**schema 表达不了的规则**——`decision == "block"` 时必须带 `reason`；而且这条规则是在**输出解析阶段**强制，不在 JSON Schema 里。

它同时解释了一个 R63 记下但没解释的形状：`subagent-stop.command.output` 与 `stop.command.output` 都声明了 `decision` 和 `reason`，而 `required: []`。按严格 schema 读法两者都可选；按真实契约，`decision=block` 缺 `reason` 是非法。这两读之间的差，正是这句说明在讲的东西。

## A9 — 57 个 default，只有两种类型

| 类型 | 数量 |
| --- | --- |
| `bool` | 20 |
| `null` | 37 |

**一个数组、对象、数字、字符串默认值都没有。** 这种窄度就是可复现的原因：只有当 `true`/`false`/`null` 三种值时，`apply_defaults` 不需要任何类型强制猜测。

37 个 null 还要再分两组：

- **11** 个属性**不声明 `type`**，只带 `"default": null`；
- **26** 个属性声明 **`"type": "string"`** 却带 `"default": null`。

后者是 schema 自身的**语义不一致**：类型说"字符串"，默认说"没有值"。这在 JSON Schema 里合法，在 Rust 侧对应 `Option<String>` 序列化成 `None`，schema 的 `type` 只是漏了 `"null"` 那一半。它被计数为 `NULL_ON_TYPED = 26`，**不判红**——恢复出来的数据是什么样就记什么样，把它改整齐等于造假。

`apply_defaults` 的语义：缺席且有默认 ⇒ 填默认值；存在 ⇒ 原样不动；schema 没给默认 ⇒ 一律不发明（缺席的 `agent_id` 还是缺席）。

## A3 — 209 个 tagged enum，205 个没有变体表

4,005 条 record run 里：

| 桶 | 数量 |
| --- | --- |
| 纯 snake_case（字段表） | 3,353 |
| "变体形"（全短、非 snake） | **31** |
| 混合 | 621 |

把那 31 条读出来就结束了这场讨论：它们是 **camelCase 字段表**——`threadId`/`afterCursor`、`inputText`/`inputImage`/`inputAudio`、`osPid`/`cpuPercent`/`rssKb`——不是变体名。

所以 run 空间里 **hook 侧之外一个枚举变体表都没有**。R87 定位的那 4 个（`approve`/`block`、`allow`/`deny` 及两个单变体）就是全部例外。

**为什么**：internally tagged enum 用 `match` 匹配，`match` 对字符串编译成**逐个变体的比较**——每个分支比较一个独立字面量，永远不会是连续数组。数组形状只在 serde derive 出 `VARIANTS` 式表的地方存在，而那恰好就是 `*DecisionWire` 这一族。

**209 个里 205 个没有变体表**，按读数关闭，不靠论证。

## A5 — `Message` 根本不在目录里

R77 目录里 `Message` 没有 arity（`arities=None`），长度为 17 的 9 条 run 全是无关结构的字段表（`version`/`dual_write`/…、`name`/`canonical_app_id`/…）。

所以 A5 不是"未确证"，而是**前提在目录里没有对应物**。`MESSAGE_IN_CATALOG = False`。

## Ghidra 实测：能读，但没有增量

按"重武器"的思路跑了一次 headless 导入：

| 读数 | 值 |
| --- | --- |
| 导入方式 | `analyzeHeadless … -import <exe> -noanalysis` |
| 结果 | **Import succeeded** |
| 耗时 | **285 秒**（4 分 45 秒） |
| 依赖解析 | 5 个系统 DLL 标 `not found in project`（预期，非失败） |

**它确实能打开这个 382 MB 的 PE。** 但要说清为什么本轮不继续：

`.pdata` 段 **13,668,352 B / 12 = 1,139,029 个 `RUNTIME_FUNCTION`**。也就是说**函数边界本来就是权威的、精确的、已经拿到的**（本链用的 1,139,013 条边界即出自此，差 16 条是末尾对齐截断）。Ghidra 在这种输入上不会比 `.pdata` 更准。

而字符串引用侧，我们已经全量扫过 **1,160,394 个 `lea` 站点 + 349,867 个 distinct target**，R88 用它否证了代码级字段表。Ghidra 的 xref 不会给出这批数据之外的东西。

Ghidra 唯一可能多给的是**类型恢复**，但它对无 DWARF/PDB 的 Rust 二进制基本无效——Rust 的 enum/struct layout 不落 RTTI，Ghidra 的推断在这里退化成"看到偏移就猜结构"。

所以这次的结论不是"Ghidra 不行"，而是**"Ghidra 可用、已实测导入成功、但在本对象上没有增量"**——这是个读数，不是推托。

## A12 升级：把 A6 的规则变成可执行

A12 原来只校验键集。A6 那句说明给了第三条可校验的东西：

```python
ViolationKind = Literal["unknown-schema", "unknown-field", "missing-required", "missing-dependent"]
```

`check_semantics()` 实现：在 `stop.command.output` / `subagent-stop.command.output` 里，`decision == "block"` 且缺 `reason` ⇒ `missing-dependent`。规则只作用于这两个 title（`pre-tool-use.command.output` 同样声明了 `decision`，但说明点名的只有两个 stop 输出，所以不扩散）。

这条规则的意义：**它不在 schema 里，是我们从 schema 的散文里读出来、再变成可测断言的**。这比再抄 100 个字段名更接近"抄尽"的本意。

## A1–A13 终态

| 项 | 终态 |
| --- | --- |
| A1 类型层 | **停**：唯一候选数据是切分残渣（`Standard` 被切坏成 `tandard`） |
| A2 残片 | **完成**：0 残片，30 = 23 顶层 + 7 嵌套子对象 |
| A3 变体表 | **否证**：205/209 无表 |
| A4 unit-variant | **部分**：单变体只到薄证据 |
| A5 `Message` | **前提不存在** |
| A6 description | **完成**：2 字段 / 2 文本 / 12 处 |
| A7 域账 | **完成**：8 域 / 987 结构 / arity 和 4,660 |
| A8 族差集 | **完成**：60 零 / 35 部分，最大 `ClientRequest`(187) |
| A9 default | **完成**：57 处全部，`apply_defaults` 可执行 |
| A10 app.asar | **判低价值** |
| A11 遥测面 | **完成**：8/8 存在 |
| A12 运行期校验 | **完成**：4 类违规，含 1 条 procedural 规则 |
| A13 漂移哨兵 | **完成**（R66） |

## 验证

| 项 | 结果 |
| --- | --- |
| A6 pytest | **10 passed** |
| A9 pytest | **11 passed** |
| A3/A5 pytest | **9 passed** |
| A12 pytest（升级后） | **18 passed** |
| ruff / mypy | 全绿 |

## 诚实边界

1. A6 的 "170 properties" 是键总数；带 description 的 12 个在其中，比例 7%。
2. A9 的 26 处 `type:string` + `default:null` 是原样记录的不一致，不是我们引入的错误。
3. A3 的 31 条"变体形"判定用的是"全短且非 snake"这一宽松规则，正因为宽松才扫到了 camel 字段表——这条规则的宽松是有意的，写进报告因为它解释了那 31 条到底是什么。
4. Ghidra 只做了**导入**实测（`-noanalysis`），**未做全量分析**。全量分析在这份 382 MB 输入上的耗时与收益本轮未测，也不宣称。
5. `Message` 不在目录，不代表二进制里没有 `Message`，只代表 R62 的 arity 断言里没有它——要推翻这条需要另一条取证链。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
