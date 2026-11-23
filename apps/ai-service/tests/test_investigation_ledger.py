# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""调查台账纯函数测试。"""
from __future__ import annotations

from app.core.investigation_ledger import build_investigation_ledger
from app.services.deep_research import EvidenceUnit, ResearchReport, SourceRef


def _source(url: str, title: str = "") -> SourceRef:
    return SourceRef(url=url, title=title or url, tier="authoritative", verified=True)


def _report() -> ResearchReport:
    return ResearchReport(
        research_id="r-1",
        query="q",
        evidence=[
            EvidenceUnit(
                question="问题一",
                content="结论一",
                sources=[_source("https://a.example/1"), _source("https://a.example/1"), _source("https://b.example/2")],
                depth=0,
                verification="corroborated",
            ),
            EvidenceUnit(
                question="问题二",
                content="结论二",
                sources=[_source("https://c.example/3")],
                depth=1,
                verification="single_source",
            ),
            EvidenceUnit(
                question="问题三",
                content="结论三",
                sources=[_source("https://d.example/4"), _source("https://e.example/5")],
                depth=1,
                verification="conflicting",
            ),
            EvidenceUnit(question="问题四", content="无来源", sources=[], verification="unverified"),
        ],
        gap_questions=["缺 A", "缺 A", "缺 B"],
        limitations=["缺 B", "单源待核"],
        crosscheck=[{"entry": 1, "status": "corroborated"}],
    )


def test_ledger_projects_entries_and_counts() -> None:
    ledger = build_investigation_ledger(_report())
    assert [entry.entry_id for entry in ledger.entries] == ["ev-1", "ev-2", "ev-3", "ev-4"]
    assert ledger.verified == 1
    assert ledger.contested == 1
    assert ledger.unverified == 1
    assert ledger.entries[0].sources == (
        {
            "url": "https://a.example/1",
            "title": "https://a.example/1",
            "tier": "authoritative",
            "verified": True,
            "note": "",
        },
        {
            "url": "https://b.example/2",
            "title": "https://b.example/2",
            "tier": "authoritative",
            "verified": True,
            "note": "",
        },
    )


def test_ledger_open_questions_dedupe_and_merge_limitations() -> None:
    ledger = build_investigation_ledger(_report())
    assert ledger.open_questions == ("缺 A", "缺 B", "单源待核")
    assert ledger.limitations == ("缺 B", "单源待核")


def test_ledger_as_dict_is_stable_and_total_is_derived() -> None:
    data = build_investigation_ledger(_report()).as_dict()
    assert data["total"] == 4
    assert data["verified"] == 1
    assert data["contested"] == 1
    assert data["unverified"] == 1
    assert data["entries"][3]["sources"] == []
    assert data["crosscheck"] == [{"entry": 1, "status": "corroborated"}]
    assert data["openQuestions"] == ["缺 A", "缺 B", "单源待核"]


def test_empty_report_is_zero_not_fabricated() -> None:
    data = build_investigation_ledger(ResearchReport(research_id="r-0", query="q")).as_dict()
    assert data["total"] == 0
    assert data["verified"] == 0
    assert data["contested"] == 0
    assert data["unverified"] == 0
    assert data["entries"] == []
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
