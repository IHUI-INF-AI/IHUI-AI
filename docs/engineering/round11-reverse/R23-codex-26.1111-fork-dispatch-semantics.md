<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# Codex 26.1111 fork 派发语义 取证报告（Round 23）

**目标**：MSIX `OpenAI.Codex_26.1111.2228.0_x64__2p2nqsd0c76g0` codex.exe 364.8MB。
下潜 R20 §6 遗留——**warm_fork 内存 fork 机制**（fork 派发模式 + fork_turns 上下文
传播 + fork 拒绝条件）。**strings 取证即可覆盖，无需 Ghidra 深度逆向**——本轮推翻
R22 末尾「warm_fork 需 Ghidra」的悲观预设。

## 1. 取证方法

对 codex.exe 364.8MB 做流式 `strings` 定向扫（按 `fork_turns` / `in_process_fallback`
/ `worktree.*fork` / `Cannot fork` / `Ephemeral forks require` 反查）+ 全仓 grep
确认真空白。

## 2. 关键取证发现

### 2.1 fork 派发模式：in-process vs out-of-process（逐字 config 键）
```
disable_in_process_fallback        (CodeModeHostConfigToml)
app-server\src\in_process.rs
app-server\src\in_process_bootstrap.rs
event app-server\src\in_process.rs:744 codex_app_server::in_process
in-process request response channel closed:
failed to initialize in-process app-server client:
Failed to fork current session through the app server:
Failed to attach to forked app-server thread:
```
⇒ fork 默认走 **in-process**（app-server 内部 spawn 新 thread），失败 fallback 到
out-of-process（独立进程）；`disable_in_process_fallback=True` 强制 out-of-process。
这是 **app-server 级进程模型**，非 OS fork vs 用户态快照——R20 §6 的「内存 fork vs
OS fork」二分是**错误预设**，真实机制是「app-server 进程内 vs 外」。

### 2.2 fork_turns 上下文传播封闭集（逐字 + 文档串）
```
fork_turns: "all" / "none" / 正整数 N
Full-history forks (`fork_turns` omitted or "all") inherit the parent model and
reasoning effort and do not accept overrides.
Note that passing fork_turns="none" will not pass any surrounding context...
whereas fork_turns="all" will provide the subagent with all surrounding context.
True forks the current thread history into the new agent; false or omitted starts
with only the initial prompt.
```
⇒ `fork_turns` 三态（all/none/N）+ **full-history fork 继承父 model/reasoning_effort
且不接受 override**（最强约束，逐字）。

### 2.3 fork 拒绝条件（逐字，5 条）
```
Cannot fork into this worktree because developer instructions differ.
`codex fork --worktree` requires an explicit session ID
Forking with images requires a prompt
Ephemeral forks require a prompt
Forking with output options requires a prompt
```

### 2.4 其他 fork 面（本轮取证未复现，见诚实边界）
`forked_from_id` / `forked_from_ordinal` / `thread_fork_goal.rs` / `preserve_fork_prefix`
/ `codex fork --worktree` CLI 面 / ephemeral paginated fork `excludeTurns: true`。

## 3. 本仓三层分工（防冗余核查）

| 本仓模块 | 轴 | 关系 |
|---|---|---|
| `turn_resume_kind.py`（R20） | resume kind 六值分类（warm_fork 是其中一值） | **上游**：kind=warm_fork 后走本模块 |
| `multi_agent_config_gate.py`（R17） | multi-agent 配置校验 + spawn 准入 | **不同面**：spawn 准入非 fork 派发 |
| 本模块（R23） | **fork 派发语义**（in/out-of-process + fork_turns + 拒绝条件） | **fork 面** |

**真空白确认**：`grep fork_dispatch|fork_turns|in_process_fallback|forked_from_ordinal`
在 ai-service 全仓零命中 ⇒ Codex 独有的「fork 派发语义」在本仓无对应语义。

## 4. 复现交付

`apps/ai-service/app/core/fork_dispatch_semantics.py` +
`tests/test_fork_dispatch_semantics.py`（19 用例）。

- `ForkRequest`：10 字段（has_prompt / has_images / has_output_options / ephemeral /
  worktree / has_explicit_session_id / developer_instructions_match / fork_turns /
  model_override / reasoning_effort_override / disable_in_process_fallback）。
- `ForkDecision`：verdict + dispatch_mode + rejections（逐字锚，可多条）+
  context_propagation（fork_turns 归一化）。
- `ForkVerdict`：DISPATCH / REJECT。
- `ForkDispatch`：IN_PROCESS / OUT_OF_PROCESS。
- `decide_fork()`：7 条拒绝条件链（**一次报全部拒绝**非 fail-fast）+ 派发模式判定。
- `normalize_fork_turns()` / `fork_turns_closed_set()` / `is_full_history_fork()`：
  fork_turns 三态归一化 + 可机检谓词。

## 5. 一轴超越

对照把 fork 派发决策散在 `thread_fork_goal.rs` 各处 fallthrough（先检查 prompt，再检查
worktree，再决定 in/out-of-process），**full-history fork 不允许 model/reasoning_effort
override**这一约束只在文档字符串里逐字出现、无显式判据（运行时遇到才拒）。本仓提前为纯
函数：① 一次校验完所有拒绝条件（`rejections` 列表可多条，对照只 panic 一条就退）；
② in/out-of-process 派发判据由 `disable_in_process_fallback` 显式驱动；③ fork_turns
封闭集 + full-history override 约束可机检（`is_full_history_fork` 谓词）。

## 6. 诚实边界

- **推翻 R22 末尾悲观预设**：warm_fork 机制 **strings 即可覆盖**，无需 Ghidra 深度逆向。
  R20/R22 §6 写的「需 Ghidra」是**错误预设**，本轮纠正——真实机制是「app-server 进程内
  vs 外」，非「OS fork vs 用户态快照」。
- **未接生产路径**：`agent_loop_v2.py` / app-server 层属核心在飞件（` M`），接入点留属主。
- **fork_turns 正整数 N 的精确语义**（最近 N turn 的切分边界）未从二进制确证——只确证
  all/none 两极 + N 存在，N 的窗口计算逻辑属运行时。
- **未复现**：forked_from_id/ordinal 持久化字段、preserve_fork_prefix、ephemeral
  paginated fork excludeTurns 协议、codex fork CLI 参数面（属 CLI/持久化层）。
- **优先级是推定序**：7 条拒绝条件链按「worktree 语义 > prompt 要求 > fork_turns 校验 >
  override 约束」推定，对照内部确切优先序未从二进制确证。

## 7. 验证实数（2026-11-16 当次现读）

- **19 pytest 全过**（含 2 处反向变异：none-fork 允许 override / 默认 in-process）。
- **ruff 全绿**（修 1 处 fixable）。
- **水印 2/2**：`fork_dispatch_semantics.py` / `test_fork_dispatch_semantics.py` 各 1。
- 字节数：`fork_dispatch_semantics.py` 10874 / `test_fork_dispatch_semantics.py` 9093。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
