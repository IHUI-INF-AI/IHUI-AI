#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
外呼场景 API
- 迁移自 H:\ljd-交接文件\coze_zhs_py\api\outbound.py
- 功能：接收外呼系统回调，调用大模型生成回复，并判断用户意向
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from .langchain_api_mini import build_messages_for_model, get_effective_config, invoke_llm
from .token_utils import check_user_token_sufficient

router = APIRouter(prefix="/ihui-ai-api/outbound", tags=["Outbound"])
logger = logging.getLogger("outbound-api")


class OutboundCallbackRequest(BaseModel):
    """外呼回调请求"""
    user_input: str = Field(..., description="用户输入内容")
    model_id: str = Field(..., description="模型 ID")
    user_uuid: Optional[str] = Field("", description="用户 UUID")
    phone: Optional[str] = Field("", description="用户电话")
    call_id: Optional[str] = Field("", description="通话 ID")
    custom_prompt: Optional[str] = Field("", description="自定义提示词")


class OutboundCallbackResponse(BaseModel):
    """外呼回调响应"""
    answer: str
    action: str = Field(..., description="continue / transfer / end")
    transfer_number: Optional[str] = ""
    intent: Optional[str] = Field("", description="高意向/普通/低意向")


@router.post("/callback", summary="外呼回调接口")
async def outbound_callback(request: OutboundCallbackRequest):
    """接收外呼系统回调，调用大模型生成回复，并判断用户意向"""
    try:
        if request.user_uuid:
            token_check = await check_user_token_sufficient(request.user_uuid, min_token=1000)
            if not token_check.get("sufficient"):
                raise HTTPException(status_code=402, detail=token_check.get("reason", "Token 余额不足"))

        cfg = get_effective_config(request.model_id, None)
        if not cfg:
            raise HTTPException(status_code=404, detail="模型不存在")

        system_prompt = request.custom_prompt or "你是一个专业的客服助手，负责回答用户咨询。"
        messages = build_messages_for_model(
            cfg,
            request.user_input,
            None,
        )
        # 注入系统提示
        if not messages or messages[0].get("role") != "system":
            messages = [{"role": "system", "content": system_prompt}] + (messages or [])

        logger.info(
            "[Outbound] 收到外呼回调: call_id=%s, phone=%s, user_input=%s...",
            request.call_id, request.phone, request.user_input[:50],
        )

        full_response = ""
        async for chunk in invoke_llm(cfg, messages, stream=False):
            if isinstance(chunk, str):
                full_response = chunk
            elif isinstance(chunk, dict):
                kind = chunk.get("kind", "")
                content = chunk.get("content", "")
                if kind == "answer":
                    full_response += content

        answer = full_response.strip()
        if not answer:
            raise HTTPException(status_code=500, detail="大模型未返回有效回答")

        intent = _analyze_intent(request.user_input)
        action, transfer_number = _determine_action(intent, cfg)

        logger.info(
            "[Outbound] 生成回复: answer=%s..., intent=%s, action=%s",
            answer[:50], intent, action,
        )
        return OutboundCallbackResponse(
            answer=answer,
            action=action,
            transfer_number=transfer_number,
            intent=intent,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("[Outbound] 处理外呼回调异常: %s", e)
        raise HTTPException(status_code=500, detail="处理失败,请稍后重试")


def _analyze_intent(user_input: str) -> str:
    """分析用户意向：高意向 / 普通 / 低意向"""
    high_intent_keywords = ["价格", "购买", "演示", "试用", "合作", "签约", "方案", "报价"]
    low_intent_keywords = ["不需要", "不感兴趣", "再见", "挂断", "勿扰"]
    s = (user_input or "").lower()
    for k in high_intent_keywords:
        if k in s:
            return "高意向"
    for k in low_intent_keywords:
        if k in s:
            return "低意向"
    return "普通"


def _determine_action(intent: str, cfg: Dict[str, Any]) -> tuple[str, str]:
    """根据意向决定后续动作"""
    transfer_number = (cfg or {}).get("transfer_number", "")
    if intent == "高意向":
        return "transfer", transfer_number
    if intent == "低意向":
        return "end", ""
    return "continue", ""
