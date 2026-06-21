# Personality test n8n agent proxy

import httpx
from fastapi import APIRouter
from loguru import logger
from pydantic import BaseModel

from app.config import settings

router = APIRouter(prefix="/personality", tags=["Personality Test"])


class PersonalityReq(BaseModel):
    user_input: str
    user_uuid: str | None = None
    session_id: str | None = None


@router.post("/test")
async def personality_test(req: PersonalityReq):
    try:
        n8n_url = settings.N8N_BASE_URL + settings.N8N_WEBHOOK_PATH
        payload = {"user_input": req.user_input, "user_uuid": req.user_uuid or "", "session_id": req.session_id or ""}
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(n8n_url, json=payload, headers={"Content-Type": "application/json"})
        if resp.status_code == 200:
            return resp.json()
        logger.error("Personality n8n error: " + str(resp.status_code))
        return {"error": "n8n service error", "status": resp.status_code}
    except Exception as e:
        logger.error("Personality test error: " + str(e))
        return {"error": str(e)}
