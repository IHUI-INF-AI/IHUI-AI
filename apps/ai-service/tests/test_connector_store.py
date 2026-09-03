# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""connector_store 持久化层测试(2026-09-02 立,P2-2)。

覆盖:save/get/覆盖/remove/set_enabled/set_sync_state/JSON 损坏降级。
存储路径 monkeypatch 到 tmp_path,不污染真实 data/connector_store.json。
"""

from __future__ import annotations

import json

import pytest

import app.services.connector_store as store


@pytest.fixture
def isolated_store(tmp_path, monkeypatch):
    """把存储路径指向临时目录,避免污染真实数据文件。"""
    fake = tmp_path / "connector_store.json"
    monkeypatch.setattr(store, "_STORE_PATH", fake)
    return fake


def _record(key: str = "yuque:docs") -> dict:
    return {
        "key": key,
        "type": "yuque",
        "name": "语雀文档库",
        "app_id": "",
        "app_secret": "",
        "extra": {"user": "yuque", "repo": "developer"},
        "enabled": True,
        "installed_at": store.now_iso(),
        "updated_at": store.now_iso(),
        "last_sync_at": "",
        "last_error": "",
    }


def test_save_and_get(isolated_store):
    rec = _record()
    assert store.save(rec) is rec
    got = store.get("yuque:docs")
    assert got is not None
    assert got["key"] == "yuque:docs"
    assert got["extra"] == {"user": "yuque", "repo": "developer"}
    # 返回的是副本,修改不影响持久化
    got["name"] = "改"
    assert store.get("yuque:docs")["name"] == "语雀文档库"


def test_save_overwrite_same_key(isolated_store):
    store.save(_record())
    rec2 = _record()
    rec2["name"] = "覆盖后名称"
    assert store.save(rec2) is rec2
    recs = store.list_all()
    assert len(recs) == 1
    assert recs[0]["name"] == "覆盖后名称"


def test_remove(isolated_store):
    assert store.remove("yuque:docs") is False  # 不存在返回 False
    store.save(_record())
    assert store.remove("yuque:docs") is True
    assert store.list_all() == []
    assert store.get("yuque:docs") is None


def test_set_enabled(isolated_store):
    assert store.set_enabled("yuque:docs", False) is None  # 不存在返回 None
    store.save(_record())
    updated = store.set_enabled("yuque:docs", False)
    assert updated is not None
    assert updated["enabled"] is False
    assert updated["updated_at"]  # 时间戳已刷新
    assert store.get("yuque:docs")["enabled"] is False


def test_set_sync_state(isolated_store):
    assert store.set_sync_state("yuque:docs", "2026-09-02T00:00:00+00:00", "") is None
    store.save(_record())
    updated = store.set_sync_state("yuque:docs", "2026-09-02T00:00:00+00:00", "")
    assert updated is not None
    assert updated["last_sync_at"] == "2026-09-02T00:00:00+00:00"
    assert updated["last_error"] == ""
    failed = store.set_sync_state("yuque:docs", "", "网络超时")
    assert failed is not None
    assert failed["last_error"] == "网络超时"


def test_json_corrupted_returns_empty(isolated_store):
    isolated_store.write_text("{ 这不是合法 JSON", encoding="utf-8")
    assert store.list_all() == []
    assert store.get("yuque:docs") is None


def test_non_list_json_returns_empty(isolated_store):
    isolated_store.write_text(json.dumps({"a": 1}), encoding="utf-8")
    assert store.list_all() == []
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
