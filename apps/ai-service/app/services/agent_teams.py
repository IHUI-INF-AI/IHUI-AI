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

D121 片一新增(团队共享任务列表,2026-10-23):
4. `TeamTaskBoard`:`id/title/status/owner/updatedAt` 五字段的团队级任务板,
   内存为主副本 + 既有 `ttl_json_store` 存档(带保留期);认领是"检查并置位"
   在同一临界区完成,故并发认领只有一个赢家。owner 变更即发 `subagent.handoff`
   事件(走既有编排事件总线,不新开 SSE 帧族 —— 票面 D121 明令)。

设计原则:
- 聚合逻辑为纯函数,不做 IO,便于确定性单测
- fan-out runner 可注入(测试注入 fake,生产默认 `invoke_parallel`),不依赖真实 LLM
- 空输入/全部失败/部分失败均有确定性降级,不抛错
"""

from __future__ import annotations

import logging
import threading
import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

from .agent_orchestrator import agent_orchestrator
from .dag_scheduler import KANBAN_TASK_STATUSES
from .ttl_json_store import iso_now, load_ttl_records, resolve_retention_days, write_json_atomic

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


# =============================================================================
# 团队共享任务列表(D121 片一)
# =============================================================================

# 换手事件的对外事件名。**不是新的 SSE 帧族**:票面 D121 明令"SSE 复用 subagent_*
# 帧族扩 event 子类型,禁新帧族",而本仓既有的跨支柱事件总线(PillarEventBus)已经用
# `subagent.dispatched/completed/failed/evolved` 这一族承载 subagent 侧事件,故换手
# 作为该族的一个新子类型登记(orchestration_hub.PILLAR_EVENTS),不新增帧名。
# 读出口因此是既有的 `GET /api/orchestration/events?event_type=subagent.handoff`。
TEAM_HANDOFF_EVENT_TYPE = "subagent.handoff"

# 任务板存档:与 agent_longterm_memory / audit_log 同一套 TTL JSON 落盘件(§数据出域
# 合规整改),不新开存储。保留期默认 30 天,可由 env 覆盖(纯数字,非法值回落并告警)。
_TEAM_TASK_FILE = Path(__file__).resolve().parents[2] / "data" / "team_tasks.json"
_TEAM_TASK_RETENTION_DAYS = resolve_retention_days("TEAM_TASKS_RETENTION_DAYS", 30)
_TEAM_TASK_MAX_ITEMS = 2000

# 事件投递出口:签名对齐 orchestration_hub.emit(event_type, payload) → event_id。
TeamEventSink = Callable[[str, dict[str, Any]], Awaitable[str]]


async def _emit_team_event_to_hub(event_type: str, payload: dict[str, Any]) -> str:
    """默认事件出口:投到既有编排事件总线(惰性 import,避免服务层循环依赖)。"""
    from .orchestration_hub import orchestration_hub

    event_id: str = await orchestration_hub.emit(
        event_type=event_type,
        source_pillar="subagent",
        payload=payload,
    )
    return event_id


@dataclass
class TeamTaskItem:
    """团队任务板的一条任务(字段对齐票面:id/title/status/owner/updatedAt)。"""

    id: str
    team_id: str
    title: str
    status: str
    owner: str
    created_at: str
    updated_at: str

    def to_wire(self) -> dict[str, Any]:
        """对外形状(camelCase,与 packages/types `AgentTask` 同风格)。

        `owner` 为空串表示"无人持有"(不用 null:两端都不必为可选值写分支)。
        """
        return {
            "id": self.id,
            "teamId": self.team_id,
            "title": self.title,
            "status": self.status,
            "owner": self.owner,
            "createdAt": self.created_at,
            "updatedAt": self.updated_at,
        }


@dataclass
class TeamTaskMutation:
    """任务板写操作的结果。`reason` 是机器可读的封闭取值,路由据此映射业务码。"""

    ok: bool
    reason: str = ""
    task: TeamTaskItem | None = None


def build_team_handoff_payload(
    task: TeamTaskItem,
    from_owner: str,
    to_owner: str,
    reason: str = "",
) -> dict[str, Any]:
    """换手事件载荷的唯一构造函数(形状单源,测试与路由都从这里取)。

    为什么载荷自带 team_id/task_id/task_title:事件总线上是**全局**流,
    消费方(未来的 Fleet 仪表盘)只能靠载荷过滤;少一个字段就得回查任务板,
    而那时的任务板可能已经被改写 —— 事件变成了它自己都无法自证的东西。
    """
    return {
        "handoff_id": f"ho-{uuid.uuid4().hex[:8]}",
        "team_id": task.team_id,
        "task_id": task.id,
        "task_title": task.title,
        "from_owner": from_owner,
        "to_owner": to_owner,
        "status": task.status,
        "reason": reason,
        "at": iso_now(),
    }


def _is_valid_task_record(record: Any) -> bool:
    """存档记录结构校验:五字段缺一即按坏记录剔除(fail-closed,不猜)。"""
    if not isinstance(record, dict):
        return False
    return bool(record.get("id")) and bool(record.get("team_id")) and isinstance(
        record.get("title"), str
    )


class TeamTaskBoard:
    """团队级共享任务板(内存主副本 + TTL JSON 存档)。

    并发认领的唯一性怎么保证:认领是"读当前 owner + 判定 + 置位"三步,三步在
    同一个 `threading.RLock` 临界区里完成,临界区内**没有任何 await**
    (asyncio 只在 await 处让出),所以 N 个协程并发 claim 时只有一个能把空 owner
    置成自己。为此 `_claim_locked` 刻意保持同步,发事件放在锁外。
    """

    def __init__(
        self,
        file_path: str | Path | None = None,
        sink: TeamEventSink | None = None,
        retention_days: int | None = None,
    ) -> None:
        self._file = Path(file_path) if file_path is not None else _TEAM_TASK_FILE
        self._sink: TeamEventSink = sink or _emit_team_event_to_hub
        self._retention_days = (
            _TEAM_TASK_RETENTION_DAYS if retention_days is None else retention_days
        )
        self._records: dict[str, dict[str, Any]] = {}
        self._loaded = False
        self._lock = threading.RLock()

    # ---- 存档 ----

    def _ensure_loaded(self) -> None:
        """惰性读盘一次;读不到按空表(不抛错),坏了也不覆盖磁盘原文件。"""
        if self._loaded:
            return
        self._loaded = True
        try:
            raw, dropped = load_ttl_records(
                self._file,
                retention_days=self._retention_days,
                shape="mapping",
                max_items=_TEAM_TASK_MAX_ITEMS,
                validate=_is_valid_task_record,
            )
        except Exception as e:  # noqa: BLE001 - 存档坏不该让任务板不可用
            logger.warning("[agent_teams] 团队任务板读盘失败(按空表继续): %s", e)
            return
        if dropped:
            logger.info("[agent_teams] 团队任务板加载:清理过期/坏记录 %d 条", dropped)
        self._records = {
            str(key): dict(value) for key, value in raw.items() if isinstance(value, dict)
        }

    def _persist(self) -> None:
        """全量写回(原子写,失败只告警:内存副本仍在,下次变更再试)。"""
        write_json_atomic(self._file, self._records, indent=2)

    # ---- 读 ----

    def _find(self, team_id: str, task_id: str) -> dict[str, Any] | None:
        record = self._records.get(task_id)
        if record is None or str(record.get("team_id", "")) != team_id:
            return None
        return record

    @staticmethod
    def _to_item(record: dict[str, Any]) -> TeamTaskItem:
        return TeamTaskItem(
            id=str(record.get("id", "")),
            team_id=str(record.get("team_id", "")),
            title=str(record.get("title", "")),
            status=str(record.get("status", "todo")),
            owner=str(record.get("owner", "") or ""),
            created_at=str(record.get("created_at", "")),
            updated_at=str(record.get("updated_at", "")),
        )

    def list_tasks(self, team_id: str) -> list[TeamTaskItem]:
        """列某团队全部任务(按创建时刻、再按 id 稳定排序)。"""
        with self._lock:
            self._ensure_loaded()
            records = [
                record
                for record in self._records.values()
                if str(record.get("team_id", "")) == team_id
            ]
        records.sort(key=lambda r: (str(r.get("created_at", "")), str(r.get("id", ""))))
        return [self._to_item(r) for r in records]

    def get_task(self, team_id: str, task_id: str) -> TeamTaskItem | None:
        with self._lock:
            self._ensure_loaded()
            record = self._find(team_id, task_id)
            return self._to_item(record) if record is not None else None

    # ---- 写 ----

    def create(
        self,
        team_id: str,
        title: str,
        owner: str = "",
        status: str = "todo",
        task_id: str | None = None,
    ) -> TeamTaskItem:
        """新建任务。status 必须是 kanban 词汇之一(单一真相源 KANBAN_TASK_STATUSES)。"""
        if status not in KANBAN_TASK_STATUSES:
            raise ValueError(f"status 不在 kanban 词汇表内: {status}")
        now = iso_now()
        with self._lock:
            self._ensure_loaded()
            new_id = task_id or f"tt-{uuid.uuid4().hex[:12]}"
            record: dict[str, Any] = {
                "id": new_id,
                "team_id": team_id,
                "title": title,
                "status": status,
                "owner": owner or "",
                "created_at": now,
                "updated_at": now,
            }
            self._records[new_id] = record
            self._persist()
            return self._to_item(record)

    def _claim_locked(self, team_id: str, task_id: str, owner: str) -> TeamTaskMutation:
        record = self._find(team_id, task_id)
        if record is None:
            return TeamTaskMutation(ok=False, reason="not_found")
        current = str(record.get("owner", "") or "")
        if current == owner:
            # 幂等:同一持有者重复认领不是失败,也不再发换手事件(owner 没变)。
            return TeamTaskMutation(ok=True, reason="already_owned", task=self._to_item(record))
        if current:
            return TeamTaskMutation(
                ok=False, reason="already_claimed", task=self._to_item(record)
            )
        record["owner"] = owner
        record["updated_at"] = iso_now()
        # 认领即开工:待执行档推进到 in_progress(已是其它档则不动,不覆盖人工设定)。
        if str(record.get("status", "")) in ("triage", "todo", "ready"):
            record["status"] = "in_progress"
        self._persist()
        return TeamTaskMutation(ok=True, reason="claimed", task=self._to_item(record))

    async def claim(self, team_id: str, task_id: str, owner: str) -> TeamTaskMutation:
        """认领任务(并发安全:临界区内无 await,只有一个赢家)。"""
        with self._lock:
            self._ensure_loaded()
            outcome = self._claim_locked(team_id, task_id, owner)
        if outcome.ok:
            task = outcome.task
            if task is not None and outcome.reason == "claimed":
                await self._emit_handoff(task, "", owner, "claim")
        return outcome

    async def update(
        self,
        team_id: str,
        task_id: str,
        *,
        title: str | None = None,
        status: str | None = None,
        owner: str | None = None,
        reason: str = "",
    ) -> TeamTaskMutation:
        """改标题/状态/持有者。**owner 发生变更**时发换手事件(改标题/状态不发)。"""
        if status is not None and status not in KANBAN_TASK_STATUSES:
            raise ValueError(f"status 不在 kanban 词汇表内: {status}")
        with self._lock:
            self._ensure_loaded()
            record = self._find(team_id, task_id)
            if record is None:
                return TeamTaskMutation(ok=False, reason="not_found")
            before_owner = str(record.get("owner", "") or "")
            changed = False
            if title is not None and title != record.get("title"):
                record["title"] = title
                changed = True
            if status is not None and status != record.get("status"):
                record["status"] = status
                changed = True
            if owner is not None and owner != before_owner:
                record["owner"] = owner
                changed = True
            if not changed:
                # 无变化也刷新 updated_at? 不刷 —— "没变"不该看起来像"刚动过"。
                return TeamTaskMutation(ok=True, reason="unchanged", task=self._to_item(record))
            record["updated_at"] = iso_now()
            self._persist()
            task = self._to_item(record)
        if owner is not None and owner != before_owner:
            await self._emit_handoff(task, before_owner, owner, reason or "handoff")
        return TeamTaskMutation(ok=True, reason="updated", task=task)

    def delete(self, team_id: str, task_id: str) -> bool:
        with self._lock:
            self._ensure_loaded()
            if self._find(team_id, task_id) is None:
                return False
            self._records.pop(task_id, None)
            self._persist()
            return True

    async def _emit_handoff(
        self,
        task: TeamTaskItem,
        from_owner: str,
        to_owner: str,
        reason: str,
    ) -> None:
        """发换手事件。投递失败只告警:owner 已经改了,不能因为事件没发出去回滚状态。"""
        payload = build_team_handoff_payload(task, from_owner, to_owner, reason)
        try:
            await self._sink(TEAM_HANDOFF_EVENT_TYPE, payload)
        except Exception as e:  # noqa: BLE001
            logger.warning(
                "[agent_teams] 换手事件投递失败(task=%s, %s→%s): %s",
                task.id,
                from_owner or "(none)",
                to_owner or "(none)",
                e,
            )


# 模块级单例
team_orchestrator = TeamOrchestrator()
team_task_board = TeamTaskBoard()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
