"""Edu setting router - /api/v1/edu/setting

Migrated from ihui-ai-edu-setting-service.
Complete Phase B implementation.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_session


def _get_db():
    """FastAPI dependency wrapper for app.database.get_session (contextmanager)."""
    with get_session() as db:
        yield db


from app.core.current_user import get_current_user_id

from app.schemas.common import success

router = APIRouter()


@router.get("/dict/{dict_type}/{dict_key}", summary="Get dict entry")
def get_dict_endpoint(dict_type: str, dict_key: str, page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    from app.services.edu_setting import get_dict
    result = get_dict(db, dict_type=dict_type, dict_key=dict_key)
    return success(data=result)

@router.get("/dict/{dict_type}", summary="List dict by type")
def list_by_type_endpoint(dict_type: str, page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    from app.services.edu_setting import list_by_type
    result = list_by_type(db, dict_type=dict_type)
    return success(data=result)

@router.post("/dict/batch-get", summary="Batch get")
def batch_get_endpoint(payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_setting import batch_get
    result = batch_get(db, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.post("/dict", summary="Create dict")
def create_dict_endpoint(user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_setting import create_dict
    result = create_dict(db, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.put("/dict/{dict_id}", summary="Update dict")
def update_dict_endpoint(dict_id: int, user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_setting import update_dict
    result = update_dict(db, dict_id=dict_id, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.delete("/dict/{dict_id}", summary="Delete dict")
def delete_dict_endpoint(dict_id: int, user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_setting import delete_dict
    result = delete_dict(db, dict_id=dict_id, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.get("/dict", summary="List all")
def list_all_endpoint(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    from app.services.edu_setting import list_all
    result = list_all(db, page=page, size=size)
    return success(data=result)
