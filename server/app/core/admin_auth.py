"""Admin 权限验证依赖.

用法:
    from app.core.admin_auth import admin_required

    router = APIRouter(dependencies=[Depends(admin_required)])

验证规则 (按优先级):
  1. X-Admin-Token 头: 匹配 settings.ADMIN_TOKEN (简单令牌)
  2. Bearer JWT: 解码后 role == "admin" 或 roles 包含 "admin"
  3. 开发环境 (ENV=dev): 无 token 时放行 (方便本地调试)
"""

from fastapi import HTTPException, Request, status

from app.config import settings


async def admin_required(request: Request):
    """Admin 权限依赖: 验证 X-Admin-Token 或 Bearer JWT."""
    # 1. X-Admin-Token 头
    admin_token = getattr(settings, "ADMIN_TOKEN", "") or ""
    if admin_token:
        x_token = request.headers.get("X-Admin-Token") or ""
        if x_token and x_token == admin_token:
            return {"src": "x-admin-token"}

    # 2. Bearer JWT
    auth = request.headers.get("Authorization") or request.headers.get("authorization") or ""
    if auth.lower().startswith("bearer "):
        token = auth.split(" ", 1)[1].strip()
        try:
            from app.security import decode_access_token

            payload = decode_access_token(token)
            if payload:
                role = payload.get("role")
                roles = payload.get("roles") or []
                if role == "admin" or "admin" in roles:
                    return {"src": "jwt", "sub": payload.get("sub")}
        except Exception:
            pass

    # 3. 开发环境放行 (方便本地调试)
    env = getattr(settings, "ENV", "dev")
    if env in ("dev", "development", "test"):
        return {"src": "dev-bypass"}

    # 4. 拒绝
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Admin authentication required",
        headers={"WWW-Authenticate": "Bearer"},
    )
