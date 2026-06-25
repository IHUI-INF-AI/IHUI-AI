"""LLM 模型统一列表接口 (前端 /ihui-ai-api/llm/models-unify 兼容).

此端点为前端 backend-paths.ts 中 COZE_PATHS.aiModelInfo.list 提供本地实现,
避免开发环境直连生产网关 zca.aizhs.top.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc

from app.database import get_session
from app.models.activity_models import AiModelInfo
from app.schemas.common import success
from app.security import require_login

router = APIRouter()


@router.get("/models-unify", summary="大模型统一列表 (兼容 ihui-ai-api)")
def models_unify(
    name: str = Query(None),
    type: int = Query(None),
    is_del: int = Query(0),
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=500),
    user_uuid: str = Depends(require_login),
):
    """返回前端 AIModelInfo[] 格式,字段映射:
    - id, name, source, description, icon, status, sort
    - 前端别名: modelCode, displayName, img, remark, type, category, manufacturer
    """
    with get_session() as db:
        q = db.query(AiModelInfo)
        # is_del=0 表示只查未删除的 (status=1)
        if is_del == 0:
            q = q.filter(AiModelInfo.status == 1)
        if name:
            q = q.filter(AiModelInfo.name.like(f"%{name}%"))
        if type is not None:
            q = q.filter(AiModelInfo.sort == type)
        total = q.count()
        items = q.order_by(AiModelInfo.sort, desc(AiModelInfo.id)).offset((page - 1) * limit).limit(limit).all()
        data = []
        for m in items:
            data.append(
                {
                    "id": str(m.id),
                    "name": m.name or "",
                    "modelCode": m.name or "",
                    "displayName": m.name or "",
                    "description": m.description or "",
                    "category": "",
                    "source": m.source or "",
                    "img": m.icon or "",
                    "remark": m.description or "",
                    "type": m.sort or 0,
                    "sort": m.sort or 0,
                    "is_del": 0 if m.status == 1 else 1,
                    "manufacturer": m.source or "",
                    "creator": "",
                    "created_at": "",
                    "updated_at": "",
                    "quest_type": "",
                    "variables": "",
                    "is_new": 0,
                    "is_top": 0,
                }
            )
        return success(data, total=total)
