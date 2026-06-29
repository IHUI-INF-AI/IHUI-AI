"""Content management routes (about_us, news, banners, feedback, app_version)."""

from datetime import datetime

from fastapi import APIRouter, Body, Depends, Query
from loguru import logger

from app.database import get_session
from app.schemas.common import error, success
from app.security import require_login

router = APIRouter()


@router.get("/contact", summary="获取联系信息")
async def get_contact():
    """Return the active contact-us entry."""
    from app.models.app_content_models import AiContact

    with get_session() as db:
        contact = db.query(AiContact).filter(AiContact.status == 1).order_by(AiContact.id.desc()).first()
        if not contact:
            return success(None)
        return success(
            {
                "id": contact.id,
                "name": contact.name,
                "phone": contact.phone,
                "email": contact.email,
                "content": contact.content,
            }
        )


@router.get("/about", summary="Get about us")
async def get_about():
    with get_session() as db:
        from app.models.app_content_models import AiAboutUs

        items = db.query(AiAboutUs).filter(AiAboutUs.status == 1).order_by(AiAboutUs.sort).all()
        data = [{"id": a.id, "title": a.title, "content": a.content} for a in items]
        return success(data)


@router.get("/news", summary="List news")
async def list_news(page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100)):
    with get_session() as db:
        from app.models.app_content_models import AiNews

        q = db.query(AiNews).filter(AiNews.status == 1)
        total = q.count()
        items = q.order_by(AiNews.sort, AiNews.id.desc()).offset((page - 1) * limit).limit(limit).all()
        data = [
            {
                "id": n.id,
                "title": n.title,
                "subtitle": n.subtitle,
                "cover_image": n.cover_image,
                "author": n.author,
                "view_count": n.view_count,
            }
            for n in items
        ]
        return success(data, total=total)


@router.get("/news/{news_id}", summary="Get news detail")
async def get_news(news_id: int):
    with get_session() as db:
        from app.models.app_content_models import AiNews

        news = db.query(AiNews).filter(AiNews.id == news_id).first()
        if not news:
            return error("News not found", "404")
        news.view_count = (news.view_count or 0) + 1
        db.commit()
        return success(
            {
                "id": news.id,
                "title": news.title,
                "content": news.content,
                "cover_image": news.cover_image,
                "author": news.author,
                "view_count": news.view_count,
            }
        )


@router.get("/banners", summary="List banners")
async def list_banners(position: str = Query(None)):
    with get_session() as db:
        from app.models.app_content_models import BannerCarousel

        q = db.query(BannerCarousel).filter(BannerCarousel.status == 1)
        if position:
            q = q.filter(BannerCarousel.position == position)
        items = q.order_by(BannerCarousel.sort).all()
        data = [
            {"id": b.id, "title": b.title, "image_url": b.image_url, "link_url": b.link_url, "position": b.position}
            for b in items
        ]
        return success(data)


@router.post("/feedback", summary="Submit feedback")
async def submit_feedback(
    images: str = Query(None),
    type: str = Query(None),
    user_uuid: str = Depends(require_login),
    content: str = Body(...),
):
    with get_session() as db:
        try:
            from app.models.app_content_models import AiUserFeedback

            fb = AiUserFeedback(user_uuid=user_uuid, content=content, images=images, type=type)
            db.add(fb)
            db.commit()
            return success(msg="Feedback submitted")
        except Exception as e:
            return error(str(e))


@router.get("/version", summary="Get latest app version")
async def get_version(platform: str = Query("android")):
    with get_session() as db:
        from app.models.app_content_models import AppVersion

        v = (
            db.query(AppVersion)
            .filter(AppVersion.platform == platform, AppVersion.status == 1)
            .order_by(AppVersion.id.desc())
            .first()
        )
        if not v:
            return success(None)
        return success(
            {
                "version_code": v.version_code,
                "version_name": v.version_name,
                "download_url": v.download_url,
                "description": v.description,
                "force_update": v.force_update,
            }
        )


# ===========================================================================
# App 版本管理 CRUD(管理端)
# ===========================================================================


@router.get("/version/list", summary="App 版本列表")
async def list_versions(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    platform: str = Query(None),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        from app.models.app_content_models import AppVersion

        q = db.query(AppVersion)
        if platform:
            q = q.filter(AppVersion.platform == platform)
        total = q.count()
        items = q.order_by(AppVersion.id.desc()).offset((page - 1) * limit).limit(limit).all()
        data = [
            {
                "id": v.id,
                "version_code": v.version_code,
                "version_name": v.version_name,
                "download_url": v.download_url,
                "description": v.description,
                "platform": v.platform,
                "force_update": v.force_update,
                "status": v.status,
            }
            for v in items
        ]
        return success(data, total=total)


@router.post("/version/create", summary="创建 App 版本")
async def create_version(
    version_code: str = Query(...),
    version_name: str = Query(...),
    download_url: str = Query(...),
    description: str = Query(""),
    platform: str = Query("android"),
    force_update: int = Query(0, description="0=否 1=是"),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        try:
            from app.models.app_content_models import AppVersion

            v = AppVersion(
                version_code=version_code,
                version_name=version_name,
                download_url=download_url,
                description=description,
                platform=platform,
                force_update=force_update,
                status=1,
            )
            db.add(v)
            db.commit()
            return success({"id": v.id, "version_name": version_name})
        except Exception as e:
            logger.error(f"Create version error: {e}")
            return error(str(e))


@router.put("/version/update", summary="更新 App 版本")
async def update_version(
    version_id: int = Query(...),
    version_code: str = Query(None),
    version_name: str = Query(None),
    download_url: str = Query(None),
    description: str = Query(None),
    platform: str = Query(None),
    force_update: int = Query(None),
    status: int = Query(None),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        try:
            from app.models.app_content_models import AppVersion

            v = db.query(AppVersion).filter(AppVersion.id == version_id).first()
            if not v:
                return error("版本不存在", "404")
            if version_code is not None:
                v.version_code = version_code
            if version_name is not None:
                v.version_name = version_name
            if download_url is not None:
                v.download_url = download_url
            if description is not None:
                v.description = description
            if platform is not None:
                v.platform = platform
            if force_update is not None:
                v.force_update = force_update
            if status is not None:
                v.status = status
            db.commit()
            return success({"id": v.id})
        except Exception as e:
            logger.error(f"Update version error: {e}")
            return error(str(e))


@router.delete("/version/delete", summary="删除 App 版本")
async def delete_version(
    version_id: int = Query(...),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        try:
            from app.models.app_content_models import AppVersion

            v = db.query(AppVersion).filter(AppVersion.id == version_id).first()
            if not v:
                return error("版本不存在", "404")
            db.delete(v)
            db.commit()
            return success({"id": version_id, "deleted": True})
        except Exception as e:
            logger.error(f"Delete version error: {e}")
            return error(str(e))


# ===========================================================================
# 用户反馈管理 CRUD(管理端)
# ===========================================================================


@router.get("/feedback/list", summary="反馈列表")
async def list_feedbacks(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: int = Query(None, description="筛选状态: 0=未处理 1=已处理"),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        from app.models.app_content_models import AiUserFeedback

        q = db.query(AiUserFeedback)
        if status is not None:
            q = q.filter(AiUserFeedback.status == status)
        total = q.count()
        items = q.order_by(AiUserFeedback.id.desc()).offset((page - 1) * limit).limit(limit).all()
        data = [
            {
                "id": fb.id,
                "user_uuid": fb.user_uuid,
                "content": fb.content,
                "images": fb.images,
                "type": fb.type,
                "status": fb.status,
                "reply": fb.reply,
                "reply_time": fb.reply_time.isoformat() if fb.reply_time else None,
            }
            for fb in items
        ]
        return success(data, total=total)


@router.put("/feedback/update", summary="更新/回复反馈")
async def update_feedback(
    feedback_id: int = Query(...),
    status: int = Query(None),
    reply: str = Query(None),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        try:
            from app.models.app_content_models import AiUserFeedback

            fb = db.query(AiUserFeedback).filter(AiUserFeedback.id == feedback_id).first()
            if not fb:
                return error("反馈不存在", "404")
            if status is not None:
                fb.status = status
            if reply is not None:
                fb.reply = reply
                fb.reply_time = datetime.utcnow()
            db.commit()
            return success({"id": fb.id, "status": fb.status})
        except Exception as e:
            logger.error(f"Update feedback error: {e}")
            return error(str(e))


@router.delete("/feedback/delete", summary="删除反馈")
async def delete_feedback(
    feedback_id: int = Query(...),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        try:
            from app.models.app_content_models import AiUserFeedback

            fb = db.query(AiUserFeedback).filter(AiUserFeedback.id == feedback_id).first()
            if not fb:
                return error("反馈不存在", "404")
            db.delete(fb)
            db.commit()
            return success({"id": feedback_id, "deleted": True})
        except Exception as e:
            logger.error(f"Delete feedback error: {e}")
            return error(str(e))
