"""Edu pay router - /api/v1/edu/pay

Migrated from ihui-ai-edu-pay-service.
Complete Phase B implementation.
"""

import hashlib
import hmac
import logging
import os

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query, Request
from sqlalchemy.orm import Session

from app.database import get_session


def _get_db():
    """FastAPI dependency wrapper for app.database.get_session (contextmanager)."""
    with get_session() as db:
        yield db


from app.core.current_user import get_current_user_id


from app.schemas.common import success

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/pay-orders", summary="Create payment")
def create_pay_order_endpoint(user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_pay import create_pay_order
    result = create_pay_order(
        db,
        order_id=payload.get("order_id"),
        pay_channel=payload.get("pay_channel"),
        pay_amount=payload.get("pay_amount"),
        installment_count=payload.get("installment_count"),
    )
    return success(data=result)

@router.post("/pay-orders/{pay_order_id}/mark-paid", summary="Mark paid (webhook)")
async def mark_paid_endpoint(
    pay_order_id: int,
    request: Request,
    x_webhook_signature: str = Header(None, alias="X-Webhook-Signature"),
    db=Depends(_get_db),
):
    # 2026-06-26 C2 安全修复: webhook 真实验签 (HMAC-SHA256), 防止支付欺诈
    # 配置方式: 环境变量 EDU_PAY_WEBHOOK_SECRET 与支付网关共享同一密钥
    raw_body = await request.body()
    secret = os.environ.get("EDU_PAY_WEBHOOK_SECRET", "")
    if secret:
        # 强制验签模式 (生产环境): 必须带签名且验签通过
        if not x_webhook_signature:
            logger.debug("pay webhook rejected: secret configured but signature missing (order=%s)", pay_order_id)
            raise HTTPException(status_code=401, detail="Missing signature")
        expected = "sha256=" + hmac.new(
            secret.encode("utf-8"), raw_body, hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(expected, x_webhook_signature):
            logger.debug("pay webhook rejected: signature mismatch (order=%s)", pay_order_id)
            raise HTTPException(status_code=401, detail="Invalid signature")
    else:
        # 兼容模式 (开发环境): secret 未配置时仍要求签名头存在 (保持原有行为)
        if not x_webhook_signature:
            logger.debug("pay webhook rejected: signature header missing (order=%s)", pay_order_id)
            raise HTTPException(status_code=403, detail="missing X-Webhook-Signature")
    # 解析 body (验签通过后)
    import json as _json
    try:
        payload = _json.loads(raw_body) if raw_body else {}
    except _json.JSONDecodeError as e:
        logger.debug("pay webhook JSON parse failed (order=%s): %s", pay_order_id, e)
        raise HTTPException(status_code=400, detail="请求体格式错误") from e
    from app.services.edu_pay import mark_paid
    result = mark_paid(db, pay_order_id=pay_order_id, transaction_id=payload.get("transaction_id"))
    return success(data=result)

@router.get("/pay-orders/me", summary="My payments")
def list_user_payments_endpoint(user_id: int = Depends(get_current_user_id), page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    from app.services.edu_pay import list_user_payments
    result = list_user_payments(db, user_id=user_id, page=page, size=size)
    return success(data=result)
