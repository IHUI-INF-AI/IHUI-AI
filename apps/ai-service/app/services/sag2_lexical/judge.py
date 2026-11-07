# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""SAG2 词法通道·证据判断 provider（本仓自有实现）。

对照程序用 JEV/Noul 专用模型在**查询时**判断「该候选本身是否为完整答案链的
必要证据」，索引阶段零模型调用。本仓没有该专用端点，因此做成可插拔 provider：

- 无模型配置 ⇒ ``LexicalOnlyJudge``：用纯词法覆盖打分，并**显式**返回
  ``mode=lexical-only`` / ``executed=False`` / 明确 reason。
- 配置了 judge ⇒ ``ModelJudge`` 走本仓 ``llm_gateway``；失败时同样
  ``executed=False`` + reason，**绝不把降级伪装成已判定**。

这是「补齐对照缺失边界」的超越轴：返回体永远能自证这一轮到底有没有真跑模型。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol

from .text import token_set

MODE_LEXICAL_ONLY = "lexical-only"
MODE_MODEL = "model"
MODE_UNAVAILABLE = "unavailable"

NO_MODEL_REASON = (
    "未配置证据判断模型(judge provider);本轮按纯词法打分,"
    "不得声称已完成语义证据判定"
)


@dataclass
class JudgeVerdict:
    """一轮证据判断的结果 + 自证字段。"""

    scores: dict[str, float] = field(default_factory=dict)
    mode: str = MODE_LEXICAL_ONLY
    executed: bool = False
    reason: str = NO_MODEL_REASON


class EvidenceJudge(Protocol):
    """证据判断 provider 契约：给一批候选打 relevance 分。"""

    async def score(
        self,
        question: str,
        candidates: list[Any],
        evidence: list[Any],
    ) -> JudgeVerdict: ...


class LexicalOnlyJudge:
    """零模型判定：候选与「问题 + 已有证据链」的词元重合度。

    刻意保持简单且可预测：这是降级路径，不是对 JEV 的模拟。
    ``executed`` 恒为 False，让调用方一眼看出没有模型参与。
    """

    async def score(
        self,
        question: str,
        candidates: list[Any],
        evidence: list[Any],
    ) -> JudgeVerdict:
        query_terms = token_set(question)
        evidence_terms: set[str] = set()
        for item in evidence:
            evidence_terms |= token_set(getattr(item, "content", ""))
        bridge_terms = evidence_terms - query_terms

        scores: dict[str, float] = {}
        for candidate in candidates:
            content_terms = token_set(getattr(candidate, "content", ""))
            if not query_terms and not content_terms:
                value = 0.0
            else:
                query_overlap = len(query_terms & content_terms)
                bridge_overlap = len(bridge_terms & content_terms)
                # 词法覆盖分为主，桥接词（来自已判定证据）给额外权重，
                # 让多跳链路里「承接上一段落」的段落能被排上来。
                value = (query_overlap + 1.5 * bridge_overlap) / (
                    len(query_terms) + len(bridge_terms) + 1.0
                )
            # 保留 BM25 先验的一部分，避免完全丢掉词法排序信息。
            bm25 = float(getattr(candidate, "bm25", 0.0))
            scores[str(getattr(candidate, "key", id(candidate)))] = min(
                1.0, value + 0.1 * (bm25 / (1.0 + bm25)) if bm25 > 0 else value
            )
        return JudgeVerdict(
            scores=scores,
            mode=MODE_LEXICAL_ONLY,
            executed=False,
            reason=NO_MODEL_REASON,
        )


class ModelJudge:
    """走本仓 ``llm_gateway`` 的证据判断（可选）。

    判定问句复现对照的行为意图：只问「该候选本身是否为完整答案链所必需的
    证据」，不允许把上下文里的事实归给候选、不允许用外部知识。
    任一环节失败都返回 ``executed=False`` 并点名原因。
    """

    CRITERION = (
        "Is this candidate itself necessary evidence in a fully supported answer "
        "chain for the original question? Follow all entity and relation constraints. "
        "Use context only to connect facts; never attribute context facts to the "
        "candidate. Use no outside knowledge. Return a relevance score in [0,1]."
    )

    def __init__(self, gateway: Any, model: str | None = None) -> None:
        self._gateway = gateway
        self._model = model

    async def score(
        self,
        question: str,
        candidates: list[Any],
        evidence: list[Any],
    ) -> JudgeVerdict:
        if not candidates:
            return JudgeVerdict(
                mode=MODE_UNAVAILABLE,
                executed=False,
                reason="候选池为空,未调用模型",
            )
        try:
            payload = {
                "criterion": self.CRITERION,
                "question": question,
                "evidence": [getattr(e, "content", "")[:800] for e in evidence[:10]],
                "candidates": [
                    {
                        "key": str(getattr(c, "key", "")),
                        "content": getattr(c, "content", "")[:800],
                    }
                    for c in candidates
                ],
            }
            raw = await self._gateway.structured_completion(
                payload, model=self._model
            )
            scores = {
                str(item.get("key", "")): float(item.get("score", 0.0))
                for item in (raw.get("scores") or [])
                if isinstance(item, dict)
            }
            if not scores:
                return JudgeVerdict(
                    mode=MODE_UNAVAILABLE,
                    executed=False,
                    reason="模型返回空打分,本轮未采信;请检查 judge provider 输出契约",
                )
            return JudgeVerdict(
                scores=scores, mode=MODE_MODEL, executed=True, reason=""
            )
        except Exception as exc:  # noqa: BLE001 - 降级必须响，不得静默
            return JudgeVerdict(
                mode=MODE_UNAVAILABLE,
                executed=False,
                reason=f"judge provider 调用失败({type(exc).__name__});本轮未采信模型分",
            )


def resolve_judge(gateway: Any | None = None, model: str | None = None) -> EvidenceJudge:
    """按配置选择 provider；未配置返回纯词法判定（诚实降级）。"""
    if gateway is None:
        return LexicalOnlyJudge()
    return ModelJudge(gateway, model)
