# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""跨进程 agent 级续跑判据(纯函数,唯一真源)。

本模块只做"判":不读时钟、不碰存储、不调工具。`agent_loop_v2` 负责把判定结果落成
写前 checkpoint / 回执,`routers/agents.py` 负责把 BLOCK_CONFIRM 映射成 HTTP 409。

分层口径(与 `durable_resume.tool_ledger` 的区别必须看清):
- `durable_resume.tool_ledger` 从**消息历史**推断"哪些 tool_call 有结果",那是旧口径;
  历史里有结果 ≠ 真的执行过、更 ≠ 结果可恢复。
- 本模块只认**耐久回执**(`tool_state.resume_receipts`)。回执优先于历史;历史里有结果
  但回执说不清的,按 UNVERIFIED 处理 —— 绝不据此伪造成功。

判据(顺序即语义):
1. 回执 `settled_ok` / `settled_error` 且带可读结果载荷 → REPLAY(已完成步骤不重复副作用)。
2. 回执 `attempting`(写了执行意图但没等到 settle)→ UNCERTAIN。有副作用 → 拦确认;
   只读 → 安全重跑。
3. 回执 `not_attempted` → EXECUTE(未完成步骤继续)。
4. 无回执(旧 checkpoint / 回执开关关闭):历史里有结果 → 只读安全重跑,有副作用拦确认
   (UNVERIFIED);历史里无结果 → 按未尝试继续。
5. 参数指纹不一致 → 同一 tool_call_id 不能被当成"那一次已完成";有副作用拦确认
   (ARGS_MISMATCH),只读安全重跑。

无法判定时一律走安全侧:宁可显式要求人工确认,也不静默重复有副作用的操作。
"""

from __future__ import annotations

import hashlib
import json
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any

from .tool_approval_descriptor import OPERATION_SCOPES, _classify_scope

# ---------------------------------------------------------------------------
# 封闭集(新增值必须同时在这里登记,避免自由字符串漂移)
# ---------------------------------------------------------------------------

RECEIPT_STATE_NOT_ATTEMPTED = "not_attempted"
RECEIPT_STATE_ATTEMPTING = "attempting"
RECEIPT_STATE_SETTLED_OK = "settled_ok"
RECEIPT_STATE_SETTLED_ERROR = "settled_error"
RECEIPT_STATES: tuple[str, ...] = (
    RECEIPT_STATE_NOT_ATTEMPTED,
    RECEIPT_STATE_ATTEMPTING,
    RECEIPT_STATE_SETTLED_OK,
    RECEIPT_STATE_SETTLED_ERROR,
)

RESUME_ROUND_PHASE_TOOLS_INFLIGHT = "tools_inflight"
RESUME_ROUND_PHASE_TOOLS_INTERRUPTED = "tools_interrupted"
RESUME_ROUND_PHASE_ROUND_DONE = "round_done"
RESUME_ROUND_PHASES: tuple[str, ...] = (
    RESUME_ROUND_PHASE_TOOLS_INFLIGHT,
    RESUME_ROUND_PHASE_TOOLS_INTERRUPTED,
    RESUME_ROUND_PHASE_ROUND_DONE,
)

STEP_ACTION_REPLAY = "replay"
STEP_ACTION_EXECUTE = "execute"
STEP_ACTION_BLOCK_CONFIRM = "block_confirm"
STEP_ACTIONS: tuple[str, ...] = (
    STEP_ACTION_REPLAY,
    STEP_ACTION_EXECUTE,
    STEP_ACTION_BLOCK_CONFIRM,
)

REASON_REPLAYED_VOUCHER = "REPLAYED_VOUCHER"
REASON_NOT_ATTEMPTED = "NOT_ATTEMPTED"
REASON_COMPLETED_OUTPUT_UNAVAILABLE = "COMPLETED_OUTPUT_UNAVAILABLE"
REASON_UNCERTAIN = "UNCERTAIN"
REASON_UNVERIFIED = "UNVERIFIED"
REASON_ARGS_MISMATCH = "ARGS_MISMATCH"
REASON_READONLY_SAFE_REEXECUTE = "READONLY_SAFE_REEXECUTE"
REASON_LEGACY_UNVERIFIED = "LEGACY_UNVERIFIED"
REASON_CODES: tuple[str, ...] = (
    REASON_REPLAYED_VOUCHER,
    REASON_NOT_ATTEMPTED,
    REASON_COMPLETED_OUTPUT_UNAVAILABLE,
    REASON_UNCERTAIN,
    REASON_UNVERIFIED,
    REASON_ARGS_MISMATCH,
    REASON_READONLY_SAFE_REEXECUTE,
    REASON_LEGACY_UNVERIFIED,
)

CONFIRM_RETRY = "retry"
CONFIRM_SKIP = "skip"
CONFIRM_ACCEPT = "accept"
CONFIRM_ABORT = "abort"
CONFIRMATION_ACTIONS: tuple[str, ...] = (
    CONFIRM_RETRY,
    CONFIRM_SKIP,
    CONFIRM_ACCEPT,
    CONFIRM_ABORT,
)

RECEIPTS_EPOCH = "receipts_v1"

# 用户处置的**真实说明**:两者都不能造成功结果(skip = 未执行,accept = 完成但输出丢失)。
SKIP_RESULT_TEXT = (
    "AGENT_RESUME_SKIP: 该步骤在进程崩溃前未执行,结果未知"
    "(本次按用户确认跳过,未伪造成功结果)"
)
ACCEPT_RESULT_TEXT = (
    "AGENT_RESUME_ACCEPTED_OUTPUT_LOST: 用户已确认该步骤在崩溃前已完成,"
    "但输出不可恢复(不伪造成功结果)"
)

# 只读面:这些作用域在"不确定"时重跑是安全的(不产生外部副作用)。
_READ_ONLY_SCOPES = frozenset({"fs_read"})


# ---------------------------------------------------------------------------
# 工具作用域
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ToolScope:
    """一次工具调用影响哪个面,以及"不确定时能不能安全重跑"。"""

    scope: str
    mutating: bool


def describe_tool_scope(
    tool_name: str, *, read_only_hint: bool | None = None
) -> ToolScope:
    """把工具名归到 `OPERATION_SCOPES`,并给出是否副作用面。

    `read_only_hint` 只认 MCP 注解的 True 值(`app/core/mcp_tool_approval.py`
    的 `ToolAnnotations.read_only_hint`);缺失 / None / False 一律不减免 ——
    "注解没说是只读"不等于只读。`other`(含未知 MCP 工具)按副作用面处理,
    与审批链的保守方向一致:不确定时不静默重复执行。
    """
    scope = _classify_scope(tool_name)
    if scope not in OPERATION_SCOPES:
        scope = "other"
    mutating = True
    if read_only_hint is True or scope in _READ_ONLY_SCOPES:
        mutating = False
    return ToolScope(scope=scope, mutating=mutating)


# ---------------------------------------------------------------------------
# 参数指纹 / 回执
# ---------------------------------------------------------------------------


def canonical_args(args: Any) -> str:
    """参数规范化 JSON(排序键 + 紧凑分隔符),供跨进程指纹比对。"""
    return json.dumps(
        args,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        default=str,
    )


def args_digest(args: Any) -> str:
    """参数指纹(sha256)。**不与 TS 侧 inputDigest 比对**:两侧序列化口径不同。"""
    return hashlib.sha256(canonical_args(args).encode("utf-8")).hexdigest()


def result_digest(result_message: Any) -> str | None:
    """结果载荷指纹;载荷不可序列化时返回 None(调用方按"不可恢复"处理)。"""
    try:
        return hashlib.sha256(
            json.dumps(
                result_message,
                sort_keys=True,
                separators=(",", ":"),
                ensure_ascii=False,
                default=str,
            ).encode("utf-8")
        ).hexdigest()
    except (TypeError, ValueError):
        return None


def summarize_args(args: Any, *, limit: int = 200) -> str:
    """参数摘要(只用于 409 证据面;原文不出进程,截断到 limit 字符)。"""
    try:
        text = canonical_args(args)
    except (TypeError, ValueError):
        text = "<unserializable>"
    return text[:limit]


@dataclass(frozen=True)
class ToolReceipt:
    """单个 tool_call 的耐久回执(落在 `tool_state.resume_receipts.calls`)。"""

    state: str
    scope: str
    mutating: bool
    args_digest: str
    attempt_seq: int
    result_message: dict[str, Any] | None = None
    result_digest: str | None = None
    ledger_id: str = ""
    attempted_at: float | None = None
    settled_at: float | None = None
    resolution: str | None = None

    def __post_init__(self) -> None:
        if self.state not in RECEIPT_STATES:
            raise ValueError(f"非法回执状态: {self.state}")

    @property
    def output_available(self) -> bool:
        return isinstance(self.result_message, dict) and bool(self.result_message)

    def to_dict(self) -> dict[str, Any]:
        return {
            "state": self.state,
            "scope": self.scope,
            "mutating": self.mutating,
            "args_digest": self.args_digest,
            "attempt_seq": self.attempt_seq,
            "result_message": self.result_message,
            "result_digest": self.result_digest,
            "ledger_id": self.ledger_id,
            "attempted_at": self.attempted_at,
            "settled_at": self.settled_at,
            "resolution": self.resolution,
        }

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> ToolReceipt:
        result_message = data.get("result_message")
        return cls(
            state=str(data.get("state") or ""),
            scope=str(data.get("scope") or "other"),
            mutating=bool(data.get("mutating", True)),
            args_digest=str(data.get("args_digest") or ""),
            attempt_seq=int(data.get("attempt_seq") or 0),
            result_message=dict(result_message) if isinstance(result_message, dict) else None,
            result_digest=(
                data.get("result_digest")
                if isinstance(data.get("result_digest"), str)
                else None
            ),
            ledger_id=str(data.get("ledger_id") or ""),
            attempted_at=(
                float(data["attempted_at"])
                if isinstance(data.get("attempted_at"), (int, float))
                else None
            ),
            settled_at=(
                float(data["settled_at"])
                if isinstance(data.get("settled_at"), (int, float))
                else None
            ),
            resolution=(
                str(data["resolution"]) if isinstance(data.get("resolution"), str) else None
            ),
        )


# ---------------------------------------------------------------------------
# 单步判定
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class StepDecision:
    """一个 tool_call 的续跑判定(不含任何 I/O 结论)。"""

    tool_call_id: str
    tool_name: str
    action: str
    reason_code: str
    scope: str
    mutating: bool
    evidence: str

    def __post_init__(self) -> None:
        if self.action not in STEP_ACTIONS:
            raise ValueError(f"非法续跑动作: {self.action}")
        if self.reason_code not in REASON_CODES:
            raise ValueError(f"非法原因码: {self.reason_code}")


def decide_step(
    *,
    tool_call_id: str,
    tool_name: str,
    args: Any,
    receipt: Mapping[str, Any] | None,
    has_history_result: bool,
    read_only_hint: bool | None = None,
) -> StepDecision:
    """单步分档判定(纯函数)。"""
    current = describe_tool_scope(tool_name, read_only_hint=read_only_hint)
    digest = args_digest(args)
    mutating = current.mutating
    scope = current.scope

    def decision(action: str, reason: str, evidence: str) -> StepDecision:
        return StepDecision(
            tool_call_id=tool_call_id,
            tool_name=tool_name,
            action=action,
            reason_code=reason,
            scope=scope,
            mutating=mutating,
            evidence=evidence,
        )

    if receipt is None:
        # 旧 checkpoint / 回执关闭:历史里有结果也不能当凭证。
        if has_history_result:
            if mutating:
                return decision(
                    STEP_ACTION_BLOCK_CONFIRM,
                    REASON_UNVERIFIED,
                    "历史里有该调用的结果,但没有耐久回执;有副作用步骤不得静默重跑",
                )
            return decision(
                STEP_ACTION_EXECUTE,
                REASON_READONLY_SAFE_REEXECUTE,
                "历史里有结果但无耐久回执;只读步骤重跑安全",
            )
        return decision(
            STEP_ACTION_EXECUTE,
            REASON_NOT_ATTEMPTED,
            "历史里没有该调用的结果,且无回执;按未完成步骤继续",
        )

    try:
        parsed = ToolReceipt.from_dict(receipt)
    except ValueError:
        parsed = None

    if parsed is None:
        if mutating:
            return decision(
                STEP_ACTION_BLOCK_CONFIRM,
                REASON_UNVERIFIED,
                "回执结构无法解析;有副作用步骤不得静默重跑",
            )
        return decision(
            STEP_ACTION_EXECUTE,
            REASON_READONLY_SAFE_REEXECUTE,
            "回执结构无法解析;只读步骤重跑安全",
        )

    # 回执本身也声明了副作用面:两侧任一为真即按副作用面处理(fail-closed)。
    mutating = mutating or parsed.mutating
    scope = parsed.scope if parsed.scope in OPERATION_SCOPES else scope

    if parsed.args_digest and parsed.args_digest != digest:
        if mutating:
            return decision(
                STEP_ACTION_BLOCK_CONFIRM,
                REASON_ARGS_MISMATCH,
                "同一 tool_call_id 的参数指纹与回执不一致;不能当成同一次已完成调用",
            )
        return decision(
            STEP_ACTION_EXECUTE,
            REASON_READONLY_SAFE_REEXECUTE,
            "参数指纹与回执不一致;只读步骤重跑安全",
        )

    if parsed.state in (RECEIPT_STATE_SETTLED_OK, RECEIPT_STATE_SETTLED_ERROR):
        if parsed.output_available:
            return decision(
                STEP_ACTION_REPLAY,
                REASON_REPLAYED_VOUCHER,
                f"耐久回执已 settle(state={parsed.state}),结果载荷可恢复",
            )
        if mutating:
            return decision(
                STEP_ACTION_BLOCK_CONFIRM,
                REASON_COMPLETED_OUTPUT_UNAVAILABLE,
                "耐久回执已 settle 但结果载荷不可恢复;有副作用步骤不得伪造成功",
            )
        return decision(
            STEP_ACTION_EXECUTE,
            REASON_READONLY_SAFE_REEXECUTE,
            "回执已 settle 但结果载荷不可恢复;只读步骤重跑安全",
        )

    if parsed.state == RECEIPT_STATE_ATTEMPTING:
        if mutating:
            return decision(
                STEP_ACTION_BLOCK_CONFIRM,
                REASON_UNCERTAIN,
                "写了执行意图但没有 settle:崩溃时可能已产生副作用,结果未知",
            )
        return decision(
            STEP_ACTION_EXECUTE,
            REASON_READONLY_SAFE_REEXECUTE,
            "执行意图未 settle;只读步骤重跑安全",
        )

    # not_attempted(或未知状态按未尝试处理,但未知状态按副作用面保守处理见下)
    if parsed.state == RECEIPT_STATE_NOT_ATTEMPTED:
        return decision(
            STEP_ACTION_EXECUTE,
            REASON_NOT_ATTEMPTED,
            "回执为 not_attempted;未完成步骤继续",
        )

    if mutating:
        return decision(
            STEP_ACTION_BLOCK_CONFIRM,
            REASON_UNVERIFIED,
            f"回执状态 {parsed.state!r} 不在封闭集内;有副作用步骤不得静默重跑",
        )
    return decision(
        STEP_ACTION_EXECUTE,
        REASON_READONLY_SAFE_REEXECUTE,
        "回执状态不在封闭集内;只读步骤重跑安全",
    )


# ---------------------------------------------------------------------------
# 整轮预检
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class RoundPlan:
    """一次"工具执行中崩溃"的整轮预检结论(零执行)。"""

    decisions: tuple[StepDecision, ...]
    blocked: tuple[StepDecision, ...] = field(default_factory=tuple)

    @property
    def needs_confirmation(self) -> bool:
        return bool(self.blocked)


def plan_round_resume(
    *,
    tool_calls: Sequence[Mapping[str, Any]],
    receipts: Mapping[str, Mapping[str, Any]],
    history_results: Mapping[str, bool],
    read_only_hints: Mapping[str, bool | None] | None = None,
) -> RoundPlan:
    """对崩溃轮的全部 tool_call 做一次零执行预检(按原始顺序)。"""
    hints = read_only_hints or {}
    decisions: list[StepDecision] = []
    for raw in tool_calls:
        call_id = raw.get("id")
        if not isinstance(call_id, str) or not call_id:
            # 没有 id 的 tool_call 无法与回执/历史配对;按副作用面拦确认。
            call_id = ""
        name = raw.get("name")
        tool_name = name if isinstance(name, str) else ""
        decisions.append(
            decide_step(
                tool_call_id=call_id,
                tool_name=tool_name,
                args=raw.get("args"),
                receipt=receipts.get(call_id) if call_id else None,
                has_history_result=bool(history_results.get(call_id)) if call_id else False,
                read_only_hint=hints.get(tool_name),
            )
        )
    blocked = tuple(d for d in decisions if d.action == STEP_ACTION_BLOCK_CONFIRM)
    return RoundPlan(decisions=tuple(decisions), blocked=blocked)


class UnknownConfirmationError(ValueError):
    """请求里带了不在本次 blocked 清单内的 tool_call_id(调用方应 400)。"""

    def __init__(self, tool_call_ids: Sequence[str]):
        self.tool_call_ids = list(tool_call_ids)
        super().__init__(
            "resume_confirmations 包含不在本次待确认清单内的 tool_call_id:"
            + ", ".join(self.tool_call_ids)
        )


def resolve_confirmations(
    *,
    blocked: Sequence[StepDecision],
    confirmations: Mapping[str, str] | None,
) -> dict[str, str]:
    """校验并返回本次真正生效的处置(未覆盖的 blocked 仍待确认)。

    - 未知 tool_call_id → `UnknownConfirmationError`(不得静默忽略)。
    - 非法动作值 → ValueError。
    - 缺少某一项 → 保持待确认(由调用方继续 409,不默认放行)。
    """
    blocked_ids = {d.tool_call_id for d in blocked}
    if not confirmations:
        return {}
    unknown = [cid for cid in confirmations if cid not in blocked_ids]
    if unknown:
        raise UnknownConfirmationError(unknown)
    resolved: dict[str, str] = {}
    for call_id, action in confirmations.items():
        if action not in CONFIRMATION_ACTIONS:
            raise ValueError(f"非法续跑处置: {action}")
        resolved[call_id] = action
    return resolved


def build_confirmation_payload(
    *,
    checkpoint_id: str,
    iteration: int,
    blocked: Sequence[StepDecision],
    args_by_call: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """HTTP 409 `AGENT_RESUME_REQUIRES_CONFIRMATION` 的响应体(唯一构造点)。"""
    args = args_by_call or {}
    return {
        "code": "AGENT_RESUME_REQUIRES_CONFIRMATION",
        "checkpoint_id": checkpoint_id,
        "iteration": iteration,
        "blocked": [
            {
                "tool_call_id": d.tool_call_id,
                "tool_name": d.tool_name,
                "scope": d.scope,
                "mutating": d.mutating,
                "action": d.action,
                "reason_code": d.reason_code,
                "args_summary": summarize_args(args.get(d.tool_call_id)),
                "evidence": d.evidence,
            }
            for d in blocked
        ],
        "allowed_decisions": list(CONFIRMATION_ACTIONS),
    }


class ResumeBlockedError(Exception):
    """续跑被安全侧拦下:调用方必须把 `payload` 原样交给用户确认。

    携带结构化载荷是刻意的 —— 上层只做 HTTP 映射,不在路由里重新拼一份 payload,
    否则"拦下"的证据面会长出第二个真相。
    """

    def __init__(self, payload: Mapping[str, Any]):
        self.payload: dict[str, Any] = dict(payload)
        super().__init__(
            f"续跑需要人工确认:checkpoint={self.payload.get('checkpoint_id')} "
            f"blocked={len(self.payload.get('blocked') or [])}"
        )
