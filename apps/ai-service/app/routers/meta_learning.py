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


@router.get("/agent-failures")
async def get_agent_failures(limit: int = 50) -> dict[str, Any]:
    """聚合 Agent 失败与恢复数据(L5-5/L5-6 配套,2026-08-12 立)。

    供 admin 看板展示「Agent 失败 → 分类 → 元学习」链路可观测性:
    - agentErrors: 审计缓冲中 agent_error 事件(按 error_type 聚合)
    - toolFailures: 工具失败事件(status=error:*)
    - failedCheckpoints: checkpoint 表 failed 记录数(元学习失败案例来源)

    数据源为当前进程内存(audit_service 缓冲 + checkpoint manager),
    服务重启后清空属预期;持久化数据在 audit_logs 表。
    """
    try:
        from app.services.agent_checkpoint import get_agent_checkpoint_manager
        from app.services.audit_service import audit_service

        # 1. 审计缓冲中 agent_error 事件
        agent_errors = audit_service.get_recent(limit=500, action="agent_error")
        # 2. 工具失败事件(status=error:*)
        tool_events = audit_service.get_recent(limit=500, action="tool_execution")
        tool_failures = [
            t
            for t in tool_events
            if str(t.get("details", {}).get("status", "")).startswith("error:")
        ]
        # 3. checkpoint failed 记录(元学习失败案例来源)
        checkpoints = await get_agent_checkpoint_manager().list_checkpoints()
        failed_cps = [cp for cp in checkpoints if cp.status == "failed"]

        # 聚合错误分类
        by_type: dict[str, int] = {}
        for e in agent_errors:
            et = str(e["details"].get("error_type", "unknown"))
            by_type[et] = by_type.get(et, 0) + 1
        tool_by_type: dict[str, int] = {}
        for t in tool_failures:
            status = str(t["details"].get("status", ""))
            et = status.split(":", 1)[-1] if ":" in status else "unknown"
            tool_by_type[et] = tool_by_type.get(et, 0) + 1

        return {
            "agentErrors": {
                "total": len(agent_errors),
                "byType": by_type,
            },
            "toolFailures": {
                "total": len(tool_failures),
                "byType": tool_by_type,
            },
            "failedCheckpoints": len(failed_cps),
            "recent": [
                {
                    "kind": "agent_error",
                    "errorType": str(e["details"].get("error_type", "unknown")),
                    "error": str(e["details"].get("error", ""))[:200],
                    "time": e["timestamp"],
                }
                for e in agent_errors[:limit]
            ],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}")
