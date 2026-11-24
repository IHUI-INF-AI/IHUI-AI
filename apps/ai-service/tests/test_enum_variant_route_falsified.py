# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R91: A3/A5 — the enum-variant route is closed."""

from __future__ import annotations

import pytest

from app.core import enum_variant_route_falsified as mod
from app.core.enum_variant_route_falsified import (
    ALL_SNAKE_RUNS,
    CAMEL_SAMPLES,
    ENUM_ROUTE_VIABLE,
    FALSIFICATION_ID,
    HOOK_ENUMS_LOCATED,
    LEN_17_RUNS,
    MESSAGE_IN_CATALOG,
    MIXED_RUNS,
    RUNS,
    TAGGED_ENUMS,
    UNREACHABLE_ENUMS,
    VARIANT_SHAPED_RUNS,
    VARIANT_TABLES_OUTSIDE_HOOK,
    EnumVariantError,
    enum_route_summary,
    validate_enum_route,
    variant_table_rate,
)


def test_runs_add_up() -> None:
    assert RUNS == 4005
    assert ALL_SNAKE_RUNS + VARIANT_SHAPED_RUNS + MIXED_RUNS == RUNS
    validate_enum_route()


def test_variant_shaped_runs_are_camel_field_tables() -> None:
    assert VARIANT_SHAPED_RUNS == 31
    assert VARIANT_TABLES_OUTSIDE_HOOK == 0
    for seq in CAMEL_SAMPLES:
        assert all("_" not in x for x in seq)
        assert any(x != x.lower() for x in seq)


def test_enum_split() -> None:
    assert TAGGED_ENUMS == 209
    assert HOOK_ENUMS_LOCATED == 4
    assert UNREACHABLE_ENUMS == 205
    assert variant_table_rate() == pytest.approx(4 / 209)


def test_message_is_absent_from_the_catalog() -> None:
    assert MESSAGE_IN_CATALOG is False
    assert LEN_17_RUNS == 9


def test_route_is_closed() -> None:
    assert ENUM_ROUTE_VIABLE is False
    assert FALSIFICATION_ID == "enum-variants-are-not-record-arrays"


def test_summary_matches() -> None:
    s = enum_route_summary()
    assert s["runs"] == 4005
    assert s["unreachable"] == 205
    assert s["viable"] is False


def test_validator_rejects_a_reopened_route(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(mod, "ENUM_ROUTE_VIABLE", True)
    with pytest.raises(EnumVariantError, match="flag must stay false"):
        mod.validate_enum_route()


def test_validator_rejects_bucket_drift(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(mod, "MIXED_RUNS", 620)
    with pytest.raises(EnumVariantError, match="buckets do not add up"):
        mod.validate_enum_route()


def test_validator_rejects_a_new_variant_table(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(mod, "VARIANT_TABLES_OUTSIDE_HOOK", 1)
    with pytest.raises(EnumVariantError, match="outside the hook side"):
        mod.validate_enum_route()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
