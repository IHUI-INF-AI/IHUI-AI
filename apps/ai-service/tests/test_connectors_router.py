# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""Connectors 路由端点测试(2026-09-02 立,P2-2)。

覆盖:
- GET    /api/connectors               列表(空 + 保存后脱敏)
- POST   /api/connectors/config        保存 + 脱敏 + app_secret 空串保留旧值 + 非法 type 400
- POST   /api/connectors/sync          未配置 400 / 未知 key 404 / 成功路径(落 last_sync_at + sync_items)
- POST   /api/connectors/{key}/fetch   成功 / 空 doc_id 400 / 未知 key 404
- POST   /api/connectors/{key}/enable|disable
- DELETE /api/connectors/{key}         404 / 成功

隔离策略:独立 FastAPI app 只挂载 connectors 路由;monkeypatch connector_store
存储路径到 tmp_path;sync/fetch 用 fake connector 模块避免真网。
"""

from __future__ import annotations

from typing import Any

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.routers import connectors as connectors_router
from app.services import connector_store


class _FakeConnector:
    """fake connector 模块:sync/fetch_document 返回固定结果。"""

    async def sync(self, record: dict[str, Any]) -> dict[str, Any]:
        return {
            "ok": True,
            "message": "找到 2 篇文档",
            "items": [
                {"doc_id": "api", "title": "Overview"},
                {"doc_id": "start", "title": "开始使用"},
            ],
            "last_sync_at": "2026-09-02T00:00:00+00:00",
        }

    async def fetch_document(self, record: dict[str, Any], doc_id: str) -> dict[str, Any]:
        return {
            "ok": True,
            "title": "Overview",
            "content": "正文内容",
            "chars": 4,
            "truncated": False,
            "message": "正文 4 字符",
        }


@pytest.fixture
def api_app(monkeypatch, tmp_path):
    """只挂载 connectors 路由的 FastAPI app;存储路径隔离到 tmp_path。"""
    monkeypatch.setattr(connector_store, "_STORE_PATH", tmp_path / "connector_store.json")
    monkeypatch.setattr(connectors_router, "get_connector", lambda t: _FakeConnector() if t == "yuque" else None)
    app = FastAPI()
    app.include_router(connectors_router.router, prefix="/api")
    return app


@pytest.fixture
async def ac(api_app):
    """httpx 异步客户端。"""
    async with AsyncClient(
        transport=ASGITransport(app=api_app), base_url="http://test"
    ) as client:
        yield client


def _config_body(**overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "key": "yuque:docs",
        "type": "yuque",
        "name": "语雀文档库",
        "app_id": "",
        "app_secret": "",
        "extra": {"user": "yuque", "repo": "developer"},
    }
    body.update(overrides)
    return body


async def test_list_empty(ac):
    res = await ac.get("/api/connectors")
    assert res.status_code == 200
    data = res.json()
    assert data["connectors"] == []
    assert data["count"] == 0


async def test_config_save_and_mask_secret(ac):
    res = await ac.post("/api/connectors/config", json=_config_body(app_secret="super-secret"))
    assert res.status_code == 200
    item = res.json()
    assert item["key"] == "yuque:docs"
    assert item["configured"] is True
    assert "app_secret" not in item  # 脱敏:绝不返回明文
    assert "app_id" not in item
    assert item["extra"] == {"user": "yuque", "repo": "developer"}
    # 落库字段仍保留明文(供同步时使用)
    stored = connector_store.get("yuque:docs")
    assert stored is not None
    assert stored["app_secret"] == "super-secret"


async def test_config_invalid_type_400(ac):
    res = await ac.post("/api/connectors/config", json=_config_body(type="notion"))
    assert res.status_code == 400
    assert "不支持" in res.json()["error"]


async def test_config_empty_secret_keeps_old(ac):
    await ac.post("/api/connectors/config", json=_config_body(app_secret="old-secret"))
    res = await ac.post("/api/connectors/config", json=_config_body(app_secret=""))
    assert res.status_code == 200
    stored = connector_store.get("yuque:docs")
    assert stored["app_secret"] == "old-secret"


async def test_config_update_keeps_extra_and_sync_state(ac):
    await ac.post("/api/connectors/config", json=_config_body())
    connector_store.set_sync_state("yuque:docs", "2026-09-02T00:00:00+00:00", "", items=[{"doc_id": "a", "title": "A"}])
    res = await ac.post("/api/connectors/config", json=_config_body(name="改名"))
    assert res.status_code == 200
    item = res.json()
    assert item["name"] == "改名"
    assert item["last_sync_at"] == "2026-09-02T00:00:00+00:00"
    assert item["sync_items"] == [{"doc_id": "a", "title": "A"}]


async def test_list_after_save(ac):
    await ac.post("/api/connectors/config", json=_config_body())
    res = await ac.get("/api/connectors")
    data = res.json()
    assert data["count"] == 1
    item = data["connectors"][0]
    assert item["key"] == "yuque:docs"
    assert item["capabilities"] == {"doc_list": True, "fetch_doc": True}


async def test_sync_unconfigured_400(ac):
    await ac.post("/api/connectors/config", json=_config_body(extra={}, app_id=""))
    res = await ac.post("/api/connectors/sync", json={"key": "yuque:docs"})
    assert res.status_code == 400
    assert "未配置" in res.json()["error"]


async def test_sync_unknown_key_404(ac):
    res = await ac.post("/api/connectors/sync", json={"key": "yuque:none"})
    assert res.status_code == 404


async def test_sync_success_persists_items(ac):
    await ac.post("/api/connectors/config", json=_config_body())
    res = await ac.post("/api/connectors/sync", json={"key": "yuque:docs"})
    assert res.status_code == 200
    data = res.json()
    assert data["ok"] is True
    assert len(data["items"]) == 2
    assert data["last_sync_at"] == "2026-09-02T00:00:00+00:00"
    # 落库:last_sync_at + sync_items 已持久化
    stored = connector_store.get("yuque:docs")
    assert stored["last_sync_at"] == "2026-09-02T00:00:00+00:00"
    assert stored["last_error"] == ""
    assert stored["sync_items"] == [{"doc_id": "api", "title": "Overview"}, {"doc_id": "start", "title": "开始使用"}]


async def test_fetch_document_success(ac):
    await ac.post("/api/connectors/config", json=_config_body())
    res = await ac.post("/api/connectors/yuque:docs/fetch", json={"doc_id": "api"})
    assert res.status_code == 200
    data = res.json()
    assert data["ok"] is True
    assert data["title"] == "Overview"
    assert data["chars"] == 4


async def test_fetch_document_empty_doc_id_400(ac):
    await ac.post("/api/connectors/config", json=_config_body())
    res = await ac.post("/api/connectors/yuque:docs/fetch", json={"doc_id": ""})
    assert res.status_code == 400
    assert "doc_id" in res.json()["error"]


async def test_fetch_document_unknown_key_404(ac):
    res = await ac.post("/api/connectors/yuque:none/fetch", json={"doc_id": "api"})
    assert res.status_code == 404


async def test_enable_disable(ac):
    await ac.post("/api/connectors/config", json=_config_body())
    res = await ac.post("/api/connectors/yuque:docs/disable")
    assert res.status_code == 200
    assert res.json()["enabled"] is False
    res = await ac.post("/api/connectors/yuque:docs/enable")
    assert res.status_code == 200
    assert res.json()["enabled"] is True
    # 未知 key → 404
    res = await ac.post("/api/connectors/yuque:none/enable")
    assert res.status_code == 404


async def test_delete(ac):
    res = await ac.delete("/api/connectors/yuque:none")
    assert res.status_code == 404
    await ac.post("/api/connectors/config", json=_config_body())
    res = await ac.delete("/api/connectors/yuque:docs")
    assert res.status_code == 200
    assert res.json() == {"ok": True}
    assert connector_store.get("yuque:docs") is None
