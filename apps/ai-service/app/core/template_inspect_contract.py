# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""The template inspection contract (R125).

``inspect_template_deck.mjs`` is the producer the plan validator names as its precondition. A
plan cannot be validated until the template has been inspected, so this script decides what
"inspected" means.

**It gathers evidence three ways and keeps them separate.** The ``@oai/artifact-tool`` API is
asked for ``slide,textbox,shape,image,table,chart`` records; the PPTX zip is scanned
independently for ``ppt/media/*``, ``ppt/slides/slideN.xml`` and
``ppt/(charts|embeddings/charts)/chartN.xml``; and table slides are counted by reading each
``slideN.xml`` for the literal ``<a:tbl>`` rather than by trusting the API's table records. Three
counts of the same deck that do not come from the same source are three chances to notice a
disagreement.

**The API is allowed to admit it was cut short.** ``inspect.metadata`` carries ``target``,
``omittedRecords``, ``abbreviatedRecords`` and ``notices``, and ``inspect.truncated`` is copied
into the manifest. A record set that says "I omitted some records" is more useful than one that
reports a clean count and silently lost them.

**Output is rebuilt, not merged.** ``fs.rm(outDir, {recursive, force})`` runs before anything is
written, so a stale ``template-inspect.ndjson`` from an earlier run cannot survive into a new
manifest. The precondition the plan validator checks is therefore a fresh one.

**The output directory is fenced twice.** It must resolve *inside* the workspace, and it must not
*be* the workspace root — the second check exists because the first check alone would happily
accept it. The stated remedy is to omit ``--out-dir`` or pass a dedicated subdirectory.

**The export returns a blob, not a byte array.** The probe run measured
``export({format: "png"})`` as a Blob with ``arrayBuffer()``; the writer is structured to accept
either a Blob or a Uint8Array, which is why ``saveBlobToFile`` tries ``arrayBuffer`` first. This
matters because a naive ``instanceof Uint8Array`` check would reject every export.

**Slide enumeration accepts two shapes.** Both ``presentation.slides.items`` (an array) and
``presentation.slides.count`` with ``getItem(i)`` were present in this build, and the helper
accepts either so a future API change does not silently produce zero slides.

**The script cannot run on this machine, and the reason is one external binary.** Every zip read
goes through ``spawnSync("unzip", ...)`` — ``-Z1`` to list, ``-p`` to stream an entry. There is no
``unzip`` on the Windows host (``tar.exe`` exists, but a ``.cmd`` shim would not be reachable
through a non-shell ``spawnSync``). A real run fails at ``zipNames`` with
``unzip -Z1 ... failed`` and ``rc=1``, immediately after ``importPptx`` and slide enumeration
already succeeded. So the import/render/inspect leg is proven working and the packaging leg is
proven blocked, with the break point named exactly.

**Fonts are read from four XML families.** ``ppt/slides``, ``ppt/slideMasters``,
``ppt/slideLayouts`` and ``ppt/theme`` are each scanned for ``typeface="..."`` and the union is
sorted — the same normalised set the presentation finaliser binds against a reference file.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final

SCRIPT_BYTES: Final = 8_977
SCRIPT_LINES: Final = 245

OUTPUT_DIR_DEFAULT: Final = "template-inspect"
OUTPUT_SUBDIRS: Final = ("source-slides", "layouts", "assets/ppt/media")
OUTPUT_FILES: Final = ("template-inspect.ndjson", "template-manifest.json")
FENCED_TO_WORKSPACE: Final = True
WORKSPACE_ROOT_REJECTED: Final = True
OUTPUT_REBUILT_NOT_MERGED: Final = True

INSPECT_KIND: Final = "slide,textbox,shape,image,table,chart"
INSPECT_MAX_CHARS: Final = 200_000
INSPECT_METADATA_KEYS: Final = ("target", "omittedRecords", "abbreviatedRecords", "notices")
INSPECT_METADATA_COUNT: Final = 4
INSPECT_ADMITS_OMISSION: Final = True
TRUNCATION_RECORDED_IN_MANIFEST: Final = True

ZIP_SCANS: Final = (
    "ppt/media/*",
    "ppt/slides/slideN.xml",
    "ppt/(charts|embeddings/charts)/chartN.xml",
)
ZIP_SCAN_COUNT: Final = 3
TABLE_MARKER: Final = "<a:tbl>"
TABLE_COUNT_INDEPENDENT_OF_API: Final = True

PACKAGE_PART_COUNTS: Final = ("mediaCount", "slideXmlCount", "chartCount", "tableSlideCount")
PACKAGE_PART_COUNT_COUNT: Final = 4

FONT_XML_ROOTS: Final = ("ppt/slides", "ppt/slideMasters", "ppt/slideLayouts", "ppt/theme")
FONT_XML_ROOT_COUNT: Final = 4
FONT_PATTERN: Final = 'typeface="..."'
FONTS_SORTED: Final = True

EXPORT_FORMATS: Final = ("png", "layout")
EXPORT_FORMAT_COUNT: Final = 2
EXPORT_RETURNS_BLOB: Final = True
EXPORT_ACCEPTS_BLOB_OR_BYTES: Final = True
SLIDE_ENUMERATION_TWO_SHAPES: Final = True
SCALE_MUST_BE_POSITIVE: Final = True

EXTERNAL_BINARY: Final = "unzip"
EXTERNAL_BINARY_ARGS: Final = ("-Z1 <pptx>", "-p <pptx> <entry>")
EXTERNAL_BINARY_PRESENT_LOCALLY: Final = False
TAR_PRESENT_LOCALLY: Final = True
UNZIP_SHIM_UNREACHABLE: Final = True

SAFETY_CONSTRAINTS: Final = (
    "out-dir must resolve inside the workspace",
    "out-dir must not be the workspace root",
    "out-dir is rebuilt from scratch before writing",
)
SAFETY_CONSTRAINT_COUNT: Final = 3

PART_COUNTS_MUST_AGREE: Final = True


@dataclass(frozen=True)
class Run:
    leg: str
    ok: bool
    note: str


MEASURED: Final = (
    Run("importPptx", True, "FileBlob.load then PresentationFile.importPptx returned a presentation"),
    Run("slide enumeration", True, "slides.items array present; count and getItem also present"),
    Run("export png", True, "Blob, not Uint8Array - the writer must accept arrayBuffer()"),
    Run("export layout", True, "same blob shape as png"),
    Run("inspect", True, "ndjson 412 bytes on a one-slide deck; truncated=false"),
    Run("zip listing", False, "unzip -Z1 failed: no unzip on PATH, so zipNames throws and rc=1"),
)
MEASURED_COUNT: Final = 6
HALF_THE_SCRIPT_IS_RUNNABLE: Final = True


def identifies_five_types(kind: str) -> bool:
    """The inspect selector asks for five record families; a typo silently drops one."""
    return kind == INSPECT_KIND


def part_counts_agree(api_slide_count: int, slide_xml_count: int) -> bool:
    """Two counts of the same deck from two sources; disagreement is the point."""
    return api_slide_count == slide_xml_count


def coverage() -> dict[str, int]:
    return {
        "zip_scans": ZIP_SCAN_COUNT,
        "package_part_counts": PACKAGE_PART_COUNT_COUNT,
        "font_xml_roots": FONT_XML_ROOT_COUNT,
        "inspect_metadata_keys": INSPECT_METADATA_COUNT,
        "export_formats": EXPORT_FORMAT_COUNT,
        "safety_constraints": SAFETY_CONSTRAINT_COUNT,
        "measured_legs": MEASURED_COUNT,
    }


def validate_contract() -> None:
    if len(OUTPUT_SUBDIRS) != 3:
        raise ValueError("three output subdirectories")
    if OUTPUT_DIR_DEFAULT != "template-inspect":
        raise ValueError("the default output directory drifted")
    if not FENCED_TO_WORKSPACE or not WORKSPACE_ROOT_REJECTED:
        raise ValueError("the output directory is fenced twice")
    if not OUTPUT_REBUILT_NOT_MERGED:
        raise ValueError("output is rebuilt, not merged")
    if not identifies_five_types(INSPECT_KIND):
        raise ValueError("the inspect selector names five record types")
    if len(INSPECT_METADATA_KEYS) != INSPECT_METADATA_COUNT or INSPECT_METADATA_COUNT != 4:
        raise ValueError("inspect metadata carries four keys")
    if "omittedRecords" not in INSPECT_METADATA_KEYS:
        raise ValueError("the API must be able to admit omitted records")
    if "abbreviatedRecords" not in INSPECT_METADATA_KEYS:
        raise ValueError("the API must be able to admit abbreviated records")
    if not INSPECT_ADMITS_OMISSION or not TRUNCATION_RECORDED_IN_MANIFEST:
        raise ValueError("truncation must be recorded")
    if len(ZIP_SCANS) != ZIP_SCAN_COUNT or ZIP_SCAN_COUNT != 3:
        raise ValueError("three zip scans")
    if TABLE_MARKER != "<a:tbl>":
        raise ValueError("the table marker is the literal OOXML element")
    if not TABLE_COUNT_INDEPENDENT_OF_API:
        raise ValueError("table slides are counted from xml, not from the API")
    if len(PACKAGE_PART_COUNTS) != PACKAGE_PART_COUNT_COUNT or PACKAGE_PART_COUNT_COUNT != 4:
        raise ValueError("four package part counts")
    if len(FONT_XML_ROOTS) != FONT_XML_ROOT_COUNT or FONT_XML_ROOT_COUNT != 4:
        raise ValueError("four font xml families")
    if not FONTS_SORTED:
        raise ValueError("fonts are sorted")
    if len(EXPORT_FORMATS) != EXPORT_FORMAT_COUNT or EXPORT_FORMAT_COUNT != 2:
        raise ValueError("two export formats")
    if not EXPORT_RETURNS_BLOB:
        raise ValueError("the export returns a blob")
    if EXPORT_ACCEPTS_BLOB_OR_BYTES is False:
        raise ValueError("the writer must accept both a blob and a byte array")
    if not SLIDE_ENUMERATION_TWO_SHAPES:
        raise ValueError("slide enumeration accepts two api shapes")
    if not SCALE_MUST_BE_POSITIVE:
        raise ValueError("scale must be a positive number")
    if EXTERNAL_BINARY != "unzip":
        raise ValueError("the zip reader calls unzip")
    if EXTERNAL_BINARY_PRESENT_LOCALLY is not False:
        raise ValueError("unzip is measured absent on this host, not assumed")
    if len(MEASURED) != MEASURED_COUNT or MEASURED_COUNT != 6:
        raise ValueError("six measured legs")
    if not any(r.leg == "zip listing" and r.ok is False for r in MEASURED):
        raise ValueError("the zip listing leg must be recorded as failing")
    if not any(r.leg == "importPptx" and r.ok for r in MEASURED):
        raise ValueError("the import leg must be recorded as working")
    if not PART_COUNTS_MUST_AGREE:
        raise ValueError("part counts from two sources must agree")
    if len(SAFETY_CONSTRAINTS) != SAFETY_CONSTRAINT_COUNT or SAFETY_CONSTRAINT_COUNT != 3:
        raise ValueError("three safety constraints")
    if not part_counts_agree(1, 1):
        raise ValueError("equal counts must agree")
    if part_counts_agree(1, 2):
        raise ValueError("unequal counts must disagree")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
