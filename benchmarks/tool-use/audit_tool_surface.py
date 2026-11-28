#!/usr/bin/env python3
# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""工具面审计：把“工具有多少、占多少上下文、能不能开 strict、有没有同义件”变成可复现的数字。"""

from __future__ import annotations

import argparse
import json
import re
import statistics
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "apps" / "ai-service"))

try:
    import tiktoken as _tiktoken
except ImportError:  # pragma: no cover - 仅在本机未装 tiktoken 时走估算档
    _tiktoken = None
TOKENIZER = "cl100k_base" if _tiktoken else "char2"


def load_tools():
    from app.services.mcp_server import mcp_server

    return mcp_server.list_tools()


def count_tokens(payload: Any) -> int:
    text = json.dumps(payload, ensure_ascii=False)
    if _tiktoken:
        enc = _tiktoken.get_encoding("cl100k_base")
        return len(enc.encode(text))
    # 没有 tiktoken 时只做量级估算；报告里会标记 tokenizer=char2
    return len(text) // 2


def strict_compatible(schema: dict[str, Any]) -> bool:
    props = schema.get("properties") or {}
    required = set(schema.get("required") or [])
    return bool(props) and schema.get("additionalProperties") is False and required == set(props)


def normalize_name(name: str) -> str:
    return "_".join(sorted(name.split("_")))


def jaccard(left: str, right: str) -> float:
    def grams(text: str) -> set[str]:
        ascii_words = set(re.findall(r"[a-z0-9_]{2,}", text.lower()))
        chinese = re.findall(r"[\u4e00-\u9fff]", text)
        return ascii_words | {chinese[i] + chinese[i + 1] for i in range(len(chinese) - 1)}

    a = grams(left)
    b = grams(right)
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def find_duplicate_pairs(tools) -> list[dict[str, Any]]:
    pairs: list[dict[str, Any]] = []
    by_norm: dict[str, list[str]] = {}
    for tool in tools:
        by_norm.setdefault(normalize_name(tool.name), []).append(tool.name)
    for names in by_norm.values():
        if len(names) > 1:
            pairs.append({"kind": "name_order", "tools": names, "similarity": 1.0})
    for i, left in enumerate(tools):
        for right in tools[i + 1 :]:
            if normalize_name(left.name) == normalize_name(right.name):
                continue
            left_tokens = set(left.name.split("_"))
            right_tokens = set(right.name.split("_"))
            if not left_tokens & right_tokens:
                continue
            score = jaccard(left.description or "", right.description or "")
            if score >= 0.9 and len((left.description or "")) >= 40:
                pairs.append({"kind": "description", "tools": [left.name, right.name], "similarity": round(score, 3)})
    return pairs


def deferral_view(tools) -> dict[str, int] | None:
    try:
        from app.routers.agents import _deferral_tool_description, _deferral_tool_parameters
    except Exception:
        return None
    full = light = truncated = 0
    for tool in tools:
        full += count_tokens({"name": tool.name, "description": tool.description, "parameters": tool.input_schema})
        short = _deferral_tool_description(tool.description)
        light += count_tokens({"name": tool.name, "description": short, "parameters": _deferral_tool_parameters(tool.name, tool.input_schema)})
        first_line = (tool.description or "").split("\n", 1)[0].strip()
        if len(short) < len(first_line):
            truncated += 1
    return {"full_tokens": full, "deferral_tokens": light, "truncated": truncated}


def audit() -> dict[str, Any]:
    tools = load_tools()
    schemas = [
        {"name": tool.name, "description": tool.description, "parameters": tool.input_schema}
        for tool in tools
    ]
    strict = sum(1 for tool in tools if strict_compatible(tool.input_schema or {}))
    addprops = sum(1 for tool in tools if (tool.input_schema or {}).get("additionalProperties") is False)
    all_required = 0
    zero_params = 0
    total_props = 0
    described_props = 0
    for tool in tools:
        schema = tool.input_schema or {}
        props = schema.get("properties") or {}
        required = set(schema.get("required") or [])
        if props and required == set(props):
            all_required += 1
        if not props:
            zero_params += 1
        for value in props.values():
            total_props += 1
            if isinstance(value, dict) and value.get("description"):
                described_props += 1
    desc_lengths = [len(tool.description or "") for tool in tools]
    report = {
        "tool_count": len(tools),
        "schema_chars": sum(len(json.dumps(item, ensure_ascii=False)) for item in schemas),
        "schema_tokens": sum(count_tokens(item) for item in schemas),
        "tokenizer": TOKENIZER,
        "strict_compatible": strict,
        "strict_ratio": round(strict / len(tools), 4) if tools else 0,
        "additional_properties_false": addprops,
        "all_properties_required": all_required,
        "zero_param_tools": zero_params,
        "param_count": total_props,
        "param_description_coverage": round(described_props / total_props, 4) if total_props else 0,
        "description_median_chars": statistics.median(desc_lengths) if desc_lengths else 0,
        "description_max_chars": max(desc_lengths) if desc_lengths else 0,
        "description_le_120": sum(1 for length in desc_lengths if length <= 120),
        "tools_with_output_schema": sum(
            1 for tool in tools if getattr(tool, "output_schema", None) or getattr(tool, "outputSchema", None)
        ),
        "tools_with_examples": sum(1 for tool in tools if getattr(tool, "input_examples", None)),
        "duplicate_pairs": find_duplicate_pairs(tools),
    }
    view = deferral_view(tools)
    if view:
        report.update(view)
        report["deferral_saved_ratio"] = round(1 - view["deferral_tokens"] / view["full_tokens"], 4)
    else:
        report["deferral_note"] = "routers.agents 不可导入，未计算 deferral 视图"
    return report


def render_markdown(report: dict[str, Any]) -> str:
    lines = [
        "工具面审计基线",
        "",
        "| 指标 | 读数 |",
        "|---|---:|",
        f"| 工具数 | {report['tool_count']} |",
        f"| 全量 schema tokens | {report['schema_tokens']} |",
        f"| tokenizer | {report['tokenizer']} |",
        f"| strict 兼容 | {report['strict_compatible']} ({report['strict_ratio']:.1%}) |",
        f"| additionalProperties=false | {report['additional_properties_false']} |",
        f"| 全属性 required | {report['all_properties_required']} |",
        f"| 零参数工具 | {report['zero_param_tools']} |",
        f"| 参数说明覆盖率 | {report['param_description_coverage']:.0%} |",
        f"| 描述中位数/最长 | {report['description_median_chars']:.0f} / {report['description_max_chars']} |",
        f"| 描述 ≤120 字符 | {report['description_le_120']} |",
        f"| 带 outputSchema | {report['tools_with_output_schema']} |",
        f"| 带工具示例 | {report['tools_with_examples']} |",
    ]
    if "deferral_tokens" in report:
        lines.extend(
            [
                f"| deferral 后 tokens | {report['deferral_tokens']} |",
                f"| deferral 节省 | {report['deferral_saved_ratio']:.1%} |",
                f"| 描述被截断 | {report['truncated']} |",
            ]
        )
    lines.extend(["", "同义/近义工具对："])
    if report["duplicate_pairs"]:
        for pair in report["duplicate_pairs"]:
            lines.append(f"- {', '.join(pair['tools'])}（{pair['kind']}，{pair['similarity']}）")
    else:
        lines.append("- 无")
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", dest="json_path", default="benchmarks/tool-use/reports/tool-surface-baseline.json")
    parser.add_argument("--md", dest="md_path", default="benchmarks/tool-use/reports/tool-surface-baseline.md")
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args()

    report = audit()
    json_path = REPO_ROOT / args.json_path
    md_path = REPO_ROOT / args.md_path
    json_path.parent.mkdir(parents=True, exist_ok=True)
    json_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    md_path.write_text(render_markdown(report), encoding="utf-8")
    if not args.quiet:
        print(render_markdown(report))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
