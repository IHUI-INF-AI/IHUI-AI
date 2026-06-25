"""音色管理路由(HTTP CRUD + 试听 WS).

音色是 TTS 系统中预置的语音配置.
"""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import Column, DateTime, Integer, String

from app.database import Base, get_session
from app.schemas.common import error, success
from app.security import require_login

router = APIRouter()


class Timbre(Base):
    """音色 model."""

    __tablename__ = "zhs_timbre"

    id = Column(String(64), primary_key=True, default=lambda: uuid.uuid4().hex)
    name = Column(String(64), nullable=False, comment="音色名")
    voice_id = Column(String(64), nullable=False, comment="TTS 引擎的 voice id")
    language = Column(String(16), default="zh", comment="语言")
    gender = Column(String(8), default="female")
    age_range = Column(String(16), default="", comment="young/middle/old")
    style = Column(String(32), default="", comment="chat/news/song")
    sample_url = Column(String(255), default="", comment="试听音频 URL")
    description = Column(String(255), default="")
    status = Column(Integer, default=1, comment="0 禁用 1 启用")
    created_at = Column(DateTime, default=datetime.utcnow)


# ---------------------------------------------------------------------------
# HTTP CRUD
# ---------------------------------------------------------------------------


@router.get("/list", summary="音色列表")
def list_timbres(
    language: str = Query(None),
    gender: str = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        q = db.query(Timbre).filter(Timbre.status == 1)
        if language:
            q = q.filter(Timbre.language == language)
        if gender:
            q = q.filter(Timbre.gender == gender)
        total = q.count()
        items = q.offset((page - 1) * limit).limit(limit).all()
        data = [
            {
                "id": t.id,
                "name": t.name,
                "voice_id": t.voice_id,
                "language": t.language,
                "gender": t.gender,
                "age_range": t.age_range,
                "style": t.style,
                "sample_url": t.sample_url,
            }
            for t in items
        ]
        return success(data, total=total)


@router.post("/create", summary="新增音色")
def create_timbre(
    name: str = Query(...),
    voice_id: str = Query(...),
    language: str = Query("zh"),
    gender: str = Query("female"),
    age_range: str = Query(""),
    style: str = Query(""),
    sample_url: str = Query(""),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        try:
            t = Timbre(
                name=name,
                voice_id=voice_id,
                language=language,
                gender=gender,
                age_range=age_range,
                style=style,
                sample_url=sample_url,
            )
            db.add(t)
            db.commit()
            return success({"id": t.id, "name": name})
        except Exception as e:
            return error(str(e))


@router.post("/update", summary="更新音色")
def update_timbre(
    timbre_id: str = Query(...),
    name: str = Query(None),
    sample_url: str = Query(None),
    status: int = Query(None),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        t = db.query(Timbre).filter(Timbre.id == timbre_id).first()
        if not t:
            return error("音色不存在")
        if name is not None:
            t.name = name
        if sample_url is not None:
            t.sample_url = sample_url
        if status is not None:
            t.status = status
        db.commit()
        return success({"id": timbre_id})


@router.post("/delete", summary="删除音色")
def delete_timbre(timbre_id: str = Query(...), user_uuid: str = Depends(require_login)):
    with get_session() as db:
        t = db.query(Timbre).filter(Timbre.id == timbre_id).first()
        if not t:
            return error("音色不存在")
        t.status = 0
        db.commit()
        return success({"id": timbre_id, "deleted": True})
