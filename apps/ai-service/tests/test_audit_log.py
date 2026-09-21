# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""操作审计日志测试(JSON 文件持久化 + 环形截断 + 查询过滤,tmp_path 隔离)。"""

from __future__ import annotations

import json

from app.services.audit_log import AuditLogStore


def _store(tmp_path, name="audit_logs.json", limit=None):
    kwargs = {"file_path": tmp_path / name}
    if limit is not None:
        kwargs["limit"] = limit
    return AuditLogStore(**kwargs)


def test_record_and_persist(tmp_path):
    """写入后 JSON 文件包含条目;重载 store 可从文件恢复。"""
    s = _store(tmp_path)
    e = s.record("run.cancel", "user-1", "session-42", {"reason": "manual"})
    assert e.id and e.created_at.endswith("Z")
    raw = json.loads((tmp_path / "audit_logs.json").read_text(encoding="utf-8"))
    assert len(raw) == 1
    assert raw[0]["action"] == "run.cancel"
    assert raw[0]["detail"] == {"reason": "manual"}

    # 新实例从同一文件懒加载
    s2 = _store(tmp_path)
    data = s2.query()
    assert data["total"] == 1
    assert data["list"][0]["actor"] == "user-1"


def test_ring_truncation_drops_oldest(tmp_path):
    """超过 limit 丢最旧,保留最新。"""
    s = _store(tmp_path, limit=5)
    for i in range(8):
        s.record("act", "u", target=f"t{i}")
    data = s.query(page_size=100)
    assert data["total"] == 5
    targets = [item["target"] for item in data["list"]]  # 新→旧
    assert targets == ["t7", "t6", "t5", "t4", "t3"]
    # 落盘文件同样只有 5 条
    raw = json.loads((tmp_path / "audit_logs.json").read_text(encoding="utf-8"))
    assert len(raw) == 5


def test_query_filters_and_pagination(tmp_path):
    s = _store(tmp_path)
    s.record("a.create", "alice", "r1")
    s.record("a.delete", "bob", "r2")
    s.record("a.create", "bob", "r3")

    by_actor = s.query(actor="bob")
    assert by_actor["total"] == 2
    by_action = s.query(action="a.create")
    assert by_action["total"] == 2
    combo = s.query(actor="bob", action="a.create")
    assert combo["total"] == 1
    assert combo["list"][0]["target"] == "r3"

    page2 = s.query(page=2, page_size=2)
    assert page2["total"] == 3
    assert len(page2["list"]) == 1
    # 新→旧排序:第一页首条是最新的 a.create/bob/r3
    first = s.query(page_size=2)["list"][0]
    assert first["target"] == "r3"


def test_detail_truncated_when_oversize(tmp_path):
    """超大 detail 截断为 {"truncated": ...},防撑爆文件。"""
    s = _store(tmp_path)
    big = {"blob": "x" * 10_000}
    e = s.record("act", "u", "t", big)
    assert "truncated" in e.detail
    assert len(json.dumps(e.detail)) < 5_000


def test_corrupt_file_degrades_to_empty(tmp_path):
    """损坏 JSON 静默降级为空存储,不抛异常。"""
    p = tmp_path / "audit_logs.json"
    p.write_text("{not-json!!", encoding="utf-8")
    s = AuditLogStore(file_path=p)
    assert s.query()["total"] == 0
    s.record("act", "u")  # 写路径仍可用并覆盖文件
    assert s.query()["total"] == 1


def test_field_length_capped(tmp_path):
    """action/actor/target 超长截断到 FIELD_LIMIT。"""
    s = _store(tmp_path)
    e = s.record("x" * 500, "y" * 500, "z" * 500)
    assert len(e.action) == 200
    assert len(e.actor) == 200
    assert len(e.target) == 200
