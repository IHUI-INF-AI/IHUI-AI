"""Dictionary management API - 字典管理

迁移自 Java ai-smart-society-java: ZhsDictionaryController (7 端点)
补充封存前缺失的字典管理 CRUD 功能
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.database import get_session
from app.security import require_login


def _get_db():
    with get_session() as db:
        yield db


router = APIRouter(prefix="/dictionary", tags=["Dictionary"])


class DictionaryReq(BaseModel):
    dict_type: str
    dict_name: str
    status: int = 0
    remark: str | None = None


class DictDataReq(BaseModel):
    dict_type: str
    dict_label: str
    dict_value: str
    sort: int = 0
    status: int = 0


def _to_dict(row) -> dict:
    return {c.name: getattr(row, c.name) for c in row.__table__.columns}


@router.get("/list", summary="字典类型列表")
def list_dictionary(
    dict_type: str | None = None,
    dict_name: str | None = None,
    status: int | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db=Depends(_get_db),
):
    """字典类型列表 (迁移自 Java: ZhsDictionaryController.list)"""
    from app.models.system_models import SysDictType
    q = db.query(SysDictType)
    if dict_type:
        q = q.filter(SysDictType.dict_type.ilike(f"%{dict_type}%"))
    if dict_name:
        q = q.filter(SysDictType.dict_name.ilike(f"%{dict_name}%"))
    if status is not None:
        q = q.filter(SysDictType.status == status)
    total = q.count()
    items = q.order_by(SysDictType.dict_id.desc()).offset((page - 1) * size).limit(size).all()
    return {"code": 0, "data": {"list": [_to_dict(i) for i in items], "total": total}, "msg": "ok"}


@router.get("/{dict_id}", summary="字典类型详情")
def get_dictionary(dict_id: int, db=Depends(_get_db)):
    """字典类型详情 (迁移自 Java: ZhsDictionaryController.getInfo)"""
    from app.models.system_models import SysDictType
    item = db.query(SysDictType).filter(SysDictType.dict_id == dict_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="字典类型不存在")
    return {"code": 0, "data": _to_dict(item), "msg": "ok"}


@router.post("", summary="新增字典类型")
def add_dictionary(req: DictionaryReq, _user: str = Depends(require_login), db=Depends(_get_db)):
    """新增字典类型 (迁移自 Java: ZhsDictionaryController.add)"""
    from app.models.system_models import SysDictType
    item = SysDictType(dict_type=req.dict_type, dict_name=req.dict_name, status=req.status, remark=req.remark)
    db.add(item)
    db.flush()
    return {"code": 0, "data": _to_dict(item), "msg": "ok"}


@router.put("/{dict_id}", summary="更新字典类型")
def update_dictionary(dict_id: int, req: DictionaryReq, _user: str = Depends(require_login), db=Depends(_get_db)):
    """更新字典类型 (迁移自 Java: ZhsDictionaryController.edit)"""
    from app.models.system_models import SysDictType
    item = db.query(SysDictType).filter(SysDictType.dict_id == dict_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="字典类型不存在")
    item.dict_type = req.dict_type
    item.dict_name = req.dict_name
    item.status = req.status
    item.remark = req.remark
    return {"code": 0, "data": _to_dict(item), "msg": "ok"}


@router.delete("/{dict_id}", summary="删除字典类型")
def delete_dictionary(dict_id: int, _user: str = Depends(require_login), db=Depends(_get_db)):
    """删除字典类型 (迁移自 Java: ZhsDictionaryController.remove)"""
    from app.models.system_models import SysDictType
    item = db.query(SysDictType).filter(SysDictType.dict_id == dict_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="字典类型不存在")
    db.delete(item)
    return {"code": 0, "msg": "ok"}


@router.get("/data/list", summary="字典数据列表")
def list_dict_data(
    dict_type: str,
    dict_label: str | None = None,
    status: int | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db=Depends(_get_db),
):
    """字典数据列表 (迁移自 Java: ZhsDictionaryController.dataList)"""
    from app.models.system_models import SysDictData
    q = db.query(SysDictData).filter(SysDictData.dict_type == dict_type)
    if dict_label:
        q = q.filter(SysDictData.dict_label.ilike(f"%{dict_label}%"))
    if status is not None:
        q = q.filter(SysDictData.status == status)
    total = q.count()
    items = q.order_by(SysDictData.dict_sort.asc()).offset((page - 1) * size).limit(size).all()
    return {"code": 0, "data": {"list": [_to_dict(i) for i in items], "total": total}, "msg": "ok"}


@router.post("/data", summary="新增字典数据")
def add_dict_data(req: DictDataReq, _user: str = Depends(require_login), db=Depends(_get_db)):
    """新增字典数据 (迁移自 Java: ZhsDictionaryController.addData)"""
    from app.models.system_models import SysDictData
    item = SysDictData(
        dict_type=req.dict_type,
        dict_label=req.dict_label,
        dict_value=req.dict_value,
        dict_sort=req.sort,
        status=req.status,
    )
    db.add(item)
    db.flush()
    return {"code": 0, "data": _to_dict(item), "msg": "ok"}
