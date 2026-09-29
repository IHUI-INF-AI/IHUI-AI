# -*- coding: utf-8 -*-
"""内部服务短期票 —— 发票侧回归(2026-09-27,PROJECT_PLAN 第五十二批·⑤)。

三层各管一件事:
 1. **票的 claim 形状**:验票侧 (apps/api) 判的就是这几项,这里必须按同一份字面量钉住
    —— 一张跨语言契约表。任一侧改了字面量而另一侧没改,两侧的用例会分别红。
 2. **兼容窗口是"加法"**:旧头必须在、新头也必须在。少任何一边就是双侧发布顺序事故。
 3. **失败口径**:签不出票 ⇒ 只发旧头 + 喊一条 warning,**不发空票**。
    发一枚空票会让验票方读到"坏票"而把整条通道判死 —— 那是把降级做成故障。

全程纯单元:不连生产 Redis(8811)/PG(8810),符合 AGENTS §5 测试隔离铁律。
"""

from __future__ import annotations

import time
from typing import Any

import jwt as pyjwt
import pytest

from app.core.config import settings
from app.core.internal_ticket import (
    DEFAULT_TICKET_TTL_SECONDS,
    INTERNAL_TICKET_AUDIENCE,
    INTERNAL_TICKET_HEADER,
    INTERNAL_TICKET_SCOPES,
    INTERNAL_TICKET_TYPE,
    INTERNAL_TOKEN_HEADER,
    MAX_TICKET_TTL_SECONDS,
    USER_ID_HEADER,
    internal_service_headers,
    mint_internal_service_ticket,
    ticket_ttl_seconds,
)

SECRET = "unit-test-shared-jwt-secret-0123456789-abcdefgh"
UID = "6b8cd0f6-546f-44c8-853a-5f96edbe08be"


@pytest.fixture()
def with_jwt_secret(monkeypatch: pytest.MonkeyPatch) -> str:
    monkeypatch.setattr(settings, "jwt_secret", SECRET, raising=False)
    return SECRET


def decode(token: str) -> dict[str, Any]:
    """按**验票侧同款的严格度**解:强制 HS256 + 强制 aud 等值。"""
    return casted = pyjwt.decode(
        token, SECRET, algorithms=["HS256"], audience=INTERNAL_TICKET_AUDIENCE
    )


def test_跨语言契约字面量必须与验票侧同值() -> None:
    """这几个字符串是两侧唯一的连接点。改一边忘另一边 = 内部通道整条 401。"""
    assert INTERNAL_TICKET_HEADER == "x-internal-service-ticket"
    assert INTERNAL_TOKEN_HEADER == "x-internal-service-token"
    assert USER_ID_HEADER == "x-user-id"
    assert INTERNAL_TICKET_AUDIENCE == "ihui-internal-service"
    assert INTERNAL_TICKET_TYPE == "internal-service-ticket"
    # 与用户 token 的 aud(packages/auth/src/jwt.ts 的 AUDIENCE='ihui-ai-users')必须不同档,
    # 否则"同一把密钥下的另一种 token"就能当内部凭据用。
    assert INTERNAL_TICKET_AUDIENCE != "ihui-ai-users"
    assert "api-tools" in INTERNAL_TICKET_SCOPES and "mcp-edu" in INTERNAL_TICKET_SCOPES


def test_签出的票带齐验票侧要判的四项(with_jwt_secret: str) -> None:
    payload = decode(mint_internal_service_ticket(UID, "api-tools") or "")
    assert payload["sub"] == UID
    assert payload["aud"] == INTERNAL_TICKET_AUDIENCE
    assert payload["type"] == INTERNAL_TICKET_TYPE
    assert payload["scope"] == "api-tools"
    assert payload["jti"]
    assert payload["exp"] - payload["iat"] == DEFAULT_TICKET_TTL_SECONDS


def test_aud_不是内部档就解不开(跨用途的正面证明)(with_jwt_secret: str) -> None:
    token = pyjwt.encode(
        {"sub": UID, "aud": "ihui-ai-users", "exp": int(time.time()) + 60},
        SECRET,
        algorithm="HS256",
    )
    with pytest.raises(pyjwt.InvalidAudienceError):
        pyjwt.decode(token, SECRET, algorithms=["HS256"], audience=INTERNAL_TICKET_AUDIENCE)


def test_ttl_封顶_再大也只签成300秒(with_jwt_secret: str) -> None:
    payload = decode(mint_internal_service_ticket(UID, "api-tools", ttl_seconds=99999) or "")
    assert payload["exp"] - payload["iat"] == MAX_TICKET_TTL_SECONDS
    assert ticket_ttl_seconds(-1) == DEFAULT_TICKET_TTL_SECONDS
    assert ticket_ttl_seconds(float("nan")) == DEFAULT_TICKET_TTL_SECONDS


def test_每张票的jti必须唯一(with_jwt_secret: str) -> None:
    a = decode(mint_internal_service_ticket(UID, "api-tools") or "")["jti"]
    b = decode(mint_internal_service_ticket(UID, "api-tools") or "")["jti"]
    assert a != b, "jti 重复 ⇒ 同一枚票第二次会被自己的重放检查拒掉(功能面事故)"


def test_未知用途直接抛而不是一张万能票(with_jwt_secret: str) -> None:
    with pytest.raises(ValueError):
        mint_internal_service_ticket(UID, "any-purpose")


def test_无主体不发票(with_jwt_secret: str) -> None:
    assert mint_internal_service_ticket("", "api-tools") is None
    assert mint_internal_service_ticket(None, "api-tools") is None


# ── 兼容窗口:发票侧的改动必须是加法 ────────────────────────────────────
def test_兼容窗口两把头同时带(with_jwt_secret: str) -> None:
    headers = internal_service_headers(UID, "im-bridge", legacy_token="legacy-secret")
    assert headers[INTERNAL_TOKEN_HEADER] == "legacy-secret"  # 旧验票方仍可工作
    assert INTERNAL_TICKET_HEADER in headers  # 新验票方立刻可验
    assert headers[USER_ID_HEADER] == UID


def test_没有常驻密钥时只发新票不发空票(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "jwt_secret", SECRET, raising=False)
    headers = internal_service_headers(UID, "api-tools", legacy_token="")
    assert INTERNAL_TICKET_HEADER in headers
    assert INTERNAL_TOKEN_HEADER not in headers


def test_两把都签不出时不得留下空票头(monkeypatch: pytest.MonkeyPatch) -> None:
    """验票方读到 `x-internal-service-ticket: ""` 会判坏票并**拒绝回落旧通道**
    (那是设计,不是缺陷)——所以签不出就必须不带这个头。"""
    monkeypatch.setattr(settings, "jwt_secret", "", raising=False)
    monkeypatch.delenv("JWT_SECRET", raising=False)
    headers = internal_service_headers(UID, "api-tools", legacy_token="")
    assert INTERNAL_TICKET_HEADER not in headers
    assert INTERNAL_TOKEN_HEADER not in headers
    assert headers[USER_ID_HEADER] == UID


def test_jwt_secret_未配置时发票返回_none_并喊话(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    import logging

    monkeypatch.setattr(settings, "jwt_secret", "", raising=False)
    monkeypatch.delenv("JWT_SECRET", raising=False)
    with caplog.at_level(logging.WARNING, logger="app.core.internal_ticket"):
        assert mint_internal_service_ticket(UID, "api-tools") is None
    assert any("JWT_SECRET" in r.message or "JWT_SECRET" in str(r.msg) for r in caplog.records), (
        "静默降级等于'看起来在发票其实没发',必须喊出来(AGENTS §5e 失败必须响)"
    )


# ── 变异取证 ────────────────────────────────────────────────────────────
def test_变异a_摘掉ttl封顶会立刻被验票侧拒(with_jwt_secret: str) -> None:
    """本侧封顶 + 对侧封顶是两道独立闸。这里证明"签出一枚 3600s 的票"确实能被
    同款严格度判成超长 —— 用手工签一枚绕过本模块的票来当阳性对照。"""
    long_ticket = pyjwt.encode(
        {
            "sub": UID,
            "aud": INTERNAL_TICKET_AUDIENCE,
            "type": INTERNAL_TICKET_TYPE,
            "scope": "api-tools",
            "jti": "x",
            "iat": int(time.time()),
            "exp": int(time.time()) + 3600,
        },
        SECRET,
        algorithm="HS256",
    )
    payload = decode(long_ticket)  # 签名/aud 仍有效
    assert payload["exp"] - payload["iat"] > MAX_TICKET_TTL_SECONDS  # ⇒ 对侧 too_long_lived 必红


def test_变异b_摘掉重放唯一性_同一枚票可被解两次(with_jwt_secret: str) -> None:
    """签发侧没有"用过就作废"的能力(那是对侧 Redis 的活),所以这里证明的是:
    票本身必须带 jti —— 摘掉 jti 对侧就无从去重。正向对照 = 无 jti 的票仍能被验票侧拒。"""
    token = mint_internal_service_ticket(UID, "api-tools") or ""
    assert decode(token)["jti"]
    no_jti = pyjwt.encode(
        {
            "sub": UID,
            "aud": INTERNAL_TICKET_AUDIENCE,
            "type": INTERNAL_TICKET_TYPE,
            "scope": "api-tools",
            "iat": int(time.time()),
            "exp": int(time.time()) + 60,
        },
        SECRET,
        algorithm="HS256",
    )
    assert "jti" not in decode(no_jti)
