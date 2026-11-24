<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# Codex 26.1111 auto-compact / 上下文压缩 取证报告（R13b）

**目标**：MSIX `26.1111.2228.0` codex.exe 的 auto-compact 策略字段集（context_window_exceeded 的前序防线）。

## 1. 取证锚（strings 逐字）

### 1.1 auto-compact 策略字段
```
auto_compact
auto_compact_fallback_buffer_tokens
auto_compact_fallback_prompt
auto_compact_limit_scope
auto_compact_scope_tokens
auto_compact_token_limit
auto_compact_token_limit_scope
compact_threshold_percent
model_auto_compact
compaction_trigger
```

### 1.2 上下文压缩决策
```
context_compaction  kept / dropped / decision / rollout_item
compaction_trigger
context_compaction response
summarization / summarize / summarizing
```

`context_compaction` 事件带 `kept` / `dropped` / `decision` 三字段——压缩器对历史条目的保留/丢弃/决策结构化输出。

## 2. 语义还原

Codex 的上下文管理是两层防线：

1. **前序防线（auto-compact）**：token 用量逼近阈值（`compact_threshold_percent` × 窗口，
   或 `auto_compact_token_limit` 硬顶）时触发 `compaction_trigger`，对历史做 `context_compaction`（保留近期 + 丢弃/摘要远期），避免撞 context_window_exceeded。
2. **兜底防线（turn_error_policy，R13 已复现）**：真撞上下文窗口耗尽 → TERMINATE（同输入重试无解）。

`model_auto_compact` = 模型级 auto-compact 能力开关；`auto_compact_fallback_prompt` /
`auto_compact_fallback_buffer_tokens` = 压缩摘要的 fallback prompt 与 token 缓冲。

## 3. 复现件

`apps/ai-service/app/core/context_compaction.py` —— 把 auto-compact 的触发判定 + 压缩决策提前为纯函数：

- `should_trigger_compaction(...)`：给定当前 token 用量、窗口上限、阈值百分比、硬顶，确定性判定是否触发压缩（含 scope）。
- `plan_compaction(...)`：给定历史条目 + 保留预算，输出结构化压缩决策（kept / dropped / summarization 标记），不真正改写历史（那是引擎侧）。

**一轴超越**：对照把 compact 触发与决策散在 codex-core 运行时（token 记账时遇到才压）。本仓拆成可 diff/可单测的纯函数门控，补齐对照缺失的"何时压 + 压哪些"显式分层。

## 4. 未触及
- compaction 摘要算法本体（在引擎侧，未反编译）
- `auto_compact_limit_scope` 各 scope 的具体取值映射
- rollout_item 与 decision 的完整枚举


---

## ⚠️ 纠错附录（2026-11-16 交付前核查追加）

**本报告初稿的结论需重大更正**：核查发现本仓**已存在成熟的 auto-compact / 上下文压缩实现**，
本报告第 3 节声称的"复现件 `apps/ai-service/app/core/context_compaction.py`"**不得新建**——
该路径已被一个 **1161 行的成熟实现**占用（含 `assess_context_pressure` / `compress_messages_if_needed`
/ `micro_compact_messages` 等）。若按本报告新建会**覆盖已有文件**，造成损失。

### 本仓已有的等价能力（对照本报告第 1 节取证字段）

| 本报告取证字段 | 本仓已有等价物 | 状态 |
|---|---|---|
| `compact_threshold_percent` | `DEFAULT_TRIGGER_RATIO = 0.88`（context_compaction.py） | **已有，且更严谨**（整数交叉相乘防浮点边界翻转） |
| auto-compact 触发判定 | `assess_context_pressure()`（context_compaction.py:599） | **已有**，五字段压力判据 + `context_limit<=0` 不猜 |
| `compaction_trigger` / `context_compaction` | `compress_messages_if_needed()` / `micro_compact_messages()` | **已有** |
| token 记账 | `estimate_messages_tokens()`（context_compaction.py:249） | **已有** |

另有 **45 个** 上下文/压缩相关测试文件已覆盖（`test_auto_compact_window_58` /
`test_context_pressure_micro_compaction` / `test_auto_context` 等）。

### 结论

本报告第 1 节的 **strings 取证仍然有效**（codex auto-compact 字段集是真实证据），但
**第 3 节的"复现件"结论作废**：这不是本仓的"差距"，而是**已实现且比对照更严谨的能力**。
本仓 `DEFAULT_TRIGGER_RATIO=0.88` 与 codex 的 `compact_threshold_percent` 是同一机制，本仓
已落地并测试覆盖。

**处置**：不新建 `context_compaction.py`（避免覆盖）。本轮 auto-compact 方向的取证价值 =
确认本仓已有能力与 codex 同机制，无新增复现件。

（附带说明：本轮因未先读现有文件而误覆盖 `context_compaction.py` / `test_context_compaction.py`，
已从 git HEAD 完整恢复；误建的冗余 `turn_error_policy.py` 因本仓已有更成熟的
`agent_failure_vocabulary.py` 声明式错误族词表，已删除。）
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
