# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""SAG2 规模上探：在真索引上量延迟与内存，不用估算。

为什么单独一个脚本而不是塞进 pytest：
单机 pytest 里跑 20 万篇要几分钟、吃几 GB，会把常规回归拖成不可用；规模探针
属于**交付证据**，按需执行并把读数写进文档。

用法::

    python scripts/sag2_scale_probe.py --docs 20000
    python scripts/sag2_scale_probe.py --docs 200000 --json out.json

口径（写进输出，避免"看起来很快"）：
- 语料：``random.Random(seed)`` 生成 CJK + 拉丁混排段落，同一 seed 可复现；
- ``search``：按文件合并的快速搜索（离线 BM25，零模型）；
- ``retrieve``：查询时多跳检索（零模型，judge 走 lexical-only 降级）；
- 延迟：单线程串行，取 p50/p95/max，单位毫秒；
- 内存：优先 ``psutil`` 的 RSS；取不到就报 ``null``，绝不编。
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import random
import statistics
import sys
import time
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.sag2_lexical import LexicalIndex, Sag2LexicalService  # noqa: E402
from app.services.sag2_lexical.retrieval import Sag2Options  # noqa: E402

CJK_TERMS = [
    "预算", "审批", "报销", "季度", "目标", "复盘", "招聘", "绩效", "客户", "合同",
    "发票", "回款", "风控", "合规", "供应链", "仓储", "物流", "客服", "工单", "上线",
    "回滚", "灰度", "监控", "告警", "演练", "灾备", "审计", "权限", "密钥", "证书",
]
LATIN_TERMS = [
    "budget", "approval", "refund", "quarter", "target", "retro", "hiring", "review",
    "customer", "contract", "invoice", "payment", "risk", "compliance", "supply",
    "warehouse", "logistics", "support", "ticket", "release", "rollback", "canary",
    "monitor", "alert", "drill", "disaster", "audit", "permission", "secret", "cert",
]


def build_docs(count: int, *, seed: int = 20260101) -> list[tuple[str, str]]:
    rng = random.Random(seed)
    docs: list[tuple[str, str]] = []
    for i in range(count):
        paras: list[str] = []
        for _ in range(3):
            words = [rng.choice(CJK_TERMS) for _ in range(14)]
            words += [rng.choice(LATIN_TERMS) for _ in range(8)]
            rng.shuffle(words)
            paras.append(" ".join(words) + "。")
        docs.append((f"kb/scale/doc{i:07d}.txt", "\n".join(paras)))
    return docs


def build_index(docs: list[tuple[str, str]]) -> LexicalIndex:
    index = LexicalIndex()
    for path, content in docs:
        index.add_document(path, content)
    return index


def pct(values: list[float], q: float) -> float:
    ordered = sorted(values)
    if not ordered:
        return 0.0
    pos = (len(ordered) - 1) * q
    lo, hi = int(pos), min(int(pos) + 1, len(ordered) - 1)
    return ordered[lo] + (ordered[hi] - ordered[lo]) * (pos - lo)


def summarize(values: list[float]) -> dict[str, float]:
    return {
        "p50": round(pct(values, 0.5), 2),
        "p95": round(pct(values, 0.95), 2),
        "max": round(max(values), 2) if values else 0.0,
        "mean": round(statistics.fmean(values), 2) if values else 0.0,
        "n": len(values),
    }


def rss_mb() -> float | None:
    try:
        import psutil  # noqa: PLC0415 - 可选

        return round(psutil.Process().memory_info().rss / (1024 * 1024), 1)
    except Exception:  # noqa: BLE001 - 取不到就报 None
        return None


QUERIES = [
    "预算 审批 流程",
    "季度 复盘 目标",
    "回款 invoice payment",
    "灰度 发布 rollback",
    "灾备 drill disaster",
    "审计 permission secret",
    "物流 仓储 logistics warehouse",
    "客户 工单 support ticket",
]


def probe(docs_count: int, *, rounds: int = 12) -> dict[str, Any]:
    docs = build_docs(docs_count)
    started = time.perf_counter()
    index = build_index(docs)
    build_s = time.perf_counter() - started

    service = Sag2LexicalService(index=index)
    status = service.status()

    search_ms: list[float] = []
    retrieve_ms: list[float] = []
    hits = 0
    for i in range(rounds):
        query = QUERIES[i % len(QUERIES)]
        t0 = time.perf_counter()
        result = service.search(query, limit=20)
        search_ms.append((time.perf_counter() - t0) * 1000.0)
        hits += len(result.get("items", []))

        t0 = time.perf_counter()
        deep = asyncio.run(service.retrieve(query, Sag2Options(max_hops=2)))
        retrieve_ms.append((time.perf_counter() - t0) * 1000.0)
        hits += len(deep.to_dict().get("results", []))

    return {
        "documents_requested": docs_count,
        "documents": status["documents"],
        "chunks": status["chunks"],
        "terms": status["terms"],
        "build_seconds": round(build_s, 2),
        "build_docs_per_second": round(docs_count / build_s, 1) if build_s else None,
        "rss_mb": rss_mb(),
        "search_ms": summarize(search_ms),
        "retrieve_ms": summarize(retrieve_ms),
        "results_seen": hits,
        "rounds": rounds,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="SAG2 规模上探")
    parser.add_argument("--docs", type=int, default=20000)
    parser.add_argument("--rounds", type=int, default=12)
    parser.add_argument("--json", default="")
    args = parser.parse_args()

    report = probe(args.docs, rounds=args.rounds)
    text = json.dumps(report, ensure_ascii=False, indent=2)
    print(text)
    if args.json:
        with open(args.json, "w", encoding="utf-8") as handle:
            handle.write(text + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
