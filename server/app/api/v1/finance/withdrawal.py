"""提现管理路由."""


from fastapi import APIRouter, Depends, Query
from loguru import logger
from sqlalchemy import func

from app.database import get_session
from app.schemas.common import error, success
from app.security import require_login
from app.utils.order_generator import order_generator

router = APIRouter()


@router.post("/apply", summary="申请提现")
async def apply_withdrawal(
    amount: int = Query(..., description="提现金额(分)"),
    user_uuid: str = Depends(require_login),
):
    if amount <= 0:
        return error("提现金额必须大于 0")
    # Java: zhsWithdrawalDetail.setWithdrawalAmount(String.valueOf(resJson.getInt("amount")*0.98))
    # 扣除 2% 手续费
    actual_amount = int(amount * 0.98)
    with get_session() as db:
        try:
            from app.models.payment_models import WithdrawalFlow

            flow = WithdrawalFlow(
                user_id=user_uuid,
                amount=actual_amount,
                status=0,
                partner_trade_no=order_generator.generate(),
            )
            db.add(flow)
            db.commit()
            return success(
                {
                    "id": flow.id,
                    "partner_trade_no": flow.partner_trade_no,
                    "status": 0,
                    "original_amount": amount,
                    "actual_amount": actual_amount,
                    "fee": amount - actual_amount,
                }
            )
        except Exception as e:
            logger.error(f"Apply withdrawal error: {e}")
            return error(str(e))


@router.get("/list", summary="我的提现记录")
async def list_withdrawals(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        from app.models.payment_models import WithdrawalFlow

        q = db.query(WithdrawalFlow).filter(WithdrawalFlow.user_id == user_uuid)
        total = q.count()
        items = q.order_by(WithdrawalFlow.id.desc()).offset((page - 1) * limit).limit(limit).all()
        data = [
            {
                "id": w.id,
                "amount": w.amount,
                "status": w.status,
                "partner_trade_no": w.partner_trade_no,
                "payment_no": w.payment_no,
                "created_at": w.created_at.isoformat() if w.created_at else None,
            }
            for w in items
        ]
        return success(data, total=total)


@router.get("/summary", summary="提现详情面板数据(总提现/待审核/已到账)")
async def withdrawal_summary(user_uuid: str = Depends(require_login)):
    with get_session() as db:
        from app.models.payment_models import WithdrawalFlow

        total_amount = (
            db.query(func.sum(WithdrawalFlow.amount))
            .filter(
                WithdrawalFlow.user_id == user_uuid,
                WithdrawalFlow.status == 2,
            )
            .scalar()
            or 0
        )
        pending_amount = (
            db.query(func.sum(WithdrawalFlow.amount))
            .filter(
                WithdrawalFlow.user_id == user_uuid,
                WithdrawalFlow.status.in_([0, 1]),
            )
            .scalar()
            or 0
        )
        processing_amount = (
            db.query(func.sum(WithdrawalFlow.amount))
            .filter(
                WithdrawalFlow.user_id == user_uuid,
                WithdrawalFlow.status == 1,
            )
            .scalar()
            or 0
        )
        completed_count = (
            db.query(func.count(WithdrawalFlow.id))
            .filter(
                WithdrawalFlow.user_id == user_uuid,
                WithdrawalFlow.status == 2,
            )
            .scalar()
            or 0
        )
        pending_count = (
            db.query(func.count(WithdrawalFlow.id))
            .filter(
                WithdrawalFlow.user_id == user_uuid,
                WithdrawalFlow.status.in_([0, 1]),
            )
            .scalar()
            or 0
        )
        return success(
            {
                "total_withdrawn": total_amount,
                "pending_amount": pending_amount,
                "processing_amount": processing_amount,
                "completed_count": completed_count,
                "pending_count": pending_count,
            }
        )


@router.get("/available", summary="个人可收款查询")
async def available_balance(user_uuid: str = Depends(require_login)):
    with get_session() as db:
        from app.models.payment_models import CommissionFlow

        # Total earned commission (active status)
        total_commission = (
            db.query(func.sum(CommissionFlow.amount))
            .filter(CommissionFlow.user_id == user_uuid, CommissionFlow.status == 1)
            .scalar()
            or 0
        )
        # Total withdrawn (completed)
        from app.models.payment_models import WithdrawalFlow

        total_withdrawn = (
            db.query(func.sum(WithdrawalFlow.amount))
            .filter(
                WithdrawalFlow.user_id == user_uuid,
                WithdrawalFlow.status == 2,
            )
            .scalar()
            or 0
        )
        # Pending withdrawal
        total_pending = (
            db.query(func.sum(WithdrawalFlow.amount))
            .filter(
                WithdrawalFlow.user_id == user_uuid,
                WithdrawalFlow.status.in_([0, 1]),
            )
            .scalar()
            or 0
        )
        # Available = total_commission - total_withdrawn - total_pending
        available = total_commission - total_withdrawn - total_pending
        if available < 0:
            available = 0
        return success(
            {
                "total_commission": total_commission,
                "total_withdrawn": total_withdrawn,
                "total_pending": total_pending,
                "available": available,
            }
        )


@router.post("/agent/apply", summary="Agent 收益提现申请")
async def apply_agent_withdrawal(
    amount: int = Query(..., description="提现金额(分)"),
    user_uuid: str = Depends(require_login),
):
    if amount <= 0:
        return error("提现金额必须大于 0")
    with get_session() as db:
        try:
            import time
            import uuid as _uuid

            from app.models.agent_settlement import AgentWithdrawalDetail

            record = AgentWithdrawalDetail(
                id=str(_uuid.uuid4()),
                user_id=user_uuid,
                amount=amount,
                type=1,
                initiate_at=int(time.time() * 1000),
                status=0,
                out_bill_no=order_generator.generate(sequence=int(__import__("time").time()) % 10000000),
            )
            db.add(record)
            db.commit()
            return success({"id": record.id, "status": 0, "amount": amount})
        except Exception as e:
            logger.error(f"Agent withdrawal apply error: {e}")
            return error(str(e))


@router.get("/agent/list", summary="Agent 提现记录")
async def list_agent_withdrawals(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        from app.models.agent_settlement import AgentWithdrawalDetail

        q = db.query(AgentWithdrawalDetail).filter(AgentWithdrawalDetail.user_id == user_uuid)
        total = q.count()
        items = q.order_by(AgentWithdrawalDetail.initiate_at.desc()).offset((page - 1) * limit).limit(limit).all()
        data = [
            {
                "id": w.id,
                "amount": w.amount,
                "status": w.status,
                "initiate_at": w.initiate_at,
                "out_bill_no": w.out_bill_no,
                "payment_time": w.payment_time,
            }
            for w in items
        ]
        return success(data, total=total)
