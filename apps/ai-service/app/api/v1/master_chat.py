# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""POST /api/v1/ai/master/chat — 总管人格对话（P3-01 / P3-02）。

与通用对话的区别只有两处，且都在服务端固定，不由客户端传：
- system prompt 读 `app/agents/master.md`（唯一真源，不在本文件复制第二份）；
- 工具面固定为 `master_profile.MASTER_TOOL_NAMES` 三件套。

普通对话仍走 `/api/v1/ai/chat`，本端点不替换、不改变它。
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from ...agents.master_profile import MASTER_SYSTEM_PROMPT, MASTER_TOOL_NAMES
from ...core.jwt_auth import DEV_ANONYMOUS_PRINCIPAL, require_request_user_id
from ...middleware.output_safety import annotate_ai_generated, apply_disclaimers, scan_output
from ...services.conversation import SessionOwnershipError, conversation_service

router = APIRouter()


class MasterChatRequest(BaseModel):
    """总管对话请求。"""

    message: str = Field(..., min_length=1, max_length=8000, description="用户输入")
    session_id: str | None = Field(None, description="会话 ID（空则新建）")
    model: str | None = Field(None, description="模型名称（空用默认）")
    max_iterations: int = Field(6, ge=1, le=12, description="工具循环最大轮次")


@router.post("/chat")
async def master_chat(req: MasterChatRequest, request: Request) -> dict[str, Any]:
    """总管对话：固定人格 + 固定三工具，仍是同一套 tool loop。"""
    principal = await require_request_user_id(request)
    user_id = None if principal == DEV_ANONYMOUS_PRINCIPAL else principal
    try:
        result = await conversation_service.chat(
            user_input=req.message,
            session_id=req.session_id,
            model=req.model,
            allowed_tools=list(MASTER_TOOL_NAMES),
            max_iterations=req.max_iterations,
            user_id=user_id,
            system_prompt=MASTER_SYSTEM_PROMPT,
        )
        data = conversation_service.result_to_dict(result)
        response_text = str(data.get("final_response", "") or "")
        check = scan_output(response_text) if response_text else None
        if check is not None:
            data["final_response"] = apply_disclaimers(response_text, check)
            if check.blocked:
                data["safety"] = {
                    "risk": check.risk,
                    "categories": sorted(check.categories),
                    "note": "输出命中高风险模式,已附加合规免责提示",
                }
            elif check.risk == "low":
                data["safety"] = {
                    "risk": check.risk,
                    "categories": sorted(check.categories),
                    "note": "输出命中疑似误导性表述,已追加仅供参考提示",
                }
        data = annotate_ai_generated(data)
        data["persona"] = "master"
        data["tools"] = list(MASTER_TOOL_NAMES)
        return {"code": 0, "message": "ok", "data": data}
    except SessionOwnershipError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001 - 与通用 chat 一致：结构化 500，不吐栈
        raise HTTPException(status_code=500, detail=f"总管对话失败: {type(exc).__name__}") from exc
