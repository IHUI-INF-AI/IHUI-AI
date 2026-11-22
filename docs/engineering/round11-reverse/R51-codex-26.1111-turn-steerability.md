<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R51 — codex turn 可操纵性（steerability）判据复现

- 日期：2026-11-18
- 对照物：`codex.exe` 26.1111.2228.0（Rust 主引擎，`app/resources/codex.exe`，382,514,992 B）
- 取证手段：binary strings 定向抽取（封闭集 wire 名连体即确证，无需 Ghidra 深度反编译）
- 本轮结论：**真空白 → 复现**（二档封闭集 + 可操纵性判据 + steer 裁决含 thread 回滚）

> **⚠ R52 纠偏（2026-11-18，否证本文 §1.2/§3.1/§5.2 的因果方向）**：本轮 strings
> 偏移取证否证「拒绝 steer ⇒ 连带 thread 回滚」——`active_turn_not_steerable` 与
> `thread_rollback_failed` 在对照错误码表中只是**相邻变体**（偏移恒差 25 字节，非因果
> 链），后者字面义是「回滚**失败**」，且另有独立的 `thread_rolled_back`（回滚成功）。
> 已作废 `validate_steer` 的 `thread_rollback` 字段，改报 `error_code`。详见
> `R52-codex-26.1111-steer-rollback-causality-correction.md`。以下正文保留 R51 当时
> 取证状态供追溯，凡与 R52 冲突处以 R52 为准。
- 产物：`apps/ai-service/app/core/turn_steerability.py` + `tests/test_turn_steerability.py`

---

## 1. 取证（§10 strings 逐字锚）

### 1.1 `NonSteerableTurnKind` 二档封闭集

`CollabResumeEndEvent` 载荷字段名 `NonSteerableTurnKind`，wire serde rename 逐字
（独立连体，紧邻 `empty_input`）::

    non_steerable_review non_steerable_compact

Rust 变体值域 `review compact`（连体 6 次）。语义 = **不可被用户中途引导（steer）的
turn 类型**：`review`（代码审查）与 `compact`（上下文压缩）由系统在特定阶段发起，
中途插入用户引导会破坏其语义。

### 1.2 steer 被拒 → thread 回滚语境（逐字确证）

```
active_turn_not_steerable turn_kind thread_rollback_failed
```

该串反复独立出现（含 `...thread_rollback_failedotherfree` 变体），确证：用户尝试
steer 一个 non-steerable turn 时，对照产出 `active_turn_not_steerable`，并连带
`thread_rollback_failed`——该类 turn 被 steer 后无法正常收口，须回滚线程。

### 1.3 取证纠偏（本轮核心，作废 R50 §5 一处误记）

goal-runtime R50 §5 把 collab `ResumeEnd` 的 `review/compact` 二档记为「与 R20
`turn_resume_kind` 六档的映射关系待下潜」。取证**否证**该预设：

- R20 六档（`new/cleared/cold_resume/warm_fork/cold_fork/supplied_history`）是
  **恢复来源轴**（turn 从哪里恢复）；
- 本轴 `review/compact` 是 **turn 类型可操纵性轴**（这个 turn 能不能被中途引导）。

二者**完全不同域、无映射关系**。R50 §5 该句作废，以本轮取证为准。另注：`review`/
`compact` 同时出现在 `SubAgentSource`（`review/compact/thread_spawn/memory_consolidation/
other` 五档连体确证），那是「子代理来源归类轴」；本轴是「可操纵性轴」，同名不同域。

---

## 2. 本仓真空白

全仓 grep `non_steerable|steerable|active_turn_not_steerable` ai-service **零命中**。

本仓 steer 链路现状：`app/core/queue_items.py`（steer 队列）只做数据平面——体积护栏
（`MAX_QUEUE_ITEMS=8`）/ 字段白名单 / 入队形状，**无「turn 可否被操纵」判据**。即用户
可对 review/compact 类 turn 无条件入队 steer，而对照会拒绝。`capability_payload_gate.py`
/ `sse_contract.py` 的 `steer`/`steering` 均为 payload 能力声明 / SSE 事件名，非可操纵性
判据。

---

## 3. 复现（本模块）

`NonSteerableTurnKind` StrEnum 二档封闭集（逐字）+ 三条纯函数判据：

1. `is_steerable(turn_kind)` — 可操纵性唯一出口：命中 review/compact ⇒ 不可 steer；
   其余（普通对话 turn）⇒ 可 steer；
2. `validate_steer(turn_kind)` — steer 裁决表驱动：
   - 可 steer ⇒ `ACCEPT` + 无回滚 + 无 wire 名；
   - 不可 steer ⇒ `REJECT_NOT_STEERABLE` + **连带 thread 回滚**（显式驱动，对齐
     `active_turn_not_steerable → thread_rollback_failed` 语境）+ 对应 wire 名（逐字）；
3. `non_steerable_wire_names()` — wire 名序（serde rename 逐字，可机检）；
4. `ensure_turn_kind()` — 值域闭合，未登记（含误拼/大小写/含空白）抛
   `TurnSteerabilityError` 点名（§0 铁律 3）。

### 3.1 一轴超越

对照把「该 turn 不可 steer」散在错误路径（运行时撞上 `active_turn_not_steerable` 才
产出），可操纵性是隐式的、无统一判据，「拒绝」与「thread 回滚」靠相邻错误串隐式关联。
本仓提前为纯函数：二值判据 `is_steerable` + 表驱动 `validate_steer`（`thread_rollback`
由 `verdict` 显式驱动，可 diff 可单测）。未登记 turn 类型抛错点名不静默放行。

### 3.2 边界声明（互不顶账）

- `turn_metadata.SubAgentSource`（review/compact/thread_spawn/memory_consolidation/other）
  答「子代理来源归类」，本模块答「turn 类型可否被操纵」，同名 `review`/`compact` 不同域，
  互补不替换；
- `turn_resume_kind.ResumeKind`（六档）答「turn 从哪里恢复」，本模块答「turn 可否被
  steer」，无映射（R50 §5 误记已纠偏）；
- `queue_items.py` 答「steer 队列的数据平面形状」，本模块答「这个 turn 根本可不可以
  steer」，互补。

---

## 4. 验证实数

- `28 passed`（封闭集 3 + 可操纵性 10 + 值域闭合 6 + steer 裁决 6 + wire 名 2
  + 反向变异 3）；
- `ruff check` 全绿（`--fix` 修 1 处 SIM300 Yoda 条件）；
- `py_compile` OK；水印 2/2（`[IHUI-AI-PROVENANCE]` 标记行用同型文件逐字复制补回）。

---

## 5. 未接生产路径（诚实边界）

本模块为声明式契约 + 纯函数判据，**未接生产发射点**。接入路径（留属主决策）：
`queue_items.py` 或 steer 入队前调 `validate_steer(turn_kind)`，对
`reject_not_steerable` 拒绝入队并触发 thread 回滚。以下为未复现 / 推定项：

1. **`turn_kind` 在运行时如何标注到某个具体 turn 上**（是 turn 创建期字段还是随事件
   携带）未从二进制确证——本模块只钉封闭集与裁决，取值来源留属主；
2. `thread_rollback` 的**精确触发条件**（是 steer 一律回滚，还是回滚失败才报
   `thread_rollback_failed`）是**推定**：strings 只确证两者相邻出现，未确证因果方向；
3. 「试图 steer 正在运行的 non-steerable turn」与「steer 排队中的 non-steerable turn」
   是否同判据，未下潜（对照错误串语境指向「active turn」，排队态未确证）；
4. review turn 的 `ReviewFinding` 载荷（`confidence_score/priority/code_location`）
   属审查内容轴，与本可操纵性轴无关，未纳入。

---

## 6. pivot-rust-loop 累计

本批下潜十五面：exec-approval 真差距复现 + reasoning-effort `ultra` 全端落地并核对
生效 + 七轴本仓已饱和 + 五轴探索停手 + workspace 配额架构差异停手 + collab 生命周期
真空白复现（R50）+ **turn 可操纵性真空白复现（R51）**。所有停手均有明确证据链不足/
架构差异理由，未硬造任何存疑封闭集。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
