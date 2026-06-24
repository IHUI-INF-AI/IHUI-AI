"""SMS verification routes."""

from fastapi import APIRouter, Query, Request

from app.schemas.common import error, success
from app.utils.sms_util import send_sms_code, verify_sms_code

router = APIRouter(prefix="/sms", tags=["SMS"])


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
    result = await send_sms_code(phone)
    if not result["success"]:
        return error(result["msg"], "429")
    return success(msg="Code sent")


@router.post("/verify", summary="Verify SMS code")
async def verify_code(request: Request, phone: str = Query(None), code: str = Query(None)):
    body = await _json_body(request)
    phone = phone or body.get("phone")
    code = code or body.get("code")
    ok = verify_sms_code(phone, code)
    return success({"valid": ok})
