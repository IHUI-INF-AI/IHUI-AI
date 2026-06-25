"""Edu member router - /api/v1/edu/member

Migrated from ihui-ai-edu-member-service.
Complete Phase B implementation.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_session
from app.security import require_role


def _get_db():
    """FastAPI dependency wrapper for app.database.get_session (contextmanager)."""
    with get_session() as db:
        yield db


def get_current_user_id():
    try:
        from app.dependencies import get_current_user_id as _real
        return _real()
    except ImportError as e:
        raise RuntimeError(f"authentication dependency unavailable: {e}") from e


from app.schemas.common import success

router = APIRouter()


@router.post("", summary="Create member profile")
def create_member_endpoint(user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_member import create_member
    result = create_member(db, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.get("/me", summary="Get my member")
def get_member_by_user_id_endpoint(user_id: int = Depends(get_current_user_id), page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    from app.services.edu_member import get_member_by_user_id
    result = get_member_by_user_id(db, user_uuid=str(user_id))
    return success(data=result)

@router.put("/me", summary="Update my member")
def update_member_endpoint(user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_member import update_member
    result = update_member(db, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.get("/{member_id}", summary="Get member by id")
def get_member_by_id_endpoint(member_id: int, current_user_id: int = Depends(get_current_user_id), page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    from app.services.edu_member import get_member_by_id, _extract_user_id
    result = get_member_by_id(db, member_id=member_id)
    # 权限校验: 仅本人或管理员可访问
    if str(_extract_user_id(result)) != str(current_user_id):
        from app.security import _check_role_sync
        if not _check_role_sync(str(current_user_id), "admin"):
            raise HTTPException(status_code=403, detail="admin or owner required")
    return success(data=result)

@router.post("/{user_id}/points/add", summary="Add points", dependencies=[Depends(require_role("admin"))])
def add_points_endpoint(user_id: int, payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_member import add_points
    result = add_points(db, user_id=user_id, amount=payload.get("amount"), source=payload.get("source", "earn"))
    return success(data=result)

@router.post("/{user_id}/points/deduct", summary="Deduct points", dependencies=[Depends(require_role("admin"))])
def deduct_points_endpoint(user_id: int, payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_member import deduct_points
    result = deduct_points(db, user_id=user_id, amount=payload.get("amount"))
    return success(data=result)

@router.get("", summary="List members")
def list_members_endpoint(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    from app.services.edu_member import list_members
    result = list_members(db)
    return success(data=result)

@router.post("/parents", summary="Bind parent")
def bind_parent_endpoint(user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_member import bind_parent
    result = bind_parent(db, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.delete("/parents", summary="Unbind parent")
def unbind_parent_endpoint(user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_member import unbind_parent
    result = unbind_parent(db, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.get("/parents/{parent_user_id}/children", summary="List children")
def list_parent_children_endpoint(parent_user_id: int, page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    from app.services.edu_member import list_parent_children
    result = list_parent_children(db, parent_user_id=parent_user_id)
    return success(data=result)
