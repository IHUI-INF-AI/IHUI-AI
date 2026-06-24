"""Token billing and audit service."""

import logging

from sqlalchemy.orm import Session

from app.database import get_session

logger = logging.getLogger(__name__)
OP_RECHARGE = 0
OP_DEDUCT = 1
OP_EXPIRE = 2
OP_REFUND = 3
OP_COMMISSION = 4


def _log_flow(db, user_uuid, quantity, op_type, desc, token_free=0):
    from app.models.payment_models import OperateTokenFlow

    # user_id 在 ZhsOperateTokenFlow 中为 Integer (用户数字 ID), 此处仅持有 UUID,
    # 故只写 user_uuid, user_id 留空由调用方按需补齐.
    flow = OperateTokenFlow(
        user_uuid=user_uuid,
        token_quantity=quantity,
        type=op_type,
        operate_desc=desc,
        token_free=token_free,
    )
    db.add(flow)


def check_user_token(user_uuid: str, min_tokens: int = 0) -> dict:
    with get_session() as db:
        from app.models.user_models import UserMargin

        margin = db.query(UserMargin).filter(UserMargin.user_uuid == user_uuid).first()
        if not margin:
            return {"sufficient": False, "current_balance": 0, "reason": "User not found"}
        sufficient = margin.token_quantity >= min_tokens
        return {
            "sufficient": sufficient,
            "current_balance": margin.token_quantity,
            "reason": "" if sufficient else "Insufficient",
        }


def _ensure_margin(db, user_uuid):
    from app.models.user_models import UserMargin

    margin = db.query(UserMargin).filter(UserMargin.user_uuid == user_uuid).first()
    if not margin:
        margin = UserMargin(user_uuid=user_uuid, token_quantity=0)
        db.add(margin)
        db.flush()
    return margin


def recharge_token(user_uuid: str, quantity: int, out_trade_no: str = "", db: Session | None = None) -> dict:
    # Note: db parameter ignored; session managed by get_session()
    with get_session() as db:
        try:
            if quantity <= 0:
                return {"success": False, "reason": "quantity must be positive"}
            margin = _ensure_margin(db, user_uuid)
            margin.token_quantity = (margin.token_quantity or 0) + quantity
            _log_flow(db, user_uuid, quantity, OP_RECHARGE, f"recharge order:{out_trade_no}")
            return {"success": True, "balance": margin.token_quantity}
        except Exception as e:
            logger.error(f"Recharge error: {e}")
            return {"success": False, "reason": str(e)}


def deduct_user_token(user_uuid: str, quantity: int, desc: str = "", db: Session | None = None) -> dict:
    with get_session() as db:
        try:
            if quantity <= 0:
                return {"success": False, "reason": "quantity must be positive"}
            margin = _ensure_margin(db, user_uuid)
            if (margin.token_quantity or 0) < quantity:
                return {"success": False, "reason": "Insufficient token balance"}
            margin.token_quantity = (margin.token_quantity or 0) - quantity
            _log_flow(db, user_uuid, -quantity, OP_DEDUCT, desc or "Token deduction")
            return {"success": True, "balance": margin.token_quantity}
        except Exception as e:
            logger.error(f"Deduct error: {e}")
            return {"success": False, "reason": str(e)}


def list_token_flows(
    user_uuid: str,
    page: int = 1,
    limit: int = 20,
    op_type: int | None = None,
) -> dict:
    """查询用户 token 操作流水（分页 + 可选类型过滤）.

    对应 margin.py /flows 端点，返回 {"items": [...], "total": N}.
    """
    from app.models.payment_models import OperateTokenFlow

    with get_session() as db:
        q = db.query(OperateTokenFlow).filter(
            OperateTokenFlow.user_uuid == user_uuid
        )
        if op_type is not None:
            q = q.filter(OperateTokenFlow.type == op_type)
        total = q.count()
        items = (
            q.order_by(OperateTokenFlow.id.desc())
            .offset((page - 1) * limit)
            .limit(limit)
            .all()
        )
        data = [
            {
                "id": f.id,
                "user_id": f.user_id,
                "token_quantity": f.token_quantity,
                "type": f.type,
                "operate_desc": f.operate_desc,
                "token_free": f.token_free,
                "user_uuid": f.user_uuid,
            }
            for f in items
        ]
        return {"items": data, "total": total}


def expire_token(user_uuid: str, quantity: int = 0, source: str = "到期清零", db: Session | None = None) -> dict:
    with get_session() as db:
        try:
            margin = _ensure_margin(db, user_uuid)
            current = margin.token_quantity or 0
            expire_qty = quantity if quantity > 0 else current
            if expire_qty <= 0:
                return {"success": True, "expired": 0, "balance": 0}
            margin.token_quantity = current - expire_qty
            _log_flow(db, user_uuid, -expire_qty, OP_EXPIRE, source or "Token expired")
            return {"success": True, "expired": expire_qty, "balance": margin.token_quantity}
        except Exception as e:
            logger.error(f"Expire error: {e}")
            return {"success": False, "reason": str(e)}


def refund_token(user_uuid: str, quantity: int, out_trade_no: str = "", db: Session | None = None) -> dict:
    with get_session() as db:
        try:
            if quantity <= 0:
                return {"success": False, "reason": "quantity must be positive"}
            margin = _ensure_margin(db, user_uuid)
            margin.token_quantity = (margin.token_quantity or 0) + quantity
            _log_flow(db, user_uuid, quantity, OP_REFUND, out_trade_no or "Token refund")
            return {"success": True, "balance": margin.token_quantity}
        except Exception as e:
            logger.error(f"Refund error: {e}")
            return {"success": False, "reason": str(e)}


def grant_commission(user_uuid: str, quantity: int, invited_user_id: str = "", source: str = "", db: Session | None = None) -> dict:
    with get_session() as db:
        try:
            if quantity <= 0:
                return {"success": False, "reason": "quantity must be positive"}
            margin = _ensure_margin(db, user_uuid)
            margin.token_quantity = (margin.token_quantity or 0) + quantity
            desc = f"commission source:{source}" if source else "commission"
            if invited_user_id:
                desc += f" invited:{invited_user_id}"
            _log_flow(db, user_uuid, quantity, OP_COMMISSION, desc)
            return {"success": True, "balance": margin.token_quantity}
        except Exception as e:
            logger.error(f"Grant commission error: {e}")
            return {"success": False, "reason": str(e)}
