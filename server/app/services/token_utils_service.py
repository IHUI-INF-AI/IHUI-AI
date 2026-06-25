"""Token 工具服务 -- VIP 等级判定、扣费、促销期检测.

P15-C2 增量: 新增 check_user_is_vip / calculate_tokens_per_yuan /
calculate_and_deduct_tokens_for_hunyuan3d, 改造 calculate_and_deduct_tokens_by_cost
支持 success=False 短路 (返回 success=True + 0 tokens + "no deduction" 理由),
补全 Phase 14 加测 test_token_utils_service 的依赖面.
"""

import time
from typing import Any

from loguru import logger
from sqlalchemy import text

from app.config import settings
from app.database import get_session
from app.services.token_service import deduct_user_token


def is_active_promotion_period() -> dict[str, Any]:
    """Check if current time is within an active promotion period."""
    with get_session() as db:
        from app.models.activity_models import Activity

        promo = (
            db.query(Activity)
            .filter(Activity.status == 1)
            .filter(Activity.begin_time <= text("NOW()"), Activity.end_time >= text("NOW()"))
            .order_by(Activity.begin_time.desc())
            .first()
        )
        if promo:
            return {
                "is_active": True,
                "activity": {
                    "id": promo.id,
                    "name": promo.activity_name,
                    "begin_time": promo.begin_time,
                    "end_time": promo.end_time,
                    "computing": getattr(promo, "computing", None),
                    "multiple": getattr(promo, "multiple", None),
                },
            }
        return {"is_active": False}


def encode_jwt_token() -> str:
    """Kling API JWT authentication."""
    import jwt as pyjwt

    ak = settings.KLING_ACCESS_KEY
    sk = settings.KLING_SECRET_KEY
    headers = {"alg": "HS256", "typ": "JWT"}
    payload = {"iss": ak, "exp": int(time.time()) + 1800, "nbf": int(time.time()) - 5}
    return pyjwt.encode(payload, sk, headers=headers)


def save_conversation_to_db(
    user_uuid: str,
    model_name: str,
    problem: str,
    answer: str,
    chat_id: str | None = None,
    agent_id: str | None = None,
    agent_url: str | None = None,
    user_url: str | None = None,
    field1: str | None = None,
    video_ratio: str | None = None,
    cost_info: dict | None = None,
    summary: str | None = None,
) -> bool:
    """Save conversation to DB and clean Redis cache."""
    try:
        with get_session() as db:
            from app.models.context_models import ChatContext

            ctx = ChatContext(
                user_uuid=user_uuid,
                model_name=model_name,
                problem=problem,
                answer=answer,
                chat_id=chat_id,
                agent_id=agent_id,
                agent_url=agent_url,
                user_url=user_url,
                field1=field1,
                video_ratio=video_ratio,
                summary=summary,
            )
            db.add(ctx)

        # Clean Redis cache
        try:
            from app.utils.redis_util import delete_key

            key_pattern = f"{settings.REDIS_PREFIX}{user_uuid}:{model_name}:{chat_id or ''}"
            delete_key(key_pattern)
            logger.info(f"Cleaned Redis cache: {key_pattern}")
        except Exception as e:
            logger.error("Redis cleanup error: " + str(e))
        return True
    except Exception as e:
        logger.error("Save conversation error: " + str(e))
        return False


def check_user_is_vip(user_uuid: str | None) -> bool:
    """判断用户是否为 VIP / 操盘手 (is_vip >= 1).

    返回 bool. 空/None UUID 视为非 VIP. DB 异常隔离, 视为非 VIP.
    """
    if not user_uuid:
        return False
    try:
        with get_session() as db:
            from app.models.user_models import User

            user = db.query(User).filter(User.uuid == user_uuid).first()
            if not user:
                return False
            return bool(getattr(user, "is_vip", 0))
    except Exception as e:
        logger.error(f"Check user vip error: {e}")
        return False


def check_user_token_sufficient(user_uuid: str, min_tokens: int = 1) -> dict[str, Any]:
    """Check if user has sufficient token balance."""
    if not user_uuid:
        return {"sufficient": False, "balance": 0, "user_uuid": "", "error": "empty uuid"}

    try:
        with get_session() as db:
            from app.models.user_models import UserMargin

            margin = db.query(UserMargin).filter(UserMargin.user_uuid == user_uuid).first()
            if not margin:
                return {"sufficient": False, "balance": 0, "user_uuid": user_uuid, "error": "user not found"}

            balance = margin.token_quantity or 0
            return {"sufficient": balance >= min_tokens, "balance": balance, "user_uuid": user_uuid}
    except Exception as e:
        logger.error(f"Check token error: {e}")
        return {"sufficient": False, "balance": 0, "user_uuid": user_uuid, "error": str(e)}


async def calculate_tokens_per_yuan(user_uuid: str | None) -> dict[str, Any]:
    """按用户 VIP 等级 + 促销期计算 1 元对应的 token 数.

    返回 dict: {tokens_per_yuan, user_vip_level, is_promotion_period, reason}
    """
    if not user_uuid:
        return {
            "tokens_per_yuan": settings.TOKEN_NORMAL_USER_PER_YUAN,
            "user_vip_level": 0,
            "is_promotion_period": False,
            "reason": "empty uuid, normal rate",
        }

    # 促销期优先 (不论 VIP 等级)
    promo = await is_active_promotion_period()
    if promo.get("is_active"):
        return {
            "tokens_per_yuan": settings.TOKEN_PROMOTION_PER_YUAN,
            "user_vip_level": 0,
            "is_promotion_period": True,
            "reason": "promotion period active",
        }

    try:
        with get_session() as db:
            from app.models.user_models import User

            user = db.query(User).filter(User.uuid == user_uuid).first()
            if not user:
                return {
                    "tokens_per_yuan": settings.TOKEN_NORMAL_USER_PER_YUAN,
                    "user_vip_level": 0,
                    "is_promotion_period": False,
                    "reason": "user not found",
                }
            level = int(getattr(user, "is_vip", 0) or 0)
            if level >= 2:
                rate = settings.TOKEN_TRADER_USER_PER_YUAN
                reason = "trader level 2"
            elif level >= 1:
                rate = settings.TOKEN_VIP_USER_PER_YUAN
                reason = "vip level 1"
            else:
                rate = settings.TOKEN_NORMAL_USER_PER_YUAN
                reason = "normal user level 0"
            return {
                "tokens_per_yuan": rate,
                "user_vip_level": level,
                "is_promotion_period": False,
                "reason": reason,
            }
    except Exception as e:
        logger.error(f"Calculate tokens per yuan error: {e}")
        return {
            "tokens_per_yuan": settings.TOKEN_NORMAL_USER_PER_YUAN,
            "user_vip_level": 0,
            "is_promotion_period": False,
            "reason": f"error: {e}",
        }


async def calculate_and_deduct_tokens_by_cost(
    user_uuid: str,
    yuan_cost: float,
    service_name: str,
    success: bool = True,
) -> dict[str, Any]:
    """Calculate token cost and deduct from user balance.

    P15-C2 改造: success=False 时短路返回 (success=True, tokens_deducted=0, reason="no deduction"),
                保持上游调用方期待 success 标志与 "no deduction" 描述.
    """
    if not success:
        return {"success": True, "tokens_deducted": 0, "reason": "no deduction (success=False)"}

    if not user_uuid:
        return {"success": False, "tokens_deducted": 0, "reason": "empty user_uuid"}

    try:
        rate_info = await calculate_tokens_per_yuan(user_uuid)
        rate = rate_info.get("tokens_per_yuan", settings.TOKEN_NORMAL_USER_PER_YUAN)
        tokens = round(rate * yuan_cost * settings.TOKEN_BASE_MULTIPLIER)
        result = deduct_user_token(user_uuid, tokens, desc=service_name)
        if not result.get("success"):
            return {
                "success": False,
                "tokens_deducted": 0,
                "reason": result.get("reason", "deduct failed"),
            }
        return {
            "success": True,
            "tokens_deducted": tokens,
            "balance": result.get("balance"),
            "yuan_cost": yuan_cost,
            "tokens_per_yuan": rate,
        }
    except Exception as e:
        logger.error(f"calculate_and_deduct_tokens_by_cost error: {e}")
        return {"success": False, "tokens_deducted": 0, "reason": str(e)}


async def calculate_and_deduct_tokens_for_hunyuan3d(
    user_uuid: str,
    success: bool = True,
) -> dict[str, Any]:
    """Hunyuan3D 固定按 1.5 元 / 次扣费."""
    if not success:
        return {"success": True, "tokens_deducted": 0, "reason": "no deduction (success=False)"}

    if not user_uuid:
        return {"success": False, "tokens_deducted": 0, "reason": "empty user_uuid"}

    try:
        rate_info = await calculate_tokens_per_yuan(user_uuid)
        rate = rate_info.get("tokens_per_yuan", settings.TOKEN_NORMAL_USER_PER_YUAN)
        tokens = round(rate * 1.5 * settings.TOKEN_BASE_MULTIPLIER)
        result = deduct_user_token(user_uuid, tokens, desc="hunyuan3d")
        if not result.get("success"):
            return {
                "success": False,
                "tokens_deducted": 0,
                "reason": result.get("reason", "deduct failed"),
            }
        return {
            "success": True,
            "tokens_deducted": tokens,
            "balance": result.get("balance"),
            "yuan_cost": 1.5,
        }
    except Exception as e:
        logger.error(f"calculate_and_deduct_tokens_for_hunyuan3d error: {e}")
        return {"success": False, "tokens_deducted": 0, "reason": str(e)}
