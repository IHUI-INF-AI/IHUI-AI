"""Socket.IO 事件处理器(兼容历史 coze_zhs_py 客户端)。

事件契约:
- connect:        握手时从 query string / auth 字段提取 token 鉴权
- disconnect:     清理 sid → user / room 映射
- join_room:      加入 chat_id 房间(同一 chat 多端订阅)
- leave_room:     离开房间
- chat_message:   客户端发送消息,服务端流式返回 AI 响应
                  → chat_stream_chunk(逐 token)
                  → chat_stream_done(完成,带 usage/metadata)
                  → chat_error(异常)

鉴权策略(优先本地,失败 fallback httpx 调 apps/api /auth/me):
1. JWT_SECRET 配置时:本地 HS256 验签(与 apps/api 共享密钥)
2. 本地验签失败或未配置 JWT_SECRET:回退 httpx 调 apps/api /auth/me
   (apps/api 不存在 /api/auth/validate 端点,改用既有 /auth/me)
"""
from __future__ import annotations

import logging
from typing import Any
from urllib.parse import parse_qs

import httpx
import jwt

from ..core.config import settings
from ..core.llm_gateway import llm_gateway
from ..services.memory import memory_store
from . import sio

logger = logging.getLogger(__name__)

# sid → user info 映射(connect 时建立,disconnect 时清理)
_sessions: dict[str, dict[str, Any]] = {}


# =============================================================================
# 鉴权辅助
# =============================================================================


def _extract_token(auth: Any, query: str) -> str | None:
    """从 Socket.IO auth 字段或 query string 提取 Bearer token。

    支持两种格式(与前端 socket.io-client 一致):
    - new client: io({auth: {token: "xxx"}}) → auth = {"token": "xxx"}
    - legacy client: io("?token=xxx") → query = "token=xxx"
    - 兼容: auth = {Authorization: "Bearer xxx"} / query = "authorization=Bearer+xxx"
    """
    if auth and isinstance(auth, dict):
        for key in ("token", "Token", "access_token", "accessToken"):
            v = auth.get(key)
            if isinstance(v, str) and v:
                return v.removeprefix("Bearer ").strip()
        authz = auth.get("Authorization") or auth.get("authorization")
        if isinstance(authz, str) and authz:
            return authz.removeprefix("Bearer ").strip()

    if query:
        parsed = parse_qs(query)
        for key in ("token", "access_token", "accessToken"):
            vals = parsed.get(key)
            if vals and vals[0]:
                return vals[0].removeprefix("Bearer ").strip()
        authz_vals = parsed.get("authorization") or parsed.get("Authorization")
        if authz_vals and authz_vals[0]:
            return authz_vals[0].removeprefix("Bearer ").strip()

    return None


async def _verify_token(token: str) -> dict[str, Any] | None:
    """验证 JWT,返回 payload 或 None。

    优先本地验签(共享 JWT_SECRET),失败或未配置时 fallback httpx 调 apps/api /auth/me。
    payload 结构(与 apps/api JWTAuthMiddleware 一致): {userId, roleId, type, ...}
    """
    if settings.jwt_secret:
        try:
            payload = jwt.decode(
                token,
                settings.jwt_secret,
                algorithms=["HS256"],
                issuer=settings.jwt_issuer,
                options={"verify_aud": False},
            )
            if payload.get("type") and payload["type"] != "access":
                return None
            return payload
        except jwt.ExpiredSignatureError:
            logger.debug("[sio] JWT expired")
            return None
        except jwt.InvalidTokenError as e:
            logger.debug("[sio] JWT invalid locally, try apps/api fallback: %s", e)
            # 落到下面 httpx fallback(可能是不同 issuer 签发,但仍想放给 apps/api 复核)

    # Fallback: 调 apps/api /auth/me(只透传 Bearer token,信任 apps/api 验签结果)
    # 注意:apps/api 未暴露 /api/auth/validate 端点,改用既有 /auth/me
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{settings.api_service_url}/api/auth/me",
                headers={"Authorization": f"Bearer {token}"},
            )
        if resp.status_code != 200:
            return None
        body = resp.json()
        data = body.get("data") or body  # 兼容 {code,message,data} 与裸对象
        user = data.get("user") if isinstance(data, dict) else None
        if not user:
            return None
        # 映射成与本地 JWT payload 一致的形态
        return {
            "userId": str(user.get("id") or user.get("userId") or ""),
            "roleId": user.get("roleId") or 0,
            "type": "access",
        }
    except Exception as e:
        logger.warning("[sio] apps/api /auth/me fallback failed: %s", e)
        return None


# =============================================================================
# 事件处理器
# =============================================================================


@sio.event
async def connect(sid: str, environ: dict[str, Any], auth: Any = None) -> bool:
    """握手鉴权:从 query/auth 提取 token,失败拒绝连接。"""
    query = environ.get("QUERY_STRING", "") if isinstance(environ, dict) else ""
    token = _extract_token(auth, query)
    if not token:
        logger.info("[sio] connect refused: no token (sid=%s)", sid)
        return False  # 返回 False 拒绝连接

    payload = await _verify_token(token)
    if payload is None:
        logger.info("[sio] connect refused: invalid token (sid=%s)", sid)
        return False

    user_id = str(payload.get("userId") or "")
    if not user_id:
        logger.info("[sio] connect refused: payload missing userId (sid=%s)", sid)
        return False

    _sessions[sid] = {
        "user_id": user_id,
        "role_id": payload.get("roleId") or 0,
        "rooms": set(),
    }
    logger.info(
        "[sio] connected sid=%s user=%s role=%s",
        sid, user_id, payload.get("roleId", 0),
    )
    return True


@sio.event
async def disconnect(sid: str) -> None:
    """清理会话资源。"""
    session = _sessions.pop(sid, None)
    if not session:
        return
    logger.info(
        "[sio] disconnected sid=%s user=%s",
        sid, session.get("user_id"),
    )


@sio.on("join_room")
async def on_join_room(sid: str, data: Any) -> None:
    """加入 chat_id 房间(同一 chat 多端订阅广播用)。

    data 格式: {"chat_id": "xxx"} 或纯字符串 chat_id。
    """
    chat_id = _extract_chat_id(data)
    if not chat_id:
        await sio.emit(
            "chat_error",
            {"message": "join_room 需要 chat_id 字段", "code": "invalid_payload"},
            to=sid,
        )
        return

    session = _sessions.get(sid)
    if not session:
        await sio.emit(
            "chat_error",
            {"message": "未鉴权会话,无法 join_room", "code": "unauthorized"},
            to=sid,
        )
        return

    # 房间名加 user 前缀,避免跨用户串台
    room = f"chat:{session['user_id']}:{chat_id}"
    await sio.enter_room(sid, room)
    session["rooms"].add(room)
    await sio.emit(
        "join_room_ack",
        {"chat_id": chat_id, "room": room, "ok": True},
        to=sid,
    )
    logger.debug("[sio] sid=%s joined room=%s", sid, room)


@sio.on("leave_room")
async def on_leave_room(sid: str, data: Any) -> None:
    """离开房间。"""
    chat_id = _extract_chat_id(data)
    session = _sessions.get(sid)
    if not session or not chat_id:
        return

    room = f"chat:{session['user_id']}:{chat_id}"
    await sio.leave_room(sid, room)
    session["rooms"].discard(room)
    await sio.emit(
        "leave_room_ack",
        {"chat_id": chat_id, "room": room, "ok": True},
        to=sid,
    )


@sio.on("chat_message")
async def on_chat_message(sid: str, data: Any) -> None:
    """客户端发送消息,服务端流式返回 AI 响应。

    data 格式:
        {
            "message": "用户输入",
            "chat_id": "xxx",         # 必填,用于房间 + session 隔离
            "session_id": "xxx",      # 可选,空则用 chat_id
            "model": "stepfun/...",   # 可选
            "history": [...],         # 可选,直接传入历史(覆盖 session 记忆)
        }
    """
    session = _sessions.get(sid)
    if not session:
        await sio.emit(
            "chat_error",
            {"message": "未鉴权会话,无法发送消息", "code": "unauthorized"},
            to=sid,
        )
        return

    if not isinstance(data, dict):
        await sio.emit(
            "chat_error",
            {"message": "chat_message 需 dict payload", "code": "invalid_payload"},
            to=sid,
        )
        return

    message = data.get("message")
    if not isinstance(message, str) or not message.strip():
        await sio.emit(
            "chat_error",
            {"message": "message 字段不能为空", "code": "invalid_payload"},
            to=sid,
        )
        return

    chat_id = str(data.get("chat_id") or "")
    if not chat_id:
        await sio.emit(
            "chat_error",
            {"message": "chat_id 字段不能为空", "code": "invalid_payload"},
            to=sid,
        )
        return

    session_id = str(data.get("session_id") or chat_id)
    model = data.get("model")
    owner_uuid = session.get("user_id")

    # 房间:同一 chat 多端订阅广播 chunk
    room = f"chat:{owner_uuid}:{chat_id}"

    # 构造消息:可选直接用客户端传入的 history(覆盖 session 记忆),
    # 否则从 memory_store 读历史 + 当前输入。
    history: list[dict[str, Any]] = []
    raw_history = data.get("history")
    if isinstance(raw_history, list):
        history = [
            m for m in raw_history
            if isinstance(m, dict) and m.get("role") and m.get("content") is not None
        ]
    else:
        try:
            stored = await memory_store.get(session_id)
            history = [
                {"role": m.get("role"), "content": m.get("content")}
                for m in stored
                if m.get("role") and m.get("content") is not None
            ]
        except Exception as e:
            logger.warning("[sio] read memory_store failed: %s", e)

    # 写入用户消息(失败不阻塞)
    try:
        await memory_store.add(session_id, "user", message)
    except Exception as e:
        logger.warning("[sio] append user message to memory_store failed: %s", e)

    history.append({"role": "user", "content": message})

    # 推流:复用 llm_gateway.astream(与 /api/llm/complete/stream 同源)
    accumulated_content = ""
    final_model = model or settings.litellm_model
    final_usage: dict[str, Any] = {}
    stub = False
    try:
        async for event in llm_gateway.astream(
            history, model=model, owner_uuid=owner_uuid
        ):
            etype = event.get("type")
            if etype == "chunk":
                chunk = event.get("content", "")
                accumulated_content += chunk
                await sio.emit(
                    "chat_stream_chunk",
                    {
                        "chat_id": chat_id,
                        "session_id": session_id,
                        "content": chunk,
                    },
                    room=room,
                )
            elif etype == "reasoning":
                # 推理链路(可选),单独事件,不并入 content
                await sio.emit(
                    "chat_stream_chunk",
                    {
                        "chat_id": chat_id,
                        "session_id": session_id,
                        "reasoning": event.get("content", ""),
                    },
                    room=room,
                )
            elif etype == "done":
                final_model = event.get("model") or final_model
                final_usage = event.get("usage") or {}
                stub = bool(event.get("stub", False))
            elif etype == "error":
                # 网关层错误:推 chat_error 并中止
                await sio.emit(
                    "chat_error",
                    {
                        "chat_id": chat_id,
                        "session_id": session_id,
                        "message": event.get("message", "LLM 调用失败"),
                        "code": "llm_error",
                    },
                    room=room,
                )
                return

        # 写入助手回复(失败不阻塞)
        if accumulated_content:
            try:
                await memory_store.add(session_id, "assistant", accumulated_content)
            except Exception as e:
                logger.warning("[sio] append assistant reply to memory_store failed: %s", e)

        await sio.emit(
            "chat_stream_done",
            {
                "chat_id": chat_id,
                "session_id": session_id,
                "content": accumulated_content,
                "model": final_model,
                "usage": final_usage,
                "stub": stub,
            },
            room=room,
        )
    except Exception as e:
        logger.exception("[sio] chat_message stream failed: %s", e)
        await sio.emit(
            "chat_error",
            {
                "chat_id": chat_id,
                "session_id": session_id,
                "message": f"流式响应异常: {e}",
                "code": "stream_exception",
            },
            room=room,
        )


# =============================================================================
# 辅助
# =============================================================================


def _extract_chat_id(data: Any) -> str | None:
    """从 join_room / leave_room payload 提取 chat_id。

    支持: {"chat_id": "xxx"} / {"room": "xxx"} / 纯字符串 "xxx"
    """
    if isinstance(data, str):
        return data.strip() or None
    if isinstance(data, dict):
        v = data.get("chat_id") or data.get("room")
        if isinstance(v, str) and v.strip():
            return v.strip()
    return None


def register_handlers(_sio: Any = None) -> None:
    """显式注册入口(供 app/main.py 启动时调用)。

    当前模块使用 @sio.event / @sio.on 装饰器,import 时即注册,
    本函数主要作为「显式触发点」暴露给 main.py 调用,方便后续扩展(如条件注册)。
    """
    # 装饰器在模块 import 时已注册事件,这里仅做一次完整性日志确认。
    logger.debug("[sio] handlers registered (decorator-based, no-op wrapper)")
