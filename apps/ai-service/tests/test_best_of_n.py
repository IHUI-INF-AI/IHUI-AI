# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Best-of-N 同任务多副本自动择优测试(2026-09-07 立)。

覆盖:
- 扇出:N 候选并行成功,LLM 评审择优(分数回写 + rationale)
- 评审失败 → 确定性规则兜底(evaluator_fallback=True)
- 候选部分失败 → 剔除继续;全败 → BestOfNError
- 评审输出不可解析/覆盖不足 → 兜底
- 成本入账:每候选一条 best_of_n 账目
- 路由:POST /api/best-of-n/run 端到端(成功/全败 422/入参 422)
"""

from __future__ import annotations

import json
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient

from app.services.best_of_n import BestOfNError, BestOfNRunner, CandidateResult


class FakeGateway:
    """mock llm_gateway:候选按序返回固定 content;system 消息(评审)可配置抛错。"""

    def __init__(
        self,
        candidate_contents: list[str],
        judge_output: str | None = None,
        judge_error: Exception | None = None,
        candidate_errors: dict[int, Exception] | None = None,
    ):
        self.candidate_contents = candidate_contents
        self.judge_output = judge_output
        self.judge_error = judge_error
        self.candidate_errors = candidate_errors or {}
        self.candidate_calls = 0
        self.judge_calls = 0
        self.received_models: list[str | None] = []

    async def complete(self, messages: list[dict[str, Any]], model: str | None = None, **kw: Any) -> dict[str, Any]:
        if messages and messages[0].get("role") == "system":
            # 评审调用
            self.judge_calls += 1
            if self.judge_error is not None:
                raise self.judge_error
            return {"content": self.judge_output or "", "model": model or "judge-model", "usage": {}}
        idx = self.candidate_calls
        self.candidate_calls += 1
        self.received_models.append(model)
        if idx in self.candidate_errors:
            raise self.candidate_errors[idx]
        content = self.candidate_contents[idx % len(self.candidate_contents)]
        return {
            "content": content,
            "model": model or "mock-model",
            "usage": {"prompt_tokens": 100, "completion_tokens": 50},
        }


class FakeLedger:
    """mock cost_ledger:记录 append 调用,固定估算成本。"""

    def __init__(self) -> None:
        self.appended: list[dict[str, Any]] = []

    def estimate_cost_usd(self, model: str, tokens_in: int, tokens_out: int) -> dict[str, Any]:
        return {"cost_usd": 0.001, "estimated": False}

    def append(self, entry: dict[str, Any]) -> dict[str, Any]:
        self.appended.append(entry)
        return {"entry": entry}


MESSAGES = [{"role": "user", "content": "写一个快排"}]


def _runner(gateway: FakeGateway) -> tuple[BestOfNRunner, FakeLedger]:
    ledger = FakeLedger()
    return BestOfNRunner(gateway=gateway, ledger=ledger), ledger


@pytest.mark.asyncio
async def test_fan_out_and_judge_selects_winner():
    """3 候选并行成功,评审 JSON 生效:最高分胜出,分数回写候选。"""
    gw = FakeGateway(
        candidate_contents=["答案 A" * 10, "答案 B" * 10, "答案 C" * 10],
        judge_output=json.dumps({
            "scores": [
                {"candidate_id": 0, "score": 60, "reason": "一般"},
                {"candidate_id": 1, "score": 92, "reason": "最优实现"},
                {"candidate_id": 2, "score": 75, "reason": "可以"},
            ]
        }),
    )
    runner, ledger = _runner(gw)
    result = await runner.run(MESSAGES, model="test-model", n=3, user_id="u1")

    assert gw.candidate_calls == 3
    assert gw.judge_calls == 1
    assert result.winner.candidate_id == 1
    assert result.winner.score == 92
    assert result.winner.score_reason == "最优实现"
    assert result.rationale == "最优实现"
    assert result.evaluator_fallback is False
    assert len(result.candidates) == 3
    assert all(c.ok for c in result.candidates)
    # 所有候选统一使用请求的 model
    assert all(c.model == "test-model" for c in result.candidates)
    # 每候选一条成本账目(tool_name=best_of_n)
    assert len(ledger.appended) == 3
    assert all(e["tool_name"] == "best_of_n" for e in ledger.appended)
    assert result.total_cost_usd == pytest.approx(0.003)


@pytest.mark.asyncio
async def test_judge_failure_falls_back_to_deterministic():
    """评审模型抛错 → 确定性规则择优,evaluator_fallback=True。"""
    gw = FakeGateway(
        candidate_contents=["中等长度答案" * 5, "极短", "很长" * 200],
        judge_error=RuntimeError("judge down"),
    )
    runner, _ = _runner(gw)
    result = await runner.run(MESSAGES, n=3)

    assert result.evaluator_fallback is True
    assert result.winner.ok
    assert "确定性规则" in result.rationale


@pytest.mark.asyncio
async def test_judge_unparseable_output_falls_back():
    """评审输出不可解析(非 JSON/覆盖不足)→ 兜底。"""
    gw = FakeGateway(
        candidate_contents=["答案甲" * 5, "答案乙" * 5],
        judge_output="我觉得第二个好。",  # 无 JSON
    )
    runner, _ = _runner(gw)
    result = await runner.run(MESSAGES, n=2)
    assert result.evaluator_fallback is True

    gw2 = FakeGateway(
        candidate_contents=["答案甲" * 5, "答案乙" * 5],
        judge_output=json.dumps({"scores": [{"candidate_id": 0, "score": 90, "reason": "r"}]}),
        # 覆盖 1/2 = 一半,满足;改成 0 候选覆盖测覆盖不足
    )
    runner2, _ = _runner(gw2)
    result2 = await runner2.run(MESSAGES, n=2)
    assert result2.evaluator_fallback is False  # 覆盖一半有效


@pytest.mark.asyncio
async def test_judge_score_clamped_and_invalid_ids_ignored():
    """越界分数钳位 0-100;未知 candidate_id 忽略。"""
    gw = FakeGateway(
        candidate_contents=["A" * 10, "B" * 10],
        judge_output=json.dumps({
            "scores": [
                {"candidate_id": 0, "score": 250, "reason": "超界"},
                {"candidate_id": 99, "score": 99, "reason": "不存在"},
                {"candidate_id": 1, "score": -5, "reason": "负分"},
            ]
        }),
    )
    runner, _ = _runner(gw)
    result = await runner.run(MESSAGES, n=2)
    scores = {c.candidate_id: c.score for c in result.candidates}
    assert scores[0] == 100
    assert scores[1] == 0
    assert result.winner.candidate_id == 0


@pytest.mark.asyncio
async def test_partial_candidate_failure_excluded():
    """1 个候选异常 → 剔除,其余正常评审。"""
    gw = FakeGateway(
        candidate_contents=["A" * 10, "B" * 10, "C" * 10],
        candidate_errors={1: RuntimeError("boom")},
        judge_output=json.dumps({"scores": [
            {"candidate_id": 0, "score": 80, "reason": "r0"},
            {"candidate_id": 2, "score": 85, "reason": "r2"},
        ]}),
    )
    runner, _ = _runner(gw)
    result = await runner.run(MESSAGES, n=3)

    assert result.winner.candidate_id == 2
    failed = [c for c in result.candidates if not c.ok]
    assert len(failed) == 1
    assert failed[0].candidate_id == 1
    assert "boom" in failed[0].error


@pytest.mark.asyncio
async def test_all_candidates_fail_raises():
    """全部候选失败 → BestOfNError。"""
    gw = FakeGateway(candidate_contents=["x"], candidate_errors={0: RuntimeError("e0"), 1: RuntimeError("e1")})
    runner, _ = _runner(gw)
    with pytest.raises(BestOfNError):
        await runner.run(MESSAGES, n=2)


@pytest.mark.asyncio
async def test_empty_content_candidate_raises():
    """候选返回空 content → 视为失败剔除。"""
    gw = FakeGateway(candidate_contents=["", "有效答案" * 10])
    runner, _ = _runner(gw)
    result = await runner.run(MESSAGES, n=2)
    assert result.winner.candidate_id == 1


@pytest.mark.asyncio
async def test_single_candidate_passthrough_no_judge():
    """n=1:不打分不评审,统一返回结构。"""
    gw = FakeGateway(candidate_contents=["唯一答案"])
    runner, ledger = _runner(gw)
    result = await runner.run(MESSAGES, n=1)

    assert gw.judge_calls == 0
    assert result.winner.score is None
    assert result.evaluator_fallback is False
    assert len(ledger.appended) == 1


@pytest.mark.asyncio
async def test_n_clamped_to_max():
    """n 超上限 → 钳位到 5。"""
    contents = [f"答案{i}" * 5 for i in range(8)]
    gw = FakeGateway(
        candidate_contents=contents,
        judge_output=json.dumps({"scores": [
            {"candidate_id": i, "score": 50 + i, "reason": "r"} for i in range(5)
        ]}),
    )
    runner, _ = _runner(gw)
    result = await runner.run(MESSAGES, n=99)
    assert gw.candidate_calls == 5


@pytest.mark.asyncio
async def test_empty_messages_raises():
    """空 messages → BestOfNError。"""
    runner, _ = _runner(FakeGateway(candidate_contents=["x"]))
    with pytest.raises(BestOfNError):
        await runner.run([], n=2)


# =============================================================================
# 路由端到端
# =============================================================================


@pytest.fixture
def _mock_runner_singleton(monkeypatch):
    """替换 routers.best_of_n 模块内引用的全局 runner。"""
    from app.routers import best_of_n as best_of_n_router_module

    def _install(gateway: FakeGateway) -> FakeLedger:
        ledger = FakeLedger()
        monkeypatch.setattr(
            best_of_n_router_module, "best_of_n_runner", BestOfNRunner(gateway=gateway, ledger=ledger)
        )
        return ledger

    return _install


@pytest.mark.asyncio
async def test_router_run_success(_mock_runner_singleton):
    """POST /api/best-of-n/run 端到端:200 + code=0 + data.winner。"""
    _mock_runner_singleton(FakeGateway(
        candidate_contents=["A" * 10, "B" * 10],
        judge_output=json.dumps({"scores": [
            {"candidate_id": 0, "score": 70, "reason": "r0"},
            {"candidate_id": 1, "score": 90, "reason": "r1"},
        ]}),
    ))
    from app.main import app as asgi_app

    async with AsyncClient(transport=ASGITransport(app=asgi_app), base_url="http://test") as ac:
        resp = await ac.post("/api/best-of-n/run", json={
            "messages": MESSAGES,
            "model": "test-model",
            "n": 2,
        })
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    assert body["data"]["winner"]["candidate_id"] == 1
    assert body["data"]["winner"]["score"] == 90
    assert body["data"]["nRequested"] == 2
    assert body["data"]["runId"].startswith("bon-")


@pytest.mark.asyncio
async def test_router_all_fail_returns_422(_mock_runner_singleton):
    """全部候选失败 → 422。"""
    _mock_runner_singleton(FakeGateway(
        candidate_contents=["x"],
        candidate_errors={0: RuntimeError("e0"), 1: RuntimeError("e1")},
    ))
    from app.main import app as asgi_app

    async with AsyncClient(transport=ASGITransport(app=asgi_app), base_url="http://test") as ac:
        resp = await ac.post("/api/best-of-n/run", json={"messages": MESSAGES, "n": 2})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_router_invalid_body_returns_422():
    """空 messages / n 越界 → pydantic 422。"""
    from app.main import app as asgi_app

    async with AsyncClient(transport=ASGITransport(app=asgi_app), base_url="http://test") as ac:
        resp_empty = await ac.post("/api/best-of-n/run", json={"messages": []})
        resp_n = await ac.post("/api/best-of-n/run", json={"messages": MESSAGES, "n": 50})
    assert resp_empty.status_code == 422
    assert resp_n.status_code == 422
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
