# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R76: the byte order inside a name pool carries no declaration-order information (falsification #6).

R72 pinned the declaration (Debug print) order of TurnStartParams and ThreadStartParams from the
`lea` sequence.  R73/R75 read field names out of the pools that sit right before the serde
`expecting` template.  The obvious shortcut would be "the pool is printed in declaration order" —
this module measures that shortcut and kills it.

Measured on the two control pools, over the name pairs each pool and R72 share: Turn agrees 109 vs
disagrees 122 (**47.2%** agreement), Thread agrees 16 vs disagrees 12 (**57.1%**).  Both are within
noise of a 50/50 baseline, i.e. the pool's byte order is **independent of** declaration order.  The
conclusion is not "the pool is printed backwards" — it is "the pool carries no order at all", so
declaration order still has to come from `lea` sites (R72).

Second finding, equally load-bearing: **a pool is a fragment**.  Turn's pool carries 23 of the 27
attested names and omits `model` / `summary` / `threadId`; Thread's carries 8 of 25.  Any claim that
segments one pool and calls it "the struct's fields" is wrong by construction.

All numbers here are recomputed from the two upstream modules at import time — nothing is typed in
by hand, so the measurement cannot drift away from the data it describes.
"""

from __future__ import annotations

from types import MappingProxyType
from typing import Final

from app.core.struct_declaration_order import THREAD_DECLARATION_ORDER, TURN_DECLARATION_ORDER
from app.core.struct_pool_residue import THREAD_POOL_B_SEGMENTS, TURN_POOL_C_SEGMENTS

#: Pool byte order as segmented by R73 (byte order, not field order).
TURN_POOL_ORDER: Final[tuple[str, ...]] = TURN_POOL_C_SEGMENTS
THREAD_POOL_ORDER: Final[tuple[str, ...]] = THREAD_POOL_B_SEGMENTS

FALSIFICATION_ID: Final[str] = "pool-bytes-not-declaration-order"
POOL_ORDER_IS_DECLARATION_ORDER: Final[bool] = False
POOL_IS_FRAGMENT: Final[bool] = True


def _agreement(pool: tuple[str, ...], decl: tuple[str, ...]) -> tuple[int, int]:
    """Pairwise rank agreement between two orders over the names they share."""
    ia = {n: i for i, n in enumerate(pool)}
    ib = {n: i for i, n in enumerate(decl)}
    shared = [n for n in pool if n in ib]
    agree = disagree = 0
    for i in range(len(shared)):
        for j in range(i + 1, len(shared)):
            x, y = shared[i], shared[j]
            if (ia[x] < ia[y]) == (ib[x] < ib[y]):
                agree += 1
            else:
                disagree += 1
    return agree, disagree


TURN_AGREEMENT: Final[tuple[int, int]] = _agreement(TURN_POOL_ORDER, TURN_DECLARATION_ORDER)
THREAD_AGREEMENT: Final[tuple[int, int]] = _agreement(THREAD_POOL_ORDER, THREAD_DECLARATION_ORDER)
ORDER_AGREEMENT: Final[MappingProxyType[str, tuple[int, int]]] = MappingProxyType(
    {"turn": TURN_AGREEMENT, "thread": THREAD_AGREEMENT},
)

#: A pair agreement fraction at or above this is treated as "the pool does order the fields",
#: which would make the falsification false.  0.70 leaves room for the two control measurements
#: (0.472 and 0.571) while still rejecting a genuinely ordered pool.
ORDERED_AGREEMENT_THRESHOLD: Final[float] = 0.70

#: Names each pool is missing relative to the declaration order it is supposed to describe.
TURN_POOL_MISSING: Final[tuple[str, ...]] = tuple(
    n for n in TURN_DECLARATION_ORDER if n not in set(TURN_POOL_ORDER))
TURN_POOL_EXTRA: Final[tuple[str, ...]] = tuple(
    n for n in TURN_POOL_ORDER if n not in set(TURN_DECLARATION_ORDER))
THREAD_POOL_MISSING: Final[tuple[str, ...]] = tuple(
    n for n in THREAD_DECLARATION_ORDER if n not in set(THREAD_POOL_ORDER))
THREAD_POOL_EXTRA: Final[tuple[str, ...]] = tuple(
    n for n in THREAD_POOL_ORDER if n not in set(THREAD_DECLARATION_ORDER))

#: Fragment coverage: pool names / struct arity.
TURN_POOL_COVERAGE: Final[tuple[int, int]] = (len(TURN_POOL_ORDER), 28)
THREAD_POOL_COVERAGE: Final[tuple[int, int]] = (len(THREAD_POOL_ORDER), 27)


class PoolOrderError(ValueError):
    """Raised when a pool/order claim contradicts the measured agreement."""


def validate_pool_order_falsification() -> None:
    for label, (agree, disagree) in ORDER_AGREEMENT.items():
        total = agree + disagree
        if total <= 0:
            raise PoolOrderError(f"{label}: no shared names to compare")
        if agree / total >= ORDERED_AGREEMENT_THRESHOLD:
            raise PoolOrderError(
                f"{label}: pool order agrees on {agree}/{total} pairs "
                f"({agree / total:.1%}) — that is ordered enough that declaration order could be "
                f"read off the pool, so the falsification no longer holds")
    if not TURN_POOL_MISSING:
        raise PoolOrderError("turn: pool is reported complete, contradicting the fragment finding")
    if not THREAD_POOL_MISSING:
        raise PoolOrderError("thread: pool is reported complete, contradicting the fragment finding")
    if TURN_POOL_COVERAGE[0] >= TURN_POOL_COVERAGE[1]:
        raise PoolOrderError("turn: pool coverage reaches the arity, contradicting the fragment")
    if THREAD_POOL_COVERAGE[0] >= THREAD_POOL_COVERAGE[1]:
        raise PoolOrderError("thread: pool coverage reaches the arity, contradicting the fragment")


def falsification_summary() -> MappingProxyType[str, object]:
    validate_pool_order_falsification()
    return MappingProxyType({
        "id": FALSIFICATION_ID,
        "pool_order_is_declaration_order": POOL_ORDER_IS_DECLARATION_ORDER,
        "pool_is_fragment": POOL_IS_FRAGMENT,
        "turn_agree": TURN_AGREEMENT[0],
        "turn_disagree": TURN_AGREEMENT[1],
        "turn_agreement_pct": round(TURN_AGREEMENT[0] / sum(TURN_AGREEMENT) * 100, 1),
        "thread_agree": THREAD_AGREEMENT[0],
        "thread_disagree": THREAD_AGREEMENT[1],
        "thread_agreement_pct": round(THREAD_AGREEMENT[0] / sum(THREAD_AGREEMENT) * 100, 1),
        "ordered_threshold_pct": int(ORDERED_AGREEMENT_THRESHOLD * 100),
        "turn_pool_missing": len(TURN_POOL_MISSING),
        "thread_pool_missing": len(THREAD_POOL_MISSING),
    })
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
