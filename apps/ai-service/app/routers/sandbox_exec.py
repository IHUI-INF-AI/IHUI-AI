# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""OS 级沙箱执行 HTTP 路由(深度引擎接线,2026-09-06 立)。

挂载方式(main.py):
    app.include_router(sandbox_exec.router, prefix="/api", tags=["sandbox-exec"])

端点:
- POST /api/sandbox/run      → 按 SandboxPolicy 在沙箱后端内执行命令,
                               返回 ExecResult(含所用后端名)。
- GET  /api/sandbox/backends → 后端探测矩阵(win_job / linux_bwrap / mac_seatbelt
                               各自可用性 + 当前平台默认后端)。

错误映射:
- 策略非法(PolicyError,含未知字段/限额非正/write⊄read)→ 400
- 命令路径越权(SandboxError)→ 403
- 平台/后端能力缺失(CapabilityMissingError)→ 400
"""

from __future__ import annotations

import logging
from dataclasses import asdict
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.jwt_auth import get_current_user_id
from app.services.os_sandbox import (
    BACKEND_LINUX_BWRAP,
    BACKEND_MAC_SEATBELT,
    BACKEND_WIN_JOB,
    CapabilityMissingError,
    LinuxSandboxBackend,
    MacSeatbeltBackend,
    PolicyError,
    SandboxError,
    SandboxHandle,
    SandboxPolicy,
    WinJobBackend,
    get_default_backend,
)

router = APIRouter(prefix="/sandbox", tags=["sandbox-exec"])
logger = logging.getLogger(__name__)

#: 后端名 → 实现类(探测矩阵用;实例化不触发平台检查,check_available 才触发)
_BACKEND_IMPLS: dict[str, Any] = {
    BACKEND_WIN_JOB: WinJobBackend,
    BACKEND_LINUX_BWRAP: LinuxSandboxBackend,
    BACKEND_MAC_SEATBELT: MacSeatbeltBackend,
}


class SandboxRunRequest(BaseModel):
    """沙箱执行请求体。"""

    cmd: str | list[str] = Field(
        ..., description="命令:字符串(按平台 shlex 拆分)或 argv 数组"
    )
    policy: dict[str, Any] = Field(
        default_factory=dict,
        description="SandboxPolicy 字段 dict(空 = 全默认策略)",
    )
    cwd: str = Field(".", description="子进程工作目录")
    env: dict[str, str] | None = Field(None, description="追加环境变量(仍受白名单裁剪)")
    backend: str | None = Field(None, description="指定沙箱后端;缺省用平台默认后端")


@router.post("/run")
def sandbox_run(
    body: SandboxRunRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """在 OS 沙箱内执行命令,返回 ExecResult + 所用后端。"""
    try:
        policy = SandboxPolicy.from_dict(body.policy)
    except PolicyError as e:
        raise HTTPException(status_code=400, detail=f"策略非法: {e}") from None

    # str 交给 SandboxHandle 按平台 shlex 拆分;list 原样透传
    try:
        handle = SandboxHandle(policy, backend=body.backend)
        result = handle.run(body.cmd, cwd=body.cwd, env=body.env)
    except PolicyError as e:
        raise HTTPException(status_code=400, detail=f"策略非法: {e}") from None
    except CapabilityMissingError as e:
        raise HTTPException(status_code=400, detail=str(e)) from None
    except SandboxError as e:
        # 路径越权 / argv 为空等执行前拒绝:与鉴权同级语义,用 403
        raise HTTPException(status_code=403, detail=str(e)) from None

    logger.info(
        "sandbox run backend=%s rc=%s timed_out=%s cmd=%s",
        result.backend, result.returncode, result.timed_out, result.cmd,
    )
    payload = asdict(result)
    payload["ok"] = result.ok
    return {"code": 0, "message": "ok", "data": payload}


@router.get("/backends")
def sandbox_backends(
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """后端探测矩阵:各沙箱后端在当前平台的可用性与默认后端。"""
    try:
        default_backend = get_default_backend()
    except CapabilityMissingError:
        default_backend = ""
    matrix: list[dict[str, Any]] = []
    for name, impl in _BACKEND_IMPLS.items():
        reason = ""
        available = False
        try:
            impl.check_available()
            available = True
        except CapabilityMissingError as e:
            reason = str(e)
        matrix.append(
            {
                "backend": name,
                "available": available,
                "is_default": name == default_backend,
                "reason": reason,
            }
        )
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "platform_default": default_backend,
            "backends": matrix,
        },
    }


__all__ = ["router"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
