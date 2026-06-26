"""统一的 Redis 客户端入口 (异步 + 同步).

提供:
  - get_redis_async(): 返回单例 redis.asyncio.Redis
  - get_redis_sync(): 返回单例 redis.Redis

供 chat_room / public_socket_v2 / coze_ws 等迁移模块使用.
"""
from __future__ import annotations

import logging
from typing import Optional

import redis as redis_sync
import redis.asyncio as aioredis

from app.config import settings

logger = logging.getLogger(__name__)

_async_client: Optional[aioredis.Redis] = None
_sync_client: Optional[redis_sync.Redis] = None


def _build_async_client() -> aioredis.Redis:
    """构造异步 Redis 客户端 (优先使用 REDIS_URL, 否则使用分项配置)."""
    if settings.REDIS_URL:
        return aioredis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=3,
            socket_timeout=3,
        )
    return aioredis.Redis(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        password=settings.REDIS_PASSWORD or None,
        db=settings.REDIS_DB,
        decode_responses=True,
        socket_connect_timeout=3,
        socket_timeout=3,
    )


def _build_sync_client() -> redis_sync.Redis:
    """构造同步 Redis 客户端."""
    if settings.REDIS_URL:
        return redis_sync.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=3,
            socket_timeout=3,
        )
    return redis_sync.Redis(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        password=settings.REDIS_PASSWORD or None,
        db=settings.REDIS_DB,
        decode_responses=True,
        socket_connect_timeout=3,
        socket_timeout=3,
    )


def get_redis_async() -> aioredis.Redis:
    """返回单例异步 Redis 客户端.

    若连接失败则尝试重新创建 (懒重连), 不在导入阶段抛错, 避免影响整个应用启动.
    """
    global _async_client
    if _async_client is None:
        try:
            _async_client = _build_async_client()
        except Exception as e:
            logger.debug("创建异步 Redis 客户端失败: %s", e)
            _async_client = None
            raise
    return _async_client


def get_redis_sync() -> redis_sync.Redis:
    """返回单例同步 Redis 客户端."""
    global _sync_client
    if _sync_client is None:
        try:
            _sync_client = _build_sync_client()
        except Exception as e:
            logger.debug("创建同步 Redis 客户端失败: %s", e)
            _sync_client = None
            raise
    return _sync_client


def reset_redis_clients() -> None:
    """重置单例 (主要用于测试或重连场景)."""
    global _async_client, _sync_client
    _async_client = None
    _sync_client = None


__all__ = ["get_redis_async", "get_redis_sync", "reset_redis_clients"]
