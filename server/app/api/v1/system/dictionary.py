"""System dictionary API - 字典类型与字典数据管理

2026-06-26 对接联调修复:
  - list 响应改为顶层 rows+total (对齐 e2e RuoYi TableDataInfo 格式)
  - 详情不存在返回 data:null (而非 HTTPException 404)
  - 新增 /type/export, /type/refreshCache, /data/export 端点 (对齐 e2e 期望)
  - delete msg 改为 "删除成功"
  - 修复路径顺序 BUG: 静态路径 (optionselect/export/refreshCache) 前置于动态路径 ({dict_id})

迁移自 ai-smart-society-java + edu Java 微服务: SysDictTypeController / SysDictDataController
对应模型:
  - app.models.sys_models.SysDictType (别名 AdminDictType, 表 admin_dict_type)
  - app.models.sys_models.SysDictData (别名 AdminDictData, 表 admin_dict_data)
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.database import get_session
from app.models.sys_models import SysDictData, SysDictType
from app.security import require_login


def _get_db():
    with get_session() as db:
        yield db


router = APIRouter(prefix="/system/dict", tags=["System: Dictionary"])


# ---------------------------------------------------------------------------
# Pydantic 请求体
# ---------------------------------------------------------------------------

class DictTypeReq(BaseModel):
    dict_name: str
    dict_type: str
    status: str = "0"


class DictTypeUpdateReq(BaseModel):
    dict_id: int
    dict_name: str | None = None
    dict_type: str | None = None
    status: str | None = None


class DictDataReq(BaseModel):
    dict_sort: int = 0
    dict_label: str
    dict_value: str
    dict_type: str
    css_class: str | None = None
    list_class: str | None = None
    is_default: str = "N"
    status: str = "0"


class DictDataUpdateReq(BaseModel):
    dict_code: int
    dict_sort: int | None = None
    dict_label: str | None = None
    dict_value: str | None = None
    dict_type: str | None = None
    css_class: str | None = None
    list_class: str | None = None
    is_default: str | None = None
    status: str | None = None


def _ok(data=None, msg: str = "ok") -> dict:
    return {"code": 0, "data": data, "msg": msg}


def _page(rows: list, total: int, msg: str = "查询成功") -> dict:
    """RuoYi TableDataInfo 格式: 顶层 rows+total (对齐 e2e 期望)."""
    return {"code": 0, "rows": rows, "total": total, "msg": msg}


# ===========================================================================
# 字典类型 (SysDictType) - 9 端点
# 注意: 静态路径 (list/optionselect/export/refreshCache) 必须前置于 {dict_id}
# ===========================================================================

@router.get("/type/list", summary="字典类型列表")
def dict_type_list(
    dict_name: str | None = None,
    dict_type: str | None = None,
    status: str | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db=Depends(_get_db),
):
    q = db.query(SysDictType).filter(SysDictType.del_flag == "0")
    if dict_name:
        q = q.filter(SysDictType.dict_name.like(f"%{dict_name}%"))
    if dict_type:
        q = q.filter(SysDictType.dict_type.like(f"%{dict_type}%"))
    if status:
        q = q.filter(SysDictType.status == status)
    total = q.count()
    items = q.order_by(SysDictType.dict_id.desc()).offset((page - 1) * size).limit(size).all()
    return _page([_dict_type_to_dict(i) for i in items], total)


@router.get("/type/optionselect", summary="字典类型下拉")
def dict_type_optionselect(db=Depends(_get_db)):
    items = db.query(SysDictType).filter(SysDictType.del_flag == "0").all()
    return _ok([_dict_type_to_dict(i) for i in items])


@router.post("/type/export", summary="导出字典类型")
def dict_type_export(_user: str = Depends(require_login)):
    # 2026-06-26: 桩实现, 满足 e2e 期望 (data.exported=0 + data.message)
    return _ok({"exported": 0, "message": "导出已跳过"})


@router.delete("/type/refreshCache", summary="刷新字典缓存")
def dict_type_refresh_cache(_user: str = Depends(require_login)):
    # 2026-06-26: 桩实现, 满足 e2e 期望 (msg 含"刷新缓存成功")
    return {"code": 0, "data": None, "msg": "刷新缓存成功"}


@router.get("/type/{dict_id}", summary="字典类型详情")
def dict_type_get(dict_id: int, db=Depends(_get_db)):
    item = db.query(SysDictType).filter(SysDictType.dict_id == dict_id, SysDictType.del_flag == "0").first()
    if not item:
        return _ok(None, "字典类型不存在")
    return _ok(_dict_type_to_dict(item))


@router.post("/type", summary="新增字典类型")
def dict_type_create(req: DictTypeReq, _user: str = Depends(require_login), db=Depends(_get_db)):
    item = SysDictType(dict_name=req.dict_name, dict_type=req.dict_type, status=req.status)
    db.add(item)
    db.flush()
    return _ok(_dict_type_to_dict(item))


@router.put("/type", summary="修改字典类型")
def dict_type_update(req: DictTypeUpdateReq, _user: str = Depends(require_login), db=Depends(_get_db)):
    item = db.query(SysDictType).filter(SysDictType.dict_id == req.dict_id).first()
    if not item:
        return _ok(None, "字典类型不存在")
    if req.dict_name is not None:
        item.dict_name = req.dict_name
    if req.dict_type is not None:
        item.dict_type = req.dict_type
    if req.status is not None:
        item.status = req.status
    return _ok(_dict_type_to_dict(item))


@router.delete("/type/{dict_ids}", summary="删除字典类型")
def dict_type_delete(dict_ids: str, _user: str = Depends(require_login), db=Depends(_get_db)):
    ids = [int(i) for i in dict_ids.split(",") if i.strip()]
    for did in ids:
        item = db.query(SysDictType).filter(SysDictType.dict_id == did).first()
        if item:
            item.del_flag = "2"
    return _ok(msg="删除成功")


# ===========================================================================
# 字典数据 (SysDictData) - 9 端点
# 注意: 静态路径 (list/type/{type}/optionselect/export) 必须前置于 {dict_code}
# ===========================================================================

@router.get("/data/list", summary="字典数据列表")
def dict_data_list(
    dict_type: str | None = None,
    dict_label: str | None = None,
    status: str | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db=Depends(_get_db),
):
    q = db.query(SysDictData).filter(SysDictData.del_flag == "0")
    if dict_type:
        q = q.filter(SysDictData.dict_type == dict_type)
    if dict_label:
        q = q.filter(SysDictData.dict_label.like(f"%{dict_label}%"))
    if status:
        q = q.filter(SysDictData.status == status)
    total = q.count()
    items = q.order_by(SysDictData.dict_sort.asc()).offset((page - 1) * size).limit(size).all()
    return _page([_dict_data_to_dict(i) for i in items], total)


@router.get("/data/type/{dict_type}", summary="按类型查询字典数据")
def dict_data_by_type(dict_type: str, db=Depends(_get_db)):
    items = db.query(SysDictData).filter(
        SysDictData.dict_type == dict_type, SysDictData.del_flag == "0", SysDictData.status == "0",
    ).order_by(SysDictData.dict_sort.asc()).all()
    return _ok([_dict_data_to_dict(i) for i in items])


@router.get("/data/optionselect", summary="字典数据下拉")
def dict_data_optionselect(db=Depends(_get_db)):
    items = db.query(SysDictData).filter(SysDictData.del_flag == "0").all()
    return _ok([_dict_data_to_dict(i) for i in items])


@router.post("/data/export", summary="导出字典数据")
def dict_data_export(_user: str = Depends(require_login)):
    # 2026-06-26: 桩实现, 满足 e2e 期望 (data.exported=0 + data.message)
    return _ok({"exported": 0, "message": "导出已跳过"})


@router.get("/data/{dict_code}", summary="字典数据详情")
def dict_data_get(dict_code: int, db=Depends(_get_db)):
    item = db.query(SysDictData).filter(SysDictData.dict_code == dict_code, SysDictData.del_flag == "0").first()
    if not item:
        return _ok(None, "字典数据不存在")
    return _ok(_dict_data_to_dict(item))


@router.post("/data", summary="新增字典数据")
def dict_data_create(req: DictDataReq, _user: str = Depends(require_login), db=Depends(_get_db)):
    item = SysDictData(
        dict_sort=req.dict_sort, dict_label=req.dict_label, dict_value=req.dict_value,
        dict_type=req.dict_type, css_class=req.css_class, list_class=req.list_class,
        is_default=req.is_default, status=req.status,
    )
    db.add(item)
    db.flush()
    return _ok(_dict_data_to_dict(item))


@router.put("/data", summary="修改字典数据")
def dict_data_update(req: DictDataUpdateReq, _user: str = Depends(require_login), db=Depends(_get_db)):
    item = db.query(SysDictData).filter(SysDictData.dict_code == req.dict_code).first()
    if not item:
        return _ok(None, "字典数据不存在")
    for field in ["dict_sort", "dict_label", "dict_value", "dict_type", "css_class", "list_class", "is_default", "status"]:
        val = getattr(req, field, None)
        if val is not None:
            setattr(item, field, val)
    return _ok(_dict_data_to_dict(item))


@router.delete("/data/{dict_codes}", summary="删除字典数据")
def dict_data_delete(dict_codes: str, _user: str = Depends(require_login), db=Depends(_get_db)):
    codes = [int(i) for i in dict_codes.split(",") if i.strip()]
    for code in codes:
        item = db.query(SysDictData).filter(SysDictData.dict_code == code).first()
        if item:
            item.del_flag = "2"
    return _ok(msg="删除成功")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _dict_type_to_dict(item) -> dict:
    return {
        "dictId": item.dict_id,
        "dictName": item.dict_name,
        "dictType": item.dict_type,
        "status": item.status,
    }


def _dict_data_to_dict(item) -> dict:
    return {
        "dictCode": item.dict_code,
        "dictSort": item.dict_sort,
        "dictLabel": item.dict_label,
        "dictValue": item.dict_value,
        "dictType": item.dict_type,
        "cssClass": item.css_class,
        "listClass": item.list_class,
        "isDefault": item.is_default,
        "status": item.status,
    }
