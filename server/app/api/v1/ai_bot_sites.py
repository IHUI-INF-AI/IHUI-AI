"""AI 工具站点查询 API.

迁移自 ZHS_Server_java/small/controller/AiBotSitesController.java
和 small/service/AiBotSitesServlet.java + impl.
"""

from fastapi import APIRouter, Depends, Query
from loguru import logger
from sqlalchemy.orm import Session

from app.dependencies import get_ai_db_session
from app.models.java_missing_models import AiBotSites
from app.schemas.common import success

router = APIRouter(prefix="/ai-bot-sites", tags=["AI 工具站点"])


@router.get("/list", summary="AI 工具站点列表")
async def list_sites(
    section: str | None = Query(None, description="一级分类筛选"),
    keyword: str | None = Query(None, description="关键字搜索"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_ai_db_session),
):
    """查询 AI 工具站点列表(已迁移核心数据模型)."""
    try:
        q = db.query(AiBotSites)
        if section:
            q = q.filter(AiBotSites.section == section)
        if keyword:
            like = f"%{keyword}%"
            q = q.filter((AiBotSites.name.like(like)) | (AiBotSites.short_desc.like(like)))
        total = q.count()
        items = q.order_by(AiBotSites.id.asc()).offset((page - 1) * page_size).limit(page_size).all()
        return {
            **success(data=[item.to_dict() for item in items]),
            "pagination": {"total": total, "page": page, "page_size": page_size},
        }
    except Exception as e:
        logger.error(f"查询 AI 工具站点失败: {e}")
        return {"code": "500000", "msg": str(e), "data": []}


@router.get("/categories", summary="AI 工具站点分类")
async def list_categories(db: Session = Depends(get_ai_db_session)):
    """获取所有分类."""
    try:
        rows = db.query(AiBotSites.section).filter(AiBotSites.section.isnot(None)).distinct().all()
        return success(data=sorted([r[0] for r in rows if r[0]]))
    except Exception as e:
        logger.error(f"查询分类失败: {e}")
        return {"code": "500000", "msg": str(e), "data": []}
