"""豆包 Socket 消息处理器.

迁移自 coze_zhs_py/api/doubao_socket_handler.py.
用于处理豆包格式的消息,确保公共 socket 能正确处理.
"""


from loguru import logger

from app.api.ws.public_socket import send_message_to_user_model  # type: ignore[attr-defined]


async def send_doubao_message(
    user_uuid: str,
    model_id: str,
    messages: list[dict],
    event_name: str = "custom_event",
    status: str = "run",
    chat_id: str | None = None,
) -> bool:
    """发送豆包格式的消息到公共 socket(确保返回消息包含 status 字段)."""
    try:
        formatted_messages = []
        for msg in messages or []:
            formatted_messages.append({
                "type": "text",
                "text": msg.get("content", ""),
                "role": msg.get("role", "user"),
            })
        success = await send_message_to_user_model(
            user_uuid=user_uuid,
            model_id=model_id,
            message=formatted_messages,
            event_name=event_name,
            chat_id=chat_id,
            status=status,
        )
        logger.info(f"豆包格式消息已发送: user={user_uuid}, model={model_id}")
        return success
    except Exception as e:
        logger.error(f"发送豆包格式消息失败: {e}")
        return False
