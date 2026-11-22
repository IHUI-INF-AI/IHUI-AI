<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R68 · `&'static str` 胖指针：字段数组可整表读出，`ConfigRequirementsToml` 46 字段回收

> 对象：`codex.exe`（OpenAI Codex 26.1111.2228.0，Rust PE，382,514,992 B）
> 前序：R65 交 44 结构 / 455 字段名（文本侧取证），R66 交漂移哨兵，R67 把 3 枚结构固化为「归属前沿」并记 12 条已否证判据。
> 本轮把 R67 判据 10/11 的解读纠正一次，并据此**从记录数组整表读出字段**：先对 R65 的 44 结构做 44/44 自证，再回收 R67 前沿里的一枚。

## 1. 结论先行

1. **Rust `&'static str` 是胖指针**：`(ptr, len)` 两字，**16 字节**。serde 的 `FIELDS` 是 `&'static [&'static str]`，所以在这个二进制里它**不是 8 字节指针表，而是连续 16 字节 `(ptr,len)` 记录数组**。
2. 按 8 字节对齐扫 `.rdata`（`0x1517d7000` 起，74,454,016 B）得 **15,234 条**「记录 run」（连续有效字符串记录的最长串）。
3. **自证**：R65 的 44 个结构，逐个用「长度 == arity 且内容 == 字段表」的记录 run 去校验 → **44 / 44 精确命中，0 缺**。这比 R67 的「后缀字典切分」（30/41 ≈ 0.732）从**启发式**升级为**可整表校验的判据**。
4. **回收**：`ConfigRequirementsToml`（arity 46）的数组在 `0x151cc6138`，长 **48**；前 46 条即该结构字段（`config_server` … `additional_developer_instructions`）；尾部两条 `guardian_policy_config` / `guardian_extra_policy` 是**邻居的 2 字段表**——同一对也收尾于 `0x151cc6e48` 那条 32 项数组，arity 46 决定切分。
5. **仍是前沿**：`ThreadStartParams`(27) / `TurnStartParams`(28) **没有 arity 尺寸的数组**。全表 27 项数组只有 2 条（agent 操作码 `spawn_agent/send_input/...` 一类）、28 项只有 3 条（含 orchestrator 错误码与序数词），都不是字段表。它们的尾部 9 / 23 名靠 `lea` 认证（R68 已复核），**头部 18 / 5 名仍缺**。

## 2. 判据纠正：R67 判据 10/11 说错了什么

- R67 判据 10 观测到「模板区 16 字节 `(ptr,len)` 记录的 `len` 逐字节等于模板字面量长度」（2,661 模板里 1,323 处，0 处不一致），据此判为「类型名 `&str` 描述符、非字段区边界」。
- R68 的读数：这些记录是**字符串本体描述符**（`ptr` 指向 `.rdata` 里的字面量、`len` 是字面量长度），而 serde 的 `FIELDS` 本身就是这样的记录数组。所以：
  - 「拿 `len` 当字段区长度」仍然否证（判据 10 的原命题成立）；
  - 「记录数组 = 字段表」不成立——R68 用 44/44 推翻了这一层。
- 处理：`FALSIFIED_METHODS` 里的 `pair-record-end` 条目保留，`why_falsified` 补一句「R68 narrowed: refutes len-as-length only, not array-as-record-run」，把否证范围写准，不删历史。

## 3. `ConfigRequirementsToml` 回收证据链

| 环节 | 读数 |
| --- | --- |
| 字段文本体（R67） | `0x151cb8768..0x151cb892b`，21 名，`config_server` 起、`guardian_extra_policy` 收 |
| 认证 `lea` 站点（R68 复核） | 23 site / 21 distinct，全部落在该体内（编译器认证的字面量起点） |
| 记录数组 | `0x151cc6138`，长 **48**，顺序与字段文本体**逐名同序** |
| 邻居判别 | 尾部 2 条（guardian 对）同时是 `0x151cc6e48`（长 **34**）的尾部 ⇒ 属邻居 2 字段表 |
| 切分依据 | arity 46：`4afba5b3a86` 前的 R62 目录给 `ConfigRequirementsToml → 46` |
| 结果 | 前 46 条 = `config_server` … `additional_developer_instructions` |

取前 46 而非前 48 是**arity 决定**、非人为挑数：48 条里末 2 条在另一张表上同样收尾，说明那是一份可复用的 2 字段邻居表（`guardian_pair`），被两个数组共享。

## 4. 交付

| 文件 | 行 | 内容 |
| --- | --- | --- |
| `apps/ai-service/app/core/struct_fields_fat_pointer.py` | 153 | 46 字段常量 + 数组/邻居证据 + `FatPointerContractError` + `validate_fat_pointer_contract` / `ensure_fat_pointer_contract` / `config_requirements_toml_fields` / `excluded_array_entries` |
| `apps/ai-service/tests/test_struct_fields_fat_pointer.py` | 96 | 10 例：arity vs 数组长（46 vs 48）、端点固定、邻居排除、已知字段在册、去重、步长/自证数、校验器正/负向（错 arity、邻居泄漏、截断） |
| `apps/ai-service/app/core/struct_attribution_frontier.py` | 247 | 移除 `ConfigRequirementsToml` 前沿项 → `RESOLVED_BY_R68`；`pair-record-end` 否证范围收窄；`MEASUREMENTS` 增 `record_runs_scanned=15234` / `resolved_by_r68=1`；`validate_frontier` 新增「已解决又挂前沿」判红 |
| `apps/ai-service/tests/test_struct_attribution_frontier.py` | — | `EXPECTED_ARITY` 收 2 项 + `EXPECTED_RESOLVED`，新增 2 例（已解决项不在前沿、46 名与 R68 模块同数） |

所有字段名由生成器 `D:/DevEnv/Temp/r68/gen_r68.py` 从二进制**机器读取**后写出，零手敲。

## 5. 验证（现读）

- `pytest tests/test_struct_attribution_frontier.py tests/test_struct_fields_fat_pointer.py -q` → **21 passed**
- `pytest tests/test_struct_fields_fat_pointer.py -q`（单跑）→ **10 passed**
- `ruff check` 四文件 → **All checks passed**（三处导入项在生成器源头修正：`collections.abc.Mapping`、测试未用导入、`python` 断言顺序）
- `node scripts/watermark.mjs verify` 四文件 → 覆盖 **4/4**，残迹 0 / 损坏 0 / 仅隐写 0
- 反向变异（在生成器/契约层）：错 arity → 1 红、邻居泄漏 → 1 红、截断 → 1 红，均已固化为测试

## 6. 边界（诚实面）

- **未解**：`ThreadStartParams`(27) / `TurnStartParams`(28) 的头部 18 / 5 名。两条事实：① 全表无 arity 尺寸数组；② 池切片（distinct `lea` target 当字面量起点）能切出精确名，但那些池是**跨多结构共享**（Thread 池 749 B / 74 target → 44 名，Turn 池 5,223 B / 330 target → 108 名），尾 N 取法会把邻居字段带进来，故不入契约。
- **未做**：Ghidra 12.1.4（`D:\DevEnv\ghidra_12.1.4`）定点反编译仍未启动——本轮反汇编级取证已够定性，留作下轮手段。
- **口径**：arity 目录 1,922 条里 1,921 条「存在某条等长数组」，但等长 ≠ 同身份（同长多表），本模块**不**用等长做识别，只用「内容 == R65 真值」或「arity + 前缀 + 邻居判别」两种可校验判据。

## 7. 下一步（按价值排序）

1. `ThreadStartParams` / `TurnStartParams`：用 `Serialize` impl 的 `lea` 序列（同函数内 target 首尾相接）做**顺序拼接**，再与 arity 27/28 求交；失败则上 Ghidra 定点反编译 `Serialize` 桩。
2. 把「记录数组」判据推广为**批量回收器**：对 R62 目录里 arity 已知、且其字段文本体已由 `lea` 认证的结构，用「内容与文本体同序」做第二重校验，可望把 44 扩到上百。
3. 字段类型契约：R64 已交 hook 侧 `type/format/enum`；非 hook 侧 `type` 仍在 `.rdata` 的类型名池里，需按同一记录数组思路定位。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
