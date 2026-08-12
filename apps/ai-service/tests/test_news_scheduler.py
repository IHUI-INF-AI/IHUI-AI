"""news_scheduler 纯逻辑单元测试(2026-08-12 立,补齐 0 覆盖)。

覆盖不依赖外部抓取的部分:
- HistoryEntry.to_dict: 历史记录序列化(extra 兜底为 {})
"""

from __future__ import annotations

from app.services.news_scheduler import HistoryEntry


def test_history_entry_to_dict_defaults():
    """extra 为空时序列化兜底为 {}。"""
    e = HistoryEntry(triggered_at="t1", status="success", duration_ms=100)
    d = e.to_dict()
    assert d["triggered_at"] == "t1"
    assert d["status"] == "success"
    assert d["duration_ms"] == 100
    assert d["error"] is None
    assert d["extra"] == {}


def test_history_entry_to_dict_with_error_and_extra():
    """带 error/extra 时完整保留。"""
    e = HistoryEntry(
        triggered_at="t2",
        status="failed",
        duration_ms=200,
        error="boom",
        extra={"reason": "timeout"},
    )
    d = e.to_dict()
    assert d["error"] == "boom"
    assert d["extra"] == {"reason": "timeout"}
