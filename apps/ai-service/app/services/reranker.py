# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""RAG 重排器(V3 #52「RAG 真重排」):RRF 多源融合 + 可选 LLM 重排。

背景:原 rag.py:_rerank 只做「按已有 score 排序 + 阈值过滤 + 前 200 字符去重」,
无任何真重排能力。本模块补两层(均无外部依赖,不新增 requirements):

1. RRF 融合(rrf_fuse,默认启用,零成本):
   多路召回(向量 top-N + 关键词 top-N,未来可扩展图谱路)按
   Reciprocal Rank Fusion(Cormack et al. 2009)合并:
       score(item) = Σ_路 1 / (k + rank_i),k 默认 60,rank 从 1 计。
   RRF 只看名次不看原始分,天然免疫两路分数量纲不可比的问题
   (cosine ∈ [0,1] vs 关键词命中数/sqrt(长度)),这是选它而非加权
   线性融合的根本原因。同 item 以 id/path/content 前缀去重聚合。

2. LLM 重排(rerank_with_fallback,env AGENT_RERANK_LLM_ENABLED 默认 off):
   取融合后 top-K(默认 20)候选交 LLM 打相关性分(0-10 + 一句理由,
   structured_completion 强 JSON Schema 输出),按分重排。
   失败/超时/未启用一律降级返回原顺序(RRF 结果),绝不因 rerank
   挂掉影响主链路。

⚠️ 台账登记(领地纪律):本模块新增默认关 env 两个——
   AGENT_RERANK_LLM_ENABLED(默认 false)、AGENT_RERANK_LLM_TOP_K(默认 20)。
   按仓规必须登记进 app/core/capability_matrix.py 台账,但该文件不在
   本任务(V3 #52)领地内,条目 JSON 已在交付报告中给出,由主会话补登。
"""

from __future__ import annotations

import asyncio
import logging
import os
from dataclasses import dataclass, field
from typing import Any, Callable

from ..core.llm_gateway import llm_gateway

logger = logging.getLogger(__name__)

# env 开关(默认关;台账条目见模块 docstring,由主会话补登 capability_matrix)
RERANK_LLM_ENABLED_ENV = "AGENT_RERANK_LLM_ENABLED"
RERANK_LLM_TOP_K_ENV = "AGENT_RERANK_LLM_TOP_K"

# LLM 重排默认候选数与超时(秒)。超时后降级,不让 rerank 拖垮主链路。
DEFAULT_LLM_RERANK_TOP_K = 20
LLM_RERANK_TIMEOUT_S = 10.0

# LLM 打分候选内容截断长度(每条给 LLM 看的正文上限,控制 token 成本)
_LLM_CANDIDATE_CHARS = 300


@dataclass
class FusedItem:
    """RRF 融合结果条目:item 为原对象(融合代表,取名次最高路的首次出现),"""

    item: Any
    score: float  # RRF 分数 = Σ 1/(k + rank_i),量纲与原始分无关
    fused_from: list[str] = field(default_factory=list)  # 命中的来源路标签


def _env_flag(name: str, default: bool = False) -> bool:
    """读取布尔 env(接受 1/true/yes/on,大小写不敏感;未设置用默认)。"""
    raw = os.environ.get(name)
    if raw is None or raw == "":
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


def llm_rerank_enabled() -> bool:
    """LLM 重排是否启用(env AGENT_RERANK_LLM_ENABLED,默认 off)。"""
    return _env_flag(RERANK_LLM_ENABLED_ENV, default=False)


def llm_rerank_top_k() -> int:
    """LLM 重排候选数(env AGENT_RERANK_LLM_TOP_K,默认 20,非法值回退默认)。"""
    raw = os.environ.get(RERANK_LLM_TOP_K_ENV)
    if raw is None or raw == "":
        return DEFAULT_LLM_RERANK_TOP_K
    try:
        v = int(raw)
    except ValueError:
        return DEFAULT_LLM_RERANK_TOP_K
    return v if v > 0 else DEFAULT_LLM_RERANK_TOP_K


# =========================================================================
# RRF 融合(默认启用,无外部依赖)
# =========================================================================


def _default_key(item: Any) -> str:
    """去重键:优先 id/path(dict 键或对象属性),兜底 content 前 200 字符。

    content 前 200 与 rag.py 原 _rerank 去重口径一致,保证兼容。
    """
    for attr in ("id", "path"):
        if isinstance(item, dict):
            v = item.get(attr)
        else:
            v = getattr(item, attr, None)
        if v:
            return f"{attr}:{v}"
    if isinstance(item, dict):
        content = str(item.get("content", ""))
    else:
        content = str(getattr(item, "content", ""))
    return "content:" + content.strip()[:200]


def rrf_fuse(
    rankings: list[list[Any]],
    k: int = 60,
    labels: list[str] | None = None,
    key_fn: Callable[[Any], str] | None = None,
) -> list[FusedItem]:
    """Reciprocal Rank Fusion:多路排名融合为单一列表。

    Args:
        rankings: 各路召回结果(每路已按相关度排好序),如 [向量 top-N, 关键词 top-N]。
        k: RRF 常数(论文默认 60,平滑名次差异)。
        labels: 各路的来源标签(如 ["vector", "keyword"]),与 rankings 对齐;
            缺省自动生成 r0/r1/...。
        key_fn: 去重键函数,缺省 _default_key(id → path → content 前 200)。

    Returns:
        list[FusedItem] 按 RRF 分数降序(同分保持首次出现顺序,稳定排序)。
        同 item 多路命中时聚合分数并记录所有来源路,融合代表取名次最高路的
        首次出现对象。空输入返回 []。
    """
    if not rankings:
        return []
    key_fn = key_fn or _default_key

    fused: dict[str, FusedItem] = {}
    order: list[str] = []  # 首次出现顺序(同分时保持稳定)
    for li, ranking in enumerate(rankings):
        label = labels[li] if labels and li < len(labels) else f"r{li}"
        for rank, item in enumerate(ranking, start=1):
            key = key_fn(item)
            contrib = 1.0 / (k + rank)  # rank 从 1 计(论文口径)
            if key in fused:
                fused[key].score += contrib
                fused[key].fused_from.append(label)
            else:
                fused[key] = FusedItem(item=item, score=contrib, fused_from=[label])
                order.append(key)

    result = [fused[key] for key in order]
    # 降序;Python 排序稳定,同分保持首次出现顺序(测试可精确断言)
    result.sort(key=lambda f: f.score, reverse=True)
    return result


# =========================================================================
# LLM 重排(默认关;失败/超时一律降级)
# =========================================================================

# structured_completion 强 JSON Schema:每候选一个 {index, score, reason}
_RERANK_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "scores": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "index": {"type": "integer"},
                    "score": {"type": "number"},
                    "reason": {"type": "string"},
                },
                "required": ["index", "score"],
            },
        }
    },
    "required": ["scores"],
}


async def llm_rerank_scores(
    query: str,
    items: list[Any],
    model: str | None = None,
) -> list[tuple[int, float, str]] | None:
    """交 LLM 对候选打相关性分(0-10 + 理由)。

    Args:
        query: 用户查询。
        items: 候选列表(鸭子类型:只需 .content 属性,不依赖 RAGSource,
            避免与 rag.py 循环导入)。
        model: 模型名(空用网关默认)。

    Returns:
        [(候选下标, 分数, 理由), ...](0-10 分,未按分排序);
        未启用 / 超时 / LLM 失败 / 输出非法 一律返回 None(调用方降级)。
    """
    if not items or not llm_rerank_enabled():
        return None

    lines = [
        f"[{i}] {str(getattr(it, 'content', '' )).strip()[:_LLM_CANDIDATE_CHARS]}"
        for i, it in enumerate(items)
    ]
    prompt = (
        "你是搜索相关性评估器。给定用户查询与候选片段列表,"
        "对每个候选打 0-10 的相关性分(10=完全回答查询,0=完全无关),"
        "并给一句理由。index 为候选编号。\n\n"
        f"查询: {query}\n\n候选:\n" + "\n".join(lines)
    )
    messages = [
        {"role": "system", "content": "只输出符合 schema 的 JSON,不要输出其他内容。"},
        {"role": "user", "content": prompt},
    ]

    try:
        # asyncio.wait_for 兜底:structured_completion 自身重试之外再限总时长
        result = await asyncio.wait_for(
            llm_gateway.structured_completion(
                messages,
                _RERANK_SCHEMA,
                model=model,
                schema_name="rag_rerank_scores",
            ),
            timeout=LLM_RERANK_TIMEOUT_S,
        )
    except (asyncio.TimeoutError, Exception) as e:  # noqa: BLE001 - 降级语义:rerank 失败绝不抛
        logger.warning("reranker.llm_rerank_scores 失败(降级原排序): %s", e)
        return None

    if not isinstance(result, dict) or result.get("error"):
        logger.warning(
            "reranker.llm_rerank_scores LLM 返回错误(降级原排序): %s",
            result.get("error_message", "") if isinstance(result, dict) else type(result).__name__,
        )
        return None

    raw_scores = result.get("scores")
    if not isinstance(raw_scores, list):
        return None

    out: list[tuple[int, float, str]] = []
    for entry in raw_scores:
        if not isinstance(entry, dict):
            continue
        try:
            idx = int(entry.get("index"))
            score = float(entry.get("score", 0.0))
        except (TypeError, ValueError):
            continue
        # 越界下标丢弃;分数截断到 [0,10]
        if idx < 0 or idx >= len(items):
            continue
        score = max(0.0, min(10.0, score))
        out.append((idx, score, str(entry.get("reason", ""))))
    return out if out else None


async def rerank_with_fallback(
    query: str,
    items: list[Any],
    top_k: int | None = None,
    model: str | None = None,
) -> tuple[list[Any], bool]:
    """LLM 重排总入口:启用且成功则重排,否则原样返回(降级)。

    只对前 top_k(默认取 env AGENT_RERANK_LLM_TOP_K,默认 20)候选打分重排,
    其余候选保持原顺序跟在后面——控制 token 成本,尾部低名次候选重排收益低。

    Returns:
        (排序后列表, 是否实际使用了 LLM 重排)。
        未启用 / 空输入 / 失败 → (原列表副本, False)。
    """
    if not items or not llm_rerank_enabled():
        return list(items), False

    k = top_k if top_k is not None else llm_rerank_top_k()
    head, tail = list(items[:k]), list(items[k:])

    scores = await llm_rerank_scores(query, head, model=model)
    if scores is None:
        return list(items), False

    # 有分的候选按分降序(同分保持原相对顺序);无分的候选按原顺序垫在后面
    scored_map: dict[int, float] = {}
    for idx, score, _reason in scores:
        scored_map[idx] = score
    ranked_idx = [idx for idx, _s, _r in sorted(scores, key=lambda t: (-t[1], t[0]))]
    unscored_idx = [i for i in range(len(head)) if i not in scored_map]
    ordered = [head[i] for i in ranked_idx + unscored_idx]
    return ordered + tail, True


# 本模块函数即门面(rrf_fuse / rerank_with_fallback),无需单例实例。
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
