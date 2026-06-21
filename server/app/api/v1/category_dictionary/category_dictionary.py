"""分类字典 - 通用字典/枚举管理"""

from fastapi import APIRouter, Query
from loguru import logger
from sqlalchemy import BigInteger, Boolean, Column, Index, Integer, String, Text

from app.database import Base, get_session
from app.models.base import TimestampMixin
from app.schemas.common import error, success


class CategoryDictionary(TimestampMixin, Base):
    __tablename__ = "category_dictionary"
    __table_args__ = (
        Index("idx_cd_type", "dict_type"),
    )
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    dict_type = Column(String(50), nullable=False, comment="字典类型")
    code = Column(String(50), nullable=False, comment="字典编码")
    label = Column(String(100), nullable=False, comment="字典标签")
    value = Column(String(200), nullable=True, comment="字典值")
    sort_order = Column(Integer, default=0)
    is_show = Column(Boolean, default=True)
    description = Column(String(500), nullable=True)
    parent_id = Column(BigInteger, default=0)
    extra = Column(Text, nullable=True, comment="额外JSON配置")


router = APIRouter()


@router.get("/list", summary="字典列表")
async def list_dict(dict_type: str | None = None,
                    page: int = Query(1, ge=1), limit: int = Query(100, ge=1, le=500)):
    with get_session() as db:
        try:
            q = db.query(CategoryDictionary)
            if dict_type:
                q = q.filter(CategoryDictionary.dict_type == dict_type)
            q = q.filter(CategoryDictionary.is_show)
            total = q.count()
            items = q.order_by(CategoryDictionary.sort_order.asc()).offset((page - 1) * limit).limit(limit).all()
            return success([{
                "id": d.id, "dict_type": d.dict_type, "code": d.code,
                "label": d.label, "value": d.value, "sort_order": d.sort_order,
                "is_show": d.is_show, "description": d.description,
                "parent_id": d.parent_id, "extra": d.extra,
            } for d in items], total=total)
        except Exception as e:
            logger.error(f"dict list error: {e}")
            return error(str(e))


@router.get("/type", summary="字典类型列表")
async def dict_types():
    with get_session() as db:
        try:
            types = db.query(CategoryDictionary.dict_type).distinct().all()
            return success([t[0] for t in types if t[0]])
        except Exception as e:
            logger.error(f"dict type error: {e}")
            return error(str(e))


@router.get("/{did}", summary="字典详情")
async def get_dict(did: int):
    with get_session() as db:
        try:
            d = db.query(CategoryDictionary).filter(CategoryDictionary.id == did).first()
            if not d:
                return error("字典不存在", "404")
            return success({
                "id": d.id, "dict_type": d.dict_type, "code": d.code,
                "label": d.label, "value": d.value, "sort_order": d.sort_order,
                "is_show": d.is_show, "description": d.description,
                "parent_id": d.parent_id, "extra": d.extra,
            })
        except Exception as e:
            logger.error(f"dict get error: {e}")
            return error(str(e))


@router.post("", summary="新增字典")
async def create_dict(dict_type: str = Query(...), code: str = Query(...),
                       label: str = Query(...), value: str | None = None,
                       sort_order: int = 0, is_show: bool = True,
                       description: str | None = None,
                       parent_id: int = 0, extra: str | None = None):
    with get_session() as db:
        try:
            d = CategoryDictionary(
                dict_type=dict_type, code=code, label=label, value=value,
                sort_order=sort_order, is_show=is_show, description=description,
                parent_id=parent_id, extra=extra,
            )
            db.add(d)
            db.flush()
            return success({"id": d.id})
        except Exception as e:
            logger.error(f"dict create error: {e}")
            return error(str(e))


@router.put("/{did}", summary="修改字典")
async def update_dict(did: int, label: str | None = None, value: str | None = None,
                       sort_order: int | None = None, is_show: bool | None = None,
                       description: str | None = None):
    with get_session() as db:
        try:
            d = db.query(CategoryDictionary).filter(CategoryDictionary.id == did).first()
            if not d:
                return error("字典不存在", "404")
            if label: d.label = label
            if value is not None: d.value = value
            if sort_order is not None: d.sort_order = sort_order
            if is_show is not None: d.is_show = is_show
            if description is not None: d.description = description
            return success()
        except Exception as e:
            logger.error(f"dict update error: {e}")
            return error(str(e))


@router.delete("/{did}", summary="删除字典")
async def delete_dict(did: int):
    with get_session() as db:
        try:
            d = db.query(CategoryDictionary).filter(CategoryDictionary.id == did).first()
            if not d:
                return error("字典不存在", "404")
            db.delete(d)
            return success()
        except Exception as e:
            logger.error(f"dict delete error: {e}")
            return error(str(e))
