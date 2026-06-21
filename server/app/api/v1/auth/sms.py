"""SMS verification routes."""

from fastapi import APIRouter, Query

from app.schemas.common import error, success
from app.utils.sms_util import send_sms_code, verify_sms_code

router = APIRouter(prefix="/sms", tags=["SMS"])


@router.post("/send", summary="Send SMS code")
async def send_code(phone: str = Query(...)):
    result = await send_sms_code(phone)
    if not result["success"]:
        return error(result["msg"], "429")
    return success(msg="Code sent")


@router.post("/verify", summary="Verify SMS code")
async def verify_code(phone: str = Query(...), code: str = Query(...)):
    ok = verify_sms_code(phone, code)
    return success({"valid": ok})
