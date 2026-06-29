"""MCP (Model Context Protocol) 服务端聚合.

7 个 MCP 工具端点:
  /ali      阿里通义
  /kling    可灵视频
  /gemini   Google Gemini
  /suno     Suno 音乐
  /sora2    Sora2 视频
  /tbox     腾讯混元
  /resource 资源查询
"""

import json
import time

import httpx
from fastapi import APIRouter, Depends, Query
from loguru import logger

from app.config import settings
from app.schemas.common import error, success
from app.security import require_login

router = APIRouter()


# ---------------------------------------------------------------------------
# 工具配置
# ---------------------------------------------------------------------------

MCP_TOOLS: dict[str, dict] = {
    "ali": {
        "base": "https://dashscope.aliyuncs.com/api/v1",
        "key": lambda: settings.DASHSCOPE_API_KEY,
        "desc": "阿里通义 - 文本/图像/视频",
    },
    "kling": {
        "base": "https://api.klingai.com",
        "key": lambda: settings.KLING_ACCESS_KEY,
        "desc": "可灵 AI - 视频/图像生成",
    },
    "gemini": {
        "base": "https://generativelanguage.googleapis.com/v1beta",
        "key": lambda: settings.ZHIPU_API_KEY or "",
        "desc": "Google Gemini - 多模态",
    },
    "suno": {
        "base": "https://api.suno.ai/v1",
        "key": lambda: "",
        "desc": "Suno AI - 音乐生成",
    },
    "sora2": {
        "base": "https://api.openai.com/v1",
        "key": lambda: "",
        "desc": "OpenAI Sora2 - 视频生成",
    },
    "tbox": {
        "base": "https://hunyuan.tencent.com/api/v1",
        "key": lambda: settings.TENCENT_SECRET_KEY,
        "desc": "腾讯混元 - 多模态",
    },
    "resource": {
        "base": settings.MINIO_ENDPOINT,
        "key": lambda: settings.MINIO_ACCESS_KEY,
        "desc": "MinIO 资源查询",
    },
}


@router.get("/list", summary="列出所有 MCP 工具")
async def list_tools(user_uuid: str = Depends(require_login)):
    return success([{"name": name, **cfg, "key_loaded": bool(cfg["key"]())} for name, cfg in MCP_TOOLS.items()])


@router.post("/{tool}/invoke", summary="调用 MCP 工具")
async def invoke_tool(
    tool: str,
    method: str = Query("POST", description="HTTP 方法"),
    path: str = Query(..., description="工具子路径"),
    body: str = Query("{}", description="JSON body"),
    user_uuid: str = Depends(require_login),
):
    cfg = MCP_TOOLS.get(tool)
    if not cfg:
        return error(f"未知工具: {tool}")
    try:
        payload = json.loads(body) if body else {}
    except json.JSONDecodeError:
        return error("body 必须是 JSON 字符串")
    api_key = cfg["key"]()
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    url = cfg["base"] + path
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.request(method, url, headers=headers, json=payload)
            return success(
                {"status": resp.status_code, "body": resp.text[:2000]},
            )
        except Exception as e:
            logger.error(f"MCP {tool} error: {e}")
            return error(str(e))


@router.get("/{tool}/health", summary="工具健康检查")
async def tool_health(tool: str, user_uuid: str = Depends(require_login)):
    cfg = MCP_TOOLS.get(tool)
    if not cfg:
        return error(f"未知工具: {tool}")
    return success(
        {
            "tool": tool,
            "key_loaded": bool(cfg["key"]()),
            "base": cfg["base"],
            "desc": cfg["desc"],
            "ts": int(time.time()),
        }
    )
