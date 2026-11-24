# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Chart rejection codes and the source-figure exception (R101-R103).

The gate does not merely count charts -- it names *why* a slide fails, and the two codes found
here are the sharpest in the whole gate family:

* ``raster_picture_is_not_native_chart`` -- a bitmap does not become a chart by being placed
  where a chart belongs;
* ``approved_source_figure_missing_noneditable_disclosure`` -- even an *excused* slide must
  declare that the figure cannot be edited, or the exception does not stand.

Together they describe a two-door policy for images standing in for charts: either supply a
native chart, or declare an exception **and** disclose its non-editable nature. Neither door
can be slipped through by placement alone.

Observed conditions for the exception, each individually necessary:

1. the slide number appears in ``--expected-chart-slides``;
2. that slide carries at least one raster picture;
3. that picture is accompanied by a non-editable disclosure.

Condition 1 alone produced rc=2 with
``A source-figure exception must target an explicitly expected quantitative slide``.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Final

GATE: Final = "native_quantitative_chart_gate"

# --- result-level rejection codes, in discovery order ---------------------------------

RC_REQUIRED_NATIVE_CHART_MISSING: Final = "required_native_chart_missing"  # R99
RC_WORKBOOK_CONTRACT_FAILED: Final = "native_chart_workbook_contract_failed"  # R100
RC_RASTER_IS_NOT_CHART: Final = "raster_picture_is_not_native_chart"  # R103
RC_MISSING_NONEDITABLE_DISCLOSURE: Final = (
    "approved_source_figure_missing_noneditable_disclosure"  # R103
)

RESULT_CODES: Final = (
    RC_REQUIRED_NATIVE_CHART_MISSING,
    RC_WORKBOOK_CONTRACT_FAILED,
    RC_RASTER_IS_NOT_CHART,
    RC_MISSING_NONEDITABLE_DISCLOSURE,
)
RESULT_CODE_COUNT: Final = 4
CODES_ARE_LOWER_SNAKE: Final = True
MULTIPLE_CODES_AT_ONCE: Final = True

# --- usage-level errors (ok:false envelope, rc=2) -------------------------------------

USAGE_ENVELOPE_KEYS: Final = ("ok", "error")
USAGE_ERRORS: Final = (
    "Declare expected chart owners or explicitly request actual chart discovery",
    "Source-free chart receipts must remain inside the owner-private enforcement directory",
    "A source-figure exception must target an explicitly expected quantitative slide",
)
USAGE_ERROR_COUNT: Final = 3
USAGE_ERRORS_ARE_SENTENCES: Final = True

# --- the source-figure exception: three conditions ------------------------------------

EXCEPTION_CONDITIONS: Final = (
    "slide-number-is-in-expected-chart-slides",
    "slide-carries-a-raster-picture",
    "picture-has-noneditable-disclosure",
)
EXCEPTION_CONDITION_COUNT: Final = 3
EXCEPTION_FLAG: Final = "--approved-source-figure"
EXCEPTION_FLAG_TAKES_SLIDE_NUMBER: Final = True
EXCEPTION_FLAG_REJECTS_DIGEST: Final = True
EXCEPTION_VALUE_IS_PAGE_NUMBER_NOT_HASH: Final = True
NONEDITABLE_DISCLOSURE_REQUIRED: Final = True
EXCEPTION_NEVER_GRANTED_IN_PROBES: Final = True

# --- counters are independent -----------------------------------------------------------

COUNTS_NATIVE_AND_RASTER_SEPARATELY: Final = True
RASTER_DOES_NOT_COUNT_AS_NATIVE: Final = True
OBSERVED_RASTER_WITH_ZERO_NATIVE: Final = True

# --- the receipt directory constraint -------------------------------------------------

RECEIPT_FLAG: Final = "--receipt"
RECEIPT_IS_PATH: Final = True
RECEIPT_MUST_BE_INSIDE: Final = "owner-private-enforcement-directory"
RECEIPT_DIRECTORY_LOCATED: Final = False
RECEIPT_WRITTEN_IN_PROBES: Final = False


class ChartRejectionError(ValueError):
    """Raised when a rejection-code fact is softened."""


def is_result_code(code: str) -> bool:
    """Whether ``code`` is a result-level rejection code."""
    return code in RESULT_CODES


def is_usage_error(message: str) -> bool:
    """Whether ``message`` is an observed usage-level error sentence."""
    return message in USAGE_ERRORS


def raster_can_satisfy_native() -> bool:
    """A raster picture never satisfies a native-chart requirement."""
    return False


def exception_grantable(
    in_expected: bool, has_raster: bool, has_disclosure: bool
) -> bool:
    """Whether the source-figure exception would hold, given the three conditions."""
    return bool(in_expected and has_raster and has_disclosure)


def rejection_contract() -> Mapping[str, object]:
    """Return the rejection contract as a plain mapping."""
    return {
        "result_codes": RESULT_CODE_COUNT,
        "usage_errors": USAGE_ERROR_COUNT,
        "exception_conditions": EXCEPTION_CONDITION_COUNT,
        "raster_satisfies_native": raster_can_satisfy_native(),
        "receipt_dir_located": RECEIPT_DIRECTORY_LOCATED,
    }


def validate_rejection_contract() -> None:
    """Assert the rejection facts, above all that a raster is never a chart."""
    if RESULT_CODE_COUNT != 4 or len(RESULT_CODES) != 4:
        raise ChartRejectionError("four result codes were observed")
    if len(set(RESULT_CODES)) != 4:
        raise ChartRejectionError("result codes must be distinct")
    if not all(c == c.lower() and " " not in c for c in RESULT_CODES):
        raise ChartRejectionError("codes are lower_snake with no spaces")
    if CODES_ARE_LOWER_SNAKE is not True:
        raise ChartRejectionError("codes are lower_snake")
    if MULTIPLE_CODES_AT_ONCE is not True:
        raise ChartRejectionError("two codes appeared together on one slide")
    if not is_result_code(RC_RASTER_IS_NOT_CHART):
        raise ChartRejectionError("the raster code must stay recorded")
    if not is_result_code(RC_MISSING_NONEDITABLE_DISCLOSURE):
        raise ChartRejectionError("the disclosure code must stay recorded")

    if USAGE_ERROR_COUNT != 3 or len(USAGE_ERRORS) != 3:
        raise ChartRejectionError("three usage errors were observed")
    if USAGE_ENVELOPE_KEYS != ("ok", "error"):
        raise ChartRejectionError("usage failures use the ok/error envelope")
    if not USAGE_ERRORS_ARE_SENTENCES:
        raise ChartRejectionError("usage errors are full sentences")
    if not is_usage_error(
        "A source-figure exception must target an explicitly expected quantitative slide"
    ):
        raise ChartRejectionError("the exception-targeting error must be recorded")

    if EXCEPTION_CONDITION_COUNT != 3 or len(EXCEPTION_CONDITIONS) != 3:
        raise ChartRejectionError("three conditions were established")
    if EXCEPTION_FLAG != "--approved-source-figure":
        raise ChartRejectionError("exception flag drifted")
    if EXCEPTION_FLAG_TAKES_SLIDE_NUMBER is not True:
        raise ChartRejectionError("the flag takes a slide number")
    if EXCEPTION_VALUE_IS_PAGE_NUMBER_NOT_HASH is not True:
        raise ChartRejectionError("a digest value was rejected as a target")
    if EXCEPTION_FLAG_REJECTS_DIGEST is not True:
        raise ChartRejectionError("digest form rejected")
    if NONEDITABLE_DISCLOSURE_REQUIRED is not True:
        raise ChartRejectionError("the disclosure requirement is the point of the code")

    if EXCEPTION_NEVER_GRANTED_IN_PROBES is not True:
        raise ChartRejectionError(
            "the exception was never granted in these probes; do not imply success"
        )
    if exception_grantable(True, True, False) is not False:
        raise ChartRejectionError("missing disclosure must block the exception")
    if exception_grantable(True, False, True) is not False:
        raise ChartRejectionError("missing raster must block the exception")
    if exception_grantable(False, True, True) is not False:
        raise ChartRejectionError("an unexpected slide must block the exception")
    if exception_grantable(True, True, True) is not True:
        raise ChartRejectionError("all three conditions together grant it")

    if COUNTS_NATIVE_AND_RASTER_SEPARATELY is not True:
        raise ChartRejectionError("native_chart_count and raster_picture_count are separate")
    if RASTER_DOES_NOT_COUNT_AS_NATIVE is not True:
        raise ChartRejectionError("a raster never counts as native")
    if raster_can_satisfy_native() is not False:
        raise ChartRejectionError("raster_can_satisfy_native must stay False")
    if OBSERVED_RASTER_WITH_ZERO_NATIVE is not True:
        raise ChartRejectionError("the probe had raster=1 and native=0")

    if RECEIPT_FLAG != "--receipt":
        raise ChartRejectionError("receipt flag drifted")
    if RECEIPT_IS_PATH is not True:
        raise ChartRejectionError("receipt takes a path")
    if RECEIPT_MUST_BE_INSIDE != "owner-private-enforcement-directory":
        raise ChartRejectionError("the directory constraint is quoted verbatim")
    if RECEIPT_DIRECTORY_LOCATED is not False:
        raise ChartRejectionError(
            "the enforcement directory was not located; do not claim it was"
        )
    if RECEIPT_WRITTEN_IN_PROBES is not False:
        raise ChartRejectionError("no receipt file was ever written")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
