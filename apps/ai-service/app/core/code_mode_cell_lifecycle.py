# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""code-mode cell 生命周期状态机 + 并发 delegate 边界(round 10)。

立因(对照 Codex 26.1111 ``codex-code-mode-host.exe`` 的 cell-actor 治理)
----------------------------------------------------------------
前几轮取证发现:本仓 ``run_code``(``agent_engine.py`` 的 code-mode 常驻会话)
是**串行阻塞**的——一次 ``tools.call`` 阻塞到返回,cell 的"生命周期"是隐式的
``_code_sessions[sid]`` dict + 一把 asyncio.Lock,执行边界分散在几个模块级常量里
(``_CODE_SESSION_TTL`` / ``_CODE_MAX_TIMEOUT_MS`` / ``_CODE_MAX_NESTED_TOOL_CALLS``)。

对照 Codex 26.1111 的 code-mode 宿主(``cell_actor/types.rs`` + ``delegate.rs``),
它的治理是**显式**的:cell 有明确状态机(admission → started → outcome → closed,
外加 abandoned),delegate(把一次工具调用转交宿主执行)有 **会话级 + 宿主级两层
并发上限**,事件走有界队列的**背压**语义。错误串精确列出这套边界:
``cell_execution_limits`` / ``too many pending delegate calls``(session 级 + host
级)/ ``event queue is full`` / ``runtime reused an active cell ID`` /
``closed before cell admission`` / ``execution was abandoned``。

本模块把这套**并发生命周期治理**复现成本仓的一层**纯函数判据**——和
``code_exec_sandbox.py`` 同范式(三态 verdict + 规则 id + 逐条 evidence),
但管的是**编排面**(cell 状态迁移合法性 + 并发 delegate/订阅/队列边界),
不是执行面(不碰进程、不碰 vm、不真跑代码)。

刻意不做什么(边界必须说清)
---------------------------
* **不引入 V8 / 不换 JS**:Codex 用 V8 因其 Code Mode 目标语言是 JS;本仓引擎栈
  是 Python,复用 Python 合理,引入 V8 是负价值。语言选型不是差距,
  **并发生命周期治理**才是——这正是本模块的射程。
* **不执行代码、不真起 cell、不碰进程**:本层是治理判据,输入是"想做一个动作"
  (开 cell / 发 delegate / 关 cell),输出是结构化 verdict。真执行是
  ``agent_engine.py`` 那一层。
* **不碰在飞文件**:本模块是**独立新文件**,不改 ``agent_engine.py``(在飞件)、
  不改 ``code_exec_sandbox.py``(本仓已有的准入层);生产接线留待在飞件冷却。
* **失效方向恒为"多要一次定向说明"**:形状不认 / 状态迁移不合法 / 边界超限
  ⇒ 一律 ``unjudged`` 或 ``denied`` 并点名原因(§0.3:"没判"绝不写成"判过";
  §0.10:不"多放一次跳门")。

一轴超越(对照只靠提示词 + 隐式 dict)
------------------------------------
对照的治理散在常量与提示词里,结论不可 diff、并发语义靠"碰运气不超"。本仓把
cell 状态机与并发边界钉成**纯函数 + 结构化 verdict + 逐条带原因的 findings**,
测试可直接断言每个状态迁移、每条边界、每个 reason;零第三方依赖、零执行、
零副作用。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

# ---------------------------------------------------------------------------
# 三态 verdict(与 code_exec_sandbox.py 同范式)
# ---------------------------------------------------------------------------
VERDICT_ALLOWED = "allowed"
VERDICT_DENIED = "denied"
VERDICT_UNJUDGED = "unjudged"

# ---------------------------------------------------------------------------
# cell 生命周期状态(对标 cell_actor/types.rs 的状态枚举)
# ---------------------------------------------------------------------------
# 一个 cell(一次代码执行)的显式状态。Codex 的状态机:
#   admission(准入/排队)→ started(执行中)→ outcome(出结果)→ closed(关闭)
# 任何环节都可被中断 → abandoned(放弃,如超时击杀 / 客户端取消)。
CELL_STATE_ADMISSION = "admission"
CELL_STATE_STARTED = "started"
CELL_STATE_OUTCOME = "outcome"
CELL_STATE_CLOSED = "closed"
CELL_STATE_ABANDONED = "abandoned"

ALL_CELL_STATES = frozenset({
    CELL_STATE_ADMISSION, CELL_STATE_STARTED, CELL_STATE_OUTCOME,
    CELL_STATE_CLOSED, CELL_STATE_ABANDONED,
})

# 终态:到这两态的迁移不应再发生(除非是显式 reset 建新 cell)
_TERMINAL_STATES = frozenset({CELL_STATE_CLOSED, CELL_STATE_ABANDONED})

# 合法迁移表(现态 → 允许迁往的态集合)。这张表就是"cell 状态机"的唯一真相源。
# admission  可 admission(重排队)/ started(开跑)/ abandoned(准入前就被砍)
# started    可 outcome(正常出结果)/ abandoned(超时/取消)
# outcome    可 closed(正常收尾)/ abandoned(收尾时被砍)
# closed     终态 —— 只能显式 reset 建新 cell,不能原地复活
# abandoned  终态 —— 同上
_CELL_TRANSITIONS: dict[str, frozenset[str]] = {
    CELL_STATE_ADMISSION: frozenset({CELL_STATE_ADMISSION, CELL_STATE_STARTED, CELL_STATE_ABANDONED}),
    CELL_STATE_STARTED: frozenset({CELL_STATE_OUTCOME, CELL_STATE_ABANDONED}),
    CELL_STATE_OUTCOME: frozenset({CELL_STATE_CLOSED, CELL_STATE_ABANDONED}),
    CELL_STATE_CLOSED: frozenset(),
    CELL_STATE_ABANDONED: frozenset(),
}

# ---------------------------------------------------------------------------
# 规则 id(每条 finding 的 rule)
# ---------------------------------------------------------------------------
RULE_BAD_STATE = "R-CELL-BAD-STATE"              # 现态形状不认(不是合法状态)
RULE_ILLEGAL_TRANSITION = "R-CELL-ILLEGAL-TRANSITION"  # 状态迁移不合法(如 closed 复活)
RULE_TERMINAL_REVIVE = "R-CELL-TERMINAL-REVIVE"  # 试图复活终态 cell
RULE_DUPLICATE_CELL_ID = "R-CELL-DUPLICATE-ID"   # 复用活跃 cell ID(runtime reused an active cell ID)
RULE_BEFORE_ADMISSION = "R-CELL-BEFORE-ADMISSION"  # closed before cell admission

RULE_DELEGATE_SESSION_CAP = "R-DELEGATE-SESSION-CAP"  # 会话级 pending delegate 上限
RULE_DELEGATE_HOST_CAP = "R-DELEGATE-HOST-CAP"        # 宿主级 pending delegate 上限
RULE_SUBSCRIPTION_CAP = "R-DELEGATE-SUBSCRIPTION-CAP"  # 工具订阅数上限
RULE_QUEUE_FULL = "R-DELEGATE-QUEUE-FULL"             # 事件队列背压(full)

# 执行边界(对标 cell_execution_limits):统一治理结构,不散在多个常量
RULE_EXEC_TIMEOUT_CAP = "R-EXEC-TIMEOUT-CAP"
RULE_EXEC_OUTPUT_CAP = "R-EXEC-OUTPUT-CAP"
RULE_EXEC_SHAPE = "R-EXEC-UNJUDGED-SHAPE"  # limits 形状坏 ⇒ unjudged,绝不回退猜

# ---------------------------------------------------------------------------
# 显式执行边界(对标 cell_execution_limits):单一治理结构
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class CellExecutionLimits:
    """一个 code-mode cell 的执行边界。

    对照 Codex 的 ``cell_execution_limits``:本仓原来这些值散在
    ``agent_engine.py`` 的模块常量里(``_CODE_DEFAULT_TIMEOUT_MS`` /
    ``_CODE_OUTPUT_HEAD`` …),现在收成**一个可校验、可 diff 的结构**。
    """
    timeout_ms: int = 60_000
    max_timeout_ms: int = 300_000
    output_head: int = 4_000
    output_tail: int = 12_000
    # delegate 并发边界(两层,对标 Codex session/host 两级 pending 上限)
    max_pending_delegates_per_session: int = 8
    max_pending_delegates_per_host: int = 32
    max_tool_subscriptions_per_session: int = 16
    max_event_queue: int = 256
    max_concurrent_cells: int = 4  # 对标本仓 _MAX_CODE_SESSIONS


DEFAULT_CELL_LIMITS = CellExecutionLimits()


# ---------------------------------------------------------------------------
# findings
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class Finding:
    rule: str
    reason: str
    evidence: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class Verdict:
    verdict: str
    findings: tuple[Finding, ...] = ()
    # 迁移/开 cell 成功后的**下一态**(allowed 时才有意义)
    next_state: str | None = None


# ---------------------------------------------------------------------------
# 判据 1:cell 状态迁移合法性
# ---------------------------------------------------------------------------
def decide_cell_transition(
    current_state: str,
    target_state: str,
    cell_id: str = "",
    active_cell_ids: frozenset[str] | set[str] = frozenset(),
) -> Verdict:
    """判"能否把 cell 从 current_state 迁到 target_state"。

    active_cell_ids = 当前仍活跃(非终态)的 cell ID 集,用于查重
    (对标 Codex ``runtime reused an active cell ID``)。
    """
    findings: list[Finding] = []

    if current_state not in ALL_CELL_STATES:
        return Verdict(
            VERDICT_UNJUDGED,
            (Finding(RULE_BAD_STATE, f"现态形状不认: {current_state!r}",
                     {"current_state": current_state}),),
        )
    if target_state not in ALL_CELL_STATES:
        return Verdict(
            VERDICT_UNJUDGED,
            (Finding(RULE_BAD_STATE, f"目标态形状不认: {target_state!r}",
                     {"target_state": target_state}),),
        )

    allowed = _CELL_TRANSITIONS[current_state]
    if target_state not in allowed:
        if current_state in _TERMINAL_STATES:
            findings.append(Finding(
                RULE_TERMINAL_REVIVE,
                f"试图复活终态 cell({current_state} → {target_state});"
                "终态只能显式 reset 建新 cell,不能原地复活",
                {"current_state": current_state, "target_state": target_state},
            ))
        else:
            findings.append(Finding(
                RULE_ILLEGAL_TRANSITION,
                f"状态迁移不合法: {current_state} → {target_state}"
                f"(允许 {sorted(allowed)})",
                {"current_state": current_state, "target_state": target_state},
            ))
        return Verdict(VERDICT_DENIED, tuple(findings))

    # 迁移到 started(真正开跑)时才查 cell ID 重复 —— 准入态可重排队不占新 ID
    if target_state == CELL_STATE_STARTED and cell_id and cell_id in active_cell_ids:
        return Verdict(VERDICT_DENIED, (
            Finding(RULE_DUPLICATE_CELL_ID,
                    f"复用活跃 cell ID: {cell_id}(对标 Codex "
                    "'runtime reused an active cell ID')",
                    {"cell_id": cell_id}),),
        )

    return Verdict(VERDICT_ALLOWED, (), next_state=target_state)


# ---------------------------------------------------------------------------
# 判据 2:并发 delegate 边界(对标 Codex delegate.rs 的两级 pending 上限 + 队列背压)
# ---------------------------------------------------------------------------
def decide_delegate_admission(
    limits: CellExecutionLimits,
    session_pending_delegates: int,
    host_pending_delegates: int,
    tool_subscriptions: int = 0,
    event_queue_len: int = 0,
) -> Verdict:
    """判"能否再发一个 delegate(把一次工具调用转交宿主执行)"。

    对照 Codex 错误串的两级上限 + 队列背压:
    - ``code-mode session has too many pending delegate calls``(会话级)
    - ``code-mode host has too many pending delegate calls``(宿主级)
    - ``code-mode session has too many tool subscriptions``
    - ``code-mode session event queue is full``

    取不到任一计数(负数 / 非 int / bool)⇒ ``unjudged``,绝不猜(§0.3)。
    多级上限**逐条报**:哪怕会话级已超,也照样报宿主级是否超,给全量证据。
    """
    findings: list[Finding] = []

    counts = {
        "session_pending_delegates": session_pending_delegates,
        "host_pending_delegates": host_pending_delegates,
        "tool_subscriptions": tool_subscriptions,
        "event_queue_len": event_queue_len,
    }
    bad_shape = [
        k for k, v in counts.items()
        if isinstance(v, bool) or not isinstance(v, int) or v < 0
    ]
    if bad_shape:
        return Verdict(VERDICT_UNJUDGED, (
            Finding(RULE_EXEC_SHAPE,
                    "delegate 计数形状不认(负数/非 int/bool): " + repr(bad_shape),
                    {**counts, "bad_fields": bad_shape}),),
        )

    caps = (
        (session_pending_delegates, limits.max_pending_delegates_per_session,
         RULE_DELEGATE_SESSION_CAP, "会话级 pending delegate 超上限"),
        (host_pending_delegates, limits.max_pending_delegates_per_host,
         RULE_DELEGATE_HOST_CAP, "宿主级 pending delegate 超上限"),
        (tool_subscriptions, limits.max_tool_subscriptions_per_session,
         RULE_SUBSCRIPTION_CAP, "工具订阅数超上限"),
        (event_queue_len, limits.max_event_queue,
         RULE_QUEUE_FULL, "事件队列已满(背压)"),
    )
    for current, cap, rule, msg in caps:
        if current >= cap:
            findings.append(Finding(rule, msg, {"current": current, "cap": cap}))

    if findings:
        return Verdict(VERDICT_DENIED, tuple(findings))
    return Verdict(VERDICT_ALLOWED, ())


# ---------------------------------------------------------------------------
# 判据 3:执行边界(cell_execution_limits)校验
# ---------------------------------------------------------------------------
def validate_execution_limits(limits: Any) -> Verdict:
    """校验一组执行边界是否形状合法且互相一致。

    对照 Codex ``invalid code-mode session execution limits``:边界结构本身坏
    (timeout <= 0 / head+tail 非正 / timeout 超 max)⇒ 整组不可信,判 ``unjudged``,
    绝不回退到"猜一组默认值继续判"(§0.3;白名单制最硬的一格)。
    """
    if not isinstance(limits, CellExecutionLimits):
        return Verdict(VERDICT_UNJUDGED, (
            Finding(RULE_EXEC_SHAPE,
                    "执行边界形状不认(非 CellExecutionLimits): "
                    + type(limits).__name__,
                    {"got": type(limits).__name__}),),
        )

    findings: list[Finding] = []
    checks = (
        (limits.timeout_ms, RULE_EXEC_TIMEOUT_CAP, "timeout_ms", 1),
        (limits.max_timeout_ms, RULE_EXEC_TIMEOUT_CAP, "max_timeout_ms", 1),
        (limits.output_head, RULE_EXEC_OUTPUT_CAP, "output_head", 1),
        (limits.output_tail, RULE_EXEC_OUTPUT_CAP, "output_tail", 1),
    )
    for value, rule, name, floor in checks:
        if isinstance(value, bool) or not isinstance(value, int) or value < floor:
            findings.append(Finding(rule,
                                    "执行边界 " + name + " 非法(需 ≥" + str(floor) + "): "
                                    + repr(value),
                                    {"field": name, "value": value}))

    if limits.timeout_ms > limits.max_timeout_ms:
        findings.append(Finding(RULE_EXEC_TIMEOUT_CAP,
                                "timeout_ms(" + str(limits.timeout_ms)
                                + ") 超过 max_timeout_ms(" + str(limits.max_timeout_ms) + ")",
                                {"timeout_ms": limits.timeout_ms,
                                 "max_timeout_ms": limits.max_timeout_ms}))

    if findings:
        return Verdict(VERDICT_UNJUDGED, tuple(findings))
    return Verdict(VERDICT_ALLOWED, ())


def clip_output(text: str, limits: CellExecutionLimits) -> str:
    """按执行边界做输出 head+tail 截断(对标 Codex ``output_truncation``)。

    与本仓 ``_CODE_OUTPUT_HEAD``/``_CODE_OUTPUT_TAIL`` 语义一致:中间省略部分用
    标记注明实际丢弃字节数,给模型一个可读的"被截断"信号。纯函数、无副作用。
    """
    if not isinstance(text, str):
        return ""
    head, tail = limits.output_head, limits.output_tail
    total = head + tail
    if len(text) <= total:
        return text
    omitted = len(text) - total
    middle = "\n…[输出截断:中间省略 " + str(omitted) + " 字节]…\n"
    return text[:head] + middle + (text[-tail:] if tail else "")
