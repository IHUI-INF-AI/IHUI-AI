# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""The presentation finaliser contract, read from source (R121).

``artifact_tool_utils.mjs`` is the heaviest single file in the plugin set (55 KB, 1,077 lines) and
it is where the deck is *published*, not merely written. This module records what it enforces,
because the enforcement is the interesting part: a finaliser that overwrites its target or
accepts its own output as proof would be worthless, and this one refuses all four of the obvious
ways to cheat.

**It cannot be approved by its own product.** A generated deck may not serve as the typography
reference (``A generated presentation cannot approve its own typography``) and may not serve as
the approved source template (``...cannot approve its own template fidelity``). The font policy's
reference file and the template's source are both excluded from being the candidate or the final
path. This closes the loop where you validate a deck against itself.

**Source-declared subsets never exempt what is actually there.** If the caller declares chart
owners ``[2, 5]`` while the file contains charts on slides ``[2, 3, 5]``, the declared set is
unioned with the discovered set (``[...new Set([...owners, ...discovered])].sort()``). A caller
cannot narrow the gate by omitting the charts it knows will fail.

**Publication is a hard link, not a copy over.** The file is copied to a staged name with
``COPYFILE_EXCL``, chmod 0600 off Windows, its sha256 is compared against the validated hash, then
the first-party-import hash, then the chart-title hash — three independent confirmations — and
only then ``fs.link(stage, finalPath)`` publishes it atomically. Afterwards the final path is
*re-read* and hashed again. The receipt is written with ``flag: "wx"`` so it cannot clobber an
existing one.

**A failed publish does not delete the user's file.** The rollback branch unlinks the final path
only when ``current.dev`` and ``current.ino`` still match the link this finaliser created. The
comment says it outright: ``Do not remove a user save or other file that replaced our published
link.``

**Nothing may change mid-flight.** Three snapshots are hashed before validation and re-hashed
after: the original candidate, the validated candidate, the typography reference, and the source
template. Each re-check throws ``...changed during finalization``. The original is additionally
compared on inode, size and mtime, not just hash.

One correction to an earlier finding: **presentations do not need LibreOffice.** The header of
``render_presentation.mjs`` reads ``render PowerPoint decks through @oai/artifact-tool instead of
calling LibreOffice/soffice directly``. That is why decks produce PNGs on a machine with no
``soffice.exe`` while documents cannot — different rendering legs entirely.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final

UTILS_LINES: Final = 1_077
UTILS_BYTES: Final = 55_404
UTILS_EXPORTS: Final = (
    "PREFERRED_PRESENTATION_FONTS",
    "resolvePresentationFont",
    "applyPresentationChartFont",
    "makeNativeBulletParagraphs",
    "resolvePresentationSlideCount",
    "normalizePresentationFontPolicy",
    "finalizePresentation",
)

# --- fonts ------------------------------------------------------------------------------------

PREFERRED_PRESENTATION_FONTS: Final = ("Helvetica Neue", "Helvetica", "Arial", "Aptos")
FONT_SOURCE_KEYS: Final = ("sourceFont", "fontFamily")
FONT_DISCOVERY_LIBRARIES: Final = ("skia-canvas", "@napi-rs/canvas")
FONT_DISCOVERY_FAILS_LOUDLY: Final = True  # no silent fallback to a guessed family

FONT_BASIS_VALUES: Final = ("default", "design", "user_request", "reference")
FONT_POLICY_KEYS: Final = ("basis", "families", "referencePath", "referenceSha256", "scriptFonts")
FONT_FAMILY_COUNT_RANGE: Final = (1, 16)
FONT_DEFAULT_FORBIDS_EXPLICIT_FAMILIES: Final = True
SCRIPT_FONT_KEYS: Final = ("ea", "cs", "symbol")

# --- the typography reference must be provably used --------------------------------------------

REFERENCE_EXTENSIONS: Final = (".pptx", ".pdf")
REFERENCE_SHA_PATTERN: Final = "64 lowercase hex"
REFERENCE_SIZE_RANGE: Final = (5, 250 * 1024 * 1024)
REFERENCE_PDF_SIGNATURE: Final = "%PDF-"
REFERENCE_PPTX_SIGNATURE: Final = "PK"
REFERENCE_FONT_INSPECTOR: Final = "inspect_presentation_layout_geometry.py --inspect-font-families"
REFERENCE_FONT_MUST_APPEAR: Final = True
REFERENCE_ONLY_FROM_REFERENCE_BASIS: Final = True  # other bases may not name a source file

# Subset prefixes and style suffixes are stripped before comparison, because a PDF encodes
# ``ABCDEF+HelveticaNeue-Bold`` where the deck says ``Helvetica Neue``.
FONT_SUBSET_PREFIX_PATTERN: Final = "^[A-Z]{6}+"
FONT_STYLE_SUFFIXES: Final = ("BoldItalic", "BoldOblique", "Bold", "Italic", "Oblique", "Regular", "Roman")
FONT_ALIASES: Final = {"arialmt": "arial", "helveticaneue": "helvetica neue"}

# --- layout flags: the finaliser's CLI contract ------------------------------------------------

MAX_LAYOUT_ARGS: Final = 96
VALUE_FLAGS: Final = {
    "--expected-aspect": r"^\d{1,4}:\d{1,4}$",
    "--expected-slide-size-emu": r"^\d{1,12},\d{1,12}$",
    "--expected-slide-count": r"^[1-9]\d{0,3}$",
    "--require-native-table-slide": r"^[1-9]\d{0,3}$",
    "--require-editorial-slide": r"^[1-9]\d{0,3}$",
    "--approved-heading-slide": r"^[1-9]\d{0,3}$",
    "--approved-bullet-slide": r"^[1-9]\d{0,3}$",
    "--cover-role": r"^(none|cover|explicit_hybrid)$",
    "--cover-word-limit": r"^[1-9]\d{0,4}$",
    "--max-redundant-table-charts": r"^\d{1,3}$",
    "--approved-redundant-chart-slide": r"^[1-9]\d{0,3}$",
    "--max-content-prose-words": r"^[1-9]\d{0,4}$",
    "--approved-dense-slide": r"^[1-9]\d{0,3}$",
    "--approved-image-sha256": r"^[a-fA-F0-9]{64}$",
    "--approved-icon-slide": r"^[1-9]\d{0,3}$",
    "--approved-logo-sha256": r"^[a-fA-F0-9]{64}$",
    "--max-logo-area": r"^(?:0(?:\.\d{1,8})?|1(?:\.0{1,8})?)$",
    "--approved-logo-placement-slide": r"^[1-9]\d{0,3}$",
    "--folio-mode": r"^(none|actual_unpadded)$",
}
BOOLEAN_FLAGS: Final = (
    "--allow-cover-chart",
    "--allow-cover-table",
    "--forbid-unapproved-decorative-icons",
    "--require-uniform-font-family",
    "--validate-bullet-geometry",
    "--validate-heading-fit",
    "--validate-heading-punctuation",
    "--require-logo-bottom-left",
)
VALUE_FLAG_COUNT: Final = 19
BOOLEAN_FLAG_COUNT: Final = 8

COVER_ROLE_VALUES: Final = ("none", "cover", "explicit_hybrid")
COVER_CHARTS_NEED_HYBRID: Final = True  # cover charts and tables require explicit_hybrid
COVER_ROLE_DUPLICATE_ALLOWED: Final = False
SLIDE_COUNT_DUPLICATE_ALLOWED: Final = False

SLIDE_COUNT_KEYS: Final = (
    "requestedContentSlideCount",
    "explicitTotalSlideCount",
    "approvedFixedTemplateSlideCount",
)
SLIDE_COUNT_ADDED_FOR_COVER: Final = 1  # content-plus-cover is opt-in
SLIDE_COUNT_RANGE: Final = (1, 9999)

NATIONAL_TABLE_OWNER_MAX: Final = 256
SLIDE_NUMBER_RANGE: Final = (1, 9999)
OWNERS_MUST_BE_DUPLICATE_FREE: Final = True
OWNER_SET_MUST_MATCH_DECLARED: Final = True

# --- bullets ----------------------------------------------------------------------------------

BULLET_EMU_PER_POINT: Final = 12_700
BULLET_SPACING_PER_POINT: Final = 100  # paragraph spacing is 1/100 pt
BULLET_DEFAULTS: Final = {
    "marginLeftPoints": 18,
    "hangingPoints": 9,
    "spaceAfterPoints": 8,
    "bulletCharacter": "\u2022",
}
BULLET_OPTION_KEYS: Final = tuple(BULLET_DEFAULTS)
BULLET_POINT_RANGE: Final = (0, 1000)
BULLET_MARKER_MUST_BE_ONE_CHAR: Final = True

# --- finalisation: the publication lock -------------------------------------------------------

MAX_PRESENTATION_BYTES: Final = 250 * 1024 * 1024
FINALIZE_REQUIRES_PPTX: Final = True
FINALIZE_OVERWRITE_ALLOWED: Final = False
FINALIZE_CANDIDATE_MUST_BE_INSIDE_WORKSPACE: Final = True
FINALIZE_FINAL_MUST_BE_INSIDE_WORKSPACE: Final = True
FINALIZE_CANDIDATE_MUST_DIFFER_FROM_FINAL: Final = True
FINALIZE_SYMLINKS_REJECTED: Final = True
FINALIZE_SELF_APPROVAL_REJECTED: Final = True
FINALIZE_UNION_OF_CHART_OWNERS: Final = True
FINALIZE_STAGED_COPY_EXCLUSIVE: Final = True
FINALIZE_STAGED_MODE: Final = 0o600
FINALIZE_PUBLISHES_BY_HARD_LINK: Final = True
FINALIZE_VERIFIES_AFTER_PUBLISH: Final = True
FINALIZE_RECEIPT_EXCLUSIVE: Final = True
FINALIZE_ROLLBACK_PRESERVES_USER_FILE: Final = True

REQUIRED_PACKAGE_VALIDATORS: Final = (
    "inspect_presentation_package_integrity.py",
    "inspect_presentation_layout_geometry.py",
    "native_quantitative_chart_gate.py",
    "native_chart_title_gate.py",
    "native_table_arithmetic_gate.py",
    "template_source_fidelity_gate.py",
)
VALIDATORS_MUST_SHARE_DIRECTORY: Final = True
VALIDATORS_MUST_MATCH_OWN_PACKAGE: Final = True

REJECTED_MOTION_OPTIONS: Final = (
    "motionPolicy",
    "explanatoryMotion",
    "realWorldMotion",
    "verifiedStrokeMotion",
)

# Four independent hashes are re-checked before publishing.
HASHED_SNAPSHOTS: Final = (
    "originalCandidateHash",
    "validationHash",
    "fontPolicy.reference.sha256",
    "templatePolicy.sha256",
)
ORIGINAL_COMPARED_ON: Final = ("ino", "size", "mtimeMs", "sha256")
PUBLISHED_COMPARED_ON: Final = ("ino", "size", "mtimeMs", "sha256")
POST_PUBLISH_REHASH: Final = True
TRIPLE_HASH_CONFIRMATION: Final = ("validation", "firstPartyImport", "chartTitle")

RECEIPT_SCHEMA_VERSION: Final = "presentation-finalization.v1"
RECEIPT_SECTIONS: Final = (
    "packageIntegrity",
    "presentationLayout",
    "fontSelection",
    "firstPartyImport",
    "nativeTableArithmetic",
    "nativeChartTitles",
    "sourceDerivedPolicyFlags",
    "nativeChartValidation",
)
RECEIPT_MUST_STAY_INSIDE_WORKSPACE: Final = True
RECEIPT_MUST_STAY_OUTSIDE_FINAL_OUTPUT: Final = True

# --- rendering --------------------------------------------------------------------------------

RENDER_SCRIPT: Final = "render_presentation.mjs"
RENDER_ENGINE: Final = "@oai/artifact-tool"
RENDER_NEEDS_LIBREOFFICE: Final = False  # the header says so outright
RENDER_USED_BY: Final = "render_slides.py"
RENDER_OUTPUT_PATTERN: Final = "slide-{n}.png"
RENDER_OUTPUT_IS_ONE_BASED: Final = True
RENDER_DEFAULT_SCALE: Final = 1
RENDER_ARGS: Final = ("--help", "--input", "--output_dir", "--scale")
RENDER_ALLOWS_POSITIONALS: Final = False
RENDER_FAILS_WITH_USAGE: Final = True


@dataclass(frozen=True)
class Export:
    name: str
    line: int
    summary: str


MEASURED_READ: Final = (
    Export("PREFERRED_PRESENTATION_FONTS", 9, "four families in fixed preference order"),
    Export("resolvePresentationFont", 47, "explicit font, else preferred match, else alphabetical"),
    Export("applyPresentationChartFont", 66, "chart text does not inherit slide shape fonts"),
    Export("makeNativeBulletParagraphs", 87, "EMU indenting, 1/100 pt spacing"),
    Export("resolvePresentationSlideCount", 115, "content count plus one cover, opt-in"),
    Export("normalizePresentationFontPolicy", 207, "four bases, SHA-bound references only"),
    Export("finalizePresentation", 804, "validate then publish atomically, no overwrite"),
)


def coverage() -> dict[str, int]:
    return {
        "exports": len(UTILS_EXPORTS),
        "value_flags": VALUE_FLAG_COUNT,
        "boolean_flags": BOOLEAN_FLAG_COUNT,
        "lines_read": 1_077,
    }


def validate_contract() -> None:
    if len(UTILS_EXPORTS) != 7:
        raise ValueError("seven exports were found")
    if len(VALUE_FLAGS) != VALUE_FLAG_COUNT:
        raise ValueError(f"nineteen value flags expected, found {len(VALUE_FLAGS)}")
    if len(BOOLEAN_FLAGS) != BOOLEAN_FLAG_COUNT:
        raise ValueError(f"eight boolean flags expected, found {len(BOOLEAN_FLAGS)}")
    if len(PREFERRED_PRESENTATION_FONTS) != 4:
        raise ValueError("four preferred families")
    if len(FONT_BASIS_VALUES) != 4:
        raise ValueError("four font bases")
    if len(SCRIPT_FONT_KEYS) != 3:
        raise ValueError("three script slots")
    if FONT_FAMILY_COUNT_RANGE != (1, 16):
        raise ValueError("one to sixteen families")
    if not REFERENCE_FONT_MUST_APPEAR:
        raise ValueError("a reference font must actually appear in the reference file")
    if not REFERENCE_ONLY_FROM_REFERENCE_BASIS:
        raise ValueError("only reference basis may name a source file")
    if not FONT_DEFAULT_FORBIDS_EXPLICIT_FAMILIES:
        raise ValueError("default basis must use the ordered resolver")
    if FINALIZE_OVERWRITE_ALLOWED:
        raise ValueError("the finaliser refuses to overwrite")
    if not FINALIZE_SELF_APPROVAL_REJECTED:
        raise ValueError("a generated deck may not approve itself")
    if not FINALIZE_UNION_OF_CHART_OWNERS:
        raise ValueError("declared chart owners are unioned with discovered ones")
    if not FINALIZE_PUBLISHES_BY_HARD_LINK:
        raise ValueError("publication is a hard link, not a copy")
    if not FINALIZE_ROLLBACK_PRESERVES_USER_FILE:
        raise ValueError("rollback must not delete a file that replaced ours")
    if len(REJECTED_MOTION_OPTIONS) != 4:
        raise ValueError("four motion options are rejected")
    if len(HASHED_SNAPSHOTS) != 4:
        raise ValueError("four snapshots are hashed and re-checked")
    if len(REQUIRED_PACKAGE_VALIDATORS) != 6:
        raise ValueError("six packaged validators")
    if RENDER_NEEDS_LIBREOFFICE:
        raise ValueError("presentations render through @oai/artifact-tool, not soffice")
    if not RENDER_OUTPUT_IS_ONE_BASED:
        raise ValueError("slide images are numbered from one")
    if SLIDE_COUNT_ADDED_FOR_COVER != 1:
        raise ValueError("content-plus-cover adds exactly one slide")
    if BULLET_EMU_PER_POINT != 12_700 or BULLET_SPACING_PER_POINT != 100:
        raise ValueError("EMU and 1/100 pt conversion drifted")
    if len(MEASURED_READ) != len(UTILS_EXPORTS):
        raise ValueError("every export has a recorded line and summary")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
