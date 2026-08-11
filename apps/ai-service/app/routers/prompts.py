"""Prompt 管理路由(7 端点)。

提供 Prompt 注册表的 CRUD + 版本管理 + 回滚 API。
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..services.prompt_registry import prompt_registry

router = APIRouter()


# ---------------------------------------------------------------------------
# 请求/响应模型
# ---------------------------------------------------------------------------


class CreatePromptRequest(BaseModel):
    name: str = Field(..., min_length=1, description="Prompt 名称")
    content: str = Field(..., min_length=1, description="Prompt 内容")
    description: str = Field("", description="Prompt 描述")


class UpdatePromptRequest(BaseModel):
    content: str = Field(..., min_length=1, description="Prompt 内容(新版本)")
    description: str = Field("", description="Prompt 描述(可选)")


class RollbackRequest(BaseModel):
    target_version: int = Field(..., ge=1, description="目标版本号")


# ---------------------------------------------------------------------------
# 端点
# ---------------------------------------------------------------------------


@router.get("/prompts", summary="列出所有 prompt")
async def list_prompts() -> dict[str, Any]:
    """列出所有已注册的 prompt 及其版本信息。"""
    return {"code": 0, "message": "success", "data": prompt_registry.list_prompts()}


@router.get("/prompts/{name}", summary="获取 prompt 详情(含版本列表)")
async def get_prompt(name: str) -> dict[str, Any]:
    """获取指定 prompt 的详情，包含所有版本信息。"""
    entry = prompt_registry._prompts.get(name)  # type: ignore[attr-defined]
    if not entry:
        raise HTTPException(status_code=404, detail=f"Prompt 不存在: {name}")
    return {
        "code": 0,
        "message": "success",
        "data": {
            "name": entry.name,
            "description": entry.description,
            "latest_version": entry.latest_version,
            "versions": [
                {
                    "version": v.version,
                    "content": v.content,
                    "description": v.description,
                    "created_at": v.created_at,
                }
                for v in entry.versions
            ],
            "created_at": entry.created_at,
            "updated_at": entry.updated_at,
        },
    }


@router.get("/prompts/{name}/content", summary="获取 prompt 内容")
async def get_prompt_content(name: str, version: int | None = None) -> dict[str, Any]:
    """获取指定 prompt 的内容，可指定版本。"""
    content = prompt_registry.get(name, version=version)
    if content is None:
        if version is not None:
            raise HTTPException(
                status_code=404,
                detail=f"Prompt 不存在或版本 {version} 不存在: {name}",
            )
        raise HTTPException(status_code=404, detail=f"Prompt 不存在: {name}")
    return {
        "code": 0,
        "message": "success",
        "data": {
            "name": name,
            "version": version or prompt_registry._prompts[name].latest_version,  # type: ignore[attr-defined]
            "content": content,
        },
    }


@router.post("/prompts", summary="创建新 prompt", status_code=201)
async def create_prompt(req: CreatePromptRequest) -> dict[str, Any]:
    """创建新 prompt。"""
    if prompt_registry._prompts.get(req.name):  # type: ignore[attr-defined]
        raise HTTPException(status_code=409, detail=f"Prompt 已存在: {req.name}")
    entry = prompt_registry.create(req.name, req.content, req.description)
    return {
        "code": 0,
        "message": "success",
        "data": {
            "name": entry.name,
            "description": entry.description,
            "latest_version": entry.latest_version,
            "created_at": entry.created_at,
        },
    }


@router.put("/prompts/{name}", summary="更新 prompt(创建新版本)")
async def update_prompt(name: str, req: UpdatePromptRequest) -> dict[str, Any]:
    """更新 prompt，创建新版本。"""
    if not prompt_registry._prompts.get(name):  # type: ignore[attr-defined]
        raise HTTPException(status_code=404, detail=f"Prompt 不存在: {name}")
    entry = prompt_registry.update(name, req.content, req.description)
    return {
        "code": 0,
        "message": "success",
        "data": {
            "name": entry.name,
            "latest_version": entry.latest_version,
            "updated_at": entry.updated_at,
        },
    }


@router.post("/prompts/{name}/rollback", summary="回滚到指定版本")
async def rollback_prompt(name: str, req: RollbackRequest) -> dict[str, Any]:
    """回滚 prompt 到指定版本(创建新版本，内容为目标版本)。"""
    if not prompt_registry._prompts.get(name):  # type: ignore[attr-defined]
        raise HTTPException(status_code=404, detail=f"Prompt 不存在: {name}")
    try:
        entry = prompt_registry.rollback(name, req.target_version)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {
        "code": 0,
        "message": "success",
        "data": {
            "name": entry.name,
            "latest_version": entry.latest_version,
            "rollback_to_version": req.target_version,
            "updated_at": entry.updated_at,
        },
    }


@router.delete("/prompts/{name}", summary="删除 prompt")
async def delete_prompt(name: str) -> dict[str, Any]:
    """删除指定 prompt。"""
    ok = prompt_registry.delete(name)
    if not ok:
        raise HTTPException(status_code=404, detail=f"Prompt 不存在: {name}")
    return {"code": 0, "message": "success", "data": {"deleted": True, "name": name}}