# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D31 设计稿转码路由(2026-09-26 立)。

- POST /api/figma/import {fileKey, nodeId, target} → {code, language, irSummary, warnings, degraded}

鉴权与仓库其他 router 一致(JWTAuthMiddleware 注入 request.state.user_id,
get_current_user_id_sync 读取;web 侧 /api/figma/* rewrite 直连 8803)。
服务层错误(FigmaImportError.code)映射为 HTTP 状态码 + {code, message} detail,
不暴露内部堆栈。挂载方式见 main.py(include_router prefix="/api")。
"""

from __future__ import annotations

import logging
from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from ..core.jwt_auth import require_request_user_id
from ..services.figma_importer import FigmaImportError

router = APIRouter(prefix="/figma", tags=["figma-import"])
logger = logging.getLogger(__name__)

# FigmaImportError.code → HTTP 状态码(确定性错误码,不猜)
_ERROR_STATUS = {
    "FIGMA_NOT_CONFIGURED": 503,
    "FIGMA_BAD_PARAM": 400,
    "FIGMA_BAD_TARGET": 400,
    "FIGMA_AUTH_FAILED": 502,
    "FIGMA_NODE_NOT_FOUND": 404,
    "FIGMA_FETCH_FAILED": 502,
    "FIGMA_API_ERROR": 502,
}


class FigmaImportRequest(BaseModel):
    """设计稿转码请求体。"""

    fileKey: str = Field(..., min_length=1, max_length=128, description="Figma 文件 key")
    nodeId: str = Field(..., min_length=1, max_length=128, description="Figma 节点 id(如 1:2)")
    target: Literal["react", "taro"] = Field("react", description="产物目标: react | taro")


async def _run_import(file_key: str, node_id: str, target: str) -> dict[str, Any]:
    """管线编排(惰性导入服务层,便于测试注入/替换)。"""
    from ..services.figma_importer import FigmaImporter

    importer = FigmaImporter()
    return await importer.import_design(file_key, node_id, target)


@router.post("/import", response_model=dict[str, Any])
async def import_figma(request: Request, body: FigmaImportRequest) -> dict[str, Any]:
    """Figma Frame/组件 → 可运行前端代码(LLM 生成 + 确定性降级骨架)。"""
    user_id = await require_request_user_id(request)
    logger.info(
        "figma import requested user=%s file=%s node=%s target=%s",
        user_id,
        body.fileKey,
        body.nodeId,
        body.target,
    )
    try:
        result = await _run_import(body.fileKey, body.nodeId, body.target)
    except FigmaImportError as exc:
        status = _ERROR_STATUS.get(exc.code, 502)
        raise HTTPException(
            status_code=status, detail={"code": exc.code, "message": exc.message}
        ) from exc
    # 任务书契约:顶层 {code, language, irSummary, warnings, degraded}
    # (完整 IR 树保留在响应内供前端调试展示,体积可控)
    return {
        "code": result["code"],
        "language": result["language"],
        "irSummary": result["irSummary"],
        "ir": result["ir"],
        "warnings": result["warnings"],
        "degraded": result["degraded"],
    }


__all__ = ["router", "FigmaImportRequest"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
