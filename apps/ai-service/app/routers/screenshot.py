"""截图路由(2026-07-22 新增,WorkPanel iframe 降级)。

提供 HTTP 端点供前端直接调用(无需走 MCP 协议)。

端点:
- POST /api/screenshot/take   → 对指定 URL 截图,返回 base64 + 元数据
- POST /api/screenshot/probe   → 探测 URL 是否可 iframe 嵌入
"""

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..services.screenshot_service import probe_can_embed, take_screenshot

router = APIRouter()


class TakeScreenshotRequest(BaseModel):
    """截图请求(契约与 packages/types ScreenshotRequest 一致)。"""

    url: str = Field(..., description="目标 URL")
    width: int = Field(1280, description="视口宽度")
    height: int = Field(720, description="视口高度")
    full_page: bool = Field(False, description="是否全页面截图")
    wait_until: str = Field(
        "load",
        description="等待策略: none/dom/load/networkidle",
    )
    timeout: int = Field(15000, description="超时 ms")


class ProbeEmbedRequest(BaseModel):
    """URL 嵌入探测请求。"""

    url: str = Field(..., description="目标 URL")


@router.post("/screenshot/take")
async def screenshot_take(req: TakeScreenshotRequest) -> dict[str, Any]:
    """对指定 URL 截图,返回 base64 + 元数据。

    返回格式与 ApiResponse 一致:`{ code, message, data }`。
    失败时 code != 0,message 含错误描述。
    """
    try:
        result = await take_screenshot(
            req.url,
            width=req.width,
            height=req.height,
            full_page=req.full_page,
            wait_until=req.wait_until,
            timeout=req.timeout,
        )
        return {"code": 0, "message": "success", "data": result}
    except Exception as e:
        err_type = type(e).__name__
        return {
            "code": 1,
            "message": f"截图失败: {err_type}: {str(e)[:200]}",
            "data": None,
        }


@router.post("/screenshot/probe")
async def screenshot_probe(req: ProbeEmbedRequest) -> dict[str, Any]:
    """探测 URL 是否可 iframe 嵌入(检查响应头 X-Frame-Options / CSP frame-ancestors)。

    复用截图引擎的 probe 逻辑,但不实际截图(更快)。
    """
    try:
        result = await probe_can_embed(req.url)
        return {"code": 0, "message": "success", "data": result}
    except Exception as e:
        err_type = type(e).__name__
        return {
            "code": 1,
            "message": f"探测失败: {err_type}: {str(e)[:200]}",
            "data": None,
        }
