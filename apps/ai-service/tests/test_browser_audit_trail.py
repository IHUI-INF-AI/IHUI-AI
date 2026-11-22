# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""browser_audit_trail 单测 — 钉住四命名空间、before 深拷贝隔离、newest-first、过滤。"""

from __future__ import annotations

from datetime import UTC, datetime

import pytest

from app.services.browser_audit_trail import (
    NAMESPACES,
    BrowserAuditTrail,
    BrowserStateSnapshot,
    ManagementNamespace,
)


def test_namespace_set_matches_codex() -> None:
    assert set(NAMESPACES) == {"windows", "tabs", "tab_groups", "bookmarks"}
    assert len(NAMESPACES) == 4


def test_capture_deep_copies_state() -> None:
    """capture 后外部改动不污染快照。"""
    tabs = [{"id": 1, "url": "https://a.com"}]
    groups = [{"id": 1, "title": "work"}]
    layout = {"tabs": tabs, "groups": groups}
    snap = BrowserStateSnapshot.capture(tab_layout=layout)
    # 修改原数据
    tabs.append({"id": 2, "url": "https://evil.com"})
    groups.append({"id": 2, "title": "bad"})
    layout["tabs"] = tabs
    # 快照不受影响
    assert len(snap.tab_layout["tabs"]) == 1
    assert snap.tab_layout["tabs"][0]["url"] == "https://a.com"
    assert len(snap.tab_layout["groups"]) == 1


def test_record_valid_namespace() -> None:
    trail = BrowserAuditTrail()
    snap = BrowserStateSnapshot.capture(tab_layout={"tabs": [{"id": 1}]})
    outcome = trail.record(
        method="tab.move",
        namespace=ManagementNamespace.TABS,
        args={"tab_id": 1, "index": 0},
        result={"ok": True},
        before=snap,
    )
    assert outcome.recorded is True
    assert outcome.reason == "ok"
    assert len(trail) == 1


def test_record_rejects_empty_method() -> None:
    trail = BrowserAuditTrail()
    outcome = trail.record(method="", namespace="tabs")
    assert outcome.recorded is False
    assert "method" in outcome.reason


def test_record_rejects_invalid_namespace() -> None:
    trail = BrowserAuditTrail()
    outcome = trail.record(method="tab.close", namespace="invalid_ns")
    assert outcome.recorded is False
    assert "封闭集" in outcome.reason


def test_audit_trail_newest_first() -> None:
    times = iter([
        datetime(2026, 1, 1, 12, 0, 0, tzinfo=UTC),
        datetime(2026, 1, 1, 12, 0, 1, tzinfo=UTC),
        datetime(2026, 1, 1, 12, 0, 2, tzinfo=UTC),
    ])
    trail = BrowserAuditTrail(clock=lambda: next(times))
    trail.record(method="op1", namespace="windows", before=BrowserStateSnapshot())
    trail.record(method="op2", namespace="tabs", before=BrowserStateSnapshot())
    trail.record(method="op3", namespace="bookmarks", before=BrowserStateSnapshot())
    entries = trail.get_audit_trail()
    assert entries[0].method == "op3"  # newest first
    assert entries[1].method == "op2"
    assert entries[2].method == "op1"


def test_audit_trail_namespace_filter() -> None:
    trail = BrowserAuditTrail()
    trail.record(method="window.create", namespace="windows", before=BrowserStateSnapshot())
    trail.record(method="tab.move", namespace="tabs", before=BrowserStateSnapshot())
    trail.record(method="bookmark.add", namespace="bookmarks", before=BrowserStateSnapshot())
    tabs_only = trail.get_audit_trail(namespace=ManagementNamespace.TABS)
    assert len(tabs_only) == 1
    assert tabs_only[0].method == "tab.move"
    assert tabs_only[0].namespace == "tabs"


def test_audit_trail_limit() -> None:
    trail = BrowserAuditTrail()
    for i in range(10):
        trail.record(method=f"op{i}", namespace="tabs", before=BrowserStateSnapshot())
    entries = trail.get_audit_trail(limit=3)
    assert len(entries) == 3
    assert entries[0].method == "op9"  # newest first within limit


def test_audit_trail_before_stored() -> None:
    snap = BrowserStateSnapshot.capture(
        windows=[{"id": 1, "title": "main"}],
        bookmarks=[{"id": 1, "url": "https://example.com"}],
    )
    trail = BrowserAuditTrail()
    trail.record(
        method="tab.move",
        namespace="tabs",
        args={"tab_id": 5},
        before=snap,
    )
    entry = trail.get_audit_trail()[0]
    d = entry.to_dict()
    assert d["before"]["windows"] == [{"id": 1, "title": "main"}]
    assert d["before"]["bookmarks"] == [{"id": 1, "url": "https://example.com"}]
    assert d["args"] == {"tab_id": 5}
    assert d["method"] == "tab.move"


def test_to_dict_shape() -> None:
    snap = BrowserStateSnapshot.capture(tab_layout={"tabs": [], "groups": []})
    trail = BrowserAuditTrail()
    trail.record(
        method="bookmark.create",
        namespace="bookmarks",
        args={"url": "https://x.com"},
        result={"id": 42},
        before=snap,
    )
    d = trail.get_audit_trail()[0].to_dict()
    assert set(d.keys()) == {"method", "namespace", "args", "result", "created_at", "before"}
    assert d["result"] == {"id": 42}
    assert "created_at" in d
    assert isinstance(d["created_at"], str)


if __name__ == "__main__":
    pytest.main([__file__, "-q"])
