# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Tests for the documents corpus contract (R115)."""

from __future__ import annotations

import pytest

from app.core.docx_skill_corpus_contract import (
    COMMENT_ANCHORS,
    CORPUS_TOTAL,
    DELETION_USES_WT,
    MATERIALIZABLE_FIELDS,
    MERGE_REFUSES_DRAWINGS_BY_DEFAULT,
    NON_MATERIALIZABLE_FIELDS,
    OOXML_NOTE_COUNT,
    REFERENCE_COUNT,
    SCARY_STDERR_ON_SUCCESS,
    TASK_GUIDE_COUNT,
    TROUBLESHOOTING_COUNT,
    UNTRUSTWORTHY_SIGNAL_CHANNELS,
    ContractError,
    can_materialize,
    contract_summary,
    corpus_size,
    is_signal_trustworthy,
    needs_word_field_update,
    validate_contract,
)


def test_contract_validates() -> None:
    validate_contract()


def test_corpus_is_thirty_three_files() -> None:
    assert OOXML_NOTE_COUNT == 4
    assert TASK_GUIDE_COUNT == 26
    assert TROUBLESHOOTING_COUNT == 2
    assert REFERENCE_COUNT == 1
    assert CORPUS_TOTAL == 33
    assert corpus_size() == 33


def test_no_signal_channel_is_trustworthy() -> None:
    """Exit code, stderr and reported findings all failed us in three separate rounds."""
    for channel in ("exit_code", "stderr", "reported_findings"):
        assert is_signal_trustworthy(channel) is False
    assert len(UNTRUSTWORTHY_SIGNAL_CHANNELS) == 3


def test_scary_stderr_appears_on_success() -> None:
    assert SCARY_STDERR_ON_SUCCESS == "error : Unknown IO error"


def test_only_three_field_kinds_can_be_frozen() -> None:
    assert MATERIALIZABLE_FIELDS == ("SEQ", "REF", "PAGEREF")
    for f in MATERIALIZABLE_FIELDS:
        assert can_materialize(f) is True
        assert needs_word_field_update(f) is False


def test_toc_page_and_numpages_need_word() -> None:
    """The trap: materialise everything and ship an empty TOC plus page numbers all reading one."""
    for f in NON_MATERIALIZABLE_FIELDS:
        assert can_materialize(f) is False
        assert needs_word_field_update(f) is True
    assert set(MATERIALIZABLE_FIELDS) & set(NON_MATERIALIZABLE_FIELDS) == set()


def test_materialization_lowercase_still_works() -> None:
    assert can_materialize("ref") is True
    assert needs_word_field_update("page") is True


def test_comments_need_three_anchors_and_three_parts() -> None:
    assert len(COMMENT_ANCHORS) == 3
    assert "w:commentRangeStart" in COMMENT_ANCHORS


def test_tracked_deletion_must_not_use_wt() -> None:
    """A deletion written as w:t renders as ordinary text -- the change vanishes."""
    assert DELETION_USES_WT is False


def test_merge_refuses_drawings_by_default() -> None:
    """Merging body XML without relationships opens fine and shows nothing."""
    assert MERGE_REFUSES_DRAWINGS_BY_DEFAULT is True


def test_summary_shape() -> None:
    s = contract_summary()
    assert s["corpus"]["total"] == 33
    assert len(s["untrustworthy_channels"]) == 3
    assert s["comments_need_structure"] is True


def test_inconsistent_corpus_total_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import docx_skill_corpus_contract as c

    monkeypatch.setattr(c, "CORPUS_TOTAL", 32)
    with pytest.raises(ContractError):
        validate_contract()


def test_overlapping_field_kinds_are_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import docx_skill_corpus_contract as c

    monkeypatch.setattr(c, "NON_MATERIALIZABLE_FIELDS", ("SEQ", "PAGE"))
    with pytest.raises(ContractError):
        validate_contract()


def test_claiming_deletions_use_wt_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import docx_skill_corpus_contract as c

    monkeypatch.setattr(c, "DELETION_USES_WT", True)
    with pytest.raises(ContractError):
        validate_contract()


def test_duplicate_task_guide_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import docx_skill_corpus_contract as c

    dup = tuple(list(c.TASK_GUIDES[:-1]) + [c.TASK_GUIDES[0]])
    monkeypatch.setattr(c, "TASK_GUIDES", dup)
    with pytest.raises(ContractError):
        validate_contract()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
