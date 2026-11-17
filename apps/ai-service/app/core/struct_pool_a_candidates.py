# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Pool A segmentation account (R74).

Pool A @ `0x151b43120..0x151b4340d` (749 B) is not one struct's name list: it is a
multi-family run holding Thread status/enum text plus the names of several Thread-related
request structs.  Segmenting it with the full 19k-ident dictionary leaves
**4 bytes** of residue (99.47% of the pool covered), so the account below
is as complete as this image allows.

Two honesty tiers are recorded separately:

* `POOL_A_FIELD_SHAPED` — segments that look like a field name (strict camelCase or snake_case).
* `POOL_A_TRUSTED_CANDIDATES` — field-shaped segments that no earlier round had **and** that
  another known/candidate name does not prefix.  A prefixed one is a glued pair of adjacent
  names, not one field.

None of these is *attested*: segmentation proves the bytes exist in a name pool, not that
any struct accepts them.  `POOL_A_CANDIDATES_ATTESTED = False` keeps that distinction.
"""

from __future__ import annotations

import re
from collections.abc import Mapping
from types import MappingProxyType
from typing import Final

POOL_A_BYTES: Final[int] = 749
POOL_A_SEGMENTS: Final[tuple[str, ...]] = (
    'internal',
    'ly',
    'tag',
    'ge',
    'enum',
    'ThreadStatus',
    'NotLoaded',
    'Idle',
    'SystemErrorasccreated_atupdated_atrecency_atsection_position',
    'turnId',
    'item',
    'outputDeferred',
    'experimentalPredictionMode',
    'experimentalDisablePredictionMcp',
    'lastTurnId',
    'beforeTurnId',
    'permissions',
    'config',
    'baseInstructions',
    'developerInstructions',
    'attachToSource',
    'excludeTurns',
    'deferGoalContinuation',
    'includeAttachedThreads',
    'currentAccountOnly',
    'excludedThreadIds',
    'sortKey',
    'sortDirection',
    'modelProviders',
    'sourceKinds',
    'originators',
    'sectionId',
    'useStateDbOnly',
    'ancestorThreadId',
    'includeTurnssubAgentThreadSpawn',
    'allowProviderModelFallback',
    'serviceName',
    'personality',
    'sessionStartSource',
    'dynamicTools',
    'selectedCapabilityRoots',
    'mockExperimentalField',
    'experimentalRawEventsstartupclear',
    'history',
    'origin',
    'objective',
    'tokenBudget',
    'clientUserMessageId',
    'responsesapiClientMetadata',
    'ThreadResumeResponse',
)
#: Uncovered bytes; 4 of 749 — the remainder is not any known ident.
POOL_A_RESIDUE: Final[tuple[str, ...]] = (
    ' ',
    'd ',
    ' ',
)
POOL_A_RESIDUE_BYTES: Final[int] = 4
POOL_A_COVERAGE_PCT: Final[float] = 99.47

POOL_A_FIELD_SHAPED: Final[tuple[str, ...]] = (
    'turnId',
    'outputDeferred',
    'experimentalPredictionMode',
    'experimentalDisablePredictionMcp',
    'lastTurnId',
    'beforeTurnId',
    'baseInstructions',
    'developerInstructions',
    'attachToSource',
    'excludeTurns',
    'deferGoalContinuation',
    'includeAttachedThreads',
    'currentAccountOnly',
    'excludedThreadIds',
    'sortKey',
    'sortDirection',
    'modelProviders',
    'sourceKinds',
    'sectionId',
    'useStateDbOnly',
    'ancestorThreadId',
    'includeTurnssubAgentThreadSpawn',
    'allowProviderModelFallback',
    'serviceName',
    'sessionStartSource',
    'dynamicTools',
    'selectedCapabilityRoots',
    'mockExperimentalField',
    'experimentalRawEventsstartupclear',
    'tokenBudget',
    'clientUserMessageId',
    'responsesapiClientMetadata',
)
POOL_A_CANDIDATES: Final[tuple[str, ...]] = (
    'turnId',
    'outputDeferred',
    'experimentalPredictionMode',
    'experimentalDisablePredictionMcp',
    'lastTurnId',
    'beforeTurnId',
    'attachToSource',
    'excludeTurns',
    'deferGoalContinuation',
    'includeAttachedThreads',
    'currentAccountOnly',
    'excludedThreadIds',
    'sortKey',
    'sortDirection',
    'modelProviders',
    'sourceKinds',
    'sectionId',
    'useStateDbOnly',
    'ancestorThreadId',
    'includeTurnssubAgentThreadSpawn',
    'experimentalRawEventsstartupclear',
    'tokenBudget',
)
#: Candidates with another known/candidate name as their prefix.  Some really are two names
#: glued by the pool's separator-less layout; others are legitimate plural/derived fields
#: (`modelProviders`).  Recorded as a *doubt*, not as a verdict.
POOL_A_PREFIX_COLLISIONS: Final[tuple[str, ...]] = (
    'modelProviders',
    'sourceKinds',
    'sectionId',
    'experimentalRawEventsstartupclear',
)
#: For every collision, which name prefixes it — the doubt is auditable, not assumed.
POOL_A_PREFIXED_BY: Final[Mapping[str, str]] = MappingProxyType({
    'modelProviders': 'modelProvider',
    'sourceKinds': 'source',
    'sectionId': 'section',
    'experimentalRawEventsstartupclear': 'experimentalRawEvents',
})
#: Candidates longer than any attested field name in this image — a glued pair by length.
POOL_A_OVERLONG: Final[tuple[str, ...]] = (
    'experimentalDisablePredictionMcp',
    'includeTurnssubAgentThreadSpawn',
    'experimentalRawEventsstartupclear',
)
LONG_NAME_LIMIT: Final[int] = 30
POOL_A_DOUBTFUL: Final[tuple[str, ...]] = (
    'experimentalDisablePredictionMcp',
    'modelProviders',
    'sourceKinds',
    'sectionId',
    'includeTurnssubAgentThreadSpawn',
    'experimentalRawEventsstartupclear',
)
POOL_A_TRUSTED_CANDIDATES: Final[tuple[str, ...]] = (
    'turnId',
    'outputDeferred',
    'experimentalPredictionMode',
    'lastTurnId',
    'beforeTurnId',
    'attachToSource',
    'excludeTurns',
    'deferGoalContinuation',
    'includeAttachedThreads',
    'currentAccountOnly',
    'excludedThreadIds',
    'sortKey',
    'sortDirection',
    'useStateDbOnly',
    'ancestorThreadId',
    'tokenBudget',
)
POOL_A_CANDIDATES_ATTESTED: Final[bool] = False

FIELD_SHAPE: Final[re.Pattern[str]] = re.compile(r'^[a-z][a-z0-9]*(?:[A-Z][a-z0-9]+)+$|^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$')


class PoolAccountError(ValueError):
    """Raised when the pool account contradicts itself."""


def validate_pool_account() -> None:
    if POOL_A_RESIDUE_BYTES > 16:
        raise PoolAccountError(f'residue grew to {POOL_A_RESIDUE_BYTES} bytes: the dictionary no '
                               f'longer segments this pool, so the account is not complete')
    if POOL_A_COVERAGE_PCT < 95.0:
        raise PoolAccountError(f'coverage fell to {POOL_A_COVERAGE_PCT}%')
    if len(POOL_A_SEGMENTS) != len(set(POOL_A_SEGMENTS)):
        raise PoolAccountError('segment list repeats a name')
    for name in POOL_A_FIELD_SHAPED:
        if not FIELD_SHAPE.match(name):
            raise PoolAccountError(f'{name!r} is in FIELD_SHAPED but has no field shape')
    for name in POOL_A_RESIDUE:
        if FIELD_SHAPE.match(name):
            raise PoolAccountError(f'{name!r} sits in the residue yet has a field shape')
    for name in POOL_A_PREFIX_COLLISIONS:
        if name not in POOL_A_CANDIDATES:
            raise PoolAccountError(f'{name!r} collides on a prefix but is not a candidate')
        prefix = POOL_A_PREFIXED_BY.get(name)
        if not prefix or not name.startswith(prefix) or prefix == name:
            raise PoolAccountError(f'{name!r} is recorded as a prefix collision but '
                                   f'{prefix!r} does not prefix it')
    for name in POOL_A_OVERLONG:
        if len(name) <= LONG_NAME_LIMIT:
            raise PoolAccountError(f'{name!r} is not overlong yet sits in OVERLONG')
    if set(POOL_A_DOUBTFUL) != set(POOL_A_PREFIX_COLLISIONS) | set(POOL_A_OVERLONG):
        raise PoolAccountError('DOUBTFUL must be exactly the union of the two doubt classes')
    if set(POOL_A_TRUSTED_CANDIDATES) & set(POOL_A_DOUBTFUL):
        raise PoolAccountError('trusted and doubtful sets overlap')
    if set(POOL_A_TRUSTED_CANDIDATES) != set(POOL_A_CANDIDATES) - set(POOL_A_DOUBTFUL):
        raise PoolAccountError('trusted must be candidates minus doubtful')
    if POOL_A_CANDIDATES_ATTESTED:
        raise PoolAccountError('a pool segment is not an attestation: flip this only with a '
                               'deserializer or Debug reference')


def account_summary() -> Mapping[str, int]:
    validate_pool_account()
    return MappingProxyType({
        'pool_bytes': POOL_A_BYTES,
        'segments': len(POOL_A_SEGMENTS),
        'residue_segments': len(POOL_A_RESIDUE),
        'residue_bytes': POOL_A_RESIDUE_BYTES,
        'field_shaped': len(POOL_A_FIELD_SHAPED),
        'candidates': len(POOL_A_CANDIDATES),
        'prefix_collisions': len(POOL_A_PREFIX_COLLISIONS),
        'overlong': len(POOL_A_OVERLONG),
        'doubtful': len(POOL_A_DOUBTFUL),
        'trusted': len(POOL_A_TRUSTED_CANDIDATES),
    })
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
