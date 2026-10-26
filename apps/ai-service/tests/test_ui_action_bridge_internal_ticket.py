# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""ui_action_bridge 鉴权头 × internal_ticket 短期票回归(2026-10-26,G-242 PART-LIVE)。

票面:_ui_call 直拼 x-internal-service-token 常驻密钥头。改后:经
app.core.internal_ticket.internal_service_headers 唯一出口取头,dual 兼容窗内旧头
照发、x-internal-service-ticket 短期票同带(主体 = __user_id,scope='api-tools')。
Bearer(AGENT_CONTROL_INTERNAL_SECRET,/execute 路由侧验真)形状不变 —— apps/api
CSRF 钩子对机器调用的豁免靠这条 Bearer 验真,动了它才会 403。

全程纯单元:只测头构造(纯函数),不连生产 PG(8810)/Redis(8811)、不真发外呼。
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
from app.services import ui_action_bridge as ub

SECRET = "unit-test-shared-jwt-secret-0123456789-abcdefgh"
AGENT_SECRET = "agent-control-secret"
UID = "6b8cd0f6-546f-44c8-853a-5f96edbe08be"


@pytest.fixture()
def with_secrets(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "jwt_secret", SECRET, raising=False)
    monkeypatch.delenv("JWT_SECRET", raising=False)


def decode(token: str) -> dict[str, Any]:
    return pyjwt.decode(
        token, SECRET, algorithms=["HS256"], audience=INTERNAL_TICKET_AUDIENCE
    )


def test_正向_出站头同带一次性短期票且_bearer_原样(with_secrets: None) -> None:
    headers = ub._auth_headers(AGENT_SECRET, UID)
    # /execute 路由侧凭据:Bearer 形状与值都必须原样(动了 = CSRF/401 三连)
    assert headers["Authorization"] == f"Bearer {AGENT_SECRET}"
    assert headers[INTERNAL_TOKEN_HEADER] == AGENT_SECRET  # 旧头仍发(兼容窗)
    assert headers[USER_ID_HEADER] == UID
    claims = decode(headers[INTERNAL_TICKET_HEADER])
    assert claims["sub"] == UID
    assert claims["type"] == INTERNAL_TICKET_TYPE
    assert claims["aud"] == INTERNAL_TICKET_AUDIENCE
    assert claims["scope"] == "api-tools"
    assert claims["exp"] > claims["iat"]


def test_反向_签不出票时只发旧头绝不发空票坏票(
    monkeypatch: pytest.MonkeyPatch, with_secrets: None  # noqa: ARG001
) -> None:
    monkeypatch.setattr(settings, "jwt_secret", "", raising=False)
    headers = ub._auth_headers(AGENT_SECRET, UID)
    assert headers[INTERNAL_TOKEN_HEADER] == AGENT_SECRET
    assert INTERNAL_TICKET_HEADER not in headers
    assert headers["Authorization"] == f"Bearer {AGENT_SECRET}"
    assert headers[USER_ID_HEADER] == UID


def test_零副作用_同输入等价输出(with_secrets: None) -> None:
    a = ub._auth_headers(AGENT_SECRET, UID)
    b = ub._auth_headers(AGENT_SECRET, UID)
    for key in ("Authorization", INTERNAL_TOKEN_HEADER, USER_ID_HEADER):
        assert a[key] == b[key]
    assert decode(a[INTERNAL_TICKET_HEADER])["sub"] == decode(b[INTERNAL_TICKET_HEADER])["sub"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
