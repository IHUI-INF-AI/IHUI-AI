# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""IM 可审计幂等状态机的行为钉子（round 9 · 席 D）。

立因
----
对照 ``im-napi.node`` 的原生不透明状态机没有可测结论，本仓缺一条「状态怎么走、
为何被拒、账本能否照 seq 重放」的判据层。本文件用测试把 ``im_orchestration`` 的
两个纯函数钉住：**只断言结构化 verdict + reason，绝不接受裸布尔或静默放行**。

判据
----
- 正例：正常三态链 / 重复幂等 / 失败态 / 回放一致性，必须落整行且七字段齐备；
- 负例：乱序 / 过期 / seq 断档 / 缺 key / 未登记事件 / 类型错 / 形状不认 /
  账本自身断档，必须逐例断言 ``verdict ∈ {denied, unjudged}`` 且 ``reason``
  点名具体原因码，并断言 ``appended is False``、``new_ledger is 原 ledger``；
- §0.3 专用钉：形状不认一律 ``unjudged``，绝不落到 ``applied``。

刻意不做什么
------------
- 不在测试里复制转移表 / 原因码字面量：全部 import 生产模块常量（§0.6 单一真相源，
  第二份判据必然漂移）；唯一例外是「七字段集合」这种对外契约的形状断言。
- 不依赖壁钟 / 网络 / 数据库：逻辑时钟由 ``POLICY`` 固定注入，回放可逐字节比对。
- 不测 ``OutboundGuard``：那层判「发不发」，与本状态机判据不同，不交叉。
"""

from __future__ import annotations

from app.core.im_orchestration import (
    _ROW_FIELDS,
    ACK,
    ACKED,
    DELIVER,
    DELIVERED,
    FAIL,
    FAILED,
    INITIAL_STATE,
    PENDING,
    REASON_DUPLICATE,
    REASON_EVENT_NOT_MAPPING,
    REASON_EXPIRED,
    REASON_FIELD_TYPE,
    REASON_IDEMPOTENCY_CONFLICT,
    REASON_ILLEGAL_TRANSITION,
    REASON_LEDGER_NOT_TUPLE,
    REASON_LEDGER_ROW_SHAPE,
    REASON_LEDGER_SEQ_GAP,
    REASON_MISSING_FIELD,
    REASON_MISSING_IDEMPOTENCY_KEY,
    REASON_OK,
    REASON_OUT_OF_ORDER,
    REASON_POLICY_FIELD,
    REASON_POLICY_NOT_MAPPING,
    REASON_SEQ_GAP,
    REASON_UNKNOWN_STATE,
    REASON_UNREGISTERED_KIND,
    REGISTERED_KINDS,
    STATES,
    TERMINAL_STATES,
    TRANSITIONS,
    VERDICT_APPLIED,
    VERDICT_DENIED,
    VERDICT_DUPLICATE,
    VERDICT_UNJUDGED,
    apply_event,
    transition,
)

# 固定逻辑时钟：纯函数不读壁钟，now_seq / at_seq 全部可重放。
NOW = 100
POLICY = {"ttl": 10, "now_seq": NOW}
ROW_KEYS = frozenset(_ROW_FIELDS)  # 同模块常量，非复制判据


def ev(seq: int, key: str, kind: str, *, at_seq: int = NOW) -> dict:
    """构造一条形状合法的事件；负例在用例里就地删字段 / 换类型。"""
    return {"seq": seq, "idempotency_key": key, "kind": kind, "at_seq": at_seq}


def row(seq: int, key: str, from_state: str, to_state: str) -> dict:
    """构造一条账本行（仅供「账本自身损坏」负例使用，不复制生产判据）。"""
    return {
        "seq": seq,
        "idempotency_key": key,
        "from_state": from_state,
        "to_state": to_state,
        "verdict": VERDICT_APPLIED,
        "reason": REASON_OK,
        "at_seq": NOW,
    }


# ---- 正例 ----


def test_happy_path_three_state_chain():
    """正常三态链：pending → delivered → acked，两跳各落一整行七字段。"""
    ledger = ()
    ledger, v1 = apply_event(ledger, ev(1, "k1", DELIVER), POLICY)
    assert v1["verdict"] == VERDICT_APPLIED
    assert v1["appended"] is True
    ledger, v2 = apply_event(ledger, ev(2, "k2", ACK), POLICY)
    assert v2["verdict"] == VERDICT_APPLIED
    assert len(ledger) == 2
    assert ledger[0]["from_state"] == PENDING == INITIAL_STATE
    assert [r["to_state"] for r in ledger] == [DELIVERED, ACKED]
    assert all(frozenset(r) == ROW_KEYS for r in ledger)
    assert all(r["verdict"] == VERDICT_APPLIED and r["reason"] == REASON_OK for r in ledger)
    assert [r["seq"] for r in ledger] == [1, 2]
    assert all(r["idempotency_key"] for r in ledger)


def test_three_events_with_idempotent_replay():
    """三跳（deliver / ack / 重放 deliver）：第三次幂等，账本仍只有两行。"""
    ledger = ()
    verdicts = []
    for event in (ev(1, "k1", DELIVER), ev(2, "k2", ACK), ev(1, "k1", DELIVER)):
        ledger, verdict = apply_event(ledger, event, POLICY)
        verdicts.append(verdict)
    assert [v["verdict"] for v in verdicts] == [
        VERDICT_APPLIED,
        VERDICT_APPLIED,
        VERDICT_DUPLICATE,
    ]
    assert len(ledger) == 2
    assert ledger[-1]["to_state"] == ACKED


def test_duplicate_event_is_idempotent():
    """重复 event（同 idempotency_key）幂等：不重复入账、原对象返回、reason 点名。"""
    ledger, _ = apply_event((), ev(1, "k1", DELIVER), POLICY)
    before = ledger
    new_ledger, verdict = apply_event(ledger, ev(1, "k1", DELIVER), POLICY)
    assert verdict["verdict"] == VERDICT_DUPLICATE
    assert verdict["reason"] == REASON_DUPLICATE
    assert verdict["appended"] is False
    assert verdict["detail"]["matched_seq"] == 1
    assert new_ledger is before


def test_failure_state_is_terminal():
    """失败态：fail 落 failed 终态；终态再来事件判 out_of_order。"""
    ledger, v = apply_event((), ev(1, "k1", FAIL), POLICY)
    assert v["verdict"] == VERDICT_APPLIED
    assert v["to_state"] == FAILED
    assert ledger[0]["from_state"] == PENDING
    new_ledger, v2 = apply_event(ledger, ev(2, "k2", DELIVER), POLICY)
    assert v2["verdict"] == VERDICT_DENIED
    assert v2["reason"] == REASON_OUT_OF_ORDER
    assert new_ledger is ledger


def test_replay_consistency():
    """回放一致性：同事件序列从空账重放逐字节相同；seq 连续 + 状态链相接 + 终态一致。"""
    events = [ev(1, "k1", DELIVER), ev(2, "k2", ACK)]
    ledger = ()
    for event in events:
        ledger, v = apply_event(ledger, event, POLICY)
        assert v["verdict"] == VERDICT_APPLIED

    replayed = ()
    for event in events:
        replayed, v = apply_event(replayed, event, POLICY)
        assert v["verdict"] == VERDICT_APPLIED
    assert replayed == ledger

    assert [r["seq"] for r in ledger] == list(range(1, len(ledger) + 1))
    for index in range(1, len(ledger)):
        assert ledger[index]["from_state"] == ledger[index - 1]["to_state"]
    assert ledger[0]["from_state"] == INITIAL_STATE
    assert ledger[-1]["to_state"] == ACKED


def test_transition_pure_and_table_driven():
    """transition 纯函数：合法/非法/终态/未知状态各归其档，且不改事件对象。"""
    assert transition(PENDING, ev(1, "k1", DELIVER), POLICY)["to_state"] == DELIVERED
    assert transition(PENDING, ev(1, "k1", ACK), POLICY)["reason"] == REASON_ILLEGAL_TRANSITION
    assert transition(ACKED, ev(1, "k1", DELIVER), POLICY)["reason"] == REASON_OUT_OF_ORDER
    assert transition("weird", ev(1, "k1", DELIVER), POLICY)["reason"] == REASON_UNKNOWN_STATE

    event = ev(1, "k1", DELIVER)
    snapshot = dict(event)
    assert transition(PENDING, event, POLICY) == transition(PENDING, event, POLICY)
    assert event == snapshot

    # 转移表是唯一真相源：登记种类与终态都由它派生，测试不另抄一份。
    assert sorted(REGISTERED_KINDS) == sorted({kind for _, kind in TRANSITIONS})
    assert all(dst in STATES for (src, _), dst in TRANSITIONS.items() if src in STATES)
    assert TERMINAL_STATES <= STATES


# ---- 负例（逐例断言结构化 reason + 原账不动） ----


def test_out_of_order_after_acked_is_denied():
    """乱序：acked 后又 delivered ⇒ denied/out_of_order，reason 点名终态。"""
    ledger, _ = apply_event((), ev(1, "k1", DELIVER), POLICY)
    ledger, _ = apply_event(ledger, ev(2, "k2", ACK), POLICY)
    new_ledger, v = apply_event(ledger, ev(3, "k3", DELIVER), POLICY)
    assert v["verdict"] == VERDICT_DENIED
    assert v["reason"] == REASON_OUT_OF_ORDER
    assert v["detail"]["state"] == ACKED
    assert v["appended"] is False
    assert new_ledger is ledger


def test_expired_event_is_denied():
    """过期：now_seq - at_seq > ttl ⇒ denied/expired，detail 带 age/ttl/now_seq。"""
    expired_policy = {"ttl": 10, "now_seq": 100}
    ledger, v = apply_event((), ev(1, "k1", DELIVER, at_seq=1), expired_policy)
    assert v["verdict"] == VERDICT_DENIED
    assert v["reason"] == REASON_EXPIRED
    assert v["detail"]["age"] == 99
    assert v["detail"]["ttl"] == 10
    assert v["appended"] is False
    assert ledger == ()


def test_seq_gap_is_denied():
    """seq 断档：新事件必须接上账尾，跳过即 denied/seq_gap，原账不动。"""
    ledger, _ = apply_event((), ev(1, "k1", DELIVER), POLICY)
    new_ledger, v = apply_event(ledger, ev(5, "k2", ACK), POLICY)
    assert v["verdict"] == VERDICT_DENIED
    assert v["reason"] == REASON_SEQ_GAP
    assert v["detail"] == {"expected_seq": 2, "actual_seq": 5}
    assert new_ledger is ledger


def test_missing_idempotency_key_is_unjudged():
    """缺 key：形状取不到 ⇒ unjudged + 点名字段；空串同档，绝不静默放行。"""
    for event in (
        {"seq": 1, "kind": DELIVER, "at_seq": NOW},
        ev(1, "", DELIVER),
    ):
        ledger, v = apply_event((), event, POLICY)
        assert v["verdict"] == VERDICT_UNJUDGED
        assert v["reason"] in (REASON_MISSING_IDEMPOTENCY_KEY, REASON_FIELD_TYPE)
        assert v["appended"] is False
        assert ledger == ()

    ledger, v = apply_event((), {"seq": 1, "kind": DELIVER, "at_seq": NOW}, POLICY)
    assert v["reason"] == REASON_MISSING_IDEMPOTENCY_KEY
    assert v["detail"]["field"] == "idempotency_key"


def test_unregistered_kind_is_unjudged():
    """未登记事件种类：形状不认 ⇒ unjudged/unregistered_kind，detail 带登记表。"""
    ledger, v = apply_event((), ev(1, "k1", "nope"), POLICY)
    assert v["verdict"] == VERDICT_UNJUDGED
    assert v["reason"] == REASON_UNREGISTERED_KIND
    assert v["detail"]["kind"] == "nope"
    assert set(v["detail"]["registered"]) == set(REGISTERED_KINDS)
    assert v["appended"] is False
    assert ledger == ()


def test_type_error_is_unjudged():
    """类型错：seq / key / at_seq 类型不对、event 非 Mapping ⇒ unjudged + reason。"""
    bad_events = [
        {"seq": "1", "idempotency_key": "k1", "kind": DELIVER, "at_seq": NOW},
        {"seq": True, "idempotency_key": "k1", "kind": DELIVER, "at_seq": NOW},
        {"seq": 1, "idempotency_key": 7, "kind": DELIVER, "at_seq": NOW},
        {"seq": 1, "idempotency_key": "k1", "kind": DELIVER, "at_seq": -1},
        {"seq": 1, "idempotency_key": "k1", "kind": None, "at_seq": NOW},
        "not-a-mapping",
    ]
    for event in bad_events:
        ledger, v = apply_event((), event, POLICY)
        assert v["verdict"] == VERDICT_UNJUDGED
        assert v["reason"] in (REASON_FIELD_TYPE, REASON_EVENT_NOT_MAPPING)
        assert isinstance(v["reason"], str) and v["reason"]
        assert v["appended"] is False
        assert ledger == ()


def test_shape_not_recognized_never_silently_passes():
    """§0.3 专用钉：event/policy/ledger 任一形状不认 ⇒ unjudged，绝不落成 applied。"""
    cases = [
        ((), "bad-event", POLICY, REASON_EVENT_NOT_MAPPING),
        ((), ev(1, "k1", DELIVER), "bad-policy", REASON_POLICY_NOT_MAPPING),
        ((), ev(1, "k1", DELIVER), {"ttl": -1, "now_seq": NOW}, REASON_POLICY_FIELD),
        ([], ev(1, "k1", DELIVER), POLICY, REASON_LEDGER_NOT_TUPLE),
    ]
    for ledger, event, policy, expected_reason in cases:
        new_ledger, v = apply_event(ledger, event, policy)
        assert v["verdict"] == VERDICT_UNJUDGED
        assert v["reason"] == expected_reason
        assert v["appended"] is False
        assert new_ledger is ledger


def test_failed_apply_returns_original_ledger():
    """失败后 ledger 不变：五类拒绝恒返回原对象，且负例均带结构化 reason。"""
    ledger, _ = apply_event((), ev(1, "k1", DELIVER), POLICY)
    failures = [
        (ev(3, "k2", ACK), POLICY),  # seq 断档
        (ev(2, "k1", ACK), POLICY),  # 同 key 异 seq
        ({"seq": 2, "kind": ACK, "at_seq": NOW}, POLICY),  # 缺 key
        (ev(2, "k2", "nope"), POLICY),  # 未登记
        (ev(2, "k2", DELIVER), {"ttl": -1, "now_seq": NOW}),  # policy 类型错
    ]
    for event, policy in failures:
        new_ledger, v = apply_event(ledger, event, policy)
        assert new_ledger is ledger
        assert v["verdict"] in (VERDICT_DENIED, VERDICT_UNJUDGED)
        assert isinstance(v["reason"], str) and v["reason"]
        assert v["appended"] is False


def test_idempotency_key_conflict_is_denied():
    """同一 idempotency_key 配不同 seq ⇒ denied/idempotency_key_conflict，绝不覆盖。"""
    ledger, _ = apply_event((), ev(1, "k1", DELIVER), POLICY)
    new_ledger, v = apply_event(ledger, ev(2, "k1", ACK), POLICY)
    assert v["verdict"] == VERDICT_DENIED
    assert v["reason"] == REASON_IDEMPOTENCY_CONFLICT
    assert v["detail"]["existing_seq"] == 1
    assert v["detail"]["incoming_seq"] == 2
    assert new_ledger is ledger


def test_corrupted_ledger_is_unjudged():
    """账本自身 seq 断档 / 状态链断裂 / 行形状坏 ⇒ unjudged，原账不动。"""
    gap_ledger = (row(1, "k1", PENDING, DELIVERED), row(3, "k2", DELIVERED, ACKED))
    new_ledger, v = apply_event(gap_ledger, ev(4, "k3", DELIVER), POLICY)
    assert v["verdict"] == VERDICT_UNJUDGED
    assert v["reason"] == REASON_LEDGER_SEQ_GAP
    assert new_ledger is gap_ledger

    broken_chain = (row(1, "k1", PENDING, DELIVERED), row(2, "k2", PENDING, ACKED))
    _, v2 = apply_event(broken_chain, ev(3, "k3", DELIVER), POLICY)
    assert v2["verdict"] == VERDICT_UNJUDGED
    assert v2["reason"] == REASON_LEDGER_SEQ_GAP

    bad_row = ({"seq": 1},)
    _, v3 = apply_event(bad_row, ev(2, "k2", DELIVER), POLICY)
    assert v3["verdict"] == VERDICT_UNJUDGED
    assert v3["reason"] == REASON_LEDGER_ROW_SHAPE


def test_missing_generic_field_is_unjudged():
    """取不到非 key 字段（如缺 at_seq）⇒ unjudged/missing_field，点名字段。"""
    ledger, v = apply_event((), {"seq": 1, "idempotency_key": "k1", "kind": DELIVER}, POLICY)
    assert v["verdict"] == VERDICT_UNJUDGED
    assert v["reason"] == REASON_MISSING_FIELD
    assert v["detail"]["field"] == "at_seq"
    assert ledger == ()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
