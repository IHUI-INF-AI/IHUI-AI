# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R76: pool byte order is not declaration order, and a pool is only a fragment."""

from __future__ import annotations

import pytest

from app.core.struct_declaration_order import THREAD_DECLARATION_ORDER, TURN_DECLARATION_ORDER
from app.core.struct_pool_order_falsified import (
    FALSIFICATION_ID,
    ORDER_AGREEMENT,
    POOL_IS_FRAGMENT,
    POOL_ORDER_IS_DECLARATION_ORDER,
    THREAD_POOL_COVERAGE,
    THREAD_POOL_EXTRA,
    THREAD_POOL_MISSING,
    THREAD_POOL_ORDER,
    TURN_POOL_COVERAGE,
    TURN_POOL_EXTRA,
    TURN_POOL_MISSING,
    TURN_POOL_ORDER,
    PoolOrderError,
    falsification_summary,
)


def test_pool_order_is_the_r73_segmentation() -> None:
    assert TURN_POOL_ORDER[:3] == ("disabledPluginIds", "clientUserMessageId", "turnTrigger")
    assert THREAD_POOL_ORDER[:2] == ("allowProviderModelFallback", "serviceName")


def test_agreement_is_near_the_random_baseline() -> None:
    for label, (agree, disagree) in ORDER_AGREEMENT.items():
        fraction = agree / (agree + disagree)
        assert 0.30 < fraction < 0.70, label


def test_claim_is_explicitly_denied() -> None:
    assert POOL_ORDER_IS_DECLARATION_ORDER is False
    assert POOL_IS_FRAGMENT is True
    assert FALSIFICATION_ID == "pool-bytes-not-declaration-order"


def test_turn_pool_omits_three_names() -> None:
    assert set(TURN_POOL_MISSING) == {"model", "summary", "threadId"}
    assert TURN_POOL_EXTRA == ("cyberAccessProgram",)


def test_thread_pool_omits_most_of_the_struct() -> None:
    assert len(THREAD_POOL_MISSING) == 17
    assert THREAD_POOL_EXTRA == ()
    assert THREAD_POOL_COVERAGE == (8, 27)


def test_turn_pool_coverage_is_below_arity() -> None:
    assert TURN_POOL_COVERAGE == (23, 28)
    assert TURN_POOL_COVERAGE[0] < TURN_POOL_COVERAGE[1]


def test_summary_matches_the_measures() -> None:
    s = falsification_summary()
    assert s["id"] == FALSIFICATION_ID
    assert s["turn_agree"] == ORDER_AGREEMENT["turn"][0]
    assert s["thread_disagree"] == ORDER_AGREEMENT["thread"][1]
    assert s["turn_pool_missing"] == len(TURN_POOL_MISSING)
    assert s["ordered_threshold_pct"] == 70
    assert isinstance(s["turn_agreement_pct"], float)


def test_declaration_order_is_still_the_only_order() -> None:
    # the pools must not be used as an ordering source: their name sets are smaller and their
    # order disagrees, so the R72 orders stay authoritative
    assert set(TURN_POOL_ORDER) <= set(TURN_DECLARATION_ORDER) | set(TURN_POOL_EXTRA)
    assert len(TURN_DECLARATION_ORDER) == 25
    assert len(THREAD_DECLARATION_ORDER) == 25


def test_validator_rejects_a_pool_that_would_agree(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import struct_pool_order_falsified as mod
    monkeypatch.setattr(mod, "ORDER_AGREEMENT", {"turn": (230, 1), "thread": (1, 27)})
    with pytest.raises(PoolOrderError, match="ordered enough"):
        mod.validate_pool_order_falsification()


def test_validator_rejects_a_complete_pool(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import struct_pool_order_falsified as mod
    monkeypatch.setattr(mod, "TURN_POOL_MISSING", ())
    with pytest.raises(PoolOrderError, match="reported complete"):
        mod.validate_pool_order_falsification()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
