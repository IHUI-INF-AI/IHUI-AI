# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""连接器租户作用域(2026-11-23 立,多企业 SaaS)。

连接器记录此前按 ``owner_user_id`` 隔离 —— 同一企业的多个成员各自看到自己的连接器,
企业级授权无法共享;多客户 SaaS 下也没有显式租户边界。本模块把"连接器归属"收敛到
**经验证的租户成员关系**:

- 请求头 ``x-tenant-id`` 只是"想切到哪个租户"的意图,必须命中 ``tenant_members`` 才采信;
- 未带/带了非成员租户时,退回该用户最早加入的启用租户(与 API 侧
  ``resolveVerifiedTenantIdForUser`` 同口径);
- 用户没有任何租户成员关系时,退回 ``user:<id>`` 个人作用域,保证旧单租户数据仍可读。

返回值直接作为 connector_store 的属主键使用:同一租户的成员共享同一批连接器,
不同租户即使成员重叠也按各自租户隔离。数据库不可用时**不得**采信客户端请求头,
一律退回个人作用域(fail-closed)。

同一租户内还有角色边界:连接器的增删改(尤其写入企业应用凭据)只允许 owner/admin,
普通成员可读可调用但不能改共享配置 —— 否则任意员工都能接管企业集成。
"""

from __future__ import annotations

import asyncio
import logging
import re
import time
from dataclasses import dataclass
from typing import Any

from fastapi import Request

logger = logging.getLogger(__name__)

# 租户标识字符集:UUID 或 slug(与 API 侧 slugRegex 对齐,挡掉空白/控制字符)
_TENANT_TOKEN_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$")
_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I
)

_HEADER = "x-tenant-id"
_CACHE_TTL_S = 60.0
_CACHE_MAX = 4096
_DB_TIMEOUT_S = 2.0

_SQL_MEMBER_TENANT = """
SELECT tm.tenant_id::text AS tenant_id, tm.role
FROM tenant_members tm
JOIN tenants t ON t.id = tm.tenant_id
WHERE tm.user_id::text = $1
  AND (t.id::text = $2 OR t.slug = $2)
  AND t.status = 1
LIMIT 1
"""

_SQL_FIRST_TENANT = """
SELECT tm.tenant_id::text AS tenant_id, tm.role
FROM tenant_members tm
JOIN tenants t ON t.id = tm.tenant_id
WHERE tm.user_id::text = $1
  AND t.status = 1
ORDER BY tm.joined_at ASC
LIMIT 1
"""

_ADMIN_ROLES = {"owner", "admin"}

_cache: dict[tuple[str, str], tuple["ConnectorScope", float]] = {}


@dataclass(frozen=True)
class ConnectorScope:
    """已校验的连接器归属上下文。"""

    scope: str
    tenant_id: str | None
    role: str
    tenant_mode: bool

    @property
    def can_manage(self) -> bool:
        """能否增删改共享连接器。个人作用域视为自己的 owner。"""
        return not self.tenant_mode or self.role in _ADMIN_ROLES


def _personal_context(user_id: str) -> ConnectorScope:
    # 保持旧记录的属主键原样:没有租户成员关系的用户继续按自己的 user_id 存取
    return ConnectorScope(scope=user_id, tenant_id=None, role="owner", tenant_mode=False)


def _header_value(request: Request) -> str:
    raw = (request.headers.get(_HEADER) or "").strip()
    return raw if _TENANT_TOKEN_RE.match(raw) else ""


def _cache_get(key: tuple[str, str]) -> ConnectorScope | None:
    item = _cache.get(key)
    if not item:
        return None
    ctx, exp = item
    if exp <= time.monotonic():
        _cache.pop(key, None)
        return None
    return ctx


def _cache_put(key: tuple[str, str], ctx: ConnectorScope) -> None:
    if len(_cache) >= _CACHE_MAX:
        # 简单批量淘汰:清掉最早插入的 1/8,避免无界增长
        for k in list(_cache.keys())[: _CACHE_MAX // 8]:
            _cache.pop(k, None)
    _cache[key] = (ctx, time.monotonic() + _CACHE_TTL_S)


def clear_scope_cache() -> None:
    """测试/租户变更后清缓存。"""
    _cache.clear()


async def _lookup_membership(user_id: str, preferred: str) -> tuple[str, str] | None:
    """查经验证的租户归属与角色;任何异常都返回 None,由调用方退回个人作用域。"""
    try:
        from app.core.db import get_db_conn

        conn = await asyncio.wait_for(get_db_conn(), timeout=_DB_TIMEOUT_S)
        try:
            if preferred:
                row = await asyncio.wait_for(
                    conn.fetchrow(_SQL_MEMBER_TENANT, user_id, preferred),
                    timeout=_DB_TIMEOUT_S,
                )
                if row:
                    return str(row["tenant_id"]), str(row["role"])
            row = await asyncio.wait_for(
                conn.fetchrow(_SQL_FIRST_TENANT, user_id),
                timeout=_DB_TIMEOUT_S,
            )
            if row:
                return str(row["tenant_id"]), str(row["role"])
            return None
        finally:
            await conn.close()
    except Exception as e:  # noqa: BLE001 - 租户解析失败不得冒成 500
        logger.warning("连接器租户作用域解析失败,退回个人作用域: %s", e)
        return None


async def resolve_connector_context(request: Request, user_id: str) -> ConnectorScope:
    """解析当前请求的连接器归属上下文(租户 ID + 角色,或个人作用域)。"""
    if not _UUID_RE.match(user_id):
        # 真实令牌主体是 UUID;非 UUID 只可能是测试/内部通道,不查库
        return _personal_context(user_id)
    preferred = _header_value(request)
    cache_key = (user_id, preferred)
    cached = _cache_get(cache_key)
    if cached:
        return cached

    membership = await _lookup_membership(user_id, preferred)
    if membership:
        tenant_id, role = membership
        ctx = ConnectorScope(
            scope=tenant_id, tenant_id=tenant_id, role=role, tenant_mode=True
        )
    else:
        ctx = _personal_context(user_id)
    _cache_put(cache_key, ctx)
    return ctx


async def resolve_connector_scope(request: Request, user_id: str) -> str:
    """兼容入口:只返回作用域键(测试与旧调用方使用)。"""
    ctx = await resolve_connector_context(request, user_id)
    return ctx.scope


__all__ = [
    "ConnectorScope",
    "clear_scope_cache",
    "resolve_connector_context",
    "resolve_connector_scope",
]


def _debug_state() -> dict[str, Any]:
    """测试辅助:不对外暴露。"""
    return {"size": len(_cache)}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
