<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# Codex 26.1111 multi-agent 配置校验 + spawn 准入门 取证报告（Round 17）

**目标**：MSIX `OpenAI.Codex_26.1111.2228.0_x64__2p2nqsd0c76g0`。下潜 R13 §4 遗留的
**multi-agent collab 编排细节**——本轮定位到配置校验层与 spawn 准入门的可抽纯函数判据。

## 1. 取证方法

自写 Node 流式 strings 扫描器（BigInt 安全偏移），对 codex.exe 364.8MB 定向抽取
`MultiAgentV2ConfigToml` 字段 + `tools::handlers::multi_agents*` 准入错误文案。全程只读，
未粘专有源码。

## 2. 关键发现

### 2.1 配置三段约束链（本轮复现核心）

`MultiAgentV2ConfigToml` 四字段 + 三条加载期约束（逐字）：

| 约束 | 逐字锚 |
|---|---|
| default ≥ min | `features.multi_agent_v2.default_wait_timeout_ms must be at least ...min_wait_timeout_ms` |
| default ≤ max | `...must be at most ...max_wait_timeout_ms` |
| 并发 ≥ 1 | `...max_concurrent_threads_per_session must be at least 1` |

字段：`min_wait_timeout_ms / max_wait_timeout_ms / default_wait_timeout_ms /
max_concurrent_threads_per_session`（另有 usage_hint_text 三态 + wait_agent_enabled 等开关）。

### 2.2 spawn/resume 准入门（逐字拒因）

| 拒因 | 逐字锚 |
|---|---|
| 深度超限 | `Agent depth limit reached. Solve the task yourself.` |
| agent id 非法 | `invalid agent id` |
| 复用已关闭 agent | `resume reopen closed agent` |

### 2.3 collab 工具集与事件（对照，未复现）

工具：`spawn_agent / resume_agent / close_agent / wait_agent / assign_agent_task /
send_message / followup_task / interrupt_agent / list_agents`（+ v1 遗留
send_input/close_agent）。
事件生命周期：`CollabAgentSpawnBegin/End → CollabAgentInteractionBegin/End →
CollabWaitingBegin/End → CollabCloseBegin/End`。
agent 终态枚举：`started / interacted / interrupted / inline / file`（agent_statuses）。

## 3. 本仓现状核查（防冗余，R14 教训）

| 本仓模块 | 覆盖面 | 关系 |
|---|---|---|
| `mcp_server.py` `_subagent_depth` + Semaphore | 运行时 depth ≤2 / 并发 ≤5 | **运行时**限制，非配置校验 |
| `subagent_cascade.py`（R10） | 级联中断两阶段 | 中断清理，非准入 |

**真空白确认**：全仓无「配置层三段 wait-timeout 校验 + spawn 准入门判据」——本仓只有
运行时限制，缺配置自相矛盾的前置拦截。Codex 把两层分开，本仓此前只有运行时层。

## 4. 复现交付

`apps/ai-service/app/core/multi_agent_config_gate.py` + `tests/test_multi_agent_config_gate.py`（13 用例）。

- `MultiAgentConfig`：四字段 frozen dataclass。
- `validate_multi_agent_config()`：三段约束校验，一次返回**全部**违规项。
- `admit_spawn()`：准入门 4 条优先级链（深度 → agent id → 已关闭 → 准入），逐字拒因。

## 5. 一轴超越

对照把三条配置约束散在 config 加载的各处 panic 分支（逐字但**逐条 fail-fast**，遇首条即停）。
本仓表驱动化成单一 `validate_multi_agent_config`，**一次报全部违规**，便于配置审计一次修完；
每条带逐字 codex 错误锚。准入门把「深度超限」优先于 id/关闭态，与运行时 depth 判据同序。

## 6. 诚实边界

- **未接生产路径**：`mcp_server.py` 是他席在飞/核心件，接入点留属主（沿用 round9-16 范式）。
- 运行时 depth/并发限制**已在 mcp_server 存在**，本模块只补配置校验 + 准入判据，**不替换**
  运行时实现。
- collab 工具集与事件生命周期（§2.3）属对照取证，**未复现**（本仓 subagent 走 mcp_server
  不同架构，ROI 负）。
- agent 终态枚举 `started/interacted/interrupted/inline/file` 仅登记，未复现状态机。

## 7. 验证实数

- 13 pytest 全过（含 2 处反向变异：default 上界判据删除 / depth off-by-one，均转红）。
- ruff 全绿（修 1 处 F401 未使用 import）。
- 水印 2/2。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
