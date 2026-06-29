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

from contextvars import ContextVar

from fastapi import Request

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
    except Exception:
        pass

    return "guest"


def get_optional_user_id(request: Request) -> str | None:
    """可选用户: 已登录返回 UUID, 未登录返回 None. 不抛错."""
    state_id = getattr(request.state, "user_id", None)
    if state_id:
        return str(state_id)
    return None


def get_member_id_int(request: Request) -> int:
    """历史迁移模块专用: 返回当前登录用户的 int 型 member_id.

    用于 11 个历史 Java 迁移模块 (learn/certificate/checkin/member/news/invoice/
    exam_ext/live_ext/circle_ext/resource_ext/message_ext), 这些模块的 member_id
    字段是 BigInteger (历史 MySQL 自增 ID), 与主系统 String(64) UUID 不兼容.

    优先级:
      1. request.state.user_id (由 auth_middleware 注入), 正整数则返回
      2. JWT Bearer Token 解码的 sub 字段, 正整数则返回
      3. 默认 0 (开发 / 未登录 / 负数 / UUID, 与历史 guest 行为一致)

    注意: 主系统 UUID 用户在此返回 0 (因为 UUID 不是数字), 这是设计限制非缺陷.
    历史迁移模块的用户体系是 int, 与主系统 UUID 不互通, 待用户系统统一后再改.
    负数 user_id 视为非法, 回退 0 (防止伪造负数 ID 越权).
    """
    state_id = getattr(request.state, "user_id", None)
    if state_id is not None:
        try:
            value = int(state_id)
            if value > 0:
                return value
        except (ValueError, TypeError):
            pass

    try:
        from app.security import decode_access_token

        auth = request.headers.get("Authorization") or request.headers.get("authorization")
        if auth and auth.lower().startswith("bearer "):
            token = auth.split(" ", 1)[1].strip()
            payload = decode_access_token(token)
            if payload and payload.get("sub"):
                try:
                    value = int(payload["sub"])
                    if value > 0:
                        return value
                except (ValueError, TypeError):
                    pass
    except Exception:
        pass

    return 0

