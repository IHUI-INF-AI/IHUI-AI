<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# Codex 26.1111 TurnError kind 封闭集 取证报告（Round 18）

**目标**：MSIX `OpenAI.Codex_26.1111.2228.0_x64__2p2nqsd0c76g0`。下潜 R13 §4 最后一项——
`turn_timing.rs` failure phase 全分支，本轮完成关键**归属区分**并定位最后一个可抽纯函数。

## 1. 取证方法

自写 Node 流式 strings 扫描器（BigInt 安全偏移），对 codex.exe 364.8MB 定向抽取 failure
phase 文案 + `TurnError` struct + kind 枚举。全程只读，未粘专有源码。

## 2. 关键发现一：failure phase 全分支归属纠偏（防后人重踩）

初扫命中的 `from the '..' phase` / `orchestrator is transitioning to the 'failure' phase`
/ `throwing away previous error` / `retry strategy` / `request checkpoint` / `wasn't
cloneable` **全部属 AWS `aws-smithy-runtime` client orchestrator**（cargo registry 路径
`aws-smithy-runtime-1.9.5\src\client\orchestrator.rs` 在案）——**非 Codex 自有**。

这印证并强化了 R15 的纠偏：**Rust 引擎里的 phase/failure/retry 机器大多来自它引用的 AWS
SDK，不是 Codex loop 行为逻辑**。下潜前必须先看 cargo 路径归属，不能见 `failure phase`
字样就当 Codex 自有。

## 3. 关键发现二：Codex 自有的 failure 语义 = TurnError kind 封闭集

Codex **自有**的失败语义载体是 `struct TurnError with 4 elements` + `turn_error` /
`codex_error_kind` / `codex_error_info` 字段，kind 六值封闭集：

```
Running · Interrupted · Errored · Shutdown · NotFound · Misalignment
```

abort 档两个已知子因（归 ERRORED）：`turn aborted. Something went wrong?` /
`budget reached` / `stream disconnected before completion`。

### 与本仓两轴严格区分（防冗余）

| 本仓模块 | 轴 | 关系 |
|---|---|---|
| `session_store.TurnStatus` | 生命周期状态机（running/completed/interrupted/failed + 迁移表） | **不同轴**，非等价 |
| `agent_failure_vocabulary` | 错误→恢复族（retryable/terminal/undetermined） | **另一层** |
| `thread_originator.THREAD_NOT_FOUND` | NotFound 单点 | 已覆盖该 kind |

**真空白确认**：`Misalignment`（策略对齐拒绝）全仓无对应语义——这是 Codex 独有类别，
grep `misalign` 命中的全是 fork 边界对齐/向量维度对齐/文档段落对齐，无一为「策略对齐拒绝」。

## 4. 复现交付

`apps/ai-service/app/core/turn_error_kind.py` + `tests/test_turn_error_kind.py`（11 用例）。

- `TurnErrorKind`：六值封闭集。
- `TurnError`：kind + codex_error_info + additional_details（对标 struct 4 元素）。
- `classify_turn_error()`：6 条优先级链（interrupted 最优先 → not_found → shutdown →
  misalignment → running → errored）。

## 5. 一轴超越

对照把 kind 判定散在 codex-core 各事件分支（运行时遇到才归类），且 **Misalignment 与普通
Errored 靠 codex_error_info 是否带策略明细区分、无显式判据**。本仓让 `Misalignment` 由
`misaligned=True` 显式驱动（不再靠「有无明细」隐式猜），可 diff 可单测可挂回合收尾前置。
中断最优先（人意志凌驾自动恢复）显式化为链首。

## 6. 诚实边界

- **未接生产路径**：`agent_failure_vocabulary` / `session_store` 属核心在飞件，接入点留属主。
- `TurnErrorKind` 是**语义对照真相源**，**不替换** `session_store.TurnStatus`（生命周期轴）
  与 `agent_failure_vocabulary`（恢复族轴）——三轴互补。
- failure phase 的 AWS SDK 分支（§2）**不复现**（第三方所有物，非 Codex loop 逻辑）。
- kind 优先级是按「人意志 > 资源 > 关闭 > 策略 > 在跑 > 一般」推定，对照内部确切优先序
  （多条件同时命中时 Codex 先判哪个）未从二进制确证——这是**推定序**，非逐字取证的优先表。

## 7. 验证实数

- 11 pytest 全过（含 2 处反向变异：Misalignment 并入 Errored / 中断不最优先，均转红）。
- ruff 全绿（修 1 处 C408 dict()→字面量，本仓第 4 处同类）。
- 水印 2/2。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
