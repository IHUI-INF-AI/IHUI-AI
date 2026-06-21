"""WebSocket 鉴权工具 - 修复 Bug-14: WS 端点禁止从 query 取 user_uuid.
修复 Bug-48: WS 握手 Origin 头白名单校验, 防 CSWSH (Cross-Site WebSocket Hijacking).

支持三种 token 传递方式 (按优先级):
  1. Authorization: Bearer <token>  (HTTP 标准, 浏览器 WS API 需自定义 header)
  2. Sec-WebSocket-Protocol: bearer, <token>  (RFC 8441 subprotocol, 浏览器可用)
  3. ?token=<token>  (兜底, 不推荐: 写入 access log / referer)

通过 ws.authenticate_ws(ws, token_field) 拿到合法的 (user_uuid, payload),
失败时自动 send 4401/4403 并 close.
"""

import os

from fastapi import WebSocket
from loguru import logger

from app.security import decode_access_token

# WebSocket 关闭码 (参考 RFC 6455 预留 4xxx 给应用层)
WS_CLOSE_UNAUTHORIZED = 4401
WS_CLOSE_FORBIDDEN = 4403
# Bug-48: 新增关闭码
WS_CLOSE_ORIGIN_DENIED = 4403


# Bug-48: WS Origin 白名单
# 优先级: 环境变量 WS_ALLOWED_ORIGINS (逗号分隔) > settings.CORS_ORIGINS > 默认 []
# 浏览器 WS 客户端无法自定义 header, 必须靠 origin 校验防 CSWSH
_DEFAULT_WS_ORIGINS: list = []


def _parse_allowed_origins() -> list:
    """从环境变量 / settings 拉白名单 origin."""
    raw = os.environ.get("WS_ALLOWED_ORIGINS", "")
    if raw:
        return [o.strip() for o in raw.split(",") if o.strip()]
    try:
        from app.config import settings

        cors = getattr(settings, "CORS_ORIGINS", None) or []
        if isinstance(cors, str):
            cors = [o.strip() for o in cors.split(",") if o.strip()]
        return list(cors)
    except Exception:
        return _DEFAULT_WS_ORIGINS


def _origin_allowed(origin: str) -> bool:
    """判断 Origin 是否在白名单.

    规则:
      - 空 origin (非浏览器 / 服务端 WS 客户端) 默认放行
      - 完全匹配或前缀匹配 (https://*.example.com) 都算通过
      - localhost / 127.0.0.1 / 内网 IP 在 dev 环境放行
    """
    if not origin:
        return True  # 非浏览器
    allowed = _parse_allowed_origins()
    if not allowed:
        # 没有配置白名单: dev 模式放行 localhost, prod 严格拒绝
        env = os.environ.get("ENV", "dev").lower()
        if env in ("dev", "test"):
            from urllib.parse import urlparse

            try:
                host = urlparse(origin).hostname or ""
            except Exception:
                host = ""
            if (
                host in ("localhost", "127.0.0.1", "0.0.0.0", "::1")
                or host.startswith("192.168.")
                or host.startswith("10.")
            ):
                return True
        return False
    origin = origin.rstrip("/").lower()
    for a in allowed:
        a = a.strip().rstrip("/").lower()
        if not a or a == "*":
            return True
        if a == origin:
            return True
        # 前缀通配 *.example.com
        if a.startswith("*."):
            suffix = a[1:]  # ".example.com"
            if origin.endswith(suffix) and origin != suffix.lstrip("."):
                return True
    return False


async def check_origin(ws: WebSocket) -> bool:
    """Bug-48 入口: 校验 WS 握手的 Origin, 不通过直接 close.

    Returns:
        True: 放行
        False: 已关闭连接, 业务代码应 return None
    """
    origin = ws.headers.get("origin", "")
    if _origin_allowed(origin):
        return True
    logger.warning(f"WS origin denied: origin={origin} " f"path={ws.url.path} client={ws.client}")
    try:
        await ws.close(
            code=WS_CLOSE_ORIGIN_DENIED,
            reason=f"Origin not allowed: {origin}",
        )
    except Exception:
        logger.warning("Caught unexpected exception")
    return False


async def authenticate_ws(ws: WebSocket) -> tuple[str, dict] | None:
    """从多种渠道取 token 并解码, 失败时关闭连接.

    Bug-48 修复: 调用前先校验 Origin (CSWSH 防护).
    T1: 返回 (user_uuid, payload), 调用方通过 payload.get("exp") 拿过期时间.

    Returns:
        (user_uuid, payload) 或 None (已关闭连接).
    """
    # Bug-48: 先做 Origin 校验
    if not await check_origin(ws):
        return None

    # 1) Authorization 头
    auth_header = ws.headers.get("authorization", "")
    token = None
    if auth_header.lower().startswith("bearer "):
        token = auth_header[7:].strip()

    # 2) Sec-WebSocket-Protocol: bearer, <token>
    if not token:
        proto = ws.headers.get("sec-websocket-protocol", "")
        parts = [p.strip() for p in proto.split(",")]
        if len(parts) >= 2 and parts[0].lower() == "bearer":
            token = parts[1]

    # 3) query 参数兜底
    if not token:
        token = ws.query_params.get("token")

    if not token:
        await ws.close(code=WS_CLOSE_UNAUTHORIZED, reason="Missing token")
        return None

    payload = decode_access_token(token)
    if not payload:
        await ws.close(code=WS_CLOSE_UNAUTHORIZED, reason="Invalid or expired token")
        return None

    # T1: refresh token 拒绝作为 WS 鉴权 (避免 refresh token 长生命周期滥用)
    if payload.get("type") == "refresh":
        await ws.close(code=WS_CLOSE_UNAUTHORIZED, reason="Refresh token cannot be used for WS auth")
        return None

    user_uuid = payload.get("sub")
    if not user_uuid:
        await ws.close(code=WS_CLOSE_UNAUTHORIZED, reason="Token missing subject")
        return None

    return user_uuid, payload


def get_token_exp(payload: dict) -> float:
    """T1 辅助: 从 JWT payload 拿过期 Unix timestamp.

    payload["exp"] 可能是 datetime 或数字 (PyJWT 行为差异).
    """
    exp = payload.get("exp")
    if exp is None:
        return 0
    if hasattr(exp, "timestamp"):
        return exp.timestamp()
    try:
        return float(exp)
    except (TypeError, ValueError):
        return 0
