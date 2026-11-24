<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# Codex 26.1111 hook event 完整枚举 + exit-code 契约 取证报告（Round 16）

**目标**：MSIX `OpenAI.Codex_26.1111.2228.0_x64__2p2nqsd0c76g0`。下潜 R13 §4 遗留的
「lifecycle.rs 全部 hook event 触发时序」——本轮首次拿到 **hook event 完整封闭集**。

## 1. 取证方法

自写 Node 流式 strings 扫描器（BigInt 安全偏移），对 codex.exe 364.8MB 定向抽取
`codex_core::hook_runtime` / `hooks::src::events::*` / exit-code 错误文案。全程只读，
未粘专有源码。

## 2. 关键发现

### 2.1 hook event 完整 14 项封闭集

前几轮只记录 7-8 项。本轮从 `PreToolUse...Notification` 连续命中区逐字取全，剔除非
hook event 的 `Notification`（属 JSONRPC 通道），**确认 14 项**：

```
PreToolUse · PermissionRequest · PostToolUse · PreCompact · PostCompact
SessionStart · SessionEnd · UserPromptSubmit · SubagentStart · SubagentStop
Stop · Interrupt · PreModelRequest · PostModelRequest
```

**与本仓差距（精确）**：本仓 `hook_runtime.HookKind` 仅 6 项（session_start /
user_prompt_submit / pre_tool_use / pre_compact / post_compact / stop），**缺失 8 项**：
`permission_request / post_tool_use / session_end / subagent_start / subagent_stop /
interrupt / pre_model_request / post_model_request`。其中 post_tool_use /
pre_model_request / post_model_request / subagent_start / subagent_stop 全仓零等价物。

### 2.2 exit-code-2 必带 stderr 的契约（本轮复现核心）

逐字错误锚（`hooks::src::events/*.rs`），exit 2 = 干预且**必须**在 stderr 写对应载荷，
每类事件要求的载荷**不同**：

| 事件 | exit 2 必须写 stderr | 逐字锚 |
|---|---|---|
| PreToolUse | blocking reason | `exited with code 2 but did not write a blocking reason to stderr` |
| PermissionRequest | denial reason | `...did not write a denial reason to stderr` |
| PostToolUse | feedback | `...did not write feedback to stderr` |
| Stop / SubagentStop | continuation prompt | `...did not write a continuation prompt to stderr` |
| 任意（无状态码） | — | `hook exited without a status code` |
| 任意（JSON 坏） | — | `hook returned invalid {event} JSON output` |

`bypass_hook_trust`：config override，必须 boolean（逐字 `bypass_hook_trust\` override
must be a boolean`）——属 config 层信任开关，本仓 CLI 侧 `trust.d.ts` 有目录级等价物，
**不重复复现**。

## 3. 本仓现状核查（防冗余，R14 教训）

| 本仓模块 | 覆盖面 | 关系 |
|---|---|---|
| `hook_runtime.py` | hook 执行器（超时/deny/HookOutcome/session lifecycle） | 执行层，不重叠 |
| `agent_failure_vocabulary.py` | `hook_denied` / `hook_pipeline` 错误族 | 错误分类，不重叠 |
| `sandbox_failure_classifier` / `tool_invocation_ledger` | 各自 exit code（125/127/进程码） | 无关 |

**真空白确认**：全仓无「hook event 封闭集 + exit-code-2 带 stderr 契约」——grep
`exit code 2|blocking reason|denial reason|continuation prompt` 在 ai-service 零命中。

## 4. 复现交付

`apps/ai-service/app/core/hook_exit_contract.py` + `tests/test_hook_exit_contract.py`（16 用例）。

- `CodexHookEvent`：14 项封闭集（对照真相源，**不替换**既有 HookKind，供差距审计与扩展）。
- `required_stderr_payload(event)`：exit 2 必须的 stderr 载荷表（表驱动；未见者返回 None 不猜）。
- `check_hook_exit()`：纯函数 4 条优先级链（无状态码 → 非 exit2+JSON 坏 → exit2 缺载荷 →
  合规），每档带逐字 codex 错误锚。

## 5. 一轴超越

对照把「exit 2 必带 stderr」散在各 `events/*.rs` 运行时分支，每类事件载荷不同但无统一
判据。本仓**表驱动化**「哪类事件要求哪类载荷」，单一 `check_hook_exit` 覆盖全部事件，
可 diff、可单测、可挂 hook 执行后置校验。封闭集总数 `CODEX_HOOK_EVENT_TOTAL` 可机检
（误删任一事件即测试转红）。

## 6. 诚实边界

- **未接生产路径**：`hook_runtime.py` / `agent_loop_v2.py` 属他席在飞件，接入点留属主。
- `CodexHookEvent` 是**对照真相源**，非替换既有 `HookKind`（后者被大量测试钉住）。
- hook event 的**触发时序**（lifecycle.rs 完整发射顺序）本轮仍未穷尽——只取到封闭集 +
  exit 契约，未取到「何时发射哪个事件」的顺序图。R13 §4 该子项**推进非终结**。
- 8 项缺失事件是差距登记，**未在 hook_runtime 中补全**（避免撞在飞件 + 改既有契约需属主决策）。

## 7. 验证实数

- 16 pytest 全过（含 3 处反向变异：exit2 缺 stderr 漏判 / STOP-SUBAGENT_STOP 契约混淆 /
  封闭集总数误删，均转红）。
- ruff 全绿（修 1 处 C408 dict()→字面量）。
- 水印 2/2。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
