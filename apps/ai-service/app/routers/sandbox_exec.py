# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

"""OS 级沙箱执行 HTTP 路由(深度引擎接线,2026-09-06 立)。

挂载方式(main.py):
    app.include_router(sandbox_exec.router, prefix="/api", tags=["sandbox-exec"])

端点:
- POST /api/sandbox/run      → 按**服务端登记的策略档位**在沙箱后端内执行命令,
                               返回 ExecResult(含所用后端名 + 实际生效档位)。
- GET  /api/sandbox/backends → 后端探测矩阵(win_job / linux_bwrap / mac_seatbelt
                               各自可用性 + 当前平台默认后端 + 可点名的档位清单)。

策略来源(2026-09-30 G-258 B 组收口):修复前 ``policy`` 字段是"整份 SandboxPolicy
由请求方自带",而本服务模型里 ``readable_paths=[]`` 的语义是**不限制读**、
``restrict_token=False`` 的语义是**不收紧令牌** —— 于是调用方可以给自己签发最宽松档。
现在档位只能来自 ``app/services/os_sandbox.py`` 的登记表 ``SANDBOX_POLICY_TIERS``,
请求方最多在档位内**收窄**(timeout_s / memory_mb / cpu_seconds / max_processes /
denied_paths),提供任何一个限制开关字段或试图放宽上界 → 400;未点名档位 → 最严档。

错误映射:
- 策略非法(PolicyError,含未知档位/请求方自带限制项/限额非正或超档位上限)→ 400
- 命令路径越权(SandboxError)→ 403
- 平台/后端能力缺失(CapabilityMissingError)→ 400
"""

from __future__ import annotations

import logging
from dataclasses import asdict
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.jwt_auth import get_current_user_id
from app.services.os_sandbox import (
    BACKEND_LINUX_BWRAP,
    BACKEND_MAC_SEATBELT,
    BACKEND_WIN_JOB,
    DEFAULT_POLICY_TIER,
    SANDBOX_POLICY_TIERS,
    CapabilityMissingError,
    LinuxSandboxBackend,
    MacSeatbeltBackend,
    PolicyError,
    SandboxError,
    SandboxHandle,
    WinJobBackend,
    build_tier_policy,
    get_default_backend,
    resolve_policy_tier,
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
    """沙箱执行请求体。

    注意 ``policy`` 的语义已收窄为"档位内的收窄项":它不再是整份 SandboxPolicy,
    凡本模型未列出的字段(含可读/可写路径、网络、令牌降权、env 白名单)都由服务端
    档位决定,请求方提供了就被拒。
    """

    cmd: str | list[str] = Field(
        ..., description="命令:字符串(按平台 shlex 拆分)或 argv 数组"
    )
    tier: str | None = Field(
        None,
        description=(
            f"服务端登记的策略档位名,缺省 = 最严档 {DEFAULT_POLICY_TIER};"
            f"可选值见 GET /api/sandbox/backends 的 policy_tiers"
        ),
    )
    policy: dict[str, Any] = Field(
        default_factory=dict,
        description=(
            "只能收窄档位上界:timeout_s / memory_mb / cpu_seconds / "
            "max_processes / denied_paths;其余字段一律 400"
        ),
    )
    cwd: str = Field(".", description="子进程工作目录(必须落在档位可读根内)")
    env: dict[str, str] | None = Field(None, description="追加环境变量(仍受白名单裁剪)")
    backend: str | None = Field(None, description="指定沙箱后端;缺省用平台默认后端")


def _workspace_roots() -> list[str]:
    """档位的路径集合来源 —— 唯一实现 ``mcp_server._get_workspace_roots()``。

    与 app/routers/patch.py 的 ``_allowed_workspace_roots`` 读的是同一个配置键
    (MCP_WORKSPACE_ROOTS),两处的**判据**不同(patch 判"root 是否在集合内",
    这里判"沙箱能读哪些目录"),但取源只有一份实现,取不到即 fail-closed。
    """
    try:
        from app.services.mcp_server import _get_workspace_roots

        roots = _get_workspace_roots()
    except Exception as e:  # pragma: no cover - 依赖面故障
        logger.error("sandbox: 无法确定服务端工作区根目录,已拒绝: %s", e, exc_info=True)
        raise HTTPException(
            status_code=503, detail="无法确定沙箱的允许根目录,命令执行已被拒绝"
        ) from None
    if not roots:
        raise HTTPException(
            status_code=503, detail="服务端未登记任何沙箱工作区根目录,命令执行已被拒绝"
        )
    return [str(Path(r).resolve(strict=False)) for r in roots]


@router.post("/run")
def sandbox_run(
    body: SandboxRunRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """在 OS 沙箱内执行命令,返回 ExecResult + 所用后端 + 实际生效档位。

    ``user_id`` 是承载层注入的已验证身份,只用于**归因**(谁在服务器上起了子进程、
    谁试图自带宽松策略),不参与档位判定 —— 档位的授予源在本仓尚不存在(见交付报告)。
    """
    actor = user_id
    roots = _workspace_roots()
    try:
        tier = resolve_policy_tier(body.tier)
        policy = build_tier_policy(tier, roots, body.policy)
    except PolicyError as e:
        logger.warning(
            "sandbox 策略被拒 actor=%s tier=%s keys=%s reason=%s",
            actor, body.tier, sorted(body.policy), e,
        )
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
        logger.warning(
            "sandbox 执行被拒 actor=%s tier=%s reason=%s", actor, tier.name, str(e)
        )
        raise HTTPException(status_code=403, detail=str(e)) from None

    logger.info(
        "sandbox run actor=%s tier=%s backend=%s rc=%s timed_out=%s cmd=%s",
        actor, tier.name,
        result.backend, result.returncode, result.timed_out, result.cmd,
    )
    payload = asdict(result)
    payload["ok"] = result.ok
    payload["tier"] = tier.name
    return {"code": 0, "message": "ok", "data": payload}


@router.get("/backends")
def sandbox_backends(
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """后端探测矩阵 + **服务端登记的档位清单**(请求方按此点名,不能自带策略)。"""
    actor = user_id
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
    # 档位视图是登记表的**投影**(不是第二份名单):新增档位自动出现在这里,
    # 也不会出现登记表里没有的名字。
    tiers = [
        {
            "name": tier.name,
            "is_default": tier.name == DEFAULT_POLICY_TIER,
            "writable": tier.writable,
            "allow_network": tier.allow_network,
            "restrict_token": tier.restrict_token,
            "limits": {
                "timeout_s": tier.timeout_s,
                "memory_mb": tier.memory_mb,
                "cpu_seconds": tier.cpu_seconds,
                "max_processes": tier.max_processes,
            },
        }
        for tier in SANDBOX_POLICY_TIERS.values()
    ]
    logger.info("sandbox backends 探测 actor=%s", actor)
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "platform_default": default_backend,
            "backends": matrix,
            "policy_tiers": tiers,
        },
    }


__all__ = ["router"]
