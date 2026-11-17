<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R31 · Codex 26.1111 auto-compact 上限作用域 + 回合后压缩阈值（双维）

> 逆向-复现-超越铁律第 ③ 步交付。对照程序：Codex CLI 26.1111 主引擎
> `codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe`（364.8MB，strings 定向抽取）。
> 本仓复现：`app/core/auto_compact_limit_scope.py` + `app/core/post_turn_compact_threshold.py`
> + 两个测试文件（34 用例）。

## 1. 目标

下潜 agent loop **上下文压缩（auto-compact）**轴的两个细分维度：① token 上限的**作用域**
（`LimitScope`）② **回合后**压缩阈值（`model_post_turn_compact_threshold_percent`）。
前轮已对标 auto-compact 窗口账本（`auto_compact_window.py`）与 in-turn 触发阈值
（`context_compaction.py` trigger_ratio=0.88），本轮补两处空白。

## 2. 取证（Evidence）

codex.exe strings 逐字锚：

**维度① LimitScope（作用域）**
```
LimitScope total body
auto_compact_token_limit_scope ... auto_compact_limit_scope auto_compact_scope_limit
```
`LimitScope` 是 auto-compact `token_limit` 的作用域枚举，两档逐字确证：`total`（全窗口口径，
prefix 挤占 body 预算）/ `body`（body 口径，prefix 不挤占，body 独享）。

**维度② post-turn 阈值**
```
model_post_turn_compact_threshold_percent must be between 0 and 100
```
回合结束后触发压缩的百分比阈值，校验边界逐字确证 0..100。

**取证纠偏（防后人踩，模块 docstring + 测试双重标注）**：
- 维度①：`LimitScopetotalbody` 是 enum 名 + 两变体拼成连续块；是否有第三档（如 `prefix`）
  未确证，只收逐字确证的两档；serde rename 未确证。
- 维度②：只确证**校验边界**（0..100）+ 字段名；**默认值**（取 80 并标注为推定）、触发时机
  （每轮末 vs 每响应末）、与 in-turn `trigger_ratio` 的优先级未确证。

## 3. 本仓真空白确认

- **维度①**：`auto_compact_window.py`/`context_compaction.py` 有窗口账本与触发阈值，但 token
  上限的**作用域口径**（total vs body）全仓 grep `LimitScope|limit_scope` **零命中**——消费面
  无法声明/校验「上限按全窗口还是按 body 计」；
- **维度②**：全仓 grep `post_turn_compact` **零命中**；`context_compaction.py` 只有 in-turn
  `trigger_ratio`（0.88），无 post-turn 分离阈值；
- 结论：两维均真空白。

## 4. 复现交付

**`app/core/auto_compact_limit_scope.py` + `tests/test_auto_compact_limit_scope.py`（16 用例）**
- `AutoCompactLimitScope` 两档 StrEnum（`TOTAL`/`BODY`，对齐 `turn_stop_reason` 同纪律）；
- `AUTO_COMPACT_LIMIT_SCOPE_VALUES` 字面量总表（供守门静态解析）；
- `ensure_auto_compact_limit_scope()` 值域闭合判据（未登记抛错点名）；
- `prefix_counts_toward_limit()`/`body_shares_limit_with_prefix()`：分母口径纯函数
  （total ⇒ prefix 计入/挤占；body ⇒ prefix 排除/独享；未登记抛错遵循 §0 铁律 3）。

**`app/core/post_turn_compact_threshold.py` + `tests/test_post_turn_compact_threshold.py`（18 用例）**
- `validate_post_turn_compact_threshold()`：0..100 边界校验（逐字对照 `must be between 0 and 100`），
  拒 NaN/inf/bool/非数值；
- `is_post_turn_compaction_triggered()`：`used/limit*100 >= threshold` 触发判据（`>=` 语义）；
  `limit<=0` 未判定返回 False 不冒充触发；
- 边界常量 `MIN/MAX/DEFAULT`（默认 80 标注为推定）；
- **两轴显式区分**：post-turn（回合后边界点）≠ in-turn `trigger_ratio`（回合中压力五判据）。

## 5. 一轴超越

对照把两维散在 config 序列化与 compact 预算分支（运行时遇到才区分，校验靠反序列化抛错），
无统一封闭集/判据；本仓：作用域**显式封闭集 + 分母口径纯函数**；post-turn 阈值**边界校验 +
触发判据纯函数**；post-turn 与 in-turn **两轴显式分离**（不同触发时机可各自配置）；未登记
档位抛错不静默放行。可 diff 可单测可挂预算前置。

## 6. 验证实数

- **34 pytest 全过**（16 + 18）。含反向变异：维度① total 误判不计 prefix / body 误判计 prefix；
  维度② 边界放宽 >100 / `>=` 改 `>`（达阈值不触发）/ 0 分母误触发——均由封闭集 + 判据守住。
- **ruff 全绿**（--fix 修 1 处 import 排序）；**py_compile OK**；**水印 2/2**（两模块）。
- 交付前回读：两模块 34 用例复跑全过；`_PressureInput` 死代码与未用 `dataclass` import
  已在写盘后主动移除（先写后审发现）。

## 7. 诚实边界

- **未接生产路径**（`auto_compact_window.py`/`context_compaction.py` 属核心件，接入点留属主）。
  两模块是**作用域/阈值真相源**，不改动现有窗口账本与 trigger_ratio 职责。
- **维度①** 两档逐字确证，但「是否有第三档」「serde rename」未确证；分母口径语义
  （total/body 对 prefix 的处理）是按字段名 + 对照 config 推定的工程映射。
- **维度②** 默认值 80 是**本仓推定**（对照未确证）；触发时机（每轮末 vs 每响应末）与
  in-turn `trigger_ratio` 的**优先级/共存关系**未下潜；`>=` 触发语义是本仓推定（对照只确证边界）。
- 两维是否与已有 `auto_compact_window.py`/`context_compaction.py` 的**配对关系**（作用域如何
  喂给窗口账本、post-turn 阈值与 trigger_ratio 谁先谁后）未下潜。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
