# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Visitor key branches: the one axis that still yields exact field names for the two
frontier structs.

`ThreadStartParams` (arity 27) and `TurnStartParams` (arity 28) have **no arity-sized
(ptr,len) record array** — widening the R68 scanner to `.data`, single-character names and
cross-section pointers finds 17,134 runs and still only a Finnish word list at 27 and an
agent-op list at 28. Their names survive in the deserialize visitor's `next_key` match arms,
where each arm compares against a `&'static str` literal; those literals are attested
(compiler-issued), so the resulting **set** is exact even though its order is not the
declaration order.

What this module therefore claims, and what it does not:

* `TURN_START_PARAMS_VISITOR_KEYS` — 27 exact names; 22 of the 23 R67-attested tail names
  are among them, the 23rd (`cyberAccessProgram`) is attested from the pool instead. The
  union is **one short of arity 28** and that gap is recorded, not papered over.
* `THREAD_START_PARAMS_VISITOR_KEYS` — 43 names from a visitor that also serves the plain
  `Thread` object, so the set mixes two structs and is **not** usable as a field list.

Order is deliberately not claimed anywhere: the visitor's arms are branch order, not
declaration order.

::

    keys = TURN_START_PARAMS_VISITOR_KEYS
    assert len(keys) == 27 and TURN_ARITY_GAP == 1
"""

from __future__ import annotations

from collections.abc import Mapping
from types import MappingProxyType
from typing import Final

TURN_START_PARAMS_VISITOR_KEYS: Final[tuple[str, ...]] = (
    'threadId',
    'summary',
    'approvalPolicy',
    'permissions',
    'disabledPluginIds',
    'additionalContext',
    'outputSchema',
    'multiAgentMode',
    'effort',
    'sandboxPolicy',
    'collaborationMode',
    'parentTurnId',
    'rootTurnId',
    'environments',
    'clientUserMessageId',
    'responsesapiClientMetadataPatch',
    'serviceTierForTurn',
    'toolOutput',
    'responsesapiClientMetadata',
    'turnTrigger',
    'model',
    'personality',
    'approvalsReviewer',
    'runtimeWorkspaceRoots',
    'serviceTier',
    'modelProvider',
    'cyberAccessProgram',
)

TURN_START_PARAMS_ATTESTED_TAIL: Final[tuple[str, ...]] = (
    'disabledPluginIds',
    'clientUserMessageId',
    'turnTrigger',
    'parentTurnId',
    'rootTurnId',
    'toolOutput',
    'responsesapiClientMetadata',
    'responsesapiClientMetadataPatch',
    'additionalContext',
    'environments',
    'runtimeWorkspaceRoots',
    'approvalPolicy',
    'approvalsReviewer',
    'sandboxPolicy',
    'permissions',
    'serviceTier',
    'serviceTierForTurn',
    'effort',
    'personality',
    'outputSchema',
    'collaborationMode',
    'multiAgentMode',
    'cyberAccessProgram',
)

THREAD_START_PARAMS_VISITOR_KEYS: Final[tuple[str, ...]] = (
    'baseInstructions',
    'ephemeral',
    'personality',
    'model',
    'runtimeWorkspaceRoots',
    'threadSource',
    'modelProvider',
    'allowProviderModelFallback',
    'historyMode',
    'developerInstructions',
    'environments',
    'mockExperimentalField',
    'selectedCapabilityRoots',
    'serviceName',
    'approvalPolicy',
    'permissions',
    'approvalsReviewer',
    'daybreakEnabled',
    'multiAgentMode',
    'sandbox',
    'serviceTier',
    'config',
    'dynamicTools',
    'projectId',
    'sessionStartSource',
    'id',
    'preview',
    'status',
    'createdAt',
    'cliVersion',
    'source',
    'recencyAt',
    'canAcceptDirectInput',
    'agentRole',
    'name',
    'section',
    'forkedFromId',
    'originator',
    'reasoningEffort',
    'agentNickname',
    'extra',
    'sectionEnteredAt',
    'parentThreadId',
)

TURN_START_PARAMS_ARITY: Final[int] = 28
TURN_ARITY_GAP: Final[int] = 1

#: Names the visitor produced that the R67 tail did not cover — the candidate header.
TURN_VISITOR_ONLY: Final[tuple[str, ...]] = (
    'threadId',
    'summary',
    'model',
    'modelProvider',
)

#: Field markers of the plain `Thread` object; their presence proves the Thread visitor
#: serves two structs at once and its 43 keys cannot be read as a field list.
THREAD_MIXED_MARKERS: Final[tuple[str, ...]] = (
    'id',
    'preview',
    'status',
    'createdAt',
    'cliVersion',
    'recencyAt',
    'forkedFromId',
)

MEASUREMENTS: Final[Mapping[str, float]] = MappingProxyType({
    'widened_record_runs': 17134,
    'record_arrays_of_27': 1,
    'record_arrays_of_28': 3,
    'turn_visitor_functions': 3,
    'turn_visitor_keys': 26,
    'turn_union': 27,
    'thread_visitor_keys': 43,
    'fragment_tables_found': 2,
    'largest_fragment': 18,
    'largest_fragment_turn_hits': 9,
})

#: Turn's last-missing name candidate. Weak on purpose: the reference probe that would
#: settle it filters merged pools badly (4 of its names have zero standalone occurrences),
#: so this name is recorded as unverified rather than merged into the key set.
TURN_LAST_NAME_CANDIDATE: Final[str] = 'cwd'
TURN_LAST_NAME_VERIFIED: Final[bool] = False

#: Attribution methods measured and rejected *after* R68 (round 69), then R70.
FALSIFIED_AFTER_R68: Final[tuple[tuple[str, str], ...]] = (
    ('widened-record-array',
     '17,134 runs incl. .data, single-char names and cross-section ptrs: still no 27/28 field table'),
    ('code-order-literal-run',
     'the referencing functions are serde stubs: 84/89 lea sites are MapAccess panic text'),
    ('dictionary-dp-segmentation',
     '20,287-word dictionary on the merged pools yields 0 legal segmentations'),
    ('fragment-table-no-boundary',
     'R70: two fragment tables found (18 and 8 records); both are multi-struct runs with no arity edge'),
)


class VisitorKeyEvidenceError(Exception):

    """Raised when the recorded visitor evidence no longer matches the binary."""


def turn_start_params_keys() -> tuple[str, ...]:

    """The 27 exact names, in visitor-branch order (not declaration order)."""

    return TURN_START_PARAMS_VISITOR_KEYS


def turn_arity_gap() -> int:

    """How many names arity 28 still wants; 1 at the time of measurement."""

    return TURN_ARITY_GAP


def thread_keys_are_mixed() -> bool:

    """True: the Thread visitor also serves the plain `Thread` object."""

    return any(marker in THREAD_START_PARAMS_VISITOR_KEYS for marker in THREAD_MIXED_MARKERS)


def validate_visitor_key_evidence() -> None:

    """Pin set exactness, the recorded arity gap and the Thread mixing."""

    keys = TURN_START_PARAMS_VISITOR_KEYS
    if len(keys) != len(set(keys)):
        raise VisitorKeyEvidenceError("turn keys contain duplicates")
    if len(keys) != 27:
        raise VisitorKeyEvidenceError(f"turn keys are {len(keys)}, recorded 27")
    missing = [name for name in TURN_START_PARAMS_ATTESTED_TAIL if name not in keys]
    if missing:
        raise VisitorKeyEvidenceError(f"attested tail is not covered: {missing}")
    if TURN_START_PARAMS_ARITY - len(keys) != TURN_ARITY_GAP:
        raise VisitorKeyEvidenceError("arity gap no longer equals 1")
    if not thread_keys_are_mixed():
        raise VisitorKeyEvidenceError("Thread visitor no longer looks mixed")


def ensure_visitor_key_evidence() -> None:

    """Assert-style wrapper for risk paths."""

    validate_visitor_key_evidence()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
