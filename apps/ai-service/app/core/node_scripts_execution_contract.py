# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""The fifteen .mjs helpers, measured (R120).

These are the scripts that carry the runtime plumbing rather than document content: how the
artifacts declare that an operation started, how a helper resolves the runtime's own
``node_modules``, and how SVG becomes a PNG without Inkscape.

Two findings are the reason this module exists rather than another prose report.

**The guard is a template copied four times, and only the format set differs.** The four
``mark_artifact_operation_started.mjs`` files are byte-similar from line 1 to line 22; the only
difference is ``validOutputFormats``. Documents accepts ``docx``, pdf accepts ``pdf``,
presentations accepts ``ppt`` and ``pptx``, and spreadsheets accepts five
(``csv``/``tsv``/``xls``/``xlsm``/``xlsx``). Everything else is identical: exactly six argv
entries, fixed positions, ``create`` or ``edit`` only, a safe integer between one and a hundred,
and ``exitCode = 2`` when anything is off. That is a deliberate choice to keep four independent
copies rather than share one module — so a fix to the guard has to be applied four times, which is
exactly the kind of drift this repo's single-source rule exists to prevent. Worth knowing before
anyone edits one of them.

**The rasteriser blocks its own decoders.** ``rasterize_svg.mjs`` calls
``sharp.block({ operation: ["VipsForeignLoad"] })`` and then unblocks only
``VipsForeignLoadSvg``. The comment says why: sharp sniffs input bytes, so an input merely
*named* ``.svg`` could otherwise reach a native raster decoder. This is a real hardening step, not
decoration, and it is the reason the script exists as its own subprocess instead of being inlined
into ``ensure_raster_image.py``. It also passes ``limitInputPixels: false``, so the pixel ceiling
is off — acceptable for a trusted local asset, dangerous for anything user-supplied.

**A measurement lesson.** The first run of these five branches reported ``rc=0`` on every failure.
That was not the tool lying; it was the harness. ``& $node script args | Select-Object -First 3``
leaves ``$LASTEXITCODE`` holding the exit code of the *pipe's last command*, not the node process.
Re-measured without the pipeline, the same five cases give ``0/1/1/1/1``. This is recorded because
it is the same class of error as the earlier "stderr lies" and "the output file exists" findings:
the number you read is not always the number you think you read.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final

SCRIPT_COUNT: Final = 15
TOTAL_BYTES: Final = 164_300  # about 164.3 KB across the fifteen files

# --- the artifact-operation guard, four copies ------------------------------------------------

MARK_SCRIPT_NAME: Final = "mark_artifact_operation_started.mjs"
MARK_COPY_SIZE_RANGE: Final = (735, 765)
MARK_OPERATION_KINDS: Final = ("create", "edit")
MARK_ARG_COUNT: Final = 6
MARK_ARG_ORDER: Final = (
    "--operation-kind",
    "<create|edit>",
    "--expected-output-count",
    "<1-100>",
    "--output-format",
    "<supported format>",
)
MARK_COUNT_RANGE: Final = (1, 100)
MARK_FAILURE_EXIT_CODE: Final = 2
MARK_ACCEPTS_ABSOLUTE_RELATIVE: Final = False  # it validates the format string, nothing else

MARK_FORMATS: Final = {
    "documents": ("docx",),
    "pdf": ("pdf",),
    "presentations": ("ppt", "pptx"),
    "spreadsheets": ("csv", "tsv", "xls", "xlsm", "xlsx"),
}

MARK_COPIES: Final = tuple(MARK_FORMATS)
MARK_COPIES_ARE_IDENTICAL_EXCEPT_FORMATS: Final = True
MARK_GUARD_IS_SHARED_MODULE: Final = False  # four independent copies by design
MARK_USE_CASE: Final = "declare that an authoring operation started, before the first write"

# --- runtime module resolution ----------------------------------------------------------------

RUNTIME_ENV_PRIMARY: Final = "RUNTIME_NODE_MODULES"
RUNTIME_ENV_FALLBACK: Final = "CODEX_PRIMARY_RUNTIME_NODE_MODULES"
RUNTIME_ENV_OVERRIDE_WINS: Final = True
RUNTIME_PATH_MUST_BE_ABSOLUTE: Final = True
RUNTIME_PATH_MUST_BE_DIRECTORY: Final = True
RUNTIME_REQUIRE_BASE: Final = "__runtime__.cjs"  # a synthetic path used only as a require anchor
RUNTIME_EXPORTS: Final = (
    "runtimeNodeModules",
    "requireRuntimeModule",
    "importRuntimeModule",
)

# --- SVG rasterisation ------------------------------------------------------------------------

RASTERIZE_SCRIPT: Final = "rasterize_svg.mjs"
RASTERIZE_ARGS: Final = ("--input", "--output")
RASTERIZE_ALLOWS_POSITIONALS: Final = False
RASTERIZE_STRICT_PARSE: Final = True
RASTERIZE_BLOCKS_ALL_DECODERS: Final = True
RASTERIZE_UNBLOCKS_ONLY: Final = "VipsForeignLoadSvg"
RASTERIZE_LIMIT_INPUT_PIXELS: Final = False
RASTERIZE_NEEDS_RUNTIME_MODULES: Final = True
RASTERIZE_CONSUMER: Final = "ensure_raster_image.py"
RASTERIZE_REPLACES: Final = "Inkscape"

# --- the measurement lesson -------------------------------------------------------------------

PIPELINE_MASKS_EXIT_CODE: Final = True
MEASURED_WITH_PIPELINE: Final = (0, 0, 0, 0, 0)
MEASURED_WITHOUT_PIPELINE: Final = (0, 1, 1, 1, 1)


@dataclass(frozen=True)
class Run:
    """One executed case. ``label`` names the branch, not the tool."""

    tool: str
    label: str
    rc: int
    note: str


MEASURED: Final = (
    Run("mark(documents)", "docx accepted", 0, "guard passes silently"),
    Run("mark(documents)", "pptx rejected", 2, "format not in the documents set"),
    Run("mark(presentations)", "pptx accepted", 0, ""),
    Run("mark(presentations)", "ppt accepted", 0, "both extensions accepted"),
    Run("mark(pdf)", "pdf accepted", 0, ""),
    Run("mark(spreadsheets)", "xlsx accepted", 0, ""),
    Run("mark(spreadsheets)", "docx rejected", 2, "format not in the spreadsheets set"),
    Run("mark(documents)", "missing args", 2, "argv length is not six"),
    Run("mark(documents)", "count=101", 2, "outside one to a hundred"),
    Run("mark(documents)", "operation-kind delete", 2, "only create and edit are legal"),
    Run("rasterize_svg", "no runtime modules", 1, "RUNTIME_NODE_MODULES is required"),
    Run("rasterize_svg", "absolute directory", 0, "produced a 663-byte PNG from a 200x100 SVG"),
    Run("rasterize_svg", "relative path", 1, "must be an absolute path"),
    Run("rasterize_svg", "positional args", 1, "ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL"),
    Run("rasterize_svg", "missing --input", 1, "Missing required --input"),
)

EXECUTED_SCRIPTS: Final = frozenset((
    "mark_artifact_operation_started.mjs (4 copies)",
    "rasterize_svg.mjs",
    "runtime_helpers.mjs",
))

READ_ONLY_SCRIPTS: Final = frozenset((
    # Not executed this round; the sizes are the only measured fact about them.
    "artifact_tool_utils.mjs",
    "create-template-skill.mjs",
    "validate_template_plan.mjs",
    "check_template_fidelity.mjs",
    "prepare_template_starter_deck.mjs",
    "export-google-workspace-file.mjs",
    "inspect_template_deck.mjs",
    "google-workspace-export-stdin-receiver.mjs",
    "render_presentation.mjs",
))

SCRIPT_LOCATIONS: Final = {
    "mark_artifact_operation_started.mjs (4 copies)": (
        "documents/container_tools",
        "pdf/container_tools",
        "presentations/container_tools",
        "spreadsheets/container_tools",
    ),
    "artifact_tool_utils.mjs": "presentations/container_tools",
    "rasterize_svg.mjs": "presentations/container_tools",
    "render_presentation.mjs": "presentations/container_tools",
    "runtime_helpers.mjs": "presentations/container_tools",
    "check_template_fidelity.mjs": "presentations/template_following_scripts",
    "inspect_template_deck.mjs": "presentations/template_following_scripts",
    "prepare_template_starter_deck.mjs": "presentations/template_following_scripts",
    "validate_template_plan.mjs": "presentations/template_following_scripts",
    "export-google-workspace-file.mjs": "template-creator/host",
    "google-workspace-export-stdin-receiver.mjs": "template-creator/host",
    "create-template-skill.mjs": "template-creator/scripts",
}


def accepted_formats(skill: str) -> tuple[str, ...]:
    if skill not in MARK_FORMATS:
        raise KeyError(f"no mark guard for {skill}")
    return MARK_FORMATS[skill]


def guard_accepts(skill: str, output_format: str, count: int = 1, kind: str = "create") -> bool:
    """Mirror the guard's own check, all six conditions at once."""
    return (
        kind in MARK_OPERATION_KINDS
        and MARK_COUNT_RANGE[0] <= count <= MARK_COUNT_RANGE[1]
        and output_format.lower() in MARK_FORMATS.get(skill, ())
    )


def exit_code_for(valid: bool) -> int:
    return 0 if valid else MARK_FAILURE_EXIT_CODE


def coverage() -> dict[str, int]:
    """Four mark-guard files plus rasterize and runtime_helpers are the six executed."""
    return {
        "scripts": SCRIPT_COUNT,
        "executed": len(MARK_COPIES) + 2,
        "read_only": len(READ_ONLY_SCRIPTS),
        "bytes": TOTAL_BYTES,
    }


def validate_contract() -> None:
    if len(MARK_FORMATS) != 4:
        raise ValueError("the guard is copied into four skills")
    executed = len(MARK_COPIES) + 2
    if executed + len(READ_ONLY_SCRIPTS) != SCRIPT_COUNT:
        raise ValueError(
            f"four guard copies plus two helpers plus {len(READ_ONLY_SCRIPTS)} read-only "
            f"does not reach {SCRIPT_COUNT}"
        )
    if MARK_ARG_COUNT != 6:
        raise ValueError("the guard requires exactly six argv entries")
    if MARK_FAILURE_EXIT_CODE != 2:
        raise ValueError("the guard signals misuse with exit code two")
    if not MARK_COPIES_ARE_IDENTICAL_EXCEPT_FORMATS:
        raise ValueError("the four copies were measured equal apart from the format set")
    if MARK_GUARD_IS_SHARED_MODULE:
        raise ValueError("the guard is four independent files, not one shared module")
    if len(accepted_formats("spreadsheets")) != 5:
        raise ValueError("spreadsheets accepts five output formats")
    if RUNTIME_ENV_PRIMARY != "RUNTIME_NODE_MODULES":
        raise ValueError("the primary override variable name drifted")
    if not RUNTIME_PATH_MUST_BE_ABSOLUTE:
        raise ValueError("the runtime path is validated as absolute")
    if not RASTERIZE_BLOCKS_ALL_DECODERS or RASTERIZE_UNBLOCKS_ONLY != "VipsForeignLoadSvg":
        raise ValueError("only the SVG decoder may load input")
    if len(MEASURED_WITH_PIPELINE) != len(MEASURED_WITHOUT_PIPELINE):
        raise ValueError("both measurement runs cover the same five branches")
    if sum(1 for a, b in zip(MEASURED_WITH_PIPELINE, MEASURED_WITHOUT_PIPELINE, strict=True) if a != b) != 4:
        raise ValueError("exactly four branches had their exit code masked by the pipeline")
    by_script: dict[str, int] = {}
    for run in MEASURED:
        by_script[run.tool] = by_script.get(run.tool, 0) + 1
    if len(MEASURED) != 15:
        raise ValueError(f"fifteen measured cases, found {len(MEASURED)}")
    if not any(r.rc == 0 for r in MEASURED) or not any(r.rc == 1 for r in MEASURED):
        raise ValueError("the measured set must contain successes and failures")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
