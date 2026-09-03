# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""P0-7 云托管 Agent 会话历史路由(对标 OpenAI Codex Cloud)。

挂载说明:本模块仅导出 `router: APIRouter`(prefix="/cloud-runs"),由 master 在
main.py 以 `app.include_router(cloud_runs.router, prefix="/api", tags=["cloud-runs"])`
方式挂载,最终端点路径:
  GET /api/cloud-runs            → 历史运行列表(分页,可选 status 过滤)
  GET /api/cloud-runs/{run_id}   → 单条运行详情(含最终输出/状态/起止时间)

存储:复用 cloud_run_store(进程内 dict + data/cloud_runs.json 文件持久化)。
认证:与 research.py 一致,复用 get_current_user_id(云会话历史仅登录用户可见)。
响应统一信封 {code:0,message:data},对齐前端 api-client(api-client 以 code===0 判定成功)。
"""

from __future__ import annotations

from typing import Any

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..core.jwt_auth import get_current_user_id
from ..services.cloud_run_store import cloud_run_store

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cloud-runs", tags=["cloud-runs"])

# 列表视图输出摘要的最大长度(不携带完整 output,减小载荷)
_SUMMARY_LEN = 200


# P0-7 写入口(POST/PATCH):供 CLI 侧 agent 运行前后把记录写入云会话存储,补全端闭环
# (此前仅 web 的 HTTP streaming 路径在 ai-service 进程内落盘)。鉴权与读端点一致
# (get_current_user_id,JWT)。CLI 携带 Authorization: Bearer <登录 token> 调用。
class RunStartRequest(BaseModel):
    run_id: str | None = None
    task: str = ""
    agent_type: str = "loop_v2"
    session_alias: str = ""


class RunCompleteRequest(BaseModel):
    status: str = "done"
    output: str = ""
    error: str = ""


@router.post("/run")
async def create_cloud_run(
    req: RunStartRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """创建一次云运行记录(状态 running)。CLI 在 agent 启动前调用。"""
    run = cloud_run_store.start(
        req.task,
        run_id=req.run_id,
        agent_type=req.agent_type,
        session_alias=req.session_alias,
        user_id=user_id,
    )
    logger.info("cloud-runs start run=%s user=%s status=%s", run.run_id, user_id, run.status)
    return {"code": 0, "message": "ok", "data": run.to_dict()}


@router.patch("/run/{run_id}")
async def complete_cloud_run(
    run_id: str,
    req: RunCompleteRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """结束一次云运行记录(状态 done/error,含最终输出/错误)。幂等;不存在返回 404。"""
    run = cloud_run_store.complete(run_id, status=req.status, output=req.output, error=req.error)
    if not run:
        raise HTTPException(status_code=404, detail=f"运行记录不存在: {run_id}")
    logger.info(
        "cloud-runs complete run=%s user=%s status=%s", run_id, user_id, run.status
    )
    return {"code": 0, "message": "ok", "data": run.to_dict()}


@router.get("")
async def list_cloud_runs(
    page: int = 1,
    page_size: int = 20,
    status: str | None = None,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """云托管运行历史列表(分页,可选 status 过滤)。"""
    data = cloud_run_store.list(page=page, page_size=page_size, status=status)
    for item in data["list"]:
        output = item.get("output", "") or ""
        if len(output) > _SUMMARY_LEN:
            item["output_summary"] = output[: _SUMMARY_LEN] + "…"
        else:
            item["output_summary"] = output
    logger.info(
        "cloud-runs list user=%s page=%s page_size=%s total=%s",
        user_id, page, page_size, data["total"],
    )
    return {"code": 0, "message": "ok", "data": data}


@router.get("/{run_id}")
async def get_cloud_run(
    run_id: str,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """单条运行详情(含状态/最终输出/起止时间)。"""
    run = cloud_run_store.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"运行记录不存在: {run_id}")
    logger.info("cloud-runs detail user=%s run=%s", user_id, run_id)
    return {"code": 0, "message": "ok", "data": run.to_dict()}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠