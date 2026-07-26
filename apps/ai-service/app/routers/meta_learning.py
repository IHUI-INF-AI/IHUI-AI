"""L4 自进化能力 admin 路由(2026-07-25 立)。

暴露 meta_learner + meta_learner_scheduler + skill_evolution_scheduler 的
状态/历史/手动触发能力,供 admin 看板查看自进化运行情况。

端点(prefix /api/admin/meta-learner):
- GET  /status    — 调度器 + learner 综合状态
- GET  /lessons   — 内存缓存的 meta_lessons 列表
- GET  /history   — meta_learner_scheduler 历史运行记录
- POST /trigger   — 手动触发元学习聚类(不影响下次定时触发)

认证由 api 端转发处理(本任务只暴露端点)。
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException

from app.services.meta_learner import meta_learner
from app.services.meta_learner_scheduler import meta_learner_scheduler
from app.services.skill_evolution_scheduler import skill_evolution_scheduler

router = APIRouter(prefix="/api/admin/meta-learner", tags=["meta-learner"])


@router.get("/status")
async def get_status() -> dict[str, Any]:
    """获取自进化系统状态(learner + meta_learner_scheduler + skill_evolution_scheduler)。"""
    return {
        "learner": meta_learner.get_status(),
        "scheduler": meta_learner_scheduler.get_status(),
        "skillEvolution": skill_evolution_scheduler.get_status(),
    }


@router.get("/lessons")
async def get_lessons(limit: int = 50) -> dict[str, Any]:
    """获取内存缓存的 meta_lessons 列表(按 confidence + occurrence_count 倒序)。

    Args:
        limit: 最大返回条数(默认 50)
    """
    lessons = meta_learner.get_cached_lessons(limit=limit)
    return {"lessons": lessons, "count": len(lessons)}


@router.get("/history")
async def get_history(limit: int = 10) -> dict[str, Any]:
    """获取 meta_learner_scheduler 最近 N 条历史运行记录。

    Args:
        limit: 最大返回条数(默认 10)
    """
    history = meta_learner_scheduler.get_history(limit=limit)
    return {"history": history, "count": len(history)}


@router.post("/trigger")
async def trigger_now() -> dict[str, Any]:
    """手动触发一次元学习聚类(不影响下次定时触发)。

    内部调 meta_learner_scheduler.trigger_now → _run_once:
    收集失败案例 → FailureClusterer 聚类 → 抽取 meta_lessons → 持久化。
    """
    try:
        result = await meta_learner_scheduler.trigger_now()
        return {"status": "triggered", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}")
