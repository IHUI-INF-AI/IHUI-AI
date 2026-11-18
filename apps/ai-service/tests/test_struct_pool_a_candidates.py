# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R74: pool A segmentation account and its candidate tier."""

from __future__ import annotations

import pytest

from app.core.struct_pool_a_candidates import (
    FIELD_SHAPE,
    POOL_A_BYTES,
    POOL_A_CANDIDATES,
    POOL_A_CANDIDATES_ATTESTED,
    POOL_A_COVERAGE_PCT,
    POOL_A_DOUBTFUL,
    POOL_A_FIELD_SHAPED,
    POOL_A_OVERLONG,
    POOL_A_PREFIX_COLLISIONS,
    POOL_A_RESIDUE,
    POOL_A_RESIDUE_BYTES,
    POOL_A_SEGMENTS,
    POOL_A_TRUSTED_CANDIDATES,
    PoolAccountError,
    account_summary,
)


def test_pool_is_almost_fully_segmented() -> None:
    assert POOL_A_BYTES == 749
    assert POOL_A_RESIDUE_BYTES <= 16
    assert POOL_A_COVERAGE_PCT >= 95.0


def test_residue_is_not_field_shaped() -> None:
    for frag in POOL_A_RESIDUE:
        assert not FIELD_SHAPE.match(frag), frag


def test_candidates_are_new_and_trusted_are_a_subset() -> None:
    assert set(POOL_A_DOUBTFUL) == set(POOL_A_PREFIX_COLLISIONS) | set(POOL_A_OVERLONG)
    assert set(POOL_A_TRUSTED_CANDIDATES) <= set(POOL_A_CANDIDATES)
    assert set(POOL_A_TRUSTED_CANDIDATES) == set(POOL_A_CANDIDATES) - set(POOL_A_DOUBTFUL)


def test_nothing_is_attested_by_segmentation() -> None:
    assert POOL_A_CANDIDATES_ATTESTED is False
    from app.core.struct_declaration_order import position_of
    for name in POOL_A_TRUSTED_CANDIDATES:
        assert dict(position_of(name)) == {}


def test_known_field_names_are_not_relisted_as_candidates() -> None:
    from app.core.struct_pool_residue import NEW_THREAD_FIELD_FROM_RESIDUE
    assert NEW_THREAD_FIELD_FROM_RESIDUE not in POOL_A_CANDIDATES


def test_summary_counts_match_the_tuples() -> None:
    s = account_summary()
    assert s["segments"] == len(POOL_A_SEGMENTS)
    assert s["field_shaped"] == len(POOL_A_FIELD_SHAPED)
    assert s["trusted"] == len(POOL_A_TRUSTED_CANDIDATES)


def test_grown_residue_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import struct_pool_a_candidates as mod
    monkeypatch.setattr(mod, "POOL_A_RESIDUE_BYTES", 64)
    with pytest.raises(PoolAccountError, match="residue grew"):
        mod.validate_pool_account()


def test_attested_flip_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import struct_pool_a_candidates as mod
    monkeypatch.setattr(mod, "POOL_A_CANDIDATES_ATTESTED", True)
    with pytest.raises(PoolAccountError, match="not an attestation"):
        mod.validate_pool_account()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
