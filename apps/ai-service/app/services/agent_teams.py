# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""多智能体团队协作服务(P3-3)。

对标 Anthropic "Agent Teams" / OpenAI "Handoff" 的团队协作杀手锏:
并行 fan-out + 结构化结果聚合 → 聚合摘要经 `summary_context` 回传给
主/主导 agent 的下一轮上下文,形成"聚合后回传主循环"闭环。

本服务提供三层能力:
1. `ResultAggregator.aggregate`(纯函数,确定性、可单测):把多个 subagent 产出
   做结构化聚合,支持 merge(合并)/ best_of(择优)/ consensus(共识)三种策略,
   并对各方结论(key=conclusion)做冲突检测(consensus/conflicts)。
2. `TeamOrchestrator.run_round`:并行 fan-out 派发多个 subagent → 调用 aggregator
   → 产出 `TeamRoundResult`(含 `summary_context` 供主 agent 下一轮注入)。
3. `TeamOrchestrator.run_multi_rounds`:多轮团队协作,每轮把上一轮的聚合摘要
   作为 `round_context` 注入下一轮的每个 subagent — 即"聚合结果回传主循环"的闭环。

设计原则:
- 聚合逻辑为纯函数,不做 IO,便于确定性单测
- fan-out runner 可注入(测试注入 fake,生产默认 `invoke_parallel`),不依赖真实 LLM
- 空输入/全部失败/部分失败均有确定性降级,不抛错
"""

from __future__ import annotations

import logging
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, Literal

from .agent_orchestrator import agent_orchestrator

logger = logging.getLogger(__name__)

# 聚合策略(对齐 packages/types/src/agent-runtime.ts P3-3 契约)
AggregationStrategy = Literal["merge", "best_of", "consensus"]


# =============================================================================
# 数据模型
# =============================================================================


@dataclass
class TeamContributor:
    """单个 subagent 的产出(团队协作的一票)。"""

    name: str
    task: str
    status: str                 # completed / failed / skipped
    output: str = ""
    error: str | None = None
    duration_ms: float = 0.0
    conclusion: str = ""        # 简短结论标签(供 consensus / 冲突检测)
    score: float | None = None  # 0-100,供 best_of 择优

    @classmethod
    def from_task_result(cls, result: dict[str, Any]) -> TeamContributor:
        """从 invoke_parallel 结果的单条 result 构造贡献者。"""
        return cls(
            name=str(result.get("name", "")),
            task=str(result.get("task", "")),
            status=str(result.get("status", "failed")),
            output=str(result.get("output", "") or ""),
            error=result.get("error"),
            duration_ms=float(result.get("duration_ms", 0.0) or 0.0),
            conclusion=str(result.get("conclusion", "") or ""),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "task": self.task,
            "status": self.status,
            "output": self.output,
            "error": self.error,
            "duration_ms": self.duration_ms,
            "conclusion": self.conclusion,
            "score": self.score,
        }


@dataclass
class TeamRoundResult:
    """一轮团队 fan-out + 聚合的结果。"""

    round_id: str
    objective: str
    strategy: AggregationStrategy
    contributors: list[TeamContributor]
    succeeded: int
    failed: int
    partial: bool
    aggregate: dict[str, Any]
    summary_context: str
    round_index: int = 0
    round_count: int = 1

    def to_dict(self) -> dict[str, Any]:
        return {
            "round_id": self.round_id,
            "objective": self.objective,
            "strategy": self.strategy,
            "contributors": [c.to_dict() for c in self.contributors],
            "succeeded": self.succeeded,
            "failed": self.failed,
            "partial": self.partial,
            "aggregate": self.aggregate,
            "summary_context": self.summary_context,
            "round_index": self.round_index,
            "round_count": self.round_count,
        }


# =============================================================================
# 结果聚合器(纯函数,确定性)
# =============================================================================


class ResultAggregator:
    """结构化结果聚合器。

    输入若干 `TeamContributor`,按策略聚合并检测结论冲突。
    所有方法均为 staticmethod,无副作用,便于确定性单测与复用。
    """

    @staticmethod
    def _conclusion_groups(contributors: list[TeamContributor], key: str) -> dict[str, list[str]]:
        """按结论关键字分组成功贡献者 name(忽略空结论 / 未完成)。"""
        groups: dict[str, list[str]] = {}
        for c in contributors:
            if c.status != "completed":
                continue
            val = str(getattr(c, key, "") or "").strip()
            if not val:
                continue
            groups.setdefault(val, []).append(c.name)
        return groups

    @classmethod
    def _consensus_and_conflicts(
        cls, groups: dict[str, list[str]]
    ) -> tuple[dict[str, Any] | None, list[dict[str, Any]]]:
        """从结论分组中求得共识与冲突。

        - 共识:唯一结论或严格多数(> 其余之和);否则 None
        - 冲突:存在 >1 个不同结论时,列出全部结论为 conflicts(含分歧双方)
        """
        if not groups:
            return None, []
        items = sorted(groups.items(), key=lambda kv: (-len(kv[1]), kv[0]))
        top_val, top_agents = items[0]
        rest = [a for _v, a in items[1:]]
        consensus: dict[str, Any] | None = None
        if len(top_agents) > sum(len(a) for a in rest):
            consensus = {
                "value": top_val,
                "count": len(top_agents),
                "agents": sorted(top_agents),
            }
        if len(items) > 1:
            conflicts = [
                {"value": v, "count": len(a), "agents": sorted(a)} for v, a in items
            ]
        else:
            conflicts = []
        return consensus, conflicts

    @staticmethod
    def _scored_key(c: TeamContributor) -> tuple[float, int]:
        """best_of 择优键:优先 score,无分值时以输出长度作为质量代理。"""
        base = c.score if c.score is not None else 0.0
        return (base, len(c.output))

    @classmethod
    def aggregate(
        cls,
        contributors: list[TeamContributor],
        strategy: AggregationStrategy = "merge",
        conclusion_key: str = "conclusion",
    ) -> dict[str, Any]:
        """对 contributors 做结构化聚合。返回确定性的聚合 dict。

        - merge:concatenate 各成功产出(带 [name] 归属);附带共识/冲突检测
        - best_of:按 score 择最佳贡献者,其产出作为 merged_text
        - consensus:求严格多数共识;无法共识时返回 conflicts + 降级合并描述
        - 空输入 / 全部失败:确定性降级(不抛错)
        """
        tasks = list(contributors)
        succeeded = [c for c in tasks if c.status == "completed"]
        failed = len(tasks) - len(succeeded)
        partial = failed > 0 and tasks != []

        groups = cls._conclusion_groups(succeeded, conclusion_key)
        consensus, conflicts = cls._consensus_and_conflicts(groups)
        has_conflict = bool(conflicts)

        # ---- merged_text 按策略生成 ----
        merged_text = ""
        winner: dict[str, Any] | None = None
        if strategy == "best_of" and succeeded:
            best = max(succeeded, key=cls._scored_key)
            merged_text = best.output
            winner = {
                "name": best.name,
                "task": best.task,
                "score": best.score,
                "output_len": len(best.output),
            }
        elif strategy == "consensus":
            if consensus is not None:
                merged_text = (
                    f"共识结论: {consensus['value']}"
                    f"({consensus['count']} 位 agent{consensus['agents']})"
                )
            elif conflicts:
                merged_text = (
                    "各 subagent 结论分裂,未达成共识: "
                    + "; ".join(
                        f"{c['value']}({c['agents']})" for c in conflicts
                    )
                )
            else:
                merged_text = "无可用结论(所有 subagent 未产出结论)"
        else:  # merge
            merged_text = "\n\n---\n\n".join(
                f"[{c.name}]\n{c.output}" for c in succeeded
            )

        # ---- 建议 ----
        if not tasks:
            recommendation = "空输入:无 subagent 任务"
        elif len(succeeded) == 0:
            recommendation = "所有 subagent 均失败,需回退或修正任务后重试"
        elif has_conflict:
            if consensus is not None:
                recommendation = (
                    "意见存在分歧,但多数倾向「"
                    f"{consensus['value']}」,建议主导 agent 复核少数派意见"
                )
            else:
                recommendation = (
                    "各方结论分裂,无多数共识,需主导 agent 裁决,"
                    "或追加一轮聚焦于分歧点的子任务"
                )
        elif consensus is not None:
            recommendation = f"各方结论一致(共识: {consensus['value']})"
        else:
            recommendation = "已聚合全部 subagent 产出,未发现分歧"

        return {
            "strategy": strategy,
            "succeeded": len(succeeded),
            "failed": failed,
            "partial": partial,
            "merged_text": merged_text,
            "winner": winner if strategy == "best_of" else None,
            "consensus": consensus,
            "conflicts": conflicts,
            "has_conflict": has_conflict,
            "recommendation": recommendation,
        }


# =============================================================================
# 团队编排器
# =============================================================================

# fan-out runner 签名:tasks(list[{name,task}]) + max_concurrency → invoke_parallel 式 dict
TeamRunner = Callable[[list[dict[str, Any]], int], Any]


class TeamOrchestrator:
    """团队 fan-out + 聚合 + 回传主循环的编排器。"""

    def __init__(self, orchestrator: Any = None) -> None:
        """orchestrator 可注入(测试用 fake),默认进程内 agent_orchestrator。"""
        self._orchestrator = orchestrator or agent_orchestrator

    async def _default_runner(
        self, tasks: list[dict[str, Any]], max_concurrency: int
    ) -> list[TeamContributor]:
        """默认 runner:调用 orchestrator.invoke_parallel 并映射为贡献者。

        tasks 每项可带可选 `conclusion`,会被附到对应贡献者上(供共识/冲突检测)。
        """
        specs = [
            {
                "name": str(t.get("name", "")),
                "task": str(t.get("task", "")),
                "context": t.get("context") or None,
            }
            for t in tasks
        ]
        out = await self._orchestrator.invoke_parallel(specs, max_concurrency=max_concurrency)
        results = out.get("results") if isinstance(out, dict) else []
        if not isinstance(results, list):
            results = []
        by_name = {
            str(t.get("name", "")): str(t.get("conclusion", "") or "")
            for t in tasks
        }
        contributors = [TeamContributor.from_task_result(r) for r in results]
        for c in contributors:
            c.conclusion = by_name.get(c.name, "") or c.conclusion
        return contributors

    @staticmethod
    def _build_summary_context(
        rr: TeamRoundResult,
        aggregate: dict[str, Any],
        objective: str,
        strategy: str,
    ) -> str:
        """生成供主 agent 下一轮注入的上下文块(summary_context)。"""
        lines: list[str] = []
        lines.append(
            f"## 团队轮次反馈(round {rr.round_index + 1}/{rr.round_count})"
        )
        lines.append(f"目标: {objective}")
        lines.append(
            f"策略: {strategy} | 成功 {rr.succeeded}/{len(rr.contributors)} 失败 {rr.failed}"
        )
        for c in rr.contributors:
            if c.status == "completed":
                snippet = c.output[:120].replace("\n", " ")
                lines.append(f"- [{c.name}] 完成({c.duration_ms:.0f}ms): {snippet}")
            else:
                lines.append(f"- [{c.name}] {c.status}: {c.error or '无输出'}")
        if aggregate.get("consensus"):
            cons = aggregate["consensus"]
            lines.append(
                f"共识: {cons['value']}(agents: {cons['agents']})"
            )
        if aggregate.get("conflicts"):
            lines.append(
                "结论冲突: "
                + "; ".join(f"{x['value']}({x['agents']})" for x in aggregate["conflicts"])
            )
        if aggregate.get("winner"):
            lines.append(f"择优胜出: {aggregate['winner']['name']}")
        lines.append(f"建议: {aggregate.get('recommendation', '')}")
        lines.append("--- 团队聚合内容(供主循环决策) ---")
        lines.append(aggregate.get("merged_text", "") or "无聚合内容")
        return "\n".join(lines)

    async def run_round(
        self,
        objective: str,
        tasks: list[dict[str, Any]],
        strategy: AggregationStrategy = "merge",
        max_concurrency: int = 5,
        runner: TeamRunner | None = None,
        round_index: int = 0,
        round_count: int = 1,
    ) -> TeamRoundResult:
        """一轮团队协作:并行 fan-out → 聚合 → 构建回传主循环的 summary_context。

        tasks 每项:{name, task, context?(可选), conclusion?(可选)}。
        空 tasks 时确定性返回空聚合,不抛错。
        """
        tasks = list(tasks)
        exec_runner = runner or self._default_runner

        if not tasks:
            contributors: list[TeamContributor] = []
        else:
            contributors = await exec_runner(tasks, max_concurrency)

        succeeded = sum(1 for c in contributors if c.status == "completed")
        failed = len(contributors) - succeeded
        aggregate = ResultAggregator.aggregate(contributors, strategy)

        rr = TeamRoundResult(
            round_id=f"round-{uuid.uuid4().hex[:8]}",
            objective=objective,
            strategy=strategy,
            contributors=contributors,
            succeeded=succeeded,
            failed=failed,
            partial=failed > 0 and contributors != [],
            aggregate=aggregate,
            summary_context="",
            round_index=round_index,
            round_count=round_count,
        )
        rr.summary_context = self._build_summary_context(
            rr, aggregate, objective, strategy
        )
        return rr

    async def run_multi_rounds(
        self,
        objective: str,
        rounds: list[dict[str, Any]],
        runner: TeamRunner | None = None,
    ) -> dict[str, Any]:
        """多轮团队协作闭环:每轮把上一轮聚合摘要回传给下一轮各 subagent。

        rounds 每项:{tasks, strategy?, max_concurrency?}。
        返回 {objective, rounds:[TeamRoundResult.to_dict()...],
              final_summary_context} — 末轮聚合摘要即回传主循环的最终上下文。
        """
        rounds = list(rounds)
        result_dicts: list[dict[str, Any]] = []
        transcript: list[str] = []
        for i, spec in enumerate(rounds):
            spec_tasks = [dict(t) for t in (spec.get("tasks") or [])]
            if transcript:
                prev_summary = transcript[-1]
                for t in spec_tasks:
                    ctx = dict(t.get("context") or {})
                    ctx["round_context"] = prev_summary
                    t["context"] = ctx
            rr = await self.run_round(
                objective=objective,
                tasks=spec_tasks,
                strategy=str(spec.get("strategy", "merge")),  # type: ignore[arg-type]
                max_concurrency=int(spec.get("max_concurrency", 5)),
                runner=runner,
                round_index=i,
                round_count=len(rounds),
            )
            transcript.append(rr.summary_context)
            result_dicts.append(rr.to_dict())
        return {
            "objective": objective,
            "rounds": result_dicts,
            "final_summary_context": transcript[-1] if transcript else "",
        }


# 模块级单例
team_orchestrator = TeamOrchestrator()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
