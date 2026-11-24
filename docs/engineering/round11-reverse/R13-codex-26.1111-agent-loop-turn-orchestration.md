<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# Codex 26.1111.2228.0 agent loop / turn 驱动层 取证报告

**目标**：MSIX `OpenAI.Codex_26.1111.2228.0_x64__2p2nqsd0c76g0`。本轮下潜其 **agent loop / turn 编排核心**（前几轮挖的是外围安全门控，本轮首次触及"大脑"）。

## 1. 关键架构结论（本轮核心发现）

**Codex 的 agent loop / turn 驱动大脑在 Rust 引擎（codex.exe），前端 webview 是薄适配层。**

证据链（逐字 strings + 全 chunk 符号密度扫描）：

### 1.1 app.asar 全 chunk 扫描（前端无 loop 逻辑）

`.vite/build` 顶层共 30 个 chunk。对 loop/turn/orchestration/retry 字面量做密度扫描：

| chunk | size | turn | tool | orch | retry | 结论 |
|---|---|---|---|---|---|---|
| early-bootstrap-331 | 5.6MB | 0 | 0 | 0 | 0 | 行为逻辑但非 loop |
| early-bootstrap-631 | 1.4MB | 20 | 8 | 1 | 2 | **thread/turn 会话管理** |
| worker.js | 2.2MB | 3 | 40 | 1 | 1 | **多提供商 tool-call 流解析** |
| mcp-annotation-runtime | 523KB | 0 | 0 | 0 | 0 | MCP 注解 |

- `agentLoop` / `runLoop` / `mainLoop` 字面量：**全 0**。
- worker.js 实为 vercel-ai SDK 风格：统一 Anthropic `tool_use` / OpenAI-Gemini `function`/`functionCall` 到 `toolCalls[]`，带 OTel 埋点 `ai.toolCall.name` / `ai.toolCall.id`。是"适配+传输"，不排 turn。
- early-bootstrap-631 实为 thread/turn 会话管理：`startTurn` / `turnComplete` / `automationTurns` / `preventAuto...`。

### 1.2 codex.exe strings 命中真正 loop 编排（Rust）

`codex_core::*` crate 路径逐字：

```
codex_core::tasks::regular::prepare_run_turn
codex_core::tasks::lifecycle          (emit_turn_start_lifecycle)
codex_core::tasks::phase
codex_core::tasks::compact
codex_core::session::turn_context
codex_core::session::turn_input
codex_core::session::turn_suspension
codex_core::hook_runtime              (run_turn_stop_hooks / inference_hook / mcp_tool_hook / startup_hooks)
codex_core::agent::control::runtime
codex_core::turn_timing               (phase 状态机 + BeforeTransmit stop point)
codex_core::tools::runtimes::unified_exec::launcher
```

## 2. loop 编排机制（取证要点）

### 2.1 phase 状态机 + stop point
- `turn_timing.rs` 含 **BeforeTransmit** stop point；orchestrator phase 转换（`failure` phase / `BeforeTaskRegistration` / `RegularTaskStart`）。
- 错误文案：`encountered orchestrator error; continuing` / `halting` / `orchestrator is transitioning to the 'failure' phase`。
- `ending orchestration early because the stop point is BeforeTransmit`。

### 2.2 hook_runtime 钩子体系（loop 的注入点）
逐字密度：`hook_runtime`13、`bypass_hook`17、`mitm_hooks`13、`mcp_tool_hook`7、`startup_hooks`8、`stop_hook`4、`inference_hook`、`run_turn_stop_hooks`、`run_session_end_hooks`、`run_pending_session_start_hooks`。hook event 含 `codex_command_execution_event` / `codex_file_change_event` / `codex_mcp_tool_call_event` / `codex_dynamic_tool_call_event` / `codex_collab_agent_tool_call_event`。

### 2.3 multi-agent collab（loop 的并行面）
工具集逐字：`spawn_agent` / `wait_agent` / `resume_agent` / `close_agent` / `send_message` / `list_agents` / `assign_agent_task` / `wait_threads` / `create_thread`。配置：`multi_agent_mode` / `usage_hint_enable` / `wait_agent_enable` / `default_wait_timeout_ms` / `agent_depth`。错误 `Agent depth limit reached`。

### 2.4 parallel tool（工具并行能力）
`supports_parallel_tool_calls`（MCP server 级能力字段）+ `parallel_tool_calls` / `parallel_tool_calls_changed` event。

### 2.5 turn 失败错误分类（本轮复现的复用件锚点）
9 类逐字错误：`turn_aborted` / `session_budget_exceeded` / `context_window_exceeded` / `rate_limit_exceeded` / `usage_limit_exceeded` / `agent_limit_reached` / `response_incomplete` / `content_filter` / `inference_hook_denied`。

## 3. 本轮复现件

`apps/ai-service/app/core/turn_error_policy.py` —— 把 turn 错误分类 → 恢复策略提前为**纯函数判据**：

| 错误类 | 恢复动作 | 语义 |
|---|---|---|
| TURN_ABORTED / CONTENT_FILTER / CONTEXT_WINDOW_EXCEEDED | TERMINATE | 不自动续跑/重试无效/同输入无解 |
| INFERENCE_HOOK_DENIED / SESSION_BUDGET / USAGE_LIMIT / AGENT_LIMIT | ESCALATE | 需上层或人决策 |
| RATE_LIMIT_EXCEEDED / RESPONSE_INCOMPLETE(attempts<3) | RETRY | 瞬态，退避/重发 |
| UNKNOWN | UNDETERMINED | 不猜 |
| RESPONSE_INCOMPLETE(attempts>=3) | ESCALATE | 防无限重试 |

18 个单测全过。**一轴超越**：对照把错误分类散在 codex-core 的事件/恢复分支（运行时遇到才处理），本仓拆成可 diff、可单测、可挂编排前置的纯函数，补齐对照缺失的"错误→恢复"显式分层。

## 4. 尚未触及（后续下潜）
- phase 状态机完整枚举（只抽到 BeforeTransmit / BeforeTaskRegistration / RegularTaskStart，完整枚举待下潜）
- lifecycle.rs 全部 hook event 的触发时序
- compact 任务（上下文压缩）与 context_window_exceeded 的联动
- turn_suspension 的挂起/恢复状态迁移细节


---

## ⚠️ 纠错附录（2026-11-16 交付前核查追加）

**本报告第 3 节的复现件 `turn_error_policy.py` 已作废并删除**：交付前核查发现本仓**已有更成熟
的等价实现**，本复现件属冗余。

### 本仓已有的等价能力

| 本报告第 2.5 节 codex 9 类 turn 错误 | 本仓已有等价物 | 状态 |
|---|---|---|
| retryable / terminal / escalate 判定 | `agent_failure_vocabulary.py`（269 行声明式错误族词表） | **已有，且更严谨** |
| turn_aborted → 不续跑 | `AGENT_TERMINAL_ERROR_FAMILIES` 含 `aborted` / `cancelled` | **已覆盖** |
| hook_denied → escalate | `AGENT_TERMINAL_ERROR_FAMILIES` 含 `hook_denied` | **已覆盖** |
| budget_exceeded → escalate | `AGENT_TERMINAL_ERROR_FAMILIES` 含 `budget_exceeded` | **已覆盖** |
| rate_limit / timeout → retry | `AGENT_RETRYABLE_ERROR_FAMILIES` 含 `timeout` / `connection` / `http_5xx` + `retry_after.py` 退避 | **已覆盖** |
| attempts 阈值防无限重试 | `agent_loop_v2.py` `llm_retry_max=3` + `resolve_retry_delay_s` | **已覆盖** |
| undetermined 不猜 | `AgentFailureOutcome` 三态 + 判序与 TS 侧逐字同形 | **已有，且更严谨** |

本仓 `agent_failure_vocabulary.py` 是**声明式**错误族词表（可重试族 / 终局族 / 未判定三态），
被 pytest 钉住、多层可读，比本报告的 `TurnErrorKind → RecoveryAction` 映射更严谨。

### 结论

本报告第 1、2 节的 **agent loop Rust 大脑定位取证仍然有效**（这是本轮核心架构发现），但
**第 3 节的复现件作废**：turn 错误分类→恢复策略不是本仓的"差距"，而是**已实现且比对照更
严谨的能力**。

**处置**：删除误建的 `turn_error_policy.py` / `test_turn_error_policy.py`（避免与已有词表
冗余并误导）。本轮 agent loop 方向的净交付 = **核心架构取证发现**（Rust 大脑定位），非新增
复现件。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
