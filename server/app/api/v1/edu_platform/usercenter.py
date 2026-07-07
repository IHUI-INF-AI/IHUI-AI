"""用户中心模块路由 - 迁移自旧 Java Spring Boot user-service (2026-07-05).

包含: 用户CRUD/密码管理/部门CRUD/统计.
密码使用 hashlib.sha256 哈希.
"""
import hashlib

from fastapi import APIRouter, Body, Query
from loguru import logger

from app.database import get_session
from app.models.edu_platform_models import EduDepartment, EduUser
from app.schemas.common import error, success

router = APIRouter()


def _hash_password(password: str) -> str:
    """SHA256 哈希密码."""
    if not password:
        return ""
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def _verify_password(plain: str, hashed: str) -> bool:
    if not plain or not hashed:
        return False
    return _hash_password(plain) == hashed


def _user_to_dict(u: EduUser) -> dict:
    return {
        "id": u.id,
        "mobile": u.mobile,
        "name": u.name,
        "company_id": u.company_id,
        "status": u.status,
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }


# ---------------------------------------------------------------------------
# 用户 CRUD
# ---------------------------------------------------------------------------


@router.get("/list", summary="用户列表")
async def user_list(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    name: str | None = None,
    mobile: str | None = None,
    status: int | None = None,
    company_id: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(EduUser)
            if name:
                q = q.filter(EduUser.name.like(f"%{name}%"))
            if mobile:
                q = q.filter(EduUser.mobile.like(f"%{mobile}%"))
            if status is not None:
                q = q.filter(EduUser.status == status)
            if company_id:
                q = q.filter(EduUser.company_id == company_id)
            total = q.count()
            items = q.order_by(EduUser.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success([_user_to_dict(u) for u in items], total=total, page=page, page_size=limit)
        except Exception as e:
            logger.error(f"[edu usercenter] user list error: {e}")
            return error(str(e))


@router.post("/user", summary="创建用户")
async def create_user(
    mobile: str = Body(..., min_length=1),
    name: str | None = Body(None),
    password: str = Body(..., min_length=6),
    company_id: int | None = Body(None),
    status: int = Body(1),
):
    with get_session() as db:
        try:
            existing = db.query(EduUser).filter(EduUser.mobile == mobile).first()
            if existing:
                return error("手机号已存在", "409")
            u = EduUser(
                mobile=mobile,
                name=name,
                password=_hash_password(password),
                company_id=company_id,
                status=status,
            )
            db.add(u)
            db.flush()
            return success({"id": u.id})
        except Exception as e:
            logger.error(f"[edu usercenter] create user error: {e}")
            return error(str(e))


@router.put("/user", summary="更新用户")
async def update_user(
    id: int = Body(...),
    mobile: str | None = Body(None),
    name: str | None = Body(None),
    company_id: int | None = Body(None),
    status: int | None = Body(None),
):
    with get_session() as db:
        try:
            u = db.query(EduUser).filter(EduUser.id == id).first()
            if not u:
                return error("用户不存在", "404")
            if mobile is not None:
                u.mobile = mobile
            if name is not None:
                u.name = name
            if company_id is not None:
                u.company_id = company_id
            if status is not None:
                u.status = status
            return success({"id": u.id})
        except Exception as e:
            logger.error(f"[edu usercenter] update user error: {e}")
            return error(str(e))


@router.put("/user/info", summary="更新用户信息")
async def update_user_info(
    id: int = Body(..., embed=True),
    name: str | None = Body(None, embed=True),
    mobile: str | None = Body(None, embed=True),
):
    with get_session() as db:
        try:
            u = db.query(EduUser).filter(EduUser.id == id).first()
            if not u:
                return error("用户不存在", "404")
            if name is not None:
                u.name = name
            if mobile is not None:
                u.mobile = mobile
            return success({"id": u.id})
        except Exception as e:
            logger.error(f"[edu usercenter] update user info error: {e}")
            return error(str(e))


@router.put("/user/pwd", summary="修改密码")
async def update_user_pwd(
    id: int = Body(..., embed=True),
    oldPassword: str = Body(..., embed=True),
    newPassword: str = Body(..., min_length=6, embed=True),
):
    with get_session() as db:
        try:
            u = db.query(EduUser).filter(EduUser.id == id).first()
            if not u:
                return error("用户不存在", "404")
            if not _verify_password(oldPassword, u.password or ""):
                return error("原密码错误", "401")
            u.password = _hash_password(newPassword)
            return success({"id": u.id})
        except Exception as e:
            logger.error(f"[edu usercenter] update user pwd error: {e}")
            return error(str(e))


@router.delete("/user", summary="删除用户")
async def delete_user(id: int = Query(...)):
    with get_session() as db:
        try:
            u = db.query(EduUser).filter(EduUser.id == id).first()
            if not u:
                return error("用户不存在", "404")
            db.delete(u)
            return success()
        except Exception as e:
            logger.error(f"[edu usercenter] delete user error: {e}")
            return error(str(e))


@router.put("/user/reset/pwd", summary="重置密码")
async def reset_user_pwd(
    id: int = Body(..., embed=True),
    newPassword: str = Body(..., min_length=6, embed=True),
):
    with get_session() as db:
        try:
            u = db.query(EduUser).filter(EduUser.id == id).first()
            if not u:
                return error("用户不存在", "404")
            u.password = _hash_password(newPassword)
            return success({"id": u.id})
        except Exception as e:
            logger.error(f"[edu usercenter] reset user pwd error: {e}")
            return error(str(e))


@router.get("/auth-api/by-mobile", summary="按手机号查")
async def user_by_mobile(mobile: str = Query(..., description="手机号")):
    with get_session() as db:
        try:
            u = db.query(EduUser).filter(EduUser.mobile == mobile).first()
            if not u:
                return error("用户不存在", "404")
            return success(_user_to_dict(u))
        except Exception as e:
            logger.error(f"[edu usercenter] by mobile error: {e}")
            return error(str(e))


@router.get("/auth-api/by-id", summary="按ID查")
async def user_by_id(id: int = Query(..., description="用户id")):
    with get_session() as db:
        try:
            u = db.query(EduUser).filter(EduUser.id == id).first()
            if not u:
                return error("用户不存在", "404")
            return success(_user_to_dict(u))
        except Exception as e:
            logger.error(f"[edu usercenter] by id error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 部门 CRUD
# ---------------------------------------------------------------------------


def _dept_to_dict(d: EduDepartment) -> dict:
    return {
        "id": d.id,
        "name": d.name,
        "pid": d.pid,
        "company_id": d.company_id,
        "sort": d.sort,
        "created_at": d.created_at.isoformat() if d.created_at else None,
    }


@router.get("/department/list", summary="部门列表")
async def dept_list(
    pid: int | None = None,
    company_id: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(EduDepartment)
            if pid is not None:
                q = q.filter(EduDepartment.pid == pid)
            if company_id:
                q = q.filter(EduDepartment.company_id == company_id)
            items = q.order_by(EduDepartment.sort.asc(), EduDepartment.id.asc()).all()
            return success([_dept_to_dict(d) for d in items])
        except Exception as e:
            logger.error(f"[edu usercenter] dept list error: {e}")
            return error(str(e))


@router.post("/department", summary="创建部门")
async def create_dept(
    name: str = Body(..., min_length=1, max_length=100),
    pid: int = Body(0),
    company_id: int | None = Body(None),
    sort: int = Body(0),
):
    with get_session() as db:
        try:
            d = EduDepartment(name=name, pid=pid, company_id=company_id, sort=sort)
            db.add(d)
            db.flush()
            return success({"id": d.id})
        except Exception as e:
            logger.error(f"[edu usercenter] create dept error: {e}")
            return error(str(e))


@router.get("/department", summary="获取部门")
async def get_dept(id: int = Query(..., description="部门id")):
    with get_session() as db:
        try:
            d = db.query(EduDepartment).filter(EduDepartment.id == id).first()
            if not d:
                return error("部门不存在", "404")
            return success(_dept_to_dict(d))
        except Exception as e:
            logger.error(f"[edu usercenter] get dept error: {e}")
            return error(str(e))


@router.put("/department", summary="更新部门")
async def update_dept(
    id: int = Body(...),
    name: str | None = Body(None),
    pid: int | None = Body(None),
    company_id: int | None = Body(None),
    sort: int | None = Body(None),
):
    with get_session() as db:
        try:
            d = db.query(EduDepartment).filter(EduDepartment.id == id).first()
            if not d:
                return error("部门不存在", "404")
            if name is not None:
                d.name = name
            if pid is not None:
                d.pid = pid
            if company_id is not None:
                d.company_id = company_id
            if sort is not None:
                d.sort = sort
            return success({"id": d.id})
        except Exception as e:
            logger.error(f"[edu usercenter] update dept error: {e}")
            return error(str(e))


@router.delete("/department", summary="删除部门")
async def delete_dept(id: int = Query(...)):
    with get_session() as db:
        try:
            d = db.query(EduDepartment).filter(EduDepartment.id == id).first()
            if not d:
                return error("部门不存在", "404")
            db.delete(d)
            return success()
        except Exception as e:
            logger.error(f"[edu usercenter] delete dept error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 统计
# ---------------------------------------------------------------------------


@router.get("/statistics", summary="用户统计")
async def user_statistics():
    with get_session() as db:
        try:
            total = db.query(EduUser).count()
            active = db.query(EduUser).filter(EduUser.status == 1).count()
            disabled = db.query(EduUser).filter(EduUser.status == 0).count()
            dept_total = db.query(EduDepartment).count()
            return success(
                {
                    "total": total,
                    "active": active,
                    "disabled": disabled,
                    "dept_total": dept_total,
                }
            )
        except Exception as e:
            logger.error(f"[edu usercenter] statistics error: {e}")
            return error(str(e))
