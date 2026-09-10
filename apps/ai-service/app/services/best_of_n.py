# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Best-of-N 同任务多副本自动择优(2026-09-07 立,对标 Cursor 多副本自动评审择优)。

流程:
    1. 扇出:N 个候选并行调 llm_gateway.complete(同一 messages + model)
    2. 评审:evaluator 模型(LLM judge)按统一 rubric(正确性/完整性/指令遵循)
       为每个候选打 0-100 分,输出 JSON
    3. 择优:最高分胜出;平分取 latency 最低;全败 → BestOfNError
    4. 成本:每候选经 cost_ledger 估算并入账(tool_name=best_of_n)

设计取舍:
    - 候选失败(异常/空 content)→ 剔除不拖垮整体;可用候选耗尽 → 报错
    - 评审失败/输出不可解析 → 确定性规则兜底(长度接近中位数优先),evaluator_fallback=True
    - n 上限 5(成本护栏);n=1 直接透传不打分
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import time
import uuid
from dataclasses import asdict, dataclass, field
from typing import Any

logger = logging.getLogger(__name__)

# 成本护栏
MAX_N = 5
# 评审时单个候选内容截断(评审上下文预算)
_EVAL_CONTENT_LIMIT = 8_000
# 评审模型单次调用超时(秒)
_EVAL_TIMEOUT = 120


class BestOfNError(Exception):
    """Best-of-N 运行失败(所有候选均失败或入参非法)。"""


@dataclass
class CandidateResult:
    """单个候选的执行与评审结果。"""

    candidate_id: int
    content: str = ""
    model: str = ""
    ok: bool = False
    error: str = ""
    score: int | None = None          # 评审分(0-100);n=1 或兜底评分时为 None/启发式
    score_reason: str = ""
    latency_ms: int = 0
    tokens_in: int = 0
    tokens_out: int = 0
    cost_usd: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class BestOfNResult:
    """Best-of-N 整体结果。"""

    winner: CandidateResult
    candidates: list[CandidateResult] = field(default_factory=list)
    n_requested: int = 0
    evaluator_model: str = ""
    evaluator_fallback: bool = False   # True = 评审模型失败,走确定性规则
    rationale: str = ""
    total_cost_usd: float = 0.0
    run_id: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "winner": self.winner.to_dict(),
            "candidates": [c.to_dict() for c in self.candidates],
            "nRequested": self.n_requested,
            "evaluatorModel": self.evaluator_model,
            "evaluatorFallback": self.evaluator_fallback,
            "rationale": self.rationale,
            "totalCostUsd": self.total_cost_usd,
            "runId": self.run_id,
        }


class BestOfNRunner:
    """同任务多副本并行执行 + LLM 评审 + 自动择优。"""

    def __init__(self, gateway: Any = None, ledger: Any = None) -> None:
        # 依赖注入(默认全局单例);gateway 可注入 mock 供测试
        if gateway is None:
            from ..core.llm_gateway import llm_gateway as _gw
            gateway = _gw
        if ledger is None:
            from .cost_ledger import cost_ledger as _ledger
            ledger = _ledger
        self._gateway = gateway
        self._ledger = ledger

    # ------------------------------------------------------------------
    # 对外入口
    # ------------------------------------------------------------------

    async def run(
        self,
        messages: list[dict[str, Any]],
        *,
        model: str | None = None,
        n: int = 3,
        evaluator_model: str | None = None,
        owner_uuid: str | None = None,
        session_id: str = "",
        user_id: str = "",
    ) -> BestOfNResult:
        """并行跑 N 个候选 → 评审 → 择优。"""
        if not messages:
            raise BestOfNError("messages 不能为空")
        n = max(1, min(int(n), MAX_N))
        run_id = f"bon-{uuid.uuid4().hex[:12]}"

        if n == 1:
            # 单副本:直接透传,不打分(语义 = 普通调用 + 统一返回结构)
            cands = [await self._run_candidate(0, messages, model, owner_uuid, run_id, user_id, session_id)]
        else:
            results = await asyncio.gather(
                *(
                    self._run_candidate(i, messages, model, owner_uuid, run_id, user_id, session_id)
                    for i in range(n)
                ),
                return_exceptions=True,
            )
            cands = []
            for i, r in enumerate(results):
                if isinstance(r, BaseException):
                    logger.warning("[best-of-n] candidate %d failed: %s", i, r)
                    cands.append(CandidateResult(candidate_id=i, ok=False, error=str(r)[:300]))
                else:
                    cands.append(r)

        alive = [c for c in cands if c.ok]
        if not alive:
            raise BestOfNError(f"全部 {len(cands)} 个候选均执行失败")

        if n == 1:
            winner, rationale, fallback = alive[0], "单副本模式,不评审直接返回", False
        else:
            winner, rationale, fallback = await self._select(alive, messages, evaluator_model, owner_uuid)

        result = BestOfNResult(
            winner=winner,
            candidates=cands,
            n_requested=n,
            evaluator_model=evaluator_model or "auto",
            evaluator_fallback=fallback,
            rationale=rationale,
            total_cost_usd=round(sum(c.cost_usd for c in cands), 6),
            run_id=run_id,
        )
        logger.info(
            "[best-of-n] run=%s n=%d alive=%d winner=%d score=%s fallback=%s cost=%.4f",
            run_id, n, len(alive), winner.candidate_id, winner.score, fallback, result.total_cost_usd,
        )
        return result

    # ------------------------------------------------------------------
    # 候选执行
    # ------------------------------------------------------------------

    async def _run_candidate(
        self,
        candidate_id: int,
        messages: list[dict[str, Any]],
        model: str | None,
        owner_uuid: str | None,
        run_id: str,
        user_id: str,
        session_id: str,
    ) -> CandidateResult:
        """跑单个候选:计时 + token 统计 + 成本入账。异常直接向上抛(gather 收集)。"""
        started = time.perf_counter()
        resp = await self._gateway.complete(
            messages, model, owner_uuid=owner_uuid,
        )
        latency_ms = int((time.perf_counter() - started) * 1000)
        content = str(resp.get("content") or "").strip()
        if not content:
            raise BestOfNError(f"候选 {candidate_id} 返回空 content")

        usage = resp.get("usage") or {}
        tokens_in = int(usage.get("prompt_tokens") or 0)
        tokens_out = int(usage.get("completion_tokens") or 0)
        used_model = str(resp.get("model") or model or "")

        est = self._ledger.estimate_cost_usd(used_model, tokens_in, tokens_out)
        self._ledger.append({
            "record_id": f"{run_id}:cand:{candidate_id}",
            "user_id": user_id,
            "session_id": session_id,
            "run_id": run_id,
            "tool_name": "best_of_n",
            "model": used_model,
            "tokens_in": tokens_in,
            "tokens_out": tokens_out,
            "total_tokens": tokens_in + tokens_out,
            "cost_usd": est.get("cost_usd", 0.0),
            "duration_ms": latency_ms,
            "status": "ok",
        })

        return CandidateResult(
            candidate_id=candidate_id,
            content=content,
            model=used_model,
            ok=True,
            latency_ms=latency_ms,
            tokens_in=tokens_in,
            tokens_out=tokens_out,
            cost_usd=float(est.get("cost_usd", 0.0)),
        )

    # ------------------------------------------------------------------
    # 评审与择优
    # ------------------------------------------------------------------

    async def _select(
        self,
        alive: list[CandidateResult],
        messages: list[dict[str, Any]],
        evaluator_model: str | None,
        owner_uuid: str | None,
    ) -> tuple[CandidateResult, str, bool]:
        """LLM 评审择优;评审失败走确定性规则兜底。返回 (winner, rationale, fallback)。"""
        try:
            judge_messages = self._build_judge_messages(messages, alive)
            judge_resp = await asyncio.wait_for(
                self._gateway.complete(judge_messages, evaluator_model, owner_uuid=owner_uuid),
                timeout=_EVAL_TIMEOUT,
            )
            judge_text = str(judge_resp.get("content") or "")
            scores = self._parse_judge_output(judge_text, alive)
            if scores is None:
                raise BestOfNError("评审输出不可解析")
            best, rationale = self._apply_scores(alive, scores)
            return best, rationale, False
        except Exception as e:
            logger.warning("[best-of-n] evaluator failed, fallback to deterministic: %s", e)
            best, rationale = self._deterministic_select(alive)
            return best, rationale, True

    def _build_judge_messages(
        self, messages: list[dict[str, Any]], candidates: list[CandidateResult]
    ) -> list[dict[str, Any]]:
        """构造评审 prompt:原任务 + 候选清单 + 统一 rubric,要求输出 JSON。"""
        task_text = "\n".join(
            f"[{m.get('role', 'user')}]: {str(m.get('content', ''))[:4000]}" for m in messages
        )
        cand_blocks = "\n\n".join(
            f"=== 候选 {c.candidate_id} ===\n{c.content[:_EVAL_CONTENT_LIMIT]}"
            for c in candidates
        )
        system = (
            "你是严格的输出质量评审员。给定同一任务(通常是编码/技术任务)的多个候选回答,"
            "按三个维度打分(0-100):正确性(技术事实与代码可运行性)、完整性(覆盖任务全部要求)、"
            "指令遵循(格式/范围/约束)。综合分为三维度加权均值(正确性 0.5/完整性 0.3/遵循 0.2),"
            "取整数。宁可扣分不可放水:幻觉、编造 API、跑不通的代码一律低分。\n"
            "只输出 JSON,不要多余文字,格式:"
            '{"scores":[{"candidate_id":0,"score":87,"reason":"一句话理由"},...]},'
            "必须覆盖全部候选。"
        )
        user = f"# 原任务\n{task_text}\n\n# 候选回答\n{cand_blocks}"
        return [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ]

    def _parse_judge_output(
        self, text: str, candidates: list[CandidateResult]
    ) -> list[dict[str, Any]] | None:
        """从评审输出提取 scores JSON;不可解析返回 None。"""
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            return None
        try:
            data = json.loads(match.group(0))
        except (json.JSONDecodeError, ValueError):
            return None
        scores = data.get("scores") if isinstance(data, dict) else None
        if not isinstance(scores, list):
            return None
        valid_ids = {c.candidate_id for c in candidates}
        parsed: list[dict[str, Any]] = []
        for item in scores:
            if not isinstance(item, dict):
                continue
            cid = item.get("candidate_id")
            if cid not in valid_ids:
                continue
            score = item.get("score")
            if not isinstance(score, (int, float)):
                continue
            parsed.append({
                "candidate_id": int(cid),
                "score": max(0, min(100, int(score))),
                "reason": str(item.get("reason", ""))[:200],
            })
        # 至少覆盖一半存活候选才算有效评审
        return parsed if len(parsed) >= max(1, len(candidates) // 2) else None

    def _apply_scores(
        self, alive: list[CandidateResult], scores: list[dict[str, Any]]
    ) -> tuple[CandidateResult, str]:
        """把评审分写回候选并择优:分高者胜;平分取 latency 最低。"""
        by_id = {c.candidate_id: c for c in alive}
        for s in scores:
            cand = by_id.get(s["candidate_id"])
            if cand is not None:
                cand.score = s["score"]
                cand.score_reason = s["reason"]
        ranked = sorted(alive, key=lambda c: (-(c.score or 0), c.latency_ms))
        best = ranked[0]
        reason_map = {s["candidate_id"]: s["reason"] for s in scores}
        rationale = reason_map.get(best.candidate_id, "评审最高分")
        return best, rationale

    def _deterministic_select(
        self, alive: list[CandidateResult]
    ) -> tuple[CandidateResult, str]:
        """确定性兜底:无评审时按「长度接近存活候选中位数」择优(防极短/极长异常输出)。"""
        lengths = sorted(len(c.content) for c in alive)
        median = lengths[len(lengths) // 2]
        best = min(alive, key=lambda c: (abs(len(c.content) - median), c.latency_ms))
        return best, (
            f"评审模型不可用,确定性规则择优(长度 {len(best.content)} 最接近中位数 {median})"
        )


# 全局单例(router 与测试共用;测试可替换实例)
best_of_n_runner = BestOfNRunner()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
