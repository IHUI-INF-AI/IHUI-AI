#!/usr/bin/env python3
# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""用 100 条金标反查工具检索：BM25 能否在 156 枚工具里把正确工具捞进 Top-5。"""

from __future__ import annotations

import argparse
import json
import math
import re
from collections import Counter
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
TOKEN_RE = re.compile(r"[a-z0-9_]+|[\u4e00-\u9fff]+")


def tokenize(text: str) -> list[str]:
    tokens: list[str] = []
    for chunk in TOKEN_RE.findall((text or "").lower()):
        if chunk.isascii():
            if len(chunk) >= 2:
                tokens.append(chunk)
            continue
        tokens.extend(chunk)
        tokens.extend(chunk[i : i + 2] for i in range(len(chunk) - 1))
    return tokens


def load_tools():
    import sys

    sys.path.insert(0, str(REPO_ROOT / "apps" / "ai-service"))
    from app.services.mcp_server import mcp_server

    return {tool.name: tool for tool in mcp_server.list_tools()}


def document(tool) -> list[str]:
    schema = tool.input_schema or {}
    props = schema.get("properties") or {}
    tokens: list[str] = []
    tokens.extend(tokenize(tool.name) * 3)
    tokens.extend(tokenize(tool.description))
    for name, value in props.items():
        tokens.extend(tokenize(name) * 2)
        if isinstance(value, dict):
            tokens.extend(tokenize(value.get("description") or ""))
    return tokens


class BM25:
    def __init__(self, docs: dict[str, list[str]], k1: float = 1.5, b: float = 0.75):
        self.docs = docs
        self.k1 = k1
        self.b = b
        self.avgdl = sum(len(doc) for doc in docs.values()) / max(1, len(docs))
        self.tf = {name: Counter(doc) for name, doc in docs.items()}
        self.df = Counter()
        for doc in docs.values():
            self.df.update(set(doc))
        self.n = len(docs)

    def idf(self, term: str) -> float:
        df = self.df.get(term, 0)
        return math.log(1 + (self.n - df + 0.5) / (df + 0.5))

    def score(self, query: str, name: str) -> float:
        q = Counter(tokenize(query))
        tf = self.tf[name]
        dl = len(self.docs[name])
        total = 0.0
        for term, qf in q.items():
            f = tf.get(term, 0)
            if not f:
                continue
            total += self.idf(term) * (f * (self.k1 + 1)) / (f + self.k1 * (1 - self.b + self.b * dl / self.avgdl)) * qf
        return total

    def rank(self, query: str) -> list[tuple[str, float]]:
        return sorted(((name, self.score(query, name)) for name in self.docs), key=lambda item: (-item[1], item[0]))


def load_cases(path: Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def evaluate(cases: list[dict[str, Any]], tools: dict[str, Any], topk: int = 5) -> dict[str, Any]:
    bm25 = BM25({name: document(tool) for name, tool in tools.items()})
    results = []
    for case in cases:
        accepted = {case["expected_tools"][0], *(case.get("alternatives") or [])}
        ranking = bm25.rank(case["user"])
        rank = next((i + 1 for i, (name, _) in enumerate(ranking) if name in accepted), None)
        results.append(
            {
                "id": case["id"],
                "domain": case["domain"],
                "user": case["user"],
                "expected": case["expected_tools"][0],
                "rank": rank,
                "top5": [name for name, _ in ranking[:topk]],
            }
        )
    total = len(results)
    return {
        "cases": total,
        "recall@1": round(sum(1 for item in results if item["rank"] == 1) / total, 4),
        f"recall@{topk}": round(sum(1 for item in results if item["rank"] and item["rank"] <= topk) / total, 4),
        "mrr": round(sum(1 / item["rank"] for item in results if item["rank"]) / total, 4),
        "misses": [item for item in results if not item["rank"] or item["rank"] > topk],
    }


def render(report: dict[str, Any], topk: int = 5) -> str:
    lines = [
        "工具检索基线（BM25，无 embedding、无模型）",
        "",
        f"- 用例：{report['cases']}",
        f"- Recall@1：{report['recall@1']:.1%}",
        f"- Recall@{topk}：{report[f'recall@{topk}']:.1%}",
        f"- MRR：{report['mrr']:.3f}",
        "",
        "Top-5 未命中：",
    ]
    for item in report["misses"]:
        lines.append(f"- {item['id']}「{item['user']}」期望 {item['expected']}，Top5={item['top5']}")
    if not report["misses"]:
        lines.append("- 无")
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cases", default="benchmarks/tool-use/cases/golden.jsonl")
    parser.add_argument("--topk", type=int, default=5)
    parser.add_argument("--json-out", default="benchmarks/tool-use/reports/tool-retrieval-baseline.json")
    parser.add_argument("--md-out", default="benchmarks/tool-use/reports/tool-retrieval-baseline.md")
    args = parser.parse_args()

    cases = load_cases(REPO_ROOT / args.cases)
    tools = load_tools()
    report = evaluate(cases, tools, args.topk)
    json_path = REPO_ROOT / args.json_out
    md_path = REPO_ROOT / args.md_out
    json_path.parent.mkdir(parents=True, exist_ok=True)
    json_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    md_path.write_text(render(report, args.topk), encoding="utf-8")
    print(render(report, args.topk))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
