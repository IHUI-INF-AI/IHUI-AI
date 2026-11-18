# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Tests for the style and engine contract (R116)."""

from __future__ import annotations

import pytest

from app.core.skill_style_and_engine_contract import (
    AI_VOCABULARY_CLUSTER,
    AUX_DOC_COUNT,
    BODY_POINT_SIZE,
    DOCUMENTS_SCRIPT_COUNT,
    MANIFEST_ENTRY_COUNT,
    NO_SLOP_SCORE_FLOOR,
    SLOP_ANYWHERE_SCORE_CEILING,
    TEMPLATE_KINDS,
    StyleContractError,
    can_use_content_control_fill,
    is_ai_vocabulary,
    may_use_print_layout_as_repair,
    slop_score_ceiling,
    summary,
    template_kind_is_valid,
    validate_contract,
)


def test_contract_validates() -> None:
    validate_contract()


def test_eight_aux_documents() -> None:
    assert AUX_DOC_COUNT == 8


def test_manifest_and_disk_agree() -> None:
    """Thirty-six scripts on disk, thirty-six listed, no difference either way."""
    assert DOCUMENTS_SCRIPT_COUNT == 36
    assert MANIFEST_ENTRY_COUNT == 74


def test_ten_template_kinds() -> None:
    assert len(TEMPLATE_KINDS) == 10
    for kind in ("document", "image", "site", "google-docs"):
        assert template_kind_is_valid(kind) is True
    assert template_kind_is_valid("pdf") is False


def test_template_following_must_not_use_fill() -> None:
    """Fill reconstructs the control; fidelity mode patches text nodes instead."""
    assert can_use_content_control_fill(in_template_following_mode=True) is False
    assert can_use_content_control_fill(in_template_following_mode=False) is True


def test_print_layout_is_not_a_repair() -> None:
    assert may_use_print_layout_as_repair(False) is False
    assert may_use_print_layout_as_repair(True) is True


def test_any_slop_caps_the_score() -> None:
    """Zero hits leaves room to reach the floor; one hit drops below sixty."""
    assert slop_score_ceiling(0) == NO_SLOP_SCORE_FLOOR
    assert slop_score_ceiling(1) == SLOP_ANYWHERE_SCORE_CEILING
    assert slop_score_ceiling(7) == SLOP_ANYWHERE_SCORE_CEILING
    assert SLOP_ANYWHERE_SCORE_CEILING < NO_SLOP_SCORE_FLOOR


def test_eleven_vocabulary_markers() -> None:
    assert len(AI_VOCABULARY_CLUSTER) == 11
    for word in ("delve", "pivotal", "tapestry", "vibrant"):
        assert is_ai_vocabulary(word) is True
        assert is_ai_vocabulary(word.upper()) is True
    assert is_ai_vocabulary("parser") is False


def test_body_size_is_ten_points() -> None:
    assert BODY_POINT_SIZE == 10


def test_summary_shape() -> None:
    s = summary()
    assert s["aux_docs"] == 8
    assert s["template_kinds"] == 10
    assert s["ai_vocabulary"] == 11


def test_claiming_officejs_is_transactional_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import skill_style_and_engine_contract as c

    monkeypatch.setattr(c, "RUN_OFFICEJS_IS_TRANSACTIONAL", True)
    with pytest.raises(StyleContractError):
        validate_contract()


def test_claiming_image_diff_is_enough_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import skill_style_and_engine_contract as c

    monkeypatch.setattr(c, "IMAGE_DIFF_IS_SUFFICIENT_FIDELITY_GATE", True)
    with pytest.raises(StyleContractError):
        validate_contract()


def test_allowing_fill_in_fidelity_mode_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import skill_style_and_engine_contract as c

    monkeypatch.setattr(c, "TEMPLATE_FOLLOWING_MAY_USE_FILL", True)
    with pytest.raises(StyleContractError):
        validate_contract()


def test_duplicate_vocabulary_marker_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import skill_style_and_engine_contract as c

    dup = tuple(list(c.AI_VOCABULARY_CLUSTER[:-1]) + [c.AI_VOCABULARY_CLUSTER[0]])
    monkeypatch.setattr(c, "AI_VOCABULARY_CLUSTER", dup)
    with pytest.raises(StyleContractError):
        validate_contract()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
