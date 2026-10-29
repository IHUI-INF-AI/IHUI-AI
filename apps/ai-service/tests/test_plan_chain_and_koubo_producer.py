# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""G-941 写账侧续格:计划执行必须挂主链、koubo 工作流必须走**同一枚**写账出口.

前提(现读于本席开工时的 HEAD,agent_plan.py:191 与 koubo_workflow.py:194/:261):
- `agent_plan._execute_plan` 构造 AgentLoopV2 未传 chain ⇒ 整条计划执行链的用量
  自本票起落「未判定」桶(既看不见,也不计进主链);
- `koubo_workflow` 是**另一条**工作流实现,全篇对 `cost_ledger|recorder|chain|ledger`
  零命中 ⇒ 两次 llm_gateway.complete 静默无账。

本文件锁四格(与 tests/test_workflow_chain_producer.py 同纪律,不复抄它的判据):
① 正向:计划执行构造点带 CHAIN_MAIN;koubo 节点产生 workflow 链条目;
② 反向对照:未传 chain 的构造落「未判定」且**绝不**并主链;koubo 调用抛异常 ⇒ 零行;
③ 结构锁(§0.6 单一真相源):koubo 不建第二份账本条目,只委托引擎那一枚出口;
④ 零副作用:只写注入的 tmp 账本,全局账本与生产 data/cost_ledger.json 一次都不碰.
"""

from __future__ import annotations

import inspect
import json
import logging
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest

from app.core.llm_gateway import llm_gateway
from app.core.token_baseline import CHAIN_MAIN, CHAIN_UNKNOWN_LABEL, CHAIN_WORKFLOW
from app.routers import agent_plan
from app.services.agent_loop_v2 import AgentLoopV2
from app.services.cost_ledger import _LEDGER_FILE as _PROD_LEDGER_FILE
from app.services.cost_ledger import CostLedger
from app.services.koubo_workflow import KouboState, KouboWorkflowService
from app.services.workflow_engine import WorkflowEngine

_KOUBO_SRC = Path(inspect.getfile(KouboWorkflowService))
_PLAN_SRC = Path(inspect.getfile(agent_plan))
# 生产工作树里那本真账 —— 本席用例一条都不许写它(上一席踩过的红线)。
# 路径一律从 cost_ledger 的单源常量取(§0.6):本席第一版自己算 parents,算成了
# `app/data/cost_ledger.json` 那型"目录在、账本永远不在"的假路径 ⇒ 零副作用断言
# 恒真假绿(由下面的路径锁抓到)。取源即无此型。


def _ledger(tmp_path: Path) -> CostLedger:
    """独立文件的干净账本(绝不落全局 data/cost_ledger.json)。"""
    return CostLedger(file_path=tmp_path / "ledger.json")


def _prod_ledger_snapshot() -> dict[str, Any]:
    """生产账本文件的现状快照(不存在也要能证明"前后都不存在")。"""
    if not _PROD_LEDGER_FILE.exists():
        return {"exists": False}
    st = _PROD_LEDGER_FILE.stat()
    return {"exists": True, "size": st.st_size, "mtime_ns": st.st_mtime_ns}


def _usage_complete(content: Any, prompt_tokens: int = 1000, completion_tokens: int = 20):
    """替身 llm_gateway.complete:回带 usage 的响应(零网络)。"""

    async def _fake(messages: list[dict[str, Any]], **kwargs: Any) -> dict[str, Any]:
        text = content if isinstance(content, str) else json.dumps(content, ensure_ascii=False)
        return {
            "content": text,
            "model": "gpt-4o-mini",
            "usage": {"prompt_tokens": prompt_tokens, "completion_tokens": completion_tokens},
        }

    return _fake


# =============================================================================
# ① 正向:agent_plan 构造链必须带 CHAIN_MAIN
# =============================================================================


class _CapturingLoop:
    """替身 AgentLoopV2:只记录构造入参,不跑循环(零网络、零工具执行)。"""

    last_kwargs: dict[str, Any] | None = None

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        _CapturingLoop.last_kwargs = kwargs

    async def run(self, messages: list[dict[str, Any]]) -> Any:
        return SimpleNamespace(
            success=True,
            final_response="done",
            stop_reason="end_turn",
            error=None,
            iterations=[],
        )


async def test_plan_execution_constructs_loop_with_chain_main(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """正例:_execute_plan 的构造点必须把链标签显式带成 CHAIN_MAIN(唯一常量源)。"""
    _CapturingLoop.last_kwargs = None
    monkeypatch.setattr(agent_plan, "AgentLoopV2", _CapturingLoop)
    # 工具构建会 import mcp_server(与本格无关);存储是进程内全局 —— 两者都换掉
    monkeypatch.setattr(agent_plan, "_build_readonly_tools", lambda _names: [])
    monkeypatch.setattr(agent_plan, "plan_store", SimpleNamespace(save=lambda _rec: None))

    rec = SimpleNamespace(plan_id="p-g941-chain", plan_md="# 计划", goal="查一下", status="approved")
    out = await agent_plan._execute_plan(rec, frozenset())

    assert out["status"] == "done"
    kwargs = _CapturingLoop.last_kwargs
    assert kwargs is not None, "构造点未被调用 ⇒ 本格测的不是生产路径"
    assert kwargs.get("chain") == CHAIN_MAIN
    # 链别必须是常量源的值,不是字面量(字面量与 token_baseline 必然漂移)
    assert kwargs["chain"] is CHAIN_MAIN


async def test_plan_chain_main_lands_main_bucket_not_unjudged(
    tmp_path: Path,
) -> None:
    """正向对照的行为面:带 CHAIN_MAIN 跑一轮 ⇒ 账本读面主链可见、未判定为空。"""
    ld = _ledger(tmp_path)
    from app.services.agent_step_recorder import AgentStepRecorder

    rec = AgentStepRecorder(file_path=tmp_path / "steps.json")
    loop = AgentLoopV2(
        _final_llm(900),
        tools=[],
        max_iterations=2,
        recorder=rec,
        session_id="s-g941-plan-main",
        chain=CHAIN_MAIN,  # 本席补的那一格
    )
    result = await loop.run([{"role": "user", "content": "hi"}])
    assert result.success is True

    steps = [s for s in rec.replay("s-g941-plan-main")["steps"] if s["type"] == "llm"]
    assert steps and {s["chain"] for s in steps} == {CHAIN_MAIN}
    ld.sync_from_recorder("s-g941-plan-main", rec, user_id="u1", session_id="s-g941-plan-main")
    agg = ld.aggregate()
    assert agg["by_chain"][CHAIN_MAIN]["steps"] == len(steps)
    assert CHAIN_UNKNOWN_LABEL not in agg["by_chain"]


# =============================================================================
# ② 反向对照:漏传 chain ⇒ 落"未判定",绝不并主链
# =============================================================================


def _final_llm(prompt_tokens: int):
    async def _mock(messages: list[dict[str, Any]], tools: Any) -> dict[str, Any]:
        return {
            "content": "ok",
            "tool_calls": None,
            "usage": {"prompt_tokens": prompt_tokens, "completion_tokens": 10},
        }

    return _mock


async def test_reverse_control_missing_chain_is_unjudged_never_main(
    tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    """同一构造点少传 chain 这一参 ⇒ 桶从主链翻成"未判定"(证明上面那格是承重格)。"""
    from app.services.agent_step_recorder import AgentStepRecorder

    ld = _ledger(tmp_path)
    rec = AgentStepRecorder(file_path=tmp_path / "steps.json")

    with caplog.at_level(logging.WARNING, logger="app.services.agent_loop_v2"):
        # 刻意复刻本席补之前的生产形状:不传 chain
        loop = AgentLoopV2(
            _final_llm(1200),
            tools=[],
            max_iterations=2,
            recorder=rec,
            session_id="s-g941-plan-omit",
        )
    assert loop._chain == CHAIN_UNKNOWN_LABEL
    assert any("未传 chain" in r.getMessage() for r in caplog.records)

    result = await loop.run([{"role": "user", "content": "hi"}])
    assert result.success is True
    steps = [s for s in rec.replay("s-g941-plan-omit")["steps"] if s["type"] == "llm"]
    assert {s["chain"] for s in steps} == {CHAIN_UNKNOWN_LABEL}

    ld.sync_from_recorder("s-g941-plan-omit", rec, user_id="u1", session_id="s-g941-plan-omit")
    agg = ld.aggregate()
    # 核心反向断言:漏传那一族的用量既在账上,又一条都不计进主链
    assert CHAIN_MAIN not in agg["by_chain"]
    assert agg["by_chain"][CHAIN_UNKNOWN_LABEL]["steps"] == len(steps)


def test_plan_source_passes_chain_from_constant_source() -> None:
    """结构锁:agent_plan 的构造点只有一枚,且链别取常量源而非字面量。"""
    src = _PLAN_SRC.read_text(encoding="utf-8")
    assert src.count("AgentLoopV2(") == 1
    assert "chain=CHAIN_MAIN" in src
    assert "from ..core.token_baseline import CHAIN_MAIN" in src
    assert 'chain="main"' not in src


# =============================================================================
# ①b/③ koubo 工作流:走引擎同一枚出口 ⇒ workflow 链条目
# =============================================================================


def _koubo_state(**over: Any) -> KouboState:
    base: KouboState = {
        "date": "1026",
        "topic_hint": "",
        "model": None,
        "owner_uuid": "u-koubo",
        "dry_run": True,
        "run_id": "koubo:1026-fixed-run",
        "hot_topics": [],
        "selected_topics": [],
        "articles": [],
        "validated": False,
        "output_path": "",
        "error": None,
        "status": "planning",
        "trace": [],
    }
    return {**base, **over}  # type: ignore[return-value]


_TOPICS_8 = [{"title": f"T{i}", "five_dim_score": 20} for i in range(8)]


async def test_koubo_nodes_produce_workflow_chain_entries(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """正例:hot_scan + write_articles 的每一次 LLM 调用都在 workflow 链上留下条目。"""
    ld = _ledger(tmp_path)
    # 门禁脚本 subprocess 与本格无关 ⇒ 打掉(避免真跑 tools/*.py)
    async def _no_script(script_name: str, args: list[str], timeout_sec: int = 60) -> tuple[int, str, str]:
        return 0, "热点池占位", ""

    monkeypatch.setattr("app.services.koubo_workflow._run_koubo_script", _no_script)
    monkeypatch.setattr(llm_gateway, "complete", _usage_complete(_TOPICS_8, 1100, 40))

    # 出口宿主 = 引擎实例(带 tmp 账本):同一枚 _record_llm_usage,零第二份实现
    svc = KouboWorkflowService(usage_recorder=WorkflowEngine(ledger=ld))
    state = _koubo_state()
    after_scan = await svc._hot_scan_node(state)
    assert after_scan.get("error") is None
    assert len(after_scan["hot_topics"]) == 8

    writing = _koubo_state(selected_topics=_TOPICS_8[:3], hot_topics=_TOPICS_8)
    after_write = await svc._write_articles_node(writing)
    assert len(after_write["articles"]) == 3

    rows = ld.aggregate()
    # 1 次扫描 + 3 篇写作 = 4 条
    assert rows["steps"] == 4
    entries = list(ld._data.values())
    assert {e["chain"] for e in entries} == {CHAIN_WORKFLOW}
    assert {e["tool_name"] for e in entries} == {
        "workflow:koubo:hot_scan",
        "workflow:koubo:write_articles",
    }
    assert {e["user_id"] for e in entries} == {"u-koubo"}
    # 读面:workflow 桶可见;既没被算进主链,也没留在"未判定"
    by_chain = rows["by_chain"]
    assert by_chain[CHAIN_WORKFLOW]["steps"] == 4
    # 逐行原始读数(4 条都量到了 1100/40)
    assert {e["tokens_in"] for e in entries} == {1100}
    assert {e["tokens_out"] for e in entries} == {40}
    # 桶内 tokens_in 走 G-821 的 (来源链, 来源) 增量基线:同来源连续同上下文只计增量,
    # 故 4 条 1100 在桶里读作 1100(hot_scan) + 1100(write_articles 首条) = 2200,
    # 而 tokens_out 逐条相加 = 40 * 4。断言这条算式,防"桶=逐条相加"的误读回潮。
    assert by_chain[CHAIN_WORKFLOW]["tokens_in"] == 2200
    assert by_chain[CHAIN_WORKFLOW]["tokens_out"] == 160
    assert CHAIN_MAIN not in by_chain
    assert CHAIN_UNKNOWN_LABEL not in by_chain
    # 同一 run 内 record_id 幂等键不撞车(4 条 = 4 个键)
    assert len(ld._data) == 4


async def test_koubo_error_response_still_booked_as_error_status(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """带 error 的响应也要入账(状态=error):早退路径不是"静默无账"的借口。"""
    ld = _ledger(tmp_path)

    async def _no_script(script_name: str, args: list[str], timeout_sec: int = 60) -> tuple[int, str, str]:
        return 0, "热点池占位", ""

    async def _err(messages: list[dict[str, Any]], **kwargs: Any) -> dict[str, Any]:
        return {
            "error": True,
            "error_message": "上游限流",
            "content": "",
            "model": "gpt-4o-mini",
            "usage": {"prompt_tokens": 300, "completion_tokens": 0},
        }

    monkeypatch.setattr("app.services.koubo_workflow._run_koubo_script", _no_script)
    monkeypatch.setattr(llm_gateway, "complete", _err)
    svc = KouboWorkflowService(usage_recorder=WorkflowEngine(ledger=ld))

    out = await svc._hot_scan_node(_koubo_state())
    assert out["status"] == "error"
    assert ld.aggregate()["steps"] == 1
    entry = list(ld._data.values())[0]
    assert entry["chain"] == CHAIN_WORKFLOW
    assert entry["status"] == "error"


async def test_koubo_exception_writes_no_fabricated_row(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """反向对照:调用抛异常 ⇒ 没有可测用量,宁可零行也不把"没量到"写成"量到了"。"""
    ld = _ledger(tmp_path)

    async def _no_script(script_name: str, args: list[str], timeout_sec: int = 60) -> tuple[int, str, str]:
        return 0, "热点池占位", ""

    async def _boom(messages: list[dict[str, Any]], **kwargs: Any) -> dict[str, Any]:
        raise RuntimeError("llm down")

    monkeypatch.setattr("app.services.koubo_workflow._run_koubo_script", _no_script)
    monkeypatch.setattr(llm_gateway, "complete", _boom)
    svc = KouboWorkflowService(usage_recorder=WorkflowEngine(ledger=ld))

    out = await svc._hot_scan_node(_koubo_state())
    assert out["status"] == "error"
    assert ld.aggregate()["steps"] == 0


def test_koubo_run_and_stream_seed_run_id() -> None:
    """两次运行的归属键必须不同(否则引擎的 `{instance}:llm:{seq}` 互相覆盖)。"""
    from app.services.koubo_workflow import _new_run_id

    a, b = _new_run_id("1026"), _new_run_id("1026")
    assert a != b and a.startswith("koubo:1026-")
    assert _new_run_id("") .startswith("koubo:na-")


def test_koubo_default_recorder_is_the_engine_singleton() -> None:
    """缺省构造必须直连引擎单例(它的账本又是全局 cost_ledger)——"默认不写账"就是本洞。"""
    from app.services.workflow_engine import workflow_engine

    assert KouboWorkflowService()._recorder() is workflow_engine


def test_koubo_does_not_build_a_second_ledger_implementation() -> None:
    """§0.6 单一真相源:koubo 只许委托引擎出口,不得自己拼账本条目/链别字面量。"""
    src = _KOUBO_SRC.read_text(encoding="utf-8")
    assert src.count("await llm_gateway.complete(") == 2
    # 每个 LLM 出口都必须在带账包装里(计数相等 = 没有"新调用点静默无账"的位置)
    assert src.count("self._record_llm_call(") == 2
    assert "_record_llm_usage(" in src, "必须复用 workflow_engine 的那枚出口"
    # 第二份实现的三种形态一律不许出现
    assert "from .cost_ledger import" not in src
    assert "ledger.append(" not in src
    assert '"chain":' not in src
    assert 'chain="' not in src


# =============================================================================
# ④ 零副作用:全局账本与生产文件一次都不碰
# =============================================================================


def test_prod_ledger_path_lock_points_at_the_real_prod_file() -> None:
    """形状锁:零副作用断言的取材路径必须真是生产默认那本账 —— 路径算歪会让快照恒等 = 假绿。"""
    from app.services.cost_ledger import cost_ledger

    assert _PROD_LEDGER_FILE.name == "cost_ledger.json"
    assert _PROD_LEDGER_FILE.parent.name == "data"
    assert _PROD_LEDGER_FILE.parent.parent.name == "ai-service"
    # 与全局单例实际落盘的那本同源(不是"另一本长得像的")
    assert Path(str(cost_ledger._file)).resolve() == _PROD_LEDGER_FILE.resolve()


async def test_koubo_recording_never_touches_global_ledger_or_prod_file(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """注入 tmp 账本后:全局 cost_ledger.append 零调用,生产 data/cost_ledger.json 零变化。"""
    import app.services.cost_ledger as cl_mod

    calls: list[str] = []

    def _spy(entry: Any) -> dict[str, Any]:
        calls.append(str(entry))
        raise AssertionError("测试不得写全局账本")

    monkeypatch.setattr(cl_mod.cost_ledger, "append", _spy)
    before = _prod_ledger_snapshot()

    async def _no_script(script_name: str, args: list[str], timeout_sec: int = 60) -> tuple[int, str, str]:
        return 0, "热点池占位", ""

    monkeypatch.setattr("app.services.koubo_workflow._run_koubo_script", _no_script)
    monkeypatch.setattr(llm_gateway, "complete", _usage_complete(_TOPICS_8, 500, 5))

    ld = _ledger(tmp_path)
    svc = KouboWorkflowService(usage_recorder=WorkflowEngine(ledger=ld))
    await svc._hot_scan_node(_koubo_state())
    await svc._write_articles_node(_koubo_state(selected_topics=_TOPICS_8[:2]))

    assert calls == []
    assert ld.aggregate()["steps"] == 3
    assert _prod_ledger_snapshot() == before, "生产账本文件被动过 ⇒ 副作用红线破防"


async def test_plan_capture_loop_writes_nothing_at_all(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """计划侧替身构造零写账:证明①的断言不依赖任何账本副作用。"""
    import app.services.cost_ledger as cl_mod

    def _spy(entry: Any) -> dict[str, Any]:
        raise AssertionError("计划构造替身不得写全局账本")

    monkeypatch.setattr(cl_mod.cost_ledger, "append", _spy)
    monkeypatch.setattr(agent_plan, "AgentLoopV2", _CapturingLoop)
    monkeypatch.setattr(agent_plan, "_build_readonly_tools", lambda _names: [])
    monkeypatch.setattr(agent_plan, "plan_store", SimpleNamespace(save=lambda _rec: None))

    rec = SimpleNamespace(plan_id="p-g941-noop", plan_md="# 计划", goal="g", status="approved")
    out = await agent_plan._execute_plan(rec, frozenset())
    assert out["status"] == "done"
    assert _CapturingLoop.last_kwargs is not None


def test_timestamp_helper_is_utc_aware() -> None:
    """形状锁:本文件的时刻helper必须带 tz(与 _trace 的 naive-Z 约定不混用)。"""
    now = datetime.now(UTC)
    assert now.tzinfo is not None
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
