# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Tests for the template creator request contract (R123)."""

from __future__ import annotations

import pytest

from app.core.template_creator_contract import (
    ANGLE_BRACKETS_REJECTED,
    DEFAULT_GALLERY_KIND,
    DESCRIPTION_MAX,
    DISPLAY_NAME_MAX,
    GALLERY_KIND_ONLY_FOR_IMAGE,
    GOOGLE_PATH_BY_KIND,
    INFERENCE_ENTRY_COUNT,
    INFERRED_BY_EXTENSION,
    KIND_COUNT,
    KINDS,
    LOCK_OWNER_GRACE_MS,
    MAX_SKILL_NAME_LENGTH,
    MODES,
    NO_SEND_JUST_BECAUSE_INVOKED,
    PNG_CRC_VERIFIED_PER_CHUNK,
    PNG_FIRST_CHUNK,
    PNG_FIRST_CHUNK_LENGTH,
    RULE_COUNT,
    SITE_HOSTING_METADATA,
    SITE_PREVIEW_IS_BUNDLED,
    SITE_WORKFLOW_STEPS,
    SOURCE_URL_ONLY_FOR_GOOGLE,
    SOURCE_URL_REQUIRED_FOR_GOOGLE,
    TEMPLATE_PREFIX,
    TEXT_KINDS_FORBID_SENDING,
    TXT_CANNOT_BE_INFERRED,
    VALIDATION_RULES,
    coverage,
    has_valid_png_structure,
    inferred_kind,
    single_line_is_legal,
    skill_name_is_legal,
    validate_contract,
)


def test_contract_validates() -> None:
    validate_contract()


def test_ten_kinds() -> None:
    assert len(KINDS) == KIND_COUNT == 10


def test_kind_names() -> None:
    names = [k.name for k in KINDS]
    assert names == [
        "document",
        "presentation",
        "spreadsheet",
        "google-docs",
        "google-slides",
        "google-sheets",
        "site",
        "image",
        "email",
        "slack",
    ]


def test_only_site_takes_a_directory() -> None:
    dirs = [k for k in KINDS if k.reference_is_directory]
    assert len(dirs) == 1
    assert dirs[0].name == "site"
    assert dirs[0].extension is None


def test_only_site_has_no_preview_path() -> None:
    assert all(k.needs_preview_path for k in KINDS if k.name != "site")


def test_google_kinds_need_a_source_url() -> None:
    needing = {k.name for k in KINDS if k.needs_source_url}
    assert needing == {"google-docs", "google-slides", "google-sheets"}


def test_four_inference_entries() -> None:
    assert len(INFERRED_BY_EXTENSION) == INFERENCE_ENTRY_COUNT == 4


def test_png_infers_image_not_google() -> None:
    """This is why the Google kinds must be declared explicitly."""
    assert inferred_kind(".png") == "image"
    assert inferred_kind(".PNG") == "image"


def test_docx_pptx_xlsx_infer_their_office_kind() -> None:
    assert inferred_kind(".docx") == "document"
    assert inferred_kind(".pptx") == "presentation"
    assert inferred_kind(".xlsx") == "spreadsheet"


def test_txt_cannot_be_inferred() -> None:
    assert TXT_CANNOT_BE_INFERRED is True
    assert inferred_kind(".txt") is None


def test_unknown_extension_infers_nothing() -> None:
    assert inferred_kind(".md") is None


def test_google_sheets_path_is_plural() -> None:
    assert GOOGLE_PATH_BY_KIND["google-sheets"] == "spreadsheets"
    assert GOOGLE_PATH_BY_KIND["google-docs"] == "document"
    assert GOOGLE_PATH_BY_KIND["google-slides"] == "presentation"


def test_gallery_kind_only_for_image() -> None:
    assert GALLERY_KIND_ONLY_FOR_IMAGE is True
    assert DEFAULT_GALLERY_KIND == "imagegen"


def test_source_url_constraint_is_two_way() -> None:
    assert SOURCE_URL_ONLY_FOR_GOOGLE is True
    assert SOURCE_URL_REQUIRED_FOR_GOOGLE is True


def test_site_preview_is_bundled() -> None:
    assert SITE_PREVIEW_IS_BUNDLED is True


def test_site_hosting_metadata_path() -> None:
    assert SITE_HOSTING_METADATA == ".openai/hosting.json"


def test_png_signature_is_the_eight_byte_magic() -> None:
    good = bytes((137, 80, 78, 71, 13, 10, 26, 10))
    assert has_valid_png_structure(good, "IHDR", 13) is True


def test_png_with_wrong_first_chunk_is_rejected() -> None:
    good = bytes((137, 80, 78, 71, 13, 10, 26, 10))
    assert has_valid_png_structure(good, "IDAT", 13) is False


def test_png_with_wrong_ihdr_length_is_rejected() -> None:
    good = bytes((137, 80, 78, 71, 13, 10, 26, 10))
    assert has_valid_png_structure(good, "IHDR", 12) is False


def test_png_with_broken_signature_is_rejected() -> None:
    bad = bytes((137, 80, 78, 71, 0, 0, 0, 0))
    assert has_valid_png_structure(bad, "IHDR", 13) is False


def test_png_reader_verifies_crc_and_end() -> None:
    assert PNG_CRC_VERIFIED_PER_CHUNK is True
    assert PNG_FIRST_CHUNK == "IHDR"
    assert PNG_FIRST_CHUNK_LENGTH == 13


def test_skill_name_must_use_the_prefix() -> None:
    assert TEMPLATE_PREFIX == "artifact-template-"
    assert skill_name_is_legal("artifact-template-standup") is True


def test_skill_name_rejects_bad_forms() -> None:
    assert skill_name_is_legal("standup") is False
    assert skill_name_is_legal("artifact-template-") is False
    assert skill_name_is_legal("artifact-template-Standup") is False
    assert skill_name_is_legal("artifact-template-a__b") is False


def test_skill_name_length_bound() -> None:
    assert MAX_SKILL_NAME_LENGTH == 64
    too_long = "artifact-template-" + "a" * 60
    assert len(too_long) > 64
    assert skill_name_is_legal(too_long) is False


def test_single_line_accepts_plain_text() -> None:
    assert single_line_is_legal("Quarterly Review", DISPLAY_NAME_MAX) is True


def test_single_line_rejects_angle_brackets() -> None:
    """An injection guard: the values are interpolated into markdown and YAML."""
    assert ANGLE_BRACKETS_REJECTED is True
    assert single_line_is_legal("a < b", DISPLAY_NAME_MAX) is False
    assert single_line_is_legal("a > b", DISPLAY_NAME_MAX) is False


def test_single_line_rejects_control_chars() -> None:
    assert single_line_is_legal("line\nbreak", DISPLAY_NAME_MAX) is False
    assert single_line_is_legal("carriage\rreturn", DISPLAY_NAME_MAX) is False
    assert single_line_is_legal("nul\x00byte", DISPLAY_NAME_MAX) is False


def test_single_line_respects_the_limit() -> None:
    assert DISPLAY_NAME_MAX == 64
    assert DESCRIPTION_MAX == 600
    assert single_line_is_legal("x" * 64, DISPLAY_NAME_MAX) is True
    assert single_line_is_legal("x" * 65, DISPLAY_NAME_MAX) is False


def test_twelve_validation_rules() -> None:
    assert len(VALIDATION_RULES) == RULE_COUNT == 12


def test_two_modes() -> None:
    assert MODES == ("create", "update")


def test_site_workflow_has_five_spelled_out_steps() -> None:
    assert SITE_WORKFLOW_STEPS == 5


def test_text_kinds_may_not_send() -> None:
    assert NO_SEND_JUST_BECAUSE_INVOKED is True
    assert set(TEXT_KINDS_FORBID_SENDING) == {"email", "slack"}


def test_lock_grace_is_thirty_seconds() -> None:
    assert LOCK_OWNER_GRACE_MS == 30_000


def test_coverage_reports_the_tables() -> None:
    c = coverage()
    assert c["kinds"] == 10
    assert c["inference_entries"] == 4
    assert c["google_kinds"] == 3
    assert c["validation_rules"] == 12


def test_claiming_txt_can_be_inferred_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import template_creator_contract as c

    monkeypatch.setattr(c, "TXT_CANNOT_BE_INFERRED", False)
    with pytest.raises(ValueError):
        c.validate_contract()


def test_claiming_png_infers_google_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import template_creator_contract as c

    monkeypatch.setitem(c.INFERRED_BY_EXTENSION, ".png", "google-docs")
    with pytest.raises(ValueError):
        c.validate_contract()


def test_claiming_gallery_kind_is_general_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import template_creator_contract as c

    monkeypatch.setattr(c, "GALLERY_KIND_ONLY_FOR_IMAGE", False)
    with pytest.raises(ValueError):
        c.validate_contract()


def test_claiming_angle_brackets_are_fine_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import template_creator_contract as c

    monkeypatch.setattr(c, "ANGLE_BRACKETS_REJECTED", False)
    with pytest.raises(ValueError):
        c.validate_contract()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
