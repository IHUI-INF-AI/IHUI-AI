# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""外部 Chrome CDP 导入登录 Cookie API 路由(2026-08-17 新增)。

端点:
- POST /publish/browser/launch-chrome  为平台拉起带 CDP 调试端口的 Chrome/Edge 并打开登录页(2026-09-30)
- POST /publish/browser/import-chrome   从外部 Google Chrome CDP 调试端口导入登录 Cookie

注:前缀刻意取 /publish/browser(2026-09-30 从 /browser 迁来)——api(8802) 代理层
proxyToAiService 统一拼 /api/publish 前缀,两端口径必须一致,否则代理 404。

流程:前端先调 launch-chrome 拿到 port → 浏览器窗口自动打开平台登录页,用户在其中
登录 → 前端轮询 import-chrome(port+platform) → 后端经 CDP 提取 Cookie → 检测
success_cookies 命中 → 加密保存账号。
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ..core.jwt_auth import get_current_user_id
from ..services.chrome_import import import_chrome_cookies, launch_chrome_for_import

router = APIRouter(prefix="/publish/browser", tags=["browser-chrome-import"])


class ImportChromeRequest(BaseModel):
    port: int = Field(..., description="外部 Chrome 的 CDP 调试端口", ge=1024, le=65535)
    platform: str = Field(..., description="平台 ID,如 zhihu / bilibili")


class LaunchChromeRequest(BaseModel):
    platform: str = Field(..., description="平台 ID,如 zhihu / bilibili")


@router.post("/launch-chrome")
async def launch_chrome(
    body: LaunchChromeRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """为本平台拉起一个带 CDP 调试端口的浏览器窗口并打开登录页。

    端口由后端向 OS 随机申请,profile 为一次性临时目录(规避 Chrome 136+ 默认
    profile 的 CDP 封禁与运行中单例锁)。失败同样返回 code=0,由 data.error 携带
    原因(与 import-chrome 行为一致,前端靠 data.error 判断)。
    """
    result = await launch_chrome_for_import(platform=body.platform)
    return {"code": 0, "message": "ok", "data": result}


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
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
