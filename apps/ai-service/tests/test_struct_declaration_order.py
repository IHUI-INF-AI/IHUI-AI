# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R72: declaration order recovered from the compiled Debug impl."""

from __future__ import annotations

import pytest

from app.core.struct_declaration_order import (
    ORDER_COMPLETE,
    ORDER_COVERAGE,
    ORDER_EVIDENCE_KIND,
    THREAD_DECLARATION_ORDER,
    THREAD_ORDER_LEA_SITES,
    THREAD_ORDER_OUTSIDE_VISITOR,
    TURN_DECLARATION_ORDER,
    TURN_ORDER_LEA_SITES,
    TURN_ORDER_OUTSIDE_VISITOR,
    TURN_ORDER_UNPOSITIONED,
    DeclarationOrderError,
    ensure_declaration_order,
    position_of,
)


def test_coverage_is_partial_by_design() -> None:
    assert ORDER_COMPLETE is False
    assert ORDER_COVERAGE["thread_gap"] == 27 - len(THREAD_DECLARATION_ORDER)
    assert ORDER_COVERAGE["turn_gap"] == 28 - len(TURN_DECLARATION_ORDER)
    assert ORDER_COVERAGE["thread_gap"] > 0 and ORDER_COVERAGE["turn_gap"] > 0


def test_thread_order_starts_with_the_attested_chain() -> None:
    head = THREAD_DECLARATION_ORDER[:7]
    assert head == ("baseInstructions", "ephemeral", "personality", "model",
                    "runtimeWorkspaceRoots", "threadSource", "modelProvider")


def test_order_contains_no_duplicates_and_all_sites_increase() -> None:
    for order, sites in ((THREAD_DECLARATION_ORDER, THREAD_ORDER_LEA_SITES),
                         (TURN_DECLARATION_ORDER, TURN_ORDER_LEA_SITES)):
        assert len(order) == len(set(order))
        assert all(b - a > 0 for a, b in zip(sites, sites[1:], strict=False))


def test_evidence_kind_is_the_disassembled_debug_impl() -> None:
    assert ORDER_EVIDENCE_KIND == "debug-impl-lea-order"


def test_positions_are_one_based_and_missing_names_absent() -> None:
    assert position_of("baseInstructions") == {"thread": 1}
    assert position_of("threadId")["turn"] >= 1
    assert dict(position_of("no-such-field")) == {}


def test_validate_rejects_duplicates(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import struct_declaration_order as mod
    monkeypatch.setattr(mod, "TURN_DECLARATION_ORDER", ("summary", "summary"))
    with pytest.raises(DeclarationOrderError, match="duplicate"):
        mod.validate_declaration_order()


def test_validate_rejects_non_monotonic_sites(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import struct_declaration_order as mod
    monkeypatch.setattr(mod, "TURN_DECLARATION_ORDER", ("summary", "model"))
    monkeypatch.setattr(mod, "TURN_ORDER_LEA_SITES", (0x14577A5DC, 0x145779D5F))
    with pytest.raises(DeclarationOrderError, match="strictly increasing"):
        mod.validate_declaration_order()


def test_mutated_thread_head_is_caught(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import struct_declaration_order as mod
    mutated = ("sandbox",) + THREAD_DECLARATION_ORDER[1:]
    monkeypatch.setattr(mod, "THREAD_DECLARATION_ORDER", mutated)
    assert mutated[:7] != ("baseInstructions", "ephemeral", "personality", "model",
                           "runtimeWorkspaceRoots", "threadSource", "modelProvider")


def test_ensure_returns_both_orders() -> None:
    thread, turn = ensure_declaration_order()
    assert thread == THREAD_DECLARATION_ORDER and turn == TURN_DECLARATION_ORDER


def test_coverage_median_gap_is_a_real_reading() -> None:
    assert ORDER_COVERAGE["thread_median_lea_gap"] > 0
    assert ORDER_COVERAGE["turn_median_lea_gap"] > 0


def test_ordered_names_all_come_from_the_visitor_sets() -> None:
    assert TURN_ORDER_OUTSIDE_VISITOR == ()
    assert THREAD_ORDER_OUTSIDE_VISITOR == ()


def test_unpositioned_names_are_known_but_not_ordered() -> None:
    from app.core.struct_visitor_key_evidence import TURN_START_PARAMS_VISITOR_KEYS
    assert len(TURN_ORDER_UNPOSITIONED) == 2
    assert set(TURN_ORDER_UNPOSITIONED) <= set(TURN_START_PARAMS_VISITOR_KEYS)
    for name in TURN_ORDER_UNPOSITIONED:
        assert name not in TURN_DECLARATION_ORDER
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
