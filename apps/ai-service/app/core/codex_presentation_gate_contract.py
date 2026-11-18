# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Codex presentation quality-gate contract (R95).

Six gate scripts ship inside the presentations plugin's ``container_tools``. They are not a
homogeneous family, but they *do* share a design discipline that is worth keeping apart from
their individual bigness:

* **scoped by declaration** — every gate's own docstring narrows itself: only slides/contracts
  the caller *explicitly declared* are governed. Nothing becomes a failure merely for existing.
* **skip is not zero** — an unsupported number format is reported ``skipped``, never silently
  read as ``0`` (table arithmetic gate).
* **read-only, source-free** — package integrity "without reading slide text, notes, formulas,
  or values"; chart gate is "source-free".
* **opt-in failure** — three gates only fail when ``--fail-on-findings`` is passed; default is
  diagnostics. One gate additionally emits a ``--receipt``.

Sizes are recorded because they bound how much engineering hides behind a single skill, but
this module asserts only the parts that were literally observed.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Final

GATE_COUNT: Final = 6
GATE_DIR: Final = "presentations/skills/presentations/container_tools"

GATES: Final[Mapping[str, Mapping[str, object]]] = {
    "native_quantitative_chart_gate": {
        "bytes": 45307,
        "lines": 1087,
        "schema": None,
        "max_package_bytes_mb": 128,
        "max_part_bytes_mb": 16,
        "max_package_parts": 10000,
        "max_expected_slides": 500,
        "max_charts_per_slide": 25,
        "cli_count": 7,
        "exits": ("0", "2"),
        "imports_sibling": False,
        "declared_only": True,
    },
    "native_table_arithmetic_gate": {
        "bytes": 21259,
        "lines": 520,
        "schema": None,
        "max_tables_per_slide": 100,
        "max_table_rows": 2000,
        "max_table_columns": 100,
        "max_cell_characters": 2048,
        "max_contracts": 200,
        "cli_count": 3,
        "exits": ("0", "2"),
        "imports_sibling": True,
        "declared_only": True,
        "skip_not_zero": True,
    },
    "native_chart_title_gate": {
        "bytes": 6135,
        "lines": 144,
        "schema": "presentation-native-chart-titles.v1",
        "cli_count": 1,
        "exits": ("0", "2"),
        "imports_sibling": True,
        "declared_only": True,
    },
    "template_source_fidelity_gate": {
        "bytes": 22193,
        "lines": 533,
        "schema": None,
        "max_part_bytes_mb": 100,
        "max_parts": 2500,
        "max_package_bytes_mb": 512,
        "cli_count": 8,
        "exits": ("0", "2"),
        "imports_sibling": False,
        "declared_only": True,
    },
    "inspect_presentation_package_integrity": {
        "bytes": 29495,
        "lines": 711,
        "schema": None,
        "max_parts": 10000,
        "max_uncompressed_bytes_mb": 512,
        "cli_count": 2,
        "exits": ("2",),
        "imports_sibling": False,
        "declared_only": True,
        "read_only_no_text": True,
    },
    "inspect_presentation_layout_geometry": {
        "bytes": 101992,
        "lines": 2660,
        "schema": None,
        "cli_count": 33,
        "exits": ("0", "1", "2"),
        "imports_sibling": True,
        "declared_only": True,
    },
}

GATE_TOTAL_BYTES: Final = sum(int(g["bytes"]) for g in GATES.values())  # type: ignore[call-overload]
GATE_TOTAL_LINES: Final = sum(int(g["lines"]) for g in GATES.values())  # type: ignore[call-overload]

LARGEST_GATE: Final = "inspect_presentation_layout_geometry"
SMALLEST_GATE: Final = "native_chart_title_gate"
MAX_CLI_COUNT: Final = 33
MAX_CLI_GATE: Final = "inspect_presentation_layout_geometry"
MIN_CLI_COUNT: Final = 1

# --- shared flags ------------------------------------------------------------------

FAIL_ON_FINDINGS_FLAG: Final = "--fail-on-findings"
FAIL_ON_FINDINGS_GATES: Final = (
    "inspect_presentation_layout_geometry",
    "inspect_presentation_package_integrity",
    "native_table_arithmetic_gate",
)
RECEIPT_FLAG: Final = "--receipt"
RECEIPT_GATES: Final = ("native_quantitative_chart_gate",)
CONTRACT_JSON_FLAG: Final = "--contract-json"
CONTRACT_JSON_GATES: Final = ("native_table_arithmetic_gate",)

# --- exit code vocabulary ----------------------------------------------------------

EXIT_OK: Final = "0"
EXIT_FINDINGS: Final = "1"
EXIT_USAGE: Final = "2"
TRIPLE_STATE_EXITS: Final = (EXIT_OK, EXIT_FINDINGS, EXIT_USAGE)
DUAL_STATE_EXITS: Final = (EXIT_OK, EXIT_USAGE)

# --- design discipline -------------------------------------------------------------

DECLARED_ONLY_SCOPE: Final = True
SKIP_IS_NOT_ZERO: Final = True
READ_ONLY_SOURCE_FREE: Final = True
SIBLING_IMPORT_COUNT: Final = sum(1 for g in GATES.values() if g["imports_sibling"])
SCHEMA_BEARING_GATES: Final = tuple(n for n, g in GATES.items() if g["schema"])

# --- observed content-type constants -----------------------------------------------

CHART_CONTENT_TYPE: Final = (
    "application/vnd.openxmlformats-officedocument.drawingml.chart+xml"
)


class GateContractError(ValueError):
    """Raised when a gate fact contradicts the observed bundle."""


def gate_of(name: str) -> Mapping[str, object]:
    """Return the fact row for a gate name, or raise."""
    try:
        return GATES[name]
    except KeyError:
        raise GateContractError(f"unknown gate: {name!r}") from None


def cli_count_of(name: str) -> int:
    """Return the observed ``add_argument`` count for a gate."""
    return int(gate_of(name)["cli_count"])  # type: ignore[call-overload]


def exits_of(name: str) -> tuple[str, ...]:
    """Return the observed exit-code vocabulary for a gate."""
    exits = gate_of(name)["exits"]
    if not isinstance(exits, tuple):
        raise GateContractError(f"{name}: exits is not a tuple")
    return exits


def is_sibling_importer(name: str) -> bool:
    """Whether the gate imports shared helpers from ``native_quantitative_chart_gate``."""
    return bool(gate_of(name)["imports_sibling"])


def tries_sibling_lib(name: str) -> tuple[str, ...]:
    """Gates that reuse the chart gate as a shared library."""
    return tuple(n for n in GATES if is_sibling_importer(n))


def fails_only_on_request(name: str) -> bool:
    """Whether the gate gates failure behind ``--fail-on-findings``."""
    return name in FAIL_ON_FINDINGS_GATES


def validate_gates() -> None:
    """Assert every relation the bundle actually exhibits."""
    if len(GATES) != GATE_COUNT:
        raise GateContractError(f"expected {GATE_COUNT} gates, got {len(GATES)}")
    if LARGEST_GATE not in GATES or SMALLEST_GATE not in GATES:
        raise GateContractError("named largest/smallest gate is not in the table")
    by_bytes = sorted(GATES, key=lambda n: int(GATES[n]["bytes"]))  # type: ignore[call-overload]
    if by_bytes[0] != SMALLEST_GATE:
        raise GateContractError("SMALLEST_GATE is not actually the smallest")
    if by_bytes[-1] != LARGEST_GATE:
        raise GateContractError("LARGEST_GATE is not actually the largest")
    if cli_count_of(MAX_CLI_GATE) != MAX_CLI_COUNT:
        raise GateContractError("MAX_CLI_COUNT disagrees with its gate")
    if min(cli_count_of(n) for n in GATES) != MIN_CLI_COUNT:
        raise GateContractError("MIN_CLI_COUNT drifted")
    for name, row in GATES.items():
        exits = row["exits"]
        if not isinstance(exits, tuple) or EXIT_USAGE not in exits:
            raise GateContractError(f"{name}: every gate must be able to report usage (2)")
        if row["declared_only"] is not True:
            raise GateContractError(f"{name}: scope must stay declaration-bounded")
    if len(SCHEMA_BEARING_GATES) != 1:
        raise GateContractError("exactly one gate carries a schema id")
    if gate_of(SCHEMA_BEARING_GATES[0])["schema"] != "presentation-native-chart-titles.v1":
        raise GateContractError("schema id drifted")
    if SIBLING_IMPORT_COUNT != 3:
        raise GateContractError(f"expected 3 sibling importers, got {SIBLING_IMPORT_COUNT}")
    if len(FAIL_ON_FINDINGS_GATES) != 3:
        raise GateContractError("expected 3 opt-in-failure gates")
    if len(RECEIPT_GATES) != 1:
        raise GateContractError("expected exactly one receipt-capable gate")
    if GATE_TOTAL_LINES != 5655:
        raise GateContractError(f"expected 5655 total lines, got {GATE_TOTAL_LINES}")
    if not CHART_CONTENT_TYPE.endswith(".chart+xml"):
        raise GateContractError("chart content type drifted")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
