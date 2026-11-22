# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R86: the coverage gap ledger, and the ceiling of the pool route."""

from __future__ import annotations

import pytest

from app.core.serde_struct_catalog import STRUCT_ARITY, STRUCT_COUNT
from app.core.struct_gap_ledger import (
    CATALOG_STRUCTS,
    CLASSIFIED_TOTAL,
    EMPTY,
    HOOK_SIDE,
    NAMED,
    OVER_REJECTED,
    POOL_REACHABLE,
    POOL_ROUTE_CEILING,
    UNCLASSIFIED,
    UNDER,
    GapLedgerError,
    empty_share,
    gap_ledger_summary,
    pool_route_ceiling,
    validate_gap_ledger,
)


def test_catalog_matches_the_catalog_module() -> None:
    assert CATALOG_STRUCTS == STRUCT_COUNT == 1436
    assert len(STRUCT_ARITY) == 1414
    validate_gap_ledger()


def test_four_buckets_add_up() -> None:
    assert NAMED + UNDER + EMPTY + OVER_REJECTED == CLASSIFIED_TOTAL
    assert CLASSIFIED_TOTAL + UNCLASSIFIED == CATALOG_STRUCTS


def test_the_empty_bucket_is_the_decisive_number() -> None:
    assert EMPTY == 500
    assert empty_share() == pytest.approx(500 / 1436)


def test_pool_route_ceiling() -> None:
    assert POOL_REACHABLE == UNDER + OVER_REJECTED
    assert POOL_ROUTE_CEILING == NAMED + POOL_REACHABLE
    assert pool_route_ceiling() == POOL_ROUTE_CEILING
    assert POOL_ROUTE_CEILING + EMPTY + UNCLASSIFIED == CATALOG_STRUCTS


def test_named_is_below_the_cross_round_total() -> None:
    # 321 field lists exist in total (R75/R81/R82/R83), but 5 of those names are hook schema
    # names that are not in the struct catalog.
    assert NAMED == 316
    assert NAMED + HOOK_SIDE == 325


def test_hook_side_is_not_in_the_catalog() -> None:
    from app.core.hook_definition_binary_crosscheck import LOCATED_COUNT as HOOK_LOCATED
    from app.core.hook_segment_binary_lookup import LOCATED_COUNT as SEG_LOCATED
    assert HOOK_SIDE == HOOK_LOCATED + SEG_LOCATED == 9


def test_over_rejected_is_not_marked_as_easy_gain() -> None:
    assert OVER_REJECTED == 226
    assert OVER_REJECTED < POOL_REACHABLE


def test_summary_matches() -> None:
    s = gap_ledger_summary()
    assert s["named"] == 316
    assert s["empty"] == 500
    assert s["ceiling"] == 316 + 372 + 226
    assert s["hook_side"] == 9


def test_validator_rejects_a_buckets_mismatch(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import struct_gap_ledger as mod
    monkeypatch.setattr(mod, "NAMED", mod.NAMED + 1)
    with pytest.raises(GapLedgerError, match="do not sum"):
        mod.validate_gap_ledger()


def test_validator_rejects_a_ceiling_mismatch(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import struct_gap_ledger as mod
    monkeypatch.setattr(mod, "POOL_ROUTE_CEILING", mod.POOL_ROUTE_CEILING + 10)
    with pytest.raises(GapLedgerError, match="ceiling must be named plus pool-reachable"):
        mod.validate_gap_ledger()


def test_validator_rejects_a_catalog_mismatch(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import struct_gap_ledger as mod
    monkeypatch.setattr(mod, "UNCLASSIFIED", mod.UNCLASSIFIED + 1)
    with pytest.raises(GapLedgerError, match="classified \\+ unclassified"):
        mod.validate_gap_ledger()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
