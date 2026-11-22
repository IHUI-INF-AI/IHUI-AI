<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R28 · Codex 26.1111 回合细粒度错误码封闭集（kind × 恢复族二维归属）

> 逆向-复现-超越铁律第 ③ 步交付。对照程序：Codex CLI 26.1111 主引擎
> `codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe`（364.8MB，strings 定向抽取，
> 不做全量反编译）。本仓复现：`app/core/turn_error_code.py` + `tests/test_turn_error_code.py`。

## 1. 目标

下潜 agent loop **回合错误分类**轴的细粒度维度。前轮 R18 已对标 `TurnErrorKind` **语义六档**
（interrupted/not_found/shutdown/misalignment/running/errored），但对照物 strings 暴露了远比
六档细的**错误码封闭集**（40+ 码）——本轮取证固化为封闭集 + 每码到「kind × 恢复族」的二维
映射。

## 2. 取证（Evidence）

codex.exe strings 逐字锚（连续 token 拼接形态，18+ 次命中）：

```
activepausedblockedusage_limitedbudget_limitedcomplete
turn_aborted session_budget_exceeded stream content_filter response_incomplete
rate_limit_exceeded context_window_exceeded thread_not_found agent_limit_reached
session_configured_not_first_event timeout request_timeout spawn interrupted
unexpected_status invalid_request model_not_found invalid_prompt tool_collision
invalid_image_request usage_limit_reached server_overloaded policy_capacity_unavailable
flex_unavailable cyber_policy bio_policy misalignment_policy_violation
response_stream_failed connection_failed quota_exceeded usage_not_included
internal_server_error retry_limit internal_agent_died unsupported_operation
refresh_token_failed gateway_login_required fatal io json tokio_join env_var
... active_turn_not_steerable other
```

**取证纠偏（防后人踩，已在模块 docstring + 测试双重标注）**：strings 把**三套枚举**拼成连续块，
本模块只取 **turn 错误码轴**：
- `active/paused/blocked/usage_limited/budget_limited/complete` = 会话/agent **状态轴**（非错误码）；
- `turn_aborted` = turn-abort **事件标记**（其子因才是下列码）；
- `active_turn_not_steerable`/`other` 紧邻错误码块末尾，归入本封闭集。
- 封闭集 43 成员是 **strings 观察候选**（非 schema 逐字段确证）——这些 token 确切是否同一 Rust
  enum 变体、serde rename 为何，未从二进制确证。

## 3. 本仓真空白确认

- `app/core/turn_error_kind.py` 只有六档**语义 kind**，无 40+ 细粒度码；
- `app/core/agent_failure_vocabulary.py` 有**恢复族**（retryable/terminal）但仅 9 族字符串
  （`timeout/rate_limit/http_5xx/...`），粒度粗且无「码→恢复族」一览表；
- 全仓 grep `rate_limit_exceeded|misalignment_policy|active_turn_not_steerable|usage_limit_reached`
  **零命中**（唯一 `rate_limit_exceeded` 在 `mcp_server.py:18602` 是前端 blockedReason 字面量，非封闭集）。
- 结论：本仓缺「细粒度错误码封闭集 + 每码同时映射 kind × 恢复族二维」。

## 4. 复现交付

`app/core/turn_error_code.py` + `tests/test_turn_error_code.py`（34 用例）。

- **`TurnErrorCode`** 43 成员封闭集（`(str, Enum)` + `# noqa: UP042`，逐字对照二进制 token，
  与 `turn_error_kind.py` 同约定：改 StrEnum 会变 `str()` 输出属行为重写）；
- **`RecoveryFamily`** 四档恢复族：`retryable`/`terminal`/`fatal`/`undetermined`。相较
  `agent_failure_vocabulary` 二档**增 `fatal`**（环境/凭据/部署级，重试同请求无效）+
  `undetermined`（没判绝不并桶，遵循 §0 铁律 3）；
- **`TurnErrorCodeClassification`** frozen dataclass：`(code, kind: TurnErrorKind, recovery)`——
  每码**二维归属**；
- **表驱动 `_CODE_MAP`**：43 成员 + `landlock_sandbox_executable_not_provided`（二进制另起 token，
  单独登记不计入成员数）；
- **`classify_turn_error_code()`**：先查枚举成员，再查额外映射，未知/None/空串归 `unknown` +
  `UNDETERMINED`（本仓兜底，对照无显式 unknown 成员）。strip 归一化前后空白。

### 二维映射关键判定（表驱动）

| 码（抽样） | kind | 恢复族 | 依据 |
|---|---|---|---|
| `interrupted` | INTERRUPTED | TERMINAL | 人意志凌驾自动恢复 |
| `thread_not_found`/`model_not_found` | NOT_FOUND | TERMINAL | 资源不存在 |
| `misalignment_policy_violation`/`cyber_policy`/`bio_policy`/`content_filter` | MISALIGNMENT | TERMINAL | 策略对齐拒绝 |
| `rate_limit_exceeded`/`server_overloaded`/`timeout`/`internal_server_error` | ERRORED | RETRYABLE | 对照 error taxonomy 429/5xx ∈ Retryable |
| `session_budget_exceeded`/`usage_limit_reached`/`quota_exceeded` | ERRORED | TERMINAL | 额度耗尽重试不恢复 |
| `refresh_token_failed`/`gateway_login_required`/`internal_agent_died`/`fatal` | ERRORED | FATAL | 凭据/部署级，本仓增 fatal 轴 |

## 5. 一轴超越

对照把 40+ 错误码散在 codex-core 各失败分支（运行时遇到才产出），「该码重试吗、归哪个 kind」
靠**分支位置隐式决定**，无统一映射表；且无 `unknown` 兜底成员、无 `fatal` 与 `terminal` 区分
（凭据失败 vs 策略拒绝在对照里同为不可重试）。本仓：
- 每码（kind × 恢复族）**显式表驱动映射**，单一 `classify_turn_error_code()` 纯函数；
- **增 `fatal` 轴**（凭据/部署级 vs 策略终态 vs 可重试，三维区分）；
- **增 `unknown`/`undetermined` 兜底**（保守不误判，遵循 §0 铁律 3「没判绝不写成判过」）；
- `landlock_*` 二进制另起 token **不强行塞进封闭集**，单独登记映射（成员数守恒 43）。
- 可 diff 可单测可挂审计。

## 6. 验证实数

- **34 pytest 全过**。含 **6 处反向变异**（改坏判据应转红）：rate_limit 误判终态 / budget 误判可重试 /
  unknown 误升级 retryable 或 terminal / misalignment 误判可重试 / interrupted 误判可重试 /
  状态轴 `active` 误识别为错误码——均由封闭集 + 表映射判据守住。
- **`test_landlock_recognized_but_not_in_enum` 首跑转红暴露真 bug**：`classify` 首版只查枚举成员，
  landlock 在 `_CODE_MAP` 但不在枚举被误判 unknown——已修（先查枚举再查额外映射）。这正是
  「先写反向变异/边界测试再实现」的价值：漏接分支当场暴露非事后补。
- **ruff 全绿**（2 处 UP042 `(str,Enum)`→加 `# noqa` 沿用 `turn_error_kind.py` 同约定）。
- **py_compile OK**；**水印 head/tail 2/2**。
- 交付前回读：enum 43 成员 == `_TURN_ERROR_CODE_VALUES` 43；`_CODE_MAP` 44 键（43 + landlock）；
  「漏登记 0 / 多登记仅 landlock（有意）」。

## 7. 诚实边界

- **未接生产路径**（`turn_error_kind.py`/`agent_failure_vocabulary.py` 属核心件，接入点留属主）。
  本模块是**细粒度码真相源**，可被二者引用替换，不替换其现有职责（kind 语义轴 / 恢复族字符串轴）。
- 封闭集 43 成员是 **strings 观察候选非 schema 确证**——token 是否同一 Rust enum 变体、
  serde rename 为何未从二进制确证。
- **（kind × 恢复族）二维归属是本仓推定的工程映射**：对照物未提供「每码二维归属一览表」，
  本仓按错误语义 + 对照 error taxonomy（429/5xx ∈ Retryable）推定，非逐字段确证。
  `fatal` 轴是本仓**主动增补**（对照二档不可重试不区分凭据级 vs 策略级）。
- `landlock_*` 在二进制另起一行相邻，是否与主错误码块同属一个 enum 未确证。
- 会话状态轴（`active/paused/...`）与 `turn_aborted` 事件标记属**另轴**，本轮未下潜。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
