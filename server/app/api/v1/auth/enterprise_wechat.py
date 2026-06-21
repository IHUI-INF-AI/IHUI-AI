# Enterprise WeChat (WeCom) login endpoints.
# Ported from P2 EnterpriseWeChatLoginController.java
from fastapi import APIRouter, Query, Request
from loguru import logger

from app.services.enterprise_wechat_service import enterprise_wechat_login, save_suite_ticket

router = APIRouter(prefix="/login/enterprise", tags=["Auth: Enterprise WeChat"])


@router.get("/pc/wxCode")
async def enterprise_pc_wx_code(code: str = Query(..., description="WeCom js_code")):
    # Exchange WeCom code for login result
    logger.info("Enterprise WeChat pc/wxCode, code=" + code[:10] + "...")
    result = await enterprise_wechat_login(code)
    return result


@router.post("/pc/callback")
async def enterprise_pc_callback(
    request: Request, msg_signature: str = Query(""), timestamp: str = Query(""), nonce: str = Query("")
):
    # Receive suite_ticket from WeCom periodic callback
    body = await request.body()
    xml_param = body.decode("utf-8")
    logger.info("Enterprise WeChat callback, msg_signature=" + msg_signature)
    ok = await save_suite_ticket(xml_param)
    if ok:
        return {"code": "200", "message": "Callback processed"}
    return {"code": "500", "message": "Callback processing failed"}
