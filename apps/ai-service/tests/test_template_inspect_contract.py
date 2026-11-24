# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Tests for the template inspection contract (R125)."""

from __future__ import annotations

import pytest

from app.core.template_inspect_contract import (
    EXPORT_ACCEPTS_BLOB_OR_BYTES,
    EXPORT_FORMATS,
    EXPORT_RETURNS_BLOB,
    EXTERNAL_BINARY,
    EXTERNAL_BINARY_PRESENT_LOCALLY,
    FENCED_TO_WORKSPACE,
    FONT_PATTERN,
    FONT_XML_ROOTS,
    HALF_THE_SCRIPT_IS_RUNNABLE,
    INSPECT_ADMITS_OMISSION,
    INSPECT_KIND,
    INSPECT_MAX_CHARS,
    INSPECT_METADATA_KEYS,
    MEASURED,
    MEASURED_COUNT,
    OUTPUT_DIR_DEFAULT,
    OUTPUT_FILES,
    OUTPUT_REBUILT_NOT_MERGED,
    OUTPUT_SUBDIRS,
    PACKAGE_PART_COUNTS,
    SAFETY_CONSTRAINTS,
    SCALE_MUST_BE_POSITIVE,
    SLIDE_ENUMERATION_TWO_SHAPES,
    TABLE_COUNT_INDEPENDENT_OF_API,
    TABLE_MARKER,
    TRUNCATION_RECORDED_IN_MANIFEST,
    WORKSPACE_ROOT_REJECTED,
    ZIP_SCANS,
    coverage,
    identifies_five_types,
    part_counts_agree,
    validate_contract,
)


def test_contract_validates() -> None:
    validate_contract()


def test_default_output_directory() -> None:
    assert OUTPUT_DIR_DEFAULT == "template-inspect"


def test_three_output_subdirectories() -> None:
    assert OUTPUT_SUBDIRS == ("source-slides", "layouts", "assets/ppt/media")


def test_two_output_files() -> None:
    assert OUTPUT_FILES == ("template-inspect.ndjson", "template-manifest.json")


def test_output_is_rebuilt_not_merged() -> None:
    """A stale ndjson from an earlier run must not survive into a new manifest."""
    assert OUTPUT_REBUILT_NOT_MERGED is True


def test_output_directory_is_fenced_twice() -> None:
    assert FENCED_TO_WORKSPACE is True
    assert WORKSPACE_ROOT_REJECTED is True


def test_three_safety_constraints() -> None:
    assert len(SAFETY_CONSTRAINTS) == 3


def test_inspect_selector_names_five_record_types() -> None:
    assert identifies_five_types(INSPECT_KIND) is True
    assert "slide" in INSPECT_KIND
    assert "table" in INSPECT_KIND
    assert "chart" in INSPECT_KIND


def test_inspect_selector_rejects_a_typo() -> None:
    assert identifies_five_types("slide,textbox,shape,image,table") is False


def test_inspect_char_budget() -> None:
    assert INSPECT_MAX_CHARS == 200_000


def test_inspect_metadata_has_four_keys() -> None:
    assert len(INSPECT_METADATA_KEYS) == 4


def test_the_api_may_admit_omitted_records() -> None:
    """A record set that says 'I omitted some' beats a clean count that lost them."""
    assert INSPECT_ADMITS_OMISSION is True
    assert "omittedRecords" in INSPECT_METADATA_KEYS
    assert "abbreviatedRecords" in INSPECT_METADATA_KEYS


def test_truncation_reaches_the_manifest() -> None:
    assert TRUNCATION_RECORDED_IN_MANIFEST is True


def test_three_zip_scans() -> None:
    assert len(ZIP_SCANS) == 3
    assert "ppt/media/*" in ZIP_SCANS


def test_table_slides_are_counted_from_xml() -> None:
    """Not from the API's table records, so the two can disagree."""
    assert TABLE_MARKER == "<a:tbl>"
    assert TABLE_COUNT_INDEPENDENT_OF_API is True


def test_four_package_part_counts() -> None:
    assert PACKAGE_PART_COUNTS == (
        "mediaCount",
        "slideXmlCount",
        "chartCount",
        "tableSlideCount",
    )


def test_four_font_xml_families() -> None:
    assert len(FONT_XML_ROOTS) == 4
    assert "ppt/slideMasters" in FONT_XML_ROOTS


def test_font_pattern_is_typeface() -> None:
    assert FONT_PATTERN == 'typeface="..."'


def test_two_export_formats() -> None:
    assert EXPORT_FORMATS == ("png", "layout")


def test_export_returns_a_blob() -> None:
    """A naive isinstance(bytes) check would reject every export."""
    assert EXPORT_RETURNS_BLOB is True
    assert EXPORT_ACCEPTS_BLOB_OR_BYTES is True


def test_slide_enumeration_accepts_two_shapes() -> None:
    assert SLIDE_ENUMERATION_TWO_SHAPES is True


def test_scale_must_be_positive() -> None:
    assert SCALE_MUST_BE_POSITIVE is True


def test_the_zip_reader_calls_unzip() -> None:
    assert EXTERNAL_BINARY == "unzip"


def test_unzip_is_measured_absent_not_assumed() -> None:
    assert EXTERNAL_BINARY_PRESENT_LOCALLY is False


def test_six_measured_legs() -> None:
    assert len(MEASURED) == MEASURED_COUNT == 6


def test_the_import_leg_is_measured_working() -> None:
    assert any(r.leg == "importPptx" and r.ok for r in MEASURED)


def test_the_inspect_leg_is_measured_working() -> None:
    assert any(r.leg == "inspect" and r.ok for r in MEASURED)


def test_the_zip_leg_is_measured_failing() -> None:
    assert any(r.leg == "zip listing" and r.ok is False for r in MEASURED)


def test_half_the_script_is_runnable() -> None:
    """Import, enumerate, render and inspect work; the packaging leg is blocked."""
    assert HALF_THE_SCRIPT_IS_RUNNABLE is True


def test_part_counts_from_two_sources_must_agree() -> None:
    assert part_counts_agree(1, 1) is True
    assert part_counts_agree(1, 2) is False


def test_coverage_reports_the_tables() -> None:
    c = coverage()
    assert c["zip_scans"] == 3
    assert c["package_part_counts"] == 4
    assert c["font_xml_roots"] == 4
    assert c["inspect_metadata_keys"] == 4
    assert c["export_formats"] == 2
    assert c["safety_constraints"] == 3
    assert c["measured_legs"] == 6


def test_claiming_unzip_is_present_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import template_inspect_contract as c

    monkeypatch.setattr(c, "EXTERNAL_BINARY_PRESENT_LOCALLY", True)
    with pytest.raises(ValueError):
        c.validate_contract()


def test_claiming_output_is_merged_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import template_inspect_contract as c

    monkeypatch.setattr(c, "OUTPUT_REBUILT_NOT_MERGED", False)
    with pytest.raises(ValueError):
        c.validate_contract()


def test_claiming_omission_need_not_be_admitted_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import template_inspect_contract as c

    monkeypatch.setattr(c, "INSPECT_ADMITS_OMISSION", False)
    with pytest.raises(ValueError):
        c.validate_contract()


def test_claiming_the_zip_leg_works_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import template_inspect_contract as c

    monkeypatch.setattr(
        c,
        "MEASURED",
        tuple(r for r in c.MEASURED if r.leg != "zip listing"),
    )
    with pytest.raises(ValueError):
        c.validate_contract()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
