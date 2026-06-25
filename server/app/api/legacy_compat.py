"""
Java 历史项目 API 兼容层 (Legacy Compatibility Layer)
=====================================================

为 Java 旧 API 路径 (/auth-api/* /public-api/*) 提供 URL 别名, 内部调用现有 Python handler。

核心原则:
- 0 业务逻辑, 100% import-and-reuse 避免代码重复
- 所有 alias 路由直接调用现有 Python handler 函数
- 业务实现 100% 在现有 handler 中, 此文件仅做 URL 重写

生成时间: 2026-06-26
alias 路由: 0 个
目标文件: 0 个
"""
from fastapi import APIRouter, Request

router = APIRouter(prefix="", tags=["legacy-compat"])

# 导入目标 handler (避免代码重复)


# === 别名路由 ===

