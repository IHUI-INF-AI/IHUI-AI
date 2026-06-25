from typing import Any

import httpx
from fastapi import APIRouter, HTTPException
from loguru import logger
from pydantic import BaseModel

from app.config import settings
from app.utils.coze_compat import get_coze_jwt_access_token

router = APIRouter(prefix="/review", tags=["Coze Review"])


class UpdateReviewReq(BaseModel):
    bot_id: str
    connector_id: str
    audit_status: int
    reason: str | None = None


class UpdateReviewResp(BaseModel):
    success: bool
    message: str
    data: dict[str, Any] | None = None


@router.post("/update_review_result", response_model=UpdateReviewResp)
async def update_review_result(req: UpdateReviewReq):
    try:
        access_token = await get_coze_jwt_access_token()
        api_url = settings.COZE_API_BASE + "/v1/connectors/" + req.connector_id + "/bots/" + req.bot_id
        body = {"audit_status": req.audit_status}
        if req.reason:
            body["reason"] = req.reason
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.put(
                api_url,
                headers={"Authorization": "Bearer " + access_token, "Content-Type": "application/json"},
                json=body,
            )
        if resp.status_code == 200:
            try:
                result = resp.json()
            except Exception:
                result = {"message": resp.text}
            return UpdateReviewResp(success=True, message="ok", data=result)
        else:
            raise HTTPException(status_code=resp.status_code, detail="Coze API error: " + resp.text)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Update review error: " + str(e))
        raise HTTPException(status_code=500, detail="服务内部错误,请稍后重试") from e


@router.get("/status")
async def get_review_status(bot_id: str, connector_id: str):
    try:
        access_token = await get_coze_jwt_access_token()
        api_url = settings.COZE_API_BASE + "/v1/connectors/" + connector_id + "/bots/" + bot_id
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(api_url, headers={"Authorization": "Bearer " + access_token})
        if resp.status_code == 200:
            return {"success": True, "data": resp.json()}
        return {"success": True, "data": {"bot_id": bot_id, "connector_id": connector_id, "audit_status": 0}}
    except Exception as e:
        logger.error("Get review status error: " + str(e))
        raise HTTPException(status_code=500, detail="服务内部错误,请稍后重试") from e
