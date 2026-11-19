# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Behaviour written in prose instead of schema (R133).

312 properties carry a description. This module reads the 93 that contain a condition ("when",
"if", "unless", "only") and records what they actually constrain — because in this dictionary the
behaviour lives in the prose, not in the type.

**A correction worth keeping**: R132 measured 82 conditional descriptions. That count was an
artefact of the matcher, not of the data — searching for `" if "` with a leading space misses every
sentence that *begins* with "If". Padding the text before matching finds **93**, eleven more. The
Census keyword counts were unaffected because those needles never sit at a sentence start, which is
exactly why the defect survived one round: it broke only the marker that can open a sentence.
The matcher below pads, and the R132 constant is corrected to 93.

The distinction that matters most: a schema tells you a field is optional; the prose tells you what
happens if you leave it out, and those are different answers from the same-looking sentence.

**Defaults are the largest class (25 descriptions state one).** Two of them are not "absent means
the obvious thing":
- ``ThreadShellCommandParams.timeoutMs`` defaults to **one hour** when omitted or null, and
  ``zero`` means *time out immediately*, not unlimited. Two different readings of "no number" and
  the prose rules out the usual one.
- ``ListMcpServerStatusParams.detail`` defaults to ``Full``.

**Explicit-empty and omitted are different states (4 descriptions say so).** ``modelProviders``
present-but-empty includes everything; omitted means something narrower. ``ThreadListParams.sourceKinds``
omitted *or* empty defaults to interactive sources. A boolean flag cannot express this; only prose can.

**Three-state fields (17 descriptions).** ``ThreadListParams.sectionId``: omit for all sections,
``null`` for unsectioned threads, an id for that section. Omit/null/value is not a boolean and not a
filter — it is three meanings on one field.

**Mutual exclusion is declared in prose, not schema (5 descriptions).** ``CommandExecParams.sandboxPolicy``
"cannot be combined with ``permissionProfile``". ``CommandExecResponse.stdout``/``stderr`` are
**empty when the same stream was streamed** via ``command/exec/outputDelta`` — buffered and streamed
output are alternatives, and the losing side is empty rather than absent.

**Preconditions that fail (1).** ``TurnSteerParams.expectedTurnId`` must match the currently active
turn or the request fails — compare-and-swap semantics expressed as a request field.

**Steering suppresses several turn fields.** ``parentTurnId``, ``rootTurnId``, ``serviceTierForTurn``
and ``turnTrigger`` are each "ignored when this request adds input to an active turn". Same request
object, two modes, and half the fields only apply in one.

**Deprecation is stated, not enforced (15).** Full-history hydration is "deprecated for paginated
threads"; the supported path is ``excludeTurns`` plus ``thread/turns/list`` and ``thread/items/list``.

**Compatibility gaps are admitted (11).** ``ThreadResumeResponse.collaborationMode`` is "absent when
resuming from an older server". ``FsGetMetadataResponse.createdAtMs`` is ``0`` when unavailable — a
sentinel zero, not null, so a consumer that checks for null will read 1970.

**Two vendor uncertainties are on the record, in the dictionary itself.** ``grantRoot`` carries
"unclear if this is honored today" on ``ApplyPatchApprovalParams``, and the same field on
``FileChangeRequestApprovalParams`` is additionally marked ``[UNSTABLE]``. The schema is
self-reporting that this flag may do nothing.

**One review does not always map to one item.** ``targetItemId`` is null for network policy reviews
by design: the call belongs to a CommandExecution item, but the review is about the network call,
so pointing at the command would be misleading. That rationale is stated in the prose.

**Honest boundary.** The rule table below is hand-transcribed from the export at
``D:/DevEnv/Temp/r130/schema-stable``; the counts are machine-measured. Verbatim fragments appear in
quotes where the exact wording carries the meaning. The 230 non-conditional descriptions were not
read for rules; they are the remaining prose surface.
"""

from __future__ import annotations

from typing import Final

DESCRIPTION_COUNT: Final = 312
CONDITIONAL_DESCRIPTION_COUNT: Final = 93
PLAIN_DESCRIPTION_COUNT: Final = 219
CONDITIONAL_CHARS: Final = 12901
UNPADDED_MATCHER_COUNT: Final = 82
PADDING_RECOVERED: Final = 11

# Machine-measured keyword census over all 312 descriptions.
CENSUS: Final = {
    "defaults": 25,
    "exclusion": 5,
    "deprecated": 15,
    "uncertain": 2,
    "three_state": 17,
    "cursor": 27,
    "precondition": 1,
    "explicit_empty": 4,
    "sentinel_zero": 2,
    "compat": 11,
}

RULE_KINDS: Final = (
    "default",
    "three-state",
    "explicit-empty",
    "mutual-exclusion",
    "precondition",
    "steering-suppressed",
    "deprecated-path",
    "compat-absent",
    "sentinel",
    "vendor-uncertainty",
    "design-rationale",
)

# (id, field, kind, rule)
RULES: Final = (
    (
        "timeout-defaults-to-one-hour",
        "ThreadShellCommandParams.timeoutMs",
        "default",
        "Omitted or null means one hour; zero means an immediate timeout, not unlimited execution; "
        "it does not affect the immediate RPC acknowledgement.",
    ),
    (
        "mcp-detail-defaults-to-full",
        "ListMcpServerStatusParams.detail",
        "default",
        "Omitted means Full inventory.",
    ),
    (
        "sandbox-policy-excludes-permission-profile",
        "CommandExecParams.sandboxPolicy",
        "mutual-exclusion",
        "Cannot be combined with permissionProfile; defaults to the user's configured policy.",
    ),
    (
        "buffered-output-is-empty-when-streamed",
        "CommandExecResponse.stdout",
        "mutual-exclusion",
        "Empty when stdout was streamed via command/exec/outputDelta — buffered and streamed are "
        "alternatives and the losing side is empty, not absent.",
    ),
    (
        "process-id-required-for-streaming-modes",
        "CommandExecParams.processId",
        "precondition",
        "Required for tty, streamStdin, streamStdoutStderr and the follow-up write/resize/terminate "
        "calls; when omitted, buffered execution gets an internal id that is never exposed.",
    ),
    (
        "pty-size-only-valid-with-tty",
        "CommandExecParams.size",
        "precondition",
        "Only valid when tty is true.",
    ),
    (
        "steer-requires-expected-turn",
        "TurnSteerParams.expectedTurnId",
        "precondition",
        "The request fails when it does not match the currently active turn.",
    ),
    (
        "section-id-is-three-state",
        "ThreadListParams.sectionId",
        "three-state",
        "Omit for every section, null for unsectioned threads, an id for that section.",
    ),
    (
        "archived-is-two-state-with-null-collapsing",
        "ThreadListParams.archived",
        "three-state",
        "True returns only archived threads; false or null returns only non-archived ones.",
    ),
    (
        "providers-present-but-empty-means-all",
        "ThreadListParams.modelProviders",
        "explicit-empty",
        "When present but empty, includes all providers.",
    ),
    (
        "source-kinds-omitted-or-empty-default",
        "ThreadListParams.sourceKinds",
        "explicit-empty",
        "Omitted or empty defaults to interactive sources.",
    ),
    (
        "hooks-cwds-empty-uses-session-cwd",
        "HooksListParams.cwds",
        "explicit-empty",
        "An empty list uses the session cwd.",
    ),
    (
        "plugin-list-omitted-narrows-scope",
        "PluginListParams.cwds",
        "explicit-empty",
        "When omitted, only home-scoped and the official curated marketplace are considered; cwds "
        "is what discovers repo marketplaces.",
    ),
    (
        "parent-turn-ignored-when-steering",
        "TurnStartParams.parentTurnId",
        "steering-suppressed",
        "Ignored when this request adds input to an active turn.",
    ),
    (
        "root-turn-ignored-when-steering",
        "TurnStartParams.rootTurnId",
        "steering-suppressed",
        "Ignored when this request adds input to an active turn; when set alongside parentTurnId it "
        "keeps descendant work attributed to the original turn.",
    ),
    (
        "service-tier-for-turn-only-on-new-turn",
        "TurnStartParams.serviceTierForTurn",
        "steering-suppressed",
        "Overrides the tier only when starting a new turn; omitted or null inherits the thread's tier; "
        "does not change the thread's tier or a turn being steered.",
    ),
    (
        "turn-trigger-ignored-when-steering",
        "TurnStartParams.turnTrigger",
        "steering-suppressed",
        "Optional source classification, ignored when this request steers an active turn.",
    ),
    (
        "full-history-hydration-deprecated",
        "ThreadForkParams.excludeTurns",
        "deprecated-path",
        "True returns metadata and live fork state only; full-history hydration is deprecated for "
        "paginated threads and the supported path is thread/turns/list plus thread/items/list.",
    ),
    (
        "resume-exclude-turns-same-contract",
        "ThreadResumeParams.excludeTurns",
        "deprecated-path",
        "Same shape as the fork flag: metadata and live resume state only, turns fetched separately.",
    ),
    (
        "collaboration-mode-absent-on-old-server",
        "ThreadResumeResponse.collaborationMode",
        "compat-absent",
        "Absent when resuming from an older server.",
    ),
    (
        "fs-created-at-uses-zero-sentinel",
        "FsGetMetadataResponse.createdAtMs",
        "sentinel",
        "Zero when unavailable — a sentinel, not null.",
    ),
    (
        "fs-modified-at-uses-zero-sentinel",
        "FsGetMetadataResponse.modifiedAtMs",
        "sentinel",
        "Zero when unavailable — a sentinel, not null.",
    ),
    (
        "grant-root-honouring-is-uncertain",
        "ApplyPatchApprovalParams.grantRoot",
        "vendor-uncertainty",
        "The agent asks to allow writes under this root for the rest of the session, and the prose "
        "says it is unclear whether this is honoured today.",
    ),
    (
        "file-change-grant-root-is-unstable",
        "FileChangeRequestApprovalParams.grantRoot",
        "vendor-uncertainty",
        "Carries the same uncertainty plus an explicit [UNSTABLE] marker.",
    ),
    (
        "network-review-has-no-target-item",
        "ItemGuardianApprovalReviewCompletedNotification.targetItemId",
        "design-rationale",
        "Null for network policy reviews by design: the call belongs to a CommandExecution item but "
        "the review is about the network call, so naming the command would mislead.",
    ),
    (
        "elicitation-turn-is-correlation-only",
        "McpServerElicitationRequestParams.turnId",
        "design-rationale",
        "Nullable because MCP models elicitation as a standalone request identified by the MCP "
        "request id; turn context is app-server correlation, not protocol identity.",
    ),
    (
        "telemetry-is-not-stored-state",
        "ItemCompletedNotification.contentTokenCount",
        "design-rationale",
        "Completion telemetry is not part of the stored thread item, so this count is not readable "
        "back from history.",
    ),
)

RULE_COUNT: Final = len(RULES)


def rules_of_kind(kind: str) -> tuple[str, ...]:
    """Ids of the rules of one kind, empty for an unknown kind."""
    return tuple(rid for rid, _field, k, _text in RULES if k == kind)


def rule_kind(rule_id: str) -> str:
    """Kind of a rule, empty string when the id is unknown."""
    for rid, _field, kind, _text in RULES:
        if rid == rule_id:
            return kind
    return ""


def rule_field(rule_id: str) -> str:
    """Source field of a rule, empty string when the id is unknown."""
    for rid, field, _kind, _text in RULES:
        if rid == rule_id:
            return field
    return ""


def describe(rule_id: str) -> str:
    """Rule text, empty string when the id is unknown."""
    for rid, _field, _kind, text in RULES:
        if rid == rule_id:
            return text
    return ""


def is_conditional_description(text: str) -> bool:
    """Whether a description states a condition, padded so a marker can open a sentence."""
    padded = " " + str(text).lower() + " "
    return any(marker in padded for marker in (" when ", " if ", " unless ", " only "))


def validate_prose_rules() -> list[str]:
    """Assert the rule table and the measured census hold together."""
    problems: list[str] = []

    if CONDITIONAL_DESCRIPTION_COUNT + PLAIN_DESCRIPTION_COUNT != DESCRIPTION_COUNT:
        problems.append("conditional and plain descriptions must account for all 312")
    if RULE_COUNT > CONDITIONAL_DESCRIPTION_COUNT:
        problems.append("there cannot be more rules than conditional descriptions")
    if CONDITIONAL_DESCRIPTION_COUNT != UNPADDED_MATCHER_COUNT + PADDING_RECOVERED:
        problems.append("padding must account for the eleven sentence-opening conditions")

    ids = [rid for rid, _f, _k, _t in RULES]
    if len(set(ids)) != RULE_COUNT:
        problems.append("rule ids must be unique")
    fields = [f for _i, f, _k, _t in RULES]
    if len(set(fields)) != RULE_COUNT:
        problems.append("each rule names a distinct field")
    for kind in [k for _i, _f, k, _t in RULES]:
        if kind not in RULE_KINDS:
            problems.append(f"unknown rule kind: {kind}")
    if any(not text.strip() for _i, _f, _k, text in RULES):
        problems.append("a rule without text is not a rule")

    for kind in RULE_KINDS:
        if not rules_of_kind(kind):
            problems.append(f"kind {kind} has no representative rule")

    if len(rules_of_kind("steering-suppressed")) != 4:
        problems.append("steering suppresses four turn fields")
    if len(rules_of_kind("vendor-uncertainty")) != 2:
        problems.append("the dictionary admits two uncertainties")
    if len(rules_of_kind("sentinel")) != 2:
        problems.append("both file time fields use the zero sentinel")
    if len(rules_of_kind("explicit-empty")) != 4:
        problems.append("four descriptions distinguish empty from omitted")
    if len(rules_of_kind("default")) != 2:
        problems.append("two of the twenty-five defaults are counter-intuitive and are recorded")

    if CENSUS["defaults"] < len(rules_of_kind("default")):
        problems.append("recorded defaults cannot exceed the measured default count")
    if CENSUS["exclusion"] < 3:
        problems.append("mutual exclusion is declared in prose five times, at least three recorded")
    if CENSUS["uncertain"] != len(rules_of_kind("vendor-uncertainty")):
        problems.append("both measured uncertainties are on the record")
    if CENSUS["precondition"] != 1:
        problems.append("the census found exactly one precondition sentence")

    if not is_conditional_description("If nothing is set, the default applies."):
        problems.append("the conditional probe must recognise 'if'")
    if is_conditional_description("Opaque cursor for the next page."):
        problems.append("a plain sentence must not read as conditional")

    if rule_kind("section-id-is-three-state") != "three-state":
        problems.append("lookup by id must resolve the kind")
    if rule_field("section-id-is-three-state") != "ThreadListParams.sectionId":
        problems.append("lookup by id must resolve the field")
    if rule_kind("nope") != "" or describe("nope") != "":
        problems.append("an unknown rule id must resolve to empty values")
    if rules_of_kind("nope") != ():
        problems.append("an unknown kind must resolve to no rules")

    return problems
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
