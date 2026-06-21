"""Agent examine/audit routes."""

from datetime import datetime

from fastapi import APIRouter, Body, Depends, Query
from sqlalchemy import func

from app.database import get_session
from app.schemas.common import error, success
from app.security import require_login

router = APIRouter()


@router.get("/list", summary="List agent examinations")
async def list_examine(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: int = Query(None),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        from app.models.activity_models import AgentExamine

        q = db.query(AgentExamine)
        if status is not None:
            q = q.filter(AgentExamine.examine_status == status)
        total = q.count()
        items = q.offset((page - 1) * limit).limit(limit).all()
        data = [
            {"id": e.id, "agent_id": e.agent_id, "examine_status": e.examine_status, "examine_remark": e.examine_remark}
            for e in items
        ]
        return success(data, total=total)


@router.get("/stats/summary", summary="Examination statistics")
async def examine_stats(
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        from app.models.activity_models import AgentExamine

        rows = (
            db.query(AgentExamine.examine_status, func.count(AgentExamine.id))
            .group_by(AgentExamine.examine_status)
            .all()
        )
        stats = dict.fromkeys(("pending", "approved", "rejected"), 0)
        status_map = {0: "pending", 1: "approved", 2: "rejected"}
        for status_val, count in rows:
            key = status_map.get(status_val)
            if key:
                stats[key] = count
        return success(stats)


@router.get("/{record_id}", summary="Get examination detail")
async def get_examine_detail(
    record_id: int,
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        from app.models.activity_models import AgentExamine

        ex = db.query(AgentExamine).filter(AgentExamine.id == record_id).first()
        if not ex:
            return error("Examination record not found", code="404")
        data = {
            "id": ex.id,
            "agent_id": ex.agent_id,
            "examine_status": ex.examine_status,
            "examine_user": ex.examine_user,
            "examine_time": str(ex.examine_time) if ex.examine_time else None,
            "examine_remark": ex.examine_remark,
            "create_time": str(ex.create_time) if ex.create_time else None,
        }
        return success(data)


@router.put("/{record_id}/approve", summary="Approve agent examination")
async def approve_examine(
    record_id: int,
    remark: str = Body(None, embed=True),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        try:
            from app.models.activity_models import AgentExamine
            from app.models.agent_models import Agent

            ex = db.query(AgentExamine).filter(AgentExamine.id == record_id).first()
            if not ex:
                return error("Examination record not found", code="404")
            if ex.examine_status == 1:
                return error("Already approved", code="400")

            # Update examine record
            ex.examine_status = 1
            ex.examine_user = user_uuid
            ex.examine_time = datetime.now()
            ex.examine_remark = remark

            # Update agent publish status to published
            agent = db.query(Agent).filter(Agent.agent_id == ex.agent_id).first()
            if agent:
                agent.publish_status = 1
                agent.publish_time = datetime.now()

            db.commit()
            return success(msg="Approved")
        except Exception as e:
            return error(str(e))


@router.put("/{record_id}/reject", summary="Reject agent examination")
async def reject_examine(
    record_id: int,
    reject_reason: str = Body(..., embed=True),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        try:
            from app.models.activity_models import AgentExamine

            ex = db.query(AgentExamine).filter(AgentExamine.id == record_id).first()
            if not ex:
                return error("Examination record not found", code="404")
            if ex.examine_status == 2:
                return error("Already rejected", code="400")

            ex.examine_status = 2
            ex.examine_user = user_uuid
            ex.examine_time = datetime.now()
            ex.examine_remark = reject_reason

            db.commit()
            return success(msg="Rejected")
        except Exception as e:
            return error(str(e))


@router.post("/submit", summary="Submit agent for examination")
async def submit_examine(
    agent_id: str = Query(...),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        try:
            from app.models.activity_models import AgentExamine

            ex = AgentExamine(agent_id=agent_id, examine_status=0)
            db.add(ex)
            db.commit()
            return success(msg="Submitted for review")
        except Exception as e:
            return error(str(e))
