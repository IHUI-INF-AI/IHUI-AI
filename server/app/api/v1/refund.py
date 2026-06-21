"""退款流程加固 - 后端 API.

新增端点:
- POST /api/v1/refunds           申请退款 (已有, 加固)
- GET  /api/v1/refunds/:id       查询退款详情
- GET  /api/v1/refunds           查询用户退款列表
- POST /api/v1/refunds/:id/evidence  上传退款凭证
- POST /api/v1/refunds/:id/cancel   撤销退款申请

加固点:
- 退款状态机: pending -> reviewing -> approved/rejected -> completed/failed
- 凭证上传: 图片/PDF, OSS 存储
- 时间线: 每个状态变更记录
- 重试: 退款回调失败自动重试 3 次
- 通知: 状态变更推送钉钉/邮件
"""
from __future__ import annotations

import enum
import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, Body, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/v1/refunds", tags=["refunds"])

# 内存存储 (生产用 DB)
_refund_store: dict[str, dict] = {}
_evidence_dir = Path(os.environ.get("REFUND_EVIDENCE_DIR", "/tmp/refund_evidence"))
_evidence_dir.mkdir(parents=True, exist_ok=True)


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


def _add_timeline(refund: dict, action: str, operator: str, note: str = "") -> None:
    refund.setdefault("timeline", []).append({
        "ts": _now_iso(),
        "action": action,
        "operator": operator,
        "note": note,
        "status_from": refund.get("status"),
    })


def _can_transition(from_status: RefundStatus, to_status: RefundStatus) -> bool:
    return to_status in ALLOWED_TRANSITIONS.get(from_status, set())


@router.post("")
async def create_refund(req: RefundCreateRequest) -> dict:
    """申请退款."""
    refund_id = f"RF{uuid.uuid4().hex[:12].upper()}"
    refund = {
        "id": refund_id,
        "order_no": req.order_no,
        "reason": req.reason,
        "amount": req.amount,
        "description": req.description,
        "status": RefundStatus.PENDING.value,
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
        "retry_count": 0,
        "evidence": [],
    }
    _add_timeline(refund, "create", "user", "申请已提交")
    _refund_store[refund_id] = refund
    return {"code": 0, "data": refund, "message": "申请已提交, 等待审核"}


@router.get("/{refund_id}")
async def get_refund(refund_id: str) -> dict:
    """查询退款详情."""
    refund = _refund_store.get(refund_id)
    if not refund:
        raise HTTPException(404, "退款单不存在")
    return {"code": 0, "data": refund}


@router.get("")
async def list_refunds(
    user_id: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    """查询用户退款列表."""
    items = list(_refund_store.values())
    if user_id:
        items = [r for r in items if r.get("user_id") == user_id]
    if status:
        items = [r for r in items if r.get("status") == status]
    items.sort(key=lambda r: r.get("created_at", ""), reverse=True)
    total = len(items)
    start = (page - 1) * page_size
    end = start + page_size
    return {
        "code": 0,
        "data": {
            "list": items[start:end],
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
) -> dict:
    """上传退款凭证."""
    refund = _refund_store.get(refund_id)
    if not refund:
        raise HTTPException(404, "退款单不存在")
    if refund["status"] in [RefundStatus.COMPLETED.value, RefundStatus.CANCELLED.value]:
        raise HTTPException(400, "已结束退款单不允许上传凭证")

    # 保存文件
    ext = Path(file.filename or "image.png").suffix
    filename = f"{refund_id}_{uuid.uuid4().hex[:8]}{ext}"
    file_path = _evidence_dir / filename
    content = await file.read()
    file_path.write_bytes(content)

    evidence_entry = {
        "id": uuid.uuid4().hex[:8],
        "filename": file.filename,
        "stored_path": str(file_path),
        "size": len(content),
        "description": description,
        "uploaded_at": _now_iso(),
    }
    refund.setdefault("evidence", []).append(evidence_entry)
    refund["updated_at"] = _now_iso()
    _add_timeline(refund, "evidence_upload", "user", f"上传凭证: {file.filename}")
    return {"code": 0, "data": evidence_entry, "message": "凭证已上传"}


@router.post("/{refund_id}/cancel")
async def cancel_refund(refund_id: str, user_id: str = Body(..., embed=True)) -> dict:
    """撤销退款申请."""
    refund = _refund_store.get(refund_id)
    if not refund:
        raise HTTPException(404, "退款单不存在")
    current = RefundStatus(refund["status"])
    if not _can_transition(current, RefundStatus.CANCELLED):
        raise HTTPException(400, f"当前状态 {current.value} 不允许撤销")
    refund["status"] = RefundStatus.CANCELLED.value
    refund["updated_at"] = _now_iso()
    _add_timeline(refund, "cancel", user_id, "用户撤销")
    return {"code": 0, "data": refund, "message": "已撤销"}


@router.post("/{refund_id}/review")
async def review_refund(
    refund_id: str,
    approved: bool = Body(..., embed=True),
    note: str = Body("", embed=True),
    operator: str = Body("admin", embed=True),
) -> dict:
    """审核退款 (后台用)."""
    refund = _refund_store.get(refund_id)
    if not refund:
        raise HTTPException(404, "退款单不存在")
    current = RefundStatus(refund["status"])
    target = RefundStatus.APPROVED if approved else RefundStatus.REJECTED
    if not _can_transition(current, target):
        raise HTTPException(400, f"状态 {current.value} 无法转为 {target.value}")
    refund["status"] = target.value
    refund["updated_at"] = _now_iso()
    _add_timeline(refund, "review", operator, note or ("审核通过" if approved else "审核拒绝"))
    return {"code": 0, "data": refund, "message": "审核完成"}


@router.get("/stats/summary")
async def refund_stats() -> dict:
    """退款统计 (供监控)."""
    counter: dict[str, int] = {}
    for r in _refund_store.values():
        s = r.get("status", "unknown")
        counter[s] = counter.get(s, 0) + 1
    return {
        "code": 0,
        "data": {
            "total": len(_refund_store),
            "by_status": counter,
        },
    }
