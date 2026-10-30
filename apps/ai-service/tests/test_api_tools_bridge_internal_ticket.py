# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""api_tools_bridge 鉴权头 × internal_ticket 短期票回归(2026-10-26,G-242 PART-LIVE)。

票面:验票侧齐备后,api_tools_bridge.internal_headers 仍直拼常驻密钥头
(x-internal-service-token = AI_CALLBACK_SECRET)——"验票器造好了没人用"。
改后:经 app.core.internal_ticket.internal_service_headers 唯一出口取头,
dual 兼容窗内旧头照发、x-internal-service-ticket 短期票同带。

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
from app.services import api_tools_bridge as bridge

SECRET = "unit-test-shared-jwt-secret-0123456789-abcdefgh"
LEGACY = "legacy-callback-secret"
UID = "6b8cd0f6-546f-44c8-853a-5f96edbe08be"


@pytest.fixture()
def with_secrets(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "jwt_secret", SECRET, raising=False)
    monkeypatch.setattr(bridge, "_secret", lambda: LEGACY)


def decode(token: str) -> dict[str, Any]:
    """按验票侧同款严格度解:强制 HS256 + 强制 aud 等值。"""
    return pyjwt.decode(
        token, SECRET, algorithms=["HS256"], audience=INTERNAL_TICKET_AUDIENCE
    )


def test_正向_带主体的出站头同带一次性短期票且可被验票侧认(with_secrets: None) -> None:
    headers = bridge.internal_headers(UID)
    # dual 兼容窗 = 加法:旧头必须在,新头也必须在
    assert headers[INTERNAL_TOKEN_HEADER] == LEGACY
    assert headers[USER_ID_HEADER] == UID
    claims = decode(headers[INTERNAL_TICKET_HEADER])
    assert claims["sub"] == UID
    assert claims["type"] == INTERNAL_TICKET_TYPE
    assert claims["aud"] == INTERNAL_TICKET_AUDIENCE
    assert claims["scope"] == "api-tools"
    assert claims["exp"] > claims["iat"]  # 短期票必须带时效


def test_反向_签不出票时只发旧头绝不发空票坏票(
    monkeypatch: pytest.MonkeyPatch, with_secrets: None  # noqa: ARG001
) -> None:
    monkeypatch.setattr(settings, "jwt_secret", "", raising=False)
    monkeypatch.delenv("JWT_SECRET", raising=False)
    headers = bridge.internal_headers(UID)
    assert headers[INTERNAL_TOKEN_HEADER] == LEGACY
    assert INTERNAL_TICKET_HEADER not in headers  # 不伪造/不发空票(发坏票=整条通道判死)
    assert headers[USER_ID_HEADER] == UID


def test_公开端点调用空主体不伪造票(with_secrets: None) -> None:
    """internal_headers("") 只带旧头(/docs/json 公开,旧通道语义不变)。"""
    headers = bridge.internal_headers("")
    assert headers == {INTERNAL_TOKEN_HEADER: LEGACY}


def test_零副作用_头构造是纯函数(with_secrets: None) -> None:
    """同一输入两次构造出等价头(jti 随机除外),不落任何全局态/网络。"""
    a = bridge.internal_headers(UID)
    b = bridge.internal_headers(UID)
    for key in (INTERNAL_TOKEN_HEADER, USER_ID_HEADER):
        assert a[key] == b[key]
    assert decode(a[INTERNAL_TICKET_HEADER])["sub"] == decode(b[INTERNAL_TICKET_HEADER])["sub"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
