"""
Outbound intent analysis utilities.

Ported from historical project:
  - H:/历史项目存档/ljd-交接文件/coze_zhs_py/api/outbound.py (intent keywords + action decision)
  - H:/历史项目存档/ljd-交接文件/coze_zhs_py/api/langchain_api_mini.py (invoke_llm dispatcher, simplified)

The historical outbound.py imported invoke_llm from langchain_api_mini; here we
provide a simplified async invoke_llm that calls DashScope text generation.
Intent analysis and action decision keep the original keyword-based logic.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger("outbound")

# DashScope text generation endpoint
_DASHSCOPE_CHAT_URL = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation"

# High intent keywords (ported from historical outbound.py)
_HIGH_INTENT_KEYWORDS = ["价格", "购买", "演示", "试用", "合作", "签约", "方案", "报价"]

# Low intent keywords (ported from historical outbound.py)
_LOW_INTENT_KEYWORDS = ["不需要", "不感兴趣", "再见", "挂断", "勿扰"]


def _analyze_intent(text: str) -> dict[str, Any]:
    """分析用户意向 (keyword-based, ported from historical outbound.py).

    Args:
        text: user input text.

    Returns:
        dict with keys: intent (高意向/普通/低意向), matched_keyword, raw_text.
    """
    try:
        if not text:
            return {"intent": "普通", "matched_keyword": "", "raw_text": ""}
        text_lower = text.lower()
        for kw in _HIGH_INTENT_KEYWORDS:
            if kw in text_lower:
                return {"intent": "高意向", "matched_keyword": kw, "raw_text": text}
        for kw in _LOW_INTENT_KEYWORDS:
            if kw in text_lower:
                return {"intent": "低意向", "matched_keyword": kw, "raw_text": text}
        return {"intent": "普通", "matched_keyword": "", "raw_text": text}
    except Exception as e:
        logger.error("[Outbound] _analyze_intent error: %s", e)
        return {"intent": "普通", "matched_keyword": "", "raw_text": text}


def _determine_action(intent: dict[str, Any]) -> str:
    """根据意向决定后续动作 (ported from historical outbound.py).

    Args:
        intent: dict returned by _analyze_intent.

    Returns:
        action string: transfer(转接) / end(结束) / continue(继续对话).
    """
    try:
        level = (intent or {}).get("intent", "普通")
        if level == "高意向":
            return "transfer"
        if level == "低意向":
            return "end"
        return "continue"
    except Exception as e:
        logger.error("[Outbound] _determine_action error: %s", e)
        return "continue"


async def invoke_llm(prompt: str) -> str:
    """调用大模型生成回复 (simplified port of langchain_api_mini.invoke_llm).

    Uses DashScope text-generation endpoint with the configured API key.
    Non-blocking via httpx.AsyncClient.

    Args:
        prompt: user prompt text.

    Returns:
        model reply text; empty string on failure.
    """
    try:
        api_key = settings.DASHSCOPE_API_KEY
        if not api_key:
            logger.error("[Outbound] invoke_llm: DASHSCOPE_API_KEY not configured")
            return ""
        payload = {
            "model": "qwen-turbo",
            "input": {
                "messages": [
                    {"role": "system", "content": "你是一个专业的客服助手，负责回答用户咨询。"},
                    {"role": "user", "content": prompt},
                ]
            },
        }
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(_DASHSCOPE_CHAT_URL, headers=headers, json=payload)
        if resp.status_code != 200:
            logger.error("[Outbound] invoke_llm http %s: %s", resp.status_code, resp.text[:200])
            return ""
        data = resp.json()
        output = data.get("output", {})
        choices = output.get("choices", [])
        if choices:
            return (choices[0].get("message", {}) or {}).get("content", "") or output.get("text", "")
        return output.get("text", "")
    except Exception as e:
        logger.error("[Outbound] invoke_llm error: %s", e)
        return ""
