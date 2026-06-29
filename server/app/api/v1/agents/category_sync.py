"""分类数据同步 API.

迁移自 coze_zhs_py/api/category_sync_api.py.
"""

from fastapi import APIRouter, Depends
from loguru import logger
from sqlalchemy.orm import Session

from app.database import get_session
from app.utils.category_sync_tool import get_category_sync_tool

router = APIRouter(prefix="/cozeZhsApi/sync/category", tags=["分类数据同步"])


@router.get("/status", summary="检查同步状态")
async def check_sync_status(db: Session = Depends(get_session)):
    try:
        sync_tool = get_category_sync_tool()
        return {"success": True, "data": sync_tool.check_sync_status(db), "message": "获取同步状态成功"}
    except Exception as e:
        logger.error(f"获取同步状态失败: {e}")
        return {"success": False, "data": {}, "message": f"获取失败: {e}"}


@router.post("/all", summary="同步所有分类数据")
async def sync_all_categories(db: Session = Depends(get_session)):
    try:
        sync_tool = get_category_sync_tool()
        return {"success": True, "data": sync_tool.sync_all_categories(db), "message": "同步完成"}
    except Exception as e:
        logger.error(f"同步分类数据失败: {e}")
        return {"success": False, "data": {}, "message": f"同步失败: {e}"}
