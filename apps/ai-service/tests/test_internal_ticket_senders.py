# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""G-242 PART-LIVE 残余:三枚大文件发信侧接 internal_service_headers 的回归。

覆盖:
- im_bridge / memory_service / mcp_server(edu)三处发信侧,验证默认档 dual:
  旧 x-internal-service-token 照发 + 新 x-internal-service-ticket 同发。
- 反向:签不出票(无 JWT_SECRET)⇒ 不发票、不发票头空串,只留旧头(兼容窗口设计)。
- 零副作用:凭证/身份缺失 ⇒ 不构造请求、不发网络。

全程纯单元:HTTP 客户端与 LLM 网关全部替换为假件,不连生产 Redis(8811)/PG(8810)。
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock

import httpx
import jwt as pyjwt
import pytest

from app.core.config import settings
from app.core.internal_ticket import (
    INTERNAL_TICKET_AUDIENCE,
    INTERNAL_TICKET_HEADER,
    INTERNAL_TOKEN_HEADER,
    USER_ID_HEADER,
)

SECRET = "unit-test-shared-jwt-secret-0123456789-abcdefgh"
UID = "6b8cd0f6-546f-44c8-853a-5f96edbe08be"


@pytest.fixture()
def with_jwt_secret(monkeypatch: pytest.MonkeyPatch) -> str:
    monkeypatch.setattr(settings, "jwt_secret", SECRET, raising=False)
    return SECRET


@pytest.fixture()
def without_jwt_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "jwt_secret", "", raising=False)
    monkeypatch.delenv("JWT_SECRET", raising=False)


def decode_ticket(token: str) -> dict[str, Any]:
    return pyjwt.decode(
        token, SECRET, algorithms=["HS256"], audience=INTERNAL_TICKET_AUDIENCE
    )


class _FakeResp:
    def __init__(self, payload: dict[str, Any] | None = None) -> None:
        self._payload = payload if payload is not None else {}
        self.status_code = 200
        self.text = ""

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict[str, Any]:
        return self._payload


def _make_fake_httpx(monkeypatch: pytest.MonkeyPatch) -> list[tuple[str, str, dict[str, str]]]:
    """替换 httpx.AsyncClient,返回捕获表 [(method, url, headers)]。"""
    captured: list[tuple[str, str, dict[str, str]]] = []

    class _FakeClient:
        def __init__(self, **kwargs: Any) -> None:
            return None

        async def __aenter__(self) -> _FakeClient:
            return self

        async def __aexit__(self, *exc: Any) -> bool:
            return False

        async def get(self, url: str, **kwargs: Any) -> _FakeResp:
            captured.append(("GET", url, dict(kwargs.get("headers") or {})))
            return _FakeResp({"data": {"entries": []}})

        async def post(self, url: str, **kwargs: Any) -> _FakeResp:
            captured.append(("POST", url, dict(kwargs.get("headers") or {})))
            return _FakeResp()

    monkeypatch.setattr(httpx, "AsyncClient", _FakeClient)
    return captured


# ── 1. mcp_server(edu 工具)────────────────────────────────────────────
def test_edu_正向_dual_两把头同发且票可验(
    monkeypatch: pytest.MonkeyPatch, with_jwt_secret: str
) -> None:
    from app.services.mcp_server import _edu_internal_headers

    monkeypatch.setenv("AI_CALLBACK_SECRET", "legacy-secret")
    headers = _edu_internal_headers(UID)
    assert headers[INTERNAL_TOKEN_HEADER] == "legacy-secret"
    assert headers[USER_ID_HEADER] == UID
    payload = decode_ticket(headers[INTERNAL_TICKET_HEADER])
    assert payload["scope"] == "mcp-edu"
    assert payload["sub"] == UID


def test_edu_反向_签不出票时只留旧头不发票头空串(
    monkeypatch: pytest.MonkeyPatch, without_jwt_secret: None
) -> None:
    from app.services.mcp_server import _edu_internal_headers

    monkeypatch.setenv("AI_CALLBACK_SECRET", "legacy-secret")
    headers = _edu_internal_headers(UID)
    assert headers[INTERNAL_TOKEN_HEADER] == "legacy-secret"
    assert INTERNAL_TICKET_HEADER not in headers


async def test_edu_零副作用_凭证或身份缺失返回空且不构造任何请求(
    monkeypatch: pytest.MonkeyPatch, with_jwt_secret: str
) -> None:
    import app.services.mcp_server as mcp

    monkeypatch.delenv("AI_CALLBACK_SECRET", raising=False)
    constructed = _make_fake_httpx(monkeypatch)
    result = await mcp._edu_api_request("GET", "/config", user_id=UID)
    assert result["ok"] is False and result["errorCode"] == "INTERNAL_AUTH_UNAVAILABLE"
    assert constructed == [], "凭证缺失必须不发请求(零副作用)"
    monkeypatch.setenv("AI_CALLBACK_SECRET", "legacy-secret")
    assert mcp._edu_internal_headers("bad uid!") == {}


# ── 2. im_bridge ───────────────────────────────────────────────────────
async def _run_im_bridge(monkeypatch: pytest.MonkeyPatch) -> list[dict[str, str]]:
    import app.services.api_client as api_client_mod
    from app.services.im_bridge import im_bridge_service

    captured_headers: list[dict[str, str]] = []

    class _FakeApiClient:
        async def post(self, url: str, **kwargs: Any) -> _FakeResp:
            captured_headers.append(dict(kwargs.get("headers") or {}))
            return _FakeResp()

    monkeypatch.setattr(api_client_mod, "get_api_client", lambda: _FakeApiClient())
    from app.core import llm_gateway as lg_mod

    monkeypatch.setattr(
        lg_mod.llm_gateway, "complete", AsyncMock(return_value={"content": "你好"})
    )
    ok = await im_bridge_service._handle_message(
        f"im:inbound:{UID}:wechat", {"text": "hi", "chatId": "c1"}
    )
    assert ok is True
    return captured_headers


async def test_im_bridge_正向_dual_两把头同发且票可验(
    monkeypatch: pytest.MonkeyPatch, with_jwt_secret: str
) -> None:
    monkeypatch.setattr(settings, "ai_callback_secret", "legacy-secret", raising=False)
    captured = await _run_im_bridge(monkeypatch)
    assert len(captured) == 1  # 零副作用:恰好一次出站
    headers = captured[0]
    assert headers[INTERNAL_TOKEN_HEADER] == "legacy-secret"
    assert headers[USER_ID_HEADER] == UID
    assert decode_ticket(headers[INTERNAL_TICKET_HEADER])["scope"] == "im-bridge"


async def test_im_bridge_反向_签不出票时只留旧头(
    monkeypatch: pytest.MonkeyPatch, without_jwt_secret: None
) -> None:
    monkeypatch.setattr(settings, "ai_callback_secret", "legacy-secret", raising=False)
    captured = await _run_im_bridge(monkeypatch)
    headers = captured[0]
    assert headers[INTERNAL_TOKEN_HEADER] == "legacy-secret"
    assert INTERNAL_TICKET_HEADER not in headers


# ── 3. memory_service(两处)────────────────────────────────────────────
async def test_memory_正向_dual_两把头同发且票可验(
    monkeypatch: pytest.MonkeyPatch, with_jwt_secret: str
) -> None:
    from app.services.memory_service import MemoryService, _internal_service_token

    monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", "legacy-secret")
    svc = MemoryService(gateway=object())
    captured = _make_fake_httpx(monkeypatch)
    await svc._fetch_memory_entries(UID, "user")
    assert len(captured) == 1
    headers = captured[0][2]
    assert headers[INTERNAL_TOKEN_HEADER] == _internal_service_token()
    assert headers[USER_ID_HEADER] == UID
    assert decode_ticket(headers[INTERNAL_TICKET_HEADER])["scope"] == "memory"


async def test_memory_反向_签不出票时只留旧头(
    monkeypatch: pytest.MonkeyPatch, without_jwt_secret: None
) -> None:
    from app.services.memory_service import MemoryService

    monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", "legacy-secret")
    svc = MemoryService(gateway=object())
    captured = _make_fake_httpx(monkeypatch)
    await svc._fetch_memory_entries(UID, "user")
    headers = captured[0][2]
    assert headers[INTERNAL_TOKEN_HEADER] == "legacy-secret"
    assert INTERNAL_TICKET_HEADER not in headers


async def test_memory_save_正向_dual_保留json头且票可验(
    monkeypatch: pytest.MonkeyPatch, with_jwt_secret: str
) -> None:
    from app.services.memory_service import MemoryService

    monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", "legacy-secret")

    class _FakeGateway:
        async def complete(self, messages: Any, **kwargs: Any) -> dict[str, Any]:
            return {"content": '[{"type": "preference", "text": "喜欢简洁回复"}]'}

    svc = MemoryService(gateway=_FakeGateway())
    monkeypatch.setattr(svc, "_is_auto_memory_enabled", AsyncMock(return_value=True))
    captured = _make_fake_httpx(monkeypatch)
    await svc.save_insights_from_conversation(
        UID, [{"role": "user", "content": "我喜欢简洁"}]
    )
    assert len(captured) == 1  # 零副作用:恰好一次 POST
    headers = captured[0][2]
    assert headers["Content-Type"] == "application/json"
    assert headers[INTERNAL_TOKEN_HEADER] == "legacy-secret"
    assert decode_ticket(headers[INTERNAL_TICKET_HEADER])["scope"] == "memory"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
