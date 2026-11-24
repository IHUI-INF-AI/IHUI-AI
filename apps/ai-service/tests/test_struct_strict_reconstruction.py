# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R75: arity + shape double-gate reconstruction of serde structures."""

from __future__ import annotations

import pytest

from app.core.struct_strict_reconstruction import (
    ARITY_CONFLICTS,
    CROSS_CHECK_DIVERGENT,
    CROSS_CHECK_IDENTICAL,
    FIELD_SHAPE,
    STRICT_FIELD_COUNT,
    STRICT_SITES,
    STRICT_STRUCT_COUNT,
    STRICT_STRUCTURES,
    TEMPLATE_TOTAL,
    StrictReconstructionError,
    fields_of,
    reconstruction_summary,
)


def test_counts_are_self_consistent() -> None:
    assert len(STRICT_STRUCTURES) == STRICT_STRUCT_COUNT
    assert sum(len(f) for _a, f in STRICT_STRUCTURES.values()) == STRICT_FIELD_COUNT


def test_every_struct_matches_its_arity() -> None:
    for name, (arity, fields) in STRICT_STRUCTURES.items():
        assert len(fields) == arity, name


def test_every_field_is_field_shaped() -> None:
    for name, (_arity, fields) in STRICT_STRUCTURES.items():
        for field in fields:
            assert FIELD_SHAPE.match(field), (name, field)


def test_no_struct_repeats_a_field() -> None:
    for name, (_arity, fields) in STRICT_STRUCTURES.items():
        assert len(fields) == len(set(fields)), name


def test_known_reconstructions_are_intact() -> None:
    assert fields_of("JwkSet") == ("keys",)
    assert len(fields_of("RateLimitSnapshot")) == 10
    assert "limitId" in fields_of("RateLimitSnapshot")
    assert len(fields_of("TuiGlobalKeymap")) == 33


def test_divergence_from_r65_is_recorded_not_smoothed() -> None:
    assert CROSS_CHECK_IDENTICAL >= 10
    names = [d[0] for d in CROSS_CHECK_DIVERGENT]
    assert "EnvironmentInfo" in names
    for _n, strict_len, r65_len, only_r65, only_strict in CROSS_CHECK_DIVERGENT:
        assert only_r65 or only_strict
        assert strict_len == r65_len


def test_summary_matches_the_table() -> None:
    s = reconstruction_summary()
    assert s["strict_structs"] == STRICT_STRUCT_COUNT
    assert s["strict_sites"] == STRICT_SITES
    assert s["templates"] == TEMPLATE_TOTAL
    assert s["arity_conflicts"] == len(ARITY_CONFLICTS)


def test_arity_mismatch_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import struct_strict_reconstruction as mod
    bad = dict(mod.STRICT_STRUCTURES)
    bad["JwkSet"] = (2, ("keys",))
    monkeypatch.setattr(mod, "STRICT_STRUCTURES", bad)
    monkeypatch.setattr(mod, "STRICT_FIELD_COUNT", sum(len(f) for _a, f in bad.values()))
    with pytest.raises(StrictReconstructionError, match="declares arity"):
        mod.validate_reconstruction()


def test_unshaped_field_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import struct_strict_reconstruction as mod
    bad = dict(mod.STRICT_STRUCTURES)
    bad["JwkSet"] = (1, ("Keys",))
    monkeypatch.setattr(mod, "STRICT_STRUCTURES", bad)
    monkeypatch.setattr(mod, "STRICT_FIELD_COUNT", sum(len(f) for _a, f in bad.values()))
    with pytest.raises(StrictReconstructionError, match="not field-shaped"):
        mod.validate_reconstruction()


def test_unknown_struct_yields_empty() -> None:
    assert fields_of("NoSuchStruct") == ()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
