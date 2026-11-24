# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""SAG2 词法通道·多样性终排（本仓自有实现）。

取证自对照程序 ``sag2_v10.rs::Corpus::diversify`` 的**设计**：
用 tf-idf 余弦相似度构成核矩阵，与候选分数外积相乘，再做贪心正交化
（Determinantal Point Process 的贪心近似 / Gram-Schmidt 残差选择）。
目的是让最终证据链覆盖不同子话题，而不是十条近乎重复的同一段落。

本文件独立重写，纯函数、零依赖、可对固定夹具逐值复核。
"""

from __future__ import annotations

import math
from collections.abc import Callable
from typing import Any

from .text import casefold_tokens

DPP_TOP_N = 10


def _tfidf_vector(content: str, idf: Callable[[str], float]) -> dict[str, float]:
    counts: dict[str, int] = {}
    for word in casefold_tokens(content):
        counts[word] = counts.get(word, 0) + 1
    vector = {
        term: (1.0 + math.log(count)) * idf(term)
        for term, count in counts.items()
    }
    norm = math.sqrt(sum(value * value for value in vector.values()))
    if norm <= 0.0:
        return {}
    return {term: value / norm for term, value in vector.items()}


def diversify(
    candidates: list[Any],
    idf: Callable[[str], float],
    *,
    top_n: int = DPP_TOP_N,
) -> list[Any]:
    """对 ``candidates[:top_n]`` 做 DPP 贪心重排，其余保持原次序。

    ``candidates`` 元素只需有 ``score``（float）与 ``content``（str）两个属性。
    返回新列表，不就地修改输入（便于测试断言原序）。

    核矩阵 ``K[i][j] = score_i * score_j * cos(v_i, v_j)``，对角为
    ``score_i^2``；每轮选残差最大者，把其余候选在该方向上做正交投影并扣减残差。
    """
    total = len(candidates)
    n = min(total, top_n)
    if n <= 1:
        return list(candidates)

    head = candidates[:n]
    vectors = [_tfidf_vector(c.content, idf) for c in head]
    kernel = [[0.0] * n for _ in range(n)]
    residual = [c.score * c.score for c in head]

    for i in range(n):
        for j in range(n):
            if i == j:
                kernel[i][j] = residual[i]
            else:
                similarity = sum(
                    value * vectors[j].get(term, 0.0)
                    for term, value in vectors[i].items()
                )
                kernel[i][j] = head[i].score * head[j].score * similarity

    maximum = max(residual)
    # 浮点容差：把最大残差的下一个可表示数之差按 n 放大，避免数值噪声死循环。
    tolerance = n * (math.nextafter(maximum, math.inf) - maximum)
    coefficients: list[list[float]] = [[] for _ in range(n)]
    remaining = list(range(n))
    order: list[int] = []

    while remaining:
        winner = max(remaining, key=lambda a: (residual[a], -a))
        if residual[winner] <= tolerance:
            order.extend(remaining)
            break
        order.append(winner)
        remaining = [i for i in remaining if i != winner]
        denominator = math.sqrt(residual[winner])
        if denominator <= 0.0:
            continue
        for i in remaining:
            projection = (
                kernel[winner][i]
                - sum(
                    a * b
                    for a, b in zip(
                        coefficients[winner], coefficients[i], strict=False
                    )
                )
            ) / denominator
            coefficients[i].append(projection)
            residual[i] = max(0.0, residual[i] - projection * projection)

    out = list(candidates)
    for position, index in enumerate(order):
        out[position] = head[index]
    return out
