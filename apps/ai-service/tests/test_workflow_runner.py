# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""run_workflow 行为钉(tests):对齐 Workflow/RunWorkflow 的 resume_from_run_id 语义。

四条必钉事实(票面验收):
① 同 run_id 下入参未变的节点第二次**不执行**(断言执行计数,不只看返回值);
② 入参变了则该节点重跑(其余未变节点仍不回执行);
③ 正向对照:不带 resume 时每次全量执行;
④ run 不存在 / 脚本非法 / 主体缺失 / 跨租户 ⇒ 显式未判定错误码,且零执行(副作用断言)。

测试隔离(AGENTS §5):不连生产库/Redis;执行体走 `node_call` 注入缝,
判据(hash/续跑存储)一行都不在测试里复制(§22c)。
"""

from __future__ import annotations

from typing import Any

from app.services.task_executors import CheckpointStore
from app.services.workflow_runner import (
    ERR_FORBIDDEN,
    ERR_PRINCIPAL_REQUIRED,
    ERR_RUN_NOT_FOUND,
    ERR_SCRIPT_INVALID,
    run_workflow,
)


class Recorder:
    """替身执行体:记录每次真实调用(次数 = 执行计数的唯一断言依据)。"""

    def __init__(self, fail_agents: set[str] | None = None) -> None:
        self.calls: list[tuple[str, dict[str, Any]]] = []
        self._fail_agents = fail_agents or set()

    async def __call__(
        self, agent: str, arguments: dict[str, Any], upstream: dict[str, Any], principal: str
    ) -> dict[str, Any]:
        if agent in self._fail_agents:
            msg = f"boom:{agent}"
            raise RuntimeError(msg)
        self.calls.append((agent, dict(arguments)))
        return {"agent": agent, "arguments": dict(arguments), "by": principal, "upstream": sorted(upstream)}

    @property
    def count(self) -> int:
        return len(self.calls)


def _script(topic: str = "v1") -> list[dict[str, Any]]:
    return [
        {"id": "research", "agent": "analyze", "arguments": {"topic": topic}},
        {"id": "write", "agent": "compose", "arguments": {"tone": "plain"}, "depends_on": ["research"]},
    ]


async def test_resume_unchanged_inputs_never_reexecute() -> None:
    """① 同 run_id、入参未变 ⇒ 第二遍零执行,全部瞬时回缓存且结果逐字节同。"""
    store = CheckpointStore()
    rec = Recorder()
    first = await run_workflow(_script(), principal="u1", node_call=rec, store=store)
    assert first["ok"] is True and first["executed"] == ["research", "write"]
    assert rec.count == 2

    second = await run_workflow(
        _script(), principal="u1", resume_from_run_id=first["run_id"], node_call=rec, store=store
    )
    assert second["executed"] == []
    assert second["cached"] == ["research", "write"]
    assert rec.count == 2  # 执行计数没有从 2 变 4 —— 这才是"没重跑"
    assert second["results"] == first["results"]


async def test_changed_input_reexecutes_only_that_node() -> None:
    """② 入参变了的节点重跑;入参未变的其余节点仍不回执行。"""
    store = CheckpointStore()
    rec = Recorder()
    first = await run_workflow(_script("v1"), principal="u1", node_call=rec, store=store)
    assert rec.count == 2

    second = await run_workflow(
        _script("v2"), principal="u1", resume_from_run_id=first["run_id"], node_call=rec, store=store
    )
    assert second["executed"] == ["research"]
    assert second["cached"] == ["write"]
    assert rec.count == 3


async def test_without_resume_every_run_executes_all() -> None:
    """③ 正向对照:不带 resume 的两遍全量执行(缓存不是白捡的假象)。"""
    store = CheckpointStore()
    rec = Recorder()
    first = await run_workflow(_script(), principal="u1", node_call=rec, store=store)
    second = await run_workflow(_script(), principal="u1", node_call=rec, store=store)
    assert first["run_id"] != second["run_id"]
    assert rec.count == 4
    assert second["cached"] == []


async def test_unknown_run_is_undetermined_with_zero_side_effects() -> None:
    """④a run 不存在 ⇒ 显式未判定 + 零执行(不猜"当作全未命中"也不猜"当作命中")。"""
    store = CheckpointStore()
    rec = Recorder()
    out = await run_workflow(_script(), principal="u1", resume_from_run_id="ghost", node_call=rec, store=store)
    assert out["ok"] is False
    assert out["errorCode"] == ERR_RUN_NOT_FOUND
    assert out["status"] == "undetermined"
    assert rec.count == 0


async def test_invalid_script_is_undetermined_with_zero_side_effects() -> None:
    """④b 脚本非法(空/环/悬空依赖/缺字段)⇒ 未判定 + 零执行 + 不落任何档。"""
    store = CheckpointStore()
    rec = Recorder()
    bad_cases: list[Any] = [
        [],
        "not-a-list",
        [{"id": "a", "agent": "x"}, {"id": "a", "agent": "y"}],  # id 重复
        [{"id": "a", "agent": "x", "depends_on": ["b"]}, {"id": "b", "agent": "y", "depends_on": ["a"]}],  # 环
        [{"id": "a", "agent": "x", "depends_on": ["missing"]}],  # 依赖不存在
        [{"id": "", "agent": "x"}],  # 缺 id
        [{"id": "a", "agent": ""}],  # 缺 agent
    ]
    for bad in bad_cases:
        out = await run_workflow(bad, principal="u1", node_call=rec, store=store)
        assert out["ok"] is False and out["errorCode"] == ERR_SCRIPT_INVALID, bad
    assert rec.count == 0


async def test_missing_principal_is_rejected_before_any_execution() -> None:
    """④c 主体缺失/空白 ⇒ 未判定 + 零执行(归属主体必须承载层显式传入)。"""
    store = CheckpointStore()
    rec = Recorder()
    for empty in ("", "   ", None):
        out = await run_workflow(_script(), principal=empty, node_call=rec, store=store)  # type: ignore[arg-type]
        assert out["ok"] is False and out["errorCode"] == ERR_PRINCIPAL_REQUIRED
    assert rec.count == 0


async def test_cross_tenant_resume_forbidden_with_zero_execution() -> None:
    """④d 租户隔离:A 的 run 由 B 续跑 ⇒ WORKFLOW_FORBIDDEN 且不新增任何执行。"""
    store = CheckpointStore()
    rec = Recorder()
    first = await run_workflow(_script(), principal="u1", node_call=rec, store=store)
    assert rec.count == 2
    out = await run_workflow(
        _script(), principal="u2", resume_from_run_id=first["run_id"], node_call=rec, store=store
    )
    assert out["ok"] is False and out["errorCode"] == ERR_FORBIDDEN
    assert rec.count == 2  # 拒绝路径零节点执行


async def test_failed_node_reruns_on_resume_and_downstream_skipped() -> None:
    """失败节点不伪装成缓存:上游失败 ⇒ 下游显式 skipped;修复后续跑只重执行失败族。"""
    store = CheckpointStore()
    rec = Recorder(fail_agents={"analyze"})
    first = await run_workflow(_script(), principal="u1", node_call=rec, store=store)
    assert first["ok"] is False and first["status"] == "failed"  # 无一成功 ⇒ failed(与 DAG 三档词汇同口径)
    assert "research" in first["failed"]
    assert first["skipped"] == {"write": "upstream_did_not_produce_result"}
    assert rec.count == 0  # analyze 抛错未入 calls;write 被跳过未执行

    healthy = Recorder(fail_agents=set())
    second = await run_workflow(
        _script(), principal="u1", resume_from_run_id=first["run_id"], node_call=healthy, store=store
    )
    assert second["ok"] is True
    assert second["executed"] == ["research", "write"]  # 失败过的节点续跑必重算,不冒充命中
    assert second["cached"] == []
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
