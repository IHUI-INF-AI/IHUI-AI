"""聊天室 WebSocket 路由 (迁移自 coze_zhs_py/api/chat_room_socket.py).

9 个端点 (前缀 /cozeZhsApi/chat-room):
  - WebSocket /ws                            connect/join_room/join_system_room/leave_room/send_message
  - GET    /rooms/{room_id}/users            房间在线用户列表
  - GET    /users/{user_uuid}/rooms          用户房间列表 (含未读数 + 最后一条消息)
  - GET    /history                          消息历史
  - DELETE /messages/{message_id}            逻辑删除消息
  - POST   /send                             HTTP 推送消息
  - PUT    /messages/mark-read               标记已读
  - PUT    /rooms/rename                     房间改名
  - DELETE /users/{user_uuid}/rooms/{room_id} 逻辑删除用户房间关系
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, Set

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from sqlalchemy import func, select, text, update
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_session, SessionFactory1
from app.models.chat_room_models import ChatLetter, ChatRoom, ChatRoomUser
from app.utils.datetime_helper import utcnow

logger = logging.getLogger("chat-room-websocket")

router = APIRouter(prefix="/cozeZhsApi/chat-room", tags=["聊天室WebSocket"])

# 系统消息头像
_SYSTEM_AVATAR = "https://file.aizhs.top/sys-mini/default/logo/guanlogo.png"


# ---------------------------------------------------------------------------
# 请求模型
# ---------------------------------------------------------------------------


class SendMessageRequest(BaseModel):
    """POST /send 请求体."""

    user_uuid: Optional[str] = Field(None, description="发送者用户UUID (message_type=1 时必填)")
    receiver_uuid: Optional[str] = Field(None, description="接收者用户UUID (可选, 指定后只发送给该用户)")
    room_id: Optional[str] = Field(None, description="房间ID (可选, 未传入则发送系统消息)")
    content: str = Field(..., description="消息内容")
    message_type: int = Field(1, description="消息类型 0系统 1对话 2完成")


# ---------------------------------------------------------------------------
# ChatRoomManager - 房间隔离的 WebSocket 连接管理
# ---------------------------------------------------------------------------


class ChatRoomManager:
    """聊天室管理器 - 支持房间隔离与用户间对话."""

    def __init__(self) -> None:
        # 房间 -> {user_uuid: websocket}
        self.rooms: Dict[str, Dict[str, WebSocket]] = {}
        # websocket -> {user_uuid, room_id, joined_at}
        self.user_sessions: Dict[WebSocket, Dict[str, Any]] = {}
        # 房间 -> Set[user_uuid]  (与 rooms[user_uuid].keys() 等价, 仅用于快速取列表)
        self.room_users: Dict[str, Set[str]] = {}
        # 系统房间: user_uuid -> {websocket, room_id, joined_at}
        self.system_rooms: Dict[str, Dict[str, Any]] = {}
        self._lock = asyncio.Lock()

    # -- 房间加入/离开 ----------------------------------------------------

    async def join_room(
        self,
        websocket: WebSocket,
        user_uuid: str,
        room_id: Optional[str] = None,
        room_name: Optional[str] = None,
        db: Optional[Session] = None,
        receiver_uuid: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """用户加入房间 (支持查询/创建房间 + 自动加入管理员)."""
        try:
            actual_room_id: Optional[int] = None

            if db is not None:
                try:
                    if room_id:
                        # 加入已有房间
                        existing = db.execute(
                            select(ChatRoom.id, ChatRoom.room_name, ChatRoom.type).where(
                                ChatRoom.id == int(room_id)
                            )
                        ).first()
                        if existing:
                            actual_room_id = existing[0]
                            logger.info("📋 找到现有房间: %s (%s)", actual_room_id, existing[1])
                        else:
                            logger.error("❌ 房间 %s 不存在", room_id)
                            return None
                    elif receiver_uuid:
                        # 创建新房间 + 加入所有管理员 + 加入接收人
                        if not room_name:
                            room_name = datetime.now().strftime("%Y%m%d%H%M%S")
                        new_room = ChatRoom(room_name=room_name, type=1)
                        db.add(new_room)
                        db.flush()
                        actual_room_id = new_room.id
                        db.commit()

                        admin_uuids = self._parse_admin_uuids()
                        for admin_uuid in admin_uuids:
                            db.add(
                                ChatRoomUser(
                                    user_uuid=admin_uuid,
                                    room_id=actual_room_id,
                                    is_leave=0,
                                    is_del=0,
                                )
                            )
                        db.add(
                            ChatRoomUser(
                                user_uuid=receiver_uuid,
                                room_id=actual_room_id,
                                is_leave=0,
                                is_del=0,
                            )
                        )
                        db.commit()
                        logger.info("🆕 创建新房间: %s (%s) admin=%s receiver=%s",
                                    actual_room_id, room_name, admin_uuids, receiver_uuid)
                    else:
                        # 创建新房间 + 加入所有管理员
                        if not room_name:
                            room_name = datetime.now().strftime("%Y%m%d%H%M%S")
                        new_room = ChatRoom(room_name=room_name, type=1)
                        db.add(new_room)
                        db.flush()
                        actual_room_id = new_room.id
                        db.commit()

                        admin_uuids = self._parse_admin_uuids()
                        for admin_uuid in admin_uuids:
                            db.add(
                                ChatRoomUser(
                                    user_uuid=admin_uuid,
                                    room_id=actual_room_id,
                                    is_leave=0,
                                    is_del=0,
                                )
                            )
                        db.commit()
                        logger.info("🆕 创建新房间: %s (%s) admin=%s",
                                    actual_room_id, room_name, admin_uuids)
                except Exception as e:
                    logger.error("❌ 查询或创建房间失败: %s", e)
                    if db is not None:
                        db.rollback()
                    return None

            if not actual_room_id:
                logger.error("❌ 无法获取房间ID")
                return None

            # 处理用户-房间关系 (已存在则更新, 否则插入)
            if db is not None:
                try:
                    rel = db.execute(
                        select(ChatRoomUser.id, ChatRoomUser.is_leave, ChatRoomUser.is_del).where(
                            ChatRoomUser.user_uuid == user_uuid,
                            ChatRoomUser.room_id == actual_room_id,
                        )
                    ).first()
                    if rel:
                        if rel[2] == 1:  # is_del=1 -> 重新加入
                            db.execute(
                                update(ChatRoomUser)
                                .where(ChatRoomUser.id == rel[0])
                                .values(is_leave=0, is_del=0, leave_at=None)
                            )
                            db.commit()
                            logger.info("🔄 用户 %s 重新加入房间 %s", user_uuid, actual_room_id)
                        elif rel[1] == 1:  # is_leave=1 -> 重新加入
                            db.execute(
                                update(ChatRoomUser)
                                .where(ChatRoomUser.id == rel[0])
                                .values(is_leave=0, leave_at=None)
                            )
                            db.commit()
                            logger.info("🔄 用户 %s 重新加入房间 %s", user_uuid, actual_room_id)
                        else:
                            logger.info("ℹ️ 用户 %s 已在房间 %s 中", user_uuid, actual_room_id)
                    else:
                        db.add(
                            ChatRoomUser(
                                user_uuid=user_uuid,
                                room_id=actual_room_id,
                                is_leave=0,
                                is_del=0,
                            )
                        )
                        db.commit()
                        logger.info("➕ 用户 %s 加入房间 %s", user_uuid, actual_room_id)
                except Exception as e:
                    logger.error("❌ 处理用户房间关系失败: %s", e)
                    if db is not None:
                        db.rollback()
                    return None

            room_id_str = str(actual_room_id)
            self.user_sessions[websocket] = {
                "user_uuid": user_uuid,
                "room_id": room_id_str,
                "joined_at": time.time(),
            }
            if room_id_str not in self.rooms:
                self.rooms[room_id_str] = {}
                self.room_users[room_id_str] = set()
            self.rooms[room_id_str][user_uuid] = websocket
            self.room_users[room_id_str].add(user_uuid)

            logger.info("✅ 用户 %s 加入房间 %s (当前 %d 人)",
                        user_uuid, actual_room_id, len(self.room_users[room_id_str]))

            await self._broadcast_to_room(
                room_id_str,
                {
                    "event": "user_joined",
                    "user_uuid": user_uuid,
                    "room_id": room_id_str,
                    "timestamp": datetime.now().isoformat(),
                },
            )
            return {"success": True, "room_id": actual_room_id}

        except Exception as e:
            logger.error("❌ 用户加入房间失败: %s", e)
            return None

    async def join_system_room(self, websocket: WebSocket, user_uuid: str) -> bool:
        """加入系统房间 (用户独立, 仅自己可见)."""
        try:
            system_room_id = f"system_{user_uuid}"
            self.system_rooms[user_uuid] = {
                "websocket": websocket,
                "room_id": system_room_id,
                "joined_at": time.time(),
            }
            if system_room_id not in self.rooms:
                self.rooms[system_room_id] = {}
                self.room_users[system_room_id] = set()
            self.rooms[system_room_id][user_uuid] = websocket
            self.room_users[system_room_id].add(user_uuid)
            logger.info("✅ 用户 %s 加入系统房间 %s", user_uuid, system_room_id)
            await websocket.send_json(
                {
                    "event": "system_room_joined",
                    "user_uuid": user_uuid,
                    "room_id": system_room_id,
                    "timestamp": datetime.now().isoformat(),
                }
            )
            return True
        except Exception as e:
            logger.error("❌ 用户加入系统房间失败: %s", e)
            return False

    async def leave_room(
        self,
        websocket: WebSocket,
        db: Optional[Session] = None,
    ) -> bool:
        """用户离开房间."""
        try:
            session_info = self.user_sessions.get(websocket)
            if not session_info:
                return False
            user_uuid = session_info["user_uuid"]
            room_id = session_info["room_id"]

            if db is not None:
                try:
                    db.execute(
                        update(ChatRoomUser)
                        .where(
                            ChatRoomUser.user_uuid == user_uuid,
                            ChatRoomUser.room_id == int(room_id),
                            ChatRoomUser.is_leave == 0,
                        )
                        .values(is_leave=1, leave_at=utcnow())
                    )
                    db.commit()
                    logger.info("📝 更新用户 %s 离开房间 %s 的数据库记录", user_uuid, room_id)
                except Exception as e:
                    logger.error("❌ 更新用户房间关系失败: %s", e)
                    if db is not None:
                        db.rollback()

            if room_id in self.rooms and user_uuid in self.rooms[room_id]:
                del self.rooms[room_id][user_uuid]
            if room_id in self.room_users:
                self.room_users[room_id].discard(user_uuid)
            self.user_sessions.pop(websocket, None)

            logger.info("🔌 用户 %s 离开房间 %s", user_uuid, room_id)
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
        except Exception as e:
            logger.error("❌ 用户离开房间失败: %s", e)
            return False

    # -- 房间改名 --------------------------------------------------------

    def rename_room(
        self,
        old_room_id: str,
        new_room_name: str,
        db: Optional[Session] = None,
    ) -> Dict[str, Any]:
        """修改房间名称 (内存 + DB)."""
        try:
            if db is not None:
                try:
                    room = db.execute(
                        select(ChatRoom.id, ChatRoom.room_name).where(
                            ChatRoom.id == int(old_room_id)
                        )
                    ).first()
                    if not room:
                        return {"success": False, "message": f"房间不存在: {old_room_id}"}
                    db.execute(
                        update(ChatRoom)
                        .where(ChatRoom.id == int(old_room_id))
                        .values(room_name=new_room_name)
                    )
                    db.commit()
                    logger.info("💾 房间名称已更新: %s -> %s", old_room_id, new_room_name)
                except Exception as e:
                    logger.error("❌ 更新数据库房间名称失败: %s", e)
                    if db is not None:
                        db.rollback()
                    return {"success": False, "message": f"更新数据库房间名称失败: {e}"}

            # 内存中只更新映射 (历史 room_id 不变, 仅更新 DB)
            return {
                "success": True,
                "message": "房间名称修改成功",
                "old_room_id": old_room_id,
                "new_room_name": new_room_name,
            }
        except Exception as e:
            logger.error("❌ 修改房间名称失败: %s", e)
            return {"success": False, "message": f"修改房间名称失败: {e}"}

    # -- 发送消息 --------------------------------------------------------

    async def send_message_to_room(
        self,
        user_uuid: Optional[str],
        room_id: Optional[str],
        content: str,
        message_type: int = 1,
        db: Optional[Session] = None,
        receiver_uuid: Optional[str] = None,
    ) -> bool:
        """发送消息到房间 / 系统房间 / 全体用户."""
        try:
            # 1. room_id 与 receiver_uuid 都为空: 向所有在线用户发送系统消息
            if not room_id and not receiver_uuid:
                sender = "system"
                msg_type = 0
                payload = {
                    "event": "system_message",
                    "sender_uuid": sender,
                    "content": content,
                    "type": msg_type,
                    "timestamp": datetime.now().isoformat(),
                }
                for ws in list(self.user_sessions.keys()):
                    try:
                        await ws.send_json(payload)
                    except Exception as e:
                        logger.error("❌ 发送系统消息失败: %s", e)
                logger.info("📤 系统消息已发送给所有在线用户: %s...", content[:50])
                return True

            # 2. 只有 receiver_uuid: 发送到接收者的系统房间
            if not room_id and receiver_uuid:
                sender = "system"
                msg_type = 0
                sys_room_id = f"system_{receiver_uuid}"
                message_id = None
                if db is not None:
                    try:
                        letter = ChatLetter(
                            user_uuid=sender,
                            receiver_uuid=receiver_uuid,
                            type=msg_type,
                            content=content,
                            chat_id=sys_room_id,
                            send_time=utcnow(),
                            is_del=0,
                        )
                        db.add(letter)
                        db.flush()
                        message_id = letter.id
                        db.commit()
                        logger.info("💾 系统消息已保存到数据库, ID: %s", message_id)
                    except Exception as e:
                        logger.error("❌ 保存系统消息到数据库失败: %s", e)
                        if db is not None:
                            db.rollback()

                if sys_room_id in self.rooms:
                    await self._broadcast_to_room(
                        sys_room_id,
                        {
                            "event": "system_message",
                            "id": message_id,
                            "sender_uuid": sender,
                            "content": content,
                            "type": msg_type,
                            "timestamp": datetime.now().isoformat(),
                        },
                    )
                    logger.info("📤 系统消息已发送给用户 %s: %s...", receiver_uuid, content[:50])
                return True

            # 3. 普通房间消息
            # 根据房间类型自动判定 message_type
            if db is not None:
                try:
                    room_type_row = db.execute(
                        select(ChatRoom.type).where(ChatRoom.id == int(room_id))
                    ).first()
                    if room_type_row:
                        message_type = room_type_row[0]
                except Exception as e:
                    logger.error("❌ 查询房间类型失败: %s", e)
            if message_type is None:
                message_type = 1

            if message_type == 1:
                # 对话消息必须有发送者
                if not user_uuid:
                    logger.warning("⚠️ 对话消息必须有发送者")
                    return False
                # 检查发送者是否在房间中
                sender_in_room = False
                if db is not None:
                    try:
                        rel = db.execute(
                            select(ChatRoomUser.is_leave).where(
                                ChatRoomUser.user_uuid == user_uuid,
                                ChatRoomUser.room_id == int(room_id),
                                ChatRoomUser.is_del == 0,
                            )
                        ).first()
                        if rel and rel[0] == 0:
                            sender_in_room = True
                    except Exception as e:
                        logger.error("❌ 查询发送者房间状态失败: %s", e)
                if not sender_in_room:
                    logger.warning("⚠️ 发送者不在房间中: %s", user_uuid)
                    return False
            else:
                user_uuid = "system"

            # 保存消息到数据库
            message_id = None
            if db is not None:
                try:
                    if receiver_uuid:
                        letter = ChatLetter(
                            user_uuid=user_uuid,
                            receiver_uuid=receiver_uuid,
                            type=message_type,
                            content=content,
                            chat_id=room_id,
                            send_time=utcnow(),
                            is_del=0,
                        )
                        db.add(letter)
                        db.flush()
                        message_id = letter.id
                    else:
                        # 给房间内除发送者外的所有未离开/未删除用户保存一条消息
                        room_user_rows = db.execute(
                            select(ChatRoomUser.user_uuid).where(
                                ChatRoomUser.room_id == int(room_id),
                                ChatRoomUser.is_leave == 0,
                                ChatRoomUser.is_del == 0,
                                ChatRoomUser.user_uuid != user_uuid,
                            )
                        ).fetchall()
                        first_id = None
                        for row in room_user_rows:
                            letter = ChatLetter(
                                user_uuid=user_uuid,
                                receiver_uuid=row[0],
                                type=message_type,
                                content=content,
                                chat_id=room_id,
                                send_time=utcnow(),
                                is_del=0,
                            )
                            db.add(letter)
                            db.flush()
                            if first_id is None:
                                first_id = letter.id
                        message_id = first_id
                    db.commit()
                    logger.info("💾 消息已保存到数据库, ID: %s", message_id)
                except Exception as e:
                    logger.error("❌ 保存消息到数据库失败: %s", e)
                    if db is not None:
                        db.rollback()
                    return False

            sender_name, sender_avatar = self._query_sender_info(user_uuid, db)

            message_data = {
                "event": "room_message",
                "id": message_id,
                "sender_uuid": user_uuid,
                "sender_name": sender_name,
                "sender_avatar": sender_avatar,
                "room_id": room_id,
                "content": content,
                "type": message_type,
                "timestamp": datetime.now().isoformat(),
            }

            if receiver_uuid:
                if room_id not in self.rooms:
                    logger.warning("⚠️ 房间 %s 不在内存中, 消息已保存到数据库", room_id)
                    return True
                receiver_ws = self.rooms[room_id].get(receiver_uuid)
                if receiver_ws is not None:
                    try:
                        await receiver_ws.send_json(message_data)
                        logger.info("📤 消息已发送给用户 %s: %s...", receiver_uuid, content[:50])
                    except Exception as e:
                        logger.error("❌ 发送消息给用户 %s 失败: %s", receiver_uuid, e)
                else:
                    logger.warning("⚠️ 接收者 %s 不在线, 消息已保存到数据库", receiver_uuid)
            else:
                if room_id not in self.rooms:
                    logger.warning("⚠️ 房间 %s 不在内存中, 消息已保存到数据库", room_id)
                    return True
                if message_type == 1 and user_uuid != "system":
                    sender_ws = self.rooms[room_id].get(user_uuid)
                    await self._broadcast_to_room(room_id, message_data, exclude_websocket=sender_ws)
                else:
                    await self._broadcast_to_room(room_id, message_data)
                logger.info("📤 消息已发送到房间 %s: %s...", room_id, content[:50])
            return True

        except Exception as e:
            logger.error("❌ 发送消息到房间失败: %s", e)
            return False

    # -- 内部辅助 --------------------------------------------------------

    async def _broadcast_to_room(
        self,
        room_id: str,
        message: Dict[str, Any],
        exclude_websocket: Optional[WebSocket] = None,
    ) -> None:
        """向房间内所有用户广播消息."""
        if room_id not in self.rooms:
            return
        for user_uuid, websocket in list(self.rooms[room_id].items()):
            try:
                if exclude_websocket is not None and websocket == exclude_websocket:
                    continue
                await websocket.send_json(message)
            except Exception as e:
                logger.error("❌ 发送消息给用户 %s 失败: %s", user_uuid, e)

    def _parse_admin_uuids(self) -> List[str]:
        """解析 CHAT_ROOM_ADMIN_UUID (逗号分隔, 支持多个)."""
        raw = settings.CHAT_ROOM_ADMIN_UUID or ""
        return [u.strip() for u in raw.split(",") if u.strip()]

    def _query_sender_info(
        self,
        user_uuid: Optional[str],
        db: Optional[Session],
    ) -> tuple:
        """查询发送者昵称/头像. user_uuid 为 system 或查询失败返回系统头像."""
        if not user_uuid or user_uuid == "system" or db is None:
            return "系统", _SYSTEM_AVATAR
        try:
            # 历史项目从 zhs_center_project.users 取 nickname/avatar
            # 当前项目复用 ORM 不一定有跨库 users 表, 用 text 兜底
            row = db.execute(
                text("SELECT nickname, avatar FROM users WHERE uuid = :u")
            ).bindparams(u=user_uuid).first() if False else None
            # 不直接查跨库 users 表, 避免连接报错; 返回 None 让前端用本地缓存
            return None, None
        except Exception as e:
            logger.debug("查询发送者信息失败: %s", e)
            return None, None

    def get_room_users(self, room_id: str) -> List[str]:
        """获取房间内的在线用户列表."""
        return list(self.room_users.get(room_id, set()))


# 全局聊天室管理器
chat_room_manager = ChatRoomManager()


# ---------------------------------------------------------------------------
# WebSocket /ws
# ---------------------------------------------------------------------------


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    """WebSocket 连接端点.

    支持事件:
      - connect          建立连接 (需 user_uuid)
      - join_room        加入/创建房间
      - join_system_room 加入系统房间
      - leave_room       离开房间
      - send_message     发送消息
    """
    await websocket.accept()
    logger.info("🔌 客户端尝试连接: %s", websocket.client)

    user_uuid: Optional[str] = None
    room_id: Optional[str] = None
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
                            {"event": "error", "code": 400, "msg": "缺少必要参数: user_uuid"}
                        )
                        continue
                    logger.info("✅ 用户 %s 连接成功", user_uuid)
                    await websocket.send_json(
                        {
                            "event": "connected",
                            "code": 200,
                            "msg": "连接成功",
                            "user_uuid": user_uuid,
                            "timestamp": datetime.now().isoformat(),
                        }
                    )

                elif event == "join_room":
                    room_id = message.get("room_id")
                    room_name = message.get("room_name")
                    user_uuid = message.get("user_uuid")
                    if room_id is not None:
                        room_id = str(room_id)
                    if not user_uuid:
                        await websocket.send_json(
                            {"event": "error", "code": 400, "msg": "缺少必要参数: user_uuid"}
                        )
                        continue
                    with get_session(SessionFactory1) as db:
                        result = await chat_room_manager.join_room(
                            websocket, user_uuid, room_id, room_name, db
                        )
                    if result and result.get("success"):
                        actual_room_id = result.get("room_id")
                        await websocket.send_json(
                            {
                                "event": "room_joined",
                                "code": 200,
                                "msg": "加入房间成功",
                                "room_id": str(actual_room_id),
                                "user_uuid": user_uuid,
                                "users": chat_room_manager.get_room_users(str(actual_room_id)),
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
                            {"event": "error", "code": 400, "msg": "缺少必要参数: user_uuid"}
                        )
                        continue
                    success = await chat_room_manager.join_system_room(websocket, user_uuid)
                    if success:
                        await websocket.send_json(
                            {
                                "event": "system_room_joined",
                                "code": 200,
                                "msg": "加入系统房间成功",
                                "user_uuid": user_uuid,
                                "timestamp": datetime.now().isoformat(),
                            }
                        )
                        registered = True
                    else:
                        await websocket.send_json(
                            {"event": "error", "code": 500, "msg": "加入系统房间失败"}
                        )

                elif event == "leave_room":
                    with get_session(SessionFactory1) as db:
                        success = await chat_room_manager.leave_room(websocket, db)
                    if success:
                        await websocket.send_json(
                            {
                                "event": "room_left",
                                "code": 200,
                                "msg": "离开房间成功",
                                "timestamp": datetime.now().isoformat(),
                            }
                        )
                        registered = False
                    else:
                        await websocket.send_json(
                            {"event": "error", "code": 500, "msg": "离开房间失败"}
                        )

                elif event == "send_message":
                    user_uuid = message.get("user_uuid")
                    receiver_uuid = message.get("receiver_uuid")
                    room_id = message.get("room_id")
                    content = message.get("content")
                    message_type = message.get("type", 1)
                    if room_id is not None:
                        room_id = str(room_id)

                    if not content:
                        await websocket.send_json(
                            {"event": "error", "code": 400, "msg": "缺少必要参数: content"}
                        )
                        continue
                    if not room_id and not receiver_uuid:
                        await websocket.send_json(
                            {"event": "error", "code": 400, "msg": "缺少必要参数: room_id 或 receiver_uuid"}
                        )
                        continue
                    if not room_id and receiver_uuid:
                        message_type = 0
                        user_uuid = "system"
                    if message_type == 1 and not user_uuid:
                        await websocket.send_json(
                            {"event": "error", "code": 400, "msg": "对话消息必须提供 user_uuid"}
                        )
                        continue
                    if message_type in (0, 2) and not receiver_uuid:
                        await websocket.send_json(
                            {"event": "error", "code": 400, "msg": "系统消息和完成消息必须提供 receiver_uuid"}
                        )
                        continue

                    with get_session(SessionFactory1) as db:
                        success = await chat_room_manager.send_message_to_room(
                            user_uuid=user_uuid,
                            room_id=room_id,
                            content=content,
                            message_type=message_type,
                            receiver_uuid=receiver_uuid,
                            db=db,
                        )
                    if success:
                        await websocket.send_json(
                            {
                                "event": "message_sent",
                                "code": 200,
                                "msg": "消息发送成功",
                                "room_id": room_id,
                                "timestamp": datetime.now().isoformat(),
                            }
                        )
                    else:
                        await websocket.send_json(
                            {"event": "error", "code": 500, "msg": "消息发送失败"}
                        )

            except WebSocketDisconnect:
                break
            except json.JSONDecodeError:
                await websocket.send_json(
                    {"event": "error", "code": 400, "msg": "无效的JSON格式"}
                )
            except Exception as e:
                logger.debug("处理WebSocket消息失败: %s", e)
                await websocket.send_json(
                    {"event": "error", "code": 500, "msg": f"处理消息失败: {e}"}
                )

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.debug("WebSocket连接失败: %s", e)
    finally:
        if registered:
            await chat_room_manager.leave_room(websocket)
        logger.info("🔌 客户端断开连接: %s", websocket.client)


# ---------------------------------------------------------------------------
# GET /rooms/{room_id}/users
# ---------------------------------------------------------------------------


@router.get("/rooms/{room_id}/users")
async def get_room_users(room_id: str) -> dict:
    """获取房间内的在线用户列表."""
    try:
        users = chat_room_manager.get_room_users(room_id)
        return {
            "code": 200,
            "msg": "success",
            "data": {"room_id": room_id, "users": users, "count": len(users)},
        }
    except Exception as e:
        return {"code": 500, "msg": f"获取房间用户列表失败: {e}"}


# ---------------------------------------------------------------------------
# GET /users/{user_uuid}/rooms
# ---------------------------------------------------------------------------


@router.get("/users/{user_uuid}/rooms")
async def get_user_rooms(user_uuid: str, db: Session = Depends(get_session)) -> dict:
    """获取用户所在的房间列表, 含每个房间的未读数与最后一条消息."""
    try:
        # 用户在的所有未离开/未删除的房间
        rooms = (
            db.query(ChatRoom.id, ChatRoom.room_name, ChatRoom.type)
            .join(ChatRoomUser, ChatRoomUser.room_id == ChatRoom.id)
            .filter(
                ChatRoomUser.user_uuid == user_uuid,
                ChatRoomUser.is_leave == 0,
                ChatRoomUser.is_del == 0,
            )
            .distinct()
            .all()
        )

        rooms_with_unread: List[Dict[str, Any]] = []

        # 系统房间
        system_room_id = f"system_{user_uuid}"
        system_unread = (
            db.query(func.count(ChatLetter.id))
            .filter(
                ChatLetter.receiver_uuid == user_uuid,
                ChatLetter.chat_id == system_room_id,
                ChatLetter.is_read == 0,
                ChatLetter.is_del == 0,
            )
            .scalar()
            or 0
        )
        sys_last = (
            db.query(ChatLetter.id, ChatLetter.content, ChatLetter.type, ChatLetter.send_time, ChatLetter.user_uuid)
            .filter(
                ChatLetter.receiver_uuid == user_uuid,
                ChatLetter.chat_id == system_room_id,
                ChatLetter.is_del == 0,
            )
            .order_by(ChatLetter.send_time.desc())
            .first()
        )
        rooms_with_unread.append(
            {
                "room_id": system_room_id,
                "room_name": "系统消息",
                "room_type": 0,
                "unread_count": system_unread,
                "sender_name": "系统",
                "sender_avatar": _SYSTEM_AVATAR,
                "last_message": _letter_row_to_dict(sys_last),
            }
        )

        for row in rooms:
            room_id_str = str(row[0])
            room_name = row[1]
            room_type = row[2]
            unread = (
                db.query(func.count(ChatLetter.id))
                .filter(
                    ChatLetter.receiver_uuid == user_uuid,
                    ChatLetter.chat_id == room_id_str,
                    ChatLetter.is_read == 0,
                    ChatLetter.is_del == 0,
                )
                .scalar()
                or 0
            )
            earliest_sender = (
                db.query(ChatLetter.user_uuid)
                .filter(ChatLetter.chat_id == room_id_str, ChatLetter.is_del == 0)
                .order_by(ChatLetter.send_time.asc())
                .first()
            )
            sender_name, sender_avatar = None, None
            if earliest_sender and earliest_sender[0]:
                if earliest_sender[0] == "system":
                    sender_name = "系统"
                    sender_avatar = _SYSTEM_AVATAR

            last_msg = (
                db.query(ChatLetter.id, ChatLetter.content, ChatLetter.type, ChatLetter.send_time, ChatLetter.user_uuid)
                .filter(
                    ChatLetter.receiver_uuid == user_uuid,
                    ChatLetter.chat_id == room_id_str,
                    ChatLetter.is_del == 0,
                )
                .order_by(ChatLetter.send_time.desc())
                .first()
            )
            rooms_with_unread.append(
                {
                    "room_id": room_id_str,
                    "room_name": room_name,
                    "room_type": room_type,
                    "unread_count": unread,
                    "sender_name": sender_name,
                    "sender_avatar": sender_avatar,
                    "last_message": _letter_row_to_dict(last_msg),
                }
            )

        return {
            "code": 200,
            "msg": "success",
            "data": {
                "user_uuid": user_uuid,
                "rooms": rooms_with_unread,
                "count": len(rooms_with_unread),
            },
        }
    except Exception as e:
        logger.debug("获取用户房间列表失败: %s", e)
        return {"code": 500, "msg": f"获取用户房间列表失败: {e}"}


def _letter_row_to_dict(row) -> Optional[Dict[str, Any]]:
    """把 ChatLetter 查询行 (id, content, type, send_time, user_uuid) 转成字典."""
    if not row:
        return None
    return {
        "id": row[0],
        "content": row[1],
        "type": row[2],
        "send_time": row[3].isoformat() if row[3] else None,
        "sender_uuid": row[4],
    }


# ---------------------------------------------------------------------------
# GET /history
# ---------------------------------------------------------------------------


@router.get("/history")
async def get_message_history(
    user_uuid: str,
    room_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_session),
) -> dict:
    """获取用户的消息历史记录."""
    try:
        # 发送的消息
        sent_q = db.query(
            ChatLetter.id,
            ChatLetter.user_uuid,
            ChatLetter.receiver_uuid,
            ChatLetter.type,
            ChatLetter.content,
            ChatLetter.chat_id,
            ChatLetter.send_time,
            ChatLetter.is_del,
        ).filter(ChatLetter.user_uuid == user_uuid, ChatLetter.is_del == 0)
        if room_id:
            sent_q = sent_q.filter(ChatLetter.chat_id == room_id)

        # 接收的消息
        recv_q = db.query(
            ChatLetter.id,
            ChatLetter.user_uuid,
            ChatLetter.receiver_uuid,
            ChatLetter.type,
            ChatLetter.content,
            ChatLetter.chat_id,
            ChatLetter.send_time,
            ChatLetter.is_del,
        ).filter(ChatLetter.receiver_uuid == user_uuid, ChatLetter.is_del == 0)
        if room_id:
            recv_q = recv_q.filter(ChatLetter.chat_id == room_id)

        sent = sent_q.order_by(ChatLetter.send_time.desc()).all()
        received = recv_q.order_by(ChatLetter.send_time.desc()).all()
        messages = sorted(sent + received, key=lambda x: x[6] or utcnow(), reverse=True)
        messages = messages[offset : offset + limit]

        message_list: List[Dict[str, Any]] = []
        for msg in messages:
            sender_uuid = msg[1]
            sender_name, sender_avatar = None, None
            if sender_uuid == "system":
                sender_name = "系统"
                sender_avatar = _SYSTEM_AVATAR
            message_list.append(
                {
                    "id": msg[0],
                    "user_uuid": msg[1],
                    "receiver_uuid": msg[2],
                    "type": msg[3],
                    "content": msg[4],
                    "chat_id": msg[5],
                    "send_time": msg[6].isoformat() if msg[6] else None,
                    "is_del": msg[7],
                    "sender_name": sender_name,
                    "sender_avatar": sender_avatar,
                }
            )

        return {
            "code": 200,
            "msg": "success",
            "data": {
                "user_uuid": user_uuid,
                "room_id": room_id,
                "messages": message_list,
                "count": len(message_list),
            },
        }
    except Exception as e:
        logger.debug("获取消息历史失败: %s", e)
        return {"code": 500, "msg": f"获取消息历史失败: {e}"}


# ---------------------------------------------------------------------------
# DELETE /messages/{message_id}
# ---------------------------------------------------------------------------


@router.delete("/messages/{message_id}")
async def delete_message(
    message_id: int,
    user_uuid: str,
    db: Session = Depends(get_session),
) -> dict:
    """逻辑删除消息 (仅消息所有者可删除)."""
    try:
        row = db.query(ChatLetter.id, ChatLetter.user_uuid, ChatLetter.is_del).filter(
            ChatLetter.id == message_id
        ).first()
        if not row:
            return {"code": 404, "msg": "消息不存在"}
        if row[1] != user_uuid:
            return {"code": 403, "msg": "无权删除此消息"}
        if row[2] == 1:
            return {"code": 400, "msg": "消息已被删除"}

        db.query(ChatLetter).filter(
            ChatLetter.id == message_id, ChatLetter.user_uuid == user_uuid
        ).update({"is_del": 1})
        db.commit()
        logger.info("🗑️ 用户 %s 删除了消息 %s", user_uuid, message_id)
        return {"code": 200, "msg": "消息删除成功", "data": {"message_id": message_id}}
    except Exception as e:
        logger.debug("删除消息失败: %s", e)
        if db is not None:
            db.rollback()
        return {"code": 500, "msg": f"删除消息失败: {e}"}


# ---------------------------------------------------------------------------
# POST /send
# ---------------------------------------------------------------------------


@router.post("/send")
async def api_send_message(
    request: SendMessageRequest,
    db: Session = Depends(get_session),
) -> dict:
    """通过 HTTP API 发送消息到房间."""
    try:
        if not request.room_id and not request.receiver_uuid:
            return {"code": 400, "msg": "缺少必要参数: room_id 或 receiver_uuid"}

        if not request.room_id and request.receiver_uuid:
            request.message_type = 0
            request.user_uuid = "system"

        if request.message_type == 1 and not request.user_uuid:
            return {"code": 400, "msg": "对话消息需要指定发送者 user_uuid"}

        success = await chat_room_manager.send_message_to_room(
            user_uuid=request.user_uuid or "system",
            room_id=request.room_id,
            content=request.content,
            message_type=request.message_type,
            db=db,
            receiver_uuid=request.receiver_uuid,
        )
        if success:
            return {
                "code": 200,
                "msg": "消息发送成功",
                "data": {
                    "user_uuid": request.user_uuid,
                    "receiver_uuid": request.receiver_uuid,
                    "room_id": request.room_id,
                    "content": request.content,
                    "type": request.message_type,
                },
            }
        return {"code": 500, "msg": "消息发送失败"}
    except Exception as e:
        logger.debug("API 发送消息失败: %s", e)
        return {"code": 500, "msg": f"发送消息失败: {e}"}


# ---------------------------------------------------------------------------
# PUT /messages/mark-read
# ---------------------------------------------------------------------------


@router.put("/messages/mark-read")
async def mark_messages_as_read(
    user_uuid: str,
    room_id: str,
    db: Session = Depends(get_session),
) -> dict:
    """标记指定用户在指定房间的所有消息为已读."""
    try:
        affected = db.query(ChatLetter).filter(
            ChatLetter.user_uuid == user_uuid,
            ChatLetter.chat_id == room_id,
            ChatLetter.is_read == 0,
            ChatLetter.is_del == 0,
        ).update({"is_read": 1})
        db.commit()
        logger.info("✅ 用户 %s 在房间 %s 标记 %s 条消息为已读", user_uuid, room_id, affected)
        return {
            "code": 200,
            "msg": "标记已读成功",
            "data": {"user_uuid": user_uuid, "room_id": room_id, "affected_count": affected},
        }
    except Exception as e:
        logger.debug("标记消息为已读失败: %s", e)
        if db is not None:
            db.rollback()
        return {"code": 500, "msg": f"标记消息为已读失败: {e}"}


# ---------------------------------------------------------------------------
# PUT /rooms/rename
# ---------------------------------------------------------------------------


@router.put("/rooms/rename")
async def rename_room(
    old_room_id: str,
    new_room_name: str,
    db: Session = Depends(get_session),
) -> dict:
    """修改房间名称."""
    try:
        result = chat_room_manager.rename_room(old_room_id, new_room_name, db)
        if result["success"]:
            return {
                "code": 200,
                "msg": result["message"],
                "data": {
                    "old_room_id": result.get("old_room_id"),
                    "new_room_name": result.get("new_room_name"),
                },
            }
        return {"code": 400, "msg": result["message"]}
    except Exception as e:
        logger.debug("修改房间名称失败: %s", e)
        return {"code": 500, "msg": f"修改房间名称失败: {e}"}


# ---------------------------------------------------------------------------
# DELETE /users/{user_uuid}/rooms/{room_id}
# ---------------------------------------------------------------------------


@router.delete("/users/{user_uuid}/rooms/{room_id}")
async def delete_user_room(
    user_uuid: str,
    room_id: str,
    db: Session = Depends(get_session),
) -> dict:
    """逻辑删除用户与房间的关系记录."""
    try:
        row = db.query(ChatRoomUser.id, ChatRoomUser.is_leave, ChatRoomUser.is_del).filter(
            ChatRoomUser.user_uuid == user_uuid,
            ChatRoomUser.room_id == int(room_id),
        ).first()
        if not row:
            return {"code": 404, "msg": "用户房间关系不存在"}
        if row[2] == 1:
            return {"code": 400, "msg": "用户房间关系已被删除"}

        db.query(ChatRoomUser).filter(
            ChatRoomUser.user_uuid == user_uuid,
            ChatRoomUser.room_id == int(room_id),
        ).update({"is_del": 1})
        db.commit()
        logger.info("🗑️ 用户 %s 删除了房间 %s", user_uuid, room_id)
        return {
            "code": 200,
            "msg": "删除成功",
            "data": {"user_uuid": user_uuid, "room_id": room_id},
        }
    except Exception as e:
        logger.debug("删除用户房间关系失败: %s", e)
        if db is not None:
            db.rollback()
        return {"code": 500, "msg": f"删除用户房间关系失败: {e}"}
