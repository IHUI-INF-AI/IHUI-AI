"""edu_circle service - Circle/community platform (migrated from ihui-ai-edu-circle-service).

Source (junction access): G:\\IHUI-AI\\storage\\edu-assets\\java-source\\ihui-ai-edu-circle-service\\
"""

from __future__ import annotations

from app.utils.datetime_helper import utcnow

from sqlalchemy import and_, desc, func, or_, select

from app.models.edu_models import EduCircle, EduCircleMember, EduCirclePost
from app.services.edu_base import (
    EduPermissionError,
    EduValidationError,
    paginate,
    get_or_404,
)


# ============================================================================
# Circle CRUD (迁移自 CircleController + CircleService)
# ============================================================================

def create_circle(
    db: Session,
    owner_id: int,
    name: str,
    description: Optional[str] = None,
    cover: Optional[str] = None,
    category: Optional[str] = None,
    is_public: bool = True,
) -> EduCircle:
    """Create a new circle. Owner automatically added as 'owner' member.

    2026-06-25 字段对齐修复: category→category_id, is_public→status, member_count→member_num, post_count→post_num
    """
    if not name or len(name) > 128:
        raise EduValidationError("name must be 1-128 chars")
    circle = EduCircle(
        owner_id=owner_id,
        name=name,
        description=description,
        cover=cover,
        category_id=category,
        status=1 if is_public else 0,
        member_num=1,
        post_num=0,
    )
    db.add(circle)
    db.flush()
    # Auto-add owner as member
    member = EduCircleMember(
        circle_id=circle.id,
        user_id=owner_id,
        role="owner",
    )
    db.add(member)
    db.flush()
    db.refresh(circle)
    return circle


def update_circle(
    db: Session, circle_id: int, user_id: int, **fields
) -> EduCircle:
    """Update circle. Only the owner can update."""
    c = get_or_404(db, EduCircle, circle_id, "circle")
    if c.owner_id != user_id:
        raise EduPermissionError("only the owner can update the circle")
    for k, v in fields.items():
        if v is not None and hasattr(c, k):
            setattr(c, k, v)
    db.flush()
    db.refresh(c)
    return c


def delete_circle(db: Session, circle_id: int, user_id: int) -> bool:
    """Soft-delete circle. Only the owner can delete."""
    c = get_or_404(db, EduCircle, circle_id, "circle")
    if c.owner_id != user_id:
        raise EduPermissionError("only the owner can delete the circle")
    c.is_deleted = True
    c.deleted_at = utcnow()
    db.flush()
    return True


def get_circle(db: Session, circle_id: int) -> EduCircle:
    return get_or_404(db, EduCircle, circle_id, "circle")


def list_circles(
    db: Session,
    page: int = 1,
    size: int = 20,
    category: Optional[str] = None,
    is_public: Optional[bool] = None,
    keyword: Optional[str] = None,
    order_by: str = "latest",  # latest/hot
) -> Tuple[List[EduCircle], int]:
    """List circles with optional filters.

    2026-06-25 字段对齐修复: Circle.category→category_id, Circle.is_public→status==1,
    Circle.username→name, Circle.member_count→member_num, Circle.post_count→post_num
    """
    filters = []
    if category:
        filters.append(EduCircle.category_id == category)
    if is_public is not None:
        filters.append(EduCircle.status == (1 if is_public else 0))
    if keyword:
        kw = f"%{keyword}%"
        filters.append(
            or_(
                EduCircle.name.ilike(kw),
                EduCircle.description.ilike(kw),
            )
        )
    if order_by == "hot":
        order = desc(EduCircle.member_num + EduCircle.post_num * 2)
    else:
        order = desc(EduCircle.created_at)
    return paginate(db, EduCircle, page=page, size=size, filters=filters, order_by=order)


# ============================================================================
# Member CRUD (迁移自 CircleMemberController + CircleMemberService)
# ============================================================================

def join_circle(db: Session, circle_id: int, user_id: int) -> EduCircleMember:
    """Join a circle. Idempotent (returns existing membership if already joined).

    2026-06-25 字段对齐修复: EduCircleMember.uuid→user_id, c.member_count→c.member_num
    """
    existing = db.execute(
        select(EduCircleMember).where(
            and_(
                EduCircleMember.circle_id == circle_id,
                EduCircleMember.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if existing:
        return existing
    member = EduCircleMember(circle_id=circle_id, user_id=user_id, role="member")
    db.add(member)
    # Increment member_num
    c = db.get(EduCircle, circle_id)
    if c:
        c.member_num = (c.member_num or 0) + 1
    db.flush()
    db.refresh(member)
    return member


def leave_circle(db: Session, circle_id: int, user_id: int) -> bool:
    """Leave a circle. Owner cannot leave (must transfer ownership first).

    2026-06-25 字段对齐修复: EduCircleMember.uuid→user_id, c.member_count→c.member_num
    """
    c = db.get(EduCircle, circle_id)
    if c and c.owner_id == user_id:
        raise EduPermissionError("owner cannot leave the circle (transfer ownership first)")
    member = db.execute(
        select(EduCircleMember).where(
            and_(
                EduCircleMember.circle_id == circle_id,
                EduCircleMember.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if not member:
        return False
    db.delete(member)
    if c and c.member_num and c.member_num > 0:
        c.member_num -= 1
    db.flush()
    return True


def list_members(
    db: Session, circle_id: int, page: int = 1, size: int = 20
) -> Tuple[List[EduCircleMember], int]:
    return paginate(
        db, EduCircleMember, page=page, size=size,
        filters=[EduCircleMember.circle_id == circle_id],
    )


def is_member(db: Session, circle_id: int, user_id: int) -> bool:
    """Check whether user is a member of the circle.

    2026-06-25 字段对齐修复: EduCircleMember.uuid→user_id
    """
    return db.execute(
        select(func.count(EduCircleMember.id)).where(
            and_(
                EduCircleMember.circle_id == circle_id,
                EduCircleMember.user_id == user_id,
            )
        )
    ).scalar() > 0


# ============================================================================
# Post CRUD (迁移自 PostController + PostService)
# ============================================================================

def create_post(
    db: Session,
    circle_id: int,
    user_id: int,
    content: str,
    images: Optional[List[str]] = None,
) -> EduCirclePost:
    """Post to a circle. User must be a member (unless circle is public, then anyone).

    2026-06-25 字段对齐修复: c.is_public→c.status==1, like_count→like_num,
    comment_count→comment_num, c.post_count→c.post_num
    """
    if not content:
        raise EduValidationError("content is required")
    # Check membership or public access
    c = get_or_404(db, EduCircle, circle_id, "circle")
    if c.status != 1 and not is_member(db, circle_id, user_id):
        raise EduPermissionError("must be a member to post in private circles")
    images_str = ",".join(images) if images else None
    post = EduCirclePost(
        circle_id=circle_id,
        user_id=user_id,
        content=content,
        images=images_str,
        like_num=0,
        comment_num=0,
    )
    db.add(post)
    db.flush()
    c.post_num = (c.post_num or 0) + 1
    db.flush()
    db.refresh(post)
    return post


def delete_post(db: Session, post_id: int, user_id: int) -> bool:
    """Delete a post. Author or circle owner can delete.

    2026-06-25 字段对齐修复: c.post_count→c.post_num
    """
    p = get_or_404(db, EduCirclePost, post_id, "post")
    c = db.get(EduCircle, p.circle_id)
    if p.user_id != user_id and (not c or c.owner_id != user_id):
        raise EduPermissionError("only the author or circle owner can delete")
    circle_id = p.circle_id
    db.delete(p)
    if c and c.post_num and c.post_num > 0:
        c.post_num -= 1
    db.flush()
    return True


def list_posts(
    db: Session,
    circle_id: int,
    page: int = 1,
    size: int = 20,
    order_by: str = "latest",
) -> Tuple[List[EduCirclePost], int]:
    filters = [EduCirclePost.circle_id == circle_id]
    if order_by == "hot":
        order = desc(EduCirclePost.like_num + EduCirclePost.comment_num * 2)
    else:
        order = desc(EduCirclePost.created_at)
    items, total = paginate(
        db, EduCirclePost, page=page, size=size, filters=filters, order_by=order
    )
    return items, total


def like_post(db: Session, post_id: int) -> int:
    """Increment like count.

    2026-06-25 字段对齐修复: p.like_count→p.like_num
    """
    p = get_or_404(db, EduCirclePost, post_id, "post")
    p.like_num = (p.like_num or 0) + 1
    db.flush()
    return p.like_num


def get_user_circles(
    db: Session, user_id: int, page: int = 1, size: int = 20
) -> Tuple[List[EduCircle], int]:
    """Get circles the user has joined.

    2026-06-25 字段对齐修复: EduCircleMember.uuid→user_id
    """
    return paginate(
        db, EduCircle, page=page, size=size,
        filters=[EduCircle.id.in_(
            select(EduCircleMember.circle_id).where(EduCircleMember.user_id == user_id)
        )],
    )
