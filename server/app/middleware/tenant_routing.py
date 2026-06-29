"""多租户路由 middleware (建议 118).

设计:
  - 读 X-Tenant-Id header (int)
  - 备选: JWT claim tid (AuthMiddleware 已解析 payload, 从 request.state 取)
  - 备选: 用户子账号默认 tenant (从 admin_user 缓存, 避免每次查 DB)
  - 校验: 必须是 >= 1 整数
  - 校验: 必须存在于 admin_tenant (缓存 60s)
  - 写入: set_current_tenant_id(tid) + set_request_context(tenant_id=...)
  - 失败: 严格模式 → 400 拒绝; 宽松模式 → 走默认 1
  - 请求结束 reset (避免跨请求污染, 防泄漏)

实现: 裸 ASGI middleware (与 TraceIdMiddleware 一致), 不用 BaseHTTPMiddleware,
      避免 starlette 把 dispatch / call_next 拆到两个 task 导致 ContextVar 不可见.

开关:
  - MULTI_TENANT_ENABLED=false → middleware 直接 pass-through, 行为完全兼容
  - ZHS_TENANT_HEADER_NAME (默认 X-Tenant-Id)
  - ZHS_TENANT_STRICT (默认 1, 严格)
  - ZHS_TENANT_CACHE_TTL (默认 60s)
"""

from __future__ import annotations

import contextlib
import time

from loguru import logger as _loguru_logger

# 复用已有 contextvar + 校验 (与 set_current_tenant_id 白名单一致)
from app.core.tenant import (
    _DEFAULT_TENANT_ID,
    get_current_tenant_id,
    get_tenant_schema_name,
    is_multi_tenant_enabled,
    reset_current_tenant_id,
    set_current_tenant_id,
)

# 业务串联字段 (建议 116 telemetry)
try:
    from app.telemetry import set_request_context as _set_request_context
except Exception:  # telemetry 不可用时降级
    _set_request_context = None  # type: ignore


# ---------------------------------------------------------------------------
# 简单 LRU 缓存: tenant_id -> (status, expired_at)
# ---------------------------------------------------------------------------
# {tid: (status: int, expired_at: float)}
_TENANT_CACHE: dict[int, tuple[int, float]] = {}
_TENANT_NEGATIVE_CACHE: dict[int, float] = {}  # 负缓存: 已知不存在


def _cache_ttl() -> float:
    import os

    try:
        return float(os.getenv("ZHS_TENANT_CACHE_TTL", "60"))
    except Exception:
        return 60.0


def _is_strict() -> bool:
    import os

    return os.getenv("ZHS_TENANT_STRICT", "1") != "0"


def _header_name() -> str:
    import os

    return os.getenv("ZHS_TENANT_HEADER_NAME", "X-Tenant-Id")


def _is_public_path(path: str) -> bool:
    """健康检查 / 文档 / 登录等公开端点不强制 tenant 路由."""
    if not path:
        return True
    p = path.lower().split("?", 1)[0]
    PUBLIC_PREFIXES = (
        "/health",
        "/healthz",
        "/ready",
        "/readyz",
        "/live",
        "/livez",
        "/metrics",
        "/favicon.ico",
        "/static/",
        "/docs",
        "/redoc",
        "/openapi.json",
    )
    PUBLIC_EXACT = {
        "/api/v1/auth/login",
        "/api/v1/auth/register",
        "/api/v1/auth/login/phone",
        "/api/v1/auth/sms/code",
        "/api/v1/auth/login/miniprogram",
        "/api/v1/auth/wechat/login",
        "/api/v1/auth/wechat/code",
        "/api/v1/auth/wechat/bind-phone",
        "/api/v1/auth/wechat/openid",
        "/api/v1/auth/wechat/phone",
        "/api/v1/auth/google/authorize",
        "/api/v1/auth/google/callback",
        "/api/v1/auth/wecom/init",
        "/api/v1/auth/oauth/token",
        "/api/v1/auth/oauth/callback",
        "/api/v1/auth/oauth/apps",
    }
    if p in PUBLIC_EXACT:
        return True
    return any(p.startswith(prefix) for prefix in PUBLIC_PREFIXES)


def _parse_tid(raw: str | None) -> int | None:
    """解析 X-Tenant-Id header 字符串, 返回合法 int, 否则 None."""
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None
    try:
        tid = int(s)
    except (ValueError, TypeError):
        return None
    if tid < 1 or tid > 99_999_999:
        return None
    return tid


def _lookup_tenant_status(tid: int) -> int | None:
    """查 admin_tenant.status: 1=active, 0=disabled, None=不存在.

    用 LRU 缓存避免每请求一次 DB.
    失败 (DB 不可用) 返回 None, 调用方决定 fallback.
    """
    now = time.time()
    # 1) 正缓存命中
    if tid in _TENANT_CACHE:
        status, expired_at = _TENANT_CACHE[tid]
        if now < expired_at:
            return status
        # 过期, 删了重查
        _TENANT_CACHE.pop(tid, None)
    # 2) 负缓存命中
    if tid in _TENANT_NEGATIVE_CACHE and now < _TENANT_NEGATIVE_CACHE[tid]:
        return None
    # 3) 查 DB (延迟导入, 避免循环依赖)
    try:
        from sqlalchemy import text

        from app.database import get_session

        with get_session() as session:
            row = session.execute(
                text("SELECT status FROM admin_tenant WHERE id = :tid LIMIT 1"),
                {"tid": tid},
            ).first()
        ttl = _cache_ttl()
        if row is None:
            _TENANT_NEGATIVE_CACHE[tid] = now + ttl
            return None
        status = int(row[0])
        _TENANT_CACHE[tid] = (status, now + ttl)
        return status
    except Exception as e:
        # DB 不可用: 负缓存 5s, 防刷
        _TENANT_NEGATIVE_CACHE[tid] = now + 5
        with contextlib.suppress(Exception):
            _loguru_logger.warning(f"[tenant] lookup tenant={tid} failed: {e}")
        return None


def clear_tenant_cache() -> None:
    """清空缓存 (测试 / 运维 / admin_tenant 变更后)."""
    _TENANT_CACHE.clear()
    _TENANT_NEGATIVE_CACHE.clear()


def get_tenant_cache_snapshot() -> dict:
    """快照: 监控 / 健康检查 / 测试断言用 (公开别名)."""
    now = time.time()
    return {
        "positive": {
            tid: {"status": st, "ttl_left": round(exp - now, 1)}
            for tid, (st, exp) in _TENANT_CACHE.items()
            if exp > now
        },
        "negative": {tid: round(exp - now, 1) for tid, exp in _TENANT_NEGATIVE_CACHE.items() if exp > now},
        "positive_total": len(_TENANT_CACHE),
        "negative_total": len(_TENANT_NEGATIVE_CACHE),
    }


# 兼容老命名
_get_tenant_cache_snapshot = get_tenant_cache_snapshot


class TenantRoutingMiddleware:
    """裸 ASGI middleware: 把请求路由到对应租户 schema.

    优先级 (从高到低):
      1. X-Tenant-Id header
      2. JWT claim 'tid' (AuthMiddleware 解码后挂到 request.state.jwt_payload)
      3. request.state.user_tenant_id (依赖 / 业务层显式注入)
      4. 默认 _DEFAULT_TENANT_ID (1)

    不继承 BaseHTTPMiddleware 是因为后者会把 dispatch 与下游拆到两个 task,
    导致 contextvar 在下游不可见. 这里是裸 ASGI 模式 (与 TraceIdMiddleware 一致).
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        # 1) 单租户模式: 直通, 不写 contextvar
        if not is_multi_tenant_enabled():
            await self.app(scope, receive, send)
            return

        # 2) 公开端点: 不强制租户, 走默认 1
        path = scope.get("path", "")
        if _is_public_path(path):
            try:
                set_current_tenant_id(_DEFAULT_TENANT_ID)
                if _set_request_context is not None:
                    _set_request_context(tenant_id=str(_DEFAULT_TENANT_ID))
            except Exception:
                pass
            try:
                await self.app(scope, receive, send)
            finally:
                reset_current_tenant_id()
                if _set_request_context is not None:
                    with contextlib.suppress(Exception):
                        _set_request_context(reset=True)
            return

        # 3) 解析 tenant_id (header > jwt > user_tenant_id > 默认)
        headers_list = scope.get("headers", []) or []
        header_name_bytes = _header_name().lower().encode("latin-1")
        header_value = None
        for k, v in headers_list:
            if k.lower() == header_name_bytes:
                try:
                    header_value = v.decode("latin-1")
                except Exception:
                    header_value = None
                break

        tid = _parse_tid(header_value)

        # 备选: state (AuthMiddleware 解码 JWT 后挂到 scope["state"] 或 request.state)
        # ASGI 模式下 scope 里没有 state, 这里只覆盖 header 路径; 真实 FastAPI 集成时
        # 业务可在 endpoint 用 Depends(get_tenant_id_dep) 显式拿.
        if tid is None:
            # scope.get("state") 在 starlette 内部是 dict-like, 但裸 ASGI 不一定有
            state = scope.get("state")
            if isinstance(state, dict):
                jwt_payload = state.get("jwt_payload")
                if isinstance(jwt_payload, dict):
                    tid = _parse_tid(jwt_payload.get("tid"))
                if tid is None:
                    utid = state.get("user_tenant_id")
                    if isinstance(utid, int) and utid >= 1:
                        tid = utid

        # 4) 严格模式: 缺 header → 400
        if tid is None:
            if _is_strict():
                await self._send_error(send, 400, "TENANT_REQUIRED", f"缺少 {_header_name()} header 或 JWT tid claim")
                return
            tid = _DEFAULT_TENANT_ID

        # 5) 校验 admin_tenant 存在 + active
        status = _lookup_tenant_status(tid)
        if status is None:
            if _is_strict():
                await self._send_error(send, 404, "TENANT_NOT_FOUND", f"tenant_id={tid} 不存在")
                return
            tid = _DEFAULT_TENANT_ID
        elif status == 0:
            if _is_strict():
                await self._send_error(send, 403, "TENANT_DISABLED", f"tenant_id={tid} 已停用")
                return
            tid = _DEFAULT_TENANT_ID

        # 6) 写入 contextvar (纵深防御: 让 ORM event hook 切 search_path)
        try:
            schema = get_tenant_schema_name(tid)
        except ValueError:
            await self._send_error(send, 400, "TENANT_INVALID", f"非法 tenant_id={tid}")
            return
        try:
            set_current_tenant_id(tid)
            if _set_request_context is not None:
                _set_request_context(tenant_id=str(tid))
        except Exception as e:
            with contextlib.suppress(Exception):
                _loguru_logger.warning(f"[tenant] set context failed: {e}")

        # 7) 跑下游 + 注入响应头 + 清理
        async def send_with_header(message):
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                headers.append((b"x-tenant-schema", schema.encode("latin-1")))
                message["headers"] = headers
            await send(message)

        try:
            await self.app(scope, receive, send_with_header)
        finally:
            reset_current_tenant_id()
            if _set_request_context is not None:
                with contextlib.suppress(Exception):
                    _set_request_context(reset=True)

    @staticmethod
    async def _send_error(send, status_code: int, code: str, detail: str) -> None:
        import json

        body = json.dumps({"code": code, "detail": detail}, ensure_ascii=False).encode("utf-8")
        await send(
            {
                "type": "http.response.start",
                "status": status_code,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(body)).encode("latin-1")),
                ],
            }
        )
        await send({"type": "http.response.body", "body": body, "more_body": False})


# ---------------------------------------------------------------------------
# FastAPI 依赖: 在 endpoint 内部显式拿 tenant_id
# ---------------------------------------------------------------------------
def get_tenant_id_dep() -> int:
    """FastAPI Depends: 从 contextvar 读当前请求的 tenant_id (默认 1)."""
    tid = get_current_tenant_id()
    return tid if tid is not None else _DEFAULT_TENANT_ID
