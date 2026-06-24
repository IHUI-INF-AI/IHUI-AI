"""TBox 智能体发布通知 API.

迁移自 ZHS_Server_java/mcp/controller/TBoxController.java.
"""

import hashlib
import hmac
import time

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Request, status
from loguru import logger

from app.config import settings
from app.models.tbox_models import TBoxBean, get_tbox_event_log
from app.security import require_role

router = APIRouter(prefix="/tbox", tags=["TBox 智能体发布"])

# 签名时间戳允许的偏移量 (秒), 防重放
_SIGNATURE_TTL_SECONDS = 300


def _verify_tbox_signature(body: bytes, signature: str | None, timestamp: str | None) -> bool:
    """验证 TBox 通知签名 (HMAC-SHA256 + 时间戳防重放).

    签名算法: HMAC-SHA256(secret, str(timestamp) + body)
    """
    if not signature or not timestamp:
        return False
    # 时间戳防重放 (5 分钟内有效)
    try:
        ts = int(timestamp)
    except (ValueError, TypeError):
        return False
    if abs(time.time() - ts) > _SIGNATURE_TTL_SECONDS:
        return False
    # HMAC-SHA256 验证
    secret = getattr(settings, "TBOX_NOTIFY_SECRET", "") or ""
    if not secret:
        # 未配置密钥则拒绝 (避免未鉴权直接放行)
        return False
    msg = str(ts).encode() + body
    expected = hmac.new(secret.encode(), msg, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


@router.post("/notify", summary="接收 TBox 事件通知")
async def receive_notify(
    request: Request,
    payload: TBoxBean = Body(...),
    x_signature: str | None = Header(None, alias="X-Signature"),
    x_timestamp: str | None = Header(None, alias="X-Timestamp"),
):
    """接收百宝箱事件通知(已迁移核心数据模型).

    安全: 必须携带合法的 X-Signature + X-Timestamp 头 (HMAC-SHA256).
    """
    # 读取原始 body 用于签名校验 (Body(...) 已消费, 这里重新读取缓存)
    raw_body = await request.body()
    if not _verify_tbox_signature(raw_body, x_signature, x_timestamp):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid signature or timestamp",
        )
    try:
        log = get_tbox_event_log()
        log.add(payload)
        logger.info(f"TBox 事件: {payload.event}, robot_id={payload.robot_id}")
        return {"code": 0, "message": "ok", "data": {"event_id": payload.event_id or ""}}
    except Exception as e:
        logger.error(f"TBox 通知处理失败: {e}")
        return {"code": 500, "message": str(e), "data": None}


@router.get("/events", summary="查询最近 TBox 事件")
async def recent_events(
    limit: int = 50,
    user_uuid: str = Depends(require_role("admin")),
):
    """查询最近接收的 TBox 事件 (仅 admin)."""
    log = get_tbox_event_log()
    return {"code": 0, "message": "ok", "data": log.recent(limit)}
