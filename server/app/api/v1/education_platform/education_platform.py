"""教育平台 - 第三方教育平台对接"""

from fastapi import APIRouter, Query
from loguru import logger
from sqlalchemy import BigInteger, Boolean, Column, DateTime, Index, Integer, String, Text

from app.database import Base, get_session
from app.models.base import TimestampMixin
from app.schemas.common import error, success


class EducationPlatform(TimestampMixin, Base):
    """教育平台对接配置"""
    __tablename__ = "education_platform"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, comment="平台名称")
    code = Column(String(50), unique=True, nullable=False, comment="平台编码")
    type = Column(String(20), default="mooc", comment="mooc/edu/public/private")
    api_url = Column(String(500), nullable=True, comment="API地址")
    api_key = Column(String(200), nullable=True, comment="API密钥")
    api_secret = Column(String(200), nullable=True, comment="API秘钥")
    config = Column(Text, nullable=True, comment="额外配置JSON")
    sync_url = Column(String(500), nullable=True, comment="同步地址")
    last_sync_time = Column(DateTime, nullable=True)
    status = Column(Integer, default=1, comment="0=禁用 1=启用")
    description = Column(Text, nullable=True)


class EducationSyncLog(TimestampMixin, Base):
    """教育平台同步日志"""
    __tablename__ = "education_sync_log"
    __table_args__ = (
        Index("idx_esl_platform", "platform_code"),
    )
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    platform_code = Column(String(50), nullable=False)
    type = Column(String(20), default="course", comment="course/user/order/...")
    sync_type = Column(String(20), default="pull", comment="pull/push")
    success = Column(Boolean, default=False)
    request = Column(Text, nullable=True)
    response = Column(Text, nullable=True)
    error_msg = Column(String(500), nullable=True)
    record_count = Column(Integer, default=0)


router = APIRouter()


@router.get("/list", summary="教育平台列表")
async def list_platforms(status: int | None = None):
    with get_session() as db:
        try:
            q = db.query(EducationPlatform)
            if status is not None:
                q = q.filter(EducationPlatform.status == status)
            items = q.all()
            return success([{
                "id": p.id, "name": p.name, "code": p.code, "type": p.type,
                "api_url": p.api_url, "status": p.status, "description": p.description,
                "last_sync_time": p.last_sync_time.isoformat() if p.last_sync_time else None,
            } for p in items])
        except Exception as e:
            logger.error(f"edu platform list error: {e}")
            return error(str(e))


@router.post("", summary="新增教育平台")
async def create_platform(name: str = Query(...), code: str = Query(...),
                           type: str = "mooc", api_url: str | None = None,
                           api_key: str | None = None, api_secret: str | None = None,
                           config: str | None = None, sync_url: str | None = None,
                           description: str | None = None):
    with get_session() as db:
        try:
            p = EducationPlatform(
                name=name, code=code, type=type, api_url=api_url,
                api_key=api_key, api_secret=api_secret, config=config,
                sync_url=sync_url, description=description, status=1,
            )
            db.add(p)
            db.flush()
            return success({"id": p.id})
        except Exception as e:
            logger.error(f"edu platform create error: {e}")
            return error(str(e))


@router.put("/{pid}", summary="修改教育平台")
async def update_platform(pid: int, name: str | None = None, api_url: str | None = None,
                           api_key: str | None = None, api_secret: str | None = None,
                           status: int | None = None, config: str | None = None):
    with get_session() as db:
        try:
            p = db.query(EducationPlatform).filter(EducationPlatform.id == pid).first()
            if not p:
                return error("平台不存在", "404")
            if name:
                p.name = name
            if api_url:
                p.api_url = api_url
            if api_key:
                p.api_key = api_key
            if api_secret:
                p.api_secret = api_secret
            if status is not None:
                p.status = status
            if config:
                p.config = config
            return success()
        except Exception as e:
            logger.error(f"edu platform update error: {e}")
            return error(str(e))


@router.delete("/{pid}", summary="删除教育平台")
async def delete_platform(pid: int):
    with get_session() as db:
        try:
            p = db.query(EducationPlatform).filter(EducationPlatform.id == pid).first()
            if not p:
                return error("平台不存在", "404")
            db.delete(p)
            return success()
        except Exception as e:
            logger.error(f"edu platform delete error: {e}")
            return error(str(e))


@router.post("/{pid}/sync", summary="同步数据")
async def sync_platform(pid: int, type: str = "course", sync_type: str = "pull"):
    with get_session() as db:
        try:
            from datetime import datetime
            p = db.query(EducationPlatform).filter(EducationPlatform.id == pid).first()
            if not p:
                return error("平台不存在", "404")
            log = EducationSyncLog(
                platform_code=p.code, type=type, sync_type=sync_type,
                success=True, record_count=0,
            )
            db.add(log)
            p.last_sync_time = datetime.utcnow()
            db.flush()
            return success({"id": log.id, "platform_code": p.code})
        except Exception as e:
            logger.error(f"edu platform sync error: {e}")
            return error(str(e))


@router.get("/sync/log", summary="同步日志")
async def sync_log(page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100),
                    platform_code: str | None = None):
    with get_session() as db:
        try:
            q = db.query(EducationSyncLog)
            if platform_code:
                q = q.filter(EducationSyncLog.platform_code == platform_code)
            total = q.count()
            items = q.order_by(EducationSyncLog.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success([{
                "id": item.id, "platform_code": item.platform_code, "type": item.type,
                "sync_type": item.sync_type, "success": item.success,
                "error_msg": item.error_msg, "record_count": item.record_count,
                "create_time": item.created_at.isoformat() if item.created_at else None,
            } for item in items], total=total)
        except Exception as e:
            logger.error(f"edu platform sync log error: {e}")
            return error(str(e))
