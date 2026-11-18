# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Content-level finding contract for the presentation gates (R98).

R97 established the CLI surface and the structural tier. This module records what only a
holder of a *valid* package can observe: the three-state exit code, the shape of a finding
versus a warning, and the crucial asymmetry that ``--fail-on-findings`` does **not** escalate
a warning into a failure.

All facts come from running the gates against synthesised OOXML decks whose structural
validity was established first (integrity gate rc=0, geometry gate finding_count=0).
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Final

# --- three-state exit code -------------------------------------------------------------

EXIT_CLEAN: Final = 0
EXIT_FINDINGS: Final = 1
EXIT_STRUCTURAL_OR_USAGE: Final = 2
EXIT_CODE_COUNT: Final = 3

# R97 recorded only 0 and 2. Running a deck with real content defects produces 1.
FINDINGS_EXIT_CODE_DISCOVERED_IN_R98: Final = True

# --- the asymmetry that matters -------------------------------------------------------

WARNING_IS_NOT_ESCALATED_BY_FAIL_ON_FINDINGS: Final = True
FINDINGS_AND_WARNINGS_ARE_SEPARATE_LISTS: Final = True
KEY_FINDING_COUNT: Final = "finding_count"
KEY_WARNING_COUNT: Final = "warning_count"
KEY_FINDINGS: Final = "findings"
KEY_WARNINGS: Final = "warnings"

# --- finding shape: a discriminator plus payload --------------------------------------

FINDING_DISCRIMINATOR: Final = "kind"

FINDING_KINDS: Final[Mapping[str, tuple[str, ...]]] = {
    "inconsistent_presentation_font_family": ("font_families", "font_family_count"),
    "requested_slide_count_changed": ("actual_slide_count", "expected_slide_count"),
    "unexpected_slide_aspect_ratio": (
        "actual_cx_emu",
        "actual_cy_emu",
        "expected_aspect",
    ),
    # R99: discovered once the flag was given its required slide-number value.
    "required_native_table_missing": ("slide",),
}
FINDING_KIND_COUNT: Final = len(FINDING_KINDS)
FINDINGS_OBSERVED_ALL_EXIT_1: Final = True

# --- warning shape: same discriminator, different payload, different severity ---------

WARNING_KINDS: Final[Mapping[str, tuple[str, ...]]] = {
    "presentation_heading_trailing_full_stop": (
        "object_id",
        "slide",
        "heading_role",
        "character_count",
    ),
}
WARNING_KIND_COUNT: Final = 1
# Observed emitted with both --validate-heading-punctuation and --fail-on-findings, and the
# gate still returned EXIT_CLEAN.
WARNING_UNDER_BOTH_FLAGS_STILL_CLEAN: Final = True

# --- which flags produced which tier --------------------------------------------------

FLAG_TO_OBSERVED_TIER: Final[Mapping[str, str]] = {
    "--require-uniform-font-family": "finding",
    "--expected-slide-count": "finding",
    "--expected-aspect": "finding",
    "--validate-heading-punctuation": "warning",
}

# --- integrity gate: passing shape ----------------------------------------------------

INTEGRITY_PASS_STATUS: Final = "pass"
INTEGRITY_KEYS: Final = (
    "status",
    "finding_count",
    "findings",
    "slide_count",
    "chart_count",
    "notes_parts_skipped",
    "relationship_part_count",
    "claim_boundary",
)
INTEGRITY_CLAIM_BOUNDARY: Final = (
    "Structural package checks only; no slide text, notes, formulas, chart values, or "
    "native PowerPoint execution were inspected."
)
INTEGRITY_INSPECTS_SLIDE_TEXT: Final = False

# --- what did NOT fire (honest gaps) --------------------------------------------------

PROSE_CAP_NOT_TRIGGERED: Final = True
NATIVE_TABLE_FLAG_NOT_ACCEPTED_IN_OBSERVED_FORM: Final = True
UNTRIGGERED_KINDS: Final = (
    "prose-word-cap",
    "missing-native-table-slide",
    "heading-fit-overflow",
)

MIN_SLIDE_SIZE_IN: Final = (13.3333, 7.5)


class GateFindingError(ValueError):
    """Raised when a content-level behaviour fact is softened."""


def exit_tier(rc: int) -> str:
    """Map an observed exit code onto its tier."""
    if rc == EXIT_CLEAN:
        return "clean-or-warnings-only"
    if rc == EXIT_FINDINGS:
        return "findings"
    if rc == EXIT_STRUCTURAL_OR_USAGE:
        return "structural-or-usage"
    raise GateFindingError(f"exit code outside the obsolescent three-state model: {rc}")


def is_finding_kind(kind: str) -> bool:
    """Whether ``kind`` is an observed finding discriminator."""
    return kind in FINDING_KINDS


def is_warning_kind(kind: str) -> bool:
    """Whether ``kind`` is an observed warning discriminator."""
    return kind in WARNING_KINDS


def severity_of(kind: str) -> str:
    """Severity of an observed discriminator, or raise."""
    if kind in FINDING_KINDS:
        return "finding"
    if kind in WARNING_KINDS:
        return "warning"
    raise GateFindingError(f"unobserved discriminator: {kind!r}")


def escalates_to_failure(kind: str, fail_on_findings: bool) -> bool:
    """Whether this discriminator can turn into a rc=1 failure."""
    sev = severity_of(kind)
    if sev == "warning":
        return False
    return fail_on_findings


def payload_fields_of(kind: str) -> tuple[str, ...]:
    """The observed payload keys that accompany ``kind``."""
    if kind in FINDING_KINDS:
        return FINDING_KINDS[kind]
    if kind in WARNING_KINDS:
        return WARNING_KINDS[kind]
    raise GateFindingError(f"unobserved discriminator: {kind!r}")


def findings_contract() -> Mapping[str, object]:
    """Return the content-level contract as a plain mapping."""
    return {
        "exit_states": EXIT_CODE_COUNT,
        "finding_kinds": FINDING_KIND_COUNT,
        "warning_kinds": WARNING_KIND_COUNT,
        "warning_escalates": False,
        "discriminator": FINDING_DISCRIMINATOR,
        "integrity_inspects_text": INTEGRITY_INSPECTS_SLIDE_TEXT,
        "untriggered": len(UNTRIGGERED_KINDS),
    }


def validate_findings_contract() -> None:
    """Assert the content-level facts, above all the warning asymmetry."""
    if EXIT_CODE_COUNT != 3:
        raise GateFindingError("the exit code model is three-state")
    if not (EXIT_CLEAN == 0 and EXIT_FINDINGS == 1 and EXIT_STRUCTURAL_OR_USAGE == 2):
        raise GateFindingError("exit code constants drifted")
    if FINDINGS_EXIT_CODE_DISCOVERED_IN_R98 is not True:
        raise GateFindingError("rc=1 must stay recorded as the R98 discovery")
    if exit_tier(1) != "findings":
        raise GateFindingError("rc=1 must map to the findings tier")

    if WARNING_IS_NOT_ESCALATED_BY_FAIL_ON_FINDINGS is not True:
        raise GateFindingError("a warning must never become a failure")
    if escalates_to_failure("presentation_heading_trailing_full_stop", True) is not False:
        raise GateFindingError("heading punctuation stayed a warning under both flags")
    if escalates_to_failure("inconsistent_presentation_font_family", True) is not True:
        raise GateFindingError("font inconsistency is a real finding")
    if escalates_to_failure("requested_slide_count_changed", False) is not False:
        raise GateFindingError("findings need the strictness flag to fail")

    if FINDING_KIND_COUNT != 4:
        raise GateFindingError(f"expected 4 observed findings, got {FINDING_KIND_COUNT}")
    if WARNING_KIND_COUNT != 1:
        raise GateFindingError(f"expected 1 observed warning, got {WARNING_KIND_COUNT}")
    if FINDING_DISCRIMINATOR != "kind":
        raise GateFindingError("both findings and warnings discriminate on 'kind'")

    overlapping = set(FINDING_KINDS) & set(WARNING_KINDS)
    if overlapping:
        raise GateFindingError(f"same kind cannot be both: {sorted(overlapping)}")

    if not INTEGRITY_CLAIM_BOUNDARY.startswith("Structural package checks only"):
        raise GateFindingError("claim boundary drifted")
    if INTEGRITY_INSPECTS_SLIDE_TEXT is not False:
        raise GateFindingError("the integrity gate states it does not read slide text")
    if "slide text" not in INTEGRITY_CLAIM_BOUNDARY:
        raise GateFindingError("claim boundary must name the excluded surface")

    if not all(k in FLAG_TO_OBSERVED_TIER for k in FLAG_TO_OBSERVED_TIER):
        raise GateFindingError("flag-to-tier table inconsistent")
    if FLAG_TO_OBSERVED_TIER["--validate-heading-punctuation"] != "warning":
        raise GateFindingError("punctuation validation stays a warning tier")

    if not UNTRIGGERED_KINDS:
        raise GateFindingError("the untriggered list must be stated, not emptied")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
