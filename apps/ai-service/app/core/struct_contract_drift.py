# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""非 hook struct 字段名契约的漂移哨兵 —— 统一工程规范 R66（A13 防漂移轴）。

R65 从 ``codex.exe`` 的 ``.rdata`` 里取出 44 个结构的逐字字段名（455 个字段），每条带
sha256 指纹。R66 把它变成**可运行**的判据：给一份「新版本二进制扫出来的结构 → 字段序」，
本模块判定契约是否漂移，并逐结构点名缺失字段 / 未登记字段 / 形状变化。

五类结论（判定优先级从强到弱）：

- ``unchanged``：字段名与顺序逐字相同（指纹相等）；
- ``reordered``：字段集合相同、顺序变了（Wire 上等价，但声明序漂移，需人工确认）；
- ``reshaped``：字段数变了（加字段 / 删字段，``details`` 给出缺与多）；
- ``renamed``：字段数相同但内容变了（改名 / 替换，``details`` 给出缺与多）；
- ``added`` / ``removed``：契约里没有 / 新版本里没了的结构名。

一轴超越：R65 只给静态契约，本模块把「换版本会不会悄悄改字段」变成一条可跑的判据，
并复用 ``struct_fingerprint`` 作单一真相源（§0.6），不另立第二份字段清单。

取证边界见 R66 报告：本轮试图用 ``.pdata`` 函数边界把 2,532 处未归属模板收回来，
两条函数级判据实测均为 0 命中，因此 ``ThreadStartParams``(27) / ``TurnStartParams``(28)
仍不在契约内，哨兵对它们只报 ``added``（新版本若出现也不认），不冒充基线。
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from typing import Final

from app.core.struct_field_name_contract import (
    STRUCT_FIELD_ARITY,
    STRUCT_FIELD_NAMES,
    StructFieldNameError,
    struct_fingerprint,
)

__all__ = [
    "StructDriftReport",
    "StructContractDriftError",
    "EXPECTED_STRUCT_FINGERPRINTS",
    "classify_struct_drift",
    "assert_no_struct_drift",
    "assert_contract_matches_arity",
]

# 基线指纹：直接由 R65 契约算出，不另存一份（§0.6 单一真相源）。
EXPECTED_STRUCT_FINGERPRINTS: Final[dict[str, str]] = {
    name: struct_fingerprint(name) for name in STRUCT_FIELD_NAMES
}


class StructContractDriftError(ValueError):
    """契约发生漂移且调用方要求「零漂移」时抛错。"""


@dataclass(frozen=True)
class StructDriftReport:
    """一次漂移比对的结论。``ok`` 只认「全部 unchanged」。"""

    unchanged: tuple[str, ...] = ()
    reordered: tuple[str, ...] = ()
    reshaped: tuple[str, ...] = ()
    renamed: tuple[str, ...] = ()
    added: tuple[str, ...] = ()
    removed: tuple[str, ...] = ()
    details: Mapping[str, tuple[tuple[str, ...], tuple[str, ...]]] = field(default_factory=dict)

    @property
    def ok(self) -> bool:
        return not (self.reordered or self.reshaped or self.renamed or self.added or self.removed)

    @property
    def drifted(self) -> tuple[str, ...]:
        """所有出现漂移的结构名（去重、按名字排序，便于逐条点名）。"""
        return tuple(
            sorted(set(self.reordered) | set(self.reshaped) | set(self.renamed)
                   | set(self.added) | set(self.removed))
        )

    def missing_fields(self, name: str) -> tuple[str, ...]:
        return self.details.get(name, ((), ()))[0]

    def unknown_fields(self, name: str) -> tuple[str, ...]:
        return self.details.get(name, ((), ()))[1]

    def summary(self) -> str:
        return (
            f"漂移哨兵: unchanged={len(self.unchanged)} reordered={len(self.reordered)} "
            f"reshaped={len(self.reshaped)} renamed={len(self.renamed)} "
            f"added={len(self.added)} removed={len(self.removed)}"
        )


def _missing_unknown(
    expected: tuple[str, ...], observed: Sequence[str]
) -> tuple[tuple[str, ...], tuple[str, ...]]:
    missing = tuple(f for f in expected if f not in observed)
    unknown = tuple(f for f in observed if f not in expected)
    return missing, unknown


def classify_struct_drift(
    observed: Mapping[str, Sequence[str]],
    *,
    expected: Mapping[str, Sequence[str]] | None = None,
) -> StructDriftReport:
    """比对「新扫出的结构 → 字段序」与基线契约，分类且逐结构点名差异。

    ``observed`` 允许只给一部分结构（缺的那些记 ``removed``）；``expected`` 缺省取
    R65 契约。比对顺序不敏感的地方只体现在 ``reordered``：集合相同、顺序不同。
    """
    base = dict(STRUCT_FIELD_NAMES if expected is None else expected)
    unchanged: list[str] = []
    reordered: list[str] = []
    reshaped: list[str] = []
    renamed: list[str] = []
    details: dict[str, tuple[tuple[str, ...], tuple[str, ...]]] = {}

    for name in sorted(base):
        if name not in observed:
            continue
        exp = tuple(base[name])
        got = tuple(observed[name])
        if got == exp:
            unchanged.append(name)
            continue
        missing, unknown = _missing_unknown(exp, got)
        details[name] = (missing, unknown)
        if len(got) != len(exp):
            reshaped.append(name)
        elif set(got) == set(exp):
            reordered.append(name)
        else:
            renamed.append(name)

    added = tuple(sorted(str(n) for n in observed if n not in base))
    removed = tuple(sorted(n for n in base if n not in observed))
    return StructDriftReport(
        unchanged=tuple(unchanged),
        reordered=tuple(reordered),
        reshaped=tuple(reshaped),
        renamed=tuple(renamed),
        added=added,
        removed=removed,
        details=details,
    )


def assert_no_struct_drift(report: StructDriftReport) -> StructDriftReport:
    """零漂移守门：任何一类漂移都抛错，并点名结构与首个差异字段。"""
    if report.ok:
        return report
    parts = [report.summary()]
    for name in report.drifted:
        if name in report.renamed or name in report.reshaped:
            missing, unknown = report.details.get(name, ((), ()))
            parts.append(f"{name}: 缺={missing!r} 多={unknown!r}")
        elif name in report.reordered:
            parts.append(f"{name}: 字段集合相同但顺序变了")
        elif name in report.added:
            parts.append(f"{name}: 基线未登记该结构（新版本新增）")
        elif name in report.removed:
            parts.append(f"{name}: 基线登记但新版本未扫到")
    raise StructContractDriftError("；".join(parts))


def assert_contract_matches_arity() -> None:
    """基线自检：契约内每个结构的字段数必须等于独立来源的 arity（R62 读数）。"""
    for name, fields in STRUCT_FIELD_NAMES.items():
        if STRUCT_FIELD_ARITY[name] != len(fields):
            raise StructFieldNameError(
                f"{name!r} 字段数 {len(fields)} 与 arity {STRUCT_FIELD_ARITY[name]} 不等"
            )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
