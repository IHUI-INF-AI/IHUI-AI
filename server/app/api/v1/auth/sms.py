"""SMS verification routes."""

from fastapi import APIRouter, Body

from app.schemas.common import error, success
from app.utils.sms_util import send_sms_code, verify_sms_code

router = APIRouter(prefix="/sms", tags=["SMS"])


@router.post("/send", summary="Send SMS code")
async def send_code(phone: str = Body(..., embed=True)):
    """发送短信验证码 (JSON Body, embed=True 支持 {phone}).

    2026-06-28 联调: 改 Query→Body, 对齐前端调用方式 (JSON body).
    """
    result = await send_sms_code(phone)
    if not result["success"]:
        return error(result["msg"], "429")
    return success(msg="Code sent")


@router.post("/verify", summary="Verify SMS code")
async def verify_code(
    phone: str = Body(..., embed=True),
    code: str = Body(..., embed=True),
):
    """校验短信验证码 (JSON Body, embed=True 支持 {phone,code}).

    2026-06-28 联调: 改 Query→Body, 对齐前端 LOGIN_PWD_PATHS.smsVerify 调用方式
    (前端 api/api-utils.ts:35 发送 JSON body {phone, code}).
    """
    ok = verify_sms_code(phone, code)
    return success({"valid": ok})
