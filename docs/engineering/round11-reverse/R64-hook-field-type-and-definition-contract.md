<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R64 —— Hook 命令字段级类型契约（type / $ref / allOf / const / enum / default + definitions 值域）

> 续 R63。R63 钉死「字段叫什么」（26 个逐字字段名 + required 子集），R64 钉死「字段长什么样」（逐字段类型签名）与「决策值域长什么样」（`definitions` 里的 enum 与嵌套对象）。全部机器派生，零手敲字段名与值。

## 1. 本轮定位

R63 report §7 点名的第一开放轴就是「字段类型契约」。本轮不重扫 365MB PE，直接复用 R63 已从 `codex.exe` 26.1111.2228.0 内嵌 JSON Schema 逐字提取的 `schemas.json`（23 段合法 schema，`json.loads` + 三键校验收口），在其上做两层加工：

- **字段层**：把 `properties[f]` 的 JSON Schema 约束规范化为确定性签名串（`type=` / `ref=` / `allOf=` / `const=` / `enum=` / `default=`，任意类型记 `any`）。
- **定义层**：把 20 段 schema 里出现的 `definitions` 聚合（同名跨 schema 逐字节零冲突，机械自证），分离出 enum wire 类型、`NullableString` 与嵌套对象。

## 2. 取证与全量数据（现读）

源 `D:/DevEnv/Temp/r63/schemas.json`：

| 维度 | 读数 |
|---|---|
| schema 段 | 23（12 hook 家族；11 族双 input/output，`session-end` 仅 input） |
| 字段条目 | 170（23 段 `properties` 合计） |
| 属性键分布 | `type` 140 / `default` 57 / `$ref` 26 / `const` 13 / `enum` 12 / `description` 12 / `allOf` 11 / 任意类型 `true` 4 / `format` **0** |
| `$ref` 目标 | 9 个唯一名（全部解析到本段 `definitions`，无悬空引用） |
| `const` 值域 | 13 处 = 12 个 `hook_event_name`（Pre/PostToolUse、Pre/PostCompact、PermissionRequest、SessionStart/End、SubagentStart/Stop、UserPromptSubmit、Stop、Interrupt）+ `reason="other"` |
| `definitions` | 20 段带 definitions、26 条定义、12 个唯一名：enum 4 + `NullableString` 1 + 对象 7 |

enum 4 族（决策语义真相源）：

- `BlockDecisionWire` = `["block"]`
- `PreToolUseDecisionWire` = `["approve","block"]`
- `PreToolUsePermissionDecisionWire` = `["allow","deny","ask"]`
- `PermissionRequestBehaviorWire` = `["allow","deny"]`

对象 7 族：`PostToolUseHookSpecificOutputWire`、`PreToolUseHookSpecificOutputWire`、`PermissionRequestHookSpecificOutputWire`、`PermissionRequestDecisionWire`、`SessionStartHookSpecificOutputWire`、`SubagentStartHookSpecificOutputWire`、`UserPromptSubmitHookSpecificOutputWire`（逐字 properties + required 子集）。

## 3. 交付（2 模块 + 2 测试）

| 文件 | 封闭集 | 判据 | 行数 |
|---|---|---|---|
| `app/core/hook_field_type_contract.py` | 23 段 title → 170 个 `字段 → 类型签名` | `validate_hook_field_types(title, mapping)` 三层（title 存在 ∧ 字段集合相等 ∧ 逐字段签名相等）；`field_type_signature(title, field)` 取签名；`fields_with_signature_kind(title, prefix)` 反查（例 `const=` 命中 `hook_event_name`）；`is_/ensure_hook_field_type_schema` 守门 | 284 |
| `app/core/hook_definition_contract.py` | 4 enum + 1 `NullableString` + 7 对象 + `HOOK_DEFINITION_NAMES` 并集 | `validate_definition_enum`（值域逐字且**顺序敏感**）/ `validate_definition_object`（properties 逐字 + required 子集 + `required ⊆ fields`） | 100 |

+ `tests/test_hook_field_type_contract.py`（16 例）、`tests/test_hook_definition_contract.py`（18 例）。

生成器：`D:/DevEnv/Temp/r64/gen_r64.py`（`build_r64.py` 从 HEAD 面干净模块逐字前置溯源头）。import 块由生成器按 ruff isort 档机械排序，不用「生成后再 ruff --fix」兜。

## 4. 验证（全绿，现读）

- **34 passed**（两文件单跑，`python -m pytest`）。
- ruff：`All checks passed!`（生成器源头修，非事后自动修）。
- `py_compile` 4/4 rc=0。
- 水印：worktree 面 4/4 完整（0 残迹 / 0 载荷损坏 / 0 仅隐写）。
- **幂等**：二次 `build_r64.py` 后四文件 sha256 逐字节不变（4/4 IDEMPOTENT）。
- **反向变异**：把类型签名里的 `type=string` 篡改为 `type=integer` ⇒ 2 failed（`test_all_field_types_exact` / `test_anchor_permission_mode_enum`），恢复后 34 passed。

## 5. 与既有模块正交

R63 的三件（`hook_contract_schema` 字段名+required / `hook_event_kind` 家族形态 / `hook_field_name` 命名风格）与本轮两件不重叠：前者管「有哪几个字段、哪些必填、叫什么风格」，本轮管「每个字段的类型签名」与「definitions 的 enum/对象值域」。仓内 `hook_runtime` / `hook_event_ordering` / `hook_exit_contract` 管执行层，字段逐字零命中。

## 6. 诚实边界（写进账，不当成遗漏）

1. `description` 12 条（自由文本、含换行）**未纳入**类型签名——不影响 wire 语义，但承载字段语义，列为后续轴 A6。
2. `format` 在 23 段里**原生为 0 处**——不是没提，是原生没有。
3. `additionalProperties:false` 23 段共有，只在文档记录，不重复登记为表。
4. 字段名与 required 属 R63 层，本模块不重复。
5. 本轮只覆盖 hook 命令面；非 hook struct 的字段名/类型仍在 disasm 轴（A1）。

## 7. 后续开放轴

逐条编号清单（A1–A13，带优先级/入口/产出/验收）与「已分析 / 部分 / 未分析」覆盖账见同目录 `R64-codex-coverage-and-backlog.md`。本轮不重复抄表，避免两处数字各自漂移。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
