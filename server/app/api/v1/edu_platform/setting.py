"""设置模块路由 - 迁移自旧 Java Spring Boot setting-service (2026-07-05).

包含: 轮播图管理/协议管理.
"""
from fastapi import APIRouter, Body, Query
from loguru import logger

from app.database import get_session
from app.models.edu_platform_models import EduAgreement, EduCarousel
from app.schemas.common import error, success

router = APIRouter()


# ---------------------------------------------------------------------------
# 轮播图
# ---------------------------------------------------------------------------


def _carousel_to_dict(c: EduCarousel) -> dict:
    return {
        "id": c.id,
        "title": c.title,
        "image": c.image,
        "link": c.link,
        "sort": c.sort,
        "status": c.status,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


@router.get("/public-api/carousel", summary="获取轮播图(公开)")
async def get_carousel(status: int | None = Query(None, description="状态筛选")):
    with get_session() as db:
        try:
            q = db.query(EduCarousel)
            if status is not None:
                q = q.filter(EduCarousel.status == status)
            else:
                q = q.filter(EduCarousel.status == 1)
            items = q.order_by(EduCarousel.sort.asc(), EduCarousel.id.desc()).all()
            return success([_carousel_to_dict(c) for c in items])
        except Exception as e:
            logger.error(f"[edu setting] get carousel error: {e}")
            return error(str(e))


@router.post("/carousel", summary="保存轮播图")
async def save_carousel(
    image: str = Body(..., max_length=500, description="图片地址"),
    title: str | None = Body(None, max_length=200),
    link: str | None = Body(None, max_length=500),
    sort: int = Body(0),
    status: int = Body(1),
    id: int | None = Body(None, description="传入则更新, 不传则新增"),
):
    with get_session() as db:
        try:
            if id:
                c = db.query(EduCarousel).filter(EduCarousel.id == id).first()
                if not c:
                    return error("轮播图不存在", "404")
                c.image = image
                if title is not None:
                    c.title = title
                if link is not None:
                    c.link = link
                c.sort = sort
                c.status = status
                return success({"id": c.id})
            else:
                c = EduCarousel(
                    image=image, title=title, link=link, sort=sort, status=status
                )
                db.add(c)
                db.flush()
                return success({"id": c.id})
        except Exception as e:
            logger.error(f"[edu setting] save carousel error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 协议
# ---------------------------------------------------------------------------


def _agreement_to_dict(a: EduAgreement) -> dict:
    return {
        "id": a.id,
        "title": a.title,
        "content": a.content,
        "type": a.type,
        "status": a.status,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "updated_at": a.updated_at.isoformat() if a.updated_at else None,
    }


@router.get("/public-api/agreement", summary="获取协议(公开)")
async def get_agreement(type: str = Query("user", description="user/privacy")):
    with get_session() as db:
        try:
            a = (
                db.query(EduAgreement)
                .filter(EduAgreement.type == type, EduAgreement.status == 1)
                .order_by(EduAgreement.id.desc())
                .first()
            )
            if not a:
                return success(None)
            return success(_agreement_to_dict(a))
        except Exception as e:
            logger.error(f"[edu setting] get agreement error: {e}")
            return error(str(e))


@router.post("/agreement", summary="保存协议")
async def save_agreement(
    title: str = Body(..., min_length=1, max_length=200),
    content: str | None = Body(None),
    type: str = Body("user"),
    status: int = Body(1),
    id: int | None = Body(None, description="传入则更新"),
):
    with get_session() as db:
        try:
            if id:
                a = db.query(EduAgreement).filter(EduAgreement.id == id).first()
                if not a:
                    return error("协议不存在", "404")
                a.title = title
                a.content = content
                a.type = type
                a.status = status
                return success({"id": a.id})
            else:
                a = EduAgreement(title=title, content=content, type=type, status=status)
                db.add(a)
                db.flush()
                return success({"id": a.id})
        except Exception as e:
            logger.error(f"[edu setting] save agreement error: {e}")
            return error(str(e))


@router.put("/agreement", summary="更新协议")
async def update_agreement(
    id: int = Body(...),
    title: str | None = Body(None),
    content: str | None = Body(None),
    type: str | None = Body(None),
    status: int | None = Body(None),
):
    with get_session() as db:
        try:
            a = db.query(EduAgreement).filter(EduAgreement.id == id).first()
            if not a:
                return error("协议不存在", "404")
            if title is not None:
                a.title = title
            if content is not None:
                a.content = content
            if type is not None:
                a.type = type
            if status is not None:
                a.status = status
            return success({"id": a.id})
        except Exception as e:
            logger.error(f"[edu setting] update agreement error: {e}")
            return error(str(e))


@router.get("/agreement/page", summary="协议分页列表")
async def agreement_page(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    type: str | None = None,
    title: str | None = None,
):
    with get_session() as db:
        try:
            q = db.query(EduAgreement)
            if type:
                q = q.filter(EduAgreement.type == type)
            if title:
                q = q.filter(EduAgreement.title.like(f"%{title}%"))
            total = q.count()
            items = q.order_by(EduAgreement.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success(
                [_agreement_to_dict(a) for a in items], total=total, page=page, page_size=limit
            )
        except Exception as e:
            logger.error(f"[edu setting] agreement page error: {e}")
            return error(str(e))
