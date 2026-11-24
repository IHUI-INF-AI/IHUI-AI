# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""调查台账:把 deep_research 的 report 投影成可逐条追踪的证据账。

不另存真相:条目、来源、交叉核验、gap 问题全部来自既有
``ResearchReport``(``evidence`` / ``crosscheck`` / ``gap_questions`` /
``limitations``),本模块只做稳定排序、去重和缺口聚合,供 UI/CLI 直接消费。
"""
from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any

__all__ = [
    "LedgerEntry",
    "InvestigationLedger",
    "build_investigation_ledger",
]

_VERIFIED = "corroborated"
_CONTESTED = "conflicting"
_UNVERIFIED = "unverified"


@dataclass(frozen=True)
class LedgerEntry:
    """一条调查证据的稳定视图。"""

    entry_id: str
    question: str
    claim: str
    verification: str
    depth: int
    sources: tuple[dict[str, Any], ...]

    def as_dict(self) -> dict[str, Any]:
        return {
            "entryId": self.entry_id,
            "question": self.question,
            "claim": self.claim,
            "verification": self.verification,
            "depth": self.depth,
            "sources": list(self.sources),
        }


@dataclass(frozen=True)
class InvestigationLedger:
    """一次研究的台账快照;计数只由条目派生,不信任调用方传入。"""

    entries: tuple[LedgerEntry, ...]
    open_questions: tuple[str, ...]
    crosscheck: tuple[dict[str, Any], ...]
    limitations: tuple[str, ...]

    @property
    def verified(self) -> int:
        return sum(1 for entry in self.entries if entry.verification == _VERIFIED)

    @property
    def contested(self) -> int:
        return sum(1 for entry in self.entries if entry.verification == _CONTESTED)

    @property
    def unverified(self) -> int:
        return sum(1 for entry in self.entries if entry.verification == _UNVERIFIED)

    def as_dict(self) -> dict[str, Any]:
        return {
            "entries": [entry.as_dict() for entry in self.entries],
            "total": len(self.entries),
            "verified": self.verified,
            "contested": self.contested,
            "unverified": self.unverified,
            "openQuestions": list(self.open_questions),
            "crosscheck": list(self.crosscheck),
            "limitations": list(self.limitations),
        }


def _source_dict(source: Any) -> dict[str, Any]:
    return {
        "url": str(getattr(source, "url", "") or ""),
        "title": str(getattr(source, "title", "") or ""),
        "tier": str(getattr(source, "tier", "") or "unknown"),
        "verified": bool(getattr(source, "verified", False)),
        "note": str(getattr(source, "note", "") or ""),
    }


def _unique_questions(questions: Iterable[Any]) -> tuple[str, ...]:
    seen: set[str] = set()
    result: list[str] = []
    for item in questions:
        text = str(item or "").strip()
        if text and text not in seen:
            seen.add(text)
            result.append(text)
    return tuple(result)


def build_investigation_ledger(report: Any) -> InvestigationLedger:
    """把 ``ResearchReport``(或同形对象)投影为台账。

    条目按输入顺序编号(``ev-1``…),来源按 URL 去重;缺口问题合并
    ``gap_questions`` 与 ``limitations``,同一句只留一次。
    """
    entries: list[LedgerEntry] = []
    for index, evidence in enumerate(getattr(report, "evidence", ()) or ()):
        sources: list[dict[str, Any]] = []
        seen_urls: set[str] = set()
        for source in getattr(evidence, "sources", ()) or ():
            item = _source_dict(source)
            url = item["url"]
            if url and url in seen_urls:
                continue
            if url:
                seen_urls.add(url)
            sources.append(item)
        entries.append(
            LedgerEntry(
                entry_id=f"ev-{index + 1}",
                question=str(getattr(evidence, "question", "") or ""),
                claim=str(getattr(evidence, "content", "") or ""),
                verification=str(
                    getattr(evidence, "verification", "") or _UNVERIFIED
                ),
                depth=int(getattr(evidence, "depth", 0) or 0),
                sources=tuple(sources),
            )
        )
    open_questions = _unique_questions(
        list(getattr(report, "gap_questions", ()) or ())
        + list(getattr(report, "limitations", ()) or ())
    )
    return InvestigationLedger(
        entries=tuple(entries),
        open_questions=open_questions,
        crosscheck=tuple(getattr(report, "crosscheck", ()) or ()),
        limitations=_unique_questions(getattr(report, "limitations", ()) or ()),
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
