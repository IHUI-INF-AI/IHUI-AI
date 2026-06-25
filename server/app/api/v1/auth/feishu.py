# Feishu (Lark) login endpoints.
# Ported from P2 FeishuLoginController.java
from fastapi import APIRouter, Query
from loguru import logger

from app.services.feishu_auth_service import feishu_login_by_code

router = APIRouter(prefix="/login/feishu", tags=["Auth: Feishu"])


@router.get("/pc/wxCode")
async def feishu_pc_wx_code(code: str = Query(..., description="Feishu auth code")):
    # Exchange Feishu auth code for login result
    logger.info("Feishu pc/wxCode request, code=" + code[:10] + "...")
    result = await feishu_login_by_code(code)
    return result


@router.get("/pc/test")
def feishu_pc_test(code: str = Query(..., description="test code")):
    # Test endpoint
    return {"code": "200", "message": "Feishu test OK", "data": {"code_received": code}}
