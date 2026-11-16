<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# Codex 26.1111 hook event 触发时序拓扑 取证报告（Round 22）

**目标**：MSIX `OpenAI.Codex_26.1111.2228.0_x64__2p2nqsd0c76g0` codex.exe 364.8MB。
下潜 R16 §6 遗留——lifecycle.rs **完整 hook event 发射顺序拓扑**。

## 1. 取证方法

对 codex.exe 364.8MB 做流式 `strings` 定向扫（按 `PreToolUse PermissionRequest PostToolUse`
/ `flush transcript before` 反查声明顺序锚 + flush 前置约束）+ 全仓 grep 确认真空白。

## 2. 关键取证发现

### 2.1 14 项 hook event 声明顺序（逐字）
strings 多处重复锚里最完整一处（对照取此为拓扑真相源）：
```
PreToolUse → PermissionRequest → PostToolUse → PreCompact → PostCompact →
SessionStart → SessionEnd → UserPromptSubmit → SubagentStart → SubagentStop →
Stop → Interrupt → PreModelRequest → PostModelRequest
```
变体：一处无 `Stop`（13 项），一处 `Stop` 在 `PostToolUse` 之后（不同声明分支）。
**声明顺序 ≠ 严格运行时发射顺序**（见诚实边界）。

### 2.2 transcript flush 前置约束（逐字，最强顺序证据）
```
failed to flush transcript before Interrupt hook: 
failed to flush transcript before SessionEnd hook: 
```
⇒ **transcript flush 必须先于 Interrupt / SessionEnd / SubagentStop** 三类 hook。
这三类都是「终结类」事件（turn 被 interrupt / 会话收尾 / 子 agent 收尾），
flush 是为了让 transcript 包含完整上下文再给 hook 看。

### 2.3 Pre/Post 生命周期配对（语义，非逐字 fallthrough 锚）
```
PreToolUse ↔ PostToolUse
PreCompact ↔ PostCompact
PreModelRequest ↔ PostModelRequest
```
配对来自语义推断（名字对称），**运行时保证 Post 在 Pre 后**未从二进制显式确证。

### 2.4 Session 边界约束（语义推断）
`SessionStart` 早于 `SessionEnd`、两者不重复——会话生命周期的基本约束。

## 3. 本仓三层分工（防冗余核查）

| 本仓模块 | 轴 | 关系 |
|---|---|---|
| `hook_exit_contract.py`（R16） | 14 项 hook event 封闭集 + exit-code-2 stderr 契约 | **上游**：事件定义 + 契约 |
| `hook_runtime.py`（既有） | hook 运行时执行（subprocess / exit code 解析） | **执行层** |
| 本模块（R22） | **发射顺序拓扑校验**（序列 → verdict） | **时序层** |

**真空白确认**：`grep hook_sequence|flush_before_hook|HOOK_DECLARATION_ORDER|session_boundary`
在 ai-service 全仓零命中 ⇒ Codex 独有的「hook event 发射顺序拓扑校验」在本仓无对应语义。

## 4. 复现交付

`apps/ai-service/app/core/hook_event_ordering.py` +
`tests/test_hook_event_ordering.py`（19 用例）。

- `HOOK_DECLARATION_ORDER`：14 项声明顺序（对照真相源，不替换 R16 的 `CodexHookEvent`）。
- `FLUSH_BEFORE_HOOKS`：三类终结 hook（Interrupt / SessionEnd / SubagentStop）。
- `PRE_POST_PAIRS` / `POST_PRE_PAIRS`：三对生命周期对称事件。
- `OrderingViolation`：五档封闭集（OK / UNKNOWN_EVENT / SESSION_BOUNDARY_VIOLATION /
  PRE_BEFORE_POST_VIOLATION / FLUSH_BEFORE_HOOK_VIOLATION）。
- `SequenceCheck`：verdict + violations（每条带具体事件名/位置）。
- `validate_hook_sequence()`：5 条优先级链（UNKNOWN > SESSION > PRE_POST > FLUSH > OK）。
- `hook_declaration_order()` / `flush_before_hooks()`：可机检谓词。

## 5. 一轴超越

对照把发射顺序散在 lifecycle.rs 各处 fallthrough（遇到事件才调 emit），**transcript flush
先于终结类 hook**这一关键前置约束靠运行时 panic 文案隐式表达、无显式判据。本仓提前为
纯函数：一次校验完所有违规（不是 fail-fast 遇首即停），结论可 diff、可单测、可在编排层
挂前置 + 回归测试钉住。`violations` 列表把每条违规的事件名 + 索引 + 期望顺序都暴露出来
（对照只 panic 一条就退）。

## 6. 诚实边界

- **声明顺序 ≠ 运行时发射顺序**：`HOOK_DECLARATION_ORDER` 是 strings 声明锚（多处
  重复的最完整一处），**运行时实际发射顺序**（哪个事件真实先发、嵌套关系）未从二进制
  完整确证——R16 §6 诚实边界仍成立，本模块推进非终结。
- **Pre/Post 配对是语义推断**：`PreToolUse ↔ PostToolUse` 等三对来自名字对称，**运行时
  强制 Post 在 Pre 后**未从二进制显式确证（可能存在只有 Pre 无 Post 的分支，如 PreCompact
  触发但 compact 失败时是否仍发 PostCompact）。
- **未接生产路径**：`hook_runtime.py` / `agent_loop_v2.py` 属核心在飞件（` M`），接入点留
  属主。
- **优先级是推定序**：UNKNOWN > SESSION > PRE_POST > FLUSH 是按「语法 > 语义 > 生命周期 >
  flush 契约」推定，对照多违规同时命中时内部确切优先序未从二进制确证。
- **flush_positions 参数**：调用方需显式传入 transcript flush 的 sequence 索引，本模块
  **不推断** flush 时机（属执行层）。

## 7. 验证实数（2026-11-16 当次现读）

- **19 pytest 全过**（含 2 处反向变异：unknown 最优先 / session boundary 优先于 flush）。
- **ruff 全绿**（修 6 处 fixable，含 unused import `pytest` / `SequenceCheck`）。
- **水印 2/2**：`hook_event_ordering.py` / `test_hook_event_ordering.py` 各 1。
- 字节数：`hook_event_ordering.py` 10221 / `test_hook_event_ordering.py` 9295。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
