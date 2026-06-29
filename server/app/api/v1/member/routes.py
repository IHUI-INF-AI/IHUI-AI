"""企业会员模块 - 企业/分组/等级 CRUD"""

from fastapi import APIRouter, Depends, Query
from loguru import logger
from pydantic import BaseModel, Field

from app.database import get_session
from app.models.member_models import MemberCompany, MemberGroup, MemberLevel
from app.schemas.common import error, success


class MemberLevelCreateRequest(BaseModel):
    description: str = Field(..., max_length=2000)


router = APIRouter()


def _company_to_dict(c: MemberCompany) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "image": c.image,
        "mobile": c.mobile,
        "email": c.email,
        "status": c.status,
        "sort_order": c.sort_order,
        "company_type_id": c.company_type_id,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


def _group_to_dict(g: MemberGroup) -> dict:
    return {
        "id": g.id,
        "name": g.name,
        "sort_order": g.sort_order,
        "status": g.status,
        "created_at": g.created_at.isoformat() if g.created_at else None,
    }


def _level_to_dict(l: MemberLevel) -> dict:
    return {
        "id": l.id,
        "name": l.name,
        "description": l.description,
        "conditions": l.conditions,
        "created_at": l.created_at.isoformat() if l.created_at else None,
    }


# ============ 会员公司 ============


@router.get("/company/list", summary="会员公司列表")
async def list_companies(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    keyword: str | None = None,
    status: str | None = None,
    company_type_id: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(MemberCompany)
            if keyword:
                q = q.filter(MemberCompany.name.like(f"%{keyword}%"))
            if status:
                q = q.filter(MemberCompany.status == status)
            if company_type_id:
                q = q.filter(MemberCompany.company_type_id == company_type_id)
            total = q.count()
            items = q.order_by(MemberCompany.sort_order.desc(), MemberCompany.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success([_company_to_dict(i) for i in items], total=total)
        except Exception as e:
            logger.error(f"member company list error: {e}")
            return error(str(e))


@router.get("/company/{cid}", summary="会员公司详情")
async def get_company(cid: int):
    with get_session() as db:
        try:
            c = db.query(MemberCompany).filter(MemberCompany.id == cid).first()
            if not c:
                return error("公司不存在", "404")
            return success(_company_to_dict(c))
        except Exception as e:
            logger.error(f"member company get error: {e}")
            return error(str(e))


@router.post("/company", summary="创建会员公司")
async def create_company(
    name: str = Query(..., min_length=1, max_length=100),
    image: str | None = None,
    mobile: str = "",
    email: str = "",
    status: str = "normal",
    sort_order: int = 0,
    company_type_id: int | None = None,
):
    with get_session() as db:
        try:
            c = MemberCompany(
                name=name,
                image=image or "",
                mobile=mobile,
                email=email,
                status=status,
                sort_order=sort_order,
                company_type_id=company_type_id,
            )
            db.add(c)
            db.flush()
            return success({"id": c.id})
        except Exception as e:
            logger.error(f"member company create error: {e}")
            return error(str(e))


@router.put("/company/{cid}", summary="修改会员公司")
async def update_company(
    cid: int,
    name: str | None = None,
    image: str | None = None,
    mobile: str | None = None,
    email: str | None = None,
    status: str | None = None,
    sort_order: int | None = None,
    company_type_id: int | None = None,
):
    with get_session() as db:
        try:
            c = db.query(MemberCompany).filter(MemberCompany.id == cid).first()
            if not c:
                return error("公司不存在", "404")
            if name is not None:
                c.name = name
            if image is not None:
                c.image = image
            if mobile is not None:
                c.mobile = mobile
            if email is not None:
                c.email = email
            if status is not None:
                c.status = status
            if sort_order is not None:
                c.sort_order = sort_order
            if company_type_id is not None:
                c.company_type_id = company_type_id
            return success({"id": c.id})
        except Exception as e:
            logger.error(f"member company update error: {e}")
            return error(str(e))


@router.delete("/company/{cid}", summary="删除会员公司")
async def delete_company(cid: int):
    with get_session() as db:
        try:
            c = db.query(MemberCompany).filter(MemberCompany.id == cid).first()
            if not c:
                return error("公司不存在", "404")
            db.delete(c)
            return success()
        except Exception as e:
            logger.error(f"member company delete error: {e}")
            return error(str(e))


# ============ 会员分组 ============


@router.get("/group/list", summary="会员分组列表")
async def list_groups(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    keyword: str | None = None,
    status: str | None = None,
):
    with get_session() as db:
        try:
            q = db.query(MemberGroup)
            if keyword:
                q = q.filter(MemberGroup.name.like(f"%{keyword}%"))
            if status:
                q = q.filter(MemberGroup.status == status)
            total = q.count()
            items = q.order_by(MemberGroup.sort_order.desc(), MemberGroup.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success([_group_to_dict(i) for i in items], total=total)
        except Exception as e:
            logger.error(f"member group list error: {e}")
            return error(str(e))


@router.get("/group/{gid}", summary="会员分组详情")
async def get_group(gid: int):
    with get_session() as db:
        try:
            g = db.query(MemberGroup).filter(MemberGroup.id == gid).first()
            if not g:
                return error("分组不存在", "404")
            return success(_group_to_dict(g))
        except Exception as e:
            logger.error(f"member group get error: {e}")
            return error(str(e))


@router.post("/group", summary="创建会员分组")
async def create_group(
    name: str = Query(..., min_length=1, max_length=100),
    sort_order: int = 0,
    status: str = "enable",
):
    with get_session() as db:
        try:
            g = MemberGroup(name=name, sort_order=sort_order, status=status)
            db.add(g)
            db.flush()
            return success({"id": g.id})
        except Exception as e:
            logger.error(f"member group create error: {e}")
            return error(str(e))


@router.put("/group/{gid}", summary="修改会员分组")
async def update_group(
    gid: int,
    name: str | None = None,
    sort_order: int | None = None,
    status: str | None = None,
):
    with get_session() as db:
        try:
            g = db.query(MemberGroup).filter(MemberGroup.id == gid).first()
            if not g:
                return error("分组不存在", "404")
            if name is not None:
                g.name = name
            if sort_order is not None:
                g.sort_order = sort_order
            if status is not None:
                g.status = status
            return success({"id": g.id})
        except Exception as e:
            logger.error(f"member group update error: {e}")
            return error(str(e))


@router.delete("/group/{gid}", summary="删除会员分组")
async def delete_group(gid: int):
    with get_session() as db:
        try:
            g = db.query(MemberGroup).filter(MemberGroup.id == gid).first()
            if not g:
                return error("分组不存在", "404")
            db.delete(g)
            return success()
        except Exception as e:
            logger.error(f"member group delete error: {e}")
            return error(str(e))


# ============ 会员等级 ============


@router.get("/level/list", summary="会员等级列表")
async def list_levels(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    with get_session() as db:
        try:
            q = db.query(MemberLevel)
            total = q.count()
            items = q.order_by(MemberLevel.id.asc()).offset((page - 1) * limit).limit(limit).all()
            return success([_level_to_dict(i) for i in items], total=total)
        except Exception as e:
            logger.error(f"member level list error: {e}")
            return error(str(e))


@router.get("/level/{lid}", summary="会员等级详情")
async def get_level(lid: int):
    with get_session() as db:
        try:
            l = db.query(MemberLevel).filter(MemberLevel.id == lid).first()
            if not l:
                return error("等级不存在", "404")
            return success(_level_to_dict(l))
        except Exception as e:
            logger.error(f"member level get error: {e}")
            return error(str(e))


@router.post("/level", summary="创建会员等级")
async def create_level(
    name: str = Query(..., min_length=1, max_length=100),
    payload: MemberLevelCreateRequest = Depends(),
    conditions: int = Query(..., ge=0),
):
    with get_session() as db:
        try:
            l = MemberLevel(name=name, description=payload.description, conditions=conditions)
            db.add(l)
            db.flush()
            return success({"id": l.id})
        except Exception as e:
            logger.error(f"member level create error: {e}")
            return error(str(e))


@router.put("/level/{lid}", summary="修改会员等级")
async def update_level(
    lid: int,
    name: str | None = None,
    description: str | None = None,
    conditions: int | None = None,
):
    with get_session() as db:
        try:
            l = db.query(MemberLevel).filter(MemberLevel.id == lid).first()
            if not l:
                return error("等级不存在", "404")
            if name is not None:
                l.name = name
            if description is not None:
                l.description = description
            if conditions is not None:
                l.conditions = conditions
            return success({"id": l.id})
        except Exception as e:
            logger.error(f"member level update error: {e}")
            return error(str(e))


@router.delete("/level/{lid}", summary="删除会员等级")
async def delete_level(lid: int):
    with get_session() as db:
        try:
            l = db.query(MemberLevel).filter(MemberLevel.id == lid).first()
            if not l:
                return error("等级不存在", "404")
            db.delete(l)
            return success()
        except Exception as e:
            logger.error(f"member level delete error: {e}")
            return error(str(e))
