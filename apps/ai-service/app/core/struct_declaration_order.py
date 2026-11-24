# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Declaration order for ThreadStartParams / TurnStartParams, derived from the compiled
`Debug` impl (R72).

Evidence kind: **debug-impl-lea-order**.  A `#[derive(Debug)]` impl emits, per field, one
`lea r64, [rip + <&str>]` for the field name followed by the value's formatting; the runtime
sequence of those `lea`s *is* the declaration order because `Debug` prints in field order.
Four candidate functions were linearly disassembled with Capstone (x86-64) and the field-name
`lea` sites were kept in address order (D:/DevEnv/Temp/r72/ordered_names.json).

What this does **not** claim:
- Coverage is partial: the arity says 27 / 28, the recovered order lists 25 / 25 names.
- Any name absent from the sequence (e.g. `cyberAccessProgram`) has **no** position here.
- The order is *relative*: it says which field prints before which, not the memory layout.
"""

from __future__ import annotations

from collections.abc import Mapping
from types import MappingProxyType
from typing import Final

#: ThreadStartParams field order recovered from `merged` @ 0x145800120..0x145808ea8.
THREAD_DECLARATION_ORDER: Final[tuple[str, ...]] = (
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
)

#: TurnStartParams field order recovered from `turn_worker` @ 0x145772930..0x14577e0e7
#: (the leading `threadId` cluster separated by a >1000-byte gap belongs to another impl).
TURN_DECLARATION_ORDER: Final[tuple[str, ...]] = (
    'summary',
    'approvalPolicy',
    'permissions',
    'disabledPluginIds',
    'additionalContext',
    'outputSchema',
    'multiAgentMode',
    'threadId',
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
)

#: lea site addresses backing each sequence (all strictly increasing ⇒ one contiguous impl).
THREAD_ORDER_LEA_SITES: Final[tuple[int, ...]] = (
    0x1458043e1,
    0x14580450f,
    0x145804644,
    0x1458048aa,
    0x1458049d8,
    0x145804b09,
    0x145804c3a,
    0x145804d68,
    0x145804e9d,
    0x145804fd5,
    0x145805103,
    0x145805234,
    0x145805362,
    0x145805493,
    0x1458055c1,
    0x1458056f6,
    0x145805824,
    0x145805959,
    0x145805a91,
    0x145805bbf,
    0x145805cf7,
    0x145805e25,
    0x145805f63,
    0x1458061d0,
    0x1458062fe,
)
TURN_ORDER_LEA_SITES: Final[tuple[int, ...]] = (
    0x145777e71,
    0x145777fe5,
    0x14577815c,
    0x1457782c9,
    0x14577843d,
    0x1457785de,
    0x14577874e,
    0x1457788bb,
    0x145778a2f,
    0x145778b9c,
    0x145778d10,
    0x145778e7d,
    0x145778fea,
    0x145779157,
    0x1457792c4,
    0x145779431,
    0x1457795d2,
    0x14577973f,
    0x1457798dd,
    0x145779be8,
    0x145779d5f,
    0x145779ecc,
    0x14577a184,
    0x14577a46c,
    0x14577a5dc,
)

THREAD_START_PARAMS_ARITY: Final[int] = 27
TURN_START_PARAMS_ARITY: Final[int] = 28
ORDER_EVIDENCE_KIND: Final[str] = 'debug-impl-lea-order'
ORDER_COMPLETE: Final[bool] = False

ORDER_COVERAGE: Final[Mapping[str, int]] = MappingProxyType({
    'thread_order_keys': 25,
    'thread_arity': THREAD_START_PARAMS_ARITY,
    'thread_gap': THREAD_START_PARAMS_ARITY - len(THREAD_DECLARATION_ORDER),
    'turn_order_keys': 25,
    'turn_arity': TURN_START_PARAMS_ARITY,
    'turn_gap': TURN_START_PARAMS_ARITY - len(TURN_DECLARATION_ORDER),
    'turn_median_lea_gap': 372,
    'thread_median_lea_gap': 305,
})

#: Names the R69 visitor set knows but the ordered sequence does not position (cross-checked
#: against `struct_visitor_key_evidence`).  Kept explicit so a future recovery of their
#: position has to delete an entry here rather than silently widen the order.
TURN_ORDER_UNPOSITIONED: Final[tuple[str, ...]] = ('modelProvider', 'cyberAccessProgram')

#: Cross-check in the other direction: every ordered name must be a name the visitor set
#: already knows.  Both tuples are empty on the current image — a non-empty value would mean
#: the `Debug` impl prints a field the deserializer never accepts.
TURN_ORDER_OUTSIDE_VISITOR: Final[tuple[str, ...]] = ()
THREAD_ORDER_OUTSIDE_VISITOR: Final[tuple[str, ...]] = ()



class DeclarationOrderError(ValueError):
    """Raised when the recovered order violates its own invariants."""


def _check(name: str, order: tuple[str, ...], sites: tuple[int, ...], arity: int) -> None:
    if len(order) != len(set(order)):
        raise DeclarationOrderError(f'{name} has duplicate entries')
    if len(sites) < len(order):
        raise DeclarationOrderError(f'{name} has fewer lea sites than names')
    if any(b - a <= 0 for a, b in zip(sites, sites[1:], strict=False)):
        raise DeclarationOrderError(f'{name} lea sites are not strictly increasing')
    if not 0 < len(order) < arity:
        raise DeclarationOrderError(f'{name} coverage must be partial, got {len(order)} of {arity}')


def validate_declaration_order() -> None:
    _check('thread', THREAD_DECLARATION_ORDER, THREAD_ORDER_LEA_SITES, THREAD_START_PARAMS_ARITY)
    _check('turn', TURN_DECLARATION_ORDER, TURN_ORDER_LEA_SITES, TURN_START_PARAMS_ARITY)


def ensure_declaration_order() -> tuple[tuple[str, ...], tuple[str, ...]]:
    validate_declaration_order()
    return THREAD_DECLARATION_ORDER, TURN_DECLARATION_ORDER


def position_of(name: str) -> Mapping[str, int]:
    """1-based positions of every recovered name in both orders (empty when absent)."""
    out = {}
    if name in THREAD_DECLARATION_ORDER:
        out['thread'] = THREAD_DECLARATION_ORDER.index(name) + 1
    if name in TURN_DECLARATION_ORDER:
        out['turn'] = TURN_DECLARATION_ORDER.index(name) + 1
    return MappingProxyType(out)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
