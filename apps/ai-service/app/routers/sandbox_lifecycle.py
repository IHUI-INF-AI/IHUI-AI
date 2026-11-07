# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""沙箱生命周期 HTTP。

挂载：``app.include_router(..., prefix="/api")``，
路径为 ``/api/sandbox/instances``。

档位与网络不接受请求方自带（``extra=forbid``）。身份只用于归因，
角色闸与 ``/api/sandbox/run`` 相同：非管理员 403，且不创建沙箱。
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

from app.core.jwt_auth import get_current_user_id, resolve_request_role_id
from app.services.sandbox_lifecycle import (
    SandboxLifecycleError,
    get_store,
)

router = APIRouter(prefix="/sandbox/instances", tags=["sandbox-lifecycle"])
logger = logging.getLogger(__name__)


class _StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CreateInstanceBody(_StrictModel):
    timeout_s: int = Field(600, description="空闲秒数；-1 表示不自动暂停")
    files: dict[str, str] = Field(default_factory=dict)


class SnapshotRollbackBody(_StrictModel):
    snapshot_id: str = Field(..., min_length=1, max_length=80)


class CloneBody(_StrictModel):
    n: int = Field(1, ge=1, le=8)


class ExecBody(_StrictModel):
    command: str = Field(..., min_length=1, max_length=4000)
    timeout: int = Field(60, ge=1, le=60)
    env: dict[str, str] = Field(default_factory=dict)


class WriteFileBody(_StrictModel):
    path: str = Field(..., min_length=1, max_length=240)
    content: str = ""


class TimeoutBody(_StrictModel):
    timeout_s: int


def _admin_or_403(request: Request, user_id: str) -> None:
    if resolve_request_role_id(request) < 1:
        logger.warning("sandbox lifecycle 被拒(非管理员) actor=%s", user_id)
        raise HTTPException(status_code=403, detail="沙箱生命周期仅管理员可用")


def _raise_http(exc: SandboxLifecycleError) -> None:
    raise HTTPException(
        status_code=exc.status,
        detail={"code": exc.code, "message": str(exc)},
    ) from None


@router.post("")
def create_instance(
    body: CreateInstanceBody,
    request: Request,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    _admin_or_403(request, user_id)
    try:
        info = get_store().create(timeout_s=body.timeout_s, files=body.files)
    except SandboxLifecycleError as exc:
        _raise_http(exc)
    logger.info("sandbox create actor=%s id=%s", user_id, info.sandbox_id)
    return {"code": 0, "message": "ok", "data": info.as_dict()}


@router.get("/{sandbox_id}")
def get_instance(
    sandbox_id: str,
    request: Request,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    _admin_or_403(request, user_id)
    try:
        info = get_store().get(sandbox_id)
    except SandboxLifecycleError as exc:
        _raise_http(exc)
    return {"code": 0, "message": "ok", "data": info.as_dict()}


@router.post("/{sandbox_id}/pause")
def pause_instance(
    sandbox_id: str,
    request: Request,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    _admin_or_403(request, user_id)
    try:
        info = get_store().pause(sandbox_id)
    except SandboxLifecycleError as exc:
        _raise_http(exc)
    return {"code": 0, "message": "ok", "data": info.as_dict()}


@router.post("/{sandbox_id}/resume")
def resume_instance(
    sandbox_id: str,
    request: Request,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    _admin_or_403(request, user_id)
    try:
        info = get_store().resume(sandbox_id)
    except SandboxLifecycleError as exc:
        _raise_http(exc)
    return {"code": 0, "message": "ok", "data": info.as_dict()}


@router.delete("/{sandbox_id}")
def kill_instance(
    sandbox_id: str,
    request: Request,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    _admin_or_403(request, user_id)
    try:
        get_store().kill(sandbox_id)
    except SandboxLifecycleError as exc:
        _raise_http(exc)
    return {"code": 0, "message": "ok", "data": {"sandbox_id": sandbox_id, "state": "killed"}}


@router.post("/{sandbox_id}/timeout")
def set_instance_timeout(
    sandbox_id: str,
    body: TimeoutBody,
    request: Request,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    _admin_or_403(request, user_id)
    try:
        info = get_store().set_timeout(sandbox_id, body.timeout_s)
    except SandboxLifecycleError as exc:
        _raise_http(exc)
    return {"code": 0, "message": "ok", "data": info.as_dict()}


@router.post("/{sandbox_id}/snapshots")
def create_snapshot(
    sandbox_id: str,
    request: Request,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    _admin_or_403(request, user_id)
    try:
        info = get_store().snapshot(sandbox_id)
    except SandboxLifecycleError as exc:
        _raise_http(exc)
    return {"code": 0, "message": "ok", "data": info.as_dict()}


@router.get("/{sandbox_id}/snapshots")
def list_instance_snapshots(
    sandbox_id: str,
    request: Request,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    _admin_or_403(request, user_id)
    try:
        rows = get_store().list_snapshots(sandbox_id)
    except SandboxLifecycleError as exc:
        _raise_http(exc)
    return {
        "code": 0,
        "message": "ok",
        "data": {"snapshots": [item.as_dict() for item in rows]},
    }


@router.delete("/{sandbox_id}/snapshots/{snapshot_id}")
def delete_instance_snapshot(
    sandbox_id: str,
    snapshot_id: str,
    request: Request,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    _admin_or_403(request, user_id)
    try:
        rows = get_store().list_snapshots(sandbox_id)
        if all(item.snapshot_id != snapshot_id for item in rows):
            raise SandboxLifecycleError("snapshot_not_found", "快照不存在", 404)
        get_store().delete_snapshot(snapshot_id)
    except SandboxLifecycleError as exc:
        _raise_http(exc)
    return {"code": 0, "message": "ok", "data": {"snapshot_id": snapshot_id}}


@router.post("/{sandbox_id}/rollback")
def rollback_instance(
    sandbox_id: str,
    body: SnapshotRollbackBody,
    request: Request,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    _admin_or_403(request, user_id)
    try:
        info = get_store().rollback(sandbox_id, body.snapshot_id)
    except SandboxLifecycleError as exc:
        _raise_http(exc)
    return {"code": 0, "message": "ok", "data": info.as_dict()}


@router.post("/{sandbox_id}/clone")
def clone_instance(
    sandbox_id: str,
    body: CloneBody,
    request: Request,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    _admin_or_403(request, user_id)
    try:
        clones = get_store().clone(sandbox_id, body.n)
    except SandboxLifecycleError as exc:
        _raise_http(exc)
    return {"code": 0, "message": "ok", "data": {"clones": [item.as_dict() for item in clones]}}


@router.post("/{sandbox_id}/files")
def write_instance_file(
    sandbox_id: str,
    body: WriteFileBody,
    request: Request,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    _admin_or_403(request, user_id)
    try:
        get_store().write_file(sandbox_id, body.path, body.content)
    except SandboxLifecycleError as exc:
        _raise_http(exc)
    return {"code": 0, "message": "ok", "data": {"path": body.path}}


@router.get("/{sandbox_id}/files")
def read_instance_file(
    sandbox_id: str,
    path: str,
    request: Request,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    _admin_or_403(request, user_id)
    try:
        content = get_store().read_file(sandbox_id, path)
    except SandboxLifecycleError as exc:
        _raise_http(exc)
    return {"code": 0, "message": "ok", "data": {"path": path, "content": content}}


@router.post("/{sandbox_id}/exec")
async def exec_instance(
    sandbox_id: str,
    body: ExecBody,
    request: Request,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    _admin_or_403(request, user_id)
    try:
        result, dropped = await get_store().exec(
            sandbox_id,
            body.command,
            env=body.env,
            timeout=body.timeout,
        )
    except SandboxLifecycleError as exc:
        _raise_http(exc)
    logger.info(
        "sandbox exec actor=%s id=%s exit=%s dropped_env=%s",
        user_id,
        sandbox_id,
        result.exit_code,
        sorted(dropped),
    )
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "exit_code": result.exit_code,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "timed_out": result.timed_out,
            "backend": result.backend,
            "dropped_env_keys": dropped,
        },
    }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
