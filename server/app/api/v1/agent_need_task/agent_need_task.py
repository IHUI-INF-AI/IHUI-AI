"""Agent需求任务"""

from datetime import datetime

from fastapi import APIRouter, Query
from loguru import logger
from sqlalchemy import BigInteger, Column, DateTime, Index, Integer, String, Text

from app.core.current_user import current_user_id_or_guest
from app.database import Base, get_session
from app.models.base import TimestampMixin
from app.schemas.common import error, success
from app.utils.datetime_helper import utcnow


class AgentNeedTask(TimestampMixin, Base):
    """Agent需求任务"""

    __tablename__ = "zhs_agent_need_task"
    __table_args__ = (
        Index("idx_ant_user", "user_id"),
        Index("idx_ant_status", "status"),
        {"extend_existing": True},
    )
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(String(64), nullable=False, comment="发布者")
    user_name = Column(String(100), nullable=True)
    agent_id = Column(String(64), nullable=True, comment="关联Agent")
    agent_name = Column(String(200), nullable=True)
    title = Column(String(200), nullable=False, comment="需求标题")
    description = Column(Text, nullable=False, comment="需求描述")
    type = Column(String(20), default="develop", comment="develop/optimize/fix/custom")
    priority = Column(Integer, default=1, comment="1=低 2=中 3=高")
    budget = Column(Integer, default=0, comment="预算(分)")
    deadline = Column(DateTime, nullable=True, comment="截止时间")
    status = Column(Integer, default=0, comment="0=待认领 1=已认领 2=开发中 3=已完成 4=已取消")
    developer_id = Column(String(64), nullable=True, comment="认领开发者")
    developer_name = Column(String(100), nullable=True)
    accept_time = Column(DateTime, nullable=True, comment="认领时间")
    complete_time = Column(DateTime, nullable=True, comment="完成时间")
    deliverable = Column(Text, nullable=True, comment="交付物")
    remark = Column(Text, nullable=True)


class AgentTaskDeveloper(TimestampMixin, Base):
    """任务开发者"""

    __tablename__ = "zhs_agent_task_developer"
    __table_args__ = (
        Index("idx_atd_user", "user_id"),
        Index("idx_atd_task", "task_id"),
    )
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    task_id = Column(BigInteger, nullable=False)
    user_id = Column(String(64), nullable=False, comment="开发者")
    user_name = Column(String(100), nullable=True)
    bid = Column(Integer, default=0, comment="报价(分)")
    remark = Column(Text, nullable=True)
    status = Column(Integer, default=0, comment="0=待选 1=已选 2=已拒绝")


router = APIRouter()


def _uid() -> str:
    return current_user_id_or_guest()

@router.post("", summary="发布需求")
async def create_task(
    title: str = Query(..., min_length=1, max_length=200),
    description: str = Query(..., min_length=1),
    type: str = "develop",
    agent_id: str | None = None,
    agent_name: str | None = None,
    priority: int = 1,
    budget: int = 0,
    deadline: datetime | None = None,
):
    with get_session() as db:
        try:
            t = AgentNeedTask(
                user_id=_uid(),
                user_name="匿名用户",
                agent_id=agent_id,
                agent_name=agent_name,
                title=title,
                description=description,
                type=type,
                priority=priority,
                budget=budget,
                deadline=deadline,
                status=0,
            )
            db.add(t)
            db.flush()
            return success({"id": t.id})
        except Exception as e:
            logger.error(f"agent task create error: {e}")
            return error(str(e))


@router.get("/list", summary="需求列表")
async def list_tasks(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: int | None = None,
    type: str | None = None,
    user_id: str | None = None,
    developer_id: str | None = None,
    keyword: str | None = None,
):
    with get_session() as db:
        try:
            q = db.query(AgentNeedTask)
            if status is not None:
                q = q.filter(AgentNeedTask.status == status)
            if type:
                q = q.filter(AgentNeedTask.type == type)
            if user_id:
                q = q.filter(AgentNeedTask.user_id == user_id)
            if developer_id:
                q = q.filter(AgentNeedTask.developer_id == developer_id)
            if keyword:
                q = q.filter(AgentNeedTask.title.like(f"%{keyword}%"))
            total = q.count()
            items = (
                q.order_by(AgentNeedTask.priority.desc(), AgentNeedTask.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success(
                [
                    {
                        "id": t.id,
                        "user_id": t.user_id,
                        "user_name": t.user_name,
                        "agent_id": t.agent_id,
                        "agent_name": t.agent_name,
                        "title": t.title,
                        "description": t.description,
                        "type": t.type,
                        "priority": t.priority,
                        "budget": t.budget,
                        "deadline": t.deadline.isoformat() if t.deadline else None,
                        "status": t.status,
                        "developer_id": t.developer_id,
                        "developer_name": t.developer_name,
                        "accept_time": t.accept_time.isoformat() if t.accept_time else None,
                        "complete_time": t.complete_time.isoformat() if t.complete_time else None,
                        "deliverable": t.deliverable,
                        "create_time": t.created_at.isoformat() if t.created_at else None,
                    }
                    for t in items
                ],
                total=total,
            )
        except Exception as e:
            logger.error(f"agent task list error: {e}")
            return error(str(e))


@router.get("/{tid}", summary="需求详情")
async def get_task(tid: int):
    with get_session() as db:
        try:
            t = db.query(AgentNeedTask).filter(AgentNeedTask.id == tid).first()
            if not t:
                return error("需求不存在", "404")
            return success(
                {
                    "id": t.id,
                    "user_id": t.user_id,
                    "user_name": t.user_name,
                    "agent_id": t.agent_id,
                    "agent_name": t.agent_name,
                    "title": t.title,
                    "description": t.description,
                    "type": t.type,
                    "priority": t.priority,
                    "budget": t.budget,
                    "deadline": t.deadline.isoformat() if t.deadline else None,
                    "status": t.status,
                    "developer_id": t.developer_id,
                    "developer_name": t.developer_name,
                    "deliverable": t.deliverable,
                    "remark": t.remark,
                }
            )
        except Exception as e:
            logger.error(f"agent task get error: {e}")
            return error(str(e))


@router.put("/{tid}", summary="修改需求")
async def update_task(
    tid: int,
    title: str | None = None,
    description: str | None = None,
    priority: int | None = None,
    budget: int | None = None,
    status: int | None = None,
    deliverable: str | None = None,
    remark: str | None = None,
):
    with get_session() as db:
        try:
            t = db.query(AgentNeedTask).filter(AgentNeedTask.id == tid).first()
            if not t:
                return error("需求不存在", "404")
            if title:
                t.title = title
            if description:
                t.description = description
            if priority is not None:
                t.priority = priority
            if budget is not None:
                t.budget = budget
            if status is not None:
                t.status = status
            if deliverable:
                t.deliverable = deliverable
            if remark:
                t.remark = remark
            if status == 3 and not t.complete_time:
                t.complete_time = utcnow()
            return success()
        except Exception as e:
            logger.error(f"agent task update error: {e}")
            return error(str(e))


@router.delete("/{tid}", summary="删除需求")
async def delete_task(tid: int):
    with get_session() as db:
        try:
            t = db.query(AgentNeedTask).filter(AgentNeedTask.id == tid).first()
            if not t:
                return error("需求不存在", "404")
            db.delete(t)
            db.query(AgentTaskDeveloper).filter(AgentTaskDeveloper.task_id == tid).delete()
            return success()
        except Exception as e:
            logger.error(f"agent task delete error: {e}")
            return error(str(e))


@router.post("/{tid}/accept", summary="开发者认领")
async def accept_task(tid: int):
    with get_session() as db:
        try:
            t = db.query(AgentNeedTask).filter(AgentNeedTask.id == tid).first()
            if not t:
                return error("需求不存在", "404")
            if t.status not in (0, 1):
                return error("任务已被认领或不在可认领状态", "400")
            t.developer_id = _uid()
            t.developer_name = "匿名用户"
            t.status = 1
            t.accept_time = utcnow()
            return success()
        except Exception as e:
            logger.error(f"agent task accept error: {e}")
            return error(str(e))


@router.post("/{tid}/bid", summary="开发者报价")
async def bid_task(tid: int, bid: int = Query(..., ge=0), remark: str | None = None):
    with get_session() as db:
        try:
            t = db.query(AgentNeedTask).filter(AgentNeedTask.id == tid).first()
            if not t:
                return error("需求不存在", "404")
            uid = _uid()
            exist = (
                db.query(AgentTaskDeveloper)
                .filter(AgentTaskDeveloper.task_id == tid, AgentTaskDeveloper.user_id == uid)
                .first()
            )
            if exist:
                exist.bid = bid
                exist.remark = remark
            else:
                db.add(
                    AgentTaskDeveloper(
                        task_id=tid,
                        user_id=uid,
                        user_name="匿名用户",
                        bid=bid,
                        remark=remark,
                        status=0,
                    )
                )
            return success()
        except Exception as e:
            logger.error(f"agent task bid error: {e}")
            return error(str(e))


@router.get("/{tid}/bids", summary="任务报价列表")
async def list_bids(tid: int):
    with get_session() as db:
        try:
            items = db.query(AgentTaskDeveloper).filter(AgentTaskDeveloper.task_id == tid).all()
            return success(
                [
                    {
                        "id": b.id,
                        "user_id": b.user_id,
                        "user_name": b.user_name,
                        "bid": b.bid,
                        "remark": b.remark,
                        "status": b.status,
                    }
                    for b in items
                ]
            )
        except Exception as e:
            logger.error(f"agent task bids error: {e}")
            return error(str(e))
