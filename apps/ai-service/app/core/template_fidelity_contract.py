# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""The template fidelity contract (R126).

``check_template_fidelity.mjs`` is the last gate before a template-followed deck is accepted, and
it is unusual because **most of it inspects the author's source code, not the deck**.

**Cheating is detected by which tools the author used.** Six patterns are failures on sight:

- ``deck-affecting-python`` — ``from pptx import``, ``import pptx``, ``Presentation(`` or
  ``.save(...pptx)``. python-pptx rewrites the package from scratch, which is exactly the thing
  "follow this template" forbids.
- ``direct-ooxml-mutation`` — ``zipfile``/``ZipFile`` together with a write verb or a package path
  (``ppt/slides/``, ``_rels/``, ``[Content_Types].xml``). Patching the zip directly bypasses the
  library that would have enforced the template's geometry.
- ``libreoffice-pptx-mutation`` — ``soffice ... --convert-to pptx``. A conversion round-trip
  reflows the deck.
- ``fresh-slide-rebuild`` — ``Presentation.create(`` or ``presentation.slides.add(``. Building a new
  deck and adding slides is the opposite of importing and editing.

**Two positive requirements sit beside the bans, and they are the ones people forget.** The combined
source must contain ``PresentationFile.importPptx(`` *and* a starter token
(``template-starter.pptx``, ``starterPptx`` or ``starterPptxPath``), and it must contain
``PresentationFile.exportPptx(``. A run that produced a correct-looking deck by other means is
still a failure, because the evidence that it followed the template is missing. This is the mirror
of the ban list: not "you must not use X" but "you must show you used Y".

**The scan surface is eight file types plus an agent log.** ``.mjs .js .cjs .ts .py .sh .txt .md
.jsonl`` under the edit directory, with the log appended if present. Text-only evidence means a
cheat recorded in a comment or a log line is still a cheat.

**Two different placeholder problems, not one.** ``unresolved-placeholder`` is text that still
reads like a prompt — "Click to add title", "Title goes here", "lorem ipsum", "template
instruction" — found in either the layout JSON or the raw ``<a:t>`` runs. ``empty-structural-
placeholder`` is a shape carrying ``<p:ph>`` whose text runs are entirely blank. A slide can pass
one and fail the other: the title box may be empty (structural) while the body still says "Text goes
here" (textual). Both are failures because a template's placeholders are the slots the plan was
supposed to fill.

**Overlays are judged geometrically, not visually.** For each final element that looks like an
opaque panel, the scan skips it when its best IoU against any starter element exceeds ``0.92`` —
above that it is the inherited element redrawn, not a new shape. Otherwise it compares against
every *content* element in the starter layout and fails ``mask-cover-overlay`` when either the
intersection covers more than ``35%`` of the inherited element's area, **or** the new element's
centre lands inside the inherited element. The area test catches a banner pasted over a body block;
the centre test catches a small label dropped on top of a heading, which the area test alone would
forgive.

**Slide size is assumed, not measured.** ``DEFAULT_SLIDE_SIZE`` is 1280×720 and the panel test uses
that area, so a 4:3 deck is evaluated against a 16:9 yardstick.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final

SCRIPT_BYTES: Final = 18_101
SCRIPT_LINES: Final = 502

DEFAULT_SLIDE_WIDTH: Final = 1280
DEFAULT_SLIDE_HEIGHT: Final = 720
SLIDE_SIZE_ASSUMED_NOT_MEASURED: Final = True

PLACEHOLDER_PATTERNS: Final = (
    "slide number",
    "date",
    "footer",
    "click to add title|subtitle|text",
    "title|subtitle|name|text|body goes here",
    "lorem ipsum",
    "template instruction",
)
PLACEHOLDER_PATTERN_COUNT: Final = 7

SCAN_EXTENSIONS: Final = (".mjs", ".js", ".cjs", ".ts", ".py", ".sh", ".txt", ".md", ".jsonl")
SCAN_EXTENSION_COUNT: Final = 9
AGENT_LOG_APPENDED: Final = True
TEXT_ONLY_EVIDENCE: Final = True


@dataclass(frozen=True)
class Ban:
    code: str
    signal: str
    why: str


BANS: Final = (
    Ban("deck-affecting-python", "from pptx import / import pptx / Presentation(", "python-pptx rebuilds the package from scratch"),
    Ban("deck-affecting-python", ".save(...pptx)", "python-pptx save rewrites the package"),
    Ban("direct-ooxml-mutation", "zipfile with a write verb or a package path", "patching the zip bypasses the geometry library"),
    Ban("libreoffice-pptx-mutation", "soffice --convert-to pptx", "a conversion round-trip reflows the deck"),
    Ban("fresh-slide-rebuild", "Presentation.create(", "building a new deck is the opposite of importing one"),
    Ban("fresh-slide-rebuild", "presentation.slides.add(", "adding fresh slides is the opposite of editing inherited ones"),
)
BAN_COUNT: Final = 6
BAN_CODES: Final = ("deck-affecting-python", "direct-ooxml-mutation", "libreoffice-pptx-mutation", "fresh-slide-rebuild")


@dataclass(frozen=True)
class Evidence:
    code: str
    signal: str
    note: str


REQUIRED_EVIDENCE: Final = (
    Evidence("missing-starter-import-evidence", "PresentationFile.importPptx(", "the starter must be imported"),
    Evidence("missing-artifact-export-evidence", "PresentationFile.exportPptx(", "the deck must be exported by the artifact tool"),
)
REQUIRED_EVIDENCE_COUNT: Final = 2
STARTER_TOKEN_HINTS: Final = ("template-starter.pptx", "starterPptx", "starterPptxPath")
STARTER_TOKENS_REQUIRED_WITH_IMPORT: Final = True

STRUCTURAL_PLACEHOLDER_TAG: Final = "<p:ph>"
TEXT_RUN_TAG: Final = "<a:t>"
TWO_DISTINCT_PLACEHOLDER_PROBLEMS: Final = True

OVERLAY_IOU_SKIP_ABOVE: Final = 0.92
OVERLAY_OVERLAP_OF_INHERITED: Final = 0.35
OVERLAY_CENTRE_INSIDE_ALSO_FAILS: Final = True
OVERLAY_ONLY_OPAQUE_PANELS: Final = True

ISSUE_CODES: Final = (
    "missing-final-pptx",
    "deck-affecting-python",
    "direct-ooxml-mutation",
    "libreoffice-pptx-mutation",
    "fresh-slide-rebuild",
    "missing-starter-import-evidence",
    "missing-artifact-export-evidence",
    "unresolved-placeholder",
    "empty-structural-placeholder",
    "mask-cover-overlay",
)
ISSUE_COUNT: Final = 10

SCANNERS: Final = (
    "scanAuthoringFiles",
    "scanFinalLayouts",
    "scanPptxPlaceholders",
    "scanOverlays",
)
SCANNER_COUNT: Final = 4

STATUSES: Final = ("fail", "warning", "pass")
REPORT_JSON: Final = "qa/template-fidelity-check.json"
REPORT_TEXT: Final = "qa/template-fidelity-check.txt"

MISSING_OPTIONAL_DIRS_SKIP_NOT_FAIL: Final = True


def is_placeholder_text(text: str) -> bool:
    lowered = text.strip().lower()
    if lowered in {"slide number", "date", "footer"}:
        return True
    if lowered.startswith("click to add "):
        return True
    if lowered.endswith(" goes here"):
        return True
    if lowered.startswith("lorem ipsum"):
        return True
    return "template instruction" in lowered


def overlay_is_a_mask(
    intersection_area: float,
    inherited_area: float,
    best_iou: float,
    centre_inside: bool,
) -> bool:
    """Replotted from the scan: high IoU means redrawn, not overlaid."""
    if best_iou > OVERLAY_IOU_SKIP_ABOVE:
        return False
    if inherited_area <= 0:
        return False
    if intersection_area > inherited_area * OVERLAY_OVERLAP_OF_INHERITED:
        return True
    return bool(centre_inside)


def coverage() -> dict[str, int]:
    return {
        "bans": BAN_COUNT,
        "required_evidence": REQUIRED_EVIDENCE_COUNT,
        "scanners": SCANNER_COUNT,
        "issue_codes": ISSUE_COUNT,
        "placeholder_patterns": PLACEHOLDER_PATTERN_COUNT,
        "scan_extensions": SCAN_EXTENSION_COUNT,
    }


def validate_contract() -> None:
    if SCRIPT_BYTES != 18_101:
        raise ValueError("the script size drifted")
    if (DEFAULT_SLIDE_WIDTH, DEFAULT_SLIDE_HEIGHT) != (1280, 720):
        raise ValueError("the assumed slide size drifted")
    if not SLIDE_SIZE_ASSUMED_NOT_MEASURED:
        raise ValueError("the slide size is assumed, and that must be recorded")
    if len(PLACEHOLDER_PATTERNS) != PLACEHOLDER_PATTERN_COUNT or PLACEHOLDER_PATTERN_COUNT != 7:
        raise ValueError("seven placeholder patterns")
    if len(SCAN_EXTENSIONS) != SCAN_EXTENSION_COUNT or SCAN_EXTENSION_COUNT != 9:
        raise ValueError("nine scanned extensions")
    if not AGENT_LOG_APPENDED or not TEXT_ONLY_EVIDENCE:
        raise ValueError("the scan is text-only and includes the log")
    if len(BANS) != BAN_COUNT or BAN_COUNT != 6:
        raise ValueError("six ban triggers")
    if {b.code for b in BANS} != set(BAN_CODES):
        raise ValueError("the ban codes must match the recorded set")
    if len(BAN_CODES) != 4:
        raise ValueError("four distinct ban codes across six triggers")
    if len(REQUIRED_EVIDENCE) != REQUIRED_EVIDENCE_COUNT or REQUIRED_EVIDENCE_COUNT != 2:
        raise ValueError("two required evidence items")
    if not STARTER_TOKENS_REQUIRED_WITH_IMPORT:
        raise ValueError("import alone is not enough; a starter token must appear")
    if len(STARTER_TOKEN_HINTS) != 3:
        raise ValueError("three starter token hints")
    if STRUCTURAL_PLACEHOLDER_TAG != "<p:ph>" or TEXT_RUN_TAG != "<a:t>":
        raise ValueError("the OOXML tags drifted")
    if not TWO_DISTINCT_PLACEHOLDER_PROBLEMS:
        raise ValueError("empty and textual placeholders are distinct")
    if OVERLAY_IOU_SKIP_ABOVE != 0.92:
        raise ValueError("the IoU skip threshold is 0.92")
    if OVERLAY_OVERLAP_OF_INHERITED != 0.35:
        raise ValueError("the overlap threshold is 35 percent")
    if not OVERLAY_CENTRE_INSIDE_ALSO_FAILS:
        raise ValueError("a centre landing inside is also a mask")
    if not OVERLAY_ONLY_OPAQUE_PANELS:
        raise ValueError("transparent shapes are not masks")
    if len(ISSUE_CODES) != ISSUE_COUNT or ISSUE_COUNT != 10:
        raise ValueError("ten issue codes")
    if len(set(ISSUE_CODES)) != ISSUE_COUNT:
        raise ValueError("issue codes must be unique")
    if len(SCANNERS) != SCANNER_COUNT or SCANNER_COUNT != 4:
        raise ValueError("four scanners")
    if STATUSES != ("fail", "warning", "pass"):
        raise ValueError("three statuses")
    if REPORT_JSON != "qa/template-fidelity-check.json":
        raise ValueError("the report path drifted")
    if not MISSING_OPTIONAL_DIRS_SKIP_NOT_FAIL:
        raise ValueError("a missing optional directory skips a scan rather than failing")
    # Sample the two pure helpers so a drifted rule cannot pass silently.
    if not is_placeholder_text("Click to add title"):
        raise ValueError("that is a placeholder prompt")
    if not is_placeholder_text("Body goes here"):
        raise ValueError("that is a placeholder prompt")
    if is_placeholder_text("Quarterly Review"):
        raise ValueError("real content is not a placeholder")
    if overlay_is_a_mask(400.0, 1000.0, 0.10, False) is not True:
        raise ValueError("40 percent overlap is a mask")
    if overlay_is_a_mask(200.0, 1000.0, 0.10, False) is not False:
        raise ValueError("20 percent overlap alone is not a mask")
    if overlay_is_a_mask(200.0, 1000.0, 0.10, True) is not True:
        raise ValueError("a centre landing inside is a mask even under the area threshold")
    if overlay_is_a_mask(900.0, 1000.0, 0.95, True) is not False:
        raise ValueError("a redrawn inherited element is not a mask")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
