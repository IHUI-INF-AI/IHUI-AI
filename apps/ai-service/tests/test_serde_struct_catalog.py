# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R77: the serde struct catalog is self-consistent and contains every R75 reconstruction."""

from __future__ import annotations

import pytest

from app.core.serde_struct_catalog import (
    ARITY_VARIANTS,
    SINGLE_ARITY_COUNT,
    STRUCT_ARITY,
    STRUCT_COUNT,
    TEMPLATE_TOTAL,
    VARIANT_ARITY_COUNT,
    CatalogError,
    arities_of,
    catalog_summary,
)
from app.core.struct_strict_reconstruction import STRICT_STRUCTURES


def test_catalog_counts_are_self_consistent() -> None:
    assert len(STRUCT_ARITY) + len(ARITY_VARIANTS) == STRUCT_COUNT
    assert len(STRUCT_ARITY) == SINGLE_ARITY_COUNT
    assert len(ARITY_VARIANTS) == VARIANT_ARITY_COUNT
    assert TEMPLATE_TOTAL > STRUCT_COUNT


def test_every_r75_struct_is_in_the_catalog() -> None:
    missing = [n for n in STRICT_STRUCTURES if not arities_of(n)]
    assert missing == []


def test_r75_arity_agrees_with_the_catalog() -> None:
    for name, (arity, _fields) in STRICT_STRUCTURES.items():
        assert arity in arities_of(name), name


def test_variant_names_carry_several_arities() -> None:
    assert ARITY_VARIANTS["Helper"] == (2, 4, 5)
    assert ARITY_VARIANTS["FsCopyParams"] == (3, 4)
    for name, variants in ARITY_VARIANTS.items():
        assert len(set(variants)) == len(variants), name


def test_known_structs_are_present() -> None:
    assert arities_of("ThreadStartParams") == (27,)
    assert arities_of("TurnStartParams") == (28,)
    assert arities_of("JwkSet") == (1,)
    assert arities_of("ConfigRequirementsToml") == (46,) or 46 in arities_of(
        "ConfigRequirementsToml")


def test_unknown_name_is_empty() -> None:
    assert arities_of("NoSuchStructAtAll") == ()


def test_summary_matches_the_tables() -> None:
    s = catalog_summary()
    assert s["structs"] == STRUCT_COUNT
    assert s["single_arity"] == len(STRUCT_ARITY)
    assert s["arity_variants"] == len(ARITY_VARIANTS)


def test_validator_rejects_a_size_mismatch(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import serde_struct_catalog as mod
    monkeypatch.setattr(mod, "STRUCT_COUNT", STRUCT_COUNT + 1)
    with pytest.raises(CatalogError, match="STRUCT_COUNT"):
        mod.validate_catalog()


def test_validator_rejects_a_degenerate_variant(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import serde_struct_catalog as mod
    bad = dict(ARITY_VARIANTS)
    bad["Helper"] = (2,)
    monkeypatch.setattr(mod, "ARITY_VARIANTS", bad)
    with pytest.raises(CatalogError, match="fewer than two"):
        mod.validate_catalog()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
