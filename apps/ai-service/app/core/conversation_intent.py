# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""Intent classification helpers — 意图分类辅助方法。

从 conversation.py 提取(2026-09-13 模块拆分):
- classify_intent():      LLM 意图分类 + 关键词 fallback
- fallback_intent():      基于关键词的 fallback 意图(LLM 不可用时)
- parse_json_object():    从文本中提取首个 JSON object
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from .conversation_models import INTENT_LABELS, IntentResult
from .llm_gateway import llm_gateway
from ..services.mcp_server import mcp_server

logger = logging.getLogger(__name__)


async def classify_intent(
    user_input: str,
    model: str | None = None,
    tool_keywords: dict[str, list[str]] | None = None,
) -> IntentResult:
    """LLM 分类意图 + 抽取 entities + 决定是否需要 tool。

    失败/降级时返回基于关键词的 fallback 意图。

    Args:
        user_input: 用户输入文本。
        model: 模型名称(空用默认)。
        tool_keywords: 工具 → 关键词映射(用于 fallback 意图检测)。

    Returns:
        IntentResult
    """
    # 先计算 fallback(LLM 失败时使用)
    fallback = fallback_intent(user_input, tool_keywords)

    classification_prompt = [
        {
            "role": "system",
            "content": (
                "你是意图分类助手。分析用户输入并以 JSON 形式返回:\n"
                "{\n"
                '  "intent": "chat|qa|tool_use|code|analysis|creative|other",\n'
                '  "confidence": 0.0-1.0,\n'
                '  "entities": {"key": "value"},\n'
                '  "needs_tool": true/false,\n'
                '  "suggested_tools": ["tool_name1", "tool_name2"],\n'
                '  "reasoning": "为什么这么分类"\n'
                "}\n"
                f"可用工具: {', '.join(t.name for t in mcp_server.list_tools())}"
            ),
        },
        {"role": "user", "content": user_input},
    ]

    try:
        result = await llm_gateway.complete(classification_prompt, model=model)
        content = str(result.get("content", "") or "")
        parsed = parse_json_object(content)
        if parsed:
            intent_label = str(parsed.get("intent", "other")).lower()
            if intent_label not in INTENT_LABELS:
                intent_label = "other"
            try:
                confidence = float(parsed.get("confidence", 0.5))
            except (TypeError, ValueError):
                confidence = 0.5
            return IntentResult(
                intent=intent_label,
                confidence=max(0.0, min(1.0, confidence)),
                entities=parsed.get("entities") or {},
                reasoning=str(parsed.get("reasoning", "")),
                needs_tool=bool(parsed.get("needs_tool", False)),
                suggested_tools=list(parsed.get("suggested_tools") or []),
            )
    except Exception as e:
        logger.warning("意图分类 JSON 解析失败,使用 fallback: %s", e)
    return fallback


def fallback_intent(
    user_input: str,
    tool_keywords: dict[str, list[str]] | None = None,
) -> IntentResult:
    """基于关键词的 fallback 意图(LLM 不可用时)。

    Args:
        user_input: 用户输入文本。
        tool_keywords: 工具 → 关键词映射。

    Returns:
        IntentResult
    """
    text = user_input.lower()
    needs_tool = False
    suggested: list[str] = []

    # 工具关键词检测
    if tool_keywords:
        for tool, kws in tool_keywords.items():
            if any(kw in text for kw in kws):
                needs_tool = True
                suggested.append(tool)

    # 意图粗分类
    if any(k in text for k in ["代码", "函数", "class", "def ", "code", "function"]):
        intent = "code"
    elif any(k in text for k in ["分析", "调研", "研究", "analyze", "research"]):
        intent = "analysis"
    elif any(k in text for k in ["写", "创作", "写一", "creative", "write"]):
        intent = "creative"
    elif any(k in text for k in ["?", "？", "是什么", "怎么", "how", "what", "why"]):
        intent = "qa"
    elif needs_tool:
        intent = "tool_use"
    else:
        intent = "chat"

    return IntentResult(
        intent=intent,
        confidence=0.5,
        needs_tool=needs_tool,
        suggested_tools=suggested,
        reasoning="基于关键词的 fallback 分类",
    )


def parse_json_object(text: str) -> dict[str, Any] | None:
    """从文本中提取首个 JSON object。

    Args:
        text: 可能包含 JSON 的文本。

    Returns:
        解析后的 dict,无法解析时返回 None。
    """
    if not text:
        return None
    # 尝试整段解析
    try:
        obj = json.loads(text)
        if isinstance(obj, dict):
            return obj
    except (json.JSONDecodeError, ValueError):
        pass
    # 尝试正则提取 {...}
    match = re.search(r"\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}", text, re.DOTALL)
    if match:
        try:
            obj = json.loads(match.group())
            if isinstance(obj, dict):
                return obj
        except (json.JSONDecodeError, ValueError):
            pass
    return None
