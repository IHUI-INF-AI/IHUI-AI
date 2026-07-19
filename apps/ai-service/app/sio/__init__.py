"""Socket.IO 兼容协议层。

为旧客户端(用 Socket.IO 协议连接历史 coze_zhs_py 的)提供无缝连接入口,
复用现有 LangGraph/LiteLLM 工作流实现流式 AI 对话。

事件契约(与历史 coze_zhs_py 客户端保持兼容):
- 客户端 → 服务端: join_room / leave_room / chat_message
- 服务端 → 客户端: chat_stream_chunk / chat_stream_done / chat_error
- 内置: connect / disconnect(Socket.IO 自动派发)
"""
import logging

import socketio

from ..core.config import settings

logger = logging.getLogger(__name__)

# CORS: 允许 apps/web 域名,沿用 FastAPI 的 cors_origin 配置(逗号分隔列表)。
# asyncio 兼容模式 + async_handlers 让每个长任务(如 astream)在独立 task 中跑,
# 避免阻塞 socketio 内部消息循环。
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=[
        origin.strip()
        for origin in settings.cors_origin.split(",")
        if origin.strip()
    ] or ["*"],
    async_handlers=True,
    ping_interval=25,
    ping_timeout=20,
    logger=False,
    engineio_logger=False,
)

# 注意:事件处理器在 app/sio/handlers.py 注册,
# 由 app/main.py 启动时显式调用 register_handlers(sio) 触发挂载,
# 避免在 import 阶段引发循环依赖。

__all__ = ["sio"]
