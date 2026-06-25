"""广告管理"""

from datetime import datetime

from fastapi import APIRouter, Query
from loguru import logger
from sqlalchemy import BigInteger, Column, DateTime, Index, Integer, String, Text

from app.database import Base, get_session
from app.models.base import TimestampMixin
from app.schemas.common import error, success


class AdvertisePosition(TimestampMixin, Base):
    """广告位"""

    __tablename__ = "advertise_position"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    name = Column(String(50), nullable=False, comment="广告位名称")
    code = Column(String(50), unique=True, nullable=False, comment="广告位编码")
    description = Column(String(200), nullable=True)
    width = Column(Integer, default=0, comment="宽度px")
    height = Column(Integer, default=0, comment="高度px")
    status = Column(Integer, default=1)


class Advertise(TimestampMixin, Base):
    """广告"""

    __tablename__ = "advertise"
    __table_args__ = (
        Index("idx_ad_status", "status"),
        Index("idx_ad_position", "position_id"),
    )
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    title = Column(String(200), nullable=False, comment="广告标题")
    image = Column(String(500), nullable=True, comment="广告图")
    url = Column(String(500), nullable=True, comment="跳转URL")
    position_id = Column(BigInteger, nullable=False, comment="广告位ID")
    type = Column(String(20), default="image", comment="image/text/video")
    content = Column(Text, nullable=True, comment="文字内容")
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    status = Column(Integer, default=1, comment="0=下线 1=上线")
    sort_order = Column(Integer, default=0)
    click_num = Column(Integer, default=0)
    view_num = Column(Integer, default=0)
    target_user = Column(String(20), default="all", comment="all/vip/normal")


router = APIRouter()


@router.get("/position/list", summary="广告位列表")
def position_list():
    with get_session() as db:
        try:
            items = db.query(AdvertisePosition).filter(AdvertisePosition.status == 1).all()
            return success(
                [
                    {
                        "id": p.id,
                        "name": p.name,
                        "code": p.code,
                        "description": p.description,
                        "width": p.width,
                        "height": p.height,
                    }
                    for p in items
                ]
            )
        except Exception as e:
            logger.error(f"ad position list error: {e}")
            return error(str(e))


@router.post("/position", summary="新增广告位")
def create_position(
    name: str = Query(...), code: str = Query(...), description: str | None = None, width: int = 0, height: int = 0
):
    with get_session() as db:
        try:
            p = AdvertisePosition(name=name, code=code, description=description, width=width, height=height, status=1)
            db.add(p)
            db.flush()
            return success({"id": p.id})
        except Exception as e:
            logger.error(f"ad position create error: {e}")
            return error(str(e))


@router.get("/list", summary="广告列表")
def list_advertises(
    position_id: int | None = None,
    status: int | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    with get_session() as db:
        try:
            q = db.query(Advertise)
            if position_id:
                q = q.filter(Advertise.position_id == position_id)
            if status is not None:
                q = q.filter(Advertise.status == status)
            total = q.count()
            items = (
                q.order_by(Advertise.sort_order.asc(), Advertise.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success(
                [
                    {
                        "id": a.id,
                        "title": a.title,
                        "image": a.image,
                        "url": a.url,
                        "position_id": a.position_id,
                        "type": a.type,
                        "content": a.content,
                        "start_time": a.start_time.isoformat() if a.start_time else None,
                        "end_time": a.end_time.isoformat() if a.end_time else None,
                        "status": a.status,
                        "sort_order": a.sort_order,
                        "click_num": a.click_num,
                        "view_num": a.view_num,
                        "target_user": a.target_user,
                    }
                    for a in items
                ],
                total=total,
            )
        except Exception as e:
            logger.error(f"advertise list error: {e}")
            return error(str(e))


@router.get("/{aid}", summary="广告详情")
def get_advertise(aid: int):
    with get_session() as db:
        try:
            a = db.query(Advertise).filter(Advertise.id == aid).first()
            if not a:
                return error("广告不存在", "404")
            a.view_num = (a.view_num or 0) + 1
            return success(
                {
                    "id": a.id,
                    "title": a.title,
                    "image": a.image,
                    "url": a.url,
                    "position_id": a.position_id,
                    "type": a.type,
                    "content": a.content,
                    "status": a.status,
                }
            )
        except Exception as e:
            logger.error(f"advertise get error: {e}")
            return error(str(e))


@router.post("", summary="新增广告")
def create_advertise(
    title: str = Query(..., min_length=1, max_length=200),
    position_id: int = Query(...),
    image: str | None = None,
    url: str | None = None,
    type: str = "image",
    content: str | None = None,
    start_time: datetime | None = None,
    end_time: datetime | None = None,
    sort_order: int = 0,
    target_user: str = "all",
):
    with get_session() as db:
        try:
            a = Advertise(
                title=title,
                image=image,
                url=url,
                position_id=position_id,
                type=type,
                content=content,
                start_time=start_time,
                end_time=end_time,
                status=1,
                sort_order=sort_order,
                target_user=target_user,
            )
            db.add(a)
            db.flush()
            return success({"id": a.id})
        except Exception as e:
            logger.error(f"advertise create error: {e}")
            return error(str(e))


@router.put("/{aid}", summary="修改广告")
def update_advertise(
    aid: int,
    title: str | None = None,
    image: str | None = None,
    url: str | None = None,
    status: int | None = None,
    sort_order: int | None = None,
):
    with get_session() as db:
        try:
            a = db.query(Advertise).filter(Advertise.id == aid).first()
            if not a:
                return error("广告不存在", "404")
            if title:
                a.title = title
            if image:
                a.image = image
            if url:
                a.url = url
            if status is not None:
                a.status = status
            if sort_order is not None:
                a.sort_order = sort_order
            return success()
        except Exception as e:
            logger.error(f"advertise update error: {e}")
            return error(str(e))


@router.delete("/{aid}", summary="删除广告")
def delete_advertise(aid: int):
    with get_session() as db:
        try:
            a = db.query(Advertise).filter(Advertise.id == aid).first()
            if not a:
                return error("广告不存在", "404")
            db.delete(a)
            return success()
        except Exception as e:
            logger.error(f"advertise delete error: {e}")
            return error(str(e))


@router.post("/{aid}/click", summary="记录广告点击")
def record_click(aid: int):
    with get_session() as db:
        try:
            a = db.query(Advertise).filter(Advertise.id == aid).first()
            if not a:
                return error("广告不存在", "404")
            a.click_num = (a.click_num or 0) + 1
            return success()
        except Exception as e:
            logger.error(f"advertise click error: {e}")
            return error(str(e))
