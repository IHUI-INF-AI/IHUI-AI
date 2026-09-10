# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""1-3 压缩生产指标与灰度测试(2026-09-08 立)。

覆盖:
- compaction_rollout:env 解析容错 / 分桶稳定性与范围 / 边界 0·100 /
  匿名策略(部分灰度期间不压缩)/ 散列均匀性 sanity
- agent_loop_v2._maybe_compact_context 灰度接线:
  percent=0 → 不压缩(与关闭等价) / percent=100 → 正常压缩
- compaction_quality.quality_summary:开关 on/off / 保留率字段
- llm_metrics 埋点辅助:record_context_compaction / failure 的 Prometheus 计数
- context_compaction.record_compaction 扩展字段(source/duration_ms/quality)
- GET /api/context-compaction/stats:admin 聚合报告 / 非 admin 403
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest
from fastapi import HTTPException
from prometheus_client import REGISTRY

from app.core.compaction_rollout import (
    is_user_rollout_enabled,
    rollout_percent,
    user_rollout_bucket,
)


def _req(user_id: str = "u1", role_id: Any = 1) -> SimpleNamespace:
    """伪造 Request(state.user_id / state.role_id)供端点直接调用。"""
    return SimpleNamespace(state=SimpleNamespace(user_id=user_id, role_id=role_id))


def _registry_value(name: str, labels: dict[str, str] | None = None) -> float:
    return REGISTRY.get_sample_value(name, labels) or 0.0


# =============================================================================
# rollout_percent:env 解析
# =============================================================================


def test_rollout_percent_default_100(monkeypatch):
    """未设置 env 时默认 100(全量,与现状逐零差异)。"""
    monkeypatch.delenv("CONTEXT_COMPACTION_ROLLOUT_PERCENT", raising=False)
    assert rollout_percent() == 100


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("0", 0),
        ("50", 50),
        ("100", 100),
        ("150", 100),  # 上界 clamp
        ("-5", 0),  # 下界 clamp
        ("33.7", 33),  # 浮点字符串取整
        ("abc", 100),  # 非法值回退默认
        ("", 100),  # 空串回退默认
    ],
)
def test_rollout_percent_env_parsing(monkeypatch, raw, expected):
    monkeypatch.setenv("CONTEXT_COMPACTION_ROLLOUT_PERCENT", raw)
    assert rollout_percent() == expected


# =============================================================================
# 分桶:稳定性 / 范围 / 均匀性
# =============================================================================


def test_bucket_in_range():
    for uid in ("u1", "user-42", "中文用户", "x" * 500):
        assert 0 <= user_rollout_bucket(uid) < 100


def test_bucket_stable_across_calls():
    """同一 user_id 多次计算结果一致(确定性,不依赖 PYTHONHASH_SEED)。"""
    first = user_rollout_bucket("stable-user")
    for _ in range(20):
        assert user_rollout_bucket("stable-user") == first


def test_bucket_uniformity_sanity():
    """2000 个合成 user_id 在 50% 灰度下命中率应接近 50%(±10%)。"""
    ids = [f"user-{i}" for i in range(2000)]
    hits = sum(1 for i in ids if is_user_rollout_enabled(i, percent=50))
    assert 900 <= hits <= 1100


# =============================================================================
# is_user_rollout_enabled:边界与匿名策略
# =============================================================================


def test_enabled_percent_100_always_true():
    """100% 全量:无 user_id 也命中(默认行为与现状一致)。"""
    assert is_user_rollout_enabled(None, percent=100) is True
    assert is_user_rollout_enabled("", percent=100) is True
    assert is_user_rollout_enabled("anyone", percent=100) is True


def test_enabled_percent_0_always_false():
    assert is_user_rollout_enabled("u1", percent=0) is False
    assert is_user_rollout_enabled(None, percent=0) is False


def test_enabled_anonymous_partial_rollout_false():
    """部分灰度(0<p<100)期间匿名流量不压缩(保守策略)。"""
    for p in (1, 10, 50, 99):
        assert is_user_rollout_enabled(None, percent=p) is False
        assert is_user_rollout_enabled("", percent=p) is False


def test_enabled_matches_bucket_boundary():
    """命中条件严格等价于 bucket < percent(用已知桶验证两侧)。"""
    uid = "boundary-user"
    b = user_rollout_bucket(uid)
    assert is_user_rollout_enabled(uid, percent=b + 1) is True
    assert is_user_rollout_enabled(uid, percent=b) is False


# =============================================================================
# agent_loop_v2 灰度接线
# =============================================================================


def _rollout_tool():
    from app.services.agent_loop_v2 import ToolDefinition

    async def _executor(args):
        return {"ok": True}

    return ToolDefinition(
        name="noop",
        description="无操作",
        parameters={"type": "object", "properties": {}},
        executor=_executor,
    )


def _over_limit_messages() -> list[dict]:
    filler = "历史上下文内容," * 100
    msgs: list[dict] = [{"role": "system", "content": "你是助手"}]
    for i in range(10):
        msgs.append({"role": "user", "content": f"第{i}轮 {filler}"})
        msgs.append({"role": "assistant", "content": f"回答{i} {filler}"})
    return msgs


async def test_agent_loop_rollout_zero_disables_compaction(monkeypatch):
    """percent=0 → 即使启用+超限也不压缩(灰度一键回滚能力)。"""
    from app.services.agent_loop_v2 import AgentLoopV2

    seen: list[int] = []

    async def mock_llm(messages, tools):
        seen.append(len(messages))
        return {"content": "完成", "tool_calls": None}

    monkeypatch.setenv("CONTEXT_COMPACTION_ROLLOUT_PERCENT", "0")
    monkeypatch.setattr(
        "app.services.agent_loop_v2.DEFAULT_COMPACTION_KEEP_RECENT", 2
    )
    loop = AgentLoopV2(
        mock_llm,
        [_rollout_tool()],
        max_iterations=3,
        compaction_enabled=True,
        compaction_context_limit=8000,
        user_id="rollout-user",
    )
    msgs = _over_limit_messages()
    result = await loop.run(msgs)

    assert result.success is True
    assert result.compaction_events == []
    # 未压缩:LLM 看到原样消息数
    assert seen[0] == len(msgs)


async def test_agent_loop_rollout_full_enables_compaction(monkeypatch):
    """percent=100 → 压缩正常触发(默认路径,与现状零差异)。"""
    from app.services.agent_loop_v2 import AgentLoopV2

    monkeypatch.setenv("CONTEXT_COMPACTION_ROLLOUT_PERCENT", "100")
    monkeypatch.setattr(
        "app.services.agent_loop_v2.DEFAULT_COMPACTION_KEEP_RECENT", 2
    )

    async def mock_llm(messages, tools):
        return {"content": "完成", "tool_calls": None}

    loop = AgentLoopV2(
        mock_llm,
        [_rollout_tool()],
        max_iterations=3,
        compaction_enabled=True,
        compaction_context_limit=8000,
        user_id="rollout-user",
    )
    result = await loop.run(_over_limit_messages())

    assert result.success is True
    assert len(result.compaction_events) >= 1
    # 1-3:事件带 duration_ms;灰度默认全量时指标已登记(Prometheus 全局计数,
    # 此处只断言事件字段,计数断言见 metrics 段)
    assert result.compaction_events[0]["duration_ms"] >= 0


# =============================================================================
# quality_summary:开关与字段
# =============================================================================


def test_quality_summary_enabled_returns_retention(monkeypatch):
    monkeypatch.setenv("AGENT_COMPACTION_QUALITY_ENABLED", "on")
    from importlib import reload

    import app.core.tunables as tunables
    import app.services.compaction_quality as cq

    reload(tunables)  # env 在 import 时固化,重读
    try:
        original = [
            {"role": "user", "content": "把 /tmp/a.py 里的 42 行改成 7"},
            {"role": "assistant", "content": "已把 /tmp/a.py 的 42 行改成 7"},
        ]
        compressed = [
            {"role": "user", "content": "用户要求修改 /tmp/a.py,行 42 → 7"}
        ]
        summary = cq.quality_summary(original, compressed)
        assert summary is not None
        assert 0.0 <= summary["retention_ratio"] <= 1.0
        assert summary["facts_total"] >= 1
        assert summary["method"] == "heuristic"
    finally:
        monkeypatch.delenv("AGENT_COMPACTION_QUALITY_ENABLED", raising=False)
        reload(tunables)


def test_quality_summary_disabled_returns_none(monkeypatch):
    monkeypatch.setenv("AGENT_COMPACTION_QUALITY_ENABLED", "off")
    from importlib import reload

    import app.core.tunables as tunables
    import app.services.compaction_quality as cq

    reload(tunables)
    try:
        assert (
            cq.quality_summary(
                [{"role": "user", "content": "x"}],
                [{"role": "user", "content": "y"}],
            )
            is None
        )
    finally:
        monkeypatch.delenv("AGENT_COMPACTION_QUALITY_ENABLED", raising=False)
        reload(tunables)


# =============================================================================
# llm_metrics 埋点辅助:Prometheus 计数增量
# =============================================================================


def test_record_context_compaction_increments_metrics():
    from app.middleware.llm_metrics import record_context_compaction

    labels = {"trigger": "ratio", "source": "llm_route"}
    before_trig = _registry_value("ihui_context_compaction_triggered_total", labels)
    before_succ = _registry_value("ihui_context_compaction_success_total", labels)
    before_saved = _registry_value(
        "ihui_context_compaction_saved_ratio_count", labels
    )
    before_dur = _registry_value(
        "ihui_context_compaction_duration_seconds_count", {"source": "llm_route"}
    )
    before_ret = _registry_value(
        "ihui_context_compaction_quality_retention_count", {"source": "llm_route"}
    )

    record_context_compaction(
        trigger="ratio",
        source="llm_route",
        original_tokens=1000,
        compressed_tokens=400,
        duration_ms=12.5,
        quality={"retention_ratio": 0.8},
    )

    assert (
        _registry_value("ihui_context_compaction_triggered_total", labels)
        == before_trig + 1
    )
    assert (
        _registry_value("ihui_context_compaction_success_total", labels)
        == before_succ + 1
    )
    assert (
        _registry_value("ihui_context_compaction_saved_ratio_count", labels)
        == before_saved + 1
    )
    assert (
        _registry_value(
            "ihui_context_compaction_duration_seconds_count", {"source": "llm_route"}
        )
        == before_dur + 1
    )
    assert (
        _registry_value(
            "ihui_context_compaction_quality_retention_count", {"source": "llm_route"}
        )
        == before_ret + 1
    )


def test_record_context_compaction_failure_increments():
    from app.middleware.llm_metrics import record_context_compaction_failure

    labels = {"source": "agent_loop", "reason": "RuntimeError"}
    before = _registry_value("ihui_context_compaction_failure_total", labels)
    record_context_compaction_failure(source="agent_loop", reason="RuntimeError")
    assert (
        _registry_value("ihui_context_compaction_failure_total", labels)
        == before + 1
    )


# =============================================================================
# record_compaction 扩展字段 + /stats 聚合报告
# =============================================================================


async def test_stats_endpoint_aggregates_admin(monkeypatch):
    from app.routers import context_compaction as cc
    from app.services.context_recall import reset_recall_stats

    monkeypatch.setenv("CONTEXT_COMPACTION_ROLLOUT_PERCENT", "50")
    reset_recall_stats()

    session = "stats-test-session"
    cc._history.clear()
    cc._history[session] = []
    cc.record_compaction(
        session,
        original_tokens=1000,
        compressed_tokens=400,
        summary="[上下文摘要] ...",
        trigger="ratio",
        user_id="u1",
        source="llm_route",
        duration_ms=25.0,
        quality={"retention_ratio": 0.75, "facts_retained": 3, "facts_total": 4},
    )
    cc.record_compaction(
        session,
        original_tokens=500,
        compressed_tokens=250,
        summary="[上下文摘要] ...",
        trigger="ratio",
        user_id="u1",
        source="agent_loop",
        duration_ms=10.0,
        quality={"retention_ratio": 0.5, "facts_retained": 1, "facts_total": 2},
    )

    report = await cc.compaction_stats(_req(user_id="admin", role_id=1))

    assert report["rollout_percent"] == 50
    comp = report["compaction"]
    assert comp["total"] == 2
    assert comp["saved_ratio"]["avg"] == 0.55  # (0.6 + 0.5) / 2
    assert comp["saved_ratio"]["min"] == 0.5
    assert comp["saved_ratio"]["max"] == 0.6
    assert comp["duration_ms"]["avg"] == 17.5
    assert comp["retention"]["avg"] == 0.625
    assert comp["trigger_breakdown"] == {"ratio": 2}
    assert comp["source_breakdown"] == {"llm_route": 1, "agent_loop": 1}
    recall = report["recall"]
    assert recall["requests_hit"] + recall["requests_miss"] == 0
    assert recall["hit_rate"] is None  # 无回捞请求时命中率为 None 而非除零

    # 历史记录字段:source/duration_ms/quality 已入库
    rec = cc._history[session][0]
    assert rec["source"] == "llm_route"
    assert rec["duration_ms"] == 25.0
    assert rec["quality"]["retention_ratio"] == 0.75

    cc._history.clear()


async def test_stats_endpoint_requires_admin():
    from app.routers import context_compaction as cc

    # 未登录(user_id 为空 → get_current_user_id_sync 抛 401)
    with pytest.raises(HTTPException) as exc1:
        await cc.compaction_stats(_req(user_id="", role_id=0))
    assert exc1.value.status_code == 401

    # 已登录非 admin → 403
    with pytest.raises(HTTPException) as exc2:
        await cc.compaction_stats(_req(user_id="u1", role_id=0))
    assert exc2.value.status_code == 403
