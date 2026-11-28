#!/usr/bin/env python3
# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""工具调用评测：校验金标，给录制轨迹打分（Top-1 / Top-3 / 序列 / 参数一次通过）。"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "apps" / "ai-service"))

JSON_TYPES = {
    "string": str,
    "number": (int, float),
    "integer": int,
    "boolean": bool,
    "array": list,
    "object": dict,
}


def load_cases(path: Path) -> list[dict[str, Any]]:
    cases: list[dict[str, Any]] = []
    for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        try:
            case = json.loads(line)
        except json.JSONDecodeError as exc:
            raise ValueError(f"{path}:{line_no} 不是合法 JSON: {exc}") from exc
        case["_line"] = line_no
        cases.append(case)
    return cases


def load_registry():
    from app.services.mcp_server import mcp_server

    return {tool.name: tool for tool in mcp_server.list_tools()}


def validate_arg_type(value: Any, schema: dict[str, Any]) -> bool:
    expected = schema.get("type")
    if isinstance(expected, list):
        return any(validate_arg_type(value, {**schema, "type": item}) for item in expected)
    if expected in JSON_TYPES:
        if expected == "integer" and isinstance(value, bool):
            return False
        if expected == "number" and isinstance(value, bool):
            return False
        return isinstance(value, JSON_TYPES[expected])
    if "anyOf" in schema:
        return any(validate_arg_type(value, item) for item in schema["anyOf"])
    return True


def check_args(tool, arguments: dict[str, Any], required_keys: list[str]) -> tuple[bool, list[str]]:
    schema = tool.input_schema or {}
    props = schema.get("properties") or {}
    problems: list[str] = []
    for key in required_keys:
        if key not in arguments:
            problems.append(f"缺 {key}")
            continue
        value = arguments[key]
        if value in ("", None, [], {}):
            problems.append(f"{key} 为空")
        prop_schema = props.get(key) or {}
        if not validate_arg_type(value, prop_schema):
            problems.append(f"{key} 类型错")
    if schema.get("additionalProperties") is False:
        unexpected = [key for key in arguments if key not in props]
        if unexpected:
            problems.append("多余参数:" + ",".join(sorted(unexpected)))
    return (not problems, problems)


def validate_cases(cases: list[dict[str, Any]], registry: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    ids: Counter[str] = Counter()
    for case in cases:
        ids[case.get("id")] += 1
        expected = case.get("expected_tools") or []
        if not case.get("id"):
            errors.append(f"第 {case['_line']} 行缺 id")
        if not case.get("domain"):
            errors.append(f"{case.get('id')} 缺 domain")
        if not expected:
            errors.append(f"{case.get('id')} 缺 expected_tools")
        for name in expected + (case.get("alternatives") or []) + (case.get("forbidden_tools") or []):
            if name not in registry:
                errors.append(f"{case.get('id')} 引用了未注册工具 {name}")
        for tool_name, keys in (case.get("required_args") or {}).items():
            if tool_name not in registry:
                errors.append(f"{case.get('id')} required_args 指向未注册工具 {tool_name}")
                continue
            props = (registry[tool_name].input_schema or {}).get("properties") or {}
            for key in keys:
                if key not in props:
                    errors.append(f"{case.get('id')} {tool_name}.{key} 不在 schema")
        forbidden = set(case.get("forbidden_tools") or [])
        if forbidden & set(expected):
            errors.append(f"{case.get('id')} 的 forbidden 与 expected 重叠")
    for case_id, count in ids.items():
        if count > 1:
            errors.append(f"id 重复: {case_id} x{count}")
    return errors


def first_match(calls: list[dict[str, Any]], expected: list[str], alternatives: list[str]) -> int | None:
    accepted = {expected[0], *alternatives}
    for index, call in enumerate(calls[:3]):
        if call.get("name") in accepted:
            return index
    return None


def sequence_hit(calls: list[dict[str, Any]], expected: list[str]) -> bool:
    cursor = 0
    for call in calls:
        if cursor < len(expected) and call.get("name") == expected[cursor]:
            cursor += 1
    return cursor == len(expected)


def score_case(case: dict[str, Any], trajectory: dict[str, Any], registry: dict[str, Any]) -> dict[str, Any]:
    calls = trajectory.get("tool_calls") or []
    expected = case.get("expected_tools") or []
    alternatives = case.get("alternatives") or []
    index = first_match(calls, expected, alternatives)
    top1 = bool(calls) and calls[0].get("name") in {expected[0], *alternatives}
    top3 = index is not None
    seq = sequence_hit(calls, expected)
    arg_pass = False
    arg_problems: list[str] = []
    if index is not None:
        call = calls[index]
        tool = registry[call.get("name")]
        required_keys = (case.get("required_args") or {}).get(call.get("name"), [])
        arg_pass, arg_problems = check_args(tool, call.get("arguments") or {}, required_keys)
    forbidden_hit = sorted({call.get("name") for call in calls if call.get("name") in set(case.get("forbidden_tools") or [])})
    invalid = sorted({call.get("name") for call in calls if call.get("name") not in registry})
    return {
        "case_id": case["id"],
        "domain": case["domain"],
        "top1": top1,
        "top3": top3,
        "sequence": seq,
        "arg_pass": arg_pass,
        "arg_problems": arg_problems,
        "forbidden": forbidden_hit,
        "invalid_tools": invalid,
        "turns": trajectory.get("turns", 0),
        "input_tokens": trajectory.get("input_tokens", 0),
        "output_tokens": trajectory.get("output_tokens", 0),
        "first_tool": calls[0].get("name") if calls else None,
    }


def summarize(results: list[dict[str, Any]]) -> dict[str, Any]:
    total = len(results)
    if not total:
        return {"cases": 0}
    by_domain: dict[str, dict[str, int]] = defaultdict(lambda: {"cases": 0, "top1": 0, "arg_pass": 0})
    for item in results:
        bucket = by_domain[item["domain"]]
        bucket["cases"] += 1
        bucket["top1"] += int(item["top1"])
        bucket["arg_pass"] += int(item["arg_pass"])
    return {
        "cases": total,
        "top1_rate": round(sum(item["top1"] for item in results) / total, 4),
        "top3_rate": round(sum(item["top3"] for item in results) / total, 4),
        "sequence_rate": round(sum(item["sequence"] for item in results) / total, 4),
        "arg_pass_rate": round(sum(item["arg_pass"] for item in results) / total, 4),
        "clean_rate": round(sum(1 for item in results if not item["forbidden"] and not item["invalid_tools"]) / total, 4),
        "avg_turns": round(sum(item["turns"] for item in results) / total, 2),
        "avg_tokens": round(sum(item["input_tokens"] + item["output_tokens"] for item in results) / total, 0),
        "domains": {
            domain: {
                "cases": value["cases"],
                "top1_rate": round(value["top1"] / value["cases"], 4),
                "arg_pass_rate": round(value["arg_pass"] / value["cases"], 4),
            }
            for domain, value in sorted(by_domain.items())
        },
        "failures": [item for item in results if not item["top1"] or not item["arg_pass"]],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cases", default="benchmarks/tool-use/cases/golden.jsonl")
    parser.add_argument("--trajectories", default=None)
    parser.add_argument("--json-out", default=None)
    parser.add_argument("--validate-only", action="store_true")
    args = parser.parse_args()

    cases_path = REPO_ROOT / args.cases
    cases = load_cases(cases_path)
    registry = load_registry()
    errors = validate_cases(cases, registry)
    domains = Counter(case["domain"] for case in cases)
    coverage = len({tool for case in cases for tool in (case.get("expected_tools") or [])})
    print(f"cases={len(cases)} domains={dict(sorted(domains.items()))} expected_tool_coverage={coverage}/{len(registry)}")
    if errors:
        print("校验失败:")
        for error in errors:
            print(f"- {error}")
        return 1
    print("校验通过")
    if args.validate_only or not args.trajectories:
        print("未提供 --trajectories，只做金标校验")
        return 0

    trajectories_path = REPO_ROOT / args.trajectories
    trajectories: dict[str, dict[str, Any]] = {}
    for line_no, line in enumerate(trajectories_path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        payload = json.loads(line)
        case_id = payload.get("case_id")
        if not case_id:
            print(f"{trajectories_path}:{line_no} 缺 case_id")
            return 1
        trajectories[case_id] = payload

    case_by_id = {case["id"]: case for case in cases}
    missing = sorted(set(case_by_id) - set(trajectories))
    extra = sorted(set(trajectories) - set(case_by_id))
    if missing:
        print(f"警告: {len(missing)} 条金标没有轨迹，未计分")
    if extra:
        print(f"警告: {len(extra)} 条轨迹没有对应金标，忽略")

    results = [score_case(case_by_id[item], trajectories[item], registry) for item in case_by_id if item in trajectories]
    summary = summarize(results)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    if args.json_out:
        out_path = REPO_ROOT / args.json_out
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps({"summary": summary, "results": results}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
