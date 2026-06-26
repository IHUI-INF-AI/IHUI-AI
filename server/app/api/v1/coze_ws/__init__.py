"""Coze 原生 WebSocket chat 模块 (迁移自 coze_zhs_py/api/websocket.py).

提供 7 个端点 (前缀 /cozeZhsApi/ws):
  - WebSocket /chat/{client_id}            流式聊天 (指定 client_id)
  - WebSocket /chat                        流式聊天 (自动生成 client_id)
  - GET    /stats                          连接统计
  - GET    /connections                    详细连接信息
  - GET    /queue                          排队状态
  - POST   /websocket/emergency-cleanup    紧急清理所有连接
  - GET    /websocket/system-status        系统状态 (内存/CPU/连接数)

复用 app.utils.coze_compat.CozeClient (httpx SSE) 调用 Coze v3/chat 接口.
"""
from app.api.v1.coze_ws.router import CozeWSManager, manager, router

__all__ = ["router", "manager", "CozeWSManager"]
