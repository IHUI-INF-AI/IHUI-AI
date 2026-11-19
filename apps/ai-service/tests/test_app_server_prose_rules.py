# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R133: behaviour the schema does not express."""

from __future__ import annotations

import pytest

from app.core import app_server_prose_rules as pr


def test_surface_split() -> None:
    assert pr.DESCRIPTION_COUNT == 312
    assert pr.CONDITIONAL_DESCRIPTION_COUNT == 93
    assert pr.PLAIN_DESCRIPTION_COUNT == 219
    assert pr.CONDITIONAL_DESCRIPTION_COUNT + pr.PLAIN_DESCRIPTION_COUNT == pr.DESCRIPTION_COUNT
    assert pr.CONDITIONAL_DESCRIPTION_COUNT == pr.UNPADDED_MATCHER_COUNT + pr.PADDING_RECOVERED


def test_rule_table_shape() -> None:
    assert len(pr.RULES) == pr.RULE_COUNT
    ids = [r[0] for r in pr.RULES]
    fields = [r[1] for r in pr.RULES]
    assert len(set(ids)) == pr.RULE_COUNT
    assert len(set(fields)) == pr.RULE_COUNT
    assert all(r[2] in pr.RULE_KINDS for r in pr.RULES)


def test_every_kind_has_a_representative() -> None:
    for kind in pr.RULE_KINDS:
        assert pr.rules_of_kind(kind), kind


def test_timeout_default_is_not_unlimited() -> None:
    text = pr.describe("timeout-defaults-to-one-hour")
    assert "one hour" in text
    assert "immediate timeout" in text
    assert "not unlimited" in text


def test_buffered_and_streamed_are_alternatives() -> None:
    assert pr.rule_kind("buffered-output-is-empty-when-streamed") == "mutual-exclusion"
    assert pr.rule_field("buffered-output-is-empty-when-streamed") == "CommandExecResponse.stdout"


def test_steering_suppresses_four_fields() -> None:
    ids = pr.rules_of_kind("steering-suppressed")
    assert len(ids) == 4
    fields = {pr.rule_field(i) for i in ids}
    assert fields == {
        "TurnStartParams.parentTurnId",
        "TurnStartParams.rootTurnId",
        "TurnStartParams.serviceTierForTurn",
        "TurnStartParams.turnTrigger",
    }


def test_three_state_section_id() -> None:
    assert pr.rule_kind("section-id-is-three-state") == "three-state"
    assert "Omit" in pr.describe("section-id-is-three-state")
    assert "null" in pr.describe("section-id-is-three-state")


def test_empty_and_omitted_are_distinguished_four_times() -> None:
    ids = pr.rules_of_kind("explicit-empty")
    assert len(ids) == 4
    assert "HooksListParams.cwds" in {pr.rule_field(i) for i in ids}


def test_sentinels_are_zero_not_null() -> None:
    ids = pr.rules_of_kind("sentinel")
    assert len(ids) == 2
    for i in ids:
        assert "not null" in pr.describe(i)


def test_vendor_admits_two_uncertainties() -> None:
    ids = pr.rules_of_kind("vendor-uncertainty")
    assert len(ids) == 2
    assert pr.CENSUS["uncertain"] == 2
    assert any("UNSTABLE" in pr.describe(i) for i in ids)


def test_compat_and_deprecation_are_stated() -> None:
    assert pr.rules_of_kind("compat-absent") == ("collaboration-mode-absent-on-old-server",)
    assert len(pr.rules_of_kind("deprecated-path")) == 2


def test_census_is_internally_consistent() -> None:
    assert pr.CENSUS["cursor"] == 27
    assert pr.CENSUS["three_state"] == 17
    assert pr.CENSUS["deprecated"] == 15
    assert pr.CENSUS["defaults"] == 25
    assert pr.CENSUS["precondition"] == 1
    assert pr.CENSUS["explicit_empty"] == 4
    assert pr.CENSUS["sentinel_zero"] == 2


def test_conditional_detector() -> None:
    assert pr.is_conditional_description("If nothing is set, the default applies.")
    assert pr.is_conditional_description("Only valid when tty is true.")
    assert not pr.is_conditional_description("Opaque cursor for the next page.")


def test_sentence_opening_marker_was_the_missed_case() -> None:
    assert pr.is_conditional_description("If None, there are no more items to return.")
    assert pr.UNPADDED_MATCHER_COUNT < pr.CONDITIONAL_DESCRIPTION_COUNT


def test_lookups_resolve_and_miss_softly() -> None:
    assert pr.rule_kind("section-id-is-three-state") == "three-state"
    assert pr.rule_field("section-id-is-three-state") == "ThreadListParams.sectionId"
    assert pr.rule_kind("missing") == ""
    assert pr.rule_field("missing") == ""
    assert pr.describe("missing") == ""
    assert pr.rules_of_kind("missing") == ()


def test_contract_holds() -> None:
    assert pr.validate_prose_rules() == []


def test_contract_catches_a_duplicated_field(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        pr,
        "RULES",
        pr.RULES + (("extra-copy", "ThreadListParams.sectionId", "three-state", "duplicate"),),
    )
    monkeypatch.setattr(pr, "RULE_COUNT", len(pr.RULES))
    problems = pr.validate_prose_rules()
    assert any("distinct field" in p for p in problems)


def test_contract_catches_a_broken_surface_split(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(pr, "PLAIN_DESCRIPTION_COUNT", 220)
    problems = pr.validate_prose_rules()
    assert any("account for all 312" in p for p in problems)


def test_contract_catches_a_third_uncertainty(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(pr, "CENSUS", {**pr.CENSUS, "uncertain": 3})
    problems = pr.validate_prose_rules()
    assert any("on the record" in p for p in problems)


def test_contract_catches_a_kind_without_representatives(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        pr, "RULES", tuple(r for r in pr.RULES if r[2] != "sentinel")
    )
    monkeypatch.setattr(pr, "RULE_COUNT", len(pr.RULES))
    problems = pr.validate_prose_rules()
    assert any("sentinel has no representative" in p for p in problems)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
