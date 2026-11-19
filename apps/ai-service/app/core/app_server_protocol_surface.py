# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""The app-server protocol as a machine-generated surface (R130).

Everything before this round inferred the wire contract from disassembly strings and
``struct variant`` element counts. This round found something far better: the binary ships its
own schema generator.

    codex app-server generate-json-schema --out <DIR>
    codex app-server generate-json-schema --out <DIR> --experimental
    codex app-server generate-ts --out <DIR> [--prettier <BIN>] [--experimental]

Both ran clean (rc=0) against ``codex.exe 26.1111.2228.0`` at
``C:\\Users\\Administrator\\AppData\\Local\\OpenAI\\Codex\\bin\\c38161ad8494f88c\\codex.exe``
(364.8 MB). The stable face emitted 329 JSON files, the experimental face 479. That is the whole
JSON-RPC protocol — every client request, every server notification, every server-initiated
request — as literal JSON Schema, with no inference step left to get wrong.

**What the dump settles.** The protocol is a union of four envelope files. Three of them enumerate
methods; the fourth does not. ``ClientRequest`` carries 107 methods stable / 182 experimental,
``ServerNotification`` 81 / 81, ``ServerRequest`` 9 / 11, and ``ClientNotification`` **0 on both
faces** — it is an envelope whose ``method`` stays a free-form string, so no method list exists for
it. Totals: 197 stable, 274 experimental, and a delta of exactly 77 methods that exist only behind
the flag, with **zero** methods that appear stable and vanish experimental. A flag that only ever
adds is a strong signal: ``--experimental`` widens, it does not rewrite.

**The family shape, derived not guessed.** ``thread`` is by far the largest family (59 stable, 89
experimental), then ``item`` 19 on both faces, ``account`` 18 → 22, ``plugin`` 12 → 13, ``fs`` 10,
``turn`` 8 → 9, ``mcpServer`` 7 → 9. The experimental additions cluster exactly where a product
would stage them: ``project/*`` (8), ``remoteControl/*`` (8), ``process/*`` (6, up from 2),
``userVerification/*`` (5), ``thread/queue/*`` (6), ``thread/realtime/*`` (6), ``environment/*`` (3),
``memory/*`` (2), plus single entries ``currentTime/read``, ``rollout/compress``,
``server/diagnostics`` and — tellingly — ``mock/experimentalMethod``.

**The ``mock/experimentalMethod`` entry is the interesting one.** A protocol that ships a mock
method behind its experimental flag is telling you its own test harness is part of the surface.

**Honest boundary.** This module pins the generated inventory (file counts, method counts,
per-family counts, and the exact experimental-only delta). It does not pin every field of every
object — that is 775 KB + 669 KB of stable schema and 957 KB + 839 KB experimental, and enumerating
it field by field is a separate pass. The counts are of this build's generator output and will
move when the vendor ships a new binary. The generated tree lives outside the repo under
``D:\\DevEnv\\Temp\\r130\\`` and is reproducible with the command above.
"""

from __future__ import annotations

from typing import Final

CODEX_EXE_RELATIVE: Final = "OpenAI/Codex/bin/c38161ad8494f88c/codex.exe"
CODEX_EXE_BYTES: Final = 364.8 * 1024 * 1024
SCHEMA_COMMAND: Final = "app-server generate-json-schema --out <DIR> [--experimental]"
TS_COMMAND: Final = "app-server generate-ts --out <DIR> [--prettier <BIN>] [--experimental]"
GENERATOR_IS_EXPERIMENTAL_LABELLED: Final = True

STABLE_FILE_COUNT: Final = 329
EXPERIMENTAL_FILE_COUNT: Final = 479

STABLE_BUNDLE_BYTES: Final = 775_089
STABLE_V2_BUNDLE_BYTES: Final = 669_264
EXPERIMENTAL_BUNDLE_BYTES: Final = 957_557
EXPERIMENTAL_V2_BUNDLE_BYTES: Final = 839_394

UNION_FILES: Final = (
    "ClientRequest.json",
    "ClientNotification.json",
    "ServerNotification.json",
    "ServerRequest.json",
)

METHOD_COUNTS_STABLE: Final = {
    "ClientRequest.json": 107,
    "ClientNotification.json": 0,
    "ServerNotification.json": 81,
    "ServerRequest.json": 9,
}
METHOD_COUNTS_EXPERIMENTAL: Final = {
    "ClientRequest.json": 182,
    "ClientNotification.json": 0,
    "ServerNotification.json": 81,
    "ServerRequest.json": 11,
}
STABLE_METHOD_TOTAL: Final = 197
EXPERIMENTAL_METHOD_TOTAL: Final = 274
CLIENT_NOTIFICATION_ENUMERATES_NO_METHOD: Final = True

STABLE_FAMILY_COUNTS: Final = {
    "account": 18,
    "app": 4,
    "attestation": 1,
    "autoApprovalReview": 1,
    "command": 5,
    "config": 4,
    "configRequirements": 1,
    "experimentalFeature": 2,
    "externalAgentConfig": 6,
    "feedback": 2,
    "fs": 10,
    "fuzzyFileSearch": 2,
    "hook": 2,
    "hooks": 1,
    "item": 19,
    "marketplace": 3,
    "mcpServer": 7,
    "mcpServerStatus": 1,
    "model": 4,
    "modelProvider": 5,
    "openai": 1,
    "permissionProfile": 1,
    "plugin": 12,
    "process": 2,
    "project": 1,
    "remoteControl": 1,
    "review": 1,
    "serverRequest": 1,
    "skills": 4,
    "thread": 59,
    "threadSection": 4,
    "turn": 8,
    "windows": 1,
    "windowsSandbox": 3,
}
STABLE_FAMILY_COUNT: Final = 34

EXPERIMENTAL_ONLY_METHODS: Final = (
    "account/bedrock/checkGovCloudRequirements",
    "account/bedrock/discover",
    "account/bedrock/setup",
    "account/gcp/setup",
    "accountSession/list",
    "accountSession/switch",
    "collaborationMode/list",
    "currentTime/read",
    "environment/add",
    "environment/info",
    "environment/status",
    "fuzzyFileSearch/sessionStart",
    "fuzzyFileSearch/sessionStop",
    "fuzzyFileSearch/sessionUpdate",
    "mcpServer/event/stream/start",
    "mcpServer/event/stream/stop",
    "memory/reset",
    "memory/status",
    "mock/experimentalMethod",
    "openai/userVerification",
    "plugin/search",
    "process/kill",
    "process/resizePty",
    "process/spawn",
    "process/writeStdin",
    "project/create",
    "project/delete",
    "project/import",
    "project/list",
    "project/move",
    "project/read",
    "project/update",
    "remoteControl/client/list",
    "remoteControl/client/revoke",
    "remoteControl/disable",
    "remoteControl/enable",
    "remoteControl/pairing/start",
    "remoteControl/pairing/status",
    "remoteControl/status/read",
    "rollout/compress",
    "server/diagnostics",
    "thread/backgroundTerminals/clean",
    "thread/backgroundTerminals/list",
    "thread/backgroundTerminals/terminate",
    "thread/decrement_elicitation",
    "thread/guardianReview",
    "thread/increment_elicitation",
    "thread/items/read",
    "thread/memory/read",
    "thread/memoryMode/set",
    "thread/prediction/request",
    "thread/prepareApprovedPlan",
    "thread/queue/add",
    "thread/queue/delete",
    "thread/queue/list",
    "thread/queue/reorder",
    "thread/queue/start",
    "thread/queue/update",
    "thread/readState/update",
    "thread/realtime/appendAudio",
    "thread/realtime/appendSpeech",
    "thread/realtime/appendText",
    "thread/realtime/listVoices",
    "thread/realtime/start",
    "thread/realtime/stop",
    "thread/sample",
    "thread/sample/cancel",
    "thread/search",
    "thread/searchOccurrences",
    "thread/settings/update",
    "thread/timeline/list",
    "turn/settings/update",
    "userVerification/cancel",
    "userVerification/delete",
    "userVerification/enroll",
    "userVerification/status",
    "userVerification/verify",
)
EXPERIMENTAL_ONLY_COUNT: Final = 77
STABLE_ONLY_COUNT: Final = 0
FLAG_ONLY_ADDS_NEVER_REMOVES: Final = True

TRANSPORTS: Final = ("stdio://", "unix://", "unix://PATH", "ws://IP:PORT", "off")
TRANSPORT_COUNT: Final = 5
DEFAULT_TRANSPORT: Final = "stdio://"
WS_AUTH_MODES: Final = ("capability-token", "signed-bearer-token")
WS_AUTH_MODE_COUNT: Final = 2
WS_FLAGS: Final = (
    "--ws-token-file",
    "--ws-token-sha256",
    "--ws-shared-secret-file",
    "--ws-issuer",
    "--ws-audience",
    "--ws-max-clock-skew-seconds",
)
WS_FLAG_COUNT: Final = 6

APP_SERVER_SUBCOMMANDS: Final = ("daemon", "proxy", "generate-ts", "generate-json-schema")
APP_SERVER_SUBCOMMAND_COUNT: Final = 4
ANALYTICS_OFF_BY_DEFAULT: Final = True


def family_of(method: str) -> str:
    """First path segment of a protocol method, e.g. ``thread`` for ``thread/read``."""
    return str(method).split("/")[0]


def stable_family_total() -> int:
    """Sum of the per-family counts, which must equal the stable method total."""
    return sum(STABLE_FAMILY_COUNTS.values())


def family_count(family: str) -> int:
    """Stable method count for one family, or 0 when the family does not exist."""
    return STABLE_FAMILY_COUNTS.get(str(family), 0)


def is_experimental_only(method: str) -> bool:
    """Whether a method exists only behind ``--experimental``."""
    return str(method) in EXPERIMENTAL_ONLY_METHODS


def delta_is_additive_only() -> bool:
    """Whether the flag only ever adds methods. Derived from the two pinned counts."""
    return (
        EXPERIMENTAL_METHOD_TOTAL - STABLE_METHOD_TOTAL == EXPERIMENTAL_ONLY_COUNT
        and STABLE_ONLY_COUNT == 0
    )


def coverage() -> dict[str, object]:
    """What this module pins, for the ledger to cite."""
    return {
        "stable_files": STABLE_FILE_COUNT,
        "experimental_files": EXPERIMENTAL_FILE_COUNT,
        "stable_methods": STABLE_METHOD_TOTAL,
        "experimental_methods": EXPERIMENTAL_METHOD_TOTAL,
        "experimental_only": EXPERIMENTAL_ONLY_COUNT,
        "families": STABLE_FAMILY_COUNT,
        "transports": TRANSPORT_COUNT,
        "ws_flags": WS_FLAG_COUNT,
        "app_server_subcommands": APP_SERVER_SUBCOMMAND_COUNT,
    }


def validate_contract() -> list[str]:
    """Assert the pinned protocol inventory is internally consistent."""
    problems: list[str] = []

    if set(METHOD_COUNTS_STABLE) != set(UNION_FILES):
        problems.append("the stable face must describe exactly the four union envelopes")
    if set(METHOD_COUNTS_EXPERIMENTAL) != set(UNION_FILES):
        problems.append("the experimental face must describe exactly the four union envelopes")

    if sum(METHOD_COUNTS_STABLE.values()) != STABLE_METHOD_TOTAL:
        problems.append("stable per-envelope counts do not sum to the pinned total")
    if sum(METHOD_COUNTS_EXPERIMENTAL.values()) != EXPERIMENTAL_METHOD_TOTAL:
        problems.append("experimental per-envelope counts do not sum to the pinned total")

    if METHOD_COUNTS_STABLE["ClientNotification.json"] != 0:
        problems.append("ClientNotification must enumerate no methods on the stable face")
    if METHOD_COUNTS_EXPERIMENTAL["ClientNotification.json"] != 0:
        problems.append("ClientNotification must enumerate no methods on the experimental face")
    if not CLIENT_NOTIFICATION_ENUMERATES_NO_METHOD:
        problems.append("ClientNotification's free-form method must stay recorded as unpinned")

    if METHOD_COUNTS_STABLE["ServerNotification.json"] != METHOD_COUNTS_EXPERIMENTAL["ServerNotification.json"]:
        problems.append("notification methods must not differ between the two faces")

    if len(STABLE_FAMILY_COUNTS) != STABLE_FAMILY_COUNT:
        problems.append("family count drifted from the pinned family table")
    if stable_family_total() != STABLE_METHOD_TOTAL:
        problems.append("per-family counts do not sum to the stable method total")
    if STABLE_FAMILY_COUNTS.get("thread") != 59:
        problems.append("the thread family must remain the largest at 59 stable methods")
    if max(STABLE_FAMILY_COUNTS.values()) != STABLE_FAMILY_COUNTS["thread"]:
        problems.append("no family may outgrow thread")

    if len(EXPERIMENTAL_ONLY_METHODS) != EXPERIMENTAL_ONLY_COUNT:
        problems.append("the experimental-only delta count drifted")
    if len(set(EXPERIMENTAL_ONLY_METHODS)) != len(EXPERIMENTAL_ONLY_METHODS):
        problems.append("the experimental-only delta contains a duplicate")
    for method in EXPERIMENTAL_ONLY_METHODS:
        if "/" not in method:
            problems.append(f"{method} is not a path-shaped method name")
        if not method[0].isalpha():
            problems.append(f"{method} must start with a letter")
    if len(EXPERIMENTAL_ONLY_METHODS) != EXPERIMENTAL_METHOD_TOTAL - STABLE_METHOD_TOTAL:
        problems.append("the delta must equal experimental minus stable")
    if STABLE_ONLY_COUNT != 0:
        problems.append("the flag must never remove a method")
    if not FLAG_ONLY_ADDS_NEVER_REMOVES:
        problems.append("the flag is additive-only and that fact must stay recorded")
    if not delta_is_additive_only():
        problems.append("delta arithmetic must prove the flag is additive-only")
    if is_experimental_only("thread/read"):
        problems.append("thread/read is a stable method and must not be in the delta")
    if not is_experimental_only("thread/queue/add"):
        problems.append("thread/queue/add is experimental-only and must be in the delta")
    if not is_experimental_only("mock/experimentalMethod"):
        problems.append("the mock method must be recorded as experimental-only")

    if len(TRANSPORTS) != TRANSPORT_COUNT:
        problems.append("transport count drifted")
    if DEFAULT_TRANSPORT != "stdio://":
        problems.append("stdio must remain the default transport")
    if "ws://IP:PORT" not in TRANSPORTS:
        problems.append("the websocket transport must stay enumerated")
    if len(WS_AUTH_MODES) != WS_AUTH_MODE_COUNT:
        problems.append("websocket auth mode count drifted")
    if len(WS_FLAGS) != WS_FLAG_COUNT:
        problems.append("websocket flag count drifted")
    for flag in WS_FLAGS:
        if not flag.startswith("--ws-"):
            problems.append(f"{flag} is not a websocket flag")

    if len(APP_SERVER_SUBCOMMANDS) != APP_SERVER_SUBCOMMAND_COUNT:
        problems.append("app-server subcommand count drifted")
    if "generate-json-schema" not in APP_SERVER_SUBCOMMANDS:
        problems.append("the schema generator must stay enumerated")
    if not ANALYTICS_OFF_BY_DEFAULT:
        problems.append("app-server analytics default off is a documented fact")

    if STABLE_FILE_COUNT >= EXPERIMENTAL_FILE_COUNT:
        problems.append("the experimental face must carry more files than the stable face")

    return problems
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
