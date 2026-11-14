# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌‌​‌‍‍​‌​​​​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​‌​‍⁠

"""可续跑 subagent 作业台(2026-11-14 立,对标 DSH dsh-subagent 的 continuable 语义)。

DSH 的委派不是"一次往返":spawn 立即返回子级名称,父级可 list/wait;
子级完成后还能用 `send_message` 继续同一条任务线(子会话保留上下文)。
IHUI 现状:`dispatch_subagent` 同步等子 agent 跑完,长任务期间父级只能阻塞。

本模块补上**最小闭环**(不改 agent 循环状态机):
- `start_job`:把单 agent 派发交给 background_task_manager 后台执行,立即返回 job_id;
- `list_jobs`:按 (user_id, session_id) 列出作业与状态;
- `wait_job`:有限等待到终态,返回结果摘要;
- `send_job`:对**已结束**的作业发起续跑 —— 新作业继承 lineage_id,并把上一轮的
  任务/结果作为上下文写进新任务提示,实现"同一任务线可续跑";
  运行中的作业返回 SUBAGENT_BUSY(活体 steering 需要子 agent 收件箱,未在最小闭环内)。

所有权:作业记录 user_id + session_id;list/wait/send 一律按调用者身份过滤,
越权与不存在同形。注册表有界(终态最多保留 MAX_JOBS 条)。
"""

from __future__ import annotations

import asyncio
import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, Final

from .background_tasks import background_task_manager

MAX_JOBS: Final = 100
#: 单次 wait 的轮询粒度(秒):作业完成由列表自身感知,不需要额外 Event。
_POLL_S: Final = 0.05
#: 结果摘要长度(避免大对象撑爆父级上下文)。
_RESULT_PREVIEW: Final = 4000

_JOB_STATUS_RUNNING = "running"
_JOB_STATUS_SUCCEEDED = "succeeded"
_JOB_STATUS_FAILED = "failed"
_JOB_STATUS_CANCELLED = "cancelled"


@dataclass
class SubagentJob:
    job_id: str
    lineage_id: str
    parent_job_id: str | None
    name: str
    task: str
    user_id: str | None
    session_id: str | None
    created_ts: datetime
    bg_task_id: str = ""
    finished: bool = False
    ok: bool = False
    result: Any = None
    error: str | None = None
    cancelled: bool = False
    #: 该作业被 send 续跑出的子作业 id(便于从父作业追踪任务线)。
    children: list[str] = field(default_factory=list)

    @property
    def status(self) -> str:
        if not self.finished:
            return _JOB_STATUS_RUNNING
        if self.cancelled:
            return _JOB_STATUS_CANCELLED
        return _JOB_STATUS_SUCCEEDED if self.ok else _JOB_STATUS_FAILED

    def to_dict(self) -> dict[str, Any]:
        return {
            "job_id": self.job_id,
            "lineage_id": self.lineage_id,
            "parent_job_id": self.parent_job_id,
            "agent_name": self.name,
            "status": self.status,
            "ok": self.ok,
            "result": self.result,
            "error": self.error,
            "children": list(self.children),
            "created_at": self.created_ts.isoformat(),
        }


_jobs: dict[str, SubagentJob] = {}


def reset_subagent_jobs() -> None:
    """测试用:清空作业台(生产不调用)。"""
    _jobs.clear()


def get_job(job_id: str) -> SubagentJob | None:
    return _jobs.get(job_id)


def _prune() -> None:
    """有界:终态作业超过 MAX_JOBS 时按创建时间淘汰最旧的。"""
    terminal = [j for j in _jobs.values() if j.finished]
    if len(terminal) <= MAX_JOBS:
        return
    terminal.sort(key=lambda j: j.created_ts)
    for job in terminal[: len(terminal) - MAX_JOBS]:
        _jobs.pop(job.job_id, None)


def _summarize(result: Any) -> Any:
    if isinstance(result, (str, int, float, bool)):
        text = result if isinstance(result, str) else str(result)
        return text[:_RESULT_PREVIEW]
    text = str(result)
    return text[:_RESULT_PREVIEW]


async def start_job(
    *,
    name: str,
    task: str,
    user_id: str | None,
    session_id: str | None,
    invoker: Callable[[], Awaitable[Any]],
    timeout_s: float = 900.0,
    parent_job_id: str | None = None,
    lineage_id: str | None = None,
) -> dict[str, Any]:
    """后台启动一个子 agent 作业;立即返回 job_id(不阻塞父级)。"""
    job = SubagentJob(
        job_id=uuid.uuid4().hex[:12],
        lineage_id=lineage_id or uuid.uuid4().hex[:12],
        parent_job_id=parent_job_id,
        name=name,
        task=task,
        user_id=user_id,
        session_id=session_id,
        created_ts=datetime.now(UTC),
    )

    async def _runner() -> Any:
        try:
            result = await invoker()
            job.result = _summarize(result)
            job.ok = True
            return result
        except asyncio.CancelledError:
            job.cancelled = True
            job.error = job.error or "作业被取消或超时"
            raise
        except Exception as e:  # noqa: BLE001 - 作业失败落记录,不污染事件循环
            job.error = str(e)[:2000]
            raise
        finally:
            job.finished = True

    submitted = await background_task_manager.submit(
        _runner,
        name=f"subagent:{name}",
        user_id=user_id,
        session_id=session_id,
        notify_on_done=False,
        timeout_s=timeout_s,
    )
    if isinstance(submitted, dict):
        return {
            "ok": False,
            "errorCode": "SUBAGENT_SPAWN_REJECTED",
            "error": str(submitted.get("error") or "后台作业提交失败"),
            "detail": submitted,
        }
    job.bg_task_id = submitted
    _jobs[job.job_id] = job
    if parent_job_id and parent_job_id in _jobs:
        _jobs[parent_job_id].children.append(job.job_id)
    _prune()
    return {"ok": True, "job": job.to_dict()}


def list_jobs(
    *, user_id: str | None, session_id: str | None, limit: int = 20
) -> dict[str, Any]:
    """列出调用者可见的作业(新的在前);身份缺失时返回空集而非全量。"""
    if not user_id:
        return {"ok": True, "jobs": [], "total": 0, "message": "无宿主身份,不返回作业"}
    items = [
        j
        for j in _jobs.values()
        if j.user_id == user_id and (session_id is None or j.session_id == session_id)
    ]
    items.sort(key=lambda j: j.created_ts, reverse=True)
    jobs = [j.to_dict() for j in items[: max(1, limit)]]
    return {"ok": True, "jobs": jobs, "total": len(jobs)}


async def wait_job(
    job_id: str,
    *,
    user_id: str | None,
    session_id: str | None,
    wait_s: float = 30.0,
) -> dict[str, Any]:
    """有限等待作业到终态;到期仍未完成则返回 running(父级可继续别的工作)。"""
    job = _jobs.get(job_id)
    if job is None or not user_id or job.user_id != user_id:
        return {
            "ok": False,
            "errorCode": "SUBAGENT_NOT_FOUND",
            "error": "作业不存在或无权访问",
        }
    if session_id is not None and job.session_id not in (None, session_id):
        return {
            "ok": False,
            "errorCode": "SUBAGENT_NOT_FOUND",
            "error": "作业不存在或无权访问",
        }
    deadline = asyncio.get_running_loop().time() + max(0.0, min(wait_s, 300.0))
    while not job.finished and asyncio.get_running_loop().time() < deadline:
        await asyncio.sleep(_POLL_S)
    payload = job.to_dict()
    payload["ok"] = job.finished and job.ok
    payload["waited"] = True
    if not job.finished:
        payload["message"] = f"作业仍在运行(已等待 {wait_s:g}s)"
    return payload


async def send_job(
    job_id: str,
    message: str,
    *,
    user_id: str | None,
    session_id: str | None,
    invoker_builder: Callable[[str], Callable[[], Awaitable[Any]]],
    timeout_s: float = 900.0,
) -> dict[str, Any]:
    """向已结束的作业追加一条消息,启动同一任务线的续跑作业。"""
    text = message.strip() if isinstance(message, str) else ""
    if not text:
        return {
            "ok": False,
            "errorCode": "MISSING_PARAMS",
            "error": "send 需要非空 message",
        }
    job = _jobs.get(job_id)
    if job is None or not user_id or job.user_id != user_id:
        return {
            "ok": False,
            "errorCode": "SUBAGENT_NOT_FOUND",
            "error": "作业不存在或无权访问",
        }
    if session_id is not None and job.session_id not in (None, session_id):
        return {
            "ok": False,
            "errorCode": "SUBAGENT_NOT_FOUND",
            "error": "作业不存在或无权访问",
        }
    if not job.finished:
        return {
            "ok": False,
            "errorCode": "SUBAGENT_BUSY",
            "error": "作业仍在运行;最小闭环暂不支持活体 steering,请先 wait 到终态再 send",
            "job": job.to_dict(),
        }
    previous = job.result if job.ok else (job.error or "(无输出)")
    continuation_task = (
        "这是同一子智能体任务线的续跑。\n"
        f"[上一轮任务]\n{job.task}\n\n"
        f"[上一轮最终输出]\n{previous}\n\n"
        f"[用户的新消息]\n{text}\n\n"
        "请接续上一轮的目标与上下文继续工作;不要重复已经完成的部分。"
    )
    return await start_job(
        name=job.name,
        task=continuation_task,
        user_id=user_id,
        session_id=job.session_id,
        invoker=invoker_builder(continuation_task),
        timeout_s=timeout_s,
        parent_job_id=job.job_id,
        lineage_id=job.lineage_id,
    )
