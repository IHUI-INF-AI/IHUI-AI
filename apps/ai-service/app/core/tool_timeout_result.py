# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""工具超时的结构化分类(对标 DeepSeek Harness 的 `TOOL_TIMEOUT` 结果码;只取判据不取插件)。

病灶:`AgentLoopV2` 的超时分支只产出一句自由文本「工具执行超时(Ns)」,``error_type`` 统一
``timeout`` —— 无法回答**是谁掐断的**:是 handler 自己声明的预算到点(内层),还是外层
``wait_for`` 守卫(``loop_guard``)或 MCP 守卫(``mcp_guard``)先到。三者混成一个值后,
模型与运维都只能看到"超时"两个字,重试决策与归因都失去依据。

治理原则:
  - **显式来源最高优先**:调用点知道自己是哪一层超时就直接报,不再靠时间推断 ——
    这是"嵌套 deadline 隔离"的唯一可靠做法(内层 handler 自称超时,绝不因为 elapsed
    恰好接近外层守卫而被改写);
  - **时间推断只在无显式来源时用**,且外层窗口优先(外层真到点时 elapsed 一定 ≥ 守卫),
    三个窗口之间有空隙 ⇒ 一律 ``unjudged``,绝不猜成最近的那一档;
  - **文案零变化**:``format_timeout_message`` 逐字复刻旧文案,接线不改变模型看到的内容;
  - **结构化码可流出去**:``timeout_scope_fields`` 供事件/日志携带 ``timeout_scope`` 与
    ``TOOL_TIMEOUT`` 码,失败方向永远是"少一个字段",不是"多一个误判"。
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any, Final

TOOL_TIMEOUT_CODE: Final = "TOOL_TIMEOUT"
TOOL_TIMEOUT_UNJUDGED_CODE: Final = "TOOL_TIMEOUT_UNJUDGED"

SCOPE_HANDLER: Final = "handler"
SCOPE_LOOP_GUARD: Final = "loop_guard"
SCOPE_MCP_GUARD: Final = "mcp_guard"
SCOPE_UNJUDGED: Final = "unjudged"

_EXPLICIT_SCOPES: Final = frozenset({SCOPE_HANDLER, SCOPE_LOOP_GUARD, SCOPE_MCP_GUARD})

#: 秒级比较的容差:预算与 elapsed 都是秒级浮点,严格相等不可依赖。
DEFAULT_EPSILON_S: Final = 0.05


@dataclass(frozen=True)
class TimeoutClassification:
    """一次超时归因(纯数据)。

    - ``scope``:``handler`` / ``loop_guard`` / ``mcp_guard`` / ``unjudged``;
    - ``code``:可流出的结果码(``unjudged`` 有独立码,不与已判定共用);
    - ``reason``:本次判定依据(便于对账,不含用户数据)。
    """

    scope: str
    code: str
    reason: str


def _finite_positive(value: Any) -> float | None:
    """秒数归一:bool / 非数字 / 非有限 / 非正 ⇒ ``None``(未量到)。"""
    if isinstance(value, bool) or value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError, OverflowError):
        return None
    if not math.isfinite(number) or number <= 0:
        return None
    return number


def classify_timeout_scope(
    *,
    reported_by: str | None = None,
    elapsed_s: Any = None,
    budget_s: Any = None,
    loop_guard_s: Any = None,
    mcp_guard_s: Any = None,
    epsilon_s: float = DEFAULT_EPSILON_S,
) -> TimeoutClassification:
    """把一次超时归到具体一层;判不出就 ``unjudged``(绝不含糊成最近的一档)。

    优先级:显式来源 > 外层窗口 > handler 窗口 > 未判定。
    """
    if isinstance(reported_by, str) and reported_by in _EXPLICIT_SCOPES:
        return TimeoutClassification(reported_by, TOOL_TIMEOUT_CODE, "explicit-report")

    elapsed = _finite_positive(elapsed_s)
    if elapsed is None:
        return TimeoutClassification(SCOPE_UNJUDGED, TOOL_TIMEOUT_UNJUDGED_CODE, "elapsed-unmeasured")
    budget = _finite_positive(budget_s)
    if budget is None:
        return TimeoutClassification(SCOPE_UNJUDGED, TOOL_TIMEOUT_UNJUDGED_CODE, "budget-unmeasured")

    try:
        eps = abs(float(epsilon_s))
    except (TypeError, ValueError):
        eps = DEFAULT_EPSILON_S

    loop_guard = _finite_positive(loop_guard_s)
    if loop_guard is not None and elapsed >= loop_guard - eps:
        return TimeoutClassification(SCOPE_LOOP_GUARD, TOOL_TIMEOUT_CODE, "loop-guard-window")

    mcp_guard = _finite_positive(mcp_guard_s)
    if mcp_guard is not None and elapsed >= mcp_guard - eps:
        return TimeoutClassification(SCOPE_MCP_GUARD, TOOL_TIMEOUT_CODE, "mcp-guard-window")

    if abs(elapsed - budget) <= eps:
        return TimeoutClassification(SCOPE_HANDLER, TOOL_TIMEOUT_CODE, "handler-window")

    # 落在窗口之间的空隙:量到了但归不到某一层 —— 宁可未判定,也不猜。
    return TimeoutClassification(SCOPE_UNJUDGED, TOOL_TIMEOUT_UNJUDGED_CODE, "outside-all-windows")


def format_timeout_message(budget_s: float) -> str:
    """模型可见的超时文案;**逐字**保持历史形态(接线不改变任何观感)。"""
    return f"工具执行超时({budget_s:g}s)"


def timeout_scope_fields(classification: TimeoutClassification) -> dict[str, str]:
    """事件/日志要带的两键;``unjudged`` 也带,但码不同 ⇒ 读的人不会把它当成已判定。"""
    return {"timeout_scope": classification.scope, "timeout_code": classification.code}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
