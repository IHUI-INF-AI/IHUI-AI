# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Codex 风格补丁引擎 HTTP 路由(深度引擎接线,2026-09-06 立)。

挂载方式(main.py):
    app.include_router(patch.router, prefix="/api", tags=["patch"])

端点:
- POST /api/patch/preview → dry_run 预览:只做匹配计算与语法校验,不写盘。
- POST /api/patch/apply   → 事务性应用:多文件全成或全回滚。

安全:
- workspace root 必须显式传入且为绝对路径、真实存在的目录(引擎自身再做
  一次 root 越界防护,补丁声明的路径不得逃逸 root);
- 引擎的 PatchError(解析/匹配/校验/越界)统一折算为 ok=False + error 文本
  (HTTP 仍 200,便于调用方读取结构化失败原因);非法 root 参数 → 400。
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.jwt_auth import get_current_user_id
from app.services.patch_engine import apply_patch

router = APIRouter(prefix="/patch", tags=["patch"])
logger = logging.getLogger(__name__)


class PatchRequest(BaseModel):
    """补丁预览/应用请求体。"""

    patch: str = Field(..., min_length=1, description="Codex 风格补丁文本(Begin/End Patch)")
    root: str = Field(
        ...,
        min_length=1,
        description="workspace root 绝对路径;补丁内所有路径以此为基准且不得越界",
    )


def _validated_root(raw: str) -> Path:
    """校验 workspace root:必须为绝对路径且是真实存在的目录,否则 400。"""
    root = Path(raw)
    if not root.is_absolute():
        raise HTTPException(status_code=400, detail="root 必须是绝对路径")
    if not root.is_dir():
        raise HTTPException(status_code=400, detail=f"root 目录不存在: {raw}")
    return root


def _run(body: PatchRequest, *, dry_run: bool) -> dict[str, Any]:
    """执行补丁引擎并包装为统一响应信封 {code, message, data}。"""
    root = _validated_root(body.root)
    result = apply_patch(body.patch, root, dry_run=dry_run)
    payload = result.to_dict()
    if not result.ok:
        logger.info(
            "patch %s 失败 root=%s error=%s",
            "preview" if dry_run else "apply", root, result.error,
        )
    return {
        "code": 0,
        "message": "ok" if result.ok else "补丁未通过,详见 data.error",
        "data": payload,
    }


@router.post("/preview")
def preview_patch(
    body: PatchRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """dry_run 预览补丁:返回逐文件 hunk 匹配策略/置信度,不落盘。"""
    return _run(body, dry_run=True)


@router.post("/apply")
def apply_patch_endpoint(
    body: PatchRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """事务性应用补丁:任一文件失败则整批回滚;越界路径直接拒绝。"""
    return _run(body, dry_run=False)


__all__ = ["router"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
