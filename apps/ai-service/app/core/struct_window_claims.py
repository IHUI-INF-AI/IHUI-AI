# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Sliding-window claims over FIELDS record runs (R83).

R81 required a whole run to be a struct's array.  R80 had runs up to 62 records long, which is
several structs laid end to end — so this round slides a window of the struct's arity across every
run and scores it by how many of that struct's *partial* names it contains.  The best window wins,
provided it is unique (no other struct scores the same on the same window, and no second window of
this struct ties).

A window claim is still a lead, not a proof — it is name-overlap scoring, so a mid-scoring window
can be coincidence.  Two qualifications are carried explicitly instead of averaged away:

* **cross-source attested (1 of 16)** — `PreToolUseHookSpecificOutputWire`'s fields read from the
  binary array are set-equal to the JSON Schema `definitions` entry extracted in R64, and its
  `required` member (`hookEventName`) is one of the read names.  Two independent sources agreeing
  is the strongest evidence available here, and it is exactly what the source binary alone could
  not give us.
* **thin evidence (2 of 16)** — `BrowserUseOriginPolicyToml` and `ExecutorPlugin` score only 2 of
  7, i.e. just two names came from their pools; their other five fields are unseen before this round.

The remaining 13 read as self-consistent but rest on one source.
"""

from __future__ import annotations

from collections.abc import Mapping
from types import MappingProxyType
from typing import Final

UNCLAIMED_UNDER: Final[int] = 144
UNDER_SITES: Final[int] = 326
WIDTH: Final[int] = 16
MIN_SCORE: Final[int] = 2
COVERAGE_BEFORE: Final[int] = 305
COVERAGE_AFTER: Final[int] = 321
WINDOW_CLAIMS_ATTESTED: Final[bool] = False

#: name -> (arity, run address, offset inside the run, overlap score, fields)
WINDOW_CLAIMS: Final[Mapping[str, tuple[int, str, int, int, tuple[str, ...]]]] = MappingProxyType({
    'AgentMessageItem': (7, '0x1522316b8', 0, 4, ('moderation', 'message', 'phase', 'memory_citation', 'delivery', 'questions', 'provider')),
    'BrowserUseOriginPolicyToml': (7, '0x151cc71d0', 0, 2, ('access', 'downloads', 'uploads', 'full_cdp_access', 'auto_review', 'persistent_approval', 'access_approval_lifetime')),
    'BrowserUseRequirementsToml': (7, '0x151cc72d8', 0, 3, ('extension', 'allow_webmcp', 'allow_history_access', 'disable_auto_review', 'allow_global_persistent_approval', 'default_origin_policy', 'origins')),
    'ClientCapabilities': (5, '0x152807850', 0, 4, ('experimental', 'extensions', 'roots', 'sampling', 'elicitation')),
    'CommandExecutionItem': (13, '0x152231dc8', 0, 5, ('parsed_cmd', 'source', 'interaction_input', 'aggregated_output', 'exit_code', 'duration', 'status', 'warning', 'stop', 'feedback', 'context', 'error', 'call_id')),
    'ConfigWarningNotification': (4, '0x151be31f0', 0, 2, ('summary', 'details', 'path', 'range')),
    'ExecutorPlugin': (7, '0x15236dd20', 0, 2, ('remotePluginId', 'version', 'localVersion', 'name', 'shareContext', 'source', 'installed')),
    'FsRemoveParams': (5, '0x151ea7408', 0, 2, ('path', 'recursive', 'force', 'followSymlinks', 'sandbox')),
    'HookRunSummary': (14, '0x152231828', 0, 3, ('legacy', 'paginated', 'root_turn_id', 'turn_id', 'last_agent_message', 'error', 'started_at', 'completed_at', 'duration_ms', 'time_to_first_token_ms', 'call_id', 'query', 'action', 'results')),
    'ModelReroutedNotification': (5, '0x151c04288', 0, 3, ('threadId', 'turnId', 'fromModel', 'toModel', 'reason')),
    'PreToolUseHookSpecificOutputWire': (5, '0x151f9de60', 0, 4, ('hookEventName', 'permissionDecision', 'permissionDecisionReason', 'updatedInput', 'additionalContext')),
    'RawNetworkRequirementsToml': (15, '0x151cbfbb0', 0, 7, ('enabled', 'http_port', 'socks_port', 'allow_upstream_proxy', 'dangerously_allow_non_loopback_proxy', 'dangerously_allow_all_unix_sockets', 'domains', 'review_domains', 'allowed_domains', 'managed_allowed_domains_only', 'denied_domains', 'unix_sockets', 'allow_unix_sockets', 'allow_local_binding', 'header_injections')),
    'RealtimeHandoffRequested': (4, '0x152232ee8', 10, 3, ('handoff_id', 'item_id', 'input_transcript', 'active_transcript')),
    'ServerCapabilities': (7, '0x152807850', 0, 2, ('experimental', 'extensions', 'roots', 'sampling', 'elicitation', 'tools', 'context')),
    'SpendControlLimitSnapshot': (4, '0x151c066e0', 0, 3, ('limit', 'used', 'remainingPercent', 'resetsAt')),
    'WebSearchItem': (4, '0x152231828', 10, 3, ('call_id', 'query', 'action', 'results')),
})

#: Claims corroborated by a second, independent source (the embedded JSON Schema).
CROSS_SOURCE_ATTESTED: Final[tuple[str, ...]] = (
    'PreToolUseHookSpecificOutputWire',
)

#: Claims whose overlap score is too low to lean on.
THIN_EVIDENCE: Final[tuple[str, ...]] = (
    'BrowserUseOriginPolicyToml',
    'ExecutorPlugin',
)


class WindowClaimError(ValueError):
    """Raised when the window table contradicts its counts or its own evidence grading."""


def fields_of(name: str) -> tuple[str, ...]:
    """Fields claimed for one struct, or empty when unclaimed."""
    entry = WINDOW_CLAIMS.get(name)
    return entry[4] if entry else ()


def score_of(name: str) -> int:
    """How many of the struct's partial names the winning window contained."""
    entry = WINDOW_CLAIMS.get(name)
    return entry[3] if entry else 0


def thin_share() -> float:
    """Share of claims resting on the minimum overlap score."""
    return len(THIN_EVIDENCE) / WIDTH


def validate_window_claims() -> None:
    if len(WINDOW_CLAIMS) != WIDTH:
        raise WindowClaimError("window table size disagrees with WIDTH")
    if COVERAGE_AFTER != COVERAGE_BEFORE + WIDTH:
        raise WindowClaimError("coverage arithmetic disagrees")
    if len(set(CROSS_SOURCE_ATTESTED) | set(THIN_EVIDENCE)) != len(CROSS_SOURCE_ATTESTED) + len(THIN_EVIDENCE):
        raise WindowClaimError("a claim is graded twice")
    for name in CROSS_SOURCE_ATTESTED + THIN_EVIDENCE:
        if name not in WINDOW_CLAIMS:
            raise WindowClaimError(f"{name}: graded claim missing from the table")
    for name, (arity, address, offset, score, fields) in WINDOW_CLAIMS.items():
        if len(fields) != arity:
            raise WindowClaimError(f"{name}: {len(fields)} fields vs arity {arity}")
        if not address.startswith('0x'):
            raise WindowClaimError(f"{name}: address is not a hex literal")
        if offset < 0:
            raise WindowClaimError(f"{name}: negative window offset")
        if not (MIN_SCORE <= score <= arity):
            raise WindowClaimError(f"{name}: score {score} outside [{MIN_SCORE}, {arity}]")
        if len(set(fields)) != len(fields):
            raise WindowClaimError(f"{name}: repeats a field")
    for name in THIN_EVIDENCE:
        if score_of(name) != MIN_SCORE:
            raise WindowClaimError(f"{name}: thin evidence must sit at the score floor")
    if WINDOW_CLAIMS_ATTESTED:
        raise WindowClaimError(
            "name-overlap scoring is not proof; attesting all claims is unsupported")


def window_claims_summary() -> Mapping[str, object]:
    validate_window_claims()
    return MappingProxyType({
        'width': WIDTH,
        'coverage_before': COVERAGE_BEFORE,
        'coverage_after': COVERAGE_AFTER,
        'attested': len(CROSS_SOURCE_ATTESTED),
        'thin': len(THIN_EVIDENCE),
        'thin_share': round(thin_share(), 4),
    })
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
