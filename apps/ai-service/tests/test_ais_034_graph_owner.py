# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AIS-034 回归:知识图谱四个端点的 owner 必须取自认证主体,而不是客户端请求头。

票面攻击面:任意登录用户带 `X-Owner-Uuid: <受害者>` 即可读/覆盖/清空他人图谱;
无该头时全站共用 `anonymous` 命名空间。HEAD 已把 4 个端点统一为
`Depends(require_request_user_id)`,本文件钉住它不被改回去:

  * GET /data、POST /build、DELETE /data 都忽略伪造的 `X-Owner-Uuid`,store 只收到主体;
  * 无请求头时 owner 仍是主体,绝不出现 `anonymous`;
  * 未认证一律 401。

零磁盘:graph_store 的读写方法与抽取服务全部 monkeypatch,断言只看调用参数。
"""

from __future__ import annotations

from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1 import knowledge_graph as kg_mod
from app.core.config import settings
from app.core.jwt_auth import require_request_user_id

FORGED_HEADER = {"X-Owner-Uuid": "user-b"}


def _client_as(principal: str) -> TestClient:
    """构造只挂知识图谱路由的应用,并把认证依赖覆盖为指定主体。"""
    app = FastAPI()
    app.include_router(kg_mod.router, prefix="/api")

    async def _principal() -> str:
        return principal

    app.dependency_overrides[require_request_user_id] = _principal
    return TestClient(app)


@pytest.fixture
def store_calls(monkeypatch: pytest.MonkeyPatch) -> dict[str, list[Any]]:
    """接管 graph_store 与抽取服务,只记录 owner,不触真实存储/磁盘。"""
    calls: dict[str, list[Any]] = {
        "get_graph": [],
        "clear": [],
        "upsert_entity": [],
        "upsert_relation": [],
        "extract": [],
    }

    async def _get_graph(owner: str) -> dict[str, list[Any]]:
        calls["get_graph"].append(owner)
        return {"entities": [], "relations": []}

    async def _clear(owner: str) -> None:
        calls["clear"].append(owner)

    async def _upsert_entity(
        *,
        owner_uuid: str,
        name: str,
        entity_type: str,
        description: str | None = None,
        doc_id: int | None = None,
    ) -> dict[str, Any]:
        calls["upsert_entity"].append(owner_uuid)
        return {"id": name}

    async def _upsert_relation(
        *,
        owner_uuid: str,
        source_entity_id: Any,
        target_entity_id: Any,
        relation_type: str,
        description: str | None = None,
    ) -> dict[str, Any]:
        calls["upsert_relation"].append(owner_uuid)
        return {"id": 1}

    async def _extract(text: str, owner_uuid: str) -> dict[str, Any]:
        calls["extract"].append(owner_uuid)
        return {
            "entities": [
                {"name": "苹果", "type": "ORG"},
                {"name": "创始人", "type": "PERSON"},
            ],
            "relations": [{"source": "苹果", "target": "创始人", "type": "HAS"}],
            "stub": True,
        }

    monkeypatch.setattr(kg_mod.graph_store, "get_graph", _get_graph)
    monkeypatch.setattr(kg_mod.graph_store, "clear", _clear)
    monkeypatch.setattr(kg_mod.graph_store, "upsert_entity", _upsert_entity)
    monkeypatch.setattr(kg_mod.graph_store, "upsert_relation", _upsert_relation)
    monkeypatch.setattr(
        kg_mod.graph_store,
        "persistence_status",
        lambda: {"backend": "memory", "persistent": False},
    )
    monkeypatch.setattr(kg_mod.knowledge_graph_service, "extract", _extract)
    return calls


def test_ais034_get_data_ignores_forged_owner_header(
    store_calls: dict[str, list[Any]],
) -> None:
    with _client_as("user-a") as client:
        resp = client.get("/api/data", headers=FORGED_HEADER)

    assert resp.status_code == 200
    assert resp.json()["data"]["owner_uuid"] == "user-a"
    assert store_calls["get_graph"] == ["user-a"]


def test_ais034_build_uses_subject_not_header(store_calls: dict[str, list[Any]]) -> None:
    with _client_as("user-a") as client:
        resp = client.post(
            "/api/build", headers=FORGED_HEADER, json={"text": "苹果 公司 创始人"}
        )

    assert resp.status_code == 200
    assert resp.json()["code"] == 0
    assert store_calls["extract"] == ["user-a"]
    assert store_calls["upsert_entity"] == ["user-a", "user-a"]
    assert store_calls["upsert_relation"] == ["user-a"]


def test_ais034_delete_data_uses_subject_not_header(
    store_calls: dict[str, list[Any]],
) -> None:
    with _client_as("user-a") as client:
        resp = client.delete("/api/data", headers=FORGED_HEADER)

    assert resp.status_code == 200
    assert resp.json()["data"]["owner_uuid"] == "user-a"
    assert store_calls["clear"] == ["user-a"]


def test_ais034_no_header_never_falls_back_to_anonymous(
    store_calls: dict[str, list[Any]],
) -> None:
    with _client_as("user-a") as client:
        resp = client.get("/api/data")

    assert resp.status_code == 200
    assert resp.json()["data"]["owner_uuid"] == "user-a"
    assert store_calls["get_graph"] == ["user-a"]
    assert "anonymous" not in store_calls["get_graph"]


@pytest.mark.parametrize(
    ("method", "path", "kwargs"),
    [
        ("get", "/api/data", {}),
        ("delete", "/api/data", {}),
        ("post", "/api/build", {"json": {"text": "任意文本"}}),
    ],
)
def test_ais034_unauthenticated_401_even_with_forged_header(
    monkeypatch: pytest.MonkeyPatch,
    method: str,
    path: str,
    kwargs: dict[str, Any],
) -> None:
    monkeypatch.setattr(settings, "ai_dev_no_auth", False)

    app = FastAPI()
    app.include_router(kg_mod.router, prefix="/api")
    with TestClient(app) as client:
        resp = getattr(client, method)(path, headers=FORGED_HEADER, **kwargs)

    assert resp.status_code == 401
