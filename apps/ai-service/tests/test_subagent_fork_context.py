# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""B1-09 子代理 fork/spawn 双上下文播种契约。

① spawn 缺省零父上下文且拒绝 parent_job_id；
② fork 只认已成功终态的父作业，运行/取消/失败一律拒绝；
③ fork 种子含父任务与结果，深度上限 4；
④ start_job 复校种子前缀，避免「记了 fork、实际零上下文」。
"""

from __future__ import annotations

import asyncio
from typing import Any

import pytest

from app.services import subagent_jobs as jobs
from app.services.subagent_backends import (
    MAX_FORK_DEPTH,
    SubagentContextError,
    build_context_seed,
)


@pytest.fixture(autouse=True)
def _clean_jobs():
    jobs.reset_subagent_jobs()
    yield
    jobs.reset_subagent_jobs()


def _ok_invoker(output: str, *, delay: float = 0.01):
    async def _invoke() -> dict[str, Any]:
        await asyncio.sleep(delay)
        return {"status": "completed", "output": output, "ok": True}

    return _invoke


def _job(job_id: str, **overrides: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "job_id": job_id,
        "parent_job_id": None,
        "task": "父任务",
        "result": "父结果",
        "user_id": "u1",
        "session_id": "s1",
        "finished": True,
        "ok": True,
        "cancelled": False,
        "status": "succeeded",
    }
    base.update(overrides)
    return base


def test_spawn_is_zero_context() -> None:
    seed = build_context_seed(
        "spawn", parent_job_id=None, jobs={}, user_id="u1", session_id="s1"
    )
    assert seed.backend == "spawn"
    assert seed.text == ""
    assert seed.depth == 0


def test_spawn_rejects_parent_job_id() -> None:
    with pytest.raises(SubagentContextError) as err:
        build_context_seed(
            "spawn", parent_job_id="j1", jobs={}, user_id="u1", session_id="s1"
        )
    assert err.value.code == "SUBAGENT_SPAWN_PARENT_UNSUPPORTED"


def test_fork_requires_parent_job_id() -> None:
    with pytest.raises(SubagentContextError) as err:
        build_context_seed(
            "fork", parent_job_id=None, jobs={}, user_id="u1", session_id="s1"
        )
    assert err.value.code == "SUBAGENT_FORK_PARENT_REQUIRED"


def test_fork_builds_balanced_prefix() -> None:
    seed = build_context_seed(
        "fork",
        parent_job_id="j1",
        jobs={"j1": _job("j1")},
        user_id="u1",
        session_id="s1",
    )
    assert seed.backend == "fork"
    assert "父任务" in seed.text
    assert "父结果" in seed.text
    assert seed.text.rstrip().endswith("[你的任务]")
    assert seed.depth == 1
    assert seed.parent_status == "succeeded"


def test_fork_rejects_running_parent() -> None:
    with pytest.raises(SubagentContextError) as err:
        build_context_seed(
            "fork",
            parent_job_id="j1",
            jobs={"j1": _job("j1", finished=False, ok=False, status="running")},
            user_id="u1",
            session_id="s1",
        )
    assert err.value.code == "SUBAGENT_FORK_PARENT_RUNNING"


def test_fork_rejects_cancelled_and_failed_parent() -> None:
    with pytest.raises(SubagentContextError) as cancelled:
        build_context_seed(
            "fork",
            parent_job_id="j1",
            jobs={"j1": _job("j1", ok=False, cancelled=True, status="cancelled")},
            user_id="u1",
            session_id="s1",
        )
    assert cancelled.value.code == "SUBAGENT_FORK_PARENT_CANCELLED"

    with pytest.raises(SubagentContextError) as failed:
        build_context_seed(
            "fork",
            parent_job_id="j1",
            jobs={"j1": _job("j1", ok=False, status="failed")},
            user_id="u1",
            session_id="s1",
        )
    assert failed.value.code == "SUBAGENT_FORK_PARENT_FAILED"


def test_fork_ownership_is_not_disclosed() -> None:
    with pytest.raises(SubagentContextError) as err:
        build_context_seed(
            "fork",
            parent_job_id="j1",
            jobs={"j1": _job("j1")},
            user_id="other",
            session_id="s1",
        )
    assert err.value.code == "SUBAGENT_NOT_FOUND"
    assert "不存在" in err.value.message


def test_fork_depth_limit() -> None:
    chain: dict[str, Any] = {}
    parent: str | None = None
    for i in range(MAX_FORK_DEPTH + 1):
        job_id = f"j{i}"
        chain[job_id] = _job(job_id, parent_job_id=parent)
        parent = job_id
    with pytest.raises(SubagentContextError) as err:
        build_context_seed(
            "fork",
            parent_job_id=parent,
            jobs=chain,
            user_id="u1",
            session_id="s1",
        )
    assert err.value.code == "SUBAGENT_FORK_DEPTH_LIMIT"


def test_unknown_context_mode_rejected() -> None:
    with pytest.raises(SubagentContextError) as err:
        build_context_seed(
            "bogus", parent_job_id=None, jobs={}, user_id="u1", session_id="s1"
        )
    assert err.value.code == "SUBAGENT_INVALID_CONTEXT_MODE"


@pytest.mark.asyncio
async def test_start_fork_without_seed_prefix_is_rejected() -> None:
    parent = await jobs.start_job(
        name="parent",
        task="父任务",
        user_id="u1",
        session_id="s1",
        invoker=_ok_invoker("父结果"),
    )
    parent_id = parent["job"]["job_id"]
    await jobs.wait_job(parent_id, user_id="u1", session_id="s1", wait_s=3)

    started = await jobs.start_job(
        name="child",
        task="没有种子前缀",
        user_id="u1",
        session_id="s1",
        invoker=_ok_invoker("子结果"),
        parent_job_id=parent_id,
        context_mode="fork",
    )
    assert started["ok"] is False
    assert started["errorCode"] == "SUBAGENT_FORK_SEED_MISSING"


@pytest.mark.asyncio
async def test_start_fork_with_seed_prefix_records_depth() -> None:
    parent = await jobs.start_job(
        name="parent",
        task="父任务",
        user_id="u1",
        session_id="s1",
        invoker=_ok_invoker("父结果"),
    )
    parent_id = parent["job"]["job_id"]
    await jobs.wait_job(parent_id, user_id="u1", session_id="s1", wait_s=3)

    prepared = jobs.prepare_context_seed(
        context_mode="fork",
        parent_job_id=parent_id,
        user_id="u1",
        session_id="s1",
    )
    assert prepared["ok"] is True
    assert "父结果" in prepared["prefix"]

    started = await jobs.start_job(
        name="child",
        task=prepared["prefix"] + "接着干",
        user_id="u1",
        session_id="s1",
        invoker=_ok_invoker("子结果"),
        parent_job_id=parent_id,
        context_mode="fork",
    )
    assert started["ok"] is True
    assert started["job"]["context_mode"] == "fork"
    assert started["job"]["fork_depth"] == 1
    assert started["job"]["parent_job_id"] == parent_id


@pytest.mark.asyncio
async def test_prepare_fork_rejects_running_parent() -> None:
    parent = await jobs.start_job(
        name="parent",
        task="父任务",
        user_id="u1",
        session_id="s1",
        invoker=_ok_invoker("父结果", delay=30),
    )
    parent_id = parent["job"]["job_id"]
    prepared = jobs.prepare_context_seed(
        context_mode="fork",
        parent_job_id=parent_id,
        user_id="u1",
        session_id="s1",
    )
    assert prepared["ok"] is False
    assert prepared["errorCode"] == "SUBAGENT_FORK_PARENT_RUNNING"
    await jobs.cancel_job(parent_id, user_id="u1", session_id="s1")


def test_tool_schema_advertises_context_mode() -> None:
    from app.services import mcp_server

    schema = mcp_server.get_full_tool_schema("orchestrate_agents")
    assert schema is not None
    props = schema["input_schema"]["properties"]
    assert props["context_mode"]["enum"] == ["spawn", "fork"]
    assert props["context_mode"]["default"] == "spawn"
    assert "parent_job_id" in props
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
