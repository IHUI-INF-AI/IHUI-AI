# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""codebase_indexer 鉴权头 × internal_ticket 短期票回归(2026-10-26,G-242 PART-LIVE)。

票面:_internal_auth_headers 内部通道分支直拼 x-internal-service-token 常驻密钥头。
改后:该分支经 app.core.internal_ticket.internal_service_headers 唯一出口取头,
dual 兼容窗内旧头照发、x-internal-service-ticket 短期票同带(主体 = internal_user_id,
scope='codebase-index' = 索引服务读写 chunks)。Bearer(api_token 用户 JWT)优先级不变。

全程纯单元:只测头构造(纯方法),不连生产 PG(8810)/Redis(8811)、不真发外呼。
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
from app.services.codebase_indexer import CodebaseIndexer

SECRET = "unit-test-shared-jwt-secret-0123456789-abcdefgh"
LEGACY = "legacy-callback-secret"
UID = "6b8cd0f6-546f-44c8-853a-5f96edbe08be"


def _indexer() -> CodebaseIndexer:
    """只取方法面,不走重 __init__(tree-sitter/llm_gateway 探测与本测试无关)。"""
    return CodebaseIndexer.__new__(CodebaseIndexer)


@pytest.fixture()
def with_secrets(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "jwt_secret", SECRET, raising=False)
    monkeypatch.setenv("AI_CALLBACK_SECRET", LEGACY)


def decode(token: str) -> dict[str, Any]:
    return pyjwt.decode(
        token, SECRET, algorithms=["HS256"], audience=INTERNAL_TICKET_AUDIENCE
    )


def test_正向_内部通道同带一次性短期票且可被验票侧认(with_secrets: None) -> None:
    headers = _indexer()._internal_auth_headers(None, UID)
    assert headers[INTERNAL_TOKEN_HEADER] == LEGACY
    assert headers[USER_ID_HEADER] == UID
    claims = decode(headers[INTERNAL_TICKET_HEADER])
    assert claims["sub"] == UID
    assert claims["type"] == INTERNAL_TICKET_TYPE
    assert claims["aud"] == INTERNAL_TICKET_AUDIENCE
    assert claims["scope"] == "codebase-index"
    assert claims["exp"] > claims["iat"]


def test_反向_签不出票时只发旧头绝不发空票坏票(
    monkeypatch: pytest.MonkeyPatch, with_secrets: None  # noqa: ARG001
) -> None:
    monkeypatch.setattr(settings, "jwt_secret", "", raising=False)
    monkeypatch.delenv("JWT_SECRET", raising=False)
    headers = _indexer()._internal_auth_headers(None, UID)
    assert headers[INTERNAL_TOKEN_HEADER] == LEGACY
    assert INTERNAL_TICKET_HEADER not in headers
    assert headers[USER_ID_HEADER] == UID


def test_用户_jwt_优先级不变_不带任何内部头(with_secrets: None) -> None:
    headers = _indexer()._internal_auth_headers("user-jwt", UID)
    assert headers == {"Authorization": "Bearer user-jwt"}
    assert INTERNAL_TICKET_HEADER not in headers


def test_主体缺失或非法仍返回空头_写入按既有口径被401拒(with_secrets: None) -> None:
    assert _indexer()._internal_auth_headers(None, None) == {}
    assert _indexer()._internal_auth_headers(None, "bad uid!") == {}
    assert _indexer()._internal_auth_headers(None, "") == {}


def test_零副作用_同输入等价输出(with_secrets: None) -> None:
    a = _indexer()._internal_auth_headers(None, UID)
    b = _indexer()._internal_auth_headers(None, UID)
    for key in (INTERNAL_TOKEN_HEADER, USER_ID_HEADER):
        assert a[key] == b[key]
    assert decode(a[INTERNAL_TICKET_HEADER])["sub"] == decode(b[INTERNAL_TICKET_HEADER])["sub"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
