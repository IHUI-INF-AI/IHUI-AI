# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""checkin_pool_writeback 鉴权头 × internal_ticket 回归(2026-10-26,G-242 PART-LIVE)。

票面:回写请求直拼 X-Internal-Service-Token 常驻密钥头。改后:经
app.core.internal_ticket.internal_service_headers 唯一出口取头。

2026-11-06(X-Internal-Secret 族票据化)变更本模块的口径:回写是**机器侧动作**,
调用链(checkin_scheduler.checkin_one / internal_checkin_pool.pool_cred_flush)只给
device_map,批量路径拿不到 apps/api 用户主体。此时**用服务主体**
(``service:ai-service``)签票 —— 请求确实是"ai-service 这个服务在回写",不是伪造
某个真人 uuid;验票侧对 ``service:`` 主体不做归属字段绑定。调用方若真带
owner_user_id(uuid)则用该 uuid 签,保留主体可追溯。

这里钉住三件事:①票存在且用途为专用档 ``relay-account-pool-credential``;
②主体永不编造(无 owner ⇒ 服务主体;非 uuid 属主 ⇒ 服务主体);
③签不出票时绝不发空票/坏票。

全程纯单元:只测头构造(纯函数),不连生产 PG(8810)/Redis(8811)、不真发外呼。
"""

from __future__ import annotations

from typing import Any

import jwt as pyjwt
import pytest

from app.core.config import settings
from app.core.internal_ticket import (
    INTERNAL_SERVICE_PRINCIPAL_AI,
    INTERNAL_TICKET_AUDIENCE,
    INTERNAL_TICKET_HEADER,
    INTERNAL_TICKET_TYPE,
    INTERNAL_TOKEN_HEADER,
    USER_ID_HEADER,
)
from app.services import checkin_pool_writeback as wb

SECRET = "unit-test-shared-jwt-secret-0123456789-abcdefgh"
LEGACY = "legacy-callback-secret"
OWNER = "00000000-0000-4000-8000-00000000000d"


@pytest.fixture(autouse=True)
def _jwt_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "jwt_secret", SECRET, raising=False)
    monkeypatch.delenv("JWT_SECRET", raising=False)


def decode(token: str) -> dict[str, Any]:
    return pyjwt.decode(
        token, SECRET, algorithms=["HS256"], audience=INTERNAL_TICKET_AUDIENCE
    )


def test_正向_机机凭据与端点自有头都在且经唯一出口() -> None:
    headers = wb._auth_headers(LEGACY)
    assert headers[INTERNAL_TOKEN_HEADER] == LEGACY  # 旧头仍发(兼容窗)
    assert headers["X-Internal-Secret"] == LEGACY  # 端点自己的机机凭据,经 extra 原样带
    assert headers["Content-Type"] == "application/json"
    claims = decode(headers[INTERNAL_TICKET_HEADER])
    assert claims["type"] == INTERNAL_TICKET_TYPE
    assert claims["aud"] == INTERNAL_TICKET_AUDIENCE
    assert claims["scope"] == "relay-account-pool-credential"
    assert claims["exp"] > claims["iat"]


def test_反向_无主体用服务主体签票绝不伪造真人_uuid() -> None:
    """没有 apps/api 用户主体 ⇒ 用服务主体,不编一个真人 uuid 出来。"""
    headers = wb._auth_headers(LEGACY)
    claims = decode(headers[INTERNAL_TICKET_HEADER])
    assert claims["sub"] == INTERNAL_SERVICE_PRINCIPAL_AI
    assert headers[USER_ID_HEADER] == INTERNAL_SERVICE_PRINCIPAL_AI


def test_正向_真_uuid_属主签进票面主体() -> None:
    headers = wb._auth_headers(LEGACY, OWNER)
    assert decode(headers[INTERNAL_TICKET_HEADER])["sub"] == OWNER
    assert headers[USER_ID_HEADER] == OWNER


@pytest.mark.parametrize("owner", ["system:relay-pool", "dev-anonymous", "  ", 42, None])
def test_反向_非_uuid_属主回落服务主体(owner: Any) -> None:
    """运营池占位属主不是可验主体 ⇒ 视同拿不到主体,回落服务主体。"""
    headers = wb._auth_headers(LEGACY, owner)
    assert decode(headers[INTERNAL_TICKET_HEADER])["sub"] == INTERNAL_SERVICE_PRINCIPAL_AI


def test_反向_签不出票时只发旧头绝不发空票坏票(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "jwt_secret", "", raising=False)
    headers = wb._auth_headers(LEGACY)
    assert headers[INTERNAL_TOKEN_HEADER] == LEGACY
    assert headers["X-Internal-Secret"] == LEGACY
    assert INTERNAL_TICKET_HEADER not in headers


def test_零副作用_同输入除票据_jti_外语义等价() -> None:
    """jti 每次随机是设计(一次性消费),其余头必须逐项相同。"""
    a = wb._auth_headers(LEGACY)
    b = wb._auth_headers(LEGACY)
    assert set(a) == set(b)
    for key in (INTERNAL_TOKEN_HEADER, USER_ID_HEADER, "X-Internal-Secret", "Content-Type"):
        assert a[key] == b[key]
    ca, cb = decode(a[INTERNAL_TICKET_HEADER]), decode(b[INTERNAL_TICKET_HEADER])
    assert ca["jti"] != cb["jti"]
    for key in ("sub", "aud", "type", "scope"):
        assert ca[key] == cb[key]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
