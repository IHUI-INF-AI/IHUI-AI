# SMS proxy module - CORS fix for frontend.
# Ported from P3 coze_zhs_py/api/sms_proxy.py
import asyncio
import logging
from typing import Any

import httpx
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import text

from app.config import settings
from app.database import get_session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sms-proxy", tags=["SMS Proxy"])

# ---------------------------------------------------------------------------
# Response helper -- eliminates 17+ inline JSONResponse constructions
# ---------------------------------------------------------------------------

_SMS_HEADERS = {"Content-Type": "application/json", "User-Agent": "OAuth-SMS-Proxy/1.0"}


def _sms_resp(success: bool, code: str, msg: str, data: Any = None, **extra) -> JSONResponse:
    """Build a standard SMS proxy JSONResponse."""
    content = {"success": success, "code": code, "msg": msg, "data": data, **extra}
    return JSONResponse(content=content)


class SmsVerifyRequest(BaseModel):
    phone: str
    tempId: int | None = None  # noqa: 5
    tempCode: str | None = None  # noqa: 5


class SmsCodeVerifyRequest(BaseModel):
    phone: str
    code: str


class RegisterRequest(BaseModel):
    phone: str
    code: str


def _query_user_uuid_by_phone(phone: str) -> str | None:
    """根据手机号查询 user_uuid (同步, 由 asyncio.to_thread 调用)."""
    with get_session() as db:
        query = text(
            "SELECT user_uuid FROM user_auth_info WHERE phone = :phone AND user_uuid IS NOT NULL AND user_uuid != '' LIMIT 1"
        )
        row = db.execute(query, {"phone": phone}).fetchone()
        return row[0] if row and row[0] else None


@router.post("/send")
async def send_sms_code(request: SmsVerifyRequest):
    """Send SMS verification code (proxy)."""
    try:
        payload = {"phone": request.phone, "tempId": request.tempId or 1, "tempCode": request.tempCode or ""}
        api_url = settings.SMS_API_BASE_URL + settings.SMS_VERIFY_ENDPOINT
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            response = await client.post(api_url, json=payload, headers=_SMS_HEADERS)
            try:
                result = response.json()
            except Exception:
                result = {"msg": response.text, "code": str(response.status_code)}
            if response.status_code == 200:
                return _sms_resp(True, "200", "Verification code sent", result)
            return _sms_resp(False, str(response.status_code), result.get("msg", "Send failed"), result)
    except httpx.TimeoutException:
        return _sms_resp(False, "TIMEOUT", "Request timeout")
    except httpx.ConnectError:
        return _sms_resp(False, "CONNECT_ERROR", "SMS service unreachable")
    except Exception as e:
        logger.error("SMS send proxy error: " + str(e))
        return _sms_resp(False, "PROXY_ERROR", "Proxy error: " + str(e))


@router.post("/verify")
async def verify_sms_code(request: SmsCodeVerifyRequest):
    """Verify SMS code (proxy)."""
    try:
        api_url = settings.SMS_API_BASE_URL + settings.SMS_CODE_VERIFY_ENDPOINT
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            response = await client.post(
                api_url, json={"phone": request.phone, "code": request.code}, headers=_SMS_HEADERS
            )
            try:
                result = response.json()
            except Exception:
                result = {"msg": response.text, "code": str(response.status_code)}
            if response.status_code == 200:
                if result.get("code") == "200" and result.get("msg") == "success":
                    return _sms_resp(True, "200", "success", result.get("data"), uuid=result.get("uuid"))
                return _sms_resp(
                    False, result.get("code", "VERIFY_FAILED"), result.get("msg", "Invalid code"), result.get("data")
                )
            return _sms_resp(False, str(response.status_code), result.get("msg", "Verify failed"), result)
    except httpx.TimeoutException:
        return _sms_resp(False, "TIMEOUT", "Verify timeout")
    except httpx.ConnectError:
        return _sms_resp(False, "CONNECT_ERROR", "Verify service unreachable")
    except Exception as e:
        logger.error("SMS verify proxy error: " + str(e))
        return _sms_resp(False, "PROXY_ERROR", "Proxy error: " + str(e))


@router.post("/register")
async def quick_register(request: RegisterRequest):
    """Quick register: verify code then register user."""
    try:
        api_url = settings.SMS_API_BASE_URL + settings.SMS_CODE_VERIFY_ENDPOINT
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            verify_resp = await client.post(
                api_url, json={"phone": request.phone, "code": request.code}, headers=_SMS_HEADERS
            )
            try:
                verify_result = verify_resp.json()
            except Exception:
                verify_result = {"msg": verify_resp.text, "code": str(verify_resp.status_code)}

            if verify_resp.status_code != 200 or verify_result.get("code") != "200":
                return _sms_resp(
                    False, verify_result.get("code", "VERIFY_FAILED"), verify_result.get("msg", "Invalid code")
                )

            if verify_result.get("uuid"):
                return _sms_resp(
                    True, "200", "Already registered", uuid=verify_result.get("uuid"), already_registered=True
                )

            temp_token = verify_result.get("data")
            if not temp_token:
                return _sms_resp(False, "NO_TEMP_TOKEN", "No temp token")

            register_url = settings.SMS_API_BASE_URL + "/ai/login/pwd/registerLogin"
            register_resp = await client.post(
                register_url,
                json={"phone": request.phone, "password": "", "parentId": ""},
                headers={**_SMS_HEADERS, "Authorization": temp_token, "platform-type": "web"},
            )
            try:
                register_result = register_resp.json()
            except Exception:
                register_result = {"msg": register_resp.text, "code": str(register_resp.status_code)}

            if register_resp.status_code != 200 or register_result.get("code") != "200":
                return _sms_resp(
                    False,
                    register_result.get("code", "REGISTER_FAILED"),
                    register_result.get("msg", "Register failed"),
                    register_result,
                )

            try:
                # P0 修复: 同步 DB 调用放到 threadpool, 避免阻塞事件循环
                user_uuid = await asyncio.to_thread(_query_user_uuid_by_phone, request.phone)
                if user_uuid:
                    return _sms_resp(
                        True, "200", "Register success", uuid=user_uuid, phone=request.phone, register_success=True
                    )
                return _sms_resp(False, "USER_NOT_FOUND", "Processing, retry later")
            except Exception as db_err:
                return _sms_resp(False, "DB_ERROR", "DB error", str(db_err))
    except httpx.TimeoutException:
        return _sms_resp(False, "TIMEOUT", "Register timeout")
    except httpx.ConnectError:
        return _sms_resp(False, "CONNECT_ERROR", "Register service unreachable")
    except Exception as e:
        logger.error("Register proxy error: " + str(e))
        return _sms_resp(False, "REGISTER_ERROR", "Register error: " + str(e))


@router.get("/config")
def get_proxy_config():
    """Return SMS proxy configuration."""
    config_data = {
        "sms_verify_url": "/api/sms-proxy/send",
        "sms_code_verify_url": "/api/sms-proxy/verify",
        "sms_send_interval": 60,
        "sms_code_expire": 300,
        "use_proxy": True,
        "proxy_version": "1.0",
    }
    return JSONResponse(content={"success": True, "data": config_data})
