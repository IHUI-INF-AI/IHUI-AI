"""
Socket消息发送示例
展示如何使用send_message_to_user_model函数在不同场景下发送消息
"""

import asyncio
from typing import Dict, Any, List
from api.public_socket import send_message_to_user_model

async def simple_message_example():
    """简单消息发送示例"""
    # 发送简单的文本消息
    success = await send_message_to_user_model(
        user_uuid="user123",
        model_id="model456",
        message="这是一条简单的文本消息"
    )
    print(f"消息发送结果: {'成功' if success else '失败'}")

async def complex_message_example():
    """复杂消息发送示例"""
    # 发送包含复杂结构的消息
    complex_message = {
        "type": "text",
        "content": "这是一条复杂消息",
        "metadata": {
            "source": "system",
            "priority": "high"
        }
    }

    success = await send_message_to_user_model(
        user_uuid="user123",
        model_id="model456",
        message=complex_message,
        event_name="custom_event"
    )
    print(f"复杂消息发送结果: {'成功' if success else '失败'}")

async def chat_session_example():
    """会话消息示例"""
    # 开始会话
    await send_message_to_user_model(
        user_uuid="user123",
        model_id="model456",
        message="你好，开始我们的对话",
        chat_id="session789"
    )

    # 发送多条会话消息
    messages = [
        "这是第一条消息",
        "这是第二条消息",
        {"type": "image", "url": "https://example.com/image.jpg"}
    ]

    for msg in messages:
        await send_message_to_user_model(
            user_uuid="user123",
            model_id="model456",
            message=msg,
            chat_id="session789"
        )

    # 结束会话
    await send_message_to_user_model(
        user_uuid="user123",
        model_id="model456",
        message="对话结束",
        chat_id="session789",
        status="stop"
    )

    print("会话消息示例完成")

async def batch_messages_example():
    """批量发送消息示例"""
    users = ["user1", "user2", "user3"]
    model_id = "common_model"

    # 向多个用户发送相同消息
    message = "这是一条广播消息"

    tasks = []
    for user in users:
        task = send_message_to_user_model(
            user_uuid=user,
            model_id=model_id,
            message=message,
            event_name="broadcast"
        )
        tasks.append(task)

    results = await asyncio.gather(*tasks)
    success_count = sum(results)
    print(f"批量发送完成: {success_count}/{len(users)} 成功")

async def conditional_message_example():
    """条件性消息发送示例"""
    user_uuid = "user123"
    model_id = "model456"
    chat_id = "conditional_chat"

    # 根据条件发送不同消息
    user_data = {"premium": True, "level": 5}

    if user_data["premium"]:
        message = {
            "type": "premium_content",
            "content": "这是高级内容",
            "features": ["feature1", "feature2"]
        }
    else:
        message = {
            "type": "standard_content",
            "content": "这是标准内容"
        }

    success = await send_message_to_user_model(
        user_uuid=user_uuid,
        model_id=model_id,
        message=message,
        chat_id=chat_id
    )

    print(f"条件性消息发送结果: {'成功' if success else '失败'}")

async def main():
    """主函数，运行所有示例"""
    print("=== 运行Socket消息发送示例 ===")

    await simple_message_example()
    await complex_message_example()
    await chat_session_example()
    await batch_messages_example()
    await conditional_message_example()

    print("=== 所有示例运行完成 ===")

if __name__ == "__main__":
    asyncio.run(main())
