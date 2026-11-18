# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Tests for the plugin licence audit (R96)."""

from __future__ import annotations

import pytest

from app.core.codex_plugin_license_audit import (
    COMPLIANT_PATH,
    COPYRIGHT_HOLDER,
    COPYRIGHT_LINE,
    COPYRIGHT_YEAR,
    DECLARED_LICENSES,
    DECLARED_MIT_COUNT,
    DECLARED_PROPRIETARY_COUNT,
    DERIVATIVE_DISTRIBUTION_ALLOWED,
    LICENSE_FILE_BYTES,
    LICENSE_FILE_REL,
    METADATA_CONFLICTS_WITH_TEXT,
    NO_SEPARATE_AGREEMENT_FALLBACK,
    OPERATIVE_INSTRUMENT,
    PERMITTED_USE,
    PRIOR_ANALYSIS_WORK_ALSO_RESTRICTED,
    PROHIBITION_COUNT,
    PROHIBITIONS,
    REPRODUCTION_ALLOWED,
    REVERSE_ENGINEERING_ALLOWED_BY_TEXT,
    RIGHTS_RESERVED,
    VENDOR_ALLOWED,
    LicenseAuditError,
    audit,
    declared_license_of,
    is_declared_mit,
    is_restricted,
    validate_audit,
    vendoring_blocked_by,
)


def test_audit_validates() -> None:
    validate_audit()


def test_five_plugins_four_mit_one_proprietary() -> None:
    assert len(DECLARED_LICENSES) == 5
    assert DECLARED_MIT_COUNT == 4
    assert DECLARED_PROPRIETARY_COUNT == 1


def test_presentations_declares_mit_yet_is_still_restricted() -> None:
    assert is_declared_mit("presentations") is True
    assert vendoring_blocked_by("presentations") is True


def test_template_creator_is_proprietary() -> None:
    assert declared_license_of("template-creator") == "Proprietary"
    assert is_declared_mit("template-creator") is False


def test_unknown_plugin_raises() -> None:
    with pytest.raises(LicenseAuditError):
        declared_license_of("no-such-plugin")


def test_license_text_facts() -> None:
    assert LICENSE_FILE_REL.endswith("LICENSE.txt")
    assert LICENSE_FILE_BYTES == 1437
    assert COPYRIGHT_LINE == "Copyright 2026 OpenAI. All rights reserved."
    assert COPYRIGHT_HOLDER == "OpenAI"
    assert COPYRIGHT_YEAR == 2026
    assert RIGHTS_RESERVED is True


def test_five_prohibitions() -> None:
    assert len(PROHIBITIONS) == PROHIBITION_COUNT == 5
    assert is_restricted("reproduce-or-copy-except-temporary-authorized-use")
    assert is_restricted("distribute-sublicense-or-transfer-derivative-works")
    assert is_restricted("not-a-real-prohibition") is False


def test_conflict_is_recorded_not_resolved_conveniently() -> None:
    assert METADATA_CONFLICTS_WITH_TEXT is True
    assert OPERATIVE_INSTRUMENT == "shipped-licence-text"


def test_vendoring_is_blocked() -> None:
    assert VENDOR_ALLOWED is False
    assert REPRODUCTION_ALLOWED is False
    assert DERIVATIVE_DISTRIBUTION_ALLOWED is False
    assert REVERSE_ENGINEERING_ALLOWED_BY_TEXT is False


def test_earlier_work_is_covered_by_the_same_text() -> None:
    assert PRIOR_ANALYSIS_WORK_ALSO_RESTRICTED is True


def test_permitted_use_and_fallback() -> None:
    assert PERMITTED_USE == "governed-by-agreement-with-openai"
    assert NO_SEPARATE_AGREEMENT_FALLBACK == "terms-of-use-or-services-agreement"
    assert COMPLIANT_PATH == "obtain-explicit-licence-or-use-only-through-the-service"


def test_audit_mapping_shape() -> None:
    a = audit()
    assert a["declared_mit"] == 4
    assert a["vendor_allowed"] is False
    assert a["prohibitions"] == 5
    assert a["conflict"] is True


def test_validate_rejects_a_flipped_vendor_flag(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.core.codex_plugin_license_audit.VENDOR_ALLOWED", True)
    with pytest.raises(LicenseAuditError):
        validate_audit()


def test_validate_rejects_a_shortened_prohibition_list(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.core.codex_plugin_license_audit.PROHIBITION_COUNT", 3
    )
    with pytest.raises(LicenseAuditError):
        validate_audit()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
