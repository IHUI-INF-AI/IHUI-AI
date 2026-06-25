"""统一当前用户依赖注入.

提供 FastAPI Depends 用法, 统一替换各 API 模块内手写的 _current_user_id() / _uid() 函数.

用法:
    from app.core.current_user import get_current_user_id

    @router.post("")
    async def create_item(
        body: ItemCreate,
        user_id: str = Depends(get_current_user_id),
    ):
        ...

dev / 未登录场景下 user_id 自动回退为 "guest", 与历史行为完全一致.
后续接入 JWT 中间件后, 只需替换本文件即可, 不必改业务代码.

兼容旧写法 _current_user_id() / _uid():
    业务侧继续使用 _current_user_id() 占位即可, 本模块导出 current_user_id_or_guest()
    优先从 ContextVar 读取 (中间件注入时), 失败则回退 "guest".
"""

import logging
from contextvars import ContextVar

from fastapi import Request

logger = logging.getLogger(__name__)

# ContextVar: 中间件可注入到当前请求协程的 user_id
_current_user_ctx: ContextVar[str | None] = ContextVar("current_user_id", default=None)


def set_current_user_id(user_id: str) -> None:
    """中间件/依赖调用, 把当前用户注入 ContextVar."""
    _current_user_ctx.set(user_id)


def current_user_id_or_guest() -> str:
    """业务侧用: 返回当前用户 UUID, 未登录则返回 'guest'."""
    uid = _current_user_ctx.get()
    if uid:
        return str(uid)
    return "guest"


def get_current_user_id(request: Request) -> str:
    """FastAPI Depends 用: 从 Request 中提取当前登录用户 UUID.

    优先级:
      1. request.state.user_id (由 auth_middleware 注入)
      2. JWT Bearer Token 解码 (若中间件未启用)
      3. 默认 "guest" (开发 / 未登录)
    """
    state_id = getattr(request.state, "user_id", None)
    if state_id:
        return str(state_id)

    try:
        from app.security import decode_access_token

        auth = request.headers.get("Authorization") or request.headers.get("authorization")
        if auth and auth.lower().startswith("bearer "):
            token = auth.split(" ", 1)[1].strip()
            payload = decode_access_token(token)
            if payload and payload.get("sub"):
                return str(payload["sub"])
    except Exception as e:
        logger.debug("解析 JWT 获取当前用户失败: %s", e)

    return "guest"


def get_optional_user_id(request: Request) -> str | None:
    """可选用户: 已登录返回 UUID, 未登录返回 None. 不抛错."""
    state_id = getattr(request.state, "user_id", None)
    if state_id:
        return str(state_id)
    return None

