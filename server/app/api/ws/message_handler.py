"""消息处理器.

迁移自 coze_zhs_py/api/message_handler.py.
用于处理不同格式的消息.
"""

from typing import Any

from loguru import logger

from app.api.ws.public_socket import send_message_to_user_model  # type: ignore[attr-defined]


async def send_formatted_message(
    user_uuid: str,
    model_id: str,
    message_data: Any,
    event_name: str = "message",
    chat_id: str | None = None,
    status: str = "run",
) -> bool:
    """发送格式化的消息到公共 socket."""
    try:
        if isinstance(message_data, list):
            return await send_message_to_user_model(
                user_uuid=user_uuid,
                model_id=model_id,
                message=message_data,
                event_name=event_name,
                chat_id=chat_id,
                status=status,
            )
        if isinstance(message_data, dict) and "messages" in message_data:
            return await send_message_to_user_model(
                user_uuid=user_uuid,
                model_id=model_id,
                message=message_data.get("messages", []),
                event_name=message_data.get("event_name", event_name),
                chat_id=message_data.get("chat_id", chat_id),
                status=message_data.get("status", status),
            )
        return await send_message_to_user_model(
            user_uuid=user_uuid,
            model_id=model_id,
            message=message_data,
            event_name=event_name,
            chat_id=chat_id,
            status=status,
        )
    except Exception as e:
        logger.error(f"发送格式化消息失败: {e}")
        return False
