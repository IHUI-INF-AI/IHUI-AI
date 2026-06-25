"""Agent 开发者管理路由."""

import time

from fastapi import APIRouter, Depends, Query
from loguru import logger

from app.database import get_session
from app.schemas.common import error, success
from app.security import require_login
from app.utils.order_generator import developer_order_generator

router = APIRouter()


@router.post("/create", summary="创建开发者记录")
def create_developer(
    agent_id: str = Query(..., description="Agent ID"),
    price: float = Query(0.0, description="开发者价格"),
    user_id: str = Query(None, description="指定用户 ID(管理员用),默认当前登录用户"),
    user_uuid: str = Depends(require_login),
):
    """管理员或用户创建一条开发者记录.user_id 为空时默认为当前登录用户."""
    with get_session() as db:
        try:
            from app.models.activity_models import AgentDeveloper

            target_user = user_id if user_id else user_uuid
            existed = (
                db.query(AgentDeveloper)
                .filter(
                    AgentDeveloper.user_id == target_user,
                    AgentDeveloper.agent_id == agent_id,
                )
                .first()
            )
            if existed:
                return error("该用户已绑定此 Agent", "409")
            seq = int(time.time()) % 10000000
            record = AgentDeveloper(
                agent_id=agent_id,
                user_id=target_user,
                order_no=developer_order_generator.generate(sequence=seq),
                status=1,
                price=price,
            )
            db.add(record)
            db.commit()
            return success({"id": record.id, "agent_id": agent_id, "order_no": record.order_no})
        except Exception as e:
            logger.error(f"Create developer error: {e}")
            return error(str(e))


@router.get("/list", summary="Agent 开发者列表")
def list_developers(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user_id: str = Query(None, description="按用户筛选"),
):
    with get_session() as db:
        from app.models.activity_models import AgentDeveloper

        q = db.query(AgentDeveloper)
        if user_id:
            q = q.filter(AgentDeveloper.user_id == user_id)
        total = q.count()
        items = q.order_by(AgentDeveloper.id.desc()).offset((page - 1) * limit).limit(limit).all()
        data = [
            {
                "id": d.id,
                "agent_id": d.agent_id,
                "user_id": d.user_id,
                "order_no": d.order_no,
                "status": d.status,
                "price": d.price,
            }
            for d in items
        ]
        return success(data, total=total)


@router.get("/my", summary="我作为开发者的所有 Agent")
def my_developer_agents(user_uuid: str = Depends(require_login)):
    with get_session() as db:
        from app.models.activity_models import AgentDeveloper

        items = db.query(AgentDeveloper).filter(AgentDeveloper.user_id == user_uuid).all()
        data = [
            {
                "id": d.id,
                "agent_id": d.agent_id,
                "order_no": d.order_no,
                "status": d.status,
                "price": d.price,
            }
            for d in items
        ]
        return success(data, total=len(data))


@router.get("/{record_id}", summary="开发者记录详情")
def get_developer(record_id: int):
    """根据记录 ID 返回开发者详情."""
    with get_session() as db:
        try:
            from app.models.activity_models import AgentDeveloper

            d = db.query(AgentDeveloper).filter(AgentDeveloper.id == record_id).first()
            if not d:
                return error("记录不存在", "404")
            return success(
                {
                    "id": d.id,
                    "agent_id": d.agent_id,
                    "user_id": d.user_id,
                    "order_no": d.order_no,
                    "status": d.status,
                    "price": d.price,
                }
            )
        except Exception as e:
            logger.error(f"Get developer error: {e}")
            return error(str(e))


@router.post("/bind", summary="绑定 Agent 到当前用户(成为开发者)")
def bind_developer(
    agent_id: str = Query(...),
    price: float = Query(0.0, description="开发者价格"),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        try:
            from app.models.activity_models import AgentDeveloper

            existed = (
                db.query(AgentDeveloper)
                .filter(
                    AgentDeveloper.user_id == user_uuid,
                    AgentDeveloper.agent_id == agent_id,
                )
                .first()
            )
            if existed:
                return success({"id": existed.id, "agent_id": agent_id, "bound": True})
            seq = int(time.time()) % 10000000
            record = AgentDeveloper(
                agent_id=agent_id,
                user_id=user_uuid,
                order_no=developer_order_generator.generate(sequence=seq),
                status=1,
                price=price,
            )
            db.add(record)
            db.commit()
            return success({"id": record.id, "agent_id": agent_id, "order_no": record.order_no})
        except Exception as e:
            logger.error(f"Bind developer error: {e}")
            return error(str(e))


@router.post("/update-price", summary="更新开发者价格")
def update_price(
    agent_id: str = Query(...),
    price: float = Query(...),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        try:
            from app.models.activity_models import AgentDeveloper

            record = (
                db.query(AgentDeveloper)
                .filter(
                    AgentDeveloper.user_id == user_uuid,
                    AgentDeveloper.agent_id == agent_id,
                )
                .first()
            )
            if not record:
                return error("未找到该开发者记录")
            record.price = price
            db.commit()
            return success({"agent_id": agent_id, "price": price})
        except Exception as e:
            logger.error(f"Update developer price error: {e}")
            return error(str(e))


@router.get("/coze-link", summary="查询 Coze 账号绑定")
def coze_link(user_uuid: str = Depends(require_login)):
    with get_session() as db:
        from app.models.activity_models import DeveloperLink

        link = db.query(DeveloperLink).filter(DeveloperLink.user_id == user_uuid).first()
        if not link:
            return success({"bound": False})
        return success(
            {
                "bound": True,
                "coze_account_id": link.coze_account_id,
                "coze_account_name": link.coze_account_name,
                "status": link.status,
            }
        )


@router.post("/coze-link/bind", summary="绑定 Coze 账号")
def bind_coze(
    coze_account_id: str = Query(...),
    coze_account_name: str = Query(...),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        try:
            from app.models.activity_models import DeveloperLink

            link = db.query(DeveloperLink).filter(DeveloperLink.user_id == user_uuid).first()
            if link:
                link.coze_account_id = coze_account_id
                link.coze_account_name = coze_account_name
                link.status = 1
            else:
                link = DeveloperLink(
                    user_id=user_uuid,
                    coze_account_id=coze_account_id,
                    coze_account_name=coze_account_name,
                    status=1,
                )
                db.add(link)
            db.commit()
            return success({"bound": True, "coze_account_id": coze_account_id})
        except Exception as e:
            logger.error(f"Bind Coze account error: {e}")
            return error(str(e))
