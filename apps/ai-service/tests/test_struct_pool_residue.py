# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R73: pool segmentation residue — the field name no earlier round had."""

from __future__ import annotations

import pytest

from app.core.struct_pool_residue import (
    NEW_FIELD_HAS_POSITION,
    NEW_THREAD_FIELD_FROM_RESIDUE,
    POOL_TAIL_TEMPLATE_VA,
    RESIDUE_NAME_PATTERN,
    THREAD_NAMES_KNOWN,
    THREAD_POOL_B_RESIDUE,
    THREAD_POOL_B_SEGMENTS,
    THREAD_START_PARAMS_ARITY,
    TURN_POOL_C_RESIDUE,
    TURN_POOL_C_SEGMENTS,
    PoolResidueError,
    residue_summary,
)


def test_turn_pool_has_zero_residue() -> None:
    assert TURN_POOL_C_RESIDUE == ()
    assert len(TURN_POOL_C_SEGMENTS) == 23
    assert "cyberAccessProgram" in TURN_POOL_C_SEGMENTS


def test_thread_pool_residue_is_the_recovered_name() -> None:
    assert THREAD_POOL_B_RESIDUE == ("experimentalRawEvents",)
    assert NEW_THREAD_FIELD_FROM_RESIDUE == "experimentalRawEvents"
    assert NEW_THREAD_FIELD_FROM_RESIDUE not in THREAD_POOL_B_SEGMENTS


def test_recovered_name_is_field_shaped() -> None:
    for name in THREAD_POOL_B_RESIDUE:
        assert RESIDUE_NAME_PATTERN.match(name), name


def test_residue_carries_no_position() -> None:
    assert NEW_FIELD_HAS_POSITION is False
    from app.core.struct_declaration_order import position_of
    assert dict(position_of(NEW_THREAD_FIELD_FROM_RESIDUE)) == {}


def test_gap_narrows_to_one_after_this_round() -> None:
    summary = residue_summary()
    assert summary["thread_gap"] == THREAD_START_PARAMS_ARITY - THREAD_NAMES_KNOWN == 1
    assert summary["turn_pool_residue"] == 0
    assert summary["thread_pool_residue"] == 1


def test_pool_tail_template_is_pointed() -> None:
    assert POOL_TAIL_TEMPLATE_VA == "0x151b6a5bc"


def test_short_segment_duplication_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import struct_pool_residue as mod
    monkeypatch.setattr(mod, "TURN_POOL_C_SEGMENTS", ("effort", "effort"))
    with pytest.raises(PoolResidueError, match="repeat"):
        mod.validate_pool_residue()


def test_residue_that_is_not_field_shaped_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import struct_pool_residue as mod
    monkeypatch.setattr(mod, "THREAD_POOL_B_RESIDUE", ("struct ThreadStartParams",))
    with pytest.raises(PoolResidueError, match="not a field-shaped ident"):
        mod.validate_pool_residue()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
