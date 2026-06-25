"""圈子社区 - 圈子管理"""


from fastapi import APIRouter, Query
from loguru import logger

from app.core.current_user import current_user_id_or_guest
from app.database import get_session
from app.models.circle_models import Circle, CircleCategory, CircleMember
from app.schemas.common import error, success

router = APIRouter()


def _uid() -> str:
    return current_user_id_or_guest()

def _c_to_dict(c: Circle) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "description": c.description,
        "avatar": c.avatar,
        "cover": c.cover,
        "category_id": c.category_id,
        "owner_id": c.owner_id,
        "owner_name": c.owner_name,
        "member_num": c.member_num,
        "post_num": c.post_num,
        "status": c.status,
        "is_official": c.is_official,
        "is_top": c.is_top,
        "is_essence": c.is_essence,
        "create_time": c.created_at.isoformat() if c.created_at else None,
    }


@router.get("/list", summary="圈子列表")
def list_circles(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    category_id: int | None = None,
    keyword: str | None = None,
    is_official: bool | None = None,
):
    with get_session() as db:
        try:
            q = db.query(Circle).filter(not Circle.deleted, Circle.status == 1)
            if category_id:
                q = q.filter(Circle.category_id == category_id)
            if keyword:
                q = q.filter(Circle.name.like(f"%{keyword}%"))
            if is_official is not None:
                q = q.filter(Circle.is_official == is_official)
            total = q.count()
            items = (
                q.order_by(Circle.is_top.desc(), Circle.member_num.desc()).offset((page - 1) * limit).limit(limit).all()
            )
            return success([_c_to_dict(i) for i in items], total=total)
        except Exception as e:
            logger.error(f"circle list error: {e}")
            return error(str(e))


@router.get("/{cid}", summary="圈子详情")
def get_circle(cid: int):
    with get_session() as db:
        try:
            c = db.query(Circle).filter(Circle.id == cid, not Circle.deleted).first()
            if not c:
                return error("圈子不存在", "404")
            data = _c_to_dict(c)
            data["is_member"] = (
                db.query(CircleMember)
                .filter(CircleMember.circle_id == cid, CircleMember.user_id == _uid(), CircleMember.status == 1)
                .first()
                is not None
            )
            return success(data)
        except Exception as e:
            logger.error(f"circle get error: {e}")
            return error(str(e))


@router.post("", summary="创建圈子")
def create_circle(
    name: str = Query(..., min_length=1, max_length=100),
    description: str | None = None,
    category_id: int | None = None,
    avatar: str | None = None,
    cover: str | None = None,
):
    with get_session() as db:
        try:
            uid = _uid()
            c = Circle(
                name=name,
                description=description,
                category_id=category_id,
                avatar=avatar,
                cover=cover,
                owner_id=uid,
                owner_name="匿名用户",
                status=1,
            )
            db.add(c)
            db.flush()
            db.add(
                CircleMember(
                    circle_id=c.id,
                    user_id=uid,
                    user_name="匿名用户",
                    role="owner",
                    status=1,
                )
            )
            c.member_num = 1
            return success(_c_to_dict(c))
        except Exception as e:
            logger.error(f"circle create error: {e}")
            return error(str(e))


@router.put("/{cid}", summary="修改圈子")
def update_circle(
    cid: int,
    name: str | None = None,
    description: str | None = None,
    avatar: str | None = None,
    cover: str | None = None,
):
    with get_session() as db:
        try:
            c = db.query(Circle).filter(Circle.id == cid).first()
            if not c:
                return error("圈子不存在", "404")
            if name:
                c.name = name
            if description is not None:
                c.description = description
            if avatar:
                c.avatar = avatar
            if cover:
                c.cover = cover
            return success(_c_to_dict(c))
        except Exception as e:
            logger.error(f"circle update error: {e}")
            return error(str(e))


@router.delete("/{cid}", summary="删除圈子")
def delete_circle(cid: int):
    with get_session() as db:
        try:
            c = db.query(Circle).filter(Circle.id == cid).first()
            if not c:
                return error("圈子不存在", "404")
            c.deleted = True
            c.status = 0
            return success()
        except Exception as e:
            logger.error(f"circle delete error: {e}")
            return error(str(e))


@router.post("/{cid}/join", summary="加入圈子")
def join_circle(cid: int):
    with get_session() as db:
        try:
            uid = _uid()
            c = db.query(Circle).filter(Circle.id == cid).first()
            if not c:
                return error("圈子不存在", "404")
            m = db.query(CircleMember).filter(CircleMember.circle_id == cid, CircleMember.user_id == uid).first()
            if m:
                if m.status == 0:
                    m.status = 1
                    c.member_num = (c.member_num or 0) + 1
                return success({"joined": True})
            db.add(CircleMember(circle_id=cid, user_id=uid, user_name="匿名用户", role="member", status=1))
            c.member_num = (c.member_num or 0) + 1
            return success({"joined": True})
        except Exception as e:
            logger.error(f"circle join error: {e}")
            return error(str(e))


@router.post("/{cid}/quit", summary="退出圈子")
def quit_circle(cid: int):
    with get_session() as db:
        try:
            uid = _uid()
            m = db.query(CircleMember).filter(CircleMember.circle_id == cid, CircleMember.user_id == uid).first()
            if not m:
                return error("未加入该圈子", "400")
            if m.role == "owner":
                return error("圈主不能退出", "400")
            m.status = 0
            c = db.query(Circle).filter(Circle.id == cid).first()
            if c and c.member_num and c.member_num > 0:
                c.member_num -= 1
            return success({"quit": True})
        except Exception as e:
            logger.error(f"circle quit error: {e}")
            return error(str(e))


@router.get("/{cid}/members", summary="成员列表")
def list_members(cid: int, page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100)):
    with get_session() as db:
        try:
            q = db.query(CircleMember).filter(CircleMember.circle_id == cid, CircleMember.status == 1)
            total = q.count()
            items = (
                q.order_by(CircleMember.role.asc(), CircleMember.id.asc()).offset((page - 1) * limit).limit(limit).all()
            )
            data = [
                {
                    "id": m.id,
                    "user_id": m.user_id,
                    "user_name": m.user_name,
                    "user_avatar": m.user_avatar,
                    "role": m.role,
                    "create_time": m.created_at.isoformat() if m.created_at else None,
                }
                for m in items
            ]
            return success(data, total=total)
        except Exception as e:
            logger.error(f"circle members error: {e}")
            return error(str(e))


@router.get("/category/list", operation_id="circle_category_list", summary="圈子分类列表")
def category_list():
    with get_session() as db:
        try:
            items = (
                db.query(CircleCategory)
                .filter(CircleCategory.is_show)
                .order_by(CircleCategory.sort_order.asc())
                .all()
            )
            return success(
                [
                    {
                        "id": c.id,
                        "pid": c.pid,
                        "name": c.name,
                        "sort_order": c.sort_order,
                        "icon": c.icon,
                    }
                    for c in items
                ]
            )
        except Exception as e:
            logger.error(f"circle category list error: {e}")
            return error(str(e))
