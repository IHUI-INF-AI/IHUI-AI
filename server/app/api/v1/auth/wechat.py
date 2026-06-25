"""WeChat authentication routes."""

import random
import string

import httpx
from fastapi import APIRouter, Depends, Query
from loguru import logger

from app.config import settings
from app.schemas.common import error, success
from app.security import create_access_token, require_login

router = APIRouter(prefix="/auth/wechat", tags=["WeChat Auth"])


def _generate_random_string(length: int) -> str:
    """Generate a random lowercase alphanumeric string (matches Java generateRandomString)."""
    chars = string.ascii_lowercase + string.digits
    return "".join(random.choice(chars) for _ in range(length))


def _generate_unique_invite_code(db) -> str:
    """Generate a unique invite code, retrying until no collision (matches Java logic)."""
    from app.models.user_models import User

    for _ in range(10):
        code = _generate_random_string(15)
        exists = db.query(User).filter(User.invite_code == code).first()
        if not exists:
            return code
    # Fallback with longer code
    return _generate_random_string(20)


# Redis key for WeChat access_token cache
WX_ACCESS_TOKEN_KEY = "wx:access_token"


async def _get_wechat_access_token() -> str | None:
    """Get WeChat mini-program access_token, cached in Redis."""
    from app.utils.redis_util import get_key, set_key

    # Check cache first
    cached = get_key(WX_ACCESS_TOKEN_KEY)
    if cached:
        return cached

    # Fetch new access_token from WeChat
    url = (
        f"https://api.weixin.qq.com/cgi-bin/token"
        f"?grant_type=client_credential"
        f"&appid={settings.WX_MINI_APPID}"
        f"&secret={settings.WX_MINI_SECRET}"
    )
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url)
            data = resp.json()
        if "access_token" not in data:
            logger.error(f"Failed to get WeChat access_token: {data}")
            return None
        token = data["access_token"]
        expires_in = data.get("expires_in", 7200)
        # Cache with 200s buffer before expiry
        set_key(WX_ACCESS_TOKEN_KEY, token, ex=max(expires_in - 200, 60))
        return token
    except Exception as e:
        logger.error(f"WeChat access_token request error: {e}")
        return None


@router.get("/mini/login", summary="WeChat mini-program login")
async def wechat_mini_login(
    code: str = Query(...),
    parent_id: str = Query("", description="Parent invite code for referral"),
):
    """WeChat mini-program login.

    Matches Java LoginService.login(openId, parentId):
    - If user not found: create new user with invite_code, nickname 'AI_' + 4 random chars,
      is_vip=-1 (guest), parent_id, isVIP defaults.
    - If user exists and parent_id is set but user has no parent: update parent_id.
    - If user exists but has no phone: return 40101 '未验证手机号'.
    - Returns JWT token with user info.
    """
    url = (
        f"https://api.weixin.qq.com/sns/jscode2session"
        f"?appid={settings.WX_MINI_APPID}"
        f"&secret={settings.WX_MINI_SECRET}"
        f"&js_code={code}&grant_type=authorization_code"
    )
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url)
        data = resp.json()
    if "openid" not in data:
        return error(data.get("errmsg", "WeChat auth failed"), "401")
    open_id = data["openid"]
    union_id = data.get("unionid", "")
    _session_key = data.get("session_key", "")
    # Find or create user -- matches Java LoginService.login() logic
    import uuid as uuid_mod

    from app.database import SessionFactory2, get_session
    from app.models.user_models import User, UserAuthInfo, UserMargin, UserThirdPartyAccount

    with get_session(factory=SessionFactory2) as db:
        # Find user via third-party account
        tpa = (
            db.query(UserThirdPartyAccount)
            .filter(
                UserThirdPartyAccount.platform == "wechat",
                UserThirdPartyAccount.open_id == open_id,
                UserThirdPartyAccount.deleted_at.is_(None),
            )
            .first()
        )
        if tpa:
            user = db.query(User).filter(User.uuid == tpa.user_uuid).first()
            if user:
                # Update parent_id if provided and user has none
                if parent_id and not user.parent_id:
                    user.parent_id = parent_id
                    db.commit()
                # Check if phone is bound
                auth = db.query(UserAuthInfo).filter(UserAuthInfo.user_uuid == user.uuid).first()
                if not auth or not auth.phone:
                    token = create_access_token(subject=user.uuid)
                    return success(
                        {
                            "access_token": token,
                            "token_type": "Bearer",
                            "user_uuid": user.uuid,
                            "code": "40101",
                            "msg": "未验证手机号",
                        }
                    )
                token = create_access_token(subject=user.uuid)
                return success({"access_token": token, "token_type": "Bearer", "user_uuid": user.uuid})
        # New user registration (matches Java: is_vip=-1 guest, invite_code, random nickname)
        user_uuid = str(uuid_mod.uuid4())
        nickname = "AI_" + _generate_random_string(4)
        invite_code = _generate_unique_invite_code(db)
        user = User(
            uuid=user_uuid,
            nickname=nickname,
            invite_code=invite_code,
            parent_id=parent_id if parent_id else None,
            is_vip=-1,  # Guest status matches Java isVIP=-1
            avatar=settings.DEFAULT_AVATAR_URL if hasattr(settings, "DEFAULT_AVATAR_URL") else None,
        )
        db.add(user)
        tpa = UserThirdPartyAccount(
            user_uuid=user_uuid,
            open_id=open_id,
            union_id=union_id,
            platform="wechat",
        )
        db.add(tpa)
        # Create margin record
        margin = UserMargin(user_uuid=user_uuid, token_quantity=0)
        db.add(margin)
        db.commit()
        token = create_access_token(subject=user_uuid)
        return success(
            {
                "access_token": token,
                "token_type": "Bearer",
                "user_uuid": user_uuid,
                "code": "40101",
                "msg": "未验证手机号",
            }
        )


@router.post("/mini/phone", summary="Get WeChat phone number")
async def get_wechat_phone(
    code: str = Query(..., description="Code from wx.getPhoneNumber component"),
    user_uuid: str = Depends(require_login),
):
    """Get phone number via WeChat mini-program getuserphonenumber API.

    Matches Java LoginService.getPhoneNumber(code, openId):
    1. Get access_token, call getuserphonenumber API
    2. If phone exists with no openId (visitor): delete visitor, bind phone to current user
    3. If phone exists with same openId: return existing user
    4. If phone exists with different openId: error 'already bound'
    5. Otherwise: update user's phone and set isVIP=0
    """
    # Step 1: Get access_token
    access_token = await _get_wechat_access_token()
    if not access_token:
        return error("获取微信凭证失败,请稍后重试")

    # Step 2: Call getuserphonenumber API
    url = f"https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token={access_token}"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(url, json={"code": code})
            data = resp.json()

        if data.get("errcode") != 0:
            err_msg = data.get("errmsg", "Unknown error")
            logger.error(f"WeChat getuserphonenumber failed: {err_msg}")
            return error(f"获取手机号失败: {err_msg}")

        phone_info = data.get("phone_info", {})
        phone_number = phone_info.get("phoneNumber", "")
        if not phone_number:
            return error("未获取到手机号")

        # Step 3: Handle phone binding logic (matches Java getPhoneNumber)
        from app.database import SessionFactory2, get_session
        from app.models.user_models import User, UserAuthInfo, UserThirdPartyAccount

        with get_session(factory=SessionFactory2) as db:
            # Check if phone is already registered to another user
            existing_auth = (
                db.query(UserAuthInfo)
                .filter(
                    UserAuthInfo.phone == phone_number,
                )
                .first()
            )

            if existing_auth and existing_auth.user_uuid != user_uuid:
                # Phone already bound to a different user
                # Check if that user has no wechat openId (visitor scenario from Java)
                existing_tpa = (
                    db.query(UserThirdPartyAccount)
                    .filter(
                        UserThirdPartyAccount.user_uuid == existing_auth.user_uuid,
                        UserThirdPartyAccount.platform == "wechat",
                        UserThirdPartyAccount.deleted_at.is_(None),
                    )
                    .first()
                )
                if not existing_tpa:
                    # Visitor with phone but no wechat: transfer openId to this user
                    # Get current user's openId BEFORE deleting
                    my_tpa = (
                        db.query(UserThirdPartyAccount)
                        .filter(
                            UserThirdPartyAccount.user_uuid == user_uuid,
                            UserThirdPartyAccount.platform == "wechat",
                            UserThirdPartyAccount.deleted_at.is_(None),
                        )
                        .first()
                    )
                    if my_tpa:
                        old_open_id = my_tpa.open_id
                        old_union_id = my_tpa.union_id
                        # Delete old binding
                        db.delete(my_tpa)
                        # Move openId to the phone-registered user
                        new_tpa = UserThirdPartyAccount(
                            user_uuid=existing_auth.user_uuid,
                            open_id=old_open_id,
                            union_id=old_union_id,
                            platform="wechat",
                        )
                        db.add(new_tpa)
                    # Update isVIP for the target user
                    target_user = db.query(User).filter(User.uuid == existing_auth.user_uuid).first()
                    if target_user and target_user.is_vip != 1:
                        target_user.is_vip = 0
                    db.commit()
                    token = create_access_token(subject=existing_auth.user_uuid)
                    return success({"phone": phone_number, "user_uuid": existing_auth.user_uuid, "access_token": token})
                else:
                    return error("当前手机号已绑定其他小程序!")

            if existing_auth and existing_auth.user_uuid == user_uuid:
                # Phone already bound to this user -- just return success
                pass
            else:
                # Phone not yet bound -- update current user's auth_info
                auth = db.query(UserAuthInfo).filter(UserAuthInfo.user_uuid == user_uuid).first()
                if auth:
                    auth.phone = phone_number
                else:
                    auth = UserAuthInfo(user_uuid=user_uuid, phone=phone_number)
                    db.add(auth)
                # Set isVIP=0 if user is guest
                user = db.query(User).filter(User.uuid == user_uuid).first()
                if user and user.is_vip != 1:
                    user.is_vip = 0
                db.commit()

            masked = phone_number[:3] + "****" + phone_number[-4:] if len(phone_number) >= 7 else phone_number
            return success({"phone": masked, "phone_full": phone_number})

    except Exception as e:
        logger.error(f"WeChat phone request error: {e}")
        return error("获取手机号服务异常,请稍后重试")


@router.post("/mini/rebind", summary="Rebind WeChat mini-program account")
async def wechat_rebind(
    code: str = Query(..., description="New WeChat login code"),
    user_uuid: str = Depends(require_login),
):
    """Rebind WeChat: unbind old openid, bind new one from code."""
    # Step 1: Get new openid from code
    url = (
        f"https://api.weixin.qq.com/sns/jscode2session"
        f"?appid={settings.WX_MINI_APPID}"
        f"&secret={settings.WX_MINI_SECRET}"
        f"&js_code={code}&grant_type=authorization_code"
    )
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url)
            data = resp.json()
        if "openid" not in data:
            return error(data.get("errmsg", "WeChat auth failed"), "401")
        new_open_id = data["openid"]
        new_union_id = data.get("unionid", "")

        from app.database import SessionFactory2, get_session
        from app.models.user_models import UserThirdPartyAccount

        with get_session(factory=SessionFactory2) as db:
            # Check if new openid is already bound to another user
            existing = (
                db.query(UserThirdPartyAccount)
                .filter(
                    UserThirdPartyAccount.platform == "wechat",
                    UserThirdPartyAccount.open_id == new_open_id,
                    UserThirdPartyAccount.deleted_at.is_(None),
                )
                .first()
            )
            if existing and existing.user_uuid != user_uuid:
                return error("该微信账号已被其他用户绑定", "409")
            # Remove old wechat bindings for this user
            db.query(UserThirdPartyAccount).filter(
                UserThirdPartyAccount.user_uuid == user_uuid,
                UserThirdPartyAccount.platform == "wechat",
            ).delete()
            # Bind new openid
            tpa = UserThirdPartyAccount(
                user_uuid=user_uuid,
                open_id=new_open_id,
                union_id=new_union_id,
                platform="wechat",
            )
            db.add(tpa)
            db.commit()
            return success({"open_id": new_open_id}, msg="微信换绑成功")
    except Exception as e:
        logger.error(f"WeChat rebind error: {e}")
        return error("微信换绑失败,请稍后重试", "500")


@router.post("/mini/rebind_by_phone", summary="Rebind WeChat by phone number")
def wechat_rebind_by_phone(
    phone: str = Query(..., description="User phone number"),
    open_id: str = Query(..., description="New WeChat open_id to bind"),
    current_user_uuid: str = Depends(require_login),
):
    """Rebind WeChat open_id by phone number.

    Matches Java LoginService.editWxOpenId(phone, openId):
      UPDATE zhs_user SET open_id = #{openId} WHERE phone = #{phone}

    This is the original ZHS phone-based rebind endpoint.
    安全: 需登录, 且仅允许手机号持有者换绑自己的微信 (current_user.phone == phone).
    """
    from app.database import SessionFactory2, get_session
    from app.models.user_models import UserAuthInfo, UserThirdPartyAccount

    try:
        with get_session(factory=SessionFactory2) as db:
            # Find user by phone
            auth = db.query(UserAuthInfo).filter(UserAuthInfo.phone == phone).first()
            if not auth:
                return error("该手机号未注册", "404")
            # 校验当前登录用户持有该手机号 (防越权换绑他人账号)
            if auth.user_uuid != current_user_uuid:
                return error("无权操作: 手机号与当前登录用户不匹配", "403")
            user_uuid = auth.user_uuid
            # Remove old wechat bindings for this user
            db.query(UserThirdPartyAccount).filter(
                UserThirdPartyAccount.user_uuid == user_uuid,
                UserThirdPartyAccount.platform == "wechat",
            ).delete()
            # Add new binding
            tpa = UserThirdPartyAccount(
                user_uuid=user_uuid,
                open_id=open_id,
                platform="wechat",
            )
            db.add(tpa)
            db.commit()
            return success(msg="微信换绑成功")
    except Exception as e:
        logger.error(f"WeChat rebind by phone error: {e}")
        return error("微信换绑失败", "500")


@router.get("/mini/qrcode", summary="Get WeChat mini-program QR code")
async def get_wechat_qrcode(
    scene: str = Query(..., description="Scene string for QR code"),
    page: str = Query("pages/index/index", description="Mini-program page path"),
    user_uuid: str = Depends(require_login),
):
    """Generate WeChat mini-program unlimited QR code via getwxacodeunlimit."""
    access_token = await _get_wechat_access_token()
    if not access_token:
        return error("获取微信凭证失败,请稍后重试")

    url = f"https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token={access_token}"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                url,
                json={
                    "scene": scene,
                    "page": page,
                    "check_path": False,
                },
            )
        # If response is JSON, it's an error
        if resp.headers.get("content-type", "").startswith("application/json"):
            err_data = resp.json()
            logger.error(f"WeChat getwxacodeunlimit failed: {err_data}")
            return error(err_data.get("errmsg", "获取小程序码失败"))

        # Upload image buffer to MinIO
        from app.utils.minio_util import upload_file

        image_url = upload_file(
            file_data=resp.content,
            file_name="wxa_qrcode.png",
            content_type="image/png",
        )
        return success({"url": image_url})
    except Exception as e:
        logger.error(f"WeChat qrcode error: {e}")
        return error("获取小程序码失败,请稍后重试", "500")


# ---------------------------------------------------------------------------
# WeChat PC 扫码登录 (PC QR code login)
# ---------------------------------------------------------------------------

@router.get("/pc/wxCode", summary="微信PC扫码登录 - 获取授权页")
def wechat_pc_wx_code():
    """微信PC扫码登录入口.

    返回一个 HTML 页面, 内嵌微信开放平台扫码授权 iframe,
    扫码成功后通过 postMessage 将登录结果通知父窗口.
    """
    app_id = settings.WX_PC_APPID or ""
    redirect_uri = f"https://open.weixin.qq.com/connect/qrconnect?appid={app_id}&redirect_uri=&response_type=code&scope=snsapi_login&state=pc_login#wechat_redirect"

    html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>微信登录</title>
<style>
* {{ margin: 0; padding: 0; box-sizing: border-box; }}
body {{ display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }}
.login-container {{ background: #fff; border: 1px solid #e0e0e0; padding: 40px; text-align: center; }}
.login-container h2 {{ margin-bottom: 20px; color: #333; font-size: 20px; }}
.qrcode-wrapper {{ width: 300px; height: 400px; margin: 0 auto; }}
.status {{ margin-top: 15px; color: #999; font-size: 14px; }}
</style>
</head>
<body>
<div class="login-container">
  <h2>微信扫码登录</h2>
  <div class="qrcode-wrapper">
    <iframe src="{redirect_uri}" frameborder="0" width="300" height="400" id="wxFrame"></iframe>
  </div>
  <p class="status" id="status">请使用微信扫描二维码</p>
</div>
<script>
window.addEventListener('message', function(event) {{
  if (event.data && event.data.type === 'wx_login') {{
    window.parent.postMessage(event.data, '*');
  }}
}});
</script>
</body>
</html>"""
    from fastapi import Response

    return Response(content=html, media_type="text/html")


@router.get("/pc/callback", summary="微信PC扫码登录回调")
async def wechat_pc_callback(code: str = Query(..., description="微信授权码")):
    """微信PC扫码登录回调, 用 code 换取用户信息并登录.

    公开接口, 微信扫码授权后回调.
    """
    app_id = settings.WX_PC_APPID
    secret = settings.WX_PC_SECRET

    if not app_id or not secret:
        logger.warning("WeChat PC login not configured (WX_PC_APPID/WX_PC_SECRET empty)")
        return error("微信PC登录未配置")

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            # 1. 用 code 换 access_token
            token_url = (
                f"https://api.weixin.qq.com/sns/oauth2/access_token"
                f"?appid={app_id}&secret={secret}&code={code}&grant_type=authorization_code"
            )
            token_resp = await client.get(token_url)
            token_data = token_resp.json()

            if "errcode" in token_data:
                logger.error(f"WeChat PC token error: {token_data}")
                return error(token_data.get("errmsg", "微信登录失败"))

            access_token = token_data.get("access_token")
            openid = token_data.get("openid")

            # 2. 用 access_token 获取用户信息
            user_url = (
                f"https://api.weixin.qq.com/sns/userinfo"
                f"?access_token={access_token}&openid={openid}"
            )
            user_resp = await client.get(user_url)
            user_data = user_resp.json()

            if "errcode" in user_data:
                logger.error(f"WeChat PC userinfo error: {user_data}")
                return error(user_data.get("errmsg", "获取用户信息失败"))

            # 3. 查找或创建用户, 签发 JWT
            unionid = user_data.get("unionid", "")
            nickname = user_data.get("nickname", "")
            avatar = user_data.get("headimgurl", "")

            from app.database import get_session
            from app.models.user_models import User, UserThirdPartyAccount

            with get_session() as db:
                user = None
                # 先从第三方账号表查找绑定关系
                tp_query = db.query(UserThirdPartyAccount).filter(
                    UserThirdPartyAccount.platform == "wechat",
                    UserThirdPartyAccount.deleted_at.is_(None),
                )
                if unionid:
                    tp = tp_query.filter(UserThirdPartyAccount.union_id == unionid).first()
                else:
                    tp = tp_query.filter(UserThirdPartyAccount.open_id == openid).first()

                if tp:
                    user = db.query(User).filter(User.uuid == tp.user_uuid).first()

                if user:
                    if nickname and not user.nickname:
                        user.nickname = nickname
                    if avatar and not user.avatar:
                        user.avatar = avatar
                    db.commit()
                else:
                    user = User(
                        nickname=nickname or f"wx_{openid[:8]}",
                        avatar=avatar,
                    )
                    db.add(user)
                    db.commit()
                    db.refresh(user)

                    # 创建第三方账号绑定
                    binding = UserThirdPartyAccount(
                        user_uuid=user.uuid,
                        open_id=openid,
                        union_id=unionid,
                        platform="wechat",
                    )
                    db.add(binding)
                    db.commit()

                jwt_token = create_access_token(subject=user.uuid)

            return success({"token": jwt_token, "user": {"uuid": user.uuid, "nickname": user.nickname, "avatar": user.avatar}})
    except Exception as e:
        logger.error(f"WeChat PC login error: {e}")
        return error("微信登录失败,请稍后重试", "500")
