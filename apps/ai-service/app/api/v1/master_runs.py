# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""总管运行控制 HTTP 面：把 agent_ops 的 pause/resume/talk 暴露为同源 API。

为什么要有这一层：
    pause/resume/talk 原本只存在于 master 的 LLM 工具调用里。Web 控制台或其它
    服务要操作一个已知 runId 时，不该再绕一圈让模型“理解意图再调工具”——
    控制动作是确定性的，直接提供显式端点，模型与 UI 共用同一套 AgentOpsTool，
    不产生第二条执行语义。

鉴权：
    只认请求 principal（JWT/cookie），不接受 body 自报 user_id；AgentOpsTool
    继续按 principal 做 run 属主校验。
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from ...core.jwt_auth import DEV_ANONYMOUS_PRINCIPAL, require_request_user_id
from ...services.master_tools.ops import agent_ops_tool

router = APIRouter()


class RunTalkRequest(BaseModel):
    """向正在跑的 run 注入一条中途提示。"""

    message: str = Field(..., min_length=1, max_length=8000)


def _status_for_error(code: str) -> int:
    if code in {"AGENT_RUN_ID_REQUIRED", "AGENT_RUN_SESSION_MISSING"}:
        return 400
    if code == "AGENT_RUN_NOT_FOUND":
        return 404
    if code == "STORAGE_UNAVAILABLE":
        return 503
    return 409


async def _handle_run_action(
    request: Request,
    run_id: str,
    action: str,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    principal = await require_request_user_id(request)
    user_id = "" if principal == DEV_ANONYMOUS_PRINCIPAL else principal
    arguments = {"action": action, "runId": run_id, **(extra or {})}
    result = await agent_ops_tool.handle(arguments, user_id=user_id)
    if not result.get("ok"):
        error = result.get("error") if isinstance(result.get("error"), dict) else {}
        code = str(error.get("code") or "AGENT_RUN_CONTROL_FAILED")
        raise HTTPException(
            status_code=_status_for_error(code),
            detail={"code": code, "message": str(error.get("message") or code)},
        )
    return {"code": 0, "message": "ok", "data": result.get("data")}


@router.post("/runs/{run_id}/pause")
async def pause_run(run_id: str, request: Request) -> dict[str, Any]:
    return await _handle_run_action(request, run_id, "run_pause")


@router.post("/runs/{run_id}/resume")
async def resume_run(run_id: str, request: Request) -> dict[str, Any]:
    return await _handle_run_action(request, run_id, "run_resume")


@router.post("/runs/{run_id}/talk")
async def talk_run(
    run_id: str, body: RunTalkRequest, request: Request
) -> dict[str, Any]:
    return await _handle_run_action(
        request, run_id, "run_talk", {"message": body.message}
    )


@router.post("/runs/{run_id}/stop")
async def stop_run(run_id: str, request: Request) -> dict[str, Any]:
    return await _handle_run_action(request, run_id, "run_stop")
