"""多人聊天室 WS 端点 + HTTP API - 房间维度 + 成员列表 + 数据库持久化.

迁移自 coze_zhs_py/api/chat_room_socket.py.
持久化表: zhs_station_room / zhs_station_user / zhs_station_letter.
"""

import asyncio
import json
import time
import uuid
from datetime import datetime

from fastapi import APIRouter, Body, Query, WebSocket, WebSocketDisconnect
from loguru import logger

from app.config import settings
from app.database import get_session
from app.models.chat_room_models import ChatLetter, ChatRoom, ChatRoomUser
from app.schemas.common import error, success
from app.ws.auth_decorator import ws_require_auth
from app.ws.manager import connection_manager

router = APIRouter()

SYSTEM_AVATAR = "https://file.aizhs.top/sys-mini/default/logo/guanlogo.png"
SYSTEM_NAME = "系统"


# ---------------------------------------------------------------------------
# 辅助函数
# ---------------------------------------------------------------------------


def _get_user_info(user_uuid: str) -> dict:
    """查询用户昵称和头像."""
    if not user_uuid or user_uuid == "system":
        return {"nickname": SYSTEM_NAME, "avatar": SYSTEM_AVATAR}
    try:
        from app.models.user_models import User

        with get_session() as db:
            user = db.query(User).filter(User.uuid == user_uuid).first()
            if user:
                return {
                    "nickname": user.nickname or user_uuid[:8],
                    "avatar": user.avatar or "",
                }
    except Exception as e:
        logger.warning(f"get_user_info error: {e}")
    return {"nickname": user_uuid[:8], "avatar": ""}


def _ensure_room_user(user_uuid: str, room_id: int) -> bool:
    """确保用户在房间中（处理重新加入逻辑）."""
    try:
        with get_session() as db:
            existing = (
                db.query(ChatRoomUser)
                .filter(
                    ChatRoomUser.user_uuid == user_uuid,
                    ChatRoomUser.room_id == room_id,
                )
                .first()
            )
            if existing:
                if existing.is_del == 1:
                    existing.is_leave = 0
                    existing.is_del = 0
                    existing.created_at = datetime.utcnow()
                    existing.leave_at = None
                elif existing.is_leave == 1:
                    existing.is_leave = 0
                    existing.created_at = datetime.utcnow()
                    existing.leave_at = None
            else:
                db.add(
                    ChatRoomUser(
                        user_uuid=user_uuid,
                        room_id=room_id,
                        is_leave=0,
                        is_del=0,
                    )
                )
        return True
    except Exception as e:
        logger.error(f"ensure_room_user error: {e}")
        return False


def _create_room(
    user_uuid: str,
    room_name: str | None = None,
    receiver_uuid: str | None = None,
) -> int | None:
    """创建新房间，自动加入系统管理员、接收人和创建者."""
    if not room_name:
        room_name = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    try:
        with get_session() as db:
            room = ChatRoom(room_name=room_name, type=1)
            db.add(room)
            db.flush()
            room_id = room.id

            admin_uuids_raw = settings.CHAT_ROOM_ADMIN_UUID or ""
            admin_uuids = [u.strip() for u in admin_uuids_raw.split(",") if u.strip()]
            for admin_uuid in admin_uuids:
                db.add(
                    ChatRoomUser(
                        user_uuid=admin_uuid,
                        room_id=room_id,
                        is_leave=0,
                        is_del=0,
                    )
                )
            if receiver_uuid:
                db.add(
                    ChatRoomUser(
                        user_uuid=receiver_uuid,
                        room_id=room_id,
                        is_leave=0,
                        is_del=0,
                    )
                )
            db.add(
                ChatRoomUser(
                    user_uuid=user_uuid,
                    room_id=room_id,
                    is_leave=0,
                    is_del=0,
                )
            )
        logger.info(f"create_room: id={room_id} name={room_name} admin={admin_uuids} receiver={receiver_uuid}")
        return room_id
    except Exception as e:
        logger.error(f"create_room error: {e}")
        return None


def _save_message(
    sender_uuid: str,
    receiver_uuid: str | None,
    room_id: str,
    content: str,
    message_type: int = 1,
) -> list[int]:
    """保存消息到数据库，返回消息ID列表.

    指定 receiver_uuid 时只保存一条；否则为房间内所有其他用户各保存一条。
    """
    msg_ids: list[int] = []
    try:
        with get_session() as db:
            if receiver_uuid:
                msg = ChatLetter(
                    user_uuid=sender_uuid,
                    receiver_uuid=receiver_uuid,
                    type=message_type,
                    content=content,
                    chat_id=str(room_id),
                    send_time=datetime.utcnow(),
                    is_del=0,
                    is_read=0,
                )
                db.add(msg)
                db.flush()
                msg_ids.append(msg.id)
            else:
                room_id_int = int(room_id) if str(room_id).isdigit() else 0
                if room_id_int:
                    users = (
                        db.query(ChatRoomUser.user_uuid)
                        .filter(
                            ChatRoomUser.room_id == room_id_int,
                            ChatRoomUser.is_leave == 0,
                            ChatRoomUser.is_del == 0,
                            ChatRoomUser.user_uuid != sender_uuid,
                        )
                        .all()
                    )
                    for (ruuid,) in users:
                        msg = ChatLetter(
                            user_uuid=sender_uuid,
                            receiver_uuid=ruuid,
                            type=message_type,
                            content=content,
                            chat_id=str(room_id),
                            send_time=datetime.utcnow(),
                            is_del=0,
                            is_read=0,
                        )
                        db.add(msg)
                        db.flush()
                        msg_ids.append(msg.id)
                else:
                    msg = ChatLetter(
                        user_uuid=sender_uuid,
                        receiver_uuid="",
                        type=message_type,
                        content=content,
                        chat_id=str(room_id),
                        send_time=datetime.utcnow(),
                        is_del=0,
                        is_read=0,
                    )
                    db.add(msg)
                    db.flush()
                    msg_ids.append(msg.id)
    except Exception as e:
        logger.error(f"save_message error: {e}")
    return msg_ids


def _mark_user_leave(user_uuid: str, room_id: str) -> None:
    """标记用户离开房间 (is_leave=1)."""
    try:
        with get_session() as db:
            db.query(ChatRoomUser).filter(
                ChatRoomUser.user_uuid == user_uuid,
                ChatRoomUser.room_id == int(room_id),
                ChatRoomUser.is_leave == 0,
            ).update({"is_leave": 1, "leave_at": datetime.utcnow()})
    except Exception as e:
        logger.warning(f"mark leave error: {e}")


def _get_room_users_list(room_id: str) -> list[str]:
    """获取房间内用户 UUID 列表 (is_leave=0 且 is_del=0)."""
    try:
        with get_session() as db:
            if str(room_id).isdigit():
                users = (
                    db.query(ChatRoomUser.user_uuid)
                    .filter(
                        ChatRoomUser.room_id == int(room_id),
                        ChatRoomUser.is_leave == 0,
                        ChatRoomUser.is_del == 0,
                    )
                    .all()
                )
                return [u[0] for u in users]
    except Exception as e:
        logger.error(f"get_room_users_list error: {e}")
    return []


def _get_user_rooms_data(user_uuid: str) -> list[dict]:
    """查询用户所在的所有房间，包含未读消息数、最后一条消息、发送者信息."""
    rooms_data: list[dict] = []
    try:
        with get_session() as db:
            # 系统消息房间
            system_chat_id = f"system_{user_uuid}"
            sys_unread = (
                db.query(ChatLetter)
                .filter(
                    ChatLetter.receiver_uuid == user_uuid,
                    ChatLetter.chat_id == system_chat_id,
                    ChatLetter.is_read == 0,
                    ChatLetter.is_del == 0,
                )
                .count()
            )
            sys_last = (
                db.query(ChatLetter)
                .filter(
                    ChatLetter.receiver_uuid == user_uuid,
                    ChatLetter.chat_id == system_chat_id,
                    ChatLetter.is_del == 0,
                )
                .order_by(ChatLetter.send_time.desc())
                .first()
            )
            rooms_data.append(
                {
                    "room_id": system_chat_id,
                    "room_name": SYSTEM_NAME,
                    "room_type": 0,
                    "unread_count": sys_unread,
                    "sender_name": SYSTEM_NAME,
                    "sender_avatar": SYSTEM_AVATAR,
                    "last_message": {
                        "id": sys_last.id,
                        "content": sys_last.content,
                        "type": sys_last.type,
                        "send_time": sys_last.send_time.isoformat() if sys_last.send_time else None,
                        "sender_uuid": sys_last.user_uuid,
                    }
                    if sys_last
                    else None,
                }
            )

            # 普通房间
            user_rooms = (
                db.query(ChatRoomUser, ChatRoom)
                .join(ChatRoom, ChatRoomUser.room_id == ChatRoom.id)
                .filter(
                    ChatRoomUser.user_uuid == user_uuid,
                    ChatRoomUser.is_del == 0,
                )
                .all()
            )
            for ru, room in user_rooms:
                chat_id = str(room.id)
                unread = (
                    db.query(ChatLetter)
                    .filter(
                        ChatLetter.receiver_uuid == user_uuid,
                        ChatLetter.chat_id == chat_id,
                        ChatLetter.is_read == 0,
                        ChatLetter.is_del == 0,
                    )
                    .count()
                )
                last_msg = (
                    db.query(ChatLetter)
                    .filter(
                        ChatLetter.receiver_uuid == user_uuid,
                        ChatLetter.chat_id == chat_id,
                        ChatLetter.is_del == 0,
                    )
                    .order_by(ChatLetter.send_time.desc())
                    .first()
                )
                # 最早发送者
                first_sender = (
                    db.query(ChatLetter.user_uuid)
                    .filter(
                        ChatLetter.chat_id == chat_id,
                        ChatLetter.is_del == 0,
                    )
                    .order_by(ChatLetter.send_time.asc())
                    .first()
                )
                sender_info = _get_user_info(first_sender[0]) if first_sender else {"nickname": "", "avatar": ""}
                rooms_data.append(
                    {
                        "room_id": chat_id,
                        "room_name": room.room_name,
                        "room_type": room.type,
                        "unread_count": unread,
                        "sender_name": sender_info["nickname"],
                        "sender_avatar": sender_info["avatar"],
                        "last_message": {
                            "id": last_msg.id,
                            "content": last_msg.content,
                            "type": last_msg.type,
                            "send_time": last_msg.send_time.isoformat() if last_msg.send_time else None,
                            "sender_uuid": last_msg.user_uuid,
                        }
                        if last_msg
                        else None,
                    }
                )
    except Exception as e:
        logger.error(f"get_user_rooms_data error: {e}")
    return rooms_data


def _get_message_history_data(
    user_uuid: str,
    room_id: str | None,
    limit: int,
    offset: int,
) -> tuple[list[dict], int]:
    """查询用户消息历史，返回 (msg_list, total)."""
    msg_list: list[dict] = []
    total = 0
    try:
        with get_session() as db:
            q = db.query(ChatLetter).filter(
                ChatLetter.is_del == 0,
                (ChatLetter.user_uuid == user_uuid) | (ChatLetter.receiver_uuid == user_uuid),
            )
            if room_id:
                q = q.filter(ChatLetter.chat_id == room_id)
            total = q.count()
            messages = (
                q.order_by(ChatLetter.send_time.desc())
                .offset(offset)
                .limit(limit)
                .all()
            )
            for m in messages:
                info = _get_user_info(m.user_uuid)
                msg_list.append(
                    {
                        "id": m.id,
                        "user_uuid": m.user_uuid,
                        "receiver_uuid": m.receiver_uuid,
                        "type": m.type,
                        "content": m.content,
                        "chat_id": m.chat_id,
                        "send_time": m.send_time.isoformat() if m.send_time else None,
                        "is_del": m.is_del,
                        "sender_name": info["nickname"],
                        "sender_avatar": info["avatar"],
                    }
                )
    except Exception as e:
        logger.error(f"get_message_history_data error: {e}")
    return msg_list, total


def _delete_message_by_id(message_id: int, user_uuid: str) -> tuple[bool, str, str]:
    """逻辑删除消息，返回 (success, error_msg, error_code)."""
    try:
        with get_session() as db:
            msg = db.query(ChatLetter).filter(ChatLetter.id == message_id).first()
            if not msg:
                return False, "消息不存在", "404"
            if msg.user_uuid != user_uuid and msg.receiver_uuid != user_uuid:
                return False, "无权删除此消息", "403"
            if msg.is_del == 1:
                return False, "消息已被删除", "400"
            msg.is_del = 1
        return True, "", ""
    except Exception as e:
        logger.error(f"delete_message_by_id error: {e}")
        return False, str(e), "500"


def _mark_messages_read(user_uuid: str, room_id: str) -> int:
    """标记指定用户在指定房间的所有未读消息为已读，返回 affected 行数."""
    try:
        with get_session() as db:
            return (
                db.query(ChatLetter)
                .filter(
                    ChatLetter.receiver_uuid == user_uuid,
                    ChatLetter.chat_id == room_id,
                    ChatLetter.is_read == 0,
                    ChatLetter.is_del == 0,
                )
                .update({"is_read": 1})
            )
    except Exception as e:
        logger.error(f"mark_messages_read error: {e}")
        return 0


def _rename_room(old_room_id: str, new_room_name: str) -> tuple[bool, str, str]:
    """修改房间名称，返回 (success, error_msg, error_code)."""
    try:
        with get_session() as db:
            if not str(old_room_id).isdigit():
                return False, "房间ID必须为数字", "400"
            room = db.query(ChatRoom).filter(ChatRoom.id == int(old_room_id)).first()
            if not room:
                return False, "房间不存在", "404"
            room.room_name = new_room_name
        return True, "", ""
    except Exception as e:
        logger.error(f"rename_room error: {e}")
        return False, str(e), "500"


def _leave_room(user_uuid: str, room_id: str) -> tuple[bool, str, str]:
    """逻辑删除用户与房间的关联记录，返回 (success, error_msg, error_code)."""
    try:
        with get_session() as db:
            if not str(room_id).isdigit():
                return False, "房间ID必须为数字", "400"
            ru = (
                db.query(ChatRoomUser)
                .filter(
                    ChatRoomUser.user_uuid == user_uuid,
                    ChatRoomUser.room_id == int(room_id),
                )
                .first()
            )
            if not ru:
                return False, "用户房间关系不存在", "404"
            if ru.is_del == 1:
                return False, "已被删除", "400"
            ru.is_del = 1
            ru.is_leave = 1
            ru.leave_at = datetime.utcnow()
        return True, "", ""
    except Exception as e:
        logger.error(f"leave_room error: {e}")
        return False, str(e), "500"


# ---------------------------------------------------------------------------
# WebSocket 端点
# ---------------------------------------------------------------------------


@router.websocket("/ws/room/{room_id}")
@ws_require_auth
async def chat_room(
    ws: WebSocket,
    room_id: str,
    user_uuid: str = Query(""),
    nickname: str = Query(""),
    token_exp: float = 0,
):
    """进入指定房间，支持实时成员列表、消息广播、数据库持久化."""
    conn_id = f"{room_id}_{user_uuid}_{uuid.uuid4().hex[:6]}"
    await connection_manager.connect(
        conn_id, ws, user_uuid=user_uuid, room_id=room_id, token_exp=token_exp
    )
    nick = nickname or user_uuid[:8]

    if str(room_id).isdigit():
        await asyncio.to_thread(_ensure_room_user, user_uuid, int(room_id))

    try:
        await connection_manager.broadcast_room(
            room_id,
            {
                "type": "room",
                "event": "member_join",
                "user": user_uuid,
                "nickname": nick,
                "ts": time.time(),
            },
            exclude=conn_id,
        )
        await connection_manager.send_to(
            conn_id,
            {"type": "room", "event": "joined", "room": room_id, "you": user_uuid},
        )
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue
            mtype = msg.get("type", "text")
            if mtype == "text":
                text_content = msg.get("text", "")
                receiver = msg.get("receiver_uuid") or None
                await asyncio.to_thread(_save_message, user_uuid, receiver, room_id, text_content, message_type=1)
                await connection_manager.broadcast_room(
                    room_id,
                    {
                        "type": "text",
                        "from": user_uuid,
                        "nickname": nick,
                        "text": text_content,
                        "ts": time.time(),
                    },
                )
            elif mtype == "typing":
                await connection_manager.broadcast_room(
                    room_id,
                    {"type": "typing", "user": user_uuid, "nickname": nick},
                    exclude=conn_id,
                )
    except WebSocketDisconnect:
        pass
    finally:
        if str(room_id).isdigit():
            await asyncio.to_thread(_mark_user_leave, user_uuid, room_id)
        await connection_manager.broadcast_room(
            room_id,
            {
                "type": "room",
                "event": "member_leave",
                "user": user_uuid,
                "nickname": nick,
            },
        )
        await connection_manager.disconnect(conn_id)


# ---------------------------------------------------------------------------
# HTTP API 端点
# ---------------------------------------------------------------------------


@router.get("/api/v1/chat-room/rooms/{room_id}/users", summary="获取房间用户列表")
async def get_room_users(room_id: str):
    """获取指定房间内的用户列表（数据库中 is_leave=0 且 is_del=0 的用户）."""
    try:
        user_list = await asyncio.to_thread(_get_room_users_list, room_id)
        return success(
            {
                "room_id": room_id,
                "users": user_list,
                "count": len(user_list),
            }
        )
    except Exception as e:
        logger.error(f"get_room_users error: {e}")
        return error(str(e))


@router.get("/api/v1/chat-room/users/{user_uuid}/rooms", summary="获取用户房间列表(含未读数)")
async def get_user_rooms(user_uuid: str):
    """查询用户所在的所有房间，包含未读消息数、最后一条消息、发送者信息."""
    try:
        rooms_data = await asyncio.to_thread(_get_user_rooms_data, user_uuid)
        return success(
            {
                "user_uuid": user_uuid,
                "rooms": rooms_data,
                "count": len(rooms_data),
            }
        )
    except Exception as e:
        logger.error(f"get_user_rooms error: {e}")
        return error(str(e))


@router.get("/api/v1/chat-room/history", summary="获取消息历史")
async def get_message_history(
    user_uuid: str = Query(..., description="用户UUID"),
    room_id: str | None = Query(None, description="房间ID(可选)"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """查询用户发送和接收的所有消息历史，支持按房间过滤和分页."""
    try:
        msg_list, total = await asyncio.to_thread(
            _get_message_history_data, user_uuid, room_id, limit, offset
        )
        return success(
            {
                "user_uuid": user_uuid,
                "room_id": room_id,
                "messages": msg_list,
                "count": len(msg_list),
            },
            total=total,
        )
    except Exception as e:
        logger.error(f"get_message_history error: {e}")
        return error(str(e))


@router.delete("/api/v1/chat-room/messages/{message_id}", summary="删除消息(逻辑删除)")
async def delete_message(message_id: int, user_uuid: str = Query(...)):
    """逻辑删除指定消息（is_del=1），需校验消息所有者."""
    try:
        ok, err_msg, err_code = await asyncio.to_thread(
            _delete_message_by_id, message_id, user_uuid
        )
        if not ok:
            return error(err_msg, err_code)
        return success({"message_id": message_id}, msg="消息删除成功")
    except Exception as e:
        logger.error(f"delete_message error: {e}")
        return error(str(e))


@router.post("/api/v1/chat-room/send", summary="HTTP发送消息")
async def send_message(payload: dict = Body(...)):
    """HTTP 方式发送消息，支持系统消息和对话消息.

    请求体:
        user_uuid: 发送者UUID(message_type=1时必填)
        receiver_uuid: 接收者UUID(可选)
        room_id: 房间ID(可选)
        content: 消息内容(必填)
        message_type: 消息类型(0系统 1对话 2完成, 默认1)
    """
    user_uuid = payload.get("user_uuid") or "system"
    receiver_uuid = payload.get("receiver_uuid") or None
    room_id = payload.get("room_id") or None
    content = payload.get("content") or ""
    message_type = payload.get("message_type", 1)

    if not content:
        return error("消息内容不能为空", "400")
    if message_type == 1 and not user_uuid:
        return error("对话消息必须提供 user_uuid", "400")

    # 确定聊天ID
    chat_id = str(room_id) if room_id else (f"system_{receiver_uuid}" if receiver_uuid else "")

    if not chat_id:
        return error("必须提供 room_id 或 receiver_uuid", "400")

    # 系统消息强制 user_uuid = system
    if message_type != 1:
        user_uuid = "system"

    msg_ids = await asyncio.to_thread(
        _save_message, user_uuid, receiver_uuid, chat_id, content, message_type
    )
    if not msg_ids:
        return error("消息保存失败", "500")

    # WebSocket 推送
    sender_info = await asyncio.to_thread(_get_user_info, user_uuid)
    push_data = {
        "type": "room_message",
        "id": msg_ids[0],
        "sender_uuid": user_uuid,
        "sender_name": sender_info["nickname"],
        "sender_avatar": sender_info["avatar"],
        "room_id": chat_id,
        "content": content,
        "msg_type": message_type,
        "ts": time.time(),
    }
    if receiver_uuid:
        await connection_manager.send_to_user(receiver_uuid, push_data)
    else:
        await connection_manager.broadcast_room(chat_id, push_data)

    return success(
        {
            "user_uuid": user_uuid,
            "receiver_uuid": receiver_uuid or "",
            "room_id": chat_id,
            "content": content,
            "type": message_type,
            "message_ids": msg_ids,
        },
        msg="消息发送成功",
    )


@router.put("/api/v1/chat-room/messages/mark-read", summary="标记消息已读")
async def mark_messages_as_read(
    user_uuid: str = Query(..., description="用户UUID(接收者)"),
    room_id: str = Query(..., description="房间ID"),
):
    """标记指定用户在指定房间的所有未读消息为已读.

    修复历史项目 bug: 使用 receiver_uuid(而非 user_uuid)过滤，与未读统计逻辑一致。
    """
    try:
        affected = await asyncio.to_thread(_mark_messages_read, user_uuid, room_id)
        return success(
            {
                "user_uuid": user_uuid,
                "room_id": room_id,
                "affected_count": affected,
            },
            msg="标记已读成功",
        )
    except Exception as e:
        logger.error(f"mark_messages_as_read error: {e}")
        return error(str(e))


@router.put("/api/v1/chat-room/rooms/rename", summary="修改房间名称")
async def rename_room(
    old_room_id: str = Query(..., description="房间ID"),
    new_room_name: str = Query(..., description="新房间名称"),
):
    """修改房间名称（更新数据库 zhs_station_room.room_name）."""
    try:
        ok, err_msg, err_code = await asyncio.to_thread(
            _rename_room, old_room_id, new_room_name
        )
        if not ok:
            return error(err_msg, err_code)
        return success(
            {
                "room_id": old_room_id,
                "room_name": new_room_name,
            },
            msg="房间名称修改成功",
        )
    except Exception as e:
        logger.error(f"rename_room error: {e}")
        return error(str(e))


@router.delete(
    "/api/v1/chat-room/users/{user_uuid}/rooms/{room_id}",
    summary="退出房间(逻辑删除)",
)
async def leave_room(user_uuid: str, room_id: str):
    """逻辑删除用户与房间的关联记录（is_del=1）."""
    try:
        ok, err_msg, err_code = await asyncio.to_thread(
            _leave_room, user_uuid, room_id
        )
        if not ok:
            return error(err_msg, err_code)
        return success(
            {"user_uuid": user_uuid, "room_id": room_id},
            msg="删除成功",
        )
    except Exception as e:
        logger.error(f"leave_room error: {e}")
        return error(str(e))


@router.post("/api/v1/chat-room/rooms", summary="创建房间")
async def create_room_api(payload: dict = Body(...)):
    """创建新房间.

    请求体:
        user_uuid: 创建者UUID(必填)
        room_name: 房间名称(可选, 默认时间戳)
        receiver_uuid: 接收者UUID(可选, 自动加入)
    """
    user_uuid = payload.get("user_uuid") or ""
    room_name = payload.get("room_name") or None
    receiver_uuid = payload.get("receiver_uuid") or None

    if not user_uuid:
        return error("user_uuid 不能为空", "400")

    room_id = await asyncio.to_thread(_create_room, user_uuid, room_name, receiver_uuid)
    if not room_id:
        return error("创建房间失败", "500")

    return success({"room_id": room_id, "room_name": room_name or ""}, msg="房间创建成功")
