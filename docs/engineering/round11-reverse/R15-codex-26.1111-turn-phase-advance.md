<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# Codex 26.1111 turn phase 前进决策层 取证报告（Round 15）

**目标**：MSIX `OpenAI.Codex_26.1111.2228.0_x64__2p2nqsd0c76g0`。本轮下潜 R13 §4 遗留的
**phase 状态机完整枚举 + orchestrator 前进决策**——R14 曾把它误判为「复现=重写引擎，ROI 负」，
本轮取证证明其中**前进决策层可抽成纯函数**，非引擎重写。

## 1. 取证方法

自写 Node 流式 strings 扫描器（BigInt 安全偏移，8MB 分块 + 4096 重叠），对 `codex.exe`
364.8MB 主引擎定向抽取 `codex_core::tasks::phase` / `turn_timing` / `retained_context` /
orchestrator 错误文案。全程只读，非反混淆，未粘专有源码。

## 2. 关键发现：两层 phase 必须分清

### 2.1 http transmit 7-phase —— 非 Codex 自有

```
BeforeSerialization → Serialization → BeforeTransmit → Transmit
  → BeforeDeserialization → Deserialization → AfterDeserialization
```

**纠偏**：初扫以为这是 Codex loop phase。实为 AWS SDK `aws-smithy-http` 的 client
orchestrator 中间件序列（`orchestrator.rs`，cargo registry 路径在案）。Codex 只是引用它做
HTTP 传输。**不属 agent loop 行为逻辑**，不复现。

### 2.2 任务级 phase —— Codex 自有（本轮复现对象）

`session/retained_context.rs` 逐字命中：
- 主链：`BeforeTaskRegistration` → `RegularTaskStart`
- TLS/CA 旁支配置 phase：`CustomCa` / `ExplicitTls`
- stop point：唯一具名 = `BeforeTransmit`（`turn_timing.rs`）

### 2.3 orchestrator 前进三档（本轮复现核心）

逐字错误锚（三档互斥，遇错时编排器走其一）：

| 档 | 逐字文案 | 语义 |
|---|---|---|
| CONTINUING | `encountered orchestrator error; continuing` | 吞非致命错误续跑 |
| HALTING | `encountered orchestrator error; halting` | 致命错误整回合停 |
| ENDING_EARLY | `ending orchestration early because the stop point is \`BeforeTransmit\`` | 未 transmit 即收束 |

**最有价值的分野**：非致命错误在 **transmit 前** vs **transmit 后**走不同档——
transmit 前致命 ⇒ ENDING_EARLY（请求还没发出去，提前收束省一次调用）；
transmit 后致命 ⇒ HALTING（已在飞，整回合停）。对照把这条散在运行时分支，未显式化。

## 3. 本仓现状核查（防冗余，R14 教训）

| 本仓模块 | 覆盖面 | 与本差距关系 |
|---|---|---|
| `turn_stop_reason.py` | 回合**终态**档位封闭集（completed/error/...） | 不重叠（那是 done 帧，本模块是进行中前进） |
| `agent_failure_vocabulary.py` | 错误→族（retryable/terminal/undetermined） | 不重叠（只分类，不出前进动作） |
| `agent_resume_semantics.py` | 工具执行恢复档（tools_inflight/...） | 不重叠（恢复而非前进） |

**真空白确认**：turn 进行中的**任务级 phase 前进决策 + stop-point 提前结束判据**全仓无等价物
（grep `BeforeTaskRegistration|stop_point|ending_early` 零命中）。

## 4. 复现交付

`apps/ai-service/app/core/turn_phase_advance.py` + `tests/test_turn_phase_advance.py`（13 用例）。

- `TurnPhase`：任务级 6 phase（TASK_START / TASK_REGISTERED / REGULAR_TASK_START /
  CUSTOM_CA / EXPLICIT_TLS / TRANSMIT），主链 4 phase 由 `task_phase_order()` 给出，旁支
  CA/TLS 不入主链。
- `advance_orchestrator()`：纯函数判据，4 条优先级链（致命+已transmit→HALTING / 致命+未
  transmit→ENDING_EARLY / 命中 BeforeTransmit→ENDING_EARLY / 其余→CONTINUING），每档带
  逐字 codex 错误锚 + reason。
- 三条逐字错误锚常量保真，测试按常量断言不手抄。

## 5. 一轴超越

1. **可判定**：前进动作是纯函数输出，可 diff/可单测/可挂编排前置；对照散在运行时分支。
2. **transmit 前后分野显式化**：对照未显式的关键判据，本仓拆成独立分支并各有文案锚。
3. **ENDING_EARLY 带 stop point**：收束时点名命中的 stop point，可审计「为什么提前结束」。

## 6. 诚实边界

- **未接生产路径**：`agent_loop_v2.py` 是他席在飞 ` M` 件，接入点留属主（沿用 round9-14 范式：
  先落纯函数模块 + 测试，接线单独决策）。
- phase 完整枚举待深潜：本轮只取证到启动链 + TLS 旁支，`turn_timing.rs` 内部完整 phase 转换
  图（含 failure phase 全分支）未穷尽——R13 §4 该项仍未闭合，本轮只是**推进**非终结。
- 不复现 http transmit 7-phase（AWS SDK 所有物，非 Codex 自有，ROI 负）。

## 7. 验证实数

- 13 pytest 全过（含 2 处反向变异：抹掉 transmit 前后分野 / 忽略 stop point，均转红）。
- ruff 全绿（修掉 1 处 C408 `dict()`→字面量）。
- 水印 2/2（源 + 测试）。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
