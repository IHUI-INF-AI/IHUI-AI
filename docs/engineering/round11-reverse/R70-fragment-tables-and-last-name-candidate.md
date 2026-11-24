<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R70 · 分片表实测：顺序仍不可得，Turn 末名候选 `cwd` 只登记不并入

> 对象：`codex.exe`（OpenAI Codex 26.1111.2228.0，Rust PE）
> 前序：R69 给出 Turn 27/28 的**字段集合**（visitor 键分支）与 Thread 的 43 名混合集合，并把三条路线否证；R69 §7 的第 1 条（按 `Argument` 表重扫）与第 3 条（补 Turn 缺 1 名）是本轮目标。

## 1. 结论先行

1. **模糊内容匹配找到了真表，但都无结构边界**：允许 1–3 条不可解析记录间隙后，全镜像出现 2 张**跨结构连排**的 `(ptr,len)` 分片表：
   - `0x151b43410`，**18 项**，其中 **9 项** 是 Turn 已知名；
   - `0x151c02270`，**8 项**（`threadId`/`turnId`/`approvalsReviewer`/`environments`/`model`/`effort`/`summary`/`serviceTier`）。
   两张表都在多个结构之间连排，**没有 arity 边**，因此**顺序依旧不可得**。新否证：`fragment-table-no-boundary`。
2. **`cwd` 是 Turn 缺的那 1 名的最强候选，但证据不足**：它出现在 18 项表内（同一张表里还并排着 `sandbox`、`instructionSources`、`reasoningEffort`、`activePermissionProfile`、`initialTurnsPage` 等**非 Turn 名**）。引用面复查给出 `cwd` 2 个引用函数、**不含任何 Turn worker**；但同一复查对 4 个表内名字返回 **0 处独立出现**，说明该复查的"字面量边界"口径在连排串上失效——所以**不据此否定，也不据此并入**。
   - 处理：模块新增 `TURN_LAST_NAME_CANDIDATE = 'cwd'` 与 `TURN_LAST_NAME_VERIFIED = False`，测试钉住"候选不得混进键集合"。
3. **arity 缺口仍是 1**：`TURN_ARITY_GAP` 保持 1，不因候选出现而改写——这是本轮唯一没有被压掉的数字。

## 2. 18 项分片表逐项（`0x151b43410`）

| # | 记录地址 | 名字 | 归属标记 |
| --- | --- | --- | --- |
| 1 | `0x151b43410` | `thread` | — |
| 2 | `0x151b43420` | `model` | TURN |
| 3 | `0x151b43430` | `modelProvider` | TURN |
| 4 | `0x151b43440` | `serviceTier` | TURN |
| 5 | `0x151b43450` | `disabledPluginIds` | TURN |
| 6 | `0x151b43460` | `cwd` | **候选** |
| 7 | `0x151b43470` | `runtimeWorkspaceRoots` | TURN |
| 8 | `0x151b43480` | `instructionSources` | — |
| 9 | `0x151b43490` | `approvalPolicy` | TURN |
| 10 | `0x151b434a0` | `approvalsReviewer` | TURN |
| 11 | `0x151b434b0` | `sandbox` | — |
| 12 | `0x151b434c0` | `activePermissionProfile` | — |
| 13 | `0x151b434d0` | `reasoningEffort` | — |
| 14 | `0x151b434e0` | `collaborationMode` | TURN |
| 15 | `0x151b434f0` | `multiAgentMode` | TURN |
| 16 | `0x151b43500` | `initialTurnsPage` | — |
| 17 | `0x151b43510` | `turnsBackwardsCursor` | — |
| 18 | `0x151b43520` | `itemsBackwardsCursor` | — |

注意该表紧贴池 A（字符串区结束于 `0x151b4340d`），说明"池 + 记录表"是同一块只读数据的两种视图，但**表的起点与终点都不与任何 arity 对齐**。

## 3. 8 项分片表（`0x151c02270`）

`threadId`(TURN) → `turnId` → `approvalsReviewer`(TURN) → `environments`(TURN) → `model`(TURN) → `effort`(TURN) → `summary`(TURN) → `serviceTier`(TURN)。

8 项里 6 项是 Turn 名，夹杂 `turnId`（属 Turn 家族但不属 TurnStartParams 键集）。同样是跨结构连排。

## 4. 交付（本轮改 R69 模块，不新建模块）

| 文件 | 变更 |
| --- | --- |
| `apps/ai-service/app/core/struct_visitor_key_evidence.py` | `MEASUREMENTS` 增 3 读数（`fragment_tables_found=2`、`largest_fragment=18`、`largest_fragment_turn_hits=9`）；`FALSIFIED_AFTER_R68` 增第 4 条 `fragment-table-no-boundary`；新增 `TURN_LAST_NAME_CANDIDATE='cwd'`（`TURN_LAST_NAME_VERIFIED=False`） |
| `apps/ai-service/tests/test_struct_visitor_key_evidence.py` | 否证清单断言收 4 条；新增 1 例「候选未验证且不得混进键集合」→ **10 passed** |
| `docs/engineering/round11-reverse/R70-fragment-tables-and-last-name-candidate.md` | 本报告 |

## 5. 验证（现读）

- `pytest tests/test_struct_visitor_key_evidence.py -q` → **10 passed**
- `ruff check` 两文件 → **All checks passed**（生成器源头改，未手改产物）
- 水印：模块 / 测试 / 报告三件重新注入并 `verify`

## 6. 边界（诚实面）

- **顺序仍未定**：两张分片表证明"表存在"，但同时证明"表无 arity 边"，顺序声明继续为零。
- **`cwd` 未并入**：引用复查口径在连排串上失效（4 个名字 0 处独立出现），本轮不据此判定归属。
- **Thread 仍不可分**：R69 的 43 名混合集合未动。

## 7. 下一步（唯一能定序的路径）

1. **线性反汇编 `Debug` impl**：`DebugStruct::field` 的 `lea rdx, [name]` + `call` 序列天然是声明顺序，这是**唯一**不依赖表边界的定序法（本镜像 `lea` 站点与 pdata 函数表已备好）。
2. **Ghidra 定点反编译**（`D:\DevEnv\ghidra_12.1.4` 已装、REA 6.4.0 已验证）：与上条互为验证。
3. `cwd` 归属：用 `next_key` 的 `jmp` 跳转表反查，而非字符串引用面。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
