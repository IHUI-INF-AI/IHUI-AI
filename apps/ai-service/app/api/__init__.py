"""API v1 包 — 业务层 HTTP 接口(ai-service 完整业务流程)。"""

# 四层记忆 + Dream 梦境系统路由(2026-07-22 立,对标 OpenClaw Mem)
from .memory import router as memory_router  # noqa: E402,F401
