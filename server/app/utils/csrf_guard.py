"""Bug-136: CSRF Token 跨域隔离.
设计:
  - 双提交 Cookie 模式: csrf_cookie + csrf_header
  - 一次性 token (one-time), 用完即焚
  - 来源 (Origin / Referer) 校验白名单
  - 会话绑定 (session_id -> csrf_token)
  - 滑动续期 (可选)
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
import threading
import time
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any


class CSRFError(Exception):
    pass


class CSRFState(StrEnum):
    VALID = "VALID"
    MISSING = "MISSING"
    MISMATCH = "MISMATCH"
    EXPIRED = "EXPIRED"
    USED = "USED"
    ORIGIN_DENIED = "ORIGIN_DENIED"
    SESSION_MISMATCH = "SESSION_MISMATCH"


@dataclass
class CSRFConfig:
    secret: str = "csrf-secret"
    ttl: int = 3600
    one_time: bool = True
    allowed_origins: set[str] = field(default_factory=lambda: {"https://app.example.com"})
    cookie_name: str = "csrf_token"
    header_name: str = "X-CSRF-Token"
    sliding_renew: bool = True


@dataclass
class CSRFToken:
    token: str
    session_id: str
    created_at: float = field(default_factory=time.time)
    expires_at: float = 0.0
    used: bool = False


class CSRFGuard:
    """CSRF 防护器 (双提交 + 一次性 + 来源校验)."""

    def __init__(self, config: CSRFConfig | None = None) -> None:
        self.config = config or CSRFConfig()
        self._lock = threading.RLock()
        self._tokens: dict[str, CSRFToken] = {}
        self._session_index: dict[str, set[str]] = {}
        self._stats = {"issued": 0, "validated": 0, "rejected": 0}

    def _now(self) -> float:
        return time.time()

    def _sign(self, value: str) -> str:
        sig = hmac.new(self.config.secret.encode("utf-8"), value.encode("utf-8"), hashlib.sha256).hexdigest()[:16]
        return f"{value}.{sig}"

    def _verify_sig(self, signed: str) -> str | None:
        if "." not in signed:
            return None
        value, sig = signed.rsplit(".", 1)
        expected = hmac.new(self.config.secret.encode("utf-8"), value.encode("utf-8"), hashlib.sha256).hexdigest()[:16]
        if not hmac.compare_digest(sig, expected):
            return None
        return value

    def _purge(self) -> None:
        with self._lock:
            now = self._now()
            expired = [k for k, t in self._tokens.items() if t.expires_at > 0 and now > t.expires_at]
            for k in expired:
                t = self._tokens.pop(k, None)
                if t is not None:
                    sess_tokens = self._session_index.get(t.session_id)
                    if sess_tokens is not None:
                        sess_tokens.discard(k)

    def issue(self, session_id: str, ttl: int | None = None) -> str:
        if not session_id:
            raise CSRFError("session_id 必填")
        self._purge()
        value = secrets.token_urlsafe(24)
        signed = self._sign(value)
        with self._lock:
            t = CSRFToken(
                token=signed,
                session_id=session_id,
                expires_at=self._now() + (ttl or self.config.ttl),
            )
            self._tokens[signed] = t
            self._session_index.setdefault(session_id, set()).add(signed)
            self._stats["issued"] += 1
        return signed

    def validate(
        self,
        cookie_token: str,
        header_token: str,
        session_id: str,
        origin: str | None = None,
        method: str = "POST",
        consume: bool = True,
    ) -> tuple[CSRFState, str]:
        # 安全方法无需校验
        if method.upper() in ("GET", "HEAD", "OPTIONS"):
            return CSRFState.VALID, "安全方法"
        # 来源校验
        if origin and not self._origin_allowed(origin):
            with self._lock:
                self._stats["rejected"] += 1
            return CSRFState.ORIGIN_DENIED, f"来源 {origin} 不在白名单"
        if not cookie_token or not header_token:
            with self._lock:
                self._stats["rejected"] += 1
            return CSRFState.MISSING, "缺少 token"
        if not hmac.compare_digest(cookie_token, header_token):
            with self._lock:
                self._stats["rejected"] += 1
            return CSRFState.MISMATCH, "cookie 与 header 不一致"
        # 验签
        raw = self._verify_sig(cookie_token)
        if raw is None:
            with self._lock:
                self._stats["rejected"] += 1
            return CSRFState.MISMATCH, "签名无效"
        with self._lock:
            t = self._tokens.get(cookie_token)
            if t is None:
                self._stats["rejected"] += 1
                return CSRFState.MISSING, "token 不存在或已回收"
            if t.session_id != session_id:
                self._stats["rejected"] += 1
                return CSRFState.SESSION_MISMATCH, "会话绑定不匹配"
            if t.used:
                self._stats["rejected"] += 1
                return CSRFState.USED, "一次性 token 已用"
            if t.expires_at > 0 and self._now() > t.expires_at:
                self._stats["rejected"] += 1
                return CSRFState.EXPIRED, "token 已过期"
            if consume and self.config.one_time:
                t.used = True
            if self.config.sliding_renew:
                t.expires_at = self._now() + self.config.ttl
            self._stats["validated"] += 1
        return CSRFState.VALID, "通过"

    def _origin_allowed(self, origin: str) -> bool:
        o = origin.lower().strip()
        for allowed in self.config.allowed_origins:
            a = allowed.lower().strip()
            if o == a:
                return True
            if a.startswith("*.") and o.endswith(a[1:]):
                return True
        return False

    def revoke_session(self, session_id: str) -> int:
        with self._lock:
            toks = self._session_index.pop(session_id, set())
            for tk in toks:
                self._tokens.pop(tk, None)
            return len(toks)

    def stats(self) -> dict[str, Any]:
        with self._lock:
            return {**self._stats, "active_tokens": len(self._tokens), "sessions": len(self._session_index)}
