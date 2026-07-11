"""历史项目迁移补齐：集中实现 coze_zhs_py 缺失的端点。"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Any
import json

router = APIRouter(prefix="/api/legacy", tags=["legacy"])

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

# ============ 分类缓存 ============
_category_cache: dict = {}

@router.get("/category/cache")
async def get_category_cache(category_type: str = "agent"):
    """获取分类字典缓存。"""
    return {"categories": _category_cache.get(category_type, [])}

@router.post("/category/cache/refresh")
async def refresh_category_cache(category_type: str, categories: List[Any]):
    """刷新分类缓存。"""
    _category_cache[category_type] = categories
    return {"refreshed": True, "count": len(categories)}

# ============ 分类同步 ============
@router.post("/category/sync")
async def sync_categories(source: str, target: str):
    """跨数据源分类同步。新架构使用单库 + schema 隔离，此端点为兼容接口。"""
    return {
        "synced": False,
        "message": f"新架构使用单库 + schema 隔离，无需从 {source} 同步到 {target}",
        "alternative": "请直接在 PostgreSQL 数据库中维护分类数据"
    }

# ============ WebRTC 语音通话状态 ============
@router.get("/webrtc/status")
async def webrtc_status():
    """WebRTC 语音通话状态查询。"""
    return {
        "supported": False,
        "message": "WebRTC 语音通话功能未迁移，建议使用第三方服务（如 Agora/LiveKit）",
        "alternative_apis": ["/ws/agent/stream", "/ws/realtime/pcm"]
    }

# ============ 公共 Socket 状态 ============
@router.get("/public-socket/status")
async def public_socket_status():
    """公共 Socket 推送状态查询。"""
    return {
        "supported": False,
        "alternative": "/ws/notifications",
        "message": "请使用 /ws/notifications 端点接收推送消息"
    }

# ============ WebSocket 音频状态 ============
@router.get("/ws-audio/status")
async def ws_audio_status():
    """WebSocket 独立音频流状态查询。"""
    return {
        "supported": True,
        "endpoint": "/ws/realtime/pcm",
        "message": "请使用 /ws/realtime/pcm 端点进行实时音频流传输"
    }

# ============ 一键视频（历史注册项占位） ============
@router.get("/one-click-video/status")
async def one_click_video_status():
    """一键视频功能状态查询。"""
    return {
        "supported": False,
        "message": "历史项目注册但未实现的功能，新项目暂不支持"
    }
