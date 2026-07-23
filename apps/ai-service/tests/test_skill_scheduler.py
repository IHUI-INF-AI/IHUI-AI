"""SkillScheduler 单元测试(2026-07-23)。覆盖 5 大场景。

mock 策略:monkeypatch llm_gateway.complete 避免真实调用。
注意:AsyncMock side_effect 不能直接传 dict(会被当 iterable 拆 key)。
"""
from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock

import pytest

from app.services.skill_scheduler import SkillScheduler, skill_scheduler
from app.services.skills import Skill, skill_registry


def _ok(content="ok", tokens=42) -> dict[str, Any]:
    return {"content": content, "model": "gpt-4o-mini",
            "usage": {"prompt_tokens": 10, "completion_tokens": max(0, tokens - 10), "total_tokens": tokens},
            "stub": True}


def _err(msg="upstream down") -> dict[str, Any]:
    return {"content": "", "model": "gpt-4o-mini", "usage": {}, "stub": False,
            "error": True, "error_message": msg}


def _patch_llm(monkeypatch, return_value=None, side_effect=None) -> AsyncMock:
    """monkeypatch llm_gateway.complete。return_value 和 side_effect 二选一。"""
    mock = AsyncMock(side_effect=side_effect) if side_effect is not None else AsyncMock(return_value=return_value)
    monkeypatch.setattr("app.services.skill_scheduler.llm_gateway.complete", mock)
    return mock


def _patch_sleep(monkeypatch) -> AsyncMock:
    """替换 asyncio.sleep,记录调用时长。"""
    sleeps: list[float] = []
    mock = AsyncMock(side_effect=lambda s: sleeps.append(s))
    monkeypatch.setattr("app.services.skill_scheduler.asyncio.sleep", mock)
    mock.sleeps = sleeps  # type: ignore[attr-defined]
    return mock


# ── 1. 实例化 ──


def test_scheduler_init():
    """实例化:默认 max_retries=3 + 初始统计全 0 + 自定义 + 全局单例。"""
    s = SkillScheduler()
    assert s.max_retries == 3
    assert s.total_tokens == 0 and s.call_count == 0 and s.error_count == 0
    assert isinstance(s.history, list)
    assert SkillScheduler(max_retries=5).max_retries == 5
    assert isinstance(skill_scheduler, SkillScheduler)


# ── 2. 单步执行 ──


@pytest.mark.asyncio
async def test_scheduler_run_simple_skill(monkeypatch):
    """单步:成功 + 未知 skill(不调 llm)。"""
    mock = _patch_llm(monkeypatch, return_value=_ok(content="hello", tokens=20))
    s = SkillScheduler()
    r1 = await s.run_skill("code-review", variables={"language": "py", "code": "x"})
    assert r1["error"] is None and r1["content"] == "hello" and r1["tokens"] == 20
    assert r1["retries"] == 0 and s.call_count == 1 and s.total_tokens == 20
    r2 = await s.run_skill("nonexistent-xyz", variables={})
    assert r2["error"] and "skill not found" in r2["error"] and r2["content"] == ""
    assert s.error_count == 1 and mock.await_count == 1  # 未知 skill 未调 llm


# ── 3. 失败重试(成功 + 失败 + 退避)──


@pytest.mark.asyncio
async def test_scheduler_retry_on_failure(monkeypatch):
    """重试 3 场景:成功(2 失败→第 3 成功)/ 失败耗尽 / 指数退避 1s/2s。"""
    # 3a:前 2 次失败,第 3 次成功
    _patch_sleep(monkeypatch)
    mock = _patch_llm(monkeypatch, side_effect=[_err("t1"), _err("t2"), _ok(content="yay", tokens=15)])
    s = SkillScheduler(max_retries=3)
    r = await s.run_skill("doc-writer", variables={"language": "py", "code": "x"})
    assert r["error"] is None and r["content"] == "yay" and r["retries"] == 2
    assert r["tokens"] == 15 and mock.await_count == 3
    assert s.call_count == 1 and s.error_count == 0 and s.total_tokens == 15
    # 3b+3c:全部失败 + 退避验证
    sleep_mock = _patch_sleep(monkeypatch)
    _patch_llm(monkeypatch, return_value=_err("persistent"))
    s2 = SkillScheduler(max_retries=3)
    r2 = await s2.run_skill("code-review", variables={"language": "py", "code": "x"})
    assert r2["error"] and "重试 3 次后仍失败" in r2["error"]
    assert r2["retries"] == 2 and s2.error_count == 1
    assert sleep_mock.await_count == 2  # attempt 1/2 之间 sleep 2 次
    assert sleep_mock.sleeps == [1.0, 2.0]  # type: ignore[attr-defined]


# ── 4. 上下文传递(链式 skill)──


@pytest.mark.asyncio
async def test_scheduler_context_passing(monkeypatch):
    """链式 skill:第二步 prompt 引用第一步 output(context_from=previous)。"""
    _patch_sleep(monkeypatch)
    s1 = Skill(name="step1-producer", description="d", prompt_template="produce something")
    s2 = Skill(name="step2-consumer", description="d", prompt_template="consume: {previous}")
    monkeypatch.setattr(skill_registry, "get", lambda n: {"step1-producer": s1, "step2-consumer": s2}.get(n))
    prompts: list[str] = []

    async def fake(messages, **kwargs):
        prompts.append(messages[0]["content"])
        return _ok(content=f"out-{len(prompts)}", tokens=30)

    _patch_llm(monkeypatch, side_effect=fake)
    s = SkillScheduler()
    chain = await s.run_chain(steps=[{"skill": "step1-producer"}, {"skill": "step2-consumer", "context_from": "previous"}])
    assert chain["error"] is None and len(chain["results"]) == 2
    assert prompts[0] == "produce something" and "consume: out-1" in prompts[1]
    assert s.total_tokens == 60  # 30 + 30


# ── 5. token 用量统计(单调递增)──


@pytest.mark.asyncio
async def test_scheduler_token_tracking(monkeypatch):
    """多次调用 total_tokens 单调递增(10/20/30),stats() 字段一致。"""
    _patch_sleep(monkeypatch)
    n = {"i": 0}

    async def fake(messages, **kwargs):
        n["i"] += 1
        return _ok(content=f"r{n['i']}", tokens=n["i"] * 10)

    _patch_llm(monkeypatch, side_effect=fake)
    s = SkillScheduler()
    await s.run_skill("code-review", variables={"language": "py", "code": "a"})
    assert s.total_tokens == 10
    await s.run_skill("doc-writer", variables={"language": "py", "code": "b"})
    assert s.total_tokens == 30
    await s.run_skill("refactor-helper", variables={"language": "py", "code": "c"})
    assert s.total_tokens == 60
    st = s.stats()
    assert st["total_tokens"] == 60 and st["call_count"] == 3
    assert st["error_count"] == 0 and st["history_size"] == 3
