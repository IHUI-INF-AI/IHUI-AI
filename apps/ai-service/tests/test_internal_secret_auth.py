# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""X-Internal-Secret 族入站验票器行为测试(2026-11-06)。

钉住:
  ① 默认 ticket 档:有效票放行;只带旧密钥 ⇒ 401。
  ② 错用途 / 重放 / 共享状态不可用 ⇒ 401(fail-closed),不降级。
  ③ 显式 dual 档:旧密钥放行;坏票 + 对的旧密钥仍拒(不回落)。
"""

from __future__ import annotations

import time

import jwt
import pytest
from fastapi import HTTPException

from app.core.config import settings
from app.core.internal_secret_auth import (
    INTERNAL_TICKET_HEADER,
    authorize_internal_secret_call,
    set_replay_store_for_tests,
)
from app.core.internal_ticket import (
    INTERNAL_TICKET_ALGORITHM,
    INTERNAL_TICKET_AUDIENCE,
    INTERNAL_TICKET_TYPE,
    mint_internal_service_ticket,
)

SECRET = "ai-service-internal-secret-ticket-key-0123456789abcdef"


class MemoryReplayStore:
    """一次性消费语义的进程内替身。"""

    def __init__(self) -> None:
        self.seen: set[str] = set()

    async def consume(self, jti: str, ttl_seconds: int) -> str:
        if jti in self.seen:
            return "replayed"
        self.seen.add(jti)
        return "consumed"


@pytest.fixture
def store() -> MemoryReplayStore:
    mem = MemoryReplayStore()
    set_replay_store_for_tests(mem)
    yield mem
    set_replay_store_for_tests(None)


def _mint(scope: str = "checkin-pool", subject: str = "service:apps-api") -> str:
    ticket = mint_internal_service_ticket(subject, scope)
    assert ticket, "测试前置:JWT_SECRET 必须可用"
    return ticket


@pytest.mark.asyncio
async def test_ticket_mode_accepts_valid_ticket(monkeypatch, store):
    monkeypatch.setattr(settings, "internal_secret_auth_mode", "ticket")
    monkeypatch.setattr(settings, "jwt_secret", SECRET)
    result = await authorize_internal_secret_call(
        {INTERNAL_TICKET_HEADER: _mint()}, expected_scope="checkin-pool"
    )
    assert result.via == "ticket"
    assert result.subject == "service:apps-api"


@pytest.mark.asyncio
async def test_ticket_mode_rejects_legacy_secret(monkeypatch, store):
    monkeypatch.setattr(settings, "internal_secret_auth_mode", "ticket")
    monkeypatch.setattr(settings, "ai_callback_secret", SECRET)
    with pytest.raises(HTTPException) as exc:
        await authorize_internal_secret_call(
            {"x-internal-secret": SECRET}, expected_scope="checkin-pool"
        )
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_wrong_scope_rejected(monkeypatch, store):
    monkeypatch.setattr(settings, "internal_secret_auth_mode", "ticket")
    monkeypatch.setattr(settings, "jwt_secret", SECRET)
    ticket = _mint(scope="knowledge-card")
    with pytest.raises(HTTPException) as exc:
        await authorize_internal_secret_call(
            {INTERNAL_TICKET_HEADER: ticket}, expected_scope="checkin-pool"
        )
    assert exc.value.status_code == 401
    assert exc.value.detail == "unauthorized"


@pytest.mark.asyncio
async def test_replayed_ticket_rejected(monkeypatch, store):
    monkeypatch.setattr(settings, "internal_secret_auth_mode", "ticket")
    monkeypatch.setattr(settings, "jwt_secret", SECRET)
    ticket = _mint()
    first = await authorize_internal_secret_call(
        {INTERNAL_TICKET_HEADER: ticket}, expected_scope="checkin-pool"
    )
    assert first.via == "ticket"
    with pytest.raises(HTTPException) as exc:
        await authorize_internal_secret_call(
            {INTERNAL_TICKET_HEADER: ticket}, expected_scope="checkin-pool"
        )
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_replay_store_unavailable_fails_closed(monkeypatch):
    monkeypatch.setattr(settings, "internal_secret_auth_mode", "ticket")
    monkeypatch.setattr(settings, "jwt_secret", SECRET)
    monkeypatch.setattr(settings, "redis_url", "")

    class Down:
        async def consume(self, jti: str, ttl_seconds: int) -> str:
            from app.core.internal_secret_auth import ReplayStoreUnavailable

            raise ReplayStoreUnavailable("redis down")

    set_replay_store_for_tests(Down())
    try:
        with pytest.raises(HTTPException) as exc:
            await authorize_internal_secret_call(
                {INTERNAL_TICKET_HEADER: _mint()}, expected_scope="checkin-pool"
            )
        assert exc.value.status_code == 401
    finally:
        set_replay_store_for_tests(None)


@pytest.mark.asyncio
async def test_dual_mode_accepts_legacy_secret(monkeypatch, store):
    monkeypatch.setattr(settings, "internal_secret_auth_mode", "dual")
    monkeypatch.setattr(settings, "ai_callback_secret", SECRET)
    result = await authorize_internal_secret_call(
        {"x-internal-secret": SECRET}, expected_scope="checkin-pool"
    )
    assert result.via == "legacy"


@pytest.mark.asyncio
async def test_dual_mode_bad_ticket_never_falls_back_to_legacy(monkeypatch, store):
    monkeypatch.setattr(settings, "internal_secret_auth_mode", "dual")
    monkeypatch.setattr(settings, "ai_callback_secret", SECRET)
    with pytest.raises(HTTPException) as exc:
        await authorize_internal_secret_call(
            {INTERNAL_TICKET_HEADER: "not-a-jwt", "x-internal-secret": SECRET},
            expected_scope="checkin-pool",
        )
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_too_long_lived_ticket_rejected(monkeypatch, store):
    monkeypatch.setattr(settings, "internal_secret_auth_mode", "ticket")
    monkeypatch.setattr(settings, "jwt_secret", SECRET)
    now = int(time.time())
    forged = jwt.encode(
        {
            "sub": "service:apps-api",
            "aud": INTERNAL_TICKET_AUDIENCE,
            "type": INTERNAL_TICKET_TYPE,
            "scope": "checkin-pool",
            "jti": "manual-jti",
            "iat": now,
            "exp": now + 3600,
        },
        SECRET,
        algorithm=INTERNAL_TICKET_ALGORITHM,
    )
    with pytest.raises(HTTPException) as exc:
        await authorize_internal_secret_call(
            {INTERNAL_TICKET_HEADER: forged}, expected_scope="checkin-pool"
        )
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_expired_ticket_rejected(monkeypatch, store):
    monkeypatch.setattr(settings, "internal_secret_auth_mode", "ticket")
    monkeypatch.setattr(settings, "jwt_secret", SECRET)
    now = int(time.time())
    expired = jwt.encode(
        {
            "sub": "service:apps-api",
            "aud": INTERNAL_TICKET_AUDIENCE,
            "type": INTERNAL_TICKET_TYPE,
            "scope": "checkin-pool",
            "jti": "expired-jti",
            "iat": now - 120,
            "exp": now - 60,
        },
        SECRET,
        algorithm=INTERNAL_TICKET_ALGORITHM,
    )
    with pytest.raises(HTTPException) as exc:
        await authorize_internal_secret_call(
            {INTERNAL_TICKET_HEADER: expired}, expected_scope="checkin-pool"
        )
    assert exc.value.status_code == 401


def test_unknown_mode_falls_back_to_ticket(monkeypatch, store):
    monkeypatch.setattr(settings, "internal_secret_auth_mode", "typo")
    assert verify_internal_secret_mode() == "ticket"


def test_prompt_scan_bypass_accepts_only_matching_scope(monkeypatch, store):
    from app.core.internal_secret_auth import allow_prompt_scan_bypass

    monkeypatch.setattr(settings, "internal_secret_auth_mode", "ticket")
    monkeypatch.setattr(settings, "jwt_secret", SECRET)
    good = _mint(scope="prompt-scan-bypass")
    assert allow_prompt_scan_bypass({INTERNAL_TICKET_HEADER: good}) is True
    bad = _mint(scope="checkin-pool")
    assert allow_prompt_scan_bypass({INTERNAL_TICKET_HEADER: bad}) is False


def test_prompt_scan_bypass_ticket_mode_rejects_legacy(monkeypatch, store):
    from app.core.internal_secret_auth import allow_prompt_scan_bypass

    monkeypatch.setattr(settings, "internal_secret_auth_mode", "ticket")
    monkeypatch.setattr(settings, "ai_callback_secret", SECRET)
    assert allow_prompt_scan_bypass({"x-internal-secret": SECRET}) is False


def test_prompt_scan_bypass_dual_accepts_legacy(monkeypatch, store):
    from app.core.internal_secret_auth import allow_prompt_scan_bypass

    monkeypatch.setattr(settings, "internal_secret_auth_mode", "dual")
    monkeypatch.setattr(settings, "ai_callback_secret", SECRET)
    assert allow_prompt_scan_bypass({"x-internal-secret": SECRET}) is True


def verify_internal_secret_mode() -> str:
    from app.core.internal_secret_auth import auth_mode

    return auth_mode()
