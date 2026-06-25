"""退款流程加固 - 后端 API.

端点:
- POST /api/v1/refunds           申请退款
- GET  /api/v1/refunds/:id       查询退款详情
- GET  /api/v1/refunds           查询用户退款列表
- POST /api/v1/refunds/:id/evidence  上传退款凭证
- POST /api/v1/refunds/:id/cancel   撤销退款申请
- POST /api/v1/refunds/:id/review   审核退款 (管理员)
- GET  /api/v1/refunds/stats/summary  退款统计 (管理员)

持久化: DB (zhs_refund / zhs_refund_timeline).
"""
from __future__ import annotations

import enum
import json
import os
import re
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, Query, UploadFile
from loguru import logger
from pydantic import BaseModel, Field
from sqlalchemy import func as sa_func, select
from sqlalchemy.orm import Session

from app.database import get_session
from app.models.payment_models import Order, Refund, RefundTimeline
from app.security import require_login, require_role

router = APIRouter(prefix="/refunds", tags=["refunds"])

# 2026-06-25 修复: 原硬编码 /tmp/refund_evidence 在 Windows 上会创建到当前盘根 (G:\tmp\...)
# 改用 tempfile.gettempdir() 获取平台标准临时目录, 同时尊重环境变量覆盖
_DEFAULT_EVIDENCE_DIR = os.path.join(tempfile.gettempdir(), "zhs_refund_evidence")
_evidence_dir = Path(os.environ.get("REFUND_EVIDENCE_DIR", _DEFAULT_EVIDENCE_DIR))
_evidence_dir.mkdir(parents=True, exist_ok=True)

# 文件上传限制
_ALLOWED_CONTENT_TYPES = {
    "image/png",
    "image/jpeg",
    "image/gif",
    "application/pdf",
}
_MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10MB
_FILENAME_SAFE = re.compile(r"[^A-Za-z0-9._-]")


class RefundStatus(str, enum.Enum):
    PENDING = "pending"          # 待审核
    REVIEWING = "reviewing"      # 审核中
    APPROVED = "approved"        # 已批准
    REJECTED = "rejected"        # 已拒绝
    PROCESSING = "processing"    # 退款处理中
    COMPLETED = "completed"      # 已完成
    FAILED = "failed"            # 失败
    CANCELLED = "cancelled"      # 已撤销


# 状态机定义
ALLOWED_TRANSITIONS = {
    RefundStatus.PENDING: {RefundStatus.REVIEWING, RefundStatus.CANCELLED},
    RefundStatus.REVIEWING: {RefundStatus.APPROVED, RefundStatus.REJECTED},
    RefundStatus.APPROVED: {RefundStatus.PROCESSING, RefundStatus.FAILED},
    RefundStatus.PROCESSING: {RefundStatus.COMPLETED, RefundStatus.FAILED},
    RefundStatus.FAILED: {RefundStatus.PROCESSING},  # 失败可重试
    RefundStatus.COMPLETED: set(),
    RefundStatus.REJECTED: set(),
    RefundStatus.CANCELLED: set(),
}


class RefundCreateRequest(BaseModel):
    order_no: str = Field(..., min_length=1)
    reason: str = Field(..., min_length=2)
    amount: Optional[int] = Field(None, ge=1, description="退款金额, 单位分")
    description: Optional[str] = Field(None, max_length=500)


class RefundEvidenceRequest(BaseModel):
    evidence_type: str = Field("image")  # image / pdf
    description: Optional[str] = None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _can_transition(from_status: RefundStatus, to_status: RefundStatus) -> bool:
    return to_status in ALLOWED_TRANSITIONS.get(from_status, set())


def _add_timeline(
    db: Session,
    refund_id: str,
    action: str,
    operator: str,
    note: str = "",
    status_from: str = "",
) -> None:
    """写入退款时间线. status_from 应为变更前的旧状态."""
    timeline = RefundTimeline(
        refund_id=refund_id,
        action=action,
        operator=operator,
        note=note,
        status_from=status_from,
    )
    db.add(timeline)


def _refund_to_dict(refund: Refund) -> dict:
    """序列化 Refund ORM 对象为 dict (含 evidence 解析)."""
    try:
        evidence = json.loads(refund.evidence or "[]")
    except (json.JSONDecodeError, TypeError):
        evidence = []
    return {
        "id": refund.refund_id,
        "user_id": refund.user_id,
        "order_no": refund.order_no,
        "reason": refund.reason,
        "amount": refund.amount,
        "description": refund.description,
        "status": refund.status,
        "retry_count": refund.retry_count,
        "evidence": evidence,
        "created_at": refund.created_at.isoformat() if refund.created_at else None,
        "updated_at": refund.updated_at.isoformat() if refund.updated_at else None,
    }


def _timeline_to_dict(t: RefundTimeline) -> dict:
    return {
        "ts": t.created_at.isoformat() if t.created_at else None,
        "action": t.action,
        "operator": t.operator,
        "note": t.note,
        "status_from": t.status_from,
    }


def _sanitize_filename(name: str) -> str:
    """清洗文件名, 仅保留安全字符."""
    safe = _FILENAME_SAFE.sub("_", name).strip("._-")
    return safe or "file"


def _is_admin(user_uuid: str) -> bool:
    """检查用户是否拥有 admin 角色."""
    from app.models.sys_models import SysRole, SysUser, SysUserRole

    with get_session() as db:
        stmt = (
            select(SysUser.user_id)
            .join(SysUserRole, SysUser.user_id == SysUserRole.user_id)
            .join(SysRole, SysUserRole.role_id == SysRole.role_id)
            .where(
                SysUser.user_uuid == user_uuid,
                SysRole.role_key == "admin",
                SysRole.status == "0",
                SysRole.del_flag == "0",
            )
            .limit(1)
        )
        return db.execute(stmt).first() is not None


@router.post("")
def create_refund(
    req: RefundCreateRequest,
    user_uuid: str = Depends(require_login),
) -> dict:
    """申请退款."""
    with get_session() as db:
        # 校验订单存在且属于该用户
        order = db.execute(
            select(Order)
            .where(Order.out_trade_no == req.order_no, Order.user_id == user_uuid)
            .limit(1)
        ).scalar_one_or_none()
        if not order:
            raise HTTPException(404, "订单不存在或不属于当前用户")

        # 安全修复: 校验订单状态为已支付 (status=1) 才允许退款
        if order.status != 1:
            raise HTTPException(400, f"订单状态不允许退款 (当前状态: {order.status})")

        # 安全修复: 累加同订单已退款金额, 校验 已退 + 本次退 <= 订单总额
        # 仅统计有效退款单 (排除已撤销/已拒绝)
        _INVALID_REFUND_STATUS = {
            RefundStatus.CANCELLED.value,
            RefundStatus.REJECTED.value,
        }
        refunded_rows = db.execute(
            select(Refund.amount)
            .where(Refund.order_no == req.order_no)
            .where(Refund.status.notin_(_INVALID_REFUND_STATUS))
        ).scalars().all()
        already_refunded = sum(int(r or 0) for r in refunded_rows)
        order_total = int(order.amount or 0)

        # 本次退款金额: 未传则默认退剩余可退金额
        this_refund = (
            req.amount
            if req.amount is not None
            else max(order_total - already_refunded, 0)
        )
        if this_refund <= 0:
            raise HTTPException(400, "可退款金额不足")
        if already_refunded + this_refund > order_total:
            raise HTTPException(
                400,
                f"退款金额超出限制: 已退 {already_refunded} + 本次 {this_refund} > 订单总额 {order_total}",
            )

        refund_id = f"RF{uuid.uuid4().hex[:12].upper()}"
        refund = Refund(
            refund_id=refund_id,
            user_id=user_uuid,
            order_no=req.order_no,
            reason=req.reason,
            amount=this_refund,
            description=req.description,
            status=RefundStatus.PENDING.value,
            retry_count=0,
            evidence="[]",
        )
        db.add(refund)
        # 新建退款单, status_from 为空
        _add_timeline(db, refund_id, "create", user_uuid, "申请已提交", status_from="")
        db.commit()
        db.refresh(refund)
        return {"code": 0, "data": _refund_to_dict(refund), "message": "申请已提交, 等待审核"}


@router.get("/{refund_id}")
def get_refund(
    refund_id: str,
    user_uuid: str = Depends(require_login),
) -> dict:
    """查询退款详情 (含时间线)."""
    with get_session() as db:
        refund = db.execute(
            select(Refund).where(Refund.refund_id == refund_id).limit(1)
        ).scalar_one_or_none()
        if not refund:
            raise HTTPException(404, "退款单不存在")
        # 非 admin 只能查自己的退款
        if refund.user_id != user_uuid and not _is_admin(user_uuid):
            raise HTTPException(403, "无权查看该退款单")
        timeline_rows = (
            db.execute(
                select(RefundTimeline)
                .where(RefundTimeline.refund_id == refund_id)
                .order_by(RefundTimeline.created_at)
            )
            .scalars()
            .all()
        )
        data = _refund_to_dict(refund)
        data["timeline"] = [_timeline_to_dict(t) for t in timeline_rows]
        return {"code": 0, "data": data}


@router.get("")
def list_refunds(
    user_id: Optional[str] = None,
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user_uuid: str = Depends(require_login),
) -> dict:
    """查询用户退款列表. 非 admin 只能查自己的退款."""
    with get_session() as db:
        is_admin = _is_admin(user_uuid)
        stmt = select(Refund)
        # 非 admin 强制只查自己; admin 可通过 user_id 过滤
        if not is_admin:
            stmt = stmt.where(Refund.user_id == user_uuid)
        elif user_id:
            stmt = stmt.where(Refund.user_id == user_id)
        if status:
            stmt = stmt.where(Refund.status == status)

        count_stmt = select(sa_func.count()).select_from(stmt.subquery())
        total = db.execute(count_stmt).scalar() or 0

        rows = (
            db.execute(
                stmt.order_by(Refund.created_at.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
            .scalars()
            .all()
        )
        items = [_refund_to_dict(r) for r in rows]
        return {
            "code": 0,
            "data": {
                "list": items,
                "total": total,
                "page": page,
                "page_size": page_size,
            },
        }


@router.post("/{refund_id}/evidence")
async def upload_evidence(
    refund_id: str,
    file: UploadFile = File(...),
    description: str = Form(""),
    user_uuid: str = Depends(require_login),
) -> dict:
    """上传退款凭证."""
    # 校验文件类型
    if file.content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(400, f"不支持的文件类型: {file.content_type}")

    with get_session() as db:
        refund = db.execute(
            select(Refund).where(Refund.refund_id == refund_id).limit(1)
        ).scalar_one_or_none()
        if not refund:
            raise HTTPException(404, "退款单不存在")
        if refund.user_id != user_uuid:
            raise HTTPException(403, "无权操作该退款单")
        if refund.status in [RefundStatus.COMPLETED.value, RefundStatus.CANCELLED.value]:
            raise HTTPException(400, "已结束退款单不允许上传凭证")

        # 读取并校验大小
        content = await file.read()
        if len(content) > _MAX_UPLOAD_BYTES:
            raise HTTPException(400, "文件大小超过 10MB 限制")

        # 清洗文件名并保存
        original_name = _sanitize_filename(file.filename or "file")
        ext = Path(original_name).suffix
        stored_name = f"{refund_id}_{uuid.uuid4().hex[:8]}{ext}"
        file_path = _evidence_dir / stored_name
        file_path.write_bytes(content)

        evidence_entry = {
            "id": uuid.uuid4().hex[:8],
            "filename": original_name,
            "stored_path": str(file_path),
            "size": len(content),
            "content_type": file.content_type,
            "description": description,
            "uploaded_at": _now_iso(),
        }
        try:
            evidence_list = json.loads(refund.evidence or "[]")
        except (json.JSONDecodeError, TypeError):
            evidence_list = []
        evidence_list.append(evidence_entry)
        refund.evidence = json.dumps(evidence_list, ensure_ascii=False)
        # 状态未变更, status_from 记录当前状态
        _add_timeline(
            db,
            refund_id,
            "evidence_upload",
            user_uuid,
            f"上传凭证: {original_name}",
            status_from=refund.status,
        )
        db.commit()
        return {"code": 0, "data": evidence_entry, "message": "凭证已上传"}


@router.post("/{refund_id}/cancel")
def cancel_refund(
    refund_id: str,
    user_uuid: str = Depends(require_login),
) -> dict:
    """撤销退款申请."""
    with get_session() as db:
        refund = db.execute(
            select(Refund).where(Refund.refund_id == refund_id).limit(1)
        ).scalar_one_or_none()
        if not refund:
            raise HTTPException(404, "退款单不存在")
        if refund.user_id != user_uuid:
            raise HTTPException(403, "无权操作该退款单")
        current = RefundStatus(refund.status)
        if not _can_transition(current, RefundStatus.CANCELLED):
            raise HTTPException(400, f"当前状态 {current.value} 不允许撤销")
        old_status = refund.status
        refund.status = RefundStatus.CANCELLED.value
        _add_timeline(db, refund_id, "cancel", user_uuid, "用户撤销", status_from=old_status)
        db.commit()
        db.refresh(refund)
        return {"code": 0, "data": _refund_to_dict(refund), "message": "已撤销"}


@router.post("/{refund_id}/review")
def review_refund(
    refund_id: str,
    approved: bool = Body(..., embed=True),
    note: str = Body("", embed=True),
    user_uuid: str = Depends(require_role("admin")),
) -> dict:
    """审核退款 (管理员)."""
    with get_session() as db:
        refund = db.execute(
            select(Refund).where(Refund.refund_id == refund_id).limit(1)
        ).scalar_one_or_none()
        if not refund:
            raise HTTPException(404, "退款单不存在")
        current = RefundStatus(refund.status)
        target = RefundStatus.APPROVED if approved else RefundStatus.REJECTED
        if not _can_transition(current, target):
            raise HTTPException(400, f"状态 {current.value} 无法转为 {target.value}")
        old_status = refund.status

        if approved:
            # 安全修复: 审核通过后推进到 PROCESSING (APPROVED 仅作中间态校验).
            # 真实退款需人工触发或对接资金通道, 此处告警提示, 避免审核通过后停滞.
            refund.status = RefundStatus.PROCESSING.value
            _add_timeline(
                db,
                refund_id,
                "review",
                user_uuid,
                note or "审核通过, 进入退款处理",
                status_from=old_status,
            )
            db.commit()
            db.refresh(refund)
            logger.warning(
                f"refund {refund_id} approved -> PROCESSING, "
                f"real refund must be triggered manually (order_no={refund.order_no})"
            )
            return {"code": 0, "data": _refund_to_dict(refund), "message": "审核通过, 退款处理中"}

        # 审核拒绝
        refund.status = target.value
        _add_timeline(
            db,
            refund_id,
            "review",
            user_uuid,
            note or "审核拒绝",
            status_from=old_status,
        )
        db.commit()
        db.refresh(refund)
        return {"code": 0, "data": _refund_to_dict(refund), "message": "审核完成"}


@router.get("/stats/summary")
def refund_stats(
    user_uuid: str = Depends(require_role("admin")),
) -> dict:
    """退款统计 (管理员, 供监控)."""
    with get_session() as db:
        rows = db.execute(
            select(Refund.status, sa_func.count()).group_by(Refund.status)
        ).all()
        counter = {status or "unknown": cnt for status, cnt in rows}
        total = sum(counter.values())
        return {
            "code": 0,
            "data": {
                "total": total,
                "by_status": counter,
            },
        }
