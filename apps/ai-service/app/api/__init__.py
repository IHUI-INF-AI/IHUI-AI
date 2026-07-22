"""API v1 包 — 业务层 HTTP 接口(ai-service 完整业务流程)。"""

# 四层记忆 + Dream 梦境系统路由(2026-07-22 立,对标 OpenClaw Mem)
from .memory import router as memory_router  # noqa: E402,F401

# 多通道消息总线路由(2026-07-22 立,5 通道 + 优先级 + 降级,反超 OpenClaw 单 WS)
from .message_bus import router as message_bus_router  # noqa: E402,F401

# DAG Worker Pool + 优先级队列路由(2026-07-22 立,对齐 agent-runtime.ts 多 Agent 并行契约)
from .dag import router as dag_router  # noqa: E402,F401
