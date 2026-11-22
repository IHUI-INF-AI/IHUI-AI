# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""The source-figure exception: what actually grants it (R104-R106).

R101 knew the exception needed a "non-editable disclosure" but not where it lived. This module
records the answer, established by running the gate against decks that differed only in the
carrier and the wording.

Carrier: **slide text**, never picture metadata
    A picture whose ``cNvPr`` name is "Source figure (non-editable)", and one whose ``descr``
    says the same, both still fail. Only a text run on the slide clears the code.

Wording: two halves, both required
    ``source figure`` must appear, *and* one of the non-editable spellings must appear.
    "Source figure" alone, or "non-editable" alone, still fails. Reversed order passes.
    Upper case passes. Comma or no comma passes.

Scope: the whole slide, not one run
    Splitting the two halves across two separate shapes still passes, so the match runs over
    the slide's concatenated text rather than per paragraph.

Separators: hyphen, space, nothing -- but not underscore
    "non-editable", "noneditable", "non editable", "not editable" all pass.
    "non_editable" fails: the underscore is not treated as a word break.
"""

from __future__ import annotations

import re
from collections.abc import Iterable
from typing import Final

# --- carrier -----------------------------------------------------------------------------

DISCLOSURE_CARRIER: Final = "slide-text"
PICTURE_NAME_WORKS: Final = False
PICTURE_DESCRIPTION_WORKS: Final = False
TEXT_RUN_IS_REQUIRED: Final = True

# --- wording ---------------------------------------------------------------------------

SOURCE_HALF: Final = "source figure"
NONEDITABLE_SPELLINGS: Final = (
    "non-editable",
    "noneditable",
    "non editable",
    "not editable",
)
REVERSED_ORDER_OK: Final = True
CASE_INSENSITIVE: Final = True
COMMA_IRRELEVANT: Final = True

ACCEPTED_DISCLOSURE_PHRASES: Final = (
    "Source figure, non-editable",
    "Source figure non-editable",
    "SOURCE FIGURE, NON-EDITABLE",
    "Source figure, noneditable",
    "Source figure, non editable",
    "The source figure is non-editable",
    "Source figure, not editable",
)
REJECTED_DISCLOSURE_PHRASES: Final = (
    "Source figure",
    "non-editable",
    "Source figure, non_editable",
    "Not editable",
)
ACCEPTED_COUNT: Final = 7
REJECTED_COUNT: Final = 4

SLIDE_SCOPED: Final = True
CROSS_SHAPE_OK: Final = True
ORDER_INDEPENDENT: Final = True

# --- the three conditions, now all reachable --------------------------------------------

CONDITION_EXPECTED: Final = "slide-in-expected-chart-slides"
CONDITION_RASTER: Final = "slide-has-raster-picture"
CONDITION_DISCLOSURE: Final = "slide-text-has-disclosure"
EXCEPTION_CONDITIONS: Final = (
    CONDITION_EXPECTED,
    CONDITION_RASTER,
    CONDITION_DISCLOSURE,
)
EXCEPTION_FLAG: Final = "--approved-source-figure"
EXCEPTION_GRANTED_IN_PROBES: Final = True
EXCEPTION_GRANTED_EXIT_CODE: Final = 0


class SourceFigureError(ValueError):
    """Raised when a disclosure fact is softened."""


def slide_has_disclosure(slide_text: str) -> bool:
    """Whether the slide's concatenated text carries a valid non-editable disclosure."""
    t = slide_text.lower()
    if SOURCE_HALF not in t:
        return False
    return any(spelling in t for spelling in NONEDITABLE_SPELLINGS)


def disclosure_from_shapes(texts: Iterable[str]) -> bool:
    """Judge a slide built from several shapes; the match spans the whole slide."""
    return slide_has_disclosure(" ".join(texts))


def exception_grantable(
    in_expected: bool, has_raster: bool, has_disclosure: bool
) -> bool:
    """All three conditions must hold."""
    return bool(in_expected and has_raster and has_disclosure)


def normalises_separators() -> re.Pattern[str]:
    """The separator set: hyphen or space separate the halves, underscore does not."""
    return re.compile(r"[\s-]+")


def validate_disclosure_contract() -> None:
    """Assert the disclosure facts, above all that metadata does not carry it."""
    if DISCLOSURE_CARRIER != "slide-text":
        raise SourceFigureError("the disclosure lives in slide text")
    if TEXT_RUN_IS_REQUIRED is not True:
        raise SourceFigureError("a text run is required")
    if PICTURE_NAME_WORKS is not False:
        raise SourceFigureError("a picture name was tested and did not work")
    if PICTURE_DESCRIPTION_WORKS is not False:
        raise SourceFigureError("a picture description was tested and did not work")

    for phrase in ACCEPTED_DISCLOSURE_PHRASES:
        if not slide_has_disclosure(phrase):
            raise SourceFigureError(f"accepted phrase must pass: {phrase!r}")
    for phrase in REJECTED_DISCLOSURE_PHRASES:
        if slide_has_disclosure(phrase):
            raise SourceFigureError(f"rejected phrase must fail: {phrase!r}")

    if len(ACCEPTED_DISCLOSURE_PHRASES) != ACCEPTED_COUNT:
        raise SourceFigureError("accepted-phrase count drifted")
    if len(REJECTED_DISCLOSURE_PHRASES) != REJECTED_COUNT:
        raise SourceFigureError("rejected-phrase count drifted")
    if slide_has_disclosure("Source figure, non_editable"):
        raise SourceFigureError("underscore must not join the halves")
    if not slide_has_disclosure("non-editable source figure"):
        raise SourceFigureError("reversed order must pass")
    if not disclosure_from_shapes(["Source figure", "non-editable"]):
        raise SourceFigureError("the match spans the whole slide")
    if REVERSED_ORDER_OK is not True or CASE_INSENSITIVE is not True:
        raise SourceFigureError("order and case are irrelevant")
    if COMMA_IRRELEVANT is not True:
        raise SourceFigureError("commas are irrelevant")

    if SLIDE_SCOPED is not True or CROSS_SHAPE_OK is not True:
        raise SourceFigureError("scope is the slide")
    if ORDER_INDEPENDENT is not True:
        raise SourceFigureError("order is independent")

    if EXCEPTION_CONDITIONS != (
        CONDITION_EXPECTED,
        CONDITION_RASTER,
        CONDITION_DISCLOSURE,
    ):
        raise SourceFigureError("three conditions")
    if exception_grantable(True, True, True) is not True:
        raise SourceFigureError("all three grant it")
    if exception_grantable(True, True, False) is not False:
        raise SourceFigureError("missing disclosure blocks it")
    if EXCEPTION_GRANTED_IN_PROBES is not True:
        raise SourceFigureError("the exception was granted in probes")
    if EXCEPTION_GRANTED_EXIT_CODE != 0:
        raise SourceFigureError("granted means exit zero")
    if EXCEPTION_FLAG != "--approved-source-figure":
        raise SourceFigureError("flag drifted")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
