# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# G-94(2026-10-18 立):用户按停止时,半截回答必须交给回调落库。

from __future__ import annotations

import asyncio
import inspect
import json
import re
from collections.abc import AsyncIterator
from typing import Any

import pytest
from starlette.requests import Request

from app.routers.llm import _fire_callback, _interrupted_callback_flush


class _FakeResp:
    status_code = 200


class _FakeClient:
    captured: list[dict] = []  # type: ignore[type-arg]

    def __init__(self, *a: object, **kw: object) -> None:
        pass

    async def __aenter__(self) -> _FakeClient:
        return self

    async def __aexit__(self, *exc: object) -> bool:
        return False

    async def post(self, url: str, json: dict | None = None, **kw: object) -> _FakeResp:  # type: ignore[override]
        _FakeClient.captured.append(json or {})
        return _FakeResp()


@pytest.fixture(autouse=True)
def _cb_env(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core.config import settings

    monkeypatch.setattr(settings, "ai_callback_secret", "test-secret")
    # 2026-11-06 票据化:回调必须带短期票(scope=ai-callback),签票依赖 JWT_SECRET;
    # 缺它则会话侧直接拒绝发送(不再静默只发旧密钥),本文件判据全部失效。
    monkeypatch.setattr(settings, "jwt_secret", "unit-test-jwt-secret-0123456789-abcdefgh")
    # 同 test_llm_tool_persistence:第 10 批起 callback 只许与 api_service_url 同源。
    # 本文件回地址是 http://api.test/api/ai/callback ⇒ 基准同源地址取 http://api.test。
    monkeypatch.setattr(settings, "api_service_url", "http://api.test")
    monkeypatch.setattr("app.routers.llm.httpx.AsyncClient", _FakeClient)
    _FakeClient.captured = []


# =============================================================================
# 判据本体:补发条件(三条缺一不补)
# =============================================================================


class TestInterruptedFlushDecision:
    def test_closing_with_arrived_text_flushes(self) -> None:
        assert (
            _interrupted_callback_flush(stream_exiting=True, error=None, content="半截回答") is True
        )

    def test_zero_char_cancel_does_not_flush(self) -> None:
        # 票面判据②:零字符时不得落空 assistant 气泡(上游 if (!snapshot.text) return 同判据)。
        for blank in ("", "   ", "\n\n", None):
            assert (
                _interrupted_callback_flush(stream_exiting=True, error=None, content=blank) is False
            )

    def test_in_stream_error_flushes_partial(self) -> None:
        # AIS-001:流内 provider error 是终态,但正常回调路径显式跳过 error;
        # 若这里不补,用户已看到的半截回答在历史上彻底消失 ⇒ 必须补发(interrupted)。
        assert (
            _interrupted_callback_flush(
                stream_exiting=True, error="LLM_ERROR", content="半截回答"
            )
            is True
        )

    def test_normal_completion_not_flushed_here(self) -> None:
        # 正常跑完由 try 之后的原回调路径落库;这里再发一次就是同一幂等键的重复 POST。
        assert (
            _interrupted_callback_flush(stream_exiting=False, error=None, content="完整回答")
            is False
        )


# =============================================================================
# body 形状:标注只在 interrupted=True 时进入,默认两键缺席
# =============================================================================


async def _fire(**kw: object) -> dict:
    await _fire_callback(
        "http://api.test/api/ai/callback",
        {"content": "半截回答", "model": "gpt-x", "usage": None, "stub": False},
        {"conversationId": "c-1", "userId": "u-1", "messageId": "m-1"},
        **kw,  # type: ignore[arg-type]
    )
    assert len(_FakeClient.captured) == 1
    return _FakeClient.captured[0]


class TestFireCallbackInterruptedBody:
    async def test_interrupted_writes_both_keys(self) -> None:
        body = await _fire(interrupted=True)
        assert body["interrupted"] is True
        assert body["interruptReason"] == "user_cancelled"
        assert body["content"] == "半截回答"

    async def test_default_body_has_neither_key(self) -> None:
        body = await _fire()
        assert "interrupted" not in body
        assert "interruptReason" not in body


# =============================================================================
# AIS-001 端到端:流内 provider error 是终态,半截回答仍须交给回调落库
# =============================================================================

_STREAM_URL = "/api/llm/complete/stream"


def _parse_sse_events(raw: str) -> list[dict[str, Any]]:
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


def _bare_request(body: dict[str, Any]) -> Request:
    """裸 ASGI 请求(不经中间件链):端点内身份类辅助全走 getattr 兜底。"""
    payload = json.dumps(body).encode()
    scope: dict[str, Any] = {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.3"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": _STREAM_URL,
        "raw_path": _STREAM_URL.encode(),
        "query_string": b"",
        "root_path": "",
        "headers": [
            (b"host", b"test"),
            (b"content-type", b"application/json"),
            (b"content-length", str(len(payload)).encode()),
        ],
        "client": ("127.0.0.1", 123),
        "server": ("test", 80),
        "state": {},
    }

    async def receive() -> dict[str, Any]:
        return {"type": "http.request", "body": payload, "more_body": False}

    return Request(scope, receive)


async def test_stream_error_event_still_flushes_partial_answer(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """原生/上游中途 error → 前端收 error 终态,已到达的半截回答仍进回调(interrupted)。"""
    from app.routers import llm as llm_router
    from app.routers.llm import LLMCompleteRequest, complete_stream

    async def fake_astream(
        messages: list[dict[str, Any]],
        model: str | None = None,
        owner_uuid: str | None = None,
        **kwargs: Any,
    ) -> AsyncIterator[dict[str, Any]]:
        yield {"type": "chunk", "content": "半截回答"}
        yield {
            "type": "error",
            "errorCode": "UPSTREAM_ERROR",
            "message": "上游连接中断",
        }

    monkeypatch.setattr(llm_router.llm_gateway, "astream", fake_astream)

    body: dict[str, Any] = {
        "messages": [{"role": "user", "content": "你好"}],
        "inputId": "ais-001-input",
        "metadata": {
            "conversationId": "conv-ais001",
            "userId": "user-ais001",
            "messageId": "msg-ais001",
        },
    }
    resp = await complete_stream(LLMCompleteRequest(**body), _bare_request(body))
    raw = "".join(
        [
            piece.decode("utf-8") if isinstance(piece, bytes) else piece
            async for piece in resp.body_iterator
        ]
    )
    events = _parse_sse_events(raw)

    error_at = next(i for i, e in enumerate(events) if e["event"] == "error")
    # error 是终态:其后不得再有 chunk/done(旧实现继续循环并按成功收尾)
    trailing = [e for e in events[error_at + 1:] if e["event"] in ("chunk", "done")]
    assert trailing == [], f"error 之后仍有 chunk/done: {trailing}"

    # 半截回答必须交给回调落库(正常回调路径显式跳过 error,只有 interrupted 补发这一条)
    for _ in range(20):
        if _FakeClient.captured:
            break
        await asyncio.sleep(0)
    assert _FakeClient.captured, "流内 error 后回调从未触发 ⇒ 用户已看到的半截回答丢失"
    sent = _FakeClient.captured[-1]
    assert sent.get("interrupted") is True
    assert sent.get("interruptReason") == "user_cancelled"
    assert sent.get("content") == "半截回答"


# =============================================================================
# 装车锁:补发必须挂在 finally 顶部(取消路径唯一能跑到的地方)
# =============================================================================


def test_flush_call_sits_in_the_finally() -> None:
    """判"补写挂在走得到的那一段",不判"代码里出现过这个函数名"。

    结构性事实:生成器 try/finally **之后**那段"流结束后异步回调"在
    GeneratorExit / CancelledError 两条分支上根本到不了(两处 except 都 raise 出去),
    所以把补写挂在那里等于什么都没修。这里取 finally 到兜底关停之间的那一段源码,
    要求调用点确实落在其中。
    """
    src = inspect.getsource(inspect.getmodule(_fire_callback) or "")
    assert "def _interrupted_callback_flush(" in src, "取态函数从未入库 ⇒ 判据本体缺席"
    positions = [m.start() for m in re.finditer(r"_interrupted_callback_flush\(", src)]
    assert len(positions) >= 2, "调用点不存在 ⇒ 只造了尺子没装车"
    # 取**第一处**:调用点住在流式端点的 finally 里(文件靠前),定义在其后(模块尾部)。
    call_at = positions[0]
    finally_at = src.rfind("finally:", 0, call_at)
    assert finally_at != -1, "调用点之前没有 finally ⇒ 不在取消路径跑得到的那一段"
    between = src[finally_at:call_at]
    assert len(between) < 3000, "finally 与调用点距离异常 ⇒ 锚点认错"
    assert "def " not in between, "两个锚点之间跨了函数定义 ⇒ 锚点认错"
    # 排在兜底关停之前:那段之后任何 yield/await 都可能被 GeneratorExit 打断。
    after = src[call_at : call_at + 4000]
    assert "aclose_async_gen" in after, "补发未与兜底关停同处一段 finally"
    # 只 fire 不 await:取消作用域内裸 await 会把后面的四项清理整批跳过(本文件既有纪律)。
    assert "await _fire_callback" not in after
    assert "await _interrupted_callback_flush" not in after
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
