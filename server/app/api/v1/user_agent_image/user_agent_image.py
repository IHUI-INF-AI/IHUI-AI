"""用户图片交互"""


from fastapi import APIRouter, Query
from loguru import logger
from sqlalchemy import BigInteger, Column, Index, Integer, String, Text

from app.core.current_user import current_user_id_or_guest
from app.database import Base, get_session
from app.models.base import TimestampMixin
from app.schemas.common import error, success


class UserAgentImage(TimestampMixin, Base):
    """用户AI图片交互记录"""

    __tablename__ = "zhs_user_agent_image"
    __table_args__ = (
        Index("idx_uai_user", "user_id"),
        Index("idx_uai_agent", "agent_id"),
        {"extend_existing": True},
    )
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(String(64), nullable=False)
    user_name = Column(String(100), nullable=True)
    agent_id = Column(String(64), nullable=True, comment="Agent ID")
    agent_name = Column(String(200), nullable=True)
    image_url = Column(String(500), nullable=False, comment="图片URL")
    image_type = Column(String(20), default="input", comment="input=输入 output=输出")
    prompt = Column(Text, nullable=True, comment="图片描述/提示词")
    model = Column(String(50), nullable=True, comment="使用模型")
    task_id = Column(String(64), nullable=True, comment="任务ID")
    status = Column(Integer, default=1, comment="0=失败 1=成功 2=生成中")
    cost = Column(Integer, default=0, comment="消耗Token")
    width = Column(Integer, default=0)
    height = Column(Integer, default=0)
    size = Column(Integer, default=0, comment="文件大小字节")


router = APIRouter()


def _uid() -> str:
    return current_user_id_or_guest()

@router.post("", summary="记录图片交互")
async def create_image(
    image_url: str = Query(..., min_length=1),
    image_type: str = "input",
    agent_id: str | None = None,
    agent_name: str | None = None,
    prompt: str | None = None,
    model: str | None = None,
    task_id: str | None = None,
    status: int = 1,
    cost: int = 0,
    width: int = 0,
    height: int = 0,
    size: int = 0,
):
    with get_session() as db:
        try:
            uid = _uid()
            img = UserAgentImage(
                user_id=uid,
                user_name="匿名用户",
                agent_id=agent_id,
                agent_name=agent_name,
                image_url=image_url,
                image_type=image_type,
                prompt=prompt,
                model=model,
                task_id=task_id,
                status=status,
                cost=cost,
                width=width,
                height=height,
                size=size,
            )
            db.add(img)
            db.flush()
            return success({"id": img.id})
        except Exception as e:
            logger.error(f"user image create error: {e}")
            return error(str(e))


@router.get("/list", summary="我的图片交互")
async def list_images(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    image_type: str | None = None,
    agent_id: str | None = None,
):
    with get_session() as db:
        try:
            q = db.query(UserAgentImage).filter(UserAgentImage.user_id == _uid())
            if image_type:
                q = q.filter(UserAgentImage.image_type == image_type)
            if agent_id:
                q = q.filter(UserAgentImage.agent_id == agent_id)
            total = q.count()
            items = q.order_by(UserAgentImage.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success(
                [
                    {
                        "id": i.id,
                        "image_url": i.image_url,
                        "image_type": i.image_type,
                        "agent_id": i.agent_id,
                        "agent_name": i.agent_name,
                        "prompt": i.prompt,
                        "model": i.model,
                        "task_id": i.task_id,
                        "status": i.status,
                        "cost": i.cost,
                        "width": i.width,
                        "height": i.height,
                        "size": i.size,
                        "create_time": i.created_at.isoformat() if i.created_at else None,
                    }
                    for i in items
                ],
                total=total,
            )
        except Exception as e:
            logger.error(f"user image list error: {e}")
            return error(str(e))


@router.get("/{iid}", summary="图片详情")
async def get_image(iid: int):
    with get_session() as db:
        try:
            i = db.query(UserAgentImage).filter(UserAgentImage.id == iid).first()
            if not i:
                return error("图片不存在", "404")
            return success(
                {
                    "id": i.id,
                    "image_url": i.image_url,
                    "image_type": i.image_type,
                    "agent_id": i.agent_id,
                    "agent_name": i.agent_name,
                    "prompt": i.prompt,
                    "model": i.model,
                    "task_id": i.task_id,
                    "status": i.status,
                    "cost": i.cost,
                    "width": i.width,
                    "height": i.height,
                    "size": i.size,
                }
            )
        except Exception as e:
            logger.error(f"user image get error: {e}")
            return error(str(e))


@router.delete("/{iid}", summary="删除图片记录")
async def delete_image(iid: int):
    with get_session() as db:
        try:
            i = db.query(UserAgentImage).filter(UserAgentImage.id == iid, UserAgentImage.user_id == _uid()).first()
            if not i:
                return error("图片不存在", "404")
            db.delete(i)
            return success()
        except Exception as e:
            logger.error(f"user image delete error: {e}")
            return error(str(e))
