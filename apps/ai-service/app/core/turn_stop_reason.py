# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""回合终态档位的封闭集(G-815977,2026-10-08 立)。

上游对照:`core/src/agent/turn-machine.ts` 的 `transition()` 对非法相位
`throw createCoreError(CoreErrorType.InvalidTurnPhase, …)`;本模块是同一纪律在
ai-service 侧的落点 —— done 帧 `stop_reason` 的取值在此**声明为封闭集**,未登记
档位一律抛 :class:`TurnStopReasonError` 点名,不允许任何消费面凭空再写第 4 份
字面量(此前 `verification_undetermined` 一档就有三处各写一次)。

`cancelled` / `canceled` 两式刻意**同档收编**:V1 消费端(routers/agents.py
`_v2_result_to_execute_payload`)对两种拼写都归到既有取值上,这是对旧客户端的
刻意兼容,收口不得清零任何一式(对外契约)。

跨语言对齐:TS 侧对齐表 = `packages/types/src/agent-runtime.ts` 的
`AGENT_TURN_STOP_REASONS`(等值由守门 151 的 SV5 判;没有门看守的登记表必然
腐烂)。本文件里 :data:`TURN_STOP_REASON_VALUES` 是供该门**静态解析**的字面量
总表,它与 StrEnum 成员的逐字等值由 pytest 钉死 —— 改任何一侧必须同笔。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final


class TurnStopReason(StrEnum):
    """回合终态档位封闭集(wire 值 = 成员值;对外契约,不得改名/删成员)。"""

    COMPLETED = "completed"
    #: 新拼写(V2 循环 _LoopInterrupted / 轮次边界取消产出)
    CANCELLED = "cancelled"
    #: 旧拼写(V1 兼容档;消费端两式都认 —— 见模块 docstring,收口不清零)
    CANCELED = "canceled"
    PAUSED = "paused"
    ERROR = "error"
    MAX_ITERATIONS = "max_iterations"
    BUDGET_EXCEEDED = "budget_exceeded"
    #: goal_completion_gate.BUDGET_STOP_REASONS 早已认这一档(§8 budget 语义)
    BUDGET_LIMITED = "budget_limited"
    #: 以下三档仅在声明了硬性指标(goal 模式)时由校验闸门覆盖进 done 帧
    VERIFICATION_NOT_ACHIEVED = "verification_not_achieved"
    VERIFICATION_UNDETERMINED = "verification_undetermined"
    GOAL_BLOCKED = "goal_blocked"


#: 供守门 151 SV5 静态解析的字面量总表(与上面成员一一对应;漂移由 pytest 钉死)
TURN_STOP_REASON_VALUES: Final[tuple[str, ...]] = (
    "completed",
    "cancelled",
    "canceled",
    "paused",
    "error",
    "max_iterations",
    "budget_exceeded",
    "budget_limited",
    "verification_not_achieved",
    "verification_undetermined",
    "goal_blocked",
)

_CLOSED_SET: Final[frozenset[str]] = frozenset(m.value for m in TurnStopReason)


class TurnStopReasonError(ValueError):
    """未登记的回合终态档位(封闭集判据点名)。"""


def ensure_turn_stop_reason(value: str) -> str:
    """值域闭合判据:登记过的档位原样放行,未登记 ⇒ 抛 :class:`TurnStopReasonError`。

    done 帧装配点(routers/agents.py)在发射前过这一关:今天全部生产者的取值都在
    集内 ⇒ 逐零差异;未来任何一处直接写裸字面量而不先登记 ⇒ 在收口处炸出来点名,
    而不是静默放行一个新的档位。
    """
    if not isinstance(value, str) or value not in _CLOSED_SET:
        raise TurnStopReasonError(
            f"未登记的回合终态档位(stop_reason 封闭集之外): {value!r}"
            f" —— 先在 app/core/turn_stop_reason.py 的 TurnStopReason 登记后再产出"
        )
    return value
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
