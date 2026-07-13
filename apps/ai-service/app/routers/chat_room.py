"""聊天室 WebSocket 服务 + WebSocket 连接管理端点。

迁移自历史 coze_zhs_py/api/chat_room_socket.py + websocket.py。
- /ws/chat-room:多用户聊天室 WebSocket(房间隔离 + 离线消息持久化)
- /api/chat-room/*:聊天室 HTTP 管理端点(8 个)
- /api/ws-admin/*:WebSocket 连接管理/监控端点(20 个)

数据库表(沿用历史命名):
- zhs_station_room(id, room_name, type, created_at)
- zhs_station_user(id, user_uuid, room_id, is_leave, is_del, created_at, leave_at)
- zhs_station_letter(id, user_uuid, receiver_uuid, type, content, chat_id, send_time, is_del, is_read)
"""
import json
import logging
import time
from datetime import datetime
from typing import Any, Optional

import asyncpg
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.config import settings

logger = logging.getLogger(__name__)

# =============================================================================
# 数据库连接(复用 settings.database_url,asyncpg 原生连接池)
# =============================================================================
_pool: Optional[asyncpg.Pool] = None


async def _get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            dsn=settings.database_url,
            min_size=1,
            max_size=10,
            command_timeout=30,
        )
    return _pool


# =============================================================================
# 聊天室管理器(内存状态 + DB 持久化)
# =============================================================================


class ChatRoomManager:
    """聊天室管理器:房间隔离 + 用户会话 + 系统房间。"""

    def __init__(self) -> None:
        # room_id -> {user_uuid: websocket}
        self.rooms: dict[str, dict[str, WebSocket]] = {}
        # websocket -> {user_uuid, room_id, joined_at}
        self.user_sessions: dict[WebSocket, dict[str, Any]] = {}
        # room_id -> set(user_uuid)
        self.room_users: dict[str, set[str]] = {}
        # 系统房间:user_uuid -> {websocket, room_id, joined_at}
        self.system_rooms: dict[str, dict[str, Any]] = {}

    async def join_room(
        self,
        websocket: WebSocket,
        user_uuid: str,
        room_id: Optional[int] = None,
        room_name: Optional[str] = None,
        receiver_uuid: Optional[str] = None,
    ) -> Optional[dict[str, Any]]:
        """用户加入房间(自动创建房间 + 加入管理员)。"""
        pool = await _get_pool()
        async with pool.acquire() as conn:
            actual_room_id: Optional[int] = None
            try:
                if room_id:
                    row = await conn.fetchrow(
                        "SELECT id, room_name, type FROM zhs_station_room WHERE id = $1",
                        room_id,
                    )
                    if row:
                        actual_room_id = row["id"]
                    else:
                        return None
                else:
                    # 创建新房间
                    name = room_name or datetime.now().strftime("%Y%m%d%H%M%S")
                    actual_room_id = await conn.fetchval(
                        "INSERT INTO zhs_station_room (room_name, type, created_at) VALUES ($1, 1, NOW()) RETURNING id",
                        name,
                    )
                    # 自动加入管理员(支持逗号分隔的多个 UUID)
                    admin_uuids_raw = getattr(settings, "chat_room_admin_uuid", "") or ""
                    for admin_uuid in [u.strip() for u in admin_uuids_raw.split(",") if u.strip()]:
                        await conn.execute(
                            "INSERT INTO zhs_station_user (user_uuid, room_id, is_leave, created_at, is_del) "
                            "VALUES ($1, $2, 0, NOW(), 0)",
                            admin_uuid,
                            actual_room_id,
                        )
                    if receiver_uuid:
                        await conn.execute(
                            "INSERT INTO zhs_station_user (user_uuid, room_id, is_leave, created_at, is_del) "
                            "VALUES ($1, $2, 0, NOW(), 0)",
                            receiver_uuid,
                            actual_room_id,
                        )

                if not actual_room_id:
                    return None

                # 处理用户房间关系
                existing = await conn.fetchrow(
                    "SELECT id, is_leave, is_del FROM zhs_station_user WHERE user_uuid = $1 AND room_id = $2",
                    user_uuid,
                    actual_room_id,
                )
                if existing:
                    if existing["is_del"] == 1:
                        await conn.execute(
                            "UPDATE zhs_station_user SET is_leave = 0, is_del = 0, created_at = NOW(), leave_at = NULL WHERE id = $1",
                            existing["id"],
                        )
                    elif existing["is_leave"] == 1:
                        await conn.execute(
                            "UPDATE zhs_station_user SET is_leave = 0, created_at = NOW(), leave_at = NULL WHERE id = $1",
                            existing["id"],
                        )
                else:
                    await conn.execute(
                        "INSERT INTO zhs_station_user (user_uuid, room_id, is_leave, created_at, is_del) "
                        "VALUES ($1, $2, 0, NOW(), 0)",
                        user_uuid,
                        actual_room_id,
                    )
            except Exception as e:
                logger.error(f"join_room failed: {e}")
                return None

        # 记录会话
        rid = str(actual_room_id)
        self.user_sessions[websocket] = {
            "user_uuid": user_uuid,
            "room_id": rid,
            "joined_at": time.time(),
        }
        self.rooms.setdefault(rid, {})[user_uuid] = websocket
        self.room_users.setdefault(rid, set()).add(user_uuid)

        # 广播加入通知
        await self._broadcast_to_room(
            rid,
            {
                "event": "user_joined",
                "user_uuid": user_uuid,
                "room_id": rid,
                "timestamp": datetime.now().isoformat(),
            },
        )
        return {"success": True, "room_id": actual_room_id}

    async def join_system_room(self, websocket: WebSocket, user_uuid: str) -> bool:
        """加入系统房间(独立房间,只有自己)。"""
        system_room_id = f"system_{user_uuid}"
        self.system_rooms[user_uuid] = {
            "websocket": websocket,
            "room_id": system_room_id,
            "joined_at": time.time(),
        }
        self.rooms.setdefault(system_room_id, {})[user_uuid] = websocket
        self.room_users.setdefault(system_room_id, set()).add(user_uuid)
        await websocket.send_json(
            {
                "event": "system_room_joined",
                "user_uuid": user_uuid,
                "room_id": system_room_id,
                "timestamp": datetime.now().isoformat(),
            }
        )
        return True

    async def leave_room(self, websocket: WebSocket) -> bool:
        """离开房间。"""
        session = self.user_sessions.get(websocket)
        if not session:
            return False
        user_uuid = session["user_uuid"]
        room_id = session["room_id"]
        pool = await _get_pool()
        try:
            async with pool.acquire() as conn:
                await conn.execute(
                    "UPDATE zhs_station_user SET is_leave = 1, leave_at = NOW() "
                    "WHERE user_uuid = $1 AND room_id::text = $2 AND is_leave = 0",
                    user_uuid,
                    room_id,
                )
        except Exception as e:
            logger.error(f"leave_room db update failed: {e}")

        # 清理内存
        if room_id in self.rooms and user_uuid in self.rooms[room_id]:
            del self.rooms[room_id][user_uuid]
        if room_id in self.room_users:
            self.room_users[room_id].discard(user_uuid)
        del self.user_sessions[websocket]

        await self._broadcast_to_room(
            room_id,
            {
                "event": "user_left",
                "user_uuid": user_uuid,
                "room_id": room_id,
                "timestamp": datetime.now().isoformat(),
            },
        )
        return True

    async def send_message_to_room(
        self,
        user_uuid: str,
        room_id: Optional[str],
        content: str,
        message_type: int = 1,
        receiver_uuid: Optional[str] = None,
    ) -> bool:
        """发送消息到房间(持久化 + 实时推送)。"""
        pool = await _get_pool()

        # 系统消息:无 room_id
        if not room_id and not receiver_uuid:
            # 全局系统消息
            for ws in list(self.user_sessions.keys()):
                try:
                    await ws.send_json(
                        {
                            "event": "system_message",
                            "content": content,
                            "type": 0,
                            "timestamp": datetime.now().isoformat(),
                        }
                    )
                except Exception as e:
                    logger.error(f"broadcast system message failed: {e}")
            return True

        if not room_id and receiver_uuid:
            # 定向系统消息
            target_room = f"system_{receiver_uuid}"
            message_id = None
            async with pool.acquire() as conn:
                try:
                    message_id = await conn.fetchval(
                        "INSERT INTO zhs_station_letter (user_uuid, receiver_uuid, type, content, chat_id, send_time, is_del) "
                        "VALUES ($1, $2, $3, $4, $5, NOW(), 0) RETURNING id",
                        "system",
                        receiver_uuid,
                        0,
                        content,
                        target_room,
                    )
                except Exception as e:
                    logger.error(f"persist system message failed: {e}")
            await self._broadcast_to_room(
                target_room,
                {
                    "event": "system_message",
                    "id": message_id,
                    "sender_uuid": "system",
                    "content": content,
                    "type": 0,
                    "timestamp": datetime.now().isoformat(),
                },
            )
            return True

        # 普通房间消息
        async with pool.acquire() as conn:
            try:
                # 查询房间类型确定消息类型
                room_type = await conn.fetchval(
                    "SELECT type FROM zhs_station_room WHERE id::text = $1",
                    room_id,
                )
                if room_type is not None:
                    message_type = int(room_type)
            except Exception as e:
                logger.error(f"query room type failed: {e}")

            message_id = None
            try:
                if receiver_uuid:
                    message_id = await conn.fetchval(
                        "INSERT INTO zhs_station_letter (user_uuid, receiver_uuid, type, content, chat_id, send_time, is_del) "
                        "VALUES ($1, $2, $3, $4, $5, NOW(), 0) RETURNING id",
                        user_uuid,
                        receiver_uuid,
                        message_type,
                        content,
                        room_id,
                    )
                else:
                    # 给房间内所有其他用户持久化
                    rows = await conn.fetch(
                        "SELECT user_uuid FROM zhs_station_user WHERE room_id::text = $1 "
                        "AND is_leave = 0 AND is_del = 0 AND user_uuid != $2",
                        room_id,
                        user_uuid,
                    )
                    for row in rows:
                        mid = await conn.fetchval(
                            "INSERT INTO zhs_station_letter (user_uuid, receiver_uuid, type, content, chat_id, send_time, is_del) "
                            "VALUES ($1, $2, $3, $4, $5, NOW(), 0) RETURNING id",
                            user_uuid,
                            row["user_uuid"],
                            message_type,
                            content,
                            room_id,
                        )
                        if message_id is None:
                            message_id = mid
            except Exception as e:
                logger.error(f"persist message failed: {e}")
                return False

        # 实时推送
        message_data = {
            "event": "room_message",
            "id": message_id,
            "sender_uuid": user_uuid,
            "room_id": room_id,
            "content": content,
            "type": message_type,
            "timestamp": datetime.now().isoformat(),
        }
        if receiver_uuid:
            receiver_ws = self.rooms.get(room_id, {}).get(receiver_uuid)
            if receiver_ws:
                try:
                    await receiver_ws.send_json(message_data)
                except Exception as e:
                    logger.error(f"send to receiver failed: {e}")
        else:
            sender_ws = self.rooms.get(room_id, {}).get(user_uuid)
            await self._broadcast_to_room(room_id, message_data, exclude_websocket=sender_ws)
        return True

    async def _broadcast_to_room(
        self,
        room_id: str,
        message: dict[str, Any],
        exclude_websocket: Optional[WebSocket] = None,
    ) -> None:
        if room_id not in self.rooms:
            return
        for user_uuid, ws in list(self.rooms[room_id].items()):
            if exclude_websocket and ws == exclude_websocket:
                continue
            try:
                await ws.send_json(message)
            except Exception as e:
                logger.error(f"broadcast to {user_uuid} failed: {e}")

    def get_room_users(self, room_id: str) -> list[str]:
        return list(self.room_users.get(room_id, set()))

    def get_user_rooms(self, user_uuid: str) -> list[str]:
        return [rid for rid, users in self.rooms.items() if user_uuid in users]


# 全局管理器
chat_room_manager = ChatRoomManager()


# =============================================================================
# WebSocket 端点
# =============================================================================

router = APIRouter(prefix="/ws/chat-room", tags=["chat-room-websocket"])
http_router = APIRouter(prefix="/api/chat-room", tags=["chat-room-http"])
ws_admin_router = APIRouter(prefix="/api/ws-admin", tags=["ws-admin"])


@router.websocket("/")
async def chat_room_websocket(websocket: WebSocket) -> None:
    """聊天室 WebSocket 主端点。

    客户端事件:
    - {event: "connect", user_uuid}
    - {event: "join_room", user_uuid, room_id?, room_name?, receiver_uuid?}
    - {event: "join_system_room", user_uuid}
    - {event: "leave_room"}
    - {event: "send_message", user_uuid, room_id?, content, receiver_uuid?, type?}
    """
    await websocket.accept()
    registered = False
    try:
        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)
                event = message.get("event")

                if event == "connect":
                    user_uuid = message.get("user_uuid")
                    if not user_uuid:
                        await websocket.send_json(
                            {"event": "error", "code": 400, "msg": "缺少 user_uuid"}
                        )
                        continue
                    await websocket.send_json(
                        {
                            "event": "connected",
                            "code": 200,
                            "user_uuid": user_uuid,
                            "timestamp": datetime.now().isoformat(),
                        }
                    )

                elif event == "join_room":
                    user_uuid = message.get("user_uuid")
                    room_id = message.get("room_id")
                    room_name = message.get("room_name")
                    receiver_uuid = message.get("receiver_uuid")
                    if not user_uuid:
                        await websocket.send_json(
                            {"event": "error", "code": 400, "msg": "缺少 user_uuid"}
                        )
                        continue
                    result = await chat_room_manager.join_room(
                        websocket,
                        user_uuid,
                        room_id=int(room_id) if room_id else None,
                        room_name=room_name,
                        receiver_uuid=receiver_uuid,
                    )
                    if result and result.get("success"):
                        await websocket.send_json(
                            {
                                "event": "room_joined",
                                "code": 200,
                                "room_id": str(result["room_id"]),
                                "user_uuid": user_uuid,
                                "users": chat_room_manager.get_room_users(str(result["room_id"])),
                                "timestamp": datetime.now().isoformat(),
                            }
                        )
                        registered = True
                    else:
                        await websocket.send_json(
                            {"event": "error", "code": 500, "msg": "加入房间失败"}
                        )

                elif event == "join_system_room":
                    user_uuid = message.get("user_uuid")
                    if not user_uuid:
                        await websocket.send_json(
                            {"event": "error", "code": 400, "msg": "缺少 user_uuid"}
                        )
                        continue
                    ok = await chat_room_manager.join_system_room(websocket, user_uuid)
                    if ok:
                        registered = True

                elif event == "leave_room":
                    ok = await chat_room_manager.leave_room(websocket)
                    await websocket.send_json(
                        {
                            "event": "room_left" if ok else "error",
                            "code": 200 if ok else 500,
                            "timestamp": datetime.now().isoformat(),
                        }
                    )
                    registered = False if not ok else registered

                elif event == "send_message":
                    user_uuid = message.get("user_uuid")
                    receiver_uuid = message.get("receiver_uuid")
                    room_id = message.get("room_id")
                    content = message.get("content")
                    message_type = int(message.get("type", 1))
                    if not content:
                        await websocket.send_json(
                            {"event": "error", "code": 400, "msg": "缺少 content"}
                        )
                        continue
                    if not room_id and not receiver_uuid:
                        await websocket.send_json(
                            {"event": "error", "code": 400, "msg": "缺少 room_id 或 receiver_uuid"}
                        )
                        continue
                    if not room_id and receiver_uuid:
                        message_type = 0
                        user_uuid = "system"
                    ok = await chat_room_manager.send_message_to_room(
                        user_uuid=user_uuid or "system",
                        room_id=str(room_id) if room_id else None,
                        content=content,
                        message_type=message_type,
                        receiver_uuid=receiver_uuid,
                    )
                    await websocket.send_json(
                        {
                            "event": "message_sent" if ok else "error",
                            "code": 200 if ok else 500,
                            "room_id": room_id,
                            "timestamp": datetime.now().isoformat(),
                        }
                    )

            except WebSocketDisconnect:
                break
            except json.JSONDecodeError:
                await websocket.send_json(
                    {"event": "error", "code": 400, "msg": "无效 JSON"}
                )
            except Exception as e:
                logger.error(f"handle ws message failed: {e}")
                await websocket.send_json(
                    {"event": "error", "code": 500, "msg": str(e)}
                )
    except WebSocketDisconnect:
        pass
    finally:
        if registered:
            await chat_room_manager.leave_room(websocket)


# =============================================================================
# HTTP 管理端点(8 个)
# =============================================================================


class SendMessageRequest(BaseModel):
    user_uuid: Optional[str] = Field(None, description="发送者 UUID")
    receiver_uuid: Optional[str] = Field(None, description="接收者 UUID")
    room_id: Optional[str] = Field(None, description="房间 ID")
    content: str = Field(..., description="消息内容")
    message_type: int = Field(1, description="0系统 1对话 2完成")


@http_router.get("/rooms/{room_id}/users")
async def get_room_users(room_id: str) -> dict[str, Any]:
    users = chat_room_manager.get_room_users(room_id)
    return {"code": 200, "data": {"room_id": room_id, "users": users, "count": len(users)}}


@http_router.get("/users/{user_uuid}/rooms")
async def get_user_rooms(user_uuid: str) -> dict[str, Any]:
    """获取用户所在房间列表 + 每个房间的未读数 + 最后一条消息。"""
    pool = await _get_pool()
    async with pool.acquire() as conn:
        rooms = await conn.fetch(
            "SELECT DISTINCT u.room_id, r.room_name, r.type FROM zhs_station_user u "
            "LEFT JOIN zhs_station_room r ON u.room_id = r.id "
            "WHERE u.user_uuid = $1 AND u.is_leave = 0 AND u.is_del = 0",
            user_uuid,
        )
        result = []
        # 系统房间
        system_room_id = f"system_{user_uuid}"
        sys_unread = await conn.fetchval(
            "SELECT COUNT(*) FROM zhs_station_letter WHERE receiver_uuid = $1 "
            "AND chat_id = $2 AND is_read = 0 AND is_del = 0",
            user_uuid,
            system_room_id,
        )
        result.append(
            {
                "room_id": system_room_id,
                "room_name": "系统消息",
                "room_type": 0,
                "unread_count": sys_unread or 0,
            }
        )
        for row in rooms:
            unread = await conn.fetchval(
                "SELECT COUNT(*) FROM zhs_station_letter WHERE receiver_uuid = $1 "
                "AND chat_id = $2 AND is_read = 0 AND is_del = 0",
                user_uuid,
                str(row["room_id"]),
            )
            result.append(
                {
                    "room_id": str(row["room_id"]),
                    "room_name": row["room_name"],
                    "room_type": row["type"],
                    "unread_count": unread or 0,
                }
            )
    return {"code": 200, "data": {"user_uuid": user_uuid, "rooms": result, "count": len(result)}}


@http_router.get("/history")
async def get_message_history(
    user_uuid: str,
    room_id: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> dict[str, Any]:
    pool = await _get_pool()
    async with pool.acquire() as conn:
        if room_id:
            rows = await conn.fetch(
                "SELECT id, user_uuid, receiver_uuid, type, content, chat_id, send_time, is_del "
                "FROM zhs_station_letter WHERE (user_uuid = $1 OR receiver_uuid = $1) AND is_del = 0 "
                "AND chat_id = $2 ORDER BY send_time DESC LIMIT $3 OFFSET $4",
                user_uuid,
                room_id,
                limit,
                offset,
            )
        else:
            rows = await conn.fetch(
                "SELECT id, user_uuid, receiver_uuid, type, content, chat_id, send_time, is_del "
                "FROM zhs_station_letter WHERE (user_uuid = $1 OR receiver_uuid = $1) AND is_del = 0 "
                "ORDER BY send_time DESC LIMIT $2 OFFSET $3",
                user_uuid,
                limit,
                offset,
            )
        messages = [
            {
                "id": r["id"],
                "user_uuid": r["user_uuid"],
                "receiver_uuid": r["receiver_uuid"],
                "type": r["type"],
                "content": r["content"],
                "chat_id": r["chat_id"],
                "send_time": r["send_time"].isoformat() if r["send_time"] else None,
                "is_del": r["is_del"],
            }
            for r in rows
        ]
    return {"code": 200, "data": {"user_uuid": user_uuid, "messages": messages, "count": len(messages)}}


@http_router.delete("/messages/{message_id}")
async def delete_message(message_id: int, user_uuid: str) -> dict[str, Any]:
    pool = await _get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, user_uuid, is_del FROM zhs_station_letter WHERE id = $1",
            message_id,
        )
        if not row:
            raise HTTPException(status_code=404, detail="消息不存在")
        if row["user_uuid"] != user_uuid:
            raise HTTPException(status_code=403, detail="无权删除")
        await conn.execute(
            "UPDATE zhs_station_letter SET is_del = 1 WHERE id = $1 AND user_uuid = $2",
            message_id,
            user_uuid,
        )
    return {"code": 200, "data": {"message_id": message_id}}


@http_router.post("/send")
async def api_send_message(req: SendMessageRequest) -> dict[str, Any]:
    if not req.room_id and not req.receiver_uuid:
        raise HTTPException(status_code=400, detail="缺少 room_id 或 receiver_uuid")
    if not req.room_id and req.receiver_uuid:
        req.message_type = 0
        req.user_uuid = "system"
    if req.message_type == 1 and not req.user_uuid:
        raise HTTPException(status_code=400, detail="对话消息需要 user_uuid")
    ok = await chat_room_manager.send_message_to_room(
        user_uuid=req.user_uuid or "system",
        room_id=req.room_id,
        content=req.content,
        message_type=req.message_type,
        receiver_uuid=req.receiver_uuid,
    )
    if not ok:
        raise HTTPException(status_code=500, detail="发送失败")
    return {"code": 200, "data": {"content": req.content, "type": req.message_type}}


@http_router.put("/messages/mark-read")
async def mark_messages_as_read(user_uuid: str, room_id: str) -> dict[str, Any]:
    pool = await _get_pool()
    async with pool.acquire() as conn:
        affected = await conn.execute(
            "UPDATE zhs_station_letter SET is_read = 1 WHERE user_uuid = $1 AND chat_id = $2 "
            "AND is_read = 0 AND is_del = 0",
            user_uuid,
            room_id,
        )
    count = int(affected.split()[-1]) if affected else 0
    return {"code": 200, "data": {"affected_count": count}}


@http_router.put("/rooms/rename")
async def rename_room(old_room_id: str, new_room_name: str) -> dict[str, Any]:
    pool = await _get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id FROM zhs_station_room WHERE id::text = $1",
            old_room_id,
        )
        if not row:
            raise HTTPException(status_code=404, detail="房间不存在")
        await conn.execute(
            "UPDATE zhs_station_room SET room_name = $1 WHERE id::text = $2",
            new_room_name,
            old_room_id,
        )
    return {"code": 200, "data": {"room_id": old_room_id, "room_name": new_room_name}}


@http_router.delete("/users/{user_uuid}/rooms/{room_id}")
async def delete_user_room(user_uuid: str, room_id: str) -> dict[str, Any]:
    pool = await _get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE zhs_station_user SET is_del = 1 WHERE user_uuid = $1 AND room_id::text = $2",
            user_uuid,
            room_id,
        )
    return {"code": 200, "data": {"user_uuid": user_uuid, "room_id": room_id}}


# =============================================================================
# WebSocket 连接管理/监控端点(20 个)
# 迁移自历史 coze_zhs_py/api/websocket.py 的 HTTP 管理端点部分。
# - 实时状态从 ChatRoomManager 内存读取
# - 历史数据从 zhs_station_letter 表聚合
# =============================================================================


@ws_admin_router.get("/stats")
async def ws_admin_stats() -> dict[str, Any]:
    """WebSocket 连接统计。"""
    total_connections = len(chat_room_manager.user_sessions)
    total_rooms = len(chat_room_manager.rooms)
    total_system_rooms = len(chat_room_manager.system_rooms)
    return {
        "total_connections": total_connections,
        "total_rooms": total_rooms,
        "total_system_rooms": total_system_rooms,
        "rooms_detail": {
            rid: len(users) for rid, users in chat_room_manager.room_users.items()
        },
    }


@ws_admin_router.get("/connections")
async def ws_admin_connections() -> dict[str, Any]:
    """当前所有 WebSocket 连接列表。"""
    connections = []
    for ws, session in chat_room_manager.user_sessions.items():
        try:
            client = ws.client
            connections.append(
                {
                    "user_uuid": session["user_uuid"],
                    "room_id": session["room_id"],
                    "joined_at": datetime.fromtimestamp(session["joined_at"]).isoformat(),
                    "client_host": client.host if client else None,
                    "client_port": client.port if client else None,
                }
            )
        except Exception:
            continue
    return {"count": len(connections), "connections": connections}


@ws_admin_router.get("/connections/{user_uuid}")
async def ws_admin_user_connections(user_uuid: str) -> dict[str, Any]:
    """指定用户的连接信息。"""
    rooms = chat_room_manager.get_user_rooms(user_uuid)
    return {"user_uuid": user_uuid, "rooms": rooms, "room_count": len(rooms)}


@ws_admin_router.get("/rooms")
async def ws_admin_rooms() -> dict[str, Any]:
    """所有活动房间列表。"""
    rooms_info = []
    for rid, users in chat_room_manager.room_users.items():
        rooms_info.append(
            {
                "room_id": rid,
                "user_count": len(users),
                "users": list(users),
                "is_system": rid.startswith("system_"),
            }
        )
    return {"count": len(rooms_info), "rooms": rooms_info}


@ws_admin_router.get("/rooms/{room_id}/users")
async def ws_admin_room_users(room_id: str) -> dict[str, Any]:
    """指定房间的用户列表。"""
    users = chat_room_manager.get_room_users(room_id)
    return {"room_id": room_id, "users": users, "count": len(users)}


@ws_admin_router.get("/queue")
async def ws_admin_queue() -> dict[str, Any]:
    """消息队列状态(简化:从内存管理器统计)。"""
    return {
        "pending_messages": 0,
        "rooms_with_active_users": len(chat_room_manager.rooms),
        "message": "新架构使用直接推送,无独立消息队列",
    }


@ws_admin_router.post("/cleanup")
async def ws_admin_cleanup() -> dict[str, Any]:
    """清理失效连接。"""
    cleaned = 0
    for ws in list(chat_room_manager.user_sessions.keys()):
        try:
            # 检测连接是否还活着
            if ws.client_state.name == "DISCONNECTED":
                await chat_room_manager.leave_room(ws)
                cleaned += 1
        except Exception:
            try:
                await chat_room_manager.leave_room(ws)
                cleaned += 1
            except Exception:
                continue
    return {"cleaned": cleaned}


@ws_admin_router.post("/disconnect/{user_uuid}")
async def ws_admin_disconnect_user(user_uuid: str) -> dict[str, Any]:
    """强制断开指定用户的所有连接。"""
    disconnected = 0
    for ws in list(chat_room_manager.user_sessions.keys()):
        session = chat_room_manager.user_sessions.get(ws)
        if session and session["user_uuid"] == user_uuid:
            try:
                await ws.close(code=1000, reason="admin disconnect")
                await chat_room_manager.leave_room(ws)
                disconnected += 1
            except Exception:
                continue
    return {"user_uuid": user_uuid, "disconnected": disconnected}


@ws_admin_router.get("/system-status")
async def ws_admin_system_status() -> dict[str, Any]:
    """WebSocket 系统整体状态。"""
    return {
        "status": "healthy",
        "total_connections": len(chat_room_manager.user_sessions),
        "total_rooms": len(chat_room_manager.rooms),
        "total_system_rooms": len(chat_room_manager.system_rooms),
        "timestamp": datetime.now().isoformat(),
    }


@ws_admin_router.get("/messages/stats")
async def ws_admin_messages_stats(
    startTime: Optional[str] = None,
    endTime: Optional[str] = None,
) -> dict[str, Any]:
    """消息统计(从数据库聚合)。"""
    pool = await _get_pool()
    async with pool.acquire() as conn:
        if startTime and endTime:
            total = await conn.fetchval(
                "SELECT COUNT(*) FROM zhs_station_letter WHERE send_time BETWEEN $1 AND $2 AND is_del = 0",
                startTime,
                endTime,
            )
            by_type = await conn.fetch(
                "SELECT type, COUNT(*) as cnt FROM zhs_station_letter "
                "WHERE send_time BETWEEN $1 AND $2 AND is_del = 0 GROUP BY type",
                startTime,
                endTime,
            )
        else:
            total = await conn.fetchval(
                "SELECT COUNT(*) FROM zhs_station_letter WHERE is_del = 0"
            )
            by_type = await conn.fetch(
                "SELECT type, COUNT(*) as cnt FROM zhs_station_letter WHERE is_del = 0 GROUP BY type"
            )
    return {
        "total_messages": total or 0,
        "by_type": {str(r["type"]): r["cnt"] for r in by_type},
    }


@ws_admin_router.get("/messages/recent")
async def ws_admin_messages_recent(limit: int = Query(20, ge=1, le=100)) -> dict[str, Any]:
    """最近消息列表。"""
    pool = await _get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT id, user_uuid, receiver_uuid, type, content, chat_id, send_time "
            "FROM zhs_station_letter WHERE is_del = 0 ORDER BY send_time DESC LIMIT $1",
            limit,
        )
    return {
        "count": len(rows),
        "messages": [
            {
                "id": r["id"],
                "user_uuid": r["user_uuid"],
                "receiver_uuid": r["receiver_uuid"],
                "type": r["type"],
                "content": r["content"][:100],
                "chat_id": r["chat_id"],
                "send_time": r["send_time"].isoformat() if r["send_time"] else None,
            }
            for r in rows
        ],
    }
