"""AIS-001 回归:主对话流把 provider 中途 error 事件当成功收尾。

票面缺陷:`POST /llm/complete/stream` 的 `gen()` 只处理 chunk/reasoning/
tool_calls/done,上游在已输出 chunk 后 `yield {"type":"error"}` 会落入兜底
`yield _sse(event_type, event)` 后继续循环;provider 耗尽后按成功收尾,
客户端 200 + 无 done 终帧,后端把半截回复当成功落库。

HEAD 已修(commit cdc5a9547c8:error 分支写回 accumulated 并 return;finally
的中断补发判据认 error)。本文件补回归,钉三件事:

① 中途 error ⇒ 客户端收到 error 终帧(无 done),落库走失败/中断通道而非成功;
② 带 agent tools 的第一轮工具循环同样不得按成功落库;
③ 正常流帧序与 ok 落库行为不变(含 usage 记录不被吞)。

provider 流用 monkeypatch 假造(先 chunk 再 error / chunk + done),不连
外网/DB;`_fire_callback` 整体替换为记录器,只观察落库载荷。
"""

from __future__ import annotations

import json
import time
from typing import Any

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from app.routers import llm as llm_mod

_STREAM_URL = "/llm/complete/stream"
_USER = "u-ais001"


def _make_app() -> FastAPI:
    """最小 app + 主体注入中间件(与 JWT 中间件同一条 request.state 通道)。"""
    app = FastAPI()
    app.include_router(llm_mod.router)

    @app.middleware("http")
    async def _inject_identity(request: Request, call_next):  # type: ignore[no-untyped-def]
        uid = request.headers.get("x-test-uid")
        if uid:
            request.state.user_id = uid
        return await call_next(request)

    return app


@pytest.fixture()
def client() -> Any:
    with TestClient(_make_app()) as c:
        yield c


@pytest.fixture()
def callbacks(monkeypatch: pytest.MonkeyPatch) -> list[dict[str, Any]]:
    """替换落库回调为记录器:只捕获 body 与 interrupted 标记,不发网络请求。"""
    records: list[dict[str, Any]] = []

    async def fake_fire(
        url: str,
        payload: dict[str, Any],
        metadata: dict[str, Any] | None,
        **kwargs: Any,
    ) -> None:
        records.append(
            {
                "url": url,
                "payload": dict(payload),
                "metadata": dict(metadata or {}),
                "interrupted": bool(kwargs.get("interrupted", False)),
                "usage_detail": kwargs.get("usage_detail"),
            }
        )

    monkeypatch.setattr(llm_mod, "_fire_callback", fake_fire)
    return records


def _body(**overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "messages": [{"role": "user", "content": "你好"}],
        "model": "test-model",
        "metadata": {
            "conversationId": "conv-ais001",
            "userId": _USER,
            "messageId": "msg-ais001",
        },
    }
    body.update(overrides)
    return body


def _fake_stream(events: list[dict[str, Any]]) -> Any:
    async def _astream(
        messages: list[dict[str, Any]],
        model: str | None = None,
        owner_uuid: str | None = None,
        **kwargs: Any,
    ) -> Any:
        for evt in events:
            yield evt

    return _astream


def _parse_sse(raw: str) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    for block in raw.split("\n\n"):
        if not block.strip():
            continue
        event_type: str | None = None
        data: Any = None
        for line in block.split("\n"):
            if line.startswith("event:"):
                event_type = line[6:].strip()
            elif line.startswith("data:"):
                try:
                    data = json.loads(line[5:].strip())
                except (json.JSONDecodeError, ValueError):
                    data = line[5:].strip()
        if event_type or data is not None:
            events.append({"event": event_type, "data": data})
    return events


def _wait_for(callbacks: list[dict[str, Any]], timeout: float = 3.0) -> list[dict[str, Any]]:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline and not callbacks:
        time.sleep(0.01)
    return callbacks


def test_mid_stream_error_ends_with_error_frame_and_failed_status(
    client: Any, callbacks: list[dict[str, Any]], monkeypatch: pytest.MonkeyPatch
) -> None:
    """先 chunk 再 error:error 是终态(无 done),落库带 error 标记与中断标注。"""
    monkeypatch.setattr(
        llm_mod.llm_gateway,
        "astream",
        _fake_stream(
            [
                {"type": "chunk", "content": "半截回答"},
                {
                    "type": "error",
                    "errorCode": "UPSTREAM_ERROR",
                    "message": "上游连接中断",
                },
            ]
        ),
    )

    resp = client.post(
        _STREAM_URL, json=_body(), headers={"x-test-uid": _USER}
    )
    assert resp.status_code == 200, resp.text[:500]
    events = _parse_sse(resp.text)
    names = [e["event"] for e in events]

    # ① 失败终态:有 error、无 done(旧实现 error 后继续循环并按 ok 收尾)。
    assert "error" in names, f"客户端未收到 error 帧: {names}"
    assert "done" not in names, f"error 之后仍出现 done(被当成功收尾): {names}"
    business = [n for n in names if n in ("chunk", "done", "error")]
    assert business[-1] == "error", f"最后一个业务帧不是 error: {business}"
    err = next(e["data"] for e in events if e["event"] == "error")
    assert err["errorCode"] == "UPSTREAM_ERROR"
    assert err["message"] == "上游连接中断"

    # ② 落库状态:正常(ok)回调被跳过,改走中断/失败补发 —— 带 error/errorCode 标记。
    _wait_for(callbacks)
    assert len(callbacks) == 1, f"落库回调次数异常(按 ok 收尾会重复/误写): {callbacks}"
    rec = callbacks[0]
    assert rec["interrupted"] is True, "中途 error 仍走了成功落库路径"
    assert rec["payload"]["error"] == "上游连接中断"
    assert rec["payload"]["errorCode"] == "UPSTREAM_ERROR"
    assert rec["payload"]["content"] == "半截回答"


def test_tool_loop_mid_stream_error_not_persisted_as_ok(
    client: Any, callbacks: list[dict[str, Any]], monkeypatch: pytest.MonkeyPatch
) -> None:
    """带 agent tools 的第一轮流式同样:error 终态 + 失败落库,不按 ok 写半截。"""
    monkeypatch.setattr(
        llm_mod.llm_gateway,
        "astream",
        _fake_stream(
            [
                {"type": "chunk", "content": "工具前的内容"},
                {
                    "type": "error",
                    "errorCode": "PROVIDER_TIMEOUT",
                    "message": "上游超时",
                },
            ]
        ),
    )

    resp = client.post(
        _STREAM_URL,
        json=_body(agent_tools=["web_search"]),
        headers={"x-test-uid": _USER},
    )
    assert resp.status_code == 200, resp.text[:500]
    events = _parse_sse(resp.text)
    names = [e["event"] for e in events]

    assert "error" in names, f"工具循环未透传 error 帧: {names}"
    assert "done" not in names, f"工具循环 error 后仍按成功收尾: {names}"
    business = [n for n in names if n in ("chunk", "done", "error")]
    assert business[-1] == "error", f"最后一个业务帧不是 error: {business}"

    _wait_for(callbacks)
    assert len(callbacks) == 1, f"落库回调次数异常: {callbacks}"
    rec = callbacks[0]
    assert rec["interrupted"] is True, "工具循环中途 error 仍走了成功落库路径"
    assert rec["payload"]["error"] == "上游超时"
    assert rec["payload"]["errorCode"] == "PROVIDER_TIMEOUT"


def test_normal_stream_keeps_ok_and_frame_order(
    client: Any, callbacks: list[dict[str, Any]], monkeypatch: pytest.MonkeyPatch
) -> None:
    """无 error:帧序 chunk→chunk→done,落库仍是 ok,usage/usageDetail 不被吞。"""
    usage = {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15}
    monkeypatch.setattr(
        llm_mod.llm_gateway,
        "astream",
        _fake_stream(
            [
                {"type": "chunk", "content": "你好"},
                {"type": "chunk", "content": "世界"},
                {
                    "type": "done",
                    "model": "test-model",
                    "usage": usage,
                    "stub": True,
                },
            ]
        ),
    )

    resp = client.post(
        _STREAM_URL, json=_body(), headers={"x-test-uid": _USER}
    )
    assert resp.status_code == 200, resp.text[:500]
    events = _parse_sse(resp.text)
    names = [e["event"] for e in events]

    # 帧序与基线逐字一致:内容帧 chunk→chunk→done,末尾仅追加计量帧。
    business = [n for n in names if n in ("chunk", "done", "error")]
    assert business == ["chunk", "chunk", "done"], f"正常流帧序被改动: {names}"
    assert "error" not in names
    chunks = [e["data"]["content"] for e in events if e["event"] == "chunk"]
    assert "".join(chunks) == "你好世界"
    assert next(e["data"] for e in events if e["event"] == "done")["stub"] is True

    # ok 落库不变:非中断、无 error 标记、usage 与 usageDetail 照常带上。
    _wait_for(callbacks)
    assert len(callbacks) == 1, f"落库回调次数异常: {callbacks}"
    rec = callbacks[0]
    assert rec["interrupted"] is False
    assert not rec["payload"].get("error")
    assert rec["payload"]["content"] == "你好世界"
    assert rec["payload"]["usage"] == usage
    assert rec["usage_detail"] is not None
    assert rec["usage_detail"]["totalTokens"] == 15
