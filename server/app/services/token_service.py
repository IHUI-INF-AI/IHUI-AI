"""Token billing and audit service."""

import logging

from sqlalchemy.orm import Session

from app.config import special_bot_cache
from app.database import get_session

logger = logging.getLogger(__name__)
OP_RECHARGE = 0
OP_DEDUCT = 1
OP_EXPIRE = 2
OP_REFUND = 3
OP_COMMISSION = 4

# ---------------------------------------------------------------------------
# 特殊智能体扣费规则 (ported from historical deduct_special_bot_tokens)
# 与普通扣费区别: 使用固定金额 (不按消耗量计算), 允许扣成负数.
# 历史公式: TOKEN_BASE_MULTIPLIER * per_yuan_rate * 3
#   普通用户 is_vip=0: 2 * 20000 * 3 = 120000 token
#   会员     is_vip=1: 2 * 50000 * 3 = 300000 token
#   操盘手   is_vip=2: 2 * 80000 * 3 = 480000 token
# ---------------------------------------------------------------------------
SPECIAL_BOT_DEDUCT_AMOUNTS: dict[int, int] = {0: 120000, 1: 300000, 2: 480000}
SPECIAL_BOT_DEFAULT_DEDUCT: int = 120000  # 未知 VIP 等级时按普通用户扣费
SPECIAL_BOT_USER_TYPES: dict[int, str] = {0: "普通用户", 1: "会员", 2: "操盘手"}


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


def _deduct_special_bot_token(user_uuid: str, bot_id: str, desc: str = "") -> dict:
    """特殊智能体扣费 - 根据用户 VIP 等级扣除固定数量 token.

    与普通扣费区别:
        - 使用固定金额 (不按传入数量计算), 金额由 VIP 等级决定.
        - 允许扣成负数 (历史行为, 与 deduct_user_tokens 一致).

    Args:
        user_uuid: 用户 UUID.
        bot_id: 触发扣费的智能体 ID (已确认为特殊智能体).
        desc: 流水描述, 为空时按 "特殊智能体扣费(用户类型)" 生成.

    Returns:
        dict: 扣费结果, 含 success/balance/old_balance/deduct_amount/
              user_type/is_vip/is_special_bot 字段.
    """
    from app.models.user_models import User

    with get_session() as db:
        try:
            user = db.query(User).filter(User.uuid == user_uuid).first()
            if not user:
                logger.warning(f"Special bot deduct: user not found: {user_uuid}")
                return {
                    "success": False,
                    "reason": "user not found",
                    "user_uuid": user_uuid,
                    "bot_id": bot_id,
                    "is_special_bot": True,
                }

            is_vip = int(getattr(user, "is_vip", 0) or 0)
            deduct_amount = SPECIAL_BOT_DEDUCT_AMOUNTS.get(is_vip, SPECIAL_BOT_DEFAULT_DEDUCT)
            user_type = SPECIAL_BOT_USER_TYPES.get(is_vip, f"未知等级({is_vip})")
            if is_vip not in SPECIAL_BOT_DEDUCT_AMOUNTS:
                logger.warning(f"Special bot deduct: unknown vip level {is_vip}, fallback to normal user rule")

            logger.info(
                f"Special bot deduct: bot_id={bot_id}, user_uuid={user_uuid}, "
                f"user_type={user_type}, is_vip={is_vip}, deduct_amount={deduct_amount}"
            )

            margin = _ensure_margin(db, user_uuid)
            old_balance = margin.token_quantity or 0
            new_balance = old_balance - deduct_amount
            margin.token_quantity = new_balance

            flow_desc = desc or f"特殊智能体扣费({user_type}): bot_id={bot_id}"
            _log_flow(db, user_uuid, -deduct_amount, OP_DEDUCT, flow_desc)

            if new_balance < 0:
                logger.warning(
                    f"Special bot deduct: balance negative (allowed): "
                    f"old={old_balance}, deduct={deduct_amount}, new={new_balance}"
                )
            else:
                logger.info(
                    f"Special bot deduct success: old={old_balance}, deduct={deduct_amount}, new={new_balance}"
                )

            return {
                "success": True,
                "balance": new_balance,
                "old_balance": old_balance,
                "deduct_amount": deduct_amount,
                "user_type": user_type,
                "is_vip": is_vip,
                "bot_id": bot_id,
                "is_special_bot": True,
                "is_negative": new_balance < 0,
            }
        except Exception as e:
            logger.error(f"Special bot deduct error: {e}")
            return {
                "success": False,
                "reason": str(e),
                "user_uuid": user_uuid,
                "bot_id": bot_id,
                "is_special_bot": True,
            }


def deduct_user_token(
    user_uuid: str,
    quantity: int,
    desc: str = "",
    db: Session | None = None,
    bot_id: str | None = None,
) -> dict:
    """扣除用户 token 余额.

    Args:
        user_uuid: 用户 UUID.
        quantity: 待扣除 token 数量 (特殊智能体场景下该值被忽略, 改用 VIP 等级固定金额).
        desc: 流水描述.
        db: 兼容保留参数 (实际由 get_session 自动管理会话).
        bot_id: 智能体 ID, 传入时会通过 SpecialBotCache 判断是否走特殊扣费规则.

    Returns:
        dict: 扣费结果.
    """
    # SpecialBotCache 接入: 特殊智能体走 VIP 等级固定金额扣费
    if bot_id and special_bot_cache.is_special_bot(bot_id):
        logger.info(f"Special bot detected, route to special deduction: bot_id={bot_id}")
        return _deduct_special_bot_token(user_uuid, bot_id, desc=desc)

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
