# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""自动化复用会话线程(D12,2026-09-19 立)。

问题:automation 每次执行都是无状态新会话(sessionId=auto_<id>),丢上下文,产出
也不进入用户真实对话线程。

方案:automation 可绑定 conversationId(聊天会话)。执行时把该会话最近 N 条消息作为
上下文注入 prompt 头部,产出落库到同一 conversation,AI 在同一线程里"接力"。

本模块是可单测的核心(纯函数 + 依赖注入编排);生产落库/取历史的真实接线在
apps/api/src/services/agent-automation-scheduler.ts(api 持有 packages/database 访问权)。
build_automation_prompt 的 TS 镜像实现保持与本文逻辑一致。
"""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from typing import Any

logger = logging.getLogger(__name__)

# 注入上下文时最多取会话最近多少条消息
_RECENT_LIMIT = 20


def build_automation_prompt(
    recent_messages: list[dict[str, Any]] | None,
    prompt: str,
    limit: int = _RECENT_LIMIT,
) -> str:
    """把会话近期消息拼成上下文头部,接到 automation prompt 之前。

    - recent_messages 为空 / None → 原样返回 prompt(行为不变)。
    - 否则按时间顺序拼接 role: content,截断到 limit 条。
    """
    if not recent_messages:
        return prompt

    lines: list[str] = []
    for m in recent_messages[-limit:]:
        if not isinstance(m, dict):
            continue
        role = str(m.get("role", "user"))
        content = str(m.get("content", "")).strip()
        if content:
            lines.append(f"{role}: {content}")
    if not lines:
        return prompt

    history = "\n".join(lines)
    header = (
        "以下是该会话近期的历史消息,请在理解上下文的基础上接力执行自动化任务:\n"
        f"{history}\n\n"
        "--- 自动化任务 ---\n"
    )
    return f"{header}{prompt}"


async def run_automation_thread(
    *,
    prompt: str,
    conversation_id: str | None = None,
    user_uuid: str | None = None,
    get_recent_messages: Callable[[str, str | None, int], Awaitable[list[dict[str, Any]]]]
    | None = None,
    persist_message: Callable[[str, str | None, str], Awaitable[None]] | None = None,
    run_agent: Callable[[str, str | None], Awaitable[str]] | None = None,
) -> str:
    """在绑定会话线程里执行 automation。

    Args:
        prompt:             自动化 prompt
        conversation_id:    绑定的聊天会话 ID(None=无状态旧行为)
        user_uuid:          用户 ID(取历史 / 落库用)
        get_recent_messages:取会话最近消息(注入上下文用)
        persist_message:    把产出落库到该会话(复用现有消息写入服务)
        run_agent:          真正调 agent 执行,返回产出文本

    Returns:
        agent 产出文本

    行为:
        - 无 conversation_id → 直接 run_agent(prompt, None),不取历史、不落库(旧行为不变)。
        - 有 conversation_id → 取最近消息注入 prompt,run_agent 后把产出 persist_message 到会话。
    """
    if conversation_id and get_recent_messages is not None:
        recent = await get_recent_messages(conversation_id, user_uuid, _RECENT_LIMIT)
        final_prompt = build_automation_prompt(recent, prompt)
    else:
        final_prompt = prompt

    output = await run_agent(final_prompt, conversation_id) if run_agent else ""

    if conversation_id and persist_message is not None:
        await persist_message(conversation_id, user_uuid, output)

    return output
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
