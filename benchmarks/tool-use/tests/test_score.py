# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import score


@pytest.fixture(scope="module")
def registry():
    return score.load_registry()


def case(**overrides):
    base = {
        "id": "t-001",
        "domain": "code",
        "user": "读一下文件",
        "expected_tools": ["read_file"],
        "alternatives": [],
        "required_args": {"read_file": ["path"]},
        "forbidden_tools": [],
        "_line": 1,
    }
    base.update(overrides)
    return base


def test_top1_and_args_pass(registry):
    result = score.score_case(case(), {"tool_calls": [{"name": "read_file", "arguments": {"path": "a.ts"}}]}, registry)
    assert result["top1"] is True
    assert result["top3"] is True
    assert result["arg_pass"] is True
    assert result["arg_problems"] == []


def test_wrong_tool_but_alternative_in_top3(registry):
    result = score.score_case(
        case(alternatives=["list_files"]),
        {"tool_calls": [{"name": "write_file", "arguments": {"path": "a", "content": "x"}}, {"name": "list_files", "arguments": {"path": "."}}]},
        registry,
    )
    assert result["top1"] is False
    assert result["top3"] is True
    assert result["arg_pass"] is True


def test_missing_required_arg(registry):
    result = score.score_case(case(), {"tool_calls": [{"name": "read_file", "arguments": {}}]}, registry)
    assert result["arg_pass"] is False
    assert "缺 path" in result["arg_problems"]


def test_sequence_hit_allows_extra_calls(registry):
    result = score.score_case(
        case(expected_tools=["edu_list_arrears", "edu_send_fee_reminder_batch"], required_args={}),
        {
            "tool_calls": [
                {"name": "edu_list_arrears", "arguments": {"keyword": "三年级二班"}},
                {"name": "todo_write", "arguments": {}},
                {"name": "edu_send_fee_reminder_batch", "arguments": {"enrollmentIds": ["1"]}},
            ]
        },
        registry,
    )
    assert result["sequence"] is True


def test_forbidden_and_invalid_tools(registry):
    result = score.score_case(
        case(),
        {"tool_calls": [{"name": "read_file", "arguments": {"path": "a"}}, {"name": "not_a_tool", "arguments": {}}]},
        registry,
    )
    assert result["invalid_tools"] == ["not_a_tool"]


def test_validate_cases_rejects_unknown_tool(registry):
    errors = score.validate_cases([case(expected_tools=["no_such_tool"])], registry)
    assert any("未注册工具" in error for error in errors)


def test_validate_cases_rejects_bad_arg_key(registry):
    errors = score.validate_cases([case(required_args={"read_file": ["not_a_param"]})], registry)
    assert any("不在 schema" in error for error in errors)


def test_sample_trajectories_summary(registry):
    cases = score.load_cases(Path(__file__).resolve().parents[1] / "cases" / "golden.jsonl")
    case_by_id = {item["id"]: item for item in cases}
    fixture = Path(__file__).resolve().parent / "fixtures" / "sample_trajectories.jsonl"
    trajectories = {}
    for line in fixture.read_text(encoding="utf-8").splitlines():
        if line.strip():
            payload = json.loads(line)
            trajectories[payload["case_id"]] = payload
    results = [score.score_case(case_by_id[item], payload, registry) for item, payload in trajectories.items()]
    summary = score.summarize(results)
    assert summary["cases"] == 7
    assert summary["top1_rate"] == pytest.approx(6 / 7, abs=1e-4)
    assert summary["arg_pass_rate"] == pytest.approx(5 / 7, abs=1e-4)
    assert summary["clean_rate"] == 1.0


def test_bm25_retrieval_keeps_key_tools_in_top5(registry):
    import tool_retrieval

    tools = registry
    bm25 = tool_retrieval.BM25({name: tool_retrieval.document(tool) for name, tool in tools.items()})
    checks = [
        ("查一下三年级二班还有哪些学员欠费", "edu_list_arrears"),
        ("按 Ctrl+Shift+A", "computer_keyboard_hotkey"),
        ("读一下 apps/web/src/app.tsx", "read_file"),
        ("查我待审批的请假单", "hr_my_leaves"),
    ]
    for query, expected in checks:
        top5 = [name for name, _ in bm25.rank(query)[:5]]
        assert expected in top5, (query, expected, top5)


def test_bm25_full_golden_recall_is_measured(registry):
    import tool_retrieval

    cases = score.load_cases(Path(__file__).resolve().parents[1] / "cases" / "golden.jsonl")
    report = tool_retrieval.evaluate(cases, registry, topk=5)
    assert report["cases"] == 100
    assert 0.75 <= report["recall@5"] <= 1.0


def test_aliases_lift_recall_on_golden(registry):
    import tool_retrieval

    cases = score.load_cases(Path(__file__).resolve().parents[1] / "cases" / "golden.jsonl")
    aliases = json.loads((Path(__file__).resolve().parents[1] / "data" / "tool-aliases.json").read_text(encoding="utf-8"))
    base = tool_retrieval.evaluate(cases, registry, topk=5)
    boosted = tool_retrieval.evaluate(cases, registry, topk=5, aliases=aliases)
    assert boosted["recall@5"] >= base["recall@5"]
    assert boosted["recall@5"] >= 0.95



# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
