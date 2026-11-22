# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Tests for the template fidelity contract (R126)."""

from __future__ import annotations

import pytest

from app.core.template_fidelity_contract import (
    AGENT_LOG_APPENDED,
    BAN_CODES,
    BANS,
    DEFAULT_SLIDE_HEIGHT,
    DEFAULT_SLIDE_WIDTH,
    ISSUE_CODES,
    ISSUE_COUNT,
    OVERLAY_CENTRE_INSIDE_ALSO_FAILS,
    OVERLAY_IOU_SKIP_ABOVE,
    OVERLAY_ONLY_OPAQUE_PANELS,
    OVERLAY_OVERLAP_OF_INHERITED,
    PLACEHOLDER_PATTERNS,
    REQUIRED_EVIDENCE,
    SCAN_EXTENSIONS,
    SCANNERS,
    SLIDE_SIZE_ASSUMED_NOT_MEASURED,
    STARTER_TOKEN_HINTS,
    STARTER_TOKENS_REQUIRED_WITH_IMPORT,
    STATUSES,
    STRUCTURAL_PLACEHOLDER_TAG,
    TEXT_ONLY_EVIDENCE,
    TEXT_RUN_TAG,
    TWO_DISTINCT_PLACEHOLDER_PROBLEMS,
    coverage,
    is_placeholder_text,
    overlay_is_a_mask,
    validate_contract,
)


def test_contract_validates() -> None:
    validate_contract()


def test_assumed_slide_size() -> None:
    assert (DEFAULT_SLIDE_WIDTH, DEFAULT_SLIDE_HEIGHT) == (1280, 720)


def test_the_assumption_is_recorded() -> None:
    """A 4:3 deck is judged against a 16:9 yardstick."""
    assert SLIDE_SIZE_ASSUMED_NOT_MEASURED is True


def test_seven_placeholder_patterns() -> None:
    assert len(PLACEHOLDER_PATTERNS) == 7


def test_placeholder_text_is_recognised() -> None:
    assert is_placeholder_text("Click to add title") is True
    assert is_placeholder_text("Slide number") is True
    assert is_placeholder_text("Lorem ipsum dolor") is True
    assert is_placeholder_text("Add your template instruction here") is True


def test_the_goes_here_family_is_recognised() -> None:
    assert is_placeholder_text("Title goes here") is True
    assert is_placeholder_text("Body goes here") is True


def test_real_content_is_not_a_placeholder() -> None:
    assert is_placeholder_text("Quarterly Review") is False
    assert is_placeholder_text("Revenue rose 12%") is False


def test_nine_scanned_extensions() -> None:
    assert len(SCAN_EXTENSIONS) == 9


def test_the_scan_is_text_only_and_includes_the_log() -> None:
    """A cheat recorded in a comment or a log line is still a cheat."""
    assert TEXT_ONLY_EVIDENCE is True
    assert AGENT_LOG_APPENDED is True


def test_six_ban_triggers_across_four_codes() -> None:
    assert len(BANS) == 6
    assert len(BAN_CODES) == 4
    assert {b.code for b in BANS} == set(BAN_CODES)


def test_python_pptx_is_banned_twice() -> None:
    py = [b for b in BANS if b.code == "deck-affecting-python"]
    assert len(py) == 2


def test_fresh_slide_rebuild_is_banned_twice() -> None:
    fs = [b for b in BANS if b.code == "fresh-slide-rebuild"]
    assert len(fs) == 2


def test_two_required_evidence_items() -> None:
    assert len(REQUIRED_EVIDENCE) == 2
    starts = {e.code for e in REQUIRED_EVIDENCE}
    assert starts == {"missing-starter-import-evidence", "missing-artifact-export-evidence"}


def test_import_alone_is_not_enough() -> None:
    """The combined source must also name a starter file."""
    assert STARTER_TOKENS_REQUIRED_WITH_IMPORT is True
    assert len(STARTER_TOKEN_HINTS) == 3
    assert "template-starter.pptx" in STARTER_TOKEN_HINTS


def test_two_distinct_placeholder_problems() -> None:
    """An empty title box and a body still saying 'Text goes here' are different failures."""
    assert TWO_DISTINCT_PLACEHOLDER_PROBLEMS is True
    assert STRUCTURAL_PLACEHOLDER_TAG == "<p:ph>"
    assert TEXT_RUN_TAG == "<a:t>"


def test_iou_skip_threshold() -> None:
    assert OVERLAY_IOU_SKIP_ABOVE == 0.92


def test_overlap_threshold_is_thirty_five_percent() -> None:
    assert OVERLAY_OVERLAP_OF_INHERITED == 0.35


def test_centre_inside_also_fails() -> None:
    """The area test alone would forgive a small label dropped on a heading."""
    assert OVERLAY_CENTRE_INSIDE_ALSO_FAILS is True


def test_only_opaque_panels_are_candidates() -> None:
    assert OVERLAY_ONLY_OPAQUE_PANELS is True


def test_overlap_above_threshold_is_a_mask() -> None:
    assert overlay_is_a_mask(400.0, 1000.0, 0.10, False) is True


def test_overlap_below_threshold_alone_is_not_a_mask() -> None:
    assert overlay_is_a_mask(200.0, 1000.0, 0.10, False) is False


def test_centre_inside_is_a_mask_even_under_threshold() -> None:
    assert overlay_is_a_mask(200.0, 1000.0, 0.10, True) is True


def test_a_redrawn_inherited_element_is_not_a_mask() -> None:
    assert overlay_is_a_mask(900.0, 1000.0, 0.95, True) is False


def test_zero_area_inherited_element_never_masks() -> None:
    assert overlay_is_a_mask(1.0, 0.0, 0.0, True) is False


def test_ten_issue_codes() -> None:
    assert len(ISSUE_CODES) == ISSUE_COUNT == 10


def test_issue_codes_are_unique() -> None:
    assert len(set(ISSUE_CODES)) == ISSUE_COUNT


def test_four_scanners() -> None:
    assert SCANNERS == (
        "scanAuthoringFiles",
        "scanFinalLayouts",
        "scanPptxPlaceholders",
        "scanOverlays",
    )


def test_three_statuses() -> None:
    assert STATUSES == ("fail", "warning", "pass")


def test_coverage_reports_the_tables() -> None:
    c = coverage()
    assert c["bans"] == 6
    assert c["required_evidence"] == 2
    assert c["scanners"] == 4
    assert c["issue_codes"] == 10
    assert c["placeholder_patterns"] == 7
    assert c["scan_extensions"] == 9


def test_claiming_python_pptx_is_fine_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import template_fidelity_contract as c

    monkeypatch.setattr(c, "BANS", tuple(b for b in c.BANS if b.code != "deck-affecting-python"))
    with pytest.raises(ValueError):
        c.validate_contract()


def test_claiming_iou_threshold_is_something_else_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import template_fidelity_contract as c

    monkeypatch.setattr(c, "OVERLAY_IOU_SKIP_ABOVE", 0.5)
    with pytest.raises(ValueError):
        c.validate_contract()


def test_claiming_centre_inside_is_fine_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import template_fidelity_contract as c

    monkeypatch.setattr(c, "OVERLAY_CENTRE_INSIDE_ALSO_FAILS", False)
    with pytest.raises(ValueError):
        c.validate_contract()


def test_claiming_slide_size_is_measured_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import template_fidelity_contract as c

    monkeypatch.setattr(c, "SLIDE_SIZE_ASSUMED_NOT_MEASURED", False)
    with pytest.raises(ValueError):
        c.validate_contract()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
