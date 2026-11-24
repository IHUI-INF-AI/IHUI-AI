# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


"""回合后压缩阈值校验 —— 遵循统一工程规范。

设计依据（2026-11-18，下潜 外部程序 364.8MB 主引擎，strings 定向抽取）。
对照物 strings 逐字锚::

    model_post_turn_compact_threshold_percent must be between 0 and 100

``model_post_turn_compact_threshold_percent`` 是**回合结束后**触发压缩的阈值（百分比
0..100）。与**回合中**触发压缩的阈值（本仓 ``context_compaction.trigger_ratio``，默认
0.88 = 剩余 <12%）是**两个不同轴**：
- 回合中（in-turn）：上下文压力五判据，剩余不足即压缩，让当前回合能继续；
- 回合后（post-turn）：一轮结束的边界点按百分比阈值决定是否压缩，为下一轮腾窗。

取证纠偏（防后人踩）：对照物只逐字确证了**校验边界**（``must be between 0 and 100``）
与**字段名**；该阈值的**默认值**（如 80？）、确切触发时机（每轮末 vs 每响应末）、与
in-turn ``trigger_ratio`` 的**优先级关系**未从二进制确证，已双重标注。本模块只固化
**可确证的部分**：字段语义（post-turn 百分比阈值）+ 0..100 边界校验。

本仓真空白：全仓 grep ``post_turn_compact`` / ``PostTurnCompact`` **零命中**；
``context_compaction.py`` 只有 in-turn ``trigger_ratio``（0.88），**无 post-turn 分离
阈值**——回合结束后没有独立的压缩判据。本模块补齐 post-turn 阈值校验 + 与 in-turn
的轴区分。

一轴超越：对照把校验散在 config 反序列化（``must be between`` 抛错）；本仓提前为
纯函数 ``validate_post_turn_compact_threshold()``（0..100 边界，越界抛错点名）+
``is_post_turn_compaction_triggered()``（给定 used/limit 百分比判是否触发），并把
post-turn 与 in-turn **两轴显式区分**（不同触发时机、可各自配置），可 diff 可单测。
"""

from __future__ import annotations

from typing import Final

__all__ = [
    "PostTurnCompactThresholdError",
    "validate_post_turn_compact_threshold",
    "is_post_turn_compaction_triggered",
    "DEFAULT_POST_TURN_COMPACT_THRESHOLD_PERCENT",
    "MIN_POST_TURN_COMPACT_THRESHOLD_PERCENT",
    "MAX_POST_TURN_COMPACT_THRESHOLD_PERCENT",
]

#: 对照物只确证边界（0..100），默认值未从二进制确证——本仓取一个保守默认并标注。
DEFAULT_POST_TURN_COMPACT_THRESHOLD_PERCENT: Final = 80.0
MIN_POST_TURN_COMPACT_THRESHOLD_PERCENT: Final = 0.0
MAX_POST_TURN_COMPACT_THRESHOLD_PERCENT: Final = 100.0


class PostTurnCompactThresholdError(ValueError):
    """回合后压缩阈值越界（对照 ``must be between 0 and 100``）。"""


def validate_post_turn_compact_threshold(percent: float) -> float:
    """校验回合后压缩阈值在 0..100（含端点），越界抛 :class:`PostTurnCompactThresholdError`。

    对照物逐字校验串 ``model_post_turn_compact_threshold_percent must be between 0 and 100``。
    非有限数（NaN/inf）同样拒绝。
    """
    if not isinstance(percent, (int, float)) or isinstance(percent, bool):
        raise PostTurnCompactThresholdError(
            f"回合后压缩阈值须为数值，得到 {type(percent).__name__}"
        )
    value = float(percent)
    if value != value or value in (float("inf"), float("-inf")):
        raise PostTurnCompactThresholdError("回合后压缩阈值须为有限数")
    if not (
        MIN_POST_TURN_COMPACT_THRESHOLD_PERCENT
        <= value
        <= MAX_POST_TURN_COMPACT_THRESHOLD_PERCENT
    ):
        raise PostTurnCompactThresholdError(
            f"model_post_turn_compact_threshold_percent must be between 0 and 100, "
            f"得到 {value!r}"
        )
    return value


def is_post_turn_compaction_triggered(
    *,
    used_tokens: float,
    limit_tokens: float,
    threshold_percent: float = DEFAULT_POST_TURN_COMPACT_THRESHOLD_PERCENT,
) -> bool:
    """给定回合末用量与窗口上限，按百分比阈值判是否触发 post-turn 压缩。

    触发条件：``used / limit * 100 >= threshold_percent``（已用占比达阈值即压缩）。
    - 阈值先过 :func:`validate_post_turn_compact_threshold`（越界抛错）；
    - ``limit_tokens <= 0`` ⇒ 未判定，返回 False（不拿 0 分母冒充触发，遵循 §0 铁律 3）；
    - 达阈值（>=）返回 True，未达返回 False。
    """
    validated = validate_post_turn_compact_threshold(threshold_percent)
    if limit_tokens <= 0:
        return False
    used_percent = (used_tokens / limit_tokens) * 100.0
    return used_percent >= validated
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
