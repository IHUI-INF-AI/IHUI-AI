"""会员服务 - 13 个新 model (EduMember / EduMemberCompany / Tag / Post / Group / CheckIn / Follow 等)."""
from __future__ import annotations

import logging
from typing import Any

from app.database import get_session
from app.models.member_models import (
    EduCheckIn,
    EduCheckInRecord,
    EduFollow,
    EduMember,
    EduMemberCompany,
    EduMemberCompanyMemberRelation,
    EduMemberCompanyType,
    EduMemberGroup,
    EduMemberGroupMemberRelation,
    EduMemberLevel,
    EduMemberLevelRelation,
    EduMemberPost,
    EduMemberPostMemberRelation,
    EduMemberTag,
    EduMemberTagMemberRelation,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# EduMember
# ---------------------------------------------------------------------------

def get_edu_member(edu_id: str) -> EduMember | None:
    with get_session() as db:
        return db.query(EduMember).filter(EduMember.id == edu_id).first()


def get_edu_member_by_mobile(mobile: str) -> EduMember | None:
    with get_session() as db:
        return db.query(EduMember).filter(EduMember.mobile == mobile).first()


def get_edu_member_by_openid(open_id: str) -> EduMember | None:
    with get_session() as db:
        return db.query(EduMember).filter(EduMember.wechat_open_id == open_id).first()


def create_edu_member(
    name: str,
    mobile: str | None = None,
    open_id: str | None = None,
    union_id: str | None = None,
    company_id: str | None = None,
    **kwargs: Any,
) -> EduMember:
    with get_session() as db:
        m = EduMember(
            name=name,
            mobile=mobile,
            wechat_open_id=open_id,
            wechat_union_id=union_id,
            company_id=company_id,
            status=1,
            **{k: v for k, v in kwargs.items() if k in {c.name for c in EduMember.__table__.columns}},
        )
        db.add(m)
        db.flush()
        db.refresh(m)
        return m


# ---------------------------------------------------------------------------
# EduMemberCompany
# ---------------------------------------------------------------------------

def create_company(
    name: str,
    company_type_id: str | None = None,
    **kwargs: Any,
) -> EduMemberCompany:
    with get_session() as db:
        c = EduMemberCompany(
            name=name,
            company_type_id=company_type_id,
            status=1,
            **{k: v for k, v in kwargs.items() if k in {c.name for c in EduMemberCompany.__table__.columns}},
        )
        db.add(c)
        db.flush()
        db.refresh(c)
        return c


def add_member_to_company(member_id: str, company_id: str) -> EduMemberCompanyMemberRelation:
    with get_session() as db:
        r = EduMemberCompanyMemberRelation(
            member_id=member_id, member_company_id=company_id
        )
        db.add(r)
        return r


def list_member_companies(member_id: str) -> list[EduMemberCompany]:
    with get_session() as db:
        return (
            db.query(EduMemberCompany)
            .join(EduMemberCompanyMemberRelation, EduMemberCompanyMemberRelation.member_company_id == EduMemberCompany.id)
            .filter(EduMemberCompanyMemberRelation.member_id == member_id)
            .all()
        )


# ---------------------------------------------------------------------------
# EduMemberTag
# ---------------------------------------------------------------------------

def create_tag(name: str) -> EduMemberTag:
    with get_session() as db:
        t = EduMemberTag(name=name)
        db.add(t)
        db.flush()
        db.refresh(t)
        return t


def tag_member(member_id: str, tag_id: str) -> EduMemberTagMemberRelation:
    with get_session() as db:
        r = EduMemberTagMemberRelation(member_id=member_id, member_tag_id=tag_id)
        db.add(r)
        return r


def list_member_tags(member_id: str) -> list[EduMemberTag]:
    with get_session() as db:
        return (
            db.query(EduMemberTag)
            .join(EduMemberTagMemberRelation, EduMemberTagMemberRelation.member_tag_id == EduMemberTag.id)
            .filter(EduMemberTagMemberRelation.member_id == member_id)
            .all()
        )


# ---------------------------------------------------------------------------
# EduMemberPost / Group
# ---------------------------------------------------------------------------

def create_post(name: str) -> EduMemberPost:
    with get_session() as db:
        p = EduMemberPost(name=name, status=1)
        db.add(p)
        return p


def assign_post(member_id: str, post_id: str) -> EduMemberPostMemberRelation:
    with get_session() as db:
        r = EduMemberPostMemberRelation(member_id=member_id, member_post_id=post_id)
        db.add(r)
        return r


def create_group(name: str) -> EduMemberGroup:
    with get_session() as db:
        g = EduMemberGroup(name=name, status=1)
        db.add(g)
        return g


def add_to_group(member_id: str, group_id: str) -> EduMemberGroupMemberRelation:
    with get_session() as db:
        r = EduMemberGroupMemberRelation(member_id=member_id, member_group_id=group_id)
        db.add(r)
        return r


# ---------------------------------------------------------------------------
# EduMemberLevel
# ---------------------------------------------------------------------------

def create_level(name: str, conditions: int = 0) -> EduMemberLevel:
    with get_session() as db:
        lv = EduMemberLevel(name=name, conditions=conditions)
        db.add(lv)
        return lv


def grant_level(member_id: str, level_id: str) -> EduMemberLevelRelation:
    with get_session() as db:
        r = EduMemberLevelRelation(member_id=member_id, level_id=level_id)
        db.add(r)
        return r


# ---------------------------------------------------------------------------
# EduCheckIn / EduCheckInRecord
# ---------------------------------------------------------------------------

def do_checkin(member_id: str) -> tuple[EduCheckIn, EduCheckInRecord]:
    """会员签到, 返回 (累计记录, 当次记录)."""
    with get_session() as db:
        ci = db.query(EduCheckIn).filter(EduCheckIn.member_id == member_id).first()
        if not ci:
            ci = EduCheckIn(member_id=member_id, continuous_num=1)
            db.add(ci)
        else:
            ci.continuous_num = (ci.continuous_num or 0) + 1
        rec = EduCheckInRecord(member_id=member_id, type=0)
        db.add(rec)
        return ci, rec


def list_checkin_records(member_id: str, limit: int = 30) -> list[EduCheckInRecord]:
    with get_session() as db:
        return (
            db.query(EduCheckInRecord)
            .filter(EduCheckInRecord.member_id == member_id)
            .order_by(EduCheckInRecord.created_at.desc())
            .limit(limit)
            .all()
        )


# ---------------------------------------------------------------------------
# EduFollow
# ---------------------------------------------------------------------------

def follow_member(member_id: str, follow_member_id: str) -> EduFollow:
    with get_session() as db:
        existing = (
            db.query(EduFollow)
            .filter(
                EduFollow.member_id == member_id,
                EduFollow.follow_member_id == follow_member_id,
            )
            .first()
        )
        if existing:
            existing.status = 1
            return existing
        f = EduFollow(member_id=member_id, follow_member_id=follow_member_id, status=1)
        db.add(f)
        return f


def unfollow_member(member_id: str, follow_member_id: str) -> bool:
    with get_session() as db:
        f = (
            db.query(EduFollow)
            .filter(
                EduFollow.member_id == member_id,
                EduFollow.follow_member_id == follow_member_id,
            )
            .first()
        )
        if not f:
            return False
        f.status = 0
        return True


def list_following(member_id: str) -> list[EduFollow]:
    with get_session() as db:
        return (
            db.query(EduFollow)
            .filter(EduFollow.member_id == member_id, EduFollow.status == 1)
            .all()
        )
