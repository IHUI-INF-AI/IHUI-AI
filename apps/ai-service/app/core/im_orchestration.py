# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""IM 消息编排的可审计幂等状态机（round 9 · 席 D）。

立因
----
对照取证：WorkBuddy ``im-napi.node`` 内嵌的幂等消息状态机是**原生不透明件** ——
一次转移产出的结论不可读、幂等键不可追溯、历史不可回放。本仓此前只有一层
**出站去重判据**（``app/services/im/base.py`` 的 ``OutboundGuard``，判「这一条
该不该再发」），缺的是一条**可审计的状态机判据层**：状态从哪来、到哪去、为何
被拒、能否照账重放，全靠调用方自己记。本模块把这段空缺补成一份纯函数事实源。

判据（四条同时成立才在账本里落一行）
------------------------------------
1. **形状先认**：``event`` / ``policy`` / ``ledger`` 三者形状不认或取不到字段 ⇒
   ``unjudged`` + 点名 ``reason``（§0.3：绝不静默放行、绝不冒绿也不冒红）；
   缺 key / 类型错 / 未登记事件种类同归此档。
2. **表驱动转移**：合法边只有 ``TRANSITIONS`` 那几格。``acked`` / ``failed`` 是
   终态，终态再来事件 ⇒ ``denied/out_of_order``（乱序）；非终态但不合法 ⇒
   ``denied/illegal_transition``。只有「认得出的形状违反了状态机」才判 ``denied``。
3. **时效与顺序**：``policy.now_seq - event.at_seq > policy.ttl`` ⇒ ``denied/expired``；
   新事件 ``seq`` 必须等于 ``ledger[-1].seq + 1``（空账为 1），断档 ⇒ ``denied/seq_gap``；
   账内既有行自身断档 / 状态链断裂 ⇒ ``unjudged/ledger_seq_gap``。
4. **幂等优先于顺序**：同 ``idempotency_key`` 且同 ``seq`` 的重放 ⇒ ``duplicate``
   （不入新行、账本原样返回）；同 key 异 seq ⇒ ``denied/idempotency_key_conflict``。
   幂等判定刻意排在 seq 判据之前，否则「重放旧事件」会被误判成断档（§0.10 失效
   方向恒为「多要一次定向说明」，不靠多放一次跳门）。

刻意不做什么
------------
- 不读壁钟、不建连接、不写磁盘：逻辑时钟 ``now_seq`` 由 ``policy`` 注入，纯函数可重放。
- 不复制 ``OutboundGuard`` 的配额 / ``SendStatus`` 四态：那层判「发不发」，本层判
  「状态怎么走、账本怎么记」，两层 verdict 词表刻意各自独立（§0.6 单一真相源）。
- 行内**不另存 kind**：由 ``(from_state, to_state)`` 经 ``TRANSITIONS`` 反查即得，
  避免第二份真相；拒绝 / 未判定的事件**绝不落半行**（失败恒返回原 ledger 对象）。
- 不做重试、不做回滚：拒绝即停，重试由调用方另起一个带新 seq 的事件显式决定。

一轴超越（对照原生不透明件）
----------------------------
每条转移带结构化 verdict + reason、幂等键逐行可追溯、七字段账本可按 seq 与状态链
回放、写入原子（失败不留半行）、形状不认一律 ``unjudged`` 阻断而非放行。
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Final

__all__ = [
    "ACK",
    "ACKED",
    "DELIVER",
    "DELIVERED",
    "FAIL",
    "FAILED",
    "INITIAL_STATE",
    "PENDING",
    "REASON_DUPLICATE",
    "REASON_EVENT_NOT_MAPPING",
    "REASON_EXPIRED",
    "REASON_FIELD_TYPE",
    "REASON_IDEMPOTENCY_CONFLICT",
    "REASON_ILLEGAL_TRANSITION",
    "REASON_LEDGER_NOT_TUPLE",
    "REASON_LEDGER_ROW_SHAPE",
    "REASON_LEDGER_SEQ_GAP",
    "REASON_MISSING_FIELD",
    "REASON_MISSING_IDEMPOTENCY_KEY",
    "REASON_OK",
    "REASON_OUT_OF_ORDER",
    "REASON_POLICY_FIELD",
    "REASON_POLICY_NOT_MAPPING",
    "REASON_SEQ_GAP",
    "REASON_UNKNOWN_STATE",
    "REASON_UNREGISTERED_KIND",
    "REGISTERED_KINDS",
    "STATES",
    "TERMINAL_STATES",
    "TRANSITIONS",
    "VERDICT_APPLIED",
    "VERDICT_DENIED",
    "VERDICT_DUPLICATE",
    "VERDICT_UNJUDGED",
    "apply_event",
    "transition",
]

# ---- 四态词表（不得并桶；与 OutboundGuard.SendStatus 刻意无关） ----
PENDING: Final[str] = "pending"
DELIVERED: Final[str] = "delivered"
ACKED: Final[str] = "acked"
FAILED: Final[str] = "failed"
STATES: Final[frozenset[str]] = frozenset({PENDING, DELIVERED, ACKED, FAILED})
TERMINAL_STATES: Final[frozenset[str]] = frozenset({ACKED, FAILED})
INITIAL_STATE: Final[str] = PENDING

# ---- 事件种类 + 合法转移表（表驱动，模块内唯一真相源） ----
DELIVER: Final[str] = "deliver"
ACK: Final[str] = "ack"
FAIL: Final[str] = "fail"

TRANSITIONS: Final[Mapping[tuple[str, str], str]] = {
    (PENDING, DELIVER): DELIVERED,
    (DELIVERED, ACK): ACKED,
    (PENDING, FAIL): FAILED,
    (DELIVERED, FAIL): FAILED,
}
REGISTERED_KINDS: Final[frozenset[str]] = frozenset({kind for _, kind in TRANSITIONS})
# 行 → 事件种类的反查表：行内刻意不另存 kind（§0.6），回放时由此还原。
_TRANSITION_BY_PAIR: Final[Mapping[tuple[str, str], str]] = {
    (from_state, to_state): kind
    for (from_state, kind), to_state in TRANSITIONS.items()
}

# ---- verdict 词表 ----
VERDICT_APPLIED: Final[str] = "applied"
VERDICT_DUPLICATE: Final[str] = "duplicate"
VERDICT_DENIED: Final[str] = "denied"
VERDICT_UNJUDGED: Final[str] = "unjudged"

# ---- reason 词表（单一真相源：生产与测试都引用常量，不各写字面量） ----
REASON_OK: Final[str] = "ok"
REASON_DUPLICATE: Final[str] = "duplicate"
REASON_IDEMPOTENCY_CONFLICT: Final[str] = "idempotency_key_conflict"
REASON_SEQ_GAP: Final[str] = "seq_gap"
REASON_LEDGER_SEQ_GAP: Final[str] = "ledger_seq_gap"
REASON_EXPIRED: Final[str] = "expired"
REASON_OUT_OF_ORDER: Final[str] = "out_of_order"
REASON_ILLEGAL_TRANSITION: Final[str] = "illegal_transition"
REASON_EVENT_NOT_MAPPING: Final[str] = "event_not_mapping"
REASON_POLICY_NOT_MAPPING: Final[str] = "policy_not_mapping"
REASON_LEDGER_NOT_TUPLE: Final[str] = "ledger_not_tuple"
REASON_LEDGER_ROW_SHAPE: Final[str] = "ledger_row_shape"
REASON_UNKNOWN_STATE: Final[str] = "unknown_state"
REASON_MISSING_FIELD: Final[str] = "missing_field"
REASON_MISSING_IDEMPOTENCY_KEY: Final[str] = "missing_idempotency_key"
REASON_FIELD_TYPE: Final[str] = "field_type_mismatch"
REASON_UNREGISTERED_KIND: Final[str] = "unregistered_kind"
REASON_POLICY_FIELD: Final[str] = "policy_field_invalid"

_EVENT_FIELDS: Final[tuple[str, ...]] = ("seq", "idempotency_key", "kind", "at_seq")
_POLICY_FIELDS: Final[tuple[str, ...]] = ("ttl", "now_seq")
_ROW_FIELDS: Final[tuple[str, ...]] = (
    "seq",
    "idempotency_key",
    "from_state",
    "to_state",
    "verdict",
    "reason",
    "at_seq",
)


def _is_int(value: object) -> bool:
    """bool 是 int 的子类，``True`` 当序号 / 时钟显然不成立（仓内既有口径）。"""
    return isinstance(value, int) and not isinstance(value, bool)


def _verdict(
    verdict: str,
    reason: str,
    *,
    state: str | None = None,
    to_state: str | None = None,
    event: Mapping[str, Any] | None = None,
    detail: Mapping[str, Any] | None = None,
    appended: bool = False,
) -> dict[str, Any]:
    """结构化结论的唯一构造处：字段集固定，负例可机读 ``reason``。"""
    return {
        "verdict": verdict,
        "reason": reason,
        "from_state": state,
        "to_state": to_state,
        "idempotency_key": event.get("idempotency_key") if event else None,
        "kind": event.get("kind") if event else None,
        "seq": event.get("seq") if event else None,
        "at_seq": event.get("at_seq") if event else None,
        "appended": appended,
        "detail": dict(detail) if detail else {},
    }


def _validate_event(event: object) -> tuple[dict[str, Any], dict[str, Any] | None]:
    """形状不认 / 取不到 ⇒ ``unjudged`` + 点名 reason（§0.3，绝不静默吞掉）。

    归一化结果恒为 dict（错误分支给空 dict，调用方先判 err 再用它，绝不会用到）；
    这样返回类型不带可选，mypy strict 无需在调用点 narrow，也不留 ``assert``。
    """
    if not isinstance(event, Mapping):
        return {}, _verdict(VERDICT_UNJUDGED, REASON_EVENT_NOT_MAPPING)
    norm: dict[str, Any] = {}
    for field in _EVENT_FIELDS:
        if field not in event:
            reason = (
                REASON_MISSING_IDEMPOTENCY_KEY
                if field == "idempotency_key"
                else REASON_MISSING_FIELD
            )
            return {}, _verdict(VERDICT_UNJUDGED, reason, detail={"field": field})
        value = event[field]
        if field == "seq":
            if not _is_int(value) or value < 1:
                return {}, _verdict(
                    VERDICT_UNJUDGED,
                    REASON_FIELD_TYPE,
                    detail={"field": field, "expected": "int>=1"},
                )
        elif field == "at_seq":
            if not _is_int(value) or value < 0:
                return {}, _verdict(
                    VERDICT_UNJUDGED,
                    REASON_FIELD_TYPE,
                    detail={"field": field, "expected": "int>=0"},
                )
        elif field == "idempotency_key":
            if not isinstance(value, str):
                return {}, _verdict(
                    VERDICT_UNJUDGED,
                    REASON_FIELD_TYPE,
                    detail={"field": field, "expected": "str"},
                )
            if not value.strip():
                return {}, _verdict(
                    VERDICT_UNJUDGED,
                    REASON_MISSING_IDEMPOTENCY_KEY,
                    detail={"field": field, "expected": "non-empty str"},
                )
        elif field == "kind":
            if not isinstance(value, str) or not value:
                return {}, _verdict(
                    VERDICT_UNJUDGED,
                    REASON_FIELD_TYPE,
                    detail={"field": field, "expected": "non-empty str"},
                )
        norm[field] = value
    # 未登记事件种类属于「形状不认」，按 §0.3 落 unjudged 而非 denied。
    if norm["kind"] not in REGISTERED_KINDS:
        return {}, _verdict(
            VERDICT_UNJUDGED,
            REASON_UNREGISTERED_KIND,
            event=norm,
            detail={"kind": norm["kind"], "registered": sorted(REGISTERED_KINDS)},
        )
    return norm, None


def _validate_policy(policy: object) -> tuple[dict[str, Any], dict[str, Any] | None]:
    """policy 只认带 ``ttl`` / ``now_seq`` 两个非负整数的 Mapping。

    与 ``_validate_event`` 同纪律：归一化结果恒为 dict，错误只在第二分量。
    """
    if not isinstance(policy, Mapping):
        return {}, _verdict(VERDICT_UNJUDGED, REASON_POLICY_NOT_MAPPING)
    norm: dict[str, Any] = {}
    for field in _POLICY_FIELDS:
        if field not in policy:
            return {}, _verdict(
                VERDICT_UNJUDGED,
                REASON_POLICY_FIELD,
                detail={"field": field, "why": "missing"},
            )
        value = policy[field]
        if not _is_int(value) or value < 0:
            return {}, _verdict(
                VERDICT_UNJUDGED,
                REASON_POLICY_FIELD,
                detail={"field": field, "expected": "int>=0"},
            )
        norm[field] = value
    return norm, None


def _validate_ledger(
    ledger: object,
) -> tuple[tuple[Mapping[str, Any], ...], dict[str, Any] | None]:
    """账本只认「七字段、seq 相连、状态链相接、且全为 applied 行」的 tuple。

    错误分支返回空 tuple（调用方先判 err 再用）；结果恒为 tuple，mypy 无需 narrow。
    """
    if not isinstance(ledger, tuple):
        return (), _verdict(VERDICT_UNJUDGED, REASON_LEDGER_NOT_TUPLE)
    rows: list[Mapping[str, Any]] = []
    expected_seq = 1
    previous_to: str | None = None
    for index, row in enumerate(ledger):
        if not isinstance(row, Mapping) or any(field not in row for field in _ROW_FIELDS):
            return (), _verdict(
                VERDICT_UNJUDGED, REASON_LEDGER_ROW_SHAPE, detail={"index": index, "why": "keys"}
            )
        if (
            not isinstance(row["from_state"], str)
            or row["from_state"] not in STATES
            or not isinstance(row["to_state"], str)
            or row["to_state"] not in STATES
            or row["verdict"] != VERDICT_APPLIED
            or row["reason"] != REASON_OK
        ):
            return (), _verdict(
                VERDICT_UNJUDGED, REASON_LEDGER_ROW_SHAPE, detail={"index": index, "why": "values"}
            )
        if not _is_int(row["seq"]) or row["seq"] != expected_seq:
            return (), _verdict(
                VERDICT_UNJUDGED,
                REASON_LEDGER_SEQ_GAP,
                detail={"index": index, "expected_seq": expected_seq, "actual_seq": row["seq"]},
            )
        if previous_to is not None and row["from_state"] != previous_to:
            return (), _verdict(
                VERDICT_UNJUDGED,
                REASON_LEDGER_SEQ_GAP,
                detail={"index": index, "broken_state_chain": row["from_state"]},
            )
        previous_to = row["to_state"]
        expected_seq += 1
        rows.append(row)
    return tuple(rows), None


def _kind_of_row(row: Mapping[str, Any]) -> str | None:
    """由 ``(from_state, to_state)`` 反查事件种类 —— 行内刻意不另存 kind。"""
    return _TRANSITION_BY_PAIR.get((row["from_state"], row["to_state"]))


def _transition(
    event: Mapping[str, Any], policy: Mapping[str, Any], state: str
) -> dict[str, Any]:
    """单步转移核心：时效闸门先于转移表（过期的事件不再讨论状态合法性）。"""
    age = policy["now_seq"] - event["at_seq"]
    if age > policy["ttl"]:
        return _verdict(
            VERDICT_DENIED,
            REASON_EXPIRED,
            state=state,
            to_state=state,
            event=event,
            detail={"age": age, "ttl": policy["ttl"], "now_seq": policy["now_seq"]},
        )
    pair = (state, event["kind"])
    to_state = TRANSITIONS.get(pair)
    if to_state is None:
        reason = REASON_OUT_OF_ORDER if state in TERMINAL_STATES else REASON_ILLEGAL_TRANSITION
        legal_kinds = sorted(kind for (src, kind) in TRANSITIONS if src == state)
        return _verdict(
            VERDICT_DENIED,
            reason,
            state=state,
            to_state=state,
            event=event,
            detail={"state": state, "kind": event["kind"], "legal_kinds": legal_kinds},
        )
    return _verdict(
        VERDICT_APPLIED, REASON_OK, state=state, to_state=to_state, event=event
    )


def transition(state: object, event: object, policy: object) -> dict[str, Any]:
    """单步转移的纯判据（不碰账本），返回结构化 verdict dict。

    立因：把「这一事件在当前状态下合不合法」收成一份可单测、可回放的纯函数；
    ``apply_event`` 只在此之上补账本级判据（幂等 / seq / 原子写）。形状不认一律
    ``unjudged``，认得出但违反状态机才 ``denied``，绝不返回裸布尔。
    """
    norm_event, err = _validate_event(event)
    if err:
        return err
    norm_policy, err = _validate_policy(policy)
    if err:
        return err
    if not isinstance(state, str) or state not in STATES:
        return _verdict(
            VERDICT_UNJUDGED,
            REASON_UNKNOWN_STATE,
            state=state if isinstance(state, str) else None,
            event=norm_event,
            detail={"state": state},
        )
    return _transition(norm_event, norm_policy, state)


def apply_event(
    ledger: object, event: object, policy: object
) -> tuple[object, dict[str, Any]]:
    """把事件应用到不可变账本；失败恒返回**原 ledger 对象**，绝不留半行。

    判据顺序（失效方向恒为「原账不动 + 点名 reason」，§0.10）：
      ① 形状：event / policy / ledger 三者任一不认 ⇒ ``unjudged``；
      ② 幂等：同 key 同 seq 的重放 ⇒ ``duplicate``；同 key 异 seq ⇒ ``denied``；
      ③ 顺序：新事件 seq 必须接上账尾 ⇒ 否则 ``denied/seq_gap``；
      ④ 转移：复用 ``_transition`` 判状态机 / 时效（不复制第二份判据）；
      ⑤ 仅 ``applied`` 才追加整行（原子：要么整行，要么不写）。
    """
    norm_event, err = _validate_event(event)
    if err:
        return ledger, err
    norm_policy, err = _validate_policy(policy)
    if err:
        return ledger, err
    rows, err = _validate_ledger(ledger)
    if err:
        return ledger, err

    key = norm_event["idempotency_key"]
    seq = norm_event["seq"]
    for row in rows:
        if row["idempotency_key"] == key:
            if row["seq"] == seq and _kind_of_row(row) == norm_event["kind"]:
                return ledger, _verdict(
                    VERDICT_DUPLICATE,
                    REASON_DUPLICATE,
                    state=row["from_state"],
                    to_state=row["to_state"],
                    event=norm_event,
                    detail={"matched_seq": seq},
                )
            return ledger, _verdict(
                VERDICT_DENIED,
                REASON_IDEMPOTENCY_CONFLICT,
                event=norm_event,
                detail={"existing_seq": row["seq"], "incoming_seq": seq},
            )

    expected_seq = len(rows) + 1
    if seq != expected_seq:
        return ledger, _verdict(
            VERDICT_DENIED,
            REASON_SEQ_GAP,
            event=norm_event,
            detail={"expected_seq": expected_seq, "actual_seq": seq},
        )

    current_state = rows[-1]["to_state"] if rows else INITIAL_STATE
    verdict = _transition(norm_event, norm_policy, current_state)
    if verdict["verdict"] != VERDICT_APPLIED:
        return ledger, verdict

    new_row: dict[str, Any] = {
        "seq": seq,
        "idempotency_key": key,
        "from_state": verdict["from_state"],
        "to_state": verdict["to_state"],
        "verdict": VERDICT_APPLIED,
        "reason": REASON_OK,
        "at_seq": norm_event["at_seq"],
    }
    return (*rows, new_row), {**verdict, "appended": True}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
