"""Agent 上传/查询/处理 API 端点.

迁移自 ZHS_Server_java/small/controller/AgentUploadController.java.
提供 /api/agent/upload、/api/agent/select、/api/agent/process 三个端点.
"""

from typing import Any

from fastapi import APIRouter, Body, Depends, Query
from loguru import logger
from sqlalchemy.orm import Session

from app.database import get_session
from app.models.agent_misc_models import AgentUpload
from app.security import require_login
from app.services.agent_upload import (
    assemble,
    build_input_params,
    get_agent_client,
)
from app.utils.datetime_helper import utcnow

router = APIRouter(prefix="/api/agent", tags=["Agent 上传处理"])


@router.post("/upload", summary="上传智能体配置")
async def upload_agent(
    payload: dict[str, Any] = Body(...),
    db: Session = Depends(get_session),
    user_uuid: str = Depends(require_login),
):
    """上传智能体配置数据到 agent_uploads 表."""
    try:
        agent_id = payload.get("agent_id", "")
        if not agent_id:
            return {"code": 400, "message": "缺少 agent_id", "data": None}
        record = db.query(AgentUpload).filter(AgentUpload.agent_id == agent_id).first()
        if not record:
            record = AgentUpload(agent_id=agent_id)
            db.add(record)
        for k in (
            "agent_name", "agent_url", "agent_variables_in", "agent_variables_out",
            "agent_problems", "description", "type", "status", "field1", "field2",
        ):
            if k in payload:
                setattr(record, k, payload.get(k))
        record.updated_at = utcnow()
        db.commit()
        return {"code": 0, "message": "ok", "data": {"agent_id": agent_id}}
    except Exception as e:
        logger.error(f"上传智能体配置失败: {e}")
        db.rollback()
        return {"code": 500, "message": f"上传失败: {e}", "data": None}


@router.get("/select", summary="查询智能体配置")
async def select_agent(
    agent_id: str = Query(...),
    db: Session = Depends(get_session),
    _: str = Depends(require_login),
):
    """根据 agent_id 查询 agent_uploads 表数据."""
    try:
        record = db.query(AgentUpload).filter(AgentUpload.agent_id == agent_id).first()
        if not record:
            return {"code": 404, "message": "智能体不存在", "data": None}
        return {"code": 0, "message": "ok", "data": {
            "agent_id": record.agent_id,
            "agent_name": record.agent_name,
            "agent_url": record.agent_url,
            "agent_variables_in": record.agent_variables_in,
            "agent_variables_out": record.agent_variables_out,
            "agent_problems": record.agent_problems,
            "description": record.description,
            "type": record.type,
            "status": record.status,
        }}
    except Exception as e:
        logger.error(f"查询智能体配置失败: {e}")
        return {"code": 500, "message": f"查询失败: {e}", "data": None}


@router.post("/process", summary="处理智能体调用")
async def process_agent(
    payload: dict[str, Any] = Body(...),
    db: Session = Depends(get_session),
    _: str = Depends(require_login),
):
    """调用智能体端点并组装响应."""
    agent_id = payload.get("agent_id", "")
    if not agent_id:
        return {"code": 400, "message": "缺少 agent_id", "data": None}
    record = db.query(AgentUpload).filter(AgentUpload.agent_id == agent_id).first()
    if not record:
        return {"code": 404, "message": "智能体不存在", "data": None}
    try:
        input_params = build_input_params(record, payload.get("problems", "[]"))
        client = get_agent_client()
        answer_object = await client.invoke_agent(record, input_params)
        counting_unit = getattr(record, "counting_unit", None)
        result = assemble(record, answer_object, counting_unit)
        return {"code": 0, "message": "ok", "data": result}
    except Exception as e:
        logger.error(f"处理智能体调用失败: {e}")
        return {"code": 500, "message": f"处理失败: {e}", "data": None}
