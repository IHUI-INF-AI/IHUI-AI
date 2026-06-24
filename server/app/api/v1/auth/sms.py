"""SMS verification routes."""

import re

from fastapi import APIRouter, Query, Request

from app.schemas.common import error, success
from app.utils.sms_util import send_sms_code, verify_sms_code

router = APIRouter(prefix="/sms", tags=["SMS"])

# 中国大陆手机号格式: 1 开头, 第二位 3-9, 共 11 位数字
PHONE_RE = re.compile(r"^1[3-9]\d{9}$")


def _validate_phone(phone: str) -> bool:
    """校验手机号格式 (中国大陆)."""
    return bool(phone and PHONE_RE.match(phone))


async def _json_body(request: Request) -> dict:
    """从 request 解析 JSON body, 失败返回空 dict (兼容前端 JSON Body 传参)."""
    try:
        return await request.json()
    except Exception:
        return {}


@router.post("/send", summary="Send SMS code")
async def send_code(request: Request, phone: str = Query(None)):
    body = await _json_body(request)
    phone = phone or body.get("phone")
    if not _validate_phone(phone):
        return error("手机号格式不正确", "400")
    result = await send_sms_code(phone)
    if not result["success"]:
        return error(result["msg"], "429")
    return success(msg="Code sent")


@router.post("/verify", summary="Verify SMS code")
async def verify_code(request: Request, phone: str = Query(None), code: str = Query(None)):
    body = await _json_body(request)
    phone = phone or body.get("phone")
    code = code or body.get("code")
    if not _validate_phone(phone):
        return error("手机号格式不正确", "400")
    ok = verify_sms_code(phone, code)
    return success({"valid": ok})
