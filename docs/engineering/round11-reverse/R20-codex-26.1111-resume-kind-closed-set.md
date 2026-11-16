<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# Codex 26.1111 resume kind 六值封闭集 + 恢复侧状态机 取证报告（Round 20）

**目标**：MSIX `OpenAI.Codex_26.1111.2228.0_x64__2p2nqsd0c76g0` codex.exe 364.8MB。
下潜 R19 §6 遗留——turn_suspension **恢复侧**（suspended → resume 迁移细节）。

## 1. 取证方法

对 codex.exe 364.8MB 做流式 `strings` 定向扫（按 `resume_metadata` / `recover_turn` /
`ResumedTurn` 反查 payload 字段 + panic 文案）+ 全仓 grep 确认真空白。

## 2. 关键取证发现：ResumeKind 六值封闭集

恢复动作来源六值封闭集（逐字来自 strings）：
```
new · cleared · cold_resume · warm_fork · cold_fork · supplied_history
```

**关联复合 payload 字段**（rollout 复合 record）：`resume_metadata` / `trigger_turn` /
`turn_attribution` / `previous_turn_settings` / `last_started_turn_id`。

**Windows 进程级恢复失败**（逐字）：
```
failed to resume suspended process: NTSTATUS <n>
job state lock poisoned
```

**CompactionResumeMetadata 结构体**（cold 物化必带）：
```
struct CompactionResumeMetadata with 6 elements
```

**Trace bundle 唯一恢复变体**：`RawTraceEventPayload::ThreadResumed`（`thread_resumed`）。

## 3. 本仓三层分工（防冗余核查）

| 本仓模块 | 轴 | 关系 |
|---|---|---|
| `agent_resume_semantics.py`（550 行） | step 级工具执行恢复档（确认 payload / 继续 / 终止） | **不同层**：step 决策非 resume kind 分类 |
| `turn_suspension.py`（R19） | 挂起侧四段顺序状态机（REJECT/ABORT/FAILED/SUSPENDED） | **不同侧**：挂起非恢复 |
| `turn_phase_advance.py`（R15） | 回合进行中 phase 前进决策 | **不同轴** |

**真空白确认**：`grep resume_kind|cold_resume|warm_fork|cold_fork|supplied_history|job_lock_poisoned|CompactionResumeMetadata`
在 ai-service 全仓零命中 ⇒ Codex 独有的「resume kind 封闭集 + Windows job object 恢复
判据」在本仓无对应语义。

## 4. 复现交付

`apps/ai-service/app/core/turn_resume_kind.py` + `tests/test_turn_resume_kind.py`（16 用例）。

- `ResumeInput`：6 字段（kind + has_suspended_process + ntstatus + job_lock_poisoned +
  has_resume_metadata + has_supplied_history_payload）。
- `ResumeOutcome`：action + evidence（逐字锚）+ kind。
- `ResumeAction`：六档封闭集（RESUME_PROCESS/MATERIALIZE/FORK/START_FRESH/REJECT_SUPPLIED/FAILED）。
- `classify_resume_kind()`：10 条优先级链（非法 kind → NTSTATUS 失败 → job_lock → 进程恢复
  → cold 缺元数据 → cold 物化 → warm_fork → supplied 缺载荷 → supplied 物化 → fresh）。
- 三个分类谓词：`is_fork_kind()` / `is_cold_kind()` / `is_fresh_kind()`（可机检）。

## 5. 一轴超越

对照把 resume kind 判定散在 rollout materialize 运行时分支（遇到哪种历史来源才走哪条
恢复路径），且**「Windows job object 挂起句柄恢复失败」与「磁盘 rollout 物化失败」是两类
不同错误、对照靠 panic 文案隐式区分**。本仓让两者由 `ntstatus` / `has_resume_metadata`
显式驱动，结论可 diff、可单测、可在编排层挂前置，每档带逐字 codex 错误锚 + 命中的 kind 值。
三个分类谓词把对照隐式 fallthrough 路径显式化为可机检谓词函数。

## 6. 诚实边界

- **未接生产路径**：`agent_loop_v2.py` / `session_store` 属核心在飞件（` M`），接入点留属主。
- `ResumeAction` 是**恢复语义对照真相源**，不替换 `TurnStatus`（生命周期轴）/
  `turn_suspension.SuspensionDecision`（挂起侧轴）/ `agent_failure_vocabulary`（恢复族轴）。
- **优先级是推定序**：本模块假定「NTSTATUS 失败 > job_lock > 进程恢复 > cold 缺元数据 >
  cold 物化 > warm_fork > supplied 校验 > fresh」，对照多条件同时命中时内部确切优先序
  未从二进制确证。
- **resume_metadata 6 元素物化算法未复现**（属 rollout 持久化层，本模块只判「有/无」）。
- **warm_fork 内存 fork 机制未下潜**（对照把 fork 任务派给 OS 进程 fork 还是用户态快照，
  strings 未显式暴露）。

## 7. 验证实数（2026-11-16 当次现读）

- **16 pytest 全过**（含 1 处反向变异：NTSTATUS=0 不应走 FAILED，转红）。
- **ruff 全绿**（修 4 处：unused import `pytest` + 3 处自动 fix；无 UP042 报错，初写已用 `StrEnum`）。
- **水印 2/2**：`turn_resume_kind.py` / `test_turn_resume_kind.py` 各 1。
- 字节数：`turn_resume_kind.py` 9666 / `test_turn_resume_kind.py` 7507。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
