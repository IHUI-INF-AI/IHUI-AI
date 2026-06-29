"""用户余额 / 代币管理路由."""

from fastapi import APIRouter, Depends, Query
from loguru import logger

from app.schemas.common import error, success
from app.security import require_login
from app.services import token_service
from app.services.token_cache_service import (
    get_balance_cached,
    invalidate_balance_cache,
)

router = APIRouter()


@router.get("/balance", summary="查询用户 token 余额(Redis 缓存 5 分钟)")
async def get_balance(user_uuid: str = Depends(require_login)):
    return success(get_balance_cached(user_uuid))


@router.get("/check", summary="检查余额是否充足")
async def check_balance(
    min_tokens: int = Query(..., description="所需 token 数"),
    user_uuid: str = Depends(require_login),
):
    return success(token_service.check_user_token(user_uuid, min_tokens))


@router.post("/deduct", summary="扣减用户 token(内部调用)")
async def deduct(
    quantity: int = Query(..., description="扣减数量"),
    remark: str = Query("", description="操作描述"),
    user_uuid: str = Depends(require_login),
):
    result = token_service.deduct_user_token(user_uuid, quantity, desc=remark or "API 扣减")
    if not result["success"]:
        return error(result.get("reason", "扣减失败"))
    return success(
        {
            "user_uuid": user_uuid,
            "deducted": quantity,
            "balance": result["balance"],
        }
    )


@router.post("/recharge", summary="充值 token(与支付订单配合使用)")
async def recharge(
    quantity: int = Query(..., description="充值数量"),
    out_trade_no: str = Query(..., description="支付订单号"),
    user_uuid: str = Depends(require_login),
):
    result = token_service.recharge_token(user_uuid, quantity, out_trade_no=out_trade_no)
    if not result["success"]:
        return error(result.get("reason", "充值失败"))
    return success(
        {
            "user_uuid": user_uuid,
            "recharged": quantity,
            "balance": result["balance"],
        }
    )


@router.post("/expire", summary="过期清零(管理员/定时任务)")
async def expire(
    quantity: int = Query(..., description="过期数量"),
    source: str = Query("到期清零"),
    user_uuid: str = Depends(require_login),
):
    result = token_service.expire_token(user_uuid, quantity, source=source)  # type: ignore[attr-defined]
    if not result["success"]:
        return error(result.get("reason", "过期失败"))
    return success(
        {
            "user_uuid": user_uuid,
            "expired": result.get("expired", 0),
            "balance": result["balance"],
        }
    )


@router.post("/commission", summary="佣金入账(邀请分成)")
async def grant_commission(
    quantity: int = Query(..., description="佣金数量"),
    invited_user_id: str = Query("", description="被邀请人 uuid"),
    source: str = Query("invite", description="来源"),
    user_uuid: str = Depends(require_login),
):
    result = token_service.grant_commission(  # type: ignore[call-arg]
        user_uuid,
        quantity,
        invited_user_id=invited_user_id,
        source=source,
    )
    if not result["success"]:
        return error(result.get("reason", "佣金入账失败"))
    return success(
        {
            "user_uuid": user_uuid,
            "granted": quantity,
            "balance": result["balance"],
        }
    )


@router.post("/refund", summary="Token 回退(退还指定数量 token 到用户余额)")
async def refund_token(
    quantity: int = Query(..., description="回退数量"),
    remark: str = Query("", description="操作说明"),
    user_uuid: str = Depends(require_login),
):
    result = token_service.refund_token(  # type: ignore[call-arg]
        user_uuid,
        quantity,
        out_trade_no=remark or "手动回退",
    )
    if not result["success"]:
        return error(result.get("reason", "回退失败"))
    try:
        invalidate_balance_cache(user_uuid)
    except Exception:
        logger.warning("Caught unexpected exception")
    return success(
        {
            "user_uuid": user_uuid,
            "refunded": quantity,
            "balance": result["balance"],
        }
    )


@router.put("/{target_user_uuid}", summary="管理员直接调整用户 Token 余额")
async def admin_adjust_balance(
    target_user_uuid: str,
    quantity: int = Query(..., description="调整数量(正数增加/负数扣减)"),
    reason: str = Query("管理员调整", description="操作原因"),
    user_uuid: str = Depends(require_login),
):
    """P15-C2 改造: 改用 require_login + 内部 role 断言, 避免 FastAPI 0.116 + Python 3.13
    对 Depends(require_role("admin")) 嵌套闭包的签名解析报错 (no signature for builtin str)."""
    from app.services.auth_service import assert_user_has_role

    assert_user_has_role(user_uuid, "admin")
    if quantity == 0:
        return error("调整数量不能为 0")
    if quantity > 0:
        result = token_service.recharge_token(target_user_uuid, quantity, out_trade_no=f"admin:{user_uuid}")
    else:
        result = token_service.deduct_user_token(target_user_uuid, abs(quantity), desc=f"管理员扣减:{reason}")
    if not result["success"]:
        return error(result.get("reason", "调整失败"))
    try:
        invalidate_balance_cache(target_user_uuid)
    except Exception:
        logger.warning("Caught unexpected exception")
    return success(
        {
            "user_uuid": target_user_uuid,
            "adjusted": quantity,
            "balance": result["balance"],
        }
    )


@router.get("/flows", summary="用户 token 流水(支持按类型过滤)")
async def list_flows(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    op_type: int = Query(None, description="0=充值 1=扣减 2=过期 3=退款 4=佣金"),
    user_uuid: str = Depends(require_login),
):
    result = token_service.list_token_flows(user_uuid, page, limit, op_type=op_type)  # type: ignore[attr-defined]
    return success(result["items"], total=result["total"])


@router.get("/flow/list", summary="Token 操作流水列表(管理员)")
async def list_token_flow_admin(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user_id: str = Query(None, description="按用户 UUID 过滤"),
    op_type: int = Query(None, description="操作类型过滤"),
    user_uuid: str = Depends(require_login),
):
    from app.database import get_session
    from app.models.payment_models import OperateTokenFlow

    with get_session() as db:
        q = db.query(OperateTokenFlow)
        if user_id:
            q = q.filter(OperateTokenFlow.user_id == user_id)
        if op_type is not None:
            q = q.filter(OperateTokenFlow.type == op_type)
        total = q.count()
        items = q.order_by(OperateTokenFlow.id.desc()).offset((page - 1) * limit).limit(limit).all()
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
        return success(data, total=total)
