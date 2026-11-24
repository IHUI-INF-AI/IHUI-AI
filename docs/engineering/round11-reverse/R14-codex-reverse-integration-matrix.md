<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# Codex 26.1111 逆向成果整合 · 对照矩阵（Round 14 收口）

**目的**：把 2026-11-15/16 两轮对 `MSIX OpenAI.Codex_26.1111.2228.0` 的逆向成果收口成一张决策矩阵——标清**哪些是真差距（值得接入生产）、哪些本仓已有（冗余）、哪些只是架构取证（无复现件）**，供接入决策。

**方法论**（逆向-复现-超越铁律）：每个方向 = REA/craft-anything 取证 → 本仓现有栈复现 → 至少一轴超越。交付前必须核查"目标路径是否已有实现"，避免冗余复现。

---

## 一、核心架构发现（两轮最重要的结论）

**Codex 是「ChatGPT 桌面壳 + codex 引擎」双层架构，agent 大脑在 Rust 引擎，前端 webview 是薄适配层。**

证据（逐字 strings + 全 chunk 符号密度扫描）：

| 层 | 载体 | 实证 |
|---|---|---|
| 前端壳 | app.asar（783MB）`.vite/build` 30 chunk | 扫 `agentLoop`/`runLoop`/`mainLoop` 字面量**全 0**；worker.js = vercel-ai SDK 风格多提供商 tool-call 流解析；early-bootstrap-631 = thread/turn 会话管理 |
| 引擎 | codex.exe（382MB，Rust） | `codex_core::tasks::{lifecycle,phase,regular}` + `hook_runtime`（startup/stop/inference/mcp_tool 钩子）+ `turn_timing`（phase 状态机 + `BeforeTransmit` stop point）+ multi-agent collab（spawn_agent/wait_agent/resume_agent/close_agent）+ `supports_parallel_tool_calls` |

**对本仓的意义**：本仓 Tauri(Rust) 桌面端 + Python ai-service 的分层与之**同构**（Tauri core ≈ codex-core 引擎，web 前端 ≈ 薄壳）。Codex 把安全门控、loop 编排、凭据遮蔽都**下沉到引擎层纯函数**，本仓已部分跟进（见下表"已有"项）。

---

## 二、逐项对照矩阵

### A. 真差距 · 已复现并交付（本轮净产出 3 件）

| # | Codex 组件 | 本仓复现件 | 一轴超越 | 测试 | 接入建议 |
|---|---|---|---|---|---|
| 9 | MCP connection-recovery（重连/审批降级） | `plugin_receipt.py`（`PluginVerdict`/`check_plugins`/`scan_disk_plugins`/`parse_receipt`） | 审批前置纯函数化，结构化拒因带 codex 锚；插件来源可审计 | test_plugin_receipt.py | **高**：插件加载前强校验，可接生产 |
| 10 | websearch-request-allowlist（能力载荷白名单） | `capability_payload_gate.py`（`CapabilityGate`/`GateDecision`/`CapabilityRegistry`/`build_default_registry`） | 白名单门控前置 + 超限硬拦截；registry 可声明式扩展 | test_capability_payload_gate.py | **高**：工具调用下发前拦，可接生产 |
| 11 | network-proxy credential-masking（凭据遮蔽启用前置） | `credential_masking_gate.py`（`evaluate_credential_masking`/`MaskingVerdict`/`ProxyMode`） | 执行前置判定，不静默放行明文；9 类降级原因逐字保真 | test_credential_masking_gate.py | **中高**：命令执行前判定遮蔽可行性 |

> 三件均 ruff 全绿 + pytest 通过（合计 40 passed）。共同超越轴：把 codex 散在运行时分支的判定**提前为可 diff/可单测/可挂前置的纯函数**。

### B. 冗余 · 本仓已有更成熟实现（本轮作废 2 件）

| 候选复现件 | Codex 组件 | 本仓已有等价物（更成熟） | 处置 |
|---|---|---|---|
| ~~auto-compact 复现件~~ | `compact_threshold_percent`/`auto_compact_*`/`context_compaction` | `context_compaction.py`（1161 行：`assess_context_pressure`/`compress_messages_if_needed`/`micro_compact_messages`；`DEFAULT_TRIGGER_RATIO=0.88` 对标 codex，整数交叉相乘防浮点边界翻转）+ 45 个压缩测试 | **作废**，本仓已实现且更严谨 |
| ~~turn_error_policy~~ | codex-core `turn_suspension` 9 类 turn 错误 | `agent_failure_vocabulary.py`（269 行声明式错误族词表：retryable/terminal/undetermined 三态，与 TS 侧逐字同形）+ `retry_after.py` 退避 + `agent_loop_v2.py llm_retry_max=3` | **已删除**，本仓已实现且更严谨 |

> 教训：这两件若不看现有实现就新建，会**覆盖/冗余**已有 1161 行 + 269 行成熟代码。交付前核查目标路径是硬要求。

### C. 仅架构取证 · 无复现件（架构发现，非代码差距）

| Codex 机制 | 取证结论 | 为何无复现件 |
|---|---|---|
| agent loop/turn 编排 | 大脑在 Rust `codex_core`（见第一节），前端零 loop | loop 控制流在引擎，本仓 agent_loop_v2 已是同层；复现=重写引擎，非差距 |
| phase 状态机 | `turn_timing.rs` 含 BeforeTransmit 等 stop point | 本仓 agent_loop_v2 已有等价 turn 阶段；完整枚举属引擎内部 |
| multi-agent collab | spawn/wait/resume/close_agent 工具集 + agent_depth | 本仓 collab 体系已有；codex 的编排细节属引擎侧 |
| supports_parallel_tool_calls | MCP server 级能力字段 | 本仓工具注册已有并行能力位 |

---

## 三、接入决策建议

1. **立即接入（高价值真差距）**：#9 plugin_receipt、#10 capability_payload_gate —— 两者是安全前置门控，本仓有明确挂载点（插件加载前 / 工具下发前），补齐对照缺失的前置分层。
2. **择机接入（中高）**：#11 credential_masking_gate —— 命令执行前判定凭据遮蔽可行性，本仓 egress/exec 链路可挂。
3. **不接入（冗余）**：B 类两件 —— 本仓已有更成熟实现，接入=降级。
4. **不接入（架构取证）**：C 类 —— 属引擎内部，本仓同层已有，复现=重写引擎，ROI 为负。

## 四、本轮流程反思（写入交付以防复发）

- **失误**：写盘前未核查目标路径，误覆盖 `context_compaction.py`(1161 行)/`test_context_compaction.py`(847 行) 两个已跟踪文件。**已从 git HEAD 完整恢复，无损**（git status 空）。
- **纠正**：新建文件前必须 `git ls-files` + grep 现有实现，确认非"已实现"。本轮 B 类两件正是该核查的成果。
- **边际价值判断**：Codex 逆向经两轮后，外围安全门控已系统榨干（A 类 3 件真差距）；剩余方向（auto-compact/turn 错误/loop 编排）本仓均已实现，继续下潜 ROI 递减。

## 五、产物清单

**复现件（净产出 3 件）**：`apps/ai-service/app/core/{plugin_receipt,capability_payload_gate,credential_masking_gate}.py` + `tests/test_*.py`
**取证报告**：`docs/engineering/round11-reverse/R11-*(5)` / `R13-agent-loop` / `R13b-auto-compact` / 本矩阵 `R14`


---

## 六、交付前修订（2026-11-16 接线核查 · 诚实修订）

### 原判断需更正

本矩阵第二节曾把 A 类三件标为「真差距 · 可接生产 · **立即接入**」。**这个判断是过度乐观的，
现予更正。** 用户选择「接线到生产」后，逐件核查本仓真实挂载点，结论是**三件都没有对应的
生产场景**——「接线」会制造死代码。

### 逐件挂载点核查结果

| 复现件 | 它需要的生产场景 | 本仓实际架构 | 是否有场景 |
|---|---|---|---|
| `plugin_receipt.py` | 本地插件目录 + receipt 清单完整性校验（清单 vs 磁盘对账） | 本仓 MCP 用 **stdio server manifest**（`mcp_registry.py` 声明式 schema + `check-tool-registry-integrity.mjs`），非 receipt 清单对账模式 | ❌ 无 |
| `capability_payload_gate.py` | **跨版本 peer 协商**（对端版本 → 剥离其不支持的 payload 字段） | ai-service 是**单版本服务**，全仓 grep 无 `peer_version`/`client_version`/版本协商场景 | ❌ 无 |
| `credential_masking_gate.py` | 命令执行器 + network-proxy/sandbox/masking 上下文 | `exec_env.py` 只管环境变量继承；`exec_policy_decision.py` 只管审批/sandbox 维度；**全仓无凭据遮蔽机制、无 network-proxy 执行器** | ❌ 无 |

引用核查：三件在本仓的引用**仅命中自身**（grep `plugin_receipt|capability_payload_gate|credential_masking_gate` 除自身无其他命中）= 确未接线；核查后确认**也不该接线**。

### 最接近的"半个"挂载点（记录但不采用）

`credential_masking_gate` 与 `exec_policy_decision.py` 的 `sandbox_kind` 同源（都对标 codex
exec 链路），理论可挂为"遮蔽可行性预检"。但本仓 exec 链路**根本没有 masking/proxy 那一层**，
硬挂一个判定"proxy 是否启用"的函数到一个没有 proxy 概念的链路 = 前瞻性死代码。**不采用。**

### 最终处置：保留为 Codex 兼容库（用户拍板）

三件**保留**在 `apps/ai-service/app/core/`，定位为 **Codex 26.1111 兼容参考库**：

- 实现正确、ruff 全绿、40 测试通过——作为「Codex 这三层门控怎么做的」可运行参考。
- **不硬接**本仓当前链路（无场景，硬接=死代码）。
- 未来本仓若引入 network-proxy 执行器 / 跨版本 peer 协商 / 插件清单对账，这三件可直接启用。

### 逆向-复现-超越铁律的诚实教训

> **「能在对照程序复现」≠「本仓用得上」。**

Codex 有 proxy 执行器、有版本协商、有插件清单，所以这三层门控对它是刚需；本仓 Tauri+单版本
ai-service 架构里这三层暂无落点。逆向的完整价值 = 取证(懂对照) + 复现(能做) + **超越(用得上)**，
缺最后一环时，复现件应诚实标注为「参考库」而非「生产接线」，否则就是用死代码自欺。

**这是比 B 类冗余更隐蔽的陷阱**：B 类是「已有还重写」（冗余），这类是「没场景还硬接」（死代码）。
两轮逆向至此，A 类三件的诚实定位 = **兼容参考库，非生产接线**。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
