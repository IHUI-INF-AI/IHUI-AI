# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""knowledge_writer 测试(2026-10-31,goal-b43,Qoder Repo Wiki 写工具族对位)。

测试隔离(§5):全程 monkeypatch httpx(不连 api、不连库);身份三态、
读写通道区分(内部 secret vs Bearer)、link 读改写、404 语义。
"""

from __future__ import annotations

from typing import Any

import pytest

from app.services.knowledge_writer import KnowledgeWriter


@pytest.fixture()
def kw(monkeypatch: pytest.MonkeyPatch) -> KnowledgeWriter:
    # 顺序纪律:setenv 必须在实例构造之前 —— __init__ 读 API_SERVICE_URL 定 base
    monkeypatch.setenv("API_SERVICE_URL", "http://api.test")
    monkeypatch.setenv("AI_CALLBACK_SECRET", "test-secret")
    return KnowledgeWriter()


class FakeClient:
    """httpx.AsyncClient 替身:按 (method, path) 路由到应答表。"""

    routes: dict[tuple[str, str], tuple[int, dict[str, Any]]] = {}
    seen: list[tuple[str, str, dict[str, Any] | None, dict[str, str]]] = []

    def __init__(self, **_kw: Any) -> None:
        pass

    async def __aenter__(self) -> "FakeClient":
        return self

    async def __aexit__(self, *a: Any) -> None:
        return None

    async def request(self, method: str, url: str, headers: dict | None = None, json: Any = None) -> Any:
        path = url.replace("http://api.test", "")
        self.seen.append((method, path, json, dict(headers or {})))

        class R:
            def __init__(self, code: int, body: dict) -> None:
                self.status_code = code
                self._body = body

            def json(self) -> dict:
                return self._body

        code, body = self.routes.get((method, path), (404, {}))
        return R(code, body)


@pytest.fixture()
def fake_http(monkeypatch: pytest.MonkeyPatch) -> type[FakeClient]:
    FakeClient.routes = {}
    FakeClient.seen = []
    monkeypatch.setattr("httpx.AsyncClient", FakeClient)
    return FakeClient


UID = "11111111-2222-3333-4444-555555555555"
CID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
CID2 = "99999999-8888-7777-6666-555555555555"


async def test_write_card_internal_channel_shape(kw: KnowledgeWriter, fake_http: type[FakeClient]) -> None:
    fake_http.routes[("POST", "/api/knowledge-cards")] = (201, {"data": {"id": CID}})
    out = await kw.write_card(
        title="登录限流经验", content="每请求限流须走 FAST_FAIL_REDIS_OPTIONS",
        repo_name="IHUI-AI", user_id=UID, tags=["rate-limit"],
    )
    assert fake_http.seen, f"zero requests; routes_keys={list(fake_http.routes.keys())}"
    assert out["status"] == "ok" and out["source"] == "agent", f"out={out} seen={fake_http.seen}"
    method, path, body, headers = fake_http.seen[0]
    assert (method, path) == ("POST", "/api/knowledge-cards")
    assert headers.get("X-Internal-Secret") == "test-secret"
    assert body["userId"] == UID and body["repoName"] == "IHUI-AI"


async def test_identity_three_states(kw: KnowledgeWriter, monkeypatch: pytest.MonkeyPatch, fake_http: type[FakeClient]) -> None:
    monkeypatch.delenv("AI_CALLBACK_SECRET", raising=False)
    out = await kw.write_card(title="t", content="c", repo_name="r", user_id=UID)
    assert out["status"] == "skipped_missing_identity" and "AI_CALLBACK_SECRET" in out["detail"]
    assert fake_http.seen == []  # 身份缺失不发请求

    out2 = await kw.update_card(CID, user_id=UID, api_token=None, title="x")
    assert out2["status"] == "skipped_missing_identity" and "Bearer" in out2["detail"]
    assert fake_http.seen == []


async def test_update_and_delete_bearer_channel(kw: KnowledgeWriter, fake_http: type[FakeClient]) -> None:
    fake_http.routes[("PATCH", f"/api/knowledge-cards/{CID}")] = (200, {"data": {}})
    out = await kw.update_card(CID, user_id=UID, api_token="jwt-1", title="新标题")
    assert out["status"] == "ok" and out["updated_fields"] == ["title"]
    assert fake_http.seen[0][3]["Authorization"] == "Bearer jwt-1"

    fake_http.routes[("DELETE", f"/api/knowledge-cards/{CID}")] = (200, {"data": {}})
    out2 = await kw.delete_card(CID, user_id=UID, api_token="jwt-1")
    assert out2["status"] == "ok" and out2["deleted"] is True


async def test_404_is_card_missing(kw: KnowledgeWriter, fake_http: type[FakeClient]) -> None:
    # 无路由 = 404 兜底
    out = await kw.delete_card(CID, user_id=UID, api_token="jwt-1")
    assert out["status"] == "card_missing"


async def test_link_read_modify_write_and_idempotent(
    kw: KnowledgeWriter, fake_http: type[FakeClient]
) -> None:
    fake_http.routes[("GET", f"/api/knowledge-cards/{CID}")] = (
        200,
        {"data": {"id": CID, "context": {"note": "n", "links": [{"cardId": CID2, "relation": "dup"}]}}},
    )
    fake_http.routes[("PATCH", f"/api/knowledge-cards/{CID}")] = (200, {"data": {}})
    out = await kw.link_cards(CID, CID2, "explains", user_id=UID, api_token="jwt-1")
    assert out["status"] == "ok" and out["action"] == "linked" and out["links"] == 2
    patch_body = fake_http.seen[1][2]
    assert patch_body["context"]["note"] == "n"  # 原字段保真
    assert {"cardId": CID2, "relation": "explains"} in patch_body["context"]["links"]

    # 幂等:同链接再挂 → already,不再 PATCH
    # (服务端 PATCH 成功后已持久化该链接;FakeClient 的 GET 路由模拟持久化后的状态)
    fake_http.routes[("GET", f"/api/knowledge-cards/{CID}")] = (
        200,
        {"data": {"id": CID, "context": {"note": "n", "links": [{"cardId": CID2, "relation": "dup"}, {"cardId": CID2, "relation": "explains"}]}}},
    )
    before = len(fake_http.seen)
    out2 = await kw.link_cards(CID, CID2, "explains", user_id=UID, api_token="jwt-1")
    # already 判定需先 GET 读 context(必需),但不再 PATCH 写
    assert out2["action"] == "already" and len(fake_http.seen) == before + 1
    assert fake_http.seen[-1][0] == "GET"

    # unlink:按 (cardId, relation) 双键删
    out3 = await kw.link_cards(CID, CID2, "dup", user_id=UID, api_token="jwt-1", unlink=True)
    assert out3["action"] == "unlinked" and out3["links"] == 1


async def test_invalid_inputs_never_reach_http(kw: KnowledgeWriter, fake_http: type[FakeClient]) -> None:
    assert (await kw.write_card(title="", content="c", repo_name="r", user_id=UID))["status"] == "invalid_input"
    assert (await kw.write_card(title="t", content="c", repo_name="r", user_id=UID, kind="bogus"))["status"] == "invalid_input"
    assert (await kw.update_card("not-uuid", user_id=UID, api_token="j", title="x"))["status"] == "invalid_input"
    assert (await kw.link_cards(CID, CID2, "bad relation!", user_id=UID, api_token="j"))["status"] == "invalid_input"
    assert fake_http.seen == []
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
