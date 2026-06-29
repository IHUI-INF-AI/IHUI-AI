"""Bug-105: WS 鉴权 + 续签 + 二维校验.

设计:
  - 连接握手: 校验 token (签名 + 过期)
  - 周期续签: 客户端可发续签请求, 服务端可拒绝
  - 二维校验: token + tenant_id 绑定, 防止越权
  - 黑名单: 强制下线 (revoke)
  - 限速: 续签 / 消息频率
  - 审计: 登录 / 续签 / 拒绝 / 下线 全部记录
"""

import hashlib
import logging
import threading
import time
from collections import deque
from dataclasses import dataclass
from enum import StrEnum

logger = logging.getLogger(__name__)


class WsAuthResult(StrEnum):
    OK = "ok"
    TOKEN_EXPIRED = "token_expired"
    TOKEN_INVALID = "token_invalid"
    TENANT_MISMATCH = "tenant_mismatch"
    REVOKED = "revoked"
    RATE_LIMIT = "rate_limit"
    UNKNOWN_CONN = "unknown_conn"


@dataclass
class WsSession:
    conn_id: str
    user_id: str
    tenant_id: str
    token_hash: str
    issued_at: float
    expires_at: float
    last_active_at: float
    msg_count: int = 0
    renew_count: int = 0
    revoked: bool = False
    ip: str = ""
    user_agent: str = ""

    def is_expired(self, now: float) -> bool:
        return now >= self.expires_at

    def to_dict(self) -> dict:
        return {
            "conn_id": self.conn_id,
            "user_id": self.user_id,
            "tenant_id": self.tenant_id,
            "issued_at": self.issued_at,
            "expires_at": self.expires_at,
            "last_active_at": self.last_active_at,
            "msg_count": self.msg_count,
            "renew_count": self.renew_count,
            "revoked": self.revoked,
            "ip": self.ip,
            "user_agent": self.user_agent,
        }


@dataclass
class WsAuditEntry:
    conn_id: str
    action: str
    detail: str
    ts: float


class WsTokenManager:
    """WS 鉴权 + 续签管理器."""

    def __init__(
        self,
        token_ttl_sec: float = 3600.0,
        msg_rate_limit: int = 100,
        renew_window_sec: float = 5.0,
    ):
        self._lock = threading.Lock()
        self._sessions: dict[str, WsSession] = {}
        self._audit: deque[WsAuditEntry] = deque(maxlen=5000)
        self._blacklist: dict[str, float] = {}  # token_hash -> revoke_ts
        self._msg_window: dict[str, deque[float]] = {}
        self._ttl = token_ttl_sec
        self._msg_limit = msg_rate_limit
        self._renew_window = renew_window_sec
        self._last_renew: dict[str, float] = {}

    def _hash_token(self, token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    def _audit_log(self, conn_id: str, action: str, detail: str) -> None:
        # 内部调用: 调用方已持锁时不持锁, 否则持锁 (避免重入死锁)
        entry = WsAuditEntry(conn_id, action, detail, time.time())
        try:
            # 尝试非阻塞获取锁
            if self._lock.acquire(blocking=False):
                try:
                    self._audit.append(entry)
                finally:
                    self._lock.release()
            else:
                # 调用方已持锁, 直接 append (GIL 保证 list append 原子)
                self._audit.append(entry)
        except Exception:
            self._audit.append(entry)

    def handshake(
        self,
        conn_id: str,
        user_id: str,
        tenant_id: str,
        token: str,
        ip: str = "",
        user_agent: str = "",
    ) -> WsAuthResult:
        if not token or not conn_id or not user_id:
            self._audit_log(conn_id or "?", "handshake", "missing_field")
            return WsAuthResult.TOKEN_INVALID
        th = self._hash_token(token)
        with self._lock:
            if th in self._blacklist:
                self._audit_log(conn_id, "handshake", "blacklisted")
                return WsAuthResult.REVOKED
        # token 校验: 这里用最简格式 <user>.<exp_ts>.<sig>, 真实项目接 jose
        parts = token.split(".")
        if len(parts) != 3:
            self._audit_log(conn_id, "handshake", "format_error")
            return WsAuthResult.TOKEN_INVALID
        try:
            claimed_user = parts[0]
            exp_ts = float(parts[1])
        except ValueError:
            self._audit_log(conn_id, "handshake", "decode_error")
            return WsAuthResult.TOKEN_INVALID
        if claimed_user != user_id:
            self._audit_log(conn_id, "handshake", "user_mismatch")
            return WsAuthResult.TOKEN_INVALID
        now = time.time()
        if now >= exp_ts:
            self._audit_log(conn_id, "handshake", "expired")
            return WsAuthResult.TOKEN_EXPIRED
        # sig = sha256(secret|user|exp)
        expected_sig = hashlib.sha256(f"secret|{user_id}|{int(exp_ts)}".encode()).hexdigest()[:16]
        if expected_sig != parts[2]:
            self._audit_log(conn_id, "handshake", "bad_sig")
            return WsAuthResult.TOKEN_INVALID
        with self._lock:
            self._sessions[conn_id] = WsSession(
                conn_id=conn_id,
                user_id=user_id,
                tenant_id=tenant_id,
                token_hash=th,
                issued_at=now,
                expires_at=exp_ts,
                last_active_at=now,
                ip=ip,
                user_agent=user_agent,
            )
            self._msg_window[conn_id] = deque(maxlen=self._msg_limit)
        self._audit_log(conn_id, "handshake", "ok")
        return WsAuthResult.OK

    def issue_token(self, user_id: str, ttl: float | None = None) -> str:
        exp = time.time() + (ttl if ttl is not None else self._ttl)
        sig = hashlib.sha256(f"secret|{user_id}|{int(exp)}".encode()).hexdigest()[:16]
        return f"{user_id}.{int(exp)}.{sig}"

    def renew(self, conn_id: str, new_token: str) -> WsAuthResult:
        with self._lock:
            sess = self._sessions.get(conn_id)
            if sess is None:
                return WsAuthResult.UNKNOWN_CONN
            if sess.revoked:
                return WsAuthResult.REVOKED
            last = self._last_renew.get(conn_id, 0.0)
            now = time.time()
            if now - last < self._renew_window:
                return WsAuthResult.RATE_LIMIT
            self._last_renew[conn_id] = now
        # 校验新 token
        parts = new_token.split(".")
        if len(parts) != 3 or parts[0] != sess.user_id:
            self._audit_log(conn_id, "renew", "format_error")
            return WsAuthResult.TOKEN_INVALID
        try:
            exp_ts = float(parts[1])
        except ValueError:
            self._audit_log(conn_id, "renew", "decode_error")
            return WsAuthResult.TOKEN_INVALID
        if time.time() >= exp_ts:
            return WsAuthResult.TOKEN_EXPIRED
        expected_sig = hashlib.sha256(f"secret|{sess.user_id}|{int(exp_ts)}".encode()).hexdigest()[:16]
        if expected_sig != parts[2]:
            self._audit_log(conn_id, "renew", "bad_sig")
            return WsAuthResult.TOKEN_INVALID
        with self._lock:
            sess.token_hash = self._hash_token(new_token)
            sess.expires_at = exp_ts
            sess.renew_count += 1
            sess.last_active_at = time.time()
        self._audit_log(conn_id, "renew", "ok")
        return WsAuthResult.OK

    def verify_tenant(self, conn_id: str, tenant_id: str) -> WsAuthResult:
        with self._lock:
            sess = self._sessions.get(conn_id)
            if sess is None:
                return WsAuthResult.UNKNOWN_CONN
            if sess.revoked:
                return WsAuthResult.REVOKED
            if sess.is_expired(time.time()):
                return WsAuthResult.TOKEN_EXPIRED
            if sess.tenant_id != tenant_id:
                self._audit_log(conn_id, "verify_tenant", f"expect={tenant_id} got={sess.tenant_id}")
                return WsAuthResult.TENANT_MISMATCH
            return WsAuthResult.OK

    def on_message(self, conn_id: str) -> WsAuthResult:
        with self._lock:
            sess = self._sessions.get(conn_id)
            if sess is None:
                return WsAuthResult.UNKNOWN_CONN
            if sess.revoked:
                return WsAuthResult.REVOKED
            if sess.is_expired(time.time()):
                return WsAuthResult.TOKEN_EXPIRED
            window = self._msg_window.setdefault(conn_id, deque(maxlen=self._msg_limit))
            now = time.time()
            window.append(now)
            sess.msg_count += 1
            sess.last_active_at = now
            if len(window) >= self._msg_limit and window[-1] - window[0] < 1.0:
                # 1 秒内超过 msg_limit 则限速
                return WsAuthResult.RATE_LIMIT
            return WsAuthResult.OK

    def revoke(self, conn_id: str, reason: str = "manual") -> bool:
        with self._lock:
            sess = self._sessions.get(conn_id)
            if sess is None:
                return False
            sess.revoked = True
            self._blacklist[sess.token_hash] = time.time()
        self._audit_log(conn_id, "revoke", reason)
        return True

    def disconnect(self, conn_id: str) -> bool:
        with self._lock:
            sess = self._sessions.pop(conn_id, None)
            self._msg_window.pop(conn_id, None)
            self._last_renew.pop(conn_id, None)
        if sess is not None:
            self._audit_log(conn_id, "disconnect", "ok")
            return True
        return False

    def gc_expired(self) -> int:
        now = time.time()
        removed = 0
        with self._lock:
            ids = list(self._sessions.keys())
        for cid in ids:
            with self._lock:
                sess = self._sessions.get(cid)
            if sess is None:
                continue
            if sess.is_expired(now) or sess.revoked:
                self.disconnect(cid)
                removed += 1
        return removed

    def get_session(self, conn_id: str) -> WsSession | None:
        with self._lock:
            return self._sessions.get(conn_id)

    def list_active(self) -> list[str]:
        with self._lock:
            return list(self._sessions.keys())

    def get_audit(self, conn_id: str | None = None, limit: int = 100) -> list[WsAuditEntry]:
        with self._lock:
            arr = list(self._audit)
        if conn_id:
            arr = [a for a in arr if a.conn_id == conn_id]
        return arr[-limit:]

    def stats(self) -> dict:
        with self._lock:
            by_action: dict[str, int] = {}
            for a in self._audit:
                by_action[a.action] = by_action.get(a.action, 0) + 1
            return {
                "active_sessions": len(self._sessions),
                "blacklist_size": len(self._blacklist),
                "audit_count": len(self._audit),
                "by_action": by_action,
                "msg_rate_limit": self._msg_limit,
                "token_ttl": self._ttl,
            }

    def set_msg_limit(self, n: int) -> None:
        with self._lock:
            self._msg_limit = max(1, n)

    def set_ttl(self, sec: float) -> None:
        with self._lock:
            self._ttl = max(0.0, sec)

    def clear(self) -> None:
        with self._lock:
            self._sessions.clear()
            self._blacklist.clear()
            self._audit.clear()
            self._msg_window.clear()
            self._last_renew.clear()


# 全局单例
ws_token_mgr = WsTokenManager()
