# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""The two chart targets: portable and powerpoint carry different data models (R103).

``--target-application`` looked like a cosmetic default. It is not. The same chart part --
inline literal data with no formula and no workbook -- fails under one target and passes under
the other:

* **portable** (the default) requires a unique embedded Excel externalData relationship;
* **powerpoint** accepts complete inline literal data and requires no workbook at all.

So the flag switches which *editability evidence* the gate will recognise, not merely the
tolerance level. A deck that ships without a workbook is valid in exactly one of these modes,
and the counter names tell you which one you are in.

This also corrects R100: "a chart without an embedded workbook fails" was only true under
portable. Under explicit PowerPoint targeting the workbook is not required at all.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Final

TARGETS: Final = ("portable", "powerpoint")
TARGET_COUNT: Final = 2
DEFAULT_TARGET: Final = "portable"
FLAG: Final = "--target-application"

# --- the two data models ---------------------------------------------------------------

# portable: a reference into an embedded workbook, plus its cached values
PORTABLE_ELEMENTS: Final = ("c:numRef", "c:strRef", "c:numCache", "c:strCache", "c:externalData")
PORTABLE_REQUIRES_WORKBOOK: Final = True
PORTABLE_REQUIRES_EXTERNAL_DATA: Final = True
PORTABLE_XMLNS: Final = "http://schemas.openxmlformats.org/drawingml/2006/chart"

# powerpoint: values carried inline, no formula, no workbook
LITERAL_ELEMENTS: Final = ("c:numLit", "c:strLit")
POWERPOINT_ACCEPTS_LITERAL: Final = True
POWERPOINT_REQUIRES_WORKBOOK: Final = False
POWERPOINT_TOLERATES_ZERO_WORKBOOK: Final = True

LITERAL_CARRIES_NO_FORMULA: Final = True
LITERAL_SERIES_FORMULA_COUNT: Final = 0
LITERAL_NUMERIC_POINT_COUNT: Final = 3
LITERAL_NUMERIC_CACHE_POINT_COUNT: Final = 0
CACHE_AND_LITERAL_ARE_SEPARATE_COUNTERS: Final = True

# --- editability evidence -------------------------------------------------------------

EDITABILITY_EVIDENCE: Final = (
    "powerpoint_native_literal",  # observed for the literal deck under powerpoint
)
EVIDENCE_OBSERVED_COUNT: Final = 1
EVIDENCE_IS_A_FIELD: Final = True

# --- the failure text portable gives for literal data ---------------------------------

PORTABLE_REJECTION_DETAIL: Final = (
    "Expected quantitative chart lacks a unique embedded Excel externalData relationship"
)
PORTABLE_REJECTION_CODE: Final = "native_chart_workbook_contract_failed"

# --- observed verdicts for one and the same literal deck --------------------------------

OBSERVED_VERDICTS: Final = {
    "portable": {"passed": False, "exit_code": 1, "code": PORTABLE_REJECTION_CODE},
    "powerpoint": {"passed": True, "exit_code": 0, "code": None},
}
SAME_CHART_DIFFERENT_VERDICT: Final = True

# --- what "literal" means for this gate ------------------------------------------------

LITERAL_MEANS_INLINE_VALUES: Final = True
LITERAL_MEANS_NO_CF: Final = True
GATE_DESCRIPTION_QUOTE: Final = (
    "Portable mode retains the original durable embedded-workbook requirement; "
    "explicit PowerPoint mode also accepts complete, editable native literal data."
)


class TargetApplicationError(ValueError):
    """Raised when a target-specific fact is collapsed."""


def requires_workbook(target: str) -> bool:
    """Whether the named target demands an embedded workbook."""
    if target not in TARGETS:
        raise TargetApplicationError(f"unknown target: {target}")
    return target == "portable"


def accepts_literal(target: str) -> bool:
    """Whether the named target accepts inline literal data."""
    if target not in TARGETS:
        raise TargetApplicationError(f"unknown target: {target}")
    return target == "powerpoint"


def evidence_for(target: str) -> str | None:
    """The editability evidence a passing deck earns under the given target."""
    if target not in TARGETS:
        raise TargetApplicationError(f"unknown target: {target}")
    return "powerpoint_native_literal" if target == "powerpoint" else None


def observed_verdict(target: str) -> Mapping[str, object]:
    """The verdict actually observed for the literal deck under this target."""
    return dict(OBSERVED_VERDICTS[target])


def validate_target_contract() -> None:
    """Assert the two models stay separate, above all that the flag is not cosmetic."""
    if TARGET_COUNT != 2 or len(TARGETS) != 2:
        raise TargetApplicationError("two targets were observed")
    if TARGETS != ("portable", "powerpoint"):
        raise TargetApplicationError("target names drifted")
    if DEFAULT_TARGET != "portable":
        raise TargetApplicationError("the default is portable")
    if FLAG != "--target-application":
        raise TargetApplicationError("flag drifted")

    if PORTABLE_REQUIRES_WORKBOOK is not True:
        raise TargetApplicationError("portable requires a workbook")
    if PORTABLE_REQUIRES_EXTERNAL_DATA is not True:
        raise TargetApplicationError("portable requires externalData")
    if POWERPOINT_REQUIRES_WORKBOOK is not False:
        raise TargetApplicationError("powerpoint does not require a workbook")
    if POWERPOINT_ACCEPTS_LITERAL is not True:
        raise TargetApplicationError("powerpoint accepts literal data")
    if POWERPOINT_TOLERATES_ZERO_WORKBOOK is not True:
        raise TargetApplicationError("a passing powerpoint deck had zero workbooks")

    if requires_workbook("portable") is not True:
        raise TargetApplicationError("portable helper drifted")
    if requires_workbook("powerpoint") is not False:
        raise TargetApplicationError("powerpoint helper drifted")
    if accepts_literal("portable") is not False:
        raise TargetApplicationError("portable does not accept literal data")
    if accepts_literal("powerpoint") is not True:
        raise TargetApplicationError("powerpoint helper drifted")

    if LITERAL_CARRIES_NO_FORMULA is not True:
        raise TargetApplicationError("literal parts carry no formula")
    if LITERAL_SERIES_FORMULA_COUNT != 0:
        raise TargetApplicationError("no c:f was present in the literal deck")
    if LITERAL_NUMERIC_POINT_COUNT != 3:
        raise TargetApplicationError("three literal points")
    if LITERAL_NUMERIC_CACHE_POINT_COUNT != 0:
        raise TargetApplicationError("literal deck had zero cache points")
    if CACHE_AND_LITERAL_ARE_SEPARATE_COUNTERS is not True:
        raise TargetApplicationError(
            "numeric_cache_point_count and literal_numeric_point_count are distinct fields"
        )
    if LITERAL_MEANS_INLINE_VALUES is not True or LITERAL_MEANS_NO_CF is not True:
        raise TargetApplicationError("literal means inline, no formula")

    if EVIDENCE_OBSERVED_COUNT != 1 or len(EDITABILITY_EVIDENCE) != 1:
        raise TargetApplicationError("one evidence value was observed")
    if EDITABILITY_EVIDENCE[0] != "powerpoint_native_literal":
        raise TargetApplicationError("evidence literal drifted")
    if evidence_for("powerpoint") != "powerpoint_native_literal":
        raise TargetApplicationError("evidence helper drifted")
    if evidence_for("portable") is not None:
        raise TargetApplicationError("portable earned no literal evidence")

    if PORTABLE_REJECTION_CODE != "native_chart_workbook_contract_failed":
        raise TargetApplicationError("rejection code drifted")
    if "externalData" not in PORTABLE_REJECTION_DETAIL:
        raise TargetApplicationError(
            "the portable rejection names externalData and must keep doing so"
        )

    if SAME_CHART_DIFFERENT_VERDICT is not True:
        raise TargetApplicationError(
            "one literal deck failed portable and passed powerpoint"
        )
    if observed_verdict("portable")["passed"] is not False:
        raise TargetApplicationError("portable failed")
    if observed_verdict("powerpoint")["passed"] is not True:
        raise TargetApplicationError("powerpoint passed")
    if "durable embedded-workbook requirement" not in GATE_DESCRIPTION_QUOTE:
        raise TargetApplicationError("the gate's own words must stay recorded")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
