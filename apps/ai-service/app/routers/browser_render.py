"""通用网页渲染抓取路由(2026-09-05 新增)。

端点:
- POST /api/browser/render  body: {"url": str, "timeoutMs"?: int}
  → Playwright 渲染后返回 {url, final_url, http_status, title, html, captured_at}

供 apps/api 的 ai-world-sync fetchSiteMeta 在直接抓取 403(Cloudflare 挑战类)
或失败时兜底调用,与 /api/opencompass/scrape 同款 ApiResponse 形状。
"""

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..services.browser_render import render_page

router = APIRouter()


class BrowserRenderRequest(BaseModel):
    url: str = Field(..., min_length=8)
    timeoutMs: int = Field(30000, ge=5000, le=60000)


@router.post("/browser/render")
async def browser_render(req: BrowserRenderRequest) -> dict[str, Any]:
    """渲染目标页面并返回 HTML。失败时 code != 0,调用方降级。"""
    url = req.url.strip()
    if not url.startswith(("http://", "https://")):
        return {"code": 1, "message": "url must start with http(s)://", "data": None}
    try:
        result = await render_page(url, req.timeoutMs)
        return {"code": 0, "message": "success", "data": result}
    except Exception as e:
        return {
            "code": 1,
            "message": f"render failed: {type(e).__name__}: {str(e)[:200]}",
            "data": None,
        }
