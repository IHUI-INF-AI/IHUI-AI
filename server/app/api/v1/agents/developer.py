"""Agent 开发者管理路由."""

import time
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from loguru import logger

from app.database import get_session
from app.schemas.common import error, success
from app.security import require_login
from app.utils.order_generator import developer_order_generator

router = APIRouter()


@router.post("/create", summary="创建开发者记录")
async def create_developer(
    agent_id: str = Query(..., description="Agent ID"),
    price: float = Query(0.0, description="开发者价格"),
    user_id: str = Query(None, description="指定用户 ID(管理员用),默认当前登录用户"),
    type: int = Query(None, description="续费类型 0=月 1=年(可选)"),
    count: int = Query(None, description="续费数量(可选,与 type 配合)"),
    user_uuid: str = Depends(require_login),
):
    """管理员或用户创建一条开发者记录.

    保留绑定语义(agent_id/price/user_id).
    若同时提供 type 和 count,则计算续费过期时间并在响应中返回(不持久化,
    因为当前 AgentDeveloper 模型无对应字段).
    type=0 月 → now + 30*count 天; type=1 年 → now + 365*count 天.
    """
    expiration_date = None
    if type is not None and count is not None and count > 0:
        days = 30 * count if type == 0 else 365 * count
        expiration_date = (datetime.now() + timedelta(days=days)).isoformat()
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
            resp = {
                "id": record.id,
                "agent_id": agent_id,
                "order_no": record.order_no,
                "price": price,
            }
            if expiration_date is not None:
                resp["type"] = type
                resp["count"] = count
                resp["expiration_date"] = expiration_date
            return success(resp)
        except Exception as e:
            logger.error(f"Create developer error: {e}")
            return error(str(e))


@router.get("/list", summary="Agent 开发者列表")
async def list_developers(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user_id: str = Query(None, description="按用户筛选"),
    uuid: str = Query(None, description="按 UUID 筛选(兼容历史,等价于 user_id)"),
    user_name: str = Query(None, description="按用户名筛选(模型无此字段,忽略)"),
    creator_id: str = Query(None, description="按创建者筛选(模型无此字段,忽略)"),
    type: int = Query(None, description="按续费类型筛选(模型无此字段,忽略)"),
    order_no: str = Query(None, description="按订单号筛选"),
    start_date: str = Query(None, description="起始日期 YYYY-MM-DD"),
    end_date: str = Query(None, description="结束日期 YYYY-MM-DD"),
    sort_by: str = Query("id", description="排序字段"),
    sort_order: str = Query("desc", description="排序方向 asc/desc"),
):
    """分页查询开发者记录.

    支持过滤: user_id/uuid(兼容历史映射到 user_id)/order_no/日期范围.
    user_name/creator_id/type 参数为兼容历史接口保留,当前模型无对应字段将被忽略.
    """
    with get_session() as db:
        from app.models.activity_models import AgentDeveloper

        q = db.query(AgentDeveloper)
        # uuid 历史参数映射到 user_id
        effective_user = user_id or uuid
        if effective_user:
            q = q.filter(AgentDeveloper.user_id == effective_user)
        if order_no:
            q = q.filter(AgentDeveloper.order_no == order_no)
        if start_date:
            try:
                start_dt = datetime.strptime(start_date, "%Y-%m-%d")
                q = q.filter(AgentDeveloper.created_at >= start_dt)
            except ValueError:
                return error("start_date 格式应为 YYYY-MM-DD", "400000")
        if end_date:
            try:
                end_dt = datetime.strptime(end_date + " 23:59:59", "%Y-%m-%d %H:%M:%S")
                q = q.filter(AgentDeveloper.created_at <= end_dt)
            except ValueError:
                return error("end_date 格式应为 YYYY-MM-DD", "400000")
        # 排序
        sort_column = getattr(AgentDeveloper, sort_by, None) or AgentDeveloper.id
        if sort_order.lower() == "asc":
            q = q.order_by(sort_column.asc())
        else:
            q = q.order_by(sort_column.desc())
        total = q.count()
        items = q.offset((page - 1) * limit).limit(limit).all()
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
async def my_developer_agents(user_uuid: str = Depends(require_login)):
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
async def get_developer(record_id: int):
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
async def bind_developer(
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
async def update_price(
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
async def coze_link(user_uuid: str = Depends(require_login)):
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
async def bind_coze(
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


# ============================================================================
# 新增 endpoint(带 /developer 子前缀)
# ============================================================================


@router.get("/developer/order/{order_no}", summary="按订单号查询续费记录")
async def get_agent_developer_by_order(
    order_no: str,
    user_uuid: str = Depends(require_login),
):
    """按开发者续费订单号查询记录,含订单号格式校验."""
    if not developer_order_generator.validate(order_no):
        return error("订单号格式不正确", "400000")
    with get_session() as db:
        try:
            from app.models.activity_models import AgentDeveloper

            record = (
                db.query(AgentDeveloper)
                .filter(AgentDeveloper.order_no == order_no)
                .first()
            )
            if not record:
                return error("订单不存在", "404000")
            return success(
                {
                    "id": record.id,
                    "agent_id": record.agent_id,
                    "user_id": record.user_id,
                    "order_no": record.order_no,
                    "status": record.status,
                    "price": record.price,
                }
            )
        except Exception as e:
            logger.error(f"Get developer by order error: {e}")
            return error(str(e))


@router.post("/developer/generate-order-no", summary="生成开发者续费订单号")
async def generate_order_number_api(
    user_uuid: str = Depends(require_login),
):
    """生成开发者续费订单号(格式: WXK + YYYYMMDD + 7位序列)."""
    try:
        order_no = developer_order_generator.generate()
        return success(
            {
                "order_no": order_no,
                "format": "WXK + YYYYMMDD + 7-digit sequence",
                "example": "WXK202606280000001",
                "generated_at": datetime.now().isoformat(),
            }
        )
    except Exception as e:
        logger.error(f"Generate developer order no error: {e}")
        return error(str(e))
