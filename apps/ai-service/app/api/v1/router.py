"""API v1 统一路由(挂载在 /api/v1 前缀)。

聚合 chat / agent / rag / knowledge-graph 子路由。
"""

from __future__ import annotations

from fastapi import APIRouter

from . import agent, chat, knowledge_graph, rag

api_v1_router = APIRouter()
api_v1_router.include_router(chat.router, prefix="/ai", tags=["v1-chat"])
api_v1_router.include_router(agent.router, prefix="/ai", tags=["v1-agent"])
api_v1_router.include_router(rag.router, prefix="/ai", tags=["v1-rag"])
# 知识图谱(G5 - 2026-07-21)
api_v1_router.include_router(knowledge_graph.router, prefix="/ai/knowledge-graph", tags=["v1-knowledge-graph"])
