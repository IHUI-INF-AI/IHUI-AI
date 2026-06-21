"""Shared helpers for WebSocket message construction.

Standardises WS message format across chat, notice, stock, and AI streaming endpoints.
"""

from datetime import datetime


def ws_msg(
    code: int = 200,
    msg: str = "success",
    event: str = "system",
    data_type: str = "text",
    content: str = "",
    *,
    chat_id: str = "",
    extra_data: dict | None = None,
    detail: dict | None = None,
    **kwargs,
) -> dict:
    """Build a standardised WebSocket message dict.

    Args:
        code: Numeric status code (200, 400, 408, etc.)
        msg: Short message string.
        event: Event type (e.g. "system.connected", "conversation.chat.created").
        data_type: Data payload type (e.g. "text", "connected", "pong", "error").
        content: Human-readable content string.
        chat_id: Optional chat ID.
        extra_data: Additional fields to merge into the data dict.
        detail: Optional detail dict (for error details like balance info).
        **kwargs: Additional top-level fields (e.g. type="stream_start").

    Returns:
        Standardised WS message dict.

    Usage:
        await ws_manager.send_message(client_id, ws_msg(200, "success", "connection.heartbeat", "pong"))
        await ws_manager.send_message(client_id, ws_msg(400, "error", "system.error", "Missing prompt", data_type="error"))
    """
    data = {
        "type": data_type,
        "content": content,
        "created_at": datetime.now().isoformat(),
    }
    if chat_id:
        data["chat_id"] = chat_id
    if extra_data:
        data.update(extra_data)

    payload = {
        "code": code,
        "msg": msg,
        "data": data,
        "event": event,
    }
    if detail:
        payload["detail"] = detail
    # Merge extra top-level fields (e.g. type="stream_start")
    payload.update(kwargs)
    return payload


def ws_stream_start(chat_id: str = "", content: str = "Chat created") -> dict:
    """Build a stream-start event (common in AI chat endpoints)."""
    return {
        "type": "stream_start",
        **ws_msg(
            200,
            "success",
            "conversation.chat.created",
            content,
            data_type="conversation_created",
            chat_id=chat_id,
        ),
    }
