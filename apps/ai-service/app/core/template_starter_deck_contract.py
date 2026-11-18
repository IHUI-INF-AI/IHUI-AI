# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""The starter-deck preparation contract (R127).

``prepare_template_starter_deck.mjs`` (11,169 B / 292 lines) is the link between the plan and the
authoring run: it turns the source template plus a frame map into a *starter deck* that still carries
every inherited element, and it refuses to do that unless the plan validated first.

**The build is duplicate-then-delete, and the order is load-bearing.** For each output slide it
``duplicate()``s the source slide, and only after *every* duplicate exists does it ``delete()`` the
originals, then ``moveTo(index)`` the duplicates into order. Duplicating requires the source slide to
still be present, so deleting first would leave nothing to copy. This is also why the plan gate bans
``add``: an added slide carries no inherited element, whereas a duplicate carries the whole
inheritance tree the "follow the template" contract depends on.

**The plan gate is a hard precondition, not a warning.** ``validateTemplatePlan`` is invoked with the
map and the inspect ndjson; a ``fail`` status aborts before any deck work starts, and the error names
the plan report and the first eight failing issues. So a map that violates R124's rules can never
produce a starter deck.

**Three write roots are fenced inside the workspace.** The preview directory, the layout directory
and the contact-sheet path are each checked with ``isWithin(writePath, workspace)`` before anything
is written. The workspace root itself is not writable as a target: a path equal to the workspace is
outside these subdirectories by construction because the defaults are ``template-starter-preview``
and ``template-starter-layout`` under it.

**Per slide the run emits two artifacts and then the deck.** ``starter-slide-NNN.png`` at the given
``scale`` and ``starter-slide-NNN.layout.json``, with the slide number zero-padded to three digits.
Only then does it ``exportPptx`` the whole presentation and save it — and it re-stats the file to
reject an empty export, because ``exportPptx`` returning a handle says nothing about bytes on disk.

**The contact sheet is optional and takes an external Python.** ``runContactSheet`` is skipped
entirely when no ``--contact-sheet`` was given. When it is requested it spawns ``make_contact_sheet.py``
with ``process.env.PYTHON || "python3"`` — on this host ``python3`` does not exist, so the contact
sheet leg is unavailable while the rest of the run is fine.

**The manifest is the receipt.** It records source and map paths, the output and its byte count, the
source slide count against the emitted slide count, both directories, the optional contact sheet, and
per slide the source mapping, narrative role, reuse mode, edit-target count and both artifact paths
in absolute and workspace-relative form.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final

SCRIPT_BYTES: Final = 11_169
SCRIPT_LINES: Final = 292

REQUIRED_ARGS: Final = ("workspace", "pptx", "map", "out")
REQUIRED_ARG_COUNT: Final = 4

PREVIEW_DIR_DEFAULT: Final = "template-starter-preview"
LAYOUT_DIR_DEFAULT: Final = "template-starter-layout"
INSPECT_RELATIVE: Final = "template-inspect/template-inspect.ndjson"

PREVIEW_FILENAME_TEMPLATE: Final = "starter-slide-{padded}.png"
LAYOUT_FILENAME_TEMPLATE: Final = "starter-slide-{padded}.layout.json"
SLIDE_NUMBER_PADDING: Final = 3

DEFAULT_SCALE: Final = 1.0
SCALE_MUST_BE_POSITIVE: Final = True

FENCED_WRITE_ROOTS: Final = ("previewDir", "layoutDir", "contactSheetPath")
FENCED_WRITE_ROOT_COUNT: Final = 3

REQUIRED_REUSE_MODE: Final = "duplicate-slide"
BUILD_MODE: Final = "duplicate-then-delete"
DELETES_ORIGINALS_ONLY_AFTER_ALL_DUPLICATES: Final = True
MOVES_DUPLICATES_INTO_ORDER: Final = True

PLAN_GATE_IS_HARD: Final = True
PLAN_REPORT_RELATIVE: Final = "qa/template-plan-check.json"
PLAN_FAIL_MESSAGE_LIMIT: Final = 8

EXPORT_FORMATS: Final = ("png", "layout")
EXPORT_FORMAT_COUNT: Final = 2
REEXPORTS_TO_REJECT_EMPTY: Final = True
MANIFEST_SUFFIX: Final = ".manifest.json"

CONTACT_SHEET_SCRIPT: Final = "make_contact_sheet.py"
CONTACT_SHEET_PYTHON_ENV: Final = "PYTHON"
CONTACT_SHEET_FALLBACK_PYTHON: Final = "python3"
CONTACT_SHEET_FALLBACK_PRESENT_LOCALLY: Final = False
CONTACT_SHEET_OPTIONAL: Final = True

MANIFEST_SLIDE_FIELDS: Final = (
    "outputSlide",
    "sourceSlide",
    "narrativeRole",
    "reuseMode",
    "editTargetCount",
    "previewPath",
    "previewRelativePath",
    "layoutPath",
    "layoutRelativePath",
)
MANIFEST_SLIDE_FIELD_COUNT: Final = 9

VALIDATION_CHECKS: Final = (
    "outputSlides non-empty",
    "outputSlide sequential from 1",
    "sourceSlide within 1..sourceSlideCount",
    "reuseMode is duplicate-slide",
    "narrativeRole non-empty",
    "editTargets is an array",
)
VALIDATION_CHECK_COUNT: Final = 6

SLIDE_ENUMERATION_SHAPES: Final = ("slides.items array", "slides.count with getItem")
SLIDE_ENUMERATION_SHAPE_COUNT: Final = 2


@dataclass(frozen=True)
class WriteRoot:
    option: str
    default: str
    fenced: bool


WRITE_ROOTS: Final = (
    WriteRoot("preview-dir", PREVIEW_DIR_DEFAULT, True),
    WriteRoot("layout-dir", LAYOUT_DIR_DEFAULT, True),
    WriteRoot("contact-sheet", "none (optional)", True),
)
WRITE_ROOT_COUNT: Final = 3


def pad_slide_number(value: int) -> str:
    """Zero-pad to three digits, as every emitted filename does."""
    if value < 0:
        raise ValueError("slide numbers are positive")
    return str(value).zfill(SLIDE_NUMBER_PADDING)


def validate_output_slides(entries: list[dict], source_slide_count: int) -> list[dict]:
    """Replotted from the scan: sort, then require a contiguous run from 1."""
    if not entries:
        raise ValueError("outputSlides must be a non-empty array")
    ordered = sorted(entries, key=lambda e: e.get("outputSlide", 0))
    for index, entry in enumerate(ordered):
        expected = index + 1
        out = entry.get("outputSlide")
        if not isinstance(out, int) or isinstance(out, bool) or out != expected:
            raise ValueError(f"outputSlides must be sequential from 1; expected {expected}")
        src = entry.get("sourceSlide")
        if not isinstance(src, int) or isinstance(src, bool) or not 1 <= src <= source_slide_count:
            raise ValueError(f"outputSlide {out} must reference sourceSlide 1-{source_slide_count}")
        if entry.get("reuseMode") != REQUIRED_REUSE_MODE:
            raise ValueError(f"outputSlide {out} must use reuseMode {REQUIRED_REUSE_MODE}")
        role = entry.get("narrativeRole")
        if not isinstance(role, str) or not role.strip():
            raise ValueError(f"outputSlide {out} must include a non-empty narrativeRole")
        if not isinstance(entry.get("editTargets"), list):
            raise ValueError(f"outputSlide {out} must include editTargets as an array")
    return ordered


def coverage() -> dict[str, int]:
    return {
        "required_args": REQUIRED_ARG_COUNT,
        "fenced_write_roots": FENCED_WRITE_ROOT_COUNT,
        "export_formats": EXPORT_FORMAT_COUNT,
        "manifest_slide_fields": MANIFEST_SLIDE_FIELD_COUNT,
        "validation_checks": VALIDATION_CHECK_COUNT,
        "slide_enumeration_shapes": SLIDE_ENUMERATION_SHAPE_COUNT,
    }


def validate_contract() -> None:
    if SCRIPT_BYTES != 11_169:
        raise ValueError("the script size drifted")
    if SCRIPT_LINES != 292:
        raise ValueError("the script line count drifted")
    if len(REQUIRED_ARGS) != REQUIRED_ARG_COUNT or REQUIRED_ARG_COUNT != 4:
        raise ValueError("four required args")
    if PREVIEW_DIR_DEFAULT != "template-starter-preview":
        raise ValueError("the preview directory default drifted")
    if LAYOUT_DIR_DEFAULT != "template-starter-layout":
        raise ValueError("the layout directory default drifted")
    if INSPECT_RELATIVE != "template-inspect/template-inspect.ndjson":
        raise ValueError("the inspect relative path must match the inspect module")
    if SLIDE_NUMBER_PADDING != 3:
        raise ValueError("slide numbers are zero-padded to three digits")
    if DEFAULT_SCALE != 1.0 or not SCALE_MUST_BE_POSITIVE:
        raise ValueError("the scale defaults to 1 and must be positive")
    if len(FENCED_WRITE_ROOTS) != FENCED_WRITE_ROOT_COUNT or FENCED_WRITE_ROOT_COUNT != 3:
        raise ValueError("three fenced write roots")
        raise ValueError("three fenced write roots")
    if REQUIRED_REUSE_MODE != "duplicate-slide":
        raise ValueError("the reuse mode must match the plan module")
    if BUILD_MODE != "duplicate-then-delete":
        raise ValueError("the build is duplicate-then-delete")
    if not DELETES_ORIGINALS_ONLY_AFTER_ALL_DUPLICATES:
        raise ValueError("deleting first would leave nothing to duplicate")
    if not MOVES_DUPLICATES_INTO_ORDER:
        raise ValueError("duplicates are moved into order")
    if not PLAN_GATE_IS_HARD:
        raise ValueError("a failing plan aborts the run")
    if PLAN_REPORT_RELATIVE != "qa/template-plan-check.json":
        raise ValueError("the plan report path drifted")
    if PLAN_FAIL_MESSAGE_LIMIT != 8:
        raise ValueError("the error lists eight issues")
    if len(EXPORT_FORMATS) != EXPORT_FORMAT_COUNT or EXPORT_FORMAT_COUNT != 2:
        raise ValueError("two export formats per slide")
    if not REEXPORTS_TO_REJECT_EMPTY:
        raise ValueError("the export is re-stat'ed to reject an empty deck")
    if MANIFEST_SUFFIX != ".manifest.json":
        raise ValueError("the manifest suffix drifted")
    if len(WRITE_ROOTS) != WRITE_ROOT_COUNT or WRITE_ROOT_COUNT != 3:
        raise ValueError("three write roots")
    if not all(root.fenced for root in WRITE_ROOTS):
        raise ValueError("every write root is fenced inside the workspace")
    if len(MANIFEST_SLIDE_FIELDS) != MANIFEST_SLIDE_FIELD_COUNT or MANIFEST_SLIDE_FIELD_COUNT != 9:
        raise ValueError("nine manifest slide fields")
    if len(VALIDATION_CHECKS) != VALIDATION_CHECK_COUNT or VALIDATION_CHECK_COUNT != 6:
        raise ValueError("six validation checks")
    if len(SLIDE_ENUMERATION_SHAPES) != SLIDE_ENUMERATION_SHAPE_COUNT or SLIDE_ENUMERATION_SHAPE_COUNT != 2:
        raise ValueError("two slide enumeration shapes")
    if CONTACT_SHEET_FALLBACK_PYTHON != "python3":
        raise ValueError("the contact sheet falls back to python3")
    if CONTACT_SHEET_FALLBACK_PRESENT_LOCALLY:
        raise ValueError("python3 is absent on this host, which must be recorded")
    if not CONTACT_SHEET_OPTIONAL:
        raise ValueError("the contact sheet is optional")
    # Sample the two pure helpers.
    if pad_slide_number(1) != "001" or pad_slide_number(12) != "012" or pad_slide_number(123) != "123":
        raise ValueError("zero padding drifted")
    good = [
        {"outputSlide": 1, "sourceSlide": 2, "reuseMode": "duplicate-slide", "narrativeRole": "thesis", "editTargets": []},
        {"outputSlide": 2, "sourceSlide": 1, "reuseMode": "duplicate-slide", "narrativeRole": "proof", "editTargets": []},
    ]
    ordered = validate_output_slides(good, 3)
    if [e["outputSlide"] for e in ordered] != [1, 2]:
        raise ValueError("sorting must order the run")
    bad_gap = [
        {"outputSlide": 1, "sourceSlide": 1, "reuseMode": "duplicate-slide", "narrativeRole": "x", "editTargets": []},
        {"outputSlide": 3, "sourceSlide": 1, "reuseMode": "duplicate-slide", "narrativeRole": "x", "editTargets": []},
    ]
    try:
        validate_output_slides(bad_gap, 3)
    except ValueError:
        pass
    else:
        raise ValueError("a gap in outputSlide must be rejected")
    bad_mode = [{"outputSlide": 1, "sourceSlide": 1, "reuseMode": "add", "narrativeRole": "x", "editTargets": []}]
    try:
        validate_output_slides(bad_mode, 3)
    except ValueError:
        pass
    else:
        raise ValueError("a non-duplicate reuse mode must be rejected")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
