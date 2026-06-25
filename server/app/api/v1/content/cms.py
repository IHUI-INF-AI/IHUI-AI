"""Content CMS module: banner, news, notice, popular.

Security: All create/update/delete operations require admin role.
Read operations are public (with optional auth for personalized content).
"""


from fastapi import APIRouter, Depends, Query
from loguru import logger
from sqlalchemy import desc

from app.database import get_session
from app.models.app_content_models import AiNews, BannerCarousel
from app.models.sys_models import SysNotice
from app.schemas.common import error, success
from app.utils.permission_decorator import require_role

router = APIRouter()


# ---------------------------------------------------------------------------
# Banner management
# ---------------------------------------------------------------------------


@router.get("/banner/list", summary="Banner list (public)")
def list_banners(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    status: int = Query(1, description="0=disabled, 1=enabled"),
):
    """Get active banners for homepage carousel."""
    with get_session() as db:
        try:
            q = db.query(BannerCarousel).filter(BannerCarousel.is_active == status)
            total = q.count()
            items = (
                q.order_by(desc(BannerCarousel.sort_order), desc(BannerCarousel.id))
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            data = [
                {
                    "id": b.id,
                    "title": b.title,
                    "image": b.image_url,
                    "url": b.link_url,
                    "sort": b.sort_order,
                    "status": b.is_active,
                }
                for b in items
            ]
            return success(data, total=total)
        except Exception as e:
            logger.error(f"List banner error: {e}")
            return error(str(e))


@router.post("/banner/create", summary="Create banner (admin only)")
def create_banner(
    title: str = Query(..., description="Banner title"),
    image: str = Query(..., description="Banner image URL"),
    url: str = Query("", description="Banner link URL"),
    sort: int = Query(0, description="Sort order"),
    user_uuid: str = Depends(require_role(["admin", "super_admin"])),
):
    """Create a new banner carousel item. Requires admin role."""
    with get_session() as db:
        try:
            banner = BannerCarousel(
                title=title,
                image_url=image,
                link_url=url,
                sort_order=sort,
                is_active=1,
            )
            db.add(banner)
            db.commit()
            db.refresh(banner)
            return success({"id": banner.id, "title": title})
        except Exception as e:
            logger.error(f"Create banner error: {e}")
            return error(f"Failed to create banner: {e}")


@router.put("/banner/update/{banner_id}", summary="Update banner (admin only)")
def update_banner(
    banner_id: int,
    title: str | None = Query(None),
    image: str | None = Query(None),
    url: str | None = Query(None),
    sort: int | None = Query(None),
    is_active: int | None = Query(None),
    user_uuid: str = Depends(require_role(["admin", "super_admin"])),
):
    """Update an existing banner. Requires admin role."""
    with get_session() as db:
        try:
            banner = db.query(BannerCarousel).filter(BannerCarousel.id == banner_id).first()
            if not banner:
                return error("Banner not found", "404")

            if title is not None:
                banner.title = title
            if image is not None:
                banner.image_url = image
            if url is not None:
                banner.link_url = url
            if sort is not None:
                banner.sort_order = sort
            if is_active is not None:
                banner.is_active = is_active

            db.commit()
            return success({"id": banner_id, "updated": True})
        except Exception as e:
            logger.error(f"Update banner error: {e}")
            return error(f"Failed to update banner: {e}")


@router.post("/banner/delete", summary="Delete banner (admin only)")
def delete_banner(
    banner_id: int = Query(..., description="Banner ID to delete"),
    user_uuid: str = Depends(require_role(["admin", "super_admin"])),
):
    """Delete a banner. Requires admin role."""
    with get_session() as db:
        try:
            banner = db.query(BannerCarousel).filter(BannerCarousel.id == banner_id).first()
            if not banner:
                return error("Banner not found", "404")

            db.delete(banner)
            db.commit()
            return success({"id": banner_id, "deleted": True})
        except Exception as e:
            logger.error(f"Delete banner error: {e}")
            return error(f"Failed to delete banner: {e}" "")


# ---------------------------------------------------------------------------
# News management
# ---------------------------------------------------------------------------


@router.get("/news/list", summary="News list (public)")
def list_news(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user_uuid: str | None = Query(None),
):
    """Get active news articles. Public endpoint."""
    with get_session() as db:
        try:
            q = db.query(AiNews).filter(AiNews.is_active == 1)
            total = q.count()
            items = q.order_by(desc(AiNews.id)).offset((page - 1) * limit).limit(limit).all()
            data = [
                {
                    "id": n.id,
                    "title": n.news_title,
                    "content": n.news_content,
                    "image": n.cover_image,
                    "created_at": n.created_at.isoformat() if n.created_at else None,
                }
                for n in items
            ]
            return success(data, total=total)
        except Exception as e:
            logger.error(f"List news error: {e}")
            return error(str(e))


@router.post("/news/create", summary="Create news (admin only)")
def create_news(
    title: str = Query(..., description="News title"),
    content: str = Query(..., description="News content (HTML supported)"),
    image: str = Query("", description="Cover image URL"),
    user_uuid: str = Depends(require_role(["admin", "super_admin"])),
):
    """Create a news article. Requires admin role."""
    with get_session() as db:
        try:
            news = AiNews(
                news_title=title,
                news_content=content,
                cover_image=image,
                is_active=1,
            )
            db.add(news)
            db.commit()
            db.refresh(news)
            return success({"id": news.id, "title": title})
        except Exception as e:
            logger.error(f"Create news error: {e}")
            return error(f"Failed to create news: {e}" "")


@router.put("/news/update/{news_id}", summary="Update news (admin only)")
def update_news(
    news_id: int,
    title: str | None = Query(None),
    content: str | None = Query(None),
    image: str | None = Query(None),
    is_active: int | None = Query(None),
    user_uuid: str = Depends(require_role(["admin", "super_admin"])),
):
    """Update a news article. Requires admin role."""
    with get_session() as db:
        try:
            news = db.query(AiNews).filter(AiNews.id == news_id).first()
            if not news:
                return error("News not found", "404")

            if title is not None:
                news.news_title = title
            if content is not None:
                news.news_content = content
            if image is not None:
                news.cover_image = image
            if is_active is not None:
                news.is_active = is_active

            db.commit()
            return success({"id": news_id, "updated": True})
        except Exception as e:
            logger.error(f"Update news error: {e}")
            return error(f"Failed to update news: {e}" "")


@router.post("/news/delete", summary="Delete news (admin only)")
def delete_news(
    news_id: int = Query(..., description="News ID to delete"),
    user_uuid: str = Depends(require_role(["admin", "super_admin"])),
):
    """Delete a news article. Requires admin role."""
    with get_session() as db:
        try:
            news = db.query(AiNews).filter(AiNews.id == news_id).first()
            if not news:
                return error("News not found", "404")

            news.is_active = 0  # Soft delete
            db.commit()
            return success({"id": news_id, "deleted": True})
        except Exception as e:
            logger.error(f"Delete news error: {e}")
            return error(f"Failed to delete news: {e}" "")


# ---------------------------------------------------------------------------
# System notice management
# ---------------------------------------------------------------------------


@router.get("/notice/list", summary="System notice list (public)")
def list_notices(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user_uuid: str | None = Query(None),
):
    """Get active system notices. Public endpoint."""
    with get_session() as db:
        try:
            q = db.query(SysNotice).filter(SysNotice.status == "0")
            total = q.count()
            items = q.order_by(desc(SysNotice.notice_id)).offset((page - 1) * limit).limit(limit).all()
            data = [
                {
                    "id": n.notice_id,
                    "title": n.notice_title,
                    "type": n.notice_type,
                    "content": n.notice_content,
                    "create_time": n.create_time.isoformat() if n.create_time else None,
                }
                for n in items
            ]
            return success(data, total=total)
        except Exception as e:
            logger.error(f"List notice error: {e}")
            return error(str(e))


@router.post("/notice/create", summary="Create system notice (admin only)")
def create_notice(
    notice_title: str = Query(..., description="Notice title"),
    notice_type: str = Query("1", description="1=notification, 2=announcement"),
    notice_content: str = Query("", description="Notice content"),
    user_uuid: str = Depends(require_role(["admin", "super_admin"])),
):
    """Create a system notice. Requires admin role."""
    with get_session() as db:
        try:
            notice = SysNotice(
                notice_title=notice_title,
                notice_type=notice_type,
                notice_content=notice_content,
                status="0",
                create_by=user_uuid,
            )
            db.add(notice)
            db.commit()
            db.refresh(notice)
            return success({"id": notice.notice_id, "title": notice_title})
        except Exception as e:
            logger.error(f"Create notice error: {e}")
            return error(f"Failed to create notice: {e}" "")


@router.put("/notice/update/{notice_id}", summary="Update notice (admin only)")
def update_notice(
    notice_id: int,
    notice_title: str | None = Query(None),
    notice_type: str | None = Query(None),
    notice_content: str | None = Query(None),
    status: str | None = Query(None),
    user_uuid: str = Depends(require_role(["admin", "super_admin"])),
):
    """Update a system notice. Requires admin role."""
    with get_session() as db:
        try:
            notice = db.query(SysNotice).filter(SysNotice.notice_id == notice_id).first()
            if not notice:
                return error("Notice not found", "404")

            if notice_title is not None:
                notice.notice_title = notice_title
            if notice_type is not None:
                notice.notice_type = notice_type
            if notice_content is not None:
                notice.notice_content = notice_content
            if status is not None:
                notice.status = status

            db.commit()
            return success({"id": notice_id, "updated": True})
        except Exception as e:
            logger.error(f"Update notice error: {e}")
            return error(f"Failed to update notice: {e}" "")


@router.post("/notice/delete", summary="Delete notice (admin only)")
def delete_notice(
    notice_id: int = Query(..., description="Notice ID to delete"),
    user_uuid: str = Depends(require_role(["admin", "super_admin"])),
):
    """Delete a system notice. Requires admin role."""
    with get_session() as db:
        try:
            notice = db.query(SysNotice).filter(SysNotice.notice_id == notice_id).first()
            if not notice:
                return error("Notice not found", "404")

            notice.status = "1"  # Disabled status
            db.commit()
            return success({"id": notice_id, "deleted": True})
        except Exception as e:
            logger.error(f"Delete notice error: {e}")
            return error(f"Failed to delete notice: {e}" "")


# ---------------------------------------------------------------------------
# Popular recommendations
# ---------------------------------------------------------------------------


@router.get("/popular/list", summary="Popular recommendations (public)")
def list_popular(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    """Get popular recommended content based on sort order."""
    with get_session() as db:
        try:
            q = db.query(BannerCarousel).filter(BannerCarousel.is_active == 1)
            total = q.count()
            items = (
                q.order_by(desc(BannerCarousel.sort_order), desc(BannerCarousel.id))
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            data = [
                {
                    "id": p.id,
                    "title": p.title,
                    "image": p.image_url,
                    "url": p.link_url,
                    "sort": p.sort_order,
                }
                for p in items
            ]
            return success(data, total=total)
        except Exception as e:
            logger.error(f"List popular error: {e}")
            return error(str(e))
