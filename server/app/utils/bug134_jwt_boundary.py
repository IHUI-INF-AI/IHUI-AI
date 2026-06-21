"""Bug-134: JWT 过期边界与刷新.
设计:
  - access token: 短期 (默认 15min)
  - refresh token: 长期 (默认 7d)
  - 边界处理: 过期前 60s 可刷新, 过期后 > N 分钟拒签
  - 滑动过期 (sliding expiration)
  - 撤销/黑名单
  - 解析失败 / 篡改 / 过期 三类异常明确
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import threading
import time
import uuid
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any


class JWTError(Exception):
    pass


class TokenState(StrEnum):
    VALID = "VALID"
    EXPIRED = "EXPIRED"
    NOT_YET_VALID = "NOT_YET_VALID"
    INVALID_SIGNATURE = "INVALID_SIGNATURE"
    MALFORMED = "MALFORMED"
    REVOKED = "REVOKED"


@dataclass
class JWTConfig:
    secret: str = "change-me-in-prod"
    algorithm: str = "HS256"
    access_ttl: int = 900
    refresh_ttl: int = 604800
    refresh_window: int = 60
    max_renew_grace: int = 300
    issuer: str = "zhs-platform"
    audience: str = "zhs-clients"


@dataclass
class JWTPayload:
    sub: str
    user_id: str
    scopes: list[str] = field(default_factory=list)
    tenant_id: str = ""
    sid: str = ""
    extra: dict[str, Any] = field(default_factory=dict)
    iat: int = 0
    exp: int = 0
    jti: str = ""


def _b64u_encode(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode("ascii")


def _b64u_decode(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def _hmac_sign(key: str, msg: str, algorithm: str = "HS256") -> str:
    digest = {
        "HS256": hashlib.sha256,
        "HS384": hashlib.sha384,
        "HS512": hashlib.sha512,
    }.get(algorithm, hashlib.sha256)
    sig = hmac.new(key.encode("utf-8"), msg.encode("utf-8"), digest).digest()
    return _b64u_encode(sig)


def _hmac_verify(key: str, msg: str, sig: str, algorithm: str = "HS256") -> bool:
    expected = _hmac_sign(key, msg, algorithm)
    return hmac.compare_digest(expected, sig)


class JWTManager:
    def __init__(self, config: JWTConfig | None = None) -> None:
        self.config = config or JWTConfig()
        self._lock = threading.RLock()
        self._revoked: dict[str, float] = {}
        self._refresh_index: dict[str, str] = {}  # refresh_jti -> access_jti
        self._stats = {"issued": 0, "verified": 0, "refreshed": 0, "rejected": 0, "revoked": 0}

    def _now(self) -> int:
        return int(time.time())

    def issue(
        self,
        user_id: str,
        scopes: list[str] | None = None,
        tenant_id: str = "",
        subject: str | None = None,
        extra: dict[str, Any] | None = None,
    ) -> tuple[str, str, JWTPayload]:
        """签发 access + refresh, 返回 (access_token, refresh_token, payload)."""
        now = self._now()
        sub = subject or user_id
        access_jti = uuid.uuid4().hex
        refresh_jti = uuid.uuid4().hex
        access_payload = {
            "sub": sub,
            "uid": user_id,
            "scopes": scopes or [],
            "tenant_id": tenant_id,
            "sid": access_jti,
            "extra": extra or {},
            "iat": now,
            "exp": now + self.config.access_ttl,
            "jti": access_jti,
            "iss": self.config.issuer,
            "aud": self.config.audience,
            "typ": "access",
        }
        refresh_payload = {
            "sub": sub,
            "uid": user_id,
            "tenant_id": tenant_id,
            "iat": now,
            "exp": now + self.config.refresh_ttl,
            "jti": refresh_jti,
            "iss": self.config.issuer,
            "aud": self.config.audience,
            "typ": "refresh",
        }
        access_token = self._encode(access_payload)
        refresh_token = self._encode(refresh_payload)
        with self._lock:
            self._refresh_index[refresh_jti] = access_jti
            self._stats["issued"] += 1
        payload = JWTPayload(
            sub=sub,
            user_id=user_id,
            scopes=scopes or [],
            tenant_id=tenant_id,
            sid=access_jti,
            extra=extra or {},
            iat=now,
            exp=now + self.config.access_ttl,
            jti=access_jti,
        )
        return access_token, refresh_token, payload

    def _encode(self, payload: dict[str, Any]) -> str:
        header = {"alg": self.config.algorithm, "typ": "JWT"}
        h = _b64u_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
        p = _b64u_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
        signing_input = f"{h}.{p}"
        sig = _hmac_sign(self.config.secret, signing_input, self.config.algorithm)
        return f"{signing_input}.{sig}"

    def _decode_raw(self, token: str) -> tuple[TokenState, dict[str, Any]]:
        if not token or not isinstance(token, str):
            return TokenState.MALFORMED, {}
        parts = token.split(".")
        if len(parts) != 3:
            return TokenState.MALFORMED, {}
        h, p, s = parts
        try:
            header = json.loads(_b64u_decode(h).decode("utf-8"))
            payload = json.loads(_b64u_decode(p).decode("utf-8"))
        except Exception:
            return TokenState.MALFORMED, {}
        if header.get("alg") != self.config.algorithm:
            return TokenState.INVALID_SIGNATURE, {}
        if not _hmac_verify(self.config.secret, f"{h}.{p}", s, self.config.algorithm):
            return TokenState.INVALID_SIGNATURE, {}
        with self._lock:
            jti = payload.get("jti", "")
            if jti in self._revoked:
                return TokenState.REVOKED, {}
        now = self._now()
        if "nbf" in payload and now < int(payload["nbf"]):
            return TokenState.NOT_YET_VALID, payload
        if "exp" in payload and now >= int(payload["exp"]):
            return TokenState.EXPIRED, payload
        return TokenState.VALID, payload

    def verify(self, token: str) -> tuple[TokenState, JWTPayload | None]:
        state, payload = self._decode_raw(token)
        with self._lock:
            self._stats["verified"] += 1
            if state != TokenState.VALID:
                self._stats["rejected"] += 1
                return state, None
        jp = JWTPayload(
            sub=payload.get("sub", ""),
            user_id=payload.get("uid", ""),
            scopes=payload.get("scopes", []),
            tenant_id=payload.get("tenant_id", ""),
            sid=payload.get("sid", ""),
            extra=payload.get("extra", {}),
            iat=payload.get("iat", 0),
            exp=payload.get("exp", 0),
            jti=payload.get("jti", ""),
        )
        return state, jp

    def can_refresh(self, access_token: str) -> bool:
        """access 过期前后 refresh_window 秒内可刷新."""
        state, payload = self._decode_raw(access_token)
        if state not in (TokenState.VALID, TokenState.EXPIRED):
            return False
        now = self._now()
        exp = int(payload.get("exp", 0))
        return now <= exp + self.config.refresh_window and (now - exp) <= self.config.max_renew_grace

    def refresh(self, refresh_token: str) -> tuple[str, str, JWTPayload] | None:
        state, payload = self._decode_raw(refresh_token)
        if state != TokenState.VALID:
            return None
        if payload.get("typ") != "refresh":
            return None
        with self._lock:
            rjti = payload.get("jti", "")
            old_access = self._refresh_index.pop(rjti, None)
            if old_access:
                self._revoked[old_access] = self._now()
            self._stats["refreshed"] += 1
        return self.issue(
            user_id=payload.get("uid", ""),
            scopes=None,
            tenant_id=payload.get("tenant_id", ""),
            subject=payload.get("sub", ""),
        )

    def revoke(self, access_token: str) -> bool:
        state, payload = self._decode_raw(access_token)
        if state != TokenState.VALID:
            return False
        jti = payload.get("jti", "")
        with self._lock:
            self._revoked[jti] = self._now()
            self._stats["revoked"] += 1
        return True

    def cleanup_revoked(self, max_age: int = 86400) -> int:
        with self._lock:
            now = self._now()
            old = [k for k, v in self._revoked.items() if now - v > max_age]
            for k in old:
                self._revoked.pop(k, None)
            return len(old)

    def stats(self) -> dict[str, Any]:
        with self._lock:
            return {**self._stats, "active_revoked": len(self._revoked), "refresh_pairs": len(self._refresh_index)}
