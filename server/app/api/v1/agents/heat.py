"""Agent 热度统计路由."""

from datetime import date, timedelta

from fastapi import APIRouter, Query
from loguru import logger
from sqlalchemy import func

from app.database import get_session
from app.schemas.common import error, success

router = APIRouter()


@router.get("/agent/{agent_id}", summary="查询 Agent 热度(按日聚合)")
def agent_heat(agent_id: str, days: int = Query(7, ge=1, le=30)):
    with get_session() as db:
        try:
            from app.models.agent_models import AgentHeatStats

            items = (
                db.query(AgentHeatStats)
                .filter(
                    AgentHeatStats.agent_id == agent_id,
                )
                .order_by(AgentHeatStats.date_str.desc())
                .limit(days)
                .all()
            )
            data = [
                {
                    "date": h.date_str,
                    "hit_count": h.hit_count,
                }
                for h in items
            ]
            total_hits = sum(int(h.hit_count or 0) for h in items)
            return success({"agent_id": agent_id, "total_hits": total_hits, "details": data})
        except Exception as e:
            logger.error(f"Agent heat error: {e}")
            return error(str(e))


@router.post("/hit", summary="记录一次 Agent 命中(内部调用)")
def hit(agent_id: str = Query(...)):
    """累加当日 hit_count.无对应行时新建."""
    with get_session() as db:
        try:
            from app.models.agent_models import AgentHeatStats

            today = date.today().isoformat()
            record = (
                db.query(AgentHeatStats)
                .filter(
                    AgentHeatStats.agent_id == agent_id,
                    AgentHeatStats.date_str == today,
                )
                .first()
            )
            if record:
                record.hit_count = (record.hit_count or 0) + 1
            else:
                record = AgentHeatStats(agent_id=agent_id, date_str=today, hit_count=1)
                db.add(record)
            db.commit()
            return success({"agent_id": agent_id, "date": today, "hit_count": record.hit_count})
        except Exception as e:
            logger.error(f"Heat hit error: {e}")
            return error(str(e))


@router.get("/top", summary="热度 TOP 榜")
def top_agents(days: int = Query(7, ge=1, le=30), limit: int = Query(20, ge=1, le=100)):
    with get_session() as db:
        try:
            from app.models.agent_models import AgentHeatStats

            cutoff = (date.today() - timedelta(days=days)).isoformat()
            rows = (
                db.query(
                    AgentHeatStats.agent_id,
                    func.sum(AgentHeatStats.hit_count).label("total_hits"),
                )
                .filter(AgentHeatStats.date_str >= cutoff)
                .group_by(AgentHeatStats.agent_id)
                .order_by(func.sum(AgentHeatStats.hit_count).desc())
                .limit(limit)
                .all()
            )
            data = [{"agent_id": r[0], "total_hits": int(r[1] or 0)} for r in rows]
            return success(data, total=len(data))
        except Exception as e:
            logger.error(f"Top agents error: {e}")
            return error(str(e))
