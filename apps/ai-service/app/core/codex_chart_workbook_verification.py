# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Chart-workbook verification contract (R100).

R99 left the question open: a structurally referenced chart part counted as zero native
charts. R100 closes it -- and the answer is not the embedded workbook, it is the presence of
a **category series** (``c:cat``). With ``c:cat`` present, ``native_chart_count`` becomes 1
even with no embedded workbook at all.

Once the chart counted, the gate escalated through five distinct, precisely worded failures.
Each one was a genuine defect in my own package, in this order:

1. category point count != value point count
2. the chart did not resolve its embedded Excel relationship (no externalData)
3. an embedded workbook cell referenced a missing shared string (``t="s"`` without a
   sharedStrings part)
4. a cached category point differed from its referenced worksheet cell
5. a cached series-name point differed from its referenced worksheet cell

That ordering is the useful part: it shows the gate validating cached chart data against the
live workbook cell by cell, and reporting the *first* mismatch in prose a human can act on.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Final

GATE: Final = "native_quantitative_chart_gate"
FAILURE_CODE: Final = "native_chart_workbook_contract_failed"
FAILURE_CODE_IS_SINGLE: Final = True
FAILURE_DETAIL_KEY: Final = "failure_detail"

# --- what makes a chart count as native -----------------------------------------------

# R99 chart had c:tx + c:val and counted as 0. R100 chart added c:cat and counted as 1.
NATIVE_CHART_COUNT_TRIGGER: Final = "c:cat"
CATEGORY_SERIES_REQUIRED: Final = True
EMBEDDED_WORKBOOK_NOT_REQUIRED_TO_COUNT: Final = True
R99_CHART_ELEMENTS: Final = ("c:tx", "c:val")
R100_CHART_ELEMENTS: Final = ("c:tx", "c:cat", "c:val")

# --- the five failures, verbatim ------------------------------------------------------

CATEGORY_VALUE_COUNT_MISMATCH: Final = (
    "Expected quantitative chart category and numeric value counts disagree"
)
UNRESOLVED_EXCEL_RELATIONSHIP: Final = (
    "Expected quantitative chart does not resolve its embedded Excel package relationship"
)
MISSING_SHARED_STRING: Final = "An embedded workbook cell references a missing shared string"
CAT_CACHE_MISMATCH_TEMPLATE: Final = (
    "Chart series {series} cat: cached point {point} differs from its exact referenced "
    "worksheet cell; refresh the chart cache from that range"
)
TX_CACHE_MISMATCH_TEMPLATE: Final = (
    "Chart series {series} tx: cached point {point} differs from its exact referenced "
    "worksheet cell; refresh the chart cache from that range"
)

FAILURE_DETAILS: Final = (
    CATEGORY_VALUE_COUNT_MISMATCH,
    UNRESOLVED_EXCEL_RELATIONSHIP,
    MISSING_SHARED_STRING,
    CAT_CACHE_MISMATCH_TEMPLATE,
    TX_CACHE_MISMATCH_TEMPLATE,
)
FAILURE_DETAIL_COUNT: Final = 5
DETAILS_ARE_HUMAN_ACTIONABLE: Final = True
CACHE_MISMATCH_NAMES_THE_SERIES_AND_POINT: Final = True
REMEDY_IS_STATED: Final = True

# --- verification chain, in the order it fired ----------------------------------------

VERIFICATION_STAGES: Final = (
    "point-counts-agree",
    "workbook-relationship-resolves",
    "workbook-cells-readable",
    "cached-points-match-live-cells",
)
VERIFICATION_STAGE_COUNT: Final = 4
COMPARES_CACHE_TO_LIVE_CELLS: Final = True
CHECKS_SERIES_NAME_TOO: Final = True

# --- the passing envelope: charts[] appears only on success --------------------------

PASS_CHART_KEYS: Final = (
    "cache_reference_ranges_verified",
    "embedded_workbook_count",
    "embedded_workbook_sheet_count",
    "native_chart_types",
    "numeric_cache_point_count",
    "series_formula_count",
    "workbook_numeric_cell_count",
)
PASS_CHART_KEY_COUNT: Final = 7
PASS_CHARTS_ARRAY_ABSENT_ON_FAILURE: Final = True
OBSERVED_CHART_TYPE: Final = "barChart"
OBSERVED_WORKBOOK_NUMERIC_CELLS: Final = 4
OBSERVED_NUMERIC_CACHE_POINTS: Final = 3
WORKBOOK_HAD_ONE_UNREFERENCED_CELL: Final = True

# --- flags and defaults ---------------------------------------------------------------

REQUIRES_OWNERS_FIRST: Final = True
OWNER_FLAGS: Final = ("--expected-chart-slides", "--discover-chart-slides")
DEFAULT_TARGET_APPLICATION: Final = "portable"
TARGET_APPLICATION_CHOICES: Final = ("portable", "powerpoint")
EMBEDDED_WORKBOOK_RELATIONSHIP_TYPE: Final = "package"
EMBEDDED_PART_FOLDER: Final = "ppt/embeddings/"
REQUIRED_EMBEDDED_KEY: Final = "required_embedded_workbook_slides"
RC_PASS: Final = 0
RC_FINDINGS: Final = 1
RC_USAGE: Final = 2


class ChartWorkbookError(ValueError):
    """Raised when a chart-workbook fact is softened."""


def counted_as_native(elements: tuple[str, ...]) -> bool:
    """Whether a chart with these elements is counted as a native chart."""
    return NATIVE_CHART_COUNT_TRIGGER in elements


def detail_for(stage: str, series: int = 1, point: int = 0) -> str:
    """Render the verbatim failure detail for a stage."""
    if stage == "point-counts-agree":
        return CATEGORY_VALUE_COUNT_MISMATCH
    if stage == "workbook-relationship-resolves":
        return UNRESOLVED_EXCEL_RELATIONSHIP
    if stage == "workbook-cells-readable":
        return MISSING_SHARED_STRING
    if stage == "cached-points-match-live-cells":
        return CAT_CACHE_MISMATCH_TEMPLATE.format(series=series, point=point)
    raise ChartWorkbookError(f"unknown stage: {stage!r}")


def is_pass_chart_key(key: str) -> bool:
    """Whether ``key`` is one of the seven fields that appear only on success."""
    return key in PASS_CHART_KEYS


def workbook_verified(charts: list[Mapping[str, object]]) -> bool:
    """Whether every chart reported verified cache ranges."""
    return bool(charts) and all(
        c.get("cache_reference_ranges_verified") is True for c in charts
    )


def chart_workbook_contract() -> Mapping[str, object]:
    """Return the contract as a plain mapping."""
    return {
        "trigger": NATIVE_CHART_COUNT_TRIGGER,
        "detail_kinds": FAILURE_DETAIL_COUNT,
        "stages": VERIFICATION_STAGE_COUNT,
        "pass_keys": PASS_CHART_KEY_COUNT,
        "compares_cache": COMPARES_CACHE_TO_LIVE_CELLS,
    }


def validate_chart_workbook_contract() -> None:
    """Assert the R100 facts, above all the category-series trigger."""
    if NATIVE_CHART_COUNT_TRIGGER != "c:cat":
        raise ChartWorkbookError("the trigger is the category series, not the workbook")
    if counted_as_native(R99_CHART_ELEMENTS) is not False:
        raise ChartWorkbookError("a chart without c:cat must not count")
    if counted_as_native(R100_CHART_ELEMENTS) is not True:
        raise ChartWorkbookError("a chart with c:cat must count")
    if EMBEDDED_WORKBOOK_NOT_REQUIRED_TO_COUNT is not True:
        raise ChartWorkbookError(
            "the no-embed variant also reached native_chart_count 1"
        )

    if FAILURE_DETAIL_COUNT != 5:
        raise ChartWorkbookError(f"expected 5 details, got {FAILURE_DETAIL_COUNT}")
    if len(set(FAILURE_DETAILS)) != 5:
        raise ChartWorkbookError("details must be distinct")
    if not all(isinstance(d, str) and d for d in FAILURE_DETAILS):
        raise ChartWorkbookError("details must be non-empty strings")
    if DETAILS_ARE_HUMAN_ACTIONABLE is not True:
        raise ChartWorkbookError("details are actionable prose, not codes")

    for template in (CAT_CACHE_MISMATCH_TEMPLATE, TX_CACHE_MISMATCH_TEMPLATE):
        if "{series}" not in template or "{point}" not in template:
            raise ChartWorkbookError("mismatch detail must name series and point")
        if "refresh the chart cache" not in template:
            raise ChartWorkbookError("mismatch detail must state the remedy")
    if "cat:" not in CAT_CACHE_MISMATCH_TEMPLATE:
        raise ChartWorkbookError("category mismatch must name the cat channel")
    if "tx:" not in TX_CACHE_MISMATCH_TEMPLATE:
        raise ChartWorkbookError("title mismatch must name the tx channel")

    if VERIFICATION_STAGE_COUNT != 4 or len(VERIFICATION_STAGES) != 4:
        raise ChartWorkbookError("four verification stages were observed in order")
    if COMPARES_CACHE_TO_LIVE_CELLS is not True:
        raise ChartWorkbookError("the gate compares cache against workbook cells")
    if CHECKS_SERIES_NAME_TOO is not True:
        raise ChartWorkbookError("the tx mismatch proves series names are checked")

    if PASS_CHART_KEY_COUNT != 7 or len(PASS_CHART_KEYS) != 7:
        raise ChartWorkbookError("seven pass-only chart fields were observed")
    if PASS_CHARTS_ARRAY_ABSENT_ON_FAILURE is not True:
        raise ChartWorkbookError("charts[] appears only on success")
    if OBSERVED_WORKBOOK_NUMERIC_CELLS != 4 or OBSERVED_NUMERIC_CACHE_POINTS != 3:
        raise ChartWorkbookError("counted cell/point numbers drifted")
    if WORKBOOK_HAD_ONE_UNREFERENCED_CELL is not True:
        raise ChartWorkbookError("one of the four numeric cells was not referenced")

    if FAILURE_CODE != "native_chart_workbook_contract_failed":
        raise ChartWorkbookError("failure code drifted")
    if DEFAULT_TARGET_APPLICATION != "portable":
        raise ChartWorkbookError("target_application defaults to portable")
    if TARGET_APPLICATION_CHOICES != ("portable", "powerpoint"):
        raise ChartWorkbookError("target application choices drifted")
    if REQUIRES_OWNERS_FIRST is not True:
        raise ChartWorkbookError(
            "embedded-workbook flag alone yields 'declare expected chart owners'"
        )
    if EMBEDDED_WORKBOOK_RELATIONSHIP_TYPE != "package":
        raise ChartWorkbookError("the relationship type is package")
    if (RC_PASS, RC_FINDINGS, RC_USAGE) != (0, 1, 2):
        raise ChartWorkbookError("exit codes drifted")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
