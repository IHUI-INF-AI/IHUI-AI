"""Agent buy/purchase routes."""


from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_

from app.database import get_session
from app.metrics_business import BizTimer
from app.models.activity_models import AgentBuy
from app.schemas.common import error, success
from app.security import require_login

router = APIRouter()


def _serialize_buy(b) -> dict:
    """Serialize an AgentBuy row to a dict."""
    return {
        "id": b.id,
        "agent_order_uuid": b.agent_order_uuid,
        "order_no": b.order_no,
        "bug_uuid": b.bug_uuid,
        "agent_id": b.agent_id,
        "agent_name": b.agent_name,
        "category_id": b.category_id,
        "count": b.count,
        "price": b.price,
        "bug_time": b.bug_time.isoformat() if b.bug_time else None,
        "expiration_date": b.expiration_date.isoformat() if b.expiration_date else None,
        "status": b.status,
        "settlement": b.settlement,
        "settlement_time": b.settlement_time.isoformat() if b.settlement_time else None,
        "prologue": b.prologue,
        "issue_no": b.issue_no,
    }


# ── List purchases for current user ──────────────────────────────────────────


@router.get("/list", summary="List agent purchases")
def list_purchases(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        q = db.query(AgentBuy).filter(AgentBuy.bug_uuid == user_uuid)
        total = q.count()
        items = q.offset((page - 1) * limit).limit(limit).all()
        return success([_serialize_buy(b) for b in items], total=total)


# ── Get purchase record detail ───────────────────────────────────────────────


@router.get("/{record_id}", summary="Get purchase record detail")
def get_purchase_detail(
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
def get_purchase_by_user_agent(
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
def get_purchase_by_order(
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
def list_expired_purchases(
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
def expire_purchase(
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


@router.post("/create", summary="Purchase agent")
def buy_agent(
    agent_id: str = Query(...),
    user_uuid: str = Depends(require_login),
):
    import uuid

    with BizTimer("biz:agent_buy:create", with_user=True), get_session() as db:
        buy = AgentBuy(
            agent_order_uuid=str(uuid.uuid4()),
            order_no=f"BUY{uuid.uuid4().hex[:10].upper()}",
            bug_uuid=user_uuid,
            agent_id=agent_id,
            price=0,
            status=0,
        )
        db.add(buy)
        db.commit()
        return success({"order_no": buy.order_no})
