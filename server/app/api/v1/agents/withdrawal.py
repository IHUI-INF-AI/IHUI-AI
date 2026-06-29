"""Agent 提现路由(操作 zhs_agent_withdrawal_detail 表)."""

import time
import uuid
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Body, Depends, Query
from loguru import logger
from sqlalchemy import and_, func

from app.database import get_session
from app.schemas.common import error, success
from app.security import require_login
from app.utils.order_generator import order_generator

router = APIRouter()


def _now_ms() -> int:
    """当前毫秒时间戳."""
    return int(time.time() * 1000)


# ============================================================================
# 既有 endpoint(保留并增强)
# ============================================================================


@router.get("/list", summary="Agent 提现记录")
async def list_withdrawals(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: int = Query(None, description="0=待审 1=处理中 2=完成 3=失败"),
    time_range_type: int = Query(
        None, description="时间范围类型 1=7日 2=1月 3=1年 4=全部"
    ),
    withdrawal_no: str = Query(None, description="提现订单号(out_bill_no)模糊查询"),
    withdrawal_type: int = Query(None, description="提现类型 type"),
    min_amount: int = Query(None, description="最小金额(分)"),
    max_amount: int = Query(None, description="最大金额(分)"),
    sort_by: str = Query("initiate_at", description="排序字段"),
    sort_order: str = Query("desc", description="排序方向 asc/desc"),
    user_uuid: str = Depends(require_login),
):
    """分页查询当前用户的提现记录,支持状态/时间范围/订单号/类型/金额范围/排序."""
    with get_session() as db:
        from app.models.agent_settlement import AgentWithdrawalDetail

        q = db.query(AgentWithdrawalDetail).filter(
            AgentWithdrawalDetail.user_id == user_uuid
        )
        if status is not None:
            q = q.filter(AgentWithdrawalDetail.status == status)
        if withdrawal_type is not None:
            q = q.filter(AgentWithdrawalDetail.type == withdrawal_type)
        if withdrawal_no:
            q = q.filter(AgentWithdrawalDetail.out_bill_no.like(f"%{withdrawal_no}%"))
        if min_amount is not None:
            q = q.filter(AgentWithdrawalDetail.amount >= min_amount)
        if max_amount is not None:
            q = q.filter(AgentWithdrawalDetail.amount <= max_amount)
        if time_range_type is not None:
            now = datetime.now()
            if time_range_type == 1:
                start = now - timedelta(days=7)
                q = q.filter(AgentWithdrawalDetail.initiate_at >= int(start.timestamp() * 1000))
            elif time_range_type == 2:
                start = now - timedelta(days=30)
                q = q.filter(AgentWithdrawalDetail.initiate_at >= int(start.timestamp() * 1000))
            elif time_range_type == 3:
                start = now - timedelta(days=365)
                q = q.filter(AgentWithdrawalDetail.initiate_at >= int(start.timestamp() * 1000))
            elif time_range_type == 4:
                pass  # 全部
            else:
                return error("time_range_type 必须是 1/2/3/4", "400000")
        sort_column = getattr(AgentWithdrawalDetail, sort_by, None) or AgentWithdrawalDetail.initiate_at
        q = q.order_by(sort_column.asc() if sort_order.lower() == "asc" else sort_column.desc())
        total = q.count()
        items = q.offset((page - 1) * limit).limit(limit).all()
        data = [
            {
                "id": w.id,
                "amount": w.amount,
                "status": w.status,
                "type": w.type,
                "initiate_at": w.initiate_at,
                "out_bill_no": w.out_bill_no,
                "transaction_id": w.transaction_id,
                "payment_time": w.payment_time,
                "reviewer": w.reviewer,
                "reviewer_time": w.reviewer_time,
                "user_name": w.user_name,
                "open_id": w.open_id,
                "order_ids": w.order_ids,
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
            return error("提现记录不存在", "404000")
        return success(
            {
                "id": record.id,
                "amount": record.amount,
                "status": record.status,
                "type": record.type,
                "initiate_at": record.initiate_at,
                "out_bill_no": record.out_bill_no,
                "transaction_id": record.transaction_id,
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
    order_ids: str = Query("", description="关联结算记录 ID,逗号分隔"),
    open_id: str = Query("", description="微信 open_id"),
    type: int = Query(1, description="提现类型"),
    user_uuid: str = Depends(require_login),
):
    """创建提现申请,并回写关联 AgentSettlement.withdrawal_id."""
    if amount <= 0:
        return error("提现金额必须大于 0", "400000")
    with get_session() as db:
        try:
            from app.models.agent_settlement import (
                AgentSettlement,
                AgentWithdrawalDetail,
            )

            record = AgentWithdrawalDetail(
                id=str(uuid.uuid4()),
                user_id=user_uuid,
                amount=amount,
                type=type,
                open_id=open_id or None,
                initiate_at=_now_ms(),
                status=0,
                out_bill_no=order_generator.generate(
                    sequence=int(time.time()) % 10000000
                ),
                order_ids=order_ids or None,
            )
            db.add(record)
            db.flush()
            # 回写结算表 AgentSettlement.withdrawal_id
            updated_count = 0
            if order_ids:
                settlement_ids = [
                    s.strip() for s in order_ids.split(",") if s.strip()
                ]
                if settlement_ids:
                    updated_count = (
                        db.query(AgentSettlement)
                        .filter(AgentSettlement.id.in_(settlement_ids))
                        .update(
                            {AgentSettlement.withdrawal_id: record.id},
                            synchronize_session=False,
                        )
                    )
            db.commit()
            return success(
                {
                    "id": record.id,
                    "amount": amount,
                    "status": 0,
                    "out_bill_no": record.out_bill_no,
                    "settlement_updated": updated_count,
                }
            )
        except Exception as e:
            logger.error(f"Agent withdrawal apply error: {e}")
            db.rollback()
            return error(str(e))


# ============================================================================
# 新增 endpoint(带 /withdrawal 子前缀)
# ============================================================================


@router.put("/withdrawal/{withdrawal_id}", summary="更新提现明细")
async def update_withdrawal_detail(
    withdrawal_id: str,
    payload: dict = Body(...),
    user_uuid: str = Depends(require_login),
):
    """更新提现明细字段(amount/type/open_id/order_ids/user_name/wechat_msg)."""
    with get_session() as db:
        try:
            from app.models.agent_settlement import AgentWithdrawalDetail

            record = (
                db.query(AgentWithdrawalDetail)
                .filter(AgentWithdrawalDetail.id == withdrawal_id)
                .first()
            )
            if not record:
                return error("提现记录不存在", "404000")
            allowed = {
                "amount",
                "type",
                "open_id",
                "order_ids",
                "user_name",
                "wechat_msg",
                "transaction_id",
            }
            for k, v in payload.items():
                if k in allowed and v is not None:
                    setattr(record, k, v)
            db.commit()
            return success(
                {
                    "id": record.id,
                    "amount": record.amount,
                    "status": record.status,
                    "type": record.type,
                    "open_id": record.open_id,
                    "order_ids": record.order_ids,
                    "user_name": record.user_name,
                    "transaction_id": record.transaction_id,
                }
            )
        except Exception as e:
            logger.error(f"Update withdrawal detail error: {e}")
            db.rollback()
            return error(str(e))


@router.delete("/withdrawal/{withdrawal_id}", summary="删除提现明细")
async def delete_withdrawal_detail(
    withdrawal_id: str,
    user_uuid: str = Depends(require_login),
):
    """删除提现明细(仅 status=0 待审核状态可删除)."""
    with get_session() as db:
        try:
            from app.models.agent_settlement import AgentWithdrawalDetail

            record = (
                db.query(AgentWithdrawalDetail)
                .filter(AgentWithdrawalDetail.id == withdrawal_id)
                .first()
            )
            if not record:
                return error("提现记录不存在", "404000")
            if record.status != 0:
                return error("仅待审核状态的提现申请可删除", "400000")
            out_bill_no = record.out_bill_no
            db.delete(record)
            db.commit()
            return success(
                {
                    "id": withdrawal_id,
                    "out_bill_no": out_bill_no,
                    "msg": "提现明细删除成功",
                }
            )
        except Exception as e:
            logger.error(f"Delete withdrawal detail error: {e}")
            db.rollback()
            return error(str(e))


@router.post("/withdrawal/{withdrawal_id}/review", summary="提现审核")
async def review_withdrawal(
    withdrawal_id: str,
    payload: dict = Body(...),
    user_uuid: str = Depends(require_login),
):
    """审核提现申请.

    payload:
      action: approve / reject
      reviewer: 审核人(可选,默认当前登录用户)
    approve → status=1 处理中
    reject  → status=3 失败
    """
    action = (payload.get("action") or "").lower()
    if action not in ("approve", "reject"):
        return error("action 必须是 approve 或 reject", "400000")
    reviewer = payload.get("reviewer") or user_uuid
    with get_session() as db:
        try:
            from app.models.agent_settlement import AgentWithdrawalDetail

            record = (
                db.query(AgentWithdrawalDetail)
                .filter(AgentWithdrawalDetail.id == withdrawal_id)
                .first()
            )
            if not record:
                return error("提现记录不存在", "404000")
            if record.status != 0:
                return error("仅待审核状态的申请可审核", "400000")
            if action == "approve":
                record.status = 1
                result_text = "审核通过"
            else:
                record.status = 3
                result_text = "已拒绝"
            record.reviewer = reviewer
            record.reviewer_time = _now_ms()
            db.commit()
            return success(
                {
                    "id": withdrawal_id,
                    "out_bill_no": record.out_bill_no,
                    "status": record.status,
                    "reviewer": record.reviewer,
                    "reviewer_time": record.reviewer_time,
                    "review_result": result_text,
                }
            )
        except Exception as e:
            logger.error(f"Review withdrawal error: {e}")
            db.rollback()
            return error(str(e))


@router.post("/withdrawal/{withdrawal_id}/process", summary="提现处理")
async def process_withdrawal(
    withdrawal_id: str,
    payload: dict = Body(...),
    user_uuid: str = Depends(require_login),
):
    """处理提现申请.

    payload:
      status: 1=处理中 2=完成(成功) 3=失败
      transaction_id: 第三方交易号(可选,成功时记录)
    成功(status=2)时记录 payment_time,并更新关联 AgentSettlement.withdrawal=1
    """
    new_status = payload.get("status")
    if new_status not in (1, 2, 3):
        return error("status 必须是 1(处理中)/2(完成)/3(失败)", "400000")
    transaction_id = payload.get("transaction_id")
    with get_session() as db:
        try:
            from app.models.agent_settlement import (
                AgentSettlement,
                AgentWithdrawalDetail,
            )

            record = (
                db.query(AgentWithdrawalDetail)
                .filter(AgentWithdrawalDetail.id == withdrawal_id)
                .first()
            )
            if not record:
                return error("提现记录不存在", "404000")
            if record.status not in (0, 1):
                return error("仅待审核或处理中状态可处理", "400000")
            record.status = new_status
            # transaction_id 写入独立字段 (Round 22 扩展)
            if transaction_id:
                record.transaction_id = transaction_id
            if new_status == 2:
                record.payment_time = _now_ms()
                # 更新关联结算记录 withdrawal=1
                if record.order_ids:
                    settlement_ids = [
                        s.strip() for s in record.order_ids.split(",") if s.strip()
                    ]
                    if settlement_ids:
                        db.query(AgentSettlement).filter(
                            AgentSettlement.id.in_(settlement_ids)
                        ).update(
                            {AgentSettlement.withdrawal: "1"},
                            synchronize_session=False,
                        )
            db.commit()
            status_map = {1: "处理中", 2: "完成", 3: "失败"}
            return success(
                {
                    "id": withdrawal_id,
                    "out_bill_no": record.out_bill_no,
                    "transaction_id": record.transaction_id,
                    "status": record.status,
                    "process_result": status_map.get(new_status, "未知"),
                    "payment_time": record.payment_time,
                }
            )
        except Exception as e:
            logger.error(f"Process withdrawal error: {e}")
            db.rollback()
            return error(str(e))


@router.get("/withdrawal/stats/overview", summary="提现统计概览")
async def get_withdrawal_stats(
    start_date: str = Query(None, description="开始时间 YYYY-MM-DD"),
    end_date: str = Query(None, description="结束时间 YYYY-MM-DD"),
    user_id: str = Query(None, description="用户ID(管理员用)"),
    user_uuid: str = Depends(require_login),
):
    """返回各状态数量/金额/完成率/成功率."""
    with get_session() as db:
        try:
            from app.models.agent_settlement import AgentWithdrawalDetail

            q = db.query(AgentWithdrawalDetail)
            conditions: list[Any] = []
            if user_id:
                conditions.append(AgentWithdrawalDetail.user_id == user_id)
            if start_date:
                try:
                    start_dt = datetime.strptime(start_date, "%Y-%m-%d")
                    conditions.append(
                        AgentWithdrawalDetail.initiate_at
                        >= int(start_dt.timestamp() * 1000)
                    )
                except ValueError:
                    return error("start_date 格式应为 YYYY-MM-DD", "400000")
            if end_date:
                try:
                    end_dt = datetime.strptime(
                        end_date + " 23:59:59", "%Y-%m-%d %H:%M:%S"
                    )
                    conditions.append(
                        AgentWithdrawalDetail.initiate_at
                        <= int(end_dt.timestamp() * 1000)
                    )
                except ValueError:
                    return error("end_date 格式应为 YYYY-MM-DD", "400000")
            if conditions:
                q = q.filter(and_(*conditions))
            total_count = q.count()
            pending_count = q.filter(AgentWithdrawalDetail.status == 0).count()
            processing_count = q.filter(AgentWithdrawalDetail.status == 1).count()
            completed_count = q.filter(AgentWithdrawalDetail.status == 2).count()
            failed_count = q.filter(AgentWithdrawalDetail.status == 3).count()
            total_amount = (
                q.with_entities(func.sum(AgentWithdrawalDetail.amount)).scalar() or 0
            )
            completed_amount = (
                q.filter(AgentWithdrawalDetail.status == 2)
                .with_entities(func.sum(AgentWithdrawalDetail.amount))
                .scalar()
                or 0
            )
            pending_amount = (
                q.filter(AgentWithdrawalDetail.status.in_([0, 1]))
                .with_entities(func.sum(AgentWithdrawalDetail.amount))
                .scalar()
                or 0
            )
            return success(
                {
                    "total_count": total_count,
                    "pending_count": pending_count,
                    "processing_count": processing_count,
                    "completed_count": completed_count,
                    "failed_count": failed_count,
                    "total_amount": total_amount,
                    "completed_amount": completed_amount,
                    "pending_amount": pending_amount,
                    "completion_rate": (
                        round(completed_count / total_count * 100, 2)
                        if total_count
                        else 0
                    ),
                    "success_rate": (
                        round(completed_amount / total_amount * 100, 2)
                        if total_amount
                        else 0
                    ),
                }
            )
        except Exception as e:
            logger.error(f"Withdrawal stats error: {e}")
            return error(str(e))


@router.post("/withdrawal/batch-delete", summary="批量删除提现")
async def batch_delete_withdrawals(
    payload: dict = Body(...),
    user_uuid: str = Depends(require_login),
):
    """批量删除提现记录(仅 status=0).

    payload: {"id_list": ["id1", "id2"]}
    """
    id_list = payload.get("id_list") or []
    if not id_list or not isinstance(id_list, list):
        return error("id_list 必须为非空列表", "400000")
    with get_session() as db:
        try:
            from app.models.agent_settlement import AgentWithdrawalDetail

            records = (
                db.query(AgentWithdrawalDetail)
                .filter(AgentWithdrawalDetail.id.in_(id_list))
                .all()
            )
            if not records:
                return error("未找到要删除的记录", "404000")
            invalid = [r for r in records if r.status != 0]
            if invalid:
                return error(
                    f"以下记录非待审核状态无法删除: {','.join(r.id for r in invalid)}",
                    "400000",
                )
            for r in records:
                db.delete(r)
            db.commit()
            return success(
                {
                    "deleted_count": len(records),
                    "ids": [r.id for r in records],
                    "msg": f"批量删除成功,共删除 {len(records)} 条",
                }
            )
        except Exception as e:
            logger.error(f"Batch delete withdrawals error: {e}")
            db.rollback()
            return error(str(e))
