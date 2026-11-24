<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# Codex 26.1111 turn_suspension 挂起状态机 取证报告（Round 19）

**目标**：MSIX `OpenAI.Codex_26.1111.2228.0_x64__2p2nqsd0c76g0` codex.exe 364.8MB。
下潜 R13 §4 遗留清单最后一项——`turn_suspension` 挂起/恢复状态迁移。

## 1. 取证方法

对 codex.exe 364.8MB 做流式 `strings` 定向扫（按行号锚 `turn_suspension.rs:74` /
`:77` 反查 panic 文案 + event payload 字段）+ 全仓 grep 确认真空白。

## 2. 关键取证发现：root-turn 挂起四段顺序状态机

对照物 `codex-core/src/session/turn_suspension.rs`（cargo 路径在案，非 AWS SDK 所有物）。
两个事件锚：
- `event core\src\session\turn_suspension.rs:74` (source=`codex_core::session::turn_suspension`, 带 `thread_id`)
- `event core\src\session\turn_suspension.rs:77`

**两个前置校验（逐字 panic 文案）**：
```
accepted root turn suspension had no running task
accepted root turn suspension had no running turn
```

**挂起四段顺序（逐字错误前缀 + fallthrough 顺序）**：
```
1. flush before root turn suspension failed: <e>
2. (suspend write to rollout)
3. flush after root turn suspension failed: <e>
4. close suspended root turn writer failed: <e>
```

**abort 前置（挂起之前先判，逐字）**：
```
suspended turn task exited abnormally
suspended turn task did not stop gracefully; aborting it
```

**核心文案**：`suspend an unfinished root turn`（挂起成功）。

**复合 payload 关联字段**（rollout 复合 record）：`resume_metadata` / `trigger_turn` /
`SuspendTurnAndShutdown`（thread settings variant）。

## 3. 本仓三层分工（防冗余核查）

| 本仓模块 | 轴 | 关系 |
|---|---|---|
| `agent_resume_semantics.py`（550 行） | 工具执行恢复档（确认 payload / 继续 / 终止），step 级 | **不同层**：step 决策非回合级状态机 |
| `turn_phase_advance.py`（R15） | 回合进行中 phase 前进决策（CONTINUING/HALTING/ENDING_EARLY） | **不同轴**：phase 前进非挂起落盘 |
| `turn_stop_reason.py` | 回合终态 stop_reason 封闭集 | **不同轴**：终态非挂起中 |
| `agent_failure_vocabulary.py` | 错误 → 恢复族（retryable/terminal） | **不同轴** |

**真空白确认**：`grep turn_suspension|flush_before_root|flush_after_root|no_running_turn`
在 ai-service 全仓零命中 ⇒ Codex 独有的「回合级挂起状态机」在本仓无对应语义。

## 4. 复现交付

`apps/ai-service/app/core/turn_suspension.py` + `tests/test_turn_suspension.py`（13 用例）。

- `SuspensionInput`：7 字段（正在挂起 / 有 task / 有 turn / 四段失败 / task_exit 模式）。
- `SuspensionOutcome`：decision + evidence（逐字锚）+ source_line（:74/:77/none）。
- `SuspensionDecision`：四档封闭集（REJECT/ABORT/FAILED/SUSPENDED）。
- `evaluate_suspension()`：6 条优先级链（非挂起→无task→无turn→abort→四段失败→成功）。
- `suspension_step_order()`：四段固定顺序暴露（fail-closed，可机检）。

## 5. 一轴超越

对照把挂起四段顺序散在 `suspension.rs` 的运行时 fallthrough（遇到错误才判），且
**「没有可挂的东西」与「挂起的 task 异常退出」是两类不同前置**，对照靠 panic 文案隐式
区分、无显式判据。本仓让两者由 `SuspensionInput.has_running_task` / `.task_exit` 显式
驱动，结论可 diff、可单测、可在编排层挂前置，每档带逐字 codex 错误锚 + suspension.rs
行号。`suspension_step_order()` 把对照隐式 fallthrough 顺序显式化为可机检元组。

## 6. 诚实边界

- **未接生产路径**：`agent_loop_v2.py` / `session_store` 属核心在飞件（` M`），接入点留属主。
- `SuspensionOutcome.decision` 是**挂起语义对照真相源**，不替换 `TurnStatus`（生命周期轴）
  与 `agent_failure_vocabulary`（恢复族轴）。
- **优先级是推定序**：本模块假定「abort > 挂起四段失败 > 成功」，对照多条件同时命中时
  内部确切优先序未从二进制确证（suspension.rs panic 分支的 fallthrough 顺序是按错误文案
  语义反推，非逐字取证的优先表）。
- `resume_metadata` / `trigger_turn` 复合 payload 字段**取证未复现**（属 rollout 持久化层）。
- **异步恢复侧**（suspended → resume 的迁移细节）本轮未下潜；只覆盖挂起侧状态机。

## 7. 验证实数

- 13 pytest 全过（2 处反向变异：abort 不优先于 flush_before / task 校验不先于 turn 校验，
  均转红）。
- ruff 全绿（修 1 处 UP042：`str, Enum` → `StrEnum`；第 5 处 Rxx 风格统一）。
- 水印 2/2。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
