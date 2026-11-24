# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""多智能体团队协作服务单测(agent_teams)。

覆盖:
- ResultAggregator.aggregate:
  - merge:按 [name] 归属拼接输出,一致/不一致结论的共识与冲突标记
  - best_of:按 score 择优 + 无 score 时按输出长度降级
  - consensus:严格多数共识 / 平票冲突分裂
  - 边界:空输入 / 全部失败 / 部分失败降级(不抛错)
- TeamOrchestrator.run_round:
  - 注入 fake runner 成功链路(summary_context 含目标/建议)
  - 空 tasks 不派发、不抛错
  - 部分失败 → partial=True、failed 计数、summary 含失败标记
  - 默认 runner 走 orchestrator.invoke_parallel + conclusion 透传
- run_multi_rounds:上一轮聚合摘要经 round_context 回传给下一轮(闭环)
- 路由:aggregate 纯聚合 / round 经猴子替换 runner 避免真实 LLM
"""

from __future__ import annotations

import pytest

from app.services.agent_teams import (
    ResultAggregator,
    TeamContributor,
    TeamOrchestrator,
    team_orchestrator,
)


def _contributor(name, status="completed", output="ok", conclusion="", score=None, error=None):
    return TeamContributor(
        name=name, task=f"task-{name}", status=status,
        output=output, conclusion=conclusion, score=score, error=error,
    )


# =============================================================================
# TeamContributor.from_task_result — 结构化尾巴解析(2026-11-16)
# =============================================================================


def test_from_task_result_parses_conclusion_and_score_from_output():
    """invoke_parallel 不产出 conclusion/score 时,从正文尾巴解析。"""
    contributor = TeamContributor.from_task_result({
        "name": "a", "task": "t", "status": "completed",
        "output": "分析过程...\n结论：采用方案 B\n评分：88",
        "duration_ms": 12.0,
    })
    assert contributor.conclusion == "采用方案 B"
    assert contributor.score == 88.0


def test_from_task_result_prefers_explicit_fields():
    contributor = TeamContributor.from_task_result({
        "name": "a", "task": "t", "status": "completed",
        "output": "结论：正文结论\n评分：10",
        "conclusion": "显式结论", "score": 99,
    })
    assert contributor.conclusion == "显式结论"
    assert contributor.score == 99.0


def test_from_task_result_ignores_echoed_placeholder():
    """模型原样回抄模板占位符时,不能当成真实结论。"""
    contributor = TeamContributor.from_task_result({
        "name": "a", "task": "t", "status": "completed",
        "output": "结论：<一句话结论>\n评分：<0-100 的整数>",
    })
    assert contributor.conclusion == ""
    assert contributor.score is None


def test_from_task_result_clamps_score_and_ignores_bool():
    clamped = TeamContributor.from_task_result({
        "name": "a", "task": "t", "status": "completed",
        "output": "评分：180",
    })
    assert clamped.score == 100.0
    boolean = TeamContributor.from_task_result({
        "name": "b", "task": "t", "status": "completed",
        "output": "无结构化尾巴", "score": True,
    })
    assert boolean.score is None
    assert boolean.conclusion == ""


# =============================================================================
# ResultAggregator.aggregate — merge
# =============================================================================


def test_merge_concatenates_with_attribution():
    """merge:按 [name] 归属拼接输出,一致结论 → 无冲突。"""
    result = ResultAggregator.aggregate([
        _contributor("a", output="A 产出", conclusion="ready"),
        _contributor("b", output="B 产出", conclusion="ready"),
    ], strategy="merge")
    assert result["strategy"] == "merge"
    assert result["succeeded"] == 2
    assert result["failed"] == 0
    assert result["partial"] is False
    assert "[a]" in result["merged_text"] and "A 产出" in result["merged_text"]
    assert "[b]" in result["merged_text"] and "B 产出" in result["merged_text"]
    assert result["has_conflict"] is False
    assert result["consensus"]["value"] == "ready"
    assert "一致" in result["recommendation"]


def test_merge_conflict_detection():
    """merge:结论不一致 → has_conflict=True,conflicts 列出各派结论。"""
    result = ResultAggregator.aggregate([
        _contributor("a", conclusion="deploy"),
        _contributor("b", conclusion="deploy"),
        _contributor("c", conclusion="hold"),
    ], strategy="merge")
    assert result["has_conflict"] is True
    assert result["conflicts"] != []
    values = {c["value"] for c in result["conflicts"]}
    assert values == {"deploy", "hold"}
    assert "分歧" in result["recommendation"]


def test_merge_ignores_failed_only_consensus_among_completed():
    """merge:只对 completed 做结论分组,失败者不参与共识。"""
    result = ResultAggregator.aggregate([
        _contributor("a", conclusion="yes"),
        _contributor("b", status="failed", error="boom"),
    ], strategy="merge")
    assert result["succeeded"] == 1
    assert result["failed"] == 1
    assert result["partial"] is True
    assert result["consensus"]["value"] == "yes"
    assert result["has_conflict"] is False


# =============================================================================
# best_of
# =============================================================================


def test_best_of_picks_highest_score():
    """best_of:按 score 择优,winner 为评分最高者,merged_text 为其输出。"""
    result = ResultAggregator.aggregate([
        _contributor("low", output="短", score=40),
        _contributor("hi", output="详细输出", score=95),
        _contributor("mid", output="中", score=60),
    ], strategy="best_of")
    assert result["winner"]["name"] == "hi"
    assert result["winner"]["score"] == 95
    assert result["merged_text"] == "详细输出"


def test_best_of_fallback_output_length_without_scores():
    """best_of:无 score 时以输出长度降级择优。"""
    result = ResultAggregator.aggregate([
        _contributor("short", output="a"),
        _contributor("long", output="a much longer output"),
    ], strategy="best_of")
    assert result["winner"]["name"] == "long"


def test_best_of_no_success_no_winner():
    """best_of:全部失败 → 无 winner,确定性降级不抛错。"""
    result = ResultAggregator.aggregate([
        _contributor("a", status="failed", error="x"),
    ], strategy="best_of")
    assert result["winner"] is None
    assert result["succeeded"] == 0
    assert result["failed"] == 1
    assert result["partial"] is True


# =============================================================================
# consensus
# =============================================================================


def test_consensus_strict_majority():
    """consensus:严格多数 → consensus 锁定多数派。"""
    result = ResultAggregator.aggregate([
        _contributor("a", conclusion="green"),
        _contributor("b", conclusion="green"),
        _contributor("c", conclusion="red"),
    ], strategy="consensus")
    assert result["consensus"]["value"] == "green"
    assert result["consensus"]["count"] == 2
    # 存在少数派异议 → 标记为冲突(分歧存在)
    assert result["has_conflict"] is True
    assert "green" in result["merged_text"]


def test_consensus_tie_yields_conflict():
    """consensus:平票 → 无共识,conflicts 分裂标记。"""
    result = ResultAggregator.aggregate([
        _contributor("a", conclusion="x"),
        _contributor("b", conclusion="y"),
    ], strategy="consensus")
    assert result["consensus"] is None
    assert result["has_conflict"] is True
    assert len(result["conflicts"]) == 2


def test_consensus_unanimous():
    """consensus:全部一致 → 唯一结论即共识。"""
    result = ResultAggregator.aggregate([
        _contributor("a", conclusion="ok"),
        _contributor("b", conclusion="ok"),
        _contributor("c", conclusion="ok"),
    ], strategy="consensus")
    assert result["consensus"]["value"] == "ok"
    assert result["consensus"]["count"] == 3
    assert result["has_conflict"] is False


def test_consensus_ignores_empty_conclusions():
    """consensus:空结论不参与分组。"""
    result = ResultAggregator.aggregate([
        _contributor("a", output="no conclusion"),
        _contributor("b", conclusion="solid"),
    ], strategy="consensus")
    assert result["consensus"]["value"] == "solid"
    assert result["has_conflict"] is False


# =============================================================================
# 边界
# =============================================================================


def test_empty_input_returns_empty_aggregation():
    """空输入:确定性降级,不抛错。"""
    result = ResultAggregator.aggregate([], strategy="merge")
    assert result["succeeded"] == 0
    assert result["failed"] == 0
    assert result["partial"] is False
    assert result["merged_text"] == ""
    assert "空输入" in result["recommendation"]


def test_all_failed_returns_deterministic():
    """全部失败:merged_text 为空,建议提示重试。"""
    result = ResultAggregator.aggregate([
        _contributor("a", status="failed", error="e1"),
        _contributor("b", status="failed", error="e2"),
    ], strategy="merge")
    assert result["succeeded"] == 0
    assert result["failed"] == 2
    assert result["partial"] is True
    assert result["merged_text"] == ""
    assert "重试" in result["recommendation"]


# =============================================================================
# TeamOrchestrator.run_round
# =============================================================================


async def test_run_round_success_with_injected_runner():
    """注入 fake runner → 粉丝 out + 聚合成功,summary_context 含目标与建议。"""
    async def fake_runner(tasks, max_concurrency):
        return [
            TeamContributor(name=t["name"], task=t["task"], status="completed",
                            output=f"out-{t['name']}", conclusion="go")
            for t in tasks
        ]

    orch = TeamOrchestrator(orchestrator=object())  # runner 注入,不使用真实 orchestrator
    result = await orch.run_round(
        objective="判断是否发布",
        tasks=[{"name": "a", "task": "调研"}, {"name": "b", "task": "验证"}],
        strategy="merge",
        runner=fake_runner,
    )
    assert result.succeeded == 2
    assert result.failed == 0
    assert result.partial is False
    assert result.aggregate["consensus"]["value"] == "go"
    assert "判断是否发布" in result.summary_context
    assert "建议" in result.summary_context
    assert "out-a" in result.summary_context
    assert result.round_index == 0 and result.round_count == 1


async def test_run_round_empty_tasks_no_dispatch():
    """空 tasks → 不调用 runner,不抛错,空聚合。"""
    called = {"n": 0}

    async def fake_runner(tasks, max_concurrency):
        called["n"] += 1
        return [TeamContributor(name="x", task="", status="failed", error="should-not")]

    orch = TeamOrchestrator(orchestrator=object())
    result = await orch.run_round(
        objective="空目标", tasks=[], runner=fake_runner
    )
    assert called["n"] == 0
    assert result.contributors == []
    assert result.succeeded == 0
    assert result.partial is False
    assert "空输入" in result.aggregate["recommendation"]


async def test_run_round_partial_failure_marked():
    """部分失败 → partial=True、failed=1、summary 含失败标记。"""
    async def partial_runner(tasks, max_concurrency):
        return [
            _contributor("coder", output="ok")
            if t["name"] != "debugger"
            else _contributor("debugger", status="failed", error="boom")
            for t in tasks
        ]

    orch = TeamOrchestrator(orchestrator=object())
    result = await orch.run_round(
        objective="修复回归",
        tasks=[{"name": "coder", "task": "写"}, {"name": "debugger", "task": "调"}],
        runner=partial_runner,
    )
    assert result.succeeded == 1
    assert result.failed == 1
    assert result.partial is True
    assert result.aggregate["partial"] is True
    assert "boom" in result.summary_context


async def test_default_runner_uses_invoke_parallel_and_passes_conclusion():
    """默认 runner 走 orchestrator.invoke_parallel,并把 task 的 conclusion 附到贡献者。"""
    class _FakeOrch:
        def __init__(self):
            self.invoked_tasks = None

        async def invoke_parallel(self, tasks, max_concurrency=5):
            self.invoked_tasks = tasks
            return {
                "results": [
                    {"name": t["name"], "task": t["task"], "status": "completed",
                     "output": "done", "error": None, "duration_ms": 1.0}
                    for t in tasks
                ],
                "ok": True,
            }

    fake = _FakeOrch()
    orch = TeamOrchestrator(orchestrator=fake)
    result = await orch.run_round(
        objective="并行验证",
        tasks=[
            {"name": "coder", "task": "A", "conclusion": "ready"},
            {"name": "reviewer", "task": "B", "conclusion": "ready"},
        ],
        max_concurrency=2,
    )
    assert fake.invoked_tasks is not None
    # invoke_parallel 收到的 tasks 是 {name,task,context}
    assert fake.invoked_tasks[0]["name"] == "coder"
    assert result.succeeded == 2
    # conclusion 已透传到贡献者 → 共识 ready,无冲突
    assert result.aggregate["consensus"]["value"] == "ready"
    assert result.aggregate["has_conflict"] is False


# =============================================================================
# run_multi_rounds — 聚合回传主循环闭环
# =============================================================================


async def test_multi_rounds_feeds_summary_into_next_round():
    """多轮:第 2 轮各 subagent 的 context 里注入第 1 轮聚合摘要(round_context)。"""
    received: list[dict] = []

    async def fake_runner(tasks, max_concurrency):
        received.append(tasks)
        return [
            TeamContributor(name=t["name"], task=t["task"], status="completed",
                            output="res", conclusion="v1")
            for t in tasks
        ]

    orch = TeamOrchestrator(orchestrator=object())
    data = await orch.run_multi_rounds(
        objective="端到端闭环",
        rounds=[
            {"tasks": [{"name": "alpha", "task": "第一轮"}], "strategy": "merge"},
            {
                "tasks": [
                    {"name": "beta", "task": "基于上轮决策"},
                    {"name": "gamma", "task": "复核"},
                ]
            },
        ],
        runner=fake_runner,
    )
    assert len(data["rounds"]) == 2
    assert len(received) == 2
    first_round_tasks = received[0]
    second_round_tasks = received[1]
    assert len(first_round_tasks) == 1
    # 第 2 轮任务 context 带上了第 1 轮摘要
    assert second_round_tasks[0]["context"] is not None
    assert "round_context" in second_round_tasks[0]["context"]
    round_ctx = second_round_tasks[0]["context"]["round_context"]
    assert "第一" in round_ctx or "round 1" in round_ctx
    # 末轮聚合摘要作为最终回传主循环上下文
    assert data["final_summary_context"] != ""
    assert "端到端闭环" in data["final_summary_context"]


async def test_multi_rounds_empty_rounds():
    """空轮次列表 → 确定性返回,无 final_summary_context。"""
    orch = TeamOrchestrator(orchestrator=object())
    data = await orch.run_multi_rounds("目标", [])
    assert data["rounds"] == []
    assert data["final_summary_context"] == ""


# =============================================================================
# 路由
# =============================================================================


async def test_aggregate_router_pure(client, monkeypatch):
    """POST /orchestration/teams/aggregate → 纯聚合结果。"""
    body = {"contributors": [
        {"name": "a", "task": "t1", "status": "completed", "output": "A", "conclusion": "go"},
        {"name": "b", "task": "t2", "status": "completed", "output": "B", "conclusion": "go"},
    ], "strategy": "merge"}
    resp = await client.post("/api/orchestration/teams/aggregate", json=body)
    data = resp.json()["data"]
    assert data["succeeded"] == 2
    assert data["consensus"]["value"] == "go"
    assert data["has_conflict"] is False


async def test_aggregate_router_empty(client, monkeypatch):
    """aggregate 空 contributors → 确定性降级不报错。"""
    resp = await client.post(
        "/api/orchestration/teams/aggregate",
        json={"contributors": [], "strategy": "best_of"},
    )
    assert resp.json()["code"] == 0
    assert resp.json()["data"]["succeeded"] == 0


async def test_round_router_success(client, monkeypatch):
    """POST /orchestration/teams/round → 用替换 runner 返回 TeamRoundResult dict。"""
    async def fake_run_round(**kwargs):  # noqa: ANN003
        from app.services.agent_teams import TeamRoundResult

        rr = TeamRoundResult(
            round_id="r1", objective=kwargs["objective"], strategy="merge",
            contributors=[_contributor("coder", output="done", conclusion="go")],
            succeeded=1, failed=0, partial=False,
            aggregate={"consensus": {"value": "go"}, "recommendation": "ok"},
            summary_context="summary-block",
        )
        return rr

    monkeypatch.setattr(team_orchestrator, "run_round", fake_run_round)
    resp = await client.post("/api/orchestration/teams/round", json={
        "objective": "目标",
        "tasks": [{"name": "coder", "task": "写"}],
        "strategy": "merge",
    })
    assert resp.json()["code"] == 0
    assert resp.json()["data"]["summary_context"] == "summary-block"
    assert resp.json()["data"]["objective"] == "目标"


# =============================================================================
# TeamOrchestrator.run_recursive —— RLM 的**整合档**(复用 run_round/聚合/并发闸)
# =============================================================================


async def _echo_runner(size: int = 0):
    """fake runner:每支回一条带名字的结论;size>0 时结论正文加长为指定量。"""

    async def _run(tasks, max_concurrency):
        return [
            TeamContributor(
                name=t["name"],
                task=t["task"],
                status="completed",
                output=f"结论[{t['name']}]" + ("x" * size),
            )
            for t in tasks
        ]

    return _run


async def test_recursive_single_layer_map_reduce():
    """depth=1:每片一个 member,仅一层,汇总正文含各片结论。"""
    runner = await _echo_runner()
    orch = TeamOrchestrator(orchestrator=object())
    res = await orch.run_recursive(
        objective="定位失败原因", chunks=["日志A", "日志B"], runner=runner, depth=1
    )
    assert res["nodes"] == 2
    assert len(res["levels"]) == 1
    assert "结论[part-1]" in res["merged_text"]
    assert "定位失败原因" in res["final_summary_context"]


async def test_recursive_second_layer_when_over_budget():
    """聚合正文超预算 → 自动再切一层(层数受 depth 夹紧)。"""
    runner = await _echo_runner(size=3000)
    orch = TeamOrchestrator(orchestrator=object())
    res = await orch.run_recursive(
        objective="归纳", chunks=["片1"], runner=runner, depth=2, max_chars_per_node=1000
    )
    assert len(res["levels"]) == 2
    assert res["nodes"] > 1


async def test_recursive_node_limit_rejects(monkeypatch: pytest.MonkeyPatch):
    """节点预算与子代理并发闸同源:env 压到 1 时两片立刻整次拒绝。"""
    monkeypatch.setenv("IHUI_MAX_RUNNING_SUBAGENTS", "1")
    runner = await _echo_runner()
    orch = TeamOrchestrator(orchestrator=object())
    res = await orch.run_recursive(
        objective="o", chunks=["a", "b"], runner=runner, depth=1
    )
    assert res["ok"] is False
    assert res["errorCode"] == "RECURSIVE_NODE_LIMIT"
    assert res["limit"] == 1


async def test_recursive_empty_chunks_skips():
    runner = await _echo_runner()
    orch = TeamOrchestrator(orchestrator=object())
    res = await orch.run_recursive(objective="o", chunks=["  "], runner=runner)
    assert res["nodes"] == 0 and res["skipped"] == "no_chunks"


async def test_recursive_endpoint_contract(client, monkeypatch: pytest.MonkeyPatch):
    """路由契约:超预算回 code=400(可判拒绝),成功回 code=0 且透传 levels/nodes。"""
    async def fake_recursive(**kwargs):
        return {"ok": False, "errorCode": "RECURSIVE_NODE_LIMIT", "error": "超了", "limit": 20}

    monkeypatch.setattr(team_orchestrator, "run_recursive", fake_recursive)
    resp = await client.post("/api/orchestration/teams/recursive", json={
        "objective": "o", "chunks": ["a"], "depth": 1,
    })
    assert resp.json()["code"] == 400
    assert resp.json()["data"]["errorCode"] == "RECURSIVE_NODE_LIMIT"

    async def fake_ok(**kwargs):
        return {"objective": "o", "depth": 1, "levels": [], "nodes": 1,
                "merged_text": "", "final_summary_context": ""}

    monkeypatch.setattr(team_orchestrator, "run_recursive", fake_ok)
    resp2 = await client.post("/api/orchestration/teams/recursive", json={
        "objective": "o", "chunks": ["a"], "depth": 1,
    })
    assert resp2.json()["code"] == 0
    assert resp2.json()["data"]["nodes"] == 1
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
