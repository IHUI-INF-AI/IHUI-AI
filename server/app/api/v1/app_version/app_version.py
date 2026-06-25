"""小程序版本管理"""

from fastapi import APIRouter, Query
from loguru import logger
from sqlalchemy import BigInteger, Boolean, Column, Index, Integer, String, Text

from app.database import Base, get_session
from app.models.base import TimestampMixin
from app.schemas.common import error, success


class AppVersion(TimestampMixin, Base):
    __tablename__ = "app_version"
    __table_args__ = (
        Index("idx_av_platform", "platform"),
        {"extend_existing": True},
    )
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    platform = Column(String(20), nullable=False, comment="ios/android/wechat/h5")
    version = Column(String(20), nullable=False, comment="版本号 如1.0.0")
    build = Column(Integer, default=1, comment="构建号")
    title = Column(String(200), nullable=False, comment="更新标题")
    content = Column(Text, nullable=False, comment="更新内容")
    download_url = Column(String(500), nullable=True, comment="下载链接")
    is_force = Column(Boolean, default=False, comment="是否强制更新")
    is_silent = Column(Boolean, default=False, comment="是否静默更新")
    status = Column(Integer, default=1, comment="0=下线 1=上线")
    min_version = Column(String(20), nullable=True, comment="最低支持版本")
    gray_ratio = Column(Integer, default=0, comment="灰度比例0-100")
    file_size = Column(Integer, default=0, comment="包大小(字节)")
    md5 = Column(String(50), nullable=True, comment="文件MD5")


router = APIRouter()


@router.get("/list", summary="版本列表")
def list_versions(platform: str | None = None,
                        page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100)):
    with get_session() as db:
        try:
            q = db.query(AppVersion)
            if platform:
                q = q.filter(AppVersion.platform == platform)
            total = q.count()
            items = q.order_by(AppVersion.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success([{
                "id": v.id, "platform": v.platform, "version": v.version, "build": v.build,
                "title": v.title, "content": v.content, "download_url": v.download_url,
                "is_force": v.is_force, "is_silent": v.is_silent, "status": v.status,
                "min_version": v.min_version, "gray_ratio": v.gray_ratio,
                "file_size": v.file_size, "md5": v.md5,
                "create_time": v.created_at.isoformat() if v.created_at else None,
            } for v in items], total=total)
        except Exception as e:
            logger.error(f"app version list error: {e}")
            return error(str(e))


@router.get("/check", summary="检查更新")
def check_update(platform: str = Query(...), current_version: str = Query(...),
                        build: int = Query(0)):
    with get_session() as db:
        try:
            latest = db.query(AppVersion).filter(
                AppVersion.platform == platform, AppVersion.status == 1
            ).order_by(AppVersion.id.desc()).first()
            if not latest:
                return success({"has_update": False})
            has_update = latest.version != current_version
            force = latest.is_force and has_update
            return success({
                "has_update": has_update,
                "is_force": force,
                "is_silent": latest.is_silent,
                "version": latest.version,
                "build": latest.build,
                "title": latest.title,
                "content": latest.content,
                "download_url": latest.download_url,
                "min_version": latest.min_version,
                "file_size": latest.file_size,
                "md5": latest.md5,
            })
        except Exception as e:
            logger.error(f"app version check error: {e}")
            return error(str(e))


@router.post("", summary="新增版本")
def create_version(platform: str = Query(...), version: str = Query(...),
                          build: int = 1, title: str = Query(...), content: str = Query(...),
                          download_url: str | None = None, is_force: bool = False,
                          is_silent: bool = False, min_version: str | None = None,
                          gray_ratio: int = 0, file_size: int = 0, md5: str | None = None):
    with get_session() as db:
        try:
            v = AppVersion(
                platform=platform, version=version, build=build,
                title=title, content=content, download_url=download_url,
                is_force=is_force, is_silent=is_silent, status=1,
                min_version=min_version, gray_ratio=gray_ratio,
                file_size=file_size, md5=md5,
            )
            db.add(v)
            db.flush()
            return success({"id": v.id})
        except Exception as e:
            logger.error(f"app version create error: {e}")
            return error(str(e))


@router.put("/{vid}", summary="修改版本")
def update_version(vid: int, title: str | None = None, content: str | None = None,
                          status: int | None = None, is_force: bool | None = None,
                          download_url: str | None = None, gray_ratio: int | None = None):
    with get_session() as db:
        try:
            v = db.query(AppVersion).filter(AppVersion.id == vid).first()
            if not v:
                return error("版本不存在", "404")
            if title: v.title = title
            if content: v.content = content
            if status is not None: v.status = status
            if is_force is not None: v.is_force = is_force
            if download_url: v.download_url = download_url
            if gray_ratio is not None: v.gray_ratio = gray_ratio
            return success()
        except Exception as e:
            logger.error(f"app version update error: {e}")
            return error(str(e))


@router.delete("/{vid}", summary="删除版本")
def delete_version(vid: int):
    with get_session() as db:
        try:
            v = db.query(AppVersion).filter(AppVersion.id == vid).first()
            if not v:
                return error("版本不存在", "404")
            db.delete(v)
            return success()
        except Exception as e:
            logger.error(f"app version delete error: {e}")
            return error(str(e))
