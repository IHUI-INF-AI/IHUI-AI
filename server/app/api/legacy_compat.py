"""Java 历史项目 API 兼容层 (Legacy Compatibility Layer) - 已废弃

本文件原包含 415 个 HTTP 501 stub 路由，对应 Java 历史项目的旧路径。
经核查，这些旧路径的功能已在以下 Python 模块中真实实现（路径已重构）：
- 教育微服务 → app/api/v1/edu/ + app/api/v1/member.py + app/api/v1/learn/
- ZHS_Server_java → app/api/langchain_api.py + app/api/v1/agents/ + app/api/v1/payments/
- ai-smart-society-java → app/api/v1/auth/ + app/api/v1/system/ + app/api/v1/finance/

为避免误导（501 stub 不是真实实现）并防止路径冲突，本文件已清空。
历史路径兼容由各业务模块的实际路由覆盖。

生成时间: 2026-06-26
清空时间: 2026-06-26（封存前最终核查）
"""
from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="", tags=["legacy-compat"], include_in_schema=False)
