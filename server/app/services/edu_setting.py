"""edu_setting service - System setting dict (migrated from ihui-ai-edu-setting-service).

Source (junction access): G:\\IHUI-AI\\storage\\edu-assets\\java-source\\ihui-ai-edu-setting-service\\
"""

from __future__ import annotations

from typing import Dict, List, Optional, Tuple

from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.models.edu_models import EduSettingDict
from app.services.edu_base import EduValidationError, paginate, get_or_404


def get_dict(db: Session, dict_type: str, dict_key: str) -> EduSettingDict:
    """Get a single dict entry."""
    return get_or_404(
        db, EduSettingDict, None, "setting_dict",
    ) if False else db.execute(
        select(EduSettingDict).where(
            and_(EduSettingDict.dict_type == dict_type, EduSettingDict.dict_key == dict_key)
        )
    ).scalar_one_or_none() or _raise_not_found(dict_type, dict_key)


def _raise_not_found(dict_type: str, dict_key: str):
    from app.services.edu_base import EduNotFoundError
    raise EduNotFoundError(f"dict[{dict_type}:{dict_key}]", 0)


def get_dict_by_id(db: Session, dict_id: int) -> EduSettingDict:
    return get_or_404(db, EduSettingDict, dict_id, "setting_dict")


def get_dict_value(db: Session, dict_type: str, dict_key: str, default: Optional[str] = None) -> Optional[str]:
    """Get dict value, return default if not found."""
    d = db.execute(
        select(EduSettingDict).where(
            and_(EduSettingDict.dict_type == dict_type, EduSettingDict.dict_key == dict_key)
        )
    ).scalar_one_or_none()
    return d.dict_value if d else default


def list_by_type(db: Session, dict_type: str) -> List[EduSettingDict]:
    """List all dict entries of a type."""
    return list(db.execute(
        select(EduSettingDict)
        .where(and_(EduSettingDict.dict_type == dict_type, EduSettingDict.is_active == True))
        .order_by(EduSettingDict.sort_order)
    ).scalars().all())


def batch_get(db: Session, dict_types: List[str]) -> Dict[str, List[dict]]:
    """Batch get dict entries by multiple types. Returns dict of type -> list."""
    result: Dict[str, List[dict]] = {}
    rows = db.execute(
        select(EduSettingDict)
        .where(and_(EduSettingDict.dict_type.in_(dict_types), EduSettingDict.is_active == True))
        .order_by(EduSettingDict.dict_type, EduSettingDict.sort_order)
    ).scalars().all()
    for r in rows:
        result.setdefault(r.dict_type, []).append({
            "key": r.dict_key, "value": r.dict_value, "sort_order": r.sort_order,
        })
    return result


def create_dict(
    db: Session, dict_type: str, dict_key: str, dict_value: str,
    sort_order: int = 0, remark: Optional[str] = None,
) -> EduSettingDict:
    """Create a new dict entry."""
    if not dict_type or not dict_key or not dict_value:
        raise EduValidationError("dict_type, dict_key, dict_value are required")
    existing = db.execute(
        select(EduSettingDict).where(
            and_(EduSettingDict.dict_type == dict_type, EduSettingDict.dict_key == dict_key)
        )
    ).scalar_one_or_none()
    if existing:
        raise EduValidationError(f"dict already exists: {dict_type}:{dict_key}")
    d = EduSettingDict(
        dict_type=dict_type, dict_key=dict_key, dict_value=dict_value,
        sort_order=sort_order, is_active=True, remark=remark,
    )
    db.add(d)
    db.flush()
    db.refresh(d)
    return d


def update_dict(db: Session, dict_id: int, **fields) -> EduSettingDict:
    d = get_dict_by_id(db, dict_id)
    allowed = {"dict_value", "sort_order", "is_active", "remark"}
    for k, v in fields.items():
        if k in allowed and v is not None:
            setattr(d, k, v)
    db.flush()
    db.refresh(d)
    return d


def delete_dict(db: Session, dict_id: int) -> bool:
    d = get_dict_by_id(db, dict_id)
    db.delete(d)
    db.flush()
    return True


def list_all(db: Session, page: int = 1, size: int = 20,
             dict_type: Optional[str] = None, keyword: Optional[str] = None) -> Tuple[List[EduSettingDict], int]:
    from sqlalchemy import or_
    filters = []
    if dict_type:
        filters.append(EduSettingDict.dict_type == dict_type)
    if keyword:
        kw = f"%{keyword}%"
        filters.append(or_(
            EduSettingDict.dict_type.ilike(kw),
            EduSettingDict.dict_key.ilike(kw),
            EduSettingDict.dict_value.ilike(kw),
        ))
    return paginate(db, EduSettingDict, page=page, size=size, filters=filters)
