"""Agent 提现路由(操作 zhs_agent_withdrawal_detail 表)."""

import time
import uuid

from fastapi import APIRouter, Depends, Query
from loguru import logger

from app.database import get_session
from app.schemas.common import error, success
from app.security import require_login
from app.utils.order_generator import order_generator

router = APIRouter()


@router.get("/list", summary="Agent 提现记录")
async def list_withdrawals(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: int = Query(None, description="0=待审 1=处理中 2=完成 3=失败"),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        from app.models.agent_settlement import AgentWithdrawalDetail

        q = db.query(AgentWithdrawalDetail).filter(AgentWithdrawalDetail.user_id == user_uuid)
        if status is not None:
            q = q.filter(AgentWithdrawalDetail.status == status)
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
                "reviewer": w.reviewer,
                "wechat_msg": w.wechat_msg,
            }
            for w in items
        ]
        return success(data, total=total)


@router.get("/{withdrawal_id}", summary="提现详情")
async def get_withdrawal(
    withdrawal_id: str,
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        from app.models.agent_settlement import AgentWithdrawalDetail

        record = (
            db.query(AgentWithdrawalDetail)
            .filter(
                AgentWithdrawalDetail.id == withdrawal_id,
                AgentWithdrawalDetail.user_id == user_uuid,
            )
            .first()
        )
        if not record:
            return error("提现记录不存在", "404")
        return success(
            {
                "id": record.id,
                "amount": record.amount,
                "status": record.status,
                "type": record.type,
                "initiate_at": record.initiate_at,
                "out_bill_no": record.out_bill_no,
                "payment_time": record.payment_time,
                "reviewer": record.reviewer,
                "reviewer_time": record.reviewer_time,
                "user_name": record.user_name,
                "open_id": record.open_id,
                "order_ids": record.order_ids,
                "wechat_msg": record.wechat_msg,
            }
        )


@router.post("/apply", summary="申请 Agent 提现")
async def apply_withdrawal(
    amount: int = Query(..., description="提现金额(分)"),
    order_ids: str = Query("", description="关联订单号,逗号分隔"),
    user_uuid: str = Depends(require_login),
):
    if amount <= 0:
        return error("提现金额必须大于 0")
    with get_session() as db:
        try:
            from app.models.agent_settlement import AgentWithdrawalDetail

            record = AgentWithdrawalDetail(
                id=str(uuid.uuid4()),
                user_id=user_uuid,
                amount=amount,
                type=1,
                initiate_at=int(time.time() * 1000),
                status=0,
                out_bill_no=order_generator.generate(sequence=int(time.time()) % 10000000),
                order_ids=order_ids or None,
            )
            db.add(record)
            db.commit()
            return success({"id": record.id, "amount": amount, "status": 0})
        except Exception as e:
            logger.error(f"Agent withdrawal apply error: {e}")
            return error(str(e))
