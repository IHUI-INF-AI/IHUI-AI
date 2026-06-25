# DingTalk (钉钉) login endpoints.
from fastapi import APIRouter, Query
from loguru import logger

from app.services.dingtalk_auth_service import dingtalk_login_by_code, get_dingtalk_config

router = APIRouter(prefix="/login/dingtalk", tags=["Auth: DingTalk"])


@router.get("/config", summary="获取钉钉配置")
def dingtalk_config():
    """获取钉钉登录配置 (appId, corpId, agentId), 公开接口."""
    config = get_dingtalk_config()
    return {"code": "200", "message": "success", "data": config}


@router.get("/user/by-code", summary="根据code获取用户信息")
async def dingtalk_user_by_code(code: str = Query(..., description="钉钉临时授权码")):
    """根据钉钉授权码获取用户信息, 完成登录流程.

    公开接口, 前端钉钉 SDK 回调后调用.
    """
    logger.info("DingTalk login by code, code=" + code[:10] + "...")
    result = await dingtalk_login_by_code(code)
    return result
