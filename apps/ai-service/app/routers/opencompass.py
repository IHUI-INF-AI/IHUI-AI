"""OpenCompass 排行榜抓取路由(2026-07-22 新增)。

端点:
- POST /api/opencompass/scrape → 用 Playwright 渲染抓取 OpenCompass 排行榜

供 apps/api 的 ai-world-sync.ts fetchOpenCompass 调用。
OpenCompass 是 Vue SPA,后端 API 受 nginx WAF 保护,只能 headless 渲染抓取。
"""

from typing import Any

from fastapi import APIRouter

from ..services.opencompass_scrape import scrape_opencompass

router = APIRouter()


@router.post("/opencompass/scrape")
async def opencompass_scrape() -> dict[str, Any]:
    """抓取 OpenCompass 排行榜,返回结构化 entries 列表。

    返回格式与 ApiResponse 一致:`{ code, message, data }`。
    失败时 code != 0,message 含错误描述,调用方降级返回空数组。
    """
    try:
        result = await scrape_opencompass()
        return {"code": 0, "message": "success", "data": result}
    except Exception as e:
        err_type = type(e).__name__
        return {
            "code": 1,
            "message": f"OpenCompass 抓取失败: {err_type}: {str(e)[:200]}",
            "data": None,
        }
