"""
API集成示例
展示如何在FastAPI路由中使用send_message_to_user_model函数
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
import uuid
import asyncio

from api.public_socket import send_message_to_user_model
from utils.auth import get_current_user  # 假设存在认证依赖

# 创建路由
router = APIRouter(prefix="/chat", tags=["聊天"])

# 请求模型
class MessageRequest(BaseModel):
    """消息请求模型"""
    content: str = Field(..., description="消息内容")
    model_id: str = Field(..., description="模型ID")
    chat_id: Optional[str] = Field(None, description="会话ID，如果不提供将创建新会话")

class ChatEndRequest(BaseModel):
    """结束聊天请求模型"""
    chat_id: str = Field(..., description="要结束的会话ID")

# 响应模型
class MessageResponse(BaseModel):
    """消息响应模型"""
    success: bool = Field(..., description="是否成功")
    chat_id: str = Field(..., description="会话ID")
    message_id: str = Field(..., description="消息ID")
    timestamp: float = Field(..., description="时间戳")

# 内存存储（实际应用中应使用数据库）
active_chats: Dict[str, Dict[str, Any]] = {}

@router.post("/send", response_model=MessageResponse)
async def send_message(
    request: MessageRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """
    发送聊天消息

    1. 如果没有chat_id，创建新会话
    2. 发送用户消息
    3. 在后台任务中处理AI响应
    """
    user_uuid = current_user["uuid"]

    # 如果没有chat_id，创建新会话
    if not request.chat_id:
        chat_id = str(uuid.uuid4())
        active_chats[chat_id] = {
            "user_uuid": user_uuid,
            "model_id": request.model_id,
            "created_at": asyncio.get_event_loop().time(),
            "message_count": 0
        }

        # 发送欢迎消息
        welcome_message = {
            "type": "system",
            "content": "会话已创建，您可以开始发送消息了"
        }

        await send_message_to_user_model(
            user_uuid=user_uuid,
            model_id=request.model_id,
            message=welcome_message,
            chat_id=chat_id
        )
    else:
        chat_id = request.chat_id

        # 验证会话是否存在且属于当前用户
        if chat_id not in active_chats or active_chats[chat_id]["user_uuid"] != user_uuid:
            raise HTTPException(status_code=404, detail="会话不存在或无权访问")

    # 生成消息ID
    message_id = str(uuid.uuid4())

    # 发送用户消息
    user_message = {
        "type": "user",
        "content": request.content,
        "message_id": message_id
    }

    success = await send_message_to_user_model(
        user_uuid=user_uuid,
        model_id=request.model_id,
        message=user_message,
        chat_id=chat_id
    )

    if not success:
        raise HTTPException(status_code=500, detail="发送消息失败")

    # 更新会话信息
    active_chats[chat_id]["message_count"] += 1

    # 在后台任务中处理AI响应
    background_tasks.add_task(
        process_ai_response,
        user_uuid=user_uuid,
        model_id=request.model_id,
        chat_id=chat_id,
        user_message=request.content
    )

    return MessageResponse(
        success=True,
        chat_id=chat_id,
        message_id=message_id,
        timestamp=asyncio.get_event_loop().time()
    )

async def process_ai_response(
    user_uuid: str,
    model_id: str,
    chat_id: str,
    user_message: str
):
    """
    后台任务：处理AI响应
    """
    # 模拟AI处理时间
    await asyncio.sleep(1)

    # 生成AI响应（实际应用中这里调用AI服务）
    ai_response_content = f"这是对'{user_message}'的AI响应"

    ai_response = {
        "type": "assistant",
        "content": ai_response_content,
        "in_response_to": user_message
    }

    # 发送AI响应
    await send_message_to_user_model(
        user_uuid=user_uuid,
        model_id=model_id,
        message=ai_response,
        chat_id=chat_id
    )

@router.post("/end")
async def end_chat(
    request: ChatEndRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    结束聊天会话

    1. 验证会话是否存在且属于当前用户
    2. 发送结束消息（status="stop"）
    3. 从活跃会话中移除
    """
    user_uuid = current_user["uuid"]
    chat_id = request.chat_id

    # 验证会话是否存在且属于当前用户
    if chat_id not in active_chats or active_chats[chat_id]["user_uuid"] != user_uuid:
        raise HTTPException(status_code=404, detail="会话不存在或无权访问")

    session_info = active_chats[chat_id]

    # 发送会话结束消息
    end_message = {
        "type": "system",
        "content": "会话已结束，感谢您的使用",
        "session_stats": {
            "duration": asyncio.get_event_loop().time() - session_info["created_at"],
            "message_count": session_info["message_count"]
        }
    }

    # 使用status="stop"标记会话结束，这将触发Redis缓存清理
    success = await send_message_to_user_model(
        user_uuid=user_uuid,
        model_id=session_info["model_id"],
        message=end_message,
        chat_id=chat_id,
        status="stop"
    )

    if not success:
        raise HTTPException(status_code=500, detail="结束会话失败")

    # 从活跃会话中移除
    del active_chats[chat_id]

    return {"success": True, "message": "会话已成功结束"}

@router.get("/list")
async def list_chats(current_user: dict = Depends(get_current_user)):
    """
    获取用户的活跃聊天会话列表
    """
    user_uuid = current_user["uuid"]

    # 过滤出属于当前用户的会话
    user_chats = [
        {
            "chat_id": chat_id,
            "model_id": info["model_id"],
            "created_at": info["created_at"],
            "message_count": info["message_count"]
        }
        for chat_id, info in active_chats.items()
        if info["user_uuid"] == user_uuid
    ]

    return {"chats": user_chats}
