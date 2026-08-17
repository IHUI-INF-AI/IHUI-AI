"""外部 Chrome CDP 导入登录 Cookie API 路由(2026-08-17 新增)。

端点:
- POST /browser/import-chrome   从外部 Google Chrome CDP 调试端口导入登录 Cookie

流程:桌面端弹出用户自己的 Chrome(--app=<登录页> --remote-debugging-port=<端口> --user-data-dir=<临时目录>),
用户扫码/登录完成后前端轮询本端点 → 后端经 CDP 提取 Cookie → 检测 success_cookies 命中 → 加密保存账号。
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ..core.jwt_auth import get_current_user_id
from ..services.chrome_import import import_chrome_cookies

router = APIRouter(prefix="/browser", tags=["browser-chrome-import"])


class ImportChromeRequest(BaseModel):
    port: int = Field(..., description="外部 Chrome 的 CDP 调试端口", ge=1024, le=65535)
    platform: str = Field(..., description="平台 ID,如 zhihu / bilibili")


@router.post("/import-chrome")
async def import_chrome(
    body: ImportChromeRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """从外部 Chrome CDP 调试端口提取 Cookie、检测登录、自动保存账号。

    平台不支持/连接异常时仍返回 code=0,由 data.error 携带错误信息
    (与 detect-from-cdp 行为一致,前端靠 data.error 判断),不抛 HTTPException。
    """
    result = await import_chrome_cookies(
        port=body.port,
        platform=body.platform,
        user_id=user_id,
    )
    return {"code": 0, "message": "ok", "data": result}
