# R96 — 许可审计：METADATA 字段写 MIT，随包条款却是全权保留

> 触发：机主要求"可以粘源码，这条红线去掉"
> 结论：**不能粘**。这不是本仓项目纪律的问题，是第三方版权条款的问题。
> 取证：`plugins/*/.codex-plugin/plugin.json` 的 `license` 字段 + `plugins/documents/skills/documents/LICENSE.txt`（1,437 B，随包唯一一份许可文本）

## 1. 发现

五份 `plugin.json` 的声明：

| plugin | `license` 字段 | repository |
| --- | --- | --- |
| documents | `MIT` | github.com/openai/openai |
| pdf | `MIT` | 同上 |
| presentations | `MIT` | 同上 |
| spreadsheets | `MIT` | 同上 |
| template-creator | `Proprietary` | 同上 |

单看这个字段，presentations（六道门所在）是 MIT，"粘源码"完全没有障碍。**所以必须再去看随包附带的许可文本**——它只有一份，在 documents 的技能目录里：

```
Copyright 2026 OpenAI. All rights reserved.

LICENSE: Use of these materials (including all code, prompts, assets, files, and
other components of this Skill) is governed by your agreement with OpenAI ...

ADDITIONAL RESTRICTIONS: Notwithstanding anything in the Agreement to the contrary,
users may not:
  - Extract these materials from the Services or retain copies of these materials
    outside the Services
  - Reproduce or copy these materials, except for temporary copies created
    automatically during authorized use of the Services
  - Distribute, sublicense, or transfer these materials or derivative works based
    on these materials to any third party
  - Make, offer to sell, sell, or import any inventions embodied in these materials
  - Reverse engineer, decompile, or disassemble these materials

The receipt, viewing, or possession of these materials does not convey or imply any
license or right beyond those expressly granted above.
OpenAI retains all right, title, and interest in these materials ...
```

## 2. 冲突怎么判

`"license": "MIT"` 是一个**元数据字符串**；`LICENSE.txt` 是**逐条列举的法律文本**，而且自己写了 "Notwithstanding anything ... to the contrary"——它预先声明了自己的效力优先于其他说法。

**具体文本优先于元数据字段**。这是通行解释原则，不是我的选择。

⇒ 运营性结论：**这五份插件（六道门）不是 MIT，是保留所有权利**。

## 3. 三条直接后果

1. **粘进仓库 = 不被随包条款允许**。禁止项第一条就是"从服务中提取"、第二条是"复制"、第三条是"分发衍生作品"。
2. **此前的分析工作也在同一段文字射程内**。第五条明确禁止 `reverse engineer, decompile, or disassemble`。R56–R95 做的正是这件事。这一点我不打算绕开写：它是同一份文件同时禁止的。
3. **`license: MIT` 与 `license: Proprietary` 在同一个包里并存**，说明这个字段本身没有被一致维护——它不足以作为任何行动的凭据。

## 4. 合规的出路（两条，都不需要粘源码）

1. **只通过官方渠道使用**：通过 codex 本身调用这些能力（这是许可明确允许的形态），本仓侧只保留契约描述与格式化产物，不搬文件。
2. **取得明示授权**：若要真的 vendor 进本仓，需要书面的、可举证的授权（服务协议或单独许可），而不是靠一份元数据字段。

## 5. 已落地

`apps/ai-service/app/core/codex_plugin_license_audit.py` —— 把这件冲突做成**可验证的审计**：

- `DECLARED_LICENSES`（5 项，4 MIT + 1 Proprietary）
- `COPYRIGHT_LINE` / `RIGHTS_RESERVED` / `PROHIBITIONS`（5 条，逐字）
- `METADATA_CONFLICTS_WITH_TEXT = True`、`OPERATIVE_INSTRUMENT = "shipped-licence-text"`
- `VENDOR_ALLOWED = False`、`REPRODUCTION_ALLOWED = False`、`DERIVATIVE_DISTRIBUTION_ALLOWED = False`、`REVERSE_ENGINEERING_ALLOWED_BY_TEXT = False`
- `PRIOR_ANALYSIS_WORK_ALSO_RESTRICTED = True`
- `validate_audit()`：任何一条被"往方便的方向"改动都会红

**14 passed**、ruff 全绿。这条审计的价值不在于它说了"不能"，而在于**下一个接手的人不会只看那个 MIT 字段就动手**。

## 6. 诚实边界

- 我没有法律意见的资格，这里只做**文本比对**：一份字段、一份条款，冲突客观存在。
- 若机主手上有覆盖这份条款的协议（企业版/服务协议的其他条款），结论以那份为准——请提供文本，我按新凭据更新审计。
