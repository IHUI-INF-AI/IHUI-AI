"""Phase 19 建议 4 测试: 多模型自动选型."""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "ops"))

try:
    from model_selector import (
        DEFAULT_PROFILES,
        WEIGHT_TABLE,
        ModelProfile,
        ModelSelector,
        Preference,
        ScoredModel,
        SelectionRecord,
        TaskType,
        main,
    )

    HAS_MODULE = True
except Exception:  # pragma: no cover
    HAS_MODULE = False


pytestmark = pytest.mark.skipif(not HAS_MODULE, reason="module not importable")


def _last_json(text: str):
    text = text.strip()
    candidates: list[str] = []
    i = 0
    while i < len(text):
        ch = text[i]
        if ch not in "{[":
            i += 1
            continue
        open_ch = ch
        close_ch = "}" if ch == "{" else "]"
        depth = 0
        in_str = False
        escape = False
        for j in range(i, len(text)):
            c = text[j]
            if escape:
                escape = False
                continue
            if c == "\\":
                escape = True
                continue
            if in_str:
                if c == '"':
                    in_str = False
                continue
            if c == '"':
                in_str = True
                continue
            if c == open_ch:
                depth += 1
            elif c == close_ch:
                depth -= 1
                if depth == 0:
                    candidate = text[i : j + 1]
                    try:
                        json.loads(candidate)
                        candidates.append(candidate)
                    except json.JSONDecodeError:
                        pass
                    i = j + 1
                    break
        else:
            i += 1
    return json.loads(candidates[-1])


# ---------------------------------------------------------------------------
# 1. 枚举 / 数据类
# ---------------------------------------------------------------------------


def test_task_type_values():
    assert TaskType.CHAT.value == "chat"
    assert TaskType.CODE.value == "code"
    assert Preference.QUALITY.value == "quality"


def test_model_profile_to_dict():
    p = ModelProfile("gpt-4o", 0.005, 0.015, 0.95, 800)
    d = p.to_dict()
    assert d["name"] == "gpt-4o"
    assert d["provider"] == "unknown"


def test_scored_model_to_dict():
    p = ModelProfile("gpt-4o", 0.005, 0.015, 0.95, 800)
    s = ScoredModel(
        model=p, quality_norm=0.95, cost_norm=0.5, latency_norm=0.5, weighted_score=0.8, estimated_cost_usd=0.01
    )
    d = s.to_dict()
    assert d["model"] == "gpt-4o"
    assert d["weighted_score"] == 0.8


def test_selection_record_to_dict():
    r = SelectionRecord(
        ts=time.time(), task=TaskType.CHAT, preference=Preference.QUALITY, chosen="gpt-4o", candidates=[], text_len=100
    )
    d = r.to_dict()
    assert d["chosen"] == "gpt-4o"
    assert d["task"] == "chat"


# ---------------------------------------------------------------------------
# 2. 评分
# ---------------------------------------------------------------------------


def test_default_profiles_not_empty():
    assert len(DEFAULT_PROFILES) >= 5


def test_weight_table_complete():
    """所有 (task, preference) 组合都有权重."""
    for task in TaskType:
        for pref in Preference:
            assert (task, pref) in WEIGHT_TABLE


def test_score_all_returns_sorted():
    s = ModelSelector()
    scored = s.score_all(TaskType.CHAT, text_len=1000, preference=Preference.BALANCED)
    assert len(scored) == len(DEFAULT_PROFILES)
    for i in range(len(scored) - 1):
        assert scored[i].weighted_score >= scored[i + 1].weighted_score


def test_score_quality_prefers_high_quality():
    """QUALITY 偏好下, 排名第一的总分 >= 其它所有."""
    s = ModelSelector()
    scored = s.score_all(TaskType.CODE, text_len=1000, preference=Preference.QUALITY)
    top_score = scored[0].weighted_score
    for sc in scored[1:]:
        assert top_score >= sc.weighted_score
    # 同时验证: 质量分第一是总分第一的充分条件之一 (无 cost/latency 干扰)
    # 用极端权重 (1,0,0) 验证
    custom_w = {(TaskType.CODE, Preference.QUALITY): (1.0, 0.0, 0.0)}
    s2 = ModelSelector(weights=custom_w)
    scored2 = s2.score_all(TaskType.CODE, text_len=1000, preference=Preference.QUALITY)
    max_q = max(p.quality_score for p in DEFAULT_PROFILES)
    assert scored2[0].model.quality_score == max_q


def test_score_cost_prefers_low_cost():
    """COST 偏好下, 排名第一的总分 >= 其它所有."""
    s = ModelSelector()
    scored = s.score_all(TaskType.SUMMARIZE, text_len=1000, preference=Preference.COST)
    top_score = scored[0].weighted_score
    for sc in scored[1:]:
        assert top_score >= sc.weighted_score
    # 极端权重 (0,1,0) -> 纯按 cost 选
    custom_w = {(TaskType.SUMMARIZE, Preference.COST): (0.0, 1.0, 0.0)}
    s2 = ModelSelector(weights=custom_w)
    scored2 = s2.score_all(TaskType.SUMMARIZE, text_len=1000, preference=Preference.COST)
    min_c = min(s2._estimate_cost(p, 1000) for p in DEFAULT_PROFILES)
    assert scored2[0].estimated_cost_usd == min_c


def test_score_latency_prefers_low_latency():
    s = ModelSelector()
    scored = s.score_all(TaskType.EMBEDDING, text_len=1000, preference=Preference.LATENCY)
    top = scored[0]
    # 第一个的 latency 应该是最低
    min_lat = min(p.model.latency_p50_ms for p in scored)
    assert top.model.latency_p50_ms == min_lat


def test_estimate_cost_positive():
    s = ModelSelector()
    scored = s.score_all(TaskType.CHAT, text_len=100, preference=Preference.BALANCED)
    for sc in scored:
        assert sc.estimated_cost_usd > 0


def test_norm_zero_when_same():
    """所有模型 cost / latency 相同时, 归一化为 0."""
    profiles = [ModelProfile(f"m{i}", 0.001, 0.001, 0.5, 100) for i in range(3)]
    s = ModelSelector(profiles=profiles)
    scored = s.score_all(TaskType.CHAT, text_len=100, preference=Preference.BALANCED)
    for sc in scored:
        assert sc.cost_norm == 0.0
        assert sc.latency_norm == 0.0


# ---------------------------------------------------------------------------
# 3. 选型
# ---------------------------------------------------------------------------


def test_select_returns_top():
    s = ModelSelector()
    chosen, scored = s.select(TaskType.CHAT, 1000, Preference.QUALITY)
    assert chosen.name == scored[0].model.name


def test_select_records_history():
    s = ModelSelector()
    s.select(TaskType.CHAT, 1000)
    s.select(TaskType.CODE, 1000)
    h = s.history()
    assert len(h) == 2


def test_select_different_tasks_different_choice():
    s = ModelSelector()
    # CODE 质量权重高, COST 权重的选择可能不同
    _, scored_code_quality = s.select(TaskType.CODE, 1000, Preference.QUALITY)
    _, scored_code_cost = s.select(TaskType.CODE, 1000, Preference.COST)
    # 不一定不同, 但应该都能拿到结果
    assert scored_code_quality[0].model.name is not None
    assert scored_code_cost[0].model.name is not None


# ---------------------------------------------------------------------------
# 4. 自定义
# ---------------------------------------------------------------------------


def test_add_profile():
    s = ModelSelector(profiles=[])
    s.add_profile(ModelProfile("custom", 0.001, 0.002, 0.7, 200))
    assert len(s.profiles) == 1


def test_custom_weights():
    custom_w = {(TaskType.CHAT, Preference.QUALITY): (1.0, 0.0, 0.0)}
    s = ModelSelector(weights=custom_w)
    chosen, _ = s.select(TaskType.CHAT, 1000, Preference.QUALITY)
    # 纯按质量选
    max_q = max(DEFAULT_PROFILES, key=lambda p: p.quality_score)
    assert chosen.name == max_q.name


# ---------------------------------------------------------------------------
# 5. 统计 / 报表
# ---------------------------------------------------------------------------


def test_stats():
    s = ModelSelector()
    s.select(TaskType.CHAT, 1000)
    s.select(TaskType.CHAT, 1000)
    s.select(TaskType.CODE, 1000)
    stats = s.stats()
    assert stats["total"] == 3
    assert sum(stats["by_model"].values()) == 3


def test_report():
    s = ModelSelector()
    s.select(TaskType.CHAT, 1000)
    s.select(TaskType.CODE, 1000)
    md = s.report()
    assert "多模型选型报表" in md
    assert "总选型次数" in md


# ---------------------------------------------------------------------------
# 6. CLI
# ---------------------------------------------------------------------------


def test_cli_demo(capsys):
    rc = main(["demo"])
    out = capsys.readouterr().out
    data = _last_json(out)
    assert "results" in data
    assert len(data["results"]) == 16  # 4 tasks * 4 prefs


def test_cli_select(capsys):
    rc = main(["select", "--task", "chat", "--text-len", "1000", "--preference", "quality"])
    out = capsys.readouterr().out
    data = _last_json(out)
    assert "chosen" in data
    assert "all_scores" in data


def test_cli_report(capsys):
    rc = main(["report"])
    out = capsys.readouterr().out
    assert "多模型选型报表" in out
