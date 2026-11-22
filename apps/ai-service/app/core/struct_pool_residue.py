# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Pool segmentation residue (R73).

Every `.rdata` field-name pool in this image stores the names **concatenated without separators**
and ends with the serde template `struct <Name> with <N> elements`.  Segmenting a pool with a
greedy longest-prefix match against every name already attested leaves a residue wherever an
unknown name sits.  The residue is therefore itself the evidence: it is a name the deserializer
accepts but which no earlier round had.

Recomputed on every run from the PE image (`D:/DevEnv/Temp/r73/probe52.py` is the standalone
version; this module is what the contract records).
"""

from __future__ import annotations

import re
from collections.abc import Mapping
from types import MappingProxyType
from typing import Final

#: TurnStartParams pool C @ 0x151b68d78..0x151b68ed4 — segmented with zero residue.
TURN_POOL_C_SEGMENTS: Final[tuple[str, ...]] = (
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
TURN_POOL_C_RESIDUE: Final[tuple[str, ...]] = (

)

#: ThreadStartParams pool B @ 0x151b6a548..0x151b6a5e6 — its tail residue is the new name.
THREAD_POOL_B_SEGMENTS: Final[tuple[str, ...]] = (
    'allowProviderModelFallback',
    'serviceName',
    'historyMode',
    'sessionStartSource',
    'daybreakEnabled',
    'dynamicTools',
    'selectedCapabilityRoots',
    'mockExperimentalField',
)
THREAD_POOL_B_RESIDUE: Final[tuple[str, ...]] = (
    'experimentalRawEvents',
)

#: The one field name this round recovers.  `struct ThreadSta…` follows it inside the pool, so
#: the pool tail itself is the attestation that the name belongs to ThreadStartParams.
NEW_THREAD_FIELD_FROM_RESIDUE: Final[str] = 'experimentalRawEvents'
NEW_FIELD_HAS_POSITION: Final[bool] = False
POOL_TAIL_TEMPLATE_VA: Final[str] = '0x151b6a5bc'

#: Coverage after this round: the residue adds one name, but not one *position*.
THREAD_NAMES_KNOWN: Final[int] = 26
THREAD_START_PARAMS_ARITY: Final[int] = 27
RESIDUE_NAME_PATTERN: Final[re.Pattern[str]] = re.compile(r'^[a-z][A-Za-z0-9]{2,48}$')


class PoolResidueError(ValueError):
    """Raised when a pool's segmentation or residue violates its own invariants."""


def _check_pool(label: str, segs: tuple[str, ...], residue: tuple[str, ...]) -> None:
    if len(segs) != len(set(segs)):
        raise PoolResidueError(f'{label} segments repeat a name')
    for name in residue:
        if not RESIDUE_NAME_PATTERN.match(name):
            raise PoolResidueError(f'{label} residue {name!r} is not a field-shaped ident')
        if name in segs:
            raise PoolResidueError(f'{label} residue {name!r} is already a segment')


def validate_pool_residue() -> None:
    _check_pool('turn_pool_c', TURN_POOL_C_SEGMENTS, TURN_POOL_C_RESIDUE)
    _check_pool('thread_pool_b', THREAD_POOL_B_SEGMENTS, THREAD_POOL_B_RESIDUE)
    if not THREAD_POOL_B_RESIDUE:
        raise PoolResidueError('thread_pool_b residue vanished: the pool segmentation no longer '
                               'reproduces the recovered name')
    if TURN_POOL_C_RESIDUE:
        raise PoolResidueError('turn_pool_c residue must stay empty on this image')
    if NEW_THREAD_FIELD_FROM_RESIDUE not in THREAD_POOL_B_RESIDUE:
        raise PoolResidueError('recovered name is not part of the recorded residue')
    if NEW_FIELD_HAS_POSITION:
        raise PoolResidueError('a residue carries no position evidence: flip this only with '
                               'a Debug-impl order that actually contains the name')


def residue_summary() -> Mapping[str, int]:
    validate_pool_residue()
    return MappingProxyType({
        'turn_pool_segments': len(TURN_POOL_C_SEGMENTS),
        'turn_pool_residue': len(TURN_POOL_C_RESIDUE),
        'thread_pool_segments': len(THREAD_POOL_B_SEGMENTS),
        'thread_pool_residue': len(THREAD_POOL_B_RESIDUE),
        'thread_names_known': THREAD_NAMES_KNOWN,
        'thread_arity': THREAD_START_PARAMS_ARITY,
        'thread_gap': THREAD_START_PARAMS_ARITY - THREAD_NAMES_KNOWN,
    })
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
