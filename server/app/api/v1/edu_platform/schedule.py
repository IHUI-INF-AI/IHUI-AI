"""调度模块路由 - 迁移自旧 Java Spring Boot schedule-service (2026-07-06).

包含: 定时任务管理(创建/更新/删除/详情/列表/启用/禁用/立即执行) +
任务执行日志(列表/详情).
"""
from datetime import datetime

from fastapi import APIRouter, Body, Query
from loguru import logger

from app.database import get_session
from app.models.edu_platform_models_ext import EduScheduleLog, EduScheduleTask
from app.schemas.common import error, success

router = APIRouter()


# ---------------------------------------------------------------------------
# 定时任务管理
# ---------------------------------------------------------------------------


def _task_to_dict(t: EduScheduleTask) -> dict:
    return {
        "id": t.id,
        "name": t.name,
        "description": t.description,
        "cron_expression": t.cron_expression,
        "target_service": t.target_service,
        "target_method": t.target_method,
        "parameters": t.parameters,
        "priority": t.priority,
        "max_retry_count": t.max_retry_count,
        "timeout": t.timeout,
        "enabled": t.enabled,
        "last_run_time": t.last_run_time.isoformat() if t.last_run_time else None,
        "last_run_status": t.last_run_status,
        "last_run_message": t.last_run_message,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }


@router.post("/auth-api/schedule/task", summary="创建定时任务")
async def create_task(
    name: str = Body(..., min_length=1, max_length=200, description="任务名称"),
    cron_expression: str = Body(..., min_length=1, max_length=100, description="Cron表达式"),
    description: str | None = Body(None, description="任务描述"),
    target_service: str | None = Body(None, max_length=100, description="目标服务"),
    target_method: str | None = Body(None, max_length=100, description="目标方法"),
    parameters: str | None = Body(None, description="任务参数(JSON)"),
    priority: int = Body(5, ge=1, le=10, description="优先级1-10"),
    max_retry_count: int = Body(3, ge=0, description="最大重试次数"),
    timeout: int = Body(3600, ge=1, description="超时时间(秒)"),
    enabled: bool = Body(True, description="是否启用"),
):
    with get_session() as db:
        try:
            t = EduScheduleTask(
                name=name,
                cron_expression=cron_expression,
                description=description,
                target_service=target_service,
                target_method=target_method,
                parameters=parameters,
                priority=priority,
                max_retry_count=max_retry_count,
                timeout=timeout,
                enabled=enabled,
            )
            db.add(t)
            db.flush()
            return success({"id": t.id})
        except Exception as e:
            logger.error(f"[edu schedule] create task error: {e}")
            return error(str(e))


@router.put("/auth-api/schedule/task", summary="更新定时任务")
async def update_task(
    id: int = Body(..., description="任务id"),
    name: str | None = Body(None, max_length=200),
    cron_expression: str | None = Body(None, max_length=100),
    description: str | None = Body(None),
    target_service: str | None = Body(None, max_length=100),
    target_method: str | None = Body(None, max_length=100),
    parameters: str | None = Body(None),
    priority: int | None = Body(None, ge=1, le=10),
    max_retry_count: int | None = Body(None, ge=0),
    timeout: int | None = Body(None, ge=1),
    enabled: bool | None = Body(None),
):
    with get_session() as db:
        try:
            t = db.query(EduScheduleTask).filter(EduScheduleTask.id == id).first()
            if not t:
                return error("任务不存在", "404")
            if name is not None:
                t.name = name
            if cron_expression is not None:
                t.cron_expression = cron_expression
            if description is not None:
                t.description = description
            if target_service is not None:
                t.target_service = target_service
            if target_method is not None:
                t.target_method = target_method
            if parameters is not None:
                t.parameters = parameters
            if priority is not None:
                t.priority = priority
            if max_retry_count is not None:
                t.max_retry_count = max_retry_count
            if timeout is not None:
                t.timeout = timeout
            if enabled is not None:
                t.enabled = enabled
            return success({"id": t.id})
        except Exception as e:
            logger.error(f"[edu schedule] update task error: {e}")
            return error(str(e))


@router.delete("/auth-api/schedule/task", summary="删除定时任务")
async def delete_task(id: int = Query(..., description="任务id")):
    with get_session() as db:
        try:
            t = db.query(EduScheduleTask).filter(EduScheduleTask.id == id).first()
            if not t:
                return error("任务不存在", "404")
            db.delete(t)
            return success()
        except Exception as e:
            logger.error(f"[edu schedule] delete task error: {e}")
            return error(str(e))


@router.get("/auth-api/schedule/task", summary="任务详情")
async def get_task(id: int = Query(..., description="任务id")):
    with get_session() as db:
        try:
            t = db.query(EduScheduleTask).filter(EduScheduleTask.id == id).first()
            if not t:
                return error("任务不存在", "404")
            return success(_task_to_dict(t))
        except Exception as e:
            logger.error(f"[edu schedule] get task error: {e}")
            return error(str(e))


@router.get("/auth-api/schedule/task/list", summary="任务列表")
async def task_list(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    enabled: bool | None = Query(None, description="启用状态筛选"),
    name: str | None = Query(None, description="任务名称模糊搜索"),
):
    with get_session() as db:
        try:
            q = db.query(EduScheduleTask)
            if enabled is not None:
                q = q.filter(EduScheduleTask.enabled == enabled)
            if name:
                q = q.filter(EduScheduleTask.name.like(f"%{name}%"))
            total = q.count()
            items = (
                q.order_by(EduScheduleTask.priority.desc(), EduScheduleTask.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success(
                [_task_to_dict(t) for t in items],
                total=total,
                page=page,
                page_size=limit,
            )
        except Exception as e:
            logger.error(f"[edu schedule] task list error: {e}")
            return error(str(e))


@router.put("/auth-api/schedule/task/enable", summary="启用任务")
async def enable_task(id: int = Query(..., description="任务id")):
    with get_session() as db:
        try:
            t = db.query(EduScheduleTask).filter(EduScheduleTask.id == id).first()
            if not t:
                return error("任务不存在", "404")
            t.enabled = True
            return success({"id": t.id, "enabled": t.enabled})
        except Exception as e:
            logger.error(f"[edu schedule] enable task error: {e}")
            return error(str(e))


@router.put("/auth-api/schedule/task/disable", summary="禁用任务")
async def disable_task(id: int = Query(..., description="任务id")):
    with get_session() as db:
        try:
            t = db.query(EduScheduleTask).filter(EduScheduleTask.id == id).first()
            if not t:
                return error("任务不存在", "404")
            t.enabled = False
            return success({"id": t.id, "enabled": t.enabled})
        except Exception as e:
            logger.error(f"[edu schedule] disable task error: {e}")
            return error(str(e))


@router.put("/auth-api/schedule/task/run", summary="立即执行任务")
async def run_task(id: int = Query(..., description="任务id")):
    """立即触发任务执行, 并写入一条 running 状态的执行日志."""
    with get_session() as db:
        try:
            t = db.query(EduScheduleTask).filter(EduScheduleTask.id == id).first()
            if not t:
                return error("任务不存在", "404")
            now = datetime.utcnow()
            # 更新任务上次执行信息
            t.last_run_time = now
            t.last_run_status = "running"
            t.last_run_message = "手动触发执行"
            # 写入执行日志
            log = EduScheduleLog(
                task_id=t.id,
                task_name=t.name,
                status="running",
                start_time=now,
                message="手动触发执行",
            )
            db.add(log)
            db.flush()
            return success({"id": t.id, "log_id": log.id, "status": "running"})
        except Exception as e:
            logger.error(f"[edu schedule] run task error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 任务执行日志
# ---------------------------------------------------------------------------


def _log_to_dict(l: EduScheduleLog) -> dict:
    return {
        "id": l.id,
        "task_id": l.task_id,
        "task_name": l.task_name,
        "status": l.status,
        "start_time": l.start_time.isoformat() if l.start_time else None,
        "end_time": l.end_time.isoformat() if l.end_time else None,
        "duration": l.duration,
        "message": l.message,
        "retry_count": l.retry_count,
        "created_at": l.created_at.isoformat() if l.created_at else None,
    }


@router.get("/auth-api/schedule/log/list", summary="任务执行日志列表")
async def log_list(
    task_id: int | None = Query(None, description="任务id筛选"),
    status: str | None = Query(None, description="状态筛选: running/success/failed/timeout"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    with get_session() as db:
        try:
            q = db.query(EduScheduleLog)
            if task_id is not None:
                q = q.filter(EduScheduleLog.task_id == task_id)
            if status:
                q = q.filter(EduScheduleLog.status == status)
            total = q.count()
            items = (
                q.order_by(EduScheduleLog.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success(
                [_log_to_dict(l) for l in items],
                total=total,
                page=page,
                page_size=limit,
            )
        except Exception as e:
            logger.error(f"[edu schedule] log list error: {e}")
            return error(str(e))


@router.get("/auth-api/schedule/log", summary="日志详情")
async def get_log(id: int = Query(..., description="日志id")):
    with get_session() as db:
        try:
            l = db.query(EduScheduleLog).filter(EduScheduleLog.id == id).first()
            if not l:
                return error("日志不存在", "404")
            return success(_log_to_dict(l))
        except Exception as e:
            logger.error(f"[edu schedule] get log error: {e}")
            return error(str(e))
