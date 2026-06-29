"""Agent 上传/查询/处理 API 端点.

迁移自 ZHS_Server_java/small/controller/AgentUploadController.java.
提供 /api/agent/upload、/api/agent/select、/api/agent/process 三个端点.
"""

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Body, Depends, Query
from loguru import logger
from sqlalchemy.orm import Session

from app.database import get_session
from app.models.agent_misc_models import AgentUpload
from app.schemas.common import success, error
from app.schemas.error_codes import ErrorCode
from app.services.agent_upload import (
    assemble,
    build_input_params,
    get_agent_client,
)

router = APIRouter(prefix="/api/agent", tags=["Agent 上传处理"])


@router.post("/upload", summary="上传智能体配置")
async def upload_agent(
    payload: dict[str, Any] = Body(...),
    db: Session = Depends(get_session),
):
    """上传智能体配置数据到 agent_uploads 表."""
    try:
        agent_id = payload.get("agent_id", "")
        if not agent_id:
            return error("缺少 agent_id", ErrorCode.BAD_REQUEST)
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
        record.updated_at = datetime.utcnow()  # type: ignore[assignment]
        db.commit()
        return success({"agent_id": agent_id})
    except Exception as e:
        logger.error(f"上传智能体配置失败: {e}")
        db.rollback()
        return error(f"上传失败: {e}", ErrorCode.INTERNAL_ERROR)


@router.get("/select", summary="查询智能体配置")
async def select_agent(
    agent_id: str = Query(...),
    db: Session = Depends(get_session),
):
    """根据 agent_id 查询 agent_uploads 表数据."""
    try:
        record = db.query(AgentUpload).filter(AgentUpload.agent_id == agent_id).first()
        if not record:
            return error("智能体不存在", ErrorCode.NOT_FOUND)
        return success({
            "agent_id": record.agent_id,
            "agent_name": record.agent_name,
            "agent_url": record.agent_url,
            "agent_variables_in": record.agent_variables_in,
            "agent_variables_out": record.agent_variables_out,
            "agent_problems": record.agent_problems,
            "description": record.description,
            "type": record.type,
            "status": record.status,
        })
    except Exception as e:
        logger.error(f"查询智能体配置失败: {e}")
        return error(f"查询失败: {e}", ErrorCode.INTERNAL_ERROR)


@router.post("/process", summary="处理智能体调用")
async def process_agent(
    payload: dict[str, Any] = Body(...),
    db: Session = Depends(get_session),
):
    """调用智能体端点并组装响应."""
    agent_id = payload.get("agent_id", "")
    if not agent_id:
        return error("缺少 agent_id", ErrorCode.BAD_REQUEST)
    record = db.query(AgentUpload).filter(AgentUpload.agent_id == agent_id).first()
    if not record:
        return error("智能体不存在", ErrorCode.NOT_FOUND)
    try:
        input_params = build_input_params(record, payload.get("problems", "[]"))
        client = get_agent_client()
        answer_object = await client.invoke_agent(record, input_params)
        counting_unit = getattr(record, "counting_unit", None)
        result = assemble(record, answer_object, counting_unit)
        return success(result)
    except Exception as e:
        logger.error(f"处理智能体调用失败: {e}")
        return error(f"处理失败: {e}", ErrorCode.INTERNAL_ERROR)
