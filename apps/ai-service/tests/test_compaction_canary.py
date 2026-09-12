# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""1-3 压缩灰度决策测试(2026-09-12 立,PROJECT_PLAN H7)。

覆盖:canary_bucket 稳定性与值域 / parse_canary_percent 边界(未设/非法/越界)/
is_canary_selected 边界(0%/100%/单调性)/ resolve_compaction_decision 各 mode
(off/ratio/full)+ legacy 回退(MODE 未设/非法/未命中灰度/fail-closed)。
"""

import pytest

from app.services import compaction_canary as cc


@pytest.fixture(autouse=True)
def _isolate_env(monkeypatch):
    """每个用例从干净 env 开始(压缩相关 4 个 env 全部清掉)。"""
    for key in (
        cc.ENV_COMPACTION_MODE,
        cc.ENV_COMPACTION_CANARY_PERCENT,
        "AGENT_COMPACTION_ENABLED",
        "AGENT_COMPACTION_LLM_ENABLED",
    ):
        monkeypatch.delenv(key, raising=False)
    yield


def test_canary_bucket_stable_and_range():
    b1 = cc.canary_bucket("session-abc")
    b2 = cc.canary_bucket("session-abc")
    assert b1 == b2  # 同 key 稳定
    assert 0 <= b1 < 10000  # 值域 [0, 10000)


def test_canary_bucket_distributes():
    buckets = {cc.canary_bucket(f"session-{i}") for i in range(100)}
    # 100 个不同 key 不应坍缩到同一桶(哈希分布有效)
    assert len(buckets) > 10


def test_parse_canary_percent_boundaries():
    assert cc.parse_canary_percent(None) == 100.0  # 未设置 → 全量
    assert cc.parse_canary_percent("") == 100.0
    assert cc.parse_canary_percent("  ") == 100.0
    assert cc.parse_canary_percent("50") == 50.0
    assert cc.parse_canary_percent("12.5") == 12.5
    assert cc.parse_canary_percent("0") == 0.0
    assert cc.parse_canary_percent("-5") == 0.0  # 越界 clamp
    assert cc.parse_canary_percent("150") == 100.0


def test_parse_canary_percent_invalid_fail_closed():
    """非法值 fail-closed:按 0% 处理(配置错误时不放量新策略)。"""
    assert cc.parse_canary_percent("abc") == 0.0
    assert cc.parse_canary_percent("50%") == 0.0


def test_is_canary_selected_zero_and_full():
    assert cc.is_canary_selected("any", 0) is False
    assert cc.is_canary_selected("any", -1) is False
    assert cc.is_canary_selected("any", 100) is True
    assert cc.is_canary_selected("any", 200) is True


def test_is_canary_selected_stable_and_monotone():
    key = "session-monotone"
    p50 = cc.is_canary_selected(key, 50)
    assert cc.is_canary_selected(key, 50) == p50  # 稳定
    # 单调:10% 命中 → 50% 必命中;50% 未命中 → 10% 必未命中
    if cc.is_canary_selected(key, 10):
        assert p50 is True
    else:
        assert cc.is_canary_selected(key, 1) is False


def test_resolve_mode_unset_legacy():
    monkeypatch_env = {"AGENT_COMPACTION_ENABLED": "true"}
    import os

    for k, v in monkeypatch_env.items():
        os.environ[k] = v
    try:
        d = cc.resolve_compaction_decision("s1")
        assert d.mode == "legacy"
        assert d.enabled is True
        assert d.llm_enabled is False
        assert d.canary_selected is True
    finally:
        for k in monkeypatch_env:
            os.environ.pop(k, None)


def test_resolve_mode_unset_legacy_default_disabled(monkeypatch):
    d = cc.resolve_compaction_decision("s1")
    assert d.mode == "legacy"
    assert d.enabled is False  # 默认行为不变(未配置 = 不压缩)
    assert d.llm_enabled is False


def test_resolve_invalid_mode_falls_back_to_legacy(monkeypatch):
    monkeypatch.setenv(cc.ENV_COMPACTION_MODE, "bogus")
    d = cc.resolve_compaction_decision("s1")
    assert d.mode == "legacy"
    assert d.enabled is False


def test_resolve_mode_full_selected(monkeypatch):
    monkeypatch.setenv(cc.ENV_COMPACTION_MODE, "full")
    # 未设灰度比例 → 默认 100% 全量
    d = cc.resolve_compaction_decision("s1")
    assert d.mode == "full"
    assert d.enabled is True
    assert d.llm_enabled is True
    assert d.canary_selected is True


def test_resolve_mode_ratio_selected(monkeypatch):
    monkeypatch.setenv(cc.ENV_COMPACTION_MODE, "ratio")
    d = cc.resolve_compaction_decision("s1")
    assert d.mode == "ratio"
    assert d.enabled is True
    assert d.llm_enabled is False
    assert d.canary_selected is True


def test_resolve_mode_off_overrides_legacy_enabled(monkeypatch):
    """MODE=off 优先级最高:即使 legacy env 开启,命中灰度的会话也彻底关闭。"""
    monkeypatch.setenv(cc.ENV_COMPACTION_MODE, "off")
    monkeypatch.setenv("AGENT_COMPACTION_ENABLED", "true")
    d = cc.resolve_compaction_decision("s1")
    assert d.mode == "off"
    assert d.enabled is False
    assert d.llm_enabled is False
    assert d.canary_selected is True


def test_resolve_not_selected_falls_back_to_legacy(monkeypatch):
    """构造恰好不命中灰度的比例(阈值 = bucket)→ 回退 legacy 行为。"""
    key = "session-not-selected"
    bucket = cc.canary_bucket(key)
    percent = bucket / 100.0  # bucket < bucket*1.0 为 False → 恰不命中
    monkeypatch.setenv(cc.ENV_COMPACTION_MODE, "ratio")
    monkeypatch.setenv(cc.ENV_COMPACTION_CANARY_PERCENT, str(percent))
    d = cc.resolve_compaction_decision(key)
    assert d.mode == "legacy"
    assert d.canary_selected is False
    assert d.enabled is False  # legacy 默认关闭 = 放量前行为


def test_resolve_invalid_percent_fail_closed(monkeypatch):
    """灰度比例非法 → 0%:任何会话都不放量新策略(fail-closed)。"""
    monkeypatch.setenv(cc.ENV_COMPACTION_MODE, "full")
    monkeypatch.setenv(cc.ENV_COMPACTION_CANARY_PERCENT, "abc")
    d = cc.resolve_compaction_decision("s1")
    assert d.mode == "legacy"
    assert d.canary_selected is False


def test_resolve_partial_canary_splits_by_hash(monkeypatch):
    """50% 灰度:同批 key 中按哈希二分,且每个 key 的归属稳定。"""
    monkeypatch.setenv(cc.ENV_COMPACTION_MODE, "ratio")
    monkeypatch.setenv(cc.ENV_COMPACTION_CANARY_PERCENT, "50")
    keys = [f"session-{i}" for i in range(200)]
    first = {k: cc.resolve_compaction_decision(k) for k in keys}
    second = {k: cc.resolve_compaction_decision(k) for k in keys}
    selected = [k for k, d in first.items() if d.mode == "ratio"]
    unselected = [k for k, d in first.items() if d.mode == "legacy"]
    # 200 个 key 按哈希应有两侧(近似各半,宽松断言防哈希偏斜 flake)
    assert 20 < len(selected) < 180
    assert len(selected) + len(unselected) == 200
    # 稳定:重复解析结果不变
    for k in keys:
        assert first[k] == second[k]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
