# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Self-healing 引擎 HTTP 路由(把离线引擎接到 LLM + pytest)。

挂载 (app/main.py):
    app.include_router(self_healing.router, prefix="/api/v1", tags=["self-healing"])

端点:
- POST /api/v1/self-healing/run
    body: {"task": str, "target_path": str}
    - target_path 必须位于 MCP workspace 白名单内(防路径穿越)。
    - 受 AGENT_SELF_HEALING_ENABLED 开关门控;未开启返回明确 {code,message,data}
      (HTTP 200,绝不 500)。
    - 所有响应统一包 {code, message, data};非法路径也返回信封(不破坏契约)。

安全:heal 循环在 threadpool 执行(避免阻塞事件循环),runner 真实起 pytest
子进程并归因失败;LLM 生成/补丁失败时引擎优雅降级(不抛 500)。
"""

from __future__ import annotations

import logging
import os
from typing import Any

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from app.services.self_healing import heal
from app.services.self_healing_llm import (
    PytestSubprocessRunner,
    llm_gen_fn,
    llm_patch_and_apply,
)

router = APIRouter(prefix="/self-healing", tags=["self-healing"])
logger = logging.getLogger(__name__)

ENV_ENABLED = "AGENT_SELF_HEALING_ENABLED"


def is_self_healing_enabled() -> bool:
    """AGENT_SELF_HEALING_ENABLED 门控(惰性读 env,便于测试注入)。"""
    return os.environ.get(ENV_ENABLED, "").strip().lower() in ("1", "true", "yes", "on")


class SelfHealingRunRequest(BaseModel):
    """自愈运行请求体。"""

    task: str = Field(..., min_length=1, description="任务描述 / 待自愈目标")
    target_path: str = Field(
        ..., min_length=1, description="待测目录或文件(须在 workspace 白名单内)"
    )


def _validate_workspace(target_path: str) -> tuple[bool, str]:
    """校验 target_path 在 MCP 工作区白名单内(防 symlink 穿越)。

    Returns (True, resolved_path) 或 (False, error_message)。
    """
    from app.services.mcp_server import _validate_path_in_workspace

    ok, info = _validate_path_in_workspace(target_path)
    return bool(ok), str(info)


def _patch_adapter(task: Any, result: Any) -> dict[str, Any] | None:
    """heal 引擎的 patch_fn 契约是 (task, result_dict)。

    取 result 里第一条失败作为补丁上下文喂给 LLM;生成后落盘应用,
    任一环节失败返回 None(引擎优雅降级继续循环)。
    """
    failures = result.get("failures") if isinstance(result, dict) else None
    failure = failures[0] if failures else task
    return llm_patch_and_apply(failure, result)


@router.post("/run")
async def run_self_healing(body: SelfHealingRunRequest) -> Any:
    """执行自愈循环:生成用例 -> pytest 运行 -> LLM 补丁 -> 重跑。

    返回 {code, message, data},data 为 HealOutcome.to_dict()。
    """
    if not is_self_healing_enabled():
        return {
            "code": 1,
            "message": f"self-healing disabled (set {ENV_ENABLED}=true to enable)",
            "data": {"enabled": False},
        }

    ok, info = _validate_workspace(body.target_path)
    if not ok:
        return JSONResponse(
            status_code=400,
            content={"code": 400, "message": info, "data": None},
        )

    runner = PytestSubprocessRunner(info)
    outcome = await run_in_threadpool(
        heal,
        body.task,
        None,  # test_cases -> 由 gen_fn 生成
        gen_fn=llm_gen_fn,
        runner=runner,
        patch_fn=_patch_adapter,
    )
    return {"code": 0, "message": "ok", "data": outcome.to_dict()}


__all__ = ["router"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
