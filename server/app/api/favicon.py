#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Favicon 处理模块
- 迁移自 H:\ljd-交接文件\coze_zhs_py\api\favicon.py
- 提供 /favicon.ico 路由
- 优先返回 static/favicon.ico；其次 favicon.svg；最后内嵌 SVG 占位
"""

from fastapi import APIRouter, Response
from fastapi.responses import FileResponse
import os

router = APIRouter()

_STATIC_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static"
)

_FALLBACK_SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <rect width="32" height="32" rx="6" fill="#667eea"/>
  <text x="16" y="22" font-family="Arial, sans-serif" font-size="18" font-weight="bold" text-anchor="middle" fill="white">IHUI</text>
</svg>"""


@router.get("/favicon.ico", include_in_schema=False)
def get_favicon():
    """提供 favicon.ico 文件（按优先级：ico → svg → 内嵌）"""
    ico_path = os.path.join(_STATIC_DIR, "favicon.ico")
    if os.path.exists(ico_path):
        return FileResponse(ico_path, media_type="image/x-icon")

    svg_path = os.path.join(_STATIC_DIR, "favicon.svg")
    if os.path.exists(svg_path):
        return FileResponse(svg_path, media_type="image/svg+xml")

    return Response(content=_FALLBACK_SVG.encode("utf-8"), media_type="image/svg+xml")
