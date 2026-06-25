"""Bug-49: CSRF 防护.

采用 double-submit cookie 模式:
  1. 客户端 GET /csrf 后拿到 csrf_token (同时 set-cookie XSRF-TOKEN)
  2. 客户端 state-changing 请求 (POST/PUT/DELETE/PATCH) 在 Header X-CSRF-Token 带相同 token
  3. 服务端校验 cookie 与 header 一致

豁免: 公开 API (登录/回调/支付通知) + Bearer JWT 鉴权 (Bug-11 已用 JWT 时, JWT 本身就是 CSRF 防护).
"""

import hashlib
import hmac
import logging
import secrets
import time

from fastapi import HTTPException, Request, Response, status

logger = logging.getLogger(__name__)

# 默认 cookie / header 名
CSRF_COOKIE_NAME = "XSRF-TOKEN"
CSRF_HEADER_NAME = "X-CSRF-Token"

# token 有效期 (秒, 默认 12 小时)
CSRF_TOKEN_TTL = 12 * 3600


# 服务端 HMAC 密钥 (若未显式提供, 用 SECRET_KEY)
def _secret() -> bytes:
    try:
        from app.config import settings

        k = getattr(settings, "JWT_SECRET_KEY", None) or getattr(settings, "SECRET_KEY", None)
        if k:
            return k.encode("utf-8")
    except Exception as e:
        logger.debug("读取 CSRF 密钥失败: %s", e)  # intentionally ignored
    # 生产环境必须显式配置密钥, 禁止使用默认弱密钥
    import os

    env = os.getenv("ENV", "dev").lower()
    if env in ("production", "prod", "staging"):
        raise RuntimeError(
            "[CSRF] 生产环境必须配置 JWT_SECRET_KEY, 禁止使用默认 CSRF 密钥"
        )
    return b"zhs-csrf-default-secret-key"


def generate_csrf_token(user_uuid: str = "anon") -> tuple[str, str]:
    """生成 csrf token. Returns (token, cookie_value).

    格式: HMAC(secret, user_uuid|expiry|nonce) | expiry | nonce
    """
    nonce = secrets.token_urlsafe(16)
    expiry = int(time.time()) + CSRF_TOKEN_TTL
    msg = f"{user_uuid}|{expiry}|{nonce}".encode()
    sig = hmac.new(_secret(), msg, hashlib.sha256).hexdigest()
    cookie_val = f"{sig}|{expiry}|{nonce}".encode().hex()
    token = f"{sig}.{expiry}.{nonce}"
    return token, cookie_val


def verify_csrf_token(token: str, cookie_val: str, user_uuid: str = "anon") -> bool:
    """校验 token == cookie 派生 (用 constant-time compare 防计时攻击)."""
    if not token or not cookie_val:
        return False
    # 1) 拆分 + 校验格式
    try:
        sig_a, exp_a, nonce_a = token.split(".", 2)
        exp_a_i = int(exp_a)
    except (ValueError, AttributeError):
        return False
    try:
        raw = bytes.fromhex(cookie_val).decode("utf-8")
        sig_b, exp_b, nonce_b = raw.split("|", 2)
    except (ValueError, AttributeError):
        return False
    # 2) expiry
    if exp_a_i < int(time.time()):
        return False
    if exp_a_i != int(exp_b):
        return False
    # 3) nonce 一致
    if not hmac.compare_digest(nonce_a, nonce_b):
        return False
    # 4) 重新计算 sig 并与 token sig 对比
    msg = f"{user_uuid}|{exp_a}|{nonce_a}".encode()
    expected = hmac.new(_secret(), msg, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, sig_a) and hmac.compare_digest(sig_a, sig_b)


# ---------------------------------------------------------------------------
# FastAPI 中间件 / 依赖
# ---------------------------------------------------------------------------

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


async def csrf_protect(request: Request) -> None:
    """FastAPI 依赖: 校验 state-changing 请求的 CSRF token.

    豁免: 公开白名单 (登录/回调/支付) 不需要 (见 AuthMiddleware 的 PUBLIC_PREFIXES).
    强制鉴权: 当请求含 Authorization Bearer 时跳过 CSRF (JWT 自身防 CSRF).
    """
    if request.method in SAFE_METHODS:
        return
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        return  # JWT 已防 CSRF
    cookie_val = request.cookies.get(CSRF_COOKIE_NAME)
    token = request.headers.get(CSRF_HEADER_NAME)
    if not token or not cookie_val:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF token missing",
        )
    user_uuid = getattr(request.state, "user_uuid", None) or "anon"
    if not verify_csrf_token(token, cookie_val, user_uuid=user_uuid):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF token invalid or expired",
        )


def set_csrf_cookie(response: Response, user_uuid: str = "anon") -> str:
    """生成 CSRF token + 写入 cookie, 返回前端应回传的 token 字符串."""
    import os

    token, cookie_val = generate_csrf_token(user_uuid)
    # 生产环境强制 secure, 开发环境允许 False (本地 HTTP 调试)
    env = os.getenv("ENV", "dev").lower()
    secure = env in ("production", "prod", "staging")
    response.set_cookie(
        key=CSRF_COOKIE_NAME,
        value=cookie_val,
        max_age=CSRF_TOKEN_TTL,
        httponly=False,  # 前端 JS 需可读
        secure=secure,
        samesite="lax",
        path="/",
    )
    return token
