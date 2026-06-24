"""WebSocket 管理 API -- 运维 & 监控端点.

对应原项目 coze_zhs_py/api/websocket.py 中的:
  GET  /websocket/stats
  GET  /websocket/health
  POST /websocket/cleanup
  POST /websocket/disconnect/{client_id}

以及原项目 coze_zhs_py/api/socketio_chat.py 中的:
  POST /broadcast
  POST /send/{client_id}
  GET  /connections

新增:
  GET  /ws/system-status  系统状态(内存、CPU、连接数)

所有端点统一挂载在 /ws 前缀下.
"""

import contextlib
import os
import time
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.security import require_role
from app.utils.response import fail, success
from app.ws.manager import connection_manager

router = APIRouter(prefix="/ws", tags=["WS Admin"])


# ---------------------------------------------------------------------------
# 请求体
# ---------------------------------------------------------------------------


class BroadcastRequest(BaseModel):
    """广播消息体."""

    message: dict = Field(..., description="要广播的消息内容")
    room_id: str | None = Field(None, description="指定房间ID,为空则全局广播")


class SendToClientRequest(BaseModel):
    """发送给指定客户端."""

    message: dict = Field(..., description="要发送的消息内容")


# ---------------------------------------------------------------------------
# GET /ws/stats -- WebSocket 连接统计
# ---------------------------------------------------------------------------


@router.get("/stats", summary="WebSocket连接统计")
async def get_ws_stats(user_uuid: str = Depends(require_role("admin"))):
    """返回总连接数、房间数、用户数、消息数等.

    对应原项目 /cozeZhsApi/ws/websocket/stats
    """
    try:
        stats = connection_manager.stats()

        # 计算总消息数 (遍历 connection_info)
        _total_messages = 0
        active_count = 0
        now = time.time()
        for conn_id, _ws in connection_manager._connections.items():
            try:
                hb = connection_manager._heartbeat.get(conn_id, 0)
                if now - hb < 300:
                    active_count += 1
            except Exception:
                pass

        return success(
            {
                "total_connections": stats["total_connections"],
                "active_connections": active_count,
                "max_connections": 2000,
                "total_users": stats["total_users"],
                "total_rooms": stats["total_rooms"],
                "stale_heartbeats": stats["stale_heartbeats"],
                "instance_id": stats["instance_id"],
                "redis_pubsub_enabled": stats["redis_pubsub_enabled"],
                "timestamp": datetime.now(UTC).isoformat(),
            }
        )
    except Exception as e:
        return fail(f"获取统计信息失败: {e}", code=500)


# ---------------------------------------------------------------------------
# GET /ws/health -- WebSocket 健康检查
# ---------------------------------------------------------------------------


@router.get("/health", summary="WebSocket健康检查")
async def get_ws_health(user_uuid: str = Depends(require_role("admin"))):
    """健康状态评估 -- 对应原项目 /cozeZhsApi/ws/websocket/health"""
    try:
        stats = connection_manager.stats()
        total = stats["total_connections"]
        max_conn = 2000
        stale = stats["stale_heartbeats"]

        usage_ratio = total / max_conn if max_conn else 0
        stale_ratio = stale / max(total, 1)

        if usage_ratio > 0.9:
            status = "critical"
            message = "连接数接近上限"
        elif usage_ratio > 0.7:
            status = "warning"
            message = "连接数较高"
        elif stale_ratio > 0.5:
            status = "warning"
            message = "空闲连接过多"
        else:
            status = "healthy"
            message = "连接状态正常"

        return success(
            {
                "status": status,
                "message": message,
                "service": "WebSocket Service",
                "metrics": {
                    "usage_ratio": round(usage_ratio, 2),
                    "stale_ratio": round(stale_ratio, 2),
                    "total_connections": total,
                    "total_rooms": stats["total_rooms"],
                    "total_users": stats["total_users"],
                },
                "redis_pubsub_enabled": stats["redis_pubsub_enabled"],
                "instance_id": stats["instance_id"],
                "timestamp": datetime.now(UTC).isoformat(),
            }
        )
    except Exception as e:
        return fail(f"获取健康状态失败: {e}", code=500)


# ---------------------------------------------------------------------------
# POST /ws/cleanup -- 清理断开的连接
# ---------------------------------------------------------------------------


@router.post("/cleanup", summary="清理断开的连接")
async def cleanup_connections(user_uuid: str = Depends(require_role("admin"))):
    """扫描并清理已断开 / 超时的连接.

    对应原项目 /cozeZhsApi/ws/websocket/cleanup
    """
    try:
        before_count = len(connection_manager._connections)
        stale_ids: list[str] = []
        now = time.time()

        for conn_id, ts in list(connection_manager._heartbeat.items()):
            if now - ts > 120:  # 120秒无心跳视为断开
                stale_ids.append(conn_id)

        # 也检查连接是否实际可写
        for conn_id in list(connection_manager._connections.keys()):
            if conn_id in stale_ids:
                continue
            ws = connection_manager._connections.get(conn_id)
            if ws is None:
                stale_ids.append(conn_id)
                continue
            # 检查 WebSocket client_state
            try:
                if hasattr(ws, "client_state"):
                    state_name = ws.client_state.name
                    if state_name in ("DISCONNECTED", "CLOSED", "CLOSING"):
                        stale_ids.append(conn_id)
            except Exception:
                stale_ids.append(conn_id)

        # 批量断开
        cleaned = 0
        for conn_id in stale_ids:
            await connection_manager.disconnect(conn_id)
            cleaned += 1

        after_count = len(connection_manager._connections)
        return success(
            {
                "message": "WebSocket连接清理完成",
                "before_count": before_count,
                "after_count": after_count,
                "cleaned": cleaned,
                "timestamp": datetime.now(UTC).isoformat(),
            }
        )
    except Exception as e:
        return fail(f"清理失败: {e}", code=500)


# ---------------------------------------------------------------------------
# POST /ws/disconnect/{client_id} -- 强制断开指定客户端
# ---------------------------------------------------------------------------


@router.post("/disconnect/{conn_id}", summary="强制断开指定客户端")
async def force_disconnect(conn_id: str, user_uuid: str = Depends(require_role("admin"))):
    """对应原项目 /cozeZhsApi/ws/websocket/disconnect/{client_id}"""
    try:
        if conn_id not in connection_manager._connections:
            return fail(f"客户端 {conn_id} 不存在", code=404)

        # 尝试发送断开通知
        with contextlib.suppress(Exception):
            await connection_manager.send_to(
                conn_id,
                {
                    "code": 200,
                    "msg": "服务器主动断开连接",
                    "event": "force_disconnect",
                    "ts": int(time.time()),
                },
            )

        await connection_manager.disconnect(conn_id)
        return success(
            {
                "message": f"客户端 {conn_id} 已断开连接",
                "conn_id": conn_id,
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        return fail(f"断开连接失败: {e}", code=500)


# ---------------------------------------------------------------------------
# GET /ws/system-status -- 系统状态
# ---------------------------------------------------------------------------


@router.get("/system-status", summary="系统状态(内存、CPU、连接数)")
async def get_system_status(user_uuid: str = Depends(require_role("admin"))):
    """返回进程级系统状态, 包含内存 / CPU / 连接数."""
    try:
        import psutil

        process = psutil.Process(os.getpid())
        mem_info = process.memory_info()
        cpu_percent = process.cpu_percent(interval=0.1)

        # 系统级
        sys_mem = psutil.virtual_memory()

        ws_stats = connection_manager.stats()

        return success(
            {
                "process": {
                    "pid": os.getpid(),
                    "memory_rss_mb": round(mem_info.rss / 1024 / 1024, 2),
                    "memory_vms_mb": round(mem_info.vms / 1024 / 1024, 2),
                    "cpu_percent": cpu_percent,
                    "threads": process.num_threads(),
                },
                "system": {
                    "total_memory_mb": round(sys_mem.total / 1024 / 1024, 2),
                    "available_memory_mb": round(sys_mem.available / 1024 / 1024, 2),
                    "memory_percent": sys_mem.percent,
                    "cpu_count": psutil.cpu_count(),
                },
                "websocket": {
                    "total_connections": ws_stats["total_connections"],
                    "total_rooms": ws_stats["total_rooms"],
                    "total_users": ws_stats["total_users"],
                    "stale_heartbeats": ws_stats["stale_heartbeats"],
                    "instance_id": ws_stats["instance_id"],
                },
                "timestamp": datetime.now(UTC).isoformat(),
            }
        )
    except ImportError:
        # psutil 不可用时退化
        ws_stats = connection_manager.stats()
        return success(
            {
                "process": {
                    "pid": os.getpid(),
                    "note": "psutil not installed, process metrics unavailable",
                },
                "system": {
                    "note": "psutil not installed, system metrics unavailable",
                },
                "websocket": {
                    "total_connections": ws_stats["total_connections"],
                    "total_rooms": ws_stats["total_rooms"],
                    "total_users": ws_stats["total_users"],
                    "stale_heartbeats": ws_stats["stale_heartbeats"],
                    "instance_id": ws_stats["instance_id"],
                },
                "timestamp": datetime.now(UTC).isoformat(),
            }
        )
    except Exception as e:
        return fail(f"获取系统状态失败: {e}", code=500)


# ---------------------------------------------------------------------------
# POST /ws/broadcast -- 广播消息
# ---------------------------------------------------------------------------


@router.post("/broadcast", summary="广播消息")
async def broadcast_message(req: BroadcastRequest, user_uuid: str = Depends(require_role("admin"))):
    """广播消息到所有连接或指定房间.

    对应原项目 socketio_chat.py POST /broadcast
    """
    try:
        payload = req.message
        if req.room_id:
            count = await connection_manager.broadcast_room(req.room_id, payload)
            return success(
                {
                    "delivered": count,
                    "scope": "room",
                    "room_id": req.room_id,
                    "message": payload,
                }
            )
        else:
            count = await connection_manager.broadcast_all(payload)
            return success(
                {
                    "delivered": count,
                    "scope": "all",
                    "message": payload,
                }
            )
    except Exception as e:
        return fail(f"广播失败: {e}", code=500)


# ---------------------------------------------------------------------------
# POST /ws/send/{client_id} -- 发送消息给指定客户端
# ---------------------------------------------------------------------------


@router.post("/send/{conn_id}", summary="发送消息给指定客户端")
async def send_to_client(conn_id: str, req: SendToClientRequest, user_uuid: str = Depends(require_role("admin"))):
    """对应原项目 socketio_chat.py POST /send/{client_id}"""
    try:
        if conn_id not in connection_manager._connections:
            return fail(f"客户端 {conn_id} 不存在", code=404)

        ok = await connection_manager.send_to(conn_id, req.message)
        if ok:
            return success(
                {
                    "conn_id": conn_id,
                    "message": req.message,
                    "delivered": True,
                }
            )
        else:
            return fail(f"发送失败,客户端 {conn_id} 可能已断开", code=500)
    except HTTPException:
        raise
    except Exception as e:
        return fail(f"发送失败: {e}", code=500)


# ---------------------------------------------------------------------------
# GET /ws/connections -- 当前连接列表
# ---------------------------------------------------------------------------


@router.get("/connections", summary="当前连接列表")
async def get_connections(user_uuid: str = Depends(require_role("admin"))):
    """返回所有活跃连接的详细信息.

    对应原项目 socketio_chat.py GET /connections
    """
    try:
        connections: list[dict[str, Any]] = []
        now = time.time()

        for conn_id, _ws in connection_manager._connections.items():
            hb = connection_manager._heartbeat.get(conn_id, 0)

            # 查找该连接所属的房间
            rooms = []
            for room_id, members in connection_manager._room_map.items():
                if conn_id in members:
                    rooms.append(room_id)

            # 查找该连接绑定的用户
            conn_user_uuid = ""
            for uid, members in connection_manager._user_map.items():
                if conn_id in members:
                    conn_user_uuid = uid
                    break

            connections.append(
                {
                    "conn_id": conn_id,
                    "user_uuid": conn_user_uuid,
                    "rooms": rooms,
                    "connected_at": hb,
                    "last_heartbeat": hb,
                    "idle_seconds": round(now - hb, 1) if hb else None,
                    "is_alive": (now - hb) < 120 if hb else False,
                }
            )

        # 按 idle 升序排列
        connections.sort(key=lambda x: x.get("idle_seconds") or 999999)

        stats = connection_manager.stats()
        return success(
            {
                "total": stats["total_connections"],
                "users": stats["total_users"],
                "rooms": stats["total_rooms"],
                "connections": connections,
            }
        )
    except Exception as e:
        return fail(f"获取连接列表失败: {e}", code=500)
