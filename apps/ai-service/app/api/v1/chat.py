"""POST /api/v1/ai/chat — 对话端点(完整业务流)。

业务流:
1. 接收 user input + 可选 session_id / model / tools
2. 调用 conversation_service.chat() 走完整流程
3. 返回 { code, message, data } 格式

支持:
- 单轮对话
- 多轮 tool loop(intent → tool select → LLM → tool exec → response)
- 完整 trace 返回
- 复用 vector_memory 做 RAG 增强(可选)
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ...services.conversation import conversation_service

router = APIRouter()


class ChatRequest(BaseModel):
    """Chat 请求体。"""

    message: str = Field(..., description="用户输入消息")
    session_id: str | None = Field(None, description="会话 ID(空则新建)")
    model: str | None = Field(None, description="模型名称(空用默认)")
    tools: list[str] | None = Field(None, description="允许的工具列表(空=自动选择)")
    max_iterations: int = Field(3, ge=1, le=10, description="tool loop 最大迭代次数")
    use_rag: bool = Field(False, description="是否启用 RAG 增强")
    rag_top_k: int = Field(3, ge=1, le=20, description="RAG 检索 top-k")


@router.post("/chat")
async def chat(req: ChatRequest) -> dict[str, Any]:
    """对话端点(完整业务流)。

    Returns:
        统一 { code, message, data } 格式。
    """
    try:
        result = await conversation_service.chat(
            user_input=req.message,
            session_id=req.session_id,
            model=req.model,
            allowed_tools=req.tools,
            max_iterations=req.max_iterations,
        )
        return {
            "code": 0,
            "message": "ok",
            "data": {
                **conversation_service.result_to_dict(result),
                "use_rag": req.use_rag,
                "rag_top_k": req.rag_top_k,
            },
        }
    except Exception as e:
        return {
            "code": 500,
            "message": f"对话失败: {e}",
            "data": {"error": str(e)},
        }
