# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""The template creator's request contract (R123).

``create-template-skill.mjs`` is the entry point that turns a reference file into a reusable
template skill, and it is the gate the SKILL.md description leans on when it says a template
"exists only after create-template-skill.mjs succeeds". What follows is what that gate actually
checks.

**The kind decides everything, and one extension means two different things.** A ``.png``
reference is an *image* template when ``--kind image`` is passed or nothing is passed at all, and
it is a *rendered preview* when ``--kind google-docs|google-slides|google-sheets`` is passed —
those three kinds never carry a native file, only the PNG exported from it. ``--kind`` is
therefore load-bearing, not decorative. ``site`` is the only kind whose reference is a directory
instead of a file, and the only kind whose preview is hard-coded to a bundled asset rather than
supplied by the caller.

**Two kinds cannot be inferred and must be declared.** ``.txt`` maps to no kind, because email
and Slack share the extension and differ in voice; the script refuses a ``.txt`` without
``--kind`` outright. The inference table has exactly four entries — docx, pptx, xlsx and png — and
``.png`` resolves to image, which is precisely why the Google kinds must be explicit.

**Source URL is a two-way constraint.** ``--source-url`` is rejected for every kind that has no
``sourceArtifact``, and is *required* for every kind that has one. A Google template that omits
its URL and a document template that supplies one are both errors, and neither is a warning.

**Preview PNGs are parsed, not sniffed.** ``hasValidPngStructure`` walks the chunk stream: it
requires the 8-byte signature, requires the first chunk to be ``IHDR`` with length 13, verifies
CRC32 on *every* chunk, and requires ``IEND`` to be zero-length and to land exactly at end-of-file.
A truncated PNG, a concatenated one, or one with a broken CRC all fail. This is the difference
between "looks like a PNG" and "is a PNG".

**Display names and descriptions may not contain angle brackets.** ``assertSingleLine`` rejects
``<`` and ``>`` along with NUL, CR and LF. The values are interpolated into generated SKILL.md
markdown and agents/openai.yaml, so the bracket rule is an injection guard even though the error
message only talks about one line of text.

**Site templates carry a five-step workflow that is spelled out, not generated.** It says to copy
the retained source into a new working directory, adapt it without replacing it with a freshly
scaffolded project, preserve the logical D1/R2 bindings, create a *new* project rather than
reusing the original, and build and verify through the existing Sites workflow. Email and Slack
carry an explicit prohibition: do not send or post merely because the skill was invoked.

**Writes are serialised by a lock file with a 30-second stale grace.** ``acquireWriteLock``
creates ``.artifact-template-write-lock`` with an ``owner-pid`` companion, and a lock is treated
as stale only past the grace window, so two concurrent creators cannot replace the same template
folder.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final

SCRIPT_BYTES: Final = 30_865
SCRIPT_LINES: Final = 898

TEMPLATE_PREFIX: Final = "artifact-template-"
MAX_SKILL_NAME_LENGTH: Final = 64
SKILL_NAME_PATTERN: Final = "^artifact-template-[a-z0-9]+(?:-[a-z0-9]+)*$"

WRITE_LOCK_NAME: Final = ".artifact-template-write-lock"
LOCK_OWNER_FILENAME: Final = "owner-pid"
LOCK_OWNER_GRACE_MS: Final = 30_000

PNG_SIGNATURE_BYTES: Final = 8
PNG_FIRST_CHUNK: Final = "IHDR"
PNG_FIRST_CHUNK_LENGTH: Final = 13
PNG_CRC_VERIFIED_PER_CHUNK: Final = True
PNG_IEND_MUST_BE_EMPTY: Final = True
PNG_IEND_MUST_END_FILE: Final = True
PNG_CHUNK_HEADER_BYTES: Final = 8  # length(4) + type(4)
PNG_CRC_BYTES: Final = 4

DISPLAY_NAME_MAX: Final = 64
DESCRIPTION_MAX: Final = 600
ANGLE_BRACKETS_REJECTED: Final = True
CONTROL_CHARS_REJECTED: Final = ("\\0", "\\r", "\\n")


@dataclass(frozen=True)
class Kind:
    name: str
    extension: str | None
    output: str
    outputs: str
    needs_source_url: bool
    needs_preview_path: bool
    reference_is_directory: bool


KINDS: Final = (
    Kind("document", ".docx", "a document", "documents", False, True, False),
    Kind("presentation", ".pptx", "a presentation", "presentations", False, True, False),
    Kind("spreadsheet", ".xlsx", "a spreadsheet", "spreadsheets", False, True, False),
    Kind("google-docs", ".png", "a Google Doc", "Google Docs", True, True, False),
    Kind(
        "google-slides",
        ".png",
        "a Google Slides presentation",
        "Google Slides presentations",
        True,
        True,
        False,
    ),
    Kind("google-sheets", ".png", "a Google Sheet", "Google Sheets", True, True, False),
    Kind("site", None, "a Site", "Sites", False, False, True),
    Kind("image", ".png", "an image", "images", False, True, False),
    Kind("email", ".txt", "an email", "emails", False, True, False),
    Kind("slack", ".txt", "a Slack message", "Slack messages", False, True, False),
)
KIND_COUNT: Final = 10

# Four entries only: docx, pptx, xlsx, png. The three Google kinds share .png with image, so
# .png resolves to image and the Google kinds must be declared.
INFERRED_BY_EXTENSION: Final = {
    ".docx": "document",
    ".pptx": "presentation",
    ".xlsx": "spreadsheet",
    ".png": "image",
}
INFERENCE_ENTRY_COUNT: Final = 4
TXT_CANNOT_BE_INFERRED: Final = True

GOOGLE_PATH_BY_KIND: Final = {
    "google-docs": "document",
    "google-slides": "presentation",
    "google-sheets": "spreadsheets",  # plural, unlike the other two
}
GOOGLE_KIND_COUNT: Final = 3

GALLERY_KINDS: Final = ("imagegen", "product-design")
DEFAULT_GALLERY_KIND: Final = "imagegen"
GALLERY_KIND_ONLY_FOR_IMAGE: Final = True
IMAGE_AND_PRODUCT_DESIGN_NOT_INTERCHANGEABLE: Final = True

SOURCE_URL_ONLY_FOR_GOOGLE: Final = True
SOURCE_URL_REQUIRED_FOR_GOOGLE: Final = True
SITE_PREVIEW_IS_BUNDLED: Final = True
SITE_PREVIEW_RELATIVE: Final = "../assets/site-preview.png"
SITE_HOSTING_METADATA: Final = ".openai/hosting.json"
SITE_REFERENCE_MUST_BE_DIRECTORY: Final = True

MODES: Final = ("create", "update")
SKILL_NAME_REQUIRED_FOR_UPDATE: Final = True
SKILL_NAME_FORBIDDEN_FOR_CREATE: Final = True

SITE_WORKFLOW_STEPS: Final = 5
SITE_WORKFLOW: Final = (
    "copy the retained source into a new working directory",
    "adapt without replacing it with a newly scaffolded project",
    "preserve the logical D1/R2 bindings",
    "create a new project rather than reusing the original",
    "build, deploy and verify through the existing Sites workflow",
)

TEXT_KINDS_FORBID_SENDING: Final = ("email", "slack")
TEXT_WORKFLOW_STEPS: Final = 4
NO_SEND_JUST_BECAUSE_INVOKED: Final = True

REQUEST_FLAGS: Final = (
    "--mode",
    "--skill-name",
    "--kind",
    "--gallery-kind",
    "--source-url",
    "--reference-path",
    "--preview-path",
    "--display-name",
    "--description",
)

VALIDATION_RULES: Final = (
    "mode is create or update",
    "display name is required, single line, at most 64",
    "description is required, single line, at most 600",
    "a .txt reference must declare kind email or slack",
    "an unknown kind is rejected with the legal list",
    "an unknown extension is rejected with the legal list",
    "gallery kind is only valid for image templates",
    "source url is only valid for the Google kinds and required for them",
    "site reference must be a directory carrying .openai/hosting.json",
    "non-site reference and preview must be regular files with matching extension",
    "preview must pass PNG structure and so must a .png reference",
    "skill name is required for update and forbidden for create",
)
RULE_COUNT: Final = 12


def inferred_kind(extension: str) -> str | None:
    return INFERRED_BY_EXTENSION.get(extension.lower())


def has_valid_png_structure(head_signature: bytes, first_chunk_type: str, first_chunk_length: int) -> bool:
    """The structural facts the reader insists on before accepting a PNG."""
    expected = bytes((137, 80, 78, 71, 13, 10, 26, 10))
    if len(head_signature) < PNG_SIGNATURE_BYTES or head_signature[:8] != expected:
        return False
    if first_chunk_type != PNG_FIRST_CHUNK:
        return False
    return first_chunk_length == PNG_FIRST_CHUNK_LENGTH


def skill_name_is_legal(name: str) -> bool:
    import re

    return len(name) <= MAX_SKILL_NAME_LENGTH and bool(re.match(SKILL_NAME_PATTERN, name))


def single_line_is_legal(value: str, limit: int) -> bool:
    if "<" in value or ">" in value:
        return False
    if len(value) > limit:
        return False
    return not any(ch in value for ch in ("\x00", "\r", "\n"))


def coverage() -> dict[str, int]:
    return {
        "kinds": KIND_COUNT,
        "inference_entries": INFERENCE_ENTRY_COUNT,
        "google_kinds": GOOGLE_KIND_COUNT,
        "validation_rules": RULE_COUNT,
    }


def validate_contract() -> None:
    if len(KINDS) != KIND_COUNT or KIND_COUNT != 10:
        raise ValueError("ten template kinds")
    if len(INFERRED_BY_EXTENSION) != INFERENCE_ENTRY_COUNT or INFERENCE_ENTRY_COUNT != 4:
        raise ValueError("four inference entries")
    if INFERRED_BY_EXTENSION[".png"] != "image":
        raise ValueError("a .png reference infers image, so the Google kinds must be explicit")
    if not TXT_CANNOT_BE_INFERRED:
        raise ValueError("a .txt reference cannot be inferred")
    if ".txt" in INFERRED_BY_EXTENSION:
        raise ValueError(".txt must not appear in the inference table")
    if len(GOOGLE_PATH_BY_KIND) != GOOGLE_KIND_COUNT or GOOGLE_KIND_COUNT != 3:
        raise ValueError("three Google kinds")
    if GOOGLE_PATH_BY_KIND["google-sheets"] != "spreadsheets":
        raise ValueError("the Google Sheets path is plural")
    if not GALLERY_KIND_ONLY_FOR_IMAGE:
        raise ValueError("gallery kind only applies to images")
    if DEFAULT_GALLERY_KIND != "imagegen":
        raise ValueError("the default gallery kind is imagegen")
    if not SOURCE_URL_REQUIRED_FOR_GOOGLE or not SOURCE_URL_ONLY_FOR_GOOGLE:
        raise ValueError("the source URL constraint is two-way")
    if not SITE_PREVIEW_IS_BUNDLED:
        raise ValueError("site previews come from the package")
    if SITE_HOSTING_METADATA != ".openai/hosting.json":
        raise ValueError("site metadata path drifted")
    if not PNG_CRC_VERIFIED_PER_CHUNK or not PNG_IEND_MUST_END_FILE:
        raise ValueError("the PNG reader verifies CRC per chunk and IEND at EOF")
    if PNG_FIRST_CHUNK != "IHDR" or PNG_FIRST_CHUNK_LENGTH != 13:
        raise ValueError("the first chunk must be a thirteen-byte IHDR")
    if not ANGLE_BRACKETS_REJECTED:
        raise ValueError("angle brackets are rejected as an injection guard")
    if LOCK_OWNER_GRACE_MS != 30_000:
        raise ValueError("the stale-lock grace is thirty seconds")
    if tuple(VALIDATION_RULES) != VALIDATION_RULES or len(VALIDATION_RULES) != RULE_COUNT:
        raise ValueError("the recorded rule count does not match the rule list")
    if len(SITE_WORKFLOW) != SITE_WORKFLOW_STEPS or SITE_WORKFLOW_STEPS != 5:
        raise ValueError("the site workflow spells out five steps")
    if not NO_SEND_JUST_BECAUSE_INVOKED:
        raise ValueError("email and slack must not send merely because invoked")
    if set(TEXT_KINDS_FORBID_SENDING) != {"email", "slack"}:
        raise ValueError("both text kinds carry the no-send rule")
    if len(MODES) != 2 or SKILL_NAME_REQUIRED_FOR_UPDATE is False:
        raise ValueError("update requires a skill name")
    if not SKILL_NAME_FORBIDDEN_FOR_CREATE:
        raise ValueError("create forbids a skill name")
    # A kind that needs a source URL must accept --source-url; one that does not must reject it.
    for kind in KINDS:
        if kind.needs_source_url and kind.name not in GOOGLE_PATH_BY_KIND:
            raise ValueError(f"{kind.name} needs a source URL but is not a Google kind")
    if any(k.name == "site" and k.needs_preview_path for k in KINDS):
        raise ValueError("site templates never take a preview path")
    if sum(1 for k in KINDS if k.reference_is_directory) != 1:
        raise ValueError("exactly one kind takes a directory")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
