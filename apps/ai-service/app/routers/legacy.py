"""历史项目迁移补齐：集中实现 coze_zhs_py 缺失的端点。"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Any
import json

from app.core.config import settings

# redis 包未安装时降级(参考 services/memory.py 模式)
try:
    import redis.asyncio as aioredis
except ImportError:
    aioredis = None  # type: ignore[assignment]

router = APIRouter(prefix="/api/legacy", tags=["legacy"])

# 分类字典缓存 Redis key
_CATEGORY_CACHE_KEY = "agent:category:dict"

_redis_client: Any = None
_use_redis = bool(settings.redis_url) and aioredis is not None


async def _get_redis() -> Any:
    """获取 Redis 客户端,连接失败时返回 None。"""
    global _redis_client, _use_redis
    if not _use_redis:
        return None
    if _redis_client is None:
        try:
            _redis_client = aioredis.from_url(settings.redis_url, decode_responses=True)
            await _redis_client.ping()
        except Exception:
            _use_redis = False
            _redis_client = None
    return _redis_client


# ============ Socket.IO 兼容端点 ============
@router.get("/socketio/status")
async def socketio_status():
    """Socket.IO 兼容状态查询。新架构使用原生 WebSocket，此端点用于旧客户端兼容检测。"""
    return {"supported": False, "alternative": "/ws/chat", "message": "请使用原生 WebSocket 端点 /ws/chat"}


# ============ 卡片转换工具 ============
@router.post("/card/convert")
async def convert_card(data: dict):
    """Coze 卡片数据格式转换。将 Coze 卡片结构转换为前端展示格式。"""
    card_data = data.get("card", {})
    display_format = {
        "type": card_data.get("type", "default"),
        "title": card_data.get("title", ""),
        "content": card_data.get("content", ""),
        "images": card_data.get("images", []),
        "actions": card_data.get("actions", []),
        "footer": card_data.get("footer", ""),
    }
    return {"converted": display_format}


# ============ 分类缓存(Redis) ============
@router.get("/category/cache")
async def get_category_cache(category_type: str = "agent"):
    """从 Redis 读取分类字典缓存(key: agent:category:dict)。"""
    redis = await _get_redis()
    if redis is None:
        raise HTTPException(
            status_code=503,
            detail="Redis 不可用,分类缓存功能未启用。请配置 REDIS_URL 并安装 redis 包。",
        )
    raw = await redis.get(_CATEGORY_CACHE_KEY)
    if raw is None:
        return {"categories": [], "cached": False, "key": _CATEGORY_CACHE_KEY}
    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return {"categories": [], "cached": False, "key": _CATEGORY_CACHE_KEY, "error": "缓存数据格式异常"}
    if isinstance(data, dict):
        categories = data.get(category_type, [])
    else:
        categories = data
    return {"categories": categories, "cached": True, "key": _CATEGORY_CACHE_KEY}


@router.post("/category/cache/refresh")
async def refresh_category_cache():
    """触发缓存刷新：删除 Redis key,下次请求时由调用方重建。"""
    redis = await _get_redis()
    if redis is None:
        raise HTTPException(
            status_code=503,
            detail="Redis 不可用,分类缓存功能未启用。请配置 REDIS_URL 并安装 redis 包。",
        )
    deleted = await redis.delete(_CATEGORY_CACHE_KEY)
    return {"refreshed": True, "deleted": deleted, "key": _CATEGORY_CACHE_KEY, "message": "缓存已清除,下次请求将重建"}


# ============ 公共 Socket 状态 ============
@router.get("/public-socket/status")
async def public_socket_status():
    """公共 Socket 推送状态查询。"""
    return {
        "supported": False,
        "alternative": "/ws/notifications",
        "message": "请使用 /ws/notifications 端点接收推送消息",
    }


# ============ WebSocket 音频状态 ============
@router.get("/ws-audio/status")
async def ws_audio_status():
    """WebSocket 独立音频流状态查询。"""
    return {
        "supported": True,
        "endpoint": "/ws/realtime/pcm",
        "message": "请使用 /ws/realtime/pcm 端点进行实时音频流传输",
    }


# ============ Coze 兼容提示 ============
@router.get("/coze/compat")
async def coze_compat():
    """Coze 兼容接口提示。"""
    return {
        "supported": True,
        "message": "Coze 兼容层已集成到新架构,请使用 /api/agents 相关端点",
        "alternative": "/api/agents",
    }


# ============ 旧 API 迁移状态 ============
@router.get("/old-api/status")
async def old_api_status():
    """旧 API 迁移状态查询。"""
    return {"migrated": True, "newApi": "/api/agents"}


# =============================================================================
# 架构决策:不迁移的服务
# - avatar_sync_service.py: 旧架构用于跨数据源同步智能体头像,单库架构下无需跨源同步
# - sync_agents.py: 旧架构用于跨数据源同步智能体数据,单库架构下无需跨源同步
# - category_converter.py / category_sync_tool.py: 旧架构分类转换工具,单库架构下无需
# =============================================================================

