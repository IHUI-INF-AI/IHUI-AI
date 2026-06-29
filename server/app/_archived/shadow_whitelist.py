"""影子流量端点白名单 (建议 122).

设计:
  - 白名单模式 (默认): 仅在 SHADOW_ALLOWED_ENDPOINTS 内的端点打影子
  - 黑名单模式: SHADOW_ALLOWED_DENY 内的端点永远不打
  - 模式切换: ZHS_SHADOW_WHITELIST_MODE = "allow" | "deny"
  - 动态管理: add_endpoint / remove_endpoint / 运行时切换模式
  - 路径匹配: 前缀匹配 + 完整匹配, 支持 /api/v1/orders/* 通配

开关:
  - ZHS_SHADOW_WHITELIST_MODE = allow (默认) | deny
  - ZHS_SHADOW_ALLOWED_ENDPOINTS = "/api/v1/orders,/api/v1/agents/list"  # 逗号分隔
  - ZHS_SHADOW_BLOCKED_ENDPOINTS = "/api/v1/payment/*,/api/v1/withdraw/*"
"""

from __future__ import annotations

import fnmatch
import os
import threading
from collections.abc import Iterable

# ---------------------------------------------------------------------------
# 配置
# ---------------------------------------------------------------------------

_ALLOWED_DEFAULT = {
    # 默认白名单: 只读 + 非敏感 (业务可调)
    "GET /api/v1/orders",
    "GET /api/v1/orders/*",
    "GET /api/v1/agents/list",
    "GET /api/v1/agents/*",
    "GET /api/v1/courses/list",
    "GET /api/v1/courses/*",
    "GET /api/v1/users/me",
    "GET /api/v1/users/profile/*",
    "GET /api/v1/finance/balance",
    "GET /api/v1/finance/transactions",
}

_BLOCKED_DEFAULT = {
    # 默认黑名单: 写操作 + 敏感接口
    "* /api/v1/payment*",
    "* /api/v1/withdraw*",
    "* /api/v1/transfer*",
    "POST /api/v1/auth/*",
    "POST /api/v1/oauth/token",
    "* /api/v1/admin/*",
    "* /api/v1/sys/*",
}


def _mode() -> str:
    m = os.getenv("ZHS_SHADOW_WHITELIST_MODE", "allow").lower().strip()
    return m if m in ("allow", "deny") else "allow"


def _parse_env_list(name: str) -> list[str]:
    raw = os.getenv(name, "").strip()
    if not raw:
        return []
    return [x.strip() for x in raw.split(",") if x.strip()]


# ---------------------------------------------------------------------------
# 白名单管理器
# ---------------------------------------------------------------------------


class ShadowWhitelist:
    """白名单 / 黑名单管理 (线程安全)."""

    def __init__(
        self, allowed: Iterable[str] | None = None, blocked: Iterable[str] | None = None, mode: str | None = None
    ):
        self._allowed: set[str] = set(allowed if allowed is not None else _ALLOWED_DEFAULT)
        self._blocked: set[str] = set(blocked if blocked is not None else _BLOCKED_DEFAULT)
        self._mode: str = mode if mode is not None else _mode()
        self._lock = threading.RLock()
        # 模式变更历史 (排障)
        self._history: list[dict] = []

    # ---------- 模式 ----------
    @property
    def mode(self) -> str:
        with self._lock:
            return self._mode

    def set_mode(self, mode: str) -> None:
        if mode not in ("allow", "deny"):
            raise ValueError(f"mode 必须是 'allow' 或 'deny', 实际 {mode!r}")
        with self._lock:
            old = self._mode
            self._mode = mode
            self._history.append(
                {
                    "ts": __import__("time").time(),
                    "action": "set_mode",
                    "from": old,
                    "to": mode,
                }
            )

    # ---------- 白名单 ----------
    def get_allowed(self) -> set[str]:
        with self._lock:
            return set(self._allowed)

    def add_allowed(self, patterns: str | Iterable[str]) -> int:
        """添加白名单端点, 返回新增数."""
        new = [patterns] if isinstance(patterns, str) else list(patterns)
        with self._lock:
            before = len(self._allowed)
            self._allowed.update(new)
            added = len(self._allowed) - before
            if added > 0:
                self._history.append(
                    {
                        "ts": __import__("time").time(),
                        "action": "add_allowed",
                        "items": new,
                        "count": added,
                    }
                )
            return added

    def remove_allowed(self, patterns: str | Iterable[str]) -> int:
        rm = [patterns] if isinstance(patterns, str) else list(patterns)
        with self._lock:
            before = len(self._allowed)
            for p in rm:
                self._allowed.discard(p)
            removed = before - len(self._allowed)
            if removed > 0:
                self._history.append(
                    {
                        "ts": __import__("time").time(),
                        "action": "remove_allowed",
                        "items": rm,
                        "count": removed,
                    }
                )
            return removed

    # ---------- 黑名单 ----------
    def get_blocked(self) -> set[str]:
        with self._lock:
            return set(self._blocked)

    def add_blocked(self, patterns: str | Iterable[str]) -> int:
        new = [patterns] if isinstance(patterns, str) else list(patterns)
        with self._lock:
            before = len(self._blocked)
            self._blocked.update(new)
            added = len(self._blocked) - before
            if added > 0:
                self._history.append(
                    {
                        "ts": __import__("time").time(),
                        "action": "add_blocked",
                        "items": new,
                        "count": added,
                    }
                )
            return added

    def remove_blocked(self, patterns: str | Iterable[str]) -> int:
        rm = [patterns] if isinstance(patterns, str) else list(patterns)
        with self._lock:
            before = len(self._blocked)
            for p in rm:
                self._blocked.discard(p)
            removed = before - len(self._blocked)
            if removed > 0:
                self._history.append(
                    {
                        "ts": __import__("time").time(),
                        "action": "remove_blocked",
                        "items": rm,
                        "count": removed,
                    }
                )
            return removed

    # ---------- 判定 ----------
    def should_shadow_endpoint(self, method: str, path: str) -> bool:
        """判定指定 endpoint 是否应打影子.

        优先级: 黑名单 > 白名单
          1. 黑名单命中 → False (永远不打)
          2. 黑名单未命中:
            - allow 模式: 白名单命中 → True
            - deny  模式: 白名单未命中 → True (白名单是排除项)
        """
        with self._lock:
            blocked = self._blocked
            allowed = self._allowed
            mode = self._mode

        key = f"{method.upper()} {path}"

        # 1) 黑名单优先
        if self._match_any(key, blocked):
            return False

        # 2) 白名单
        if mode == "allow":
            return self._match_any(key, allowed)
        else:  # deny
            # 黑名单之外都打
            return not self._match_any(key, allowed)

    @staticmethod
    def _match_any(key: str, patterns: Iterable[str]) -> bool:
        """key 是否匹配任一 pattern (支持 fnmatch 通配)."""
        for p in patterns:
            # 1) 精确匹配
            if key == p:
                return True
            # 2) fnmatch (处理 * 通配)
            if fnmatch.fnmatch(key, p):
                return True
            # 3) 路径部分通配: "GET /api/v1/orders/*" 匹配 "GET /api/v1/orders/123"
            if " " in p:
                p_method, p_path = p.split(" ", 1)
                if key.startswith(p_method + " ") and fnmatch.fnmatch(key[len(p_method) + 1 :], p_path):
                    return True
        return False

    # ---------- 快照 ----------
    def snapshot(self) -> dict:
        with self._lock:
            return {
                "mode": self._mode,
                "allowed_count": len(self._allowed),
                "blocked_count": len(self._blocked),
                "allowed_sample": sorted(self._allowed)[:10],
                "blocked_sample": sorted(self._blocked)[:10],
                "history": list(self._history[-20:]),
            }

    def clear_history(self) -> None:
        with self._lock:
            self._history.clear()


# ---------------------------------------------------------------------------
# 全局默认 + 工厂
# ---------------------------------------------------------------------------

_DEFAULT_WHITELIST: ShadowWhitelist | None = None
_DEFAULT_LOCK = threading.Lock()


def get_default_whitelist() -> ShadowWhitelist:
    global _DEFAULT_WHITELIST
    with _DEFAULT_LOCK:
        if _DEFAULT_WHITELIST is None:
            allowed = set(_ALLOWED_DEFAULT) | set(_parse_env_list("ZHS_SHADOW_ALLOWED_ENDPOINTS"))
            blocked = set(_BLOCKED_DEFAULT) | set(_parse_env_list("ZHS_SHADOW_BLOCKED_ENDPOINTS"))
            _DEFAULT_WHITELIST = ShadowWhitelist(allowed=allowed, blocked=blocked)
        return _DEFAULT_WHITELIST


def reset_default_whitelist() -> None:
    global _DEFAULT_WHITELIST
    with _DEFAULT_LOCK:
        _DEFAULT_WHITELIST = None
