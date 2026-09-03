# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""全链路成本账本(cost_ledger)单元测试(2026-09-03 立)。

覆盖:
- append:归一化回填 / record_id 幂等 / 缺 record_id 报错 / 空入账估计
- aggregate:全量 totals / 按 user/session/run/tool/model/date/status 过滤 /
  次数/成败/估算计数 / 窗口边界 / by_tool / by_model
- top_tools:成本排序 / 数量上限 / 过滤
- timeseries:按天 / 按小时 / 非法粒度报错
- sync_from_recorder:与 recorder 口径一致(成本 round6) / 幂等
- estimate_cost_usd:已知 / 未知(estimated)模型 / set_pricing 覆盖定价
- reset / 持久化写盘读回 / round 稳定性
"""

from __future__ import annotations

from pathlib import Path

import pytest

from app.services.agent_step_recorder import AgentStepRecorder
from app.services.cost_ledger import CostLedger, LedgerEntry


def _ledger(tmp_path: Path) -> CostLedger:
    """独立文件 + 干净内存的账本(避免污染全局单例)。"""
    return CostLedger(file_path=tmp_path / "ledger.json")


def _recorder(tmp_path: Path) -> AgentStepRecorder:
    """独立文件 + 干净内存的步骤录制器。"""
    return AgentStepRecorder(file_path=tmp_path / "steps.json")


def _mk(record_id: str, **kw) -> dict:
    """构造一条账目 dict(缺省字段由 append 归一化回填)。"""
    base = {
        "record_id": record_id,
        "user_id": kw.pop("user_id", "u1"),
        "session_id": kw.pop("session_id", "s1"),
        "run_id": kw.pop("run_id", "r1"),
        "tool_name": kw.pop("tool_name", "read_file"),
        "model": kw.pop("model", "gpt-4o"),
        "tokens_in": kw.pop("tokens_in", 100),
        "tokens_out": kw.pop("tokens_out", 40),
        "cost_usd": kw.pop("cost_usd", 0.02),
        "duration_ms": kw.pop("duration_ms", 12.0),
        "status": kw.pop("status", "ok"),
        "at": kw.pop("at", "2026-09-03T00:00:00Z"),
    }
    # 显式覆盖时以 kw 为准(去重后补别名字段)
    base.update(kw)
    return base


def _step(tool: str, cost: float, *, tin: int = 0, tout: int = 0, status: str = "ok") -> dict:
    return {
        "type": "tool",
        "tool_name": tool,
        "status": status,
        "cost": cost,
        "tokens_in": tin,
        "tokens_out": tout,
        "tokens": tin + tout,
    }


# =============================================================================
# append
# =============================================================================


def test_append_normalizes_and_returns(tmp_path: Path):
    """append 归一化:total_tokens 回填 in+out,cost round 6d,缺省 at 填 now。"""
    ld = _ledger(tmp_path)
    r = ld.append(_mk("e1", cost_usd=0.1234567))
    assert r["appended"] is True
    e = r["entry"]
    assert e["total_tokens"] == 140
    assert e["cost_usd"] == 0.123457
    assert e["at"]


def test_append_idempotent_same_record_id(tmp_path: Path):
    """同 record_id 第二次 append 不重复入账。"""
    ld = _ledger(tmp_path)
    ld.append(_mk("dup-1", tool_name="read_file"))
    ld.append(_mk("dup-1", tool_name="read_file", tokens_in=999))
    assert ld.count() == 1
    r = ld.append(_mk("dup-1"))
    assert r["appended"] is False
    # 保留首条
    assert ld.aggregate()["total_tokens_in"] == 100


def test_append_requires_record_id(tmp_path: Path):
    """缺 record_id → 抛 ValueError。"""
    ld = _ledger(tmp_path)
    with pytest.raises(ValueError):
        ld.append({"tool_name": "read_file"})


def test_append_estimates_cost_when_missing(tmp_path: Path):
    """cost 缺失 → 走估算;未知模型用默认价并标 estimated=True。"""
    ld = _ledger(tmp_path)
    r = ld.append(_mk("est-1", cost_usd=None, model="obscure-llm", tokens_in=1000, tokens_out=500))
    e = r["entry"]
    # 默认价 per_in 0.002 / per_out 0.008 → 0.002*1 + 0.008*0.5 = 0.006
    assert e["cost_usd"] == pytest.approx(0.006, rel=1e-6)
    assert e["estimated"] is True
    # 已知模型估算则不标 estimated
    r2 = ld.append(_mk("est-2", cost_usd=None, model="gpt-4o", tokens_in=1000, tokens_out=500))
    assert r2["entry"]["cost_usd"] == pytest.approx(0.0075, rel=1e-6)
    assert r2["entry"]["estimated"] is False


# =============================================================================
# aggregate
# =============================================================================


def test_aggregate_all_totals(tmp_path: Path):
    """全量聚合:steps / tokens / cost / duration / 成败次数 正确。"""
    ld = _ledger(tmp_path)
    ld.append(_mk("a1", tool_name="read", cost_usd=0.10, tokens_in=1000,
                  tokens_out=500, duration_ms=100))
    ld.append(_mk("a2", tool_name="write", cost_usd=0.20, tokens_in=2000,
                  tokens_out=1000, duration_ms=200, status="error"))
    agg = ld.aggregate()
    assert agg["steps"] == 2
    assert agg["count"] == 2
    assert agg["ok_count"] == 1
    assert agg["error_count"] == 1
    assert agg["total_tokens_in"] == 3000
    assert agg["total_tokens_out"] == 1500
    assert agg["total_tokens"] == 4500
    assert agg["total_cost"] == pytest.approx(0.30, rel=1e-9)
    assert agg["total_duration_ms"] == pytest.approx(300.0)


def test_aggregate_filter_by_user(tmp_path: Path):
    """按 user_id 过滤聚合。"""
    ld = _ledger(tmp_path)
    ld.append(_mk("u-1", user_id="alice", cost_usd=0.1))
    ld.append(_mk("u-2", user_id="bob", cost_usd=0.5))
    assert ld.aggregate({"user_id": "alice"})["total_cost"] == pytest.approx(0.1)


def test_aggregate_filter_by_session(tmp_path: Path):
    """按 session_id 过滤聚合。"""
    ld = _ledger(tmp_path)
    ld.append(_mk("s-1", session_id="sess-a", cost_usd=0.2))
    ld.append(_mk("s-2", session_id="sess-b", cost_usd=0.4))
    assert ld.aggregate({"session_id": "sess-b"})["total_cost"] == pytest.approx(0.4)


def test_aggregate_filter_by_run(tmp_path: Path):
    """按 run_id 过滤聚合。"""
    ld = _ledger(tmp_path)
    ld.append(_mk("r-1", run_id="run-x", cost_usd=0.3))
    ld.append(_mk("r-2", run_id="run-y", cost_usd=0.7))
    assert ld.aggregate({"run_id": "run-x"})["steps"] == 1
    assert ld.aggregate({"run_id": "run-y"})["total_cost"] == pytest.approx(0.7)


def test_aggregate_filter_by_tool(tmp_path: Path):
    """按 tool_name 过滤聚合(含 by_tool 拆分)。"""
    ld = _ledger(tmp_path)
    ld.append(_mk("t-1", tool_name="read", cost_usd=0.1))
    ld.append(_mk("t-2", tool_name="write", cost_usd=0.2))
    assert ld.aggregate({"tool_name": "write"})["total_cost"] == pytest.approx(0.2)
    by_tool = ld.aggregate()["by_tool"]
    assert by_tool["read"]["steps"] == 1
    assert by_tool["write"]["cost"] == pytest.approx(0.2)


def test_aggregate_filter_by_model(tmp_path: Path):
    """按 model 过滤聚合(含 by_model 拆分)。"""
    ld = _ledger(tmp_path)
    ld.append(_mk("m-1", model="gpt-4o", cost_usd=0.1))
    ld.append(_mk("m-2", model="claude-3-sonnet", cost_usd=0.2))
    assert ld.aggregate({"model": "claude-3-sonnet"})["total_cost"] == pytest.approx(0.2)
    by_model = ld.aggregate()["by_model"]
    assert by_model["gpt-4o"]["steps"] == 1


def test_aggregate_filter_by_date(tmp_path: Path):
    """按日期(date=YYYY-MM-DD)过滤聚合。"""
    ld = _ledger(tmp_path)
    ld.append(_mk("d-1", at="2026-09-01T05:00:00Z"))
    ld.append(_mk("d-2", at="2026-09-02T05:00:00Z"))
    assert ld.aggregate({"date": "2026-09-02"})["steps"] == 1
    assert ld.aggregate({"date": "2026-09-02"})["count"] == 1


def test_aggregate_filter_by_status(tmp_path: Path):
    """按 status 过滤聚合(ok/error)。"""
    ld = _ledger(tmp_path)
    ld.append(_mk("st-1", status="ok", cost_usd=0.1))
    ld.append(_mk("st-2", status="error", cost_usd=0.4))
    assert ld.aggregate({"status": "error"})["total_cost"] == pytest.approx(0.4)


def test_aggregate_window_bounds(tmp_path: Path):
    """窗口边界取 at 的最小/最大。"""
    ld = _ledger(tmp_path)
    ld.append(_mk("w-1", at="2026-09-01T05:00:00Z"))
    ld.append(_mk("w-2", at="2026-09-03T09:30:00Z"))
    win = ld.aggregate()["window"]
    assert win["start"].startswith("2026-09-01T05:00:00")
    assert win["end"].startswith("2026-09-03T09:30:00")


def test_aggregate_empty_input(tmp_path: Path):
    """空账本 → 全 0,窗口为 None。"""
    agg = _ledger(tmp_path).aggregate()
    assert agg["steps"] == 0
    assert agg["total_cost"] == 0.0
    assert agg["window"] == {"start": None, "end": None}
    assert agg["by_tool"] == {}
    assert agg["by_model"] == {}


# =============================================================================
# top_tools
# =============================================================================


def test_top_tools_ranking_and_limit(tmp_path: Path):
    """按成本降序返回 Top 工具,数量受 n 限制。"""
    ld = _ledger(tmp_path)
    ld.append(_mk("z-1", tool_name="read", cost_usd=0.2))
    ld.append(_mk("z-2", tool_name="write", cost_usd=0.9))
    ld.append(_mk("z-3", tool_name="bash", cost_usd=0.5))
    top = ld.top_tools(2)
    assert [t["tool_name"] for t in top] == ["write", "bash"]
    assert top[0]["cost"] == pytest.approx(0.9)
    assert top[0]["steps"] == 1


def test_top_tools_respects_filter(tmp_path: Path):
    """top_tools 在过滤子集上排序。"""
    ld = _ledger(tmp_path)
    ld.append(_mk("f-1", tool_name="read", cost_usd=0.9, run_id="run-a"))
    ld.append(_mk("f-2", tool_name="write", cost_usd=0.3, run_id="run-b"))
    ld.append(_mk("f-3", tool_name="bash", cost_usd=0.1, run_id="run-a"))
    top = ld.top_tools(5, {"run_id": "run-a"})
    assert [t["tool_name"] for t in top] == ["read", "bash"]


# =============================================================================
# timeseries
# =============================================================================


def test_timeseries_day(tmp_path: Path):
    """按天分桶并升序输出。"""
    ld = _ledger(tmp_path)
    ld.append(_mk("ts1", at="2026-09-01T05:00:00Z", cost_usd=0.1))
    ld.append(_mk("ts2", at="2026-09-02T08:00:00Z", cost_usd=0.2))
    ld.append(_mk("ts3", at="2026-09-02T23:00:00Z", cost_usd=0.3))
    series = ld.timeseries("day")
    assert [b["bucket"] for b in series] == ["2026-09-01", "2026-09-02"]
    assert series[1]["steps"] == 2
    assert series[1]["cost"] == pytest.approx(0.5)


def test_timeseries_hour(tmp_path: Path):
    """按小时分桶。"""
    ld = _ledger(tmp_path)
    ld.append(_mk("h1", at="2026-09-01T05:10:00Z", cost_usd=0.1))
    ld.append(_mk("h2", at="2026-09-01T05:40:00Z", cost_usd=0.2))
    ld.append(_mk("h3", at="2026-09-01T06:00:00Z", cost_usd=0.3))
    series = ld.timeseries("hour")
    assert [b["bucket"] for b in series] == ["2026-09-01T05", "2026-09-01T06"]
    assert series[0]["steps"] == 2
    assert series[0]["cost"] == pytest.approx(0.3)


def test_timeseries_invalid_granularity(tmp_path: Path):
    """非法粒度 → 抛 ValueError。"""
    with pytest.raises(ValueError):
        _ledger(tmp_path).timeseries("week")


def test_timeseries_respects_filter(tmp_path: Path):
    """timeseries 在过滤子集上分桶。"""
    ld = _ledger(tmp_path)
    ld.append(_mk("tsa", at="2026-09-01T05:00:00Z", model="gpt-4o"))
    ld.append(_mk("tsb", at="2026-09-02T05:00:00Z", model="claude-3-sonnet"))
    series = ld.timeseries("day", {"model": "claude-3-sonnet"})
    assert [b["bucket"] for b in series] == ["2026-09-02"]


# =============================================================================
# sync_from_recorder
# =============================================================================


def test_sync_from_recorder_matches_recorder_metrics(tmp_path: Path):
    """sync 后 ledger 聚合与 recorder.get_run_metrics 口径一致。"""
    rec = _recorder(tmp_path)
    rec.append_step("r1", _step("read", 0.1, tin=100, tout=50))
    rec.append_step("r1", _step("write", 0.4, tin=200, tout=100))
    rec.append_step("r1", _step("bash", 0.2, status="error", tin=50, tout=50))

    ld = _ledger(tmp_path)
    out = ld.sync_from_recorder("r1", rec)
    assert out["synced"] == 3
    assert out["skipped"] == 0

    met = rec.get_run_metrics("r1")
    agg = ld.aggregate({"run_id": "r1"})
    assert agg["steps"] == met["step_count"] == 3
    assert agg["total_tokens_in"] == met["total_tokens_in"]
    assert agg["total_tokens_out"] == met["total_tokens_out"]
    assert agg["total_tokens"] == met["total_tokens"]
    assert agg["total_cost"] == pytest.approx(met["total_cost"])
    assert agg["ok_count"] == met["ok_count"]
    assert agg["error_count"] == met["error_count"]


def test_sync_from_recorder_idempotent(tmp_path: Path):
    """重复 sync 同一 run 不重复入账(skipped 计数)。"""
    rec = _recorder(tmp_path)
    rec.append_step("r1", _step("read", 0.1))
    rec.append_step("r1", _step("write", 0.2))
    ld = _ledger(tmp_path)
    first = ld.sync_from_recorder("r1", rec)
    second = ld.sync_from_recorder("r1", rec)
    assert first["synced"] == 2
    assert second["synced"] == 0
    assert second["skipped"] == 2
    assert ld.count() == 2


def test_sync_from_recorder_empty_run(tmp_path: Path):
    """空 run → synced=0,不报错。"""
    ld = _ledger(tmp_path)
    out = ld.sync_from_recorder("ghost", _recorder(tmp_path))
    assert out == {"run_id": "ghost", "synced": 0, "skipped": 0}


# =============================================================================
# estimate / pricing
# =============================================================================


def test_estimate_known_model(tmp_path: Path):
    """已知模型用内置单价估算,estimated=False。"""
    ld = _ledger(tmp_path)
    r = ld.estimate_cost_usd("gpt-4o", 1000, 500)
    assert r["cost_usd"] == pytest.approx(0.0075, rel=1e-6)
    assert r["estimated"] is False


def test_estimate_unknown_model(tmp_path: Path):
    """未知模型用默认价并标 estimated=True。"""
    ld = _ledger(tmp_path)
    r = ld.estimate_cost_usd("some-brand-new-model", 1000, 500)
    # 默认价 per_in 0.002 / per_out 0.008
    assert r["cost_usd"] == pytest.approx(0.006, rel=1e-6)
    assert r["estimated"] is True


def test_estimate_empty_model_is_unknown(tmp_path: Path):
    """空模型名视为未知 → estimated=True。"""
    ld = _ledger(tmp_path)
    r = ld.estimate_cost_usd("", 1000, 500)
    assert r["estimated"] is True


def test_set_pricing_override(tmp_path: Path):
    """set_pricing 覆盖后按新单价估算。"""
    ld = _ledger(tmp_path)
    ld.set_pricing("gpt-4o", 0.001, 0.002)
    r = ld.estimate_cost_usd("gpt-4o", 1000, 500)
    assert r["cost_usd"] == pytest.approx(0.002, rel=1e-6)  # 0.001 + 0.001
    assert r["estimated"] is False
    # 不影响其它模型
    assert ld.estimate_cost_usd("claude-3-sonnet", 1000, 500)["estimated"] is False
    # 覆盖一个原本未知的模型后不再标估算
    ld.set_pricing("custom-llm", 0.005, 0.02)
    assert ld.estimate_cost_usd("custom-llm", 1000, 1000)["estimated"] is False


# =============================================================================
# reset / persistence / round
# =============================================================================


def test_reset_clears_all(tmp_path: Path):
    """reset 清空全部条目。"""
    ld = _ledger(tmp_path)
    ld.append(_mk("rs-1"))
    ld.append(_mk("rs-2"))
    assert ld.count() == 2
    ld.reset()
    assert ld.count() == 0
    assert ld.aggregate()["total_cost"] == 0.0


def test_persistence_reload(tmp_path: Path):
    """写盘后新实例(模拟重启)读回全部条目。"""
    import json

    p = tmp_path / "ledger.json"
    ld = CostLedger(file_path=p)
    ld.append(_mk("p-1", tool_name="read", cost_usd=0.1))
    ld.append(_mk("p-2", model="deepseek-chat", cost_usd=0.2))

    persisted = json.loads(p.read_text(encoding="utf-8"))
    assert any(rid == "p-1" for rid in persisted)

    reloaded = CostLedger(file_path=p)
    assert reloaded.count() == 2
    agg = reloaded.aggregate()
    assert agg["by_tool"]["read"]["steps"] == 1
    assert agg["total_cost"] == pytest.approx(0.3)


def test_round_stability_repeated_aggregate(tmp_path: Path):
    """多次聚合结果稳定(cost round 6 位,无浮点漂移)。"""
    ld = _ledger(tmp_path)
    for i in range(50):
        ld.append(_mk(f"rnd-{i}", cost_usd=0.000001, tokens_in=1, tokens_out=1))
    first = ld.aggregate()["total_cost"]
    second = ld.aggregate()["total_cost"]
    assert first == second
    assert first == pytest.approx(0.00005, rel=1e-6)
    assert ld.aggregate()["estimated_count"] == 0


def test_ledger_entry_to_dict_roundtrip(tmp_path: Path):
    """LedgerEntry 经 to_dict 后 append 归一化一致。"""
    ld = _ledger(tmp_path)
    entry = LedgerEntry(
        record_id="le-1", user_id="u", session_id="s", run_id="r",
        tool_name="read", model="gpt-4o", tokens_in=100, tokens_out=50,
        cost_usd=0.01, duration_ms=5.0, status="ok", at="2026-09-03T00:00:00Z",
    )
    r = ld.append(entry)
    assert r["appended"] is True
    e = r["entry"]
    assert e["total_tokens"] == 150
    assert e["cost_usd"] == 0.01
    assert e["tool_name"] == "read"
