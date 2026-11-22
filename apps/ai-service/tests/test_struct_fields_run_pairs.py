# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R80: structures paired with their FIELDS record arrays."""

from __future__ import annotations

import pytest

from app.core.struct_fields_run_pairs import (
    EXACT_PAIR_COUNT,
    FIELDS_RUNS,
    ORDER_DIFFERS,
    ORDER_MATCHES_POOL,
    RECORD_ORDER_IS_DECLARATION,
    RECORD_RUNS,
    THREAD_FULL_RUN_FOUND,
    TRIPLE_ATTESTED,
    TURN_FULL_RUN_FOUND,
    TURN_VARIANT_RUN,
    FieldsRunError,
    fields_run_summary,
    order_of,
)
from app.core.struct_strict_reconstruction import STRICT_STRUCTURES


def test_pair_table_is_self_consistent() -> None:
    assert len(FIELDS_RUNS) == EXACT_PAIR_COUNT == 65
    assert ORDER_MATCHES_POOL + len(ORDER_DIFFERS) == EXACT_PAIR_COUNT
    assert RECORD_RUNS == 4005


def test_every_array_matches_the_reconstruction() -> None:
    for name, (_address, order) in FIELDS_RUNS.items():
        assert len(order) == STRICT_STRUCTURES[name][0], name
        assert set(order) == set(STRICT_STRUCTURES[name][1]), name


def test_most_record_orders_equal_the_pool_order() -> None:
    assert ORDER_MATCHES_POOL == 62
    assert ORDER_MATCHES_POOL / EXACT_PAIR_COUNT > 0.9


def test_the_three_differences_are_recorded() -> None:
    assert ORDER_DIFFERS == ("ErrorData", "Failure", "SetupErrorReport")
    assert order_of("ErrorData") == ("code", "data", "message")
    assert order_of("Failure") == ("message", "code")


def test_turn_thread_claim_stays_undetermined() -> None:
    assert RECORD_ORDER_IS_DECLARATION == "undetermined_for_turn_and_thread"
    assert TURN_FULL_RUN_FOUND is False
    assert THREAD_FULL_RUN_FOUND is False
    assert order_of("TurnStartParams") == ()


def test_turn_variant_positions_model_provider() -> None:
    address, length, order = TURN_VARIANT_RUN
    assert address.startswith("0x")
    assert length == len(order) == 13
    assert "modelProvider" in order
    assert order.index("modelProvider") == order.index("model") + 1


def test_rate_limit_snapshot_is_triply_attested() -> None:
    assert "RateLimitSnapshot" in TRIPLE_ATTESTED
    order = order_of("RateLimitSnapshot")
    assert len(order) == 10
    assert order[0] == "limitId"


def test_unknown_struct_has_no_order() -> None:
    assert order_of("NoSuchStructHere") == ()


def test_summary_matches_the_table() -> None:
    s = fields_run_summary()
    assert s["exact_pairs"] == 65
    assert s["order_matches_pool"] == 62
    assert s["record_order_claim"] == "undetermined_for_turn_and_thread"


def test_validator_rejects_an_arity_mismatch(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import struct_fields_run_pairs as mod
    bad = dict(FIELDS_RUNS)
    bad["JwkSet"] = ("0x1", ("keys", "extra"))
    monkeypatch.setattr(mod, "FIELDS_RUNS", bad)
    monkeypatch.setattr(mod, "EXACT_PAIR_COUNT", len(bad))
    monkeypatch.setattr(mod, "ORDER_MATCHES_POOL", len(bad) - len(mod.ORDER_DIFFERS))
    with pytest.raises(FieldsRunError, match="records vs arity"):
        mod.validate_fields_runs()


def test_validator_rejects_a_complete_turn_array(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import struct_fields_run_pairs as mod
    monkeypatch.setattr(mod, "TURN_FULL_RUN_FOUND", True)
    with pytest.raises(FieldsRunError, match="complete Turn"):
        mod.validate_fields_runs()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
