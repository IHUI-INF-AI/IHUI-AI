<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R26 — 模型重路由事件契约（对标 Codex ModelRerouteEvent）

> 逆向-复现-超越 §§0.10/0.11：本报告只读字符串取证，非反混淆。对照形状逐字保真，观察/推断/未知分列。

## 1. 目标

下潜 agent loop **模型重路由**轴：一次改道（请求模型 → 实际用模型）带什么触发源语义。前几轮已确认本仓 `_emit_model_reroute` 生产发射 `model.reroute` 事件，但只带 `requested`/`resolved` 两键，缺 reason 维度。

## 2. 取证（codex.exe 364.8MB strings，逐字锚）

对照物协议层：

- **`struct ModelRerouteEvent with 3 elements`**（逐字），字段 `from_model` / `to_model` / `reason`。
- 事件名映射 `ModelReroute` → `model_reroute`（`EventMsg` 枚举变体）。
- 能力清单配对 `step_model_switching` / `StepModelSwitching`（逐步模型切换能力）。

**reason 值域（strings 观察形态）**：`servererror` / `provider` / `agent` / `user_shell` / `sync` / `async` 相邻出现于 `from_modelto_modelreason` 之后。**注意**：strings 会拼接相邻 struct 字段，这些值是观察到的候选值域，非逐字段确证（诚实边界见 §6）。

## 3. 真空白确认

- 全仓 grep `reroute.*servererror|reroute.*user_shell|RerouteReason|reroute_reason` ai-service **零命中**。
- 本仓 `_emit_model_reroute`（`llm_gateway.py:2525`）发 `{"requested","resolved"}` 两键，**缺 reason**。
- 本仓 `classify_fallback_reason`（`llm_metrics.py:448`）值域是 `timeout/rate_limit/api_error/quota/unknown`——**异常分类轴**，与 Codex reason 的**重路由触发源轴**（servererror/provider/agent/user_shell/sync/async）**零交集**（R26 测试 `test_reason_no_overlap_with_fallback_reason` 钉住）。二者互补不替换。

## 4. 复现交付

`app/core/model_reroute_reason.py` + `tests/test_model_reroute_reason.py`（17 用例）。

- **`RerouteReason`**：七档封闭集（六对照值 + `UNKNOWN` 本仓兜底），StrEnum 逐字值。
- **`ModelRerouteEvent`**：三元素 frozen dataclass（`from_model`/`to_model`/`reason`），逐字对照 `struct ... with 3 elements`。
- **`classify_reroute_reason()`**：唯一判定出口，表驱动优先级链（user_shell > agent > servererror > provider > sync/async > unknown）。
- **`build_reroute_event()`**：唯一构造出口，校验 `to_model` 空串归一化不变量。
- **`event_to_dict()`**：序列化为逐字字段名 dict（可机检）。

## 5. 超越轴（一轴）

对照把 reason 散在协议序列化各处、值域靠字段是否出现隐式区分、无统一判定器；本仓让 reason 由**触发源显式驱动**（单一 `classify_reroute_reason` 纯函数覆盖全部触发源 + `unknown` 兜底档——对照无显式兜底，本仓补齐防误判），可 diff 可单测可挂审计。三元素载荷 `build_reroute_event()` 一次成型。

## 6. 验证实数

- **17 pytest 全过**（含 3 处反向变异：agent/servererror 优先级混淆 / 无触发源误判 sync / reason 与 fallback_reason 两轴值域漂移，均转红）。
- ruff 全绿（--fix 自动修 3 处：W291 末尾空白 + I001 import 排序 + W292 末尾换行）。
- 水印 2/2。

## 7. 诚实边界

- **未接生产路径**（`llm_gateway.py`/`hook_engine.py` 属核心件，接入点留属主）；本模块是语义对照真相源，只补 reason 维度，**不替换** `_emit_model_reroute`（事件发射）与 `classify_fallback_reason`（异常分类轴）。
- **reason 值域是 strings 观察候选，非逐字段确证**：strings 拼接相邻 struct 风险高，`servererror`/`provider`/`agent`/`user_shell`/`sync`/`async` 中哪些确切属 `ModelRerouteEvent.reason`、哪些属相邻 struct，未从二进制确证。
- **优先级链是推定序**（人意志 > 环境 > 主动 > 故障）：对照内部多条件命中时的确切优先表未从二进制确证。
- `step_model_switching` 能力与 `ModelRerouteEvent` 的**配对关系**（逐步切换是否就是重路由的上层能力）未下潜，本轮只取事件契约。
- 接入路径（若属主要求接线）：`_emit_model_reroute` 增 `reason` 参数 + 调用点按 `classify_fallback_reason` 结果映射到 `RerouteReason`。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
