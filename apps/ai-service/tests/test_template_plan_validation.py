# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Tests for the template-following plan contract (R124)."""

from __future__ import annotations

import pytest

from app.core.template_plan_validation import (
    ACTION_COUNT,
    ACTIONS,
    ADD_IS_REJECTED_BY_DEFAULT,
    ADD_REQUIRED_FIELD_COUNT,
    ADD_REQUIRES_FIELDS,
    CONTENT_ROLE_COUNT,
    CONTENT_ROLES,
    INSPECT_IS_A_PRECONDITION,
    INSPECT_RELATIVE,
    ISSUE_CODES,
    ISSUE_COUNT,
    KEEP_DOES_NOT_DISCHARGE,
    OUTPUT_SLIDES_MUST_BE_CONSECUTIVE,
    PLACEHOLDER_HANDLING_ACTIONS,
    PLACEHOLDER_PATTERN_COUNT,
    PLACEHOLDER_PATTERNS,
    PRESERVE_ONLY_COUNT,
    PRESERVE_ONLY_ROLES,
    REQUIRED_REUSE_MODE,
    STATUSES,
    add_target_is_complete,
    coverage,
    discharges_placeholder,
    is_content_role,
    is_preserve_only_role,
    reveal_add_direction,
    reveal_preserve_only_content,
    validate_contract,
)


def test_contract_validates() -> None:
    validate_contract()


def test_six_actions() -> None:
    assert len(ACTIONS) == ACTION_COUNT == 6


def test_action_names() -> None:
    assert ACTIONS == (
        "rewrite",
        "rewrite-and-reposition",
        "replace",
        "delete",
        "keep",
        "fill-placeholder",
    )


def test_five_actions_discharge_a_placeholder() -> None:
    assert len(PLACEHOLDER_HANDLING_ACTIONS) == 5


def test_keep_does_not_discharge() -> None:
    """A copied slide still carrying 'Click to add title' is an unfinished deck."""
    assert KEEP_DOES_NOT_DISCHARGE is True
    assert discharges_placeholder("keep") is False


def test_the_other_five_do_discharge() -> None:
    for action in PLACEHOLDER_HANDLING_ACTIONS:
        assert discharges_placeholder(action) is True


def test_twenty_two_content_roles() -> None:
    assert len(CONTENT_ROLES) == CONTENT_ROLE_COUNT == 22


def test_eight_preserve_only_roles() -> None:
    assert len(PRESERVE_ONLY_ROLES) == PRESERVE_ONLY_COUNT == 8


def test_the_two_role_tables_do_not_overlap() -> None:
    assert not set(CONTENT_ROLES) & set(PRESERVE_ONLY_ROLES)


def test_chart_and_table_are_content_not_chrome() -> None:
    assert is_content_role("chart") is True
    assert is_content_role("table") is True
    assert is_preserve_only_role("chart") is False


def test_blank_is_preserve_only() -> None:
    assert is_preserve_only_role("blank") is True
    assert is_content_role("blank") is False


def test_brand_family_is_preserve_only() -> None:
    for role in ("brand", "logo", "bumper", "divider", "separator", "section", "chrome"):
        assert is_preserve_only_role(role) is True


def test_seven_placeholder_patterns() -> None:
    assert len(PLACEHOLDER_PATTERNS) == PLACEHOLDER_PATTERN_COUNT == 7


def test_placeholder_patterns_name_the_obvious_hazards() -> None:
    joined = " | ".join(PLACEHOLDER_PATTERNS)
    assert "click to add" in joined
    assert "lorem ipsum" in joined
    assert "template instruction" in joined


def test_seventeen_issue_codes() -> None:
    assert len(ISSUE_CODES) == ISSUE_COUNT == 17


def test_issue_codes_are_unique() -> None:
    assert len(set(ISSUE_CODES)) == ISSUE_COUNT


def test_every_output_slide_must_be_a_duplicate() -> None:
    assert REQUIRED_REUSE_MODE == "duplicate-slide"


def test_output_slides_must_be_consecutive() -> None:
    assert OUTPUT_SLIDES_MUST_BE_CONSECUTIVE is True


def test_empty_targets_on_a_content_role_is_rejected() -> None:
    assert reveal_preserve_only_content("synthesis", 0) == "preserve-only-content-role"
    assert reveal_preserve_only_content("timeline", 0) == "preserve-only-content-role"


def test_empty_targets_on_a_brand_role_is_legal() -> None:
    assert reveal_preserve_only_content("brand", 0) is None
    assert reveal_preserve_only_content("divider", 0) is None


def test_empty_targets_with_actual_targets_is_legal_everywhere() -> None:
    assert reveal_preserve_only_content("synthesis", 3) is None


def test_add_only_on_a_brand_slide_is_rejected() -> None:
    """Do not turn a logo into a canvas."""
    assert reveal_add_direction("brand", 1, 0) == "add-on-preserve-only-slide"
    assert reveal_add_direction("bumper", 1, 0) == "add-on-preserve-only-slide"


def test_add_only_on_a_content_slide_is_rejected() -> None:
    """Do not build over a copied slide."""
    assert reveal_add_direction("synthesis", 1, 0) == "add-only-content-slide"
    assert reveal_add_direction("evidence", 1, 0) == "add-only-content-slide"


def test_mapping_to_inherited_elements_is_legal() -> None:
    assert reveal_add_direction("synthesis", 1, 1) is None


def test_no_add_at_all_is_legal() -> None:
    assert reveal_add_direction("brand", 0, 2) is None


def test_add_requires_four_supporting_fields() -> None:
    assert len(ADD_REQUIRES_FIELDS) == ADD_REQUIRED_FIELD_COUNT == 4
    assert ADD_REQUIRES_FIELDS == (
        "newPrimitiveAllowed",
        "zone",
        "reason",
        "mustNotOverlapInherited",
    )


def test_add_is_rejected_by_default() -> None:
    assert ADD_IS_REJECTED_BY_DEFAULT is True


def test_a_complete_add_target_passes() -> None:
    assert add_target_is_complete(dict.fromkeys(ADD_REQUIRES_FIELDS, True)) is True


def test_an_incomplete_add_target_fails() -> None:
    assert add_target_is_complete({"zone": "band-1"}) is False
    assert add_target_is_complete({"zone": "a", "reason": "b"}) is False


def test_inspect_is_a_precondition() -> None:
    assert INSPECT_IS_A_PRECONDITION is True
    assert INSPECT_RELATIVE == "template-inspect/template-inspect.ndjson"


def test_three_statuses_with_fail_dominating() -> None:
    assert STATUSES == ("fail", "warning", "pass")


def test_coverage_reports_the_tables() -> None:
    c = coverage()
    assert c["actions"] == 6
    assert c["placeholder_handling_actions"] == 5
    assert c["content_roles"] == 22
    assert c["preserve_only_roles"] == 8
    assert c["placeholder_patterns"] == 7
    assert c["issue_codes"] == 17


def test_claiming_keep_discharges_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import template_plan_validation as v

    monkeypatch.setattr(v, "PLACEHOLDER_HANDLING_ACTIONS", v.PLACEHOLDER_HANDLING_ACTIONS + ("keep",))
    with pytest.raises(ValueError):
        v.validate_contract()


def test_claiming_the_role_tables_overlap_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import template_plan_validation as v

    monkeypatch.setattr(v, "PRESERVE_ONLY_ROLES", v.PRESERVE_ONLY_ROLES + ("chart",))
    with pytest.raises(ValueError):
        v.validate_contract()


def test_claiming_in_place_reuse_is_fine_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import template_plan_validation as v

    monkeypatch.setattr(v, "REQUIRED_REUSE_MODE", "edit-in-place")
    with pytest.raises(ValueError):
        v.validate_contract()


def test_claiming_add_needs_no_fields_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import template_plan_validation as v

    monkeypatch.setattr(v, "ADD_REQUIRES_FIELDS", ())
    with pytest.raises(ValueError):
        v.validate_contract()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
