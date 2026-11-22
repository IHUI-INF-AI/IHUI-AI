# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""The presentations toolkit's full roster, and the overflow checker that does not check (R109).

Twelve container tools sit in one directory. Through R97-R108 six gates, the literal-chart
materialiser, and the render/montage pair were all exercised. This round closed the last two and
found something worth recording: the one tool whose whole job is to catch content spilling past
the canvas **does not catch it**.

``slides_test.py`` says what it does:

    Check a PPTX for content overflowing the original canvas by rendering with padding and
    inspecting the margins.

Three probes, all returning the same answer:

    a normal deck                    -> "Test passed. No overflow detected."  rc=0
    text pushed off the right edge   -> "Test passed. No overflow detected."  rc=0
    text starting at -4,000,000 EMU,
      width 30,000,000 EMU           -> "Test passed. No overflow detected."  rc=0

The middle case was confirmed by rendering it and looking: the word "OFF" sits at the right edge
with its tail cut off, and "CANVAS TEXT" is entirely gone. That is overflow by any reading, and
the checker calls it clean. The third case spans wider than the canvas in both directions and
still passes.

The deck is not the problem: ``ppt/presentation.xml`` carries
``<p:sldSz cx="12192000" cy="6858000"/>``, the standard 16:9 canvas, so the tool has the geometry
it would need. The failure is the tool's, not the input's.

**So the verdict is a negative one, and it matters**: this checker cannot be trusted as an
overflow gate. It returns zero for both a clean deck and an overflowing one, which makes its exit
code carry no information. Rendering plus a human look -- R108's path -- remains the only
verification that actually works.

The other tool behaves correctly by comparison:

    ensure_raster_image.py on an already-raster BMP -> rc=0, no output

That is right: a BMP is already raster, so there is nothing to convert. Silence means "nothing to
do", not "failed".
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Final

# --- the roster -------------------------------------------------------------------------

TOOL_DIRECTORY: Final = "container_tools"
TOOL_COUNT: Final = 12
TOOLS: Final = (
    ("inspect_presentation_layout_geometry.py", 99.6),
    ("native_quantitative_chart_gate.py", 44.2),
    ("materialize_literal_chart_workbooks.py", 36.0),
    ("inspect_presentation_package_integrity.py", 28.8),
    ("template_source_fidelity_gate.py", 21.7),
    ("native_table_arithmetic_gate.py", 20.8),
    ("create_montage.py", 10.45),
    ("render_slides.py", 8.5),
    ("ensure_raster_image.py", 7.2),
    ("slides_test.py", 6.4),
    ("native_chart_title_gate.py", 6.0),
    ("runtime_helpers.py", 3.5),
)
GATES_ROUNDS: Final = "R97-R106"  # the six gates
RENDER_ROUND: Final = "R108"  # render_slides + create_montage
LAST_TWO_ROUND: Final = "R109"  # slides_test + ensure_raster_image

# --- slides_test's stated job -------------------------------------------------------------

SLIDES_TEST: Final = "slides_test.py"
SLIDES_TEST_DESCRIPTION: Final = (
    "Check a PPTX for content overflowing the original canvas by rendering with padding "
    "and inspecting the margins."
)
SLIDES_TEST_POSITIONAL: Final = ("input_path",)
SLIDES_TEST_OPTIONS: Final = ("--width", "--height", "--pad_px")
SLIDES_TEST_DEFAULTS: Final = (1600, 900)
SLIDES_TEST_ACCEPTS_ONLY_PPTX: Final = True
PASS_TEXT: Final = "Test passed. No overflow detected."
PASS_EXIT_CODE: Final = 0

# --- the three probes -------------------------------------------------------------------

PROBE_CASES: Final = (
    ("clean-deck", 200, "Test passed. No overflow detected.", 0),
    ("text-off-right-edge", 200, "Test passed. No overflow detected.", 0),
    ("spanning-minus-4m-to-26m-emu", 200, "Test passed. No overflow detected.", 0),
)
PROBE_COUNT: Final = 3
ALL_PROBES_PASSED: Final = True
OVERFLOWING_DECK_PASSED: Final = True

# --- the visual confirmation -----------------------------------------------------------

RENDERED_OVERFLOW_OBSERVED: Final = True  # "OFF" at the right edge, tail cut
VISIBLE_OVERFLOW_WITH_CLEAN_VERDICT: Final = True
SLIDES_TEST_DETECTS_OVERFLOW: Final = False

# --- the geometry was present ----------------------------------------------------------

SLIDE_SIZE_DECLARED: Final = True
SLIDE_SIZE_XML: Final = '<p:sldSz cx="12192000" cy="6858000"/>'
CANVAS_WIDTH_EMU: Final = 12_192_000
CANVAS_HEIGHT_EMU: Final = 6_858_000
FAROUT_START_EMU: Final = -4_000_000
FAROUT_WIDTH_EMU: Final = 30_000_000
FAROUT_EXCEEDS_CANVAS: Final = True
DECLARATION_NOT_THE_PROBLEM: Final = True

# --- the verdict ---------------------------------------------------------------------

EXIT_CODE_CARRIES_INFORMATION: Final = False
USABLE_AS_OVERFLOW_GATE: Final = False
RENDER_PLUS_EYES_REMAINS_ONLY_WORKING: Final = True

# --- ensure_raster_image, which behaves ---------------------------------------------

ENSURE_RASTER: Final = "ensure_raster_image.py"
ENSURE_RASTER_DESCRIPTION: Final = "Ensure input images are rasterized; convert to PNG if needed."
ENSURE_RASTER_INPUT_MODES: Final = ("--input_files", "--input_dir")
ENSURE_RASTER_OUTPUT_DEFAULT: Final = "written next to inputs"
BMP_PROBE_BYTES: Final = 4_854
BMP_PROBE_EXIT_CODE: Final = 0
BMP_PROBE_OUTPUT_FILES: Final = 0
BMP_ALREADY_RASTER: Final = True
SILENCE_MEANS_NOTHING_TO_DO: Final = True
ENSURE_RASTER_BEHAVES_CORRECTLY: Final = True


class ToolkitError(ValueError):
    """Raised when the negative verdict on slides_test is softened."""


def exit_code_is_informative(overflowing_passes: bool) -> bool:
    """A checker that passes an overflowing deck carries no information in its exit code."""
    return not overflowing_passes


def toolkit_covers_all_tools() -> bool:
    """Every tool in the directory appears in the roster."""
    return len(TOOLS) == TOOL_COUNT == 12


def toolkit_contract() -> Mapping[str, object]:
    """The roster and the verdict."""
    return {
        "tools": TOOL_COUNT,
        "slides_test_detects": SLIDES_TEST_DETECTS_OVERFLOW,
        "usable_as_gate": USABLE_AS_OVERFLOW_GATE,
        "ensure_raster_ok": ENSURE_RASTER_BEHAVES_CORRECTLY,
    }


def validate_toolkit_contract() -> None:
    """Assert the roster and above all that the negative verdict stays negative."""
    if TOOL_COUNT != 12 or len(TOOLS) != 12:
        raise ToolkitError("twelve tools")
    if not toolkit_covers_all_tools():
        raise ToolkitError("the roster must be complete")
    for name, kb in TOOLS:
        if not name.endswith(".py"):
            raise ToolkitError("every entry is a python file")
        if kb <= 0:
            raise ToolkitError("every entry has a size")
    if not any(name == SLIDES_TEST for name, _ in TOOLS):
        raise ToolkitError("slides_test is in the roster")
    if not any(name == ENSURE_RASTER for name, _ in TOOLS):
        raise ToolkitError("ensure_raster_image is in the roster")

    if SLIDES_TEST_DESCRIPTION != (
        "Check a PPTX for content overflowing the original canvas by rendering with padding "
        "and inspecting the margins."
    ):
        raise ToolkitError("the stated job is evidence and must stay verbatim")
    if SLIDES_TEST_POSITIONAL != ("input_path",):
        raise ToolkitError("one positional")
    if len(SLIDES_TEST_OPTIONS) != 3:
        raise ToolkitError("three options")
    if SLIDES_TEST_DEFAULTS != (1600, 900):
        raise ToolkitError("defaults drifted")
    if PASS_TEXT != "Test passed. No overflow detected.":
        raise ToolkitError("the pass text is evidence")

    if PROBE_COUNT != 3 or len(PROBE_CASES) != 3:
        raise ToolkitError("three probes")
    for case, _pad, text, rc in PROBE_CASES:
        if text != PASS_TEXT:
            raise ToolkitError(f"{case} returned the pass text")
        if rc != PASS_EXIT_CODE:
            raise ToolkitError(f"{case} returned zero")
    if ALL_PROBES_PASSED is not True:
        raise ToolkitError("all three probes passed")
    if OVERFLOWING_DECK_PASSED is not True:
        raise ToolkitError("the overflowing decks passed too -- that is the finding")

    if RENDERED_OVERFLOW_OBSERVED is not True:
        raise ToolkitError("the overflow was seen in a rendered png")
    if VISIBLE_OVERFLOW_WITH_CLEAN_VERDICT is not True:
        raise ToolkitError("visible overflow carried a clean verdict")
    if SLIDES_TEST_DETECTS_OVERFLOW is not False:
        raise ToolkitError(
            "the checker does not detect overflow; never claim it does"
        )

    if SLIDE_SIZE_DECLARED is not True:
        raise ToolkitError("the deck declares its canvas size")
    if SLIDE_SIZE_XML != '<p:sldSz cx="12192000" cy="6858000"/>':
        raise ToolkitError("the size xml is evidence")
    if CANVAS_WIDTH_EMU != 12_192_000 or CANVAS_HEIGHT_EMU != 6_858_000:
        raise ToolkitError("canvas dimensions drifted")
    if FAROUT_EXCEEDS_CANVAS is not True:
        raise ToolkitError("the farout shape exceeds the canvas in both directions")
    if FAROUT_START_EMU >= 0 or FAROUT_WIDTH_EMU <= CANVAS_WIDTH_EMU:
        raise ToolkitError("the farout shape must start negative and exceed the width")
    if DECLARATION_NOT_THE_PROBLEM is not True:
        raise ToolkitError("the failure is the tool's, not the input's")

    if EXIT_CODE_CARRIES_INFORMATION is not False:
        raise ToolkitError("the exit code carries no information")
    if exit_code_is_informative(True):
        raise ToolkitError("passing an overflowing deck cannot be informative")
    if USABLE_AS_OVERFLOW_GATE is not False:
        raise ToolkitError("it cannot serve as a gate")
    if RENDER_PLUS_EYES_REMAINS_ONLY_WORKING is not True:
        raise ToolkitError("rendering plus looking remains the working path")

    if ENSURE_RASTER_DESCRIPTION != (
        "Ensure input images are rasterized; convert to PNG if needed."
    ):
        raise ToolkitError("ensure_raster description is evidence")
    if len(ENSURE_RASTER_INPUT_MODES) != 2:
        raise ToolkitError("two input modes")
    if BMP_PROBE_EXIT_CODE != 0 or BMP_PROBE_OUTPUT_FILES != 0:
        raise ToolkitError("the bmp probe exited zero and wrote nothing")
    if BMP_ALREADY_RASTER is not True:
        raise ToolkitError("a bmp is already raster")
    if SILENCE_MEANS_NOTHING_TO_DO is not True:
        raise ToolkitError("silence means nothing to do, not failure")
    if ENSURE_RASTER_BEHAVES_CORRECTLY is not True:
        raise ToolkitError("ensure_raster behaved correctly")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
