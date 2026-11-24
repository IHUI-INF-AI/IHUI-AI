# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""租户级平台应用凭据读取(2026-11-23 立)。

多企业 SaaS 下,飞书/钉钉/企微/公众号的应用凭据按租户存在
``tenant_platform_apps`` 表;ai-service 不经过 API,直接读共享 PostgreSQL,
并用与 Node 侧同源的 ``CREDENTIALS_ENCRYPTION_KEY`` 解 ``enc:v1`` 密文。

- 只有租户 UUID 作用域才查库;``user:<id>`` 个人作用域不查,由调用方回退环境凭据。
- 查不到行返回 ``None``,绝不把别的租户的凭据借用过来。
- 查到行但 ``enabled=false`` / 凭据不完整时返回状态标记,调用方必须拒绝并禁止回退
  环境凭据 —— 租户管理员的停用不能被平台环境变量悄悄覆盖。
- 表不存在/连接失败也返回 ``None``,由调用方按"该租户未配置"降级,不静默共享环境凭据。
"""

from __future__ import annotations

import base64
import json
import re
import threading
import time
from typing import Any

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.config import settings
from app.core.pg_sync import SyncPgSession

_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)
_CACHE_TTL_SECONDS = 60.0

_SQL = """
SELECT app_id, app_secret, extra, enabled
FROM tenant_platform_apps
WHERE tenant_id = $1::uuid
  AND platform = $2
LIMIT 1
"""

_cache: dict[tuple[str, str], tuple[float, dict[str, Any] | None]] = {}
_cache_lock = threading.Lock()
_pg: SyncPgSession | None = None
_pg_lock = threading.Lock()


def _pg_session() -> SyncPgSession | None:
    global _pg
    if _pg is not None:
        return _pg
    with _pg_lock:
        if _pg is not None:
            return _pg
        dsn = str(getattr(settings, "database_url", "") or "").strip()
        if not dsn:
            return None
        try:
            _pg = SyncPgSession(dsn, timeout=10.0)
        except Exception:
            _pg = None
        return _pg


def _decrypt_secret(stored: str) -> str:
    """解 Node ``enc:v1:<iv>:<tag>:<ciphertext>``;存量明文原样返回。"""
    if not stored:
        return ""
    if not stored.startswith("enc:v1:"):
        return stored
    parts = stored[len("enc:v1:") :].split(":")
    if len(parts) != 3:
        raise ValueError("凭据密文格式非法:字段数不为 3")
    iv_b64, tag_b64, ciphertext_b64 = parts
    key_text = str(getattr(settings, "credentials_encryption_key", "") or "")
    key = key_text.encode("utf-8")[:32]
    if len(key) < 32:
        raise ValueError("CREDENTIALS_ENCRYPTION_KEY 少于 32 字节")
    iv = base64.b64decode(iv_b64)
    tag = base64.b64decode(tag_b64)
    ciphertext = base64.b64decode(ciphertext_b64)
    plaintext = AESGCM(key).decrypt(iv, ciphertext + tag, None)
    return plaintext.decode("utf-8")


def _extra_dict(raw: Any) -> dict[str, str]:
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except Exception:
            return {}
    if not isinstance(raw, dict):
        return {}
    return {str(k): str(v) for k, v in raw.items() if isinstance(v, str) and v.strip()}


def resolve_tenant_platform_credentials(
    tenant_id: str | None,
    platform: str,
) -> dict[str, Any] | None:
    """返回租户行状态;无行返回 None。

    有行时返回 ``{app_id, app_secret, extra, source:'tenant', enabled, complete}``。
    ``enabled=False`` / ``complete=False`` 是状态标记，调用方必须据此拒绝并**禁止**
    回退环境凭据 —— 租户管理员显式停用或漏填 secret 时，环境里的平台凭据不能
    悄悄把这行“复活”。
    """
    tenant = str(tenant_id or "").strip()
    if not tenant or not _UUID_RE.match(tenant):
        return None
    key = (tenant, platform)
    now = time.monotonic()
    with _cache_lock:
        cached = _cache.get(key)
        if cached and cached[0] > now:
            return dict(cached[1]) if cached[1] else None

    result: dict[str, Any] | None = None
    session = _pg_session()
    if session is not None:
        try:
            row = session.fetchrow(_SQL, (tenant, platform))
        except Exception:
            row = None
        if row is not None:
            app_id = str(row["app_id"] or "")
            stored_secret = str(row["app_secret"] or "")
            try:
                app_secret = _decrypt_secret(stored_secret)
            except Exception:
                app_secret = ""
            enabled = bool(row["enabled"])
            complete = bool(app_id and app_secret) and enabled
            result = {
                "app_id": app_id if complete else "",
                "app_secret": app_secret if complete else "",
                "extra": _extra_dict(row["extra"]),
                "source": "tenant",
                "enabled": enabled,
                "complete": complete,
            }

    with _cache_lock:
        _cache[key] = (now + _CACHE_TTL_SECONDS, dict(result) if result else None)
    return result


def clear_tenant_platform_cache() -> None:
    with _cache_lock:
        _cache.clear()


def platform_default_tenant_id() -> str:
    return str(getattr(settings, "platform_default_tenant_id", "") or "").strip()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
