# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""subagent_jobs.wait_job → multi_agent_config_gate.clamp_wait_timeout_s 接线测试。

钉住两个行为(2026-11-16 装车门,对齐 Codex MultiAgentV2ConfigToml):
① wait_job 的 wait_s 经 clamp_wait_timeout_s 夹紧到配置边界,不再用裸 300s 硬上限;
② None/≤0 走 default_wait_timeout_ms。

用小边界(monkeypatch)避免真实长等:把 DEFAULT_CONFIG 换成 max=2s,
验证 wait_s=300 只等 ~2s 就返回 running(而不是等满 300s)。
"""

from __future__ import annotations

import asyncio
import time

import pytest

from app.core.multi_agent_config_gate import (
    DEFAULT_CONFIG,
    DEFAULT_SUBAGENT_CONTEXT_TOKEN_BUDGET,
    MultiAgentConfig,
    clip_messages_to_token_budget,
    estimate_messages_tokens,
    clamp_wait_timeout_s,
    resolve_config,
)
from app.services import subagent_jobs as jobs


@pytest.fixture(autouse=True)
def _clean_jobs():
    jobs.reset_subagent_jobs()
    yield
    jobs.reset_subagent_jobs()


def _cfg(**kw) -> MultiAgentConfig:
    base = {
        "min_wait_timeout_ms": 1000,
        "max_wait_timeout_ms": 60000,
        "default_wait_timeout_ms": 30000,
        "max_concurrent_threads_per_session": 5,
    }
    base.update(kw)
    return MultiAgentConfig(**base)


# ---------- 纯判据:clamp_wait_timeout_s ----------


def test_clamp_none_and_nonpositive_use_default():
    assert clamp_wait_timeout_s(None) == 30.0
    assert clamp_wait_timeout_s(0) == 30.0
    assert clamp_wait_timeout_s(-5) == 30.0


def test_clamp_within_bounds_returns_requested():
    assert clamp_wait_timeout_s(5.0) == 5.0
    assert clamp_wait_timeout_s(30.0) == 30.0
    assert clamp_wait_timeout_s(60.0) == 60.0  # 恰好 max


def test_clamp_above_max_compresses_to_max():
    assert clamp_wait_timeout_s(300.0) == 60.0  # 旧裸上限 300s 现压到 max 60s


def test_clamp_preserves_short_probe_below_min():
    """极短探测(< min)保留原值——min 是配置自洽校验,不是运行时地板。"""
    assert clamp_wait_timeout_s(0.2) == 0.2


def test_clamp_honours_injected_config():
    cfg = _cfg(min_wait_timeout_ms=500, max_wait_timeout_ms=4000, default_wait_timeout_ms=2000)
    assert clamp_wait_timeout_s(None, cfg) == 2.0
    assert clamp_wait_timeout_s(300.0, cfg) == 4.0
    # < min 的极短探测不再抬升
    assert clamp_wait_timeout_s(0.1, cfg) == 0.1


def test_resolve_config_defaults_to_60000():
    """零配置时 resolve_config 回落 DEFAULT_CONFIG（settings 默认值一致）。"""
    assert resolve_config() == DEFAULT_CONFIG
    assert resolve_config().max_wait_timeout_ms == 60000


# ---------- 子代理 context 预算隔离:clip_messages_to_token_budget ----------


def _std_messages() -> list[dict]:
    """system + 5 条中段历史 + 末轮 user。"""
    return (
        [{"role": "system", "content": "S" * 100}]
        + [{"role": "assistant" if i % 2 else "user", "content": "X" * 200} for i in range(5)]
        + [{"role": "user", "content": "Q" * 100}]
    )


def test_clip_noop_under_budget():
    """未超预算 → 原样内容返回（新列表，不改入参）。"""
    msgs = _std_messages()
    out = clip_messages_to_token_budget(msgs, DEFAULT_SUBAGENT_CONTEXT_TOKEN_BUDGET)
    assert out == msgs
    assert out is not msgs


def test_clip_drops_oldest_middle_keeps_system_and_last_user():
    """超预算 → 丢最旧中段，保 system + 末轮 user。"""
    msgs = _std_messages()
    out = clip_messages_to_token_budget(msgs, 300)
    assert out[0]["role"] == "system"
    assert out[-1]["role"] == "user" and out[-1]["content"] == "Q" * 100
    assert len(out) < len(msgs)


def test_clip_tiny_budget_leaves_system_plus_last_user():
    """极小预算 → 只剩 system + 末轮 user（不硬截这两条）。"""
    out = clip_messages_to_token_budget(_std_messages(), 5)
    assert len(out) == 2
    assert out[0]["role"] == "system" and out[-1]["content"] == "Q" * 100


def test_clip_without_system_keeps_last_user():
    """无 system 边界 → 仍保末轮 user，丢中段。"""
    msgs = [
        {"role": "user", "content": "A" * 300},
        {"role": "assistant", "content": "B" * 300},
        {"role": "user", "content": "Q" * 50},
    ]
    out = clip_messages_to_token_budget(msgs, 100)
    assert out[-1]["content"] == "Q" * 50


def test_estimate_messages_tokens_monotonic():
    """估算随内容增长单调不减（保守偏高）。"""
    a = [{"role": "user", "content": "x" * 100}]
    b = [{"role": "user", "content": "x" * 300}]
    assert estimate_messages_tokens(a) < estimate_messages_tokens(b)


# ---------- 运行时:wait_job 真用配置边界 ----------


async def _never_finish_invoker():
    async def _invoke():
        await asyncio.sleep(3600)  # 永不完成,逼 wait 走满边界
        return {}

    return _invoke


async def _spawn_running_job() -> str:
    started = await jobs.start_job(
        name="never_finish",
        task="x",
        user_id="u1",
        session_id="s1",
        invoker=await _never_finish_invoker(),
    )
    assert started["ok"], started
    return started["job"]["job_id"]


@pytest.mark.asyncio
async def test_wait_job_uses_default_when_wait_s_nonpositive(monkeypatch):
    job_id = await _spawn_running_job()
    monkeypatch.setattr(jobs, "clamp_wait_timeout_s", lambda s, cfg=None: 1.0)
    t0 = time.monotonic()
    out = await jobs.wait_job(job_id, user_id="u1", session_id="s1", wait_s=0)
    elapsed = time.monotonic() - t0
    assert out["ok"] is False  # 作业仍在跑
    assert out["status"] == "running"
    assert elapsed < 5.0  # 只等了夹紧后的 1s,不是裸 default
    assert "已等待" in out["message"]


@pytest.mark.asyncio
async def test_wait_job_clamps_wait_s_to_config_max(monkeypatch):
    """wait_s=300 在 max=2s 的配置下只等 ~2s,证明接线生效(旧裸上限是 300s)。"""
    job_id = await _spawn_running_job()
    monkeypatch.setattr(jobs, "clamp_wait_timeout_s", lambda s, cfg=None: 2.0)
    t0 = time.monotonic()
    out = await jobs.wait_job(job_id, user_id="u1", session_id="s1", wait_s=300)
    elapsed = time.monotonic() - t0
    assert out["status"] == "running"
    assert 1.5 <= elapsed < 5.0, f"应只等 ~2s,实际 {elapsed:.2f}s"
    assert "已等待 2" in out["message"]


@pytest.mark.asyncio
async def test_wait_job_returns_finished_without_full_wait():
    """已完成的作业 wait 立即返回终态(夹紧不影响已完成短路)。"""
    started = await jobs.start_job(
        name="quick",
        task="x",
        user_id="u1",
        session_id="s1",
        invoker=_ok_invoker(),
    )
    job_id = started["job"]["job_id"]
    # 等到终态
    await asyncio.sleep(0.05)
    out = await jobs.wait_job(job_id, user_id="u1", session_id="s1", wait_s=30)
    assert out["ok"] is True
    assert out["status"] == "succeeded"


def _ok_invoker():
    async def _invoke():
        await asyncio.sleep(0.01)
        return {"status": "completed", "output": "ok", "ok": True}

    return _invoke
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
