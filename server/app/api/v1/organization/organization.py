"""组织管理"""


from fastapi import APIRouter, Query
from loguru import logger
from sqlalchemy import BigInteger, Column, Index, Integer, String, Text

from app.core.current_user import current_user_id_or_guest
from app.database import Base, get_session
from app.models.base import TimestampMixin
from app.schemas.common import error, success


class Organization(TimestampMixin, Base):
    """组织机构"""

    __tablename__ = "organization"
    __table_args__ = (
        Index("idx_org_pid", "pid"),
    )
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, comment="组织名称")
    short_name = Column(String(50), nullable=True, comment="简称")
    pid = Column(BigInteger, default=0, comment="父级ID")
    code = Column(String(50), nullable=True, comment="组织编码")
    type = Column(String(20), default="company", comment="company/department/team")
    description = Column(Text, nullable=True)
    leader = Column(String(50), nullable=True, comment="负责人")
    leader_phone = Column(String(20), nullable=True)
    sort_order = Column(Integer, default=0)
    status = Column(Integer, default=1, comment="0=禁用 1=启用")
    logo = Column(String(500), nullable=True)
    address = Column(String(500), nullable=True)
    member_count = Column(Integer, default=0)


class OrganizationMember(TimestampMixin, Base):
    """组织成员"""

    __tablename__ = "organization_member"
    __table_args__ = (
        Index("idx_om_org", "org_id"),
        Index("idx_om_user", "user_id"),
    )
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    org_id = Column(BigInteger, nullable=False)
    user_id = Column(String(64), nullable=False)
    user_name = Column(String(100), nullable=True)
    role = Column(String(20), default="member", comment="owner/admin/member")
    position = Column(String(50), nullable=True, comment="职位")
    status = Column(Integer, default=1)


router = APIRouter()


def _uid() -> str:
    return current_user_id_or_guest()

@router.get("/list", summary="组织列表")
async def list_organizations(pid: int | None = None, status: int | None = None, keyword: str | None = None):
    with get_session() as db:
        try:
            q = db.query(Organization)
            if pid is not None:
                q = q.filter(Organization.pid == pid)
            if status is not None:
                q = q.filter(Organization.status == status)
            if keyword:
                q = q.filter(Organization.name.like(f"%{keyword}%"))
            items = q.order_by(Organization.sort_order.asc(), Organization.id.asc()).all()
            return success(
                [
                    {
                        "id": o.id,
                        "name": o.name,
                        "short_name": o.short_name,
                        "pid": o.pid,
                        "code": o.code,
                        "type": o.type,
                        "description": o.description,
                        "leader": o.leader,
                        "leader_phone": o.leader_phone,
                        "logo": o.logo,
                        "address": o.address,
                        "sort_order": o.sort_order,
                        "status": o.status,
                        "member_count": o.member_count,
                    }
                    for o in items
                ]
            )
        except Exception as e:
            logger.error(f"org list error: {e}")
            return error(str(e))


@router.get("/tree", summary="组织树")
async def org_tree():
    with get_session() as db:
        try:
            items = (
                db.query(Organization).filter(Organization.status == 1).order_by(Organization.sort_order.asc()).all()
            )
            tree = []
            id_map = {0: {"id": 0, "name": "根", "children": []}}
            for o in items:
                node = {
                    "id": o.id,
                    "pid": o.pid,
                    "name": o.name,
                    "short_name": o.short_name,
                    "type": o.type,
                    "leader": o.leader,
                    "member_count": o.member_count,
                    "children": [],
                }
                id_map[o.id] = node
            for o in items:
                if o.pid == 0:
                    tree.append(id_map[o.id])
                else:
                    parent = id_map.get(o.pid)
                    if parent:
                        parent["children"].append(id_map[o.id])
            return success(tree)
        except Exception as e:
            logger.error(f"org tree error: {e}")
            return error(str(e))


@router.get("/{oid}", summary="组织详情")
async def get_organization(oid: int):
    with get_session() as db:
        try:
            o = db.query(Organization).filter(Organization.id == oid).first()
            if not o:
                return error("组织不存在", "404")
            return success(
                {
                    "id": o.id,
                    "name": o.name,
                    "short_name": o.short_name,
                    "pid": o.pid,
                    "code": o.code,
                    "type": o.type,
                    "description": o.description,
                    "leader": o.leader,
                    "leader_phone": o.leader_phone,
                    "logo": o.logo,
                    "address": o.address,
                    "sort_order": o.sort_order,
                    "status": o.status,
                    "member_count": o.member_count,
                }
            )
        except Exception as e:
            logger.error(f"org get error: {e}")
            return error(str(e))


@router.post("", summary="创建组织")
async def create_organization(
    name: str = Query(..., min_length=1, max_length=100),
    pid: int = 0,
    type: str = "company",
    short_name: str | None = None,
    code: str | None = None,
    description: str | None = None,
    leader: str | None = None,
    leader_phone: str | None = None,
    logo: str | None = None,
    address: str | None = None,
    sort_order: int = 0,
):
    with get_session() as db:
        try:
            o = Organization(
                name=name,
                short_name=short_name,
                pid=pid,
                code=code,
                type=type,
                description=description,
                leader=leader,
                leader_phone=leader_phone,
                logo=logo,
                address=address,
                sort_order=sort_order,
                status=1,
                member_count=0,
            )
            db.add(o)
            db.flush()
            return success({"id": o.id})
        except Exception as e:
            logger.error(f"org create error: {e}")
            return error(str(e))


@router.put("/{oid}", summary="修改组织")
async def update_organization(
    oid: int,
    name: str | None = None,
    short_name: str | None = None,
    description: str | None = None,
    leader: str | None = None,
    leader_phone: str | None = None,
    status: int | None = None,
    sort_order: int | None = None,
):
    with get_session() as db:
        try:
            o = db.query(Organization).filter(Organization.id == oid).first()
            if not o:
                return error("组织不存在", "404")
            if name:
                o.name = name
            if short_name is not None:
                o.short_name = short_name
            if description is not None:
                o.description = description
            if leader:
                o.leader = leader
            if leader_phone:
                o.leader_phone = leader_phone
            if status is not None:
                o.status = status
            if sort_order is not None:
                o.sort_order = sort_order
            return success()
        except Exception as e:
            logger.error(f"org update error: {e}")
            return error(str(e))


@router.delete("/{oid}", summary="删除组织")
async def delete_organization(oid: int):
    with get_session() as db:
        try:
            o = db.query(Organization).filter(Organization.id == oid).first()
            if not o:
                return error("组织不存在", "404")
            has_child = db.query(Organization).filter(Organization.pid == oid).count() > 0
            if has_child:
                return error("存在子组织,无法删除", "400")
            db.query(OrganizationMember).filter(OrganizationMember.org_id == oid).delete()
            db.delete(o)
            return success()
        except Exception as e:
            logger.error(f"org delete error: {e}")
            return error(str(e))


@router.get("/{oid}/members", summary="组织成员")
async def list_members(oid: int, page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100)):
    with get_session() as db:
        try:
            q = db.query(OrganizationMember).filter(OrganizationMember.org_id == oid, OrganizationMember.status == 1)
            total = q.count()
            items = q.order_by(OrganizationMember.id.asc()).offset((page - 1) * limit).limit(limit).all()
            return success(
                [
                    {
                        "id": m.id,
                        "user_id": m.user_id,
                        "user_name": m.user_name,
                        "role": m.role,
                        "position": m.position,
                    }
                    for m in items
                ],
                total=total,
            )
        except Exception as e:
            logger.error(f"org members error: {e}")
            return error(str(e))


@router.post("/{oid}/member", summary="添加成员")
async def add_member(oid: int, user_id: str = Query(...), role: str = "member", position: str | None = None):
    with get_session() as db:
        try:
            exist = (
                db.query(OrganizationMember)
                .filter(OrganizationMember.org_id == oid, OrganizationMember.user_id == user_id)
                .first()
            )
            if exist:
                return error("成员已存在", "400")
            db.add(
                OrganizationMember(
                    org_id=oid,
                    user_id=user_id,
                    user_name="匿名用户",
                    role=role,
                    position=position,
                    status=1,
                )
            )
            db.query(Organization).filter(Organization.id == oid).update(
                {Organization.member_count: Organization.member_count + 1}
            )
            return success()
        except Exception as e:
            logger.error(f"org add member error: {e}")
            return error(str(e))


@router.delete("/{oid}/member/{user_id}", summary="移除成员")
async def remove_member(oid: int, user_id: str):
    with get_session() as db:
        try:
            m = (
                db.query(OrganizationMember)
                .filter(OrganizationMember.org_id == oid, OrganizationMember.user_id == user_id)
                .first()
            )
            if not m:
                return error("成员不存在", "404")
            db.delete(m)
            db.query(Organization).filter(Organization.id == oid).update(
                {Organization.member_count: Organization.member_count - 1}
            )
            return success()
        except Exception as e:
            logger.error(f"org remove member error: {e}")
            return error(str(e))
