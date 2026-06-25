"""Edu resource router - /api/v1/edu/resource

Migrated from ihui-ai-edu-resource-service.
Complete Phase B implementation.
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_session


def _get_db():
    """FastAPI dependency wrapper for app.database.get_session (contextmanager)."""
    with get_session() as db:
        yield db


try:
    from app.dependencies import get_current_user_id
except ImportError:
    def get_current_user_id() -> int:
        return 1  # dev stub

from app.schemas.common import success

router = APIRouter()


@router.post("/resources", summary="Upload resource")
def upload_resource_endpoint(user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_resource import upload_resource
    result = upload_resource(db, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.delete("/resources/{resource_id}", summary="Delete resource")
def delete_resource_endpoint(resource_id: int, user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_resource import delete_resource
    result = delete_resource(db, resource_id=resource_id, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.get("/resources/{resource_id}", summary="Get resource")
def get_resource_endpoint(resource_id: int, page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    from app.services.edu_resource import get_resource
    result = get_resource(db, resource_id=resource_id)
    return success(data=result)

@router.post("/resources/{resource_id}/download", summary="Increment download")
def increment_download_endpoint(resource_id: int, payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_resource import increment_download
    result = increment_download(db, resource_id=resource_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.get("/resources", summary="List resources")
def list_resources_endpoint(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    from app.services.edu_resource import list_resources
    result = list_resources(db)
    return success(data=result)
