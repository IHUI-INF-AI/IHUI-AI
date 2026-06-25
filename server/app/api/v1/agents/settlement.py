"""Agent 结算路由."""


from fastapi import APIRouter, Depends, Query
from loguru import logger
from sqlalchemy import func

from app.database import get_session
from app.schemas.common import error, success
from app.security import require_login

router = APIRouter()


@router.get("/list", summary="Agent 结算列表")
def list_settlements(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    settlement_status: str = Query(None, description="0=未结算 1=已结算"),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        from app.models.agent_settlement import AgentSettlement

        q = db.query(AgentSettlement).filter(AgentSettlement.uuid == user_uuid)
        if settlement_status is not None:
            q = q.filter(AgentSettlement.settlement == settlement_status)
        total = q.count()
        items = q.order_by(AgentSettlement.id.desc()).offset((page - 1) * limit).limit(limit).all()
        data = [
            {
                "id": s.id,
                "order_no": s.order_no,
                "agent_id": s.agent_id,
                "agent_name": s.agent_name,
                "expiration_date": s.expiration_date.isoformat() if s.expiration_date else None,
                "settlement": s.settlement,
                "withdrawal": s.withdrawal,
            }
            for s in items
        ]
        return success(data, total=total)


@router.get("/summary", summary="结算汇总")
def settlement_summary(user_uuid: str = Depends(require_login)):
    with get_session() as db:
        from app.models.agent_settlement import AgentSettlement

        total = db.query(func.count(AgentSettlement.id)).filter(AgentSettlement.uuid == user_uuid).scalar() or 0
        settled = (
            db.query(func.count(AgentSettlement.id))
            .filter(AgentSettlement.uuid == user_uuid, AgentSettlement.settlement == "1")
            .scalar()
            or 0
        )
        return success(
            {
                "total_settlements": total,
                "settled_count": settled,
                "unsettled_count": total - settled,
            }
        )


@router.post("/settle", summary="触发单条结算")
def trigger_settle(
    settlement_id: str = Query(...),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        try:
            from app.models.agent_settlement import AgentSettlement

            record = (
                db.query(AgentSettlement)
                .filter(
                    AgentSettlement.id == settlement_id,
                    AgentSettlement.uuid == user_uuid,
                )
                .first()
            )
            if not record:
                return error("结算记录不存在")
            if record.settlement == "1":
                return error("已结算,无需重复操作")
            record.settlement = "1"
            db.commit()
            return success({"id": settlement_id, "settlement": "1"})
        except Exception as e:
            logger.error(f"Settle error: {e}")
            return error(str(e))


@router.get("/unsettled", summary="查询未结算记录")
def list_unsettled(user_uuid: str = Depends(require_login)):
    with get_session() as db:
        from app.models.agent_settlement import AgentSettlement

        items = (
            db.query(AgentSettlement)
            .filter(
                AgentSettlement.uuid == user_uuid,
                AgentSettlement.settlement == "0",
            )
            .order_by(AgentSettlement.expiration_date.asc())
            .all()
        )
        data = [
            {
                "id": s.id,
                "order_no": s.order_no,
                "agent_id": s.agent_id,
                "agent_name": s.agent_name,
                "expiration_date": s.expiration_date.isoformat() if s.expiration_date else None,
            }
            for s in items
        ]
        return success(data, total=len(data))
