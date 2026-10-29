# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""checkin_user_pool_bridge 鉴权头 × internal_ticket 短期票回归(2026-10-26,G-242 PART-LIVE)。

票面:反向同步请求直拼 X-Internal-Service-Token 常驻密钥头。改后:经
app.core.internal_ticket.internal_service_headers 唯一出口取头,dual 兼容窗内旧头
照发、x-internal-service-ticket 短期票同带 —— 主体绑定 payload.ownerUserId
(upsert/delete 两个端点都带,是真实的 apps/api 用户 id)。

全程纯单元:HTTP 在本模块 httpx.AsyncClient 层拦截,不连生产 PG(8810)/Redis(8811)、
不触达真实 apps/api。
"""

from __future__ import annotations

from typing import Any

import jwt as pyjwt
import pytest

from app.core.config import settings
from app.core.internal_ticket import (
    INTERNAL_TICKET_AUDIENCE,
    INTERNAL_TICKET_HEADER,
    INTERNAL_TICKET_TYPE,
    INTERNAL_TOKEN_HEADER,
    USER_ID_HEADER,
)
from app.services import checkin_user_pool_bridge as ub

SECRET = "unit-test-shared-jwt-secret-0123456789-abcdefgh"
LEGACY = "legacy-callback-secret"
OWNER = "00000000-0000-4000-8000-00000000000c"


@pytest.fixture()
def with_secrets(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "jwt_secret", SECRET, raising=False)
    monkeypatch.delenv("JWT_SECRET", raising=False)
    # _post 的凭据闸读 settings.ai_callback_secret(由 8e6f8fe101dde44910d4cd3d7768bf5af16675ee
    # 「号池双池并存 + 签到助手双向同步(后端)」引入);缺它则用例随本机 .env 有没有配这个键
    # 而时过时败 —— 测试不得依赖环境供值,在此显式供。
    monkeypatch.setattr(settings, "ai_callback_secret", LEGACY, raising=False)
    monkeypatch.delenv("AI_CALLBACK_SECRET", raising=False)


def decode(token: str) -> dict[str, Any]:
    return pyjwt.decode(
        token, SECRET, algorithms=["HS256"], audience=INTERNAL_TICKET_AUDIENCE
    )


def test_正向_出站头同带主体绑定的一次性短期票(with_secrets: None) -> None:
    headers = ub._auth_headers(LEGACY, OWNER)
    assert headers[INTERNAL_TOKEN_HEADER] == LEGACY
    assert headers[USER_ID_HEADER] == OWNER
    assert headers["X-Internal-Secret"] == LEGACY
    claims = decode(headers[INTERNAL_TICKET_HEADER])
    assert claims["sub"] == OWNER
    assert claims["type"] == INTERNAL_TICKET_TYPE
    assert claims["aud"] == INTERNAL_TICKET_AUDIENCE
    assert claims["scope"] == "ai-callback"
    assert claims["exp"] > claims["iat"]


def test_反向_签不出票时只发旧头绝不发空票坏票(
    monkeypatch: pytest.MonkeyPatch, with_secrets: None  # noqa: ARG001
) -> None:
    monkeypatch.setattr(settings, "jwt_secret", "", raising=False)
    headers = ub._auth_headers(LEGACY, OWNER)
    assert headers[INTERNAL_TOKEN_HEADER] == LEGACY
    assert INTERNAL_TICKET_HEADER not in headers
    assert headers[USER_ID_HEADER] == OWNER


async def test_出站链路_post_真把头带上了(monkeypatch: pytest.MonkeyPatch, with_secrets: None) -> None:
    """_post 全链路(httpx 层拦截):upsert 载荷里的 ownerUserId 成为票主体。"""
    captured: dict[str, Any] = {}

    class FakeResp:
        status_code = 200

        def json(self) -> dict[str, Any]:
            return {"data": {"poolAccountId": "pa-1"}}

    class FakeClient:
        def __init__(self, *args: Any, **kwargs: Any) -> None:
            pass

        async def __aenter__(self) -> FakeClient:
            return self

        async def __aexit__(self, *args: Any) -> None:
            return None

        async def post(self, url: str, **kwargs: Any) -> FakeResp:
            captured["url"] = url
            captured["headers"] = kwargs["headers"]
            captured["json"] = kwargs["json"]
            return FakeResp()

    monkeypatch.setattr(ub.httpx, "AsyncClient", FakeClient)
    data = await ub._post(
        ub.UPSERT_PATH,
        {"ownerUserId": OWNER, "platform": "qoder", "checkinAccountId": 1},
    )
    assert data == {"poolAccountId": "pa-1"}
    assert captured["url"].endswith(ub.UPSERT_PATH)
    assert captured["headers"][INTERNAL_TICKET_HEADER]
    assert decode(captured["headers"][INTERNAL_TICKET_HEADER])["sub"] == OWNER


def test_零副作用_同输入等价输出(with_secrets: None) -> None:
    a = ub._auth_headers(LEGACY, OWNER)
    b = ub._auth_headers(LEGACY, OWNER)
    for key in (INTERNAL_TOKEN_HEADER, USER_ID_HEADER, "X-Internal-Secret"):
        assert a[key] == b[key]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
