"""edu_setting service - System setting dict (migrated from ihui-ai-edu-setting-service).

Phase F: CategoryDictionary (IHUI-AI) uses name/code/parent_id/type/status.
"""
from __future__ import annotations

from typing import Dict, List, Optional, Tuple

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.models.edu_models import EduSettingDict
from app.services.edu_base import EduValidationError, paginate, get_or_404


def get_dict(db: Session, dict_type: str, dict_key: str) -> EduSettingDict:
    """Get a single dict entry by type+code."""
    d = db.execute(
        select(EduSettingDict).where(
            and_(
                EduSettingDict.type == dict_type,
                EduSettingDict.code == dict_key,
            )
        )
    ).scalar_one_or_none()
    if d is None:
        from app.services.edu_base import EduNotFoundError
        raise EduNotFoundError(f"dict[{dict_type}:{dict_key}]", 0)
    return d


def list_by_type(db: Session, dict_type: str) -> List[EduSettingDict]:
    return list(db.execute(
        select(EduSettingDict)
        .where(and_(EduSettingDict.type == dict_type, EduSettingDict.status == 1))
        .order_by(EduSettingDict.sort)
    ).scalars().all())


def batch_get(db: Session, dict_types: List[str]) -> Dict[str, List[dict]]:
    result: Dict[str, List[dict]] = {}
    rows = db.execute(
        select(EduSettingDict)
        .where(and_(EduSettingDict.type.in_(dict_types), EduSettingDict.status == 1))
        .order_by(EduSettingDict.type, EduSettingDict.sort)
    ).scalars().all()
    for r in rows:
        result.setdefault(r.type, []).append({
            "code": r.code, "name": r.name, "sort": r.sort,
        })
    return result


def create_dict(db: Session, dict_type: str, dict_key: str, dict_value: str,
                sort_order: int = 0, remark: Optional[str] = None) -> EduSettingDict:
    if not dict_type or not dict_key or not dict_value:
        raise EduValidationError("dict_type, dict_key, dict_value are required")
    existing = db.execute(
        select(EduSettingDict).where(
            and_(EduSettingDict.type == dict_type, EduSettingDict.code == dict_key)
        )
    ).scalar_one_or_none()
    if existing:
        raise EduValidationError(f"dict already exists: {dict_type}:{dict_key}")
    d = EduSettingDict(
        type=dict_type, code=dict_key, name=dict_value,
        sort=sort_order, status=1, parent_id=0,
    )
    db.add(d)
    db.flush()
    db.refresh(d)
    return d


def update_dict(db: Session, dict_id: int, **fields) -> EduSettingDict:
    d = get_or_404(db, EduSettingDict, dict_id, "setting_dict")
    allowed = {"name", "sort", "status"}
    for k, v in fields.items():
        if k in allowed and v is not None:
            setattr(d, k, v)
    db.flush()
    db.refresh(d)
    return d


def delete_dict(db: Session, dict_id: int) -> bool:
    d = get_or_404(db, EduSettingDict, dict_id, "setting_dict")
    db.delete(d)
    db.flush()
    return True


def list_all(db: Session, page: int = 1, size: int = 20,
             dict_type: Optional[str] = None, keyword: Optional[str] = None) -> Tuple[List[EduSettingDict], int]:
    filters = []
    if dict_type:
        filters.append(EduSettingDict.type == dict_type)
    if keyword:
        kw = f"%{keyword}%"
        filters.append(or_(
            EduSettingDict.type.ilike(kw),
            EduSettingDict.code.ilike(kw),
            EduSettingDict.name.ilike(kw),
        ))
    return paginate(db, EduSettingDict, page=page, size=size, filters=filters)
