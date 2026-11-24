# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R88: the code-level string route is measured and closed."""

from __future__ import annotations

import pytest

from app.core.code_route_falsified import (
    CODE_ROUTE_VIABLE,
    CONTROL_SAMPLE,
    FALSIFICATION_ID,
    FUNCS_WITH_IDENT_LEA,
    KNOWN_FIELD_LISTS,
    POSITIVE_CONTROL_HITS,
    SET_SIZE_MAX,
    SET_SIZE_MEDIAN,
    SET_SIZE_P90,
    CodeRouteError,
    code_route_summary,
    control_rate,
    validate_code_route,
)


def test_measurement_is_consistent() -> None:
    assert FUNCS_WITH_IDENT_LEA == 17649
    assert 0 < SET_SIZE_MEDIAN <= SET_SIZE_P90 <= SET_SIZE_MAX
    validate_code_route()


def test_the_median_is_two() -> None:
    assert SET_SIZE_MEDIAN == 2
    assert SET_SIZE_P90 == 4
    assert SET_SIZE_MAX == 88


def test_positive_control_is_almost_empty() -> None:
    assert KNOWN_FIELD_LISTS >= 300
    assert POSITIVE_CONTROL_HITS == 1
    assert control_rate() == pytest.approx(1 / KNOWN_FIELD_LISTS)


def test_the_one_control_is_named() -> None:
    name, arity, address = CONTROL_SAMPLE
    assert name == "ErrorData"
    assert arity == 3
    assert address.startswith("0x")


def test_the_route_is_closed() -> None:
    assert CODE_ROUTE_VIABLE is False
    assert FALSIFICATION_ID == "code-strings-form-no-field-table"


def test_summary_matches() -> None:
    s = code_route_summary()
    assert s["functions"] == 17649
    assert s["median_set_size"] == 2
    assert s["control_hits"] == 1
    assert s["viable"] is False


def test_validator_rejects_reopening_the_route(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import code_route_falsified as mod
    monkeypatch.setattr(mod, "CODE_ROUTE_VIABLE", True)
    with pytest.raises(CodeRouteError, match="route stays closed"):
        mod.validate_code_route()


def test_validator_rejects_unordered_quantiles(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import code_route_falsified as mod
    monkeypatch.setattr(mod, "SET_SIZE_MEDIAN", mod.SET_SIZE_MAX + 1)
    with pytest.raises(CodeRouteError, match="quantiles are not ordered"):
        mod.validate_code_route()


def test_validator_rejects_more_hits_than_lists(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import code_route_falsified as mod
    monkeypatch.setattr(mod, "POSITIVE_CONTROL_HITS", mod.KNOWN_FIELD_LISTS + 1)
    with pytest.raises(CodeRouteError, match="more controls hit than exist"):
        mod.validate_code_route()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
