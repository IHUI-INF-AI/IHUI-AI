"""
聊天服务示例
展示在实际业务场景中如何使用send_message_to_user_model函数
"""

import asyncio
import uuid
from typing import Dict, Any, List
from api.public_socket import send_message_to_user_model

class ChatService:
    """聊天服务类，封装聊天相关的业务逻辑"""

    def __init__(self):
        self.active_sessions = {}  # 存储活跃会话信息

    async def start_chat_session(self, user_uuid: str, model_id: str) -> str:
        """开始一个新的聊天会话"""
        # 生成唯一的会话ID
        chat_id = str(uuid.uuid4())

        # 记录会话信息
        self.active_sessions[chat_id] = {
            "user_uuid": user_uuid,
            "model_id": model_id,
            "start_time": asyncio.get_event_loop().time(),
            "message_count": 0
        }

        # 发送欢迎消息
        welcome_message = {
            "type": "system",
            "content": "您好！我是您的AI助手，有什么可以帮助您的吗？",
            "suggestions": [
                "今天天气怎么样？",
                "帮我写一封邮件",
                "推荐一些电影"
            ]
        }

        await send_message_to_user_model(
            user_uuid=user_uuid,
            model_id=model_id,
            message=welcome_message,
            chat_id=chat_id
        )

        return chat_id

    async def send_user_message(self, chat_id: str, message: str) -> Dict[str, Any]:
        """处理用户发送的消息"""
        if chat_id not in self.active_sessions:
            return {"success": False, "error": "会话不存在"}

        session = self.active_sessions[chat_id]
        session["message_count"] += 1

        # 发送用户消息（模拟）
        await send_message_to_user_model(
            user_uuid=session["user_uuid"],
            model_id=session["model_id"],
            message={
                "type": "user",
                "content": message,
                "timestamp": asyncio.get_event_loop().time()
            },
            chat_id=chat_id
        )

        # 模拟AI处理和响应
        await asyncio.sleep(0.5)  # 模拟处理时间

        ai_response = await self._generate_ai_response(message)

        # 发送AI响应
        await send_message_to_user_model(
            user_uuid=session["user_uuid"],
            model_id=session["model_id"],
            message=ai_response,
            chat_id=chat_id
        )

        return {
            "success": True,
            "chat_id": chat_id,
            "message_count": session["message_count"]
        }

    async def _generate_ai_response(self, user_message: str) -> Dict[str, Any]:
        """生成AI响应（模拟）"""
        # 这里应该是实际的AI处理逻辑
        # 现在只是简单的模拟响应
        if "天气" in user_message:
            return {
                "type": "ai",
                "content": "今天天气晴朗，温度适宜，是个出行的好日子！",
                "data": {
                    "temperature": "25°C",
                    "condition": "晴",
                    "humidity": "65%"
                }
            }
        elif "邮件" in user_message:
            return {
                "type": "ai",
                "content": "我可以帮您起草邮件。请告诉我邮件的主题、收件人和主要内容。",
                "actions": [
                    {"type": "input", "label": "主题", "placeholder": "邮件主题"},
                    {"type": "input", "label": "收件人", "placeholder": "收件人邮箱"},
                    {"type": "textarea", "label": "内容", "placeholder": "邮件内容"}
                ]
            }
        else:
            return {
                "type": "ai",
                "content": f"我收到了您的消息：'{user_message}'。这是一个模拟响应，实际应用中这里会是AI生成的回复。"
            }

    async def end_chat_session(self, chat_id: str) -> bool:
        """结束聊天会话"""
        if chat_id not in self.active_sessions:
            return False

        session = self.active_sessions[chat_id]

        # 发送会话结束消息
        end_message = {
            "type": "system",
            "content": "感谢您的使用，会话已结束。期待下次为您服务！",
            "session_info": {
                "duration": asyncio.get_event_loop().time() - session["start_time"],
                "message_count": session["message_count"]
            }
        }

        # 使用status="stop"标记会话结束，这将触发Redis缓存清理
        await send_message_to_user_model(
            user_uuid=session["user_uuid"],
            model_id=session["model_id"],
            message=end_message,
            chat_id=chat_id,
            status="stop"
        )

        # 从活跃会话中移除
        del self.active_sessions[chat_id]

        return True

# 使用示例
async def demo_chat_service():
    """演示聊天服务的使用"""
    chat_service = ChatService()

    # 开始会话
    user_uuid = "demo_user"
    model_id = "assistant_model"

    print("=== 开始聊天会话演示 ===")
    chat_id = await chat_service.start_chat_session(user_uuid, model_id)
    print(f"创建会话: {chat_id}")

    # 模拟用户发送消息
    user_messages = [
        "你好，今天天气怎么样？",
        "帮我写一封邮件",
        "推荐一些电影"
    ]

    for msg in user_messages:
        print(f"
用户: {msg}")
        result = await chat_service.send_user_message(chat_id, msg)
        print(f"消息处理结果: {result}")

    # 结束会话
    print("
=== 结束聊天会话 ===")
    success = await chat_service.end_chat_session(chat_id)
    print(f"会话结束: {'成功' if success else '失败'}")

if __name__ == "__main__":
    asyncio.run(demo_chat_service())
