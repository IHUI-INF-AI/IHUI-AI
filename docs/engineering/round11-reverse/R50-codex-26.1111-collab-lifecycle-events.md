<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R50 — codex 协同（collab）多智能体会话生命周期事件封闭集复现

- 日期：2026-11-18
- 对照物：`codex.exe` 26.1111.2228.0（Rust 主引擎，`app/resources/codex.exe`，382,514,992 B）
- 取证手段：binary strings 定向抽取（同前轮纪律：封闭集 wire 名连体即确证，无需 Ghidra 深度反编译）
- 本轮结论：**真空白 → 复现**（十事件封闭集 + wire 名逐字 + 阶段序判据）
- 产物：`apps/ai-service/app/core/collab_lifecycle_event.py` + `tests/test_collab_lifecycle_event.py`

---

## 1. 取证（§10 strings 逐字锚）

### 1.1 wire 事件封闭集（五组 × begin/end，各 7 次连体命中）

EventMsg 大块连体一次拿到完整十事件（对照物协议层），serde rename 逐字：

```
collab_agent_spawn_begin        collab_agent_spawn_end
collab_agent_interaction_begin  collab_agent_interaction_end
collab_waiting_begin            collab_waiting_end
collab_close_begin              collab_close_end
collab_resume_begin             collab_resume_end
```

Rust 变体名（`CollabAgentSpawnBeginEvent` / `CollabWaitingBeginEvent` /
`CollabCloseBeginEvent` / `CollabResumeBeginEvent` …）独立出现，与 wire 名配对确证。
每个 wire 名在 strings 中**独立连体 7 次**（`collab_close_end` 8 次）——封闭集稳定。

### 1.2 载荷字段（strings 确证部分，未确证不写入模块）

| 事件 | 确证字段 |
|---|---|
| `CollabAgentSpawnEndEvent` | `new_thread_id` `new_agent_nickname` `new_agent_role` `handoff_id` |
| `CollabAgentInteractionBeginEvent` | `started_at_ms` |
| `CollabWaitingBeginEvent` | `receiver_thread_ids` `receiver_agents` `transparent_background` |
| `CollabWaitingEndEvent` | `agent_statuses` `statuses` |
| `CollabCloseEndEvent` | `sender_thread_id` `receiver_thread_id` `receiver_agent_nickname` `receiver_agent_role` |
| `CollabResumeEndEvent` | `review` `compact`（resume kind 二档） |

**取证纠偏（防后人踩，本轮核心）**——goal-runtime R48 线索把本轴记为「collab_agent
六事件」，实为**十事件**：`CollabWaiting`（等待层）与 `CollabResume`（恢复层）两组在前轮
grep 漏记。本封闭集补全为五组 × begin/end。另 `WaitingBegin` 尾部 `failure`/
`input_images`/`generation_id` 属相邻图像生成语境（同块出现），非协同生命周期核心载荷，
本模块不纳入防语义错配。

---

## 2. 本仓真空白

全仓 grep `collab_interaction|collab_waiting|collab_close|collab_resume` ai-service
**零命中**。本仓现状：

- `app/core/turn_metadata.py:297`：`thread_spawn → "collab_spawn"` 仅一个 header 标签；
- `app/core/sse_contract.py:337-339`：`subagent_spawn/progress/end` 单层子代理 SSE
  契约，**无 begin/end 配对、无 waiting/close/resume 阶段**。

即本仓对「协同会话生命周期」只有 spawn 单点，缺五组配对的封闭集与阶段序判据。

---

## 3. 复现（本模块）

`CollabLifecycleEvent` StrEnum 十事件封闭集（逐字对照）+ 三条纯函数判据：

1. `event_wire_name()` — 事件 → wire 名（serde rename 逐字）；
2. `event_role()` — begin 开阶段 / end 收阶段；
3. `validate_sequence()` — 阶段序判据，**一次报全部违规非 fail-fast**，四档：
   - `UNKNOWN_EVENT`（未登记事件，最高优先级）
   - `NESTED_STAGE`（同阶段 begin 后又 begin，未 end 重入）
   - `ORPHAN_END`（end 出现时同阶段无未收 begin）
   - `RESUME_WITHOUT_SPAWN`（从未 spawn 即 resume，协同会话未建立就恢复）
4. `stage_order()` — 生命周期阶段序 `(spawn, interaction, waiting, close, resume)` 可机检；
5. `ensure_collab_event()` — 值域闭合，未登记抛 `CollabEventError` 点名（§0 铁律 3）。

### 3.1 一轴超越

对照把十类事件散在各 `events/*.rs` 的发射点（运行时遇到才产出），
「close/resume 是否必须有前置 spawn」「同阶段是否可重入」靠跨文件调用序隐式保证、
无显式判据。本仓提前为纯函数状态机：四档违规可 diff 可单测，`stage_order()` 暴露
生命周期阶段序，`kind` 字段让优先级判定与措辞解耦（跨编码稳定）。

### 3.2 边界声明（互不顶账）

- `turn_metadata.subagent_header_value` 答「子代理 header 取什么值」，本模块答
  「协同会话生命周期事件封闭集 + 阶段序」，互补；
- `sse_contract` 的 `subagent_spawn/progress/end` 是本仓单层子代理 SSE 契约，
  与本域五组 begin/end 配对不同轴，互补不替换。

---

## 4. 验证实数

- `48 passed`（封闭集 4 + wire 名 12 + 角色 11 + 值域闭合 8 + 阶段序 9 + 可机检 1
  + 反向变异 3）；
- `ruff check` 全绿（`--fix` 修 2 处 SIM300 Yoda 条件）；
- `py_compile` OK；水印 2/2（`[IHUI-AI-PROVENANCE]` 标记行用同型文件逐字复制补回）。

### 4.1 开发期纠偏（记入档防重复踩）

首版 `validate_sequence` 的优先级判定用**中文子串匹配**（`any("重入" in k …)`），
跨编码不稳导致 2 个优先级测试转红；改为 `kind` 结构化字段判定后修复。另 1 个反向变异
测试（`test_mutation_closed_set_missing_pair`）逻辑写反（漏档时 `_value2member_map_`
不含该键，`in` 为 False，`assert` 不触发 raises），改为正向断言「常量总数 == 实登记
成员数 + 五组 begin/end 齐在」。反向变异先行的价值实证。

---

## 5. 未接生产路径（诚实边界）

本模块为声明式契约 + 纯函数判据，**未接生产发射点**（`agent_loop_v2.py` /
`session_store` 为他人在飞核心件，接入点留属主决策）。以下为未复现 / 推定项：

1. **事件在 transcript 上的确切字段名**未从二进制确证（本模块只钉 wire 名与载荷字段
   候选）；
2. `validate_sequence` 的四档优先级是**推定序**（对照确切优先表未从二进制确证，
   「未知 > 重入 > 孤儿 > 无 spawn 恢复」为本仓工程合理序）；
3. **Resume kind**（`review`/`compact`）仅确证为 ResumeEnd 载荷二档 —— **R51 已取证
   纠偏**：该二档属 **turn 可操纵性轴**（`NonSteerableTurnKind`，见 R51），与 R20
   `turn_resume_kind.py` 六档（**恢复来源轴**）**完全不同域、无映射关系**。本条原记
   「映射关系未下潜」是错误预设，以 R51 为准；两轴互补，本模块不复用其封闭集；
4. 跨 agent 消息回执 / 协同会话持久化 / collab agent 间 token 结算未复现（属
   workspace 多租户或 SaaS 层，R49 已判为架构差异）。

---

## 6. pivot-rust-loop 累计

本批下潜十四面：exec-approval 真差距复现 + reasoning-effort `ultra` 全端落地并核对
生效 + 七轴本仓已饱和 + 五轴探索停手 + workspace 配额架构差异停手 + **本轮 collab
生命周期真空白复现（R50）**。所有停手均有明确证据链不足/架构差异理由，未硬造任何存疑
封闭集。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
