"""消息模块 — 发布 / 订阅 / 状态查询。

端点(4 个):
- POST   /v1/messages(发布消息)
- POST   /v1/messages/subscribe(订阅频道)
- DELETE /v1/messages/subscribe/:id(取消订阅)
- GET    /v1/messages/:id/status(消息状态)
"""

from __future__ import annotations

from urllib.parse import quote

from ..async_base import AsyncBaseClient
from ..base import BaseClient
from ..types import (
    V1MessageStatusResponse,
    V1PublishMessageRequest,
    V1PublishMessageResponse,
    V1SubscribeMessageRequest,
    V1SubscribeMessageResponse,
    V1UnsubscribeResponse,
)


class MessagesApi:
    """消息模块(同步)— 发布 / 订阅 / 状态。"""

    def __init__(self, client: BaseClient) -> None:
        self._client = client

    def publish(self, req: V1PublishMessageRequest) -> V1PublishMessageResponse:
        """POST /v1/messages(发布消息)。"""
        return self._client.request("POST", "/messages", req)

    def subscribe(self, req: V1SubscribeMessageRequest) -> V1SubscribeMessageResponse:
        """POST /v1/messages/subscribe(订阅频道)。"""
        return self._client.request("POST", "/messages/subscribe", req)

    def unsubscribe(self, subscription_id: str) -> V1UnsubscribeResponse:
        """DELETE /v1/messages/subscribe/:id(取消订阅)。"""
        return self._client.request(
            "DELETE", f"/messages/subscribe/{quote(subscription_id, safe='')}"
        )

    def get_status(self, message_id: str) -> V1MessageStatusResponse:
        """GET /v1/messages/:id/status(消息状态)。"""
        return self._client.request("GET", f"/messages/{quote(message_id, safe='')}/status")


class AsyncMessagesApi:
    """消息模块(asyncio)— 发布 / 订阅 / 状态。"""

    def __init__(self, client: AsyncBaseClient) -> None:
        self._client = client

    async def publish(self, req: V1PublishMessageRequest) -> V1PublishMessageResponse:
        """POST /v1/messages(发布消息)。"""
        return await self._client.request("POST", "/messages", req)

    async def subscribe(self, req: V1SubscribeMessageRequest) -> V1SubscribeMessageResponse:
        """POST /v1/messages/subscribe(订阅频道)。"""
        return await self._client.request("POST", "/messages/subscribe", req)

    async def unsubscribe(self, subscription_id: str) -> V1UnsubscribeResponse:
        """DELETE /v1/messages/subscribe/:id(取消订阅)。"""
        return await self._client.request(
            "DELETE", f"/messages/subscribe/{quote(subscription_id, safe='')}"
        )

    async def get_status(self, message_id: str) -> V1MessageStatusResponse:
        """GET /v1/messages/:id/status(消息状态)。"""
        return await self._client.request("GET", f"/messages/{quote(message_id, safe='')}/status")


__all__ = ["MessagesApi", "AsyncMessagesApi"]
