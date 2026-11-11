"""AIS-033 回归:POST /api/v1/ai/rag 两路召回都必须按认证主体裁剪。

票面缺陷:端点不解析主体,`_vector_retrieve` 调 `vector_memory.search(...)` 不传
user_id(全量检索)、关键字路按全量 `list_sessions()` 聚合,`sources.content` 原样
返回 ⇒ 任何登录用户都能读到他人上传的文档/会话片段。

本文件钉四件事:
① 主体 A 调用 ⇒ `vector_memory.search` / `memory_store.list_sessions` 收到 user_id=A,
   且即使下层替身返回 A+B 混合条目,`sources` 也只含 A 的文档;
② 主体 A 传 `session_id="<B>:x"` ⇒ 403,且检索一次都不发生;
③ 未认证 ⇒ 401,且检索一次都不发生;
④ 不连真实向量库/记忆库/LLM,全部替身。

身份模拟:HEAD 的端点用 `await require_request_user_id(request)` 直接读
`request.state.user_id`(不是 `Depends`),故 `dependency_overrides` 不生效;
这里用 ASGI 中间件按请求头注入主体,走的是与 JWT 中间件同一条 `request.state`
通道(与 tests/test_ais_032_chat_identity.py 同范式)。
"""

from __future__ import annotations

from typing import Any

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from app.api.v1 import rag as rag_api
from app.core.config import settings
from app.services import rag as rag_mod
from app.services.memory import memory_store
from app.services.vector_memory import vector_memory

USER_A = "user-a-rag-scope"
USER_B = "user-b-rag-scope"
TEST_SECRET = "test-jwt-secret-for-ais-033-only"


def _make_app() -> FastAPI:
    """最小 app + 主体注入中间件(等价 JWT 中间件写 request.state.user_id)。"""
    app = FastAPI()

    @app.middleware("http")
    async def _inject_principal(request: Request, call_next):
        user_id = request.headers.get("x-test-user")
        if user_id:
            request.state.user_id = user_id
        return await call_next(request)

    app.include_router(rag_api.router, prefix="/api/v1/ai")
    return app


@pytest.fixture(autouse=True)
def _enforce_jwt(monkeypatch: pytest.MonkeyPatch) -> None:
    """钉死真实密钥:关闭 dev 降级,未带主体必须 401 而不是落成 dev-anonymous。"""
    monkeypatch.setattr(settings, "jwt_secret", TEST_SECRET)
    monkeypatch.setattr(settings, "ai_dev_no_auth", False)


@pytest.fixture()
def spy(monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
    """接管向量/记忆/生成链路,只记录收到的入参与返回的 sources。"""
    spy: dict[str, Any] = {}

    async def _embed(_text: str) -> list[float]:
        return [0.1, 0.2, 0.3]

    async def _search(**kwargs: Any) -> list[tuple[str, dict[str, Any], float]]:
        spy["search"] = kwargs
        return spy.get("search_result", [])

    async def _list_sessions(**kwargs: Any) -> list[str]:
        spy["list_sessions"] = kwargs
        return []

    async def _get(_sid: str, **kwargs: Any) -> list[dict[str, Any]]:
        spy["memory_get"] = kwargs
        return []

    async def _sag2(*_args: Any, **_kwargs: Any) -> list[Any]:
        return []

    async def _generate(*_args: Any, **_kwargs: Any) -> tuple[str, str, bool]:
        return "ok", "stub", True

    monkeypatch.setattr(vector_memory, "embed", _embed)
    monkeypatch.setattr(vector_memory, "search", _search)
    monkeypatch.setattr(memory_store, "list_sessions", _list_sessions)
    monkeypatch.setattr(memory_store, "get", _get)
    monkeypatch.setattr(rag_mod.rag_service, "_sag2_retrieve", _sag2)
    monkeypatch.setattr(rag_mod.rag_service, "_generate", _generate)
    return spy


def test_search_receives_subject_and_mixed_results_are_filtered(
    spy: dict[str, Any],
) -> None:
    """A 调用 ⇒ 两路都收到 user_id=A;替身混入 B 的条目也不得出现在 sources。"""
    spy["search_result"] = [
        (
            "a-1",
            {
                "user_id": USER_A,
                "session_id": f"{USER_A}:s1",
                "role": "user",
                "content": "A-ONLY 文档",
                "timestamp": "t1",
            },
            0.91,
        ),
        (
            "b-1",
            {
                "user_id": USER_B,
                "session_id": f"{USER_B}:s1",
                "role": "user",
                "content": "B-SECRET 文档",
                "timestamp": "t2",
            },
            0.99,
        ),
    ]

    with TestClient(_make_app()) as client:
        resp = client.post(
            "/api/v1/ai/rag",
            headers={"x-test-user": USER_A},
            json={"query": "文档", "top_k": 5},
        )

    assert resp.status_code == 200
    assert resp.json()["code"] == 0
    # 向量路:search 必须收到认证主体(文档明确 HTTP 端点不得传 None)
    assert spy["search"]["user_id"] == USER_A
    # 关键字路:list_sessions 同样按主体裁剪,而不是全量
    assert spy["list_sessions"]["user_id"] == USER_A

    sources = resp.json()["data"]["sources"]
    assert [s["content"] for s in sources] == ["A-ONLY 文档"]
    assert all("B-SECRET" not in s["content"] for s in sources)


def test_foreign_session_id_is_403_and_never_searches(spy: dict[str, Any]) -> None:
    """A 传 `B:x` ⇒ 403;session_id 是过滤器,不是身份,校验必须先于任何检索。"""
    with TestClient(_make_app()) as client:
        resp = client.post(
            "/api/v1/ai/rag",
            headers={"x-test-user": USER_A},
            json={"query": "文档", "session_id": f"{USER_B}:x"},
        )

    assert resp.status_code == 403
    assert "search" not in spy
    assert "list_sessions" not in spy


def test_unauthenticated_is_401_and_never_searches(spy: dict[str, Any]) -> None:
    """无主体 ⇒ 401;白名单/中间件配错也不得落成全量检索。"""
    with TestClient(_make_app()) as client:
        resp = client.post("/api/v1/ai/rag", json={"query": "文档"})

    assert resp.status_code == 401
    assert "search" not in spy
    assert "list_sessions" not in spy
