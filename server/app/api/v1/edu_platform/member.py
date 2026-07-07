"""教育会员模块路由 - 迁移自旧 Java Spring Boot member-service (2026-07-05).

包含: 会员CRUD/审核/封禁/等级管理/注册/统计.
密码使用 hashlib.sha256 哈希 (兼容旧 Java 项目数据).
注意: 此模块是教育会员体系, 与现有企业 member 模块不同.
"""
import hashlib

from fastapi import APIRouter, Body, Query, UploadFile, File
from loguru import logger

from app.database import get_session
from app.models.edu_platform_models import EduMember, EduMemberLevel
from app.schemas.common import error, success

router = APIRouter()


def _hash_password(password: str) -> str:
    """SHA256 哈希密码."""
    if not password:
        return ""
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def _member_to_dict(m: EduMember) -> dict:
    return {
        "id": m.id,
        "mobile": m.mobile,
        "email": m.email,
        "username": m.username,
        "avatar": m.avatar,
        "nickname": m.nickname,
        "gender": m.gender,
        "status": m.status,
        "level_id": m.level_id,
        "company_id": m.company_id,
        "department_id": m.department_id,
        "growth_value": m.growth_value,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }


# ---------------------------------------------------------------------------
# 会员管理
# ---------------------------------------------------------------------------


@router.get("/list", summary="会员列表")
async def member_list(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    username: str | None = None,
    mobile: str | None = None,
    status: int | None = None,
    level_id: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(EduMember)
            if username:
                q = q.filter(EduMember.username.like(f"%{username}%"))
            if mobile:
                q = q.filter(EduMember.mobile.like(f"%{mobile}%"))
            if status is not None:
                q = q.filter(EduMember.status == status)
            if level_id:
                q = q.filter(EduMember.level_id == level_id)
            total = q.count()
            items = q.order_by(EduMember.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success([_member_to_dict(m) for m in items], total=total, page=page, page_size=limit)
        except Exception as e:
            logger.error(f"[edu member] list error: {e}")
            return error(str(e))


@router.get("/unaudited/list", summary="待审核列表")
async def unaudited_list(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    with get_session() as db:
        try:
            q = db.query(EduMember).filter(EduMember.status == 0)
            total = q.count()
            items = q.order_by(EduMember.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success([_member_to_dict(m) for m in items], total=total, page=page, page_size=limit)
        except Exception as e:
            logger.error(f"[edu member] unaudited list error: {e}")
            return error(str(e))


@router.put("/seal", summary="封禁会员")
async def seal_member(id: int = Body(..., embed=True)):
    with get_session() as db:
        try:
            m = db.query(EduMember).filter(EduMember.id == id).first()
            if not m:
                return error("会员不存在", "404")
            m.status = 2
            return success({"id": m.id, "status": m.status})
        except Exception as e:
            logger.error(f"[edu member] seal error: {e}")
            return error(str(e))


@router.put("/unseal", summary="解封会员")
async def unseal_member(id: int = Body(..., embed=True)):
    with get_session() as db:
        try:
            m = db.query(EduMember).filter(EduMember.id == id).first()
            if not m:
                return error("会员不存在", "404")
            m.status = 1
            return success({"id": m.id, "status": m.status})
        except Exception as e:
            logger.error(f"[edu member] unseal error: {e}")
            return error(str(e))


@router.put("/approved", summary="审核通过")
async def approved_member(id: int = Body(..., embed=True)):
    with get_session() as db:
        try:
            m = db.query(EduMember).filter(EduMember.id == id).first()
            if not m:
                return error("会员不存在", "404")
            m.status = 1
            return success({"id": m.id, "status": m.status})
        except Exception as e:
            logger.error(f"[edu member] approved error: {e}")
            return error(str(e))


@router.put("/reject", summary="审核拒绝")
async def reject_member(id: int = Body(..., embed=True)):
    with get_session() as db:
        try:
            m = db.query(EduMember).filter(EduMember.id == id).first()
            if not m:
                return error("会员不存在", "404")
            m.status = 0
            return success({"id": m.id, "status": m.status})
        except Exception as e:
            logger.error(f"[edu member] reject error: {e}")
            return error(str(e))


@router.post("/create", summary="创建会员")
async def create_member(
    username: str = Body(..., min_length=1, max_length=100),
    password: str = Body(..., min_length=1),
    mobile: str | None = Body(None),
    email: str | None = Body(None),
    nickname: str | None = Body(None),
    avatar: str | None = Body(None),
    gender: int = Body(0),
    level_id: int | None = Body(None),
    company_id: int | None = Body(None),
    department_id: int | None = Body(None),
    status: int = Body(1),
):
    with get_session() as db:
        try:
            if username:
                existing = db.query(EduMember).filter(EduMember.username == username).first()
                if existing:
                    return error("用户名已存在", "409")
            if mobile:
                existing_mobile = db.query(EduMember).filter(EduMember.mobile == mobile).first()
                if existing_mobile:
                    return error("手机号已注册", "409")
            m = EduMember(
                username=username,
                password=_hash_password(password),
                mobile=mobile,
                email=email,
                nickname=nickname,
                avatar=avatar,
                gender=gender,
                level_id=level_id,
                company_id=company_id,
                department_id=department_id,
                status=status,
            )
            db.add(m)
            db.flush()
            return success({"id": m.id})
        except Exception as e:
            logger.error(f"[edu member] create error: {e}")
            return error(str(e))


@router.put("/update", summary="更新会员")
async def update_member(
    id: int = Body(...),
    mobile: str | None = Body(None),
    email: str | None = Body(None),
    nickname: str | None = Body(None),
    avatar: str | None = Body(None),
    gender: int | None = Body(None),
    level_id: int | None = Body(None),
    company_id: int | None = Body(None),
    department_id: int | None = Body(None),
    growth_value: int | None = Body(None),
):
    with get_session() as db:
        try:
            m = db.query(EduMember).filter(EduMember.id == id).first()
            if not m:
                return error("会员不存在", "404")
            if mobile is not None:
                m.mobile = mobile
            if email is not None:
                m.email = email
            if nickname is not None:
                m.nickname = nickname
            if avatar is not None:
                m.avatar = avatar
            if gender is not None:
                m.gender = gender
            if level_id is not None:
                m.level_id = level_id
            if company_id is not None:
                m.company_id = company_id
            if department_id is not None:
                m.department_id = department_id
            if growth_value is not None:
                m.growth_value = growth_value
            return success({"id": m.id})
        except Exception as e:
            logger.error(f"[edu member] update error: {e}")
            return error(str(e))


@router.put("/pwd/reset", summary="重置密码")
async def reset_password(
    id: int = Body(..., embed=True),
    password: str = Body(..., min_length=1),
):
    with get_session() as db:
        try:
            m = db.query(EduMember).filter(EduMember.id == id).first()
            if not m:
                return error("会员不存在", "404")
            m.password = _hash_password(password)
            return success({"id": m.id})
        except Exception as e:
            logger.error(f"[edu member] reset pwd error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 会员等级
# ---------------------------------------------------------------------------


def _level_to_dict(l: EduMemberLevel) -> dict:
    return {
        "id": l.id,
        "name": l.name,
        "growth_value": l.growth_value,
        "discount": l.discount,
        "sort": l.sort,
        "created_at": l.created_at.isoformat() if l.created_at else None,
    }


@router.get("/level/list", summary="等级列表")
async def level_list():
    with get_session() as db:
        try:
            items = db.query(EduMemberLevel).order_by(EduMemberLevel.sort.asc(), EduMemberLevel.id.asc()).all()
            return success([_level_to_dict(l) for l in items])
        except Exception as e:
            logger.error(f"[edu member] level list error: {e}")
            return error(str(e))


@router.post("/level", summary="创建等级", operation_id="edu_platform_member_create_level")
async def create_level(
    name: str = Body(..., min_length=1, max_length=100),
    growth_value: int = Body(0),
    discount: float = Body(1.0),
    sort: int = Body(0),
):
    with get_session() as db:
        try:
            l = EduMemberLevel(name=name, growth_value=growth_value, discount=discount, sort=sort)
            db.add(l)
            db.flush()
            return success({"id": l.id})
        except Exception as e:
            logger.error(f"[edu member] create level error: {e}")
            return error(str(e))


@router.put("/level", summary="更新等级", operation_id="edu_platform_member_update_level")
async def update_level(
    id: int = Body(...),
    name: str | None = Body(None),
    growth_value: int | None = Body(None),
    discount: float | None = Body(None),
    sort: int | None = Body(None),
):
    with get_session() as db:
        try:
            l = db.query(EduMemberLevel).filter(EduMemberLevel.id == id).first()
            if not l:
                return error("等级不存在", "404")
            if name is not None:
                l.name = name
            if growth_value is not None:
                l.growth_value = growth_value
            if discount is not None:
                l.discount = discount
            if sort is not None:
                l.sort = sort
            return success({"id": l.id})
        except Exception as e:
            logger.error(f"[edu member] update level error: {e}")
            return error(str(e))


@router.get("/level", summary="获取等级", operation_id="edu_platform_member_get_level")
async def get_level(id: int = Query(..., description="等级id")):
    with get_session() as db:
        try:
            l = db.query(EduMemberLevel).filter(EduMemberLevel.id == id).first()
            if not l:
                return error("等级不存在", "404")
            return success(_level_to_dict(l))
        except Exception as e:
            logger.error(f"[edu member] get level error: {e}")
            return error(str(e))


@router.delete("/level", summary="删除等级", operation_id="edu_platform_member_delete_level")
async def delete_level(id: int = Query(...)):
    with get_session() as db:
        try:
            l = db.query(EduMemberLevel).filter(EduMemberLevel.id == id).first()
            if not l:
                return error("等级不存在", "404")
            db.delete(l)
            return success()
        except Exception as e:
            logger.error(f"[edu member] delete level error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 批量查询 / 统计 / 注册
# ---------------------------------------------------------------------------


@router.get("/public-api/by-ids", summary="按ID批量查询")
async def by_ids(ids: str = Query(..., description="逗号分隔的id列表")):
    with get_session() as db:
        try:
            id_list = [int(x.strip()) for x in ids.split(",") if x.strip().isdigit()]
            if not id_list:
                return success([])
            items = db.query(EduMember).filter(EduMember.id.in_(id_list)).all()
            return success([_member_to_dict(m) for m in items])
        except Exception as e:
            logger.error(f"[edu member] by ids error: {e}")
            return error(str(e))


@router.get("/statistics", summary="会员统计", operation_id="edu_platform_member_statistics")
async def member_statistics():
    with get_session() as db:
        try:
            total = db.query(EduMember).count()
            active = db.query(EduMember).filter(EduMember.status == 1).count()
            pending = db.query(EduMember).filter(EduMember.status == 0).count()
            sealed = db.query(EduMember).filter(EduMember.status == 2).count()
            return success(
                {
                    "total": total,
                    "active": active,
                    "pending": pending,
                    "sealed": sealed,
                }
            )
        except Exception as e:
            logger.error(f"[edu member] statistics error: {e}")
            return error(str(e))


@router.post("/public-api/register", summary="注册(用户名)", operation_id="edu_platform_member_register")
async def register(
    username: str = Body(..., min_length=1, max_length=100),
    password: str = Body(..., min_length=6),
    nickname: str | None = Body(None),
    mobile: str | None = Body(None),
    email: str | None = Body(None),
):
    with get_session() as db:
        try:
            existing = db.query(EduMember).filter(EduMember.username == username).first()
            if existing:
                return error("用户名已存在", "409")
            m = EduMember(
                username=username,
                password=_hash_password(password),
                nickname=nickname or username,
                mobile=mobile,
                email=email,
                status=1,
            )
            db.add(m)
            db.flush()
            return success({"id": m.id, "username": m.username})
        except Exception as e:
            logger.error(f"[edu member] register error: {e}")
            return error(str(e))


@router.post("/public-api/register/mobile", summary="手机注册")
async def register_mobile(
    mobile: str = Body(..., min_length=1),
    password: str = Body(..., min_length=6),
    code: str = Body(..., description="短信验证码"),
    nickname: str | None = Body(None),
):
    with get_session() as db:
        try:
            existing = db.query(EduMember).filter(EduMember.mobile == mobile).first()
            if existing:
                return error("手机号已注册", "409")
            m = EduMember(
                mobile=mobile,
                username=mobile,
                password=_hash_password(password),
                nickname=nickname or mobile,
                status=1,
            )
            db.add(m)
            db.flush()
            return success({"id": m.id, "mobile": m.mobile})
        except Exception as e:
            logger.error(f"[edu member] register mobile error: {e}")
            return error(str(e))


@router.get("/auth-api/by-id", summary="按ID查询")
async def member_by_id(id: int = Query(..., description="会员id")):
    with get_session() as db:
        try:
            m = db.query(EduMember).filter(EduMember.id == id).first()
            if not m:
                return error("会员不存在", "404")
            return success(_member_to_dict(m))
        except Exception as e:
            logger.error(f"[edu member] by id error: {e}")
            return error(str(e))


@router.get("/auth-api/list", summary="登录用户列表")
async def member_auth_list(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    keyword: str | None = None,
):
    with get_session() as db:
        try:
            q = db.query(EduMember).filter(EduMember.status == 1)
            if keyword:
                q = q.filter(
                    (EduMember.username.like(f"%{keyword}%"))
                    | (EduMember.mobile.like(f"%{keyword}%"))
                    | (EduMember.nickname.like(f"%{keyword}%"))
                )
            total = q.count()
            items = q.order_by(EduMember.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success([_member_to_dict(m) for m in items], total=total, page=page, page_size=limit)
        except Exception as e:
            logger.error(f"[edu member] auth list error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 会员企业列表 / Excel导入 / 删除
# ---------------------------------------------------------------------------


@router.get("/company/list")
async def get_member_company_list(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    name: str | None = None,
):
    """获取会员企业列表"""
    try:
        with get_session() as db:
            q = db.query(EduMember).filter(EduMember.company_id.isnot(None))
            if name:
                q = q.filter(EduMember.nickname.like(f"%{name}%"))
            total = q.count()
            members = q.order_by(EduMember.id.desc()).offset((page - 1) * limit).limit(limit).all()
            companies: dict = {}
            for m in members:
                cid = m.company_id
                if cid not in companies:
                    companies[cid] = {"company_id": cid, "member_count": 0, "members": []}
                companies[cid]["member_count"] += 1
                companies[cid]["members"].append({
                    "id": m.id,
                    "nickname": m.nickname,
                    "mobile": m.mobile,
                    "email": getattr(m, "email", None),
                })
            return success(list(companies.values()), total=len(companies), page=page, page_size=limit)
    except Exception as e:
        logger.error(f"[edu member] company list error: {e}")
        return error(str(e))


@router.post("/import/excel")
async def import_member_excel(file: UploadFile = File(...)):
    """Excel 批量导入会员"""
    try:
        content = await file.read()
        return success(data={"imported": 0, "message": "Excel 导入功能待实现", "file_size": len(content)})
    except Exception as e:
        logger.error(f"[edu member] import excel error: {e}")
        return error(str(e))


@router.delete("/delete")
async def delete_member(id: int = Query(...)):
    """删除会员"""
    try:
        with get_session() as db:
            member = db.query(EduMember).filter(EduMember.id == id).first()
            if not member:
                return error("会员不存在")
            db.delete(member)
            db.commit()
            return success(data={"id": id})
    except Exception as e:
        logger.error(f"[edu member] delete member error: {e}")
        return error(str(e))
