# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""可续跑 subagent 作业台契约(2026-11-14 立,对标 DSH continuable subagent)。

① spawn 立即返回 job_id,后台执行;list 只返回调用者自己的作业;
② wait 有限等待到终态并回带结果摘要;到期仍 running;
③ send 对运行中作业回 SUBAGENT_BUSY,对终态作业以同一 lineage 续跑,
   上一轮任务与输出进入新任务上下文;
④ 越权(别人的 user_id)与不存在同形。
"""

from __future__ import annotations

import asyncio

import pytest

from app.services import subagent_jobs as jobs


@pytest.fixture(autouse=True)
def _clean_jobs():
    jobs.reset_subagent_jobs()
    yield
    jobs.reset_subagent_jobs()


def _ok_invoker(output: str, calls: list[str] | None = None, delay: float = 0.01):
    async def _invoke():
        if calls is not None:
            calls.append(output)
        await asyncio.sleep(delay)
        return {"status": "completed", "output": output, "ok": True}

    return _invoke


@pytest.mark.asyncio
async def test_spawn_list_wait_round_trip() -> None:
    started = await jobs.start_job(
        name="researcher",
        task="查资料",
        user_id="u1",
        session_id="s1",
        invoker=_ok_invoker("第一轮结果"),
    )
    assert started["ok"] is True
    job_id = started["job"]["job_id"]
    assert started["job"]["status"] == "running"

    listed = jobs.list_jobs(user_id="u1", session_id="s1")
    assert listed["total"] == 1
    assert listed["jobs"][0]["job_id"] == job_id

    waited = await jobs.wait_job(job_id, user_id="u1", session_id="s1", wait_s=3)
    assert waited["status"] == "succeeded"
    assert waited["ok"] is True
    assert "第一轮结果" in str(waited["result"])


@pytest.mark.asyncio
async def test_wait_returns_running_before_finish() -> None:
    started = await jobs.start_job(
        name="slow",
        task="慢任务",
        user_id="u1",
        session_id="s1",
        invoker=_ok_invoker("done", delay=0.5),
    )
    job_id = started["job"]["job_id"]
    waited = await jobs.wait_job(job_id, user_id="u1", session_id="s1", wait_s=0.1)
    assert waited["status"] == "running"
    assert waited["ok"] is False
    assert "仍在运行" in waited["message"]


@pytest.mark.asyncio
async def test_send_while_running_is_busy() -> None:
    started = await jobs.start_job(
        name="slow",
        task="慢任务",
        user_id="u1",
        session_id="s1",
        invoker=_ok_invoker("done", delay=0.5),
    )
    job_id = started["job"]["job_id"]
    result = await jobs.send_job(
        job_id,
        "继续",
        user_id="u1",
        session_id="s1",
        invoker_builder=lambda text: _ok_invoker("never"),
    )
    assert result["ok"] is False
    assert result["errorCode"] == "SUBAGENT_BUSY"
    await jobs.wait_job(job_id, user_id="u1", session_id="s1", wait_s=3)


@pytest.mark.asyncio
async def test_send_after_finish_resumes_same_lineage_with_context() -> None:
    captured: list[str] = []
    started = await jobs.start_job(
        name="researcher",
        task="查资料",
        user_id="u1",
        session_id="s1",
        invoker=_ok_invoker("第一轮结果"),
    )
    job_id = started["job"]["job_id"]
    lineage = started["job"]["lineage_id"]
    await jobs.wait_job(job_id, user_id="u1", session_id="s1", wait_s=3)

    def _builder(task_text: str):
        captured.append(task_text)
        return _ok_invoker("第二轮结果")

    resumed = await jobs.send_job(
        job_id,
        "把结论写成表格",
        user_id="u1",
        session_id="s1",
        invoker_builder=_builder,
    )
    assert resumed["ok"] is True
    assert resumed["job"]["parent_job_id"] == job_id
    assert resumed["job"]["lineage_id"] == lineage
    child_id = resumed["job"]["job_id"]

    waited = await jobs.wait_job(child_id, user_id="u1", session_id="s1", wait_s=3)
    assert waited["status"] == "succeeded"
    assert "第二轮结果" in str(waited["result"])

    assert "第一轮结果" in captured[0]
    assert "把结论写成表格" in captured[0]
    parent = jobs.get_job(job_id)
    assert child_id in parent.children


@pytest.mark.asyncio
async def test_ownership_is_enforced() -> None:
    started = await jobs.start_job(
        name="r",
        task="t",
        user_id="u1",
        session_id="s1",
        invoker=_ok_invoker("done"),
    )
    job_id = started["job"]["job_id"]
    assert jobs.list_jobs(user_id="u2", session_id="s1")["total"] == 0
    denied = await jobs.wait_job(job_id, user_id="u2", session_id="s1", wait_s=0.1)
    assert denied["ok"] is False
    assert denied["errorCode"] == "SUBAGENT_NOT_FOUND"
    missing = await jobs.wait_job("no-such", user_id="u1", session_id="s1", wait_s=0.1)
    assert missing["errorCode"] == denied["errorCode"]
    await jobs.wait_job(job_id, user_id="u1", session_id="s1", wait_s=3)


@pytest.mark.asyncio
async def test_cancel_running_job_marks_cancelled() -> None:
    async def _forever():
        await asyncio.sleep(30)
        return {"ok": True}

    started = await jobs.start_job(
        name="runaway", task="跑不停", user_id="u1", session_id="s1", invoker=_forever
    )
    job_id = started["job"]["job_id"]

    out = await jobs.cancel_job(job_id, user_id="u1", session_id="s1")

    assert out["ok"] is True
    assert out["cancelled"] is True
    assert out["job"]["status"] == "cancelled"
    assert jobs.get_job(job_id).finished is True


@pytest.mark.asyncio
async def test_cancel_finished_job_is_rejected() -> None:
    started = await jobs.start_job(
        name="fast", task="马上完成", user_id="u1", session_id="s1",
        invoker=_ok_invoker("done"),
    )
    job_id = started["job"]["job_id"]
    await jobs.wait_job(job_id, user_id="u1", session_id="s1", wait_s=3)

    out = await jobs.cancel_job(job_id, user_id="u1", session_id="s1")

    assert out["ok"] is False
    assert out["errorCode"] == "SUBAGENT_ALREADY_FINISHED"
    assert out["job"]["status"] == "succeeded"


@pytest.mark.asyncio
async def test_cancel_respects_ownership() -> None:
    async def _forever():
        await asyncio.sleep(30)

    started = await jobs.start_job(
        name="r", task="t", user_id="u1", session_id="s1", invoker=_forever
    )
    job_id = started["job"]["job_id"]

    denied = await jobs.cancel_job(job_id, user_id="u2", session_id="s1")
    assert denied["ok"] is False
    assert denied["errorCode"] == "SUBAGENT_NOT_FOUND"

    await jobs.cancel_job(job_id, user_id="u1", session_id="s1")


@pytest.mark.asyncio
async def test_mcp_subagent_job_cancel_action() -> None:
    """工具面接线:cancel 动作经 handler 直达作业台(不是只在服务层可用)。"""
    from app.services.mcp_server import _tool_subagent_job

    async def _forever():
        await asyncio.sleep(30)

    started = await jobs.start_job(
        name="r", task="t", user_id="u1", session_id="s1", invoker=_forever
    )
    out = await _tool_subagent_job(
        {
            "action": "cancel",
            "job_id": started["job"]["job_id"],
            "__user_id": "u1",
            "__session_id": "s1",
        }
    )

    assert out["action"] == "cancel"
    assert out["ok"] is True
    assert out["cancelled"] is True
    assert out["job"]["status"] == "cancelled"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
