# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""`/terminals*` 两条读回端点的形状锁(2026-11-21 立)。

钉四件事(每件都是"看起来对、实际错"的高发面):

1. 主体只从承载层取:`x-test-user` 头(等价 JWT 中间件写 `request.state.user_id`),
   端点**不读** query/body 里的任何 userId —— 传了也不生效。
2. 越权与"没这块终端"**同形**(`{"ok": False, "error": "terminal not found"}`),
   不制造成在性预言机。
3. 读回**只读**:`face` 端点不调任何写入口(这里用"没被调用的写函数"证);
   `terminal_face` 被调用时 `user_id`/`session_id` 逐字来自承载层,不带 query 注入。
4. 非 not-found 的失败(如无网格 `TERMINAL_INVALID_INPUT`)如实转达 `errorCode`,不吞成 404。
"""

from __future__ import annotations

from typing import Any

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from app.routers import llm
from app.services import interactive_terminal as term


def _make_app() -> FastAPI:
    app = FastAPI()

    @app.middleware("http")
    async def _inject_principal(request: Request, call_next):
        user_id = request.headers.get("x-test-user")
        if user_id:
            request.state.user_id = user_id
        return await call_next(request)

    app.include_router(llm.router)
    return app


@pytest.fixture()
def client() -> Any:
    with TestClient(_make_app()) as c:
        yield c


def test_list_endpoint_takes_subject_from_token_only(
    client: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    seen: dict[str, Any] = {}

    def _list(*, user_id: str | None, session_id: str | None) -> list[dict[str, Any]]:
        seen["user_id"] = user_id
        seen["session_id"] = session_id
        return [{"terminal_id": "t1", "command": "bash", "running": True}]

    monkeypatch.setattr(term, "list_terminals", _list)
    resp = client.get(
        "/llm/complete/stream/s-term/terminals?user_id=attacker",
        headers={"x-test-user": "u-term"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True and body["count"] == 1
    assert body["terminals"][0]["terminal_id"] == "t1"
    # query 里的 user_id 没有进入归属判定
    assert seen == {"user_id": "u-term", "session_id": "s-term"}


def test_face_endpoint_returns_composed_face(
    client: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    seen: dict[str, Any] = {}
    face = {
        "ok": True,
        "terminal_id": "t1",
        "cols": 80,
        "rows": 24,
        "row": 3,
        "col": 5,
        "screen": ["a", "b", "c"],
        "links": [{"url": "https://x.example", "text": "点我"}],
        "prompt": {"at_prompt": True},
    }

    def _face(terminal_id: str, **kwargs: Any) -> dict[str, Any]:
        seen.update({"terminal_id": terminal_id, **kwargs})
        return face

    monkeypatch.setattr(term, "terminal_face", _face)
    resp = client.get(
        "/llm/complete/stream/s-term/terminals/t1/face?max_links=5",
        headers={"x-test-user": "u-term"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True and body["terminal_id"] == "t1"
    assert body["screen"] == ["a", "b", "c"] and body["row"] == 3
    assert body["sessionId"] == "s-term"
    assert seen == {
        "terminal_id": "t1",
        "user_id": "u-term",
        "session_id": "s-term",
        "max_links": 5,
    }


def test_face_not_found_is_same_shape_as_cross_user(
    client: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    """越权与不存在逐字同形 —— 否则端点成了"某 id 在不在"的探针。"""
    monkeypatch.setattr(
        term,
        "terminal_face",
        lambda *a, **k: {
            "ok": False,
            "errorCode": "TERMINAL_NOT_FOUND",
            "error": "终端不存在或无权访问",
        },
    )
    resp = client.get(
        "/llm/complete/stream/s-term/terminals/t-not-mine/face",
        headers={"x-test-user": "u-other"},
    )
    assert resp.status_code == 200
    assert resp.json() == {"ok": False, "error": "terminal not found"}


def test_face_relays_non_not_found_error_code(
    client: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    """无网格(`TERMINAL_INVALID_INPUT`)不能被吞成 404:那样面板会把"旧会话"读成"没这块"。"""
    monkeypatch.setattr(
        term,
        "terminal_face",
        lambda *a, **k: {
            "ok": False,
            "errorCode": "TERMINAL_INVALID_INPUT",
            "error": "该会话没有屏幕网格(未启用 VT 记账)",
        },
    )
    resp = client.get(
        "/llm/complete/stream/s-term/terminals/t1/face",
        headers={"x-test-user": "u-term"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert body["errorCode"] == "TERMINAL_INVALID_INPUT"
    assert "网格" in body["error"]


def test_face_endpoint_never_calls_a_write_path(
    client: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    """读回端点的硬边界:即使终端活着,这里也不许往子进程写一个字节。"""
    writes: list[str] = []
    for name in ("send_terminal_keys", "paste_terminal", "eof_terminal", "write_terminal"):
        if hasattr(term, name):
            monkeypatch.setattr(
                term, name, lambda *a, _n=name, **k: writes.append(_n) or {"ok": True}
            )
    monkeypatch.setattr(
        term,
        "terminal_face",
        lambda *a, **k: {"ok": True, "terminal_id": "t1", "screen": ["x"]},
    )
    resp = client.get(
        "/llm/complete/stream/s-term/terminals/t1/face",
        headers={"x-test-user": "u-term"},
    )
    assert resp.status_code == 200 and resp.json()["ok"] is True
    assert writes == []
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
