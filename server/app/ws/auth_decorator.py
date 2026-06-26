"""WebSocket 鉴权装饰器.

用法:
    from app.ws.auth_decorator import ws_require_auth

    @router.websocket("/ws/chat")
    @ws_require_auth
    async def chat(ws: WebSocket, user_uuid: str = "", token_exp: float = 0, ...):
        ...

设计:
  - 自动从 query 拿 ?token=, 调 manager.authenticate_token 校验
  - 失败立即 close(1008) 并记录 WARN 日志
  - 把 user_uuid + token_exp 注入到 kwargs (T1: 用于 TTL 跟踪)
  - 不影响原有 chat_room 这类依赖 user_uuid query 参数的端点
"""

import inspect
from collections.abc import Callable
from functools import wraps

from fastapi import WebSocket
from loguru import logger


def ws_require_auth(func: Callable) -> Callable:
    """WS 端点鉴权装饰器 - 在 accept 前校验 JWT.

    要求 query 中有 ?token=<access_token>.

    工作流程:
      1. 拿 token, 没拿到 -> close(1008) "Authentication required"
      2. authenticate_token 校验 -> 失败 close(1008) "Invalid token"
      3. 通过 -> 注入 user_uuid + token_exp 到 kwargs, 调用原 endpoint
    """
    sig = inspect.signature(func)

    @wraps(func)
    async def wrapper(*args, **kwargs):
        # 找到 WebSocket 实例
        ws: WebSocket | None = None
        for a in args:
            if isinstance(a, WebSocket):
                ws = a
                break
        if ws is None:
            ws = kwargs.get("ws") or kwargs.get("websocket")

        if ws is None:
            logger.error("ws_require_auth: WebSocket instance not found in args")
            return None

        # 从 query 拿 token
        token = ws.query_params.get("token", "")
        # 也兼容从 header 拿 (Sec-WebSocket-Protocol)
        if not token:
            subprotocols = ws.headers.get("sec-websocket-protocol", "")
            for proto in subprotocols.split(","):
                proto = proto.strip()
                if proto.startswith("token."):
                    token = proto[len("token."):]
                    break

        # 鉴权
        from app.ws.manager import authenticate_token

        # 测试环境旁路: 通过 WS_AUTH_BYPASS=1 环境变量跳过鉴权
        # 测试中用 query 中的 userId/user_uuid 显式指定身份
        import os as _os
        if _os.environ.get("WS_AUTH_BYPASS") == "1" and not token:
            user_uuid = ws.query_params.get("userId") or ws.query_params.get("user_uuid") or "test-user"
            kwargs["user_uuid"] = user_uuid
            if "token_exp" in sig.parameters:
                kwargs["token_exp"] = 0
            return await func(*args, **kwargs)

        user_uuid = authenticate_token(token) if token else None
        if not user_uuid:
            await ws.close(code=1008, reason="Authentication required")
            logger.warning(
                f"WS auth rejected: {ws.client} path={ws.url.path} "
                f"token={'present' if token else 'missing'}"
            )
            return None

        # 注入 user_uuid (覆盖 kwargs 中现有的)
        if "user_uuid" in sig.parameters:
            kwargs["user_uuid"] = user_uuid

        # T1: 注入 token_exp (Unix timestamp)
        if "token_exp" in sig.parameters:
            token_exp = 0
            if token:
                try:
                    from app.security import decode_access_token

                    payload = decode_access_token(token)
                    if payload and payload.get("exp"):
                        exp = payload["exp"]
                        token_exp = exp.timestamp() if hasattr(exp, "timestamp") else float(exp)
                except Exception as e:
                    # 2026-06-25 P2 加固: 记录异常, 便于排查 token 解析失败
                    logger.debug(f"ws token decode failed: {e}")
            kwargs["token_exp"] = token_exp

        return await func(*args, **kwargs)

    return wrapper
