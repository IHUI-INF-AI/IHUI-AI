"""Agent 规则 / 需求任务路由(ORM 版)."""

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from loguru import logger

from app.database import get_session
from app.models.agent_rule_models import AgentNeedTask, AgentRule
from app.schemas.common import error, success
from app.security import require_login

router = APIRouter()


@router.get("/list", summary="规则列表(按 agent_id 过滤)")
def list_rules(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    agent_id: str = Query(None),
    status: int = Query(None, description="0 禁用 1 启用"),
):
    with get_session() as db:
        q = db.query(AgentRule)
        if agent_id:
            q = q.filter(AgentRule.agent_id == agent_id)
        if status is not None:
            q = q.filter(AgentRule.status == status)
        total = q.count()
        items = q.order_by(AgentRule.id.desc()).offset((page - 1) * limit).limit(limit).all()
        data = [
            {
                "id": r.id,
                "agent_id": r.agent_id,
                "rule_name": r.rule_name,
                "rule_type": r.rule_type,
                "priority": r.priority,
                "status": r.status,
                "description": r.description,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in items
        ]
        return success(data, total=total)


@router.post("/create", summary="创建规则")
def create_rule(
    agent_id: str = Query(...),
    rule_name: str = Query(...),
    rule_code: str = Query(...),
    rule_type: str = Query("text"),
    priority: int = Query(0),
    description: str = Query(""),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        try:
            rule = AgentRule(
                agent_id=agent_id,
                rule_name=rule_name,
                rule_code=rule_code,
                rule_type=rule_type,
                priority=priority,
                status=1,
                description=description,
            )
            db.add(rule)
            db.commit()
            return success({"id": rule.id, "agent_id": agent_id, "rule_name": rule_name})
        except Exception as e:
            logger.error(f"Create rule error: {e}")
            return error(str(e))


@router.post("/toggle", summary="启用/禁用规则")
def toggle_rule(
    rule_id: int = Query(...),
    status: int = Query(..., description="0 禁用 1 启用"),
):
    with get_session() as db:
        rule = db.query(AgentRule).filter(AgentRule.id == rule_id).first()
        if not rule:
            return error("规则不存在")
        rule.status = status
        db.commit()
        return success({"id": rule_id, "status": status})


@router.get("/search", summary="按关键字搜索规则")
def search_rules(
    agent_id: str = Query(...),
    keyword: str = Query(""),
):
    with get_session() as db:
        q = db.query(AgentRule).filter(AgentRule.agent_id == agent_id)
        if keyword:
            like = f"%{keyword}%"
            q = q.filter((AgentRule.rule_name.like(like)) | (AgentRule.rule_code.like(like)))
        items = q.order_by(AgentRule.priority.desc()).limit(50).all()
        data = [{"id": r.id, "rule_name": r.rule_name, "rule_code": r.rule_code, "priority": r.priority} for r in items]
        return success(data, total=len(data))


@router.get("/need-task/list", summary="需求任务列表")
def list_need_tasks(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: int = Query(None),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        q = db.query(AgentNeedTask).filter(AgentNeedTask.user_id == user_uuid)
        if status is not None:
            q = q.filter(AgentNeedTask.status == status)
        total = q.count()
        items = q.order_by(AgentNeedTask.id.desc()).offset((page - 1) * limit).limit(limit).all()
        data = [
            {
                "id": t.id,
                "task_name": t.task_name,
                "task_desc": t.task_desc,
                "reward_tokens": t.reward_tokens,
                "status": t.status,
                "agent_id": t.agent_id,
                "accept_user_id": t.accept_user_id,
                "deadline": t.deadline.isoformat() if t.deadline else None,
            }
            for t in items
        ]
        return success(data, total=total)


@router.post("/need-task/create", summary="创建需求任务")
def create_need_task(
    task_name: str = Query(...),
    task_desc: str = Query(""),
    agent_id: str = Query(""),
    reward_tokens: int = Query(0),
    deadline: str = Query(None, description="ISO 时间字符串"),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        try:
            dl = None
            if deadline:
                try:
                    dl = datetime.fromisoformat(deadline)
                except ValueError:
                    return error("deadline 格式错误,应为 ISO 时间字符串")
            task = AgentNeedTask(
                user_id=user_uuid,
                agent_id=agent_id,
                task_name=task_name,
                task_desc=task_desc,
                reward_tokens=reward_tokens,
                status=0,
                deadline=dl,
            )
            db.add(task)
            db.commit()
            return success({"id": task.id, "task_name": task_name})
        except Exception as e:
            logger.error(f"Create need task error: {e}")
            return error(str(e))


@router.post("/need-task/accept", summary="接单需求任务")
def accept_need_task(
    task_id: int = Query(...),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        try:
            task = db.query(AgentNeedTask).filter(AgentNeedTask.id == task_id).first()
            if not task:
                return error("需求不存在")
            if task.status != 0:
                return error("需求已被接或已结束")
            task.accept_user_id = user_uuid
            task.status = 1
            db.commit()
            return success({"id": task_id, "accept_user_id": user_uuid, "status": 1})
        except Exception as e:
            logger.error(f"Accept need task error: {e}")
            return error(str(e))


@router.post("/need-task/complete", summary="完成需求任务")
def complete_need_task(
    task_id: int = Query(...),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        try:
            task = db.query(AgentNeedTask).filter(AgentNeedTask.id == task_id).first()
            if not task:
                return error("需求不存在")
            if task.user_id != user_uuid:
                return error("只有发起人可以确认完成")
            if task.status != 1:
                return error("任务未在进行中")
            task.status = 2
            db.commit()
            if task.accept_user_id and task.reward_tokens > 0:
                from app.services.token_service import grant_commission

                grant_commission(
                    task.accept_user_id,
                    task.reward_tokens,
                    invited_user_id=task.user_id,
                    source=f"need_task:{task_id}",
                )
            return success({"id": task_id, "status": 2})
        except Exception as e:
            logger.error(f"Complete need task error: {e}")
            return error(str(e))
