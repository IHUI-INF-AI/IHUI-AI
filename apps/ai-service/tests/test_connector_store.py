# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""connector_store 持久化层测试(2026-09-02 立,P2-2;2026-09-28 落属主 G-371)。

覆盖:save/get/覆盖/remove/set_enabled/set_sync_state/JSON 损坏降级,以及
**属主隔离**的成对用例 —— 同属主必须照旧可用(否则本门只是把功能改坏了),
跨属主必须与"没这条"同形,且同名 key 在两个属主下各自成条、互不覆盖。
存储路径 monkeypatch 到 tmp_path,不污染真实 data/connector_store.json。
"""

from __future__ import annotations

import json

import pytest

import app.services.connector_store as store

A = "user-a"
B = "user-b"


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
    assert store.save(A, rec) is rec
    got = store.get(A, "yuque:docs")
    assert got is not None
    assert got["key"] == "yuque:docs"
    assert got["owner_user_id"] == A  # 属主由承载层入参盖章,不是记录里自带的
    assert got["extra"] == {"user": "yuque", "repo": "developer"}
    # 返回的是副本,修改不影响持久化
    got["name"] = "改"
    assert store.get(A, "yuque:docs")["name"] == "语雀文档库"


def test_save_overwrite_same_key(isolated_store):
    store.save(A, _record())
    rec2 = _record()
    rec2["name"] = "覆盖后名称"
    assert store.save(A, rec2) is rec2
    recs = store.list_owned(A)
    assert len(recs) == 1
    assert recs[0]["name"] == "覆盖后名称"


def test_same_key_two_owners_do_not_overwrite(isolated_store):
    """同名 key 在两个属主下各自成条 —— 否则"我保存一下"就把别人的配置换掉了。"""
    mine = _record()
    mine["name"] = "A 的语雀"
    theirs = _record()
    theirs["name"] = "B 的语雀"
    store.save(A, mine)
    store.save(B, theirs)
    assert store.get(A, "yuque:docs")["name"] == "A 的语雀"
    assert store.get(B, "yuque:docs")["name"] == "B 的语雀"
    assert len(store.list_owned(A)) == 1
    assert len(store.list_owned(B)) == 1


def test_cross_owner_is_shaped_like_missing(isolated_store):
    """越权面与"没这条"逐字同形,且**副作用没发生**(别人的记录一字未动)。"""
    store.save(A, _record())
    assert store.get(B, "yuque:docs") is None
    assert store.list_owned(B) == []
    assert store.set_enabled(B, "yuque:docs", False) is None
    assert store.set_sync_state(B, "yuque:docs", "", "x") is None
    assert store.remove(B, "yuque:docs") is False
    untouched = store.get(A, "yuque:docs")
    assert untouched is not None and untouched["enabled"] is True
    assert untouched["last_error"] == ""


def test_ownerless_record_is_visible_to_nobody(isolated_store):
    """历史遗留、无属主的记录不列给任何人,但条数能被量到(不静默消失)。"""
    legacy = _record(key="feishu:legacy")
    isolated_store.write_text(json.dumps([legacy], ensure_ascii=False), encoding="utf-8")
    assert store.list_owned(A) == []
    assert store.list_owned(B) == []
    assert store.get(A, "feishu:legacy") is None
    assert store.ownerless_count() == 1


def test_empty_owner_is_not_an_implicit_wildcard(isolated_store):
    store.save(A, _record())
    assert store.list_owned("") == []
    assert store.get("", "yuque:docs") is None
    assert store.save("", _record(key="x:y")) is None
    assert store.remove("", "yuque:docs") is False


def test_remove(isolated_store):
    assert store.remove(A, "yuque:docs") is False  # 不存在返回 False
    store.save(A, _record())
    assert store.remove(A, "yuque:docs") is True
    assert store.list_owned(A) == []
    assert store.get(A, "yuque:docs") is None


def test_set_enabled(isolated_store):
    assert store.set_enabled(A, "yuque:docs", False) is None  # 不存在返回 None
    store.save(A, _record())
    updated = store.set_enabled(A, "yuque:docs", False)
    assert updated is not None
    assert updated["enabled"] is False
    assert updated["updated_at"]  # 时间戳已刷新
    assert store.get(A, "yuque:docs")["enabled"] is False


def test_set_sync_state(isolated_store):
    assert store.set_sync_state(A, "yuque:docs", "2026-09-02T00:00:00+00:00", "") is None
    store.save(A, _record())
    updated = store.set_sync_state(A, "yuque:docs", "2026-09-02T00:00:00+00:00", "")
    assert updated is not None
    assert updated["last_sync_at"] == "2026-09-02T00:00:00+00:00"
    assert updated["last_error"] == ""
    failed = store.set_sync_state(A, "yuque:docs", "", "网络超时")
    assert failed is not None
    assert failed["last_error"] == "网络超时"


def test_json_corrupted_returns_empty(isolated_store):
    isolated_store.write_text("{ 这不是合法 JSON", encoding="utf-8")
    assert store.list_owned(A) == []
    assert store.get(A, "yuque:docs") is None


def test_non_list_json_returns_empty(isolated_store):
    isolated_store.write_text(json.dumps({"a": 1}), encoding="utf-8")
    assert store.list_owned(A) == []
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
