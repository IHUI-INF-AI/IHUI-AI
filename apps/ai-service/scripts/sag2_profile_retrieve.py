# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""多跳检索热点剖析（等价优化前必须先量清分布，不靠猜）。

用法：
    python scripts/sag2_profile_retrieve.py --docs 20000 --rounds 8
"""

from __future__ import annotations

import argparse
import asyncio
import cProfile
import io
import os
import pstats
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.sag2_lexical import LexicalIndex, Sag2LexicalService  # noqa: E402
from app.services.sag2_lexical.retrieval import Sag2Options  # noqa: E402

TOPICS = [
    "预算审批", "报销流程", "向量检索", "合同评审", "数据合规",
    "权限模型", "灰度发布", "故障演练", "客户画像", "风控规则",
]
VERBS = ["说明", "定义", "要求", "记录", "分析", "覆盖", "校验", "约束"]
NOUNS = ["流程", "规范", "边界", "指标", "口径", "责任", "时序", "样例"]


def build_corpus(n: int) -> list[tuple[str, str]]:
    docs: list[tuple[str, str]] = []
    for i in range(n):
        topic = TOPICS[i % len(TOPICS)]
        body = []
        for j in range(6):
            body.append(
                f"{topic}{VERBS[(i + j) % len(VERBS)]}{NOUNS[(i * 3 + j) % len(NOUNS)]}"
                f"第{j + 1}节，编号{i:06d}-{j}，"
                f"涉及{TOPICS[(i + j * 7) % len(TOPICS)]}与"
                f"{TOPICS[(i * 5 + j) % len(TOPICS)]}的协同约定。"
            )
        docs.append((f"corpus/doc-{i:06d}.md", "\n".join(body)))
    return docs


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--docs", type=int, default=20000)
    ap.add_argument("--rounds", type=int, default=8)
    ap.add_argument("--top", type=int, default=22)
    args = ap.parse_args()

    service = Sag2LexicalService(index=LexicalIndex())
    docs = build_corpus(args.docs)
    t0 = time.perf_counter()
    for path, text in docs:
        service.index.add_document(path, text)
    print(f"build {args.docs} docs: {time.perf_counter() - t0:.2f}s")

    queries = [f"{TOPICS[i % len(TOPICS)]}{VERBS[i % len(VERBS)]}" for i in range(args.rounds)]
    # 预热一次（避免把首次 import/惰性初始化算进热点）
    asyncio.run(service.retrieve(queries[0], Sag2Options(max_hops=2)))

    prof = cProfile.Profile()
    prof.enable()
    for q in queries:
        asyncio.run(service.retrieve(q, Sag2Options(max_hops=2)))
    prof.disable()

    stream = io.StringIO()
    stats = pstats.Stats(prof, stream=stream).sort_stats("cumulative")
    stats.print_stats(args.top)
    text = stream.getvalue()
    print(text[:6000])


if __name__ == "__main__":
    main()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
