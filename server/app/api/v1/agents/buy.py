"""Agent buy/purchase routes."""


import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Body, Depends, Query
from loguru import logger
from pydantic import BaseModel
from sqlalchemy import and_, func

from app.database import get_session
from app.metrics_business import BizTimer
from app.models.activity_models import AgentBuy, AgentCategory, AgentDeveloper
from app.models.agent_settlement import AgentSettlement
from app.schemas.common import error, success
from app.security import require_login
from app.utils.order_generator import agent_buy_order_generator, order_generator

router = APIRouter()


# ── Helpers ─────────────────────────────────────────────────────────────────


def _serialize_buy(b) -> dict:
    """Serialize an AgentBuy row to a dict."""
    return {
        "id": b.id,
        "agent_order_uuid": b.agent_order_uuid,
        "order_no": b.order_no,
        "bug_uuid": b.bug_uuid,
        "bug_name": b.bug_name,
        "agent_id": b.agent_id,
        "agent_name": b.agent_name,
        "category_id": b.category_id,
        "discount": b.discount,
        "real_price": b.real_price,
        "price": b.price,
        "count": b.count,
        "bug_time": b.bug_time.isoformat() if b.bug_time else None,
        "expiration_date": b.expiration_date.isoformat() if b.expiration_date else None,
        "status": b.status,
        "settlement": b.settlement,
        "settlement_time": b.settlement_time.isoformat() if b.settlement_time else None,
        "prologue": b.prologue,
        "issue_no": b.issue_no,
    }


def _compute_expiration(bug_time, count, type_child) -> datetime | None:
    """Compute expiration date based on category billing scheme.

    type_child: 1=monthly (30d * count), 2=yearly (365d * count), 3=permanent (None).
    """
    if bug_time is None:
        return None
    tc = str(type_child) if type_child is not None else "1"
    cnt = int(count) if count else 1
    if tc == "3":
        return None
    if tc == "1":
        return bug_time + timedelta(days=30 * cnt)
    if tc == "2":
        return bug_time + timedelta(days=365 * cnt)
    return None


def _resolve_category(db, category_id=None, agent_id=None):
    """Look up AgentCategory by category_id, else latest by agent_id."""
    cat = None
    if category_id:
        cat = db.query(AgentCategory).filter(AgentCategory.id == category_id).first()
    if not cat and agent_id:
        cat = (
            db.query(AgentCategory)
            .filter(AgentCategory.agent_id == agent_id)
            .order_by(AgentCategory.id.desc())
            .first()
        )
    return cat


# ── List purchases for current user ──────────────────────────────────────────


@router.get("/list", summary="List agent purchases")
async def list_purchases(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    agent_id: str = Query(None, description="按智能体ID筛选"),
    bug_uuid: str = Query(None, description="按购买人UUID筛选(默认当前用户)"),
    agent_order_uuid: str = Query(None, description="按开发者UUID筛选"),
    order_no: str = Query(None, description="按订单号筛选"),
    status: str = Query(None, description="状态: 0=生效 1=过期"),
    settlement: str = Query(None, description="结算: 0=未结算 1=已结算"),
    start_date: datetime = Query(None, description="购买起始时间"),
    end_date: datetime = Query(None, description="购买结束时间"),
    sort_by: str = Query("bug_time", description="排序字段"),
    sort_order: str = Query("desc", description="排序方向: asc/desc"),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        try:
            # 默认按当前用户筛选(向后兼容); 显式传 bug_uuid 则覆盖
            buyer = bug_uuid if bug_uuid else user_uuid
            q = db.query(AgentBuy).filter(AgentBuy.bug_uuid == buyer)
            if agent_id:
                q = q.filter(AgentBuy.agent_id == agent_id)
            if agent_order_uuid:
                q = q.filter(AgentBuy.agent_order_uuid == agent_order_uuid)
            if order_no:
                q = q.filter(AgentBuy.order_no == order_no)
            if status:
                q = q.filter(AgentBuy.status == status)
            if settlement:
                q = q.filter(AgentBuy.settlement == settlement)
            if start_date:
                q = q.filter(AgentBuy.bug_time >= start_date)
            if end_date:
                q = q.filter(AgentBuy.bug_time <= end_date)
            total = q.count()
            if sort_by and hasattr(AgentBuy, sort_by):
                col = getattr(AgentBuy, sort_by)
                q = q.order_by(col.desc() if sort_order.lower() == "desc" else col.asc())
            else:
                q = q.order_by(AgentBuy.bug_time.desc())
            items = q.offset((page - 1) * limit).limit(limit).all()
            return success([_serialize_buy(b) for b in items], total=total)
        except Exception as e:
            logger.error(f"list_purchases error: {e}")
            return error(str(e))


# ── Get purchase record detail ───────────────────────────────────────────────


@router.get("/{record_id}", summary="Get purchase record detail")
async def get_purchase_detail(
    record_id: int,
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        record = db.query(AgentBuy).filter(AgentBuy.id == record_id).first()
        if not record:
            return error("Record not found", code="404")
        return success(_serialize_buy(record))


# ── Query by user + agent ────────────────────────────────────────────────────


@router.get("/user/{user_uuid}/agent/{agent_id}", summary="Query by user and agent")
async def get_purchase_by_user_agent(
    user_uuid: str,
    agent_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    _token_user: str = Depends(require_login),
):
    with get_session() as db:
        q = db.query(AgentBuy).filter(and_(AgentBuy.bug_uuid == user_uuid, AgentBuy.agent_id == agent_id))
        total = q.count()
        items = q.offset((page - 1) * limit).limit(limit).all()
        return success([_serialize_buy(b) for b in items], total=total)


# ── Query by order number ────────────────────────────────────────────────────


@router.get("/order/{order_no}", summary="Query by order number")
async def get_purchase_by_order(
    order_no: str,
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        record = db.query(AgentBuy).filter(AgentBuy.order_no == order_no).first()
        if not record:
            return error("Order not found", code="404")
        return success(_serialize_buy(record))


# ── List expired records ─────────────────────────────────────────────────────


@router.get("/expired", summary="List expired purchase records")
async def list_expired_purchases(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        q = db.query(AgentBuy).filter(AgentBuy.status == "1")
        total = q.count()
        items = q.offset((page - 1) * limit).limit(limit).all()
        return success([_serialize_buy(b) for b in items], total=total)


# ── Mark record as expired ───────────────────────────────────────────────────


@router.put("/{record_id}/expire", summary="Mark purchase record as expired")
async def expire_purchase(
    record_id: int,
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        record = db.query(AgentBuy).filter(AgentBuy.id == record_id).first()
        if not record:
            return error("Record not found", code="404")
        record.status = "1"
        db.commit()
        return success(_serialize_buy(record))


# ── Purchase agent ───────────────────────────────────────────────────────────


@router.post("/buy/create", summary="Purchase agent")
async def buy_agent(
    agent_id: str = Query(...),
    count: int = Query(1, ge=1, description="购买数量(月/年)"),
    discount: int = Query(None, description="折扣 0-100, 默认100"),
    category_id: str = Query(None, description="收费方案ID, 缺省按agent_id取最新"),
    bug_name: str = Query(None, description="购买人名称"),
    agent_name: str = Query(None, description="智能体名称"),
    prologue: str = Query(None, description="智能体开场白"),
    user_uuid: str = Depends(require_login),
):
    with BizTimer("biz:agent_buy:create", with_user=True), get_session() as db:
        try:
            # 1. 查找收费方案
            cat = _resolve_category(db, category_id=category_id, agent_id=agent_id)
            type_child = cat.type_child if cat and cat.type_child else "1"
            price_val = int(cat.account) if cat and cat.account is not None else 0
            category_id_val = cat.id if cat else None

            # 2. 折扣与实付金额
            discount_val = discount if discount is not None else 100
            if discount_val < 0 or discount_val > 100:
                return error("discount must be between 0 and 100", code="400000")
            real_price_val = price_val * discount_val // 100

            # 3. 开发者 UUID
            dev = (
                db.query(AgentDeveloper)
                .filter(AgentDeveloper.agent_id == agent_id, AgentDeveloper.status == 1)
                .first()
            )
            agent_order_uuid = dev.user_id if dev else None

            # 4. 订单号 (统一 WXAT+YYYYMMDD+7序号 格式, 向后兼容旧 BUY+hex)
            order_no = order_generator.generate()

            # 5. 时间
            bug_time = datetime.now()
            expiration_date = _compute_expiration(bug_time, count, type_child)

            # 6. 写入购买记录
            buy = AgentBuy(
                agent_order_uuid=agent_order_uuid,
                order_no=order_no,
                bug_uuid=user_uuid,
                bug_name=bug_name,
                agent_id=agent_id,
                agent_name=agent_name,
                category_id=category_id_val,
                discount=discount_val,
                real_price=real_price_val,
                price=price_val,
                count=count,
                bug_time=bug_time,
                expiration_date=expiration_date,
                status="0",
                settlement="0",
                prologue=prologue,
            )
            db.add(buy)

            # 7. 同步结算表 (uuid=开发者UUID)
            settlement_rec = AgentSettlement(
                id=str(uuid.uuid4()),
                uuid=agent_order_uuid,
                order_no=order_no,
                create_time=datetime.now(),
                buy_uuid=user_uuid,
                agent_id=agent_id,
                agent_name=agent_name,
                expiration_date=expiration_date,
                settlement="0",
                withdrawal="0",
            )
            db.add(settlement_rec)

            db.commit()
            db.refresh(buy)
            return success(
                {
                    "id": buy.id,
                    "order_no": buy.order_no,
                    "agent_order_uuid": buy.agent_order_uuid,
                    "price": buy.price,
                    "discount": buy.discount,
                    "real_price": buy.real_price,
                    "count": buy.count,
                    "type_child": type_child,
                    "bug_time": buy.bug_time.isoformat() if buy.bug_time else None,
                    "expiration_date": buy.expiration_date.isoformat() if buy.expiration_date else None,
                    "settlement_synced": True,
                }
            )
        except Exception as e:
            db.rollback()
            logger.error(f"buy_agent error: {e}")
            return error(str(e))


# ── Update agent buy record (full fields) ────────────────────────────────────


class AgentBuyUpdateBody(BaseModel):
    """Full-field update body for an agent buy record."""

    agent_order_uuid: str | None = None
    order_no: str | None = None
    bug_uuid: str | None = None
    bug_name: str | None = None
    agent_id: str | None = None
    agent_name: str | None = None
    category_id: str | None = None
    discount: int | None = None
    real_price: int | None = None
    price: int | None = None
    count: int | None = None
    bug_time: datetime | None = None
    expiration_date: datetime | None = None
    status: str | None = None
    settlement: str | None = None
    settlement_time: datetime | None = None
    prologue: str | None = None
    issue_no: int | None = None


@router.put("/buy/{record_id}", summary="Update agent buy record")
async def update_agent_buy(
    record_id: int,
    body: AgentBuyUpdateBody,
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        try:
            record = db.query(AgentBuy).filter(AgentBuy.id == record_id).first()
            if not record:
                return error("Record not found", code="404000")
            update_data = body.model_dump(exclude_unset=True)
            for field, value in update_data.items():
                if hasattr(record, field):
                    setattr(record, field, value)
            db.commit()
            db.refresh(record)
            return success(_serialize_buy(record))
        except Exception as e:
            db.rollback()
            logger.error(f"update_agent_buy error: {e}")
            return error(str(e))


# ── Delete agent buy record ──────────────────────────────────────────────────


@router.delete("/buy/{record_id}", summary="Delete agent buy record")
async def delete_agent_buy(
    record_id: int,
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        try:
            record = db.query(AgentBuy).filter(AgentBuy.id == record_id).first()
            if not record:
                return error("Record not found", code="404000")
            db.delete(record)
            db.commit()
            return success({"deleted": record_id})
        except Exception as e:
            db.rollback()
            logger.error(f"delete_agent_buy error: {e}")
            return error(str(e))


# ── Buy statistics summary ───────────────────────────────────────────────────


@router.get("/buy/stats/summary", summary="Buy statistics summary")
async def get_buy_stats(
    agent_id: str = Query(None, description="按智能体ID筛选"),
    bug_uuid: str = Query(None, description="按购买人UUID筛选"),
    agent_order_uuid: str = Query(None, description="按开发者UUID筛选"),
    status: str = Query(None, description="状态: 0=生效 1=过期"),
    settlement: str = Query(None, description="结算: 0=未结算 1=已结算"),
    start_date: datetime = Query(None, description="购买起始时间"),
    end_date: datetime = Query(None, description="购买结束时间"),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        try:
            q = db.query(AgentBuy)
            if agent_id:
                q = q.filter(AgentBuy.agent_id == agent_id)
            if bug_uuid:
                q = q.filter(AgentBuy.bug_uuid == bug_uuid)
            if agent_order_uuid:
                q = q.filter(AgentBuy.agent_order_uuid == agent_order_uuid)
            if status:
                q = q.filter(AgentBuy.status == status)
            if settlement:
                q = q.filter(AgentBuy.settlement == settlement)
            if start_date:
                q = q.filter(AgentBuy.bug_time >= start_date)
            if end_date:
                q = q.filter(AgentBuy.bug_time <= end_date)

            total_records = q.count() or 0
            total_amount = q.with_entities(func.coalesce(func.sum(AgentBuy.real_price), 0)).scalar() or 0
            total_months = q.with_entities(func.coalesce(func.sum(AgentBuy.count), 0)).scalar() or 0
            unique_buyers = q.with_entities(func.count(func.distinct(AgentBuy.bug_uuid))).scalar() or 0
            unique_agents = q.with_entities(func.count(func.distinct(AgentBuy.agent_id))).scalar() or 0

            status_rows = q.with_entities(AgentBuy.status, func.count(AgentBuy.id)).group_by(AgentBuy.status).all()
            status_dist = {row[0]: row[1] for row in status_rows}
            settle_rows = q.with_entities(AgentBuy.settlement, func.count(AgentBuy.id)).group_by(AgentBuy.settlement).all()
            settle_dist = {row[0]: row[1] for row in settle_rows}

            return success(
                {
                    "total_records": total_records,
                    "total_amount": total_amount,
                    "total_months": total_months,
                    "unique_buyers": unique_buyers,
                    "unique_agents": unique_agents,
                    "average_price": total_amount // total_records if total_records else 0,
                    "average_months": total_months // total_records if total_records else 0,
                    "status_distribution": {
                        "active": status_dist.get("0", 0),
                        "expired": status_dist.get("1", 0),
                    },
                    "settlement_distribution": {
                        "unpaid": settle_dist.get("0", 0),
                        "paid": settle_dist.get("1", 0),
                    },
                }
            )
        except Exception as e:
            logger.error(f"get_buy_stats error: {e}")
            return error(str(e))


# ── Generate order number ────────────────────────────────────────────────────


@router.get("/buy/order/generate", summary="Generate order number")
async def generate_order_number_api(
    user_uuid: str = Depends(require_login),
):
    try:
        order_no = order_generator.generate()
        return success(
            {
                "order_no": order_no,
                "format": "WXAT + YYYYMMDD + 7位序号",
                "generated_at": datetime.now().isoformat(),
            }
        )
    except Exception as e:
        logger.error(f"generate_order_number_api error: {e}")
        return error(str(e))


# ── Validate order number format ─────────────────────────────────────────────


@router.post("/buy/order/validate", summary="Validate order number format")
async def validate_order_number_api(
    order_no: str = Body(..., embed=True),
    user_uuid: str = Depends(require_login),
):
    try:
        # 先校验新格式 WXAT+YYYYMMDD+7序号, 再回退旧格式 BUY+hex (向后兼容)
        is_valid = order_generator.validate(order_no)
        parsed = order_generator.parse(order_no) if is_valid else None
        format_name = "WXAT" if is_valid else None
        if not is_valid:
            is_valid = agent_buy_order_generator.validate(order_no)
            if is_valid:
                parsed = agent_buy_order_generator.parse(order_no)
                format_name = "BUY_LEGACY"
        result = {
            "order_no": order_no,
            "is_valid": is_valid,
            "format": format_name,
            "validated_at": datetime.now().isoformat(),
        }
        if is_valid and parsed is not None:
            result["parsed"] = parsed
        return success(result)
    except Exception as e:
        logger.error(f"validate_order_number_api error: {e}")
        return error(str(e))


# ── Recalculate expiration date by category billing scheme ───────────────────


@router.post("/buy/{record_id}/recalculate-expiration", summary="Recalculate expiration date by category scheme")
async def recalculate_expiration_date(
    record_id: int,
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        try:
            record = db.query(AgentBuy).filter(AgentBuy.id == record_id).first()
            if not record:
                return error("Record not found", code="404000")
            cat = _resolve_category(db, category_id=record.category_id, agent_id=record.agent_id)
            type_child = cat.type_child if cat and cat.type_child else "1"
            bug_time = record.bug_time or datetime.now()
            new_expiration = _compute_expiration(bug_time, record.count, type_child)
            record.expiration_date = new_expiration
            db.commit()
            db.refresh(record)
            return success(
                {
                    "id": record.id,
                    "agent_id": record.agent_id,
                    "category_id": record.category_id,
                    "type_child": type_child,
                    "count": record.count,
                    "bug_time": record.bug_time.isoformat() if record.bug_time else None,
                    "expiration_date": record.expiration_date.isoformat() if record.expiration_date else None,
                    "recalculated_at": datetime.now().isoformat(),
                }
            )
        except Exception as e:
            db.rollback()
            logger.error(f"recalculate_expiration_date error: {e}")
            return error(str(e))
