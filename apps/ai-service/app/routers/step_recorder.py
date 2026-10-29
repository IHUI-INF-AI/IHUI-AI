# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""Agent 运行步骤录制路由(Record & Replay,对标 WorkBuddy/Codex 可复现审计)。

挂载说明:本模块仅导出 `router: APIRouter`(prefix="/agent-recorder"),由 master 在
main.py 以 `app.include_router(step_recorder_router, prefix="/api",
tags=["agent-recorder"])` 方式挂载,最终端点路径:
  GET /api/agent-recorder/runs/{run_id}/steps    → 该运行的 step 序列(时间序分页)
  GET /api/agent-recorder/runs/{run_id}/replay   → 全量回放,或 ?step_index=N 单步回看
  GET /api/agent-recorder/runs/{run_id}/metrics  → 总耗时/总 token/总成本/成败统计
  GET /api/agent-recorder/invocations/{id}/steps → 按账行编号反查录制步骤(B04 证据回指)

存储:复用 agent_step_recorder(进程内 dict + data/step_records.json 文件持久化)。
认证:与 cloud_runs 一致,复用 get_current_user_id(审计数据仅登录用户可见)。
响应统一信封 {code:0,message:data},对齐前端 api-client(api-client 以 code===0 判定成功)。
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends

from ..core.jwt_auth import get_current_user_id
from ..services.agent_step_recorder import agent_step_recorder

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agent-recorder", tags=["agent-recorder"])


@router.get("/runs/{run_id}/steps")
async def list_run_steps(
    run_id: str,
    page: int = 1,
    page_size: int = 20,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """该运行的 step 序列(时间序分页)。空运行返回 0 条。"""
    data = agent_step_recorder.get_run_steps(run_id, page=page, page_size=page_size)
    logger.info(
        "agent-recorder steps user=%s run=%s total=%s", user_id, run_id, data["total"]
    )
    return {"code": 0, "message": "ok", "data": data}


@router.get("/runs/{run_id}/replay")
async def replay_run(
    run_id: str,
    step_index: int | None = None,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """回放:缺省全量(时间序),step_index 给定则单步回看(越界 found=false)。"""
    data = agent_step_recorder.replay(run_id, step_index=step_index)
    logger.info(
        "agent-recorder replay user=%s run=%s step_index=%s",
        user_id, run_id, step_index,
    )
    return {"code": 0, "message": "ok", "data": data}


@router.get("/invocations/{invocation_id}/steps")
async def find_steps_by_invocation(
    invocation_id: str,
    limit: int = 200,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """按明细账行编号反查录制步骤(B04 证据回指,2026-10-28 立)。

    账行编号是录制面与明细账唯一能对齐的键(循环侧算一次、两处引用)。此前三个端点
    全按 run_id 寻址,编号写进 `step_records.json` 后没有读路径,"可追溯"缺最后一跳。
    未命中返回 found=false(空编号同样 false,不扫全表)。
    """
    data = agent_step_recorder.get_steps_by_invocation_id(invocation_id, limit=limit)
    logger.info(
        "agent-recorder by-invocation user=%s invocation=%s found=%s total=%s",
        user_id,
        invocation_id[:64],
        data["found"],
        data["total"],
    )
    return {"code": 0, "message": "ok", "data": data}


@router.get("/runs/{run_id}/metrics")
async def run_metrics(
    run_id: str,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """单运行聚合指标:步数 / 成败 / 总 token / 总耗时 / 总成本。"""
    data = agent_step_recorder.get_run_metrics(run_id)
    logger.info(
        "agent-recorder metrics user=%s run=%s steps=%s",
        user_id, run_id, data["step_count"],
    )
    return {"code": 0, "message": "ok", "data": data}
