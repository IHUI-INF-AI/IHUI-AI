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

    flow = OperateTokenFlow(
        user_id=user_uuid,
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


def expire_user_tokens(user_uuid: str, db: Session | None = None) -> dict:
    with get_session() as db:
        try:
            margin = _ensure_margin(db, user_uuid)
            old_qty = margin.token_quantity or 0
            margin.token_quantity = 0
            _log_flow(db, user_uuid, -old_qty, OP_EXPIRE, "Token expired")
            return {"success": True, "expired": old_qty}
        except Exception as e:
            logger.error(f"Expire error: {e}")
            return {"success": False, "reason": str(e)}


def refund_token(user_uuid: str, quantity: int, desc: str = "", db: Session | None = None) -> dict:
    with get_session() as db:
        try:
            if quantity <= 0:
                return {"success": False, "reason": "quantity must be positive"}
            margin = _ensure_margin(db, user_uuid)
            margin.token_quantity = (margin.token_quantity or 0) + quantity
            _log_flow(db, user_uuid, quantity, OP_REFUND, desc or "Token refund")
            return {"success": True, "balance": margin.token_quantity}
        except Exception as e:
            logger.error(f"Refund error: {e}")
            return {"success": False, "reason": str(e)}


def grant_commission(user_uuid: str, quantity: int, order_id: str = "", db: Session | None = None) -> dict:
    with get_session() as db:
        try:
            if quantity <= 0:
                return {"success": False, "reason": "quantity must be positive"}
            margin = _ensure_margin(db, user_uuid)
            margin.token_quantity = (margin.token_quantity or 0) + quantity
            desc = f"commission order:{order_id}" if order_id else "commission"
            _log_flow(db, user_uuid, quantity, OP_COMMISSION, desc)
            return {"success": True, "balance": margin.token_quantity}
        except Exception as e:
            logger.error(f"Grant commission error: {e}")
            return {"success": False, "reason": str(e)}
