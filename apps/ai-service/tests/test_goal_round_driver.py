# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""B1-06 目标续轮竞争裁决的判据测试(2026-11-27)。

钉住四件事:

  1. **唯一赢家**:无论几条候选,`valid` 至多一个,其余全在 `queued`;
  2. **确定性**:同样候选集跑两次必须同一个赢家(否则"重试"会换赢家,等于没裁决);
  3. **终态不参与**:`consumed` / `cancelled` 已经被用掉,再让它们赢就是同一轮跑第二次;
  4. **畸形候选不拖垮整批**:缺 id 的跳过,其余照常裁决。
"""

from __future__ import annotations

from app.services.goal_round_driver import (
    RESERVATION_CANCELLED,
    RESERVATION_CONSUMED,
    RESERVATION_PENDING,
    RESERVATION_QUEUED,
    RESERVATION_VALID,
    RoundReservation,
    arbitrate,
    coerce_reservation,
    describe_blocked_by,
)


def _r(rid: str, *, round_index: int = 0, created_at: float = 0.0, state: str = RESERVATION_PENDING) -> RoundReservation:
    return RoundReservation(
        reservation_id=rid,
        session_id='s1',
        round_index=round_index,
        created_at=created_at,
        state=state,
    )


def test_empty_candidates_have_no_winner() -> None:
    result = arbitrate([])
    assert result.has_winner() is False
    assert result.queued == ()
    assert result.ignored == ()


def test_none_and_malformed_input_never_raise() -> None:
    assert arbitrate(None).has_winner() is False
    assert arbitrate('not-a-list').has_winner() is False  # type: ignore[arg-type]
    assert arbitrate([None, 42, {}]).has_winner() is False  # type: ignore[list-item]


def test_single_candidate_wins() -> None:
    result = arbitrate([_r('a')])
    assert result.valid is not None
    assert result.valid.reservation_id == 'a'
    assert result.queued == ()


def test_lower_round_index_wins() -> None:
    result = arbitrate([_r('late', round_index=5), _r('early', round_index=2)])
    assert result.valid.reservation_id == 'early'
    assert result.queued_ids() == ('late',)


def test_created_at_breaks_round_index_tie() -> None:
    result = arbitrate(
        [_r('newer', created_at=200.0), _r('older', created_at=100.0)]
    )
    assert result.valid.reservation_id == 'older'


def test_reservation_id_breaks_full_tie() -> None:
    result = arbitrate([_r('zzz'), _r('aaa')])
    assert result.valid.reservation_id == 'aaa'


def test_order_is_deterministic_across_calls() -> None:
    candidates = [_r('b'), _r('a'), _r('c', round_index=1)]
    first = arbitrate(candidates)
    second = arbitrate(candidates)
    assert first.valid.reservation_id == second.valid.reservation_id
    assert first.queued_ids() == second.queued_ids()


def test_terminal_candidates_do_not_participate() -> None:
    result = arbitrate(
        [
            _r('done', state=RESERVATION_CONSUMED),
            _r('live', state=RESERVATION_PENDING),
            _r('gone', state=RESERVATION_CANCELLED),
        ]
    )
    assert result.valid.reservation_id == 'live'
    assert result.queued == ()
    assert {r.reservation_id for r in result.ignored} == {'done', 'gone'}


def test_all_terminal_means_no_winner() -> None:
    result = arbitrate(
        [_r('done', state=RESERVATION_CONSUMED), _r('gone', state=RESERVATION_CANCELLED)]
    )
    assert result.has_winner() is False
    assert len(result.ignored) == 2


def test_duplicate_reservation_id_counts_once() -> None:
    result = arbitrate([_r('a'), _r('a', round_index=9)])
    assert result.valid.reservation_id == 'a'
    assert result.queued == ()


def test_dict_candidates_are_coerced() -> None:
    result = arbitrate(
        [
            {'reservationId': 'x', 'sessionId': 's1', 'roundIndex': 1, 'createdAt': 5.0},
            {'reservation_id': 'y', 'round_index': 0},
        ],
        session_id='s1',
    )
    assert result.valid.reservation_id == 'y'


def test_coerce_requires_reservation_id() -> None:
    assert coerce_reservation({}) is None
    assert coerce_reservation({'reservation_id': '   '}) is None
    assert coerce_reservation(None) is None  # type: ignore[arg-type]


def test_coerce_survives_bad_types() -> None:
    got = coerce_reservation(
        {'reservation_id': 'a', 'round_index': 'oops', 'created_at': True}
    )
    assert got is not None
    assert got.round_index == 0
    assert got.created_at == 0.0


def test_input_list_is_not_mutated() -> None:
    candidates = [_r('b'), _r('a')]
    before = list(candidates)
    arbitrate(candidates)
    assert candidates == before


def test_describe_blocked_by() -> None:
    result = arbitrate([_r('aaa'), _r('bbb')])
    assert describe_blocked_by(result, 'aaa') is None
    reason = describe_blocked_by(result, 'bbb')
    assert reason is not None
    assert 'aaa' in reason
    assert describe_blocked_by(result, 'unknown') is None


def test_to_dict_shape() -> None:
    result = arbitrate([_r('a'), _r('b')])
    d = result.to_dict()
    assert d['valid']['reservation_id'] == 'a'
    assert d['queued'][0]['reservation_id'] == 'b'
    assert d['ignored'] == []


def test_state_constants_are_distinct() -> None:
    states = {
        RESERVATION_PENDING,
        RESERVATION_VALID,
        RESERVATION_QUEUED,
        RESERVATION_CONSUMED,
        RESERVATION_CANCELLED,
    }
    assert len(states) == 5
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
