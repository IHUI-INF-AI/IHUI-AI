# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""The Google Workspace export bridge contract (R128).

``export-google-workspace-file.mjs`` (10,017 B / 353 lines) is the bridge between a connected
Google Drive ``fetch`` tool and a file on disk. It exists because the base64 body of an export is
both too large for an argv and too sensitive for a log line, so the design is built around two
refusals: **the bytes never enter a command line**, and **the URL never enters an error message**.

**Two formats, and the magic number decides.** ``EXPORT_FORMATS`` is keyed by *MIME type*, not by
extension, and each entry carries both the extension the output path must end in and the base64
prefix of the real file header (``JVBERi0`` is ``%PDF-``, ``UEsDB`` is a ZIP local-file header, which
is what an XLSX is). A payload that claims the right MIME type but does not start with the right
prefix is rejected, so a JSON error page or an HTML login redirect can never be saved as a
``.pdf``.

**Byte length is computed, not decoded.** ``decodedBase64Bytes`` returns null for an empty or
non-multiple-of-four string, subtracts 1 for a single ``=`` and 2 for ``==``, and otherwise
multiplies by three quarters. Nothing is ever decoded in this process, so a hostile 64 MB string
cannot be turned into a 64 MB buffer just to find out how big it would have been.

**The connector tool name must resolve to exactly one function.** ``mcp__codex_apps__google_drive_fetch``
is preferred when present; otherwise every callable tool key is lowercased, stripped of every
non-alphanumeric character, and matched against the suffix ``googledrivefetch``. Zero matches is an
error and *more than one* is also an error — an ambiguous resolver is treated as no resolver, which
is the deliberate fail-closed shape rather than "pick the first one".

**The URL is validated by shape and by absence of control characters.** The pattern anchors to
``docs.google.com`` and one of the three document families, allows an ``u/<n>/`` account prefix,
and requires the ``d/<id>`` segment. In addition the whole string is rejected if it contains any
character in ``\\u0000-\\u0020`` or ``\\u007f`` — a URL carrying a newline is an argument-injection
attempt, not a document. The two defences overlap: the shape regex ends in ``(?:[/?#]|$)``, which
already refuses a mid-string newline, so the control-character ban is defence in depth rather than
the only line — and a test that weakens only the ban is therefore not observable.

**Every error message is scrubbed before it leaves the process.** ``GoogleWorkspaceExportError``
rewrites every ``http(s)`` URL in its message to ``[URL_REDACTED]`` in the constructor, so no
exception path can leak a shared link, a ``resourcekey``, or a signed export URL into a log.

**The payload search is a bounded breadth-first walk.** ``findFilePayload`` walks the tool result
with a queue, a ``seen`` set against cycles, and a hard ceiling of ten thousand visited objects.
It accepts either a ``b64_string`` key or a ``content`` key that is either declared
``base64Encoded: true`` or carries the expected MIME type. When nothing matches it raises rather
than returning a partial result.

**The write is framed through stdin, and the receipt is three-way reconciled.** A receiver process
is started with ``tty: true`` and a five-argument command line that carries the paths and the
expected byte count — deliberately **not** the content. The parent waits up to five polls for
``TEMPLATE_EXPORT_READY``, then sends frames of at most 480,000 characters as
``D<TAB><seq><TAB><data><0x03>``, then a commit frame ``C<0x03>``, then waits for
``TEMPLATE_EXPORT_COMMITTED <bytes> <sha256>``. Three things must agree before the file is
trusted: the reported byte count equals the one computed from base64, the receiver exited with
code 0, and the digest is sixty-four hex characters. Any failure sends ``A<0x03>`` to abort the
receiver, and the abort's own failure is swallowed because the receiver may already be gone.

**Shell quoting is chosen by the node path, not by the host.** A Windows absolute node path
(``^[A-Za-z]:[\\\\/]`` or a UNC prefix) means ``powershell.exe`` with ``'...'`` quoting that doubles
inner single quotes; anything else means ``/bin/sh`` with POSIX quoting via ``'"'"'``. The choice
follows the path so a Windows-hosted runtime invoked from a POSIX shell still gets the quoting its
own shell will parse.

**Honest boundary.** The MIME cross-check only bites when the found payload declares a MIME type;
when it declares none, the expected value is assumed. And the base64 prefix check proves the header
is right, not that the whole file is a well-formed PDF or XLSX.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Final

SCRIPT_BYTES: Final = 10_017
SCRIPT_LINES: Final = 353

READY_MARKER: Final = "TEMPLATE_EXPORT_READY"
COMMITTED_MARKER: Final = "TEMPLATE_EXPORT_COMMITTED"
RECORD_SEPARATOR: Final = "\u0003"

MAX_EXPORT_BYTES: Final = 64 * 1024 * 1024
FRAME_CHARS: Final = 480_000


@dataclass(frozen=True)
class ExportFormat:
    """One MIME type the bridge is allowed to write."""

    mime_type: str
    base64_prefix: str
    extension: str


EXPORT_FORMATS: Final = (
    ExportFormat("application/pdf", "JVBERi0", ".pdf"),
    ExportFormat(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "UEsDB",
        ".xlsx",
    ),
)
EXPORT_MIME_TYPES: Final = tuple(f.mime_type for f in EXPORT_FORMATS)
PDF_PREFIX_MEANS: Final = "%PDF- header, base64 encoded"
XLSX_PREFIX_MEANS: Final = "PK zip local-file header, base64 encoded"

GOOGLE_WORKSPACE_URL_PATTERN: Final = re.compile(
    r"^https://docs\.google\.com/"
    r"(?:document|presentation|spreadsheets)/"
    r"(?:u/\d+/)?"
    r"d/[A-Za-z0-9_-]+"
    r"(?:[/?#]|$)"
)
CONTROL_CHARS_BANNED: Final = re.compile(r"[\u0000-\u0020\u007f]")
URL_REDACTION_PATTERN: Final = re.compile(r"https?://[^\s\"'<>]+", re.IGNORECASE)
URL_REDACTED: Final = "[URL_REDACTED]"

PREFERRED_CONNECTOR_TOOL: Final = "mcp__codex_apps__google_drive_fetch"
CONNECTOR_SUFFIX: Final = "googledrivefetch"
CONNECTOR_NORMALIZE_PATTERN: Final = re.compile(r"[^a-z0-9]")
CONNECTOR_MUST_RESOLVE_TO_EXACTLY_ONE: Final = True

BFS_VISIT_LIMIT: Final = 10_000
PAYLOAD_BASE64_KEY: Final = "b64_string"
PAYLOAD_CONTENT_KEY: Final = "content"
PAYLOAD_ENCODED_FLAG: Final = "base64Encoded"
MIME_TYPE_KEYS: Final = ("mimeType", "mime_type")

BASE64_ALPHABET_PATTERN: Final = re.compile(r"^[A-Za-z0-9+/]*={0,2}$")
BASE64_PADDING_TWO: Final = "=="
BASE64_PADDING_ONE: Final = "="
BYTES_NEVER_DECODED: Final = True

MARKER_POLL_LIMIT: Final = 5
MARKER_POLL_YIELD_MS: Final = 1_000
FRAME_YIELD_MS: Final = 250
COMMIT_YIELD_MS: Final = 30_000

DATA_FRAME_TEMPLATE: Final = "D\t{sequence}\t{payload}"
COMMIT_FRAME: Final = "C"
ABORT_FRAME: Final = "A"
FRAME_SEQUENCE_COUNTER_STARTS_AT_ZERO: Final = True
BASE64_IS_SENT_OVER_STDIN: Final = True
BASE64_NEVER_IN_ARGV: Final = True
RECEIVER_STARTS_WITH_TTY: Final = True

RECEIPT_PATTERN: Final = re.compile(
    r"TEMPLATE_EXPORT_COMMITTED\s+(\d+)\s+([a-f0-9]{64})",
    re.IGNORECASE,
)
RECEIPT_DIGEST_HEX_LENGTH: Final = 64
RECEIPT_IS_THREE_WAY_RECONCILED: Final = True

WINDOWS_ABSOLUTE_PATH_PATTERN: Final = re.compile(r"^(?:[A-Za-z]:[\\/]|\\\\)")
SHELL_POWERSHELL: Final = "powershell.exe"
SHELL_POSIX: Final = "/bin/sh"
SHELL_CHOSEN_BY_NODE_PATH_NOT_HOST: Final = True
POWERSHELL_INNER_QUOTE: Final = "''"
POSIX_QUOTE_ESCAPE: Final = "'\"'\"'"

RECEIVER_ARG_COUNT: Final = 5
RECEIVER_ARG_ORDER: Final = (
    "nodePath",
    "receiverPath",
    "outputPath",
    "workspaceRoot",
    "bytes",
)
REQUIRED_TOOLS: Final = ("exec_command", "write_stdin")
STATUSES: Final = ("complete",)
STATUS_ON_SUCCESS: Final = "complete"
RESULT_FIELDS: Final = ("status", "connectorTool", "mimeType", "file")
FILE_FIELDS: Final = ("path", "bytes", "sha256")


def redact_urls(message: str) -> str:
    """Rewrite every http(s) URL in a message to the placeholder.

    Mirrors the error constructor: the scrub happens before anyone can log the text, so a shared
    link or a signed export URL cannot escape through a stack trace.
    """
    return URL_REDACTION_PATTERN.sub(URL_REDACTED, str(message))


def decoded_byte_length(base64: str) -> int | None:
    """Compute the decoded size without decoding anything.

    Returns ``None`` for an empty string or one whose length is not a multiple of four, because
    neither can be a whole base64 payload. Padding is one byte for ``=`` and two for ``==``.
    """
    if len(base64) == 0 or len(base64) % 4 != 0:
        return None
    if base64.endswith(BASE64_PADDING_TWO):
        padding = 2
    elif base64.endswith(BASE64_PADDING_ONE):
        padding = 1
    else:
        padding = 0
    return (len(base64) // 4) * 3 - padding


def source_url_is_accepted(source_url: Any) -> bool:
    """Whether the string is a Google Docs, Slides, or Sheets URL with no control characters."""
    if not isinstance(source_url, str):
        return False
    if CONTROL_CHARS_BANNED.search(source_url):
        return False
    return bool(GOOGLE_WORKSPACE_URL_PATTERN.match(source_url))


def normalise_tool_key(name: str) -> str:
    """Lowercase a tool name and strip everything that is not a letter or a digit."""
    return CONNECTOR_NORMALIZE_PATTERN.sub("", str(name).lower())


def connector_matches(name: str) -> bool:
    """Whether a normalised tool name ends with the connector suffix."""
    return normalise_tool_key(name).endswith(CONNECTOR_SUFFIX)


def resolve_connector_tool(tool_names: list[str] | tuple[str, ...]) -> str | None:
    """Resolve the Google Drive fetch tool name, or ``None`` when the answer is not unique.

    The preferred name wins when it is a callable; otherwise exactly one callable key may match
    the suffix. Zero and many both resolve to ``None`` — an ambiguous resolver is treated as no
    resolver.
    """
    names = [str(n) for n in tool_names]
    if PREFERRED_CONNECTOR_TOOL in names:
        return PREFERRED_CONNECTOR_TOOL
    matches = [n for n in names if connector_matches(n)]
    if len(matches) != 1:
        return None
    return matches[0]


def payload_prefix_is_valid(base64: str, mime_type: str) -> bool:
    """Whether the base64 starts with the magic-number prefix that format requires."""
    fmt = next((f for f in EXPORT_FORMATS if f.mime_type == mime_type), None)
    if fmt is None:
        return False
    return base64.startswith(fmt.base64_prefix)


def output_path_matches_mime(output_path: str, mime_type: str) -> bool:
    """Whether the output path ends with the extension that MIME type implies."""
    fmt = next((f for f in EXPORT_FORMATS if f.mime_type == mime_type), None)
    if fmt is None:
        return False
    return output_path.endswith(fmt.extension)


def export_format_mime(mime_type: str) -> str | None:
    """Return the extension a MIME type must be written as, or ``None`` when unsupported."""
    fmt = next((f for f in EXPORT_FORMATS if f.mime_type == mime_type), None)
    return None if fmt is None else fmt.extension


def frame_payload(base64: str, sequence: int) -> str:
    """Build one data frame: the tag, the sequence, the slice, then the record separator."""
    return DATA_FRAME_TEMPLATE.format(sequence=sequence, payload=base64) + RECORD_SEPARATOR


def commit_frame() -> str:
    """Build the commit frame that tells the receiver to finish the file."""
    return COMMIT_FRAME + RECORD_SEPARATOR


def abort_frame() -> str:
    """Build the abort frame sent when the write leg failed."""
    return ABORT_FRAME + RECORD_SEPARATOR


def receipt_is_trusted(receipt: str, expected_bytes: int, exit_code: int | None) -> bool:
    """Three-way reconcile: byte count, clean exit, and a sixty-four hex digest."""
    match = RECEIPT_PATTERN.search(receipt)
    if match is None:
        return False
    reported = int(match.group(1))
    digest = match.group(2)
    if reported != expected_bytes:
        return False
    if exit_code != 0:
        return False
    return len(digest) == RECEIPT_DIGEST_HEX_LENGTH


def shell_for(node_path: str) -> str:
    """Pick the shell from the node path's shape, not from the host platform."""
    return (
        SHELL_POWERSHELL
        if WINDOWS_ABSOLUTE_PATH_PATTERN.match(node_path)
        else SHELL_POSIX
    )


def coverage() -> dict[str, Any]:
    """Report what this module pins, so the ledger can cite it without recomputing anything."""
    return {
        "script_bytes": SCRIPT_BYTES,
        "script_lines": SCRIPT_LINES,
        "export_formats": len(EXPORT_FORMATS),
        "export_mime_types": len(EXPORT_MIME_TYPES),
        "frame_chars": FRAME_CHARS,
        "max_export_bytes": MAX_EXPORT_BYTES,
        "receiver_arg_count": RECEIVER_ARG_COUNT,
        "base64_never_in_argv": BASE64_NEVER_IN_ARGV,
        "bytes_never_decoded": BYTES_NEVER_DECODED,
        "receipt_three_way": RECEIPT_IS_THREE_WAY_RECONCILED,
        "shell_chosen_by_node_path": SHELL_CHOSEN_BY_NODE_PATH_NOT_HOST,
        "connector_must_be_unique": CONNECTOR_MUST_RESOLVE_TO_EXACTLY_ONE,
        "control_chars_banned_in_url": True,
        "urls_redacted_in_errors": True,
        "bfs_visit_limit": BFS_VISIT_LIMIT,
    }


def validate_contract() -> list[str]:
    """Assert this module still agrees with the script it mirrors. Returns a list of problems."""
    problems: list[str] = []

    if SCRIPT_BYTES != 10_017:
        problems.append(f"script bytes drifted to {SCRIPT_BYTES}")
    if SCRIPT_LINES != 353:
        problems.append(f"script lines drifted to {SCRIPT_LINES}")

    if len(EXPORT_FORMATS) != 2:
        problems.append(f"expected two export formats, found {len(EXPORT_FORMATS)}")
    if set(EXPORT_MIME_TYPES) != {
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }:
        problems.append("export MIME types drifted from the PDF and XLSX pair")

    pdf = next(f for f in EXPORT_FORMATS if f.mime_type == "application/pdf")
    if pdf.base64_prefix != "JVBERi0":
        problems.append(f"PDF prefix drifted to {pdf.base64_prefix}")
    if pdf.extension != ".pdf":
        problems.append(f"PDF extension drifted to {pdf.extension}")
    xlsx = next(f for f in EXPORT_FORMATS if f.extension == ".xlsx")
    if xlsx.base64_prefix != "UEsDB":
        problems.append(f"XLSX prefix drifted to {xlsx.base64_prefix}")

    if RECORD_SEPARATOR != "\u0003":
        problems.append("record separator is not the 0x03 control character")
    if FRAME_CHARS != 480_000:
        problems.append(f"frame size drifted to {FRAME_CHARS}")
    if MAX_EXPORT_BYTES != 64 * 1024 * 1024:
        problems.append(f"byte ceiling drifted to {MAX_EXPORT_BYTES}")

    if decoded_byte_length("") is not None:
        problems.append("empty base64 must not yield a byte length")
    if decoded_byte_length("AAA") is not None:
        problems.append("non-multiple-of-four base64 must not yield a byte length")
    if decoded_byte_length("AAAA") != 3:
        problems.append("four base64 characters must decode to three bytes")
    if decoded_byte_length("AA==") != 1:
        problems.append("double padding must subtract two")
    if decoded_byte_length("AAA=") != 2:
        problems.append("single padding must subtract one")

    if not payload_prefix_is_valid("JVBERi0xk", "application/pdf"):
        problems.append("a %PDF- prefix must be accepted for PDF")
    if payload_prefix_is_valid("UEsDBxk", "application/pdf"):
        problems.append("a zip prefix must not be accepted for PDF")
    if not payload_prefix_is_valid("UEsDBxk", EXPORT_MIME_TYPES[1]):
        problems.append("a zip prefix must be accepted for XLSX")

    if not source_url_is_accepted(
        "https://docs.google.com/document/d/abcDEF_-123/edit"
    ):
        problems.append("a canonical Google Docs URL must be accepted")
    if not source_url_is_accepted(
        "https://docs.google.com/spreadsheets/u/2/d/abc123/edit#gid=0"
    ):
        problems.append("an account-prefixed Sheets URL must be accepted")
    if source_url_is_accepted(
        "https://docs.google.com/document/d/abc\nInjected: yes"
    ):
        problems.append("a URL carrying a newline must be refused")
    if source_url_is_accepted("https://example.com/document/d/abc/edit"):
        problems.append("a non-google host must be refused")
    if source_url_is_accepted(
        "https://docs.google.com/file/d/abc/edit"
    ):
        problems.append("an unsupported document family must be refused")

    if redact_urls("see https://docs.google.com/document/d/x/edit?usp=sharing") != (
        "see [URL_REDACTED]"
    ):
        problems.append("error messages must redact every URL")

    if resolve_connector_tool(["mcp__codex_apps__google_drive_fetch"]) != (
        PREFERRED_CONNECTOR_TOOL
    ):
        problems.append("the preferred connector name must win when present")
    if resolve_connector_tool(["google_drive_fetch"]) != "google_drive_fetch":
        problems.append("a single suffix match must resolve")
    if resolve_connector_tool(["google_drive_fetch", "gdf_google_drive_fetch"]) is not None:
        problems.append("two suffix matches must resolve to nothing")
    if resolve_connector_tool(["unrelated_tool"]) is not None:
        problems.append("zero suffix matches must resolve to nothing")

    if not output_path_matches_mime("/w/out.pdf", "application/pdf"):
        problems.append("a .pdf output must match the PDF MIME type")
    if output_path_matches_mime("/w/out.pdf", EXPORT_MIME_TYPES[1]):
        problems.append("a .pdf output must not match the XLSX MIME type")

    frame = frame_payload("AAAA", 3)
    if not frame.startswith("D\t3\tAAAA"):
        problems.append("a data frame must carry the tag, the sequence and the payload")
    if not frame.endswith(RECORD_SEPARATOR):
        problems.append("a data frame must end with the record separator")
    if commit_frame() != "C\u0003":
        problems.append("the commit frame drifted")
    if abort_frame() != "A\u0003":
        problems.append("the abort frame drifted")

    if not receipt_is_trusted(
        "TEMPLATE_EXPORT_COMMITTED 42 " + "a" * 64, 42, 0
    ):
        problems.append("a matching receipt with a sixty-four hex digest must be trusted")
    if receipt_is_trusted("TEMPLATE_EXPORT_COMMITTED 42 " + "a" * 64, 41, 0):
        problems.append("a receipt reporting the wrong byte count must be refused")
    if receipt_is_trusted("TEMPLATE_EXPORT_COMMITTED 42 " + "a" * 64, 42, 1):
        problems.append("a receipt from a dirty exit must be refused")
    if receipt_is_trusted("TEMPLATE_EXPORT_COMMITTED 42 " + "a" * 63, 42, 0):
        problems.append("a short digest must be refused")

    if shell_for("C:/node.exe") != SHELL_POWERSHELL:
        problems.append("a Windows node path must select PowerShell")
    if shell_for("/usr/bin/node") != SHELL_POSIX:
        problems.append("a POSIX node path must select the POSIX shell")
    if shell_for(r"\\server\share\node.exe") != SHELL_POWERSHELL:
        problems.append("a UNC node path must select PowerShell")

    return problems
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
