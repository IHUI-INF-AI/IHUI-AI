# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

from app.core.jwt_auth import require_request_user_id
from app.routers import connectors as connectors_router
from app.services import connector_store

# 两个固定主体:端点侧的身份由承载层注入,测试用 dependency_overrides 显式给,
# 不去依赖"开发降级单一身份" —— 那会让"没传身份"这一型在测试里永远测不出来。
USER_A = "user-a"
USER_B = "user-b"


def _app_for(owner: str, monkeypatch, tmp_path, tag: str) -> FastAPI:
    """挂一份只含 connectors 路由的 app,存储按 tag 隔离、身份固定为 owner。"""
    monkeypatch.setattr(connector_store, "_STORE_PATH", tmp_path / f"connector_store-{tag}.json")
    monkeypatch.setattr(connectors_router, "get_connector", lambda t: _FakeConnector() if t == "yuque" else None)
    app = FastAPI()
    app.include_router(connectors_router.router, prefix="/api")
    app.dependency_overrides[require_request_user_id] = lambda: owner
    return app


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
    """只挂载 connectors 路由的 FastAPI app;存储路径隔离到 tmp_path,身份固定为 USER_A。"""
    return _app_for(USER_A, monkeypatch, tmp_path, "main")


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
    # 落库字段仍保留明文(供同步时使用),并带上承载层注入的属主
    stored = connector_store.get(USER_A, "yuque:docs")
    assert stored is not None
    assert stored["app_secret"] == "super-secret"
    assert stored["owner_user_id"] == USER_A


async def test_config_invalid_type_400(ac):
    res = await ac.post("/api/connectors/config", json=_config_body(type="notion"))
    assert res.status_code == 400
    assert "不支持" in res.json()["error"]


async def test_config_empty_secret_keeps_old(ac):
    await ac.post("/api/connectors/config", json=_config_body(app_secret="old-secret"))
    res = await ac.post("/api/connectors/config", json=_config_body(app_secret=""))
    assert res.status_code == 200
    stored = connector_store.get(USER_A, "yuque:docs")
    assert stored["app_secret"] == "old-secret"


async def test_config_update_keeps_extra_and_sync_state(ac):
    await ac.post("/api/connectors/config", json=_config_body())
    connector_store.set_sync_state(
        USER_A, "yuque:docs", "2026-09-02T00:00:00+00:00", "", items=[{"doc_id": "a", "title": "A"}]
    )
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
    stored = connector_store.get(USER_A, "yuque:docs")
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
    assert connector_store.get(USER_A, "yuque:docs") is None


async def test_cross_owner_http_is_shaped_like_missing_and_side_effect_free(
    monkeypatch, tmp_path
):
    """HTTP 级越权:换主体后"看不见、改不动、删不掉",且**别人的记录一字未动**。

    只断言 404 会放过"先改了再抛 404"与"授权判定发生在写库之后"两种写法(AGENTS §5),
    所以每一条越权之后都回读一次 A 名下的记录做逐字段对照。
    两个 app 共用同一份存储分片(tag 相同)—— 否则"看不见"只是因为换了文件,什么也没证明。
    """
    app_a = _app_for(USER_A, monkeypatch, tmp_path, "shared")
    app_b = _app_for(USER_B, monkeypatch, tmp_path, "shared")
    async with (
        AsyncClient(transport=ASGITransport(app=app_a), base_url="http://test") as a,
        AsyncClient(transport=ASGITransport(app=app_b), base_url="http://test") as b,
    ):
        await a.post("/api/connectors/config", json=_config_body(app_secret="s3cret"))
        before = connector_store.get(USER_A, "yuque:docs")
        assert before is not None

        # 列不出来,但形态与"你还没有配置"完全一致(不是 403,不做存在性预言机)
        listed = await b.get("/api/connectors")
        assert listed.status_code == 200
        assert listed.json()["connectors"] == []

        for res in (
            await b.post("/api/connectors/sync", json={"key": "yuque:docs"}),
            await b.post("/api/connectors/yuque:docs/fetch", json={"doc_id": "api"}),
            await b.post("/api/connectors/yuque:docs/enable"),
            await b.post("/api/connectors/yuque:docs/disable"),
            await b.delete("/api/connectors/yuque:docs"),
        ):
            assert res.status_code == 404, res.text
            assert res.json()["error"] == "连接器不存在: yuque:docs"

        after = connector_store.get(USER_A, "yuque:docs")
        assert after == before  # 逐字段等值 ⇒ 越权请求没留下任何副作用

        # 正向对照:B 用同名 key 存自己的配置,不会覆盖 A 的那条(否则会静默丢别人的密钥)
        saved = await b.post("/api/connectors/config", json=_config_body(name="B 的", app_secret="other"))
        assert saved.status_code == 200
        assert connector_store.get(USER_A, "yuque:docs") == before
        assert connector_store.get(USER_B, "yuque:docs")["name"] == "B 的"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
