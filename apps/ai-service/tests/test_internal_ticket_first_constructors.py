# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
"""票优先出站矩阵:空旧密钥 + 有 JWT_SECRET ⇒ 必须发票;两把都无 ⇒ 不发/明确失败。

2026-11-05(F-03 收尾对账):`apps/ai-service` 曾有三处出站构造器把
`AI_CALLBACK_SECRET` 当"发不发头"的前提(`secret` 为空直接 `return {}`),纯票部署
(JWT_SECRET 已配、常驻密钥未配)下即使能签出票也不会发 —— 等同于"默认 ticket 档
不可用"。本文件把这三处锁成"票优先"的配置矩阵:

- 能签票 ⇒ 必带票(旧密钥只在存在时附加,不是前提);
- 两把都拿不到 ⇒ 不产出裸 `x-user-id`(构造器返回 `{}`,调用方按凭据缺失失败)。
"""

from __future__ import annotations

import base64
import json
from collections.abc import Callable

import pytest

from app.core.config import settings
from app.core.internal_ticket import (
    INTERNAL_TICKET_HEADER,
    INTERNAL_TOKEN_HEADER,
    USER_ID_HEADER,
)

UID = "6b8cd0f6-546f-44c8-853a-5f96edbe08be"
LEGACY = "legacy-callback-secret-for-matrix-only"
JWT_SECRET = "test-jwt-secret-for-ticket-first-matrix-0123456789abcdef"

# (构造器名, scope, 构造器) —— 覆盖本轮点名三处;新加出站构造器请一并登记。
_CONSTRUCTORS: dict[str, tuple[str, Callable[[], dict[str, str]]]] = {}


def _load_constructors() -> dict[str, tuple[str, Callable[[], dict[str, str]]]]:
    if _CONSTRUCTORS:
        return _CONSTRUCTORS
    from app.services import codebase_indexer, mcp_server
    from app.tools import automation_tools

    _CONSTRUCTORS.update(
        {
            "automation_tools._internal_headers": (
                "api-tools",
                lambda: automation_tools._internal_headers(UID),
            ),
            "mcp_server._edu_internal_headers": (
                "mcp-edu",
                lambda: mcp_server._edu_internal_headers(UID),
            ),
            "codebase_indexer._internal_auth_headers": (
                "codebase-index",
                lambda: codebase_indexer.CodebaseIndexer()._internal_auth_headers("", UID),
            ),
        }
    )
    return _CONSTRUCTORS


def _decode_ticket(ticket: str) -> dict[str, object]:
    payload = ticket.split(".")[1]
    payload += "=" * (-len(payload) % 4)
    return json.loads(base64.urlsafe_b64decode(payload))


@pytest.fixture
def jwt_only(monkeypatch: pytest.MonkeyPatch) -> None:
    """纯票部署:有 JWT_SECRET,常驻密钥为空。"""
    monkeypatch.setattr(settings, "jwt_secret", JWT_SECRET, raising=False)
    monkeypatch.setenv("JWT_SECRET", JWT_SECRET)
    monkeypatch.delenv("AI_CALLBACK_SECRET", raising=False)
    monkeypatch.delenv("INTERNAL_SERVICE_TOKEN", raising=False)


@pytest.fixture
def no_credential(monkeypatch: pytest.MonkeyPatch) -> None:
    """两把都拿不到:JWT_SECRET 与常驻密钥都为空。"""
    monkeypatch.setattr(settings, "jwt_secret", "", raising=False)
    monkeypatch.delenv("JWT_SECRET", raising=False)
    monkeypatch.delenv("AI_CALLBACK_SECRET", raising=False)
    monkeypatch.delenv("INTERNAL_SERVICE_TOKEN", raising=False)


@pytest.fixture
def legacy_only(monkeypatch: pytest.MonkeyPatch) -> None:
    """仅旧密钥:显式 dual/legacy 兼容档才有意义,不得因此变成发头前提。"""
    monkeypatch.setattr(settings, "jwt_secret", "", raising=False)
    monkeypatch.delenv("JWT_SECRET", raising=False)
    monkeypatch.setenv("AI_CALLBACK_SECRET", LEGACY)


@pytest.mark.parametrize("name", sorted(_load_constructors()))
def test_jwt_only_must_issue_ticket(
    name: str, jwt_only: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    """空旧密钥 + 有 JWT_SECRET ⇒ 出站头必须含票、不含旧头、身份头与票同现。"""
    scope, build = _load_constructors()[name]
    headers = build()
    assert INTERNAL_TICKET_HEADER in headers, f"{name} 在纯票部署下没有发票(旧密钥仍是前提)"
    assert INTERNAL_TOKEN_HEADER not in headers, "旧密钥为空时不得发旧头"
    assert headers[USER_ID_HEADER] == UID
    payload = _decode_ticket(headers[INTERNAL_TICKET_HEADER])
    assert payload["sub"] == UID
    assert payload["scope"] == scope
    assert payload["aud"] == "ihui-internal-service"


@pytest.mark.parametrize("name", sorted(_load_constructors()))
def test_no_credential_never_bares_identity(name: str, no_credential: None) -> None:
    """JWT_SECRET 与旧密钥都为空 ⇒ 一个凭据/身份头都不许发。"""
    _, build = _load_constructors()[name]
    headers = build()
    assert headers == {}, f"{name} 在零凭据下仍发头(退化形态): {headers}"
    assert USER_ID_HEADER not in headers
    assert INTERNAL_TICKET_HEADER not in headers
    assert INTERNAL_TOKEN_HEADER not in headers


@pytest.mark.parametrize("name", sorted(_load_constructors()))
def test_legacy_only_attaches_legacy_but_never_ticket(
    name: str, legacy_only: None
) -> None:
    """仅旧密钥 ⇒ 旧头照发(兼容档),但绝不伪造票;身份头与旧头同现。"""
    _, build = _load_constructors()[name]
    headers = build()
    assert INTERNAL_TOKEN_HEADER in headers
    assert INTERNAL_TICKET_HEADER not in headers
    assert headers[USER_ID_HEADER] == UID
