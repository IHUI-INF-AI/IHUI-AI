# Alipay login endpoints.
# Ported from P2 AliLoginController.java + AliLoginServiceImpl.java
import base64
from datetime import datetime
from typing import Any

import httpx
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from fastapi import APIRouter, Query
from loguru import logger

from app.config import settings

router = APIRouter(prefix="/login/ali", tags=["Auth: Alipay"])

ALIPAY_GATEWAY = "https://openapi.alipay.com/gateway.do"


def _build_sign(params: dict[str, Any]) -> str:
    """构建支付宝网关 RSA2 (RSA-SHA256) 签名.

    按照支付宝网关签名规则:
    1. 过滤空值与 sign 字段
    2. 按参数名 ASCII 字典序排序
    3. 拼接成 key=value 字符串
    4. 使用 RSA-SHA256 (PKCS1v15) 私钥签名
    5. Base64 编码返回
    """
    private_key_pem = settings.ALI_LOGIN_PRIVATE_KEY
    if not private_key_pem:
        raise ValueError("ALI_LOGIN_PRIVATE_KEY is not configured")

    # 1. 过滤空值与 sign, 按 key ASCII 字典序排序
    sorted_items = sorted(
        (k, v) for k, v in params.items() if k != "sign" and v not in (None, "")
    )
    # 2. 拼接待签名字符串
    sign_string = "&".join(f"{k}={v}" for k, v in sorted_items)
    # 3. 加载 PEM 格式私钥
    private_key = serialization.load_pem_private_key(
        private_key_pem.encode("utf-8"), password=None
    )
    # 4. RSA-SHA256 签名 (PKCS1v15)
    signature = private_key.sign(
        sign_string.encode("utf-8"),
        padding.PKCS1v15(),
        hashes.SHA256(),
    )
    # 5. Base64 编码
    return base64.b64encode(signature).decode("utf-8")


def _ali_oauth_and_userinfo(code: str, is_web: bool = False) -> dict[str, Any]:
    # Call Alipay OAuth + user info via HTTP with RSA2 signing.
    app_id = settings.ALI_LOGIN_APP_ID
    logger.info("Alipay OAuth code exchange, is_web=" + str(is_web))
    try:
        # Step 1: Exchange auth_code for access_token
        oauth_params = {
            "app_id": app_id,
            "method": "alipay.system.oauth.token",
            "charset": "utf-8",
            "sign_type": "RSA2",
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "version": "1.0",
            "grant_type": "authorization_code",
            "code": code,
        }
        oauth_params["sign"] = _build_sign(oauth_params)
        with httpx.Client(timeout=15) as client:
            resp = client.post(ALIPAY_GATEWAY, params=oauth_params)
            body = resp.json()
            token_resp = body.get("alipay_system_oauth_token_response", {})
            access_token = token_resp.get("access_token", "")
            if not access_token:
                return {"success": False, "error": "OAuth token exchange failed", "raw": body}
            # Step 2: Get user info
            info_params = {
                "app_id": app_id,
                "method": "alipay.user.info.share",
                "charset": "utf-8",
                "sign_type": "RSA2",
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "version": "1.0",
                "auth_token": access_token,
            }
            info_params["sign"] = _build_sign(info_params)
            resp2 = client.post(ALIPAY_GATEWAY, params=info_params)
            body2 = resp2.json()
            user_resp = body2.get("alipay_user_info_share_response", {})
            return {
                "success": True,
                "open_id": user_resp.get("open_id", ""),
                "mobile": user_resp.get("mobile", ""),
                "avatar": user_resp.get("avatar", ""),
            }
    except Exception as e:
        logger.error("Alipay OAuth error: " + str(e))
        return {"success": False, "error": str(e)}


@router.get("/pc/wxCode")
def ali_pc_wx_code(code: str = Query(..., description="Alipay auth code")):
    # PC Alipay login
    logger.info("Alipay pc/wxCode, code=" + code[:10] + "...")
    result = _ali_oauth_and_userinfo(code, is_web=False)
    if not result.get("success"):
        return {"code": "500", "message": result.get("error", "Alipay auth failed"), "data": None}
    open_id = result.get("open_id", "")
    # Look up user
    from app.database import SessionFactory2
    from app.models.user_models import User, UserThirdPartyAccount

    db = SessionFactory2()
    try:
        third = (
            db.query(UserThirdPartyAccount)
            .filter(
                UserThirdPartyAccount.open_id == open_id,
                UserThirdPartyAccount.platform == "ALI",
                UserThirdPartyAccount.deleted_at.is_(None),
            )
            .first()
        )
        if third:
            user = db.query(User).filter(User.uuid == third.user_uuid).first()
            if user:
                return {
                    "code": "200",
                    "message": "Login success",
                    "data": {"user_uuid": user.uuid, "platform": "ALI", "open_id": open_id},
                }
        return {"code": "40101", "message": "Phone binding required", "data": {"open_id": open_id, "platform": "ALI"}}
    except Exception as e:
        return {"code": "500", "message": str(e), "data": None}
    finally:
        db.close()


@router.get("/web/wxCode")
def ali_web_wx_code(auth_code: str = Query(..., description="Alipay web auth code")):
    # Web Alipay login
    logger.info("Alipay web/wxCode, auth_code=" + auth_code[:10] + "...")
    result = _ali_oauth_and_userinfo(auth_code, is_web=True)
    if not result.get("success"):
        return {"code": "500", "message": result.get("error", "Alipay auth failed"), "data": None}
    open_id = result.get("open_id", "")
    mobile = result.get("mobile", "")
    from app.database import SessionFactory2
    from app.models.user_models import User, UserThirdPartyAccount

    db = SessionFactory2()
    try:
        third = (
            db.query(UserThirdPartyAccount)
            .filter(
                UserThirdPartyAccount.open_id == open_id,
                UserThirdPartyAccount.platform == "WEB_ALI",
                UserThirdPartyAccount.deleted_at.is_(None),
            )
            .first()
        )
        if third:
            user = db.query(User).filter(User.uuid == third.user_uuid).first()
            if user:
                return {
                    "code": "200",
                    "message": "Login success",
                    "data": {"user_uuid": user.uuid, "platform": "WEB_ALI", "open_id": open_id},
                }
        return {
            "code": "40101",
            "message": "Phone binding required",
            "data": {"open_id": open_id, "platform": "WEB_ALI", "mobile": mobile},
        }
    except Exception as e:
        return {"code": "500", "message": str(e), "data": None}
    finally:
        db.close()
