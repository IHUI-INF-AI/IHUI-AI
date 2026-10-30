# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Agent 失败词表的两个缺失维度:**结局二分**与**停摆位置**(2026-10-31 立)。

对齐并超越:对照程序把失败二分成"可重试 / 终局"两档,并在状态枚举里带"停在哪个环节"
的位置词;本模块把这两维做成本仓的**声明式契约**,并补上第三档 ``undetermined`` ——
取不到输入时(错误族未登记、宿主没盖章、上游只给了散文)必须能显式说"这一格没判",
**绝不**把它并进"终局"(AGENTS §0.3:取不到不冒绿也不冒红;§0.10:失效方向恒为多要
一次定向说明,而不是多放一次"重试没用")。

与三个近邻域互不顶账(边界声明,照 ``turn_stop_reason.py`` 的纪律):
- ``turn_stop_reason.TurnStopReason`` 答"回合以哪一档收口"(含 cancelled/paused 这类非失败档);
- ``app/services/agent_loop_v2.py`` 的错误族由 ``_classify_error`` 产出(它是**错误族**的产地,
  本模块只声明"哪些族算可重试 / 哪些族判终局",不再抄一份分类逻辑);
- TS 侧 ``error-serialize.ts`` 的 ``FAILURE_STAGES`` 是"一次 API 调用在哪条请求边界失败",
  与本域"一次 agent 长跑停在哪个环节"是两张表。

跨语言镜像:TS 侧 = ``packages/types/src/agent-failure-vocabulary.ts``。成员集合逐字等值今天由 ``apps/ai-service/tests/test_agent_failure_vocabulary.py`` 钉
(它同时解析 TS 声明面,漂开即红);对账判据的**实现位置只有这一份** —— 不新造第二套判据
实现(§0.6),提交链守门对本域的覆盖作为缺口登记,按 2026-10-07 机主"不扩守门 151 射程"的
同一条纪律另计一票,不挤进既有门。

``*_VALUES`` 两张字面量总表沿用 ``turn_stop_reason.py`` 的既有形态:供静态解析,它与 StrEnum
成员的逐字等值由 pytest 钉死 —— 改任何一侧必须同笔。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final


class AgentFailureOutcome(StrEnum):
    """失败结局三档封闭集(wire 值 = 成员值;``undetermined`` 是显式第三态)。"""

    RETRYABLE = "retryable"
    TERMINAL = "terminal"
    #: 没判 = 取不到可判定的错误族。绝不与 TERMINAL 并桶(见模块 docstring)。
    UNDETERMINED = "undetermined"


class AgentStallStage(StrEnum):
    """停摆位置封闭集。除 ``UNDETERMINED`` 外每档都在 ``STALL_STAGE_SITES`` 有一处真实现场。"""

    LLM_REQUEST = "llm_request"
    TOOL_EXECUTION = "tool_execution"
    APPROVAL_WAIT = "approval_wait"
    ELICITATION_WAIT = "elicitation_wait"
    STREAM_CHANNEL = "stream_channel"
    QUEUE_DISPATCH = "queue_dispatch"
    PERMISSION_GATE = "permission_gate"
    BUDGET_GOVERNANCE = "budget_governance"
    HOOK_PIPELINE = "hook_pipeline"
    DOOM_LOOP_GUARD = "doom_loop_guard"
    UNDETERMINED = "undetermined"


#: 供静态解析的字面量总表(与 AgentFailureOutcome 一一对应;漂移由 pytest 判红)
AGENT_FAILURE_OUTCOME_VALUES: Final[tuple[str, ...]] = (
    "retryable",
    "terminal",
    "undetermined",
)

#: 供静态解析的字面量总表(与 AgentStallStage 一一对应;漂移由 pytest 判红)
AGENT_STALL_STAGE_VALUES: Final[tuple[str, ...]] = (
    "llm_request",
    "tool_execution",
    "approval_wait",
    "elicitation_wait",
    "stream_channel",
    "queue_dispatch",
    "permission_gate",
    "budget_governance",
    "hook_pipeline",
    "doom_loop_guard",
    "undetermined",
)

#: 重试语义安全的那一侧 —— **本表是 retry 闸的唯一取源**(原先住在 agent_loop_v2 的私有
#: frozenset 里,词表没被声明,除那条 if 之外无人能读到"可重试"这个事实)。
AGENT_RETRYABLE_ERROR_FAMILIES: Final[tuple[str, ...]] = (
    "timeout",
    "connection",
    "http_5xx",
)

#: 判定成立才登记:重试不会改变结局的那些错误族(每一族都有生产者,见 pytest 的现场断言)。
AGENT_TERMINAL_ERROR_FAMILIES: Final[tuple[str, ...]] = (
    "http_4xx",
    "cancelled",
    "aborted",
    "user_rejected",
    "permission_denied",
    "approval_timeout",
    "hook_denied",
    "axis_forbid",
    "budget_exceeded",
)

RETRYABLE_ERROR_FAMILY_SET: Final[frozenset[str]] = frozenset(AGENT_RETRYABLE_ERROR_FAMILIES)
_TERMINAL_ERROR_FAMILY_SET: Final[frozenset[str]] = frozenset(AGENT_TERMINAL_ERROR_FAMILIES)
_OUTCOME_SET: Final[frozenset[str]] = frozenset(m.value for m in AgentFailureOutcome)
_STALL_SET: Final[frozenset[str]] = frozenset(m.value for m in AgentStallStage)

#: 每档停摆位置登记的本仓真实现场(相对仓库根):文件 + 文件内必须存在的锚点标识符。
#: ``undetermined`` 刻意不在此表 —— 它是"指不出环节"的显式第三态,不得借任一真实环节冒充。
STALL_STAGE_SITES: Final[dict[str, tuple[str, str]]] = {
    AgentStallStage.LLM_REQUEST.value: (
        "apps/ai-service/app/core/responses_retry.py",
        "decide_stream_retry",
    ),
    AgentStallStage.TOOL_EXECUTION.value: (
        "apps/ai-service/app/services/agent_loop_v2.py",
        "_report_tool_error",
    ),
    AgentStallStage.APPROVAL_WAIT.value: (
        "apps/ai-service/app/core/mcp_tool_approval.py",
        "requires_mcp_tool_approval",
    ),
    AgentStallStage.ELICITATION_WAIT.value: (
        "apps/ai-service/app/core/elicitation_pause.py",
        "wait_until_clear",
    ),
    AgentStallStage.STREAM_CHANNEL.value: (
        "apps/ai-service/app/core/sse_buffer.py",
        "not_resumable",
    ),
    AgentStallStage.QUEUE_DISPATCH.value: (
        "apps/ai-service/app/core/queue_ledger.py",
        "def recover",
    ),
    AgentStallStage.PERMISSION_GATE.value: (
        "apps/ai-service/app/core/permission_axis_gate.py",
        "AxisDecision",
    ),
    AgentStallStage.BUDGET_GOVERNANCE.value: (
        "apps/ai-service/app/services/tool_budget_governor.py",
        "budget_exceeded",
    ),
    AgentStallStage.HOOK_PIPELINE.value: (
        "apps/ai-service/app/core/hook_runtime.py",
        "HookOutcome",
    ),
    AgentStallStage.DOOM_LOOP_GUARD.value: (
        "apps/ai-service/app/core/doom_loop.py",
        "DOOM_ALERT_ROUNDS_TO_TERMINATE",
    ),
}


class AgentStallStageError(ValueError):
    """未登记的停摆位置(封闭集判据点名)。"""


def normalize_agent_failure_outcome(raw: object) -> str | None:
    """任意输入 → 规范结局档;认不出返回 None(不猜、不回退 ``undetermined``)。"""
    if not isinstance(raw, str):
        return None
    key = raw.strip().lower()
    return key if key in _OUTCOME_SET else None


def normalize_agent_stall_stage(raw: object) -> str | None:
    """任意输入 → 规范停摆档;认不出返回 None(同上)。"""
    if not isinstance(raw, str):
        return None
    key = raw.strip().lower()
    return key if key in _STALL_SET else None


def agent_failure_outcome_of(error_family: object) -> str:
    """错误族 → 失败结局(唯一判定出口,纯函数零 IO)。

    判序与 TS 侧逐字同形:命中可重试族 ⇒ ``retryable``;命中终局族 ⇒ ``terminal``;**其余一切**
    (含 ``unknown``、空串、None、宿主盖章的未登记错误码)⇒ ``undetermined``。
    未登记**不等于**不可重试 —— 把它读成 ``terminal`` 就是本模块要消灭的那一侧失真。
    """
    if not isinstance(error_family, str):
        return AgentFailureOutcome.UNDETERMINED.value
    key = error_family.strip().lower()
    if key in RETRYABLE_ERROR_FAMILY_SET:
        return AgentFailureOutcome.RETRYABLE.value
    if key in _TERMINAL_ERROR_FAMILY_SET:
        return AgentFailureOutcome.TERMINAL.value
    return AgentFailureOutcome.UNDETERMINED.value


def is_agent_failure_outcome_judged(outcome: object) -> bool:
    """结局是否为"判出来的";``undetermined`` 恒 False(没判不许读成判过,§0.3)。"""
    return (
        isinstance(outcome, str)
        and outcome in _OUTCOME_SET
        and outcome != AgentFailureOutcome.UNDETERMINED.value
    )


def stall_stage_for_error_family(error_family: object) -> str:
    """只有能由错误族本身指认环节的族才给档,其余一律 ``undetermined``。

    ``approval_timeout`` 是唯一一个"错误族自带环节"的取值(它只可能产自审批等待),
    其余环节的归属由**现场**显式传入,不从错误族反推 —— 反推会把"超时"读成"工具超时",
    而 LLM 请求同样会超时(那是本维立项要消灭的猜测)。
    """
    if not isinstance(error_family, str):
        return AgentStallStage.UNDETERMINED.value
    key = error_family.strip().lower()
    if key == "approval_timeout":
        return AgentStallStage.APPROVAL_WAIT.value
    return AgentStallStage.UNDETERMINED.value


def ensure_agent_stall_stage(value: object) -> str:
    """值域闭合判据:登记过的档位原样放行,未登记 ⇒ 抛 :class:`AgentStallStageError` 点名。

    发射点(审计明细 / done 帧 / 重试事件)在出帧前过这一关:今天全部生产者的取值都在集内
    ⇒ 逐零差异;未来任何一处直接写裸字面量而不先登记 ⇒ 在收口处炸出来点名,不静默放行新档。
    """
    if not isinstance(value, str) or value not in _STALL_SET:
        raise AgentStallStageError(
            f"未登记的停摆位置(封闭集之外): {value!r}"
            " —— 先在 app/core/agent_failure_vocabulary.py 的 AgentStallStage 登记后再产出"
        )
    return value


def stall_stage_site(stage: object) -> tuple[str, str] | None:
    """取登记现场;``undetermined`` 与未登记值一律 None(不替未知值编一处现场)。"""
    if not isinstance(stage, str):
        return None
    return STALL_STAGE_SITES.get(stage)


def failure_signal(
    *,
    success: object,
    last_error_family: object = None,
    stall_stage: object = None,
) -> dict[str, str | None]:
    """把两条已取到的**类型化**信号折成出帧用的两键(判定全在本模块,消费方只搬运)。

    - ``success`` 为真 ⇒ 两键皆 None:一次成功的回合没有"失败结局"可宣告,
      缺席不等于 ``retryable``,更不等于 ``terminal``;
    - 调用方给了 ``stall_stage`` ⇒ 用它(现场比推断可靠);没给时只认错误族自带环节的
      那一档(``approval_timeout``),再退一步是"错误族来自工具结果" ⇒ ``tool_execution``;
      两条都不成立 ⇒ ``undetermined``,**不**从 error 散文反推环节;
    - ``failure_outcome`` 恒由 :func:`agent_failure_outcome_of` 现判:认不出的族落
      ``undetermined``,不借"回合没救回来了"这句直觉把它读成 ``terminal``(§0.3)。

    出帧前两键都过封闭集校验,未登记档位当场抛错点名,不静默放行第四个形态。
    """
    if success is True:
        return {"failure_outcome": None, "stall_stage": None}
    family = last_error_family if isinstance(last_error_family, str) else None
    if not isinstance(stall_stage, str) or stall_stage == "":
        inferred = stall_stage_for_error_family(family)
        if inferred == AgentStallStage.UNDETERMINED.value and family is not None:
            resolved = AgentStallStage.TOOL_EXECUTION.value
        else:
            resolved = inferred
    else:
        resolved = stall_stage
    return {
        "failure_outcome": agent_failure_outcome_of(family),
        "stall_stage": ensure_agent_stall_stage(resolved),
    }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
