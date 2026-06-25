"""edu_resource service - Educational resource (migrated from ihui-ai-edu-resource-service)."""

from __future__ import annotations
from app.utils.datetime_helper import utcnow
from sqlalchemy import desc, or_
from app.models.edu_models import EduResource
from app.services.edu_base import EduPermissionError, EduValidationError, paginate, get_or_404


def upload_resource(
    db: Session, uploader_id: int, title: str, file_url: str, file_type: str,
    file_size: int, **fields
) -> EduResource:
    if not title or not file_url or not file_type:
        raise EduValidationError("title/file_url/file_type required")
    r = EduResource(
        title=title, file_url=file_url, file_type=file_type, file_size=file_size,
        uploader_id=uploader_id,
        description=fields.get("description"),
        category_id=fields.get("category_id"),
        is_free=fields.get("is_free", True),
        points_required=fields.get("points_required", 0),
        download_count=0, view_count=0,
    )
    db.add(r)
    db.flush()
    db.refresh(r)
    return r


def delete_resource(db: Session, resource_id: int, uploader_id: int) -> bool:
    r = get_or_404(db, EduResource, resource_id, "resource")
    if r.uploader_id != uploader_id:
        raise EduPermissionError("only the uploader can delete")
    r.is_deleted = True
    r.deleted_at = utcnow()
    db.flush()
    return True


def get_resource(db: Session, resource_id: int) -> EduResource:
    return get_or_404(db, EduResource, resource_id, "resource")


def increment_download(db: Session, resource_id: int) -> EduResource:
    r = get_or_404(db, EduResource, resource_id, "resource")
    r.download_count = (r.download_count or 0) + 1
    db.flush()
    db.refresh(r)
    return r


def list_resources(
    db: Session, page: int = 1, size: int = 20,
    category_id: Optional[int] = None, file_type: Optional[str] = None,
    is_free: Optional[bool] = None, keyword: Optional[str] = None,
) -> Tuple[List[EduResource], int]:
    filters = []
    if category_id is not None:
        filters.append(EduResource.category_id == category_id)
    if file_type:
        filters.append(EduResource.file_type == file_type)
    if is_free is not None:
        filters.append(EduResource.is_free == is_free)
    if keyword:
        kw = f"%{keyword}%"
        filters.append(or_(EduResource.title.ilike(kw), EduResource.description.ilike(kw)))
    return paginate(db, EduResource, page=page, size=size, filters=filters, order_by=desc(EduResource.created_at))
