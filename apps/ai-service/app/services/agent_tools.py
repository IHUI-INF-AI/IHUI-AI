"""Agent 工具工厂(2026-07-26 G4 完整迁移)。

把 knowledge_lookup 等知识查询能力包装成 ToolDefinition,
让 AgentLoopV2 调用方可以一行接入:

    from app.services.agent_tools import make_knowledge_lookup_tool
    from app.services.agent_loop_v2 import AgentLoopV2, ToolDefinition

    tools = [make_knowledge_lookup_tool(user_id="u1", repo_id="my-repo")]
    loop = AgentLoopV2(llm_complete_fn=..., tools=tools)
    result = await loop.run(messages)

工具 executor 接收 LLM 传来的 args dict,返回 dict 给 LLM(符合
OpenAI function calling 的 tool result 格式)。
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from .agent_loop_v2 import ToolDefinition
from .knowledge_lookup import knowledge_lookup

logger = logging.getLogger(__name__)


def make_knowledge_lookup_tool(
    *,
    user_id: Optional[str] = None,
    repo_id: Optional[str] = None,
    session_id: Optional[str] = None,
    top_k_per_source: int = 5,
    source_priority: Optional[list[str]] = None,
    api_token: Optional[str] = None,
) -> ToolDefinition:
    """构造 knowledge_lookup 工具,供 AgentLoopV2 接入。

    工具名:knowledge_lookup
    工具描述:供 LLM 调用查代码库 / RAG / 历史会话三源
    参数 schema:query (required string) + top_k_per_source (optional int)
    executor:调 knowledge_lookup(),返回 {hits, errors, duration_ms} dict

    Args:
        user_id / repo_id / session_id / top_k_per_source / source_priority / api_token:
            闭包绑定参数(调用方传入,工具执行时不暴露给 LLM)。
            这些参数在工具构造时固定,LLM 只能控制 query 和 top_k_per_source。

    Returns:
        ToolDefinition,可直接加入 AgentLoopV2 的 tools 列表。

    用法:
        tools = [make_knowledge_lookup_tool(user_id="u1", repo_id="r1")]
        loop = AgentLoopV2(llm_complete_fn=..., tools=tools)
    """

    async def executor(args: dict[str, Any]) -> dict[str, Any]:
        """工具执行器:LLM 传 {query, top_k_per_source?} → 返回结果 dict。"""
        query = args.get("query", "").strip()
        if not query:
            return {
                "error": "query is required",
                "hits": [],
                "errors": [],
                "duration_ms": 0.0,
            }

        # LLM 可覆盖 top_k_per_source(若工具参数 schema 允许),否则用闭包默认
        top_k = args.get("top_k_per_source", top_k_per_source)

        try:
            result = await knowledge_lookup(
                query,
                user_id=user_id,
                repo_id=repo_id,
                session_id=session_id,
                top_k_per_source=top_k,
                source_priority=source_priority,
                api_token=api_token,
            )
        except ValueError as e:
            # source_priority 不合法(理论上闭包不会,但防御性处理)
            return {
                "error": f"ValueError: {e}",
                "hits": [],
                "errors": [],
                "duration_ms": 0.0,
            }

        # 序列化为 LLM 友好 dict(hits 含 source/score/content,不含 raw 避免冗长)
        return {
            "query": result.query,
            "hits": [
                {
                    "source": h.source,
                    "score": h.score,
                    "content": h.content,
                }
                for h in result.hits
            ],
            "errors": result.errors,
            "duration_ms": result.duration_ms,
        }

    return ToolDefinition(
        name="knowledge_lookup",
        description=(
            "查询外部知识库(代码库语义检索 + RAG 向量检索 + 跨会话历史摘要)。"
            "用于查找代码实现 / 历史对话 / 相关文档。"
            "返回 hits 列表,每个含 source / score / content。"
        ),
        parameters={
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "自然语言查询,如 '用户认证逻辑实现' 或 '上次讨论 JWT 的会话'",
                },
                "top_k_per_source": {
                    "type": "integer",
                    "description": "每个源返回 top-K,默认 5",
                    "default": 5,
                    "minimum": 1,
                    "maximum": 20,
                },
            },
            "required": ["query"],
            "additionalProperties": False,
        },
        executor=executor,
    )
