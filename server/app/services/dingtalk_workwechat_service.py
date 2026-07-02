"""DingTalk & WorkWechat (企业微信) 扫码登录服务.

前端流程:
  1. 用户扫码 → OAuth 回调 → 前端拿 code
  2. 前端 POST /auth/dingtalk/login { code, state }
  3. 后端用 code 换取用户信息 → 查/建用户 → 颁发 JWT

迁移自 Java 旧后端的 DingTalkLoginController / WorkWechatLoginController.
"""

import logging
from typing import Any

import httpx
from sqlalchemy import select

from app.config import settings
from app.database import get_session
from app.models.user_models import User, UserThirdPartyAccount
from app.security import create_access_token, create_refresh_token

logger = logging.getLogger(__name__)


# =============================================================================
# 配置读取
# =============================================================================

def _dingtalk_config() -> dict[str, str]:
    return {
        "app_key": getattr(settings, "DINGTALK_LOGIN_APP_KEY", ""),
        "app_secret": getattr(settings, "DINGTALK_LOGIN_APP_SECRET", ""),
        "redirect_uri": getattr(settings, "DINGTALK_LOGIN_REDIRECT_URI", ""),
    }


def _workwechat_config() -> dict[str, str]:
    return {
        "corp_id": getattr(settings, "WORKWECHAT_LOGIN_CORP_ID", ""),
        "agent_id": getattr(settings, "WORKWECHAT_LOGIN_AGENT_ID", ""),
        "secret": getattr(settings, "WORKWECHAT_LOGIN_SECRET", ""),
        "redirect_uri": getattr(settings, "WORKWECHAT_LOGIN_REDIRECT_URI", ""),
    }


# =============================================================================
# 钉钉: code → userToken → 用户信息
# =============================================================================

_DINGTALK_GETTOKEN_URL = "https://api.dingtalk.com/v1.0/oauth2/userAccessToken"
_DINGTALK_USERINFO_URL = "https://api.dingtalk.com/v1.0/contact/users/me"


async def _dingtalk_exchange_code(code: str) -> dict[str, Any] | None:
    """用授权码换取 userAccessToken (钉钉 OAuth2)."""
    cfg = _dingtalk_config()
    if not (cfg["app_key"] and cfg["app_secret"]):
        logger.warning("DingTalk OAuth 未配置 app_key/secret")
        return None
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                _DINGTALK_GETTOKEN_URL,
                json={
                    "clientId": cfg["app_key"],
                    "clientSecret": cfg["app_secret"],
                    "code": code,
                    "grantType": "authorization_code",
                    "redirectUri": cfg["redirect_uri"] or None,
                },
            )
            if resp.status_code != 200:
                logger.warning(f"DingTalk token exchange failed {resp.status_code}: {resp.text[:200]}")
                return None
            data = resp.json()
            token = data.get("accessToken")
            if not token:
                logger.warning(f"DingTalk token exchange: no accessToken in response: {data}")
                return None
            return data
    except Exception as e:
        logger.error(f"DingTalk token exchange error: {e}")
        return None


async def _dingtalk_get_user_info(access_token: str) -> dict[str, Any] | None:
    """用 userAccessToken 获取钉钉用户信息."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                _DINGTALK_USERINFO_URL,
                headers={"x-acs-dingtalk-access-token": access_token},
            )
            if resp.status_code != 200:
                logger.warning(f"DingTalk userinfo failed {resp.status_code}: {resp.text[:200]}")
                return None
            return resp.json()
    except Exception as e:
        logger.error(f"DingTalk userinfo error: {e}")
        return None


async def dingtalk_login(code: str, state: str = "") -> dict[str, Any]:
    """钉钉扫码登录: code → userToken → 用户信息 → 查/建用户 → JWT.

    Returns:
        {"success": bool, "msg": str, "data": dict}
    """
    if not code:
        return {"success": False, "msg": "授权码不能为空"}

    token_data = await _dingtalk_exchange_code(code)
    if not token_data:
        return {"success": False, "msg": "钉钉授权码换取 token 失败"}

    user_info = await _dingtalk_get_user_info(token_data["accessToken"])
    if not user_info:
        return {"success": False, "msg": "获取钉钉用户信息失败"}

    open_id = user_info.get("openId") or user_info.get("unionId") or ""
    if not open_id:
        return {"success": False, "msg": "钉钉用户信息缺少 openId"}

    nickname = user_info.get("nick", "") or "钉钉用户"
    avatar = user_info.get("avatarUrl", "") or ""

    return _find_or_create_user(
        platform="dingtalk",
        open_id=open_id,
        union_id=user_info.get("unionId", ""),
        nickname=nickname,
        avatar=avatar,
    )


# =============================================================================
# 企业微信: code → userid → 用户信息
# =============================================================================

_WORKWECHAT_TOKEN_URL = "https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid={corp_id}&corpsecret={secret}"
_WORKWECHAT_USERINFO_URL = "https://qyapi.weixin.qq.com/cgi-bin/auth/getuserinfo?access_token={token}&code={code}"
_WORKWECHAT_USERDETAIL_URL = "https://qyapi.weixin.qq.com/cgi-bin/auth/getuserdetail?access_token={token}&userid={userid}"

# 企业微信 access_token 缓存 (简单内存缓存, TTL 7200s)
_workwechat_token_cache: dict[str, Any] = {"token": "", "expire_at": 0}


async def _get_workwechat_access_token() -> str | None:
    """获取企业微信 access_token (带简单缓存)."""
    import time

    now = time.time()
    if _workwechat_token_cache["token"] and _workwechat_token_cache["expire_at"] > now:
        return _workwechat_token_cache["token"]

    cfg = _workwechat_config()
    if not (cfg["corp_id"] and cfg["secret"]):
        logger.warning("WorkWechat OAuth 未配置 corp_id/secret")
        return None
    try:
        url = _WORKWECHAT_TOKEN_URL.format(corp_id=cfg["corp_id"], secret=cfg["secret"])
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                logger.warning(f"WorkWechat gettoken failed {resp.status_code}: {resp.text[:200]}")
                return None
            data = resp.json()
            if data.get("errcode") != 0:
                logger.warning(f"WorkWechat gettoken error: {data}")
                return None
            token = data.get("access_token", "")
            expires = data.get("expires_in", 7200)
            _workwechat_token_cache["token"] = token
            _workwechat_token_cache["expire_at"] = now + expires - 300  # 提前5分钟过期
            return token
    except Exception as e:
        logger.error(f"WorkWechat gettoken error: {e}")
        return None


async def _workwechat_get_user_info(code: str) -> dict[str, Any] | None:
    """用 code 换取企业微信 userid, 再获取用户详情."""
    access_token = await _get_workwechat_access_token()
    if not access_token:
        return None

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            # Step 1: code → userid
            url = _WORKWECHAT_USERINFO_URL.format(token=access_token, code=code)
            resp = await client.get(url)
            if resp.status_code != 200:
                logger.warning(f"WorkWechat getuserinfo failed {resp.status_code}: {resp.text[:200]}")
                return None
            data = resp.json()
            if data.get("errcode") != 0:
                logger.warning(f"WorkWechat getuserinfo error: {data}")
                return None
            userid = data.get("userid") or data.get("UserId") or ""
            if not userid:
                logger.warning("WorkWechat getuserinfo: no userid in response")
                return None

            # Step 2: userid → userdetail (需要敏感权限)
            detail_url = _WORKWECHAT_USERDETAIL_URL.format(token=access_token, userid=userid)
            detail_resp = await client.get(detail_url)
            if detail_resp.status_code == 200:
                detail_data = detail_resp.json()
                if detail_data.get("errcode") == 0:
                    return detail_data

            # 降级: 返回 userid 作为 openId, nickname 用 userid
            return {"openId": userid, "name": userid, "avatar": ""}
    except Exception as e:
        logger.error(f"WorkWechat getuserinfo error: {e}")
        return None


async def workwechat_login(code: str, state: str = "", app_id: str = "") -> dict[str, Any]:
    """企业微信扫码登录: code → userid → 用户信息 → 查/建用户 → JWT.

    Returns:
        {"success": bool, "msg": str, "data": dict}
    """
    if not code:
        return {"success": False, "msg": "授权码不能为空"}

    user_info = await _workwechat_get_user_info(code)
    if not user_info:
        return {"success": False, "msg": "获取企业微信用户信息失败"}

    open_id = user_info.get("openId") or user_info.get("userid") or ""
    if not open_id:
        return {"success": False, "msg": "企业微信用户信息缺少 userid"}

    nickname = user_info.get("name", "") or "企业微信用户"
    avatar = user_info.get("avatar", "") or ""

    return _find_or_create_user(
        platform="workwechat",
        open_id=open_id,
        union_id=user_info.get("unionid", ""),
        nickname=nickname,
        avatar=avatar,
    )


# =============================================================================
# 公共: 查找或创建用户
# =============================================================================

def _find_or_create_user(
    platform: str,
    open_id: str,
    union_id: str = "",
    nickname: str = "",
    avatar: str = "",
) -> dict[str, Any]:
    """通过第三方账号查找用户, 不存在则创建.

    Returns:
        {"success": bool, "msg": str, "data": dict}
    """
    try:
        with get_session() as db:
            # 1. 查 user_third_party_accounts
            stmt = (
                select(UserThirdPartyAccount)
                .where(
                    UserThirdPartyAccount.platform == platform,
                    UserThirdPartyAccount.open_id == open_id,
                    UserThirdPartyAccount.del_flag == "0",
                )
                .limit(1)
            )
            binding = db.execute(stmt).scalar_one_or_none()

            if binding:
                # 已绑定: 查用户
                user_stmt = select(User).where(User.uuid == binding.user_uuid).limit(1)
                user = db.execute(user_stmt).scalar_one_or_none()
                if user is None:
                    return {"success": False, "msg": "绑定记录存在但用户不存在"}
                if user.status != 1:
                    return {"success": False, "msg": "账号已被禁用"}
                logger.info(f"{platform} login: existing user uuid={user.uuid}")
                return {"success": True, "msg": "登录成功", "data": _build_token_data(user)}
            else:
                # 2. 未绑定: 自动注册新用户
                import uuid as _uuid

                user_uuid = str(_uuid.uuid4()).replace("-", "")
                user = User(
                    uuid=user_uuid,
                    nickname=nickname or f"{platform}用户",
                    avatar=avatar,
                    status=1,
                )
                db.add(user)
                db.flush()  # 获取 user.id

                # 3. 创建第三方绑定
                binding = UserThirdPartyAccount(
                    user_uuid=user_uuid,
                    open_id=open_id,
                    union_id=union_id,
                    platform=platform,
                )
                db.add(binding)
                db.commit()
                db.refresh(user)
                logger.info(f"{platform} login: new user uuid={user_uuid}, open_id={open_id[:8]}...")
                return {"success": True, "msg": "登录成功", "data": _build_token_data(user)}
    except Exception:
        logger.exception(f"{platform} login error: open_id={open_id[:8]}...")
        return {"success": False, "msg": "登录失败, 请重试"}


def _build_token_data(user) -> dict:
    """构建登录成功后的返回数据 (复用 auth_service 同款结构)."""
    access_token = create_access_token(subject=user.uuid)
    refresh_token, _jti, _fid = create_refresh_token(subject=user.uuid)
    return {
        "user_id": user.uuid,
        "uuid": user.uuid,
        "access_token": access_token,
        "accessToken": access_token,
        "refresh_token": refresh_token,
        "refreshToken": refresh_token,
        "token_type": "Bearer",
        "tokenType": "Bearer",
        "expires_in": settings.JWT_EXPIRE_MINUTES * 60,
        "refresh_expires_in": 7 * 24 * 60 * 60,
        "user": {
            "uuid": user.uuid,
            "phone": user.phone or "",
            "email": getattr(user, "email", "") or "",
            "nickname": user.nickname or "",
            "avatar": user.avatar or "",
            "is_vip": getattr(user, "is_vip", 0),
        },
    }
