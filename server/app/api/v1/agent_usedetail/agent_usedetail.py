"""代理商使用明细"""

from datetime import date

from fastapi import APIRouter, Query
from loguru import logger
from sqlalchemy import BigInteger, Column, Float, Index, Integer, String

from app.database import Base, get_session
from app.models.base import TimestampMixin
from app.schemas.common import error, success


class AgentUsedetail(TimestampMixin, Base):
    """代理商使用明细"""

    __tablename__ = "zhs_agent_usedetail"
    __table_args__ = (
        Index("idx_aud_agent", "agent_id"),
        Index("idx_aud_user", "user_id"),
        Index("idx_aud_time", "created_at"),
        {"extend_existing": True},
    )
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    agent_id = Column(String(64), nullable=False, comment="代理商ID")
    agent_name = Column(String(200), nullable=True)
    user_id = Column(String(64), nullable=False, comment="使用用户")
    user_name = Column(String(100), nullable=True)
    type = Column(String(20), nullable=False, comment="consume/api/call/token/storage")
    model = Column(String(50), nullable=True, comment="使用模型")
    tokens = Column(Integer, default=0, comment="Token数")
    amount = Column(Float, default=0, comment="金额")
    cost = Column(Float, default=0, comment="成本")
    profit = Column(Float, default=0, comment="利润")
    request_id = Column(String(64), nullable=True, comment="请求ID")
    status = Column(Integer, default=1, comment="0=失败 1=成功")
    remark = Column(String(500), nullable=True)


class AgentStatDaily(TimestampMixin, Base):
    """代理商日统计"""

    __tablename__ = "zhs_agent_stat_daily"
    __table_args__ = (
        Index("idx_asd_agent", "agent_id"),
        Index("idx_asd_date", "stat_date"),
    )
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    agent_id = Column(String(64), nullable=False)
    stat_date = Column(String(20), nullable=False, comment="YYYY-MM-DD")
    user_count = Column(Integer, default=0, comment="使用用户数")
    request_count = Column(Integer, default=0, comment="请求次数")
    tokens = Column(BigInteger, default=0, comment="总Token")
    amount = Column(Float, default=0, comment="总金额")
    cost = Column(Float, default=0, comment="总成本")
    profit = Column(Float, default=0, comment="总利润")


router = APIRouter()


@router.post("/record", summary="记录使用")
async def record_usage(
    agent_id: str = Query(...),
    user_id: str = Query(...),
    type: str = "consume",
    model: str | None = None,
    tokens: int = 0,
    amount: float = 0,
    cost: float = 0,
    request_id: str | None = None,
    status: int = 1,
    remark: str | None = None,
):
    with get_session() as db:
        try:
            d = AgentUsedetail(
                agent_id=agent_id,
                agent_name="",
                user_id=user_id,
                user_name="",
                type=type,
                model=model,
                tokens=tokens,
                amount=amount,
                cost=cost,
                profit=amount - cost,
                request_id=request_id,
                status=status,
                remark=remark,
            )
            db.add(d)
            db.flush()
            today = date.today().isoformat()
            s = (
                db.query(AgentStatDaily)
                .filter(
                    AgentStatDaily.agent_id == agent_id,
                    AgentStatDaily.stat_date == today,
                )
                .first()
            )
            if s:
                s.request_count = (s.request_count or 0) + 1
                s.tokens = (s.tokens or 0) + tokens
                s.amount = (s.amount or 0) + amount
                s.cost = (s.cost or 0) + cost
                s.profit = (s.profit or 0) + (amount - cost)
            else:
                db.add(
                    AgentStatDaily(
                        agent_id=agent_id,
                        stat_date=today,
                        request_count=1,
                        tokens=tokens,
                        amount=amount,
                        cost=cost,
                        profit=amount - cost,
                    )
                )
            return success({"id": d.id})
        except Exception as e:
            logger.error(f"agent use record error: {e}")
            return error(str(e))


@router.get("/list", summary="使用明细")
async def list_details(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    agent_id: str | None = None,
    user_id: str | None = None,
    type: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
):
    with get_session() as db:
        try:
            q = db.query(AgentUsedetail)
            if agent_id:
                q = q.filter(AgentUsedetail.agent_id == agent_id)
            if user_id:
                q = q.filter(AgentUsedetail.user_id == user_id)
            if type:
                q = q.filter(AgentUsedetail.type == type)
            if start_date:
                q = q.filter(AgentUsedetail.created_at >= start_date)
            if end_date:
                q = q.filter(AgentUsedetail.created_at <= end_date + " 23:59:59")
            total = q.count()
            items = q.order_by(AgentUsedetail.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success(
                [
                    {
                        "id": d.id,
                        "agent_id": d.agent_id,
                        "agent_name": d.agent_name,
                        "user_id": d.user_id,
                        "user_name": d.user_name,
                        "type": d.type,
                        "model": d.model,
                        "tokens": d.tokens,
                        "amount": d.amount,
                        "cost": d.cost,
                        "profit": d.profit,
                        "request_id": d.request_id,
                        "status": d.status,
                        "create_time": d.created_at.isoformat() if d.created_at else None,
                    }
                    for d in items
                ],
                total=total,
            )
        except Exception as e:
            logger.error(f"agent use list error: {e}")
            return error(str(e))


@router.get("/stats/daily", operation_id="agent_usedetail_daily_stats", summary="日统计")
async def daily_stats(agent_id: str | None = None, start_date: str | None = None, end_date: str | None = None):
    with get_session() as db:
        try:
            q = db.query(AgentStatDaily)
            if agent_id:
                q = q.filter(AgentStatDaily.agent_id == agent_id)
            if start_date:
                q = q.filter(AgentStatDaily.stat_date >= start_date)
            if end_date:
                q = q.filter(AgentStatDaily.stat_date <= end_date)
            items = q.order_by(AgentStatDaily.stat_date.asc()).all()
            return success(
                [
                    {
                        "agent_id": s.agent_id,
                        "stat_date": s.stat_date,
                        "user_count": s.user_count,
                        "request_count": s.request_count,
                        "tokens": s.tokens,
                        "amount": s.amount,
                        "cost": s.cost,
                        "profit": s.profit,
                    }
                    for s in items
                ]
            )
        except Exception as e:
            logger.error(f"agent daily stats error: {e}")
            return error(str(e))


@router.get("/stats/summary", summary="汇总统计")
async def summary_stats(
    agent_id: str | None = None, start_date: str | None = None, end_date: str | None = None
):
    with get_session() as db:
        try:
            q = db.query(AgentUsedetail)
            if agent_id:
                q = q.filter(AgentUsedetail.agent_id == agent_id)
            if start_date:
                q = q.filter(AgentUsedetail.created_at >= start_date)
            if end_date:
                q = q.filter(AgentUsedetail.created_at <= end_date + " 23:59:59")
            items = q.all()
            total_amount = sum(d.amount or 0 for d in items)
            total_cost = sum(d.cost or 0 for d in items)
            total_profit = sum(d.profit or 0 for d in items)
            total_tokens = sum(d.tokens or 0 for d in items)
            user_set = {d.user_id for d in items}
            return success(
                {
                    "request_count": len(items),
                    "user_count": len(user_set),
                    "tokens": total_tokens,
                    "amount": total_amount,
                    "cost": total_cost,
                    "profit": total_profit,
                    "agent_id": agent_id,
                }
            )
        except Exception as e:
            logger.error(f"agent summary stats error: {e}")
            return error(str(e))
