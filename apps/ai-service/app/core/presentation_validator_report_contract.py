# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""How the presentation finaliser refuses to trust a validator's own verdict (R122).

Every ``execute*Validator`` in ``artifact_tool_utils.mjs`` ends the same way: it does *not* accept
``report.passed === true`` as sufficient. It re-checks the report field by field against what it
already knows independently, and throws if any single field disagrees. This is the direct answer
to the finding recorded at R119 that an exit code, a stderr line and a tool's self-report are
three separate signals none of which can be trusted alone. Here the strategy is not to pick a
better signal but to *manufacture many signals* and require all of them to agree.

**Counting is double-counted.** ``executeValidator`` rejects the run when ``finding_count !== 0``
*and separately* when ``findings`` is not an empty array. Either one disagreeing is enough. A
report that carries ``finding_count: 0`` alongside a nonempty ``findings`` list is treated as
broken rather than as passing.

**Sorted order is asserted position by position.** Chart owners are not merely compared as sets.
The validator must return ``expected_quantitative_chart_slides`` sorted, and each element is
compared at its index (``actual[i] !== expected[i]``). A report that contains the right slides in
the wrong order is a failure, because the order is part of the contract.

**Discovery must be monotonic.** ``discoverActualNativeCharts`` requires the returned owner list
to be strictly ascending (``owners[i-1] >= owners[i]`` rejects). It also requires the per-slide
counts to sum exactly to ``chart_count`` and the key count to equal the owner count. A partial
inventory cannot pass itself off as complete.

**Some reports are required to confess.** Four fields must be *false*, not true, for a run to
pass:

- ``source_attachments_accessed`` — the discovery must not have opened the source attachments.
- ``source_required_chart_owners_inferred`` — owners must be observed, never inferred.
- ``native_powerpoint_verified`` — the chart-title check did not run in real PowerPoint.
- ``source_text_emitted`` — the check did not leak source text into the output.

And ``preparePortableChartData`` requires the snapshot adapter to admit its own limits:
``experimental === true``, ``source_formulas_preserved === false``, ``source_workbook_preserved
=== false``, and ``new_formulas_describe_snapshot_only === true``. A converter that claimed to
preserve what it actually replaced would fail these four assertions.

**Byte-for-byte list equality where order matters.** The snapshot adapter's detected and
validated owner slides are compared with ``JSON.stringify(...) === JSON.stringify(discovered
.owners)``, not with a set comparison, so a reordering is caught.

**The first-party import hashes its own input.** ``verifyFirstPartyImport`` spawns a fresh node
process that reads the candidate, hashes it, imports it through ``@oai/artifact-tool``, then
hashes the same file again and refuses if the two differ — closing the window where an importer
could rewrite its input while reading it.

Every validator is spawned the same way: ``-B`` to suppress bytecode, ``PYTHONDONTWRITEBYTECODE``
in the environment, a 2 MB buffer, a 90-second timeout and ``windowsHide`` so no console window
flashes. A non-JSON stdout is itself a failure, never an empty report.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final

# --- how a validator is invoked ----------------------------------------------------------------

VALIDATOR_ARGS_LEAD: Final = ("-B", "<validator>", "<candidate>")
VALIDATOR_FAIL_FLAG: Final = "--fail-on-findings"
VALIDATOR_MAX_BUFFER: Final = 2 * 1024 * 1024
VALIDATOR_TIMEOUT_MS: Final = 90_000
VALIDATOR_HIDES_CONSOLE: Final = True
VALIDATOR_SHELL_DISABLED: Final = True
VALIDATOR_ENV_NO_BYTECODE: Final = "PYTHONDONTWRITEBYTECODE"
VALIDATOR_NON_JSON_IS_FAILURE: Final = True

# --- identical predicates, recorded once ------------------------------------------------------

DUAL_ZERO_FINDINGS: Final = True  # finding_count === 0 AND findings.length === 0
WARNINGS_NEED_STRING_KIND: Final = True
ORDER_IS_PART_OF_THE_CONTRACT: Final = True
SET_COMPARISON_IS_NOT_ENOUGH: Final = True


@dataclass(frozen=True)
class ReportContract:
    """What one validator's report must contain before it may pass."""

    name: str
    schema_version: str
    checked_fields: tuple[str, ...]
    notes: str


PACKAGE_INTEGRITY: Final = ReportContract(
    name="package-integrity",
    schema_version="(not asserted; findings must be empty)",
    checked_fields=("finding_count", "findings", "warnings"),
    notes="the first gate; runs before any chart traversal or opt-in conversion",
)

LAYOUT_GEOMETRY: Final = ReportContract(
    name="presentation-layout",
    schema_version="(not asserted)",
    checked_fields=("finding_count", "findings", "warnings", "font_policy"),
    notes="font_policy.performed and .passed must both be true when a policy was declared",
)

NATIVE_CHART: Final = ReportContract(
    name="native-quantitative-chart",
    schema_version="(not asserted)",
    checked_fields=(
        "passed",
        "failed_slide_count",
        "validated_slide_count",
        "expected_quantitative_chart_slides",
        "results",
        "target_application",
        "required_embedded_workbook_slides",
    ),
    notes="owners compared sorted, position by position; an exception slide must be declared",
)

CHART_TITLE: Final = ReportContract(
    name="native-chart-titles",
    schema_version="presentation-native-chart-titles.v1",
    checked_fields=(
        "passed",
        "slide_count",
        "native_chart_count",
        "presentation_sha256",
        "checks",
        "finding_count",
        "findings",
        "native_powerpoint_verified",
        "source_text_emitted",
    ),
    notes="checks must equal the discovered chart count; four legal statuses only",
)

TABLE_ARITHMETIC: Final = ReportContract(
    name="native-table-arithmetic",
    schema_version="presentation-native-table-arithmetic.v1",
    checked_fields=(
        "passed",
        "slide_count",
        "native_table_count",
        "eligible_table_count",
        "checked_column_count",
        "checks",
        "skipped_tables",
        "finding_count",
        "findings",
    ),
    notes="an explicit contract check may not be skipped; component_count at least two",
)

CHART_DISCOVERY: Final = ReportContract(
    name="actual-native-chart-discovery",
    schema_version="owner-private.actual-native-chart-discovery.v1",
    checked_fields=(
        "chart_owner_slides",
        "chart_counts",
        "chart_count",
        "slide_count",
        "source_attachments_accessed",
        "source_required_chart_owners_inferred",
    ),
    notes="owners strictly ascending; counts sum to chart_count; both confessions must be false",
)

CHART_DATA_SNAPSHOT: Final = ReportContract(
    name="chart-data-snapshot",
    schema_version="experimental.literal-chart-workbook-snapshot.v1",
    checked_fields=(
        "conversion",
        "experimental",
        "source_formulas_preserved",
        "source_workbook_preserved",
        "new_formulas_describe_snapshot_only",
        "input_sha256",
        "output_sha256",
        "output_bytes",
        "portable_chart_validation_passed",
        "converted_chart_count",
        "preserved_existing_workbook_chart_count",
        "detected_chart_owner_slides",
        "portable_validated_owner_slides",
    ),
    notes="four self-limiting assertions; owner lists compared byte for byte",
)

TEMPLATE_FIDELITY: Final = ReportContract(
    name="template-source-fidelity",
    schema_version="template_source_fidelity.v1",
    checked_fields=(
        "passed",
        "status",
        "issue_codes",
        "reference_family_count",
        "minimum_coverage_ratio",
        "coverage_ratio",
    ),
    notes="status must also read 'passed'; issue_codes must be empty",
)

FIRST_PARTY_IMPORT: Final = ReportContract(
    name="first-party-import",
    schema_version="(inline script, no schema)",
    checked_fields=("passed", "slideCount", "sha256"),
    notes="a fresh process hashes the candidate before and after importing it",
)

CONTRACTS: Final = (
    PACKAGE_INTEGRITY,
    LAYOUT_GEOMETRY,
    NATIVE_CHART,
    CHART_TITLE,
    TABLE_ARITHMETIC,
    CHART_DISCOVERY,
    CHART_DATA_SNAPSHOT,
    TEMPLATE_FIDELITY,
    FIRST_PARTY_IMPORT,
)

# --- fields that must be false for the run to pass --------------------------------------------

CONFESSION_FIELDS: Final = (
    "source_attachments_accessed",
    "source_required_chart_owners_inferred",
    "native_powerpoint_verified",
    "source_text_emitted",
)
CONFESSION_REQUIRED_VALUE: Final = False
CONFESSION_COUNT: Final = 4

EXPERIMENTAL_SNAPSHOT_FLAGS: Final = (
    ("experimental", True),
    ("source_formulas_preserved", False),
    ("source_workbook_preserved", False),
    ("new_formulas_describe_snapshot_only", True),
)

CHART_CHECK_STATUSES: Final = (
    "absent",
    "present",
    "linked_title_unresolved",
    "explicitly_suppressed",
)

CHART_TARGET_APPLICATIONS: Final = ("portable", "powerpoint")

TABLE_ARITHMETIC_KEYS: Final = (
    "slide",
    "table",
    "label_column",
    "total_row",
    "value_columns",
    "component_rows",
)
TABLE_ARITHMETIC_CONTRACT_MAX: Final = 200
TABLE_COMPONENT_MINIMUM: Final = 2
LABEL_COLUMN_EXCLUDED_FROM_VALUES: Final = True
COMPONENTS_PRECEDE_TOTAL: Final = True

TEMPLATE_RATIO_RANGE: Final = (0.0, 1.0)
TEMPLATE_EXPLICIT_FLAGS: Final = (
    "requireExactTemplateDimensions",
    "requireTemplatePlaceholderGeometry",
    "requirePhotographicBackground",
)
TEMPLATE_FLAG_COUNT: Final = 3

DURABLE_WORKBOOK_DOUBLE_CONSTRAINT: Final = (
    "--require-source-workbook-slide",
    "--require-source-formulas-slide",
)  # a source-required workbook or formula cannot be replaced by a snapshot


def report_may_pass(finding_count: int, findings: list[object]) -> bool:
    """Both counters have to agree; one saying zero while the other is nonempty fails."""
    return finding_count == 0 and len(findings) == 0


def owners_are_strictly_ascending(owners: list[int]) -> bool:
    return all(owners[i - 1] < owners[i] for i in range(1, len(owners)))


def order_matches(expected: list[int], actual: list[int]) -> bool:
    if len(expected) != len(actual):
        return False
    return all(a == b for a, b in zip(expected, actual, strict=True))


def coverage() -> dict[str, int]:
    return {
        "contracts": len(CONTRACTS),
        "confession_fields": CONFESSION_COUNT,
        "chart_statuses": len(CHART_CHECK_STATUSES),
        "lines_read": 1_077,
    }


def validate_contract() -> None:
    if len(CONTRACTS) != 9:
        raise ValueError("nine validator call sites were recorded")
    if len(CONFESSION_FIELDS) != CONFESSION_COUNT or CONFESSION_COUNT != 4:
        raise ValueError("four confessions")
    if CONFESSION_REQUIRED_VALUE is not False:
        raise ValueError("the confessions must be false")
    if len(EXPERIMENTAL_SNAPSHOT_FLAGS) != 4:
        raise ValueError("four self-limiting snapshot flags")
    if len(CHART_CHECK_STATUSES) != 4:
        raise ValueError("four legal chart-title statuses")
    if CHART_TARGET_APPLICATIONS != ("portable", "powerpoint"):
        raise ValueError("two chart targets")
    if not DUAL_ZERO_FINDINGS:
        raise ValueError("both the count and the list must be empty")
    if not ORDER_IS_PART_OF_THE_CONTRACT or not SET_COMPARISON_IS_NOT_ENOUGH:
        raise ValueError("order is part of the contract")
    if VALIDATOR_TIMEOUT_MS != 90_000 or VALIDATOR_MAX_BUFFER != 2 * 1024 * 1024:
        raise ValueError("validator spawn bounds drifted")
    if not VALIDATOR_HIDES_CONSOLE:
        raise ValueError("spawned validators must not open a console window")
    if len(TABLE_ARITHMETIC_KEYS) != 6:
        raise ValueError("six table arithmetic coordinates")
    if TABLE_COMPONENT_MINIMUM != 2:
        raise ValueError("a total needs at least two components")
    if len(TEMPLATE_EXPLICIT_FLAGS) != TEMPLATE_FLAG_COUNT or TEMPLATE_FLAG_COUNT != 3:
        raise ValueError("three template flags")
    if not LABEL_COLUMN_EXCLUDED_FROM_VALUES or not COMPONENTS_PRECEDE_TOTAL:
        raise ValueError("arithmetic ordering rules drifted")
    for contract in CONTRACTS:
        if contract.schema_version in ("", None):
            raise ValueError(f"{contract.name} has no recorded schema version")
        if len(contract.checked_fields) < 1:
            raise ValueError(f"{contract.name} records no fields")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
