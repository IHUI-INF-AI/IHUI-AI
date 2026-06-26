"""Edu Edu-Circle router - /api/v1/edu/circle

Circle/community endpoints (migrated from ihui-ai-edu-circle-service).
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_session


def _get_db():
    """FastAPI dependency wrapper for app.database.get_session."""
    with get_session() as db:
        yield db


from app.core.current_user import get_current_user_id

from app.schemas.common import success

router = APIRouter()


@router.post("/circles", summary="Create a new circle")
def create_circle(
    payload: dict,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(_get_db),
):
    from app.services.edu_circle import create_circle
    c = create_circle(
        db, owner_id=user_id, name=payload.get("name"),
        description=payload.get("description"), cover=payload.get("cover"),
        category=payload.get("category"), is_public=payload.get("is_public", True),
    )
    return success(data={
        "id": c.id, "owner_id": c.owner_id, "name": c.name,
        "description": c.description, "category": c.category,
        "is_public": c.is_public, "member_count": c.member_count,
        "created_at": c.created_at,
    })


@router.get("/circles", summary="List circles (paginated)")
def list_circles(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    category: Optional[str] = Query(None),
    is_public: Optional[bool] = Query(None),
    keyword: Optional[str] = Query(None),
    order_by: str = Query("latest", pattern="^(latest|hot)$"),
    db: Session = Depends(_get_db),
):
    from app.services.edu_circle import list_circles
    items, total = list_circles(
        db, page=page, size=size, category=category, is_public=is_public,
        keyword=keyword, order_by=order_by,
    )
    return success(data={
        "items": [
            {
                "id": c.id, "owner_id": c.owner_id, "name": c.name,
                "description": c.description, "category": c.category,
                "cover": c.cover, "is_public": c.is_public,
                "member_count": c.member_count, "post_count": c.post_count,
                "created_at": c.created_at,
            } for c in items
        ],
        "total": total, "page": page, "size": size,
    })


@router.get("/circles/{circle_id}", summary="Get circle detail")
def get_circle(circle_id: int, db: Session = Depends(_get_db)):
    from app.services.edu_circle import get_circle
    c = get_circle(db, circle_id)
    return success(data={
        "id": c.id, "owner_id": c.owner_id, "name": c.name,
        "description": c.description, "category": c.category,
        "cover": c.cover, "is_public": c.is_public,
        "member_count": c.member_count, "post_count": c.post_count,
        "created_at": c.created_at,
    })


@router.put("/circles/{circle_id}", summary="Update circle (owner only)")
def update_circle(
    circle_id: int, payload: dict,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(_get_db),
):
    from app.services.edu_circle import update_circle
    name = payload.get("name")
    description = payload.get("description")
    cover = payload.get("cover")
    c = update_circle(db, circle_id, user_id=user_id, name=name, description=description, cover=cover)
    return success(data={"id": c.id, "name": c.name})


@router.delete("/circles/{circle_id}", summary="Delete circle (owner only)")
def delete_circle(
    circle_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(_get_db),
):
    from app.services.edu_circle import delete_circle
    ok = delete_circle(db, circle_id, user_id=user_id)
    return success(data={"deleted": ok})


@router.post("/circles/{circle_id}/join", summary="Join a circle")
def join_circle(
    circle_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(_get_db),
):
    from app.services.edu_circle import join_circle
    m = join_circle(db, circle_id, user_id=user_id)
    return success(data={"circle_id": m.circle_id, "user_id": m.user_id, "role": m.role})


@router.post("/circles/{circle_id}/leave", summary="Leave a circle")
def leave_circle(
    circle_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(_get_db),
):
    from app.services.edu_circle import leave_circle
    ok = leave_circle(db, circle_id, user_id=user_id)
    return success(data={"left": ok})


@router.get("/circles/{circle_id}/members", summary="List circle members")
def list_members(
    circle_id: int,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(_get_db),
):
    from app.services.edu_circle import list_members
    items, total = list_members(db, circle_id, page=page, size=size)
    return success(data={
        "items": [{"id": m.id, "user_id": m.user_id, "role": m.role, "joined_at": m.joined_at} for m in items],
        "total": total, "page": page, "size": size,
    })


@router.post("/circles/{circle_id}/posts", summary="Create a post in a circle")
def create_post(
    circle_id: int, payload: dict,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(_get_db),
):
    from app.services.edu_circle import create_post
    p = create_post(
        db, circle_id=circle_id, user_id=user_id,
        content=payload.get("content"),
        images=payload.get("images"),
    )
    return success(data={
        "id": p.id, "circle_id": p.circle_id, "user_id": p.user_id,
        "content": p.content, "images": p.images,
        "like_count": p.like_count, "comment_count": p.comment_count,
        "created_at": p.created_at,
    })


@router.get("/circles/{circle_id}/posts", summary="List posts in a circle")
def list_posts(
    circle_id: int,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    order_by: str = Query("latest", pattern="^(latest|hot)$"),
    db: Session = Depends(_get_db),
):
    from app.services.edu_circle import list_posts
    items, total = list_posts(db, circle_id, page=page, size=size, order_by=order_by)
    return success(data={
        "items": [
            {
                "id": p.id, "circle_id": p.circle_id, "user_id": p.user_id,
                "content": p.content, "images": p.images,
                "like_count": p.like_count, "comment_count": p.comment_count,
                "created_at": p.created_at,
            } for p in items
        ],
        "total": total, "page": page, "size": size,
    })


@router.delete("/posts/{post_id}", summary="Delete post (author or circle owner)")
def delete_post(
    post_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(_get_db),
):
    from app.services.edu_circle import delete_post
    ok = delete_post(db, post_id, user_id=user_id)
    return success(data={"deleted": ok})


@router.post("/posts/{post_id}/like", summary="Like a post")
def like_post(post_id: int, db: Session = Depends(_get_db)):
    from app.services.edu_circle import like_post
    new_count = like_post(db, post_id)
    return success(data={"like_count": new_count})


@router.get("/users/{user_id}/circles", summary="Get user's joined circles")
def get_user_circles(
    user_id: int,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(_get_db),
):
    from app.services.edu_circle import get_user_circles
    items, total = get_user_circles(db, user_id, page=page, size=size)
    return success(data={
        "items": [{"id": c.id, "name": c.name, "category": c.category} for c in items],
        "total": total, "page": page, "size": size,
    })
