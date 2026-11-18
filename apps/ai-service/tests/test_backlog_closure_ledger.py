# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R89: backlog closure ledger (A2 / A7 / A8 / A11)."""

from __future__ import annotations

import pytest

from app.core import backlog_closure_ledger as mod
from app.core.backlog_closure_ledger import (
    A2_CLOSED,
    DOMAIN_ARITY_SUM,
    DOMAIN_COUNT,
    DOMAIN_ROWS,
    DOMAIN_STRUCTS,
    FAMILIES,
    FRAGMENTS,
    HOOK_SCHEMA_BLOCKS,
    LOOSE_TYPE_OBJECT,
    NESTED_SUBOBJECTS,
    PARTIAL_HIT_FAMILIES,
    SURFACE_MARKERS,
    SURFACES_PRESENT,
    TAGGED_ENUMS,
    WIDEST_GAPS,
    ZERO_HIT_FAMILIES,
    BacklogLedgerError,
    backlog_ledger_summary,
    validate_backlog_ledger,
    widest_gap,
)


def test_a2_the_seven_are_nested_subobjects_not_fragments() -> None:
    assert LOOSE_TYPE_OBJECT == 30
    assert HOOK_SCHEMA_BLOCKS == 23
    assert NESTED_SUBOBJECTS == 7
    assert FRAGMENTS == 0
    assert LOOSE_TYPE_OBJECT == HOOK_SCHEMA_BLOCKS + NESTED_SUBOBJECTS


def test_a2_verdict() -> None:
    assert A2_CLOSED == "no-unparsed-fragments"


def test_a7_domains_add_up() -> None:
    validate_backlog_ledger()
    assert DOMAIN_COUNT == 8
    assert DOMAIN_STRUCTS == 987
    assert DOMAIN_ARITY_SUM == 4660
    assert sum(s for s, _f in DOMAIN_ROWS.values()) == DOMAIN_STRUCTS
    assert sum(f for _s, f in DOMAIN_ROWS.values()) == DOMAIN_ARITY_SUM
    assert DOMAIN_ROWS["thread_struct_contract"][0] > DOMAIN_ROWS["model_struct_contract"][0]


def test_a8_family_split() -> None:
    assert FAMILIES == 95
    assert TAGGED_ENUMS == 209
    assert ZERO_HIT_FAMILIES == 60
    assert PARTIAL_HIT_FAMILIES == 35
    assert ZERO_HIT_FAMILIES + PARTIAL_HIT_FAMILIES == FAMILIES


def test_a8_widest_gap_is_client_request() -> None:
    assert widest_gap() == "ClientRequest"
    assert WIDEST_GAPS[0] == ("ClientRequest", 187)
    sizes = [n for _f, n in WIDEST_GAPS]
    assert sizes == sorted(sizes, reverse=True)


def test_a11_telemetry_surface_exists() -> None:
    assert SURFACES_PRESENT >= 6
    assert SURFACE_MARKERS["telemetry"] > 0
    assert SURFACE_MARKERS["analytics"] > 0
    assert SURFACE_MARKERS["updater"] > 0


def test_a11_ota_is_a_word_not_a_substring() -> None:
    # the naive substring scan read 999; word boundaries give a small number
    assert SURFACE_MARKERS["ota"] < 100
    assert SURFACE_MARKERS["ota"] > 0


def test_summary_matches() -> None:
    s = backlog_ledger_summary()
    assert s["a2"] == "no-unparsed-fragments"
    assert s["fragments"] == 0
    assert s["a7_structs"] == 987
    assert s["a8_zero"] == 60
    assert s["a11_present"] == SURFACES_PRESENT


def test_validator_rejects_a_reappearing_fragment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(mod, "FRAGMENTS", 1)
    with pytest.raises(BacklogLedgerError, match="no longer closed"):
        mod.validate_backlog_ledger()


def test_validator_rejects_a_bad_split(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(mod, "NESTED_SUBOBJECTS", 9)
    with pytest.raises(BacklogLedgerError, match="must split"):
        mod.validate_backlog_ledger()


def test_validator_rejects_family_drift(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(mod, "ZERO_HIT_FAMILIES", 59)
    with pytest.raises(BacklogLedgerError, match="must equal the family count"):
        mod.validate_backlog_ledger()


def test_validator_rejects_a_bad_arity_sum(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(mod, "DOMAIN_ARITY_SUM", mod.DOMAIN_ARITY_SUM + 1)
    with pytest.raises(BacklogLedgerError, match="arity sum does not add up"):
        mod.validate_backlog_ledger()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
