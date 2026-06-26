"""Agent 提现审核/处理管理路由 (管理员后台).

迁移自历史项目 coze_zhs_py/api/agent_withdrawal_detail.py, 适配当前项目:
  - ORM: app.models.agent_settlement.AgentWithdrawalDetail (TimestampMixin, 无 deleted_at)
  - 认证: app.security.require_role("admin") (项目无 app.core.auth 模块, 统一用 require_role)
  - 数据库: app.database.get_session (同步上下文管理器, 项目无 get_async_session)
  - 响应: app.schemas.common.success / error (6 位错误码 ErrorCode 枚举)
  - 软删除: AgentWithdrawalDetail 当前未挂 SoftDeleteMixin, 用 soft_delete_filter 助手
    兼容过滤 (字段不存在则不加条件); 待后续模型加 deleted_at 字段后自动生效

注册方式 (由主流程统一处理, 不在此文件 import):
    from app.api.v1.agents.withdrawal_admin import router as agent_withdrawal_admin_router
    api_router.include_router(
        agent_withdrawal_admin_router,
        prefix="/agents/withdrawal-admin",
        tags=["Agent Withdrawal Admin"],
    )
    # 最终路径: /api/v1/agents/withdrawal-admin/{endpoint}

状态码约定 (status, Integer):
    0 = 待审核   1 = 审核通过   2 = 提现中   3 = 提现成功   4 = 提现失败   5 = 已拒绝

字段映射说明 (历史 -> 当前模型):
    review_user / review_time / review_remark  -> reviewer / reviewer_time / wechat_msg(JSON)
    process_user / process_time / process_remark -> reviewer / payment_time / wechat_msg(JSON)
    transaction_id / failure_reason / complete_time -> wechat_msg(JSON) / payment_time
    扩展字段统一以 JSON 存入 wechat_msg 列, 响应时解析回显, 避免改动表结构.
"""

import json
import math
import time
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, Query
from loguru import logger
from pydantic import BaseModel, Field
from sqlalchemy import and_, asc, desc, func

from app.database import get_session
from app.models.agent_settlement import AgentWithdrawalDetail
from app.models.base import soft_delete_filter
from app.schemas.common import error, success
from app.schemas.error_codes import ErrorCode
from app.security import require_role

router = APIRouter(prefix="/withdrawal-admin", tags=["Agent Withdrawal Admin"])

# ---------------------------------------------------------------------------
# 常量
# ---------------------------------------------------------------------------

STATUS_PENDING = 0  # 待审核
STATUS_APPROVED = 1  # 审核通过
STATUS_PROCESSING = 2  # 提现中
STATUS_SUCCESS = 3  # 提现成功
STATUS_FAILED = 4  # 提现失败
STATUS_REJECTED = 5  # 已拒绝

# 允许排序的白名单字段, 防止任意字段注入
_ALLOWED_SORT_FIELDS = {
    "initiate_at": AgentWithdrawalDetail.initiate_at,
    "amount": AgentWithdrawalDetail.amount,
    "status": AgentWithdrawalDetail.status,
    "created_at": AgentWithdrawalDetail.created_at,
}

# 时间范围类型: 1=7日 2=1月 3=1年 4=全部
_TIME_RANGE_DAYS = {1: 7, 2: 30, 3: 365}

_ADMIN_DEP = Depends(require_role("admin"))


# ---------------------------------------------------------------------------
# Pydantic 请求模型
# ---------------------------------------------------------------------------


class WithdrawalUpdate(BaseModel):
    """更新提现明细 (仅允许修改业务字段, 不含 id/user_id/status 等关键字段)."""

    amount: int | None = Field(default=None, description="提现金额(分)")
    type: int | None = Field(default=None, description="提现类型")
    user_name: str | None = Field(default=None, description="用户名")
    open_id: str | None = Field(default=None, description="收款方 open_id")
    order_ids: str | None = Field(default=None, description="关联订单号, 逗号分隔")
    wechat_msg: str | None = Field(default=None, description="留言/备注原文")


class WithdrawalReview(BaseModel):
    """审核提现申请."""

    status: int = Field(..., description="审核结果: 1=通过, 5=拒绝")
    review_remark: str | None = Field(default=None, description="审核备注")


class WithdrawalProcess(BaseModel):
    """处理提现申请."""

    status: int = Field(..., description="处理结果: 2=提现中, 3=成功, 4=失败")
    transaction_id: str | None = Field(default=None, description="交易号(成功时填)")
    process_remark: str | None = Field(default=None, description="处理备注")
    failure_reason: str | None = Field(default=None, description="失败原因(失败时填)")


class BatchDeleteRequest(BaseModel):
    """批量删除请求."""

    withdrawal_ids: list[str] = Field(..., description="要删除的提现记录 ID 列表")


# ---------------------------------------------------------------------------
# 辅助函数
# ---------------------------------------------------------------------------


def _mask_user(uid: str | None) -> str:
    """用户 ID 脱敏 (前4后4, 中间星号)."""
    if not uid:
        return "None"
    s = str(uid)
    if len(s) <= 8:
        return s[:2] + "***"
    return s[:4] + "***" + s[-4:]


def _mask_openid(oid: str | None) -> str:
    """open_id 脱敏 (前6后4)."""
    if not oid:
        return "None"
    s = str(oid)
    if len(s) <= 10:
        return s[:2] + "***"
    return s[:6] + "***" + s[-4:]


def _get_ext(record: AgentWithdrawalDetail) -> dict[str, Any]:
    """从 wechat_msg 列解析扩展字段 (JSON). 解析失败返回空 dict."""
    if not record.wechat_msg:
        return {}
    try:
        data = json.loads(record.wechat_msg)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _set_ext(record: AgentWithdrawalDetail, **kwargs: Any) -> None:
    """把扩展字段合并写入 wechat_msg (JSON). None 值跳过."""
    ext = _get_ext(record)
    for k, v in kwargs.items():
        if v is not None:
            ext[k] = v
    record.wechat_msg = json.dumps(ext, ensure_ascii=False)


def _to_dict(w: AgentWithdrawalDetail) -> dict[str, Any]:
    """序列化提现记录, 含扩展字段回显.

    2026-06-26: 优先使用独立列 (review_remark/process_remark/transaction_id/
    failure_reason), 回退到 wechat_msg JSON (兼容历史数据).
    """
    ext = _get_ext(w)
    return {
        "id": w.id,
        "user_id": w.user_id,
        "amount": w.amount,
        "type": w.type,
        "status": w.status,
        "initiate_at": w.initiate_at,
        "reviewer": w.reviewer,
        "reviewer_time": w.reviewer_time,
        "payment_time": w.payment_time,
        "out_bill_no": w.out_bill_no,
        "user_name": w.user_name,
        "open_id": w.open_id,
        "order_ids": w.order_ids,
        "wechat_msg": w.wechat_msg,
        # 扩展字段回显: 优先独立列, 回退到 wechat_msg JSON
        "review_remark": w.review_remark or ext.get("review_remark"),
        "process_remark": w.process_remark or ext.get("process_remark"),
        "transaction_id": w.transaction_id or ext.get("transaction_id"),
        "failure_reason": w.failure_reason or ext.get("failure_reason"),
        "deleted_at": w.deleted_at.isoformat() if getattr(w, "deleted_at", None) else None,
        "created_at": w.created_at.isoformat() if w.created_at else None,
        "updated_at": w.updated_at.isoformat() if w.updated_at else None,
    }


def _now_ms() -> int:
    """当前毫秒时间戳 (与 initiate_at/reviewer_time/payment_time 单位一致)."""
    return int(time.time() * 1000)


def _base_query(db):
    """返回带软删除过滤的基础 query.

    2026-06-26: AgentWithdrawalDetail 已补 deleted_at 字段, 显式过滤软删除记录.
    """
    q = db.query(AgentWithdrawalDetail)
    # 显式使用 deleted_at 字段过滤 (兼容字段不存在场景)
    sd = soft_delete_filter(AgentWithdrawalDetail, "deleted_at", None)
    if sd is not True:
        q = q.filter(sd)
    return q


def _get_or_none(db, withdrawal_id: str) -> AgentWithdrawalDetail | None:
    """按 id 查询单条 (带软删除过滤)."""
    return _base_query(db).filter(AgentWithdrawalDetail.id == withdrawal_id).first()


# ---------------------------------------------------------------------------
# 端点
# ---------------------------------------------------------------------------


@router.get("/list", summary="提现明细列表(增强版, 管理员)")
async def list_withdrawals_admin(
    user_id: str | None = Query(None, description="用户 ID (可选, 不传则全量)"),
    type: int | None = Query(None, description="时间范围: 1=7日 2=1月 3=1年 4=全部"),
    status: int | None = Query(None, description="提现状态 0-5"),
    withdrawal_no: str | None = Query(None, description="提现订单号(模糊匹配)"),
    withdrawal_type: int | None = Query(None, description="提现类型"),
    min_amount: int | None = Query(None, description="最小金额(分)"),
    max_amount: int | None = Query(None, description="最大金额(分)"),
    sort_by: str = Query("initiate_at", description="排序字段: initiate_at/amount/status/created_at"),
    sort_order: str = Query("desc", description="排序方向 asc/desc"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页大小"),
    _admin: str = _ADMIN_DEP,
):
    """分页查询提现明细, 支持时间范围/金额范围/排序.

    时间范围 type: 1=7日内 2=1个月内 3=1年内 4=所有数据 (不传则不过滤时间).
    """
    try:
        logger.info(
            f"withdrawal_admin list: user={_mask_user(user_id) if user_id else 'ALL'}, "
            f"type={type}, status={status}, page={page}"
        )

        with get_session() as db:
            q = _base_query(db)
            conditions = []

            if user_id:
                conditions.append(AgentWithdrawalDetail.user_id == user_id)
            if status is not None:
                conditions.append(AgentWithdrawalDetail.status == status)
            if withdrawal_type is not None:
                conditions.append(AgentWithdrawalDetail.type == withdrawal_type)
            if withdrawal_no:
                conditions.append(AgentWithdrawalDetail.out_bill_no.like(f"%{withdrawal_no}%"))
            if min_amount is not None:
                conditions.append(AgentWithdrawalDetail.amount >= min_amount)
            if max_amount is not None:
                conditions.append(AgentWithdrawalDetail.amount <= max_amount)

            # 时间范围过滤 (initiate_at 为毫秒时间戳)
            time_desc = "所有时间"
            if type is not None:
                if type not in (1, 2, 3, 4):
                    return error(
                        "type 参数必须是 1(7日内)/2(1个月内)/3(1年内)/4(所有数据)",
                        ErrorCode.BAD_REQUEST,
                    )
                if type in _TIME_RANGE_DAYS:
                    start_ts = int((datetime.now() - timedelta(days=_TIME_RANGE_DAYS[type])).timestamp() * 1000)
                    conditions.append(AgentWithdrawalDetail.initiate_at >= start_ts)
                    time_desc = {"1": "7日内", "2": "1个月内", "3": "1年内"}[str(type)]

            if conditions:
                q = q.filter(and_(*conditions))

            # 排序 (白名单校验)
            sort_column = _ALLOWED_SORT_FIELDS.get(sort_by, AgentWithdrawalDetail.initiate_at)
            q = q.order_by(asc(sort_column) if sort_order.lower() == "asc" else desc(sort_column))

            total = q.count()
            offset = (page - 1) * page_size
            items = q.offset(offset).limit(page_size).all()

            data = [_to_dict(w) for w in items]
            total_pages = math.ceil(total / page_size) if total > 0 else 0

            logger.info(f"withdrawal_admin list ok: total={total}, page_records={len(data)}")
            return success(
                {
                    "items": data,
                    "total": total,
                    "page": page,
                    "page_size": page_size,
                    "total_pages": total_pages,
                    "time_range_type": type,
                    "time_range_desc": time_desc,
                }
            )
    except Exception as e:
        logger.debug(f"withdrawal_admin list error: {e}")
        return error("查询提现明细失败", ErrorCode.INTERNAL_ERROR)


@router.get("/stats/overview", summary="提现统计概览(管理员)")
async def get_withdrawal_stats(
    start_date: str | None = Query(None, description="开始时间 YYYY-MM-DD"),
    end_date: str | None = Query(None, description="结束时间 YYYY-MM-DD"),
    user_id: str | None = Query(None, description="用户 ID"),
    _admin: str = _ADMIN_DEP,
):
    """提现统计概览: 各状态数量 / 总金额 / 已完成金额 / 待处理金额 / 完成率 / 成功率.

    金额单位: 元 (float), 由模型 amount(分) 除以 100 得到.
    """
    try:
        logger.info(
            f"withdrawal_admin stats: user={_mask_user(user_id) if user_id else 'ALL'}, "
            f"start={start_date}, end={end_date}"
        )

        with get_session() as db:
            q = _base_query(db)
            conditions = []

            if user_id:
                conditions.append(AgentWithdrawalDetail.user_id == user_id)

            if start_date:
                try:
                    start_ts = int(datetime.strptime(start_date, "%Y-%m-%d").timestamp() * 1000)
                except ValueError:
                    return error("开始时间格式错误, 应为 YYYY-MM-DD", ErrorCode.BAD_REQUEST)
                conditions.append(AgentWithdrawalDetail.initiate_at >= start_ts)

            if end_date:
                try:
                    end_ts = int(
                        datetime.strptime(end_date + " 23:59:59", "%Y-%m-%d %H:%M:%S").timestamp() * 1000
                    )
                except ValueError:
                    return error("结束时间格式错误, 应为 YYYY-MM-DD", ErrorCode.BAD_REQUEST)
                conditions.append(AgentWithdrawalDetail.initiate_at <= end_ts)

            base_filter = and_(*conditions) if conditions else None

            def _count(status_value: int | None = None) -> int:
                qq = _base_query(db)
                if base_filter is not None:
                    qq = qq.filter(base_filter)
                if status_value is not None:
                    qq = qq.filter(AgentWithdrawalDetail.status == status_value)
                return qq.count()

            def _sum_amount(status_values: list[int] | None = None) -> float:
                qq = _base_query(db).with_entities(func.sum(AgentWithdrawalDetail.amount))
                if base_filter is not None:
                    qq = qq.filter(base_filter)
                if status_values is not None:
                    qq = qq.filter(AgentWithdrawalDetail.status.in_(status_values))
                total = qq.scalar()
                return float(total / 100) if total else 0.0

            total_count = _count()
            pending_count = _count(STATUS_PENDING)
            approved_count = _count(STATUS_APPROVED)
            processing_count = _count(STATUS_PROCESSING)
            completed_count = _count(STATUS_SUCCESS)
            failed_count = _count(STATUS_FAILED)
            rejected_count = _count(STATUS_REJECTED)

            total_amount = _sum_amount(None)
            completed_amount = _sum_amount([STATUS_SUCCESS])
            pending_amount = _sum_amount([STATUS_PENDING, STATUS_APPROVED, STATUS_PROCESSING])

            completion_rate = round(completed_count / total_count * 100, 2) if total_count > 0 else 0.0
            success_rate = (
                round(completed_amount / total_amount * 100, 2) if total_amount > 0 else 0.0
            )

            logger.info(f"withdrawal_admin stats ok: total_count={total_count}")
            return success(
                {
                    "total_count": total_count,
                    "pending_count": pending_count,
                    "approved_count": approved_count,
                    "processing_count": processing_count,
                    "completed_count": completed_count,
                    "failed_count": failed_count,
                    "rejected_count": rejected_count,
                    "total_amount": total_amount,
                    "completed_amount": completed_amount,
                    "pending_amount": pending_amount,
                    "completion_rate": completion_rate,
                    "success_rate": success_rate,
                }
            )
    except Exception as e:
        logger.debug(f"withdrawal_admin stats error: {e}")
        return error("获取提现统计失败", ErrorCode.INTERNAL_ERROR)


@router.post("/batch-delete", summary="批量删除提现记录(管理员)")
async def batch_delete_withdrawals(
    body: BatchDeleteRequest,
    _admin: str = _ADMIN_DEP,
):
    """批量删除提现记录, 仅待审核(status=0)状态可删."""
    try:
        ids = body.withdrawal_ids or []
        if not ids:
            return error("待删除 ID 列表不能为空", ErrorCode.BAD_REQUEST)

        logger.info(f"withdrawal_admin batch_delete: count={len(ids)}")

        with get_session() as db:
            records = _base_query(db).filter(AgentWithdrawalDetail.id.in_(ids)).all()
            if not records:
                return error("未找到要删除的记录", ErrorCode.NOT_FOUND)

            invalid = [w for w in records if w.status != STATUS_PENDING]
            if invalid:
                invalid_nos = [w.out_bill_no or w.id for w in invalid]
                return error(
                    f"以下记录不是待审核状态, 无法删除: {', '.join(invalid_nos)}",
                    ErrorCode.BAD_REQUEST,
                )

            deleted_nos = [w.out_bill_no for w in records]
            # 2026-06-26: 改为软删除 (设置 deleted_at), 保留审计痕迹
            from app.utils.datetime_helper import utcnow
            now = utcnow()
            for w in records:
                w.deleted_at = now

            logger.info(f"withdrawal_admin batch_delete ok: deleted={len(records)}")
            return success(
                {
                    "deleted_count": len(records),
                    "out_bill_nos": deleted_nos,
                    "message": f"批量删除成功, 共删除 {len(records)} 条记录",
                }
            )
    except Exception as e:
        logger.debug(f"withdrawal_admin batch_delete error: {e}")
        return error("批量删除失败", ErrorCode.INTERNAL_ERROR)


@router.put("/{withdrawal_id}", summary="更新提现明细(管理员)")
async def update_withdrawal(
    withdrawal_id: str,
    body: WithdrawalUpdate,
    _admin: str = _ADMIN_DEP,
):
    """更新提现明细业务字段 (不含 id/user_id/status 等关键字段)."""
    try:
        logger.info(f"withdrawal_admin update: id={withdrawal_id}")

        with get_session() as db:
            record = _get_or_none(db, withdrawal_id)
            if not record:
                return error("提现记录不存在", ErrorCode.NOT_FOUND)

            update_data = body.model_dump(exclude_unset=True)
            for field, value in update_data.items():
                if hasattr(record, field) and value is not None:
                    setattr(record, field, value)

            logger.info(
                f"withdrawal_admin update ok: id={withdrawal_id}, "
                f"user={_mask_user(record.user_id)}, openid={_mask_openid(record.open_id)}"
            )
            return success(_to_dict(record))
    except Exception as e:
        logger.debug(f"withdrawal_admin update error: {e}")
        return error("更新提现明细失败", ErrorCode.INTERNAL_ERROR)


@router.delete("/{withdrawal_id}", summary="删除提现明细(管理员, 仅待审核可删)")
async def delete_withdrawal(
    withdrawal_id: str,
    _admin: str = _ADMIN_DEP,
):
    """删除提现明细, 仅待审核(status=0)状态可删.

    2026-06-26: AgentWithdrawalDetail 已补 deleted_at 字段, 改为软删除
    (设置 deleted_at = now), 不再执行硬删除, 保留审计痕迹.
    """
    try:
        logger.info(f"withdrawal_admin delete: id={withdrawal_id}")

        with get_session() as db:
            record = _get_or_none(db, withdrawal_id)
            if not record:
                return error("提现记录不存在", ErrorCode.NOT_FOUND)

            if record.status != STATUS_PENDING:
                return error("只有待审核状态的提现申请才能删除", ErrorCode.BAD_REQUEST)

            out_bill_no = record.out_bill_no
            # 软删除: 设置 deleted_at (保留审计痕迹, 不再 db.delete)
            from app.utils.datetime_helper import utcnow
            record.deleted_at = utcnow()

            logger.info(f"withdrawal_admin delete ok: id={withdrawal_id}, bill={out_bill_no}")
            return success(
                {
                    "id": withdrawal_id,
                    "out_bill_no": out_bill_no,
                    "message": "提现明细删除成功",
                }
            )
    except Exception as e:
        logger.debug(f"withdrawal_admin delete error: {e}")
        return error("删除提现明细失败", ErrorCode.INTERNAL_ERROR)


@router.post("/{withdrawal_id}/review", summary="审核提现申请(管理员)")
async def review_withdrawal(
    withdrawal_id: str,
    body: WithdrawalReview,
    _admin: str = _ADMIN_DEP,
):
    """审核提现申请: status 1=通过 / 5=拒绝. 仅待审核(0)状态可审核.

    审核人取当前登录 admin UUID, 审核时间取当前毫秒时间戳,
    审核备注存入 wechat_msg(JSON, key=review_remark).
    """
    try:
        if body.status not in (STATUS_APPROVED, STATUS_REJECTED):
            return error("审核状态必须为 1(通过) 或 5(拒绝)", ErrorCode.BAD_REQUEST)

        logger.info(f"withdrawal_admin review: id={withdrawal_id}, status={body.status}")

        with get_session() as db:
            record = _get_or_none(db, withdrawal_id)
            if not record:
                return error("提现记录不存在", ErrorCode.NOT_FOUND)

            if record.status != STATUS_PENDING:
                return error("只有待审核状态的申请才能进行审核", ErrorCode.BAD_REQUEST)

            record.status = body.status
            record.reviewer = _admin
            record.reviewer_time = _now_ms()
            # 2026-06-26: 优先写独立列 review_remark, 同时保留 wechat_msg JSON 兼容
            if body.review_remark is not None:
                record.review_remark = body.review_remark
            _set_ext(record, review_remark=body.review_remark)

            status_text = "审核通过" if body.status == STATUS_APPROVED else "已拒绝"
            logger.info(f"withdrawal_admin review ok: id={withdrawal_id}, result={status_text}")
            return success(
                {
                    "id": withdrawal_id,
                    "out_bill_no": record.out_bill_no,
                    "status": record.status,
                    "reviewer": record.reviewer,
                    "reviewer_time": record.reviewer_time,
                    "review_result": status_text,
                }
            )
    except Exception as e:
        logger.debug(f"withdrawal_admin review error: {e}")
        return error("审核提现申请失败", ErrorCode.INTERNAL_ERROR)


@router.post("/{withdrawal_id}/process", summary="处理提现申请(管理员)")
async def process_withdrawal(
    withdrawal_id: str,
    body: WithdrawalProcess,
    _admin: str = _ADMIN_DEP,
):
    """处理提现申请: status 2=提现中 / 3=成功 / 4=失败. 仅审核通过(1)或提现中(2)可处理.

    处理人取当前登录 admin UUID, 处理时间取当前毫秒时间戳 (写入 payment_time).
    交易号/处理备注/失败原因存入 wechat_msg(JSON).
    """
    try:
        if body.status not in (STATUS_PROCESSING, STATUS_SUCCESS, STATUS_FAILED):
            return error(
                "处理状态必须为 2(提现中) / 3(成功) / 4(失败)",
                ErrorCode.BAD_REQUEST,
            )

        logger.info(f"withdrawal_admin process: id={withdrawal_id}, status={body.status}")

        with get_session() as db:
            record = _get_or_none(db, withdrawal_id)
            if not record:
                return error("提现记录不存在", ErrorCode.NOT_FOUND)

            if record.status not in (STATUS_APPROVED, STATUS_PROCESSING):
                return error(
                    "只有审核通过或提现中状态的申请才能进行处理",
                    ErrorCode.BAD_REQUEST,
                )

            record.status = body.status
            record.reviewer = _admin
            record.payment_time = _now_ms()
            # 2026-06-26: 优先写独立列, 同时保留 wechat_msg JSON 兼容
            if body.transaction_id is not None:
                record.transaction_id = body.transaction_id
            if body.process_remark is not None:
                record.process_remark = body.process_remark
            if body.failure_reason is not None:
                record.failure_reason = body.failure_reason
            _set_ext(
                record,
                transaction_id=body.transaction_id,
                process_remark=body.process_remark,
                failure_reason=body.failure_reason,
            )

            status_map = {
                STATUS_PROCESSING: "提现中",
                STATUS_SUCCESS: "提现成功",
                STATUS_FAILED: "提现失败",
            }
            status_text = status_map.get(body.status, "未知状态")
            logger.info(f"withdrawal_admin process ok: id={withdrawal_id}, result={status_text}")
            return success(
                {
                    "id": withdrawal_id,
                    "out_bill_no": record.out_bill_no,
                    "status": record.status,
                    "payment_time": record.payment_time,
                    "process_result": status_text,
                }
            )
    except Exception as e:
        logger.debug(f"withdrawal_admin process error: {e}")
        return error("处理提现申请失败", ErrorCode.INTERNAL_ERROR)
