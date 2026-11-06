# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""X-Internal-Secret 族的入站验票器(2026-11-06)。

与 apps/api 侧 ``plugins/internal-secret-auth.ts`` 是同一份判据的两侧实现:
票优先(``x-internal-service-ticket``,scope/aud/type/TTL/jti 全判,单次消费),
旧常驻密钥 ``x-internal-secret`` 只在**显式** ``dual``/``legacy`` 兼容档下才有效。

失败方向 fail-closed:
- 拿不到共享状态(Redis)不能验重放 ⇒ 拒票,不降级成"跳过单次使用检查"。
- 档位名拼错 ⇒ 回落到 ``ticket``,不能静默把老门打开。
- 票坏(签名/时效/用途/重放)⇒ 一律 401,绝不回落旧密钥。
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import os
import time
from collections.abc import Mapping
from typing import Any, Literal, NamedTuple, Protocol

import jwt
from fastapi import HTTPException

from app.core.config import settings
from app.core.internal_ticket import (
    INTERNAL_TICKET_ALGORITHM,
    INTERNAL_TICKET_AUDIENCE,
    INTERNAL_TICKET_SCOPES,
    INTERNAL_TICKET_TYPE,
    MAX_TICKET_TTL_SECONDS,
)

logger = logging.getLogger(__name__)

INTERNAL_SECRET_HEADER = "x-internal-secret"
INTERNAL_TICKET_HEADER = "x-internal-service-ticket"
JTI_KEY_PREFIX = "ihui:internal-ticket:jti:"


class AuthResult(NamedTuple):
    via: Literal["ticket", "legacy"]
    subject: str | None


class ReplayStore(Protocol):
    async def consume(self, jti: str, ttl_seconds: int) -> Literal["consumed", "replayed"]:
        ...


class ReplayStoreUnavailable(RuntimeError):
    """共享状态不可用 —— 调用方必须把它当"拒票",不能当"放行"。"""


class TicketRejected(RuntimeError):
    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


def _fingerprint(jti: str) -> str:
    return hashlib.sha256(jti.encode("utf-8")).hexdigest()


class RedisReplayStore:
    """``SET key 1 EX ttl NX`` 原子消费 jti;拿不到 Redis 一律抛 Unavailable。"""

    def __init__(self) -> None:
        self._client: Any = None

    async def consume(self, jti: str, ttl_seconds: int) -> Literal["consumed", "replayed"]:
        try:
            if self._client is None:
                import redis.asyncio as redis_asyncio

                if not settings.redis_url:
                    raise ReplayStoreUnavailable("redis_url 未配置")
                self._client = redis_asyncio.from_url(settings.redis_url, decode_responses=True)
            key = f"{JTI_KEY_PREFIX}{_fingerprint(jti)}"
            ok = await self._client.set(key, "1", ex=max(1, int(ttl_seconds)), nx=True)
            return "consumed" if ok else "replayed"
        except ReplayStoreUnavailable:
            raise
        except Exception as exc:  # noqa: BLE001 - 任何 Redis 异常都是 fail-closed 输入
            raise ReplayStoreUnavailable(str(exc)) from exc


_replay_store: ReplayStore = RedisReplayStore()


def set_replay_store_for_tests(store: ReplayStore | None) -> None:
    """测试注入点:生产路径永远用 Redis;测试用内存桩验证单次消费语义。"""
    global _replay_store
    _replay_store = store if store is not None else RedisReplayStore()


def auth_mode() -> Literal["ticket", "dual", "legacy"]:
    raw = (
        str(getattr(settings, "internal_secret_auth_mode", "") or "")
        or os.getenv("INTERNAL_SECRET_AUTH_MODE", "")
        or "ticket"
    ).strip().lower()
    return raw if raw in ("dual", "legacy") else "ticket"  # type: ignore[return-value]


def _secrets_equal(a: str, b: str) -> bool:
    return hmac.compare_digest(a.encode("utf-8"), b.encode("utf-8"))


def _decode_and_check(raw: str, expected_scope: str) -> tuple[str, str, int]:
    """验票面(签名/时效/用途/主体)并返回 (subject, jti, remaining_seconds)。

    不消费 jti —— 消费与否由调用点决定:
    - 路由鉴权:必须消费(单次使用)。
    - 免扫描放行(只是跳过内容扫描的"信任标记",不授予访问权):只验签,不消费,
      否则同一次请求里 CSRF/中间件先把票吃掉,下游路由鉴权只能读到 replayed。
    """
    secret = settings.jwt_secret
    if not secret:
        raise TicketRejected("secret_unavailable")
    try:
        claims = jwt.decode(
            raw,
            secret,
            algorithms=[INTERNAL_TICKET_ALGORITHM],
            audience=INTERNAL_TICKET_AUDIENCE,
            options={"require": ["exp", "iat", "aud", "sub", "jti"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise TicketRejected("expired") from exc
    except jwt.InvalidAudienceError as exc:
        raise TicketRejected("wrong_audience") from exc
    except jwt.InvalidTokenError as exc:
        raise TicketRejected("malformed") from exc

    if claims.get("type") != INTERNAL_TICKET_TYPE:
        raise TicketRejected("wrong_type")
    scope = claims.get("scope")
    if scope not in INTERNAL_TICKET_SCOPES:
        raise TicketRejected("bad_scope")
    if scope != expected_scope:
        raise TicketRejected("scope_mismatch")
    subject = claims.get("sub")
    if not isinstance(subject, str) or not subject:
        raise TicketRejected("missing_subject")
    jti = claims.get("jti")
    if not isinstance(jti, str) or not jti:
        raise TicketRejected("missing_jti")

    exp = claims.get("exp")
    iat = claims.get("iat")
    if not isinstance(exp, int) or not isinstance(iat, int):
        raise TicketRejected("malformed")
    max_ttl = min(
        int(getattr(settings, "internal_ticket_max_ttl_seconds", MAX_TICKET_TTL_SECONDS)),
        MAX_TICKET_TTL_SECONDS,
    )
    if exp - iat > max_ttl:
        raise TicketRejected("too_long_lived")
    remaining = exp - int(time.time())
    if remaining <= 0:
        raise TicketRejected("expired")
    return subject, jti, remaining


async def verify_internal_ticket(raw: str, expected_scope: str) -> str:
    """验票并消费 jti;成功返回票面主体(sub),失败抛 TicketRejected。"""
    subject, jti, remaining = _decode_and_check(raw, expected_scope)
    try:
        outcome = await _replay_store.consume(jti, remaining)
    except ReplayStoreUnavailable as exc:
        logger.warning("[internal-secret] replay store unavailable: %s", exc)
        raise TicketRejected("replay_store_unavailable") from exc
    if outcome != "consumed":
        raise TicketRejected("replayed")
    return subject


def verify_internal_ticket_signature(raw: str, expected_scope: str) -> str | None:
    """只验票面、不消费(用于"免扫描"这类非授权标记);失败返回 None。"""
    try:
        return _decode_and_check(raw, expected_scope)[0]
    except TicketRejected as exc:
        logger.warning("[internal-secret] signature-only ticket rejected: %s", exc.reason)
        return None


def allow_prompt_scan_bypass(headers: Mapping[str, str]) -> bool:
    """输入净化中间件的免扫描判据(与路由鉴权同档位、同 fail-closed 方向)。

    注意:返回 True 只表示"跳过内容扫描",**不是**访问授权 —— 请求仍需过用户/内部鉴权。
    """
    mode = auth_mode()
    raw_ticket = headers.get(INTERNAL_TICKET_HEADER)
    if mode != "legacy" and raw_ticket:
        return verify_internal_ticket_signature(raw_ticket, "prompt-scan-bypass") is not None
    if mode == "ticket":
        return False
    secret = settings.ai_callback_secret
    provided = headers.get(INTERNAL_SECRET_HEADER)
    if not secret or not provided:
        return False
    return _secrets_equal(provided, secret)


async def authorize_internal_secret_call(
    headers: Mapping[str, str], expected_scope: str
) -> AuthResult:
    """统一的"票据或旧密钥"判据;失败一律抛 HTTPException。"""
    mode = auth_mode()
    raw_ticket = headers.get(INTERNAL_TICKET_HEADER)
    if mode != "legacy" and raw_ticket:
        try:
            subject = await verify_internal_ticket(raw_ticket, expected_scope)
        except TicketRejected as exc:
            logger.warning("[internal-secret] ticket rejected: %s", exc.reason)
            raise HTTPException(status_code=401, detail="unauthorized") from exc
        return AuthResult(via="ticket", subject=subject)

    if mode == "ticket":
        raise HTTPException(status_code=401, detail="unauthorized")

    # 兼容档下的纯内网端点:未配置旧密钥 ⇒ 503(不裸奔),再判是否带了/带对了。
    secret = settings.ai_callback_secret
    if not secret:
        raise HTTPException(status_code=503, detail="内部密钥未配置(ai_callback_secret)")
    provided = headers.get(INTERNAL_SECRET_HEADER)
    if not provided:
        raise HTTPException(status_code=401, detail="unauthorized")
    if not _secrets_equal(provided, secret):
        raise HTTPException(status_code=401, detail="内部密钥不匹配")
    return AuthResult(via="legacy", subject=None)
