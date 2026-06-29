"""Video generation task routes."""

from fastapi import APIRouter, Depends, Query

from app.database import get_session
from app.schemas.common import error, success
from app.security import require_login

router = APIRouter()


@router.get("/list", summary="视频任务列表")
async def list_video_tasks(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: str = Query(None, description="任务状态过滤: accepted / processing / completed / failed"),
    user_uuid: str = Depends(require_login),
):
    from app.models.token_models import VideoGenerationTask

    with get_session() as db:
        q = db.query(VideoGenerationTask).filter(VideoGenerationTask.user_uuid == user_uuid)
        if status:
            q = q.filter(VideoGenerationTask.status == status)
        total = q.count()
        items = q.order_by(VideoGenerationTask.id.desc()).offset((page - 1) * limit).limit(limit).all()
        data = [
            {
                "id": t.id,
                "task_id": t.task_id,
                "status": t.status,
                "message": t.message,
                "chat_id": t.chat_id,
                "created_at": t.created_at.isoformat() if t.created_at else None,
                "updated_at": t.updated_at.isoformat() if t.updated_at else None,
            }
            for t in items
        ]
        return success(data, total=total)


@router.get("/{task_id}", summary="任务详情")
async def get_video_task(
    task_id: str,
    user_uuid: str = Depends(require_login),
):
    from app.models.token_models import VideoGenerationTask

    with get_session() as db:
        t = (
            db.query(VideoGenerationTask)
            .filter(
                VideoGenerationTask.task_id == task_id,
                VideoGenerationTask.user_uuid == user_uuid,
            )
            .first()
        )
        if not t:
            return error("Task not found", "404")
        data = {
            "id": t.id,
            "task_id": t.task_id,
            "user_uuid": t.user_uuid,
            "status": t.status,
            "message": t.message,
            "result": t.result,
            "chat_id": t.chat_id,
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "updated_at": t.updated_at.isoformat() if t.updated_at else None,
        }
        return success(data)
