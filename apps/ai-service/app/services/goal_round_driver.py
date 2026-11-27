# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""目标续轮的竞争裁决(B1-06,2026-11-27 立)。

## 立因

`app/routers/agents.py::_should_goal_rerun()` 是**无状态纯谓词** —— 给定本轮结果与
`goal_round_state` 账本,判"要不要自动起下一轮"。它对单请求是对的,对并发是错的:

两个请求(或两条 SSE 连接)在同一时刻各自读到"`goal_status=not_achieved` 且预算还有余量",
两边都判 True,于是**同一会话被起两轮**。后果不是"多跑一次"这么轻:

- 轮次预算被双倍消耗 —— 账本上 `rounds_used` 加两次,用户看到"明明只跑了一次却少了两次额度";
- 两条 trace 交织写同一个 checkpoint 账本,后写的覆盖先写的,谁都不完整;
- 工具副作用可能被执行两遍(写文件、发请求),且第二遍基于第一遍的半成品状态。

本模块补的正是这一格:**候选列表进,唯一赢家出,其余标 `competing_queued`。**

## 裁决必须确定性

同样的候选集,两次调用必须选出同一个赢家。否则"重试"会换赢家 —— 那等于没有裁决,
只是把冲突从"同时起两轮"挪成"先后起两轮"。

判序(不依赖字典/列表之外的任何隐式顺序):

  1. **已终态**(`consumed` / `cancelled`)的候选**不参与** —— 它们已经用掉了自己那一轮,
     再让它们赢就是把同一轮跑第二次;
  2. 其余候选按 `(round_index 升序, created_at 升序, reservation_id 字典序)` 排,
     取第一个做 `valid_reservation` —— 三个键都是整数/字符串,不涉及时间精度抖动;
  3. 剩下全部 `competing_queued`,并在 `blocked_by` 里写明被谁挡下 —— **可诊断**,
     不是静默排队(静默排队会让调用方以为自己在等一个不存在的机会)。

## 纯判据

不读写账本、不起任务、不碰会话。给定候选列表返回裁决结果,可独立单测。
真正的"写回账本 + 起一轮"由调用方做 —— 本模块只负责判定谁有资格。
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any

#: 候选刚登记、还没被裁决过。
RESERVATION_PENDING = "pending"
#: 本轮的赢家。
RESERVATION_VALID = "valid_reservation"
#: 有资格但本轮输给了别人,排队等下一轮。
RESERVATION_QUEUED = "competing_queued"
#: 这一轮已经跑完(终态,不再参与裁决)。
RESERVATION_CONSUMED = "consumed"
#: 显式取消(终态)。
RESERVATION_CANCELLED = "cancelled"

_TERMINAL_STATES = frozenset({RESERVATION_CONSUMED, RESERVATION_CANCELLED})


@dataclass(frozen=True)
class RoundReservation:
    """一个续轮候选。

    `round_index` 是它**想要**跑的那一轮编号(从 0 起);`created_at` 是登记时刻
    (秒,单调即可,不要求墙钟精度);`state` 取本模块的五个常量之一。
    """

    reservation_id: str
    session_id: str
    round_index: int = 0
    created_at: float = 0.0
    state: str = RESERVATION_PENDING

    def is_terminal(self) -> bool:
        """是否已终态(用掉或被取消),不再参与裁决。"""
        return self.state in _TERMINAL_STATES

    def _order_key(self) -> tuple[int, float, str]:
        return (self.round_index, self.created_at, self.reservation_id)

    def to_dict(self) -> dict[str, Any]:
        return {
            "reservation_id": self.reservation_id,
            "session_id": self.session_id,
            "round_index": self.round_index,
            "created_at": self.created_at,
            "state": self.state,
        }


@dataclass(frozen=True)
class ArbitrationResult:
    """一次裁决的结果。

    - `valid`:本轮唯一赢家(可能为 `None` —— 全部终态或没有候选);
    - `queued`:有资格但没赢的候选;
    - `ignored`:终态候选(不参与裁决,单独列出来供审计)。
    """

    valid: RoundReservation | None = None
    queued: tuple[RoundReservation, ...] = field(default_factory=tuple)
    ignored: tuple[RoundReservation, ...] = field(default_factory=tuple)

    def has_winner(self) -> bool:
        return self.valid is not None

    def queued_ids(self) -> tuple[str, ...]:
        return tuple(r.reservation_id for r in self.queued)

    def to_dict(self) -> dict[str, Any]:
        return {
            "valid": self.valid.to_dict() if self.valid is not None else None,
            "queued": [r.to_dict() for r in self.queued],
            "ignored": [r.to_dict() for r in self.ignored],
        }


def _as_float(value: Any, default: float) -> float:
    if isinstance(value, bool):
        return default
    try:
        got = float(value)
    except (TypeError, ValueError, OverflowError):
        return default
    return got


def _as_int(value: Any, default: int) -> int:
    if isinstance(value, bool):
        return default
    try:
        return int(value)
    except (TypeError, ValueError, OverflowError):
        return default


def coerce_reservation(raw: Mapping[str, Any] | None, *, session_id: str = "") -> RoundReservation | None:
    """把外部来的 dict 收敛成 `RoundReservation`;缺 `reservation_id` 返回 `None`。

    不抛异常:裁决器要能在"上游给了一条畸形候选"时继续裁决其余候选,
    而不是整批失败。
    """
    if not isinstance(raw, Mapping):
        return None
    rid = str(raw.get("reservation_id") or raw.get("reservationId") or "").strip()
    if not rid:
        return None
    state = str(raw.get("state") or RESERVATION_PENDING).strip() or RESERVATION_PENDING
    return RoundReservation(
        reservation_id=rid,
        session_id=str(raw.get("session_id") or raw.get("sessionId") or session_id or "").strip(),
        round_index=_as_int(raw.get("round_index", raw.get("roundIndex")), 0),
        created_at=_as_float(raw.get("created_at", raw.get("createdAt")), 0.0),
        state=state,
    )


def arbitrate(
    candidates: Sequence[RoundReservation | Mapping[str, Any]] | None,
    *,
    session_id: str = "",
) -> ArbitrationResult:
    """在候选里选出**唯一**的 `valid_reservation`,其余标 `competing_queued`。

    - 入参可以是 `RoundReservation` 或 dict(后者走 `coerce_reservation`);
    - 同一条候选重复出现(同一 `reservation_id`)只算一次,保留第一次出现的那个 ——
      "重试把候选追加了两遍"是常见形态,不该让同一 id 既赢又排队;
    - 全部终态或无候选 ⇒ `valid=None`, `queued` 为空,`ignored` 列出终态的那些。

    纯函数:不改入参、不排序入参列表(`sorted()` 返回新列表)。
    """
    if not isinstance(candidates, Sequence) or isinstance(candidates, (str, bytes)):
        return ArbitrationResult()

    seen: dict[str, RoundReservation] = {}
    for raw in candidates:
        if isinstance(raw, RoundReservation):
            item: RoundReservation | None = raw
        else:
            item = coerce_reservation(raw, session_id=session_id)
        if item is None:
            continue
        if item.reservation_id in seen:
            continue
        seen[item.reservation_id] = item

    ignored = tuple(r for r in seen.values() if r.is_terminal())
    live = [r for r in seen.values() if not r.is_terminal()]
    if not live:
        return ArbitrationResult(valid=None, queued=(), ignored=ignored)

    live.sort(key=lambda r: r._order_key())
    winner = live[0]
    queued = tuple(live[1:])
    return ArbitrationResult(valid=winner, queued=queued, ignored=ignored)


def describe_blocked_by(result: ArbitrationResult, reservation_id: str) -> str | None:
    """给一条排队中的候选返回"被谁挡下"的一句话(供日志/事件面点名)。"""
    if result.valid is None:
        return None
    if reservation_id == result.valid.reservation_id:
        return None
    for r in result.queued:
        if r.reservation_id == reservation_id:
            return (
                f"本轮赢家是 {result.valid.reservation_id}"
                f"(round_index={result.valid.round_index},"
                f"created_at={result.valid.created_at})"
            )
    return None


__all__ = [
    "ArbitrationResult",
    "RESERVATION_CANCELLED",
    "RESERVATION_CONSUMED",
    "RESERVATION_PENDING",
    "RESERVATION_QUEUED",
    "RESERVATION_VALID",
    "RoundReservation",
    "arbitrate",
    "coerce_reservation",
    "describe_blocked_by",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
