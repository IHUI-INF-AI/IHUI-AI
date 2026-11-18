# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Address-level attribution of FIELDS arrays to templates (R82).

R81 matched *name sets*.  This round uses the pointer values instead: a record run whose every
`ptr` addresses a string inside the byte pool in front of one template must be that struct's
FIELDS array, and its length must equal that template's arity.

Two things were measured and both are reported here rather than smoothed over:

1. **Templates carry no `lea`.**  Of 3186 templates, **0** are the target of any `lea` site in the
   1.16M-site table, while 2141 of 4005 runs are.  So the "template text and field array are
   referenced from the same function" route is closed — that is falsification #8.
2. **The pool containment test misfires.**  22 runs have every pointer inside a single pool;
   11 of them also match the arity.  1 of those 11 is semantically wrong: `ByteRange` is a
   byte offset pair, yet its claimed array reads `credential_export, delivery`.  A two-element array
   whose pointers happen to sit in the mixed pool A (R74) satisfies the test without belonging to
   the struct.

So the table below is a **candidate list with a measured misfit rate of 1/11**, not an
attestation.  4 of the 11 are new relative to R75/R80/R81 coverage, and all four read as
self-consistent (`FsChangedNotification` = `watchId, changedPaths`; `TextPosition` = `line, column`;
`WindowsSandboxProvisioningSettings` = `proxy_ports, allow_local_binding`;
`ElicitationCapability` = `threadId, sessionId`).
"""

from __future__ import annotations

from collections.abc import Mapping
from types import MappingProxyType
from typing import Final

TEMPLATE_TOTAL: Final[int] = 3186
TEMPLATES_WITH_LEA: Final[int] = 0
FALSIFICATION_ID: Final[str] = "template-has-no-lea-site"

FIELDS_RUNS_TOTAL: Final[int] = 4005
RUNS_WITH_LEA: Final[int] = 2141
POOLS: Final[int] = 1900
RUNS_SINGLE_POOL: Final[int] = 22

HIT_COUNT: Final[int] = 11
MISFIT_COUNT: Final[int] = 1
NEW_COUNT: Final[int] = 4
COVERAGE_BEFORE: Final[int] = 301
COVERAGE_AFTER: Final[int] = 305

#: name -> (arity, record-array address, fields read back from that array)
ADDRESS_HITS: Final[Mapping[str, tuple[int, str, tuple[str, ...]]]] = MappingProxyType({
    'ByteRange': (2, '0x151b190c0', ('credential_export', 'delivery')),
    'DiscoveredPluginFiles': (3, '0x151ea8690', ('manifest', 'mcpConfig', 'appsConfig')),
    'ElicitationCapability': (2, '0x151a69138', ('threadId', 'sessionId')),
    'FsChangedNotification': (2, '0x151be2ba8', ('watchId', 'changedPaths')),
    'HostHello': (2, '0x151c9fff0', ('selectedVersion', 'capabilities')),
    'ModelProviderCapabilities': (3, '0x151cb95a0', ('cyber_access_programs', 'external_web_access', 'remote_compaction')),
    'TextPosition': (2, '0x151be2f30', ('line', 'column')),
    'WalkOutcome': (3, '0x151ea64e8', ('entries', 'errors', 'truncated')),
    'WindowsSandboxProvisioningSettings': (2, '0x15246fe08', ('proxy_ports', 'allow_local_binding')),
    'WireNestedToolCall': (5, '0x151ca0928', ('cell_id', 'runtime_tool_call_id', 'tool_name', 'tool_kind', 'input')),
    'WireToolName': (2, '0x151ca0608', ('name', 'namespace')),
})

#: Structs whose claimed fields contradict their meaning — the containment test's false positives.
SEMANTIC_MISFIT: Final[tuple[str, ...]] = (
    'ByteRange',
)

#: The hits that were not already covered by R75/R80/R81.
NEW_STRUCTS: Final[tuple[str, ...]] = (
    'ElicitationCapability',
    'FsChangedNotification',
    'TextPosition',
    'WindowsSandboxProvisioningSettings'
)

ATTRIBUTION_RULE: Final[str] = "all-pointers-inside-one-pool-and-length-equals-arity"
ADDRESS_LEVEL_ATTESTED: Final[bool] = False


class AddressAttributionError(ValueError):
    """Raised when the address table contradicts its counts or its own rule."""


def fields_by_address(name: str) -> tuple[str, ...]:
    """Fields claimed via pointer containment; empty when unattributed."""
    entry = ADDRESS_HITS.get(name)
    return entry[2] if entry else ()


def misfit_rate() -> float:
    """Share of hits whose fields contradict the struct's meaning."""
    return MISFIT_COUNT / HIT_COUNT


def validate_address_attribution() -> None:
    if len(ADDRESS_HITS) != HIT_COUNT:
        raise AddressAttributionError("hit table size disagrees with HIT_COUNT")
    if TEMPLATES_WITH_LEA not in (0, TEMPLATE_TOTAL):
        raise AddressAttributionError("template lea count is neither zero nor complete")
    if TEMPLATES_WITH_LEA == 0 and FALSIFICATION_ID != "template-has-no-lea-site":
        raise AddressAttributionError("zero template leas must be recorded as the falsification")
    if RUNS_WITH_LEA > FIELDS_RUNS_TOTAL:
        raise AddressAttributionError("more lea-hit runs than runs")
    if RUNS_SINGLE_POOL > FIELDS_RUNS_TOTAL:
        raise AddressAttributionError("more single-pool runs than runs")
    if not (RUNS_SINGLE_POOL >= HIT_COUNT):
        raise AddressAttributionError("hits exceed runs that passed the pool test")
    if COVERAGE_AFTER != COVERAGE_BEFORE + NEW_COUNT:
        raise AddressAttributionError("coverage arithmetic disagrees")
    if len(NEW_STRUCTS) != NEW_COUNT:
        raise AddressAttributionError("new-struct list disagrees with NEW_COUNT")
    for name in NEW_STRUCTS:
        if name not in ADDRESS_HITS:
            raise AddressAttributionError(f"{name}: new struct missing from the table")
    for name in SEMANTIC_MISFIT:
        if name not in ADDRESS_HITS:
            raise AddressAttributionError(f"{name}: misfit not in the table")
        if name in NEW_STRUCTS:
            raise AddressAttributionError(f"{name}: a misfit cannot also be a gain")
    for name, (arity, address, fields) in ADDRESS_HITS.items():
        if len(fields) != arity:
            raise AddressAttributionError(f"{name}: {len(fields)} fields vs arity {arity}")
        if not address.startswith('0x'):
            raise AddressAttributionError(f"{name}: address is not a hex literal")
        if any(not f for f in fields):
            raise AddressAttributionError(f"{name}: empty field name")
    if ADDRESS_LEVEL_ATTESTED:
        raise AddressAttributionError(
            "the pool test misfires; attesting it is unsupported")


def address_attribution_summary() -> Mapping[str, object]:
    validate_address_attribution()
    return MappingProxyType({
        'templates_with_lea': TEMPLATES_WITH_LEA,
        'runs_with_lea': RUNS_WITH_LEA,
        'single_pool_runs': RUNS_SINGLE_POOL,
        'hits': HIT_COUNT,
        'misfit': MISFIT_COUNT,
        'new': NEW_COUNT,
        'coverage_after': COVERAGE_AFTER,
        'attested': ADDRESS_LEVEL_ATTESTED,
    })
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
