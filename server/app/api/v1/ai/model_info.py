"""AI 厂商模型管理 (zhs_ai_model_info)."""

from fastapi import APIRouter, Depends, Query
from loguru import logger
from sqlalchemy import desc

from app.database import get_session
from app.models.activity_models import AiModelInfo
from app.schemas.common import error, success
from app.security import require_login

router = APIRouter()


@router.get("/list", summary="AI 模型列表")
def list_models(
    source: str = Query(None),
    status: int = Query(1),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        try:
            q = db.query(AiModelInfo).filter(AiModelInfo.status == status)
            if source:
                q = q.filter(AiModelInfo.source == source)
            total = q.count()
            items = q.order_by(AiModelInfo.sort, desc(AiModelInfo.id)).offset((page - 1) * limit).limit(limit).all()
            data = [
                {
                    "id": m.id,
                    "vendor": m.source,
                    "model_name": m.name,
                    "display_name": m.name,
                    "description": m.description,
                    "icon": m.icon,
                    "status": m.status,
                }
                for m in items
            ]
            return success(data, total=total)
        except Exception as e:
            logger.error(f"List models error: {e}")
            return error(str(e))


@router.post("/create", summary="新增模型")
def create_model(
    vendor: str = Query(...),
    model_name: str = Query(...),
    description: str = Query(""),
    icon: str = Query(""),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        try:
            m = AiModelInfo(
                source=vendor,
                name=model_name,
                description=description,
                icon=icon,
            )
            db.add(m)
            db.commit()
            return success({"id": m.id, "model_name": model_name})
        except Exception as e:
            return error(str(e))


@router.post("/update", summary="更新模型")
def update_model(
    model_id: int = Query(...),
    display_name: str = Query(None),
    status: int = Query(None),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        try:
            m = db.query(AiModelInfo).filter(AiModelInfo.id == model_id).first()
            if not m:
                return error("模型不存在")
            if display_name is not None:
                m.name = display_name
            if status is not None:
                m.status = status
            db.commit()
            return success({"id": model_id})
        except Exception as e:
            return error(str(e))


@router.delete("/{model_id}", summary="删除AI模型")
def delete_model(
    model_id: int,
    user_uuid: str = Depends(require_login),
):
    """逻辑删除:将 status 置为 0."""
    with get_session() as db:
        try:
            m = db.query(AiModelInfo).filter(AiModelInfo.id == model_id).first()
            if not m:
                return error("模型不存在")
            if m.status == 0:
                return error("模型已删除")
            m.status = 0
            db.commit()
            return success({"id": model_id})
        except Exception as e:
            logger.error(f"删除模型失败: {e}")
            return error(str(e))


@router.get("/vendors", summary="支持的厂商统计")
def vendor_stats(user_uuid: str = Depends(require_login)):
    with get_session() as db:
        try:
            rows = (
                db.query(AiModelInfo.source)
                .filter(
                    AiModelInfo.status == 1,
                )
                .all()
            )
            stats = {}
            for (s,) in rows:
                if s:
                    stats[s] = stats.get(s, 0) + 1
            return success(stats)
        except Exception as e:
            logger.error(f"Vendor stats error: {e}")
            return error(str(e))


# ========== 兼容端点 (前端 /cozeZhsApi/ai-model-info/* → 此处) ==========
# 前端字段名: name, source, img, remark, type
# 后端字段名: vendor(=source), model_name(=name), description(=remark), icon(=img)


@router.post("/compat/create", summary="[兼容] 新增模型 (前端 aiModelInfo.add)")
def compat_create_model(
    name: str = Query(...),
    source: str = Query(""),
    img: str = Query(""),
    remark: str = Query(""),
    type: int = Query(None),
    creator: str = Query(""),
    user_uuid: str = Depends(require_login),
):
    import time

    # 重试机制: SQLite 写锁可能短暂冲突
    for attempt in range(3):
        with get_session() as db:
            try:
                new_id = int(time.time() * 1000) + attempt
                m = AiModelInfo(
                    id=new_id,
                    source=source,
                    name=name,
                    description=remark,
                    icon=img,
                    status=1,
                    sort=type or 0,
                )
                db.add(m)
                db.commit()
                return success({"id": new_id, "model_name": name})
            except Exception as e:
                if "locked" in str(e).lower() and attempt < 2:
                    time.sleep(0.5 * (attempt + 1))
                    continue
                return error(str(e))
    return error("数据库写入失败 (重试耗尽)")


@router.post("/compat/update", summary="[兼容] 更新模型 (前端 aiModelInfo.update)")
def compat_update_model(
    id: str = Query(...),
    name: str = Query(None),
    source: str = Query(None),
    img: str = Query(None),
    remark: str = Query(None),
    type: int = Query(None),
    is_del: int = Query(None),
    updator: str = Query(""),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        try:
            model_id = int(id)
            m = db.query(AiModelInfo).filter(AiModelInfo.id == model_id).first()
            if not m:
                return error("模型不存在")
            if name is not None:
                m.name = name
            if source is not None:
                m.source = source
            if img is not None:
                m.icon = img
            if remark is not None:
                m.description = remark
            if type is not None:
                m.sort = type
            if is_del is not None:
                m.status = 0 if is_del else 1
            db.commit()
            return success({"id": model_id})
        except Exception as e:
            return error(str(e))


@router.get("/compat/delete", summary="[兼容] 删除模型 (前端 aiModelInfo.delete)")
def compat_delete_model(
    id: str = Query(...),
    updator: str = Query(""),
    user_uuid: str = Depends(require_login),
):
    """逻辑删除:将 status 置为 0.前端用 GET + query params,此处兼容."""
    import time

    for attempt in range(3):
        with get_session() as db:
            try:
                model_id = int(id)
                m = db.query(AiModelInfo).filter(AiModelInfo.id == model_id).first()
                if not m:
                    return error("模型不存在")
                if m.status == 0:
                    return error("模型已删除")
                m.status = 0
                db.commit()
                return success({"id": model_id})
            except Exception as e:
                if "locked" in str(e).lower() and attempt < 2:
                    time.sleep(0.5 * (attempt + 1))
                    continue
                logger.error(f"删除模型失败: {e}")
                return error(str(e))
    return error("数据库写入失败 (重试耗尽)")
