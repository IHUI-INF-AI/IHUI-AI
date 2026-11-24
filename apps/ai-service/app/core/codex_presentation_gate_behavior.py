# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Black-box behaviour contract for the six presentation quality gates (R97).

Everything recorded here was obtained by *running* the gates and observing exit codes and
diagnostic shape -- not by reading their implementation. The point is to pin the behaviour
this repository would have to reproduce, and to record the one structural insight the
implementation reading had missed:

    the verdict is two-tier.  A structurally invalid package is a hard rc=2 failure that no
    flag can soften; only *content findings* are the layer that stays opt-in behind
    ``--fail-on-findings``.

That distinction is load-bearing: it means a caller cannot make a broken package pass by
simply omitting the strictness flag.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Final

GATE_COUNT: Final = 6

# --- CLI surface, observed from --help --------------------------------------------------

FLAG_COUNTS: Final[Mapping[str, int]] = {
    "inspect_presentation_layout_geometry": 34,
    "native_quantitative_chart_gate": 8,
    "template_source_fidelity_gate": 8,
    "native_table_arithmetic_gate": 4,
    "inspect_presentation_package_integrity": 3,
    "native_chart_title_gate": 2,
}
TOTAL_FLAGS: Final = sum(FLAG_COUNTS.values())
MAX_FLAGS_GATE: Final = "inspect_presentation_layout_geometry"
MAX_FLAGS: Final = 34

# The 34 flags of the largest gate, verbatim, grouped by role.
GEOMETRY_APPROVAL_FLAGS: Final = (
    "--approved-bullet-slide",
    "--approved-dense-slide",
    "--approved-font-family",
    "--approved-heading-slide",
    "--approved-icon-slide",
    "--approved-image-sha256",
    "--approved-logo-placement-slide",
    "--approved-logo-sha256",
    "--approved-redundant-chart-slide",
    "--approved-script-font",
)
GEOMETRY_REQUIRE_FLAGS: Final = (
    "--require-editorial-slide",
    "--require-logo-bottom-left",
    "--require-native-table-slide",
    "--require-uniform-font-family",
    "--required-default-font-family",
)
GEOMETRY_VALIDATE_FLAGS: Final = (
    "--validate-bullet-geometry",
    "--validate-heading-fit",
    "--validate-heading-punctuation",
)
GEOMETRY_LIMIT_FLAGS: Final = (
    "--cover-role",
    "--cover-word-limit",
    "--expected-aspect",
    "--expected-slide-count",
    "--expected-slide-size-emu",
    "--folio-mode",
    "--max-content-prose-words",
    "--max-logo-area",
    "--max-redundant-table-charts",
)
GEOMETRY_MODE_FLAGS: Final = (
    "--allow-cover-chart",
    "--allow-cover-table",
    "--forbid-unapproved-decorative-icons",
    "--inspect-font-families",
)
GEOMETRY_FAIL_FLAGS: Final = ("--fail-on-findings",)

# --- universal behaviour ---------------------------------------------------------------

HELP_EXIT_CODE: Final = 0
STRUCTURAL_FAILURE_EXIT_CODE: Final = 2
NO_ARGS_EXIT_CODE: Final = 2
SUCCESS_EXIT_CODE: Final = 0
ALL_GATES_JSON_DIAGNOSTICS: Final = True
ALL_GATES_DIAGNOSE_ON_STDOUT: Final = True

FAIL_ON_FINDINGS_GATES: Final = (
    "inspect_presentation_layout_geometry",
    "native_table_arithmetic_gate",
    "inspect_presentation_package_integrity",
    "template_source_fidelity_gate",
)
FAIL_ON_FINDINGS_FLAG: Final = "--fail-on-findings"
RECEIPT_FLAG_GATES: Final = ("native_quantitative_chart_gate",)
RECEIPT_FLAG: Final = "--receipt"
CONTRACT_JSON_FLAG_GATES: Final = ("native_table_arithmetic_gate",)
CONTRACT_JSON_FLAG: Final = "--contract-json"

# --- two-tier verdict (the insight) ----------------------------------------------------

TWO_TIER_VERDICT: Final = True
STRUCTURAL_FAILURE_IS_UNSOFTENABLE: Final = True
CONTENT_FINDINGS_ARE_OPT_IN: Final = True

# --- schema-bearing gates -------------------------------------------------------------

SCHEMA_VERSIONS: Final[Mapping[str, str]] = {
    "native_table_arithmetic_gate": "presentation-native-table-arithmetic.v1",
    "native_chart_title_gate": "presentation-native-chart-titles.v1",
}
SCHEMA_BEARING_GATE_COUNT: Final = len(SCHEMA_VERSIONS)
SCHEMA_SUFFIX: Final = ".v1"

# --- what a minimal-but-structurally-thin package produced, verbatim --------------------

MINIMAL_PACKAGE_ALL_FAILED: Final = True
MINIMAL_PACKAGE_EXIT_CODE: Final = 2
MINIMAL_DIAGNOSTICS: Final[Mapping[str, str]] = {
    "inspect_presentation_layout_geometry": "presentation has no slide dimensions",
    "inspect_presentation_package_integrity": (
        "presentation is missing required package part: ppt/_rels/presentation.xml.rels"
    ),
    "native_quantitative_chart_gate": (
        "Declare expected chart owners or explicitly request actual chart discovery"
    ),
    "native_table_arithmetic_gate": "native_table_arithmetic_audit_failed",
    "native_chart_title_gate": "Chart-title inspection could not validate the package",
}
# template_source_fidelity_gate answered with usage instead of a JSON verdict, because
# without --reference-slide it refuses to start a comparison at all.
REFERENCE_REQUIRED_GATE: Final = "template_source_fidelity_gate"


class GateBehaviorError(ValueError):
    """Raised when an observed behaviour fact is softened."""


def flags_of(gate: str) -> int:
    """Observed number of CLI flags for ``gate``."""
    try:
        return FLAG_COUNTS[gate]
    except KeyError:
        raise GateBehaviorError(f"unknown gate: {gate!r}") from None


def is_schema_bearing(gate: str) -> bool:
    """Whether the gate emits a versioned schema string."""
    flags_of(gate)  # validates the name
    return gate in SCHEMA_VERSIONS


def schema_of(gate: str) -> str:
    """The versioned schema string the gate emits, or raise."""
    try:
        return SCHEMA_VERSIONS[gate]
    except KeyError:
        raise GateBehaviorError(f"gate does not emit a schema: {gate!r}") from None


def structural_failure_is_hard() -> bool:
    """A structurally invalid package cannot be rescued by omitting strictness flags."""
    return (
        TWO_TIER_VERDICT
        and STRUCTURAL_FAILURE_IS_UNSOFTENABLE
        and STRUCTURAL_FAILURE_EXIT_CODE == 2
    )


def content_verdict_is(gate: str, fail_on_findings: bool) -> str:
    """Predicted verdict class for content findings, given the strictness flag."""
    flags_of(gate)
    if gate not in FAIL_ON_FINDINGS_GATES:
        return "unsupported-no-flag"
    return "failed" if fail_on_findings else "diagnosed-only"


def behaviour_contract() -> Mapping[str, object]:
    """Return the observed behaviour as a plain mapping."""
    return {
        "gates": GATE_COUNT,
        "flags_total": TOTAL_FLAGS,
        "max_flags": MAX_FLAGS,
        "json_diagnostics": ALL_GATES_JSON_DIAGNOSTICS,
        "two_tier": TWO_TIER_VERDICT,
        "structural_hard": STRUCTURAL_FAILURE_IS_UNSOFTENABLE,
        "schema_bearing": SCHEMA_BEARING_GATE_COUNT,
        "fail_on_findings_gates": len(FAIL_ON_FINDINGS_GATES),
        "minimal_package_all_failed": MINIMAL_PACKAGE_ALL_FAILED,
    }


def validate_behavior() -> None:
    """Assert the observed facts still describe the two-tier model."""
    if GATE_COUNT != 6:
        raise GateBehaviorError(f"expected 6 gates, got {GATE_COUNT}")
    if len(FLAG_COUNTS) != GATE_COUNT:
        raise GateBehaviorError("flag table must cover every gate")
    if TOTAL_FLAGS != 59:
        raise GateBehaviorError(f"expected 59 flags total, got {TOTAL_FLAGS}")
    if max(FLAG_COUNTS.values()) != MAX_FLAGS:
        raise GateBehaviorError("MAX_FLAGS must match the table")
    if FLAG_COUNTS[MAX_FLAGS_GATE] != 34:
        raise GateBehaviorError("layout geometry must expose 34 flags")

    grouped = (
        len(GEOMETRY_APPROVAL_FLAGS)
        + len(GEOMETRY_REQUIRE_FLAGS)
        + len(GEOMETRY_VALIDATE_FLAGS)
        + len(GEOMETRY_LIMIT_FLAGS)
        + len(GEOMETRY_MODE_FLAGS)
        + len(GEOMETRY_FAIL_FLAGS)
        + 2  # --help and -h
    )
    if grouped != 34:
        raise GateBehaviorError(f"flag grouping must total 34, got {grouped}")
    if any(not f.startswith("--") for f in GEOMETRY_APPROVAL_FLAGS):
        raise GateBehaviorError("approval flags must be long-form")

    if ALL_GATES_JSON_DIAGNOSTICS is not True:
        raise GateBehaviorError("every gate emits JSON diagnostics")
    if NO_ARGS_EXIT_CODE != 2 or STRUCTURAL_FAILURE_EXIT_CODE != 2:
        raise GateBehaviorError("usage and structural failure both exit 2")
    if HELP_EXIT_CODE != 0:
        raise GateBehaviorError("--help must exit 0")

    if TWO_TIER_VERDICT is not True:
        raise GateBehaviorError("the verdict is two-tier; do not collapse it")
    if STRUCTURAL_FAILURE_IS_UNSOFTENABLE is not True:
        raise GateBehaviorError("structural failure must not be rescusable by flags")
    if not structural_failure_is_hard():
        raise GateBehaviorError("two-tier model incoherent")

    if len(SCHEMA_VERSIONS) != 2:
        raise GateBehaviorError(f"expected 2 schema-bearing gates, got {len(SCHEMA_VERSIONS)}")
    for gate, schema in SCHEMA_VERSIONS.items():
        if not schema.endswith(SCHEMA_SUFFIX):
            raise GateBehaviorError(f"{gate} schema must carry the .v1 suffix")
        if not schema.startswith("presentation-native-"):
            raise GateBehaviorError(f"{gate} schema must keep its prefix")

    if MINIMAL_PACKAGE_ALL_FAILED is not True:
        raise GateBehaviorError("a structurally thin package must fail every gate")
    if REFERENCE_REQUIRED_GATE not in MINIMAL_DIAGNOSTICS and REFERENCE_REQUIRED_GATE not in (
        FLAG_COUNTS
    ):
        raise GateBehaviorError("reference-required gate must be a known gate")

    for gate in ("native_chart_title_gate",):
        if gate in FAIL_ON_FINDINGS_GATES:
            raise GateBehaviorError(f"{gate} has no --fail-on-findings and must not claim one")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
