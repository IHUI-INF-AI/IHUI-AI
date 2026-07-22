"""多通道消息总线 API 路由(挂载在 /api 前缀)。

端点(6 个):
- POST   /api/message-bus/publish              发布消息到指定通道(支持多通道 + 降级)
- POST   /api/message-bus/subscribe            注册订阅(webhook 模式)
- DELETE /api/message-bus/subscribe/{sub_id}   取消订阅
- GET    /api/message-bus/status/{message_id}  查询消息投递状态
- POST   /api/message-bus/batch                批量发布消息到单一通道
- GET    /api/message-bus/templates            列出所有内置消息模板

响应统一 {code, message, data} 格式(code=0 成功,500 失败)。
"""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..services.message_bus import (
    ChannelType,
    Message,
    message_bus,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# 请求模型
# ---------------------------------------------------------------------------


class MessagePayload(BaseModel):
    """消息载荷(HTTP 入参用,不暴露 id / created_at,由服务端生成)。"""

    content: str = Field(..., description="消息内容(若设置 template_id 则用渲染结果覆盖)")
    template_id: str | None = Field(None, description="消息模板 ID(可选)")
    template_vars: dict[str, Any] | None = Field(None, description="模板变量(可选)")
    metadata: dict[str, Any] = Field(default_factory=dict, description="元数据")


class PublishRequest(BaseModel):
    """发布消息请求。"""

    message: MessagePayload
    channels: list[ChannelType] = Field(..., description="目标通道列表")
    priority: str = Field("normal", description="消息优先级(high/normal/low)")


class SubscribeRequest(BaseModel):
    """订阅请求(webhook 模式)。"""

    channel: ChannelType = Field(..., description="订阅通道")
    webhook_url: str | None = Field(None, description="Webhook 回调地址(Webhook 通道必填)")


class BatchRequest(BaseModel):
    """批量发布请求。"""

    messages: list[MessagePayload] = Field(..., description="消息列表")
    channel: ChannelType = Field(..., description="目标通道(单一通道)")


# ---------------------------------------------------------------------------
# 序列化辅助
# ---------------------------------------------------------------------------


def _publish_result_to_dict(r: Any) -> dict[str, Any]:
    """PublishResult → JSON 友好 dict。"""
    return {
        "messageId": r.message_id,
        "deliveredChannels": [c.value for c in r.delivered_channels],
        "failedChannels": [c.value for c in r.failed_channels],
        "fallbackUsed": r.fallback_used,
        "error": r.error,
    }


def _delivery_status_to_dict(s: Any) -> dict[str, Any]:
    """DeliveryStatus → JSON 友好 dict。"""
    return {
        "messageId": s.message_id,
        "perChannel": {c.value: status for c, status in s.per_channel.items()},
        "totalAttempts": s.total_attempts,
        "lastAttempt": s.last_attempt.isoformat() if s.last_attempt else None,
    }


# ---------------------------------------------------------------------------
# 核心端点
# ---------------------------------------------------------------------------


@router.post("/message-bus/publish")
async def publish(req: PublishRequest) -> dict[str, Any]:
    """发布消息到指定通道列表(支持多通道 + 失败自动降级)。"""
    try:
        message = Message(
            id=uuid.uuid4().hex,
            content=req.message.content,
            template_id=req.message.template_id,
            template_vars=req.message.template_vars,
            metadata=req.message.metadata,
        )
        result = await message_bus.publish(message, req.channels, req.priority)
        return {"code": 0, "message": "ok", "data": _publish_result_to_dict(result)}
    except Exception as e:
        return {"code": 500, "message": f"发布失败: {e}", "data": None}


@router.post("/message-bus/subscribe")
async def subscribe(req: SubscribeRequest) -> dict[str, Any]:
    """注册订阅(webhook 模式)。返回 subscription_id。"""
    try:
        # HTTP API 仅支持 webhook_url 模式(无法传递 Python handler);
        # WebSocket 实时订阅走 Socket.IO,不走本端点
        sub_id = await message_bus.subscribe(
            channel=req.channel,
            webhook_url=req.webhook_url,
        )
        return {
            "code": 0,
            "message": "ok",
            "data": {"subscriptionId": sub_id, "channel": req.channel.value},
        }
    except Exception as e:
        return {"code": 500, "message": f"订阅失败: {e}", "data": None}


@router.delete("/message-bus/subscribe/{subscription_id}")
async def unsubscribe(subscription_id: str) -> dict[str, Any]:
    """取消订阅。"""
    ok = await message_bus.unsubscribe(subscription_id)
    if not ok:
        raise HTTPException(status_code=404, detail="订阅不存在")
    return {"code": 0, "message": "ok", "data": {"unsubscribed": True}}


@router.get("/message-bus/status/{message_id}")
async def get_status(message_id: str) -> dict[str, Any]:
    """查询消息投递状态。"""
    status = await message_bus.get_delivery_status(message_id)
    if status is None:
        raise HTTPException(status_code=404, detail="消息投递状态未找到")
    return {"code": 0, "message": "ok", "data": _delivery_status_to_dict(status)}


@router.post("/message-bus/batch")
async def batch_publish(req: BatchRequest) -> dict[str, Any]:
    """批量发布消息到单一通道。"""
    try:
        messages = [
            Message(
                id=uuid.uuid4().hex,
                content=m.content,
                template_id=m.template_id,
                template_vars=m.template_vars,
                metadata=m.metadata,
            )
            for m in req.messages
        ]
        result = await message_bus.batch_publish(messages, req.channel)
        return {
            "code": 0,
            "message": "ok",
            "data": {
                "total": result.total,
                "succeeded": result.succeeded,
                "failed": result.failed,
                "results": [_publish_result_to_dict(r) for r in result.results],
            },
        }
    except Exception as e:
        return {"code": 500, "message": f"批量发布失败: {e}", "data": None}


@router.get("/message-bus/templates")
async def list_templates() -> dict[str, Any]:
    """列出所有内置消息模板。"""
    templates = message_bus.list_templates()
    return {"code": 0, "message": "ok", "data": templates}
