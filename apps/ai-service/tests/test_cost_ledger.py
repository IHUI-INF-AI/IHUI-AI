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
- G-822 同 record_id 二次投递:逐列定向合并(首见时刻取最早 / 耗时与结束时刻取较大 /
  身份与已入账测量先到先定 / 哨兵不覆盖已知 / error 不被盲投洗掉 / 重投 identical)
- estimate_cost_usd:已知 / 未知(estimated)模型 / set_pricing 覆盖定价
- reset / 持久化写盘读回 / round 稳定性
- G-821 按来源增量基线:多轮累加 / 压缩下移基线 / 三条来源链独立基线 /
  单条不扣减 / 聚合幂等 / 空 session 不成链 / llm_usage_service 共用同一实现
- G-816021/G-941 链判别维度:聚合面双链独立基线 / 链别三值常量源 /
  未标注链归入"未判定"桶且读数可见 / sync 透传 chain / 生产者(AgentLoopV2 chain=)端到端四环锁
"""

from __future__ import annotations

import dataclasses
from pathlib import Path

import pytest

from app.core.ledger_merge import COLUMN_DIRECTIONS, merge_entry
from app.core.token_baseline import (
    CHAIN_MAIN,
    CHAIN_SUBAGENT,
    CHAIN_UNKNOWN_LABEL,
    CHAIN_WORKFLOW,
    chain_bucket,
)
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
    # 2026-09-07 起默认价来自 core.model_pricing 全局默认(USD/1M: 1.00/3.00)
    # → per-1K 0.001/0.003 → 0.001*1 + 0.003*0.5 = 0.0025
    assert e["cost_usd"] == pytest.approx(0.0025, rel=1e-6)
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
    # 默认价来自 core.model_pricing(USD/1M: 1.00/3.00 → per-1K 0.001/0.003)
    assert r["cost_usd"] == pytest.approx(0.0025, rel=1e-6)
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
    # 不影响其它模型(claude-3-5-sonnet 在统一价目源中有模型级价目)
    assert ld.estimate_cost_usd("claude-3-5-sonnet", 1000, 500)["estimated"] is False
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


# =============================================================================
# 按来源增量基线(G-821,2026-09-29)
# 每条记录携带的是整段请求的 prompt tokens,逐条相加 ⇒ 累计值按轮次平方级虚高。
# =============================================================================


def _rounds(tmp_path: Path, prompts: list[int]) -> CostLedger:
    """同一 (来源链, session) 的连续轮次入账;prompt 逐条给定,completion 固定 100。"""
    ld = _ledger(tmp_path)
    for idx, prompt in enumerate(prompts):
        ld.append(_mk(
            f"g821-{idx}",
            tool_name="llm",
            session_id="sess-g821",
            tokens_in=prompt,
            tokens_out=100,
            at=f"2026-09-03T00:00:{idx:02d}Z",
        ))
    return ld


def test_g821_three_rounds_accumulate_incrementally(tmp_path: Path):
    """3 轮同会话:累加值必须小于逐条 sum,且等于各轮新增之和。"""
    ld = _rounds(tmp_path, [1000, 1500, 2100])
    agg = ld.aggregate()
    assert agg["steps"] == 3
    assert agg["total_tokens_in"] == 1000 + 500 + 600 == 2100
    assert agg["total_tokens_in"] < 1000 + 1500 + 2100  # 平方级虚高的旧口径
    assert agg["total_tokens_out"] == 300
    assert agg["total_tokens"] == 2100 + 300
    assert agg["by_tool"]["llm"]["tokens_in"] == 2100


def test_g821_compaction_moves_baseline_down(tmp_path: Path):
    """prompt 下降(压缩)⇒ 基线下移到新值,历史累计不回扣,再涨部分只计新增。"""
    ld = _rounds(tmp_path, [1000, 1200, 400, 700])
    agg = ld.aggregate()
    # 1000-0, 1200-1000, max(0,400-1200)=0, 700-400 ⇒ 1000+200+0+300
    assert agg["total_tokens_in"] == 1000 + 200 + 0 + 300 == 1500
    assert agg["total_tokens_in"] < 1000 + 1200 + 400 + 700
    assert agg["total_tokens"] == 1500 + 400


def test_g821_each_source_chain_holds_its_own_baseline(tmp_path: Path):
    """三条来源链各自持基线:A 链上涨不得吃掉 B 链的基线。"""
    ld = _ledger(tmp_path)
    plan = [
        ("llm", 1000), ("subagent_llm", 300), ("llm", 1500),
        ("workflow_child", 100), ("subagent_llm", 900),
    ]
    for idx, (tool, prompt) in enumerate(plan):
        ld.append(_mk(
            f"g821-chain-{idx}", tool_name=tool, session_id="sess-chain",
            tokens_in=prompt, tokens_out=10, at=f"2026-09-03T00:00:{idx:02d}Z",
        ))
    agg = ld.aggregate()
    assert agg["total_tokens_in"] == 1000 + 300 + 500 + 100 + 600 == 2500
    assert agg["total_tokens_in"] < sum(p for _, p in plan) == 3800
    by_tool = agg["by_tool"]
    assert by_tool["llm"]["tokens_in"] == 1500  # 只算它自己那条链
    assert by_tool["subagent_llm"]["tokens_in"] == 900
    assert by_tool["workflow_child"]["tokens_in"] == 100


def test_g821_single_entry_session_is_not_deducted(tmp_path: Path):
    """反向对照:单条记录的会话累加值必须等于该条本身(基线不得把第一条算成 0)。"""
    ld = _rounds(tmp_path, [1234])
    agg = ld.aggregate()
    assert agg["total_tokens_in"] == 1234
    assert agg["total_tokens"] == 1234 + 100


def test_g821_aggregate_is_idempotent(tmp_path: Path):
    """幂等:同一批 entries 聚合两次结果逐字相同(基线不得跨调用累积状态)。"""
    ld = _rounds(tmp_path, [1000, 1500, 2100])
    assert ld.aggregate() == ld.aggregate()


def test_g821_unknown_session_is_not_chained(tmp_path: Path):
    """session 为空时无从判定同链 ⇒ 逐条照计(不得凭空扣减他人上下文)。"""
    ld = _ledger(tmp_path)
    for idx, prompt in enumerate([1000, 1500]):
        ld.append(_mk(
            f"g821-anon-{idx}", tool_name="llm", session_id="",
            tokens_in=prompt, tokens_out=10, at=f"2026-09-03T00:00:{idx:02d}Z",
        ))
    assert ld.aggregate()["total_tokens_in"] == 2500


def test_g821_usage_service_shares_the_same_baseline():
    """第二个读面(llm_usage_service.get_user_stats)接的是同一份增量算法,不是第二份实现。"""
    from app.services.llm_usage_service import LLMUsageService

    svc = LLMUsageService()
    for prompt in (1000, 1500, 2100):
        svc.record_usage(
            "openai", "gpt-4o", "u1", prompt, 100, session_id="sess-g821"
        )
    stats = svc.get_user_stats("u1", days=7)
    assert stats["total_input_tokens"] == 2100
    assert stats["total_tokens"] == 2400
    assert stats["total_calls"] == 3
    assert stats["model_breakdown"]["openai/gpt-4o"]["input_tokens"] == 2100
    assert stats["provider_breakdown"]["openai"]["input_tokens"] == 2100


# =============================================================================
# 上下文链判别维度(G-816021,2026-10-14)
# 同 session 内子代理与主链可以同为 tool_name="llm",只按 tool_name 分桶会共用
# 基线而少计;chain 是真判别维度,读面按 (chain, tool_name, session) 三元组分桶。
# =============================================================================


def test_g816021_subagent_and_main_chain_same_prompt_hold_independent_baselines(tmp_path: Path):
    """票面验收用例:子代理与主链同 prompt 值 ⇒ 各自基线独立(不得共用而少计)。

    反例(旧口径):main 1000 → subagent 1000 会被读成 1000 + 0(共用基线吃掉
    子代理的整段 prompt)。新口径:两链各持基线,各自首条照计。
    """
    ld = _ledger(tmp_path)
    plan = [
        ("main", 1000),      # 主链首条:照计 1000
        ("subagent", 1000),  # 子代理首条:同 prompt 值也必须照计 1000(旧口径这里 = 0)
        ("main", 1500),      # 主链第 2 轮:只计增量 500
        ("subagent", 1500),  # 子代理第 2 轮:只计增量 500
    ]
    for idx, (chain, prompt) in enumerate(plan):
        ld.append(_mk(
            f"g816021-{idx}", tool_name="llm", chain=chain,
            session_id="sess-816021",
            tokens_in=prompt, tokens_out=10,
            at=f"2026-10-14T00:00:{idx:02d}Z",
        ))
    agg = ld.aggregate()
    assert agg["total_tokens_in"] == 1000 + 1000 + 500 + 500 == 3000
    assert agg["total_tokens_in"] < sum(p for _, p in plan)  # 跨轮去重仍然生效
    # G-941 验收 a:同 session、同 tool_name="llm" 的两条链各落一桶,聚合不合并
    by_chain = agg["by_chain"]
    assert set(by_chain) == {CHAIN_MAIN, CHAIN_SUBAGENT}
    assert by_chain[CHAIN_MAIN]["steps"] == 2
    assert by_chain[CHAIN_SUBAGENT]["steps"] == 2
    assert by_chain[CHAIN_MAIN]["tokens_in"] == 1500
    assert by_chain[CHAIN_SUBAGENT]["tokens_in"] == 1500
    # 同 tool_name="llm" 的两链在 by_tool 里合桶(by_tool 按 tool_name),
    # 但 token 总量已按链独立持基线
    assert agg["by_tool"]["llm"]["tokens_in"] == 3000


def test_g816021_entries_without_chain_keep_g821_bucketing(tmp_path: Path):
    """回归:未标注 chain 的条目(存量数据/未改造生产者)退化为仅按 tool_name 分桶,
    与 G-821 落地时行为逐字一致(同 tool_name 跨条照旧共用基线)。"""
    ld = _ledger(tmp_path)
    for idx, prompt in enumerate([1000, 1500]):
        ld.append(_mk(
            f"g816021-legacy-{idx}", tool_name="llm", session_id="s-legacy",
            tokens_in=prompt, tokens_out=10,
            at=f"2026-10-14T00:00:{idx:02d}Z",
        ))
    agg = ld.aggregate()
    assert agg["total_tokens_in"] == 1000 + 500 == 1500
    # G-941 验收 b:缺链别的历史条目归入"未判定"桶,读数里可见且不并进主链
    assert set(agg["by_chain"]) == {CHAIN_UNKNOWN_LABEL}
    assert agg["by_chain"][CHAIN_UNKNOWN_LABEL]["steps"] == 2
    assert CHAIN_MAIN not in agg["by_chain"]


def test_g941_chain_enum_single_source_and_workflow_bucket(tmp_path: Path):
    """链别三值的唯一常量源:workflow 必须是可识别桶,表外值落"未判定"。"""
    assert (CHAIN_MAIN, CHAIN_SUBAGENT, CHAIN_WORKFLOW) == ("main", "subagent", "workflow")
    assert chain_bucket(CHAIN_WORKFLOW) == CHAIN_WORKFLOW
    assert chain_bucket("subagent-v2") == CHAIN_UNKNOWN_LABEL

    ld = _ledger(tmp_path)
    for idx, chain in enumerate((CHAIN_MAIN, CHAIN_SUBAGENT, CHAIN_WORKFLOW, "ad-hoc")):
        ld.append(_mk(
            f"g941-enum-{idx}", tool_name="llm", chain=chain, session_id="s-g941-enum",
            tokens_in=1000, tokens_out=10,
            at=f"2026-10-22T00:00:{idx:02d}Z",
        ))
    by_chain = ld.aggregate()["by_chain"]
    assert set(by_chain) == {
        CHAIN_MAIN, CHAIN_SUBAGENT, CHAIN_WORKFLOW, CHAIN_UNKNOWN_LABEL,
    }
    assert by_chain[CHAIN_WORKFLOW]["tokens_in"] == 1000


def test_g941_unlabeled_legacy_row_never_joins_main_bucket(tmp_path: Path):
    """同 session 内 main 与缺链别的历史条目不得共用基线(未判定桶自成一条链)。"""
    ld = _ledger(tmp_path)
    plan = [
        ("g941-mix-main-1", CHAIN_MAIN, 1000),
        ("g941-mix-legacy", "", 1000),
        ("g941-mix-main-2", CHAIN_MAIN, 1500),
    ]
    for idx, (rid, chain, prompt) in enumerate(plan):
        ld.append(_mk(
            rid, tool_name="llm", chain=chain, session_id="s-g941-mix",
            tokens_in=prompt, tokens_out=10,
            at=f"2026-10-22T00:01:{idx:02d}Z",
        ))
    agg = ld.aggregate()
    # main 链 1000 + 500;未判定链首条 1000 照计(若并进 main 会读成 1500)
    assert agg["total_tokens_in"] == 2500
    assert agg["by_chain"][CHAIN_MAIN]["tokens_in"] == 1500
    assert agg["by_chain"][CHAIN_UNKNOWN_LABEL]["tokens_in"] == 1000


def test_g816021_sync_from_recorder_carries_chain(tmp_path: Path):
    """生产者→录制→入账全链:步骤的 chain 经归一化白名单与 sync_from_recorder
    一路透传到账本条目,聚合面据此分链持基线(缺一环则该用例红)。"""
    ld = _ledger(tmp_path)
    rec = _recorder(tmp_path)
    rec.append_step("run-816021", {
        "type": "llm", "tool_name": "llm", "chain": "main",
        "tokens_in": 1000, "tokens_out": 10, "tokens": 1010,
    })
    rec.append_step("run-816021", {
        "type": "llm", "tool_name": "llm", "chain": "subagent",
        "tokens_in": 1000, "tokens_out": 10, "tokens": 1010,
    })
    out = ld.sync_from_recorder("run-816021", rec, session_id="s-sync")
    assert out["synced"] == 2
    entries = ld._filtered({"session_id": "s-sync"})
    assert {e["chain"] for e in entries} == {"main", "subagent"}
    # 同 prompt 值、同 tool_name,两链各自首条照计(共用基线的旧口径这里 = 1000)
    assert ld.aggregate()["total_tokens_in"] == 2000


async def test_g941_loop_producer_chain_end_to_end_baseline_not_swallowed(tmp_path: Path):
    """G-941 端到端回归锁:生产者→录制→入账→聚合四环一次打通。

    上面两条 G-816021 用例分别钉住聚合面与入账面,但生产者侧(AgentLoopV2 构造器
    chain=)从未被锁 —— 生产构造点漏传参时条目 chain 恒空,退化按 tool_name 分桶,
    少计原地复发。本例驱动真实循环写录制步:main 1000 → subagent 1000 → main 1500
    应得 1000+1000+500=2500;若链在生产侧断掉,三条同 tool_name="llm" 共用基线,
    读成 1000+0+500=1500,本用例即红。
    """
    from app.services.agent_loop_v2 import AgentLoopV2

    ld = _ledger(tmp_path)
    rec = _recorder(tmp_path)

    def _final_llm(prompt_tokens: int):
        async def _mock(messages, tools):
            return {
                "content": "ok",
                "tool_calls": None,
                "usage": {"prompt_tokens": prompt_tokens, "completion_tokens": 10},
            }
        return _mock

    async def _one_round(chain: str, prompt_tokens: int) -> None:
        loop = AgentLoopV2(
            _final_llm(prompt_tokens),
            tools=[],
            max_iterations=2,
            recorder=rec,
            session_id="s-g941",
            chain=chain,
        )
        result = await loop.run([{"role": "user", "content": "hi"}])
        assert result.success is True

    await _one_round("main", 1000)
    await _one_round("subagent", 1000)
    await _one_round("main", 1500)

    # 环①生产者→录制:loop 把构造器 chain 标签落到每个 llm 步
    # (recorder 无 run_id ⇒ 运行键回退 session_id,与生产口径一致)
    steps = rec.replay("s-g941")["steps"]
    llm_steps = [s for s in steps if s["type"] == "llm"]
    assert [s["chain"] for s in llm_steps] == ["main", "subagent", "main"]
    assert [s["tokens_in"] for s in llm_steps] == [1000, 1000, 1500]

    # 环②录制→入账 + 环③聚合面按链分桶持基线
    out = ld.sync_from_recorder("s-g941", rec, user_id="u1", session_id="s-g941")
    assert out["synced"] == 3
    agg = ld.aggregate()
    # main 链 1000+500(第 2 轮只计增量),subagent 链首条 1000 照计不被主链基线吃掉
    assert agg["total_tokens_in"] == 1000 + 1000 + 500 == 2500


def test_g941_finish_run_syncs_three_chains_workflow_never_merges_main(tmp_path: Path):
    """G-941 真判别维度:同 session、同 tool_name="llm" 的 main/subagent/workflow
    三条链经「录制→收尾入账→聚合」各持独立基线,谁也不吃谁。

    只按 tool_name 分桶的旧口径下,三条链同一条基线:1000 + 0 + 0 + 500 + 0 + 0
    = 1500(少计三分之二)。分链后 1500×3 = 4500。
    """
    ld = _ledger(tmp_path)
    rec = _recorder(tmp_path)
    plan = [
        (CHAIN_MAIN, 1000),
        (CHAIN_SUBAGENT, 1000),
        (CHAIN_WORKFLOW, 1000),
        (CHAIN_MAIN, 1500),
        (CHAIN_SUBAGENT, 1500),
        (CHAIN_WORKFLOW, 1500),
    ]
    for idx, (chain, prompt) in enumerate(plan):
        rec.append_step("run-g941-wf", {
            "type": "llm", "tool_name": "llm", "chain": chain,
            "tokens_in": prompt, "tokens_out": 10, "tokens": prompt + 10,
            "at": f"2026-10-27T00:00:{idx:02d}Z",
        })

    out = rec.finish_run("run-g941-wf", user_id="u1", session_id="s-g941-wf", ledger=ld)
    assert out["synced"] == 6

    # 环①:workflow 链别在录制→入账路径上不被丢(丢了就落"未判定"桶)
    entries = ld._filtered({"session_id": "s-g941-wf"})
    assert {e["chain"] for e in entries} == {CHAIN_MAIN, CHAIN_SUBAGENT, CHAIN_WORKFLOW}
    assert {e["tool_name"] for e in entries} == {"llm"}  # 三链共用同一个 tool_name

    agg = ld.aggregate()
    assert agg["total_tokens_in"] == 1500 * 3 == 4500
    # 三链各落一桶、各 2 步、各 1500(1000 首条 + 500 增量)
    by_chain = agg["by_chain"]
    assert set(by_chain) == {CHAIN_MAIN, CHAIN_SUBAGENT, CHAIN_WORKFLOW}
    for chain in (CHAIN_MAIN, CHAIN_SUBAGENT, CHAIN_WORKFLOW):
        assert by_chain[chain]["steps"] == 2
        assert by_chain[chain]["tokens_in"] == 1500
    # by_tool 按 tool_name 仍合桶 —— 合的是展示,基线不共用才是本票的判据
    assert agg["by_tool"]["llm"]["tokens_in"] == 4500

    # 收尾幂等:同一 run 再收一次尾,账不重复记(走同一张方向表逐列合并)
    again = rec.finish_run("run-g941-wf", user_id="u1", session_id="s-g941-wf", ledger=ld)
    assert again["synced"] == 0
    assert again["skipped"] == 6
    assert ld.count() == 6
    assert ld.aggregate()["total_tokens_in"] == 4500


def test_g941_finish_run_degrades_without_breaking_the_caller(tmp_path: Path):
    """收尾入账是**可观测面**:账本不可用 ⇒ 只 warning、如实回 synced=0,不得抛穿调用方。"""
    rec = _recorder(tmp_path)
    rec.append_step("run-g941-broken", {
        "type": "llm", "tool_name": "llm", "chain": CHAIN_WORKFLOW,
        "tokens_in": 1000, "tokens_out": 10, "tokens": 1010,
    })

    class _BrokenLedger:
        def sync_from_recorder(self, *args, **kwargs):
            raise RuntimeError("账本不可用")

    out = rec.finish_run("run-g941-broken", session_id="s-broken", ledger=_BrokenLedger())
    assert out["run_id"] == "run-g941-broken"
    assert out["synced"] == 0
    assert "账本不可用" in out["error"]
    # 录制本身不受影响(降级只发生在入账那一环)
    assert rec.get_run_metrics("run-g941-broken")["step_count"] == 1



def test_g941_finish_run_defaults_to_the_global_ledger_singleton(tmp_path, monkeypatch):
    """接线另一半:`ledger` 缺省时真取到全局账本单例,而不是静默落降级面。

    这条腿若断(延迟 import 打错名字/被 except 吞掉),生产上每次都只 warning +
    synced=0 —— 返回值仍是"收尾完成"的形状,账本却一行不进,正是本票要消灭的
    "录好了不入账"。故用替身单例锁住:不传 ledger 时条目必须落到那本账上。
    """
    import app.services.cost_ledger as ledger_mod

    ld = _ledger(tmp_path)
    monkeypatch.setattr(ledger_mod, "cost_ledger", ld)
    rec = _recorder(tmp_path)
    for chain in (CHAIN_MAIN, CHAIN_WORKFLOW):
        rec.append_step("run-g941-singleton", {
            "type": "llm", "tool_name": "llm", "chain": chain,
            "tokens_in": 1000, "tokens_out": 10, "tokens": 1010,
        })

    out = rec.finish_run("run-g941-singleton", user_id="u1", session_id="s-singleton")
    assert out == {"run_id": "run-g941-singleton", "synced": 2, "skipped": 0}
    assert ld.count() == 2
    assert set(ld.aggregate()["by_chain"]) == {CHAIN_MAIN, CHAIN_WORKFLOW}


# =============================================================================
# 同 record_id 二次投递的逐列定向合并(G-822,2026-09-29)
# 旧行为:同 id ⇒ return {"appended": False} 整条丢弃 ⇒ 迟到的完成事件永远进不了账。
# =============================================================================


def test_g822_direction_table_matches_the_row_shape(tmp_path: Path):
    """行形状三处必须同集合:LedgerEntry 字段 / 方向表 / append 归一化产出。

    加一列而方向表没配 = 那一列静默走默认(正是本票要拦的"一句兜掉")。
    """
    entry_fields = {f.name for f in dataclasses.fields(LedgerEntry)}
    normalized_shape = set(_ledger(tmp_path).append(_mk("shape-1"))["entry"])
    assert normalized_shape == entry_fields == set(COLUMN_DIRECTIONS)


def test_g822_late_completion_fills_duration_and_ended_at(tmp_path: Path):
    """票面核心一条:running → completed 后 duration_ms/ended_at 非空,at 取第一次的值。"""
    ld = _ledger(tmp_path)
    # 注:`status="running"` 被 _normalize 归到 "ok"(既有 _VALID_STATUS 口径,本票不动);
    # "行卡在未完成"的实际形态就是 duration 0 + ended_at 空,由方向表补齐。
    started = ld.append(
        _mk("lc-1", status="running", duration_ms=0, at="2026-09-03T00:00:00Z")
    )
    assert started["appended"] is True
    assert started["outcome"] == "appended"
    assert started["entry"]["duration_ms"] == 0
    assert started["entry"]["ended_at"] == ""

    done = ld.append(
        _mk(
            "lc-1",
            status="running",
            duration_ms=321.5,
            at="2026-09-03T00:00:05Z",
            ended_at="2026-09-03T00:00:05Z",
        )
    )
    assert done["appended"] is False          # 既有含义不变:没有新增行
    assert done["outcome"] == "merged"        # 但行被补齐了
    assert done["changed_columns"] == ["duration_ms", "ended_at"]
    assert done["entry"]["duration_ms"] == 321.5
    assert done["entry"]["ended_at"] == "2026-09-03T00:00:05Z"
    # started_at 语义:首见时刻取最早,盲投把行推到 now 会挪错时间桶
    assert done["entry"]["at"] == "2026-09-03T00:00:00Z"
    # 读面/落盘都看得到补齐后的值
    assert ld.aggregate()["total_duration_ms"] == 321.5
    reloaded = CostLedger(file_path=tmp_path / "ledger.json")
    assert reloaded._filtered({"run_id": "r1"})[0]["duration_ms"] == 321.5


def test_g822_identical_redelivery_is_reported_identical_not_half_merged(tmp_path: Path):
    """逐列合并后行一字未变 ⇒ 回报 identical,内容不得半新半旧。"""
    ld = _ledger(tmp_path)
    first = ld.append(_mk("same-1", tokens_in=123, duration_ms=7.5))
    again = ld.append(_mk("same-1", tokens_in=123, duration_ms=7.5))
    assert again["appended"] is False
    assert again["outcome"] == "identical"
    assert again["changed_columns"] == []
    assert again["entry"] == first["entry"]
    assert ld.count() == 1


def test_g822_first_seen_measurements_are_not_overwritten(tmp_path: Path):
    """先到先定:第二次投更早/更晚的测量值都不得覆盖已有的非空值(两个方向各测一次)。"""
    ld = _ledger(tmp_path)
    ld.append(_mk("fx-1", tokens_in=1000, tokens_out=200))
    bigger = ld.append(_mk("fx-1", tokens_in=1500, tokens_out=300))
    assert bigger["outcome"] == "identical"
    assert bigger["entry"]["tokens_in"] == 1000
    smaller = ld.append(_mk("fx-1", tokens_in=500, tokens_out=50))
    assert smaller["entry"]["tokens_in"] == 1000
    assert smaller["entry"]["total_tokens"] == 1200
    # 已入账金额同样先到先定(账本不是缓存,迟到值不得改写已记的钱)
    priced = ld.append(_mk("fx-1", cost_usd=0.9))
    assert priced["entry"]["cost_usd"] == 0.02
    assert priced["outcome"] == "identical"


def test_g822_absent_first_values_are_filled_by_the_late_delivery(tmp_path: Path):
    """成对另一半:旧值为空(0/"")时迟到值必须补得进来,否则合并等于没合并。"""
    ld = _ledger(tmp_path)
    ld.append(_mk("fx-2", tool_name="", model="", tokens_in=0, tokens_out=0))
    filled = ld.append(_mk("fx-2", tool_name="read_file", model="gpt-4o", tokens_in=900, tokens_out=90))
    assert filled["outcome"] == "merged"
    assert set(filled["changed_columns"]) == {
        "tool_name", "model", "provider", "tokens_in", "tokens_out", "total_tokens",
    }
    row = filled["entry"]
    assert row["tool_name"] == "read_file"
    assert row["tokens_in"] == 900
    assert row["total_tokens"] == 990


def test_g822_sentinel_value_never_overwrites_known_identity(tmp_path: Path):
    """哨兵保护:已知 tool_name 不被 'unknown' 覆盖(盲投整行不变 ⇒ identical)。"""
    ld = _ledger(tmp_path)
    ld.append(_mk("sen-1", tool_name="read_file"))
    blinded = ld.append(_mk("sen-1", tool_name="unknown"))
    assert blinded["outcome"] == "identical"
    assert blinded["entry"]["tool_name"] == "read_file"
    # 反向成对:旧值本身就是哨兵时,已知值必须能替换它
    ld.append(_mk("sen-2", tool_name="unknown"))
    replaced = ld.append(_mk("sen-2", tool_name="read_file"))
    assert replaced["changed_columns"] == ["tool_name"]
    assert replaced["entry"]["tool_name"] == "read_file"


def test_g822_monotone_columns_reject_regressions(tmp_path: Path):
    """耗时/结束时刻取较大者:倒退的投递与"这次没测到"(0/"")都不得把已知值改小。"""
    ld = _ledger(tmp_path)
    ld.append(_mk("mono-1", duration_ms=500, ended_at="2026-09-03T00:00:09Z"))
    regressed = ld.append(_mk("mono-1", duration_ms=50, ended_at="2026-09-03T00:00:02Z"))
    assert regressed["outcome"] == "identical"
    assert regressed["entry"]["duration_ms"] == 500
    assert regressed["entry"]["ended_at"] == "2026-09-03T00:00:09Z"
    blind = ld.append(_mk("mono-1", duration_ms=0, ended_at=""))
    assert blind["outcome"] == "identical"
    assert blind["entry"]["duration_ms"] == 500
    assert blind["entry"]["ended_at"] == "2026-09-03T00:00:09Z"
    # 真正更晚的完成事件仍然推进(单调不等于拒绝前进)
    ahead = ld.append(_mk("mono-1", duration_ms=800, ended_at="2026-09-03T00:00:20Z"))
    assert ahead["changed_columns"] == ["duration_ms", "ended_at"]
    assert ahead["entry"]["duration_ms"] == 800


def test_g822_error_status_survives_a_blind_redelivery(tmp_path: Path):
    """status 的 error 是既成事实:只允许 ok→error 补齐,不允许 error→ok 被盲投洗掉。"""
    ld = _ledger(tmp_path)
    ld.append(_mk("st-err", status="error"))
    washed = ld.append(_mk("st-err", status="ok"))
    assert washed["entry"]["status"] == "error"
    assert washed["outcome"] == "identical"
    ld.append(_mk("st-ok", status="ok"))
    upgraded = ld.append(_mk("st-ok", status="error"))
    assert upgraded["changed_columns"] == ["status"]
    assert upgraded["entry"]["status"] == "error"
    assert ld.aggregate({"status": "error"})["steps"] == 2


def test_g822_sync_from_recorder_shares_the_merge_path(tmp_path: Path):
    """sync 复用 append ⇒ 全仓只有一份合并逻辑;第二次 sync 补齐耗时而不是丢弃。"""
    rec_running = AgentStepRecorder(file_path=tmp_path / "rec-a.json")
    rec_running.append_step(
        "r9", dict(_step("read", 0.1, tin=10, tout=5), duration_ms=0, at="2026-09-03T00:00:01Z")
    )
    ld = _ledger(tmp_path)
    assert ld.sync_from_recorder("r9", rec_running) == {"run_id": "r9", "synced": 1, "skipped": 0}
    assert ld._filtered({"run_id": "r9"})[0]["duration_ms"] == 0.0

    # 同一 run 的同一 step_index(=同一 record_id)带着完成量再投一次
    rec_done = AgentStepRecorder(file_path=tmp_path / "rec-b.json")
    rec_done.append_step(
        "r9", dict(_step("read", 0.1, tin=10, tout=5), duration_ms=64.0, at="2026-09-03T00:00:02Z")
    )
    second = ld.sync_from_recorder("r9", rec_done)
    assert second == {"run_id": "r9", "synced": 0, "skipped": 1}  # 返回键集未扩(既有等值断言)
    assert ld.count() == 1
    row = ld._filtered({"run_id": "r9"})[0]
    assert row["duration_ms"] == 64.0            # 由同一张方向表补齐
    assert row["at"] == "2026-09-03T00:00:01Z"   # 首见时刻不被推后
    assert row["tokens_in"] == 10               # 已入账测量先到先定


def test_g822_merge_entry_does_not_mutate_its_inputs():
    """纯合并模块不得改写两个入参(调用方持有的是账本里的行,污染等于静默改账)。"""
    existing = {"record_id": "m1", "at": "2026-09-03T00:00:00Z", "duration_ms": 0.0}
    incoming = {"record_id": "m1", "at": "2026-09-03T00:00:03Z", "duration_ms": 12.0}
    snapshot_old, snapshot_new = dict(existing), dict(incoming)
    result = merge_entry(existing, incoming)
    assert existing == snapshot_old
    assert incoming == snapshot_new
    assert result.row["duration_ms"] == 12.0
    assert result.row["at"] == "2026-09-03T00:00:00Z"
    assert result.changed_columns == ("duration_ms",)


