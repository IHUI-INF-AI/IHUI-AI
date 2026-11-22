# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""逆向判据聚合的**生产接线**测试(round8/9 判据 → guarded_tool_pipeline 的 gate stage)。

判据本体已有表驱动测试(`test_reverse_engineered_gates_wiring.py`,17 例)。本文件只钉
「装车」这一层:控制键契约、缺省零变化、阻断态不执行 fn、策略透传、异常 fail-closed,
以及「真调用点在 agent loop 的安全前置里」这条防回退结构锚点。

纪律:
- 缺省态(不传 gate_request)必须与原来逐字一致 —— 这是 round8 无条件闸 9 例回归的教训;
- 给了控制键就必须有判定,形状不认一律 unjudged 阻断,绝不退回「没启用」静默放行。
"""

from __future__ import annotations

from pathlib import Path

import pytest

from app.services.guarded_tool_pipeline import (
    ERROR_GATE_BLOCKED,
    GATE_KEY,
    GATE_KEY_ABSENT,
    STAGE_GATE,
    GuardedToolPipeline,
    extract_gate_request,
)

_AGENT_LOOP = Path(__file__).resolve().parents[1] / "app" / "services" / "agent_loop_v2.py"


# =============================================================================
# 1) 控制键契约(纯函数)
# =============================================================================


def test_extract_absent_returns_sentinel_and_never_copies():
    args = {"path": "a.txt", "n": 1}
    clean, spec = extract_gate_request(args)
    assert spec is GATE_KEY_ABSENT
    assert clean is args  # 无键时不复制、不改动(缺省零变化)


def test_extract_strips_control_key_only():
    args = {"path": "a.txt", GATE_KEY: {"request": {"kind": "x"}}}
    clean, spec = extract_gate_request(args)
    assert spec == {"request": {"kind": "x"}}
    assert GATE_KEY not in clean
    assert clean == {"path": "a.txt"}
    # 原对象不被就地修改(调用方自己决定何时替换 tc.args)
    assert GATE_KEY in args


@pytest.mark.parametrize("args", [None, [], "str", 3])
def test_extract_non_mapping_is_absent(args):
    clean, spec = extract_gate_request(args)
    assert spec is GATE_KEY_ABSENT
    assert clean is args


# =============================================================================
# 2) 缺省直通:不传 gate_request ⇒ 与改动前逐字一致
# =============================================================================


async def test_default_run_passes_args_through_and_reports_no_gate():
    seen: list[dict] = []

    def fn(a):
        seen.append(a)
        return {"ok": 1}

    pl = GuardedToolPipeline()
    pr = await pl.run("read_file", {"path": "a.txt"}, fn=fn, run_id="r1")
    assert pr.ok is True
    assert seen == [{"path": "a.txt"}]
    assert pr.gate == {}  # 没判过就不伪造判过(§0.3)
    assert pr.to_dict()["gate"] == {}


def test_default_run_sync_passes_args_through():
    seen: list[dict] = []

    def fn(a):
        seen.append(a)
        return "done"

    pl = GuardedToolPipeline()
    pr = pl.run_sync("read_file", {"path": "a.txt"}, fn=fn, run_id="r2")
    assert pr.ok is True
    assert seen == [{"path": "a.txt"}]
    assert pr.gate == {}


# =============================================================================
# 3) 判据阻断 ⇒ fn 绝不执行(fail-closed)
# =============================================================================


async def test_blocked_gate_prevents_fn_and_reports_stage():
    called: list[dict] = []

    def fn(a):
        called.append(a)
        return "should not run"

    def gate_suite(request, policy):
        return {"verdict": "blocked", "allowed": False, "reason": "denied by test"}

    pl = GuardedToolPipeline(gate_suite=gate_suite)
    pr = await pl.run(
        "run_code",
        {"code": "print(1)"},
        fn=fn,
        run_id="r3",
        gate_request={"kind": "code_execution", "inputs": {}},
        gate_policy={"gates": {"code_execution": {}}},
    )
    assert pr.ok is False
    assert called == []  # 阻断在 fn 之前
    assert pr.errors and pr.errors[0].stage == STAGE_GATE
    assert pr.errors[0].error_type == ERROR_GATE_BLOCKED
    assert pr.gate["verdict"] == "blocked"
    assert pr.to_dict()["gate"]["reason"] == "denied by test"


def test_blocked_gate_prevents_fn_run_sync():
    called: list[dict] = []

    def fn(a):
        called.append(a)
        return 1

    def gate_suite(request, policy):
        return {"verdict": "unjudged", "allowed": False, "reason": "not judged"}

    pl = GuardedToolPipeline(gate_suite=gate_suite)
    pr = pl.run_sync(
        "edit_file",
        {"path": "a.txt"},
        fn=fn,
        run_id="r4",
        gate_request={"kind": "edit_intent", "inputs": {}},
    )
    assert pr.ok is False
    assert called == []


async def test_allowed_gate_runs_fn_and_keeps_panel():
    called: list[dict] = []

    def fn(a):
        called.append(a)
        return "ran"

    def gate_suite(request, policy):
        return {"verdict": "allowed", "allowed": True, "reason": "all green", "checks": []}

    pl = GuardedToolPipeline(gate_suite=gate_suite)
    pr = await pl.run(
        "read_file",
        {"path": "a.txt"},
        fn=fn,
        run_id="r5",
        gate_request={"kind": "context_uri", "inputs": {"uri": "context://a"}},
    )
    assert pr.ok is True
    assert called == [{"path": "a.txt"}]
    assert pr.gate["verdict"] == "allowed"


# =============================================================================
# 4) 异常/形状不认 ⇒ fail-closed,绝不静默放行
# =============================================================================


async def test_gate_exception_blocks_instead_of_passing():
    called: list[dict] = []

    def fn(a):
        called.append(a)
        return "x"

    def gate_suite(request, policy):
        raise RuntimeError("judge blew up")

    pl = GuardedToolPipeline(gate_suite=gate_suite)
    pr = await pl.run("run_code", {"code": "1"}, fn=fn, run_id="r6", gate_request={"kind": "x"})
    assert pr.ok is False
    assert called == []
    assert pr.errors[0].error_type == ERROR_GATE_BLOCKED
    assert "gate suite error" in pr.errors[0].message


async def test_gate_returning_non_mapping_is_unjudged_blocked():
    called: list[dict] = []

    def fn(a):
        called.append(a)
        return "x"

    def gate_suite(request, policy):
        return "not-a-dict"  # 形状不认

    pl = GuardedToolPipeline(gate_suite=gate_suite)
    pr = await pl.run("run_code", {"code": "1"}, fn=fn, run_id="r7", gate_request={"kind": "x"})
    assert pr.ok is False
    assert called == []
    assert pr.gate == {"verdict": "unjudged"}


# =============================================================================
# 5) 真实聚合入口(不注入):管线真的调用 evaluate_gate_suite
# =============================================================================


async def test_real_gate_suite_blocks_unregistered_kind():
    called: list[dict] = []

    def fn(a):
        called.append(a)
        return "x"

    pl = GuardedToolPipeline()  # 不注入 ⇒ 惰性解析真实 evaluate_gate_suite
    pr = await pl.run(
        "run_code",
        {"code": "1"},
        fn=fn,
        run_id="r8",
        gate_request={"kind": "definitely_not_registered", "inputs": {}},
        gate_policy={"gates": {}},
    )
    assert pr.ok is False
    assert called == []
    assert pr.errors[0].error_type == ERROR_GATE_BLOCKED
    # 聚合层自己没判成 ⇒ 逐项可审计:至少一条 origin=aggregation 的 unjudged
    assert pr.gate["checks"]
    assert pr.gate["checks"][0]["origin"] == "aggregation"


async def test_real_gate_suite_policy_is_forwarded(monkeypatch):
    """策略透传:注入断言后,gate_policy 原样到达判据函数(不被二次包装)。"""
    captured: dict[str, object] = {}
    real = pytest.importorskip("app.services.reverse_engineered_gates")

    def spy(request, policy):
        captured["request"] = request
        captured["policy"] = policy
        return {"verdict": "allowed"}

    monkeypatch.setattr(real, "evaluate_gate_suite", spy)
    # 让惰性解析拿到被替换的函数
    import app.services.guarded_tool_pipeline as gtp

    monkeypatch.setattr(gtp, "_GATE_SUITE_FN", spy)

    pl = GuardedToolPipeline()
    pr = await pl.run(
        "read_file",
        {"path": "a"},
        fn=lambda a: "ok",
        run_id="r9",
        gate_request={"kind": "x"},
        gate_policy={"gates": {"x": {"k": 1}}},
    )
    assert pr.ok is True
    assert captured["request"] == {"kind": "x"}
    assert captured["policy"] == {"gates": {"x": {"k": 1}}}


# =============================================================================
# 6) 装车锚点:真调用点在 agent loop 的安全前置里(防回退)
# =============================================================================


def test_pre_gate_field_order_keeps_timings_and_gate_separate() -> None:
    """早期 stage 用位置参数构造 _PreGate ⇒ 新增字段必须排在 timings 之后。

    立因:把 gate 插在 timings 之前时,timings 会落进 gate、False 会落进 timings
    (mypy 抓到、行为测试没抓到),`to_dict()["gate"]` 会被写成 timings 字典。
    """
    import dataclasses

    import app.services.guarded_tool_pipeline as guarded_tool_pipeline

    names = [f.name for f in dataclasses.fields(guarded_tool_pipeline._PreGate)]
    assert names[-1] == "gate", names
    assert names.index("timings") < names.index("gate"), names
    # 既有六参位置构造:timings 必须落在 timings,gate 必须仍为空 dict
    pre = guarded_tool_pipeline._PreGate(False, [], {}, {}, {"gate_suite": 1.0}, False)
    assert pre.timings == {"gate_suite": 1.0}
    assert pre.gate == {}


def test_agent_loop_security_precheck_is_the_real_call_site() -> None:
    src = _AGENT_LOOP.read_text(encoding="utf-8")
    # 控制键在真实调用点被剥离(绝不进真实工具入参)
    assert "extract_gate_request(tc.args)" in src
    assert "GATE_KEY_ABSENT" in src
    # 判据请求真的进了生产管线的 run(...)
    assert "gate_request=gate_request" in src
    assert "gate_policy=gate_policy" in src
    # 阻断面板回填给前端/审计
    assert '"gate": pr.gate' in src
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
