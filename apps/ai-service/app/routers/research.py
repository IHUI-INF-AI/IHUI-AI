# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""Deep Research 深度研究路由。

挂载说明:本模块仅导出 `router: APIRouter`(prefix="/research"),由 master 统一
在 main.py 以 `app.include_router(research.router, prefix="/api", tags=["research"])`
方式挂载,最终端点路径:
  POST /api/research/start            → 启动研究,返回 research_id
  GET  /api/research/{research_id}    → 研究进度 + 中间产物 + 终态报告

认证/审计:复用项目 pass-the-request 的 `get_current_user_id` 依赖注入(与
routers/agents.py / agent_runtime.py 一致);审计以结构化 logger 记录调用流水。
"""

from __future__ import annotations

from typing import Any

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..core.jwt_auth import get_current_user_id
from ..services.deep_research import LLMFn, PHASE_DONE, manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/research", tags=["research"])


# ============ 数据模型 ============


class ResearchStartRequest(BaseModel):
    """启动深度研究请求体。"""

    query: str = Field(..., min_length=2, max_length=2000, description="研究课题")
    max_iterations: int = Field(4, ge=1, le=10, description="双向深挖(gap 追问)最大轮数")


class ResearchStartResponse(BaseModel):
    """启动响应:返回 research_id 供轮询。"""

    research_id: str
    status: str


# ============ LLM 接线(包装 llm_gateway.complete,返回助手文本)============


def _make_llm_fn(model: str | None = None) -> LLMFn:
    """构造 deep_research 所需的 llm_complete_fn(简单契约:入 messages,返文本)。

    包装 app.core.llm_gateway.llm_gateway.complete,抽取 content 文本。
    延迟导入避免模块加载副作用。
    """

    async def _llm(messages: list[dict[str, Any]]) -> str:
        from ..core.llm_gateway import llm_gateway

        result = await llm_gateway.complete(messages, model=model)
        return (result.get("content") or "").strip()

    return _llm


# ============ 端点 ============


@router.post("/start", response_model=ResearchStartResponse)
async def start_research(
    body: ResearchStartRequest,
    user_id: str = Depends(get_current_user_id),
) -> ResearchStartResponse:
    """启动一次多轮深度研究,立即返回 research_id(后台异步执行)。"""
    run = manager.start(
        body.query,
        _make_llm_fn(),
        max_iterations=body.max_iterations,
    )
    logger.info(
        "deep_research start research_id=%s user_id=%s query=%r iterations=%s",
        run.research_id,
        user_id,
        body.query[:80],
        body.max_iterations,
    )
    return ResearchStartResponse(research_id=run.research_id, status=run.status.value)


@router.get("/{research_id}")
async def get_research(
    research_id: str,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """查询研究进度 + 中间产物 + 终态报告(结构化,含阶段状态)。"""
    # 断点续跑:命中运行/终态即返回当前 snapshot(研究任务在进程内持续执行)。
    run = manager.resume(research_id, _make_llm_fn())
    if run is None:
        raise HTTPException(status_code=404, detail="未找到该研究(research_id 不存在或已被淘汰)")
    if user_id:
        logger.info(
            "deep_research get research_id=%s user_id=%s status=%s",
            research_id,
            user_id,
            run.status.value,
        )

    if run.report is not None:
        data = run.report.to_dict()
    else:
        # 尚未产出 report(正在规划/检索中):返回进度骨架
        data = {
            "research_id": research_id,
            "query": run.query,
            "status": run.status.value,
            "error": run.error,
            "subquestions": [],
            "gap_questions": [],
            "iteration": 0,
            "max_iterations": None,
            "evidence": [],
            "headings": [],
            "sources": [],
            "markdown": "",
            "stages": [],
        }
    data["status"] = run.status.value
    data["running"] = run.status.value == "running"
    data["finished"] = run.status.value == "done"
    data["done"] = run.status.value == PHASE_DONE
    data["error"] = run.error or data.get("error", "")
    return data
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠